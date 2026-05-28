"use strict";

/* ==========================================================
   BLOCK TYPES
========================================================== */
const BLOCK = {
    AIR: 0,
    STONE: 1,
    DIRT: 2,
    GRASS: 3,
    WOOD: 4
};

const BLOCK_NAMES = ['AIR','STONE','DIRT','GRASS','WOOD'];

// RGB colors per block type [top, side, bottom] — each is [r,g,b] 0-1
const BLOCK_COLORS = {
    [BLOCK.STONE]:  { top:[0.50,0.50,0.50], side:[0.45,0.45,0.45], bottom:[0.40,0.40,0.40] },
    [BLOCK.DIRT]:   { top:[0.55,0.36,0.22], side:[0.50,0.33,0.20], bottom:[0.45,0.30,0.18] },
    [BLOCK.GRASS]:  { top:[0.30,0.65,0.20], side:[0.50,0.33,0.20], bottom:[0.45,0.30,0.18] },
    [BLOCK.WOOD]:   { top:[0.55,0.40,0.22], side:[0.45,0.30,0.15], bottom:[0.55,0.40,0.22] },
};

/* ==========================================================
   WORLD DATA (single chunk 16x8x16 for simplicity, but stored as flat world)
========================================================== */
const WORLD_X = 16, WORLD_Y = 32, WORLD_Z = 16;
const world = new Uint8Array(WORLD_X * WORLD_Y * WORLD_Z);

function worldIdx(x, y, z) {
    if (x < 0 || x >= WORLD_X || y < 0 || y >= WORLD_Y || z < 0 || z >= WORLD_Z) return -1;
    return x + y * WORLD_X + z * WORLD_X * WORLD_Y;
}

function getBlock(x, y, z) {
    const i = worldIdx(x, y, z);
    return i < 0 ? BLOCK.AIR : world[i];
}

function setBlock(x, y, z, type) {
    const i = worldIdx(x, y, z);
    if (i >= 0) { world[i] = type; meshDirty = true; }
}

function generateWorld() {
    for (let x = 0; x < WORLD_X; x++) {
        for (let z = 0; z < WORLD_Z; z++) {
            // Simple terrain: height varies 4-8 using a crude noise
            const h = Math.floor(4 + 3 * (Math.sin(x * 0.3) * Math.cos(z * 0.4) + 1) / 2
                      + 2 * Math.sin(x * 0.15 + z * 0.2));
            const height = Math.max(1, Math.min(WORLD_Y - 1, h));
            for (let y = 0; y < height; y++) {
                if (y === height - 1) {
                    setBlock(x, y, z, BLOCK.GRASS);
                } else if (y >= height - 4) {
                    setBlock(x, y, z, BLOCK.DIRT);
                } else {
                    setBlock(x, y, z, BLOCK.STONE);
                }
            }
        }
    }
    // A few wood pillars for variety
    for (let i = 0; i < 5; i++) {
        const tx = 3 + (i * 3) % WORLD_X;
        const tz = 2 + (i * 5) % WORLD_Z;
        let base = 0;
        for (let y = WORLD_Y - 1; y >= 0; y--) { if (getBlock(tx, y, tz) !== BLOCK.AIR) { base = y + 1; break; } }
        for (let y = base; y < Math.min(base + 4, WORLD_Y); y++) setBlock(tx, y, tz, BLOCK.WOOD);
    }
    meshDirty = true;
}

/* ==========================================================
   MESH BUILDER  — greedy-ish: emit only visible faces
========================================================== */
let meshDirty = true;

const FACE_DIRS = [
    { axis: 0, dir: 1,  normal:[1,0,0]  },  // +X
    { axis: 0, dir:-1,  normal:[-1,0,0] },  // -X
    { axis: 1, dir: 1,  normal:[0,1,0]  },  // +Y (top)
    { axis: 1, dir:-1,  normal:[0,-1,0] },  // -Y (bottom)
    { axis: 2, dir: 1,  normal:[0,0,1]  },  // +Z
    { axis: 2, dir:-1,  normal:[0,0,-1] },  // -Z
];

