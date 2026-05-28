// ── 8-BIT RENDER: draw at low res, scale up with nearest-neighbor ──
const LO_SCALE = 4; // pixel size
const lo = document.getElementById('lo');
const loCtx = lo.getContext('2d');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let W, H, LW, LH;
function resize(){
  W=canvas.width=innerWidth;H=canvas.height=innerHeight;
  LW=lo.width=Math.ceil(W/LO_SCALE);LH=lo.height=Math.ceil(H/LO_SCALE);
}
resize();addEventListener('resize',resize);

// NES-ish palette per world (limited colors)
const PAL = {
  pink:   {bg:'#1a0812',sky:'#2a1020',ground:'#4a1830',accent:'#ff5599',dark:'#330018',gem:'#ffaa44',star:'#cc88aa'},
  block:  {bg:'#001a0c',sky:'#002a14',ground:'#004422',accent:'#00ff88',dark:'#001108',gem:'#ffcc00',star:'#88ccaa'},
  thresh: {bg:'#000c1a',sky:'#001828',ground:'#002838',accent:'#00ccdd',dark:'#000610',gem:'#ffaa22',star:'#88aacc'},
  vault:  {bg:'#1a0c00',sky:'#281800',ground:'#3a2808',accent:'#ff8822',dark:'#0a0400',gem:'#ffdd44',star:'#ccaa88'},
  between:{bg:'#000218',sky:'#000420',ground:'#081030',accent:'#5577ff',dark:'#000110',gem:'#aaccff',star:'#6688aa'},
};

const SEEDS=[9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];

const WORLDS = [
  {name:'PINK HOUR',       pal:PAL.pink,   mul:0.8},
  {name:'THE BLOCK',       pal:PAL.block,  mul:1.2},
  {name:'THE THRESHOLD',   pal:PAL.thresh, mul:1.0},
  {name:'VAULT COMPOUND 7',pal:PAL.vault,  mul:0.6},
  {name:'THE BETWEEN',     pal:PAL.between,mul:1.5},
];

// ── Bezier ease (cubic bezier evaluation) ──
function bezierEase(t, p1x, p1y, p2x, p2y) {
  // Newton-Raphson to find parameter u for given t (x-axis)
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = 3*(1-u)*(1-u)*u*p1x + 3*(1-u)*u*u*p2x + u*u*u - t;
    const dx = 3*(1-u)*(1-u)*p1x + 6*(1-u)*u*(p2x-p1x) + 3*u*u*(1-p2x);
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
    u = Math.max(0, Math.min(1, u));
  }
  // Evaluate y at parameter u
  return 3*(1-u)*(1-u)*u*p1y + 3*(1-u)*u*u*p2y + u*u*u;
}

// Bezier envelopes per zone (from face-forge expression pipeline)
const ZONE_BEZIERS = [
  [0.05, 0.12, 0.49, 1.00], // Pink Hour: neutral_to_onset (smooth build)
  [0.33, 0.95, 0.55, 1.25], // The Block: onset_to_peak (dilla drop overshoot)
  [0.10, 0.20, 0.38, 1.00], // The Threshold: peak_to_compress (fast strip)
  [0.42, 0.58, 0.82, 1.08], // Vault: compress_to_settle (ease out bounce)
  [0.34, 0.21, 0.94, 1.08], // The Between: settle_to_neutral (elastic return)
];

// ── Terrain ──
const TW = 4000, ZONE_W = TW/5;
const terrain = new Float32Array(TW);
for(let i=0;i<TW;i++){
  const wIdx = Math.floor(i/ZONE_W);
  const zoneIdx = Math.min(wIdx, 4);
  const mul = WORLDS[zoneIdx].mul;
  const localT = (i - zoneIdx * ZONE_W) / ZONE_W; // 0..1 within zone
  const bz = ZONE_BEZIERS[zoneIdx];
  const envelope = bezierEase(localT, bz[0], bz[1], bz[2], bz[3]);
  terrain[i] = (
    Math.sin(i*0.008+SEEDS[0]*0.01)*120*mul +
    Math.sin(i*0.023+SEEDS[1]*0.01)*50*mul +
    Math.sin(i*0.041+SEEDS[2]*0.01)*25 +
    Math.sin(i*0.067+SEEDS[3]*0.01)*12 +
    Math.cos(i*0.015+SEEDS[4]*0.01)*60*mul
  ) * envelope;
}
function tAt(x){const i=((x%TW)+TW)%TW;const i0=Math.floor(i)%TW;const i1=(i0+1)%TW;const t=i-Math.floor(i);return terrain[i0]*(1-t)+terrain[i1]*t}
function tSlope(x){return tAt(x+0.5)-tAt(x-0.5)}
function getWorld(x){return WORLDS[Math.min(Math.floor(((x%TW)+TW)%TW/ZONE_W),4)]}

// ── Ball ──
const ball={x:100,y:0,vx:0,vy:0,r:3,rot:0,onGround:false,trail:[],gems:0,flash:0};

// ── Fluid Vials (Volume & Pitch) ──
const vials = {
  vol: { value: 0.8, wave: 0, waveVel: 0, dragging: false },
  pit: { value: 0.5, wave: 0, waveVel: 0, dragging: false }, // 0.5 = playbackRate 1.0
};

// ── Gems ──
const gems=[];
for(let i=0;i<SEEDS.length*2;i++){
  gems.push({x:(SEEDS[i%SEEDS.length]*7+i*120)%TW,collected:false,bob:Math.random()*Math.PI*2,flash:0});
}

// ── Particles (8-bit sparkles) ──
const particles=[];
function spawnParticles(x,y,col,n){
  for(let i=0;i<n;i++){
    particles.push({x,y,vx:(Math.random()-0.5)*30,vy:-Math.random()*40,life:1,col});
  }
}

