import math
import os
import random
import re
import secrets
import threading
import time
import uuid
from functools import wraps
from collections import defaultdict, deque
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
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)
if BASE_URL.startswith("https://") and not os.getenv("SECRET_KEY"):
    raise RuntimeError("Set a stable SECRET_KEY for production")
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

ROUND_COUNTDOWN = float(os.getenv("ROUND_COUNTDOWN", "2.5"))
RECONNECT_GRACE = float(os.getenv("RECONNECT_GRACE", "60"))
ROOM_TTL = float(os.getenv("ROOM_TTL", "7200"))

app = Flask(__name__)
app.config.update(
    SECRET_KEY=SECRET_KEY,
    MAX_CONTENT_LENGTH=16384,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=BASE_URL.startswith("https://"),
    PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 30,
)

socketio = SocketIO(
    app,
    cors_allowed_origins=[
        BASE_URL,
        "http://127.0.0.1:5000",
        "http://localhost:5000",
    ],
    async_mode="threading",
    max_http_buffer_size=16384,
)

init_database()

LOCK = threading.RLock()
ROOMS = {}
RATE_BUCKETS = defaultdict(deque)

RULE = {
    "reaction": "min",
    "typing": "max",
    "cps": "max",
    "aim": "max",
    "blind": "min",
}

MODE_ROUTE = {
    "reaction": "reaction",
    "typing": "typing",
    "cps": "cps",
    "aim": "aim",
    "blind": "blind",
}

MODE_NAME = {
    "reaction": "Reaction Duel",
    "typing": "Typing Duel",
    "cps": "CPS Battle",
    "aim": "Aim Duel",
    "blind": "Blind Timing",
}

TIMEOUT = {
    "reaction": 10.0,
    "typing": 90.0,
    "cps": 10.0,
    "aim": 45.0,
    "blind": 12.0,
}

PHRASES = {
    "en": [
        "Good players move fast, but great players stay accurate when the pressure starts to rise.",
        "A clean run is not about rushing every key. It is about keeping a steady rhythm from start to finish.",
        "Speed feels impressive, but consistency wins more rounds than one lucky burst ever will.",
        "Pressure changes everything, so real skill means staying calm when the score is close.",
        "Fast reactions help, but timing and control turn a good attempt into a winning one.",
        "A small mistake is not the end of the round. Recover quickly and keep the pace under control.",
    ],
    "ru": [
        "Хороший игрок действует быстро, а сильный сохраняет точность даже когда давление начинает расти.",
        "Чистый раунд строится не на спешке, а на ровном темпе от первого символа до последнего.",
        "Скорость выглядит эффектно, но стабильность выигрывает больше раундов, чем один случайный рывок.",
        "Под давлением всё ощущается иначе, поэтому настоящий навык — сохранять спокойствие при близком счёте.",
        "Быстрая реакция помогает, но именно контроль и тайминг превращают хороший результат в победный.",
        "Одна ошибка не заканчивает раунд. Быстро восстанови ритм и продолжай держать темп.",
    ],
}

GUEST_RE = re.compile(r"[^A-Za-zА-Яа-яЁё0-9 _.\-]+")


# ---------------- auth ----------------

def normalize_user(raw):
    if not raw:
        return None

    if "user_id" not in raw and "github_id" in raw:
        subject = str(raw["github_id"])
        login = str(raw.get("login") or f"github-{subject}")
        return {
            "user_id": f"github:{subject}",
            "provider": "github",
            "provider_subject": subject,
            "login": login,
            "display_name": login,
            "avatar_url": str(raw.get("avatar_url") or ""),
            "email": "",
            "is_guest": False,
        }

    if "user_id" not in raw:
        return None

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


def persist_user(user):
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
    user = normalize_user(session.get("user"))
    if not user:
        return None

    if not hasattr(request, "sid"):
        try:
            persist_user(user)
        except Exception:
            app.logger.exception("Failed to persist user")

    session["user"] = user
    return user


