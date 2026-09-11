(() => {
    const socket=window.socket,zone=document.getElementById("aim-zone"),placeholder=document.getElementById("aim-placeholder"),target=document.getElementById("aim-target"),hitsNode=document.getElementById("aim-hits"),score=document.getElementById("aim-score");
    const total=15;let token=null,active=false,hits=0,start=0;
    function move(){const p=28;target.style.left=`${p+Math.random()*Math.max(1,zone.clientWidth-p*2)}px`;target.style.top=`${p+Math.random()*Math.max(1,zone.clientHeight-p*2)}px`;}
    function reset(){token=null;active=false;hits=0;start=0;target.hidden=true;placeholder.style.display="grid";hitsNode.textContent=`0 / ${total}`;score.textContent="0.00";}
    window.addEventListener("duo:round-start",e=>{reset();token=e.detail.round_token;active=true;start=performance.now();placeholder.style.display="none";target.hidden=false;move();});
    target.addEventListener("pointerdown",e=>{e.preventDefault();e.stopPropagation();if(!active)return;hits++;const sec=Math.max((performance.now()-start)/1000,.001),live=hits/sec;hitsNode.textContent=`${hits} / ${total}`;score.textContent=live.toFixed(2);if(hits>=total){active=false;target.hidden=true;socket.emit("submit_score",{round_token:token,score:Number((total/sec).toFixed(3))});return;}move();});
    window.addEventListener("duo:round-result",()=>token=null);reset();
})();
