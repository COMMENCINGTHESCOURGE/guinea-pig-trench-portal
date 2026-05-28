
'use strict';
const bg = new RayBG('bg', 'space', {dim: 0.3, accent: [0, 0.82, 1]});
const C = document.getElementById('g');
const X = C.getContext('2d');
const W = 800, H = 600;
const GROUND_Y = 520;
const GRAVITY = 0.5;
const TEAL = '#00d2ff';
const GOLD = '#ffd700';
let rafId = null;
const DARK = '#03060f';
const RED = '#ff3333';
const GREEN_C = '#33ff66';
const PINK_C = '#ff69b4';

// --- Input ---
const keys = {};
let mouseX = W/2, mouseY = H/2, mouseDown = false, mouseClicked = false;
document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; e.preventDefault(); });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
C.addEventListener('mousemove', e => { const r = C.getBoundingClientRect(); mouseX = (e.clientX - r.left) * W / r.width; mouseY = (e.clientY - r.top) * H / r.height; });
C.addEventListener('mousedown', e => { mouseDown = true; mouseClicked = true; });
C.addEventListener('mouseup', e => { mouseDown = false; });
C.addEventListener('contextmenu', e => e.preventDefault());

// --- Audio (minimal synth) ---
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(freq, dur, type='square', vol=0.15) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
}
function sfxShoot() { playSound(800, 0.08, 'square', 0.1); playSound(400, 0.06, 'sawtooth', 0.05); }
function sfxHit() { playSound(200, 0.15, 'sawtooth', 0.12); }
function sfxExplosion() { playSound(80, 0.3, 'sawtooth', 0.2); playSound(60, 0.4, 'square', 0.1); }
function sfxPickup() { playSound(600, 0.08, 'sine', 0.1); playSound(900, 0.1, 'sine', 0.08); }
function sfxDodge() { playSound(300, 0.1, 'triangle', 0.08); }
function sfxBeam() { playSound(150, 0.5, 'sine', 0.06); }
function sfxBoss() { playSound(60, 0.6, 'sawtooth', 0.15); }

