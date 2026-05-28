// ============================================================
// TASTE PROFILE — Learns what DaShawn likes from behavior
//
// Watches: play duration, skip behavior, volume changes,
// pitch vial adjustments, EQ presets, BPM preference,
// key preference, time-of-day patterns.
//
// Builds a living profile stored in localStorage.
// Feeds: throat-layer tuning, auto-EQ presets, track ordering,
// sieve-beat BPM, game music selection.
//
// Rule: if a track plays > 10 seconds, it's worth studying.
// If skipped < 5 seconds, noted as rejected.
// Everything in between is passive data collection.
// ============================================================

class TasteProfile {
  constructor() {
    this.STORAGE_KEY = 'gpt_taste_profile';
    this.SESSION_KEY = 'gpt_taste_session';

    // Load existing profile or start fresh
    this.profile = this.load() || this.defaultProfile();
    this.session = {
      startTime: Date.now(),
      currentTrack: null,
      trackStartTime: 0,
      events: [],
      volumeSnapshots: [],
      pitchSnapshots: [],
    };

    // Sampling thresholds
    this.STUDY_THRESHOLD = 10;   // seconds — track worth analyzing
    this.SKIP_THRESHOLD = 5;     // seconds — track was rejected
    this.LOVE_THRESHOLD = 60;    // seconds — DaShawn is feeling this
    this.LOOP_THRESHOLD = 120;   // seconds — this is a vibe, sample candidate

    // Snapshot interval
    this._interval = null;
  }

  defaultProfile() {
    return {
      created: Date.now(),
      updated: Date.now(),
      totalListenTime: 0,        // seconds
      totalTracks: 0,
      totalSkips: 0,

      // BPM preference (histogram)
      bpmCounts: {},             // { "90": 45, "100": 30, ... }
      preferredBpmRange: [85, 110],

      // Key preference
      keyCounts: {},             // { "A_minor": 20, "E_minor": 15, ... }
      preferredKey: null,
      preferredScale: 'minor',

      // Frequency preference (which EQ bands get boosted)
      eqPreference: {
        sub: 0,    // 60 Hz
        lowMid: 0, // 300 Hz
        mid: 0,    // 1200 Hz
        presence: 0, // 3500 Hz
        air: 0,    // 10000 Hz
      },

      // Volume behavior
      avgVolume: 0.5,
      volumeBoostFrequency: 0,   // how often volume goes UP during playback

      // Pitch behavior
      pitchAdjustCount: 0,       // how often pitch vial is touched
      avgPitchOffset: 0,         // average pitch shift applied
      pitchUpCount: 0,
      pitchDownCount: 0,

      // Track history
      tracks: {},                // { "trackId": { plays, totalTime, skips, avgDuration, lastPlayed, loved } }

      // Time-of-day energy
      hourlyEnergy: new Array(24).fill(0), // index = hour, value = cumulative listen seconds

      // Biome preference (from portal worlds)
      biomeCounts: {},           // { "pink_hour": 30, "the_block": 20, ... }

      // Category preference
      categoryCounts: {},        // { "EXPRESSION": 40, "REFINED": 20, ... }

      // Sample candidates — tracks that hit LOOP_THRESHOLD
      sampleCandidates: [],      // [{ trackId, duration, timestamp, bpm, key }]

      // Learned patterns
      patterns: {
        prefersMinor: null,      // true/false/null
        prefersLowBpm: null,
        prefersBassHeavy: null,
        prefersClean: null,      // vs distorted
        timeOfDayPeak: null,     // hour with most listening
      }
    };
  }

