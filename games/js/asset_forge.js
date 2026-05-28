const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W, H;

// ── 8-bit pixel render layer ──
const pixCanvas = document.createElement('canvas');
const pixCtx = pixCanvas.getContext('2d');
const PIX_SCALE = 3;

function resize() {
  W = canvas.width = innerWidth; H = canvas.height = innerHeight;
  pixCanvas.width = Math.ceil(W / PIX_SCALE);
  pixCanvas.height = Math.ceil(H / PIX_SCALE);
}
resize(); addEventListener('resize', resize);

// ── Particle system ──
const particles = [];
function spawnParticles(x, y, count, col) {
  for (let i = 0; i < count; i++) {
    const l = 0.5 + Math.random() * 0.4;
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: -Math.random() * 180 - 40,
      life: l, maxLife: l,
      col: col || '#fff',
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 400 * dt; // gravity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles(target, cam, scale) {
  scale = scale || 1;
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    target.globalAlpha = alpha;
    target.fillStyle = p.col;
    target.fillRect((p.x - (cam || 0)) / scale, p.y / scale, 2, 2);
  }
  target.globalAlpha = 1;
}

// ── Screen flash ──
// (player.flash set in game logic)

// ── Dithered background helper (uses cached tile) ──
let _ditherTile = null;
let _ditherColA = '', _ditherColB = '';
function drawDitheredBg(target, w, h, colA, colB) {
  // Create a small 4x4 dither tile, cache it
  if (!_ditherTile || _ditherColA !== colA || _ditherColB !== colB) {
    _ditherColA = colA; _ditherColB = colB;
    _ditherTile = document.createElement('canvas');
    _ditherTile.width = 4; _ditherTile.height = 4;
    const tc = _ditherTile.getContext('2d');
    tc.fillStyle = colA;
    tc.fillRect(0, 0, 4, 4);
    tc.fillStyle = colB;
    // checkerboard pattern
    for (let y = 0; y < 4; y++) {
      for (let x = ((y % 2 === 0) ? 1 : 0); x < 4; x += 2) {
        tc.fillRect(x, y, 1, 1);
      }
    }
  }
  const pat = target.createPattern(_ditherTile, 'repeat');
  target.fillStyle = pat;
  target.fillRect(0, 0, w, h);
}

// ── Scanlines ──
function drawScanlines(target, w, h) {
  target.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < h; y += 3) {
    target.fillRect(0, y, w, 1);
  }
}

// ── CRT vignette ──
function drawCRTVignette(target, w, h) {
  const vg = target.createRadialGradient(w/2, h/2, w*0.15, w/2, h/2, Math.max(w, h)*0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  target.fillStyle = vg;
  target.fillRect(0, 0, w, h);
}

// Sieve constants
const SEEDS = [9,41,49,89,161,169,281,401,601,609,641,649,801,921,961];
const SALEZ = [2,3,5,7,8,9,11];

// ── Phase system: SCAN → FORGE → BUILD → PLAY ──
let phase = 'scan';     // scan, forge, build, play
let phaseTime = 0;
let sprites = [];        // raw sprite data
let forgedAssets = [];    // 3D-rendered asset data
let gameWorld = null;     // generated game
let frameCount = 0;

// ── Logging ──
const logLines = [];
function log(msg) {
  logLines.unshift(msg);
  if (logLines.length > 12) logLines.pop();
  document.getElementById('log').innerHTML = logLines.map((l,i) =>
    `<div style="opacity:${1-i*.07}">${l}</div>`).join('');
}

// ══════════════════════════════════════════════════
// PHASE 1: SCAN — Generate procedural sprites
// ══════════════════════════════════════════════════
function generateSprites() {
  const types = [
    { name: 'MECHA CORE', role: 'player', palette: [[0,255,210],[0,158,130],[0,92,75]], shape: 'mecha' },
    { name: 'RED MAGE', role: 'enemy', palette: [[204,34,51],[136,17,34],[255,68,102]], shape: 'mage' },
    { name: 'GOLD GEODE', role: 'item', palette: [[212,168,68],[160,120,48],[255,210,80]], shape: 'gem' },
    { name: 'FISH SCOUT', role: 'enemy', palette: [[0,100,180],[0,60,120],[0,160,220]], shape: 'fish' },
    { name: 'CRYSTAL CORE', role: 'item', palette: [[180,100,255],[120,50,200],[220,160,255]], shape: 'crystal' },
    { name: 'STONE GOLEM', role: 'enemy', palette: [[100,95,85],[65,62,55],[140,135,120]], shape: 'block' },
    { name: 'TEAL MANDALA', role: 'vfx', palette: [[0,255,210],[0,200,255],[100,255,230]], shape: 'mandala' },
    { name: 'DOOR GATE', role: 'prop', palette: [[80,80,90],[50,50,58],[120,120,130]], shape: 'door' },
  ];

  for (const type of types) {
    const size = 48;
    const pixels = new Uint8Array(size * size * 4);
    const cx = size/2, cy = size/2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y*size+x)*4;
        const dx = x-cx, dy = y-cy;
        const dist = Math.sqrt(dx*dx+dy*dy);
        let v = 0;

        switch(type.shape) {
          case 'mecha':
            if (dy < -size*.25 && dist < size*.15) v = 1;     // head
            if (dy > -size*.25 && dy < size*.1 && Math.abs(dx) < size*.18) v = 0.9; // torso
            if (dy > size*.1 && dy < size*.4 && Math.abs(dx) < size*.06) v = 0.7;   // legs
            if (Math.abs(dx) > size*.15 && Math.abs(dx) < size*.3 && dy > -size*.2 && dy < size*.15) v = 0.5; // cape
            break;
          case 'mage':
            if (dy < -size*.2 && dist < size*.12) v = 1;      // head
            if (dy > -size*.2 && Math.abs(dx) < size*.15 + (dy+size*.2)*.2) v = 0.8; // robe
            if (Math.abs(dx) < size*.25 && dy > -size*.1 && dy < 0) v = 0.6;         // arms
            break;
          case 'gem':
            if (Math.abs(dx) + Math.abs(dy) < size*.3) v = 1; // diamond
            if (Math.abs(dx) + Math.abs(dy) < size*.2) v = 1.2; // inner glow
            break;
          case 'fish':
            const fishBody = Math.abs(dy) < size*.12 && dx > -size*.25 && dx < size*.2;
            const fishTail = dx < -size*.15 && Math.abs(dy) < size*.2 * (1-(dx+size*.15)/(size*.15));
            if (fishBody || fishTail) v = 0.8;
            break;
          case 'crystal':
            const angle = Math.atan2(dy, dx);
            const star = dist < size*.25 * (0.6 + 0.4*Math.cos(angle*5));
            if (star) v = 1;
            break;
          case 'block':
            if (Math.abs(dx) < size*.25 && Math.abs(dy) < size*.3) v = 0.7;
            if (Math.abs(dx) < size*.2 && Math.abs(dy) < size*.25) v = 0.9;
            break;
          case 'mandala':
            const ring = Math.abs(dist - size*.2) < size*.04;
            const cross = (Math.abs(dx) < size*.03 || Math.abs(dy) < size*.03) && dist < size*.25;
            if (ring || cross) v = 1;
            break;
          case 'door':
            if (Math.abs(dx) < size*.2 && dy > -size*.35 && dy < size*.35) v = 0.6;
            if (Math.abs(dx) < size*.15 && dy > -size*.25 && dy < size*.25) v = 0.9;
            break;
        }

        if (v > 0) {
          const ci = v > 0.8 ? 0 : v > 0.5 ? 1 : 2;
          const c = type.palette[Math.min(ci, type.palette.length-1)];
          pixels[i] = c[0]; pixels[i+1] = c[1]; pixels[i+2] = c[2];
          pixels[i+3] = Math.min(255, Math.round(v * 220));
        }
      }
    }

    sprites.push({
      name: type.name, role: type.role, shape: type.shape,
      size, pixels, palette: type.palette,
      brightness: type.palette[0].reduce((a,b)=>a+b)/3/255,
      complexity: type.shape === 'mandala' ? 0.9 : type.shape === 'mecha' ? 0.8 : 0.5,
    });
  }
  return sprites;
}