// --- Particles ---
let particles = [];
function spawnParticles(x, y, count, color, speed=3, life=30) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed + 1;
        particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 1, life, maxLife: life, color, size: Math.random()*3+1 });
    }
}
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }
}
function drawParticles() {
    for (const p of particles) {
        const a = p.life / p.maxLife;
        X.globalAlpha = a;
        X.fillStyle = p.color;
        X.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    X.globalAlpha = 1;
}

// --- Stars (background) ---
const stars = [];
for (let i = 0; i < 120; i++) stars.push({ x: Math.random()*W, y: Math.random()*(GROUND_Y-50), size: Math.random()*2+0.5, twinkle: Math.random()*Math.PI*2, speed: Math.random()*0.02+0.01 });

// --- Parallax layers ---
let scrollOffset = 0;
const mountains1 = []; // far
const mountains2 = []; // near
for (let i = 0; i < 20; i++) { mountains1.push({ x: i*80, h: Math.random()*60+30 }); mountains2.push({ x: i*60, h: Math.random()*40+20 }); }

// --- Game State ---
let gameState = 'title'; // title, select, playing, gameover, waveComplete
let selectedChar = 0; // 0=pink, 1=green
let score = 0, lives = 3, wave = 1, waveTimer = 0;
let enemiesRemaining = 0, totalEnemies = 0;
let waveCompleteTimer = 0;
let bossActive = false;
let screenShake = 0;

// --- Player ---
let player = null;
function resetPlayer() {
    player = {
        x: 100, y: GROUND_Y - 40, w: 28, h: 40,
        vx: 0, vy: 0, onGround: true,
        hp: 100, maxHp: 100,
        ammo: 50, maxAmmo: 99,
        shield: 0,
        facing: 1, // 1=right, -1=left
        shooting: false, shootCooldown: 0,
        dodging: false, dodgeTimer: 0, dodgeCooldown: 0,
        invuln: 0,
        walkFrame: 0, walkTimer: 0,
        abducting: false, abductTimer: 0,
        muzzleFlash: 0
    };
}

// --- Enemies ---
let enemies = [];
let ufos = [];
let bullets = [];
let items = [];
let enemyBullets = [];

// --- Procedural Drawing Helpers ---
function drawPixelChar(x, y, w, h, color, facing, frame, isDodging) {
    X.save();
    X.translate(x, y);
    if (isDodging) { X.rotate(facing * frame * 0.5); X.globalAlpha = 0.6; }
    // Body
    X.fillStyle = color;
    X.fillRect(-w/2, -h*0.6, w, h*0.6);
    // Head
    const skinColor = '#ffcc99';
    X.fillStyle = skinColor;
    X.fillRect(-w*0.3, -h, w*0.6, h*0.35);
    // Eyes
    X.fillStyle = '#000';
    X.fillRect(-w*0.15, -h*0.85, 3, 3);
    X.fillRect(w*0.05, -h*0.85, 3, 3);
    // Legs
    const legOff = Math.sin(frame * 0.3) * 4;
    X.fillStyle = color === PINK_C ? '#cc5599' : '#226633';
    X.fillRect(-w*0.3, 0, w*0.25, h*0.4 + legOff);
    X.fillRect(w*0.05, 0, w*0.25, h*0.4 - legOff);
    // Boots
    X.fillStyle = '#333';
    X.fillRect(-w*0.35, h*0.35 + legOff, w*0.35, 6);
    X.fillRect(w*0.02, h*0.35 - legOff, w*0.35, 6);
    // Gun arm
    X.fillStyle = '#888';
    const gunX = facing > 0 ? w*0.3 : -w*0.6;
    X.fillRect(gunX, -h*0.45, w*0.4, 6);
    X.fillStyle = '#555';
    X.fillRect(gunX + (facing > 0 ? w*0.3 : -4), -h*0.48, 8, 10);
    // Helmet visor
    X.fillStyle = TEAL + '88';
    X.fillRect(-w*0.25, -h*0.95, w*0.5, h*0.15);
    X.restore();
}

function drawUFO(x, y, w, h, hpRatio, beamActive, frame) {
    X.save();
    X.translate(x, y + Math.sin(frame * 0.05) * 3);
    // Glow
    const grd = X.createRadialGradient(0, 0, w*0.2, 0, 0, w*0.8);
    grd.addColorStop(0, TEAL + '22');
    grd.addColorStop(1, 'transparent');
    X.fillStyle = grd;
    X.fillRect(-w, -h, w*2, h*2);
    // Dome
    X.fillStyle = '#667788';
    X.beginPath();
    X.ellipse(0, -h*0.2, w*0.3, h*0.5, 0, Math.PI, 0);
    X.fill();
    X.fillStyle = TEAL + '66';
    X.beginPath();
    X.ellipse(0, -h*0.3, w*0.2, h*0.3, 0, Math.PI, 0);
    X.fill();
    // Saucer body
    X.fillStyle = '#556677';
    X.beginPath();
    X.ellipse(0, 0, w*0.6, h*0.25, 0, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = '#778899';
    X.beginPath();
    X.ellipse(0, -h*0.05, w*0.55, h*0.15, 0, 0, Math.PI * 2);
    X.fill();
    // Lights
    for (let i = 0; i < 5; i++) {
        const lx = (i - 2) * w * 0.2;
        const blink = Math.sin(frame * 0.1 + i) > 0;
        X.fillStyle = blink ? GOLD : TEAL;
        X.beginPath();
        X.arc(lx, h*0.05, 3, 0, Math.PI * 2);
        X.fill();
    }
    // Damage overlay
    if (hpRatio < 0.5) {
        X.fillStyle = RED + '44';
        X.beginPath();
        X.ellipse(0, 0, w*0.6, h*0.25, 0, 0, Math.PI * 2);
        X.fill();
        if (Math.random() < 0.3) spawnParticles(x + (Math.random()-0.5)*w, y, 1, '#ff6600', 1, 10);
    }
    // Beam
    if (beamActive) {
        const beamGrd = X.createLinearGradient(0, h*0.2, 0, GROUND_Y - y);
        beamGrd.addColorStop(0, TEAL + 'aa');
        beamGrd.addColorStop(0.5, TEAL + '44');
        beamGrd.addColorStop(1, TEAL + '11');
        X.fillStyle = beamGrd;
        X.beginPath();
        X.moveTo(-w*0.15, h*0.2);
        X.lineTo(-w*0.5, GROUND_Y - y);
        X.lineTo(w*0.5, GROUND_Y - y);
        X.lineTo(w*0.15, h*0.2);
        X.fill();
        // Beam particles
        for (let i = 0; i < 3; i++) {
            const py = h*0.2 + Math.random() * (GROUND_Y - y - h*0.2);
            const pw = w*0.15 + (py / (GROUND_Y - y)) * w * 0.35;
            X.fillStyle = TEAL;
            X.globalAlpha = Math.random() * 0.3 + 0.1;
            X.fillRect(-pw + Math.random()*pw*2, py, 3, 3);
        }
        X.globalAlpha = 1;
    }
    X.restore();
}

function drawAlien(x, y, w, h, variant, frame, hpRatio) {
    X.save();
    X.translate(x, y);
    const colors = ['#44ff44', '#ff44ff', '#ffaa00', '#4444ff'];
    const c = colors[variant % colors.length];
    // Body
    X.fillStyle = c;
    X.fillRect(-w*0.35, -h*0.5, w*0.7, h*0.5);
    // Head
    X.fillStyle = c;
    X.beginPath();
    X.ellipse(0, -h*0.6, w*0.35, h*0.3, 0, 0, Math.PI * 2);
    X.fill();
    // Eyes (big alien eyes)
    X.fillStyle = '#000';
    X.beginPath();
    X.ellipse(-w*0.12, -h*0.65, 5, 7, -0.2, 0, Math.PI * 2);
    X.fill();
    X.beginPath();
    X.ellipse(w*0.12, -h*0.65, 5, 7, 0.2, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = RED;
    X.beginPath();
    X.ellipse(-w*0.12, -h*0.65, 2, 3, 0, 0, Math.PI * 2);
    X.fill();
    X.beginPath();
    X.ellipse(w*0.12, -h*0.65, 2, 3, 0, 0, Math.PI * 2);
    X.fill();
    // Legs (walking)
    const legOff = Math.sin(frame * 0.15) * 5;
    X.fillStyle = c;
    X.fillRect(-w*0.3, 0, w*0.25, h*0.35 + legOff);
    X.fillRect(w*0.05, 0, w*0.25, h*0.35 - legOff);
    // Weapon
    X.fillStyle = '#888';
    X.fillRect(-w*0.5, -h*0.3, w*0.2, 5);
    // HP bar
    if (hpRatio < 1) {
        X.fillStyle = '#333';
        X.fillRect(-w*0.4, -h - 8, w*0.8, 4);
        X.fillStyle = hpRatio > 0.5 ? GREEN_C : RED;
        X.fillRect(-w*0.4, -h - 8, w*0.8 * hpRatio, 4);
    }
    X.restore();
}

function drawMechBoss(x, y, w, h, frame, hpRatio) {
    X.save();
    X.translate(x, y);
    // Shadow
    X.fillStyle = '#00000044';
    X.fillRect(-w*0.5, h*0.45, w, 10);
    // Legs (mech style)
    X.fillStyle = '#445566';
    X.fillRect(-w*0.35, h*0.1, 12, h*0.4);
    X.fillRect(w*0.2, h*0.1, 12, h*0.4);
    X.fillStyle = '#334455';
    X.fillRect(-w*0.4, h*0.4, 18, 10);
    X.fillRect(w*0.15, h*0.4, 18, 10);
    // Main body
    X.fillStyle = '#556677';
    X.fillRect(-w*0.4, -h*0.3, w*0.8, h*0.45);
    // Chest core
    const coreGlow = Math.sin(frame * 0.1) * 0.3 + 0.7;
    X.fillStyle = `rgba(255, 0, 0, ${coreGlow})`;
    X.beginPath();
    X.arc(0, -h*0.1, 8, 0, Math.PI * 2);
    X.fill();
    X.fillStyle = GOLD;
    X.beginPath();
    X.arc(0, -h*0.1, 4, 0, Math.PI * 2);
    X.fill();
    // Head
    X.fillStyle = '#667788';
    X.fillRect(-w*0.2, -h*0.55, w*0.4, h*0.25);
    // Visor
    X.fillStyle = RED + 'cc';
    X.fillRect(-w*0.15, -h*0.5, w*0.3, h*0.1);
    // Arms / cannons
    X.fillStyle = '#445566';
    const armBob = Math.sin(frame * 0.08) * 3;
    X.fillRect(-w*0.6, -h*0.25 + armBob, w*0.25, 14);
    X.fillRect(w*0.35, -h*0.25 - armBob, w*0.25, 14);
    // Cannon tips
    X.fillStyle = RED;
    X.fillRect(-w*0.65, -h*0.22 + armBob, 6, 8);
    X.fillRect(w*0.55, -h*0.22 - armBob, 6, 8);
    // Shoulder plates
    X.fillStyle = '#778899';
    X.fillRect(-w*0.45, -h*0.35, w*0.15, h*0.15);
    X.fillRect(w*0.3, -h*0.35, w*0.15, h*0.15);
    // Damage sparks
    if (hpRatio < 0.5 && Math.random() < 0.1) {
        spawnParticles(x + (Math.random()-0.5)*w, y - h*0.3, 2, '#ffaa00', 2, 15);
    }
    // HP bar (wide, at top)
    X.fillStyle = '#333';
    X.fillRect(-w*0.5, -h*0.7, w, 6);
    X.fillStyle = hpRatio > 0.5 ? RED : GOLD;
    X.fillRect(-w*0.5, -h*0.7, w * hpRatio, 6);
    X.fillStyle = '#fff';
    X.font = '8px monospace';
    X.textAlign = 'center';
    X.fillText('MECH BOSS', 0, -h*0.7 - 4);
    X.restore();
}

function drawItem(x, y, type, frame) {
    X.save();
    X.translate(x, y + Math.sin(frame * 0.1) * 3);
    const glow = X.createRadialGradient(0, 0, 2, 0, 0, 14);
    switch(type) {
        case 'health':
            glow.addColorStop(0, '#ff333344'); glow.addColorStop(1, 'transparent');
            X.fillStyle = glow; X.fillRect(-14,-14,28,28);
            X.fillStyle = RED;
            X.fillRect(-5, -8, 10, 16);
            X.fillRect(-8, -5, 16, 10);
            break;
        case 'ammo':
            glow.addColorStop(0, '#ffdd0044'); glow.addColorStop(1, 'transparent');
            X.fillStyle = glow; X.fillRect(-14,-14,28,28);
            X.fillStyle = GOLD;
            X.fillRect(-3, -8, 6, 14);
            X.fillStyle = '#cc8800';
            X.fillRect(-4, 4, 8, 4);
            break;
        case 'shield':
            glow.addColorStop(0, '#00d2ff44'); glow.addColorStop(1, 'transparent');
            X.fillStyle = glow; X.fillRect(-14,-14,28,28);
            X.fillStyle = TEAL;
            X.beginPath();
            X.moveTo(0, -8);
            X.lineTo(8, -3);
            X.lineTo(6, 8);
            X.lineTo(0, 10);
            X.lineTo(-6, 8);
            X.lineTo(-8, -3);
            X.closePath();
            X.fill();
            X.fillStyle = '#03060f';
            X.beginPath();
            X.moveTo(0, -4);
            X.lineTo(4, -1);
            X.lineTo(3, 5);
            X.lineTo(0, 6);
            X.lineTo(-3, 5);
            X.lineTo(-4, -1);
            X.closePath();
            X.fill();
            break;
        case 'coin':
            glow.addColorStop(0, '#ffd70044'); glow.addColorStop(1, 'transparent');
            X.fillStyle = glow; X.fillRect(-14,-14,28,28);
            X.fillStyle = GOLD;
            X.beginPath();
            X.arc(0, 0, 7, 0, Math.PI*2);
            X.fill();
            X.fillStyle = '#cc8800';
            X.font = 'bold 10px monospace';
            X.textAlign = 'center';
            X.textBaseline = 'middle';
            X.fillText('$', 0, 0);
            break;
    }
    X.restore();
}

function drawMuzzleFlash(x, y, facing) {
    X.save();
    X.translate(x + facing * 20, y);
    X.fillStyle = '#ffff00';
    X.globalAlpha = 0.8;
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
        const r = 6 + Math.random() * 8;
        X.fillRect(Math.cos(a)*r - 1, Math.sin(a)*r - 1, 3, 3);
    }
    X.fillStyle = '#ffffff';
    X.beginPath();
    X.arc(0, 0, 4, 0, Math.PI * 2);
    X.fill();
    X.restore();
}

// --- Environment props ---
const envProps = [];
function generateEnvProps() {
    envProps.length = 0;
    for (let i = 0; i < 8; i++) {
        const type = ['tree','barrel','crate','rock'][Math.floor(Math.random()*4)];
        envProps.push({ x: 100 + Math.random() * 600, type });
    }
}
generateEnvProps();

function drawEnvProp(prop, frame) {
    const x = prop.x;
    const y = GROUND_Y;
    X.save();
    switch(prop.type) {
        case 'tree':
            X.fillStyle = '#443322';
            X.fillRect(x-4, y-45, 8, 45);
            X.fillStyle = '#226622';
            X.beginPath();
            X.moveTo(x, y-70);
            X.lineTo(x-20, y-30);
            X.lineTo(x+20, y-30);
            X.closePath();
            X.fill();
            X.fillStyle = '#338833';
            X.beginPath();
            X.moveTo(x, y-55);
            X.lineTo(x-15, y-25);
            X.lineTo(x+15, y-25);
            X.closePath();
            X.fill();
            break;
        case 'barrel':
            X.fillStyle = '#664422';
            X.fillRect(x-8, y-20, 16, 20);
            X.fillStyle = '#553311';
            X.fillRect(x-9, y-18, 18, 3);
            X.fillRect(x-9, y-8, 18, 3);
            break;
        case 'crate':
            X.fillStyle = '#886633';
            X.fillRect(x-10, y-18, 20, 18);
            X.strokeStyle = '#664411';
            X.lineWidth = 1;
            X.strokeRect(x-10, y-18, 20, 18);
            X.beginPath();
            X.moveTo(x-10, y-18); X.lineTo(x+10, y);
            X.moveTo(x+10, y-18); X.lineTo(x-10, y);
            X.stroke();
            break;
        case 'rock':
            X.fillStyle = '#556666';
            X.beginPath();
            X.moveTo(x-12, y);
            X.lineTo(x-10, y-14);
            X.lineTo(x-2, y-18);
            X.lineTo(x+8, y-15);
            X.lineTo(x+12, y-5);
            X.lineTo(x+10, y);
            X.closePath();
            X.fill();
            X.fillStyle = '#667777';
            X.beginPath();
            X.moveTo(x-8, y-2);
            X.lineTo(x-6, y-12);
            X.lineTo(x+2, y-14);
            X.lineTo(x+8, y-8);
            X.closePath();
            X.fill();
            break;
    }
    X.restore();
}

// --- Spawn Logic ---
function spawnWave() {
    bossActive = false;
    const isBossWave = (wave % 5 === 0);
    if (isBossWave) {
        // Boss wave
        const bossHp = 200 + wave * 30;
        enemies.push({
            x: W + 50, y: GROUND_Y - 70, w: 70, h: 90,
            vx: -0.5, hp: bossHp, maxHp: bossHp,
            type: 'boss', variant: 0, shootTimer: 0, frame: 0,
            shootRate: Math.max(40, 100 - wave * 3)
        });
        bossActive = true;
        totalEnemies = 1;
        enemiesRemaining = 1;
        // Some support aliens
        const extras = Math.min(wave, 8);
        for (let i = 0; i < extras; i++) {
            spawnAlien(W + 100 + i * 80);
            totalEnemies++; enemiesRemaining++;
        }
        sfxBoss();
        bg.warp(0.5);
    } else {
        const count = 4 + wave * 2;
        totalEnemies = count;
        enemiesRemaining = count;
        for (let i = 0; i < count; i++) {
            setTimeout(() => spawnAlien(W + 50 + Math.random() * 200), i * 600);
        }
        // UFOs
        const ufoCount = Math.min(1 + Math.floor(wave / 2), 4);
        for (let i = 0; i < ufoCount; i++) {
            setTimeout(() => spawnUFO(), (i + 1) * 2000);
        }
    }
}

function spawnAlien(startX) {
    if (gameState !== 'playing') return;
    const variant = Math.floor(Math.random() * 4);
    const hp = 15 + wave * 5;
    enemies.push({
        x: startX, y: GROUND_Y - 30, w: 24, h: 36,
        vx: -(0.8 + Math.random() * 0.5 + wave * 0.05),
        hp, maxHp: hp,
        type: 'alien', variant,
        shootTimer: Math.random() * 120,
        shootRate: Math.max(60, 150 - wave * 5),
        frame: 0
    });
}

function spawnUFO() {
    if (gameState !== 'playing') return;
    const hp = 50 + wave * 10;
    ufos.push({
        x: W + 40, y: 60 + Math.random() * 60, w: 60, h: 30,
        vx: -(0.3 + Math.random() * 0.3), hp, maxHp: hp,
        beamActive: false, beamTimer: 0, beamCooldown: 180 + Math.random() * 120,
        frame: 0, targetX: 100 + Math.random() * 500
    });
}

function spawnItem(x, y) {
    const r = Math.random();
    let type;
    if (r < 0.3) type = 'health';
    else if (r < 0.55) type = 'ammo';
    else if (r < 0.7) type = 'shield';
    else type = 'coin';
    items.push({ x, y, type, vy: -3, onGround: false, life: 300, frame: 0 });
}

// --- Hitbox Config ---
// Hitboxes are smaller than visual sprites for fairer gameplay.
// All values are {wScale, hScale, yOff} relative to entity's w/h.
const HITBOX_CONFIG = {
    player:  { wScale: 0.65, hScale: 0.75, yOff: 0.1 },   // forgiving: smaller than sprite
    alien:   { wScale: 0.8,  hScale: 0.85, yOff: 0.05 },
    boss:    { wScale: 0.75, hScale: 0.8,  yOff: 0.05 },   // large but slightly inset
    ufo:     { wScale: 0.85, hScale: 0.7,  yOff: 0.15 },   // saucer shape: wide but thin center
    bullet:  { wScale: 1.0,  hScale: 1.0,  yOff: 0.0 },    // bullets use full point check
};

function getEntityHitbox(entity, type) {
    const cfg = HITBOX_CONFIG[type] || { wScale: 1, hScale: 1, yOff: 0 };
    const hw = entity.w * cfg.wScale;
    const hh = entity.h * cfg.hScale;
    const hx = entity.x; // center x stays the same
    const hy = entity.y - entity.h * cfg.yOff; // shift down slightly
    return { x: hx, y: hy, w: hw, h: hh };
}

// --- Collision ---
function rectsOverlap(a, b) {
    return a.x - a.w/2 < b.x + b.w/2 && a.x + a.w/2 > b.x - b.w/2 &&
           a.y - a.h < b.y && a.y > b.y - b.h;
}
function pointInRect(px, py, rx, ry, rw, rh) {
    return px > rx - rw/2 && px < rx + rw/2 && py > ry - rh && py < ry;
}
// Hitbox-aware point-in-entity check
function pointHitsEntity(px, py, entity, type) {
    const hb = getEntityHitbox(entity, type);
    return px > hb.x - hb.w/2 && px < hb.x + hb.w/2 && py > hb.y - hb.h && py < hb.y;
}
// Hitbox-aware point-in-player check (player uses x,y as bottom-center)
function pointHitsPlayer(px, py) {
    const p = player;
    const cfg = HITBOX_CONFIG.player;
    const hw = p.w * cfg.wScale;
    const hh = p.h * cfg.hScale;
    const cx = p.x;
    const cy = p.y - p.h * cfg.yOff;
    return px > cx - hw/2 && px < cx + hw/2 && py > cy - hh && py < cy + hh;
}

// --- Update Functions ---
function updatePlayer() {
    const p = player;
    if (!p) return;

    // Dodge
    if (p.dodging) {
        p.dodgeTimer--;
        p.x += p.facing * 6;
        if (p.dodgeTimer <= 0) { p.dodging = false; p.dodgeCooldown = 30; }
    } else {
        // Movement
        let moveX = 0;
        if (keys['a'] || keys['arrowleft']) moveX -= 1;
        if (keys['d'] || keys['arrowright']) moveX += 1;
        p.vx = moveX * 3.5;
        p.x += p.vx;

        if (keys['w'] || keys['arrowup']) {
            if (p.onGround) { p.vy = -10; p.onGround = false; }
        }

        // Dodge roll
        if (keys[' '] && p.dodgeCooldown <= 0 && !p.dodging) {
            p.dodging = true;
            p.dodgeTimer = 12;
            sfxDodge();
        }
    }

    if (p.dodgeCooldown > 0) p.dodgeCooldown--;

    // Gravity
    p.vy += GRAVITY;
    p.y += p.vy;
    if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.onGround = true; }

    // Clamp
    p.x = Math.max(p.w, Math.min(W - p.w, p.x));

    // Facing
    if (mouseX > p.x) p.facing = 1;
    else p.facing = -1;

    // Walk animation
    if (Math.abs(p.vx) > 0.5) { p.walkTimer++; p.walkFrame = p.walkTimer; }
    else p.walkFrame = 0;

    // Shooting
    if (p.shootCooldown > 0) p.shootCooldown--;
    if (mouseClicked && p.shootCooldown <= 0 && p.ammo > 0 && !p.dodging && !p.abducting) {
        const angle = Math.atan2(mouseY - (p.y - p.h * 0.5), mouseX - p.x);
        bullets.push({
            x: p.x + p.facing * 15, y: p.y - p.h * 0.5,
            vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8,
            life: 60, damage: 10
        });
        p.ammo--;
        p.shootCooldown = 8;
        p.muzzleFlash = 4;
        sfxShoot();
    }

    // Muzzle flash timer
    if (p.muzzleFlash > 0) p.muzzleFlash--;

    // Invuln timer
    if (p.invuln > 0) p.invuln--;

    // Abduction
    if (p.abducting) {
        p.abductTimer--;
        p.y -= 1.5;
        if (p.abductTimer <= 0) {
            p.abducting = false;
            p.y = GROUND_Y;
            damagePlayer(25);
        }
    }
}

function damagePlayer(dmg) {
    if (player.invuln > 0 || player.dodging) return;
    if (player.shield > 0) {
        player.shield -= dmg;
        if (player.shield < 0) {
            player.hp += player.shield; // overflow damage
            player.shield = 0;
        }
    } else {
        player.hp -= dmg;
    }
    player.invuln = 30;
    screenShake = 8;
    spawnParticles(player.x, player.y - player.h/2, 8, RED, 3, 20);
    sfxHit();
    bg.shake(0.4);

    if (player.hp <= 0) {
        lives--;
        if (lives <= 0) {
            gameState = 'gameover';
            sfxExplosion();
        } else {
            player.hp = player.maxHp;
            player.invuln = 90;
            player.abducting = false;
        }
    }
}

function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.frame++;

        if (e.type === 'boss') {
            // Boss AI
            if (e.x > W * 0.65) e.x += e.vx;
            else {
                e.x += Math.sin(e.frame * 0.02) * 1;
            }
            e.shootTimer--;
            if (e.shootTimer <= 0) {
                e.shootTimer = e.shootRate;
                // Boss fires 3 bullets
                for (let b = -1; b <= 1; b++) {
                    const angle = Math.atan2(player.y - player.h/2 - e.y + e.h/2, player.x - e.x) + b * 0.2;
                    enemyBullets.push({
                        x: e.x - 30, y: e.y - e.h * 0.3,
                        vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
                        life: 120, damage: 15
                    });
                }
                playSound(150, 0.15, 'sawtooth', 0.08);
            }
        } else {
            // Alien AI
            e.x += e.vx;
            e.shootTimer--;
            if (e.shootTimer <= 0 && e.x < W - 50) {
                e.shootTimer = e.shootRate;
                const angle = Math.atan2(player.y - player.h/2 - e.y + e.h/2, player.x - e.x);
                enemyBullets.push({
                    x: e.x, y: e.y - e.h * 0.4,
                    vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5,
                    life: 90, damage: 8
                });
            }
        }

        // Off screen removal
        if (e.x < -60 && e.type !== 'boss') {
            enemies.splice(i, 1);
            continue;
        }

        // Dead check
        if (e.hp <= 0) {
            sfxExplosion();
            const pts = e.type === 'boss' ? 500 : 50 + wave * 5;
            score += pts;
            spawnParticles(e.x, e.y - e.h/2, e.type === 'boss' ? 40 : 15, GOLD, 4, 30);
            if (Math.random() < 0.4 || e.type === 'boss') spawnItem(e.x, e.y - 10);
            if (e.type === 'boss') { spawnItem(e.x - 20, e.y - 10); spawnItem(e.x + 20, e.y - 10); bossActive = false; bg.pulse(0.5); }
            enemiesRemaining--;
            enemies.splice(i, 1);
            screenShake = e.type === 'boss' ? 15 : 5;
        }
    }
}

