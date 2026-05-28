// Guinea Pig Trench — Music Player
// Persistent audio player with Web Audio API visualizer
// Plays across page navigation, synesthesia color pulse

class MusicPlayer {
  constructor() {
    this.tracks = []
    this.currentIndex = -1
    this.audio = new Audio()
    this.audio.volume = 0.025  // Start at 2.5% — let the user bring it up
    this.playing = false
    this.audioCtx = null
    this.analyser = null
    this.dataArray = null

    // Game-specific track assignments (index into tracks array)
    this.gameTrackMap = {
      'mandelbulb-studio': [0, 1],      // ambient/chill
      'mandelbulb': [1, 2],
      'void-runner': [3, 4, 5],         // high energy
      'gpu-particles': [6, 7],
      'sand-garden': [8, 9, 10],        // zen/ambient
      'sph-fluid': [11, 12],
      'bloom-meadow': [13, 14, 15],     // nature/chill
      'stealth-maze': [16, 17],         // tension
      'terrain-walker': [18, 19, 20],   // exploration
      'voxel-engine': [21, 22],         // building
      'audio-visualizer': [23, 24],
      'mantra-radio': [],               // radio has its own audio
      'evasion-hunter': [25, 26],       // intense
    }

    this._bindUI()
    this._scanTracks()

    // Auto-play on FIRST user interaction (click, key, touch)
    const autoStart = () => {
      this._initAudioContext()
      if (this.tracks.length > 0 && !this.playing) {
        this.loadTrack(0)
        this.play()
      }
      document.removeEventListener('click', autoStart)
      document.removeEventListener('keydown', autoStart)
      document.removeEventListener('touchstart', autoStart)
    }
    document.addEventListener('click', autoStart)
    document.addEventListener('keydown', autoStart)
    document.addEventListener('touchstart', autoStart)
  }

  _scanTracks() {
    // Build track list from known converted files
    // This will be populated dynamically or from a manifest
    fetch('music/manifest.json')
      .then(r => r.json())
      .then(data => {
        this.tracks = data.tracks
        this._renderTrackList()
        if (this.tracks.length > 0) {
          this._updateTitle(0)
        }
      })
      .catch(() => {
        // Fallback: try to load tracks by scanning known names
        console.log('No manifest found — music player idle until tracks are added')
      })
  }

  _initAudioContext() {
    if (this.audioCtx) return

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const source = this.audioCtx.createMediaElementSource(this.audio)
    this.analyser = this.audioCtx.createAnalyser()
    this.analyser.fftSize = 256

    // Audio chain: source → EQ → AutoTube → analyser → speakers
    try {
      let lastNode = source

      // Auto EQ
      if (typeof autoEQ !== 'undefined') {
        autoEQ.init(this.audioCtx, lastNode, this.analyser)
        lastNode = this.analyser
        const musicPage = document.getElementById('page-music')
        if (musicPage) autoEQ.createUI(musicPage)
      } else {
        lastNode.connect(this.analyser)
        lastNode = this.analyser
      }

      // AutoTube pitch effect
      if (typeof autoTube !== 'undefined') {
        autoTube.init(this.audioCtx, source, this.audioCtx.destination)
        console.log('Audio chain: source → EQ → AutoTube → analyser → destination')
      } else {
        lastNode.connect(this.audioCtx.destination)
        console.log('Audio chain: source → EQ → analyser → destination')
      }
    } catch (e) {
      console.warn('Audio chain init error, using direct:', e)
      source.connect(this.analyser)
      this.analyser.connect(this.audioCtx.destination)
    }

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this._startVisualizer()
  }

