
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');
let rafId = null;

const bg = new RayBG('bg', 'arena', {dim: 0.3, accent: [1, 0.38, 0.63]});

// --- CONSTANTS ---
const TEAL = '#00d2ff';
const PINK = '#ff60a0';
const GOLD = '#ffd700';
const PURPLE = '#b060ff';
const ORANGE = '#ff8c00';
const BG = '#0c0c12';
const FLOOR_PCT = 0.78;
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const BASE_MOVE_SPEED = 4;
const BASE_ATTACK_MIN = 8;
const BASE_ATTACK_MAX = 12;
const BLOCK_REDUCTION = 0.8;
const KNOCKBACK = 8;
const MAX_HP = 100;
const ROUND_TIME = 60;
const ROUNDS_TO_WIN = 2;

let W, H, FLOOR_Y;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  FLOOR_Y = H * FLOOR_PCT;
}
resize();
window.addEventListener('resize', resize);

// =============================================
// CHARACTER ROSTER
// =============================================
const CHARACTER_DATA = [
  {
    id: 'defender',
    name: 'ARMORED DEFENDER',
    bio: "A warrior displaced in time. His armor holds memories of a world before the Trench.",
    color: GOLD,
    stats: { atk: 7, def: 9, spd: 4 },
    spriteFile: '../assets/sprites/armored_defender_sprite_sheet.png',
    drawW: 130, drawH: 170,
    frameConfig: 'defender',
    aiStyle: 'tank',
  },
  {
    id: 'dimmak',
    name: 'DIM MAK FIGHTER',
    bio: "The touch of death, repurposed for protection. She chose to guard, not destroy.",
    color: PINK,
    stats: { atk: 8, def: 5, spd: 9 },
    spriteFile: '../assets/sprites/dim_mak_fighter_full_sheet.png',
    drawW: 110, drawH: 190,
    frameConfig: 'dimmak',
    aiStyle: 'rushdown',
  },
  {
    id: 'mecha',
    name: 'MECHA ENTITY ALPHA',
    bio: "Built in the Cyberpunk Factory. The last creation. Searching for its creator.",
    color: TEAL,
    stats: { atk: 6, def: 7, spd: 6 },
    spriteFile: '../assets/sprites/mecha_entity_alpha_v2_pixel.png',
    drawW: 120, drawH: 180,
    frameConfig: 'mecha',
    aiStyle: 'balanced',
  },
  {
    id: 'kraken',
    name: 'KRAKEN',
    bio: "Ancient. Patient. The ocean remembers everything.",
    color: '#2090ff',
    stats: { atk: 9, def: 8, spd: 3 },
    spriteFile: '../assets/sprites/kraken_game_render.png',
    drawW: 150, drawH: 200,
    frameConfig: 'kraken',
    aiStyle: 'grappler',
  },
  {
    id: 'akuaku',
    name: 'AKU AKU MASK',
    bio: "Not a fighter -- a judge. The planet's memory given form.",
    color: PURPLE,
    stats: { atk: 5, def: 6, spd: 8 },
    spriteFile: '../assets/sprites/aku_aku_mask_stylized.png',
    drawW: 100, drawH: 160,
    frameConfig: 'akuaku',
    aiStyle: 'trickster',
  },
  {
    id: 'cephalon',
    name: 'CEPHALON',
    bio: "From the Kraken Depths, where pressure forges will. They speak in color, fight in ink, and remember the ocean's oldest grudges.",
    color: '#6B2FA0',
    stats: { atk: 6, def: 9, spd: 3 },
    spriteFile: '../assets/sprites/cephalon_sprite_sheet.png',
    drawW: 130, drawH: 190,
    frameConfig: 'cephalon',
    aiStyle: 'grappler',
  },
  {
    id: 'florae',
    name: 'FLORAE',
    bio: "Born when the Terraform tiles bloomed with too much life. The forests whisper through them. They heal, they grow, they reclaim.",
    color: '#2D5A1E',
    stats: { atk: 4, def: 5, spd: 9 },
    spriteFile: '../assets/sprites/florae_sprite_sheet.png',
    drawW: 110, drawH: 180,
    frameConfig: 'florae',
    aiStyle: 'rushdown',
  },
];

// --- SPRITE LOADING ---
const spriteImages = {};
const spriteLoaded = {};

CHARACTER_DATA.forEach(ch => {
  const img = new Image();
  spriteLoaded[ch.id] = false;
  img.onload = () => { spriteLoaded[ch.id] = true; };
  img.onerror = () => { spriteLoaded[ch.id] = false; };
  img.src = ch.spriteFile;
  spriteImages[ch.id] = img;
});

// --- FRAME DEFINITIONS ---
const DEF_COLS = 6;
const DEF_FW = 200;
const DEF_FH = 120;
const DEF_HEADER = 40;

function defFrame(row, col) {
  return { x: col * DEF_FW, y: DEF_HEADER + row * DEF_FH, w: DEF_FW, h: DEF_FH };
}

const FRAME_DEFS = {
  defender: {
    idle: [defFrame(0,0), defFrame(0,1), defFrame(0,2), defFrame(0,3)],
    walk: [defFrame(1,0), defFrame(1,1), defFrame(1,2), defFrame(1,3), defFrame(1,4), defFrame(1,5)],
    attack: [defFrame(2,0), defFrame(2,1), defFrame(2,2), defFrame(2,3), defFrame(2,4), defFrame(2,5)],
  },
  dimmak: {
    idle: [
      { x: 10, y: 100, w: 120, h: 230 },
      { x: 10, y: 100, w: 120, h: 230 },
    ],
    walk: [
      { x: 340, y: 90, w: 130, h: 240 },
      { x: 470, y: 90, w: 120, h: 240 },
    ],
    attack: [
      { x: 130, y: 90, w: 150, h: 240 },
      { x: 280, y: 90, w: 100, h: 240 },
      { x: 130, y: 90, w: 150, h: 240 },
    ],
    crouchIdle: [{ x: 10, y: 570, w: 130, h: 200 }],
    crouchAttack: [
      { x: 140, y: 560, w: 140, h: 210 },
      { x: 280, y: 560, w: 130, h: 210 },
    ],
    crouchWalk: [
      { x: 410, y: 570, w: 120, h: 200 },
      { x: 410, y: 570, w: 120, h: 200 },
    ],
    victory: [{ x: 540, y: 90, w: 140, h: 240 }],
  },
  mecha: {
    idle: [{ x: 0, y: 0, w: 128, h: 128 }, { x: 0, y: 0, w: 128, h: 128 }],
    walk: [{ x: 0, y: 0, w: 128, h: 128 }, { x: 0, y: 0, w: 128, h: 128 }],
    attack: [{ x: 0, y: 0, w: 128, h: 128 }, { x: 0, y: 0, w: 128, h: 128 }],
  },
  kraken: {
    idle: [{ x: 0, y: 0, w: 256, h: 256 }, { x: 0, y: 0, w: 256, h: 256 }],
    walk: [{ x: 0, y: 0, w: 256, h: 256 }, { x: 0, y: 0, w: 256, h: 256 }],
    attack: [{ x: 0, y: 0, w: 256, h: 256 }, { x: 0, y: 0, w: 256, h: 256 }],
  },
  akuaku: {
    idle: [{ x: 0, y: 0, w: 256, h: 256 }, { x: 0, y: 0, w: 256, h: 256 }],
    walk: [{ x: 0, y: 0, w: 256, h: 256 }, { x: 0, y: 0, w: 256, h: 256 }],
    attack: [{ x: 0, y: 0, w: 256, h: 256 }, { x: 0, y: 0, w: 256, h: 256 }],
  },
};

// =============================================
// DIALOGUE SYSTEM
// =============================================
const DIALOGUES = {
  defender: {
    defender: "The mirror shows what armor cannot hide.",
    dimmak: "Speed means nothing against a wall of steel.",
    mecha: "Machine or man -- all fall the same.",
    kraken: "The deep does not frighten me. I've seen worse.",
    akuaku: "Judge me if you will. My blade answers.",
  },
  dimmak: {
    defender: "Your armor has gaps. I'll find them.",
    dimmak: "Only one of us is the real deal.",
    mecha: "Circuits can't predict instinct.",
    kraken: "Big target. Easy pressure points.",
    akuaku: "I don't need your judgment. I judge myself.",
  },
  mecha: {
    defender: "Analyzing... obsolete technology detected.",
    dimmak: "Combat data: high threat. Engaging protocols.",
    mecha: "Error: duplicate entity. Must resolve.",
    kraken: "Organic anomaly. Classification: unknown.",
    akuaku: "Spiritual signature detected. Recalibrating.",
  },
  kraken: {
    defender: "The ocean crushed kingdoms older than yours.",
    dimmak: "You cannot strike what you cannot reach.",
    mecha: "Rust. Everything rusts in the deep.",
    kraken: "There is only one ancient here.",
    akuaku: "Even gods drown.",
  },
  akuaku: {
    defender: "Your armor remembers pain you've forgotten.",
    dimmak: "Death's touch... but who taught you mercy?",
    mecha: "A soul in a shell. How... familiar.",
    kraken: "The ocean forgets nothing. Neither do I.",
    akuaku: "A paradox. The judge, judged.",
  },
};

