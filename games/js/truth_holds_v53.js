// ─── RGBA ───
function rgba(r,g,b,a=255){ return (a<<24)|(b<<16)|(g<<8)|r; }

// ─── Canvas setup ───
const W=320, H=200, M=1024, MASK=M-1;
const screen = document.getElementById("screen");
const sCtx   = screen.getContext("2d",{alpha:false});
screen.width=W; screen.height=H;

const oc   = document.getElementById("overlay-canvas");
const oCtx = oc.getContext("2d");
function resizeOC(){
  oc.width  = window.innerWidth;
  oc.height = window.innerHeight;
}
resizeOC();
window.addEventListener("resize", resizeOC);

const imgData = sCtx.createImageData(W,H);
const buf32   = new Uint32Array(imgData.data.buffer);

// ─── Terrain maps ───
const hMap=new Uint8Array(M*M),cMap=new Uint32Array(M*M);
const subHMap=new Uint8Array(M*M),subCMap=new Uint32Array(M*M);
const airHMap=new Uint8Array(M*M),airCMap=new Uint32Array(M*M);
const nX=new Int8Array(M*M),nY=new Int8Array(M*M);
const hiddenY=new Int32Array(W);
let activeH=hMap, activeC=cMap;

// ─── Input ───
const keys={};
window.addEventListener('keydown',e=>{ keys[e.code]=true; e.preventDefault(); });
window.addEventListener('keyup',e=>{ keys[e.code]=false; });

// ─── Pointer lock ───
let locked=false;
const lockPrompt=document.getElementById("lock-prompt");
document.addEventListener("pointerlockchange",()=>{
  locked=document.pointerLockElement===document.body;
  lockPrompt.classList.toggle("hidden",locked);
});
document.addEventListener("pointerlockerror",()=>{ locked=false; });
document.addEventListener("click",()=>{
  if(!locked) document.body.requestPointerLock();
  else if(state.gameState==="PLAYING") fireProjectile();
});
document.addEventListener("mousemove",e=>{
  if(!locked||state.gameState!=="PLAYING") return;
  state.a += e.movementX * 0.0022;
  state.pitch = Math.max(-60, Math.min(60, state.pitch + e.movementY * 0.35));
});

// ——— INVENTORY SYSTEM ———
class Inventory {
    constructor(capacityPerType) {
        this.slots = {
            MAGENTA: { count: 0, capacity: capacityPerType },
            CYAN:    { count: 0, capacity: capacityPerType },
            AMBER:   { count: 0, capacity: capacityPerType }
        };
    }

    add(type, amount) {
        const slot = this.slots[type];
        if (!slot) return false;
        const space = slot.capacity - slot.count;
        const added = Math.min(amount, space);
        if (added <= 0) return false;
        slot.count += added;
        return added;
    }

    remove(type, amount) {
        const slot = this.slots[type];
        if (!slot || slot.count < amount) return false;
        slot.count -= amount;
        return true;
    }

    getCount(type) { return this.slots[type]?.count || 0; }

    getTotal() {
        return this.slots.MAGENTA.count + this.slots.CYAN.count + this.slots.AMBER.count;
    }
}

// ─── State ───
const AMMO_MAX=6, AMMO_REGEN=3500;
const state={
  x:512,y:512,h:160,a:-Math.PI/2,pitch:0,
  score:0,instability:0,
  gameState:"PLAYING",layer:"SURFACE",
  recoil:0,sway:0,time:0,stillTime:0,
  nearGem:false,fog:[8,22,50],
  ammo:AMMO_MAX,lastAmmoRegen:0,
  muzzleFlash:0,
  playerInventory: new Inventory(50),
  shipInventory: new Inventory(500),
};

function calculateScore() {
    const inv = state.playerInventory;
    return inv.getCount('MAGENTA') * 10 + inv.getCount('CYAN') * 20 + inv.getCount('AMBER') * 30;
}

// ─── TRENCH FM BLOB ENTITIES ───
const BLOB_TYPES = [
  { name:'CORE',     color:'#00e5cc', role:'neutral',  speed:0.8,  size:18, morphSpd:9,  hp:3, points:15, gems: { MAGENTA: 1 } },
  { name:'SPECTRUM', color:'#b06cf7', role:'hostile',   speed:1.4,  size:16, morphSpd:7.5,hp:2, points:20, gems: { CYAN: 1 } },
  { name:'STATIONS', color:'#f0a500', role:'fleeing',   speed:1.8,  size:14, morphSpd:11, hp:1, points:30, gems: { AMBER: 1 } },
  { name:'VOLUME',   color:'#f0365e', role:'hostile',   speed:1.2,  size:20, morphSpd:13, hp:4, points:25, gems: { CYAN: 1, MAGENTA: 1 } },
  { name:'METER',    color:'#30e87a', role:'item',      speed:0.5,  size:12, morphSpd:8,  hp:1, points:10, gems: { MAGENTA: 1 } },
  { name:'LOGO',     color:'#dce8ff', role:'boss',      speed:0.6,  size:28, morphSpd:14, hp:8, points:50, gems: { AMBER: 2, CYAN: 1 } },
];

// Morph keyframes from Trench FM CSS
const MORPH_KEYS = [
  [63,37,29,71, 61,31,69,39], // 0%
  [43,57,64,36, 51,63,37,49], // 33%
  [56,44,47,53, 39,56,44,61], // 66%
];

function getMorph(t, speed) {
  const cycle = ((t / speed) % 1 + 1) % 1;
  const idx = Math.floor(cycle * 3);
  const frac = (cycle * 3) % 1;
  const a = MORPH_KEYS[idx % 3];
  const b = MORPH_KEYS[(idx + 1) % 3];
  return a.map((v, i) => (v + (b[i] - v) * frac) / 100);
}

// Spawn blobs
const blobs = [];
const SEEDS = [9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];

