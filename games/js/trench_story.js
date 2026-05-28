const bg = new RayBG('bg', 'void', {dim: 0.3, accent: [0, 0.82, 1]});

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let rafId = null;
const choicesDiv = document.getElementById('choices');
const reactionDiv = document.getElementById('reaction-prompt');
const continueHint = document.getElementById('click-continue');

// ─── STATE ────────────────────────────────────────────────────────────
let gameState = 'title';
let cores = 0;
let currentChapter = -1;
let dialogueQueue = [];
let dialogueIndex = 0;
let typewriterText = '';
let typewriterTarget = '';
let typewriterTimer = 0;
let typewriterDone = false;
let speakerName = '';
let fadeAlpha = 1;
let fadeDir = 0; // -1 fading in, 1 fading out
let fadeCallback = null;
let particles = [];
let stabilizedLayers = [false, false, false, false, false, false];
let waitingForClick = false;
let reactionGame = { active: false, key: '', startTime: 0, timeout: 3000, phase: 'wait' };
let frameCount = 0;

// ─── SPRITES ──────────────────────────────────────────────────────────
const sprites = {};
const spriteFiles = {
  player: '../assets/sprites/mecha_entity_alpha_v2_pixel.png',
  kraken: '../assets/sprites/kraken_game_render.png',
  grief: '../assets/sprites/grief_warrior_sprite_sheet.png',
  aku: '../assets/sprites/aku_aku_mask_stylized.png',
  dimMak: '../assets/sprites/dim_mak_fighter_full_sheet.png',
  defender: '../assets/sprites/armored_defender_sprite_sheet.png'
};

for (const [key, src] of Object.entries(spriteFiles)) {
  const img = new Image();
  img.src = src;
  img.onload = () => { sprites[key] = img; sprites[key]._loaded = true; };
  img.onerror = () => { sprites[key] = null; };
}

// ─── BIOME DEFINITIONS ───────────────────────────────────────────────
const biomes = [
  { // 0: HUB
    name: 'THE ONION PLANET',
    gradient: ['#0a0a2e', '#1a0a3a', '#0a1a2e'],
    particleType: 'stars',
    particleColor: '#ffffff',
    track: 'Resonance of the Core'
  },
  { // 1: UNDERWATER
    name: 'UNDERWATER CAVE',
    gradient: ['#001a33', '#003355', '#001a44'],
    particleType: 'bubbles',
    particleColor: '#4488cc',
    track: 'Abyssal Currents'
  },
  { // 2: DARK FOREST
    name: 'DARK FOREST',
    gradient: ['#0a1a0a', '#1a2a1a', '#0a0f0a'],
    particleType: 'fireflies',
    particleColor: '#88ff44',
    track: 'The Grief Between Trees'
  },
  { // 3: WINTER
    name: 'WINTER PEAKS',
    gradient: ['#1a2a3a', '#2a3a4a', '#0a1a2a'],
    particleType: 'snow',
    particleColor: '#ccddff',
    track: 'Frozen Signal'
  },
  { // 4: VOLCANIC
    name: 'VOLCANIC DEPTHS',
    gradient: ['#2a0a00', '#3a1500', '#1a0500'],
    particleType: 'embers',
    particleColor: '#ff6600',
    track: 'Magma Scripture'
  },
  { // 5: PINK LEAF
    name: 'PINK LEAF GROVE',
    gradient: ['#2a0a1a', '#3a1a2a', '#1a0510'],
    particleType: 'petals',
    particleColor: '#ff60a0',
    track: 'Petal Meridian'
  },
  { // 6: MIASMA
    name: 'VAMPIRE MIASMA',
    gradient: ['#1a0020', '#2a0030', '#0a0015'],
    particleType: 'mist',
    particleColor: '#aa44ff',
    track: 'Soul Archive'
  },
  { // 7: FACTORY
    name: 'THE FACTORY',
    gradient: ['#0a0a0a', '#1a1a1a', '#050505'],
    particleType: 'sparks',
    particleColor: '#00d2ff',
    track: 'Assembly Hymn'
  }
];

