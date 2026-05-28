const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight}
resize();addEventListener('resize',resize);

// Sieve seeds
const SEEDS=[9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];

// ── Five Worlds ──
const WORLDS = [
  {name:'PINK HOUR',    sky1:'#1e0818',sky2:'#120410',ground:'#3a1028',accent:'#ff66aa',terrainMul:0.8},
  {name:'THE BLOCK',    sky1:'#021a10',sky2:'#010d08',ground:'#0a2a14',accent:'#00ff9d',terrainMul:1.2},
  {name:'THE THRESHOLD',sky1:'#020a14',sky2:'#010510',ground:'#0a1820',accent:'#00b8c8',terrainMul:1.0},
  {name:'VAULT COMPOUND 7',sky1:'#140a02',sky2:'#0a0501',ground:'#1a1208',accent:'#ff8833',terrainMul:0.6},
  {name:'THE BETWEEN',  sky1:'#000210',sky2:'#000108',ground:'#040818',accent:'#6688ff',terrainMul:1.5},
];

// ── Bezier Ease (cubic bezier from face-forge expression pipeline) ──
function bezierEase(t, p1x, p1y, p2x, p2y) {
  // Newton-Raphson to solve cubic bezier x(s) = t for s, then return y(s)
  let s = t; // initial guess
  for (let i = 0; i < 8; i++) {
    const s2 = s * s, s3 = s2 * s;
    const xs = 3 * (1 - s) * (1 - s) * s * p1x + 3 * (1 - s) * s2 * p2x + s3;
    const dxds = 3 * (1 - s) * (1 - s) * p1x + 6 * (1 - s) * s * (p2x - p1x) + 3 * s2 * (1 - p2x);
    if (Math.abs(dxds) < 1e-6) break;
    s -= (xs - t) / dxds;
    s = Math.max(0, Math.min(1, s));
  }
  const s2 = s * s, s3 = s2 * s;
  return 3 * (1 - s) * (1 - s) * s * p1y + 3 * (1 - s) * s2 * p2y + s3;
}

// Expression transition beziers (face-forge pipeline)
const ZONE_BEZIERS = [
  [0.05, 0.12, 0.49, 1.00], // neutral_to_onset:   Pink Hour — smooth build
  [0.33, 0.95, 0.55, 1.25], // onset_to_peak:      The Block — dilla drop with overshoot
  [0.10, 0.20, 0.38, 1.00], // peak_to_compress:   The Threshold — fast strip
  [0.42, 0.58, 0.82, 1.08], // compress_to_settle: Vault — ease out bounce
  [0.34, 0.21, 0.94, 1.08], // settle_to_neutral:  The Between — elastic return
];

// ── Terrain — 5 world zones across 4000 units, bezier-enveloped ──
const TW = 4000;
const ZONE_W = TW / 5;
const terrain = new Float32Array(TW);
for(let i=0;i<TW;i++){
  const worldIdx = Math.min(Math.floor(i / ZONE_W), 4);
  const mul = WORLDS[worldIdx].terrainMul;
  const rawSine = (
    Math.sin(i*0.008+SEEDS[0]*0.01)*120*mul +
    Math.sin(i*0.023+SEEDS[1]*0.01)*50*mul +
    Math.sin(i*0.041+SEEDS[2]*0.01)*25 +
    Math.sin(i*0.067+SEEDS[3]*0.01)*12 +
    Math.cos(i*0.015+SEEDS[4]*0.01)*60*mul
  );
  // Bezier envelope: position within zone [0..1]
  const zoneLocal = (i - worldIdx * ZONE_W) / ZONE_W;
  const bz = ZONE_BEZIERS[worldIdx];
  const envelope = bezierEase(zoneLocal, bz[0], bz[1], bz[2], bz[3]);
  terrain[i] = rawSine * (0.3 + 0.7 * envelope);
}
function tAt(x){const i=((x%TW)+TW)%TW;const i0=Math.floor(i)%TW;const i1=(i0+1)%TW;const t=i-Math.floor(i);return terrain[i0]*(1-t)+terrain[i1]*t}
function tSlope(x){return tAt(x+0.5)-tAt(x-0.5)}
function getWorld(x){return WORLDS[Math.min(Math.floor(((x%TW)+TW)%TW / ZONE_W), 4)]}

