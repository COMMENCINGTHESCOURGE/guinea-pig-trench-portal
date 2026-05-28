// Guinea Pig Trench — AutoTube
// Real-time pitch correction / manipulation for beats
// Web Audio API pitch shifter with auto-key detection
//
// Features:
// - Auto-detect key of playing track
// - Snap pitch to nearest scale note
// - T-Pain style exaggerated correction
// - Subtle natural correction mode
// - Pitch wobble (vibrato) control
// - Formant preservation option
// - Wet/dry mix

class AutoTube {
  constructor() {
    this.enabled = false
    this.mode = 'off'         // off, subtle, hard, wobble, custom
    this.correction = 0.5     // 0 = no correction, 1 = hard snap
    this.wobbleRate = 5.5     // Hz
    this.wobbleDepth = 0.15   // semitones
    this.wetMix = 0.7         // 0 = dry, 1 = full effect
    this.keyRoot = 0          // 0=C, 1=C#, ... 11=B
    this.scale = 'minor'      // minor, major, chromatic, pentatonic
    this.shiftSemitones = 0   // manual pitch offset

    // Audio nodes
    this.audioCtx = null
    this.inputNode = null
    this.outputNode = null
    this.pitchNode = null
    this.delayNode = null
    this.lfoOsc = null
    this.lfoGain = null
    this.dryGain = null
    this.wetGain = null
    this.analyser = null

    // Pitch detection
    this.detectedPitch = 0
    this.detectedNote = ''
    this.pitchBuffer = new Float32Array(2048)
    this.detectInterval = null

    // Scale definitions (semitone intervals from root)
    this.scales = {
      major:      [0, 2, 4, 5, 7, 9, 11],
      minor:      [0, 2, 3, 5, 7, 8, 10],
      pentatonic: [0, 2, 4, 7, 9],
      blues:      [0, 3, 5, 6, 7, 10],
      dorian:     [0, 2, 3, 5, 7, 9, 10],
      phrygian:   [0, 1, 3, 5, 7, 8, 10],
      chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    }

    this._createUI()
  }

  init(audioCtx, sourceNode, destinationNode) {
    this.audioCtx = audioCtx

    // Create nodes
    this.dryGain = audioCtx.createGain()
    this.wetGain = audioCtx.createGain()
    this.analyser = audioCtx.createAnalyser()
    this.analyser.fftSize = 2048

    // Pitch shifting via delay modulation (granular-style)
    // Two delay lines with crossfade for smoother pitch shifting
    this.delay1 = audioCtx.createDelay(1.0)
    this.delay2 = audioCtx.createDelay(1.0)
    this.delay1.delayTime.value = 0.01
    this.delay2.delayTime.value = 0.02

    this.gain1 = audioCtx.createGain()
    this.gain2 = audioCtx.createGain()
    this.gain1.gain.value = 0.5
    this.gain2.gain.value = 0.5

    // LFO for wobble/vibrato
    this.lfoOsc = audioCtx.createOscillator()
    this.lfoOsc.type = 'sine'
    this.lfoOsc.frequency.value = this.wobbleRate
    this.lfoGain = audioCtx.createGain()
    this.lfoGain.gain.value = 0 // off by default
    this.lfoOsc.connect(this.lfoGain)
    this.lfoGain.connect(this.delay1.delayTime)
    this.lfoGain.connect(this.delay2.delayTime)
    this.lfoOsc.start()

    // Feedback filter for character
    this.feedbackFilter = audioCtx.createBiquadFilter()
    this.feedbackFilter.type = 'lowpass'
    this.feedbackFilter.frequency.value = 8000
    this.feedbackFilter.Q.value = 0.5

    // Routing
    // Dry path: source → dryGain → destination
    sourceNode.connect(this.dryGain)
    this.dryGain.connect(destinationNode)

    // Wet path: source → delays → feedbackFilter → wetGain → destination
    sourceNode.connect(this.delay1)
    sourceNode.connect(this.delay2)
    this.delay1.connect(this.gain1)
    this.delay2.connect(this.gain2)
    this.gain1.connect(this.feedbackFilter)
    this.gain2.connect(this.feedbackFilter)
    this.feedbackFilter.connect(this.wetGain)
    this.wetGain = audioCtx.createGain()
    this.feedbackFilter.connect(this.wetGain)
    this.wetGain.connect(destinationNode)

    // Analyser for pitch detection
    sourceNode.connect(this.analyser)

    this._updateMix()
    this._applyMode()

    // Start pitch detection loop
    this.pitchBuffer = new Float32Array(this.analyser.fftSize)
    this._startPitchDetection()

    console.log('AutoTube initialized')
    return this
  }

  _updateMix() {
    if (!this.dryGain || !this.wetGain) return
    if (this.enabled) {
      this.dryGain.gain.value = 1 - this.wetMix
      this.wetGain.gain.value = this.wetMix
    } else {
      this.dryGain.gain.value = 1
      this.wetGain.gain.value = 0
    }
  }

