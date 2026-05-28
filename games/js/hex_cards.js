const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// ── Raymarched 3D Background ──
const bg = new RayBG('bg', 'sanctum', {dim: 0.25, accent: [0.69, 0.38, 1]});

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);
const W = () => canvas.width;
const H = () => canvas.height;

// ── Constants ──
const TEAL = '#00d2ff', PINK = '#ff60a0';
const TEAL_DARK = '#005570', PINK_DARK = '#6a1838';
const BG = '#0a0a18';
// Edge labels for display (mapped to our 6 directions)
// Pointy-top hex edges: 0=TopRight, 1=Right, 2=BotRight, 3=BotLeft, 4=Left, 5=TopLeft
// We map spec names: Top→5+0 average... actually let's just use directional labels
const EDGE_LABELS = ['Top-Right','Right','Bot-Right','Bot-Left','Left','Top-Left'];

const ELEMENTS = {
  Earth:    { color: '#8B6914', glyph: 'E' },
  Fire:     { color: '#ff4400', glyph: 'F' },
  Void:     { color: '#8800cc', glyph: 'V' },
  Wind:     { color: '#88ddaa', glyph: 'W' },
  Electric: { color: '#ffee00', glyph: 'Z' },
  Ocean:    { color: '#0077dd', glyph: 'O' },
  Nature:   { color: '#22aa44', glyph: 'N' },
  Ice:      { color: '#99ccff', glyph: 'I' }
};

// ── Card Data ──
// edges[0..5] = values for 6 edges in order: TopRight, Right, BotRight, BotLeft, Left, TopLeft
// Remapped from spec's [Top, TopRight, BotRight, Bottom, BotLeft, TopLeft]
// Since pointy-top doesn't have pure "Top"/"Bottom" edges, we redistribute:
// Spec Top → our TopLeft(5) gets half, TopRight(0) gets half → just keep spec order as abstract indices
//
// Actually: the simplest correct approach is to keep the spec's 6 values as-is as abstract edge indices 0-5.
// The visual placement on the hex and the neighbor matching (i vs i+3%6) is what matters.
// I'll place the values at the 6 edge midpoints of the pointy-top hex in a consistent order.

const CARD_DEFS = [
  { id:0,  name:'Shield Wall',      ch:'defender', edges:[7,6,7,6,7,6], element:'Earth' },
  { id:1,  name:'Iron Charge',      ch:'defender', edges:[4,8,9,4,3,5], element:'Fire' },
  { id:2,  name:'Fortress',         ch:'defender', edges:[9,5,4,6,5,8], element:'Earth' },
  { id:3,  name:'Pressure Point',   ch:'dim_mak',  edges:[3,2,9,3,2,4], element:'Void' },
  { id:4,  name:'Dim Mak Rush',     ch:'dim_mak',  edges:[5,3,4,5,8,9], element:'Wind' },
  { id:5,  name:'Shadow Strike',    ch:'dim_mak',  edges:[4,3,5,9,8,3], element:'Void' },
  { id:6,  name:'Overdrive',        ch:'mecha',    edges:[6,6,6,6,6,6], element:'Electric' },
  { id:7,  name:'Laser Array',      ch:'mecha',    edges:[8,3,8,3,8,3], element:'Electric' },
  { id:8,  name:'Mech Shield',      ch:'mecha',    edges:[5,9,8,4,3,5], element:'Fire' },
  { id:9,  name:'Tidal Wave',       ch:'kraken',   edges:[4,3,5,6,9,8], element:'Ocean' },
  { id:10, name:'Deep Grip',        ch:'kraken',   edges:[5,8,8,5,3,4], element:'Ocean' },
  { id:11, name:'Ink Cloud',        ch:'kraken',   edges:[5,5,5,5,5,5], element:'Void' },
  { id:12, name:'Spirit Judgment',  ch:'aku_aku',  edges:[9,1,9,1,9,1], element:'Nature' },
  { id:13, name:'Mask of Power',    ch:'aku_aku',  edges:[7,7,5,5,7,7], element:'Nature' },
  { id:14, name:"Ancestor's Wrath", ch:'aku_aku',  edges:[8,5,3,4,5,9], element:'Fire' },
  { id:15, name:'Mourning Slash',   ch:'grief',    edges:[3,4,8,9,5,4], element:'Ice' },
  { id:16, name:'Ghost Phase',      ch:'grief',    edges:[4,4,4,4,4,4], element:'Void' },
  { id:17, name:'Soul Harvest',     ch:'grief',    edges:[7,7,7,8,7,7], element:'Ice' }
];

// ── Sprites ──
const SPRITE_MAP = {
  defender: '../assets/sprites/armored_defender_sprite_sheet.png',
  dim_mak:  '../assets/sprites/dim_mak_fighter_full_sheet.png',
  mecha:    '../assets/sprites/mecha_entity_alpha_v2.png',
  kraken:   '../assets/sprites/kraken_game_render.png',
  aku_aku:  '../assets/sprites/aku_aku_mask_stylized.png',
  grief:    '../assets/sprites/grief_warrior_sprite_sheet.png'
};
const sprites = {};
let spritesLoaded = 0;
for (const [k, src] of Object.entries(SPRITE_MAP)) {
  const img = new Image();
  img.onload = () => { sprites[k] = img; spritesLoaded++; };
  img.onerror = () => { spritesLoaded++; };
  img.src = src;
}

