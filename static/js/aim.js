(() => {
    const socket = window.socket;
    const zone = document.getElementById("aim-zone");
    const placeholder = document.getElementById("aim-placeholder");
    const target = document.getElementById("aim-target");
    const hitsNode = document.getElementById("aim-hits");
    const scoreNode = document.getElementById("aim-score");
    const message = document.getElementById("game-message");

    const targetCount = 15;
    let token = null;
    let active = false;
    let hits = 0;
    let startedAt = 0;

    function moveTarget() {
        const padding = 28;
        const x = padding + Math.random() * Math.max(1, zone.clientWidth - padding * 2);
        const y = padding + Math.random() * Math.max(1, zone.clientHeight - padding * 2);

        target.style.left = `${x}px`;
        target.style.top = `${y}px`;
    }

    function reset() {
        token = null;
        active = false;
        hits = 0;
        startedAt = 0;
        target.hidden = true;
        placeholder.style.display = "grid";
        placeholder.textContent = "ЖДЁМ РАУНД";
        hitsNode.textContent = `0 / ${targetCount}`;
        scoreNode.textContent = "0.00";
        message.textContent = "";
    }

    window.addEventListener("duo:round-start", (event) => {
        reset();
        token = event.detail.round_token;
        active = true;
        startedAt = performance.now();
        placeholder.style.display = "none";
        target.hidden = false;
        moveTarget();
    });

    target.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!active) return;

        hits++;
        const elapsedSec = Math.max((performance.now() - startedAt) / 1000, .001);
        const liveScore = hits / elapsedSec;

        hitsNode.textContent = `${hits} / ${targetCount}`;
        scoreNode.textContent = liveScore.toFixed(2);

        if (hits >= targetCount) {
            active = false;
            target.hidden = true;

            const finalScore = Number((targetCount / elapsedSec).toFixed(3));
            scoreNode.textContent = finalScore.toFixed(3);
            message.textContent = `Готово: ${finalScore.toFixed(3)} целей/сек.`;

            socket.emit("submit_score", {
                round_token: token,
                score: finalScore,
            });
            return;
        }

        moveTarget();
    });

    window.addEventListener("duo:round-result", (event) => {
        const result = event.detail;
        message.textContent = result.draw
            ? "Ничья."
            : `${result.winner.login} побеждает.`;
        token = null;
    });

    reset();
})();
