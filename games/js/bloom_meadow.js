{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }

import * as THREE from 'three';

// ======================= CONFIG =======================
const CONFIG = {
  GRASS_COUNT: 60000, CHUNKS: 4, RAIN_COUNT: 25000, TERRAIN_SIZE: 200,
  PLAYER_HEIGHT: 2.4, MOVE_SPEED: 0.38, PUDDLE_SIZE: 256,
  MAX_RIPPLES: 250, RIPPLE_SPEED: 3.0, RIPPLE_LIFETIME: 100,
  BLOOM_RADIUS: 15, BLOOM_SPRING: 0.02, BLOOM_DAMPING: 0.88,
  CHASM_RADIUS: 28, UPDRAFT_RADIUS: 12, LOD_NEAR: 60, LOD_MID: 130
};

const WEATHER = [
  { name: 'STORM_SURGE', fogCol: 0x080a0e, fogDen: 0.035, wind: 0.8, rainSpd: -1.5, rainCol: 0x99bbff, lightning: true, puddleDecay: 0.008, uiCol: '#00ffff' },
  { name: 'BLIZZARD',    fogCol: 0xaaccff, fogDen: 0.060, wind: 1.8, rainSpd: -0.2, rainCol: 0xffffff, lightning: false, puddleDecay: 0.050, uiCol: '#ffffff' },
  { name: 'SCORCHED',    fogCol: 0x331100, fogDen: 0.015, wind: 0.1, rainSpd:  0.2, rainCol: 0xffaa55, lightning: false, puddleDecay: 0.150, uiCol: '#ffaa00' }
];

const state = { bloom:0, bloomTarget:0, weatherIdx:0, currentRainSpd:-1.5, currentPuddleDecay:0.008, windStrength:0.8, windGust:0, ripples:[], shockwaveRadius:0, isShockwaveActive:false, layer:'SURFACE', footstepCooldown:0 };
const uiBloom = document.getElementById('bloomVal');
const uiRipples = document.getElementById('rippleCount');
const uiSector = document.getElementById('sectorText');
const uiWeather = document.getElementById('weatherName');
const windDir = new THREE.Vector2(1, 0.3).normalize();
const tmpVec = new THREE.Vector3();
const playerPos = new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT, 50);
const bloomPos = new THREE.Vector3(0, CONFIG.PLAYER_HEIGHT + 5, 0);

// ======================= SCENE & CAMERA =======================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030406);
scene.fog = new THREE.FogExp2(WEATHER[0].fogCol, WEATHER[0].fogDen);

const camera = new THREE.PerspectiveCamera(82, window.innerWidth/window.innerHeight, 0.1, 1500);
camera.position.copy(playerPos);

const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:"high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0x0a1525, 0.4);
scene.add(ambient);
const lightning = new THREE.DirectionalLight(0xddeeff, 0);
lightning.position.set(0.5,1,0.2);
scene.add(lightning);
const coreLight = new THREE.PointLight(0x00ffff, 0, 150);
coreLight.position.set(0,-90,0);
scene.add(coreLight);

// ======================= TERRAIN =======================
function getTerrainHeight(x,z){return (Math.sin(x*0.15)*Math.cos(z*0.18)*0.8)+(Math.sin(x*0.05)*2)+(Math.sin(x*0.02+z*0.03)*1.5);}
const terrainGeo = new THREE.PlaneGeometry(CONFIG.TERRAIN_SIZE*2, CONFIG.TERRAIN_SIZE*2, 150,150);
terrainGeo.rotateX(-Math.PI/2);
const posAttr = terrainGeo.attributes.position;
for(let i=0;i<posAttr.count;i++) posAttr.setY(i,getTerrainHeight(posAttr.getX(i),posAttr.getZ(i)));
terrainGeo.computeVertexNormals();

