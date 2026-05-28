{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js"
  }
}

import * as THREE from 'three';

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  chunkGridSize: 80,      // grid points per chunk edge
  chunkScale: 4.0,        // world units per grid point
  renderRadius: 1,        // chunks in each direction (3x3 = 9 chunks, fast initial load)
  moveSpeed: 12.0,
  sprintMult: 2.5,
  jumpForce: 10.0,
  gravity: -25.0,
  sensitivity: 0.002,
  playerHeight: 2.5,
  dayLength: 120,         // seconds per full day cycle
  fogNear: 100,
  fogFar: 500,
};

const CHUNK_WORLD_SIZE = CONFIG.chunkGridSize * CONFIG.chunkScale;

// ============================================================
// NOISE — hash-based procedural height
// ============================================================
function hash2D(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Smoothstep
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmNoise(x, y, octaves = 5) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxVal = 0;

  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / maxVal;
}

function sampleHeight(worldX, worldZ) {
  const nx = worldX * 0.005;
  const nz = worldZ * 0.005;

  // Multi-scale terrain
  let h = fbmNoise(nx, nz, 5) * 60;              // base terrain
  h += fbmNoise(nx * 3, nz * 3, 3) * 15;          // detail
  h += fbmNoise(nx * 0.3, nz * 0.3, 2) * 80;      // mountains
  h -= 40; // sea level offset

  return h;
}

// ============================================================
// BIOME & COLOR
// ============================================================
function getTerrainColor(height, normal) {
  const ny = normal ? normal.y : 1;

  if (height < -5) {
    // Deep water
    return new THREE.Color(0.05, 0.15, 0.35);
  } else if (height < 0) {
    // Shallow water
    return new THREE.Color(0.1, 0.25, 0.5);
  } else if (height < 3) {
    // Sand/beach
    return new THREE.Color(0.76, 0.7, 0.5);
  } else if (height < 25) {
    // Grass
    const t = (height - 3) / 22;
    return new THREE.Color(0.15 + t * 0.1, 0.45 - t * 0.15, 0.1);
  } else if (height < 45) {
    // Rock
    if (ny < 0.7) {
      return new THREE.Color(0.35, 0.3, 0.25); // cliff face
    }
    return new THREE.Color(0.3, 0.35, 0.2); // grassy rock
  } else {
    // Snow
    if (ny > 0.6) {
      return new THREE.Color(0.9, 0.92, 0.95);
    }
    return new THREE.Color(0.4, 0.38, 0.35); // exposed rock
  }
}

function getBiomeName(height) {
  if (height < -5) return 'deep water';
  if (height < 0) return 'shallow water';
  if (height < 3) return 'beach';
  if (height < 25) return 'plains';
  if (height < 45) return 'highlands';
  return 'peaks';
}

// ============================================================
// CHUNK SYSTEM
// ============================================================
const chunkMeshes = new Map();
const heightCache = new Map();

function getCachedHeight(wx, wz) {
  const key = `${Math.round(wx)},${Math.round(wz)}`;
  if (heightCache.has(key)) return heightCache.get(key);
  const h = sampleHeight(wx, wz);
  heightCache.set(key, h);
  if (heightCache.size > 200000) {
    // Evict oldest entries
    const iter = heightCache.keys();
    for (let i = 0; i < 50000; i++) iter.next();
    // Simple eviction: clear all (rare)
    heightCache.clear();
  }
  return h;
}

function buildChunkGeometry(chunkX, chunkZ) {
  const size = CONFIG.chunkGridSize;
  const scale = CONFIG.chunkScale;
  const originX = chunkX * CHUNK_WORLD_SIZE;
  const originZ = chunkZ * CHUNK_WORLD_SIZE;

  const positions = [];
  const colors = [];
  const normals = [];
  const indices = [];

  // Sample heights
  const heights = new Float32Array((size + 1) * (size + 1));
  for (let gz = 0; gz <= size; gz++) {
    for (let gx = 0; gx <= size; gx++) {
      const wx = originX + gx * scale;
      const wz = originZ + gz * scale;
      heights[gz * (size + 1) + gx] = getCachedHeight(wx, wz);
    }
  }

  // Build vertices
  for (let gz = 0; gz <= size; gz++) {
    for (let gx = 0; gx <= size; gx++) {
      const wx = gx * scale;
      const wz = gz * scale;
      const h = heights[gz * (size + 1) + gx];

      positions.push(wx, h, wz);

      // Compute normal from neighboring heights
      const hL = gx > 0 ? heights[gz * (size + 1) + gx - 1] : h;
      const hR = gx < size ? heights[gz * (size + 1) + gx + 1] : h;
      const hD = gz > 0 ? heights[(gz - 1) * (size + 1) + gx] : h;
      const hU = gz < size ? heights[(gz + 1) * (size + 1) + gx] : h;

      const nx = (hL - hR) / (2 * scale);
      const nz = (hD - hU) / (2 * scale);
      const len = Math.sqrt(nx * nx + 1 + nz * nz);
      normals.push(nx / len, 1 / len, nz / len);

      // Color by height and slope
      const normal = { y: 1 / len };
      const col = getTerrainColor(h, normal);
      colors.push(col.r, col.g, col.b);
    }
  }

  // Build indices (triangle strip as indexed triangles)
  for (let gz = 0; gz < size; gz++) {
    for (let gx = 0; gx < size; gx++) {
      const a = gz * (size + 1) + gx;
      const b = a + 1;
      const c = a + (size + 1);
      const d = c + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  return geometry;
}

// ============================================================
// SCENE SETUP
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x88aacc, CONFIG.fogNear, CONFIG.fogFar);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 1000);

