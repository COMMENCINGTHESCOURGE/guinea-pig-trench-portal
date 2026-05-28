
// ── WebGL2 Setup ──
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', {antialias:false, powerPreference:'high-performance'});
if(!gl){document.getElementById('info').textContent='WebGL2 not supported';throw new Error('no webgl2')}

let W,H;
function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight}
resize();window.addEventListener('resize',resize);

// ── Sieve constants for procedural detail ──
const SEEDS = [9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];

// ── Built-in sprite textures (procedural — no external files needed) ──
// Generate a mecha entity silhouette as pixel data
function generateMechaSprite(size){
  const d = new Uint8Array(size*size*4);
  const cx=size/2, cy=size/2;
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const i=(y*size+x)*4;
      const dx=x-cx, dy=y-cy;
      const dist=Math.sqrt(dx*dx+dy*dy);

      // Body shape: T-emblem mecha silhouette
      let v=0;
      // Head (helmet)
      if(dy<-size*0.3 && dist<size*0.15) v=200;
      // Horns
      if(dy<-size*0.35 && Math.abs(dx)>size*0.08 && Math.abs(dx)<size*0.2 && dy>-size*0.48) v=180;
      // Torso
      if(dy>=-size*0.3 && dy<size*0.1 && Math.abs(dx)<size*0.2) v=220;
      // T emblem
      if(dy>-size*0.15 && dy<-size*0.05 && Math.abs(dx)<size*0.15) v=255; // horizontal bar
      if(dy>=-size*0.05 && dy<size*0.1 && Math.abs(dx)<size*0.04) v=255; // vertical bar
      // Cape/wings
      if(dy>-size*0.2 && dy<size*0.35 && Math.abs(dx)>=size*0.18 && Math.abs(dx)<size*0.35) {
        const wing = 1 - (dy+size*0.2)/(size*0.55);
        if(Math.abs(dx)<size*(0.18+wing*0.17)) v=160;
      }
      // Legs
      if(dy>=size*0.1 && dy<size*0.4){
        if(Math.abs(dx)<size*0.06 || (Math.abs(dx)>size*0.08 && Math.abs(dx)<size*0.14)) v=190;
      }

      // Teal coloring
      d[i]  =v>0?0:0;                    // R
      d[i+1]=v>0?Math.min(255,v+30):0;   // G (teal)
      d[i+2]=v>0?Math.min(255,v-10):0;   // B (teal)
      d[i+3]=v;                           // A = height
    }
  }
  return d;
}

const SPRITE_SIZE = 64;
const spriteData = generateMechaSprite(SPRITE_SIZE);