// ── Ball ──
const ball = {x:100,y:0,vx:0,vy:0,r:12,rot:0,onGround:false,trail:[],gems:0,flash:0};

// ── Fluid Vials (Volume & Pitch) ──
const vials = {
  vol: { value: 0.8, wave: 0, waveVel: 0, dragging: false },
  pit: { value: 0.5, wave: 0, waveVel: 0, dragging: false }, // 0.5 = playbackRate 1.0
};

// ── Particles (from 8-bit) ──
const particles=[];
function spawnParticles(x,y,col,n){
  for(let i=0;i<n;i++){
    particles.push({x,y:0,vx:(Math.random()-0.5)*200,vy:-Math.random()*300,life:1,col});
  }
}

// ── Gems — sieve-seeded ──
const gems = [];
for(let i=0;i<SEEDS.length*2;i++){
  gems.push({x:(SEEDS[i%SEEDS.length]*7+i*120)%TW, collected:false, bob:Math.random()*Math.PI*2, flash:0});
}

// ── Lenticular ──
const N_FRAMES = 7;
const STRIP_W = 3;
let mouseNorm = 0.5;
let camX = 0;

// ── Anaglyph 3D ──
let anaglyphOn = false;
let betweenOn = false; // THE BETWEEN: overlap of lenticular + anaglyph
let betweenInverted = false; // INVERTED BETWEEN: agreement glows, disagreement shows scene
const EYE_DISTANCES = [
  {label:'CLOSE', sep:30},
  {label:'MEDIUM', sep:16},
  {label:'FAR', sep:6}
];
let eyeDistIdx = 1; // start at MEDIUM
let eyeSep = EYE_DISTANCES[eyeDistIdx].sep;
const anaLeftC = document.createElement('canvas');
const anaLeftX = anaLeftC.getContext('2d');
const anaRightC = document.createElement('canvas');
const anaRightX = anaRightC.getContext('2d');

// ── Audio ──
let tracks=[], currentTrack=0, audioCtx=null, analyser=null, freqData=null, musicStarted=false;
const audio = document.getElementById('audio');
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
    // Cycle: lenticular → anaglyph → THE BETWEEN → lenticular
    if(!anaglyphOn && !betweenOn){ anaglyphOn=true; }
    else if(anaglyphOn && !betweenOn){ anaglyphOn=false; betweenOn=true; }
    else { betweenOn=false; }
    updateHint();
  }
  if(e.code==='KeyB'&&betweenOn){ betweenInverted=!betweenInverted; updateHint(); }
  if(e.code==='KeyV'&&(anaglyphOn||betweenOn)){
    eyeDistIdx=(eyeDistIdx+1)%EYE_DISTANCES.length;
    eyeSep=EYE_DISTANCES[eyeDistIdx].sep;
    updateHint();
  }
});
addEventListener('keyup',e=>{keys[e.code]=false});
canvas.addEventListener('mousemove',e=>{mouseNorm=e.clientX/W});
canvas.addEventListener('touchmove',e=>{mouseNorm=e.touches[0].clientX/W;e.preventDefault()},{passive:false});

let playing = false;
let gameTime = 0;

document.getElementById('goBtn').addEventListener('click',()=>{
  startMusic();playing=true;
  document.getElementById('start').classList.add('hidden');
});

// ── Offscreen buffer ──
const offC = document.createElement('canvas');
const offX = offC.getContext('2d');

