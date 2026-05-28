const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
let W,H;
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight}
resize();window.addEventListener('resize',resize);

// ── Sieve constants ──
const SALEZ=[2,3,5,7,8,9,11];
const SEEDS=[9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];
const G8_DSUM=63;

// ── Music: load manifest, play your tracks ──
let tracks=[];
let currentTrack=0;
let audioCtx=null;
let analyser=null;
let freqData=null;
let musicReady=false;
let musicStarted=false;
const audio=document.getElementById('audio');

fetch('../music/manifest.json').then(r=>r.json()).then(data=>{
  tracks=data.tracks.filter(t=>t.category==='ORIGINAL');
  musicReady=true;
  currentTrack=Math.floor(Math.random()*tracks.length);
}).catch(()=>{
  // Fallback — still playable without music
  musicReady=false;
});

function startMusic(){
  if(!musicReady||musicStarted)return;
  musicStarted=true;

  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  analyser=audioCtx.createAnalyser();
  analyser.fftSize=256;
  freqData=new Uint8Array(analyser.frequencyBinCount);

  const src=audioCtx.createMediaElementSource(audio);
  src.connect(analyser);
  analyser.connect(audioCtx.destination);

  playTrack(currentTrack);
}

function playTrack(idx){
  if(!tracks.length)return;
  currentTrack=idx%tracks.length;
  const t=tracks[currentTrack];
  audio.src='../music/'+t.file;
  audio.play().catch(()=>{});

  document.getElementById('trackName').textContent=t.title;
  document.getElementById('trackStatus').textContent='LOCKED — '+t.biome.toUpperCase().replace('_',' ');

  audio.onended=()=>playTrack(currentTrack+1);
}

function nextTrack(){playTrack(currentTrack+1)}

// ── Game state ──
let state='radio'; // 'radio' → 'transition' → 'playing'
let stateTime=0;
let gameTime=0;

// ── Terrain ──
const TERRAIN_W=800;
const terrain=new Float32Array(TERRAIN_W);
for(let i=0;i<TERRAIN_W;i++){
  terrain[i]=Math.sin(i*0.008+SEEDS[0]*0.01)*120
    +Math.sin(i*0.023+SEEDS[1]*0.01)*50
    +Math.sin(i*0.041+SEEDS[2]*0.01)*25
    +Math.sin(i*0.067+SEEDS[3]*0.01)*12
    +Math.cos(i*0.015+SEEDS[4]*0.01)*60;
}
function terrainAt(x){
  const i=((x%TERRAIN_W)+TERRAIN_W)%TERRAIN_W;
  const i0=Math.floor(i)%TERRAIN_W;
  const i1=(i0+1)%TERRAIN_W;
  const t=i-Math.floor(i);
  return terrain[i0]*(1-t)+terrain[i1]*t;
}
function terrainSlope(x){return terrainAt(x+0.5)-terrainAt(x-0.5)}

// ── Ball ──
const ball={x:100,y:0,vx:0,vy:0,r:12,rot:0,onGround:false,trail:[],gems:0};

// ── Gems ──
const gems=[];
for(let i=0;i<SEEDS.length;i++){
  gems.push({x:(SEEDS[i]*SALEZ[i%7]+i*80)%TERRAIN_W,collected:false,bob:Math.random()*Math.PI*2});
}

// ── Camera + lenticular ──
let camX=0;
let mouseNorm=0.5;
const N_FRAMES=7;
const STRIP_W=3;

// ── Input ──
const keys={};
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyN')nextTrack()});
window.addEventListener('keyup',e=>{keys[e.code]=false});
canvas.addEventListener('mousemove',e=>{mouseNorm=e.clientX/W});
canvas.addEventListener('touchmove',e=>{mouseNorm=e.touches[0].clientX/W;e.preventDefault()},{passive:false});

canvas.addEventListener('click',()=>{
  if(state==='radio'){
    startMusic();
    state='transition';
    stateTime=0;
    document.getElementById('hintText').textContent='A/D ROLL · SPACE JUMP · N NEXT TRACK · MOUSE TILT';
  }
});

// ── Offscreen buffer ──
const offCanvas=document.createElement('canvas');
const offCtx=offCanvas.getContext('2d');

