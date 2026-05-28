
const W=innerWidth,H=innerHeight,PERSIST=0.88,NUM=8,BOX=2.0,SPARK_LIFE=1.0;
function rr(a,b){return Math.random()*(b-a)+a}function rs(){return Math.random()<.5?-1:1}
function m4(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
function m4mul(a,b){const r=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[i*4+k]*b[k*4+j];r[i*4+j]=s}return r}
function m4t(m,x,y,z){const r=m.slice();r[12]+=x*m[0]+y*m[4]+z*m[8];r[13]+=x*m[1]+y*m[5]+z*m[9];r[14]+=x*m[2]+y*m[6]+z*m[10];return r}
function m4s(m,x,y,z){const r=m.slice();r[0]*=x;r[1]*=x;r[2]*=x;r[3]*=x;r[4]*=y;r[5]*=y;r[6]*=y;r[7]*=y;r[8]*=z;r[9]*=z;r[10]*=z;r[11]*=z;return r}

const vs=`#version 300 es
layout(location=0)in vec3 pos;uniform mat4 uP,uM;
void main(){gl_Position=uP*uM*vec4(pos,1);gl_PointSize=4.0;}`;
const fs=`#version 300 es
precision highp float;uniform vec4 uC;out vec4 c;void main(){c=uC;}`;
const cvs=`#version 300 es
layout(location=0)in vec2 pos;layout(location=1)in vec2 uv;out vec2 v;
void main(){v=uv;gl_Position=vec4(pos,0,1);}`;
const cfs=`#version 300 es
precision highp float;in vec2 v;out vec4 f;
uniform sampler2D sTex,pTex;uniform float pers;
void main(){
vec2 u=v*2.0-1.0;u*=1.0-0.1*dot(u,u);u=u*0.5+0.5;
if(u.x<0.0||u.x>1.0||u.y<0.0||u.y>1.0){f=vec4(0,0,0,1);return;}
float r=texture(sTex,u+vec2(.002,0)).r;float g=texture(sTex,u).g;float b=texture(sTex,u-vec2(.002,0)).b;
vec3 cur=vec3(r,g,b);vec3 prv=texture(pTex,v).rgb*pers;vec3 cmb=cur+prv;
float scn=0.05*sin(v.y*1200.0);float vig=1.0-0.4*dot(v-0.5,v-0.5);
f=vec4(pow(cmb*(1.0-scn)*vig,vec3(1.0/1.8)),1);}`;

const c=document.getElementById('glcanvas');c.width=W;c.height=H;
const gl=c.getContext('webgl2');if(!gl)document.body.innerHTML='<p style="color:red;padding:40px">WebGL2 required</p>';

function mkS(s,t){const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw gl.getShaderInfoLog(sh);return sh}
function mkP(v,f){const p=gl.createProgram();gl.attachShader(p,mkS(v,gl.VERTEX_SHADER));gl.attachShader(p,mkS(f,gl.FRAGMENT_SHADER));gl.linkProgram(p);return p}
const p3d=mkP(vs,fs),pCRT=mkP(cvs,cfs);

const cubeV=new Float32Array([-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5,-.5,-.5,.5,-.5,-.5,.5,.5,.5,.5,.5,.5,.5,-.5,-.5,-.5,-.5,.5,-.5,-.5,.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5]);
const cubeI=new Uint32Array([0,1,2,2,3,0,4,5,6,6,7,4,8,9,10,10,11,8,12,13,14,14,15,12,16,17,18,18,19,16,20,21,22,22,23,20]);
const cVAO=gl.createVertexArray();gl.bindVertexArray(cVAO);
const cVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,cVBO);gl.bufferData(gl.ARRAY_BUFFER,cubeV,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
const cIBO=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,cIBO);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,cubeI,gl.STATIC_DRAW);

const qD=new Float32Array([-1,-1,0,0,1,-1,1,0,1,1,1,1,-1,1,0,1]);
const qI=new Uint16Array([0,1,2,2,3,0]);
const qVAO=gl.createVertexArray();gl.bindVertexArray(qVAO);
const qVBO=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qVBO);gl.bufferData(gl.ARRAY_BUFFER,qD,gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,16,0);
gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,16,8);
const qIBO=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,qIBO);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,qI,gl.STATIC_DRAW);

