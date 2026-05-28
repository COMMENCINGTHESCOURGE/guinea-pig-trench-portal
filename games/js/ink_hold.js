'use strict';

// ─── TRENCH FM BLOB MORPH ───
const MORPH_KEYS = [
  [63,37,29,71, 61,31,69,39],
  [43,57,64,36, 51,63,37,49],
  [56,44,47,53, 39,56,44,61],
];
function getMorph(t, speed) {
  const cycle = ((t / speed) % 1 + 1) % 1;
  const idx = Math.floor(cycle * 3);
  const frac = (cycle * 3) % 1;
  const a = MORPH_KEYS[idx % 3];
  const b = MORPH_KEYS[(idx + 1) % 3];
  return a.map((v, i) => (v + (b[i] - v) * frac) / 100);
}

// ─── FIVE WORLD COLORS ───
const INK_WORLDS = [
  {name:'PINK HOUR',       paper:'#f0d8c8', ink:'#8a2040', accent:'#d06088', grid:'rgba(120,40,50,.14)'},
  {name:'THE BLOCK',       paper:'#d8e8d0', ink:'#1a4828', accent:'#40a860', grid:'rgba(30,80,40,.14)'},
  {name:'THE THRESHOLD',   paper:'#f0dea8', ink:'#6b4e1a', accent:'#c49030', grid:'rgba(80,50,15,.14)'},
  {name:'VAULT COMPOUND 7',paper:'#e0d0b8', ink:'#8a5010', accent:'#d08020', grid:'rgba(100,50,10,.14)'},
  {name:'THE BETWEEN',     paper:'#c8d0e0', ink:'#1a2848', accent:'#4060c8', grid:'rgba(20,30,80,.14)'},
];
function getInkWorld(waveNum) {
  return INK_WORLDS[(waveNum - 1) % INK_WORLDS.length];
}

// ─── CANVAS SETUP ───
const paperCvs = document.getElementById('paper');
const paperCtx = paperCvs.getContext('2d');
const gameCvs = document.getElementById('game');
const ctx = gameCvs.getContext('2d');

let W, H, COLS, ROWS, CELL;
function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  paperCvs.width = gameCvs.width = W;
  paperCvs.height = gameCvs.height = H;
  CELL = Math.max(32, Math.min(48, Math.floor(Math.min(W, H) / 18)));
  COLS = Math.floor(W / CELL);
  ROWS = Math.floor(H / CELL);
  paperDirty = true;
}
resize();
window.addEventListener('resize', resize);

// ─── GAME STATE ───
let wave = 1;
let hp = 20;
let ink = 100;
let score = 0;
let kills = 0;
let selectedStructure = 0;
let gameOver = false;
let waveActive = false;
let waveTimer = 0;
let spawnTimer = 0;
let spawnCount = 0;
let totalToSpawn = 0;
let paperDirty = true;
let announceTimer = 0;
let announceText = '';
let t = 0; // global time

// ─── PATH ───
// Enemies follow a path from left edge to right edge, snaking through the grid
let path = [];
function generatePath() {
  path = [];
  const midRow = Math.floor(ROWS / 2);
  // Create a snaking path
  const segments = 3 + Math.min(4, Math.floor(wave / 3));
  let row = midRow;
  let col = 0;
  path.push({x: 0, y: row});

  const rowStep = Math.max(2, Math.floor(ROWS / (segments + 1)));
  let direction = -1; // start going up

  for (let s = 0; s < segments; s++) {
    // Move right
    const nextCol = Math.min(COLS - 1, col + Math.floor(COLS / segments));
    path.push({x: nextCol, y: row});
    col = nextCol;

    // Move vertically
    if (s < segments - 1) {
      const nextRow = Math.max(2, Math.min(ROWS - 3, row + direction * rowStep));
      path.push({x: col, y: nextRow});
      row = nextRow;
      direction *= -1;
    }
  }
  // Final point off screen right
  path.push({x: COLS, y: row});
}
generatePath();