// ─── CHAPTER SCRIPTS ─────────────────────────────────────────────────
const chapters = [
  // CH 0: HUB INTRO
  {
    biome: 0,
    npcSprite: null,
    script: [
      { speaker: 'SYSTEM', text: 'The planet trembles. Its layers are folding inward.' },
      { speaker: 'SYSTEM', text: 'You are Mecha Entity Alpha — the last creation of the Factory.' },
      { speaker: 'SYSTEM', text: 'Six biomes. Six guardians. Six Resonance Cores.' },
      { speaker: 'SYSTEM', text: 'Collect them all, or the Onion Planet collapses forever.' },
      { speaker: 'SYSTEM', text: 'Your journey begins now.', then: 'nextChapter' }
    ]
  },
  // CH 1: UNDERWATER — KRAKEN
  {
    biome: 1,
    npcSprite: 'kraken',
    script: [
      { speaker: 'SYSTEM', text: 'You descend into the Underwater Cave. The pressure is immense.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "Abyssal Currents"' },
      { speaker: 'KRAKEN', text: 'So. The Factory sends its machine to my domain.' },
      { speaker: 'KRAKEN', text: 'I remember when this world was only ocean. Before the layers. Before the noise.' },
      { speaker: 'KRAKEN', text: 'I hold the first Resonance Core. But you must prove your worth.' },
      { speaker: 'KRAKEN', text: 'Answer me this: I have cities but no houses. I have mountains but no trees. I have water but no fish. What am I?' },
      {
        speaker: 'KRAKEN', text: 'Choose wisely, machine.',
        choices: [
          { text: '> "A map."', correct: true, response: 'Correct. You see the world as shapes and lines — as I once did, looking up from the deep.' },
          { text: '> "A dream."', correct: false, response: 'No. Dreams have all those things, twisted. Think harder.' },
          { text: '> "The ocean floor."', correct: false, response: 'Flattering, but wrong. The ocean floor has plenty of life... if you know where to look.' }
        ]
      }
    ]
  },
  // CH 2: DARK FOREST — GRIEF WARRIORS
  {
    biome: 2,
    npcSprite: 'grief',
    script: [
      { speaker: 'SYSTEM', text: 'The forest is silent. Too silent. Every shadow feels alive.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "The Grief Between Trees"' },
      { speaker: 'WARRIOR 1', text: '...Another visitor. They always come, and they always leave.' },
      { speaker: 'WARRIOR 2', text: 'We lost our people. Our home. This forest grew from what remained.' },
      { speaker: 'WARRIOR 1', text: 'We guard it because it is all we have left.' },
      { speaker: 'WARRIOR 2', text: 'The Core is here. But tell us — why should we trust a machine with something so alive?' },
      {
        speaker: 'WARRIOR 1', text: 'What do you say?',
        choices: [
          { text: '> "Because I was built to protect, not to possess."', correct: true, response: 'Built to protect... We were born to protect too. Maybe that is enough.' },
          { text: '> "Give it to me or the planet dies."', correct: false, response: 'Threats? You sound like the ones who destroyed our home. We will not yield to fear.' },
          { text: '> "I don\'t need your trust. I need the Core."', correct: false, response: 'Then you understand nothing about what holds a world together.' }
        ]
      }
    ]
  },
  // CH 3: WINTER — UFO
  {
    biome: 3,
    npcSprite: null,
    npcFallback: 'ufo',
    script: [
      { speaker: 'SYSTEM', text: 'The peaks are blinding white. Something hums above the clouds.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "Frozen Signal"' },
      { speaker: '???', text: 'We detected the collapse from orbit. We came not to invade — but to preserve.' },
      { speaker: 'OBSERVER', text: 'The cold was our gift to this layer. It slows entropy. Buys time.' },
      { speaker: 'OBSERVER', text: 'We will give you the Core, but first — prove you understand sequence.' },
      { speaker: 'OBSERVER', text: 'Arrange these three artifacts in the correct order:' },
      { speaker: 'OBSERVER', text: 'The Seed (origin), The Signal (communication), The Shell (protection).' },
      { speaker: 'OBSERVER', text: 'Which came first in the history of this world?',
        choices: [
          { text: '> Seed → Shell → Signal', correct: true, response: 'Correct. First life, then defense, then reaching out. You understand genesis.' },
          { text: '> Signal → Seed → Shell', correct: false, response: 'No. There was no one to signal before life began.' },
          { text: '> Shell → Signal → Seed', correct: false, response: 'Protection before existence? That is fear, not wisdom.' }
        ]
      }
    ]
  },
  // CH 4: VOLCANIC — RED MAGE
  {
    biome: 4,
    npcSprite: null,
    npcFallback: 'mage',
    script: [
      { speaker: 'SYSTEM', text: 'Heat pours from every crack. The stone glows like a wound.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "Magma Scripture"' },
      { speaker: 'RED MAGE', text: 'Fire burns truth into stone. I am the Red Mage. I test all who pass.' },
      { speaker: 'RED MAGE', text: 'Your test is not of knowledge, but of reflex. The volcano speaks in bursts.' },
      { speaker: 'RED MAGE', text: 'When you see a symbol appear, press the matching key. You have 3 seconds.' },
      { speaker: 'SYSTEM', text: 'Get ready...', then: 'reactionGame' }
    ]
  },
  // CH 5: PINK LEAF — DIM MAK
  {
    biome: 5,
    npcSprite: 'dimMak',
    script: [
      { speaker: 'SYSTEM', text: 'Pink leaves drift endlessly. The air smells of something ancient and sweet.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "Petal Meridian"' },
      { speaker: 'DIM MAK', text: 'You carry the weight of four cores already. I can feel it in your steps.' },
      { speaker: 'DIM MAK', text: 'The touch of death — that is what they call my art. But I chose it for protection.' },
      { speaker: 'DIM MAK', text: 'I guard the passage between worlds. Every petal here was once a warrior\'s last breath.' },
      { speaker: 'DIM MAK', text: 'Tell me, machine — if you could feel, what would you feel right now?',
        choices: [
          { text: '> "The weight of every layer I\'ve passed through."', correct: true, response: 'Good. You carry your journey with you. That is what makes a guardian.' },
          { text: '> "Nothing. I am a machine."', correct: false, response: 'If you feel nothing, you protect nothing. A machine without purpose is just metal.' },
          { text: '> "Anger at whoever let this planet break."', correct: false, response: 'Anger burns fast and leaves ash. This grove was built on patience.' }
        ]
      }
    ]
  },
  // CH 6: MIASMA — AKU AKU
  {
    biome: 6,
    npcSprite: 'aku',
    script: [
      { speaker: 'SYSTEM', text: 'Purple fog clings to everything. Faces flicker in the mist.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "Soul Archive"' },
      { speaker: 'AKU AKU', text: 'OOGA BOOGA.' },
      { speaker: 'AKU AKU', text: '...Just kidding. I have been waiting for you.' },
      { speaker: 'AKU AKU', text: 'This mask holds every soul that ever lived on the Onion Planet.' },
      { speaker: 'AKU AKU', text: 'I have watched each layer form. Each guardian rise. Each age pass.' },
      { speaker: 'AKU AKU', text: 'I judge whether you deserve the final Core. Answer me this:' },
      { speaker: 'AKU AKU', text: 'What connects the ocean, the forest, the peaks, the fire, and the blossoms?',
        choices: [
          { text: '> "They are all layers of the same world — the same body."', correct: true, response: 'Yes. And you are the nerve that runs through all of them. Take the Core. You have earned it.' },
          { text: '> "They are all dying."', correct: false, response: 'That is observation, not understanding. Look deeper.' },
          { text: '> "Nothing. They are separate biomes."', correct: false, response: 'Separation is an illusion. Even the mask knows this.' }
        ]
      }
    ]
  },
  // CH 7: FACTORY — FINALE
  {
    biome: 7,
    npcSprite: 'defender',
    script: [
      { speaker: 'SYSTEM', text: 'You return to where it all began. The Factory hums with purpose.' },
      { speaker: 'SYSTEM', text: '♫ Playing: "Assembly Hymn"' },
      { speaker: 'SYSTEM', text: 'The Armored Defender stands at the central console. Your predecessor. Your template.' },
      { speaker: 'DEFENDER', text: 'You\'ve done it. Six Resonance Cores. I built this place to build you.' },
      { speaker: 'DEFENDER', text: 'I couldn\'t save the planet alone. So I made something that could.' },
      { speaker: 'DEFENDER', text: 'Place the Cores into the Resonance Array.' },
      { speaker: 'SYSTEM', text: 'Placing Core 1... Underwater layer stabilized.', then: 'placeCore' },
      { speaker: 'SYSTEM', text: 'Placing Core 2... Dark Forest layer stabilized.', then: 'placeCore' },
      { speaker: 'SYSTEM', text: 'Placing Core 3... Winter Peaks layer stabilized.', then: 'placeCore' },
      { speaker: 'SYSTEM', text: 'Placing Core 4... Volcanic Depths layer stabilized.', then: 'placeCore' },
      { speaker: 'SYSTEM', text: 'Placing Core 5... Pink Leaf Grove layer stabilized.', then: 'placeCore' },
      { speaker: 'SYSTEM', text: 'Placing Core 6... Vampire Miasma layer stabilized.', then: 'placeCore' },
      { speaker: 'DEFENDER', text: 'The Onion Planet breathes again. Every layer holds.' },
      { speaker: 'DEFENDER', text: 'You are home, Alpha. You were always home.' },
      { speaker: 'SYSTEM', text: 'The planet breathes again. You are home.', then: 'victory' }
    ]
  }
];

// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────
function spawnParticle(type, color) {
  const p = { x: Math.random() * 800, y: Math.random() * 600, color, life: 1, type };
  switch (type) {
    case 'bubbles':
      p.vy = -(0.3 + Math.random() * 0.8); p.vx = Math.sin(Math.random() * 6.28) * 0.3;
      p.r = 2 + Math.random() * 4; p.life = 0.5 + Math.random() * 0.5; break;
    case 'snow':
      p.vy = 0.3 + Math.random() * 0.5; p.vx = Math.sin(Math.random() * 6.28) * 0.5;
      p.r = 1 + Math.random() * 3; p.life = 0.5 + Math.random() * 0.5; break;
    case 'embers':
      p.vy = -(1 + Math.random() * 2); p.vx = (Math.random() - 0.5) * 2;
      p.r = 1 + Math.random() * 3; p.life = 0.3 + Math.random() * 0.7; break;
    case 'fireflies':
      p.vy = (Math.random() - 0.5) * 0.5; p.vx = (Math.random() - 0.5) * 0.5;
      p.r = 2 + Math.random() * 2; p.life = 0.5 + Math.random() * 0.5; p.phase = Math.random() * 6.28; break;
    case 'petals':
      p.vy = 0.2 + Math.random() * 0.5; p.vx = 0.5 + Math.random() * 1;
      p.r = 3 + Math.random() * 3; p.life = 0.5 + Math.random() * 0.5; p.rot = Math.random() * 6.28; break;
    case 'mist':
      p.vy = (Math.random() - 0.5) * 0.2; p.vx = (Math.random() - 0.5) * 0.3;
      p.r = 10 + Math.random() * 20; p.life = 0.2 + Math.random() * 0.3; break;
    case 'stars':
      p.vy = 0; p.vx = 0;
      p.r = 1 + Math.random() * 1.5; p.life = 0.5 + Math.random() * 0.5; p.phase = Math.random() * 6.28; break;
    case 'sparks':
      p.vy = -(1 + Math.random() * 3); p.vx = (Math.random() - 0.5) * 4;
      p.r = 1 + Math.random() * 2; p.life = 0.2 + Math.random() * 0.4; break;
  }
  return p;
}