function updateUFOs() {
    for (let i = ufos.length - 1; i >= 0; i--) {
        const u = ufos[i];
        u.frame++;

        // Move toward target
        if (Math.abs(u.x - u.targetX) > 5) {
            u.x += u.x > u.targetX ? -0.8 : 0.8;
        } else {
            u.targetX = 100 + Math.random() * 500;
        }

        // Beam logic
        u.beamCooldown--;
        if (u.beamCooldown <= 0 && !u.beamActive) {
            u.beamActive = true;
            u.beamTimer = 120;
            sfxBeam();
        }
        if (u.beamActive) {
            u.beamTimer--;
            if (u.beamTimer <= 0) {
                u.beamActive = false;
                u.beamCooldown = 180 + Math.random() * 120;
            }
            // Check beam hit on player
            const beamLeft = u.x - u.w * 0.5;
            const beamRight = u.x + u.w * 0.5;
            if (player.x > beamLeft && player.x < beamRight && !player.dodging && !player.abducting && player.invuln <= 0) {
                player.abducting = true;
                player.abductTimer = 40;
            }
        }

        // Off screen
        if (u.x < -80) { ufos.splice(i, 1); continue; }

        // Dead
        if (u.hp <= 0) {
            sfxExplosion();
            score += 100 + wave * 10;
            spawnParticles(u.x, u.y, 25, TEAL, 5, 35);
            spawnItem(u.x, u.y + 30);
            ufos.splice(i, 1);
            screenShake = 8;
            bg.pulse(0.5);
        }
    }
}

