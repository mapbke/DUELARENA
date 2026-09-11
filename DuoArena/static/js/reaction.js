const readyButton = document.getElementById("ready-button");
const reactionArea = document.getElementById("reaction-area");
const statusText = document.getElementById("status");

readyButton.addEventListener("click", () => {

    socket.emit("player_ready", {
        player: "Nikita"
    });

    readyButton.disabled = true;
    readyButton.textContent = "READY ✓";

    statusText.textContent = "Waiting for opponent...";
});


socket.on("player_ready", (data) => {

    console.log("Player ready:", data);

});