// Upload sprite as texture
const spriteTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, spriteTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SPRITE_SIZE, SPRITE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, spriteData);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// ── Shaders ──
const VS = `#version 300 es
in vec2 a;
out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTheta, uPhi, uDist, uTime;
uniform int uMode; // 0=height, 1=revolution, 2=cross, 3=mandelbulb
uniform sampler2D uSprite;
in vec2 uv;
out vec4 O;

const int MAX_STEPS = 80;
const float MAX_DIST = 8.0;
const float EPS = 0.001;

// ── Sample sprite as height ──
float spriteHeight(vec2 p) {
  vec2 st = p * 0.5 + 0.5; // -1..1 → 0..1
  if(st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) return 0.0;
  vec4 c = texture(uSprite, st);
  return c.a * 0.8; // alpha channel = height
}

// ── SDF: Height map extrusion ──
float sdfHeightMap(vec3 p) {
  float h = spriteHeight(p.xz);
  return p.y - h * 0.5 + 0.25;
}

// ── SDF: Solid of revolution ──
float sdfRevolution(vec3 p) {
  float r = length(p.xz); // distance from Y axis
  float h = spriteHeight(vec2(r, p.y + 0.5));
  return r - h * 0.5;
}

// ── SDF: Cross section stack ──
float sdfCrossSection(vec3 p) {
  float h1 = spriteHeight(p.xy);
  float h2 = spriteHeight(p.xz);
  return max(abs(p.z) - h1 * 0.3, abs(p.y) - h2 * 0.3);
}

// ── SDF: Mandelbulb (original, for comparison) ──
float sdfMandelbulb(vec3 p) {
  vec3 z = p;
  float dr = 1.0, r = 0.0;
  const float PWR = 8.0;
  for(int i = 0; i < 8; i++) {
    r = length(z);
    if(r > 2.0) break;
    float th = acos(clamp(z.y/r, -1.0, 1.0));
    float ph = atan(z.x, z.z);
    dr = pow(r, PWR-1.0) * PWR * dr + 1.0;
    float zr = pow(r, PWR);
    th *= PWR; ph *= PWR;
    z = zr * vec3(sin(th)*sin(ph), cos(th), sin(th)*cos(ph)) + p;
  }
  return 0.5 * log(max(r, 1e-6)) * r / dr;
}

// ── Combined SDF ──
float sdf(vec3 p) {
  if(uMode == 0) return sdfHeightMap(p);
  if(uMode == 1) return sdfRevolution(p);
  if(uMode == 2) return sdfCrossSection(p);
  return sdfMandelbulb(p);
}

// ── Normal via gradient ──
vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * sdf(p + k.xyy*h) +
    k.yyx * sdf(p + k.yyx*h) +
    k.yxy * sdf(p + k.yxy*h) +
    k.xxx * sdf(p + k.xxx*h)
  );
}

// ── Ambient occlusion ──
float calcAO(vec3 p, vec3 n) {
  float ao = 0.0;
  float scale = 1.0;
  for(int i = 0; i < 5; i++) {
    float d = 0.02 + 0.08 * float(i);
    ao += (d - sdf(p + n*d)) * scale;
    scale *= 0.6;
  }
  return clamp(1.0 - 2.0*ao, 0.0, 1.0);
}

void main() {
  vec2 p = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;

  // Camera
  float ct = cos(uTheta), st2 = sin(uTheta);
  float cp = cos(uPhi), sp = sin(uPhi);
  vec3 eye = uDist * vec3(st2*cp, sp, ct*cp);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 fwd = normalize(ta - eye);
  vec3 right = normalize(cross(fwd, vec3(0,1,0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(p.x*right + p.y*up + 1.5*fwd);

  // Raymarch
  float t = 0.0;
  vec3 col = vec3(0.04, 0.04, 0.06); // void background

  for(int i = 0; i < MAX_STEPS; i++) {
    vec3 pos = eye + rd * t;
    float d = sdf(pos);
    if(d < EPS) {
      // Hit — compute shading
      vec3 n = calcNormal(pos);
      float ao = calcAO(pos, n);

      // Lighting
      vec3 ld = normalize(vec3(0.6, 0.8, -0.4));
      float diff = max(dot(n, ld), 0.0);
      float spec = pow(max(dot(reflect(-ld, n), -rd), 0.0), 32.0);

      // Sprite-driven color from texture sample
      vec2 texCoord = pos.xz * 0.5 + 0.5;
      if(uMode == 1) texCoord = vec2(length(pos.xz), pos.y + 0.5);
      vec4 sprCol = texture(uSprite, clamp(texCoord, 0.0, 1.0));

      // Base color: teal from sprite, with lighting
      vec3 baseCol = sprCol.rgb * 0.6 + vec3(0.0, 0.8, 0.65) * 0.4;
      if(uMode == 3) baseCol = vec3(0.0, 0.8, 0.65); // mandelbulb = pure teal

      col = baseCol * (0.15 + diff * 0.7) * ao + vec3(0.0, 1.0, 0.82) * spec * 0.3;

      // Distance fog
      float fog = exp(-t * 0.3);
      col = mix(vec3(0.04, 0.04, 0.06), col, fog);
      break;
    }
    t += d;
    if(t > MAX_DIST) break;
  }

  // Gamma
  col = pow(col, vec3(0.45));

  // CRT scanline
  col *= 0.92 + 0.08 * sin(gl_FragCoord.y * 3.14);

  O = vec4(col, 1.0);
}`;

// ── Compile shaders ──
function compileShader(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

const vs = compileShader(VS, gl.VERTEX_SHADER);
const fs = compileShader(FS, gl.FRAGMENT_SHADER);
const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
gl.useProgram(prog);

// Fullscreen quad
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
const aLoc = gl.getAttribLocation(prog, 'a');
gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

// Uniforms
const uRes = gl.getUniformLocation(prog, 'uRes');
const uTheta = gl.getUniformLocation(prog, 'uTheta');
const uPhi = gl.getUniformLocation(prog, 'uPhi');
const uDist = gl.getUniformLocation(prog, 'uDist');
const uTime = gl.getUniformLocation(prog, 'uTime');
const uMode = gl.getUniformLocation(prog, 'uMode');
const uSprite = gl.getUniformLocation(prog, 'uSprite');

// Bind sprite texture
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, spriteTex);
gl.uniform1i(uSprite, 0);

// ── Camera state ──
let theta = 0.5, phi = 0.3, dist = 2.5;
let mode = 0;
let dragging = false, lastX = 0, lastY = 0;
let autoRotate = true;

