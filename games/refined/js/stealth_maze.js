
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let rafId = null;
canvas.width = 800;
canvas.height = 600;

// --- Sprite Loading ---
const playerSprite = new Image();
playerSprite.src = '../assets/sprites/mecha_entity_alpha_v2_pixel.png';
let playerSpriteLoaded = false;
playerSprite.onload = () => { playerSpriteLoaded = true; };
playerSprite.onerror = () => { playerSpriteLoaded = false; };

const coreSprite = new Image();
coreSprite.src = '../assets/sprites/geometric_core_geode_flux.png';
let coreSpriteLoaded = false;
coreSprite.onload = () => { coreSpriteLoaded = true; };
coreSprite.onerror = () => { coreSpriteLoaded = false; };

// --- Constants ---
const TILE = 20;
const COLS = 40;
const ROWS = 30;
const BG = '#0c0c12';
const TEAL = '#00d2ff';
const ORANGE = '#ff8c00';
const YELLOW = 'rgba(255,220,50,0.13)';
const YELLOW_ALERT = 'rgba(255,80,30,0.18)';
const RED = '#ff2244';
const WALL_COLOR = '#1a1a2e';
const DOOR_COLOR = '#665500';
const DOOR_OPEN_COLOR = '#334400';
const FOV_RADIUS = 8; // tiles
const BASE_VISION_RANGE = 7; // tiles
const BASE_VISION_ANGLE = Math.PI / 3; // 60 degrees
const SOUND_RANGE = 8; // tiles
const CHAIR_SOUND_RANGE = 10;
const PAPER_BALL_SOUND_RANGE = 8; // tiles

// --- Level Config ---
const LEVEL_CONFIGS = [
    { // Level 1
        guardCount: 3,
        speedMultiplier: 1.0,
        visionAngle: BASE_VISION_ANGLE,
        flashlightGuard: false,
    },
    { // Level 2
        guardCount: 4,
        speedMultiplier: 1.3,
        visionAngle: BASE_VISION_ANGLE,
        flashlightGuard: false,
    },
    { // Level 3
        guardCount: 5,
        speedMultiplier: 1.3,
        visionAngle: 80 * Math.PI / 180, // 80 degrees
        flashlightGuard: true, // last guard gets flashlight
    }
];

// --- Game State ---
const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, WIN: 4, LEVEL_COMPLETE: 5 };
let state = STATE.MENU;
// MODE 1: CREATIVE — design the maze, place guards, set patrols
// MODE 2: SURVIVAL — sneak through (default)
let smMode = 'SURVIVAL'; // toggle with TAB on menu
let hp = 100;
let suspicion = 0;
let hasKeycard = false;
let hasPIN = false;
let player = { x: 2, y: 14, angle: -Math.PI / 2 };
let chairCooldown = 0;
let distractionPoint = null;
let distractionTimer = 0;
let gameTime = 0;
let menuBlink = 0;
let currentLevel = 1;
let score = 0;
let levelCompleteTimer = 0;

// --- Paper Balls ---
let paperBalls = []; // active flying/bouncing balls
let paperBallCount = 5; // remaining throws
const PAPER_BALL_SPEED = 0.18; // tiles per frame-dt
const PAPER_BALL_GRAVITY = 0.006;

// Paper ball object: { x, y, vx, vy, vz, z, bounced, stopped, lifetime }
// z = height (for arc), vz = vertical velocity

// --- Map ---
// 0=floor, 1=wall, 2=door(cubicle->HR), 3=door(HR->server), 4=keycard, 5=PIN, 6=server goal
const map = [];
function initMap() {
    for (let r = 0; r < ROWS; r++) {
        map[r] = [];
        for (let c = 0; c < COLS; c++) {
            map[r][c] = 0;
        }
    }
    // Outer walls
    for (let c = 0; c < COLS; c++) { map[0][c] = 1; map[ROWS - 1][c] = 1; }
    for (let r = 0; r < ROWS; r++) { map[r][0] = 1; map[r][COLS - 1] = 1; }

    // --- Room 1: Cubicles (left, cols 0-14) ---
    // Right wall of cubicles
    for (let r = 0; r < ROWS; r++) map[r][15] = 1;
    // Door from cubicles to HR at row 14
    map[14][15] = 2;
    map[15][15] = 2;

    // Cubicle internal walls (desks)
    for (let c = 2; c <= 6; c++) { map[5][c] = 1; }
    for (let c = 2; c <= 6; c++) { map[10][c] = 1; }
    for (let c = 8; c <= 12; c++) { map[5][c] = 1; }
    for (let c = 8; c <= 12; c++) { map[10][c] = 1; }
    for (let c = 2; c <= 6; c++) { map[20][c] = 1; }
    for (let c = 8; c <= 12; c++) { map[20][c] = 1; }

    // Keycard in cubicles
    map[7][4] = 4;

    // --- Room 2: HR (middle, cols 16-27) ---
    // Right wall of HR
    for (let r = 0; r < ROWS; r++) map[r][28] = 1;
    // Door from HR to server room at row 14
    map[14][28] = 3;
    map[15][28] = 3;

    // HR furniture
    for (let c = 18; c <= 22; c++) { map[4][c] = 1; }
    for (let c = 24; c <= 26; c++) { map[4][c] = 1; }
    for (let r = 8; r <= 12; r++) { map[r][20] = 1; }
    for (let c = 18; c <= 22; c++) { map[17][c] = 1; }
    for (let c = 18; c <= 26; c++) { map[24][c] = 1; }
    // PIN in HR
    map[22][24] = 5;

    // --- Room 3: Server Room (right, cols 29-39) ---
    // Server racks
    for (let r = 3; r <= 8; r++) { map[r][31] = 1; map[r][34] = 1; map[r][37] = 1; }
    for (let r = 15; r <= 20; r++) { map[r][31] = 1; map[r][34] = 1; map[r][37] = 1; }
    for (let r = 22; r <= 26; r++) { map[r][31] = 1; map[r][34] = 1; map[r][37] = 1; }

    // Goal tile in server room
    map[14][36] = 6;
}

