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


def _table_exists(connection, table):
    row = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return bool(row)


def init_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users_v4 (
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

        connection.execute("""
            CREATE TABLE IF NOT EXISTS matches_v4 (
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

        connection.execute("CREATE INDEX IF NOT EXISTS idx_matches_v4_created ON matches_v4(created_at DESC)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_matches_v4_winner ON matches_v4(winner_user_id)")
        connection.execute("CREATE INDEX IF NOT EXISTS idx_matches_v4_loser ON matches_v4(loser_user_id)")

        # Migrate old GitHub-only users if present.
        if _table_exists(connection, "github_users"):
            rows = connection.execute(
                "SELECT github_id, login, avatar_url, wins, losses FROM github_users"
            ).fetchall()
            for row in rows:
                gid = str(row["github_id"])
                connection.execute("""
                    INSERT INTO users_v4 (
                        user_id, provider, provider_subject, login, display_name,
                        avatar_url, email, is_guest, wins, losses
                    ) VALUES (?, 'github', ?, ?, ?, ?, '', 0, ?, ?)
                    ON CONFLICT(user_id) DO NOTHING
                """, (
                    f"github:{gid}", gid, row["login"], row["login"],
                    row["avatar_url"] or "", row["wins"] or 0, row["losses"] or 0,
                ))

        # One-time migration of V3 match history.
        count = connection.execute("SELECT COUNT(*) AS count FROM matches_v4").fetchone()["count"]
        if count == 0 and _table_exists(connection, "game_matches"):
            cols = {r["name"] for r in connection.execute("PRAGMA table_info(game_matches)").fetchall()}
            if {"winner_github_id", "loser_github_id"}.issubset(cols):
                def col(name):
                    return name if name in cols else f"NULL AS {name}"

                query = f"""
                    SELECT game, winner_github_id, loser_github_id,
                           winner_score, loser_score, created_at,
                           {col('winner_login')}, {col('loser_login')},
                           {col('winner_avatar_url')}, {col('loser_avatar_url')}
                    FROM game_matches
                    ORDER BY id
                """
                for match in connection.execute(query).fetchall():
                    wgid = str(match["winner_github_id"])
                    lgid = str(match["loser_github_id"])
                    winner = connection.execute(
                        "SELECT login, avatar_url FROM users_v4 WHERE user_id=?",
                        (f"github:{wgid}",),
                    ).fetchone()
                    loser = connection.execute(
                        "SELECT login, avatar_url FROM users_v4 WHERE user_id=?",
                        (f"github:{lgid}",),
                    ).fetchone()

                    winner_name = match["winner_login"] or (winner["login"] if winner else None) or "Unknown"
                    loser_name = match["loser_login"] or (loser["login"] if loser else None) or "Unknown"
                    winner_avatar = match["winner_avatar_url"] or (winner["avatar_url"] if winner else "") or ""
                    loser_avatar = match["loser_avatar_url"] or (loser["avatar_url"] if loser else "") or ""

                    connection.execute("""
                        INSERT INTO matches_v4 (
                            game, winner_user_id, loser_user_id, winner_name, loser_name,
                            winner_avatar_url, loser_avatar_url, winner_provider, loser_provider,
                            winner_score, loser_score, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'github', 'github', ?, ?, ?)
                    """, (
                        match["game"], f"github:{wgid}", f"github:{lgid}",
                        winner_name, loser_name, winner_avatar, loser_avatar,
                        match["winner_score"], match["loser_score"], match["created_at"],
                    ))


def upsert_user(
    user_id,
    provider,
    provider_subject,
    login,
    display_name,
    avatar_url="",
    email="",
    is_guest=False,
):
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO users_v4 (
                user_id, provider, provider_subject, login, display_name,
                avatar_url, email, is_guest
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                provider=excluded.provider,
                provider_subject=excluded.provider_subject,
                login=excluded.login,
                display_name=excluded.display_name,
                avatar_url=excluded.avatar_url,
                email=excluded.email,
                is_guest=excluded.is_guest,
                updated_at=CURRENT_TIMESTAMP
        """, (
            user_id, provider, provider_subject, login, display_name,
            avatar_url or "", email or "", int(bool(is_guest)),
        ))


def get_user(user_id):
    with get_connection() as connection:
        row = connection.execute("""
            SELECT user_id, provider, provider_subject, login, display_name,
                   avatar_url, email, is_guest, wins, losses,
                   wins + losses AS matches,
                   CASE WHEN wins + losses = 0 THEN 0
                        ELSE ROUND((wins * 100.0) / (wins + losses), 1)
                   END AS winrate,
                   created_at, updated_at
            FROM users_v4
            WHERE user_id=?
        """, (user_id,)).fetchone()
    return dict(row) if row else None


def record_match(
    game,
    winner_user_id,
    loser_user_id,
    winner_name,
    loser_name,
    winner_avatar_url="",
    loser_avatar_url="",
    winner_provider="",
    loser_provider="",
    winner_score=None,
    loser_score=None,
):
    with get_connection() as connection:
        connection.execute("""
            INSERT INTO matches_v4 (
                game, winner_user_id, loser_user_id, winner_name, loser_name,
                winner_avatar_url, loser_avatar_url, winner_provider, loser_provider,
                winner_score, loser_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            game, winner_user_id, loser_user_id, winner_name, loser_name,
            winner_avatar_url or "", loser_avatar_url or "",
            winner_provider or "", loser_provider or "",
            winner_score, loser_score,
        ))
        connection.execute(
            "UPDATE users_v4 SET wins=wins+1, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            (winner_user_id,),
        )
        connection.execute(
            "UPDATE users_v4 SET losses=losses+1, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            (loser_user_id,),
        )


def get_leaderboard(limit=25):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT user_id, provider, display_name, login, avatar_url, is_guest,
                   wins, losses, wins + losses AS matches,
                   CASE WHEN wins + losses = 0 THEN 0
                        ELSE ROUND((wins * 100.0) / (wins + losses), 1)
                   END AS winrate
            FROM users_v4
            WHERE wins + losses > 0
            ORDER BY wins DESC, winrate DESC, display_name COLLATE NOCASE ASC
            LIMIT ?
        """, (int(limit),)).fetchall()
    return [dict(row) for row in rows]


def get_recent_matches(limit=50):
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT id, game, winner_user_id, loser_user_id,
                   winner_name, loser_name,
                   winner_avatar_url, loser_avatar_url,
                   winner_provider, loser_provider,
                   winner_score, loser_score, created_at
            FROM matches_v4
            ORDER BY id DESC
            LIMIT ?
        """, (int(limit),)).fetchall()
    return [dict(row) for row in rows]


def get_stats_summary():
    with get_connection() as connection:
        players = connection.execute(
            "SELECT COUNT(*) AS count FROM users_v4 WHERE wins + losses > 0"
        ).fetchone()["count"]
        matches = connection.execute(
            "SELECT COUNT(*) AS count FROM matches_v4"
        ).fetchone()["count"]
        top = connection.execute("""
            SELECT display_name, provider, avatar_url, wins, losses
            FROM users_v4
            WHERE wins + losses > 0
            ORDER BY wins DESC, display_name COLLATE NOCASE ASC
            LIMIT 1
        """).fetchone()
    return {
        "players": players,
        "matches": matches,
        "top_player": dict(top) if top else None,
    }


if __name__ == "__main__":
    init_database()
    print(f"Database initialized: {DB_PATH}")
