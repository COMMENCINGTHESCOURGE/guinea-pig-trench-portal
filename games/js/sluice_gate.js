// Animated ASCII corridor: # → ♯ → |_| → ♯ → # (gate swinging open and shut)
(function() {
  const art = document.getElementById('corridor-art');
  const ROWS = 13;
  const TOTAL_W = 45;
  // Gate cycle: closed(#) → tilting(♯) → open(|_|) → tilting(♯) → closed
  // Each state has a center symbol and a gap width
  // # closed (locked grid) → ♯ tilting (verticals swinging) → = open (horizontals only, see through)
  const STATES = [
    { sym: '#', gap: 0, color: '#00d4cc' },      // closed — locked grid
    { sym: '#', gap: 0, color: '#00d4cc' },      // hold closed
    { sym: '#', gap: 0, color: '#00ccbb' },      // starting
    { sym: '♯', gap: 0, color: '#00ddaa' },      // verticals tilting
    { sym: '♯', gap: 0, color: '#00ee99' },      // tilting more
    { sym: '♯', gap: 1, color: '#00ff88' },      // swinging open
    { sym: '=', gap: 1, color: '#00ffaa' },      // open — just horizontals
    { sym: '=', gap: 2, color: '#00ffcc' },      // wide open
    { sym: '=', gap: 2, color: '#00ffcc' },      // hold open
    { sym: '=', gap: 2, color: '#00ffcc' },      // hold open
    { sym: '=', gap: 1, color: '#00ffaa' },      // closing
    { sym: '♯', gap: 1, color: '#00ff88' },      // verticals swinging back
    { sym: '♯', gap: 0, color: '#00ee99' },      // almost shut
    { sym: '♯', gap: 0, color: '#00ddaa' },      // nearly locked
    { sym: '#', gap: 0, color: '#00ccbb' },      // locked
    { sym: '#', gap: 0, color: '#00d4cc' },      // closed
  ];

  let frame = 0;
  const FPS = 3; // slow deliberate cycle

  function render() {
    const st = STATES[frame % STATES.length];
    let html = '';

    for (let r = 0; r < ROWS; r++) {
      const depth = r; // how deep into the corridor
      const indent = depth;
      const bracketCount = Math.max(1, Math.floor((TOTAL_W - indent * 2 - 5) / 2));
      const deepCount = Math.floor(bracketCount * 0.5);
      const wallCount = Math.floor(bracketCount * 0.3);
      const nearCount = bracketCount - deepCount - wallCount;

      // Gate symbol varies by depth — deeper rows are more open (further from viewer)
      const depthPhase = (frame + Math.floor(r * 0.7)) % STATES.length;
      const dSt = STATES[depthPhase];

      // Build center gate
      let center;
      if (dSt.gap >= 2) {
        // Open — show gap with gate edges
        const gapSpaces = ' '.repeat(dSt.gap);
        center = `<span class="gate" style="color:${dSt.color}">]${gapSpaces}${dSt.sym}${gapSpaces}[</span>`;
      } else if (dSt.gap === 1) {
        center = `<span class="gate" style="color:${dSt.color}"> ${dSt.sym} </span>`;
      } else {
        center = `<span class="gate" style="color:${dSt.color}"> ${dSt.sym} </span>`;
      }

      // Build bracket walls
      const pad = ' '.repeat(indent);
      const rightBrackets = ']'.repeat(nearCount) ;
      const leftBrackets = '['.repeat(nearCount);
      const rWall = ']'.repeat(wallCount);
      const lWall = '['.repeat(wallCount);
      const rDeep = ']'.repeat(deepCount);
      const lDeep = '['.repeat(deepCount);

      html += `<span class="row">${pad}<span class="deep">${rDeep}</span><span class="wall">${rWall}</span><span class="bracket">${rightBrackets}</span>${center}<span class="bracket">${leftBrackets}</span><span class="wall">${lWall}</span><span class="deep">${lDeep}</span></span>\n`;
    }

    art.innerHTML = html;
  }

  render();
  setInterval(() => {
    frame++;
    render();
  }, 1000 / FPS);
})();

// THE SLUICE GATE — First-Person Playable Corridor
// CUDA raymarched scene → Three.js walkable game asset
// Guinea Pig Trench LLC

