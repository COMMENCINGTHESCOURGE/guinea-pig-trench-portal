// ============================================================
// THE THRESHOLD FLIGHT
// Direction-based infinite star field + SDF world sampling
// Each star samples the five worlds' SDF as color/brightness
// Velocity warps directions. Roll skews the multiverse.
// Fly toward a world cluster to approach that world's boundary.
// ============================================================

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: true });
if (!gl) alert('WebGL2 required');

// --- CONFIG ---
const STAR_COUNT = 3000;
const SPHERE_RADIUS = 20.0;
const MOVE_SPEED = 9.0;
const SENSITIVITY = 0.002;
const ROLL_SPEED = 1.5;
const PARALLAX_NEAR = 0.09;
const PARALLAX_FAR = 0.02;

// --- FIVE WORLDS (positions as directions on the sphere) ---
const WORLDS = [
  { name: 'PINK HOUR',       dir: [0.0, 0.8, 0.6],   color: [1.0, 0.4, 0.67],  accent: '#ff66aa' },
  { name: 'THE BLOCK',       dir: [0.7, 0.0, 0.7],   color: [0.0, 1.0, 0.6],   accent: '#00ff9d' },
  { name: 'THE THRESHOLD',   dir: [0.0, -0.5, 0.87],  color: [0.0, 0.72, 0.78], accent: '#00b8c8' },
  { name: 'VAULT COMPOUND 7',dir: [-0.7, 0.3, 0.65],  color: [1.0, 0.53, 0.2],  accent: '#ff8833' },
  { name: 'THE BETWEEN',     dir: [0.0, 0.0, 1.0],   color: [0.4, 0.53, 1.0],  accent: '#6688ff' },
];
// Normalize world directions
WORLDS.forEach(w => {
  const len = Math.sqrt(w.dir[0]**2 + w.dir[1]**2 + w.dir[2]**2);
  w.dir = w.dir.map(d => d / len);
});

// --- SHADERS ---
const VERT = `#version 300 es
precision highp float;

in vec3 a_dir;       // unit direction on sphere
in float a_depth;    // 0-1 depth layer
in vec3 a_baseColor; // per-star random tint

uniform mat3 u_viewRot;     // inverse ship rotation
uniform vec3 u_velocity;    // ship velocity in view space
uniform float u_roll;       // roll angle for skew
uniform float u_time;
uniform float u_radius;

out vec3 v_color;
out float v_alpha;

// Five world centers (directions)
uniform vec3 u_world0;
uniform vec3 u_world1;
uniform vec3 u_world2;
uniform vec3 u_world3;
uniform vec3 u_world4;

// Five world colors
uniform vec3 u_wcolor0;
uniform vec3 u_wcolor1;
uniform vec3 u_wcolor2;
uniform vec3 u_wcolor3;
uniform vec3 u_wcolor4;

// SDF-like world influence: how close is this direction to each world?
float worldInfluence(vec3 dir, vec3 worldDir) {
  float d = dot(dir, worldDir);
  // Sharper falloff = more defined world boundaries
  return smoothstep(0.6, 0.95, d);
}

void main() {
  // Parallax: depth controls how much velocity warps direction
  float pFactor = mix(0.02, 0.09, 1.0 - a_depth);
  vec3 warped = normalize(a_dir + u_velocity * pFactor);

  // Roll skew in XY
  float cr = cos(u_roll * 0.35);
  float sr = sin(u_roll * 0.35);
  vec3 skewed = vec3(
    warped.x * cr - warped.y * sr,
    warped.x * sr + warped.y * cr,
    warped.z
  );
  skewed = normalize(skewed);

  // Apply view rotation (ship look direction)
  vec3 viewDir = u_viewRot * skewed;

  // Position on sphere
  vec3 pos = viewDir * u_radius;
  gl_Position = vec4(pos.xy * 0.06, -pos.z * 0.001, 1.0);

  // Depth-based size
  gl_PointSize = mix(1.0, 4.0, 1.0 - a_depth);

  // --- WORLD COLORING ---
  // Sample each world's influence on this star's direction
  float w0 = worldInfluence(skewed, u_world0);
  float w1 = worldInfluence(skewed, u_world1);
  float w2 = worldInfluence(skewed, u_world2);
  float w3 = worldInfluence(skewed, u_world3);
  float w4 = worldInfluence(skewed, u_world4);

  float totalW = w0 + w1 + w2 + w3 + w4;

  vec3 worldColor;
  if (totalW > 0.01) {
    // Blend world colors by influence
    worldColor = (u_wcolor0 * w0 + u_wcolor1 * w1 + u_wcolor2 * w2 +
                  u_wcolor3 * w3 + u_wcolor4 * w4) / totalW;
  } else {
    // In the void between worlds — use base star color, dimmer
    worldColor = a_baseColor * 0.3;
  }

  // Mix world color with base star tint
  float worldStrength = clamp(totalW * 2.0, 0.0, 1.0);
  v_color = mix(a_baseColor * 0.4, worldColor, worldStrength);

  // Pulsing based on time + world proximity
  float pulse = 0.85 + 0.15 * sin(u_time * 2.0 + dot(skewed, vec3(1.0)) * 10.0);
  v_color *= pulse;

  // Alpha: rim fade + depth fade
  float radial = length(skewed.xy);
  float rimAlpha = smoothstep(0.2, 0.7, radial);
  float depthAlpha = mix(0.3, 1.0, 1.0 - a_depth);
  v_alpha = rimAlpha * depthAlpha * (0.5 + worldStrength * 0.5);
}
`;

