const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const elements=new Map(),windowEvents={},frames=[],storage=new Map();
function el(key){
  if(!elements.has(key))elements.set(key,{
    textContent:"",innerHTML:"",hidden:false,style:{},listeners:{},
    addEventListener(name,fn){this.listeners[name]=fn;},
    getBoundingClientRect(){return {left:0,width:440};},
    setPointerCapture(){}
  });
  return elements.get(key);
}
const gradient=()=>({addColorStop(){}});
const ctx=new Proxy({}, {get(target,key){
  if(key==="createLinearGradient"||key==="createRadialGradient")return gradient;
  return target[key]||(()=>{});
}});
el("#game").getContext=()=>ctx;
let now=0;
const scope={
  document:{querySelector:el},window:{addEventListener(n,fn){windowEvents[n]=fn;}},
  performance:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn),
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  Math:Object.assign(Object.create(Math),{random:()=>0}),Set,Map,Number,String
};
const source=fs.readFileSync("game.js","utf8").replace(
  "  reset();requestAnimationFrame(frame);",
  "  globalThis.__test={snapshot:()=>({gems,launches,score,playerNext,aiNext,aim,over}),sat,make,add:(level,x,y)=>gems.push(make(level,x,y,\"test\"))};reset();requestAnimationFrame(frame);"
);
vm.runInNewContext(source,scope);
function advance(ms){for(let n=0;n<ms;n+=16){now+=16;const f=frames.shift();assert.ok(f);f(now);}}
function drop(x){const ev={clientX:x,pointerId:1,preventDefault(){}};el("#game").listeners.pointerdown(ev);el("#game").listeners.pointerup(ev);}
assert.equal((el("#gem-list").innerHTML.match(/<div>/g)||[]).length,11);
assert.equal(scope.__test.snapshot().score,0);
const a=scope.__test.make(0,100,300,"test"),b=scope.__test.make(0,105,305,"test"),c=scope.__test.make(0,330,300,"test");
assert.ok(scope.__test.sat(a,b),"polygon overlap found");
assert.equal(scope.__test.sat(a,c),null,"separate polygons do not collide");
drop(210);assert.equal(scope.__test.snapshot().launches.length,1,"release is animated before physics spawn");advance(1600);drop(210);advance(1600);
assert.ok(scope.__test.snapshot().score>0,"matching gems merge and score");
assert.ok(Number(el("#best").textContent)>0,"best score updated");
el("#restart").listeners.click();
assert.equal(scope.__test.snapshot().score,0);
assert.ok(Number(el("#best").textContent)>0,"best score survives restart");
advance(4500);
assert.ok(scope.__test.snapshot().gems.some(g=>g.owner==="ai"),"Jimmy throws without player input");
el("#restart").listeners.click();
const block=scope.__test.make(0,210,183,"test");block.r=150;scope.__test.snapshot().gems.push(block);
drop(210);advance(500);
assert.equal(el("#overlay").hidden,false,"blocked entrance ends game");
el("#again").listeners.click();
assert.equal(el("#overlay").hidden,true,"restart clears failure");
windowEvents.keydown({key:"ArrowLeft",code:"ArrowLeft",preventDefault(){}});
windowEvents.keydown({key:" ",code:"Space",preventDefault(){}});
assert.equal(scope.__test.snapshot().launches.length,1,"keyboard starts throw animation");advance(500);assert.ok(scope.__test.snapshot().gems.length>0,"keyboard drop works");
console.log("PASS 11 levels, polygon SAT, player drop, merge, score, best, AI throw, failure, restart, keyboard, render loop");
