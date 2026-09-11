import os
import sqlite3
from pathlib import Path


DEFAULT_DB_PATH = Path(__file__).parent / "data" / "duoarena.db"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB_PATH)))


def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


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
                winner_github_id INTEGER,
                loser_github_id INTEGER,
                winner_score REAL,
                loser_score REAL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (winner_github_id) REFERENCES github_users(github_id),
                FOREIGN KEY (loser_github_id) REFERENCES github_users(github_id)
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_game_matches_created
            ON game_matches(created_at DESC)
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
):
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO game_matches (
                game,
                winner_github_id,
                loser_github_id,
                winner_score,
                loser_score
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            game,
            int(winner_github_id),
            int(loser_github_id),
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
                CASE
                    WHEN wins + losses = 0 THEN 0
                    ELSE ROUND((wins * 100.0) / (wins + losses), 1)
                END AS winrate
            FROM github_users
            ORDER BY wins DESC, winrate DESC, login COLLATE NOCASE ASC
            LIMIT ?
        """, (int(limit),)).fetchall()

    return [dict(row) for row in rows]


def get_recent_matches(limit=30):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT
                m.id,
                m.game,
                m.winner_score,
                m.loser_score,
                m.created_at,
                winner.github_id AS winner_github_id,
                winner.login AS winner_login,
                winner.avatar_url AS winner_avatar_url,
                loser.github_id AS loser_github_id,
                loser.login AS loser_login,
                loser.avatar_url AS loser_avatar_url
            FROM game_matches AS m
            LEFT JOIN github_users AS winner
                ON winner.github_id = m.winner_github_id
            LEFT JOIN github_users AS loser
                ON loser.github_id = m.loser_github_id
            ORDER BY m.id DESC
            LIMIT ?
        """, (int(limit),)).fetchall()

    return [dict(row) for row in rows]


if __name__ == "__main__":
    init_database()
    print(f"Database initialized: {DB_PATH}")
