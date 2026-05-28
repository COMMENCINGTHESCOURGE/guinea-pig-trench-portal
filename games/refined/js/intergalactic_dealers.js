
const canvas = document.getElementById('gc');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

// =============================================
// COLORS & CONSTANTS
// =============================================
const BG = '#060612';
const TEAL = '#00d2ff';
const PINK = '#ff60a0';
const GOLD = '#ffd700';
const GREEN = '#39ff14';
const RED = '#ff3344';
const PURPLE = '#b060ff';
const ORANGE = '#ff8c00';
const WHITE = '#e0e0e0';
const DIM = '#556677';
const PANEL_BG = 'rgba(8,12,30,0.92)';
const PANEL_BORDER = 'rgba(0,210,255,0.25)';

// =============================================
// SPRITES
// =============================================
const SPRITE_PATHS = {
  defender: '../assets/sprites/generated/defender_victory_1.png',
  kraken: '../assets/sprites/generated/kraken_idle_1.png',
  dimmak: '../assets/sprites/dim_mak_fighter_full_sheet.png',
  mecha: '../assets/sprites/generated/mecha_idle_1.png',
  grief: '../assets/sprites/grief_warrior_sprite_sheet.png',
  akuaku: '../assets/sprites/generated/aku_idle_1.png'
};
const sprites = {};
let spritesLoaded = 0;
const SPRITE_COUNT = Object.keys(SPRITE_PATHS).length;
for (const [k, path] of Object.entries(SPRITE_PATHS)) {
  const img = new Image();
  img.onload = () => { spritesLoaded++; };
  img.onerror = () => { spritesLoaded++; };
  img.src = path;
  sprites[k] = img;
}

// =============================================
// STARFIELD
// =============================================
const stars = [];
for (let i = 0; i < 300; i++) stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, b: Math.random() });

function drawStars(t) {
  for (const s of stars) {
    const bri = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.001 + s.b * 10));
    ctx.fillStyle = `rgba(200,220,255,${bri * 0.6})`;
    ctx.fillRect(s.x * W, s.y * H, s.s, s.s);
  }
}

// =============================================
// 90s CARTOON THEME SONG (Web Audio API)
// =============================================
let audioCtx = null;
let themePlaying = false;
let themeMuted = false;
let themeNodes = null;
let audioUnlocked = false;
const muteBtn = document.getElementById('muteBtn');

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioUnlocked = true;
}

function createThemeSong() {
  if (!audioCtx || themePlaying) return;
  themePlaying = true;
  muteBtn.style.display = 'block';
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = themeMuted ? 0 : 0.35;
  masterGain.connect(audioCtx.destination);
  const BPM = 126;
  const beatLen = 60 / BPM;
  const barLen = beatLen * 4;
  const totalBars = 8;
  const loopLen = barLen * totalBars;
  const allOscs = [];
  const bassNotes = [
    {note:65.41,time:0,dur:beatLen*0.8},{note:65.41,time:beatLen,dur:beatLen*0.4},{note:77.78,time:beatLen*1.5,dur:beatLen*0.4},{note:65.41,time:beatLen*2,dur:beatLen*0.8},{note:82.41,time:beatLen*3,dur:beatLen*0.6},
    {note:87.31,time:barLen,dur:beatLen*0.8},{note:87.31,time:barLen+beatLen,dur:beatLen*0.4},{note:98.00,time:barLen+beatLen*1.5,dur:beatLen*0.4},{note:87.31,time:barLen+beatLen*2,dur:beatLen*0.8},{note:65.41,time:barLen+beatLen*3,dur:beatLen*0.8},
    {note:65.41,time:barLen*2,dur:beatLen*0.8},{note:77.78,time:barLen*2+beatLen,dur:beatLen*0.4},{note:82.41,time:barLen*2+beatLen*1.5,dur:beatLen*0.4},{note:87.31,time:barLen*2+beatLen*2,dur:beatLen*0.8},{note:82.41,time:barLen*2+beatLen*3,dur:beatLen*0.6},
    {note:77.78,time:barLen*3,dur:beatLen*0.8},{note:65.41,time:barLen*3+beatLen,dur:beatLen*0.8},{note:87.31,time:barLen*3+beatLen*2,dur:beatLen*0.6},{note:82.41,time:barLen*3+beatLen*3,dur:beatLen*0.8},
    {note:65.41,time:barLen*4,dur:beatLen*0.8},{note:65.41,time:barLen*4+beatLen,dur:beatLen*0.4},{note:77.78,time:barLen*4+beatLen*1.5,dur:beatLen*0.4},{note:65.41,time:barLen*4+beatLen*2,dur:beatLen*0.8},{note:82.41,time:barLen*4+beatLen*3,dur:beatLen*0.6},
    {note:87.31,time:barLen*5,dur:beatLen*0.8},{note:87.31,time:barLen*5+beatLen,dur:beatLen*0.4},{note:98.00,time:barLen*5+beatLen*1.5,dur:beatLen*0.4},{note:87.31,time:barLen*5+beatLen*2,dur:beatLen*0.8},{note:65.41,time:barLen*5+beatLen*3,dur:beatLen*0.8},
    {note:65.41,time:barLen*6,dur:beatLen*0.8},{note:77.78,time:barLen*6+beatLen,dur:beatLen*0.6},{note:82.41,time:barLen*6+beatLen*2,dur:beatLen*0.8},{note:98.00,time:barLen*6+beatLen*3,dur:beatLen*0.4},
    {note:87.31,time:barLen*7,dur:beatLen*0.8},{note:82.41,time:barLen*7+beatLen,dur:beatLen*0.8},{note:77.78,time:barLen*7+beatLen*2,dur:beatLen*0.6},{note:65.41,time:barLen*7+beatLen*3,dur:beatLen*0.8}
  ];
  const melodyNotes = [
    {note:523.25,time:0,dur:beatLen*0.3},{note:466.16,time:beatLen*0.33,dur:beatLen*0.3},{note:392.00,time:beatLen*0.66,dur:beatLen*0.5},{note:349.23,time:beatLen*1.25,dur:beatLen*0.25},{note:392.00,time:beatLen*1.5,dur:beatLen*0.5},{note:523.25,time:beatLen*2,dur:beatLen*0.4},{note:587.33,time:beatLen*2.5,dur:beatLen*0.3},{note:523.25,time:beatLen*3,dur:beatLen*0.5},
    {note:466.16,time:barLen,dur:beatLen*0.3},{note:440.00,time:barLen+beatLen*0.33,dur:beatLen*0.15},{note:415.30,time:barLen+beatLen*0.5,dur:beatLen*0.15},{note:392.00,time:barLen+beatLen*0.66,dur:beatLen*0.5},{note:311.13,time:barLen+beatLen*1.25,dur:beatLen*0.4},{note:349.23,time:barLen+beatLen*2,dur:beatLen*0.3},{note:392.00,time:barLen+beatLen*2.5,dur:beatLen*0.4},{note:311.13,time:barLen+beatLen*3,dur:beatLen*0.8},
    {note:261.63,time:barLen*2,dur:beatLen*0.25},{note:311.13,time:barLen*2+beatLen*0.33,dur:beatLen*0.25},{note:349.23,time:barLen*2+beatLen*0.66,dur:beatLen*0.25},{note:392.00,time:barLen*2+beatLen,dur:beatLen*0.5},{note:466.16,time:barLen*2+beatLen*1.66,dur:beatLen*0.25},{note:523.25,time:barLen*2+beatLen*2,dur:beatLen*0.7},{note:587.33,time:barLen*2+beatLen*3,dur:beatLen*0.3},{note:523.25,time:barLen*2+beatLen*3.5,dur:beatLen*0.4},
    {note:466.16,time:barLen*3,dur:beatLen*0.5},{note:392.00,time:barLen*3+beatLen*0.66,dur:beatLen*0.4},{note:349.23,time:barLen*3+beatLen*1.25,dur:beatLen*0.3},{note:311.13,time:barLen*3+beatLen*2,dur:beatLen*1.5},
    {note:523.25,time:barLen*4,dur:beatLen*0.3},{note:466.16,time:barLen*4+beatLen*0.33,dur:beatLen*0.3},{note:392.00,time:barLen*4+beatLen*0.66,dur:beatLen*0.5},{note:349.23,time:barLen*4+beatLen*1.25,dur:beatLen*0.25},{note:392.00,time:barLen*4+beatLen*1.5,dur:beatLen*0.5},{note:523.25,time:barLen*4+beatLen*2,dur:beatLen*0.4},{note:622.25,time:barLen*4+beatLen*2.5,dur:beatLen*0.3},{note:587.33,time:barLen*4+beatLen*3,dur:beatLen*0.5},
    {note:523.25,time:barLen*5,dur:beatLen*0.3},{note:466.16,time:barLen*5+beatLen*0.5,dur:beatLen*0.3},{note:392.00,time:barLen*5+beatLen,dur:beatLen*0.5},{note:349.23,time:barLen*5+beatLen*1.66,dur:beatLen*0.3},{note:311.13,time:barLen*5+beatLen*2,dur:beatLen*0.4},{note:349.23,time:barLen*5+beatLen*2.66,dur:beatLen*0.3},{note:392.00,time:barLen*5+beatLen*3,dur:beatLen*0.8},
    {note:261.63,time:barLen*6,dur:beatLen*0.2},{note:311.13,time:barLen*6+beatLen*0.25,dur:beatLen*0.2},{note:349.23,time:barLen*6+beatLen*0.5,dur:beatLen*0.2},{note:392.00,time:barLen*6+beatLen*0.75,dur:beatLen*0.2},{note:466.16,time:barLen*6+beatLen,dur:beatLen*0.2},{note:523.25,time:barLen*6+beatLen*1.25,dur:beatLen*0.2},{note:587.33,time:barLen*6+beatLen*1.5,dur:beatLen*0.2},{note:622.25,time:barLen*6+beatLen*1.75,dur:beatLen*0.5},{note:698.46,time:barLen*6+beatLen*2.5,dur:beatLen*0.3},{note:622.25,time:barLen*6+beatLen*3,dur:beatLen*0.3},{note:523.25,time:barLen*6+beatLen*3.5,dur:beatLen*0.4},
    {note:466.16,time:barLen*7,dur:beatLen*0.4},{note:392.00,time:barLen*7+beatLen*0.5,dur:beatLen*0.3},{note:311.13,time:barLen*7+beatLen,dur:beatLen*0.5},{note:261.63,time:barLen*7+beatLen*2,dur:beatLen*1.5}
  ];
  function scheduleLoop() {
    if (!themePlaying) return;
    const now = audioCtx.currentTime + 0.05;
    for (const n of bassNotes) {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(n.note, now + n.time);
      osc.frequency.linearRampToValueAtTime(n.note * 1.01, now + n.time + 0.02);
      osc.frequency.linearRampToValueAtTime(n.note, now + n.time + 0.05);
      gain.gain.setValueAtTime(0, now + n.time); gain.gain.linearRampToValueAtTime(0.18, now + n.time + 0.01);
      gain.gain.setValueAtTime(0.18, now + n.time + n.dur * 0.7); gain.gain.linearRampToValueAtTime(0, now + n.time + n.dur);
      osc.connect(gain); gain.connect(masterGain); osc.start(now + n.time); osc.stop(now + n.time + n.dur + 0.01); allOscs.push(osc);
    }
    for (const n of melodyNotes) {
      const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
      osc.type = 'square'; osc.frequency.setValueAtTime(n.note * 1.06, now + n.time);
      osc.frequency.linearRampToValueAtTime(n.note, now + n.time + 0.04);
      gain.gain.setValueAtTime(0, now + n.time); gain.gain.linearRampToValueAtTime(0.10, now + n.time + 0.008);
      gain.gain.setValueAtTime(0.08, now + n.time + n.dur * 0.6); gain.gain.linearRampToValueAtTime(0, now + n.time + n.dur);
      osc.connect(gain); gain.connect(masterGain); osc.start(now + n.time); osc.stop(now + n.time + n.dur + 0.01); allOscs.push(osc);
    }
    for (let beat = 0; beat < totalBars * 4; beat++) {
      const t = beat * beatLen;
      if (beat % 4 === 0 || beat % 4 === 2) {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(150, now + t); osc.frequency.exponentialRampToValueAtTime(30, now + t + 0.12);
        gain.gain.setValueAtTime(0.35, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.15);
        osc.connect(gain); gain.connect(masterGain); osc.start(now + t); osc.stop(now + t + 0.16); allOscs.push(osc);
      }
      if (beat % 4 === 1 || beat % 4 === 3) {
        for (let j = 0; j < 3; j++) {
          const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
          osc.type = 'square'; osc.frequency.setValueAtTime(800 + j * 1337 + Math.random() * 500, now + t);
          osc.frequency.linearRampToValueAtTime(200, now + t + 0.08);
          gain.gain.setValueAtTime(0.08, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.1);
          osc.connect(gain); gain.connect(masterGain); osc.start(now + t); osc.stop(now + t + 0.11); allOscs.push(osc);
        }
        const oscB = audioCtx.createOscillator(); const gainB = audioCtx.createGain();
        oscB.frequency.setValueAtTime(250, now + t); oscB.frequency.exponentialRampToValueAtTime(100, now + t + 0.05);
        gainB.gain.setValueAtTime(0.15, now + t); gainB.gain.exponentialRampToValueAtTime(0.001, now + t + 0.08);
        oscB.connect(gainB); gainB.connect(masterGain); oscB.start(now + t); oscB.stop(now + t + 0.09); allOscs.push(oscB);
      }
      for (let sub = 0; sub < 2; sub++) {
        const ht = t + sub * beatLen * 0.5;
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(6000 + Math.random() * 3000, now + ht);
        const vol = sub === 0 ? 0.03 : 0.018;
        gain.gain.setValueAtTime(vol, now + ht); gain.gain.exponentialRampToValueAtTime(0.001, now + ht + 0.04);
        osc.connect(gain); gain.connect(masterGain); osc.start(now + ht); osc.stop(now + ht + 0.05); allOscs.push(osc);
      }
    }
    themeLoopTimeout = setTimeout(scheduleLoop, loopLen * 1000 - 100);
  }
  let themeLoopTimeout = null;
  scheduleLoop();
  themeNodes = { masterGain, timeout: () => themeLoopTimeout, clearTimeout: () => clearTimeout(themeLoopTimeout) };
}

