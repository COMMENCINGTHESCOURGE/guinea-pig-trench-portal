// Guinea Pig Trench — Sprite Atlas System
// Consolidates multiple sprite images into single atlases
// Reduces HTTP requests, enables batch rendering
//
// Atlas types:
// 1. CHARACTER atlas — all playable characters in one sheet
// 2. UI atlas — icons, cores, portraits, HUD elements
// 3. NATURE atlas — trees, flowers, environmental props
//
// Each atlas loads ONE image, games cut regions from it

class SpriteAtlas {
  constructor() {
    this.atlases = {}
    this.loaded = false
    this.onReady = null
    this._pending = 0
  }

  // Register an atlas with named regions
  register(name, imageSrc, regions) {
    const atlas = {
      name,
      image: new Image(),
      regions,  // {regionName: {x, y, w, h}}
      ready: false,
    }

    this._pending++
    atlas.image.onload = () => {
      atlas.ready = true
      this._pending--
      if (this._pending === 0) {
        this.loaded = true
        if (this.onReady) this.onReady()
      }
    }
    atlas.image.onerror = () => {
      console.warn('Atlas failed to load:', name, imageSrc)
      this._pending--
      if (this._pending === 0) {
        this.loaded = true
        if (this.onReady) this.onReady()
      }
    }
    atlas.image.src = imageSrc

    this.atlases[name] = atlas
    return this
  }

  // Draw a named region from a named atlas
  draw(ctx, atlasName, regionName, destX, destY, destW, destH, flipH = false) {
    const atlas = this.atlases[atlasName]
    if (!atlas || !atlas.ready) return false

    const region = atlas.regions[regionName]
    if (!region) return false

    ctx.save()
    if (flipH) {
      ctx.translate(destX + destW, destY)
      ctx.scale(-1, 1)
      ctx.drawImage(
        atlas.image,
        region.x, region.y, region.w, region.h,
        0, 0, destW, destH
      )
    } else {
      ctx.drawImage(
        atlas.image,
        region.x, region.y, region.w, region.h,
        destX, destY, destW, destH
      )
    }
    ctx.restore()
    return true
  }

  // Get the Image object for WebGL texture use
  getImage(atlasName) {
    const atlas = this.atlases[atlasName]
    return atlas?.ready ? atlas.image : null
  }

  // Get region info for manual rendering
  getRegion(atlasName, regionName) {
    const atlas = this.atlases[atlasName]
    if (!atlas) return null
    return atlas.regions[regionName] || null
  }

  // Check if a specific atlas is loaded
  isReady(atlasName) {
    return this.atlases[atlasName]?.ready || false
  }
}

// ── Build the Guinea Pig Trench atlases ──

// Since we can't dynamically pack images at runtime without a build step,
// we define our existing sprite sheets AS atlases with named regions.
// This means each "atlas" is one of our existing sprite sheets,
// but accessed through a uniform API.

const spriteAtlas = new SpriteAtlas()

// CHARACTER ATLAS — Armored Defender sprite sheet
// Layout: 6 columns x 3 rows, each cell ~200x133px (1200x400 total)
spriteAtlas.register('defender', '../assets/sprites/armored_defender_sprite_sheet.png', {
  'idle_1':    {x: 0,   y: 0,   w: 200, h: 133},
  'idle_2':    {x: 200, y: 0,   w: 200, h: 133},
  'idle_3':    {x: 400, y: 0,   w: 200, h: 133},
  'idle_4':    {x: 600, y: 0,   w: 200, h: 133},
  'idle_5':    {x: 800, y: 0,   w: 200, h: 133},
  'idle_6':    {x: 1000,y: 0,   w: 200, h: 133},
  'walk_1':    {x: 0,   y: 133, w: 200, h: 133},
  'walk_2':    {x: 200, y: 133, w: 200, h: 133},
  'walk_3':    {x: 400, y: 133, w: 200, h: 133},
  'walk_4':    {x: 600, y: 133, w: 200, h: 133},
  'walk_5':    {x: 800, y: 133, w: 200, h: 133},
  'walk_6':    {x: 1000,y: 133, w: 200, h: 133},
  'attack_1':  {x: 0,   y: 266, w: 200, h: 133},
  'attack_2':  {x: 200, y: 266, w: 200, h: 133},
  'attack_3':  {x: 400, y: 266, w: 200, h: 133},
  'attack_4':  {x: 600, y: 266, w: 200, h: 133},
  'attack_5':  {x: 800, y: 266, w: 200, h: 133},
  'attack_6':  {x: 1000,y: 266, w: 200, h: 133},
  'portrait':  {x: 0,   y: 0,   w: 200, h: 133}, // first idle frame as portrait
})

// CHARACTER ATLAS — Dim Mak Fighter
// Complex layout — define key regions manually
spriteAtlas.register('dimmak', '../assets/sprites/dim_mak_fighter_full_sheet.png', {
  'stand_idle':    {x: 0,   y: 0,   w: 180, h: 280},
  'stand_punch':   {x: 180, y: 0,   w: 160, h: 200},
  'stand_kick':    {x: 340, y: 0,   w: 160, h: 200},
  'stand_run':     {x: 180, y: 200, w: 160, h: 200},
  'stand_victory': {x: 340, y: 200, w: 160, h: 200},
  'crouch_idle':   {x: 0,   y: 500, w: 180, h: 220},
  'crouch_attack': {x: 180, y: 500, w: 160, h: 200},
  'crouch_kick':   {x: 340, y: 500, w: 160, h: 200},
  'portrait':      {x: 0,   y: 0,   w: 180, h: 180},
})