// ── Input ──
canvas.addEventListener('mousedown', e => {dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.classList.add('drag');autoRotate=false});
window.addEventListener('mouseup', () => {dragging=false;canvas.classList.remove('drag')});
window.addEventListener('mousemove', e => {
  if(!dragging) return;
  theta += (e.clientX-lastX)*0.008;
  phi = Math.max(-1.2, Math.min(1.2, phi+(e.clientY-lastY)*0.008));
  lastX=e.clientX;lastY=e.clientY;
});
canvas.addEventListener('wheel', e => {dist=Math.max(0.5,Math.min(8,dist+e.deltaY*0.003));e.preventDefault()},{passive:false});
canvas.addEventListener('dblclick', () => {theta=0.5;phi=0.3;dist=2.5;autoRotate=true});

// Mode switching
document.querySelectorAll('#mode span').forEach(el => {
  el.addEventListener('click', () => {
    mode = parseInt(el.dataset.mode);
    document.querySelectorAll('#mode span').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  });
});
window.addEventListener('keydown', e => {
  const n = parseInt(e.key);
  if(n >= 1 && n <= 4) {
    mode = n - 1;
    document.querySelectorAll('#mode span').forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  }
});

// ── Asset Capture Pipeline ──
// Press G to generate a full 8-direction sprite sheet from the current 3D model
let capturing = false;
const CAPTURE_ANGLES = 8;  // 8 directions: 0°, 45°, 90°, ... 315°
const CAPTURE_SIZE = 128;  // frame size in pixels

function captureFrame() {
  // Render at capture resolution
  const capCanvas = document.createElement('canvas');
  capCanvas.width = CAPTURE_SIZE;
  capCanvas.height = CAPTURE_SIZE;

  // Read pixels from current WebGL canvas
  const pixels = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Crop center square and scale to CAPTURE_SIZE
  const ctx = capCanvas.getContext('2d');
  const imgData = ctx.createImageData(W, H);

  // WebGL reads bottom-up, flip vertically
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const srcI = ((H - 1 - y) * W + x) * 4;
      const dstI = (y * W + x) * 4;
      imgData.data[dstI] = pixels[srcI];
      imgData.data[dstI+1] = pixels[srcI+1];
      imgData.data[dstI+2] = pixels[srcI+2];
      imgData.data[dstI+3] = pixels[srcI+3];
    }
  }

  // Draw full frame then crop center
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = W; tmpCanvas.height = H;
  tmpCanvas.getContext('2d').putImageData(imgData, 0, 0);

  // Crop center square
  const cropSize = Math.min(W, H);
  const cx = (W - cropSize) / 2, cy = (H - cropSize) / 2;
  ctx.drawImage(tmpCanvas, cx, cy, cropSize, cropSize, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE);

  return capCanvas;
}

