import os
import random
import secrets
import string
import threading
import time
from functools import wraps
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv
from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_socketio import SocketIO, emit, join_room, leave_room

from database import (
    get_recent_matches,
    get_user_by_github_id,
    init_database,
    record_match,
    upsert_github_user,
    get_leaderboard,
)

load_dotenv()

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:5000").rstrip("/")
SECRET_KEY = os.getenv("SECRET_KEY", "duoarena-dev-secret-change-me")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")

app = Flask(__name__)
app.config.update(
    SECRET_KEY=SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=BASE_URL.startswith("https://"),
)

allowed_origins = [
    BASE_URL,
    "http://127.0.0.1:5000",
    "http://localhost:5000",
]

socketio = SocketIO(
    app,
    cors_allowed_origins=allowed_origins,
    async_mode="threading",
)

init_database()

# -----------------------------------------------------------------------------
# IN-MEMORY REALTIME STATE
# -----------------------------------------------------------------------------
# Render free instances can restart at any time, so rooms are intentionally
# ephemeral. Persistent stats live in SQLite for now (also ephemeral on Render
# free unless moved to a persistent DB later).

state_lock = threading.RLock()

rooms = {}
# room_code -> {
#   "host_github_id": int,
#   "game": "reaction",
#   "players": {
#       github_id: {
#           "github_id": int,
#           "login": str,
#           "avatar_url": str,
#           "sid": str,
#           "ready": bool,
#           "score": float|None,
#       }
#   },
#   "round_token": str|None,
#   "reaction_go_at": float|None,
#   "winner_github_id": int|None,
# }

online_users = {}
# lower(login) -> set(socket sid)


GAME_RULES = {
    "reaction": "min",
    "typing": "max",
    "cps": "max",
    "aim": "max",
    "blind": "min",
}


# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------

def current_user():
    user = session.get("user")
    if not user:
        return None
    return {
        "github_id": int(user["github_id"]),
        "login": str(user["login"]),
        "avatar_url": str(user.get("avatar_url") or ""),
    }


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            return redirect(url_for("login_github", next=request.path))
        return view(*args, **kwargs)
    return wrapped


def api_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            return jsonify({"ok": False, "error": "authentication_required"}), 401
        return view(*args, **kwargs)
    return wrapped


def socket_user():
    return current_user()


def generate_room_code(length=5):
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(length))
        with state_lock:
            if code not in rooms:
                return code


def public_player(player):
    return {
        "github_id": player["github_id"],
        "login": player["login"],
        "avatar_url": player.get("avatar_url", ""),
        "ready": bool(player.get("ready", False)),
        "score": player.get("score"),
    }


def room_payload(room_code):
    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return None
        return {
            "room": room_code,
            "game": room["game"],
            "host_github_id": room["host_github_id"],
            "players": [public_player(p) for p in room["players"].values()],
            "player_count": len(room["players"]),
            "winner_github_id": room.get("winner_github_id"),
        }


def find_user_room(github_id):
    with state_lock:
        for code, room in rooms.items():
            if github_id in room["players"]:
                return code
    return None


def add_online_user(login, sid):
    key = login.lower()
    with state_lock:
        online_users.setdefault(key, set()).add(sid)


def remove_online_sid(login, sid):
    key = login.lower()
    with state_lock:
        sids = online_users.get(key)
        if not sids:
            return
        sids.discard(sid)
        if not sids:
            online_users.pop(key, None)


def emit_room_state(room_code):
    payload = room_payload(room_code)
    if payload:
        socketio.emit("room_state", payload, to=room_code)


def emit_to_login(login, event, payload):
    with state_lock:
        sids = list(online_users.get(login.lower(), set()))
    for sid in sids:
        socketio.emit(event, payload, to=sid)
    return len(sids)


def remove_player_from_room(github_id, sid=None):
    room_code = find_user_room(github_id)
    if not room_code:
        return

    with state_lock:
        room = rooms.get(room_code)
        if not room or github_id not in room["players"]:
            return

        player = room["players"].pop(github_id)

        if sid:
            try:
                leave_room(room_code, sid=sid)
            except Exception:
                pass

        if not room["players"]:
            rooms.pop(room_code, None)
            return

        if room["host_github_id"] == github_id:
            room["host_github_id"] = next(iter(room["players"]))

        # Reset the round if somebody leaves.
        room["round_token"] = None
        room["reaction_go_at"] = None
        room["winner_github_id"] = None
        for p in room["players"].values():
            p["ready"] = False
            p["score"] = None

    socketio.emit(
        "player_left",
        {"github_id": github_id, "login": player["login"]},
        to=room_code,
    )
    emit_room_state(room_code)


