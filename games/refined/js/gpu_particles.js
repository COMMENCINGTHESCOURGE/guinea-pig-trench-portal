
const canvas = document.getElementById('cfx');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
if (!gl) { document.body.innerHTML='<div style="color:#ff4444;font-family:monospace;padding:40px;text-align:center"><h2>WebGL Required</h2><p>Your browser does not support WebGL</p></div>'; throw 0; }

// Required extensions for float textures
const floatExt = gl.getExtension('OES_texture_float');
if (!floatExt) {
  // Fallback: try half-float
  const halfExt = gl.getExtension('OES_texture_half_float');
  if (!halfExt) {
    document.body.innerHTML='<div style="color:#ff4444;font-family:monospace;padding:40px;text-align:center"><h2>Float Textures Required</h2><p>Your GPU does not support float textures needed for 1M particles</p></div>';
    throw 0;
  }
}
gl.getExtension('OES_texture_float_linear');
gl.getExtension('WEBGL_color_buffer_float');

let dpr = window.devicePixelRatio || 1;
let width, height;

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Enable glow / additive blending
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

// Set background for trails
gl.clearColor(0.0, 0.0, 0.0, 1.0);

// ─── SHADER HELPERS ────────────────────────────
function createShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
function createProgram(gl, vsSrc, fsSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

// ─── FULLSCREEN QUAD (SIM + RENDER) ────────────
const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  gl.STATIC_DRAW
);

// ─── INITIAL STATE (CENTERED) ──────────────────
const initialData = new Float32Array(TEX_W * TEX_H * 4);
for (let i = 0; i < PARTICLES; i++) {
  const idx = i * 4;
  initialData[idx + 0] = 0.0;
  initialData[idx + 1] = 0.0;
  initialData[idx + 2] = 0.0;
  initialData[idx + 3] = 0.0;
}

// ─── DATA TEXTURES & FBOs ──────────────────────
function createDataTexture(data) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    TEX_W,
    TEX_H,
    0,
    gl.RGBA,
    gl.FLOAT,
    data || null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
function createDataFBO(tex) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

let texA = createDataTexture(initialData);
let texB = createDataTexture(initialData);
let fboA = createDataFBO(texA);
let fboB = createDataFBO(texB);

let readTex = texA;
let writeFBO = fboB;

// ─── SIMULATION SHADER (CHEAP physics + burst) ────────────
const simVS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
const simFS = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_particles;
uniform float u_dt;
uniform vec2 u_gravity;
uniform vec2 u_burstCenter;
uniform float u_burstStrength;
void main() {
  vec4 data = texture2D(u_particles, v_uv);
  vec2 pos = data.xy;
  vec2 vel = data.zw;

  vel += u_gravity * u_dt;
  vec2 toP = pos - u_burstCenter;
  float dist = length(toP) + 1e-3;
  vec2 dir = toP / dist;
  float falloff = exp(-dist * 3.0);
  vel += dir * (u_burstStrength * falloff * u_dt);
  vel *= 0.99;

  pos += vel * u_dt;

  // Wrap
  if (pos.x > 1.1) pos.x = -1.1;
  if (pos.x < -1.1) pos.x = 1.1;
  if (pos.y > 1.1) pos.y = -1.1;
  if (pos.y < -1.1) pos.y = 1.1;

  gl_FragColor = vec4(pos, vel);
}
`;

// ─── RENDER SHADER (tiny sprite) ──────────────
const renderVS = `
precision highp float;
attribute vec2 a_vertex;
uniform sampler2D u_particles;
uniform float u_pointSize;
uniform float u_dpr;
void main() {
  vec2 uv = a_vertex * 0.5 + 0.5;
  vec4 data = texture2D(u_particles, uv);
  vec2 pos = data.xy;
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = u_pointSize * u_dpr;
}
`;
const renderFS = `
precision mediump float;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float dist = dot(d, d);
  if (dist > 0.25) discard; 
  float alpha = smoothstep(0.25, 0.0, dist);
  vec3 color = vec3(1.0); // bright white glow
  gl_FragColor = vec4(color, alpha);
}
`;

// compile programs
const simProg = createProgram(gl, createShader(gl, gl.VERTEX_SHADER, simVS), createShader(gl, gl.FRAGMENT_SHADER, simFS));
const renderProg = createProgram(gl, createShader(gl, gl.VERTEX_SHADER, renderVS), createShader(gl, gl.FRAGMENT_SHADER, renderFS));

// attribute locations
const aPos_sim       = gl.getAttribLocation(simProg, 'a_pos');
const uParticles     = gl.getUniformLocation(simProg, 'u_particles');
const uDt            = gl.getUniformLocation(simProg, 'u_dt');
const uGravity       = gl.getUniformLocation(simProg, 'u_gravity');
const uBurstCenter   = gl.getUniformLocation(simProg, 'u_burstCenter');
const uBurstStrength = gl.getUniformLocation(simProg, 'u_burstStrength');

const aVertex        = gl.getAttribLocation(renderProg, 'a_vertex');
const uRenderParticles = gl.getUniformLocation(renderProg, 'u_particles');
const uPointSize     = gl.getUniformLocation(renderProg, 'u_pointSize');
const uRenderDpr     = gl.getUniformLocation(renderProg, 'u_dpr');

// main loop
let lastTime = performance.now();
let particleCount = 0;

function animate(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // simulation pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO);
  gl.useProgram(simProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(aPos_sim);
  gl.vertexAttribPointer(aPos_sim, 2, gl.FLOAT, false, 0, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, readTex);
  gl.uniform1i(uParticles, 0);
  gl.uniform1f(uDt, dt);
  gl.uniform2f(uGravity, 0.0, -0.25);
  gl.uniform2f(uBurstCenter, mouse.x, mouse.y);
  gl.uniform1f(uBurstStrength, mouse.down ? 15.0 : 0.0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // render pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.clearColor(0, 0, 0, 0.12); // trails glow
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(renderProg);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(aVertex);
  gl.vertexAttribPointer(aVertex, 2, gl.FLOAT, false, 0, 0);
  const simTex = (writeFBO === fboB) ? texB : texA;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, simTex);
  gl.uniform1i(uRenderParticles, 0);
  gl.uniform1f(uPointSize, 1.0);
  gl.uniform1f(uRenderDpr, dpr);
  gl.drawArrays(gl.POINTS, 0, PARTICLES);

  // swap
  if (writeFBO === fboB) {
    readTex = texB; writeFBO = fboA;
  } else {
    readTex = texA; writeFBO = fboB;
  }

  requestAnimationFrame(animate);
}

// initialize mouse
const mouse = { x: 0, y: 0, down: false };
window.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / width) * 2 - 1;
  mouse.y = -((e.clientY / height) * 2 - 1);
});
window.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('touchstart', e => { mouse.down = true; }, { passive: false });
window.addEventListener('touchend', () => { mouse.down = false; });

// start loop
requestAnimationFrame(animate);



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
  var hbPeriod = 0.7355317721015147;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01504100980031333;mix-blend-mode:overlay';
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
