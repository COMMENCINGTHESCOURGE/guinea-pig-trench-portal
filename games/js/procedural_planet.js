const cv=document.getElementById('vc');
const ctx=cv.getContext('2d');
const W=520,H=520,R=248,CX=260,CY=260;
let tips=[],frame=0,layer='all';
let heightmap=null,tempmap=null,pressmap=null;
let offscreen=null,oCtx=null;
let volcanoes=[],lavaParticles=[],ashParticles=[];
let flowCount=0,newLandPx=0,eruptionCount=0;
let erupting=[false,false];

function onPlanet(x,y){return (x-CX)*(x-CX)+(y-CY)*(y-CY)<=R*R}
function latOf(y){return (y-CY)/R}
function idx(x,y){return Math.round(y)*W+Math.round(x)}

function sn(x,y,sc,oc,sd){
  let v=0,a=1,f=sc,tot=0;
  for(let i=0;i<oc;i++){
    const xi=Math.floor(x*f),yi=Math.floor(y*f);
    const fx=x*f-xi,fy=y*f-yi;
    const h00=Math.abs(Math.sin(xi*127.1+yi*311.7+sd)*43758.5%1);
    const h10=Math.abs(Math.sin((xi+1)*127.1+yi*311.7+sd)*43758.5%1);
    const h01=Math.abs(Math.sin(xi*127.1+(yi+1)*311.7+sd)*43758.5%1);
    const h11=Math.abs(Math.sin((xi+1)*127.1+(yi+1)*311.7+sd)*43758.5%1);
    v+=a*(h00+(h10-h00)*fx+(h01-h00)*fy+(h00-h10-h01+h11)*fx*fy);
    tot+=a;a*=0.5;f*=2.1;
  }
  return v/tot;
}

function buildMaps(){
  heightmap=new Float32Array(W*H);
  tempmap=new Float32Array(W*H);
  pressmap=new Float32Array(W*H);
  const SD=Math.random()*999;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x;
    const dist=Math.sqrt((x-CX)*(x-CX)+(y-CY)*(y-CY))/R;
    if(dist>1){continue;}
    const h=sn(x/W,y/H,3,6,SD);
    const cont=Math.pow(Math.max(0,1-dist),0.4);
    heightmap[i]=Math.max(0,h*cont+(1-cont)*-0.3);
    tempmap[i]=Math.max(0,1-Math.abs(latOf(y))*0.8-heightmap[i]*0.4);
    pressmap[i]=Math.cos(latOf(y)*Math.PI*2)*0.5+0.5+sn(x/W,y/H,4,3,SD+100)*0.3;
  }
}

function heightAt(x,y){
  const xi=Math.round(x),yi=Math.round(y);
  if(xi<0||xi>=W||yi<0||yi>=H) return 0;
  return heightmap[yi*W+xi]||0;
}
function tempAt(x,y){const i=idx(x,y);return i>=0&&i<W*H?tempmap[i]||0.5:0.5}
function pressAt(x,y){const i=idx(x,y);return i>=0&&i<W*H?pressmap[i]||0.5:0.5}
function gradH(x,y){const d=2;return{x:(heightAt(x+d,y)-heightAt(x-d,y))/(2*d),y:(heightAt(x,y+d)-heightAt(x,y-d))/(2*d)}}

function findIslandPeak(quadX,quadY,searchR){
  let best=-1,bx=quadX,by=quadY;
  for(let dy=-searchR;dy<=searchR;dy+=4)for(let dx=-searchR;dx<=searchR;dx+=4){
    const x=quadX+dx,y=quadY+dy;
    if(!onPlanet(x,y)) continue;
    const distCenter=Math.sqrt((x-CX)*(x-CX)+(y-CY)*(y-CY));
    if(distCenter<70) continue;
    const h=heightAt(x,y);
    if(h>0.35&&h>best){best=h;bx=x;by=y;}
  }
  if(best<0){
    for(let a=0;a<Math.PI*2;a+=0.1){
      const x=CX+Math.cos(a)*120,y=CY+Math.sin(a)*120;
      if(!onPlanet(x,y)) continue;
      const h=heightAt(x,y);
      if(h>best){best=h;bx=x;by=y;}
    }
  }
  return{x:bx,y:by,h:best};
}

