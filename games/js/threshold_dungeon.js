// ══════════════════════════════════════════════════════
// THRESHOLD DUNGEON
// The Threshold's raymarched worlds + Dungeon Shooter's gameplay
// Cross-pollinated into one experience
// ══════════════════════════════════════════════════════

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', {antialias:false, alpha:false, powerPreference:'high-performance'});
if(!gl){document.body.innerHTML='<p style="color:red;padding:40px">WebGL2 required</p>';throw 0}

let W, H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;gl.viewport(0,0,W,H)}
resize();addEventListener('resize',resize);

// ── Game State ──
let gameMode = 'SURVIVAL';
let playing = false;
let hp = 100, maxHp = 100;
let score = 0;
let playerX = 0, playerZ = 0, playerY = 1.5;
let yaw = 0, pitch = 0;
let locked = false;
let gameTime = 0;

// ── Dungeon Grid (10x10 rooms) ──
const GRID_SIZE = 10;
const ROOM_SIZE = 12.0;
let dungeonGrid = []; // 0=open, 1=wall
let roomWorlds = []; // which world each room belongs to

function generateDungeon(){
  dungeonGrid = [];
  roomWorlds = [];
  for(let r=0;r<GRID_SIZE;r++){
    dungeonGrid[r] = [];
    roomWorlds[r] = [];
    for(let c=0;c<GRID_SIZE;c++){
      // Border is always wall
      if(r===0||r===GRID_SIZE-1||c===0||c===GRID_SIZE-1){
        dungeonGrid[r][c] = 1;
      } else {
        // 25% walls, 75% open
        dungeonGrid[r][c] = Math.random() < 0.25 ? 1 : 0;
      }
      // Assign random world to each room
      roomWorlds[r][c] = Math.floor(Math.random() * 5);
    }
  }
  // Ensure start and a path exist
  dungeonGrid[1][1] = 0;
  dungeonGrid[1][2] = 0;
  dungeonGrid[2][1] = 0;
  // Place player at start
  playerX = 1.5 * ROOM_SIZE;
  playerZ = 1.5 * ROOM_SIZE;
}

function getRoomAt(x, z){
  const c = Math.floor(x / ROOM_SIZE);
  const r = Math.floor(z / ROOM_SIZE);
  if(r<0||r>=GRID_SIZE||c<0||c>=GRID_SIZE) return {solid:1, world:0};
  return {solid: dungeonGrid[r][c], world: roomWorlds[r][c]};
}

function isWalkable(x, z){
  const room = getRoomAt(x, z);
  return room.solid === 0;
}

// ── Sprite texture ──
const spriteTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, spriteTex);
gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,200,180,255]));
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
const akuImg = new Image();
akuImg.crossOrigin='anonymous';
akuImg.src='../assets/sprites/aku_aku_mask_stylized.png';
akuImg.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,spriteTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,akuImg)};

// ── Shader ──
const VS=`#version 300 es
in vec2 a;out vec2 uv;
void main(){uv=a*.5+.5;gl_Position=vec4(a,0,1);}`;