function stopThemeSong() {
  themePlaying = false;
  if (themeNodes) {
    themeNodes.clearTimeout();
    themeNodes.masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    setTimeout(() => { try { themeNodes.masterGain.disconnect(); } catch (e) {} }, 400);
    themeNodes = null;
  }
  muteBtn.style.display = 'none';
}

muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  themeMuted = !themeMuted;
  muteBtn.innerHTML = themeMuted ? '&#x1f507;' : '&#x1f50a;';
  if (themeNodes) { themeNodes.masterGain.gain.linearRampToValueAtTime(themeMuted ? 0 : 0.35, audioCtx.currentTime + 0.1); }
});

// =============================================
// GAME DATA
// =============================================
const SUBSTANCES = [
  { name: 'Void Dust', color: '#88aacc', minPrice: 15, maxPrice: 40, icon: 'circle' },
  { name: 'Nebula Crystals', color: '#aa66ff', minPrice: 50, maxPrice: 120, icon: 'diamond' },
  { name: 'Plasma Vials', color: '#ff6644', minPrice: 200, maxPrice: 500, icon: 'circle' },
  { name: 'Dark Matter', color: '#334466', minPrice: 1000, maxPrice: 3000, icon: 'diamond' },
  { name: 'Quantum Tears', color: '#00eeff', minPrice: 5000, maxPrice: 12000, icon: 'circle' },
  { name: 'Onion Extract', color: GOLD, minPrice: 10000, maxPrice: 50000, icon: 'diamond' }
];

const SUBSTANCE_EFFECTS = [
  { potency: 10, duration: 1, addictive: false },
  { potency: 25, duration: 2, addictive: false },
  { potency: 40, duration: 2, addictive: false },
  { potency: 60, duration: 3, addictive: false },
  { potency: 80, duration: 3, addictive: false },
  { potency: 100, duration: 4, addictive: true }
];

const LOCATIONS = [
  { name: 'Trench Hub', char: 'defender', desc: 'Balanced prices, safe haven', color: TEAL,
    priceMod: [1, 1, 1, 1, 1, 1], policeRate: 0.08, volatility: 0.2 },
  { name: 'Kraken Depths', char: 'kraken', desc: 'Cheap dust, pricey tears', color: '#2244aa',
    priceMod: [0.5, 0.8, 1, 1.2, 1.8, 1.3], policeRate: 0.12, volatility: 0.3 },
  { name: 'Dim Mak District', char: 'dimmak', desc: 'Volatile markets, frequent events', color: PINK,
    priceMod: [1.2, 1.1, 0.9, 0.8, 1, 1.2], policeRate: 0.15, volatility: 0.6 },
  { name: 'Mecha Station', char: 'mecha', desc: 'Stable prices, high security', color: ORANGE,
    priceMod: [1.1, 1, 1.1, 1, 0.9, 0.8], policeRate: 0.22, volatility: 0.1 },
  { name: 'Grief Wastes', char: 'grief', desc: 'Everything cheap but dangerous', color: '#aa2233',
    priceMod: [0.6, 0.6, 0.7, 0.7, 0.8, 0.9], policeRate: 0.25, volatility: 0.4 },
  { name: 'Aku Aku Sanctum', char: 'akuaku', desc: 'Rare goods, mysterious shifts', color: PURPLE,
    priceMod: [1.3, 1.2, 1, 0.9, 0.7, 0.5], policeRate: 0.1, volatility: 0.5 }
];

const CHARACTERS = [
  { id: 'defender', name: 'Defender', bonus: '+$500 starting cash', sprite: 'defender' },
  { id: 'dimmak', name: 'Dim Mak', bonus: '+30 inventory slots', sprite: 'dimmak' },
  { id: 'mecha', name: 'Mecha', bonus: '-50% police encounters', sprite: 'mecha' },
  { id: 'kraken', name: 'Kraken', bonus: '10% buy discount', sprite: 'kraken' },
  { id: 'akuaku', name: 'Aku Aku', bonus: 'See price trends', sprite: 'akuaku' },
  { id: 'grief', name: 'Grief', bonus: '+$2000 but starts in debt', sprite: 'grief' }
];

const DEALER_RANKS = [
  { name: 'Petty Dealer', min: 0 },
  { name: 'Street Hustler', min: 5000 },
  { name: 'Kingpin', min: 20000 },
  { name: 'Cartel Boss', min: 80000 },
  { name: 'Galactic Overlord', min: 250000 }
];

const USER_RANKS = [
  { name: 'Casual User', min: 0 },
  { name: 'Weekend Warrior', min: 5 },
  { name: 'Fiend', min: 10 },
  { name: 'Junkie', min: 16 },
  { name: 'Ascended', min: 23 },
  { name: 'Transcendent', min: 30 }
];

const UPGRADES = [
  { name: 'Trench Coat', slots: 20, cost: 500 },
  { name: 'Cargo Van', slots: 50, cost: 2000 },
  { name: 'Smuggler Ship', slots: 100, cost: 8000 }
];

// =============================================
// GAME STATE
// =============================================
let state = 'title';
let selectedChar = 0;
let selectedRole = 'dealer';
let hoverChar = -1;
let game = null;
let buttons = [];
let eventModal = null;
let eventButtons = [];
let warpAnim = 0;
let warpTarget = -1;
let prevPrices = null;
let eventLog = [];
let titleAnim = 0;
let mouseX = 0, mouseY = 0;
let qtyMode = 1;
let gameOverStats = null;
let flashPrices = {};
let highScores = JSON.parse(localStorage.getItem('igd_highscores') || '[]');
let titleClickPrompt = true;
let priceHistory = [[], [], [], [], [], []];
let floatingTexts = [];
let dayToast = null;
let dayToastTimer = 0;
let eventModalAnim = 0;
let scrollOffset = 0;
let borderPulse = 0;

function newGame(charIdx, role) {
  const ch = CHARACTERS[charIdx];
  let cash = 2000, debt = 0, maxSlots = 100;
  if (ch.id === 'defender') cash += 500;
  if (ch.id === 'dimmak') maxSlots += 30;
  if (ch.id === 'grief') { cash += 2000; debt = 5000; }
  game = {
    day: 1, maxDays: 30, cash, debt, health: 100,
    maxSlots, inventory: [0, 0, 0, 0, 0, 0],
    location: 0, character: ch.id, charIdx,
    prices: [], prevPrices: null,
    loanRate: 0.10,
    upgradesBought: [false, false, false],
    priceTrends: [0, 0, 0, 0, 0, 0],
    role: role,
    highMeter: role === 'user' ? 50 : 100,
    tolerance: [0, 0, 0, 0, 0, 0],
    totalUses: 0,
    daysAlive: 0,
    withdrawalActive: false,
    lastUsedDay: 0,
  };
  priceHistory = [[], [], [], [], [], []];
  floatingTexts = [];
  scrollOffset = 0;
  generatePrices();
  for (let i = 0; i < 6; i++) {
    priceHistory[i].push(game.prices[i]);
  }
  if (role === 'user') {
    eventLog = ['Welcome, spacer. Keep your high up or face withdrawal...'];
  } else {
    eventLog = ['Welcome to the Trench Hub. Start trading!'];
  }
  flashPrices = {};
  qtyMode = 1;
}

function generatePrices() {
  const loc = LOCATIONS[game.location];
  game.prevPrices = game.prices.length ? [...game.prices] : null;
  game.prices = [];
  game.priceTrends = [];
  for (let i = 0; i < 6; i++) {
    const sub = SUBSTANCES[i];
    const base = sub.minPrice + Math.random() * (sub.maxPrice - sub.minPrice);
    const vol = 1 + (Math.random() * 2 - 1) * loc.volatility;
    let price = Math.round(base * loc.priceMod[i] * vol);
    price = Math.max(1, price);
    game.prices.push(price);
    game.priceTrends.push(Math.random() < 0.33 ? -1 : Math.random() < 0.5 ? 1 : 0);
  }
  if (game.prevPrices) {
    for (let i = 0; i < 6; i++) {
      if (game.prices[i] < game.prevPrices[i]) flashPrices[i] = { color: GREEN, timer: 60 };
      else if (game.prices[i] > game.prevPrices[i]) flashPrices[i] = { color: RED, timer: 60 };
    }
  }
  for (let i = 0; i < 6; i++) {
    priceHistory[i].push(game.prices[i]);
    if (priceHistory[i].length > 7) priceHistory[i].shift();
  }
}