def safe_next(value):
    if not value or not value.startswith("/") or value.startswith("//") or "\\" in value or any(ord(c) < 32 for c in value):
        return "/"
    return value


def login_required(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not current_user():
            return redirect(url_for("login", next=request.full_path.rstrip("?")))
        return view(*args, **kwargs)
    return wrapper


def provider_label(provider):
    return {"github": "GitHub", "google": "Google", "guest": "Guest"}.get(provider, provider.title())


def set_user(user, destination="/"):
    persist_user(user)
    session.clear()
    session["user"] = user
    session.permanent = True
    return redirect(safe_next(destination))


# ---------------- room helpers ----------------

def ensure_mode(value):
    value = str(value or "reaction").lower()
    return value if value in RULE else "reaction"


def new_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(5))
        with LOCK:
            if code not in ROOMS:
                return code


def public_player(player):
    return {
        "user_id": player["user_id"],
        "provider": player["provider"],
        "display_name": player["display_name"],
        "avatar_url": player.get("avatar_url", ""),
        "connected": bool(player.get("connected")),
        "ready": bool(player.get("ready")),
        "series_wins": int(player.get("series_wins", 0)),
        "done": bool(player.get("done")),
        "public_meta": dict(player.get("public_meta") or {}),
    }


def public_room(code):
    with LOCK:
        room = ROOMS.get(code)
        if not room:
            return None

        return {
            "room": code,
            "mode": room["mode"],
            "mode_name": MODE_NAME[room["mode"]],
            "state": room["state"],
            "round": room["round"],
            "notice": room.get("notice"),
            "last_result": room.get("last_result") if room["state"] == "finished" else None,
            "invite_url": f"{BASE_URL}/r/{code}",
            "players": [public_player(p) for p in room["players"].values()],
        }


def emit_room(code):
    data = public_room(code)
    if data:
        socketio.emit("room_state", data, to=code)


def find_room(user_id):
    with LOCK:
        for code, room in ROOMS.items():
            if user_id in room["players"]:
                return code
    return None


def reset_round(room):
    room["state"] = "lobby"
    room["token"] = None
    room["started_at"] = None
    room["go_at"] = None
    room["game_data"] = {}
    room["last_result"] = None

    for p in room["players"].values():
        p["ready"] = False
        p["score"] = None
        p["done"] = False
        p["meta"] = {}
        p["public_meta"] = {}
        p["clicks"] = 0
        p["aim_index"] = 0


def remove_player(user_id, code=None):
    with LOCK:
        code = code or find_room(user_id)
        if not code:
            return None

        room = ROOMS.get(code)
        if not room or user_id not in room["players"]:
            return None

        removed = room["players"].pop(user_id)

        if not room["players"]:
            ROOMS.pop(code, None)
            return {"room": code, "removed": removed, "deleted": True}

        reset_round(room)
        room["notice"] = "opponent_left"
        app.logger.info("player_left room=%s", code)
        return {"room": code, "removed": removed, "deleted": False}


def notify_removed(result):
    if not result or result["deleted"]:
        return

    socketio.emit(
        "player_left",
        {
            "user_id": result["removed"]["user_id"],
            "display_name": result["removed"]["display_name"],
        },
        to=result["room"],
    )
    emit_room(result["room"])


def both_ready(room):
    players = list(room["players"].values())
    return len(players) == 2 and all(p["connected"] and p["ready"] for p in players)


def all_done(room):
    players = list(room["players"].values())
    return len(players) == 2 and all(p["done"] for p in players)


def valid_round(room, token, mode=None):
    return bool(
        room
        and room["state"] == "playing"
        and room["token"] == token
        and (not mode or room["mode"] == mode)
    )


def reconnect_cleanup(user_id, code, sid):
    socketio.sleep(RECONNECT_GRACE)

    with LOCK:
        room = ROOMS.get(code)
        player = room["players"].get(user_id) if room else None
        remove = bool(
            player
            and player.get("sid") == sid
            and not player.get("connected")
        )

        if remove:
            notify_removed(remove_player(user_id, code))


