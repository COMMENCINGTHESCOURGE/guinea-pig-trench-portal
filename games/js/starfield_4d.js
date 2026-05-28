const canvas=document.getElementById('gl');const gl=canvas.getContext('webgl2',{antialias:true,alpha:false});if(!gl){document.body.innerHTML='<p style="color:#f44;padding:40px;font-family:monospace">WebGL2 required</p>';throw 0}
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.enable(gl.DEPTH_TEST);
let W,H;function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;gl.viewport(0,0,W,H)}addEventListener('resize',resize);resize();
const VS=`#version 300 es
precision highp float;in vec4 in_position;in float in_seed;uniform mat4 uMVP;uniform vec3 uCameraPos,uCameraVel;uniform float uTime,uDepthScale,uParallaxSpeed,uStreakMode,uWarpMode;out float vTwinklePhase,vDepth,vSpeed;
vec4 rotate4D(vec4 p,float t1,float t2){float c1=cos(t1),s1=sin(t1),c2=cos(t2),s2=sin(t2);return vec4(p.x*c1-p.y*s1,p.x*s1+p.y*c1,p.z*c2-p.w*s2,p.z*s2+p.w*c2);}
vec4 vortexWarp(vec4 p,float t){float r=length(p.xz),tw=t*0.4*uDepthScale/(r+0.3),cx=cos(tw),sx=sin(tw);return vec4(p.x*cx-p.z*sx,p.y,p.x*sx+p.z*cx,p.w);}
vec4 spiralWarp(vec4 p,float t){float ang=atan(p.y,p.x)+t*0.3*uDepthScale+in_seed*0.01,r=length(p.xy);return vec4(r*cos(ang),r*sin(ang),p.zw);}
void main(){float ro=in_seed*0.1,t1=uTime*uDepthScale*0.5+ro,t2=uTime*uDepthScale*0.3-ro*0.7;vec4 p=in_position;
if(uWarpMode<0.5)p=rotate4D(p,t1,t2);else if(uWarpMode<1.5){p=rotate4D(p,t1*0.5,t2*0.5);p=vortexWarp(p,uTime);}else if(uWarpMode<2.5){p=spiralWarp(p,uTime);p=rotate4D(p,t1*0.3,t2*0.3);}else{float pulse=1.0+0.18*sin(uTime*1.8+in_seed*0.4);p=rotate4D(p*pulse,t1,t2);}
float w_depth=1.0+p.w*0.8+sin(uTime*2.0+in_seed)*0.2;vDepth=clamp(1.0/w_depth,0.0,2.0);vec3 pos3d=p.xyz*vDepth;pos3d+=uCameraPos*uParallaxSpeed*uDepthScale;vTwinklePhase=in_seed;vSpeed=length(uCameraVel)*uStreakMode;
gl_Position=uMVP*vec4(pos3d+uCameraVel*uStreakMode*0.12,1.0);gl_PointSize=clamp(1.5+vDepth*5.0,0.5,10.0);}`;
const FS=`#version 300 es
precision mediump float;in float vTwinklePhase,vDepth,vSpeed;uniform vec3 uLayerColor;uniform float uAlpha;uniform highp float uTime;out vec4 fragColor;
void main(){vec2 uv=gl_PointCoord-vec2(0.5);float d=length(uv),glow=1.0-smoothstep(0.3,0.5,d),core=1.0-smoothstep(0.0,0.18,d);float tw=sin(uTime*(2.0+vTwinklePhase*1.5))*0.35+0.65,br=(glow*0.6+core*0.4)*tw*vDepth;if(br<0.05)discard;
vec3 color=mix(uLayerColor,vec3(0.75,0.88,1.0),vSpeed*0.6);color=mix(color,vec3(1.0),core*0.4*vDepth);fragColor=vec4(color,uAlpha*br*0.85);}`;
function compile(t,s){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(sh));return sh}
const prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,VS));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);gl.useProgram(prog);
const U={};['uMVP','uCameraPos','uCameraVel','uTime','uDepthScale','uParallaxSpeed','uLayerColor','uAlpha','uStreakMode','uWarpMode'].forEach(n=>{U[n]=gl.getUniformLocation(prog,n)});
const inPos=gl.getAttribLocation(prog,'in_position'),inSeed=gl.getAttribLocation(prog,'in_seed');
const LC=[{count:1800,depthScale:.08,color:[.35,.52,1],alpha:.22,parallax:.04},{count:1400,depthScale:.28,color:[.55,.72,1],alpha:.42,parallax:.14},{count:900,depthScale:.58,color:[.78,.88,1],alpha:.72,parallax:.38},{count:500,depthScale:1,color:[1,1,1],alpha:1,parallax:1}];
function makeLayer(c){const n=c.count,d=new Float32Array(n*5);for(let i=0;i<n;i++){const ph=Math.random()*Math.PI*2,th=Math.random()*Math.PI,r=.8+Math.random()*.5;d[i*5]=r*Math.sin(th)*Math.cos(ph);d[i*5+1]=r*Math.sin(th)*Math.sin(ph);d[i*5+2]=r*Math.cos(th);d[i*5+3]=-1.2+Math.random()*2.4;d[i*5+4]=Math.random()*100}const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.enableVertexAttribArray(inPos);gl.vertexAttribPointer(inPos,4,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(inSeed);gl.vertexAttribPointer(inSeed,1,gl.FLOAT,false,20,16);gl.bindVertexArray(null);return{vao,cfg:c}}
const layers=LC.map(makeLayer);
let nebOn=true,nebTex,nebVAO,nebProg;
const NVS=`#version 300 es\nin vec2 aPos;out vec2 vUV;void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0,1);}`;
const NFS=`#version 300 es\nprecision mediump float;in vec2 vUV;uniform sampler2D uTex;uniform float uAlpha;out vec4 fragColor;void main(){vec4 c=texture(uTex,vUV);fragColor=vec4(c.rgb,c.a*uAlpha);}`;
function buildNeb(){const s=512,oc=document.createElement('canvas');oc.width=oc.height=s;const o=oc.getContext('2d');[{x:.3,y:.35,r:.28,c:'rgba(30,60,140,'},{x:.7,y:.6,r:.22,c:'rgba(80,20,110,'},{x:.5,y:.2,r:.18,c:'rgba(10,80,120,'},{x:.2,y:.75,r:.14,c:'rgba(20,100,80,'},{x:.8,y:.3,r:.16,c:'rgba(60,10,90,'}].forEach(b=>{const g=o.createRadialGradient(b.x*s,b.y*s,0,b.x*s,b.y*s,b.r*s);g.addColorStop(0,b.c+'.18)');g.addColorStop(.5,b.c+'.08)');g.addColorStop(1,b.c+'0)');o.fillStyle=g;o.fillRect(0,0,s,s)});nebTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,nebTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,oc);gl.generateMipmap(gl.TEXTURE_2D);nebProg=gl.createProgram();gl.attachShader(nebProg,compile(gl.VERTEX_SHADER,NVS));gl.attachShader(nebProg,compile(gl.FRAGMENT_SHADER,NFS));gl.linkProgram(nebProg);const q=new Float32Array([-1,-1,1,-1,-1,1,1,1]),qv=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qv);gl.bufferData(gl.ARRAY_BUFFER,q,gl.STATIC_DRAW);nebVAO=gl.createVertexArray();gl.bindVertexArray(nebVAO);const a=gl.getAttribLocation(nebProg,'aPos');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,8,0);gl.bindVertexArray(null)}buildNeb();
function renderNeb(t){if(!nebOn)return;gl.useProgram(nebProg);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,nebTex);gl.uniform1i(gl.getUniformLocation(nebProg,'uTex'),0);gl.uniform1f(gl.getUniformLocation(nebProg,'uAlpha'),.18+.05*Math.sin(t*.18));gl.bindVertexArray(nebVAO);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.bindVertexArray(null);gl.enable(gl.DEPTH_TEST);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.useProgram(prog)}
const PALS=[null,[[.9,.6,.2],[.95,.75,.3],[1,.9,.55],[1,1,.9]],[[.7,.15,.35],[.85,.25,.5],[.95,.45,.7],[1,.8,.95]],[[.1,.7,.3],[.3,.85,.45],[.6,.95,.6],[.85,1,.85]]];let palI=0;
function getLC(i){const p=PALS[palI];return p?p[i]:LC[i].color}
function perspective(fov,asp,n,f){const ff=1/Math.tan(fov*.5),nf=1/(n-f);return new Float32Array([ff/asp,0,0,0,0,ff,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])}
function lookAt(e,c,u){let fx=c[0]-e[0],fy=c[1]-e[1],fz=c[2]-e[2];const fl=Math.hypot(fx,fy,fz);fx/=fl;fy/=fl;fz/=fl;let rx=fy*u[2]-fz*u[1],ry=fz*u[0]-fx*u[2],rz=fx*u[1]-fy*u[0];const rl=Math.hypot(rx,ry,rz);rx/=rl;ry/=rl;rz/=rl;const ux=ry*fz-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy-ry*fx;return new Float32Array([rx,ux,-fx,0,ry,uy,-fy,0,rz,uz,-fz,0,-(rx*e[0]+ry*e[1]+rz*e[2]),-(ux*e[0]+uy*e[1]+uz*e[2]),fx*e[0]+fy*e[1]+fz*e[2],1])}
function mulM4(a,b){const r=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)r[i*4+j]+=a[i*4+k]*b[k*4+j];return r}
const cam={pos:[0,0,0],vel:[0,0,0],yaw:0,pitch:0};let mdx=0,mdy=0;
function camUpdate(dt){cam.yaw+=mdx*.003;cam.pitch+=mdy*.003;cam.pitch=Math.max(-1.48,Math.min(1.48,cam.pitch));mdx=mdy=0;const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);const fw=[sy*cp,sp,cy*cp],rt=[cy,0,-sy];const spd=(keys.ShiftLeft||keys.ShiftRight?50:22)*dt;let tx=0,ty=0,tz=0;if(keys.KeyW){tx+=fw[0]*spd;ty+=fw[1]*spd;tz+=fw[2]*spd}if(keys.KeyS){tx-=fw[0]*spd;ty-=fw[1]*spd;tz-=fw[2]*spd}if(keys.KeyA){tx-=rt[0]*spd;tz-=rt[2]*spd}if(keys.KeyD){tx+=rt[0]*spd;tz+=rt[2]*spd}if(keys.Space)ty+=spd;if(keys.ShiftLeft&&!keys.KeyW&&!keys.KeyS)ty-=spd*.5;const lp=1-Math.pow(.001,dt);cam.vel[0]+=(tx-cam.vel[0])*lp*9;cam.vel[1]+=(ty-cam.vel[1])*lp*9;cam.vel[2]+=(tz-cam.vel[2])*lp*9;if(!keys.KeyW&&!keys.KeyS&&!keys.KeyA&&!keys.KeyD&&!keys.Space){cam.vel[0]*=.92;cam.vel[1]*=.92;cam.vel[2]*=.92}cam.pos[0]+=cam.vel[0];cam.pos[1]+=cam.vel[1];cam.pos[2]+=cam.vel[2];return{view:lookAt(cam.pos,[cam.pos[0]+fw[0],cam.pos[1]+fw[1],cam.pos[2]+fw[2]],[0,1,0]),proj:perspective(65*Math.PI/180,W/H,.01,200)}}
const keys={};let streakM=0,warpM=0,locked=false;
const banner=document.getElementById('mode-banner');let bTimer;function flash(m){banner.textContent=m;banner.classList.add('show');clearTimeout(bTimer);bTimer=setTimeout(()=>banner.classList.remove('show'),1400)}
const PN=['PALETTE: COLD BLUE','PALETTE: AMBER GOLD','PALETTE: CRIMSON','PALETTE: ACID GREEN'];function setP(i){palI=i;flash(PN[i])}
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyL')streakM=streakM>.5?0:1;if(e.code==='KeyN'){nebOn=!nebOn;flash(nebOn?'NEBULA ON':'NEBULA OFF')}if(e.code==='KeyT'){warpM=(warpM+1)%4;flash(['WARP: STANDARD','WARP: VORTEX','WARP: SPIRAL','WARP: PULSED'][warpM])}if(e.code==='Digit1')setP(0);if(e.code==='Digit2')setP(1);if(e.code==='Digit3')setP(2);if(e.code==='Digit4')setP(3);if(e.code==='Escape'){document.exitPointerLock();locked=false}});
addEventListener('keyup',e=>{keys[e.code]=false});addEventListener('mousemove',e=>{if(locked){mdx+=e.movementX;mdy+=e.movementY}});
const ov=document.getElementById('overlay');
function requestLock(){const req=document.body.requestPointerLock({unadjustedMovement:true});if(req&&req.catch)req.catch(()=>{document.body.requestPointerLock()})}
ov.addEventListener('click',requestLock);canvas.addEventListener('click',()=>{if(!locked)requestLock()});
document.addEventListener('pointerlockchange',()=>{locked=!!document.pointerLockElement;ov.classList.toggle('hidden',locked)});
document.addEventListener('pointerlockerror',()=>{try{document.body.requestPointerLock()}catch(e){}});
let t=0,last=0;function frame(ts){const dt=Math.min(.05,(ts-last)/1000);last=ts;t+=dt;const{view,proj}=camUpdate(dt);const mvp=mulM4(proj,view);const vl=Math.hypot(...cam.vel);const ds=streakM>.5?Math.min(1.2,vl*.55+.15):0;gl.clearColor(.008,.008,.03,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderNeb(t);gl.useProgram(prog);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);for(let i=0;i<layers.length;i++){const{vao,cfg}=layers[i];gl.uniformMatrix4fv(U.uMVP,false,mvp);gl.uniform3fv(U.uCameraPos,cam.pos);gl.uniform3fv(U.uCameraVel,cam.vel);gl.uniform1f(U.uTime,t);gl.uniform1f(U.uDepthScale,cfg.depthScale);gl.uniform1f(U.uParallaxSpeed,cfg.parallax);gl.uniform3fv(U.uLayerColor,getLC(i));gl.uniform1f(U.uAlpha,cfg.alpha);gl.uniform1f(U.uStreakMode,ds);gl.uniform1f(U.uWarpMode,warpM);gl.bindVertexArray(vao);gl.drawArrays(gl.POINTS,0,cfg.count);gl.bindVertexArray(null)}requestAnimationFrame(frame)}
requestAnimationFrame(ts=>{last=ts;requestAnimationFrame(frame)});

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
  var hbPeriod = 0.6638331744890855;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.018046257260269902;mix-blend-mode:overlay';
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