
// ════════════════════════════════════════════════════════════
// FRACTAL FORGE — Mandelbulb Studio × Asset Forge
//
// Sprites define fractal DNA (power, palette, orbit trap).
// Mandelbulb renders each sprite into a unique 3D fractal asset.
// Crossbreeding mixes fractal parameters genetically.
// The game world uses fractal-rendered creatures.
// ════════════════════════════════════════════════════════════

const glCanvas = document.getElementById('gl');
const gl = glCanvas.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'high-performance'});
const uiCanvas = document.getElementById('ui-canvas');
const uiCtx = uiCanvas.getContext('2d');

let W, H;
function resize() {
  W = glCanvas.width = uiCanvas.width = innerWidth;
  H = glCanvas.height = uiCanvas.height = innerHeight;
  gl.viewport(0, 0, W, H);
}
resize();
addEventListener('resize', resize);

// Sieve constants from Erdos
const SEEDS = [9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];

// ── Logging ──
const logLines = [];
function log(msg) {
  logLines.unshift(msg);
  if (logLines.length > 14) logLines.pop();
  document.getElementById('log').innerHTML = logLines.map((l,i) =>
    `<div style="opacity:${1-i*.06}">${l}</div>`).join('');
}

// ════════════════════════════════════════════════════════════
// WEBGL MANDELBULB SHADER — from Onion Planet Studio
// ════════════════════════════════════════════════════════════

const VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTheta,uPhi,uDist,uPower,uTime;
uniform vec3 uColA,uColB,uColC,uColD;
in vec2 uv;out vec4 O;

const int FIT=10,RST=64;
const float EPS=.0005,BS=1.35;

