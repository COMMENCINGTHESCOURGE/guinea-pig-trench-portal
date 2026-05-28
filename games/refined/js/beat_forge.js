
const bg = new RayBG('bg', 'sanctum', {dim: 0.35, accent: [0.69, 0.38, 1]});

const C = document.getElementById('c');
const X = C.getContext('2d');
let W, H;

function resize() {
  W = C.width = window.innerWidth;
  H = C.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// --- Constants ---
const LANE_COLORS = ['#00e5ff','#ff4081','#ffd740','#b388ff'];
const LANE_KEYS = ['d','f','j','k'];
const LANE_LABELS = ['D','F','J','K'];
const HIT_Y = H * 0.85;
const NOTE_W = 60;
const NOTE_H = 24;
const LANE_GAP = 80;
const BG_COLOR = 'rgba(8,4,24,0.55)';

const TIMING = { PERFECT: 30, GREAT: 60, GOOD: 100 };
const SCORE_VAL = { PERFECT: 300, GREAT: 200, GOOD: 100, MISS: 0 };
const HEALTH_DELTA = { PERFECT: 5, GREAT: 3, GOOD: 1, MISS: -12 };

// --- Characters ---
const CHARACTERS = [
  { name:'Defender', file:'armored_defender_sprite_sheet.png' },
  { name:'Dim Mak', file:'dim_mak_fighter_full_sheet.png' },
  { name:'Mecha', file:'mecha_entity_alpha_v2.png' },
  { name:'Kraken', file:'kraken_game_render.png' },
  { name:'Aku Aku', file:'aku_aku_mask_stylized.png' },
  { name:'Grief', file:'grief_warrior_sprite_sheet.png' }
];

const SONGS = [
  { name:'Trench Groove', bpm:90, density:0.3, desc:'Slow & steady' },
  { name:'Guinea Flip', bpm:120, density:0.55, desc:'Medium groove' },
  { name:'Onion Planet Anthem', bpm:140, density:0.8, desc:'Dense & fast' }
];

const DIFFICULTIES = [
  { name:'Easy', speedMul:0.7, densityMul:0.6 },
  { name:'Normal', speedMul:1.0, densityMul:1.0 },
  { name:'Hard', speedMul:1.3, densityMul:1.4 }
];

// --- State ---
let state = 'title'; // title, charSelect, songSelect, diffSelect, playing, results
let selectedChar = 0;
let selectedSong = 0;
let selectedDiff = 1;
let charImg = null;
let charImages = [];
let imagesLoaded = 0;

// Gameplay
let notes = [];
let score = 0;
let combo = 0;
let maxCombo = 0;
let health = 100;
let counts = { PERFECT:0, GREAT:0, GOOD:0, MISS:0 };
let songTime = 0;
let songStart = 0;
let songDuration = 0;
let laneFlash = [0,0,0,0];
let particles = [];
let judgmentText = '';
let judgmentTimer = 0;
let judgmentColor = '#fff';
let charBob = 0;
let charShake = 0;
let keysDown = {};
let gameOver = false;

// CRT / visual
let scanlineOffset = 0;

// Menu hover
let menuItems = [];
let hoverIndex = -1;

// --- Load sprites ---
function loadSprites() {
  CHARACTERS.forEach((ch, i) => {
    const img = new Image();
    img.onload = () => { imagesLoaded++; };
    img.onerror = () => { imagesLoaded++; };
    img.src = '../assets/sprites/' + ch.file;
    charImages[i] = img;
  });
}
loadSprites();

// --- Procedural note generation ---
function generateNotes(song, diff) {
  const bpm = song.bpm;
  const beatInterval = 60000 / bpm; // ms per beat
  const density = song.density * diff.densityMul;
  const duration = 60000; // 60 seconds per song
  songDuration = duration;
  const noteList = [];
  const totalBeats = Math.floor(duration / beatInterval);

  // Seed-based pseudo-random for reproducibility
  let seed = bpm * 1000 + Math.floor(density * 100);
  function rand() {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let beat = 4; beat < totalBeats; beat++) {
    const time = beat * beatInterval;
    // Decide how many notes on this beat
    const r = rand();
    if (r > density) continue;

    // Pick lanes
    const numLanes = rand() < 0.15 && density > 0.5 ? 2 : 1;
    const usedLanes = new Set();
    for (let n = 0; n < numLanes; n++) {
      let lane = Math.floor(rand() * 4);
      while (usedLanes.has(lane)) lane = (lane + 1) % 4;
      usedLanes.add(lane);
      noteList.push({ time, lane, hit: false, missed: false, y: 0 });
    }

    // Sub-beat notes for higher density
    if (density > 0.6 && rand() < density - 0.4) {
      const subTime = time + beatInterval * 0.5;
      const lane = Math.floor(rand() * 4);
      noteList.push({ time: subTime, lane, hit: false, missed: false, y: 0 });
    }
  }

  noteList.sort((a, b) => a.time - b.time);
  return noteList;
}

// --- Particles ---
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1,
      decay: 0.02 + Math.random() * 0.03,
      color,
      size: 2 + Math.random() * 4
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    X.globalAlpha = p.life;
    X.fillStyle = p.color;
    X.beginPath();
    X.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    X.fill();
  });
  X.globalAlpha = 1;
}

