// ==================== SETUP ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('mainCanvas');
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');

let W, H;
function resize() {
  const r = container.getBoundingClientRect();
  W = canvas.width = r.width; H = canvas.height = r.height;
  minimapCanvas.width = 160; minimapCanvas.height = 100;
}
resize();
window.addEventListener('resize', resize);

// ==================== CAMERA ====================
let cam = { x: 0, y: 0, zoom: 1 };
function screenToWorld(sx, sy) {
  const r = canvas.getBoundingClientRect();
  return { x: (sx - r.left - W/2) / cam.zoom + cam.x, y: (sy - r.top - H/2) / cam.zoom + cam.y };
}
function worldToScreen(wx, wy) {
  return { x: (wx - cam.x) * cam.zoom + W/2, y: (wy - cam.y) * cam.zoom + H/2 };
}

// ==================== DATA TYPES ====================
const TYPES = {
  image: { color: '#c8b030', label: 'Image' },
  number: { color: '#999', label: 'Number' },
  color: { color: '#e040e0', label: 'Color' },
  audio: { color: '#30c060', label: 'Audio' },
  text: { color: '#4080e0', label: 'Text' },
  bool: { color: '#e06030', label: 'Bool' },
  any: { color: '#aaa', label: 'Any' }
};

// ==================== NODE DEFINITIONS ====================
const CAT_COLORS = {
  sprite: '#b8a030', effect: '#8040b0', color: '#e04080',
  math: '#777', output: '#30a040', audio: '#30a0a0', game: '#b03030'
};

const NODE_DEFS = {
  // SPRITE
  sprite_input: { cat: 'sprite', label: 'Sprite Input', w: 180, inputs: [], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'character', type: 'select', options: ['defender','dimmak','mecha','kraken','akuaku','grief'], default: 'defender' }] },
  color_shift: { cat: 'sprite', label: 'Color Shift', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'hue', type: 'slider', min: -180, max: 180, default: 0 }, { name: 'saturation', type: 'slider', min: -100, max: 100, default: 0 }, { name: 'brightness', type: 'slider', min: -100, max: 100, default: 0 }] },
  scale: { cat: 'sprite', label: 'Scale', w: 160, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'factor', type: 'number', min: 0.1, max: 10, default: 1, step: 0.1 }] },
  flip: { cat: 'sprite', label: 'Flip', w: 160, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'horizontal', type: 'bool', default: false }, { name: 'vertical', type: 'bool', default: false }] },
  crop: { cat: 'sprite', label: 'Crop', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'x', type: 'number', min: 0, max: 1000, default: 0 }, { name: 'y', type: 'number', min: 0, max: 1000, default: 0 },
             { name: 'w', type: 'number', min: 1, max: 1000, default: 64 }, { name: 'h', type: 'number', min: 1, max: 1000, default: 64 }] },
  overlay: { cat: 'sprite', label: 'Overlay', w: 180, inputs: [{ name: 'Base', type: 'image' }, { name: 'Top', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'mode', type: 'select', options: ['normal','multiply','screen','add'], default: 'normal' }] },
  sprite_sheet_split: { cat: 'sprite', label: 'Sheet Split', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Frame', type: 'image' }],
    params: [{ name: 'rows', type: 'number', min: 1, max: 16, default: 1 }, { name: 'cols', type: 'number', min: 1, max: 16, default: 4 }, { name: 'index', type: 'number', min: 0, max: 63, default: 0 }] },

  // EFFECT
  glow: { cat: 'effect', label: 'Glow', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'radius', type: 'slider', min: 0, max: 40, default: 10 }, { name: 'intensity', type: 'slider', min: 0, max: 100, default: 50 }, { name: 'color', type: 'color', default: '#ffff00' }] },
  shadow: { cat: 'effect', label: 'Shadow', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'offsetX', type: 'number', min: -50, max: 50, default: 4 }, { name: 'offsetY', type: 'number', min: -50, max: 50, default: 4 },
             { name: 'blur', type: 'slider', min: 0, max: 30, default: 8 }, { name: 'color', type: 'color', default: '#000000' }] },
  outline: { cat: 'effect', label: 'Outline', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'width', type: 'number', min: 1, max: 10, default: 2 }, { name: 'color', type: 'color', default: '#ffffff' }] },
  pixelate: { cat: 'effect', label: 'Pixelate', w: 160, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'size', type: 'slider', min: 1, max: 32, default: 4 }] },
  crt_filter: { cat: 'effect', label: 'CRT Filter', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'intensity', type: 'slider', min: 0, max: 100, default: 50 }] },
  palette_swap: { cat: 'effect', label: 'Palette Swap', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'palette', type: 'select', options: ['teal','volcanic','frost','toxic','ghost'], default: 'teal' }] },

  // COLOR
  color_node: { cat: 'color', label: 'Color', w: 140, inputs: [], outputs: [{ name: 'Color', type: 'color' }],
    params: [{ name: 'value', type: 'color', default: '#ff4444' }] },
  gradient: { cat: 'color', label: 'Gradient', w: 180, inputs: [{ name: 'Color A', type: 'color' }, { name: 'Color B', type: 'color' }], outputs: [{ name: 'Image', type: 'image' }],
    params: [{ name: 'width', type: 'number', min: 8, max: 512, default: 64 }, { name: 'height', type: 'number', min: 8, max: 512, default: 64 }] },
  mix_color: { cat: 'color', label: 'Mix', w: 160, inputs: [{ name: 'A', type: 'color' }, { name: 'B', type: 'color' }], outputs: [{ name: 'Color', type: 'color' }],
    params: [{ name: 'factor', type: 'slider', min: 0, max: 100, default: 50 }] },

  // MATH
  number_node: { cat: 'math', label: 'Number', w: 140, inputs: [], outputs: [{ name: 'Value', type: 'number' }],
    params: [{ name: 'value', type: 'number', min: -9999, max: 9999, default: 0, step: 0.1 }] },
  math_op: { cat: 'math', label: 'Math', w: 160, inputs: [{ name: 'A', type: 'number' }, { name: 'B', type: 'number' }], outputs: [{ name: 'Result', type: 'number' }],
    params: [{ name: 'op', type: 'select', options: ['+','-','*','/','mod','pow','min','max'], default: '+' }] },
  map_range: { cat: 'math', label: 'Map Range', w: 180, inputs: [{ name: 'Value', type: 'number' }], outputs: [{ name: 'Result', type: 'number' }],
    params: [{ name: 'fromMin', type: 'number', min: -9999, max: 9999, default: 0 }, { name: 'fromMax', type: 'number', min: -9999, max: 9999, default: 1 },
             { name: 'toMin', type: 'number', min: -9999, max: 9999, default: 0 }, { name: 'toMax', type: 'number', min: -9999, max: 9999, default: 100 }] },

  // OUTPUT
  preview: { cat: 'output', label: 'Preview', w: 200, inputs: [{ name: 'Image', type: 'image' }], outputs: [],
    params: [], previewH: 140 },
  export_node: { cat: 'output', label: 'Export', w: 180, inputs: [{ name: 'Image', type: 'image' }], outputs: [],
    params: [{ name: 'filename', type: 'text', default: 'output.png' }] },
  anim_preview: { cat: 'output', label: 'Anim Preview', w: 200, inputs: [{ name: 'Frame 1', type: 'image' }, { name: 'Frame 2', type: 'image' }, { name: 'Frame 3', type: 'image' }, { name: 'Frame 4', type: 'image' }], outputs: [],
    params: [{ name: 'fps', type: 'number', min: 1, max: 60, default: 8 }], previewH: 120 },

  // AUDIO
  oscillator: { cat: 'audio', label: 'Oscillator', w: 180, inputs: [], outputs: [{ name: 'Audio', type: 'audio' }],
    params: [{ name: 'waveform', type: 'select', options: ['sine','square','sawtooth','triangle'], default: 'sine' },
             { name: 'frequency', type: 'slider', min: 20, max: 2000, default: 440 }, { name: 'gain', type: 'slider', min: 0, max: 100, default: 50 }] },
  filter: { cat: 'audio', label: 'Filter', w: 180, inputs: [{ name: 'Audio', type: 'audio' }], outputs: [{ name: 'Audio', type: 'audio' }],
    params: [{ name: 'type', type: 'select', options: ['lowpass','highpass','bandpass'], default: 'lowpass' },
             { name: 'cutoff', type: 'slider', min: 20, max: 10000, default: 1000 }, { name: 'Q', type: 'slider', min: 0, max: 100, default: 10 }] },
  mix_audio: { cat: 'audio', label: 'Mix Audio', w: 180, inputs: [{ name: 'A', type: 'audio' }, { name: 'B', type: 'audio' }], outputs: [{ name: 'Audio', type: 'audio' }],
    params: [{ name: 'crossfade', type: 'slider', min: 0, max: 100, default: 50 }] },
  audio_output: { cat: 'audio', label: 'Audio Output', w: 160, inputs: [{ name: 'Audio', type: 'audio' }], outputs: [],
    params: [{ name: 'volume', type: 'slider', min: 0, max: 100, default: 70 }] },

  // GAME
  game_state: { cat: 'game', label: 'Game State', w: 180, inputs: [], outputs: [{ name: 'Value', type: 'any' }],
    params: [{ name: 'varName', type: 'text', default: 'health' }, { name: 'initial', type: 'number', min: -9999, max: 9999, default: 100 }] },
  timer: { cat: 'game', label: 'Timer', w: 140, inputs: [], outputs: [{ name: 'Time', type: 'number' }], params: [] },
  random_node: { cat: 'game', label: 'Random', w: 160, inputs: [], outputs: [{ name: 'Value', type: 'number' }],
    params: [{ name: 'min', type: 'number', min: -9999, max: 9999, default: 0 }, { name: 'max', type: 'number', min: -9999, max: 9999, default: 100 }] },
  condition: { cat: 'game', label: 'Condition', w: 180, inputs: [{ name: 'Value', type: 'number' }], outputs: [{ name: 'Result', type: 'bool' }],
    params: [{ name: 'comparison', type: 'select', options: ['>','<','==','!=','>=','<='], default: '>' }, { name: 'threshold', type: 'number', min: -9999, max: 9999, default: 50 }] },
};

