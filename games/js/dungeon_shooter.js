const W=800,H=600,HH=H/2,TILE=64,MW=50,MH=50,FOV=Math.PI/3,RAYS=320,CW=W/RAYS,RS=FOV/RAYS;
const c=document.getElementById('c');c.width=W;c.height=H;const ctx=c.getContext('2d');
if(!CanvasRenderingContext2D.prototype.roundRect){CanvasRenderingContext2D.prototype.roundRect=function(x,y,w,h,r){this.beginPath();this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.arcTo(x+w,y,x+w,y+r,r);this.lineTo(x+w,y+h-r);this.arcTo(x+w,y+h,x+w-r,y+h,r);this.lineTo(x+r,y+h);this.arcTo(x,y+h,x,y+h-r,r);this.lineTo(x,y+r);this.arcTo(x,y,x+r,y,r);this.closePath();return this}}

// --- SPRITE LOADING ---
function loadSprite(src){const img=new Image();img.src=src;img.onerror=()=>{img._failed=true};return img}
const sprArmoredDefender=loadSprite('../assets/sprites/armored_defender_sprite_sheet.png');
const sprDimMak=loadSprite('../assets/sprites/dim_mak_fighter_full_sheet.png');
const sprKraken=loadSprite('../assets/sprites/kraken_game_render.png');
const sprMecha=loadSprite('../assets/sprites/mecha_entity_alpha_v2_pixel.png');
const sprGeodeCore=loadSprite('../assets/sprites/geometric_core_geode_flux.png');
function sprReady(img){return img.complete&&img.naturalWidth>0&&!img._failed}

// --- COLLECTIBLE CORES ---
let cores=[];
let coreCount=0;
class Core{constructor(x,y){this.x=x;this.y=y;this.collected=false;this.bobT=Math.random()*Math.PI*2}}

// --- Per-enemy-type hitbox radii ---
// Bullet-enemy intersection uses these instead of a flat 32px for all types
const ENEMY_HITBOX = {
    armored:  { radius: 28 },   // standard humanoid
    dim_mak:  { radius: 22 },   // smaller, faster target
    kraken:   { radius: 44 },   // big boss, easier to hit
};
// Core collection radius
const CORE_PICKUP_RADIUS = 24;
// Player collision padding
const PLAYER_COLLISION_PAD = 18;

function getEnemyHitRadius(e) {
    const cfg = ENEMY_HITBOX[e.etype];
    return cfg ? cfg.radius : 28;
}

// ── THE FIVE WORLDS (from The Threshold) ──
const WORLDS=[
  {name:'PINK HOUR',wall:[0.45,0.15,0.30],ceil:[0.12,0.04,0.10],floor:[0.08,0.03,0.06],fog:[0.12,0.04,0.10],accent:'#ff66aa'},
  {name:'THE BLOCK',wall:[0.12,0.35,0.22],ceil:[0.02,0.06,0.04],floor:[0.03,0.05,0.03],fog:[0.02,0.03,0.06],accent:'#00ff9d'},
  {name:'THE THRESHOLD',wall:[0.30,0.28,0.25],ceil:[0.04,0.05,0.06],floor:[0.06,0.05,0.04],fog:[0.02,0.04,0.05],accent:'#00b8c8'},
  {name:'VAULT COMPOUND 7',wall:[0.35,0.22,0.10],ceil:[0.06,0.04,0.02],floor:[0.05,0.03,0.02],fog:[0.03,0.02,0.01],accent:'#ff8833'},
  {name:'THE BETWEEN',wall:[0.12,0.15,0.28],ceil:[0.01,0.02,0.04],floor:[0.02,0.02,0.05],fog:[0.0,0.0,0.02],accent:'#6688ff'},
];
let roomWorlds=[];
function assignRoomWorlds(rooms){roomWorlds=rooms.map((_,i)=>WORLDS[i%WORLDS.length])}
function getWorldAtPos(px,py){
  // Find which room the position is closest to
  let best=0,bestD=1e9;
  for(let i=0;i<ROOMS.length;i++){
    const dx=px/TILE-ROOMS[i][0],dy=py/TILE-ROOMS[i][1],d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;best=i}
  }
  return roomWorlds[best]||WORLDS[0];
}
// Heartbeat pulse (0.7s from Vault Compound 7 lore)
function heartbeatPulse(t,hp,maxHp){
  if(hp>maxHp*0.4)return 0;
  const urgency=1-(hp/(maxHp*0.4));
  return Math.pow(Math.max(0,Math.sin(t/0.7*Math.PI*2)),4)*urgency*0.3;
}