// MECHA ENTITY
spriteAtlas.register('mecha', '../assets/sprites/mecha_entity_alpha_v2_pixel.png', {
  'bust':      {x: 0, y: 0, w: 512, h: 256},  // top portion
  'full':      {x: 0, y: 0, w: 512, h: 512},  // full body
  'portrait':  {x: 128, y: 0, w: 256, h: 256}, // centered head
})

// UI ATLAS — Geometric cores
spriteAtlas.register('ui', '../assets/sprites/geometric_core_geode_flux.png', {
  'geode':   {x: 0,   y: 0,   w: 400, h: 300},  // top half — geode
  'flux':    {x: 0,   y: 300, w: 400, h: 300},  // bottom half — flux
  'full':    {x: 0,   y: 0,   w: 800, h: 600},  // entire sheet
})

// BOSS SPRITES
spriteAtlas.register('kraken', '../assets/sprites/kraken_game_render.png', {
  'full':    {x: 0, y: 0, w: 500, h: 800},
  'head':    {x: 50, y: 0, w: 400, h: 400},
  'portrait':{x: 100, y: 50, w: 300, h: 300},
})

spriteAtlas.register('akuaku', '../assets/sprites/aku_aku_mask_stylized.png', {
  'full':    {x: 0, y: 0, w: 600, h: 400},
  'mask':    {x: 100, y: 20, w: 400, h: 350},
  'portrait':{x: 150, y: 50, w: 300, h: 280},
})

// GRIEF WARRIORS
spriteAtlas.register('grief', '../assets/sprites/grief_warrior_sprite_sheet.png', {
  'idle_1':      {x: 0,   y: 0,   w: 250, h: 200},
  'idle_2':      {x: 250, y: 0,   w: 250, h: 200},
  'defensive':   {x: 0,   y: 400, w: 250, h: 200},
  'wounded':     {x: 0,   y: 600, w: 250, h: 200},
  'portrait':    {x: 0,   y: 0,   w: 250, h: 200},
})

// CEPHALON (Octopus Head) — placeholder until sprite sheet is created
spriteAtlas.register('cephalon', '../assets/sprites/cephalon_sprite_sheet.png', {
  'idle_1':    {x: 0,   y: 0,   w: 200, h: 200},
  'idle_2':    {x: 200, y: 0,   w: 200, h: 200},
  'idle_3':    {x: 400, y: 0,   w: 200, h: 200},
  'idle_4':    {x: 600, y: 0,   w: 200, h: 200},
  'walk_1':    {x: 0,   y: 200, w: 200, h: 200},
  'walk_2':    {x: 200, y: 200, w: 200, h: 200},
  'walk_3':    {x: 400, y: 200, w: 200, h: 200},
  'walk_4':    {x: 600, y: 200, w: 200, h: 200},
  'attack_1':  {x: 0,   y: 400, w: 200, h: 200},
  'attack_2':  {x: 200, y: 400, w: 200, h: 200},
  'attack_3':  {x: 400, y: 400, w: 200, h: 200},
  'attack_4':  {x: 600, y: 400, w: 200, h: 200},
  'special_1': {x: 0,   y: 600, w: 200, h: 200},
  'special_2': {x: 200, y: 600, w: 200, h: 200},
  'portrait':  {x: 0,   y: 0,   w: 200, h: 200},
})

// FLORAE (Plant People) — placeholder until sprite sheet is created
spriteAtlas.register('florae', '../assets/sprites/florae_sprite_sheet.png', {
  'idle_1':    {x: 0,   y: 0,   w: 200, h: 200},
  'idle_2':    {x: 200, y: 0,   w: 200, h: 200},
  'idle_3':    {x: 400, y: 0,   w: 200, h: 200},
  'idle_4':    {x: 600, y: 0,   w: 200, h: 200},
  'walk_1':    {x: 0,   y: 200, w: 200, h: 200},
  'walk_2':    {x: 200, y: 200, w: 200, h: 200},
  'walk_3':    {x: 400, y: 200, w: 200, h: 200},
  'walk_4':    {x: 600, y: 200, w: 200, h: 200},
  'attack_1':  {x: 0,   y: 400, w: 200, h: 200},
  'attack_2':  {x: 200, y: 400, w: 200, h: 200},
  'attack_3':  {x: 400, y: 400, w: 200, h: 200},
  'attack_4':  {x: 600, y: 400, w: 200, h: 200},
  'special_1': {x: 0,   y: 600, w: 200, h: 200},
  'special_2': {x: 200, y: 600, w: 200, h: 200},
  'portrait':  {x: 0,   y: 0,   w: 200, h: 200},
})

// Log when all atlases are ready
spriteAtlas.onReady = () => {
  console.log('All sprite atlases loaded:', Object.keys(spriteAtlas.atlases).length, 'sheets')
}

// Expose globally
window.spriteAtlas = spriteAtlas

// Usage example:
// spriteAtlas.draw(ctx, 'defender', 'idle_1', x, y, 64, 64)
// spriteAtlas.draw(ctx, 'dimmak', 'stand_punch', x, y, 48, 72, true) // flipped
// spriteAtlas.draw(ctx, 'ui', 'geode', x, y, 32, 32)
// if (spriteAtlas.isReady('mecha')) { ... }