const TEAL = 0x00d9cc;
const GOLD = 0xf0c030;
const STEEL = 0x8a8a8a;

let scene, camera, renderer, clock;
let leftDoor, rightDoor, hologramHash, star;
let gateOpen = 0, gateTarget = 0;
let started = false;

// Player
const player = { x: 0, y: 1.6, z: 6, yaw: Math.PI, pitch: 0 };
const keys = {};
const SPEED = 4.0;
const MOUSE_SENS = 0.002;
const CORRIDOR_HALF_W = 2.8;
const CORRIDOR_Z_MIN = -18;
const CORRIDOR_Z_MAX = 8;
const PLAYER_RADIUS = 0.3;

// Messages
const msgEl = document.getElementById('msg');
let msgTimer = 0;
function showMsg(text, dur) {
  msgEl.textContent = text;
  msgEl.style.opacity = '1';
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => msgEl.style.opacity = '0', dur || 3000);
}

// HUD
const roomNameEl = document.getElementById('room-name');
const filterStatusEl = document.getElementById('filter-status');
const gateFillEl = document.getElementById('gate-fill');

// Flags
let shownGateHint = false;
let shownBeyond = false;
let shownBooks = false;
let shownDeep = false;

// === INIT ===
function init() {
  clock = new THREE.Clock();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080810);
  scene.fog = new THREE.FogExp2(0x080810, 0.04);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 100);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  document.body.appendChild(renderer.domElement);

  // === LIGHTING ===
  scene.add(new THREE.AmbientLight(0x222233, 0.3));

  // Overhead strips along corridor
  for (let z = -16; z <= 6; z += 4) {
    const strip = new THREE.PointLight(0xffffff, 0.4, 6);
    strip.position.set(0, 3.9, z);
    scene.add(strip);
  }

  // Floor edge lights
  for (let z = -16; z <= 6; z += 3) {
    const ll = new THREE.PointLight(0xffffff, 0.15, 3);
    ll.position.set(-2.85, 0.05, z);
    scene.add(ll);
    const lr = new THREE.PointLight(0xffffff, 0.15, 3);
    lr.position.set(2.85, 0.05, z);
    scene.add(lr);
  }

  // Teal backlight from beyond gate
  const gateLightBack = new THREE.PointLight(TEAL, 2.0, 15);
  gateLightBack.position.set(0, 2, -3);
  scene.add(gateLightBack);

  // Warm front light
  const front = new THREE.DirectionalLight(0xffe8d0, 0.4);
  front.position.set(2, 4, 6);
  front.castShadow = true;
  scene.add(front);

  // === FLOOR ===
  const floorGeo = new THREE.PlaneGeometry(6, 28, 12, 56);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.3, metalness: 0.6 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -5);
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(28, 56, 0x222244, 0x151525);
  grid.position.set(0, 0.005, -5);
  scene.add(grid);

  // === CEILING ===
  const ceilGeo = new THREE.PlaneGeometry(6, 28);
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0c0c14, roughness: 0.8 });
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 4, -5);
  scene.add(ceiling);

  // === WALLS (extended corridor) ===
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1c1c24, roughness: 0.5, metalness: 0.3 });
  const wallGeo = new THREE.PlaneGeometry(28, 4);

  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-3, 2, -5);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(3, 2, -5);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // Back wall
  const backWallGeo = new THREE.PlaneGeometry(6, 4);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 2, -19);
  scene.add(backWall);

  // Front wall
  const frontWall = new THREE.Mesh(backWallGeo, wallMat);
  frontWall.position.set(0, 2, 9);
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

  // === DIAMOND PANELS ===
  buildDiamondPanels(-3.01, Math.PI / 2);
  buildDiamondPanels(3.01, -Math.PI / 2);

  // === DOOR FRAME ===
  const frameMat = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.3, metalness: 0.8 });
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.3), frameMat);
  topBeam.position.set(0, 3.55, 0);
  topBeam.castShadow = true;
  scene.add(topBeam);

  const sideGeo = new THREE.BoxGeometry(0.15, 3.5, 0.3);
  const sideL = new THREE.Mesh(sideGeo, frameMat);
  sideL.position.set(-1.5, 1.75, 0);
  scene.add(sideL);
  const sideR = new THREE.Mesh(sideGeo, frameMat);
  sideR.position.set(1.5, 1.75, 0);
  scene.add(sideR);

  // === DOORS — Lattice mesh gate with ornate frame ===
  leftDoor = buildLatticeDoor();
  leftDoor.position.set(-0.7, 1.75, 0);
  scene.add(leftDoor);

  rightDoor = buildLatticeDoor();
  rightDoor.position.set(0.7, 1.75, 0);
  scene.add(rightDoor);

  // === ORNATE FRAME SURROUND (ref 1: red/gold mandala panels) ===
  buildOrnateFrame();

  // === STAR APERTURE ===
  const starGeo = new THREE.OctahedronGeometry(0.3, 0);
  const starMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.9 });
  star = new THREE.Mesh(starGeo, starMat);
  star.position.set(0, 1.75, 0.05);
  star.rotation.z = Math.PI / 4;
  star.scale.set(1, 1.3, 0.4);
  scene.add(star);

  // === BOOKSHELVES ===
  buildBookshelves(-2.7);
  buildBookshelves(2.7);

  // === HOLOGRAPHIC # ===
  buildHologram();

  // === DATA PARTICLES ===
  const pCount = 300;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i*3] = (Math.random() - 0.5) * 5.5;
    pPos[i*3+1] = Math.random() * 4;
    pPos[i*3+2] = (Math.random() - 0.5) * 26;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: TEAL, size: 0.02, transparent: true, opacity: 0.3 });
  scene.add(new THREE.Points(pGeo, pMat));

  // === BEYOND THE GATE — teal void with geometry ===
  // Floating platforms beyond z < -1
  const platMat = new THREE.MeshStandardMaterial({ color: 0x0a1a1a, roughness: 0.4, metalness: 0.5, emissive: TEAL, emissiveIntensity: 0.05 });
  for (let i = 0; i < 8; i++) {
    const w = 1.5 + Math.random() * 2;
    const platGeo = new THREE.BoxGeometry(w, 0.1, w);
    const plat = new THREE.Mesh(platGeo, platMat);
    plat.position.set(
      (Math.random() - 0.5) * 4,
      Math.random() * 0.5 - 0.2,
      -4 - i * 2 - Math.random()
    );
    plat.rotation.y = Math.random() * 0.3;
    scene.add(plat);
  }

  // Floating # symbols in the beyond
  for (let i = 0; i < 5; i++) {
    const hg = buildSmallHash();
    hg.position.set(
      (Math.random() - 0.5) * 4,
      1.5 + Math.random() * 2,
      -6 - i * 3
    );
    hg.scale.setScalar(0.3 + Math.random() * 0.3);
    hg.userData.floatOffset = Math.random() * Math.PI * 2;
    hg.userData.floatSpeed = 0.3 + Math.random() * 0.5;
    scene.add(hg);
  }

  // === EVENTS ===
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  document.addEventListener('mousemove', e => {
    if (!started || document.pointerLockElement !== renderer.domElement) return;
    player.yaw += e.movementX * MOUSE_SENS;
    player.pitch -= e.movementY * MOUSE_SENS;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
  });

  window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'e') {
      const dz = Math.abs(player.z);
      const dx = Math.abs(player.x);
      if (dz < 3.0 && dx < 2.5) {
        gateTarget = gateTarget < 0.5 ? 1.0 : 0.0;
      }
    }
  });

  renderer.domElement.addEventListener('click', () => {
    if (started) renderer.domElement.requestPointerLock();
  });
}

