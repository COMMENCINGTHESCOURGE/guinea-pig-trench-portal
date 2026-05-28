
(function () {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');

  const BAR_COUNT = 32;
  const DECAY = 0.85;
  const ATTACK = 0.15;
  const BG = '#0c0c12';
  const TEAL = [0, 210, 255];
  const PINK = [255, 96, 160];

  // Sprite loading
  const akuImg = new Image();
  akuImg.src = '../assets/sprites/aku_aku_mask_stylized.png';
  let akuLoaded = false;
  akuImg.onload = () => { akuLoaded = true; };
  akuImg.onerror = () => { akuLoaded = false; };

  let audioCtx, analyser, dataArray, source;
  let smoothed = new Float32Array(BAR_COUNT);
  let paused = false;
  let volume = 0;
  let bassLevel = 0;
  let borderGlow = 0;
  let running = false;

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
  }
  window.addEventListener('resize', resize);
  resize();

  async function init() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      overlay.classList.add('hidden');
      running = true;
      requestAnimationFrame(draw);
    } catch (e) {
      overlay.querySelector('p').textContent = 'Microphone access denied. Reload to retry.';
      overlay.querySelector('p').style.color = '#ff3333';
    }
  }

  overlay.addEventListener('click', init);

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && running) {
      e.preventDefault();
      paused = !paused;
      if (!paused) requestAnimationFrame(draw);
    }
  });

  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw() {
    if (paused) return;

    const W = canvas.width;
    const H = canvas.height;
    const dpr = devicePixelRatio;

    // Clear
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Get frequency data
    analyser.getByteFrequencyData(dataArray);

    // Map analyser bins to BAR_COUNT bars (pick evenly spaced bins from the lower half)
    const binCount = analyser.frequencyBinCount;
    let sum = 0;
    let bassSum = 0;
    const bassBins = Math.max(1, Math.floor(BAR_COUNT * 0.2));
    for (let i = 0; i < BAR_COUNT; i++) {
      const binIndex = Math.floor((i / BAR_COUNT) * binCount * 0.75);
      const raw = dataArray[binIndex] / 255;
      smoothed[i] = smoothed[i] * DECAY + raw * ATTACK;
      sum += smoothed[i];
      if (i < bassBins) bassSum += smoothed[i];
    }

    volume = sum / BAR_COUNT;
    bassLevel = bassSum / bassBins;
    borderGlow = borderGlow * 0.9 + volume * 0.1;

    // Pulsing border
    const bw = Math.max(2, 6 * borderGlow) * dpr;
    const borderAlpha = 0.3 + borderGlow * 0.7;
    const borderR = Math.round(lerp(TEAL[0], PINK[0], borderGlow));
    const borderG = Math.round(lerp(TEAL[1], PINK[1], borderGlow));
    const borderB = Math.round(lerp(TEAL[2], PINK[2], borderGlow));
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${borderR},${borderG},${borderB},${borderAlpha})`;
    ctx.lineWidth = bw;
    const inset = bw / 2;
    ctx.strokeRect(inset, inset, W - bw, H - bw);

    // Bar layout
    const margin = 40 * dpr;
    const topArea = 80 * dpr;
    const bottomArea = 50 * dpr;
    const barArea = W - margin * 2;
    const gap = 4 * dpr;
    const barW = (barArea - gap * (BAR_COUNT - 1)) / BAR_COUNT;
    const maxBarH = H - topArea - bottomArea;

    // Draw Aku Aku mask behind bars
    if (akuLoaded) {
      ctx.save();
      const maskSize = 200 * dpr;
      const maskScale = 1.0 + bassLevel * 0.15;
      const scaledSize = maskSize * maskScale;
      const maskX = W / 2 - scaledSize / 2;
      const maskY = H / 2 - scaledSize / 2;
      const mouthOffset = volume * 10 * dpr;

      ctx.globalAlpha = 0.4;
      // Draw top half of mask
      ctx.drawImage(akuImg,
        0, 0, akuImg.naturalWidth, akuImg.naturalHeight / 2,
        maskX, maskY, scaledSize, scaledSize / 2
      );
      // Draw bottom half offset downward for mouth-open effect
      ctx.drawImage(akuImg,
        0, akuImg.naturalHeight / 2, akuImg.naturalWidth, akuImg.naturalHeight / 2,
        maskX, maskY + scaledSize / 2 + mouthOffset, scaledSize, scaledSize / 2
      );
      ctx.globalAlpha = 1.0;
      ctx.restore();
    }

    // Draw bars
    for (let i = 0; i < BAR_COUNT; i++) {
      const val = smoothed[i];
      const barH = Math.max(2 * dpr, val * maxBarH);
      const x = margin + i * (barW + gap);
      const y = H - bottomArea - barH;

      // Color: teal at low, pink at high
      const t = val;
      const r = Math.round(lerp(TEAL[0], PINK[0], t));
      const g = Math.round(lerp(TEAL[1], PINK[1], t));
      const b = Math.round(lerp(TEAL[2], PINK[2], t));

      // Glow
      ctx.shadowColor = `rgba(${r},${g},${b},0.6)`;
      ctx.shadowBlur = 12 * dpr * val;

      // Gradient bar
      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.4)`);
      ctx.fillStyle = grad;

      const radius = Math.min(barW / 2, 4 * dpr);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
      ctx.lineTo(x + barW, y + barH);
      ctx.lineTo(x, y + barH);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();
    }

    ctx.shadowBlur = 0;

    // Title
    ctx.font = `bold ${20 * dpr}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00d2ff';
    ctx.shadowColor = 'rgba(0,210,255,0.3)';
    ctx.shadowBlur = 10 * dpr;
    ctx.fillText('MIC VISUALIZER', W / 2, 40 * dpr);
    ctx.shadowBlur = 0;

    // Volume meter
    const volPct = Math.min(100, Math.round(volume * 400));
    ctx.font = `${12 * dpr}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`VOL: ${volPct}%`, margin, 40 * dpr);

    // Volume bar
    const vbX = margin + 70 * dpr;
    const vbY = 32 * dpr;
    const vbW = 100 * dpr;
    const vbH = 8 * dpr;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(vbX, vbY, vbW, vbH);
    const fillW = Math.min(vbW, vbW * volume * 4);
    const vGrad = ctx.createLinearGradient(vbX, 0, vbX + fillW, 0);
    vGrad.addColorStop(0, '#00d2ff');
    vGrad.addColorStop(1, '#ff60a0');
    ctx.fillStyle = vGrad;
    ctx.fillRect(vbX, vbY, fillW, vbH);

    // Controls hint
    ctx.font = `${11 * dpr}px 'Segoe UI', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('SPACE to pause / resume', W / 2, H - 18 * dpr);

    // Paused indicator
    if (paused) {
      ctx.font = `bold ${28 * dpr}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,96,160,0.7)';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }

    requestAnimationFrame(draw);
  }
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
  wn.textContent = 'THE THRESHOLD';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = 0.6901164787022328;
  setInterval(function() {
    // pulse disabled for this game;
    setTimeout(function() { hb.style.opacity = '0'; }, 80);
  }, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:0.019305088993484362;mix-blend-mode:overlay';
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
