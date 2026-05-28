
// ========== CONSTANTS ==========
const BASE_SPEED = 30;
const BOOST_MULT = 2.8;
const BRAKE_DRAG = 0.92;
const INERTIA_LERP = 0.045;
const CAMERA_LAG = 0.06;
const MAX_SHIELDS = 3;
const MAX_FUEL = 100;
const FUEL_DRAIN = 12; // per second while boosting
const FUEL_PICKUP_AMT = 30;
const BARREL_ROLL_TIME = 0.4;
const BARREL_ROLL_WINDOW = 0.3; // seconds between taps
const ASTEROID_COUNT = 60;
const CHECKPOINT_COUNT = 8;
const FUEL_PICKUP_COUNT = 10;
const SPAWN_RANGE = 600;
const SPAWN_DEPTH = 1200;
const SHAKE_DECAY = 0.9;

// Projectile constants
const PROJECTILE_SPEED = 250;
const PROJECTILE_POOL_SIZE = 20;
const FIRE_RATE = 3; // shots per second
const PROJECTILE_LIFETIME = 2.0; // seconds

// Missile constants
const MISSILE_SPEED = 120;
const MISSILE_COOLDOWN = 3.0;
const MISSILE_LIFETIME = 4.0;
const MISSILE_TURN_RATE = 3.5;

// ========== STATE ==========
let gameState = 'start'; // start, playing, dead
let score = 0;
let shields = MAX_SHIELDS;
let fuel = MAX_FUEL;
let distance = 0;
let boosting = false;
let braking = false;
let shakeIntensity = 0;
let barrelRolling = 0; // 0=none, -1=left, 1=right
let barrelRollTimer = 0;
let barrelRollAngle = 0;
let lastATap = 0, lastDTap = 0;
let currentSpeed = 0;
let baseFov = 65;
let invulnTimer = 0;
let clock;

// Weapon state
let lastFireTime = 0;
let missileCooldown = 0;
let asteroidsDestroyed = 0;
let firing = false;
let missileRequested = false;

// ========== THREE.JS SETUP ==========
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020210, 0.0008);
const camera = new THREE.PerspectiveCamera(baseFov, innerWidth/innerHeight, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

scene.background = new THREE.Color(0x020210);

// ========== INPUT ==========
const keys = {};
const keyDown = {};
document.addEventListener('keydown', e => {
  if(!keys[e.code]) keyDown[e.code] = true;
  keys[e.code] = true;
  if(e.code === 'Enter') {
    if(gameState === 'start') startGame();
    else if(gameState === 'dead') restartGame();
  }
  if(e.code === 'KeyF' && gameState === 'playing') {
    missileRequested = true;
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// Mouse / click to fire
document.addEventListener('mousedown', e => {
  if(gameState === 'playing') firing = true;
});
document.addEventListener('mouseup', e => {
  firing = false;
});

// ========== LIGHTS ==========
scene.add(new THREE.AmbientLight(0x334455, 0.6));
const sunLight = new THREE.DirectionalLight(0xffeedd, 1.0);
sunLight.position.set(200, 300, -400);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0x4466aa, 0.3);
fillLight.position.set(-100, -50, 200);
scene.add(fillLight);

// ========== BUILD DETAILED SHIP ==========
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// --- Materials ---
const hullMat = new THREE.MeshStandardMaterial({color:0x1a1a2a, metalness:0.8, roughness:0.25});
const hullDarkMat = new THREE.MeshStandardMaterial({color:0x111122, metalness:0.8, roughness:0.3});
const cockpitMat = new THREE.MeshStandardMaterial({
  color:0x00d2ff, metalness:0.95, roughness:0.05,
  emissive:0x004466, emissiveIntensity:0.6,
  transparent:true, opacity:0.75
});
const accentMat = new THREE.MeshBasicMaterial({color:0x00d2ff});
const accentEmissiveMat = new THREE.MeshStandardMaterial({
  color:0x00d2ff, emissive:0x00d2ff, emissiveIntensity:1.0
});
const engineMetalMat = new THREE.MeshStandardMaterial({color:0x222233, metalness:0.9, roughness:0.15});
const nozzleGlowMat = new THREE.MeshBasicMaterial({color:0x00ccff});

// Main fuselage - elongated angular body
const fuselageGeom = new THREE.BoxGeometry(1.2, 0.7, 6);
// Taper the front by moving front-face vertices
const fuselagePositions = fuselageGeom.attributes.position;
for(let i = 0; i < fuselagePositions.count; i++) {
  const z = fuselagePositions.getZ(i);
  if(z < -2) {
    // Taper front
    const t = (z + 3) / -3;
    fuselagePositions.setX(i, fuselagePositions.getX(i) * (0.4 + 0.6 * (1-t)));
    fuselagePositions.setY(i, fuselagePositions.getY(i) * (0.5 + 0.5 * (1-t)));
  }
  if(z > 2) {
    // Slight taper rear
    fuselagePositions.setX(i, fuselagePositions.getX(i) * 0.85);
  }
}
fuselageGeom.computeVertexNormals();
const fuselage = new THREE.Mesh(fuselageGeom, hullMat);
shipGroup.add(fuselage);

// Cockpit canopy - half sphere at front
const cockpit = new THREE.Mesh(
  new THREE.SphereGeometry(0.55, 16, 10, 0, Math.PI*2, 0, Math.PI*0.55),
  cockpitMat
);
cockpit.position.set(0, 0.3, -1.8);
cockpit.rotation.x = -Math.PI*0.1;
shipGroup.add(cockpit);

// Cockpit frame ridges
const frameGeom = new THREE.BoxGeometry(0.06, 0.15, 1.2);
const frameL = new THREE.Mesh(frameGeom, accentEmissiveMat);
frameL.position.set(-0.35, 0.42, -1.6);
shipGroup.add(frameL);
const frameR = new THREE.Mesh(frameGeom, accentEmissiveMat);
frameR.position.set(0.35, 0.42, -1.6);
shipGroup.add(frameR);

// Nose tip
const noseCone = new THREE.Mesh(
  new THREE.ConeGeometry(0.2, 1.0, 6),
  hullDarkMat
);
noseCone.rotation.x = -Math.PI/2;
noseCone.position.set(0, 0, -3.5);
shipGroup.add(noseCone);

// --- Wings (swept back) ---
function makeWing(side) {
  // Main wing surface
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(side * 4.0, side * 0.8);  // tip, swept back
  wingShape.lineTo(side * 3.5, side * 2.0);  // trailing edge tip
  wingShape.lineTo(0, 1.2);                   // trailing edge root
  wingShape.closePath();

  const wingExtrudeSettings = { depth: 0.08, bevelEnabled: false };
  const wingGeom = new THREE.ExtrudeGeometry(wingShape, wingExtrudeSettings);
  const wing = new THREE.Mesh(wingGeom, hullMat);
  wing.rotation.x = Math.PI/2;
  wing.rotation.z = side > 0 ? 0 : Math.PI;
  wing.position.set(side * 0.5, -0.1, -0.5);
  if(side < 0) wing.position.x = -0.5;
  shipGroup.add(wing);

  // Wing accent stripe (emissive teal line along leading edge)
  const stripeGeom = new THREE.BoxGeometry(side * 3.2 * side, 0.04, 0.06);
  const stripe = new THREE.Mesh(stripeGeom, accentEmissiveMat);
  stripe.position.set(side * 2.2, -0.05, 0.0);
  stripe.rotation.z = side * -0.19;
  shipGroup.add(stripe);

  // Wing tip nav light
  const tipLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.35, 0.4),
    new THREE.MeshStandardMaterial({
      color: side > 0 ? 0x00ff44 : 0xff3300,
      emissive: side > 0 ? 0x00ff44 : 0xff2200,
      emissiveIntensity:0.8
    })
  );
  tipLight.position.set(side * 4.0, 0.0, 0.6);
  shipGroup.add(tipLight);

  // Engine pod under wing
  const pod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.38, 2.2, 8),
    engineMetalMat
  );
  pod.rotation.x = Math.PI/2;
  pod.position.set(side * 2.0, -0.35, 1.2);
  shipGroup.add(pod);

  // Engine intake scoop
  const scoop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.25, 0.4, 8),
    hullDarkMat
  );
  scoop.rotation.x = Math.PI/2;
  scoop.position.set(side * 2.0, -0.35, 0.0);
  shipGroup.add(scoop);

  // Nozzle glow disc
  const nozzle = new THREE.Mesh(
    new THREE.CircleGeometry(0.3, 12),
    nozzleGlowMat.clone()
  );
  nozzle.position.set(side * 2.0, -0.35, 2.32);
  nozzle.userData.isNozzle = true;
  shipGroup.add(nozzle);

  // Engine pod point light
  const engLight = new THREE.PointLight(0x00ccff, 1.0, 10);
  engLight.position.set(side * 2.0, -0.35, 2.5);
  engLight.userData.isEngineLight = true;
  shipGroup.add(engLight);

  // Cannon barrel (on each wing)
  const cannon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6),
    engineMetalMat
  );
  cannon.rotation.x = Math.PI/2;
  cannon.position.set(side * 1.2, -0.2, -2.8);
  shipGroup.add(cannon);

  // Cannon tip glow
  const cannonTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 6),
    accentEmissiveMat
  );
  cannonTip.position.set(side * 1.2, -0.2, -3.55);
  shipGroup.add(cannonTip);
}
makeWing(-1); makeWing(1);

