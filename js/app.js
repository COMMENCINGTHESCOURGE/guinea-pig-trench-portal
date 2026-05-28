// Guinea Pig Trench — App Entry Point
// Initialize all systems

document.addEventListener('DOMContentLoaded', () => {
  console.log('Guinea Pig Trench Portal — Loading...')
  console.log('Guinea Pig Trench LLC — ohthatsthe / skippyohms / commencethescourge')

  // Render game grid
  renderGameGrid()

  // Sync all game counts with actual GAMES array
  if (typeof GAMES !== 'undefined') {
    const count = GAMES.length
    const statEl = document.getElementById('stat-games')
    if (statEl) statEl.textContent = count
    const featEl = document.getElementById('feat-games')
    if (featEl) featEl.textContent = count + ' GAMES'
  }

  // Render gallery
  renderGallery()

  // Hero canvas — simple particle background
  initHeroCanvas()

  // Screenshot on S key or right-click
  document.addEventListener('keydown', e => {
    if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey) {
      takeScreenshot()
    }
  })
  document.addEventListener('contextmenu', e => {
    // Right-click = screenshot on the portal (not inside games)
    const gameViewer = document.getElementById('game-viewer')
    if (gameViewer && gameViewer.style.display !== 'none') return // let games handle their own
    e.preventDefault()
    takeScreenshot()
  })

  console.log('Portal ready. Press S or right-click to screenshot.')

  // ── Animated Favicon — Fungi Diamond ──
  // Reaction-diffusion inspired: the diamond breathes through
  // chemical states. Two chemicals (A=teal, B=dark) diffuse
  // across the icon. The diamond shape is the seed.
  ;(function animatedFavicon() {
    const S = 32 // favicon canvas size
    const fc = document.createElement('canvas')
    fc.width = S; fc.height = S
    const fx = fc.getContext('2d')
    const link = document.querySelector('link[sizes="32x32"]') || document.createElement('link')
    link.rel = 'icon'; link.type = 'image/png'; link.sizes = '32x32'
    if (!link.parentNode) document.head.appendChild(link)

    // RD state — two chemical fields
    const A = new Float32Array(S * S).fill(1)
    const B = new Float32Array(S * S).fill(0)

    // Seed B in diamond shape
    const cx = S/2, cy = S/2, r = S * 0.38
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        // Diamond distance
        const d = Math.abs(x - cx) + Math.abs(y - cy)
        if (d < r) {
          B[y * S + x] = d < r * 0.5 ? 0.3 : 0.8
        }
      }
    }

    // RD parameters — coral/mitosis pattern
    const dA = 0.8, dB = 0.4
    let tick = 0

    function rdStep() {
      // Oscillating f,k creates breathing effect
      const breath = Math.sin(tick * 0.02) * 0.5 + 0.5
      const f = 0.035 + breath * 0.015
      const k = 0.060 + breath * 0.004

      const A2 = new Float32Array(A)
      const B2 = new Float32Array(B)

      for (let y = 1; y < S-1; y++) {
        for (let x = 1; x < S-1; x++) {
          const i = y * S + x
          // 5-point Laplacian
          const lapA = A[(y-1)*S+x] + A[(y+1)*S+x] + A[y*S+x-1] + A[y*S+x+1] - 4*A[i]
          const lapB = B[(y-1)*S+x] + B[(y+1)*S+x] + B[y*S+x-1] + B[y*S+x+1] - 4*B[i]
          const abb = A[i] * B[i] * B[i]
          A2[i] = A[i] + (dA * lapA - abb + f * (1 - A[i])) * 0.9
          B2[i] = B[i] + (dB * lapB + abb - (f + k) * B[i]) * 0.9
        }
      }

      A.set(A2)
      B.set(B2)
    }

    function renderFavicon() {
      // Run 3 RD steps per frame (cheap at 32x32)
      for (let i = 0; i < 3; i++) rdStep()
      tick++

      const img = fx.createImageData(S, S)
      const d = img.data
      for (let i = 0; i < S * S; i++) {
        const b = B[i]
        const a = A[i]
        // Teal diamond colors: dark bg, teal chemical B, center glow
        const px = i * 4
        d[px]     = Math.min(255, b * 0 + (1-b) * 12)           // R
        d[px + 1] = Math.min(255, b * 210 * (0.6 + a*0.4) | 0)  // G
        d[px + 2] = Math.min(255, b * 255 * (0.7 + a*0.3) | 0)  // B
        d[px + 3] = 255                                           // A
      }
      fx.putImageData(img, 0, 0)
      link.href = fc.toDataURL('image/png')
    }

    // Update every 200ms — slow enough to not waste CPU, fast enough to see motion
    setInterval(renderFavicon, 200)
    renderFavicon()
  })();
  console.log(`Auth: ${typeof auth !== 'undefined' ? (auth.offline ? 'OFFLINE' : 'connected') : 'deferred'}`)
  console.log(`Games: ${GAMES.length} registered`)
})