def expire_rooms():
    now = time.monotonic()
    with LOCK:
        for code, room in list(ROOMS.items()):
            if now - room.get("created_at", now) >= ROOM_TTL:
                socketio.emit("room_expired", {"room": code}, to=code)
                socketio.close_room(code)
                del ROOMS[code]
                app.logger.info("room_closed reason=expired room=%s", code)
        for key, times in list(RATE_BUCKETS.items()):
            if not times or times[-1] < now - 60:
                del RATE_BUCKETS[key]


def room_sweeper():
    while True:
        socketio.sleep(30)
        expire_rooms()


def socket_guard(action, member=False):
    """Serialize state mutations and authorize the currently attached socket."""
    def decorate(fn):
        @wraps(fn)
        def guarded(data=None):
            with LOCK:
                user = normalize_user(session.get("user"))
                if not user:
                    return emit("room_error", {"code": "authentication_required"})
                if data is not None and not isinstance(data, dict):
                    return emit("room_error", {"code": "invalid_payload"})
                if member:
                    code = find_room(user["user_id"])
                    room = ROOMS.get(code)
                    player = room["players"].get(user["user_id"]) if room else None
                    if not player or not player["connected"] or player["sid"] != request.sid:
                        return emit("room_error", {"code": "not_in_room"})
                if action in {"create", "join"}:
                    expire_rooms()
                    now = time.monotonic()
                    key = (request.remote_addr, action)
                    times = RATE_BUCKETS[key]
                    while times and times[0] < now - 60:
                        times.popleft()
                    if len(times) >= (20 if action == "create" else 60):
                        return emit("room_error", {"code": "rate_limited"})
                    times.append(now)
                try:
                    return fn(data)
                except (TypeError, ValueError, OverflowError):
                    return emit("room_error", {"code": "invalid_payload"})
        return guarded
    return decorate


# ---------------- round engine ----------------

def prepare_round(code):
    with LOCK:
        room = ROOMS.get(code)
        if not room or room["state"] not in {"lobby", "finished"} or not both_ready(room):
            return

        room["notice"] = None
        room["last_result"] = None
        room["state"] = "countdown"
        room["round"] += 1
        room["token"] = secrets.token_urlsafe(18)
        room["started_at"] = None
        room["go_at"] = None
        room["game_data"] = {}

        for p in room["players"].values():
            p["score"] = None
            p["done"] = False
            p["meta"] = {}
            p["public_meta"] = {}
            p["clicks"] = 0
            p["aim_index"] = 0

        token = room["token"]
        mode = room["mode"]
        round_number = room["round"]

    socketio.emit(
        "round_countdown",
        {
            "room": code,
            "mode": mode,
            "round": round_number,
            "token": token,
            "seconds": ROUND_COUNTDOWN,
        },
        to=code,
    )
    emit_room(code)
    socketio.start_background_task(begin_round, code, token)


def begin_round(code, token):
    socketio.sleep(ROUND_COUNTDOWN)

    with LOCK:
        room = ROOMS.get(code)
        if not room or room["token"] != token or room["state"] != "countdown":
            return

        if not both_ready(room):
            reset_round(room)
            emit_room(code)
            return

        room["state"] = "playing"
        room["started_at"] = time.perf_counter()

        mode = room["mode"]
        payload = {
            "room": code,
            "mode": mode,
            "round": room["round"],
            "token": token,
        }

        if mode == "typing":
            phrase = random.choice(PHRASES.get(room["language"], PHRASES["en"]))
            room["game_data"]["phrase"] = phrase
            payload.update({"phrase": phrase, "timeout": TIMEOUT[mode]})

        elif mode == "cps":
            payload["duration"] = TIMEOUT[mode]

        elif mode == "aim":
            targets = [
                {
                    "x": round(random.uniform(.08, .92), 4),
                    "y": round(random.uniform(.10, .90), 4),
                }
                for _ in range(15)
            ]
            room["game_data"]["targets"] = targets
            payload.update({"targets": targets, "timeout": TIMEOUT[mode]})

        elif mode == "blind":
            room["game_data"]["target"] = 5.0
            payload.update({"target_seconds": 5.0, "timeout": TIMEOUT[mode]})

        else:
            payload["timeout"] = TIMEOUT[mode]

    socketio.emit("round_start", payload, to=code)
    emit_room(code)

    if mode == "reaction":
        socketio.start_background_task(reaction_go_task, code, token)
    elif mode == "cps":
        socketio.start_background_task(cps_end_task, code, token)
    else:
        socketio.start_background_task(timeout_task, code, token, TIMEOUT[mode])