def ensure_game(game):
    game = str(game or "reaction").lower().strip()
    return game if game in GAME_RULES else "reaction"


def create_room_for_user(user, game):
    old_room = find_user_room(user["github_id"])
    if old_room:
        remove_player_from_room(user["github_id"])

    room_code = generate_room_code()
    with state_lock:
        rooms[room_code] = {
            "host_github_id": user["github_id"],
            "game": ensure_game(game),
            "players": {
                user["github_id"]: {
                    **user,
                    "sid": request.sid,
                    "ready": False,
                    "score": None,
                }
            },
            "round_token": None,
            "reaction_go_at": None,
            "winner_github_id": None,
        }

    join_room(room_code)
    return room_code


def both_ready(room):
    players = list(room["players"].values())
    return len(players) == 2 and all(p["ready"] for p in players)


def reset_room_round(room):
    room["round_token"] = None
    room["reaction_go_at"] = None
    room["winner_github_id"] = None
    for player in room["players"].values():
        player["ready"] = False
        player["score"] = None


def start_reaction_round(room_code, round_token):
    # Random wait is generated on the server.
    socketio.sleep(random.uniform(1.5, 4.5))

    with state_lock:
        room = rooms.get(room_code)
        if not room or room.get("round_token") != round_token:
            return
        if not both_ready(room):
            return

        # perf_counter is monotonic and is used only inside this process.
        room["reaction_go_at"] = time.perf_counter()

    socketio.emit(
        "reaction_go",
        {
            "room": room_code,
            "round_token": round_token,
        },
        to=room_code,
    )


def finish_generic_round_if_ready(room_code):
    with state_lock:
        room = rooms.get(room_code)
        if not room or len(room["players"]) != 2:
            return

        players = list(room["players"].values())
        if any(p["score"] is None for p in players):
            return

        game = room["game"]
        rule = GAME_RULES.get(game, "max")

        a, b = players
        if a["score"] == b["score"]:
            winner = None
            loser = None
        else:
            if rule == "min":
                winner, loser = (a, b) if a["score"] < b["score"] else (b, a)
            else:
                winner, loser = (a, b) if a["score"] > b["score"] else (b, a)

        room["winner_github_id"] = winner["github_id"] if winner else None

        result_payload = {
            "room": room_code,
            "game": game,
            "winner": public_player(winner) if winner else None,
            "loser": public_player(loser) if loser else None,
            "draw": winner is None,
            "scores": {
                str(a["github_id"]): a["score"],
                str(b["github_id"]): b["score"],
            },
        }

        if winner and loser:
            record_match(
                game=game,
                winner_github_id=winner["github_id"],
                loser_github_id=loser["github_id"],
                winner_score=winner["score"],
                loser_score=loser["score"],
            )

    socketio.emit("round_result", result_payload, to=room_code)
    emit_room_state(room_code)


# -----------------------------------------------------------------------------
# HTTP PAGES
# -----------------------------------------------------------------------------

@app.get("/")
def index():
    return render_template("index.html", user=current_user())


@app.get("/reaction")
@login_required
def reaction():
    return render_template("reaction.html", user=current_user())


@app.get("/typing")
@login_required
def typing():
    return render_template("typing.html", user=current_user())


@app.get("/cps")
@login_required
def cps():
    return render_template("cps.html", user=current_user())


@app.get("/aim")
@login_required
def aim():
    return render_template("aim.html", user=current_user())


@app.get("/blind")
@login_required
def blind():
    return render_template("blind.html", user=current_user())


@app.get("/stats")
def stats():
    return render_template("stats.html", user=current_user())


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "duoarena"})


# -----------------------------------------------------------------------------
# GITHUB OAUTH
# -----------------------------------------------------------------------------

@app.get("/login/github")
def login_github():
    if not GITHUB_CLIENT_ID:
        return "GITHUB_CLIENT_ID is not configured", 500

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_next"] = request.args.get("next") or "/"

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{BASE_URL}/auth/github/callback",
        "scope": "read:user",
        "state": state,
    }
    return redirect("https://github.com/login/oauth/authorize?" + urlencode(params))