function takeScreenshot() {
  // Try canvas first (hero, game preview)
  const canvas = document.querySelector('#hero-canvas') || document.querySelector('canvas')
  if (canvas) {
    try {
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = 'gpt_portal_' + Date.now() + '.png'
      a.click()
      // Flash feedback
      const flash = document.createElement('div')
      flash.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,210,255,0.08);pointer-events:none;transition:opacity 0.3s'
      document.body.appendChild(flash)
      setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 300) }, 50)
      return
    } catch(e) {}
  }
  // Fallback: just flash to confirm (browser security blocks full page screenshot)
  const flash = document.createElement('div')
  flash.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;align-items:center;justify-content:center;background:rgba(0,210,255,0.06);transition:opacity 0.5s'
  flash.innerHTML = '<div style="color:#00d2ff;font-size:10px;letter-spacing:.3em;font-family:monospace">USE PRINT SCREEN FOR FULL PAGE</div>'
  document.body.appendChild(flash)
  setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 500) }, 1500)
}

// ─── Gallery ──────────────────────────────────────────────────
function renderGallery() {
  const grid = document.getElementById('gallery-grid')
  if (!grid) return

  const artworks = [
    { src: 'assets/gallery/teal_robot_character.png', title: 'Mecha Entity Alpha', year: '2017', desc: 'The original teal robot — first character design' },
    { src: 'assets/gallery/the_dudes_geometric_mechs.jpg', title: 'The Dudes', year: '2017', desc: 'Three geometric mech variants — hand-drawn' },
    { src: 'assets/gallery/mecha_entity_alpha_v2.png', title: 'Mecha Entity V2', year: '2026', desc: 'Hero character — pixel art reconstruction' },
    { src: 'assets/gallery/characters/dim_mak_fighter_full_sheet.jpg', title: 'Dim Mak Fighter', year: '2026', desc: 'Full move set — standing, crouching, running, cigar' },
    { src: 'assets/gallery/characters/grief_warrior_sprite_sheet.jpg', title: 'Grief Warriors', year: '2026', desc: 'Story NPCs — idle, defensive, wounded' },
    { src: 'assets/gallery/characters/warrior_deconstructed_parts.png', title: 'Warrior Deconstructed', year: '2026', desc: 'Physical painting → digital parts for skeletal animation' },
    { src: 'assets/gallery/enemies/vampire_mage_full_sheet.png', title: 'Vampire Mage', year: '2026', desc: 'Boss enemy — idle, cast, walk, heavy cast, death' },
    { src: 'assets/gallery/enemies/red_mage_full_sheet.png', title: 'Red Mage', year: '2026', desc: 'Enemy with beam attack and portal effects' },
    { src: 'assets/gallery/environments/underwater_pixel_tileset.png', title: 'Underwater Tileset', year: '2026', desc: 'Crabs, jellyfish, ruins, coral — 16-bit pixel art' },
    { src: 'assets/gallery/tilesets/factory_tileset_full.png', title: 'Factory Tileset', year: '2026', desc: 'Industrial base tiles, hazards, connectors, animated cores' },
    { src: 'assets/gallery/ui/geometric_core_geode_flux.jpg', title: 'Geometric Cores', year: '2026', desc: 'Collectible items — Geode and Flux types with rotation' },
    { src: 'assets/gallery/vfx/teal_mandala_animation.png', title: 'Teal Mandala VFX', year: '2026', desc: 'Portal/bloom animation — 20 frames of mandala energy burst' },
    { src: 'assets/gallery/creatures/fish_kraken_emblems.png', title: 'Kraken Emblems', year: '2026', desc: 'Boss creature designs — fish school + kraken compass rose' },
    { src: 'assets/gallery/characters/4fighters_move_strips.png', title: 'Four Fighters', year: '2026', desc: 'Cross-biome character roster — full move strips' },
    { src: 'assets/gallery/props/doors_consoles_elevators.png', title: 'Cyberpunk Props', year: '2026', desc: 'Doors, consoles, vents, elevators — factory biome' },
    { src: 'assets/gallery/ufo_kit/ufo_complete_kit.png', title: 'UFO Kit', year: '2026', desc: 'Complete UFO asset set with labeled components' },
  ]

  grid.innerHTML = ''
  for (const art of artworks) {
    const card = document.createElement('div')
    card.className = 'gallery-card'
    card.style.cssText = 'background:rgba(0,255,210,0.02);border:1px solid rgba(0,255,210,0.08);overflow:hidden;cursor:pointer;transition:border-color 0.2s'
    card.onmouseover = () => card.style.borderColor = 'rgba(0,255,210,0.3)'
    card.onmouseout = () => card.style.borderColor = 'rgba(0,255,210,0.08)'

    card.innerHTML = `
      <img src="${art.src}" alt="${art.title}" loading="lazy"
           style="width:100%;height:200px;object-fit:cover;display:block;image-rendering:pixelated"
           onerror="this.style.display='none'">
      <div style="padding:12px">
        <div style="color:#00FFD2;font-size:11px;letter-spacing:0.15em">${art.title}</div>
        <div style="color:rgba(255,255,255,0.3);font-size:9px;margin-top:4px">${art.desc}</div>
        <div style="color:rgba(212,168,68,0.4);font-size:8px;margin-top:4px;letter-spacing:0.2em">${art.year} · ohthatsthe</div>
      </div>
    `

    // Lightbox on click
    card.addEventListener('click', () => {
      const overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-direction:column;gap:12px'
      overlay.innerHTML = `
        <img src="${art.src}" style="max-width:90vw;max-height:80vh;object-fit:contain;image-rendering:pixelated">
        <div style="color:#00FFD2;font-size:13px;letter-spacing:0.2em">${art.title}</div>
        <div style="color:rgba(255,255,255,0.4);font-size:10px">${art.desc}</div>
      `
      overlay.addEventListener('click', () => overlay.remove())
      document.body.appendChild(overlay)
    })

    grid.appendChild(card)
  }
}