// =============================================
// BACKGROUNDS
// =============================================
const BIOMES = [
  {
    name: 'UNDERWATER CAVE',
    skyTop: '#0a1628', skyBot: '#0d2847',
    floorTop: '#0a2040', floorBot: '#061020',
    floorLine: '#1a4070',
    particleColor: '#60c0ff',
    particleType: 'bubble',
    props: 'seaweed',
    hasLightRays: true,
    lightRayColor: 'rgba(100,200,255,0.04)',
  },
  {
    name: 'DARK FOREST',
    skyTop: '#0a1a0a', skyBot: '#1a2a10',
    floorTop: '#1a1a0a', floorBot: '#0a0a05',
    floorLine: '#2a3a1a',
    particleColor: '#88aa44',
    particleType: 'leaf',
    props: 'trees',
    hasFog: true,
    fogColor: 'rgba(30,50,20,0.5)',
  },
  {
    name: 'WINTER PEAKS',
    skyTop: '#1a2040', skyBot: '#3a5070',
    floorTop: '#dde8f0', floorBot: '#8090a0',
    floorLine: '#c0d0e0',
    particleColor: '#ffffff',
    particleType: 'snow',
    props: 'mountains',
    hasMoon: true,
  },
  {
    name: 'VOLCANIC',
    skyTop: '#1a0800', skyBot: '#3a1500',
    floorTop: '#2a1000', floorBot: '#1a0800',
    floorLine: '#ff4400',
    particleColor: '#ff6600',
    particleType: 'ember',
    props: 'lava',
    hasGlow: true,
    glowColor: 'rgba(255,80,0,0.15)',
  },
  {
    name: 'CYBERPUNK FACTORY',
    skyTop: '#0a1a1a', skyBot: '#0a2a2a',
    floorTop: '#0a1a1a', floorBot: '#051010',
    floorLine: '#00d2ff',
    particleColor: '#00d2ff',
    particleType: 'spark',
    props: 'grid',
    hasGrid: true,
  },
  {
    name: 'RADIANT VOID',
    skyTop: '#2a1040', skyBot: '#ffffff',
    floorTop: '#e0d0f0', floorBot: '#c0a0e0',
    floorLine: '#d0b0ff',
    particleColor: '#ffffff',
    particleType: 'dust',
    props: 'rays',
    hasGodRays: true,
  },
];

let currentBiome = BIOMES[0];
let bgParticles = [];

function initBgParticles() {
  bgParticles = [];
  for (let i = 0; i < 60; i++) {
    bgParticles.push(newBgParticle(true));
  }
}

function newBgParticle(randomY) {
  const t = currentBiome.particleType;
  let p = {
    x: Math.random() * W,
    y: randomY ? Math.random() * FLOOR_Y : -10,
    size: 2 + Math.random() * 4,
    speed: 0.3 + Math.random() * 1.2,
    drift: (Math.random() - 0.5) * 0.5,
    alpha: 0.3 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  };
  if (t === 'bubble') {
    p.speed = -(0.3 + Math.random() * 0.8); // rise up
    p.y = randomY ? Math.random() * FLOOR_Y : FLOOR_Y;
    p.size = 3 + Math.random() * 6;
  }
  if (t === 'ember') {
    p.speed = -(0.5 + Math.random() * 1.5);
    p.y = randomY ? Math.random() * H : FLOOR_Y + Math.random() * 40;
    p.size = 2 + Math.random() * 3;
  }
  if (t === 'spark') {
    p.speed = (Math.random() - 0.5) * 2;
    p.drift = (Math.random() - 0.5) * 2;
    p.life = 0.5 + Math.random() * 1.5;
    p.maxLife = p.life;
  }
  if (t === 'dust') {
    p.speed = 0.1 + Math.random() * 0.3;
    p.drift = (Math.random() - 0.5) * 0.3;
    p.size = 1 + Math.random() * 3;
  }
  return p;
}

function updateBgParticles(dt) {
  for (let i = bgParticles.length - 1; i >= 0; i--) {
    const p = bgParticles[i];
    const t = currentBiome.particleType;
    p.y += p.speed;
    p.x += p.drift + Math.sin(p.phase + Date.now() * 0.001) * 0.3;
    p.phase += dt;

    if (t === 'spark') {
      p.life -= dt;
      if (p.life <= 0) { bgParticles[i] = newBgParticle(false); continue; }
    }

    // wrap / respawn
    if (p.y > FLOOR_Y + 20 || p.y < -20 || p.x < -20 || p.x > W + 20) {
      bgParticles[i] = newBgParticle(false);
    }
  }
}

