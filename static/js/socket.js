(() => {
    const pill = document.getElementById("connection-pill");
    const label = document.getElementById("connection-label");

    const socket = io({
        transports:["polling","websocket"],
        upgrade:true,
        reconnection:true,
        reconnectionAttempts:12,
        reconnectionDelay:700,
        reconnectionDelayMax:3500,
    });

    window.socket = socket;
    window.DuoArena = window.DuoArena || {};
    window.DuoArena.socket = socket;
    window.DuoArena.user = null;

    function status(mode,key) {
        if (!pill || !label) return;
        pill.classList.remove("online","offline");
        if (mode) pill.classList.add(mode);
        label.dataset.key = key;
        label.textContent = window.DuoUI?.t(key) || key;
    }

    socket.on("connect",() => {
        status("online","server.online");
        window.dispatchEvent(new CustomEvent("duo:socket-connected"));
    });

    socket.on("disconnect",() => {
        status("offline","server.offline");
        window.dispatchEvent(new CustomEvent("duo:socket-disconnected"));
    });

    socket.on("connect_error",error => {
        // Connection state is surfaced in the UI.
        status("offline","server.offline");
    });

    socket.io.on("reconnect_failed", () => {
        status("offline","server.offline");
        window.dispatchEvent(new CustomEvent("duo:reconnect-failed"));
    });

    socket.on("auth_user",user => {
        window.DuoArena.user = user;
        window.dispatchEvent(new CustomEvent("duo:user",{detail:user}));
    });

    window.addEventListener("duo:language",() => {
        if (label?.dataset.key) label.textContent = window.DuoUI.t(label.dataset.key);
    });

    status("","server.connecting");
})();