// --- Lane positions ---
function getLaneX(lane) {
  const centerX = W * 0.55;
  const totalW = 3 * LANE_GAP;
  return centerX - totalW / 2 + lane * LANE_GAP;
}

function getHitY() {
  return H * 0.85;
}

// --- Drawing helpers ---
function drawGlow(x, y, radius, color) {
  const g = X.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color + 'aa');
  g.addColorStop(0.5, color + '44');
  g.addColorStop(1, color + '00');
  X.fillStyle = g;
  X.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawCRT() {
  X.globalAlpha = 0.04;
  X.fillStyle = '#000';
  for (let y = 0; y < H; y += 3) {
    X.fillRect(0, y, W, 1);
  }
  X.globalAlpha = 1;
}

function drawText(text, x, y, size, color, align) {
  X.font = `bold ${size}px 'Courier New', monospace`;
  X.textAlign = align || 'center';
  X.textBaseline = 'middle';
  X.fillStyle = color;
  X.shadowColor = color;
  X.shadowBlur = 12;
  X.fillText(text, x, y);
  X.shadowBlur = 0;
}

function drawButton(text, x, y, w, h, hover) {
  X.strokeStyle = hover ? '#fff' : '#888';
  X.lineWidth = hover ? 2 : 1;
  X.shadowColor = hover ? '#fff' : 'transparent';
  X.shadowBlur = hover ? 10 : 0;
  X.strokeRect(x - w/2, y - h/2, w, h);
  if (hover) {
    X.fillStyle = 'rgba(255,255,255,0.05)';
    X.fillRect(x - w/2, y - h/2, w, h);
  }
  X.shadowBlur = 0;
  drawText(text, x, y, 18, hover ? '#fff' : '#aaa');
}

// --- Input ---
let mouseX = 0, mouseY = 0;
let mouseClicked = false;

C.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });
C.addEventListener('click', e => { mouseClicked = true; });
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  keysDown[e.key.toLowerCase()] = true;
  if (state === 'playing') handleNoteHit(e.key.toLowerCase());
  if (state === 'title' && e.key === 'Enter') state = 'charSelect';
  e.preventDefault();
});
window.addEventListener('keyup', e => { keysDown[e.key.toLowerCase()] = false; });