// Vertical tail fin
const finGeom = new THREE.BoxGeometry(0.08, 1.8, 1.6);
const fin = new THREE.Mesh(finGeom, hullMat);
fin.position.set(0, 0.9, 2.0);
fin.rotation.x = 0.15;
shipGroup.add(fin);

// Fin accent stripe
const finStripe = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.06, 1.4),
  accentEmissiveMat
);
finStripe.position.set(0, 1.6, 2.0);
shipGroup.add(finStripe);

// Fin tip light
const finTipLight = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 6, 6),
  new THREE.MeshBasicMaterial({color:0xff3300})
);
finTipLight.position.set(0, 1.8, 2.5);
shipGroup.add(finTipLight);

// Underside accent lines (teal stripes along fuselage edges)
for(let side of [-1, 1]) {
  const edgeLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 5.5),
    accentEmissiveMat
  );
  edgeLine.position.set(side * 0.6, -0.35, -0.2);
  shipGroup.add(edgeLine);
}

// Central engine glow light (main)
const engineLight = new THREE.PointLight(0x00ccff, 2, 15);
engineLight.position.set(0, 0, 3);
shipGroup.add(engineLight);

// ========== ENGINE TRAIL PARTICLES ==========
const TRAIL_COUNT = 200;
const trailGeom = new THREE.BufferGeometry();
const trailPositions = new Float32Array(TRAIL_COUNT * 3);
const trailAlphas = new Float32Array(TRAIL_COUNT);
const trailSizes = new Float32Array(TRAIL_COUNT);
const trailLife = new Float32Array(TRAIL_COUNT);

for(let i = 0; i < TRAIL_COUNT; i++) {
  trailPositions[i*3] = trailPositions[i*3+1] = trailPositions[i*3+2] = 0;
  trailAlphas[i] = 0;
  trailSizes[i] = 0;
  trailLife[i] = -1;
}
trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeom.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));
trailGeom.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));

const trailMat = new THREE.ShaderMaterial({
  uniforms: { color: {value: new THREE.Color(0x00ccff)} },
  vertexShader: `
    attribute float alpha;
    attribute float size;
    varying float vAlpha;
    void main(){
      vAlpha = alpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying float vAlpha;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.0, d) * vAlpha;
      gl_FragColor = vec4(color, a);
    }
  `,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const trailPoints = new THREE.Points(trailGeom, trailMat);
scene.add(trailPoints);
let trailIdx = 0;

function emitTrail(pos, spread, life) {
  for(let e = 0; e < 2; e++) {
    const i = trailIdx % TRAIL_COUNT;
    trailPositions[i*3] = pos.x + (Math.random()-0.5)*spread;
    trailPositions[i*3+1] = pos.y + (Math.random()-0.5)*spread;
    trailPositions[i*3+2] = pos.z + (Math.random()-0.5)*spread;
    trailLife[i] = life;
    trailAlphas[i] = 1.0;
    trailSizes[i] = 1.5 + Math.random();
    trailIdx++;
  }
}

// ========== PROJECTILE POOL ==========
const projectiles = [];
const projectileMat = new THREE.MeshBasicMaterial({color:0x00ffee});
const projectileGlowMat = new THREE.MeshBasicMaterial({color:0x00d2ff, transparent:true, opacity:0.3});

function createProjectile() {
  const group = new THREE.Group();
  // Core bolt
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 2.0, 6),
    projectileMat
  );
  core.rotation.x = Math.PI/2;
  group.add(core);
  // Glow envelope
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.15, 2.5, 6),
    projectileGlowMat
  );
  glow.rotation.x = Math.PI/2;
  group.add(glow);
  // Point light
  const light = new THREE.PointLight(0x00d2ff, 1.0, 8);
  group.add(light);

  group.userData = { active: false, life: 0, velocity: new THREE.Vector3() };
  group.visible = false;
  scene.add(group);
  return group;
}