function drawBiomeBackground() {
  const b = currentBiome;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  skyGrad.addColorStop(0, b.skyTop);
  skyGrad.addColorStop(1, b.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, FLOOR_Y);

  // Props behind fighters
  drawBiomeProps(b);

  // Light effects
  if (b.hasLightRays) {
    for (let i = 0; i < 5; i++) {
      const lx = W * (0.2 + i * 0.15);
      ctx.fillStyle = b.lightRayColor;
      ctx.beginPath();
      ctx.moveTo(lx - 20, 0);
      ctx.lineTo(lx + 40, FLOOR_Y);
      ctx.lineTo(lx - 60, FLOOR_Y);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (b.hasGodRays) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 0.6 + Math.PI * 0.2;
      ctx.save();
      ctx.globalAlpha = 0.05 + Math.sin(Date.now() * 0.0005 + i) * 0.02;
      ctx.fillStyle = '#ffffff';
      ctx.translate(W / 2, 0);
      ctx.rotate(angle - Math.PI / 2);
      ctx.fillRect(-15, 0, 30, H * 1.5);
      ctx.restore();
    }
  }

  if (b.hasMoon) {
    ctx.fillStyle = '#e0e8ff';
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.12, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.skyTop;
    ctx.beginPath();
    ctx.arc(W * 0.85 + 10, H * 0.12 - 5, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  if (b.hasGlow) {
    const glowGrad = ctx.createRadialGradient(W / 2, FLOOR_Y, 0, W / 2, FLOOR_Y, W * 0.6);
    glowGrad.addColorStop(0, b.glowColor);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, FLOOR_Y - 100, W, 200);
  }

  // Bg particles
  for (const p of bgParticles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = b.particleColor;
    if (b.particleType === 'bubble') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = b.particleColor;
      ctx.lineWidth = 1;
    } else if (b.particleType === 'leaf') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.phase);
      ctx.fillRect(-p.size / 2, -1, p.size, 2);
      ctx.restore();
    } else if (b.particleType === 'spark') {
      const sa = p.life / p.maxLife;
      ctx.globalAlpha = sa * 0.8;
      ctx.fillRect(p.x, p.y, 2, 2);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Floor
  const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  floorGrad.addColorStop(0, b.floorTop);
  floorGrad.addColorStop(1, b.floorBot);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

  // Floor line
  ctx.strokeStyle = b.floorLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, FLOOR_Y);
  ctx.lineTo(W, FLOOR_Y);
  ctx.stroke();

  // Grid overlay on floor
  if (b.hasGrid) {
    ctx.strokeStyle = b.floorLine + '30';
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const lx = (i / 30) * W;
      ctx.beginPath();
      ctx.moveTo(lx, FLOOR_Y);
      ctx.lineTo(lx + (W * 0.05), H);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const ly = FLOOR_Y + ((H - FLOOR_Y) / 6) * i;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(W, ly);
      ctx.stroke();
    }
  }

  // Fog at bottom
  if (b.hasFog) {
    const fogGrad = ctx.createLinearGradient(0, FLOOR_Y - 60, 0, FLOOR_Y + 20);
    fogGrad.addColorStop(0, 'transparent');
    fogGrad.addColorStop(1, b.fogColor);
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, FLOOR_Y - 60, W, 80);
  }

  // Branding watermark
  ctx.fillStyle = '#ffffff06';
  ctx.font = `bold ${Math.floor(W * 0.035)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText('GUINEA PIG TRENCH', W / 2, H * 0.93);
}

function drawBiomeProps(b) {
  ctx.globalAlpha = 0.15;
  if (b.props === 'seaweed') {
    ctx.fillStyle = '#105030';
    for (let i = 0; i < 12; i++) {
      const sx = W * (i / 12) + 20;
      const sh = 40 + Math.random() * 60;
      const sway = Math.sin(Date.now() * 0.001 + i) * 8;
      ctx.beginPath();
      ctx.moveTo(sx, FLOOR_Y);
      ctx.quadraticCurveTo(sx + sway, FLOOR_Y - sh * 0.6, sx + sway * 0.5, FLOOR_Y - sh);
      ctx.quadraticCurveTo(sx + sway + 5, FLOOR_Y - sh * 0.6, sx + 8, FLOOR_Y);
      ctx.fill();
    }
  } else if (b.props === 'trees') {
    ctx.fillStyle = '#0a1a08';
    for (let i = 0; i < 8; i++) {
      const tx = W * (i / 8) + W * 0.03;
      const th = 100 + i * 20;
      // trunk
      ctx.fillRect(tx - 4, FLOOR_Y - th * 0.3, 8, th * 0.3);
      // canopy (triangle)
      ctx.beginPath();
      ctx.moveTo(tx, FLOOR_Y - th);
      ctx.lineTo(tx - 25 - i * 3, FLOOR_Y - th * 0.25);
      ctx.lineTo(tx + 25 + i * 3, FLOOR_Y - th * 0.25);
      ctx.closePath();
      ctx.fill();
    }
  } else if (b.props === 'mountains') {
    ctx.fillStyle = '#4060a0';
    for (let i = 0; i < 5; i++) {
      const mx = W * (i / 5) - W * 0.1;
      const mh = 120 + i * 30;
      ctx.beginPath();
      ctx.moveTo(mx, FLOOR_Y);
      ctx.lineTo(mx + W * 0.1, FLOOR_Y - mh);
      ctx.lineTo(mx + W * 0.25, FLOOR_Y);
      ctx.closePath();
      ctx.fill();
      // snow cap
      ctx.fillStyle = '#ffffff20';
      ctx.beginPath();
      ctx.moveTo(mx + W * 0.1, FLOOR_Y - mh);
      ctx.lineTo(mx + W * 0.07, FLOOR_Y - mh + 25);
      ctx.lineTo(mx + W * 0.13, FLOOR_Y - mh + 25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4060a0';
    }
  } else if (b.props === 'lava') {
    // lava pools at bottom
    ctx.fillStyle = '#ff4400';
    ctx.globalAlpha = 0.1 + Math.sin(Date.now() * 0.002) * 0.05;
    for (let i = 0; i < 4; i++) {
      const lx = W * 0.1 + i * W * 0.25;
      ctx.beginPath();
      ctx.ellipse(lx, FLOOR_Y + 10, 60, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.props === 'grid') {
    // circuit board patterns
    ctx.strokeStyle = TEAL;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 6; i++) {
      const cx = W * (i / 6) + 40;
      const cy = FLOOR_Y * 0.3 + (i % 3) * 80;
      ctx.strokeRect(cx, cy, 40, 30);
      ctx.beginPath();
      ctx.moveTo(cx + 40, cy + 15);
      ctx.lineTo(cx + 70, cy + 15);
      ctx.stroke();
    }
  } else if (b.props === 'rays') {
    // handled by hasGodRays above
  }
  ctx.globalAlpha = 1;
}

// --- INPUT ---
const keys = {};
const justPressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; e.preventDefault(); });
function consumeKey(code) { const v = justPressed[code]; justPressed[code] = false; return v; }

// --- PARTICLES (combat) ---
let particles = [];
function spawnHitParticles(x, y, color, count) {
  count = count || 12;
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10 - 3,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.5,
      r: 2 + Math.random() * 5,
      color,
    });
  }
}

function spawnDustPuff(x, y) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2,
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.4,
      r: 3 + Math.random() * 4,
      color: '#888888',
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// =============================================
// SCREEN SHAKE
// =============================================
let shakeAmount = 0;
let shakeDuration = 0;

function triggerShake(amount, duration) {
  shakeAmount = amount;
  shakeDuration = duration;
}

function applyShake() {
  if (shakeDuration > 0) {
    const sx = (Math.random() - 0.5) * shakeAmount * 2;
    const sy = (Math.random() - 0.5) * shakeAmount * 2;
    ctx.translate(sx, sy);
    return true;
  }
  return false;
}

// =============================================
// SLOW-MO (KO effect)
// =============================================
let slowMoTimer = 0;
let slowMoScale = 1;

// =============================================
// PER-CHARACTER HITBOX DATA
// =============================================
// All offsets are relative to fighter position (x, y where y = feet on ground)
// x/y offsets are from center-bottom, w/h are box dimensions
const HITBOX_DATA = {
  defender: {
    idle:        { xOff: -28, yOff: -155, w: 56, h: 155 },
    walk:        { xOff: -30, yOff: -155, w: 60, h: 155 },
    crouch:      { xOff: -32, yOff: -105, w: 64, h: 105 },
    block:       { xOff: -22, yOff: -145, w: 44, h: 145 }, // tighter when blocking
    attack:      { xOff: -28, yOff: -155, w: 56, h: 155 },
    // Attack reach boxes (relative to facing direction)
    punchReach:  { fwdOff: 20, yOff: -130, w: 65, h: 60 },
    kickReach:   { fwdOff: 15, yOff: -70, w: 60, h: 55 },
  },
  dimmak: {
    idle:        { xOff: -22, yOff: -175, w: 44, h: 175 },
    walk:        { xOff: -24, yOff: -175, w: 48, h: 175 },
    crouch:      { xOff: -26, yOff: -115, w: 52, h: 115 },
    block:       { xOff: -20, yOff: -165, w: 40, h: 165 },
    attack:      { xOff: -22, yOff: -175, w: 44, h: 175 },
    punchReach:  { fwdOff: 18, yOff: -145, w: 72, h: 50 }, // longer reach, fast
    kickReach:   { fwdOff: 20, yOff: -80, w: 68, h: 50 },
  },
  mecha: {
    idle:        { xOff: -26, yOff: -165, w: 52, h: 165 },
    walk:        { xOff: -28, yOff: -165, w: 56, h: 165 },
    crouch:      { xOff: -30, yOff: -110, w: 60, h: 110 },
    block:       { xOff: -24, yOff: -155, w: 48, h: 155 },
    attack:      { xOff: -26, yOff: -165, w: 52, h: 165 },
    punchReach:  { fwdOff: 18, yOff: -135, w: 60, h: 55 },
    kickReach:   { fwdOff: 16, yOff: -75, w: 58, h: 50 },
  },
  kraken: {
    idle:        { xOff: -38, yOff: -190, w: 76, h: 190 }, // biggest character
    walk:        { xOff: -40, yOff: -190, w: 80, h: 190 },
    crouch:      { xOff: -42, yOff: -130, w: 84, h: 130 },
    block:       { xOff: -34, yOff: -180, w: 68, h: 180 },
    attack:      { xOff: -38, yOff: -190, w: 76, h: 190 },
    punchReach:  { fwdOff: 22, yOff: -155, w: 78, h: 70 }, // huge reach
    kickReach:   { fwdOff: 18, yOff: -90, w: 72, h: 65 },
  },
  akuaku: {
    idle:        { xOff: -20, yOff: -145, w: 40, h: 145 }, // smallest body
    walk:        { xOff: -22, yOff: -145, w: 44, h: 145 },
    crouch:      { xOff: -24, yOff: -100, w: 48, h: 100 },
    block:       { xOff: -18, yOff: -135, w: 36, h: 135 },
    attack:      { xOff: -20, yOff: -145, w: 40, h: 145 },
    punchReach:  { fwdOff: 15, yOff: -120, w: 55, h: 45 },
    kickReach:   { fwdOff: 12, yOff: -65, w: 50, h: 45 },
  },
};

// =============================================
// FIGHTER CLASS
// =============================================
class Fighter {
  constructor(charData, x, facingRight, isPlayer1) {
    this.charData = charData;
    this.name = charData.name;
    this.id = charData.id;
    this.color = charData.color;
    this.x = x;
    this.startX = x;
    this.y = FLOOR_Y;
    this.facingRight = facingRight;
    this.isPlayer1 = isPlayer1;
    this.frames = FRAME_DEFS[charData.frameConfig];
    this.spriteImg = spriteImages[charData.id];
    this.stats = charData.stats;
    this.hp = MAX_HP;
    this.vy = 0;
    this.grounded = true;
    this.wasAirborne = false;
    this.state = 'idle';
    this.animFrame = 0;
    this.animTimer = 0;
    this.attackTimer = 0;
    this.hitTimer = 0;
    this.hasHitThisAttack = false;
    this.blocking = false;
    this.crouching = false;
    this.wins = 0;
    this.drawW = charData.drawW;
    this.drawH = charData.drawH;
    this.ai = false;
    this.aiTimer = 0;
    this.aiAction = null;
    this.aiComboCount = 0;
    this.deathTimer = 0;
    this.teleportFlash = 0;
    // derived from stats
    this.moveSpeed = BASE_MOVE_SPEED * (0.6 + charData.stats.spd * 0.06);
    this.atkMin = Math.floor(BASE_ATTACK_MIN * (0.6 + charData.stats.atk * 0.06));
    this.atkMax = Math.floor(BASE_ATTACK_MAX * (0.6 + charData.stats.atk * 0.06));
    this.defMult = 1 - (charData.stats.def * 0.03); // lower = takes less damage from non-block hits
  }

  reset() {
    this.x = this.startX;
    this.y = FLOOR_Y;
    this.hp = MAX_HP;
    this.vy = 0;
    this.grounded = true;
    this.wasAirborne = false;
    this.state = 'idle';
    this.animFrame = 0;
    this.animTimer = 0;
    this.attackTimer = 0;
    this.hitTimer = 0;
    this.hasHitThisAttack = false;
    this.blocking = false;
    this.crouching = false;
    this.deathTimer = 0;
    this.teleportFlash = 0;
    this.aiComboCount = 0;
  }

  getHitbox() {
    const hb = HITBOX_DATA[this.id];
    if (!hb) {
      // Fallback for unknown characters
      return { x: this.x - this.drawW * 0.3, y: this.y - this.drawH, w: this.drawW * 0.6, h: this.drawH };
    }
    // Select hitbox based on current state
    let box;
    if (this.blocking) {
      box = hb.block;
    } else if (this.crouching || this.state === 'crouch' || this.state === 'crouchWalk' || this.state === 'crouchAttack') {
      box = hb.crouch;
    } else if (this.state === 'attack') {
      box = hb.attack;
    } else if (this.state === 'walk') {
      box = hb.walk;
    } else {
      box = hb.idle;
    }
    return {
      x: this.x + box.xOff,
      y: this.y + box.yOff,
      w: box.w,
      h: box.h,
    };
  }

  getAttackBox() {
    const hb = HITBOX_DATA[this.id];
    if (!hb) {
      const range = 55 + this.stats.atk * 3;
      return { x: this.x + (this.facingRight ? this.drawW * 0.15 : -this.drawW * 0.15 - range), y: this.y - this.drawH * 0.7, w: range, h: this.drawH * 0.5 };
    }
    // Use punch reach for standing attacks, kick reach for crouch attacks
    const reach = (this.state === 'crouchAttack') ? hb.kickReach : hb.punchReach;
    const x = this.facingRight
      ? this.x + reach.fwdOff
      : this.x - reach.fwdOff - reach.w;
    return {
      x: x,
      y: this.y + reach.yOff,
      w: reach.w,
      h: reach.h,
    };
  }

  update(dt, opponent) {
    if (this.teleportFlash > 0) this.teleportFlash -= dt;

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0 && this.hp > 0) this.state = 'idle';
    }

    if (this.hp <= 0) {
      this.state = 'dead';
      this.deathTimer += dt;
      return;
    }

    // Gravity
    this.wasAirborne = !this.grounded;
    if (!this.grounded) {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.y >= FLOOR_Y) {
        this.y = FLOOR_Y;
        this.vy = 0;
        this.grounded = true;
        if (this.wasAirborne) {
          spawnDustPuff(this.x, FLOOR_Y);
        }
      }
    }

    // Face opponent
    if (opponent && this.state !== 'attack' && this.state !== 'crouchAttack') {
      this.facingRight = opponent.x > this.x;
    }

    // Attack timer
    if (this.state === 'attack' || this.state === 'crouchAttack') {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.state = this.crouching ? 'crouch' : 'idle';
        this.hasHitThisAttack = false;
      }
    }

    // Animation
    let fps = 5;
    if (this.state === 'walk' || this.state === 'crouchWalk') fps = 8;
    if (this.state === 'attack' || this.state === 'crouchAttack') fps = 12;
    this.animTimer += dt;
    if (this.animTimer >= 1 / fps) {
      this.animTimer -= 1 / fps;
      this.animFrame++;
    }

    const margin = 40;
    if (this.x < margin) this.x = margin;
    if (this.x > W - margin) this.x = W - margin;
  }

  handleInput(left, right, up, down, attack, block) {
    if (this.state === 'dead' || this.state === 'hit') return;
    if (this.state === 'attack' || this.state === 'crouchAttack') return;

    this.blocking = block;
    this.crouching = down;

    if (attack) {
      if (this.crouching) {
        this.state = 'crouchAttack';
      } else {
        this.state = 'attack';
      }
      this.attackTimer = 0.35;
      this.animFrame = 0;
      this.animTimer = 0;
      this.hasHitThisAttack = false;
      this.blocking = false;
      return;
    }

    if (up && this.grounded) {
      this.vy = JUMP_FORCE;
      this.grounded = false;
    }

    if (this.crouching) {
      if (left || right) {
        this.state = 'crouchWalk';
        if (left) this.x -= this.moveSpeed * 0.5;
        if (right) this.x += this.moveSpeed * 0.5;
      } else {
        this.state = 'crouch';
      }
      return;
    }

    if (left || right) {
      this.state = 'walk';
      if (left) this.x -= this.moveSpeed;
      if (right) this.x += this.moveSpeed;
    } else {
      this.state = 'idle';
    }
  }

  aiUpdate(opponent, difficulty) {
    if (this.state === 'dead' || this.state === 'hit') return;
    if (this.state === 'attack' || this.state === 'crouchAttack') return;

    const dist = Math.abs(this.x - opponent.x);
    const hpPct = this.hp / MAX_HP;
    const style = this.charData.aiStyle;

    // difficulty: 0.0 (easy) to 1.0 (hard)
    const reactionTime = 0.35 - difficulty * 0.2; // faster reactions at higher difficulty
    const blockChance = 0.15 + difficulty * 0.25 + (hpPct < 0.3 ? 0.25 : 0);

    this.aiTimer -= 1/60;
    this.blocking = false;
    this.crouching = false;

    if (this.aiTimer > 0) {
      // continue current action
      this._executeAiAction(opponent, style);
      return;
    }

    this.aiTimer = reactionTime + Math.random() * 0.2;

    // Decide new action
    if (dist < 90) {
      const r = Math.random();
      if (r < blockChance) {
        this.aiAction = 'block';
      } else if (style === 'rushdown' && r < blockChance + 0.35) {
        // Dim Mak: quick combo
        this.aiAction = 'combo';
        this.aiComboCount = 2;
      } else if (style === 'grappler' && r < blockChance + 0.4) {
        this.aiAction = 'attack';
      } else if (style === 'trickster' && r < blockChance + 0.3) {
        this.aiAction = 'teleport';
      } else if (r < blockChance + 0.35) {
        this.aiAction = 'attack';
      } else if (r < blockChance + 0.5) {
        this.aiAction = 'crouchAttack';
      } else {
        this.aiAction = 'back';
      }
    } else if (dist < 200) {
      const r = Math.random();
      if (style === 'tank') {
        this.aiAction = r < 0.7 ? 'approach' : 'block';
      } else if (style === 'rushdown') {
        this.aiAction = r < 0.8 ? 'approach' : 'jump';
      } else if (style === 'trickster' && r < 0.3) {
        this.aiAction = 'teleport';
      } else {
        this.aiAction = r < 0.6 ? 'approach' : (r < 0.8 ? 'jump' : 'block');
      }
    } else {
      if (style === 'trickster' && Math.random() < 0.4) {
        this.aiAction = 'teleport';
      } else {
        this.aiAction = 'approach';
      }
    }

    this._executeAiAction(opponent, style);
  }

  _executeAiAction(opponent, style) {
    switch (this.aiAction) {
      case 'approach': {
        const dir = opponent.x > this.x ? 1 : -1;
        let spd = this.moveSpeed * 0.8;
        if (style === 'grappler') spd *= 0.7;
        if (style === 'rushdown') spd *= 1.2;
        this.x += spd * dir;
        this.state = 'walk';
        break;
      }
      case 'back': {
        const dir = opponent.x > this.x ? -1 : 1;
        this.x += this.moveSpeed * 0.6 * dir;
        this.state = 'walk';
        break;
      }
      case 'attack':
        this.state = 'attack';
        this.attackTimer = 0.35;
        this.animFrame = 0;
        this.animTimer = 0;
        this.hasHitThisAttack = false;
        this.aiAction = null;
        break;
      case 'combo':
        // Quick attack then follow up
        this.state = 'attack';
        this.attackTimer = 0.25;
        this.animFrame = 0;
        this.animTimer = 0;
        this.hasHitThisAttack = false;
        this.aiComboCount--;
        if (this.aiComboCount <= 0) this.aiAction = null;
        else this.aiAction = 'attack'; // chain into next
        this.aiTimer = 0.15;
        break;
      case 'crouchAttack':
        this.crouching = true;
        this.state = 'crouchAttack';
        this.attackTimer = 0.35;
        this.animFrame = 0;
        this.animTimer = 0;
        this.hasHitThisAttack = false;
        this.aiAction = null;
        break;
      case 'block':
        this.blocking = true;
        this.state = 'idle';
        break;
      case 'jump':
        if (this.grounded) {
          this.vy = JUMP_FORCE;
          this.grounded = false;
        }
        const dir2 = opponent.x > this.x ? 1 : -1;
        this.x += this.moveSpeed * 0.5 * dir2;
        this.state = 'walk';
        this.aiAction = 'approach';
        break;
      case 'teleport':
        // Aku Aku special: teleport behind opponent
        if (this.id === 'akuaku') {
          const behind = opponent.x > this.x ? opponent.x + 80 : opponent.x - 80;
          this.x = Math.max(40, Math.min(W - 40, behind));
          this.teleportFlash = 0.3;
          spawnHitParticles(this.x, this.y - this.drawH / 2, PURPLE, 8);
        }
        this.aiAction = 'attack';
        this.aiTimer = 0.1;
        break;
      default:
        this.state = 'idle';
    }
  }

  takeDamage(amount, attacker) {
    // Apply defense stat
    amount = Math.ceil(amount * this.defMult);
    const wasBlocking = this.blocking;
    if (this.blocking) {
      amount = Math.floor(amount * (1 - BLOCK_REDUCTION));
    }
    this.hp = Math.max(0, this.hp - amount);
    this.state = 'hit';
    this.hitTimer = 0.15;
    const dir = this.facingRight ? -1 : 1;
    this.x += KNOCKBACK * dir;

    // screen shake on big hits
    if (amount >= 8) {
      triggerShake(amount * 0.5, 0.15);
    }

    // 3D background reactions
    if (wasBlocking) {
      bg.shake(0.15);
    } else {
      bg.pulse(0.4);
    }

    // KO slow-mo
    if (this.hp <= 0) {
      slowMoTimer = 0.5;
      slowMoScale = 0.25;
      triggerShake(12, 0.3);
      bg.pulse(1.0);
      bg.shake(0.5);
    }
  }

  drawShadow() {
    const airH = FLOOR_Y - this.y;
    const shadowScale = Math.max(0.3, 1 - airH / 300);
    ctx.globalAlpha = 0.25 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, FLOOR_Y + 2, this.drawW * 0.35 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  draw() {
    // Shadow first
    this.drawShadow();

    const sprOk = spriteLoaded[this.id];
    const img = this.spriteImg;
    const framesMap = this.frames;

    let frameKey = 'idle';
    if (this.state === 'walk') frameKey = 'walk';
    else if (this.state === 'attack') frameKey = 'attack';
    else if (this.state === 'crouch') frameKey = 'crouchIdle';
    else if (this.state === 'crouchAttack') frameKey = 'crouchAttack';
    else if (this.state === 'crouchWalk') frameKey = 'crouchWalk';

    // Fallback if no crouch frames
    if (!framesMap[frameKey]) {
      if (frameKey === 'crouchIdle' || frameKey === 'crouchWalk') frameKey = 'idle';
      if (frameKey === 'crouchAttack') frameKey = 'attack';
    }

    const frameArr = framesMap[frameKey] || framesMap['idle'];
    const fi = this.animFrame % frameArr.length;
    const frame = frameArr[fi];

    ctx.save();

    // Death animation
    if (this.state === 'dead') {
      const t = Math.min(this.deathTimer / 0.6, 1);
      ctx.translate(this.x, this.y);
      ctx.rotate(t * (this.facingRight ? 1 : -1) * 0.3);
      ctx.scale(1, 1 - t * 0.7);
      ctx.translate(-this.x, -this.y);
      ctx.globalAlpha = 1 - t * 0.3;
    }

    // Hit flash
    if (this.state === 'hit') {
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.05) * 0.4;
    }

    // Block visual
    if (this.blocking) {
      ctx.globalAlpha = 0.7;
    }

    // Teleport flash
    if (this.teleportFlash > 0) {
      ctx.globalAlpha = 0.5 + this.teleportFlash;
    }

    const dw = this.drawW;
    const dh = this.drawH;
    const dx = this.x - dw / 2;
    const dy = this.y - dh;

    if (sprOk && frame) {
      ctx.save();
      if (!this.facingRight) {
        ctx.translate(this.x, 0);
        ctx.scale(-1, 1);
        ctx.translate(-this.x, 0);
      }
      ctx.drawImage(img, frame.x, frame.y, frame.w, frame.h, dx, dy, dw, dh);
      ctx.restore();
    } else {
      // Procedural placeholder based on character
      drawPlaceholder(this, dx, dy, dw, dh);
    }

    // Block shield indicator
    if (this.blocking) {
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 3;
      const shieldX = this.facingRight ? this.x + 25 : this.x - 25;
      ctx.beginPath();
      ctx.arc(shieldX, this.y - dh * 0.5, 28, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.strokeStyle = this.color + '44';
      ctx.arc(shieldX, this.y - dh * 0.5, 32, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }

    // Hit flash overlay
    if (this.state === 'hit') {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(dx, dy, dw, dh);
    }

    ctx.restore();
  }
}

// Placeholder character drawings
function drawPlaceholder(fighter, dx, dy, dw, dh) {
  const cx = fighter.x;
  const cy = fighter.y;
  ctx.fillStyle = fighter.color;

  switch (fighter.id) {
    case 'defender':
      // Knight shape
      ctx.fillRect(dx + dw*0.2, dy + dh*0.1, dw*0.6, dh*0.3); // helmet
      ctx.fillRect(dx + dw*0.15, dy + dh*0.4, dw*0.7, dh*0.45); // body
      ctx.fillRect(dx + dw*0.05, dy + dh*0.5, dw*0.15, dh*0.3); // shield
      ctx.fillStyle = '#aaa';
      ctx.fillRect(dx + dw*0.75, dy + dh*0.3, dw*0.08, dh*0.5); // sword
      break;
    case 'dimmak':
      // Martial artist
      ctx.beginPath();
      ctx.arc(cx, dy + dh*0.15, dw*0.2, 0, Math.PI*2);
      ctx.fill();
      ctx.fillRect(dx + dw*0.3, dy + dh*0.3, dw*0.4, dh*0.45);
      ctx.fillRect(dx + dw*0.15, dy + dh*0.75, dw*0.25, dh*0.25);
      ctx.fillRect(dx + dw*0.6, dy + dh*0.75, dw*0.25, dh*0.25);
      break;
    case 'mecha':
      // Robot
      ctx.fillRect(dx + dw*0.25, dy + dh*0.05, dw*0.5, dh*0.25);
      ctx.fillStyle = '#0a2a2a';
      ctx.fillRect(dx + dw*0.3, dy + dh*0.1, dw*0.15, dh*0.08);
      ctx.fillRect(dx + dw*0.55, dy + dh*0.1, dw*0.15, dh*0.08);
      ctx.fillStyle = fighter.color;
      ctx.fillRect(dx + dw*0.15, dy + dh*0.3, dw*0.7, dh*0.5);
      ctx.fillRect(dx + dw*0.25, dy + dh*0.8, dw*0.2, dh*0.2);
      ctx.fillRect(dx + dw*0.55, dy + dh*0.8, dw*0.2, dh*0.2);
      break;
    case 'kraken':
      // Tentacle monster
      ctx.beginPath();
      ctx.arc(cx, dy + dh*0.3, dw*0.35, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#103060';
      ctx.beginPath();
      ctx.arc(cx - dw*0.12, dy + dh*0.25, dw*0.08, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + dw*0.12, dy + dh*0.25, dw*0.08, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = fighter.color;
      for (let t = 0; t < 5; t++) {
        const tx = dx + dw*(0.1 + t*0.2);
        const sway = Math.sin(Date.now()*0.003 + t) * 5;
        ctx.fillRect(tx + sway, dy + dh*0.55, dw*0.08, dh*0.45);
      }
      break;
    case 'akuaku':
      // Floating mask
      const bob = Math.sin(Date.now() * 0.004) * 8;
      ctx.save();
      ctx.translate(0, bob);
      // mask face
      ctx.beginPath();
      ctx.ellipse(cx, dy + dh*0.4, dw*0.35, dh*0.35, 0, 0, Math.PI*2);
      ctx.fill();
      // eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(cx - dw*0.12, dy + dh*0.35, dw*0.08, dh*0.06, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + dw*0.12, dy + dh*0.35, dw*0.08, dh*0.06, 0, 0, Math.PI*2);
      ctx.fill();
      // feathers
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(cx - 5, dy + dh*0.05, 4, dh*0.2);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(cx + 3, dy + dh*0.03, 4, dh*0.22);
      ctx.restore();
      break;
    default:
      ctx.fillRect(dx, dy, dw, dh);
  }

  // Name label
  ctx.fillStyle = '#fff';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(fighter.name, cx, dy - 4);
}

// =============================================
// GAME STATE
// =============================================
let gameState = 'title';
let player1, player2;
let vsAI = false;
// MODE 1: CREATIVE (training) — no HP drain, practice moves
// MODE 2: SURVIVAL (fight) — full combat
let brawlMode = 'SURVIVAL';
let roundNum = 1;
let roundTimer = ROUND_TIME;
let countdownTimer = 0;
let announceTimer = 0;
let announceText = '';
let matchWinner = null;

// Character select state
let p1SelectIndex = 0;
let p2SelectIndex = 1;
let selectPhase = 'p1'; // 'p1', 'p2', 'ready'
let selectReadyTimer = 0;

// Dialogue state
let dialogueState = null; // { p1Line, p2Line, timer }

function createFighters() {
  const p1Data = CHARACTER_DATA[p1SelectIndex];
  const p2Data = CHARACTER_DATA[p2SelectIndex];
  player1 = new Fighter(p1Data, W * 0.3, true, true);
  player2 = new Fighter(p2Data, W * 0.7, false, false);
}

function startRound() {
  FLOOR_Y = H * FLOOR_PCT;
  player1.startX = W * 0.3;
  player2.startX = W * 0.7;
  player1.reset();
  player2.reset();
  roundTimer = ROUND_TIME;
  particles = [];
  slowMoTimer = 0;
  slowMoScale = 1;
  shakeAmount = 0;
  shakeDuration = 0;

  // Pick random biome
  currentBiome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
  initBgParticles();

  // Show dialogue intro first
  const p1Line = DIALOGUES[player1.id]?.[player2.id] || "...";
  const p2Line = DIALOGUES[player2.id]?.[player1.id] || "...";
  dialogueState = { p1Line, p2Line, timer: 3.5 };
  gameState = 'dialogue';
}

function startMatch() {
  roundNum = 1;
  createFighters();
  player1.wins = 0;
  player2.wins = 0;
  matchWinner = null;
  startRound();
}

// --- COLLISION ---
function boxOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function checkAttack(attacker, defender) {
  if ((attacker.state !== 'attack' && attacker.state !== 'crouchAttack') || attacker.hasHitThisAttack) return;
  const frameArr = attacker.frames.attack || attacker.frames.idle;
  const fi = attacker.animFrame % frameArr.length;
  if (fi < 1) return;

  const aBox = attacker.getAttackBox();
  const dBox = defender.getHitbox();

  if (boxOverlap(aBox, dBox)) {
    const dmg = attacker.atkMin + Math.floor(Math.random() * (attacker.atkMax - attacker.atkMin + 1));
    defender.takeDamage(dmg, attacker);
    attacker.hasHitThisAttack = true;
    const hitX = (aBox.x + aBox.w / 2 + dBox.x + dBox.w / 2) / 2;
    const hitY = (aBox.y + aBox.h / 2);
    spawnHitParticles(hitX, hitY, defender.blocking ? '#ffffff' : attacker.color, dmg > 10 ? 18 : 12);
  }
}

// =============================================
// HUD DRAWING
// =============================================
function drawHPBar(fighter, x, barW, isLeft) {
  const barH = 22;
  const y = 38;
  const hpPct = Math.max(0, fighter.hp / MAX_HP);
  const color = fighter.color;

  // Portrait icon (small colored box with initial)
  const iconSize = 32;
  const iconX = isLeft ? x - iconSize - 6 : x + barW + 6;
  ctx.fillStyle = color + '40';
  ctx.fillRect(iconX, y - 5, iconSize, iconSize);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(iconX, y - 5, iconSize, iconSize);

  // Draw mini sprite in portrait
  const chId = fighter.id;
  if (spriteLoaded[chId]) {
    const f = FRAME_DEFS[fighter.charData.frameConfig].idle[0];
    ctx.drawImage(spriteImages[chId], f.x, f.y, f.w, f.h, iconX + 2, y - 3, iconSize - 4, iconSize - 4);
  } else {
    ctx.fillStyle = color;
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(fighter.name[0], iconX + iconSize/2, y + 16);
  }

  // Name
  ctx.fillStyle = color;
  ctx.font = 'bold 13px Courier New';
  ctx.textAlign = isLeft ? 'left' : 'right';
  ctx.fillText(fighter.name, x + (isLeft ? 0 : barW), y - 8);

  // Bar bg
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, barW, barH);

  // HP fill
  const hpColor = hpPct > 0.5 ? color : hpPct > 0.25 ? '#ffaa00' : '#ff3333';
  if (isLeft) {
    ctx.fillStyle = hpColor;
    ctx.fillRect(x, y, barW * hpPct, barH);
  } else {
    ctx.fillStyle = hpColor;
    ctx.fillRect(x + barW * (1 - hpPct), y, barW * hpPct, barH);
  }

  // Bar segments
  ctx.strokeStyle = '#0c0c12';
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(x + barW * (i/10), y);
    ctx.lineTo(x + barW * (i/10), y + barH);
    ctx.stroke();
  }

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, barW, barH);

  // HP number
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(fighter.hp), x + barW / 2, y + 16);
}

function drawTimer() {
  const t = Math.max(0, Math.ceil(roundTimer));
  // Timer background circle
  ctx.fillStyle = '#0c0c1280';
  ctx.beginPath();
  ctx.arc(W / 2, 48, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = t <= 10 ? '#ff4444' : '#444';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = t <= 10 ? '#ff4444' : '#ffffff';
  ctx.font = 'bold 24px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(t, W / 2, 56);
}

function drawRoundIndicators() {
  const y = 78;
  const gap = 16;
  for (let i = 0; i < ROUNDS_TO_WIN; i++) {
    ctx.fillStyle = i < player1.wins ? player1.color : '#333';
    ctx.beginPath();
    ctx.arc(W / 2 - 50 - i * gap, y, 6, 0, Math.PI * 2);
    ctx.fill();
    if (i < player1.wins) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  for (let i = 0; i < ROUNDS_TO_WIN; i++) {
    ctx.fillStyle = i < player2.wins ? player2.color : '#333';
    ctx.beginPath();
    ctx.arc(W / 2 + 50 + i * gap, y, 6, 0, Math.PI * 2);
    ctx.fill();
    if (i < player2.wins) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawHUD() {
  const barW = W * 0.32;
  const margin = 55;
  drawHPBar(player1, margin, barW, true);
  drawHPBar(player2, W - margin - barW, barW, false);
  drawTimer();
  drawRoundIndicators();

  // Round label
  ctx.fillStyle = '#666';
  ctx.font = '10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText('ROUND ' + roundNum, W / 2, 88);
}

function drawAnnouncement(text, subtext) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, H * 0.35, W, H * 0.3);

  // Border lines
  ctx.strokeStyle = TEAL + '40';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.35);
  ctx.lineTo(W, H * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, H * 0.65);
  ctx.lineTo(W, H * 0.65);
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(W * 0.055)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H * 0.48);

  if (subtext) {
    ctx.fillStyle = '#aaa';
    ctx.font = `${Math.floor(W * 0.022)}px Courier New`;
    ctx.fillText(subtext, W / 2, H * 0.56);
  }
}

// =============================================
// TITLE SCREEN
// =============================================
function drawTitleScreen() {
  // Dark bg with subtle animation
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Animated background lines
  ctx.strokeStyle = '#ffffff06';
  ctx.lineWidth = 1;
  const t = Date.now() * 0.0003;
  for (let i = 0; i < 15; i++) {
    ctx.beginPath();
    const ly = H * (i / 15) + Math.sin(t + i) * 20;
    ctx.moveTo(0, ly);
    ctx.lineTo(W, ly + Math.sin(t + i * 0.5) * 30);
    ctx.stroke();
  }

  // Title
  ctx.fillStyle = TEAL;
  ctx.font = `bold ${Math.floor(W * 0.08)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText('TRENCH', W / 2, H * 0.25);
  ctx.fillStyle = PINK;
  ctx.fillText('BRAWLER', W / 2, H * 0.37);

  // Subtitle
  ctx.fillStyle = '#555';
  ctx.font = `${Math.floor(W * 0.016)}px Courier New`;
  ctx.fillText('A GUINEA PIG TRENCH PRODUCTION', W / 2, H * 0.43);

  // Character lineup preview
  const totalW = CHARACTER_DATA.length * 110;
  const startX = (W - totalW) / 2;
  for (let i = 0; i < CHARACTER_DATA.length; i++) {
    const ch = CHARACTER_DATA[i];
    const cx = startX + i * 110 + 55;
    const cy = H * 0.62;
    const bob = Math.sin(Date.now() * 0.002 + i * 1.2) * 4;

    ctx.globalAlpha = 0.7;
    if (spriteLoaded[ch.id]) {
      const f = FRAME_DEFS[ch.frameConfig].idle[0];
      ctx.drawImage(spriteImages[ch.id], f.x, f.y, f.w, f.h, cx - 40, cy - 70 + bob, 80, 100);
    } else {
      ctx.fillStyle = ch.color;
      ctx.fillRect(cx - 25, cy - 50 + bob, 50, 70);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = ch.color;
    ctx.font = '9px Courier New';
    ctx.fillText(ch.name.split(' ')[0], cx, cy + 45);
  }

  // Prompt
  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(W * 0.022)}px Courier New`;
    ctx.fillText('PRESS ENTER', W / 2, H * 0.88);
  }
  ctx.fillStyle = '#444';
  ctx.font = '12px Courier New';
  ctx.fillText('ENTER = 2 PLAYERS  |  SPACE = VS AI', W / 2, H * 0.93);
}

// =============================================
// CHARACTER SELECT SCREEN
// =============================================
function drawStatBar(x, y, w, h, value, maxVal, color) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * (value / maxVal), h);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawCharacterSelectScreen() {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = TEAL;
  ctx.font = `bold ${Math.floor(W * 0.03)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText('CHARACTER SELECT', W / 2, H * 0.07);

  // Phase indicator
  const phaseText = selectPhase === 'p1' ? (vsAI ? 'CHOOSE YOUR FIGHTER' : 'PLAYER 1 -- CHOOSE (LEFT/RIGHT + ENTER)') :
                    selectPhase === 'p2' ? 'PLAYER 2 -- CHOOSE (LEFT/RIGHT + ENTER)' : 'GET READY...';
  ctx.fillStyle = selectPhase === 'p1' ? TEAL : selectPhase === 'p2' ? PINK : '#fff';
  ctx.font = `bold ${Math.floor(W * 0.016)}px Courier New`;
  ctx.fillText(phaseText, W / 2, H * 0.12);

  // Character roster - horizontal layout
  const cardW = Math.min(160, (W - 80) / CHARACTER_DATA.length - 10);
  const cardH = H * 0.5;
  const totalCardsW = CHARACTER_DATA.length * (cardW + 10) - 10;
  const cardsStartX = (W - totalCardsW) / 2;

  for (let i = 0; i < CHARACTER_DATA.length; i++) {
    const ch = CHARACTER_DATA[i];
    const cx = cardsStartX + i * (cardW + 10);
    const cy = H * 0.16;
    const isP1Selected = i === p1SelectIndex;
    const isP2Selected = i === p2SelectIndex && (selectPhase === 'p2' || selectPhase === 'ready');
    const isCurrentPick = (selectPhase === 'p1' && i === p1SelectIndex) ||
                          (selectPhase === 'p2' && i === p2SelectIndex);

    // Card background
    ctx.fillStyle = isCurrentPick ? '#1a1a30' : '#0e0e18';
    ctx.fillRect(cx, cy, cardW, cardH);

    // Selection borders
    if (isP1Selected && (selectPhase !== 'p1' || true)) {
      ctx.strokeStyle = TEAL;
      ctx.lineWidth = isCurrentPick && selectPhase === 'p1' ? 3 : 2;
      ctx.strokeRect(cx - 1, cy - 1, cardW + 2, cardH + 2);
      if (selectPhase !== 'p1') {
        ctx.fillStyle = TEAL;
        ctx.font = 'bold 10px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('P1', cx + cardW / 2, cy - 4);
      }
    }
    if (isP2Selected) {
      ctx.strokeStyle = PINK;
      ctx.lineWidth = isCurrentPick && selectPhase === 'p2' ? 3 : 2;
      ctx.strokeRect(cx - 2, cy - 2, cardW + 4, cardH + 4);
      ctx.fillStyle = PINK;
      ctx.font = 'bold 10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('P2', cx + cardW / 2, cy - 4);
    }

    // Current pick cursor glow
    if (isCurrentPick) {
      const glowColor = selectPhase === 'p1' ? TEAL : PINK;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10 + Math.sin(Date.now() * 0.005) * 5;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);
      ctx.shadowBlur = 0;
    }

    // Sprite preview
    const spriteArea = cardW - 20;
    const spriteH = spriteArea * 1.2;
    const spriteX = cx + 10;
    const spriteY = cy + 10;

    if (spriteLoaded[ch.id]) {
      const f = FRAME_DEFS[ch.frameConfig].idle[0];
      const bob = isCurrentPick ? Math.sin(Date.now() * 0.004) * 3 : 0;
      ctx.drawImage(spriteImages[ch.id], f.x, f.y, f.w, f.h, spriteX, spriteY + bob, spriteArea, spriteH);
    } else {
      ctx.fillStyle = ch.color + '30';
      ctx.fillRect(spriteX, spriteY, spriteArea, spriteH);
      // Draw mini placeholder
      ctx.fillStyle = ch.color;
      ctx.font = 'bold 24px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('?', cx + cardW / 2, spriteY + spriteH / 2 + 8);
    }

    // Name
    ctx.fillStyle = ch.color;
    ctx.font = `bold ${Math.min(11, cardW * 0.08)}px Courier New`;
    ctx.textAlign = 'center';
    const nameY = spriteY + spriteH + 14;
    ctx.fillText(ch.name, cx + cardW / 2, nameY);

    // Stats bars (only show for current pick)
    if (isCurrentPick || (cardW > 100)) {
      const statY = nameY + 8;
      const statW = cardW - 20;
      const statH = 6;
      const statX = cx + 10;

      ctx.fillStyle = '#888';
      ctx.font = '8px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText('ATK', statX, statY + 7);
      drawStatBar(statX + 22, statY + 1, statW - 22, statH, ch.stats.atk, 10, '#ff4444');

      ctx.fillStyle = '#888';
      ctx.fillText('DEF', statX, statY + 17);
      drawStatBar(statX + 22, statY + 11, statW - 22, statH, ch.stats.def, 10, '#4488ff');

      ctx.fillStyle = '#888';
      ctx.fillText('SPD', statX, statY + 27);
      drawStatBar(statX + 22, statY + 21, statW - 22, statH, ch.stats.spd, 10, '#44ff88');
    }
  }

  // Bio text for currently highlighted character
  const currentIdx = selectPhase === 'p1' ? p1SelectIndex : p2SelectIndex;
  const currentCh = CHARACTER_DATA[currentIdx];
  ctx.fillStyle = '#888';
  ctx.font = `italic ${Math.floor(W * 0.012)}px Courier New`;
  ctx.textAlign = 'center';
  const bioY = H * 0.16 + cardH + 30;
  ctx.fillText('"' + currentCh.bio + '"', W / 2, bioY);

  // Controls reminder
  ctx.fillStyle = '#444';
  ctx.font = '11px Courier New';
  ctx.textAlign = 'center';
  const ctrlY = H * 0.94;
  if (selectPhase === 'p1') {
    ctx.fillText('LEFT / RIGHT to browse  |  ENTER to confirm  |  ESC for title', W / 2, ctrlY);
  } else if (selectPhase === 'p2') {
    ctx.fillText('LEFT / RIGHT to browse  |  ENTER to confirm', W / 2, ctrlY);
  }

  // P1 controls: WASD+F+G  |  P2 controls: Arrows+L+K
  ctx.fillStyle = '#333';
  ctx.font = '10px Courier New';
  ctx.fillText('P1: WASD + F atk + G blk  |  P2: Arrows + L atk + K blk', W / 2, ctrlY + 14);
}