  _bindUI() {
    const $ = id => document.getElementById(id)

    $('music-play')?.addEventListener('click', () => this.togglePlay())
    $('music-prev')?.addEventListener('click', () => this.prev())
    $('music-next')?.addEventListener('click', () => this.next())

    $('music-volume')?.addEventListener('input', e => {
      this.audio.volume = e.target.value / 100
    })

    // Pitch control — semitones to playback rate
    $('music-pitch')?.addEventListener('input', e => {
      const semitones = parseInt(e.target.value)
      this.audio.playbackRate = Math.pow(2, semitones / 12)
      const label = $('pitch-val')
      if (label) label.textContent = (semitones > 0 ? '+' : '') + semitones
    })
    // Double-click pitch slider to reset to 0
    $('music-pitch')?.addEventListener('dblclick', e => {
      e.target.value = 0
      this.audio.playbackRate = 1.0
      const label = $('pitch-val')
      if (label) label.textContent = '0'
    })

    this.audio.addEventListener('ended', () => {
      // Track completion
      if (typeof analytics !== 'undefined' && this.currentIndex >= 0) {
        analytics.trackEnd(this.tracks[this.currentIndex].file)
      }
      this.next()
    })
  }

  _renderTrackList() {
    const list = document.getElementById('track-list')
    if (!list) return

    // Group by category
    const categories = {}
    this.tracks.forEach((track, i) => {
      const cat = track.category || 'UNCATEGORIZED'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push({...track, globalIndex: i})
    })

    let html = ''
    for (const [cat, tracks] of Object.entries(categories)) {
      html += `<div style="
        color:var(--teal);font-size:10px;letter-spacing:.2em;
        text-transform:uppercase;margin:16px 0 6px;padding-bottom:4px;
        border-bottom:1px solid var(--border);
      ">${cat} <span style="color:var(--text-dim);font-size:9px">(${tracks.length})</span></div>`

      html += tracks.map(track => `
        <div class="track-item" data-index="${track.globalIndex}" style="
          padding:10px 14px; margin:4px 0; border-radius:4px;
          border:1px solid var(--border); cursor:pointer;
          display:flex; justify-content:space-between; align-items:center;
          font-size:12px; color:var(--text-dim); transition:all .2s;
        ">
          <span>${track.title || track.file}</span>
          <span style="color:var(--teal-dim);font-size:10px">${track.biome || ''}</span>
        </div>
      `).join('')
    }

    list.innerHTML = html

    list.querySelectorAll('.track-item').forEach(el => {
      el.addEventListener('click', () => {
        this.loadTrack(parseInt(el.dataset.index))
        this.play()
      })
      el.addEventListener('mouseenter', () => {
        el.style.borderColor = 'var(--teal)'
        el.style.color = 'var(--text)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.borderColor = 'var(--border)'
        el.style.color = 'var(--text-dim)'
      })
    })
  }

  loadTrack(index) {
    if (index < 0 || index >= this.tracks.length) return
    this.currentIndex = index
    const track = this.tracks[index]
    this.audio.src = `music/${track.file}`
    this._updateTitle(index)
  }

  _updateTitle(index) {
    const track = this.tracks[index]
    const title = document.getElementById('music-title')
    if (title) {
      title.textContent = track?.title || track?.file || 'No track'
    }

    // Highlight active track in list
    document.querySelectorAll('.track-item').forEach((el, i) => {
      if (i === index) {
        el.style.borderColor = 'var(--teal)'
        el.style.background = 'rgba(0,210,255,.05)'
      } else {
        el.style.borderColor = 'var(--border)'
        el.style.background = 'transparent'
      }
    })
  }

  play() {
    if (this.tracks.length === 0) return
    // Track analytics
    if (typeof analytics !== 'undefined' && this.currentIndex >= 0) {
      analytics.trackPlay(this.tracks[this.currentIndex].file)
    }
    if (this.currentIndex < 0) this.loadTrack(0)

    this.audio.play().then(() => {
      this.playing = true
      document.getElementById('music-play').textContent = '⏸'
    }).catch(e => {
      console.log('Playback blocked — click anywhere to enable audio')
    })
  }

  pause() {
    this.audio.pause()
    this.playing = false
    document.getElementById('music-play').textContent = '▶'
  }

  togglePlay() {
    if (this.playing) this.pause()
    else this.play()
  }