function updateBullets() {
    // Player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { bullets.splice(i, 1); continue; }

        // Hit enemies (using per-type hitboxes)
        let hit = false;
        for (const e of enemies) {
            const etype = e.type === 'boss' ? 'boss' : 'alien';
            if (pointHitsEntity(b.x, b.y, e, etype)) {
                e.hp -= b.damage;
                spawnParticles(b.x, b.y, 4, '#ffffff', 2, 10);
                hit = true;
                sfxHit();
                break;
            }
        }
        if (!hit) {
            for (const u of ufos) {
                if (pointHitsEntity(b.x, b.y, u, 'ufo')) {
                    u.hp -= b.damage;
                    spawnParticles(b.x, b.y, 4, TEAL, 2, 10);
                    hit = true;
                    sfxHit();
                    break;
                }
            }
        }
        if (hit) bullets.splice(i, 1);
    }

    // Enemy bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0 || b.x < 0 || b.x > W || b.y > H) { enemyBullets.splice(i, 1); continue; }

        // Hit player (using player hitbox - smaller than visual for fairness)
        if (!player.dodging && pointHitsPlayer(b.x, b.y)) {
            damagePlayer(b.damage);
            enemyBullets.splice(i, 1);
        }
    }
}

function updateItems() {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.frame++;
        if (!it.onGround) {
            it.vy += GRAVITY * 0.5;
            it.y += it.vy;
            if (it.y >= GROUND_Y - 5) { it.y = GROUND_Y - 5; it.onGround = true; it.vy = 0; }
        }
        it.life--;
        if (it.life <= 0) { items.splice(i, 1); continue; }

        // Pickup (generous radius for items - should be easy to pick up)
        const dx = player.x - it.x, dy = (player.y - player.h/2) - it.y;
        if (Math.sqrt(dx*dx+dy*dy) < 30) {
            switch(it.type) {
                case 'health': player.hp = Math.min(player.maxHp, player.hp + 25); break;
                case 'ammo': player.ammo = Math.min(player.maxAmmo, player.ammo + 15); break;
                case 'shield': player.shield = Math.min(50, player.shield + 20); break;
                case 'coin': score += 25; break;
            }
            sfxPickup();
            spawnParticles(it.x, it.y, 6, GOLD, 2, 15);
            items.splice(i, 1);
        }
    }
}