let GRID,ROOMS;function genDungeon(w,h){const g=[];for(let y=0;y<h;y++)g[y]=new Uint8Array(w).fill(1);const rooms=[];for(let i=0;i<15;i++){const rw=6+~~(Math.random()*7),rh=6+~~(Math.random()*7),rx=1+~~(Math.random()*(w-rw-2)),ry=1+~~(Math.random()*(h-rh-2));for(let dy=ry;dy<ry+rh;dy++)for(let dx=rx;dx<rx+rw;dx++)g[dy][dx]=0;rooms.push([rx+~~(rw/2),ry+~~(rh/2)])}for(let i=0;i<rooms.length-1;i++){const[x1,y1]=rooms[i],[x2,y2]=rooms[i+1];for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)g[y1][x]=0;for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)g[y][x2]=0}for(let x=0;x<w;x++){g[0][x]=1;g[h-1][x]=1}for(let y=0;y<h;y++){g[y][0]=1;g[y][w-1]=1}return{grid:g,rooms:rooms}}
function isO(x,y){const tx=~~(x/TILE),ty=~~(y/TILE);return tx>=0&&tx<MW&&ty>=0&&ty<MH&&GRID[ty][tx]===0}
class Bullet{constructor(x,y,a){this.x=x;this.y=y;this.a=a+(Math.random()-.5)*.04;this.vx=Math.cos(this.a)*1800;this.vy=Math.sin(this.a)*1800;this.life=1.2;this.trail=[]}update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.trail.push([this.x,this.y]);if(this.trail.length>5)this.trail.shift();this.life-=dt;return isO(this.x,this.y)&&this.life>0}}
class Particle{constructor(x,y,vx,vy,col,life=1){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.color=col;this.life=this.ml=life}update(dt){this.x+=this.vx*dt*120;this.y+=this.vy*dt*120;this.vx*=.96;this.vy*=.96;this.life-=dt*2.5;return this.life>0}}
class Enemy{constructor(tx,ty){this.x=tx*TILE+32;this.y=ty*TILE+32;this.angle=Math.random()*Math.PI*2;this.hp=3;this.mhp=3;this.state='PATROL';this.speed=75+Math.random()*40;this.pt=Math.random()*2;this.pd=Math.random()*Math.PI*2;this.at=0;this.alt=0;this.hf=0;
// Assign enemy type: 70% armored, 25% dim_mak, 5% kraken
const roll=Math.random();if(roll<0.05){this.etype='kraken';this.hp=8;this.mhp=8;this.speed*=0.7}else if(roll<0.30){this.etype='dim_mak';this.hp=3;this.mhp=3;this.speed*=1.15}else{this.etype='armored';this.hp=3;this.mhp=3}
}losCheck(px,py){const dx=px-this.x,dy=py-this.y,d=Math.hypot(dx,dy);const sightRange=this.etype==='kraken'?520:420;if(d>sightRange)return false;const s=Math.max(8,Math.ceil(d/12));for(let i=1;i<s;i++){const t=i/s;if(!isO(this.x+dx*t,this.y+dy*t))return false}return true}update(dt,p,parts){if(this.state==='DEAD')return;this.hf=Math.max(0,this.hf-dt*8);const d=Math.hypot(p.x-this.x,p.y-this.y),cs=this.losCheck(p.x,p.y);const atkRange=this.etype==='kraken'?90:this.etype==='dim_mak'?55:70;if(cs){this.alt=3.5;this.state=d<atkRange?'ATTACK':'CHASE'}else{this.alt-=dt;if(this.alt<=0)this.state='PATROL';else if(this.state!=='ATTACK')this.state='CHASE'}if(this.state==='PATROL'){this.pt-=dt;if(this.pt<=0){this.pd=Math.random()*Math.PI*2;this.pt=1+Math.random()*2.5}const s=this.speed*.45*dt,nx=this.x+Math.cos(this.pd)*s,ny=this.y+Math.sin(this.pd)*s;if(isO(nx,this.y))this.x=nx;else this.pd+=Math.PI*.5;if(isO(this.x,ny))this.y=ny;else this.pd+=Math.PI*.5}else if(this.state==='CHASE'){const a=Math.atan2(p.y-this.y,p.x-this.x),s=this.speed*dt;if(isO(this.x+Math.cos(a)*s,this.y))this.x+=Math.cos(a)*s;if(isO(this.x,this.y+Math.sin(a)*s))this.y+=Math.sin(a)*s}else if(this.state==='ATTACK'){this.at-=dt;if(this.at<=0){p.hp-=7+Math.random()*6;p.shakeT=.25;this.at=1.4;for(let i=0;i<4;i++)parts.push(new Particle(p.x,p.y,(Math.random()-.5)*1.5,(Math.random()-.5)*1.5,[255,50,50],.4))}}this.angle=Math.atan2(p.y-this.y,p.x-this.x)}hit(parts){this.hp--;this.hf=1;for(let i=0;i<10;i++)parts.push(new Particle(this.x,this.y,(Math.random()-.5)*3.5,(Math.random()-.5)*3.5,[200+Math.random()*55,20+Math.random()*30,20],.9));if(this.hp<=0)this.state='DEAD'}}
class Player{constructor(tx,ty){this.x=tx*TILE+32;this.y=ty*TILE+32;this.angle=0;this.hp=100;this.mhp=100;this.ammo=12;this.mammo=12;this.recoil=0;this.mt=0;this.reloading=false;this.rt=0;this.fl=false;this.bat=20;this.sway=0;this.bob=0;this.shakeT=0;this.sx=0;this.sy=0;this.kills=0}update(dt,keys,md){this.angle+=md*.003;if(this.shakeT>0){this.shakeT-=dt;this.sx=(Math.random()-.5)*8;this.sy=(Math.random()-.5)*8}else{this.sx=0;this.sy=0}const spd=(keys.ShiftLeft||keys.ShiftRight?420:240)*dt,ca=Math.cos(this.angle),sa=Math.sin(this.angle);let dx=0,dy=0;if(keys.KeyW){dx+=ca;dy+=sa}if(keys.KeyS){dx-=ca;dy-=sa}if(keys.KeyA){dx+=sa;dy-=ca}if(keys.KeyD){dx-=sa;dy+=ca}if(dx||dy){this.sway+=dt*12;this.bob+=dt*15;const P=PLAYER_COLLISION_PAD;if(isO(this.x+dx*spd+Math.sign(dx||1)*P,this.y))this.x+=dx*spd;if(isO(this.x,this.y+dy*spd+Math.sign(dy||1)*P))this.y+=dy*spd}this.recoil=Math.max(0,this.recoil-dt*110);this.mt=Math.max(0,this.mt-dt*20);if(this.reloading){this.rt-=dt;if(this.rt<=0){this.ammo=this.mammo;this.reloading=false}}if(this.fl){this.bat=Math.max(0,this.bat-dt);if(this.bat<=0)this.fl=false}}}
const zbuf=new Float32Array(RAYS);function castRays(p){const sa=p.angle-FOV/2;for(let r=0;r<RAYS;r++){const ra=sa+r*RS,cr=Math.cos(ra),sr=Math.sin(ra);let mx=~~(p.x/TILE),my=~~(p.y/TILE);const ic=Math.abs(cr)<1e-6?1e6:Math.abs(1/cr),is=Math.abs(sr)<1e-6?1e6:Math.abs(1/sr);let stx,sty,sdx,sdy;if(cr<0){stx=-1;sdx=(p.x/TILE-mx)*ic}else{stx=1;sdx=(mx+1-p.x/TILE)*ic}if(sr<0){sty=-1;sdy=(p.y/TILE-my)*is}else{sty=1;sdy=(my+1-p.y/TILE)*is}let side=0;for(let i=0;i<120;i++){if(sdx<sdy){sdx+=ic;mx+=stx;side=0}else{sdy+=is;my+=sty;side=1}if(mx<0||mx>=MW||my<0||my>=MH||GRID[my][mx]===1)break}let pd;if(side===0)pd=Math.abs((mx-p.x/TILE+(1-stx)/2)/(cr||1e-6));else pd=Math.abs((my-p.y/TILE+(1-sty)/2)/(sr||1e-6));pd*=TILE;zbuf[r]=pd;let br=Math.min(255,18000/(pd+1));if(side===1)br*=.65;let lm=1;if(p.fl){const d=Math.abs(ra-p.angle);if(d<.38)lm+=3*(1-d/.38)}if(p.mt>0)lm+=.5*p.mt;const cl=Math.min(255,br*lm),wh=Math.min(H,(TILE*650)/(pd+.1)),wy=HH-wh/2,x=r*CW;// World-colored walls (The Threshold cross-pollination)
const hitX=p.x+Math.cos(ra)*pd,hitY=p.y+Math.sin(ra)*pd;
const world=getWorldAtPos(hitX,hitY);
const wc=world.wall;
const r0=Math.min(255,cl*wc[0]*3.5),g0=Math.min(255,cl*wc[1]*3.5),b0=Math.min(255,cl*wc[2]*3.5);
const r1=r0*0.45,g1=g0*0.45,b1=b0*0.45;
const gr=ctx.createLinearGradient(x,wy,x,wy+wh);gr.addColorStop(0,`rgb(${~~r0},${~~g0},${~~b0})`);gr.addColorStop(1,`rgb(${~~r1},${~~g1},${~~b1})`);ctx.fillStyle=gr;ctx.fillRect(x,wy,CW+.5,wh)}}

