const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

let W, H, mx = 0.5, my = 0.5, gate = 0, tgt = 0, t0 = Date.now();

function resize() {
  W = canvas.width = window.innerWidth * devicePixelRatio;
  H = canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  gl.viewport(0, 0, W, H);
}
resize();
window.addEventListener('resize', resize);
document.addEventListener('mousemove', e => { mx = e.clientX/innerWidth; my = e.clientY/innerHeight; });
document.addEventListener('touchmove', e => { mx = e.touches[0].clientX/innerWidth; my = e.touches[0].clientY/innerHeight; }, {passive:true});
document.addEventListener('click', () => { tgt = tgt > 0.5 ? 0 : 1; });
if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', e => {
  if (e.gamma !== null) { mx = (e.gamma+45)/90; my = (e.beta-20)/70; }
});

// === FULLSCREEN QUAD ===
const vs = `attribute vec2 p; void main(){gl_Position=vec4(p,0,1);}`;

const fs = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uGate;  // 0=closed, 1=open
uniform vec2 uMouse;  // 0-1

#define PI 3.14159265
#define MAX_STEPS 120
#define MAX_DIST 30.0
#define SURF_DIST 0.002

// Colors
#define TEAL vec3(0.0, 0.85, 0.8)
#define GOLD vec3(0.94, 0.75, 0.19)
#define STEEL vec3(0.54, 0.54, 0.56)
#define CREAM vec3(0.78, 0.75, 0.69)
#define DARK vec3(0.05, 0.05, 0.07)

// === SDF PRIMITIVES ===
float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
  if (3.0*p.x < m) q = p.xyz;
  else if (3.0*p.y < m) q = p.yzx;
  else if (3.0*p.z < m) q = p.zxy;
  else return m * 0.57735027;
  float k = clamp(0.5*(q.z-q.y+s), 0.0, s);
  return length(vec3(q.x, q.y-s+k, q.z-k));
}

// === HASH PATTERN (for data texture on walls) ===
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float dataTexture(vec2 uv) {
  vec2 g = floor(uv * 40.0);
  float h = hash(g);
  float line = step(0.85, fract(uv.y * 80.0));
  return h > 0.7 ? line * 0.3 : 0.0;
}

// === BOOKSHELF SDF ===
// Books as repeating boxes on walls, varying height/width/depth
// Some pulled out, some missing (gaps = destroyed data)
float sdBooks(vec3 p, float wallX) {
  // Position relative to wall
  vec3 bp = p;
  bp.x = abs(bp.x) - wallX + 0.3; // 0.3 = shelf depth from wall

  // Shelf grid: 5 shelves vertically, books repeat along z
  float shelfY = 0.7; // shelf spacing
  float shelfID = floor(bp.y / shelfY);
  float localY = bp.y - shelfID * shelfY;

  // Shelf plank
  float plank = sdBox(vec3(bp.x, localY - 0.02, bp.z), vec3(0.28, 0.015, 50.0));

  // Books on this shelf
  float bookSpacing = 0.12;
  float bookID = floor(bp.z / bookSpacing);
  float localZ = bp.z - bookID * bookSpacing;

  // Vary book properties by position hash
  float h = hash(vec2(shelfID, bookID));
  float h2 = hash(vec2(bookID * 7.0, shelfID * 13.0));

  // Some slots are empty (destroyed/missing)
  float isEmpty = step(0.82, h2);

  // Book dimensions vary
  float bookH = 0.2 + h * 0.35;  // height: 0.2 - 0.55
  float bookW = 0.02 + h2 * 0.04; // width: 0.02 - 0.06
  float bookD = 0.15 + h * 0.1;   // depth: 0.15 - 0.25

  // Some books pulled out slightly
  float pullOut = step(0.7, h) * 0.05;

  float book = sdBox(
    vec3(bp.x - pullOut, localY - bookH * 0.5 - 0.03, localZ - bookSpacing * 0.5),
    vec3(bookD, bookH, bookW)
  );

  // Remove empty slots
  book = mix(book, MAX_DIST, isEmpty);

  // Combine shelf + books
  return min(plank, book);
}