// ==================== STATE ====================
let nodes = [];
let wires = [];
let selectedNodes = new Set();
let nextId = 1;
let dragging = null; // { type: 'node'|'pan'|'select'|'wire', ... }
let dragWire = null; // { fromNode, fromSocket, fromIsOutput, mx, my }
let addMenuPos = null;
let undoStack = [];
let redoStack = [];
let executing = false;
let execTime = 0;
let spaceHeld = false;
let propsVisible = true;
let audioCtx = null;
let activeAudioNodes = [];

// ==================== SPRITE GENERATION ====================
function generateSprite(name) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const palettes = {
    defender: ['#3060c0','#4080e0','#2050a0','#ffffff','#e0e0e0'],
    dimmak: ['#c03030','#e04040','#801010','#ffcc00','#333'],
    mecha: ['#666','#999','#444','#40e0ff','#333'],
    kraken: ['#206060','#30a080','#104040','#80ffcc','#1a3a3a'],
    akuaku: ['#c08030','#e0a040','#805010','#40ff40','#553311'],
    grief: ['#404060','#606080','#2a2a40','#c040ff','#1a1a2e']
  };
  const pal = palettes[name] || palettes.defender;

  // Body
  g.fillStyle = pal[0];
  g.fillRect(20, 16, 24, 32);
  // Head
  g.fillStyle = pal[1];
  g.beginPath(); g.arc(32, 14, 12, 0, Math.PI * 2); g.fill();
  // Eyes
  g.fillStyle = '#fff';
  g.fillRect(26, 10, 4, 4); g.fillRect(34, 10, 4, 4);
  g.fillStyle = '#111';
  g.fillRect(27, 11, 2, 2); g.fillRect(35, 11, 2, 2);
  // Arms
  g.fillStyle = pal[2];
  g.fillRect(12, 20, 8, 4); g.fillRect(44, 20, 8, 4);
  // Legs
  g.fillStyle = pal[2];
  g.fillRect(22, 48, 8, 12); g.fillRect(34, 48, 8, 12);
  // Detail
  g.fillStyle = pal[3];
  g.fillRect(28, 24, 8, 4);
  // Feet
  g.fillStyle = pal[4];
  g.fillRect(20, 58, 10, 6); g.fillRect(34, 58, 10, 6);

  return c;
}

// ==================== NODE CLASS ====================
function createNode(defKey, x, y) {
  const def = NODE_DEFS[defKey];
  if (!def) return null;
  const HEADER = 26;
  const SOCKET_SPACING = 22;
  const PARAM_H = 24;
  const maxSockets = Math.max(def.inputs.length, def.outputs.length);
  const socketsH = maxSockets * SOCKET_SPACING;
  const paramsH = def.params.length * PARAM_H;
  const previewH = def.previewH || 0;
  const h = HEADER + Math.max(socketsH, 10) + paramsH + previewH + 10;

  const params = {};
  def.params.forEach(p => { params[p.name] = p.default; });

  const node = {
    id: nextId++,
    defKey,
    def,
    x, y,
    w: def.w || 180,
    h,
    collapsed: false,
    params,
    cachedResult: null,
    previewCanvas: null
  };

  if (previewH > 0) {
    node.previewCanvas = document.createElement('canvas');
    node.previewCanvas.width = node.w - 20;
    node.previewCanvas.height = previewH - 10;
  }

  return node;
}

function nodeHeight(node) {
  if (node.collapsed) return 26;
  return node.h;
}

function getSocketPos(node, isOutput, idx) {
  const HEADER = 26;
  const SOCKET_SPACING = 22;
  const nh = nodeHeight(node);
  if (node.collapsed) return { x: node.x + (isOutput ? node.w : 0), y: node.y + 13 };
  const y = node.y + HEADER + 11 + idx * SOCKET_SPACING;
  return { x: node.x + (isOutput ? node.w : 0), y };
}

// ==================== UNDO ====================
function pushUndo() {
  undoStack.push(JSON.stringify({ nodes: nodes.map(n => ({ ...n, previewCanvas: null, cachedResult: null })), wires: [...wires] }));
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify({ nodes: nodes.map(n => ({ ...n, previewCanvas: null, cachedResult: null })), wires: [...wires] }));
  restoreState(JSON.parse(undoStack.pop()));
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify({ nodes: nodes.map(n => ({ ...n, previewCanvas: null, cachedResult: null })), wires: [...wires] }));
  restoreState(JSON.parse(redoStack.pop()));
}
function restoreState(st) {
  nodes = st.nodes.map(n => {
    n.def = NODE_DEFS[n.defKey];
    if (n.def && n.def.previewH) {
      n.previewCanvas = document.createElement('canvas');
      n.previewCanvas.width = n.w - 20;
      n.previewCanvas.height = n.def.previewH - 10;
    }
    return n;
  });
  wires = st.wires;
  selectedNodes.clear();
}

