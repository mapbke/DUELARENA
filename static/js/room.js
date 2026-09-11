(() => {
    const panel = document.querySelector(".room-panel");
    if (!panel || !window.socket) return;

    const socket = window.socket;
    const game = panel.dataset.game;

    const roomCodeDisplay = document.getElementById("room-code-display");
    const roomCodeInput = document.getElementById("room-code-input");
    const createButton = document.getElementById("create-room-button");
    const joinButton = document.getElementById("join-room-button");
    const copyButton = document.getElementById("copy-room-button");
    const challengeInput = document.getElementById("challenge-login-input");
    const challengeButton = document.getElementById("challenge-button");
    const readyButton = document.getElementById("ready-button");
    const status = document.getElementById("room-status");
    const playerOne = document.getElementById("room-player-one");
    const playerTwo = document.getElementById("room-player-two");

    const modal = document.getElementById("challenge-modal");
    const challengeTitle = document.getElementById("challenge-title");
    const challengeText = document.getElementById("challenge-text");
    const challengeAccept = document.getElementById("challenge-accept");
    const challengeDecline = document.getElementById("challenge-decline");

    const state = {
        room: null,
        roomState: null,
        pendingChallenge: null
    };

    window.DuoRoom = state;

    function setStatus(message, type = "") {
        status.textContent = message;
        status.className = `room-status ${type}`.trim();
    }

    function setRoom(code) {
        state.room = code || null;
        roomCodeDisplay.textContent = code || "NO ROOM";
        copyButton.disabled = !code;
        readyButton.disabled = !code;

        const url = new URL(window.location.href);
        if (code) {
            url.searchParams.set("room", code);
        } else {
            url.searchParams.delete("room");
        }
        history.replaceState({}, "", url);
    }

    function playerMarkup(player) {
        if (!player) {
            return `
                <div>
                    <div class="room-player-name">Waiting...</div>
                    <div class="room-player-state">EMPTY SLOT</div>
                </div>
            `;
        }

        const avatar = player.avatar_url
            ? `<img src="${player.avatar_url}" alt="">`
            : "";

        return `
            ${avatar}
            <div>
                <div class="room-player-name">${escapeHtml(player.login)}</div>
                <div class="room-player-state ${player.ready ? "ready" : ""}">
                    ${player.ready ? "READY" : "NOT READY"}
                </div>
            </div>
        `;
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function renderRoom(room) {
        state.roomState = room;
        setRoom(room.room);

        const players = room.players || [];
        playerOne.innerHTML = playerMarkup(players[0]);
        playerTwo.innerHTML = playerMarkup(players[1]);

        readyButton.disabled = players.length === 0;

        if (players.length < 2) {
            setStatus(`Room ${room.room}: waiting for opponent...`);
        } else if (players.every(p => p.ready)) {
            setStatus("Both players ready. Round starting...", "success");
        } else {
            setStatus("Both players connected. Ready up.");
        }

        window.dispatchEvent(new CustomEvent("duo:room-state", { detail: room }));
    }

    createButton.addEventListener("click", () => {
        setStatus("Creating room...");
        socket.emit("create_room", { game });
    });

    joinButton.addEventListener("click", () => {
        const code = roomCodeInput.value.trim().toUpperCase();
        if (!code) return;
        setStatus(`Joining ${code}...`);
        socket.emit("join_room", { room: code });
    });

    roomCodeInput.addEventListener("input", () => {
        roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    });

    copyButton.addEventListener("click", async () => {
        if (!state.room) return;
        try {
            await navigator.clipboard.writeText(state.room);
            setStatus(`Copied room code ${state.room}`, "success");
        } catch {
            setStatus(`Room code: ${state.room}`);
        }
    });

    readyButton.addEventListener("click", () => {
        if (!state.room) return;
        readyButton.disabled = true;
        readyButton.textContent = "READY ✓";
        socket.emit("player_ready");
    });

    challengeButton.addEventListener("click", () => {
        const target = challengeInput.value.trim();
        if (!target) {
            return setStatus("Enter opponent's GitHub login.", "error");
        }

        setStatus(`Challenging ${target}...`);
        socket.emit("challenge", {
            target_login: target,
            game
        });
    });

    socket.on("room_created", (data) => {
        setRoom(data.room);
        setStatus(`Room ${data.room} created. Share the code or challenge a user.`, "success");
    });

    socket.on("room_state", (room) => {
        if (room.game !== game) return;
        renderRoom(room);
    });

    socket.on("room_error", (data) => {
        setStatus(data.message || "Room error", "error");
        readyButton.disabled = !state.room;
    });

    socket.on("challenge_sent", (data) => {
        setRoom(data.room);
        setStatus(`Challenge sent to ${data.target_login}. Waiting...`, "success");
    });

    socket.on("challenge_error", (data) => {
        setStatus(data.message || "Challenge failed", "error");
    });

    socket.on("challenge_declined", (data) => {
        setStatus(`${data.by.login} declined the challenge.`, "error");
    });

    socket.on("incoming_challenge", (data) => {
        state.pendingChallenge = data;

        if (data.game !== game) {
            challengeTitle.textContent = `${data.from.login} challenges you`;
            challengeText.textContent = `${data.game.toUpperCase()} · accept to switch arena`;
        } else {
            challengeTitle.textContent = `${data.from.login} challenges you`;
            challengeText.textContent = `${game.toUpperCase()} · room ${data.room}`;
        }

        modal.classList.add("show");
    });

    challengeAccept.addEventListener("click", () => {
        const pending = state.pendingChallenge;
        if (!pending) return;

        socket.emit("challenge_response", {
            room: pending.room,
            accepted: true
        });

        modal.classList.remove("show");

        if (pending.game !== game) {
            const path = {
                reaction: "/reaction",
                typing: "/typing",
                cps: "/cps",
                aim: "/aim",
                blind: "/blind"
            }[pending.game] || "/reaction";

            setTimeout(() => {
                window.location.href = `${path}?room=${encodeURIComponent(pending.room)}`;
            }, 180);
            return;
        }

        setRoom(pending.room);
        state.pendingChallenge = null;
    });

    challengeDecline.addEventListener("click", () => {
        const pending = state.pendingChallenge;
        if (pending) {
            socket.emit("challenge_response", {
                room: pending.room,
                accepted: false
            });
        }
        state.pendingChallenge = null;
        modal.classList.remove("show");
    });

    socket.on("all_players_ready", (data) => {
        if (data.game !== game) return;
        setStatus("Both players ready.", "success");
        window.dispatchEvent(new CustomEvent("duo:all-ready", { detail: data }));
    });

    socket.on("round_start", (data) => {
        if (data.game !== game) return;
        setStatus("ROUND LIVE", "success");
        window.dispatchEvent(new CustomEvent("duo:round-start", { detail: data }));
    });

    socket.on("reaction_go", (data) => {
        if (game !== "reaction") return;
        window.dispatchEvent(new CustomEvent("duo:reaction-go", { detail: data }));
    });

    socket.on("round_result", (data) => {
        if (data.game !== game) return;

        readyButton.disabled = false;
        readyButton.textContent = "READY";

        const message = data.draw
            ? "DRAW"
            : `${data.winner.login} WINS`;

        setStatus(message, "success");
        window.dispatchEvent(new CustomEvent("duo:round-result", { detail: data }));
    });

    socket.on("player_left", (data) => {
        setStatus(`${data.login} left the room.`, "error");
        readyButton.disabled = false;
        readyButton.textContent = "READY";
    });

    window.addEventListener("duo:socket-connect", () => {
        const code = new URLSearchParams(window.location.search).get("room");
        if (code) {
            roomCodeInput.value = code.toUpperCase();
            socket.emit("join_room", { room: code.toUpperCase() });
        }
    });

    // socket.js can connect before this script finishes loading.
    if (socket.connected) {
        const code = new URLSearchParams(window.location.search).get("room");
        if (code) {
            roomCodeInput.value = code.toUpperCase();
            socket.emit("join_room", { room: code.toUpperCase() });
        }
    }
})();
