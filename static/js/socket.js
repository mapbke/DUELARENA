(() => {
    const socket = io({
        transports: ["websocket", "polling"]
    });

    window.socket = socket;
    window.DuoArena = window.DuoArena || {};
    window.DuoArena.socket = socket;
    window.DuoArena.user = null;

    async function loadMe() {
        try {
            const response = await fetch("/api/me", {
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) return null;

            const data = await response.json();
            window.DuoArena.user = data.user;
            window.dispatchEvent(new CustomEvent("duo:user", { detail: data.user }));
            return data.user;
        } catch (error) {
            console.error("[DuoArena] /api/me failed", error);
            return null;
        }
    }

    socket.on("connect", () => {
        console.log("[Socket.IO] connected", socket.id);
        loadMe();
        window.dispatchEvent(new CustomEvent("duo:socket-connect"));
    });

    socket.on("disconnect", (reason) => {
        console.log("[Socket.IO] disconnected", reason);
        window.dispatchEvent(new CustomEvent("duo:socket-disconnect", { detail: reason }));
    });

    socket.on("connect_error", (error) => {
        console.error("[Socket.IO] connect error", error.message);
    });
})();
