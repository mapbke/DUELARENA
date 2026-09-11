(() => {
    const socket = window.socket;
    const display = document.getElementById("blind-display");
    const stopButton = document.getElementById("blind-stop");
    const resultNode = document.getElementById("blind-result");
    const differenceNode = document.getElementById("blind-difference");
    const message = document.getElementById("game-message");

    let token = null;
    let active = false;
    let startedAt = 0;
    let hideTimer = null;
    let raf = null;

    function reset() {
        token = null;
        active = false;
        startedAt = 0;
        display.textContent = "WAITING";
        stopButton.disabled = true;
        stopButton.textContent = "ЖДЁМ РАУНД";
        resultNode.textContent = "—";
        differenceNode.textContent = "—";
        message.textContent = "";
        if (hideTimer) clearTimeout(hideTimer);
        if (raf) cancelAnimationFrame(raf);
    }

    function animateVisibleTimer() {
        if (!active) return;
        const elapsed = performance.now() - startedAt;
        display.textContent = `${(elapsed / 1000).toFixed(3)}s`;
        raf = requestAnimationFrame(animateVisibleTimer);
    }

    window.addEventListener("duo:round-start", (event) => {
        reset();
        token = event.detail.round_token;
        active = true;
        startedAt = performance.now();

        stopButton.disabled = false;
        stopButton.textContent = "СТОП";
        animateVisibleTimer();

        hideTimer = setTimeout(() => {
            if (!active) return;
            if (raf) cancelAnimationFrame(raf);
            display.textContent = "[ BLIND MODE ]";
        }, 900);
    });

    stopButton.addEventListener("click", () => {
        if (!active) return;

        active = false;
        stopButton.disabled = true;
        stopButton.textContent = "РЕЗУЛЬТАТ ОТПРАВЛЕН";

        if (raf) cancelAnimationFrame(raf);
        if (hideTimer) clearTimeout(hideTimer);

        const elapsedMs = performance.now() - startedAt;
        const differenceMs = Math.abs(5000 - elapsedMs);

        display.textContent = `${(elapsedMs / 1000).toFixed(3)}s`;
        resultNode.textContent = `${(elapsedMs / 1000).toFixed(3)}s`;
        differenceNode.textContent = `${(differenceMs / 1000).toFixed(3)}s`;

        socket.emit("submit_score", {
            round_token: token,
            score: Number(differenceMs.toFixed(2)),
        });
    });

    window.addEventListener("duo:round-result", (event) => {
        const result = event.detail;
        message.textContent = result.draw
            ? "Ничья."
            : `${result.winner.login} побеждает с ошибкой ${(result.winner.score / 1000).toFixed(3)}s.`;
        token = null;
    });

    reset();
})();
