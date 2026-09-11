# DuoArena Frontend — integrated build

This archive is meant to sit on top of the backend package already installed in
`mapbke/DUELARENA`.

## Replace/add

Copy these folders into the project root:

```text
templates/
static/
```

The archive does **not** contain `app.py` or `database.py`.

Keep your existing:

```text
static/css/style.css
```

and add the included:

```text
static/css/integration.css
```

## What changed

- All Flask links now use `url_for()` instead of `reaction.html`, `stats.html`, etc.
- GitHub OAuth user/avatar/logout is rendered from the backend session.
- Game pages are login-protected by the backend and use the authenticated GitHub user.
- Shared realtime room UI:
  - create room
  - join by 5-char code
  - copy room code
  - challenge by GitHub login
  - accept/decline challenge
  - ready states
  - live player slots
- Reaction uses the backend `reaction_go` / `reaction_click` flow.
- Typing, CPS, Aim and Blind send scores through `submit_score`.
- Stats loads `/api/stats`.

## Deploy

After copying the files:

```bash
git add .
git commit -m "integrate frontend with oauth rooms and realtime games"
git push origin main
```

Render should auto-deploy the new commit.

## First test

1. Open `https://duoarena.onrender.com/`
2. Click `LOGIN WITH GITHUB`.
3. Authorize DuoArena.
4. Open Reaction Duel.
5. Create a room.
6. Open another GitHub account/browser and join by room code.
7. Both click READY.
8. Wait for green, then click.

## Note

Render Free can sleep/restart. Rooms are in RAM and SQLite on free Render is
ephemeral, so rooms/history can reset after a service restart. For permanent
stats later, move the database to Postgres.
