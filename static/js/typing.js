(() => {
    const socket = window.socket;
    const textNode = document.getElementById("typing-text");
    const input = document.getElementById("typing-input");
    const wpmNode = document.getElementById("typing-wpm");
    const accuracyNode = document.getElementById("typing-accuracy");
    const message = document.getElementById("game-message");

    const phrase = "The only way to do great work is to love what you do. Keep looking until the work feels like yours.";
    textNode.textContent = phrase;

    let token = null;
    let startedAt = 0;
    let submitted = false;

    function reset() {
        token = null;
        startedAt = 0;
        submitted = false;
        input.value = "";
        input.disabled = true;
        input.placeholder = "Раунд ещё не начался";
        wpmNode.textContent = "0 WPM";
        accuracyNode.textContent = "100%";
        message.textContent = "";
    }

    function getAccuracy(value) {
        if (!value.length) return 100;
        let correct = 0;
        for (let i = 0; i < value.length; i++) {
            if (value[i] === phrase[i]) correct++;
        }
        return (correct / value.length) * 100;
    }

    window.addEventListener("duo:round-start", (event) => {
        reset();
        token = event.detail.round_token;
        startedAt = performance.now();
        input.disabled = false;
        input.placeholder = "Печатайте текст выше...";
        input.focus();
    });

    input.addEventListener("input", () => {
        if (!token || submitted) return;

        const value = input.value;
        const elapsedMin = Math.max((performance.now() - startedAt) / 60000, 1 / 60000);
        const words = value.trim() ? value.trim().split(/\s+/).length : 0;
        const liveWpm = words / elapsedMin;

        wpmNode.textContent = `${Math.round(liveWpm)} WPM`;
        accuracyNode.textContent = `${getAccuracy(value).toFixed(0)}%`;

        if (value === phrase) {
            submitted = true;
            input.disabled = true;

            const totalWords = phrase.trim().split(/\s+/).length;
            const finalWpm = totalWords / elapsedMin;
            message.textContent = `Готово: ${finalWpm.toFixed(1)} WPM`;

            socket.emit("submit_score", {
                round_token: token,
                score: Number(finalWpm.toFixed(2)),
            });
        }
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
