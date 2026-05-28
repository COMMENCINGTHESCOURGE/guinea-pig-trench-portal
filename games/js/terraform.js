// ============================================================
// TERRAFORM — Isometric Ecosystem Simulation
// Guinea Pig Trench Portal
// ============================================================

const canvas = document.getElementById('C');
const ctx = canvas.getContext('2d');

// --- Constants ---
const GRID = 20;
const TILE_W = 64;
const TILE_H = 32;
const MAX_ELEV = 3;
const ELEV_H = 12;

// Terrain stages
const BARREN=0, WATER=1, MUD=2, GRASS=3, PLANTS=4, TREES=5, ECOSYSTEM=6, CIVILIZED=7;
const STAGE_NAMES = ['Barren','Water','Mud','Grass','Plants','Trees','Ecosystem','Civilized'];
const STAGE_COLORS = [
  ['#5a5044','#6b6054','#4a4034'], // barren
  ['#2266aa','#3388cc','#1155aa'], // water
  ['#5a3a1a','#6b4a2a','#4a2a0a'], // mud
  ['#3a8a3a','#4a9a4a','#2a7a2a'], // grass
  ['#2a6a2a','#3a7a3a','#1a5a1a'], // plants
  ['#1a5a1a','#2a6a2a','#0a4a0a'], // trees
  ['#2a8a3a','#3aaa4a','#1a7a2a'], // ecosystem
  ['#4a6a5a','#5a7a6a','#3a5a4a'], // civilized
];

// Tools
const TOOL_WATER=0, TOOL_IRRIGATE=1, TOOL_SEED=2, TOOL_HARVEST=3, TOOL_BUILD=4, TOOL_TERRAFORM=5, TOOL_INSPECT=6;
const TOOL_NAMES = ['Water Source','Irrigation','Seed Bomb','Harvest','Build','Terraform','Inspect'];
const TOOL_KEYS = ['1','2','3','4','5','6','7'];
const TOOL_ICONS = ['💧','🔵','🌱','⛏️','🏗️','⛰️','🔍'];

// Buildings
const BLDG_HUT=0, BLDG_FARM=1, BLDG_WORKSHOP=2, BLDG_TEMPLE=3, BLDG_EXTRACTOR=4;
const BUILDINGS = [
  {name:'Hut', wood:50, stone:30, energy:0, desc:'Generates 1 pop', icon:'🛖'},
  {name:'Farm', wood:30, stone:20, energy:0, desc:'2x food nearby', icon:'🌾'},
  {name:'Workshop', wood:80, stone:50, energy:0, desc:'Advanced tools', icon:'🔨'},
  {name:'Temple', wood:50, stone:100, energy:20, desc:'Boosts growth', icon:'⛩️'},
  {name:'Core Extractor', wood:0, stone:60, energy:30, desc:'Harvests energy', icon:'⚡'},
];

// --- Game State ---
const STATE_TITLE=0, STATE_MODE=1, STATE_GAME=2, STATE_STATS=3;
let gameState = STATE_TITLE;
let sandboxMode = false;

// Resources
let res = {water:20, stone:50, wood:20, herbs:10, food:20, energy:5};
let population = 0;
let day = 1;

// Camera
let camX = 0, camY = 0;
let zoom = 1;
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2];
let zoomIdx = 2;

// Time
let simSpeed = 1;
const SPEEDS = [1,2,5,10];
let speedIdx = 0;
let tickTimer = 0;
const TICK_MS = 500;
let totalTicks = 0;

// Tool
let currentTool = TOOL_INSPECT;
let selectedBuilding = 0;
let terraformRaise = true;

// Day/night
let dayNightPhase = 0;

// Input
let keys = {};
let mouseX=0, mouseY=0, mouseDown=false;
let hoveredTile = null;
let inspectedTile = null;
let showStats = false;

// Notifications
let notifications = [];

// Particles
let particles = [];

// World grid
let world = [];

// Title animation
let titleAngle = 0;
let titleTime = 0;

// Win state
let winLevel = 0; // 0=none,1=bronze,2=silver,3=gold

// --- Tile Class ---
function makeTile(gx, gy) {
  return {
    gx, gy,
    stage: BARREN,
    elevation: Math.floor(Math.random()*2),
    tickCounter: 0,
    moisture: 0,
    isSpring: false,
    isChannel: false,
    isCrystal: Math.random()<0.03,
    building: -1,
    treeSize: 0, // 0-3
    growthBoost: 0,
    resources: {water:0,stone:2,wood:0,herbs:0,food:0,energy:0},
    animals: [],
    harvestCooldown: 0,
  };
}

function initWorld() {
  world = [];
  for (let y=0; y<GRID; y++) {
    world[y] = [];
    for (let x=0; x<GRID; x++) {
      world[y][x] = makeTile(x, y);
    }
  }
  // Create some elevation variety
  for (let i=0; i<8; i++) {
    let cx = Math.floor(Math.random()*GRID);
    let cy = Math.floor(Math.random()*GRID);
    let r = 2+Math.floor(Math.random()*3);
    let h = 1+Math.floor(Math.random()*MAX_ELEV);
    for (let dy=-r; dy<=r; dy++) {
      for (let dx=-r; dx<=r; dx++) {
        let nx=cx+dx, ny=cy+dy;
        if (nx>=0&&nx<GRID&&ny>=0&&ny<GRID && dx*dx+dy*dy<=r*r) {
          world[ny][nx].elevation = Math.min(MAX_ELEV, world[ny][nx].elevation + h);
        }
      }
    }
  }
  // Valleys
  for (let i=0; i<4; i++) {
    let cx = Math.floor(Math.random()*GRID);
    let cy = Math.floor(Math.random()*GRID);
    let r = 2+Math.floor(Math.random()*2);
    for (let dy=-r; dy<=r; dy++) {
      for (let dx=-r; dx<=r; dx++) {
        let nx=cx+dx, ny=cy+dy;
        if (nx>=0&&nx<GRID&&ny>=0&&ny<GRID && dx*dx+dy*dy<=r*r) {
          world[ny][nx].elevation = 0;
        }
      }
    }
  }

  // Place a few crystal nodes
  let crystalCount = 0;
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    if (world[y][x].isCrystal) {
      world[y][x].resources.energy = 10;
      crystalCount++;
    }
  }
  if (crystalCount===0) {
    let cx=Math.floor(Math.random()*GRID), cy=Math.floor(Math.random()*GRID);
    world[cy][cx].isCrystal = true;
    world[cy][cx].resources.energy = 10;
  }

  // Reset everything
  res = {water:20, stone:50, wood:20, herbs:10, food:20, energy:5};
  population = 0;
  day = 1;
  totalTicks = 0;
  winLevel = 0;
  notifications = [];
  particles = [];
  inspectedTile = null;

  // Center camera
  camX = -canvas.width/2 + GRID*TILE_W/2;
  camY = -canvas.height/2 + GRID*TILE_H/2 + 50;
}

// --- Isometric Math ---
function isoProject(gx, gy, elev) {
  let x = (gx - gy) * (TILE_W/2);
  let y = (gx + gy) * (TILE_H/2);
  y -= elev * ELEV_H;
  return {x, y};
}

