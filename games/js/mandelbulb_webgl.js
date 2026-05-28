const VS = `#version 300 es
in vec2 a;
out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS_MARCH = `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uTheta,uPhi,uDist;
in vec2 uv;
out vec4 O;

const float PWR=8.;
const int   FIT=10, RST=72;
const float EPS=.0003, BS=1.35;

vec4 bulb(vec3 p){
  vec3 z=p; float dr=1.,r=0.,tr1=1e9,tr2=1e9; int n=0;
  for(int i=0;i<FIT;i++){
    r=length(z); if(r>2.)break; n=i;
    tr1=min(tr1,length(z.xy));
    tr2=min(tr2,abs(z.z));
    float th=acos(clamp(z.y/r,-1.,1.)),ph=atan(z.x,z.z);
    dr=pow(r,PWR-1.)*PWR*dr+1.;
    float zr=pow(r,PWR); th*=PWR; ph*=PWR;
    z=zr*vec3(sin(th)*sin(ph),cos(th),sin(th)*cos(ph))+p;
  }
  return vec4(.5*log(max(r,1e-6))*r/dr, tr1, tr2, float(n)/float(FIT));
}

vec3 nrm(vec3 p){
  const float h=.0009; const vec2 k=vec2(1.,-1.);
  return normalize(
    k.xyy*bulb(p+k.xyy*h).x + k.yyx*bulb(p+k.yyx*h).x+
    k.yxy*bulb(p+k.yxy*h).x + k.xxx*bulb(p+k.xxx*h).x);
}

float ao(vec3 p,vec3 n){
  float o=0.,s=1.;
  for(int i=0;i<5;i++){float h=.01+.18*float(i)/4.;o+=(h-bulb(p+h*n).x)*s;s*=.70;}
  return clamp(1.-3.*o,0.,1.);
}

vec3 pal(float t1,float t2,float ti){
  vec3 a=vec3(.04,.44,.92),b=vec3(.93,.07,.60),c=vec3(.96,.73,.07),d=vec3(.07,.91,.54);
  vec3 col=mix(a,b,clamp(t1*3.,0.,1.));
  col=mix(col,c,clamp(t2*5.,0.,1.)*.42);
  return mix(col,d,ti*.22);
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
  vec3 col=vec3(0.,.005,.016)
    +star*vec3(.55,.72,1.)*.55
    +vec3(.014,0.,.032)*exp(-rad*2.4)
    +vec3(0.,.006,.022)*exp(-rad*1.1);

  float b2=dot(ro,rd), disc=b2*b2-dot(ro,ro)+BS*BS;

  if(disc>=0.){
    float t=max(-b2-sqrt(disc),0.), tmax=-b2+sqrt(disc);
    bool hit=false; vec4 trap=vec4(0);

    for(int i=0;i<RST;i++){
      vec4 res=bulb(ro+rd*t); trap=res;
      if(res.x<EPS){hit=true;break;}
      if(t>=tmax)break;
      t+=res.x*.55;
    }

    if(hit){
      vec3 p=ro+rd*t;
      vec3 n=nrm(p);
      float occ=ao(p,n);

      vec3 L1=normalize(vec3(.7,.6,.4)), L2=normalize(vec3(-.5,.3,-.9));
      float d1=max(dot(n,L1),0.), d2=max(dot(n,L2),0.)*.35;
      vec3  H1=normalize(L1-rd);
      float sp=pow(max(dot(n,H1),0.),80.);
      float fr=pow(1.-max(dot(-rd,n),0.),4.);

      vec3 bc=pal(trap.y,trap.z,trap.w);
      col =bc*(d1*1.65+d2+.07)*occ;
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

const FS_EXTRACT = `#version 300 es
precision mediump float;
uniform sampler2D uTex; in vec2 uv; out vec4 O;
void main(){
  vec3 c=texture(uTex,uv).rgb;
  float l=dot(c,vec3(.2126,.7152,.0722));
  O=vec4(c*max(l-.50,0.)/max(l,.001)*2.8,1.);
}`;

const FS_BLUR = `#version 300 es
precision mediump float;
uniform sampler2D uTex; uniform vec2 uDir; in vec2 uv; out vec4 O;
const float W[5]=float[](.2270,.1945,.1216,.0540,.0162);
void main(){
  vec3 c=texture(uTex,uv).rgb*W[0];
  for(int i=1;i<5;i++){
    float f=float(i);
    c+=texture(uTex,uv+uDir*f).rgb*W[i];
    c+=texture(uTex,uv-uDir*f).rgb*W[i];
  }
  O=vec4(c,1.);
}`;

const FS_COMP = `#version 300 es
precision mediump float;
uniform sampler2D uScene,uBloom; in vec2 uv; out vec4 O;
vec3 aces(vec3 x){
  return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);
}
void main(){
  vec3 s=texture(uScene,uv).rgb;
  vec3 b=texture(uBloom,uv).rgb;
  vec3 col=aces((s+b*1.85)*1.08);
  O=vec4(pow(col,vec3(1./2.2)),1.);
}`;

const canvas=document.getElementById('c');
let gl=canvas.getContext('webgl2',{antialias:false,alpha:false,powerPreference:'high-performance'});

if(!gl){
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const e=document.getElementById('errbox');
  if (gl) {
    e.innerHTML='Your browser supports WebGL1 but this experience requires WebGL2.<br>Please use a recent version of Chrome, Firefox, or Edge.';
  } else {
    e.innerHTML='WebGL is not supported by your browser.<br>Please use a recent version of Chrome, Firefox, or Edge.';
  }
  e.style.display='block';
  throw 0;
}

const hdrExt=gl.getExtension('EXT_color_buffer_float');
const IFMT=hdrExt?gl.RGBA16F:gl.RGBA8;
const ITYP=hdrExt?gl.HALF_FLOAT:gl.UNSIGNED_BYTE;

function mkShader(t,src){
  const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));throw 0;}
  return s;
}
function mkProg(fs){
  const p=gl.createProgram();
  gl.attachShader(p,mkShader(gl.VERTEX_SHADER,VS));
  gl.attachShader(p,mkShader(gl.FRAGMENT_SHADER,fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(p));throw 0;}
  return p;
}

