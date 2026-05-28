import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Constants ──────────────────────────────────────────────────────────────
const WORLD_RADIUS=10.0,Z_NEAR=0.1,Z_FAR=50.0;
const MOVE_SPEED=12.0,STRAFE_SPEED=7.0,VERT_SPEED=7.0,ROT_SPEED=1.5;
const N_IN=600,N_OUT=400,N_AMB=800;
const BASE_FOV=60;

// ── 140 BPM ADSR ───────────────────────────────────────────────────────────
const BPM=140,beatSec=60/BPM,T0=performance.now()/1000;
function adsr(){
  const t=(performance.now()/1000-T0)%beatSec;
  const a=.08,d=.15,s=.45,r=.32;
  if(t<a)return t/a;if(t<a+d)return 1-(t-a)/d*(1-s);
  if(t<a+d+s)return s;if(t<beatSec)return s*(1-(t-a-d-s)/r);return 0;
}
function tr(){return Math.exp(-((performance.now()/1000-T0)%beatSec)*6);}

// ── Three.js + post-processing ─────────────────────────────────────────────
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x00040a,0.035);
const camera=new THREE.PerspectiveCamera(BASE_FOV,innerWidth/innerHeight,Z_NEAR,Z_FAR);
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('c'),antialias:false});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x00040a,1);

const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloomPass=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.5,0.4,0.1);
composer.addPass(bloomPass);

window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);
});

const world=new THREE.Group();scene.add(world);

// ── GLSL: both color clocks ────────────────────────────────────────────────
const HUE=`vec3 hue(float h){h=fract(h);float x=1.-abs(mod(h*6.,2.)-1.);if(h<.1667)return vec3(1.,x,0.);if(h<.3333)return vec3(x,1.,0.);if(h<.5)return vec3(0.,1.,x);if(h<.6667)return vec3(0.,x,1.);if(h<.8333)return vec3(x,0.,1.);return vec3(1.,0.,x);}`;
const COLOR=`
vec3 inbetween(vec3 wp,float mel,float blend,float t,float bands){
  float dist=length(wp);
  float ang=atan(wp.y,wp.x)/(6.28318)+.5;
  float d01=clamp(dist/10.,0.,1.);
  float sp=fract(ang*bands*.7+d01*bands*.4+t);
  vec3 sc=hue(sp);
  float vd=max(0.,dot(normalize(wp),normalize(-wp)));
  float rim=pow(1.-clamp(vd,0.,1.),3.);
  sc=sc*(1.-rim*.4)+hue(sp+.33)*rim*.22;
  float eu=mel,ph=1.-eu,mr=eu/(eu+ph+.001);
  vec3 mc=mix(vec3(.72,.38,.15),vec3(.06,.035,.016),mr);
  mc=mix(mc*.65,mc*1.35,smoothstep(.28,.72,eu-ph*.5));
  float sLit=.22+sp*.78;
  return mix(sc*(0.28+mr*.72),mc*sLit,blend);
}`;

const U={uTime:{value:0},uBands:{value:14.0},uBlend:{value:0.5},uTr:{value:0}};

const FRAG=`varying vec3 vC;void main(){
  vec2 d=gl_PointCoord-.5;float dist=length(d);if(dist>.5)discard;
  float alpha=smoothstep(.5,.1,dist);gl_FragColor=vec4(vC,alpha*.9);}`;

// ── Spawn helpers ──────────────────────────────────────────────────────────
function rndIn(r){while(true){const x=(Math.random()-.5)*2*r,y=(Math.random()-.5)*2*r,z=(Math.random()-.5)*2*r;if(x*x+y*y+z*z<=r*r)return[x,y,z];}}
function rndOn(r){const t=Math.random()*Math.PI*2,p=Math.acos(2*Math.random()-1);return[Math.sin(p)*Math.cos(t)*r,Math.sin(p)*Math.sin(t)*r,Math.cos(p)*r];}

// ── Particle builder ───────────────────────────────────────────────────────
function makeSys(count,vert,spawnFn){
  const pos=new Float32Array(count*3),vel=new Float32Array(count*3),mel=new Float32Array(count);
  for(let i=0;i<count;i++)spawnFn(i,pos,vel,mel);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('aMel',new THREE.BufferAttribute(mel,1));
  const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,vertexShader:vert,fragmentShader:FRAG});
  world.add(new THREE.Points(geo,mat));
  return{pos,vel,mel,geo};
}