function spawnBlobs() {
  for (let i = 0; i < 24; i++) {
    const type = BLOB_TYPES[i % BLOB_TYPES.length];
    const seed = SEEDS[i % SEEDS.length];
    const x = 100 + (seed * 7 + i * 37) % 824;
    const y = 100 + (seed * 11 + i * 43) % 824;
    blobs.push({
      type, x, y,
      vx: (Math.random() - 0.5) * type.speed,
      vy: (Math.random() - 0.5) * type.speed,
      hp: type.hp,
      alive: true,
      phase: Math.random() * Math.PI * 2,
      morphOffset: Math.random() * 20,
      bobPhase: Math.random() * Math.PI * 2,
      hitFlash: 0,
      deathTimer: 0,
    });
  }
}
spawnBlobs();

function updateBlobs(dt) {
  const playerDist = (b) => Math.hypot(b.x - state.x, b.y - state.y);

  for (const b of blobs) {
    if (!b.alive) {
      b.deathTimer -= dt;
      continue;
    }

    b.phase += dt;
    b.bobPhase += dt * 2.5;
    if (b.hitFlash > 0) b.hitFlash -= dt * 4;

    const dist = playerDist(b);
    const dx = state.x - b.x, dy = state.y - b.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len, ny = dy / len;

    switch (b.type.role) {
      case 'hostile':
        if (dist < 200) {
          b.vx += nx * b.type.speed * dt * 3;
          b.vy += ny * b.type.speed * dt * 3;
        }
        if (dist < 15) {
          state.instability += 0.5;
        }
        break;
      case 'fleeing':
        if (dist < 150) {
          b.vx -= nx * b.type.speed * dt * 4;
          b.vy -= ny * b.type.speed * dt * 4;
        }
        break;
      case 'neutral':
        b.vx += (Math.random() - 0.5) * dt * 2;
        b.vy += (Math.random() - 0.5) * dt * 2;
        break;
      case 'item':
        b.vx *= 0.9; b.vy *= 0.9;
        break;
      case 'boss':
        const toCenter = Math.atan2(512 - b.y, 512 - b.x);
        b.vx += Math.cos(toCenter + Math.PI/2) * dt * 0.5;
        b.vy += Math.sin(toCenter + Math.PI/2) * dt * 0.5;
        if (dist < 25) state.instability += 1;
        break;
    }

    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;
    b.vx *= 0.96; b.vy *= 0.96;

    b.x = ((b.x % M) + M) % M;
    b.y = ((b.y % M) + M) % M;
  }
}

function drawBlobSprite(b, sx, sy, size) {
  const t = state.time + b.morphOffset;
  const morph = getMorph(t, b.type.morphSpd);
  const col = b.hitFlash > 0 ? '#ffffff' : b.type.color;
  const alpha = b.alive ? 1 : Math.max(0, b.deathTimer);

  oCtx.save();
  oCtx.globalAlpha = alpha;

  const rx = size, ry = size * 1.1;
  const tl=morph[0]*rx, tr=morph[1]*rx, bl=morph[2]*rx, br=morph[3]*rx;
  const tlY=morph[4]*ry, trY=morph[5]*ry, blY=morph[6]*ry, brY=morph[7]*ry;

  oCtx.beginPath();
  oCtx.moveTo(sx, sy - ry);
  oCtx.bezierCurveTo(sx + tr, sy - trY, sx + rx, sy - trY * 0.5, sx + rx, sy);
  oCtx.bezierCurveTo(sx + rx, sy + brY * 0.5, sx + br, sy + ry, sx, sy + ry);
  oCtx.bezierCurveTo(sx - bl, sy + ry, sx - rx, sy + blY * 0.5, sx - rx, sy);
  oCtx.bezierCurveTo(sx - rx, sy - tlY * 0.5, sx - tl, sy - ry, sx, sy - ry);
  oCtx.closePath();

  const grad = oCtx.createRadialGradient(sx - size*0.1, sy - size*0.15, size*0.1, sx, sy, size);
  const baseCol = b.type.color;
  grad.addColorStop(0, baseCol + '44');
  grad.addColorStop(0.6, baseCol + '18');
  grad.addColorStop(1, 'rgba(0,0,0,0.8)');
  oCtx.fillStyle = grad;
  oCtx.fill();

  oCtx.strokeStyle = col;
  oCtx.lineWidth = 1.5;
  oCtx.shadowColor = col;
  oCtx.shadowBlur = b.hitFlash > 0 ? 20 : 12;
  oCtx.stroke();
  oCtx.shadowBlur = 0;

  oCtx.fillStyle = col;
  oCtx.globalAlpha = alpha * 0.4;
  oCtx.beginPath();
  oCtx.arc(sx - size * 0.2, sy - size * 0.25, size * 0.2, 0, Math.PI * 2);
  oCtx.fill();

  oCtx.globalAlpha = alpha * 0.6;
  oCtx.fillStyle = col;
  oCtx.font = `${Math.max(7, size * 0.4)}px "Space Mono"`;
  oCtx.textAlign = 'center';
  oCtx.fillText(b.type.name, sx, sy + size + 10);

  if (b.type.hp > 1 && b.alive) {
    oCtx.globalAlpha = alpha * 0.7;
    const pipW = Math.min(size * 2, b.type.hp * 6);
    const pipX = sx - pipW / 2;
    oCtx.fillStyle = 'rgba(0,0,0,0.5)';
    oCtx.fillRect(pipX, sy - size - 8, pipW, 3);
    oCtx.fillStyle = col;
    oCtx.fillRect(pipX, sy - size - 8, pipW * (b.hp / b.type.hp), 3);
  }

  oCtx.restore();
}

