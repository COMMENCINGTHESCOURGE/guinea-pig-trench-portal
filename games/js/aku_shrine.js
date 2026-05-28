const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'high-performance'});
if(!gl){document.body.innerHTML='<p style="color:red;padding:40px">WebGL2 required</p>';throw 0}

let W, H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;gl.viewport(0,0,W,H)}
resize();addEventListener('resize',resize);

// ══════════════════════════════════════════════════════════
// v7.1 [RESONANT_AKU] - THE STONE GOD NODE
// Logic: Orbit Trap Torsion + Residue Attractors
// ══════════════════════════════════════════════════════════

const akuImg = new Image();
akuImg.crossOrigin = 'anonymous';
akuImg.src = '../assets/sprites/aku_aku_mask_stylized.png';
const akuTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, akuTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,180,160,255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
akuImg.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, akuTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, akuImg);
};

const VS = `#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTorsion; // v7.1: Live Torsion
uniform sampler2D uAku;
in vec2 uv;out vec4 O;

const int STEPS=100;
const float FAR=30.,EPS=.002;

float akuH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  vec4 c=texture(uAku,st);
  return (c.r*.3+c.g*.5+c.b*.2)*c.a;
}

// ── Orbit Trap Torsion ──
vec3 trap(vec3 p){
  float t = uTorsion * 0.05;
  float s = sin(p.y * 2.0 + uTime);
  p.xz *= mat2(cos(t+s), -sin(t+s), sin(t+s), cos(t+s));
  return p;
}

float sdfAkuMask(vec3 p){
  p = trap(p);
  vec3 mp = p; mp.y -= 1.8; mp *= 1.3;
  float breath = 1.0 + sin(uTime * 1.2 + uTorsion)*0.02;
  mp.xz /= breath;
  float h1 = akuH(mp.xy);
  float h2 = akuH(mp.xz);
  return max(abs(mp.z) - h1 * .35, abs(mp.y - .1) - h2 * .35) + sin(mp.x*15.)*sin(mp.y*15.)*.005;
}

float sdfTentacle(vec3 p, float phase, float side){
  vec3 q = p; q.x -= side * 1.1; q.z -= 0.2;
  float t = uTime * 1.2 + phase + uTorsion*0.1;
  q.x += sin(q.y * 2.0 - t) * 0.25 * smoothstep(0., 2., q.y);
  q.z += cos(q.y * 1.5 - t * 0.8) * 0.25 * smoothstep(0., 2., q.y);
  q.y -= 1.3;
  return length(q.xz) - (0.07 - q.y*0.02) - 0.02;
}

float scene(vec3 p, out int matID){
  float d = p.y + .5; matID = 0;
  float aku = sdfAkuMask(p); if(aku < d){ d = aku; matID = 1; }
  for(int i = 0; i < 3; i++){
    float phase = float(i) * 2.1;
    float tL = sdfTentacle(p, phase, -1.);
    float tR = sdfTentacle(p, phase + 1.05, 1.);
    if(tL < d){ d = tL; matID = 2; }
    if(tR < d){ d = tR; matID = 2; }
  }
  return d;
}

vec3 calcN(vec3 p){int dummy;const float h=.002;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*scene(p+k.xyy*h,dummy)+k.yyx*scene(p+k.yyx*h,dummy)+
    k.yxy*scene(p+k.yxy*h,dummy)+k.xxx*scene(p+k.xxx*h,dummy));}

void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  float ct = uTime * .15 + uTorsion * 0.01;
  vec3 eye = vec3(sin(ct)*6., 2.2 + sin(uTime*.2)*.3, cos(ct)*6.);
  vec3 ta = vec3(0., 1.5, 0.);
  vec3 fwd = normalize(ta - eye);
  vec3 rt = normalize(cross(fwd, vec3(0,1,0)));
  vec3 up = cross(rt, fwd);
  vec3 rd = normalize(fc.x*rt + fc.y*up + 1.6*fwd);

  vec3 col = mix(vec3(.02,.03,.05), vec3(.01,.015,.03), max(rd.y,0.));
  float t = 0.; int matID;
  for(int i = 0; i < 100; i++){
    vec3 p = eye + rd * t;
    float d = scene(p, matID);
    if(d < EPS){
      vec3 n = calcN(p);
      // v7.1: Residue Attractor Colors (1=Amber, 5=Cyan, 17=Purple)
      vec3 attractorCol = vec3(0.5) + 0.5*cos(uTorsion + vec3(0,2,4));
      float diff = max(dot(n, normalize(vec3(.5,1,.3))), 0.1);
      col = attractorCol * diff * (1.0 - t/FAR);
      break;
    }
    t += d; if(t > FAR) break;
  }

  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14), 0., 1.);
  col=pow(col, vec3(1./2.2));
  O = vec4(col, 1.);
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
  torsionVal = 0.5 + 0.5 * Math.sin(t * 0.5);
  if(Math.random() > 0.99) torsionVal *= 200.0; // Singularity Spike

  gl.uniform2f(uRes,W,H);
  gl.uniform1f(uTime,t);
  gl.uniform1f(uTorsion, torsionVal);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  
  const hbEl = document.getElementById('heartbeat');
  if(hbEl) hbEl.textContent = `AKU_RESONANCE: ${torsionVal.toFixed(2)} | NODE: ${Math.floor(t % 72)}`;
  
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