// ── Enemies (Asset Forge cross-pollination) ──
const ENEMY_TYPES = {
  MECHA: {name:'MECHA', w:5, h:7, palette:['#00ccaa','#00ffdd','#006655','#004433']},
  MAGE:  {name:'MAGE',  w:5, h:7, palette:['#cc2222','#ff4444','#882222','#661111']},
  GOLEM: {name:'GOLEM', w:5, h:5, palette:['#887766','#aa9977','#665544','#443322']},
};
const enemies=[];
(function spawnEnemies(){
  const types=['MECHA','MAGE','GOLEM','MECHA','MAGE','GOLEM','MECHA','MAGE'];
  for(let i=0;i<types.length;i++){
    const sx=((SEEDS[(i+3)%SEEDS.length]*13+i*470+200)%TW+TW)%TW;
    enemies.push({
      type:types[i],x:sx,baseX:sx,y:0,dir:1,dead:false,
      patrolW:80,speed:20+SEEDS[(i+5)%SEEDS.length]%15
    });
  }
})();

// Draw enemy pixel sprites
function drawEnemy8(bx,ex,ey,type,pal,frame){
  const tp=ENEMY_TYPES[type];
  const c0=tp.palette[0],c1=tp.palette[1],c2=tp.palette[2],c3=tp.palette[3];
  // Tint based on world — mix accent into main color
  const wa=pal.accent;
  if(type==='MECHA'){
    // 5x7 robot: head, body, legs
    px(bx,ex-1,ey-6,3,1,c1);  // antenna
    px(bx,ex,  ey-5,1,1,wa);   // antenna tip
    px(bx,ex-2,ey-4,5,1,c0);  // head top
    px(bx,ex-2,ey-3,5,1,c0);  // head bottom
    px(bx,ex-1,ey-3,1,1,'#ff0000'); // eye L
    px(bx,ex+1,ey-3,1,1,'#ff0000'); // eye R
    px(bx,ex-1,ey-2,3,1,c2);  // neck
    px(bx,ex-2,ey-1,5,1,c0);  // torso
    px(bx,ex-2,ey,  5,1,c2);  // torso lower
    // legs alternate with frame
    const step=Math.round(Math.sin(frame*4))>0;
    px(bx,ex-2,ey+1,2,1,step?c3:c2);
    px(bx,ex+1,ey+1,2,1,step?c2:c3);
  } else if(type==='MAGE'){
    // 5x7 robed figure with hood
    px(bx,ex,  ey-6,1,1,c1);  // hat tip
    px(bx,ex-1,ey-5,3,1,c0);  // hat
    px(bx,ex-2,ey-4,5,1,c0);  // hood
    px(bx,ex-1,ey-3,3,1,c2);  // face
    px(bx,ex,  ey-3,1,1,'#ffcc00'); // eye
    px(bx,ex-2,ey-2,5,1,c0);  // robe
    px(bx,ex-2,ey-1,5,1,c0);  // robe
    px(bx,ex-2,ey,  5,1,c2);  // robe lower
    px(bx,ex-2,ey+1,5,1,c3);  // robe bottom
    // magic sparkle
    if(Math.sin(frame*5)>0.3) px(bx,ex+3,ey-4,1,1,wa);
    if(Math.sin(frame*5+1)>0.3) px(bx,ex-3,ey-3,1,1,wa);
  } else if(type==='GOLEM'){
    // 5x5 blocky golem
    px(bx,ex-2,ey-4,5,1,c0);
    px(bx,ex-2,ey-3,5,1,c1);
    px(bx,ex-1,ey-3,1,1,'#ffffff'); // eye L
    px(bx,ex+1,ey-3,1,1,'#ffffff'); // eye R
    px(bx,ex-2,ey-2,5,1,c0);
    px(bx,ex-2,ey-1,5,1,c2);
    px(bx,ex-2,ey,  5,1,c3);
  }
}

// ── Hybrid Cores (crossbred collectibles) ──
const hybridCores=[];
for(let i=0;i<8;i++){
  hybridCores.push({
    x:((SEEDS[(i+7)%SEEDS.length]*11+i*310+500)%TW+TW)%TW,
    collected:false,bob:Math.random()*Math.PI*2,flash:0
  });
}

// Draw hybrid core — 3x3 cross that shifts color per world
function drawHybridCore8(bx,cx,cy,pal,frame){
  const col=pal.accent;
  const f=Math.round(Math.sin(frame)*1);
  px(bx,cx,  cy-1+f,1,1,col);  // top
  px(bx,cx-1,cy+f,  1,1,col);  // left
  px(bx,cx,  cy+f,  1,1,'#ffffff'); // center bright
  px(bx,cx+1,cy+f,  1,1,col);  // right
  px(bx,cx,  cy+1+f,1,1,col);  // bottom
  // pulsing glow
  if(Math.sin(frame*4)>0.3){
    px(bx,cx-1,cy-1+f,1,1,pal.gem);
    px(bx,cx+1,cy+1+f,1,1,pal.gem);
  }
}

// ── Intro state (scanning/forging) ──
let introPhase='none'; // 'none','scanning','forging','done'
let introTimer=0;
let introRevealedTypes=0; // how many enemy types shown so far

// ── Lenticular ──
const N_FRAMES=7, STRIP_W=1; // 1px strips at low res
let mouseNorm=0.5, camX=0;