// --- Get sprite for enemy type ---
function getEnemySprite(e){
if(e.etype==='kraken')return sprKraken;
if(e.etype==='dim_mak')return sprDimMak;
return sprArmoredDefender;
}

function renderEnemies(p,enemies){const vis=enemies.filter(e=>e.state!=='DEAD').map(e=>{const dx=e.x-p.x,dy=e.y-p.y;return{e,dist:Math.hypot(dx,dy),dx,dy}}).sort((a,b)=>b.dist-a.dist);for(const{e,dist}of vis){let rel=Math.atan2(e.y-p.y,e.x-p.x)-p.angle;while(rel>Math.PI)rel-=Math.PI*2;while(rel<-Math.PI)rel+=Math.PI*2;if(Math.abs(rel)>FOV/2+.15)continue;const sx=((rel/FOV)+.5)*W,sh=Math.min(H*.9,(TILE*640)/(dist+.1)),sw=sh*.48,x0=sx-sw/2,y0=HH-sh/2;const r0=Math.max(0,~~(x0/CW)),r1=Math.min(RAYS-1,Math.ceil((x0+sw)/CW));let v=false;for(let r=r0;r<=r1;r++)if(zbuf[r]>dist){v=true;break}if(!v)continue;const a=Math.min(1,Math.max(.15,1-dist/420)),f=e.hf;

// Try sprite rendering
const spr=getEnemySprite(e);
if(sprReady(spr)){
  // Draw sprite from top-left 200x200 region, scaled to billboard size
  const srcSz=200;
  ctx.globalAlpha=a;
  ctx.drawImage(spr,0,0,srcSz,srcSz,x0,y0,sw,sh);
  // Hit flash: overlay white rectangle
  if(f>0){
    ctx.fillStyle=`rgba(255,255,255,${f*0.6})`;
    ctx.fillRect(x0,y0,sw,sh);
  }
  ctx.globalAlpha=1;
}else{
  // Fallback: original colored rectangle rendering
  let br,bg,bb;if(e.state==='ATTACK'){br=255;bg=40+f*215;bb=40}else if(e.state==='CHASE'){br=255;bg=140+f*80;bb=30}else{br=60+f*195;bg=60;bb=90+f*30}ctx.fillStyle=`rgba(${br},${bg},${bb},${a*(f>0?1:.92)})`;ctx.fillRect(x0+sw*.22,y0+sh*.28,sw*.55,sh*.5);ctx.beginPath();ctx.arc(sx,y0+sh*.18,sw*.21,0,Math.PI*2);ctx.fill();ctx.fillRect(x0+sw*.22,y0+sh*.78,sw*.22,sh*.2);ctx.fillRect(x0+sw*.55,y0+sh*.78,sw*.22,sh*.2);ctx.fillRect(x0,y0+sh*.3,sw*.22,sh*.35);ctx.fillRect(x0+sw*.78,y0+sh*.3,sw*.22,sh*.35);ctx.fillStyle=`rgba(255,30,30,${a})`;const ey=y0+sh*.15,er=Math.max(1,sw*.06);ctx.beginPath();ctx.arc(sx-sw*.08,ey,er,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sx+sw*.08,ey,er,0,Math.PI*2);ctx.fill();
}

// Health bar (always renders above sprite)
if(e.state!=='PATROL'&&dist<280){const bw=sw*.9,bx=x0+sw*.05,by=y0-10;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(bx,by,bw,5);ctx.fillStyle=e.hp>1?'#4f8':'#f44';ctx.fillRect(bx,by,bw*(e.hp/e.mhp),5)}

// Boss label for kraken
if(e.etype==='kraken'&&dist<350){ctx.fillStyle='rgba(255,60,60,.9)';ctx.font='bold 12px Impact';ctx.textAlign='center';ctx.fillText('BOSS',sx,y0-16);ctx.textAlign='left'}
}}