  // --- PERSISTENCE ---
  load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  save() {
    this.profile.updated = Date.now();
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      console.warn('TasteProfile save failed:', e.message);
    }
  }

  // --- TRACK EVENTS ---
  trackStarted(trackId, metadata = {}) {
    const now = Date.now();
    this.session.currentTrack = trackId;
    this.session.trackStartTime = now;
    this.session.volumeSnapshots = [];
    this.session.pitchSnapshots = [];

    // Initialize track entry if new
    if (!this.profile.tracks[trackId]) {
      this.profile.tracks[trackId] = {
        plays: 0,
        totalTime: 0,
        skips: 0,
        avgDuration: 0,
        lastPlayed: 0,
        loved: false,
        metadata: metadata, // { title, biome, category, bpm, key }
      };
    }

    this.profile.tracks[trackId].plays++;
    this.profile.tracks[trackId].lastPlayed = now;
    this.profile.totalTracks++;

    // Biome tracking
    if (metadata.biome) {
      this.profile.biomeCounts[metadata.biome] = (this.profile.biomeCounts[metadata.biome] || 0) + 1;
    }
    if (metadata.category) {
      this.profile.categoryCounts[metadata.category] = (this.profile.categoryCounts[metadata.category] || 0) + 1;
    }

    this.logEvent('track_start', { trackId, metadata });
  }

  trackEnded(trackId) {
    if (this.session.currentTrack !== trackId) return;

    const duration = (Date.now() - this.session.trackStartTime) / 1000;
    const track = this.profile.tracks[trackId];

    if (track) {
      track.totalTime += duration;
      track.avgDuration = track.totalTime / track.plays;

      if (duration < this.SKIP_THRESHOLD) {
        track.skips++;
        this.profile.totalSkips++;
        this.logEvent('skip', { trackId, duration });
      } else if (duration >= this.LOVE_THRESHOLD) {
        track.loved = true;
        this.logEvent('loved', { trackId, duration });
      }

      if (duration >= this.LOOP_THRESHOLD) {
        // Sample candidate!
        this.profile.sampleCandidates.push({
          trackId,
          duration: Math.round(duration),
          timestamp: Date.now(),
          bpm: track.metadata?.bpm || null,
          key: track.metadata?.key || null,
        });
        // Keep only last 50 candidates
        if (this.profile.sampleCandidates.length > 50) {
          this.profile.sampleCandidates.shift();
        }
        this.logEvent('sample_candidate', { trackId, duration });
      }
    }

    this.profile.totalListenTime += duration;

    // Time-of-day tracking
    const hour = new Date().getHours();
    this.profile.hourlyEnergy[hour] += duration;

    this.session.currentTrack = null;
    this.save();
  }

  // --- REAL-TIME SNAPSHOTS ---
  // Called by fluid-vials or music player periodically
  snapshotVolume(volume) {
    this.session.volumeSnapshots.push({
      time: Date.now() - this.session.trackStartTime,
      value: volume
    });

    // Detect volume boost (user turned it up)
    const snapshots = this.session.volumeSnapshots;
    if (snapshots.length >= 2) {
      const prev = snapshots[snapshots.length - 2].value;
      if (volume > prev + 0.05) {
        this.profile.volumeBoostFrequency++;
      }
    }

    // Running average
    const sum = this.session.volumeSnapshots.reduce((a, s) => a + s.value, 0);
    this.profile.avgVolume = sum / this.session.volumeSnapshots.length;
  }

  snapshotPitch(pitchValue, direction) {
    this.session.pitchSnapshots.push({
      time: Date.now() - this.session.trackStartTime,
      value: pitchValue
    });

    this.profile.pitchAdjustCount++;
    if (direction === 'up' || pitchValue > 0.5) this.profile.pitchUpCount++;
    if (direction === 'down' || pitchValue < 0.5) this.profile.pitchDownCount++;

    const sum = this.session.pitchSnapshots.reduce((a, s) => a + s.value, 0);
    this.profile.avgPitchOffset = (sum / this.session.pitchSnapshots.length) - 0.5;
  }

  // Called by pitch-detect when BPM is detected
  recordBpm(bpm) {
    const rounded = Math.round(bpm / 5) * 5; // bucket to nearest 5 BPM
    this.profile.bpmCounts[rounded] = (this.profile.bpmCounts[rounded] || 0) + 1;
    this.updatePreferredBpm();
  }

  // Called by pitch-detect when key is detected
  recordKey(key, scale) {
    const keyStr = `${key}_${scale}`;
    this.profile.keyCounts[keyStr] = (this.profile.keyCounts[keyStr] || 0) + 1;
    this.updatePreferredKey();
  }

  // Called by auto-eq when preset changes or gains adjust
  recordEqState(bands) {
    // bands = { sub, lowMid, mid, presence, air } (gain values)
    const smooth = 0.1; // learning rate
    for (const band of Object.keys(bands)) {
      if (this.profile.eqPreference[band] !== undefined) {
        this.profile.eqPreference[band] =
          this.profile.eqPreference[band] * (1 - smooth) + bands[band] * smooth;
      }
    }
  }

  // --- PATTERN ANALYSIS ---
  updatePreferredBpm() {
    const counts = this.profile.bpmCounts;
    let maxBpm = 0;
    let maxCount = 0;
    for (const [bpm, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxBpm = parseInt(bpm);
      }
    }
    if (maxBpm > 0) {
      this.profile.preferredBpmRange = [maxBpm - 10, maxBpm + 10];
      this.profile.patterns.prefersLowBpm = maxBpm < 100;
    }
  }

  updatePreferredKey() {
    const counts = this.profile.keyCounts;
    let maxKey = null;
    let maxCount = 0;
    let minorTotal = 0;
    let majorTotal = 0;

    for (const [key, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxKey = key;
      }
      if (key.endsWith('_minor')) minorTotal += count;
      if (key.endsWith('_major')) majorTotal += count;
    }

    if (maxKey) {
      const [note, scale] = maxKey.split('_');
      this.profile.preferredKey = note;
      this.profile.preferredScale = scale;
    }
    this.profile.patterns.prefersMinor = minorTotal > majorTotal;
  }

  analyzePatterns() {
    const p = this.profile;

    // Bass heavy?
    p.patterns.prefersBassHeavy = p.eqPreference.sub > 2 || p.eqPreference.lowMid > 1;

    // Clean vs distorted?
    p.patterns.prefersClean = p.eqPreference.presence > 1 && p.eqPreference.air > 0.5;

    // Peak listening hour
    let peakHour = 0;
    let peakVal = 0;
    for (let h = 0; h < 24; h++) {
      if (p.hourlyEnergy[h] > peakVal) {
        peakVal = p.hourlyEnergy[h];
        peakHour = h;
      }
    }
    p.patterns.timeOfDayPeak = peakHour;

    this.save();
  }

  // --- QUERY INTERFACE ---
  // Used by other systems to tune themselves

  // What BPM should the sieve beat / throat layer use?
  getPreferredBpm() {
    const range = this.profile.preferredBpmRange;
    return Math.round((range[0] + range[1]) / 2);
  }

  // What root note should the throat layer use?
  getPreferredRoot() {
    const key = this.profile.preferredKey;
    if (!key) return 55; // A1 default

    const noteToFreq = {
      'C': 65.41, 'C#': 69.30, 'D': 73.42, 'D#': 77.78,
      'E': 82.41, 'F': 87.31, 'F#': 92.50, 'G': 98.00,
      'G#': 103.83, 'A': 55.00, 'A#': 58.27, 'B': 61.74
    };
    return noteToFreq[key] || 55;
  }

  // Is this track likely to be enjoyed? (predict from history)
  predictLike(metadata) {
    let score = 0;

    // BPM match
    if (metadata.bpm) {
      const [lo, hi] = this.profile.preferredBpmRange;
      if (metadata.bpm >= lo && metadata.bpm <= hi) score += 3;
      else if (Math.abs(metadata.bpm - (lo + hi) / 2) < 20) score += 1;
    }

    // Key match
    if (metadata.key && this.profile.preferredKey) {
      if (metadata.key === this.profile.preferredKey) score += 2;
    }

    // Biome match
    if (metadata.biome) {
      const biomeCount = this.profile.biomeCounts[metadata.biome] || 0;
      if (biomeCount > 5) score += 2;
      if (biomeCount > 15) score += 1;
    }

    // Category match
    if (metadata.category) {
      const catCount = this.profile.categoryCounts[metadata.category] || 0;
      if (catCount > 5) score += 1;
    }

    return score; // higher = more likely to enjoy
  }

  // Get sample candidates (tracks played 2+ minutes)
  getSampleCandidates() {
    return this.profile.sampleCandidates;
  }

  // Get top played tracks
  getTopTracks(n = 10) {
    return Object.entries(this.profile.tracks)
      .sort((a, b) => b[1].totalTime - a[1].totalTime)
      .slice(0, n)
      .map(([id, data]) => ({ trackId: id, ...data }));
  }

  // Get most skipped tracks
  getMostSkipped(n = 10) {
    return Object.entries(this.profile.tracks)
      .filter(([_, data]) => data.skips > 0)
      .sort((a, b) => b[1].skips - a[1].skips)
      .slice(0, n)
      .map(([id, data]) => ({ trackId: id, ...data }));
  }

  // --- EVENT LOG ---
  logEvent(type, data) {
    this.session.events.push({
      type,
      data,
      time: Date.now(),
      hour: new Date().getHours()
    });
    // Keep session events manageable
    if (this.session.events.length > 500) {
      this.session.events = this.session.events.slice(-250);
    }
  }

  // --- SNAPSHOT TIMER ---
  // Call this once to start periodic snapshots
  startMonitoring(getVolume, getPitch) {
    if (this._interval) return;
    this._interval = setInterval(() => {
      if (this.session.currentTrack) {
        if (getVolume) this.snapshotVolume(getVolume());
        if (getPitch) this.snapshotPitch(getPitch());
      }
    }, 2000); // every 2 seconds
  }

  stopMonitoring() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  // --- SUMMARY ---
  getSummary() {
    const p = this.profile;
    return {
      totalListenTime: Math.round(p.totalListenTime / 60) + ' min',
      totalTracks: p.totalTracks,
      totalSkips: p.totalSkips,
      skipRate: p.totalTracks > 0 ? (p.totalSkips / p.totalTracks * 100).toFixed(1) + '%' : '0%',
      preferredBpm: this.getPreferredBpm(),
      preferredKey: `${p.preferredKey || '?'} ${p.preferredScale}`,
      preferredRoot: this.getPreferredRoot().toFixed(1) + ' Hz',
      avgVolume: (p.avgVolume * 100).toFixed(0) + '%',
      pitchAdjustments: p.pitchAdjustCount,
      sampleCandidates: p.sampleCandidates.length,
      peakListeningHour: p.patterns.timeOfDayPeak !== null
        ? `${p.patterns.timeOfDayPeak}:00`
        : 'unknown',
      prefersMinor: p.patterns.prefersMinor,
      prefersBassHeavy: p.patterns.prefersBassHeavy,
    };
  }

  // Reset everything
  reset() {
    this.profile = this.defaultProfile();
    this.save();
  }
}

// Singleton
const tasteProfile = new TasteProfile();

// Export
if (typeof module !== 'undefined') module.exports = TasteProfile;