// ── Radio tuning screen ──
function drawRadio(t){
  ctx.fillStyle='#000c1a';
  ctx.fillRect(0,0,W,H);

  // Static noise
  const imgData=ctx.getImageData(0,0,W,H);
  const d=imgData.data;
  const intensity=0.08+Math.sin(t*3)*0.03;
  for(let i=0;i<d.length;i+=4){
    const noise=Math.random()*255*intensity;
    d[i]=noise*0.3;d[i+1]=noise*0.8;d[i+2]=noise*0.6;d[i+3]=255;
  }
  ctx.putImageData(imgData,0,0);

  // Frequency analyzer bars (from music or fake)
  const cx=W/2,barW=4,gap=2,bars=32;
  const startX=cx-(bars*(barW+gap))/2;

  for(let i=0;i<bars;i++){
    let val=Math.sin(t*2+i*0.5)*30+40+Math.random()*20;
    if(analyser&&freqData){
      analyser.getByteFrequencyData(freqData);
      val=freqData[i*2]||val;
    }
    const barH=val*0.6;
    const hue=120+i*2;
    ctx.fillStyle=`hsla(${hue},80%,60%,0.6)`;
    ctx.fillRect(startX+i*(barW+gap),H/2-barH/2,barW,barH);
  }

  // TRENCH FM logo
  ctx.save();
  const glow=0.5+0.5*Math.sin(t*2);
  ctx.shadowColor='#00ff9d';
  ctx.shadowBlur=20+glow*15;
  ctx.font='bold 48px "Bebas Neue",sans-serif';
  ctx.textAlign='center';
  ctx.fillStyle='#00ff9d';
  ctx.fillText('TRENCH FM',cx,H/2-80);
  ctx.shadowBlur=0;
  ctx.font='10px "Share Tech Mono",monospace';
  ctx.fillStyle='rgba(0,255,157,0.4)';
  ctx.letterSpacing='0.3em';
  ctx.fillText('GUINEA PIG TRENCH · ohthatsthe · skippyohms',cx,H/2-55);
  ctx.restore();

  // Scanning line
  const scanY=H/2+60+Math.sin(t)*30;
  ctx.strokeStyle='rgba(0,255,157,0.15)';
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,scanY);ctx.lineTo(W,scanY);ctx.stroke();

  // Freq fill in HUD
  const freq=(Math.sin(t*0.8)*0.5+0.5)*100;
  document.getElementById('freqFill').style.width=freq+'%';
}

// ── Transition: radio static dissolves into hill ──
function drawTransition(t,progress){
  // Render the hill scene
  renderHill(t);

  // Overlay static that fades out
  const alpha=1-progress;
  if(alpha>0.01){
    const imgData=ctx.getImageData(0,0,W,H);
    const d=imgData.data;
    for(let i=0;i<d.length;i+=4){
      if(Math.random()<alpha*0.4){
        const noise=Math.random()*255;
        d[i]=noise*0.3;d[i+1]=noise*0.8;d[i+2]=noise*0.5;
      }
    }
    ctx.putImageData(imgData,0,0);
  }

  // Horizontal glitch bars that fade
  if(alpha>0.1){
    for(let i=0;i<Math.floor(alpha*8);i++){
      const gy=Math.random()*H;
      const gh=2+Math.random()*4;
      ctx.fillStyle=`rgba(0,255,157,${alpha*0.15})`;
      ctx.fillRect(0,gy,W,gh);
    }
  }
}

// ── Render the hill scene into offscreen then interlace ──
function renderHill(t){
  offCanvas.width=W+80;offCanvas.height=H;
  renderScene(offCanvas,offCtx,0,W+80,H,t);

  const tiltOffset=(mouseNorm-0.5)*40;
  for(let x=0;x<W;x++){
    const stripIdx=(Math.floor(x/STRIP_W))%N_FRAMES;
    const stripAngle=((stripIdx/(N_FRAMES-1))*2-1);
    const srcX=x+40+Math.round(stripAngle*16+tiltOffset);
    ctx.drawImage(offCanvas,srcX,0,1,H,x,0,1,H);
  }
}