// Terrain material
const terrainMaterial = new THREE.MeshPhongMaterial({
  vertexColors: true,
  flatShading: true,
  shininess: 5,
});

// Lights
const ambientLight = new THREE.AmbientLight(0x444466, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffeedd, 1.0);
sunLight.position.set(100, 200, 50);
scene.add(sunLight);

// Stars
const starCount = 2000;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(Math.random() * 2 - 1);
  const r = 400;
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = Math.abs(r * Math.cos(phi)); // upper hemisphere
  starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false });
const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

// Water plane
const waterGeometry = new THREE.PlaneGeometry(5000, 5000);
const waterMaterial = new THREE.MeshPhongMaterial({
  color: 0x1a4a6a,
  transparent: true,
  opacity: 0.6,
  shininess: 80,
});
const waterPlane = new THREE.Mesh(waterGeometry, waterMaterial);
waterPlane.rotation.x = -Math.PI / 2;
waterPlane.position.y = -2;
scene.add(waterPlane);

// ============================================================
// CHUNK MANAGEMENT
// ============================================================
function updateChunks(playerChunkX, playerChunkZ) {
  const radius = CONFIG.renderRadius;
  const needed = new Set();

  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const cx = playerChunkX + dx;
      const cz = playerChunkZ + dz;
      const key = `${cx},${cz}`;
      needed.add(key);

      if (!chunkMeshes.has(key)) {
        const geom = buildChunkGeometry(cx, cz);
        const mesh = new THREE.Mesh(geom, terrainMaterial);
        mesh.position.set(cx * CHUNK_WORLD_SIZE, 0, cz * CHUNK_WORLD_SIZE);
        scene.add(mesh);
        chunkMeshes.set(key, mesh);
      }
    }
  }

  // Remove distant chunks
  const toRemove = [];
  for (const [key, mesh] of chunkMeshes) {
    if (!needed.has(key)) {
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    const mesh = chunkMeshes.get(key);
    scene.remove(mesh);
    mesh.geometry.dispose();
    chunkMeshes.delete(key);
  }
}

// ============================================================
// PLAYER STATE
// ============================================================
const player = {
  x: 12 * CHUNK_WORLD_SIZE + 22 * CONFIG.chunkScale,
  y: 50,
  z: -7 * CHUNK_WORLD_SIZE + (-18) * CONFIG.chunkScale,
  yaw: 0,
  pitch: 0,
  vy: 0,
  grounded: false,
  chunkX: 12,
  chunkZ: -7,
  sprint: false,
};

// ============================================================
// INPUT
// ============================================================
const keys = {};
let isLocked = false;

window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

document.addEventListener('pointerlockchange', () => {
  isLocked = document.pointerLockElement === renderer.domElement || document.pointerLockElement === document.body;
  if (!isLocked) {
    document.getElementById('start-screen').style.display = 'flex';
  }
});

document.addEventListener('mousemove', e => {
  if (!isLocked) return;
  player.yaw -= e.movementX * CONFIG.sensitivity;
  player.pitch -= e.movementY * CONFIG.sensitivity;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});

document.getElementById('start-screen').addEventListener('click', () => {
  // Hide overlay immediately — don't wait for pointer lock
  document.getElementById('start-screen').style.display = 'none';
  // Request pointer lock on body with promise handling
  const lockTarget = renderer.domElement;
  const lockPromise = lockTarget.requestPointerLock();
  if (lockPromise && lockPromise.catch) {
    lockPromise.catch(() => {
      // Fallback: try document.body
      document.body.requestPointerLock && document.body.requestPointerLock();
    });
  }
});

// PostMessage for game shell
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'pause') isLocked = false;
  if (e.data && e.data.type === 'resume') renderer.domElement.requestPointerLock();
});