function totalInventory() { return game.inventory.reduce((a, b) => a + b, 0); }
function netWorth() {
  let val = game.cash - game.debt;
  for (let i = 0; i < 6; i++) val += game.inventory[i] * game.prices[i];
  return val;
}
function getRank(worth) {
  if (game && game.role === 'user') {
    let r = USER_RANKS[0];
    for (const rank of USER_RANKS) { if (game.daysAlive >= rank.min) r = rank; }
    return r;
  }
  let r = DEALER_RANKS[0];
  for (const rank of DEALER_RANKS) { if (worth >= rank.min) r = rank; }
  return r;
}
function getRankProgress() {
  if (game.role === 'user') {
    let curIdx = 0;
    for (let i = 0; i < USER_RANKS.length; i++) { if (game.daysAlive >= USER_RANKS[i].min) curIdx = i; }
    if (curIdx >= USER_RANKS.length - 1) return 1;
    const cur = USER_RANKS[curIdx].min;
    const next = USER_RANKS[curIdx + 1].min;
    return (game.daysAlive - cur) / (next - cur);
  }
  const w = netWorth();
  let curIdx = 0;
  for (let i = 0; i < DEALER_RANKS.length; i++) { if (w >= DEALER_RANKS[i].min) curIdx = i; }
  if (curIdx >= DEALER_RANKS.length - 1) return 1;
  const cur = DEALER_RANKS[curIdx].min;
  const next = DEALER_RANKS[curIdx + 1].min;
  return Math.max(0, (w - cur) / (next - cur));
}

function addFloatingText(text, x, y, color) {
  floatingTexts.push({ text, x, y, color, life: 60, startY: y });
}

function showDayToast(msgs) {
  dayToast = msgs;
  dayToastTimer = 180;
}

// =============================================
// USER ROLE: USE SUBSTANCE
// =============================================
function useSubstance(si) {
  if (!game || game.role !== 'user') return;
  if (game.inventory[si] <= 0) return;
  const fx = SUBSTANCE_EFFECTS[si];
  let effectivePotency = fx.potency;
  const tolFactor = Math.max(0.1, 1 - game.tolerance[si] / 100);
  effectivePotency = Math.round(effectivePotency * tolFactor);
  game.inventory[si]--;
  game.highMeter = Math.min(100, game.highMeter + effectivePotency);
  game.totalUses++;
  game.withdrawalActive = false;
  game.lastUsedDay = game.day;
  if (fx.addictive) {
    game.tolerance[si] = Math.min(90, game.tolerance[si] + 15);
  } else {
    game.tolerance[si] = Math.min(80, game.tolerance[si] + 5);
  }
  for (let i = 0; i < 6; i++) {
    if (i !== si && game.tolerance[i] > 0) {
      game.tolerance[i] = Math.max(0, game.tolerance[i] - 1);
    }
  }
  const tolPct = game.tolerance[si];
  addLog(`Used ${SUBSTANCES[si].name}: +${effectivePotency}% high (tol: ${tolPct}%)`);
  addFloatingText(`+${effectivePotency}% HIGH`, W * 0.5, 80, PURPLE);
}

function processUserDayEffects() {
  if (!game || game.role !== 'user') return;
  const drain = 12 + Math.floor(game.day / 5) * 3;
  game.highMeter = Math.max(0, game.highMeter - drain);
  game.daysAlive = game.day;
  let toastMsgs = [];
  toastMsgs.push(`High drained -${drain}%`);
  if (game.highMeter <= 0) {
    game.withdrawalActive = true;
    const wdDmg = 8 + Math.floor(game.totalUses / 3) * 2;
    game.health = Math.max(0, game.health - wdDmg);
    addLog(`WITHDRAWAL! -${wdDmg} HP (high meter empty)`);
    toastMsgs.push(`WITHDRAWAL: -${wdDmg} HP`);
    if (game.health <= 0) {
      addLog('You succumbed to withdrawal...');
      endGame();
      return;
    }
  } else if (game.highMeter <= 20) {
    addLog('Warning: high meter getting low...');
    toastMsgs.push('HIGH meter low!');
  }
  for (let i = 0; i < 6; i++) {
    if (game.tolerance[i] > 0) {
      game.tolerance[i] = Math.max(0, game.tolerance[i] - 2);
    }
  }
  return toastMsgs;
}

// =============================================
// RANDOM EVENTS
// =============================================
function triggerRandomEvent() {
  const loc = LOCATIONS[game.location];
  const roll = Math.random();
  let ev = null;
  if (roll < 0.12) {
    const si = Math.floor(Math.random() * 6);
    const factor = 0.2 + Math.random() * 0.3;
    game.prices[si] = Math.max(1, Math.round(game.prices[si] * factor));
    flashPrices[si] = { color: GREEN, timer: 90 };
    ev = { title: 'MARKET CRASH', icon: 'chart_down', text: `${SUBSTANCES[si].name} prices collapsed!\nNew price: $${game.prices[si].toLocaleString()}`, choices: ['OK'] };
    addLog(`${SUBSTANCES[si].name} prices crashed!`);
  } else if (roll < 0.22) {
    const si = Math.floor(Math.random() * 6);
    const factor = 2 + Math.random() * 3;
    game.prices[si] = Math.round(game.prices[si] * factor);
    flashPrices[si] = { color: GOLD, timer: 90 };
    ev = { title: 'PRICE SURGE', icon: 'chart_up', text: `${SUBSTANCES[si].name} demand exploded!\nNew price: $${game.prices[si].toLocaleString()}`, choices: ['OK'] };
    addLog(`${SUBSTANCES[si].name} prices surged!`);
  } else if (roll < 0.30) {
    let policeChance = loc.policeRate;
    if (game.character === 'mecha') policeChance *= 0.5;
    if (Math.random() < policeChance) {
      const owned = game.inventory.map((q, i) => ({ q, i })).filter(x => x.q > 0);
      if (owned.length > 0) {
        const target = owned[Math.floor(Math.random() * owned.length)];
        const lost = Math.min(target.q, Math.ceil(target.q * (0.2 + Math.random() * 0.5)));
        game.inventory[target.i] -= lost;
        ev = { title: 'POLICE RAID!', icon: 'police', text: `Space police confiscated ${lost} units of\n${SUBSTANCES[target.i].name}!`, choices: ['Damn...'] };
        addLog(`Police seized ${lost} ${SUBSTANCES[target.i].name}!`);
      }
    }
  } else if (roll < 0.38) {
    const si = Math.floor(Math.random() * 5);
    const qty = Math.floor(Math.random() * 15) + 3;
    const discount = 0.3 + Math.random() * 0.3;
    const price = Math.max(1, Math.round(game.prices[si] * discount));
    const freeSlots = game.maxSlots - totalInventory();
    const canBuy = Math.min(qty, freeSlots);
    if (canBuy > 0 && game.cash >= price) {
      ev = {
        title: 'BLACK MARKET DEAL', icon: 'deal',
        text: `A shady dealer offers ${canBuy}x ${SUBSTANCES[si].name}\nat $${price.toLocaleString()} each (${Math.round(discount * 100)}% off!).\nTotal: $${(price * canBuy).toLocaleString()}`,
        choices: ['Buy', 'Pass'],
        action: (choice) => {
          if (choice === 0) {
            const cost = price * canBuy;
            if (game.cash >= cost) {
              game.cash -= cost;
              game.inventory[si] += canBuy;
              addLog(`Bought ${canBuy} ${SUBSTANCES[si].name} from dealer!`);
              addFloatingText(`-$${cost.toLocaleString()}`, W * 0.5, H * 0.3, RED);
            }
          }
        }
      };
    }
  } else if (roll < 0.44) {
    const bribe = Math.round(200 + Math.random() * 1500);
    const total = totalInventory();
    if (total > 0) {
      ev = {
        title: 'STASH DISCOVERED!', icon: 'police',
        text: `Authorities found your goods!\nPay $${bribe.toLocaleString()} bribe or lose everything.`,
        choices: ['Pay Bribe', 'Refuse'],
        action: (choice) => {
          if (choice === 0) {
            if (game.cash >= bribe) {
              game.cash -= bribe;
              addLog(`Paid $${bribe.toLocaleString()} bribe.`);
              addFloatingText(`-$${bribe.toLocaleString()}`, W * 0.5, H * 0.3, RED);
            } else {
              addLog('Not enough cash! Lost all inventory!');
              game.inventory = [0, 0, 0, 0, 0, 0];
            }
          } else {
            game.inventory = [0, 0, 0, 0, 0, 0];
            addLog('Refused bribe -- lost all inventory!');
          }
        }
      };
    }
  } else if (roll < 0.50) {
    ev = { title: 'WORMHOLE SHORTCUT', icon: 'wormhole', text: 'You found a wormhole!\nNext travel is free (no day cost).', choices: ['Nice!'] };
    game._freeTravel = true;
    addLog('Found a wormhole shortcut!');
  } else if (roll < 0.56) {
    if (game.prices[5] > 30000) {
      game.prices[5] = Math.round(game.prices[5] * 0.4);
      flashPrices[5] = { color: GOLD, timer: 90 };
      ev = { title: 'BLACK MARKET CONTACT', icon: 'deal', text: `Onion Extract available at steep discount!\nPrice: $${game.prices[5].toLocaleString()}`, choices: ['Excellent'] };
      addLog('Black market: Onion Extract discount!');
    }
  } else if (roll < 0.62) {
    const dmg = Math.floor(Math.random() * 20) + 5;
    game.health = Math.max(0, game.health - dmg);
    ev = { title: 'AMBUSH!', icon: 'danger', text: `Space pirates attacked you!\nLost ${dmg} health. (HP: ${game.health}/100)`, choices: ['Survive'] };
    addLog(`Ambushed! Lost ${dmg} HP.`);
    addFloatingText(`-${dmg} HP`, W * 0.85, 30, RED);
    if (game.health <= 0) { endGame(); return; }
  } else if (roll < 0.67) {
    const found = Math.round(100 + Math.random() * 800);
    game.cash += found;
    ev = { title: 'LUCKY FIND', icon: 'cash', text: `Found $${found.toLocaleString()} in an abandoned cargo pod!`, choices: ['Sweet!'] };
    addLog(`Found $${found.toLocaleString()}!`);
    addFloatingText(`+$${found.toLocaleString()}`, W * 0.5, H * 0.3, GREEN);
  }
  if (ev) {
    eventModal = ev;
    eventModalAnim = 0;
    state = 'event';
  }
}

function addLog(msg) {
  eventLog.unshift(`[Day ${game.day}] ${msg}`);
  if (eventLog.length > 50) eventLog.pop();
}

