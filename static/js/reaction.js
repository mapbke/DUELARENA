(() => {
    const socket=window.socket,t=(k,v)=>window.DuoUI?.t(k,v)||k;
    const pad=document.getElementById("reaction-pad"),status=document.getElementById("reaction-status"),sub=document.getElementById("reaction-substatus"),message=document.getElementById("game-message"),leftName=document.getElementById("reaction-name-left"),rightName=document.getElementById("reaction-name-right"),leftScore=document.getElementById("reaction-score-left"),rightScore=document.getElementById("reaction-score-right");
    let token=null,clickSent=false;
    window.addEventListener("duo:room-state",e=>{const p=e.detail.players||[];leftName.textContent=p[0]?.display_name?.toUpperCase()||"PLAYER 1";rightName.textContent=p[1]?.display_name?.toUpperCase()||"PLAYER 2";});
    window.addEventListener("duo:round-prepare",e=>{token=e.detail.round_token;clickSent=false;leftScore.textContent="—";rightScore.textContent="—";message.textContent="";pad.disabled=false;pad.className="reaction-pad wait";status.textContent=t("reaction.wait");sub.textContent=t("reaction.falseStartHint");});
    window.addEventListener("duo:reaction-go",e=>{if(e.detail.round_token!==token)return;pad.className="reaction-pad go";status.textContent=t("reaction.click");sub.textContent=t("reaction.now");});
    pad.addEventListener("pointerdown",e=>{e.preventDefault();if(!token||clickSent)return;clickSent=true;pad.disabled=true;status.textContent=t("reaction.sent");socket.emit("reaction_click",{round_token:token});});
    socket.on("false_start",data=>{if(data.player.user_id===window.DuoArena?.user?.user_id){pad.className="reaction-pad false-start";status.textContent=t("reaction.falseStart");}message.textContent=`${data.player.display_name}: ${t("reaction.falseStart")}`;});
    socket.on("reaction_result",data=>{message.textContent=`${data.player.display_name}: ${Number(data.milliseconds).toFixed(2)} ms`;});
    window.addEventListener("duo:round-result",e=>{const r=e.detail,p=window.DuoRoom?.roomState?.players||[];if(p[0]){const s=r.scores[String(p[0].user_id)];leftScore.textContent=s>=999999?"FS":`${Number(s).toFixed(0)}ms`;}if(p[1]){const s=r.scores[String(p[1].user_id)];rightScore.textContent=s>=999999?"FS":`${Number(s).toFixed(0)}ms`;}token=null;clickSent=false;pad.disabled=true;pad.className="reaction-pad";status.textContent=t("reaction.waitingRound");sub.textContent=t("reaction.dontClick");});
    window.addEventListener("duo:language-changed",()=>{if(!token){status.textContent=t("reaction.waitingRound");sub.textContent=t("reaction.dontClick");}});
})();
