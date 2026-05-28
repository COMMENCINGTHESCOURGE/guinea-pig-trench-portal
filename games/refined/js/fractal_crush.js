
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

// --- CONSTANTS ---
const COLS = 8, ROWS = 8;
const GEM_TYPES = [
  { name: 'Teal Diamond',   color: '#00d2ff', glow: '#00a0cc', char: 'Geometric Core' },
  { name: 'Pink Crystal',   color: '#ff60a0', glow: '#cc4080', char: 'Dim Mak' },
  { name: 'Gold Nugget',    color: '#ffd700', glow: '#cca800', char: 'Defender' },
  { name: 'Purple Shard',   color: '#8040ff', glow: '#6030cc', char: 'Mecha' },
  { name: 'Green Emerald',  color: '#40c060', glow: '#309048', char: 'Kraken' },
  { name: 'Red Ruby',       color: '#ff4040', glow: '#cc3030', char: 'Grief/Aku Aku' }
];

const SPRITE_FILES = [
  '../assets/sprites/geometric_core_geode_flux.png',
  '../assets/sprites/dim_mak_fighter_full_sheet.png',
  '../assets/sprites/armored_defender_sprite_sheet.png',
  '../assets/sprites/mecha_entity_alpha_v2_pixel.png',
  '../assets/sprites/kraken_game_render.png',
  '../assets/sprites/aku_aku_mask_stylized.png'
];

const SPECIAL = { NONE: 0, STRIPED_H: 1, STRIPED_V: 2, BOMB: 3, RAINBOW: 4 };
const ROUND_TIME = 90;
const SWAP_DURATION = 200;
const CLEAR_DURATION = 300;
const DROP_SPEED = 12; // cells per second

let W, H, cellSize, gridX, gridY;
let state = 'title'; // title, playing, gameover
let score = 0, level = 1, combo = 0, maxCombo = 0, gemsCleared = 0;
let timer = ROUND_TIME;
let lastTime = 0;
let grid = [];
let selected = null;
let swapping = null; // {r1,c1,r2,c2,t,dur,reverting}
let clearing = []; // [{r,c,t,dur}]
let dropping = false;
let inputLocked = false;
let isCascading = false;
let shakeAmount = 0;
let particles = [];
let floatingTexts = [];
let comboTimer = 0;
let titlePhase = 0;
let spriteImages = [];
let spritesLoaded = 0;
let currentCharIdx = 0;
let charReaction = 0; // 0=normal, 1=excited, 2=hyped
let charReactionTimer = 0;

// --- RESIZE ---
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  const maxGrid = Math.min(W * 0.6, H * 0.85);
  cellSize = Math.floor(maxGrid / COLS);
  gridX = Math.floor((W - cellSize * COLS) / 2);
  gridY = Math.floor((H - cellSize * ROWS) / 2) + 20;
}
resize();
window.addEventListener('resize', resize);

// --- LOAD SPRITES ---
SPRITE_FILES.forEach((src, i) => {
  const img = new Image();
  img.onload = () => { spritesLoaded++; };
  img.onerror = () => { spritesLoaded++; };
  img.src = src;
  spriteImages[i] = img;
});

// --- GEM CLASS ---
function makeGem(type, special = SPECIAL.NONE) {
  return { type, special, offsetY: 0, scale: 1, alpha: 1 };
}

function gemTypesForLevel(lvl) {
  return Math.min(4 + lvl, 6);
}

function randomType() {
  return Math.floor(Math.random() * gemTypesForLevel(level));
}

// --- GRID INIT ---
function initGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      let t;
      do {
        t = randomType();
      } while (wouldMatch(r, c, t));
      grid[r][c] = makeGem(t);
    }
  }
}

function wouldMatch(r, c, type) {
  // Check horizontal
  if (c >= 2 && grid[r][c-1] && grid[r][c-2] &&
      grid[r][c-1].type === type && grid[r][c-2].type === type) return true;
  // Check vertical
  if (r >= 2 && grid[r-1] && grid[r-2] &&
      grid[r-1][c] && grid[r-2][c] &&
      grid[r-1][c].type === type && grid[r-2][c].type === type) return true;
  return false;
}