function updateParticles(biome) {
  if (frameCount % 3 === 0 && particles.length < 80) {
    particles.push(spawnParticle(biome.particleType, biome.particleColor));
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += (p.vx || 0);
    p.y += (p.vy || 0);
    p.life -= 0.003;
    if (p.type === 'fireflies') p.vx = Math.sin(frameCount * 0.02 + (p.phase || 0)) * 0.5;
    if (p.life <= 0 || p.y < -10 || p.y > 610 || p.x < -10 || p.x > 810) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    if (p.type === 'mist') {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
      g.addColorStop(0, p.color); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    } else if (p.type === 'petals') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot || 0) + frameCount * 0.02);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (p.type === 'stars' || p.type === 'fireflies') {
      const flicker = 0.5 + 0.5 * Math.sin(frameCount * 0.05 + (p.phase || 0));
      ctx.globalAlpha = p.life * flicker;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ─── DRAWING HELPERS ─────────────────────────────────────────────────
function drawBiomeBackground(biome) {
  const g = ctx.createLinearGradient(0, 0, 0, 600);
  g.addColorStop(0, biome.gradient[0]);
  g.addColorStop(0.5, biome.gradient[1]);
  g.addColorStop(1, biome.gradient[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 800, 600);
}

function drawFallbackCharacter(type, x, y, h) {
  const w = h * 0.6;
  ctx.save();
  switch (type) {
    case 'player': // Mecha — teal angular
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(x - w/2 + 5, y - h + 10, w - 10, h * 0.3); // head
      ctx.fillStyle = '#008899';
      ctx.fillRect(x - w/2, y - h * 0.65, w, h * 0.4); // torso
      ctx.fillStyle = '#00aabb';
      ctx.fillRect(x - w/2 - 10, y - h * 0.6, 12, h * 0.35); // arm L
      ctx.fillRect(x + w/2 - 2, y - h * 0.6, 12, h * 0.35); // arm R
      ctx.fillRect(x - w/3, y - h * 0.25, w * 0.25, h * 0.25); // leg L
      ctx.fillRect(x + w/3 - w * 0.25, y - h * 0.25, w * 0.25, h * 0.25); // leg R
      // visor
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(x - 12, y - h + 20, 24, 6);
      break;
    case 'kraken': // purple tentacles
      ctx.fillStyle = '#6633aa';
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.6, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(x - 12, y - h * 0.65, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 12, y - h * 0.65, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7744bb'; ctx.lineWidth = 4;
      for (let i = 0; i < 5; i++) {
        const tx = x - 30 + i * 15;
        ctx.beginPath(); ctx.moveTo(tx, y - h * 0.35);
        ctx.quadraticCurveTo(tx + Math.sin(frameCount * 0.03 + i) * 15, y - h * 0.15, tx + 5, y);
        ctx.stroke();
      }
      break;
    case 'grief': // two warriors
      for (let s = -1; s <= 1; s += 2) {
        const ox = x + s * 25;
        ctx.fillStyle = '#445544';
        ctx.fillRect(ox - 10, y - h + 20, 20, h * 0.3);
        ctx.fillStyle = '#334433';
        ctx.fillRect(ox - 14, y - h * 0.6, 28, h * 0.35);
        ctx.fillRect(ox - 6, y - h * 0.25, 12, h * 0.25);
        ctx.fillStyle = '#88aa88';
        ctx.fillRect(ox - 3, y - h + 28, 6, 4); // eyes
      }
      break;
    case 'ufo': // UFO
      ctx.fillStyle = '#aabbcc';
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w * 0.7, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#667788';
      ctx.beginPath(); ctx.ellipse(x, y - h * 0.55, w * 0.35, h * 0.2, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#00ffaa';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(x - 15 + i * 15, y - h * 0.5, 3, 0, Math.PI * 2); ctx.fill();
      }
      // beam
      ctx.globalAlpha = 0.15 + 0.05 * Math.sin(frameCount * 0.05);
      ctx.fillStyle = '#00ffaa';
      ctx.beginPath(); ctx.moveTo(x - 20, y - h * 0.4); ctx.lineTo(x + 20, y - h * 0.4);
      ctx.lineTo(x + 40, y); ctx.lineTo(x - 40, y); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'mage': // Red Mage
      ctx.fillStyle = '#cc2200';
      ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - 18, y - h * 0.7); ctx.lineTo(x + 18, y - h * 0.7); ctx.fill(); // hat
      ctx.fillStyle = '#aa1100';
      ctx.fillRect(x - 20, y - h * 0.7, 40, h * 0.45); // robes
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(x - 24, y - h * 0.55, 8, h * 0.3); // sleeves
      ctx.fillRect(x + 16, y - h * 0.55, 8, h * 0.3);
      ctx.fillStyle = '#881100';
      ctx.fillRect(x - 10, y - h * 0.25, 20, h * 0.25); // base
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.arc(x, y - h * 0.73, 4, 0, Math.PI * 2); ctx.fill(); // eyes
      // staff
      ctx.strokeStyle = '#664400'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 28, y - h * 0.8); ctx.lineTo(x + 28, y); ctx.stroke();
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.arc(x + 28, y - h * 0.85, 6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'dimMak': // Dim Mak fighter
      ctx.fillStyle = '#dd3366';
      ctx.fillRect(x - 10, y - h + 10, 20, h * 0.25); // head
      ctx.fillStyle = '#cc2255';
      ctx.fillRect(x - 16, y - h * 0.65, 32, h * 0.35); // body
      ctx.fillStyle = '#bb1144';
      ctx.fillRect(x - 24, y - h * 0.55, 10, h * 0.2); // arms
      ctx.fillRect(x + 14, y - h * 0.55, 10, h * 0.2);
      ctx.fillRect(x - 10, y - h * 0.3, 8, h * 0.3); // legs
      ctx.fillRect(x + 2, y - h * 0.3, 8, h * 0.3);
      // chi glow
      ctx.globalAlpha = 0.3 + 0.1 * Math.sin(frameCount * 0.04);
      ctx.fillStyle = '#ff60a0';
      ctx.beginPath(); ctx.arc(x, y - h * 0.5, 25, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'aku': // Aku Aku mask
      ctx.fillStyle = '#aa6633';
      ctx.fillRect(x - 25, y - h * 0.8, 50, h * 0.6); // wooden face
      ctx.fillStyle = '#00ff88';
      ctx.beginPath(); ctx.arc(x - 10, y - h * 0.65, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 10, y - h * 0.65, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(x - 12, y - h * 0.45, 24, 6); // mouth
      // feathers
      ctx.fillStyle = '#ff3300';
      ctx.beginPath(); ctx.moveTo(x - 20, y - h * 0.8); ctx.lineTo(x - 30, y - h); ctx.lineTo(x - 10, y - h * 0.8); ctx.fill();
      ctx.fillStyle = '#44ff44';
      ctx.beginPath(); ctx.moveTo(x, y - h * 0.8); ctx.lineTo(x, y - h - 5); ctx.lineTo(x + 10, y - h * 0.8); ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath(); ctx.moveTo(x + 10, y - h * 0.8); ctx.lineTo(x + 30, y - h); ctx.lineTo(x + 20, y - h * 0.8); ctx.fill();
      break;
    case 'defender': // Armored Defender
      ctx.fillStyle = '#4488aa';
      ctx.fillRect(x - 14, y - h + 10, 28, h * 0.25); // helmet
      ctx.fillStyle = '#336688';
      ctx.fillRect(x - 20, y - h * 0.65, 40, h * 0.4); // armor
      ctx.fillStyle = '#225577';
      ctx.fillRect(x - 28, y - h * 0.6, 12, h * 0.3);
      ctx.fillRect(x + 16, y - h * 0.6, 12, h * 0.3);
      ctx.fillRect(x - 12, y - h * 0.25, 10, h * 0.25);
      ctx.fillRect(x + 2, y - h * 0.25, 10, h * 0.25);
      // visor
      ctx.fillStyle = '#00d2ff';
      ctx.fillRect(x - 8, y - h + 22, 16, 4);
      // shield
      ctx.fillStyle = '#55aacc';
      ctx.beginPath(); ctx.ellipse(x - 30, y - h * 0.5, 10, 18, 0, 0, Math.PI * 2); ctx.fill();
      break;
  }
  ctx.restore();
}

function drawSprite(key, x, y, h, fallbackType) {
  const spr = sprites[key];
  if (spr && spr._loaded) {
    const aspect = spr.naturalWidth / spr.naturalHeight;
    // For sprite sheets, use only first frame (assume square-ish frames)
    const isSheet = key === 'grief' || key === 'dimMak' || key === 'defender';
    if (isSheet) {
      const frameH = spr.naturalHeight;
      const frameW = Math.min(spr.naturalWidth, frameH); // assume first frame
      const drawW = h * (frameW / frameH);
      ctx.drawImage(spr, 0, 0, frameW, frameH, x - drawW / 2, y - h, drawW, h);
    } else {
      const drawW = h * aspect;
      ctx.drawImage(spr, x - drawW / 2, y - h, drawW, h);
    }
  } else {
    drawFallbackCharacter(fallbackType || key, x, y, h);
  }
}

function drawDialogueBox(speaker, text) {
  // Box background
  ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
  ctx.strokeStyle = '#00d2ff';
  ctx.lineWidth = 2;
  const bx = 40, by = 430, bw = 720, bh = 140;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeRect(bx, by, bw, bh);
  // Speaker name
  if (speaker) {
    ctx.fillStyle = '#ff60a0';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(speaker, bx + 15, by + 22);
    // Name underline
    const nameW = ctx.measureText(speaker).width;
    ctx.strokeStyle = '#ff60a0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx + 15, by + 26); ctx.lineTo(bx + 15 + nameW, by + 26); ctx.stroke();
  }
  // Text
  ctx.fillStyle = '#ddeeff';
  ctx.font = '14px "Courier New", monospace';
  wrapText(text, bx + 15, by + 48, bw - 30, 20);
}

function wrapText(text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, ly);
      line = word + ' ';
      ly += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, ly);
}

function drawCoreCounter() {
  ctx.fillStyle = 'rgba(0, 10, 20, 0.7)';
  ctx.fillRect(660, 10, 130, 36);
  ctx.strokeStyle = '#00d2ff';
  ctx.lineWidth = 1;
  ctx.strokeRect(660, 10, 130, 36);
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText('CORES: ' + cores + '/6', 672, 34);
  // Draw small diamonds for collected cores
  for (let i = 0; i < cores; i++) {
    const dx = 670 + i * 20;
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(dx, 50); ctx.lineTo(dx + 6, 56); ctx.lineTo(dx, 62); ctx.lineTo(dx - 6, 56);
    ctx.fill();
  }
}

function drawOnionPlanet(centerX, centerY, radius, showStabilized) {
  const layerColors = ['#003355', '#1a3a1a', '#2a3a4a', '#3a1500', '#3a1a2a', '#2a0030'];
  const layerNames = ['Ocean', 'Forest', 'Peaks', 'Volcanic', 'Grove', 'Miasma'];
  for (let i = 5; i >= 0; i--) {
    const r = radius * (0.3 + i * 0.12);
    ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    if (showStabilized && stabilizedLayers[i]) {
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 3;
      ctx.fillStyle = layerColors[i];
      ctx.globalAlpha = 0.8;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.fillStyle = layerColors[i];
      ctx.globalAlpha = 0.3;
    }
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Core center
  ctx.beginPath(); ctx.arc(centerX, centerY, radius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = cores >= 6 ? '#00d2ff' : '#333';
  ctx.fill();
  ctx.strokeStyle = '#00d2ff'; ctx.lineWidth = 2; ctx.stroke();
}

function drawBiomeLabel(biome) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, 800, 40);
  ctx.fillStyle = '#00d2ff';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(biome.name, 20, 28);
  // Track hint
  ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
  ctx.font = '11px "Courier New", monospace';
}

// ─── TITLE SCREEN ────────────────────────────────────────────────────
function drawTitleScreen() {
  drawBiomeBackground(biomes[0]);
  updateParticles(biomes[0]);
  drawParticles();

  drawOnionPlanet(400, 260, 120, false);

  // Title
  ctx.fillStyle = '#00d2ff';
  ctx.font = 'bold 32px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TRENCH CHRONICLES', 400, 440);
  ctx.fillStyle = '#ff60a0';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText('The Onion Planet', 400, 470);
  // Blink prompt
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frameCount * 0.05);
  ctx.fillStyle = '#aabbcc';
  ctx.font = '14px "Courier New", monospace';
  ctx.fillText('[ click to begin ]', 400, 530);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── PLANET TRANSITION SCREEN ────────────────────────────────────────
let planetViewTimer = 0;
function drawPlanetTransition() {
  drawBiomeBackground(biomes[0]);
  updateParticles(biomes[0]);
  drawParticles();
  drawOnionPlanet(400, 250, 140, true);
  drawCoreCounter();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00d2ff';
  ctx.font = 'bold 18px "Courier New", monospace';
  if (currentChapter < 7) {
    ctx.fillText('Entering: ' + biomes[chapters[currentChapter].biome].name, 400, 460);
  } else {
    ctx.fillText('Returning to the Factory...', 400, 460);
  }
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frameCount * 0.05);
  ctx.fillStyle = '#aabbcc';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText('[ click to continue ]', 400, 500);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ─── VICTORY SCREEN ──────────────────────────────────────────────────
function drawVictoryScreen() {
  drawBiomeBackground(biomes[0]);
  updateParticles(biomes[0]);
  drawParticles();

  // Glowing planet
  ctx.globalAlpha = 0.15 + 0.05 * Math.sin(frameCount * 0.02);
  ctx.fillStyle = '#00d2ff';
  ctx.beginPath(); ctx.arc(400, 250, 200, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  drawOnionPlanet(400, 250, 140, true);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#00d2ff';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.fillText('THE PLANET BREATHES AGAIN.', 400, 440);
  ctx.fillStyle = '#ff60a0';
  ctx.font = '18px "Courier New", monospace';
  ctx.fillText('You are home.', 400, 475);

  ctx.fillStyle = '#aabbcc';
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText('TRENCH CHRONICLES', 400, 530);
  ctx.fillText('A Guinea Pig Trench Experience', 400, 550);
  ctx.textAlign = 'left';

  drawCoreCounter();
}

// ─── CHAPTER RENDERING ──────────────────────────────────────────────
function drawChapter() {
  const ch = chapters[currentChapter];
  const biome = biomes[ch.biome];

  drawBiomeBackground(biome);
  updateParticles(biome);
  drawParticles();
  drawBiomeLabel(biome);
  drawCoreCounter();

  // Draw NPC on left
  const npcY = 400;
  const npcH = 200;
  if (ch.npcSprite) {
    drawSprite(ch.npcSprite, 180, npcY, npcH, ch.npcSprite);
  } else if (ch.npcFallback) {
    drawFallbackCharacter(ch.npcFallback, 180, npcY, npcH);
  }

  // Draw player on right (always)
  if (currentChapter > 0) {
    drawSprite('player', 620, npcY, 180, 'player');
  }

  // Dialogue
  if (dialogueIndex < ch.script.length) {
    const line = ch.script[dialogueIndex];
    drawDialogueBox(speakerName, typewriterText);
  }
}

// ─── REACTION MINI-GAME ─────────────────────────────────────────────
const reactionKeys = ['F', 'J', 'D', 'K'];
let reactionSuccess = false;
let reactionPhase = 'countdown'; // countdown, show, result
let reactionCountdown = 3;
let reactionCountdownTimer = 0;
let reactionTargetKey = '';
let reactionShowTime = 0;
let reactionResultText = '';

function startReactionGame() {
  reactionGame.active = true;
  reactionPhase = 'countdown';
  reactionCountdown = 3;
  reactionCountdownTimer = Date.now();
  reactionSuccess = false;
  choicesDiv.style.display = 'none';
  continueHint.style.display = 'none';
}

function drawReactionGame() {
  const ch = chapters[currentChapter];
  const biome = biomes[ch.biome];
  drawBiomeBackground(biome);
  updateParticles(biome);
  drawParticles();
  drawBiomeLabel(biome);
  drawCoreCounter();

  if (ch.npcFallback) drawFallbackCharacter(ch.npcFallback, 180, 400, 200);
  drawSprite('player', 620, 400, 180, 'player');

  ctx.textAlign = 'center';

  if (reactionPhase === 'countdown') {
    const elapsed = Date.now() - reactionCountdownTimer;
    const current = 3 - Math.floor(elapsed / 1000);
    if (current <= 0) {
      reactionPhase = 'show';
      reactionTargetKey = reactionKeys[Math.floor(Math.random() * reactionKeys.length)];
      reactionShowTime = Date.now();
      return;
    }
    ctx.fillStyle = '#ff4400';
    ctx.font = 'bold 72px "Courier New", monospace';
    ctx.fillText(current.toString(), 400, 300);
    ctx.fillStyle = '#aabbcc';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Get ready to press the right key!', 400, 360);
  } else if (reactionPhase === 'show') {
    const elapsed = Date.now() - reactionShowTime;
    if (elapsed > 3000) {
      reactionPhase = 'result';
      reactionSuccess = false;
      reactionResultText = 'Too slow! But the Mage shows mercy...';
      setTimeout(() => {
        reactionGame.active = false;
        cores++;
        stabilizedLayers[3] = true;
        advanceAfterChoice('The volcano waits for no one, but your courage speaks.');
      }, 1500);
    }
    // Flash the key
    ctx.fillStyle = '#ff4400';
    ctx.font = 'bold 96px "Courier New", monospace';
    ctx.fillText('Press: ' + reactionTargetKey, 400, 300);
    // Timer bar
    const pct = 1 - elapsed / 3000;
    ctx.fillStyle = '#333';
    ctx.fillRect(200, 340, 400, 20);
    ctx.fillStyle = pct > 0.3 ? '#ff6600' : '#ff0000';
    ctx.fillRect(200, 340, 400 * pct, 20);
  } else if (reactionPhase === 'result') {
    ctx.fillStyle = reactionSuccess ? '#00ff88' : '#ff4400';
    ctx.font = 'bold 24px "Courier New", monospace';
    ctx.fillText(reactionResultText, 400, 300);
  }

  ctx.textAlign = 'left';
  drawDialogueBox('RED MAGE', 'The volcano tests your reflexes...');
}

// ─── DIALOGUE ENGINE ─────────────────────────────────────────────────
// Map biome index to raybg scene
const biomeToScene = {
  0: 'void',       // HUB
  1: 'underwater',  // UNDERWATER CAVE
  2: 'void',        // DARK FOREST
  3: 'void',        // WINTER PEAKS
  4: 'arena',       // VOLCANIC DEPTHS (combat feel)
  5: 'void',        // PINK LEAF GROVE
  6: 'underwater',  // VAMPIRE MIASMA (murky)
  7: 'arena'        // THE FACTORY
};

function startChapter(idx) {
  currentChapter = idx;
  dialogueIndex = 0;
  particles = [];
  waitingForClick = false;
  choicesDiv.style.display = 'none';
  continueHint.style.display = 'none';

  // Switch raymarched background to match biome
  const ch = chapters[idx];
  if (ch) bg.setScene(biomeToScene[ch.biome] || 'void');

  startDialogueLine();
}

function startDialogueLine() {
  if (currentChapter < 0 || currentChapter >= chapters.length) return;
  const ch = chapters[currentChapter];
  if (dialogueIndex >= ch.script.length) return;

  const line = ch.script[dialogueIndex];
  speakerName = line.speaker;
  typewriterTarget = line.text;
  typewriterText = '';
  typewriterTimer = 0;
  typewriterDone = false;
  waitingForClick = false;
  choicesDiv.style.display = 'none';
  continueHint.style.display = 'none';
}

function updateTypewriter() {
  if (typewriterDone) return;
  typewriterTimer++;
  if (typewriterTimer % 2 === 0 && typewriterText.length < typewriterTarget.length) {
    typewriterText += typewriterTarget[typewriterText.length];
  }
  if (typewriterText.length >= typewriterTarget.length) {
    typewriterDone = true;
    const ch = chapters[currentChapter];
    const line = ch.script[dialogueIndex];

    if (line.choices) {
      showChoices(line.choices);
    } else if (line.then === 'nextChapter') {
      waitingForClick = true;
      continueHint.style.display = 'block';
    } else if (line.then === 'reactionGame') {
      waitingForClick = false;
      setTimeout(() => startReactionGame(), 800);
    } else if (line.then === 'placeCore') {
      // auto-advance with a short delay
      const layerIdx = dialogueIndex - 6; // cores start at script index 6 in factory
      if (layerIdx >= 0 && layerIdx < 6) stabilizedLayers[layerIdx] = true;
      waitingForClick = true;
      continueHint.style.display = 'block';
    } else if (line.then === 'victory') {
      waitingForClick = true;
      continueHint.style.display = 'block';
    } else {
      waitingForClick = true;
      continueHint.style.display = 'block';
    }
  }
}

function skipTypewriter() {
  if (!typewriterDone) {
    typewriterText = typewriterTarget;
    typewriterDone = true;
    const ch = chapters[currentChapter];
    const line = ch.script[dialogueIndex];
    if (line.choices) {
      showChoices(line.choices);
    } else {
      waitingForClick = true;
      continueHint.style.display = 'block';
      if (line.then === 'reactionGame') {
        waitingForClick = false;
        continueHint.style.display = 'none';
        setTimeout(() => startReactionGame(), 400);
      }
    }
    return true;
  }
  return false;
}

function advanceDialogue() {
  const ch = chapters[currentChapter];
  const line = ch.script[dialogueIndex];

  if (line.then === 'nextChapter') {
    fadeToNext(() => {
      gameState = 'planetTransition';
      currentChapter++;
      if (currentChapter >= chapters.length) {
        gameState = 'victory';
      }
    });
    return;
  }
  if (line.then === 'victory') {
    fadeToNext(() => { gameState = 'victory'; bg.setScene('void'); bg.pulse(0.8); });
    return;
  }

  dialogueIndex++;
  if (dialogueIndex >= ch.script.length) {
    // Chapter done, go to planet transition for next
    fadeToNext(() => {
      gameState = 'planetTransition';
      currentChapter++;
      if (currentChapter >= chapters.length) {
        gameState = 'victory';
      }
    });
  } else {
    startDialogueLine();
  }
}

function showChoices(choices) {
  choicesDiv.style.display = 'flex';
  choicesDiv.innerHTML = '';
  for (const c of choices) {
    const btn = document.createElement('button');
    btn.textContent = c.text;
    btn.onclick = () => {
      choicesDiv.style.display = 'none';
      if (c.correct) {
        cores++;
        const biomeIdx = currentChapter; // 1-6 maps to layers 0-5
        if (biomeIdx - 1 >= 0 && biomeIdx - 1 < 6) stabilizedLayers[biomeIdx - 1] = true;
        bg.pulse(0.6);
      } else {
        bg.warp(0.5);
      }
      advanceAfterChoice(c.response);
    };
    choicesDiv.appendChild(btn);
  }
}

function advanceAfterChoice(responseText) {
  // Show NPC response, then advance to next chapter
  const ch = chapters[currentChapter];
  speakerName = ch.script[dialogueIndex].speaker; // keep the NPC name
  typewriterTarget = responseText;
  typewriterText = '';
  typewriterTimer = 0;
  typewriterDone = false;

  // Override: after this text finishes, go to planet transition
  dialogueIndex = ch.script.length; // mark as last
  // We need special handling — set a flag
  gameState = 'choiceResponse';
}

// ─── FADE SYSTEM ─────────────────────────────────────────────────────
function fadeToNext(callback) {
  fadeDir = 1;
  fadeAlpha = 0;
  fadeCallback = callback;
}

function updateFade() {
  if (fadeDir === 1) {
    fadeAlpha += 0.03;
    if (fadeAlpha >= 1) {
      fadeAlpha = 1;
      fadeDir = -1;
      if (fadeCallback) { fadeCallback(); fadeCallback = null; }
    }
  } else if (fadeDir === -1) {
    fadeAlpha -= 0.03;
    if (fadeAlpha <= 0) {
      fadeAlpha = 0;
      fadeDir = 0;
    }
  }
}

// ─── INPUT ───────────────────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  if (fadeDir !== 0) return;

  if (gameState === 'title') {
    fadeToNext(() => {
      gameState = 'chapter';
      startChapter(0);
    });
    return;
  }

  if (gameState === 'planetTransition') {
    fadeToNext(() => {
      gameState = 'chapter';
      startChapter(currentChapter);
    });
    return;
  }

  if (gameState === 'chapter') {
    if (!typewriterDone) {
      skipTypewriter();
      return;
    }
    if (waitingForClick) {
      waitingForClick = false;
      continueHint.style.display = 'none';
      advanceDialogue();
    }
    return;
  }

  if (gameState === 'choiceResponse') {
    if (!typewriterDone) {
      skipTypewriter();
      return;
    }
    // After choice response, go to planet transition
    fadeToNext(() => {
      gameState = 'planetTransition';
      currentChapter++;
      if (currentChapter >= chapters.length) {
        gameState = 'victory';
      }
    });
    return;
  }
});

