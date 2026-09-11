(() => {
    const socket = window.socket;
    const input = document.getElementById("typing-input");
    const display = document.getElementById("typing-text");
    const wpmNode = document.getElementById("typing-wpm");
    const accuracyNode = document.getElementById("typing-accuracy");
    const message = document.getElementById("game-message");

    const phrase = "The only way to do great work is to love what you do. Keep looking until the work feels like yours.";
    let startedAt = null;
    let submitted = false;

    display.textContent = phrase;

    function reset() {
        input.value = "";
        input.disabled = true;
        input.placeholder = "Ready up first...";
        wpmNode.textContent = "0 WPM";
        accuracyNode.textContent = "100%";
        startedAt = null;
        submitted = false;
        message.textContent = "";
    }

    function accuracy(value) {
        let correct = 0;
        for (let i = 0; i < value.length; i++) {
            if (value[i] === phrase[i]) correct++;
        }
        return value.length ? (correct / value.length) * 100 : 100;
    }

    window.addEventListener("duo:round-start", () => {
        reset();
        input.disabled = false;
        input.placeholder = "Type...";
        input.focus();
        startedAt = performance.now();
    });

    input.addEventListener("input", () => {
        if (!startedAt || submitted) return;

        const value = input.value;
        const elapsedMinutes = Math.max((performance.now() - startedAt) / 60000, 1 / 60000);
        const words = value.trim() ? value.trim().split(/\s+/).length : 0;
        const wpm = Math.round(words / elapsedMinutes);
        const acc = accuracy(value);

        wpmNode.textContent = `${wpm} WPM`;
        accuracyNode.textContent = `${acc.toFixed(0)}%`;

        if (value === phrase) {
            submitted = true;
            input.disabled = true;

            const finalElapsed = (performance.now() - startedAt) / 60000;
            const finalWords = phrase.trim().split(/\s+/).length;
            const finalWpm = finalWords / finalElapsed;

            message.textContent = `Submitted ${finalWpm.toFixed(1)} WPM`;
            socket.emit("submit_score", { score: Number(finalWpm.toFixed(2)) });
        }
    });

    window.addEventListener("duo:round-result", (event) => {
        const r = event.detail;
        message.textContent = r.draw ? "DRAW" : `${r.winner.login} wins this typing round`;
    });

    reset();
})();