def reaction_go_task(code, token):
    socketio.sleep(random.uniform(1.5, 4.2))

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "reaction"):
            return
        room["go_at"] = time.perf_counter()

    socketio.emit("reaction_go", {"token": token}, to=code)
    socketio.start_background_task(timeout_task, code, token, 8.0)


def timeout_task(code, token, seconds):
    socketio.sleep(seconds)

    with LOCK:
        room = ROOMS.get(code)
        if not room or room["token"] != token or room["state"] != "playing":
            return

        mode = room["mode"]

        for p in room["players"].values():
            if p["done"]:
                continue

            p["done"] = True
            p["meta"] = {"timeout": True}
            p["public_meta"] = {"timeout": True}
            p["score"] = 999999.0 if mode in {"reaction", "blind"} else 0.0

    finalize(code, token)


def cps_end_task(code, token):
    socketio.sleep(TIMEOUT["cps"])

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "cps"):
            return

        for p in room["players"].values():
            p["done"] = True
            p["score"] = float(p["clicks"])
            p["meta"] = {"clicks": p["clicks"]}
            p["public_meta"] = {"clicks": p["clicks"]}

    finalize(code, token)


def finalize(code, token):
    match = None

    with LOCK:
        room = ROOMS.get(code)
        if not room or room["token"] != token or room["state"] != "playing" or not all_done(room):
            return

        a, b = list(room["players"].values())
        rule = RULE[room["mode"]]

        if a["score"] == b["score"]:
            winner = loser = None
        elif rule == "min":
            winner, loser = (a, b) if a["score"] < b["score"] else (b, a)
        else:
            winner, loser = (a, b) if a["score"] > b["score"] else (b, a)

        if winner:
            winner["series_wins"] += 1

        result = {
            "room": code,
            "mode": room["mode"],
            "round": room["round"],
            "draw": winner is None,
            "winner": public_player(winner) if winner else None,
            "players": [
                {
                    **public_player(p),
                    "score": p["score"],
                    "meta": dict(p["meta"]),
                }
                for p in (a, b)
            ],
        }

        if winner and loser:
            match = {
                "game": room["mode"],
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

        room["state"] = "finished"
        room["last_result"] = result
        app.logger.info("round_finished room=%s round=%s", code, room["round"])

        for p in room["players"].values():
            p["ready"] = False

    if match:
        try:
            record_match(**match)
        except Exception:
            app.logger.exception("Failed to save match")

    socketio.emit("round_result", result, to=code)
    emit_room(code)


# ---------------- pages ----------------

@app.get("/")
@login_required
def index():
    user = current_user()
    return render_template(
        "index.html",
        user=user,
        profile=get_user(user["user_id"]),
        provider_name=provider_label(user["provider"]),
    )


@app.get("/login")
def login():
    user = current_user()
    if user:
        return redirect(safe_next(request.args.get("next")))

    return render_template(
        "login.html",
        user=None,
        next_path=safe_next(request.args.get("next")),
        github_enabled=bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET),
        google_enabled=bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
    )


def render_game(template):
    user = current_user()
    return render_template(
        template,
        user=user,
        provider_name=provider_label(user["provider"]),
    )


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
    return render_template(
        "stats.html",
        user=user,
        provider_name=provider_label(user["provider"]),
    )


