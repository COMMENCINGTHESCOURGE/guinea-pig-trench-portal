# ES6 Module Migration Guide

## Overview
This guide documents the migration path from global script tags to native ES6 modules for the Guinea Pig Trench Portal. This improves code organization, prevents global namespace pollution, and enables better dependency management as we scale to 40+ games.

## Current State
- Core engine files use `<script src="...">` with global namespace
- Games load scripts synchronously in HTML
- Shared utilities (music.js, router.js, party.js) pollute window object

## Target Architecture

### Core Modules (js/)
```html
<!-- Before -->
<script src="js/game-shell.js"></script>
<script src="js/router.js"></script>
<script src="js/music.js"></script>

<!-- After -->
<script type="module">
  import { GameShell } from './js/game-shell.js';
  import { Router } from './js/router.js';
  import { MusicPlayer } from './js/music.js';
  
  const shell = new GameShell();
  const router = new Router();
  const music = new MusicPlayer();
</script>
```

### Module Exports Pattern

**constants.js** (Already implemented)
```javascript
export const TAU = 2 * Math.PI;
export const PHI = (1 + Math.sqrt(5)) / 2;
export function normalizeAngle(angle) { ... }
```

**game-shell.js** (To be migrated)
```javascript
// Add at top
// Remove: class GameShell { ... } from global scope

export class GameShell {
  constructor() { ... }
  // ... methods
}

// Optional: auto-instantiate if loaded directly
if (import.meta.url === document.currentScript.src) {
  window.gameShell = new GameShell();
}
```

**music.js** (Partially migrated - IPFS support added)
```javascript
export class MusicPlayer {
  constructor() { ... }
  async loadTrack(index) { ... }
  // ... methods
}
```

**party/party.js** (To be migrated)
```javascript
export class PartyChat {
  constructor() { ... }
  // P2P WebRTC logic
}
```

### Game-Specific Modules (games/js/)
Each game should become a self-contained module:

```javascript
// games/js/starfield_4d.js
import { TAU, normalizeAngle } from '../../js/constants.js';

export class Starfield4D {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2');
    // Use TAU instead of Math.PI * 2 for consistency
  }
  
  render(time) {
    const angle = normalizeAngle(time * 0.5);
    // ... rendering logic
  }
}

// Auto-start if loaded directly
if (import.meta.url === document.currentScript.src) {
  const canvas = document.getElementById('gl');
  const game = new Starfield4D(canvas);
  function loop(ts) {
    game.render(ts / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
```

## Migration Checklist

### Phase 1: Foundation (Done ✓)
- [x] Create `js/constants.js` with shared math constants
- [x] Add Service Worker (`sw.js`) for PWA support
- [x] Create `manifest.json` for PWA installation
- [x] Register Service Worker in `index.html`

### Phase 2: Core Engine (In Progress)
- [ ] Migrate `js/music.js` to ES6 module (IPFS support added)
- [ ] Migrate `js/game-shell.js` to ES6 module
- [ ] Migrate `js/router.js` to ES6 module
- [ ] Migrate `js/party/party.js` to ES6 module
- [ ] Update `index.html` to use `<script type="module">`

### Phase 3: Games Migration
- [ ] Convert high-priority games first:
  - starfield_4d.html
  - mandelbulb_studio.html
  - voxel_engine.html
  - terrain_walker.html
- [ ] Update game HTML templates to use modules
- [ ] Test cross-game compatibility

### Phase 4: Testing & Optimization
- [ ] Run Playwright tests for all games
- [ ] Verify no console errors after migration
- [ ] Measure bundle size and load time improvements
- [ ] Document breaking changes

## Benefits

1. **No Global Pollution**: Variables stay scoped to modules
2. **Explicit Dependencies**: Import statements show what each file needs
3. **Better Tree Shaking**: Unused exports can be eliminated by bundlers (optional)
4. **Easier Testing**: Modules can be imported in isolation
5. **Future-Proof**: Aligns with modern JavaScript standards

## Backwards Compatibility

During migration, maintain dual compatibility:

```javascript
// Support both module and script tag usage
(function() {
  class GameShell { ... }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameShell };
  } else {
    window.GameShell = GameShell;
  }
})();
```

## References
- [MDN: Using JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [ES6 Modules vs Script Tags](https://jakearchibald.com/2017/es-modules-in-browsers/)
- [Import Maps for fallback](https://github.com/WICG/import-maps)
