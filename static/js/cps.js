(() => {
    const socket=window.socket,t=k=>window.DuoUI?.t(k)||k,button=document.getElementById("cps-button"),time=document.getElementById("cps-time"),clicksNode=document.getElementById("cps-clicks"),rate=document.getElementById("cps-rate");
    const duration=10000;let token=null,active=false,clicks=0,start=0,raf=null;
    function reset(){token=null;active=false;clicks=0;start=0;button.disabled=true;button.textContent=t("cps.waiting");time.textContent="10.0";clicksNode.textContent="0";rate.textContent="0.0";if(raf)cancelAnimationFrame(raf);}
    function finish(){if(!active)return;active=false;button.disabled=true;button.textContent=t("cps.sent");socket.emit("submit_score",{round_token:token,score:clicks});}
    function tick(){if(!active)return;const elapsed=performance.now()-start,left=Math.max(0,duration-elapsed);time.textContent=(left/1000).toFixed(1);rate.textContent=(clicks/Math.max(elapsed/1000,.001)).toFixed(1);if(left<=0)return finish();raf=requestAnimationFrame(tick);}
    window.addEventListener("duo:round-start",e=>{reset();token=e.detail.round_token;active=true;start=performance.now();button.disabled=false;button.textContent=t("cps.click");raf=requestAnimationFrame(tick);});
    button.addEventListener("pointerdown",e=>{if(!active)return;e.preventDefault();clicks++;clicksNode.textContent=String(clicks);});window.addEventListener("duo:round-result",()=>token=null);window.addEventListener("duo:language-changed",()=>{if(!active)button.textContent=t("cps.waiting");});reset();
})();
