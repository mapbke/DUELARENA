(() => {
    const socket=window.socket,t=k=>window.DuoUI?.t(k)||k,display=document.getElementById("blind-display"),stop=document.getElementById("blind-stop"),result=document.getElementById("blind-result"),difference=document.getElementById("blind-difference");
    let token=null,active=false,start=0,hideTimer=null,raf=null;
    function reset(){token=null;active=false;start=0;display.textContent=t("blind.waiting");stop.disabled=true;stop.textContent=t("blind.waiting");result.textContent="—";difference.textContent="—";if(hideTimer)clearTimeout(hideTimer);if(raf)cancelAnimationFrame(raf);}
    function animate(){if(!active)return;display.textContent=`${((performance.now()-start)/1000).toFixed(3)}s`;raf=requestAnimationFrame(animate);}
    window.addEventListener("duo:round-start",e=>{reset();token=e.detail.round_token;active=true;start=performance.now();stop.disabled=false;stop.textContent=t("blind.stop");animate();hideTimer=setTimeout(()=>{if(!active)return;if(raf)cancelAnimationFrame(raf);display.textContent="[ BLIND ]";},900);});
    stop.addEventListener("click",()=>{if(!active)return;active=false;stop.disabled=true;stop.textContent=t("blind.sent");if(raf)cancelAnimationFrame(raf);if(hideTimer)clearTimeout(hideTimer);const elapsed=performance.now()-start,diff=Math.abs(5000-elapsed);display.textContent=`${(elapsed/1000).toFixed(3)}s`;result.textContent=`${(elapsed/1000).toFixed(3)}s`;difference.textContent=`${(diff/1000).toFixed(3)}s`;socket.emit("submit_score",{round_token:token,score:Number(diff.toFixed(2))});});
    window.addEventListener("duo:round-result",()=>token=null);window.addEventListener("duo:language-changed",()=>{if(!active){display.textContent=t("blind.waiting");stop.textContent=t("blind.waiting");}});reset();
})();