@app.get("/r/<code>")
@login_required
def invite(code):
    code = code.upper().strip()

    with LOCK:
        room = ROOMS.get(code)
        mode = room["mode"] if room else None

    if not mode:
        user = current_user()
        return render_template(
            "invite_missing.html",
            user=user,
            provider_name=provider_label(user["provider"]),
            room_code=code,
        ), 404

    return render_game(f"{mode}.html")


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "duoarena", "version": "6"})


# ---------------- auth routes ----------------

@app.post("/login/guest")
def login_guest():
    name = GUEST_RE.sub("", str(request.form.get("display_name") or "")).strip()[:20]
    if not name:
        name = f"Guest-{secrets.token_hex(2).upper()}"

    subject = str(uuid.uuid4())

    return set_user(
        {
            "user_id": f"guest:{subject}",
            "provider": "guest",
            "provider_subject": subject,
            "login": name,
            "display_name": name,
            "avatar_url": "",
            "email": "",
            "is_guest": True,
        },
        request.form.get("next") or "/",
    )


@app.get("/login/github")
def login_github():
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        return "GitHub OAuth is not configured", 503

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_provider"] = "github"
    session["oauth_next"] = safe_next(request.args.get("next"))

    return redirect(
        "https://github.com/login/oauth/authorize?"
        + urlencode({
            "client_id": GITHUB_CLIENT_ID,
            "redirect_uri": f"{BASE_URL}/auth/github/callback",
            "scope": "read:user user:email",
            "state": state,
        })
    )


@app.get("/auth/github/callback")
def github_callback():
    if (
        session.get("oauth_provider") != "github"
        or request.args.get("state") != session.get("oauth_state")
        or not request.args.get("code")
    ):
        return "Invalid GitHub OAuth state", 400

    destination = safe_next(session.get("oauth_next"))

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
    token = token_response.json().get("access_token")

    profile = requests.get(
        "https://api.github.com/user",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=15,
    )
    profile.raise_for_status()
    gh = profile.json()

    subject = str(gh["id"])
    login_name = str(gh["login"])

    return set_user(
        {
            "user_id": f"github:{subject}",
            "provider": "github",
            "provider_subject": subject,
            "login": login_name,
            "display_name": str(gh.get("name") or login_name),
            "avatar_url": str(gh.get("avatar_url") or ""),
            "email": str(gh.get("email") or ""),
            "is_guest": False,
        },
        destination,
    )


@app.get("/login/google")
def login_google():
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        return "Google OAuth is not configured", 503

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_provider"] = "google"
    session["oauth_next"] = safe_next(request.args.get("next"))

    return redirect(
        "https://accounts.google.com/o/oauth2/v2/auth?"
        + urlencode({
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": f"{BASE_URL}/auth/google/callback",
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        })
    )


@app.get("/auth/google/callback")
def google_callback():
    if (
        session.get("oauth_provider") != "google"
        or request.args.get("state") != session.get("oauth_state")
        or not request.args.get("code")
    ):
        return "Invalid Google OAuth state", 400

    destination = safe_next(session.get("oauth_next"))

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
    token = token_response.json().get("access_token")

    profile = requests.get(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    profile.raise_for_status()
    data = profile.json()

    subject = str(data["sub"])
    display_name = str(
        data.get("name")
        or data.get("given_name")
        or data.get("email", "Player").split("@")[0]
    )

    return set_user(
        {
            "user_id": f"google:{subject}",
            "provider": "google",
            "provider_subject": subject,
            "login": str(data.get("email") or display_name),
            "display_name": display_name,
            "avatar_url": str(data.get("picture") or ""),
            "email": str(data.get("email") or ""),
            "is_guest": False,
        },
        destination,
    )


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------------- API ----------------

@app.get("/api/me")
def api_me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False, "user": None}), 401

    return jsonify({
        "authenticated": True,
        "user": get_user(user["user_id"]) or user,
    })