function initVolcanoes(){
  volcanoes=[];
  const q1=findIslandPeak(CX+100,CY-90,80);
  const q2=findIslandPeak(CX-110,CY+100,80);
  const peaks=[q1,q2];
  for(let i=0;i<2;i++){
    const p=peaks[i];
    volcanoes.push({
      x:p.x,y:p.y,
      pressure:0,
      eruptTimer:80+i*120,
      eruptInterval:220+i*80,
      active:false,
      glowPhase:Math.random()*Math.PI*2,
      totalEruptions:0
    });
    paintVolcanoCone(p.x,p.y);
  }
}

function paintVolcanoCone(vx,vy){
  for(let r2=0;r2<18;r2++){
    for(let a=0;a<Math.PI*2;a+=0.15){
      const x=Math.round(vx+Math.cos(a)*r2);
      const y=Math.round(vy+Math.sin(a)*r2);
      if(!onPlanet(x,y)) continue;
      const frac=r2/18;
      const h2=heightAt(x,y);
      if(h2>0.25){
        const darkened=Math.max(0,h2-frac*0.12);
        heightmap[y*W+x]=darkened;
      }
    }
  }
  oCtx.beginPath();oCtx.arc(vx,vy,16,0,Math.PI*2);
  oCtx.fillStyle='#2a1a0e';oCtx.fill();
  oCtx.beginPath();oCtx.arc(vx,vy,9,0,Math.PI*2);
  oCtx.fillStyle='#3d2010';oCtx.fill();
  oCtx.beginPath();oCtx.arc(vx,vy,4,0,Math.PI*2);
  oCtx.fillStyle='#1a0800';oCtx.fill();
}

function erupt(v){
  v.active=true;v.pressure=0;v.totalEruptions++;eruptionCount++;
  for(let i=0;i<14;i++){
    const a=Math.random()*Math.PI*2;
    const spd=0.5+Math.random()*1.2;
    lavaParticles.push({
      x:v.x,y:v.y,
      angle:a+(Math.random()-0.5)*0.6,
      speed:spd,energy:280+Math.random()*180,
      flux:0.3+Math.random()*0.7,
      cooling:0,alive:true,trail:[]
    });
  }
  for(let i=0;i<30;i++){
    const a=-Math.PI/2+(Math.random()-0.5)*1.2;
    ashParticles.push({
      x:v.x+(Math.random()-0.5)*8,
      y:v.y+(Math.random()-0.5)*8,
      vx:Math.cos(a)*(0.5+Math.random()*2.5),
      vy:Math.sin(a)*(1+Math.random()*3)-1,
      life:1,size:1+Math.random()*2,
      grey:0.4+Math.random()*0.5
    });
  }
  setTimeout(()=>{v.active=false;},3000);
}

function eruptNow(){for(let v of volcanoes) erupt(v);}

function updateVolcanoes(){
  for(let v of volcanoes){
    v.glowPhase+=0.04;
    v.eruptTimer--;
    if(v.eruptTimer<=0){
      erupt(v);
      v.eruptTimer=v.eruptInterval+(Math.random()*60-30);
    }
  }
}

function updateLava(){
  for(let p of lavaParticles){
    if(!p.alive) continue;
    p.energy-=1.2;
    p.cooling+=0.002;
    if(p.energy<=0){p.alive=false;continue;}
    const g=gradH(p.x,p.y);
    p.angle+=(-g.x*Math.cos(p.angle)-g.y*Math.sin(p.angle))*0.5+(Math.random()-0.5)*0.18;
    const speed=Math.max(0.3,1.2-p.cooling*2);
    const nx=p.x+Math.cos(p.angle)*speed;
    const ny=p.y+Math.sin(p.angle)*speed;
    if(!onPlanet(nx,ny)){p.alive=false;continue;}
    p.trail.push({x:p.x,y:p.y});
    if(p.trail.length>60) p.trail.shift();
    p.x=nx;p.y=ny;
    const h=heightAt(p.x,p.y);
    if(h<0.26){
      solidifyLava(p.x,p.y,p.flux);
      p.alive=false;
    }
    burnLava(p);
  }
  lavaParticles=lavaParticles.filter(p=>p.alive);
}