const FS=`#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPlayerPos;
uniform float uYaw, uPitch;
uniform sampler2D uSprite;
// Dungeon grid passed as uniforms
uniform int uGrid[100]; // 10x10 flattened
uniform int uWorlds[100];
in vec2 uv;out vec4 O;

const int STEPS=60;
const float FAR=40.,EPS=.005;
const float ROOM=12.;
const int GSIZ=10;

float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5);}

float sprH(vec2 p){
  vec2 st=p*.5+.5;
  if(st.x<0.||st.x>1.||st.y<0.||st.y>1.)return 0.;
  vec4 c=texture(uSprite,st);
  return (c.r*.3+c.g*.5+c.b*.2)*c.a;
}

// Get world ID for a position
int getWorld(vec3 p){
  int c=int(floor(p.x/ROOM));
  int r=int(floor(p.z/ROOM));
  if(c<0||c>=GSIZ||r<0||r>=GSIZ)return 0;
  return uWorlds[r*GSIZ+c];
}

// Is this position a wall?
bool isWall(vec3 p){
  int c=int(floor(p.x/ROOM));
  int r=int(floor(p.z/ROOM));
  if(c<0||c>=GSIZ||r<0||r>=GSIZ)return true;
  return uGrid[r*GSIZ+c]==1;
}

// World-specific detail SDF added to walls
float worldDetail(vec3 p, int w){
  if(w==0){
    // PINK HOUR: pulsing pillars in room corners
    vec2 rp=mod(p.xz,ROOM)-ROOM*.5;
    return length(rp)-.3-.1*sin(uTime*2.+p.x);
  } else if(w==1){
    // THE BLOCK: neon edge lines
    vec2 rp=mod(p.xz,ROOM)-ROOM*.5;
    return min(abs(rp.x)-ROOM*.4, abs(rp.y)-ROOM*.4);
  } else if(w==2){
    // THRESHOLD: aku mask on back wall
    vec3 mp=(p-vec3(floor(p.x/ROOM)*ROOM+ROOM*.5, 0., floor(p.z/ROOM)*ROOM+ROOM*.5));
    mp.y-=1.5;mp*=.3;
    float h1=sprH(mp.xy),h2=sprH(mp.xz);
    return max(abs(mp.z)-h1*.2, abs(mp.y)-h2*.2);
  } else if(w==3){
    // VAULT: sensor strips on walls
    return sin(p.y*15.+p.x*10.)*.02;
  }
  // BETWEEN: void spheres
  float d=999.;
  for(int i=0;i<3;i++){
    float fi=float(i);
    vec3 center=vec3(mod(p.x,ROOM)*.5+fi*2.,1.+sin(uTime+fi)*.5,mod(p.z,ROOM)*.5);
    d=min(d,length(p-floor(p/ROOM)*ROOM-center)-.4);
  }
  return -d; // inverted = the void
}

// Main scene SDF
float scene(vec3 p, out int hitWorld){
  // Ground and ceiling
  float ground=p.y;
  float ceiling=3.5-p.y;
  float d=min(ground,ceiling);
  hitWorld=-1;

  // Walls from dungeon grid
  int c=int(floor(p.x/ROOM));
  int r=int(floor(p.z/ROOM));

  // Check current cell and neighbors
  for(int dr=-1;dr<=1;dr++){
    for(int dc=-1;dc<=1;dc++){
      int cr=r+dr, cc=c+dc;
      if(cr<0||cr>=GSIZ||cc<0||cc>=GSIZ)continue;
      if(uGrid[cr*GSIZ+cc]==0)continue;

      // Wall box for this cell
      vec3 cellCenter=vec3((float(cc)+.5)*ROOM, 1.75, (float(cr)+.5)*ROOM);
      vec3 q=abs(p-cellCenter)-vec3(ROOM*.5, 1.75, ROOM*.5);
      float wall=min(max(q.x,max(q.y,q.z)),0.)+length(max(q,0.));
      // Invert — we're inside the dungeon, walls are solid
      if(-wall<d){
        d=-wall;
        hitWorld=uWorlds[cr*GSIZ+cc];
      }
    }
  }

  // Room doorways — cut openings between adjacent open rooms
  // (simplified: just ensure open rooms have no walls between them)

  // Add world-specific details to nearby walls
  if(d<1.0){
    int w=getWorld(p);
    float detail=worldDetail(p,w);
    // Subtle detail — don't overwhelm the base geometry
    d+=detail*.03;
  }

  return d;
}

vec3 calcN(vec3 p){int dummy;const float h=.004;const vec2 k=vec2(1.,-1.);
  return normalize(k.xyy*scene(p+k.xyy*h,dummy)+k.yyx*scene(p+k.yyx*h,dummy)+
    k.yxy*scene(p+k.yxy*h,dummy)+k.xxx*scene(p+k.xxx*h,dummy));}

vec3 worldFog(int w){
  if(w==0)return vec3(.12,.04,.10);
  if(w==1)return vec3(.02,.04,.06);
  if(w==2)return vec3(.02,.04,.05);
  if(w==3)return vec3(.04,.02,.01);
  return vec3(.0,.0,.02);
}
vec3 worldLight(int w){
  if(w==0)return vec3(1.,.4,.6);
  if(w==1)return vec3(.2,1.,.6);
  if(w==2)return vec3(1.,.7,.4);
  if(w==3)return vec3(1.,.6,.2);
  return vec3(.3,.5,1.);
}

void main(){
  vec2 fc=(uv-.5)*vec2(uRes.x/uRes.y,1.);

  // First-person camera from player position
  float cy=cos(uPitch),sy=sin(uPitch),cw=cos(uYaw),sw=sin(uYaw);
  vec3 fwd=vec3(sw*cy,sy,cw*cy);
  vec3 rt=normalize(cross(fwd,vec3(0,1,0)));
  vec3 up=cross(rt,fwd);
  vec3 rd=normalize(fc.x*rt+fc.y*up+1.5*fwd);
  vec3 eye=uPlayerPos;

  // Current room's world for fog
  int currentWorld=getWorld(eye);
  vec3 fogCol=worldFog(currentWorld);
  vec3 col=fogCol;

  float t=0.;int hitWorld;
  for(int i=0;i<STEPS;i++){
    vec3 p=eye+rd*t;
    float d=scene(p,hitWorld);
    if(abs(d)<EPS){
      vec3 n=calcN(p);

      int w=(hitWorld>=0)?hitWorld:currentWorld;
      vec3 lightCol=worldLight(w);
      vec3 ld=normalize(vec3(.5,.7,-.3));
      float diff=max(dot(n,ld),0.);
      float spec=pow(max(dot(reflect(-ld,n),-rd),0.),32.);

      // Floor/ceiling color
      vec3 baseCol;
      if(hitWorld<0){
        // Ground or ceiling
        float grid=smoothstep(.46,.48,max(abs(fract(p.x*.5)-.5),abs(fract(p.z*.5)-.5)));
        baseCol=vec3(.06,.07,.08)+grid*lightCol*.05;
      } else {
        // World-colored wall
        baseCol=fogCol*2.+lightCol*.15;
        // 0.7s heartbeat pulse for vault
        if(w==3){
          float hb=pow(max(sin(uTime/0.7*6.2832),0.),8.);
          baseCol+=vec3(.4,.15,.05)*hb*.2;
        }
      }

      // AO approximation
      float ao=1.;
      for(int j=0;j<3;j++){
        int dummy;
        float h2=.05+.15*float(j);
        ao-=(h2-scene(p+n*h2,dummy))*.3;
      }
      ao=clamp(ao,.2,1.);

      col=baseCol*(.1+diff*lightCol*1.2)*ao;
      col+=lightCol*spec*.3*ao;

      // Fog
      float fogAmt=1.-exp(-max(t-3.,0.)*.08);
      col=mix(col,fogCol,fogAmt);
      break;
    }
    t+=d*.8; // slight understep for safety
    if(t>FAR)break;
  }

  // ACES + gamma
  col=clamp((col*(2.51*col+.03))/(col*(2.43*col+.59)+.14),0.,1.);
  col=pow(col,vec3(1./2.2));

  // Vignette
  col*=.4+.6*pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.18);

  // Grain
  col+=(hash(gl_FragCoord.xy+uTime*80.)-.5)*.012;

  O=vec4(col,1.);
}`;

