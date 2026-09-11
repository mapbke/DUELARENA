(() => {
    const panel = document.querySelector(".room-panel");
    if (!panel || !window.socket) return;

    const socket = window.socket;
    const mode = panel.dataset.mode;
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
        const url = new URL(location.href);
        if (code) url.searchParams.set("room",code);
        else url.searchParams.delete("room");
        history.replaceState({},"",url);
    }

    function showEntry() {
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
        updateUrl(null);
        lockSurface();
    }

    function renderRoom(room) {
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

        updateUrl(room.room);
        window.dispatchEvent(new CustomEvent("duo:room-state",{detail:room}));
    }

    function score(modeName,value,meta={}) {
        const n = Number(value);
        if (modeName === "reaction") return meta.false_start || n >= 999999 ? "FALSE START" : `${n.toFixed(0)} ms`;
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

        function frame(now) {
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
        createButton.disabled = true;
        socket.emit("room_create",{mode,language:window.DuoUI?.language || "en"});
        setTimeout(() => createButton.disabled = false,800);
    });

    joinButton.addEventListener("click",() => {
        const code = input.value.trim().toUpperCase();
        if (code) socket.emit("room_join",{room:code});
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

    socket.on("room_left",showEntry);

    socket.on("room_error",data => {
        const message = t(`error.${data.code}`);
        if (state.room) status.textContent = message;
        else alert(message);
        readyButton.disabled = false;
    });

    socket.on("round_countdown",data => {
        if (data.mode !== mode) return;
        state.token = data.token;
        showCountdown(data.seconds);
        unlockSurface();
        window.dispatchEvent(new CustomEvent("duo:round-countdown",{detail:data}));
    });

    socket.on("round_start",data => {
        if (data.mode !== mode) return;
        state.token = data.token;
        state.playing = true;
        unlockSurface();
        window.dispatchEvent(new CustomEvent("duo:round-start",{detail:data}));
    });

    socket.on("round_result",data => {
        if (data.mode !== mode) return;
        state.playing = false;
        state.token = null;
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
        await ensureUser();
        const code = new URLSearchParams(location.search).get("room");
        if (code?.length === 5) {
            input.value = code.toUpperCase();
            socket.emit("room_join",{room:code.toUpperCase()});
        }
    }

    window.addEventListener("duo:language",() => {
        if (state.roomData) renderRoom(state.roomData);
        else title.textContent = t("room.title");
        copyInvite.textContent = t("room.copyLink");
    });

    if (socket.connected) autoJoin();
    else window.addEventListener("duo:socket-connected",autoJoin,{once:true});

    showEntry();
})();
