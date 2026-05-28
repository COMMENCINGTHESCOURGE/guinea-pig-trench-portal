
// ─── Biome Presets (from chord-synesthesia research) ──────────
const PRESETS = [
  {name:'Underwater',  a:'#0A70EB',b:'#1A0850',c:'#20D0C0',d:'#060830', power:8},
  {name:'Dark Forest', a:'#00C8B4',b:'#1A3020',c:'#40A060',d:'#0A2018', power:7},
  {name:'Winter',      a:'#6496FF',b:'#C0D8FF',c:'#FFFFFF',d:'#304060', power:8},
  {name:'Volcanic',    a:'#961E1E',b:'#FF7820',c:'#FFD040',d:'#301008', power:9},
  {name:'Pink Leaf',   a:'#FF96C8',b:'#C83078',c:'#FFD0E0',d:'#601840', power:6},
  {name:'Vampire',     a:'#6414A0',b:'#200830',c:'#B040FF',d:'#0A0418', power:10},
  {name:'Radiant Void',a:'#FFFFFF',b:'#C0C0D0',c:'#FFFFE0',d:'#808090', power:8},
  {name:'Cyberpunk',   a:'#00C8B4',b:'#ED1299',c:'#F5BA12',d:'#12E88A', power:8},
];

const presetBox = document.getElementById('presets');
PRESETS.forEach((p,i) => {
  const d = document.createElement('div');
  d.className = 'preset';
  d.style.background = p.a;
  d.title = p.name;
  d.onclick = () => applyPreset(i);
  presetBox.appendChild(d);
});

function hexToGL(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r,g,b];
}

function applyPreset(i) {
  const p = PRESETS[i];
  document.getElementById('col-a').value = p.a;
  document.getElementById('col-b').value = p.b;
  document.getElementById('col-c').value = p.c;
  document.getElementById('col-d').value = p.d;
  colA = hexToGL(p.a); colB = hexToGL(p.b);
  colC = hexToGL(p.c); colD = hexToGL(p.d);
  if (!document.getElementById('chk-anim').checked) {
    document.getElementById('sl-power').value = p.power * 100;
    document.getElementById('val-power').textContent = p.power.toFixed(2);
    power = p.power;
  }
}

// ─── State ────────────────────────────────────────────────────
let theta=.5, phi=.28, dist=3.2;
let autoRot=true, lastInt=0;
let power=8, animPower=false, animSpeed=.5;
let colA=hexToGL('#0A70EB'), colB=hexToGL('#ED1299');
let colC=hexToGL('#F5BA12'), colD=hexToGL('#12E88A');
let bloomIntensity=1.85, bloomThresh=.50, exposure=1.08, specPow=80;
let renderScale=.62;

// ─── UI Wiring ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function wireSlider(id, valId, getter, setter, format) {
  const sl = $(id), vl = $(valId);
  sl.oninput = () => { const v = setter(+sl.value); vl.textContent = format(v); };
}
wireSlider('sl-scale','val-scale', ()=>renderScale, v=>{renderScale=v/100;resize();return v}, v=>v+'%');
wireSlider('sl-power','val-power', ()=>power, v=>{power=v/100;return power}, v=>v.toFixed(2));
wireSlider('sl-aspeed','val-aspeed', ()=>animSpeed, v=>{animSpeed=v/100;return animSpeed}, v=>v.toFixed(2));
wireSlider('sl-bloom','val-bloom', ()=>bloomIntensity, v=>{bloomIntensity=v/100;return bloomIntensity}, v=>v.toFixed(2));
wireSlider('sl-thresh','val-thresh', ()=>bloomThresh, v=>{bloomThresh=v/100;return bloomThresh}, v=>v.toFixed(2));
wireSlider('sl-exposure','val-exposure', ()=>exposure, v=>{exposure=v/100;return exposure}, v=>v.toFixed(2));
wireSlider('sl-spec','val-spec', ()=>specPow, v=>{specPow=v;return v}, v=>v.toString());

$('chk-autorot').onchange = e => { autoRot = e.target.checked; };
$('chk-anim').onchange = e => { animPower = e.target.checked; };

['col-a','col-b','col-c','col-d'].forEach((id,i) => {
  $(id).oninput = e => {
    const c = hexToGL(e.target.value);
    if(i===0) colA=c; else if(i===1) colB=c; else if(i===2) colC=c; else colD=c;
  };
});