// =============================================
// TRAVEL & TURN
// =============================================
function advanceDay() {
  if (game.debt > 0) {
    const interest = Math.round(game.debt * game.loanRate);
    game.debt = Math.round(game.debt * (1 + game.loanRate));
    return interest;
  }
  return 0;
}

function travelTo(locIdx) {
  if (locIdx === game.location) return;
  if (game.day >= game.maxDays) { endGame(); return; }
  warpTarget = locIdx;
  warpAnim = 30;
  let toastMsgs = [];
  if (!game._freeTravel) {
    game.day++;
  } else {
    game._freeTravel = false;
    addLog('Wormhole: free travel!');
    toastMsgs.push('Free wormhole travel!');
  }
  const interest = advanceDay();
  if (interest > 0) toastMsgs.push(`Debt interest: +$${interest.toLocaleString()}`);
  game.location = locIdx;
  generatePrices();
  addLog(`Arrived at ${LOCATIONS[locIdx].name}.`);
  if (game.role === 'user') {
    const userMsgs = processUserDayEffects();
    if (userMsgs) toastMsgs = toastMsgs.concat(userMsgs);
    if (game.health <= 0) return;
  }
  if (toastMsgs.length > 0) showDayToast(toastMsgs);
  borderPulse = 20;
  if (Math.random() < 0.55) {
    setTimeout(() => { if (state === 'game') triggerRandomEvent(); }, 600);
  }
  if (game.day >= game.maxDays) {
    setTimeout(() => endGame(), 1200);
  }
}

function waitDay() {
  if (game.day >= game.maxDays) { endGame(); return; }
  game.day++;
  let toastMsgs = ['Resting... day passes.'];
  const interest = advanceDay();
  if (interest > 0) toastMsgs.push(`Debt interest: +$${interest.toLocaleString()}`);
  generatePrices();
  addLog('Rested for a day.');
  if (game.role === 'user') {
    const userMsgs = processUserDayEffects();
    if (userMsgs) toastMsgs = toastMsgs.concat(userMsgs);
    if (game.health <= 0) return;
  }
  showDayToast(toastMsgs);
  borderPulse = 20;
  if (Math.random() < 0.35) {
    setTimeout(() => { if (state === 'game') triggerRandomEvent(); }, 600);
  }
  if (game.day >= game.maxDays) {
    setTimeout(() => endGame(), 1200);
  }
}

function buySubstance(si, qty) {
  const price = game.prices[si];
  let discount = 1;
  if (game.character === 'kraken') discount = 0.9;
  const cost = Math.round(price * discount);
  const freeSlots = game.maxSlots - totalInventory();
  const maxAfford = Math.floor(game.cash / cost);
  const actual = Math.min(qty === 0 ? 99999 : qty, freeSlots, maxAfford);
  if (actual <= 0) return;
  game.cash -= actual * cost;
  game.inventory[si] += actual;
  addLog(`Bought ${actual} ${SUBSTANCES[si].name} @ $${cost.toLocaleString()}`);
  addFloatingText(`-$${(actual * cost).toLocaleString()}`, W * 0.5, H * 0.35, RED);
  flashPrices[si] = { color: TEAL, timer: 20 };
}

function sellSubstance(si, qty) {
  const price = game.prices[si];
  const actual = Math.min(qty === 0 ? 99999 : qty, game.inventory[si]);
  if (actual <= 0) return;
  game.cash += actual * price;
  game.inventory[si] -= actual;
  addLog(`Sold ${actual} ${SUBSTANCES[si].name} @ $${price.toLocaleString()}`);
  addFloatingText(`+$${(actual * price).toLocaleString()}`, W * 0.5, H * 0.35, GREEN);
  flashPrices[si] = { color: GOLD, timer: 20 };
}

function buyUpgrade(idx) {
  const up = UPGRADES[idx];
  if (game.upgradesBought[idx]) return;
  if (game.cash < up.cost) return;
  game.cash -= up.cost;
  game.maxSlots += up.slots;
  game.upgradesBought[idx] = true;
  addLog(`Bought ${up.name} (+${up.slots} slots)!`);
  addFloatingText(`-$${up.cost.toLocaleString()}`, W * 0.8, H * 0.4, RED);
}

function borrowMoney(amount) {
  if (game.debt >= 5000) return;
  const maxBorrow = 5000 - game.debt;
  const actual = Math.min(amount, maxBorrow);
  game.cash += actual;
  game.debt += actual;
  addLog(`Borrowed $${actual.toLocaleString()} from loan shark.`);
  addFloatingText(`+$${actual.toLocaleString()}`, W * 0.5, H * 0.3, ORANGE);
}

function repayDebt(amount) {
  const actual = Math.min(amount, game.debt, game.cash);
  if (actual <= 0) return;
  game.cash -= actual;
  game.debt -= actual;
  addLog(`Repaid $${actual.toLocaleString()} to loan shark.`);
  addFloatingText(`-$${actual.toLocaleString()}`, W * 0.5, H * 0.3, GREEN);
}

function endGame() {
  const worth = netWorth();
  const rank = getRank(worth);
  gameOverStats = {
    worth, rank: rank.name, day: game.day,
    role: game.role,
    daysAlive: game.daysAlive || game.day,
    totalUses: game.totalUses || 0,
    highMeter: game.highMeter || 0,
    survived: game.role === 'user' ? game.health > 0 && game.day >= game.maxDays : true
  };
  highScores.push({
    worth, rank: rank.name, character: game.character,
    role: game.role || 'dealer',
    date: new Date().toLocaleDateString()
  });
  highScores.sort((a, b) => b.worth - a.worth);
  highScores = highScores.slice(0, 10);
  localStorage.setItem('igd_highscores', JSON.stringify(highScores));
  state = 'gameover';
}

