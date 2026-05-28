// ============================================================
// THROAT LAYER — Real-time overtone doubling system
// Sits on top of any playing track via the portal's AnalyserNode.
// Trades in throat singing voices where instruments already exist:
//   - Kick detected → buomp doubles it
//   - Sustained low freq → ooohm drone tunes to root
//   - High transients → eerrn growl variations
//   - Beat patterns → overtone arps/chords build
//
// Does NOT remove anything from the original. Layers on top.
// Designed for sample replacement when real recordings are provided.
// ============================================================

class VocalLayer {
  constructor(audioContext, analyserNode, options = {}) {
    this.ctx = audioContext;
    this.analyser = analyserNode;
    this.enabled = false;
    this.mix = options.mix || 0.3; // 0-1, how loud the throat layer is vs original
    this.rootNote = options.rootNote || 55; // Hz, detected or manual (A1 default)
    this.key = options.key || 'minor'; // minor or major

    // Analysis buffers
    this.fftSize = 2048;
    if (this.analyser) {
      this.analyser.fftSize = this.fftSize;
    }
    this.freqData = new Uint8Array(this.fftSize / 2);
    this.timeData = new Uint8Array(this.fftSize);

    // State tracking
    this.lastKickTime = 0;
    this.kickCooldown = 0.12; // seconds between kick triggers
    this.lastEerrnTime = 0;
    this.eerrnCooldown = 0.3;
    this.oohmActive = false;
    this.oohmOsc = null;
    this.oohmGain = null;
    this.oohmLfo = null;
    this.frameCount = 0;
    this.energy = { low: 0, mid: 0, high: 0, prevLow: 0 };

    // Output chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.mix;
    this.masterGain.connect(this.ctx.destination);

    // Overtone state — harmonics that build as the track plays
    this.activeHarmonics = [];
    this.harmonicCount = 0;
    this.maxHarmonics = 8;

    // Harmonic series (throat singing selection: 6,8,9,10,12,13,16)
    // These are the ones Tuvan singers use — skipping 7 and 11
    this.harmonicRatios = [1, 2, 3, 4, 6, 8, 9, 10, 12, 13, 16];

    // Scale degrees for melodic content
    this.scales = {
      minor: [0, 3, 5, 7, 10, 12, 15], // natural minor intervals in semitones
      major: [0, 4, 7, 12, 16, 19, 24],
      pentatonic: [0, 3, 5, 7, 10, 12],
    };

    this._animFrame = null;
  }

  // --- ANALYSIS ---
  analyze() {
    if (!this.analyser) return;

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const binHz = this.ctx.sampleRate / this.fftSize;
    const len = this.freqData.length;

    // Energy bands
    this.energy.prevLow = this.energy.low;
    this.energy.low = 0;
    this.energy.mid = 0;
    this.energy.high = 0;

    let lowCount = 0, midCount = 0, highCount = 0;

    for (let i = 0; i < len; i++) {
      const freq = i * binHz;
      const val = this.freqData[i] / 255;

      if (freq < 200) { this.energy.low += val; lowCount++; }
      else if (freq < 2000) { this.energy.mid += val; midCount++; }
      else if (freq < 10000) { this.energy.high += val; highCount++; }
    }

    if (lowCount) this.energy.low /= lowCount;
    if (midCount) this.energy.mid /= midCount;
    if (highCount) this.energy.high /= highCount;
  }

  // --- KICK DETECTION ---
  detectKick() {
    // Kick = sudden spike in low energy (onset detection)
    const spike = this.energy.low - this.energy.prevLow;
    const now = this.ctx.currentTime;

    if (spike > 0.15 && this.energy.low > 0.3 && now - this.lastKickTime > this.kickCooldown) {
      this.lastKickTime = now;
      return true;
    }
    return false;
  }

  // --- TRANSIENT DETECTION ---
  detectTransient() {
    // High-frequency transient = hat, snare, perc
    const now = this.ctx.currentTime;
    if (this.energy.high > 0.25 && now - this.lastEerrnTime > this.eerrnCooldown) {
      this.lastEerrnTime = now;
      return true;
    }
    return false;
  }