// ══════════════════════════════════════════════════
// PHASE 2: FORGE — Raymarching each sprite into 3D
// ══════════════════════════════════════════════════
let forgeIndex = 0;
let forgeAngle = 0;
const FORGE_ANGLES = 8;
const FORGE_SIZE = 64;

function forgeOneFrame() {
  if (forgeIndex >= sprites.length) return true; // done

  const sprite = sprites[forgeIndex];
  const angleIdx = forgeAngle;
  const theta = (angleIdx / FORGE_ANGLES) * Math.PI * 2;

  // Software raycaster — render sprite as 3D height map from this angle
  const render = new Uint8Array(FORGE_SIZE * FORGE_SIZE * 4);
  const sData = sprite.pixels;
  const sSize = sprite.size;

  for (let py = 0; py < FORGE_SIZE; py++) {
    for (let px = 0; px < FORGE_SIZE; px++) {
      const ri = (py * FORGE_SIZE + px) * 4;
      // Normalized coords (-1 to 1)
      const nx = (px / FORGE_SIZE) * 2 - 1;
      const ny = (py / FORGE_SIZE) * 2 - 1;

      // Rotate sample point by angle
      const rx = nx * Math.cos(theta) - 0.5 * Math.sin(theta);
      const ry = ny;
      const rz = nx * Math.sin(theta) + 0.5 * Math.cos(theta);

      // Sample sprite at rotated XY
      const sx = Math.floor((rx * 0.5 + 0.5) * sSize);
      const sy = Math.floor((ry * 0.5 + 0.5) * sSize);

      if (sx >= 0 && sx < sSize && sy >= 0 && sy < sSize) {
        const si = (sy * sSize + sx) * 4;
        const alpha = sData[si + 3];
        if (alpha > 10) {
          // Height from alpha
          const height = alpha / 255;
          // Fake 3D: darken based on depth and angle
          const depth = rz * 0.5 + 0.5;
          const light = 0.4 + 0.6 * Math.max(0, Math.cos(theta) * 0.5 + 0.5);
          const ao = 0.7 + 0.3 * height; // ambient occlusion from height

          render[ri]   = Math.min(255, Math.round(sData[si] * light * ao));
          render[ri+1] = Math.min(255, Math.round(sData[si+1] * light * ao));
          render[ri+2] = Math.min(255, Math.round(sData[si+2] * light * ao));
          render[ri+3] = Math.round(alpha * (0.5 + depth * 0.5));
        }
      }
    }
  }

  // Store the rendered angle
  if (!forgedAssets[forgeIndex]) {
    forgedAssets[forgeIndex] = {
      sprite: sprite,
      angles: [],
      depthData: [],
      boundingBox: { w: 0, h: 0 },
      avgBrightness: 0,
    };
  }

  forgedAssets[forgeIndex].angles.push({
    pixels: render,
    theta: theta,
    angleIdx: angleIdx,
  });

  // Compute bounding box and brightness for this angle
  let minX=FORGE_SIZE, maxX=0, minY=FORGE_SIZE, maxY=0, totalB=0, count=0;
  for (let y=0; y<FORGE_SIZE; y++) {
    for (let x=0; x<FORGE_SIZE; x++) {
      const a = render[(y*FORGE_SIZE+x)*4+3];
      if (a > 20) {
        minX=Math.min(minX,x); maxX=Math.max(maxX,x);
        minY=Math.min(minY,y); maxY=Math.max(maxY,y);
        totalB += (render[(y*FORGE_SIZE+x)*4] + render[(y*FORGE_SIZE+x)*4+1] + render[(y*FORGE_SIZE+x)*4+2]) / 3;
        count++;
      }
    }
  }
  forgedAssets[forgeIndex].boundingBox = { w: maxX-minX, h: maxY-minY };
  forgedAssets[forgeIndex].avgBrightness = count > 0 ? totalB / count / 255 : 0;

  forgeAngle++;
  if (forgeAngle >= FORGE_ANGLES) {
    forgeAngle = 0;
    forgeIndex++;
  }
  return false;
}