const FRAG = `#version 300 es
precision highp float;

in vec3 v_color;
in float v_alpha;
out vec4 fragColor;

void main() {
  // Soft circle point
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float d = dot(pc, pc);
  if (d > 1.0) discard;
  float soft = 1.0 - smoothstep(0.5, 1.0, d);

  fragColor = vec4(v_color, v_alpha * soft);
}
`;

// --- COMPILE SHADERS ---
function createShader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

const vs = createShader(gl.VERTEX_SHADER, VERT);
const fs = createShader(gl.FRAGMENT_SHADER, FRAG);
const prog = gl.createProgram();
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);
gl.useProgram(prog);

// --- GENERATE STAR DATA ---
const dirs = new Float32Array(STAR_COUNT * 3);
const depths = new Float32Array(STAR_COUNT);
const colors = new Float32Array(STAR_COUNT * 3);

for (let i = 0; i < STAR_COUNT; i++) {
  // Random unit direction (uniform on sphere)
  let x, y, z, len;
  do {
    x = Math.random() * 2 - 1;
    y = Math.random() * 2 - 1;
    z = Math.random() * 2 - 1;
    len = Math.sqrt(x*x + y*y + z*z);
  } while (len < 0.01 || len > 1);
  dirs[i*3] = x/len;
  dirs[i*3+1] = y/len;
  dirs[i*3+2] = z/len;

  depths[i] = Math.random();

  // Base color: slight warm/cool variation
  colors[i*3] = 0.6 + Math.random() * 0.4;
  colors[i*3+1] = 0.6 + Math.random() * 0.4;
  colors[i*3+2] = 0.7 + Math.random() * 0.3;
}

// --- BUFFERS ---
const dirBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, dirBuf);
gl.bufferData(gl.ARRAY_BUFFER, dirs, gl.STATIC_DRAW);
const aDir = gl.getAttribLocation(prog, 'a_dir');
gl.enableVertexAttribArray(aDir);
gl.vertexAttribPointer(aDir, 3, gl.FLOAT, false, 0, 0);

const depthBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, depthBuf);
gl.bufferData(gl.ARRAY_BUFFER, depths, gl.STATIC_DRAW);
const aDepth = gl.getAttribLocation(prog, 'a_depth');
gl.enableVertexAttribArray(aDepth);
gl.vertexAttribPointer(aDepth, 1, gl.FLOAT, false, 0, 0);

const colorBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
const aColor = gl.getAttribLocation(prog, 'a_baseColor');
gl.enableVertexAttribArray(aColor);
gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

// --- UNIFORMS ---
const uViewRot = gl.getUniformLocation(prog, 'u_viewRot');
const uVelocity = gl.getUniformLocation(prog, 'u_velocity');
const uRoll = gl.getUniformLocation(prog, 'u_roll');
const uTime = gl.getUniformLocation(prog, 'u_time');
const uRadius = gl.getUniformLocation(prog, 'u_radius');

const uWorlds = WORLDS.map((_, i) => gl.getUniformLocation(prog, `u_world${i}`));
const uWColors = WORLDS.map((_, i) => gl.getUniformLocation(prog, `u_wcolor${i}`));

// --- GL STATE ---
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.clearColor(0.015, 0.015, 0.04, 1);

// --- PLAYER STATE ---
let yaw = 0, pitch = 0, roll = 0;
let velocity = [0, 0, 0];
let isLocked = false;
const keys = {};

// --- INPUT ---
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === canvas;
  document.getElementById('start-screen').style.display = isLocked ? 'none' : 'flex';
});

document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  yaw -= e.movementX * SENSITIVITY;
  pitch -= e.movementY * SENSITIVITY;
  pitch = Math.max(-1.55, Math.min(1.55, pitch));
});