function burnLava(p){
  if(p.trail.length<2) return;
  const last=p.trail[p.trail.length-1];
  const heat=Math.max(0,1-p.cooling*3);
  const r=Math.round(255),g=Math.round(heat*120),b=0;
  oCtx.beginPath();oCtx.moveTo(last.x,last.y);oCtx.lineTo(p.x,p.y);
  oCtx.strokeStyle=`rgba(${r},${g},${b},${0.35+heat*0.4})`;
  oCtx.lineWidth=1+p.flux*1.2;oCtx.stroke();
  oCtx.beginPath();oCtx.arc(p.x,p.y,1,0,Math.PI*2);
  oCtx.fillStyle=`rgba(255,${Math.round(heat*180)},0,0.7)`;oCtx.fill();
}

function solidifyLava(x,y,flux){
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const nx=Math.round(x+dx),ny=Math.round(y+dy);
    if(!onPlanet(nx,ny)) continue;
    const d=Math.sqrt(dx*dx+dy*dy);if(d>3) continue;
    const frac=1-d/3;
    const ni=ny*W+nx;
    const oldH=heightmap[ni];
    const addH=frac*flux*0.04;
    heightmap[ni]=Math.min(0.4,oldH+addH);
    newLandPx++;
    oCtx.beginPath();oCtx.arc(nx,ny,1.5,0,Math.PI*2);
    oCtx.fillStyle=`rgba(55,35,20,${0.5+frac*0.4})`;oCtx.fill();
  }
}

function updateAsh(){
  for(let a of ashParticles){
    a.x+=a.vx;a.y+=a.vy;
    a.vy+=0.06;a.vx*=0.98;
    a.life-=0.018;
  }
  ashParticles=ashParticles.filter(a=>a.life>0);
}

function spawnTip(x,y,angle,type,energy){
  if(!onPlanet(x,y)) return;
  tips.push({x,y,angle,px:x,py:y,energy:energy||300,type,trail:[],alive:true,flux:0.4+Math.random()*0.6});
}

function initRivers(){
  for(let i=0;i<22;i++){
    let x,y,tr=0;
    do{x=CX+(Math.random()-0.5)*R*1.8;y=CY+(Math.random()-0.5)*R*1.8;tr++;}
    while((!onPlanet(x,y)||heightAt(x,y)<0.35)&&tr<80);
    if(onPlanet(x,y)&&heightAt(x,y)>0.3) spawnTip(x,y,Math.random()*Math.PI*2,'river',400+Math.random()*150);
  }
}

function initOcean(){
  const gyres=[{cx:CX-80,cy:CY-65,dir:1,n:5},{cx:CX+85,cy:CY-65,dir:-1,n:5},{cx:CX-80,cy:CY+75,dir:-1,n:4},{cx:CX+85,cy:CY+75,dir:1,n:4}];
  for(let g of gyres)for(let i=0;i<g.n;i++){
    const a=(i/g.n)*Math.PI*2;
    const sx=g.cx+Math.cos(a)*(45+Math.random()*35),sy=g.cy+Math.sin(a)*(45+Math.random()*35);
    if(!onPlanet(sx,sy)||heightAt(sx,sy)>0.28) continue;
    spawnTip(sx,sy,a+Math.PI/2*g.dir,'ocean',550+Math.random()*150);
  }
}

function initWind(){
  const bands=[-0.82,-0.48,-0.14,0.14,0.48,0.82];
  const dirs=[1,-1,1,1,-1,1];
  for(let b=0;b<bands.length;b++){
    const by=CY+bands[b]*R;
    for(let i=0;i<7;i++){
      const bx=CX-R+(i/7)*R*2+(Math.random()-0.5)*25;
      if(!onPlanet(bx,by)) continue;
      spawnTip(bx,by,dirs[b]>0?0.1:Math.PI-0.1+(Math.random()-0.5)*0.5,'wind',480+Math.random()*120);
    }
  }
}