function drawTendrils() {
  for (let i = 0; i < blobs.length; i++) {
    if (!blobs[i].alive) continue;
    for (let j = i + 1; j < blobs.length; j++) {
      if (!blobs[j].alive) continue;
      const a = blobs[i], b = blobs[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 80) continue;

      const sa = worldToScreen(a.x, a.y, activeH[((a.y|0)&MASK)<<10|((a.x|0)&MASK)] + 12);
      const sb = worldToScreen(b.x, b.y, activeH[((b.y|0)&MASK)<<10|((b.x|0)&MASK)] + 12);
      if (!sa || !sb) continue;

      const alpha = (1 - dist / 80) * 0.3;
      const mx = (sa.sx + sb.sx) / 2;
      const my = (sa.sy + sb.sy) / 2;
      const perpX = -(sb.sy - sa.sy) * 0.2;
      const perpY = (sb.sx - sa.sx) * 0.2;

      oCtx.save();
      oCtx.globalAlpha = alpha;
      oCtx.strokeStyle = a.type.color;
      oCtx.lineWidth = 1;
      oCtx.shadowColor = a.type.color;
      oCtx.shadowBlur = 6;
      oCtx.beginPath();
      oCtx.moveTo(sa.sx, sa.sy);
      oCtx.quadraticCurveTo(mx + perpX, my + perpY, sb.sx, sb.sy);
      oCtx.stroke();
      oCtx.restore();
    }
  }
}

function checkBlobHits() {
  for (let pi = projectiles.length - 1; pi >= 0; pi--) {
    const p = projectiles[pi];
    for (const b of blobs) {
      if (!b.alive) continue;
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      if (dist < b.type.size * 0.8) {
        b.hp--;
        b.hitFlash = 1;
        if (b.hp <= 0) {
          b.alive = false;
          b.deathTimer = 0.8;
          for (const [gemType, amount] of Object.entries(b.type.gems)) {
            state.playerInventory.add(gemType, amount);
          }
          state.score = calculateScore();
          const sp = worldToScreen(b.x, b.y, activeH[((b.y|0)&MASK)<<10|((b.x|0)&MASK)] + 12);
          if (sp) spawnParticles(sp.sx, sp.sy, b.type.color, 20);
          playSnd("snd_mine");
        }
        projectiles.splice(pi, 1);
        break;
      }
    }
  }
}

// ─── Projectiles ───
const projectiles=[];
const PROJ_SPD=14, PROJ_LIFE=1.8;

function fireProjectile(){
  if(state.ammo<=0) return;
  state.ammo--;
  state.muzzleFlash=0.18;
  playSnd("snd_mine");
  projectiles.push({
    x:state.x+Math.cos(state.a)*5, y:state.y+Math.sin(state.a)*5,
    vx:Math.cos(state.a)*PROJ_SPD, vy:Math.sin(state.a)*PROJ_SPD,
    age:0, trail:[],
  });
  updateAmmoPips();
}

function updateAmmoPips(){
  const c=document.getElementById("ammo-pips");
  if(!c) return;
  c.innerHTML="";
  for(let i=0;i<AMMO_MAX;i++){
    const d=document.createElement("div");
    d.className="pip"+(i>=state.ammo?" empty":"");
    c.appendChild(d);
  }
}
updateAmmoPips();

function playSnd(id){
  const s=document.getElementById(id);
  if(s){ s.currentTime=0; s.play().catch(()=>{}); }
}

const WORLDS=[
  {name:"PINK HOUR",    cx:300,cy:300, fog:[30,10,25], grass:[180,80,140],  mushroom:false, fauna:'bird'},
  {name:"THE BLOCK",    cx:724,cy:300, fog:[5,15,10],  grass:[20,90,40],    mushroom:false, fauna:'none'},
  {name:"THE THRESHOLD",cx:512,cy:512, fog:[8,22,50],  grass:[15,65,50],    mushroom:true,  fauna:'deer'},
  {name:"VAULT COMPOUND 7",cx:300,cy:724, fog:[20,12,5], grass:[80,60,30], mushroom:false, fauna:'none'},
  {name:"THE BETWEEN",  cx:724,cy:724, fog:[2,4,14],   grass:[10,20,60],    mushroom:true,  fauna:'bird'},
];

function getWorldBlend(wx, wy) {
  let totalW = 0;
  const blend = {fog:[0,0,0], grass:[0,0,0], mushroom:0, bestDist:1e9, bestWorld:WORLDS[2]};
  for (const w of WORLDS) {
    const dx = wx - w.cx, dy = wy - w.cy;
    const dist = Math.sqrt(dx*dx + dy*dy) + 1;
    const weight = 1 / (dist * dist);
    totalW += weight;
    blend.fog[0] += w.fog[0] * weight;
    blend.fog[1] += w.fog[1] * weight;
    blend.fog[2] += w.fog[2] * weight;
    blend.grass[0] += w.grass[0] * weight;
    blend.grass[1] += w.grass[1] * weight;
    blend.grass[2] += w.grass[2] * weight;
    if (w.mushroom) blend.mushroom += weight;
    if (dist < blend.bestDist) { blend.bestDist = dist; blend.bestWorld = w; }
  }
  blend.fog[0] /= totalW; blend.fog[1] /= totalW; blend.fog[2] /= totalW;
  blend.grass[0] /= totalW; blend.grass[1] /= totalW; blend.grass[2] /= totalW;
  blend.mushroom /= totalW;
  return blend;
}

const grassMap = new Uint8Array(M * M);
const mushroomMap = new Uint8Array(M * M);
const fauna = [];

