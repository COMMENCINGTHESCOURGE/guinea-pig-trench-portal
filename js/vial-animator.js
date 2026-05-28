// Guinea Pig Trench — Vial Animator
// 344 captured vial states interpolated into smooth looping animation
// Uses pre-captured lenticular fluid renders, crossfaded with canvas compositing

(function() {
  const SHEET_URL = 'assets/vials/vial_spritesheet.png'
  const FRAME_W = 64
  const FRAME_H = 100
  const COLS = 32
  const TOTAL_FRAMES = 408
  const FRAMES_PER_CAPTURE = 8  // each capture = 1 key + 7 glitch
  const TOTAL_CAPTURES = Math.floor(TOTAL_FRAMES / FRAMES_PER_CAPTURE) // 44

  // Interpolation settings
  const FPS = 24            // smooth playback
  const CYCLE_SECONDS = 6   // seconds per full capture cycle
  const TICKS_PER_CYCLE = FPS * CYCLE_SECONDS  // 144 ticks per capture
  // Key frame gets 85% of the cycle, glitch tilt gets 15%
  const KEY_RATIO = 0.85
  const KEY_TICKS = Math.floor(TICKS_PER_CYCLE * KEY_RATIO)   // ~122 ticks on clear
  const GLITCH_TICKS = TICKS_PER_CYCLE - KEY_TICKS            // ~22 ticks for tilt pass

  let sheet = null
  let sheetData = null  // ImageData for pixel-level interpolation
  let offscreen = null
  let offCtx = null
  let loaded = false
  let tick = 0
  let lastTime = 0

  // Load sprite sheet + extract pixel data
  const img = new Image()
  img.onload = () => {
    sheet = img
    // Create offscreen canvas to read pixel data
    offscreen = document.createElement('canvas')
    offscreen.width = img.width
    offscreen.height = img.height
    offCtx = offscreen.getContext('2d')
    offCtx.drawImage(img, 0, 0)
    sheetData = offCtx.getImageData(0, 0, img.width, img.height)
    loaded = true
  }
  img.src = SHEET_URL

  function getFramePos(idx) {
    const col = idx % COLS
    const row = Math.floor(idx / COLS)
    return { x: col * FRAME_W, y: row * FRAME_H }
  }

  // Interpolation buffer — reused per draw call
  let interpCanvas = null
  let interpCtx = null
  let interpData = null

  function ensureInterpBuffer() {
    if (!interpCanvas) {
      interpCanvas = document.createElement('canvas')
      interpCanvas.width = FRAME_W
      interpCanvas.height = FRAME_H
      interpCtx = interpCanvas.getContext('2d')
    }
  }

  /**
   * Pixel-level interpolation between two frames.
   * Returns the interpolation canvas ready to draw.
   */
  function interpolateFrames(idxA, idxB, t) {
    ensureInterpBuffer()

    const posA = getFramePos(idxA)
    const posB = getFramePos(idxB)
    const sd = sheetData.data
    const sw = sheetData.width

    interpData = interpCtx.createImageData(FRAME_W, FRAME_H)
    const out = interpData.data

    const invT = 1 - t

    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        const outIdx = (y * FRAME_W + x) * 4

        // Source pixel A
        const srcAIdx = ((posA.y + y) * sw + (posA.x + x)) * 4
        // Source pixel B
        const srcBIdx = ((posB.y + y) * sw + (posB.x + x)) * 4

        // Linear interpolation per channel
        out[outIdx]     = (sd[srcAIdx]     * invT + sd[srcBIdx]     * t) | 0  // R
        out[outIdx + 1] = (sd[srcAIdx + 1] * invT + sd[srcBIdx + 1] * t) | 0  // G
        out[outIdx + 2] = (sd[srcAIdx + 2] * invT + sd[srcBIdx + 2] * t) | 0  // B
        out[outIdx + 3] = (sd[srcAIdx + 3] * invT + sd[srcBIdx + 3] * t) | 0  // A
      }
    }

    interpCtx.putImageData(interpData, 0, 0)
    return interpCanvas
  }

  /**
   * Lenticular flip book with real interpolation:
   *
   * Frame 0 = the REAL image. Clear, crisp, centered lens.
   * Frames 1-7 = lens tilt distortion, progressively blurrier.
   *
   * Cycle:
   *   [70% of time] Hold on Key frame — interpolate between current and next key
   *                  for a slow, subtle fluid shift (cross-capture morph)
   *   [30% of time] Quick tilt pass — interpolate through glitch frames 1→7
   *                  then snap to next capture's key frame
   *
   * Like tilting a lenticular card: mostly still, brief flash of motion.
   */
  function drawVial(ctx, x, y, w, h, speed, offset) {
    if (!loaded) return

    speed = speed || 1
    offset = offset || 0

    const now = performance.now()
    if (now - lastTime > 1000 / FPS) {
      tick += speed
      lastTime = now
    }

    const captureOffset = Math.floor(offset) % TOTAL_CAPTURES
    const phase = tick % TICKS_PER_CYCLE
    const captureIdx = (Math.floor(tick / TICKS_PER_CYCLE) + captureOffset) % TOTAL_CAPTURES
    const nextCaptureIdx = (captureIdx + 1) % TOTAL_CAPTURES

    const baseA = captureIdx * FRAMES_PER_CAPTURE
    const baseB = nextCaptureIdx * FRAMES_PER_CAPTURE

    let frameA, frameB, t

    if (phase < KEY_TICKS) {
      // KEY PHASE — Pass 1: draw F0 directly from sprite sheet.
      // No pixel interpolation. Zero CPU math. Just drawImage.
      // 85% of the cycle runs on this — the cheap pass.
      const pos = getFramePos(baseA)
      ctx.drawImage(sheet, pos.x, pos.y, FRAME_W, FRAME_H, x, y, w, h)

    } else {
      // TILT PHASE — F0 is the anchor, glitch frames orbit around it
      // Sequence: F0→F1→F2→F3→F0→F4→F5→F6→F0→F7→nextKey
      // The clear image keeps coming back. The interpolation always
      // has F0 nearby to blend toward. Clarity is the constant.
      const tiltPhase = phase - KEY_TICKS
      const tiltProgress = tiltPhase / GLITCH_TICKS

      const eased = 1 - Math.pow(1 - tiltProgress, 3)

      const stops = [
        baseA,     // F0 (start clear)
        baseA + 1, // F1
        baseA + 2, // F2
        baseA + 3, // F3
        baseA,     // F0 (return to clear)
        baseA + 4, // F4
        baseA + 5, // F5
        baseA + 6, // F6
        baseA,     // F0 (return to clear)
        baseA + 7, // F7
        baseB,     // next capture's F0 (land clear)
      ]
      const INTERVALS = stops.length - 1
      const intervalFloat = eased * INTERVALS
      const intervalIdx = Math.min(Math.floor(intervalFloat), INTERVALS - 1)
      t = intervalFloat - intervalIdx

      frameA = stops[intervalIdx] % TOTAL_FRAMES
      frameB = stops[intervalIdx + 1] % TOTAL_FRAMES

      const interp = interpolateFrames(frameA, frameB, t)
      ctx.drawImage(interp, 0, 0, FRAME_W, FRAME_H, x, y, w, h)
    }
  }

  /**
   * Create a standalone animated vial element.
   * Returns a canvas element that self-animates.
   * @param {number} width - display width
   * @param {number} height - display height
   * @param {number} speed - playback speed
   * @param {number} offset - frame offset
   */
  function createVialElement(width, height, speed, offset) {
    const canvas = document.createElement('canvas')
    canvas.width = width || 64
    canvas.height = height || 100
    canvas.style.cssText = 'image-rendering:auto;'
    const ctx = canvas.getContext('2d')

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawVial(ctx, 0, 0, canvas.width, canvas.height, speed || 1, offset || 0)
      requestAnimationFrame(animate)
    }

    // Start when sheet loads
    if (loaded) {
      animate()
    } else {
      img.addEventListener('load', animate)
    }

    return canvas
  }

  // Expose globally
  window.VialAnimator = {
    draw: drawVial,
    createElement: createVialElement,
    isLoaded: () => loaded,
    totalFrames: TOTAL_FRAMES,
    totalCaptures: TOTAL_CAPTURES,
  }
})()
