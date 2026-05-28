{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}

import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';

const cv=document.getElementById('tmc');
const wrap=document.getElementById('tmw');
const W=()=>wrap.clientWidth||900;
const H=()=>Math.round(W()*0.65);
cv.width=W();cv.height=H();

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,W()/H(),0.1,500);
camera.position.set(0,0,58);
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setSize(W(),H());renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));

let bParam=0.19,bands=10,blend=0.5,flowTime=0,flowSpeed=0.018,isoVal=0.25;
const BPM=140,beatSec=60/BPM;
let t0=performance.now()/1000;
function adsr(){
  const t=(performance.now()/1000-t0)%beatSec;
  const a=0.08,d=0.15,s=0.45,r=0.32;
  if(t<a)return t/a;if(t<a+d)return 1-(t-a)/d*(1-s);
  if(t<a+d+s)return s;if(t<beatSec)return s*(1-(t-a-d-s)/r);return 0;
}

const bgUni={uTime:{value:0},uBands:{value:bands},uBlend:{value:blend}};
const bgMat=new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:bgUni,
vertexShader:`varying vec3 vW;void main(){vW=normalize((modelMatrix*vec4(position,1.)).xyz);gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.);}`,
fragmentShader:`uniform float uTime,uBands,uBlend;varying vec3 vW;
vec3 hue(float h){h=fract(h);float x=1.-abs(mod(h*6.,2.)-1.);
if(h<.1667)return vec3(1.,x,0.);if(h<.3333)return vec3(x,1.,0.);
if(h<.5)return vec3(0.,1.,x);if(h<.6667)return vec3(0.,x,1.);
if(h<.8333)return vec3(x,0.,1.);return vec3(1.,0.,x);}
void main(){
  float phi=acos(clamp(vW.y,-1.,1.))/3.14159;
  float theta=(atan(vW.z,vW.x)/6.28318+.5);
  float phase=fract(phi*uBands*.6+theta*uBands*.4+uTime*.15);
  gl_FragColor=vec4(hue(phase)*mix(.04,.003,uBlend),1.);}`});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(200,32,16),bgMat));

const isoUni={uTime:{value:0},uBands:{value:bands},uBlend:{value:blend},uCamPos:{value:camera.position}};
const isoMat=new THREE.ShaderMaterial({uniforms:isoUni,
vertexShader:`
uniform float uTime,uBands,uBlend;uniform vec3 uCamPos;
varying vec3 vCol;varying vec3 vNorm;varying vec3 vWP;
vec3 hue(float h){h=fract(h);float x=1.-abs(mod(h*6.,2.)-1.);
  if(h<.1667)return vec3(1.,x,0.);if(h<.3333)return vec3(x,1.,0.);
  if(h<.5)return vec3(0.,1.,x);if(h<.6667)return vec3(0.,x,1.);
  if(h<.8333)return vec3(x,0.,1.);return vec3(1.,0.,x);}
void main(){
  vec4 wp=modelMatrix*vec4(position,1.);
  vWP=wp.xyz;vNorm=normalize(normalMatrix*normal);
  vec3 toC=normalize(uCamPos-wp.xyz);
  float vd=max(0.,dot(vNorm,toC));
  float sp=fract(vd*uBands+uTime);
  vec3 sc=hue(sp);
  float rim=pow(1.-vd,3.+uBlend*3.);
  sc=sc*(1.-rim*.45)+hue(sp+.33)*rim*.25;
  float dist=length(wp.xyz)/40.;
  float eu=clamp(dist,0.,1.),ph=1.-eu;
  float mr=eu/(eu+ph+.001);
  vec3 mc2=mix(vec3(.72,.38,.15),vec3(.06,.035,.016),mr);
  float tur=smoothstep(.28,.72,eu-ph*.5);
  mc2=mix(mc2*.62,mc2*1.38,tur);
  float sLit=.22+sp*.78;
  vCol=mix(sc*(0.28+mr*.72),mc2*sLit,uBlend);
  gl_Position=projectionMatrix*viewMatrix*wp;}`,
fragmentShader:`
uniform vec3 uCamPos;varying vec3 vCol;varying vec3 vNorm;varying vec3 vWP;
void main(){
  vec3 L=normalize(vec3(1.4,1.8,2.));
  vec3 V=normalize(uCamPos-vWP);
  float diff=max(0.,dot(vNorm,L))*.6+.4;
  float spec=pow(max(0.,dot(reflect(-L,vNorm),V)),50.)*.18;
  vec3 col=vCol*diff+vec3(spec);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);}`,
side:THREE.DoubleSide});

