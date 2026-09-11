(() => {
    const pill = document.getElementById("server-pill");
    const label = document.getElementById("server-label");

    function status(mode, text) {
        if (!pill || !label) return;
        pill.classList.remove("online", "offline");
        if (mode) pill.classList.add(mode);
        label.textContent = text;
    }

    status("", "подключение...");

    const socket = io();
    window.socket = socket;
    window.DuoArena = window.DuoArena || {};
    window.DuoArena.socket = socket;

    socket.on("connect", () => {
        status("online", "сервер подключён");
        window.dispatchEvent(new CustomEvent("duo:socket-connected"));
    });

    socket.on("disconnect", () => {
        status("offline", "нет соединения");
        window.dispatchEvent(new CustomEvent("duo:socket-disconnected"));
    });

    socket.on("connect_error", (error) => {
        status("offline", "ошибка соединения");
        console.error("[Socket.IO]", error);
    });
})();