async function generateSpriteSheet() {
  if (capturing) return;
  capturing = true;
  autoRotate = false;

  const savedTheta = theta, savedPhi = phi, savedDist = dist;
  const frames = [];

  document.getElementById('info').innerHTML = 'CAPTURING SPRITE SHEET...<br>0 / ' + CAPTURE_ANGLES;

  // Capture from each angle
  phi = 0.25; // slightly above horizon
  dist = 2.2; // consistent distance

  for (let i = 0; i < CAPTURE_ANGLES; i++) {
    theta = (i / CAPTURE_ANGLES) * Math.PI * 2;

    // Render one frame
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTheta, theta);
    gl.uniform1f(uPhi, phi);
    gl.uniform1f(uDist, dist);
    gl.uniform1f(uTime, performance.now() * 0.001);
    gl.uniform1i(uMode, mode);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Wait for GPU to finish
    gl.finish();

    frames.push(captureFrame());
    document.getElementById('info').innerHTML =
      `CAPTURING SPRITE SHEET...<br>${i+1} / ${CAPTURE_ANGLES}`;

    // Small delay to let UI update
    await new Promise(r => setTimeout(r, 50));
  }

  // Pack into horizontal strip sprite sheet
  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = CAPTURE_SIZE * CAPTURE_ANGLES;
  sheetCanvas.height = CAPTURE_SIZE;
  const sheetCtx = sheetCanvas.getContext('2d');

  for (let i = 0; i < frames.length; i++) {
    sheetCtx.drawImage(frames[i], i * CAPTURE_SIZE, 0);
  }

  // Also generate a 4x2 grid layout (more common for game engines)
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = CAPTURE_SIZE * 4;
  gridCanvas.height = CAPTURE_SIZE * 2;
  const gridCtx = gridCanvas.getContext('2d');

  for (let i = 0; i < frames.length; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    gridCtx.drawImage(frames[i], col * CAPTURE_SIZE, row * CAPTURE_SIZE);
  }

  // Download both
  downloadCanvas(sheetCanvas, `sprite_${['heightmap','revolution','crosssection','mandelbulb'][mode]}_strip.png`);

  setTimeout(() => {
    downloadCanvas(gridCanvas, `sprite_${['heightmap','revolution','crosssection','mandelbulb'][mode]}_grid.png`);
  }, 500);

  // Generate SpriteBrain manifest
  const manifest = {
    id: `sculpted_${['heightmap','revolution','crosssection','mandelbulb'][mode]}`,
    source: 'sprite_sculptor',
    mode: ['heightmap','revolution','crosssection','mandelbulb'][mode],
    frame_count: CAPTURE_ANGLES,
    frame_size: CAPTURE_SIZE,
    layout: 'horizontal_strip',
    angles: Array.from({length: CAPTURE_ANGLES}, (_, i) => Math.round(i * 360 / CAPTURE_ANGLES)),
    states: {
      'front': [0],
      'front_right': [1],
      'right': [2],
      'back_right': [3],
      'back': [4],
      'back_left': [5],
      'left': [6],
      'front_left': [7],
    },
    generated: new Date().toISOString(),
    sieve_seed: [9,41,49,89,161,169,281][mode],
  };

  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {type: 'application/json'});
  const manifestUrl = URL.createObjectURL(manifestBlob);
  const a3 = document.createElement('a');
  a3.href = manifestUrl;
  a3.download = `sprite_${['heightmap','revolution','crosssection','mandelbulb'][mode]}_manifest.json`;
  a3.click();

  // Restore camera
  theta = savedTheta; phi = savedPhi; dist = savedDist;
  capturing = false;

  document.getElementById('info').innerHTML =
    `SPRITE SHEET EXPORTED!<br>${CAPTURE_ANGLES} angles × ${CAPTURE_SIZE}px<br>` +
    `strip + grid + manifest<br><br>GUINEA PIG TRENCH · ohthatsthe`;
}

function downloadCanvas(canvas, filename) {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// ── Drag-and-drop sprite loading ──
canvas.addEventListener('dragover', e => {e.preventDefault(); e.dataTransfer.dropEffect = 'copy'});
canvas.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;

  const img = new Image();
  img.onload = () => {
    // Resize to SPRITE_SIZE and upload as texture
    const tmpC = document.createElement('canvas');
    tmpC.width = SPRITE_SIZE; tmpC.height = SPRITE_SIZE;
    const tmpCtx = tmpC.getContext('2d');
    tmpCtx.drawImage(img, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const imgData = tmpCtx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);

    gl.bindTexture(gl.TEXTURE_2D, spriteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SPRITE_SIZE, SPRITE_SIZE, 0,
                  gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(imgData.data.buffer));

    document.getElementById('info').innerHTML =
      `LOADED: ${file.name}<br>${img.width}×${img.height} → ${SPRITE_SIZE}×${SPRITE_SIZE}<br><br>` +
      `G: GENERATE SPRITE SHEET<br>1-4: CHANGE MODE<br>DROP: LOAD NEW SPRITE`;
  };
  img.src = URL.createObjectURL(file);
});

// G key = generate sprite sheet
window.addEventListener('keydown', e => {
  if(e.key === 'g' || e.key === 'G') generateSpriteSheet();
  const n = parseInt(e.key);
  if(n >= 1 && n <= 4) {
    mode = n - 1;
    document.querySelectorAll('#mode span').forEach(s => s.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  }
});

// ── Render loop ──
let frameCount = 0, lastFpsTime = 0;
function render(t) {
  if (capturing) { requestAnimationFrame(render); return; }
  t *= 0.001;
  resize();
  gl.viewport(0, 0, W, H);

  if(autoRotate) theta += 0.005;

  gl.uniform2f(uRes, W, H);
  gl.uniform1f(uTheta, theta);
  gl.uniform1f(uPhi, phi);
  gl.uniform1f(uDist, dist);
  gl.uniform1f(uTime, t);
  gl.uniform1i(uMode, mode);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // FPS counter
  frameCount++;
  if(t - lastFpsTime > 1) {
    document.getElementById('fps').innerHTML =
      `${frameCount} FPS<br>${['HEIGHT MAP','REVOLUTION','CROSS SECTION','MANDELBULB'][mode]}`;
    frameCount = 0;
    lastFpsTime = t;
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);



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
  var hbPeriod = 0.7083532924945656;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.019978606223913287;mix-blend-mode:overlay';
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