function screenToWorld(sx, sy) {
  // Reverse iso projection
  let wx = (sx + camX) / zoom;
  let wy = (sy + camY) / zoom;

  // Try each tile, pick the one we're hovering (check top-down by render order reversed)
  let best = null;
  let bestDist = Infinity;
  for (let gy=GRID-1; gy>=0; gy--) {
    for (let gx=GRID-1; gx>=0; gx--) {
      let t = world[gy][gx];
      let p = isoProject(gx, gy, t.elevation);
      // Check if point is inside diamond
      let dx = wx - p.x;
      let dy = wy - p.y;
      // Diamond hit test
      if (Math.abs(dx)/(TILE_W/2) + Math.abs(dy)/(TILE_H/2) <= 1) {
        let depth = gx + gy;
        if (best===null || depth > best.depth || (depth===best.depth && t.elevation > best.elev)) {
          best = {gx, gy, depth, elev: t.elevation};
        }
      }
    }
  }
  return best ? {gx: best.gx, gy: best.gy} : null;
}

function worldToScreen(gx, gy, elev) {
  let p = isoProject(gx, gy, elev||0);
  return {
    x: p.x * zoom - camX,
    y: p.y * zoom - camY
  };
}

// --- Neighbors ---
function getNeighbors(gx, gy) {
  let n = [];
  if (gx>0) n.push(world[gy][gx-1]);
  if (gx<GRID-1) n.push(world[gy][gx+1]);
  if (gy>0) n.push(world[gy-1][gx]);
  if (gy<GRID-1) n.push(world[gy+1][gx]);
  return n;
}

// --- Notifications ---
function notify(msg) {
  notifications.push({msg, timer:180});
  if (notifications.length>5) notifications.shift();
}

// --- Particles ---
function spawnParticles(sx, sy, color, count, type) {
  for (let i=0; i<count; i++) {
    particles.push({
      x: sx + (Math.random()-0.5)*30,
      y: sy + (Math.random()-0.5)*20,
      vx: (Math.random()-0.5)*2,
      vy: -Math.random()*3 - 1,
      life: 30+Math.random()*30,
      maxLife: 60,
      color: color,
      size: 2+Math.random()*3,
      type: type||'dot'
    });
  }
}

// --- Simulation ---
function simTick() {
  totalTicks++;
  if (totalTicks % 48 === 0) day++;
  dayNightPhase = (totalTicks % 480) / 480;

  // Water flow
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    let t = world[y][x];
    if (t.isSpring && t.stage !== WATER) {
      t.stage = WATER;
      t.moisture = 10;
      t.resources.water = 5;
    }
    if (t.stage === WATER || t.isChannel) {
      t.moisture = Math.max(t.moisture, 5);
      // Flow to lower/equal neighbors
      let neighbors = getNeighbors(x, y);
      for (let nb of neighbors) {
        if (nb.elevation <= t.elevation && t.moisture > 1) {
          if (nb.stage === BARREN && !nb.isChannel) {
            nb.moisture += 1;
            if (nb.moisture >= 3) {
              nb.stage = MUD;
              nb.tickCounter = 0;
            }
          }
          if (nb.isChannel && nb.stage !== WATER) {
            nb.stage = WATER;
            nb.moisture = 5;
            nb.resources.water = 3;
          }
          if (nb.elevation < t.elevation && nb.stage === BARREN) {
            if (nb.moisture >= 5) {
              nb.stage = WATER;
              nb.moisture = 8;
              nb.resources.water = 3;
            }
          }
        }
      }
    }
  }

  // Growth transitions
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    let t = world[y][x];
    let boost = 1 + t.growthBoost;

    // Check temple boost
    for (let dy=-3; dy<=3; dy++) for (let dx=-3; dx<=3; dx++) {
      let nx=x+dx, ny=y+dy;
      if (nx>=0&&nx<GRID&&ny>=0&&ny<GRID) {
        if (world[ny][nx].building === BLDG_TEMPLE) boost += 0.5;
      }
    }

    if (t.stage === MUD) {
      t.tickCounter += boost;
      if (t.tickCounter >= 5) {
        t.stage = GRASS;
        t.tickCounter = 0;
        t.resources.herbs = 1;
      }
    } else if (t.stage === GRASS) {
      t.tickCounter += boost;
      if (t.tickCounter >= 8) {
        t.stage = PLANTS;
        t.tickCounter = 0;
        t.resources.herbs = 3;
      }
    } else if (t.stage === PLANTS) {
      t.tickCounter += boost;
      if (t.tickCounter >= 15) {
        t.stage = TREES;
        t.treeSize = 1;
        t.tickCounter = 0;
        t.resources.wood = 5;
      }
    } else if (t.stage === TREES) {
      t.tickCounter += boost;
      if (t.treeSize < 3 && t.tickCounter >= 10) {
        t.treeSize++;
        t.tickCounter = 0;
        t.resources.wood = t.treeSize * 5;
      }
      // Check for ecosystem
      let neighbors = getNeighbors(x, y);
      let treeCount = 0, hasWater = false, hasGrass = false;
      for (let nb of neighbors) {
        if (nb.stage >= TREES) treeCount++;
        if (nb.stage === WATER) hasWater = true;
        if (nb.stage >= GRASS) hasGrass = true;
      }
      // Also check self surroundings in wider area
      for (let dy=-2; dy<=2; dy++) for (let dx=-2; dx<=2; dx++) {
        let nx=x+dx, ny=y+dy;
        if (nx>=0&&nx<GRID&&ny>=0&&ny<GRID) {
          if (world[ny][nx].stage >= TREES) treeCount++;
          if (world[ny][nx].stage === WATER) hasWater = true;
        }
      }
      if (treeCount >= 3 && hasWater && hasGrass) {
        t.stage = ECOSYSTEM;
        t.resources.food = 5;
        t.tickCounter = 0;
      }
    } else if (t.stage === ECOSYSTEM) {
      // Spawn animal dots
      if (t.animals.length < 3 && Math.random() < 0.02) {
        t.animals.push({
          ox: (Math.random()-0.5)*TILE_W*0.6,
          oy: (Math.random()-0.5)*TILE_H*0.6,
          phase: Math.random()*Math.PI*2
        });
      }
      // Regen resources
      if (t.harvestCooldown > 0) t.harvestCooldown--;
      else {
        t.resources.food = Math.min(10, t.resources.food + 0.1);
        t.resources.herbs = Math.min(5, t.resources.herbs + 0.05);
      }
    }

    // Crystal regen
    if (t.isCrystal) {
      t.resources.energy = Math.min(10, t.resources.energy + 0.1);
    }

    // Harvest cooldown
    if (t.harvestCooldown > 0) t.harvestCooldown--;

    // Resource regen for mature tiles
    if (t.stage === WATER) t.resources.water = Math.min(5, t.resources.water + 0.2);
    if (t.stage >= GRASS) t.resources.herbs = Math.min(3, t.resources.herbs + 0.02);
    if (t.stage >= TREES) t.resources.wood = Math.min(t.treeSize*5, t.resources.wood + 0.05);

    // Farm bonus
    if (t.building === BLDG_FARM) {
      let neighbors2 = getNeighbors(x, y);
      for (let nb of neighbors2) {
        nb.resources.food = Math.min(10, nb.resources.food + 0.05);
      }
    }

    // Core extractor
    if (t.building === BLDG_EXTRACTOR && t.isCrystal) {
      res.energy += 0.05;
    }
  }

  // Population food consumption
  if (population > 0) {
    let foodNeeded = population * 0.1;
    if (res.food >= foodNeeded) {
      res.food -= foodNeeded;
    } else {
      // Starvation
      if (Math.random() < 0.01) {
        population = Math.max(0, population - 1);
        notify('A citizen starved!');
      }
    }
  }

  // Random events
  if (Math.random() < 0.002) {
    // Seed rain
    let rx = Math.floor(Math.random()*GRID);
    let ry = Math.floor(Math.random()*GRID);
    if (world[ry][rx].stage === MUD || world[ry][rx].stage === BARREN) {
      if (world[ry][rx].stage === BARREN) world[ry][rx].stage = MUD;
      world[ry][rx].tickCounter += 3;
      notify('Seed rain on tile ('+rx+','+ry+')!');
    }
  }
  if (Math.random() < 0.001) {
    // Meteor
    let rx = Math.floor(Math.random()*GRID);
    let ry = Math.floor(Math.random()*GRID);
    world[ry][rx].stage = BARREN;
    world[ry][rx].elevation = Math.max(0, world[ry][rx].elevation - 1);
    world[ry][rx].resources.stone += 10;
    world[ry][rx].building = -1;
    notify('Meteor strike at ('+rx+','+ry+')! +Stone');
    let sp = worldToScreen(rx, ry, world[ry][rx].elevation);
    spawnParticles(sp.x, sp.y, '#ff8833', 20, 'spark');
  }
  if (Math.random() < 0.0008) {
    // Core emergence
    let rx = Math.floor(Math.random()*GRID);
    let ry = Math.floor(Math.random()*GRID);
    if (!world[ry][rx].isCrystal) {
      world[ry][rx].isCrystal = true;
      world[ry][rx].resources.energy = 8;
      notify('Energy crystal emerged at ('+rx+','+ry+')!');
    }
  }
  if (Math.random() < 0.001 && totalTicks > 100) {
    // Drought
    let rx = Math.floor(Math.random()*GRID);
    let ry = Math.floor(Math.random()*GRID);
    if (world[ry][rx].stage === WATER && !world[ry][rx].isSpring) {
      world[ry][rx].stage = MUD;
      world[ry][rx].moisture = 1;
      notify('Drought dried tile ('+rx+','+ry+')');
    }
  }

  // Win check
  if (!sandboxMode) {
    if (population >= 50 && winLevel < 3) { winLevel = 3; notify('GOLD MEDAL! Population 50!'); }
    else if (population >= 25 && winLevel < 2) { winLevel = 2; notify('SILVER MEDAL! Population 25!'); }
    else if (population >= 10 && winLevel < 1) { winLevel = 1; notify('BRONZE MEDAL! Population 10!'); }
  }
}