// ─── Hero Background Animation ──────────────────────────────
// Floating vial captures with interpolation — epilepsy-safe, brand-native
function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas')
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  let w, h, vials = []

  function resize() {
    w = canvas.width = canvas.parentElement.offsetWidth
    h = canvas.height = canvas.parentElement.offsetHeight
    // Spawn floating vial PAIRS across the canvas
    // Each pair is VOL+tendril+PIT as captured — one unit
    vials = []
    const count = Math.max(5, Math.floor(w / 200))
    for (let i = 0; i < count; i++) {
      vials.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.1,
        scale: 0.6 + Math.random() * 1.0,
        offset: Math.floor(Math.random() * 44), // random capture start (not frame)
        speed: 0.3 + Math.random() * 0.5,
        alpha: 0.06 + Math.random() * 0.1,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.2 + Math.random() * 0.3,
      })
    }
  }

  function draw() {
    ctx.fillStyle = '#0c0c12'
    ctx.fillRect(0, 0, w, h)

    if (window.VialAnimator && window.VialAnimator.isLoaded()) {
      for (const v of vials) {
        v.x += v.vx
        v.y += v.vy
        v.bobPhase += v.bobSpeed * 0.016
        const bobY = Math.sin(v.bobPhase) * 4

        // Wrap
        if (v.x < -80) v.x = w + 80
        if (v.x > w + 80) v.x = -80
        if (v.y < -120) v.y = h + 120
        if (v.y > h + 120) v.y = -120

        const vw = 64 * v.scale
        const vh = 100 * v.scale

        ctx.globalAlpha = v.alpha
        VialAnimator.draw(ctx, v.x - vw/2, v.y - vh/2 + bobY, vw, vh, v.speed, v.offset)
      }
      ctx.globalAlpha = 1

      // Bezier connections between nearby vials
      for (let i = 0; i < vials.length; i++) {
        for (let j = i + 1; j < vials.length; j++) {
          const dx = vials[i].x - vials[j].x
          const dy = vials[i].y - vials[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 200) {
            const strength = 0.04 * (1 - dist / 200)
            ctx.beginPath()
            ctx.moveTo(vials[i].x, vials[i].y)
            // Curved connection
            const mx = (vials[i].x + vials[j].x) / 2
            const my = (vials[i].y + vials[j].y) / 2 + Math.sin(Date.now() * 0.001 + i) * 15
            ctx.quadraticCurveTo(mx, my, vials[j].x, vials[j].y)
            ctx.strokeStyle = `rgba(0, 210, 255, ${strength})`
            ctx.lineWidth = 0.6
            ctx.stroke()
          }
        }
      }
    } else {
      // Fallback while sprite sheet loads — subtle dots
      ctx.fillStyle = 'rgba(0, 210, 255, 0.03)'
      for (let i = 0; i < 30; i++) {
        const x = (Math.sin(Date.now() * 0.0001 * (i + 1)) * 0.5 + 0.5) * w
        const y = (Math.cos(Date.now() * 0.00008 * (i + 1)) * 0.5 + 0.5) * h
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    requestAnimationFrame(draw)
  }

  window.addEventListener('resize', resize)
  resize()
  draw()
}