// --- Doors ---
let doors = [
    { col: 15, rows: [14, 15], open: false, requires: 'keycard' },
    { col: 28, rows: [14, 15], open: false, requires: 'pin' }
];

function isDoor(r, c) {
    return map[r] && (map[r][c] === 2 || map[r][c] === 3);
}
function isDoorOpen(r, c) {
    for (const d of doors) {
        if (d.col === c && d.rows.includes(r)) return d.open;
    }
    return false;
}
function isBlocked(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return true;
    if (map[r][c] === 1) return true;
    if (isDoor(r, c) && !isDoorOpen(r, c)) return true;
    return false;
}

// --- Hitbox Config (in tile units) ---
// Collision radii for body-to-body and interaction checks
const HITBOX = {
    player:  { radius: 0.35 },       // wall collision radius (tiles)
    guard:   { radius: 0.4 },        // guard body collision radius
    pickup:  { radius: 0.6 },        // pickup interaction radius (generous)
    guardAttack: { range: 1.5 },     // how close guard must be to damage player
    doorInteract: { range: 1.5 },    // door interaction range
};

// Check if two circular hitboxes overlap
function bodiesOverlap(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by;
    const combinedR = ar + br;
    return (dx * dx + dy * dy) < (combinedR * combinedR);
}

// --- Guards ---
let guards = [];

// Base patrol routes for up to 5 guards
const GUARD_TEMPLATES = [
    {
        x: 6, y: 7, angle: 0, speed: 0.03,
        patrol: [{ x: 6, y: 3 }, { x: 12, y: 3 }, { x: 12, y: 12 }, { x: 6, y: 12 }],
    },
    {
        x: 22, y: 10, angle: Math.PI, speed: 0.025,
        patrol: [{ x: 18, y: 6 }, { x: 26, y: 6 }, { x: 26, y: 22 }, { x: 18, y: 22 }],
    },
    {
        x: 10, y: 24, angle: Math.PI / 2, speed: 0.028,
        patrol: [{ x: 3, y: 22 }, { x: 12, y: 22 }, { x: 12, y: 27 }, { x: 3, y: 27 }],
    },
    {   // Guard 4 (level 2+): patrols HR lower area
        x: 20, y: 20, angle: 0, speed: 0.027,
        patrol: [{ x: 17, y: 18 }, { x: 26, y: 18 }, { x: 26, y: 27 }, { x: 17, y: 27 }],
    },
    {   // Guard 5 (level 3): patrols server room
        x: 34, y: 14, angle: Math.PI, speed: 0.03,
        patrol: [{ x: 30, y: 2 }, { x: 38, y: 2 }, { x: 38, y: 27 }, { x: 30, y: 27 }],
    }
];

function initGuards() {
    const config = getLevelConfig();
    guards = [];
    for (let i = 0; i < config.guardCount; i++) {
        const t = GUARD_TEMPLATES[i];
        guards.push({
            x: t.x, y: t.y, angle: t.angle,
            speed: t.speed * config.speedMultiplier,
            patrol: t.patrol.map(p => ({ ...p })),
            patrolIdx: 0, state: 'patrol',
            investigateTimer: 0, attackCooldown: 0, alertLevel: 0,
            investigateTarget: null,
            visionAngle: config.visionAngle,
            visionRange: BASE_VISION_RANGE,
            hasFlashlight: false,
        });
    }
    // Flashlight guard in level 3
    if (config.flashlightGuard && guards.length > 0) {
        const fg = guards[guards.length - 1];
        fg.hasFlashlight = true;
        fg.visionRange = 12; // longer range
    }
}

function getLevelConfig() {
    const idx = Math.min(currentLevel - 1, LEVEL_CONFIGS.length - 1);
    return LEVEL_CONFIGS[idx];
}

// --- Line of sight (Bresenham) ---
function hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;
    while (true) {
        if (cx === x1 && cy === y1) return true;
        if (isBlocked(cy, cx) && !(cx === x0 && cy === y0)) return false;
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
        if (cx === x1 && cy === y1) return true;
        if (isBlocked(cy, cx)) return false;
    }
}

// --- Player visible tiles (FOV) ---
function getVisibleTiles() {
    const visible = new Set();
    const px = Math.round(player.x), py = Math.round(player.y);
    for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
        for (let dist = 0; dist <= FOV_RADIUS; dist++) {
            const tx = Math.round(px + Math.cos(angle) * dist);
            const ty = Math.round(py + Math.sin(angle) * dist);
            if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) break;
            visible.add(ty * COLS + tx);
            if (map[ty][tx] === 1) break;
            if (isDoor(ty, tx) && !isDoorOpen(ty, tx)) break;
        }
    }
    return visible;
}