// ── Anaglyph 3D ──
let anaglyphOn = false;
let betweenOn = false; // THE BETWEEN: overlap of lenticular + anaglyph
let betweenInverted = false; // INVERTED BETWEEN: agreement glows, disagreement shows scene
const EYE_SEPS = [8, 4, 2]; // CLOSE, MEDIUM, FAR (in lo-res pixels)
const EYE_SEP_NAMES = ['CLOSE', 'MEDIUM', 'FAR'];
let eyeSepIdx = 1; // start at MEDIUM
let eyeSep = EYE_SEPS[eyeSepIdx];
// Offscreen canvases for anaglyph compositing
const anaLeft = document.createElement('canvas');
const anaLeftCtx = anaLeft.getContext('2d');
const anaRight = document.createElement('canvas');
const anaRightCtx = anaRight.getContext('2d');

// ── Audio ──
let tracks=[],currentTrack=0,audioCtx=null,analyser=null,freqData=null,musicStarted=false;
const audio=document.getElementById('audio');
fetch('../music/manifest.json').then(r=>r.json()).then(d=>{tracks=d.tracks;currentTrack=Math.floor(Math.random()*tracks.length)}).catch(()=>{});

function startMusic(){
  if(musicStarted)return;musicStarted=true;
  audioCtx=new(AudioContext||webkitAudioContext)();
  analyser=audioCtx.createAnalyser();analyser.fftSize=256;
  freqData=new Uint8Array(analyser.frequencyBinCount);
  audioCtx.createMediaElementSource(audio).connect(analyser);
  analyser.connect(audioCtx.destination);
  playTrack(currentTrack);
}
function playTrack(idx){
  if(!tracks.length)return;currentTrack=idx%tracks.length;
  const t=tracks[currentTrack];audio.src='../music/'+t.file;
  audio.play().catch(()=>{});
  document.getElementById('trackName').textContent=t.title;
  audio.onended=()=>playTrack(currentTrack+1);
}

// ── Input ──
const keys={};
addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyN')playTrack(currentTrack+1);
  if(e.code==='Digit3'){
    if(!anaglyphOn && !betweenOn){ anaglyphOn=true; }
    else if(anaglyphOn && !betweenOn){ anaglyphOn=false; betweenOn=true; }
    else { betweenOn=false; }
    updateHint();
  }
  if(e.code==='KeyB'&&betweenOn){ betweenInverted=!betweenInverted; updateHint(); }
  if(e.code==='KeyV'&&(anaglyphOn||betweenOn)){
    eyeSepIdx=(eyeSepIdx+1)%EYE_SEPS.length;
    eyeSep=EYE_SEPS[eyeSepIdx];
    updateHint();
  }
});
addEventListener('keyup',e=>{keys[e.code]=false});
canvas.addEventListener('mousemove',e=>{mouseNorm=e.clientX/W});
canvas.addEventListener('touchmove',e=>{mouseNorm=e.touches[0].clientX/W;e.preventDefault()},{passive:false});

function updateHint(){
  const mode = betweenOn ? 'THE BETWEEN ['+EYE_SEP_NAMES[eyeSepIdx]+'] ' + (betweenInverted ? 'INVERTED' : 'NORMAL') :
               anaglyphOn ? 'ANAGLYPH ['+EYE_SEP_NAMES[eyeSepIdx]+']' : 'LENTICULAR';
  document.getElementById('hint').textContent =
    'A/D ROLL \u00b7 SPACE JUMP \u00b7 MOUSE TILT \u00b7 N NEXT \u00b7 3 '+mode+((anaglyphOn||betweenOn)?' \u00b7 V DEPTH':'');
}

let playing=false, gameTime=0;
document.getElementById('goBtn').addEventListener('click',()=>{
  startMusic();
  document.getElementById('start').classList.add('hidden');
  introPhase='scanning';introTimer=0;introRevealedTypes=0;
});

// ── 8-BIT PIXEL HELPERS ──
function px(bx,x,y,w,h,col){
  bx.fillStyle=col;bx.fillRect(Math.round(x),Math.round(y),w,h);
}

// 8-bit ball sprite (5x5 with detail + spin line)
function drawBall8(bx,cx,cy,pal,frame){
  const c=pal.accent;
  const d=pal.dark;
  // 5x5 ball
  px(bx,cx-1,cy-2,3,1,c);   // top row
  px(bx,cx-2,cy-1,5,1,c);   // row 2
  px(bx,cx-2,cy,  5,1,c);   // middle
  px(bx,cx-2,cy+1,5,1,c);   // row 4
  px(bx,cx-1,cy+2,3,1,c);   // bottom
  // highlight
  px(bx,cx-1,cy-1,1,1,'#ffffff');
  // spin line (2 opposing dots that rotate)
  const sx1=Math.round(Math.cos(frame)*1.5);
  const sy1=Math.round(Math.sin(frame)*1.5);
  const sx2=Math.round(Math.cos(frame+Math.PI)*1.5);
  const sy2=Math.round(Math.sin(frame+Math.PI)*1.5);
  px(bx,cx+sx1,cy+sy1,1,1,d);
  px(bx,cx+sx2,cy+sy2,1,1,d);
}

// 8-bit gem sprite (diamond shape)
function drawGem8(bx,cx,cy,col,frame){
  const f=Math.round(Math.sin(frame)*1);
  px(bx,cx,cy-3+f,1,1,col);
  px(bx,cx-1,cy-2+f,3,1,col);
  px(bx,cx-2,cy-1+f,5,1,col);
  px(bx,cx-1,cy+f,3,1,col);
  px(bx,cx,cy+1+f,1,1,col);
  // sparkle
  px(bx,cx-1,cy-2+f,1,1,'#ffffff');
}

// ── 8-bit Fluid Vials ──
// Vial positions in lo-res coordinates
const VIAL8_VOL = {x:6, y:30, w:8, h:20};
const VIAL8_PIT = {x:16, y:30, w:8, h:20};