// ══════════════════════════════════════════════════
// PHASE 2.5: CROSSBREED — Mix assets genetically
// ══════════════════════════════════════════════════
let crossbreeds = [];
let crossbreedIndex = 0;
const MAX_CROSSBREEDS = 12;

function generateCrossbreeds() {
  // Pair every asset type with every other, pick the best combos
  const pairs = [];
  for (let i = 0; i < sprites.length; i++) {
    for (let j = i + 1; j < sprites.length; j++) {
      // Fitness: different roles breed better (diversity)
      const diversity = sprites[i].role !== sprites[j].role ? 1.5 : 0.8;
      // Complementary brightness (one bright + one dark = interesting)
      const contrast = Math.abs(sprites[i].brightness - sprites[j].brightness);
      pairs.push({ a: i, b: j, fitness: diversity + contrast });
    }
  }
  pairs.sort((a, b) => b.fitness - a.fitness);

  // Take top pairs
  const selected = pairs.slice(0, MAX_CROSSBREEDS);

  for (let pi = 0; pi < selected.length; pi++) {
    const pair = selected[pi];
    const parentA = sprites[pair.a];
    const parentB = sprites[pair.b];
    const seed = SEEDS[pi % SEEDS.length];

    // Crossover method based on sieve modulus
    const method = SALEZ[pi % SALEZ.length] % 4;
    const size = parentA.size;
    const pixels = new Uint8Array(size * size * 4);

    // Blend palettes (child gets mix of both parents)
    const childPalette = parentA.palette.map((c, ci) => {
      const pb = parentB.palette[Math.min(ci, parentB.palette.length - 1)];
      const mix = (seed % 100) / 100; // blend ratio from sieve
      return [
        Math.round(c[0] * mix + pb[0] * (1 - mix)),
        Math.round(c[1] * mix + pb[1] * (1 - mix)),
        Math.round(c[2] * mix + pb[2] * (1 - mix)),
      ];
    });

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const aAlpha = parentA.pixels[i + 3];
        const bAlpha = parentB.pixels[i + 3];

        let alpha = 0, srcR = 0, srcG = 0, srcB = 0;

        switch (method) {
          case 0: // HORIZONTAL SPLIT — left from A, right from B
            if (x < size / 2) {
              alpha = aAlpha; srcR = parentA.pixels[i]; srcG = parentA.pixels[i+1]; srcB = parentA.pixels[i+2];
            } else {
              alpha = bAlpha; srcR = parentB.pixels[i]; srcG = parentB.pixels[i+1]; srcB = parentB.pixels[i+2];
            }
            break;

          case 1: // VERTICAL SPLIT — top from A, bottom from B
            if (y < size / 2) {
              alpha = aAlpha; srcR = parentA.pixels[i]; srcG = parentA.pixels[i+1]; srcB = parentA.pixels[i+2];
            } else {
              alpha = bAlpha; srcR = parentB.pixels[i]; srcG = parentB.pixels[i+1]; srcB = parentB.pixels[i+2];
            }
            break;

          case 2: // CHECKERBOARD — alternating tiles from each parent
            if (((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0) {
              alpha = aAlpha; srcR = parentA.pixels[i]; srcG = parentA.pixels[i+1]; srcB = parentA.pixels[i+2];
            } else {
              alpha = bAlpha; srcR = parentB.pixels[i]; srcG = parentB.pixels[i+1]; srcB = parentB.pixels[i+2];
            }
            break;

          case 3: // ALPHA BLEND — wherever both have pixels, average them
            if (aAlpha > 10 && bAlpha > 10) {
              alpha = Math.max(aAlpha, bAlpha);
              const t = 0.5;
              srcR = Math.round(parentA.pixels[i] * t + parentB.pixels[i] * (1-t));
              srcG = Math.round(parentA.pixels[i+1] * t + parentB.pixels[i+1] * (1-t));
              srcB = Math.round(parentA.pixels[i+2] * t + parentB.pixels[i+2] * (1-t));
            } else if (aAlpha > 10) {
              alpha = aAlpha; srcR = parentA.pixels[i]; srcG = parentA.pixels[i+1]; srcB = parentA.pixels[i+2];
            } else {
              alpha = bAlpha; srcR = parentB.pixels[i]; srcG = parentB.pixels[i+1]; srcB = parentB.pixels[i+2];
            }
            break;
        }

        // Recolor with child palette
        if (alpha > 10) {
          const brightness = (srcR + srcG + srcB) / 3 / 255;
          const ci = brightness > 0.6 ? 0 : brightness > 0.3 ? 1 : 2;
          const pc = childPalette[Math.min(ci, childPalette.length - 1)];
          pixels[i]   = pc[0];
          pixels[i+1] = pc[1];
          pixels[i+2] = pc[2];
          pixels[i+3] = alpha;
        }
      }
    }

    // Mutation: small random pixel noise (5% chance per pixel)
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i+3] > 10 && Math.random() < 0.05) {
        pixels[i]   = Math.min(255, pixels[i] + Math.floor(Math.random() * 30 - 15));
        pixels[i+1] = Math.min(255, pixels[i+1] + Math.floor(Math.random() * 30 - 15));
        pixels[i+2] = Math.min(255, pixels[i+2] + Math.floor(Math.random() * 30 - 15));
      }
    }

    // Determine child role: inherits from the more "dominant" parent
    const roles = [parentA.role, parentB.role];
    let childRole;
    if (roles.includes('enemy') && roles.includes('item')) childRole = 'mimic'; // enemy disguised as item
    else if (roles.includes('player') && roles.includes('enemy')) childRole = 'miniboss';
    else if (roles.includes('vfx') && roles.includes('enemy')) childRole = 'hazard';
    else if (roles.includes('item') && roles.includes('vfx')) childRole = 'powerup';
    else if (roles.includes('prop') && roles.includes('enemy')) childRole = 'trap';
    else childRole = roles[seed % 2];

    const methods = ['HORIZONTAL SPLIT','VERTICAL SPLIT','CHECKERBOARD','ALPHA BLEND'];
    const childName = `${parentA.name.split(' ')[0]}-${parentB.name.split(' ')[0]}`;

    const child = {
      name: childName,
      role: childRole,
      shape: 'hybrid',
      size, pixels, palette: childPalette,
      brightness: childPalette[0].reduce((a,b)=>a+b)/3/255,
      complexity: (parentA.complexity + parentB.complexity) / 2 + 0.1,
      parentA: parentA.name,
      parentB: parentB.name,
      method: methods[method],
    };

    crossbreeds.push(child);
    log(`BRED: ${childName} (${childRole}) via ${methods[method]}`);
    log(`  ${parentA.name} × ${parentB.name} → palette [${childPalette[0].join(',')}]`);
  }

  // Add crossbreeds to the sprite pool for forging
  sprites.push(...crossbreeds);
  return crossbreeds;
}

