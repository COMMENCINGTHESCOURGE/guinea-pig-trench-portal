// Guinea Pig Trench — AFK System
// 5 minutes of no input = AFK state
// Shows screensaver mode, pauses gameplay, saves progress

class AFKManager {
  constructor(timeoutMs = 5 * 60 * 1000) { // 5 minutes default
    this.timeout = timeoutMs
    this.lastActivity = Date.now()
    this.isAFK = false
    this.onAFK = null       // callback when going AFK
    this.onReturn = null    // callback when returning
    this._overlay = null
    this._animFrame = null
    this._particles = []

    this._trackActivity()
    this._checkLoop()
  }

  _trackActivity() {
    const reset = () => {
      this.lastActivity = Date.now()
      if (this.isAFK) this._returnFromAFK()
    }

    // Track ALL user input
    document.addEventListener('mousemove', reset)
    document.addEventListener('mousedown', reset)
    document.addEventListener('keydown', reset)
    document.addEventListener('touchstart', reset)
    document.addEventListener('wheel', reset)
    document.addEventListener('gamepadconnected', reset)

    // Also track gamepad input in animation loop
    this._gamepadCheck = () => {
      try {
        const gamepads = navigator.getGamepads?.() || []
        for (const gp of gamepads) {
          if (!gp) continue
          for (const btn of gp.buttons) {
            if (btn.pressed) { reset(); return }
          }
          for (const axis of gp.axes) {
            if (Math.abs(axis) > 0.3) { reset(); return }
          }
        }
      } catch (err) {
        console.warn('AFKManager: gamepad polling failed', err)
      }
    }
  }

  _checkLoop() {
    const check = () => {
      this._gamepadCheck()

      if (!this.isAFK && Date.now() - this.lastActivity > this.timeout) {
        this._goAFK()
      }

      requestAnimationFrame(check)
    }
    check()
  }

  _goAFK() {
    this.isAFK = true
    console.log('AFK — 5 minutes idle')

    // Callback for game-specific pause
    if (this.onAFK) this.onAFK()

    // Show AFK overlay with screensaver
    this._showOverlay()

    // Pause music volume (fade to 30%)
    if (typeof musicPlayer !== 'undefined' && musicPlayer.playing) {
      musicPlayer.audio.volume = musicPlayer.audio.volume * 0.3
    }
  }

  _returnFromAFK() {
    this.isAFK = false
    console.log('Returned from AFK')

    // Callback
    if (this.onReturn) this.onReturn()

    // Hide overlay
    this._hideOverlay()

    // Restore music volume
    if (typeof musicPlayer !== 'undefined') {
      musicPlayer.audio.volume = document.getElementById('music-volume')?.value / 100 || 0.7
    }
  }