// ── Audio ──
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function ensureAudio() { if (!audioCtx) audioCtx = new AudioCtx(); }
function playTone(freq, dur, type='sine', vol=0.12) {
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch(e) {}
}
function sfxPlace()   { playTone(220,0.12,'triangle',0.15); playTone(330,0.08,'sine',0.1); }
function sfxCapture() { playTone(440,0.18,'square',0.08); playTone(660,0.12,'sine',0.1); }
function sfxChain()   { playTone(550,0.25,'sawtooth',0.06); playTone(880,0.18,'sine',0.1); }
function sfxWin()     { [330,440,550,660].forEach((f,i) => setTimeout(()=>playTone(f,0.25,'sine',0.12), i*100)); }
function sfxLose()    { [440,330,260,200].forEach((f,i) => setTimeout(()=>playTone(f,0.35,'triangle',0.1), i*130)); }

// ── Game State ──
let screen = 'title'; // title | difficulty | game | gameover | collection
let difficulty = 1;
let playerHand = [], aiHand = [];
let board = [];
let currentTurn = 'player';
let selectedCard = -1, hoverCell = -1;
let previewCaptures = [];
let gameOver = false, winner = '';
let stats = { playerCaptures:0, aiCaptures:0, chains:0, elementBonuses:0 };
let titleRotation = 0, titleCards = [];
let mouseX = 0, mouseY = 0;
let inspectCard = null;

// ══════════════════════════════════════════════
// POINTY-TOP HEX GEOMETRY
// ══════════════════════════════════════════════
// Pointy-top: vertex at top. Corner 0 = top vertex, going clockwise.
// Corner angles: -90°, -30°, 30°, 90°, 150°, 210°
//
// 6 edges (between consecutive corners):
//   Edge 0: between corner 0 (top) and corner 1 (upper-right) → "Top-Right" edge, midpoint at -60° → neighbor at angle -60° (i.e. 300°)
//   Edge 1: between corner 1 and corner 2 → "Right" edge, midpoint at 0° → neighbor at 0°
//   Edge 2: between corner 2 and corner 3 (bottom) → "Bot-Right" edge, midpoint at 60° → neighbor at 60°
//   Edge 3: between corner 3 and corner 4 → "Bot-Left" edge, midpoint at 120° → neighbor at 120°
//   Edge 4: between corner 4 and corner 5 → "Left" edge, midpoint at 180° → neighbor at 180°
//   Edge 5: between corner 5 and corner 0 (top) → "Top-Left" edge, midpoint at 240° → neighbor at 240° (= -120°)
//
// Opposite edge: (i + 3) % 6
// Neighbor at edge 0 is at angle 300°, edge 1 at 0°, edge 2 at 60°, edge 3 at 120°, edge 4 at 180°, edge 5 at 240°
//
// Pointy-top hex dimensions: width = sqrt(3)*size, height = 2*size
// Standard row layout: same-row hexes spaced sqrt(3)*size apart horizontally (they are neighbors via edges 1 or 4)
// Adjacent rows offset by sqrt(3)/2 * size horizontally, 1.5*size vertically

const HEX_SIZE = 46;

function hexCorner(cx, cy, size, i) {
  const angle = Math.PI / 180 * (60 * i - 90);
  return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)];
}

function drawHex(cx, cy, size, fill, stroke, lw=2) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const [x, y] = hexCorner(cx, cy, size, i);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function pointInHex(px, py, cx, cy, size) {
  // Use the hex's inscribed-circle radius for a quick check, then precise polygon test
  const dx = px - cx, dy = py - cy;
  if (dx*dx + dy*dy > size*size) return false;
  // Precise: check if point is inside all 6 half-planes defined by edges
  for (let i = 0; i < 6; i++) {
    const [x1, y1] = hexCorner(0, 0, size, i);
    const [x2, y2] = hexCorner(0, 0, size, (i+1)%6);
    // Cross product (edge vector × point vector) should be ≤ 0 for CW winding
    if ((x2-x1)*(dy-y1) - (y2-y1)*(dx-x1) > 0.5) return false;
  }
  return true;
}

// Edge midpoint position (for drawing edge values)
function edgeMidpoint(cx, cy, size, edgeIdx) {
  const [x1, y1] = hexCorner(cx, cy, size, edgeIdx);
  const [x2, y2] = hexCorner(cx, cy, size, (edgeIdx + 1) % 6);
  return [(x1+x2)/2, (y1+y2)/2];
}

// ══════════════════════════════════════════════
// BOARD (pointy-top hex grid, odd-r offset)
// ══════════════════════════════════════════════
// 4 rows: [3, 4, 3, 4] = 14 cells
// Odd rows (1, 3) have 4 hexes and are shifted right by half a hex width
// Even rows (0, 2) have 3 hexes and are centered relative to odd rows
//
// Pointy-top row layout:
//   horizontal spacing = sqrt(3) * size  (same-row neighbors share Right/Left edges)
//   vertical spacing = 1.5 * size
//   odd rows offset right by sqrt(3)/2 * size