// --- Guard AI ---
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }

function canGuardSee(g) {
    const d = dist(g, player);
    if (d > g.visionRange) return false;
    const angleToPlayer = Math.atan2(player.y - g.y, player.x - g.x);
    let diff = angleToPlayer - g.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    if (Math.abs(diff) > g.visionAngle / 2) return false;
    return hasLineOfSight(Math.round(g.x), Math.round(g.y), Math.round(player.x), Math.round(player.y));
}

function canGuardHear(g) {
    if (!playerMoving) return false;
    return dist(g, player) <= SOUND_RANGE;
}

function moveToward(g, tx, ty, dt) {
    const dx = tx - g.x, dy = ty - g.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.3) return true;
    const step = g.speed * dt;
    const nx = g.x + (dx / d) * step;
    const ny = g.y + (dy / d) * step;
    // Simple collision: only move if target tile not blocked
    if (!isBlocked(Math.round(ny), Math.round(nx))) {
        g.x = nx;
        g.y = ny;
    } else {
        // Try axis-aligned movement
        if (!isBlocked(Math.round(g.y), Math.round(nx))) g.x = nx;
        else if (!isBlocked(Math.round(ny), Math.round(g.x))) g.y = ny;
    }
    g.angle = Math.atan2(dy, dx);
    return false;
}

function updateGuard(g, dt) {
    // CREATIVE mode: guards don't move or detect
    if (smMode === 'CREATIVE') return;
    if (g.attackCooldown > 0) g.attackCooldown -= dt;

    const sees = canGuardSee(g);
    const hears = canGuardHear(g);

    if (sees) {
        g.alertLevel = Math.min(100, g.alertLevel + dt * 0.08);
        g.state = 'chase';
        g.investigateTimer = 0;
    } else if (hears && g.state === 'patrol') {
        g.state = 'investigate';
        g.investigateTarget = { x: player.x, y: player.y };
        g.investigateTimer = 180;
        g.alertLevel = Math.min(60, g.alertLevel + dt * 0.03);
    }

    // Check chair distraction
    if (distractionTimer > 0 && distractionPoint && g.state !== 'chase') {
        const dd = dist(g, distractionPoint);
        if (dd <= CHAIR_SOUND_RANGE) {
            g.state = 'investigate';
            g.investigateTarget = { ...distractionPoint };
            g.investigateTimer = 200;
        }
    }

    // Check paper ball distractions - find nearest stopped ball with active sound
    let nearestBallDist = Infinity;
    let nearestBall = null;
    for (const ball of paperBalls) {
        if (ball.stopped && ball.soundTimer > 0) {
            const bd = dist(g, ball);
            if (bd <= PAPER_BALL_SOUND_RANGE && bd < nearestBallDist) {
                nearestBallDist = bd;
                nearestBall = ball;
            }
        }
    }
    if (nearestBall && g.state !== 'chase') {
        // Only the nearest guard to this ball investigates
        let isNearest = true;
        for (const other of guards) {
            if (other === g) continue;
            if (dist(other, nearestBall) < nearestBallDist) {
                isNearest = false;
                break;
            }
        }
        if (isNearest) {
            g.state = 'investigate';
            g.investigateTarget = { x: nearestBall.x, y: nearestBall.y };
            g.investigateTimer = 180; // ~3 seconds at 60fps
        }
    }

    if (g.state === 'chase') {
        moveToward(g, player.x, player.y, dt);
        if (!sees) {
            g.state = 'investigate';
            g.investigateTarget = { x: player.x, y: player.y };
            g.investigateTimer = 200;
        }
        // Attack if within attack range (using hitbox radii)
        if (bodiesOverlap(g.x, g.y, HITBOX.guard.radius, player.x, player.y, HITBOX.player.radius + HITBOX.guardAttack.range) && g.attackCooldown <= 0) {
            hp -= 15;
            g.attackCooldown = 40;
            if (hp <= 0) { hp = 0; state = STATE.GAMEOVER; }
        }
    } else if (g.state === 'investigate') {
        if (g.investigateTarget) {
            const arrived = moveToward(g, g.investigateTarget.x, g.investigateTarget.y, dt);
            if (arrived) g.investigateTimer -= dt;
        }
        g.investigateTimer -= dt * 0.5;
        if (g.investigateTimer <= 0) {
            g.state = 'patrol';
            g.alertLevel = Math.max(0, g.alertLevel - 10);
        }
    } else {
        // Patrol
        const wp = g.patrol[g.patrolIdx];
        const arrived = moveToward(g, wp.x, wp.y, dt);
        if (arrived) g.patrolIdx = (g.patrolIdx + 1) % g.patrol.length;
        g.alertLevel = Math.max(0, g.alertLevel - dt * 0.01);
    }
}