// --- Hit detection ---
function handleNoteHit(key) {
  const laneIndex = LANE_KEYS.indexOf(key);
  if (laneIndex === -1) return;

  laneFlash[laneIndex] = 1;
  const hitY = getHitY();
  const now = performance.now() - songStart;

  let bestNote = null;
  let bestDiff = Infinity;

  for (const note of notes) {
    if (note.hit || note.missed || note.lane !== laneIndex) continue;
    const diff = Math.abs(note.time - now);
    if (diff < bestDiff && diff < TIMING.GOOD + 40) {
      bestDiff = diff;
      bestNote = note;
    }
  }

  if (bestNote) {
    bestNote.hit = true;
    let judgment, color;
    if (bestDiff <= TIMING.PERFECT) {
      judgment = 'PERFECT'; color = '#00e5ff';
      spawnParticles(getLaneX(laneIndex), hitY, LANE_COLORS[laneIndex], 20);
      charBob = 10;
      bg.pulse(0.6);
    } else if (bestDiff <= TIMING.GREAT) {
      judgment = 'GREAT'; color = '#ffd740';
      spawnParticles(getLaneX(laneIndex), hitY, LANE_COLORS[laneIndex], 10);
      charBob = 6;
    } else {
      judgment = 'GOOD'; color = '#69f0ae';
      charBob = 3;
    }

    combo++;
    if (combo > maxCombo) maxCombo = combo;
    const multiplier = Math.min(Math.floor(combo / 10) + 1, 8);
    score += SCORE_VAL[judgment] * multiplier;
    health = Math.min(100, health + HEALTH_DELTA[judgment]);
    counts[judgment]++;
    judgmentText = judgment;
    judgmentTimer = 0.5;
    judgmentColor = color;

    // Combo streak pulse
    if (combo > 0 && combo % 10 === 0) {
      bg.pulse(1.0);
    }
  }
}

// --- Screens ---
function drawTitle() {
  // Background pulse
  const pulse = Math.sin(performance.now() / 500) * 0.3 + 0.7;

  drawText('BEAT FORGE', W/2, H * 0.3, 64, `rgba(0,229,255,${pulse})`);
  drawText('A Guinea Pig Trench Rhythm Game', W/2, H * 0.3 + 50, 16, '#888');

  // Animated lanes preview
  const previewY = H * 0.5;
  for (let i = 0; i < 4; i++) {
    const lx = getLaneX(i);
    const bobT = Math.sin(performance.now() / 300 + i * 0.8) * 8;
    X.fillStyle = LANE_COLORS[i] + '88';
    X.fillRect(lx - NOTE_W/2, previewY + bobT - NOTE_H/2, NOTE_W, NOTE_H);
    drawGlow(lx, previewY + bobT, 30, LANE_COLORS[i]);
  }

  drawText('Press ENTER or Click to Start', W/2, H * 0.72, 20, '#fff');
  drawText('Keys: D  F  J  K', W/2, H * 0.78, 16, '#666');

  if (mouseClicked) state = 'charSelect';
}

function drawCharSelect() {
  drawText('SELECT YOUR FIGHTER', W/2, H * 0.08, 32, '#00e5ff');
  menuItems = [];

  const cols = 3, rows = 2;
  const cellW = 180, cellH = 200;
  const startX = W/2 - (cols * cellW) / 2 + cellW/2;
  const startY = H * 0.2;

  for (let i = 0; i < 6; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * cellW;
    const cy = startY + row * (cellH + 20) + cellH/2;

    const hover = mouseX > cx - cellW/2 && mouseX < cx + cellW/2 &&
                  mouseY > cy - cellH/2 && mouseY < cy + cellH/2;
    const selected = i === selectedChar;

    X.strokeStyle = selected ? '#00e5ff' : hover ? '#fff' : '#444';
    X.lineWidth = selected ? 3 : 1;
    X.shadowColor = selected ? '#00e5ff' : 'transparent';
    X.shadowBlur = selected ? 15 : 0;
    X.strokeRect(cx - cellW/2 + 10, cy - cellH/2, cellW - 20, cellH);
    X.shadowBlur = 0;

    if (hover) {
      X.fillStyle = 'rgba(255,255,255,0.03)';
      X.fillRect(cx - cellW/2 + 10, cy - cellH/2, cellW - 20, cellH);
    }

    // Draw sprite
    const img = charImages[i];
    if (img && img.complete && img.naturalWidth > 0) {
      const maxSpriteH = cellH - 50;
      const maxSpriteW = cellW - 40;
      const scale = Math.min(maxSpriteW / img.naturalWidth, maxSpriteH / img.naturalHeight, 1);
      const sw = img.naturalWidth * scale;
      const sh = img.naturalHeight * scale;
      X.drawImage(img, cx - sw/2, cy - sh/2 - 10, sw, sh);
    } else {
      // Fallback colored box
      X.fillStyle = LANE_COLORS[i % 4] + '44';
      X.fillRect(cx - 30, cy - 40, 60, 60);
      drawText('?', cx, cy - 10, 28, LANE_COLORS[i % 4]);
    }

    drawText(CHARACTERS[i].name, cx, cy + cellH/2 - 20, 14, selected ? '#00e5ff' : '#aaa');

    if (hover && mouseClicked) {
      selectedChar = i;
      charImg = charImages[i];
      state = 'songSelect';
    }
  }

  drawText('Click a character to continue', W/2, H * 0.92, 14, '#666');
}