function drawVials8(bx,t){
  const world=getWorld(ball.x);
  const p=world.pal;
  const morphT=t*0.7;

  const defs=[
    {key:'vol', r:VIAL8_VOL, label:'V'},
    {key:'pit', r:VIAL8_PIT, label:'P'},
  ];

  for(const def of defs){
    const vial=vials[def.key];
    const r=def.r;

    // Vial outline — morphing blob as pixel columns
    // Each column's top/bottom edge wobbles +-1px
    for(let col=0;col<r.w;col++){
      const xp=r.x+col;
      const edgeDist=Math.min(col,r.w-1-col); // 0 at edges, peaks at center
      // Morphing: top and bottom edges wobble
      const topWobble=edgeDist<2?1:Math.round(Math.sin(morphT*0.8+col*1.3)*0.6);
      const botWobble=edgeDist<2?1:Math.round(Math.sin(morphT*0.6+col*1.7)*0.6);
      const colTop=r.y-topWobble+(edgeDist<1?1:0);
      const colBot=r.y+r.h+botWobble-(edgeDist<1?1:0);
      const colH=colBot-colTop;

      // Dark fill
      px(bx,xp,colTop,1,colH,p.dark);

      // Outline top and bottom pixels
      px(bx,xp,colTop,1,1,p.accent);
      px(bx,xp,colBot-1,1,1,p.accent);

      // Fluid fill — from bottom up to fluid level
      const fluidTop=r.y+r.h*(1-vial.value);
      if(fluidTop<colBot-1){
        // Surface wave: +-1 pixel
        const waveOff=Math.round(Math.sin(col*0.8+vial.wave*6+t*2)*Math.min(1,Math.abs(vial.wave)*3));
        const surfaceY=Math.max(colTop+1,Math.round(fluidTop)+waveOff);
        const fluidH=colBot-1-surfaceY;
        if(fluidH>0){
          px(bx,xp,surfaceY,1,fluidH,p.accent);
          // Highlight pixel at surface
          px(bx,xp,surfaceY,1,1,p.star);
        }
      }
    }

    // Left and right outline edges
    for(let row=0;row<r.h;row++){
      const yp=r.y+row;
      const edgeMorphL=Math.round(Math.sin(morphT*0.9+row*0.7)*0.4);
      const edgeMorphR=Math.round(Math.sin(morphT*1.1+row*0.9)*0.4);
      px(bx,r.x+edgeMorphL,yp,1,1,p.accent);
      px(bx,r.x+r.w-1+edgeMorphR,yp,1,1,p.accent);
    }

    // Label above (tiny pixel text)
    bx.fillStyle=p.accent;
    bx.font='3px monospace';
    bx.textAlign='center';
    bx.fillText(def.label,r.x+r.w/2,r.y-2);

    // Value text inside near bottom
    const valStr=def.key==='vol'?Math.round(vial.value*100)+'%':(0.5+vial.value*1.5).toFixed(1);
    bx.fillStyle=p.star;
    bx.font='3px monospace';
    bx.textAlign='center';
    bx.fillText(valStr,r.x+r.w/2,r.y+r.h+5);
  }
}

// ── Vial interaction (hit test in screen coords, scale by LO_SCALE) ──
canvas.addEventListener('mousedown', e=>{
  const mx=e.clientX, my=e.clientY;
  const vialChecks=[
    {key:'vol', r:VIAL8_VOL},
    {key:'pit', r:VIAL8_PIT},
  ];
  for(const vc of vialChecks){
    const r=vc.r;
    const sx=r.x*LO_SCALE, sy=r.y*LO_SCALE, sw=r.w*LO_SCALE, sh=r.h*LO_SCALE;
    if(mx>=sx && mx<=sx+sw && my>=sy && my<=sy+sh){
      vials[vc.key].dragging=true;
      vials[vc.key].value=1-Math.max(0,Math.min(1,(my-sy)/sh));
      applyVialValue8(vc.key);
      e.preventDefault();
    }
  }
});

canvas.addEventListener('mousemove', e=>{
  for(const key of ['vol','pit']){
    if(vials[key].dragging){
      const r=key==='vol'?VIAL8_VOL:VIAL8_PIT;
      const sy=r.y*LO_SCALE, sh=r.h*LO_SCALE;
      vials[key].value=1-Math.max(0,Math.min(1,(e.clientY-sy)/sh));
      applyVialValue8(key);
    }
  }
});

addEventListener('mouseup', ()=>{
  vials.vol.dragging=false;
  vials.pit.dragging=false;
});

function applyVialValue8(key){
  if(key==='vol'){
    audio.volume=vials.vol.value;
  } else if(key==='pit'){
    audio.playbackRate=0.5+vials.pit.value*1.5;
  }
}

// Apply initial values
audio.volume = vials.vol.value;

