'use strict';
// ── state ──────────────────────────────────────────────────────────────────
let N=16, K=8.0, elev=45, rot=0, autoRot=true, showSM=false;
let theta=0.5, phi=0.85, dist=18;
let mdown=false, mx=0, my=0;
let fc=0, ft=performance.now();

// ── mat4 ───────────────────────────────────────────────────────────────────
const I=()=>{const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m;}
const mul=(a,b)=>{const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
const persp=(fv,asp,n,f)=>{const m=new Float32Array(16),t=1/Math.tan(fv*.5);m[0]=t/asp;m[5]=t;m[10]=(f+n)/(n-f);m[11]=-1;m[14]=2*f*n/(n-f);return m;}
const ortho=(l,r,b,t,n,f)=>{const m=new Float32Array(16);m[0]=2/(r-l);m[5]=2/(t-b);m[10]=-2/(f-n);m[12]=-(r+l)/(r-l);m[13]=-(t+b)/(t-b);m[14]=-(f+n)/(f-n);m[15]=1;return m;}
const lookAt=(e,c,u)=>{
  let fx=c[0]-e[0],fy=c[1]-e[1],fz=c[2]-e[2];
  const fl=Math.hypot(fx,fy,fz);fx/=fl;fy/=fl;fz/=fl;
  let rx=fy*u[2]-fz*u[1],ry=fz*u[0]-fx*u[2],rz=fx*u[1]-fy*u[0];
  const rl=Math.hypot(rx,ry,rz);rx/=rl;ry/=rl;rz/=rl;
  const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;
  const m=new Float32Array(16);
  m[0]=rx;m[4]=ry;m[8]=rz; m[12]=-(rx*e[0]+ry*e[1]+rz*e[2]);
  m[1]=ux;m[5]=uy;m[9]=uz; m[13]=-(ux*e[0]+uy*e[1]+uz*e[2]);
  m[2]=-fx;m[6]=-fy;m[10]=-fz;m[14]=fx*e[0]+fy*e[1]+fz*e[2];
  m[15]=1;return m;
}
const T=(tx,ty,tz)=>{const m=I();m[12]=tx;m[13]=ty;m[14]=tz;return m;}
const S=(sx,sy,sz)=>{const m=I();m[0]=sx;m[5]=sy;m[10]=sz;return m;}
const nm3=(m)=>new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]])

// ── geometry ───────────────────────────────────────────────────────────────
const box=()=>{
  const p=[],n=[],ix=[];
  const fs=[
    {n:[0,0,1], v:[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]},
    {n:[0,0,-1],v:[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]},
    {n:[0,1,0], v:[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]},
    {n:[0,-1,0],v:[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]},
    {n:[1,0,0], v:[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]},
    {n:[-1,0,0],v:[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]}
  ];
  let b=0;
  for(const f of fs){for(const v of f.v){p.push(...v);n.push(...f.n);}ix.push(b,b+1,b+2,b,b+2,b+3);b+=4;}
  return{p:new Float32Array(p),n:new Float32Array(n),i:new Uint16Array(ix)};
}
const plane=(s)=>{const h=s/2;return{
  p:new Float32Array([-h,0,h,h,0,h,h,0,-h,-h,0,-h]),
  n:new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),
  i:new Uint16Array([0,1,2,0,2,3])
};}

// ── shaders ────────────────────────────────────────────────────────────────
const SV=`#version 300 es
in vec3 a_p;uniform mat4 u_lmvp;
void main(){gl_Position=u_lmvp*vec4(a_p,1.);}`;
const SF=`#version 300 es
precision mediump float;void main(){}`;