function enterGame() {
  if (started) return;
  const startScreen = document.getElementById('start-screen');
  startScreen.style.opacity = '0';
  startScreen.style.transition = 'opacity 0.5s';
  started = true;
  setTimeout(() => {
    startScreen.style.display = 'none';
    renderer.domElement.requestPointerLock();
    showMsg('The gate filters. Only what survives passes through.', 4000);
  }, 500);
}

function buildDiamondPanels(xPos, rotY) {
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 20; col++) {
      const dGeo = new THREE.PlaneGeometry(0.45, 0.45);
      const dMesh = new THREE.Mesh(dGeo, (row + col) % 2 === 0 ? lightMat : darkMat);
      dMesh.rotation.y = rotY;
      dMesh.rotation.z = Math.PI / 4;
      dMesh.position.set(xPos, 0.5 + row * 1.0, -10 + col * 1.1);
      scene.add(dMesh);
    }
  }
}

function buildLatticeDoor() {
  // Reference 2: Industrial steel grid with gold diamond mesh woven between crossbars
  // Semi-transparent — teal light bleeds through from the beyond
  const door = new THREE.Group();

  // Back panel — dark, semi-transparent to let teal light through
  const backMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a22, roughness: 0.4, metalness: 0.6,
    transparent: true, opacity: 0.3, side: THREE.DoubleSide
  });
  const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 3.48), backMat);
  backPanel.position.z = -0.02;
  door.add(backPanel);

  // Steel crossbars — the # grid structure (blue-steel color)
  const barMat = new THREE.MeshStandardMaterial({ color: 0x6680aa, roughness: 0.25, metalness: 0.85 });

  // Horizontal bars
  const hBarGeo = new THREE.BoxGeometry(1.4, 0.04, 0.05);
  for (let y = -1.6; y <= 1.6; y += 0.32) {
    const bar = new THREE.Mesh(hBarGeo, barMat);
    bar.position.y = y;
    bar.castShadow = true;
    door.add(bar);
  }

  // Vertical bars
  const vBarGeo = new THREE.BoxGeometry(0.04, 3.5, 0.05);
  for (let x = -0.64; x <= 0.64; x += 0.32) {
    const bar = new THREE.Mesh(vBarGeo, barMat);
    bar.position.x = x;
    bar.castShadow = true;
    door.add(bar);
  }

  // Gold diamond mesh woven between the bars
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4a830, roughness: 0.35, metalness: 0.75,
    emissive: 0x332200, emissiveIntensity: 0.15,
    side: THREE.DoubleSide
  });

  // Diamond mesh — rotated squares filling each grid cell
  for (let gx = -0.48; gx <= 0.48; gx += 0.32) {
    for (let gy = -1.44; gy <= 1.44; gy += 0.32) {
      const dSize = 0.2;
      const diamond = new THREE.Mesh(new THREE.PlaneGeometry(dSize, dSize), goldMat);
      diamond.rotation.z = Math.PI / 4;
      diamond.position.set(gx, gy, 0.01);
      door.add(diamond);

      // Inner diamond wire (the mesh weave pattern)
      const innerWire = new THREE.Mesh(
        new THREE.RingGeometry(0.04, 0.08, 4),
        new THREE.MeshStandardMaterial({ color: 0xc8a020, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide })
      );
      innerWire.rotation.z = Math.PI / 4;
      innerWire.position.set(gx, gy, 0.015);
      door.add(innerWire);
    }
  }

  // Diagonal cross-braces (the X patterns visible in reference)
  const braceMat = new THREE.MeshStandardMaterial({ color: 0xb89828, roughness: 0.4, metalness: 0.7 });
  const braceGeo = new THREE.BoxGeometry(0.38, 0.015, 0.02);

  for (let gx = -0.48; gx <= 0.48; gx += 0.32) {
    for (let gy = -1.44; gy <= 1.44; gy += 0.32) {
      const b1 = new THREE.Mesh(braceGeo, braceMat);
      b1.rotation.z = Math.PI / 4;
      b1.position.set(gx, gy, 0.005);
      door.add(b1);

      const b2 = new THREE.Mesh(braceGeo, braceMat);
      b2.rotation.z = -Math.PI / 4;
      b2.position.set(gx, gy, 0.005);
      door.add(b2);
    }
  }

  // Outer frame border on the door itself
  const frameBorderMat = new THREE.MeshStandardMaterial({ color: 0x778899, roughness: 0.3, metalness: 0.8 });
  // Top/bottom borders
  door.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), frameBorderMat), { position: new THREE.Vector3(0, 1.72, 0) }));
  door.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.06), frameBorderMat), { position: new THREE.Vector3(0, -1.72, 0) }));
  // Side borders
  door.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.5, 0.06), frameBorderMat), { position: new THREE.Vector3(-0.67, 0, 0) }));
  door.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.5, 0.06), frameBorderMat), { position: new THREE.Vector3(0.67, 0, 0) }));

  return door;
}

