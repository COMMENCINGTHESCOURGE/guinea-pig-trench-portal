// ============================================================
// SIEVE BEAT ENGINE
// A step sequencer that syncs to gameplay events.
// Designed for sample playback — drop in real audio files.
// Falls back to synthesis until samples are provided.
//
// The beat builds as the player survives filters:
//   - Base pattern: kick (buomp) on 1 and 3, hat on every step
//   - Each survived filter adds a layer
//   - Dissolved = beat collapses to just the kick, then silence
//
// Sample slots:
//   eerrn.wav  — saw growl / dog growl / filter sweep
//   ooohm.wav  — drone / hum / sustained tone
//   buomp.wav  — sub hit / kick / elimination
//   pass.wav   — bright ping / chime / survival
//   hat.wav    — hi-hat / tick / clock
//
// If samples aren't loaded, uses synthesis fallback.
// ============================================================

class SieveBeat {
  constructor(options = {}) {
    this.bpm = options.bpm || 90;
    this.swing = options.swing || 0.0; // 0-1, 0 = straight, 1 = full swing
    this.steps = 16;
    this.currentStep = 0;
    this.playing = false;
    this.intensity = 0; // 0-1, builds with filters survived
    this.maxIntensity = 1;

    this.ctx = null;
    this.samples = {};
    this.buffers = {};
    this.masterGain = null;
    this.nextStepTime = 0;
    this.timerID = null;
    this.scheduleAhead = 0.1; // seconds
    this.lookAhead = 25; // ms

    // Pattern layers — each is a 16-step boolean array
    // Layers activate as intensity increases
    this.patterns = {
      kick:    [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0], // 1 and 9
      hat:     [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0], // 8ths
      eerrn:   [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1], // end of bar growl
      ooohm:   [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // downbeat drone
      pass:    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // offbeats
      // Variations that unlock at higher intensity
      kick2:   [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0], // ghost kicks
      hat2:    [0,1,0,1, 0,1,0,1, 0,1,0,1, 0,1,0,1], // 16ths
      eerrn2:  [0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,0], // mid-bar growl
    };

    // Which layers are active at each intensity threshold
    this.layerThresholds = [
      { threshold: 0.0, layers: ['kick'] },
      { threshold: 0.1, layers: ['kick', 'hat'] },
      { threshold: 0.2, layers: ['kick', 'hat', 'ooohm'] },
      { threshold: 0.3, layers: ['kick', 'hat', 'ooohm', 'pass'] },
      { threshold: 0.5, layers: ['kick', 'hat', 'ooohm', 'pass', 'eerrn'] },
      { threshold: 0.6, layers: ['kick', 'hat', 'ooohm', 'pass', 'eerrn', 'kick2'] },
      { threshold: 0.7, layers: ['kick', 'hat', 'ooohm', 'pass', 'eerrn', 'kick2', 'hat2'] },
      { threshold: 0.85, layers: ['kick', 'hat', 'ooohm', 'pass', 'eerrn', 'kick2', 'hat2', 'eerrn2'] },
    ];
  }

  // --- INIT ---
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
  }

