// Guinea Pig Trench — Hint System
// Random tips pop up and fade out to teach players features

class HintSystem {
  constructor() {
    this.hints = [
      // Navigation
      {text: "Press T to chat with other players in any game", category: "social"},
      {text: "Press V for push-to-talk voice chat", category: "social"},
      {text: "Create a party to play games together with friends", category: "social"},
      {text: "Your music keeps playing when you switch between games", category: "music"},

      // Music
      {text: "Scroll the volume slider up to hear the beats", category: "music"},
      {text: "Each game has its own dedicated soundtrack", category: "music"},
      {text: "The Auto EQ adjusts the mix in real-time", category: "music"},
      {text: "Visit the Music page to browse all 129 tracks", category: "music"},

      // Games
      {text: "Drag to orbit the Mandelbulb \u2014 try the biome presets", category: "games"},
      {text: "In VOID-RUNNER: Shift to boost, double-tap A/D to barrel roll", category: "games"},
      {text: "In Zen Sand Garden: Space to paint, E to toggle erase", category: "games"},
      {text: "In Stealth Maze: C throws paper balls to distract guards", category: "games"},
      {text: "In Stealth Maze: 3 levels with increasing difficulty", category: "games"},
      {text: "In Voxel Engine: Left click breaks, right click places blocks", category: "games"},
      {text: "Terrain Walker uses pointer lock \u2014 click to engage", category: "games"},
      {text: "In SPH Fluid: Click and drag to create water, sand, or fire", category: "games"},
      {text: "Bloom Meadow has weather cycles \u2014 watch for rain", category: "games"},

      // Features
      {text: "Log in to save your progress and compete on leaderboards", category: "features"},
      {text: "The crossfader blends portal music with game audio", category: "features"},
      {text: "ESC pauses any game with a full menu", category: "features"},
      {text: "After 5 minutes idle, the screensaver activates", category: "features"},
      {text: "Record freestyle bars in a jam session during multiplayer", category: "features"},

      // Secrets
      {text: "Some games are hidden\u2026 try the classics", category: "secret"},
      {text: "Every painting on the site was hand-painted on canvas", category: "lore"},
      {text: "All music is original \u2014 produced by skippyohms", category: "lore"},
      {text: "All character art is original \u2014 designed by ohthatsthe", category: "lore"},
      {text: "The onion planet has 8 layers \u2014 each is a different world", category: "lore"},
    ]

    this.shown = new Set()
    this.currentHint = null
    this.container = null
    this.interval = null
    this.minDelay = 25000   // 25 seconds minimum between hints
    this.maxDelay = 60000   // 60 seconds maximum
    this.displayTime = 6000 // show each hint for 6 seconds

    this._createUI()
    this._startCycle()
  }

  _createUI() {
    this.container = document.createElement('div')
    this.container.id = 'hint-popup'
    this.container.style.cssText = `
      position:fixed; bottom:56px; left:50%; transform:translateX(-50%);
      z-index:95; pointer-events:none;
      font-family:'Courier New',monospace; font-size:11px;
      color:rgba(0,210,255,.5); letter-spacing:.08em;
      text-align:center; max-width:500px;
      opacity:0; transition:opacity 1s ease;
      text-shadow:0 0 10px rgba(0,210,255,.15);
    `
    document.body.appendChild(this.container)
  }

  _startCycle() {
    this._scheduleNext()
  }

  _scheduleNext() {
    const delay = this.minDelay + Math.random() * (this.maxDelay - this.minDelay)
    this.interval = setTimeout(() => this._showRandom(), delay)
  }

  _showRandom() {
    // Filter out already-shown hints (reset if all shown)
    let available = this.hints.filter((_, i) => !this.shown.has(i))
    if (available.length === 0) {
      this.shown.clear()
      available = this.hints
    }

    const idx = this.hints.indexOf(available[Math.floor(Math.random() * available.length)])
    this.shown.add(idx)

    const hint = this.hints[idx]
    this.container.textContent = '\u25C6 ' + hint.text
    this.container.style.opacity = '1'

    // Fade out after display time
    setTimeout(() => {
      this.container.style.opacity = '0'
      this._scheduleNext()
    }, this.displayTime)
  }

  // Show a specific hint immediately (for tutorials)
  showNow(text) {
    this.container.textContent = '\u25C6 ' + text
    this.container.style.opacity = '1'
    setTimeout(() => {
      this.container.style.opacity = '0'
    }, this.displayTime)
  }

  // Stop hints (e.g., during game loading)
  pause() {
    clearTimeout(this.interval)
    this.container.style.opacity = '0'
  }

  resume() {
    this._scheduleNext()
  }
}

const hints = new HintSystem()
