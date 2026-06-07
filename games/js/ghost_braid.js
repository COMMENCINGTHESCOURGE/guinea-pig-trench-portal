// =============================================================================
// GHOST BRAID: VOID FIGHTER (v1.0)
// A Premium 6DOF Space Corridor Combat Simulator
// Anchored to: Pangea Principle, Ghost Braid system, and Substrate Delta Sieve
// =============================================================================

// ========== CONSTANTS ==========
const BASE_SPEED = 40;
const BOOST_MULT = 2.8;
const BRAKE_DRAG = 0.88;
const INERTIA_LERP = 0.05;
const CAMERA_LAG = 0.12;
const MAX_SHIELDS = 4;
const MAX_ENERGY = 100;
const ENERGY_DRAIN_FIRE = 8;
const ENERGY_REGEN = 18; // per second
const SPAWN_SEGMENTS = 6;
const SEGMENT_LENGTH = 80;
const TUNNEL_WIDTH = 50; // boundary X
const TUNNEL_HEIGHT = 40; // boundary Y

// Projectiles
const LASER_SPEED = 320;
const LASER_POOL_SIZE = 30;
const LASER_FIRE_RATE = 5; // shots per sec
const TORPEDO_SPEED = 180;
const TORPEDO_COOLDOWN = 2.5;

// ========== STATE ==========
let gameState = 'start'; // start, playing, paused, dead
let score = 0;
let shields = MAX_SHIELDS;
let energy = MAX_ENERGY;
let currentSpeed = 0;
let distance = 0;
let boosting = false;
let firing = false;
let torpedoCooldown = 0;
let shakeIntensity = 0;
let invulnTimer = 0;
let activeTarget = null;
let lastFireTime = 0;
let mouseX = 0, mouseY = 0;
let clock;
let animFrameId = null;
const keys = {};

// 6DOF variables
const shipPos = new THREE.Vector3(0, 0, 0);
const shipVel = new THREE.Vector3(0, 0, 0);
const shipQ = new THREE.Quaternion();
const rotVel = new THREE.Vector3(); // x=pitch, y=yaw, z=roll
let flightAssist = true;

// Level Generation
const activeSegments = [];
let segmentIndexTracker = 0;

// Entities
const entities = []; // Turrets, Mines, Torpedos, Lasers, Particles
const turretLaserPool = [];

// ========== THREE.JS INITIALIZATION ==========
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x01050e, 0.0035);
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 800);
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.body.appendChild(renderer.domElement);

scene.add(camera);

// Ambient and direct lighting
const ambientLight = new THREE.AmbientLight(0x0e182b, 0.7);
scene.add(ambientLight);

const cockpitGroup = new THREE.Group();
camera.add(cockpitGroup);

// ========== PLAYER SHIP MESH ==========
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// Procedural Winged Fighter Mesh
const shipMaterial = new THREE.MeshStandardMaterial({
  color: 0xffaa00,
  emissive: 0x221100,
  metalness: 0.8,
  roughness: 0.25
});
const metalMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a4f63,
  metalness: 0.9,
  roughness: 0.15
});
const glowBlue = new THREE.MeshBasicMaterial({color: 0x00ffee});
const glowRed = new THREE.MeshBasicMaterial({color: 0xff3333});

function buildShipGeometry() {
  // Main Hull Fuselage
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5.0, 8), shipMaterial);
  fuselage.rotation.x = Math.PI / 2;
  shipGroup.add(fuselage);

  // Nose Cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 8), metalMaterial);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -3.4;
  shipGroup.add(nose);

  // Left Wing
  const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.2, 1.8), shipMaterial);
  wingLeft.position.set(-2.5, -0.2, 0.5);
  wingLeft.rotation.y = 0.25;
  wingLeft.rotation.z = -0.1;
  shipGroup.add(wingLeft);

  // Right Wing
  const wingRight = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.2, 1.8), shipMaterial);
  wingRight.position.set(2.5, -0.2, 0.5);
  wingRight.rotation.y = -0.25;
  wingRight.rotation.z = 0.1;
  shipGroup.add(wingRight);

  // Engine Plume ring
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.6, 8), metalMaterial);
  engine.rotation.x = Math.PI / 2;
  engine.position.z = 2.6;
  shipGroup.add(engine);

  // Main thruster light
  const pLight = new THREE.PointLight(0x00ffee, 2, 12);
  pLight.position.set(0, 0, 3.2);
  pLight.name = "thrusterLight";
  shipGroup.add(pLight);

  // Laser emitter nozzles (left/right wings)
  for (let s of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), metalMaterial);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(s * 4.2, -0.15, -0.2);
    shipGroup.add(nozzle);
  }
}
buildShipGeometry();

// ========== 3D COCKPIT RETICLE OVERLAY ==========
const hudLineMat = new THREE.LineBasicMaterial({
  color: 0xffaa00,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending
});