function drawCrossbreedPhase() {
  drawDitheredBg(ctx, W, H, '#000c1a', '#020e22');

  ctx.fillStyle = '#00ff9d';
  ctx.font = '14px "Orbitron"';
  ctx.textAlign = 'center';
  ctx.fillText('CROSSBREEDING', W/2, 60);

  // Show breeding pairs and their offspring
  const shown = Math.min(crossbreedIndex + 1, crossbreeds.length);
  const cols = Math.min(4, shown);
  const cardW = Math.min(180, (W - 40) / cols - 10);

  for (let i = 0; i < shown; i++) {
    const child = crossbreeds[i];
    const col = i % cols, row = Math.floor(i / cols);
    const cx = W/2 - (cols * (cardW + 10))/2 + col * (cardW + 10) + cardW/2;
    const cy = 100 + row * 130;

    // Card bg
    ctx.fillStyle = 'rgba(0,255,157,0.03)';
    ctx.fillRect(cx - cardW/2, cy, cardW, 110);
    ctx.strokeStyle = 'rgba(0,255,157,0.15)';
    ctx.strokeRect(cx - cardW/2, cy, cardW, 110);

    // Child sprite preview
    const imgData = ctx.createImageData(child.size, child.size);
    imgData.data.set(child.pixels);
    const tmp = document.createElement('canvas');
    tmp.width = child.size; tmp.height = child.size;
    tmp.getContext('2d').putImageData(imgData, 0, 0);
    ctx.drawImage(tmp, cx - 20, cy + 5, 40, 40);

    // Labels
    ctx.fillStyle = `rgb(${child.palette[0].join(',')})`;
    ctx.font = '9px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(child.name, cx, cy + 55);

    const roleColor = child.role === 'mimic' ? '#ff8800' :
                      child.role === 'miniboss' ? '#ff2244' :
                      child.role === 'hazard' ? '#ff4466' :
                      child.role === 'powerup' ? '#44ff88' :
                      child.role === 'trap' ? '#ff6600' : '#888';
    ctx.fillStyle = roleColor;
    ctx.font = '8px "Share Tech Mono"';
    ctx.fillText(child.role.toUpperCase(), cx, cy + 68);

    ctx.fillStyle = 'rgba(0,255,157,0.3)';
    ctx.font = '7px "Share Tech Mono"';
    ctx.fillText(child.method, cx, cy + 80);
    ctx.fillText(`${child.parentA} × ${child.parentB}`, cx, cy + 92);
  }

  // Progress
  const pct = crossbreedIndex / MAX_CROSSBREEDS;
  ctx.fillStyle = 'rgba(0,255,157,0.06)';
  ctx.fillRect(W/2 - 200, H - 60, 400, 8);
  ctx.fillStyle = '#D4A844';
  ctx.fillRect(W/2 - 200, H - 60, 400 * pct, 8);
}