function drawSongSelect() {
  drawText('SELECT TRACK', W/2, H * 0.1, 32, '#ff4081');

  for (let i = 0; i < SONGS.length; i++) {
    const s = SONGS[i];
    const cy = H * 0.3 + i * 120;
    const bx = W/2;
    const bw = 400, bh = 90;
    const hover = mouseX > bx - bw/2 && mouseX < bx + bw/2 &&
                  mouseY > cy - bh/2 && mouseY < cy + bh/2;

    X.strokeStyle = hover ? '#ff4081' : '#444';
    X.lineWidth = hover ? 2 : 1;
    X.shadowColor = hover ? '#ff4081' : 'transparent';
    X.shadowBlur = hover ? 10 : 0;
    X.strokeRect(bx - bw/2, cy - bh/2, bw, bh);
    X.shadowBlur = 0;

    if (hover) {
      X.fillStyle = 'rgba(255,64,129,0.05)';
      X.fillRect(bx - bw/2, cy - bh/2, bw, bh);
    }

    drawText(s.name, bx, cy - 15, 22, hover ? '#ff4081' : '#ccc');
    drawText(`${s.bpm} BPM - ${s.desc}`, bx, cy + 15, 14, '#888');

    if (hover && mouseClicked) {
      selectedSong = i;
      state = 'diffSelect';
    }
  }
}

function drawDiffSelect() {
  drawText('SELECT DIFFICULTY', W/2, H * 0.15, 32, '#ffd740');

  const diffColors = ['#69f0ae','#ffd740','#ff5252'];
  for (let i = 0; i < 3; i++) {
    const cy = H * 0.35 + i * 100;
    const bw = 300, bh = 70;
    const hover = mouseX > W/2 - bw/2 && mouseX < W/2 + bw/2 &&
                  mouseY > cy - bh/2 && mouseY < cy + bh/2;

    X.strokeStyle = hover ? diffColors[i] : '#444';
    X.lineWidth = hover ? 2 : 1;
    X.shadowColor = hover ? diffColors[i] : 'transparent';
    X.shadowBlur = hover ? 10 : 0;
    X.strokeRect(W/2 - bw/2, cy - bh/2, bw, bh);
    X.shadowBlur = 0;

    if (hover) {
      X.fillStyle = diffColors[i] + '11';
      X.fillRect(W/2 - bw/2, cy - bh/2, bw, bh);
    }

    drawText(DIFFICULTIES[i].name, W/2, cy, 24, hover ? diffColors[i] : '#aaa');

    if (hover && mouseClicked) {
      selectedDiff = i;
      startGame();
    }
  }
}

// --- Start game ---
function startGame() {
  state = 'playing';
  score = 0;
  combo = 0;
  maxCombo = 0;
  health = 100;
  counts = { PERFECT:0, GREAT:0, GOOD:0, MISS:0 };
  particles = [];
  laneFlash = [0,0,0,0];
  judgmentText = '';
  judgmentTimer = 0;
  charBob = 0;
  charShake = 0;
  gameOver = false;

  const song = SONGS[selectedSong];
  const diff = DIFFICULTIES[selectedDiff];
  notes = generateNotes(song, diff);
  songStart = performance.now();
  charImg = charImages[selectedChar];
}