function buildCockpitReticle() {
  // Crosshair brackets
  const ringPoints = [];
  const radius = 0.45;
  for(let i=0; i<=32; i++) {
    const theta = (i/32) * Math.PI * 2;
    ringPoints.push(new THREE.Vector3(Math.cos(theta)*radius, Math.sin(theta)*radius, -2.5));
  }
  const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPoints), hudLineMat);
  cockpitGroup.add(ring);

  // Cross lines
  const crossPoints = [
    new THREE.Vector3(-0.08, 0, -2.5), new THREE.Vector3(-0.02, 0, -2.5),
    new THREE.Vector3(0.02, 0, -2.5), new THREE.Vector3(0.08, 0, -2.5),
    new THREE.Vector3(0, -0.08, -2.5), new THREE.Vector3(0, -0.02, -2.5),
    new THREE.Vector3(0, 0.02, -2.5), new THREE.Vector3(0, 0.08, -2.5)
  ];
  const cross = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crossPoints), hudLineMat);
  cockpitGroup.add(cross);

  // Left/Right cockpit HUD plates (decorations)
  const hudPlateMat = new THREE.LineBasicMaterial({color: 0x00ffaa, transparent: true, opacity: 0.3});
  const platePoints = [
    new THREE.Vector3(-1.1, 0.4, -2.5), new THREE.Vector3(-0.9, 0.4, -2.5),
    new THREE.Vector3(-1.1, 0.4, -2.5), new THREE.Vector3(-1.1, -0.4, -2.5),
    new THREE.Vector3(-1.1, -0.4, -2.5), new THREE.Vector3(-0.9, -0.4, -2.5),

    new THREE.Vector3(1.1, 0.4, -2.5), new THREE.Vector3(0.9, 0.4, -2.5),
    new THREE.Vector3(1.1, 0.4, -2.5), new THREE.Vector3(1.1, -0.4, -2.5),
    new THREE.Vector3(1.1, -0.4, -2.5), new THREE.Vector3(0.9, -0.4, -2.5)
  ];
  const plates = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(platePoints), hudPlateMat);
  cockpitGroup.add(plates);
}
buildCockpitReticle();

// ========== AUDIO SYNTHESIZER ENGINE ==========
let audioCtx = null;
let synthDrone = null;
let droneGain = null;

function initSynth() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    // Create Low Ambient Space Drone
    synthDrone = audioCtx.createOscillator();
    droneGain = audioCtx.createGain();
    
    synthDrone.type = 'sawtooth';
    synthDrone.frequency.value = 65.41; // C2 tone
    droneGain.gain.setValueAtTime(0.04, audioCtx.currentTime);

    // Apply lowpass filter
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(140, audioCtx.currentTime);
    
    // Add LFO to modulate filter
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.value = 0.18; // Very slow filter sweep
    lfoGain.gain.value = 45;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    
    synthDrone.connect(lp);
    lp.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    
    lfo.start();
    synthDrone.start();
  } catch(e) {
    console.error("Audio failed to initialize", e);
  }
}

function playTone(freq, dur, type, vol) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol || 0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}

function playLaserSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch(e) {}
}

function playTorpedoSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch(e) {}
}

function playExplosionSound() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch(e) {}
}

function playCrashSound() {
  playTone(90, 0.4, 'triangle', 0.25);
}

// ========== PROCEDURAL CORRIDOR SEGMENTS (Layer 0) ==========
const segmentMaterials = {
  wall: new THREE.MeshStandardMaterial({color: 0x18202d, metalness: 0.9, roughness: 0.4}),
  glowGrid: new THREE.MeshBasicMaterial({color: 0x00ffee}),
  scaffold: new THREE.MeshStandardMaterial({color: 0x2d3b4f, metalness: 0.8, roughness: 0.3})
};

