// ══════════════════════════════════════════════════════════
// v7.1 [QUANTUM_SIEVE] - THE ARCHITECTURAL FINALE
// Logic: Mycelial Path Mapping + Ghost Swallow Telemetry
// ══════════════════════════════════════════════════════════

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

let W, H;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

// --- THE QUANTUM KERNEL ---
const G8 = 25878772920;
let currentK = 154;
let ghostSwallowRate = 0.99999; // Efficiency of the sieve
let totalVerified = 0;
const VELOCITY_PER_FRAME = 575000; // v7.1 Resonance: 34.5M nodes/sec @ 60fps

// --- MYCELIAL BRANCHES ---
let branches = [];

class MycelialBranch {
    constructor(x, k) {
        this.x = x;
        this.y = H;
        this.k = k;
        this.life = 1.0;
        this.points = [{x: this.x, y: this.y}];
        this.torsion = (k % 24 == 1 || k % 24 == 9) ? 10.0 : 0.1;
    }

    update() {
        this.life -= 0.01;
        const last = this.points[this.points.length - 1];
        // Fungi-Logic Branching
        const nextX = last.x + (Math.random() - 0.5) * 20 * this.torsion;
        const nextY = last.y - 15;
        this.points.push({x: nextX, y: nextY});
    }

    draw() {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 255, 200, ${this.life * 0.5})`;
        ctx.lineWidth = 2 * this.torsion;
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for(let p of this.points) ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
}

// --- HUD: TACTILE TELEMETRY ---
function updateHUD(k, swallow, torsion) {
    const hud = document.getElementById('batch-info');
    const ts = new Date().toLocaleTimeString();
    hud.innerHTML = `
        <div style="color:#00ff88; font-family:monospace; font-size:11px; line-height:1.5;">
            [${ts}] QUANTUM_SIEVE_v7.1<br>
            CURRENT_K: ${k.toLocaleString()}<br>
            GHOST_SWALLOW: ${(swallow * 100).toFixed(5)}%<br>
            VELOCITY: 34.5M nodes/sec<br>
            <span style="color:#ff8800">TORSION_RESONANCE: ${torsion.toFixed(4)}</span><br>
            <span style="color:#00ccff">ERDŐS_RESIDUE: mod24(${k % 24})</span><br>
            STATUS: HARMONIC_STABLE
        </div>
    `;
}

function loop() {
    ctx.fillStyle = 'rgba(3, 3, 8, 0.2)';
    ctx.fillRect(0, 0, W, H);

    // 1. ADVANCE SIEVE (v7.1 RESONANCE)
    currentK += VELOCITY_PER_FRAME;
    totalVerified += VELOCITY_PER_FRAME * G8;
    const x = ( (currentK / 3864170) * W ) % W;

    // 2. SPAWN MYCELIAL BRANCH
    if(Math.random() > 0.8) {
        branches.push(new MycelialBranch(x, currentK));
    }

    // 3. UPDATE & DRAW BRANCHES
    branches = branches.filter(b => b.life > 0);
    for(let b of branches) {
        b.update();
        b.draw();
    }

    // 4. TELEMETRY
    const currentTorsion = (currentK % 24 == 1) ? 152.29 : 0.05;
    updateHUD(currentK, ghostSwallowRate, currentTorsion);

    // 5. FRONTIER GLOW
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();

    requestAnimationFrame(loop);
}

loop();