// --- Paper Ball Physics ---
function throwPaperBall() {
    if (paperBallCount <= 0) return;
    paperBallCount--;
    const speed = PAPER_BALL_SPEED;
    paperBalls.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(player.angle) * speed,
        vy: Math.sin(player.angle) * speed,
        z: 0.5, // start at half-height
        vz: 0.06, // upward arc
        bounced: false,
        stopped: false,
        lifetime: 600, // frames before disappearing
        soundTimer: 0, // active sound duration
    });
}

function updatePaperBalls(dt) {
    for (let i = paperBalls.length - 1; i >= 0; i--) {
        const b = paperBalls[i];
        b.lifetime -= dt;
        if (b.lifetime <= 0) {
            paperBalls.splice(i, 1);
            continue;
        }

        if (b.soundTimer > 0) {
            b.soundTimer -= dt;
        }

        if (b.stopped) continue;

        // Apply gravity to z
        b.vz -= PAPER_BALL_GRAVITY * dt;
        b.z += b.vz * dt;

        // Move in x/y
        const nx = b.x + b.vx * dt;
        const ny = b.y + b.vy * dt;

        // Wall collision - stop the ball
        if (isBlocked(Math.round(ny), Math.round(nx))) {
            b.stopped = true;
            b.soundTimer = 180; // creates sound on impact
            b.z = 0;
            continue;
        }

        b.x = nx;
        b.y = ny;

        // Hit the ground
        if (b.z <= 0) {
            if (!b.bounced) {
                // First bounce
                b.bounced = true;
                b.z = 0;
                b.vz = 0.03; // smaller bounce
                b.vx *= 0.4;
                b.vy *= 0.4;
                // Sound on first bounce
                b.soundTimer = 180; // ~3 seconds of sound
            } else {
                // Second hit = stop
                b.stopped = true;
                b.z = 0;
            }
        }
    }
}

// --- Suspicion ---
function updateSuspicion(dt) {
    let rise = 0;
    for (const g of guards) {
        if (canGuardSee(g)) {
            const d = dist(g, player);
            rise += (1 - d / g.visionRange) * 0.12 * dt;
        }
        if (bodiesOverlap(g.x, g.y, HITBOX.guard.radius + 2.5, player.x, player.y, HITBOX.player.radius)) {
            rise += 0.05 * dt;
        }
    }
    if (rise > 0) {
        suspicion = Math.min(100, suspicion + rise);
    } else {
        suspicion = Math.max(0, suspicion - 0.015 * dt);
    }
}

// --- Input ---
const keys = {};
let playerMoving = false;
let moveAccum = { x: 0, y: 0 };

document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (state === STATE.MENU && e.key === 'Tab') {
        e.preventDefault();
        smMode = smMode === 'SURVIVAL' ? 'CREATIVE' : 'SURVIVAL';
    }
    if (state === STATE.MENU && (e.key === 'Enter' || e.key === ' ')) {
        resetGame();
        state = STATE.PLAYING;
    }
    if (state === STATE.PLAYING && e.key.toLowerCase() === 'p') {
        state = STATE.PAUSED;
    } else if (state === STATE.PAUSED && e.key.toLowerCase() === 'p') {
        state = STATE.PLAYING;
    }
    if (state === STATE.GAMEOVER && e.key === 'Enter') {
        currentLevel = 1;
        score = 0;
        resetGame();
        state = STATE.PLAYING;
    }
    if (state === STATE.WIN && e.key === 'Enter') {
        currentLevel = 1;
        score = 0;
        resetGame();
        state = STATE.PLAYING;
    }
    if (state === STATE.LEVEL_COMPLETE && e.key === 'Enter') {
        currentLevel++;
        resetLevel();
        state = STATE.PLAYING;
    }
    // C = throw paper ball
    if (state === STATE.PLAYING && e.key.toLowerCase() === 'c') {
        throwPaperBall();
    }
    // X = throw chair (original distraction, moved from C)
    if (state === STATE.PLAYING && e.key.toLowerCase() === 'x' && chairCooldown <= 0) {
        throwChair();
    }
    // E = open doors
    if (state === STATE.PLAYING && (e.key === 'e' || e.key === 'E')) {
        tryOpenDoor();
    }
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function throwChair() {
    const tx = player.x + Math.cos(player.angle) * 4;
    const ty = player.y + Math.sin(player.angle) * 4;
    const cx = Math.round(Math.max(1, Math.min(COLS - 2, tx)));
    const cy = Math.round(Math.max(1, Math.min(ROWS - 2, ty)));
    distractionPoint = { x: cx, y: cy };
    distractionTimer = 180;
    chairCooldown = 120;
}

function tryOpenDoor() {
    const range = HITBOX.doorInteract.range;
    for (const d of doors) {
        for (const r of d.rows) {
            const dx = Math.abs(player.x - d.col);
            const dy = Math.abs(player.y - r);
            if (dx <= range && dy <= range) {
                if (d.requires === 'keycard' && hasKeycard) d.open = true;
                if (d.requires === 'pin' && hasPIN) d.open = true;
            }
        }
    }
}