// =============================================
// DRAWING HELPERS
// =============================================
function roundRect(x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  else {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function drawPanel(x, y, w, h, borderColor, radius) {
  const r = radius || 6;
  roundRect(x, y, w, h, r);
  ctx.fillStyle = PANEL_BG;
  ctx.fill();
  ctx.strokeStyle = borderColor || PANEL_BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawText(text, x, y, color, size, align) {
  ctx.fillStyle = color || WHITE;
  ctx.font = `${size || 14}px 'Courier New', monospace`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

function drawTextGlow(text, x, y, color, size, align, glowAmt) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glowAmt || 10;
  drawText(text, x, y, color, size, align);
  ctx.restore();
}

function drawButton(label, x, y, w, h, color, hovered, radius) {
  const r = radius || 4;
  const c = hovered ? color : (color + '88');
  roundRect(x, y, w, h, r);
  ctx.fillStyle = hovered ? (color + '33') : 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.strokeStyle = c;
  ctx.lineWidth = hovered ? 2 : 1;
  ctx.stroke();
  ctx.fillStyle = hovered ? WHITE : (color || WHITE);
  ctx.font = `${Math.min(14, h - 6)}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function isHover(x, y, w, h) {
  return mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
}

function drawSprite(key, x, y, w, h) {
  const img = sprites[key];
  if (!img || !img.complete || !img.naturalWidth) {
    ctx.fillStyle = '#335566';
    roundRect(x, y, w, h, 4);
    ctx.fill();
    drawText(key, x + 4, y + 4, WHITE, 10);
    return;
  }
  if (key === 'dimmak' || key === 'grief') {
    const sw = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0, sw, sw, x, y, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

function drawSubstanceIcon(x, y, size, color, type) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  if (type === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x, y - size/2);
    ctx.lineTo(x + size/2, y);
    ctx.lineTo(x, y + size/2);
    ctx.lineTo(x - size/2, y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, size/2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSparkline(x, y, w, h, data, color) {
  if (data.length < 2) return;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const px = x + (i / (data.length - 1)) * w;
    const py = y + h - ((data[i] - min) / range) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  const lastPx = x + w;
  const lastPy = y + h - ((data[data.length - 1] - min) / range) * h;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(lastPx, lastPy, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawProgressRing(cx, cy, radius, progress, color, bgColor) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = bgColor || 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawFloatingTexts(t) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.life--;
    if (ft.life <= 0) { floatingTexts.splice(i, 1); continue; }
    const alpha = ft.life / 60;
    const yOff = (60 - ft.life) * 1.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 6;
    drawText(ft.text, ft.x, ft.startY - yOff, ft.color, 18, 'center');
    ctx.restore();
  }
}

function getDangerColor(policeRate) {
  if (policeRate <= 0.10) return GREEN;
  if (policeRate <= 0.18) return GOLD;
  return RED;
}

// =============================================
// TITLE SCREEN
// =============================================
function drawTitle(t) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawStars(t);
  titleAnim = t;
  const cx = W / 2, cy = H * 0.15;
  const glow = 0.6 + 0.4 * Math.sin(t * 0.003);
  ctx.save();
  ctx.shadowColor = TEAL;
  ctx.shadowBlur = 20 * glow;
  drawText('INTERGALACTIC', cx, cy, TEAL, Math.min(48, W * 0.04), 'center');
  drawText('DRUG DEALERS', cx, cy + Math.min(55, W * 0.05), GOLD, Math.min(56, W * 0.05), 'center');
  ctx.restore();
  drawText('A Guinea Pig Trench Trading Game', cx, cy + Math.min(120, W * 0.1), DIM, 14, 'center');
  const bw = 260, bh = 50;
  const bx = cx - bw / 2, by = cy + Math.min(170, W * 0.14);
  const hov = isHover(bx, by, bw, bh);
  if (!audioUnlocked) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.005);
    drawText('Click anywhere to start', cx, by - 25, `rgba(0,210,255,${pulse})`, 13, 'center');
  }
  drawButton('[ START GAME ]', bx, by, bw, bh, TEAL, hov);
  buttons = [{ x: bx, y: by, w: bw, h: bh, action: () => { stopThemeSong(); state = 'charselect'; }}];
  if (highScores.length > 0) {
    drawText('HIGH SCORES', cx, by + 80, GOLD, 16, 'center');
    for (let i = 0; i < Math.min(5, highScores.length); i++) {
      const hs = highScores[i];
      const roleTag = hs.role === 'user' ? ' [USER]' : '';
      drawText(`${i + 1}. $${hs.worth.toLocaleString()} - ${hs.rank} (${hs.character})${roleTag}`, cx, by + 105 + i * 20, DIM, 12, 'center');
    }
  }
  if (themePlaying) {
    const pulse2 = 0.5 + 0.5 * Math.sin(t * 0.008);
    for (let i = 0; i < 5; i++) {
      const barH2 = 5 + Math.sin(t * 0.01 + i * 1.3) * 8;
      ctx.fillStyle = `rgba(0,210,255,${0.3 + pulse2 * 0.4})`;
      ctx.fillRect(cx - 30 + i * 14, H - 50 - barH2, 8, barH2);
    }
  }
  drawText('v3.0 - Guinea Pig Trench Portal', cx, H - 30, DIM, 11, 'center');
}

// =============================================
// CHARACTER SELECT
// =============================================
function drawCharSelect(t) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawStars(t);
  const cx = W / 2;
  drawText('SELECT YOUR CHARACTER', cx, 40, TEAL, 28, 'center');
  buttons = [];
  const cols = W > 900 ? 3 : 2;
  const cardW = Math.min(250, (W - 80) / cols - 20);
  const cardH = 220;
  const startX = cx - (cols * (cardW + 20)) / 2 + 10;
  const startY = 100;
  for (let i = 0; i < 6; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (cardW + 20);
    const y = startY + row * (cardH + 15);
    const ch = CHARACTERS[i];
    const hov = isHover(x, y, cardW, cardH);
    const sel = selectedChar === i;
    drawPanel(x, y, cardW, cardH, sel ? GOLD : (hov ? TEAL : PANEL_BORDER));
    if (sel) { ctx.strokeStyle = GOLD; ctx.lineWidth = 2; roundRect(x, y, cardW, cardH, 6); ctx.stroke(); }
    const sprSize = 64;
    drawSprite(ch.sprite, x + cardW / 2 - sprSize / 2, y + 10, sprSize, sprSize);
    drawText(ch.name, x + cardW / 2, y + 80, hov ? WHITE : TEAL, 18, 'center');
    drawText(ch.bonus, x + cardW / 2, y + 105, GOLD, 11, 'center');
    drawText(`Territory: ${LOCATIONS[i].name}`, x + cardW / 2, y + 130, DIM, 10, 'center');
    const ci = i;
    buttons.push({ x, y, w: cardW, h: cardH, action: () => { selectedChar = ci; } });
  }
  const bw = 200, bh = 45;
  const by = startY + Math.ceil(6 / cols) * (cardH + 15) + 10;
  const bx = cx - bw / 2;
  const hov = isHover(bx, by, bw, bh);
  drawButton('[ NEXT ]', bx, by, bw, bh, GOLD, hov);
  buttons.push({ x: bx, y: by, w: bw, h: bh, action: () => { state = 'roleselect'; }});
}

// =============================================
// ROLE SELECT
// =============================================
function drawRoleSelect(t) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawStars(t);
  const cx = W / 2;
  buttons = [];
  drawText('CHOOSE YOUR PATH', cx, 30, TEAL, 32, 'center');
  drawText(`Playing as: ${CHARACTERS[selectedChar].name}`, cx, 70, DIM, 14, 'center');
  const cardW = Math.min(380, (W - 60) / 2 - 20);
  const cardH = Math.min(500, H - 180);
  const gap = 30;
  const startX = cx - cardW - gap / 2;
  const startY = 100;

  const dx = startX, dy = startY;
  const dealerHov = isHover(dx, dy, cardW, cardH);
  const dealerSel = selectedRole === 'dealer';
  drawPanel(dx, dy, cardW, cardH, dealerSel ? GOLD : (dealerHov ? TEAL : PANEL_BORDER));
  if (dealerSel) { ctx.strokeStyle = GOLD; ctx.lineWidth = 2; roundRect(dx, dy, cardW, cardH, 6); ctx.stroke(); }
  let ty = dy + 15;
  ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = dealerSel ? 12 : 0;
  drawText('DEALER', dx + cardW / 2, ty, GOLD, 28, 'center');
  ctx.restore(); ty += 40;
  drawText('Classic gameplay', dx + cardW / 2, ty, WHITE, 13, 'center'); ty += 22;
  drawText('Buy substances cheap, sell high', dx + cardW / 2, ty, DIM, 11, 'center'); ty += 22;
  drawText('Maximize profit in 30 days', dx + cardW / 2, ty, DIM, 11, 'center'); ty += 30;
  drawText('RANKS:', dx + 20, ty, TEAL, 12); ty += 18;
  for (const r of ['Petty Dealer','Street Hustler','Kingpin','Cartel Boss','Galactic Overlord']) {
    drawText(`> ${r}`, dx + 30, ty, DIM, 11); ty += 16;
  }
  ty += 15;
  drawText('WIN CONDITION:', dx + 20, ty, GREEN, 12); ty += 18;
  drawText('Highest net worth after', dx + 30, ty, DIM, 11); ty += 16;
  drawText('30 days wins!', dx + 30, ty, DIM, 11);
  buttons.push({ x: dx, y: dy, w: cardW, h: cardH, action: () => { selectedRole = 'dealer'; } });

  const ux = startX + cardW + gap, uy = startY;
  const userHov = isHover(ux, uy, cardW, cardH);
  const userSel = selectedRole === 'user';
  drawPanel(ux, uy, cardW, cardH, userSel ? PURPLE : (userHov ? PINK : PANEL_BORDER));
  if (userSel) { ctx.strokeStyle = PURPLE; ctx.lineWidth = 2; roundRect(ux, uy, cardW, cardH, 6); ctx.stroke(); }
  ty = uy + 15;
  ctx.save(); ctx.shadowColor = PURPLE; ctx.shadowBlur = userSel ? 12 : 0;
  drawText('USER', ux + cardW / 2, ty, PURPLE, 28, 'center');
  ctx.restore(); ty += 40;
  drawText('Survive as an addict', ux + cardW / 2, ty, WHITE, 13, 'center'); ty += 22;
  drawText('Keep your HIGH meter up', ux + cardW / 2, ty, DIM, 11, 'center'); ty += 22;
  drawText('Withdrawal = HP damage', ux + cardW / 2, ty, RED, 11, 'center'); ty += 30;
  drawText('SUBSTANCE EFFECTS:', ux + 20, ty, PINK, 11); ty += 16;
  for (const lbl of ['Void Dust: +10% (weak, cheap)','Nebula Crystals: +25%','Plasma Vials: +40%','Dark Matter: +60%','Quantum Tears: +80%','Onion Extract: +100% (addictive!)']) {
    drawText(lbl, ux + 25, ty, DIM, 10); ty += 14;
  }
  ty += 10;
  drawText('TOLERANCE builds with use!', ux + 20, ty, ORANGE, 10); ty += 18;
  drawText('RANKS:', ux + 20, ty, PURPLE, 12); ty += 16;
  for (const r of ['Casual User','Weekend Warrior','Fiend','Junkie','Ascended','Transcendent']) {
    drawText(`> ${r}`, ux + 30, ty, DIM, 10); ty += 14;
  }
  ty += 10;
  drawText('WIN: Survive 30 days HP > 0', ux + 20, ty, GREEN, 11);
  buttons.push({ x: ux, y: uy, w: cardW, h: cardH, action: () => { selectedRole = 'user'; } });

  const bw = 220, bh = 50;
  const by = startY + cardH + 15;
  const bx = cx - bw / 2;
  const confirmHov = isHover(bx, by, bw, bh);
  const confirmColor = selectedRole === 'dealer' ? GOLD : PURPLE;
  drawButton('[ BEGIN ]', bx, by, bw, bh, confirmColor, confirmHov);
  buttons.push({ x: bx, y: by, w: bw, h: bh, action: () => { newGame(selectedChar, selectedRole); state = 'game'; }});

  const backW = 100, backH = 30;
  const backX = 15, backY = H - 50;
  const backHov = isHover(backX, backY, backW, backH);
  drawButton('< BACK', backX, backY, backW, backH, DIM, backHov);
  buttons.push({ x: backX, y: backY, w: backW, h: backH, action: () => { state = 'charselect'; } });
}

// =============================================
// MAIN GAME SCREEN
// =============================================
function drawGame(t) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawStars(t);

  if (borderPulse > 0) {
    borderPulse--;
    const bpAlpha = borderPulse / 20 * 0.3;
    ctx.strokeStyle = `rgba(0,210,255,${bpAlpha})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);
  }

  if (warpAnim > 0) {
    warpAnim--;
    const intensity = warpAnim / 30;
    ctx.fillStyle = `rgba(0,210,255,${intensity * 0.3})`;
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * Math.max(W, H) * 0.6;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const len = intensity * 80;
      ctx.strokeStyle = `rgba(200,230,255,${intensity * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (cx - sx) * 0.1 * intensity, sy + (cy - sy) * 0.1 * intensity);
      ctx.stroke();
    }
  }

  buttons = [];
  const loc = LOCATIONS[game.location];
  const isUser = game.role === 'user';
  const narrow = W < 900;

  // Layout calculations
  const hudH = isUser ? 70 : 50;
  const mapW = narrow ? W - 20 : Math.floor(W * 0.20);
  const sideW = narrow ? W - 20 : Math.floor(W * 0.25);
  const centerW = narrow ? W - 20 : W - mapW - sideW - 40;
  const mapX = narrow ? 10 : 10;
  const centerX = narrow ? 10 : mapX + mapW + 10;
  const sideX = narrow ? 10 : centerX + centerW + 10;
  const contentY = hudH + 5;
  const contentH = H - contentY - 5;

  // ========== HUD BAR ==========
  drawPanel(0, 0, W, hudH, PANEL_BORDER, 0);

  // Left: Day counter with progress ring
  const ringR = 16;
  const ringCx = 30, ringCy = isUser ? 22 : hudH / 2;
  drawProgressRing(ringCx, ringCy, ringR, game.day / game.maxDays, TEAL);
  drawText(`${game.day}`, ringCx, ringCy - 7, WHITE, 14, 'center');
  drawText(`/30`, ringCx + 18, ringCy - 5, DIM, 10);

  // Center: Cash + Debt
  const hudCx = W / 2;
  drawTextGlow(`$${game.cash.toLocaleString()}`, hudCx - 80, isUser ? 6 : 8, GREEN, 22, 'right', 12);
  drawText('CASH', hudCx - 82, isUser ? 6 : 8, DIM, 9, 'right');
  if (game.debt > 0) {
    drawTextGlow(`$${game.debt.toLocaleString()}`, hudCx + 10, isUser ? 6 : 8, RED, 22, 'left', 10);
    drawText('DEBT', hudCx + 12, isUser ? 28 : 30, DIM, 9);
  }

  // Right: HP bar
  const hpBarX = W - 280, hpBarY = isUser ? 8 : (hudH / 2 - 8), hpBarW = 80, hpBarH = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(hpBarX, hpBarY, hpBarW, hpBarH, 3); ctx.fill();
  const hpPct = game.health / 100;
  const hpGrad = ctx.createLinearGradient(hpBarX, 0, hpBarX + hpBarW, 0);
  hpGrad.addColorStop(0, RED);
  hpGrad.addColorStop(0.5, ORANGE);
  hpGrad.addColorStop(1, GREEN);
  roundRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH, 3);
  ctx.fillStyle = hpGrad;
  ctx.fill();
  ctx.strokeStyle = PANEL_BORDER;
  ctx.lineWidth = 1;
  roundRect(hpBarX, hpBarY, hpBarW, hpBarH, 3); ctx.stroke();
  drawText(`HP ${game.health}`, hpBarX + hpBarW + 5, hpBarY, game.health < 30 ? RED : WHITE, 12);

  // Inventory bar
  const invBarX = W - 170, invBarY = hpBarY, invBarW = 60, invBarH = 14;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(invBarX, invBarY, invBarW, invBarH, 3); ctx.fill();
  const invPct = totalInventory() / game.maxSlots;
  roundRect(invBarX, invBarY, invBarW * invPct, invBarH, 3);
  ctx.fillStyle = ORANGE;
  ctx.fill();
  roundRect(invBarX, invBarY, invBarW, invBarH, 3);
  ctx.strokeStyle = PANEL_BORDER; ctx.lineWidth = 1; ctx.stroke();
  drawText(`${totalInventory()}/${game.maxSlots}`, invBarX + invBarW + 4, invBarY, ORANGE, 10);

  // Net worth
  drawTextGlow(`$${netWorth().toLocaleString()}`, W - 10, hpBarY, GOLD, 14, 'right', 8);

  // User mode: HIGH meter bar below
  if (isUser) {
    const hmY = hudH - 24;
    drawText('HIGH', 65, hmY + 2, game.highMeter <= 20 ? RED : PURPLE, 11);
    const hmBarX = 100, hmBarW = W - 200, hmBarH = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(hmBarX, hmY, hmBarW, hmBarH, 4); ctx.fill();
    const hmFill = Math.max(0, game.highMeter / 100);
    let hmColor = PURPLE;
    if (game.highMeter <= 20) hmColor = RED;
    else if (game.highMeter <= 50) hmColor = ORANGE;
    const hmGrad = ctx.createLinearGradient(hmBarX, 0, hmBarX + hmBarW * hmFill, 0);
    hmGrad.addColorStop(0, hmColor);
    hmGrad.addColorStop(1, hmColor + '88');
    ctx.save();
    ctx.shadowColor = hmColor;
    ctx.shadowBlur = 10;
    roundRect(hmBarX, hmY, hmBarW * hmFill, hmBarH, 4);
    ctx.fillStyle = hmGrad;
    ctx.fill();
    ctx.restore();
    roundRect(hmBarX, hmY, hmBarW, hmBarH, 4);
    ctx.strokeStyle = PANEL_BORDER; ctx.lineWidth = 1; ctx.stroke();
    drawText(`${game.highMeter}%`, hmBarX + hmBarW + 5, hmY + 1, hmColor, 13);
    if (game.withdrawalActive) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.01);
      drawText('WITHDRAWAL', hmBarX + hmBarW / 2, hmY + 1, `rgba(255,51,68,${pulse})`, 12, 'center');
    }
  }

  if (narrow) {
    drawGameNarrow(t, contentY, contentH);
  } else {
    drawGameWide(t, mapX, mapW, centerX, centerW, sideX, sideW, contentY, contentH);
  }

  // Floating texts
  drawFloatingTexts(t);

  // Day toast
  if (dayToastTimer > 0) {
    dayToastTimer--;
    const alpha = Math.min(1, dayToastTimer / 30);
    const toastW = 300, toastH = 20 + dayToast.length * 18;
    const toastX = W / 2 - toastW / 2, toastY = 80;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanel(toastX, toastY, toastW, toastH, TEAL, 8);
    for (let i = 0; i < dayToast.length; i++) {
      drawText(dayToast[i], W / 2, toastY + 8 + i * 18, WHITE, 12, 'center');
    }
    ctx.restore();
  }
}

function drawGameWide(t, mapX, mapW, centerX, centerW, sideX, sideW, contentY, contentH) {
  const loc = LOCATIONS[game.location];
  const isUser = game.role === 'user';

  // ========== LEFT: GALAXY MAP ==========
  drawPanel(mapX, contentY, mapW, contentH, loc.color);
  drawText('GALAXY MAP', mapX + mapW / 2, contentY + 6, TEAL, 12, 'center');

  // Draw location nodes in circular arrangement
  const mapCx = mapX + mapW / 2;
  const mapCy = contentY + contentH * 0.35;
  const mapR = Math.min(mapW * 0.35, contentH * 0.2);

  // Connection lines
  ctx.strokeStyle = 'rgba(0,210,255,0.12)';
  ctx.lineWidth = 1;
  const nodePositions = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
    nodePositions.push({ x: mapCx + Math.cos(angle) * mapR, y: mapCy + Math.sin(angle) * mapR });
  }
  for (let i = 0; i < 6; i++) {
    for (let j = i + 1; j < 6; j++) {
      if (Math.abs(i - j) <= 2 || Math.abs(i - j) >= 4) {
        ctx.beginPath();
        ctx.moveTo(nodePositions[i].x, nodePositions[i].y);
        ctx.lineTo(nodePositions[j].x, nodePositions[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw nodes
  const nodeR = Math.min(22, mapW * 0.1);
  for (let i = 0; i < 6; i++) {
    const nx = nodePositions[i].x, ny = nodePositions[i].y;
    const isCurrent = game.location === i;
    const hov = isHover(nx - nodeR, ny - nodeR, nodeR * 2, nodeR * 2);
    const lc = LOCATIONS[i];
    const dangerCol = getDangerColor(lc.policeRate);

    if (isCurrent) {
      ctx.save();
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = 15 + 5 * Math.sin(t * 0.005);
      ctx.beginPath();
      ctx.arc(nx, ny, nodeR + 3, 0, Math.PI * 2);
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(nx, ny, nodeR, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? (lc.color + '66') : (hov ? (lc.color + '33') : 'rgba(8,12,30,0.8)');
    ctx.fill();
    ctx.strokeStyle = lc.color;
    ctx.lineWidth = isCurrent ? 2 : 1;
    ctx.stroke();

    // Mini sprite
    const miniS = nodeR * 0.9;
    drawSprite(lc.char, nx - miniS / 2, ny - miniS / 2, miniS, miniS);

    // Name below
    drawText(lc.name.split(' ')[0], nx, ny + nodeR + 2, lc.color, 8, 'center');

    // Danger dot
    ctx.beginPath();
    ctx.arc(nx + nodeR - 3, ny - nodeR + 3, 3, 0, Math.PI * 2);
    ctx.fillStyle = dangerCol;
    ctx.fill();

    if (!isCurrent) {
      const li = i;
      buttons.push({ x: nx - nodeR, y: ny - nodeR, w: nodeR * 2, h: nodeR * 2, action: () => travelTo(li) });
    }
  }

  drawText('Click node to travel', mapX + mapW / 2, mapCy + mapR + 28, DIM, 9, 'center');
  drawText('(costs 1 day)', mapX + mapW / 2, mapCy + mapR + 40, DIM, 8, 'center');

  // Wait/Rest button
  const waitBtnY = mapCy + mapR + 55;
  const waitBtnW = mapW - 20, waitBtnH = 28;
  const waitHov = isHover(mapX + 10, waitBtnY, waitBtnW, waitBtnH);
  drawButton('WAIT / REST [W]', mapX + 10, waitBtnY, waitBtnW, waitBtnH, DIM, waitHov);
  buttons.push({ x: mapX + 10, y: waitBtnY, w: waitBtnW, h: waitBtnH, action: () => waitDay() });

  // Current location info
  const infoY = waitBtnY + 40;
  drawText(loc.name, mapX + mapW / 2, infoY, loc.color, 13, 'center');
  drawText(loc.desc, mapX + mapW / 2, infoY + 18, DIM, 9, 'center');
  const dangerCol = getDangerColor(loc.policeRate);
  drawText(`Danger: ${Math.round(loc.policeRate * 100)}%`, mapX + mapW / 2, infoY + 34, dangerCol, 10, 'center');

  // ========== CENTER: TRADING CARDS ==========
  drawPanel(centerX, contentY, centerW, contentH, PANEL_BORDER);

  // Qty selector at top
  const qtyY = contentY + 8;
  drawText('QTY:', centerX + 10, qtyY + 4, DIM, 11);
  const qtyOpts = [{ label: '1', val: 1 }, { label: '5', val: 5 }, { label: '10', val: 10 }, { label: 'MAX', val: 0 }];
  for (let i = 0; i < qtyOpts.length; i++) {
    const qx = centerX + 55 + i * 52;
    const sel = qtyMode === qtyOpts[i].val;
    const hov = isHover(qx, qtyY, 46, 22);
    drawButton(qtyOpts[i].label, qx, qtyY, 46, 22, sel ? TEAL : DIM, sel || hov, 3);
    const val = qtyOpts[i].val;
    buttons.push({ x: qx, y: qtyY, w: 46, h: 22, action: () => { qtyMode = val; } });
  }

  // Substance cards
  const cardStartY = qtyY + 32;
  const cardGap = 6;
  const availH = contentH - 42;
  const cardH = Math.min(90, Math.floor((availH - cardGap * 5) / 6));
  const cardW2 = centerW - 16;

  for (let i = 0; i < 6; i++) {
    const sub = SUBSTANCES[i];
    const cy = cardStartY + i * (cardH + cardGap);
    const cx2 = centerX + 8;
    const price = game.prices[i];

    // Card background
    let cardBorder = PANEL_BORDER;
    if (flashPrices[i] && flashPrices[i].timer > 0) {
      cardBorder = flashPrices[i].color;
      flashPrices[i].timer--;
    }
    drawPanel(cx2, cy, cardW2, cardH, cardBorder, 5);

    // Substance icon
    const iconX = cx2 + 18, iconY = cy + cardH / 2;
    drawSubstanceIcon(iconX, iconY, 16, sub.color, sub.icon);

    // Name and price
    const nameX = cx2 + 36;
    drawText(sub.name, nameX, cy + 4, sub.color, 13);
    drawTextGlow(`$${price.toLocaleString()}`, nameX, cy + 20, WHITE, 16, 'left', 4);

    // Price change arrow
    if (game.prevPrices) {
      const diff = price - game.prevPrices[i];
      const pct = Math.round((diff / game.prevPrices[i]) * 100);
      const sign = diff > 0 ? '+' : '';
      const chColor = diff > 0 ? RED : (diff < 0 ? GREEN : DIM);
      const arrow = diff > 0 ? '\u25B2' : (diff < 0 ? '\u25BC' : '-');
      drawText(`${arrow} ${sign}${pct}%`, nameX, cy + 38, chColor, 10);
    }

    // Aku Aku trend
    if (game.character === 'akuaku') {
      const trend = game.priceTrends[i];
      const trendStr = trend > 0 ? 'NEXT:UP' : (trend < 0 ? 'NEXT:DN' : '');
      const trendColor = trend > 0 ? RED : GREEN;
      if (trendStr) drawText(trendStr, nameX + 100, cy + 38, trendColor, 8);
    }

    // Sparkline
    const sparkX = cx2 + cardW2 * 0.38, sparkY = cy + 6, sparkW = 60, sparkH = 25;
    if (priceHistory[i].length >= 2) {
      drawSparkline(sparkX, sparkY, sparkW, sparkH, priceHistory[i], sub.color + '88');
    }

    // Owned quantity as small bar
    const ownedX = sparkX, ownedY = cy + 36;
    drawText(`Own: ${game.inventory[i]}`, ownedX, ownedY, game.inventory[i] > 0 ? WHITE : DIM, 10);

    // User mode potency
    if (isUser) {
      const fx = SUBSTANCE_EFFECTS[i];
      const tolFactor = Math.max(0.1, 1 - game.tolerance[i] / 100);
      const effPot = Math.round(fx.potency * tolFactor);
      const potColor = game.tolerance[i] > 50 ? RED : (game.tolerance[i] > 20 ? ORANGE : DIM);
      drawText(`+${effPot}%`, ownedX + 65, ownedY, potColor, 10);
    }

    // Buy/Sell/Use buttons on right side of card
    const btnAreaX = cx2 + cardW2 - (isUser ? 170 : 120);
    const btnW2 = 50, btnH2 = Math.min(24, cardH / 2 - 4);

    // BUY button
    const buyX = btnAreaX;
    const buyY = cy + 4;
    const buyHov = isHover(buyX, buyY, btnW2, btnH2);
    drawButton('BUY', buyX, buyY, btnW2, btnH2, GREEN, buyHov, 3);
    const si = i;
    buttons.push({ x: buyX, y: buyY, w: btnW2, h: btnH2, action: () => buySubstance(si, qtyMode) });

    // SELL button
    const sellX = btnAreaX;
    const sellY = cy + 4 + btnH2 + 4;
    const sellHov = isHover(sellX, sellY, btnW2, btnH2);
    drawButton('SELL', sellX, sellY, btnW2, btnH2, RED, sellHov, 3);
    buttons.push({ x: sellX, y: sellY, w: btnW2, h: btnH2, action: () => sellSubstance(si, qtyMode) });

    // USE button (user only)
    if (isUser) {
      const useX = btnAreaX + btnW2 + 6;
      const useY = cy + 4;
      const useH = btnH2 * 2 + 4;
      const canUse = game.inventory[i] > 0;
      const useHov = canUse && isHover(useX, useY, btnW2, useH);
      drawButton('USE', useX, useY, btnW2, useH, canUse ? PURPLE : DIM, useHov, 3);
      if (canUse) buttons.push({ x: useX, y: useY, w: btnW2, h: useH, action: () => useSubstance(si) });
    }
  }

  // ========== RIGHT SIDEBAR ==========
  drawPanel(sideX, contentY, sideW, contentH, PANEL_BORDER);

  let sy = contentY + 8;

  // Character + Rank
  drawText(CHARACTERS[game.charIdx].name, sideX + sideW / 2, sy, TEAL, 14, 'center');
  sy += 18;
  const rank = getRank(netWorth());
  drawText(rank.name, sideX + sideW / 2, sy, GOLD, 12, 'center');
  sy += 18;

  // Rank progress bar
  const rpX = sideX + 10, rpW = sideW - 20, rpH = 10;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(rpX, sy, rpW, rpH, 3); ctx.fill();
  const rp = getRankProgress();
  roundRect(rpX, sy, rpW * rp, rpH, 3);
  ctx.fillStyle = GOLD;
  ctx.fill();
  roundRect(rpX, sy, rpW, rpH, 3);
  ctx.strokeStyle = PANEL_BORDER; ctx.lineWidth = 1; ctx.stroke();
  sy += 18;

  // Upgrades
  drawText('UPGRADES', sideX + 10, sy, TEAL, 11);
  sy += 16;
  for (let i = 0; i < UPGRADES.length; i++) {
    const up = UPGRADES[i];
    const bought = game.upgradesBought[i];
    const label = bought ? `${up.name} [OK]` : `${up.name} $${up.cost.toLocaleString()}`;
    const hov = !bought && isHover(sideX + 8, sy, sideW - 16, 22);
    drawButton(label, sideX + 8, sy, sideW - 16, 22, bought ? DIM : ORANGE, hov, 3);
    if (!bought) {
      const ui = i;
      buttons.push({ x: sideX + 8, y: sy, w: sideW - 16, h: 22, action: () => buyUpgrade(ui) });
    }
    sy += 26;
  }

  // Heal
  if (game.health < 100) {
    const hovHeal = isHover(sideX + 8, sy, sideW - 16, 22);
    drawButton('Heal +25HP ($200)', sideX + 8, sy, sideW - 16, 22, GREEN, hovHeal, 3);
    buttons.push({ x: sideX + 8, y: sy, w: sideW - 16, h: 22, action: () => {
      if (game.cash >= 200) { game.cash -= 200; game.health = Math.min(100, game.health + 25); addLog('Healed +25 HP.'); addFloatingText('-$200', sideX + sideW / 2, sy, RED); }
    }});
    sy += 26;
  }

  // Loan shark
  sy += 4;
  drawText('LOAN SHARK', sideX + 10, sy, RED, 11);
  sy += 16;
  drawText(`Debt: $${game.debt.toLocaleString()}`, sideX + 10, sy, game.debt > 0 ? RED : DIM, 10);
  sy += 14;
  if (game.debt < 5000) {
    const hov1 = isHover(sideX + 8, sy, sideW - 16, 22);
    drawButton('Borrow $1000', sideX + 8, sy, sideW - 16, 22, RED, hov1, 3);
    buttons.push({ x: sideX + 8, y: sy, w: sideW - 16, h: 22, action: () => borrowMoney(1000) });
    sy += 26;
  }
  if (game.debt > 0) {
    const hov2 = isHover(sideX + 8, sy, sideW - 16, 22);
    drawButton('Repay $1000', sideX + 8, sy, sideW - 16, 22, GREEN, hov2, 3);
    buttons.push({ x: sideX + 8, y: sy, w: sideW - 16, h: 22, action: () => repayDebt(1000) });
    sy += 26;
    const hov3 = isHover(sideX + 8, sy, sideW - 16, 22);
    drawButton('Repay All', sideX + 8, sy, sideW - 16, 22, GREEN, hov3, 3);
    buttons.push({ x: sideX + 8, y: sy, w: sideW - 16, h: 22, action: () => repayDebt(game.debt) });
    sy += 26;
  }

  // Event log
  sy += 6;
  drawText('EVENT LOG', sideX + 10, sy, DIM, 10);
  sy += 14;
  const logH = contentY + contentH - sy - 4;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sideX + 4, sy, sideW - 8, logH);
  ctx.clip();
  const maxLogLines = Math.floor(logH / 14);
  for (let i = 0; i < Math.min(maxLogLines, eventLog.length); i++) {
    drawText(eventLog[i], sideX + 8, sy + i * 14, i === 0 ? WHITE : DIM, 9);
  }
  ctx.restore();
}

function drawGameNarrow(t, contentY, contentH) {
  const loc = LOCATIONS[game.location];
  const isUser = game.role === 'user';
  const pw = W - 20;

  // Simplified vertical layout for narrow screens
  let sy = contentY + 4;

  // Location bar with travel
  drawPanel(10, sy, pw, 50, loc.color, 5);
  drawText(loc.name, 15, sy + 4, loc.color, 12);
  drawText(loc.desc, 15, sy + 18, DIM, 9);
  const dangerCol = getDangerColor(loc.policeRate);
  drawText(`Danger: ${Math.round(loc.policeRate * 100)}%`, 15, sy + 32, dangerCol, 9);

  // Compact travel buttons
  const tBtnW = Math.floor((pw - 80) / 6);
  for (let i = 0; i < 6; i++) {
    const tx = 70 + i * (tBtnW + 4);
    const isCur = game.location === i;
    const hov = isHover(tx, sy + 2, tBtnW, 18);
    drawButton(isCur ? 'HERE' : `${i+1}`, tx, sy + 2, tBtnW, 18, isCur ? GOLD : LOCATIONS[i].color, hov, 2);
    if (!isCur) {
      const li = i;
      buttons.push({ x: tx, y: sy + 2, w: tBtnW, h: 18, action: () => travelTo(li) });
    }
  }

  // Wait button
  const waitX = pw - 55;
  const waitHov = isHover(waitX, sy + 25, 60, 20);
  drawButton('WAIT', waitX, sy + 25, 60, 20, DIM, waitHov, 2);
  buttons.push({ x: waitX, y: sy + 25, w: 60, h: 20, action: () => waitDay() });

  sy += 56;

  // Qty selector
  drawText('QTY:', 12, sy + 2, DIM, 10);
  const qtyOpts = [{ label: '1', val: 1 }, { label: '5', val: 5 }, { label: '10', val: 10 }, { label: 'MAX', val: 0 }];
  for (let qi = 0; qi < qtyOpts.length; qi++) {
    const qx = 46 + qi * 44;
    const sel = qtyMode === qtyOpts[qi].val;
    const hov = isHover(qx, sy, 38, 18);
    drawButton(qtyOpts[qi].label, qx, sy, 38, 18, sel ? TEAL : DIM, sel || hov, 2);
    const val = qtyOpts[qi].val;
    buttons.push({ x: qx, y: sy, w: 38, h: 18, action: () => { qtyMode = val; } });
  }
  sy += 22;

  // Substance cards (compact)
  const cardH = Math.min(52, Math.floor((contentH - (sy - contentY) - 80) / 6));
  for (let i = 0; i < 6; i++) {
    const sub = SUBSTANCES[i];
    const price = game.prices[i];
    let cardBorder = PANEL_BORDER;
    if (flashPrices[i] && flashPrices[i].timer > 0) { cardBorder = flashPrices[i].color; flashPrices[i].timer--; }
    drawPanel(10, sy, pw, cardH, cardBorder, 4);

    drawSubstanceIcon(24, sy + cardH / 2, 12, sub.color, sub.icon);
    drawText(sub.name, 36, sy + 2, sub.color, 11);
    drawTextGlow(`$${price.toLocaleString()}`, 36, sy + 15, WHITE, 13, 'left', 3);

    if (game.prevPrices) {
      const diff = price - game.prevPrices[i];
      const pct = Math.round((diff / game.prevPrices[i]) * 100);
      const chColor = diff > 0 ? RED : (diff < 0 ? GREEN : DIM);
      const arrow = diff > 0 ? '\u25B2' : (diff < 0 ? '\u25BC' : '-');
      drawText(`${arrow}${pct > 0 ? '+' : ''}${pct}%`, 36, sy + 30, chColor, 9);
    }

    drawText(`Own:${game.inventory[i]}`, pw * 0.4, sy + 4, game.inventory[i] > 0 ? WHITE : DIM, 9);

    if (priceHistory[i].length >= 2) {
      drawSparkline(pw * 0.4, sy + 16, 40, 14, priceHistory[i], sub.color + '88');
    }

    const btnW2 = 36, btnH2 = Math.min(18, cardH / 2 - 3);
    const btnBase = pw - (isUser ? 120 : 80);
    const si = i;
    const buyHov = isHover(btnBase, sy + 3, btnW2, btnH2);
    drawButton('BUY', btnBase, sy + 3, btnW2, btnH2, GREEN, buyHov, 2);
    buttons.push({ x: btnBase, y: sy + 3, w: btnW2, h: btnH2, action: () => buySubstance(si, qtyMode) });

    const sellHov = isHover(btnBase, sy + 3 + btnH2 + 2, btnW2, btnH2);
    drawButton('SELL', btnBase, sy + 3 + btnH2 + 2, btnW2, btnH2, RED, sellHov, 2);
    buttons.push({ x: btnBase, y: sy + 3 + btnH2 + 2, w: btnW2, h: btnH2, action: () => sellSubstance(si, qtyMode) });

    if (isUser) {
      const useX = btnBase + btnW2 + 4;
      const canUse = game.inventory[i] > 0;
      const useHov = canUse && isHover(useX, sy + 3, btnW2, cardH - 6);
      drawButton('USE', useX, sy + 3, btnW2, cardH - 6, canUse ? PURPLE : DIM, useHov, 2);
      if (canUse) buttons.push({ x: useX, y: sy + 3, w: btnW2, h: cardH - 6, action: () => useSubstance(si) });
    }

    sy += cardH + 3;
  }

  // Bottom bar: upgrades + loan + log (compact)
  sy += 4;
  const bottomH = contentY + contentH - sy;
  if (bottomH > 40) {
    drawPanel(10, sy, pw, bottomH, PANEL_BORDER, 5);
    let bx = 15;
    // Compact upgrades
    for (let i = 0; i < UPGRADES.length; i++) {
      const up = UPGRADES[i];
      const bought = game.upgradesBought[i];
      const label = bought ? 'OK' : `$${up.cost.toLocaleString()}`;
      const hov = !bought && isHover(bx, sy + 4, 55, 18);
      drawButton(label, bx, sy + 4, 55, 18, bought ? DIM : ORANGE, hov, 2);
      if (!bought) { const ui = i; buttons.push({ x: bx, y: sy + 4, w: 55, h: 18, action: () => buyUpgrade(ui) }); }
      bx += 60;
    }
    // Loan buttons
    if (game.debt < 5000) {
      const hov = isHover(bx, sy + 4, 65, 18);
      drawButton('+$1000', bx, sy + 4, 65, 18, RED, hov, 2);
      buttons.push({ x: bx, y: sy + 4, w: 65, h: 18, action: () => borrowMoney(1000) });
      bx += 70;
    }
    if (game.debt > 0) {
      const hov = isHover(bx, sy + 4, 65, 18);
      drawButton('Repay', bx, sy + 4, 65, 18, GREEN, hov, 2);
      buttons.push({ x: bx, y: sy + 4, w: 65, h: 18, action: () => repayDebt(1000) });
    }
    // Mini log
    const logY = sy + 26;
    const logH = bottomH - 30;
    ctx.save();
    ctx.beginPath(); ctx.rect(15, logY, pw - 10, logH); ctx.clip();
    const maxLines = Math.floor(logH / 12);
    for (let i = 0; i < Math.min(maxLines, eventLog.length); i++) {
      drawText(eventLog[i], 15, logY + i * 12, i === 0 ? WHITE : DIM, 8);
    }
    ctx.restore();
  }
}

// =============================================
// EVENT MODAL
// =============================================
function drawEventModal(t) {
  drawGame(t);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  eventModalAnim = Math.min(1, eventModalAnim + 0.08);
  const scale = 0.5 + 0.5 * eventModalAnim;
  const alpha = eventModalAnim;

  const mw = Math.min(450, W - 40);
  const mh = 260;
  const mx = W / 2 - mw / 2;
  const my = H / 2 - mh / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-W / 2, -H / 2);

  drawPanel(mx, my, mw, mh, GOLD, 10);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  roundRect(mx, my, mw, mh, 10);
  ctx.stroke();

  // Event icon
  let iconSymbol = '!';
  let iconColor = GOLD;
  if (eventModal.icon === 'police') { iconSymbol = '\u26A0'; iconColor = RED; }
  else if (eventModal.icon === 'chart_down') { iconSymbol = '\u25BC'; iconColor = GREEN; }
  else if (eventModal.icon === 'chart_up') { iconSymbol = '\u25B2'; iconColor = RED; }
  else if (eventModal.icon === 'deal') { iconSymbol = '\u2605'; iconColor = GOLD; }
  else if (eventModal.icon === 'danger') { iconSymbol = '\u2620'; iconColor = RED; }
  else if (eventModal.icon === 'cash') { iconSymbol = '$'; iconColor = GREEN; }
  else if (eventModal.icon === 'wormhole') { iconSymbol = '\u25CE'; iconColor = TEAL; }

  ctx.save();
  ctx.shadowColor = iconColor;
  ctx.shadowBlur = 15;
  drawText(iconSymbol, mx + mw / 2, my + 12, iconColor, 32, 'center');
  ctx.restore();

  drawTextGlow(eventModal.title, mx + mw / 2, my + 50, GOLD, 22, 'center', 10);

  const lines = eventModal.text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], mx + mw / 2, my + 85 + i * 22, WHITE, 14, 'center');
  }

  eventButtons = [];
  const btnW = Math.min(140, (mw - 40) / eventModal.choices.length - 10);
  const btnH = 40;
  const btnY = my + mh - 60;
  const totalBtnW = eventModal.choices.length * (btnW + 10) - 10;
  const btnStartX = mx + mw / 2 - totalBtnW / 2;

  for (let i = 0; i < eventModal.choices.length; i++) {
    const bx = btnStartX + i * (btnW + 10);
    const hov = isHover(bx, btnY, btnW, btnH);
    ctx.save();
    if (hov) { ctx.shadowColor = TEAL; ctx.shadowBlur = 10; }
    drawButton(eventModal.choices[i], bx, btnY, btnW, btnH, TEAL, hov, 6);
    ctx.restore();
    const idx = i;
    eventButtons.push({ x: bx, y: btnY, w: btnW, h: btnH, action: () => {
      if (eventModal.action) eventModal.action(idx);
      eventModal = null;
      state = 'game';
    }});
  }

  ctx.restore();
}

// =============================================
// GAME OVER
// =============================================
function drawGameOver(t) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawStars(t);
  const cx = W / 2;
  const cy = H * 0.1;
  const isUser = gameOverStats.role === 'user';

  if (isUser) {
    if (gameOverStats.survived) {
      drawTextGlow('YOU SURVIVED!', cx, cy, GREEN, 42, 'center', 20);
    } else {
      drawTextGlow('GAME OVER', cx, cy, RED, 42, 'center', 20);
      drawText('Lost to withdrawal...', cx, cy + 45, DIM, 16, 'center');
    }
  } else {
    drawTextGlow('GAME OVER', cx, cy, RED, 42, 'center', 20);
  }

  drawText(`Day ${gameOverStats.day}/${game.maxDays}`, cx, cy + 65, DIM, 16, 'center');

  if (isUser) {
    drawTextGlow(`Days Survived: ${gameOverStats.daysAlive}`, cx, cy + 100, TEAL, 22, 'center', 10);
    drawTextGlow(`Rank: ${gameOverStats.rank}`, cx, cy + 135, PURPLE, 24, 'center', 12);
    const statsY = cy + 180;
    drawText(`Character: ${CHARACTERS[game.charIdx].name}`, cx, statsY, TEAL, 14, 'center');
    drawText(`Total Uses: ${gameOverStats.totalUses}`, cx, statsY + 25, PURPLE, 14, 'center');
    drawText(`Final High: ${gameOverStats.highMeter}%`, cx, statsY + 50, ORANGE, 14, 'center');
    drawText(`Health: ${game.health}/100`, cx, statsY + 75, game.health > 0 ? WHITE : RED, 14, 'center');
    drawText(`Net Worth: $${gameOverStats.worth.toLocaleString()}`, cx, statsY + 100, GOLD, 14, 'center');
    drawText(`Cash: $${game.cash.toLocaleString()}`, cx, statsY + 125, WHITE, 14, 'center');
  } else {
    const worthColor = gameOverStats.worth >= 0 ? GREEN : RED;
    drawTextGlow(`Net Worth: $${gameOverStats.worth.toLocaleString()}`, cx, cy + 100, worthColor, 28, 'center', 14);
    drawTextGlow(`Rank: ${gameOverStats.rank}`, cx, cy + 145, GOLD, 24, 'center', 12);
    const statsY = cy + 200;
    drawText(`Character: ${CHARACTERS[game.charIdx].name}`, cx, statsY, TEAL, 14, 'center');
    drawText(`Cash: $${game.cash.toLocaleString()}`, cx, statsY + 25, WHITE, 14, 'center');
    drawText(`Debt: $${game.debt.toLocaleString()}`, cx, statsY + 50, game.debt > 0 ? RED : DIM, 14, 'center');
    drawText(`Health: ${game.health}/100`, cx, statsY + 75, WHITE, 14, 'center');
    drawText(`Inventory Capacity: ${game.maxSlots}`, cx, statsY + 100, WHITE, 14, 'center');
  }

  const hsY = isUser ? cy + 340 : cy + 330;
  if (highScores.length > 0) {
    drawText('HIGH SCORES', cx, hsY, GOLD, 16, 'center');
    for (let i = 0; i < Math.min(5, highScores.length); i++) {
      const hs = highScores[i];
      const isThis = hs.worth === gameOverStats.worth;
      const roleTag = hs.role === 'user' ? ' [USER]' : '';
      drawText(`${i + 1}. $${hs.worth.toLocaleString()} - ${hs.rank}${roleTag}`, cx, hsY + 25 + i * 20, isThis ? GOLD : DIM, 12, 'center');
    }
  }

  buttons = [];
  const bw = 220, bh = 45;
  const bx = cx - bw / 2, by = H - 100;
  const hov = isHover(bx, by, bw, bh);
  drawButton('[ PLAY AGAIN ]', bx, by, bw, bh, TEAL, hov);
  buttons.push({ x: bx, y: by, w: bw, h: bh, action: () => { state = 'charselect'; selectedChar = 0; selectedRole = 'dealer'; } });
}

// =============================================
// MAIN LOOP
// =============================================
let prevState = null;
function frame(t) {
  if (state === 'title' && audioUnlocked && !themePlaying) {
    createThemeSong();
  }
  if (prevState === 'title' && state !== 'title' && themePlaying) {
    stopThemeSong();
  }
  prevState = state;
  switch (state) {
    case 'title': drawTitle(t); break;
    case 'charselect': drawCharSelect(t); break;
    case 'roleselect': drawRoleSelect(t); break;
    case 'game': drawGame(t); break;
    case 'event': drawEventModal(t); break;
    case 'gameover': drawGameOver(t); break;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// =============================================
// INPUT HANDLING
// =============================================
canvas.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

canvas.addEventListener('click', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (!audioUnlocked) { initAudio(); }
  if (state === 'event') {
    for (const btn of eventButtons) {
      if (isHover(btn.x, btn.y, btn.w, btn.h)) { btn.action(); return; }
    }
    return;
  }
  for (const btn of buttons) {
    if (isHover(btn.x, btn.y, btn.w, btn.h)) { btn.action(); return; }
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  mouseX = touch.clientX;
  mouseY = touch.clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (!audioUnlocked) { initAudio(); }
  if (state === 'event') {
    for (const btn of eventButtons) {
      if (isHover(btn.x, btn.y, btn.w, btn.h)) { btn.action(); return; }
    }
    return;
  }
  for (const btn of buttons) {
    if (isHover(btn.x, btn.y, btn.w, btn.h)) { btn.action(); return; }
  }
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (state !== 'game') return;
  const key = e.key.toLowerCase();
  if (key === 'b') { /* legacy compat - no mode toggle needed */ }
  if (key === 's') { /* legacy compat */ }
  if (key === 'u' && game && game.role === 'user') {
    for (let i = 5; i >= 0; i--) {
      if (game.inventory[i] > 0) { useSubstance(i); break; }
    }
  }
  if (key === 'w') { waitDay(); }
  if (key === 'm') { muteBtn.click(); }
  const num = parseInt(key);
  if (num >= 1 && num <= 6) { travelTo(num - 1); }
});



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
  var hbPeriod = 0.6855270700227521;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.01761456250766841;mix-blend-mode:overlay';
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