for(let i = 0; i < PROJECTILE_POOL_SIZE; i++) {
  projectiles.push(createProjectile());
}

function fireProjectile() {
  const now = performance.now() / 1000;
  if(now - lastFireTime < 1.0 / FIRE_RATE) return;
  lastFireTime = now;

  // Find inactive projectile
  let proj = null;
  for(const p of projectiles) {
    if(!p.userData.active) { proj = p; break; }
  }
  if(!proj) return;

  // Alternate left/right cannons
  const side = (Math.floor(now * FIRE_RATE) % 2 === 0) ? -1 : 1;
  const spawnPos = shipGroup.localToWorld(new THREE.Vector3(side * 1.2, -0.2, -3.6));
  proj.position.copy(spawnPos);

  // Direction: forward from ship
  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyQuaternion(shipGroup.quaternion);
  proj.userData.velocity.copy(forward).multiplyScalar(PROJECTILE_SPEED);
  // Add ship velocity
  proj.userData.velocity.add(shipVel);
  proj.userData.active = true;
  proj.userData.life = PROJECTILE_LIFETIME;
  proj.visible = true;
}

// ========== HOMING MISSILES ==========
const missiles = [];

function createMissileVisual() {
  const group = new THREE.Group();
  // Missile body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.08, 1.5, 6),
    new THREE.MeshStandardMaterial({color:0xaa3300, metalness:0.7, roughness:0.3})
  );
  body.rotation.x = Math.PI/2;
  group.add(body);
  // Nose cone
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.4, 6),
    new THREE.MeshStandardMaterial({color:0xff4400, emissive:0xff2200, emissiveIntensity:0.5})
  );
  nose.rotation.x = -Math.PI/2;
  nose.position.z = -1.0;
  group.add(nose);
  // Fins
  for(let s of [-1, 1]) {
    const mfin = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 * s * s, 0.04, 0.4),
      new THREE.MeshStandardMaterial({color:0x882200})
    );
    mfin.position.set(s * 0.25, 0, 0.5);
    group.add(mfin);
  }
  // Engine glow
  const engGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 6, 6),
    new THREE.MeshBasicMaterial({color:0xff6600})
  );
  engGlow.position.z = 0.8;
  group.add(engGlow);
  // Light
  const mLight = new THREE.PointLight(0xff6600, 2, 12);
  mLight.position.z = 0.8;
  group.add(mLight);

  group.userData = {
    active: false,
    life: 0,
    velocity: new THREE.Vector3(),
    target: null,
    bounced: false
  };
  group.visible = false;
  scene.add(group);
  return group;
}

// Missile trail particles (separate, orange)
const MISSILE_TRAIL_COUNT = 150;
const missileTrailGeom = new THREE.BufferGeometry();
const mtPositions = new Float32Array(MISSILE_TRAIL_COUNT * 3);
const mtAlphas = new Float32Array(MISSILE_TRAIL_COUNT);
const mtSizes = new Float32Array(MISSILE_TRAIL_COUNT);
const mtLife = new Float32Array(MISSILE_TRAIL_COUNT);
for(let i = 0; i < MISSILE_TRAIL_COUNT; i++) {
  mtPositions[i*3] = mtPositions[i*3+1] = mtPositions[i*3+2] = 0;
  mtAlphas[i] = 0; mtSizes[i] = 0; mtLife[i] = -1;
}
missileTrailGeom.setAttribute('position', new THREE.BufferAttribute(mtPositions, 3));
missileTrailGeom.setAttribute('alpha', new THREE.BufferAttribute(mtAlphas, 1));
missileTrailGeom.setAttribute('size', new THREE.BufferAttribute(mtSizes, 1));