// ==================== DRAWING ====================
function drawGrid() {
  const gridBase = 20;
  const grid = gridBase * cam.zoom;

  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  const off = worldToScreen(0, 0);
  const startX = off.x % grid;
  const startY = off.y % grid;

  if (cam.zoom > 0.3) {
    ctx.fillStyle = cam.zoom > 1.5 ? '#2a2a4e' : '#222244';
    const dotSize = cam.zoom > 1.5 ? 1.5 : 1;
    for (let x = startX; x < W; x += grid) {
      for (let y = startY; y < H; y += grid) {
        ctx.fillRect(x - dotSize/2, y - dotSize/2, dotSize, dotSize);
      }
    }
  }

  // Major grid lines at larger zoom
  if (cam.zoom > 0.8) {
    const majorGrid = grid * 5;
    const mStartX = off.x % majorGrid;
    const mStartY = off.y % majorGrid;
    ctx.strokeStyle = '#252545';
    ctx.lineWidth = 1;
    for (let x = mStartX; x < W; x += majorGrid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = mStartY; y < H; y += majorGrid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }
}

function drawWire(x1, y1, x2, y2, color, alpha, animated) {
  const dx = Math.abs(x2 - x1) * 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha || 0.8;
  ctx.lineWidth = 2.5 * cam.zoom;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (animated && executing) {
    const t = (Date.now() % 1000) / 1000;
    for (let i = 0; i < 5; i++) {
      const tt = (t + i * 0.2) % 1;
      const mt = 1 - tt;
      const px = mt*mt*mt*x1 + 3*mt*mt*tt*(x1+dx) + 3*mt*tt*tt*(x2-dx) + tt*tt*tt*x2;
      const py = mt*mt*mt*y1 + 3*mt*mt*tt*y1 + 3*mt*tt*tt*y2 + tt*tt*tt*y2;
      ctx.beginPath();
      ctx.arc(px, py, 3 * cam.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9 - i * 0.15;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawNode(node) {
  const nh = nodeHeight(node);
  const s = worldToScreen(node.x, node.y);
  const sw = node.w * cam.zoom;
  const sh = nh * cam.zoom;
  const HEADER = 26 * cam.zoom;

  if (s.x + sw < 0 || s.x > W || s.y + sh < 0 || s.y > H) return; // cull

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(s.x + 3, s.y + 3, sw, sh);

  // Body
  ctx.fillStyle = '#2a2a3e';
  ctx.fillRect(s.x, s.y, sw, sh);

  // Header
  const catColor = CAT_COLORS[node.def.cat] || '#555';
  ctx.fillStyle = catColor;
  ctx.fillRect(s.x, s.y, sw, HEADER);

  // Header text
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${11 * cam.zoom}px Segoe UI, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(node.def.label, s.x + 8 * cam.zoom, s.y + HEADER / 2);

  // Collapse indicator
  ctx.fillStyle = '#fff8';
  ctx.font = `${10 * cam.zoom}px sans-serif`;
  ctx.fillText(node.collapsed ? '+' : '-', s.x + sw - 14 * cam.zoom, s.y + HEADER / 2);

  // Selected outline
  if (selectedNodes.has(node.id)) {
    ctx.strokeStyle = '#6080ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 1, s.y - 1, sw + 2, sh + 2);
  }

  // Border
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(s.x, s.y, sw, sh);

  if (node.collapsed) {
    // Draw sockets even when collapsed
    drawSockets(node);
    return;
  }

  // Inputs
  node.def.inputs.forEach((inp, i) => {
    const sp = getSocketPos(node, false, i);
    const ss = worldToScreen(sp.x, sp.y);
    const connected = wires.some(w => w.toNode === node.id && w.toSocket === i);
    drawSocket(ss.x, ss.y, TYPES[inp.type]?.color || '#aaa', connected);
    ctx.fillStyle = '#bbb';
    ctx.font = `${10 * cam.zoom}px Segoe UI`;
    ctx.textAlign = 'left';
    ctx.fillText(inp.name, ss.x + 10 * cam.zoom, ss.y + 1);
  });

  // Outputs
  node.def.outputs.forEach((out, i) => {
    const sp = getSocketPos(node, true, i);
    const ss = worldToScreen(sp.x, sp.y);
    const connected = wires.some(w => w.fromNode === node.id && w.fromSocket === i);
    drawSocket(ss.x, ss.y, TYPES[out.type]?.color || '#aaa', connected);
    ctx.fillStyle = '#bbb';
    ctx.font = `${10 * cam.zoom}px Segoe UI`;
    ctx.textAlign = 'right';
    ctx.fillText(out.name, ss.x - 10 * cam.zoom, ss.y + 1);
  });

  // Params inline
  const paramStartY = node.y + 26 + Math.max(node.def.inputs.length, node.def.outputs.length) * 22;
  node.def.params.forEach((p, i) => {
    const py = paramStartY + i * 24 + 12;
    const ps = worldToScreen(node.x + 10, py);
    const pw = (node.w - 20) * cam.zoom;
    ctx.fillStyle = '#888';
    ctx.font = `${9 * cam.zoom}px Segoe UI`;
    ctx.textAlign = 'left';
    ctx.fillText(`${p.name}: ${node.params[p.name]}`, ps.x, ps.y);
    // Slider bar
    if (p.type === 'slider') {
      const barY = ps.y + 4 * cam.zoom;
      ctx.fillStyle = '#1a1a30';
      ctx.fillRect(ps.x, barY, pw, 6 * cam.zoom);
      const frac = (node.params[p.name] - p.min) / (p.max - p.min);
      ctx.fillStyle = catColor;
      ctx.fillRect(ps.x, barY, pw * frac, 6 * cam.zoom);
    }
  });

  // Preview
  if (node.previewCanvas && node.cachedResult) {
    const previewY = node.y + nh - (node.def.previewH || 0);
    const ps = worldToScreen(node.x + 10, previewY + 5);
    const pw = (node.w - 20) * cam.zoom;
    const ph = ((node.def.previewH || 0) - 10) * cam.zoom;
    ctx.fillStyle = '#111';
    ctx.fillRect(ps.x, ps.y, pw, ph);
    try {
      ctx.drawImage(node.cachedResult, ps.x, ps.y, pw, ph);
    } catch(e) {}
  }
}

function drawSocket(sx, sy, color, connected) {
  const r = 5.5 * cam.zoom;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  if (connected) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 * cam.zoom;
    ctx.stroke();
  }
}

function drawMinimap() {
  const mc = minimapCtx;
  mc.fillStyle = '#0e0e1e';
  mc.fillRect(0, 0, 160, 100);
  if (!nodes.length) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + nodeHeight(n));
  });
  const pad = 100;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const scaleX = 160 / (maxX - minX);
  const scaleY = 100 / (maxY - minY);
  const sc = Math.min(scaleX, scaleY);

  nodes.forEach(n => {
    const x = (n.x - minX) * sc;
    const y = (n.y - minY) * sc;
    const w = n.w * sc;
    const h = nodeHeight(n) * sc;
    mc.fillStyle = CAT_COLORS[n.def.cat] || '#555';
    mc.fillRect(x, y, Math.max(w, 2), Math.max(h, 2));
  });

  // Viewport
  const tl = screenToWorld(canvas.getBoundingClientRect().left + 44, canvas.getBoundingClientRect().top + 36);
  const br = screenToWorld(canvas.getBoundingClientRect().right - 220, canvas.getBoundingClientRect().bottom);
  mc.strokeStyle = '#fff4';
  mc.lineWidth = 1;
  mc.strokeRect((tl.x - minX) * sc, (tl.y - minY) * sc, (br.x - tl.x) * sc, (br.y - tl.y) * sc);
}

// ==================== RENDER LOOP ====================
function render() {
  resize();
  drawGrid();

  // Draw wires
  wires.forEach(w => {
    const fromNode = nodes.find(n => n.id === w.fromNode);
    const toNode = nodes.find(n => n.id === w.toNode);
    if (!fromNode || !toNode) return;
    const fp = getSocketPos(fromNode, true, w.fromSocket);
    const tp = getSocketPos(toNode, false, w.toSocket);
    const fs = worldToScreen(fp.x, fp.y);
    const ts = worldToScreen(tp.x, tp.y);
    const outDef = fromNode.def.outputs[w.fromSocket];
    const color = TYPES[outDef?.type]?.color || '#aaa';
    drawWire(fs.x, fs.y, ts.x, ts.y, color, 0.7, executing);
  });

  // Drag wire
  if (dragWire) {
    const node = nodes.find(n => n.id === dragWire.fromNode);
    if (node) {
      const sp = getSocketPos(node, dragWire.fromIsOutput, dragWire.fromSocket);
      const ss = worldToScreen(sp.x, sp.y);
      const sockDef = dragWire.fromIsOutput ? node.def.outputs[dragWire.fromSocket] : node.def.inputs[dragWire.fromSocket];
      const color = TYPES[sockDef?.type]?.color || '#aaa';
      if (dragWire.fromIsOutput) {
        drawWire(ss.x, ss.y, dragWire.mx, dragWire.my, color, 0.5, false);
      } else {
        drawWire(dragWire.mx, dragWire.my, ss.x, ss.y, color, 0.5, false);
      }
    }
  }

  // Draw nodes (back to front)
  nodes.forEach(drawNode);

  // Selection box
  if (dragging?.type === 'select') {
    const x = Math.min(dragging.sx, dragging.mx);
    const y = Math.min(dragging.sy, dragging.my);
    const w = Math.abs(dragging.mx - dragging.sx);
    const h = Math.abs(dragging.my - dragging.sy);
    ctx.strokeStyle = '#6080ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(96,128,255,0.1)';
    ctx.fillRect(x, y, w, h);
  }

  drawMinimap();
  updateStatus();
  requestAnimationFrame(render);
}

function updateStatus() {
  const txt = `Nodes: ${nodes.length} | Wires: ${wires.length} | Zoom: ${(cam.zoom*100).toFixed(0)}% | ${executing ? 'EXECUTING...' : 'Ready'}`;
  document.getElementById('statusText').textContent = txt;
}

// ==================== HIT TESTING ====================
function hitSocket(wx, wy) {
  const r = 8;
  for (let ni = nodes.length - 1; ni >= 0; ni--) {
    const node = nodes[ni];
    // Outputs
    for (let i = 0; i < node.def.outputs.length; i++) {
      const sp = getSocketPos(node, true, i);
      if (Math.hypot(wx - sp.x, wy - sp.y) < r) return { node, socketIdx: i, isOutput: true };
    }
    // Inputs
    for (let i = 0; i < node.def.inputs.length; i++) {
      const sp = getSocketPos(node, false, i);
      if (Math.hypot(wx - sp.x, wy - sp.y) < r) return { node, socketIdx: i, isOutput: false };
    }
  }
  return null;
}

function hitNode(wx, wy) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const nh = nodeHeight(n);
    if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + nh) return n;
  }
  return null;
}