  // --- SAMPLE LOADING ---
  // Load a sample from URL or file path
  async loadSample(name, url) {
    if (!this.ctx) this.init();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers[name] = audioBuffer;
      console.log(`Sample loaded: ${name} (${audioBuffer.duration.toFixed(2)}s)`);
      return true;
    } catch (e) {
      console.warn(`Failed to load sample ${name}: ${e.message}`);
      return false;
    }
  }

  // Load all samples from a directory
  async loadAllSamples(basePath = 'audio/sieve/') {
    const names = ['eerrn', 'ooohm', 'buomp', 'pass', 'hat'];
    const results = await Promise.all(
      names.map(name => this.loadSample(name, `${basePath}${name}.wav`))
    );
    const loaded = results.filter(Boolean).length;
    console.log(`Sieve Beat: ${loaded}/${names.length} samples loaded`);
    return loaded;
  }

  // --- PLAYBACK ---
  // Play a sample (or synthesis fallback) at a specific time
  playSoundAt(name, time, options = {}) {
    const pitch = options.pitch || 1.0;
    const volume = options.volume || 1.0;

    if (this.buffers[name]) {
      // SAMPLE PLAYBACK — the real sound
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = this.buffers[name];
      source.playbackRate.value = pitch;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.masterGain);
      source.start(time);
      return source;
    }

    // SYNTHESIS FALLBACK — until real samples are dropped in
    return this.synthFallback(name, time, pitch, volume);
  }

  synthFallback(name, time, pitch, volume) {
    const now = time;

    if (name === 'buomp' || name === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(40 * pitch, now + 0.12);
      gain.gain.setValueAtTime(0.25 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    if (name === 'hat' || name === 'hat2') {
      const bufferSize = this.ctx.sampleRate * 0.05;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 8000;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      noise.connect(hpf);
      hpf.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.05);
    }

    if (name === 'eerrn' || name === 'eerrn2') {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const dist = this.ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
      }
      dist.curve = curve;
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(500, now);
      lpf.frequency.linearRampToValueAtTime(150, now + 0.4);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(85 * pitch, now);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(87 * pitch, now);
      gain.gain.setValueAtTime(0.1 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
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
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    }

    if (name === 'ooohm') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55 * pitch;
      gain.gain.setValueAtTime(0.06 * volume, now);
      gain.gain.linearRampToValueAtTime(0.06 * volume, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.55);
    }

    if (name === 'pass') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = (600 + Math.random() * 400) * pitch;
      gain.gain.setValueAtTime(0.06 * volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  // --- SEQUENCER ---
  getActiveLayers() {
    let active = [];
    for (const entry of this.layerThresholds) {
      if (this.intensity >= entry.threshold) {
        active = entry.layers;
      }
    }
    return active;
  }

  scheduleStep(step, time) {
    const activeLayers = this.getActiveLayers();
    const swingOffset = (step % 2 === 1) ? (this.swing * 0.5 * this.stepDuration()) : 0;
    const t = time + swingOffset;

    for (const layer of activeLayers) {
      const pattern = this.patterns[layer];
      if (!pattern) continue;

      if (pattern[step]) {
        // Map layer name to sound name
        let soundName = layer;
        if (layer === 'kick' || layer === 'kick2') soundName = 'buomp';

        // Pitch variation based on step position
        let pitch = 1.0;
        if (layer === 'eerrn' || layer === 'eerrn2') {
          pitch = 0.8 + (this.intensity * 0.4); // growl gets higher as intensity builds
        }
        if (layer === 'pass') {
          pitch = 0.9 + (step / 16) * 0.3; // pass rises through the bar
        }
        if (layer === 'kick2') {
          pitch = 1.2; // ghost kicks slightly higher
        }

        // Volume scales with intensity for later layers
        let vol = 1.0;
        if (layer === 'hat2') vol = 0.4 + this.intensity * 0.3;
        if (layer === 'kick2') vol = 0.3 + this.intensity * 0.3;

        this.playSoundAt(soundName, t, { pitch, volume: vol });
      }
    }
  }

  stepDuration() {
    return 60.0 / this.bpm / 4; // 16th note duration
  }

  scheduler() {
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAhead) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.nextStepTime += this.stepDuration();
      this.currentStep = (this.currentStep + 1) % this.steps;
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookAhead);
  }

  // --- CONTROLS ---
  start() {
    if (!this.ctx) this.init();
    if (this.playing) return;
    this.playing = true;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime;
    this.scheduler();
  }

  stop() {
    this.playing = false;
    if (this.timerID) clearTimeout(this.timerID);
    this.timerID = null;
  }

  // Called by game when a filter is survived
  filterSurvived(filterIndex, totalFilters) {
    this.intensity = Math.min(this.maxIntensity, filterIndex / totalFilters);
    // Bump BPM slightly as intensity rises
    this.bpm = 90 + Math.floor(this.intensity * 30); // 90-120 BPM
  }

  // Called by game on dissolution
  dissolved() {
    // Strip all layers, just kick remains
    this.intensity = 0;
    this.bpm = 70; // slow down
    // Stop after one more bar
    setTimeout(() => this.stop(), this.stepDuration() * 16 * 1000);
  }

  // Called by game on restart
  reset() {
    this.stop();
    this.intensity = 0;
    this.bpm = 90;
    this.currentStep = 0;
  }

  // Set master volume
  setVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  // Mutate a pattern in real-time (for variation/riffs)
  mutatePattern(name, stepIndex, value) {
    if (this.patterns[name]) {
      this.patterns[name][stepIndex] = value ? 1 : 0;
    }
  }

  // Randomize a pattern layer (for fills/drops)
  fillPattern(name, density = 0.5) {
    if (this.patterns[name]) {
      for (let i = 0; i < this.steps; i++) {
        this.patterns[name][i] = Math.random() < density ? 1 : 0;
      }
    }
  }
}

// Export
if (typeof module !== 'undefined') module.exports = SieveBeat;