// --- Tool Actions ---
function useTool(gx, gy) {
  if (gx<0||gx>=GRID||gy<0||gy>=GRID) return;
  let t = world[gy][gx];
  let sp = worldToScreen(gx, gy, t.elevation);

  switch(currentTool) {
    case TOOL_WATER:
      if (res.stone >= 10) {
        res.stone -= 10;
        t.isSpring = true;
        t.stage = WATER;
        t.moisture = 10;
        t.resources.water = 5;
        spawnParticles(sp.x, sp.y, '#44aaff', 12, 'drop');
        notify('Spring placed at ('+gx+','+gy+')');
      } else notify('Need 10 stone!');
      break;

    case TOOL_IRRIGATE:
      if (res.stone >= 5) {
        res.stone -= 5;
        t.isChannel = true;
        spawnParticles(sp.x, sp.y, '#4488cc', 6);
        notify('Channel at ('+gx+','+gy+')');
      } else notify('Need 5 stone!');
      break;

    case TOOL_SEED:
      if (res.herbs >= 5) {
        if (t.stage === MUD || t.stage === GRASS) {
          res.herbs -= 5;
          t.tickCounter += 10;
          t.growthBoost = 2;
          spawnParticles(sp.x, sp.y, '#88cc44', 10, 'leaf');
          notify('Seed bomb on ('+gx+','+gy+')');
        } else notify('Needs mud or grass!');
      } else notify('Need 5 herbs!');
      break;

    case TOOL_HARVEST:
      if (t.harvestCooldown > 0) { notify('Recently harvested'); break; }
      let harvested = false;
      for (let r in t.resources) {
        let amt = Math.floor(t.resources[r]);
        if (amt > 0) {
          res[r] += amt;
          t.resources[r] -= amt;
          harvested = true;
        }
      }
      if (t.stage === TREES && t.resources.wood <= 0) {
        // Harvesting a tree removes it
        t.stage = GRASS;
        t.treeSize = 0;
        t.tickCounter = 0;
        res.wood += 3;
      }
      if (harvested) {
        t.harvestCooldown = 5;
        spawnParticles(sp.x, sp.y, '#ffcc44', 8);
        notify('Harvested ('+gx+','+gy+')');
      } else notify('Nothing to harvest');
      break;

    case TOOL_BUILD:
      if (t.stage < GRASS) { notify('Need grass or better!'); break; }
      if (t.building >= 0) { notify('Already has building!'); break; }
      let b = BUILDINGS[selectedBuilding];
      if (res.wood >= b.wood && res.stone >= b.stone && res.energy >= b.energy) {
        res.wood -= b.wood;
        res.stone -= b.stone;
        res.energy -= b.energy;
        t.building = selectedBuilding;
        if (selectedBuilding === BLDG_HUT) population++;
        t.stage = CIVILIZED;
        spawnParticles(sp.x, sp.y, '#ffdd88', 15);
        notify('Built ' + b.name);
      } else notify('Not enough resources!');
      break;

    case TOOL_TERRAFORM:
      if (res.stone >= 20) {
        if (terraformRaise) {
          if (t.elevation < MAX_ELEV) {
            t.elevation++;
            res.stone -= 20;
            notify('Raised ('+gx+','+gy+') to '+t.elevation);
          }
        } else {
          if (t.elevation > 0) {
            t.elevation--;
            res.stone -= 20;
            notify('Lowered ('+gx+','+gy+') to '+t.elevation);
          }
        }
      } else notify('Need 20 stone!');
      break;

    case TOOL_INSPECT:
      inspectedTile = t;
      break;
  }
}

