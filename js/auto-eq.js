// Guinea Pig Trench — Auto EQ
// Analyzes frequency content in real-time and adjusts parametric EQ bands
// to balance the mix for consistent playback across all tracks.
//
// 5-band parametric EQ:
//   Band 1: Sub Bass (30-80Hz) — tighten low end
//   Band 2: Low Mid (200-500Hz) — cut mud
//   Band 3: Mid (800-2kHz) — presence
//   Band 4: High Mid (2k-6kHz) — clarity/air
//   Band 5: High (8k-16kHz) — sparkle
//
// Auto mode analyzes spectrum and adjusts gains to match a target curve.

class AutoEQ {
  constructor() {
    this.audioCtx = null
    this.bands = []
    this.analyser = null
    this.enabled = true
    this.autoMode = true
    this.dataArray = null
    this.targetCurve = null
    this.smoothing = 0.05 // how fast EQ adjusts (0-1, lower = slower)

    // Band definitions
    this.bandDefs = [
      { name: 'Sub',      freq: 60,    Q: 0.8,  defaultGain: 0,  min: -6, max: 6 },
      { name: 'Low Mid',  freq: 300,   Q: 1.0,  defaultGain: -2, min: -8, max: 4 },
      { name: 'Mid',      freq: 1200,  Q: 1.2,  defaultGain: 0,  min: -6, max: 6 },
      { name: 'Presence', freq: 3500,  Q: 1.0,  defaultGain: 1,  min: -6, max: 8 },
      { name: 'Air',      freq: 10000, Q: 0.7,  defaultGain: 2,  min: -4, max: 8 },
    ]

    // Target spectral balance (what a "good" mix looks like)
    // Values are relative dB targets per band
    this.targetBalance = [0, -2, 0, 1, 2] // slight smile curve
  }

  init(audioCtx, sourceNode, destinationNode) {
    try {
      this.audioCtx = audioCtx

      // Create analyser for input monitoring
      this.analyser = audioCtx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.8
      this.dataArray = new Float32Array(this.analyser.frequencyBinCount)

      // Create EQ bands (BiquadFilterNodes)
      this.bands = this.bandDefs.map(def => {
        const filter = audioCtx.createBiquadFilter()
        filter.type = 'peaking'
        filter.frequency.value = def.freq
        filter.Q.value = def.Q
        filter.gain.value = def.defaultGain
        return { filter, def, currentGain: def.defaultGain }
      })

      // Chain: source → analyser → EQ bands → destination
      sourceNode.connect(this.analyser)

      let prev = this.analyser
      for (const band of this.bands) {
        prev.connect(band.filter)
        prev = band.filter
      }
      prev.connect(destinationNode)

      // Start auto-analysis loop
      this._analyzeLoop()
    } catch (err) {
      console.warn('AutoEQ: init failed — AudioContext or BiquadFilter creation error', err)
    }

    return this // for chaining
  }

  _analyzeLoop() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') return

    if (this.autoMode && this.enabled && this.audioCtx.state === 'running') {
      this._autoAdjust()
    }