document.getElementById('start-screen').addEventListener('click', () => {
  document.getElementById('start-screen').style.display = 'none';
  const p = canvas.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
});

window.addEventListener('message', e => {
  if (e.data && e.data.type === 'pause') isLocked = false;
  if (e.data && e.data.type === 'resume') { const p = canvas.requestPointerLock(); if (p&&p.catch) p.catch(()=>{}); }
});

// --- ROTATION MATRIX ---
function mat3Rot(yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // Rz * Rx * Ry, transposed for view matrix
  const m = new Float32Array(9);
  m[0] = cy*cr + sy*sp*sr;  m[1] = cp*sr;  m[2] = -sy*cr + cy*sp*sr;
  m[3] = -cy*sr + sy*sp*cr; m[4] = cp*cr;  m[5] = sy*sr + cy*sp*cr;
  m[6] = sy*cp;             m[7] = -sp;    m[8] = cy*cp;
  return m;
}

// --- RESIZE ---
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// --- FIND NEAREST WORLD ---
function findNearestWorld() {
  // Forward direction in world space
  const R = mat3Rot(yaw, pitch, roll);
  // Forward = R * [0,0,1]
  const fwd = [R[2], R[5], R[8]]; // third column

  let best = -1, bestDot = -2, bestName = 'THE BETWEEN';
  for (let i = 0; i < WORLDS.length; i++) {
    const d = fwd[0]*WORLDS[i].dir[0] + fwd[1]*WORLDS[i].dir[1] + fwd[2]*WORLDS[i].dir[2];
    if (d > bestDot) { bestDot = d; best = i; bestName = WORLDS[i].name; }
  }

  const indicator = document.getElementById('world-indicator');
  if (bestDot > 0.85) {
    indicator.textContent = `APPROACHING: ${bestName}`;
    indicator.style.color = WORLDS[best].accent;
  } else if (bestDot > 0.5) {
    indicator.textContent = bestName;
    indicator.style.color = WORLDS[best].accent;
  } else {
    indicator.textContent = 'THE BETWEEN';
    indicator.style.color = '#6688ff';
  }

  return { index: best, dot: bestDot, name: bestName };
}

// --- GAME LOOP ---
let lastTime = performance.now();
const startTime = performance.now();

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const elapsed = (now - startTime) / 1000;

  if (isLocked) {
    if (keys['KeyQ']) roll -= ROLL_SPEED * dt;
    if (keys['KeyE']) roll += ROLL_SPEED * dt;

    // Forward/back from rotation
    const R = mat3Rot(yaw, pitch, roll);
    const fwd = [R[2], R[5], R[8]];

    velocity = [0, 0, 0];
    if (keys['KeyW']) { velocity[0] += fwd[0]; velocity[1] += fwd[1]; velocity[2] += fwd[2]; }
    if (keys['KeyS']) { velocity[0] -= fwd[0]; velocity[1] -= fwd[1]; velocity[2] -= fwd[2]; }

    const len = Math.sqrt(velocity[0]**2 + velocity[1]**2 + velocity[2]**2);
    if (len > 0) {
      velocity[0] = velocity[0]/len * MOVE_SPEED;
      velocity[1] = velocity[1]/len * MOVE_SPEED;
      velocity[2] = velocity[2]/len * MOVE_SPEED;
    }
  }

  // --- RENDER ---
  gl.clear(gl.COLOR_BUFFER_BIT);

  const viewRot = mat3Rot(yaw, pitch, roll);
  gl.uniformMatrix3fv(uViewRot, false, viewRot);
  gl.uniform3f(uVelocity, velocity[0], velocity[1], velocity[2]);
  gl.uniform1f(uRoll, roll);
  gl.uniform1f(uTime, elapsed);
  gl.uniform1f(uRadius, SPHERE_RADIUS);

  // World positions and colors
  for (let i = 0; i < WORLDS.length; i++) {
    gl.uniform3fv(uWorlds[i], WORLDS[i].dir);
    gl.uniform3fv(uWColors[i], WORLDS[i].color);
  }

  gl.drawArrays(gl.POINTS, 0, STAR_COUNT);

  // --- HUD ---
  const speed = Math.sqrt(velocity[0]**2 + velocity[1]**2 + velocity[2]**2);
  document.getElementById('hud-speed').textContent = `Speed: ${speed.toFixed(1)}`;
  document.getElementById('hud-roll').textContent = `Roll: ${(roll * 180 / Math.PI).toFixed(1)}`;

  const nearest = findNearestWorld();
  document.getElementById('hud-nearest').textContent = `Nearest: ${nearest.name} (${(nearest.dot * 100).toFixed(0)}%)`;
}

requestAnimationFrame(loop);