function buildOrnateFrame() {
  // Reference 1: Dark steel panels with gold vine inlays and red-bordered center mandala
  // Applied to the door frame surround — the fixed archway around the sliding doors

  const RED = 0xaa2222;
  const DEEP_RED = 0x661111;
  const FRAME_GOLD = 0xd4a830;

  // Red border panels flanking the door frame (above and sides)
  const redPanelMat = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
  const darkPanelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide });

  // Top panel — the ornate header above the gate
  const topPanelGroup = new THREE.Group();

  // Dark steel base
  const topBase = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), darkPanelMat);
  topPanelGroup.add(topBase);

  // Red border inset
  const redBorder = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.35),
    redPanelMat
  );
  redBorder.position.z = 0.005;
  topPanelGroup.add(redBorder);

  // Gold vine/branch inlays — radial pattern (the mandala from ref 1)
  const vineGoldMat = new THREE.MeshStandardMaterial({
    color: FRAME_GOLD, roughness: 0.3, metalness: 0.8,
    emissive: 0x221100, emissiveIntensity: 0.2
  });

  // Radial spokes
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.012, 0.01), vineGoldMat);
    spoke.rotation.z = angle;
    spoke.position.z = 0.01;
    topPanelGroup.add(spoke);
  }

  // Center rosette
  const rosette = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.12, 8),
    vineGoldMat
  );
  rosette.position.z = 0.012;
  topPanelGroup.add(rosette);

  // Outer ring
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.25, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: FRAME_GOLD, roughness: 0.3, metalness: 0.8, side: THREE.DoubleSide })
  );
  outerRing.position.z = 0.011;
  topPanelGroup.add(outerRing);

  topPanelGroup.position.set(0, 3.85, 0);
  scene.add(topPanelGroup);

  // Side ornate panels (left and right of door frame)
  [-1.65, 1.65].forEach(xPos => {
    const sidePanel = new THREE.Group();

    // Dark steel base
    const sBase = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.4), darkPanelMat);
    sidePanel.add(sBase);

    // Red trim stripe
    const redStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 3.2),
      redPanelMat
    );
    redStripe.position.z = 0.005;
    sidePanel.add(redStripe);

    // Gold vine branches running vertically
    for (let vy = -1.4; vy <= 1.4; vy += 0.5) {
      // Diagonal branch
      const branch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.01, 0.01), vineGoldMat);
      branch.rotation.z = (Math.random() - 0.5) * 0.8;
      branch.position.set(0, vy, 0.008);
      sidePanel.add(branch);

      // Small leaf/bud
      const bud = new THREE.Mesh(
        new THREE.CircleGeometry(0.025, 5),
        vineGoldMat
      );
      bud.position.set((Math.random() - 0.5) * 0.1, vy + 0.06, 0.009);
      sidePanel.add(bud);
    }

    // Gold corner accents (X pattern from ref 1)
    [[-0.08, 1.55], [-0.08, -1.55], [0.08, 1.55], [0.08, -1.55]].forEach(([cx, cy]) => {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.01), vineGoldMat);
      corner.rotation.z = Math.PI / 4;
      corner.position.set(cx, cy, 0.01);
      sidePanel.add(corner);
      const corner2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.012, 0.01), vineGoldMat);
      corner2.rotation.z = -Math.PI / 4;
      corner2.position.set(cx, cy, 0.01);
      sidePanel.add(corner2);
    });

    sidePanel.position.set(xPos, 1.75, 0);
    scene.add(sidePanel);
  });

  // Bottom threshold — dark steel with red inlay
  const threshold = new THREE.Group();
  const thBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 0.3), darkPanelMat);
  threshold.add(thBase);
  const thRed = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.02, 0.1),
    redPanelMat
  );
  thRed.position.y = 0.02;
  threshold.add(thRed);
  threshold.position.set(0, 0.025, 0);
  scene.add(threshold);
}

