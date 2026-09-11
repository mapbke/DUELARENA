import math
import os
import random
import secrets
import threading
import time
from functools import wraps
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room

from database import (
    get_leaderboard,
    get_recent_matches,
    get_user_by_github_id,
    init_database,
    record_match,
    upsert_github_user,
)

load_dotenv()

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

socketio = SocketIO(
    app,
    cors_allowed_origins=[
        BASE_URL,
        "http://127.0.0.1:5000",
        "http://localhost:5000",
    ],
    async_mode="threading",
)

init_database()

state_lock = threading.RLock()
rooms = {}

GAME_RULES = {
    "reaction": "min",
    "typing": "max",
    "cps": "max",
    "aim": "max",
    "blind": "min",
}

GAME_NAMES = {
    "reaction": "Reaction Duel",
    "typing": "Typing Duel",
    "cps": "CPS Battle",
    "aim": "Aim Duel",
    "blind": "Blind Timing",
}


def current_user():
    raw = session.get("user")
    if not raw:
        return None
    return {
        "github_id": int(raw["github_id"]),
        "login": str(raw["login"]),
        "avatar_url": str(raw.get("avatar_url") or ""),
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


def safe_next_path(value):
    if not value or not value.startswith("/") or value.startswith("//"):
        return "/"
    return value


def ensure_game(value):
    game = str(value or "reaction").lower().strip()
    return game if game in GAME_RULES else "reaction"


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
        "connected": bool(player.get("connected", False)),
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
            "game_name": GAME_NAMES[room["game"]],
            "round": room["round"],
            "host_github_id": room["host_github_id"],
            "players": [public_player(p) for p in room["players"].values()],
            "player_count": len(room["players"]),
        }


def find_user_room(github_id):
    with state_lock:
        for room_code, room in rooms.items():
            if github_id in room["players"]:
                return room_code
    return None


def emit_room_state(room_code):
    payload = room_payload(room_code)
    if payload:
        socketio.emit("room_state", payload, to=room_code)


def remove_player_state(github_id, room_code=None):
    with state_lock:
        code = room_code or find_user_room(github_id)
        if not code:
            return None

        room = rooms.get(code)
        if not room or github_id not in room["players"]:
            return None

        player = room["players"].pop(github_id)

        if not room["players"]:
            rooms.pop(code, None)
            return {"room": code, "player": player, "room_deleted": True}

        if room["host_github_id"] == github_id:
            room["host_github_id"] = next(iter(room["players"]))

        room["round_token"] = None
        room["reaction_go_at"] = None
        for p in room["players"].values():
            p["ready"] = False
            p["score"] = None

        return {"room": code, "player": player, "room_deleted": False}


def notify_player_removed(result):
    if not result or result["room_deleted"]:
        return
    room_code = result["room"]
    socketio.emit(
        "player_left",
        {
            "github_id": result["player"]["github_id"],
            "login": result["player"]["login"],
        },
        to=room_code,
    )
    emit_room_state(room_code)


def disconnect_cleanup(github_id, room_code, sid):
    socketio.sleep(10)

    should_remove = False
    with state_lock:
        room = rooms.get(room_code)
        player = room["players"].get(github_id) if room else None
        if (
            player
            and player.get("sid") == sid
            and not player.get("connected", False)
        ):
            should_remove = True

    if should_remove:
        result = remove_player_state(github_id, room_code)
        notify_player_removed(result)


def both_ready(room):
    players = list(room["players"].values())
    return (
        len(players) == 2
        and all(p.get("connected") for p in players)
        and all(p.get("ready") for p in players)
    )


def start_round_if_possible(room_code):
    with state_lock:
        room = rooms.get(room_code)
        if not room or not both_ready(room) or room.get("round_token"):
            return

        room["round_token"] = secrets.token_urlsafe(16)
        room["reaction_go_at"] = None

        for player in room["players"].values():
            player["score"] = None

        token = room["round_token"]
        game = room["game"]
        round_number = room["round"]

    socketio.emit(
        "round_prepare",
        {
            "room": room_code,
            "game": game,
            "round": round_number,
            "round_token": token,
        },
        to=room_code,
    )

    if game == "reaction":
        socketio.start_background_task(start_reaction_round, room_code, token)
    else:
        socketio.emit(
            "round_start",
            {
                "room": room_code,
                "game": game,
                "round": round_number,
                "round_token": token,
            },
            to=room_code,
        )


def start_reaction_round(room_code, token):
    socketio.sleep(random.uniform(1.6, 4.2))

    with state_lock:
        room = rooms.get(room_code)
        if not room or room.get("round_token") != token:
            return
        if not both_ready(room):
            return

        room["reaction_go_at"] = time.perf_counter()
        round_number = room["round"]

    socketio.emit(
        "reaction_go",
        {
            "room": room_code,
            "round": round_number,
            "round_token": token,
        },
        to=room_code,
    )