@app.get("/api/stats")
def api_stats():
    return jsonify({
        "ok": True,
        "summary": get_stats_summary(),
        "leaderboard": get_leaderboard(25),
        "recent_matches": get_recent_matches(50),
    })


# ---------------- socket ----------------

@socketio.on("connect")
def on_connect(auth=None):
    user = current_user()
    if not user:
        return False

    emit("auth_user", {
        "user_id": user["user_id"],
        "provider": user["provider"],
        "display_name": user["display_name"],
        "avatar_url": user["avatar_url"],
    })


@socketio.on("disconnect")
def on_disconnect(reason=None):
    user = current_user()
    if not user:
        return

    code = find_room(user["user_id"])
    if not code:
        return

    sid = request.sid

    with LOCK:
        room = ROOMS.get(code)
        player = room["players"].get(user["user_id"]) if room else None

        if not player or player.get("sid") != sid:
            return

        player["connected"] = False
        player["ready"] = False
        if room["state"] in {"playing", "countdown"}:
            reset_round(room)
            room["notice"] = "round_interrupted"
        app.logger.info("player_disconnected room=%s", code)

    emit_room(code)
    socketio.start_background_task(reconnect_cleanup, user["user_id"], code, sid)


@socketio.on("room_create")
@socket_guard("create", member=False)
def on_room_create(data=None):
    user = current_user()
    if not user:
        return emit("room_error", {"code": "authentication_required"})

    data = data or {}
    if data.get("mode") not in RULE:
        return emit("room_error", {"code": "invalid_payload"})
    mode = data["mode"]
    language = "ru" if data.get("language") == "ru" else "en"

    old = find_room(user["user_id"])
    if old:
        try:
            leave_room(old)
        except Exception:
            pass
        notify_removed(remove_player(user["user_id"], old))

    code = new_code()

    with LOCK:
        ROOMS[code] = {
            "created_at": time.monotonic(),
            "mode": mode,
            "language": language,
            "state": "lobby",
            "round": 0,
            "token": None,
            "started_at": None,
            "go_at": None,
            "game_data": {},
            "players": {
                user["user_id"]: {
                    **user,
                    "sid": request.sid,
                    "connected": True,
                    "ready": False,
                    "series_wins": 0,
                    "score": None,
                    "done": False,
                    "meta": {},
                    "public_meta": {},
                    "clicks": 0,
                    "aim_index": 0,
                }
            },
        }

    join_room(code)
    app.logger.info("room_created room=%s mode=%s", code, mode)
    emit("room_created", {"room": code, "invite_url": f"{BASE_URL}/r/{code}"})
    emit_room(code)


@socketio.on("room_join")
@socket_guard("join", member=False)
def on_room_join(data=None):
    user = current_user()
    if not user:
        return emit("room_error", {"code": "authentication_required"})

    code = str((data or {}).get("room") or "").upper().strip()

    if not re.fullmatch(r"[A-HJ-NP-Z2-9]{5}", code):
        return emit("room_error", {"code": "invalid_room_code"})

    with LOCK:
        room = ROOMS.get(code)

        if not room:
            return emit("room_error", {"code": "room_not_found"})

        if room["state"] in {"countdown", "playing"} and user["user_id"] not in room["players"]:
            return emit("room_error", {"code": "round_in_progress"})

        if user["user_id"] not in room["players"] and len(room["players"]) >= 2:
            return emit("room_error", {"code": "room_full"})

        old = find_room(user["user_id"])
        if old and old != code:
            try:
                leave_room(old)
            except Exception:
                pass
            notify_removed(remove_player(user["user_id"], old))

        player = room["players"].get(user["user_id"])

        if player:
            if player["sid"] != request.sid:
                socketio.server.leave_room(player["sid"], code, namespace="/")
                if room["state"] in {"playing", "countdown"}:
                    reset_round(room)
                    room["notice"] = "round_interrupted"
            player["sid"] = request.sid
            player["connected"] = True
            app.logger.info("player_reconnected room=%s", code)
        else:
            if len(room["players"]) >= 2:
                return emit("room_error", {"code": "room_full"})

            room["players"][user["user_id"]] = {
                **user,
                "sid": request.sid,
                "connected": True,
                "ready": False,
                "series_wins": 0,
                "score": None,
                "done": False,
                "meta": {},
                "public_meta": {},
                "clicks": 0,
                "aim_index": 0,
            }

        mode = room["mode"]

    join_room(code)
    emit("room_joined", {
        "room": code,
        "mode": mode,
        "redirect_url": url_for("invite", code=code),
    })
    emit_room(code)


