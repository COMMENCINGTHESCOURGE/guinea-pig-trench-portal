// ============================================================
// PRIME SIEVE GAME — The Erdos-Straus Conjecture as Gameplay
// Each filter gate is a real prime modular filter.
// Your number is tested against each one.
// If the filter finds 4/n = 1/x + 1/y + 1/z (mod p), you dissolve.
// ============================================================

// ============================================================
// AUDIO ENGINE — Three voices of the sieve
//   eerrn  = saw oscillator, filter sweep (scanning candidates)
//   ooohm  = sine drone, low sustained (the modulus hum)
//   buomp  = sub-bass sine, fast decay (candidate eliminated)
// ============================================================

let audioCtx = null;
let audioStarted = false;

function initAudio() {
  if (audioStarted) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioStarted = true;
}

// EERRN — saw wave, low growl with grit. Like a dog warning you.
// Two detuned saws + waveshaper distortion + low-pass rumble.
function playEerrn(baseFreq = 90, duration = 0.5) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Main growl — low saw
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(baseFreq, now);
  osc1.frequency.linearRampToValueAtTime(baseFreq * 0.7, now + duration); // slow pitch drop

  // Detuned second saw — the rumble texture
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(baseFreq * 1.02, now); // slight detune = beating
  osc2.frequency.linearRampToValueAtTime(baseFreq * 0.72, now + duration);

  // Distortion — the grit in the growl
  const distortion = audioCtx.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 128) - 1;
    curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)); // soft clip
  }
  distortion.curve = curve;
  distortion.oversample = '2x';

  // Low pass — keeps it in the chest, not the ears
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(600, now);
  filter.frequency.linearRampToValueAtTime(200, now + duration);
  filter.Q.value = 2;

  // Amplitude envelope — swells then cuts
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.05); // fast attack
  gain.gain.setValueAtTime(0.15, now + duration * 0.7);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  // Chain: saws -> distortion -> filter -> gain -> out
  const merger = audioCtx.createGain();
  merger.gain.value = 0.5;
  osc1.connect(merger);
  osc2.connect(merger);
  merger.connect(distortion);
  distortion.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration + 0.05);
  osc2.stop(now + duration + 0.05);
}

// OOOHM — sine drone, warm and round. The modulus humming.
let oohmOsc = null;
let oohmGain = null;

function startOoohm(freq = 55) {
  if (!audioCtx) return;
  if (oohmOsc) return; // already running

  oohmOsc = audioCtx.createOscillator();
  oohmGain = audioCtx.createGain();

  oohmOsc.type = 'sine';
  oohmOsc.frequency.value = freq;

  // Add slight wobble — the modulus breathing
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3; // slow pulse
  lfoGain.gain.value = 2; // subtle pitch wobble
  lfo.connect(lfoGain);
  lfoGain.connect(oohmOsc.frequency);
  lfo.start();

  oohmGain.gain.value = 0;
  oohmGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 2);

  oohmOsc.connect(oohmGain);
  oohmGain.connect(audioCtx.destination);
  oohmOsc.start();
}

function stopOoohm() {
  if (!oohmGain || !oohmOsc) return;
  const now = audioCtx.currentTime;
  oohmGain.gain.linearRampToValueAtTime(0, now + 1);
  oohmOsc.stop(now + 1.1);
  oohmOsc = null;
  oohmGain = null;
}

// BUOMP — sub-bass hit, fast attack, quick decay. The kill shot.
function playBuomp(freq = 60, intensity = 1) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Sub bass body
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 2, now); // attack starts higher
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.15); // drops to sub

  gain.gain.setValueAtTime(0.3 * intensity, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.3);

  // Click transient (the "b" in buomp)
  const click = audioCtx.createOscillator();
  const clickGain = audioCtx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(800, now);
  click.frequency.exponentialRampToValueAtTime(100, now + 0.02);
  clickGain.gain.setValueAtTime(0.15 * intensity, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  click.connect(clickGain);
  clickGain.connect(audioCtx.destination);
  click.start(now);
  click.stop(now + 0.05);
}

// DISSOLVED — the full death sound. eerrn reversing + buomp + silence
function playDissolved() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Reverse eerrn (sweep UP = dissolving)
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, now);
  osc.frequency.exponentialRampToValueAtTime(2000, now + 0.6);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(500, now);
  filter.frequency.exponentialRampToValueAtTime(8000, now + 0.4);
  filter.Q.value = 6;

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.8);

  // Heavy buomp
  playBuomp(40, 1.5);

  // Kill the drone
  stopOoohm();
}

// PASS — survived a filter. Quick bright ping.
function playPass() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800 + Math.random() * 400, now);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

// --- MATH ENGINE (real Erdos-Straus sieve logic) ---