function handleMovement(dt) {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy = -1;
    if (keys['s'] || keys['arrowdown']) dy = 1;
    if (keys['a'] || keys['arrowleft']) dx = -1;
    if (keys['d'] || keys['arrowright']) dx = 1;

    playerMoving = (dx !== 0 || dy !== 0);

    if (playerMoving) {
        // Normalize diagonal
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len; dy /= len;
        player.angle = Math.atan2(dy, dx);

        moveAccum.x += dx * 0.06 * dt;
        moveAccum.y += dy * 0.06 * dt;

        // Move in whole-tile steps of ~1 tile (20px)
        while (Math.abs(moveAccum.x) >= 1 || Math.abs(moveAccum.y) >= 1) {
            let stepX = 0, stepY = 0;
            if (Math.abs(moveAccum.x) >= 1) {
                stepX = Math.sign(moveAccum.x);
                moveAccum.x -= stepX;
            }
            if (Math.abs(moveAccum.y) >= 1) {
                stepY = Math.sign(moveAccum.y);
                moveAccum.y -= stepY;
            }
            const nx = player.x + stepX;
            const ny = player.y + stepY;
            if (!isBlocked(Math.round(ny), Math.round(nx))) {
                player.x = nx;
                player.y = ny;
            } else {
                // Try single axis
                if (stepX !== 0 && !isBlocked(Math.round(player.y), Math.round(player.x + stepX))) {
                    player.x += stepX;
                } else if (stepY !== 0 && !isBlocked(Math.round(player.y + stepY), Math.round(player.x))) {
                    player.y += stepY;
                }
                moveAccum.x = 0;
                moveAccum.y = 0;
            }
        }

        // Pickup items (check tiles within pickup hitbox radius)
        const pr = Math.round(player.y), pc = Math.round(player.x);
        const pickR = HITBOX.pickup.radius;
        for (let checkR = Math.floor(player.y - pickR); checkR <= Math.ceil(player.y + pickR); checkR++) {
          for (let checkC = Math.floor(player.x - pickR); checkC <= Math.ceil(player.x + pickR); checkC++) {
            if (checkR >= 0 && checkR < ROWS && checkC >= 0 && checkC < COLS) {
              const tdx = player.x - checkC, tdy = player.y - checkR;
              if (tdx * tdx + tdy * tdy < pickR * pickR) {
                if (map[checkR][checkC] === 4) { hasKeycard = true; map[checkR][checkC] = 0; if(typeof thPickup==='function')thPickup(); }
                if (map[checkR][checkC] === 5) { hasPIN = true; map[checkR][checkC] = 0; if(typeof thPickup==='function')thPickup(); }
              }
            }
          }
        }
        if (map[pr] && map[pr][pc] === 6 && hasKeycard && hasPIN) {
            // Level complete
            const timeBonus = Math.max(0, 1000 - Math.floor(gameTime / 60) * 10);
            const hpBonus = hp * 5;
            score += timeBonus + hpBonus + 500; // 500 base for completing level
            if(typeof thSuccess==='function')thSuccess();
            if (currentLevel >= 3) {
                state = STATE.WIN;
            } else {
                state = STATE.LEVEL_COMPLETE;
                levelCompleteTimer = 0;
            }
        }
    }
}

// --- Reset ---
function resetLevel() {
    initMap();
    initGuards();
    doors = [
        { col: 15, rows: [14, 15], open: false, requires: 'keycard' },
        { col: 28, rows: [14, 15], open: false, requires: 'pin' }
    ];
    player = { x: 2, y: 14, angle: 0 };
    hp = 100;
    suspicion = 0;
    hasKeycard = false;
    hasPIN = false;
    chairCooldown = 0;
    distractionPoint = null;
    distractionTimer = 0;
    moveAccum = { x: 0, y: 0 };
    gameTime = 0;
    paperBalls = [];
    paperBallCount = 5;
}

function resetGame() {
    currentLevel = 1;
    score = 0;
    resetLevel();
}

// --- Drawing ---
function drawTile(c, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
}

