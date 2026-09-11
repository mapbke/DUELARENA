const readyButton = document.getElementById("ready-button");
const reactionArea = document.getElementById("reaction-area");
const statusText = document.getElementById("status");

const params = new URLSearchParams(window.location.search);

let playerName = params.get("player");

if (!playerName) {
    playerName = localStorage.getItem("duoarena_player");
}

if (!playerName) {
    playerName = prompt("Player name:");

    if (!playerName) {
        playerName = "Unknown";
    }

    localStorage.setItem("duoarena_player", playerName);
}

console.log(`[DuoArena] Player: ${playerName}`);

readyButton.addEventListener("click", () => {
    socket.emit("player_ready", {
        player: playerName
    });

    readyButton.disabled = true;
    readyButton.textContent = "READY ✓";

    reactionArea.textContent = "READY";

    statusText.textContent = "Waiting for opponent...";
});

socket.on("player_ready", (data) => {
    console.log(`[READY] ${data.player}`);

    if (data.player === playerName) {
        statusText.textContent = "You are ready. Waiting for opponent...";
    } else {
        statusText.textContent = `${data.player} is ready`;
    }
});