// Small prime filters for gameplay (first 200 primes after 23)
// In the real sieve, ~148K filters are used. We use enough to make it interesting.
function generatePrimes(count, startAfter) {
  const primes = [];
  let n = startAfter + 1;
  while (primes.length < count) {
    let isPrime = true;
    for (let i = 2; i * i <= n; i++) {
      if (n % i === 0) { isPrime = false; break; }
    }
    if (isPrime) primes.push(n);
    n++;
  }
  return primes;
}

// Check if 4/n = 1/x + 1/y + 1/z has a solution mod p
// This is the core sieve test from the real solver
function hasSolutionModP(n, p) {
  // For each a, b in [1, p-1], check if 4*a*b ≡ n*(a+b) + n*a*b*c for some c
  // Simplified: check if 4/n has a representation mod p
  // We use the direct approach: for x,y in [1,p), check if (4/n - 1/x - 1/y) has inverse mod p
  const nInv = modInverse(n, p);
  if (nInv === null) return true; // n ≡ 0 mod p, trivially solvable

  const fourOverN = (4 * nInv) % p;

  for (let x = 1; x < p; x++) {
    const xInv = modInverse(x, p);
    if (xInv === null) continue;
    for (let y = x; y < p; y++) {
      const yInv = modInverse(y, p);
      if (yInv === null) continue;
      const remainder = ((fourOverN - xInv - yInv) % p + p) % p;
      if (remainder === 0) continue; // z would be infinite
      const zInv = remainder;
      // Check if zInv has an inverse (i.e., gcd(zInv, p) === 1)
      if (gcd(zInv, p) === 1) return true;
    }
  }
  return false;
}

function modInverse(a, m) {
  a = ((a % m) + m) % m;
  if (a === 0) return null;
  let [old_r, r] = [a, m];
  let [old_s, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  if (old_r !== 1) return null;
  return ((old_s % m) + m) % m;
}

function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }

function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

// Generate filter primes (small set for real-time gameplay)
// Real sieve uses 148K primes; we use primes up to ~200 for playable speed
const FILTER_PRIMES = generatePrimes(80, 23);

// --- GAME STATE ---
let gameState = 'start'; // start, playing, dead
let playerN = 0;
let playerX = 0;
let playerY = 0;
let playerVY = 0;
let cameraX = 0;
let currentFilter = 0;
let filtersPassed = 0;
let dissolveTimer = 0;
let particles = [];
let gates = [];
let speed = 2;
let alive = true;
let deathReason = {};
let trailPoints = [];

// --- GATE GENERATION ---
function buildGates() {
  gates = [];
  for (let i = 0; i < FILTER_PRIMES.length; i++) {
    const p = FILTER_PRIMES[i];
    const solvable = hasSolutionModP(playerN, p);
    gates.push({
      x: 400 + i * 350,
      prime: p,
      solvable: solvable,
      passed: false,
      glow: 0,
      width: 60
    });
  }
}

// --- PARTICLE SYSTEM ---
function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 1,
      decay: 0.01 + Math.random() * 0.03,
      color,
      size: 2 + Math.random() * 4
    });
  }
}

// --- RESIZE ---
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- INPUT ---
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'Escape' && gameState === 'playing') {
    try { parent.postMessage({ type: 'pause_request' }, '*'); } catch(e) {}
  }
});
window.addEventListener('keyup', e => keys[e.key] = false);

// PostMessage listener for game shell
window.addEventListener('message', e => {
  if (e.data && e.data.type === 'pause') gameState = 'paused';
  if (e.data && e.data.type === 'resume') gameState = 'playing';
});

// --- START GAME ---
function startGame(n) {
  initAudio();
  playerN = n;
  playerX = 100;
  playerY = canvas.height / 2;
  playerVY = 0;
  cameraX = 0;
  currentFilter = 0;
  filtersPassed = 0;
  dissolveTimer = 0;
  alive = true;
  particles = [];
  trailPoints = [];
  speed = 2.5;

  buildGates();

  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('death-screen').style.display = 'none';
  document.getElementById('hud-n').textContent = `n = ${playerN}`;
  document.getElementById('hud-residue').textContent = `mod 24: ${playerN % 24}`;

  gameState = 'playing';

  // Start the ooohm drone — the modulus hum
  startOoohm(55);
}