// Each face = 6 vertices, each vertex = 3 pos + 3 color + 3 normal = 9 floats
function buildMesh() {
    const verts = [];

    // ── Sierpiński chunk LOD — distance-based detail reduction ──
    // Near camera: all faces rendered (full detail, high D)
    // Far from camera: only top faces rendered (low detail, low D)
    // Same hierarchy: expensive detail only where the eye IS (the signal)
    const camX = camera ? camera.x : WORLD_X / 2;
    const camZ = camera ? camera.z : WORLD_Z / 2;

    for (let x = 0; x < WORLD_X; x++)
    for (let y = 0; y < WORLD_Y; y++)
    for (let z = 0; z < WORLD_Z; z++) {
        const blk = getBlock(x, y, z);
        if (blk === BLOCK.AIR) continue;

        // Distance from camera (cheap, no sqrt needed for comparison)
        const dx = x - camX, dz = z - camZ;
        const distSq = dx * dx + dz * dz;

        // LOD tiers — Sierpiński: most faces eliminated at distance
        // Near (< 8 blocks): all 6 faces (full detail)
        // Medium (8-16): top + sides facing camera only
        // Far (> 16): top face only
        const lodTier = distSq < 64 ? 0 : distSq < 256 ? 1 : 2;

        const colors = BLOCK_COLORS[blk];

        for (const face of FACE_DIRS) {
            // ── LOD face culling — skip faces by distance tier ──
            // Tier 2 (far): only render top faces
            if (lodTier === 2 && !(face.axis === 1 && face.dir === 1)) continue;
            // Tier 1 (medium): skip bottom and back-facing side faces
            if (lodTier === 1 && face.axis === 1 && face.dir === -1) continue;

            // Check neighbor
            const nx = x + (face.axis === 0 ? face.dir : 0);
            const ny = y + (face.axis === 1 ? face.dir : 0);
            const nz = z + (face.axis === 2 ? face.dir : 0);

            if (getBlock(nx, ny, nz) !== BLOCK.AIR) continue;

            // Pick color based on face
            let c;
            if (face.axis === 1 && face.dir === 1) c = colors.top;
            else if (face.axis === 1 && face.dir === -1) c = colors.bottom;
            else c = colors.side;

            // Simple ambient shading per face direction
            let shade = 1.0;
            if (face.axis === 0) shade = 0.8;
            if (face.axis === 2) shade = 0.7;
            if (face.axis === 1 && face.dir === -1) shade = 0.5;

            const cr = c[0] * shade, cg = c[1] * shade, cb = c[2] * shade;
            const n = face.normal;

            // Build quad vertices
            const quads = getFaceQuad(x, y, z, face.axis, face.dir);
            for (const v of quads) {
                verts.push(v[0], v[1], v[2], cr, cg, cb, n[0], n[1], n[2]);
            }
        }
    }

    return new Float32Array(verts);
}

function getFaceQuad(x, y, z, axis, dir) {
    // Returns 6 vertices (2 triangles) for the face
    let v0, v1, v2, v3;
    if (axis === 0) { // X face
        const fx = dir === 1 ? x + 1 : x;
        v0 = [fx, y,   z];
        v1 = [fx, y+1, z];
        v2 = [fx, y+1, z+1];
        v3 = [fx, y,   z+1];
        if (dir === 1) return [v0,v1,v2, v0,v2,v3];
        else return [v0,v2,v1, v0,v3,v2];
    } else if (axis === 1) { // Y face
        const fy = dir === 1 ? y + 1 : y;
        v0 = [x,   fy, z];
        v1 = [x+1, fy, z];
        v2 = [x+1, fy, z+1];
        v3 = [x,   fy, z+1];
        if (dir === 1) return [v0,v1,v2, v0,v2,v3];
        else return [v0,v2,v1, v0,v3,v2];
    } else { // Z face
        const fz = dir === 1 ? z + 1 : z;
        v0 = [x,   y,   fz];
        v1 = [x+1, y,   fz];
        v2 = [x+1, y+1, fz];
        v3 = [x,   y+1, fz];
        if (dir === 1) return [v0,v2,v1, v0,v3,v2];
        else return [v0,v1,v2, v0,v2,v3];
    }
}

/* ==========================================================
   MATRIX MATH
========================================================== */
const MatrixMath = {
    perspective(fov, aspect, near, far) {
        const f = 1.0 / Math.tan(fov / 2);
        const nf = 1 / (near - far);
        return new Float32Array([
            f/aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far+near)*nf, -1,
            0, 0, 2*far*near*nf, 0
        ]);
    },

    identity() {
        return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    },

    fpsView(cam) {
        const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
        const cy = Math.cos(cam.yaw),   sy = Math.sin(cam.yaw);

        // Rotation = pitch * yaw
        const r = new Float32Array(16);
        r[0]  = cy;    r[1]  = sp*sy;    r[2]  = -cp*sy;   r[3]  = 0;
        r[4]  = 0;     r[5]  = cp;       r[6]  = sp;       r[7]  = 0;
        r[8]  = sy;    r[9]  = -sp*cy;   r[10] = cp*cy;    r[11] = 0;

        // Translation
        r[12] = -(r[0]*cam.x + r[4]*cam.y + r[8]*cam.z);
        r[13] = -(r[1]*cam.x + r[5]*cam.y + r[9]*cam.z);
        r[14] = -(r[2]*cam.x + r[6]*cam.y + r[10]*cam.z);
        r[15] = 1;
        return r;
    }
};