// ══════════════════════════════════════════════════
// PHASE 3: BUILD — Analyze forged data, generate game
// ══════════════════════════════════════════════════
function buildGame() {
  // Analyze all forged assets and assign game roles
  const players = forgedAssets.filter(a => a.sprite.role === 'player');
  const enemies = forgedAssets.filter(a => ['enemy','miniboss','mimic','hazard','trap'].includes(a.sprite.role));
  const items = forgedAssets.filter(a => ['item','powerup'].includes(a.sprite.role));
  const props = forgedAssets.filter(a => a.sprite.role === 'prop');
  const vfx = forgedAssets.filter(a => a.sprite.role === 'vfx');
  log(`ASSETS: ${players.length}P ${enemies.length}E ${items.length}I — crossbreeds active`);

  // Generate world layout from asset properties
  const worldW = 3000, worldH = 600;
  const platforms = [];
  const entityList = [];

  // Ground
  platforms.push({ x: 0, y: worldH - 40, w: worldW, h: 40, color: '#1A3020' });

  // Platforms seeded from sieve
  for (let i = 0; i < 20; i++) {
    const seed = SEEDS[i % SEEDS.length];
    platforms.push({
      x: (seed * 7 + i * 140) % (worldW - 200) + 50,
      y: worldH - 100 - (seed % 200) - i * 15,
      w: 80 + (seed % 80),
      h: 16,
      color: `rgb(${20+i*3},${40+i*2},${25+i*2})`,
    });
  }

  // Place player
  const playerAsset = players[0] || forgedAssets[0];
  const player = {
    asset: playerAsset,
    x: 100, y: worldH - 100,
    vx: 0, vy: 0,
    w: 32, h: 40,
    hp: 63, maxHp: 63, // G8 digit sum
    score: 0,
    facing: 0, // angle index
    onGround: false,
    attackTimer: 0,
    flash: 0, flashColor: '#fff',
  };

  // Place enemies based on their forged data
  for (let i = 0; i < enemies.length * 3; i++) {
    const asset = enemies[i % enemies.length];
    const seed = SEEDS[(i * 3) % SEEDS.length];
    entityList.push({
      type: 'enemy',
      asset: asset,
      x: 200 + (seed * 11 + i * 300) % (worldW - 400),
      y: worldH - 80 - (seed % 150),
      vx: (asset.avgBrightness > 0.5 ? 1 : -1) * (0.5 + asset.sprite.complexity),
      w: 24 + Math.round(asset.boundingBox.w * 0.4),
      h: 28 + Math.round(asset.boundingBox.h * 0.4),
      hp: Math.round(asset.sprite.complexity * 3) + 1,
      facing: 0,
      patrolLeft: 0, patrolRight: 0,
      alive: true,
    });
  }
  // Set patrol bounds
  entityList.forEach(e => {
    if (e.type === 'enemy') {
      e.patrolLeft = e.x - 80;
      e.patrolRight = e.x + 80;
    }
  });

  // Place items
  for (let i = 0; i < items.length * 4; i++) {
    const asset = items[i % items.length];
    const seed = SEEDS[(i * 5 + 2) % SEEDS.length];
    entityList.push({
      type: 'item',
      asset: asset,
      x: 150 + (seed * 13 + i * 200) % (worldW - 300),
      y: worldH - 100 - (seed % 250),
      w: 20, h: 20,
      collected: false,
      bob: Math.random() * Math.PI * 2,
      value: Math.round(asset.avgBrightness * 100) + 10,
    });
  }

  // Place props
  for (let i = 0; i < props.length * 2; i++) {
    const asset = props[i % props.length];
    const seed = SEEDS[(i * 7 + 4) % SEEDS.length];
    entityList.push({
      type: 'prop',
      asset: asset,
      x: 300 + (seed * 17 + i * 400) % (worldW - 500),
      y: worldH - 80,
      w: 32, h: 48,
    });
  }

  gameWorld = { worldW, worldH, platforms, entities: entityList, player, vfx, camX: 0, time: 0 };
  log(`WORLD BUILT: ${platforms.length} platforms, ${entityList.filter(e=>e.type==='enemy').length} enemies, ${entityList.filter(e=>e.type==='item').length} items`);
  return gameWorld;
}

// ══════════════════════════════════════════════════
// PHASE 4: PLAY — The generated game
// ══════════════════════════════════════════════════
const keys = {};
addEventListener('keydown', e => keys[e.code] = true);
addEventListener('keyup', e => keys[e.code] = false);

function updateGame(dt) {
  const g = gameWorld;
  const p = g.player;
  g.time += dt;

  // Input
  if (keys['ArrowRight'] || keys['KeyD']) { p.vx += 400 * dt; p.facing = 2; }
  if (keys['ArrowLeft'] || keys['KeyA']) { p.vx -= 400 * dt; p.facing = 6; }
  if ((keys['ArrowUp'] || keys['KeyW'] || keys['Space']) && p.onGround) {
    p.vy = -380; p.onGround = false;
  }
  if (keys['KeyJ'] && p.attackTimer <= 0) p.attackTimer = 0.3;

  // Physics
  p.vy += 700 * dt;
  p.vx *= 0.9;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.attackTimer > 0) p.attackTimer -= dt;

  // Platform collision
  p.onGround = false;
  for (const plat of g.platforms) {
    if (p.x + p.w > plat.x && p.x < plat.x + plat.w &&
        p.y + p.h > plat.y && p.y + p.h < plat.y + plat.h + 20 && p.vy > 0) {
      p.y = plat.y - p.h;
      p.vy = 0;
      p.onGround = true;
    }
  }

  // World bounds
  p.x = Math.max(0, Math.min(g.worldW - p.w, p.x));
  if (p.y > g.worldH) { p.y = g.worldH - 100; p.vy = 0; p.hp -= 10; }

  // Camera
  g.camX += (p.x - W/3 - g.camX) * 0.08;
  g.camX = Math.max(0, Math.min(g.worldW - W, g.camX));

  // Entities
  for (const e of g.entities) {
    if (e.type === 'enemy' && e.alive) {
      // Patrol
      e.x += e.vx * 60 * dt;
      if (e.x < e.patrolLeft || e.x > e.patrolRight) e.vx *= -1;
      e.facing = e.vx > 0 ? 2 : 6;

      // Player collision (damage)
      if (p.attackTimer <= 0 &&
          Math.abs(p.x + p.w/2 - e.x - e.w/2) < (p.w + e.w)/2 &&
          Math.abs(p.y + p.h/2 - e.y - e.h/2) < (p.h + e.h)/2) {
        p.hp -= 1;
        p.flash = 0.5; p.flashColor = '#ff2244';
        p.vx = (p.x < e.x ? -1 : 1) * 200;
        p.vy = -100;
      }

      // Attack hit check
      if (p.attackTimer > 0.15) {
        const atkX = p.x + (p.facing === 2 ? p.w : -20);
        if (Math.abs(atkX - e.x) < e.w + 15 && Math.abs(p.y - e.y) < 30) {
          e.hp--;
          e.vx *= -1;
          if (e.hp <= 0) {
            e.alive = false;
            p.score += 50;
            spawnParticles(e.x, e.y, 6, `rgb(${e.asset.sprite.palette[0].join(',')})`);
            log(`DESTROYED: ${e.asset.sprite.name} (+50)`);
          }
        }
      }
    }

    if (e.type === 'item' && !e.collected) {
      e.bob += dt * 3;
      if (Math.abs(p.x - e.x) < 25 && Math.abs(p.y - e.y) < 30) {
        e.collected = true;
        p.score += e.value;
        p.hp = Math.min(p.maxHp, p.hp + 5);
        p.flash = 1; p.flashColor = '#ffffff';
        spawnParticles(e.x, e.y, 4, `rgb(${e.asset.sprite.palette[0].join(',')})`);
        log(`COLLECTED: ${e.asset.sprite.name} (+${e.value})`);
      }
    }
  }

  // Flash fade
  if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 3);

  // Particle update
  updateParticles(dt);
}

