(() => {
    const lobby = document.querySelector(".lobby");
    if (!lobby || !window.socket) return;

    const socket = window.socket;
    const game = lobby.dataset.game;

    const setup = document.getElementById("lobby-setup");
    const active = document.getElementById("lobby-active");
    const title = document.getElementById("lobby-title");
    const badge = document.getElementById("room-badge");
    const codeDisplay = document.getElementById("room-code-display");
    const bigCode = document.getElementById("big-room-code");
    const codeInput = document.getElementById("room-code-input");

    const createButton = document.getElementById("create-room-button");
    const joinButton = document.getElementById("join-room-button");
    const copyButton = document.getElementById("copy-room-button");
    const leaveButton = document.getElementById("leave-room-button");
    const readyButton = document.getElementById("ready-button");

    const playerOne = document.getElementById("player-one");
    const playerTwo = document.getElementById("player-two");
    const status = document.getElementById("lobby-status");

    const gameStage = document.getElementById("game-stage");
    const stageLock = document.getElementById("stage-lock");

    const resultModal = document.getElementById("result-modal");
    const resultCard = document.getElementById("result-card");
    const resultKicker = document.getElementById("result-kicker");
    const resultOutcome = document.getElementById("result-outcome");
    const resultAvatar = document.getElementById("result-avatar");
    const resultWinner = document.getElementById("result-winner");
    const resultScore = document.getElementById("result-score");
    const resultRematch = document.getElementById("result-rematch");
    const resultClose = document.getElementById("result-close");

    const state = {
        room: null,
        roomState: null,
        roundToken: null,
        roundActive: false,
    };

    window.DuoRoom = state;

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function setStatus(message, type = "") {
        status.textContent = message;
        status.className = `lobby-status ${type}`.trim();
    }

    function setRoomInUrl(room) {
        const url = new URL(location.href);
        if (room) url.searchParams.set("room", room);
        else url.searchParams.delete("room");
        history.replaceState({}, "", url);
    }

    function showSetup() {
        state.room = null;
        state.roomState = null;
        state.roundToken = null;
        state.roundActive = false;

        setup.classList.remove("hidden");
        active.classList.add("hidden");
        badge.classList.add("hidden");
        title.textContent = "Подключитесь к сопернику";

        readyButton.classList.add("hidden");
        readyButton.disabled = false;
        readyButton.textContent = "Я готов";

        setRoomInUrl(null);
        lockStage("Сначала подключитесь к комнате", "После подключения двух игроков появится кнопка готовности.");
    }

    function showRoom(room) {
        state.room = room.room;
        state.roomState = room;

        setup.classList.add("hidden");
        active.classList.remove("hidden");
        badge.classList.remove("hidden");

        codeDisplay.textContent = room.room;
        bigCode.textContent = room.room;
        title.textContent = room.game_name || "Комната";
        setRoomInUrl(room.room);

        const players = room.players || [];
        playerOne.innerHTML = playerHtml(players[0]);
        playerTwo.innerHTML = playerHtml(players[1]);

        const connectedPlayers = players.filter(p => p.connected);

        if (players.length < 2) {
            readyButton.classList.add("hidden");
            setStatus(`Комната создана. Отправьте код ${room.room} второму игроку.`);
            lockStage("Ждём второго игрока", "Отправьте ему код комнаты сверху.");
        } else if (connectedPlayers.length < 2) {
            readyButton.classList.add("hidden");
            setStatus("Второй игрок переподключается...");
            lockStage("Соперник переподключается", "Подождите несколько секунд.");
        } else {
            readyButton.classList.remove("hidden");

            const me = getMe(players);
            if (me?.ready) {
                readyButton.disabled = true;
                readyButton.textContent = "Готов ✓";
            } else {
                readyButton.disabled = false;
                readyButton.textContent = "Я готов";
            }

            if (players.every(p => p.ready)) {
                setStatus("Оба готовы. Раунд запускается...", "success");
                unlockStage();
            } else {
                setStatus("Оба игрока в комнате. Нажмите «Я готов».");
                lockStage("Ожидаем готовность", "Оба игрока должны нажать «Я готов».");
            }
        }

        window.dispatchEvent(new CustomEvent("duo:room-state", { detail: room }));
    }

    function getMe(players) {
        const login = window.DuoArena?.user?.login;
        if (!login) return null;
        return players.find(p => p.login.toLowerCase() === login.toLowerCase()) || null;
    }

    function playerHtml(player) {
        if (!player) {
            return `
                <div>
                    <strong>Свободное место</strong>
                    <small>ЖДЁМ ИГРОКА</small>
                </div>
            `;
        }

        const avatar = player.avatar_url
            ? `<img src="${escapeHtml(player.avatar_url)}" alt="">`
            : "";

        let stateText = "НЕ ГОТОВ";
        let stateClass = "";

        if (!player.connected) {
            stateText = "ПЕРЕПОДКЛЮЧЕНИЕ";
            stateClass = "offline";
        } else if (player.ready) {
            stateText = "ГОТОВ";
            stateClass = "ready";
        }

        return `
            ${avatar}
            <div>
                <strong>${escapeHtml(player.login)}</strong>
                <small class="${stateClass}">${stateText}</small>
            </div>
        `;
    }

    function lockStage(headline, description) {
        if (!gameStage || !stageLock) return;
        gameStage.classList.add("locked");
        gameStage.classList.remove("unlocked");
        stageLock.innerHTML = `<strong>${escapeHtml(headline)}</strong><span>${escapeHtml(description)}</span>`;
    }

    function unlockStage() {
        if (!gameStage) return;
        gameStage.classList.remove("locked");
        gameStage.classList.add("unlocked");
    }

    async function loadUser() {
        try {
            const response = await fetch("/api/me");
            if (!response.ok) return;
            const data = await response.json();
            window.DuoArena.user = data.user;
        } catch (error) {
            console.error(error);
        }
    }

    function formatScore(gameName, score) {
        const value = Number(score);
        if (!Number.isFinite(value)) return "—";

        if (gameName === "reaction") {
            return value >= 999999 ? "FALSE START" : `${value.toFixed(0)} ms`;
        }
        if (gameName === "typing") return `${value.toFixed(1)} WPM`;
        if (gameName === "cps") return `${value.toFixed(0)} clicks`;
        if (gameName === "aim") return `${value.toFixed(3)} targets/s`;
        if (gameName === "blind") return `${(value / 1000).toFixed(3)}s error`;
        return String(value);
    }

    function showRoundResult(data) {
        if (!resultModal) return;

        const me = window.DuoArena?.user;
        const winner = data.winner;
        const isDraw = Boolean(data.draw);
        const iWon = !isDraw && me && winner &&
            String(me.github_id) === String(winner.github_id);

        resultCard.classList.remove("victory", "defeat", "draw");

        if (isDraw) {
            resultCard.classList.add("draw");
            resultKicker.textContent = `ROUND ${data.round} COMPLETE`;
            resultOutcome.textContent = "НИЧЬЯ";
            resultWinner.textContent = "Равный результат";
            resultAvatar.hidden = true;
            resultScore.textContent = "Оба игрока показали одинаковый результат";
        } else {
            resultCard.classList.add(iWon ? "victory" : "defeat");
            resultKicker.textContent = `ROUND ${data.round} COMPLETE`;
            resultOutcome.textContent = iWon ? "ПОБЕДА" : "ПОРАЖЕНИЕ";
            resultWinner.textContent = `${winner.login} победил`;

            if (winner.avatar_url) {
                resultAvatar.src = winner.avatar_url;
                resultAvatar.hidden = false;
            } else {
                resultAvatar.hidden = true;
            }

            const winnerValue = data.scores[String(winner.github_id)];
            resultScore.textContent = `Лучший результат: ${formatScore(data.game, winnerValue)}`;
        }

        resultModal.classList.remove("hidden");
        requestAnimationFrame(() => resultModal.classList.add("show"));
    }

    function hideRoundResult() {
        if (!resultModal) return;
        resultModal.classList.remove("show");
        setTimeout(() => resultModal.classList.add("hidden"), 180);
    }

    resultClose?.addEventListener("click", hideRoundResult);

    resultModal?.addEventListener("pointerdown", (event) => {
        if (event.target === resultModal) hideRoundResult();
    });

    resultRematch?.addEventListener("click", () => {
        hideRoundResult();
        resultRematch.disabled = true;
        resultRematch.textContent = "Готов ✓";
        readyButton.disabled = true;
        readyButton.textContent = "Готов ✓";
        socket.emit("player_ready");
    });

    createButton.addEventListener("click", () => {
        createButton.disabled = true;
        socket.emit("create_room", { game });
        setTimeout(() => { createButton.disabled = false; }, 1200);
    });

    joinButton.addEventListener("click", () => {
        const code = codeInput.value.trim().toUpperCase();
        if (!code) return;
        socket.emit("join_room", { room: code });
    });

    codeInput.addEventListener("input", () => {
        codeInput.value = codeInput.value
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 5);
    });

    codeInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") joinButton.click();
    });

    copyButton.addEventListener("click", async () => {
        if (!state.room) return;

        try {
            await navigator.clipboard.writeText(state.room);
            copyButton.textContent = "Скопировано ✓";
            setTimeout(() => copyButton.textContent = "Копировать", 1200);
        } catch {
            setStatus(`Код комнаты: ${state.room}`, "success");
        }
    });

    leaveButton.addEventListener("click", () => {
        socket.emit("leave_room");
    });

    readyButton.addEventListener("click", () => {
        readyButton.disabled = true;
        readyButton.textContent = "Готов ✓";
        socket.emit("player_ready");
    });

    socket.on("room_created", ({ room }) => {
        state.room = room;
    });

    socket.on("room_joined", ({ room }) => {
        state.room = room;
    });

    socket.on("room_state", (room) => {
        if (room.game !== game) return;
        showRoom(room);
    });

    socket.on("room_left", () => {
        showSetup();
    });

    socket.on("room_error", (data) => {
        if (state.room) {
            setStatus(data.message || "Ошибка комнаты.", "error");
            readyButton.disabled = false;
        } else {
            alert(data.message || "Ошибка комнаты.");
        }
    });

    socket.on("player_left", (data) => {
        setStatus(`${data.login} вышел из комнаты.`, "error");
    });

    socket.on("round_prepare", (data) => {
        if (data.game !== game) return;
        state.roundToken = data.round_token;
        state.roundActive = true;
        unlockStage();
        setStatus(`Раунд ${data.round} начинается...`, "success");
        window.dispatchEvent(new CustomEvent("duo:round-prepare", { detail: data }));
    });

    socket.on("round_start", (data) => {
        if (data.game !== game) return;
        state.roundToken = data.round_token;
        state.roundActive = true;
        unlockStage();
        window.dispatchEvent(new CustomEvent("duo:round-start", { detail: data }));
    });

    socket.on("reaction_go", (data) => {
        if (game !== "reaction") return;
        state.roundToken = data.round_token;
        window.dispatchEvent(new CustomEvent("duo:reaction-go", { detail: data }));
    });

    socket.on("round_result", (data) => {
        if (data.game !== game) return;

        state.roundActive = false;
        state.roundToken = null;

        readyButton.disabled = false;
        readyButton.textContent = "Ещё раунд";
        readyButton.classList.remove("hidden");

        if (resultRematch) {
            resultRematch.disabled = false;
            resultRematch.textContent = "Готов к реваншу";
        }

        const text = data.draw
            ? "Ничья."
            : `${data.winner.login} побеждает.`;

        setStatus(`${text} Раунд завершён.`, "success");
        showRoundResult(data);
        window.dispatchEvent(new CustomEvent("duo:round-result", { detail: data }));
    });

    socket.on("game_error", (data) => {
        setStatus(data.message || "Ошибка раунда.", "error");
    });

    async function autoJoinFromUrl() {
        await loadUser();

        const code = new URLSearchParams(location.search).get("room");
        if (code && code.length === 5) {
            codeInput.value = code.toUpperCase();
            socket.emit("join_room", { room: code.toUpperCase() });
        }
    }

    if (socket.connected) {
        autoJoinFromUrl();
    } else {
        window.addEventListener("duo:socket-connected", autoJoinFromUrl, { once: true });
    }
})();