const pMarch=mkProg(FS_MARCH),pExtract=mkProg(FS_EXTRACT),pBlur=mkProg(FS_BLUR),pComp=mkProg(FS_COMP);

const qBuf=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,qBuf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);

function mkVAO(prog){
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,qBuf);
  const loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);return vao;
}
const vaoMarch=mkVAO(pMarch),vaoExt=mkVAO(pExtract),vaoBlur=mkVAO(pBlur),vaoComp=mkVAO(pComp);
function quad(vao){gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
function ul(p,n){return gl.getUniformLocation(p,n);}

let W,H,BW,BH,tScene,tB0,tB1,fScene,fB0,fB1;

function mkTex(w,h){
  const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  gl.texImage2D(gl.TEXTURE_2D,0,IFMT,w,h,0,gl.RGBA,ITYP,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return t;
}
function mkFBO(tex){
  const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);return f;
}

let renderScale=.62;

function initFBOs(){
  [tScene,tB0,tB1].forEach(t=>{if(t)gl.deleteTexture(t);});
  [fScene,fB0,fB1].forEach(f=>{if(f)gl.deleteFramebuffer(f);});
  W=Math.max(1,Math.floor(canvas.width*renderScale));
  H=Math.max(1,Math.floor(canvas.height*renderScale));
  BW=Math.max(1,W>>2);BH=Math.max(1,H>>2);
  tScene=mkTex(W,H);tB0=mkTex(BW,BH);tB1=mkTex(BW,BH);
  fScene=mkFBO(tScene);fB0=mkFBO(tB0);fB1=mkFBO(tB1);
}

let theta=.5,phi=.28,dist=3.2;
let autoRot=true,lastInt=0;
const AUTO_MS=5000;

canvas.addEventListener('mousedown',()=>{
  canvas.classList.add('drag');autoRot=false;lastInt=Date.now();
  const mv=e=>{theta-=e.movementX*.007;phi=Math.max(-1.38,Math.min(1.38,phi+e.movementY*.007));lastInt=Date.now();};
  const up=()=>{canvas.classList.remove('drag');removeEventListener('mousemove',mv);removeEventListener('mouseup',up);};
  addEventListener('mousemove',mv);addEventListener('mouseup',up);
});
canvas.addEventListener('wheel',e=>{e.preventDefault();dist=Math.max(1.7,Math.min(8.,dist+e.deltaY*.005));autoRot=false;lastInt=Date.now();},{passive:false});
canvas.addEventListener('dblclick',()=>{theta=.5;phi=.28;dist=3.2;autoRot=true;});

let lTX=0,lTY=0,lPD=0;
canvas.addEventListener('touchstart',e=>{e.preventDefault();if(e.touches.length===1){lTX=e.touches[0].clientX;lTY=e.touches[0].clientY;autoRot=false;}else if(e.touches.length===2)lPD=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);},{passive:false});
canvas.addEventListener('touchmove',e=>{e.preventDefault();if(e.touches.length===1){theta-=(e.touches[0].clientX-lTX)*.009;phi=Math.max(-1.38,Math.min(1.38,phi+(e.touches[0].clientY-lTY)*.009));lTX=e.touches[0].clientX;lTY=e.touches[0].clientY;}else if(e.touches.length===2){const pd=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);dist=Math.max(1.7,Math.min(8.,dist*(lPD/pd)));lPD=pd;}},{passive:false});

function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;
  initFBOs();
}
addEventListener('resize',resize);resize();