// ── RENDER (low-res) ──
function renderLo(t){
  const bx=loCtx;
  const baseY=LH*0.55;
  const world=getWorld(ball.x);
  const p=world.pal;

  // Sky — solid blocks (8-bit style: dithered gradient)
  bx.fillStyle=p.bg;
  bx.fillRect(0,0,LW,LH);

  // Dithered sky gradient
  for(let y=0;y<baseY;y+=2){
    const ratio=y/baseY;
    if(ratio>0.3){
      bx.fillStyle=p.sky;
      // checkerboard dither
      for(let x=(y%4<2?0:1);x<LW;x+=2){
        bx.fillRect(x,y,1,1);
      }
    }
  }

  // Stars — single pixels
  for(let i=0;i<30;i++){
    const sx=((SEEDS[i%15]*3+i*47+camX*0.05)%LW+LW)%LW;
    const sy=(SEEDS[i%15]*2+i*11)%(baseY*0.6);
    const blink=(Math.sin(t*2+i*1.7)>0.3)?1:0;
    if(blink)px(bx,sx,sy,1,1,p.star);
  }

  // Far mountains — chunky pixels
  for(let sx=0;sx<LW;sx++){
    const mh=tAt((sx*LO_SCALE+camX*0.3)*0.4)*0.3/LO_SCALE+8;
    const my=baseY-mh;
    px(bx,sx,my,1,Math.ceil(mh),p.dark);
  }

  // Mid hills
  for(let sx=0;sx<LW;sx++){
    const mh=tAt((sx*LO_SCALE+camX*0.6)*0.7)*0.5/LO_SCALE+4;
    const my=baseY-mh;
    // dither between ground and dark
    if(sx%2===0) px(bx,sx,my,1,Math.ceil(mh),p.ground);
    else px(bx,sx,my,1,Math.ceil(mh),p.dark);
  }

  // Main terrain with gradient layers
  const groundLine=new Float32Array(LW);
  for(let sx=0;sx<LW;sx++){
    const th=tAt(sx*LO_SCALE+camX)/LO_SCALE;
    const gy=baseY-th;
    groundLine[sx]=gy;
    const gh=LH-gy;
    // Edge glow — 2px bright accent at surface
    px(bx,sx,gy,1,1,p.accent);
    if(gh>1) px(bx,sx,gy+1,1,1,p.accent);
    // Surface layer
    if(gh>2) px(bx,sx,gy+2,1,Math.min(4,gh-2),p.ground);
    // Mid layer — dithered transition
    if(gh>6){
      const midH=Math.min(6,gh-6);
      if(sx%2===0) px(bx,sx,gy+6,1,midH,p.ground);
      else px(bx,sx,gy+6,1,midH,p.dark);
    }
    // Deep ground
    if(gh>12) px(bx,sx,gy+12,1,gh-12,p.dark);
  }

  // Audio-reactive ground pulse — double line offset by bass
  let bass=0;
  if(analyser&&freqData){
    analyser.getByteFrequencyData(freqData);
    bass=(freqData[1]+freqData[2]+freqData[3])/3/255;
    if(bass>0.25){
      // Primary pulse line
      for(let sx=0;sx<LW;sx++){
        const gy=groundLine[sx]-Math.round(bass*3);
        px(bx,sx,gy,1,1,p.accent);
      }
      // Secondary ghost line (dithered, further offset)
      if(bass>0.45){
        for(let sx=0;sx<LW;sx+=2){
          const gy=groundLine[sx]-Math.round(bass*5);
          px(bx,sx,gy,1,1,p.star);
        }
      }
    }
  }

  // Gems
  for(const gem of gems){
    if(gem.collected){
      if(gem.flash>0){
        gem.flash-=0.05;
        // collection burst
        const gsx=Math.round((gem.x-camX)/LO_SCALE);
        if(gsx>-5&&gsx<LW+5){
          const gy=groundLine[Math.max(0,Math.min(LW-1,gsx))]-5;
          px(bx,gsx-1,gy-1,1,1,p.gem);
          px(bx,gsx+1,gy+1,1,1,p.gem);
          px(bx,gsx+1,gy-1,1,1,'#fff');
          px(bx,gsx-1,gy+1,1,1,'#fff');
        }
      }
      continue;
    }
    const gsx=Math.round((gem.x-camX)/LO_SCALE);
    if(gsx<-5||gsx>LW+5)continue;
    const gIdx=Math.max(0,Math.min(LW-1,gsx));
    const gy=groundLine[gIdx]-5;
    // Glow halo — pixel cross pattern
    const glowA=Math.sin(t*3+gem.bob)*0.5+0.5;
    if(glowA>0.4){
      px(bx,gsx,gy-5,1,1,p.gem);
      px(bx,gsx,gy+3,1,1,p.gem);
      px(bx,gsx-4,gy,1,1,p.gem);
      px(bx,gsx+4,gy,1,1,p.gem);
    }
    drawGem8(bx,gsx,gy,p.gem,t*3+gem.bob);
  }

  // Hybrid Cores
  for(const hc of hybridCores){
    if(hc.collected){
      if(hc.flash>0){
        hc.flash-=0.05;
        const hsx=Math.round((hc.x-camX)/LO_SCALE);
        if(hsx>-5&&hsx<LW+5){
          const hy=groundLine[Math.max(0,Math.min(LW-1,hsx))]-4;
          px(bx,hsx,hy,1,1,'#ffffff');
          px(bx,hsx-2,hy,1,1,p.accent);
          px(bx,hsx+2,hy,1,1,p.accent);
        }
      }
      continue;
    }
    const hsx=Math.round((hc.x-camX)/LO_SCALE);
    if(hsx<-5||hsx>LW+5)continue;
    const hIdx=Math.max(0,Math.min(LW-1,hsx));
    const hy=groundLine[hIdx]-4;
    // glow ring
    const glowB=Math.sin(t*4+hc.bob)*0.5+0.5;
    if(glowB>0.5){
      px(bx,hsx-2,hy,1,1,p.gem);
      px(bx,hsx+2,hy,1,1,p.gem);
    }
    drawHybridCore8(bx,hsx,hy,p,t*3+hc.bob);
  }

  // Enemies
  for(const en of enemies){
    const esx=Math.round((en.x-camX)/LO_SCALE);
    if(esx<-8||esx>LW+8)continue;
    const eIdx=Math.max(0,Math.min(LW-1,esx));
    const ey=groundLine[eIdx];
    if(en.dead){
      // dead enemy = single dot remnant
      px(bx,esx,ey,1,1,ENEMY_TYPES[en.type].palette[3]);
      continue;
    }
    drawEnemy8(bx,esx,ey,en.type,p,t);
  }

  // Trail — graduated pixels (every other for fade effect)
  for(let i=0;i<ball.trail.length;i++){
    const tr=ball.trail[i];
    const tsx=Math.round((tr.x-camX)/LO_SCALE);
    const tIdx=Math.max(0,Math.min(LW-1,tsx));
    const tsy=groundLine[tIdx]-ball.r;
    if(tsx>0 && tsx<LW){
      // Older trail = dimmer, use ground color. Recent = accent.
      const ratio=i/ball.trail.length;
      if(ratio>0.5) px(bx,tsx,tsy,1,1,p.accent);
      else if(i%2===0) px(bx,tsx,tsy,1,1,p.ground);
    }
  }

  // Particles
  for(let i=particles.length-1;i>=0;i--){
    const pt=particles[i];
    pt.x+=pt.vx*0.016;pt.y+=pt.vy*0.016;pt.vy+=60*0.016;pt.life-=0.03;
    if(pt.life<=0){particles.splice(i,1);continue}
    const psx=Math.round((pt.x-camX)/LO_SCALE);
    const psy=Math.round(baseY+pt.y/LO_SCALE);
    if(psx>0&&psx<LW&&psy>0&&psy<LH){
      px(bx,psx,psy,1,1,pt.life>0.5?'#ffffff':pt.col);
    }
  }

  // Ball shadow (ellipse as pixels — wider when airborne)
  const bsx=Math.round((ball.x-camX)/LO_SCALE);
  const bIdx=Math.max(0,Math.min(LW-1,bsx));
  const bGroundY=groundLine[bIdx];
  const shadowW=ball.onGround?3:4;
  const shadowOff=Math.floor(shadowW/2);
  px(bx,bsx-shadowOff,bGroundY,shadowW,1,p.dark);
  if(!ball.onGround) px(bx,bsx-1,bGroundY+1,3,1,p.dark); // extra depth when airborne

  // Ball
  const bsy=bGroundY-ball.r+ball.y/LO_SCALE;
  drawBall8(bx,bsx,Math.round(bsy),p,ball.rot);

  // Flash on collect
  if(ball.flash>0){
    ball.flash-=0.04;
    bx.fillStyle=`rgba(255,255,255,${ball.flash*0.3})`;
    bx.fillRect(0,0,LW,LH);
  }

  // Fluid vials (drawn in lo-res, gets pixelated on scale-up)
  drawVials8(bx,t);

  // Scanlines overlay (subtle)
  bx.fillStyle='rgba(0,0,0,0.08)';
  for(let y=0;y<LH;y+=2){
    bx.fillRect(0,y,LW,1);
  }
}

