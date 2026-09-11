import math
import os
import random
import re
import secrets
import threading
import time
import uuid
from functools import wraps
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room

from database import (
    get_leaderboard,
    get_recent_matches,
    get_stats_summary,
    get_user,
    init_database,
    record_match,
    upsert_user,
)

load_dotenv()

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:5000").rstrip("/")
SECRET_KEY = os.getenv("SECRET_KEY", "duoarena-dev-secret-change-me")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

app = Flask(__name__)
app.config.update(
    SECRET_KEY=SECRET_KEY,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=BASE_URL.startswith("https://"),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)

socketio = SocketIO(
    app,
    cors_allowed_origins=[BASE_URL, "http://127.0.0.1:5000", "http://localhost:5000"],
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

GUEST_NAME_RE = re.compile(r"[^A-Za-zА-Яа-яЁё0-9 _.-]+")


def _legacy_session_to_user(raw):
    if not raw or "github_id" not in raw:
        return None
    gid = str(raw["github_id"])
    login = str(raw.get("login") or f"github-{gid}")
    return {
        "user_id": f"github:{gid}",
        "provider": "github",
        "provider_subject": gid,
        "login": login,
        "display_name": login,
        "avatar_url": str(raw.get("avatar_url") or ""),
        "email": "",
        "is_guest": False,
    }


def normalize_session_user(raw):
    if not raw:
        return None
    if "user_id" not in raw:
        return _legacy_session_to_user(raw)
    return {
        "user_id": str(raw["user_id"]),
        "provider": str(raw.get("provider") or "guest"),
        "provider_subject": str(raw.get("provider_subject") or raw["user_id"]),
        "login": str(raw.get("login") or raw.get("display_name") or "Player"),
        "display_name": str(raw.get("display_name") or raw.get("login") or "Player"),
        "avatar_url": str(raw.get("avatar_url") or ""),
        "email": str(raw.get("email") or ""),
        "is_guest": bool(raw.get("is_guest", False)),
    }


def persist_session_user(user):
    upsert_user(
        user_id=user["user_id"],
        provider=user["provider"],
        provider_subject=user["provider_subject"],
        login=user["login"],
        display_name=user["display_name"],
        avatar_url=user["avatar_url"],
        email=user["email"],
        is_guest=user["is_guest"],
    )


def current_user():
    user = normalize_session_user(session.get("user"))
    if not user:
        return None
    try:
        persist_session_user(user)
    except Exception:
        app.logger.exception("Failed to persist authenticated user")
    session["user"] = user
    return user


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_user():
            return redirect(url_for("login", next=request.path))
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


def provider_label(provider):
    return {"github": "GitHub", "google": "Google", "guest": "Guest"}.get(provider, provider.title())


def set_logged_in_user(user, destination="/"):
    persist_session_user(user)
    session.clear()
    session["user"] = user
    session.permanent = True
    return redirect(safe_next_path(destination))


def clean_guest_name(value):
    value = GUEST_NAME_RE.sub("", str(value or "")).strip()
    value = re.sub(r"\s+", " ", value)
    return value[:20]


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
        "user_id": player["user_id"],
        "provider": player["provider"],
        "display_name": player["display_name"],
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
            "host_user_id": room["host_user_id"],
            "players": [public_player(p) for p in room["players"].values()],
            "player_count": len(room["players"]),
        }


def find_user_room(user_id):
    with state_lock:
        for room_code, room in rooms.items():
            if user_id in room["players"]:
                return room_code
    return None


def emit_room_state(room_code):
    payload = room_payload(room_code)
    if payload:
        socketio.emit("room_state", payload, to=room_code)


def remove_player_state(user_id, room_code=None):
    with state_lock:
        code = room_code or find_user_room(user_id)
        if not code:
            return None
        room = rooms.get(code)
        if not room or user_id not in room["players"]:
            return None
        player = room["players"].pop(user_id)
        if not room["players"]:
            rooms.pop(code, None)
            return {"room": code, "player": player, "room_deleted": True}
        if room["host_user_id"] == user_id:
            room["host_user_id"] = next(iter(room["players"]))
        room["round_token"] = None
        room["reaction_go_at"] = None
        for p in room["players"].values():
            p["ready"] = False
            p["score"] = None
        return {"room": code, "player": player, "room_deleted": False}


