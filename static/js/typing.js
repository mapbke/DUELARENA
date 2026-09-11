(() => {
    const socket = window.socket;
    const t = key => window.DuoUI?.t(key) || key;

    const board = document.getElementById("typing-progress-board");
    const target = document.getElementById("typing-target");
    const input = document.getElementById("typing-input");
    const wpmNode = document.getElementById("typing-wpm");
    const accuracyNode = document.getElementById("typing-accuracy");
    const progressNode = document.getElementById("typing-progress");
    const feedback = document.getElementById("game-feedback");

    let phrase = "";
    let token = null;
    let startedAt = 0;
    let submitted = false;
    let lastProgressSent = 0;
    let progressMap = {};

    function esc(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    function renderPhrase(value="") {
        target.innerHTML = "";

        for (let i = 0; i < phrase.length; i++) {
            const span = document.createElement("span");
            span.textContent = phrase[i];

            if (i < value.length) {
                span.className = value[i] === phrase[i]
                    ? "typing-char correct"
                    : "typing-char wrong";
            } else if (i === value.length) {
                span.className = "typing-char current";
            } else {
                span.className = "typing-char";
            }

            target.appendChild(span);
        }
    }

    function liveStats(value) {
        const minutes = Math.max((performance.now() - startedAt) / 60000, 1/60000);
        let correct = 0;

        for (let i = 0; i < Math.min(value.length, phrase.length); i++) {
            if (value[i] === phrase[i]) correct++;
        }

        return {
            wpm: (value.length / 5) / minutes,
            accuracy: correct / Math.max(phrase.length,1) * 100,
            progress: value.length / Math.max(phrase.length,1) * 100,
        };
    }

    function renderBoard(room) {
        const players = room?.players || [];

        board.innerHTML = players.map(player => {
            const progress = Number(progressMap[player.user_id] ?? player.public_meta?.progress ?? 0);
            return `
                <article class="typing-progress-card">
                    <header>
                        <strong>${esc(player.display_name)}</strong>
                        <span>${progress.toFixed(0)}%</span>
                    </header>
                    <div class="bar"><i style="width:${Math.max(0,Math.min(100,progress))}%"></i></div>
                </article>
            `;
        }).join("");
    }

    window.addEventListener("duo:room-state", event => renderBoard(event.detail));

    window.addEventListener("duo:round-start", event => {
        phrase = event.detail.phrase || "";
        token = event.detail.token;
        startedAt = performance.now();
        submitted = false;
        progressMap = {};

        input.value = "";
        input.maxLength = phrase.length;
        input.disabled = false;
        input.placeholder = t("typing.playPlaceholder");
        input.focus();

        wpmNode.textContent = "0";
        accuracyNode.textContent = "100%";
        progressNode.textContent = "0%";
        feedback.textContent = "";

        renderPhrase("");
    });

    input.addEventListener("paste", event => {
        event.preventDefault();
        feedback.textContent = window.DuoUI?.language === "ru" ? "Вставка отключена." : "Paste is disabled.";
    });

    input.addEventListener("input", () => {
        if (!token || submitted) return;

        const value = input.value.slice(0, phrase.length);
        if (value !== input.value) input.value = value;

        renderPhrase(value);

        const s = liveStats(value);
        wpmNode.textContent = Math.round(s.wpm);
        accuracyNode.textContent = `${s.accuracy.toFixed(0)}%`;
        progressNode.textContent = `${s.progress.toFixed(0)}%`;

        const now = performance.now();
        if (now - lastProgressSent > 160 || value.length === phrase.length) {
            lastProgressSent = now;
            socket.emit("typing_progress",{token,chars:value.length});
        }

        if (value.length >= phrase.length) {
            submitted = true;
            input.disabled = true;
            socket.emit("typing_finish",{token,text:value});
        }
    });

    socket.on("typing_progress", data => {
        progressMap[data.user_id] = data.progress;
        renderBoard(window.DuoRoom?.roomData);
    });

    socket.on("typing_player_result", data => {
        if (data.user_id === window.DuoArena?.user?.user_id) {
            feedback.textContent = `${data.meta.wpm.toFixed(1)} WPM · ${data.meta.accuracy.toFixed(1)}%`;
        }
    });

    window.addEventListener("duo:round-result", () => {
        token = null;
        input.disabled = true;
    });
})();