const missileTrailMat = new THREE.ShaderMaterial({
  uniforms: { color: {value: new THREE.Color(0xff6622)} },
  vertexShader: `
    attribute float alpha;
    attribute float size;
    varying float vAlpha;
    void main(){
      vAlpha = alpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying float vAlpha;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.0, d) * vAlpha;
      gl_FragColor = vec4(color, a);
    }
  `,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const missileTrailPoints = new THREE.Points(missileTrailGeom, missileTrailMat);
scene.add(missileTrailPoints);
let mtIdx = 0;

function emitMissileTrail(pos) {
  for(let e = 0; e < 3; e++) {
    const i = mtIdx % MISSILE_TRAIL_COUNT;
    mtPositions[i*3] = pos.x + (Math.random()-0.5)*0.5;
    mtPositions[i*3+1] = pos.y + (Math.random()-0.5)*0.5;
    mtPositions[i*3+2] = pos.z + (Math.random()-0.5)*0.5;
    mtLife[i] = 0.6;
    mtAlphas[i] = 1.0;
    mtSizes[i] = 1.0 + Math.random() * 0.8;
    mtIdx++;
  }
}

function fireMissile() {
  if(missileCooldown > 0) return;

  // Find nearest asteroid
  let nearest = null;
  let nearestDist = Infinity;
  for(const a of asteroids) {
    const d = shipPos.distanceTo(a.position);
    // Only target asteroids ahead of ship
    if(a.position.z < shipPos.z && d < 400) {
      if(d < nearestDist) { nearestDist = d; nearest = a; }
    }
  }
  if(!nearest) return;

  // Find or create missile
  let missile = null;
  for(const m of missiles) {
    if(!m.userData.active) { missile = m; break; }
  }
  if(!missile) {
    missile = createMissileVisual();
    missiles.push(missile);
  }

  const spawnPos = shipGroup.localToWorld(new THREE.Vector3(0, -0.5, -2.0));
  missile.position.copy(spawnPos);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipGroup.quaternion);
  missile.userData.velocity.copy(forward).multiplyScalar(MISSILE_SPEED);
  missile.userData.active = true;
  missile.userData.life = MISSILE_LIFETIME;
  missile.userData.target = nearest;
  missile.userData.bounced = false;
  missile.visible = true;
  missileCooldown = MISSILE_COOLDOWN;
}

// ========== EXPLOSION PARTICLES (for asteroid destruction) ==========
const EXPLOSION_PARTICLE_COUNT = 300;
const expGeom = new THREE.BufferGeometry();
const expPositions = new Float32Array(EXPLOSION_PARTICLE_COUNT * 3);
const expAlphas = new Float32Array(EXPLOSION_PARTICLE_COUNT);
const expSizes = new Float32Array(EXPLOSION_PARTICLE_COUNT);
const expLife = new Float32Array(EXPLOSION_PARTICLE_COUNT);
const expVelocities = [];
for(let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
  expPositions[i*3] = expPositions[i*3+1] = expPositions[i*3+2] = 0;
  expAlphas[i] = 0; expSizes[i] = 0; expLife[i] = -1;
  expVelocities.push(new THREE.Vector3());
}
expGeom.setAttribute('position', new THREE.BufferAttribute(expPositions, 3));
expGeom.setAttribute('alpha', new THREE.BufferAttribute(expAlphas, 1));
expGeom.setAttribute('size', new THREE.BufferAttribute(expSizes, 1));

const expMat = new THREE.ShaderMaterial({
  uniforms: { color: {value: new THREE.Color(0xffaa44)} },
  vertexShader: `
    attribute float alpha;
    attribute float size;
    varying float vAlpha;
    void main(){
      vAlpha = alpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (200.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform vec3 color;
    varying float vAlpha;
    void main(){
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = smoothstep(1.0, 0.0, d) * vAlpha;
      gl_FragColor = vec4(color, a);
    }
  `,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const expPoints = new THREE.Points(expGeom, expMat);
scene.add(expPoints);
let expIdx = 0;

function spawnExplosion(pos, size) {
  const count = Math.floor(12 + size * 6);
  for(let e = 0; e < count; e++) {
    const i = expIdx % EXPLOSION_PARTICLE_COUNT;
    expPositions[i*3] = pos.x;
    expPositions[i*3+1] = pos.y;
    expPositions[i*3+2] = pos.z;
    expLife[i] = 0.5 + Math.random() * 0.5;
    expAlphas[i] = 1.0;
    expSizes[i] = 1.5 + Math.random() * 2.0;
    const dir = new THREE.Vector3(
      (Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)
    ).normalize().multiplyScalar(15 + Math.random() * 20 * size);
    expVelocities[i].copy(dir);
    expIdx++;
  }
  // Shake
  shakeIntensity = Math.max(shakeIntensity, 0.3 + size * 0.1);
}

// Asteroid debris chunks
const debrisChunks = [];
function spawnDebris(pos, size) {
  const numChunks = 3 + Math.floor(Math.random() * 3);
  for(let c = 0; c < numChunks; c++) {
    const chunkSize = size * (0.2 + Math.random() * 0.3);
    const chunk = new THREE.Mesh(
      makeAsteroidGeom(),
      new THREE.MeshStandardMaterial({color:0x888877, roughness:0.9, metalness:0.1})
    );
    chunk.scale.setScalar(chunkSize);
    chunk.position.copy(pos);
    const vel = new THREE.Vector3(
      (Math.random()-0.5)*30, (Math.random()-0.5)*30, (Math.random()-0.5)*30
    );
    chunk.userData = {
      velocity: vel,
      rotSpeed: new THREE.Vector3((Math.random()-0.5)*5, (Math.random()-0.5)*5, 0),
      life: 1.0 + Math.random()
    };
    scene.add(chunk);
    debrisChunks.push(chunk);
  }
}

// ========== PARALLAX STAR LAYERS ==========
function makeStarLayer(count, size, depth, color) {
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for(let i = 0; i < count; i++) {
    pos[i*3] = (Math.random()-0.5) * 1600;
    pos[i*3+1] = (Math.random()-0.5) * 800;
    pos[i*3+2] = -Math.random() * depth;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({color, size, sizeAttenuation:false, transparent:true, opacity:0.8});
  const points = new THREE.Points(geom, mat);
  points.userData.depth = depth;
  points.userData.parallax = 1.0 / (depth / 400);
  scene.add(points);
  return points;
}
const starLayers = [
  makeStarLayer(300, 1.0, 2000, 0xffffff),
  makeStarLayer(200, 1.5, 1000, 0xccddff),
  makeStarLayer(100, 2.5, 500, 0xaaccff)
];

// ========== SPEED LINES ==========
const SPEED_LINE_COUNT = 80;
const speedLineGeom = new THREE.BufferGeometry();
const slPositions = new Float32Array(SPEED_LINE_COUNT * 6); // 2 verts per line
const slAlphas = new Float32Array(SPEED_LINE_COUNT * 2);
speedLineGeom.setAttribute('position', new THREE.BufferAttribute(slPositions, 3));
speedLineGeom.setAttribute('alpha', new THREE.BufferAttribute(slAlphas, 1));

const speedLineMat = new THREE.ShaderMaterial({
  vertexShader: `
    attribute float alpha;
    varying float vAlpha;
    void main(){
      vAlpha = alpha;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main(){
      gl_FragColor = vec4(0.6, 0.8, 1.0, vAlpha);
    }
  `,
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending
});
const speedLines = new THREE.LineSegments(speedLineGeom, speedLineMat);
scene.add(speedLines);

// ========== PLANETS ==========
const planets = [];
function spawnPlanet() {
  const size = 30 + Math.random()*50;
  const colors = [0x78b4ff,0xff8c5a,0xb4ff96,0xc878ff,0xffff96,0xff6688];
  const color = colors[Math.floor(Math.random()*colors.length)];
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(size, 32, 32),
    new THREE.MeshStandardMaterial({color, roughness:0.8, metalness:0.1})
  );
  planet.position.set(
    (Math.random()-0.5)*800,
    (Math.random()-0.5)*200,
    shipGroup.position.z - 300 - Math.random()*SPAWN_DEPTH
  );

  // Atmospheric glow rings
  for(let r = 0; r < 3; r++) {
    const atmo = new THREE.Mesh(
      new THREE.RingGeometry(size + 1 + r*2, size + 2 + r*2, 64),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color(0x0066ff), r*0.3),
        transparent:true, opacity: 0.15 - r*0.04,
        side:THREE.DoubleSide
      })
    );
    atmo.lookAt(camera.position);
    planet.add(atmo);
  }

  // Some get rings
  if(Math.random() > 0.5) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(size*1.5, size*1.8, 64),
      new THREE.MeshBasicMaterial({color:0x88ccff, side:THREE.DoubleSide, transparent:true, opacity:0.35})
    );
    ring.rotation.x = Math.PI/2 + (Math.random()-0.5)*0.4;
    planet.add(ring);
  }

  scene.add(planet);
  planets.push(planet);
}
for(let i = 0; i < 6; i++) spawnPlanet();