// =============================================
// DIALOGUE SCREEN
// =============================================
function drawDialogueScreen() {
  drawBiomeBackground();
  updateBgParticles(1/60);

  // Draw fighters in ready position
  player1.draw();
  player2.draw();

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, H * 0.25, W, H * 0.5);

  // Round header
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(W * 0.04)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText(`ROUND ${roundNum}`, W / 2, H * 0.33);

  // VS text
  ctx.fillStyle = '#666';
  ctx.font = `bold ${Math.floor(W * 0.02)}px Courier New`;
  ctx.fillText(`${player1.name}  VS  ${player2.name}`, W / 2, H * 0.39);

  // Biome name
  ctx.fillStyle = '#555';
  ctx.font = `${Math.floor(W * 0.012)}px Courier New`;
  ctx.fillText(currentBiome.name, W / 2, H * 0.43);

  if (dialogueState) {
    // P1 dialogue
    ctx.fillStyle = player1.color;
    ctx.font = `bold 13px Courier New`;
    ctx.textAlign = 'left';
    ctx.fillText(player1.name + ':', W * 0.1, H * 0.52);
    ctx.fillStyle = '#ccc';
    ctx.font = `italic 12px Courier New`;
    ctx.fillText('"' + dialogueState.p1Line + '"', W * 0.1, H * 0.56);

    // P2 dialogue
    ctx.fillStyle = player2.color;
    ctx.font = `bold 13px Courier New`;
    ctx.textAlign = 'right';
    ctx.fillText(player2.name + ':', W * 0.9, H * 0.64);
    ctx.fillStyle = '#ccc';
    ctx.font = `italic 12px Courier New`;
    ctx.fillText('"' + dialogueState.p2Line + '"', W * 0.9, H * 0.68);
  }

  // Skip prompt
  const blink = Math.sin(Date.now() * 0.006) > 0;
  if (blink) {
    ctx.fillStyle = '#666';
    ctx.font = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS ENTER TO SKIP', W / 2, H * 0.74);
  }
}