function updateTips(){
  for(let t of tips){
    if(!t.alive) continue;
    t.energy-=1;
    if(t.energy<=0){t.alive=false;flowCount++;continue;}
    let na=t.angle;
    if(t.type==='river'){
      const g=gradH(t.x,t.y);
      na+=(-g.x*Math.cos(t.angle)-g.y*Math.sin(t.angle))*0.42+(Math.random()-0.5)*0.13;
      if(heightAt(t.x,t.y)<0.28){t.flux=Math.min(1.5,t.flux+0.07);t.energy-=0.5;}
    }else if(t.type==='ocean'){
      const lat=latOf(t.y);na+=lat*0.17+(Math.random()-0.5)*0.07;
      const tg={x:(tempAt(t.x+2,t.y)-tempAt(t.x-2,t.y))/4,y:(tempAt(t.x,t.y+2)-tempAt(t.x,t.y-2))/4};
      na+=(-tg.x*Math.sin(t.angle)+tg.y*Math.cos(t.angle))*0.07;
      if(heightAt(t.x,t.y)>0.3){na+=Math.PI*0.3+(Math.random()-0.5)*0.5;t.energy-=14;}
    }else{
      const pg={x:(pressAt(t.x+2,t.y)-pressAt(t.x-2,t.y))/4,y:(pressAt(t.x,t.y+2)-pressAt(t.x,t.y-2))/4};
      na+=(-pg.x*Math.sin(t.angle)+pg.y*Math.cos(t.angle))*0.14+latOf(t.y)*0.1+(Math.random()-0.5)*0.14;
    }
    t.angle=na;
    const spd=t.type==='wind'?1.3:t.type==='ocean'?1.0:0.8;
    const nx=t.x+Math.cos(t.angle)*spd,ny=t.y+Math.sin(t.angle)*spd;
    if(!onPlanet(nx,ny)){if(t.type==='ocean')t.angle+=Math.PI*0.4+(Math.random()-0.5)*0.8;else t.alive=false;continue;}
    t.trail.push({x:t.x,y:t.y});if(t.trail.length>110)t.trail.shift();
    t.px=t.x;t.py=t.y;t.x=nx;t.y=ny;
    if(t.type==='river'&&Math.random()<0.004&&tips.length<180){spawnTip(t.x,t.y,t.angle+(Math.random()<0.5?0.7:-0.7),'river',t.energy*0.5);t.energy*=0.75;}
  }
  tips=tips.filter(t=>t.alive);
}

function burnTrails(){
  for(let t of tips){
    if(t.trail.length<2)continue;
    oCtx.beginPath();oCtx.moveTo(t.trail[t.trail.length-2].x,t.trail[t.trail.length-2].y);oCtx.lineTo(t.x,t.y);
    let sc;
    if(t.type==='river')sc=`rgba(70,158,214,${0.15+t.flux*0.2})`;
    else if(t.type==='ocean')sc='rgba(40,205,168,0.12)';
    else sc='rgba(215,190,80,0.08)';
    oCtx.strokeStyle=sc;oCtx.lineWidth=t.type==='river'?0.7+t.flux*0.6:t.type==='ocean'?1:0.5;oCtx.stroke();
  }
}

function drawTerrain(){
  oCtx.clearRect(0,0,W,H);
  const id=oCtx.createImageData(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    const d=Math.sqrt((x-CX)*(x-CX)+(y-CY)*(y-CY));
    if(d>R){id.data[i+3]=0;continue;}
    const h=heightmap[y*W+x];
    let r,g,b;
    if(h<0.18){r=12;g=28;b=55;}
    else if(h<0.25){r=18;g=38;b=72;}
    else if(h<0.3){r=22;g=52;b=85;}
    else if(h<0.35){r=155;g=143;b=100;}
    else if(h<0.46){r=72;g=90;b=50;}
    else if(h<0.6){r=56;g=75;b=38;}
    else if(h<0.74){r=85;g=83;b=70;}
    else{r=205;g=205;b=200;}
    const shd=0.75+h*0.3;
    id.data[i]=Math.min(255,r*shd);id.data[i+1]=Math.min(255,g*shd);id.data[i+2]=Math.min(255,b*shd);id.data[i+3]=255;
  }
  oCtx.putImageData(id,0,0);
}

