/**
 * SLUICE GATE LOADING SCREEN
 * ASCII tunnel zoom: ]]]]|#|[[[[  →  ]]|♯|[[  →  |_|  →  expand back out
 * The gate cycles: # → ♯ → _ → ♯ → # (closed → open → baseline → open → closed)
 * Brackets are the walls. The gap between them is the corridor.
 * You're flying through the sluice gate. What passes through defines the product.
 *
 * Guinea Pig Trench LLC
 */

(function() {
  'use strict';

  const GATE_SYMBOLS = ['#', '♯', '_', '♯'];
  const WALL_LEFT = ']';
  const WALL_RIGHT = '[';
  const PIPE = '|';

  // Colors
  const TEAL = '#00d9cc';
  const GOLD = '#f0c030';
  const CYAN_GLOW = '#4af';
  const DIM = 'rgba(255,255,255,0.15)';
  const BG = '#0a0a0f';

  // Config
  const NUM_RINGS = 10;        // depth layers (fewer = cleaner)
  const TUNNEL_SPEED = 0.25;   // base speed (slower = smoother)
  const GATE_CYCLE_RATE = 0.5; // how fast gate symbol changes
  const MAX_WALL_WIDTH = 14;   // max brackets per side
  const FONT_BASE = 18;        // base font size at nearest ring

  let canvas, ctx, w, h;
  let time = 0;
  let loaded = false;
  let fadeOut = 0;

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);
  }

  function resize() {
    w = canvas.width = canvas.offsetWidth * devicePixelRatio;
    h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  function getGateSymbol(t) {
    const idx = Math.floor(t * GATE_CYCLE_RATE) % GATE_SYMBOLS.length;
    return GATE_SYMBOLS[idx];
  }

  function getGateColor(symbol) {
    if (symbol === '#') return TEAL;
    if (symbol === '♯') return GOLD;
    if (symbol === '_') return DIM;
    return TEAL;
  }

  function loop(ts) {
    if (fadeOut >= 1) return; // done

    time = ts * 0.001;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Draw rings from back (smallest) to front (largest)
    for (let i = NUM_RINGS - 1; i >= 0; i--) {
      // Z-position cycles to create the zoom-through effect
      const z = ((i / NUM_RINGS) + time * TUNNEL_SPEED) % 1.0;
      const depth = 1 - z; // 0 = far, 1 = near

      // Skip rings that are too far
      if (depth < 0.05) continue;

      // Scale: near rings are large, far rings are small
      const scale = 0.1 + depth * 0.9;
      const fontSize = Math.max(8, Math.floor(FONT_BASE * scale * (w / 800)));
      ctx.font = `${fontSize}px monospace`;

      // Alpha: near = bright, far = dim
      const alpha = Math.pow(depth, 1.5) * 0.9;

      // How many wall brackets at this depth
      const wallCount = Math.max(1, Math.floor(MAX_WALL_WIDTH * depth));

      // Gate symbol cycles based on depth + time
      const gatePhase = time + i * 0.3;
      const gateSym = getGateSymbol(gatePhase);
      const gateColor = getGateColor(gateSym);

      // Build the frame string
      const leftWall = WALL_LEFT.repeat(wallCount);
      const rightWall = WALL_RIGHT.repeat(wallCount);
      const gate = `${PIPE}${gateSym}${PIPE}`;
      const frame = `${leftWall}${gate}${rightWall}`;

      // Y position: rings spread vertically based on their z
      const yOffset = (z - 0.5) * h * 0.6;
      const y = cy + yOffset;

      // Draw wall brackets
      const gateWidth = ctx.measureText(gate).width;
      const leftText = leftWall;
      const rightText = rightWall;
      const leftWidth = ctx.measureText(leftText).width;

      // Full frame as one string, drawn centered
      const fullFrame = `${leftWall}${gate}${rightWall}`;
      const chars = [...fullFrame];
      const charWidth = ctx.measureText('M').width;
      const totalWidth = chars.length * charWidth;
      const startX = cx - totalWidth / 2;

      for (let c = 0; c < chars.length; c++) {
        const ch = chars[c];
        const px = startX + c * charWidth;

        // Color by character type
        if (ch === WALL_LEFT || ch === WALL_RIGHT) {
          ctx.fillStyle = `rgba(0, 217, 204, ${alpha * 0.35})`;
        } else if (ch === PIPE) {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        } else if (ch === '#') {
          ctx.fillStyle = `rgba(0, 217, 204, ${alpha})`;
        } else if (ch === '♯') {
          ctx.fillStyle = `rgba(240, 192, 48, ${alpha})`;
        } else if (ch === '_') {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
        }

        ctx.fillText(ch, px + charWidth / 2, y);
      }

      // Glow on the gate at close range
      if (depth > 0.6) {
        const glowAlpha = (depth - 0.6) / 0.4 * 0.25;
        ctx.shadowColor = CYAN_GLOW;
        ctx.shadowBlur = fontSize;
        const gateX = cx;
        ctx.fillStyle = `rgba(74, 170, 255, ${glowAlpha})`;
        ctx.fillText(gateSym, gateX, y);
        ctx.shadowBlur = 0;
      }
    }

    // Center crosshair — the point you're flying toward
    const pulse = Math.sin(time * 3) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(0, 217, 204, ${pulse * 0.4})`;
    ctx.font = `${Math.floor(10 * (w / 800))}px monospace`;
    ctx.fillText('·', cx, cy);

    // Title overlay (fades in after a moment)
    const titleAlpha = Math.min(1, Math.max(0, time - 1.5) * 0.5);
    if (titleAlpha > 0) {
      const titleSize = Math.floor(24 * (w / 800));
      ctx.font = `bold ${titleSize}px monospace`;
      ctx.fillStyle = `rgba(255, 255, 255, ${titleAlpha * 0.9})`;
      ctx.fillText('GUINEA PIG TRENCH', cx, cy - h * 0.08);

      ctx.font = `${Math.floor(11 * (w / 800))}px monospace`;
      ctx.fillStyle = `rgba(0, 217, 204, ${titleAlpha * 0.6})`;
      ctx.fillText('what passes through the gate defines the product', cx, cy + h * 0.06);
    }

    // Loading progress bar (if loading)
    if (!loaded) {
      const barW = w * 0.3;
      const barH = 2;
      const barX = cx - barW / 2;
      const barY = cy + h * 0.15;
      // Indeterminate: bouncing segment
      const seg = barW * 0.3;
      const pos = (Math.sin(time * 2) + 1) / 2 * (barW - seg);

      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = TEAL;
      ctx.fillRect(barX + pos, barY, seg, barH);
    }

    // Fade out when loaded
    if (loaded) {
      fadeOut += 0.02;
      ctx.fillStyle = `rgba(10, 10, 15, ${fadeOut})`;
      ctx.fillRect(0, 0, w, h);
    }

    requestAnimationFrame(loop);
  }

  function markLoaded() {
    loaded = true;
  }

  // Export
  window.SluiceLoader = { init, markLoaded };
})();
