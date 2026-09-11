# DuoArena backend event contract

Backend authenticates Socket.IO from the Flask session cookie. The player must first
log in at `/login/github`.

## HTTP

- `GET /` — hub
- `GET /login/github` — start GitHub OAuth
- `GET /auth/github/callback` — OAuth callback
- `GET /logout` — logout
- `GET /api/me` — current GitHub user
- `GET /api/stats` — leaderboard + recent matches
- `GET /api/rooms/<ROOM>` — room snapshot
- `GET /health` — Render health check
- Game pages: `/reaction`, `/typing`, `/cps`, `/aim`, `/blind`, `/stats`

## Socket.IO client -> server

### Create room
```js
socket.emit("create_room", { game: "reaction" });
```

### Join room
```js
socket.emit("join_room", { room: "AB12C" });
```

### Leave room
```js
socket.emit("leave_room");
```

### Ready
```js
socket.emit("player_ready");
```

### Reset ready
```js
socket.emit("reset_ready");
```

### Challenge GitHub user
```js
socket.emit("challenge", {
  target_login: "mapbke",
  game: "reaction"
});
```

### Challenge answer
```js
socket.emit("challenge_response", {
  room: "AB12C",
  accepted: true
});
```

### Reaction click
```js
socket.emit("reaction_click");
```

### Other game score
Use for `typing`, `cps`, `aim`, `blind`.

```js
socket.emit("submit_score", { score: 123.45 });
```

Rules:
- reaction: lower score wins
- typing: higher wins
- cps: higher wins
- aim: higher wins
- blind: lower wins (send absolute error from 5.000 seconds)

## Socket.IO server -> client

- `auth_user`
- `presence`
- `room_created`
- `room_state`
- `room_error`
- `player_joined`
- `player_left`
- `all_players_ready`
- `round_start`
- `reaction_go`
- `reaction_result`
- `false_start`
- `score_submitted`
- `round_result`
- `incoming_challenge`
- `challenge_sent`
- `challenge_declined`
- `challenge_error`
- `game_error`

## Minimal browser connection

Because Render serves the frontend and backend from the same origin:

```html
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
<script>
const socket = io();

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("room_state", (room) => {
  console.log(room);
});
</script>
```