function drawVisionCone(g, visible) {
    const alert = g.state === 'chase';
    const color = alert ? YELLOW_ALERT : YELLOW;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(g.x * TILE + TILE / 2, g.y * TILE + TILE / 2);
    const steps = 30;
    const halfAngle = g.visionAngle / 2;
    for (let i = 0; i <= steps; i++) {
        const a = g.angle - halfAngle + (g.visionAngle * i / steps);
        let maxDist = g.visionRange;
        // Ray march for walls
        for (let d = 0.5; d <= g.visionRange; d += 0.5) {
            const rx = Math.round(g.x + Math.cos(a) * d);
            const ry = Math.round(g.y + Math.sin(a) * d);
            if (rx < 0 || rx >= COLS || ry < 0 || ry >= ROWS || map[ry][rx] === 1 || (isDoor(ry, rx) && !isDoorOpen(ry, rx))) {
                maxDist = d;
                break;
            }
        }
        const ex = (g.x + Math.cos(a) * maxDist) * TILE + TILE / 2;
        const ey = (g.y + Math.sin(a) * maxDist) * TILE + TILE / 2;
        ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    ctx.fill();

    // Flashlight beam effect
    if (g.hasFlashlight) {
        ctx.fillStyle = 'rgba(255,255,200,0.06)';
        ctx.beginPath();
        ctx.moveTo(g.x * TILE + TILE / 2, g.y * TILE + TILE / 2);
        const narrowAngle = g.visionAngle * 0.3;
        for (let i = 0; i <= 15; i++) {
            const a = g.angle - narrowAngle / 2 + (narrowAngle * i / 15);
            let maxDist = g.visionRange;
            for (let d = 0.5; d <= g.visionRange; d += 0.5) {
                const rx = Math.round(g.x + Math.cos(a) * d);
                const ry = Math.round(g.y + Math.sin(a) * d);
                if (rx < 0 || rx >= COLS || ry < 0 || ry >= ROWS || map[ry][rx] === 1 || (isDoor(ry, rx) && !isDoorOpen(ry, rx))) {
                    maxDist = d;
                    break;
                }
            }
            const ex = (g.x + Math.cos(a) * maxDist) * TILE + TILE / 2;
            const ey = (g.y + Math.sin(a) * maxDist) * TILE + TILE / 2;
            ctx.lineTo(ex, ey);
        }
        ctx.closePath();
        ctx.fill();
    }
}

function drawPlayer() {
    const cx = player.x * TILE + TILE / 2;
    const cy = player.y * TILE + TILE / 2;
    ctx.save();
    ctx.translate(cx, cy);

    if (playerSpriteLoaded) {
        // Rotate sprite to face movement direction
        // Sprite default orientation is "up" (-PI/2), so offset by +PI/2
        ctx.rotate(player.angle + Math.PI / 2);
        ctx.drawImage(playerSprite, -TILE / 2, -TILE / 2, TILE, TILE);
    } else {
        // Fallback: original teal triangle
        ctx.rotate(player.angle);
        ctx.fillStyle = TEAL;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-7, -6);
        ctx.lineTo(-7, 6);
        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawGuard(g) {
    const cx = g.x * TILE + TILE / 2;
    const cy = g.y * TILE + TILE / 2;
    ctx.fillStyle = g.state === 'chase' ? RED : ORANGE;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE / 2, 0, Math.PI * 2);
    ctx.fill();
    // Direction indicator
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(g.angle) * 12, cy + Math.sin(g.angle) * 12);
    ctx.stroke();

    // Alert "!" icon when chasing or investigating
    if (g.state === 'chase' || g.state === 'investigate') {
        const bobY = Math.sin(gameTime * 0.15) * 2;
        const iconY = cy - TILE - 4 + bobY;

        if (g.state === 'chase') {
            // Red exclamation for chase
            ctx.fillStyle = '#ff0000';
            ctx.strokeStyle = '#440000';
        } else {
            // Yellow exclamation for investigate
            ctx.fillStyle = '#ffdd00';
            ctx.strokeStyle = '#443300';
        }

        // Draw "!" bubble
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, iconY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = g.state === 'chase' ? '#fff' : '#000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', cx, iconY + 4);
        ctx.textAlign = 'left';
    }

    // Flashlight icon
    if (g.hasFlashlight) {
        ctx.fillStyle = '#ffee77';
        ctx.font = '8px monospace';
        ctx.fillText('F', cx - 3, cy - (g.state === 'chase' || g.state === 'investigate' ? 22 : 12));
    }
}

