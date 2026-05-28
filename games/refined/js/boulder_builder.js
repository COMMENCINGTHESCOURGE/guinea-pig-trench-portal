
// ════════════════════════════════════════════════════════════
// BOULDER BUILDER
// The cross-section SDF boulder is the building primitive.
// Place them in 3D space. Each boulder = a sprite cross-section
// rendered with orbit trap fractal palettes.
// A wall is boulders in a line. A tower is boulders stacked.
// A cave is boulders subtracted. Architecture from geology.
// ════════════════════════════════════════════════════════════

const glC = document.getElementById('gl');
const gl = glC.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'high-performance'});
const ovC = document.getElementById('ov');
const ox = ovC.getContext('2d');

let W, H;
function resize() {
  W = glC.width = ovC.width = innerWidth;
  H = glC.height = ovC.height = innerHeight;
  gl.viewport(0, 0, W, H);
}
resize();
addEventListener('resize', resize);

// ── Biome palettes (orbit trap colors) ──
const BIOMES = [
  {name:'Stone',  a:[.39,.37,.33], b:[.25,.24,.22], c:[.60,.58,.50], d:[.18,.16,.14]},
  {name:'Lava',   a:[.58,.12,.08], b:[1,.47,.13],   c:[1,.82,.16],   d:[.19,.04,.03]},
  {name:'Ice',    a:[.39,.59,1],   b:[.75,.85,1],   c:[1,1,1],       d:[.19,.25,.38]},
  {name:'Forest', a:[0,.78,.71],   b:[.10,.19,.13],  c:[.25,.63,.38], d:[.04,.13,.09]},
  {name:'Crystal',a:[.47,.20,.78], b:[.71,.39,1],   c:[.86,.63,1],   d:[.24,.08,.43]},
  {name:'Gold',   a:[.83,.66,.27], b:[.63,.47,.19],  c:[1,.88,.40],   d:[.42,.33,.13]},
];
let currentBiome = 0;

// ── Build swatches ──
const swatchBox = document.getElementById('swatches');
BIOMES.forEach((b, i) => {
  const s = document.createElement('div');
  s.className = 'swatch' + (i === 0 ? ' active' : '');
  const r = Math.round(b.a[0]*255), g = Math.round(b.a[1]*255), bl = Math.round(b.a[2]*255);
  s.style.background = `rgb(${r},${g},${bl})`;
  s.title = b.name;
  s.onclick = () => {
    currentBiome = i;
    document.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
    s.classList.add('active');
  };
  swatchBox.appendChild(s);
});

// ── Sprite library — load actual game sprites ──
const SS = 64;
const SPRITE_LIB = [
  { name: 'Mecha',   src: '../assets/sprites/mecha_entity_alpha_v2_pixel.png' },
  { name: 'Geode',   src: '../assets/sprites/geometric_core_geode_flux.png' },
  { name: 'Kraken',  src: '../assets/sprites/kraken_game_render.png' },
  { name: 'Aku',     src: '../assets/sprites/aku_aku_mask_stylized.png' },
  { name: 'Defender', src: '../assets/sprites/armored_defender_sprite_sheet.png' },
  { name: 'Ship',    src: '../assets/sprites/void_runner_ship.png' },
  { name: 'Grief',   src: '../assets/sprites/grief_warrior_sprite_sheet.png' },
  { name: 'Fighter', src: '../assets/sprites/dim_mak_fighter_full_sheet.png' },
  // Animation frames as boulder shapes
  { name: 'Mecha Idle',  src: '../assets/sprites/generated/mecha_idle_1.png' },
  { name: 'Aku Attack',  src: '../assets/sprites/generated/aku_attack_1.png' },
  { name: 'Kraken Walk', src: '../assets/sprites/generated/kraken_walk_1.png' },
  { name: 'Defender Jump', src: '../assets/sprites/generated/defender_jump_1.png' },
];

let currentSpriteIdx = 0;
const spriteImages = [];
let spritesLoaded = 0;

const sTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, sTex);
// Placeholder until first sprite loads
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,255,200,255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function uploadSprite(img) {
  const tmp = document.createElement('canvas');
  tmp.width = SS; tmp.height = SS;
  const tx = tmp.getContext('2d');
  // For sprite sheets, take just the first frame (top-left square)
  const srcSize = Math.min(img.width, img.height);
  tx.drawImage(img, 0, 0, srcSize, srcSize, 0, 0, SS, SS);
  const d = tx.getImageData(0, 0, SS, SS);
  gl.bindTexture(gl.TEXTURE_2D, sTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SS, SS, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(d.data.buffer));
}