const puddleCanvas = document.createElement('canvas');
puddleCanvas.width = puddleCanvas.height = CONFIG.PUDDLE_SIZE;
const puddleCtx = puddleCanvas.getContext('2d');
puddleCtx.fillStyle='#000';
puddleCtx.fillRect(0,0,CONFIG.PUDDLE_SIZE,CONFIG.PUDDLE_SIZE);
const puddleTex = new THREE.CanvasTexture(puddleCanvas);
puddleTex.wrapS = puddleTex.wrapT = THREE.ClampToEdgeWrapping;
function getPuddleHeight(x,z){
  const u = Math.floor(((x + CONFIG.TERRAIN_SIZE)/(CONFIG.TERRAIN_SIZE*2))*CONFIG.PUDDLE_SIZE);
  const v = Math.floor(((z + CONFIG.TERRAIN_SIZE)/(CONFIG.TERRAIN_SIZE*2))*CONFIG.PUDDLE_SIZE);
  if(u<0||u>=CONFIG.PUDDLE_SIZE||v<0||v>=CONFIG.PUDDLE_SIZE) return 0;
  return (puddleCtx.getImageData(u,v,1,1).data[0]/255)*0.5;
}

const terrainUniforms = { uPuddleTex:{value:puddleTex}, uBloom:{value:0}, uLightning:{value:0} };
const terrainMat = new THREE.MeshStandardMaterial({color:0x050807, roughness:0.9, metalness:0.1, side:THREE.DoubleSide});
terrainMat.onBeforeCompile = shader=>{
  shader.uniforms.uPuddleTex=terrainUniforms.uPuddleTex;
  shader.uniforms.uBloom=terrainUniforms.uBloom;
  shader.uniforms.uLightning=terrainUniforms.uLightning;
  shader.vertexShader=`uniform sampler2D uPuddleTex; varying vec2 vUv; varying vec3 vWorldPos;`+shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',`
    #include <begin_vertex>
    vUv=uv;
    vWorldPos=(modelMatrix*vec4(position,1.0)).xyz;
    vec4 puddle=texture2D(uPuddleTex,uv);
    transformed.y+=(puddle.g-0.5)*0.3*puddle.r;
  `);
  shader.fragmentShader=`uniform sampler2D uPuddleTex; uniform float uBloom; uniform float uLightning; varying vec2 vUv; varying vec3 vWorldPos;`+shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
    #include <roughnessmap_fragment>
    if(length(vWorldPos.xz)<${CONFIG.CHASM_RADIUS}.0) discard;
    vec4 puddleData = texture2D(uPuddleTex, vUv);
    float wetness = puddleData.r;
    roughnessFactor=mix(roughnessFactor,0.05,wetness*0.95);
    metalnessFactor=mix(metalnessFactor,0.6,wetness);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.05,0.08,0.1),wetness*0.7);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.2,1.4,1.3),uBloom*0.3);
    diffuseColor.rgb+=vec3(0.4,0.45,0.5)*uLightning*wetness;
  `);
};
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
scene.add(terrain);

// ======================= GRASS (PER-INSTANCE CULL) =======================
const sharedGrassUniforms = {
  uTime:{value:0}, uPlayerPos:{value:new THREE.Vector3()}, uFlash:{value:0},
  uWindDir:{value:windDir}, uWindStrength:{value:0.8}, uBloom:{value:0},
  uShockwaveRadius:{value:0.0}, uBloomPos:{value:bloomPos}
};

const grassFragmentShader=`uniform float uFlash; uniform float uBloom; varying float vY; varying vec3 vColor; varying float vShockIntensity; varying float vBloomDist;
void main(){
  vec3 baseCol=mix(vec3(0.01,0.05,0.02),vec3(0.12,0.35,0.15),vY)*vColor;
  baseCol+=vec3(0.1,0.6,0.3)*uBloom*0.3*vY;
  baseCol=mix(vec3(0.3,0.9,0.7),baseCol,smoothstep(0.0,${CONFIG.BLOOM_RADIUS}.0,vBloomDist));
  gl_FragColor=vec4(mix(baseCol,vec3(0.8,0.9,1.0),max(uFlash*vY,vShockIntensity*0.8)),1.0);
`;

