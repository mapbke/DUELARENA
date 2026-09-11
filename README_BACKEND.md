# DuoArena Backend

Drop these backend files into the root of `mapbke/DUELARENA`.

This package includes:

- GitHub OAuth login
- Flask session auth
- Socket.IO authenticated connections
- 2-player rooms
- challenges by GitHub username
- ready state
- server-controlled Reaction Duel
- generic scoring for Typing / CPS / Aim / Blind
- online presence
- SQLite users / wins / losses / match history
- Render health endpoint
- Gunicorn production startup

## 1. Copy files

Replace your current:

- `app.py`
- `database.py`
- `requirements.txt`

Add:

- `.env.example`
- `render.yaml`
- `Procfile`
- `CLIENT_EVENTS.md`

Do not overwrite your existing `templates/` or `static/` folders.

## 2. Render environment variables

Render -> DuoArena -> Environment:

```text
BASE_URL=https://duoarena.onrender.com
GITHUB_CLIENT_ID=<your client id>
GITHUB_CLIENT_SECRET=<your client secret>
SECRET_KEY=<long random secret>
```

Generate `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Never commit the real client secret.

## 3. GitHub OAuth app

Use:

```text
Homepage URL:
https://duoarena.onrender.com

Redirect URI:
https://duoarena.onrender.com/auth/github/callback
```

## 4. Render commands

Build:

```bash
pip install -r requirements.txt
```

Start:

```bash
gunicorn -w 1 --threads 100 --bind 0.0.0.0:$PORT app:app
```

Keep one Gunicorn worker. Rooms are currently stored in process memory, so multiple
workers would each have separate room state.

## 5. Local test

Create `.env` from `.env.example`, then:

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows PowerShell

pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

Login:

```text
http://127.0.0.1:5000/login/github
```

For local OAuth testing, add this Redirect URI to the GitHub OAuth app too:

```text
http://127.0.0.1:5000/auth/github/callback
```

GitHub currently allows multiple Redirect URIs on the OAuth app UI.

## 6. Frontend integration

Read `CLIENT_EVENTS.md`.

Important: remove hardcoded client identity such as:

```js
player: "Nikita"
```

The backend gets identity from the authenticated GitHub session.

## Render free warning

The free Render filesystem is ephemeral. The SQLite database may be reset after
a redeploy/restart. Rooms are also deliberately in-memory.

For permanent stats later, move the DB to managed Postgres. The Socket.IO/room
code can stay almost unchanged.
