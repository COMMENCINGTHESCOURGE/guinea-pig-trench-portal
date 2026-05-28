// ===== TRENCH CRUSH — Candy Crush-style puzzle game =====
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');

// --- CONSTANTS ---
const COLS = 9, ROWS = 9;
const SWAP_DUR = 200, CLEAR_DUR = 350, DROP_SPEED = 14;
const HINT_DELAY = 5000;
const SPECIAL = { NONE: 0, STRIPED_H: 1, STRIPED_V: 2, WRAPPED: 3, COLOR_BOMB: 4 };

const CANDY_DEFS = [
  { name: 'Teal Orb',    color: '#00d2ff', glow: '#006688', accent: '#80efff', char: 'Geometric Core' },
  { name: 'Pink Heart',   color: '#ff60a0', glow: '#882040', accent: '#ffb0d0', char: 'Dim Mak' },
  { name: 'Gold Star',    color: '#ffd700', glow: '#886800', accent: '#ffef80', char: 'Defender' },
  { name: 'Purple Moon',  color: '#9050ff', glow: '#402080', accent: '#c8a0ff', char: 'Mecha' },
  { name: 'Green Drop',   color: '#40d870', glow: '#1a6830', accent: '#a0f0b0', char: 'Kraken' },
  { name: 'Red Flame',    color: '#ff4444', glow: '#881818', accent: '#ff9090', char: 'Aku Aku' }
];

const SPRITE_FILES = [
  '../assets/sprites/armored_defender_sprite_sheet.png',
  '../assets/sprites/dim_mak_fighter_full_sheet.png',
  '../assets/sprites/kraken_game_render.png',
  '../assets/sprites/aku_aku_mask_stylized.png',
  '../assets/sprites/geometric_core_geode_flux.png',
  '../assets/sprites/mecha_entity_alpha_v2_pixel.png'
];

const CHAR_FOR_WORLD = [0, 1, 2, 3]; // defender, dimmak, kraken, akuaku

// --- LEVELS ---
function generateLevels() {
  const levels = [];
  for (let i = 0; i < 20; i++) {
    const l = { id: i + 1 };
    if (i < 5) {
      l.candyTypes = 5; l.moves = 25; l.target = 800 + i * 300;
    } else if (i < 10) {
      l.candyTypes = 6; l.moves = 22; l.target = 2500 + (i - 5) * 500;
    } else if (i < 15) {
      l.candyTypes = 6; l.moves = 20; l.target = 5000 + (i - 10) * 700;
      l.iceCount = 6 + (i - 10) * 2;
    } else {
      l.candyTypes = 6; l.moves = 18; l.target = 8000 + (i - 15) * 1000;
      l.iceCount = 8 + (i - 15) * 2;
      l.chocolate = 2 + Math.floor((i - 15) * 1.5);
    }
    levels.push(l);
  }
  return levels;
}
const LEVELS = generateLevels();

// --- STATE ---
let W, H, cellSize, gridX, gridY;
let state = 'map'; // map, playing, levelComplete, levelFailed
let grid = [], iceGrid = [], chocoGrid = [];
let currentLevel = 0, movesLeft = 0, score = 0, combo = 0;
let selected = null, swapping = null;
let clearing = [], dropping = false, inputLocked = false, isCascading = false;
let particles = [], floatingTexts = [], popupTexts = [];
let hintTimer = 0, hintMove = null;
let noMovesShuffling = false;
let spriteImages = [], spritesLoaded = 0;
let charReaction = 0, charReactionTimer = 0;
let starAnim = 0;
let levelStars = {}; // saved progress
let scrollY = 0, targetScrollY = 0;
let lastTime = 0;
let cascadeCount = 0;
let boardSettled = false;

// Load saved progress
try {
  const saved = localStorage.getItem('trenchCrush_progress');
  if (saved) levelStars = JSON.parse(saved);
} catch(e) {}

function saveProgress() {
  try { localStorage.setItem('trenchCrush_progress', JSON.stringify(levelStars)); } catch(e) {}
}

// --- RESIZE ---
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  const maxGrid = Math.min(W * 0.55, H * 0.78);
  cellSize = Math.floor(maxGrid / COLS);
  gridX = Math.floor((W - cellSize * COLS) / 2);
  gridY = Math.floor((H - cellSize * ROWS) / 2) + 40;
}
resize();
window.addEventListener('resize', resize);

// --- LOAD SPRITES ---
SPRITE_FILES.forEach((src, i) => {
  const img = new Image();
  img.onload = () => spritesLoaded++;
  img.onerror = () => spritesLoaded++;
  img.src = src;
  spriteImages[i] = img;
});

// --- CELL CLASS ---
function makeCandy(type, special = SPECIAL.NONE) {
  return { type, special, offsetX: 0, offsetY: 0, scale: 1, alpha: 1 };
}

// --- GRID INIT ---
function initGrid(levelDef) {
  grid = [];
  iceGrid = [];
  chocoGrid = [];
  for (let r = 0; r < ROWS; r++) {
    grid[r] = [];
    iceGrid[r] = [];
    chocoGrid[r] = [];
    for (let c = 0; c < COLS; c++) {
      iceGrid[r][c] = 0;
      chocoGrid[r][c] = false;
      let t;
      do { t = Math.floor(Math.random() * levelDef.candyTypes); }
      while (wouldMatch(r, c, t));
      grid[r][c] = makeCandy(t);
    }
  }
  // Place ice
  if (levelDef.iceCount) {
    let placed = 0;
    const attempts = 200;
    for (let a = 0; a < attempts && placed < levelDef.iceCount; a++) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (iceGrid[r][c] === 0) { iceGrid[r][c] = 2; placed++; }
    }
  }
  // Place chocolate
  if (levelDef.chocolate) {
    let placed = 0;
    const attempts = 200;
    for (let a = 0; a < attempts && placed < levelDef.chocolate; a++) {
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (!chocoGrid[r][c] && iceGrid[r][c] === 0) {
        chocoGrid[r][c] = true;
        grid[r][c] = null;
        placed++;
      }
    }
  }
}

function wouldMatch(r, c, type) {
  // Check left
  if (c >= 2 && grid[r][c-1] && grid[r][c-2] &&
      grid[r][c-1].type === type && grid[r][c-2].type === type) return true;
  // Check up
  if (r >= 2 && grid[r-1] && grid[r-2] && grid[r-1][c] && grid[r-2][c] &&
      grid[r-1][c].type === type && grid[r-2][c].type === type) return true;
  return false;
}