/* ==========================================================
   WEBGL RENDERER
========================================================== */
const canvas = document.getElementById('screen');
let gl = canvas.getContext('webgl2', { antialias: false, alpha: false });

if (!gl) {
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  const msg = gl
    ? 'Your browser supports WebGL1 but this game requires WebGL2.\nPlease use a recent version of Chrome, Firefox, or Edge.'
    : 'WebGL is not supported by your browser.\nPlease use a recent version of Chrome, Firefox, or Edge.';
  alert(msg);
  throw new Error('No WebGL2');
}

// Shaders
const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
layout(location=2) in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
out vec3 vColor;
out vec3 vNormal;
out float vFog;
void main() {
    vec4 viewPos = uView * vec4(aPos, 1.0);
    gl_Position = uProj * viewPos;
    vColor = aColor;
    vNormal = aNormal;
    float dist = length(viewPos.xyz);
    vFog = clamp((dist - 30.0) / 50.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision mediump float;
in vec3 vColor;
in vec3 vNormal;
in float vFog;
out vec4 fragColor;
void main() {
    // Simple directional light
    vec3 lightDir = normalize(vec3(0.4, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.0) * 0.4 + 0.6;
    vec3 col = vColor * diff;
    // Sky fog
    vec3 sky = vec3(0.45, 0.65, 0.95);
    col = mix(col, sky, vFog);
    fragColor = vec4(col, 1.0);
}`;

function compileShader(src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
    return s;
}

const prog = gl.createProgram();
gl.attachShader(prog, compileShader(VS, gl.VERTEX_SHADER));
gl.attachShader(prog, compileShader(FS, gl.FRAGMENT_SHADER));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const uProj = gl.getUniformLocation(prog, 'uProj');
const uView = gl.getUniformLocation(prog, 'uView');

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

let vao = null, vbo = null, vertexCount = 0;

function uploadMesh(data) {
    if (vao) gl.deleteVertexArray(vao);
    if (vbo) gl.deleteBuffer(vbo);

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const stride = 9 * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);

    gl.bindVertexArray(null);
    vertexCount = data.length / 9;
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ==========================================================
   INPUT MANAGER
========================================================== */
const keys = {};
let mouseDX = 0, mouseDY = 0;
let leftClick = false, rightClick = false;

window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
        mouseDX += e.movementX;
        mouseDY += e.movementY;
    }
});
canvas.addEventListener('mousedown', e => {
    if (document.pointerLockElement === canvas) {
        if (e.button === 0) leftClick = true;
        if (e.button === 2) rightClick = true;
    }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ==========================================================
   GAME STATE
========================================================== */
const STATE = { MENU: 0, PLAY: 1, PAUSE: 2 };
let gameState = STATE.MENU;

const camera = {
    x: 8, y: 12, z: 8,
    pitch: 0, yaw: 0,
    vy: 0,
    grounded: false,
    bob: 0
};

const PLAYER_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.25;
const WALK_SPEED = 5.0;
const SPRINT_SPEED = 8.5;
const JUMP_FORCE = 8.0;
const GRAVITY = 22.0;
const SENSITIVITY = 0.002;

let selectedBlock = BLOCK.STONE;
let selectedSlot = 0;
const blockSlots = [BLOCK.STONE, BLOCK.DIRT, BLOCK.GRASS, BLOCK.WOOD];

// DOM refs
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const hud = document.getElementById('hud');
const crosshair = document.getElementById('crosshair');
const hotbar = document.getElementById('hotbar');
const hPos = document.getElementById('h-pos');
const hBlock = document.getElementById('h-block');
const hPerf = document.getElementById('h-perf');
const mechaPortrait = document.getElementById('mecha-portrait');
const coreCounter = document.getElementById('core-counter');

function setUIState(state) {
    titleScreen.style.display = state === STATE.MENU ? 'flex' : 'none';
    pauseScreen.style.display = state === STATE.PAUSE ? 'flex' : 'none';
    hud.style.display = state === STATE.PLAY ? 'block' : 'none';
    crosshair.style.display = state === STATE.PLAY ? 'block' : 'none';
    hotbar.style.display = state === STATE.PLAY ? 'flex' : 'none';
    mechaPortrait.style.display = state === STATE.PLAY ? 'block' : 'none';
    coreCounter.style.display = state === STATE.PLAY ? 'block' : 'none';
}

function updateHotbar() {
    for (let i = 0; i < 4; i++) {
        document.getElementById('slot-' + i).classList.toggle('active', i === selectedSlot);
    }
    hBlock.textContent = BLOCK_NAMES[blockSlots[selectedSlot]];
    selectedBlock = blockSlots[selectedSlot];
}

/* ==========================================================
   POINTER LOCK
========================================================== */
function requestLock() {
    canvas.requestPointerLock();
}

titleScreen.addEventListener('click', requestLock);
pauseScreen.addEventListener('click', requestLock);

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        gameState = STATE.PLAY;
        setUIState(STATE.PLAY);
        lastTime = performance.now();
        requestAnimationFrame(loop);
    } else if (gameState === STATE.PLAY) {
        gameState = STATE.PAUSE;
        setUIState(STATE.PAUSE);
    }
});

window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && gameState === STATE.PLAY) {
        document.exitPointerLock();
    }
    if (e.code === 'Enter' && gameState !== STATE.PLAY) {
        requestLock();
    }
    // Block selection
    if (e.code === 'Digit1') { selectedSlot = 0; updateHotbar(); }
    if (e.code === 'Digit2') { selectedSlot = 1; updateHotbar(); }
    if (e.code === 'Digit3') { selectedSlot = 2; updateHotbar(); }
    if (e.code === 'Digit4') { selectedSlot = 3; updateHotbar(); }
});

/* ==========================================================
   COLLISION
========================================================== */
function isSolid(x, y, z) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    return getBlock(bx, by, bz) !== BLOCK.AIR;
}

function collideAxis(pos, vel, axis, dt) {
    // AABB collision along one axis
    const newPos = [pos[0], pos[1], pos[2]];
    newPos[axis] += vel[axis] * dt;

    // Player AABB: centered on X/Z with PLAYER_RADIUS, feet at y, head at y+PLAYER_HEIGHT
    const minX = newPos[0] - PLAYER_RADIUS;
    const maxX = newPos[0] + PLAYER_RADIUS;
    const minY = newPos[1];
    const maxY = newPos[1] + PLAYER_HEIGHT;
    const minZ = newPos[2] - PLAYER_RADIUS;
    const maxZ = newPos[2] + PLAYER_RADIUS;

    for (let bx = Math.floor(minX); bx <= Math.floor(maxX); bx++)
    for (let by = Math.floor(minY); by <= Math.floor(maxY); by++)
    for (let bz = Math.floor(minZ); bz <= Math.floor(maxZ); bz++) {
        if (getBlock(bx, by, bz) !== BLOCK.AIR) {
            // Collision detected
            if (axis === 1 && vel[1] < 0) {
                camera.grounded = true;
                camera.vy = 0;
                return by + 1;  // Stand on top
            }
            if (axis === 1 && vel[1] > 0) {
                camera.vy = 0;
                return by - PLAYER_HEIGHT - 0.001;
            }
            // X or Z: don't move
            return pos[axis];
        }
    }
    return newPos[axis];
}

/* ==========================================================
   RAYCAST (for breaking/placing)
========================================================== */
function raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    // DDA voxel traversal
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;

    const tdx = Math.abs(1 / dx);
    const tdy = Math.abs(1 / dy);
    const tdz = Math.abs(1 / dz);

    let tMaxX = ((dx > 0 ? x + 1 : x) - ox) / dx;
    let tMaxY = ((dy > 0 ? y + 1 : y) - oy) / dy;
    let tMaxZ = ((dz > 0 ? z + 1 : z) - oz) / dz;

    if (dx === 0) tMaxX = Infinity;
    if (dy === 0) tMaxY = Infinity;
    if (dz === 0) tMaxZ = Infinity;

    let prevX = x, prevY = y, prevZ = z;
    let dist = 0;

    for (let i = 0; i < 200 && dist < maxDist; i++) {
        const blk = getBlock(x, y, z);
        if (blk !== BLOCK.AIR) {
            return { hit: true, x, y, z, prevX, prevY, prevZ, block: blk };
        }

        prevX = x; prevY = y; prevZ = z;

        if (tMaxX < tMaxY) {
            if (tMaxX < tMaxZ) {
                dist = tMaxX; x += stepX; tMaxX += tdx;
            } else {
                dist = tMaxZ; z += stepZ; tMaxZ += tdz;
            }
        } else {
            if (tMaxY < tMaxZ) {
                dist = tMaxY; y += stepY; tMaxY += tdy;
            } else {
                dist = tMaxZ; z += stepZ; tMaxZ += tdz;
            }
        }
    }
    return { hit: false };
}

/* ==========================================================
   UPDATE
========================================================== */
function update(dt) {
    // Mouse look
    camera.yaw -= mouseDX * SENSITIVITY;
    camera.pitch -= mouseDY * SENSITIVITY;
    camera.pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, camera.pitch));
    mouseDX = 0; mouseDY = 0;

    // Movement direction
    const fwdX = Math.sin(camera.yaw), fwdZ = Math.cos(camera.yaw);
    const rightX = Math.cos(camera.yaw), rightZ = -Math.sin(camera.yaw);

    let mx = 0, mz = 0;
    if (keys['KeyW']) { mx += fwdX; mz += fwdZ; }
    if (keys['KeyS']) { mx -= fwdX; mz -= fwdZ; }
    if (keys['KeyA']) { mx -= rightX; mz -= rightZ; }
    if (keys['KeyD']) { mx += rightX; mz += rightZ; }

    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    let speed = WALK_SPEED;
    if (keys['ShiftLeft'] || keys['ShiftRight']) speed = SPRINT_SPEED;

    // Jumping
    if ((keys['Space']) && camera.grounded) {
        camera.vy = JUMP_FORCE;
        camera.grounded = false;
    }

    // Gravity
    camera.vy -= GRAVITY * dt;

    // Collide each axis separately
    const vel = [mx * speed, camera.vy, mz * speed];

    camera.grounded = false;
    camera.y = collideAxis([camera.x, camera.y, camera.z], vel, 1, dt);
    camera.x = collideAxis([camera.x, camera.y, camera.z], vel, 0, dt);
    camera.z = collideAxis([camera.x, camera.y, camera.z], vel, 2, dt);

    // Floor clamp (fallback)
    if (camera.y < -10) { camera.y = 20; camera.vy = 0; }

    // Head bob
    if (len > 0 && camera.grounded) camera.bob += dt * (speed > WALK_SPEED ? 12 : 8);

    // Block interaction
    const eyeY = camera.y + PLAYER_HEIGHT - 0.2;
    const lookX = Math.sin(camera.yaw) * Math.cos(camera.pitch);
    const lookY = Math.sin(camera.pitch);
    const lookZ = Math.cos(camera.yaw) * Math.cos(camera.pitch);

    if (leftClick) {
        const r = raycast(camera.x, eyeY, camera.z, lookX, lookY, lookZ, 6);
        if (r.hit) setBlock(r.x, r.y, r.z, BLOCK.AIR);
        leftClick = false;
    }
    if (rightClick) {
        const r = raycast(camera.x, eyeY, camera.z, lookX, lookY, lookZ, 6);
        if (r.hit) {
            // Don't place inside the player
            const px = r.prevX, py = r.prevY, pz = r.prevZ;
            const pmx = Math.floor(camera.x), pmy = Math.floor(camera.y), pmz = Math.floor(camera.z);
            const pmy2 = Math.floor(camera.y + PLAYER_HEIGHT);
            if (!((px === pmx && pz === pmz) && (py === pmy || py === pmy2))) {
                setBlock(px, py, pz, selectedBlock);
            }
        }
        rightClick = false;
    }

    // Core collection
    checkCoreCollection();

    // Sprite animation time
    spriteTime += dt;

    // HUD
    hPos.textContent = `${Math.floor(camera.x)}, ${Math.floor(camera.y)}, ${Math.floor(camera.z)}`;
}

/* ==========================================================
   RENDER
========================================================== */
function render() {
    if (meshDirty) {
        const data = buildMesh();
        uploadMesh(data);
        meshDirty = false;
    }

    gl.clearColor(0.45, 0.65, 0.95, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fov = 70 * Math.PI / 180;
    const aspect = canvas.width / canvas.height;
    const proj = MatrixMath.perspective(fov, aspect, 0.1, 200.0);

    const eyeY = camera.y + PLAYER_HEIGHT - 0.2 + Math.sin(camera.bob) * 0.08;
    const viewCam = { x: camera.x, y: eyeY, z: camera.z, pitch: camera.pitch, yaw: camera.yaw };
    const view = MatrixMath.fpsView(viewCam);

    gl.uniformMatrix4fv(uProj, false, proj);
    gl.uniformMatrix4fv(uView, false, view);

    if (vao && vertexCount > 0) {
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
        gl.bindVertexArray(null);
    }

    hPerf.textContent = `FACES ${Math.floor(vertexCount / 3)}`;

    // Render billboard sprites on overlay
    renderBillboards(view, proj);
}

/* ==========================================================
   GAME LOOP
========================================================== */
let lastTime = 0;

function loop(now) {
    if (gameState !== STATE.PLAY) return;

    const dt = Math.min((now - lastTime) * 0.001, 0.05);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
}

/* ==========================================================
   NATURE SPRITES — Billboard system via Canvas2D overlay
========================================================== */
const spriteCanvas = document.getElementById('sprite-overlay');
const sctx = spriteCanvas.getContext('2d');

function resizeSpriteCanvas() {
    spriteCanvas.width = window.innerWidth;
    spriteCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeSpriteCanvas);
resizeSpriteCanvas();

// --- Procedural tree sprite ---
function createTreeImage() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 48;
    const ctx = c.getContext('2d');
    // Trunk
    ctx.fillStyle = '#6B3A1F';
    ctx.fillRect(14, 24, 4, 24);
    // Trunk shading
    ctx.fillStyle = '#55301A';
    ctx.fillRect(14, 24, 1, 24);
    ctx.fillStyle = '#7A4528';
    ctx.fillRect(17, 24, 1, 24);
    // Canopy — layered circles for fullness
    const greens = ['#1B7A2B', '#25922E', '#2DAA36', '#35BF3E'];
    const positions = [[16,16,12],[10,18,8],[22,18,8],[16,10,9],[12,12,7],[20,12,7]];
    for (let i = 0; i < positions.length; i++) {
        const [px, py, r] = positions[i];
        ctx.fillStyle = greens[i % greens.length];
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
    }
    // Highlight spots
    ctx.fillStyle = '#3DD14A44';
    ctx.beginPath(); ctx.arc(13, 11, 4, 0, Math.PI * 2); ctx.fill();
    const img = new Image();
    img.src = c.toDataURL();
    return img;
}

// --- Procedural flower sprites (multiple colors) ---
function createFlowerImage(petalColor) {
    const c = document.createElement('canvas');
    c.width = 12; c.height = 16;
    const ctx = c.getContext('2d');
    // Stem
    ctx.strokeStyle = '#2D8B2D';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(6, 16); ctx.lineTo(6, 6); ctx.stroke();
    // Leaf
    ctx.fillStyle = '#2D8B2D';
    ctx.beginPath(); ctx.ellipse(8, 11, 3, 1.5, 0.5, 0, Math.PI * 2); ctx.fill();
    // Petals
    ctx.fillStyle = petalColor;
    for (let a = 0; a < 5; a++) {
        const angle = (a / 5) * Math.PI * 2;
        const px = 6 + Math.cos(angle) * 2.5;
        const py = 5 + Math.sin(angle) * 2.5;
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Center
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(6, 5, 1.5, 0, Math.PI * 2); ctx.fill();
    const img = new Image();
    img.src = c.toDataURL();
    return img;
}

const treeImg = createTreeImage();
const flowerColors = ['#FF4444', '#FFDD44', '#FF88BB', '#FFFFFF', '#FF6622'];
const flowerImgs = flowerColors.map(c => createFlowerImage(c));

// --- Load geometric core sprite ---
const coreImg = new Image();
coreImg.src = '../assets/sprites/geometric_core_geode_flux.png';

// --- Billboard data arrays ---
const trees = [];    // {x, y, z}
const flowers = [];  // {x, y, z, colorIdx, phase}
const cores = [];    // {x, y, z, collected, phase}
let coresCollected = 0;

// --- Seeded RNG for reproducible placement ---
let _seed = 42;
function seededRand() {
    _seed = (_seed * 16807 + 0) % 2147483647;
    return (_seed - 1) / 2147483646;
}

function getTerrainHeight(bx, bz) {
    for (let y = WORLD_Y - 1; y >= 0; y--) {
        if (getBlock(bx, y, bz) !== BLOCK.AIR) return y + 1;
    }
    return 0;
}

function isGrassTop(bx, bz) {
    for (let y = WORLD_Y - 1; y >= 0; y--) {
        const b = getBlock(bx, y, bz);
        if (b !== BLOCK.AIR) return b === BLOCK.GRASS;
    }
    return false;
}

function placeNatureSprites() {
    _seed = 42;
    // Collect all grass-top positions
    const grassPositions = [];
    for (let x = 0; x < WORLD_X; x++) {
        for (let z = 0; z < WORLD_Z; z++) {
            if (isGrassTop(x, z)) {
                grassPositions.push({x, z, h: getTerrainHeight(x, z)});
            }
        }
    }

    // Shuffle
    for (let i = grassPositions.length - 1; i > 0; i--) {
        const j = Math.floor(seededRand() * (i + 1));
        [grassPositions[i], grassPositions[j]] = [grassPositions[j], grassPositions[i]];
    }

    // Place trees (30-50, skip positions near spawn at 8,8)
    let treeCount = 0;
    const treeTarget = 40;
    for (const gp of grassPositions) {
        if (treeCount >= treeTarget) break;
        const dx = gp.x - 8, dz = gp.z - 8;
        if (dx * dx + dz * dz < 4) continue; // skip near spawn
        // Don't place on wood pillar locations
        if (getBlock(gp.x, gp.h, gp.z) === BLOCK.WOOD) continue;
        trees.push({ x: gp.x + 0.5, y: gp.h, z: gp.z + 0.5 });
        treeCount++;
    }

    // Place flowers (40-60) from remaining positions
    let flowerCount = 0;
    const flowerTarget = 50;
    for (let i = treeTarget; i < grassPositions.length && flowerCount < flowerTarget; i++) {
        const gp = grassPositions[i];
        // Offset within block
        const ox = gp.x + 0.2 + seededRand() * 0.6;
        const oz = gp.z + 0.2 + seededRand() * 0.6;
        flowers.push({
            x: ox, y: gp.h, z: oz,
            colorIdx: Math.floor(seededRand() * flowerImgs.length),
            phase: seededRand() * Math.PI * 2
        });
        flowerCount++;
    }

    // Place 5 geometric cores spread around the world
    const corePositions = [
        {x: 2, z: 2}, {x: 13, z: 3}, {x: 3, z: 13}, {x: 14, z: 14}, {x: 8, z: 1}
    ];
    for (const cp of corePositions) {
        const h = getTerrainHeight(cp.x, cp.z);
        cores.push({
            x: cp.x + 0.5, y: h + 1.2, z: cp.z + 0.5,
            collected: false,
            phase: seededRand() * Math.PI * 2
        });
    }
}

// --- Matrix-vector multiply for world-to-screen projection ---
function multiplyMat4Vec4(m, v) {
    return [
        m[0]*v[0] + m[4]*v[1] + m[8]*v[2]  + m[12]*v[3],
        m[1]*v[0] + m[5]*v[1] + m[9]*v[2]  + m[13]*v[3],
        m[2]*v[0] + m[6]*v[1] + m[10]*v[2] + m[14]*v[3],
        m[3]*v[0] + m[7]*v[1] + m[11]*v[2] + m[15]*v[3]
    ];
}

function worldToScreen(wx, wy, wz, viewMat, projMat, canvasW, canvasH) {
    const viewPos = multiplyMat4Vec4(viewMat, [wx, wy, wz, 1.0]);
    const clipPos = multiplyMat4Vec4(projMat, viewPos);
    if (clipPos[3] <= 0.01) return null; // behind camera
    const ndcX = clipPos[0] / clipPos[3];
    const ndcY = clipPos[1] / clipPos[3];
    const ndcZ = clipPos[2] / clipPos[3];
    if (ndcX < -1.5 || ndcX > 1.5 || ndcY < -1.5 || ndcY > 1.5) return null; // off screen
    const sx = (ndcX * 0.5 + 0.5) * canvasW;
    const sy = (1.0 - (ndcY * 0.5 + 0.5)) * canvasH;
    const dist = Math.sqrt(viewPos[0]*viewPos[0] + viewPos[1]*viewPos[1] + viewPos[2]*viewPos[2]);
    return { x: sx, y: sy, dist: dist, z: ndcZ };
}

// --- Render all billboards ---
let spriteTime = 0;

function renderBillboards(viewMat, projMat) {
    const w = spriteCanvas.width, h = spriteCanvas.height;
    sctx.clearRect(0, 0, w, h);

    // Collect all billboard draw calls for depth sorting
    const drawCalls = [];

    // Trees
    for (const t of trees) {
        const baseScale = 3.0; // world units tall
        const screenInfo = worldToScreen(t.x, t.y + baseScale * 0.5, t.z, viewMat, projMat, w, h);
        if (!screenInfo || screenInfo.dist > 60) continue;
        const pixelScale = (baseScale * h * 0.5) / (screenInfo.dist * Math.tan(70 * Math.PI / 360));
        drawCalls.push({
            type: 'tree', dist: screenInfo.dist,
            sx: screenInfo.x, sy: screenInfo.y,
            pw: pixelScale * (32/48), ph: pixelScale
        });
    }

    // Flowers
    for (const f of flowers) {
        const bobY = Math.sin(spriteTime * 2.0 + f.phase) * 0.05;
        const baseScale = 0.6;
        const screenInfo = worldToScreen(f.x, f.y + baseScale * 0.5 + bobY, f.z, viewMat, projMat, w, h);
        if (!screenInfo || screenInfo.dist > 40) continue;
        const pixelScale = (baseScale * h * 0.5) / (screenInfo.dist * Math.tan(70 * Math.PI / 360));
        drawCalls.push({
            type: 'flower', dist: screenInfo.dist, colorIdx: f.colorIdx,
            sx: screenInfo.x, sy: screenInfo.y,
            pw: pixelScale * (12/16), ph: pixelScale
        });
    }

    // Geometric cores
    for (const c of cores) {
        if (c.collected) continue;
        const bobY = Math.sin(spriteTime * 1.5 + c.phase) * 0.3;
        const baseScale = 0.8;
        const screenInfo = worldToScreen(c.x, c.y + bobY, c.z, viewMat, projMat, w, h);
        if (!screenInfo || screenInfo.dist > 50) continue;
        const pixelScale = (baseScale * h * 0.5) / (screenInfo.dist * Math.tan(70 * Math.PI / 360));
        drawCalls.push({
            type: 'core', dist: screenInfo.dist,
            sx: screenInfo.x, sy: screenInfo.y,
            pw: pixelScale, ph: pixelScale,
            phase: c.phase
        });
    }

    // Sort back-to-front
    drawCalls.sort((a, b) => b.dist - a.dist);

    // Draw
    for (const dc of drawCalls) {
        if (dc.type === 'tree') {
            if (treeImg.complete && treeImg.naturalWidth > 0) {
                sctx.drawImage(treeImg, dc.sx - dc.pw / 2, dc.sy - dc.ph / 2, dc.pw, dc.ph);
            }
        } else if (dc.type === 'flower') {
            const fimg = flowerImgs[dc.colorIdx];
            if (fimg.complete && fimg.naturalWidth > 0) {
                sctx.drawImage(fimg, dc.sx - dc.pw / 2, dc.sy - dc.ph / 2, dc.pw, dc.ph);
            }
        } else if (dc.type === 'core') {
            if (coreImg.complete && coreImg.naturalWidth > 0) {
                // Glow effect — draw larger translucent version behind
                sctx.save();
                sctx.globalAlpha = 0.25 + 0.15 * Math.sin(spriteTime * 3 + dc.phase);
                const glowScale = 1.6;
                sctx.drawImage(coreImg,
                    dc.sx - dc.pw * glowScale / 2,
                    dc.sy - dc.ph * glowScale / 2,
                    dc.pw * glowScale, dc.ph * glowScale);
                sctx.globalAlpha = 1.0;
                // Spin effect via horizontal scaling
                const spinScale = Math.abs(Math.cos(spriteTime * 2.0 + dc.phase));
                const spinW = dc.pw * (0.5 + 0.5 * spinScale);
                sctx.drawImage(coreImg,
                    dc.sx - spinW / 2,
                    dc.sy - dc.ph / 2,
                    spinW, dc.ph);
                sctx.restore();
            }
        }
    }
}

// --- Core collection check ---
function checkCoreCollection() {
    const px = camera.x, py = camera.y + PLAYER_HEIGHT * 0.5, pz = camera.z;
    for (const c of cores) {
        if (c.collected) continue;
        const dx = px - c.x, dy = py - c.y, dz = pz - c.z;
        if (dx * dx + dy * dy + dz * dz < 1.5) {
            c.collected = true;
            coresCollected++;
            coreCounter.textContent = `CORES: ${coresCollected}/5`;
            // Flash effect
            coreCounter.style.color = '#FFFFFF';
            coreCounter.style.fontSize = '18px';
            setTimeout(() => {
                coreCounter.style.color = '#ffd700';
                coreCounter.style.fontSize = '14px';
            }, 300);
        }
    }
}

/* ==========================================================
   INIT
========================================================== */
generateWorld();
placeNatureSprites();
// Set camera above terrain
let spawnH = 0;
for (let y = WORLD_Y - 1; y >= 0; y--) {
    if (getBlock(8, y, 8) !== BLOCK.AIR) { spawnH = y + 1; break; }
}
camera.y = spawnH + 0.01;

// Initial mesh
const initData = buildMesh();
uploadMesh(initData);
meshDirty = false;

setUIState(STATE.MENU);
updateHotbar();

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
  var hbPeriod = 0.7219680668885924;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01809569759241652;mix-blend-mode:overlay';
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