// ============================================================
// DAY/NIGHT CYCLE
// ============================================================
function updateDayCycle(elapsed) {
  const dayFactor = (Math.sin(elapsed * Math.PI * 2 / CONFIG.dayLength) + 1) / 2;

  // Sky color
  const dayColor = new THREE.Color(0.45, 0.65, 0.9);
  const nightColor = new THREE.Color(0.02, 0.02, 0.06);
  const skyColor = dayColor.clone().lerp(nightColor, 1 - dayFactor);
  scene.background = skyColor;
  scene.fog.color.copy(skyColor);

  // Sun position
  const sunAngle = elapsed * Math.PI * 2 / CONFIG.dayLength;
  sunLight.position.set(
    Math.cos(sunAngle) * 200,
    Math.sin(sunAngle) * 200 + 50,
    100
  );

  // Light intensity
  sunLight.intensity = Math.max(0.05, dayFactor * 1.2);
  ambientLight.intensity = 0.15 + dayFactor * 0.4;

  // Sun color (warm at horizon, white at noon)
  const horizonFactor = Math.abs(Math.sin(sunAngle));
  sunLight.color.setRGB(
    1.0,
    0.7 + horizonFactor * 0.3,
    0.5 + horizonFactor * 0.5
  );

  // Stars visibility
  starMaterial.opacity = Math.max(0, 1 - dayFactor * 3);
  starMaterial.transparent = true;
  stars.position.set(player.x, 0, player.z); // follow player

  // Water color shifts
  waterMaterial.color.setRGB(
    0.05 + dayFactor * 0.1,
    0.15 + dayFactor * 0.2,
    0.3 + dayFactor * 0.15
  );

  return dayFactor;
}

// ============================================================
// GAME LOOP
// ============================================================
let lastTime = performance.now();
const startTime = performance.now();

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = now;
  const elapsed = (now - startTime) / 1000;

  // Day/night
  const dayFactor = updateDayCycle(elapsed);

  if (isLocked) {
    // Movement
    const speed = CONFIG.moveSpeed * (keys['ShiftLeft'] ? CONFIG.sprintMult : 1) * dt;
    const airControl = player.grounded ? 1.0 : 0.3;

    const fwdX = Math.sin(player.yaw);
    const fwdZ = Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);

    if (keys['KeyW']) { player.x += fwdX * speed * airControl; player.z += fwdZ * speed * airControl; }
    if (keys['KeyS']) { player.x -= fwdX * speed * airControl; player.z -= fwdZ * speed * airControl; }
    if (keys['KeyA']) { player.x -= rightX * speed * airControl; player.z -= rightZ * speed * airControl; }
    if (keys['KeyD']) { player.x += rightX * speed * airControl; player.z += rightZ * speed * airControl; }

    // Jump
    if (keys['Space'] && player.grounded) {
      player.vy = CONFIG.jumpForce;
      player.grounded = false;
    }

    // Gravity
    player.vy += CONFIG.gravity * dt;
    player.y += player.vy * dt;

    // Ground collision
    const groundHeight = getCachedHeight(player.x, player.z) + CONFIG.playerHeight;
    if (player.y <= groundHeight) {
      player.y = groundHeight;
      player.vy = 0;
      player.grounded = true;
    }

    // Update chunk
    const newChunkX = Math.floor(player.x / CHUNK_WORLD_SIZE);
    const newChunkZ = Math.floor(player.z / CHUNK_WORLD_SIZE);
    if (newChunkX !== player.chunkX || newChunkZ !== player.chunkZ) {
      player.chunkX = newChunkX;
      player.chunkZ = newChunkZ;
      updateChunks(player.chunkX, player.chunkZ);
    }
  }

  // Camera
  camera.position.set(player.x, player.y, player.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // Water follows player
  waterPlane.position.set(player.x, -2, player.z);

  // HUD
  const terrainH = getCachedHeight(player.x, player.z);
  const hours = Math.floor((elapsed % CONFIG.dayLength) / CONFIG.dayLength * 24);
  const mins = Math.floor(((elapsed % CONFIG.dayLength) / CONFIG.dayLength * 24 - hours) * 60);
  document.getElementById('hud-chunk').textContent = `Chunk: (${player.chunkX}, ${player.chunkZ})`;
  document.getElementById('hud-pos').textContent = `Pos: (${player.x.toFixed(0)}, ${player.y.toFixed(1)}, ${player.z.toFixed(0)})`;
  document.getElementById('hud-height').textContent = `Height: ${terrainH.toFixed(1)}`;
  document.getElementById('hud-time').textContent = `Time: ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  document.getElementById('hud-biome').textContent = `Biome: ${getBiomeName(terrainH)}`;

  renderer.render(scene, camera);

  frameCount++;
  if (frameCount === 3) expandRadius(); // expand after 3 frames rendered
}

// ============================================================
// INIT
// ============================================================
let frameCount = 0;

function init() {
  updateChunks(player.chunkX, player.chunkZ);
  player.y = getCachedHeight(player.x, player.z) + CONFIG.playerHeight;
  requestAnimationFrame(gameLoop);
}

// Progressive load: expand render radius after first frames render
function expandRadius() {
  if (CONFIG.renderRadius < 2) {
    CONFIG.renderRadius = 2;
    updateChunks(player.chunkX, player.chunkZ);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();