// ══════════════════════════════════════════════════
// RENDERING
// ══════════════════════════════════════════════════
function drawAsset(asset, x, y, w, h, angleIdx, target) {
  target = target || ctx;
  if (!asset || !asset.angles || !asset.angles[angleIdx]) return;
  const frame = asset.angles[angleIdx % asset.angles.length];
  const imgData = target.createImageData(FORGE_SIZE, FORGE_SIZE);
  imgData.data.set(frame.pixels);

  // Draw to offscreen then scale
  const tmp = document.createElement('canvas');
  tmp.width = FORGE_SIZE; tmp.height = FORGE_SIZE;
  tmp.getContext('2d').putImageData(imgData, 0, 0);
  target.drawImage(tmp, x, y, w, h);
}

function drawForgePhase() {
  drawDitheredBg(ctx, W, H, '#000c1a', '#020e22');

  // Show current sprite being forged
  if (forgeIndex < sprites.length) {
    const sprite = sprites[forgeIndex];
    const imgData = ctx.createImageData(sprite.size, sprite.size);
    imgData.data.set(sprite.pixels);
    const tmp = document.createElement('canvas');
    tmp.width = sprite.size; tmp.height = sprite.size;
    tmp.getContext('2d').putImageData(imgData, 0, 0);

    // Original (left)
    ctx.drawImage(tmp, W/2 - 200, H/2 - 80, 120, 120);
    ctx.strokeStyle = 'rgba(0,255,157,0.3)';
    ctx.strokeRect(W/2 - 200, H/2 - 80, 120, 120);
    ctx.fillStyle = 'rgba(0,255,157,0.5)';
    ctx.font = '10px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('2D SOURCE', W/2 - 140, H/2 + 55);

    // Arrow
    ctx.fillStyle = 'var(--p)';
    ctx.font = '24px "Share Tech Mono"';
    ctx.fillText('→', W/2 - 20, H/2);

    // Forged angles (right)
    const fa = forgedAssets[forgeIndex];
    if (fa) {
      for (let i = 0; i < fa.angles.length; i++) {
        const ax = W/2 + 40 + (i % 4) * 70;
        const ay = H/2 - 80 + Math.floor(i / 4) * 70;
        drawAsset(fa, ax, ay, 60, 60, i);
        ctx.strokeStyle = 'rgba(0,255,157,0.15)';
        ctx.strokeRect(ax, ay, 60, 60);
      }
      ctx.fillStyle = 'rgba(0,255,157,0.5)';
      ctx.font = '10px "Share Tech Mono"';
      ctx.fillText('3D FORGED', W/2 + 180, H/2 + 55);
    }

    // Sprite name
    ctx.fillStyle = sprite.palette[0] ? `rgb(${sprite.palette[0].join(',')})` : '#fff';
    ctx.font = '14px "Orbitron"';
    ctx.fillText(sprite.name, W/2, H/2 - 110);
    ctx.fillStyle = 'var(--dim)';
    ctx.font = '9px "Share Tech Mono"';
    ctx.fillText(`ROLE: ${sprite.role.toUpperCase()} · SHAPE: ${sprite.shape.toUpperCase()}`, W/2, H/2 - 90);
  }

  // Progress bar
  const total = sprites.length * FORGE_ANGLES;
  const done = forgeIndex * FORGE_ANGLES + forgeAngle;
  const pct = done / total;
  ctx.fillStyle = 'rgba(0,255,157,0.06)';
  ctx.fillRect(W/2 - 200, H - 60, 400, 8);
  ctx.fillStyle = '#00ff9d';
  ctx.fillRect(W/2 - 200, H - 60, 400 * pct, 8);
}

function drawBuildPhase() {
  ctx.fillStyle = '#000c1a';
  ctx.fillRect(0, 0, W, H);

  // Show the world being assembled
  ctx.fillStyle = '#00ff9d';
  ctx.font = '12px "Share Tech Mono"';
  ctx.textAlign = 'center';
  ctx.fillText('ANALYZING FORGED ASSETS...', W/2, H/2 - 40);

  // Asset cards
  for (let i = 0; i < forgedAssets.length; i++) {
    const a = forgedAssets[i];
    const x = W/2 - (forgedAssets.length * 50)/2 + i * 50;
    const y = H/2;
    drawAsset(a, x, y, 40, 40, Math.floor(phaseTime * 3) % FORGE_ANGLES);
    ctx.fillStyle = a.sprite.role === 'player' ? '#00ff9d' :
                    a.sprite.role === 'enemy' ? '#ff2244' :
                    a.sprite.role === 'item' ? '#D4A844' : '#888';
    ctx.font = '7px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(a.sprite.role.toUpperCase(), x + 20, y + 48);
  }
}