@socketio.on("room_leave")
@socket_guard("leave", member=True)
def on_room_leave(data=None):
    user = current_user()
    if not user:
        return

    code = find_room(user["user_id"])
    if not code:
        return

    try:
        leave_room(code)
    except Exception:
        pass

    notify_removed(remove_player(user["user_id"], code))
    emit("room_left", {"room": code})


@socketio.on("room_ready")
@socket_guard("ready", member=True)
def on_room_ready(data=None):
    user = current_user()
    if not user:
        return

    code = find_room(user["user_id"])
    if not code:
        return emit("room_error", {"code": "not_in_room"})

    with LOCK:
        room = ROOMS.get(code)
        player = room["players"].get(user["user_id"]) if room else None

        if not room or not player:
            return

        if len(room["players"]) != 2:
            return emit("room_error", {"code": "waiting_for_opponent"})

        if room["state"] not in {"lobby", "finished"}:
            return emit("room_error", {"code": "round_in_progress"})

        player["ready"] = True

    emit_room(code)
    prepare_round(code)


@socketio.on("reaction_click")
@socket_guard("reaction", member=True)
def on_reaction_click(data=None):
    user = current_user()
    code = find_room(user["user_id"]) if user else None
    if not code:
        return

    token = str((data or {}).get("token") or "")

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "reaction"):
            return

        p = room["players"].get(user["user_id"])
        if not p or p["done"]:
            return

        if room["go_at"] is None:
            p["score"] = 999999.0
            p["meta"] = {"false_start": True}
            p["public_meta"] = {"false_start": True}
        else:
            p["score"] = round((time.perf_counter() - room["go_at"]) * 1000.0, 2)
            p["meta"] = {"milliseconds": p["score"]}
            p["public_meta"] = {"milliseconds": p["score"]}

        p["done"] = True

        result = {
            "user_id": p["user_id"],
            "display_name": p["display_name"],
            "score": p["score"],
            "false_start": bool(p["meta"].get("false_start")),
        }

    socketio.emit("reaction_player_result", result, to=code)
    emit_room(code)
    finalize(code, token)


@socketio.on("typing_progress")
@socket_guard("typing", member=True)
def on_typing_progress(data=None):
    user = current_user()
    code = find_room(user["user_id"]) if user else None
    if not code:
        return

    data = data or {}
    token = str(data.get("token") or "")

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "typing"):
            return

        phrase = room["game_data"].get("phrase", "")
        chars = max(0, min(int(data.get("chars") or 0), len(phrase)))
        progress = round(chars / max(len(phrase), 1) * 100.0, 1)

        p = room["players"].get(user["user_id"])
        if not p:
            return

        p["public_meta"]["progress"] = progress

    socketio.emit("typing_progress", {"user_id": user["user_id"], "progress": progress}, to=code)