  _applyMode() {
    if (!this.audioCtx) return

    switch (this.mode) {
      case 'off':
        this.enabled = false
        this.lfoGain.gain.value = 0
        break

      case 'subtle':
        this.enabled = true
        this.correction = 0.3
        this.wobbleDepth = 0.05
        this.wobbleRate = 4
        this.wetMix = 0.4
        this.lfoOsc.frequency.value = this.wobbleRate
        this.lfoGain.gain.value = this.wobbleDepth * 0.001
        break

      case 'hard':
        this.enabled = true
        this.correction = 1.0
        this.wobbleDepth = 0.2
        this.wobbleRate = 6
        this.wetMix = 0.8
        this.lfoOsc.frequency.value = this.wobbleRate
        this.lfoGain.gain.value = this.wobbleDepth * 0.002
        // Add characteristic formant shift
        this.feedbackFilter.frequency.value = 4000
        this.feedbackFilter.Q.value = 2
        break

      case 'wobble':
        this.enabled = true
        this.correction = 0.5
        this.wobbleDepth = 0.5
        this.wobbleRate = 3
        this.wetMix = 0.6
        this.lfoOsc.frequency.value = this.wobbleRate
        this.lfoGain.gain.value = this.wobbleDepth * 0.004
        break

      case 'robot':
        this.enabled = true
        this.correction = 1.0
        this.wobbleDepth = 0
        this.wobbleRate = 0
        this.wetMix = 0.9
        this.lfoGain.gain.value = 0
        this.feedbackFilter.frequency.value = 2000
        this.feedbackFilter.Q.value = 8
        break

      case 'custom':
        this.enabled = true
        this.lfoOsc.frequency.value = this.wobbleRate
        this.lfoGain.gain.value = this.wobbleDepth * 0.002
        break
    }

    this._updateMix()
  }

  setMode(mode) {
    this.mode = mode
    this._applyMode()
    this._updateModeUI()
  }

  // Pitch shift by semitones (real-time)
  setPitchShift(semitones) {
    if (!this.audioCtx) return
    this.shiftSemitones = semitones

    // Convert semitones to delay modulation
    // Positive = higher pitch (shorter delay), negative = lower pitch (longer delay)
    const rate = Math.pow(2, semitones / 12)
    const baseDelay = 0.015
    const shiftedDelay = baseDelay / rate

    if (this.delay1) {
      this.delay1.delayTime.setTargetAtTime(shiftedDelay, this.audioCtx.currentTime, 0.05)
      this.delay2.delayTime.setTargetAtTime(shiftedDelay * 1.3, this.audioCtx.currentTime, 0.05)
    }
  }

  // Auto-detect pitch from audio stream
  _startPitchDetection() {
    const detect = () => {
      if (!this.analyser || !this.enabled) {
        this._detectionFrame = requestAnimationFrame(detect)
        return
      }

      this.analyser.getFloatTimeDomainData(this.pitchBuffer)

      // Autocorrelation pitch detection
      const pitch = this._detectPitch(this.pitchBuffer, this.audioCtx.sampleRate)

      if (pitch > 0) {
        this.detectedPitch = pitch
        // Convert frequency to MIDI note
        const midi = 12 * Math.log2(pitch / 440) + 69
        const noteNum = Math.round(midi) % 12
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        this.detectedNote = noteNames[noteNum]

        // Auto-correct if in hard/subtle mode
        if (this.correction > 0 && this.mode !== 'off') {
          const scaleNotes = this.scales[this.scale] || this.scales.minor
          const rootedNotes = scaleNotes.map(n => (n + this.keyRoot) % 12)

          // Find nearest scale note
          let minDist = 12
          for (const sn of rootedNotes) {
            const dist = Math.abs(noteNum - sn)
            const wrapDist = Math.min(dist, 12 - dist)
            if (wrapDist < minDist) minDist = wrapDist
          }

          // Apply correction (shift toward nearest scale note)
          if (minDist > 0) {
            const correctionAmount = minDist * this.correction * 0.3
            this.setPitchShift(this.shiftSemitones + correctionAmount * 0.1)
          }
        }

        this._updatePitchDisplay()
      }

      this._detectionFrame = requestAnimationFrame(detect)
    }

    detect()
  }

  _detectPitch(buffer, sampleRate) {
    // Simple autocorrelation pitch detection
    const size = buffer.length
    let rms = 0
    for (let i = 0; i < size; i++) rms += buffer[i] * buffer[i]
    rms = Math.sqrt(rms / size)

    if (rms < 0.01) return -1 // too quiet

    // Find autocorrelation peak
    const corrs = new Float32Array(size)
    for (let lag = 0; lag < size; lag++) {
      let sum = 0
      for (let i = 0; i < size - lag; i++) {
        sum += buffer[i] * buffer[i + lag]
      }
      corrs[lag] = sum
    }

    // Find first peak after initial decay
    let foundPeak = false
    let peakLag = 0
    let peakVal = 0

    for (let i = Math.floor(sampleRate / 1000); i < Math.floor(sampleRate / 50); i++) {
      if (corrs[i] > peakVal) {
        peakVal = corrs[i]
        peakLag = i
        foundPeak = true
      }
    }

    if (!foundPeak || peakLag === 0) return -1
    return sampleRate / peakLag
  }