const MV=`#version 300 es
in vec3 a_p;in vec3 a_n;
uniform mat4 u_mvp,u_m,u_lmvp;uniform mat3 u_nm;
out vec3 v_p,v_n;out vec4 v_sc;
void main(){
  vec4 wp=u_m*vec4(a_p,1.);
  v_p=wp.xyz;v_n=normalize(u_nm*a_n);
  v_sc=u_lmvp*vec4(a_p,1.);
  gl_Position=u_mvp*vec4(a_p,1.);
}`;
const MF=`#version 300 es
precision highp float;
in vec3 v_p,v_n;in vec4 v_sc;
uniform sampler2D u_sm;
uniform vec3 u_ld,u_col;
uniform int u_n;uniform float u_k;
out vec4 fc;

// 32 stratified Poisson samples — 4 rings × 8, sorted inner→outer
// Taking first N samples always gives a well-distributed subset
const vec2 D[32]=vec2[32](
  vec2(0.,0.25),vec2(.177,.177),vec2(.25,0.),vec2(.177,-.177),
  vec2(0.,-.25),vec2(-.177,-.177),vec2(-.25,0.),vec2(-.177,.177),
  vec2(0.,.5),vec2(.354,.354),vec2(.5,0.),vec2(.354,-.354),
  vec2(0.,-.5),vec2(-.354,-.354),vec2(-.5,0.),vec2(-.354,.354),
  vec2(0.,.75),vec2(.53,.53),vec2(.75,0.),vec2(.53,-.53),
  vec2(0.,-.75),vec2(-.53,-.53),vec2(-.75,0.),vec2(-.53,.53),
  vec2(0.,1.),vec2(.707,.707),vec2(1.,0.),vec2(.707,-.707),
  vec2(0.,-1.),vec2(-.707,-.707),vec2(-1.,0.),vec2(-.707,.707)
);

float shadow(vec4 sc){
  vec3 p=sc.xyz/sc.w*.5+.5;
  if(p.z>1.)return 0.;
  if(p.x<.001||p.x>.999||p.y<.001||p.y>.999)return 0.;
  float ct=clamp(dot(v_n,u_ld),0.,1.);
  float bias=mix(.004,.0005,ct);
  float d=p.z-bias,tx=1./2048.,sum=0.;

  // ── Sierpiński adaptive PCF — cheap test first ──
  // Check center sample only. If clearly lit or shadowed, skip full PCF.
  float centerDepth = texture(u_sm, p.xy).r;
  float centerTest = d > centerDepth ? 1.0 : 0.0;

  // Check 4 cardinal samples (ring 1 only) — cheap penumbra detection
  float edgeSum = 0.0;
  for(int i=0;i<4;i++){
    edgeSum += d > texture(u_sm, p.xy + D[i] * u_k * tx).r ? 1.0 : 0.0;
  }

  // If all 5 agree (fully lit or fully shadowed), skip expensive sampling
  float cheapResult = (centerTest + edgeSum) / 5.0;
  if(cheapResult < 0.01 || cheapResult > 0.99){
    return cheapResult; // No penumbra — early exit (the sieve break)
  }

  // Penumbra detected — run full Poisson PCF on survivors only
  for(int i=0;i<32;i++){
    if(i>=u_n)break;
    sum+=d>texture(u_sm,p.xy+D[i]*u_k*tx).r?1.:0.;
  }
  return sum/float(u_n);
}

void main(){
  vec3 n=normalize(v_n);
  float ndl=max(dot(n,u_ld),0.);
  float sh=shadow(v_sc);

  // ── Melanin shadow color — shadows absorb warm frequencies ──
  // Deep shadow = eumelanin (warm brown, not black)
  // Penumbra = pheomelanin (slightly warmer transition)
  vec3 euShadow = vec3(0.06, 0.04, 0.03);  // deep shadow — warm dark
  vec3 phShadow = vec3(0.12, 0.07, 0.05);  // penumbra — warmer
  vec3 shadowColor = mix(phShadow, euShadow, sh); // deeper = darker brown

  vec3 amb = u_col * 0.20 + shadowColor * sh * 0.3;
  vec3 dif = u_col * ndl * (1.0 - sh) * 0.80;

  // ── Contact shadow darkening — mycelium growth from contact point ──
  // Objects touching surfaces get extra darkness at the base
  float contactDark = smoothstep(0.3, 0.0, v_sc.y / v_sc.w * 0.5 + 0.5) * sh * 0.15;

  vec3 final = amb + dif - vec3(contactDark);
  fc = vec4(pow(max(final, vec3(0.0)), vec3(1.0/2.2)), 1.0);
}`;

const DV=`#version 300 es
out vec2 v_uv;
void main(){
  const vec2 p[4]=vec2[4](vec2(-.98,-.98),vec2(-.45,-.98),vec2(-.45,-.42),vec2(-.98,-.42));
  const vec2 u[4]=vec2[4](vec2(0.,0.),vec2(1.,0.),vec2(1.,1.),vec2(0.,1.));
  v_uv=u[gl_VertexID];gl_Position=vec4(p[gl_VertexID],0.,1.);
}`;
const DF=`#version 300 es
precision mediump float;
in vec2 v_uv;uniform sampler2D u_d;out vec4 fc;
void main(){float d=texture(u_d,v_uv).r;d=pow(d,20.);fc=vec4(d,d,d,1.);}`;

// ── webgl2 setup ───────────────────────────────────────────────────────────
const cv=document.getElementById('gl');
const gl=cv.getContext('webgl2');
if(!gl){document.body.innerHTML='<p style="color:#f44;padding:20px;font-family:monospace">WebGL 2 not available.</p>';throw 0;}