// ── Render scene ──
function renderScene(buf, bx, shift, w, h, t){
  const baseY = h * 0.55;
  const world = getWorld(ball.x);

  // Sky gradient per world
  const skyG = bx.createLinearGradient(0,0,0,baseY);
  skyG.addColorStop(0, world.sky1);
  skyG.addColorStop(1, world.sky2);
  bx.fillStyle = skyG;
  bx.fillRect(0,0,w,h);

  // Stars — blinking
  for(let i=0;i<50;i++){
    const blink = Math.sin(t*2+i*1.7);
    if(blink < 0.3) continue;
    const alpha = 0.2 + blink * 0.3;
    bx.fillStyle = `rgba(200,220,255,${alpha})`;
    const sx=((SEEDS[i%15]*3+i*47+shift*0.2)%w+w)%w;
    const sy=(SEEDS[i%15]*7+i*31)%(baseY*0.7);
    bx.fillRect(sx,sy,0.5+(i%3),0.5+(i%3));
  }

  // Far mountains
  bx.beginPath();bx.moveTo(0,h);
  for(let sx=0;sx<=w;sx+=3){
    bx.lineTo(sx, baseY - tAt((sx+camX*0.3+shift*0.15)*0.4)*0.3 - 30);
  }
  bx.lineTo(w,h);bx.closePath();
  bx.fillStyle = world.sky2;bx.fill();

  // Mid hills
  bx.beginPath();bx.moveTo(0,h);
  for(let sx=0;sx<=w;sx+=2){
    bx.lineTo(sx, baseY - tAt((sx+camX*0.6+shift*0.4)*0.7)*0.5 - 15);
  }
  bx.lineTo(w,h);bx.closePath();
  const midCol = world.ground;
  bx.fillStyle = midCol+'88';bx.fill();

  // Main ground
  bx.beginPath();bx.moveTo(0,h);
  for(let sx=0;sx<=w;sx++){
    bx.lineTo(sx, baseY - tAt(sx+camX+shift));
  }
  bx.lineTo(w,h);bx.closePath();
  const gG = bx.createLinearGradient(0,baseY-140,0,h);
  gG.addColorStop(0, world.ground);
  gG.addColorStop(1, world.sky2);
  bx.fillStyle = gG;bx.fill();

  // Ground edge glow in world accent color
  bx.beginPath();
  for(let sx=0;sx<=w;sx++){
    const gy = baseY - tAt(sx+camX+shift);
    if(sx===0)bx.moveTo(sx,gy);else bx.lineTo(sx,gy);
  }
  bx.strokeStyle = world.accent + '20';bx.lineWidth=1;bx.stroke();

  // Audio-reactive terrain pulse
  if(analyser && freqData){
    analyser.getByteFrequencyData(freqData);
    const bass = (freqData[1]+freqData[2]+freqData[3])/3/255;
    if(bass > 0.25){
      bx.strokeStyle = world.accent + Math.round(bass*40).toString(16).padStart(2,'0');
      bx.lineWidth = 2;
      bx.beginPath();
      for(let sx=0;sx<=w;sx+=3){
        const gy = baseY - tAt(sx+camX+shift) - bass*10;
        if(sx===0)bx.moveTo(sx,gy);else bx.lineTo(sx,gy);
      }
      bx.stroke();
    }
  }

  // Gems
  for(const gem of gems){
    if(gem.collected){
      if(gem.flash>0){
        gem.flash-=0.04;
        const gsx=gem.x-camX-shift;
        if(gsx>-30&&gsx<w+30){
          const gy=baseY-tAt(gem.x)-16;
          const burst=gem.flash;
          bx.strokeStyle=`rgba(212,168,68,${burst})`;bx.lineWidth=1;
          bx.beginPath();bx.arc(gsx,gy,(1-burst)*24,0,Math.PI*2);bx.stroke();
        }
      }
      continue;
    }
    const gsx = gem.x - camX - shift;
    if(gsx < -20 || gsx > w+20)continue;
    const gy = baseY - tAt(gem.x) - 16 + Math.sin(t*3+gem.bob)*4;
    const grd = bx.createRadialGradient(gsx,gy,0,gsx,gy,18);
    grd.addColorStop(0,'rgba(212,168,68,0.4)');grd.addColorStop(1,'rgba(212,168,68,0)');
    bx.fillStyle=grd;bx.beginPath();bx.arc(gsx,gy,18,0,Math.PI*2);bx.fill();
    bx.fillStyle='#D4A844';
    bx.beginPath();bx.moveTo(gsx,gy-8);bx.lineTo(gsx+6,gy);bx.lineTo(gsx,gy+8);bx.lineTo(gsx-6,gy);bx.closePath();bx.fill();
  }

  // Particles
  for(let i=particles.length-1;i>=0;i--){
    const pt=particles[i];
    pt.x+=pt.vx*0.016;pt.y+=pt.vy*0.016;pt.vy+=400*0.016;pt.life-=0.025;
    if(pt.life<=0){particles.splice(i,1);continue}
    const psx=pt.x-camX-shift;
    const psy=baseY-tAt(pt.x)+pt.y;
    if(psx>-10&&psx<w+10&&psy>0&&psy<h){
      const pa=pt.life*0.8;
      const grd=bx.createRadialGradient(psx,psy,0,psx,psy,4);
      grd.addColorStop(0,pt.life>0.5?`rgba(255,255,255,${pa})`:`rgba(212,168,68,${pa})`);
      grd.addColorStop(1,'rgba(0,0,0,0)');
      bx.fillStyle=grd;bx.beginPath();bx.arc(psx,psy,4,0,Math.PI*2);bx.fill();
    }
  }

  // Ball trail
  for(let i=0;i<ball.trail.length;i++){
    const tr=ball.trail[i];
    const tsx=tr.x-camX-shift;
    const tsy=baseY-tAt(tr.x)-ball.r;
    const a=(i/ball.trail.length)*0.2;
    bx.fillStyle=world.accent+Math.round(a*255).toString(16).padStart(2,'0');
    bx.beginPath();bx.arc(tsx,tsy,ball.r*(i/ball.trail.length)*0.5,0,Math.PI*2);bx.fill();
  }

  // Ball
  const bsx=ball.x-camX-shift;
  const bsy=baseY-tAt(ball.x)-ball.r+ball.y;
  // Shadow
  bx.fillStyle='rgba(0,0,0,0.3)';
  bx.beginPath();bx.ellipse(bsx,baseY-tAt(ball.x),ball.r*0.8,4,0,0,Math.PI*2);bx.fill();
  // Body with world-colored gradient
  const bg=bx.createRadialGradient(bsx-3,bsy-3,2,bsx,bsy,ball.r);
  bg.addColorStop(0,'#fff');bg.addColorStop(0.3,world.accent);bg.addColorStop(1,world.ground);
  bx.fillStyle=bg;bx.beginPath();bx.arc(bsx,bsy,ball.r,0,Math.PI*2);bx.fill();
  // Spin line
  bx.strokeStyle='rgba(0,0,0,0.3)';bx.lineWidth=1.5;
  bx.beginPath();
  bx.moveTo(bsx+Math.cos(ball.rot)*ball.r*0.7,bsy+Math.sin(ball.rot)*ball.r*0.7);
  bx.lineTo(bsx-Math.cos(ball.rot)*ball.r*0.7,bsy-Math.sin(ball.rot)*ball.r*0.7);
  bx.stroke();
}

