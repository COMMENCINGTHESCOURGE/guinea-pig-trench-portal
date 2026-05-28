const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
if(!gl){document.body.innerHTML='<p style="color:red;padding:40px">WebGL2 required</p>';throw 0}

let W,H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;gl.viewport(0,0,W,H)}
resize();addEventListener('resize',resize);

// ══════════════════════════════════════════════════════════
// v7.1 [RESONANT_THRESHOLD] - THE FLAGSHIP NODE
// Logic: Erdős Torsion + Mycelial Raymarching
// ══════════════════════════════════════════════════════════

const spriteNames = ['aku_aku_mask_stylized','mecha_entity_alpha_v2_pixel','geometric_core_geode_flux'];
const spriteTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, spriteTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,200,180,255]));
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);

let currentSprite = 0;
const spriteImgs = [];
spriteNames.forEach((name,i) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = `../assets/sprites/${name}.png`;
  img.onload = () => { if(i === 0) { gl.bindTexture(gl.TEXTURE_2D, spriteTex); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img); } };
  spriteImgs[i] = img;
});

function switchSprite(idx){
  if(!spriteImgs[idx] || !spriteImgs[idx].complete) return;
  gl.bindTexture(gl.TEXTURE_2D, spriteTex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,spriteImgs[idx]);
  currentSprite = idx;
}

const VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTorsion; // v7.1: Live Torsion Resonance
uniform sampler2D uSprite;
in vec2 uv;out vec4 O;

const int STEPS=100;
const float FAR=60.,EPS=.002;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}

// ── Erdős-Torsion Distortion ──
// Warps space based on the v103 deep residue findings
vec3 warp(vec3 p){
  float t = uTorsion * 0.1;
  p.x += sin(p.z * 0.5 + uTime) * t;
  p.y += cos(p.x * 0.5 + uTime) * t;
  return p;
}

float sprH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  vec4 c=texture(uSprite,st);
  return (c.r*.3+c.g*.5+c.b*.2)*c.a;
}

float worldPhase(){return mod(uTime*.08,5.);}

// ── v7.1 Mycelial SDFs ──

float sdfPinkHour(vec3 p){
  p = warp(p);
  float ground = p.y + 1. + noise(p.xz * 0.5) * 0.2;
  vec2 gp = mod(p.xz + 2., 4.) - 2.;
  float pillar = length(gp) - .1 - .05*sin(uTime*2.+p.x+p.z);
  pillar = max(pillar, abs(p.y - 1.) - 2.);
  return min(ground, pillar);
}

float sdfBlock(vec3 p){
  p = warp(p);
  float ground = p.y + 1.;
  vec2 bp = mod(p.xz + 3., 6.) - 3.;
  float building = max(max(abs(bp.x)-1.,abs(bp.y)-1.), -(p.y - 2. - hash(floor((p.xz+3.)/6.))*3.));
  float street = min(abs(bp.x)-.4, abs(bp.y)-.4);
  return min(ground, max(building, -street));
}

float sdfThreshold(vec3 p){
  float ground = p.y + 1.;
  vec3 mp = p; mp.y -= 1.5; mp *= 1.2;
  float breath = 1. + sin(uTime*1.2 + uTorsion)*.02;
  mp.xz /= breath;
  float h1=sprH(mp.xy),h2=sprH(mp.xz);
  float mask = max(abs(mp.z)-h1*.35, abs(mp.y-.1)-h2*.35);
  return min(ground, mask);
}

float sdfVault(vec3 p){
  p = warp(p);
  float walls = -max(abs(p.x)-2., abs(p.z)-8.);
  walls = max(walls, -(abs(p.y)-2.));
  float ground = p.y + 1.5;
  return max(min(ground, -walls), -(length(p.xz)-1.5));
}

