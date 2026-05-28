// Guinea Pig Trench — Fluid Blob Vials
// Volume + Pitch controls styled as mantra FM blobs with fluid physics
// The fluid sloshes when audio energy changes. Drag to adjust.

(function(){
  const volCanvas = document.getElementById('vial-vol');
  const pitCanvas = document.getElementById('vial-pit');
  if (!volCanvas || !pitCanvas) return;

  const volCtx = volCanvas.getContext('2d');
  const pitCtx = pitCanvas.getContext('2d');

  // State
  const vials = {
    vol: { value: 0.03, wave: 0, waveVel: 0, dragging: false, canvas: volCanvas, ctx: volCtx, label: 'VOL', color: '#00d2ff' },
    pit: { value: 0.5, wave: 0, waveVel: 0, dragging: false, canvas: pitCanvas, ctx: pitCtx, label: 'PIT', color: '#ff60a0' },
  };

  // Trench FM morph keyframes — exact CSS @keyframes morph values
  // border-radius: TL TR BR BL / TL TR BR BL (horizontal / vertical)
  const MORPH_SHAPES = [
    [0.63, 0.37, 0.29, 0.71, 0.61, 0.31, 0.69, 0.39], // 0%/100%
    [0.43, 0.57, 0.64, 0.36, 0.51, 0.63, 0.37, 0.49], // 33%
    [0.56, 0.44, 0.47, 0.53, 0.39, 0.56, 0.44, 0.61], // 66%
  ];

  // Trench FM blob colors (per-entity identity)
  const BLOB_COLORS = {
    vol: { accent: '#00e5cc', glow: 'rgba(0,229,204,.35)', gradCenter: '#081f1e', gradEdge: '#020c0b' }, // CORE blob
    pit: { accent: '#f0365e', glow: 'rgba(240,54,94,.35)',  gradCenter: '#1e0813', gradEdge: '#0e040a' }, // VOLUME blob
  };

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── Bezier Lenticular Lens ──
  // Each vial gets rendered to an offscreen buffer, then sliced through
  // variable-width strips with parallax offset. Audio bass = tilt.
  const N_FRAMES = 5; // lenticular frame count (odd for center symmetry)
  const offVol = document.createElement('canvas');
  const offVolX = offVol.getContext('2d');
  const offPit = document.createElement('canvas');
  const offPitX = offPit.getContext('2d');

  // Bezier ease for strip width variation
  function bezierEase(t, p1x, p1y, p2x, p2y) {
    let s = t;
    for (let i = 0; i < 6; i++) {
      const s2 = s * s, s3 = s2 * s;
      const xs = 3 * (1-s) * (1-s) * s * p1x + 3 * (1-s) * s2 * p2x + s3;
      const dxds = 3 * (1-s) * (1-s) * p1x + 6 * (1-s) * s * (p2x - p1x) + 3 * s2 * (1 - p2x);
      if (Math.abs(dxds) < 1e-6) break;
      s -= (xs - t) / dxds;
      s = Math.max(0, Math.min(1, s));
    }
    const s2 = s * s, s3 = s2 * s;
    return 3 * (1-s) * (1-s) * s * p1y + 3 * (1-s) * s2 * p2y + s3;
  }

  // Expression curve for the lens (onset_to_peak — Dilla snap)
  const LENS_BZ = [0.33, 0.95, 0.55, 1.25];

  function getMorphShape(t) {
    const cycleT = (t % 12) / 12; // 12 second cycle
    const idx = Math.floor(cycleT * MORPH_SHAPES.length);
    const frac = (cycleT * MORPH_SHAPES.length) % 1;
    const a = MORPH_SHAPES[idx % MORPH_SHAPES.length];
    const b = MORPH_SHAPES[(idx + 1) % MORPH_SHAPES.length];
    return a.map((v, i) => lerp(v, b[i], frac));
  }

  function drawVialRaw(key, t, targetCtx, W, H) {
    const v = vials[key];
    const c = targetCtx;
    c.clearRect(0, 0, W, H);

    const morph = getMorphShape(t + (key === 'pit' ? 4 : 0)); // offset pit blob phase

    // Vial body area
    const pad = 3;
    const vx = pad, vy = 8, vw = W - pad * 2, vh = H - 16;

    // Draw morphing blob outline using bezier curves
    const cx = vx + vw / 2, cy = vy + vh / 2;
    const rx = vw / 2, ry = vh / 2;

    c.beginPath();
    // Top-left corner
    const tl = morph[0] * rx, tr = morph[1] * rx;
    const bl = morph[2] * rx, br = morph[3] * rx;
    const tlY = morph[4] * ry, trY = morph[5] * ry;
    const blY = morph[6] * ry, brY = morph[7] * ry;

    c.moveTo(cx, cy - ry);
    c.bezierCurveTo(cx + tr, cy - trY, cx + rx, cy - trY * 0.5, cx + rx, cy);
    c.bezierCurveTo(cx + rx, cy + brY * 0.5, cx + br, cy + ry, cx, cy + ry);
    c.bezierCurveTo(cx - bl, cy + ry, cx - rx, cy + blY * 0.5, cx - rx, cy);
    c.bezierCurveTo(cx - rx, cy - tlY * 0.5, cx - tl, cy - ry, cx, cy - ry);
    c.closePath();

    // Trench FM radial gradient fill (off-center highlight like the real blobs)
    const bc = BLOB_COLORS[key] || BLOB_COLORS.vol;
    const grad = c.createRadialGradient(cx - rx*0.15, cy - ry*0.2, rx*0.1, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, bc.gradCenter);
    grad.addColorStop(0.8, bc.gradEdge);
    grad.addColorStop(1, 'rgba(2,4,8,0.98)');
    c.fillStyle = grad;
    c.fill();

    // Conic gradient ring (Trench FM volume blob style) — shows value as arc fill
    c.save();
    c.globalAlpha = 0.5;
    const ringR = Math.max(rx, ry) + 5;
    const fillAngle = (v.value * 270) * (Math.PI / 180); // 0-270 degrees like Trench FM
    const startAngle = 135 * (Math.PI / 180); // from 135deg like Trench FM
    // Filled arc
    c.strokeStyle = v.color;
    c.lineWidth = 2;
    c.shadowColor = v.color;
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(cx, cy, ringR, startAngle, startAngle + fillAngle);
    c.stroke();
    // Dim remainder
    c.globalAlpha = 0.1;
    c.shadowBlur = 0;
    c.beginPath();
    c.arc(cx, cy, ringR, startAngle + fillAngle, startAngle + 270 * (Math.PI / 180));
    c.stroke();
    c.restore();

    // Clip to blob shape for fluid
    c.save();
    c.clip();

    // Fluid level
    const fluidTop = vy + vh * (1 - v.value);

    // Draw fluid with wavy surface
    c.beginPath();
    const waveAmp = Math.min(3, Math.abs(v.wave) * 15 + (window.AUDIO_ENERGY || 0) * 2);
    for (let x = vx; x <= vx + vw; x++) {
      const localX = (x - vx) / vw;
      const waveY = Math.sin(localX * 8 + v.wave * 6 + t * 3) * waveAmp;
      const surfY = fluidTop + waveY;
      if (x === vx) c.moveTo(x, surfY);
      else c.lineTo(x, surfY);
    }
    c.lineTo(vx + vw, vy + vh + 5);
    c.lineTo(vx, vy + vh + 5);
    c.closePath();

    // Fluid gradient — brighter, more visible at low levels
    const fluidGrad = c.createLinearGradient(0, fluidTop, 0, vy + vh);
    const col = v.color;
    fluidGrad.addColorStop(0, col + 'ee');
    fluidGrad.addColorStop(0.2, col + 'bb');
    fluidGrad.addColorStop(0.6, col + '88');
    fluidGrad.addColorStop(1, col + '55');
    c.fillStyle = fluidGrad;
    c.fill();

    // Surface highlight
    c.beginPath();
    for (let x = vx; x <= vx + vw; x++) {
      const localX = (x - vx) / vw;
      const waveY = Math.sin(localX * 8 + v.wave * 6 + t * 3) * waveAmp;
      const surfY = fluidTop + waveY;
      if (x === vx) c.moveTo(x, surfY);
      else c.lineTo(x, surfY);
    }
    c.strokeStyle = col;
    c.lineWidth = 2;
    c.shadowColor = col;
    c.shadowBlur = 10;
    c.stroke();
    c.shadowBlur = 0;

    // Second highlight pass — bright white meniscus
    c.beginPath();
    for (let x = vx; x <= vx + vw; x++) {
      const localX = (x - vx) / vw;
      const waveY = Math.sin(localX * 8 + v.wave * 6 + t * 3) * waveAmp;
      const surfY = fluidTop + waveY;
      if (x === vx) c.moveTo(x, surfY);
      else c.lineTo(x, surfY);
    }
    c.strokeStyle = '#ffffffdd';
    c.lineWidth = 1.2;
    c.stroke();

    // Bubbles (small circles rising — lower threshold so they show at quiet levels)
    const energy = window.AUDIO_ENERGY || 0;
    if (energy > 0.01) {
      const bubbleCount = Math.max(1, Math.floor(energy * 8));
      c.fillStyle = col + '88';
      for (let i = 0; i < bubbleCount; i++) {
        const bx = vx + 4 + ((t * 30 + i * 17) % (vw - 8));
        const by = fluidTop + 3 + ((t * 20 + i * 23) % (vh * v.value - 6));
        const br = 1 + Math.sin(t * 4 + i) * 0.5;
        c.beginPath();
        c.arc(bx, by, br, 0, Math.PI * 2);
        c.fill();
      }
    }

    c.restore(); // un-clip

    // Blob border (glow)
    c.beginPath();
    c.moveTo(cx, cy - ry);
    c.bezierCurveTo(cx + tr, cy - trY, cx + rx, cy - trY * 0.5, cx + rx, cy);
    c.bezierCurveTo(cx + rx, cy + brY * 0.5, cx + br, cy + ry, cx, cy + ry);
    c.bezierCurveTo(cx - bl, cy + ry, cx - rx, cy + blY * 0.5, cx - rx, cy);
    c.bezierCurveTo(cx - rx, cy - tlY * 0.5, cx - tl, cy - ry, cx, cy - ry);
    c.closePath();
    c.strokeStyle = col + '88';
    c.lineWidth = 1.5;
    c.shadowColor = col;
    c.shadowBlur = 14;
    c.stroke();
    c.shadowBlur = 0;

    // Label above
    c.fillStyle = col + '66';
    c.font = '7px "Courier New", monospace';
    c.textAlign = 'center';
    c.fillText(v.label, cx, 7);

    // Value below
    let valText;
    if (key === 'vol') {
      valText = Math.round(v.value * 100) + '%';
    } else {
      const semitones = Math.round((v.value - 0.5) * 24);
      valText = (semitones > 0 ? '+' : '') + semitones;
    }
    c.fillStyle = col + '55';
    c.font = '7px "Courier New", monospace';
    c.textAlign = 'center';
    c.fillText(valText, cx, H - 1);
  }

  // Draw vial with lenticular lens overlay
  function drawVial(key, t) {
    const v = vials[key];
    const W = v.canvas.width;
    const H = v.canvas.height;
    const off = key === 'vol' ? offVol : offPit;
    const offX = key === 'vol' ? offVolX : offPitX;

    // Size offscreen wider for parallax margin
    const margin = 8;
    off.width = W + margin * 2;
    off.height = H;

    // Render the full vial into the wider offscreen buffer
    drawVialRaw(key, t, offX, off.width, H);

    // Lenticular compositing onto the visible canvas
    const c = v.ctx;
    c.clearRect(0, 0, W, H);

    // Tilt from audio bass (the music tilts the lens)
    const bass = (window.AUDIO_BASS || 0) / 255;
    const tiltOffset = (bass - 0.1) * 12; // ±5px shift from bass (stronger)

    // Bezier-varied strip widths: wider at center, narrower at edges
    let x = 0, frameIdx = 0;
    while (x < W) {
      const screenPos = x / W;
      const distFromCenter = Math.abs(screenPos - 0.5) * 2;
      const widthCurve = 1 - bezierEase(Math.min(1, distFromCenter), LENS_BZ[0], LENS_BZ[1], LENS_BZ[2], LENS_BZ[3]);
      const stripW = Math.max(1, Math.round(1 + widthCurve * 3)); // 1-4px (wider range)

      // Parallax depth varies by strip width (more depth at center)
      const depthMul = 0.3 + widthCurve * 1.2;
      const stripAngle = ((frameIdx % N_FRAMES) / (N_FRAMES - 1)) * 2 - 1;
      const srcX = x + margin + Math.round(stripAngle * 4 * depthMul + tiltOffset);

      c.drawImage(off, Math.max(0, Math.min(off.width - stripW, srcX)), 0, stripW, H, x, 0, stripW, H);

      x += stripW;
      frameIdx++;
    }

    // Subtle lens refraction tint at edges (glass effect)
    const edgeGrad = c.createLinearGradient(0, 0, W, 0);
    edgeGrad.addColorStop(0, v.color + '18');
    edgeGrad.addColorStop(0.3, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(0.7, 'rgba(0,0,0,0)');
    edgeGrad.addColorStop(1, v.color + '18');
    c.fillStyle = edgeGrad;
    c.fillRect(0, 0, W, H);
  }

  // Fluid physics
  function updatePhysics() {
    const energy = window.AUDIO_ENERGY || 0;
    const bass = (window.AUDIO_BASS || 0) / 255;

    const high = (window.AUDIO_HIGH || 0) / 255;
    const mid = (window.AUDIO_MID || 0) / 255;

    // Volume vial responds to BASS — low end drives the body
    vials.vol.waveVel += (bass - 0.1) * 0.03;
    vials.vol.wave += vials.vol.waveVel;
    vials.vol.waveVel *= 0.86;
    vials.vol.wave *= 0.92;

    // Pitch vial responds to HIGH + MID — top end drives the shimmer
    vials.pit.waveVel += (high - 0.08) * 0.035 + (mid - 0.1) * 0.015;
    vials.pit.wave += vials.pit.waveVel;
    vials.pit.waveVel *= 0.90; // slightly less damping = more jittery (high freq character)
    vials.pit.wave *= 0.94;
  }

  // ── Capture System ──
  // Auto-captures vial frames for 4 seconds once music starts.
  // Composites into a review strip and auto-downloads.
  const CAPTURE_DURATION = 4; // seconds
  const CAPTURE_INTERVAL = 0.5; // seconds between captures
  const CAPTURE_FRAMES = Math.ceil(CAPTURE_DURATION / CAPTURE_INTERVAL);
  let captureState = 'waiting'; // waiting, capturing, done (resets each page load)
  let captureStart = 0;
  let capturedFrames = []; // {volData, pitData, time, bass, energy}

  function checkMusicStarted() {
    return typeof musicPlayer !== 'undefined' && musicPlayer.playing;
  }

  function captureFrame(t) {
    const volData = volCanvas.toDataURL('image/png');
    const pitData = pitCanvas.toDataURL('image/png');
    capturedFrames.push({
      volData, pitData,
      time: t - captureStart,
      bass: (window.AUDIO_BASS || 0),
      mid: (window.AUDIO_MID || 0),
      high: (window.AUDIO_HIGH || 0),
      energy: (window.AUDIO_ENERGY || 0),
      volValue: vials.vol.value,
      pitValue: vials.pit.value,
      volWave: vials.vol.wave,
      pitWave: vials.pit.wave,
    });
  }

  function buildReviewStrip() {
    // Composite: 8 pairs of vials across, with data annotations
    const vW = volCanvas.width;
    const vH = volCanvas.height;
    const gap = 4;
    const labelH = 40;
    const cols = capturedFrames.length;
    const stripW = cols * (vW * 2 + gap * 3) + gap;
    const stripH = vH + labelH + gap * 2;

    const strip = document.createElement('canvas');
    strip.width = stripW;
    strip.height = stripH;
    const sx = strip.getContext('2d');

    // Dark background
    sx.fillStyle = '#03060f';
    sx.fillRect(0, 0, stripW, stripH);

    let loaded = 0;
    const total = cols * 2;

    capturedFrames.forEach((frame, i) => {
      const xOff = i * (vW * 2 + gap * 3) + gap;

      // Load vol image
      const volImg = new Image();
      volImg.onload = () => {
        sx.drawImage(volImg, xOff, gap);
        // Frame border
        sx.strokeStyle = '#00d2ff33';
        sx.strokeRect(xOff, gap, vW, vH);
        loaded++;
        if (loaded === total) finishStrip(strip, sx);
      };
      volImg.src = frame.volData;

      // Load pit image
      const pitImg = new Image();
      pitImg.onload = () => {
        sx.drawImage(pitImg, xOff + vW + gap, gap);
        sx.strokeStyle = '#ff60a033';
        sx.strokeRect(xOff + vW + gap, gap, vW, vH);
        loaded++;
        if (loaded === total) finishStrip(strip, sx);
      };
      pitImg.src = frame.pitData;
    });
  }

  function finishStrip(strip, sx) {
    const vW = volCanvas.width;
    const vH = volCanvas.height;
    const gap = 4;

    // Annotate each frame with telemetry
    capturedFrames.forEach((frame, i) => {
      const xOff = i * (vW * 2 + gap * 3) + gap;
      const yOff = vH + gap + 2;

      sx.fillStyle = '#00d2ff88';
      sx.font = '8px "Courier New", monospace';
      sx.textAlign = 'left';
      sx.fillText(`t=${frame.time.toFixed(1)}s`, xOff, yOff + 8);
      sx.fillText(`bass=${frame.bass.toFixed(0)}`, xOff, yOff + 16);
      sx.fillText(`nrg=${frame.energy.toFixed(2)}`, xOff, yOff + 24);

      sx.fillStyle = '#ff60a088';
      sx.fillText(`vol=${(frame.volValue*100).toFixed(0)}%`, xOff + vW + gap, yOff + 8);
      sx.fillText(`wav=${frame.volWave.toFixed(2)}`, xOff + vW + gap, yOff + 16);
      sx.fillText(`pit=${frame.pitWave.toFixed(2)}`, xOff + vW + gap, yOff + 24);
    });

    // Title bar
    sx.fillStyle = '#00d2ff44';
    sx.font = '9px "Courier New", monospace';
    sx.textAlign = 'center';
    sx.fillText('FLUID VIALS — LENTICULAR CAPTURE — ' + CAPTURE_FRAMES + ' frames / ' + CAPTURE_DURATION + 's',
      strip.width / 2, vH + gap + 36);

    // Download
    const url = strip.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vial_capture_' + Date.now() + '.png';
    a.click();
    console.log('FLUID VIALS: Review strip saved (' + capturedFrames.length + ' frames)');
  }

  // Animation loop
  let startTime = performance.now();
  let lastCapture = 0;
  function animate() {
    const t = (performance.now() - startTime) / 1000;
    updatePhysics();
    drawVial('vol', t);
    drawVial('pit', t);

    // SVG tendril between vials (Trench FM bezier connection)
    const tendrilPath = document.getElementById('vt-path');
    if (tendrilPath) {
      const volR = volCanvas.getBoundingClientRect();
      const pitR = pitCanvas.getBoundingClientRect();
      const svgEl = document.getElementById('vial-tendril');
      if (svgEl) {
        const svgR = svgEl.getBoundingClientRect();
        const ax = volR.right - svgR.left;
        const ay = volR.top + volR.height * (1 - vials.vol.value) - svgR.top;
        const bx = pitR.left - svgR.left;
        const by = pitR.top + pitR.height * (1 - vials.pit.value) - svgR.top;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        // Perpendicular offset for curve — wobbles with audio
        const bass = (window.AUDIO_BASS || 0) / 255;
        const wobble = Math.sin(t * 3) * (4 + bass * 8);
        const perpX = -(by - ay) * 0.3;
        const perpY = (bx - ax) * 0.3;
        tendrilPath.setAttribute('d',
          `M${ax} ${ay} Q${mx + wobble} ${my + wobble * 0.5} ${bx} ${by}`
        );
        // Color shifts with energy
        const energy = window.AUDIO_ENERGY || 0;
        const alpha = 0.15 + energy * 0.4;
        tendrilPath.setAttribute('stroke', `rgba(0,229,204,${alpha})`);
      }
    }

    // Capture system
    if (captureState === 'waiting' && checkMusicStarted()) {
      captureState = 'capturing';
      captureStart = t;
      lastCapture = t;
      capturedFrames = [];
      console.log('FLUID VIALS: Capture started — ' + CAPTURE_DURATION + 's');
    }
    if (captureState === 'capturing') {
      if (t - lastCapture >= CAPTURE_INTERVAL) {
        captureFrame(t);
        lastCapture = t;
        console.log('FLUID VIALS: Frame ' + capturedFrames.length + '/' + CAPTURE_FRAMES);
      }
      if (t - captureStart >= CAPTURE_DURATION) {
        captureState = 'done';
        console.log('FLUID VIALS: Capture complete — building review strip');
        buildReviewStrip();
      }
    }

    requestAnimationFrame(animate);
  }
  animate();

  // Drag interaction
  function setupDrag(key) {
    const v = vials[key];
    v.canvas.addEventListener('mousedown', e => {
      v.dragging = true;
      updateValue(key, e);
      e.preventDefault();
    });
    v.canvas.addEventListener('touchstart', e => {
      v.dragging = true;
      updateValueTouch(key, e);
      e.preventDefault();
    }, { passive: false });
  }

  function updateValue(key, e) {
    const v = vials[key];
    const rect = v.canvas.getBoundingClientRect();
    const relY = (e.clientY - rect.top - 8) / (rect.height - 16);
    v.value = Math.max(0, Math.min(1, 1 - relY));
    v.waveVel += 0.15; // slosh on drag
    applyValue(key);
  }

  function updateValueTouch(key, e) {
    const v = vials[key];
    const rect = v.canvas.getBoundingClientRect();
    const relY = (e.touches[0].clientY - rect.top - 8) / (rect.height - 16);
    v.value = Math.max(0, Math.min(1, 1 - relY));
    v.waveVel += 0.15;
    applyValue(key);
  }

  function applyValue(key) {
    if (key === 'vol') {
      if (typeof musicPlayer !== 'undefined') {
        musicPlayer.audio.volume = vials.vol.value;
      }
      // Sync hidden range input
      const el = document.getElementById('music-volume');
      if (el) el.value = Math.round(vials.vol.value * 100);
    } else {
      const semitones = Math.round((vials.pit.value - 0.5) * 24);
      if (typeof musicPlayer !== 'undefined') {
        musicPlayer.audio.playbackRate = Math.pow(2, semitones / 12);
      }
      // Sync hidden range input
      const el = document.getElementById('music-pitch');
      if (el) el.value = semitones;
      const label = document.getElementById('pitch-val');
      if (label) label.textContent = (semitones > 0 ? '+' : '') + semitones;
    }
  }

  setupDrag('vol');
  setupDrag('pit');

  addEventListener('mousemove', e => {
    for (const key of ['vol', 'pit']) {
      if (vials[key].dragging) updateValue(key, e);
    }
  });
  addEventListener('touchmove', e => {
    for (const key of ['vol', 'pit']) {
      if (vials[key].dragging) updateValueTouch(key, e);
    }
  }, { passive: false });
  addEventListener('mouseup', () => { vials.vol.dragging = false; vials.pit.dragging = false; });
  addEventListener('touchend', () => { vials.vol.dragging = false; vials.pit.dragging = false; });

  // Mouse wheel on vials
  volCanvas.addEventListener('wheel', e => {
    vials.vol.value = Math.max(0, Math.min(1, vials.vol.value - e.deltaY * 0.002));
    vials.vol.waveVel += e.deltaY * 0.0005;
    applyValue('vol');
    e.preventDefault();
  }, { passive: false });
  pitCanvas.addEventListener('wheel', e => {
    vials.pit.value = Math.max(0, Math.min(1, vials.pit.value - e.deltaY * 0.002));
    vials.pit.waveVel += e.deltaY * 0.0005;
    applyValue('pit');
    e.preventDefault();
  }, { passive: false });

  // Double-click to reset
  volCanvas.addEventListener('dblclick', () => {
    vials.vol.value = 0.03; vials.vol.waveVel = 0.2;
    applyValue('vol');
  });
  pitCanvas.addEventListener('dblclick', () => {
    vials.pit.value = 0.5; vials.pit.waveVel = 0.2;
    applyValue('pit');
  });
})();