// --- Draw Functions ---
function drawBackground(frame) {
    // Sky gradient
    const skyGrd = X.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrd.addColorStop(0, '#03060f');
    skyGrd.addColorStop(0.7, '#0a1020');
    skyGrd.addColorStop(1, '#1a2040');
    X.fillStyle = skyGrd;
    X.fillRect(0, 0, W, GROUND_Y);

    // Stars
    for (const s of stars) {
        const tw = Math.sin(frame * s.speed + s.twinkle);
        X.globalAlpha = 0.4 + tw * 0.4;
        X.fillStyle = '#ffffff';
        X.fillRect(s.x, s.y, s.size, s.size);
    }
    X.globalAlpha = 1;

    // Far mountains (parallax layer 1)
    X.fillStyle = '#0f1525';
    X.beginPath();
    X.moveTo(0, GROUND_Y);
    for (const m of mountains1) {
        const mx = ((m.x - frame * 0.1) % (W + 160)) - 80;
        X.lineTo(mx, GROUND_Y - m.h - 40);
    }
    X.lineTo(W, GROUND_Y);
    X.closePath();
    X.fill();

    // Near hills (parallax layer 2)
    X.fillStyle = '#151f30';
    X.beginPath();
    X.moveTo(0, GROUND_Y);
    for (const m of mountains2) {
        const mx = ((m.x - frame * 0.3) % (W + 120)) - 60;
        X.lineTo(mx, GROUND_Y - m.h - 10);
    }
    X.lineTo(W, GROUND_Y);
    X.closePath();
    X.fill();

    // Ground
    const groundGrd = X.createLinearGradient(0, GROUND_Y, 0, H);
    groundGrd.addColorStop(0, '#2a3a25');
    groundGrd.addColorStop(0.3, '#1a2a18');
    groundGrd.addColorStop(1, '#0a1508');
    X.fillStyle = groundGrd;
    X.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // Ground line
    X.strokeStyle = '#3a4a35';
    X.lineWidth = 2;
    X.beginPath();
    X.moveTo(0, GROUND_Y);
    X.lineTo(W, GROUND_Y);
    X.stroke();

    // Grass tufts
    X.fillStyle = '#3a5a30';
    for (let i = 0; i < W; i += 12) {
        const h = 3 + Math.sin(i * 0.5 + frame * 0.02) * 2;
        X.fillRect(i, GROUND_Y - h, 2, h);
    }
}

