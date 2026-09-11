import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.getenv("DATABASE_PATH", str(Path(__file__).parent / "data" / "duoarena.db")))


def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    return conn


def init_database():
    with connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                provider_subject TEXT NOT NULL,
                login TEXT NOT NULL,
                display_name TEXT NOT NULL,
                avatar_url TEXT NOT NULL DEFAULT '',
                email TEXT NOT NULL DEFAULT '',
                is_guest INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, provider_subject)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game TEXT NOT NULL,
                winner_user_id TEXT NOT NULL,
                loser_user_id TEXT NOT NULL,
                winner_name TEXT NOT NULL,
                loser_name TEXT NOT NULL,
                winner_avatar_url TEXT NOT NULL DEFAULT '',
                loser_avatar_url TEXT NOT NULL DEFAULT '',
                winner_provider TEXT NOT NULL DEFAULT '',
                loser_provider TEXT NOT NULL DEFAULT '',
                winner_score REAL,
                loser_score REAL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


def upsert_user(user_id, provider, provider_subject, login, display_name, avatar_url="", email="", is_guest=False):
    with connection() as conn:
        if conn.execute("SELECT 1 FROM users WHERE user_id=?", (user_id,)).fetchone():
            conn.execute("""
                UPDATE users SET
                    provider=?, provider_subject=?, login=?, display_name=?,
                    avatar_url=?, email=?, is_guest=?, updated_at=CURRENT_TIMESTAMP
                WHERE user_id=?
            """, (provider, provider_subject, login, display_name, avatar_url or "", email or "", int(bool(is_guest)), user_id))
        else:
            conn.execute("""
                INSERT INTO users (
                    user_id, provider, provider_subject, login, display_name,
                    avatar_url, email, is_guest
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, provider, provider_subject, login, display_name, avatar_url or "", email or "", int(bool(is_guest))))


def get_user(user_id):
    with connection() as conn:
        row = conn.execute("""
            SELECT user_id, provider, display_name, avatar_url, wins, losses,
                   wins + losses AS matches,
                   CASE WHEN wins + losses = 0 THEN 0
                        ELSE ROUND(wins * 100.0 / (wins + losses), 1) END AS winrate
            FROM users WHERE user_id=?
        """, (user_id,)).fetchone()
    return dict(row) if row else None


def record_match(game, winner_user_id, loser_user_id, winner_name, loser_name,
                 winner_avatar_url="", loser_avatar_url="", winner_provider="",
                 loser_provider="", winner_score=None, loser_score=None):
    with connection() as conn:
        conn.execute("""
            INSERT INTO matches (
                game, winner_user_id, loser_user_id, winner_name, loser_name,
                winner_avatar_url, loser_avatar_url, winner_provider, loser_provider,
                winner_score, loser_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            game, winner_user_id, loser_user_id, winner_name, loser_name,
            winner_avatar_url or "", loser_avatar_url or "", winner_provider or "",
            loser_provider or "", winner_score, loser_score
        ))
        conn.execute("UPDATE users SET wins=wins+1 WHERE user_id=?", (winner_user_id,))
        conn.execute("UPDATE users SET losses=losses+1 WHERE user_id=?", (loser_user_id,))


def get_leaderboard(limit=25):
    with connection() as conn:
        rows = conn.execute("""
            SELECT user_id, provider, display_name, avatar_url, wins, losses,
                   wins + losses AS matches,
                   CASE WHEN wins + losses = 0 THEN 0
                        ELSE ROUND(wins * 100.0 / (wins + losses), 1) END AS winrate
            FROM users
            WHERE wins + losses > 0
            ORDER BY wins DESC, winrate DESC, display_name COLLATE NOCASE
            LIMIT ?
        """, (int(limit),)).fetchall()
    return [dict(row) for row in rows]


def get_recent_matches(limit=50):
    with connection() as conn:
        rows = conn.execute("SELECT * FROM matches ORDER BY id DESC LIMIT ?", (int(limit),)).fetchall()
    return [dict(row) for row in rows]


def get_stats_summary():
    with connection() as conn:
        players = conn.execute("SELECT COUNT(*) AS c FROM users WHERE wins + losses > 0").fetchone()["c"]
        matches = conn.execute("SELECT COUNT(*) AS c FROM matches").fetchone()["c"]
        top = conn.execute("""
            SELECT display_name, avatar_url, provider, wins, losses
            FROM users WHERE wins + losses > 0
            ORDER BY wins DESC, display_name COLLATE NOCASE
            LIMIT 1
        """).fetchone()

    return {
        "players": players,
        "matches": matches,
        "top_player": dict(top) if top else None,
    }