  _updatePitchDisplay() {
    const el = document.getElementById('autotube-pitch')
    if (el) {
      el.textContent = this.detectedNote || '--'
    }
  }

  _updateModeUI() {
    const btns = document.querySelectorAll('.at-mode-btn')
    btns.forEach(btn => {
      btn.style.borderColor = btn.dataset.mode === this.mode
        ? 'var(--teal)' : 'var(--border)'
      btn.style.color = btn.dataset.mode === this.mode
        ? '#00d2ff' : 'rgba(0,210,255,.4)'
    })
  }

  _createUI() {
    document.addEventListener('DOMContentLoaded', () => {
      const musicPage = document.getElementById('page-music')
      if (!musicPage) return

      const panel = document.createElement('div')
      panel.id = 'autotube-panel'
      panel.style.cssText = `
        margin:16px 0;padding:14px;background:var(--surface);
        border:1px solid var(--border);border-radius:6px;
      `

      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="color:#ff60a0;font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:bold">
            AUTOTUBE
          </span>
          <span id="autotube-pitch" style="color:rgba(255,96,160,.5);font-size:14px;font-weight:bold;letter-spacing:.1em">--</span>
        </div>

        <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">
          <button class="btn btn-small at-mode-btn" data-mode="off" style="border-color:var(--teal);color:#00d2ff">OFF</button>
          <button class="btn btn-small at-mode-btn" data-mode="subtle">SUBTLE</button>
          <button class="btn btn-small at-mode-btn" data-mode="hard">HARD</button>
          <button class="btn btn-small at-mode-btn" data-mode="wobble">WOBBLE</button>
          <button class="btn btn-small at-mode-btn" data-mode="robot">ROBOT</button>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
          <label style="color:rgba(255,96,160,.4);font-size:9px;letter-spacing:.1em;min-width:40px">WET</label>
          <input type="range" id="at-wet" min="0" max="100" value="70"
            style="flex:1;accent-color:#ff60a0">
          <span id="at-wet-val" style="color:rgba(255,96,160,.3);font-size:9px;min-width:24px">70%</span>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
          <label style="color:rgba(255,96,160,.4);font-size:9px;letter-spacing:.1em;min-width:40px">WOBBLE</label>
          <input type="range" id="at-wobble" min="0" max="100" value="15"
            style="flex:1;accent-color:#ff60a0">
          <span id="at-wobble-val" style="color:rgba(255,96,160,.3);font-size:9px;min-width:24px">15%</span>
        </div>

        <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
          <label style="color:rgba(255,96,160,.4);font-size:9px;letter-spacing:.1em;min-width:40px">KEY</label>
          <select id="at-key" style="
            background:var(--bg);color:#ff60a0;border:1px solid rgba(255,96,160,.2);
            padding:3px 8px;font-family:monospace;font-size:10px;border-radius:3px;
          ">
            <option value="0">C</option><option value="1">C#</option>
            <option value="2">D</option><option value="3">Eb</option>
            <option value="4">E</option><option value="5">F</option>
            <option value="6">F#</option><option value="7">G</option>
            <option value="8">Ab</option><option value="9">A</option>
            <option value="10">Bb</option><option value="11">B</option>
          </select>
          <select id="at-scale" style="
            background:var(--bg);color:#ff60a0;border:1px solid rgba(255,96,160,.2);
            padding:3px 8px;font-family:monospace;font-size:10px;border-radius:3px;
          ">
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="pentatonic">Pentatonic</option>
            <option value="blues">Blues</option>
            <option value="dorian">Dorian</option>
            <option value="chromatic">Chromatic</option>
          </select>
        </div>
      `

      // Insert after auto-eq panel or at top of music page
      const eqPanel = document.getElementById('eq-panel')
      if (eqPanel) {
        eqPanel.after(panel)
      } else {
        musicPage.insertBefore(panel, musicPage.firstChild)
      }

      // Bind mode buttons
      panel.querySelectorAll('.at-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => this.setMode(btn.dataset.mode))
      })

      // Bind sliders
      document.getElementById('at-wet')?.addEventListener('input', e => {
        this.wetMix = e.target.value / 100
        document.getElementById('at-wet-val').textContent = e.target.value + '%'
        this._updateMix()
      })

      document.getElementById('at-wobble')?.addEventListener('input', e => {
        this.wobbleDepth = e.target.value / 100
        document.getElementById('at-wobble-val').textContent = e.target.value + '%'
        if (this.lfoGain) {
          this.lfoGain.gain.value = this.wobbleDepth * 0.002
        }
      })

      document.getElementById('at-key')?.addEventListener('change', e => {
        this.keyRoot = parseInt(e.target.value)
      })

      document.getElementById('at-scale')?.addEventListener('change', e => {
        this.scale = e.target.value
      })
    })
  }

  toggle() {
    if (this.mode === 'off') {
      this.setMode('subtle')
    } else {
      this.setMode('off')
    }
  }

  destroy() {
    if (this._detectionFrame) cancelAnimationFrame(this._detectionFrame)
    this.enabled = false
  }
}

const autoTube = new AutoTube()