function showDeath() {
  gameState = 'dead';
  const ds = document.getElementById('death-screen');
  ds.style.display = 'flex';

  const totalFilters = FILTER_PRIMES.length;
  const pct = ((filtersPassed / totalFilters) * 100).toFixed(1);

  if (deathReason.type === 'filtered') {
    document.getElementById('death-title').textContent = 'DISSOLVED';
    document.getElementById('death-title').style.color = '#f44';
    document.getElementById('death-n').textContent = `n = ${playerN} was solvable mod ${deathReason.prime}`;
    document.getElementById('death-filter').textContent = `4/${playerN} has a decomposition modulo ${deathReason.prime}`;
    document.getElementById('death-solution').textContent = `The filter found: 4/${playerN} = 1/x + 1/y + 1/z (mod ${deathReason.prime})`;
  } else if (deathReason.type === 'survived') {
    document.getElementById('death-title').textContent = 'SURVIVED ALL FILTERS';
    document.getElementById('death-title').style.color = '#0f0';
    document.getElementById('death-n').textContent = `n = ${playerN} passed all ${totalFilters} filter gates`;
    document.getElementById('death-filter').textContent = isPrime(playerN)
      ? `${playerN} is PRIME — a true survivor (but the conjecture still holds: brute-force would find a solution)`
      : `${playerN} is COMPOSITE — factorable, so the conjecture holds trivially`;
    document.getElementById('death-solution').textContent = isPrime(playerN)
      ? `No prime has ever been a true counterexample to 10^14. You found a hard case!`
      : `Composite numbers always have solutions via their factors.`;
  }

  document.getElementById('death-survived').textContent = `Filters survived: ${filtersPassed} / ${totalFilters}`;
  document.getElementById('death-percentile').textContent = `Sieve depth: ${pct}%`;
}

// --- UPDATE ---
function update() {
  if (gameState !== 'playing') return;

  // Player movement
  const gravity = 0.15;
  const thrust = -0.4;
  const maxVY = 6;

  if (keys['ArrowUp'] || keys['w'] || keys[' ']) playerVY += thrust;
  if (keys['ArrowDown'] || keys['s']) playerVY += 0.3;

  playerVY += gravity;
  playerVY = Math.max(-maxVY, Math.min(maxVY, playerVY));
  playerY += playerVY;

  // Bounds
  playerY = Math.max(30, Math.min(canvas.height - 30, playerY));

  // Camera follows
  cameraX += speed;
  playerX = 150; // fixed screen position

  // Trail
  trailPoints.push({ x: cameraX + playerX, y: playerY, life: 1 });
  if (trailPoints.length > 60) trailPoints.shift();

  // Check gates
  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i];
    if (gate.passed) continue;

    const screenX = gate.x - cameraX;

    // Player reaches gate
    if (screenX < playerX + 15 && screenX + gate.width > playerX - 15) {
      if (gate.solvable) {
        // FILTERED — number is solvable mod this prime
        alive = false;
        dissolveTimer = 1;
        deathReason = { type: 'filtered', prime: gate.prime };
        spawnParticles(playerX, playerY, '#f44', 50);
        gate.glow = 1;
        playDissolved(); // eerrn reverse + buomp + drone dies
        return;
      } else {
        // SURVIVED this filter
        gate.passed = true;
        filtersPassed++;
        spawnParticles(screenX + gate.width / 2, playerY, '#0f0', 20);
        gate.glow = 1;
        speed = Math.min(5, speed + 0.03);
        playPass(); // bright ping
        // Growl on approach to next gate
        if (filtersPassed % 3 === 0) playEerrn(80 + filtersPassed * 2);

        document.getElementById('hud-filters').textContent = `FILTERS: ${filtersPassed}`;
        document.getElementById('hud-status').textContent = `ALIVE — ${filtersPassed}/${FILTER_PRIMES.length}`;
      }
    }
  }

  // Check if survived all gates
  if (filtersPassed >= gates.length) {
    deathReason = { type: 'survived' };
    showDeath();
    return;
  }

  // Dissolve animation
  if (!alive) {
    dissolveTimer -= 0.02;
    if (dissolveTimer <= 0) showDeath();
  }

  // Update particles
  particles = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    p.vx *= 0.98;
    p.vy *= 0.98;
    return p.life > 0;
  });

  // Gate glow decay
  gates.forEach(g => { if (g.glow > 0) g.glow *= 0.95; });
}