function createSegment(zPos) {
  const group = new THREE.Group();
  group.position.z = zPos;

  // Base panel size: Left Wall, Right Wall, Floor, Ceiling
  const wGeo = new THREE.BoxGeometry(1.5, TUNNEL_HEIGHT, SEGMENT_LENGTH);
  const fGeo = new THREE.BoxGeometry(TUNNEL_WIDTH, 1.5, SEGMENT_LENGTH);

  // Left Wall
  const left = new THREE.Mesh(wGeo, segmentMaterials.wall);
  left.position.x = -TUNNEL_WIDTH / 2;
  group.add(left);

  // Right Wall
  const right = new THREE.Mesh(wGeo, segmentMaterials.wall);
  right.position.x = TUNNEL_WIDTH / 2;
  group.add(right);

  // Floor
  const floor = new THREE.Mesh(fGeo, segmentMaterials.wall);
  floor.position.y = -TUNNEL_HEIGHT / 2;
  group.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(fGeo, segmentMaterials.wall);
  ceiling.position.y = TUNNEL_HEIGHT / 2;
  group.add(ceiling);

  // Glowing conduit rails in 4 corners
  const tubeGeo = new THREE.BoxGeometry(0.3, 0.3, SEGMENT_LENGTH);
  for (let sx of [-1, 1]) {
    for (let sy of [-1, 1]) {
      const rail = new THREE.Mesh(tubeGeo, segmentMaterials.glowGrid);
      rail.position.set(sx * (TUNNEL_WIDTH/2 - 1.0), sy * (TUNNEL_HEIGHT/2 - 1.0), 0);
      group.add(rail);
    }
  }

  // Cross-Scaffolding arches
  const archHeight = TUNNEL_HEIGHT - 2.0;
  const archWidth = TUNNEL_WIDTH - 2.0;
  
  const archH = new THREE.Mesh(new THREE.BoxGeometry(archWidth, 0.8, 1.2), segmentMaterials.scaffold);
  archH.position.set(0, archHeight / 2, 0);
  group.add(archH);

  const archV1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, archHeight, 1.2), segmentMaterials.scaffold);
  archV1.position.set(-archWidth / 2, 0, 0);
  group.add(archV1);

  const archV2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, archHeight, 1.2), segmentMaterials.scaffold);
  archV2.position.set(archWidth / 2, 0, 0);
  group.add(archV2);

  // Add Level Entities dynamically based on tracking index
  const diffScale = Math.min(10.0, segmentIndexTracker * 0.1);
  segmentIndexTracker++;

  // Spawn obstacles: Rotating giant ventilation fan
  if (Math.random() > 0.6 && segmentIndexTracker > 2) {
    const fanPivot = new THREE.Group();
    fanPivot.position.set(0, 0, (Math.random() - 0.5) * 40);
    
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1.2, 8), segmentMaterials.scaffold);
    hub.rotation.x = Math.PI/2;
    fanPivot.add(hub);

    // 4 Blades
    for(let r=0; r<4; r++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 14, 0.3), segmentMaterials.wall);
      blade.position.y = 8;
      const bladeHolder = new THREE.Group();
      bladeHolder.rotation.z = (r / 4) * Math.PI * 2;
      bladeHolder.add(blade);
      fanPivot.add(bladeHolder);
    }

    fanPivot.userData = {
      isObstacle: true,
      spinSpeed: 1.0 + Math.random() * 2.0,
      radius: 15.0
    };
    group.add(fanPivot);
  }

  // Spawn defense turrets
  if (Math.random() > 0.4 && segmentIndexTracker > 1) {
    const numTurrets = Math.random() > 0.7 ? 2 : 1;
    for(let t=0; t<numTurrets; t++) {
      const side = Math.random() > 0.5 ? -1 : 1;
      const tGroup = new THREE.Group();
      tGroup.position.set(side * (TUNNEL_WIDTH/2 - 2.5), (Math.random()-0.5)*18, (Math.random()-0.5)*50);
      
      const base = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 2.5), segmentMaterials.wall);
      tGroup.add(base);

      const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), metalMaterial);
      head.position.y = 1.0;
      tGroup.add(head);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6), metalMaterial);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 1.0, -1.0);
      tGroup.add(barrel);

      const tLight = new THREE.PointLight(0xff3333, 1, 8);
      tLight.position.set(0, 1.0, -1.8);
      tGroup.add(tLight);

      tGroup.userData = {
        isTurret: true,
        barrel: barrel,
        head: head,
        fireTimer: Math.random() * 2.0,
        shields: 2
      };
      group.add(tGroup);
    }
  }

  // Spawn floating energy mines
  if (Math.random() > 0.5 && segmentIndexTracker > 1) {
    const numMines = 1 + Math.floor(Math.random() * 2);
    for(let m=0; m<numMines; m++) {
      const mine = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), glowRed);
      mine.position.set((Math.random()-0.5)*35, (Math.random()-0.5)*25, (Math.random()-0.5)*50);
      
      // Floating wave offset
      mine.userData = {
        isMine: true,
        floatOffset: Math.random() * 10,
        floatSpeed: 1.5 + Math.random(),
        shields: 1
      };
      group.add(mine);
    }
  }

  scene.add(group);
  return group;
}

// ========== INITIALIZE LEVEL GRID ==========
function initLevel() {
  segmentIndexTracker = 0;
  for (let i = 0; i < SPAWN_SEGMENTS; i++) {
    const z = -i * SEGMENT_LENGTH;
    const seg = createSegment(z);
    activeSegments.push(seg);
  }
}