function selectSprite(idx) {
  currentSpriteIdx = idx;
  if (spriteImages[idx] && spriteImages[idx].complete && spriteImages[idx].naturalWidth > 0) {
    uploadSprite(spriteImages[idx]);
  }
  // Update selector UI
  document.querySelectorAll('.sprite-btn').forEach((b, i) => {
    b.style.borderColor = i === idx ? '#00ffd2' : 'rgba(0,255,210,.12)';
  });
}

// Load all sprites
SPRITE_LIB.forEach((s, i) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    spritesLoaded++;
    if (i === 0) uploadSprite(img); // First one becomes active
    document.getElementById('info').innerHTML =
      `<div style="color:#00ffd2;font-size:11px;letter-spacing:.15em;margin-bottom:6px">BOULDER BUILDER</div>` +
      `SPRITES: ${spritesLoaded}/${SPRITE_LIB.length}<br>` +
      `WASD MOVE · CLICK PLACE<br>RIGHT-CLICK REMOVE<br>` +
      `F/V: PREV/NEXT SHAPE<br>` +
      `1-6: BIOME · Q/E: ROTATE<br>` +
      `SCROLL: SIZE · TAB: GRID`;
  };
  img.onerror = () => { spritesLoaded++; };
  img.src = s.src;
  spriteImages[i] = img;
});

// Build sprite selector in toolbar
const toolbar = document.getElementById('toolbar');
SPRITE_LIB.forEach((s, i) => {
  const btn = document.createElement('div');
  btn.className = 'tool sprite-btn';
  btn.title = s.name;
  btn.style.fontSize = '8px';
  btn.style.letterSpacing = '.08em';
  btn.style.textAlign = 'center';
  btn.style.lineHeight = '1.2';
  btn.style.padding = '4px';
  btn.textContent = s.name.split(' ')[0].substring(0, 5).toUpperCase();
  if (i === 0) btn.style.borderColor = '#00ffd2';
  btn.onclick = () => selectSprite(i);
  toolbar.appendChild(btn);
});

// ── World state ──
const MAX_BOULDERS = 64;
let boulders = []; // {x, y, z, scale, rotY, biome}
let showGrid = true;
let placeDist = 4;
let placeScale = 0.5;
let placeRotY = 0;

// Player state (FPS camera)
let px = 0, py = 1.5, pz = 5;
let yaw = -Math.PI/2, pitch = 0;
let vx = 0, vy = 0, vz = 0;
const keys = {};
let locked = false;

// ── Shader — raymarches ALL boulders as cross-section SDFs ──
const VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

// Build the fragment shader with boulder array
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec3 uEye;
uniform float uYaw,uPitch,uTime;
uniform sampler2D uSprite;
uniform int uCount;
uniform vec4 uBoulders[${MAX_BOULDERS}];   // xyz=pos, w=scale
uniform vec4 uBoulderRot[${MAX_BOULDERS}]; // x=rotY, yzw=biome index (packed)
uniform vec3 uBiomeA[6],uBiomeB[6],uBiomeC[6],uBiomeD[6];
uniform int uShowGrid;
uniform vec3 uGhost; // ghost boulder preview position
uniform float uGhostScale,uGhostRot;
uniform int uGhostBiome,uShowGhost;
in vec2 uv;out vec4 O;

const int STEPS=80;
const float FAR=40.,EPS=.002;

float sprH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  return texture(uSprite,st).a*.8;
}

// Cross-section SDF for a single boulder at origin
float boulderSDF(vec3 p){
  float h1=sprH(p.xy),h2=sprH(p.xz);
  return max(abs(p.z)-h1*.3,abs(p.y)-h2*.3);
}

// Rotate around Y
vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}

// Scene SDF — all boulders + ground plane
float sceneSDF(vec3 p,out int hitID){
  // Ground plane
  float d=p.y;
  hitID=-1;

  // Boulders
  for(int i=0;i<${MAX_BOULDERS};i++){
    if(i>=uCount)break;
    vec3 bp=p-uBoulders[i].xyz;
    float s=uBoulders[i].w;
    bp=rotY(bp,uBoulderRot[i].x)/s;
    float bd=boulderSDF(bp)*s;
    if(bd<d){d=bd;hitID=i;}
  }

  // Ghost preview
  if(uShowGhost>0){
    vec3 gp=p-uGhost;
    gp=rotY(gp,uGhostRot)/uGhostScale;
    float gd=boulderSDF(gp)*uGhostScale;
    if(gd<d){d=gd;hitID=-2;}
  }

  return d;
}