function renderScene(buf,bCtx,viewAngle,w,h,t){
  const baseY=h*0.55;
  const shift=viewAngle*40;

  // Sky
  const skyGrad=bCtx.createLinearGradient(0,0,0,baseY);
  skyGrad.addColorStop(0,'#05080E');
  skyGrad.addColorStop(0.6,'#0A1628');
  skyGrad.addColorStop(1,'#0C0C12');
  bCtx.fillStyle=skyGrad;
  bCtx.fillRect(0,0,w,h);

  // Stars
  bCtx.fillStyle='rgba(200,220,255,0.4)';
  for(let i=0;i<60;i++){
    const sx=((SEEDS[i%SEEDS.length]*3+i*47+shift*0.2)%w+w)%w;
    const sy=(SEEDS[i%SEEDS.length]*7+i*31)%(baseY*0.8);
    bCtx.fillRect(sx,sy,0.5+(i%3),0.5+(i%3));
  }

  // Far mountains
  bCtx.beginPath();bCtx.moveTo(0,h);
  for(let sx=0;sx<=w;sx+=2){
    const wx=(sx+camX*0.3+shift*0.15);
    bCtx.lineTo(sx,baseY-terrainAt(wx*0.4)*0.3-30);
  }
  bCtx.lineTo(w,h);bCtx.closePath();bCtx.fillStyle='#0A1420';bCtx.fill();

  // Mid hills
  bCtx.beginPath();bCtx.moveTo(0,h);
  for(let sx=0;sx<=w;sx+=2){
    const wx=(sx+camX*0.6+shift*0.4);
    bCtx.lineTo(sx,baseY-terrainAt(wx*0.7)*0.5-15);
  }
  bCtx.lineTo(w,h);bCtx.closePath();bCtx.fillStyle='#101A24';bCtx.fill();

  // Main ground
  bCtx.beginPath();bCtx.moveTo(0,h);
  for(let sx=0;sx<=w;sx++){
    const wx=sx+camX+shift;
    bCtx.lineTo(sx,baseY-terrainAt(wx));
  }
  bCtx.lineTo(w,h);bCtx.closePath();
  const gGrad=bCtx.createLinearGradient(0,baseY-140,0,h);
  gGrad.addColorStop(0,'#1A3020');gGrad.addColorStop(0.4,'#142818');gGrad.addColorStop(1,'#0A1A10');
  bCtx.fillStyle=gGrad;bCtx.fill();

  // Ground line
  bCtx.beginPath();
  for(let sx=0;sx<=w;sx++){
    const wx=sx+camX+shift;
    if(sx===0)bCtx.moveTo(sx,baseY-terrainAt(wx));
    else bCtx.lineTo(sx,baseY-terrainAt(wx));
  }
  bCtx.strokeStyle='rgba(0,255,210,0.12)';bCtx.lineWidth=1;bCtx.stroke();

  // Grass tufts
  for(let sx=0;sx<w;sx+=8){
    const wx=sx+camX+shift;
    const gy=baseY-terrainAt(wx);
    const sway=Math.sin(t*2+wx*0.05)*3;
    bCtx.strokeStyle='rgba(0,255,210,0.07)';bCtx.lineWidth=1;
    bCtx.beginPath();bCtx.moveTo(sx,gy);bCtx.lineTo(sx+sway,gy-5-(wx%7));bCtx.stroke();
  }

  // Audio-reactive ground pulse (if analyser available)
  if(analyser&&freqData){
    analyser.getByteFrequencyData(freqData);
    const bass=(freqData[1]+freqData[2]+freqData[3])/3/255;
    if(bass>0.3){
      bCtx.strokeStyle=`rgba(0,255,210,${bass*0.15})`;
      bCtx.lineWidth=2;
      bCtx.beginPath();
      for(let sx=0;sx<=w;sx+=3){
        const wx=sx+camX+shift;
        const gy=baseY-terrainAt(wx)-bass*8;
        if(sx===0)bCtx.moveTo(sx,gy);else bCtx.lineTo(sx,gy);
      }
      bCtx.stroke();
    }
  }

  // Gems
  for(const gem of gems){
    if(gem.collected)continue;
    const gsx=gem.x-camX-shift;
    if(gsx<-20||gsx>w+20)continue;
    const gy=baseY-terrainAt(gem.x)-16+Math.sin(t*3+gem.bob)*4;
    const grd=bCtx.createRadialGradient(gsx,gy,0,gsx,gy,18);
    grd.addColorStop(0,'rgba(212,168,68,0.4)');grd.addColorStop(1,'rgba(212,168,68,0)');
    bCtx.fillStyle=grd;bCtx.beginPath();bCtx.arc(gsx,gy,18,0,Math.PI*2);bCtx.fill();
    bCtx.fillStyle='#D4A844';
    bCtx.beginPath();bCtx.moveTo(gsx,gy-8);bCtx.lineTo(gsx+6,gy);bCtx.lineTo(gsx,gy+8);bCtx.lineTo(gsx-6,gy);bCtx.closePath();bCtx.fill();
    bCtx.fillStyle='#FFF';bCtx.fillRect(gsx-1,gy-2,2,2);
  }

  // Ball trail
  for(let i=0;i<ball.trail.length;i++){
    const tr=ball.trail[i];
    const tsx=tr.x-camX-shift;
    const tsy=baseY-terrainAt(tr.x)-ball.r;
    const a=(i/ball.trail.length)*0.25;
    const sz=ball.r*(i/ball.trail.length)*0.5;
    bCtx.fillStyle=`rgba(0,255,210,${a})`;
    bCtx.beginPath();bCtx.arc(tsx,tsy,sz,0,Math.PI*2);bCtx.fill();
  }

  // Ball
  const bsx=ball.x-camX-shift;
  const bsy=baseY-terrainAt(ball.x)-ball.r+ball.y;
  // Shadow
  bCtx.fillStyle='rgba(0,0,0,0.3)';
  bCtx.beginPath();bCtx.ellipse(bsx,baseY-terrainAt(ball.x),ball.r*0.8,4,0,0,Math.PI*2);bCtx.fill();
  // Body
  const bg=bCtx.createRadialGradient(bsx-3,bsy-3,2,bsx,bsy,ball.r);
  bg.addColorStop(0,'#40FFE0');bg.addColorStop(0.6,'#00D2AA');bg.addColorStop(1,'#006650');
  bCtx.fillStyle=bg;bCtx.beginPath();bCtx.arc(bsx,bsy,ball.r,0,Math.PI*2);bCtx.fill();
  // Spin line
  bCtx.strokeStyle='rgba(0,0,0,0.3)';bCtx.lineWidth=1.5;
  bCtx.beginPath();
  bCtx.moveTo(bsx+Math.cos(ball.rot)*ball.r*0.7,bsy+Math.sin(ball.rot)*ball.r*0.7);
  bCtx.lineTo(bsx-Math.cos(ball.rot)*ball.r*0.7,bsy-Math.sin(ball.rot)*ball.r*0.7);
  bCtx.stroke();
  // Highlight
  bCtx.fillStyle='rgba(255,255,255,0.35)';
  bCtx.beginPath();bCtx.arc(bsx-3,bsy-4,3,0,Math.PI*2);bCtx.fill();
}