const BOARD_ROWS = [3, 4, 3, 4];

function buildBoard() {
  board = [];
  const S = HEX_SIZE;
  const hexW = Math.sqrt(3) * S;  // width of one hex
  const rowH = 1.5 * S;           // vertical distance between row centers

  // Element tiles (row,col → element)
  const elemMap = {
    '0,1':'Fire', '1,0':'Ocean', '1,3':'Nature',
    '2,0':'Electric', '2,2':'Void', '3,1':'Ice', '3,2':'Wind'
  };

  // Center the board
  const totalH = (BOARD_ROWS.length - 1) * rowH;
  const maxRowW = 3 * hexW; // widest visual extent (4 hexes span 3 gaps)
  const baseY = H()/2 - totalH/2;
  const baseX = W()/2;

  let idx = 0;
  for (let r = 0; r < BOARD_ROWS.length; r++) {
    const cols = BOARD_ROWS[r];
    // For odd rows (4 hexes): x ranges from -1.5*hexW to +1.5*hexW (centered)
    // For even rows (3 hexes): x ranges from -1*hexW to +1*hexW (centered)
    // This means even rows are naturally centered and odd rows are also centered
    // but the odd rows are wider, creating the stagger effect.
    const startX = baseX - (cols - 1) * hexW / 2;

    for (let c = 0; c < cols; c++) {
      const px = startX + c * hexW;
      const py = baseY + r * rowH;
      const elem = elemMap[`${r},${c}`] || null;
      board.push({ card:null, owner:null, element:elem, row:r, col:c, px, py, idx, flipAnim:0, chainAnim:0 });
      idx++;
    }
  }

  // Compute neighbors using proximity + angle
  for (let i = 0; i < board.length; i++) {
    board[i].neighbors = [];
    for (let e = 0; e < 6; e++) board[i].neighbors.push(-1);
  }

  const neighborDist = hexW; // sqrt(3)*S — distance between adjacent hex centers
  // Neighbor angles for each edge (degrees):
  // Edge 0 (TopRight): neighbor at ~-60° = 300°
  // Edge 1 (Right):    neighbor at 0°
  // Edge 2 (BotRight): neighbor at 60°
  // Edge 3 (BotLeft):  neighbor at 120°
  // Edge 4 (Left):     neighbor at 180°
  // Edge 5 (TopLeft):  neighbor at 240°
  const edgeAngles = [300, 0, 60, 120, 180, 240];

  for (let i = 0; i < board.length; i++) {
    for (let j = i+1; j < board.length; j++) {
      const dx = board[j].px - board[i].px;
      const dy = board[j].py - board[i].py;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > neighborDist * 1.15) continue; // too far

      const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;

      // Find which edge this corresponds to
      for (let e = 0; e < 6; e++) {
        let diff = Math.abs(angle - edgeAngles[e]);
        if (diff > 180) diff = 360 - diff;
        if (diff < 25) { // within 25° tolerance
          board[i].neighbors[e] = j;
          board[j].neighbors[(e+3)%6] = i;
          break;
        }
      }
    }
  }
}

// ══════════════════════════════════════════════
// CARD LOGIC
// ══════════════════════════════════════════════

function makeCard(def) { return { ...def, edges: [...def.edges] }; }