function generate(){
  function phash(x, y) { return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1; }

  for(let i=0;i<M*M;i++){
    const x=i&MASK, y=i>>10;
    const dx=x-512, dy=y-512;
    const distSq=dx*dx+dy*dy;

    const wb = getWorldBlend(x, y);
    let h=Math.sin(x*0.015)*Math.cos(y*0.015)*40
         +Math.sin(x*0.005)*30+60
         +Math.sin(x*0.031+y*0.017)*8
         +Math.cos(x*0.009-y*0.013)*5;
    if(distSq>1600) h+=(distSq-1600)*0.000006*120;
    h=Math.max(0,Math.min(255,h));
    hMap[i]=h;

    if(h<60) cMap[i]=rgba(188,152,90);
    else if(h<70) cMap[i]=rgba(172,135,68);
    else if(h<78) cMap[i]=rgba(128,110,58);
    else if(h<110) {
      const gr = wb.grass;
      cMap[i]=rgba(gr[0]|0, gr[1]+(h-78>>1)|0, gr[2]|0);
    }
    else if(h<158) cMap[i]=rgba(55+(h>>3),66+(h>>4),50);
    else cMap[i]=rgba(192,206,222);

    if (h >= 78 && h < 130) {
      const slope = Math.abs(Math.sin(x*0.031+y*0.017));
      const density = (1 - slope) * phash(x, y);
      grassMap[i] = (density > 0.3) ? Math.min(255, (density * 200)|0) : 0;
    }

    if (h >= 60 && h < 85 && wb.mushroom > 0.2) {
      const cluster = phash(x*3, y*3);
      if (cluster > 0.92) mushroomMap[i] = Math.min(255, (wb.mushroom * 200)|0);
    }

    if(h>84 && phash(x*7, y*7) > 0.998) cMap[i]=rgba(255,0,180);

    const sh=Math.abs(Math.sin(x*0.08)*Math.cos(y*0.08)*40)+148;
    subHMap[i]=sh;
    const scv=(8+sh/6)|0;
    subCMap[i]=rgba(2,scv,16);
    if(phash(x*11,y*11)<0.003) subCMap[i]=rgba(0,200,255);
    if(phash(x*13,y*13)<0.001) subCMap[i]=rgba(160,0,255);

    const ah=(Math.sin(x*0.05)*Math.cos(y*0.05)>0.8)?80:0;
    airHMap[i]=ah; airCMap[i]=rgba(185,218,255);
  }
  for(let y=490;y<534;y++)
    for(let x=490;x<534;x++){
      hMap[(y<<10)|x]=0; cMap[(y<<10)|x]=rgba(0,0,0);
    }

  for (let fi = 0; fi < 20; fi++) {
    const fx = 150 + phash(fi * 7, 0) * 724;
    const fy = 150 + phash(0, fi * 11) * 724;
    const wb2 = getWorldBlend(fx, fy);
    const ftype = wb2.bestWorld.fauna;
    if (ftype === 'none') continue;
    fauna.push({
      type: ftype, x: fx, y: fy, vx: (phash(fi,fi)-0.5)*0.3, vy: (phash(fi+1,fi)-0.5)*0.3,
      phase: phash(fi, fi*3) * Math.PI * 2, alive: true
    });
  }
}

function recomputeNormals(){
  for(let i=1025;i<M*M-1025;i++){
    nX[i]=activeH[i-1]-activeH[i+1];
    nY[i]=activeH[i-1024]-activeH[i+1024];
  }
}
generate(); recomputeNormals();

function drawSky(){
  const [fr,fg,fb]=state.fog;
  for(let y=0;y<H;y++){
    const t=y/H;
    const r=(fr*(0.3+t*0.7))|0;
    const g=(fg*(0.28+t*0.72))|0;
    const b=(fb*(0.38+t*0.8))|0;
    const col=rgba(r,g,b);
    for(let x=0;x<W;x++) buf32[y*W+x]=col;
  }
}

function render(){
  drawSky();
  hiddenY.fill(H);
  const cosA=Math.cos(state.a), sinA=Math.sin(state.a);
  const isSub=state.layer==="SUBTERRANEAN";
  const desat=Math.min(1,state.instability/500);
  const wt=state.time*15;
  const pitchOff=state.pitch|0;
  state.sway+=isSub?0.04+state.instability/2000:0.04;
  const swayOff=Math.sin(state.sway)*(1+state.instability/50)+pitchOff;
  const zMax=160, zStep=isSub?1.4:2.0, zFog=isSub?0.009:0.007;

  for(let z=1;z<zMax;z+=zStep){
    const invZ=1/z, scale=invZ*120, fog=Math.min(1,z*zFog);
    let plx=-cosA*z*1.05-sinA*z+state.x;
    let ply= sinA*z-cosA*z+state.y;
    const ddx=(cosA*z*2)/W;
    const ddy=(-sinA*z*2)/W;

    for(let i=0;i<W;i++){
      const mx=(plx|0)&MASK, my=(ply|0)&MASK;
      const off=(my<<10)|mx;
      const terrainH=activeH[off];
      const hos=((state.h-terrainH)*scale+105+swayOff)|0;

      if(state.layer==="SURFACE"&&terrainH<76){
        const wH=73+Math.sin(plx*0.04+wt)*3.5+Math.cos(ply*0.05+wt)*2.5+Math.sin((plx-ply)*0.08-wt)*1.2;
        const wHos=((state.h-wH)*scale+105+swayOff)|0;
        if(wHos<hiddenY[i]){
          const yT=Math.max(0,wHos), yB=Math.min(hiddenY[i],hos);
          if(yT<yB){
            const depth=wH-terrainH;
            let wr=4,wg=55,wb=110;
            if(depth<10){wr=18;wg=135;wb=210;}
            else if(depth>28){wr=1;wg=10;wb=24;}
            const c=Math.sin(plx*0.2+wt)+Math.cos(ply*0.2+wt*1.2);
            if(wH>79.5+Math.random()*1.5){wr=232;wg=248;wb=255;}
            else if(c>1.1&&depth<20){wr+=40;wg+=54;wb+=65;}
            wr=(wr+(state.fog[0]-wr)*fog)|0;
            wg=(wg+(state.fog[1]-wg)*fog)|0;
            wb=(wb+(state.fog[2]-wb)*fog)|0;
            const wc=rgba(wr,wg,wb);
            for(let y=yT;y<yB;y++) buf32[y*W+i]=wc;
          }
          hiddenY[i]=Math.min(hiddenY[i],wHos);
        }
      }

      if(hos<hiddenY[i]){
        const shade=Math.max(0.15,Math.min(1.5,0.6+((nX[off]+nY[off]+256)>>7)*0.11));
        const c=activeC[off];
        let r=(c&255)*shade, g=((c>>8)&255)*shade, b=((c>>16)&255)*shade;

        if(z < 60 && grassMap[off] > 0) {
          const grassH = grassMap[off] / 255;
          const bladeR = r * 0.6, bladeG = g * 1.3 + grassH * 30, bladeB = b * 0.5;
          const gBlend = grassH * (1 - fog) * 0.4;
          r = r * (1 - gBlend) + bladeR * gBlend;
          g = g * (1 - gBlend) + bladeG * gBlend;
          b = b * (1 - gBlend) + bladeB * gBlend;
        }

        if(mushroomMap[off] > 0 && z < 80) {
          const mGlow = mushroomMap[off] / 255;
          const pulse = 0.5 + 0.5 * Math.sin(state.time * 2 + plx * 0.1 + ply * 0.1);
          const glowStr = mGlow * pulse * (1 - fog) * 0.6;
          r += 0 * glowStr; g += 200 * glowStr; b += 255 * glowStr;
        }

        if(desat>0.1){const avg=(r+g+b)/3;r+=(avg-r)*desat;g+=(avg-g)*desat;b+=(avg-b)*desat;}
        r=(r+(state.fog[0]-r)*fog)|0;
        g=(g+(state.fog[1]-g)*fog)|0;
        b=(b+(state.fog[2]-b)*fog)|0;
        const yT=Math.max(0,hos), yB=hiddenY[i];
        const col=rgba(r,g,b);
        for(let y=yT;y<yB;y++) buf32[y*W+i]=col;
        hiddenY[i]=hos;
      }
      plx+=ddx; ply+=ddy;
    }
  }

  const cx=W/2, cy=H/2;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const dx=(x-cx)/cx, dy=(y-cy)/cy;
      const d=dx*dx+dy*dy;
      if(d>0.49){
        const vign=Math.min(1,(Math.sqrt(d)-0.7)*1.85);
        if(vign>0.02){
          const idx=y*W+x, p=buf32[idx];
          const iv=1-vign;
          buf32[idx]=rgba(((p&255)*iv)|0,(((p>>8)&255)*iv)|0,(((p>>16)&255)*iv)|0);
        }
      }
    }
  }
  sCtx.putImageData(imgData,0,0);
}

