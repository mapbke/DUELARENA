const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function boot(pathname='/r/ABCDE',search='') {
  const nodes = new Map(), listeners = {}, handlers = {}, sent=[];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {dataset:{mode:'reaction'},classList:{add(){},remove(){}},
      addEventListener(event,fn){this[event]=fn},textContent:'',innerHTML:'',value:'',disabled:false});
    return nodes.get(id);
  }
  const socket={connected:false,on(event,fn){handlers[event]=fn},emit(...args){sent.push(args)}};
  const window={socket,DuoArena:{user:{user_id:'a'}},DuoUI:{language:'ru',t:k=>k},
    addEventListener(event,fn){(listeners[event]??=[]).push(fn)},
    dispatchEvent(e){for(const fn of listeners[e.type]||[])fn(e)}};
  const location={pathname,search,href:'https://example.test'+pathname+search,assign(){}};
  const context={window,location,document:{querySelector:()=>node('panel'),getElementById:node,
    createElement:()=>node('temp')},history:{replaceState(a,b,url){location.pathname=url;location.search=''}},
    URL,URLSearchParams,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame(){},performance,
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},navigator:{}};
  vm.runInNewContext(fs.readFileSync('static/js/room.js','utf8'),context);
  return {node,window,socket,handlers,sent,location,async connect(){socket.connected=true;window.dispatchEvent({type:'duo:socket-connected'});await new Promise(setImmediate)}};
}
test('direct invite survives setup and rejoins on every connection',async()=>{
 const c=boot();assert.equal(c.location.pathname,'/r/ABCDE');await c.connect();
 assert.equal(c.sent[0][0],'room_join');assert.equal(c.sent[0][1].room,'ABCDE');
 c.socket.connected=false;c.window.dispatchEvent({type:'duo:socket-disconnected'});
 await c.connect();assert.equal(c.sent.length,2);
});
test('legacy invite query remains usable',async()=>{
 const c=boot('/reaction','?room=abcde');await c.connect();assert.equal(c.sent[0][1].room,'ABCDE');
});
test('create is pending until server response and keeps canonical URL',async()=>{
 const c=boot('/reaction');await c.connect();
 c.node('create-room').click();c.node('create-room').click();assert.equal(c.sent.length,1);
 c.handlers.room_state({room:'FGHJK',mode:'reaction',mode_name:'Reaction',state:'lobby',players:[],invite_url:'https://example.test/r/FGHJK'});
 assert.equal(c.location.pathname,'/r/FGHJK');assert.equal(c.node('create-room').disabled,false);
});
test('error is visible without alert and enables retry',async()=>{
 const c=boot('/reaction');await c.connect();c.node('create-room').click();
 c.handlers.room_error({code:'room_full'});assert.equal(c.node('room-error').textContent,'error.room_full');
 assert.equal(c.node('create-room').disabled,false);
});