// --- Gameplay drawing ---
function drawGameplay(dt) {
  const now = performance.now() - songStart;
  const song = SONGS[selectedSong];
  const diff = DIFFICULTIES[selectedDiff];
  const hitY = getHitY();
  const speed = 0.5 * diff.speedMul; // pixels per ms

  // Background lane lines
  const lanesLeft = getLaneX(0) - LANE_GAP/2;
  const lanesRight = getLaneX(3) + LANE_GAP/2;
  X.fillStyle = 'rgba(255,255,255,0.02)';
  X.fillRect(lanesLeft, 0, lanesRight - lanesLeft, H);

  for (let i = 0; i < 4; i++) {
    const lx = getLaneX(i);
    X.strokeStyle = 'rgba(255,255,255,0.06)';
    X.lineWidth = 1;
    X.beginPath();
    X.moveTo(lx, 0);
    X.lineTo(lx, H);
    X.stroke();
  }

  // Hit zone
  for (let i = 0; i < 4; i++) {
    const lx = getLaneX(i);
    const flash = laneFlash[i];

    // Glow
    drawGlow(lx, hitY, 40 + flash * 20, LANE_COLORS[i]);

    // Hit target
    X.strokeStyle = LANE_COLORS[i] + (flash > 0.3 ? 'ff' : '88');
    X.lineWidth = 2 + flash * 3;
    X.strokeRect(lx - NOTE_W/2, hitY - NOTE_H/2, NOTE_W, NOTE_H);

    // Key label
    X.globalAlpha = 0.5 + flash * 0.5;
    drawText(LANE_LABELS[i], lx, hitY + 30, 14, LANE_COLORS[i]);
    X.globalAlpha = 1;

    // Flash decay
    laneFlash[i] = Math.max(0, laneFlash[i] - dt * 4);
  }

  // Notes
  for (const note of notes) {
    if (note.hit) continue;

    const noteScreenTime = note.time - now;
    const ny = hitY - noteScreenTime * speed;
    note.y = ny;

    // Off screen check
    if (ny > hitY + 80 && !note.missed) {
      note.missed = true;
      counts.MISS++;
      combo = 0;
      health = Math.max(0, health + HEALTH_DELTA.MISS);
      charShake = 8;
      judgmentText = 'MISS';
      judgmentTimer = 0.4;
      judgmentColor = '#ff5252';
      bg.shake(0.2);
      if (health <= 0) { gameOver = true; }
    }

    if (ny < -50 || ny > H + 50) continue;

    const lx = getLaneX(note.lane);
    const color = LANE_COLORS[note.lane];

    // Note trail
    X.fillStyle = color + '22';
    X.fillRect(lx - NOTE_W/2 + 5, ny - 80, NOTE_W - 10, 80);

    // Note body
    X.fillStyle = color;
    X.shadowColor = color;
    X.shadowBlur = 8;
    X.fillRect(lx - NOTE_W/2, ny - NOTE_H/2, NOTE_W, NOTE_H);
    X.shadowBlur = 0;

    // Note highlight
    X.fillStyle = '#ffffff44';
    X.fillRect(lx - NOTE_W/2 + 2, ny - NOTE_H/2 + 2, NOTE_W - 4, NOTE_H/3);
  }

  // Character sprite
  drawCharacter(dt);

  // UI
  drawHUD(now);

  // Judgment text
  if (judgmentTimer > 0) {
    judgmentTimer -= dt;
    const alpha = Math.min(1, judgmentTimer * 3);
    const jy = hitY - 60 - (0.5 - judgmentTimer) * 30;
    X.globalAlpha = alpha;
    drawText(judgmentText, W * 0.55, jy, 28, judgmentColor);
    X.globalAlpha = 1;
  }

  // Particles
  updateParticles(dt);
  drawParticles();

  // Song end
  if (now >= songDuration + 2000 || gameOver) {
    state = 'results';
  }
}

