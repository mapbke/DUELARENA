(() => {
    const socket = window.socket;
    const pad = document.getElementById("reaction-pad");
    const status = document.getElementById("reaction-status");
    const substatus = document.getElementById("reaction-substatus");
    const message = document.getElementById("game-message");

    const leftName = document.getElementById("reaction-name-left");
    const rightName = document.getElementById("reaction-name-right");
    const leftScore = document.getElementById("reaction-score-left");
    const rightScore = document.getElementById("reaction-score-right");

    let activeToken = null;
    let clickSent = false;

    window.addEventListener("duo:room-state", (event) => {
        const players = event.detail.players || [];
        leftName.textContent = players[0]?.login?.toUpperCase() || "PLAYER 1";
        rightName.textContent = players[1]?.login?.toUpperCase() || "PLAYER 2";
    });

    window.addEventListener("duo:round-prepare", (event) => {
        activeToken = event.detail.round_token;
        clickSent = false;

        leftScore.textContent = "—";
        rightScore.textContent = "—";
        message.textContent = "";

        pad.disabled = false;
        pad.className = "reaction-pad wait";
        status.textContent = "ЖДИТЕ...";
        substatus.textContent = "Клик до зелёного = фальстарт.";
    });

    window.addEventListener("duo:reaction-go", (event) => {
        if (event.detail.round_token !== activeToken) return;

        pad.className = "reaction-pad go";
        status.textContent = "КЛИКАЙ!";
        substatus.textContent = "Сейчас.";
    });

    pad.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (!activeToken || clickSent) return;

        clickSent = true;
        pad.disabled = true;
        status.textContent = "РЕЗУЛЬТАТ ОТПРАВЛЕН";

        socket.emit("reaction_click", {
            round_token: activeToken,
        });
    });

    socket.on("false_start", (data) => {
        if (data.player.login === window.DuoArena?.user?.login) {
            pad.className = "reaction-pad false-start";
            status.textContent = "ФАЛЬСТАРТ";
        }
        message.textContent = `${data.player.login}: фальстарт`;
    });

    socket.on("reaction_result", (data) => {
        message.textContent = `${data.player.login}: ${Number(data.milliseconds).toFixed(2)} ms`;
    });

    window.addEventListener("duo:round-result", (event) => {
        const result = event.detail;
        const players = window.DuoRoom?.roomState?.players || [];

        if (players[0]) {
            const score = result.scores[String(players[0].github_id)];
            leftScore.textContent = score >= 999999 ? "FS" : `${Number(score).toFixed(0)}ms`;
        }
        if (players[1]) {
            const score = result.scores[String(players[1].github_id)];
            rightScore.textContent = score >= 999999 ? "FS" : `${Number(score).toFixed(0)}ms`;
        }

        activeToken = null;
        clickSent = false;
        pad.disabled = true;
        pad.className = "reaction-pad";
        status.textContent = result.draw
            ? "НИЧЬЯ"
            : `${result.winner.login.toUpperCase()} ПОБЕДИЛ`;
        substatus.textContent = "Нажмите «Ещё раунд», когда будете готовы.";
    });
})();