function getPathPoint(progress) {
  // progress 0..1 along the full path
  const totalLen = getPathLength();
  let targetDist = progress * totalLen;
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = (path[i].x - path[i-1].x) * CELL;
    const dy = (path[i].y - path[i-1].y) * CELL;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (accumulated + segLen >= targetDist) {
      const frac = (targetDist - accumulated) / segLen;
      return {
        x: (path[i-1].x + (path[i].x - path[i-1].x) * frac) * CELL + CELL / 2,
        y: (path[i-1].y + (path[i].y - path[i-1].y) * frac) * CELL + CELL / 2,
      };
    }
    accumulated += segLen;
  }
  return { x: path[path.length-1].x * CELL + CELL/2, y: path[path.length-1].y * CELL + CELL/2 };
}

function getPathLength() {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = (path[i].x - path[i-1].x) * CELL;
    const dy = (path[i].y - path[i-1].y) * CELL;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// ─── STRUCTURES ───
const STRUCTURE_TYPES = [
  { name: 'Ink Blot',   cost: 15, range: 3, damage: 8,  rate: 1.2, splash: 1.5, color: null },
  { name: 'Quill Tower', cost: 25, range: 4, damage: 5,  rate: 2.5, splash: 0,   color: null },
  { name: 'Seal Ward',  cost: 40, range: 2.5, damage: 2, rate: 0.8, splash: 0, slow: 0.5, color: null },
  { name: 'Nib Cannon', cost: 60, range: 5, damage: 20, rate: 0.5, splash: 0,   color: null },
];

let structures = [];
// Structure: { type, col, row, cooldown, angle, seed }

function canPlace(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  // Not on path cells
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i], p1 = path[i+1];
    // Check if cell is within 1 cell of path segment
    const minC = Math.min(p0.x, p1.x) - 1;
    const maxC = Math.max(p0.x, p1.x) + 1;
    const minR = Math.min(p0.y, p1.y) - 1;
    const maxR = Math.max(p0.y, p1.y) + 1;
    if (col >= minC && col <= maxC && row >= minR && row <= maxR) return false;
  }
  // Not on existing structure
  for (const s of structures) {
    if (s.col === col && s.row === row) return false;
  }
  return true;
}

// ─── ENEMIES ───
const ENEMY_TYPES = [
  { name: 'Smudge',    hp: 30,  speed: 0.4,  reward: 5,  r: 0.4, color: '#444' },
  { name: 'Bleed',     hp: 50,  speed: 0.35, reward: 8,  r: 0.5, color: '#882222' },
  { name: 'Drip',      hp: 20,  speed: 0.65, reward: 4,  r: 0.35, color: '#225588' },
  { name: 'Stain',     hp: 100, speed: 0.25, reward: 15, r: 0.6, color: '#553388' },
  { name: 'Splatter',  hp: 200, speed: 0.2,  reward: 25, r: 0.7, color: '#884400' },
];

let enemies = [];
// Enemy: { type, progress, hp, maxHp, speed, slowTimer, seed, hurtTimer }

let projectiles = [];
// Projectile: { x, y, tx, ty, speed, damage, splash, age }

// ─── PAPER TEXTURE ───
let paperTexture = null;