function drawCharacter(dt) {
  const cx = W * 0.15;
  const cy = H * 0.5;
  const bobOffset = charBob > 0 ? Math.sin(performance.now() / 50) * charBob : 0;
  const shakeOffset = charShake > 0 ? (Math.random() - 0.5) * charShake : 0;

  charBob = Math.max(0, charBob - dt * 20);
  charShake = Math.max(0, charShake - dt * 20);

  const img = charImg;
  if (img && img.complete && img.naturalWidth > 0) {
    const maxH = 200;
    const scale = Math.min(maxH / img.naturalHeight, 180 / img.naturalWidth, 1);
    const sw = img.naturalWidth * scale;
    const sh = img.naturalHeight * scale;
    X.drawImage(img, cx - sw/2 + shakeOffset, cy - sh/2 + bobOffset, sw, sh);
  } else {
    // Fallback character
    X.fillStyle = LANE_COLORS[selectedChar % 4] + 'aa';
    X.fillRect(cx - 30 + shakeOffset, cy - 40 + bobOffset, 60, 80);
    drawText(CHARACTERS[selectedChar].name[0], cx + shakeOffset, cy + bobOffset, 36, '#fff');
  }

  // Character name
  drawText(CHARACTERS[selectedChar].name, cx, cy + 120, 14, '#888');
}

function drawHUD(now) {
  // Score
  drawText(score.toLocaleString(), W - 30, 40, 32, '#ffd740', 'right');
  drawText('SCORE', W - 30, 65, 12, '#888', 'right');

  // Combo
  if (combo > 1) {
    const comboScale = 1 + Math.min(combo / 50, 0.5);
    drawText(`${combo}x`, W * 0.55, getHitY() - 110, Math.floor(24 * comboScale), '#fff');
    drawText('COMBO', W * 0.55, getHitY() - 85, 10, '#888');
  }

  // Health bar
  const hbX = 20, hbY = 20, hbW = 200, hbH = 16;
  X.fillStyle = '#222';
  X.fillRect(hbX, hbY, hbW, hbH);
  const hColor = health > 50 ? '#69f0ae' : health > 25 ? '#ffd740' : '#ff5252';
  X.fillStyle = hColor;
  X.shadowColor = hColor;
  X.shadowBlur = 6;
  X.fillRect(hbX, hbY, hbW * (health / 100), hbH);
  X.shadowBlur = 0;
  X.strokeStyle = '#444';
  X.lineWidth = 1;
  X.strokeRect(hbX, hbY, hbW, hbH);
  drawText('HP', hbX + hbW + 15, hbY + hbH/2, 12, '#888', 'left');

  // Progress bar
  const prog = Math.min(1, now / songDuration);
  const pbY = hbY + 30;
  X.fillStyle = '#222';
  X.fillRect(hbX, pbY, hbW, 6);
  X.fillStyle = '#b388ff';
  X.fillRect(hbX, pbY, hbW * prog, 6);

  // Song info
  drawText(SONGS[selectedSong].name, hbX, pbY + 20, 12, '#888', 'left');

  // Multiplier
  const mult = Math.min(Math.floor(combo / 10) + 1, 8);
  if (mult > 1) {
    drawText(`x${mult}`, W - 30, 90, 18, '#b388ff', 'right');
    drawText('MULT', W - 30, 108, 10, '#666', 'right');
  }
}

