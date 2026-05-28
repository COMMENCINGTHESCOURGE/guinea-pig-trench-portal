const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2',{antialias:false,powerPreference:'high-performance'});
if(!gl){document.getElementById('info').textContent='WebGL2 required';throw 0}

let W,H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight}
resize();addEventListener('resize',resize);

const SEEDS=[9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];

// ── Biome presets (from Mandelbulb Studio) ──
const PRESETS=[
  {n:'Cyber',   a:'#0AEBAa',b:'#ED1299',c:'#F5BA12',d:'#12E88A',pw:8},
  {n:'Deep',    a:'#0A70EB',b:'#1A0850',c:'#20D0C0',d:'#060830',pw:8},
  {n:'Lava',    a:'#961E1E',b:'#FF7820',c:'#FFD040',d:'#301008',pw:9},
  {n:'Forest',  a:'#00C8B4',b:'#1A3020',c:'#40A060',d:'#0A2018',pw:7},
  {n:'Void',    a:'#6414A0',b:'#200830',c:'#B040FF',d:'#0A0418',pw:10},
  {n:'Ice',     a:'#6496FF',b:'#C0D8FF',c:'#FFFFFF',d:'#304060',pw:8},
  {n:'Bloom',   a:'#FF96C8',b:'#C83078',c:'#FFD0E0',d:'#601840',pw:6},
  {n:'Radiant', a:'#FFFFFF',b:'#C0C0D0',c:'#FFFFE0',d:'#808090',pw:8},
];

// ── State ──
let theta=0.5,phi=0.3,dist=2.5,mode=0,dragging=false,lastX=0,lastY=0,autoRotate=true;
let power=8,iterations=10,blend=0.5;
let colA,colB,colC,colD;
function hexToGL(h){return[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255]}
function glToHex(c){return'#'+c.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}

// Sprite texture
const SPRITE_SIZE=64;
function generateMechaSprite(size){
  const d=new Uint8Array(size*size*4),cx=size/2,cy=size/2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4,dx=x-cx,dy=y-cy,dist2=Math.sqrt(dx*dx+dy*dy);
    let v=0;
    if(dy<-size*.3&&dist2<size*.15)v=200;
    if(dy<-size*.35&&Math.abs(dx)>size*.08&&Math.abs(dx)<size*.2&&dy>-size*.48)v=180;
    if(dy>=-size*.3&&dy<size*.1&&Math.abs(dx)<size*.2)v=220;
    if(dy>-size*.15&&dy<-size*.05&&Math.abs(dx)<size*.15)v=255;
    if(dy>=-size*.05&&dy<size*.1&&Math.abs(dx)<size*.04)v=255;
    if(dy>-size*.2&&dy<size*.35&&Math.abs(dx)>=size*.18&&Math.abs(dx)<size*.35){
      const w=1-(dy+size*.2)/(size*.55);if(Math.abs(dx)<size*(.18+w*.17))v=160}
    if(dy>=size*.1&&dy<size*.4&&(Math.abs(dx)<size*.06||(Math.abs(dx)>size*.08&&Math.abs(dx)<size*.14)))v=190;
    d[i]=v>0?0:0;d[i+1]=v>0?Math.min(255,v+30):0;d[i+2]=v>0?Math.min(255,v-10):0;d[i+3]=v;
  }
  return d;
}
const spriteData=generateMechaSprite(SPRITE_SIZE);
const spriteTex=gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D,spriteTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,SPRITE_SIZE,SPRITE_SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,spriteData);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

// ══ UNIFIED SHADER — all 5 modes + orbit trap palette ══
const VS=`#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS=`#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTheta,uPhi,uDist,uPower,uTime,uBlend;
uniform int uMode,uIter;
uniform vec3 uColA,uColB,uColC,uColD;
uniform sampler2D uSprite;
in vec2 uv;out vec4 O;

const int MAX_STEPS=80;
const float MAX_DIST=8.,EPS=.0008;

float spriteH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  return texture(uSprite,st).a*.8;
}