function drawPaperBalls() {
    for (const b of paperBalls) {
        const sx = b.x * TILE + TILE / 2;
        const sy = b.y * TILE + TILE / 2 - b.z * 20; // z lifts it visually
        const radius = 3;

        // Ball shadow on ground
        if (b.z > 0.05) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // The ball itself
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Sound ring when stopped and making noise
        if (b.stopped && b.soundTimer > 0) {
            const alpha = 0.15 + 0.15 * Math.sin(gameTime * 0.15);
            ctx.strokeStyle = `rgba(200,200,255,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            const ringSize = PAPER_BALL_SOUND_RANGE * TILE * (1 - b.soundTimer / 180 * 0.3);
            ctx.arc(b.x * TILE + TILE / 2, b.y * TILE + TILE / 2, ringSize, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

function drawHUD() {
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 8, 160, 20);
    ctx.fillStyle = hp > 40 ? '#00cc66' : RED;
    ctx.fillRect(12, 10, (hp / 100) * 156, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText('HP ' + hp, 16, 23);

    // Suspicion bar
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(10, 32, 160, 20);
    ctx.fillStyle = suspicion > 60 ? RED : '#ffaa00';
    ctx.fillRect(12, 34, (suspicion / 100) * 156, 16);
    ctx.fillStyle = '#fff';
    ctx.fillText('SUSPICION ' + Math.floor(suspicion), 16, 47);

    // Level and Score
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(canvas.width - 200, 8, 190, 20);
    ctx.fillStyle = TEAL;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('LEVEL ' + currentLevel + '  SCORE ' + score, canvas.width - 195, 22);

    // Items
    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    const ky = 70;
    ctx.fillStyle = hasKeycard ? '#0f0' : '#555';
    ctx.fillText('[KEYCARD] ' + (hasKeycard ? 'YES' : 'NO'), 12, ky);
    ctx.fillStyle = hasPIN ? '#0f0' : '#555';
    ctx.fillText('[PIN] ' + (hasPIN ? 'YES' : 'NO'), 12, ky + 16);

    // Paper ball count
    ctx.fillStyle = paperBallCount > 0 ? '#fff' : '#555';
    ctx.fillText('[C] Paper Ball x' + paperBallCount, 12, ky + 32);

    // Chair cooldown
    ctx.fillStyle = chairCooldown <= 0 ? '#0ff' : '#555';
    ctx.fillText('[X] Throw Chair' + (chairCooldown > 0 ? ' (' + Math.ceil(chairCooldown / 60) + 's)' : ''), 12, ky + 48);

    // Controls hint
    ctx.fillStyle = '#445';
    ctx.font = '10px monospace';
    ctx.fillText('WASD move | E door | C paper ball | X chair | P pause', 12, canvas.height - 8);

    // -- MINIMAP (cross-pollinated from dungeon_shooter) --
    var mmX = canvas.width - 110, mmY = canvas.height - 110, mmS = 100;
    var mmScale = mmS / Math.max(ROWS, COLS);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mmX - 2, mmY - 2, mmS + 4, mmS + 4);
    for (var mr = 0; mr < ROWS; mr++) {
        for (var mc = 0; mc < COLS; mc++) {
            var tile = map[mr] ? map[mr][mc] : 0;
            if (tile === 1) { ctx.fillStyle = '#2a3050'; }
            else if (tile === 4) { ctx.fillStyle = '#ff0'; }
            else if (tile === 5) { ctx.fillStyle = '#f80'; }
            else if (tile === 6) { ctx.fillStyle = '#0f0'; }
            else continue;
            ctx.fillRect(mmX + mc * mmScale, mmY + mr * mmScale, mmScale, mmScale);
        }
    }
    // Player dot
    ctx.fillStyle = '#00ffd2';
    ctx.beginPath();
    ctx.arc(mmX + player.x * mmScale, mmY + player.y * mmScale, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Guards
    if (typeof guards !== 'undefined') {
        for (var gi = 0; gi < guards.length; gi++) {
            var guard = guards[gi];
            ctx.fillStyle = guard.state === 'chase' ? '#f22' : '#f80';
            ctx.beginPath();
            ctx.arc(mmX + guard.x * mmScale, mmY + guard.y * mmScale, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawFogOfWar(visible) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!visible.has(r * COLS + c)) {
                ctx.fillStyle = 'rgba(4,4,8,0.88)';
                ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
            }
        }
    }
}

function drawDistraction() {
    if (distractionTimer > 0 && distractionPoint) {
        const alpha = 0.3 + 0.2 * Math.sin(gameTime * 0.1);
        ctx.strokeStyle = `rgba(255,255,0,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(distractionPoint.x * TILE + TILE / 2, distractionPoint.y * TILE + TILE / 2, CHAIR_SOUND_RANGE * TILE, 0, Math.PI * 2);
        ctx.stroke();
        // Chair icon
        ctx.fillStyle = '#aa8833';
        ctx.fillRect(distractionPoint.x * TILE + 4, distractionPoint.y * TILE + 4, 12, 12);
    }
}

function drawMenu() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = TEAL;
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STEALTH MAZE', canvas.width / 2, 140);
    ctx.fillStyle = smMode === 'CREATIVE' ? '#00ffd2' : '#ff6b4a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('MODE: ' + smMode, canvas.width / 2, 170);
    ctx.fillStyle = '#556';
    ctx.font = '11px monospace';
    ctx.fillText('TAB to toggle', canvas.width / 2, 188);

    ctx.fillStyle = '#8899aa';
    ctx.font = '15px monospace';
    const lines = [
        'Infiltrate the office. Avoid the guards.',
        '',
        'WASD - Move        E - Open Door',
        'C - Throw Paper Ball (distraction)',
        'X - Throw Chair (distraction)',
        'P - Pause',
        '',
        '1. Find the KEYCARD in the Cubicles',
        '2. Find the PIN code in HR',
        '3. Reach the Server Room terminal',
        '',
        'Stay out of guard vision cones!',
        'Guards investigate paper ball sounds.',
        '3 levels of increasing difficulty!',
    ];
    lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, 210 + i * 22));

    menuBlink += 0.05;
    ctx.fillStyle = `rgba(0,210,255,${0.5 + 0.5 * Math.sin(menuBlink)})`;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('Press ENTER or SPACE to start', canvas.width / 2, 540);
    ctx.textAlign = 'left';
}

function drawPaused() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = TEAL;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Press P to resume', canvas.width / 2, canvas.height / 2 + 40);
    ctx.textAlign = 'left';
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = RED;
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DETECTED', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('You were eliminated by security.', canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#888';
    ctx.fillText('Level ' + currentLevel + '  Score: ' + score, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillText('Press ENTER to retry from Level 1', canvas.width / 2, canvas.height / 2 + 60);
    ctx.textAlign = 'left';
}

function drawLevelComplete() {
    levelCompleteTimer++;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL ' + currentLevel + ' COMPLETE', canvas.width / 2, canvas.height / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '18px monospace';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Press ENTER for Level ' + (currentLevel + 1), canvas.width / 2, canvas.height / 2 + 50);
    ctx.textAlign = 'left';
}

function drawWin() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MISSION COMPLETE', canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.fillText('All 3 levels cleared!', canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = TEAL;
    ctx.font = 'bold 24px monospace';
    ctx.fillText('Final Score: ' + score, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillStyle = '#aaa';
    ctx.font = '16px monospace';
    ctx.fillText('Press ENTER to play again', canvas.width / 2, canvas.height / 2 + 70);
    ctx.textAlign = 'left';
}

