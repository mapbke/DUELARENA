(() => {
    const pill = document.getElementById("server-pill");
    const label = document.getElementById("server-label");
    function setStatus(mode,key){ if(!pill||!label)return; pill.classList.remove("online","offline"); if(mode)pill.classList.add(mode); label.textContent=window.DuoUI?.t(key)||key; label.dataset.statusKey=key; }
    const socket = io();
    window.socket = socket;
    window.DuoArena = window.DuoArena || {};
    window.DuoArena.socket = socket;
    window.DuoArena.user = null;
    setStatus("","server.connecting");
    socket.on("connect",()=>{setStatus("online","server.online");window.dispatchEvent(new CustomEvent("duo:socket-connected"));});
    socket.on("disconnect",()=>{setStatus("offline","server.offline");window.dispatchEvent(new CustomEvent("duo:socket-disconnected"));});
    socket.on("connect_error",error=>{setStatus("offline","server.offline");console.error("[Socket.IO]",error);});
    socket.on("auth_user",user=>{window.DuoArena.user=user;window.dispatchEvent(new CustomEvent("duo:user",{detail:user}));});
    window.addEventListener("duo:language-changed",()=>{const key=label?.dataset.statusKey;if(key&&label)label.textContent=window.DuoUI.t(key);});
})();