function render(){
  ctx.clearRect(0,0,W,H);
  ctx.save();ctx.beginPath();ctx.arc(CX,CY,R,0,Math.PI*2);ctx.clip();
  ctx.drawImage(offscreen,0,0);
  const showR=(layer==='all'||layer==='rivers');
  const showO=(layer==='all'||layer==='ocean');
  const showW=(layer==='all'||layer==='wind');
  for(let t of tips){
    if(!t.alive||t.trail.length<2)continue;
    if(t.type==='river'&&!showR)continue;
    if(t.type==='ocean'&&!showO)continue;
    if(t.type==='wind'&&!showW)continue;
    const er=t.energy/500;
    ctx.beginPath();ctx.moveTo(t.trail[0].x,t.trail[0].y);
    for(let i=1;i<t.trail.length;i++)ctx.lineTo(t.trail[i].x,t.trail[i].y);
    let sc;
    if(t.type==='river')sc=`rgba(95,183,239,${0.12+er*0.22})`;
    else if(t.type==='ocean')sc=`rgba(55,215,180,${0.09+er*0.14})`;
    else sc=`rgba(225,200,95,${0.07+er*0.1})`;
    ctx.strokeStyle=sc;ctx.lineWidth=t.type==='river'?0.7+t.flux*0.45:0.55;ctx.stroke();
    ctx.beginPath();ctx.arc(t.x,t.y,1.5,0,Math.PI*2);
    ctx.fillStyle=t.type==='river'?'rgba(110,195,255,0.7)':t.type==='ocean'?'rgba(55,225,195,0.6)':'rgba(235,215,100,0.5)';ctx.fill();
  }
  for(let p of lavaParticles){
    if(!p.alive||p.trail.length<2)continue;
    const heat=Math.max(0,1-p.cooling*3);
    ctx.beginPath();ctx.moveTo(p.trail[0].x,p.trail[0].y);
    for(let i=1;i<p.trail.length;i++)ctx.lineTo(p.trail[i].x,p.trail[i].y);
    ctx.strokeStyle=`rgba(255,${Math.round(heat*100)},0,${0.2+heat*0.35})`;
    ctx.lineWidth=0.8+p.flux*0.8;ctx.stroke();
    ctx.beginPath();ctx.arc(p.x,p.y,2,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,${Math.round(heat*160)},20,0.85)`;ctx.fill();
  }
  for(let a of ashParticles){
    ctx.beginPath();ctx.arc(a.x,a.y,a.size,0,Math.PI*2);
    const g2=Math.round(a.grey*200);
    ctx.fillStyle=`rgba(${g2},${g2},${g2},${a.life*0.6})`;ctx.fill();
  }
  for(let i=0;i<volcanoes.length;i++){
    const v=volcanoes[i];
    const glow=0.3+Math.sin(v.glowPhase)*0.15+(v.active?0.25:0);
    ctx.beginPath();ctx.arc(v.x,v.y,12+Math.sin(v.glowPhase)*2,0,Math.PI*2);
    ctx.fillStyle=`rgba(200,80,10,${glow*0.25})`;ctx.fill();
    ctx.beginPath();ctx.arc(v.x,v.y,5,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,${v.active?160:60},0,${0.7+glow*0.3})`;ctx.fill();
    ctx.beginPath();ctx.arc(v.x,v.y,2,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,240,200,${0.8+glow*0.2})`;ctx.fill();
  }
  ctx.restore();
  const rim=ctx.createRadialGradient(CX,CY,R-6,CX,CY,R+4);
  rim.addColorStop(0,'rgba(0,0,0,0)');rim.addColorStop(1,'rgba(0,0,0,0.78)');
  ctx.beginPath();ctx.arc(CX,CY,R+4,0,Math.PI*2);ctx.fillStyle=rim;ctx.fill();
  const atm=ctx.createRadialGradient(CX,CY,R,CX,CY,R+16);
  atm.addColorStop(0,'rgba(40,80,130,0.1)');atm.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(CX,CY,R+16,0,Math.PI*2);ctx.fillStyle=atm;ctx.fill();
}

function init(){
  tips=[];lavaParticles=[];ashParticles=[];flowCount=0;newLandPx=0;eruptionCount=0;frame=0;
  offscreen=document.createElement('canvas');offscreen.width=W;offscreen.height=H;
  oCtx=offscreen.getContext('2d');
  buildMaps();drawTerrain();initVolcanoes();
  if(layer==='all'||layer==='rivers') initRivers();
  if(layer==='all'||layer==='ocean') initOcean();
  if(layer==='all'||layer==='wind') initWind();
}

function loop(){
  frame++;
  updateVolcanoes();
  updateLava();
  updateAsh();
  if(frame%2===0) burnTrails();
  updateTips();
  if(tips.length<12&&frame>80){
    if(layer==='all'||layer==='rivers') initRivers();
    if(layer==='all'||layer==='ocean') initOcean();
    if(layer==='all'||layer==='wind') initWind();
  }
  render();
  document.getElementById('vflows').textContent=flowCount+tips.length;
  document.getElementById('vnewland').textContent=Math.round(newLandPx/10)*10;
  document.getElementById('verupt').textContent=eruptionCount;
  requestAnimationFrame(loop);
}

function setLayer(l,el){
  layer=l;
  document.querySelectorAll('#vctrl button').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  init();
}
function resetAll(){init();}

init();loop();