function drawPlayPhase() {
  const g = gameWorld;
  const cam = g.camX;
  const pW = pixCanvas.width, pH = pixCanvas.height;

  // ── Draw everything to low-res pixCanvas first ──
  pixCtx.imageSmoothingEnabled = false;

  // Sky
  const skyGrad = pixCtx.createLinearGradient(0, 0, 0, pH);
  skyGrad.addColorStop(0, '#05080E');
  skyGrad.addColorStop(0.7, '#0A1628');
  skyGrad.addColorStop(1, '#0C0C12');
  pixCtx.fillStyle = skyGrad;
  pixCtx.fillRect(0, 0, pW, pH);

  // Stars (blinking — 8-bit style)
  for (let i = 0; i < 80; i++) {
    if (Math.sin(g.time * 2 + i * 1.7) <= 0.3) continue; // blink toggle
    const sx = ((SEEDS[i%SEEDS.length]*3+i*47-cam*0.1)%W+W)%W / PIX_SCALE;
    const sy = ((SEEDS[i%SEEDS.length]*7+i*31)%(H*0.6)) / PIX_SCALE;
    pixCtx.fillStyle = `rgba(200,220,255,${0.3+Math.sin(g.time+i)*0.2})`;
    pixCtx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
  }

  // Platforms
  for (const plat of g.platforms) {
    const px = (plat.x - cam) / PIX_SCALE, py = plat.y / PIX_SCALE;
    const pw = plat.w / PIX_SCALE, ph = plat.h / PIX_SCALE;
    if (px + pw < 0 || px > pW) continue;
    pixCtx.fillStyle = plat.color;
    pixCtx.fillRect(px, py, pw, ph);
    pixCtx.strokeStyle = 'rgba(0,255,210,0.1)';
    pixCtx.strokeRect(px, py, pw, ph);
  }

  // Props
  for (const e of g.entities) {
    if (e.type === 'prop') {
      const ex = (e.x - cam) / PIX_SCALE;
      if (ex + e.w/PIX_SCALE < -20 || ex > pW + 20) continue;
      drawAsset(e.asset, ex, (e.y - e.h) / PIX_SCALE, e.w / PIX_SCALE, e.h / PIX_SCALE, 0, pixCtx);
    }
  }

  // Items
  for (const e of g.entities) {
    if (e.type === 'item' && !e.collected) {
      const ex = (e.x - cam) / PIX_SCALE;
      if (ex < -20 || ex > pW + 20) continue;
      const bob = Math.sin(e.bob) * 4 / PIX_SCALE;

      // Glow
      pixCtx.save();
      pixCtx.globalAlpha = 0.3;
      pixCtx.fillStyle = `rgb(${e.asset.sprite.palette[0].join(',')})`;
      pixCtx.beginPath();
      pixCtx.arc(ex + e.w/2/PIX_SCALE, (e.y - e.h/2)/PIX_SCALE + bob, e.w/2/PIX_SCALE + 2, 0, Math.PI*2);
      pixCtx.fill();
      pixCtx.restore();

      drawAsset(e.asset, ex, (e.y - e.h)/PIX_SCALE + bob, e.w/PIX_SCALE, e.h/PIX_SCALE,
        Math.floor(g.time * 2) % FORGE_ANGLES, pixCtx);
    }
  }

  // Enemies
  for (const e of g.entities) {
    if (e.type === 'enemy' && e.alive) {
      const ex = (e.x - cam) / PIX_SCALE;
      if (ex < -20 || ex > pW + 20) continue;
      drawAsset(e.asset, ex, (e.y - e.h) / PIX_SCALE, e.w / PIX_SCALE, e.h / PIX_SCALE, e.facing, pixCtx);

      // HP bar
      pixCtx.fillStyle = 'rgba(255,0,0,0.4)';
      pixCtx.fillRect(ex, (e.y - e.h - 6) / PIX_SCALE, e.w / PIX_SCALE, 1);
      pixCtx.fillStyle = '#ff2244';
      pixCtx.fillRect(ex, (e.y - e.h - 6) / PIX_SCALE, (e.w / PIX_SCALE) * (e.hp / (Math.round(e.asset.sprite.complexity*3)+1)), 1);
    }
  }

  // Player
  const p = g.player;
  const ppx = (p.x - cam) / PIX_SCALE;

  // Attack visual
  if (p.attackTimer > 0.15) {
    const atkX = ppx + (p.facing === 2 ? p.w/PIX_SCALE : -7);
    pixCtx.save();
    pixCtx.globalAlpha = 0.5;
    pixCtx.strokeStyle = '#00ff9d';
    pixCtx.lineWidth = 1;
    pixCtx.beginPath(); pixCtx.arc(atkX + 3, p.y/PIX_SCALE + p.h/2/PIX_SCALE, 6, 0, Math.PI*2); pixCtx.stroke();
    pixCtx.restore();
  }

  drawAsset(p.asset, ppx, p.y / PIX_SCALE, p.w / PIX_SCALE, p.h / PIX_SCALE, p.facing, pixCtx);

  // Particles (draw at low res for chunky look)
  drawParticles(pixCtx, cam, PIX_SCALE);

  // ── Scale low-res canvas up to main canvas ──
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixCanvas, 0, 0, W, H);

  // ── Screen flash (drawn on main canvas at full res) ──
  if (p.flash > 0) {
    ctx.save();
    ctx.globalAlpha = p.flash * 0.35;
    ctx.fillStyle = p.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── CRT vignette ──
  drawCRTVignette(ctx, W, H);

  // ── HUD (drawn on main canvas at full res for readability) ──
  ctx.fillStyle = 'rgba(8,12,30,0.75)';
  ctx.fillRect(8, 8, 180, 50);
  ctx.strokeStyle = 'rgba(0,255,157,0.2)';
  ctx.strokeRect(8, 8, 180, 50);

  // HP bar
  ctx.fillStyle = 'rgba(255,0,0,0.2)';
  ctx.fillRect(16, 16, 160, 8);
  ctx.fillStyle = p.hp > 20 ? '#00ff9d' : '#ff2244';
  ctx.fillRect(16, 16, 160 * (p.hp / p.maxHp), 8);

  ctx.fillStyle = '#D4A844';
  ctx.font = 'bold 16px "Orbitron"';
  ctx.textAlign = 'left';
  ctx.fillText(`${p.score}`, 16, 44);
  ctx.fillStyle = 'rgba(0,255,157,0.4)';
  ctx.font = '9px "Share Tech Mono"';
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, 100, 44);

  // Controls hint
  if (g.time < 5) {
    ctx.globalAlpha = Math.max(0, 1 - g.time/5);
    ctx.fillStyle = '#00ff9d';
    ctx.font = '11px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('A/D MOVE · W/SPACE JUMP · J ATTACK', W/2, H - 30);
    ctx.globalAlpha = 1;
  }
}

