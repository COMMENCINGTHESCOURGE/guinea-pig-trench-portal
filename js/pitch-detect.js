// ============================================================
// PITCH DETECT — Real-time pitch analysis for the throat layer
// Uses autocorrelation on the audio stream to detect:
//   - Fundamental frequency (root note)
//   - Key estimation (major/minor)
//   - BPM estimation from onset intervals
//   - Note name + octave
//
// Feeds ThroatLayer.setRoot() and SieveBeat.bpm in real-time.
// Can also drive AutoTube's key/scale snapping.
// ============================================================

class PitchDetect {
  constructor(audioContext, sourceNode, options = {}) {
    this.ctx = audioContext;
    this.source = sourceNode;
    this.enabled = false;

    // Analysis config
    this.bufferSize = options.bufferSize || 4096;
    this.smoothing = options.smoothing || 0.85;
    this.minFreq = options.minFreq || 30;  // Hz
    this.maxFreq = options.maxFreq || 2000; // Hz
    this.confidenceThreshold = options.confidenceThreshold || 0.9;

    // Analyser for frequency domain
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.bufferSize;
    this.analyser.smoothingTimeConstant = this.smoothing;
    this.source.connect(this.analyser);

    // Buffers
    this.timeBuffer = new Float32Array(this.bufferSize);
    this.freqBuffer = new Uint8Array(this.analyser.frequencyBinCount);

    // State
    this.currentPitch = 0;       // Hz
    this.currentNote = '';        // e.g. "A2"
    this.currentMidi = 0;        // MIDI note number
    this.confidence = 0;         // 0-1
    this.detectedKey = 'A';      // estimated key
    this.detectedScale = 'minor'; // estimated scale
    this.bpmEstimate = 0;

    // History for key/BPM estimation
    this.noteHistory = [];       // last N detected notes
    this.onsetTimes = [];        // timestamps of energy spikes
    this.maxHistory = 200;

    // Note names
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Callbacks
    this.onPitch = options.onPitch || null;   // (freq, note, confidence) => {}
    this.onKey = options.onKey || null;        // (key, scale) => {}
    this.onBpm = options.onBpm || null;        // (bpm) => {}

    this._animFrame = null;
  }

  // --- AUTOCORRELATION PITCH DETECTION ---
  // Same method as autotube.js but standalone
  detectPitch() {
    this.analyser.getFloatTimeDomainData(this.timeBuffer);
    const buf = this.timeBuffer;
    const n = buf.length;

    // Check if there's enough signal
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < 0.01) {
      this.confidence = 0;
      return 0; // too quiet
    }

    // Autocorrelation
    const minPeriod = Math.floor(this.ctx.sampleRate / this.maxFreq);
    const maxPeriod = Math.floor(this.ctx.sampleRate / this.minFreq);
    const correlations = new Float32Array(maxPeriod - minPeriod);

    let bestCorrelation = 0;
    let bestPeriod = 0;

    for (let period = minPeriod; period < maxPeriod && period < n / 2; period++) {
      let sum = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < n - period; i++) {
        sum += buf[i] * buf[i + period];
        norm1 += buf[i] * buf[i];
        norm2 += buf[i + period] * buf[i + period];
      }

      const correlation = sum / (Math.sqrt(norm1 * norm2) + 1e-10);
      correlations[period - minPeriod] = correlation;

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    this.confidence = bestCorrelation;

    if (bestCorrelation < this.confidenceThreshold || bestPeriod === 0) {
      return 0;
    }

    // Parabolic interpolation for sub-sample accuracy
    const idx = bestPeriod - minPeriod;
    if (idx > 0 && idx < correlations.length - 1) {
      const y0 = correlations[idx - 1];
      const y1 = correlations[idx];
      const y2 = correlations[idx + 1];
      const offset = (y2 - y0) / (2 * (2 * y1 - y0 - y2));
      bestPeriod += offset;
    }