function hitHeader(node, wx, wy) {
  return wy >= node.y && wy <= node.y + 26;
}

function hitParamSlider(node, wx, wy) {
  if (node.collapsed) return null;
  const paramStartY = node.y + 26 + Math.max(node.def.inputs.length, node.def.outputs.length) * 22;
  for (let i = 0; i < node.def.params.length; i++) {
    const p = node.def.params[i];
    if (p.type !== 'slider') continue;
    const py = paramStartY + i * 24;
    if (wx >= node.x + 10 && wx <= node.x + node.w - 10 && wy >= py + 14 && wy <= py + 24) {
      const frac = Math.max(0, Math.min(1, (wx - node.x - 10) / (node.w - 20)));
      return { param: p, frac, paramIdx: i };
    }
  }
  return null;
}

// ==================== MOUSE HANDLING ====================
let mouseDown = false;
let mouseButton = 0;

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX, my = e.clientY;
  const wp = screenToWorld(mx, my);
  mouseDown = true;
  mouseButton = e.button;

  // Close add menu on click outside
  const addMenu = document.getElementById('addMenu');
  if (addMenu.classList.contains('show')) {
    const mr = addMenu.getBoundingClientRect();
    if (mx < mr.left || mx > mr.right || my < mr.top || my > mr.bottom) {
      addMenu.classList.remove('show');
    }
    return;
  }

  // Middle click or space+left = pan
  if (e.button === 1 || (e.button === 0 && spaceHeld)) {
    dragging = { type: 'pan', lastX: mx, lastY: my };
    e.preventDefault();
    return;
  }

  if (e.button !== 0) return;

  // Check socket hit first
  const sock = hitSocket(wp.x, wp.y);
  if (sock) {
    if (sock.isOutput) {
      dragWire = { fromNode: sock.node.id, fromSocket: sock.socketIdx, fromIsOutput: true, mx, my };
    } else {
      // If already connected, disconnect and start dragging from the other end
      const existing = wires.findIndex(w => w.toNode === sock.node.id && w.toSocket === sock.socketIdx);
      if (existing >= 0) {
        pushUndo();
        const w = wires.splice(existing, 1)[0];
        dragWire = { fromNode: w.fromNode, fromSocket: w.fromSocket, fromIsOutput: true, mx, my };
      } else {
        dragWire = { fromNode: sock.node.id, fromSocket: sock.socketIdx, fromIsOutput: false, mx, my };
      }
    }
    return;
  }

  // Check node hit
  const hitN = hitNode(wp.x, wp.y);
  if (hitN) {
    // Check header collapse
    if (hitHeader(hitN, wp.x, wp.y) && e.detail === 2) {
      hitN.collapsed = !hitN.collapsed;
      return;
    }

    // Check slider drag
    const sl = hitParamSlider(hitN, wp.x, wp.y);
    if (sl) {
      pushUndo();
      dragging = { type: 'slider', node: hitN, param: sl.param };
      const val = sl.param.min + sl.frac * (sl.param.max - sl.param.min);
      hitN.params[sl.param.name] = Math.round(val);
      evaluateGraph();
      updateProps();
      return;
    }

    // Select
    if (!selectedNodes.has(hitN.id)) {
      if (!e.shiftKey) selectedNodes.clear();
      selectedNodes.add(hitN.id);
    }

    // Bring to front
    const idx = nodes.indexOf(hitN);
    if (idx >= 0) { nodes.splice(idx, 1); nodes.push(hitN); }

    dragging = { type: 'node', startX: wp.x, startY: wp.y, nodeStarts: new Map() };
    selectedNodes.forEach(id => {
      const n = nodes.find(nn => nn.id === id);
      if (n) dragging.nodeStarts.set(id, { x: n.x, y: n.y });
    });

    updateProps();
    return;
  }

  // Empty space — box select
  selectedNodes.clear();
  dragging = { type: 'select', sx: mx, sy: my, mx, my };
  updateProps();
});

canvas.addEventListener('mousemove', e => {
  const mx = e.clientX, my = e.clientY;
  const wp = screenToWorld(mx, my);

  if (dragWire) {
    dragWire.mx = mx;
    dragWire.my = my;
    return;
  }

  if (!dragging) return;

  if (dragging.type === 'pan') {
    const dx = mx - dragging.lastX;
    const dy = my - dragging.lastY;
    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
    dragging.lastX = mx;
    dragging.lastY = my;
    return;
  }

  if (dragging.type === 'node') {
    const dx = wp.x - dragging.startX;
    const dy = wp.y - dragging.startY;
    selectedNodes.forEach(id => {
      const n = nodes.find(nn => nn.id === id);
      const start = dragging.nodeStarts.get(id);
      if (n && start) {
        n.x = Math.round((start.x + dx) / 10) * 10; // snap to grid
        n.y = Math.round((start.y + dy) / 10) * 10;
      }
    });
    return;
  }

  if (dragging.type === 'select') {
    dragging.mx = mx;
    dragging.my = my;
    // Select nodes in box
    selectedNodes.clear();
    const x1 = Math.min(dragging.sx, dragging.mx);
    const y1 = Math.min(dragging.sy, dragging.my);
    const x2 = Math.max(dragging.sx, dragging.mx);
    const y2 = Math.max(dragging.sy, dragging.my);
    nodes.forEach(n => {
      const ns = worldToScreen(n.x, n.y);
      const ne = worldToScreen(n.x + n.w, n.y + nodeHeight(n));
      if (ns.x < x2 && ne.x > x1 && ns.y < y2 && ne.y > y1) selectedNodes.add(n.id);
    });
    return;
  }

  if (dragging.type === 'slider') {
    const sl = dragging;
    const frac = Math.max(0, Math.min(1, (wp.x - sl.node.x - 10) / (sl.node.w - 20)));
    const val = sl.param.min + frac * (sl.param.max - sl.param.min);
    sl.node.params[sl.param.name] = sl.param.min % 1 === 0 && sl.param.max % 1 === 0 ? Math.round(val) : Math.round(val * 10) / 10;
    evaluateGraph();
    updateProps();
  }
});