function worldToScreen(wx,wy,wz){
  const dx=wx-state.x, dy=wy-state.y;
  const fwd=dx*Math.cos(state.a)+dy*Math.sin(state.a);
  if(fwd<0.5) return null;
  const str=(-dx*Math.sin(state.a)+dy*Math.cos(state.a));
  const scaleX=oc.width/W, scaleY=oc.height/H;
  const sx=(W/2+(str/fwd)*W*0.5)*scaleX;
  const heightDiff=(state.h-(wz||0));
  const sy=(H/2+(heightDiff/fwd)*60+state.pitch)*scaleY;
  return {sx,sy,dist:fwd};
}

function drawOverlay(){
  oCtx.clearRect(0,0,oc.width,oc.height);
  const cx=oc.width/2, cy=oc.height/2;

  drawTendrils();

  const aliveCount = blobs.filter(b=>b.alive).length;
  for(const b of blobs){
    if(!b.alive && b.deathTimer <= 0) continue;
    const wz = activeH[((b.y|0)&MASK)<<10|((b.x|0)&MASK)];
    const bob = Math.sin(b.bobPhase) * 4;
    const s = worldToScreen(b.x, b.y, wz + 12 + bob);
    if(!s) continue;
    const size = Math.max(4, (b.type.size * 2) / Math.max(1, s.dist * 0.15));
    drawBlobSprite(b, s.sx, s.sy, size);
  }

  const bCountEl = document.getElementById("blobCount");
  if(bCountEl) bCountEl.textContent = aliveCount;

  const gemNear=state.nearGem;
  const chCol=gemNear?"#ff00cc":"#00ff9d";
  const chAlpha=gemNear?0.95:0.7;
  oCtx.save();
  oCtx.strokeStyle=chCol;
  oCtx.lineWidth=1.5;
  oCtx.globalAlpha=chAlpha;
  oCtx.beginPath();
  oCtx.moveTo(cx-13,cy);oCtx.lineTo(cx-5,cy);
  oCtx.moveTo(cx+5,cy);oCtx.lineTo(cx+13,cy);
  oCtx.moveTo(cx,cy-13);oCtx.lineTo(cx,cy-5);
  oCtx.moveTo(cx,cy+5);oCtx.lineTo(cx,cy+13);
  oCtx.stroke();
  oCtx.globalAlpha=gemNear?0.8:0.28;
  oCtx.beginPath();oCtx.arc(cx,cy,gemNear?12:9,0,Math.PI*2);oCtx.stroke();
  oCtx.globalAlpha=1;oCtx.fillStyle=chCol;
  oCtx.beginPath();oCtx.arc(cx,cy,gemNear?2.5:1.5,0,Math.PI*2);oCtx.fill();
  if(state.ammo<AMMO_MAX){
    const frac=state.ammo/AMMO_MAX;
    oCtx.globalAlpha=0.45;oCtx.strokeStyle="rgba(255,170,34,0.5)";oCtx.lineWidth=1;
    oCtx.beginPath();oCtx.arc(cx,cy,20,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-frac));oCtx.stroke();
  }

  if (state.layer === 'SURFACE' && Math.hypot(state.x-512, state.y-512) < 50) {
    oCtx.save();
    oCtx.fillStyle = '#00ff9d';
    oCtx.font = 'bold 14px "Space Mono"';
    oCtx.textAlign = 'center';
    oCtx.globalAlpha = 0.5 + 0.5 * Math.sin(state.time * 5);
    oCtx.fillText('[E] DEPOSIT GEMS', oc.width/2, oc.height * 0.15);
    oCtx.restore();
  }

  oCtx.restore();

  for(const p of projectiles){
    const s=worldToScreen(p.x,p.y,activeH[((p.y|0)&MASK)<<10|((p.x|0)&MASK)]+8);
    if(!s) continue;
    const {sx,sy,dist}=s;
    const sz=Math.max(2,18/dist);
    for(let t=0;t<p.trail.length;t++){
      const ti=p.trail[t];
      const ts=worldToScreen(ti.x,ti.y,ti.z);
      if(!ts) continue;
      oCtx.globalAlpha=(t/p.trail.length)*0.5;
      oCtx.fillStyle="#00ff9d";
      oCtx.beginPath();oCtx.arc(ts.sx,ts.sy,Math.max(1,sz*(t/p.trail.length)*0.6),0,Math.PI*2);oCtx.fill();
    }
    const grd=oCtx.createRadialGradient(sx,sy,0,sx,sy,sz*3.5);
    grd.addColorStop(0,"rgba(0,255,157,0.85)");grd.addColorStop(0.4,"rgba(0,255,157,0.3)");grd.addColorStop(1,"rgba(0,255,157,0)");
    oCtx.globalAlpha=1;oCtx.fillStyle=grd;
    oCtx.beginPath();oCtx.arc(sx,sy,sz*3.5,0,Math.PI*2);oCtx.fill();
    oCtx.fillStyle="#ffffff";oCtx.beginPath();oCtx.arc(sx,sy,sz*0.6,0,Math.PI*2);oCtx.fill();
  }

  if(state.muzzleFlash>0){
    const r=Math.round(state.muzzleFlash*180);
    const grd2=oCtx.createRadialGradient(cx,cy,0,cx,cy,r);
    grd2.addColorStop(0,`rgba(0,255,157,${state.muzzleFlash*0.6})`);
    grd2.addColorStop(1,"rgba(0,255,157,0)");
    oCtx.fillStyle=grd2;oCtx.beginPath();oCtx.arc(cx,cy,r,0,Math.PI*2);oCtx.fill();
  }
}