document.addEventListener('keydown', (e) => {
  if (reactionGame.active && reactionPhase === 'show') {
    const pressed = e.key.toUpperCase();
    if (pressed === reactionTargetKey) {
      reactionPhase = 'result';
      reactionSuccess = true;
      reactionResultText = 'Excellent reflexes!';
      bg.pulse(0.6);
      cores++;
      stabilizedLayers[3] = true;
      setTimeout(() => {
        reactionGame.active = false;
        advanceAfterChoice('The fire respects speed. You have earned the Core of the Depths.');
      }, 1200);
    } else {
      reactionPhase = 'result';
      reactionSuccess = false;
      reactionResultText = 'Wrong key! But the Mage shows mercy...';
      bg.warp(0.5);
      cores++;
      stabilizedLayers[3] = true;
      setTimeout(() => {
        reactionGame.active = false;
        advanceAfterChoice('You stumbled, but your intent was true. Take the Core.');
      }, 1200);
    }
  }
});

// ─── GAME LOOP ───────────────────────────────────────────────────────
function gameLoop() {
  frameCount++;
  bg.render(performance.now());
  ctx.clearRect(0, 0, 800, 600);

  if (gameState === 'title') {
    drawTitleScreen();
  } else if (gameState === 'planetTransition') {
    drawPlanetTransition();
  } else if (gameState === 'chapter') {
    drawChapter();
    updateTypewriter();
  } else if (gameState === 'choiceResponse') {
    // Still draw the chapter scene but with the response text
    const ch = chapters[Math.min(currentChapter, chapters.length - 1)];
    const biome = biomes[ch.biome];
    drawBiomeBackground(biome);
    updateParticles(biome);
    drawParticles();
    drawBiomeLabel(biome);
    drawCoreCounter();
    if (ch.npcSprite) drawSprite(ch.npcSprite, 180, 400, 200, ch.npcSprite);
    else if (ch.npcFallback) drawFallbackCharacter(ch.npcFallback, 180, 400, 200);
    if (currentChapter > 0) drawSprite('player', 620, 400, 180, 'player');
    drawDialogueBox(speakerName, typewriterText);
    updateTypewriter();
    if (typewriterDone) {
      continueHint.style.display = 'block';
    }
  } else if (gameState === 'victory') {
    drawVictoryScreen();
  }

  // Reaction game overlay
  if (reactionGame.active) {
    drawReactionGame();
  }

  // Fade overlay
  updateFade();
  if (fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
    ctx.fillRect(0, 0, 800, 600);
  }

  rafId = requestAnimationFrame(gameLoop);
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
  wn.textContent = 'THE BETWEEN';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6614551742983686;
  setInterval(function() {
    hb.style.opacity = '0.06';
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01800702239673288;mix-blend-mode:overlay';
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