// --- MATCH DETECTION ---
function findMatches() {
  const matched = [];
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let run = 1;
    for (let c = 1; c <= COLS; c++) {
      if (c < COLS && grid[r][c] && grid[r][c-1] &&
          !chocoGrid[r][c] && !chocoGrid[r][c-1] &&
          grid[r][c].type === grid[r][c-1].type) {
        run++;
      } else {
        if (run >= 3) {
          const cells = [];
          for (let k = c - run; k < c; k++) cells.push({r, c: k});
          matched.push({ cells, dir: 'h', length: run });
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
          !chocoGrid[r][c] && !chocoGrid[r-1][c] &&
          grid[r][c].type === grid[r-1][c].type) {
        run++;
      } else {
        if (run >= 3) {
          const cells = [];
          for (let k = r - run; k < r; k++) cells.push({r: k, c});
          matched.push({ cells, dir: 'v', length: run });
        }
        run = 1;
      }
    }
  }
  return matched;
}

function detectSpecials(matches) {
  // Build a set of all matched cells and group overlapping matches
  const cellKey = (r,c) => r * COLS + c;
  const allCells = new Map();
  const results = []; // {cells, special, type, spawnR, spawnC}

  // Find intersections (L/T shapes)
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      if (matches[i].cells[0] && matches[j].cells[0] &&
          grid[matches[i].cells[0].r] && grid[matches[j].cells[0].r] &&
          grid[matches[i].cells[0].r][matches[i].cells[0].c] &&
          grid[matches[j].cells[0].r][matches[j].cells[0].c] &&
          grid[matches[i].cells[0].r][matches[i].cells[0].c].type ===
          grid[matches[j].cells[0].r][matches[j].cells[0].c].type) {
        // Check intersection
        for (const a of matches[i].cells) {
          for (const b of matches[j].cells) {
            if (a.r === b.r && a.c === b.c && matches[i].dir !== matches[j].dir) {
              // L or T shape → wrapped
              const combined = new Set();
              matches[i].cells.forEach(x => combined.add(cellKey(x.r, x.c)));
              matches[j].cells.forEach(x => combined.add(cellKey(x.r, x.c)));
              const allC = [...combined].map(k => ({r: Math.floor(k / COLS), c: k % COLS}));
              results.push({
                cells: allC,
                special: SPECIAL.WRAPPED,
                type: grid[a.r][a.c].type,
                spawnR: a.r, spawnC: a.c,
                matchIdxs: [i, j]
              });
            }
          }
        }
      }
    }
  }

  // Mark which matches were consumed by L/T
  const consumed = new Set();
  results.forEach(r => r.matchIdxs && r.matchIdxs.forEach(i => consumed.add(i)));

  // Remaining matches
  for (let i = 0; i < matches.length; i++) {
    if (consumed.has(i)) continue;
    const m = matches[i];
    if (m.length >= 5) {
      results.push({
        cells: m.cells,
        special: SPECIAL.COLOR_BOMB,
        type: grid[m.cells[0].r][m.cells[0].c] ? grid[m.cells[0].r][m.cells[0].c].type : 0,
        spawnR: m.cells[2].r, spawnC: m.cells[2].c
      });
    } else if (m.length === 4) {
      const sp = m.dir === 'h' ? SPECIAL.STRIPED_V : SPECIAL.STRIPED_H;
      results.push({
        cells: m.cells,
        special: sp,
        type: grid[m.cells[0].r][m.cells[0].c] ? grid[m.cells[0].r][m.cells[0].c].type : 0,
        spawnR: m.cells[1].r, spawnC: m.cells[1].c
      });
    } else {
      results.push({ cells: m.cells, special: SPECIAL.NONE, type: -1 });
    }
  }
  return results;
}

// --- SPECIAL ACTIVATIONS ---
function activateSpecial(r, c, candy, toClear) {
  if (!candy) return;
  const key = (rr, cc) => rr * COLS + cc;
  if (candy.special === SPECIAL.STRIPED_H) {
    for (let cc = 0; cc < COLS; cc++) toClear.add(key(r, cc));
    spawnParticleLine(r, 0, r, COLS - 1, CANDY_DEFS[candy.type].color);
  } else if (candy.special === SPECIAL.STRIPED_V) {
    for (let rr = 0; rr < ROWS; rr++) toClear.add(key(rr, c));
    spawnParticleLine(0, c, ROWS - 1, c, CANDY_DEFS[candy.type].color);
  } else if (candy.special === SPECIAL.WRAPPED) {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) toClear.add(key(rr, cc));
      }
    spawnExplosion(r, c, CANDY_DEFS[candy.type].color, 20);
  } else if (candy.special === SPECIAL.COLOR_BOMB) {
    // Handled separately during swap
  }
}

function activateColorBomb(bombR, bombC, targetType) {
  const toClear = new Set();
  const key = (r, c) => r * COLS + c;
  toClear.add(key(bombR, bombC));
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] && grid[r][c].type === targetType && !chocoGrid[r][c])
        toClear.add(key(r, c));
  return toClear;
}

