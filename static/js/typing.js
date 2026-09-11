(() => {
    const socket=window.socket,t=k=>window.DuoUI?.t(k)||k,text=document.getElementById("typing-text"),input=document.getElementById("typing-input"),wpm=document.getElementById("typing-wpm"),acc=document.getElementById("typing-accuracy");
    const phrase="The only way to do great work is to love what you do. Keep looking until the work feels like yours.";text.textContent=phrase;let token=null,start=0,submitted=false;
    function reset(){token=null;start=0;submitted=false;input.value="";input.disabled=true;input.placeholder=t("typing.placeholder");wpm.textContent="0 WPM";acc.textContent="100%";}
    function accuracy(v){if(!v.length)return 100;let c=0;for(let i=0;i<v.length;i++)if(v[i]===phrase[i])c++;return c/v.length*100;}
    window.addEventListener("duo:round-start",e=>{reset();token=e.detail.round_token;start=performance.now();input.disabled=false;input.placeholder=t("typing.playPlaceholder");input.focus();});
    input.addEventListener("input",()=>{if(!token||submitted)return;const v=input.value,min=Math.max((performance.now()-start)/60000,1/60000),words=v.trim()?v.trim().split(/\s+/).length:0;wpm.textContent=`${Math.round(words/min)} WPM`;acc.textContent=`${accuracy(v).toFixed(0)}%`;if(v===phrase){submitted=true;input.disabled=true;const final=phrase.trim().split(/\s+/).length/min;socket.emit("submit_score",{round_token:token,score:Number(final.toFixed(2))});}});
    window.addEventListener("duo:round-result",()=>token=null);window.addEventListener("duo:language-changed",()=>{if(!token)input.placeholder=t("typing.placeholder");});reset();
})();