function updateLevel(dt) {
  // Check if player passed the center of the first segment
  if (shipPos.z < activeSegments[1].position.z) {
    // Remove the oldest segment (behind player)
    const oldSeg = activeSegments.shift();
    scene.remove(oldSeg);

    // Recursively clean children geometries
    oldSeg.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });

    // Create a new segment ahead
    const newZ = activeSegments[activeSegments.length - 1].position.z - SEGMENT_LENGTH;
    const newSeg = createSegment(newZ);
    activeSegments.push(newSeg);
  }

  // Update animated elements within active segments (fan spinning, floating mines)
  activeSegments.forEach(seg => {
    seg.children.forEach(child => {
      // Giants Fan
      if (child.userData.isObstacle) {
        child.rotation.z += child.userData.spinSpeed * dt;
        // Collision check
        const dist = shipPos.distanceTo(new THREE.Vector3(child.position.x, child.position.y, seg.position.z + child.position.z));
        if (dist < child.userData.radius + 2.0 && Math.abs(shipPos.z - (seg.position.z + child.position.z)) < 2.0) {
          takeDamage();
        }
      }

      // Floating mines
      if (child.userData.isMine) {
        child.rotation.y += dt;
        child.rotation.x += dt * 0.5;
        child.position.y += Math.sin(performance.now() * 0.002 * child.userData.floatSpeed + child.userData.floatOffset) * 0.05;

        // Collision Check
        const worldPos = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
        const dist = shipPos.distanceTo(worldPos);
        if (dist < 2.8) {
          takeDamage();
          spawnExplosion(worldPos, 1.5);
          seg.remove(child);
          playExplosionSound();
        }
      }

      // Turrets target tracking & firing
      if (child.userData.isTurret) {
        const worldPos = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
        const distToPlayer = shipPos.distanceTo(worldPos);
        
        if (distToPlayer < 240 && shipPos.z < worldPos.z) {
          // Look at player
          child.userData.head.lookAt(shipPos);
          child.userData.barrel.lookAt(shipPos);
          child.userData.barrel.rotation.x += Math.PI / 2; // correct orientation

          // Fire intervals
          child.userData.fireTimer -= dt;
          if (child.userData.fireTimer <= 0) {
            fireTurretLaser(worldPos, shipPos.clone());
            child.userData.fireTimer = 1.5 + Math.random() * 2.0;
          }
        }
      }
    });
  });
}

// ========== TURRET WEAPON LASERS ==========
function fireTurretLaser(spawnPos, targetPos) {
  const geom = new THREE.CylinderGeometry(0.15, 0.15, 3.5, 6);
  const laser = new THREE.Mesh(geom, glowRed);
  laser.rotation.x = Math.PI / 2;
  laser.position.copy(spawnPos);
  
  // Calculate target direction vector
  const dir = targetPos.sub(spawnPos).normalize();
  laser.lookAt(laser.position.clone().add(dir));
  laser.rotation.x += Math.PI / 2; // alignment correction

  laser.userData = {
    velocity: dir.multiplyScalar(160), // speed
    life: 3.5,
    isEnemyLaser: true
  };
  
  scene.add(laser);
  turretLaserPool.push(laser);
}

function updateEnemyLasers(dt) {
  for(let i = turretLaserPool.length - 1; i >= 0; i--) {
    const l = turretLaserPool[i];
    l.userData.life -= dt;
    if (l.userData.life <= 0) {
      scene.remove(l);
      turretLaserPool.splice(i, 1);
      continue;
    }

    l.position.add(l.userData.velocity.clone().multiplyScalar(dt));

    // Collision with player
    const dist = shipPos.distanceTo(l.position);
    if (dist < 2.5) {
      takeDamage();
      scene.remove(l);
      turretLaserPool.splice(i, 1);
    }
  }
}

// ========== PROJECTILES (PLAYER WEAPONS) ==========
const lasers = [];
const torpedos = [];

function fireLaser() {
  const now = performance.now() / 1000;
  if(now - lastFireTime < 1.0 / LASER_FIRE_RATE) return;
  if (energy < ENERGY_DRAIN_FIRE) return; // out of charge
  lastFireTime = now;
  energy = Math.max(0, energy - ENERGY_DRAIN_FIRE);

  playLaserSound();

  for(let side of [-1, 1]) {
    const geom = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 6);
    const laser = new THREE.Mesh(geom, glowBlue);
    laser.rotation.x = Math.PI / 2;

    const spawnPos = shipGroup.localToWorld(new THREE.Vector3(side * 4.2, -0.15, -1.0));
    laser.position.copy(spawnPos);

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQ);
    laser.lookAt(laser.position.clone().add(dir));
    laser.rotation.x += Math.PI / 2;

    laser.userData = {
      velocity: dir.multiplyScalar(LASER_SPEED).add(shipVel),
      life: PROJECTILE_LIFETIME_UPGRADED()
    };
    scene.add(laser);
    lasers.push(laser);
  }
}

function PROJECTILE_LIFETIME_UPGRADED() { return 2.0; }

function fireTorpedo() {
  if (torpedoCooldown > 0) return;
  if (!activeTarget) return; // requires locked target

  torpedoCooldown = TORPEDO_COOLDOWN;
  playTorpedoSound();

  const geom = new THREE.CylinderGeometry(0.2, 0.1, 1.8, 6);
  const torp = new THREE.Mesh(geom, glowBlue);
  torp.rotation.x = Math.PI / 2;

  const spawnPos = shipGroup.localToWorld(new THREE.Vector3(0, -0.8, -1.5));
  torp.position.copy(spawnPos);

  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQ);
  torp.lookAt(torp.position.clone().add(dir));
  torp.rotation.x += Math.PI / 2;

  torp.userData = {
    velocity: dir.multiplyScalar(100),
    target: activeTarget,
    life: 5.0
  };

  scene.add(torp);
  torpedos.push(torp);
}

