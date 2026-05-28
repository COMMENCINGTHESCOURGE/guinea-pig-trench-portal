// Guinea Pig Trench — Universal Game Shell
// Wraps every game with: loading screen, title card, pause menu,
// music crossfader, settings, and consistent UX
//
// This injects into the game viewer iframe or overlays on top

class GameShell {
  constructor() {
    this.currentGame = null
    this.gameState = 'idle' // idle, loading, title, playing, paused, gameover
    this.loadProgress = 0
    this.fadeProgress = 0  // 0 = all portal music, 1 = all game music
    this.fadeDuration = 2.0 // seconds to crossfade
    this.fadeTarget = 0
    this._overlay = null
    this._built = false

    this._bindGameViewer()
  }

  _bindGameViewer() {
    // Wait for launchGame to exist (race condition fix)
    const waitForLaunch = setInterval(() => {
      if (typeof window.launchGame === 'function') {
        clearInterval(waitForLaunch)
        const origLaunch = window.launchGame
        window.launchGame = (src, gameId) => {
          this.currentGame = GAMES.find(g => g.id === gameId) || { id: gameId, title: gameId }
          this._showLoading()
          origLaunch(src, gameId)
          this._startCrossfade(1)

          // Play game-specific music
          if (typeof musicPlayer !== 'undefined') {
            musicPlayer.playForGame(gameId)
          }

          // Track game launch
          if (typeof analytics !== 'undefined') {
            analytics.gameLaunch(gameId)
          }

          // Listen for REAL iframe load (not fake progress)
          const frame = document.getElementById('game-frame')
          if (frame) {
            frame.addEventListener('load', () => {
              this.loadProgress = 100
              if (this._loadInterval) clearInterval(this._loadInterval)
              setTimeout(() => this._showTitle(), 300)
            }, { once: true })
          }
        }
      }
    }, 50)

    // Hook into game close
    const closeBtn = document.getElementById('game-close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this._startCrossfade(0)
        this._hideOverlay()
        // Track game exit
        if (typeof analytics !== 'undefined' && this.currentGame) {
          analytics.gameExit(this.currentGame.id)
        }
        this.gameState = 'idle'
        this.currentGame = null
      })
    }

    // Pause on ESC — single handler, checks state
    this._escHandler = (e) => {
      if (this.gameState === 'playing' && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        this._showPause()
      } else if (this.gameState === 'paused' && (e.key === 'Escape' || e.key === 'p')) {
        e.preventDefault()
        this._resumeGame()
      }
    }
    document.addEventListener('keydown', this._escHandler)
  }

  // ─── MUSIC CROSSFADER ──────────────────────────────
  _startCrossfade(target) {
    this.fadeTarget = target
    this._fadeInterval = setInterval(() => {
      try {
        const step = (1 / 60) / this.fadeDuration // per frame at 60fps

        if (this.fadeProgress < this.fadeTarget) {
          this.fadeProgress = Math.min(this.fadeTarget, this.fadeProgress + step)
        } else if (this.fadeProgress > this.fadeTarget) {
          this.fadeProgress = Math.max(this.fadeTarget, this.fadeProgress - step)
        }

        // Apply to portal music
        if (typeof musicPlayer !== 'undefined' && musicPlayer.audio) {
          const baseVol = document.getElementById('music-volume')?.value / 100 || 0.025
          musicPlayer.audio.volume = baseVol * (1 - this.fadeProgress)
        }

        // Send volume to game iframe
        const frame = document.getElementById('game-frame')
        if (frame?.contentWindow) {
          try {
            frame.contentWindow.postMessage({
              type: 'music_volume',
              volume: this.fadeProgress
            }, '*')
          } catch (err) {
            console.warn('GameShell: crossfade postMessage failed', err)
          }
        }

        // Update fader UI if visible
        this._updateFaderUI()

        // Done?
        if (Math.abs(this.fadeProgress - this.fadeTarget) < 0.01) {
          clearInterval(this._fadeInterval)
        }
      } catch (err) {
        console.warn('GameShell: crossfade interval error', err)
        clearInterval(this._fadeInterval)
      }
    }, 1000 / 60)
  }

  _updateFaderUI() {
    const fader = document.getElementById('crossfader-knob')
    if (fader) {
      fader.style.left = `${this.fadeProgress * 100}%`
    }
    const label = document.getElementById('crossfader-label')
    if (label) {
      if (this.fadeProgress < 0.2) label.textContent = 'PORTAL'
      else if (this.fadeProgress > 0.8) label.textContent = 'GAME'
      else label.textContent = 'MIX'
    }
  }

  // ─── LOADING SCREEN ──────────────────────────────
  _showLoading() {
    this.gameState = 'loading'
    this.loadProgress = 0

    this._createOverlay()
    this._overlay.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        width:100%;height:100%;background:#000;
      ">
        <div style="
          color:rgba(0,210,255,.15);font-size:10px;letter-spacing:.3em;
          text-transform:uppercase;margin-bottom:30px;
        ">GUINEA PIG TRENCH</div>

        <div style="
          color:#00d2ff;font-size:clamp(18px,3vw,28px);font-weight:bold;
          letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px;
          font-family:'Courier New',monospace;
        ">${this.currentGame?.title || 'LOADING'}</div>

        <div style="
          color:rgba(0,210,255,.3);font-size:10px;letter-spacing:.15em;
          margin-bottom:40px;font-family:'Courier New',monospace;
        ">${this.currentGame?.tags?.join(' · ') || ''}</div>

        <!-- Loading bar -->
        <div style="width:280px;height:3px;background:rgba(0,210,255,.08);border-radius:2px;overflow:hidden">
          <div id="load-fill" style="
            width:0%;height:100%;
            background:linear-gradient(90deg,#00d2ff,#ff60a0);
            transition:width .3s;border-radius:2px;
          "></div>
        </div>
        <div id="load-pct" style="
          color:rgba(0,210,255,.25);font-size:9px;letter-spacing:.2em;
          margin-top:8px;font-family:'Courier New',monospace;
        ">INITIALIZING...</div>

        <!-- Crossfader -->
        <div style="margin-top:50px;width:200px">
          <div style="
            display:flex;justify-content:space-between;
            font-size:8px;letter-spacing:.15em;color:rgba(0,210,255,.2);
            font-family:'Courier New',monospace;text-transform:uppercase;
            margin-bottom:6px;
          ">
            <span>PORTAL</span>
            <span id="crossfader-label">MIX</span>
            <span>GAME</span>
          </div>
          <div style="
            width:100%;height:6px;background:rgba(0,210,255,.06);
            border-radius:3px;position:relative;cursor:pointer;
          " id="crossfader-track">
            <div id="crossfader-knob" style="
              position:absolute;top:-3px;left:0%;
              width:12px;height:12px;border-radius:50%;
              background:#00d2ff;border:2px solid #000;
              transform:translateX(-50%);cursor:grab;
              box-shadow:0 0 8px rgba(0,210,255,.4);
              transition:left .1s;
            "></div>
          </div>
        </div>
      </div>
    `

    this._overlay.style.display = 'flex'
    this._overlay.style.zIndex = '310'

    // Bind crossfader drag
    const track = this._overlay.querySelector('#crossfader-track')
    if (track) {
      const setFade = (e) => {
        const rect = track.getBoundingClientRect()
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        this.fadeProgress = pct
        this.fadeTarget = pct
        this._updateFaderUI()

        // Apply volumes
        if (typeof musicPlayer !== 'undefined' && musicPlayer.audio) {
          const baseVol = document.getElementById('music-volume')?.value / 100 || 0.025
          musicPlayer.audio.volume = baseVol * (1 - pct)
        }
      }

      track.addEventListener('mousedown', e => {
        setFade(e)
        const move = e => setFade(e)
        const up = () => { removeEventListener('mousemove', move); removeEventListener('mouseup', up) }
        addEventListener('mousemove', move)
        addEventListener('mouseup', up)
      })
    }

    // Simulate loading progress
    this._loadInterval = setInterval(() => {
      this.loadProgress += Math.random() * 15 + 5
      if (this.loadProgress >= 100) {
        this.loadProgress = 100
        clearInterval(this._loadInterval)
        setTimeout(() => this._showTitle(), 500)
      }
      const fill = this._overlay.querySelector('#load-fill')
      const pct = this._overlay.querySelector('#load-pct')
      if (fill) fill.style.width = `${Math.min(100, this.loadProgress)}%`
      if (pct) pct.textContent = this.loadProgress >= 100 ? 'READY' : `${Math.floor(this.loadProgress)}%`
    }, 200)
  }

  // ─── TITLE CARD ──────────────────────────────────
  _showTitle() {
    this.gameState = 'title'

    this._overlay.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        width:100%;height:100%;background:rgba(0,0,0,.85);
        backdrop-filter:blur(8px);cursor:pointer;
      " id="title-dismiss">
        <div style="
          color:rgba(0,210,255,.1);font-size:9px;letter-spacing:.4em;
          text-transform:uppercase;margin-bottom:20px;
        ">GUINEA PIG TRENCH PRESENTS</div>

        <div style="
          color:#00d2ff;font-size:clamp(28px,5vw,48px);font-weight:bold;
          letter-spacing:.25em;text-transform:uppercase;
          text-shadow:0 0 30px rgba(0,210,255,.3);
          font-family:'Courier New',monospace;margin-bottom:10px;
        ">${this.currentGame?.title || 'GAME'}</div>

        <div style="
          color:rgba(0,210,255,.25);font-size:10px;letter-spacing:.15em;
          margin-bottom:20px;max-width:400px;text-align:center;
          font-family:'Courier New',monospace;line-height:1.8;
        ">${this.currentGame?.description || ''}</div>

        <div style="
          color:rgba(0,210,255,.35);font-size:9px;letter-spacing:.1em;
          margin-bottom:30px;max-width:420px;text-align:center;
          font-family:'Courier New',monospace;line-height:2;
          padding:10px 16px;
          border:1px solid rgba(0,210,255,.08);border-radius:4px;
          background:rgba(0,210,255,.02);
        ">${this.currentGame?.controls || 'ESC — Pause'}</div>

        <div style="
          color:rgba(0,210,255,.4);font-size:11px;letter-spacing:.2em;
          text-transform:uppercase;
          animation:shellBlink 1.5s infinite;
          font-family:'Courier New',monospace;
        ">CLICK TO START</div>

        <div style="
          margin-top:30px;color:rgba(0,210,255,.15);font-size:8px;
          letter-spacing:.15em;text-transform:uppercase;
          font-family:'Courier New',monospace;
        ">ESC — PAUSE &nbsp;&nbsp; TAB — CROSSFADER</div>

        <!-- Crossfader persists -->
        <div style="margin-top:30px;width:180px">
          <div style="
            display:flex;justify-content:space-between;
            font-size:7px;letter-spacing:.12em;color:rgba(0,210,255,.15);
            font-family:'Courier New',monospace;text-transform:uppercase;
            margin-bottom:4px;
          ">
            <span>PORTAL</span>
            <span id="crossfader-label">MIX</span>
            <span>GAME</span>
          </div>
          <div style="
            width:100%;height:4px;background:rgba(0,210,255,.05);
            border-radius:2px;position:relative;
          " id="crossfader-track">
            <div id="crossfader-knob" style="
              position:absolute;top:-4px;left:${this.fadeProgress * 100}%;
              width:10px;height:10px;border-radius:50%;
              background:#00d2ff;border:1px solid #000;
              transform:translateX(-50%);cursor:grab;
              box-shadow:0 0 6px rgba(0,210,255,.3);
            "></div>
          </div>
        </div>
      </div>

      <style>
        @keyframes shellBlink {
          0%,100%{opacity:1} 50%{opacity:.3}
        }
      </style>
    `

    // Click to start
    this._overlay.querySelector('#title-dismiss')?.addEventListener('click', () => {
      this._resumeGame()
    })
  }

  // ─── PAUSE MENU ──────────────────────────────────
  _showPause() {
    this.gameState = 'paused'

    // Pause the game iframe
    const frame = document.getElementById('game-frame')
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: 'pause' }, '*')
      } catch (err) {
        console.warn('GameShell: pause postMessage failed', err)
      }
    }

    this._createOverlay()
    this._overlay.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        width:100%;height:100%;background:rgba(0,0,0,.75);
        backdrop-filter:blur(6px);
      ">
        <div style="
          color:#00d2ff;font-size:28px;font-weight:bold;
          letter-spacing:.3em;text-transform:uppercase;
          font-family:'Courier New',monospace;margin-bottom:30px;
          text-shadow:0 0 20px rgba(0,210,255,.2);
        ">PAUSED</div>

        <div style="display:flex;flex-direction:column;gap:10px;width:200px">
          <button class="shell-btn" id="shell-resume">RESUME</button>
          <button class="shell-btn" id="shell-restart">RESTART</button>
          <button class="shell-btn" id="shell-settings">SETTINGS</button>
          <button class="shell-btn shell-btn-quit" id="shell-quit">QUIT TO PORTAL</button>
        </div>

        <!-- Crossfader in pause menu -->
        <div style="margin-top:40px;width:200px">
          <div style="
            font-size:8px;letter-spacing:.2em;color:rgba(0,210,255,.2);
            text-transform:uppercase;margin-bottom:8px;text-align:center;
            font-family:'Courier New',monospace;
          ">MUSIC CROSSFADER</div>
          <div style="
            display:flex;justify-content:space-between;
            font-size:7px;letter-spacing:.1em;color:rgba(0,210,255,.15);
            font-family:'Courier New',monospace;margin-bottom:4px;
          ">
            <span>PORTAL</span><span id="crossfader-label">MIX</span><span>GAME</span>
          </div>
          <input type="range" id="crossfader-slider" min="0" max="100"
            value="${Math.round(this.fadeProgress * 100)}"
            style="width:100%;accent-color:#00d2ff">
        </div>

        <div style="
          margin-top:30px;color:rgba(0,210,255,.12);font-size:8px;
          letter-spacing:.15em;font-family:'Courier New',monospace;
        ">ESC / P — RESUME</div>
      </div>

      <style>
        .shell-btn {
          background:rgba(0,210,255,.06);border:1px solid rgba(0,210,255,.15);
          color:rgba(0,210,255,.6);padding:10px;border-radius:4px;
          font-family:'Courier New',monospace;font-size:11px;
          letter-spacing:.15em;text-transform:uppercase;cursor:pointer;
          transition:all .2s;
        }
        .shell-btn:hover {
          background:rgba(0,210,255,.12);border-color:rgba(0,210,255,.4);
          color:#00d2ff;
        }
        .shell-btn-quit {
          border-color:rgba(255,68,68,.15);color:rgba(255,68,68,.5);
          margin-top:10px;
        }
        .shell-btn-quit:hover {
          border-color:rgba(255,68,68,.4);color:#ff4444;
          background:rgba(255,68,68,.08);
        }
      </style>
    `

    this._overlay.style.display = 'flex'

    // Bind buttons
    this._overlay.querySelector('#shell-resume')?.addEventListener('click', () => this._resumeGame())
    this._overlay.querySelector('#shell-restart')?.addEventListener('click', () => {
      try {
        const frame = document.getElementById('game-frame')
        if (frame?.contentWindow) frame.contentWindow.location.reload()
      } catch (err) {
        console.warn('GameShell: restart iframe failed', err)
      }
      this._resumeGame()
    })
    this._overlay.querySelector('#shell-settings')?.addEventListener('click', () => this._showSettings())
    this._overlay.querySelector('#shell-quit')?.addEventListener('click', () => {
      document.getElementById('game-close')?.click()
    })

    // Crossfader slider
    const slider = this._overlay.querySelector('#crossfader-slider')
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.fadeProgress = e.target.value / 100
        this.fadeTarget = this.fadeProgress
        if (typeof musicPlayer !== 'undefined' && musicPlayer.audio) {
          const baseVol = document.getElementById('music-volume')?.value / 100 || 0.025
          musicPlayer.audio.volume = baseVol * (1 - this.fadeProgress)
        }
        const frame = document.getElementById('game-frame')
        if (frame?.contentWindow) {
          try {
            frame.contentWindow.postMessage({
              type: 'music_volume', volume: this.fadeProgress
            }, '*')
          } catch (err) {
            console.warn('GameShell: slider postMessage failed', err)
          }
        }
        this._updateFaderUI()
      })
    }
  }

  // ─── SETTINGS ──────────────────────────────────
  _showSettings() {
    this._overlay.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        width:100%;height:100%;background:rgba(0,0,0,.85);
      ">
        <div style="
          color:#00d2ff;font-size:16px;letter-spacing:.25em;
          text-transform:uppercase;margin-bottom:30px;
          font-family:'Courier New',monospace;
        ">SETTINGS</div>

        <div style="width:260px;display:flex;flex-direction:column;gap:14px">
          <label for="set-master-vol" style="display:flex;justify-content:space-between;align-items:center;
            color:rgba(0,210,255,.5);font-size:10px;letter-spacing:.1em;
            font-family:'Courier New',monospace;">
            MASTER VOLUME
            <input type="range" min="0" max="100"
              value="${(typeof musicPlayer !== 'undefined' ? musicPlayer.audio.volume * 100 / (1 - this.fadeProgress + 0.01) : 3)}"
              style="width:120px;accent-color:#00d2ff"
              id="set-master-vol">
          </label>

          <label for="set-sfx-vol" style="display:flex;justify-content:space-between;align-items:center;
            color:rgba(0,210,255,.5);font-size:10px;letter-spacing:.1em;
            font-family:'Courier New',monospace;">
            SFX VOLUME
            <input type="range" min="0" max="100" value="70"
              style="width:120px;accent-color:#00d2ff"
              id="set-sfx-vol">
          </label>

          <label for="set-afk" style="display:flex;justify-content:space-between;align-items:center;
            color:rgba(0,210,255,.5);font-size:10px;letter-spacing:.1em;
            font-family:'Courier New',monospace;">
            AFK TIMEOUT
            <select id="set-afk" style="
              background:#111;color:#00d2ff;border:1px solid rgba(0,210,255,.2);
              padding:4px 8px;font-family:'Courier New',monospace;font-size:10px;
            ">
              <option value="2">2 min</option>
              <option value="5" selected>5 min</option>
              <option value="10">10 min</option>
              <option value="0">Never</option>
            </select>
          </label>

          <label for="set-autoeq" style="display:flex;justify-content:space-between;align-items:center;
            color:rgba(0,210,255,.5);font-size:10px;letter-spacing:.1em;
            font-family:'Courier New',monospace;">
            AUTO EQ
            <input type="checkbox" id="set-autoeq" checked
              style="accent-color:#00d2ff">
          </label>
        </div>

        <button class="shell-btn" id="set-back" style="margin-top:30px">BACK</button>
      </div>
      <style>
        .shell-btn {
          background:rgba(0,210,255,.06);border:1px solid rgba(0,210,255,.15);
          color:rgba(0,210,255,.6);padding:10px 24px;border-radius:4px;
          font-family:'Courier New',monospace;font-size:11px;
          letter-spacing:.15em;text-transform:uppercase;cursor:pointer;
        }
        .shell-btn:hover { background:rgba(0,210,255,.12);color:#00d2ff; }
      </style>
    `

    // Bind settings
    this._overlay.querySelector('#set-master-vol')?.addEventListener('input', e => {
      const vol = e.target.value / 100
      document.getElementById('music-volume').value = e.target.value
      if (typeof musicPlayer !== 'undefined') {
        musicPlayer.audio.volume = vol * (1 - this.fadeProgress)
      }
    })

    this._overlay.querySelector('#set-afk')?.addEventListener('change', e => {
      const mins = parseInt(e.target.value)
      if (typeof afk !== 'undefined') {
        if (mins === 0) afk.disable()
        else afk.setTimeout(mins)
      }
    })

    this._overlay.querySelector('#set-back')?.addEventListener('click', () => {
      this._showPause()
    })
  }

  // ─── HELPERS ──────────────────────────────────
  _resumeGame() {
    this.gameState = 'playing'
    this._hideOverlay()

    const frame = document.getElementById('game-frame')
    if (frame?.contentWindow) {
      try {
        frame.contentWindow.postMessage({ type: 'resume' }, '*')
      } catch (err) {
        console.warn('GameShell: resume postMessage failed', err)
      }
    }
  }

  _createOverlay() {
    if (!this._overlay) {
      try {
        if (!document.body) {
          console.warn('GameShell: document.body not available for overlay creation')
          return
        }
        this._overlay = document.createElement('div')
        this._overlay.id = 'game-shell-overlay'
        this._overlay.style.cssText = `
          position:fixed;inset:0;z-index:310;
          display:none;font-family:'Courier New',monospace;
        `
        document.body.appendChild(this._overlay)
      } catch (err) {
        console.warn('GameShell: overlay creation failed', err)
      }
    }
  }

  _hideOverlay() {
    if (this._overlay) {
      this._overlay.style.display = 'none'
    }
  }
}

// Initialize
const gameShell = new GameShell()
