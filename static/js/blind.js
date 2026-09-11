(() => {
    const socket = window.socket;
    const t = key => window.DuoUI?.t(key) || key;

    const clock = document.getElementById("blind-clock");
    const button = document.getElementById("blind-stop");
    const feedback = document.getElementById("game-feedback");

    let token = null;
    let startedAt = 0;
    let active = false;
    let raf = null;
    let hideTimer = null;

    function tick() {
        if (!active) return;
        clock.textContent = `${((performance.now()-startedAt)/1000).toFixed(3)}s`;
        raf = requestAnimationFrame(tick);
    }

    window.addEventListener("duo:round-start", event => {
        token = event.detail.token;
        startedAt = performance.now();
        active = true;

        clock.textContent = "0.000s";
        button.disabled = false;
        button.textContent = t("blind.stop");
        feedback.textContent = "";

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);

        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            if (!active) return;
            if (raf) cancelAnimationFrame(raf);
            clock.textContent = "[ BLIND ]";
        },900);
    });

    button.addEventListener("click", () => {
        if (!active || !token) return;

        active = false;
        button.disabled = true;

        if (raf) cancelAnimationFrame(raf);
        clearTimeout(hideTimer);

        const localSeconds = (performance.now()-startedAt)/1000;
        clock.textContent = `${localSeconds.toFixed(3)}s`;
        socket.emit("blind_stop",{token});
    });

    socket.on("blind_player_result", data => {
        if (data.user_id === window.DuoArena?.user?.user_id) {
            feedback.textContent = `${data.meta.seconds.toFixed(3)}s · error ${(data.meta.error_ms/1000).toFixed(3)}s`;
        }
    });

    window.addEventListener("duo:round-result", () => {
        token = null;
        active = false;
        button.disabled = true;
        if (raf) cancelAnimationFrame(raf);
        clearTimeout(hideTimer);
    });
})();