float sdfBetween(vec3 p){
  // v7.1: Mycelial Void Geometry
  float d = 999.;
  for(int i=0;i<8;i++){
    float fi = float(i);
    vec3 center = vec3(sin(fi+uTime*.3)*4., cos(fi*1.4+uTime*.2)*3., sin(fi*2.1+uTime*.4)*4.);
    d = min(d, length(p-center) - 0.4 - uTorsion*0.05);
  }
  return max(-d, length(p) - 10.);
}

float scene(vec3 p, out int worldID){
  float phase = worldPhase();
  int w = int(floor(phase));
  worldID = w;
  if(w==0) return sdfPinkHour(p);
  if(w==1) return sdfBlock(p);
  if(w==2) return sdfThreshold(p);
  if(w==3) return sdfVault(p);
  return sdfBetween(p);
}

vec3 calcN(vec3 p){int dummy;const float h=.003;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*scene(p+k.xyy*h,dummy)+k.yyx*scene(p+k.yyx*h,dummy)+
    k.yxy*scene(p+k.yxy*h,dummy)+k.xxx*scene(p+k.xxx*h,dummy));}

vec3 worldFog(int w){
  if(w==0) return vec3(.15,.05,.12);
  if(w==1) return vec3(.02,.04,.08);
  if(w==2) return vec3(.02,.05,.06);
  if(w==3) return vec3(.04,.03,.01);
  return vec3(.01,.01,.03);
}

void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  float phase = worldPhase();
  int worldIdx = int(floor(phase));
  
  // v7.1: High-G Camera Orbit
  float orbit = uTime * .15 + uTorsion * 0.01;
  vec3 eye = vec3(sin(orbit)*8., 3. + sin(uTime*.2)*2., cos(orbit)*8.);
  vec3 ta = vec3(0., 1., 0.);
  
  vec3 fwd = normalize(ta-eye);
  vec3 rt = normalize(cross(fwd,vec3(0,1,0)));
  vec3 up = cross(rt,fwd);
  vec3 rd = normalize(fc.x*rt+fc.y*up+1.5*fwd);

  vec3 fogCol = worldFog(worldIdx);
  vec3 col = fogCol;

  float t=0.;int hitWorld;
  for(int i=0;i<STEPS;i++){
    vec3 p=eye+rd*t;
    float d=scene(p,hitWorld);
    if(d<EPS){
      vec3 n=calcN(p);
      float diff = max(dot(n,normalize(vec3(.5,.7,-.3))),0.1);
      vec3 baseCol = vec3(0.5) + 0.5*cos(uTime+vec3(0,2,4) + float(hitWorld));
      col = baseCol * diff;
      float fogAmt = 1.-exp(-t*0.05);
      col = mix(col, fogCol, fogAmt);
      break;
    }
    t+=d;if(t>FAR)break;
  }

  // ACES + Post
  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
  col=pow(col,vec3(1./2.2));
  O=vec4(col,1.);
}`;

function mkS(src,type){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}return s}
const prog=gl.createProgram();
gl.attachShader(prog,mkS(VS,gl.VERTEX_SHADER));
gl.attachShader(prog,mkS(FS,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);gl.useProgram(prog);

const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const aLoc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);

const uRes=gl.getUniformLocation(prog,'uRes');
const uTime=gl.getUniformLocation(prog,'uTime');
const uTorsion=gl.getUniformLocation(prog,'uTorsion');

let torsionVal = 0;
function render(t){
  t*=.001;resize();
  // v7.1: Simulate Torsion Resonance from the v103 Data
  torsionVal = 0.5 + 0.5 * Math.sin(t * 0.7); 
  if(Math.random() > 0.98) torsionVal *= 150.0; // Random Singularity Spike
  
  gl.uniform2f(uRes,W,H);
  gl.uniform1f(uTime,t);
  gl.uniform1f(uTorsion, torsionVal);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  
  const hbEl = document.getElementById('heartbeat');
  if(hbEl) hbEl.textContent = `TORSION: ${torsionVal.toFixed(2)} | RESIDUE: ${Math.floor(t % 24)}`;
  
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