// --- RENDER ---
function render() {
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === 'start') return;

  const cy = canvas.height;

  // Grid lines (scrolling background)
  ctx.strokeStyle = 'rgba(0, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const gridSize = 80;
  const offsetX = -(cameraX % gridSize);
  for (let x = offsetX; x < canvas.width; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cy); ctx.stroke();
  }
  for (let y = 0; y < cy; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // Number line at bottom
  ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
  ctx.fillRect(0, cy - 3, canvas.width, 3);

  // Trail
  for (let i = 0; i < trailPoints.length; i++) {
    const t = trailPoints[i];
    const screenX = t.x - cameraX;
    const alpha = (i / trailPoints.length) * 0.4;
    ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(screenX, t.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gates
  for (const gate of gates) {
    const sx = gate.x - cameraX;
    if (sx < -100 || sx > canvas.width + 100) continue;

    const gateH = cy;
    const gapY = cy / 2;
    const gapSize = gate.solvable ? 120 : 180; // solvable gates have smaller gaps (harder to dodge visually)

    if (gate.passed) {
      // Passed gate — green outline
      ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 + gate.glow * 0.7})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, 0, gate.width, gateH);

      // Prime label
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.font = '12px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`p=${gate.prime}`, sx + gate.width / 2, 20);
      ctx.fillText('PASS', sx + gate.width / 2, 36);
    } else if (!alive && gate === gates[gates.findIndex(g => !g.passed)]) {
      // Death gate — red
      const alpha = 0.5 + gate.glow * 0.5;
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha * 0.3})`;
      ctx.fillRect(sx, 0, gate.width, gateH);
      ctx.strokeStyle = `rgba(255, 50, 50, ${alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx, 0, gate.width, gateH);

      ctx.fillStyle = '#f44';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`p=${gate.prime}`, sx + gate.width / 2, 20);
      ctx.fillText('FILTERED', sx + gate.width / 2, 36);
    } else {
      // Upcoming gate — cyan
      const dist = Math.max(0, (sx - playerX) / canvas.width);
      const alpha = Math.max(0.1, 0.6 - dist * 0.5);

      // Gate bars (top and bottom with gap)
      ctx.fillStyle = `rgba(0, 200, 255, ${alpha * 0.15})`;
      ctx.fillRect(sx, 0, gate.width, gateH);

      ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, 0, gate.width, gateH);

      // Warning indicators for solvable gates
      if (gate.solvable) {
        const pulse = Math.sin(Date.now() * 0.005 + gate.prime) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(255, 100, 50, ${alpha * pulse * 0.2})`;
        ctx.fillRect(sx, 0, gate.width, gateH);
      }

      ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
      ctx.font = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`p=${gate.prime}`, sx + gate.width / 2, 20);
    }
  }

  // Player
  if (alive || dissolveTimer > 0) {
    const size = alive ? 20 : 20 * dissolveTimer;
    const alpha = alive ? 1 : dissolveTimer;

    // Glow
    const gradient = ctx.createRadialGradient(playerX, playerY, 0, playerX, playerY, size * 2);
    gradient.addColorStop(0, `rgba(0, 255, 255, ${alpha * 0.4})`);
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(playerX, playerY, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = alive ? `rgba(255, 255, 255, ${alpha})` : `rgba(255, 80, 80, ${alpha})`;
    ctx.beginPath();
    ctx.arc(playerX, playerY, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Number label
    ctx.fillStyle = `rgba(0, 255, 255, ${alpha})`;
    ctx.font = 'bold 14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(playerN.toString(), playerX, playerY - size - 5);

    // Mod 24 residue class indicator
    const mod24 = playerN % 24;
    const hardCase = (mod24 === 1 || mod24 === 17);
    ctx.font = '10px Courier New';
    ctx.fillStyle = hardCase ? 'rgba(255, 200, 0, 0.8)' : 'rgba(100, 200, 255, 0.6)';
    ctx.fillText(hardCase ? 'HARD RESIDUE' : `mod24=${mod24}`, playerX, playerY + size + 15);
  }

  // Particles
  for (const p of particles) {
    ctx.fillStyle = `rgba(${hexToRgb(p.color)}, ${p.life})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }

  // Progress bar at bottom
  if (gameState === 'playing' || gameState === 'dead') {
    const barY = cy - 20;
    const barW = canvas.width - 40;
    const progress = filtersPassed / FILTER_PRIMES.length;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(20, barY, barW, 8);

    ctx.fillStyle = alive ? 'rgba(0, 255, 255, 0.5)' : 'rgba(255, 50, 50, 0.5)';
    ctx.fillRect(20, barY, barW * progress, 8);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'right';
    ctx.fillText(`${(progress * 100).toFixed(1)}% of sieve`, canvas.width - 20, barY - 4);
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// --- GAME LOOP ---
function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// --- UI BINDINGS ---
document.getElementById('start-btn').addEventListener('click', () => {
  const input = document.getElementById('num-input').value.trim();
  let n;
  if (input === '' || isNaN(parseInt(input))) {
    // Random number: pick from interesting ranges
    const ranges = [
      () => Math.floor(Math.random() * 1000) + 2,          // small
      () => Math.floor(Math.random() * 10000) + 1000,       // medium
      () => Math.floor(Math.random() * 100000) + 10000,     // large
    ];
    n = ranges[Math.floor(Math.random() * ranges.length)]();
    // Bias toward hard residues sometimes
    if (Math.random() < 0.3) {
      while (n % 24 !== 1 && n % 24 !== 17) n++;
    }
  } else {
    n = Math.max(2, parseInt(input));
  }
  startGame(n);
});

document.getElementById('num-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('start-btn').click();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('death-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'flex';
  document.getElementById('num-input').value = '';
  document.getElementById('num-input').focus();
  gameState = 'start';
});

// Start
loop();