function buildBookshelves(xPos) {
  const shelfMat = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.4, metalness: 0.6 });
  const bookColors = [0x8B2500, 0xCC2222, 0x1a1a66, 0x1a4a1a, 0xBB8833, 0x441144, 0x114444];

  // Shelves from z=1 to z=8 (player side) and z=-1 to z=-16 (beyond side)
  for (let z = -15; z <= 7; z += 0.7) {
    if (Math.abs(z) < 1.5) continue; // skip near gate

    // Shelf plank
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.6), shelfMat);
    plank.position.set(xPos, 0, z);
    // Add planks at multiple heights
    for (let h = 0.7; h < 3.5; h += 0.7) {
      const p = plank.clone();
      p.position.y = h;
      scene.add(p);

      // Books on each shelf
      let bx = -0.25;
      while (bx < 0.2) {
        if (Math.random() > 0.15) { // some gaps
          const bw = 0.02 + Math.random() * 0.04;
          const bh = 0.2 + Math.random() * 0.35;
          const bColor = bookColors[Math.floor(Math.random() * bookColors.length)];
          const bookMat = new THREE.MeshStandardMaterial({ color: bColor, roughness: 0.7, metalness: 0.1 });
          const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.12), bookMat);
          book.position.set(
            xPos + (xPos > 0 ? -0.15 : 0.15) + (Math.random() > 0.8 ? (xPos > 0 ? 0.05 : -0.05) : 0),
            h + bh / 2 + 0.01,
            z + bx
          );
          scene.add(book);

          // Gold spine line
          if (Math.random() > 0.6) {
            const spine = new THREE.Mesh(
              new THREE.BoxGeometry(bw + 0.002, 0.005, 0.002),
              new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.1, roughness: 0.3, metalness: 0.8 })
            );
            spine.position.set(
              book.position.x + (xPos > 0 ? 0.06 : -0.06),
              h + bh * 0.7,
              z + bx
            );
            scene.add(spine);
          }
        }
        bx += 0.03 + Math.random() * 0.05;
      }
    }
  }
}