function handleSpecialSwap(r1, c1, r2, c2) {
  const a = grid[r1][c1], b = grid[r2][c2];
  if (!a || !b) return null;
  const key = (r, c) => r * COLS + c;
  const toClear = new Set();

  // Two color bombs = clear everything
  if (a.special === SPECIAL.COLOR_BOMB && b.special === SPECIAL.COLOR_BOMB) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && !chocoGrid[r][c]) toClear.add(key(r, c));
    spawnExplosion(4, 4, '#ffffff', 60);
    addPopup('MEGA CRUSH!', W / 2, H / 2, '#ffd700', 48);
    return toClear;
  }

  // Color bomb + other special
  if (a.special === SPECIAL.COLOR_BOMB && b.special !== SPECIAL.NONE) {
    // Turn all of b's type into that special
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && grid[r][c].type === b.type) {
          toClear.add(key(r, c));
          activateSpecial(r, c, {...grid[r][c], special: b.special}, toClear);
        }
    toClear.add(key(r1, c1));
    return toClear;
  }
  if (b.special === SPECIAL.COLOR_BOMB && a.special !== SPECIAL.NONE) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && grid[r][c].type === a.type) {
          toClear.add(key(r, c));
          activateSpecial(r, c, {...grid[r][c], special: a.special}, toClear);
        }
    toClear.add(key(r2, c2));
    return toClear;
  }

  // Color bomb + normal
  if (a.special === SPECIAL.COLOR_BOMB) {
    return activateColorBomb(r1, c1, b.type);
  }
  if (b.special === SPECIAL.COLOR_BOMB) {
    return activateColorBomb(r2, c2, a.type);
  }

  // Two stripes = cross clear
  const isStripe = s => s === SPECIAL.STRIPED_H || s === SPECIAL.STRIPED_V;
  if (isStripe(a.special) && isStripe(b.special)) {
    for (let cc = 0; cc < COLS; cc++) toClear.add(key(r1, cc));
    for (let rr = 0; rr < ROWS; rr++) toClear.add(key(rr, c1));
    for (let cc = 0; cc < COLS; cc++) toClear.add(key(r2, cc));
    for (let rr = 0; rr < ROWS; rr++) toClear.add(key(rr, c2));
    return toClear;
  }

  // Wrapped + stripe = 3-row/col clear
  const isWrapped = s => s === SPECIAL.WRAPPED;
  if ((isWrapped(a.special) && isStripe(b.special)) || (isStripe(a.special) && isWrapped(b.special))) {
    const cr = Math.floor((r1 + r2) / 2), cc = Math.floor((c1 + c2) / 2);
    for (let dr = -1; dr <= 1; dr++)
      for (let c = 0; c < COLS; c++) {
        const rr = cr + dr;
        if (rr >= 0 && rr < ROWS) toClear.add(key(rr, c));
      }
    for (let dc = -1; dc <= 1; dc++)
      for (let r = 0; r < ROWS; r++) {
        const ccc = cc + dc;
        if (ccc >= 0 && ccc < COLS) toClear.add(key(r, ccc));
      }
    return toClear;
  }

  // Two wrapped = big explosion
  if (isWrapped(a.special) && isWrapped(b.special)) {
    const cr = Math.floor((r1 + r2) / 2), cc = Math.floor((c1 + c2) / 2);
    for (let dr = -2; dr <= 2; dr++)
      for (let dc = -2; dc <= 2; dc++) {
        const rr = cr + dr, ccc = cc + dc;
        if (rr >= 0 && rr < ROWS && ccc >= 0 && ccc < COLS) toClear.add(key(rr, ccc));
      }
    spawnExplosion(cr, cc, '#ffffff', 40);
    return toClear;
  }

  return null; // no special-special interaction
}

// --- CLEARING ---
function processMatches() {
  const matches = findMatches();
  if (matches.length === 0) return false;

  combo++;
  cascadeCount++;
  const specials = detectSpecials(matches);
  const key = (r, c) => r * COLS + c;
  const toClear = new Set();
  const specialSpawns = [];

  for (const s of specials) {
    for (const cell of s.cells) {
      toClear.add(key(cell.r, cell.c));
      // Activate any existing specials being cleared
      if (grid[cell.r][cell.c] && grid[cell.r][cell.c].special !== SPECIAL.NONE) {
        activateSpecial(cell.r, cell.c, grid[cell.r][cell.c], toClear);
      }
    }
    if (s.special !== SPECIAL.NONE) {
      specialSpawns.push(s);
    }
  }

  // Score
  const baseScore = toClear.size * 10;
  const multiplier = Math.min(combo, 10);
  const pts = baseScore * multiplier;
  score += pts;

  // Popup text
  if (cascadeCount >= 3) addPopup('Divine!', W/2, gridY - 30, '#ffd700', 36);
  else if (cascadeCount >= 2) addPopup('Tasty!', W/2, gridY - 30, '#ff60a0', 30);
  else if (toClear.size >= 5) addPopup('Sweet!', W/2, gridY - 30, '#00d2ff', 28);

  if (combo > 1) {
    addPopup(`x${multiplier}`, W/2 + 60, gridY - 10, '#ffd700', 22);
    charReaction = Math.min(2, combo - 1);
    charReactionTimer = 1.5;
  }

  // Clear cells and spawn particles
  for (const k of toClear) {
    const r = Math.floor(k / COLS), c = k % COLS;
    if (grid[r][c]) {
      const cd = CANDY_DEFS[grid[r][c].type];
      spawnExplosion(r, c, cd ? cd.color : '#fff', 8);
      // Break ice
      if (iceGrid[r][c] > 0) {
        iceGrid[r][c]--;
        if (iceGrid[r][c] === 0) spawnExplosion(r, c, '#aaddff', 6);
      }
    }
    // Clear chocolate
    if (chocoGrid[r][c]) {
      chocoGrid[r][c] = false;
      spawnExplosion(r, c, '#8B4513', 10);
    }
    grid[r][c] = null;
  }

  // Spawn special candies
  for (const s of specialSpawns) {
    if (s.spawnR !== undefined && s.spawnC !== undefined) {
      grid[s.spawnR][s.spawnC] = makeCandy(s.type, s.special);
    }
  }

  return true;
}

// --- GRAVITY ---
function applyGravity() {
  let moved = false;
  const levelDef = LEVELS[currentLevel];
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (chocoGrid[r][c]) {
        writeRow = r - 1;
        continue;
      }
      if (grid[r][c]) {
        if (r !== writeRow) {
          grid[writeRow][c] = grid[r][c];
          grid[writeRow][c].offsetY = (r - writeRow) * cellSize;
          grid[r][c] = null;
          moved = true;
        }
        writeRow--;
      }
    }
    // Fill empty cells from top
    for (let r = writeRow; r >= 0; r--) {
      if (!chocoGrid[r][c]) {
        grid[r][c] = makeCandy(Math.floor(Math.random() * levelDef.candyTypes));
        grid[r][c].offsetY = -(writeRow - r + 2) * cellSize;
        moved = true;
      }
    }
  }
  return moved;
}

// --- VALID MOVES ---
function findValidMoves() {
  const moves = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!grid[r][c] || chocoGrid[r][c]) continue;
      // Try swap right
      if (c + 1 < COLS && grid[r][c+1] && !chocoGrid[r][c+1]) {
        swap(r, c, r, c+1);
        if (findMatches().length > 0 || checkSpecialSwapValid(r, c, r, c+1)) moves.push({r1:r,c1:c,r2:r,c2:c+1});
        swap(r, c, r, c+1);
      }
      // Try swap down
      if (r + 1 < ROWS && grid[r+1][c] && !chocoGrid[r+1][c]) {
        swap(r, c, r+1, c);
        if (findMatches().length > 0 || checkSpecialSwapValid(r, c, r+1, c)) moves.push({r1:r,c1:c,r2:r+1,c2:c});
        swap(r, c, r+1, c);
      }
    }
  }
  return moves;
}