function render(){
  if(Date.now()-lastInt>AUTO_MS)autoRot=true;
  if(autoRot)theta+=.0024;

  gl.bindFramebuffer(gl.FRAMEBUFFER,fScene);gl.viewport(0,0,W,H);
  gl.useProgram(pMarch);
  gl.uniform2f(ul(pMarch,'uRes'),W,H);
  gl.uniform1f(ul(pMarch,'uTheta'),theta);
  gl.uniform1f(ul(pMarch,'uPhi'),phi);
  gl.uniform1f(ul(pMarch,'uDist'),dist);
  quad(vaoMarch);

  gl.bindFramebuffer(gl.FRAMEBUFFER,fB0);gl.viewport(0,0,BW,BH);
  gl.useProgram(pExtract);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tScene);
  gl.uniform1i(ul(pExtract,'uTex'),0);
  quad(vaoExt);

  gl.useProgram(pBlur);gl.uniform1i(ul(pBlur,'uTex'),0);
  for(let i=0;i<2;i++){
    gl.bindFramebuffer(gl.FRAMEBUFFER,fB1);gl.viewport(0,0,BW,BH);
    gl.bindTexture(gl.TEXTURE_2D,tB0);gl.uniform2f(ul(pBlur,'uDir'),1./BW,0.);quad(vaoBlur);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fB0);gl.viewport(0,0,BW,BH);
    gl.bindTexture(gl.TEXTURE_2D,tB1);gl.uniform2f(ul(pBlur,'uDir'),0.,1./BH);quad(vaoBlur);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
  gl.useProgram(pComp);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tScene);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tB0);
  gl.uniform1i(ul(pComp,'uScene'),0);gl.uniform1i(ul(pComp,'uBloom'),1);
  quad(vaoComp);
}

const fpsEl=document.getElementById('fps');
const qbar=document.getElementById('qbar');
const SCALES=[.30,.42,.52,.63,.76,.92,1.];
let scaleIdx=3;renderScale=SCALES[scaleIdx];
const BHEIGHTS=[5,7,9,11,13,15,17];
const qsegs=BHEIGHTS.map(h=>{const d=document.createElement('div');d.className='qs';d.style.height=h+'px';qbar.appendChild(d);return d;});
function updateQbar(){qsegs.forEach((s,i)=>s.style.background=i<=scaleIdx?'rgba(0,210,255,.60)':'rgba(0,210,255,.12)');}
updateQbar();

let fts=[],lastQCheck=Date.now(),stableHi=0;
function checkQuality(){
  const now=Date.now();if(now-lastQCheck<1600||fts.length<15)return;
  const avgMs=fts.reduce((a,b)=>a+b)/fts.length;const fps=1000/avgMs;
  fts=[];lastQCheck=now;
  fpsEl.innerHTML=fps.toFixed(0)+' fps<br>guinea pig trench · ℗8';
  if(fps<21&&scaleIdx>0){scaleIdx--;renderScale=SCALES[scaleIdx];resize();stableHi=0;}
  else if(fps>40){stableHi++;if(stableHi>=3&&scaleIdx<SCALES.length-1){scaleIdx++;renderScale=SCALES[scaleIdx];resize();stableHi=0;}}
  else stableHi=0;
  updateQbar();
}

let lastFrame=performance.now();
(function loop(){
  const now=performance.now();fts.push(now-lastFrame);lastFrame=now;
  render();checkQuality();requestAnimationFrame(loop);
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
  wn.textContent = 'VAULT COMPOUND 7';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6719615173970268;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01814650862073898;mix-blend-mode:overlay';
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

// CHAIN FIX: AUDIO-REACTIVE VISUALS
// The bee delivered the pollen. Now the flower breathes.
(function(){
  var vig = document.getElementById('threshold-vignette');
  var lastBass = 0;
  
  function pulse(){
    requestAnimationFrame(pulse);
    var bass = window.AUDIO_BASS || (parent && parent.AUDIO_BASS) || 0;
    var energy = window.AUDIO_ENERGY || (parent && parent.AUDIO_ENERGY) || 0;
    
    // Smooth the values (no sudden jumps)
    lastBass += (bass - lastBass) * 0.15;
    
    // Vignette breathes with bass (subtle — max 15% intensity change)
    if(vig){
      var intensity = 0.35 + (lastBass / 255) * 0.15;
      vig.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,' + intensity.toFixed(3) + '))';
    }
    
    // If there is a canvas, subtly shift its brightness
    // This is the audio-to-visual bridge — the terrain pulses, the walls breathe
    var c = document.querySelector('canvas');
    if(c && energy > 0.01){
      c.style.filter = 'brightness(' + (1 + energy * 0.08).toFixed(3) + ')';
    } else if(c) {
      c.style.filter = '';
    }
  }
  
  // Only start if music link is active
  var checkInterval = setInterval(function(){
    if(window.AUDIO_BASS !== undefined || (parent && parent.AUDIO_BASS !== undefined)){
      clearInterval(checkInterval);
      pulse();
    }
  }, 500);
})();