(() => {
    const socket = window.socket;
    const area = document.getElementById("reaction-area");
    const status = document.getElementById("reaction-status");
    const message = document.getElementById("game-message");
    const leftName = document.getElementById("reaction-name-left");
    const rightName = document.getElementById("reaction-name-right");
    const leftScore = document.getElementById("reaction-score-left");
    const rightScore = document.getElementById("reaction-score-right");

    let clickable = false;
    let roundActive = false;

    window.addEventListener("duo:room-state", (event) => {
        const players = event.detail.players || [];
        leftName.textContent = players[0]?.login?.toUpperCase() || "PLAYER 1";
        rightName.textContent = players[1]?.login?.toUpperCase() || "PLAYER 2";
    });

    window.addEventListener("duo:all-ready", () => {
        roundActive = true;
        clickable = false;
        area.className = "reaction-zone waiting";
        status.textContent = "WAIT FOR GREEN...";
        message.textContent = "";
        leftScore.textContent = "—";
        rightScore.textContent = "—";
    });

    window.addEventListener("duo:reaction-go", () => {
        clickable = true;
        area.className = "reaction-zone go";
        status.textContent = "CLICK!";
    });

    area.addEventListener("pointerdown", () => {
        if (!roundActive) return;

        // The server decides whether this is a valid click or a false start.
        socket.emit("reaction_click");
        roundActive = false;
        clickable = false;
        status.textContent = "SENT";
    });

    socket.on("false_start", (data) => {
        area.className = "reaction-zone false-start";
        message.textContent = `${data.player.login}: FALSE START`;
    });

    socket.on("reaction_result", (data) => {
        message.textContent = `${data.player.login}: ${data.milliseconds.toFixed(2)} ms`;
    });

    window.addEventListener("duo:round-result", (event) => {
        const result = event.detail;
        const room = window.DuoRoom?.roomState;
        const players = room?.players || [];

        if (players[0]) {
            leftScore.textContent = result.scores[String(players[0].github_id)] ?? "—";
        }
        if (players[1]) {
            rightScore.textContent = result.scores[String(players[1].github_id)] ?? "—";
        }

        status.textContent = result.draw ? "DRAW" : `${result.winner.login.toUpperCase()} WINS`;
    });
})();