function updatePlayerWeapons(dt) {
  // Regulate fire button holding
  if (firing) fireLaser();

  // Update Twin Lasers
  for(let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    l.userData.life -= dt;
    if(l.userData.life <= 0) {
      scene.remove(l);
      lasers.splice(i, 1);
      continue;
    }
    l.position.add(l.userData.velocity.clone().multiplyScalar(dt));

    // Check hit against active targets (mines and turrets)
    let hitSomething = false;
    activeSegments.forEach(seg => {
      for (let j = seg.children.length - 1; j >= 0; j--) {
        const child = seg.children[j];
        if (child.userData.isMine || child.userData.isTurret) {
          const worldPos = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
          const dist = l.position.distanceTo(worldPos);
          if (dist < 3.2) {
            child.userData.shields--;
            spawnExplosion(worldPos, 0.8);
            hitSomething = true;

            if (child.userData.shields <= 0) {
              spawnExplosion(worldPos, 2.0);
              playExplosionSound();
              seg.remove(child);
              score += child.userData.isTurret ? 200 : 50;
              if (child === activeTarget) activeTarget = null;
            }
            break;
          }
        }
      }
    });

    if (hitSomething) {
      scene.remove(l);
      lasers.splice(i, 1);
    }
  }

  // Update Homing Torpedos
  for (let i = torpedos.length - 1; i >= 0; i--) {
    const t = torpedos[i];
    t.userData.life -= dt;
    if (t.userData.life <= 0) {
      scene.remove(t);
      torpedos.splice(i, 1);
      continue;
    }

    const target = t.userData.target;
    // Check if target is still alive in the scene
    let targetExists = false;
    activeSegments.forEach(seg => {
      if(seg.children.includes(target)) targetExists = true;
    });

    if (targetExists) {
      const worldTargetPos = new THREE.Vector3().setFromMatrixPosition(target.matrixWorld);
      const desiredDir = worldTargetPos.sub(t.position).normalize();
      const currentDir = t.userData.velocity.clone().normalize();
      currentDir.lerp(desiredDir, 6.0 * dt);
      t.userData.velocity.copy(currentDir).multiplyScalar(TORPEDO_SPEED);
      t.lookAt(t.position.clone().add(t.userData.velocity));
      t.rotation.x += Math.PI / 2; // correction
    }

    t.position.add(t.userData.velocity.clone().multiplyScalar(dt));

    // Collision check
    let hitT = false;
    activeSegments.forEach(seg => {
      for(let j = seg.children.length - 1; j >= 0; j--) {
        const child = seg.children[j];
        if (child === target) {
          const worldPos = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
          const dist = t.position.distanceTo(worldPos);
          if (dist < 4.0) {
            spawnExplosion(worldPos, 3.5);
            playExplosionSound();
            seg.remove(child);
            score += child.userData.isTurret ? 200 : 50;
            activeTarget = null;
            hitT = true;
            break;
          }
        }
      }
    });

    if (hitT) {
      scene.remove(t);
      torpedos.splice(i, 1);
    }
  }
}

// ========== LOCK-ON RETICLE SCANNING ==========
function scanTargetLock() {
  let bestTarget = null;
  let minAngle = 0.12; // cone size
  
  activeSegments.forEach(seg => {
    seg.children.forEach(child => {
      if (child.userData.isTurret || child.userData.isMine) {
        const worldPos = new THREE.Vector3().setFromMatrixPosition(child.matrixWorld);
        const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQ);
        const toTarget = worldPos.clone().sub(shipPos).normalize();
        const angle = playerForward.angleTo(toTarget);
        
        // Target must be in front of us
        if (angle < minAngle && worldPos.z < shipPos.z) {
          minAngle = angle;
          bestTarget = child;
        }
      }
    });
  });

  if (bestTarget) {
    activeTarget = bestTarget;
  }
}

// ========== EXPLOSION PARTICLES ==========
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
  uniforms: { color: {value: new THREE.Color(0xff8833)} },
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
  const count = Math.floor(15 + size * 8);
  for(let e = 0; e < count; e++) {
    const i = expIdx % EXPLOSION_PARTICLE_COUNT;
    expPositions[i*3] = pos.x;
    expPositions[i*3+1] = pos.y;
    expPositions[i*3+2] = pos.z;
    expLife[i] = 0.4 + Math.random() * 0.6;
    expAlphas[i] = 1.0;
    expSizes[i] = 1.5 + Math.random() * 3.0;
    const dir = new THREE.Vector3(
      (Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)
    ).normalize().multiplyScalar(10 + Math.random() * 18 * size);
    expVelocities[i].copy(dir);
    expIdx++;
  }
  shakeIntensity = Math.max(shakeIntensity, 0.4 + size * 0.12);
}

function updateExplosionParticles(dt) {
  for(let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
    if(expLife[i] > 0) {
      expLife[i] -= dt;
      expPositions[i*3] += expVelocities[i].x * dt;
      expPositions[i*3+1] += expVelocities[i].y * dt;
      expPositions[i*3+2] += expVelocities[i].z * dt;
      expVelocities[i].multiplyScalar(0.95);
      expAlphas[i] = Math.max(0, expLife[i] / 1.0);
      expSizes[i] *= 0.98;
    } else {
      expAlphas[i] = 0;
    }
  }
  expGeom.attributes.position.needsUpdate = true;
  expGeom.attributes.alpha.needsUpdate = true;
  expGeom.attributes.size.needsUpdate = true;
}