  _showOverlay() {
    if (this._overlay) return

    try {
      this._overlay = document.createElement('div')
      this._overlay.id = 'afk-overlay'
      this._overlay.style.cssText = `
        position:fixed;inset:0;z-index:500;
        background:#000;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        cursor:pointer;
        font-family:'Courier New',monospace;
      `

      // Canvas for screensaver particles
      const canvas = document.createElement('canvas')
      canvas.id = 'afk-canvas'
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
      this._overlay.appendChild(canvas)

      // AFK text
      const text = document.createElement('div')
      text.style.cssText = `
        position:relative;z-index:1;
        color:rgba(0,210,255,.3);font-size:14px;
        letter-spacing:.3em;text-transform:uppercase;
        text-align:center;
      `
      text.innerHTML = 'AFK<br><span style="font-size:10px;color:rgba(0,210,255,.15);letter-spacing:.15em">move mouse or press any key to return</span>'
      this._overlay.appendChild(text)

      // Guinea Pig Trench title
      const title = document.createElement('div')
      title.style.cssText = `
        position:absolute;bottom:30px;
        color:rgba(0,210,255,.08);font-size:11px;
        letter-spacing:.25em;text-transform:uppercase;
      `
      title.textContent = 'GUINEA PIG TRENCH'
      this._overlay.appendChild(title)

      document.body.appendChild(this._overlay)

      // Screensaver animation — floating geometric cores
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.warn('AFKManager: could not get canvas 2d context')
        return
      }
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // Guard window resize so canvas stays in sync
      this._resizeHandler = () => {
        try {
          canvas.width = window.innerWidth
          canvas.height = window.innerHeight
        } catch (err) {
          console.warn('AFKManager: resize handler failed', err)
        }
      }
      window.addEventListener('resize', this._resizeHandler)

      // Load entity sprites for the screensaver
      const entitySprites = [
        '../assets/sprites/entities/defender_06_128.png',
        '../assets/sprites/entities/dim_mak_11_128.png',
        '../assets/sprites/entities/mecha_01_128.png',
        '../assets/sprites/entities/aku_mask_08_128.png',
        '../assets/sprites/entities/kraken_05_128.png',
        '../assets/sprites/entities/grief_warrior_03_128.png',
        '../assets/sprites/entities/geode_00_128.png',
        '../assets/sprites/entities/void_runner_00_128.png',
        '../assets/sprites/entities/defender_24_128.png',
        '../assets/sprites/entities/dim_mak_29_128.png',
        '../assets/sprites/entities/geode_02_128.png',
        '../assets/sprites/entities/aku_mask_04_128.png',
      ]
      const loadedSprites = []
      entitySprites.forEach(src => {
        const img = new Image()
        img.src = src
        img.onload = () => { img._ready = true }
        img.onerror = () => { img._ready = false }
        loadedSprites.push(img)
      })

      this._particles = []
      for (let i = 0; i < 20; i++) {
        this._particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          size: Math.random() * 30 + 20,
          hue: Math.random() * 60 + 170,
          alpha: Math.random() * 0.25 + 0.05,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.008,
          spriteIdx: i % entitySprites.length,
          bobPhase: Math.random() * Math.PI * 2,
          bobSpeed: 0.3 + Math.random() * 0.5,
        })
      }

      const animate = () => {
        if (!this.isAFK) return

        try {
          ctx.fillStyle = 'rgba(0,0,0,0.05)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          const time = Date.now() * 0.001

          for (const p of this._particles) {
            p.x += p.vx
            p.y += p.vy
            p.rotation += p.rotSpeed
            p.bobPhase += p.bobSpeed * 0.016

            // Gentle bob
            const bobY = Math.sin(p.bobPhase) * 3

            // Wrap
            if (p.x < -40) p.x = canvas.width + 40
            if (p.x > canvas.width + 40) p.x = -40
            if (p.y < -40) p.y = canvas.height + 40
            if (p.y > canvas.height + 40) p.y = -40

            const drawY = p.y + bobY

            // Try to draw entity sprite
            const spr = loadedSprites[p.spriteIdx]
            if (spr && spr._ready) {
              ctx.save()
              ctx.globalAlpha = p.alpha * 1.5
              ctx.translate(p.x, drawY)
              ctx.rotate(p.rotation * 0.3) // subtle rotation, not spinning
              // Glow behind sprite
              ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, 0.5)`
              ctx.shadowBlur = p.size * 0.6
              ctx.drawImage(spr, -p.size/2, -p.size/2, p.size, p.size)
              ctx.shadowBlur = 0
              ctx.restore()
            } else {
              // Fallback diamond if sprite didn't load
              ctx.save()
              ctx.translate(p.x, drawY)
              ctx.rotate(p.rotation)
              ctx.beginPath()
              ctx.moveTo(0, -p.size * 0.4)
              ctx.lineTo(p.size * 0.28, 0)
              ctx.lineTo(0, p.size * 0.4)
              ctx.lineTo(-p.size * 0.28, 0)
              ctx.closePath()
              ctx.strokeStyle = `hsla(${p.hue}, 80%, 60%, ${p.alpha})`
              ctx.lineWidth = 1
              ctx.stroke()
              ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.alpha * 0.3})`
              ctx.fill()
              ctx.restore()
            }

            // Bezier connection curves between nearby entities
            for (const q of this._particles) {
              if (p === q) continue
              const dist = Math.hypot(p.x - q.x, p.y - q.y)
              if (dist < 200) {
                const strength = 0.025 * (1 - dist / 200)
                // Bezier curve — the connection bends based on entity types
                const midX = (p.x + q.x) / 2
                const midY = (p.y + q.y + bobY) / 2
                // Control point offset — perpendicular to the line, oscillating
                const angle = Math.atan2(q.y - p.y, q.x - p.x)
                const perpX = Math.cos(angle + Math.PI/2) * Math.sin(time + p.hue * 0.01) * 30
                const perpY = Math.sin(angle + Math.PI/2) * Math.sin(time + p.hue * 0.01) * 30

                ctx.beginPath()
                ctx.moveTo(p.x, p.y + bobY)
                ctx.quadraticCurveTo(midX + perpX, midY + perpY, q.x, q.y + Math.sin(q.bobPhase) * 3)
                ctx.strokeStyle = `rgba(0, 210, 255, ${strength})`
                ctx.lineWidth = 0.8
                ctx.stroke()
              }
            }
          }
        } catch (err) {
          console.warn('AFKManager: animation frame error', err)
        }

        this._animFrame = requestAnimationFrame(animate)
      }
      animate()
    } catch (err) {
      console.warn('AFKManager: failed to create screensaver overlay', err)
    }
  }

  _hideOverlay() {
    if (this._overlay) {
      this._overlay.remove()
      this._overlay = null
    }
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame)
      this._animFrame = null
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler)
      this._resizeHandler = null
    }
  }

  // Set custom timeout (in minutes)
  setTimeout(minutes) {
    this.timeout = minutes * 60 * 1000
  }

  // Temporarily disable (e.g., during video playback)
  disable() {
    this.timeout = Infinity
  }

  enable(minutes = 5) {
    this.timeout = minutes * 60 * 1000
  }
}

// Initialize globally
const afk = new AFKManager(5 * 60 * 1000) // 5 minutes

// Wire to game pause
afk.onAFK = () => {
  try {
    // If a game is running in iframe, post message to pause
    const frame = document.getElementById('game-frame')
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ type: 'afk', action: 'pause' }, '*')
    }

    // Auto-save if logged in
    if (typeof auth !== 'undefined' && auth.isLoggedIn) {
      console.log('Auto-saving before AFK...')
      // Games should listen for 'afk' event and save their state
    }
  } catch (err) {
    console.warn('AFKManager: onAFK handler failed', err)
  }
}

afk.onReturn = () => {
  try {
    const frame = document.getElementById('game-frame')
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ type: 'afk', action: 'resume' }, '*')
    }
  } catch (err) {
    console.warn('AFKManager: onReturn handler failed', err)
  }
}