const prog=(vs,fs)=>{
  const sh=(t,s)=>{const h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(h);return h;}
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw gl.getProgramInfoLog(p);return p;
}
const SP=prog(SV,SF),MP=prog(MV,MF),DP=prog(DV,DF);
const ul=(p,n)=>gl.getUniformLocation(p,n);
const SU={lmvp:ul(SP,'u_lmvp')};
const MU={mvp:ul(MP,'u_mvp'),m:ul(MP,'u_m'),nm:ul(MP,'u_nm'),lmvp:ul(MP,'u_lmvp'),sm:ul(MP,'u_sm'),ld:ul(MP,'u_ld'),col:ul(MP,'u_col'),n:ul(MP,'u_n'),k:ul(MP,'u_k')};
const DU={d:ul(DP,'u_d')};

// shadow FBO
const SSZ=2048;
const stx=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,stx);
gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT32F,SSZ,SSZ,0,gl.DEPTH_COMPONENT,gl.FLOAT,null);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const sfb=gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER,sfb);
gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,stx,0);
gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);
if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)console.warn('Shadow FBO incomplete');
gl.bindFramebuffer(gl.FRAMEBUFFER,null);

// mesh upload
const SA=gl.getAttribLocation(SP,'a_p');
const MA=gl.getAttribLocation(MP,'a_p');
const MN=gl.getAttribLocation(MP,'a_n');