function drawHUD() {
    const p = player;
    // HP bar
    X.fillStyle = '#00000088';
    X.fillRect(10, 10, 200, 40);
    X.strokeStyle = TEAL + '88';
    X.lineWidth = 1;
    X.strokeRect(10, 10, 200, 40);

    // HP
    X.fillStyle = '#333';
    X.fillRect(15, 15, 140, 12);
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    X.fillStyle = hpRatio > 0.5 ? GREEN_C : hpRatio > 0.25 ? GOLD : RED;
    X.fillRect(15, 15, 140 * hpRatio, 12);
    X.fillStyle = '#fff';
    X.font = '9px monospace';
    X.textAlign = 'left';
    X.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, 18, 24);

    // Shield bar
    if (p.shield > 0) {
        X.fillStyle = '#333';
        X.fillRect(15, 30, 140, 6);
        X.fillStyle = TEAL;
        X.fillRect(15, 30, 140 * (p.shield / 50), 6);
    }

    // Ammo
    X.fillStyle = GOLD;
    X.font = '11px monospace';
    X.fillText(`AMMO: ${p.ammo}`, 15, 47);

    // Lives
    X.fillStyle = '#fff';
    X.font = '10px monospace';
    X.textAlign = 'left';
    for (let i = 0; i < lives; i++) {
        X.fillStyle = RED;
        X.fillText('\u2665', 165 + i * 14, 24);
    }

    // Score
    X.fillStyle = '#00000088';
    X.fillRect(W - 180, 10, 170, 40);
    X.strokeStyle = GOLD + '88';
    X.strokeRect(W - 180, 10, 170, 40);
    X.fillStyle = GOLD;
    X.font = 'bold 14px monospace';
    X.textAlign = 'right';
    X.fillText(`SCORE: ${score}`, W - 20, 30);
    X.fillStyle = TEAL;
    X.font = '11px monospace';
    X.fillText(`WAVE ${wave}`, W - 20, 45);

    // Enemies remaining
    X.fillStyle = '#ffffff88';
    X.font = '10px monospace';
    X.textAlign = 'center';
    X.fillText(`Enemies: ${enemiesRemaining}`, W/2, 20);

    // Dodge cooldown indicator
    if (p.dodgeCooldown > 0) {
        X.fillStyle = '#ffffff44';
        X.font = '9px monospace';
        X.textAlign = 'left';
        X.fillText('DODGE: ...', 15, 62);
    } else if (!p.dodging) {
        X.fillStyle = TEAL;
        X.font = '9px monospace';
        X.textAlign = 'left';
        X.fillText('DODGE: READY', 15, 62);
    }
}