// ── Fluid Vials Draw ──
function drawVials(t){
  const world = getWorld(ball.x);
  const accent = world.accent;
  const acR = parseInt(accent.slice(1,3),16);
  const acG = parseInt(accent.slice(3,5),16);
  const acB = parseInt(accent.slice(5,7),16);

  const vialDefs = [
    { key:'vol', x:24, y:120, label:'VOL', fmt:v=>Math.round(v*100)+'%' },
    { key:'pit', x:64, y:120, label:'PIT', fmt:v=>(0.5+v*1.5).toFixed(1)+'x' },
  ];

  for(const def of vialDefs){
    const vial = vials[def.key];
    const vx = def.x, vy = def.y;
    const vw = 30, vh = 80;

    // Morphing blob outline using bezier curves (slower morph than terrain)
    ctx.save();
    const morphT = t * 0.7;
    const pts = [];
    for(let i=0;i<8;i++){
      const angle = (i/8)*Math.PI*2;
      const rx = (vw/2) + Math.sin(morphT*0.8+i*1.3)*1.5 + Math.sin(morphT*1.2+i*2.1)*1.0;
      const ry = (vh/2) + Math.sin(morphT*0.6+i*1.7)*2.0 + Math.cos(morphT*0.9+i*2.5)*1.5;
      pts.push({
        x: vx + vw/2 + Math.cos(angle)*rx,
        y: vy + vh/2 + Math.sin(angle)*ry
      });
    }

    // Build blob path
    function blobPath(){
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=0;i<pts.length;i++){
        const curr = pts[i];
        const next = pts[(i+1)%pts.length];
        const cpx = (curr.x+next.x)/2 + Math.sin(morphT+i*0.9)*2;
        const cpy = (curr.y+next.y)/2 + Math.cos(morphT+i*1.1)*2;
        ctx.quadraticCurveTo(cpx, cpy, next.x, next.y);
      }
      ctx.closePath();
    }

    // Dark fill + clip
    blobPath();
    ctx.fillStyle = 'rgba(0,14,30,0.8)';
    ctx.fill();
    ctx.clip();

    // Fluid inside — level based on value
    const fluidTop = vy + vh*(1-vial.value);
    const waveAmp = Math.abs(vial.wave)*8;
    const waveFreq = 0.15;

    // Wavy fluid surface
    ctx.beginPath();
    for(let fx=vx-2;fx<=vx+vw+2;fx++){
      const sy = fluidTop + Math.sin((fx-vx)*waveFreq + vial.wave*6 + t*2)*waveAmp;
      if(fx===vx-2) ctx.moveTo(fx, sy);
      else ctx.lineTo(fx, sy);
    }
    ctx.lineTo(vx+vw+2, vy+vh+4);
    ctx.lineTo(vx-2, vy+vh+4);
    ctx.closePath();
    ctx.fillStyle = `rgba(${acR},${acG},${acB},0.6)`;
    ctx.fill();

    // Highlight line just below surface
    ctx.beginPath();
    for(let fx=vx-2;fx<=vx+vw+2;fx++){
      const sy = fluidTop + Math.sin((fx-vx)*waveFreq + vial.wave*6 + t*2)*waveAmp + 2;
      if(fx===vx-2) ctx.moveTo(fx, sy);
      else ctx.lineTo(fx, sy);
    }
    ctx.strokeStyle = `rgba(${acR},${acG},${acB},0.8)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Blob outline (on top, unclipped)
    blobPath();
    ctx.strokeStyle = `rgba(${acR},${acG},${acB},0.3)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label above
    ctx.font = '7px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(${acR},${acG},${acB},0.4)`;
    ctx.fillText(def.label, vx+vw/2, vy-6);

    // Value inside near bottom
    ctx.font = '8px "Share Tech Mono", monospace';
    ctx.fillStyle = `rgba(${acR},${acG},${acB},0.7)`;
    ctx.fillText(def.fmt(vial.value), vx+vw/2, vy+vh-6);
  }
}