function checkSpecialSwapValid(r1, c1, r2, c2) {
  // Re-swap back for checking since we already swapped
  const a = grid[r1][c1], b = grid[r2][c2];
  if (!a || !b) return false;
  if (a.special === SPECIAL.COLOR_BOMB || b.special === SPECIAL.COLOR_BOMB) return true;
  if (a.special !== SPECIAL.NONE && b.special !== SPECIAL.NONE) return true;
  return false;
}

function swap(r1, c1, r2, c2) {
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;
}

function shuffleBoard() {
  const levelDef = LEVELS[currentLevel];
  const candies = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] && !chocoGrid[r][c]) candies.push(grid[r][c]);
  // Fisher-Yates
  for (let i = candies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candies[i], candies[j]] = [candies[j], candies[i]];
  }
  let idx = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] && !chocoGrid[r][c]) grid[r][c] = candies[idx++];
  addPopup('Shuffled!', W/2, H/2, '#00d2ff', 32);
}

// --- CHOCOLATE SPREAD ---
function spreadChocolate() {
  const levelDef = LEVELS[currentLevel];
  if (!levelDef.chocolate) return;
  const newChoco = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (chocoGrid[r][c]) {
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        const shuffled = dirs.sort(() => Math.random() - 0.5);
        for (const [dr, dc] of shuffled) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !chocoGrid[nr][nc] && grid[nr][nc] && iceGrid[nr][nc] === 0) {
            newChoco.push({r: nr, c: nc});
            break;
          }
        }
      }
  // Spread only one per chocolate source
  for (const {r, c} of newChoco) {
    chocoGrid[r][c] = true;
    grid[r][c] = null;
    spawnExplosion(r, c, '#5a2d0c', 4);
  }
}

// --- PARTICLES ---
function spawnExplosion(r, c, color, count) {
  const cx = gridX + c * cellSize + cellSize / 2;
  const cy = gridY + r * cellSize + cellSize / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.4 + Math.random() * 0.4,
      size: 2 + Math.random() * 4,
      color
    });
  }
}

function spawnParticleLine(r1, c1, r2, c2, color) {
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const r = r1 + (r2 - r1) * t;
    const c = c1 + (c2 - c1) * t;
    const cx = gridX + c * cellSize + cellSize / 2;
    const cy = gridY + r * cellSize + cellSize / 2;
    particles.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 60,
      vy: (Math.random() - 0.5) * 60,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.5,
      size: 3 + Math.random() * 3,
      color
    });
  }
}

function addPopup(text, x, y, color, size) {
  popupTexts.push({ text, x, y, color, size, life: 1.5, maxLife: 1.5 });
}

