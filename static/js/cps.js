(() => {
    const socket = window.socket;
    const button = document.getElementById("cps-button");
    const timeNode = document.getElementById("cps-time");
    const clicksNode = document.getElementById("cps-clicks");
    const rateNode = document.getElementById("cps-rate");
    const message = document.getElementById("game-message");

    const duration = 10000;
    let token = null;
    let active = false;
    let clicks = 0;
    let startedAt = 0;
    let raf = null;

    function reset() {
        token = null;
        active = false;
        clicks = 0;
        startedAt = 0;
        button.disabled = true;
        button.textContent = "ЖДЁМ РАУНД";
        timeNode.textContent = "10.0";
        clicksNode.textContent = "0";
        rateNode.textContent = "0.0";
        message.textContent = "";
        if (raf) cancelAnimationFrame(raf);
    }

    function finish() {
        if (!active) return;
        active = false;
        button.disabled = true;
        button.textContent = "РЕЗУЛЬТАТ ОТПРАВЛЕН";

        socket.emit("submit_score", {
            round_token: token,
            score: clicks,
        });
    }

    function tick() {
        if (!active) return;

        const elapsed = performance.now() - startedAt;
        const left = Math.max(0, duration - elapsed);
        timeNode.textContent = (left / 1000).toFixed(1);

        const seconds = Math.max(elapsed / 1000, .001);
        rateNode.textContent = (clicks / seconds).toFixed(1);

        if (left <= 0) {
            finish();
            return;
        }

        raf = requestAnimationFrame(tick);
    }

    window.addEventListener("duo:round-start", (event) => {
        reset();
        token = event.detail.round_token;
        active = true;
        startedAt = performance.now();
        button.disabled = false;
        button.textContent = "КЛИКАЙ";
        raf = requestAnimationFrame(tick);
    });

    button.addEventListener("pointerdown", (event) => {
        if (!active) return;
        event.preventDefault();
        clicks++;
        clicksNode.textContent = String(clicks);
    });

    window.addEventListener("duo:round-result", (event) => {
        const result = event.detail;
        message.textContent = result.draw
            ? "Ничья."
            : `${result.winner.login} побеждает: ${result.winner.score} кликов.`;
        token = null;
    });

    reset();
})();