// --- MATCH FINDING ---
function findMatches() {
  const matched = new Set();
  const specials = []; // {r, c, type, special}

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && grid[r][c] && grid[r][c-1] &&
          grid[r][c].type === grid[r][c-1].type &&
          grid[r][c].type >= 0) {
        run++;
      } else {
        if (run >= 3) {
          for (let k = c - run; k < c; k++) matched.add(r + ',' + k);
          if (run === 4) {
            const midC = c - Math.ceil(run / 2);
            specials.push({ r, c: midC, type: grid[r][c-1].type, special: SPECIAL.STRIPED_H });
          } else if (run >= 5) {
            const midC = c - Math.ceil(run / 2);
            specials.push({ r, c: midC, type: grid[r][c-1].type, special: SPECIAL.RAINBOW });
          }
        }
        run = 1;
      }
    }
  }

  // Vertical
  for (let c = 0; c < COLS; c++) {
    let run = 1;
    for (let r = 1; r <= ROWS; r++) {
      if (r < ROWS && grid[r][c] && grid[r-1][c] &&
          grid[r][c].type === grid[r-1][c].type &&
          grid[r][c].type >= 0) {
        run++;
      } else {
        if (run >= 3) {
          for (let k = r - run; k < r; k++) matched.add(k + ',' + c);
          if (run === 4) {
            const midR = r - Math.ceil(run / 2);
            specials.push({ r: midR, c, type: grid[midR][c].type, special: SPECIAL.STRIPED_V });
          } else if (run >= 5) {
            const midR = r - Math.ceil(run / 2);
            specials.push({ r: midR, c, type: grid[midR][c].type, special: SPECIAL.RAINBOW });
          }
        }
        run = 1;
      }
    }
  }

  // Detect L/T shapes (overlap of horizontal and vertical matches)
  // Find cells that are in both a horizontal and vertical run
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!matched.has(r + ',' + c)) continue;
      const gem = grid[r][c];
      if (!gem) continue;
      const t = gem.type;
      // Check if this cell is at the intersection of H and V runs
      let hRun = 1, vRun = 1;
      for (let k = c - 1; k >= 0 && grid[r][k] && grid[r][k].type === t; k--) hRun++;
      for (let k = c + 1; k < COLS && grid[r][k] && grid[r][k].type === t; k++) hRun++;
      for (let k = r - 1; k >= 0 && grid[k][c] && grid[k][c].type === t; k--) vRun++;
      for (let k = r + 1; k < ROWS && grid[k][c] && grid[k][c].type === t; k++) vRun++;
      if (hRun >= 3 && vRun >= 3) {
        // Remove any existing special for this cell and replace with bomb
        const existing = specials.findIndex(s => s.r === r && s.c === c);
        if (existing >= 0) specials[existing].special = SPECIAL.BOMB;
        else specials.push({ r, c, type: t, special: SPECIAL.BOMB });
      }
    }
  }

  return { matched, specials };
}

// --- SPECIAL GEM EFFECTS ---
function triggerSpecial(r, c, gem) {
  const toClear = new Set();
  if (gem.special === SPECIAL.STRIPED_H) {
    for (let k = 0; k < COLS; k++) toClear.add(r + ',' + k);
    spawnParticleLine(r, 0, r, COLS - 1, gem.type);
  } else if (gem.special === SPECIAL.STRIPED_V) {
    for (let k = 0; k < ROWS; k++) toClear.add(k + ',' + c);
    spawnParticleLine(0, c, ROWS - 1, c, gem.type);
  } else if (gem.special === SPECIAL.BOMB) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) toClear.add(nr + ',' + nc);
      }
    }
    shakeAmount = 8;
    spawnExplosion(r, c, 20, gem.type);
  } else if (gem.special === SPECIAL.RAINBOW) {
    // Clear all gems of the swapped-with type (handled at swap time)
    // Fallback: clear a random type
    const targetType = gem.rainbowTarget != null ? gem.rainbowTarget : randomType();
    for (let rr = 0; rr < ROWS; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        if (grid[rr][cc] && grid[rr][cc].type === targetType) toClear.add(rr + ',' + cc);
      }
    }
    shakeAmount = 12;
    spawnExplosion(r, c, 40, targetType);
  }
  return toClear;
}

// --- PARTICLES ---
function spawnParticles(r, c, count, type) {
  const cx = gridX + c * cellSize + cellSize / 2;
  const cy = gridY + r * cellSize + cellSize / 2;
  const col = GEM_TYPES[type] ? GEM_TYPES[type].color : '#fff';
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 4,
      color: col
    });
  }
}