function buildHologram() {
  hologramHash = new THREE.Group();
  const barMat = new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.7 });
  const wireMat = new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.4 });

  const vGeo = new THREE.BoxGeometry(0.06, 0.8, 0.02);
  const hGeo = new THREE.BoxGeometry(0.8, 0.06, 0.02);

  [[-0.12, 0], [0.12, 0]].forEach(([x]) => {
    const bar = new THREE.Mesh(vGeo, barMat);
    bar.position.set(x, 0, 0);
    hologramHash.add(bar);
    const w = new THREE.Mesh(vGeo, wireMat);
    w.position.set(x, 0, 0);
    w.scale.multiplyScalar(1.3);
    hologramHash.add(w);
  });

  [[0, 0.12], [0, -0.12]].forEach(([, y]) => {
    const bar = new THREE.Mesh(hGeo, barMat);
    bar.position.set(0, y, 0);
    hologramHash.add(bar);
    const w = new THREE.Mesh(hGeo, wireMat);
    w.position.set(0, y, 0);
    w.scale.multiplyScalar(1.3);
    hologramHash.add(w);
  });

  // Diamond ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.55, 4),
    new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
  );
  ring.rotation.z = Math.PI / 4;
  hologramHash.add(ring);

  hologramHash.position.set(0, 2.8, -0.3);
  scene.add(hologramHash);
}

function buildSmallHash() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: TEAL, transparent: true, opacity: 0.5 });
  const vGeo = new THREE.BoxGeometry(0.04, 0.5, 0.01);
  const hGeo = new THREE.BoxGeometry(0.5, 0.04, 0.01);

  [[-0.08, 0], [0.08, 0]].forEach(([x]) => {
    const b = new THREE.Mesh(vGeo, mat); b.position.x = x; g.add(b);
  });
  [[0, 0.08], [0, -0.08]].forEach(([, y]) => {
    const b = new THREE.Mesh(hGeo, mat); b.position.y = y; g.add(b);
  });
  return g;
}

// === COLLISION ===
function clampPlayer() {
  player.x = Math.max(-CORRIDOR_HALF_W + PLAYER_RADIUS, Math.min(CORRIDOR_HALF_W - PLAYER_RADIUS, player.x));
  player.z = Math.max(CORRIDOR_Z_MIN, Math.min(CORRIDOR_Z_MAX, player.z));
  player.y = 1.6;

  // Door collision when gate is mostly closed
  if (gateOpen < 0.85) {
    if (Math.abs(player.z) < 0.5) {
      const opening = gateOpen * 1.2;
      if (Math.abs(player.x) > opening * 0.6 || opening < 0.3) {
        player.z = player.z > 0 ? 0.5 : -0.5;
      }
    }
  }
}