    requestAnimationFrame(() => this._analyzeLoop())
  }

  _autoAdjust() {
    if (!this.analyser || !this.dataArray) return

    try {
    // Get frequency data in dB
    this.analyser.getFloatFrequencyData(this.dataArray)

    const sampleRate = this.audioCtx.sampleRate
    const binSize = sampleRate / this.analyser.fftSize

    // Measure energy in each band's frequency range
    const bandEnergies = this.bandDefs.map(def => {
      // Find the bin range for this band (±1 octave around center freq)
      const lowFreq = def.freq / 1.5
      const highFreq = def.freq * 1.5
      const lowBin = Math.max(1, Math.floor(lowFreq / binSize))
      const highBin = Math.min(this.dataArray.length - 1, Math.ceil(highFreq / binSize))

      // Average energy in this range
      let sum = 0
      let count = 0
      for (let i = lowBin; i <= highBin; i++) {
        if (isFinite(this.dataArray[i])) {
          sum += this.dataArray[i]
          count++
        }
      }
      return count > 0 ? sum / count : -100
    })

    // Check if audio is actually playing (not silence)
    const maxEnergy = Math.max(...bandEnergies)
    if (maxEnergy < -80) return // silence, don't adjust

    // Calculate overall average
    const avgEnergy = bandEnergies.reduce((a, b) => a + b) / bandEnergies.length

    // For each band, compare actual energy to target and adjust gain
    for (let i = 0; i < this.bands.length; i++) {
      const band = this.bands[i]
      const actual = bandEnergies[i]
      const target = avgEnergy + this.targetBalance[i]

      // How far off are we from the target balance?
      const diff = target - actual // positive = need more, negative = need less

      // Calculate desired gain adjustment
      let desiredGain = band.currentGain + diff * this.smoothing

      // Clamp to band limits
      desiredGain = Math.max(band.def.min, Math.min(band.def.max, desiredGain))

      // Smooth transition
      band.currentGain += (desiredGain - band.currentGain) * 0.1
      band.filter.gain.value = band.currentGain
    }
    } catch (err) {
      console.warn('AutoEQ: auto-adjust error', err)
    }
  }

  // Manual gain adjustment for a band
  setBandGain(index, gain) {
    if (index >= 0 && index < this.bands.length) {
      this.bands[index].currentGain = gain
      this.bands[index].filter.gain.value = gain
    }
  }

  // Get current band gains (for UI display)
  getBandGains() {
    return this.bands.map(b => ({
      name: b.def.name,
      freq: b.def.freq,
      gain: Math.round(b.currentGain * 10) / 10,
    }))
  }

  // Preset EQ curves
  applyPreset(name) {
    const presets = {
      flat:       [0, 0, 0, 0, 0],
      bass_boost: [4, 1, 0, 0, 1],
      vocal:      [-1, -2, 2, 3, 1],
      lo_fi:      [2, -1, -2, -1, -3],
      club:       [5, -2, 0, 2, 3],
      phone:      [-4, -2, 3, 4, 2],  // compensate for tiny speakers
      headphone:  [1, 0, -1, 1, 3],
      auto:       null, // re-enable auto mode
    }

    if (name === 'auto') {
      this.autoMode = true
      return
    }

    const gains = presets[name]
    if (!gains) return

    this.autoMode = false
    gains.forEach((g, i) => this.setBandGain(i, g))
  }

  toggle() {
    this.enabled = !this.enabled
    if (!this.enabled) {
      // Bypass: set all gains to 0
      this.bands.forEach(b => { b.filter.gain.value = 0 })
    }
  }

  // Create UI controls
  createUI(container) {
    if (!container) return

    const div = document.createElement('div')
    div.id = 'eq-panel'
    div.style.cssText = 'margin:16px 0;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:6px;'

    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="color:var(--teal);font-size:11px;letter-spacing:.15em;text-transform:uppercase">AUTO EQ</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-small eq-preset" data-preset="auto">Auto</button>
          <button class="btn btn-small eq-preset" data-preset="flat">Flat</button>
          <button class="btn btn-small eq-preset" data-preset="bass_boost">Bass+</button>
          <button class="btn btn-small eq-preset" data-preset="club">Club</button>
          <button class="btn btn-small eq-preset" data-preset="phone">Phone</button>
          <button class="btn btn-small eq-preset" data-preset="headphone">Headphone</button>
        </div>
      </div>
      <div id="eq-bands" style="display:flex;gap:12px;justify-content:center;align-items:flex-end;height:120px"></div>
      <div id="eq-labels" style="display:flex;gap:12px;justify-content:center;margin-top:4px"></div>
    `

    container.insertBefore(div, container.firstChild)

    // Bind preset buttons
    div.querySelectorAll('.eq-preset').forEach(btn => {
      btn.addEventListener('click', () => this.applyPreset(btn.dataset.preset))
    })

    // Create band sliders
    const bandsDiv = div.querySelector('#eq-bands')
    const labelsDiv = div.querySelector('#eq-labels')

    this.bandDefs.forEach((def, i) => {
      // Vertical slider container
      const sliderCol = document.createElement('div')
      sliderCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:36px;'

      // Gain value display
      const val = document.createElement('div')
      val.id = `eq-val-${i}`
      val.style.cssText = 'color:var(--teal-dim);font-size:9px;margin-bottom:4px;min-width:28px;text-align:center'
      val.textContent = `${def.defaultGain}dB`

      // Vertical range slider
      const slider = document.createElement('input')
      slider.type = 'range'
      slider.min = def.min
      slider.max = def.max
      slider.value = def.defaultGain
      slider.step = '0.5'
      slider.style.cssText = `
        -webkit-appearance:none;width:80px;height:3px;
        background:var(--border);border-radius:2px;
        transform:rotate(-90deg);transform-origin:40px 40px;
        accent-color:var(--teal);cursor:pointer;
      `
      slider.addEventListener('input', () => {
        this.autoMode = false
        this.setBandGain(i, parseFloat(slider.value))
      })

      sliderCol.appendChild(val)
      sliderCol.appendChild(slider)
      bandsDiv.appendChild(sliderCol)

      // Label
      const label = document.createElement('div')
      label.style.cssText = 'color:var(--text-dim);font-size:8px;text-align:center;width:36px;letter-spacing:.05em'
      label.textContent = def.name
      labelsDiv.appendChild(label)
    })

    // Update UI loop
    this._updateUI()
  }

  _updateUI() {
    if (!this.bands.length) {
      requestAnimationFrame(() => this._updateUI())
      return
    }

    this.bands.forEach((band, i) => {
      const val = document.getElementById(`eq-val-${i}`)
      if (val) {
        const g = Math.round(band.currentGain * 10) / 10
        val.textContent = `${g > 0 ? '+' : ''}${g}dB`
        val.style.color = Math.abs(g) > 3 ? 'var(--teal)' : 'var(--teal-dim)'
      }
      // Update slider position if in auto mode
      if (this.autoMode) {
        const slider = document.querySelector(`#eq-bands input:nth-of-type(${i + 1})`)
        if (slider) slider.value = band.currentGain
      }
    })

    requestAnimationFrame(() => this._updateUI())
  }
}

const autoEQ = new AutoEQ()