function shuffleDeck() {
  const deck = CARD_DEFS.map(d => makeCard(d));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealHands() {
  const deck = shuffleDeck();
  playerHand = deck.slice(0, 5);
  aiHand = deck.slice(5, 10);
}

function getEffectiveEdges(cellIdx) {
  const cell = board[cellIdx];
  if (!cell || !cell.card) return null;
  const edges = [...cell.card.edges];
  if (cell.element && cell.card.element === cell.element) {
    for (let i = 0; i < 6; i++) edges[i] = Math.min(edges[i] + 2, 11);
  }
  return edges;
}

function placeCard(cellIdx, card, owner) {
  const cell = board[cellIdx];
  cell.card = card;
  cell.owner = owner;
  cell.flipAnim = 0;

  if (cell.element && card.element === cell.element) stats.elementBonuses++;

  // Battle adjacent
  const captured = [];
  const myEdges = getEffectiveEdges(cellIdx);

  for (let e = 0; e < 6; e++) {
    const ni = cell.neighbors[e];
    if (ni < 0) continue;
    const nb = board[ni];
    if (!nb.card || nb.owner === owner) continue;
    const opp = (e + 3) % 6;
    const theirEdges = getEffectiveEdges(ni);
    if (myEdges[e] > theirEdges[opp]) captured.push(ni);
  }

  // Ghost Phase special
  if (card.id === 16) {
    for (let e = 0; e < 6; e++) {
      const ni = cell.neighbors[e];
      if (ni < 0) continue;
      if (board[ni].card && board[ni].owner !== owner && !captured.includes(ni))
        captured.push(ni);
    }
  }

  // Apply captures
  for (const ci of captured) {
    board[ci].owner = owner;
    board[ci].flipAnim = 1.0;
    owner === 'player' ? stats.playerCaptures++ : stats.aiCaptures++;
  }
  if (captured.length > 0) {
    sfxCapture();
    bg.shake(0.2);
  }

  // Chain rule
  let chainQueue = [...captured];
  let depth = 0;
  while (chainQueue.length > 0 && depth < 30) {
    const next = [];
    for (const ci of chainQueue) {
      const ce = getEffectiveEdges(ci);
      for (let e = 0; e < 6; e++) {
        const ni = board[ci].neighbors[e];
        if (ni < 0) continue;
        const nb = board[ni];
        if (!nb.card || nb.owner === owner) continue;
        const opp = (e+3)%6;
        const te = getEffectiveEdges(ni);
        if (ce[e] > te[opp]) {
          nb.owner = owner;
          nb.flipAnim = 1.0;
          nb.chainAnim = 1.0;
          next.push(ni);
          stats.chains++;
          owner === 'player' ? stats.playerCaptures++ : stats.aiCaptures++;
        }
      }
    }
    chainQueue = next;
    depth++;
  }
  if (depth > 0 && chainQueue.length === 0 && captured.length > 0) sfxChain();

  sfxPlace();
  bg.pulse(0.3);
}

function countCards(owner) { return board.filter(c => c.card && c.owner === owner).length; }

function checkGameOver() {
  const filled = board.filter(c => c.card).length;
  if (filled >= board.length || (playerHand.length === 0 && aiHand.length === 0)) {
    gameOver = true;
    const pc = countCards('player'), ac = countCards('ai');
    if (pc > ac) { winner = 'player'; sfxWin(); bg.pulse(0.8); }
    else if (ac > pc) { winner = 'ai'; sfxLose(); }
    else winner = 'draw';
    setTimeout(() => { screen = 'gameover'; }, 1200);
  }
}

// ══════════════════════════════════════════════
// AI
// ══════════════════════════════════════════════

function aiTurn() {
  if (aiHand.length === 0) return;
  const empty = [];
  board.forEach((c,i) => { if (!c.card) empty.push(i); });
  if (empty.length === 0) return;

  let bestCI = 0, bestCell = empty[0], bestScore = -1e9;

  if (difficulty === 0) {
    bestCI = Math.floor(Math.random() * aiHand.length);
    bestCell = empty[Math.floor(Math.random() * empty.length)];
  } else {
    for (let ci = 0; ci < aiHand.length; ci++) {
      for (const cellIdx of empty) {
        const s = evalPlace(ci, cellIdx);
        if (s > bestScore) { bestScore = s; bestCI = ci; bestCell = cellIdx; }
      }
    }
  }

  const card = aiHand.splice(bestCI, 1)[0];
  placeCard(bestCell, card, 'ai');
  checkGameOver();
  if (!gameOver) currentTurn = 'player';
}

function evalPlace(ci, cellIdx) {
  const card = aiHand[ci], cell = board[cellIdx];
  let score = Math.random() * 0.3;

  const edges = [...card.edges];
  const elemBonus = cell.element && card.element === cell.element;
  if (elemBonus) { score += 5; for (let i = 0; i < 6; i++) edges[i] = Math.min(edges[i]+2, 11); }

  // Count captures
  let caps = 0;
  for (let e = 0; e < 6; e++) {
    const ni = cell.neighbors[e];
    if (ni < 0) continue;
    const nb = board[ni];
    if (!nb.card) continue;
    if (nb.owner !== 'ai') {
      const opp = (e+3)%6, te = getEffectiveEdges(ni);
      if (edges[e] > te[opp]) caps++;
    }
  }
  score += caps * 10;

  if (card.id === 16) {
    for (let e = 0; e < 6; e++) {
      const ni = cell.neighbors[e];
      if (ni >= 0 && board[ni].card && board[ni].owner !== 'ai') score += 8;
    }
  }

  if (difficulty >= 2) {
    // Defensive: penalize weak exposed edges
    for (let e = 0; e < 6; e++) {
      const ni = cell.neighbors[e];
      if (ni < 0) continue;
      if (!board[ni].card) {
        if (edges[e] <= 4) score -= 3;
        else if (edges[e] >= 7) score += 1;
      }
    }
    // Chain estimation
    for (let e = 0; e < 6; e++) {
      const ni = cell.neighbors[e];
      if (ni < 0) continue;
      const nb = board[ni];
      if (!nb.card || nb.owner === 'ai') continue;
      const opp = (e+3)%6, te = getEffectiveEdges(ni);
      if (edges[e] > te[opp]) {
        // Would capture ni — check its other edges for chains
        const ce2 = [...nb.card.edges];
        if (board[ni].element && nb.card.element === board[ni].element)
          for (let i = 0; i < 6; i++) ce2[i] = Math.min(ce2[i]+2, 11);
        for (let e2 = 0; e2 < 6; e2++) {
          if (e2 === opp) continue;
          const ni2 = board[ni].neighbors[e2];
          if (ni2 < 0 || ni2 === cellIdx) continue;
          if (board[ni2].card && board[ni2].owner !== 'ai') {
            const te2 = getEffectiveEdges(ni2);
            if (ce2[e2] > te2[(e2+3)%6]) score += 7;
          }
        }
      }
    }
  }
  return score;
}

function computePreview(cardIdx, cellIdx) {
  if (cardIdx < 0 || cellIdx < 0) return [];
  const card = playerHand[cardIdx];
  if (!card) return [];
  const cell = board[cellIdx];
  if (!cell || cell.card) return [];

  const result = [];
  const edges = [...card.edges];
  if (cell.element && card.element === cell.element)
    for (let i = 0; i < 6; i++) edges[i] = Math.min(edges[i]+2, 11);

  for (let e = 0; e < 6; e++) {
    const ni = cell.neighbors[e];
    if (ni < 0) continue;
    const nb = board[ni];
    if (!nb.card || nb.owner === 'player') continue;
    const opp = (e+3)%6, te = getEffectiveEdges(ni);
    if (edges[e] > te[opp]) result.push(ni);
  }

  if (card.id === 16) {
    for (let e = 0; e < 6; e++) {
      const ni = cell.neighbors[e];
      if (ni >= 0 && board[ni].card && board[ni].owner !== 'player' && !result.includes(ni))
        result.push(ni);
    }
  }
  return result;
}

// ══════════════════════════════════════════════
// DRAWING
// ══════════════════════════════════════════════

function drawHexCard(cx, cy, size, card, owner, selected=false, faceDown=false, flipAnim=0) {
  const col = owner === 'player' ? TEAL : PINK;
  const colD = owner === 'player' ? TEAL_DARK : PINK_DARK;

  ctx.save();
  if (flipAnim > 0) {
    const sx = Math.abs(Math.cos(flipAnim * Math.PI));
    ctx.translate(cx, cy);
    ctx.scale(Math.max(sx, 0.05), 1);
    ctx.translate(-cx, -cy);
  }

  // Glow
  ctx.shadowColor = col;
  ctx.shadowBlur = selected ? 22 : 6;

  // Body
  const grad = ctx.createRadialGradient(cx, cy-size*0.15, 0, cx, cy, size);
  if (faceDown) { grad.addColorStop(0,'#181830'); grad.addColorStop(1,'#0c0c1e'); }
  else { grad.addColorStop(0, colD); grad.addColorStop(1, '#0d0d1a'); }
  drawHex(cx, cy, size, grad, col, selected ? 3 : 2);
  ctx.shadowBlur = 0;

  if (faceDown) {
    ctx.fillStyle = '#2a2a44';
    ctx.font = `bold ${size*0.55}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
    ctx.restore();
    return;
  }

  // Sprite
  const spr = sprites[card.ch];
  if (spr) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const [x,y] = hexCorner(cx, cy, size*0.72, i);
      i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    }
    ctx.closePath(); ctx.clip();
    ctx.globalAlpha = 0.65;
    const sMin = Math.min(spr.width, spr.height);
    const ss = size * 0.95;
    ctx.drawImage(spr, (spr.width-sMin)/2, (spr.height-sMin)/2, sMin, sMin, cx-ss/2, cy-ss/2, ss, ss);
    ctx.restore();
  } else {
    const charCol = {defender:'#4488ff',dim_mak:'#aa44ff',mecha:'#44ffaa',kraken:'#4466ff',aku_aku:'#ffaa44',grief:'#8888cc'};
    ctx.globalAlpha = 0.25;
    drawHex(cx, cy, size*0.45, charCol[card.ch]||'#666', null);
    ctx.globalAlpha = 1;
  }

  // Element glyph
  const eInfo = ELEMENTS[card.element];
  if (eInfo) {
    ctx.font = `bold ${size*0.2}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = eInfo.color; ctx.globalAlpha = 0.8;
    ctx.fillText(eInfo.glyph, cx, cy);
    ctx.globalAlpha = 1;
  }

  // Edge values
  // We place edge value i at the midpoint of hex edge i
  // Edge i is between corner i and corner (i+1)%6
  // Our card edges: 0=TopRight, 1=Right, 2=BotRight, 3=BotLeft, 4=Left, 5=TopLeft
  // Hex corners (pointy-top): 0=top, 1=upperRight, 2=lowerRight, 3=bottom, 4=lowerLeft, 5=upperLeft
  // So hex edge i (corner i to corner i+1) naturally corresponds to:
  //   hex edge 0 (top→upperRight) = card edge 0 (TopRight) ✓
  //   hex edge 1 (upperRight→lowerRight) = card edge 1 (Right) ✓
  //   hex edge 2 (lowerRight→bottom) = card edge 2 (BotRight) ✓
  //   hex edge 3 (bottom→lowerLeft) = card edge 3 (BotLeft) ✓
  //   hex edge 4 (lowerLeft→upperLeft) = card edge 4 (Left) ✓
  //   hex edge 5 (upperLeft→top) = card edge 5 (TopLeft) ✓
  // Perfect 1:1 mapping!

  for (let i = 0; i < 6; i++) {
    const [mx, my] = edgeMidpoint(cx, cy, size, i);
    // Pull slightly inward
    const ix = cx + (mx - cx) * 0.82;
    const iy = cy + (my - cy) * 0.82;

    const r = size * 0.16;
    ctx.beginPath(); ctx.arc(ix, iy, r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();

    ctx.font = `bold ${size*0.19}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = card.edges[i] >= 7 ? '#ffdd44' : '#eee';
    ctx.fillText(card.edges[i], ix, iy);
  }

  // Name
  if (size > 30) {
    ctx.font = `${Math.max(size*0.14, 7)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.85;
    ctx.fillText(card.name, cx, cy + size*0.4);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawBoard() {
  for (let i = 0; i < board.length; i++) {
    const cell = board[i];
    const {px, py, element} = cell;

    // Element tile aura
    if (element) {
      const ec = ELEMENTS[element].color;
      ctx.save();
      ctx.globalAlpha = 0.12;
      drawHex(px, py, HEX_SIZE+5, ec, null);
      ctx.globalAlpha = 0.35;
      drawHex(px, py, HEX_SIZE+1, null, ec, 2);
      ctx.restore();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = ec;
      ctx.globalAlpha = 0.5;
      ctx.fillText(element, px, py + HEX_SIZE - 6);
      ctx.globalAlpha = 1;
    }

    // Preview highlight
    if (previewCaptures.includes(i)) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now()*0.006)*0.15;
      drawHex(px, py, HEX_SIZE+3, 'rgba(255,255,0,0.25)', '#ffff00', 2.5);
      ctx.restore();
    }

    // Hover
    if (i === hoverCell && !cell.card && selectedCard >= 0) {
      ctx.save(); ctx.globalAlpha = 0.2;
      drawHex(px, py, HEX_SIZE, 'rgba(0,210,255,0.15)', TEAL, 2);
      ctx.restore();
    }

    if (cell.card) {
      if (cell.flipAnim > 0) cell.flipAnim = Math.max(0, cell.flipAnim - 0.025);
      if (cell.chainAnim > 0) {
        cell.chainAnim = Math.max(0, cell.chainAnim - 0.018);
        ctx.save();
        ctx.globalAlpha = cell.chainAnim * 0.45;
        drawHex(px, py, HEX_SIZE + (1-cell.chainAnim)*35, null, '#ffff00', 3);
        ctx.restore();
      }
      drawHexCard(px, py, HEX_SIZE, cell.card, cell.owner, false, false, cell.flipAnim);
    } else {
      drawHex(px, py, HEX_SIZE, 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.12)', 1);
    }
  }
}

function drawHand(hand, owner, y) {
  const cs = HEX_SIZE * 0.82;
  const sp = cs * 2.3;
  const sx = W()/2 - (hand.length-1)*sp/2;

  for (let i = 0; i < hand.length; i++) {
    const cx = sx + i*sp;
    const sel = owner === 'player' && i === selectedCard;
    const cy2 = sel ? y - 14 : y;
    drawHexCard(cx, cy2, cs, hand[i], owner, sel, owner === 'ai');
    hand[i]._hx = cx; hand[i]._hy = cy2; hand[i]._hs = cs;
  }
}

function drawUI() {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  if (currentTurn === 'player') {
    ctx.fillStyle = TEAL;
    ctx.fillText('YOUR TURN \u2014 Select a card, then place it', W()/2, 26);
  } else {
    ctx.fillStyle = PINK;
    ctx.fillText('OPPONENT THINKING...', W()/2, 26);
  }

  const pc = countCards('player'), ac = countCards('ai');
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left'; ctx.fillStyle = TEAL;
  ctx.fillText('YOU: '+pc, 16, H()-18);
  ctx.textAlign = 'right'; ctx.fillStyle = PINK;
  ctx.fillText('AI: '+ac, W()-16, H()-18);

  ctx.font = '11px sans-serif'; ctx.fillStyle = '#555';
  ctx.textAlign = 'left';
  ctx.fillText('Hand: '+playerHand.length, 16, H()-36);
  ctx.textAlign = 'right';
  ctx.fillText('Hand: '+aiHand.length, W()-16, H()-36);

  // Right-click hint
  ctx.textAlign = 'center'; ctx.fillStyle = '#333';
  ctx.font = '10px sans-serif';
  ctx.fillText('Right-click a card to inspect', W()/2, H()-6);
}

function drawInspect() {
  if (!inspectCard) return;
  const card = inspectCard;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0,0,W(),H());

  const cx = W()/2, cy = H()/2 - 20;
  drawHexCard(cx, cy, HEX_SIZE*2.2, card, 'player', true);

  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText(card.name, cx, cy + HEX_SIZE*2.2 + 30);

  const ei = ELEMENTS[card.element];
  ctx.font = '15px sans-serif';
  ctx.fillStyle = ei ? ei.color : '#999';
  ctx.fillText('Element: ' + card.element, cx, cy + HEX_SIZE*2.2 + 55);

  ctx.font = '12px sans-serif'; ctx.fillStyle = '#888';
  const s = card.edges.map((v,i) => EDGE_LABELS[i]+':'+v).join('  ');
  ctx.fillText(s, cx, cy + HEX_SIZE*2.2 + 78);

  if (card.id === 16) {
    ctx.fillStyle = '#cc88ff';
    ctx.fillText('SPECIAL: Captures all adjacent cards on placement', cx, cy + HEX_SIZE*2.2 + 98);
  }

  ctx.fillStyle = '#444'; ctx.font = '11px sans-serif';
  ctx.fillText('Click anywhere to close', cx, cy + HEX_SIZE*2.2 + 120);
}

// ── Screens ──

function initTitleCards() {
  titleCards = [];
  for (let i = 0; i < 6; i++) {
    titleCards.push({
      card: makeCard(CARD_DEFS[i*3]),
      angle: (i/6)*Math.PI*2,
      radius: Math.min(W(),H()) * 0.2
    });
  }
}

function drawTitle() {
  titleRotation += 0.003;
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(W()/2-180, 0, W()/2+180, 0);
  g.addColorStop(0, TEAL); g.addColorStop(1, PINK);
  ctx.fillStyle = g;
  ctx.fillText('HEX CARDS', W()/2, H()/2 - 110);
  ctx.font = '15px sans-serif'; ctx.fillStyle = '#777';
  ctx.fillText('A Guinea Pig Trench Card Battle', W()/2, H()/2 - 70);

  if (!titleCards.length) initTitleCards();
  for (const tc of titleCards) {
    tc.angle += 0.004;
    const x = W()/2 + Math.cos(tc.angle+titleRotation)*tc.radius;
    const y = H()/2 + 20 + Math.sin(tc.angle+titleRotation)*tc.radius*0.4;
    drawHexCard(x, y, HEX_SIZE*0.65, tc.card, Math.cos(tc.angle)>0?'player':'ai');
  }

  drawBtn(W()/2, H()/2+170, 200, 44, 'PLAY', TEAL);
  drawBtn(W()/2, H()/2+228, 200, 44, 'COLLECTION', '#8866cc');
}

function drawDifficultyScreen() {
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('SELECT DIFFICULTY', W()/2, H()/2-130);
  const lb = ['EASY','MEDIUM','HARD'], cl = ['#44cc44','#ccaa22','#cc4444'];
  const ds = ['Random placement','Seeks captures','Chains + defense'];
  for (let i = 0; i < 3; i++) {
    const y = H()/2 - 40 + i*80;
    drawBtn(W()/2, y, 270, 48, lb[i], cl[i]);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#555';
    ctx.fillText(ds[i], W()/2, y+33);
  }
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(10,10,24,0.88)';
  ctx.fillRect(0,0,W(),H());

  ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'center';
  if (winner === 'player') { ctx.fillStyle = TEAL; ctx.fillText('VICTORY!', W()/2, H()/2-90); }
  else if (winner === 'ai') { ctx.fillStyle = PINK; ctx.fillText('DEFEAT', W()/2, H()/2-90); }
  else { ctx.fillStyle = '#aaa'; ctx.fillText('DRAW', W()/2, H()/2-90); }

  ctx.font = '15px sans-serif'; ctx.fillStyle = '#aaa';
  const pc = countCards('player'), ac = countCards('ai');
  ctx.fillText(`Final Score: You ${pc} \u2014 AI ${ac}`, W()/2, H()/2-30);
  ctx.fillText(`Your Captures: ${stats.playerCaptures}`, W()/2, H()/2);
  ctx.fillText(`Chain Captures: ${stats.chains}`, W()/2, H()/2+22);
  ctx.fillText(`Element Bonuses: ${stats.elementBonuses}`, W()/2, H()/2+44);

  drawBtn(W()/2, H()/2+110, 220, 48, 'PLAY AGAIN', TEAL);
  drawBtn(W()/2, H()/2+172, 220, 48, 'TITLE SCREEN', '#777');
}

function drawCollection() {
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.fillText('CARD COLLECTION', W()/2, 38);

  const cols = 6, cs = HEX_SIZE*0.6;
  const spX = cs*2.6, spY = cs*2.9;
  const sx = W()/2 - (cols-1)*spX/2;

  for (let i = 0; i < CARD_DEFS.length; i++) {
    const c = i%cols, r = Math.floor(i/cols);
    drawHexCard(sx+c*spX, 82+r*spY+cs, cs, CARD_DEFS[i], 'player');
  }

  drawBtn(W()/2, H()-48, 180, 38, 'BACK', '#777');
}

// ── Buttons ──

function drawBtn(x, y, w, h, text, color) {
  const hov = mouseX>x-w/2 && mouseX<x+w/2 && mouseY>y-h/2 && mouseY<y+h/2;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x-w/2, y-h/2, w, h, 6);
  else { ctx.rect(x-w/2, y-h/2, w, h); }

  if (hov) { ctx.fillStyle = color; ctx.globalAlpha = 0.25; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.strokeStyle = color; ctx.lineWidth = hov ? 2.5 : 1.5; ctx.stroke();

  ctx.font = `bold ${h*0.38}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = hov ? '#fff' : color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function hitBtn(x,y,w,h) { return mouseX>x-w/2 && mouseX<x+w/2 && mouseY>y-h/2 && mouseY<y+h/2; }

// ── Game Init ──

function startGame(diff) {
  difficulty = diff;
  buildBoard();
  dealHands();
  selectedCard = -1; hoverCell = -1;
  previewCaptures = [];
  gameOver = false; winner = '';
  currentTurn = 'player';
  stats = { playerCaptures:0, aiCaptures:0, chains:0, elementBonuses:0 };
  screen = 'game';
}

// ── Render Loop ──

function render(t) {
  bg.render(t);
  ctx.clearRect(0,0,W(),H());

  switch(screen) {
    case 'title': drawTitle(); break;
    case 'difficulty': drawDifficultyScreen(); break;
    case 'game':
      drawBoard();
      drawHand(aiHand, 'ai', 52);
      drawHand(playerHand, 'player', H()-60);
      drawUI();
      if (inspectCard) drawInspect();
      break;
    case 'gameover':
      drawBoard();
      drawHand(aiHand, 'ai', 52);
      drawHand(playerHand, 'player', H()-60);
      drawUI();
      drawGameOver();
      break;
    case 'collection': drawCollection(); break;
  }

  requestAnimationFrame(render);
}

// ── Input ──

canvas.addEventListener('mousemove', e => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (screen === 'game' && currentTurn === 'player' && !inspectCard) {
    hoverCell = -1;
    for (let i = 0; i < board.length; i++) {
      if (pointInHex(mouseX, mouseY, board[i].px, board[i].py, HEX_SIZE)) { hoverCell = i; break; }
    }
    previewCaptures = (selectedCard >= 0 && hoverCell >= 0) ? computePreview(selectedCard, hoverCell) : [];
  }
});

canvas.addEventListener('click', e => {
  ensureAudio();
  mouseX = e.clientX; mouseY = e.clientY;

  if (inspectCard) { inspectCard = null; return; }

  switch(screen) {
    case 'title':
      if (hitBtn(W()/2, H()/2+170, 200, 44)) { screen='difficulty'; playTone(440,0.08); }
      if (hitBtn(W()/2, H()/2+228, 200, 44)) { screen='collection'; playTone(440,0.08); }
      break;
    case 'difficulty':
      for (let i = 0; i < 3; i++) {
        if (hitBtn(W()/2, H()/2-40+i*80, 270, 48)) { startGame(i); playTone(550,0.08); break; }
      }
      break;
    case 'game':
      if (currentTurn !== 'player' || gameOver) break;
      // Hand click
      let clicked = -1;
      for (let i = 0; i < playerHand.length; i++) {
        const c = playerHand[i];
        if (c._hx !== undefined && pointInHex(mouseX, mouseY, c._hx, c._hy, c._hs)) { clicked = i; break; }
      }
      if (clicked >= 0) { selectedCard = selectedCard === clicked ? -1 : clicked; playTone(330,0.04); break; }
      // Board click
      if (selectedCard >= 0) {
        for (let i = 0; i < board.length; i++) {
          if (pointInHex(mouseX, mouseY, board[i].px, board[i].py, HEX_SIZE) && !board[i].card) {
            const card = playerHand.splice(selectedCard, 1)[0];
            placeCard(i, card, 'player');
            selectedCard = -1; previewCaptures = [];
            checkGameOver();
            if (!gameOver) { currentTurn = 'ai'; setTimeout(aiTurn, 550); }
            break;
          }
        }
      }
      break;
    case 'gameover':
      if (hitBtn(W()/2, H()/2+110, 220, 48)) { startGame(difficulty); playTone(550,0.08); }
      if (hitBtn(W()/2, H()/2+172, 220, 48)) { screen='title'; titleCards=[]; playTone(330,0.08); }
      break;
    case 'collection':
      if (hitBtn(W()/2, H()-48, 180, 38)) { screen='title'; titleCards=[]; playTone(330,0.08); }
      break;
  }
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  mouseX = e.clientX; mouseY = e.clientY;
  if (screen !== 'game' && screen !== 'collection') return;
  for (let i = 0; i < board.length; i++) {
    if (board[i].card && pointInHex(mouseX, mouseY, board[i].px, board[i].py, HEX_SIZE))
      { inspectCard = board[i].card; return; }
  }
  for (let i = 0; i < playerHand.length; i++) {
    const c = playerHand[i];
    if (c._hx !== undefined && pointInHex(mouseX, mouseY, c._hx, c._hy, c._hs))
      { inspectCard = c; return; }
  }
});

// Mobile touch
let lpTimer = null;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0]; mouseX = t.clientX; mouseY = t.clientY;
  lpTimer = setTimeout(() => {
    canvas.dispatchEvent(new MouseEvent('contextmenu', { clientX: mouseX, clientY: mouseY }));
  }, 500);
}, { passive: false });
canvas.addEventListener('touchend', e => {
  clearTimeout(lpTimer);
  if (e.changedTouches.length) {
    const t = e.changedTouches[0];
    mouseX = t.clientX; mouseY = t.clientY;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: mouseX, clientY: mouseY }));
  }
});
canvas.addEventListener('touchmove', e => {
  clearTimeout(lpTimer);
  if (e.touches.length) { mouseX = e.touches[0].clientX; mouseY = e.touches[0].clientY; }
}, { passive: true });

// Go
render(performance.now());

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
  var hbPeriod = 0.6953410302368435;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.013301232777248678;mix-blend-mode:overlay';
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