def notify_player_removed(result):
    if not result or result["room_deleted"]:
        return
    socketio.emit(
        "player_left",
        {"user_id": result["player"]["user_id"], "display_name": result["player"]["display_name"]},
        to=result["room"],
    )
    emit_room_state(result["room"])


def disconnect_cleanup(user_id, room_code, sid):
    socketio.sleep(10)
    should_remove = False
    with state_lock:
        room = rooms.get(room_code)
        player = room["players"].get(user_id) if room else None
        if player and player.get("sid") == sid and not player.get("connected", False):
            should_remove = True
    if should_remove:
        notify_player_removed(remove_player_state(user_id, room_code))


def both_ready(room):
    players = list(room["players"].values())
    return len(players) == 2 and all(p.get("connected") for p in players) and all(p.get("ready") for p in players)


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

    socketio.emit("round_prepare", {"room": room_code, "game": game, "round": round_number, "round_token": token}, to=room_code)
    if game == "reaction":
        socketio.start_background_task(start_reaction_round, room_code, token)
    else:
        socketio.emit("round_start", {"room": room_code, "game": game, "round": round_number, "round_token": token}, to=room_code)


def start_reaction_round(room_code, token):
    socketio.sleep(random.uniform(1.6, 4.2))
    with state_lock:
        room = rooms.get(room_code)
        if not room or room.get("round_token") != token or not both_ready(room):
            return
        room["reaction_go_at"] = time.perf_counter()
        round_number = room["round"]
    socketio.emit("reaction_go", {"room": room_code, "round": round_number, "round_token": token}, to=room_code)


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
            winner = loser = None
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
            "scores": {str(a["user_id"]): a["score"], str(b["user_id"]): b["score"]},
        }

        if winner and loser:
            match_record = {
                "game": room["game"],
                "winner_user_id": winner["user_id"],
                "loser_user_id": loser["user_id"],
                "winner_name": winner["display_name"],
                "loser_name": loser["display_name"],
                "winner_avatar_url": winner.get("avatar_url", ""),
                "loser_avatar_url": loser.get("avatar_url", ""),
                "winner_provider": winner["provider"],
                "loser_provider": loser["provider"],
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


@app.get("/")
def index():
    user = current_user()
    if not user:
        return redirect(url_for("login"))
    return render_template("index.html", user=user, profile=get_user(user["user_id"]), provider_name=provider_label(user["provider"]))


@app.get("/login")
def login():
    user = current_user()
    if user:
        return redirect(safe_next_path(request.args.get("next")))
    return render_template(
        "login.html",
        user=None,
        next_path=safe_next_path(request.args.get("next")),
        github_enabled=bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET),
        google_enabled=bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
    )


def render_game(template_name):
    user = current_user()
    return render_template(template_name, user=user, provider_name=provider_label(user["provider"]))


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
@login_required
def stats():
    user = current_user()
    return render_template("stats.html", user=user, provider_name=provider_label(user["provider"]))


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "duoarena", "version": "4"})


@app.post("/login/guest")
def login_guest():
    name = clean_guest_name(request.form.get("display_name")) or f"Guest-{secrets.token_hex(2).upper()}"
    subject = str(uuid.uuid4())
    user = {
        "user_id": f"guest:{subject}",
        "provider": "guest",
        "provider_subject": subject,
        "login": name,
        "display_name": name,
        "avatar_url": "",
        "email": "",
        "is_guest": True,
    }
    return set_logged_in_user(user, request.form.get("next") or "/")


@app.get("/login/github")
def login_github():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return "GitHub OAuth is not configured", 503
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_provider"] = "github"
    session["oauth_next"] = safe_next_path(request.args.get("next"))
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": f"{BASE_URL}/auth/github/callback",
        "scope": "read:user user:email",
        "state": state,
    }
    return redirect("https://github.com/login/oauth/authorize?" + urlencode(params))