// === THE SCENE ===
// Material IDs: 0=floor, 1=wall/shelf, 2=door, 3=frame, 4=star, 5=hologram, 6=book
vec2 scene(vec3 p) {
  float d = MAX_DIST;
  float id = 0.0;

  // Floor
  float floor_d = p.y;
  d = floor_d;

  // Ceiling
  float ceil_d = 4.0 - p.y;
  if (ceil_d < d) { d = ceil_d; id = 1.0; }

  // Left wall (behind shelves)
  float lw = p.x + 3.0;
  if (lw < d) { d = lw; id = 1.0; }

  // Right wall
  float rw = 3.0 - p.x;
  if (rw < d) { d = rw; id = 1.0; }

  // Bookshelves on left wall
  float booksL = sdBooks(p, 3.0);
  if (booksL < d) { d = booksL; id = 6.0; }

  // Bookshelves on right wall (mirror)
  float booksR = sdBooks(vec3(-p.x, p.y, p.z), 3.0);
  if (booksR < d) { d = booksR; id = 6.0; }

  // Shelf uprights (vertical dividers every ~1.5 units)
  float uprightZ = mod(p.z + 0.75, 1.5) - 0.75;
  float uprightL = sdBox(vec3(p.x + 2.72, p.y - 2.0, uprightZ), vec3(0.03, 2.0, 0.02));
  if (uprightL < d) { d = uprightL; id = 3.0; }
  float uprightR = sdBox(vec3(p.x - 2.72, p.y - 2.0, uprightZ), vec3(0.03, 2.0, 0.02));
  if (uprightR < d) { d = uprightR; id = 3.0; }

  // Door frame - top beam
  float frame_top = sdBox(p - vec3(0, 3.5, 0), vec3(1.6, 0.1, 0.15));
  if (frame_top < d) { d = frame_top; id = 3.0; }

  // Door frame - sides
  float frame_l = sdBox(p - vec3(-1.5, 1.75, 0), vec3(0.08, 1.75, 0.15));
  if (frame_l < d) { d = frame_l; id = 3.0; }
  float frame_r = sdBox(p - vec3(1.5, 1.75, 0), vec3(0.08, 1.75, 0.15));
  if (frame_r < d) { d = frame_r; id = 3.0; }

  // Door panels (slide open)
  float doorSlide = uGate * 1.2;
  float ld = sdBox(p - vec3(-0.7 - doorSlide, 1.75, 0), vec3(0.7, 1.75, 0.04));
  if (ld < d) { d = ld; id = 2.0; }
  float rd = sdBox(p - vec3(0.7 + doorSlide, 1.75, 0), vec3(0.7, 1.75, 0.04));
  if (rd < d) { d = rd; id = 2.0; }

  // Star aperture
  float star = sdOctahedron((p - vec3(0, 1.75, 0.05)) * vec3(1, 0.77, 2.5), 0.3);
  if (star < d) { d = star; id = 4.0; }

  // Holographic # (floating, rotating)
  float hY = 2.8 + sin(uTime * 0.8) * 0.05;
  float hRot = sin(uTime * 0.5) * 0.15;
  vec3 hp = p - vec3(0, hY, -0.3);
  hp.xz = mat2(cos(hRot), -sin(hRot), sin(hRot), cos(hRot)) * hp.xz;

  float hv1 = sdBox(hp - vec3(-0.1, 0, 0), vec3(0.025, 0.35, 0.01));
  float hv2 = sdBox(hp - vec3(0.1, 0, 0), vec3(0.025, 0.35, 0.01));
  float hh1 = sdBox(hp - vec3(0, 0.1, 0), vec3(0.35, 0.025, 0.01));
  float hh2 = sdBox(hp - vec3(0, -0.1, 0), vec3(0.35, 0.025, 0.01));
  float holo = min(min(hv1, hv2), min(hh1, hh2));
  if (holo < d) { d = holo; id = 5.0; }

  return vec2(d, id);
}