// ========== ASTEROIDS ==========
const asteroids = [];
function makeAsteroidGeom() {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position;
  for(let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) * (0.7 + Math.random()*0.6),
      pos.getY(i) * (0.7 + Math.random()*0.6),
      pos.getZ(i) * (0.7 + Math.random()*0.6)
    );
  }
  g.computeVertexNormals();
  return g;
}

function spawnAsteroid(zBase) {
  const size = 1.5 + Math.random()*4;
  const mesh = new THREE.Mesh(
    makeAsteroidGeom(),
    new THREE.MeshStandardMaterial({color:0x666655, roughness:0.9, metalness:0.1})
  );
  mesh.scale.setScalar(size);
  mesh.position.set(
    (Math.random()-0.5) * 200,
    (Math.random()-0.5) * 100,
    zBase - Math.random() * SPAWN_DEPTH
  );
  mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
  mesh.userData = {
    size,
    rotSpeed: new THREE.Vector3((Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5, (Math.random()-0.5)*0.5)
  };
  scene.add(mesh);
  asteroids.push(mesh);
}
for(let i = 0; i < ASTEROID_COUNT; i++) spawnAsteroid(0);

// ========== CHECKPOINT RINGS ==========
const checkpoints = [];
function spawnCheckpoint(zBase) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(8, 0.4, 8, 32),
    new THREE.MeshBasicMaterial({color:0xffcc00, transparent:true, opacity:0.7})
  );
  // Inner glow ring
  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(8, 1.5, 8, 32),
    new THREE.MeshBasicMaterial({color:0xffcc00, transparent:true, opacity:0.15})
  );
  ring.add(inner);

  ring.position.set(
    (Math.random()-0.5)*120,
    (Math.random()-0.5)*60,
    zBase - 100 - Math.random()*SPAWN_DEPTH
  );
  ring.rotation.y = (Math.random()-0.5)*0.5;
  ring.userData = {collected:false, pulse:0};
  scene.add(ring);
  checkpoints.push(ring);
}
for(let i = 0; i < CHECKPOINT_COUNT; i++) spawnCheckpoint(0);

// ========== FUEL PICKUPS ==========
const fuelPickups = [];
function spawnFuelPickup(zBase) {
  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.2, 0),
    new THREE.MeshBasicMaterial({color:0x00ff66, transparent:true, opacity:0.8})
  );
  // Glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(2, 12, 12),
    new THREE.MeshBasicMaterial({color:0x00ff44, transparent:true, opacity:0.15})
  );
  orb.add(glow);
  const light = new THREE.PointLight(0x00ff44, 0.5, 20);
  orb.add(light);

  orb.position.set(
    (Math.random()-0.5)*180,
    (Math.random()-0.5)*80,
    zBase - 100 - Math.random()*SPAWN_DEPTH
  );
  orb.userData = {collected:false};
  scene.add(orb);
  fuelPickups.push(orb);
}
for(let i = 0; i < FUEL_PICKUP_COUNT; i++) spawnFuelPickup(0);

// ========== COLLISION FLASH OVERLAY ==========
const flashOverlay = document.createElement('div');
flashOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:red;opacity:0;pointer-events:none;z-index:50;transition:opacity 0.1s;';
document.body.appendChild(flashOverlay);

// ========== GAME FUNCTIONS ==========
const shipVel = new THREE.Vector3();
const shipPos = new THREE.Vector3(0, 0, 0);
const camTarget = new THREE.Vector3();
let targetRoll = 0;
let currentRoll = 0;
let currentPitch = 0;

function startGame() {
  document.getElementById('start-screen').style.display = 'none';
  gameState = 'playing';
  clock = new THREE.Clock();
}

function restartGame() {
  document.getElementById('game-over').style.display = 'none';
  score = 0; shields = MAX_SHIELDS; fuel = MAX_FUEL; distance = 0;
  shipPos.set(0,0,0); shipVel.set(0,0,0);
  shipGroup.position.copy(shipPos);
  shipGroup.rotation.set(0,0,0);
  currentRoll = 0; currentPitch = 0;
  barrelRolling = 0; barrelRollTimer = 0; barrelRollAngle = 0;
  invulnTimer = 0;
  boosting = false; braking = false;
  currentSpeed = 0;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
  asteroidsDestroyed = 0;
  missileCooldown = 0;
  lastFireTime = 0;

  // Reset objects
  asteroids.forEach(a => scene.remove(a));
  asteroids.length = 0;
  for(let i = 0; i < ASTEROID_COUNT; i++) spawnAsteroid(shipPos.z);

  checkpoints.forEach(c => scene.remove(c));
  checkpoints.length = 0;
  for(let i = 0; i < CHECKPOINT_COUNT; i++) spawnCheckpoint(shipPos.z);

  fuelPickups.forEach(f => scene.remove(f));
  fuelPickups.length = 0;
  for(let i = 0; i < FUEL_PICKUP_COUNT; i++) spawnFuelPickup(shipPos.z);

  // Reset projectiles
  projectiles.forEach(p => { p.userData.active = false; p.visible = false; });
  missiles.forEach(m => { m.userData.active = false; m.visible = false; });
  debrisChunks.forEach(d => scene.remove(d));
  debrisChunks.length = 0;

  gameState = 'playing';
  clock = new THREE.Clock();
}

function die() {
  gameState = 'dead';
  document.getElementById('final-score').textContent = 'SCORE: ' + Math.floor(score);
  document.getElementById('game-over').style.display = 'flex';
  shakeIntensity = 2.0;
}

function takeDamage() {
  if(invulnTimer > 0) return;
  shields--;
  shakeIntensity = 1.0;
  flashOverlay.style.opacity = '0.4';
  setTimeout(() => flashOverlay.style.opacity = '0', 150);
  invulnTimer = 1.0;
  if(shields <= 0) die();
}