  // --- VOICE: BUOMP (kick doubler) ---
  playBuomp(velocity = 1) {
    const now = this.ctx.currentTime;
    const freq = this.rootNote;

    // Sub body
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.1);
    gain.gain.setValueAtTime(0.25 * velocity * this.mix, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);

    // Transient click
    const click = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(600, now);
    click.frequency.exponentialRampToValueAtTime(80, now + 0.015);
    cGain.gain.setValueAtTime(0.1 * velocity * this.mix, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    click.connect(cGain);
    cGain.connect(this.masterGain);
    click.start(now);
    click.stop(now + 0.04);
  }

  // --- VOICE: EERRN (growl on transients) ---
  playEerrn(pitch = 1, duration = 0.35) {
    const now = this.ctx.currentTime;
    const freq = this.rootNote * 1.5 * pitch;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.frequency.linearRampToValueAtTime(freq * 0.6, now + duration);
    osc2.frequency.setValueAtTime(freq * 1.03, now); // detune = beating
    osc2.frequency.linearRampToValueAtTime(freq * 0.62, now + duration);

    // Distortion
    const dist = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 150) * x / (Math.PI + 150 * Math.abs(x));
    }
    dist.curve = curve;

    // Filter — keeps it in the chest
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(400, now);
    lpf.frequency.linearRampToValueAtTime(150, now + duration);
    lpf.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08 * this.mix, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const merge = this.ctx.createGain();
    merge.gain.value = 0.5;
    osc1.connect(merge);
    osc2.connect(merge);
    merge.connect(dist);
    dist.connect(lpf);
    lpf.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  // --- VOICE: OOOHM (sustained drone, tunes to root) ---
  startOoohm() {
    if (this.oohmActive) return;
    const now = this.ctx.currentTime;

    this.oohmOsc = this.ctx.createOscillator();
    this.oohmGain = this.ctx.createGain();

    this.oohmOsc.type = 'sine';
    this.oohmOsc.frequency.value = this.rootNote;

    // LFO — slow wobble, the modulus breathing
    this.oohmLfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    this.oohmLfo.type = 'sine';
    this.oohmLfo.frequency.value = 0.25;
    lfoGain.gain.value = 1.5;
    this.oohmLfo.connect(lfoGain);
    lfoGain.connect(this.oohmOsc.frequency);
    this.oohmLfo.start();

    this.oohmGain.gain.value = 0;
    this.oohmGain.gain.linearRampToValueAtTime(0.06 * this.mix, now + 3);

    this.oohmOsc.connect(this.oohmGain);
    this.oohmGain.connect(this.masterGain);
    this.oohmOsc.start();

    this.oohmActive = true;
  }

  stopOoohm() {
    if (!this.oohmActive) return;
    const now = this.ctx.currentTime;
    try {
      this.oohmGain.gain.linearRampToValueAtTime(0, now + 2);
      this.oohmOsc.stop(now + 2.1);
      if (this.oohmLfo) this.oohmLfo.stop(now + 2.1);
    } catch (e) {}
    this.oohmOsc = null;
    this.oohmGain = null;
    this.oohmLfo = null;
    this.oohmActive = false;
  }

  // Modulate drone pitch to follow detected bass
  tuneOoohm(detectedFreq) {
    if (!this.oohmOsc) return;
    // Snap to nearest harmonic of root
    const ratio = detectedFreq / this.rootNote;
    const nearestHarmonic = Math.round(ratio);
    if (nearestHarmonic >= 1 && nearestHarmonic <= 4) {
      const targetFreq = this.rootNote * nearestHarmonic;
      this.oohmOsc.frequency.linearRampToValueAtTime(
        targetFreq, this.ctx.currentTime + 0.5
      );
    }
  }

  // --- OVERTONE CHORD/ARP BUILDER ---
  // Each kick/pass adds a harmonic. Builds throat singing texture.
  addHarmonic() {
    if (this.harmonicCount >= this.maxHarmonics) return;

    const ratio = this.harmonicRatios[this.harmonicCount % this.harmonicRatios.length];
    const freq = this.rootNote * ratio;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Higher harmonics get quieter (natural overtone rolloff)
    const vol = 0.04 * this.mix / (1 + this.harmonicCount * 0.3);

    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = vol;

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();

    this.activeHarmonics.push({ osc, gain, ratio, freq });
    this.harmonicCount++;
  }

  clearHarmonics() {
    const now = this.ctx.currentTime;
    for (const h of this.activeHarmonics) {
      try {
        h.gain.gain.linearRampToValueAtTime(0, now + 0.5);
        h.osc.stop(now + 0.6);
      } catch (e) {}
    }
    this.activeHarmonics = [];
    this.harmonicCount = 0;
  }

  // Play accumulated harmonics as an arp (ascending)
  playArp(duration = 1.0) {
    if (this.harmonicCount === 0) return;
    const now = this.ctx.currentTime;
    const noteLen = duration / this.harmonicCount;

    for (let i = 0; i < this.harmonicCount; i++) {
      const freq = this.rootNote * this.harmonicRatios[i % this.harmonicRatios.length];
      const t = now + i * noteLen;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle'; // softer than sine for arps
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06 * this.mix, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteLen * 0.9);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + noteLen);
    }
  }

  // --- MAIN LOOP ---
  process() {
    if (!this.enabled) return;

    this.analyze();
    this.frameCount++;

    // Kick detection → buomp
    if (this.detectKick()) {
      this.playBuomp(0.5 + this.energy.low * 0.5);

      // Every 8th kick, add a harmonic to the overtone stack
      if (this.frameCount % 8 === 0) {
        this.addHarmonic();
      }
    }

    // Transient detection → eerrn
    if (this.detectTransient()) {
      // Pitch the eerrn based on where we are in the energy curve
      const pitch = 0.8 + this.energy.mid * 0.6;
      this.playEerrn(pitch, 0.2 + this.energy.high * 0.3);
    }

    // Sustained low energy → start/maintain ooohm
    if (this.energy.low > 0.15) {
      if (!this.oohmActive) this.startOoohm();
    } else {
      if (this.oohmActive && this.energy.low < 0.05) this.stopOoohm();
    }

    // Every 4 seconds, play an arp of accumulated harmonics
    if (this.frameCount % 240 === 0 && this.harmonicCount > 2) {
      this.playArp(0.8);
    }

    this._animFrame = requestAnimationFrame(() => this.process());
  }

  // --- CONTROLS ---
  enable() {
    if (this.enabled) return;
    this.enabled = true;
    this.startOoohm();
    this.process();
  }

  disable() {
    this.enabled = false;
    this.stopOoohm();
    this.clearHarmonics();
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }

  setMix(v) {
    this.mix = Math.max(0, Math.min(1, v));
    this.masterGain.gain.linearRampToValueAtTime(this.mix, this.ctx.currentTime + 0.1);
  }

  setRoot(freq) {
    this.rootNote = freq;
    if (this.oohmOsc) {
      this.oohmOsc.frequency.linearRampToValueAtTime(freq, this.ctx.currentTime + 0.5);
    }
  }

  setKey(key) {
    this.key = key;
  }

  // Auto-detect root from FFT (find strongest low-frequency peak)
  detectRoot() {
    if (!this.analyser) return this.rootNote;

    const binHz = this.ctx.sampleRate / this.fftSize;
    let maxVal = 0;
    let maxBin = 0;

    // Search 30-200 Hz for fundamental
    const startBin = Math.floor(30 / binHz);
    const endBin = Math.floor(200 / binHz);

    for (let i = startBin; i < endBin; i++) {
      if (this.freqData[i] > maxVal) {
        maxVal = this.freqData[i];
        maxBin = i;
      }
    }

    if (maxVal > 100) { // strong enough signal
      const detected = maxBin * binHz;
      // Snap to nearest note
      const midi = Math.round(12 * Math.log2(detected / 440) + 69);
      const snapped = 440 * Math.pow(2, (midi - 69) / 12);
      return snapped;
    }

    return this.rootNote;
  }
}

// Export
if (typeof module !== 'undefined') module.exports = VocalLayer;
