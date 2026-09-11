(() => {
    const socket = window.socket;

    const targetZone = document.getElementById("aim-zone");
    const target = document.getElementById("aim-target");
    const hitsNode = document.getElementById("aim-hits");
    const timeNode = document.getElementById("aim-time");

    let token = null;
    let targets = [];
    let index = 0;
    let startedAt = 0;
    let active = false;
    let raf = null;

    function place() {
        const point = targets[index];

        if (!point) {
            target.classList.add("hidden");
            return;
        }

        target.style.left = `${point.x * 100}%`;
        target.style.top = `${point.y * 100}%`;
        target.classList.remove("hidden");
    }

    function tick() {
        if (!active) return;
        timeNode.textContent = `${((performance.now()-startedAt)/1000).toFixed(2)}s`;
        raf = requestAnimationFrame(tick);
    }

    window.addEventListener("duo:round-start", event => {
        token = event.detail.token;
        targets = event.detail.targets || [];
        index = 0;
        active = true;
        startedAt = performance.now();

        hitsNode.textContent = `0 / ${targets.length}`;
        timeNode.textContent = "0.00s";

        place();

        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(tick);
    });

    target.addEventListener("pointerdown", event => {
        if (!active || !token) return;

        event.preventDefault();
        event.stopPropagation();

        socket.emit("aim_hit",{token,index});
        index++;
        hitsNode.textContent = `${index} / ${targets.length}`;

        if (index >= targets.length) {
            active = false;
            target.classList.add("hidden");
            if (raf) cancelAnimationFrame(raf);
            return;
        }

        place();
    });

    window.addEventListener("duo:round-cancelled", () => {
        token = null;
        active = false;
        target.classList.add("hidden");
        if (raf) cancelAnimationFrame(raf);
    });
    window.addEventListener("duo:round-result", () => {
        token = null;
        active = false;
        target.classList.add("hidden");
        if (raf) cancelAnimationFrame(raf);
    });
    target.addEventListener("click", event => {
        if (event.detail === 0) target.dispatchEvent(new PointerEvent("pointerdown", {bubbles:true}));
    });
})();