// ── Lenticular at low res, then scale up ──
const offLo=document.createElement('canvas');
const offLoX=offLo.getContext('2d');
// Extra buffers for THE BETWEEN
const betweenLent=document.createElement('canvas');
const betweenLentX=betweenLent.getContext('2d');

function renderFrame(t){
  if(betweenOn){
    // ── THE BETWEEN: overlap of lenticular + anaglyph ──
    // Step 1: Render lenticular into buffer
    renderLo(t);
    betweenLent.width=LW; betweenLent.height=LH;
    betweenLentX.drawImage(lo,0,0);

    // Apply bezier lenticular strip offsets to lenticular buffer
    const lentOut=document.createElement('canvas');
    lentOut.width=LW; lentOut.height=LH;
    const lentOutX=lentOut.getContext('2d');
    const world=getWorld(ball.x);
    const worldIdx=WORLDS.indexOf(world);
    const bz=ZONE_BEZIERS[worldIdx];
    const rawTilt=mouseNorm-0.5;
    const tiltSign=rawTilt<0?-1:1;
    const tiltMag=Math.abs(rawTilt)*2;
    const easedTilt=bezierEase(Math.min(1,tiltMag),bz[0],bz[1],bz[2],bz[3]);
    const tiltPx=Math.round(tiltSign*easedTilt*10);
    let lx=0,fi=0;
    while(lx<LW){
      const sp=lx/LW;
      const dc=Math.abs(sp-0.5)*2;
      const wc=1-bezierEase(Math.min(1,dc),bz[0],bz[1],bz[2],bz[3]);
      const sw=Math.max(1,Math.round(1+wc*2));
      const dm=0.5+wc*1.0;
      const sa=((fi%N_FRAMES)/(N_FRAMES-1))*2-1;
      const sx=Math.max(0,Math.min(LW-1,lx+Math.round(sa*3*dm+tiltPx)));
      lentOutX.drawImage(betweenLent,sx,0,sw,LH,lx,0,sw,LH);
      lx+=sw;fi++;
    }

    // Step 2: Render anaglyph
    const savedCamX=camX;
    anaLeft.width=LW; anaLeft.height=LH;
    anaRight.width=LW; anaRight.height=LH;
    camX=savedCamX-eyeSep*LO_SCALE;
    renderLo(t);
    anaLeftCtx.drawImage(lo,0,0);
    camX=savedCamX+eyeSep*LO_SCALE;
    renderLo(t);
    anaRightCtx.drawImage(lo,0,0);
    camX=savedCamX;

    // Step 3: Pixel-level comparison at lo-res (cheap!)
    const lentData=lentOutX.getImageData(0,0,LW,LH);
    const leftData=anaLeftCtx.getImageData(0,0,LW,LH);
    const rightData=anaRightCtx.getImageData(0,0,LW,LH);
    const ld=lentData.data;
    const ad=leftData.data;
    const rd=rightData.data;

    // Parse world accent
    const ac=world.pal.accent;
    const acR=parseInt(ac.slice(1,3),16)||0;
    const acG=parseInt(ac.slice(3,5),16)||0;
    const acB=parseInt(ac.slice(5,7),16)||0;

    for(let i=0;i<ld.length;i+=4){
      const diffR=Math.abs(ld[i]-ad[i]);
      const diffG=Math.abs(ld[i+1]-rd[i+1]);
      const diffB=Math.abs(ld[i+2]-rd[i+2]);
      const diff=(diffR+diffG+diffB)/3;
      const crackMix=Math.min(1,diff/60);

      const baseR=(ld[i]+ad[i])>>1;
      const baseG=(ld[i+1]+rd[i+1])>>1;
      const baseB=(ld[i+2]+rd[i+2])>>1;

      if(betweenInverted){
        // INVERTED: agreement glows in accent, disagreement shows scene
        const invertMix = 1 - crackMix;
        ld[i]  =Math.min(255,Math.round(baseR*crackMix+acR*invertMix));
        ld[i+1]=Math.min(255,Math.round(baseG*crackMix+acG*invertMix));
        ld[i+2]=Math.min(255,Math.round(baseB*crackMix+acB*invertMix));
      } else {
        // NORMAL: agreement shows scene, disagreement shows crack
        ld[i]  =Math.min(255,Math.round(baseR*(1-crackMix)+(diffR*2+acR*0.3)*crackMix));
        ld[i+1]=Math.min(255,Math.round(baseG*(1-crackMix)+(diffG*0.5+acG*0.5)*crackMix));
        ld[i+2]=Math.min(255,Math.round(baseB*(1-crackMix)+(diffB*0.5+acB*0.5)*crackMix));
      }
      ld[i+3]=255;
    }
    loCtx.putImageData(lentData,0,0);

    // Scale up
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(lo,0,0,LW,LH,0,0,W,H);

  } else if(anaglyphOn){
    // ── Anaglyph 3D rendering ──
    const savedCamX=camX;

    // Ensure anaglyph buffers match lo canvas size
    anaLeft.width=LW; anaLeft.height=LH;
    anaRight.width=LW; anaRight.height=LH;

    // Render left eye (camX shifted left)
    camX=savedCamX - eyeSep * LO_SCALE;
    renderLo(t);
    anaLeftCtx.drawImage(lo,0,0);

    // Render right eye (camX shifted right)
    camX=savedCamX + eyeSep * LO_SCALE;
    renderLo(t);
    anaRightCtx.drawImage(lo,0,0);

    // Restore camX
    camX=savedCamX;

    // Composite: R from left eye, G+B from right eye
    const leftData=anaLeftCtx.getImageData(0,0,LW,LH);
    const rightData=anaRightCtx.getImageData(0,0,LW,LH);
    const ld=leftData.data;
    const rd=rightData.data;
    for(let i=0;i<ld.length;i+=4){
      ld[i]  =ld[i];     // R from left
      ld[i+1]=rd[i+1];   // G from right
      ld[i+2]=rd[i+2];   // B from right
      ld[i+3]=255;        // full alpha
    }
    loCtx.putImageData(leftData,0,0);

    // Scale up with nearest-neighbor
    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(lo,0,0,LW,LH,0,0,W,H);

  } else {
    // ── Bezier Lenticular (8-bit) ──
    // Strip width, tilt, and depth all shaped by the world's expression bezier
    renderLo(t);

    ctx.imageSmoothingEnabled=false;
    ctx.clearRect(0,0,W,H);

    // World bezier for lens character
    const world=getWorld(ball.x);
    const worldIdx=WORLDS.indexOf(world);
    const bz=ZONE_BEZIERS[worldIdx];

    // Bezier-eased tilt response
    const rawTilt=mouseNorm-0.5;
    const tiltSign=rawTilt<0?-1:1;
    const tiltMag=Math.abs(rawTilt)*2;
    const easedTilt=bezierEase(Math.min(1,tiltMag),bz[0],bz[1],bz[2],bz[3]);
    const tiltPx=Math.round(tiltSign*easedTilt*10); // lo-res pixels

    // Bezier-varied strip widths + depth
    let x=0, frameIdx=0;
    while(x<LW){
      const screenPos=x/LW;
      const distC=Math.abs(screenPos-0.5)*2;
      const widthCurve=1-bezierEase(Math.min(1,distC),bz[0],bz[1],bz[2],bz[3]);
      const stripW=Math.max(1,Math.round(1+widthCurve*2)); // 1-3px at lo-res

      const depthMul=0.5+widthCurve*1.0;
      const stripAngle=((frameIdx%N_FRAMES)/(N_FRAMES-1))*2-1;
      const srcX=Math.max(0,Math.min(LW-1,x+Math.round(stripAngle*3*depthMul+tiltPx)));

      ctx.drawImage(lo,srcX,0,stripW,LH,x*LO_SCALE,0,stripW*LO_SCALE,H);

      x+=stripW;
      frameIdx++;
    }
  }

  // CRT vignette
  const vig=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.65);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.45)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
}