function mkFBO(){const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,W,H,0,gl.RGB,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);const rbo=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rbo);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,W,H);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rbo);return{fbo,tex}}
const fA=mkFBO(),fB=mkFBO();

const asp=W/H,fov=Math.PI/4,f=1/Math.tan(fov/2),nr=0.1,fr=100;
const proj=new Float32Array([f/asp,0,0,0,0,f,0,0,0,0,(fr+nr)/(nr-fr),2*fr*nr/(nr-fr),0,0,-1,0]);

let plates=[];for(let i=0;i<NUM;i++)plates.push({pos:[rr(-1,1),rr(-1,1),rr(-1,1)],vel:[rr(.03,.06)*rs(),rr(.03,.06)*rs(),rr(.03,.06)*rs()],rot:rr(0,6.28),rv:rr(.03,.08)});
let impacts=[];
let pp=true;

function render(){
const dst=pp?fA:fB,src=pp?fB.tex:fA.tex,prv=pp?fA.tex:fB.tex;
gl.bindFramebuffer(gl.FRAMEBUFFER,dst.fbo);gl.viewport(0,0,W,H);
gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
gl.enable(gl.DEPTH_TEST);gl.useProgram(p3d);
gl.uniformMatrix4fv(gl.getUniformLocation(p3d,"uP"),false,proj);

gl.bindVertexArray(cVAO);

// Cage wireframe
let cage=m4();cage=m4s(cage,BOX*2,BOX*2,BOX*2);cage[14]=-7;
gl.uniformMatrix4fv(gl.getUniformLocation(p3d,"uM"),false,cage);
gl.uniform4f(gl.getUniformLocation(p3d,"uC"),0,.2,.4,1);
gl.drawElements(gl.LINE_STRIP,cubeI.length,gl.UNSIGNED_INT,0);

// Plates
plates.forEach(p=>{
p.pos[0]+=p.vel[0];p.pos[1]+=p.vel[1];p.pos[2]+=p.vel[2];p.rot+=p.rv;
for(let a=0;a<3;a++)if(Math.abs(p.pos[a])>BOX){p.vel[a]*=-1;let ip=[...p.pos];ip[a]=BOX*Math.sign(p.pos[a]);impacts.push([ip[0],ip[1],ip[2],SPARK_LIFE])}
let m=m4();m=m4t(m,p.pos[0],p.pos[1],p.pos[2]-7);
const co=Math.cos(p.rot),si=Math.sin(p.rot);
const rM=new Float32Array([co,0,si,0,0,1,0,0,-si,0,co,0,0,0,0,1]);
m=m4mul(m,rM);m=m4s(m,1.2,.05,1.2);
gl.uniformMatrix4fv(gl.getUniformLocation(p3d,"uM"),false,m);
gl.uniform4f(gl.getUniformLocation(p3d,"uC"),0,1,.9,1);
gl.drawElements(gl.TRIANGLES,cubeI.length,gl.UNSIGNED_INT,0);
});

// Sparks as points
impacts=impacts.filter(p=>{p[3]-=.04;return p[3]>0});
if(impacts.length>0){
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
const sd=new Float32Array(impacts.flatMap(p=>[p[0],p[1],p[2]-7]));
const sVAO=gl.createVertexArray();gl.bindVertexArray(sVAO);
const sB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,sB);gl.bufferData(gl.ARRAY_BUFFER,sd,gl.DYNAMIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
let sm=m4();gl.uniformMatrix4fv(gl.getUniformLocation(p3d,"uM"),false,sm);
gl.uniform4f(gl.getUniformLocation(p3d,"uC"),1,1,.7,1);
gl.drawArrays(gl.POINTS,0,impacts.length);
gl.deleteBuffer(sB);gl.deleteVertexArray(sVAO);
gl.disable(gl.BLEND);
}

// CRT post
gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);
gl.disable(gl.DEPTH_TEST);gl.useProgram(pCRT);
gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,dst.tex);
gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,prv);
gl.uniform1i(gl.getUniformLocation(pCRT,"sTex"),0);
gl.uniform1i(gl.getUniformLocation(pCRT,"pTex"),1);
gl.uniform1f(gl.getUniformLocation(pCRT,"pers"),PERSIST);
gl.bindVertexArray(qVAO);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0);
pp=!pp;
}

(function loop(){render();requestAnimationFrame(loop)})();



// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE THRESHOLD';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7183547665536667;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.017079826305576484;mix-blend-mode:overlay';
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
