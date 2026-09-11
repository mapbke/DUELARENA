import os
import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).parent / "data" / "duoarena.db"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB_PATH)))


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _column_names(connection, table):
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def _ensure_match_snapshot_columns(connection):
    columns = _column_names(connection, "game_matches")
    additions = {
        "winner_login": "TEXT",
        "loser_login": "TEXT",
        "winner_avatar_url": "TEXT",
        "loser_avatar_url": "TEXT",
    }

    for name, sql_type in additions.items():
        if name not in columns:
            connection.execute(
                f"ALTER TABLE game_matches ADD COLUMN {name} {sql_type}"
            )


def init_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS github_users (
                github_id INTEGER PRIMARY KEY,
                login TEXT NOT NULL,
                avatar_url TEXT NOT NULL DEFAULT '',
                wins INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS game_matches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game TEXT NOT NULL,
                winner_github_id INTEGER NOT NULL,
                loser_github_id INTEGER NOT NULL,
                winner_login TEXT,
                loser_login TEXT,
                winner_avatar_url TEXT,
                loser_avatar_url TEXT,
                winner_score REAL,
                loser_score REAL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Migrates databases created by the previous DuoArena build.
        _ensure_match_snapshot_columns(connection)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_matches_created
            ON game_matches(created_at DESC)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_matches_winner
            ON game_matches(winner_github_id)
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_matches_loser
            ON game_matches(loser_github_id)
        """)


def upsert_github_user(github_id, login, avatar_url=""):
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO github_users (github_id, login, avatar_url)
            VALUES (?, ?, ?)
            ON CONFLICT(github_id) DO UPDATE SET
                login = excluded.login,
                avatar_url = excluded.avatar_url,
                updated_at = CURRENT_TIMESTAMP
        """, (int(github_id), login, avatar_url))


def get_user_by_github_id(github_id):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT
                github_id,
                login,
                avatar_url,
                wins,
                losses,
                created_at,
                updated_at
            FROM github_users
            WHERE github_id = ?
        """, (int(github_id),)).fetchone()

    return dict(row) if row else None


def record_match(
    game,
    winner_github_id,
    loser_github_id,
    winner_score=None,
    loser_score=None,
    winner_login=None,
    loser_login=None,
    winner_avatar_url=None,
    loser_avatar_url=None,
):
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO game_matches (
                game,
                winner_github_id,
                loser_github_id,
                winner_login,
                loser_login,
                winner_avatar_url,
                loser_avatar_url,
                winner_score,
                loser_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            game,
            int(winner_github_id),
            int(loser_github_id),
            winner_login,
            loser_login,
            winner_avatar_url,
            loser_avatar_url,
            winner_score,
            loser_score,
        ))

        connection.execute("""
            UPDATE github_users
            SET wins = wins + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE github_id = ?
        """, (int(winner_github_id),))

        connection.execute("""
            UPDATE github_users
            SET losses = losses + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE github_id = ?
        """, (int(loser_github_id),))


def get_leaderboard(limit=20):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                github_id,
                login,
                avatar_url,
                wins,
                losses,
                wins + losses AS matches,
                CASE
                    WHEN wins + losses = 0 THEN 0
                    ELSE ROUND((wins * 100.0) / (wins + losses), 1)
                END AS winrate
            FROM github_users
            ORDER BY wins DESC, winrate DESC, login COLLATE NOCASE ASC
            LIMIT ?
        """, (int(limit),)).fetchall()

    return [dict(row) for row in rows]


def get_recent_matches(limit=40):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                m.id,
                m.game,
                m.winner_score,
                m.loser_score,
                m.created_at,
                m.winner_github_id,
                m.loser_github_id,

                COALESCE(
                    winner.login,
                    NULLIF(m.winner_login, ''),
                    'Unknown'
                ) AS winner_login,

                COALESCE(
                    loser.login,
                    NULLIF(m.loser_login, ''),
                    'Unknown'
                ) AS loser_login,

                COALESCE(
                    winner.avatar_url,
                    NULLIF(m.winner_avatar_url, ''),
                    ''
                ) AS winner_avatar_url,

                COALESCE(
                    loser.avatar_url,
                    NULLIF(m.loser_avatar_url, ''),
                    ''
                ) AS loser_avatar_url

            FROM game_matches AS m
            LEFT JOIN github_users AS winner
                ON winner.github_id = m.winner_github_id
            LEFT JOIN github_users AS loser
                ON loser.github_id = m.loser_github_id
            ORDER BY m.id DESC
            LIMIT ?
        """, (int(limit),)).fetchall()

    return [dict(row) for row in rows]


def get_stats_summary():
    with get_connection() as connection:
        players = connection.execute(
            "SELECT COUNT(*) AS count FROM github_users"
        ).fetchone()["count"]

        matches = connection.execute(
            "SELECT COUNT(*) AS count FROM game_matches"
        ).fetchone()["count"]

        top = connection.execute("""
            SELECT login, avatar_url, wins, losses
            FROM github_users
            ORDER BY wins DESC, login COLLATE NOCASE ASC
            LIMIT 1
        """).fetchone()

        mode_rows = connection.execute("""
            SELECT game, COUNT(*) AS count
            FROM game_matches
            GROUP BY game
            ORDER BY count DESC
        """).fetchall()

    return {
        "players": players,
        "matches": matches,
        "top_player": dict(top) if top else None,
        "modes": {row["game"]: row["count"] for row in mode_rows},
    }


if __name__ == "__main__":
    init_database()
    print(f"Database initialized at: {DB_PATH}")