$('btn-reset').onclick = () => { theta=.5; phi=.28; dist=3.2; autoRot=true; $('chk-autorot').checked=true; };

// ─── Shaders ──────────────────────────────────────────────────
const canvas = $('c');
let gl = canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});
if (!gl) {
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (gl) {
    document.body.innerHTML='<p style="color:#f66;padding:40px">Your browser supports WebGL1 but this experience requires WebGL2.<br>Please use a recent version of Chrome, Firefox, or Edge.</p>';
  } else {
    document.body.innerHTML='<p style="color:#f66;padding:40px">WebGL is not supported by your browser.<br>Please use a recent version of Chrome, Firefox, or Edge.</p>';
  }
  throw 0;
}

const hdrExt=gl.getExtension('EXT_color_buffer_float');
const IFMT=hdrExt?gl.RGBA16F:gl.RGBA8, ITYP=hdrExt?gl.HALF_FLOAT:gl.UNSIGNED_BYTE;

const VS_SRC=`#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS_MARCH_SRC=`#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTheta,uPhi,uDist,uPower,uSpecPow;
uniform vec3 uColA,uColB,uColC,uColD;
in vec2 uv;out vec4 O;

const int FIT=10,RST=72;
const float EPS=.0003,BS=1.35;

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
  const float h=.0009;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*bulb(p+k.xyy*h).x+k.yyx*bulb(p+k.yyx*h).x+
    k.yxy*bulb(p+k.yxy*h).x+k.xxx*bulb(p+k.xxx*h).x);
}
float ao(vec3 p,vec3 n){
  float o=0.,s=1.;
  for(int i=0;i<5;i++){float h=.01+.18*float(i)/4.;o+=(h-bulb(p+h*n).x)*s;s*=.7;}
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

  vec2 seed=floor(gl_FragCoord.xy/2.);
  float hn=fract(sin(dot(seed,vec2(127.1,311.7)))*43758.5);
  float hb=fract(sin(dot(seed,vec2(269.5,183.3)))*43758.5);
  float star=step(.9968,hn)*hb*hb;
  float rad=length(fc);
  vec3 col=vec3(0.,.005,.016)+star*vec3(.55,.72,1.)*.55
    +vec3(.014,0.,.032)*exp(-rad*2.4)+vec3(0.,.006,.022)*exp(-rad*1.1);

  float b2=dot(ro,rd),disc=b2*b2-dot(ro,ro)+BS*BS;
  if(disc>=0.){
    float t=max(-b2-sqrt(disc),0.),tmax=-b2+sqrt(disc);
    bool hit=false;vec4 trap=vec4(0);
    for(int i=0;i<RST;i++){
      vec4 res=bulb(ro+rd*t);trap=res;
      if(res.x<EPS){hit=true;break;}
      if(t>=tmax)break;
      t+=res.x*.55;
    }
    if(hit){
      vec3 p=ro+rd*t;vec3 n=nrm(p);float occ=ao(p,n);
      vec3 L1=normalize(vec3(.7,.6,.4)),L2=normalize(vec3(-.5,.3,-.9));
      float d1=max(dot(n,L1),0.),d2=max(dot(n,L2),0.)*.35;
      vec3 H1=normalize(L1-rd);
      float sp=pow(max(dot(n,H1),0.),uSpecPow);
      float fr=pow(1.-max(dot(-rd,n),0.),4.);
      vec3 bc=pal(trap.y,trap.z,trap.w);
      col=bc*(d1*1.65+d2+.07)*occ;
      col+=vec3(1.,.93,.79)*sp*1.4*occ;
      col+=bc*fr*.38*occ;
      float sss=pow(clamp(dot(-rd,n)+.3,0.,1.),3.);
      col+=vec3(.95,.18,.04)*sss*.17*occ;
      col=mix(col,vec3(0.,.005,.016)*.15,1.-exp(-max(t-1.8,0.)*.3));
    }
  }
  col*=.48+.52*pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.11);
  O=vec4(col,1.);
}`;

const FS_EXT=`#version 300 es
precision mediump float;
uniform sampler2D uTex;uniform float uThresh;in vec2 uv;out vec4 O;
void main(){
  vec3 c=texture(uTex,uv).rgb;
  float l=dot(c,vec3(.2126,.7152,.0722));
  O=vec4(c*max(l-uThresh,0.)/max(l,.001)*2.8,1.);
}`;

const FS_BLUR=`#version 300 es
precision mediump float;
uniform sampler2D uTex;uniform vec2 uDir;in vec2 uv;out vec4 O;
const float W[5]=float[](.2270,.1945,.1216,.0540,.0162);
void main(){
  vec3 c=texture(uTex,uv).rgb*W[0];
  for(int i=1;i<5;i++){float f=float(i);
    c+=texture(uTex,uv+uDir*f).rgb*W[i];
    c+=texture(uTex,uv-uDir*f).rgb*W[i];}
  O=vec4(c,1.);
}`;

const FS_COMP=`#version 300 es
precision mediump float;
uniform sampler2D uScene,uBloom;uniform float uBloomMix,uExposure;
in vec2 uv;out vec4 O;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
  vec3 s=texture(uScene,uv).rgb;
  vec3 b=texture(uBloom,uv).rgb;
  vec3 col=aces((s+b*uBloomMix)*uExposure);
  O=vec4(pow(col,vec3(1./2.2)),1.);
}`;

function mkS(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));throw 0;}return s;}
function mkP(fs){const p=gl.createProgram();gl.attachShader(p,mkS(gl.VERTEX_SHADER,VS_SRC));
  gl.attachShader(p,mkS(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(p));throw 0;}return p;}

const pM=mkP(FS_MARCH_SRC),pE=mkP(FS_EXT),pB=mkP(FS_BLUR),pC=mkP(FS_COMP);

const qB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qB);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);

function mkV(p){const v=gl.createVertexArray();gl.bindVertexArray(v);gl.bindBuffer(gl.ARRAY_BUFFER,qB);
  const l=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(l);
  gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);return v;}
const vM=mkV(pM),vE=mkV(pE),vB=mkV(pB),vC=mkV(pC);
function q(v){gl.bindVertexArray(v);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
function u(p,n){return gl.getUniformLocation(p,n);}

let W,H,BW,BH,tS,tB0,tB1,fS,fB0,fB1;

function mkT(w,h){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,IFMT,w,h,0,gl.RGBA,ITYP,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
function mkF(t){const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return f;}

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;
  [tS,tB0,tB1].forEach(t=>{if(t)gl.deleteTexture(t);});
  [fS,fB0,fB1].forEach(f=>{if(f)gl.deleteFramebuffer(f);});
  W=Math.max(1,Math.floor(canvas.width*renderScale));
  H=Math.max(1,Math.floor(canvas.height*renderScale));
  BW=Math.max(1,W>>2);BH=Math.max(1,H>>2);
  tS=mkT(W,H);tB0=mkT(BW,BH);tB1=mkT(BW,BH);
  fS=mkF(tS);fB0=mkF(tB0);fB1=mkF(tB1);
}
addEventListener('resize',resize);resize();

// ─── Camera Controls ──────────────────────────────────────────
canvas.addEventListener('mousedown',e=>{
  if(e.target!==canvas)return;
  canvas.classList.add('drag');autoRot=false;$('chk-autorot').checked=false;lastInt=Date.now();
  const mv=e=>{theta-=e.movementX*.007;phi=Math.max(-1.38,Math.min(1.38,phi+e.movementY*.007));lastInt=Date.now();};
  const up=()=>{canvas.classList.remove('drag');removeEventListener('mousemove',mv);removeEventListener('mouseup',up);};
  addEventListener('mousemove',mv);addEventListener('mouseup',up);
});
canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(1.7,Math.min(8.,dist+e.deltaY*.005));
  autoRot=false;$('chk-autorot').checked=false;lastInt=Date.now();},{passive:false});
canvas.addEventListener('dblclick',()=>{theta=.5;phi=.28;dist=3.2;autoRot=true;$('chk-autorot').checked=true;});

let lTX=0,lTY=0,lPD=0;
canvas.addEventListener('touchstart',e=>{if(e.target!==canvas)return;e.preventDefault();
  if(e.touches.length===1){lTX=e.touches[0].clientX;lTY=e.touches[0].clientY;autoRot=false;}
  else if(e.touches.length===2)lPD=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:false});
canvas.addEventListener('touchmove',e=>{if(e.target!==canvas)return;e.preventDefault();
  if(e.touches.length===1){theta-=(e.touches[0].clientX-lTX)*.009;phi=Math.max(-1.38,Math.min(1.38,phi+(e.touches[0].clientY-lTY)*.009));lTX=e.touches[0].clientX;lTY=e.touches[0].clientY;}
  else if(e.touches.length===2){const pd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);dist=Math.max(1.7,Math.min(8.,dist*(lPD/pd)));lPD=pd;}},{passive:false});

// ─── Screenshot ───────────────────────────────────────────────
$('btn-screenshot').onclick = () => {
  const link = document.createElement('a');
  link.download = 'onion_planet_' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// ─── Render ───────────────────────────────────────────────────
const startTime = performance.now()/1000;

function render(){
  if(Date.now()-lastInt>5000&&$('chk-autorot').checked)autoRot=true;
  if(autoRot)theta+=.0024;
  if(animPower) power=8+Math.sin((performance.now()/1000-startTime)*animSpeed)*6;

  gl.bindFramebuffer(gl.FRAMEBUFFER,fS);gl.viewport(0,0,W,H);
  gl.useProgram(pM);
  gl.uniform2f(u(pM,'uRes'),W,H);
  gl.uniform1f(u(pM,'uTheta'),theta);
  gl.uniform1f(u(pM,'uPhi'),phi);
  gl.uniform1f(u(pM,'uDist'),dist);
  gl.uniform1f(u(pM,'uPower'),power);
  gl.uniform1f(u(pM,'uSpecPow'),specPow);
  gl.uniform3fv(u(pM,'uColA'),colA);
  gl.uniform3fv(u(pM,'uColB'),colB);
  gl.uniform3fv(u(pM,'uColC'),colC);
  gl.uniform3fv(u(pM,'uColD'),colD);
  q(vM);

  gl.bindFramebuffer(gl.FRAMEBUFFER,fB0);gl.viewport(0,0,BW,BH);
  gl.useProgram(pE);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tS);
  gl.uniform1i(u(pE,'uTex'),0);
  gl.uniform1f(u(pE,'uThresh'),bloomThresh);
  q(vE);

  gl.useProgram(pB);gl.uniform1i(u(pB,'uTex'),0);
  for(let i=0;i<2;i++){
    gl.bindFramebuffer(gl.FRAMEBUFFER,fB1);gl.viewport(0,0,BW,BH);
    gl.bindTexture(gl.TEXTURE_2D,tB0);gl.uniform2f(u(pB,'uDir'),1./BW,0.);q(vB);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fB0);gl.viewport(0,0,BW,BH);
    gl.bindTexture(gl.TEXTURE_2D,tB1);gl.uniform2f(u(pB,'uDir'),0.,1./BH);q(vB);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
  gl.useProgram(pC);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tS);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tB0);
  gl.uniform1i(u(pC,'uScene'),0);gl.uniform1i(u(pC,'uBloom'),1);
  gl.uniform1f(u(pC,'uBloomMix'),bloomIntensity);
  gl.uniform1f(u(pC,'uExposure'),exposure);
  q(vC);
}

// ─── Adaptive Quality ─────────────────────────────────────────
const fpsEl=$('fps-display');
const qbar=$('qbar');
const SCALES=[.30,.42,.52,.63,.76,.92,1.];
let scaleIdx=3;
const BH_=[5,7,9,11,13,15,17];
const qs=BH_.map(h=>{const d=document.createElement('div');d.className='qs';d.style.height=h+'px';qbar.appendChild(d);return d;});
function uQ(){qs.forEach((s,i)=>s.style.background=i<=scaleIdx?'rgba(0,210,255,.60)':'rgba(0,210,255,.12)');}
uQ();

let fts=[],lQ=Date.now(),sH=0;
function cQ(){
  const now=Date.now();if(now-lQ<1600||fts.length<15)return;
  const avg=fts.reduce((a,b)=>a+b)/fts.length;const fps=1000/avg;
  fts=[];lQ=now;
  fpsEl.innerHTML=fps.toFixed(0)+' fps<br>onion planet · studio';
  if(fps<21&&scaleIdx>0){scaleIdx--;renderScale=SCALES[scaleIdx];resize();sH=0;}
  else if(fps>40){sH++;if(sH>=3&&scaleIdx<SCALES.length-1){scaleIdx++;renderScale=SCALES[scaleIdx];resize();sH=0;}}
  else sH=0;
  $('sl-scale').value=Math.round(renderScale*100);$('val-scale').textContent=Math.round(renderScale*100)+'%';
  uQ();
}

let lF=performance.now();
(function loop(){
  const now=performance.now();fts.push(now-lF);lF=now;
  render();cQ();requestAnimationFrame(loop);
})();



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
  var hbPeriod = 0.6769947826784277;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.017505295667466506;mix-blend-mode:overlay';
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



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
