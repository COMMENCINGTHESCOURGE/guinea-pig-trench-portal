import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('c');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;

window.addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// === THE IRIDESCENT VOID SPACE ===
// The background IS the substance. Structural color from viewing angle.
const bgUniforms = {uTime: {value:0}, uBanding: {value:18.0}};
const bgVert = `
  varying vec3 vWorldDir;
  void main(){
    vWorldDir = normalize((modelMatrix * vec4(position,1.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0);
  }`;
const bgFrag = `
  uniform float uTime;
  uniform float uBanding;
  varying vec3 vWorldDir;
  vec3 hue(float h){
    float x = 1.0 - abs(mod(h*6.0, 2.0) - 1.0);
    if(h<0.1667) return vec3(1.0,x,0.0);
    if(h<0.3333) return vec3(x,1.0,0.0);
    if(h<0.5000) return vec3(0.0,1.0,x);
    if(h<0.6667) return vec3(0.0,x,1.0);
    if(h<0.8333) return vec3(x,0.0,1.0);
    return vec3(1.0,0.0,x);
  }
  void main(){
    float phi = acos(clamp(vWorldDir.z,-1.0,1.0)) / 3.14159;
    float theta = (atan(vWorldDir.y, vWorldDir.x) / 6.28318 + 0.5);
    float phase = fract(phi * uBanding * 0.7 + theta * uBanding * 0.3 + uTime);
    vec3 col = hue(phase);
    float depth = 1.0 - phi * 0.5;
    // The Between is darker, more blue-shifted
    col = col * 0.35 * depth;
    col.b += 0.03;
    gl_FragColor = vec4(col, 1.0);
  }`;
const bgMat = new THREE.ShaderMaterial({vertexShader:bgVert, fragmentShader:bgFrag, uniforms:bgUniforms, side:THREE.BackSide});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(500,64,32), bgMat));

// === VOID ENTITIES — the holes ===
// Each entity is pure darkness with edge bleed. You see them by what they remove.
const voidFrag = `
  uniform float uVoidDepth;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main(){
    float vDot = max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
    float edge = pow(1.0 - vDot, 4.0);
    float bleedH = fract(vDot * 8.0 + uTime * 0.3);
    float bx = 1.0 - abs(mod(bleedH*6.0, 2.0) - 1.0);
    vec3 bleed;
    if(bleedH<0.1667) bleed = vec3(1.0,bx,0.0);
    else if(bleedH<0.3333) bleed = vec3(bx,1.0,0.0);
    else if(bleedH<0.5) bleed = vec3(0.0,1.0,bx);
    else if(bleedH<0.6667) bleed = vec3(0.0,bx,1.0);
    else if(bleedH<0.8333) bleed = vec3(bx,0.0,1.0);
    else bleed = vec3(1.0,0.0,bx);
    vec3 col = bleed * edge * (1.0 - uVoidDepth) * 1.5;
    float alpha = mix(edge * 0.3, 1.0, uVoidDepth);
    gl_FragColor = vec4(col, alpha);
  }`;
const voidVert = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

// Ghost wireframe shader
const wireFrag = `
  uniform float uTime;
  uniform float uBanding;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main(){
    float vDot = dot(normalize(vNormal), normalize(vViewDir));
    float phase = fract(vDot * uBanding + uTime);
    float h = phase;
    float x = 1.0 - abs(mod(h*6.0, 2.0) - 1.0);
    vec3 col;
    if(h<0.1667) col = vec3(1.0,x,0.0);
    else if(h<0.3333) col = vec3(x,1.0,0.0);
    else if(h<0.5) col = vec3(0.0,1.0,x);
    else if(h<0.6667) col = vec3(0.0,x,1.0);
    else if(h<0.8333) col = vec3(x,0.0,1.0);
    else col = vec3(1.0,0.0,x);
    gl_FragColor = vec4(col, 0.12);
  }`;

// Spawn void entities — different geometries, all rendered as absence
const VOID_SHAPES = [
  () => new THREE.IcosahedronGeometry(1, 2),
  () => new THREE.TorusGeometry(0.8, 0.3, 16, 32),
  () => new THREE.OctahedronGeometry(1, 1),
  () => new THREE.TorusKnotGeometry(0.6, 0.2, 64, 16),
  () => new THREE.DodecahedronGeometry(0.9, 1),
  () => new THREE.TetrahedronGeometry(1.1, 2),
];