// =============================================
// MATCH END SCREEN
// =============================================
function drawMatchEnd() {
  drawBiomeBackground();
  updateBgParticles(1/60);

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);

  const winner = matchWinner;
  const loser = winner === player1 ? player2 : player1;

  // Loser on ground
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.translate(loser.x, FLOOR_Y);
  ctx.rotate(Math.PI / 2 * (loser.facingRight ? 1 : -1));
  ctx.translate(-loser.x, -FLOOR_Y);
  const lf = FRAME_DEFS[loser.charData.frameConfig].idle[0];
  if (spriteLoaded[loser.id]) {
    ctx.drawImage(spriteImages[loser.id], lf.x, lf.y, lf.w, lf.h,
      loser.x - loser.drawW/2, FLOOR_Y - loser.drawH, loser.drawW, loser.drawH);
  } else {
    ctx.fillStyle = loser.color;
    ctx.fillRect(loser.x - loser.drawW/2, FLOOR_Y - loser.drawH, loser.drawW, loser.drawH);
  }
  ctx.restore();

  // Winner in victory pose (bobbing idle)
  const bob = Math.sin(Date.now() * 0.003) * 5;
  const wf = FRAME_DEFS[winner.charData.frameConfig].idle[0];
  if (spriteLoaded[winner.id]) {
    ctx.drawImage(spriteImages[winner.id], wf.x, wf.y, wf.w, wf.h,
      W / 2 - 100, H * 0.35 + bob, 200, 300);
  } else {
    ctx.fillStyle = winner.color;
    ctx.fillRect(W / 2 - 80, H * 0.35 + bob, 160, 250);
  }

  // Victory text
  ctx.fillStyle = winner.color;
  ctx.font = `bold ${Math.floor(W * 0.065)}px Courier New`;
  ctx.textAlign = 'center';
  ctx.fillText('VICTORY', W / 2, H * 0.18);

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(W * 0.028)}px Courier New`;
  ctx.fillText(winner.name, W / 2, H * 0.25);

  // Score
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Courier New';
  ctx.fillText(`${player1.wins} - ${player2.wins}`, W / 2, H * 0.88);

  ctx.fillStyle = player1.color;
  ctx.font = '12px Courier New';
  ctx.textAlign = 'right';
  ctx.fillText(player1.name, W / 2 - 50, H * 0.88);
  ctx.fillStyle = player2.color;
  ctx.textAlign = 'left';
  ctx.fillText(player2.name, W / 2 + 50, H * 0.88);

  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('PRESS ENTER FOR REMATCH', W / 2, H * 0.95);
  }
}

// =============================================
// MAIN GAME LOOP
// =============================================
let lastTime = 0;

function gameLoop(time) {
  const rawDt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  // Slow-mo effect
  let dt = rawDt;
  if (slowMoTimer > 0) {
    slowMoTimer -= rawDt;
    dt = rawDt * slowMoScale;
    if (slowMoTimer <= 0) slowMoScale = 1;
  }

  // Shake decay
  if (shakeDuration > 0) {
    shakeDuration -= rawDt;
    if (shakeDuration <= 0) { shakeAmount = 0; }
  }

  // Render raymarched 3D background
  bg.render(performance.now());

  // Clear justPressed at end of frame (consumed by consumeKey)
  // Actually clear at start so each frame gets fresh presses
  // We clear at end of frame below

  switch (gameState) {
    case 'title':
      drawTitleScreen();
      if (consumeKey('Enter')) {
        vsAI = false;
        p1SelectIndex = 0;
        p2SelectIndex = 1;
        selectPhase = 'p1';
        gameState = 'select';
      }
      if (consumeKey('Space')) {
        vsAI = true;
        p1SelectIndex = 0;
        p2SelectIndex = 1;
        selectPhase = 'p1';
        gameState = 'select';
      }
      break;

    case 'select':
      drawCharacterSelectScreen();
      if (selectPhase === 'p1') {
        if (consumeKey('ArrowLeft') || consumeKey('KeyA')) {
          p1SelectIndex = (p1SelectIndex - 1 + CHARACTER_DATA.length) % CHARACTER_DATA.length;
        }
        if (consumeKey('ArrowRight') || consumeKey('KeyD')) {
          p1SelectIndex = (p1SelectIndex + 1) % CHARACTER_DATA.length;
        }
        if (consumeKey('Enter') || consumeKey('KeyF')) {
          if (vsAI) {
            // AI picks random different character
            do {
              p2SelectIndex = Math.floor(Math.random() * CHARACTER_DATA.length);
            } while (p2SelectIndex === p1SelectIndex && CHARACTER_DATA.length > 1);
            selectPhase = 'ready';
            selectReadyTimer = 1.0;
          } else {
            selectPhase = 'p2';
            // Start P2 on a different character
            if (p2SelectIndex === p1SelectIndex) {
              p2SelectIndex = (p1SelectIndex + 1) % CHARACTER_DATA.length;
            }
          }
        }
        if (consumeKey('Escape')) {
          gameState = 'title';
        }
      } else if (selectPhase === 'p2') {
        if (consumeKey('ArrowLeft')) {
          p2SelectIndex = (p2SelectIndex - 1 + CHARACTER_DATA.length) % CHARACTER_DATA.length;
        }
        if (consumeKey('ArrowRight')) {
          p2SelectIndex = (p2SelectIndex + 1) % CHARACTER_DATA.length;
        }
        if (consumeKey('Enter') || consumeKey('KeyL')) {
          selectPhase = 'ready';
          selectReadyTimer = 1.0;
        }
      } else if (selectPhase === 'ready') {
        selectReadyTimer -= rawDt;
        if (selectReadyTimer <= 0) {
          startMatch();
          if (vsAI) player2.ai = true;
        }
      }
      break;

    case 'dialogue':
      drawDialogueScreen();
      if (dialogueState) {
        dialogueState.timer -= rawDt;
        if (dialogueState.timer <= 0 || consumeKey('Enter') || consumeKey('Space')) {
          dialogueState = null;
          gameState = 'countdown';
          countdownTimer = 2.0;
        }
      }
      break;

    case 'countdown':
      ctx.save();
      applyShake();
      drawBiomeBackground();
      updateBgParticles(dt);
      player1.draw();
      player2.draw();
      drawHUD();
      ctx.restore();

      countdownTimer -= rawDt;
      if (countdownTimer > 1.0) {
        drawAnnouncement('ROUND ' + roundNum);
      } else if (countdownTimer > 0) {
        drawAnnouncement('FIGHT!');
      } else {
        gameState = 'fight';
      }
      break;

    case 'fight': {
      // Input
      if (player1.state !== 'dead') {
        player1.handleInput(
          keys['KeyA'], keys['KeyD'], keys['KeyW'], keys['KeyS'],
          consumeKey('KeyF'), keys['KeyG']
        );
      }

      if (player2.ai) {
        // AI difficulty scales: round 1 = easy, round 2 = medium, round 3 = hard
        const aiDiff = Math.min(1, (roundNum - 1) * 0.35 + 0.15);
        player2.aiUpdate(player1, aiDiff);
      } else if (player2.state !== 'dead') {
        player2.handleInput(
          keys['ArrowLeft'], keys['ArrowRight'], keys['ArrowUp'], keys['ArrowDown'],
          consumeKey('KeyL'), keys['KeyK']
        );
      }

      // Update
      player1.update(dt, player2);
      player2.update(dt, player1);
      updateParticles(dt);
      updateBgParticles(dt);

      // Attack checks
      checkAttack(player1, player2);
      checkAttack(player2, player1);

      // Timer
      roundTimer -= dt;

      // Round end check
      let roundWinner = null;
      if (player1.hp <= 0) {
        roundWinner = player2;
      } else if (player2.hp <= 0) {
        roundWinner = player1;
      } else if (roundTimer <= 0) {
        roundWinner = player1.hp >= player2.hp ? player1 : player2;
      }

      if (roundWinner && gameState === 'fight') {
        roundWinner.wins++;
        announceText = roundWinner === player1 ? player1.name + ' WINS' : player2.name + ' WINS';
        announceTimer = 2.5;
        gameState = 'roundEnd';
      }

      // Draw
      ctx.save();
      applyShake();
      drawBiomeBackground();
      player1.draw();
      player2.draw();
      drawParticles();
      drawHUD();
      ctx.restore();

      if (announceTimer > 0) {
        announceTimer -= dt;
        drawAnnouncement(announceText);
      }
      break;
    }

    case 'roundEnd':
      ctx.save();
      applyShake();
      drawBiomeBackground();
      updateBgParticles(dt);
      player1.draw();
      player2.draw();
      drawParticles();
      drawHUD();
      ctx.restore();

      announceTimer -= rawDt;
      if (announceTimer > 0.5) {
        const sub = player1.hp <= 0 || player2.hp <= 0 ? 'K.O.!' : 'TIME!';
        drawAnnouncement(announceText, sub);
      } else if (announceTimer <= 0) {
        if (player1.wins >= ROUNDS_TO_WIN) {
          matchWinner = player1;
          gameState = 'matchEnd';
        } else if (player2.wins >= ROUNDS_TO_WIN) {
          matchWinner = player2;
          gameState = 'matchEnd';
        } else {
          roundNum++;
          startRound();
        }
      }
      break;

    case 'matchEnd':
      drawMatchEnd();
      if (consumeKey('Enter')) {
        gameState = 'select';
        selectPhase = 'p1';
      }
      break;
  }

  // Clear justPressed at end of frame
  for (const k in justPressed) justPressed[k] = false;

  rafId = requestAnimationFrame(gameLoop);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && rafId) cancelAnimationFrame(rafId);
});

rafId = requestAnimationFrame(gameLoop);



// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'THE BLOCK';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.703897728966729;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.015427470618356637;mix-blend-mode:overlay';
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