float sdfHeight(vec3 p){float h=spriteH(p.xz);return p.y-h*.5+.25;}
float sdfRevolve(vec3 p){float r=length(p.xz);return r-spriteH(vec2(r,p.y+.5))*.5;}
float sdfCross(vec3 p){float h1=spriteH(p.xy),h2=spriteH(p.xz);return max(abs(p.z)-h1*.3,abs(p.y)-h2*.3);}

// Mandelbulb with variable power + orbit traps
vec4 bulbFull(vec3 p){
  vec3 z=p;float dr=1.,r=0.,tr1=1e9,tr2=1e9;int n=0;
  for(int i=0;i<16;i++){
    if(i>=uIter)break;
    r=length(z);if(r>2.)break;n=i;
    tr1=min(tr1,length(z.xy));tr2=min(tr2,abs(z.z));
    float th=acos(clamp(z.y/r,-1.,1.)),ph=atan(z.x,z.z);
    dr=pow(r,uPower-1.)*uPower*dr+1.;
    float zr=pow(r,uPower);th*=uPower;ph*=uPower;
    z=zr*vec3(sin(th)*sin(ph),cos(th),sin(th)*cos(ph))+p;
  }
  return vec4(.5*log(max(r,1e-6))*r/dr,tr1,tr2,float(n)/float(uIter));
}
float sdfBulb(vec3 p){return bulbFull(p).x;}

// Hybrid: blend sprite SDF with mandelbulb using uBlend
float sdfHybrid(vec3 p){
  float sprite=sdfHeight(p);
  float bulb=sdfBulb(p);
  // Smooth min blend controlled by uBlend
  float k=.3+uBlend*.7;
  float h=clamp(.5+.5*(bulb-sprite)/k,0.,1.);
  return mix(bulb,sprite,h)-k*h*(1.-h);
}

float sdf(vec3 p){
  if(uMode==0)return sdfHeight(p);
  if(uMode==1)return sdfRevolve(p);
  if(uMode==2)return sdfCross(p);
  if(uMode==3)return sdfBulb(p);
  return sdfHybrid(p);
}

vec3 calcN(vec3 p){const float h=.001;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*sdf(p+k.xyy*h)+k.yyx*sdf(p+k.yyx*h)+k.yxy*sdf(p+k.yxy*h)+k.xxx*sdf(p+k.xxx*h));}

float calcAO(vec3 p,vec3 n){float o=0.,s=1.;
  for(int i=0;i<5;i++){float d=.02+.08*float(i);o+=(d-sdf(p+n*d))*s;s*=.6;}
  return clamp(1.-2.*o,0.,1.);}

vec3 orbitPal(float t1,float t2,float ti){
  vec3 c=mix(uColA,uColB,clamp(t1*3.,0.,1.));
  c=mix(c,uColC,clamp(t2*5.,0.,1.)*.42);
  return mix(c,uColD,ti*.22);
}