// --- Main Loop ---
let lastTime = 0;
function loop(ts) {
    const dt = lastTime ? Math.min((ts - lastTime) / 16.67, 3) : 1;
    lastTime = ts;

    if (state === STATE.MENU) {
        drawMenu();
        rafId = requestAnimationFrame(loop);
        return;
    }

    if (state === STATE.PLAYING) {
        gameTime++;
        handleMovement(dt);
        for (const g of guards) updateGuard(g, dt);
        updateSuspicion(dt);
        updatePaperBalls(dt);
        if (chairCooldown > 0) chairCooldown -= dt;
        if (distractionTimer > 0) distractionTimer -= dt;
        else distractionPoint = null;
    }

    // --- Render ---
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const visible = getVisibleTiles();

    // Draw map tiles
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const v = map[r][c];
            if (v === 1) {
                drawTile(c, r, WALL_COLOR);
                // Wall edge highlight
                ctx.fillStyle = '#252540';
                ctx.fillRect(c * TILE, r * TILE, TILE, 2);
            } else if (v === 0) {
                // Floor with subtle grid
                ctx.fillStyle = '#111120';
                ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
                ctx.strokeStyle = '#181828';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(c * TILE, r * TILE, TILE, TILE);
            } else if (v === 2 || v === 3) {
                const open = isDoorOpen(r, c);
                drawTile(c, r, open ? DOOR_OPEN_COLOR : DOOR_COLOR);
                if (!open) {
                    ctx.fillStyle = v === 2 ? '#88aa00' : '#aa3300';
                    ctx.font = '10px monospace';
                    ctx.fillText(v === 2 ? 'KC' : 'PN', c * TILE + 2, r * TILE + 14);
                }
            } else if (v === 4 || v === 5) {
                ctx.fillStyle = '#111120';
                ctx.fillRect(c * TILE, r * TILE, TILE, TILE);

                // Sine-wave bob offset
                const bobOffset = Math.sin(gameTime * 0.08 + c * 0.5 + r * 0.7) * 3;
                const centerX = c * TILE + TILE / 2;
                const centerY = r * TILE + TILE / 2 + bobOffset;
                const diamondSize = 8;

                if (coreSpriteLoaded) {
                    // Draw core sprite behind the diamond, bobbing
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(coreSprite, centerX - TILE / 2, centerY - TILE / 2, TILE, TILE);
                    ctx.restore();
                }

                // Golden diamond shape
                const goldGrad = ctx.createLinearGradient(centerX - diamondSize, centerY - diamondSize, centerX + diamondSize, centerY + diamondSize);
                goldGrad.addColorStop(0, '#ffd700');
                goldGrad.addColorStop(0.5, '#fff8b0');
                goldGrad.addColorStop(1, '#daa520');
                ctx.fillStyle = goldGrad;

                ctx.beginPath();
                ctx.moveTo(centerX, centerY - diamondSize);    // top
                ctx.lineTo(centerX + diamondSize, centerY);    // right
                ctx.lineTo(centerX, centerY + diamondSize);    // bottom
                ctx.lineTo(centerX - diamondSize, centerY);    // left
                ctx.closePath();
                ctx.fill();

                // Sparkle outline
                ctx.strokeStyle = v === 4 ? '#ffee00' : '#ff88ff';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Label
                ctx.fillStyle = '#000';
                ctx.font = 'bold 6px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(v === 4 ? 'KC' : 'PN', centerX, centerY + 3);
                ctx.textAlign = 'left';
            } else if (v === 6) {
                ctx.fillStyle = '#002211';
                ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
                // Server terminal
                const pulse = 0.5 + 0.5 * Math.sin(gameTime * 0.08);
                ctx.fillStyle = `rgba(0,255,100,${pulse})`;
                ctx.fillRect(c * TILE + 2, r * TILE + 2, 16, 16);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 9px monospace';
                ctx.fillText('SV', c * TILE + 4, r * TILE + 13);
            }
        }
    }

    // Vision cones (draw before fog so they get occluded)
    for (const g of guards) drawVisionCone(g, visible);

    // Distraction
    drawDistraction();

    // Paper balls
    drawPaperBalls();

    // Guards
    for (const g of guards) drawGuard(g);

    // Player
    drawPlayer();

    // Fog of war
    drawFogOfWar(visible);

    // HUD (always on top)
    drawHUD();

    // Room labels
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CUBICLES', 7.5 * TILE, 1.2 * TILE + 12);
    ctx.fillText('HR OFFICE', 22 * TILE, 1.2 * TILE + 12);
    ctx.fillText('SERVERS', 34 * TILE, 1.2 * TILE + 12);
    ctx.textAlign = 'left';
    ctx.restore();

    if (state === STATE.PAUSED) drawPaused();
    if (state === STATE.GAMEOVER) drawGameOver();
    if (state === STATE.LEVEL_COMPLETE) drawLevelComplete();
    if (state === STATE.WIN) drawWin();

    rafId = requestAnimationFrame(loop);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && rafId) cancelAnimationFrame(rafId);
});

initMap();
rafId = requestAnimationFrame(loop);



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
  var hbPeriod = 0.7361102909666666;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.013279856013779602;mix-blend-mode:overlay';
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