// inward — surface → core
const iSys=makeSys(N_IN,
  `${HUE}${COLOR}uniform float uTime,uBands,uBlend,uTr;attribute float aMel;varying vec3 vC;
  void main(){vec4 wp=modelMatrix*vec4(position,1.);vC=inbetween(wp.xyz,aMel,uBlend,uTime,uBands);
  gl_Position=projectionMatrix*viewMatrix*wp;float d=length(wp.xyz)/10.;gl_PointSize=max(2.,(6.5-d*4.)*(1.+uTr*.8));}`,
  (i,p,v,m)=>{const r=WORLD_RADIUS*(.75+Math.random()*.22);const[x,y,z]=rndOn(r);
    p[i*3]=x;p[i*3+1]=y;p[i*3+2]=z;m[i]=r/WORLD_RADIUS;
    const sp=.018+Math.random()*.025;v[i*3]=-x/r*sp;v[i*3+1]=-y/r*sp;v[i*3+2]=-z/r*sp;});

// outward — core → surface (Thomas attractor)
const oSys=makeSys(N_OUT,
  `${HUE}${COLOR}uniform float uTime,uBands,uBlend,uTr;attribute float aMel;varying vec3 vC;
  void main(){vec4 wp=modelMatrix*vec4(position,1.);vC=inbetween(wp.xyz,aMel,uBlend,uTime,uBands);
  gl_Position=projectionMatrix*viewMatrix*wp;float d=length(wp.xyz)/10.;gl_PointSize=max(1.5,(5.-d*3.)*(1.+uTr*.6));}`,
  (i,p,v,m)=>{const r=.4+Math.random()*1.5;const[x,y,z]=rndOn(r);
    p[i*3]=x;p[i*3+1]=y;p[i*3+2]=z;m[i]=r/WORLD_RADIUS;
    const sp=.022+Math.random()*.03;v[i*3]=x/r*sp;v[i*3+1]=y/r*sp;v[i*3+2]=z/r*sp;});

// ambient dust
const aSys=makeSys(N_AMB,
  `${HUE}${COLOR}uniform float uTime,uBands,uBlend;attribute float aMel;varying vec3 vC;
  void main(){vec4 wp=modelMatrix*vec4(position,1.);vC=inbetween(wp.xyz,aMel,uBlend,uTime,uBands)*.3;
  gl_Position=projectionMatrix*viewMatrix*wp;gl_PointSize=2.;}`,
  (i,p,v,m)=>{const[x,y,z]=rndIn(WORLD_RADIUS);p[i*3]=x;p[i*3+1]=y;p[i*3+2]=z;m[i]=Math.hypot(x,y,z)/WORLD_RADIUS;});

// contract sparks
const MAX_C=80;
const cPos=new Float32Array(MAX_C*3),cAge=new Float32Array(MAX_C).fill(1);
let cHead=0,contractCount=0;
const cGeo=new THREE.BufferGeometry();
cGeo.setAttribute('position',new THREE.BufferAttribute(cPos,3));
cGeo.setAttribute('aAge',new THREE.BufferAttribute(cAge,1));
world.add(new THREE.Points(cGeo,new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,
  blending:THREE.AdditiveBlending,
  vertexShader:`${HUE}uniform float uTime,uBands,uTr;attribute float aAge;varying vec3 vC;varying float vF;
  void main(){vec4 wp=modelMatrix*vec4(position,1.);float ph=fract(length(wp.xyz)/10.*uBands*.6+uTime);vC=hue(ph);vF=max(0.,1.-aAge);
  gl_Position=projectionMatrix*viewMatrix*wp;gl_PointSize=(5.+uTr*6.)*vF;}`,
  fragmentShader:`varying vec3 vC;varying float vF;void main(){vec2 d=gl_PointCoord-.5;if(dot(d,d)>.25)discard;gl_FragColor=vec4(vC,vF*.95);}`})));