void main(){
  vec2 p=(gl_FragCoord.xy-uRes*.5)/uRes.y;
  float ct=cos(uTheta),st2=sin(uTheta),cp=cos(uPhi),sp=sin(uPhi);
  vec3 eye=uDist*vec3(st2*cp,sp,ct*cp);
  vec3 fwd=normalize(-eye),rt=normalize(cross(fwd,vec3(0,1,0))),up=cross(rt,fwd);
  vec3 rd=normalize(p.x*rt+p.y*up+1.5*fwd);

  // Stars
  vec2 seed=floor(gl_FragCoord.xy/2.);
  float hn=fract(sin(dot(seed,vec2(127.1,311.7)))*43758.5);
  float star=step(.997,hn)*fract(sin(dot(seed,vec2(269.5,183.3)))*43758.5);
  vec3 col=vec3(.04,.04,.06)+star*vec3(.4,.5,.7)*.4;

  float t=0.;
  for(int i=0;i<MAX_STEPS;i++){
    vec3 pos=eye+rd*t;
    float d=sdf(pos);
    if(d<EPS){
      vec3 n=calcN(pos);float ao=calcAO(pos,n);
      vec3 ld=normalize(vec3(.6,.8,-.4));
      float diff=max(dot(n,ld),0.);
      float spec=pow(max(dot(reflect(-ld,n),-rd),0.),48.);
      float fr=pow(1.-max(dot(-rd,n),0.),4.);

      // Color: orbit trap palette drives everything
      // Cross-section (mode 2) gets full fractal coloring — that's what makes the boulder
      vec3 baseCol;
      if(uMode==0){
        // Height map: sprite texture + orbit tint
        vec2 tc=pos.xz*.5+.5;
        vec4 sc=texture(uSprite,clamp(tc,0.,1.));
        baseCol=sc.rgb*.3+orbitPal(.5,.5,.5)*.7;
      } else if(uMode==1){
        // Revolution: radial sample + orbit palette
        vec2 tc=vec2(length(pos.xz),pos.y+.5);
        vec4 sc=texture(uSprite,clamp(tc,0.,1.));
        float trap1=length(pos.xy)*.8;float trap2=abs(pos.z)*1.2;
        baseCol=sc.rgb*.2+orbitPal(trap1,trap2,sc.a)*.8;
      } else if(uMode==2){
        // CROSS-SECTION: full orbit trap palette — the boulder mode
        // Use position-based orbit traps for natural rock/crystal coloring
        float trap1=length(pos.xy)*1.5;
        float trap2=abs(pos.z)*2.;
        float trapI=fract(length(pos)*3.)*.8;
        // Layer in sprite alpha as detail variation
        vec2 tc1=pos.xy*.5+.5,tc2=pos.xz*.5+.5;
        float detail=max(texture(uSprite,clamp(tc1,0.,1.)).a,texture(uSprite,clamp(tc2,0.,1.)).a);
        baseCol=orbitPal(trap1,trap2,trapI)*(0.7+detail*0.4);
        // Add mineral vein highlights from sprite edges
        float edge=abs(dFdx(detail))+abs(dFdy(detail));
        baseCol+=uColC*edge*8.;
      } else {
        // Mandelbulb + Hybrid: full orbit trap from bulb function
        vec4 trap=bulbFull(pos);
        baseCol=orbitPal(trap.y,trap.z,trap.w);
      }

      col=baseCol*(.12+diff*.75)*ao;
      col+=vec3(1.,.95,.85)*spec*1.1*ao;
      col+=baseCol*fr*.3*ao;
      // SSS
      float sss=pow(clamp(dot(-rd,n)+.3,0.,1.),3.);
      col+=uColB*sss*.12*ao;
      // Fog
      col=mix(vec3(.04,.04,.06),col,exp(-max(t-2.,0.)*.25));
      break;
    }
    t+=d;if(t>MAX_DIST)break;
  }

  // Tonemap + gamma
  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
  col=pow(col,vec3(1./2.2));
  // Vignette
  col*=.5+.5*pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.12);
  // Scanline
  col*=.94+.06*sin(gl_FragCoord.y*3.14);
  O=vec4(col,1.);
}`;

function mkShader(src,type){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}return s}
const prog=gl.createProgram();
gl.attachShader(prog,mkShader(VS,gl.VERTEX_SHADER));
gl.attachShader(prog,mkShader(FS,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);gl.useProgram(prog);

const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const aLoc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);

const U={};
['uRes','uTheta','uPhi','uDist','uPower','uTime','uMode','uIter','uBlend',
 'uColA','uColB','uColC','uColD','uSprite'].forEach(n=>U[n]=gl.getUniformLocation(prog,n));
gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,spriteTex);gl.uniform1i(U.uSprite,0);

// ── Apply preset ──
function applyPreset(i){
  const p=PRESETS[i];
  colA=hexToGL(p.a);colB=hexToGL(p.b);colC=hexToGL(p.c);colD=hexToGL(p.d);
  power=p.pw;
  document.getElementById('sl-power').value=power*100;
  document.getElementById('v-power').textContent=power.toFixed(1);
  document.getElementById('col-a').value=p.a;
  document.getElementById('col-b').value=p.b;
  document.getElementById('col-c').value=p.c;
  document.getElementById('col-d').value=p.d;
}
applyPreset(0);

// Build preset swatches
const pbox=document.getElementById('presets');
PRESETS.forEach((p,i)=>{
  const d=document.createElement('div');
  d.style.cssText=`width:20px;height:14px;background:${p.a};cursor:pointer;border:1px solid rgba(255,255,255,.1);border-radius:2px`;
  d.title=p.n;d.onclick=()=>applyPreset(i);
  pbox.appendChild(d);
});

// ── DNA Panel wiring ──
const $=id=>document.getElementById(id);
$('sl-power').oninput=e=>{power=e.target.value/100;$('v-power').textContent=power.toFixed(1)};
$('sl-iter').oninput=e=>{iterations=+e.target.value;$('v-iter').textContent=iterations};
$('sl-blend').oninput=e=>{blend=e.target.value/100;$('v-blend').textContent=blend.toFixed(2)};
['col-a','col-b','col-c','col-d'].forEach((id,i)=>{
  $(id).oninput=e=>{const c=hexToGL(e.target.value);if(i===0)colA=c;else if(i===1)colB=c;else if(i===2)colC=c;else colD=c};
});

// ── Crossbreeding ──
let breedHistory=[];
const breedLog=$('breed-log');
function logBreed(msg){breedHistory.unshift(msg);if(breedHistory.length>8)breedHistory.pop();
  breedLog.innerHTML=breedHistory.map(l=>`<div>${l}</div>`).join('')}

function crossbreed(){
  // Save current as parent A
  const parentA={power,colA:[...colA],colB:[...colB],colC:[...colC],colD:[...colD]};
  // Pick a random preset as parent B
  const pi=Math.floor(Math.random()*PRESETS.length);
  const pb=PRESETS[pi];
  const parentB={power:pb.pw,colA:hexToGL(pb.a),colB:hexToGL(pb.b),colC:hexToGL(pb.c),colD:hexToGL(pb.d)};

  const seed=SEEDS[Math.floor(Math.random()*SEEDS.length)];
  const mix=(seed%100)/100;

  // Blend
  power=parentA.power*mix+parentB.power*(1-mix);
  colA=colA.map((v,k)=>v*mix+parentB.colA[k]*(1-mix));
  colB=colB.map((v,k)=>v*mix+parentB.colB[k]*(1-mix));
  colC=colC.map((v,k)=>v*mix+parentB.colC[k]*(1-mix));
  colD=colD.map((v,k)=>v*mix+parentB.colD[k]*(1-mix));

  // Mutation (happy little mistake)
  power+=(.5-Math.random())*.8;
  power=Math.max(3,Math.min(14,power));
  colA=colA.map(v=>Math.min(1,Math.max(0,v+(Math.random()-.5)*.08)));

  // Update UI
  $('sl-power').value=power*100;$('v-power').textContent=power.toFixed(1);
  $('col-a').value=glToHex(colA);$('col-b').value=glToHex(colB);
  $('col-c').value=glToHex(colC);$('col-d').value=glToHex(colD);

  logBreed(`BRED: current x ${pb.n} (seed=${seed}, mix=${mix.toFixed(2)}) pw=${power.toFixed(1)}`);
  addToGallery();
}

function mutate(){
  power+=(.5-Math.random())*1.5;power=Math.max(3,Math.min(14,power));
  colA=colA.map(v=>Math.min(1,Math.max(0,v+(Math.random()-.5)*.15)));
  colB=colB.map(v=>Math.min(1,Math.max(0,v+(Math.random()-.5)*.15)));
  $('sl-power').value=power*100;$('v-power').textContent=power.toFixed(1);
  $('col-a').value=glToHex(colA);$('col-b').value=glToHex(colB);
  logBreed(`MUTATED: pw=${power.toFixed(1)}`);
  addToGallery();
}

$('btn-breed').onclick=crossbreed;
$('btn-random').onclick=mutate;

// ── Gallery — snapshot current fractal ──
function addToGallery(){
  gl.finish();
  const pixels=new Uint8Array(W*H*4);
  gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  const cap=document.createElement('canvas');cap.width=48;cap.height=48;
  const cx=cap.getContext('2d');
  const src=document.createElement('canvas');src.width=W;src.height=H;
  const sx=src.getContext('2d');const id=sx.createImageData(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const si=((H-1-y)*W+x)*4,di=(y*W+x)*4;
    id.data[di]=pixels[si];id.data[di+1]=pixels[si+1];id.data[di+2]=pixels[si+2];id.data[di+3]=255;
  }
  sx.putImageData(id,0,0);
  const sq=Math.min(W,H),ox=(W-sq)/2,oy=(H-sq)/2;
  cx.drawImage(src,ox,oy,sq,sq,0,0,48,48);

  // Store DNA with this snapshot
  const dna={power,mode,colA:[...colA],colB:[...colB],colC:[...colC],colD:[...colD]};

  const card=document.createElement('canvas');card.width=48;card.height=48;
  card.className='gcard';card.getContext('2d').drawImage(cap,0,0);
  card.onclick=()=>{
    power=dna.power;mode=dna.mode;
    colA=[...dna.colA];colB=[...dna.colB];colC=[...dna.colC];colD=[...dna.colD];
    $('sl-power').value=power*100;$('v-power').textContent=power.toFixed(1);
    $('col-a').value=glToHex(colA);$('col-b').value=glToHex(colB);
    $('col-c').value=glToHex(colC);$('col-d').value=glToHex(colD);
    document.querySelectorAll('.gcard').forEach(c=>c.classList.remove('active'));
    card.classList.add('active');
    document.querySelectorAll('#mode span').forEach(s=>s.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  };
  $('gallery').appendChild(card);
  // Keep gallery manageable
  const cards=document.querySelectorAll('.gcard');
  if(cards.length>12)cards[0].remove();
}

// ── Sprite sheet export ──
async function exportSheet(){
  const saved={theta,phi,dist};
  const frames=[];phi=.25;dist=2.2;
  $('info').innerHTML='EXPORTING SPRITE SHEET...';
  for(let i=0;i<8;i++){
    theta=(i/8)*Math.PI*2;
    gl.viewport(0,0,W,H);
    gl.uniform2f(U.uRes,W,H);gl.uniform1f(U.uTheta,theta);gl.uniform1f(U.uPhi,phi);
    gl.uniform1f(U.uDist,dist);gl.uniform1f(U.uPower,power);gl.uniform1i(U.uMode,mode);
    gl.uniform1i(U.uIter,iterations);gl.uniform1f(U.uBlend,blend);
    gl.uniform3fv(U.uColA,colA);gl.uniform3fv(U.uColB,colB);
    gl.uniform3fv(U.uColC,colC);gl.uniform3fv(U.uColD,colD);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.finish();
    const px=new Uint8Array(W*H*4);gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
    const f=document.createElement('canvas');f.width=128;f.height=128;
    const fx=f.getContext('2d');const s=document.createElement('canvas');s.width=W;s.height=H;
    const sx2=s.getContext('2d');const id2=sx2.createImageData(W,H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const si=((H-1-y)*W+x)*4,di=(y*W+x)*4;
      id2.data[di]=px[si];id2.data[di+1]=px[si+1];id2.data[di+2]=px[si+2];id2.data[di+3]=255;
    }
    sx2.putImageData(id2,0,0);
    const sq=Math.min(W,H),ox=(W-sq)/2,oy=(H-sq)/2;
    fx.drawImage(s,ox,oy,sq,sq,0,0,128,128);
    frames.push(f);
    $('info').innerHTML=`EXPORTING... ${i+1}/8`;
    await new Promise(r=>setTimeout(r,50));
  }
  // Strip
  const strip=document.createElement('canvas');strip.width=128*8;strip.height=128;
  const stx=strip.getContext('2d');
  frames.forEach((f,i)=>stx.drawImage(f,i*128,0));
  const url=strip.toDataURL('image/png');
  const a=document.createElement('a');a.href=url;
  a.download=`fractal_sculptor_${['height','revolve','cross','bulb','hybrid'][mode]}_pw${power.toFixed(0)}.png`;
  a.click();
  theta=saved.theta;phi=saved.phi;dist=saved.dist;
  $('info').innerHTML='EXPORTED! 8 angles x 128px<br><br>FRACTAL SCULPTOR<br>GUINEA PIG TRENCH';
}
$('btn-export').onclick=exportSheet;

// ── Input ──
canvas.addEventListener('mousedown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.classList.add('drag');autoRotate=false});
addEventListener('mouseup',()=>{dragging=false;canvas.classList.remove('drag')});
addEventListener('mousemove',e=>{if(!dragging)return;theta+=(e.clientX-lastX)*.008;
  phi=Math.max(-1.2,Math.min(1.2,phi+(e.clientY-lastY)*.008));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('wheel',e=>{dist=Math.max(.5,Math.min(8,dist+e.deltaY*.003));e.preventDefault()},{passive:false});
canvas.addEventListener('dblclick',()=>{theta=.5;phi=.3;dist=2.5;autoRotate=true});

// Mode switching
document.querySelectorAll('#mode span').forEach(el=>el.addEventListener('click',()=>{
  mode=parseInt(el.dataset.mode);
  document.querySelectorAll('#mode span').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
}));

addEventListener('keydown',e=>{
  const n=parseInt(e.key);
  if(n>=1&&n<=5){mode=n-1;document.querySelectorAll('#mode span').forEach(s=>s.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active')}
  if(e.key==='g'||e.key==='G')exportSheet();
  if(e.key==='b'||e.key==='B')crossbreed();
});

// Drag-and-drop sprite loading
canvas.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'});
canvas.addEventListener('drop',e=>{
  e.preventDefault();const file=e.dataTransfer.files[0];
  if(!file||!file.type.startsWith('image/'))return;
  const img=new Image();
  img.onload=()=>{
    const tmp=document.createElement('canvas');tmp.width=SPRITE_SIZE;tmp.height=SPRITE_SIZE;
    tmp.getContext('2d').drawImage(img,0,0,SPRITE_SIZE,SPRITE_SIZE);
    const imgData=tmp.getContext('2d').getImageData(0,0,SPRITE_SIZE,SPRITE_SIZE);
    gl.bindTexture(gl.TEXTURE_2D,spriteTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,SPRITE_SIZE,SPRITE_SIZE,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(imgData.data.buffer));
    $('info').innerHTML=`LOADED: ${file.name}<br>${img.width}x${img.height}<br><br>G:EXPORT B:BREED 1-5:MODE`;
  };
  img.src=URL.createObjectURL(file);
});

// ── Render loop ──
let fc=0,lastFps=0;
function render(t){
  t*=.001;resize();gl.viewport(0,0,W,H);
  if(autoRotate)theta+=.005;
  gl.uniform2f(U.uRes,W,H);gl.uniform1f(U.uTheta,theta);gl.uniform1f(U.uPhi,phi);
  gl.uniform1f(U.uDist,dist);gl.uniform1f(U.uPower,power);gl.uniform1f(U.uTime,t);
  gl.uniform1i(U.uMode,mode);gl.uniform1i(U.uIter,iterations);gl.uniform1f(U.uBlend,blend);
  gl.uniform3fv(U.uColA,colA);gl.uniform3fv(U.uColB,colB);
  gl.uniform3fv(U.uColC,colC);gl.uniform3fv(U.uColD,colD);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  fc++;if(t-lastFps>1){$('fps').innerHTML=`${fc} FPS<br>${['HEIGHT','REVOLVE','CROSS','BULB','HYBRID'][mode]}`;fc=0;lastFps=t}
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
  wn.textContent = 'THE BETWEEN';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.716126331856771;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01988177216528606;mix-blend-mode:overlay';
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