@app.get("/auth/github/callback")
def github_callback():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return "GitHub OAuth is not configured on the server", 500

    code = request.args.get("code")
    state = request.args.get("state")
    expected_state = session.pop("oauth_state", None)

    if not code or not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return "Invalid GitHub OAuth state", 400

    token_response = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": f"{BASE_URL}/auth/github/callback",
        },
        timeout=15,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        return jsonify({
            "ok": False,
            "error": "github_token_exchange_failed",
            "details": token_data,
        }), 400

    user_response = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=15,
    )
    user_response.raise_for_status()
    gh = user_response.json()

    user = {
        "github_id": int(gh["id"]),
        "login": gh["login"],
        "avatar_url": gh.get("avatar_url") or "",
    }

    upsert_github_user(
        github_id=user["github_id"],
        login=user["login"],
        avatar_url=user["avatar_url"],
    )

    session.clear()
    session["user"] = user
    session.permanent = True

    destination = "/"
    # oauth_next is cleared by session.clear(), so only allow home after login.
    return redirect(destination)


@app.get("/logout")
def logout():
    session.clear()
    return redirect("/")


# -----------------------------------------------------------------------------
# HTTP API
# -----------------------------------------------------------------------------

@app.get("/api/me")
def api_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False, "user": None}), 401

    stored = get_user_by_github_id(user["github_id"])
    return jsonify({
        "authenticated": True,
        "user": stored or user,
    })


@app.get("/api/stats")
def api_stats():
    return jsonify({
        "ok": True,
        "leaderboard": get_leaderboard(limit=20),
        "recent_matches": get_recent_matches(limit=30),
    })


@app.get("/api/rooms/<room_code>")
@api_login_required
def api_room(room_code):
    payload = room_payload(room_code.upper())
    if not payload:
        return jsonify({"ok": False, "error": "room_not_found"}), 404
    return jsonify({"ok": True, **payload})


# -----------------------------------------------------------------------------
# SOCKET.IO CONNECTION
# -----------------------------------------------------------------------------

@socketio.on("connect")
def on_connect(auth=None):
    user = socket_user()
    if not user:
        return False

    add_online_user(user["login"], request.sid)

    emit("auth_user", {
        "github_id": user["github_id"],
        "login": user["login"],
        "avatar_url": user["avatar_url"],
    })

    socketio.emit(
        "presence",
        {"login": user["login"], "online": True},
        broadcast=True,
    )


@socketio.on("disconnect")
def on_disconnect(reason=None):
    user = socket_user()
    if not user:
        return

    remove_online_sid(user["login"], request.sid)
    remove_player_from_room(user["github_id"], request.sid)

    with state_lock:
        still_online = bool(online_users.get(user["login"].lower()))

    if not still_online:
        socketio.emit(
            "presence",
            {"login": user["login"], "online": False},
            broadcast=True,
        )


# -----------------------------------------------------------------------------
# ROOM EVENTS
# -----------------------------------------------------------------------------

@socketio.on("create_room")
def on_create_room(data=None):
    user = socket_user()
    if not user:
        return emit("room_error", {"message": "Not authenticated"})

    data = data or {}
    game = ensure_game(data.get("game"))
    room_code = create_room_for_user(user, game)

    emit("room_created", {
        "room": room_code,
        "game": game,
    })
    emit_room_state(room_code)


@socketio.on("join_room")
def on_join_room(data=None):
    user = socket_user()
    if not user:
        return emit("room_error", {"message": "Not authenticated"})

    data = data or {}
    room_code = str(data.get("room") or "").upper().strip()

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return emit("room_error", {"message": "Room not found"})
        if user["github_id"] in room["players"]:
            join_room(room_code)
            return emit_room_state(room_code)
        if len(room["players"]) >= 2:
            return emit("room_error", {"message": "Room is full"})

    old_room = find_user_room(user["github_id"])
    if old_room and old_room != room_code:
        remove_player_from_room(user["github_id"])

    with state_lock:
        room = rooms.get(room_code)
        if not room or len(room["players"]) >= 2:
            return emit("room_error", {"message": "Room is unavailable"})

        room["players"][user["github_id"]] = {
            **user,
            "sid": request.sid,
            "ready": False,
            "score": None,
        }

    join_room(room_code)
    socketio.emit(
        "player_joined",
        {
            "room": room_code,
            "player": user,
        },
        to=room_code,
    )
    emit_room_state(room_code)


@socketio.on("leave_room")
def on_leave_room(data=None):
    user = socket_user()
    if not user:
        return
    remove_player_from_room(user["github_id"], request.sid)