// --- Drawing ---
function drawDiamond(cx, cy, w, h, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h/2);
  ctx.lineTo(cx + w/2, cy);
  ctx.lineTo(cx, cy + h/2);
  ctx.lineTo(cx - w/2, cy);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function drawTileSide(cx, cy, w, h, elevH, side, color) {
  ctx.beginPath();
  if (side === 'left') {
    ctx.moveTo(cx - w/2, cy);
    ctx.lineTo(cx, cy + h/2);
    ctx.lineTo(cx, cy + h/2 + elevH);
    ctx.lineTo(cx - w/2, cy + elevH);
  } else {
    ctx.moveTo(cx + w/2, cy);
    ctx.lineTo(cx, cy + h/2);
    ctx.lineTo(cx, cy + h/2 + elevH);
    ctx.lineTo(cx + w/2, cy + elevH);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function getTerrainColor(t, idx) {
  let c = STAGE_COLORS[t.stage][idx||0];
  // Day/night tint
  let nightFactor = Math.sin(dayNightPhase * Math.PI * 2);
  if (nightFactor < 0) {
    // Night: darken
    let amt = Math.abs(nightFactor) * 0.3;
    return blendColor(c, '#000020', amt);
  }
  return c;
}

function blendColor(c1, c2, t) {
  let r1=parseInt(c1.slice(1,3),16), g1=parseInt(c1.slice(3,5),16), b1=parseInt(c1.slice(5,7),16);
  let r2=parseInt(c2.slice(1,3),16), g2=parseInt(c2.slice(3,5),16), b2=parseInt(c2.slice(5,7),16);
  let r=Math.round(r1+(r2-r1)*t), g=Math.round(g1+(g2-g1)*t), b=Math.round(b1+(b2-b1)*t);
  return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
}

function drawTile(t, sx, sy) {
  let w = TILE_W * zoom;
  let h = TILE_H * zoom;
  let eH = ELEV_H * zoom;
  let topColor = getTerrainColor(t, 0);
  let leftColor = getTerrainColor(t, 1);
  let rightColor = getTerrainColor(t, 2);

  // Elevation sides
  if (t.elevation > 0) {
    drawTileSide(sx, sy, w, h, eH, 'left', blendColor(leftColor, '#000000', 0.3));
    drawTileSide(sx, sy, w, h, eH, 'right', blendColor(rightColor, '#000000', 0.15));
  }

  // Top face
  drawDiamond(sx, sy, w, h, topColor, 'rgba(0,0,0,0.15)');

  // Water animation
  if (t.stage === WATER) {
    let ripple = Math.sin(totalTicks*0.15 + t.gx*0.5 + t.gy*0.3) * 0.3 + 0.5;
    ctx.globalAlpha = ripple * 0.3;
    drawDiamond(sx, sy, w*0.6, h*0.6, '#88ccff');
    ctx.globalAlpha = 1;
    // Small highlight dots
    ctx.fillStyle = 'rgba(200,230,255,0.4)';
    let rx = Math.sin(totalTicks*0.1+t.gx)*w*0.15;
    let ry = Math.cos(totalTicks*0.12+t.gy)*h*0.15;
    ctx.fillRect(sx+rx-1, sy+ry-1, 2, 2);
  }

  // Channel marker
  if (t.isChannel && t.stage !== WATER) {
    ctx.strokeStyle = '#4488cc';
    ctx.lineWidth = 2*zoom;
    ctx.setLineDash([3,3]);
    drawDiamond(sx, sy, w*0.7, h*0.7, null, '#4488cc');
    ctx.setLineDash([]);
  }

  // Barren texture (crosshatch)
  if (t.stage === BARREN) {
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    for (let i=-2; i<=2; i++) {
      ctx.beginPath();
      ctx.moveTo(sx+i*w*0.12, sy-h*0.3);
      ctx.lineTo(sx+i*w*0.12+w*0.1, sy+h*0.3);
      ctx.stroke();
    }
  }

  // Mud wet sheen
  if (t.stage === MUD) {
    let sheen = Math.sin(totalTicks*0.05+t.gx+t.gy)*0.15+0.15;
    ctx.globalAlpha = sheen;
    drawDiamond(sx, sy, w*0.8, h*0.8, '#7799aa');
    ctx.globalAlpha = 1;
  }

  // Grass blades
  if (t.stage >= GRASS && t.stage !== WATER) {
    ctx.strokeStyle = '#5ab55a';
    ctx.lineWidth = 1;
    for (let i=0; i<4; i++) {
      let bx = sx + (Math.sin(i*2.5+t.gx)*0.3)*w*0.3;
      let by = sy + (Math.cos(i*1.7+t.gy)*0.3)*h*0.3;
      let sway = Math.sin(totalTicks*0.03+i+t.gx)*2*zoom;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx+sway, by-5*zoom);
      ctx.stroke();
    }
  }

  // Plants (bushes)
  if (t.stage === PLANTS) {
    let bushSize = 4*zoom;
    ctx.fillStyle = '#2a7a2a';
    for (let i=0; i<3; i++) {
      let bx = sx + (Math.sin(i*3+t.gx)*0.25)*w;
      let by = sy + (Math.cos(i*2+t.gy)*0.2)*h;
      ctx.beginPath();
      ctx.arc(bx, by-bushSize, bushSize, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = '#3a9a3a';
    for (let i=0; i<2; i++) {
      let bx = sx + (Math.sin(i*4+t.gy)*0.15)*w;
      let by = sy + (Math.cos(i*3+t.gx)*0.15)*h;
      ctx.beginPath();
      ctx.arc(bx, by-bushSize*0.7, bushSize*0.7, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Trees
  if (t.stage >= TREES && t.building < 0) {
    let ts = (t.treeSize || 1);
    let trunkH = (6 + ts*4) * zoom;
    let canopyR = (4 + ts*3) * zoom;
    // Trunk
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(sx - 1.5*zoom, sy - trunkH, 3*zoom, trunkH);
    // Canopy
    ctx.fillStyle = t.stage === ECOSYSTEM ? '#2aaa3a' : '#1a7a2a';
    ctx.beginPath();
    ctx.arc(sx, sy - trunkH, canopyR, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = t.stage === ECOSYSTEM ? '#3abb4a' : '#2a8a3a';
    ctx.beginPath();
    ctx.arc(sx-canopyR*0.3, sy - trunkH - canopyR*0.2, canopyR*0.6, 0, Math.PI*2);
    ctx.fill();
  }

  // Ecosystem animals
  if (t.stage === ECOSYSTEM) {
    for (let a of t.animals) {
      a.phase += 0.03;
      let ax = sx + a.ox*zoom*0.5 + Math.sin(a.phase)*5*zoom;
      let ay = sy + a.oy*zoom*0.5 + Math.cos(a.phase*0.7)*3*zoom;
      ctx.fillStyle = '#aa8855';
      ctx.fillRect(ax-2*zoom, ay-2*zoom, 4*zoom, 3*zoom);
      // Head
      ctx.fillStyle = '#996644';
      ctx.fillRect(ax+1*zoom, ay-3*zoom, 2*zoom, 2*zoom);
    }
  }

  // Crystal
  if (t.isCrystal) {
    let glow = Math.sin(totalTicks*0.1+t.gx+t.gy)*0.3+0.7;
    ctx.globalAlpha = glow;
    let cSize = 5*zoom;
    // Diamond crystal shape
    ctx.fillStyle = '#aa44ff';
    ctx.beginPath();
    ctx.moveTo(sx, sy - cSize*2);
    ctx.lineTo(sx + cSize, sy - cSize*0.5);
    ctx.lineTo(sx, sy);
    ctx.lineTo(sx - cSize, sy - cSize*0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cc66ff';
    ctx.beginPath();
    ctx.moveTo(sx, sy - cSize*2);
    ctx.lineTo(sx + cSize*0.5, sy - cSize);
    ctx.lineTo(sx, sy);
    ctx.closePath();
    ctx.fill();
    // Sparkle
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = glow * 0.5;
    ctx.fillRect(sx-1, sy-cSize*1.5-1, 2, 2);
    ctx.globalAlpha = 1;
  }

  // Spring marker
  if (t.isSpring) {
    ctx.fillStyle = 'rgba(100,180,255,0.5)';
    ctx.beginPath();
    let bubbleY = sy - 8*zoom + Math.sin(totalTicks*0.2)*3*zoom;
    ctx.arc(sx, bubbleY, 3*zoom, 0, Math.PI*2);
    ctx.fill();
  }

  // Building
  if (t.building >= 0) {
    drawBuilding(t.building, sx, sy, w, h);
  }

  // Hover highlight
  if (hoveredTile && hoveredTile.gx === t.gx && hoveredTile.gy === t.gy) {
    ctx.globalAlpha = 0.25;
    drawDiamond(sx, sy, w, h, '#ffffff');
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    drawDiamond(sx, sy, w, h, null, '#ffffff');
  }
}

function drawBuilding(type, sx, sy, w, h) {
  let z = zoom;
  switch(type) {
    case BLDG_HUT:
      // Simple hut: box + triangle roof
      ctx.fillStyle = '#8b6b4b';
      ctx.fillRect(sx-8*z, sy-16*z, 16*z, 12*z);
      ctx.fillStyle = '#aa4444';
      ctx.beginPath();
      ctx.moveTo(sx-10*z, sy-16*z);
      ctx.lineTo(sx, sy-26*z);
      ctx.lineTo(sx+10*z, sy-16*z);
      ctx.closePath();
      ctx.fill();
      // Door
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(sx-2*z, sy-8*z, 4*z, 4*z);
      break;
    case BLDG_FARM:
      // Fence + rows
      ctx.strokeStyle = '#8b6b3b';
      ctx.lineWidth = 1.5*z;
      ctx.strokeRect(sx-10*z, sy-6*z, 20*z, 10*z);
      ctx.strokeStyle = '#5a8a3a';
      ctx.lineWidth = 1*z;
      for (let i=-1; i<=1; i++) {
        ctx.beginPath();
        ctx.moveTo(sx-8*z, sy+i*3*z);
        ctx.lineTo(sx+8*z, sy+i*3*z);
        ctx.stroke();
      }
      break;
    case BLDG_WORKSHOP:
      ctx.fillStyle = '#6a5a4a';
      ctx.fillRect(sx-10*z, sy-18*z, 20*z, 14*z);
      ctx.fillStyle = '#555555';
      ctx.beginPath();
      ctx.moveTo(sx-12*z, sy-18*z);
      ctx.lineTo(sx, sy-28*z);
      ctx.lineTo(sx+12*z, sy-18*z);
      ctx.closePath();
      ctx.fill();
      // Chimney
      ctx.fillStyle = '#444444';
      ctx.fillRect(sx+4*z, sy-30*z, 4*z, 8*z);
      // Smoke
      ctx.fillStyle = 'rgba(150,150,150,0.4)';
      let smokeY = Math.sin(totalTicks*0.1)*3*z;
      ctx.beginPath();
      ctx.arc(sx+6*z, sy-34*z+smokeY, 3*z, 0, Math.PI*2);
      ctx.fill();
      break;
    case BLDG_TEMPLE:
      ctx.fillStyle = '#c8b888';
      // Pillars
      ctx.fillRect(sx-10*z, sy-22*z, 3*z, 18*z);
      ctx.fillRect(sx+7*z, sy-22*z, 3*z, 18*z);
      // Roof
      ctx.fillStyle = '#daca98';
      ctx.beginPath();
      ctx.moveTo(sx-14*z, sy-22*z);
      ctx.lineTo(sx, sy-32*z);
      ctx.lineTo(sx+14*z, sy-22*z);
      ctx.closePath();
      ctx.fill();
      // Glow
      let tGlow = Math.sin(totalTicks*0.08)*0.2+0.3;
      ctx.globalAlpha = tGlow;
      ctx.fillStyle = '#ffdd66';
      ctx.beginPath();
      ctx.arc(sx, sy-18*z, 5*z, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case BLDG_EXTRACTOR:
      ctx.fillStyle = '#666688';
      ctx.fillRect(sx-6*z, sy-20*z, 12*z, 16*z);
      // Antenna
      ctx.strokeStyle = '#8888aa';
      ctx.lineWidth = 2*z;
      ctx.beginPath();
      ctx.moveTo(sx, sy-20*z);
      ctx.lineTo(sx, sy-30*z);
      ctx.stroke();
      // Energy glow
      let eGlow = Math.sin(totalTicks*0.15)*0.3+0.5;
      ctx.globalAlpha = eGlow;
      ctx.fillStyle = '#aa44ff';
      ctx.beginPath();
      ctx.arc(sx, sy-30*z, 3*z, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
  }
}

function drawWorld() {
  // Back to front rendering
  for (let sum = 0; sum < GRID*2-1; sum++) {
    for (let gx = 0; gx < GRID; gx++) {
      let gy = sum - gx;
      if (gy < 0 || gy >= GRID) continue;
      let t = world[gy][gx];
      let p = isoProject(gx, gy, t.elevation);
      let sx = p.x * zoom - camX;
      let sy = p.y * zoom - camY;

      // Culling
      if (sx < -TILE_W*zoom*2 || sx > canvas.width+TILE_W*zoom*2) continue;
      if (sy < -TILE_H*zoom*4 || sy > canvas.height+TILE_H*zoom*2) continue;

      drawTile(t, sx, sy);
    }
  }
}

function drawParticles() {
  for (let i=particles.length-1; i>=0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.type==='drop') p.vy += 0.15;
    else if (p.type==='leaf') { p.vx += Math.sin(p.life*0.3)*0.2; p.vy += 0.05; }
    else if (p.type==='spark') { p.vy += 0.1; }
    else p.vy += 0.05;
    p.life--;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    if (p.type==='leaf') {
      ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size*0.6);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life/p.maxLife), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawMinimap() {
  let mw = 160, mh = 100;
  let mx = canvas.width - mw - 10;
  let my = canvas.height - mh - 50;
  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(mx-2, my-2, mw+4, mh+4);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx-2, my-2, mw+4, mh+4);

  let scale = Math.min(mw/(GRID*2), mh/GRID);
  for (let y=0; y<GRID; y++) {
    for (let x=0; x<GRID; x++) {
      let t = world[y][x];
      let px = mx + (x-y+GRID)*scale;
      let py = my + (x+y)*scale*0.5;
      ctx.fillStyle = STAGE_COLORS[t.stage][0];
      if (t.isCrystal) ctx.fillStyle = '#aa44ff';
      if (t.building >= 0) ctx.fillStyle = '#ffcc44';
      ctx.fillRect(px, py, scale*1.2, scale*0.7);
    }
  }

  // Viewport indicator
  let vpx = mx + (camX/zoom/TILE_W*2 + GRID)*scale*0.5;
  let vpy = my + (camY/zoom/TILE_H*2)*scale*0.25;
  let vpw = canvas.width/zoom/TILE_W*scale;
  let vph = canvas.height/zoom/TILE_H*scale;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(vpx, vpy, vpw, vph);
}

function drawUI() {
  let z = zoom;

  // Top bar — resources
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(0, 0, canvas.width, 36);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0,36); ctx.lineTo(canvas.width,36); ctx.stroke();

  ctx.font = '13px Courier New';
  ctx.textAlign = 'left';
  let rx = 70;
  const resDisplay = [
    ['💧',res.water,'water'],['🪨',res.stone,'stone'],['🪵',res.wood,'wood'],
    ['🌿',res.herbs,'herbs'],['🍖',res.food,'food'],['⚡',res.energy,'energy']
  ];
  for (let r of resDisplay) {
    ctx.fillStyle = '#ccc';
    ctx.fillText(r[0]+' '+Math.floor(r[1]), rx, 23);
    rx += 95;
  }
  ctx.fillStyle = '#aaddaa';
  ctx.fillText('👤 '+population, rx, 23);
  rx += 70;
  ctx.fillStyle = '#ddcc88';
  ctx.fillText('Day '+day, rx, 23);

  // Win medal
  if (winLevel > 0) {
    let medals = ['','🥉','🥈','🥇'];
    ctx.fillText(medals[winLevel], rx+80, 23);
  }

  // Left toolbar
  let tbx = 5, tby = 50;
  let tbw = 50, tbh = 44;
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(0, 40, 60, tbh*TOOL_NAMES.length+20);

  for (let i=0; i<TOOL_NAMES.length; i++) {
    let y = tby + i*tbh;
    if (i === currentTool) {
      ctx.fillStyle = 'rgba(80,120,180,0.6)';
      ctx.fillRect(tbx, y, tbw, tbh-4);
    }
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(tbx, y, tbw, tbh-4);
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(TOOL_ICONS[i], tbx+tbw/2, y+22);
    ctx.font = '9px Courier New';
    ctx.fillStyle = '#888';
    ctx.fillText(TOOL_KEYS[i], tbx+tbw-8, y+tbh-8);
  }

  // Build submenu
  if (currentTool === TOOL_BUILD) {
    let bx = 65, by = 50;
    ctx.fillStyle = 'rgba(10,10,20,0.9)';
    ctx.fillRect(bx-5, by-5, 140, BUILDINGS.length*30+10);
    for (let i=0; i<BUILDINGS.length; i++) {
      let y = by + i*30;
      if (i === selectedBuilding) {
        ctx.fillStyle = 'rgba(80,120,180,0.5)';
        ctx.fillRect(bx, y, 130, 26);
      }
      ctx.font = '12px Courier New';
      ctx.fillStyle = '#ddd';
      ctx.textAlign = 'left';
      ctx.fillText(BUILDINGS[i].icon+' '+BUILDINGS[i].name, bx+4, y+16);
    }
  }

  // Terraform direction
  if (currentTool === TOOL_TERRAFORM) {
    ctx.fillStyle = 'rgba(10,10,20,0.9)';
    ctx.fillRect(65, 50, 100, 30);
    ctx.font = '12px Courier New';
    ctx.fillStyle = '#ddd';
    ctx.textAlign = 'left';
    ctx.fillText(terraformRaise ? '▲ Raise (R)' : '▼ Lower (R)', 70, 70);
  }

  // Bottom bar
  ctx.fillStyle = 'rgba(10,10,20,0.85)';
  ctx.fillRect(0, canvas.height-36, canvas.width, 36);
  ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(0,canvas.height-36); ctx.lineTo(canvas.width,canvas.height-36); ctx.stroke();

  // Speed controls
  ctx.font = '13px Courier New';
  ctx.textAlign = 'left';
  for (let i=0; i<SPEEDS.length; i++) {
    let sx = 10 + i*55;
    let sy = canvas.height - 28;
    if (i === speedIdx) {
      ctx.fillStyle = 'rgba(80,120,180,0.6)';
      ctx.fillRect(sx-2, sy-12, 50, 22);
    }
    ctx.fillStyle = i===speedIdx ? '#fff' : '#888';
    ctx.fillText(SPEEDS[i]+'x', sx+8, sy+4);
  }

  // Current tool name
  ctx.fillStyle = '#aaa';
  ctx.textAlign = 'center';
  ctx.fillText('Tool: '+TOOL_NAMES[currentTool], canvas.width/2, canvas.height-14);

  // Hover info
  if (hoveredTile && gameState === STATE_GAME) {
    let t = world[hoveredTile.gy][hoveredTile.gx];
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(STAGE_NAMES[t.stage]+' ('+hoveredTile.gx+','+hoveredTile.gy+') elev:'+t.elevation, canvas.width-170, canvas.height-14);
  }

  // Inspect panel
  if (inspectedTile && currentTool === TOOL_INSPECT) {
    let t = inspectedTile;
    let px = canvas.width - 220, py = 50;
    ctx.fillStyle = 'rgba(10,10,25,0.92)';
    ctx.fillRect(px, py, 210, 230);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(px, py, 210, 230);

    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.fillText('Tile ('+t.gx+','+t.gy+')', px+10, py+22);
    ctx.font = '12px Courier New';
    ctx.fillStyle = '#ccc';
    ctx.fillText('Stage: '+STAGE_NAMES[t.stage], px+10, py+42);
    ctx.fillText('Elevation: '+t.elevation, px+10, py+58);
    ctx.fillText('Moisture: '+t.moisture.toFixed(1), px+10, py+74);
    ctx.fillText('Growth: '+t.tickCounter.toFixed(0), px+10, py+90);

    let ry = py+110;
    ctx.fillStyle = '#aaa';
    ctx.fillText('— Resources —', px+10, ry);
    ry += 16;
    for (let r in t.resources) {
      if (t.resources[r] > 0.1) {
        ctx.fillText(r+': '+t.resources[r].toFixed(1), px+10, ry);
        ry += 14;
      }
    }
    if (t.building >= 0) {
      ctx.fillStyle = '#ddcc88';
      ctx.fillText('Building: '+BUILDINGS[t.building].name, px+10, ry+4);
      ry += 16;
    }
    if (t.isSpring) { ctx.fillStyle='#88ccff'; ctx.fillText('Spring ✓', px+10, ry+4); ry+=16; }
    if (t.isChannel) { ctx.fillStyle='#6699cc'; ctx.fillText('Channel ✓', px+10, ry+4); ry+=16; }
    if (t.isCrystal) { ctx.fillStyle='#bb66ff'; ctx.fillText('Crystal Node ✓', px+10, ry+4); }

    // Needs
    ctx.fillStyle = '#888';
    let needY = py + 210;
    if (t.stage === BARREN) ctx.fillText('Needs: water nearby', px+10, needY);
    else if (t.stage === MUD) ctx.fillText('Growing → grass...', px+10, needY);
    else if (t.stage === GRASS) ctx.fillText('Growing → plants...', px+10, needY);
    else if (t.stage === PLANTS) ctx.fillText('Growing → trees...', px+10, needY);
    else if (t.stage === TREES) ctx.fillText('Needs: 3+ trees + water', px+10, needY);
  }

  // Notifications
  let ny = canvas.height - 60;
  ctx.textAlign = 'left';
  for (let i=notifications.length-1; i>=0; i--) {
    let n = notifications[i];
    n.timer--;
    if (n.timer <= 0) { notifications.splice(i,1); continue; }
    ctx.globalAlpha = Math.min(1, n.timer/30);
    ctx.font = '12px Courier New';
    ctx.fillStyle = '#ffdd88';
    ctx.fillText(n.msg, 70, ny);
    ny -= 18;
    ctx.globalAlpha = 1;
  }

  drawMinimap();
}

function drawStatsOverlay() {
  ctx.fillStyle = 'rgba(5,5,15,0.92)';
  ctx.fillRect(canvas.width*0.15, canvas.height*0.1, canvas.width*0.7, canvas.height*0.8);
  ctx.strokeStyle = '#555';
  ctx.strokeRect(canvas.width*0.15, canvas.height*0.1, canvas.width*0.7, canvas.height*0.8);

  let sx = canvas.width*0.2, sy = canvas.height*0.15;
  ctx.font = '20px Courier New';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('— TERRAFORM STATS —', sx, sy);

  ctx.font = '14px Courier New';
  sy += 40;
  ctx.fillStyle = '#ccc';
  ctx.fillText('Day: '+day+'  |  Ticks: '+totalTicks, sx, sy); sy+=24;
  ctx.fillText('Population: '+population, sx, sy); sy+=24;
  ctx.fillText('Mode: '+(sandboxMode?'Sandbox':'Campaign'), sx, sy); sy+=30;

  // Count terrain types
  let counts = new Array(8).fill(0);
  let buildingCounts = new Array(BUILDINGS.length).fill(0);
  let springCount = 0, crystalCount = 0;
  for (let y=0; y<GRID; y++) for (let x=0; x<GRID; x++) {
    let t = world[y][x];
    counts[t.stage]++;
    if (t.building >= 0) buildingCounts[t.building]++;
    if (t.isSpring) springCount++;
    if (t.isCrystal) crystalCount++;
  }

  ctx.fillStyle = '#aaa';
  ctx.fillText('— Terrain —', sx, sy); sy+=20;
  for (let i=0; i<8; i++) {
    if (counts[i]>0) {
      ctx.fillStyle = STAGE_COLORS[i][0];
      ctx.fillRect(sx, sy-10, 12, 12);
      ctx.fillStyle = '#ccc';
      ctx.fillText(STAGE_NAMES[i]+': '+counts[i], sx+20, sy);
      sy += 18;
    }
  }

  sy += 10;
  ctx.fillStyle = '#aaa';
  ctx.fillText('— Infrastructure —', sx, sy); sy+=20;
  ctx.fillStyle = '#ccc';
  ctx.fillText('Springs: '+springCount, sx, sy); sy+=18;
  ctx.fillText('Crystal Nodes: '+crystalCount, sx, sy); sy+=18;
  for (let i=0; i<BUILDINGS.length; i++) {
    if (buildingCounts[i]>0) {
      ctx.fillText(BUILDINGS[i].name+': '+buildingCounts[i], sx, sy);
      sy += 18;
    }
  }

  sy += 10;
  ctx.fillStyle = '#aaa';
  ctx.fillText('— Resources —', sx, sy); sy+=20;
  ctx.fillStyle = '#ccc';
  for (let r in res) {
    ctx.fillText(r+': '+Math.floor(res[r]), sx, sy); sy+=18;
  }

  // Right column - achievements
  let rx = canvas.width*0.55, ry = canvas.height*0.15 + 40;
  ctx.fillStyle = '#aaa';
  ctx.fillText('— Achievements —', rx, ry); ry+=24;
  ctx.fillStyle = winLevel>=1 ? '#cd7f32' : '#444';
  ctx.fillText((winLevel>=1?'✓':'○')+' Bronze: Pop 10', rx, ry); ry+=20;
  ctx.fillStyle = winLevel>=2 ? '#c0c0c0' : '#444';
  ctx.fillText((winLevel>=2?'✓':'○')+' Silver: Pop 25', rx, ry); ry+=20;
  ctx.fillStyle = winLevel>=3 ? '#ffd700' : '#444';
  ctx.fillText((winLevel>=3?'✓':'○')+' Gold: Pop 50', rx, ry); ry+=30;

  ctx.fillStyle = '#666';
  ctx.font = '12px Courier New';
  ctx.fillText('Press TAB to close', rx, ry);
}

function drawTitleScreen() {
  titleTime++;
  titleAngle += 0.008;

  // Starfield background
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  for (let i=0; i<80; i++) {
    let sx = ((i*137+titleTime*0.1)%canvas.width);
    let sy = ((i*251+titleTime*0.05)%canvas.height);
    let bright = Math.sin(titleTime*0.02+i)*0.3+0.7;
    ctx.globalAlpha = bright*0.6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Rotating isometric planet preview
  let pcx = canvas.width/2;
  let pcy = canvas.height/2 - 40;
  let pSize = 8;
  let previewGrid = 8;

  ctx.save();
  ctx.translate(pcx, pcy);

  for (let sum=0; sum<previewGrid*2-1; sum++) {
    for (let gx=0; gx<previewGrid; gx++) {
      let gy = sum - gx;
      if (gy<0||gy>=previewGrid) continue;

      let cx2 = gx - previewGrid/2;
      let cy2 = gy - previewGrid/2;
      let dist = Math.sqrt(cx2*cx2+cy2*cy2);
      if (dist > previewGrid*0.45) continue;

      // Rotate
      let angle = titleAngle;
      let rx = cx2*Math.cos(angle) - cy2*Math.sin(angle);
      let ry2 = cx2*Math.sin(angle) + cy2*Math.cos(angle);

      let px = (rx - ry2) * pSize;
      let py = (rx + ry2) * pSize * 0.5;

      // Color based on pattern
      let hash = ((gx*7+gy*13+Math.floor(titleTime*0.01))%7);
      let colors = ['#5a5044','#2266aa','#5a3a1a','#3a8a3a','#2a6a2a','#1a5a1a','#2a8a3a'];
      let c = colors[hash];

      drawDiamond(px, py, pSize*2, pSize, c, 'rgba(0,0,0,0.2)');
    }
  }
  ctx.restore();

  // Title text
  ctx.font = 'bold 42px Courier New';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#88ccaa';
  ctx.fillText('T E R R A F O R M', canvas.width/2, canvas.height/2 + 100);

  ctx.font = '16px Courier New';
  ctx.fillStyle = '#668877';
  ctx.fillText('Isometric Ecosystem Simulation', canvas.width/2, canvas.height/2 + 130);

  ctx.font = '14px Courier New';
  let blink = Math.sin(titleTime*0.05) > 0;
  if (blink) {
    ctx.fillStyle = '#aaccbb';
    ctx.fillText('[ Press ENTER or Click to Begin ]', canvas.width/2, canvas.height/2 + 180);
  }

  ctx.fillStyle = '#444';
  ctx.font = '11px Courier New';
  ctx.fillText('Guinea Pig Trench Portal', canvas.width/2, canvas.height - 30);
}

function drawModeSelect() {
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 28px Courier New';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#88ccaa';
  ctx.fillText('SELECT MODE', canvas.width/2, canvas.height*0.3);

  // Campaign button
  let bw = 280, bh = 60;
  let bx1 = canvas.width/2 - bw/2;
  let by1 = canvas.height*0.4;
  ctx.fillStyle = mouseX>bx1&&mouseX<bx1+bw&&mouseY>by1&&mouseY<by1+bh ? 'rgba(80,140,120,0.5)' : 'rgba(40,60,50,0.5)';
  ctx.fillRect(bx1, by1, bw, bh);
  ctx.strokeStyle = '#88ccaa';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx1, by1, bw, bh);
  ctx.font = '18px Courier New';
  ctx.fillStyle = '#cceecc';
  ctx.fillText('🏆 Campaign', canvas.width/2, by1+28);
  ctx.font = '11px Courier New';
  ctx.fillStyle = '#889988';
  ctx.fillText('Reach Gold (Pop 50) to win', canvas.width/2, by1+48);

  // Sandbox button
  let by2 = canvas.height*0.55;
  ctx.fillStyle = mouseX>bx1&&mouseX<bx1+bw&&mouseY>by2&&mouseY<by2+bh ? 'rgba(80,120,140,0.5)' : 'rgba(40,50,60,0.5)';
  ctx.fillRect(bx1, by2, bw, bh);
  ctx.strokeStyle = '#88aacc';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx1, by2, bw, bh);
  ctx.font = '18px Courier New';
  ctx.fillStyle = '#ccddee';
  ctx.fillText('🌍 Sandbox', canvas.width/2, by2+28);
  ctx.font = '11px Courier New';
  ctx.fillStyle = '#889999';
  ctx.fillText('No win condition — terraform freely', canvas.width/2, by2+48);

  // Controls hint
  ctx.font = '11px Courier New';
  ctx.fillStyle = '#555';
  let cy = canvas.height*0.75;
  ctx.fillText('WASD: pan camera | Scroll: zoom | 1-7: tools | TAB: stats', canvas.width/2, cy);
  ctx.fillText('Click tile to use tool | R: toggle raise/lower', canvas.width/2, cy+18);
  ctx.fillText('Q/E: cycle buildings when Build tool active', canvas.width/2, cy+36);
}

// --- Main Loop ---
let lastTime = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function update(dt) {
  if (gameState !== STATE_GAME) return;

  // Camera movement
  let camSpeed = 300 * dt / zoom;
  if (keys['w'] || keys['arrowup']) camY -= camSpeed;
  if (keys['s'] || keys['arrowdown']) camY += camSpeed;
  if (keys['a'] || keys['arrowleft']) camX -= camSpeed;
  if (keys['d'] || keys['arrowright']) camX += camSpeed;

  // Edge pan
  let edgeDist = 30;
  if (mouseX < edgeDist) camX -= camSpeed * 0.5;
  if (mouseX > canvas.width - edgeDist) camX += camSpeed * 0.5;
  if (mouseY < edgeDist + 36) camY -= camSpeed * 0.5;
  if (mouseY > canvas.height - edgeDist - 36) camY += camSpeed * 0.5;

  // Hover
  hoveredTile = screenToWorld(mouseX, mouseY);

  // Simulation
  tickTimer += dt * 1000 * simSpeed;
  while (tickTimer >= TICK_MS) {
    tickTimer -= TICK_MS;
    simTick();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === STATE_TITLE) {
    drawTitleScreen();
    return;
  }

  if (gameState === STATE_MODE) {
    drawModeSelect();
    return;
  }

  // Game bg - sky gradient based on day/night
  let nightFactor = Math.sin(dayNightPhase * Math.PI * 2);
  let skyTop, skyBot;
  if (nightFactor >= 0) {
    skyTop = blendColor('#1a2a3a', '#0a1520', 1-nightFactor);
    skyBot = blendColor('#2a3a4a', '#0a0a12', 1-nightFactor);
  } else {
    let nf = Math.abs(nightFactor);
    skyTop = blendColor('#1a2a3a', '#050510', nf);
    skyBot = blendColor('#2a3a4a', '#080815', nf);
  }
  let grad = ctx.createLinearGradient(0,0,0,canvas.height);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(1, skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawWorld();
  drawParticles();
  drawUI();

  if (showStats) drawStatsOverlay();
}

function gameLoop(timestamp) {
  let dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// --- Input Handlers ---
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  if (gameState === STATE_TITLE) {
    if (e.key === 'Enter') gameState = STATE_MODE;
    return;
  }

  if (gameState === STATE_MODE) return;

  if (e.key === 'Tab') {
    e.preventDefault();
    showStats = !showStats;
    return;
  }

  // Tool selection
  let toolIdx = TOOL_KEYS.indexOf(e.key);
  if (toolIdx >= 0) {
    currentTool = toolIdx;
    inspectedTile = null;
  }

  // Speed
  if (e.key === '[' || e.key === '-') {
    speedIdx = Math.max(0, speedIdx-1);
    simSpeed = SPEEDS[speedIdx];
  }
  if (e.key === ']' || e.key === '=') {
    speedIdx = Math.min(SPEEDS.length-1, speedIdx+1);
    simSpeed = SPEEDS[speedIdx];
  }

  // Terraform toggle
  if (e.key.toLowerCase() === 'r' && currentTool === TOOL_TERRAFORM) {
    terraformRaise = !terraformRaise;
  }

  // Building cycle
  if (currentTool === TOOL_BUILD) {
    if (e.key.toLowerCase() === 'q') selectedBuilding = (selectedBuilding-1+BUILDINGS.length)%BUILDINGS.length;
    if (e.key.toLowerCase() === 'e') selectedBuilding = (selectedBuilding+1)%BUILDINGS.length;
  }

  // Escape
  if (e.key === 'Escape') {
    if (showStats) showStats = false;
    else inspectedTile = null;
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousedown', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  mouseDown = true;

  if (gameState === STATE_TITLE) {
    gameState = STATE_MODE;
    return;
  }

  if (gameState === STATE_MODE) {
    let bw = 280, bh = 60;
    let bx1 = canvas.width/2 - bw/2;
    let by1 = canvas.height*0.4;
    let by2 = canvas.height*0.55;
    if (mouseX>bx1&&mouseX<bx1+bw) {
      if (mouseY>by1&&mouseY<by1+bh) {
        sandboxMode = false;
        initWorld();
        gameState = STATE_GAME;
      } else if (mouseY>by2&&mouseY<by2+bh) {
        sandboxMode = true;
        initWorld();
        gameState = STATE_GAME;
      }
    }
    return;
  }

  if (showStats) { showStats = false; return; }

  // Check toolbar click
  if (mouseX < 60 && mouseY > 50) {
    let idx = Math.floor((mouseY - 50) / 44);
    if (idx >= 0 && idx < TOOL_NAMES.length) {
      currentTool = idx;
      inspectedTile = null;
      return;
    }
  }

  // Build submenu click
  if (currentTool === TOOL_BUILD && mouseX >= 65 && mouseX <= 195 && mouseY >= 50) {
    let idx = Math.floor((mouseY - 50) / 30);
    if (idx >= 0 && idx < BUILDINGS.length) {
      selectedBuilding = idx;
      return;
    }
  }

  // Speed bar click
  if (mouseY > canvas.height - 36) {
    for (let i=0; i<SPEEDS.length; i++) {
      let sx = 10 + i*55;
      if (mouseX >= sx && mouseX <= sx+50) {
        speedIdx = i;
        simSpeed = SPEEDS[i];
        return;
      }
    }
  }

  // World click
  if (hoveredTile) {
    useTool(hoveredTile.gx, hoveredTile.gy);
  }
});

canvas.addEventListener('mouseup', () => { mouseDown = false; });

canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (gameState !== STATE_GAME) return;

  // Get world position under mouse before zoom
  let wx = (mouseX + camX) / zoom;
  let wy = (mouseY + camY) / zoom;

  if (e.deltaY < 0) zoomIdx = Math.min(ZOOM_LEVELS.length-1, zoomIdx+1);
  else zoomIdx = Math.max(0, zoomIdx-1);
  zoom = ZOOM_LEVELS[zoomIdx];

  // Adjust camera to keep world position under mouse
  camX = wx * zoom - mouseX;
  camY = wy * zoom - mouseY;
}, {passive: false});

// Touch support
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  let t = e.touches[0];
  mouseX = t.clientX;
  mouseY = t.clientY;
  mouseDown = true;
  canvas.dispatchEvent(new MouseEvent('mousedown', {clientX:t.clientX, clientY:t.clientY}));
}, {passive: false});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  let t = e.touches[0];
  mouseX = t.clientX;
  mouseY = t.clientY;
}, {passive: false});
canvas.addEventListener('touchend', () => { mouseDown = false; });

// Prevent context menu
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', resize);

// --- Init ---
resize();
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
  var hbPeriod = 0.7180481213496327;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.015078138493396;mix-blend-mode:overlay';
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