// ========== SPACE DUST PARTICLES (Layer 2) ==========
const DUST_COUNT = 300;
const dustGeom = new THREE.BufferGeometry();
const dustPositions = new Float32Array(DUST_COUNT * 3);

for(let i=0; i<DUST_COUNT; i++) {
  dustPositions[i*3] = (Math.random() - 0.5) * 80;
  dustPositions[i*3+1] = (Math.random() - 0.5) * 60;
  dustPositions[i*3+2] = -Math.random() * 300;
}
dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0x00ffee,
  size: 0.6,
  transparent: true,
  opacity: 0.28,
  sizeAttenuation: true
});
const dustPoints = new THREE.Points(dustGeom, dustMat);
scene.add(dustPoints);

function updateSpaceDust(dt) {
  const pos = dustGeom.attributes.position;
  for(let i=0; i<DUST_COUNT; i++) {
    let z = pos.getZ(i) - shipVel.z * dt;
    let x = pos.getX(i) - shipVel.x * dt;
    let y = pos.getY(i) - shipVel.y * dt;

    const relativePos = new THREE.Vector3(x, y, z).sub(shipPos);
    if(relativePos.z > 30) relativePos.z -= 300;
    if(relativePos.z < -270) relativePos.z += 300;
    if(Math.abs(relativePos.x) > TUNNEL_WIDTH/2 || Math.abs(relativePos.y) > TUNNEL_HEIGHT/2) {
      relativePos.x = (Math.random() - 0.5) * TUNNEL_WIDTH;
      relativePos.y = (Math.random() - 0.5) * TUNNEL_HEIGHT;
    }
    const finalVal = relativePos.add(shipPos);
    pos.setXYZ(i, finalVal.x, finalVal.y, finalVal.z);
  }
  pos.needsUpdate = true;
}

// ========== COLLISION DETECTION & DAMAGE ==========
const flashOverlay = document.createElement('div');
flashOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.3);opacity:0;pointer-events:none;z-index:50;transition:opacity 0.08s;';
document.body.appendChild(flashOverlay);

function takeDamage() {
  if (invulnTimer > 0) return;
  shields--;
  shakeIntensity = 1.2;
  flashOverlay.style.opacity = '1';
  setTimeout(() => flashOverlay.style.opacity = '0', 100);
  invulnTimer = 1.0;
  playCrashSound();
  if (shields <= 0) die();
}

function handleStructuralCollisions(dt) {
  // Border boundaries: Width (X) and Height (Y)
  const xLimit = TUNNEL_WIDTH / 2 - 2.5;
  const yLimit = TUNNEL_HEIGHT / 2 - 2.2;

  let collided = false;
  if (shipPos.x > xLimit) { shipPos.x = xLimit; shipVel.x = -Math.abs(shipVel.x) * 0.4; collided = true; }
  if (shipPos.x < -xLimit) { shipPos.x = -xLimit; shipVel.x = Math.abs(shipVel.x) * 0.4; collided = true; }
  
  if (shipPos.y > yLimit) { shipPos.y = yLimit; shipVel.y = -Math.abs(shipVel.y) * 0.4; collided = true; }
  if (shipPos.y < -yLimit) { shipPos.y = -yLimit; shipVel.y = Math.abs(shipVel.y) * 0.4; collided = true; }

  if (collided) {
    takeDamage();
  }
}

// ========== HUD TELEMETRY UPDATE ==========
function updateHUD() {
  const ts = new Date().toLocaleTimeString();
  const hudLeft = document.getElementById('hud-top-left');
  const hudRight = document.getElementById('hud-top-right');

  const shieldStr = '\u2588'.repeat(shields) + '\u2591'.repeat(MAX_SHIELDS - shields);
  const lockStr = activeTarget 
    ? `<span style="color:#ff3333; font-weight:bold;">LOCKED</span>` 
    : `<span style="color:#6688aa;">SEARCHING</span>`;

  hudLeft.innerHTML = `
    [${ts}] CORRIDOR_FIGHTER_GHOST_v1.0<br>
    VELOCITY: [${shipVel.x.toFixed(1)}, ${shipVel.y.toFixed(1)}, ${shipVel.z.toFixed(1)}]<br>
    FLIGHT ASSIST: ${flightAssist ? '<span style="color:#00ffaa">ON</span>' : '<span style="color:#ff3333">OFF</span>'}<br>
    SHIELDS: <span style="color:${shields<=1?'#ff3333':'#00ffaa'}">${shieldStr}</span><br>
    COOLDOWN: ${torpedoCooldown > 0 ? torpedoCooldown.toFixed(1)+'s' : '<span style="color:#00ffaa">READY</span>'}<br>
    TARGET LOCK: ${lockStr}
  `;

  hudRight.textContent = `SCORE: ${score}`;

  // Fill bottom meters
  document.getElementById('shield-bar').style.width = (shields/MAX_SHIELDS*100)+'%';
  document.getElementById('energy-bar').style.width = (energy/MAX_ENERGY*100)+'%';
  document.getElementById('speed-bar').style.width = Math.min(100, Math.abs(shipVel.z)/BASE_SPEED/BOOST_MULT*100)+'%';
}