function spawnExplosion(r, c, count, type) {
  const cx = gridX + c * cellSize + cellSize / 2;
  const cy = gridY + r * cellSize + cellSize / 2;
  const col = GEM_TYPES[type] ? GEM_TYPES[type].color : '#fff';
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.6,
      maxLife: 0.6 + Math.random() * 0.6,
      size: 3 + Math.random() * 6,
      color: col
    });
  }
}

function spawnParticleLine(r1, c1, r2, c2, type) {
  const col = GEM_TYPES[type] ? GEM_TYPES[type].color : '#fff';
  const steps = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
  for (let i = 0; i < steps; i++) {
    const t = steps > 1 ? i / (steps - 1) : 0;
    const r = r1 + (r2 - r1) * t;
    const c = c1 + (c2 - c1) * t;
    const cx = gridX + c * cellSize + cellSize / 2;
    const cy = gridY + r * cellSize + cellSize / 2;
    for (let j = 0; j < 3; j++) {
      particles.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 1,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color: col
      });
    }
  }
}

function spawnFloatingText(r, c, text, color) {
  const cx = gridX + c * cellSize + cellSize / 2;
  const cy = gridY + r * cellSize;
  floatingTexts.push({ x: cx, y: cy, text, color, life: 1.2, maxLife: 1.2 });
}

// --- INPUT ---
let mouseX = 0, mouseY = 0, mouseDown = false, dragStart = null;

function getCellFromMouse(x, y) {
  const c = Math.floor((x - gridX) / cellSize);
  const r = Math.floor((y - gridY) / cellSize);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return { r, c };
  return null;
}

canvas.addEventListener('mousedown', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  mouseDown = true;
  handleClick(e.clientX, e.clientY);
  dragStart = getCellFromMouse(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (mouseDown && dragStart && state === 'playing' && !inputLocked && !isCascading) {
    const cell = getCellFromMouse(e.clientX, e.clientY);
    if (cell && (cell.r !== dragStart.r || cell.c !== dragStart.c)) {
      if (Math.abs(cell.r - dragStart.r) + Math.abs(cell.c - dragStart.c) === 1) {
        trySwap(dragStart.r, dragStart.c, cell.r, cell.c);
        dragStart = null;
        selected = null;
      }
    }
  }
});