const entities = [];
for(let i = 0; i < 24; i++){
  const geo = VOID_SHAPES[i % VOID_SHAPES.length]();
  const scale = 1 + Math.random() * 3;
  const entityUniforms = {
    uVoidDepth: {value: 0.85 + Math.random() * 0.1},
    uTime: bgUniforms.uTime
  };
  const wireUniforms = {
    uTime: bgUniforms.uTime,
    uBanding: {value: 12 + Math.random() * 20}
  };

  const voidMesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: voidVert, fragmentShader: voidFrag,
    uniforms: entityUniforms, transparent: true
  }));
  const wireMesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: voidVert, fragmentShader: wireFrag,
    uniforms: wireUniforms, transparent: true, wireframe: true
  }));

  const group = new THREE.Group();
  group.add(voidMesh);
  group.add(wireMesh);

  // Random position in a sphere
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 30 + Math.random() * 150;
  group.position.set(
    Math.sin(phi)*Math.cos(theta)*r,
    Math.sin(phi)*Math.sin(theta)*r,
    Math.cos(phi)*r
  );
  group.scale.setScalar(scale);

  // Float behavior
  group.userData = {
    rotSpeed: new THREE.Vector3(
      (Math.random()-0.5)*0.01,
      (Math.random()-0.5)*0.01,
      (Math.random()-0.5)*0.01
    ),
    driftDir: new THREE.Vector3(
      (Math.random()-0.5)*0.05,
      (Math.random()-0.5)*0.05,
      (Math.random()-0.5)*0.05
    ),
    bobPhase: Math.random() * Math.PI * 2,
    bobSpeed: 0.3 + Math.random() * 0.5,
  };

  scene.add(group);
  entities.push(group);
}

// Stars — neutral white anchors in the iridescent void
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(5000 * 3);
for(let i = 0; i < 5000; i++){
  starPos[i*3] = (Math.random()-0.5) * 800;
  starPos[i*3+1] = (Math.random()-0.5) * 800;
  starPos[i*3+2] = (Math.random()-0.5) * 800;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
  color: 0xffffff, size: 0.3, transparent: true, opacity: 0.4
})));

// === PLAYER ===
const player = {x:0, y:0, z:0, yaw:0, pitch:0};
const vel = new THREE.Vector3();
const keys = {};
let started = false, locked = false;
let voidsFound = 0;

window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', e => {
  if(!locked || !started) return;
  player.yaw -= e.movementX * 0.002;
  player.pitch -= e.movementY * 0.002;
  player.pitch = Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, player.pitch));
});
canvas.addEventListener('click', () => {
  if(started && !locked) canvas.requestPointerLock();
});

window.enterBetween = function(){
  started = true;
  document.getElementById('start').style.display = 'none';
  canvas.requestPointerLock();
};

// === GAME LOOP ===
let lastT = 0;
function loop(t){
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastT)/1000, 0.05);
  lastT = t;
  if(!started){ renderer.render(scene, camera); return; }

  bgUniforms.uTime.value += dt * 0.03;

  // Movement — float through the void
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(q);
  const right = new THREE.Vector3(1,0,0).applyQuaternion(q);
  const up = new THREE.Vector3(0,1,0).applyQuaternion(q);

  const spd = keys['ShiftLeft'] ? 40 : 15;
  const input = new THREE.Vector3();
  if(keys['KeyW']) input.add(fwd.clone().multiplyScalar(spd));
  if(keys['KeyS']) input.add(fwd.clone().multiplyScalar(-spd*0.5));
  if(keys['KeyA']) input.add(right.clone().multiplyScalar(-spd*0.6));
  if(keys['KeyD']) input.add(right.clone().multiplyScalar(spd*0.6));
  if(keys['Space']) input.add(up.clone().multiplyScalar(spd*0.5));
  if(keys['ControlLeft']) input.add(up.clone().multiplyScalar(-spd*0.5));

  // Drift — always moving slowly, even without input
  if(input.length() < 0.5) input.add(fwd.clone().multiplyScalar(3));

  vel.lerp(input, 0.04);
  player.x += vel.x * dt;
  player.y += vel.y * dt;
  player.z += vel.z * dt;

  camera.position.set(player.x, player.y, player.z);
  camera.quaternion.copy(q);

  // Animate void entities
  let nearestDist = Infinity;
  for(const e of entities){
    // Rotate
    e.rotation.x += e.userData.rotSpeed.x;
    e.rotation.y += e.userData.rotSpeed.y;
    e.rotation.z += e.userData.rotSpeed.z;
    // Bob
    e.position.y += Math.sin(t * 0.001 * e.userData.bobSpeed + e.userData.bobPhase) * 0.01;
    // Drift
    e.position.add(e.userData.driftDir.clone().multiplyScalar(dt));

    const dist = camera.position.distanceTo(e.position);
    if(dist < nearestDist) nearestDist = dist;

    // Proximity detection — "finding the absence"
    if(dist < e.scale.x * 3){
      // You're close to a void entity
      voidsFound++;
      document.getElementById('void-count').textContent = `voids: ${voidsFound}`;

      // Respawn it far away
      const theta2 = Math.random() * Math.PI * 2;
      const phi2 = Math.acos(2*Math.random()-1);
      const r2 = 80 + Math.random() * 150;
      e.position.set(
        player.x + Math.sin(phi2)*Math.cos(theta2)*r2,
        player.y + Math.sin(phi2)*Math.sin(theta2)*r2,
        player.z + Math.cos(phi2)*r2
      );
    }
  }

  // Update lore based on proximity
  const loreEl = document.getElementById('lore');
  if(nearestDist < 20) loreEl.textContent = 'you can feel it. the absence is close.';
  else if(nearestDist < 50) loreEl.textContent = 'something is missing here.';
  else if(nearestDist < 100) loreEl.textContent = 'the color shifts. a void is near.';
  else loreEl.textContent = 'find the absence.';

  // Density readout
  if(Math.floor(t) % 30 === 0){
    document.getElementById('density').textContent = `density: ${Math.max(0, 100 - voidsFound * 4)}%`;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);