(() => {
    const socket = window.socket;
    const zone = document.getElementById("aim-zone");
    const target = document.getElementById("aim-target");
    const placeholder = document.getElementById("aim-placeholder");
    const hitsNode = document.getElementById("aim-hits");
    const scoreNode = document.getElementById("aim-score");
    const message = document.getElementById("game-message");

    const totalTargets = 15;
    let hits = 0;
    let startedAt = 0;
    let active = false;

    function moveTarget() {
        const padding = 28;
        const width = zone.clientWidth;
        const height = zone.clientHeight;

        const x = padding + Math.random() * Math.max(1, width - padding * 2);
        const y = padding + Math.random() * Math.max(1, height - padding * 2);

        target.style.left = `${x}px`;
        target.style.top = `${y}px`;
    }

    function reset() {
        active = false;
        hits = 0;
        hitsNode.textContent = `0 / ${totalTargets}`;
        scoreNode.textContent = "0.00";
        target.hidden = true;
        zone.classList.add("game-disabled");
        placeholder.style.display = "flex";
        placeholder.textContent = "READY UP TO START";
        message.textContent = "";
    }

    window.addEventListener("duo:round-start", () => {
        reset();
        active = true;
        startedAt = performance.now();
        zone.classList.remove("game-disabled");
        placeholder.style.display = "none";
        target.hidden = false;
        moveTarget();
    });

    target.addEventListener("pointerdown", (event) => {
        if (!active) return;
        event.stopPropagation();

        hits++;
        hitsNode.textContent = `${hits} / ${totalTargets}`;

        const elapsedSeconds = Math.max((performance.now() - startedAt) / 1000, .001);
        const liveScore = hits / elapsedSeconds;
        scoreNode.textContent = liveScore.toFixed(2);

        if (hits >= totalTargets) {
            active = false;
            target.hidden = true;
            zone.classList.add("game-disabled");

            const score = Number((totalTargets / elapsedSeconds).toFixed(3));
            scoreNode.textContent = score.toFixed(3);
            message.textContent = `Submitted ${score.toFixed(3)} targets/s`;
            socket.emit("submit_score", { score });
            return;
        }

        moveTarget();
    });

    window.addEventListener("duo:round-result", (event) => {
        const r = event.detail;
        message.textContent = r.draw ? "DRAW" : `${r.winner.login} wins · score ${r.winner.score}`;
    });

    reset();
})();