canvas.addEventListener('mouseup', () => { mouseDown = false; dragStart = null; });

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  mouseX = t.clientX; mouseY = t.clientY;
  handleClick(t.clientX, t.clientY);
  dragStart = getCellFromMouse(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  mouseX = t.clientX; mouseY = t.clientY;
  if (dragStart && state === 'playing' && !inputLocked && !isCascading) {
    const cell = getCellFromMouse(t.clientX, t.clientY);
    if (cell && (cell.r !== dragStart.r || cell.c !== dragStart.c)) {
      if (Math.abs(cell.r - dragStart.r) + Math.abs(cell.c - dragStart.c) === 1) {
        trySwap(dragStart.r, dragStart.c, cell.r, cell.c);
        dragStart = null;
        selected = null;
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => { e.preventDefault(); dragStart = null; }, { passive: false });

function handleClick(x, y) {
  if (state === 'title') {
    startGame();
    return;
  }
  if (state === 'gameover') {
    state = 'title';
    return;
  }
  if (state === 'playing' && !inputLocked && !isCascading) {
    const cell = getCellFromMouse(x, y);
    if (!cell) { selected = null; return; }
    if (selected) {
      const dr = Math.abs(cell.r - selected.r);
      const dc = Math.abs(cell.c - selected.c);
      if (dr + dc === 1) {
        trySwap(selected.r, selected.c, cell.r, cell.c);
        selected = null;
      } else {
        selected = cell;
      }
    } else {
      selected = cell;
    }
  }
}

// --- GAME LOGIC ---
function startGame() {
  state = 'playing';
  score = 0; level = 1; combo = 0; maxCombo = 0; gemsCleared = 0;
  timer = ROUND_TIME;
  selected = null;
  inputLocked = false;
  isCascading = false;
  swapping = null;
  clearing = [];
  particles = [];
  floatingTexts = [];
  shakeAmount = 0;
  comboTimer = 0;
  currentCharIdx = 0;
  charReaction = 0;
  charReactionTimer = 0;
  initGrid();
}

function trySwap(r1, c1, r2, c2) {
  if (inputLocked) return;
  inputLocked = true;

  // If one is rainbow, set its target
  if (grid[r1][c1].special === SPECIAL.RAINBOW && grid[r2][c2]) {
    grid[r1][c1].rainbowTarget = grid[r2][c2].type;
  }
  if (grid[r2][c2].special === SPECIAL.RAINBOW && grid[r1][c1]) {
    grid[r2][c2].rainbowTarget = grid[r1][c1].type;
  }

  swapping = { r1, c1, r2, c2, t: 0, dur: SWAP_DURATION, reverting: false };
}

function completeSwap() {
  const { r1, c1, r2, c2, reverting } = swapping;
  // Actually swap in grid
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;

  if (reverting) {
    swapping = null;
    inputLocked = false;
    return;
  }

  // Check for matches
  const { matched } = findMatches();
  // Also check if either swapped gem is a special
  let hasSpecial = false;
  if (grid[r1][c1] && grid[r1][c1].special !== SPECIAL.NONE) hasSpecial = true;
  if (grid[r2][c2] && grid[r2][c2].special !== SPECIAL.NONE) hasSpecial = true;

  if (matched.size === 0 && !hasSpecial) {
    // No match — revert
    swapping = { r1: r2, c1: c2, r2: r1, c2: c1, t: 0, dur: SWAP_DURATION, reverting: true };
  } else {
    swapping = null;
    combo = 0;
    isCascading = true;
    // If a special was swapped but no standard match, trigger the special directly
    if (matched.size === 0 && hasSpecial) {
      const extraClears = new Set();
      [{ r: r1, c: c1 }, { r: r2, c: c2 }].forEach(pos => {
        const gem = grid[pos.r][pos.c];
        if (gem && gem.special !== SPECIAL.NONE) {
          const extras = triggerSpecial(pos.r, pos.c, gem);
          extras.forEach(k => extraClears.add(k));
          extraClears.add(pos.r + ',' + pos.c);
        }
      });
      if (extraClears.size > 0) {
        combo = 1;
        if (1 > maxCombo) maxCombo = 1;
        comboTimer = 1.5;
        const points = extraClears.size * 10;
        score += points;
        gemsCleared += extraClears.size;
        extraClears.forEach(key => {
          const [er, ec] = key.split(',').map(Number);
          if (grid[er][ec]) {
            spawnParticles(er, ec, 6, grid[er][ec].type);
            grid[er][ec] = null;
          }
        });
        setTimeout(() => {
          applyGravity();
          setTimeout(() => { processMatches(); }, 150);
        }, 200);
        return;
      }
    }
    processMatches();
  }
}

function processMatches() {
  const { matched, specials } = findMatches();

  // Also trigger any special gems that are in matched set
  const extraClears = new Set();
  matched.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    const gem = grid[r][c];
    if (gem && gem.special !== SPECIAL.NONE) {
      const extras = triggerSpecial(r, c, gem);
      extras.forEach(k => extraClears.add(k));
    }
  });

  // Combine
  extraClears.forEach(k => matched.add(k));

  if (matched.size === 0) {
    // Check for possible moves, if none reshuffle
    isCascading = false;
    inputLocked = false;
    comboTimer = 0;
    return;
  }

  combo++;
  if (combo > maxCombo) maxCombo = combo;
  comboTimer = 1.5;

  // Update character reaction
  if (combo >= 10) { charReaction = 2; charReactionTimer = 2; }
  else if (combo >= 5) { charReaction = 1; charReactionTimer = 1.5; }
  else if (combo >= 3) { charReaction = 1; charReactionTimer = 1; }

  const comboMult = Math.min(combo, 10);
  const points = matched.size * 10 * comboMult;
  score += points;
  gemsCleared += matched.size;

  // Level up every 500 points
  const newLevel = Math.floor(score / 500) + 1;
  if (newLevel > level) {
    level = newLevel;
    shakeAmount = 4;
  }

  // Determine most cleared gem type for character portrait
  const typeCounts = {};
  matched.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (grid[r][c]) {
      typeCounts[grid[r][c].type] = (typeCounts[grid[r][c].type] || 0) + 1;
    }
  });
  let bestType = 0, bestCount = 0;
  for (const t in typeCounts) {
    if (typeCounts[t] > bestCount) { bestCount = typeCounts[t]; bestType = parseInt(t); }
  }
  currentCharIdx = bestType;

  // Spawn particles and floating text
  let textShown = false;
  matched.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    if (grid[r][c]) {
      spawnParticles(r, c, 6, grid[r][c].type);
      if (!textShown) {
        spawnFloatingText(r, c, '+' + points + (combo > 1 ? ' x' + comboMult : ''), GEM_TYPES[grid[r][c].type].color);
        textShown = true;
      }
    }
  });

  if (combo >= 4) shakeAmount = Math.min(combo * 2, 16);

  // Place special gems before clearing
  specials.forEach(s => {
    matched.delete(s.r + ',' + s.c);
    grid[s.r][s.c] = makeGem(s.type, s.special);
  });

  // Clear matched gems
  matched.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    grid[r][c] = null;
  });

  // Start gravity after a short delay
  setTimeout(() => {
    applyGravity();
    setTimeout(() => {
      processMatches(); // Check for cascading matches
    }, 150);
  }, 200);
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (writeRow !== r) {
          grid[writeRow][c] = grid[r][c];
          grid[writeRow][c].offsetY = (r - writeRow) * cellSize;
          grid[r][c] = null;
        }
        writeRow--;
      }
    }
    // Fill empty spots from top
    for (let r = writeRow; r >= 0; r--) {
      grid[r][c] = makeGem(randomType());
      grid[r][c].offsetY = (r - writeRow - 1) * cellSize;
    }
  }
}