vec4 bulb(vec3 p){
  vec3 z=p;float dr=1.,r=0.,tr1=1e9,tr2=1e9;int n=0;
  for(int i=0;i<FIT;i++){
    r=length(z);if(r>2.)break;n=i;
    tr1=min(tr1,length(z.xy));tr2=min(tr2,abs(z.z));
    float th=acos(clamp(z.y/r,-1.,1.)),ph=atan(z.x,z.z);
    dr=pow(r,uPower-1.)*uPower*dr+1.;
    float zr=pow(r,uPower);th*=uPower;ph*=uPower;
    z=zr*vec3(sin(th)*sin(ph),cos(th),sin(th)*cos(ph))+p;
  }
  return vec4(.5*log(max(r,1e-6))*r/dr,tr1,tr2,float(n)/float(FIT));
}
vec3 nrm(vec3 p){
  const float h=.001;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*bulb(p+k.xyy*h).x+k.yyx*bulb(p+k.yyx*h).x+
    k.yxy*bulb(p+k.yxy*h).x+k.xxx*bulb(p+k.xxx*h).x);
}
float ao(vec3 p,vec3 n){
  float o=0.,s=1.;
  for(int i=0;i<4;i++){float h=.01+.15*float(i)/3.;o+=(h-bulb(p+h*n).x)*s;s*=.7;}
  return clamp(1.-3.*o,0.,1.);
}
vec3 pal(float t1,float t2,float ti){
  vec3 col=mix(uColA,uColB,clamp(t1*3.,0.,1.));
  col=mix(col,uColC,clamp(t2*5.,0.,1.)*.42);
  return mix(col,uColD,ti*.22);
}
void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  float cy=cos(uPhi),sy=sin(uPhi);
  vec3 ro=uDist*vec3(sin(uTheta)*cy,sy,cos(uTheta)*cy);
  vec3 ww=normalize(-ro);
  vec3 uu=normalize(cross(ww,abs(ww.y)<.99?vec3(0,1,0):vec3(0,0,1)));
  vec3 vv=cross(uu,ww);
  vec3 rd=normalize(fc.x*uu+fc.y*vv+1.75*ww);

  vec3 col=vec3(0.,.005,.016);

  float b2=dot(ro,rd),disc=b2*b2-dot(ro,ro)+BS*BS;
  if(disc>=0.){
    float t=max(-b2-sqrt(disc),0.),tmax=-b2+sqrt(disc);
    bool hit=false;vec4 trap=vec4(0);
    for(int i=0;i<RST;i++){
      vec4 res=bulb(ro+rd*t);trap=res;
      if(res.x<EPS){hit=true;break;}
      if(t>=tmax)break;
      t+=res.x*.6;
    }
    if(hit){
      vec3 p=ro+rd*t;vec3 n=nrm(p);float occ=ao(p,n);
      vec3 L1=normalize(vec3(.7,.6,.4));
      float d1=max(dot(n,L1),0.),d2=max(dot(n,normalize(vec3(-.5,.3,-.9))),0.)*.35;
      vec3 H1=normalize(L1-rd);
      float sp=pow(max(dot(n,H1),0.),64.);
      float fr=pow(1.-max(dot(-rd,n),0.),4.);
      vec3 bc=pal(trap.y,trap.z,trap.w);
      col=bc*(d1*1.6+d2+.08)*occ;
      col+=vec3(1.,.93,.79)*sp*1.2*occ;
      col+=bc*fr*.35*occ;
      col=mix(col,vec3(0.,.005,.016)*.15,1.-exp(-max(t-1.8,0.)*.3));
    }
  }
  col*=.48+.52*pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.12);
  // ACES tonemap
  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
  col=pow(col,vec3(1./2.2));
  O=vec4(col,1.);
}`;

// Compile shaders
function createShader(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function createProgram(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, createShader(vs, gl.VERTEX_SHADER));
  gl.attachShader(p, createShader(fs, gl.FRAGMENT_SHADER));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

const prog = createProgram(VS, FS);
const aLoc = gl.getAttribLocation(prog, 'a');
const uRes = gl.getUniformLocation(prog, 'uRes');
const uTheta = gl.getUniformLocation(prog, 'uTheta');
const uPhi = gl.getUniformLocation(prog, 'uPhi');
const uDist = gl.getUniformLocation(prog, 'uDist');
const uPower = gl.getUniformLocation(prog, 'uPower');
const uTime = gl.getUniformLocation(prog, 'uTime');
const uColA = gl.getUniformLocation(prog, 'uColA');
const uColB = gl.getUniformLocation(prog, 'uColB');
const uColC = gl.getUniformLocation(prog, 'uColC');
const uColD = gl.getUniformLocation(prog, 'uColD');

// Fullscreen quad
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);

function renderFractal(theta, phi, dist, power, colA, colB, colC, colD) {
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(uRes, W, H);
  gl.uniform1f(uTheta, theta);
  gl.uniform1f(uPhi, phi);
  gl.uniform1f(uDist, dist);
  gl.uniform1f(uPower, power);
  gl.uniform3fv(uColA, colA);
  gl.uniform3fv(uColB, colB);
  gl.uniform3fv(uColC, colC);
  gl.uniform3fv(uColD, colD);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Capture the current GL frame to an offscreen canvas
function captureFrame(size) {
  const pixels = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const cap = document.createElement('canvas');
  cap.width = size; cap.height = size;
  const cx = cap.getContext('2d');
  // Sample from center of the GL output
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = W; srcCanvas.height = H;
  const srcCtx = srcCanvas.getContext('2d');
  const imgData = srcCtx.createImageData(W, H);
  // Flip Y
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = ((H - 1 - y) * W + x) * 4;
      const di = (y * W + x) * 4;
      imgData.data[di] = pixels[si];
      imgData.data[di+1] = pixels[si+1];
      imgData.data[di+2] = pixels[si+2];
      imgData.data[di+3] = 255;
    }
  }
  srcCtx.putImageData(imgData, 0, 0);
  // Crop center square
  const sq = Math.min(W, H);
  const ox = (W - sq) / 2, oy = (H - sq) / 2;
  cx.drawImage(srcCanvas, ox, oy, sq, sq, 0, 0, size, size);
  return cap;
}

// ════════════════════════════════════════════════════════════
// SPRITE TYPES — each defines fractal DNA
// ════════════════════════════════════════════════════════════

const SPRITE_TYPES = [
  { name:'MECHA CORE',   role:'player',  power:8.0, dist:2.8, phi:0.25,
    colA:[0,.04,.92], colB:[0,.62,.51], colC:[.08,1,.82], colD:[.02,.36,.29],
    biome:'Cyberpunk' },
  { name:'RED MAGE',     role:'enemy',   power:7.0, dist:3.0, phi:0.3,
    colA:[.80,.13,.20], colB:[.53,.07,.13], colC:[1,.27,.40], colD:[.24,.04,.08],
    biome:'Volcanic' },
  { name:'GOLD GEODE',   role:'item',    power:9.0, dist:2.6, phi:0.2,
    colA:[.83,.66,.27], colB:[.63,.47,.19], colC:[1,.82,.31], colD:[.42,.33,.13],
    biome:'Desert' },
  { name:'FISH SCOUT',   role:'enemy',   power:6.0, dist:3.2, phi:0.15,
    colA:[.04,.39,.71], colB:[0,.24,.47], colC:[0,.63,.86], colD:[.02,.16,.35],
    biome:'Underwater' },
  { name:'CRYSTAL CORE', role:'item',    power:10.0, dist:2.5, phi:0.28,
    colA:[.71,.39,1], colB:[.47,.20,.78], colC:[.86,.63,1], colD:[.31,.12,.55],
    biome:'Vampire' },
  { name:'STONE GOLEM',  role:'enemy',   power:5.0, dist:3.4, phi:0.35,
    colA:[.39,.37,.33], colB:[.25,.24,.22], colC:[.55,.53,.47], colD:[.18,.16,.14],
    biome:'Cavern' },
  { name:'TEAL MANDALA', role:'vfx',     power:12.0, dist:2.2, phi:0.1,
    colA:[0,1,.82], colB:[0,.78,1], colC:[.39,1,.90], colD:[.02,.55,.45],
    biome:'Radiant' },
  { name:'DOOR GATE',    role:'prop',    power:4.0, dist:3.8, phi:0.4,
    colA:[.31,.31,.35], colB:[.20,.20,.23], colC:[.47,.47,.51], colD:[.12,.12,.14],
    biome:'Fortress' },
];

// ════════════════════════════════════════════════════════════
// FORGE PIPELINE — render each sprite as a Mandelbulb
// ════════════════════════════════════════════════════════════

let phase = 'scan';
let phaseTime = 0;
let forgeQueue = [];
let forgedAssets = [];
let crossbreeds = [];
let currentForge = 0;
let currentAngle = 0;
const ANGLES = 8;
const CAPTURE_SIZE = 64;

function startForge() {
  forgeQueue = [...SPRITE_TYPES];
  forgedAssets = [];
  currentForge = 0;
  currentAngle = 0;
}

function forgeStep() {
  if (currentForge >= forgeQueue.length) return true;

  const sprite = forgeQueue[currentForge];
  const theta = (currentAngle / ANGLES) * Math.PI * 2;

  // Render the Mandelbulb with this sprite's DNA
  renderFractal(
    theta, sprite.phi, sprite.dist, sprite.power,
    sprite.colA, sprite.colB, sprite.colC, sprite.colD
  );

  // Capture the frame
  const frame = captureFrame(CAPTURE_SIZE);

  if (!forgedAssets[currentForge]) {
    forgedAssets[currentForge] = {
      sprite: sprite,
      frames: [],
      name: sprite.name,
      role: sprite.role,
    };
  }
  forgedAssets[currentForge].frames.push(frame);

  currentAngle++;
  if (currentAngle >= ANGLES) {
    log(`FORGED: ${sprite.name} (power=${sprite.power}, ${ANGLES} angles) [${sprite.biome}]`);
    addCardToGallery(forgedAssets[currentForge]);
    currentAngle = 0;
    currentForge++;
  }

  document.getElementById('fractal-info').textContent =
    `POWER: ${sprite.power.toFixed(1)} BIOME: ${sprite.biome}`;

  return false;
}

// ════════════════════════════════════════════════════════════
// CROSSBREEDING — mix fractal DNA
// ════════════════════════════════════════════════════════════

function crossbreed() {
  crossbreeds = [];
  for (let i = 0; i < SPRITE_TYPES.length; i++) {
    for (let j = i + 1; j < SPRITE_TYPES.length; j++) {
      if (crossbreeds.length >= 8) break;
      const a = SPRITE_TYPES[i], b = SPRITE_TYPES[j];
      if (a.role === b.role) continue; // diversity requirement

      const seed = SEEDS[(i * 3 + j) % SEEDS.length];
      const mix = (seed % 100) / 100;

      const child = {
        name: `${a.name.split(' ')[0]}-${b.name.split(' ')[0]}`,
        role: a.role === 'enemy' && b.role === 'item' ? 'mimic' :
              a.role === 'player' && b.role === 'enemy' ? 'miniboss' :
              a.role === 'vfx' ? 'hazard' : [a.role, b.role][seed % 2],
        power: a.power * mix + b.power * (1 - mix),
        dist: a.dist * mix + b.dist * (1 - mix),
        phi: a.phi * mix + b.phi * (1 - mix),
        colA: a.colA.map((v, k) => v * mix + b.colA[k] * (1 - mix)),
        colB: a.colB.map((v, k) => v * mix + b.colB[k] * (1 - mix)),
        colC: a.colC.map((v, k) => v * mix + b.colC[k] * (1 - mix)),
        colD: a.colD.map((v, k) => v * mix + b.colD[k] * (1 - mix)),
        biome: `${a.biome}+${b.biome}`,
        parentA: a.name,
        parentB: b.name,
      };

      // Mutation: slight random tweak (happy little mistake)
      child.power += (Math.random() - 0.5) * 0.8;
      child.power = Math.max(3, Math.min(14, child.power));

      crossbreeds.push(child);
      log(`BRED: ${child.name} (${child.role}) power=${child.power.toFixed(1)} via ${a.name} x ${b.name}`);
    }
    if (crossbreeds.length >= 8) break;
  }
  return crossbreeds;
}

// ════════════════════════════════════════════════════════════
// GALLERY — show forged assets as cards
// ════════════════════════════════════════════════════════════

function addCardToGallery(asset) {
  const gallery = document.getElementById('gallery');
  const card = document.createElement('div');
  card.className = 'card';

  const preview = document.createElement('canvas');
  preview.width = 60; preview.height = 60;
  const px = preview.getContext('2d');
  if (asset.frames[0]) {
    px.drawImage(asset.frames[0], 0, 0, 60, 60);
  }
  card.appendChild(preview);

  // Animate on hover
  let animFrame = 0;
  setInterval(() => {
    animFrame = (animFrame + 1) % asset.frames.length;
    if (asset.frames[animFrame]) {
      px.clearRect(0, 0, 60, 60);
      px.drawImage(asset.frames[animFrame], 0, 0, 60, 60);
    }
  }, 200);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = asset.name;
  card.appendChild(name);

  const role = document.createElement('div');
  role.className = 'role';
  role.style.color = asset.role === 'player' ? '#00ff9d' :
                     asset.role === 'enemy' ? '#ff2244' :
                     asset.role === 'item' ? '#D4A844' :
                     asset.role === 'miniboss' ? '#ff4466' :
                     asset.role === 'mimic' ? '#ff8800' :
                     asset.role === 'hazard' ? '#ff6600' : '#888';
  role.textContent = asset.role;
  card.appendChild(role);

  gallery.appendChild(card);
}

// ════════════════════════════════════════════════════════════
// MAIN LOOP
// ════════════════════════════════════════════════════════════

let lastT = 0;
let totalForged = 0;

function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  phaseTime += dt;

  const statusEl = document.getElementById('status');
  const phaseEl = document.getElementById('phase');
  const counterEl = document.getElementById('counter');
  const labelEl = document.getElementById('phase-label');

  switch (phase) {
    case 'scan':
      // Show intro fractal rotating
      renderFractal(
        phaseTime * 0.3, 0.25, 3.0, 8.0,
        [0,.04,.92], [.93,.07,.38], [.96,.73,.07], [.07,.91,.54]
      );
      if (phaseTime > 3) {
        phase = 'forge';
        phaseTime = 0;
        startForge();
        labelEl.textContent = 'FORGING FRACTAL ASSETS';
        log('PHASE 1: Rendering sprites as Mandelbulb fractals...');
        log(`${SPRITE_TYPES.length} sprite types queued for fractal forging`);
      }
      statusEl.textContent = 'SCANNING FRACTAL DNA';
      phaseEl.textContent = 'SCAN';
      counterEl.textContent = `${SPRITE_TYPES.length} TYPES`;
      labelEl.style.opacity = phaseTime < 2.5 ? '1' : '0';
      break;

    case 'forge':
      if (forgeStep()) {
        if (crossbreeds.length === 0) {
          // First pass done — crossbreed
          phase = 'crossbreed';
          phaseTime = 0;
          labelEl.textContent = 'CROSSBREEDING DNA';
          labelEl.style.opacity = '1';
          log(`FORGED: ${forgedAssets.length} base fractal assets x ${ANGLES} angles`);
          log('PHASE 2: Crossbreeding fractal DNA...');
          const children = crossbreed();
          // Add children to forge queue
          forgeQueue.push(...children);
        } else {
          // Second pass done — all forged
          phase = 'complete';
          phaseTime = 0;
          labelEl.textContent = 'FORGE COMPLETE';
          labelEl.style.opacity = '1';
          log(`COMPLETE: ${forgedAssets.length} total fractal assets forged`);
          log(`${crossbreeds.length} hybrid species created through crossbreeding`);
          log('All assets rendered through Mandelbulb raymarching pipeline');
        }
      } else {
        // Show the current fractal being forged (it's already rendered to GL)
      }
      statusEl.textContent = `FORGING: ${forgeQueue[Math.min(currentForge, forgeQueue.length-1)]?.name || 'DONE'}`;
      phaseEl.textContent = 'FORGE';
      const total = forgeQueue.length * ANGLES;
      const done = currentForge * ANGLES + currentAngle;
      counterEl.textContent = `${done} / ${total}`;
      if (phaseTime > 0.5) labelEl.style.opacity = '0';
      break;

    case 'crossbreed':
      // Brief pause showing the crossbreed results
      renderFractal(
        phaseTime * 0.5, 0.2, 2.8,
        crossbreeds[0]?.power || 8,
        crossbreeds[0]?.colA || [0,1,.5],
        crossbreeds[0]?.colB || [1,0,.5],
        crossbreeds[0]?.colC || [.5,.5,1],
        crossbreeds[0]?.colD || [.5,1,.5]
      );
      if (phaseTime > 2) {
        phase = 'forge';
        phaseTime = 0;
        labelEl.textContent = 'FORGING HYBRIDS';
        labelEl.style.opacity = '1';
        log('RE-ENTERING FORGE: rendering crossbreed offspring as fractals...');
      }
      statusEl.textContent = `${crossbreeds.length} HYBRIDS QUEUED`;
      phaseEl.textContent = 'CROSSBREED';
      counterEl.textContent = `${crossbreeds.length} CHILDREN`;
      labelEl.style.opacity = phaseTime < 1.5 ? '1' : '0';
      break;

    case 'complete':
      // Show rotating showcase of all forged assets
      const showcaseIdx = Math.floor(phaseTime * 0.5) % forgeQueue.length;
      const showcase = forgeQueue[showcaseIdx];
      renderFractal(
        phaseTime * 0.2, showcase.phi,
        showcase.dist, showcase.power,
        showcase.colA, showcase.colB, showcase.colC, showcase.colD
      );
      statusEl.textContent = `SHOWCASE: ${showcase.name}`;
      phaseEl.textContent = 'GALLERY';
      counterEl.textContent = `${forgedAssets.length} ASSETS`;
      document.getElementById('fractal-info').textContent =
        `POWER: ${showcase.power.toFixed(1)} BIOME: ${showcase.biome}`;
      labelEl.style.opacity = phaseTime < 2 ? '1' : '0';
      break;
  }

  requestAnimationFrame(loop);
}

log('FRACTAL FORGE initialized');
log('Mandelbulb raymarching x Asset crossbreeding');
log('Each sprite type defines unique fractal DNA');
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
  wn.textContent = 'THE THRESHOLD';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6861635026166976;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.012556441190589927;mix-blend-mode:overlay';
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



// CHAIN FIX: AUDIO
var _ac;function _tone(f,d,t,v){if(!_ac)_ac=new(AudioContext||webkitAudioContext)();var o=_ac.createOscillator(),g=_ac.createGain();o.type=t||"sine";o.frequency.value=f;o.detune.value=(Math.random()-.5)*8;g.gain.setValueAtTime(v||.08,_ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,_ac.currentTime+(d||.2));o.connect(g);g.connect(_ac.destination);o.start();o.stop(_ac.currentTime+(d||.2))}
function sndClick(){_tone(800,.06,"sine",.06)}
function sndSuccess(){_tone(523,.1);setTimeout(function(){_tone(659,.1)},70);setTimeout(function(){_tone(784,.15,"triangle",.08)},140)}
function sndFail(){_tone(200,.15,"sawtooth",.05)}
document.addEventListener("click",function(){if(!_ac)_ac=new(AudioContext||webkitAudioContext)()},{once:true});



// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