// ── Physics ──
function update(dt){
  if(!playing)return;
  if(keys.ArrowRight||keys.KeyD)ball.vx+=300*dt;
  if(keys.ArrowLeft||keys.KeyA)ball.vx-=300*dt;
  if((keys.ArrowUp||keys.KeyW||keys.Space)&&ball.onGround){ball.vy=-350;ball.onGround=false}

  ball.vy+=600*dt;
  if(ball.onGround){ball.vx+=tSlope(ball.x)*8*dt;ball.vx*=0.997}
  ball.vx*=0.992;
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;

  if(ball.y>=0){
    ball.y=0;
    if(ball.vy>50)ball.vy*=-0.35;
    else{ball.vy=0;ball.onGround=true}
  }
  ball.rot+=ball.vx*dt*0.05;
  ball.trail.push({x:ball.x});
  if(ball.trail.length>20)ball.trail.shift();
  camX+=(ball.x-W/2-camX)*0.08;

  for(const gem of gems){
    if(!gem.collected&&Math.abs(ball.x-gem.x)<20){
      gem.collected=true;gem.flash=1;
      ball.gems++;ball.flash=1;
      spawnParticles(gem.x,0,getWorld(ball.x).pal.gem,6);
    }
  }

  // Enemy patrol & collision
  for(const en of enemies){
    if(en.dead)continue;
    en.x+=en.dir*en.speed*dt;
    if(en.x>en.baseX+en.patrolW/2){en.x=en.baseX+en.patrolW/2;en.dir=-1}
    if(en.x<en.baseX-en.patrolW/2){en.x=en.baseX-en.patrolW/2;en.dir=1}
    const dx=Math.abs(ball.x-en.x);
    const hitW=ENEMY_TYPES[en.type].w*LO_SCALE*0.5+ball.r*LO_SCALE;
    if(dx<hitW){
      // Check if ball is stomping (above enemy, moving down)
      if(ball.vy>0&&ball.y<-2){
        // Kill enemy
        en.dead=true;
        ball.vy=-200;
        ball.gems+=1;
        spawnParticles(en.x,0,ENEMY_TYPES[en.type].palette[0],8);
      } else if(ball.onGround||ball.y>-10){
        // Contact damage — lose a gem
        if(ball.gems>0&&ball.flash<=0){
          ball.gems--;
          ball.flash=1;
          spawnParticles(ball.x,ball.y,'#ff0000',4);
        }
      }
    }
  }

  // Hybrid core collection
  for(const hc of hybridCores){
    if(!hc.collected&&Math.abs(ball.x-hc.x)<20){
      hc.collected=true;hc.flash=1;
      ball.gems+=2; // worth 2 points
      ball.flash=1;
      spawnParticles(hc.x,0,getWorld(ball.x).pal.accent,8);
    }
  }

  // Vial fluid physics
  for(const key of ['vol','pit']){
    const v = vials[key];
    v.waveVel += ball.vx * 0.0001;
    v.wave += v.waveVel;
    v.waveVel *= 0.95;
    v.wave *= 0.97;
  }

  const world=getWorld(ball.x);
  document.getElementById('scoreVal').textContent=ball.gems;
  document.getElementById('worldName').textContent=world.name;
  document.getElementById('worldName').style.color=world.pal.accent;
  document.querySelector('.panel').style.borderColor=world.pal.accent;
}

