(() => {
    const socket = window.socket;
    const display = document.getElementById("blind-display");
    const stopButton = document.getElementById("blind-stop");
    const resultNode = document.getElementById("blind-result");
    const differenceNode = document.getElementById("blind-difference");
    const message = document.getElementById("game-message");

    let active = false;
    let startedAt = 0;
    let hideTimer = null;

    function reset() {
        active = false;
        startedAt = 0;
        display.textContent = "WAITING";
        stopButton.disabled = true;
        stopButton.textContent = "READY UP";
        resultNode.textContent = "—";
        differenceNode.textContent = "—";
        message.textContent = "";
        if (hideTimer) clearTimeout(hideTimer);
    }

    window.addEventListener("duo:round-start", () => {
        reset();
        active = true;
        startedAt = performance.now();

        display.textContent = "0.000s";
        stopButton.disabled = false;
        stopButton.textContent = "STOP";

        hideTimer = setTimeout(() => {
            if (active) display.textContent = "[ BLIND MODE ]";
        }, 900);
    });

    stopButton.addEventListener("click", () => {
        if (!active) return;

        active = false;
        stopButton.disabled = true;
        stopButton.textContent = "SUBMITTED";

        const elapsedMs = performance.now() - startedAt;
        const differenceMs = Math.abs(5000 - elapsedMs);

        display.textContent = `${(elapsedMs / 1000).toFixed(3)}s`;
        resultNode.textContent = `${(elapsedMs / 1000).toFixed(3)}s`;
        differenceNode.textContent = `${(differenceMs / 1000).toFixed(3)}s`;

        // Backend uses "min" for blind: lower absolute error wins.
        socket.emit("submit_score", {
            score: Number(differenceMs.toFixed(2))
        });
    });

    window.addEventListener("duo:round-result", (event) => {
        const r = event.detail;
        message.textContent = r.draw
            ? "DRAW"
            : `${r.winner.login} wins · error ${(r.winner.score / 1000).toFixed(3)}s`;
    });

    reset();
})();