function drawCrosshair() {
    X.strokeStyle = TEAL + 'aa';
    X.lineWidth = 1;
    X.beginPath();
    X.arc(mouseX, mouseY, 10, 0, Math.PI * 2);
    X.stroke();
    X.beginPath();
    X.moveTo(mouseX - 15, mouseY); X.lineTo(mouseX - 6, mouseY);
    X.moveTo(mouseX + 6, mouseY); X.lineTo(mouseX + 15, mouseY);
    X.moveTo(mouseX, mouseY - 15); X.lineTo(mouseX, mouseY - 6);
    X.moveTo(mouseX, mouseY + 6); X.lineTo(mouseX, mouseY + 15);
    X.stroke();
    X.fillStyle = TEAL;
    X.fillRect(mouseX - 1, mouseY - 1, 2, 2);
}

// --- Screens ---
function drawTitle(frame) {
    drawBackground(frame);

    // Title glow
    X.save();
    X.shadowColor = TEAL;
    X.shadowBlur = 20;
    X.fillStyle = TEAL;
    X.font = 'bold 32px monospace';
    X.textAlign = 'center';
    X.fillText('TRENCH DEFENSE', W/2, 180);
    X.shadowColor = GOLD;
    X.fillStyle = GOLD;
    X.font = 'bold 24px monospace';
    X.fillText('UFO INVASION', W/2, 220);
    X.restore();

    // Animated UFO on title
    drawUFO(W/2 + Math.sin(frame * 0.03) * 80, 100, 50, 25, 1, Math.sin(frame * 0.02) > 0.5, frame);

    // Instructions
    X.fillStyle = '#ffffff88';
    X.font = '13px monospace';
    X.textAlign = 'center';
    X.fillText('WASD - Move / Jump', W/2, 310);
    X.fillText('CLICK - Shoot', W/2, 335);
    X.fillText('SPACE - Dodge Roll', W/2, 360);
    X.fillText('Defend the trench from alien invaders!', W/2, 395);

    // Start prompt
    const pulse = Math.sin(frame * 0.08) * 0.3 + 0.7;
    X.globalAlpha = pulse;
    X.fillStyle = GOLD;
    X.font = 'bold 18px monospace';
    X.fillText('[ CLICK TO START ]', W/2, 470);
    X.globalAlpha = 1;

    // Version
    X.fillStyle = '#ffffff33';
    X.font = '10px monospace';
    X.fillText('Guinea Pig Trench Portal', W/2, 580);
}

function drawSelect(frame) {
    drawBackground(frame);

    X.fillStyle = TEAL;
    X.font = 'bold 24px monospace';
    X.textAlign = 'center';
    X.fillText('CHOOSE YOUR FIGHTER', W/2, 100);

    // Pink character
    const pinkHover = mouseX < W/2 && mouseY > 150 && mouseY < 450;
    X.fillStyle = pinkHover ? '#ffffff11' : '#00000044';
    X.fillRect(50, 150, W/2 - 80, 300);
    if (pinkHover) { X.strokeStyle = PINK_C; X.lineWidth = 2; X.strokeRect(50, 150, W/2 - 80, 300); }
    drawPixelChar(W/4, 340, 40, 60, PINK_C, 1, frame, false);
    X.fillStyle = PINK_C;
    X.font = 'bold 16px monospace';
    X.textAlign = 'center';
    X.fillText('SCOUT', W/4, 430);
    X.fillStyle = '#aaa';
    X.font = '11px monospace';
    X.fillText('Fast & Agile', W/4, 450);

    // Green character
    const greenHover = mouseX >= W/2 && mouseY > 150 && mouseY < 450;
    X.fillStyle = greenHover ? '#ffffff11' : '#00000044';
    X.fillRect(W/2 + 30, 150, W/2 - 80, 300);
    if (greenHover) { X.strokeStyle = GREEN_C; X.lineWidth = 2; X.strokeRect(W/2 + 30, 150, W/2 - 80, 300); }
    drawPixelChar(W*3/4, 340, 40, 60, '#448844', 1, frame, false);
    X.fillStyle = GREEN_C;
    X.font = 'bold 16px monospace';
    X.textAlign = 'center';
    X.fillText('SOLDIER', W*3/4, 430);
    X.fillStyle = '#aaa';
    X.font = '11px monospace';
    X.fillText('Tough & Strong', W*3/4, 450);

    X.fillStyle = '#ffffff66';
    X.font = '12px monospace';
    X.fillText('Click to select', W/2, 510);
}

function drawWaveComplete(frame) {
    X.fillStyle = '#00000088';
    X.fillRect(0, 0, W, H);

    X.save();
    X.shadowColor = GOLD;
    X.shadowBlur = 15;
    X.fillStyle = GOLD;
    X.font = 'bold 36px monospace';
    X.textAlign = 'center';
    X.fillText(`WAVE ${wave - 1} COMPLETE!`, W/2, 250);
    X.restore();

    X.fillStyle = '#fff';
    X.font = '16px monospace';
    X.fillText(`Score: ${score}`, W/2, 300);

    if (wave % 5 === 1 && wave > 1) {
        X.fillStyle = RED;
        X.font = 'bold 14px monospace';
        X.fillText('BOSS DEFEATED!', W/2, 330);
    }

    const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
    X.globalAlpha = pulse;
    X.fillStyle = TEAL;
    X.font = '14px monospace';
    X.fillText('[ CLICK FOR NEXT WAVE ]', W/2, 390);
    X.globalAlpha = 1;
}

function drawGameOver(frame) {
    X.fillStyle = '#00000088';
    X.fillRect(0, 0, W, H);

    X.save();
    X.shadowColor = RED;
    X.shadowBlur = 20;
    X.fillStyle = RED;
    X.font = 'bold 40px monospace';
    X.textAlign = 'center';
    X.fillText('GAME OVER', W/2, 220);
    X.restore();

    X.fillStyle = GOLD;
    X.font = 'bold 24px monospace';
    X.fillText(`SCORE: ${score}`, W/2, 280);

    X.fillStyle = '#aaa';
    X.font = '14px monospace';
    X.fillText(`Reached Wave ${wave}`, W/2, 320);
    X.fillText(`Enemies Defeated: ${Math.floor(score / 50)}`, W/2, 345);

    const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
    X.globalAlpha = pulse;
    X.fillStyle = TEAL;
    X.font = '14px monospace';
    X.fillText('[ CLICK TO RESTART ]', W/2, 430);
    X.globalAlpha = 1;
}