// Compile
function mkS(src,type){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(s));return null}return s}
const prog=gl.createProgram();
gl.attachShader(prog,mkS(VS,gl.VERTEX_SHADER));
gl.attachShader(prog,mkS(FS,gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
if(!gl.getProgramParameter(prog,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
const aLoc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(aLoc);
gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);

const U={};
['uRes','uTime','uPlayerPos','uYaw','uPitch','uSprite'].forEach(n=>U[n]=gl.getUniformLocation(prog,n));
const uGrid=gl.getUniformLocation(prog,'uGrid[0]');
const uWorlds=gl.getUniformLocation(prog,'uWorlds[0]');

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D,spriteTex);
gl.uniform1i(U.uSprite,0);

// ── Input ──
const keys={};
addEventListener('keydown',e=>{keys[e.code]=true;
  if(e.code==='Tab'){e.preventDefault();gameMode=gameMode==='SURVIVAL'?'CREATIVE':'SURVIVAL';
    document.getElementById('mode-label').textContent=gameMode;
    document.getElementById('mode-btn').textContent='MODE: '+gameMode}});
addEventListener('keyup',e=>{keys[e.code]=false});
document.addEventListener('pointerlockchange',()=>{locked=!!document.pointerLockElement});
canvas.addEventListener('click',()=>{if(!locked&&playing)canvas.requestPointerLock()});
addEventListener('mousemove',e=>{
  if(!locked||!playing)return;
  yaw+=e.movementX*.002;
  pitch=Math.max(-1.2,Math.min(1.2,pitch-e.movementY*.002));
});

// ── Start button ──
document.getElementById('mode-btn').addEventListener('click',()=>{
  gameMode=gameMode==='SURVIVAL'?'CREATIVE':'SURVIVAL';
  document.getElementById('mode-btn').textContent='MODE: '+gameMode;
  document.getElementById('mode-label').textContent=gameMode;
});
document.getElementById('go-btn').addEventListener('click',()=>{
  generateDungeon();
  playing=true;
  hp=100;score=0;
  if(gameMode==='CREATIVE'){hp=9999;maxHp=9999}else{hp=100;maxHp=100}
  document.getElementById('start').classList.add('hidden');
  canvas.requestPointerLock();
});

// ── Minimap ──
const mmCtx=document.getElementById('minimap').getContext('2d');
function drawMinimap(){
  const s=100,ts=s/GRID_SIZE;
  mmCtx.fillStyle='rgba(0,0,0,.7)';
  mmCtx.fillRect(0,0,s,s);
  const WORLD_COLORS=['#ff66aa','#00ff9d','#00b8c8','#ff8833','#6688ff'];
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      if(dungeonGrid[r]&&dungeonGrid[r][c]===1){
        mmCtx.fillStyle='#1a2030';
        mmCtx.fillRect(c*ts,r*ts,ts,ts);
      } else if(dungeonGrid[r]){
        mmCtx.fillStyle=WORLD_COLORS[roomWorlds[r][c]];
        mmCtx.globalAlpha=.15;
        mmCtx.fillRect(c*ts,r*ts,ts,ts);
        mmCtx.globalAlpha=1;
      }
    }
  }
  // Player
  const px=(playerX/ROOM/GRID_SIZE)*s;
  const py=(playerZ/ROOM/GRID_SIZE)*s;
  mmCtx.fillStyle='#fff';
  mmCtx.beginPath();mmCtx.arc(px,py,3,0,Math.PI*2);mmCtx.fill();
  // Direction
  mmCtx.strokeStyle='#00ffd2';mmCtx.lineWidth=1.5;
  mmCtx.beginPath();mmCtx.moveTo(px,py);
  mmCtx.lineTo(px+Math.sin(yaw)*8,py+Math.cos(yaw)*8);
  mmCtx.stroke();
}

