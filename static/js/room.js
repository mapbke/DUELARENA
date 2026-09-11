(() => {
    const panel = document.querySelector(".room-panel");
    if (!panel || !window.socket) return;

    const socket = window.socket;
    const mode = panel.dataset.mode;
    const initialCode = (location.pathname.match(/^\/r\/([^/]+)$/)?.[1] || new URLSearchParams(location.search).get("room") || "").trim().toUpperCase();
    let desiredCode = initialCode;
    let pending = false, pendingTimer = null;
    const errorBox = document.getElementById("room-error");
    const ru = () => window.DuoUI?.language === "ru";
    function message(code) {
        const custom = {
            invalid_payload: ["Некорректное действие. Попробуй ещё раз.", "Invalid action. Try again."],
            rate_limited: ["Слишком много попыток. Подожди минуту.", "Too many attempts. Wait a minute."],
            network: ["Соединение потеряно. Переподключаемся…", "Connection lost. Reconnecting…"],
            expired: ["Комната больше не активна. Создай новую игру.", "This room is no longer active. Create a new game."],
            round_interrupted: ["Раунд отменён из-за обрыва связи. Нажмите «Готов», когда оба вернутся.", "Round cancelled after a disconnect. Ready up when both players return."],
            opponent_left: ["Соперник вышел. Отправь ссылку, чтобы пригласить игрока.", "Opponent left. Share the link to invite a player."],
        };
        return custom[code]?.[ru() ? 0 : 1] || t(`error.${code}`);
    }
    function endPending() {
        pending = false; clearTimeout(pendingTimer);
        createButton.disabled = joinButton.disabled = !socket.connected;
    }
    function send(event, data) {
        if (pending || !socket.connected) return;
        pending = true;
        errorBox.textContent = ru() ? "Подключение…" : "Connecting…";
        createButton.disabled = joinButton.disabled = true;
        socket.emit(event, data);
        pendingTimer = setTimeout(() => { endPending(); errorBox.textContent = message("network"); }, 10000);
    }
    const t = (key,vars) => window.DuoUI?.t(key,vars) || key;

    const entry = document.getElementById("room-entry");
    const active = document.getElementById("room-active");
    const title = document.getElementById("room-title");
    const chip = document.getElementById("room-code-chip");
    const codeTop = document.getElementById("room-code-top");

    const createButton = document.getElementById("create-room");
    const joinButton = document.getElementById("join-room");
    const input = document.getElementById("room-input");
    const inviteText = document.getElementById("invite-text");
    const copyInvite = document.getElementById("copy-invite");
    const leaveButton = document.getElementById("leave-room");
    const readyButton = document.getElementById("ready-button");
    const playerA = document.getElementById("player-a");
    const playerB = document.getElementById("player-b");
    const status = document.getElementById("room-status");

    const gameSurface = document.getElementById("game-surface");
    const surfaceLock = document.getElementById("surface-lock");
    const countdownOverlay = document.getElementById("countdown-overlay");
    const countdownValue = document.getElementById("countdown-value");

    const resultOverlay = document.getElementById("result-overlay");
    const resultCard = document.getElementById("result-card");
    const resultClose = document.getElementById("result-close");
    const resultKicker = document.getElementById("result-kicker");
    const resultTitle = document.getElementById("result-title");
    const resultVersus = document.getElementById("result-versus");
    const rematchButton = document.getElementById("rematch-button");

    const state = { room:null, roomData:null, token:null, mode, playing:false };
    window.DuoRoom = state;

    function esc(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function avatar(player) {
        if (player?.avatar_url) return `<img src="${esc(player.avatar_url)}" alt="">`;
        return `<span class="avatar">${esc(String(player?.display_name || "?").slice(0,1).toUpperCase())}</span>`;
    }

    function playerHtml(player) {
        if (!player) {
            return `${avatar(null)}<div><strong>${esc(t("room.player.empty"))}</strong><small>—</small><div class="series">${esc(t("room.series",{wins:0}))}</div></div>`;
        }

        let label = t("room.player.notReady");
        let cls = "";

        if (!player.connected) {
            label = t("room.player.reconnecting");
            cls = "offline";
        } else if (player.ready) {
            label = t("room.player.ready");
            cls = "ready";
        }

        return `${avatar(player)}<div><strong>${esc(player.display_name)}</strong><small class="${cls}">${esc(label)}</small><div class="series">${esc(t("room.series",{wins:player.series_wins || 0}))}</div></div>`;
    }

    function lockSurface() {
        gameSurface?.classList.add("locked");
        gameSurface?.classList.remove("unlocked");
        if (surfaceLock) {
            surfaceLock.innerHTML = `<strong>${esc(t("game.locked"))}</strong><span>${esc(t("game.lockedHint"))}</span>`;
        }
    }

    function unlockSurface() {
        gameSurface?.classList.remove("locked");
        gameSurface?.classList.add("unlocked");
    }

    function me(players) {
        const user = window.DuoArena?.user;
        if (!user) return null;
        return players.find(p => String(p.user_id) === String(user.user_id)) || null;
    }

    function updateUrl(code) {
        history.replaceState({}, "", code ? `/r/${code}` : `/${mode}`);
    }

    function showEntry(clearUrl = true) {
        endPending();
        countdownOverlay.classList.add("hidden");
        resultOverlay.classList.add("hidden");
        window.dispatchEvent(new CustomEvent("duo:round-cancelled"));
        state.room = null;
        state.roomData = null;
        state.token = null;
        state.playing = false;

        entry.classList.remove("hidden");
        active.classList.add("hidden");
        chip.classList.add("hidden");
        title.textContent = t("room.title");
        readyButton.classList.add("hidden");
        readyButton.disabled = false;
        readyButton.textContent = t("room.ready");
        state.lastResult = null;
        if (clearUrl) { desiredCode = ""; updateUrl(null); }
        lockSurface();
    }

    function renderRoom(room) {
        endPending(); errorBox.textContent = "";
        if (room.state === "lobby" && (state.playing || state.token)) {
            state.playing = false; state.token = null;
            countdownOverlay.classList.add("hidden");
            resultOverlay.classList.add("hidden");
            window.dispatchEvent(new CustomEvent("duo:round-cancelled"));
        }
        state.room = room.room;
        state.roomData = room;

        entry.classList.add("hidden");
        active.classList.remove("hidden");
        chip.classList.remove("hidden");

        title.textContent = room.mode_name;
        codeTop.textContent = room.room;
        inviteText.textContent = room.invite_url;

        const players = room.players || [];
        playerA.innerHTML = playerHtml(players[0]);
        playerB.innerHTML = playerHtml(players[1]);

        const current = me(players);
        const connected = players.filter(p => p.connected);

        if (room.state === "countdown") {
            status.textContent = t("room.status.countdown");
            readyButton.classList.add("hidden");
            unlockSurface();
        } else if (room.state === "playing") {
            status.textContent = t("room.status.playing");
            readyButton.classList.add("hidden");
            unlockSurface();
        } else if (room.state === "finished") {
            status.textContent = t("room.status.finished");
            readyButton.classList.remove("hidden");
            readyButton.disabled = Boolean(current?.ready);
            readyButton.textContent = current?.ready ? t("room.readyDone") : t("room.ready");
            lockSurface();
        } else if (players.length < 2) {
            status.textContent = t("room.waiting");
            readyButton.classList.add("hidden");
            lockSurface();
        } else if (connected.length < 2) {
            status.textContent = t("room.player.reconnecting");
            readyButton.classList.add("hidden");
            lockSurface();
        } else {
            status.textContent = t("room.status.opponent");
            readyButton.classList.remove("hidden");
            readyButton.disabled = Boolean(current?.ready);
            readyButton.textContent = current?.ready ? t("room.readyDone") : t("room.ready");
            lockSurface();
        }

        if (room.notice && room.state === "lobby") status.textContent = message(room.notice);
        if (room.last_result && !state.lastResult) {
            showResult(room.last_result);
            state.lastResult = room.last_result.round;
        }
        updateUrl(room.room);
        window.dispatchEvent(new CustomEvent("duo:room-state",{detail:room}));
    }

    function score(modeName,value,meta={}) {
        if (meta.timeout) return ru() ? "Время вышло" : "Timed out";
        const n = Number(value);
        if (modeName === "reaction") return meta.false_start || n >= 999999 ? (ru() ? "Фальстарт" : "False start") : `${n.toFixed(0)} ms`;
        if (modeName === "typing") return `${n.toFixed(1)} WPM`;
        if (modeName === "cps") return `${n.toFixed(0)} clicks`;
        if (modeName === "aim") return `${n.toFixed(3)} t/s`;
        if (modeName === "blind") return n >= 999999 ? "TIMEOUT" : `${(n/1000).toFixed(3)}s error`;
        return String(value ?? "—");
    }

    function resultPlayer(player) {
        return `<div class="result-player-card">${avatar(player)}<strong>${esc(player.display_name)}</strong><span>${esc(score(mode,player.score,player.meta || {}))}</span></div>`;
    }

    function showResult(data) {
        const user = window.DuoArena?.user;
        const winner = data.winner;
        const draw = Boolean(data.draw);
        const won = !draw && user && winner && String(user.user_id) === String(winner.user_id);

        resultCard.classList.remove("victory","defeat","draw");
        resultKicker.textContent = t("result.round",{round:data.round});

        if (draw) {
            resultCard.classList.add("draw");
            resultTitle.textContent = t("result.draw");
        } else if (won) {
            resultCard.classList.add("victory");
            resultTitle.textContent = t("result.victory");
        } else {
            resultCard.classList.add("defeat");
            resultTitle.textContent = t("result.defeat");
        }

        resultVersus.innerHTML = `${resultPlayer(data.players[0])}<b>VS</b>${resultPlayer(data.players[1])}`;
        rematchButton.disabled = false;
        rematchButton.textContent = t("result.rematch");
        resultOverlay.classList.remove("hidden");
    }

    function showCountdown(seconds) {
        countdownOverlay.classList.remove("hidden");
        const started = performance.now();
        const duration = Math.max(0,Number(seconds) * 1000);
        const token = state.token;

        function frame(now) {
            if (token !== state.token) return;
            const left = Math.max(0,duration - (now-started));
            countdownValue.textContent = String(Math.max(1,Math.ceil(left/1000)));
            if (left <= 0) {
                countdownOverlay.classList.add("hidden");
                return;
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    createButton.addEventListener("click",() => {
        send("room_create",{mode,language:window.DuoUI?.language || "en"});
    });

    joinButton.addEventListener("click",() => {
        const code = input.value.trim().toUpperCase();
        if (!/^[A-HJ-NP-Z2-9]{5}$/.test(code)) {
            errorBox.textContent = message("invalid_room_code"); return;
        }
        send("room_join",{room:code});
    });

    input.addEventListener("input",() => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5);
    });

    input.addEventListener("keydown",event => {
        if (event.key === "Enter") joinButton.click();
    });

    copyInvite.addEventListener("click",async () => {
        const url = state.roomData?.invite_url;
        if (!url) return;

        try {
            await navigator.clipboard.writeText(url);
            copyInvite.textContent = t("room.copied");
            setTimeout(() => copyInvite.textContent = t("room.copyLink"),1100);
        } catch {
            copyInvite.textContent = url;
        }
    });

    leaveButton.addEventListener("click",() => socket.emit("room_leave"));

    readyButton.addEventListener("click",() => {
        readyButton.disabled = true;
        readyButton.textContent = t("room.readyDone");
        socket.emit("room_ready");
    });

    resultClose.addEventListener("click",() => resultOverlay.classList.add("hidden"));
    resultOverlay.addEventListener("pointerdown",event => {
        if (event.target === resultOverlay) resultOverlay.classList.add("hidden");
    });

    rematchButton.addEventListener("click",() => {
        resultOverlay.classList.add("hidden");
        rematchButton.disabled = true;
        rematchButton.textContent = t("room.readyDone");
        socket.emit("room_ready");
    });

    socket.on("room_joined",data => {
        if (data.mode !== mode) location.assign(data.redirect_url);
    });

    socket.on("room_state",room => {
        if (room.mode === mode) renderRoom(room);
    });

    socket.on("room_left",() => showEntry());
    socket.on("room_expired", () => { showEntry(); errorBox.textContent = message("expired"); });

    socket.on("room_error",data => {
        endPending();
        errorBox.textContent = message(data.code);
        if (state.room) status.textContent = message(data.code);
        readyButton.disabled = false;
    });

    socket.on("round_countdown",data => {
        if (data.mode !== mode) return;
        state.lastResult = null;
        resultOverlay.classList.add("hidden");
        state.token = data.token;
        showCountdown(data.seconds);
        unlockSurface();
        window.dispatchEvent(new CustomEvent("duo:round-countdown",{detail:data}));
    });

    socket.on("round_start",data => {
        if (data.mode !== mode) return;
        state.token = data.token;
        countdownOverlay.classList.add("hidden");
        state.playing = true;
        unlockSurface();
        window.dispatchEvent(new CustomEvent("duo:round-start",{detail:data}));
    });

    socket.on("round_result",data => {
        if (data.mode !== mode) return;
        state.playing = false;
        state.token = null;
        state.lastResult = data.round;
        showResult(data);
        window.dispatchEvent(new CustomEvent("duo:round-result",{detail:data}));
    });

    async function ensureUser() {
        if (window.DuoArena?.user) return;
        const response = await fetch("/api/me");
        if (!response.ok) return;
        window.DuoArena.user = (await response.json()).user;
    }

    async function autoJoin() {
        endPending();
        try {
            await ensureUser();
            const code = state.room || desiredCode;
            if (code) { input.value = code; send("room_join", {room:code}); }
        } catch { errorBox.textContent = message("network"); }
    }

    window.addEventListener("duo:socket-disconnected", () => {
        pending = false; clearTimeout(pendingTimer);
        createButton.disabled = joinButton.disabled = readyButton.disabled = true;
        state.playing = false; state.token = null;
        countdownOverlay.classList.add("hidden");
        errorBox.textContent = message("network");
        lockSurface();
        window.dispatchEvent(new CustomEvent("duo:round-cancelled"));
    });

    window.addEventListener("duo:reconnect-failed", () => {
        errorBox.textContent = ru() ? "Не удалось восстановить соединение. Обнови страницу или вернись к играм." : "Could not reconnect. Reload this page or return to the games.";
    });

    window.addEventListener("duo:language",() => {
        if (state.roomData) renderRoom(state.roomData);
        else title.textContent = t("room.title");
        copyInvite.textContent = t("room.copyLink");
    });

    showEntry(false);
    window.addEventListener("duo:socket-connected",autoJoin);
    if (socket.connected) autoJoin();
})();