vec3 calcN(vec3 p){
  int dummy;
  const float h=.002;const vec2 k=vec2(1.,-1.);
  return normalize(
    k.xyy*sceneSDF(p+k.xyy*h,dummy)+k.yyx*sceneSDF(p+k.yyx*h,dummy)+
    k.yxy*sceneSDF(p+k.yxy*h,dummy)+k.xxx*sceneSDF(p+k.xxx*h,dummy));
}

float calcAO(vec3 p,vec3 n){
  int dummy;float o=0.,s=1.;
  for(int i=0;i<4;i++){float h=.03+.12*float(i);o+=(h-sceneSDF(p+n*h,dummy))*s;s*=.6;}
  return clamp(1.-2.5*o,0.,1.);
}

vec3 orbitPal(vec3 a,vec3 b,vec3 c,vec3 d,float t1,float t2,float ti){
  vec3 col=mix(a,b,clamp(t1*3.,0.,1.));
  col=mix(col,c,clamp(t2*5.,0.,1.)*.42);
  return mix(col,d,ti*.22);
}

void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  float cy=cos(uPitch),sy=sin(uPitch),cw=cos(uYaw),sw=sin(uYaw);
  vec3 fwd=vec3(cw*cy,sy,sw*cy);
  vec3 rt=normalize(cross(fwd,vec3(0,1,0)));
  vec3 up=cross(rt,fwd);
  vec3 rd=normalize(fc.x*rt+fc.y*up+1.5*fwd);

  // Sky
  float skyT=max(rd.y,0.);
  vec3 col=mix(vec3(.02,.03,.06),vec3(.04,.06,.14),skyT);
  // Stars
  vec2 seed=floor(gl_FragCoord.xy/2.);
  float hn=fract(sin(dot(seed,vec2(127.1,311.7)))*43758.5);
  if(hn>.997&&rd.y>0.)col+=vec3(.3,.4,.6)*fract(sin(dot(seed,vec2(269.5,183.3)))*43758.5);

  float t=0.;int hitID;
  for(int i=0;i<STEPS;i++){
    vec3 p=uEye+rd*t;
    float d=sceneSDF(p,hitID);
    if(d<EPS){
      vec3 n=calcN(p);float ao=calcAO(p,n);
      vec3 ld=normalize(vec3(.5,.7,-.3));
      float diff=max(dot(n,ld),0.);
      float spec=pow(max(dot(reflect(-ld,n),-rd),0.),48.);

      vec3 baseCol;
      if(hitID==-1){
        // Ground — carved stone floor
        float stoneN=fract(sin(dot(floor(p.xz*4.),vec2(127.1,311.7)))*43758.5)*.06;
        vec2 tile=fract(p.xz)-.5;
        float tileLine=smoothstep(.46,.49,max(abs(tile.x),abs(tile.y)))*.08;
        float mortar=smoothstep(.49,.50,max(abs(tile.x),abs(tile.y)));
        baseCol=vec3(.12,.13,.11)+stoneN+tileLine*vec3(.04,.06,.05);
        baseCol=mix(baseCol,vec3(.05,.06,.05),mortar*.6);
        float grid=0.;
        if(uShowGrid>0){
          vec2 gg=fract(p.xz)-.5;
          grid=smoothstep(.48,.5,max(abs(gg.x),abs(gg.y)))*.12;
        }
        baseCol+=grid*vec3(0,.7,.5);
      } else {
        // Boulder — use its biome palette with orbit traps
        int bi;
        if(hitID==-2) bi=uGhostBiome; // ghost
        else bi=int(uBoulderRot[hitID].y);
        bi=clamp(bi,0,5);

        float trap1=length(p.xy-uEye.xy)*.3;
        float trap2=abs(p.z-uEye.z)*.4;
        float trapI=fract(length(p)*2.)*.7;
        baseCol=orbitPal(uBiomeA[bi],uBiomeB[bi],uBiomeC[bi],uBiomeD[bi],trap1,trap2,trapI);

        // Detail from sprite
        vec3 lp=hitID==-2?p-uGhost:p-uBoulders[hitID].xyz;
        float sc=hitID==-2?uGhostScale:uBoulders[hitID].w;
        float ry=hitID==-2?uGhostRot:uBoulderRot[hitID].x;
        lp=rotY(lp,ry)/sc;
        vec2 tc=lp.xy*.5+.5;
        float detail=texture(uSprite,clamp(tc,0.,1.)).a;
        baseCol*=(.7+detail*.4);
      }

      // Ghost transparency
      float alpha=1.;
      if(hitID==-2)alpha=.5+.2*sin(uTime*4.);

      col=baseCol*(.1+diff*.8)*ao*alpha;
      col+=vec3(1.,.95,.85)*spec*.8*ao*alpha;
      // Fog
      col=mix(vec3(.02,.03,.06),col,exp(-max(t-15.,0.)*.06));
      break;
    }
    t+=d;
    if(t>FAR)break;
  }

  // ── POST-PROCESSING (in-shader for single-pass performance) ──

  // 1. Enhanced AO — darken crevices, contact shadows
  if(hitID>=0 || hitID==-2){
    // Extra ground-contact darkening
    vec3 hitPos=uEye+rd*t;
    float groundProx=exp(-hitPos.y*3.);
    col*=1.-groundProx*.25;
    // Edge darkening for carved stone feel
    vec3 n2=calcN(hitPos);
    float edgeDark=1.-pow(abs(dot(n2,-rd)),.6);
    col*=1.-edgeDark*.15;
  }

  // 2. Atmospheric fog — blue-grey haze like the temple scenes
  vec3 fogCol=mix(vec3(.12,.14,.18),vec3(.06,.08,.14),max(rd.y,0.));
  float fogAmt=1.-exp(-max(t-3.,0.)*.04);
  col=mix(col,fogCol,fogAmt);

  // 3. Subsurface scatter hint — warm light bleeding through thin geometry
  if(hitID>=0){
    vec3 hitPos2=uEye+rd*t;
    vec3 n3=calcN(hitPos2);
    vec3 sunDir=normalize(vec3(.5,.7,-.3));
    float sss=pow(clamp(dot(rd,sunDir),0.,1.),3.)*.12;
    col+=vec3(.95,.75,.55)*sss;
  }

  // 4. Sky upgrade — gradient with subtle scatter, not flat blue
  if(t>=FAR){
    float skyY=max(rd.y,0.);
    vec3 skyLow=vec3(.15,.18,.28);  // blue-grey horizon
    vec3 skyMid=vec3(.22,.30,.52);  // deeper blue
    vec3 skyHigh=vec3(.06,.08,.18); // dark zenith
    col=mix(skyLow,skyMid,smoothstep(0.,.3,skyY));
    col=mix(col,skyHigh,smoothstep(.3,.8,skyY));
    // Sun glow
    vec3 sunDir2=normalize(vec3(.4,.3,-.6));
    float sunDot=max(dot(rd,sunDir2),0.);
    col+=vec3(.9,.7,.5)*pow(sunDot,32.)*.4;
    col+=vec3(.6,.5,.4)*pow(sunDot,4.)*.08;
    // Stars only at high elevation
    if(skyY>.2){
      vec2 seed2=floor(gl_FragCoord.xy/1.5);
      float star2=fract(sin(dot(seed2,vec2(127.1,311.7)))*43758.5);
      if(star2>.998)col+=vec3(.5,.6,.8)*fract(sin(dot(seed2,vec2(269.5,183.3)))*43758.5)*.6;
    }
  }

  // 5. Color grading — push toward the temple blue-grey + warm highlights
  // Lift shadows slightly blue, push highlights warm
  float lum=dot(col,vec3(.2126,.7152,.0722));
  vec3 shadows=vec3(.08,.10,.16);  // blue-grey shadows
  vec3 highlights=vec3(1.,.92,.82); // warm highlights
  col=mix(col,shadows,max(0.,.15-lum)/.15*.3);
  col=mix(col,col*highlights,clamp(lum-.5,0.,.5)*1.);

  // 6. Bloom simulation — bright pixels glow
  float brightness=max(col.r,max(col.g,col.b));
  if(brightness>.65){
    float bloomAmt=(brightness-.65)/.35;
    col+=col*bloomAmt*.2;
  }

  // 7. ACES tonemap
  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
  // Gamma
  col=pow(col,vec3(1./2.2));

  // 8. Vignette — heavier than before, cinematic
  float vig=pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.18);
  col*=.4+.6*vig;

  // 9. Subtle film grain — the happy little mistake
  float grain=fract(sin(dot(gl_FragCoord.xy+uTime*100.,vec2(12.9898,78.233)))*43758.5);
  col+=vec3((grain-.5)*.02);

  O=vec4(col,1.);
}`;

function mkS(src, type) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, mkS(VS, gl.VERTEX_SHADER));
gl.attachShader(prog, mkS(FS, gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
const aLoc = gl.getAttribLocation(prog, 'a');
gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);

// Uniforms
const U = {};
['uRes','uEye','uYaw','uPitch','uTime','uCount','uShowGrid',
 'uGhost','uGhostScale','uGhostRot','uGhostBiome','uShowGhost','uSprite'].forEach(n =>
  U[n] = gl.getUniformLocation(prog, n));

// Boulder arrays
const uBoulders = gl.getUniformLocation(prog, 'uBoulders');
const uBoulderRot = gl.getUniformLocation(prog, 'uBoulderRot');

// Upload biome palettes
for (let i = 0; i < 6; i++) {
  gl.uniform3fv(gl.getUniformLocation(prog, `uBiomeA[${i}]`), BIOMES[i].a);
  gl.uniform3fv(gl.getUniformLocation(prog, `uBiomeB[${i}]`), BIOMES[i].b);
  gl.uniform3fv(gl.getUniformLocation(prog, `uBiomeC[${i}]`), BIOMES[i].c);
  gl.uniform3fv(gl.getUniformLocation(prog, `uBiomeD[${i}]`), BIOMES[i].d);
}

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, sTex);
gl.uniform1i(U.uSprite, 0);

// ── Input ──
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Tab') { e.preventDefault(); showGrid = !showGrid; } });
addEventListener('keyup', e => keys[e.code] = false);
document.addEventListener('pointerlockchange', () => { locked = !!document.pointerLockElement; });
glC.addEventListener('click', () => {
  if (!locked) { document.body.requestPointerLock(); return; }
  placeBoulder();
});
glC.addEventListener('contextmenu', e => { e.preventDefault(); if (locked) removeBoulder(); });
addEventListener('mousemove', e => {
  if (!locked) return;
  yaw += e.movementX * .002;
  pitch = Math.max(-1.4, Math.min(1.4, pitch - e.movementY * .002));
});
addEventListener('wheel', e => {
  placeScale = Math.max(.2, Math.min(2, placeScale + e.deltaY * -.001));
  e.preventDefault();
}, {passive: false});

// Biome hotkeys
addEventListener('keydown', e => {
  const n = parseInt(e.key);
  if (n >= 1 && n <= 6) {
    currentBiome = n - 1;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.swatch')[currentBiome].classList.add('active');
  }
  if (e.code === 'KeyQ') placeRotY -= Math.PI / 8;
  if (e.code === 'KeyE') placeRotY += Math.PI / 8;
  if (e.code === 'KeyF') selectSprite((currentSpriteIdx + 1) % SPRITE_LIB.length);
  if (e.code === 'KeyV') selectSprite((currentSpriteIdx - 1 + SPRITE_LIB.length) % SPRITE_LIB.length);
});

// ── Boulder placement ──
function getGhostPos() {
  const fwd = [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)];
  return [px + fwd[0] * placeDist, py + fwd[1] * placeDist, pz + fwd[2] * placeDist];
}

function placeBoulder() {
  if (boulders.length >= MAX_BOULDERS) return;
  const [gx, gy, gz] = getGhostPos();
  // Snap to grid if enabled
  const sx = showGrid ? Math.round(gx * 2) / 2 : gx;
  const sy = showGrid ? Math.max(0, Math.round(gy * 2) / 2) : Math.max(0, gy);
  const sz = showGrid ? Math.round(gz * 2) / 2 : gz;
  boulders.push({ x: sx, y: sy, z: sz, scale: placeScale, rotY: placeRotY, biome: currentBiome });
}

function removeBoulder() {
  // Remove the boulder closest to where we're looking
  const [gx, gy, gz] = getGhostPos();
  let closest = -1, closestD = 2;
  for (let i = 0; i < boulders.length; i++) {
    const b = boulders[i];
    const d = Math.sqrt((b.x-gx)**2 + (b.y-gy)**2 + (b.z-gz)**2);
    if (d < closestD) { closestD = d; closest = i; }
  }
  if (closest >= 0) boulders.splice(closest, 1);
}

// ── Physics ──
function updatePlayer(dt) {
  const speed = keys.ShiftLeft ? 8 : 4;
  const fwd = [Math.cos(yaw), 0, Math.sin(yaw)];
  const right = [-fwd[2], 0, fwd[0]];

  if (keys.KeyW) { vx += fwd[0] * speed * dt; vz += fwd[2] * speed * dt; }
  if (keys.KeyS) { vx -= fwd[0] * speed * dt; vz -= fwd[2] * speed * dt; }
  if (keys.KeyA) { vx -= right[0] * speed * dt; vz -= right[2] * speed * dt; }
  if (keys.KeyD) { vx += right[0] * speed * dt; vz += right[2] * speed * dt; }
  if (keys.Space) py += 3 * dt;
  if (keys.KeyC) py -= 3 * dt;

  px += vx; pz += vz;
  vx *= .85; vz *= .85;
  py = Math.max(.5, py);
}

// ── Upload boulders to GPU ──
function uploadBoulders() {
  const posData = new Float32Array(MAX_BOULDERS * 4);
  const rotData = new Float32Array(MAX_BOULDERS * 4);
  for (let i = 0; i < boulders.length; i++) {
    const b = boulders[i];
    posData[i*4] = b.x; posData[i*4+1] = b.y; posData[i*4+2] = b.z; posData[i*4+3] = b.scale;
    rotData[i*4] = b.rotY; rotData[i*4+1] = b.biome; rotData[i*4+2] = 0; rotData[i*4+3] = 0;
  }
  gl.uniform4fv(uBoulders, posData);
  gl.uniform4fv(uBoulderRot, rotData);
  gl.uniform1i(U.uCount, boulders.length);
}

// ── Render ──
function render(t) {
  t *= .001;
  const dt = 1/60;
  if (locked) updatePlayer(dt);
  resize();

  gl.useProgram(prog);
  gl.uniform2f(U.uRes, W, H);
  gl.uniform3f(U.uEye, px, py, pz);
  gl.uniform1f(U.uYaw, yaw);
  gl.uniform1f(U.uPitch, pitch);
  gl.uniform1f(U.uTime, t);
  gl.uniform1i(U.uShowGrid, showGrid ? 1 : 0);

  // Ghost preview
  if (locked) {
    const [gx, gy, gz] = getGhostPos();
    const sx = showGrid ? Math.round(gx * 2) / 2 : gx;
    const sy = showGrid ? Math.max(0, Math.round(gy * 2) / 2) : Math.max(0, gy);
    const sz = showGrid ? Math.round(gz * 2) / 2 : gz;
    gl.uniform3f(U.uGhost, sx, sy, sz);
    gl.uniform1f(U.uGhostScale, placeScale);
    gl.uniform1f(U.uGhostRot, placeRotY);
    gl.uniform1i(U.uGhostBiome, currentBiome);
    gl.uniform1i(U.uShowGhost, 1);
  } else {
    gl.uniform1i(U.uShowGhost, 0);
  }

  uploadBoulders();
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // UI overlay
  ox.clearRect(0, 0, W, H);
  document.getElementById('stats').innerHTML =
    `BOULDERS: ${boulders.length}/${MAX_BOULDERS}<br>` +
    `SHAPE: ${SPRITE_LIB[currentSpriteIdx].name}<br>` +
    `SIZE: ${placeScale.toFixed(2)}<br>` +
    `BIOME: ${BIOMES[currentBiome].name}<br>` +
    `GRID: ${showGrid ? 'ON' : 'OFF'}`;

  if (!locked) {
    ox.fillStyle = 'rgba(0,8,18,.6)';
    ox.fillRect(0, 0, W, H);
    ox.fillStyle = '#00ffd2';
    ox.font = '14px "Courier New"';
    ox.textAlign = 'center';
    ox.fillText('CLICK TO BUILD', W/2, H/2);
    ox.font = '10px "Courier New"';
    ox.fillStyle = 'rgba(0,255,210,.4)';
    ox.fillText('WASD move · Mouse look · Click place · Right-click remove', W/2, H/2 + 30);
  }

  requestAnimationFrame(render);
}

// Drop sprite loading (also supports custom images on top of built-in library)
glC.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
glC.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const img = new Image();
  img.onload = () => { uploadSprite(img); };
  img.src = URL.createObjectURL(file);
});

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
  wn.textContent = 'PINK HOUR';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7201324973590235;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.015593672370270829;mix-blend-mode:overlay';
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