canvas.addEventListener('mouseup', e => {
  const mx = e.clientX, my = e.clientY;
  const wp = screenToWorld(mx, my);

  if (dragWire) {
    const sock = hitSocket(wp.x, wp.y);
    if (sock) {
      // Try to connect
      if (dragWire.fromIsOutput && !sock.isOutput) {
        tryConnect(dragWire.fromNode, dragWire.fromSocket, sock.node.id, sock.socketIdx);
      } else if (!dragWire.fromIsOutput && sock.isOutput) {
        tryConnect(sock.node.id, sock.socketIdx, dragWire.fromNode, dragWire.fromSocket);
      }
    }
    dragWire = null;
  }

  if (dragging?.type === 'node') pushUndo();
  dragging = null;
  mouseDown = false;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const newZoom = Math.max(0.1, Math.min(5, cam.zoom * factor));
  // Zoom toward mouse
  const wp = screenToWorld(e.clientX, e.clientY);
  cam.zoom = newZoom;
  const wp2 = screenToWorld(e.clientX, e.clientY);
  cam.x -= (wp2.x - wp.x);
  cam.y -= (wp2.y - wp.y);
}, { passive: false });

canvas.addEventListener('contextmenu', e => e.preventDefault());

// ==================== KEYBOARD ====================
document.addEventListener('keydown', e => {
  if (e.code === 'Space') { spaceHeld = true; e.preventDefault(); }

  // Ignore if typing in input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  if (e.code === 'Delete' || e.code === 'Backspace') {
    if (selectedNodes.size) {
      pushUndo();
      nodes = nodes.filter(n => !selectedNodes.has(n.id));
      wires = wires.filter(w => !selectedNodes.has(w.fromNode) && !selectedNodes.has(w.toNode));
      selectedNodes.clear();
      updateProps();
    }
  }

  if (e.key === 'a' && e.shiftKey) {
    e.preventDefault();
    showAddMenu(null, null);
  }

  if (e.key === 'd' && e.ctrlKey) {
    e.preventDefault();
    duplicateSelected();
  }

  if (e.key === 'z' && e.ctrlKey && e.shiftKey) { e.preventDefault(); redo(); }
  else if (e.key === 'z' && e.ctrlKey) { e.preventDefault(); undo(); }
  else if (e.key === 'y' && e.ctrlKey) { e.preventDefault(); redo(); }

  if (e.code === 'Tab') {
    e.preventDefault();
    propsVisible = !propsVisible;
    document.getElementById('propsPanel').classList.toggle('hidden', !propsVisible);
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'Space') spaceHeld = false;
});

// ==================== CONNECTIONS ====================
function tryConnect(fromNodeId, fromSocket, toNodeId, toSocket) {
  if (fromNodeId === toNodeId) return;
  const fromNode = nodes.find(n => n.id === fromNodeId);
  const toNode = nodes.find(n => n.id === toNodeId);
  if (!fromNode || !toNode) return;
  const outType = fromNode.def.outputs[fromSocket]?.type;
  const inType = toNode.def.inputs[toSocket]?.type;
  if (!outType || !inType) return;
  // Type compatibility
  if (outType !== inType && outType !== 'any' && inType !== 'any') return;

  pushUndo();
  // Remove existing connection to this input
  wires = wires.filter(w => !(w.toNode === toNodeId && w.toSocket === toSocket));
  wires.push({ fromNode: fromNodeId, fromSocket, toNode: toNodeId, toSocket });

  // Check for cycles
  if (hasCycle()) {
    wires.pop();
    return;
  }

  evaluateGraph();
}

function hasCycle() {
  const visited = new Set();
  const stack = new Set();
  function dfs(id) {
    if (stack.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id); stack.add(id);
    for (const w of wires) {
      if (w.fromNode === id && dfs(w.toNode)) return true;
    }
    stack.delete(id);
    return false;
  }
  for (const n of nodes) { if (dfs(n.id)) return true; }
  return false;
}

// ==================== GRAPH EVALUATION ====================
function topologicalSort() {
  const inDeg = {};
  nodes.forEach(n => inDeg[n.id] = 0);
  wires.forEach(w => inDeg[w.toNode] = (inDeg[w.toNode] || 0) + 1);
  const queue = nodes.filter(n => inDeg[n.id] === 0).map(n => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    wires.filter(w => w.fromNode === id).forEach(w => {
      inDeg[w.toNode]--;
      if (inDeg[w.toNode] === 0) queue.push(w.toNode);
    });
  }
  return order;
}

function evaluateGraph() {
  const order = topologicalSort();
  const results = {};

  order.forEach(nodeId => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Gather inputs
    const inputs = {};
    node.def.inputs.forEach((inp, i) => {
      const w = wires.find(ww => ww.toNode === nodeId && ww.toSocket === i);
      if (w) inputs[inp.name] = results[w.fromNode + '_' + w.fromSocket];
    });

    // Evaluate
    const out = evaluateNode(node, inputs);
    node.def.outputs.forEach((o, i) => {
      results[nodeId + '_' + i] = out[i];
    });

    // Update preview
    if (node.def.previewH && out[0] === undefined && node.def.inputs.length) {
      // Output node uses input image as preview
      const imgIn = inputs[node.def.inputs[0].name];
      if (imgIn instanceof HTMLCanvasElement || imgIn instanceof HTMLImageElement) {
        node.cachedResult = imgIn;
      }
    }
  });
}

