(() => {
    const socket = window.socket;
    const button = document.getElementById("cps-button");
    const timeNode = document.getElementById("cps-time");
    const clicksNode = document.getElementById("cps-clicks");
    const rateNode = document.getElementById("cps-rate");
    const message = document.getElementById("game-message");

    const duration = 10_000;
    let active = false;
    let clicks = 0;
    let startedAt = 0;
    let raf = null;

    function reset() {
        active = false;
        clicks = 0;
        startedAt = 0;
        button.disabled = true;
        button.textContent = "READY UP";
        clicksNode.textContent = "0";
        rateNode.textContent = "0.0";
        timeNode.textContent = "10.0s";
        message.textContent = "";
        if (raf) cancelAnimationFrame(raf);
    }

    function tick() {
        if (!active) return;

        const elapsed = performance.now() - startedAt;
        const left = Math.max(0, duration - elapsed);
        const seconds = Math.max(elapsed / 1000, .001);

        timeNode.textContent = `${(left / 1000).toFixed(1)}s`;
        rateNode.textContent = (clicks / seconds).toFixed(1);

        if (left <= 0) {
            active = false;
            button.disabled = true;
            button.textContent = "SUBMITTED";

            const score = clicks;
            message.textContent = `${clicks} clicks submitted`;
            socket.emit("submit_score", { score });
            return;
        }

        raf = requestAnimationFrame(tick);
    }

    window.addEventListener("duo:round-start", () => {
        reset();
        active = true;
        startedAt = performance.now();
        button.disabled = false;
        button.textContent = "CLICK!";
        raf = requestAnimationFrame(tick);
    });

    button.addEventListener("pointerdown", (event) => {
        if (!active) return;
        event.preventDefault();
        clicks++;
        clicksNode.textContent = String(clicks);
    });

    window.addEventListener("duo:round-result", (event) => {
        const r = event.detail;
        message.textContent = r.draw ? "DRAW" : `${r.winner.login} wins with ${r.winner.score} clicks`;
    });

    reset();
})();