// ── Vial hit testing & interaction ──
const VIAL_RECTS = {
  vol: {x:24, y:120, w:30, h:80},
  pit: {x:64, y:120, w:30, h:80},
};

canvas.addEventListener('mousedown', e=>{
  const mx=e.clientX, my=e.clientY;
  for(const key of ['vol','pit']){
    const r=VIAL_RECTS[key];
    if(mx>=r.x && mx<=r.x+r.w && my>=r.y && my<=r.y+r.h){
      vials[key].dragging=true;
      vials[key].value=1-Math.max(0,Math.min(1,(my-r.y)/r.h));
      applyVialValue(key);
      e.preventDefault();
    }
  }
});

canvas.addEventListener('mousemove', e=>{
  for(const key of ['vol','pit']){
    if(vials[key].dragging){
      const r=VIAL_RECTS[key];
      vials[key].value=1-Math.max(0,Math.min(1,(e.clientY-r.y)/r.h));
      applyVialValue(key);
    }
  }
});

addEventListener('mouseup', ()=>{
  vials.vol.dragging=false;
  vials.pit.dragging=false;
});

function applyVialValue(key){
  if(key==='vol'){
    audio.volume=vials.vol.value;
  } else if(key==='pit'){
    audio.playbackRate=0.5+vials.pit.value*1.5;
  }
}

// Apply initial values
audio.volume = vials.vol.value;

// ── Hint text updater ──
function updateHint(){
  const el = document.getElementById('hint');
  if(betweenOn){
    el.textContent = 'A/D ROLL \u00b7 SPACE JUMP \u00b7 N NEXT \u00b7 3=Mode \u00b7 V=Depth (' + EYE_DISTANCES[eyeDistIdx].label + ') \u00b7 B=Invert \u00b7 THE BETWEEN \u00b7 ' + (betweenInverted ? 'INVERTED' : 'NORMAL');
  } else if(anaglyphOn){
    el.textContent = 'A/D ROLL \u00b7 SPACE JUMP \u00b7 N NEXT \u00b7 3=Mode \u00b7 V=Depth (' + EYE_DISTANCES[eyeDistIdx].label + ') \u00b7 ANAGLYPH';
  } else {
    el.textContent = 'A/D ROLL \u00b7 SPACE JUMP \u00b7 MOUSE TILT \u00b7 N NEXT \u00b7 3=Mode \u00b7 LENTICULAR';
  }
}

