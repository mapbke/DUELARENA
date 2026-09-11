const socket = io();

socket.on("connect", () => {
    console.log(`[Socket.IO] Connected: ${socket.id}`);
});

socket.on("disconnect", () => {
    console.log("[Socket.IO] Disconnected");
});