const mmC=document.getElementById("minimap");
const mmX=mmC.getContext("2d");
function drawMinimap(){
  const md=mmX.createImageData(84,84);
  const mm=new Uint32Array(md.data.buffer);
  for(let y=0;y<84;y++) for(let x=0;x<84;x++){
    const wx=(x/84*1024)|0, wy=(y/84*1024)|0;
    const h=activeH[(wy<<10)+wx];
    if(h===0) mm[y*84+x]=rgba(0,0,0);
    else if(h<76&&state.layer==="SURFACE") mm[y*84+x]=rgba(4,32,72);
    else if(h<110) mm[y*84+x]=rgba(18,62,14);
    else mm[y*84+x]=rgba(58,66,76);
  }
  mmX.putImageData(md,0,0);
  const px=(state.x/1024*84)|0, py=(state.y/1024*84)|0;
  mmX.fillStyle="#00ff9d";mmX.fillRect(px-1,py-1,3,3);
  mmX.strokeStyle="rgba(0,255,157,0.65)";mmX.lineWidth=1;
  mmX.beginPath();mmX.moveTo(px,py);
  mmX.lineTo(px+Math.cos(state.a)*7,py+Math.sin(state.a)*7);
  mmX.stroke();

  for(const b of blobs){
    if(!b.alive) continue;
    const bpx=(b.x/1024*84)|0, bpy=(b.y/1024*84)|0;
    mmX.fillStyle=b.type.color;
    mmX.fillRect(bpx-1,bpy-1,2,2);
  }
  mmX.fillStyle="rgba(0,255,157,0.8)";
  for(const p of projectiles){
    mmX.fillRect((p.x/1024*84)|0,(p.y/1024*84)|0,2,2);
  }
}

function spawnParticles(x,y,color,count=18){
  for(let i=0;i<count;i++){
    const p=document.createElement("div");p.className="particle";
    const ang=Math.random()*Math.PI*2, spd=30+Math.random()*110;
    p.style.setProperty("--sx","0px");p.style.setProperty("--sy","0px");
    p.style.setProperty("--ex",Math.cos(ang)*spd+"px");p.style.setProperty("--ey",Math.sin(ang)*spd+"px");
    p.style.setProperty("--dur",(0.4+Math.random()*0.5)+"s");
    p.style.background=color;p.style.left=x+"px";p.style.top=y+"px";
    document.body.appendChild(p);setTimeout(()=>p.remove(),1000);
  }
}

function updateProjectiles(dt){
  const now=performance.now();
  if(state.ammo<AMMO_MAX&&now-state.lastAmmoRegen>AMMO_REGEN){
    state.ammo=Math.min(AMMO_MAX,state.ammo+1);state.lastAmmoRegen=now;updateAmmoPips();
  }
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];p.age+=dt;
    if(p.age>PROJ_LIFE){projectiles.splice(i,1);continue;}
    const twz=activeH[((p.y|0)&MASK)<<10|((p.x|0)&MASK)];
    p.trail.push({x:p.x,y:p.y,z:twz+8});if(p.trail.length>12)p.trail.shift();
    p.x+=p.vx*dt*60;p.y+=p.vy*dt*60;
    p.x=(p.x+M)&MASK;p.y=(p.y+M)&MASK;
    const px=(p.x|0)&MASK, py=(p.y|0)&MASK;
    const idx=(py<<10)|px;
    const c=activeC[idx];
    const isSGem=c===rgba(255,0,180), isDGem=c===rgba(0,200,255);
    if(isSGem||isDGem){
      if(isSGem) state.playerInventory.add('MAGENTA', 5);
      else state.playerInventory.add('CYAN', 5);
      state.score = calculateScore();
      playSnd("snd_mine");
      activeC[idx]=rgba(38,38,38);activeH[idx]=Math.max(0,activeH[idx]-5);recomputeNormals();
      const sp=worldToScreen(p.x,p.y,activeH[idx]);
      if(sp)spawnParticles(sp.sx,sp.sy,isSGem?"#ff00cc":"#00ccff",24);
      projectiles.splice(i,1);continue;
    }
    const ground=activeH[idx];
    const camFwd=(p.x-state.x)*Math.cos(state.a)+(p.y-state.y)*Math.sin(state.a);
    if(ground>80&&camFwd>2){
      const sp=worldToScreen(p.x,p.y,ground);
      if(sp)spawnParticles(sp.sx,sp.sy,"rgba(100,200,100,0.9)",8);
      projectiles.splice(i,1);
    }
  }
  state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*4);
  checkBlobHits();
}