function buildPaper() {
  const world = getInkWorld(wave);
  const offCvs = document.createElement('canvas');
  offCvs.width = W;
  offCvs.height = H;
  const pctx = offCvs.getContext('2d');

  // Base paper color
  pctx.fillStyle = world.paper;
  pctx.fillRect(0, 0, W, H);

  // Paper fiber noise
  const imgData = pctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    d[i]   = Math.max(0, Math.min(255, d[i] + noise));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + noise));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + noise));
  }
  pctx.putImageData(imgData, 0, 0);

  // Stain splotches
  for (let i = 0; i < 12; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const sr = 40 + Math.random() * 120;
    const grad = pctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grad.addColorStop(0, 'rgba(160,130,90,0.06)');
    grad.addColorStop(1, 'rgba(160,130,90,0)');
    pctx.fillStyle = grad;
    pctx.beginPath();
    pctx.arc(sx, sy, sr, 0, Math.PI * 2);
    pctx.fill();
  }

  // Grid lines
  pctx.strokeStyle = world.grid;
  pctx.lineWidth = 0.5;
  for (let c = 0; c <= COLS; c++) {
    const x = c * CELL;
    pctx.beginPath();
    pctx.moveTo(x, 0); pctx.lineTo(x, H);
    pctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = r * CELL;
    pctx.beginPath();
    pctx.moveTo(0, y); pctx.lineTo(W, y);
    pctx.stroke();
  }

  // Draw path on paper
  pctx.strokeStyle = world.ink;
  pctx.globalAlpha = 0.15;
  pctx.lineWidth = CELL * 0.6;
  pctx.lineCap = 'round';
  pctx.lineJoin = 'round';
  pctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const px = path[i].x * CELL + CELL / 2;
    const py = path[i].y * CELL + CELL / 2;
    if (i === 0) pctx.moveTo(px, py);
    else pctx.lineTo(px, py);
  }
  pctx.stroke();
  pctx.globalAlpha = 1;

  // Path dotted center line
  pctx.strokeStyle = world.ink;
  pctx.globalAlpha = 0.08;
  pctx.lineWidth = 1;
  pctx.setLineDash([4, 6]);
  pctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const px = path[i].x * CELL + CELL / 2;
    const py = path[i].y * CELL + CELL / 2;
    if (i === 0) pctx.moveTo(px, py);
    else pctx.lineTo(px, py);
  }
  pctx.stroke();
  pctx.setLineDash([]);
  pctx.globalAlpha = 1;

  // Border / corner flourishes
  pctx.strokeStyle = world.ink;
  pctx.globalAlpha = 0.2;
  pctx.lineWidth = 2;
  const m = 20;
  const fl = 40;
  // Top-left
  pctx.beginPath(); pctx.moveTo(m, m + fl); pctx.lineTo(m, m); pctx.lineTo(m + fl, m); pctx.stroke();
  // Top-right
  pctx.beginPath(); pctx.moveTo(W - m - fl, m); pctx.lineTo(W - m, m); pctx.lineTo(W - m, m + fl); pctx.stroke();
  // Bottom-left
  pctx.beginPath(); pctx.moveTo(m, H - m - fl); pctx.lineTo(m, H - m); pctx.lineTo(m + fl, H - m); pctx.stroke();
  // Bottom-right
  pctx.beginPath(); pctx.moveTo(W - m - fl, H - m); pctx.lineTo(W - m, H - m); pctx.lineTo(W - m, H - m - fl); pctx.stroke();
  pctx.globalAlpha = 1;

  paperTexture = offCvs;
  paperCtx.drawImage(paperTexture, 0, 0);
  paperDirty = false;
}

// ─── ANNOUNCE ───
function announce(text, duration) {
  announceText = text;
  announceTimer = duration || 2;
  const el = document.getElementById('announce');
  el.textContent = text;
  el.style.opacity = '1';
  el.style.color = getInkWorld(wave).ink;
}

// ─── WAVE SYSTEM ───
function spawnWave() {
  const world = getInkWorld(wave);

  // Update threshold world name
  const wn = document.getElementById('threshold-world-name');
  if (wn) wn.textContent = world.name;

  // Rebuild paper with new world colors
  paperDirty = true;

  // Update HUD colors
  document.querySelectorAll('.hud-panel').forEach(p => { p.style.color = world.ink; p.style.borderColor = world.ink + '55'; });
  document.querySelectorAll('.shop-btn').forEach(b => { b.style.color = world.ink; b.style.borderColor = world.ink + '55'; });

  announce(world.name + ' — WAVE ' + wave, 2.5);

  waveActive = true;
  spawnTimer = 0;
  spawnCount = 0;
  totalToSpawn = 5 + wave * 2 + Math.floor(wave / 3) * 3;
}

function spawnEnemy() {
  const typeIdx = Math.min(ENEMY_TYPES.length - 1, Math.floor(Math.random() * Math.min(wave, ENEMY_TYPES.length)));
  const type = ENEMY_TYPES[typeIdx];
  const waveScale = 1 + (wave - 1) * 0.15;
  enemies.push({
    type: type,
    progress: 0,
    hp: Math.floor(type.hp * waveScale),
    maxHp: Math.floor(type.hp * waveScale),
    speed: type.speed * (1 + wave * 0.02),
    slowTimer: 0,
    seed: Math.random() * 1000,
    hurtTimer: 0,
    r: type.r,
  });
}

