(() => {
    const socket = window.socket;
    const modal = document.getElementById("challenge-modal");
    const title = document.getElementById("challenge-title");
    const text = document.getElementById("challenge-text");
    const accept = document.getElementById("challenge-accept");
    const decline = document.getElementById("challenge-decline");

    if (!socket || !modal) return;

    let pending = null;

    const gamePath = {
        reaction: "/reaction",
        typing: "/typing",
        cps: "/cps",
        aim: "/aim",
        blind: "/blind"
    };

    socket.on("incoming_challenge", (data) => {
        pending = data;
        title.textContent = `${data.from.login} challenges you`;
        text.textContent = `${data.game.toUpperCase()} · room ${data.room}`;
        modal.classList.add("show");
    });

    accept.addEventListener("click", () => {
        if (!pending) return;

        socket.emit("challenge_response", {
            room: pending.room,
            accepted: true
        });

        const next = gamePath[pending.game] || "/reaction";
        const room = encodeURIComponent(pending.room);

        // Give the accept event a moment to reach the server. The new page will
        // reconnect and join the same room again by query string.
        setTimeout(() => {
            window.location.href = `${next}?room=${room}`;
        }, 180);
    });

    decline.addEventListener("click", () => {
        if (pending) {
            socket.emit("challenge_response", {
                room: pending.room,
                accepted: false
            });
        }
        pending = null;
        modal.classList.remove("show");
    });
})();
