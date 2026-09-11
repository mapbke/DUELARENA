(() => {
    const socket = window.socket;
    const t = key => window.DuoUI?.t(key) || key;

    const zone = document.getElementById("reaction-zone");
    const main = document.getElementById("reaction-main");
    const sub = document.getElementById("reaction-sub");
    const feedback = document.getElementById("game-feedback");
    const nameA = document.getElementById("reaction-name-a");
    const nameB = document.getElementById("reaction-name-b");
    const scoreA = document.getElementById("reaction-score-a");
    const scoreB = document.getElementById("reaction-score-b");

    let token = null;
    let sent = false;

    window.addEventListener("duo:room-state", event => {
        const players = event.detail.players || [];
        nameA.textContent = players[0]?.display_name?.toUpperCase() || "PLAYER 1";
        nameB.textContent = players[1]?.display_name?.toUpperCase() || "PLAYER 2";
    });

    window.addEventListener("duo:round-start", event => {
        token = event.detail.token;
        sent = false;
        scoreA.textContent = "—";
        scoreB.textContent = "—";
        feedback.textContent = "";
        zone.disabled = false;
        zone.className = "reaction-zone wait";
        main.textContent = t("reaction.wait");
        sub.textContent = t("reaction.falseHint");
    });

    socket.on("reaction_go", data => {
        if (data.token !== token) return;
        zone.className = "reaction-zone go";
        main.textContent = t("reaction.go");
        sub.textContent = "";
    });

    zone.addEventListener("pointerdown", event => {
        event.preventDefault();
        if (!token || sent) return;
        sent = true;
        zone.disabled = true;
        main.textContent = t("reaction.sent");
        socket.emit("reaction_click",{token});
    });

    socket.on("reaction_player_result", data => {
        feedback.textContent = data.false_start
            ? `${data.display_name}: ${t("reaction.false")}`
            : `${data.display_name}: ${Number(data.score).toFixed(2)} ms`;

        if (data.user_id === window.DuoArena?.user?.user_id && data.false_start) {
            zone.className = "reaction-zone false";
            main.textContent = t("reaction.false");
        }
    });

    window.addEventListener("duo:round-cancelled", () => {
        token = null; sent = false; zone.disabled = true;
        zone.className = "reaction-zone";
        main.textContent = t("reaction.waiting"); sub.textContent = t("reaction.hint");
    });
    window.addEventListener("duo:round-result", event => {
        const players = event.detail.players || [];

        if (players[0]) {
            scoreA.textContent = players[0].meta?.false_start ? "FS" : `${Number(players[0].score).toFixed(0)}ms`;
        }

        if (players[1]) {
            scoreB.textContent = players[1].meta?.false_start ? "FS" : `${Number(players[1].score).toFixed(0)}ms`;
        }

        token = null;
        sent = false;
        zone.disabled = true;
        zone.className = "reaction-zone";
        main.textContent = t("reaction.waiting");
        sub.textContent = t("reaction.hint");
    });
    zone.addEventListener("click", event => {
        if (event.detail === 0) zone.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}));
    });
})();