// === GAME LOOP ===
function animate() {
  requestAnimationFrame(animate);
  if (!started) { renderer.render(scene, camera); return; }

  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  // Movement
  const fwdX = Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = Math.sin(player.yaw);

  let mx = 0, mz = 0;
  if (keys['w'] || keys['arrowup']) { mx += fwdX; mz += fwdZ; }
  if (keys['s'] || keys['arrowdown']) { mx -= fwdX; mz -= fwdZ; }
  if (keys['a'] || keys['arrowleft']) { mx -= rightX; mz -= rightZ; }
  if (keys['d'] || keys['arrowright']) { mx += rightX; mz += rightZ; }

  const len = Math.sqrt(mx * mx + mz * mz);
  if (len > 0) {
    mx /= len; mz /= len;
    player.x += mx * SPEED * dt;
    player.z += mz * SPEED * dt;
  }
  clampPlayer();

  // Camera from player
  camera.position.set(player.x, player.y, player.z);
  const lookX = player.x + Math.sin(player.yaw) * Math.cos(player.pitch);
  const lookY = player.y + Math.sin(player.pitch);
  const lookZ = player.z - Math.cos(player.yaw) * Math.cos(player.pitch);
  camera.lookAt(lookX, lookY, lookZ);

  // Head bob
  if (len > 0) {
    camera.position.y += Math.sin(t * 8) * 0.02;
  }

  // Gate animation
  gateOpen += (gateTarget - gateOpen) * dt * 2.5;
  gateOpen = Math.max(0, Math.min(1, gateOpen));

  // Door positions
  leftDoor.position.x = -0.7 - gateOpen * 1.2;
  rightDoor.position.x = 0.7 + gateOpen * 1.2;

  // Star spins when gate moves
  if (star) star.rotation.z = Math.PI / 4 + gateOpen * Math.PI;

  // Hologram animation
  if (hologramHash) {
    hologramHash.rotation.y = Math.sin(t * 0.5) * 0.15;
    hologramHash.position.y = 2.8 + Math.sin(t * 0.8) * 0.05;
    const pulse = 0.5 + Math.sin(t * 2) * 0.2;
    hologramHash.children.forEach(c => {
      if (c.material && c.material.wireframe) c.material.opacity = pulse * 0.4;
    });
  }

  // Floating # symbols beyond gate
  scene.children.forEach(obj => {
    if (obj.userData.floatOffset !== undefined) {
      obj.position.y += Math.sin(t * obj.userData.floatSpeed + obj.userData.floatOffset) * 0.001;
      obj.rotation.y = t * obj.userData.floatSpeed * 0.3;
    }
  });

  // HUD
  gateFillEl.style.width = (gateOpen * 100) + '%';
  if (gateOpen > 0.8) filterStatusEl.textContent = 'OPEN';
  else if (gateOpen > 0.1) filterStatusEl.textContent = 'FILTERING...';
  else filterStatusEl.textContent = 'CLOSED';

  if (player.z < -1) {
    roomNameEl.textContent = 'BEYOND THE GATE';
    roomNameEl.style.color = '#00ffaa';
  } else {
    roomNameEl.textContent = 'CORRIDOR';
    roomNameEl.style.color = '#00d4cc';
  }

  // Contextual messages
  const distGate = Math.sqrt(player.x * player.x + player.z * player.z);
  if (distGate < 3.0 && gateOpen < 0.1 && !shownGateHint) {
    showMsg('Press E to open the sluice gate', 3000);
    shownGateHint = true;
  }
  if (player.z < -2 && !shownBeyond) {
    showMsg('You passed through. The filter accepted you.', 4000);
    shownBeyond = true;
  }
  if (player.z < -10 && !shownDeep) {
    showMsg('The between IS the product. The mistake IS the signal.', 5000);
    shownDeep = true;
  }
  if (Math.abs(player.x) > 2.2 && !shownBooks && player.z > 0) {
    showMsg('Every book is a filter. Every shelf is a sieve.', 3000);
    shownBooks = true;
  }

  renderer.render(scene, camera);
}

init();
animate();