// ══════════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════════
let lastT = 0;
function loop(t) {
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  phaseTime += dt;

  const statusEl = document.getElementById('status');
  const phaseEl = document.getElementById('phase');
  const counterEl = document.getElementById('counter');
  const labelEl = document.getElementById('phase-label');

  switch (phase) {
    case 'scan':
      ctx.fillStyle = '#000c1a'; ctx.fillRect(0, 0, W, H);
      if (phaseTime > 1 && sprites.length === 0) {
        generateSprites();
        log(`SCANNED: ${sprites.length} sprite types detected`);
        sprites.forEach(s => log(`  → ${s.name} (${s.role}, ${s.shape})`));
      }
      if (phaseTime > 3) {
        phase = 'forge'; phaseTime = 0;
        labelEl.textContent = 'FORGING 3D ASSETS';
        log('PHASE 2: FORGING sprites into 3D...');
      }
      statusEl.textContent = 'SCANNING SPRITES';
      phaseEl.textContent = 'SCAN';
      counterEl.textContent = `${sprites.length} TYPES`;
      labelEl.style.opacity = phaseTime < 2.5 ? '1' : '0';
      break;

    case 'forge':
      // Process multiple frames per tick for speed
      for (let i = 0; i < 4; i++) {
        if (forgeOneFrame()) {
          // Check if crossbreeds need forging too
          if (crossbreeds.length === 0) {
            // First time — go to crossbreed phase
            phase = 'crossbreed'; phaseTime = 0;
            labelEl.textContent = 'CROSSBREEDING';
            labelEl.style.opacity = '1';
            log(`FORGED: ${forgedAssets.length} base assets × ${FORGE_ANGLES} angles`);
            log('PHASE 2.5: CROSSBREEDING assets...');
            generateCrossbreeds();
          } else {
            // Crossbreeds already forged — go to build
            phase = 'build'; phaseTime = 0;
            labelEl.textContent = 'BUILDING WORLD';
            labelEl.style.opacity = '1';
            log(`FORGED: ${forgedAssets.length} total assets (${crossbreeds.length} hybrids)`);
            log('PHASE 3: BUILDING game world from all asset data...');
          }
          break;
        }
      }
      drawForgePhase();
      statusEl.textContent = `FORGING: ${sprites[Math.min(forgeIndex, sprites.length-1)]?.name || ''}`;
      phaseEl.textContent = 'FORGE';
      counterEl.textContent = `${forgeIndex * FORGE_ANGLES + forgeAngle} / ${sprites.length * FORGE_ANGLES}`;
      labelEl.style.opacity = '0';
      break;

    case 'crossbreed':
      drawCrossbreedPhase();
      crossbreedIndex = Math.min(crossbreedIndex + 1, crossbreeds.length);
      if (phaseTime > 4) {
        // Now forge the crossbreed sprites too
        phase = 'forge'; phaseTime = 0;
        labelEl.textContent = 'FORGING HYBRIDS';
        labelEl.style.opacity = '1';
        log('RE-ENTERING FORGE: rendering crossbreed offspring in 3D...');
        setTimeout(() => labelEl.style.opacity = '0', 1500);
      }
      statusEl.textContent = `BREEDING: ${crossbreedIndex}/${crossbreeds.length}`;
      phaseEl.textContent = 'CROSSBREED';
      counterEl.textContent = `${crossbreeds.length} HYBRIDS`;
      labelEl.style.opacity = phaseTime < 1.5 ? '1' : '0';
      break;

    case 'build':
      drawBuildPhase();
      if (phaseTime > 2) {
        buildGame();
        phase = 'play'; phaseTime = 0;
        labelEl.textContent = 'PLAY';
        labelEl.style.opacity = '1';
        setTimeout(() => labelEl.style.opacity = '0', 1500);
        log('PHASE 4: GAME GENERATED — PLAY!');
        log(`Controls: A/D move, W/Space jump, J attack`);
      }
      statusEl.textContent = 'ASSEMBLING WORLD';
      phaseEl.textContent = 'BUILD';
      counterEl.textContent = `${forgedAssets.length} ASSETS`;
      break;

    case 'play':
      updateGame(dt);
      drawPlayPhase();
      statusEl.textContent = `PLAYING · ${gameWorld.entities.filter(e=>e.type==='enemy'&&e.alive).length} ENEMIES`;
      phaseEl.textContent = 'PLAY';
      counterEl.textContent = gameWorld.player.score;
      labelEl.style.opacity = '0';
      break;
  }

  // Scanlines over every phase
  drawScanlines(ctx, W, H);

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
  wn.textContent = 'THE BLOCK';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.7240667744667675;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.016723940099592317;mix-blend-mode:overlay';
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