// ── Intro rendering ──
function renderIntro(dt){
  introTimer+=dt;
  const bx=loCtx;
  bx.fillStyle='#000';
  bx.fillRect(0,0,LW,LH);

  const cx=Math.floor(LW/2);
  const cy=Math.floor(LH/2);

  if(introPhase==='scanning'){
    // "SCANNING SPRITES..." text
    bx.fillStyle='#00ffd2';
    bx.font='5px monospace';
    bx.textAlign='center';
    bx.fillText('SCANNING SPRITES...',cx,cy-12);

    // Reveal enemy type previews one by one
    const revealTime=0.5; // seconds per reveal
    introRevealedTypes=Math.min(3,Math.floor(introTimer/revealTime)+1);

    const typeKeys=['MECHA','MAGE','GOLEM'];
    const typeColors=[['#00ccaa','#00ffdd'],['#cc2222','#ff4444'],['#887766','#aa9977']];
    const startX=cx-20;
    for(let i=0;i<introRevealedTypes;i++){
      const tx=startX+i*20;
      const ty=cy+2;
      // Label
      bx.fillStyle=typeColors[i][1];
      bx.font='3px monospace';
      bx.fillText(typeKeys[i],tx,ty+12);
      // Draw mini preview
      const fakePal={accent:typeColors[i][1],gem:'#ffaa22',star:'#88aacc',dark:'#111'};
      drawEnemy8(bx,tx,ty,typeKeys[i],fakePal,introTimer);
    }

    // Blinking cursor
    if(Math.sin(introTimer*6)>0) px(bx,cx+30,cy-13,2,1,'#00ffd2');

    // After 1.5s, transition to forging
    if(introTimer>=1.5){
      introPhase='forging';introTimer=0;
    }
  } else if(introPhase==='forging'){
    // "FORGING..." text
    bx.fillStyle='#ff8822';
    bx.font='5px monospace';
    bx.textAlign='center';
    bx.fillText('FORGING...',cx,cy-4);

    // Progress bar
    const barW=40;
    const progress=Math.min(1,introTimer/1.0);
    const bx0=cx-barW/2;
    const by0=cy+4;
    px(bx,bx0,by0,barW,3,'#111');
    px(bx,bx0,by0,Math.floor(barW*progress),3,'#ff8822');
    px(bx,bx0,by0,Math.floor(barW*progress),1,'#ffcc44');

    if(introTimer>=1.0){
      introPhase='done';playing=true;
    }
  }

  // Scale up to main canvas
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(lo,0,0,LW,LH,0,0,W,H);
}

// ── Loop ──
let lastT=0;
function loop(ts){
  const dt=Math.min((ts-lastT)/1000,0.05);
  lastT=ts;gameTime+=dt;

  if(introPhase==='scanning'||introPhase==='forging'){
    renderIntro(dt);
  } else {
    update(dt);
    if(playing)renderFrame(gameTime);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);