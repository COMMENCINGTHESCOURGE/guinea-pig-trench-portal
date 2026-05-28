
(() => {
  "use strict";

  // --- Config ---
  const COLS = 64, ROWS = 28;
  const MAX_LEVEL = 4;
  const BRUSH_MIN = 1, BRUSH_MAX = 7;
  const FPS = 20;

  // Sand grayscale palette (levels 0-4)
  const SAND_COLORS = ["#0c0c12", "#3a3a3a", "#6a6a6a", "#9a9a9a", "#e0e0e0"];
  const CURSOR_COLOR = "#00d2ff";
  const BG = "#0c0c12";
  const HUD_COLOR = "#00d2ff";
  const HINT_COLOR = "#667788";

  // --- Sprite cursor ---
  const cursorSprite = new Image();
  let spriteLoaded = false;
  cursorSprite.onload = () => { spriteLoaded = true; };
  cursorSprite.onerror = () => { spriteLoaded = false; };
  cursorSprite.src = "../assets/sprites/dim_mak_fighter_full_sheet.png";

  // --- State ---
  let grid = [];
  let cx = COLS >> 1, cy = ROWS >> 2;
  let brush = 2;
  let eraseMode = false;
  let paused = false;
  const keys = {};

  function initGrid() {
    grid = [];
    for (let y = 0; y < ROWS; y++) {
      grid[y] = new Uint8Array(COLS); // all zeros = empty
    }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // --- Paint ---
  function paint() {
    const r = brush >> 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && px < COLS && py >= 0 && py < ROWS) {
          grid[py][px] = eraseMode ? 0 : MAX_LEVEL;
        }
      }
    }
  }

  // --- Physics ---
  function stepParticles() {
    // Work on a copy to avoid order artifacts
    const next = [];
    for (let y = 0; y < ROWS; y++) {
      next[y] = new Uint8Array(grid[y]);
    }
    // Bottom-up scan
    for (let y = ROWS - 2; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const lvl = grid[y][x];
        if (lvl === 0) continue;
        // Try straight down
        if (grid[y + 1][x] === 0 && next[y + 1][x] === 0) {
          next[y][x] = 0;
          next[y + 1][x] = lvl;
          continue;
        }
        // Try diagonals in random order
        const leftFirst = Math.random() < 0.5;
        const d1 = leftFirst ? -1 : 1;
        const d2 = leftFirst ? 1 : -1;
        let moved = false;
        for (const dx of [d1, d2]) {
          const nx = x + dx, ny = y + 1;
          if (nx >= 0 && nx < COLS && ny < ROWS) {
            if (grid[ny][nx] === 0 && next[ny][nx] === 0) {
              next[y][x] = 0;
              next[ny][nx] = lvl;
              moved = true;
              break;
            }
          }
        }
      }
    }
    grid = next;
  }

  // --- Rendering ---
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  let tileW, tileH, offsetX, offsetY;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Reserve space for HUD (top) and hint (bottom)
    const hudH = 48;
    const hintH = 32;
    const availW = canvas.width;
    const availH = canvas.height - hudH - hintH;
    tileW = Math.floor(availW / COLS);
    tileH = Math.floor(availH / ROWS);
    // Keep square-ish tiles — use the smaller dimension
    const tile = Math.max(1, Math.min(tileW, tileH));
    tileW = tile;
    tileH = tile;
    offsetX = Math.floor((canvas.width - COLS * tileW) / 2);
    offsetY = hudH + Math.floor((availH - ROWS * tileH) / 2);
  }

  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const lvl = grid[y][x];
        if (lvl > 0) {
          ctx.fillStyle = SAND_COLORS[lvl];
          ctx.fillRect(offsetX + x * tileW, offsetY + y * tileH, tileW, tileH);
        }
      }
    }

    // Draw cursor
    const cr = brush >> 1;
    const cursorX = offsetX + (cx - cr) * tileW;
    const cursorY = offsetY + (cy - cr) * tileH;
    const cursorW = brush * tileW;
    const cursorH = brush * tileH;

    if (spriteLoaded) {
      // Draw sprite from top-left 32x32 of the sheet, scaled to brush size
      ctx.drawImage(cursorSprite, 0, 0, 32, 32, cursorX, cursorY, cursorW, cursorH);
    } else {
      // Fallback: original square outline + center dot
      ctx.strokeStyle = CURSOR_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(cursorX, cursorY, cursorW, cursorH);
      ctx.fillStyle = CURSOR_COLOR;
      ctx.fillRect(
        offsetX + cx * tileW + (tileW >> 2),
        offsetY + cy * tileH + (tileH >> 2),
        tileW >> 1,
        tileH >> 1
      );
    }

    // HUD
    ctx.fillStyle = HUD_COLOR;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    const mode = eraseMode ? "ERASE" : "PAINT";
    const state = paused ? "PAUSED" : "RUNNING";
    ctx.fillText(
      `Brush: ${brush}  |  ${mode}  |  ${state}`,
      w / 2, 30
    );

    // Controls hint
    ctx.fillStyle = HINT_COLOR;
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "WASD/Arrows: Move   Space: Paint   E: Erase   +/-: Brush   P: Pause   R: Reset",
      w / 2, h - 12
    );

    // Watermark
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "right";
    ctx.fillText("GUINEA PIG TRENCH", w - 12, h - 14);
    ctx.restore();
  }

  // --- Input ---
  function handleKey(e) {
    const k = e.key;
    // Prevent scroll on space/arrows
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(k)) {
      e.preventDefault();
    }
    keys[k] = true;
  }

  function handleKeyUp(e) {
    keys[e.key] = false;
  }

  function processInput() {
    // Movement
    if (keys["w"] || keys["W"] || keys["ArrowUp"])    { cy = clamp(cy - 1, 0, ROWS - 1); }
    if (keys["s"] || keys["S"] || keys["ArrowDown"])   { cy = clamp(cy + 1, 0, ROWS - 1); }
    if (keys["a"] || keys["A"] || keys["ArrowLeft"])   { cx = clamp(cx - 1, 0, COLS - 1); }
    if (keys["d"] || keys["D"] || keys["ArrowRight"])  { cx = clamp(cx + 1, 0, COLS - 1); }

    // Paint (hold)
    if (keys[" "]) { paint(); }
  }

  // Toggles on keydown (single press)
  function handleToggle(e) {
    const k = e.key.toLowerCase();
    if (k === "e") { eraseMode = !eraseMode; }
    if (k === "p") { paused = !paused; }
    if (k === "r") { initGrid(); }
    if (k === "+" || k === "=") { brush = clamp(brush + 1, BRUSH_MIN, BRUSH_MAX); }
    if (k === "-" || k === "_") { brush = clamp(brush - 1, BRUSH_MIN, BRUSH_MAX); }
  }

  // --- Mouse / touch support ---
  let mouseDown = false;

  function screenToGrid(sx, sy) {
    const gx = Math.floor((sx - offsetX) / tileW);
    const gy = Math.floor((sy - offsetY) / tileH);
    return [clamp(gx, 0, COLS - 1), clamp(gy, 0, ROWS - 1)];
  }

  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    const [gx, gy] = screenToGrid(e.clientX, e.clientY);
    cx = gx; cy = gy;
    paint();
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const [gx, gy] = screenToGrid(e.clientX, e.clientY);
    cx = gx; cy = gy;
    paint();
  });
  canvas.addEventListener("mouseup", () => { mouseDown = false; });
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    mouseDown = true;
    const t = e.touches[0];
    const [gx, gy] = screenToGrid(t.clientX, t.clientY);
    cx = gx; cy = gy;
    paint();
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const [gx, gy] = screenToGrid(t.clientX, t.clientY);
    cx = gx; cy = gy;
    paint();
  }, { passive: false });
  canvas.addEventListener("touchend", () => { mouseDown = false; });

  // --- Main loop ---
  window.addEventListener("keydown", (e) => { handleKey(e); handleToggle(e); });
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", resize);

  initGrid();
  resize();

  let lastFrame = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - lastFrame < 1000 / FPS) return;
    lastFrame = ts;

    processInput();
    if (!paused) stepParticles();
    draw();
  }
  requestAnimationFrame(loop);
})();



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
  var hbPeriod = 0.6999231259492277;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.017142814961603393;mix-blend-mode:overlay';
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