function upload(g){
  const svao=gl.createVertexArray();
  gl.bindVertexArray(svao);
  const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,g.p,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(SA);gl.vertexAttribPointer(SA,3,gl.FLOAT,false,0,0);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,g.i,gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const mvao=gl.createVertexArray();
  gl.bindVertexArray(mvao);
  gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.enableVertexAttribArray(MA);gl.vertexAttribPointer(MA,3,gl.FLOAT,false,0,0);
  const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,g.n,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(MN);gl.vertexAttribPointer(MN,3,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bindVertexArray(null);
  return{svao,mvao,ct:g.i.length};
}

const BX=upload(box()), PL=upload(plane(26));
const DVAO=gl.createVertexArray();

// ── scene ──────────────────────────────────────────────────────────────────
// model = T(translate) * S(scale) for each object
const sc=[
  // ground
  {m:I(),                                   c:[.18,.17,.16]},
  // 4 corner pillars
  {m:mul(T( 4.5,2.5, 4.5),S(.4,2.5,.4)),   c:[.40,.36,.32]},
  {m:mul(T(-4.5,2.5, 4.5),S(.4,2.5,.4)),   c:[.40,.36,.32]},
  {m:mul(T( 4.5,2.5,-4.5),S(.4,2.5,.4)),   c:[.40,.36,.32]},
  {m:mul(T(-4.5,2.5,-4.5),S(.4,2.5,.4)),   c:[.40,.36,.32]},
  // torii gate — two posts
  {m:mul(T(-2.2,3,-6.5),S(.3,3,.3)),        c:[.68,.18,.10]},
  {m:mul(T( 2.2,3,-6.5),S(.3,3,.3)),        c:[.68,.18,.10]},
  // torii — main beam
  {m:mul(T(0,6.1,-6.5),S(3.0,.30,.42)),     c:[.68,.18,.10]},
  // torii — top lintel
  {m:mul(T(0,6.6,-6.5),S(3.4,.14,.38)),     c:[.60,.16,.09]},
  // central altar base
  {m:mul(T(0,.55,0),S(1.3,.55,1.3)),        c:[.48,.44,.38]},
  {m:mul(T(0,1.38,0),S(.75,.28,.75)),       c:[.52,.48,.42]},
  // stone lanterns (pair)
  {m:mul(T( 6.5,1.2,0),S(.4,1.2,.4)),       c:[.36,.33,.30]},
  {m:mul(T( 6.5,2.55,0),S(.6,.18,.6)),      c:[.40,.37,.33]},
  {m:mul(T(-6.5,1.2,0),S(.4,1.2,.4)),       c:[.36,.33,.30]},
  {m:mul(T(-6.5,2.55,0),S(.6,.18,.6)),      c:[.40,.37,.33]},
  // connecting path stones
  {m:mul(T(0,.05,-2),S(1.6,.08,.55)),       c:[.25,.23,.21]},
  {m:mul(T(0,.05,-3.5),S(1.6,.08,.55)),     c:[.25,.23,.21]},
  {m:mul(T(0,.05,-5),S(1.6,.08,.55)),       c:[.25,.23,.21]},
];

// meshes per scene entry (first entry = plane, rest = box)
const mesh=(i)=>i===0?PL:BX;

// ── draw ───────────────────────────────────────────────────────────────────
function drawShadow(lvp){
  gl.useProgram(SP);
  for(let i=0;i<sc.length;i++){
    gl.uniformMatrix4fv(SU.lmvp,false,mul(lvp,sc[i].m));
    gl.bindVertexArray(mesh(i).svao);
    gl.drawElements(gl.TRIANGLES,mesh(i).ct,gl.UNSIGNED_SHORT,0);
  }
}

function drawMain(cvp,lvp,ld){
  gl.useProgram(MP);
  gl.uniform1i(MU.sm,0);
  gl.uniform3fv(MU.ld,ld);
  gl.uniform1i(MU.n,N);
  gl.uniform1f(MU.k,K);
  for(let i=0;i<sc.length;i++){
    const o=sc[i];
    gl.uniformMatrix4fv(MU.mvp,false,mul(cvp,o.m));
    gl.uniformMatrix4fv(MU.m,false,o.m);
    gl.uniformMatrix3fv(MU.nm,false,nm3(o.m));
    gl.uniformMatrix4fv(MU.lmvp,false,mul(lvp,o.m));
    gl.uniform3fv(MU.col,o.c);
    gl.bindVertexArray(mesh(i).mvao);
    gl.drawElements(gl.TRIANGLES,mesh(i).ct,gl.UNSIGNED_SHORT,0);
  }
}

// ── render loop ────────────────────────────────────────────────────────────
function render(ts){
  const t=ts*.001;
  const dpr=Math.min(devicePixelRatio,2);
  const cw=Math.round(cv.clientWidth*dpr), ch=Math.round(cv.clientHeight*dpr);
  if(cv.width!==cw||cv.height!==ch){cv.width=cw;cv.height=ch;}

  // light
  const lr=autoRot?t*.35:(rot*Math.PI/180);
  const er=elev*Math.PI/180;
  const lx=Math.cos(er)*Math.sin(lr),ly=Math.sin(er),lz=Math.cos(er)*Math.cos(lr);
  const ld=[lx,ly,lz];
  const lpos=[lx*28,ly*28,lz*28];
  const up=Math.abs(ly)>.98?[0,0,-1]:[0,1,0];
  const lv=lookAt(lpos,[0,0,0],up);
  const lp=ortho(-15,15,-15,15,.5,70);
  const lvp=mul(lp,lv);

  // camera
  const cx=Math.cos(phi)*Math.sin(theta)*dist;
  const cy=Math.sin(phi)*dist;
  const cz=Math.cos(phi)*Math.cos(theta)*dist;
  const cv2=mul(persp(Math.PI/4,cv.width/cv.height,.1,80),lookAt([cx,cy,cz],[0,.5,0],[0,1,0]));

  // shadow pass
  gl.bindFramebuffer(gl.FRAMEBUFFER,sfb);
  gl.viewport(0,0,SSZ,SSZ);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);gl.cullFace(gl.FRONT);
  drawShadow(lvp);
  gl.cullFace(gl.BACK);

  // main pass
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.viewport(0,0,cv.width,cv.height);
  gl.clearColor(.05,.04,.08,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D,stx);
  drawMain(cv2,lvp,ld);

  // debug shadow map
  if(showSM){
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(DP);
    gl.uniform1i(DU.d,0);
    gl.bindVertexArray(DVAO);
    gl.drawArrays(gl.TRIANGLE_FAN,0,4);
    gl.enable(gl.DEPTH_TEST);
  }

  // fps
  fc++;
  const now=performance.now();
  if(now-ft>600){
    document.getElementById('fps').textContent=Math.round(fc*1000/(now-ft));
    fc=0;ft=now;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// ── interaction ────────────────────────────────────────────────────────────
cv.addEventListener('mousedown',e=>{mdown=true;mx=e.clientX;my=e.clientY;});
cv.addEventListener('mouseup',()=>mdown=false);
cv.addEventListener('mouseleave',()=>mdown=false);
cv.addEventListener('mousemove',e=>{
  if(!mdown)return;
  theta-=(e.clientX-mx)*.005;
  phi=Math.max(.05,Math.min(1.45,phi-(e.clientY-my)*.005));
  mx=e.clientX;my=e.clientY;
});
cv.addEventListener('wheel',e=>{dist=Math.max(5,Math.min(40,dist+e.deltaY*.025));e.preventDefault();},{passive:false});
cv.addEventListener('touchstart',e=>{if(e.touches.length===1){mdown=true;mx=e.touches[0].clientX;my=e.touches[0].clientY;}e.preventDefault();},{passive:false});
cv.addEventListener('touchend',()=>mdown=false);
cv.addEventListener('touchmove',e=>{
  if(!mdown||e.touches.length!==1)return;
  theta-=(e.touches[0].clientX-mx)*.005;
  phi=Math.max(.05,Math.min(1.45,phi-(e.touches[0].clientY-my)*.005));
  mx=e.touches[0].clientX;my=e.touches[0].clientY;
  e.preventDefault();
},{passive:false});

// ── controls ───────────────────────────────────────────────────────────────
function setSamples(n){
  N=n;
  [4,8,16,32].forEach(v=>document.getElementById('b'+v).classList.toggle('on',v===n));
  document.getElementById('l-n').textContent=n;
  document.getElementById('sn').textContent=n;
  drawDisk();
}
document.getElementById('sl-k').addEventListener('input',e=>{
  K=parseFloat(e.target.value);
  document.getElementById('l-k').textContent=K.toFixed(1);
  document.getElementById('sk').textContent=K.toFixed(1);
});
document.getElementById('sl-e').addEventListener('input',e=>{
  elev=parseInt(e.target.value);
  document.getElementById('l-e').textContent=elev+'°';
});
document.getElementById('sl-r').addEventListener('input',e=>{
  rot=parseInt(e.target.value);
  document.getElementById('l-r').textContent=rot+'°';
});
document.getElementById('t-ar').addEventListener('change',e=>{
  autoRot=e.target.checked;
  document.getElementById('sl-r').disabled=autoRot;
  document.getElementById('l-r').textContent=autoRot?'auto':rot+'°';
});
document.getElementById('t-sm').addEventListener('change',e=>showSM=e.target.checked);

// ── poisson disk ───────────────────────────────────────────────────────────
const DISK=[
  [0,.25],[.177,.177],[.25,0],[.177,-.177],[0,-.25],[-.177,-.177],[-.25,0],[-.177,.177],
  [0,.5],[.354,.354],[.5,0],[.354,-.354],[0,-.5],[-.354,-.354],[-.5,0],[-.354,.354],
  [0,.75],[.53,.53],[.75,0],[.53,-.53],[0,-.75],[-.53,-.53],[-.75,0],[-.53,.53],
  [0,1],[.707,.707],[1,0],[.707,-.707],[0,-1],[-.707,-.707],[-1,0],[-.707,.707]
];
const pc=document.getElementById('pdisk');
const px=pc.getContext('2d');

function drawDisk(){
  const sz=pc.width, cx=sz/2, cy=sz/2, r=sz*.43;
  px.clearRect(0,0,sz,sz);
  px.fillStyle='#07070f';px.fillRect(0,0,sz,sz);
  // rings
  [.25,.5,.75,1].forEach(ri=>{
    px.beginPath();px.arc(cx,cy,ri*r,0,Math.PI*2);
    px.strokeStyle='#1a1a2e';px.lineWidth=1;px.stroke();
  });
  // crosshair
  px.strokeStyle='#1a1a2e';px.lineWidth=.5;
  px.beginPath();px.moveTo(cx-r,cy);px.lineTo(cx+r,cy);px.stroke();
  px.beginPath();px.moveTo(cx,cy-r);px.lineTo(cx,cy+r);px.stroke();
  // samples
  DISK.forEach(([x,y],i)=>{
    const px_=cx+x*r, py_=cy-y*r, active=i<N;
    if(active){
      px.beginPath();px.arc(px_,py_,8,0,Math.PI*2);
      px.fillStyle='rgba(74,158,255,0.12)';px.fill();
    }
    px.beginPath();px.arc(px_,py_,active?3.5:2,0,Math.PI*2);
    px.fillStyle=active?'#4a9eff':'#2a2a48';px.fill();
  });
  // ring labels
  px.fillStyle='#3a3a58';px.font='9px Courier New';px.textAlign='left';
  [.25,.5,.75,1].forEach((ri,i)=>px.fillText('r'+(i+1),cx+ri*r+3,cy-3));
}
drawDisk();

// ── pipeline animator ──────────────────────────────────────────────────────
let step=0;
const steps=['s1','s2','s3','s4','s5'];
function animSteps(){
  steps.forEach((id,i)=>{
    const el=document.getElementById(id);
    el.classList.toggle('active',i===step);
    el.classList.toggle('done',i<step);
  });
  step=(step+1)%steps.length;
}
setInterval(animSteps,900);

// ── game shell integration ─────────────────────────────────────────────────
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'pause') { /* no-op for tool */ }
  if (e.data && e.data.type === 'resume') { /* no-op for tool */ }
});