// --- DRAWING ---
function drawGem(cx, cy, size, type, special, alpha, scale) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  const gem = GEM_TYPES[type] || GEM_TYPES[0];
  const r = size * 0.42;

  // Outer glow
  const glowGrad = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 1.3);
  glowGrad.addColorStop(0, gem.color + '40');
  glowGrad.addColorStop(1, gem.color + '00');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Main gem body with 3D gradient
  const bodyGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
  bodyGrad.addColorStop(0, '#ffffff');
  bodyGrad.addColorStop(0.25, gem.color);
  bodyGrad.addColorStop(0.7, gem.glow);
  bodyGrad.addColorStop(1, gem.glow + '80');
  ctx.fillStyle = bodyGrad;

  // Draw gem shape based on type
  ctx.beginPath();
  if (type === 0) { // Diamond
    ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
  } else if (type === 1) { // Crystal (hexagon)
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i - Math.PI / 6;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else if (type === 2) { // Nugget (rounded rect)
    const nr = r * 0.85;
    ctx.moveTo(-nr, -nr * 0.7);
    ctx.quadraticCurveTo(-nr, -nr, -nr * 0.7, -nr);
    ctx.lineTo(nr * 0.7, -nr);
    ctx.quadraticCurveTo(nr, -nr, nr, -nr * 0.7);
    ctx.lineTo(nr, nr * 0.7);
    ctx.quadraticCurveTo(nr, nr, nr * 0.7, nr);
    ctx.lineTo(-nr * 0.7, nr);
    ctx.quadraticCurveTo(-nr, nr, -nr, nr * 0.7);
  } else if (type === 3) { // Shard (pentagon)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * 2 / 5 * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else if (type === 4) { // Emerald (octagon)
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 4 * i;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else { // Ruby (triangle-ish)
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, r * 0.6);
    ctx.lineTo(-r * 0.9, r * 0.6);
  }
  ctx.closePath();
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, -r * 0.3, r * 0.4, r * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Special markers
  if (special === SPECIAL.STRIPED_H || special === SPECIAL.STRIPED_V) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.7;
    if (special === SPECIAL.STRIPED_H) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, i * r * 0.3);
        ctx.lineTo(r * 0.7, i * r * 0.3);
        ctx.stroke();
      }
    } else {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.3, -r * 0.7);
        ctx.lineTo(i * r * 0.3, r * 0.7);
        ctx.stroke();
      }
    }
  } else if (special === SPECIAL.BOMB) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  } else if (special === SPECIAL.RAINBOW) {
    ctx.globalAlpha = alpha * 0.6;
    const colors = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'];
    colors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      const a = Math.PI * 2 / 6 * i;
      ctx.arc(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

function drawGrid() {
  // Grid background
  ctx.fillStyle = '#12121e';
  ctx.fillRect(gridX - 4, gridY - 4, cellSize * COLS + 8, cellSize * ROWS + 8);

  // Grid lines
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(gridX, gridY + r * cellSize);
    ctx.lineTo(gridX + COLS * cellSize, gridY + r * cellSize);
    ctx.stroke();
  }
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(gridX + c * cellSize, gridY);
    ctx.lineTo(gridX + c * cellSize, gridY + ROWS * cellSize);
    ctx.stroke();
  }

  // Selection highlight
  if (selected && !inputLocked) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(gridX + selected.c * cellSize + 2, gridY + selected.r * cellSize + 2, cellSize - 4, cellSize - 4);
  }

  // Draw gems
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const gem = grid[r][c];
      if (!gem) continue;

      let cx = gridX + c * cellSize + cellSize / 2;
      let cy = gridY + r * cellSize + cellSize / 2 + gem.offsetY;

      // Animate offset towards 0
      if (gem.offsetY !== 0) {
        // handled in update
      }

      // Skip gems currently being swapped — draw them separately
      if (swapping) {
        if ((r === swapping.r1 && c === swapping.c1) || (r === swapping.r2 && c === swapping.c2)) continue;
      }

      drawGem(cx, cy, cellSize, gem.type, gem.special, gem.alpha, gem.scale);
    }
  }

  // Draw swapping gems
  if (swapping) {
    const { r1, c1, r2, c2, t, dur } = swapping;
    const p = Math.min(t / dur, 1);
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

    const x1 = gridX + c1 * cellSize + cellSize / 2;
    const y1 = gridY + r1 * cellSize + cellSize / 2;
    const x2 = gridX + c2 * cellSize + cellSize / 2;
    const y2 = gridY + r2 * cellSize + cellSize / 2;

    const gem1 = grid[r1][c1];
    const gem2 = grid[r2][c2];

    if (gem1) drawGem(x1 + (x2 - x1) * ease, y1 + (y2 - y1) * ease, cellSize, gem1.type, gem1.special, 1, 1);
    if (gem2) drawGem(x2 + (x1 - x2) * ease, y2 + (y1 - y2) * ease, cellSize, gem2.type, gem2.special, 1, 1);
  }
}