// === RAYMARCHING ===
vec2 march(vec3 ro, vec3 rd) {
  float t = 0.0;
  float id = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 h = scene(p);
    if (h.x < SURF_DIST) { id = h.y; break; }
    if (t > MAX_DIST) break;
    t += h.x * 0.8;
  }
  return vec2(t, id);
}

vec3 getNormal(vec3 p) {
  vec2 e = vec2(0.001, 0);
  return normalize(vec3(
    scene(p + e.xyy).x - scene(p - e.xyy).x,
    scene(p + e.yxy).x - scene(p - e.yxy).x,
    scene(p + e.yyx).x - scene(p - e.yyx).x
  ));
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 32; i++) {
    float h = scene(ro + rd * t).x;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.02, 0.5);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

// === SHADING ===
vec3 shade(vec3 p, vec3 n, vec3 rd, float id) {
  vec3 lightPos = vec3(0.5, 3.5, 4.0);
  vec3 L = normalize(lightPos - p);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 32.0);
  float ao = 0.5 + 0.5 * n.y;
  float shadow = softShadow(p + n * 0.01, L, 0.02, 8.0);

  vec3 col;

  if (id < 0.5) {
    // Floor — dark grid
    vec2 grid = abs(fract(p.xz * 2.0) - 0.5);
    float line = step(min(grid.x, grid.y), 0.02);
    col = mix(DARK, DARK + vec3(0.02, 0.02, 0.04), line);
    // Floor reflection hint
    col += TEAL * 0.02 * max(0.0, 1.0 - length(p.xz) * 0.3);
  }
  else if (id < 1.5) {
    // Walls/ceiling — data texture
    float dt = dataTexture(p.yz + p.xy);
    col = mix(vec3(0.08, 0.08, 0.1), CREAM * 0.3, dt);
    // Diamond pattern
    vec2 cell = floor(vec2(p.z, p.y) * 1.0);
    float checker = mod(cell.x + cell.y, 2.0);
    col = mix(col, CREAM * 0.5, checker * 0.15);
  }
  else if (id < 2.5) {
    // Door panels — brushed steel with diamond inlay
    vec2 duv = p.yz;
    float diamond = abs(duv.x - 1.75) + abs(duv.y);
    float inlay = smoothstep(0.6, 0.55, diamond);
    // Crosshatch # texture on doors
    float hatch = 0.0;
    hatch += step(0.92, fract(p.y * 8.0)) * 0.2;
    hatch += step(0.92, fract(p.z * 8.0)) * 0.2;
    col = mix(STEEL * 0.5, CREAM * 0.6, inlay);
    col += hatch * 0.1;
  }
  else if (id < 3.5) {
    // Door frame — polished steel
    col = STEEL * 0.8;
    spec *= 2.0;
  }
  else if (id < 4.5) {
    // Star aperture
    col = STEEL;
    spec *= 3.0;
    // Edge glow
    float edge = 1.0 - abs(dot(n, -rd));
    col += TEAL * edge * edge * 0.5;
  }
  else if (id < 5.5) {
    // Holographic # — emissive teal
    float pulse = 0.7 + 0.3 * sin(uTime * 3.0);
    col = TEAL * pulse * 2.0;
    float edge = 1.0 - abs(dot(n, -rd));
    col += vec3(0.3, 0.8, 1.0) * edge * 1.5;
    return col; // emissive, skip lighting
  }
  else {
    // Books — warm leather/cloth tones, varying by position
    float bookHash = hash(floor(p.yz * 8.0));
    // Color variety: dark leather, burgundy, navy, forest green, tan
    vec3 bookColors[5];
    bookColors[0] = vec3(0.25, 0.12, 0.08); // dark leather
    bookColors[1] = vec3(0.4, 0.1, 0.1);    // burgundy
    bookColors[2] = vec3(0.1, 0.1, 0.25);   // navy
    bookColors[3] = vec3(0.1, 0.2, 0.1);    // forest
    bookColors[4] = vec3(0.5, 0.4, 0.25);   // tan
    int ci = int(bookHash * 5.0);
    if (ci == 0) col = bookColors[0];
    else if (ci == 1) col = bookColors[1];
    else if (ci == 2) col = bookColors[2];
    else if (ci == 3) col = bookColors[3];
    else col = bookColors[4];

    // Gold text/spine detail
    float spine = step(0.93, fract(p.y * 20.0));
    col += GOLD * spine * 0.3;

    // Slight roughness variation
    spec *= 0.3;
  }

  // Combine lighting
  vec3 ambient = col * 0.15;
  vec3 diffuse = col * diff * shadow * 0.7;
  vec3 specular = vec3(1.0) * spec * shadow * 0.3;

  // Teal backlight through gate
  vec3 backLight = TEAL * 0.1 * max(0.0, -p.z * 0.3) * (0.5 + 0.5 * uGate);

  // Floor edge light strips
  float edgeLight = exp(-abs(abs(p.x) - 2.9) * 10.0) * step(p.y, 0.2);
  vec3 edgeGlow = vec3(1.0) * edgeLight * 0.3;

  return ambient + diffuse + specular + backLight + edgeGlow + ao * 0.05;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  // Camera with mouse sway
  vec3 ro = vec3((uMouse.x - 0.5) * 1.0, 1.6 + (uMouse.y - 0.5) * 0.5, 5.0);
  vec3 lookAt = vec3(0.0, 1.3, 0.0);
  vec3 fwd = normalize(lookAt - ro);
  vec3 right = normalize(cross(vec3(0,1,0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(fwd + uv.x * right + uv.y * up);

  vec2 hit = march(ro, rd);

  vec3 col;
  if (hit.x < MAX_DIST) {
    vec3 p = ro + rd * hit.x;
    vec3 n = getNormal(p);
    col = shade(p, n, rd, hit.y);

    // Fog
    float fog = 1.0 - exp(-hit.x * 0.06);
    col = mix(col, DARK, fog);
  } else {
    col = DARK;
  }

  // Cyan wireframe overlay lines (from hologram to corners)
  float lineAlpha = 0.0;
  vec2 screenUV = gl_FragCoord.xy / uRes;
  // Diagonal lines from center
  float d1 = abs(screenUV.x - screenUV.y);
  float d2 = abs(screenUV.x - (1.0 - screenUV.y));
  lineAlpha += smoothstep(0.003, 0.0, abs(d1 - 0.5)) * 0.1;
  lineAlpha += smoothstep(0.003, 0.0, abs(d2 - 0.5)) * 0.1;
  col += TEAL * lineAlpha;

  // Scanlines
  col *= 0.95 + 0.05 * sin(gl_FragCoord.y * 1.5);

  // Vignette
  vec2 vig = screenUV * (1.0 - screenUV);
  col *= pow(vig.x * vig.y * 16.0, 0.15);

  // Gamma
  col = pow(col, vec3(0.85));

  gl_FragColor = vec4(col, 1.0);
}
`;

// === COMPILE ===
function compile(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    document.body.innerHTML = '<pre style="color:red;padding:20px">' + gl.getShaderInfoLog(s) + '</pre>';
  }
  return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(vs, gl.VERTEX_SHADER));
gl.attachShader(prog, compile(fs, gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
gl.useProgram(prog);

// Fullscreen quad
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const pLoc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(pLoc);
gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

const uRes = gl.getUniformLocation(prog, 'uRes');
const uTime = gl.getUniformLocation(prog, 'uTime');
const uGate = gl.getUniformLocation(prog, 'uGate');
const uMouse = gl.getUniformLocation(prog, 'uMouse');

function render() {
  const t = (Date.now() - t0) * 0.001;
  gate += (tgt - gate) * 0.03;

  gl.uniform2f(uRes, W, H);
  gl.uniform1f(uTime, t);
  gl.uniform1f(uGate, gate);
  gl.uniform2f(uMouse, mx, my);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // HUD update
  const st = document.getElementById('st');
  if (gate < 0.3) st.textContent = 'STATE: CLOSED (#)';
  else if (gate < 0.7) st.textContent = 'STATE: FILTERING (♯)';
  else st.textContent = 'STATE: OPEN (_)';

  requestAnimationFrame(render);
}
render();