// sphere boundary
world.add(new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.SphereGeometry(WORLD_RADIUS,24,12)),
  new THREE.LineBasicMaterial({color:0x050a08,transparent:true,opacity:.08})));

// ── Thomas attractor ───────────────────────────────────────────────────────
const T_S=0.09,T_B=0.19;
function thomas(x,y,z,b){return[Math.sin(y*T_S)-b*(x*T_S),Math.sin(z*T_S)-b*(y*T_S),Math.sin(x*T_S)-b*(z*T_S)];}

// ── Biology update ─────────────────────────────────────────────────────────
let inCount=0,outCount=0;
function updateBiology(env){
  const b=Math.max(.12,T_B-env*.04);
  for(let i=0;i<N_IN;i++){
    const x=iSys.pos[i*3],y=iSys.pos[i*3+1],z=iSys.pos[i*3+2];
    const d=Math.hypot(x,y,z)||.01;
    const pull=.0018+.001/Math.max(.05,d/WORLD_RADIUS);
    iSys.vel[i*3]+=-x/d*pull;iSys.vel[i*3+1]+=-y/d*pull;iSys.vel[i*3+2]+=-z/d*pull;
    iSys.pos[i*3]+=iSys.vel[i*3]*=.97;iSys.pos[i*3+1]+=iSys.vel[i*3+1]*=.97;iSys.pos[i*3+2]+=iSys.vel[i*3+2]*=.97;
    const nd=Math.hypot(iSys.pos[i*3],iSys.pos[i*3+1],iSys.pos[i*3+2]);
    iSys.mel[i]=Math.min(1,nd/WORLD_RADIUS);
    if(nd<.5){
      inCount++;contractCount++;
      const ci=cHead%MAX_C;
      cPos[ci*3]=iSys.pos[i*3];cPos[ci*3+1]=iSys.pos[i*3+1];cPos[ci*3+2]=iSys.pos[i*3+2];
      cAge[ci]=0;cHead++;
      const[nx,ny,nz]=rndOn(WORLD_RADIUS*(.8+Math.random()*.18));
      iSys.pos[i*3]=nx;iSys.pos[i*3+1]=ny;iSys.pos[i*3+2]=nz;
      const sp=.018;iSys.vel[i*3]=-nx/WORLD_RADIUS*sp;iSys.vel[i*3+1]=-ny/WORLD_RADIUS*sp;iSys.vel[i*3+2]=-nz/WORLD_RADIUS*sp;
    }
  }
  iSys.geo.attributes.position.needsUpdate=true;
  iSys.geo.attributes.aMel.needsUpdate=true;

  for(let i=0;i<N_OUT;i++){
    const x=oSys.pos[i*3],y=oSys.pos[i*3+1],z=oSys.pos[i*3+2];
    const d=Math.hypot(x,y,z)||.01;
    const[tx,ty,tz]=thomas(x,y,z,b);
    oSys.vel[i*3]+=x/d*.002+tx*.016;oSys.vel[i*3+1]+=y/d*.002+ty*.016;oSys.vel[i*3+2]+=z/d*.002+tz*.016;
    oSys.pos[i*3]+=oSys.vel[i*3]*=.96;oSys.pos[i*3+1]+=oSys.vel[i*3+1]*=.96;oSys.pos[i*3+2]+=oSys.vel[i*3+2]*=.96;
    oSys.mel[i]=Math.min(1,Math.hypot(oSys.pos[i*3],oSys.pos[i*3+1],oSys.pos[i*3+2])/WORLD_RADIUS);
    if(Math.hypot(oSys.pos[i*3],oSys.pos[i*3+1],oSys.pos[i*3+2])>WORLD_RADIUS*.95){
      outCount++;const r2=.3+Math.random()*1.2;const[nx,ny,nz]=rndOn(r2);
      oSys.pos[i*3]=nx;oSys.pos[i*3+1]=ny;oSys.pos[i*3+2]=nz;
      const sp=.025+Math.random()*.02;oSys.vel[i*3]=nx/r2*sp;oSys.vel[i*3+1]=ny/r2*sp;oSys.vel[i*3+2]=nz/r2*sp;
    }
  }
  oSys.geo.attributes.position.needsUpdate=true;
  oSys.geo.attributes.aMel.needsUpdate=true;

  for(let i=0;i<MAX_C;i++)cAge[i]=Math.min(1,cAge[i]+.016);
  cGeo.attributes.position.needsUpdate=true;
  cGeo.attributes.aAge.needsUpdate=true;
}