// (Keep vertex shaders same as your v8.2 for brevity)

// === PER-INSTANCE POSITIONS ARRAY ===
const grassInstancePositions = [];
// ...(grass chunk setup remains, but inside the instance loop:)
for (let i=0;i<grassPerChunk;i++){
  const x=startX+Math.random()*chunkSize, z=startZ+Math.random()*chunkSize;
  if(Math.hypot(x,z)<CONFIG.CHASM_RADIUS) continue;
  dObj.position.set(x,getTerrainHeight(x,z)-0.1,z);
  dObj.rotation.set(0,Math.random()*Math.PI*2,(Math.random()-0.5)*0.2);
  dObj.scale.setScalar(0.6+Math.random()*1.2);
  dObj.updateMatrix();
  highMesh.setMatrixAt(valid,dObj.matrix);
  midMesh.setMatrixAt(valid,dObj.matrix);
  grassInstancePositions.push({chunk:grassChunks.length, x:x, z:z});
  valid++;
}

// ======================= FRUSTUM PER-INSTANCE UPDATE =======================
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();
const tmpSphere = new THREE.Sphere();

// Inside animate():
projScreenMatrix.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
frustum.setFromProjectionMatrix(projScreenMatrix);
for (let c=0;c<grassChunks.length;c++){
  const chunk = grassChunks[c];
  const high = chunk.high, mid = chunk.mid;
  const positions = grassInstancePositions.filter(p=>p.chunk===c);
  const colorAttrHigh = high.geometry.attributes.instanceColor.array;
  const colorAttrMid = mid.geometry.attributes.instanceColor.array;
  let visibleCount = 0, matrix = new THREE.Matrix4();
  for (let i=0;i<positions.length;i++){
    const pos = positions[i];
    tmpSphere.center.set(pos.x,getTerrainHeight(pos.x,pos.z)-0.1,pos.z);
    tmpSphere.radius=0.9;
    if(frustum.intersectsSphere(tmpSphere)){
      if(visibleCount!==i){
        high.getMatrixAt(i,matrix); high.setMatrixAt(visibleCount,matrix);
        mid.getMatrixAt(i,matrix); mid.setMatrixAt(visibleCount,matrix);
        for(let k=0;k<3;k++){
          const idxA=visibleCount*3+k, idxB=i*3+k;
          let tmp=colorAttrHigh[idxA]; colorAttrHigh[idxA]=colorAttrHigh[idxB]; colorAttrHigh[idxB]=tmp;
          tmp=colorAttrMid[idxA]; colorAttrMid[idxA]=colorAttrMid[idxB]; colorAttrMid[idxB]=tmp;
        }
        [positions[visibleCount],positions[i]]=[positions[i],positions[visibleCount]];
      }
      visibleCount++;
    }
  }
  high.count=mid.count=visibleCount;
  high.instanceMatrix.needsUpdate=true; mid.instanceMatrix.needsUpdate=true;
  high.geometry.attributes.instanceColor.needsUpdate=true; mid.geometry.attributes.instanceColor.needsUpdate=true;
}

// ======================= 2D SPRITE OVERLAY =======================
const spriteCanvas = document.getElementById('spriteOverlay');
const sCtx = spriteCanvas.getContext('2d');
function resizeSpriteOverlay() {
  spriteCanvas.width = window.innerWidth;
  spriteCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSpriteOverlay);
resizeSpriteOverlay();

const griefWarriorImg = new Image();
griefWarriorImg.src = '../assets/sprites/grief_warrior_sprite_sheet.png';
let griefLoaded = false;
griefWarriorImg.onload = () => { griefLoaded = true; };
griefWarriorImg.onerror = () => { griefLoaded = false; };

