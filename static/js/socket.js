(() => {
    const pill = document.getElementById("connection-pill");
    const label = document.getElementById("connection-label");

    const socket = io({
        transports:["websocket","polling"],
        reconnection:true,
        reconnectionAttempts:Infinity,
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
        console.error("[DuoArena socket]",error);
        status("offline","server.offline");
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