@app.get("/auth/github/callback")
def github_callback():
    if session.get("oauth_provider") != "github" or not request.args.get("code") or request.args.get("state") != session.get("oauth_state"):
        return "Invalid GitHub OAuth state", 400
    destination = safe_next_path(session.get("oauth_next"))
    token_response = requests.post(
        "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        data={
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": request.args["code"],
            "redirect_uri": f"{BASE_URL}/auth/github/callback",
        },
        timeout=15,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        return jsonify({"ok": False, "error": "github_token_exchange_failed", "details": token_data}), 400

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    profile_response = requests.get("https://api.github.com/user", headers=headers, timeout=15)
    profile_response.raise_for_status()
    gh = profile_response.json()

    email = str(gh.get("email") or "")
    if not email:
        try:
            er = requests.get("https://api.github.com/user/emails", headers=headers, timeout=15)
            if er.ok:
                primary = next((item for item in er.json() if item.get("primary") and item.get("verified")), None)
                if primary:
                    email = str(primary.get("email") or "")
        except Exception:
            app.logger.exception("Could not fetch GitHub email")

    subject = str(gh["id"])
    login_name = str(gh["login"])
    user = {
        "user_id": f"github:{subject}",
        "provider": "github",
        "provider_subject": subject,
        "login": login_name,
        "display_name": str(gh.get("name") or login_name),
        "avatar_url": str(gh.get("avatar_url") or ""),
        "email": email,
        "is_guest": False,
    }
    return set_logged_in_user(user, destination)


@app.get("/login/google")
def login_google():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return "Google OAuth is not configured", 503
    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_provider"] = "google"
    session["oauth_next"] = safe_next_path(request.args.get("next"))
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BASE_URL}/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return redirect("https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params))


@app.get("/auth/google/callback")
def google_callback():
    if session.get("oauth_provider") != "google" or not request.args.get("code") or request.args.get("state") != session.get("oauth_state"):
        return "Invalid Google OAuth state", 400
    destination = safe_next_path(session.get("oauth_next"))
    token_response = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": request.args["code"],
            "grant_type": "authorization_code",
            "redirect_uri": f"{BASE_URL}/auth/google/callback",
        },
        timeout=15,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        return jsonify({"ok": False, "error": "google_token_exchange_failed", "details": token_data}), 400

    pr = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=15,
    )
    pr.raise_for_status()
    profile = pr.json()

    subject = str(profile["sub"])
    display_name = str(profile.get("name") or profile.get("given_name") or profile.get("email", "Google Player").split("@")[0])
    user = {
        "user_id": f"google:{subject}",
        "provider": "google",
        "provider_subject": subject,
        "login": str(profile.get("email") or display_name),
        "display_name": display_name,
        "avatar_url": str(profile.get("picture") or ""),
        "email": str(profile.get("email") or ""),
        "is_guest": False,
    }
    return set_logged_in_user(user, destination)


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.get("/api/me")
def api_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False, "user": None}), 401
    return jsonify({"authenticated": True, "user": get_user(user["user_id"]) or user})


@app.get("/api/stats")
def api_stats():
    current_user()
    return jsonify({
        "ok": True,
        "summary": get_stats_summary(),
        "leaderboard": get_leaderboard(limit=25),
        "recent_matches": get_recent_matches(limit=50),
    })


@app.get("/api/rooms/<room_code>")
@api_login_required
def api_room(room_code):
    payload = room_payload(room_code.upper())
    if not payload:
        return jsonify({"ok": False, "error": "room_not_found"}), 404
    return jsonify({"ok": True, **payload})


@socketio.on("connect")
def on_connect(auth=None):
    user = current_user()
    if not user:
        return False
    emit("auth_user", {
        "user_id": user["user_id"],
        "provider": user["provider"],
        "display_name": user["display_name"],
        "login": user["login"],
        "avatar_url": user["avatar_url"],
    })
    emit("socket_status", {"connected": True})


@socketio.on("disconnect")
def on_disconnect(reason=None):
    user = current_user()
    if not user:
        return
    room_code = find_user_room(user["user_id"])
    if not room_code:
        return
    sid = request.sid
    with state_lock:
        room = rooms.get(room_code)
        player = room["players"].get(user["user_id"]) if room else None
        if not player or player.get("sid") != sid:
            return
        player["connected"] = False
        player["ready"] = False
        room["round_token"] = None
        room["reaction_go_at"] = None
    emit_room_state(room_code)
    socketio.start_background_task(disconnect_cleanup, user["user_id"], room_code, sid)