const geodeImg = new Image();
geodeImg.src = '../assets/sprites/geometric_core_geode_flux.png';
let geodeLoaded = false;
geodeImg.onload = () => { geodeLoaded = true; };
geodeImg.onerror = () => { geodeLoaded = false; };

let spriteTime = 0;
function drawSpriteOverlay() {
  sCtx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
  spriteTime += 0.02;
  const sw = spriteCanvas.width;
  const sh = spriteCanvas.height;

  // Grief warrior: bottom-center, bobbing with sine wave
  if (griefLoaded) {
    const warriorW = 64;
    const warriorH = 96;
    const bobY = Math.sin(spriteTime * 2) * 4;
    const wx = sw / 2 - warriorW / 2;
    const wy = sh - warriorH - 20 + bobY;
    sCtx.drawImage(griefWarriorImg, wx, wy, warriorW, warriorH);
  }

  // Geode: floating nearby as collectible indicator
  if (geodeLoaded) {
    const geodeW = 32;
    const geodeH = 32;
    const floatY = Math.sin(spriteTime * 3 + 1.5) * 6;
    const gx = sw / 2 + 60;
    const gy = sh - 60 + floatY;
    // Glow behind geode
    sCtx.save();
    const grd = sCtx.createRadialGradient(gx + geodeW / 2, gy + geodeH / 2, 2, gx + geodeW / 2, gy + geodeH / 2, 28);
    grd.addColorStop(0, 'rgba(0,255,200,0.25)');
    grd.addColorStop(1, 'rgba(0,255,200,0)');
    sCtx.fillStyle = grd;
    sCtx.beginPath();
    sCtx.arc(gx + geodeW / 2, gy + geodeH / 2, 28, 0, Math.PI * 2);
    sCtx.fill();
    sCtx.drawImage(geodeImg, gx, gy, geodeW, geodeH);
    sCtx.restore();
  }

  requestAnimationFrame(drawSpriteOverlay);
}
requestAnimationFrame(drawSpriteOverlay);

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
  var hbPeriod = 0.710201872904998;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.017728156903379227;mix-blend-mode:overlay';
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

// -- THRESHOLD AUDIO ENGINE --
var _thAudioCtx;
function thTone(freq, dur, type, vol) {
  if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var o = _thAudioCtx.createOscillator();
  var g = _thAudioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq || 440;
  o.detune.value = (Math.random() - 0.5) * 10; // happy little mistake
  g.gain.setValueAtTime((vol || 0.1), _thAudioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, _thAudioCtx.currentTime + (dur || 0.2));
  o.connect(g); g.connect(_thAudioCtx.destination);
  o.start(); o.stop(_thAudioCtx.currentTime + (dur || 0.2));
}
function thClick() { thTone(800, 0.06, 'sine', 0.08); }
function thSuccess() { thTone(523, 0.1, 'sine', 0.12); setTimeout(function(){thTone(659, 0.1, 'sine', 0.12)}, 70); setTimeout(function(){thTone(784, 0.15, 'triangle', 0.1)}, 140); }
function thFail() { thTone(200, 0.15, 'sawtooth', 0.06); }
function thPickup() { thTone(880, 0.08, 'sine', 0.1); setTimeout(function(){thTone(1100, 0.12, 'sine', 0.08)}, 50); }
document.addEventListener('click', function() { if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }, {once: true});

// -- THRESHOLD PARTICLE SYSTEM --
var _thParticles = [];
function thSpawnParticles(x, y, count, color) {
  for (var i = 0; i < (count || 8); i++) {
    _thParticles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1,
      color: color || '#00ffd2',
      size: 2 + Math.random() * 3
    });
  }
}
function thUpdateParticles(ctx) {
  for (var i = _thParticles.length - 1; i >= 0; i--) {
    var p = _thParticles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05; // gravity
    p.vx *= 0.98;
    p.life -= 0.025;
    if (p.life <= 0) { _thParticles.splice(i, 1); continue; }
    if (ctx) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

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