@socketio.on("typing_finish")
@socket_guard("typing", member=True)
def on_typing_finish(data=None):
    user = current_user()
    code = find_room(user["user_id"]) if user else None
    if not code:
        return

    data = data or {}
    token = str(data.get("token") or "")
    text = str(data.get("text") or "")

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "typing"):
            return

        p = room["players"].get(user["user_id"])
        if not p or p["done"]:
            return

        phrase = room["game_data"].get("phrase", "")
        if len(text) != len(phrase) or time.perf_counter() - room["started_at"] > TIMEOUT["typing"]:
            return emit("room_error", {"code": "invalid_payload"})
        typed = text[:len(phrase)]
        elapsed = max(.1, time.perf_counter() - room["started_at"])

        correct = sum(
            1 for i, ch in enumerate(typed)
            if i < len(phrase) and ch == phrase[i]
        )
        accuracy = correct / max(len(phrase), 1) * 100.0
        raw_wpm = (len(typed) / 5.0) / (elapsed / 60.0)
        score = raw_wpm * (accuracy / 100.0)

        p["score"] = round(score, 2)
        p["done"] = True
        p["meta"] = {
            "wpm": round(raw_wpm, 2),
            "accuracy": round(accuracy, 1),
            "seconds": round(elapsed, 2),
        }
        p["public_meta"] = {
            "progress": 100.0,
            "wpm": round(raw_wpm, 1),
            "accuracy": round(accuracy, 1),
        }

        result = {
            "user_id": p["user_id"],
            "display_name": p["display_name"],
            "score": p["score"],
            "meta": p["meta"],
        }

    socketio.emit("typing_player_result", result, to=code)
    emit_room(code)
    finalize(code, token)


@socketio.on("cps_click")
@socket_guard("cps", member=True)
def on_cps_click(data=None):
    user = current_user()
    code = find_room(user["user_id"]) if user else None
    if not code:
        return

    token = str((data or {}).get("token") or "")

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "cps"):
            return

        if time.perf_counter() - room["started_at"] > TIMEOUT["cps"]:
            return

        p = room["players"].get(user["user_id"])
        if not p or p["done"]:
            return

        p["clicks"] += 1


@socketio.on("aim_hit")
@socket_guard("aim", member=True)
def on_aim_hit(data=None):
    user = current_user()
    code = find_room(user["user_id"]) if user else None
    if not code:
        return

    data = data or {}
    token = str(data.get("token") or "")
    index = int(data.get("index") or 0)

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "aim"):
            return

        p = room["players"].get(user["user_id"])
        targets = room["game_data"].get("targets", [])

        if time.perf_counter() - room["started_at"] > TIMEOUT["aim"]:
            return
        if not p or p["done"] or index != p["aim_index"] or index >= len(targets):
            return

        p["aim_index"] += 1
        hits = p["aim_index"]
        p["public_meta"] = {"hits": hits, "total": len(targets)}

        if hits >= len(targets):
            elapsed = max(.1, time.perf_counter() - room["started_at"])
            pace = len(targets) / elapsed
            p["score"] = round(pace, 3)
            p["done"] = True
            p["meta"] = {
                "hits": hits,
                "seconds": round(elapsed, 3),
                "pace": round(pace, 3),
            }

        done = p["done"]

    socketio.emit("aim_progress", {"user_id": user["user_id"], "hits": hits, "total": len(targets)}, to=code)
    emit_room(code)

    if done:
        finalize(code, token)


@socketio.on("blind_stop")
@socket_guard("blind", member=True)
def on_blind_stop(data=None):
    user = current_user()
    code = find_room(user["user_id"]) if user else None
    if not code:
        return

    token = str((data or {}).get("token") or "")

    with LOCK:
        room = ROOMS.get(code)
        if not valid_round(room, token, "blind"):
            return

        p = room["players"].get(user["user_id"])
        if not p or p["done"]:
            return

        elapsed = max(0, time.perf_counter() - room["started_at"])
        error_ms = abs(elapsed - 5.0) * 1000.0

        p["score"] = round(error_ms, 2)
        p["done"] = True
        p["meta"] = {
            "seconds": round(elapsed, 3),
            "error_ms": round(error_ms, 2),
        }
        p["public_meta"] = {"stopped": True}

        result = {
            "user_id": p["user_id"],
            "display_name": p["display_name"],
            "score": p["score"],
            "meta": p["meta"],
        }

    socketio.emit("blind_player_result", result, to=code)
    emit_room(code)
    finalize(code, token)


socketio.start_background_task(room_sweeper)

if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
        allow_unsafe_werkzeug=True,
    )