// --- DRAWING ---
function drawCandy(cx, cy, size, candy) {
  if (!candy) return;
  const def = CANDY_DEFS[candy.type];
  const s = size * 0.4 * candy.scale;
  ctx.globalAlpha = candy.alpha;

  // Draw shape based on type
  switch (candy.type) {
    case 0: drawOrb(cx, cy, s, def); break;
    case 1: drawHeart(cx, cy, s, def); break;
    case 2: drawStar(cx, cy, s, def); break;
    case 3: drawMoon(cx, cy, s, def); break;
    case 4: drawDrop(cx, cy, s, def); break;
    case 5: drawFlame(cx, cy, s, def); break;
  }

  // Special overlay
  if (candy.special === SPECIAL.STRIPED_H) {
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - s, cy + i * 3);
      ctx.lineTo(cx + s, cy + i * 3);
      ctx.stroke();
    }
  } else if (candy.special === SPECIAL.STRIPED_V) {
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 3, cy - s);
      ctx.lineTo(cx + i * 3, cy + s);
      ctx.stroke();
    }
  } else if (candy.special === SPECIAL.WRAPPED) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff66';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.05, 0, Math.PI * 2);
    ctx.stroke();
  } else if (candy.special === SPECIAL.COLOR_BOMB) {
    // Swirl rainbow
    const t = performance.now() / 500;
    for (let i = 0; i < 6; i++) {
      const a = t + i * Math.PI / 3;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s);
      grad.addColorStop(0, CANDY_DEFS[i].color + '44');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3, s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawOrb(cx, cy, s, def) {
  const grad = ctx.createRadialGradient(cx - s * 0.3, cy - s * 0.3, 0, cx, cy, s);
  grad.addColorStop(0, def.accent);
  grad.addColorStop(0.5, def.color);
  grad.addColorStop(1, def.glow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#ffffff44';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.2, cy - s * 0.3, s * 0.35, s * 0.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeart(cx, cy, s, def) {
  const grad = ctx.createRadialGradient(cx, cy - s * 0.2, 0, cx, cy, s * 1.2);
  grad.addColorStop(0, def.accent);
  grad.addColorStop(0.5, def.color);
  grad.addColorStop(1, def.glow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  const topY = cy - s * 0.5;
  ctx.moveTo(cx, cy + s * 0.7);
  ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.7, topY - s * 0.5, cx, topY + s * 0.1);
  ctx.bezierCurveTo(cx + s * 0.7, topY - s * 0.5, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.7);
  ctx.fill();
  ctx.fillStyle = '#ffffff33';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.3, cy - s * 0.3, s * 0.2, s * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawStar(cx, cy, s, def) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s);
  grad.addColorStop(0, def.accent);
  grad.addColorStop(0.6, def.color);
  grad.addColorStop(1, def.glow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = (i * 2 * Math.PI / 5) - Math.PI / 2;
    const a2 = a1 + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(a1) * s, cy + Math.sin(a1) * s);
    ctx.lineTo(cx + Math.cos(a2) * s * 0.45, cy + Math.sin(a2) * s * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff33';
  ctx.beginPath();
  ctx.arc(cx - s * 0.15, cy - s * 0.15, s * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoon(cx, cy, s, def) {
  const grad = ctx.createRadialGradient(cx - s * 0.3, cy, 0, cx, cy, s * 1.2);
  grad.addColorStop(0, def.accent);
  grad.addColorStop(0.5, def.color);
  grad.addColorStop(1, def.glow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0c0818';
  ctx.beginPath();
  ctx.arc(cx + s * 0.4, cy - s * 0.15, s * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff22';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.35, cy - s * 0.2, s * 0.2, s * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrop(cx, cy, s, def) {
  const grad = ctx.createRadialGradient(cx, cy + s * 0.1, 0, cx, cy, s * 1.2);
  grad.addColorStop(0, def.accent);
  grad.addColorStop(0.5, def.color);
  grad.addColorStop(1, def.glow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 0.2, cx + s * 0.8, cy + s * 0.8, cx, cy + s);
  ctx.bezierCurveTo(cx - s * 0.8, cy + s * 0.8, cx - s * 0.8, cy - s * 0.2, cx, cy - s);
  ctx.fill();
  ctx.fillStyle = '#ffffff33';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.2, cy - s * 0.1, s * 0.15, s * 0.25, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlame(cx, cy, s, def) {
  const grad = ctx.createRadialGradient(cx, cy + s * 0.2, 0, cx, cy, s * 1.3);
  grad.addColorStop(0, def.accent);
  grad.addColorStop(0.4, def.color);
  grad.addColorStop(1, def.glow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 1.1);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.5, cx + s * 0.9, cy + s * 0.2, cx + s * 0.5, cy + s * 0.8);
  ctx.quadraticCurveTo(cx, cy + s * 1.1, cx, cy + s * 0.5);
  ctx.quadraticCurveTo(cx, cy + s * 1.1, cx - s * 0.5, cy + s * 0.8);
  ctx.bezierCurveTo(cx - s * 0.9, cy + s * 0.2, cx - s * 0.5, cy - s * 0.5, cx, cy - s * 1.1);
  ctx.fill();
  ctx.fillStyle = '#ffffff33';
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.3, s * 0.15, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawIce(cx, cy, size, hp) {
  ctx.globalAlpha = hp === 2 ? 0.5 : 0.3;
  ctx.fillStyle = '#aaddff';
  ctx.fillRect(cx - size/2 + 2, cy - size/2 + 2, size - 4, size - 4);
  ctx.strokeStyle = '#88bbff';
  ctx.lineWidth = hp === 2 ? 3 : 1.5;
  ctx.strokeRect(cx - size/2 + 2, cy - size/2 + 2, size - 4, size - 4);
  // Crack lines for hp=1
  if (hp === 1) {
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.3, cy - size * 0.2);
    ctx.lineTo(cx + size * 0.1, cy + size * 0.3);
    ctx.moveTo(cx + size * 0.2, cy - size * 0.35);
    ctx.lineTo(cx - size * 0.1, cy + size * 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawChocolate(cx, cy, size) {
  const s = size * 0.45;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, s);
  grad.addColorStop(0, '#8B6914');
  grad.addColorStop(0.6, '#5a2d0c');
  grad.addColorStop(1, '#3a1a06');
  ctx.fillStyle = grad;
  // Blobby shape
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const wobble = 0.85 + 0.15 * Math.sin(i * 3.7 + cx * 0.1);
    const r = s * wobble;
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff22';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.2, cy - s * 0.2, s * 0.25, s * 0.15, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrid() {
  // Grid background
  ctx.fillStyle = '#14102a';
  ctx.fillRect(gridX - 4, gridY - 4, cellSize * COLS + 8, cellSize * ROWS + 8);

  // Grid lines
  ctx.strokeStyle = '#1e1840';
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

  // Draw candies
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = gridX + c * cellSize + cellSize / 2;
      const cy = gridY + r * cellSize + cellSize / 2;

      // Ice layer (behind candy)
      if (iceGrid[r][c] > 0) drawIce(cx, cy, cellSize, iceGrid[r][c]);

      // Chocolate
      if (chocoGrid[r][c]) {
        drawChocolate(cx, cy, cellSize);
        continue;
      }

      const candy = grid[r][c];
      if (!candy) continue;

      const dx = candy.offsetX || 0;
      const dy = candy.offsetY || 0;
      drawCandy(cx + dx, cy + dy, cellSize, candy);
    }
  }

  // Selection highlight
  if (selected && !inputLocked) {
    const sx = gridX + selected.c * cellSize;
    const sy = gridY + selected.r * cellSize;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 2, sy + 2, cellSize - 4, cellSize - 4);
  }

  // Hint highlight
  if (hintMove && !inputLocked) {
    const t = (Math.sin(performance.now() / 300) + 1) / 2;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 + t * 0.4})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(gridX + hintMove.c1 * cellSize + 3, gridY + hintMove.r1 * cellSize + 3, cellSize - 6, cellSize - 6);
    ctx.strokeRect(gridX + hintMove.c2 * cellSize + 3, gridY + hintMove.r2 * cellSize + 3, cellSize - 6, cellSize - 6);
  }
}

function drawHUD() {
  const levelDef = LEVELS[currentLevel];

  // Moves
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MOVES', gridX, gridY - 50);
  ctx.font = 'bold 32px "Segoe UI", sans-serif';
  ctx.fillStyle = movesLeft <= 5 ? '#ff4444' : '#ffffff';
  ctx.fillText(movesLeft.toString(), gridX, gridY - 18);

  // Score
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillText('SCORE', gridX + COLS * cellSize / 2, gridY - 50);
  ctx.font = 'bold 32px "Segoe UI", sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(score.toString(), gridX + COLS * cellSize / 2, gridY - 18);

  // Target
  ctx.textAlign = 'right';
  ctx.fillStyle = '#888';
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText(`Target: ${levelDef.target}`, gridX + COLS * cellSize, gridY - 50);

  // Star thresholds
  const star2 = Math.floor(levelDef.target * 1.5);
  const star3 = levelDef.target * 2;
  ctx.font = '12px "Segoe UI", sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(`★${levelDef.target}  ★★${star2}  ★★★${star3}`, gridX + COLS * cellSize, gridY - 32);

  // Level
  ctx.textAlign = 'right';
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.fillText(`Level ${currentLevel + 1}`, gridX + COLS * cellSize, gridY - 15);

  // Score progress bar
  const barY = gridY + ROWS * cellSize + 15;
  const barW = COLS * cellSize;
  const barH = 8;
  ctx.fillStyle = '#1a1530';
  ctx.fillRect(gridX, barY, barW, barH);
  const progress = Math.min(score / star3, 1);
  const grad = ctx.createLinearGradient(gridX, 0, gridX + barW * progress, 0);
  grad.addColorStop(0, '#ff60a0');
  grad.addColorStop(1, '#ffd700');
  ctx.fillStyle = grad;
  ctx.fillRect(gridX, barY, barW * progress, barH);
  // Star markers on bar
  [1, 1.5, 2].forEach((mult, i) => {
    const x = gridX + (mult / 2) * barW;
    const earned = score >= levelDef.target * mult;
    ctx.fillStyle = earned ? '#ffd700' : '#333';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', x, barY + barH + 15);
  });

  // Character portrait
  drawCharPortrait();
}

function drawCharPortrait() {
  const world = Math.floor(currentLevel / 5);
  const charIdx = CHAR_FOR_WORLD[Math.min(world, 3)];
  const img = spriteImages[charIdx];
  const px = gridX - 80;
  const py = gridY + ROWS * cellSize - 80;
  const ps = 64;

  if (img && img.complete && img.naturalWidth > 0) {
    // Frame
    ctx.fillStyle = '#1a1530';
    ctx.fillRect(px - 4, py - 4, ps + 8, ps + 8);
    ctx.strokeStyle = charReaction > 0 ? '#ffd700' : '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 4, py - 4, ps + 8, ps + 8);

    // Draw sprite (first frame region)
    const sw = Math.min(img.naturalWidth, img.naturalHeight);
    const sh = sw;
    const bounce = charReaction > 0 ? Math.sin(performance.now() / 100) * 3 : 0;
    ctx.drawImage(img, 0, 0, sw, sh, px, py + bounce, ps, ps);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  for (const p of popupTexts) {
    const t = 1 - p.life / p.maxLife;
    ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
    ctx.fillStyle = p.color;
    ctx.font = `bold ${p.size}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(p.text, p.x, p.y - t * 50);
  }
  ctx.globalAlpha = 1;
}

// --- LEVEL MAP ---
function drawMap() {
  ctx.fillStyle = '#0c0818';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 36px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TRENCH CRUSH', W / 2, 60 - scrollY);
  ctx.fillStyle = '#888';
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText('Select a Level', W / 2, 90 - scrollY);

  // World labels
  const worldNames = ['Defender\'s Domain', 'Dim Mak Dojo', 'Kraken\'s Depths', 'Aku Aku\'s Lair'];
  const worldColors = ['#ffd700', '#ff60a0', '#40d870', '#ff4444'];

  // Path and nodes
  const nodeSpacing = 90;
  const startY = 140;

  for (let i = 0; i < 20; i++) {
    const world = Math.floor(i / 5);
    const nodeX = W / 2 + Math.sin(i * 0.8) * 100;
    const nodeY = startY + i * nodeSpacing - scrollY;

    if (nodeY < -50 || nodeY > H + 50) continue;

    // World label at start of each world
    if (i % 5 === 0) {
      ctx.fillStyle = worldColors[world];
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(worldNames[world], W / 2, nodeY - 30);

      // Character sprite
      const cImg = spriteImages[CHAR_FOR_WORLD[world]];
      if (cImg && cImg.complete && cImg.naturalWidth > 0) {
        const sw = Math.min(cImg.naturalWidth, cImg.naturalHeight);
        ctx.drawImage(cImg, 0, 0, sw, sw, W / 2 - 100, nodeY - 55, 40, 40);
      }
    }

    // Path line to next
    if (i < 19) {
      const nextX = W / 2 + Math.sin((i + 1) * 0.8) * 100;
      const nextY = startY + (i + 1) * nodeSpacing - scrollY;
      ctx.strokeStyle = '#1e1840';
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(nodeX, nodeY);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const unlocked = i === 0 || (levelStars[i] !== undefined && levelStars[i] > 0);
    const stars = levelStars[i + 1] || 0;
    const completed = stars > 0;

    // Node circle
    const radius = 28;
    if (unlocked) {
      const grad = ctx.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, radius);
      grad.addColorStop(0, completed ? '#2a2060' : '#1e1840');
      grad.addColorStop(1, completed ? '#14102a' : '#0c0818');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = '#111';
    }
    ctx.beginPath();
    ctx.arc(nodeX, nodeY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = unlocked ? worldColors[world] : '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Level number
    ctx.fillStyle = unlocked ? '#fff' : '#555';
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((i + 1).toString(), nodeX, nodeY + 6);

    // Stars below
    if (completed) {
      ctx.font = '14px "Segoe UI", sans-serif';
      let starStr = '';
      for (let s = 0; s < 3; s++) starStr += s < stars ? '★' : '☆';
      ctx.fillStyle = '#ffd700';
      ctx.fillText(starStr, nodeX, nodeY + 26);
    }

    // Lock icon
    if (!unlocked) {
      ctx.fillStyle = '#555';
      ctx.font = '16px "Segoe UI", sans-serif';
      ctx.fillText('🔒', nodeX, nodeY + 24);
    }
  }

  // Scroll hint
  const totalH = startY + 20 * nodeSpacing;
  if (totalH > H) {
    ctx.fillStyle = '#444';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↕ Scroll to see more levels', W / 2, H - 20);
  }
}

// --- LEVEL COMPLETE / FAIL OVERLAYS ---
function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  const levelDef = LEVELS[currentLevel];
  const stars = getStarCount();

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 42px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Level Complete!', W / 2, H / 2 - 80);

  // Stars
  ctx.font = '48px "Segoe UI", sans-serif';
  let starStr = '';
  for (let i = 0; i < 3; i++) {
    const earned = i < stars;
    const anim = Math.min(starAnim - i * 0.3, 1);
    if (anim > 0 && earned) {
      ctx.fillStyle = '#ffd700';
      const scale = 1 + Math.max(0, 1 - anim) * 0.5;
      ctx.font = `${Math.floor(48 * scale)}px "Segoe UI", sans-serif`;
      ctx.fillText('★', W / 2 - 60 + i * 60, H / 2 - 20);
    } else {
      ctx.fillStyle = '#333';
      ctx.font = '48px "Segoe UI", sans-serif';
      ctx.fillText('☆', W / 2 - 60 + i * 60, H / 2 - 20);
    }
  }

  ctx.fillStyle = '#fff';
  ctx.font = '24px "Segoe UI", sans-serif';
  ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 30);

  // Buttons
  drawButton('Continue', W / 2, H / 2 + 90, 160, 44, '#ffd700', '#000');
}

function drawLevelFailed() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 42px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('No More Moves!', W / 2, H / 2 - 60);

  ctx.fillStyle = '#fff';
  ctx.font = '24px "Segoe UI", sans-serif';
  ctx.fillText(`Score: ${score} / ${LEVELS[currentLevel].target}`, W / 2, H / 2);

  drawButton('Retry', W / 2 - 90, H / 2 + 60, 140, 44, '#ff60a0', '#fff');
  drawButton('Map', W / 2 + 90, H / 2 + 60, 140, 44, '#444', '#fff');
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawButton(text, x, y, w, h, bg, fg) {
  ctx.fillStyle = bg;
  roundedRect(x - w / 2, y - h / 2, w, h, 8);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = 'bold 18px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y + 6);
}

function getStarCount() {
  const t = LEVELS[currentLevel].target;
  if (score >= t * 2) return 3;
  if (score >= t * 1.5) return 2;
  if (score >= t) return 1;
  return 0;
}

// --- UPDATE ---
function update(dt) {
  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Popups
  for (let i = popupTexts.length - 1; i >= 0; i--) {
    popupTexts[i].life -= dt;
    if (popupTexts[i].life <= 0) popupTexts.splice(i, 1);
  }

  // Char reaction
  if (charReactionTimer > 0) {
    charReactionTimer -= dt;
    if (charReactionTimer <= 0) charReaction = 0;
  }

  if (state === 'levelComplete') {
    starAnim += dt * 2;
    return;
  }

  if (state !== 'playing') return;

  // Animate candy offsets (gravity drops)
  let animating = false;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const candy = grid[r][c];
      if (!candy) continue;
      if (Math.abs(candy.offsetY) > 0.5) {
        const decay = Math.pow(0.00001, dt);
        candy.offsetY *= decay;
        if (Math.abs(candy.offsetY) < 0.5) candy.offsetY = 0;
        animating = true;
      }
      if (Math.abs(candy.offsetX) > 0.5) {
        const decay = Math.pow(0.00001, dt);
        candy.offsetX *= decay;
        if (Math.abs(candy.offsetX) < 0.5) candy.offsetX = 0;
        animating = true;
      }
    }
  }

  if (inputLocked) {
    if (!animating) {
      // Check for matches after settling
      if (processMatches()) {
        applyGravity();
        inputLocked = true;
      } else {
        // Board settled
        cascadeCount = 0;
        combo = 0;

        // Check for no valid moves
        const validMoves = findValidMoves();
        if (validMoves.length === 0) {
          shuffleBoard();
          inputLocked = true;
          return;
        }

        isCascading = false;
        inputLocked = false;
        hintTimer = 0;
        hintMove = null;

        // Check win/lose
        if (movesLeft <= 0) {
          if (score >= LEVELS[currentLevel].target) {
            const stars = getStarCount();
            const prev = levelStars[currentLevel + 1] || 0;
            if (stars > prev) levelStars[currentLevel + 1] = stars;
            saveProgress();
            state = 'levelComplete';
            starAnim = 0;
          } else {
            state = 'levelFailed';
          }
        }
      }
    }
  } else {
    // Hint timer
    hintTimer += dt * 1000;
    if (hintTimer >= HINT_DELAY && !hintMove) {
      const moves = findValidMoves();
      if (moves.length > 0) {
        hintMove = moves[Math.floor(Math.random() * moves.length)];
      }
    }
  }
}

// --- INPUT ---
let mouseDown = false, touchId = null;

function getGridPos(px, py) {
  const c = Math.floor((px - gridX) / cellSize);
  const r = Math.floor((py - gridY) / cellSize);
  if (r >= 0 && r < ROWS && c >= 0 && c < COLS) return {r, c};
  return null;
}

function handleClick(px, py) {
  if (state === 'map') {
    handleMapClick(px, py);
    return;
  }

  if (state === 'levelComplete') {
    // Continue button
    if (px > W/2 - 80 && px < W/2 + 80 && py > H/2 + 68 && py < H/2 + 112) {
      state = 'map';
    }
    return;
  }

  if (state === 'levelFailed') {
    // Retry
    if (px > W/2 - 160 && px < W/2 - 20 && py > H/2 + 38 && py < H/2 + 82) {
      startLevel(currentLevel);
    }
    // Map
    if (px > W/2 + 20 && px < W/2 + 160 && py > H/2 + 38 && py < H/2 + 82) {
      state = 'map';
    }
    return;
  }

  if (inputLocked || isCascading) return;

  const pos = getGridPos(px, py);
  if (!pos) { selected = null; return; }
  if (chocoGrid[pos.r][pos.c]) return;
  if (!grid[pos.r][pos.c]) return;

  if (selected) {
    const dr = Math.abs(pos.r - selected.r);
    const dc = Math.abs(pos.c - selected.c);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      trySwap(selected.r, selected.c, pos.r, pos.c);
      selected = null;
    } else {
      selected = pos;
    }
  } else {
    selected = pos;
  }
  hintTimer = 0;
  hintMove = null;
}

function handleMapClick(px, py) {
  const nodeSpacing = 90;
  const startY = 140;
  for (let i = 0; i < 20; i++) {
    const nodeX = W / 2 + Math.sin(i * 0.8) * 100;
    const nodeY = startY + i * nodeSpacing - scrollY;
    const dx = px - nodeX, dy = py - nodeY;
    if (dx * dx + dy * dy < 30 * 30) {
      const unlocked = i === 0 || (levelStars[i] !== undefined && levelStars[i] > 0);
      if (unlocked) {
        startLevel(i);
      }
      return;
    }
  }
}

function trySwap(r1, c1, r2, c2) {
  const a = grid[r1][c1], b = grid[r2][c2];
  if (!a || !b) return;

  // Check special-special swap
  if (a.special !== SPECIAL.NONE && b.special !== SPECIAL.NONE) {
    const specialClear = handleSpecialSwap(r1, c1, r2, c2);
    if (specialClear && specialClear.size > 0) {
      swap(r1, c1, r2, c2);
      movesLeft--;
      inputLocked = true;
      isCascading = true;
      combo = 0;
      cascadeCount = 0;
      const key = (r, c) => r * COLS + c;
      for (const k of specialClear) {
        const r = Math.floor(k / COLS), c = k % COLS;
        if (grid[r][c]) {
          const cd = CANDY_DEFS[grid[r][c].type];
          spawnExplosion(r, c, cd ? cd.color : '#fff', 8);
          if (iceGrid[r][c] > 0) iceGrid[r][c]--;
        }
        if (chocoGrid[r][c]) { chocoGrid[r][c] = false; }
        grid[r][c] = null;
      }
      score += specialClear.size * 20;
      applyGravity();
      spreadChocolate();
      return;
    }
  }

  // Color bomb swap with normal
  if (a.special === SPECIAL.COLOR_BOMB || b.special === SPECIAL.COLOR_BOMB) {
    const bombR = a.special === SPECIAL.COLOR_BOMB ? r1 : r2;
    const bombC = a.special === SPECIAL.COLOR_BOMB ? c1 : c2;
    const targetType = a.special === SPECIAL.COLOR_BOMB ? b.type : a.type;
    const toClear = activateColorBomb(bombR, bombC, targetType);
    movesLeft--;
    inputLocked = true;
    isCascading = true;
    combo = 0;
    cascadeCount = 0;
    for (const k of toClear) {
      const r = Math.floor(k / COLS), c = k % COLS;
      if (grid[r][c]) {
        spawnExplosion(r, c, CANDY_DEFS[grid[r][c].type].color, 8);
        if (iceGrid[r][c] > 0) iceGrid[r][c]--;
      }
      grid[r][c] = null;
    }
    score += toClear.size * 15;
    addPopup('Color Bomb!', W/2, gridY - 30, '#ffd700', 28);
    applyGravity();
    spreadChocolate();
    return;
  }

  // Normal swap
  swap(r1, c1, r2, c2);
  const matches = findMatches();
  if (matches.length > 0) {
    movesLeft--;
    inputLocked = true;
    isCascading = true;
    combo = 0;
    cascadeCount = 0;
    // Activate specials that were swapped
    const key = (r, c) => r * COLS + c;
    const toClear = new Set();
    if (a.special !== SPECIAL.NONE) activateSpecial(r2, c2, a, toClear);
    if (b.special !== SPECIAL.NONE) activateSpecial(r1, c1, b, toClear);
    if (toClear.size > 0) {
      for (const k of toClear) {
        const r = Math.floor(k / COLS), c = k % COLS;
        if (grid[r][c]) {
          spawnExplosion(r, c, CANDY_DEFS[grid[r][c].type].color, 6);
          if (iceGrid[r][c] > 0) iceGrid[r][c]--;
        }
        grid[r][c] = null;
      }
      score += toClear.size * 10;
    }
    processMatches();
    applyGravity();
    spreadChocolate();
  } else {
    // Invalid swap — swap back
    swap(r1, c1, r2, c2);
  }
}

function startLevel(idx) {
  currentLevel = idx;
  const def = LEVELS[idx];
  movesLeft = def.moves;
  score = 0;
  combo = 0;
  cascadeCount = 0;
  selected = null;
  inputLocked = false;
  isCascading = false;
  hintTimer = 0;
  hintMove = null;
  particles = [];
  popupTexts = [];
  initGrid(def);
  // Ensure at least one valid move
  let safety = 0;
  while (findValidMoves().length === 0 && safety < 50) {
    initGrid(def);
    safety++;
  }
  // Process any initial matches silently
  while (processMatches()) { applyGravity(); }
  combo = 0;
  score = 0;
  state = 'playing';
}

// --- EVENTS ---
canvas.addEventListener('mousedown', e => {
  handleClick(e.clientX, e.clientY);
});

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  handleClick(t.clientX, t.clientY);
}, { passive: false });

// Map scrolling
let scrollDragY = null;
canvas.addEventListener('mousedown', e => {
  if (state === 'map') scrollDragY = e.clientY;
});
canvas.addEventListener('mousemove', e => {
  if (state === 'map' && scrollDragY !== null) {
    scrollY -= (e.clientY - scrollDragY);
    scrollDragY = e.clientY;
    const maxScroll = Math.max(0, 140 + 20 * 90 - H + 100);
    scrollY = Math.max(0, Math.min(scrollY, maxScroll));
  }
});
canvas.addEventListener('mouseup', () => { scrollDragY = null; });
canvas.addEventListener('wheel', e => {
  if (state === 'map') {
    scrollY += e.deltaY;
    const maxScroll = Math.max(0, 140 + 20 * 90 - H + 100);
    scrollY = Math.max(0, Math.min(scrollY, maxScroll));
  }
});

// Touch scroll for map
let touchScrollY = null;
canvas.addEventListener('touchstart', e => {
  if (state === 'map') touchScrollY = e.touches[0].clientY;
}, { passive: true });
canvas.addEventListener('touchmove', e => {
  if (state === 'map' && touchScrollY !== null) {
    scrollY -= (e.touches[0].clientY - touchScrollY);
    touchScrollY = e.touches[0].clientY;
    const maxScroll = Math.max(0, 140 + 20 * 90 - H + 100);
    scrollY = Math.max(0, Math.min(scrollY, maxScroll));
  }
}, { passive: true });
canvas.addEventListener('touchend', () => { touchScrollY = null; });

// Keyboard for map
document.addEventListener('keydown', e => {
  if (state === 'map' && e.key === 'Escape') return;
  if (state === 'playing' && e.key === 'Escape') {
    state = 'map';
  }
});

// --- MAIN LOOP ---
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);

  ctx.clearRect(0, 0, W, H);

  if (state === 'map') {
    drawMap();
  } else if (state === 'playing') {
    ctx.fillStyle = '#0c0818';
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawHUD();
    drawParticles();
    drawPopups();
  } else if (state === 'levelComplete') {
    ctx.fillStyle = '#0c0818';
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawHUD();
    drawParticles();
    drawPopups();
    drawLevelComplete();
  } else if (state === 'levelFailed') {
    ctx.fillStyle = '#0c0818';
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawHUD();
    drawParticles();
    drawLevelFailed();
  }

  requestAnimationFrame(gameLoop);
}

// Init: ensure level 1 is unlocked
if (!levelStars[1]) levelStars[1] = 0;
saveProgress();

lastTime = performance.now();
requestAnimationFrame(gameLoop);

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
  var hbPeriod = 0.6778190708230662;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01807045893703814;mix-blend-mode:overlay';
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