// ─── DRAWING: wobblyCircle for structures ───
function wobblyCircle(cx, cy, r, seed, time, segments) {
  segments = segments || 12;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const ang = (i / segments) * Math.PI * 2;
    const wobble = Math.sin(ang * 3 + seed + time * 2) * r * 0.15 +
                   Math.cos(ang * 5 - seed * 0.7 + time) * r * 0.08;
    const rr = r + wobble;
    const px = cx + Math.cos(ang) * rr;
    const py = cy + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// ─── DRAW STRUCTURE ───
function drawStructure(s) {
  const world = getInkWorld(wave);
  const cx = s.col * CELL + CELL / 2;
  const cy = s.row * CELL + CELL / 2;
  const type = STRUCTURE_TYPES[s.type];
  const r = CELL * 0.35;

  ctx.save();

  // Shadow
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#000';
  wobblyCircle(cx + 2, cy + 3, r, s.seed, t, 10);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Main body
  ctx.fillStyle = world.ink;
  ctx.globalAlpha = 0.7;
  wobblyCircle(cx, cy, r, s.seed, t, 10);
  ctx.fill();

  // Accent layer
  ctx.fillStyle = world.accent;
  ctx.globalAlpha = 0.3;
  wobblyCircle(cx, cy, r * 0.7, s.seed + 10, t * 1.3, 8);
  ctx.fill();

  // Stroke
  ctx.strokeStyle = world.ink;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.5;
  wobblyCircle(cx, cy, r, s.seed, t, 10);
  ctx.stroke();

  // Type icon
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = world.paper;
  ctx.font = `${CELL * 0.3}px Courier New`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const icons = ['●', '↑', '◎', '▲'];
  ctx.fillText(icons[s.type], cx, cy);

  // Range indicator on hover — drawn elsewhere
  ctx.restore();
}

// ─── DRAW ENEMY (blob morph) ───
function drawEnemy(e) {
  const world = getInkWorld(wave);
  const pos = getPathPoint(e.progress);
  const w = CELL;

  ctx.save();
  ctx.translate(pos.x, pos.y);

  // Shadow
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(2, 4, e.r * w * 0.5, e.r * w * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // BLOB MORPH body — 3 watercolor layers
  const morph = getMorph(t + e.seed, 3 + e.seed * 0.05);
  const r = e.r;
  const rx = r * w, ry = r * w * 1.1;
  const tl=morph[0]*rx, tr=morph[1]*rx, bl=morph[2]*rx, br=morph[3]*rx;
  const tlY=morph[4]*ry, trY=morph[5]*ry, blY=morph[6]*ry, brY=morph[7]*ry;

  function blobPath() {
    ctx.beginPath();
    ctx.moveTo(0, -ry);
    ctx.bezierCurveTo(tr, -trY, rx, -trY*0.5, rx, 0);
    ctx.bezierCurveTo(rx, brY*0.5, br, ry, 0, ry);
    ctx.bezierCurveTo(-bl, ry, -rx, blY*0.5, -rx, 0);
    ctx.bezierCurveTo(-rx, -tlY*0.5, -tl, -ry, 0, -ry);
    ctx.closePath();
  }

  // Layer 1: dark fill
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = e.type.color;
  blobPath();
  ctx.fill();

  // Layer 2: accent watercolor wash
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = world.accent;
  blobPath();
  ctx.fill();

  // Layer 3: stroke
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = world.ink;
  ctx.lineWidth = 1.2;
  blobPath();
  ctx.stroke();

  // Hurt flash
  if (e.hurtTimer > 0) {
    ctx.globalAlpha = e.hurtTimer * 0.6;
    ctx.fillStyle = '#fff';
    blobPath();
    ctx.fill();
  }

  // Eyes
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff';
  const eyeR = r * w * 0.12;
  const eyeSpread = r * w * 0.25;
  ctx.beginPath();
  ctx.arc(-eyeSpread, -r * w * 0.15, eyeR, 0, Math.PI * 2);
  ctx.arc(eyeSpread, -r * w * 0.15, eyeR, 0, Math.PI * 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = world.ink;
  ctx.beginPath();
  ctx.arc(-eyeSpread + 1, -r * w * 0.13, eyeR * 0.55, 0, Math.PI * 2);
  ctx.arc(eyeSpread + 1, -r * w * 0.13, eyeR * 0.55, 0, Math.PI * 2);
  ctx.fill();

  // HP bar
  if (e.hp < e.maxHp) {
    const barW = r * w * 1.6;
    const barH = 3;
    const barY = -ry - 8;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000';
    ctx.fillRect(-barW/2, barY, barW, barH);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#4a4' : (e.hp / e.maxHp > 0.25 ? '#aa4' : '#a44');
    ctx.globalAlpha = 0.8;
    ctx.fillRect(-barW/2, barY, barW * (e.hp / e.maxHp), barH);
  }

  ctx.restore();
}

// ─── DRAW PROJECTILE ───
function drawProjectile(p) {
  const world = getInkWorld(wave);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - p.age * 2);
  ctx.fillStyle = world.ink;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
  // Trail
  ctx.strokeStyle = world.ink;
  ctx.globalAlpha *= 0.3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * 0.1, p.y - p.vy * 0.1);
  ctx.stroke();
  ctx.restore();
}

// ─── DRAW TENDRILS between structures ───
function drawTendrils() {
  if (structures.length < 2) return;
  const world = getInkWorld(wave);
  ctx.save();
  for (let i = 0; i < structures.length; i++) {
    for (let j = i + 1; j < structures.length; j++) {
      const a = structures[i], b = structures[j];
      const dc = Math.abs(a.col - b.col);
      const dr = Math.abs(a.row - b.row);
      const dist = Math.sqrt(dc * dc + dr * dr);
      if (dist > 3) continue;

      const ax = a.col * CELL + CELL / 2;
      const ay = a.row * CELL + CELL / 2;
      const bx = b.col * CELL + CELL / 2;
      const by = b.row * CELL + CELL / 2;

      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      // Perpendicular offset animated
      const perpMag = CELL * 0.4 * Math.sin(t * 1.5 + a.seed + b.seed);
      const dx = bx - ax, dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len, ny = dx / len;

      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = world.accent;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx + nx * perpMag, my + ny * perpMag, bx, by);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ─── UPDATE ───
function update(dt) {
  if (gameOver) return;
  t += dt;

  // Announce fade
  if (announceTimer > 0) {
    announceTimer -= dt;
    if (announceTimer <= 0) {
      document.getElementById('announce').style.opacity = '0';
    }
  }

  // Wave spawning
  if (waveActive) {
    spawnTimer -= dt;
    if (spawnTimer <= 0 && spawnCount < totalToSpawn) {
      spawnEnemy();
      spawnCount++;
      spawnTimer = Math.max(0.3, 1.2 - wave * 0.04);
    }
    if (spawnCount >= totalToSpawn && enemies.length === 0) {
      // Wave complete
      waveActive = false;
      ink += 20 + wave * 5;
      wave++;
      waveTimer = 3;
      generatePath();
      paperDirty = true;
    }
  } else {
    waveTimer -= dt;
    if (waveTimer <= 0) {
      spawnWave();
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    let spd = e.speed;
    if (e.slowTimer > 0) {
      spd *= 0.5;
      e.slowTimer -= dt;
    }
    if (e.hurtTimer > 0) e.hurtTimer -= dt;
    e.progress += spd * dt / getPathLength() * CELL * 10;

    if (e.progress >= 1) {
      // Reached end
      hp -= 1;
      enemies.splice(i, 1);
      if (hp <= 0) {
        gameOver = true;
        announce('THE INK DRIES — GAME OVER', 99);
      }
      continue;
    }

    if (e.hp <= 0) {
      score += e.type.reward || 10;
      ink += Math.floor((e.type.reward || 10) / 2);
      kills++;
      enemies.splice(i, 1);
    }
  }

  // Structure targeting & shooting
  for (const s of structures) {
    s.cooldown -= dt;
    if (s.cooldown > 0) continue;

    const type = STRUCTURE_TYPES[s.type];
    const sx = s.col * CELL + CELL / 2;
    const sy = s.row * CELL + CELL / 2;
    const range = type.range * CELL;

    // Find closest enemy in range
    let closest = null;
    let closestDist = Infinity;
    for (const e of enemies) {
      const pos = getPathPoint(e.progress);
      const dx = pos.x - sx, dy = pos.y - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < range && dist < closestDist) {
        closest = e;
        closestDist = dist;
      }
    }

    if (closest) {
      const pos = getPathPoint(closest.progress);
      s.cooldown = 1 / type.rate;
      s.angle = Math.atan2(pos.y - sy, pos.x - sx);

      // Seal Ward applies slow instead of projectile
      if (type.slow) {
        for (const e of enemies) {
          const ep = getPathPoint(e.progress);
          const dx = ep.x - sx, dy = ep.y - sy;
          if (Math.sqrt(dx*dx + dy*dy) < range) {
            e.slowTimer = Math.max(e.slowTimer, 1.5);
            e.hp -= type.damage;
            e.hurtTimer = 0.15;
          }
        }
      } else {
        // Fire projectile
        const dx = pos.x - sx, dy = pos.y - sy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const speed = CELL * 12;
        projectiles.push({
          x: sx, y: sy,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          damage: type.damage,
          splash: type.splash || 0,
          age: 0,
        });
      }
    }
  }

  // Update projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += dt;

    if (p.age > 2 || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
      projectiles.splice(i, 1);
      continue;
    }

    // Hit check
    for (const e of enemies) {
      const pos = getPathPoint(e.progress);
      const dx = pos.x - p.x, dy = pos.y - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < CELL * e.r * 0.8) {
        e.hp -= p.damage;
        e.hurtTimer = 0.2;

        // Splash damage
        if (p.splash > 0) {
          for (const e2 of enemies) {
            if (e2 === e) continue;
            const pos2 = getPathPoint(e2.progress);
            const d2 = Math.sqrt((pos2.x - p.x)**2 + (pos2.y - p.y)**2);
            if (d2 < p.splash * CELL) {
              e2.hp -= p.damage * 0.5;
              e2.hurtTimer = 0.15;
            }
          }
        }

        projectiles.splice(i, 1);
        break;
      }
    }
  }

  // Update HUD
  document.getElementById('waveNum').textContent = wave;
  document.getElementById('hpVal').textContent = hp;
  document.getElementById('inkVal').textContent = ink;
  document.getElementById('scoreVal').textContent = score;
  document.getElementById('killVal').textContent = kills;
}

// ─── DRAW ───
function draw() {
  if (paperDirty) buildPaper();

  ctx.clearRect(0, 0, W, H);

  // Draw structures
  for (const s of structures) drawStructure(s);

  // Draw tendrils between structures
  drawTendrils();

  // Draw enemies
  for (const e of enemies) drawEnemy(e);

  // Draw projectiles
  for (const p of projectiles) drawProjectile(p);

  // Draw placement preview
  if (hoverCol >= 0 && hoverRow >= 0) {
    const world = getInkWorld(wave);
    const cx = hoverCol * CELL + CELL / 2;
    const cy = hoverRow * CELL + CELL / 2;
    const valid = canPlace(hoverCol, hoverRow) && ink >= STRUCTURE_TYPES[selectedStructure].cost;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = valid ? world.accent : '#ff4444';
    ctx.fillRect(hoverCol * CELL, hoverRow * CELL, CELL, CELL);

    // Range circle
    if (valid) {
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = world.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, STRUCTURE_TYPES[selectedStructure].range * CELL, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Seal Ward aura for active seal structures
  const world = getInkWorld(wave);
  for (const s of structures) {
    if (s.type === 2) { // Seal Ward
      const sx = s.col * CELL + CELL / 2;
      const sy = s.row * CELL + CELL / 2;
      const range = STRUCTURE_TYPES[2].range * CELL;
      ctx.save();
      ctx.globalAlpha = 0.06 + Math.sin(t * 2 + s.seed) * 0.03;
      ctx.strokeStyle = world.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Game over overlay
  if (gameOver) {
    ctx.save();
    ctx.fillStyle = 'rgba(240,222,168,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ─── INPUT ───
let hoverCol = -1, hoverRow = -1;

gameCvs.addEventListener('mousemove', (e) => {
  hoverCol = Math.floor(e.clientX / CELL);
  hoverRow = Math.floor(e.clientY / CELL);
});

gameCvs.addEventListener('click', (e) => {
  if (gameOver) return;
  const col = Math.floor(e.clientX / CELL);
  const row = Math.floor(e.clientY / CELL);
  const type = STRUCTURE_TYPES[selectedStructure];

  if (canPlace(col, row) && ink >= type.cost) {
    ink -= type.cost;
    structures.push({
      type: selectedStructure,
      col: col,
      row: row,
      cooldown: 0,
      angle: 0,
      seed: Math.random() * 1000,
    });
  }
});

// Shop buttons
document.querySelectorAll('.shop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedStructure = parseInt(btn.dataset.type);
    document.querySelectorAll('.shop-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// ─── GAME LOOP ───
let lastTime = 0;
function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (dt > 0) {
    update(dt);
    draw();
  }
  requestAnimationFrame(loop);
}

// Start first wave
spawnWave();
requestAnimationFrame(loop);

// -- THE THRESHOLD CROSS-POLLINATION (pass 1) --
(function() {
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = 'PINK HOUR';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7268598732657445;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.018;mix-blend-mode:overlay';
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

// CHAIN FIX: SCREENSHOT ON S KEY
document.addEventListener("keydown", function(e) {
  if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey) {
    // Composite both canvases
    var comp = document.createElement('canvas');
    comp.width = window.innerWidth;
    comp.height = window.innerHeight;
    var cctx = comp.getContext('2d');
    var paper = document.getElementById('paper');
    var game = document.getElementById('game');
    if (paper) cctx.drawImage(paper, 0, 0);
    if (game) cctx.drawImage(game, 0, 0);
    var url = comp.toDataURL("image/png");
    var a = document.createElement("a");
    a.href = url;
    a.download = "ink_hold_" + Date.now() + ".png";
    a.click();
  }
});

// CHAIN FIX: MUSIC LINK (AUDIO_BASS etc from parent)
setInterval(function() {
  try {
    if (parent.AUDIO_BASS !== undefined) {
      window.AUDIO_BASS = parent.AUDIO_BASS;
      window.AUDIO_MID = parent.AUDIO_MID;
      window.AUDIO_HIGH = parent.AUDIO_HIGH;
      window.AUDIO_ENERGY = parent.AUDIO_ENERGY;
    }
  } catch(e) {}
}, 33);

// CHAIN FIX: AUDIO-REACTIVE VISUALS
// Vignette breathes with bass, color matches current world ink
(function() {
  var vig = document.getElementById('threshold-vignette');
  var lastBass = 0;

  function pulse() {
    requestAnimationFrame(pulse);
    var bass = window.AUDIO_BASS || (parent && parent.AUDIO_BASS) || 0;
    var energy = window.AUDIO_ENERGY || (parent && parent.AUDIO_ENERGY) || 0;

    // Smooth
    lastBass += (bass - lastBass) * 0.15;

    // Get current world ink color for vignette tint
    var wn = document.getElementById('threshold-world-name');
    var worldName = wn ? wn.textContent : '';

    // Map world name to ink color rgba
    var inkR = 107, inkG = 78, inkB = 26; // default Threshold
    if (worldName.indexOf('PINK') >= 0) { inkR=138; inkG=32; inkB=64; }
    else if (worldName.indexOf('BLOCK') >= 0) { inkR=26; inkG=72; inkB=40; }
    else if (worldName.indexOf('VAULT') >= 0) { inkR=138; inkG=80; inkB=16; }
    else if (worldName.indexOf('BETWEEN') >= 0) { inkR=26; inkG=40; inkB=72; }

    // Vignette breathes with bass
    if (vig) {
      var intensity = 0.35 + (lastBass / 255) * 0.15;
      vig.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(' + inkR + ',' + inkG + ',' + inkB + ',' + intensity.toFixed(3) + '))';
    }

    // Canvas brightness pulse with energy
    var c = document.getElementById('game');
    if (c && energy > 0.01) {
      c.style.filter = 'brightness(' + (1 + energy * 0.06).toFixed(3) + ')';
    } else if (c) {
      c.style.filter = '';
    }
  }

  // Only start if music link is active
  var checkInterval = setInterval(function() {
    if (window.AUDIO_BASS !== undefined || (parent && parent.AUDIO_BASS !== undefined)) {
      clearInterval(checkInterval);
      pulse();
    }
  }, 500);
})();