function updateGemHUD() {
    const inv = state.playerInventory;
    const ship = state.shipInventory;
    for (const type of ['MAGENTA','CYAN','AMBER']) {
        const count = inv.getCount(type);
        const el = document.getElementById(`gem-${type.toLowerCase()}`);
        if (el) el.textContent = count;
        const bar = document.getElementById(`gem-bar-${type.toLowerCase()}`);
        if (bar) bar.style.width = (count / 50 * 100) + '%';
    }
    const shipTotal = ship.getTotal();
    const shipEl = document.getElementById('ship-gem-total');
    if (shipEl) shipEl.textContent = `${shipTotal} / 500`;

    const scoreVal = document.getElementById('scoreVal');
    if (scoreVal) scoreVal.textContent = String(calculateScore()).padStart(3,'0');
}

function updateHUD(){
  const score = calculateScore();
  document.getElementById("scoreVal").innerText=String(score).padStart(3,"0");
  const pct=Math.min(100,(score/300)*100);
  document.getElementById("prog-fill").style.width=pct+"%";
  document.getElementById("progPct").innerText=Math.round(pct)+"%";
  document.getElementById("posVal").innerText=`${Math.round(state.x)}, ${Math.round(state.y)}`;
  document.getElementById("depthVal").innerText=`${Math.max(0,(200-state.h)).toFixed(1)}m`;
  document.getElementById("instab-fill").style.width=Math.min(100,(state.instability/600)*100)+"%";
  document.getElementById("instab-val").innerText=`${Math.round(state.instability)} / 600`;
  const stab=document.getElementById("stabVal");
  if(state.instability>400){stab.innerText="CRITICAL";stab.style.color="var(--danger)";}
  else if(state.instability>200){stab.innerText="UNSTABLE";stab.style.color="var(--amber)";}
  else{stab.innerText="NOMINAL";stab.style.color="var(--phosphor)";}

  const cosA=Math.cos(state.a),sinA=Math.sin(state.a);
  const hx=(state.x+cosA*40)&MASK, hy=(state.y+sinA*40)&MASK;
  const hIdx=(hy<<10)+hx;
  state.nearGem=activeC[hIdx]===rgba(255,0,180)||activeC[hIdx]===rgba(0,200,255);
  document.getElementById("crt").style.opacity=state.instability>400?(0.6+Math.random()*0.4):"1";
  const mf=document.getElementById("muzzle-flash");
  if(mf) mf.style.background=state.muzzleFlash>0.02?`rgba(0,255,157,${state.muzzleFlash*0.12})`:"rgba(0,255,157,0)";
  
  updateGemHUD();
}

function triggerAscension(){
  state.gameState="WON";state.layer="AIR";activeH=airHMap;activeC=airCMap;
  state.h=200;state.fog=[175,212,255];recomputeNormals();
  document.getElementById("layer-badge").innerText="ASCENDED";
  const ov=document.getElementById("overlay");ov.classList.add("show","won");
  document.getElementById("overlay-title").innerText="ASCENSION";
  document.getElementById("overlay-sub").innerText="RESONANCE FIELD SYNCHRONIZED";
  document.getElementById("overlay-score").innerText=`HARVESTED — ${calculateScore()} UNITS`;
  document.getElementById("hud").style.opacity="0";
}
function triggerEnd(){
  state.gameState="LOST";
  const ov=document.getElementById("overlay");ov.classList.add("show","lost");
  document.getElementById("overlay-title").innerText="SIGNAL LOST";
  document.getElementById("overlay-sub").innerText="CORE INSTABILITY — OVERLOAD";
  document.getElementById("overlay-score").innerText=`HARVESTED — ${calculateScore()} / 300 UNITS`;
}

function checkLayerTransition(ground){
  if(state.layer==="SURFACE"&&ground===0&&state.h<15){
    state.layer="SUBTERRANEAN";activeH=subHMap;activeC=subCMap;
    state.h=220;state.fog=[0,5,2];recomputeNormals();
    document.getElementById("layerName").innerText="SUB_CORE";
    document.getElementById("layer-badge").innerText="SUBTERRANEAN";
    playSnd("snd_glitch");
  }
}

function update(dt){
  if(state.gameState!=="PLAYING") return;
  const spd=keys["ShiftLeft"]?5:2.5;
  const cosA=Math.cos(state.a), sinA=Math.sin(state.a);
  if(keys["KeyW"]){state.x+=cosA*spd;state.y+=sinA*spd;}
  if(keys["KeyS"]){state.x-=cosA*spd;state.y-=sinA*spd;}
  if(keys["KeyA"]){state.x-=sinA*spd;state.y+=cosA*spd;}
  if(keys["KeyD"]){state.x+=sinA*spd;state.y-=cosA*spd;}
  if(!locked&&keys["KeyQ"])state.a-=0.05;
  if(!locked&&keys["KeyE"])state.a+=0.05;

  if (keys['KeyE']) {
    const distToPit = Math.hypot(state.x - 512, state.y - 512);
    if (distToPit < 30 && state.layer === 'SURFACE') {
        for (const type of ['MAGENTA','CYAN','AMBER']) {
            const count = state.playerInventory.getCount(type);
            if (count > 0) {
                const space = state.shipInventory.slots[type].capacity - state.shipInventory.getCount(type);
                const transferAmount = Math.min(count, space);
                if (transferAmount > 0) {
                    state.playerInventory.remove(type, transferAmount);
                    state.shipInventory.add(type, transferAmount);
                    playSnd('snd_mine');
                }
            }
        }
    }
    keys['KeyE'] = false;
  }

  state.time+=0.01;

  updateProjectiles(dt);
  updateBlobs(dt);

  const gx=(state.x|0)&MASK, gy=(state.y|0)&MASK;
  const ground=activeH[(gy<<10)|gx];
  const targetH=(state.layer==="SURFACE"&&ground<76)?95:ground+20;
  state.h=Math.max(targetH,state.h-1.2);
  if(state.layer==="SUBTERRANEAN"){
    state.instability+=0.12;if(state.instability>=600)triggerEnd();
  }else{state.instability=Math.max(0,state.instability-1);}
  if(state.layer==="SURFACE"&&calculateScore()>=300){
    const moving=keys["KeyW"]||keys["KeyS"]||keys["KeyA"]||keys["KeyD"];
    if(!moving&&Math.abs(state.x-512)<50&&Math.abs(state.y-512)<50){
      if(++state.stillTime>150)triggerAscension();
    }else{state.stillTime=0;}
  }
  checkLayerTransition(ground);
  updateHUD();drawMinimap();
}

