// Guinea Pig Trench — UI Sprite Integration
// Adds sprite-based visual elements throughout the portal interface
// Uses the sprite atlas system to draw character art into UI elements

class UISpriteManager {
  constructor() {
    this._ready = false
    this._checkInterval = null

    // Wait for sprite atlas to load, then decorate the UI
    this._checkInterval = setInterval(() => {
      if (typeof spriteAtlas !== 'undefined' && spriteAtlas.loaded) {
        clearInterval(this._checkInterval)
        this._ready = true
        this._decoratePortal()
      }
    }, 200)

    // Also decorate on DOMContentLoaded in case atlas loads after
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => this._decoratePortal(), 1000)
    })
  }

  _decoratePortal() {
    this._addLogoSprite()
    this._addNavSprites()
    this._addMusicPlayerSprite()
    this._addHeroCharacter()
    this._addGameCardSprites()
    this._addPartySprites()
    console.log('UI sprites applied to portal')
  }

  // Mecha Entity in the header logo area
  _addLogoSprite() {
    const logo = document.querySelector('.logo')
    if (!logo) return

    const canvas = document.createElement('canvas')
    canvas.width = 24
    canvas.height = 24
    canvas.style.cssText = 'margin-right:8px;vertical-align:middle;image-rendering:pixelated'

    const ctx = canvas.getContext('2d')
    // Draw mecha portrait from atlas
    if (spriteAtlas?.isReady('mecha')) {
      spriteAtlas.draw(ctx, 'mecha', 'portrait', 0, 0, 24, 24)
    } else {
      // Fallback: teal diamond icon
      ctx.fillStyle = '#00d2ff'
      ctx.beginPath()
      ctx.moveTo(12, 2); ctx.lineTo(22, 12); ctx.lineTo(12, 22); ctx.lineTo(2, 12)
      ctx.closePath()
      ctx.fill()
    }

    logo.insertBefore(canvas, logo.firstChild)
  }

  // Character icons next to nav links
  _addNavSprites() {
    const navLinks = document.querySelectorAll('#main-nav a')
    const navIcons = {
      'home': { atlas: 'ui', frame: 'geode', fallback: '◆' },
      'games': { atlas: 'defender', frame: 'portrait', fallback: '⚔' },
      'gallery': { atlas: 'akuaku', frame: 'portrait', fallback: '🎨' },
      'music': { atlas: 'ui', frame: 'flux', fallback: '♫' },
      'party': { atlas: 'grief', frame: 'portrait', fallback: '👥' },
    }

    navLinks.forEach(link => {
      const page = link.dataset.page
      const iconDef = navIcons[page]
      if (!iconDef) return

      const canvas = document.createElement('canvas')
      canvas.width = 14
      canvas.height = 14
      canvas.style.cssText = 'margin-right:4px;vertical-align:middle;image-rendering:pixelated;opacity:0.5'

      const ctx = canvas.getContext('2d')
      if (spriteAtlas?.isReady(iconDef.atlas)) {
        spriteAtlas.draw(ctx, iconDef.atlas, iconDef.frame, 0, 0, 14, 14)
      } else {
        ctx.fillStyle = 'rgba(0,210,255,0.4)'
        ctx.font = '10px monospace'
        ctx.fillText(iconDef.fallback, 1, 11)
      }

      link.insertBefore(canvas, link.firstChild)
    })
  }

  // Character portrait in music player bar
  _addMusicPlayerSprite() {
    const bar = document.getElementById('music-bar')
    if (!bar) return

    const canvas = document.createElement('canvas')
    canvas.width = 28
    canvas.height = 28
    canvas.style.cssText = 'margin-right:8px;image-rendering:pixelated;border-radius:4px;border:1px solid rgba(0,210,255,0.15)'

    const ctx = canvas.getContext('2d')
    // Cycle through character portraits based on current track
    const drawPortrait = () => {
      ctx.clearRect(0, 0, 28, 28)
      ctx.fillStyle = 'rgba(12,12,18,0.8)'
      ctx.fillRect(0, 0, 28, 28)

      const atlases = ['mecha', 'defender', 'dimmak', 'kraken', 'akuaku']
      const trackIdx = typeof musicPlayer !== 'undefined' ? musicPlayer.currentIndex : 0
      const atlasName = atlases[Math.abs(trackIdx) % atlases.length]

      if (spriteAtlas?.isReady(atlasName)) {
        spriteAtlas.draw(ctx, atlasName, 'portrait', 2, 2, 24, 24)
      }
    }

    drawPortrait()
    // Update portrait when track changes
    setInterval(drawPortrait, 3000)

    bar.insertBefore(canvas, bar.firstChild)
  }

  // Hero section character on home page
  _addHeroCharacter() {
    const hero = document.querySelector('.hero-text')
    if (!hero) return

    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 160
    canvas.style.cssText = `
      position:absolute; right:10%; top:50%; transform:translateY(-50%);
      image-rendering:pixelated; opacity:0.15; pointer-events:none;
    `

    const ctx = canvas.getContext('2d')
    if (spriteAtlas?.isReady('mecha')) {
      spriteAtlas.draw(ctx, 'mecha', 'full', 0, 0, 120, 160)
    } else if (spriteAtlas?.isReady('defender')) {
      spriteAtlas.draw(ctx, 'defender', 'idle_1', 0, 0, 120, 160)
    }

    const heroParent = document.querySelector('.hero')
    if (heroParent) heroParent.appendChild(canvas)
  }

  // Character thumbnails on game cards
  _addGameCardSprites() {
    const cards = document.querySelectorAll('.game-card')
    const gameCharMap = {
      'stealth-maze': { atlas: 'mecha', frame: 'portrait' },
      'sand-garden': { atlas: 'dimmak', frame: 'portrait' },
      'sprite-brawler': { atlas: 'defender', frame: 'portrait' },
      'dungeon-shooter': { atlas: 'kraken', frame: 'portrait' },
      'voxel-engine': { atlas: 'mecha', frame: 'portrait' },
      'void-runner': { atlas: 'mecha', frame: 'bust' },
      'terrain-walker': { atlas: 'grief', frame: 'portrait' },
      'bloom-meadow': { atlas: 'akuaku', frame: 'portrait' },
    }

    cards.forEach(card => {
      const gameId = card.dataset.game
      const charDef = gameCharMap[gameId]
      if (!charDef) return

      const canvas = document.createElement('canvas')
      canvas.width = 40
      canvas.height = 40
      canvas.style.cssText = `
        position:absolute; bottom:8px; left:8px; z-index:3;
        image-rendering:pixelated; opacity:0.6;
        border-radius:4px; border:1px solid rgba(0,210,255,0.15);
        background:rgba(0,0,0,0.4);
      `

      const ctx = canvas.getContext('2d')
      if (spriteAtlas?.isReady(charDef.atlas)) {
        spriteAtlas.draw(ctx, charDef.atlas, charDef.frame, 4, 4, 32, 32)
      }

      // Add to the card's preview area
      const preview = card.querySelector('.card-preview')
      if (preview) {
        preview.style.position = 'relative'
        preview.appendChild(canvas)
      }
    })
  }

  // Party page character avatars
  _addPartySprites() {
    const partyPanel = document.getElementById('party-panel')
    if (!partyPanel) return

    // Add a character selector above the party controls
    const selector = document.createElement('div')
    selector.style.cssText = `
      display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;
    `

    const characters = [
      { atlas: 'mecha', frame: 'portrait', name: 'Mecha' },
      { atlas: 'defender', frame: 'portrait', name: 'Defender' },
      { atlas: 'dimmak', frame: 'portrait', name: 'Dim Mak' },
      { atlas: 'kraken', frame: 'portrait', name: 'Kraken' },
      { atlas: 'akuaku', frame: 'portrait', name: 'Aku Aku' },
    ]

    const label = document.createElement('div')
    label.style.cssText = 'width:100%;font-size:9px;letter-spacing:.15em;color:rgba(0,210,255,.3);text-transform:uppercase;margin-bottom:4px'
    label.textContent = 'YOUR AVATAR'
    selector.appendChild(label)

    characters.forEach((char, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      canvas.style.cssText = `
        cursor:pointer; border-radius:4px; image-rendering:pixelated;
        border:1px solid ${i === 0 ? 'var(--teal)' : 'var(--border)'};
        background:rgba(0,0,0,0.3); transition:border-color .2s;
      `
      canvas.title = char.name

      const ctx = canvas.getContext('2d')
      if (spriteAtlas?.isReady(char.atlas)) {
        spriteAtlas.draw(ctx, char.atlas, char.frame, 2, 2, 28, 28)
      } else {
        ctx.fillStyle = 'rgba(0,210,255,0.2)'
        ctx.fillRect(2, 2, 28, 28)
        ctx.fillStyle = 'rgba(0,210,255,0.5)'
        ctx.font = '8px monospace'
        ctx.fillText(char.name[0], 10, 20)
      }

      canvas.addEventListener('click', () => {
        // Deselect all
        selector.querySelectorAll('canvas').forEach(c => c.style.borderColor = 'var(--border)')
        // Select this one
        canvas.style.borderColor = 'var(--teal)'
        // Store selected avatar
        localStorage.setItem('gpt_avatar', char.name)
        console.log('Avatar selected:', char.name)
      })

      selector.appendChild(canvas)
    })

    partyPanel.insertBefore(selector, partyPanel.firstChild)
  }
}

const uiSprites = new UISpriteManager()