function evaluateNode(node, inputs) {
  const p = node.params;
  const dk = node.defKey;

  try {
    // SPRITE
    if (dk === 'sprite_input') {
      const c = generateSprite(p.character);
      node.cachedResult = c;
      return [c];
    }
    if (dk === 'color_shift') {
      const img = inputs['Image'];
      if (!img) return [null];
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        let [h, s, l] = rgbToHsl(px[i], px[i+1], px[i+2]);
        h = (h + p.hue / 360 + 1) % 1;
        s = Math.max(0, Math.min(1, s + p.saturation / 100));
        l = Math.max(0, Math.min(1, l + p.brightness / 200));
        const [r2, g2, b2] = hslToRgb(h, s, l);
        px[i] = r2; px[i+1] = g2; px[i+2] = b2;
      }
      g.putImageData(d, 0, 0);
      return [c];
    }
    if (dk === 'scale') {
      const img = inputs['Image'];
      if (!img) return [null];
      const f = p.factor;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * f));
      c.height = Math.max(1, Math.round(img.height * f));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return [c];
    }
    if (dk === 'flip') {
      const img = inputs['Image'];
      if (!img) return [null];
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.translate(p.horizontal ? img.width : 0, p.vertical ? img.height : 0);
      g.scale(p.horizontal ? -1 : 1, p.vertical ? -1 : 1);
      g.drawImage(img, 0, 0);
      return [c];
    }
    if (dk === 'crop') {
      const img = inputs['Image'];
      if (!img) return [null];
      const c = document.createElement('canvas');
      c.width = Math.min(p.w, img.width); c.height = Math.min(p.h, img.height);
      c.getContext('2d').drawImage(img, -p.x, -p.y);
      return [c];
    }
    if (dk === 'overlay') {
      const base = inputs['Base'];
      const top = inputs['Top'];
      if (!base) return [null];
      const c = document.createElement('canvas');
      c.width = base.width; c.height = base.height;
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0);
      if (top) {
        const blendModes = { normal: 'source-over', multiply: 'multiply', screen: 'screen', add: 'lighter' };
        g.globalCompositeOperation = blendModes[p.mode] || 'source-over';
        g.drawImage(top, 0, 0);
        g.globalCompositeOperation = 'source-over';
      }
      return [c];
    }
    if (dk === 'sprite_sheet_split') {
      const img = inputs['Image'];
      if (!img) return [null];
      const fw = Math.floor(img.width / p.cols);
      const fh = Math.floor(img.height / p.rows);
      const idx = p.index % (p.rows * p.cols);
      const col = idx % p.cols;
      const row = Math.floor(idx / p.cols);
      const c = document.createElement('canvas');
      c.width = fw; c.height = fh;
      c.getContext('2d').drawImage(img, -col * fw, -row * fh);
      return [c];
    }

    // EFFECT
    if (dk === 'glow') {
      const img = inputs['Image'];
      if (!img) return [null];
      const pad = Math.ceil(p.radius * 2);
      const c = document.createElement('canvas');
      c.width = img.width + pad * 2; c.height = img.height + pad * 2;
      const g = c.getContext('2d');
      g.shadowColor = p.color;
      g.shadowBlur = p.radius;
      g.globalAlpha = p.intensity / 100;
      g.drawImage(img, pad, pad);
      g.globalAlpha = 1;
      g.shadowBlur = 0;
      g.drawImage(img, pad, pad);
      return [c];
    }
    if (dk === 'shadow') {
      const img = inputs['Image'];
      if (!img) return [null];
      const pad = 30;
      const c = document.createElement('canvas');
      c.width = img.width + pad * 2; c.height = img.height + pad * 2;
      const g = c.getContext('2d');
      g.shadowColor = p.color;
      g.shadowBlur = p.blur;
      g.shadowOffsetX = p.offsetX;
      g.shadowOffsetY = p.offsetY;
      g.drawImage(img, pad, pad);
      g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0;
      g.drawImage(img, pad, pad);
      return [c];
    }
    if (dk === 'outline') {
      const img = inputs['Image'];
      if (!img) return [null];
      const w = p.width;
      const c = document.createElement('canvas');
      c.width = img.width + w * 2; c.height = img.height + w * 2;
      const g = c.getContext('2d');
      // Draw shifted copies for outline
      g.globalCompositeOperation = 'source-over';
      const offsets = [[-w,0],[w,0],[0,-w],[0,w],[-w,-w],[w,-w],[-w,w],[w,w]];
      offsets.forEach(([ox, oy]) => g.drawImage(img, w + ox, w + oy));
      // Tint to outline color
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = p.color;
      g.fillRect(0, 0, c.width, c.height);
      // Draw original on top
      g.globalCompositeOperation = 'source-over';
      g.drawImage(img, w, w);
      return [c];
    }
    if (dk === 'pixelate') {
      const img = inputs['Image'];
      if (!img) return [null];
      const s = Math.max(1, p.size);
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const tw = Math.max(1, Math.floor(img.width / s));
      const th = Math.max(1, Math.floor(img.height / s));
      const tmp = document.createElement('canvas');
      tmp.width = tw; tmp.height = th;
      tmp.getContext('2d').drawImage(img, 0, 0, tw, th);
      g.drawImage(tmp, 0, 0, c.width, c.height);
      return [c];
    }
    if (dk === 'crt_filter') {
      const img = inputs['Image'];
      if (!img) return [null];
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      const intens = p.intensity / 100;
      // Chromatic aberration
      const shift = Math.round(intens * 3);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(img, 0, 0);
      if (shift > 0) {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.3 * intens;
        g.drawImage(img, shift, 0);
        g.drawImage(img, -shift, 0);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      // Scanlines
      g.fillStyle = `rgba(0,0,0,${0.3 * intens})`;
      for (let y = 0; y < c.height; y += 2) {
        g.fillRect(0, y, c.width, 1);
      }
      return [c];
    }
    if (dk === 'palette_swap') {
      const img = inputs['Image'];
      if (!img) return [null];
      const palettes = {
        teal: [[0,180,180],[0,120,140],[0,60,80],[200,255,255],[40,80,80]],
        volcanic: [[200,60,0],[140,30,0],[80,10,0],[255,200,60],[60,20,0]],
        frost: [[160,200,255],[100,160,220],[60,100,160],[240,250,255],[40,60,100]],
        toxic: [[60,200,0],[40,140,0],[20,80,0],[180,255,60],[10,40,0]],
        ghost: [[180,180,200],[120,120,160],[80,80,120],[240,240,255],[40,40,60]]
      };
      const pal = palettes[p.palette] || palettes.teal;
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i+3] < 10) continue;
        const lum = (px[i] * 0.299 + px[i+1] * 0.587 + px[i+2] * 0.114) / 255;
        const idx = Math.min(pal.length - 1, Math.floor(lum * pal.length));
        px[i] = pal[idx][0]; px[i+1] = pal[idx][1]; px[i+2] = pal[idx][2];
      }
      g.putImageData(d, 0, 0);
      return [c];
    }

    // COLOR
    if (dk === 'color_node') return [p.value];
    if (dk === 'gradient') {
      const c = document.createElement('canvas');
      c.width = p.width; c.height = p.height;
      const g = c.getContext('2d');
      const colA = inputs['Color A'] || '#ff0000';
      const colB = inputs['Color B'] || '#0000ff';
      const grad = g.createLinearGradient(0, 0, c.width, 0);
      grad.addColorStop(0, colA);
      grad.addColorStop(1, colB);
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
      return [c];
    }
    if (dk === 'mix_color') {
      const a = inputs['A'] || '#ff0000';
      const b = inputs['B'] || '#0000ff';
      const f = p.factor / 100;
      const ca = parseColor(a), cb = parseColor(b);
      const r = Math.round(ca[0] * (1-f) + cb[0] * f);
      const g = Math.round(ca[1] * (1-f) + cb[1] * f);
      const bl = Math.round(ca[2] * (1-f) + cb[2] * f);
      return [`rgb(${r},${g},${bl})`];
    }

    // MATH
    if (dk === 'number_node') return [p.value];
    if (dk === 'math_op') {
      const a = inputs['A'] ?? 0;
      const b = inputs['B'] ?? 0;
      const ops = { '+': a+b, '-': a-b, '*': a*b, '/': b !== 0 ? a/b : 0, mod: b !== 0 ? a%b : 0, pow: Math.pow(a,b), min: Math.min(a,b), max: Math.max(a,b) };
      return [ops[p.op] ?? 0];
    }
    if (dk === 'map_range') {
      const v = inputs['Value'] ?? 0;
      const range = p.fromMax - p.fromMin;
      const mapped = range !== 0 ? p.toMin + (v - p.fromMin) / range * (p.toMax - p.toMin) : p.toMin;
      return [mapped];
    }

    // OUTPUT
    if (dk === 'preview') {
      const img = inputs['Image'];
      if (img) node.cachedResult = img;
      return [];
    }
    if (dk === 'export_node') {
      const img = inputs['Image'];
      if (img) node.cachedResult = img;
      return [];
    }
    if (dk === 'anim_preview') {
      const frames = [inputs['Frame 1'], inputs['Frame 2'], inputs['Frame 3'], inputs['Frame 4']].filter(Boolean);
      if (frames.length) {
        // Show current animation frame
        const frameIdx = Math.floor(Date.now() / (1000 / p.fps)) % frames.length;
        node.cachedResult = frames[frameIdx];
      }
      return [];
    }

    // AUDIO
    if (dk === 'oscillator') return [{ type: 'osc', waveform: p.waveform, frequency: p.frequency, gain: p.gain / 100 }];
    if (dk === 'filter') {
      const audio = inputs['Audio'];
      if (!audio) return [null];
      return [{ ...audio, filter: { type: p.type, cutoff: p.cutoff, Q: p.Q / 10 } }];
    }
    if (dk === 'mix_audio') {
      const a = inputs['A'], b = inputs['B'];
      return [{ type: 'mix', a, b, crossfade: p.crossfade / 100 }];
    }
    if (dk === 'audio_output') {
      const audio = inputs['Audio'];
      if (audio && executing) buildAudioGraph(audio, p.volume / 100);
      return [];
    }

    // GAME
    if (dk === 'game_state') return [p.initial];
    if (dk === 'timer') return [(Date.now() - execTime) / 1000];
    if (dk === 'random_node') return [p.min + Math.random() * (p.max - p.min)];
    if (dk === 'condition') {
      const v = inputs['Value'] ?? 0;
      const t = p.threshold;
      const cmps = { '>': v>t, '<': v<t, '==': v==t, '!=': v!=t, '>=': v>=t, '<=': v<=t };
      return [cmps[p.comparison] ? 1 : 0];
    }
  } catch(e) {
    console.warn('Node eval error:', dk, e);
  }
  return [null];
}