// --- Main Game Loop ---
let frameCount = 0;

function gameLoop() {
    rafId = requestAnimationFrame(gameLoop);
    frameCount++;
    bg.render(performance.now());

    // Screen shake
    X.save();
    if (screenShake > 0) {
        X.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
        screenShake *= 0.85;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Clear
    X.fillStyle = DARK;
    X.fillRect(0, 0, W, H);

    switch(gameState) {
        case 'title':
            drawTitle(frameCount);
            if (mouseClicked) { initAudio(); gameState = 'select'; }
            break;

        case 'select':
            drawSelect(frameCount);
            if (mouseClicked) {
                if (mouseX < W/2 && mouseY > 150 && mouseY < 450) {
                    selectedChar = 0;
                    startGame();
                } else if (mouseX >= W/2 && mouseY > 150 && mouseY < 450) {
                    selectedChar = 1;
                    startGame();
                }
            }
            break;

        case 'playing':
            updatePlayer();
            updateEnemies();
            updateUFOs();
            updateBullets();
            updateItems();
            updateParticles();

            // Check wave complete
            if (enemiesRemaining <= 0 && enemies.length === 0) {
                waveCompleteTimer++;
                if (waveCompleteTimer > 60) {
                    wave++;
                    gameState = 'waveComplete';
                    waveCompleteTimer = 0;
                }
            }

            // Draw everything
            drawBackground(frameCount);

            // Environment
            for (const prop of envProps) drawEnvProp(prop, frameCount);

            // Items
            for (const it of items) drawItem(it.x, it.y, it.type, it.frame);

            // Player
            if (player) {
                const charColor = selectedChar === 0 ? PINK_C : '#448844';
                if (player.invuln > 0 && frameCount % 4 < 2) {
                    // Blink when invulnerable
                } else {
                    drawPixelChar(player.x, player.y, player.w, player.h, charColor, player.facing, player.walkFrame, player.dodging);
                }
                // Shield visual
                if (player.shield > 0) {
                    X.strokeStyle = TEAL + '66';
                    X.lineWidth = 2;
                    X.beginPath();
                    X.arc(player.x, player.y - player.h/2, 22, 0, Math.PI * 2);
                    X.stroke();
                }
                // Muzzle flash
                if (player.muzzleFlash > 0) {
                    drawMuzzleFlash(player.x, player.y - player.h * 0.5, player.facing);
                }
            }

            // Enemies
            for (const e of enemies) {
                if (e.type === 'boss') {
                    drawMechBoss(e.x, e.y, e.w, e.h, e.frame, e.hp / e.maxHp);
                } else {
                    drawAlien(e.x, e.y, e.w, e.h, e.variant, e.frame, e.hp / e.maxHp);
                }
            }

            // UFOs
            for (const u of ufos) {
                drawUFO(u.x, u.y, u.w, u.h, u.hp / u.maxHp, u.beamActive, u.frame);
            }

            // Bullets
            X.fillStyle = GOLD;
            for (const b of bullets) {
                X.save();
                X.translate(b.x, b.y);
                X.rotate(Math.atan2(b.vy, b.vx));
                X.fillStyle = '#ffff00';
                X.fillRect(-4, -1, 8, 2);
                X.fillStyle = '#ffffff';
                X.fillRect(2, -1, 3, 2);
                X.restore();
            }

            // Enemy bullets
            for (const b of enemyBullets) {
                X.fillStyle = '#ff4444';
                X.beginPath();
                X.arc(b.x, b.y, 3, 0, Math.PI * 2);
                X.fill();
                X.fillStyle = '#ff8888';
                X.beginPath();
                X.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
                X.fill();
            }

            drawParticles();
            drawHUD();
            drawCrosshair();

            // Boss incoming warning
            if (bossActive && enemies.some(e => e.type === 'boss' && e.x > W * 0.65)) {
                const pulse = Math.sin(frameCount * 0.15) * 0.4 + 0.6;
                X.globalAlpha = pulse;
                X.fillStyle = RED;
                X.font = 'bold 20px monospace';
                X.textAlign = 'center';
                X.fillText('!! BOSS INCOMING !!', W/2, 80);
                X.globalAlpha = 1;
            }
            break;

        case 'waveComplete':
            drawBackground(frameCount);
            for (const prop of envProps) drawEnvProp(prop, frameCount);
            if (player) {
                const charColor = selectedChar === 0 ? PINK_C : '#448844';
                drawPixelChar(player.x, player.y, player.w, player.h, charColor, 1, frameCount, false);
            }
            drawWaveComplete(frameCount);
            if (mouseClicked) {
                gameState = 'playing';
                generateEnvProps();
                spawnWave();
            }
            break;

        case 'gameover':
            drawBackground(frameCount);
            drawGameOver(frameCount);
            if (mouseClicked) {
                gameState = 'title';
            }
            break;
    }

    X.restore();
    mouseClicked = false;
}

function startGame() {
    score = 0;
    lives = 3;
    wave = 1;
    enemies = [];
    ufos = [];
    bullets = [];
    enemyBullets = [];
    items = [];
    particles = [];
    waveCompleteTimer = 0;
    resetPlayer();
    if (selectedChar === 1) {
        player.maxHp = 120;
        player.hp = 120;
        player.maxAmmo = 80;
        player.ammo = 60;
    }
    gameState = 'playing';
    generateEnvProps();
    spawnWave();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && rafId) cancelAnimationFrame(rafId);
});

gameLoop();



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
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01434800102917941;mix-blend-mode:overlay';
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



// CHAIN FIX: SCREENSHOT
document.addEventListener("keydown",function(e){if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){var c=document.querySelector("canvas");if(!c)return;var url=c.toDataURL("image/png");var a=document.createElement("a");a.href=url;a.download="gpt_"+Date.now()+".png";a.click();if(typeof _tone==="function")_tone(1200,.08,"sine",.05)}});



// CHAIN FIX: MUSIC LINK
setInterval(function(){try{if(parent.AUDIO_BASS!==undefined){window.AUDIO_BASS=parent.AUDIO_BASS;window.AUDIO_MID=parent.AUDIO_MID;window.AUDIO_HIGH=parent.AUDIO_HIGH;window.AUDIO_ENERGY=parent.AUDIO_ENERGY}}catch(e){}},33);