let currentWorld = WORLDS[2];

function updateWorldZone() {
  const wb = getWorldBlend(state.x, state.y);
  currentWorld = wb.bestWorld;
  state.fog[0] += (wb.fog[0] - state.fog[0]) * 0.008;
  state.fog[1] += (wb.fog[1] - state.fog[1]) * 0.008;
  state.fog[2] += (wb.fog[2] - state.fog[2]) * 0.008;
  const ln = document.getElementById("layerName");
  if (ln && state.layer === "SURFACE") ln.innerText = currentWorld.name;
}

function updateFauna(dt) {
  for (const f of fauna) {
    if (!f.alive) continue;
    f.phase += dt;
    f.x += f.vx; f.y += f.vy;
    if (f.x < 50 || f.x > 974) f.vx *= -1;
    if (f.y < 50 || f.y > 974) f.vy *= -1;
    if (Math.random() < 0.005) {
      f.vx = (Math.random() - 0.5) * 0.4;
      f.vy = (Math.random() - 0.5) * 0.4;
    }
    const dx = f.x - state.x, dy = f.y - state.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 60) {
      f.vx += dx / dist * 0.2; f.vy += dy / dist * 0.2;
    }
  }
}

function drawFauna() {
  for (const f of fauna) {
    if (!f.alive) continue;
    const fdx = f.x - state.x, fdy = f.y - state.y;
    const cosA = Math.cos(state.a), sinA = Math.sin(state.a);
    const fwd = fdx * cosA + fdy * sinA;
    if (fwd < 1) continue;
    const side = -fdx * sinA + fdy * cosA;
    const fh = activeH[((f.y|0)&MASK)<<10|((f.x|0)&MASK)];

    const sx = (W/2 + (side/fwd)*W*0.5) * oCtx.canvas.width / W;
    const sy = (H/2 + ((state.h - fh - 8)/fwd)*60 + state.pitch) * oCtx.canvas.height / H;
    const sz = Math.max(4, 40 / fwd);

    if (sx < -50 || sx > oCtx.canvas.width + 50) continue;
    if (fwd > 120) continue;

    oCtx.save();
    if (f.type === 'deer') {
      const bob = Math.sin(f.phase * 3) * 2;
      oCtx.fillStyle = '#8B6914';
      oCtx.beginPath();
      oCtx.ellipse(sx, sy + bob, sz * 1.5, sz * 0.7, 0, 0, Math.PI * 2);
      oCtx.fill();
      oCtx.beginPath();
      oCtx.ellipse(sx + sz * 1.2, sy - sz * 0.3 + bob, sz * 0.5, sz * 0.4, -0.3, 0, Math.PI * 2);
      oCtx.fill();
      oCtx.strokeStyle = '#6B4F10';
      oCtx.lineWidth = Math.max(1, sz * 0.15);
      for (let leg = 0; leg < 4; leg++) {
        const lx = sx + (leg - 1.5) * sz * 0.5;
        const legSwing = Math.sin(f.phase * 4 + leg * Math.PI * 0.5) * sz * 0.3;
        oCtx.beginPath();
        oCtx.moveTo(lx, sy + sz * 0.5 + bob);
        oCtx.lineTo(lx + legSwing, sy + sz * 1.5 + bob);
        oCtx.stroke();
      }
      oCtx.strokeStyle = '#A08030';
      oCtx.lineWidth = Math.max(1, sz * 0.1);
      const ax = sx + sz * 1.4, ay = sy - sz * 0.6 + bob;
      oCtx.beginPath();
      oCtx.moveTo(ax, ay); oCtx.lineTo(ax + sz*0.3, ay - sz*0.5);
      oCtx.moveTo(ax, ay); oCtx.lineTo(ax + sz*0.5, ay - sz*0.3);
      oCtx.moveTo(ax, ay); oCtx.lineTo(ax - sz*0.1, ay - sz*0.5);
      oCtx.stroke();
    } else if (f.type === 'bird') {
      const flap = Math.sin(f.phase * 8) * 0.4;
      oCtx.fillStyle = '#2a2a3a';
      oCtx.beginPath();
      oCtx.ellipse(sx, sy, sz * 0.4, sz * 0.25, 0, 0, Math.PI * 2);
      oCtx.fill();
      oCtx.strokeStyle = '#4a4a5a';
      oCtx.lineWidth = Math.max(1, sz * 0.15);
      oCtx.beginPath();
      oCtx.moveTo(sx, sy);
      oCtx.quadraticCurveTo(sx - sz, sy - sz * flap, sx - sz * 1.5, sy + sz * 0.2 * flap);
      oCtx.moveTo(sx, sy);
      oCtx.quadraticCurveTo(sx + sz, sy - sz * flap, sx + sz * 1.5, sy + sz * 0.2 * flap);
      oCtx.stroke();
    }
    oCtx.restore();
  }
}

let lastT=0;
function loop(t){
  const dt=Math.min((t-lastT)/1000,0.05);lastT=t;
  if(dt>0){
    updateWorldZone();
    updateFauna(dt);
    update(dt);
    render();
    drawOverlay();
    drawFauna();
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);