def finish_round_if_ready(room_code):
    match_record = None

    with state_lock:
        room = rooms.get(room_code)
        if not room or len(room["players"]) != 2:
            return

        players = list(room["players"].values())
        if any(p.get("score") is None for p in players):
            return

        a, b = players
        rule = GAME_RULES[room["game"]]

        if a["score"] == b["score"]:
            winner = None
            loser = None
        elif rule == "min":
            winner, loser = (a, b) if a["score"] < b["score"] else (b, a)
        else:
            winner, loser = (a, b) if a["score"] > b["score"] else (b, a)

        result = {
            "room": room_code,
            "game": room["game"],
            "round": room["round"],
            "draw": winner is None,
            "winner": public_player(winner) if winner else None,
            "loser": public_player(loser) if loser else None,
            "scores": {
                str(a["github_id"]): a["score"],
                str(b["github_id"]): b["score"],
            },
        }

        if winner and loser:
            match_record = {
                "game": room["game"],
                "winner_github_id": winner["github_id"],
                "loser_github_id": loser["github_id"],
                "winner_score": winner["score"],
                "loser_score": loser["score"],
            }

        room["round"] += 1
        room["round_token"] = None
        room["reaction_go_at"] = None

        for player in room["players"].values():
            player["ready"] = False
            player["score"] = None

    if match_record:
        record_match(**match_record)

    socketio.emit("round_result", result, to=room_code)
    emit_room_state(room_code)


# -----------------------------------------------------------------------------
# HTTP
# -----------------------------------------------------------------------------

@app.get("/")
def index():
    return render_template("index.html", user=current_user())


def render_game(template_name):
    return render_template(template_name, user=current_user())


@app.get("/reaction")
@login_required
def reaction():
    return render_game("reaction.html")


@app.get("/typing")
@login_required
def typing():
    return render_game("typing.html")


@app.get("/cps")
@login_required
def cps():
    return render_game("cps.html")


@app.get("/aim")
@login_required
def aim():
    return render_game("aim.html")


@app.get("/blind")
@login_required
def blind():
    return render_game("blind.html")


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
    session["oauth_next"] = safe_next_path(request.args.get("next"))

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{BASE_URL}/auth/github/callback",
        "scope": "read:user",
        "state": state,
    }
    return redirect(
        "https://github.com/login/oauth/authorize?" + urlencode(params)
    )


@app.get("/auth/github/callback")
def github_callback():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return "GitHub OAuth is not configured on the server", 500

    code = request.args.get("code")
    state = request.args.get("state")
    expected_state = session.get("oauth_state")
    destination = safe_next_path(session.get("oauth_next"))

    if (
        not code
        or not state
        or not expected_state
        or not secrets.compare_digest(state, expected_state)
    ):
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
        return jsonify(
            {
                "ok": False,
                "error": "github_token_exchange_failed",
                "details": token_data,
            }
        ), 400

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
        "login": str(gh["login"]),
        "avatar_url": str(gh.get("avatar_url") or ""),
    }

    upsert_github_user(
        github_id=user["github_id"],
        login=user["login"],
        avatar_url=user["avatar_url"],
    )

    session.clear()
    session["user"] = user
    session.permanent = True

    return redirect(destination)


@app.get("/logout")
def logout():
    session.clear()
    return redirect("/")


# -----------------------------------------------------------------------------
# API
# -----------------------------------------------------------------------------

@app.get("/api/me")
def api_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False, "user": None}), 401

    return jsonify(
        {
            "authenticated": True,
            "user": get_user_by_github_id(user["github_id"]) or user,
        }
    )


@app.get("/api/stats")
def api_stats():
    return jsonify(
        {
            "ok": True,
            "leaderboard": get_leaderboard(limit=20),
            "recent_matches": get_recent_matches(limit=30),
        }
    )


@app.get("/api/rooms/<room_code>")
@api_login_required
def api_room(room_code):
    payload = room_payload(room_code.upper())
    if not payload:
        return jsonify({"ok": False, "error": "room_not_found"}), 404
    return jsonify({"ok": True, **payload})


# -----------------------------------------------------------------------------
# SOCKET.IO
# -----------------------------------------------------------------------------

@socketio.on("connect")
def on_connect(auth=None):
    user = current_user()
    if not user:
        return False

    emit(
        "auth_user",
        {
            "github_id": user["github_id"],
            "login": user["login"],
            "avatar_url": user["avatar_url"],
        },
    )
    emit("socket_status", {"connected": True})


@socketio.on("disconnect")
def on_disconnect(reason=None):
    user = current_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    sid = request.sid
    with state_lock:
        room = rooms.get(room_code)
        player = room["players"].get(user["github_id"]) if room else None
        if not player or player.get("sid") != sid:
            return

        player["connected"] = False
        player["ready"] = False
        room["round_token"] = None
        room["reaction_go_at"] = None

    emit_room_state(room_code)
    socketio.start_background_task(
        disconnect_cleanup,
        user["github_id"],
        room_code,
        sid,
    )