// ── THE BETWEEN: lenticular + anaglyph overlap ──
// Renders BOTH systems, then computes the difference.
// Where they agree = solid depth (bright). Where they disagree = the crack (the expression).
const betweenC = document.createElement('canvas');
const betweenX = betweenC.getContext('2d');

function renderBetween(t){
  // Step 1: Render lenticular into a buffer
  const lentC = document.createElement('canvas');
  lentC.width = W; lentC.height = H;
  const lentX = lentC.getContext('2d');

  // Lenticular pass (bezier strips into lentC)
  offC.width=W+120;offC.height=H;
  renderScene(offC,offX,0,W+120,H,t);
  const world = getWorld(ball.x);
  const worldIdx = WORLDS.indexOf(world);
  const bz = ZONE_BEZIERS[worldIdx];
  const rawTilt = mouseNorm - 0.5;
  const tiltSign = rawTilt < 0 ? -1 : 1;
  const tiltMag = Math.abs(rawTilt) * 2;
  const easedTilt = bezierEase(Math.min(1, tiltMag), bz[0], bz[1], bz[2], bz[3]);
  const tiltOffset = tiltSign * easedTilt * 50;
  let x = 0, frameIdx = 0;
  while(x < W){
    const screenPos = x / W;
    const distFromCenter = Math.abs(screenPos - 0.5) * 2;
    const widthCurve = 1 - bezierEase(Math.min(1, distFromCenter), bz[0], bz[1], bz[2], bz[3]);
    const stripW = Math.max(1, Math.round(1 + widthCurve * 5));
    const depthMul = 0.5 + widthCurve * 1.0;
    const stripAngle = ((frameIdx % N_FRAMES) / (N_FRAMES - 1)) * 2 - 1;
    const srcX = x + 60 + Math.round(stripAngle * 16 * depthMul + tiltOffset);
    lentX.drawImage(offC, Math.max(0, srcX), 0, stripW, H, x, 0, stripW, H);
    x += stripW; frameIdx++;
  }

  // Step 2: Render anaglyph into another buffer
  anaLeftC.width=W;anaLeftC.height=H;
  anaRightC.width=W;anaRightC.height=H;
  const savedCamX = camX;
  camX = savedCamX - eyeSep;
  renderScene(anaLeftC, anaLeftX, 0, W, H, t);
  camX = savedCamX + eyeSep;
  renderScene(anaRightC, anaRightX, 0, W, H, t);
  camX = savedCamX;

  // Step 3: THE BETWEEN — pixel-level comparison
  const lentData = lentX.getImageData(0, 0, W, H);
  const leftData = anaLeftX.getImageData(0, 0, W, H);
  const rightData = anaRightX.getImageData(0, 0, W, H);
  const ld = lentData.data;
  const ad = leftData.data;
  const rd = rightData.data;
  const out = ctx.createImageData(W, H);
  const od = out.data;

  for(let i = 0; i < ld.length; i += 4){
    // Lenticular pixel (spatial depth)
    const lr = ld[i], lg = ld[i+1], lb = ld[i+2];

    // Anaglyph pixel (color depth): R from left, G+B from right
    const ar = ad[i], ag = rd[i+1], ab = rd[i+2];

    // THE OVERLAP: where both systems see the same thing
    // Difference = the crack = where the two depth methods disagree
    const diffR = Math.abs(lr - ar);
    const diffG = Math.abs(lg - ag);
    const diffB = Math.abs(lb - ab);
    const diff = (diffR + diffG + diffB) / 3; // 0 = perfect agreement, 255 = total disagreement

    // Agreement intensity (inverted diff)
    const agreement = 1 - diff / 255;

    // THE BETWEEN composite:
    // Agreed regions: blend of both (solid, bright) in world accent
    // Disagreed regions: the CRACK — show the difference as the expression
    // High agreement = original scene color. Low agreement = depth-crack color.
    const accentR = parseInt(world.accent.slice(1,3), 16);
    const accentG = parseInt(world.accent.slice(3,5), 16);
    const accentB = parseInt(world.accent.slice(5,7), 16);

    // Base: average of both methods
    const baseR = (lr + ar) >> 1;
    const baseG = (lg + ag) >> 1;
    const baseB = (lb + ab) >> 1;

    // Where they agree: show the scene
    // Where they disagree: show the CRACK (difference) tinted in world accent
    const crackMix = Math.min(1, diff / 80); // sensitivity

    if(betweenInverted){
      // INVERTED: agreement glows in accent, disagreement shows scene
      const invertMix = 1 - crackMix;
      od[i]   = Math.min(255, Math.round(baseR * crackMix + accentR * invertMix));
      od[i+1] = Math.min(255, Math.round(baseG * crackMix + accentG * invertMix));
      od[i+2] = Math.min(255, Math.round(baseB * crackMix + accentB * invertMix));
    } else {
      // NORMAL: agreement shows scene, disagreement shows crack
      od[i]   = Math.round(baseR * (1 - crackMix) + (diffR * 2 + accentR * 0.3) * crackMix);
      od[i+1] = Math.round(baseG * (1 - crackMix) + (diffG * 0.5 + accentG * 0.5) * crackMix);
      od[i+2] = Math.round(baseB * (1 - crackMix) + (diffB * 0.5 + accentB * 0.5) * crackMix);
    }
    od[i+3] = 255;
  }

  ctx.putImageData(out, 0, 0);

  // Vignette (tighter for THE BETWEEN)
  const vig = ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.6);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.5)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

  // Collection flash
  if(ball.flash>0){
    ball.flash-=0.03;
    ctx.fillStyle=`rgba(255,255,255,${ball.flash*0.15})`;
    ctx.fillRect(0,0,W,H);
  }

  // Scanlines (heavier in THE BETWEEN)
  ctx.fillStyle='rgba(0,0,0,0.05)';
  for(let y=0;y<H;y+=2){ctx.fillRect(0,y,W,1)}

  // Fluid vials
  drawVials(gameTime);
}