@socketio.on("player_ready")
def on_player_ready(data=None):
    user = socket_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return emit("room_error", {"message": "You are not in a room"})

    with state_lock:
        room = rooms.get(room_code)
        if not room or user["github_id"] not in room["players"]:
            return

        player = room["players"][user["github_id"]]
        player["ready"] = True
        player["score"] = None

        should_start = both_ready(room)

        if should_start:
            room["winner_github_id"] = None
            room["round_token"] = secrets.token_urlsafe(12)
            round_token = room["round_token"]
            game = room["game"]
        else:
            round_token = None
            game = room["game"]

    emit_room_state(room_code)

    if not should_start:
        return

    socketio.emit(
        "all_players_ready",
        {
            "room": room_code,
            "game": game,
            "round_token": round_token,
        },
        to=room_code,
    )

    if game == "reaction":
        socketio.start_background_task(
            start_reaction_round,
            room_code,
            round_token,
        )
    else:
        socketio.emit(
            "round_start",
            {
                "room": room_code,
                "game": game,
                "round_token": round_token,
            },
            to=room_code,
        )


@socketio.on("reset_ready")
def on_reset_ready(data=None):
    user = socket_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return
        reset_room_round(room)

    emit_room_state(room_code)


# -----------------------------------------------------------------------------
# CHALLENGES
# -----------------------------------------------------------------------------

@socketio.on("challenge")
def on_challenge(data=None):
    user = socket_user()
    if not user:
        return

    data = data or {}
    target_login = str(data.get("target_login") or "").strip()
    game = ensure_game(data.get("game"))

    if not target_login:
        return emit("challenge_error", {"message": "target_login is required"})

    if target_login.lower() == user["login"].lower():
        return emit("challenge_error", {"message": "You cannot challenge yourself"})

    room_code = create_room_for_user(user, game)

    delivered = emit_to_login(
        target_login,
        "incoming_challenge",
        {
            "room": room_code,
            "game": game,
            "from": user,
        },
    )

    if not delivered:
        remove_player_from_room(user["github_id"])
        return emit("challenge_error", {"message": f"{target_login} is offline"})

    emit("challenge_sent", {
        "target_login": target_login,
        "room": room_code,
        "game": game,
    })
    emit_room_state(room_code)


@socketio.on("challenge_response")
def on_challenge_response(data=None):
    user = socket_user()
    if not user:
        return

    data = data or {}
    room_code = str(data.get("room") or "").upper().strip()
    accepted = bool(data.get("accepted"))

    if not accepted:
        with state_lock:
            room = rooms.get(room_code)
            host = room["players"].get(room["host_github_id"]) if room else None
            host_sid = host.get("sid") if host else None

        if host_sid:
            socketio.emit(
                "challenge_declined",
                {"by": user},
                to=host_sid,
            )
        return

    on_join_room({"room": room_code})


# -----------------------------------------------------------------------------
# GAME EVENTS
# -----------------------------------------------------------------------------

@socketio.on("reaction_click")
def on_reaction_click(data=None):
    user = socket_user()
    if not user:
        return

    data = data or {}
    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    with state_lock:
        room = rooms.get(room_code)
        if not room or room["game"] != "reaction":
            return

        player = room["players"].get(user["github_id"])
        if not player:
            return

        if player["score"] is not None:
            return

        go_at = room.get("reaction_go_at")
        if go_at is None:
            # False start.
            player["score"] = 999999.0
            socketio.emit(
                "false_start",
                {"player": public_player(player)},
                to=room_code,
            )
        else:
            player["score"] = round((time.perf_counter() - go_at) * 1000.0, 2)
            socketio.emit(
                "reaction_result",
                {
                    "player": public_player(player),
                    "milliseconds": player["score"],
                },
                to=room_code,
            )

    finish_generic_round_if_ready(room_code)


@socketio.on("submit_score")
def on_submit_score(data=None):
    user = socket_user()
    if not user:
        return

    data = data or {}
    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    try:
        score = float(data.get("score"))
    except (TypeError, ValueError):
        return emit("game_error", {"message": "score must be numeric"})

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return

        if room["game"] == "reaction":
            return emit("game_error", {"message": "Use reaction_click for reaction mode"})

        player = room["players"].get(user["github_id"])
        if not player:
            return

        if player["score"] is not None:
            return

        player["score"] = score

        socketio.emit(
            "score_submitted",
            {
                "player": public_player(player),
                "score": score,
                "game": room["game"],
            },
            to=room_code,
        )

    finish_generic_round_if_ready(room_code)


# -----------------------------------------------------------------------------
# LOCAL DEV ENTRYPOINT
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=os.getenv("FLASK_DEBUG", "1") == "1",
        allow_unsafe_werkzeug=True,
    )