@socketio.on("create_room")
def on_create_room(data=None):
    user = current_user()
    if not user:
        return emit("room_error", {"message": "Нужно войти через GitHub."})

    data = data or {}
    game = ensure_game(data.get("game"))

    old_room = find_user_room(user["github_id"])
    if old_room:
        try:
            leave_room(old_room)
        except Exception:
            pass
        result = remove_player_state(user["github_id"], old_room)
        notify_player_removed(result)

    room_code = generate_room_code()

    with state_lock:
        rooms[room_code] = {
            "host_github_id": user["github_id"],
            "game": game,
            "round": 1,
            "round_token": None,
            "reaction_go_at": None,
            "players": {
                user["github_id"]: {
                    **user,
                    "sid": request.sid,
                    "connected": True,
                    "ready": False,
                    "score": None,
                }
            },
        }

    join_room(room_code)
    emit("room_created", {"room": room_code, "game": game})
    emit_room_state(room_code)


@socketio.on("join_room")
def on_join_room(data=None):
    user = current_user()
    if not user:
        return emit("room_error", {"message": "Нужно войти через GitHub."})

    data = data or {}
    room_code = str(data.get("room") or "").upper().strip()

    if len(room_code) != 5:
        return emit("room_error", {"message": "Код комнаты состоит из 5 символов."})

    old_room = find_user_room(user["github_id"])
    if old_room and old_room != room_code:
        try:
            leave_room(old_room)
        except Exception:
            pass
        result = remove_player_state(user["github_id"], old_room)
        notify_player_removed(result)

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return emit("room_error", {"message": "Комната не найдена."})

        existing = room["players"].get(user["github_id"])
        if existing:
            existing["sid"] = request.sid
            existing["connected"] = True
            existing["ready"] = False
            existing["score"] = None
        else:
            if len(room["players"]) >= 2:
                return emit("room_error", {"message": "Комната уже заполнена."})

            room["players"][user["github_id"]] = {
                **user,
                "sid": request.sid,
                "connected": True,
                "ready": False,
                "score": None,
            }

        room["round_token"] = None
        room["reaction_go_at"] = None

    join_room(room_code)
    emit("room_joined", {"room": room_code})
    emit_room_state(room_code)


@socketio.on("leave_room")
def on_leave_room(data=None):
    user = current_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    try:
        leave_room(room_code)
    except Exception:
        pass

    result = remove_player_state(user["github_id"], room_code)
    notify_player_removed(result)
    emit("room_left", {"room": room_code})


@socketio.on("player_ready")
def on_player_ready(data=None):
    user = current_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return emit("room_error", {"message": "Сначала войдите в комнату."})

    with state_lock:
        room = rooms.get(room_code)
        player = room["players"].get(user["github_id"]) if room else None

        if not room or not player:
            return

        if len(room["players"]) != 2:
            return emit("room_error", {"message": "Ждём второго игрока."})

        player["ready"] = True
        player["score"] = None

    emit_room_state(room_code)
    start_round_if_possible(room_code)


@socketio.on("reaction_click")
def on_reaction_click(data=None):
    user = current_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    data = data or {}
    token = str(data.get("round_token") or "")

    with state_lock:
        room = rooms.get(room_code)
        if not room or room["game"] != "reaction":
            return

        if not token or room.get("round_token") != token:
            return

        player = room["players"].get(user["github_id"])
        if not player or player.get("score") is not None:
            return

        go_at = room.get("reaction_go_at")

        if go_at is None:
            player["score"] = 999999.0
            socketio.emit(
                "false_start",
                {"player": public_player(player)},
                to=room_code,
            )
        else:
            player["score"] = round(
                (time.perf_counter() - go_at) * 1000.0,
                2,
            )
            socketio.emit(
                "reaction_result",
                {
                    "player": public_player(player),
                    "milliseconds": player["score"],
                },
                to=room_code,
            )

    finish_round_if_ready(room_code)


@socketio.on("submit_score")
def on_submit_score(data=None):
    user = current_user()
    if not user:
        return

    room_code = find_user_room(user["github_id"])
    if not room_code:
        return

    data = data or {}
    token = str(data.get("round_token") or "")

    try:
        score = float(data.get("score"))
    except (TypeError, ValueError):
        return emit("game_error", {"message": "Некорректный результат."})

    if not math.isfinite(score) or score < 0 or score > 1_000_000_000:
        return emit("game_error", {"message": "Некорректный результат."})

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return

        if room["game"] == "reaction":
            return emit("game_error", {"message": "Для реакции используется отдельный обработчик."})

        if not token or room.get("round_token") != token:
            return emit("game_error", {"message": "Этот раунд уже завершён."})

        player = room["players"].get(user["github_id"])
        if not player or player.get("score") is not None:
            return

        player["score"] = round(score, 3)

        socketio.emit(
            "score_submitted",
            {
                "player": public_player(player),
                "game": room["game"],
                "score": player["score"],
            },
            to=room_code,
        )

    finish_round_if_ready(room_code)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    socketio.run(
        app,
        host="0.0.0.0",
        port=port,
        debug=os.getenv("FLASK_DEBUG", "1") == "1",
        allow_unsafe_werkzeug=True,
    )