// ── Anaglyph render ──
function renderAnaglyph(t){
  anaLeftC.width=W;anaLeftC.height=H;
  anaRightC.width=W;anaRightC.height=H;

  // Render left eye (camX shifted left by eyeSep)
  const savedCamX = camX;
  camX = savedCamX - eyeSep;
  renderScene(anaLeftC, anaLeftX, 0, W, H, t);

  // Render right eye (camX shifted right by eyeSep)
  camX = savedCamX + eyeSep;
  renderScene(anaRightC, anaRightX, 0, W, H, t);

  // Restore camX
  camX = savedCamX;

  // Composite: red from left eye, cyan (green+blue) from right eye
  const leftData = anaLeftX.getImageData(0, 0, W, H);
  const rightData = anaRightX.getImageData(0, 0, W, H);
  const ld = leftData.data;
  const rd = rightData.data;
  for(let i = 0; i < ld.length; i += 4){
    ld[i]   = ld[i];         // red from left
    ld[i+1] = rd[i+1];       // green from right
    ld[i+2] = rd[i+2];       // blue from right
    // alpha stays 255
  }
  ctx.putImageData(leftData, 0, 0);

  // Vignette
  const vig = ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.7);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

  // Collection flash
  if(ball.flash>0){
    ball.flash-=0.03;
    ctx.fillStyle=`rgba(255,255,255,${ball.flash*0.15})`;
    ctx.fillRect(0,0,W,H);
  }

  // Scanlines
  ctx.fillStyle='rgba(0,0,0,0.03)';
  for(let y=0;y<H;y+=3){ctx.fillRect(0,y,W,1)}

  // Fluid vials
  drawVials(gameTime);
}