// ==================== AUDIO ENGINE ====================
function buildAudioGraph(desc, volume) {
  if (!desc) return;
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Stop existing
  stopAudio();

  function build(d) {
    if (!d) return null;
    if (d.type === 'osc') {
      const osc = audioCtx.createOscillator();
      osc.type = d.waveform;
      osc.frequency.value = d.frequency;
      const gain = audioCtx.createGain();
      gain.gain.value = d.gain * volume;
      osc.connect(gain);
      let output = gain;
      if (d.filter) {
        const filt = audioCtx.createBiquadFilter();
        filt.type = d.filter.type;
        filt.frequency.value = d.filter.cutoff;
        filt.Q.value = d.filter.Q;
        gain.connect(filt);
        output = filt;
      }
      osc.start();
      activeAudioNodes.push(osc);
      return output;
    }
    if (d.type === 'mix') {
      const a = build(d.a);
      const b = build(d.b);
      const merger = audioCtx.createGain();
      merger.gain.value = 1;
      if (a) { const g = audioCtx.createGain(); g.gain.value = 1 - d.crossfade; a.connect(g); g.connect(merger); }
      if (b) { const g = audioCtx.createGain(); g.gain.value = d.crossfade; b.connect(g); g.connect(merger); }
      return merger;
    }
    // Pass through filter
    if (d.filter) {
      const base = build({ ...d, filter: undefined });
      if (!base) return null;
      const filt = audioCtx.createBiquadFilter();
      filt.type = d.filter.type;
      filt.frequency.value = d.filter.cutoff;
      filt.Q.value = d.filter.Q;
      base.connect(filt);
      return filt;
    }
    return null;
  }

  const out = build(desc);
  if (out) out.connect(audioCtx.destination);
}

function stopAudio() {
  activeAudioNodes.forEach(n => { try { n.stop(); } catch(e) {} });
  activeAudioNodes = [];
}

// ==================== EXECUTE ====================
function executeGraph() {
  executing = true;
  execTime = Date.now();
  stopAudio();
  evaluateGraph();
  setTimeout(() => { executing = false; stopAudio(); }, 3000);
}

// ==================== COLOR UTILS ====================
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
  let h, s, l = (mx+mn)/2;
  if (mx === mn) { h = s = 0; }
  else {
    const d = mx - mn;
    s = l > 0.5 ? d / (2-mx-mn) : d / (mx+mn);
    switch(mx) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => { if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p; };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const pp = 2*l-q;
    r = hue2rgb(pp, q, h+1/3);
    g = hue2rgb(pp, q, h);
    b = hue2rgb(pp, q, h-1/3);
  }
  return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
}

function parseColor(c) {
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
  }
  const m = c.match(/(\d+)/g);
  return m ? m.map(Number) : [0,0,0];
}

// ==================== ADD NODE MENU ====================
function showAddMenu(pos, filterCat) {
  const menu = document.getElementById('addMenu');
  const search = document.getElementById('addMenuSearch');
  const list = document.getElementById('addMenuList');

  if (!pos) {
    // Center of viewport
    const r = canvas.getBoundingClientRect();
    pos = { x: r.left + r.width / 2 - 130, y: r.top + r.height / 2 - 200 };
  }

  menu.style.left = pos.x + 'px';
  menu.style.top = pos.y + 'px';
  menu.classList.add('show');
  search.value = '';
  search.focus();

  addMenuPos = screenToWorld(pos.x + 130, pos.y + 50);

  function populate(filter) {
    list.innerHTML = '';
    Object.entries(NODE_DEFS).forEach(([key, def]) => {
      if (filterCat && def.cat !== filterCat) return;
      if (filter && !def.label.toLowerCase().includes(filter.toLowerCase()) && !def.cat.includes(filter.toLowerCase())) return;
      const item = document.createElement('div');
      item.className = 'addMenuItem';
      item.innerHTML = `<span class="dot" style="background:${CAT_COLORS[def.cat]}"></span>${def.label}<span class="catLabel">${def.cat}</span>`;
      item.addEventListener('click', () => {
        pushUndo();
        const n = createNode(key, addMenuPos.x, addMenuPos.y);
        if (n) { nodes.push(n); selectedNodes.clear(); selectedNodes.add(n.id); evaluateGraph(); updateProps(); }
        menu.classList.remove('show');
      });
      list.appendChild(item);
    });
  }

  populate('');
  search.oninput = () => populate(search.value);
  search.onkeydown = e => {
    if (e.key === 'Escape') menu.classList.remove('show');
    if (e.key === 'Enter') {
      const first = list.querySelector('.addMenuItem');
      if (first) first.click();
    }
  };
}

// ==================== PROPERTIES PANEL ====================
function updateProps() {
  const cont = document.getElementById('propsContent');
  if (selectedNodes.size !== 1) {
    cont.innerHTML = `<p style="color:#666;font-size:11px;">${selectedNodes.size ? selectedNodes.size + ' nodes selected' : 'Select a node to view properties'}</p>`;
    return;
  }

  const nodeId = [...selectedNodes][0];
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;

  let html = `<div style="color:${CAT_COLORS[node.def.cat]};font-weight:bold;margin-bottom:6px;">${node.def.label}</div>`;
  html += `<div style="color:#555;font-size:10px;margin-bottom:10px;">ID: ${node.id} | ${node.def.cat}</div>`;

  node.def.params.forEach(p => {
    html += `<div class="propRow"><label>${p.name}</label>`;
    if (p.type === 'slider') {
      html += `<input type="range" min="${p.min}" max="${p.max}" value="${node.params[p.name]}" data-param="${p.name}" class="propInput">`;
      html += `<span style="color:#aaa;font-size:10px;">${node.params[p.name]}</span>`;
    } else if (p.type === 'number') {
      html += `<input type="number" min="${p.min}" max="${p.max}" step="${p.step||1}" value="${node.params[p.name]}" data-param="${p.name}" class="propInput">`;
    } else if (p.type === 'select') {
      html += `<select data-param="${p.name}" class="propInput">${p.options.map(o => `<option${o===node.params[p.name]?' selected':''}>${o}</option>`).join('')}</select>`;
    } else if (p.type === 'color') {
      html += `<input type="color" value="${node.params[p.name]}" data-param="${p.name}" class="propInput">`;
    } else if (p.type === 'bool') {
      html += `<input type="checkbox" ${node.params[p.name] ? 'checked' : ''} data-param="${p.name}" class="propInput" style="width:auto;">`;
    } else if (p.type === 'text') {
      html += `<input type="text" value="${node.params[p.name]}" data-param="${p.name}" class="propInput">`;
    }
    html += '</div>';
  });

  // Export button for export node
  if (node.defKey === 'export_node' && node.cachedResult) {
    html += `<button onclick="exportImage(${node.id})" style="width:100%;padding:6px;background:#2a4a2a;color:#ccc;border:1px solid #4a4;border-radius:3px;cursor:pointer;margin-top:8px;">Download PNG</button>`;
  }

  cont.innerHTML = html;

  // Bind inputs
  cont.querySelectorAll('.propInput').forEach(inp => {
    const handler = () => {
      pushUndo();
      const pName = inp.dataset.param;
      const pDef = node.def.params.find(pp => pp.name === pName);
      if (inp.type === 'checkbox') node.params[pName] = inp.checked;
      else if (pDef && (pDef.type === 'number' || pDef.type === 'slider')) node.params[pName] = parseFloat(inp.value);
      else node.params[pName] = inp.value;
      evaluateGraph();
      updateProps();
    };
    inp.addEventListener('input', handler);
    inp.addEventListener('change', handler);
  });
}

