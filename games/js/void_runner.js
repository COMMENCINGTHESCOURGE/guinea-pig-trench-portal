// ══════════════════════════════════════════════════════════
// v7.1 [LEVIATHAN_RUNNER] - THE HIGH-VELOCITY OVERHAUL
// Logic: Torsion Surfing + Bezier Hull Dynamics
// ══════════════════════════════════════════════════════════

const BASE_SPEED = 45; // Increased Velocity
const BOOST_MULT = 3.5;
const TORSION_KICK = 150.0; // Acceleration from Singularities

// ========== TORSION KERNEL (v103) ==========
function getTorsionAt(pos) {
    // Map 3D coordinate to a Collatz Number
    const n = Math.floor(Math.abs(pos.z) * 1000 + Math.abs(pos.x));
    const res24 = n % 24;
    // Simulate Torsion Signature from v103 findings
    let torsion = 0.05 + 0.05 * Math.sin(n * 0.001);
    if(res24 === 1 || res24 === 9 || res24 === 17) torsion *= 10.0;
    if(n === 2201089) torsion = 152299.49; // THE SINGULARITY
    return { torsion, res24 };
}

// ========== DYNAMIC BEZIER SHIP ==========
const shipGroup = new THREE.Group();
const hullMat = new THREE.MeshStandardMaterial({
    color: 0x00e5cc, emissive: 0x002218, transparent: true, opacity: 0.9, metalness: 0.8, roughness: 0.2
});

// ========== DYNAMIC BEZIER HULL ENGINE ==========
function buildLeviathanShip() {
    // v7.1: The ship is a collection of Cubic Bezier patches
    const plates = [];
    const segments = 16;
    
    for(let i=0; i<8; i++) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array((segments + 1) * (segments + 1) * 3);
        const indices = [];
        
        // Define Cubic Bezier control points for the hull plate
        const angle = (i / 8) * Math.PI * 2;
        const nextAngle = ((i + 1) / 8) * Math.PI * 2;
        
        for (let y = 0; segments >= y; y++) {
            for (let x = 0; segments >= x; x++) {
                const u = x / segments;
                const v = y / segments;
                
                // Bezier Interpolation: Surface Lofting
                const px = (Math.cos(angle)*(1-u) + Math.cos(nextAngle)*u) * (1.5 + Math.sin(v*Math.PI)*0.5);
                const py = (Math.sin(angle)*(1-u) + Math.sin(nextAngle)*u) * (0.5 + Math.sin(v*Math.PI)*0.2);
                const pz = (v - 0.5) * 6.0;
                
                const idx = (y * (segments + 1) + x) * 3;
                pos[idx] = px; pos[idx+1] = py; pos[idx+2] = pz;
            }
        }
        
        for (let y = 0; segments > y; y++) {
            for (let x = 0; segments > x; x++) {
                const a = y * (segments + 1) + x;
                const b = y * (segments + 1) + (x + 1);
                const c = (y + 1) * (segments + 1) + x;
                const d = (y + 1) * (segments + 1) + (x + 1);
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }
        
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        
        const plate = new THREE.Mesh(geo, hullMat);
        shipGroup.add(plate);
        plates.push(plate);
    }
    shipGroup.userData.plates = plates;
    scene.add(shipGroup);
}

// ========== HUD: TACTILE RESONANCE ==========
// ========== DIMENSIONAL KERNEL (v106) ==========
function getComplexTorsionAt(pos) {
    // Map 3D coordinate to Complex Plane Z = X + iY
    const real = pos.x * 0.1;
    const imag = pos.y * 0.1;
    const n = Math.floor(Math.abs(pos.z));
    
    // Check proximity to the 792 Ghost Singularities
    // (Simplified for real-time: using sin/cos of complex components)
    const drift = Math.sin(real) * Math.cos(imag);
    let torsion = 0.05 + Math.abs(drift) * 10.0;
    
    // Trigger Dimensional Resonance if near a ghost orbit
    const isGhostNear = Math.abs(drift) > 0.95;
    if(isGhostNear) torsion *= 50.0;
    
    return { torsion, real, imag, isGhostNear };
}

// ========== HUD: DIMENSIONAL TELEMETRY v7.2 ==========
function updateDimensionalHUD(speed, data, score) {
    const hud = document.getElementById('hud-top-left');
    const ts = new Date().toLocaleTimeString();
    hud.innerHTML = `
        <div style="color:#00ffcc; font-family:monospace; font-size:10px;">
            [${ts}] DIMENSIONAL_RUNNER_v7.2<br>
            COORD: ${data.real.toFixed(2)} + ${data.imag.toFixed(2)}i<br>
            <span style="color:${data.isGhostNear ? '#ff00ff' : '#ff8800'}">
                TORSION_FIELD: ${data.torsion.toFixed(2)}
            </span><br>
            DRIFT: ${data.isGhostNear ? 'GHOST_SINGULARITY_DETECTED' : 'STABLE_LANE'}<br>
            DISTANCE: ${score} u
        </div>
    `;
}

function animate() {
    requestAnimationFrame(animate);
    const dt = 0.016;

    // 1. DIMENSIONAL PHYSICS
    const data = getComplexTorsionAt(shipPos);
    
    // 2. TORSION SURFING (REACTIVE)
    if(data.isGhostNear) {
        shipVel.z -= 200.0 * dt; // Gravity well kick
        camera.fov = 100 + Math.sin(performance.now()*0.01)*10;
        camera.updateProjectionMatrix();
    }

    // 3. HULL DYNAMICS
    shipGroup.userData.plates.forEach((p, i) => {
        const flex = Math.sin(performance.now()*0.01 + i) * (data.torsion * 0.02);
        p.scale.set(1 + flex, 1 + flex, 1);
        // Shift color toward magenta (Ghost) or teal (Real)
        p.material.emissive.setHSL(data.isGhostNear ? 0.8 : 0.5, 1.0, 0.5);
    });

    // 4. CORE ENGINE
    const inputDir = new THREE.Vector3();
    if(keys['KeyW']) inputDir.z -= BASE_SPEED * (keys['ShiftLeft'] ? BOOST_MULT : 1);
    if(keys['KeyS']) inputDir.z += BASE_SPEED * 0.5;
    if(keys['KeyA']) inputDir.x -= BASE_SPEED * 0.6;
    if(keys['KeyD']) inputDir.x += BASE_SPEED * 0.6;

    shipVel.lerp(inputDir, 0.05);
    shipPos.add(shipVel.clone().multiplyScalar(dt));
    shipGroup.position.copy(shipPos);
    
    updateDimensionalHUD(shipVel.length(), data, Math.floor(Math.abs(shipPos.z)));
    renderer.render(scene, camera);
}

// Building the new ship and starting the engine...
buildLeviathanShip();
animate();
