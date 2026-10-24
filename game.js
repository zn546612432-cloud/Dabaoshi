(() => {
  'use strict';
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
  const scoreEl = document.querySelector('#score'), bestEl = document.querySelector('#best');
  const nameEl = document.querySelector('#next-name'), previewEl = document.querySelector('#preview');
  const overlay = document.querySelector('#overlay'), finalEl = document.querySelector('#final');
  const W = 420, H = 620, LEFT = 22, RIGHT = 398, FLOOR = 595, DANGER = 112, DROP_Y = 56;
  const GRAVITY = 1200, DT = 1 / 120;
  const gems = [
    {name:'晶砂',color:'#73d6e9',r:17},{name:'蓝晶',color:'#65a9ff',r:23},
    {name:'紫晶',color:'#a58bff',r:29},{name:'红宝石',color:'#f27799',r:36},
    {name:'琥珀',color:'#efae5e',r:43},{name:'翡翠',color:'#62ca9c',r:50},
    {name:'星钻',color:'#d1deff',r:58},{name:'大宝石',color:'#f5cc74',r:67}
  ];
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const randomLevel = () => {const n=Math.random();return n<.38?0:n<.72?1:n<.93?2:3};
  let bodies=[], effects=[], points=0, best=0, next=0, aim=W/2, cooldown=0, danger=0, over=false, id=0, accumulator=0, last=performance.now();
  try {best=Number(localStorage.getItem('dabaoshi-best'))||0} catch {}

  function labels(){
    scoreEl.textContent=points.toLocaleString('zh-CN'); bestEl.textContent=best.toLocaleString('zh-CN');
    nameEl.textContent=gems[next].name; previewEl.textContent=String(next+1); previewEl.style.background=gems[next].color;
  }
  function make(level,x,y){return {id:++id,level,x,y,vx:0,vy:0,r:gems[level].r,age:0}}
  function reset(){bodies=[];effects=[];points=0;next=randomLevel();aim=W/2;cooldown=0;danger=0;over=false;accumulator=0;overlay.hidden=true;labels()}
  function end(){if(over)return;over=true;finalEl.textContent=`本局得分：${points.toLocaleString('zh-CN')}`;overlay.hidden=false}
  function drop(){
    if(over||cooldown>0)return;
    const r=gems[next].r,x=clamp(aim,LEFT+r,RIGHT-r);
    if(bodies.some(b=>Math.hypot(b.x-x,b.y-DROP_Y)<b.r+r-2)){end();return}
    bodies.push(make(next,x,DROP_Y));next=randomLevel();cooldown=.42;labels();
  }
  function merge(a,b){
    const level=a.level+1,x=(a.x*a.r+b.x*b.r)/(a.r+b.r),y=(a.y*a.r+b.y*b.r)/(a.r+b.r);
    points+=10*2**level;
    if(points>best){best=points;try{localStorage.setItem('dabaoshi-best',String(best))}catch{}}
    effects.push({x,y,t:0,color:gems[Math.min(level,gems.length-1)].color});labels();
    if(level===gems.length)return null;
    const child=make(level,x,y);child.vx=(a.vx+b.vx)*.25;child.vy=Math.min((a.vy+b.vy)*.25,-110);return child;
  }
  function physics(dt){
    cooldown=Math.max(0,cooldown-dt);
    for(const b of bodies){
      b.age+=dt;b.vy+=GRAVITY*dt;b.vx*=.998;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.x-b.r<LEFT){b.x=LEFT+b.r;b.vx=Math.abs(b.vx)*.25}
      if(b.x+b.r>RIGHT){b.x=RIGHT-b.r;b.vx=-Math.abs(b.vx)*.25}
      if(b.y+b.r>FLOOR){b.y=FLOOR-b.r;b.vy=Math.abs(b.vy)<25?0:-Math.abs(b.vy)*.22;b.vx*=.91}
    }
    const removed=new Set(), added=[];
    for(let pass=0;pass<2;pass++)for(let i=0;i<bodies.length;i++){
      const a=bodies[i];if(removed.has(a.id))continue;
      for(let j=i+1;j<bodies.length;j++){
        const b=bodies[j];if(removed.has(b.id))continue;
        const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=a.r+b.r;
        if(dist>=min)continue;
        if(a.level===b.level){removed.add(a.id);removed.add(b.id);const child=merge(a,b);if(child)added.push(child);break}
        const nx=dist>.001?dx/dist:1,ny=dist>.001?dy/dist:0,overlap=min-Math.max(dist,.001);
        const ma=a.r*a.r,mb=b.r*b.r,total=ma+mb;
        a.x-=nx*overlap*mb/total;a.y-=ny*overlap*mb/total;b.x+=nx*overlap*ma/total;b.y+=ny*overlap*ma/total;
        const speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(speed<0){const impulse=-1.08*speed/(1/ma+1/mb);a.vx-=impulse*nx/ma;a.vy-=impulse*ny/ma;b.vx+=impulse*nx/mb;b.vy+=impulse*ny/mb}
      }
    }
    if(removed.size)bodies=bodies.filter(b=>!removed.has(b.id)).concat(added);
    for(const b of bodies){b.x=clamp(b.x,LEFT+b.r,RIGHT-b.r);b.y=Math.min(b.y,FLOOR-b.r)}
    effects=effects.filter(e=>(e.t+=dt)<.45);
    danger=bodies.some(b=>b.age>1.25&&b.y-b.r<DANGER)?danger+dt:Math.max(0,danger-2*dt);
    if(danger>=2.4)end();
  }
  function gem(x,y,level,alpha=1){
    const {r,color}=gems[level];ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor=color;ctx.shadowBlur=15;
    const grad=ctx.createRadialGradient(x-r*.4,y-r*.5,2,x,y,r);grad.addColorStop(0,'white');grad.addColorStop(.22,color);grad.addColorStop(1,'#27345e');
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#ffffffad';ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2,px=x+Math.cos(a)*r*.67,py=y+Math.sin(a)*r*.67;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath();ctx.strokeStyle='#ffffff8c';ctx.stroke();
    ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${Math.max(13,r*.65)}px system-ui`;ctx.fillText(String(level+1),x,y+1);ctx.restore();
  }
  function render(){
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#223052');bg.addColorStop(1,'#111a32');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#ffffff10';ctx.lineWidth=1;for(let x=LEFT+20;x<RIGHT;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,FLOOR);ctx.stroke()}for(let y=20;y<FLOOR;y+=40){ctx.beginPath();ctx.moveTo(LEFT,y);ctx.lineTo(RIGHT,y);ctx.stroke()}
    ctx.fillStyle='#f2779930';ctx.fillRect(LEFT,DANGER-14,RIGHT-LEFT,28);ctx.setLineDash([8,7]);ctx.strokeStyle=danger>0?'#ff90a8':'#f27799a0';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(LEFT,DANGER);ctx.lineTo(RIGHT,DANGER);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f6a9ba';ctx.font='bold 13px system-ui';ctx.textAlign='left';ctx.fillText('警戒线',30,DANGER-21);
    ctx.fillStyle='#596a91';ctx.fillRect(LEFT,FLOOR,RIGHT-LEFT,H-FLOOR);ctx.fillStyle='#ffffff30';ctx.fillRect(LEFT,FLOOR,RIGHT-LEFT,4);
    for(const b of bodies)gem(b.x,b.y,b.level);
    for(const e of effects){ctx.globalAlpha=1-e.t/.45;ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,15+e.t*100,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
    if(!over){const r=gems[next].r,x=clamp(aim,LEFT+r,RIGHT-r);ctx.setLineDash([4,6]);ctx.strokeStyle='#ffffff60';ctx.beginPath();ctx.moveTo(x,DROP_Y+r);ctx.lineTo(x,FLOOR);ctx.stroke();ctx.setLineDash([]);gem(x,DROP_Y,next,cooldown>0?.35:.78)}
    if(danger>0&&!over){ctx.fillStyle='#f27799';ctx.fillRect(LEFT,7,(RIGHT-LEFT)*Math.min(1,danger/2.4),6)}
  }
  function frame(now){accumulator+=Math.min((now-last)/1000,.05);last=now;let steps=0;while(accumulator>=DT&&steps++<6){if(!over)physics(DT);accumulator-=DT}render();requestAnimationFrame(frame)}
  function pointerX(event){const rect=canvas.getBoundingClientRect();return(event.clientX-rect.left)*W/rect.width}
  canvas.addEventListener('pointermove',event=>{aim=pointerX(event)});
  canvas.addEventListener('pointerdown',event=>{event.preventDefault();aim=pointerX(event);drop()});
  window.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();aim=clamp(aim+(event.key==='ArrowLeft'?-22:22),LEFT,RIGHT)}else if(event.code==='Space'){event.preventDefault();drop()}else if(event.key.toLowerCase()==='r')reset()});
  document.querySelector('#restart').addEventListener('click',reset);document.querySelector('#again').addEventListener('click',reset);
  reset();requestAnimationFrame(frame);
})();