function destroyAsteroid(asteroid, scoreVal) {
  const pos = asteroid.position.clone();
  const size = asteroid.userData.size;
  spawnExplosion(pos, size);
  spawnDebris(pos, size);
  scene.remove(asteroid);
  const idx = asteroids.indexOf(asteroid);
  if(idx !== -1) asteroids.splice(idx, 1);
  score += scoreVal;
  asteroidsDestroyed++;
  // Respawn a new asteroid further ahead
  spawnAsteroid(shipPos.z - 200);
}

// ========== MAIN LOOP ==========
function animate() {
  requestAnimationFrame(animate);
  if(gameState === 'start') {
    // Slowly rotate ship on start screen
    shipGroup.rotation.y += 0.005;
    renderer.render(scene, camera);
    return;
  }
  if(gameState === 'dead') {
    // Drift camera
    renderer.render(scene, camera);
    return;
  }

  const dt = Math.min(clock.getDelta(), 0.05);
  invulnTimer = Math.max(0, invulnTimer - dt);
  missileCooldown = Math.max(0, missileCooldown - dt);

  // === DOUBLE-TAP DETECTION ===
  const now = performance.now() / 1000;
  if(keyDown['KeyA']) {
    if(now - lastATap < BARREL_ROLL_WINDOW && barrelRolling === 0) {
      barrelRolling = -1; barrelRollTimer = BARREL_ROLL_TIME; barrelRollAngle = 0;
    }
    lastATap = now;
  }
  if(keyDown['KeyD']) {
    if(now - lastDTap < BARREL_ROLL_WINDOW && barrelRolling === 0) {
      barrelRolling = 1; barrelRollTimer = BARREL_ROLL_TIME; barrelRollAngle = 0;
    }
    lastDTap = now;
  }

  // === FIRING (space or click) ===
  if(keys['Space'] || firing) {
    fireProjectile();
  }
  // === MISSILE ===
  if(missileRequested) {
    fireMissile();
    missileRequested = false;
  }

  // Clear keyDown
  for(const k in keyDown) keyDown[k] = false;

  // === MOVEMENT INPUT ===
  const inputDir = new THREE.Vector3();
  if(keys['KeyW']) inputDir.z -= 1;
  if(keys['KeyA']) inputDir.x -= 1;
  if(keys['KeyD']) inputDir.x += 1;
  // Space is now shoot, use ArrowUp for ascend or keep space dual-purpose
  // Keep CTRL for descend
  if(keys['ArrowUp']) inputDir.y += 1;
  if(keys['ControlLeft'] || keys['ControlRight']) inputDir.y -= 1;

  braking = keys['KeyS'];
  boosting = keys['ShiftLeft'] || keys['ShiftRight'];

  if(boosting && fuel <= 0) boosting = false;

  let speedMult = boosting ? BOOST_MULT : 1;
  let targetSpeed = BASE_SPEED * speedMult;

  if(inputDir.length() > 0) {
    inputDir.normalize().multiplyScalar(targetSpeed);
  } else {
    // Auto-forward drift (always moving forward a bit)
    inputDir.z = -BASE_SPEED * 0.3;
  }

  if(braking) {
    shipVel.multiplyScalar(BRAKE_DRAG);
  }

  // Inertia: lerp toward input
  shipVel.lerp(inputDir, INERTIA_LERP + (braking ? 0.04 : 0));
  shipPos.add(shipVel.clone().multiplyScalar(dt));
  currentSpeed = shipVel.length();

  // Fuel drain
  if(boosting) {
    fuel = Math.max(0, fuel - FUEL_DRAIN * dt);
  }

  // Score = distance
  distance += currentSpeed * dt;
  score = Math.max(score, Math.floor(distance));

  // === BARREL ROLL ===
  if(barrelRolling !== 0) {
    barrelRollTimer -= dt;
    const rollSpeed = (Math.PI * 2) / BARREL_ROLL_TIME;
    barrelRollAngle += rollSpeed * dt * barrelRolling;
    if(barrelRollTimer <= 0) {
      barrelRolling = 0;
      barrelRollAngle = 0;
    }
    // Invulnerable during roll
    invulnTimer = Math.max(invulnTimer, 0.1);
  }

  // === SHIP TILT ===
  targetRoll = -shipVel.x * 0.04;
  if(barrelRolling === 0) {
    currentRoll += (targetRoll - currentRoll) * 0.08;
  }
  const targetPitch = shipVel.y * 0.03;
  currentPitch += (targetPitch - currentPitch) * 0.08;

  shipGroup.position.copy(shipPos);
  shipGroup.rotation.set(currentPitch, 0, currentRoll + barrelRollAngle);

  // Blink ship when invulnerable
  shipGroup.visible = invulnTimer > 0 ? Math.sin(invulnTimer * 30) > 0 : true;

  // === ENGINE EFFECTS ===
  const engineBright = boosting ? 4.0 : (currentSpeed / BASE_SPEED) * 2.0;
  engineLight.intensity = engineBright;
  engineLight.color.set(boosting ? 0xff6600 : 0x00ccff);
  trailMat.uniforms.color.value.set(boosting ? 0xff8833 : 0x00ccff);

  // Update engine pod lights and nozzles
  shipGroup.children.forEach(child => {
    if(child.userData.isEngineLight) {
      child.intensity = engineBright * 0.6;
      child.color.set(boosting ? 0xff6600 : 0x00ccff);
    }
    if(child.userData.isNozzle) {
      child.material.color.set(boosting ? 0xff6600 : 0x00ccff);
    }
  });

  // Emit trail
  const trailPos = shipGroup.localToWorld(new THREE.Vector3(0, 0, 2.8));
  const trailSpread = boosting ? 1.5 : 0.6;
  const trailLife2 = boosting ? 0.8 : 0.4;
  emitTrail(trailPos, trailSpread, trailLife2);
  // Second emission for left/right engines
  emitTrail(shipGroup.localToWorld(new THREE.Vector3(-2.0, -0.35, 2.4)), trailSpread*0.7, trailLife2);
  emitTrail(shipGroup.localToWorld(new THREE.Vector3(2.0, -0.35, 2.4)), trailSpread*0.7, trailLife2);

  // Update trail particles
  for(let i = 0; i < TRAIL_COUNT; i++) {
    if(trailLife[i] > 0) {
      trailLife[i] -= dt;
      trailAlphas[i] = Math.max(0, trailLife[i] / 0.8);
      trailSizes[i] *= 0.98;
    } else {
      trailAlphas[i] = 0;
    }
  }
  trailGeom.attributes.position.needsUpdate = true;
  trailGeom.attributes.alpha.needsUpdate = true;
  trailGeom.attributes.size.needsUpdate = true;

  // === UPDATE PROJECTILES ===
  for(const proj of projectiles) {
    if(!proj.userData.active) continue;
    proj.userData.life -= dt;
    if(proj.userData.life <= 0) {
      proj.userData.active = false;
      proj.visible = false;
      continue;
    }
    proj.position.add(proj.userData.velocity.clone().multiplyScalar(dt));

    // Check collision with asteroids
    for(let ai = asteroids.length - 1; ai >= 0; ai--) {
      const a = asteroids[ai];
      const dist = proj.position.distanceTo(a.position);
      if(dist < a.userData.size + 0.5) {
        proj.userData.active = false;
        proj.visible = false;
        destroyAsteroid(a, 50);
        break;
      }
    }
  }

  // === UPDATE MISSILES ===
  for(const m of missiles) {
    if(!m.userData.active) continue;
    m.userData.life -= dt;
    if(m.userData.life <= 0) {
      m.userData.active = false;
      m.visible = false;
      // Explode on timeout
      spawnExplosion(m.position.clone(), 2);
      continue;
    }

    // Homing logic with predictive tracking
    const target = m.userData.target;
    if(target && asteroids.includes(target)) {
      // Predict where target will be
      const toTarget = target.position.clone().sub(m.position);
      const distToTarget = toTarget.length();
      const timeToReach = distToTarget / MISSILE_SPEED;
      // Lead the target slightly (asteroids drift slowly, but predict anyway)
      const predictedPos = target.position.clone();

      const desiredDir = predictedPos.sub(m.position).normalize();
      const currentDir = m.userData.velocity.clone().normalize();
      // Slerp-like turn
      currentDir.lerp(desiredDir, MISSILE_TURN_RATE * dt);
      currentDir.normalize();
      m.userData.velocity.copy(currentDir).multiplyScalar(MISSILE_SPEED);

      // Orient missile to face direction
      const lookTarget = m.position.clone().add(m.userData.velocity);
      m.lookAt(lookTarget);
    } else {
      // Target gone, find new target
      m.userData.target = null;
      let nearest = null;
      let nearDist = Infinity;
      for(const a of asteroids) {
        const d = m.position.distanceTo(a.position);
        if(d < 300 && d < nearDist) { nearDist = d; nearest = a; }
      }
      if(nearest) m.userData.target = nearest;
    }

    m.position.add(m.userData.velocity.clone().multiplyScalar(dt));
    emitMissileTrail(m.position);

    // Check collision with asteroids
    for(let ai = asteroids.length - 1; ai >= 0; ai--) {
      const a = asteroids[ai];
      const dist = m.position.distanceTo(a.position);
      if(dist < a.userData.size + 1.5) {
        m.userData.active = false;
        m.visible = false;
        destroyAsteroid(a, 100);
        // Bigger explosion for missile
        spawnExplosion(a.position.clone(), a.userData.size * 1.5);
        break;
      }
    }
  }

  // === UPDATE EXPLOSION PARTICLES ===
  for(let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
    if(expLife[i] > 0) {
      expLife[i] -= dt;
      expPositions[i*3] += expVelocities[i].x * dt;
      expPositions[i*3+1] += expVelocities[i].y * dt;
      expPositions[i*3+2] += expVelocities[i].z * dt;
      expVelocities[i].multiplyScalar(0.96); // drag
      expAlphas[i] = Math.max(0, expLife[i] / 1.0);
      expSizes[i] *= 0.99;
    } else {
      expAlphas[i] = 0;
    }
  }
  expGeom.attributes.position.needsUpdate = true;
  expGeom.attributes.alpha.needsUpdate = true;
  expGeom.attributes.size.needsUpdate = true;

  // === UPDATE MISSILE TRAIL PARTICLES ===
  for(let i = 0; i < MISSILE_TRAIL_COUNT; i++) {
    if(mtLife[i] > 0) {
      mtLife[i] -= dt;
      mtAlphas[i] = Math.max(0, mtLife[i] / 0.6);
      mtSizes[i] *= 0.97;
    } else {
      mtAlphas[i] = 0;
    }
  }
  missileTrailGeom.attributes.position.needsUpdate = true;
  missileTrailGeom.attributes.alpha.needsUpdate = true;
  missileTrailGeom.attributes.size.needsUpdate = true;

  // === UPDATE DEBRIS ===
  for(let i = debrisChunks.length - 1; i >= 0; i--) {
    const chunk = debrisChunks[i];
    chunk.userData.life -= dt;
    if(chunk.userData.life <= 0 || chunk.position.z > shipPos.z + 100) {
      scene.remove(chunk);
      debrisChunks.splice(i, 1);
      continue;
    }
    chunk.position.add(chunk.userData.velocity.clone().multiplyScalar(dt));
    chunk.userData.velocity.multiplyScalar(0.98);
    chunk.rotation.x += chunk.userData.rotSpeed.x * dt;
    chunk.rotation.y += chunk.userData.rotSpeed.y * dt;
    // Fade out
    const opacity = Math.min(1, chunk.userData.life);
    chunk.material.transparent = true;
    chunk.material.opacity = opacity;
  }

  // === PARALLAX STARS ===
  starLayers.forEach(layer => {
    const pos = layer.geometry.attributes.position;
    const p = layer.userData.parallax;
    for(let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) + shipVel.z * dt * p * 0.3;
      let x = pos.getX(i) + shipVel.x * dt * p * 0.1;
      if(z > shipPos.z + 100) z -= layer.userData.depth;
      if(z < shipPos.z - layer.userData.depth) z += layer.userData.depth;
      pos.setZ(i, z);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  });

  // === SPEED LINES ===
  const speedFraction = Math.max(0, (currentSpeed - BASE_SPEED * 0.8) / (BASE_SPEED * BOOST_MULT - BASE_SPEED * 0.8));
  for(let i = 0; i < SPEED_LINE_COUNT; i++) {
    const bi = i * 6;
    if(speedFraction > 0.1) {
      const x = (Math.random()-0.5) * 60 + shipPos.x;
      const y = (Math.random()-0.5) * 40 + shipPos.y;
      const z = shipPos.z - 10 - Math.random()*50;
      slPositions[bi] = x;
      slPositions[bi+1] = y;
      slPositions[bi+2] = z;
      slPositions[bi+3] = x + (Math.random()-0.5)*0.5;
      slPositions[bi+4] = y + (Math.random()-0.5)*0.5;
      slPositions[bi+5] = z + 3 + speedFraction * 8;
      slAlphas[i*2] = speedFraction * 0.5;
      slAlphas[i*2+1] = 0;
    } else {
      slAlphas[i*2] = 0;
      slAlphas[i*2+1] = 0;
    }
  }
  speedLineGeom.attributes.position.needsUpdate = true;
  speedLineGeom.attributes.alpha.needsUpdate = true;

  // === FOV BOOST ===
  const targetFov = baseFov + speedFraction * 20;
  camera.fov += (targetFov - camera.fov) * 0.05;
  camera.updateProjectionMatrix();

  // === ASTEROID COLLISION & RESPAWN ===
  for(let i = asteroids.length - 1; i >= 0; i--) {
    const a = asteroids[i];
    a.rotation.x += a.userData.rotSpeed.x * dt;
    a.rotation.y += a.userData.rotSpeed.y * dt;

    const dist = shipPos.distanceTo(a.position);
    if(dist < a.userData.size + 2.0) {
      takeDamage();
      // Knock asteroid away
      a.position.add(shipPos.clone().sub(a.position).normalize().multiplyScalar(-20));
    }

    // Respawn if behind
    if(a.position.z > shipPos.z + 60) {
      a.position.z = shipPos.z - 200 - Math.random() * SPAWN_DEPTH;
      a.position.x = (Math.random()-0.5) * 200;
      a.position.y = (Math.random()-0.5) * 100;
    }
  }

  // === CHECKPOINT COLLISION & RESPAWN ===
  checkpoints.forEach(ring => {
    ring.userData.pulse += dt * 3;
    ring.rotation.x += dt * 0.3;
    const s = 1.0 + Math.sin(ring.userData.pulse) * 0.05;
    ring.scale.setScalar(s);

    if(!ring.userData.collected) {
      const dist = shipPos.distanceTo(ring.position);
      if(dist < 10) {
        ring.userData.collected = true;
        score += 100;
        ring.material.color.set(0x00ff00);
        ring.material.opacity = 0.3;
      }
    }

    if(ring.position.z > shipPos.z + 60) {
      ring.position.z = shipPos.z - 200 - Math.random() * SPAWN_DEPTH;
      ring.position.x = (Math.random()-0.5) * 120;
      ring.position.y = (Math.random()-0.5) * 60;
      ring.userData.collected = false;
      ring.material.color.set(0xffcc00);
      ring.material.opacity = 0.7;
    }
  });

  // === FUEL PICKUPS ===
  fuelPickups.forEach(orb => {
    orb.rotation.y += dt * 2;
    orb.rotation.x += dt * 0.7;

    if(!orb.userData.collected) {
      const dist = shipPos.distanceTo(orb.position);
      if(dist < 4) {
        orb.userData.collected = true;
        fuel = Math.min(MAX_FUEL, fuel + FUEL_PICKUP_AMT);
        orb.visible = false;
      }
    }

    if(orb.position.z > shipPos.z + 60) {
      orb.position.z = shipPos.z - 200 - Math.random() * SPAWN_DEPTH;
      orb.position.x = (Math.random()-0.5) * 180;
      orb.position.y = (Math.random()-0.5) * 80;
      orb.userData.collected = false;
      orb.visible = true;
    }
  });

  // === PLANET RESPAWN ===
  planets.forEach(p => {
    p.children.forEach(child => {
      if(child.geometry && child.geometry.type === 'RingGeometry') {
        // billboard the atmo rings
      }
    });
    if(p.position.z > shipPos.z + 200) {
      p.position.z = shipPos.z - 400 - Math.random() * SPAWN_DEPTH;
      p.position.x = (Math.random()-0.5) * 800;
      p.position.y = (Math.random()-0.5) * 200;
    }
  });

  // === CAMERA ===
  const camOffset = new THREE.Vector3(0, 5, 16);
  camTarget.copy(shipPos).add(camOffset);
  camera.position.lerp(camTarget, CAMERA_LAG);

  // Screen shake
  if(shakeIntensity > 0.01) {
    camera.position.x += (Math.random()-0.5) * shakeIntensity;
    camera.position.y += (Math.random()-0.5) * shakeIntensity;
    shakeIntensity *= SHAKE_DECAY;
  }

  camera.lookAt(shipPos.clone().add(new THREE.Vector3(0, -1, -15)));

  // === HUD ===
  const hudTL = document.getElementById('hud-top-left');
  const shieldStr = '\u2588'.repeat(shields) + '\u2591'.repeat(MAX_SHIELDS - shields);

  // Missile cooldown display
  let missileStatus;
  if(missileCooldown <= 0) {
    missileStatus = '<span style="color:#00ff66">READY</span>';
  } else {
    missileStatus = '<span style="color:#ff6600">' + missileCooldown.toFixed(1) + 's</span>';
  }

  hudTL.innerHTML =
    `SHIELDS <span style="color:${shields<=1?'#ff3333':'#00ccff'}">${shieldStr}</span><br>` +
    `SPEED ${currentSpeed.toFixed(0)}` +
    (boosting ? ' <span style="color:#ff6600">BOOST</span>' : '') +
    (braking ? ' <span style="color:#ffcc00">BRAKE</span>' : '') +
    (barrelRolling ? ' <span style="color:#ff00ff">ROLL!</span>' : '') +
    `<br>MISSILES: ${missileStatus}` +
    `<br><span style="color:#ff8844">KILLS: ${asteroidsDestroyed}</span>`;

  document.getElementById('hud-top-right').textContent = score;

  document.getElementById('shield-bar').style.width = (shields/MAX_SHIELDS*100)+'%';
  document.getElementById('fuel-bar').style.width = (fuel/MAX_FUEL*100)+'%';
  document.getElementById('speed-bar').style.width = Math.min(100, currentSpeed/BASE_SPEED/BOOST_MULT*100)+'%';

  renderer.render(scene, camera);
}

animate();

// ========== RESIZE ==========
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});



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
  var hbPeriod = 0.6658157754344669;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.017776736490479287;mix-blend-mode:overlay';
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




// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