@socketio.on("create_room")
def on_create_room(data=None):
    user = current_user()
    if not user:
        return emit("room_error", {"message": "authentication_required"})
    game = ensure_game((data or {}).get("game"))
    old_room = find_user_room(user["user_id"])
    if old_room:
        try:
            leave_room(old_room)
        except Exception:
            pass
        notify_player_removed(remove_player_state(user["user_id"], old_room))

    room_code = generate_room_code()
    with state_lock:
        rooms[room_code] = {
            "host_user_id": user["user_id"],
            "game": game,
            "round": 1,
            "round_token": None,
            "reaction_go_at": None,
            "players": {
                user["user_id"]: {
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
        return emit("room_error", {"message": "authentication_required"})
    room_code = str((data or {}).get("room") or "").upper().strip()
    if len(room_code) != 5:
        return emit("room_error", {"message": "invalid_room_code"})

    old_room = find_user_room(user["user_id"])
    if old_room and old_room != room_code:
        try:
            leave_room(old_room)
        except Exception:
            pass
        notify_player_removed(remove_player_state(user["user_id"], old_room))

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return emit("room_error", {"message": "room_not_found"})
        existing = room["players"].get(user["user_id"])
        if existing:
            existing.update({"sid": request.sid, "connected": True, "ready": False, "score": None})
        else:
            if len(room["players"]) >= 2:
                return emit("room_error", {"message": "room_full"})
            room["players"][user["user_id"]] = {
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
    room_code = find_user_room(user["user_id"])
    if not room_code:
        return
    try:
        leave_room(room_code)
    except Exception:
        pass
    notify_player_removed(remove_player_state(user["user_id"], room_code))
    emit("room_left", {"room": room_code})


@socketio.on("player_ready")
def on_player_ready(data=None):
    user = current_user()
    if not user:
        return
    room_code = find_user_room(user["user_id"])
    if not room_code:
        return emit("room_error", {"message": "not_in_room"})
    with state_lock:
        room = rooms.get(room_code)
        player = room["players"].get(user["user_id"]) if room else None
        if not room or not player:
            return
        if len(room["players"]) != 2:
            return emit("room_error", {"message": "waiting_for_opponent"})
        player["ready"] = True
        player["score"] = None
    emit_room_state(room_code)
    start_round_if_possible(room_code)


@socketio.on("reaction_click")
def on_reaction_click(data=None):
    user = current_user()
    if not user:
        return
    room_code = find_user_room(user["user_id"])
    if not room_code:
        return
    token = str((data or {}).get("round_token") or "")
    with state_lock:
        room = rooms.get(room_code)
        if not room or room["game"] != "reaction" or not token or room.get("round_token") != token:
            return
        player = room["players"].get(user["user_id"])
        if not player or player.get("score") is not None:
            return
        go_at = room.get("reaction_go_at")
        if go_at is None:
            player["score"] = 999999.0
            socketio.emit("false_start", {"player": public_player(player)}, to=room_code)
        else:
            player["score"] = round((time.perf_counter() - go_at) * 1000.0, 2)
            socketio.emit("reaction_result", {"player": public_player(player), "milliseconds": player["score"]}, to=room_code)
    finish_round_if_ready(room_code)


@socketio.on("submit_score")
def on_submit_score(data=None):
    user = current_user()
    if not user:
        return
    room_code = find_user_room(user["user_id"])
    if not room_code:
        return
    data = data or {}
    token = str(data.get("round_token") or "")
    try:
        score = float(data.get("score"))
    except (TypeError, ValueError):
        return emit("game_error", {"message": "invalid_score"})
    if not math.isfinite(score) or score < 0 or score > 1_000_000_000:
        return emit("game_error", {"message": "invalid_score"})

    with state_lock:
        room = rooms.get(room_code)
        if not room:
            return
        if room["game"] == "reaction":
            return emit("game_error", {"message": "wrong_score_handler"})
        if not token or room.get("round_token") != token:
            return emit("game_error", {"message": "round_finished"})
        player = room["players"].get(user["user_id"])
        if not player or player.get("score") is not None:
            return
        player["score"] = round(score, 3)
        socketio.emit("score_submitted", {"player": public_player(player), "game": room["game"], "score": player["score"]}, to=room_code)
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
