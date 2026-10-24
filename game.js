(() => {
  "use strict";
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    score: document.querySelector("#score"), best: document.querySelector("#best"),
    playerNext: document.querySelector("#player-next"), aiNext: document.querySelector("#ai-next"),
    aiStatus: document.querySelector("#ai-status"), list: document.querySelector("#gem-list"),
    overlay: document.querySelector("#overlay"), final: document.querySelector("#final-score")
  };
  const W = 440, H = 780, LEFT = 25, RIGHT = 415, FLOOR = 749;
  const DANGER = 245, DROP_Y = 183, GRAVITY = 1250, STEP = 1 / 120;
  const GEMS = [
    {name:"糖果晶",color:"#ffa567",r:15,sides:4,symbol:"✦"},
    {name:"南瓜石",color:"#f78c47",r:19,sides:5,symbol:"◆"},
    {name:"幽灵晶",color:"#a6d7e4",r:23,sides:6,symbol:"✧"},
    {name:"蝙蝠紫晶",color:"#9b74c7",r:27,sides:5,symbol:"✦"},
    {name:"女巫月石",color:"#baa1ec",r:32,sides:7,symbol:"☾"},
    {name:"魔药翡翠",color:"#64bd9f",r:38,sides:6,symbol:"✧"},
    {name:"血月红宝",color:"#e36f80",r:45,sides:8,symbol:"✦"},
    {name:"夜星蓝钻",color:"#73b9ef",r:53,sides:9,symbol:"✶"},
    {name:"幻光欧泊",color:"#d29fe8",r:61,sides:10,symbol:"✧"},
    {name:"秘境王冠",color:"#f4ca7c",r:70,sides:11,symbol:"♛"},
    {name:"万圣大宝石",color:"#fff0b7",r:80,sides:12,symbol:"✹"}
  ];
  const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
  const chooseSmall = () => { const n=Math.random(); return n < .34 ? 0 : n < .62 ? 1 : n < .84 ? 2 : 3; };
  let gems=[], particles=[], score=0, best=0, playerNext=0, aiNext=0, aim=220;
  let wolfX=220, jimmyX=350, jimmyTarget=350, aiTimer=3.5, cooldown=0;
  let dangerClock=0, elapsed=0, combo=0, lastMerge=-10, over=false, serial=0;
  let accumulator=0, lastFrame=performance.now(), shake=0, statusTimer=0;
  try { best=Number(localStorage.getItem("dabaoshi-best"))||0; } catch {}

  function vertices(b) {
    const spec=GEMS[b.level], result=[];
    const offset=-Math.PI/2 + b.angle;
    for(let i=0;i<spec.sides;i++){
      const a=offset+2*Math.PI*i/spec.sides;
      const cut=(i%2===0 ? 1 : (b.level<4 ? .96 : .985));
      result.push({x:b.x+Math.cos(a)*b.r*cut,y:b.y+Math.sin(a)*b.r*cut});
    }
    return result;
  }
  function project(poly,nx,ny){
    let lo=Infinity,hi=-Infinity;
    for(const p of poly){const d=p.x*nx+p.y*ny;lo=Math.min(lo,d);hi=Math.max(hi,d);}
    return {lo,hi};
  }
  function sat(a,b) {
    if(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r+2)return null;
    const pa=vertices(a),pb=vertices(b);
    let min=Infinity,axisX=0,axisY=0;
    for(const poly of [pa,pb])for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length],ex=q.x-p.x,ey=q.y-p.y;
      const len=Math.hypot(ex,ey),nx=-ey/len,ny=ex/len;
      const aa=project(pa,nx,ny),bb=project(pb,nx,ny);
      const overlap=Math.min(aa.hi,bb.hi)-Math.max(aa.lo,bb.lo);
      if(overlap<=0)return null;
      if(overlap<min){min=overlap;axisX=nx;axisY=ny;}
    }
    if((b.x-a.x)*axisX+(b.y-a.y)*axisY<0){axisX=-axisX;axisY=-axisY;}
    return {depth:min,nx:axisX,ny:axisY};
  }
  function make(level,x,y,owner) {
    return {id:++serial,level,x,y,r:GEMS[level].r,angle:(Math.random()-.5)*.2,
      vx:0,vy:0,omega:(Math.random()-.5)*.8,age:0,owner};
  }
  function updateUI(){
    ui.score.textContent=score.toLocaleString("zh-CN");
    ui.best.textContent=best.toLocaleString("zh-CN");
    for(const [el,level] of [[ui.playerNext,playerNext],[ui.aiNext,aiNext]]){
      el.style.background=GEMS[level].color;el.textContent=String(level+1);
      el.title=GEMS[level].name;
    }
  }
  function setStatus(message,seconds=1.5){ui.aiStatus.textContent=message;statusTimer=seconds;}
  function endGame(){
    if(over)return;
    over=true;ui.final.textContent="协作得分："+score.toLocaleString("zh-CN");
    ui.overlay.hidden=false;
  }
  function reset(){
    gems=[];particles=[];score=0;combo=0;lastMerge=-10;playerNext=chooseSmall();aiNext=chooseSmall();
    aim=220;wolfX=220;jimmyX=350;jimmyTarget=350;aiTimer=3.5;cooldown=0;
    dangerClock=0;elapsed=0;over=false;shake=0;statusTimer=0;accumulator=0;
    ui.overlay.hidden=true;setStatus("正在寻找落点…",2);updateUI();
  }
  function spawn(level,x,owner){
    const b=make(level,clamp(x,LEFT+GEMS[level].r,RIGHT-GEMS[level].r),DROP_Y,owner);
    if(gems.some(other=>sat(b,other))){endGame();return false;}
    b.vy=owner==="ai"?110:25;
    b.vx=owner==="ai"?clamp((jimmyTarget-jimmyX)*.8,-35,35):0;
    gems.push(b);return true;
  }
  function playerDrop(){
    if(over||cooldown>0)return;
    if(spawn(playerNext,aim,"player")){playerNext=chooseSmall();cooldown=.48;updateUI();}
  }
  function chooseAiTarget(){
    let bestX=220,bestValue=-Infinity;
    for(let x=LEFT+35;x<=RIGHT-35;x+=24){
      let value=0;
      for(const b of gems){
        const d=Math.abs(b.x-x);
        if(b.level===aiNext)value+=Math.max(0,125-d)*.08;
        if(b.y-b.r<DANGER+105)value-=Math.max(0,90-d)*.12;
      }
      value-=Math.abs(x-jimmyX)*.006;
      value+=(Math.random()-.5)*.4;
      if(value>bestValue){bestValue=value;bestX=x;}
    }
    return bestX;
  }
  function aiUpdate(dt){
    aiTimer-=dt;
    if(aiTimer<1.1&&aiTimer+dt>=1.1){jimmyTarget=chooseAiTarget();setStatus("锁定落点！",1.1);}
    jimmyX+=(jimmyTarget-jimmyX)*Math.min(1,dt*3.4);
    if(aiTimer<=0){
      if(spawn(aiNext,jimmyTarget,"ai")){aiNext=chooseSmall();updateUI();setStatus("Jimmy 投出宝石！",1.4);}
      aiTimer=3.8+Math.random()*.7;
    }
  }

  function burst(x,y,level){
    const count=10+level*2,color=GEMS[level].color;
    for(let i=0;i<count;i++){
      const a=2*Math.PI*i/count,force=80+Math.random()*135;
      particles.push({x,y,vx:Math.cos(a)*force,vy:Math.sin(a)*force-45,
        life:.55+Math.random()*.25,max:.8,color,size:1.8+Math.random()*2.4});
    }
    shake=Math.min(1,shake+.12+level*.025);
  }
  function merge(a,b){
    const level=a.level+1,x=(a.x+b.x)/2,y=(a.y+b.y)/2;
    combo=elapsed-lastMerge<2.1?combo+1:1;lastMerge=elapsed;
    const gain=Math.round(20*Math.pow(2,level)*Math.min(combo,4));
    score+=gain;
    if(score>best){best=score;try{localStorage.setItem("dabaoshi-best",String(best));}catch{}}
    burst(x,y,Math.min(level,10));updateUI();
    if(level>=GEMS.length)return null;
    const child=make(level,x,y,a.owner);
    child.vx=(a.vx+b.vx)*.27;child.vy=-130;child.omega=(a.omega+b.omega)*.25;
    return child;
  }
  function constrain(b){
    const v=vertices(b);
    let minX=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const p of v){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
    if(minX<LEFT){b.x+=LEFT-minX;b.vx=Math.abs(b.vx)*.3;b.omega*=.8;}
    if(maxX>RIGHT){b.x-=maxX-RIGHT;b.vx=-Math.abs(b.vx)*.3;b.omega*=.8;}
    if(maxY>FLOOR){
      b.y-=maxY-FLOOR;
      b.vy=Math.abs(b.vy)<27?0:-Math.abs(b.vy)*.18;
      b.vx*=.88;b.omega*=.8;
    }
  }
  function physics(dt){
    elapsed+=dt;cooldown=Math.max(0,cooldown-dt);
    aiUpdate(dt);
    wolfX+=(aim-wolfX)*Math.min(1,dt*12);
    if(statusTimer>0){statusTimer-=dt;if(statusTimer<=0)ui.aiStatus.textContent="正在寻找落点…";}
    for(const b of gems){
      b.age+=dt;b.vy+=GRAVITY*dt;b.vx*=.999;b.omega*=.998;
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.omega*dt;
      constrain(b);
    }
    const removed=new Set(),added=[];
    for(let pass=0;pass<2;pass++){
      for(let i=0;i<gems.length;i++){
        const a=gems[i];if(removed.has(a.id))continue;
        for(let j=i+1;j<gems.length;j++){
          const b=gems[j];if(removed.has(b.id))continue;
          const hit=sat(a,b);if(!hit)continue;
          if(a.level===b.level){
            removed.add(a.id);removed.add(b.id);
            const child=merge(a,b);if(child)added.push(child);
            break;
          }
          const ma=a.r*a.r,mb=b.r*b.r,total=ma+mb;
          a.x-=hit.nx*hit.depth*mb/total;
          a.y-=hit.ny*hit.depth*mb/total;
          b.x+=hit.nx*hit.depth*ma/total;
          b.y+=hit.ny*hit.depth*ma/total;
          const speed=(b.vx-a.vx)*hit.nx+(b.vy-a.vy)*hit.ny;
          if(speed<0){
            const impulse=-1.14*speed/(1/ma+1/mb);
            a.vx-=impulse*hit.nx/ma;a.vy-=impulse*hit.ny/ma;
            b.vx+=impulse*hit.nx/mb;b.vy+=impulse*hit.ny/mb;
            const spin=clamp((b.vx-a.vx)*hit.ny*.002,-.3,.3);
            a.omega=clamp(a.omega-spin,-2,2);b.omega=clamp(b.omega+spin,-2,2);
          }
        }
      }
      for(const b of gems)if(!removed.has(b.id))constrain(b);
    }
    if(removed.size)gems=gems.filter(b=>!removed.has(b.id)).concat(added);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=170*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);
    shake=Math.max(0,shake-dt*.9);
    const crowd=gems.some(b=>b.age>1.45&&Math.min(...vertices(b).map(p=>p.y))<DANGER);
    dangerClock=crowd?dangerClock+dt:Math.max(0,dangerClock-dt*1.8);
    if(dangerClock>=2.5)endGame();
  }

  function path(points){
    ctx.beginPath();
    points.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});
    ctx.closePath();
  }
  function star(x,y,r,color){
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);ctx.stroke();
    ctx.restore();
  }
  function backdrop(){
    const sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,"#161422");sky.addColorStop(.38,"#211923");sky.addColorStop(1,"#392820");
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const moon=ctx.createRadialGradient(330,102,9,330,102,120);
    moon.addColorStop(0,"#ffe7ad88");moon.addColorStop(.4,"#d7a66720");moon.addColorStop(1,"#d7a66700");
    ctx.fillStyle=moon;ctx.fillRect(190,0,240,250);
    ctx.fillStyle="#f5deb3";ctx.beginPath();ctx.arc(330,100,22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#211923";ctx.beginPath();ctx.arc(339,94,20,0,Math.PI*2);ctx.fill();
    for(let i=0;i<43;i++){
      const x=37+(i*83%366),y=22+(i*131%600);
      ctx.fillStyle=i%4===0?"#f2c98a99":"#ffffff55";
      ctx.beginPath();ctx.arc(x,y,i%7===0?1.5:.7,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle="#1b1520";ctx.fillRect(0,143,W,25);
    ctx.fillStyle="#372735";ctx.fillRect(LEFT,DANGER,RIGHT-LEFT,FLOOR-DANGER);
    const pit=ctx.createLinearGradient(0,DANGER,0,FLOOR);
    pit.addColorStop(0,"#2b2029");pit.addColorStop(1,"#443027");
    ctx.fillStyle=pit;ctx.fillRect(LEFT,DANGER,RIGHT-LEFT,FLOOR-DANGER);
    ctx.fillStyle="#62493755";for(let i=0;i<5;i++){
      ctx.beginPath();ctx.ellipse(90+i*87,390+i%2*80,75,125,.2,0,Math.PI*2);ctx.fill();
    }
    ctx.strokeStyle="#d7b77d88";ctx.lineWidth=2;
    ctx.strokeRect(LEFT-8,8,RIGHT-LEFT+16,FLOOR+12);
    ctx.strokeRect(LEFT-3,14,RIGHT-LEFT+6,FLOOR);
    for(const edge of [11,429]){
      ctx.fillStyle="#261f2a";ctx.fillRect(edge-11,0,22,H);
      ctx.strokeStyle="#b99a69";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(edge,0);ctx.lineTo(edge,H);ctx.stroke();
      for(let y=55;y<H;y+=78){path([{x:edge,y:y-11},{x:edge+7,y},{x:edge,y:y+11},{x:edge-7,y}]);ctx.stroke();}
    }
    ctx.fillStyle="#9e7857";ctx.fillRect(LEFT,FLOOR,RIGHT-LEFT,H-FLOOR);
    ctx.fillStyle="#d5b77e";ctx.fillRect(LEFT,FLOOR,RIGHT-LEFT,4);
    ctx.setLineDash([3,7]);ctx.strokeStyle=dangerClock>0?"#ffbda1":"#dbc28b99";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(LEFT,DANGER);ctx.lineTo(RIGHT,DANGER);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#ead1a4";ctx.font="12px Georgia, serif";ctx.textAlign="left";ctx.fillText("✦ 警戒线",35,DANGER-10);
    for(let i=0;i<10;i++)star(41+(i*103%358),250+(i*71%475),i%3===0?4:2,"#f6e1b688");
  }
  function drawGem(b,alpha=1,scale=1){
    const spec=GEMS[b.level],r=b.r*scale,display={...b,r};
    const v=vertices(display);
    ctx.save();ctx.globalAlpha=alpha;
    ctx.shadowColor=spec.color;ctx.shadowBlur=7+b.level*2.1;
    const gradient=ctx.createRadialGradient(b.x-r*.4,b.y-r*.5,2,b.x,b.y,r*1.15);
    gradient.addColorStop(0,"#fff9e8");gradient.addColorStop(.2,spec.color);
    gradient.addColorStop(1,b.level>6?"#584769":"#3a2b45");
    path(v);ctx.fillStyle=gradient;ctx.fill();
    ctx.shadowBlur=0;ctx.lineWidth=2+b.level*.08;ctx.strokeStyle="#f4deb4";ctx.stroke();
    ctx.globalAlpha=alpha*.23;
    for(let i=0;i<v.length;i++){
      path([v[i],v[(i+1)%v.length],{x:b.x,y:b.y}]);
      ctx.fillStyle=i%2===0?"white":"#30223e";ctx.fill();
    }
    ctx.globalAlpha=alpha;
    const inner=vertices({...display,r:r*.63,angle:b.angle+.08});
    path(inner);ctx.strokeStyle="#fff5d59c";ctx.lineWidth=1.2;ctx.stroke();
    if(b.level>=5){
      ctx.beginPath();ctx.arc(b.x,b.y,r*.42,0,Math.PI*2);
      ctx.strokeStyle="#fff8dc8c";ctx.lineWidth=1.2;ctx.stroke();
    }
    if(b.level>=8){
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2+b.angle;
        star(b.x+Math.cos(a)*r*.77,b.y+Math.sin(a)*r*.77,4,"#fff6ce");
      }
    }
    ctx.fillStyle="#fff6dd";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.shadowColor="#291b35";ctx.shadowBlur=4;
    ctx.font="bold "+Math.max(15,r*.68)+"px Georgia, serif";
    ctx.fillText(spec.symbol,b.x,b.y+1);
    ctx.restore();
  }
  function wolf(x,y,t){
    ctx.save();ctx.translate(x,y+Math.sin(t*3)*2);
    ctx.fillStyle="#342e49";path([{x:-25,y:24},{x:-33,y:44},{x:0,y:47},{x:27,y:39},{x:20,y:22}]);ctx.fill();
    ctx.fillStyle="#9bc8d7";path([{x:-19,y:21},{x:-24,y:41},{x:17,y:41},{x:19,y:20}]);ctx.fill();
    ctx.fillStyle="#312d42";ctx.fillRect(-18,40,11,9);ctx.fillRect(7,40,11,9);
    ctx.fillStyle="#4a405d";path([{x:-21,y:-15},{x:-33,y:-39},{x:-13,y:-28},{x:15,y:-29},{x:31,y:-42},{x:24,y:-14}]);ctx.fill();
    ctx.fillStyle="#f7dbcb";ctx.beginPath();ctx.ellipse(0,-7,26,27,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#343047";path([{x:-25,y:-17},{x:-23,y:-34},{x:-5,y:-29},{x:8,y:-37},{x:26,y:-24},{x:24,y:-10},{x:13,y:-20},{x:1,y:-14},{x:-10,y:-20}]);ctx.fill();
    ctx.fillStyle="#473a54";ctx.beginPath();ctx.ellipse(-10,-8,3.5,5,0,0,Math.PI*2);ctx.ellipse(11,-8,3.5,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#534256";ctx.beginPath();ctx.ellipse(2,7,5,3,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#503d4d";ctx.lineWidth=2;ctx.beginPath();ctx.arc(2,8,10,.1,Math.PI-.1);ctx.stroke();
    ctx.fillStyle="white";path([{x:8,y:15},{x:12,y:17},{x:10,y:22}]);ctx.fill();
    ctx.fillStyle="#4a405d";ctx.beginPath();ctx.ellipse(-26,26,8,10,-.3,0,Math.PI*2);ctx.ellipse(27,25,8,10,.3,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function jimmy(x,y,t){
    const flap=Math.sin(t*12)*.55;
    ctx.save();ctx.translate(x,y+Math.sin(t*4.5)*6);
    ctx.fillStyle="#321e3d";
    path([{x:-15,y:5},{x:-46,y:-12-flap*12},{x:-37,y:14+flap*6},{x:-25,y:8},{x:-18,y:24}]);ctx.fill();
    path([{x:15,y:5},{x:46,y:-12-flap*12},{x:37,y:14+flap*6},{x:25,y:8},{x:18,y:24}]);ctx.fill();
    ctx.strokeStyle="#9e5a79";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-16,8);ctx.lineTo(-42,-8-flap*10);ctx.moveTo(16,8);ctx.lineTo(42,-8-flap*10);ctx.stroke();
    ctx.fillStyle="#671e3d";path([{x:-18,y:19},{x:-27,y:45},{x:0,y:36},{x:26,y:45},{x:17,y:18}]);ctx.fill();
    ctx.fillStyle="#302b46";ctx.fillRect(-11,38,7,7);ctx.fillRect(5,38,7,7);
    ctx.fillStyle="#f7e2da";ctx.beginPath();ctx.ellipse(0,0,21,24,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#29233d";path([{x:-20,y:-12},{x:-17,y:-29},{x:0,y:-21},{x:16,y:-31},{x:20,y:-10},{x:8,y:-19},{x:0,y:-13},{x:-7,y:-19}]);ctx.fill();
    ctx.fillStyle="#b94767";ctx.beginPath();ctx.ellipse(-8,0,2.8,3.8,0,0,Math.PI*2);ctx.ellipse(8,0,2.8,3.8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#764a5a";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,8,8,.2,Math.PI-.2);ctx.stroke();
    ctx.fillStyle="white";path([{x:4,y:13},{x:7,y:13},{x:5.5,y:18}]);ctx.fill();
    ctx.fillStyle="#f7e2da";ctx.beginPath();ctx.ellipse(-20,23,7,7,0,0,Math.PI*2);ctx.ellipse(21,23,7,7,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  function render(){
    ctx.save();
    if(shake>0)ctx.translate(Math.sin(elapsed*47)*shake*3,Math.cos(elapsed*39)*shake*2);
    backdrop();
    if(!over){
      ctx.setLineDash([3,7]);ctx.strokeStyle="#e3c98c66";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(aim,DROP_Y+GEMS[playerNext].r);ctx.lineTo(aim,FLOOR);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="#ebc786";ctx.beginPath();ctx.moveTo(aim-7,DROP_Y+15);ctx.lineTo(aim+7,DROP_Y+15);ctx.lineTo(aim,DROP_Y+23);ctx.closePath();ctx.fill();
    }
    for(const b of gems)drawGem(b);
    for(const p of particles){
      ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    wolf(wolfX,88,elapsed);
    jimmy(jimmyX,61,elapsed);
    if(!over){
      drawGem({x:wolfX+28,y:121,r:GEMS[playerNext].r*.78,level:playerNext,angle:elapsed*.3},cooldown>0?.52:1);
      drawGem({x:jimmyX+22,y:101,r:GEMS[aiNext].r*.72,level:aiNext,angle:-elapsed*.45});
    }
    ctx.textAlign="left";ctx.textBaseline="alphabetic";
    ctx.fillStyle="#f4daa8";ctx.font="bold 12px system-ui";
    ctx.fillText("高家声 · 你",35,25);
    ctx.textAlign="right";ctx.fillText("Jimmy · AI",W-35,25);
    if(dangerClock>0){
      ctx.fillStyle="#d9a369";ctx.fillRect(LEFT,174,(RIGHT-LEFT)*Math.min(1,dangerClock/2.5),5);
    }
    ctx.restore();
  }
  function frame(now){
    accumulator+=Math.min((now-lastFrame)/1000,.05);lastFrame=now;
    let steps=0;
    while(accumulator>=STEP&&steps++<6){if(!over)physics(STEP);accumulator-=STEP;}
    render();requestAnimationFrame(frame);
  }
  function pointerX(event){
    const rect=canvas.getBoundingClientRect();
    return clamp((event.clientX-rect.left)*W/rect.width,LEFT+25,RIGHT-25);
  }
  canvas.addEventListener("pointerdown",event=>{
    event.preventDefault();aim=pointerX(event);
    if(canvas.setPointerCapture)canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove",event=>{aim=pointerX(event);});
  canvas.addEventListener("pointerup",event=>{
    event.preventDefault();aim=pointerX(event);playerDrop();
  });
  window.addEventListener("keydown",event=>{
    if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
      event.preventDefault();aim=clamp(aim+(event.key==="ArrowLeft"?-23:23),LEFT+25,RIGHT-25);
    }else if(event.code==="Space"){event.preventDefault();playerDrop();}
    else if(event.key.toLowerCase()==="r")reset();
  });
  document.querySelector("#restart").addEventListener("click",reset);
  document.querySelector("#again").addEventListener("click",reset);
  ui.list.innerHTML=GEMS.map((g,i)=>"<div><i style='background:"+g.color+"'></i><span><b>"+(i+1)+".</b> "+g.name+"</span></div>").join("");
  reset();requestAnimationFrame(frame);
})();