// ── Input ──────────────────────────────────────────────────────────────────
const keys={};
window.addEventListener('keydown',e=>{keys[e.code]=true;['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)&&e.preventDefault();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
const shipQ=new THREE.Quaternion(),ax_up=new THREE.Vector3(0,1,0),ax_rt=new THREE.Vector3(1,0,0),ax_fwd=new THREE.Vector3(0,0,-1),tmpQ=new THREE.Quaternion(),moveLocal=new THREE.Vector3();
let currentSpeed=0;

function handleInput(dt,trVal){
  const rs=ROT_SPEED*dt;
  if(keys['ArrowUp'])   {tmpQ.setFromAxisAngle(ax_rt, rs); shipQ.multiply(tmpQ);}
  if(keys['ArrowDown']) {tmpQ.setFromAxisAngle(ax_rt,-rs); shipQ.multiply(tmpQ);}
  if(keys['ArrowLeft']) {tmpQ.setFromAxisAngle(ax_up, rs); shipQ.multiply(tmpQ);}
  if(keys['ArrowRight']){tmpQ.setFromAxisAngle(ax_up,-rs); shipQ.multiply(tmpQ);}
  if(keys['KeyQ'])      {tmpQ.setFromAxisAngle(ax_fwd, rs); shipQ.multiply(tmpQ);}
  if(keys['KeyE'])      {tmpQ.setFromAxisAngle(ax_fwd,-rs); shipQ.multiply(tmpQ);}
  camera.quaternion.slerp(shipQ,.2);

  moveLocal.set(0,0,0);
  if(keys['KeyW'])      moveLocal.z-=MOVE_SPEED*dt;
  if(keys['KeyS'])      moveLocal.z+=MOVE_SPEED*dt;
  if(keys['KeyA'])      moveLocal.x-=STRAFE_SPEED*dt;
  if(keys['KeyD'])      moveLocal.x+=STRAFE_SPEED*dt;
  if(keys['Space'])     moveLocal.y+=VERT_SPEED*dt;
  if(keys['ShiftLeft']||keys['ShiftRight'])moveLocal.y-=VERT_SPEED*dt;

  currentSpeed=THREE.MathUtils.lerp(currentSpeed,moveLocal.z!==0?Math.abs(moveLocal.z):0,.1);
  camera.fov=BASE_FOV+(currentSpeed*120)+(trVal*5);
  camera.updateProjectionMatrix();

  if(moveLocal.length()>.001){
    moveLocal.applyQuaternion(shipQ);
    world.position.sub(moveLocal);
    if(world.position.length()>WORLD_RADIUS*.85)world.position.multiplyScalar(.96);
  }
}

// ── Loop ───────────────────────────────────────────────────────────────────
const glEl=document.getElementById('gl');
let flowTime=0,lastT=performance.now()/1000,fr=0;
function loop(){
  requestAnimationFrame(loop);
  const now=performance.now()/1000,dt=Math.min(now-lastT,.05);lastT=now;fr++;
  flowTime+=.022;
  const env=adsr(),trVal=tr();
  handleInput(dt,trVal);
  updateBiology(env);
  U.uTime.value=flowTime;U.uTr.value=trVal;
  bloomPass.strength=1.0+trVal*1.5;
  glEl.style.color=`rgba(0,255,100,${.12+trVal*.55})`;
  glEl.style.transform=`translate(-50%,${20+trVal*8}px) scale(${.9+trVal*.35})`;
  glEl.style.letterSpacing=`${3+trVal*4}px`;
  if(fr%30===0){
    document.getElementById('s0').textContent=`inward ${inCount}`;
    document.getElementById('s1').textContent=`contracts ${contractCount}`;
    document.getElementById('s2').textContent=`outward ${outCount}`;
    document.getElementById('s3').textContent=`depth ${world.position.length().toFixed(1)}`;
    inCount=0;outCount=0;
  }
  composer.render();
}
loop();