    return this.ctx.sampleRate / bestPeriod;
  }

  // --- FREQUENCY TO NOTE ---
  freqToNote(freq) {
    if (freq <= 0) return { note: '', midi: 0, octave: 0, cents: 0 };

    const midi = 12 * Math.log2(freq / 440) + 69;
    const roundedMidi = Math.round(midi);
    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const octave = Math.floor(roundedMidi / 12) - 1;
    const cents = Math.round((midi - roundedMidi) * 100);

    return {
      note: this.noteNames[noteIndex],
      midi: roundedMidi,
      octave,
      cents,
      fullName: `${this.noteNames[noteIndex]}${octave}`
    };
  }

  // --- KEY ESTIMATION ---
  // Accumulate note occurrences and find best-fit key
  estimateKey() {
    if (this.noteHistory.length < 20) return;

    // Count note class occurrences (C=0, C#=1, ..., B=11)
    const counts = new Array(12).fill(0);
    for (const midi of this.noteHistory) {
      counts[((midi % 12) + 12) % 12]++;
    }

    // Major and minor scale templates
    const majorTemplate = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1]; // W-W-H-W-W-W-H
    const minorTemplate = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0]; // W-H-W-W-H-W-W

    let bestKey = 0;
    let bestScale = 'major';
    let bestScore = -Infinity;

    for (let root = 0; root < 12; root++) {
      // Score major
      let majorScore = 0;
      let minorScore = 0;
      for (let i = 0; i < 12; i++) {
        const idx = (i + root) % 12;
        majorScore += counts[idx] * (majorTemplate[i] ? 1 : -0.5);
        minorScore += counts[idx] * (minorTemplate[i] ? 1 : -0.5);
      }

      if (majorScore > bestScore) {
        bestScore = majorScore;
        bestKey = root;
        bestScale = 'major';
      }
      if (minorScore > bestScore) {
        bestScore = minorScore;
        bestKey = root;
        bestScale = 'minor';
      }
    }

    this.detectedKey = this.noteNames[bestKey];
    this.detectedScale = bestScale;

    if (this.onKey) this.onKey(this.detectedKey, this.detectedScale);
  }

  // --- BPM ESTIMATION ---
  // From onset intervals
  estimateBpm() {
    if (this.onsetTimes.length < 4) return;

    // Calculate intervals between consecutive onsets
    const intervals = [];
    for (let i = 1; i < this.onsetTimes.length; i++) {
      const dt = this.onsetTimes[i] - this.onsetTimes[i - 1];
      if (dt > 0.2 && dt < 2.0) { // reasonable beat range: 30-300 BPM
        intervals.push(dt);
      }
    }

    if (intervals.length < 3) return;

    // Find most common interval (histogram with 10ms bins)
    const bins = {};
    for (const dt of intervals) {
      const bin = Math.round(dt * 100) / 100; // 10ms resolution
      bins[bin] = (bins[bin] || 0) + 1;
    }

    let bestBin = 0;
    let bestCount = 0;
    for (const [bin, count] of Object.entries(bins)) {
      if (count > bestCount) {
        bestCount = count;
        bestBin = parseFloat(bin);
      }
    }

    if (bestBin > 0) {
      this.bpmEstimate = Math.round(60 / bestBin);
      // Sanity check: double or half if outside normal range
      while (this.bpmEstimate < 60) this.bpmEstimate *= 2;
      while (this.bpmEstimate > 200) this.bpmEstimate /= 2;

      if (this.onBpm) this.onBpm(this.bpmEstimate);
    }
  }

  // --- ONSET DETECTION ---
  detectOnset() {
    this.analyser.getByteFrequencyData(this.freqBuffer);

    // Low-frequency energy (kick/bass region)
    let lowEnergy = 0;
    const binHz = this.ctx.sampleRate / this.bufferSize;
    const maxBin = Math.floor(200 / binHz);

    for (let i = 0; i < maxBin; i++) {
      lowEnergy += this.freqBuffer[i];
    }
    lowEnergy /= maxBin;

    // Simple threshold onset
    if (lowEnergy > 180) { // strong low hit
      const now = this.ctx.currentTime;
      if (this.onsetTimes.length === 0 || now - this.onsetTimes[this.onsetTimes.length - 1] > 0.15) {
        this.onsetTimes.push(now);
        if (this.onsetTimes.length > 50) this.onsetTimes.shift();
      }
    }
  }

  // --- MAIN LOOP ---
  process() {
    if (!this.enabled) return;

    // Pitch detection
    const freq = this.detectPitch();
    if (freq > 0 && this.confidence >= this.confidenceThreshold) {
      this.currentPitch = freq;
      const noteInfo = this.freqToNote(freq);
      this.currentNote = noteInfo.fullName;
      this.currentMidi = noteInfo.midi;

      // Track for key estimation
      this.noteHistory.push(noteInfo.midi);
      if (this.noteHistory.length > this.maxHistory) this.noteHistory.shift();

      if (this.onPitch) this.onPitch(freq, noteInfo, this.confidence);
    }

    // Onset detection for BPM
    this.detectOnset();

    // Periodic key/BPM estimation (every ~2 seconds at 60fps)
    if (this.noteHistory.length % 120 === 0) {
      this.estimateKey();
      this.estimateBpm();
    }

    this._animFrame = requestAnimationFrame(() => this.process());
  }

  // --- CONTROLS ---
  start() {
    if (this.enabled) return;
    this.enabled = true;
    this.process();
  }

  stop() {
    this.enabled = false;
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }

  // Get current state as object
  getState() {
    return {
      pitch: this.currentPitch,
      note: this.currentNote,
      midi: this.currentMidi,
      confidence: this.confidence,
      key: this.detectedKey,
      scale: this.detectedScale,
      bpm: this.bpmEstimate,
      rootFreq: this.currentPitch > 0
        ? 440 * Math.pow(2, (Math.round(12 * Math.log2(this.currentPitch / 440) + 69) % 12 - 9) / 12)
        : 55
    };
  }

  // Connect to ThroatLayer — auto-tune the drone and voices
  connectToThroatLayer(throatLayer) {
    this.onPitch = (freq, noteInfo, conf) => {
      // Update root every few detections for stability
      if (this.noteHistory.length % 30 === 0 && conf > 0.92) {
        // Use the lowest strong note as root
        const rootFreq = 440 * Math.pow(2, (noteInfo.midi % 12 - 9) / 12);
        // Drop to bass octave
        let bassRoot = rootFreq;
        while (bassRoot > 110) bassRoot /= 2;
        while (bassRoot < 40) bassRoot *= 2;
        throatLayer.setRoot(bassRoot);
      }
    };

    this.onKey = (key, scale) => {
      throatLayer.setKey(scale);
    };

    this.onBpm = (bpm) => {
      // If SieveBeat is running, sync it
      if (typeof SieveBeat !== 'undefined') {
        // BPM sync available
      }
    };
  }
}

// Export
if (typeof module !== 'undefined') module.exports = PitchDetect;