// ── Physics ──
function update(dt){
  if(state!=='playing')return;

  if(keys['ArrowRight']||keys['KeyD'])ball.vx+=300*dt;
  if(keys['ArrowLeft']||keys['KeyA'])ball.vx-=300*dt;
  if((keys['ArrowUp']||keys['KeyW']||keys['Space'])&&ball.onGround){ball.vy=-350;ball.onGround=false}

  ball.vy+=600*dt;
  if(ball.onGround){ball.vx+=terrainSlope(ball.x)*8*dt;ball.vx*=0.997}
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
    if(!gem.collected&&Math.abs(ball.x-gem.x)<20){gem.collected=true;ball.gems++}
  }

  // HUD updates
  document.getElementById('scoreVal').textContent=ball.gems;
  document.getElementById('spdVal').textContent=Math.round(Math.abs(ball.vx));
  document.getElementById('tiltVal').textContent=Math.round(mouseNorm*100)+'%';

  // Freq bar pulses with music
  if(analyser&&freqData){
    analyser.getByteFrequencyData(freqData);
    const avg=(freqData[0]+freqData[1]+freqData[2]+freqData[3])/4/255*100;
    document.getElementById('freqFill').style.width=avg+'%';
  }
}

// ── Main loop ──
let lastT=0;
function loop(ts){
  const dt=Math.min((ts-lastT)/1000,0.05);
  lastT=ts;
  gameTime+=dt;
  stateTime+=dt;

  if(state==='radio'){
    drawRadio(gameTime);
  } else if(state==='transition'){
    const progress=Math.min(1,stateTime/3); // 3 second transition
    update(dt);
    drawTransition(gameTime,progress);
    if(progress>=1){state='playing';
      document.getElementById('hintText').textContent='A/D ROLL · SPACE JUMP · N NEXT TRACK';
      setTimeout(()=>{document.getElementById('p-hint').style.opacity='0'},4000);
    }
  } else {
    update(dt);
    renderHill(gameTime);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE BETWEEN';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7034139877029708;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01569808169480893;mix-blend-mode:overlay';
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

// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});