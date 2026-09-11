# DuoArena v6: audit and validation

## Initial audit

- Frontend: server-rendered Jinja, plain JavaScript, Manrope/JetBrains Mono, one active stylesheet (`static/css/app.css`).
- Backend: Flask, Flask-SocketIO with threading, Python game handlers in `app.py`.
- Storage: SQLite users and match history; rooms in process memory protected by an RLock.
- Transport: Socket.IO. The existing protocol matches the active `room.js`, not the old `lobby.js`.
- Auth: signed session cookies; Guest, GitHub and Google. Login `next` preserves invitations.
- Routing: `/reaction`, `/typing`, `/cps`, `/aim`, `/blind`, `/stats`, `/r/<code>`.
- Deployment: Render, one Gunicorn worker with 100 threads. No Redis needed for this single-process deployment; multiple workers/instances are not supported.
- Games: Reaction Duel, Typing Duel, CPS Battle, Aim Duel, Blind Timing.
- Inactive legacy files: `static/js/lobby.js`, `_lobby.html`, `_room_lobby.html`, `static/css/style.css`, `static/css/integration.css`. Active game templates use `_room.html` and `room.js`. Retained for now, not used as a second protocol.

## Confirmed defects and changes

1. `showEntry()` erased the invite query before asynchronous auto-join read it. Capture the invite before setup; use canonical `/r/<code>` URLs; retain old `?room=` support.
2. Socket reconnect only joined once. Join on every connection, with visible finite reconnect failure handling.
3. Active-round refresh restored only room metadata, leaving games inert. Explicit shared rule: disconnect cancels the current round, invalidates its token, resets both readiness flags, retains room and series score. Both players see the same cancellation and ready again. Grace is 60 seconds; after that the absent player is removed. Completed result snapshots survive refresh while the room remains alive.
4. Failed join removed the player from their previous room. Validate destination before leaving.
5. Old sockets could act after replacement. Authorize ready/leave/game actions against the currently attached socket; remove the old socket from the broadcast room.
6. Create/join are serialized, rate limited per client address (20/60 per minute), and payload types and codes validated. Room lifetime defaults to two hours; a sweeper expires rooms and stale rate buckets. Code generation and insertion now run in the same locked operation.
7. Every click unnecessarily persisted the user in SQLite. Socket events use the signed session identity without writing the profile each time.
8. Timing workers can complete late, so Aim and Typing now also check submission deadlines. Typing requires full-length input; malformed numeric fields return a controlled error.
9. Pending create/join buttons wait for a server response, with a ten-second UI timeout. Errors are inline, with live announcements. Keyboard activation is supported for Reaction/CPS/Aim.
10. Reconnect and cancellation stop local game timers and disable gameplay. Results and rematches use the common room layer in all five games.
11. UI: desktop room sidebar beside play area; mobile stacks; smaller 36–52px game titles; body 16px; regular labels 14px; no decorative blobs; improved focus and reduced-motion behavior; simpler game descriptions.
12. Brand: simplified split-D SVG, PNG 192/512, apple-touch 180, ICO 16/32/48/64.
13. Socket.IO 4.8.1 is served locally with its MIT license. Polling is available before WebSocket upgrade, removing a critical external CDN dependency.
14. Production requires a stable environment SECRET_KEY; local development uses a random secret rather than a public fixed key. Debug defaults off. Input size limited to 16KB.

## Actual protocol

| Direction | Event | Purpose |
|---|---|---|
| Client → server | `room_create {mode, language}` | Create a room and become its first player |
| Client → server | `room_join {room}` | Join or reattach using signed session identity |
| Client → server | `room_ready` | Vote to start or rematch |
| Client → server | `room_leave` | Leave room |
| Server → client | `room_created`, `room_joined` | Confirmation and route metadata |
| Server → room | `room_state` | Players, state, series score, notice, finished-result snapshot |
| Server → room | `round_countdown`, `round_start` | Tokenized round start and mode data |
| Server → room | `reaction_go` | Reaction signal |
| Client → server | `reaction_click`, `typing_progress`, `typing_finish`, `cps_click`, `aim_hit`, `blind_stop` | Validated game actions carrying round token |
| Server → room | `round_result` | One authoritative result for both players |
| Server → client/room | `room_error`, `room_expired` | Recoverable error or closed room |

No client-supplied player ID is trusted. Room code alone does not authorize actions.

## Executed validation

- `python -m unittest discover -s tests -v`: eight tests, including all five modes, result agreement, rematches, false start, timeout/draw, missing/full rooms, login return route, cancellation/reconnect, stale socket rejection, malformed payloads and expiry. Background tasks are controlled in these tests.
- `node --test tests/room-client.test.cjs`: four tests executing the actual room script with a small DOM/socket harness: direct invite, legacy query, repeated reconnect, double create, canonical URL and inline error recovery. These are not browser tests.
- `python tests/gunicorn_smoke.py`: real Gunicorn process, two independent HTTP cookie jars and Socket.IO clients; invite, Reaction result agreement, rematch, disconnect cancellation and reconnect.
- All project JavaScript passes `node --check`; all Jinja templates compile; `git diff --check` passes.

## Not verified / release gates

- Browser visual and end-to-end QA at 390, 768, 1366, 1440 and 1920px has NOT been executed. The available supervised preview requires a compatible Node/Vite development server and cannot launch this Flask repository. No fake browser success is claimed.
- Live Render was not deployed or validated. A read-only request through the web tool failed to open the production URLs. OAuth providers and Render environment/logs were not available for verification.
- Changes must be tested in two independent browsers before merging/deploying. Play each game through invite → ready → result → rematch, refresh in lobby and mid-round, try a third browser, and inspect mobile overflow, keyboard navigation and console.
- Timing remains measured on server arrival, so network latency affects Reaction and Blind. This is not latency-compensated competitive timing or anti-cheat.
- In-memory rooms disappear on process restart. The existing Render free plan does not provide durable SQLite storage. The missing-room screen explains restart/closure; durable sessions/history require a separate infrastructure decision.
- Room engine is still in clearly separated functions in `app.py`; it has not yet been extracted into a module. Legacy inactive files remain.

This branch is a reviewable repair, not a declaration that every handoff release gate has passed.
