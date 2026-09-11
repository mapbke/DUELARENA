(() => {
    const socket = window.socket;
    const t = key => window.DuoUI?.t(key) || key;

    const timeNode = document.getElementById("cps-time");
    const zone = document.getElementById("cps-zone");
    const main = document.getElementById("cps-main");
    const countBig = document.getElementById("cps-count");
    const clicksNode = document.getElementById("cps-clicks");
    const rateNode = document.getElementById("cps-rate");

    let token = null;
    let startedAt = 0;
    let duration = 10;
    let clicks = 0;
    let active = false;
    let raf = null;

    function tick() {
        if (!active) return;

        const elapsed = (performance.now() - startedAt) / 1000;
        const left = Math.max(0, duration - elapsed);

        timeNode.textContent = left.toFixed(1);
        rateNode.textContent = (clicks / Math.max(elapsed,.001)).toFixed(1);

        if (left <= 0) {
            active = false;
            zone.disabled = true;
            main.textContent = t("reaction.sent");
            return;
        }

        raf = requestAnimationFrame(tick);
    }

    window.addEventListener("duo:round-start", event => {
        token = event.detail.token;
        duration = Number(event.detail.duration || 10);
        startedAt = performance.now();
        clicks = 0;
        active = true;

        timeNode.textContent = duration.toFixed(1);
        countBig.textContent = "0";
        clicksNode.textContent = "0";
        rateNode.textContent = "0.0";
        zone.disabled = false;
        main.textContent = t("cps.click");

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    });

    zone.addEventListener("pointerdown", event => {
        if (!active || !token) return;

        event.preventDefault();
        clicks++;
        countBig.textContent = clicks;
        clicksNode.textContent = clicks;
        socket.emit("cps_click",{token});
    });

    window.addEventListener("duo:round-result", () => {
        token = null;
        active = false;
        zone.disabled = true;
        if (raf) cancelAnimationFrame(raf);
    });
})();