const VOL=40;
const mc=new MarchingCubes(VOL,isoMat,true,true,150000);
mc.scale.set(48,48,48);mc.isolation=isoVal;
scene.add(mc);

const N=180,T_SCALE=0.11;
const tips=[];
function randSphere(r){
  const t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);
  return new THREE.Vector3(Math.sin(p)*Math.cos(t)*r,Math.sin(p)*Math.sin(t)*r,Math.cos(p)*r);
}
for(let i=0;i<N;i++) tips.push({p:randSphere(4+Math.random()*30),v:new THREE.Vector3((Math.random()-.5)*.3,(Math.random()-.5)*.3,(Math.random()-.5)*.3)});

const tGeo=new THREE.BufferGeometry();
const tPos=new Float32Array(N*3),tMel=new Float32Array(N);
tGeo.setAttribute('position',new THREE.BufferAttribute(tPos,3));
tGeo.setAttribute('aMelanin',new THREE.BufferAttribute(tMel,1));
const tipMat2=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
uniforms:{uTime:{value:0},uBands:{value:bands},uBlend:{value:blend},uCamPos:{value:camera.position}},
vertexShader:`uniform float uTime,uBands,uBlend;uniform vec3 uCamPos;attribute float aMelanin;varying vec3 vC;
vec3 hue(float h){h=fract(h);float x=1.-abs(mod(h*6.,2.)-1.);if(h<.1667)return vec3(1.,x,0.);if(h<.3333)return vec3(x,1.,0.);if(h<.5)return vec3(0.,1.,x);if(h<.6667)return vec3(0.,x,1.);if(h<.8333)return vec3(x,0.,1.);return vec3(1.,0.,x);}
void main(){vec4 wp=modelMatrix*vec4(position,1.);float vd=max(0.,dot(normalize(wp.xyz),normalize(uCamPos-wp.xyz)));float sp=fract(vd*uBands+uTime);float mr=aMelanin;vec3 mc2=mix(vec3(.7,.36,.14),vec3(.07,.04,.016),mr);float sL=.2+sp*.8;vC=mix(hue(sp)*(0.25+mr*.75),mc2*sL,uBlend);gl_Position=projectionMatrix*viewMatrix*wp;gl_PointSize=max(1.2,(2.5-length(wp.xyz)/50.)*1.5);}`,
fragmentShader:`varying vec3 vC;void main(){vec2 d=gl_PointCoord-.5;if(dot(d,d)>.25)discard;gl_FragColor=vec4(vC,0.6);}`});
scene.add(new THREE.Points(tGeo,tipMat2));

function thomas(p,b){
  const s=T_SCALE;
  return new THREE.Vector3(
    Math.sin(p.y*s)-b*(p.x*s),
    Math.sin(p.z*s)-b*(p.y*s),
    Math.sin(p.x*s)-b*(p.z*s));
}
function deposit(p){
  const half=48;
  const vx=Math.floor((p.x+half)/(half*2)*VOL),vy=Math.floor((p.y+half)/(half*2)*VOL),vz=Math.floor((p.z+half)/(half*2)*VOL);
  if(vx<0||vx>=VOL||vy<0||vy>=VOL||vz<0||vz>=VOL)return;
  const idx=vx+(vy*VOL)+(vz*VOL*VOL);
  if(idx>=0&&idx<mc.field.length)mc.field[idx]=Math.min(mc.field[idx]+0.018,1.0);
}
const tmp=new THREE.Vector3();
function updateTips(env){
  const dynB=Math.max(0.10,bParam-(env*0.04));
  for(let i=0;i<N;i++){
    const t=tips[i];
    const tf=thomas(t.p,dynB);
    tmp.copy(t.p).negate().normalize().multiplyScalar(0.011+env*0.018);
    tmp.add(tf.multiplyScalar(0.038));
    t.v.add(tmp);t.v.multiplyScalar(0.93);
    t.p.add(t.v.clone().multiplyScalar(0.55));
    if(t.p.length()>46){t.p.setLength(46);t.v.multiplyScalar(-.55);}
    deposit(t.p);
    tPos[i*3]=t.p.x;tPos[i*3+1]=t.p.y;tPos[i*3+2]=t.p.z;
    tMel[i]=Math.min(1,t.p.length()/36);
  }
  tGeo.attributes.position.needsUpdate=true;
  tGeo.attributes.aMelanin.needsUpdate=true;
  for(let i=0;i<mc.field.length;i++)mc.field[i]*=0.9985;
  mc.isolation=isoVal;
}