// ── Bezier Lenticular ──
// The lens itself is shaped by face-forge expression curves.
// Strip width, tilt response, and parallax depth all vary by world bezier.
function renderLenticular(t){
  offC.width=W+120;offC.height=H;
  renderScene(offC,offX,0,W+120,H,t);

  // Which world bezier are we in?
  const world = getWorld(ball.x);
  const worldIdx = WORLDS.indexOf(world);
  const bz = ZONE_BEZIERS[worldIdx];

  // Bezier-eased tilt: mouse input goes through the world's expression curve
  const rawTilt = mouseNorm - 0.5; // -0.5 to 0.5
  const tiltSign = rawTilt < 0 ? -1 : 1;
  const tiltMag = Math.abs(rawTilt) * 2; // 0 to 1
  const easedTilt = bezierEase(Math.min(1, tiltMag), bz[0], bz[1], bz[2], bz[3]);
  const tiltOffset = tiltSign * easedTilt * 50; // max 50px parallax

  // Bezier-varied strip widths across screen
  // Center strips are wider (more parallax), edges are narrower (sharper)
  let x = 0;
  let frameIdx = 0;
  while(x < W){
    // Position across screen [0..1]
    const screenPos = x / W;
    // Bezier-shaped strip width: peaks at center, narrows at edges
    const distFromCenter = Math.abs(screenPos - 0.5) * 2; // 0 at center, 1 at edges
    const widthCurve = 1 - bezierEase(Math.min(1, distFromCenter), bz[0], bz[1], bz[2], bz[3]);
    const stripW = Math.max(1, Math.round(1 + widthCurve * 5)); // 1-6px wide

    // Parallax depth — fractal D principle: complex areas get more depth
    // Center has most visual detail (high D), edges are simpler (low D)
    // Depth multiplier mirrors the filter hierarchy: most effect where signal is strongest
    const depthMul = 0.5 + widthCurve * 1.0; // 0.5x at edges, 1.5x at center

    // Audio-reactive depth boost — bass adds parallax (the beat IS the depth)
    const bassBoost = (window.AUDIO_BASS || 0) / 255 * 0.3;

    const stripAngle = ((frameIdx % N_FRAMES) / (N_FRAMES - 1)) * 2 - 1;
    const srcX = x + 60 + Math.round(stripAngle * 16 * (depthMul + bassBoost) + tiltOffset);

    ctx.drawImage(offC, Math.max(0, srcX), 0, stripW, H, x, 0, stripW, H);

    x += stripW;
    frameIdx++;
  }

  // ── MELANIN COLOR SHIFT — angle-dependent absorption ──
  // Straight-on = eumelanin (warm dark). Tilted = pheomelanin (brighter presence).
  // The lenticular lens IS melanin — it absorbs differently at each angle.
  const absorbAngle = Math.abs(rawTilt); // 0 = straight, 0.5 = max tilt
  const euR = 0.07, euG = 0.045, euB = 0.025; // eumelanin (dark absorption)
  const phR = 0.15, phG = 0.08, phB = 0.04;   // pheomelanin (warm presence)
  const melaninAlpha = absorbAngle * 0.12; // subtle blend
  if(melaninAlpha > 0.005) {
    const mr = Math.round((euR * (1-absorbAngle) + phR * absorbAngle) * 255);
    const mg = Math.round((euG * (1-absorbAngle) + phG * absorbAngle) * 255);
    const mb = Math.round((euB * (1-absorbAngle) + phB * absorbAngle) * 255);
    ctx.fillStyle = `rgba(${mr},${mg},${mb},${melaninAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Vignette — melanin-aware (darker center when straight, warmer edges when tilted)
  const vigInner = absorbAngle < 0.15 ? 'rgba(0,0,0,0)' : `rgba(${Math.round(phR*400)},${Math.round(phG*400)},${Math.round(phB*400)},0.03)`;
  const vig = ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.7);
  vig.addColorStop(0, vigInner);
  vig.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

  // Collection flash
  if(ball.flash>0){
    ball.flash-=0.03;
    ctx.fillStyle=`rgba(255,255,255,${ball.flash*0.15})`;
    ctx.fillRect(0,0,W,H);
  }

  // Subtle scanlines — Turing-modulated density
  // At high tilt, scanlines shift pattern (spots vs stripes vs none)
  const scanDensity = absorbAngle < 0.1 ? 3 : absorbAngle < 0.3 ? 2 : 4;
  ctx.fillStyle = `rgba(0,0,0,${0.02 + absorbAngle * 0.02})`;
  for(let y=0;y<H;y+=scanDensity){ctx.fillRect(0,y,W,1)}

  // Fluid vials
  drawVials(gameTime);
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
      spawnParticles(gem.x,0,getWorld(ball.x).accent,8);
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

  // HUD
  const world = getWorld(ball.x);
  document.getElementById('scoreVal').textContent=ball.gems;
  document.getElementById('worldName').textContent=world.name;
  document.getElementById('worldName').style.color=world.accent;
  document.querySelectorAll('.panel').forEach(p=>p.style.borderColor=world.accent+'44');
}

// ── Loop ──
let lastT=0;
function loop(ts){
  const dt=Math.min((ts-lastT)/1000,0.05);
  lastT=ts;gameTime+=dt;
  update(dt);
  if(playing){
    if(betweenOn) renderBetween(gameTime);
    else if(anaglyphOn) renderAnaglyph(gameTime);
    else renderLenticular(gameTime);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);