// ========== GAME CONTROL FLOW ==========
function startGame() {
  document.getElementById('start-screen').style.display = 'none';
  gameState = 'playing';
  clock = new THREE.Clock();
  initSynth();
}

function restartGame() {
  document.getElementById('game-over').style.display = 'none';
  score = 0; shields = MAX_SHIELDS; energy = MAX_ENERGY;
  shipPos.set(0, 0, 0); shipVel.set(0, 0, 0);
  shipQ.identity(); rotVel.set(0, 0, 0);
  activeTarget = null;
  torpedoCooldown = 0;
  invulnTimer = 0;
  boosting = false;

  // Clear level
  activeSegments.forEach(seg => scene.remove(seg));
  activeSegments.length = 0;

  // Clear projectiles
  lasers.forEach(l => scene.remove(l)); lasers.length = 0;
  torpedos.forEach(t => scene.remove(t)); torpedos.length = 0;
  turretLaserPool.forEach(tl => scene.remove(tl)); turretLaserPool.length = 0;

  initLevel();
  gameState = 'playing';
  clock = new THREE.Clock();
  document.body.requestPointerLock();
}

function die() {
  gameState = 'dead';
  document.getElementById('final-score').textContent = 'SCORE: ' + score;
  document.getElementById('game-over').style.display = 'flex';
  shakeIntensity = 2.0;

  // Stop Drone Audio
  if(synthDrone) {
    try {
      synthDrone.stop();
      synthDrone = null;
    } catch(e) {}
  }
}

// ========== MAIN ANIMATION LOOP ==========
function animate() {
  animFrameId = requestAnimationFrame(animate);

  if (gameState === 'start') {
    shipGroup.rotation.y += 0.005;
    renderer.render(scene, camera);
    return;
  }
  if (gameState === 'paused' || gameState === 'dead') {
    renderer.render(scene, camera);
    return;
  }

  const dt = Math.min(clock.getDelta(), 0.05);
  invulnTimer = Math.max(0, invulnTimer - dt);
  torpedoCooldown = Math.max(0, torpedoCooldown - dt);

  // Regenerate energy
  energy = Math.min(MAX_ENERGY, energy + ENERGY_REGEN * dt);

  // --- 6DOF ROTATIONAL INPUT ---
  const targetYawRate = -mouseX * 0.45;
  const targetPitchRate = -mouseY * 0.45;
  mouseX = 0; mouseY = 0; // consumed

  let rollInput = 0;
  if(keys['KeyQ']) rollInput += 1;
  if(keys['KeyE']) rollInput -= 1;
  const targetRollRate = rollInput * 2.2;

  // Rotational Inertia dampening
  rotVel.x += (targetPitchRate - rotVel.x) * 0.15;
  rotVel.y += (targetYawRate - rotVel.y) * 0.15;
  rotVel.z += (targetRollRate - rotVel.z) * 0.15;

  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotVel.x * dt);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotVel.y * dt);
  const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotVel.z * dt);
  shipQ.multiply(qPitch).multiply(qYaw).multiply(qRoll).normalize();

  // --- 6DOF LINEAR INPUTS ---
  const localThrust = new THREE.Vector3();
  if(keys['KeyW']) localThrust.z -= 1.0;
  if(keys['KeyS']) localThrust.z += 0.8;
  if(keys['KeyA']) localThrust.x -= 0.7;
  if(keys['KeyD']) localThrust.x += 0.7;
  if(keys['Space']) localThrust.y += 0.7;
  if(keys['ControlLeft'] || keys['ControlRight']) localThrust.y -= 0.7;

  boosting = (keys['ShiftLeft'] || keys['ShiftRight']) && keys['KeyW'];
  
  let thrustForce = BASE_SPEED * 1.8;
  if (boosting) {
    thrustForce *= BOOST_MULT;
    // Boost audio FX
    playTone(180 + Math.random()*20, 0.05, 'triangle', 0.08);
  }

  // Convert to world acceleration
  const worldThrust = localThrust.clone().applyQuaternion(shipQ).multiplyScalar(thrustForce * dt);
  shipVel.add(worldThrust);

  // Flight Assist logic
  if (flightAssist) {
    const localFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(shipQ);
    const localRt = new THREE.Vector3(1, 0, 0).applyQuaternion(shipQ);
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(shipQ);

    let vFwd = shipVel.dot(localFwd);
    let vRt = shipVel.dot(localRt);
    let vUp = shipVel.dot(localUp);

    // Apply counters if no input is pressed
    const damp = 0.94;
    if (localThrust.z === 0) vFwd *= damp;
    if (localThrust.x === 0) vRt *= damp;
    if (localThrust.y === 0) vUp *= damp;

    if (keys['KeyS']) {
      vFwd *= BRAKE_DRAG;
      vRt *= BRAKE_DRAG;
      vUp *= BRAKE_DRAG;
    }

    shipVel.copy(localFwd.multiplyScalar(vFwd))
           .add(localRt.multiplyScalar(vRt))
           .add(localUp.multiplyScalar(vUp));
  } else {
    // FA Off: extremely low drift resistance
    shipVel.multiplyScalar(0.998);
    if (keys['KeyS']) {
      shipVel.multiplyScalar(BRAKE_DRAG);
    }
  }

  // Cap speed
  const maxS = BASE_SPEED * BOOST_MULT * 1.5;
  if (shipVel.length() > maxS) {
    shipVel.setLength(maxS);
  }

  // Update position
  shipPos.add(shipVel.clone().multiplyScalar(dt));
  currentSpeed = shipVel.length();

  // Score distance calculation (flying forward relative to level)
  distance += Math.abs(shipVel.z) * dt;
  score = Math.max(score, Math.floor(distance * 0.25));

  // --- HULL COLLISION CRASH HANDLING ---
  handleStructuralCollisions(dt);

  // --- UPDATE OBJECTS ---
  shipGroup.position.copy(shipPos);
  shipGroup.quaternion.copy(shipQ);
  shipGroup.visible = invulnTimer > 0 ? Math.sin(invulnTimer * 30) > 0 : true;

  // Thruster light intensity
  const tLight = shipGroup.getObjectByName("thrusterLight");
  if(tLight) {
    tLight.intensity = boosting ? 4.0 : (Math.abs(shipVel.z) / BASE_SPEED) * 2.0;
    tLight.color.set(boosting ? 0xffcc00 : 0x00ffee);
  }

  // Update Systems
  updateLevel(dt);
  updateEnemyLasers(dt);
  updatePlayerWeapons(dt);
  updateExplosionParticles(dt);
  updateSpaceDust(dt);
  scanTargetLock();

  // --- CAMERA LERP & ALIGNMENT ---
  const localCamOffset = new THREE.Vector3(0, 3.8, 12.0);
  const worldCamOffset = localCamOffset.clone().applyQuaternion(shipQ);
  const camTarget = shipPos.clone().add(worldCamOffset);
  camera.position.lerp(camTarget, CAMERA_LAG);

  // Screen shake decay
  if (shakeIntensity > 0.01) {
    camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    camera.position.y += (Math.random() - 0.5) * shakeIntensity;
    shakeIntensity *= SHAKE_DECAY;
  }

  const localLookOffset = new THREE.Vector3(0, -0.4, -25);
  const worldLookTarget = localLookOffset.clone().applyQuaternion(shipQ).add(shipPos);
  
  const shipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(shipQ);
  camera.up.lerp(shipUp, 0.12);
  camera.lookAt(worldLookTarget);

  // --- HUD MOTION RETICLE LAG ---
  cockpitGroup.position.x = -rotVel.y * 0.045;
  cockpitGroup.position.y = rotVel.x * 0.045;
  cockpitGroup.rotation.z = -rotVel.z * 0.025;

  // --- RENDER HUD RETICLE & TAPE ---
  updateHUD();

  renderer.render(scene, camera);
}