function drawHUD() {
  const panelLeft = gridX - 180;
  const panelRight = gridX + COLS * cellSize + 20;

  // Score panel (left side if space, otherwise top)
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Courier New';
  ctx.textAlign = 'left';

  const topY = gridY - 40;
  ctx.fillStyle = '#00d2ff';
  ctx.font = 'bold 14px Courier New';
  ctx.fillText('SCORE', gridX, topY - 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Courier New';
  ctx.fillText(score.toLocaleString(), gridX, topY + 10);

  // Level
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 14px Courier New';
  ctx.fillText('LVL ' + level, gridX + 200, topY - 16);
  ctx.fillStyle = '#888';
  ctx.font = '12px Courier New';
  ctx.fillText(gemTypesForLevel(level) + ' gem types', gridX + 200, topY + 6);

  // Timer
  const timerX = gridX + COLS * cellSize;
  ctx.textAlign = 'right';
  ctx.fillStyle = timer <= 15 ? '#ff4040' : '#fff';
  ctx.font = 'bold 28px Courier New';
  const mins = Math.floor(timer / 60);
  const secs = Math.floor(timer % 60);
  ctx.fillText(mins + ':' + (secs < 10 ? '0' : '') + secs, timerX, topY + 10);
  ctx.fillStyle = timer <= 15 ? '#ff4040' : '#00d2ff';
  ctx.font = 'bold 14px Courier New';
  ctx.fillText('TIME', timerX, topY - 16);

  // Combo display
  if (comboTimer > 0 && combo > 1) {
    const comboAlpha = Math.min(comboTimer / 0.3, 1);
    const comboScale = 1 + Math.sin(comboTimer * 8) * 0.1;
    ctx.save();
    ctx.globalAlpha = comboAlpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = combo >= 10 ? '#ff4040' : combo >= 5 ? '#ffd700' : '#00d2ff';
    ctx.font = `bold ${Math.floor(36 * comboScale)}px Courier New`;
    ctx.fillText(combo + 'x COMBO!', W / 2, gridY + ROWS * cellSize + 50);
    ctx.restore();
  }

  // Character portrait
  drawCharacterPortrait();
}

function drawCharacterPortrait() {
  const size = 80;
  const px = gridX + COLS * cellSize + 30;
  const py = gridY + 20;

  if (px + size > W - 10) return; // Not enough space

  // Frame
  ctx.strokeStyle = GEM_TYPES[currentCharIdx].color;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, size, size);
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);

  // Sprite
  const img = spriteImages[currentCharIdx];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px + 2, py + 2, size - 4, size - 4);
    ctx.clip();

    // Scale/shake based on reaction
    let sx = 1, sy = 1, ox = 0, oy = 0;
    if (charReaction === 1) {
      sy = 1 + Math.sin(Date.now() * 0.01) * 0.05;
    } else if (charReaction === 2) {
      ox = Math.sin(Date.now() * 0.02) * 3;
      sx = 1 + Math.sin(Date.now() * 0.015) * 0.08;
      sy = 1 + Math.cos(Date.now() * 0.015) * 0.08;
    }

    const imgAspect = img.naturalWidth / img.naturalHeight;
    let dw = size - 4, dh = size - 4;
    // Use a square crop from the sprite
    const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0, srcSize, srcSize,
      px + 2 + ox + (1 - sx) * dw / 2, py + 2 + oy + (1 - sy) * dh / 2,
      dw * sx, dh * sy);
    ctx.restore();
  } else {
    // Fallback: colored square with initial
    ctx.fillStyle = GEM_TYPES[currentCharIdx].color + '40';
    ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
    ctx.fillStyle = GEM_TYPES[currentCharIdx].color;
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(GEM_TYPES[currentCharIdx].char[0], px + size / 2, py + size / 2 + 8);
  }

  // Character name
  ctx.fillStyle = GEM_TYPES[currentCharIdx].color;
  ctx.font = '10px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(GEM_TYPES[currentCharIdx].char, px + size / 2, py + size + 14);

  // Gems cleared count
  ctx.fillStyle = '#888';
  ctx.font = '11px Courier New';
  ctx.fillText('Gems: ' + gemsCleared, px + size / 2, py + size + 30);
  ctx.fillText('Max: ' + maxCombo + 'x', px + size / 2, py + size + 44);
}