  next() {
    if (this.tracks.length === 0) return
    // Track skip if switching before track ended
    if (typeof analytics !== 'undefined' && this.currentIndex >= 0 && this.playing) {
      analytics.trackSkip(this.tracks[this.currentIndex].file)
    }
    const next = (this.currentIndex + 1) % this.tracks.length
    this.loadTrack(next)
    if (this.playing) this.play()
  }

  prev() {
    if (this.tracks.length === 0) return
    // If more than 3 seconds in, restart. Otherwise go to previous.
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0
      return
    }
    const prev = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length
    this.loadTrack(prev)
    if (this.playing) this.play()
  }

  // Play a track dedicated to a specific game
  playForGame(gameId) {
    if (this.tracks.length === 0) return

    const trackIndices = this.gameTrackMap[gameId]
    if (!trackIndices || trackIndices.length === 0) return // game has its own audio

    // Pick a random track from the game's dedicated list
    const validIndices = trackIndices.filter(i => i < this.tracks.length)
    if (validIndices.length === 0) return

    const idx = validIndices[Math.floor(Math.random() * validIndices.length)]
    this.loadTrack(idx)
    this.play()
  }

  _startVisualizer() {
    const bar = document.getElementById('music-bar')
    if (!bar || !this.analyser) return

    const draw = () => {
      requestAnimationFrame(draw)
      if (!this.playing) return

      this.analyser.getByteFrequencyData(this.dataArray)

      // Get average energy for subtle UI pulse
      const avg = this.dataArray.reduce((a, b) => a + b) / this.dataArray.length
      const pulse = Math.min(1, avg / 128)

      // Pulse the music bar border
      const alpha = 0.12 + pulse * 0.3
      bar.style.borderTopColor = `rgba(0, 210, 255, ${alpha})`

      // Pulse the logo
      const logo = document.querySelector('.logo')
      if (logo) {
        const glow = Math.floor(pulse * 40)
        logo.style.textShadow = `0 0 ${glow}px rgba(0,210,255,${pulse * 0.5})`
      }
    }

    draw()
  }

  // Get current biome color for synesthesia
  getCurrentColor() {
    if (this.currentIndex < 0) return [0, 210, 255]
    const track = this.tracks[this.currentIndex]
    return track?.color || [0, 210, 255]
  }

  // Get frequency data for game integration
  getFrequencyData() {
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray)
      return this.dataArray
    }
    return null
  }
}

const musicPlayer = new MusicPlayer()

// ── BEE POLLEN — expose audio data globally for cross-pollination ──
// Any game can read: window.AUDIO_FREQ (Uint8Array of 128 frequency bins)
// And: window.AUDIO_BASS, window.AUDIO_MID, window.AUDIO_HIGH (0-255 averages)
// And: window.AUDIO_ENERGY (0-1 overall energy level)
window.AUDIO_FREQ = null
window.AUDIO_BASS = 0
window.AUDIO_MID = 0
window.AUDIO_HIGH = 0
window.AUDIO_ENERGY = 0

setInterval(() => {
  const data = musicPlayer.getFrequencyData()
  if (!data) return
  window.AUDIO_FREQ = data

  // Split into bands (128 bins at 44100/256 = ~172Hz per bin)
  // Bass: bins 0-8 (~0-1400Hz)
  // Mid: bins 8-32 (~1400-5500Hz)
  // High: bins 32-64 (~5500-11000Hz)
  let bass = 0, mid = 0, high = 0, total = 0
  for (let i = 0; i < Math.min(data.length, 64); i++) {
    if (i < 8) bass += data[i]
    else if (i < 32) mid += data[i]
    else high += data[i]
    total += data[i]
  }
  window.AUDIO_BASS = bass / 8
  window.AUDIO_MID = mid / 24
  window.AUDIO_HIGH = high / 32
  window.AUDIO_ENERGY = total / (64 * 255)
}, 1000 / 30) // 30fps audio data updates