// --- Results screen ---
function drawResults() {
  const total = counts.PERFECT + counts.GREAT + counts.GOOD + counts.MISS;
  const accuracy = total > 0 ? (counts.PERFECT * 100 + counts.GREAT * 75 + counts.GOOD * 50) / total : 0;

  let grade;
  if (accuracy >= 95 && counts.MISS === 0) grade = 'S';
  else if (accuracy >= 85) grade = 'A';
  else if (accuracy >= 70) grade = 'B';
  else if (accuracy >= 50) grade = 'C';
  else grade = 'F';

  const gradeColors = { S:'#00e5ff', A:'#69f0ae', B:'#ffd740', C:'#ff9800', F:'#ff5252' };

  if (gameOver && health <= 0) {
    drawText('STAGE FAILED', W/2, H * 0.08, 36, '#ff5252');
  } else {
    drawText('STAGE CLEAR', W/2, H * 0.08, 36, '#69f0ae');
  }

  drawText(SONGS[selectedSong].name, W/2, H * 0.15, 18, '#888');

  // Grade
  drawText(grade, W/2, H * 0.28, 80, gradeColors[grade]);

  // Score
  drawText(score.toLocaleString(), W/2, H * 0.42, 36, '#ffd740');
  drawText('SCORE', W/2, H * 0.47, 14, '#888');

  // Stats
  const statsY = H * 0.54;
  const statSpacing = 28;
  drawText(`PERFECT   ${counts.PERFECT}`, W/2, statsY, 18, '#00e5ff');
  drawText(`GREAT     ${counts.GREAT}`, W/2, statsY + statSpacing, 18, '#ffd740');
  drawText(`GOOD      ${counts.GOOD}`, W/2, statsY + statSpacing * 2, 18, '#69f0ae');
  drawText(`MISS      ${counts.MISS}`, W/2, statsY + statSpacing * 3, 18, '#ff5252');
  drawText(`MAX COMBO ${maxCombo}`, W/2, statsY + statSpacing * 4.5, 18, '#b388ff');

  // Buttons
  const btnY1 = H * 0.82;
  const btnY2 = H * 0.9;
  const btnW = 220, btnH = 42;

  const hover1 = mouseX > W/2 - btnW/2 && mouseX < W/2 + btnW/2 &&
                 mouseY > btnY1 - btnH/2 && mouseY < btnY1 + btnH/2;
  const hover2 = mouseX > W/2 - btnW/2 && mouseX < W/2 + btnW/2 &&
                 mouseY > btnY2 - btnH/2 && mouseY < btnY2 + btnH/2;

  drawButton('PLAY AGAIN', W/2, btnY1, btnW, btnH, hover1);
  drawButton('CHANGE TRACK', W/2, btnY2, btnW, btnH, hover2);

  if (mouseClicked) {
    if (hover1) startGame();
    if (hover2) state = 'songSelect';
  }
}

// --- Main loop ---
let lastTime = performance.now();

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  // Render 3D raymarched background
  bg.render(ts);

  // Clear with semi-transparent fill to let bg show through
  X.fillStyle = BG_COLOR;
  X.fillRect(0, 0, W, H);

  // Recalc hit Y (responsive)
  switch (state) {
    case 'title': drawTitle(); break;
    case 'charSelect': drawCharSelect(); break;
    case 'songSelect': drawSongSelect(); break;
    case 'diffSelect': drawDiffSelect(); break;
    case 'playing': drawGameplay(dt); break;
    case 'results': drawResults(); break;
  }

  // CRT overlay
  drawCRT();

  // Vignette
  const vg = X.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.9);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  X.fillStyle = vg;
  X.fillRect(0, 0, W, H);

  mouseClicked = false;
  requestAnimationFrame(loop);
}

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
  wn.textContent = 'THE THRESHOLD';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6531782679481783;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.013861287147125917;mix-blend-mode:overlay';
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



// CHAIN FIX: AUDIO
var _ac;function _tone(f,d,t,v){if(!_ac)_ac=new(AudioContext||webkitAudioContext)();var o=_ac.createOscillator(),g=_ac.createGain();o.type=t||"sine";o.frequency.value=f;o.detune.value=(Math.random()-.5)*8;g.gain.setValueAtTime(v||.08,_ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,_ac.currentTime+(d||.2));o.connect(g);g.connect(_ac.destination);o.start();o.stop(_ac.currentTime+(d||.2))}
function sndClick(){_tone(800,.06,"sine",.06)}
function sndSuccess(){_tone(523,.1);setTimeout(function(){_tone(659,.1)},70);setTimeout(function(){_tone(784,.15,"triangle",.08)},140)}
function sndFail(){_tone(200,.15,"sawtooth",.05)}
document.addEventListener("click",function(){if(!_ac)_ac=new(AudioContext||webkitAudioContext)()},{once:true});



// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