function drawParticles() {
  particles.forEach(p => {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
  floatingTexts.forEach(ft => {
    const a = ft.life / ft.maxLife;
    const yOff = (1 - a) * 60;
    ctx.globalAlpha = a;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y - yOff);
  });
  ctx.globalAlpha = 1;
}

// --- TITLE SCREEN ---
function drawTitle(dt) {
  titlePhase += dt;

  // Fractal background
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Animated fractal-like pattern
  const time = titlePhase;
  for (let i = 0; i < 60; i++) {
    const t = i / 60;
    const angle = t * Math.PI * 2 + time * 0.5;
    const r1 = 100 + Math.sin(time + t * 4) * 80;
    const x = W / 2 + Math.cos(angle) * r1;
    const y = H / 2 + Math.sin(angle) * r1;
    const size = 3 + Math.sin(time * 2 + t * 8) * 2;
    const colorIdx = Math.floor(t * 6) % 6;
    ctx.fillStyle = GEM_TYPES[colorIdx].color + '40';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Outer ring
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const angle = t * Math.PI * 2 - time * 0.3;
    const r1 = 180 + Math.sin(time * 0.7 + t * 6) * 40;
    const x = W / 2 + Math.cos(angle) * r1;
    const y = H / 2 + Math.sin(angle) * r1;
    const size = 2 + Math.sin(time * 1.5 + t * 10) * 1.5;
    const colorIdx = Math.floor(t * 6 + 3) % 6;
    ctx.fillStyle = GEM_TYPES[colorIdx].color + '30';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px Courier New';
  const titleGlow = 0.6 + Math.sin(time * 2) * 0.4;
  ctx.shadowColor = '#00d2ff';
  ctx.shadowBlur = 20 * titleGlow;
  ctx.fillText('FRACTAL CRUSH', W / 2, H / 2 - 40);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = '#888';
  ctx.font = '16px Courier New';
  ctx.fillText('Guinea Pig Trench Portal', W / 2, H / 2);

  // Prompt
  const blink = Math.sin(time * 3) > 0;
  if (blink) {
    ctx.fillStyle = '#00d2ff';
    ctx.font = '18px Courier New';
    ctx.fillText('[ CLICK TO START ]', W / 2, H / 2 + 60);
  }

  // Draw sample gems
  const gemY = H / 2 + 120;
  for (let i = 0; i < 6; i++) {
    const gx = W / 2 + (i - 2.5) * 60;
    const bounce = Math.sin(time * 2 + i * 0.5) * 8;
    drawGem(gx, gemY + bounce, 40, i, SPECIAL.NONE, 1, 1);
  }
}

// --- GAME OVER ---
function drawGameOver() {
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  ctx.fillStyle = '#ff4040';
  ctx.font = 'bold 48px Courier New';
  ctx.fillText('TIME UP!', W / 2, H / 2 - 120);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px Courier New';
  ctx.fillText('Final Score', W / 2, H / 2 - 60);
  ctx.font = 'bold 42px Courier New';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(score.toLocaleString(), W / 2, H / 2 - 20);

  ctx.fillStyle = '#888';
  ctx.font = '16px Courier New';
  ctx.fillText('Max Combo: ' + maxCombo + 'x', W / 2, H / 2 + 30);
  ctx.fillText('Gems Cleared: ' + gemsCleared, W / 2, H / 2 + 55);
  ctx.fillText('Level Reached: ' + level, W / 2, H / 2 + 80);

  // Grade
  let grade = 'D';
  if (score >= 10000) grade = 'S';
  else if (score >= 7000) grade = 'A';
  else if (score >= 4000) grade = 'B';
  else if (score >= 2000) grade = 'C';

  const gradeColors = { S: '#ffd700', A: '#00d2ff', B: '#40c060', C: '#ff8c00', D: '#888' };
  ctx.fillStyle = gradeColors[grade];
  ctx.font = 'bold 64px Courier New';
  ctx.fillText(grade, W / 2, H / 2 + 160);
  ctx.fillStyle = '#888';
  ctx.font = '14px Courier New';
  ctx.fillText('GRADE', W / 2, H / 2 + 180);

  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.fillStyle = '#00d2ff';
    ctx.font = '16px Courier New';
    ctx.fillText('[ CLICK TO CONTINUE ]', W / 2, H / 2 + 220);
  }
}

// --- UPDATE ---
function update(dt) {
  // Update particles
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 4 * dt;
    p.life -= dt;
  });
  particles = particles.filter(p => p.life > 0);

  // Update floating texts
  floatingTexts.forEach(ft => { ft.life -= dt; });
  floatingTexts = floatingTexts.filter(ft => ft.life > 0);

  // Screen shake decay
  if (shakeAmount > 0) shakeAmount *= 0.9;
  if (shakeAmount < 0.5) shakeAmount = 0;

  // Combo timer
  if (comboTimer > 0) comboTimer -= dt;

  // Character reaction timer
  if (charReactionTimer > 0) {
    charReactionTimer -= dt;
    if (charReactionTimer <= 0) charReaction = 0;
  }

  if (state === 'playing') {
    timer -= dt;
    if (timer <= 0) {
      timer = 0;
      state = 'gameover';
      return;
    }

    // Update swap animation
    if (swapping) {
      swapping.t += dt * 1000;
      if (swapping.t >= swapping.dur) {
        completeSwap();
      }
    }

    // Update gem gravity offsets
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const gem = grid[r][c];
        if (gem && gem.offsetY !== 0) {
          if (gem.offsetY < 0) {
            gem.offsetY += DROP_SPEED * cellSize * dt;
            if (gem.offsetY > 0) gem.offsetY = 0;
          } else {
            gem.offsetY -= DROP_SPEED * cellSize * dt;
            if (gem.offsetY < 0) gem.offsetY = 0;
          }
        }
      }
    }
  }
}

// --- MAIN LOOP ---
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);

  // Clear
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  if (state === 'title') {
    drawTitle(dt);
  } else if (state === 'playing') {
    ctx.save();
    if (shakeAmount > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shakeAmount,
        (Math.random() - 0.5) * shakeAmount
      );
    }
    drawGrid();
    drawParticles();
    drawFloatingTexts();
    drawHUD();
    ctx.restore();
  } else if (state === 'gameover') {
    ctx.save();
    drawGrid();
    ctx.restore();
    drawGameOver();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => { lastTime = t; loop(t); });



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
  var hbPeriod = 0.6793178281407093;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.019083613983494455;mix-blend-mode:overlay';
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