// --- Render collectible cores as 3D billboards ---
let gameTime=0;
function renderCores(p){
for(const core of cores){
  if(core.collected)continue;
  const dx=core.x-p.x,dy=core.y-p.y,dist=Math.hypot(dx,dy);
  if(dist>500)continue;
  let rel=Math.atan2(core.y-p.y,core.x-p.x)-p.angle;
  while(rel>Math.PI)rel-=Math.PI*2;
  while(rel<-Math.PI)rel+=Math.PI*2;
  if(Math.abs(rel)>FOV/2+.15)continue;
  const sx=((rel/FOV)+.5)*W;
  const sh=Math.min(H*.4,(TILE*280)/(dist+.1));
  const sw=sh;
  const bobOff=Math.sin(gameTime*3+core.bobT)*sh*0.08;
  const x0=sx-sw/2,y0=HH-sh/2+bobOff;
  // Z-buffer check
  const r0=Math.max(0,~~(x0/CW)),r1=Math.min(RAYS-1,Math.ceil((x0+sw)/CW));
  let vis=false;
  for(let r=r0;r<=r1;r++)if(zbuf[r]>dist){vis=true;break}
  if(!vis)continue;
  const a=Math.min(1,Math.max(.2,1-dist/450));
  if(sprReady(sprGeodeCore)){
    ctx.globalAlpha=a;
    ctx.drawImage(sprGeodeCore,0,0,sprGeodeCore.naturalWidth,sprGeodeCore.naturalHeight,x0,y0,sw,sh);
    // Glow effect
    ctx.globalAlpha=a*0.25;
    ctx.fillStyle='#0ff';
    ctx.beginPath();ctx.arc(sx,y0+sh/2,sw*0.6,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }else{
    // Fallback: cyan diamond
    ctx.globalAlpha=a;
    ctx.fillStyle='#0ff';
    ctx.save();ctx.translate(sx,y0+sh/2);ctx.rotate(Math.PI/4);
    ctx.fillRect(-sw*.2,-sw*.2,sw*.4,sw*.4);
    ctx.restore();
    ctx.globalAlpha=1;
  }
}
}

function renderGun(p){const sx=Math.sin(p.sway)*18,sy=Math.abs(Math.cos(p.sway))*14,ry=p.recoil*1.6,gx=W/2+sx+55,gy=H-175+sy+ry;ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(gx+4,gy+4,85,220);ctx.fillStyle='#1e2228';ctx.roundRect(gx,gy,85,30,5);ctx.fill();ctx.fillStyle='#2a2f38';ctx.roundRect(gx+4,gy+30,77,185,8);ctx.fill();ctx.fillStyle='#383f4a';ctx.roundRect(gx+12,gy+50,16,90,4);ctx.fill();ctx.fillStyle='#1a1d22';ctx.roundRect(gx+34,gy+8,18,14,3);ctx.fill();if(p.reloading){const pr=1-p.rt/1.5;ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(gx+8,gy+195,68,6);ctx.fillStyle='#4fa';ctx.fillRect(gx+8,gy+195,68*pr,6)}if(p.mt>0){const fs=30+Math.random()*20*p.mt,fx=gx+42,fy=gy-5,g2=ctx.createRadialGradient(fx,fy,0,fx,fy,fs);g2.addColorStop(0,'rgba(255,240,120,.95)');g2.addColorStop(.4,'rgba(255,130,30,.7)');g2.addColorStop(1,'rgba(255,60,0,0)');ctx.fillStyle=g2;ctx.beginPath();ctx.arc(fx,fy,fs,0,Math.PI*2);ctx.fill()}}
function renderHUD(p,enemies){
// Character portrait (mecha entity) - bottom left
if(sprReady(sprMecha)){
  ctx.fillStyle='rgba(0,0,0,.6)';
  ctx.fillRect(14,H-142,36,36);
  ctx.drawImage(sprMecha,0,0,sprMecha.naturalWidth,sprMecha.naturalHeight,15,H-141,34,34);
  ctx.strokeStyle='rgba(100,255,200,.5)';ctx.lineWidth=1;ctx.strokeRect(14,H-142,36,36);
}

ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(18,H-96,210,18);const hr=p.hp/p.mhp;ctx.fillStyle=hr>.5?'#3f8':hr>.25?'#fa0':'#f44';ctx.fillRect(20,H-94,Math.max(0,hr*206),14);ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='bold 13px Impact';ctx.textAlign='left';ctx.fillText('HP '+Math.max(0,~~p.hp),22,H-102);const ac=p.ammo>4?'#4fa':'#f80';ctx.fillStyle=ac;ctx.font='bold 22px Impact';ctx.fillText(p.ammo+' / '+p.mammo,22,H-124);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(18,H-58,150,12);ctx.fillStyle=p.bat>8?'#4fa':'#fa0';ctx.fillRect(20,H-56,Math.max(0,p.bat/20*146),8);ctx.fillStyle='rgba(255,80,80,.85)';ctx.font='bold 14px Impact';ctx.textAlign='right';ctx.fillText('ENEMIES: '+enemies.filter(e=>e.state!=='DEAD').length,W-15,H-15);ctx.fillStyle='rgba(200,255,200,.7)';ctx.fillText('KILLS: '+p.kills,W-15,H-35);

// Core count HUD
ctx.fillStyle='rgba(0,255,255,.85)';ctx.font='bold 14px Impact';ctx.fillText('CORES: '+coreCount+'/'+cores.length,W-15,H-55);

if(p.fl){ctx.fillStyle='rgba(255,255,80,.9)';ctx.fillText('FLASHLIGHT ON',W-15,20)}if(p.reloading){ctx.fillStyle='rgba(255,180,0,.9)';ctx.font='bold 26px Impact';ctx.textAlign='center';ctx.fillText('RELOADING...',W/2,H/2+60)}if(p.ammo===0&&!p.reloading){ctx.fillStyle='rgba(255,60,60,.9)';ctx.font='bold 22px Impact';ctx.textAlign='center';ctx.fillText('PRESS R TO RELOAD',W/2,H/2+60)}ctx.textAlign='left'}
function renderCH(p){const cx=W/2,cy=H/2,sp=4+p.recoil*.25;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cx-sp-9,cy);ctx.lineTo(cx-sp,cy);ctx.moveTo(cx+sp,cy);ctx.lineTo(cx+sp+9,cy);ctx.moveTo(cx,cy-sp-9);ctx.lineTo(cx,cy-sp);ctx.moveTo(cx,cy+sp);ctx.lineTo(cx,cy+sp+9);ctx.stroke();ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.arc(cx,cy,1.5,0,Math.PI*2);ctx.fill()}
let mmCache=null;function buildMM(){const mc=document.createElement('canvas');mc.width=150;mc.height=150;const mx=mc.getContext('2d');const ts=150/MW;mx.fillStyle='#0a0a1a';mx.fillRect(0,0,150,150);for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(GRID[y][x]===1){mx.fillStyle='#2a3050';mx.fillRect(x*ts,y*ts,ts,ts)}return mc}
function renderMM(p,enemies){const mx=W-160,my=10,sz=150,ts=sz/MW;ctx.globalAlpha=.75;if(!mmCache)mmCache=buildMM();ctx.drawImage(mmCache,mx,my);for(const e of enemies){if(e.state==='DEAD')continue;ctx.fillStyle=e.etype==='kraken'?'#f0f':e.state==='PATROL'?'#f80':'#f22';const mmR=getEnemyHitRadius(e)/TILE*ts;ctx.beginPath();ctx.arc(mx+(e.x/TILE)*ts,my+(e.y/TILE)*ts,Math.max(2,mmR),0,Math.PI*2);ctx.fill()}
// Draw cores on minimap
for(const core of cores){if(core.collected)continue;ctx.fillStyle='#0ff';ctx.beginPath();ctx.arc(mx+(core.x/TILE)*ts,my+(core.y/TILE)*ts,2,0,Math.PI*2);ctx.fill()}
const px=mx+(p.x/TILE)*ts,py=my+(p.y/TILE)*ts;ctx.fillStyle='#0f8';ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(0,255,128,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(p.angle-FOV/2)*18,py+Math.sin(p.angle-FOV/2)*18);ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(p.angle+FOV/2)*18,py+Math.sin(p.angle+FOV/2)*18);ctx.stroke();ctx.globalAlpha=1}
const keys={};let mdAccum=0,pLocked=false,fireQ=false;
document.addEventListener('keydown',e=>{if(['Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();keys[e.code]=true});
document.addEventListener('keyup',e=>{keys[e.code]=false});
document.addEventListener('mousemove',e=>{if(pLocked)mdAccum+=e.movementX});
document.addEventListener('mousedown',e=>{if(e.button===0&&pLocked)fireQ=true});
c.addEventListener('click',()=>{if(state==='PLAYING'&&!pLocked)c.requestPointerLock()});
document.addEventListener('pointerlockchange',()=>{pLocked=document.pointerLockElement===c});
let state='MENU',player=null,bullets=[],particles=[],enemies=[];
// MODE 1: CREATIVE — explore, no enemies, build walls with click
// MODE 2: SURVIVAL — full combat (default)
let gameMode='SURVIVAL'; // toggle with TAB
let rafId=null;
function spawnE(rooms){const r=[];for(let i=1;i<rooms.length;i++){const n=1+~~(Math.random()*3);for(let j=0;j<n;j++){const[rx,ry]=rooms[i],cx=Math.max(1,Math.min(MW-2,rx+Math.round((Math.random()-.5)*4))),cy=Math.max(1,Math.min(MH-2,ry+Math.round((Math.random()-.5)*4)));if(GRID[cy][cx]===0)r.push(new Enemy(cx,cy))}}return r}

// Spawn cores in random rooms (3-5 cores)
function spawnCores(rooms){
const result=[];
const count=3+~~(Math.random()*3);
const used=new Set();
for(let i=0;i<count;i++){
  let ri;
  do{ri=1+~~(Math.random()*(rooms.length-1))}while(used.has(ri)&&used.size<rooms.length-1);
  used.add(ri);
  const[rx,ry]=rooms[ri];
  const cx=rx+Math.round((Math.random()-.5)*3);
  const cy=ry+Math.round((Math.random()-.5)*3);
  const px=Math.max(1,Math.min(MW-2,cx))*TILE+32;
  const py=Math.max(1,Math.min(MH-2,cy))*TILE+32;
  if(GRID[~~(py/TILE)][~~(px/TILE)]===0)result.push(new Core(px,py));
}
return result;
}

function startGame(){const dg=genDungeon(MW,MH);GRID=dg.grid;ROOMS=dg.rooms;assignRoomWorlds(ROOMS);mmCache=null;player=new Player(ROOMS[0][0],ROOMS[0][1]);bullets=[];particles=[];
// CREATIVE mode: no enemies. SURVIVAL mode: full combat.
enemies=gameMode==='CREATIVE'?[]:spawnE(ROOMS);
cores=spawnCores(ROOMS);coreCount=0;gameTime=0;state='PLAYING';mdAccum=0;
if(gameMode==='CREATIVE'){player.hp=9999;player.mhp=9999;player.ammo=999;player.mammo=999}
c.requestPointerLock()}
document.addEventListener('keydown',e=>{if(state==='MENU'){if(e.code==='Tab'){e.preventDefault();gameMode=gameMode==='SURVIVAL'?'CREATIVE':'SURVIVAL'}if(e.code==='Enter'||e.code==='Space')startGame()}if((e.code==='Escape'||e.code==='KeyP')&&state==='PLAYING'){state='PAUSED';document.exitPointerLock()}if((e.code==='Escape'||e.code==='KeyP')&&state==='PAUSED'){state='PLAYING';c.requestPointerLock()}if(state==='PLAYING'&&player){if(e.code==='KeyR'&&!player.reloading&&player.ammo<player.mammo){player.reloading=true;player.rt=1.5}if(e.code==='KeyF'&&player.bat>0)player.fl=!player.fl;if(e.code==='Space'&&player.ammo>0&&!player.reloading)fireQ=true}if((state==='DEAD'||state==='WIN')&&e.code==='Enter')state='MENU'});
let lastT=0;function loop(ts){const dt=Math.min(.05,(ts-lastT)/1000);lastT=ts;gameTime+=dt;
if(state==='MENU'){ctx.fillStyle='#020210';ctx.fillRect(0,0,W,H);ctx.fillStyle='#00b8c8';ctx.font='bold 52px Impact';ctx.textAlign='center';ctx.fillText('THE THRESHOLD',W/2,H/2-50);ctx.fillStyle='#ffd54a';ctx.font='bold 28px Impact';ctx.fillText('DUNGEON SHOOTER',W/2,H/2-5);ctx.fillStyle='rgba(0,255,210,.5)';ctx.font='11px "Courier New"';ctx.fillText('Five worlds. One dungeon. Still here.',W/2,H/2+30);ctx.fillStyle=gameMode==='CREATIVE'?'#00ffd2':'#ff6b4a';ctx.font='bold 18px Impact';ctx.fillText('MODE: '+gameMode,W/2,H/2+55);ctx.fillStyle='rgba(150,200,255,.5)';ctx.font='13px Arial';ctx.fillText('TAB to toggle mode',W/2,H/2+75);ctx.fillStyle='rgba(170,220,255,.7)';ctx.font='16px Arial';ctx.fillText('PRESS ENTER TO START',W/2,H/2+100);ctx.fillStyle='rgba(150,200,255,.4)';ctx.font='12px Arial';ctx.fillText(gameMode==='CREATIVE'?'WASD Move | Click Place/Remove Wall | F Flashlight':'WASD Move | Mouse Aim | Click Shoot | R Reload | F Flashlight',W/2,H/2+125);ctx.textAlign='left'}
else if(state==='PLAYING'){const md=mdAccum;mdAccum=0;player.update(dt,keys,md);const shoot=fireQ;fireQ=false;if(shoot&&gameMode==='CREATIVE'){
// CREATIVE MODE: click places/removes walls
const lookX=player.x+Math.cos(player.angle)*TILE*1.5,lookY=player.y+Math.sin(player.angle)*TILE*1.5;
const tx=~~(lookX/TILE),ty=~~(lookY/TILE);
if(tx>0&&tx<MW-1&&ty>0&&ty<MH-1){GRID[ty][tx]=GRID[ty][tx]===1?0:1;mmCache=null;
for(let i=0;i<6;i++)particles.push(new Particle(lookX,lookY,(Math.random()-.5)*2,(Math.random()-.5)*2,GRID[ty][tx]?[100,120,140]:[0,255,210],.6));
if(typeof thClick==='function')thClick()}
}else if(shoot&&player.ammo>0&&!player.reloading){player.ammo--;player.recoil=36;player.mt=1;bullets.push(new Bullet(player.x,player.y,player.angle));for(let i=0;i<10;i++)particles.push(new Particle(player.x,player.y,(Math.random()-.5)*2.2,(Math.random()-.5)*2.2,[255,200+~~(Math.random()*55),100+~~(Math.random()*80)],.9))}bullets=bullets.filter(b=>{if(!b.update(dt))return false;for(const e of enemies){if(e.state==='DEAD')continue;if(Math.hypot(e.x-b.x,e.y-b.y)<getEnemyHitRadius(e)){e.hit(particles);if(e.state==='DEAD')player.kills++;return false}}return true});for(const e of enemies)e.update(dt,player,particles);enemies=enemies.filter(e=>e.state!=='DEAD'||Math.random()>.008);particles=particles.filter(p=>p.update(dt));

// Core collection check
for(const core of cores){if(!core.collected&&Math.hypot(player.x-core.x,player.y-core.y)<CORE_PICKUP_RADIUS){core.collected=true;coreCount++;for(let i=0;i<8;i++)particles.push(new Particle(core.x,core.y,(Math.random()-.5)*2,(Math.random()-.5)*2,[0,255,255],.7))}}

if(enemies.every(e=>e.state==='DEAD')&&enemies.length===0)state='WIN';if(player.hp<=0){player.hp=0;state='DEAD';document.exitPointerLock()}ctx.save();if(player.shakeT>0)ctx.translate(player.sx,player.sy);// World-colored ceiling and floor
const curWorld=getWorldAtPos(player.x,player.y);
const cc=curWorld.ceil,fc=curWorld.floor;
ctx.fillStyle=`rgb(${~~(cc[0]*255)},${~~(cc[1]*255)},${~~(cc[2]*255)})`;ctx.fillRect(0,0,W,HH);
ctx.fillStyle=`rgb(${~~(fc[0]*255)},${~~(fc[1]*255)},${~~(fc[2]*255)})`;ctx.fillRect(0,HH,W,HH);
castRays(player);renderCores(player);renderEnemies(player,enemies);renderGun(player);renderCH(player);renderHUD(player,enemies);renderMM(player,enemies);ctx.restore();

// ── POST-PROCESSING (The Threshold standard) ──
// Vignette
const vig=ctx.createRadialGradient(W/2,H/2,H*.25,W/2,H/2,H*.7);
vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.4)');
ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

// Heartbeat pulse when low HP (0.7s cycle from Vault Compound 7)
const hbPulse=heartbeatPulse(gameTime,player.hp,player.mhp);
if(hbPulse>0.01){
  ctx.fillStyle=`rgba(${curWorld.name==='THE BETWEEN'?'40,60,180':'180,0,0'},${hbPulse})`;
  ctx.fillRect(0,0,W,H);
}

// World name indicator (fades in when entering new room)
ctx.fillStyle=curWorld.accent;ctx.globalAlpha=0.4;
ctx.font='bold 10px "Courier New"';ctx.textAlign='center';
ctx.fillText(curWorld.name,W/2,18);ctx.globalAlpha=1;ctx.textAlign='left';if(player.hp<100){const da=Math.min(.55,(100-player.hp)/180),vg=ctx.createRadialGradient(W/2,H/2,H*.25,W/2,H/2,H*.75);vg.addColorStop(0,'rgba(180,0,0,0)');vg.addColorStop(1,`rgba(180,0,0,${da})`);ctx.fillStyle=vg;ctx.fillRect(0,0,W,H)}if(!pLocked){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,W,H);ctx.fillStyle='rgba(255,255,255,.9)';ctx.font='bold 22px Impact';ctx.textAlign='center';ctx.fillText('CLICK TO CAPTURE MOUSE',W/2,H/2);ctx.textAlign='left'}}
else if(state==='PAUSED'){ctx.fillStyle='rgba(0,0,10,.85)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#0df';ctx.font='bold 50px Impact';ctx.textAlign='center';ctx.fillText('PAUSED',W/2,H/2-30);ctx.fillStyle='rgba(200,230,255,.6)';ctx.font='16px Arial';ctx.fillText('ESC / P to resume',W/2,H/2+20);ctx.textAlign='left'}
else if(state==='DEAD'){ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#f33';ctx.font='bold 80px Impact';ctx.textAlign='center';ctx.fillText('YOU DIED',W/2,H/2-20);ctx.fillStyle='rgba(255,160,160,.85)';ctx.font='bold 24px Impact';ctx.fillText('Kills: '+player.kills+'  Cores: '+coreCount,W/2,H/2+40);ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='18px Arial';ctx.fillText('PRESS ENTER',W/2,H/2+85);ctx.textAlign='left'}
else if(state==='WIN'){ctx.fillStyle='rgba(0,0,0,.82)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#4f8';ctx.font='bold 72px Impact';ctx.textAlign='center';ctx.fillText('DUNGEON CLEARED!',W/2,H/2-20);ctx.fillStyle='rgba(180,255,200,.85)';ctx.font='bold 26px Impact';ctx.fillText('Kills: '+player.kills+'  Cores: '+coreCount+'/'+cores.length,W/2,H/2+45);ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='18px Arial';ctx.fillText('PRESS ENTER',W/2,H/2+88);ctx.textAlign='left'}
rafId=requestAnimationFrame(loop)}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&rafId)cancelAnimationFrame(rafId)});
requestAnimationFrame(ts=>{lastT=ts;rafId=requestAnimationFrame(loop)});

// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'PINK HOUR';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6764520867222013;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.015675399037374742;mix-blend-mode:overlay';
  document.body.appendChild(grainCanvas);
  function updateGrain() {
    grainCanvas.width = window.innerWidth;
    grainCanvas.height = window.innerHeight;
    var ctx = grainCanvas.getContext('2d');
    var imageData = ctx.createImageData(grainCanvas.width, grainCanvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 16) {
      var v = Math.random() * 255;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 40;
    }
    ctx.putImageData(imageData, 0, 0);
  }
  setInterval(updateGrain, 100);
  updateGrain();
})();

// -- THRESHOLD AUDIO ENGINE --
var _thAudioCtx;
function thTone(freq, dur, type, vol) {
  if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var o = _thAudioCtx.createOscillator();
  var g = _thAudioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq || 440;
  o.detune.value = (Math.random() - 0.5) * 10; // happy little mistake
  g.gain.setValueAtTime((vol || 0.1), _thAudioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, _thAudioCtx.currentTime + (dur || 0.2));
  o.connect(g); g.connect(_thAudioCtx.destination);
  o.start(); o.stop(_thAudioCtx.currentTime + (dur || 0.2));
}
function thClick() { thTone(800, 0.06, 'sine', 0.08); }
function thSuccess() { thTone(523, 0.1, 'sine', 0.12); setTimeout(function(){thTone(659, 0.1, 'sine', 0.12)}, 70); setTimeout(function(){thTone(784, 0.15, 'triangle', 0.1)}, 140); }
function thFail() { thTone(200, 0.15, 'sawtooth', 0.06); }
function thPickup() { thTone(880, 0.08, 'sine', 0.1); setTimeout(function(){thTone(1100, 0.12, 'sine', 0.08)}, 50); }
document.addEventListener('click', function() { if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }, {once: true});

// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});

// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);

// CHAIN FIX: AUDIO-REACTIVE VISUALS
// The bee delivered the pollen. Now the flower breathes.
(function(){
  var vig = document.getElementById('threshold-vignette');
  var lastBass = 0;
  
  function pulse(){
    requestAnimationFrame(pulse);
    var bass = window.AUDIO_BASS || (parent && parent.AUDIO_BASS) || 0;
    var energy = window.AUDIO_ENERGY || (parent && parent.AUDIO_ENERGY) || 0;
    
    // Smooth the values (no sudden jumps)
    lastBass += (bass - lastBass) * 0.15;
    
    // Vignette breathes with bass (subtle — max 15% intensity change)
    if(vig){
      var intensity = 0.35 + (lastBass / 255) * 0.15;
      vig.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,' + intensity.toFixed(3) + '))';
    }
    
    // If there is a canvas, subtly shift its brightness
    // This is the audio-to-visual bridge — the terrain pulses, the walls breathe
    var c = document.querySelector('canvas');
    if(c && energy > 0.01){
      c.style.filter = 'brightness(' + (1 + energy * 0.08).toFixed(3) + ')';
    } else if(c) {
      c.style.filter = '';
    }
  }
  
  // Only start if music link is active
  var checkInterval = setInterval(function(){
    if(window.AUDIO_BASS !== undefined || (parent && parent.AUDIO_BASS !== undefined)){
      clearInterval(checkInterval);
      pulse();
    }
  }, 500);
})();