// ========== INITIALIZE INPUT & POINTER LOCK LISTENERS ==========
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if(e.code === 'Enter') {
    if(gameState === 'start') {
      document.body.requestPointerLock();
    } else if(gameState === 'dead') {
      restartGame();
    }
  }
  if(e.code === 'KeyF' && gameState === 'playing') {
    fireTorpedo();
  }
  if(e.code === 'KeyZ' && gameState === 'playing') {
    flightAssist = !flightAssist;
    thTone(flightAssist ? 600 : 300, 0.15, 'triangle', 0.15);
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('mousedown', e => {
  if(gameState === 'playing') {
    firing = true;
  } else if (gameState === 'start' || gameState === 'paused') {
    document.body.requestPointerLock();
  } else if (gameState === 'dead') {
    restartGame();
  }
});
document.addEventListener('mouseup', e => {
  firing = false;
});

document.addEventListener('mousemove', e => {
  if (document.pointerLockElement === document.body && gameState === 'playing') {
    mouseX += e.movementX;
    mouseY += e.movementY;
  }
});

const startScreen = document.getElementById('start-screen');
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    if (gameState === 'start' || gameState === 'paused') {
      startGame();
    }
  } else {
    if (gameState === 'playing') {
      gameState = 'paused';
      startScreen.style.display = 'flex';
      document.querySelector('#start-screen h1').textContent = 'GAME PAUSED';
      document.querySelector('#start-screen .start-hint').textContent = 'CLICK TO RESUME';
    }
  }
});

// ========== RESIZE ==========
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Active Pause Cycle Damping
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (gameState === 'playing') {
      gameState = 'paused';
      if (typeof startScreen !== 'undefined' && startScreen) {
        startScreen.style.display = 'flex';
        const title = document.querySelector('#start-screen h1');
        if (title) title.textContent = 'GAME PAUSED';
        const hint = document.querySelector('#start-screen .start-hint');
        if (hint) hint.textContent = 'CLICK TO RESUME';
      }
    }
  } else {
    if (!animFrameId) {
      if (clock) clock.getDelta(); // Reset clock delta to avoid a huge frame jump
      animate();
    }
  }
});

// Initial Setup
initLevel();

// Run animation
animate();