// ── Upload dungeon to GPU ──
function uploadDungeon(){
  const gridFlat=new Int32Array(100);
  const worldFlat=new Int32Array(100);
  for(let r=0;r<GRID_SIZE;r++){
    for(let c=0;c<GRID_SIZE;c++){
      gridFlat[r*GRID_SIZE+c]=dungeonGrid[r]?dungeonGrid[r][c]:1;
      worldFlat[r*GRID_SIZE+c]=roomWorlds[r]?roomWorlds[r][c]:0;
    }
  }
  gl.uniform1iv(uGrid,gridFlat);
  gl.uniform1iv(uWorlds,worldFlat);
}

// ── Game Loop ──
function update(dt){
  if(!playing)return;
  gameTime+=dt;

  const speed=(keys.ShiftLeft?8:4)*dt;
  const fwdX=Math.sin(yaw),fwdZ=Math.cos(yaw);
  const rightX=Math.cos(yaw),rightZ=-Math.sin(yaw);

  let dx=0,dz=0;
  if(keys.KeyW){dx+=fwdX;dz+=fwdZ}
  if(keys.KeyS){dx-=fwdX;dz-=fwdZ}
  if(keys.KeyA){dx-=rightX;dz-=rightZ}
  if(keys.KeyD){dx+=rightX;dz+=rightZ}

  // Collision
  const newX=playerX+dx*speed;
  const newZ=playerZ+dz*speed;
  if(isWalkable(newX,playerZ))playerX=newX;
  if(isWalkable(playerX,newZ))playerZ=newZ;

  // Update HUD
  const room=getRoomAt(playerX,playerZ);
  const WORLD_NAMES=['PINK HOUR','THE BLOCK','THE THRESHOLD','VAULT COMPOUND 7','THE BETWEEN'];
  const WORLD_COLORS=['#ff66aa','#00ff9d','#00b8c8','#ff8833','#6688ff'];
  document.getElementById('world-name').textContent=WORLD_NAMES[room.world];
  document.getElementById('world-name').style.color=WORLD_COLORS[room.world];
  document.getElementById('hp-fill').style.width=(hp/maxHp*100)+'%';
  document.getElementById('hp-fill').style.background=hp>40?'#00ff9d':'#ff4444';
  document.getElementById('hp-text').textContent='HP '+Math.floor(hp);
  document.getElementById('score').textContent=score;
}

function render(t){
  t*=.001;
  const dt=Math.min(1/30,1/60);
  update(dt);
  resize();

  if(playing){
    uploadDungeon();
    gl.uniform2f(U.uRes,W,H);
    gl.uniform1f(U.uTime,t);
    gl.uniform3f(U.uPlayerPos,playerX,playerY,playerZ);
    gl.uniform1f(U.uYaw,yaw);
    gl.uniform1f(U.uPitch,pitch);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    drawMinimap();
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

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