let drag=false,ox=0,oy=0,oT=0,oP=0.12;
cv.addEventListener('mousedown',e=>{drag=true;ox=e.clientX;oy=e.clientY;e.preventDefault();});
window.addEventListener('mouseup',()=>{drag=false;});
window.addEventListener('mousemove',e=>{if(!drag)return;oT+=(e.clientX-ox)*.006;oP=Math.max(-1.3,Math.min(1.3,oP+(e.clientY-oy)*.006));ox=e.clientX;oy=e.clientY;});
cv.addEventListener('wheel',e=>{camera.position.z=Math.max(22,Math.min(95,camera.position.z+(e.deltaY>0?1.3:-1.3)));e.preventDefault();},{passive:false});
let tp={};
cv.addEventListener('touchstart',e=>{e.preventDefault();for(const t of e.changedTouches)tp[t.identifier]={x:t.clientX,y:t.clientY};},{passive:false});
cv.addEventListener('touchend',e=>{for(const t of e.changedTouches)delete tp[t.identifier];},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){const p=tp[t.identifier];if(p){oT+=(t.clientX-p.x)*.006;oP=Math.max(-1.3,Math.min(1.3,oP+(t.clientY-p.y)*.006));}tp[t.identifier]={x:t.clientX,y:t.clientY};}},{passive:false});

document.getElementById('tmbp').addEventListener('input',e=>bParam=parseFloat(e.target.value));
document.getElementById('tmbnd').addEventListener('input',e=>{bands=parseFloat(e.target.value);[isoUni,bgUni,tipMat2.uniforms].forEach(u=>{if(u.uBands)u.uBands.value=bands;});});
document.getElementById('tmblend').addEventListener('input',e=>{blend=parseFloat(e.target.value);[isoUni,bgUni,tipMat2.uniforms].forEach(u=>{if(u.uBlend)u.uBlend.value=blend;});const m=document.getElementById('tmmode');if(blend<0.15){m.textContent='\u25CF structural';m.style.color='#0ff';}else if(blend>0.85){m.textContent='\u25CF melanin';m.style.color='#c07030';}else{m.textContent='\u25CF inbetween';m.style.color='#fa0';}});
document.getElementById('tmiso').addEventListener('input',e=>{isoVal=parseFloat(e.target.value);mc.isolation=isoVal;});
window.addEventListener('resize',()=>{cv.width=W();cv.height=H();renderer.setSize(W(),H());camera.aspect=W()/H();camera.updateProjectionMatrix();});

window.exportMesh=function(){
  try{
    const exp=new GLTFExporter();
    exp.parse(mc,gltf=>{
      const blob=new Blob([JSON.stringify(gltf)],{type:'application/json'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download='thomas_fungi_maze.gltf';a.click();
    },{binary:false});
  }catch(e){console.warn('export error:',e);}
};

let autoT=0;
function loop(){
  requestAnimationFrame(loop);
  flowTime+=flowSpeed;
  const env=adsr();
  autoT+=0.0025;
  const finalT=autoT+oT,r=camera.position.z;
  camera.position.x=Math.sin(finalT)*Math.cos(oP)*r;
  camera.position.y=Math.sin(oP)*r;
  camera.position.z=Math.cos(finalT)*Math.cos(oP)*r;
  camera.lookAt(0,0,0);
  [isoUni,bgUni,tipMat2.uniforms].forEach(u=>{if(u.uTime)u.uTime.value=flowTime;if(u.uCamPos)u.uCamPos.value.copy(camera.position);});
  updateTips(env);
  renderer.render(scene,camera);
}
loop();