function exportImage(nodeId) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node || !node.cachedResult) return;
  const a = document.createElement('a');
  const c = node.cachedResult;
  a.href = c.toDataURL ? c.toDataURL() : '';
  a.download = node.params.filename || 'output.png';
  a.click();
}
window.exportImage = exportImage;

// ==================== DUPLICATE ====================
function duplicateSelected() {
  if (!selectedNodes.size) return;
  pushUndo();
  const newSelection = new Set();
  const idMap = {};
  selectedNodes.forEach(id => {
    const n = nodes.find(nn => nn.id === id);
    if (!n) return;
    const dup = createNode(n.defKey, n.x + 30, n.y + 30);
    if (!dup) return;
    Object.assign(dup.params, { ...n.params });
    idMap[id] = dup.id;
    nodes.push(dup);
    newSelection.add(dup.id);
  });
  // Duplicate internal wires
  wires.forEach(w => {
    if (idMap[w.fromNode] && idMap[w.toNode]) {
      wires.push({ fromNode: idMap[w.fromNode], fromSocket: w.fromSocket, toNode: idMap[w.toNode], toSocket: w.toSocket });
    }
  });
  selectedNodes = newSelection;
  evaluateGraph();
}

// ==================== SAVE / LOAD ====================
function saveGraph() {
  const data = {
    nodes: nodes.map(n => ({ defKey: n.defKey, x: n.x, y: n.y, params: n.params, collapsed: n.collapsed })),
    wires: wires.map(w => ({ ...w })),
    cam: { ...cam }
  };
  localStorage.setItem('gpt_node_editor_save', JSON.stringify(data));
  alert('Graph saved!');
}

function loadGraph() {
  const raw = localStorage.getItem('gpt_node_editor_save');
  if (!raw) { alert('No saved graph found.'); return; }
  loadFromJSON(JSON.parse(raw));
}

function loadFromJSON(data) {
  nodes = [];
  wires = [];
  selectedNodes.clear();
  nextId = 1;

  data.nodes.forEach(nd => {
    const n = createNode(nd.defKey, nd.x, nd.y);
    if (!n) return;
    Object.assign(n.params, nd.params || {});
    n.collapsed = nd.collapsed || false;
    nodes.push(n);
  });

  // Map old wire references (index-based in presets)
  data.wires.forEach(w => {
    // Presets use node index, saved graphs use node IDs
    const fromNode = w.fromNode <= nodes.length ? nodes[w.fromNode - 1]?.id : w.fromNode;
    const toNode = w.toNode <= nodes.length ? nodes[w.toNode - 1]?.id : w.toNode;
    if (fromNode && toNode) wires.push({ fromNode, fromSocket: w.fromSocket, toNode, toSocket: w.toSocket });
  });

  if (data.cam) cam = { ...data.cam };
  evaluateGraph();
  updateProps();
}

function newGraph() {
  pushUndo();
  nodes = [];
  wires = [];
  selectedNodes.clear();
  cam = { x: 0, y: 0, zoom: 1 };
  updateProps();
}

// ==================== PRESETS ====================
function loadPreset(name) {
  if (name === 'charVariant') {
    newGraph();
    const n1 = createNode('sprite_input', -200, -50); nodes.push(n1);
    const n2 = createNode('color_shift', 50, -50); nodes.push(n2);
    const n3 = createNode('glow', 300, -50); nodes.push(n3);
    const n4 = createNode('preview', 550, -50); nodes.push(n4);
    wires.push({ fromNode: n1.id, fromSocket: 0, toNode: n2.id, toSocket: 0 });
    wires.push({ fromNode: n2.id, fromSocket: 0, toNode: n3.id, toSocket: 0 });
    wires.push({ fromNode: n3.id, fromSocket: 0, toNode: n4.id, toSocket: 0 });
    n2.params.hue = 60;
    n3.params.color = '#00ffaa';
    evaluateGraph();
  }
  if (name === 'spriteOverlay') {
    newGraph();
    const n1 = createNode('sprite_input', -200, -100); n1.params.character = 'defender'; nodes.push(n1);
    const n2 = createNode('sprite_input', -200, 100); n2.params.character = 'dimmak'; nodes.push(n2);
    const n3 = createNode('overlay', 100, 0); nodes.push(n3);
    const n4 = createNode('crt_filter', 350, 0); nodes.push(n4);
    const n5 = createNode('preview', 600, 0); nodes.push(n5);
    wires.push({ fromNode: n1.id, fromSocket: 0, toNode: n3.id, toSocket: 0 });
    wires.push({ fromNode: n2.id, fromSocket: 0, toNode: n3.id, toSocket: 1 });
    wires.push({ fromNode: n3.id, fromSocket: 0, toNode: n4.id, toSocket: 0 });
    wires.push({ fromNode: n4.id, fromSocket: 0, toNode: n5.id, toSocket: 0 });
    evaluateGraph();
  }
  if (name === 'synthPad') {
    newGraph();
    const n1 = createNode('oscillator', -200, -50); n1.params.waveform = 'sawtooth'; n1.params.frequency = 220; nodes.push(n1);
    const n2 = createNode('filter', 80, -50); n2.params.type = 'lowpass'; n2.params.cutoff = 800; nodes.push(n2);
    const n3 = createNode('audio_output', 350, -50); nodes.push(n3);
    wires.push({ fromNode: n1.id, fromSocket: 0, toNode: n2.id, toSocket: 0 });
    wires.push({ fromNode: n2.id, fromSocket: 0, toNode: n3.id, toSocket: 0 });
    evaluateGraph();
  }
}

// ==================== TOUCH SUPPORT ====================
let touches = {};
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const fakeEvent = { clientX: t.clientX, clientY: t.clientY, button: 0, detail: 1, shiftKey: false, preventDefault: ()=>{} };

  if (e.touches.length === 2) {
    // Two finger = pan
    touches.panStart = { x: (e.touches[0].clientX + e.touches[1].clientX)/2, y: (e.touches[0].clientY + e.touches[1].clientY)/2 };
    touches.dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    return;
  }

  canvas.dispatchEvent(new MouseEvent('mousedown', fakeEvent));
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
    const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
    if (touches.panStart) {
      cam.x -= (cx - touches.panStart.x) / cam.zoom;
      cam.y -= (cy - touches.panStart.y) / cam.zoom;
      touches.panStart = { x: cx, y: cy };
    }
    const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (touches.dist) {
      cam.zoom = Math.max(0.1, Math.min(5, cam.zoom * (dist / touches.dist)));
      touches.dist = dist;
    }
    return;
  }
  const t = e.changedTouches[0];
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  touches = {};
  const t = e.changedTouches[0];
  if (t) canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });

// ==================== INIT ====================
render();
// Load the Character Variant preset by default so there's something to see
setTimeout(() => loadPreset('charVariant'), 100);

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
  var hbPeriod = 0.7067180051478502;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.013701012352433125;mix-blend-mode:overlay';
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