// Guinea Pig Trench — Game Registry
// Lists all playable games and handles launching them

const GAMES = [
  // ── SOVEREIGN UPGRADES — Tier 4/5 Breakthroughs ──
  {
    id: 'xeno-ocean-v4',
    title: 'XENO-OCEAN v4',
    description: 'Tier 4 Raymarched Manifold. Infinite fractal ocean with Menger-Mandelbox eruptions and PS1-Affine jitter. Visual resonance driven by live radio energy.',
    tags: ['WebGL2', 'Raymarching', 'Fractal', 'RTX', 'Sovereign'],
    src: '../XENO_OCEAN_v4.html',
    color: '#01040a',
    accent: '#ff0055',
    category: 'VISUAL ART',
  },
  {
    id: 'torsion-rebound',
    title: 'TORSION REBOUND 3D',
    description: '6DOF kinetic repulsor game. Deflect shards away from a 3D rotating torus core. Trigger Substrate Collapse at 100% Torsion.',
    tags: ['Canvas', '3D', 'Physics', 'Action', 'Sovereign'],
    src: '../TORSION_REBOUND.html',
    color: '#060612',
    accent: '#00ffd2',
    category: 'ACTION',
  },
  {
    id: 'labyrinth-v3',
    title: 'SOVEREIGN LABYRINTH v3',
    description: 'Recursive fractal maze carved into golden-angle onion shells. Physically reacts to ASUS sensor tilt and ignition bloom events.',
    tags: ['Canvas', 'Math', 'Fractal', 'Sensor', 'Sovereign'],
    src: '../MAZE_ARCHITECT.py',
    color: '#050505',
    accent: '#d84315',
    category: 'MATH',
  },
  {
    id: 'vanguard-v4',
    title: 'AURORA VANGUARD v4',
    description: 'Tier 4 Interstellar Cruiser. 6DOF momentum-based physics, 5X particle density, and Bloom-Engine relic extraction.',
    tags: ['Three.js', '6DOF', 'Flight', 'Physics', 'Sovereign'],
    src: '../AURORA_VANGUARD_v4.html',
    color: '#050812',
    accent: '#00f5ff',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'dealers-3d-hr',
    title: 'DEALERS 3D: HYPER-REAL',
    description: 'The definitive space commerce simulator. Trade substances across the Xeno-Ocean manifold with a holographic PBR cockpit UI.',
    tags: ['WebGL2', 'Trading', 'Holographic', 'Hyper-Real', 'Sovereign'],
    src: '../INTERGALACTIC_DEALERS_3D.html',
    color: '#060612',
    accent: '#00d2ff',
    category: 'STRATEGY',
  },
  {
    id: 'resonance-breach-v3',
    title: 'RESONANCE BREACH v3',
    description: 'Collatz trajectory shooter with a dynamic Ulam Spiral substrate. 6DOF camera torsion and 5,000+ shard particle buffer.',
    tags: ['Canvas', 'Math', 'Collatz', 'Ulam', 'Sovereign'],
    src: '../RESONANCE_BREACH_v3.html',
    color: '#050505',
    accent: '#5f00ff',
    category: 'ACTION',
  },
  {
    id: 'mecha-3d-view',
    title: 'MECHA v2 3D VIEW',
    description: 'Volumetric Face-Forge manifest of the Teal Robot. 1.2M triangle displaced mesh with per-vertex color preservation.',
    tags: ['WebGL', 'Three.js', 'Face-Forge', 'Mesh', 'Sovereign'],
    src: 'http://localhost:8080/MECHA_PREVIEW_3D.html',
    color: '#050505',
    accent: '#00ff9d',
    category: 'TOOLS',
  },
  // ── ERDŐS-STRAUS CORE — these come next ──
  {
    id: 'the-field',
    title: 'THE FIELD — Ulam Spiral',
    description: 'Every integer mapped to a spiral. Primes glow amber on the diagonals. Hover any number to see its factorization and Erdős-Straus decomposition (4/n = 1/x + 1/y + 1/z). Click to hear its prime factors as a chord. Toggle between Ulam and Sacks spiral geometries. 60,000 numbers, color-blended by prime DNA.',
    tags: ['Canvas', 'Math', 'Erdős-Straus', 'Audio', 'Ulam', 'Interactive'],
    src: 'games/the_field.html',
    color: '#05050d',
    accent: '#ffaa44',
    controls: 'Scroll=Zoom, Drag=Pan, Click=Hear factors, Home=Reset, Mode=Ulam/Sacks',
    category: 'MATH',
  },
  {
    id: 'shadow-lab',
    title: 'SHADOW LAB — Stratified Poisson PCF',
    description: 'Real-time shadow mapping with stratified Poisson disk sampling. 2048² depth FBO, 4-ring×8 sample pattern, adjustable kernel radius. Torii gate shrine scene with auto-rotating directional light. The same PCF technique that renders every shadow in the Trench.',
    tags: ['WebGL2', 'Shadows', 'PCF', 'Poisson', 'Technical', 'Interactive'],
    src: 'games/shadow_lab.html',
    color: '#07070f',
    accent: '#4a9eff',
    controls: 'Drag=Orbit, Scroll=Zoom, Panel=PCF samples/kernel/light',
    category: 'TOOLS',
  },
  {
    id: 'prime-sieve',
    title: 'PRIME SIEVE — Survive the Filters',
    description: 'You ARE a number. Fly through modular filter gates — each gate is a real prime. If 4/n has a solution mod that prime, you dissolve. Hard residues (mod 24 = 1 or 17) survive longer. No prime has EVER survived all filters to ~8×10¹³. How far can you get?',
    tags: ['Canvas', 'Math', 'Erdős-Straus', 'Audio', 'Sieve', 'Gameplay'],
    src: 'games/prime_sieve.html',
    color: '#0a0a0f',
    accent: '#00ffcc',
    controls: 'Up/W/Space=Thrust, Down/S=Drop, Enter number or random',
    category: 'MATH',
    sprites: ['defender', 'grief'],
    meshes: ['armored_defender', 'grief_warrior'],
  },
  {
    id: 'sieve-visualizer',
    title: 'SIEVE VISUALIZER — ~8×10¹³ In Progress',
    description: 'Breached 20.0M with 30.5T magnitude record with zero counterexamples. Watch the Erdős-Straus modular sieve sweep across the number line in real-time. Green = filtered (solvable). Empty = dissolved. The giant 0 in the center = zero prime counterexamples. 5,780x faster than Swett (1999).',
    tags: ['Canvas', 'Visualization', 'Erdős-Straus', 'Data', 'Math'],
    src: 'games/sieve_visualizer.html',
    color: '#030308',
    accent: '#00ff88',
    controls: 'Space=Pause, Arrows=Speed, R=Reset, F=Fullscreen',
    category: 'MATH',
  },
  {
    id: 'threshold-flight',
    title: 'THE THRESHOLD — Resonant',
    description: 'Direction-based infinite star field. Five worlds glow as destinations on the sphere. Fly toward a world to approach it. The between IS the gameplay. Velocity warps directions. Roll skews the multiverse. WebGL2 GPU-rendered point sprites.',
    tags: ['WebGL2', 'Flight', 'Resonance', 'Torsion', 'Resonance', 'Torsion', 'Resonance', 'Torsion', 'Threshold', 'Space', 'Direction-based'],
    src: 'games/threshold_flight.html',
    color: '#010104',
    accent: '#0088ff',
    controls: 'W/S=Thrust, Mouse=Look, Q/E=Roll',
    category: 'EXPERIMENTAL',
    sprites: ['kraken', 'mecha'],
    meshes: ['void_runner_ship', 'kraken'],
  },
  {
    id: 'trench-world',
    title: 'TRENCH WORLD — Procedural Terrain',
    description: 'Infinite procedural terrain with day/night cycle. Chunked FBM noise generation. Biome coloring from deep water to snow peaks. Walk, jump, sprint through an endless landscape. The terrain is computed, not stored.',
    tags: ['Three.js', 'Terrain', 'Procedural', 'Day/Night', 'FPS'],
    src: 'games/trench_world.html',
    color: '#050510',
    accent: '#88aacc',
    controls: 'WASD=Move, Mouse=Look, Space=Jump, Shift=Sprint',
    category: 'EXPERIMENTAL',
    sprites: ['defender', 'grief', 'dimmak'],
    meshes: ['armored_defender', 'grief_warrior', 'dim_mak_fighter'],
  },
  {
    id: 'sphere-flight',
    title: 'SPHERE FLIGHT — Volumetric Space',
    description: 'Fly inside a bounded sphere of point-cloud stars. Ship stays centered — the universe moves around you. Depth-sorted rendering with distance fog. The simplest flight engine, reduced to its essence.',
    tags: ['Canvas', 'Flight', 'Space', '6DOF', 'Point Cloud'],
    src: 'games/sphere_flight.html',
    color: '#05050c',
    accent: '#50beff',
    controls: 'WASD=Strafe, Space/Ctrl=Up/Down, Q/E=Roll, Mouse=Look',
    category: 'EXPERIMENTAL',
    sprites: ['kraken', 'cephalon'],
    meshes: ['void_runner_ship'],
  },
  // ── ORIGINAL LINEUP ──
  {
    id: 'truth-holds',
    title: 'Truth Holds — Oceanic Resonance',
    description: 'Voxel raycaster FPS. Harvest resonance gems across surface ocean, subterranean caves, and ascension. 6 Trench FM blob entities patrol the world — shoot them for points, dodge the hostile ones. SVG tendrils connect nearby blobs. Pointer lock mouselook.',
    tags: ['Canvas', 'Raycaster', 'FPS', 'Voxel', 'Blob Entities'],
    src: 'games/truth_holds.html',
    color: '#000a14',
    accent: '#00ff9d',
    controls: 'WASD=Move, Mouse=Look, Click=Fire, Shift=Sprint',
    category: 'ACTION',
  },
  {
    id: 'ink-hold',
    title: 'Ink & Hold',
    description: 'Tower defense on living parchment. Place painted structures to stop ink blot enemies. Paper shifts through five worlds as waves progress. Blob morph enemies, tendril connections between towers, watercolor aesthetic.',
    tags: ['Canvas', 'Strategy', 'Waves', 'Procedural', 'Audio-Reactive'],
    src: 'games/ink_hold.html',
    color: '#110a02',
    accent: '#d4a030',
    controls: '1-4=Select structure, L-Click=Place, R-Click=Remove',
    category: 'STRATEGY',
  },
  {
    id: 'threshold-hill',
    title: 'Threshold Hill',
    description: 'The Threshold meets Lenticular Hill. Roll through five world-zones rendered with parallax lenticular strips. The terrain pulses to your beats. Each world has its own sky, ground, and physics. Mouse tilts the lens. Trench FM plays your catalog.',
    tags: ['Canvas', 'Physics', 'Lenticular', 'Audio-Reactive', 'Music'],
    src: 'games/threshold_hill.html',
    color: '#020a14',
    accent: '#00b8c8',
    controls: 'A/D=Roll, Space=Jump, Mouse=Tilt lens, N=Next track',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'threshold-hill-8bit',
    title: 'Threshold Hill — 8-Bit',
    description: 'The 8-bit edition. Same five worlds, same sieve seeds, same lenticular tilt — rendered at quarter resolution with NES-style palettes, dithered skies, pixel sprites, scanlines, and CRT vignette. The Chain in chunky pixels.',
    tags: ['Canvas', 'Physics', 'Lenticular', 'Audio-Reactive', 'Music', '8-Bit', 'Retro', 'Pixel Art'],
    src: 'games/threshold_hill_8bit.html',
    color: '#000c1a',
    accent: '#00ccdd',
    controls: 'A/D=Roll, Space=Jump, Mouse=Tilt lens, N=Next track',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'threshold-dungeon',
    title: 'Threshold Dungeon',
    description: 'The Threshold meets the Dungeon Shooter. Each room is a different world rendered in real-time WebGL raymarching. Pink Hour pillars. Block neon. Threshold temple. Vault sensors. Between voids. Navigate. Survive. Creative and Survival modes.',
    tags: ['WebGL', 'Raymarching', 'FPS', 'Dungeon', 'SDF'],
    src: 'games/threshold_dungeon.html',
    color: '#000',
    accent: '#00b8c8',
    controls: 'WASD=Move, Mouse=Look, TAB=Toggle Creative/Survival, Click=Shoot/Place',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'the-threshold',
    title: 'The Threshold',
    description: 'Where all worlds meet. A raymarched journey through five dimensions: The Pink Hour, The Block, The Threshold, Vault Compound 7, and The Between. Each world has its own SDF geometry, color palette, lighting model, and lore. The camera spirals through them all. Void for valleys. Neon for surface. Still here.',
    tags: ['WebGL', 'Raymarching', 'Lore', 'Multiverse', 'SDF'],
    src: 'games/the_threshold.html',
    color: '#000',
    accent: '#00b8c8',
    controls: 'Watch. The worlds cycle automatically. Each lasts ~12 seconds.',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'aku-shrine',
    title: 'Aku Shrine',
    description: 'The Aku Aku mask rendered as a raymarched 3D carved stone god. Cross-section SDF from the sprite, orbit trap stone palette, bezier tentacles, bioluminescent mushrooms, temple pillars, negative bloom, torchlight. Everything we built today converged into one entity.',
    tags: ['WebGL', 'Raymarching', 'SDF', 'Boss', 'Fractal'],
    src: 'games/aku_shrine.html',
    color: '#000',
    accent: '#00b8c8',
    controls: 'Watch the mask breathe. Camera orbits automatically.',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'boulder-builder',
    title: 'Boulder Builder',
    description: 'The cross-section boulder is the building primitive. Place fractal-colored boulders in 3D space to construct walls, towers, caves, anything. 6 biome palettes, grid snapping, rotation, scale control. Drop any sprite to change the boulder shape. Architecture from geology.',
    tags: ['WebGL', 'Fractal', 'Construction', 'SDF', 'Voxel-Free'],
    src: 'games/boulder_builder.html',
    color: '#000',
    accent: '#00ffd2',
    controls: 'WASD=Move, Mouse=Look, Click=Place, Right-click=Remove, Scroll=Size, Q/E=Rotate, 1-6=Biome, Tab=Grid, Space/C=Up/Down, Drop image=New shape',
    category: 'TOOLS',
  },
  {
    id: 'fractal-sculptor',
    title: 'Fractal Sculptor',
    description: 'Sprite Sculptor x Fractal Forge. Drop any sprite, sculpt it through 5 SDF modes (height, revolve, cross-section, mandelbulb, hybrid blend), tune fractal DNA with orbit trap palettes, crossbreed with biome presets, mutate for happy little mistakes, export 8-angle sprite sheets. Every creature is a unique fractal.',
    tags: ['WebGL', 'Fractal', 'Mandelbulb', 'Sprite', 'Crossbreed', 'Export'],
    src: 'games/fractal_sculptor.html',
    color: '#000',
    accent: '#00ffd2',
    controls: 'Drag=Orbit, Scroll=Zoom, 1-5=Mode, B=Breed, G=Export, Drop image=Load sprite',
    category: 'TOOLS',
  },
  {
    id: 'fractal-forge',
    title: 'Fractal Forge',
    description: 'Mandelbulb Studio x Asset Forge. Each sprite type defines unique fractal DNA — power, orbit trap palette, biome. The Mandelbulb raymarcher renders them into 3D creatures, then crossbreeds their parameters genetically. Happy little mutations included.',
    tags: ['WebGL', 'Fractal', 'Procedural', 'Mandelbulb', 'Crossbreeding'],
    src: 'games/fractal_forge.html',
    color: '#000c1a',
    accent: '#00ff9d',
    controls: 'Watch the SCAN → FORGE → CROSSBREED → GALLERY phases. Each asset rotates through 8 fractal-rendered angles.',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'asset-forge',
    title: 'Asset Forge',
    description: 'A game that makes a game. Watch sprites get scanned, forged into 3D objects, assembled into a procedural world, then play the result. Every run builds a different game from the same assets.',
    tags: ['Canvas', 'Procedural', 'Meta', '3D', 'Raymarching'],
    src: 'games/asset_forge.html',
    color: '#000c1a',
    accent: '#00ff9d',
    controls: 'Watch the SCAN → FORGE → BUILD phases, then A/D Move, W Jump, J Attack in the generated game',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'dealers-3d',
    title: 'Intergalactic Dealers 3D',
    description: 'The trading game — now with raymarched 3D environments. Each location is a living SDF world behind the UI. Travel warps through mandelbulb tunnels. Police raids distort reality.',
    tags: ['WebGL2', 'Canvas', 'Trading', 'Raymarching', '3D'],
    src: 'games/dealers_3d.html',
    color: '#060612',
    accent: '#00d2ff',
    controls: 'CLICK: Buy/Sell/Travel | W: Wait | 1-6: Warp to Location | 3D backgrounds react to gameplay',
    category: 'STRATEGY',
  },
  {
    id: 'sprite-sculptor',
    title: 'Sprite Sculptor',
    description: 'Feed a 2D sprite into a raymarching engine and watch it become a 3D object. Height map extrusion, solid of revolution, cross-section stacking, or full Mandelbulb. Same renderer that makes the Onion Planet.',
    tags: ['WebGL2', 'Raymarching', '3D', 'Experimental', 'Fractal'],
    src: 'games/sprite_sculptor.html',
    color: '#000000',
    accent: '#00FFD2',
    controls: 'DRAG: Orbit | SCROLL: Zoom | 1-4: Mode (Height/Revolution/Cross/Mandelbulb) | DBL-CLICK: Reset',
    category: 'EXPERIMENTAL',
  },
  {
    id: 'lenticular-hill',
    title: 'Trench FM: Lenticular Hill',
    description: 'Tune into Trench FM. The radio signal materializes into a rolling hillscape. Collect cores while your beats play. Lenticular parallax — tilt the view with your mouse.',
    tags: ['Canvas', 'Lenticular', 'Physics', 'Music', 'Radio'],
    src: 'games/lenticular_hill.html',
    color: '#000c1a',
    accent: '#00ff9d',
    controls: 'CLICK: Tune In | A/D: Roll | SPACE: Jump | N: Next Track | MOUSE: Tilt View',
    category: 'EXPERIMENTAL',
  },
  // ── STORY MODE (top featured) ──
  {
    id: 'trench-chronicles',
    title: 'Trench Chronicles',
    description: 'Visual novel connecting all characters and biomes. 8 chapters — riddles, dialogue, reaction games, and the fate of the Onion Planet.',
    tags: ['Canvas', 'Story', 'Adventure', 'All Characters', 'SPRITES'],
    src: 'games/trench_story.html',
    color: '#080418',
    accent: '#00d2ff',
    controls: 'CLICK: Advance dialogue / Choose | React to prompts | Explore all 8 biomes',
    category: 'STORY',
  },
  {
    id: 'intergalactic-dealers',
    title: 'Intergalactic Drug Dealers',
    description: 'Space trading game — buy low, sell high, dodge police, become the Galactic Overlord. Play as dealer or user.',
    tags: ['Canvas', 'Trading', 'Strategy', 'SPRITES'],
    src: 'games/intergalactic_dealers.html',
    color: '#060612',
    accent: '#00ff88',
    controls: 'CLICK: Buy/Sell/Travel | B/S: Toggle mode | 1-6: Locations | 30 days to make your fortune',
    category: 'STRATEGY',
  },
  {
    id: 'dim-mak-dojo',
    title: 'DIM MAK · 點穴',
    description: 'Pressure point fighting dojo. Train 8 techniques, speed-strike combos, and combat with meridian debuffs.',
    tags: ['Canvas', 'Fighting', 'Training', 'SPRITES'],
    src: 'games/dim_mak_dojo.html',
    color: '#0a0810',
    accent: '#ffd700',
    controls: 'CLICK: Hit pressure points | WASD+JKL: Combat | Learn the Death Touch',
    category: 'ACTION',
  },
  {
    id: 'terraform',
    title: 'Terraform',
    description: 'Isometric god-game. Water→mud→grass→trees→ecosystem. Build civilization from barren rock.',
    tags: ['Canvas', 'Isometric', 'Simulation', 'Building'],
    src: 'games/terraform.html',
    color: '#0a1810',
    accent: '#40c060',
    controls: 'WASD: Pan | SCROLL: Zoom | 1-7: Tools | CLICK: Place | TAB: Stats | Water breeds life',
    category: 'SANDBOX',
  },
  {
    id: 'hex-cards',
    title: 'Hex Cards',
    description: '6-sided hex card battler. Place cards, battle edges, chain-capture. 18 cards, 3 AI levels.',
    tags: ['Canvas', 'Cards', 'Strategy', 'SPRITES'],
    src: 'games/hex_cards.html',
    color: '#0a0a18',
    accent: '#00d2ff',
    controls: 'CLICK: Select card + Place | RIGHT-CLICK: Inspect | Chain captures to dominate',
    category: 'STRATEGY',
  },
  {
    id: 'beat-forge',
    title: 'Beat Forge',
    description: 'Rhythm game with 4-lane falling notes, 3 procedural tracks, combo multipliers, and character select.',
    tags: ['Canvas', 'Rhythm', 'Music', 'SPRITES'],
    src: 'games/beat_forge.html',
    color: '#080418',
    accent: '#ff60a0',
    controls: 'D/F/J/K: Hit notes | Pick your character | Chase that S rank',
    category: 'ACTION',
  },
  {
    id: 'fractal-crush',
    title: 'Fractal Crush',
    description: 'Match-3 puzzle with 6 character-themed gems, special gems, chain combos, and 90-second timer.',
    tags: ['Canvas', 'Puzzle', 'Match-3', 'SPRITES'],
    src: 'games/fractal_crush.html',
    color: '#0a0818',
    accent: '#8040ff',
    controls: 'CLICK: Select + Swap gems | Match 4+ for specials | Chase the S rank',
    category: 'PUZZLE',
  },
  {
    id: 'trench-crush',
    title: 'Trench Crush',
    description: '20-level Candy Crush with ice blockers, spreading chocolate, special combos, and star ratings.',
    tags: ['Canvas', 'Puzzle', 'Match-3', 'Levels', 'SPRITES'],
    src: 'games/candy_crush.html',
    color: '#0c0818',
    accent: '#ffd700',
    controls: 'CLICK: Select + Swap | Match 4/5/L/T for specials | Clear the board in limited moves',
    category: 'PUZZLE',
  },
  // ── GAMES WITH SPRITES (featured first) ──
  {
    id: 'ufo-defense',
    title: 'UFO Defense',
    description: 'Side-scrolling shooter. Defend against alien waves, dodge tractor beams, fight the mech boss.',
    tags: ['Canvas', 'Shooter', 'Waves', 'Boss', 'SPRITES'],
    src: 'games/ufo_defense.html',
    color: '#030618',
    accent: '#ffd700',
    controls: 'WASD: Move | CLICK: Shoot | SPACE: Dodge roll | Survive the invasion!',
    category: 'ACTION',
  },
  {
    id: 'sprite-brawler',
    title: 'Trench Brawler',
    description: 'Fighting game built FROM your sprites. Armored Defender vs Dim Mak Fighter. 2P or vs AI.',
    tags: ['Canvas', 'Fighting', '2P', 'SPRITES'],
    src: 'games/sprite_brawler.html',
    color: '#0a0810',
    accent: '#ff60a0',
    controls: 'P1: WASD + F attack + G block | P2: Arrows + L attack + K block | SPACE: vs AI',
    category: 'ACTION',
  },
  {
    id: 'stealth-maze',
    title: 'Office Stealth',
    description: '3 levels of stealth with vision cones, paper balls, and keycard theft. Character sprites!',
    tags: ['Canvas', 'Stealth', 'Strategy', '3 Levels', 'SPRITES'],
    src: 'games/stealth_maze.html',
    color: '#101010',
    accent: '#FFD700',
    controls: 'WASD: Move | C: Throw paper ball | X: Throw chair | E: Interact | P: Pause',
    category: 'ACTION',
  },
  {
    id: 'sand-garden',
    title: 'Zen Sand Garden',
    description: 'Falling sand physics with Dim Mak sprite cursor. Paint, erase, and watch it flow.',
    tags: ['Canvas', 'Physics', 'Relaxing', 'SPRITES'],
    src: 'games/sand_garden.html',
    color: '#1A1A1A',
    accent: '#E8E8E8',
    controls: 'WASD/Arrows: Move | SPACE: Paint | E: Erase | +/-: Brush | R: Reset | P: Pause',
    category: 'SANDBOX',
  },
  // ── ACTION ──
  {
    id: 'mandelbulb-studio',
    title: 'Onion Planet Studio',
    description: 'Raymarched Mandelbulb fractal with biome palette presets, bloom, and adaptive quality.',
    tags: ['WebGL', '3D', 'Fractal', 'Interactive'],
    src: 'games/mandelbulb_studio.html',
    color: '#0A70EB',
    accent: '#ED1299',
    controls: 'DRAG: Orbit | SCROLL: Zoom | DBL-CLICK: Reset | PANEL: Sliders + Presets',
    category: 'VISUAL ART',
  },
  {
    id: 'mandelbulb',
    title: 'Mandelbulb Power 8',
    description: 'Fullscreen raymarched Mandelbulb with ACES tone mapping and Gaussian bloom.',
    tags: ['WebGL', '3D', 'Fractal'],
    src: 'games/mandelbulb_webgl.html',
    color: '#1A0850',
    accent: '#00D2FF',
    controls: 'DRAG: Orbit | SCROLL: Zoom | DBL-CLICK: Reset',
    category: 'VISUAL ART',
  },
  {
    id: 'dungeon-shooter',
    title: 'Dungeon Shooter',
    description: 'Raycaster FPS with procedural dungeons, enemy AI, flashlight, and full combat.',
    tags: ['Canvas', 'FPS', 'Raycaster', 'Combat'],
    src: 'games/dungeon_shooter.html',
    color: '#050510',
    accent: '#ff8830',
    controls: 'CLICK: Lock mouse | WASD+SHIFT: Move | CLICK/SPACE: Shoot | R: Reload | F: Flashlight | ESC: Pause',
    category: 'ACTION',
  },
  {
    id: 'void-runner',
    title: 'VOID-RUNNER',
    description: '6DOF space flight through five worlds. Mouse-aimed, pointer-locked, full pitch/yaw/roll. Bioluminescent vial aesthetic — the ship is glass, the worlds are fluid. Boost, barrel roll, homing missiles, asteroids.',
    tags: ['Three.js', '3D', 'Space', 'Flight', '6DOF', 'Audio-Reactive'],
    src: 'games/void_runner.html',
    color: '#000020',
    accent: '#00D2FF',
    controls: 'WASD: Fly | SHIFT: Boost | S: Brake | A/D x2: Barrel Roll | Dodge asteroids!',
  },
  // gpu-particles: DISABLED — needs proper WebGL GPGPU rewrite using GitHub references
  // See: fogleman/physarum, nicoptere/physarum for working WebGL particle patterns
  {
    id: 'sph-fluid',
    title: 'SPH Fluid Particles',
    description: 'Smoothed Particle Hydrodynamics — water, sand, and ice with element reactions.',
    tags: ['Canvas', 'Physics', 'Simulation'],
    src: 'games/sph_fluid.html',
    color: '#000030',
    accent: '#4080FF',
    controls: 'CLICK+DRAG: Spawn particles | Number keys: Switch element | Watch physics!',
  },
  {
    id: 'bloom-meadow',
    title: 'Bloom Meadow',
    description: '60,000 instanced grass blades, rain, weather, puddles, and chasms.',
    tags: ['Three.js', '3D', 'Nature', 'Weather'],
    src: 'games/bloom_meadow.html',
    color: '#0A2010',
    accent: '#40C060',
    controls: 'CLICK: Pointer lock | WASD: Walk | MOUSE: Look | SHIFT: Sprint | Watch weather cycle',
  },
  {
    id: 'terrain-walker',
    title: 'Terrain Walker',
    description: 'First-person raycaster terrain with pointer lock and sprint.',
    tags: ['Canvas', 'FPS', 'Exploration'],
    src: 'games/terrain_walker.html',
    color: '#102010',
    accent: '#80C060',
    controls: 'CLICK: Pointer lock | WASD: Move | MOUSE: Look | SHIFT: Sprint',
  },
  {
    id: 'voxel-engine',
    title: 'Voxel Engine',
    description: 'Build and destroy in a Minecraft-style voxel world with 4 block types.',
    tags: ['WebGL2', '3D', 'Voxel', 'Building'],
    src: 'games/voxel_engine.html',
    color: '#201010',
    accent: '#60A040',
    controls: 'CLICK: Pointer lock | WASD: Move | SPACE: Jump | SHIFT: Sprint | L/R Click: Break/Place | 1-4: Block type',
  },
  {
    id: 'mantra-radio',
    title: 'TRENCH FM',
    description: 'Streaming radio with morphing blob UI, spectrum analyzer, and draggable nodes.',
    tags: ['Audio', 'Radio', 'Interactive', 'UI Art'],
    src: 'games/mantra_radio.html',
    color: '#03060f',
    accent: '#00e5cc',
    controls: 'DRAG: Move blobs | CLICK: Play/Pause | SCROLL on volume: Adjust | Pick a station',
  },
  {
    id: 'dice-roller',
    title: '3D Dice',
    description: 'CSS 3D dice with physics rolling animation. Roll for multiplayer decisions or just for fun.',
    tags: ['CSS3D', 'Interactive', 'Multiplayer'],
    src: 'games/dice_roller.html',
    color: '#03060f',
    accent: '#00d2ff',
    controls: 'CLICK: Roll the dice | History tracks last 10 rolls',
    category: 'TOOLS',
  },
  {
    id: 'starfield-4d',
    title: '4D Starfield',
    description: 'Hyperdimensional parallax starfield with 4 warp modes, nebula overlay, and color palettes.',
    tags: ['WebGL2', '3D', 'Space', 'Exploration'],
    src: 'games/starfield_4d.html',
    color: '#000818',
    accent: '#5090ff',
    controls: 'WASD: Navigate | MOUSE: Look | L: Hyperspeed | N: Nebula | T: Warp mode | 1-4: Palettes',
    category: 'EXPLORATION',
  },
  {
    id: 'kinetic-plates',
    title: 'CRT Kinetic Plates',
    description: 'Bouncing 3D plates in a cage with CRT post-processing, phosphor persistence, and spark impacts.',
    tags: ['WebGL2', '3D', 'CRT', 'Physics'],
    src: 'games/kinetic_plates.html',
    color: '#000810',
    accent: '#00ffd9',
    controls: 'WATCH: Plates bounce and collide | Sparks on impact | CRT scanlines + chromatic aberration',
    category: 'VISUAL ART',
  },
  {
    id: 'audio-visualizer',
    title: 'Mic Visualizer',
    description: 'Real-time FFT spectrum analyzer with your microphone. Audio-reactive bars.',
    tags: ['Audio', 'Interactive', 'Visualizer'],
    src: 'games/mic_visualizer.html',
    color: '#100010',
    accent: '#FF40A0',
    controls: 'CLICK: Enable microphone | SPACE: Pause/Resume | Speak or play music!',
  },
]

// Sierpiński hierarchy — sort by INSTANT PLAYABILITY (first 10 seconds impact)
// Criteria: immediate visual wow × zero-setup gameplay × works solo
// Tier 1: click and play, immediate visual payoff, WASD or watch
// Tier 2: strong gameplay, may need a moment to understand
// Tier 3: tools, sandboxes, requires input (drag sprite, etc)
const GAME_PLAY_RANK = {
  // Tier 1 — instant wow, click and go
  'the-threshold': 20,       // raymarched 5 worlds, auto-plays, jaw-dropping
  'aku-shrine': 19,          // carved stone god, auto-orbits, stunning
  'void-runner': 18,         // 6DOF space flight, WASD+mouse, immediate
  'truth-holds': 17,         // voxel FPS, WASD+click, classic gameplay
  'prime-sieve': 16,         // YOU are a number, fly through filters, unique concept
  'threshold-dungeon': 15,   // FPS + raymarched rooms, WASD
  'dungeon-shooter': 14.5,   // raycaster FPS, immediate combat
  'trench-world': 14,        // infinite terrain, WASD, walk anywhere
  'sieve-visualizer': 13.5,  // watch 10^14 sweep, mesmerizing data viz
  'gpu-particles': 13,       // 1M particles, mouse interaction, instant wow

  // Tier 2 — strong but needs a moment
  'mandelbulb-studio': 12,   // drag to orbit, presets, beautiful
  'threshold-hill': 11.5,    // roll + music, lenticular, audio-reactive
  'threshold-hill-8bit': 11, // retro version, CRT aesthetic
  'bloom-meadow': 10.5,      // walk in grass + weather, atmospheric
  'trench-chronicles': 10,   // story mode, click to advance
  'sprite-brawler': 9.5,     // fighting game, 2P or AI
  'dim-mak-dojo': 9,         // pressure point combat
  'ufo-defense': 8.5,        // side-scrolling shooter
  'intergalactic-dealers': 8,// trading game, click-based
  'dealers-3d': 7.5,         // trading + 3D backgrounds
  'stealth-maze': 7,         // stealth with vision cones
  'voxel-engine': 6.8,       // minecraft-style, WASD
  'ink-hold': 6.5,           // tower defense, click to place
  'hex-cards': 6.3,          // card battler, click
  'beat-forge': 6,           // rhythm game
  'terraform': 5.8,          // god game, click tools
  'fractal-crush': 5.5,      // match-3, click
  'trench-crush': 5.3,       // candy crush, click
  'the-field': 5,            // Ulam spiral, hover/click to explore

  // Tier 3 — tools, sandboxes, require setup
  'mandelbulb': 4.5,         // pure fractal viewer
  'fractal-sculptor': 4,     // needs sprite drop
  'fractal-forge': 3.8,      // auto-plays but slow
  'sprite-sculptor': 3.5,    // needs sprite drop
  'boulder-builder': 3.2,    // construction tool
  'shadow-lab': 3,           // technical demo
  'asset-forge': 2.8,        // meta-game, slow phases
  'lenticular-hill': 2.5,    // needs audio
  'sphere-flight': 2.3,      // simpler flight
  'threshold-flight': 2,     // direction-based, abstract
  'starfield-4d': 1.8,       // exploration, slow
  'sph-fluid': 1.5,          // physics sandbox
  'sand-garden': 1.3,        // zen sandbox
  'mantra-radio': 1,         // radio UI, needs tracks
  'kinetic-plates': 0.8,     // visual art, watch
  'terrain-walker': 0.6,     // simpler terrain
  'mic-visualizer': 0.5,     // needs microphone
  'dice-roller': 0.3,        // utility
  'evasion-hunter': 0.1,     // easter egg
}

// Sort by playability rank (highest first)
GAMES.sort((a, b) => (GAME_PLAY_RANK[b.id] || 0) - (GAME_PLAY_RANK[a.id] || 0))

function renderGameGrid() {
  const grid = document.getElementById('game-grid')
  if (!grid) return

  grid.innerHTML = GAMES.map(game => `
    <div class="game-card" data-game="${game.id}" data-src="${game.src}">
      <div class="card-preview" style="
        width:100%;height:200px;
        background:linear-gradient(135deg, ${game.color}, ${game.color}dd);
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        position:relative;overflow:hidden;
      ">
        <!-- Preview iframe (hidden until hover) -->
        <iframe class="preview-frame" data-src="${game.src}" style="
          position:absolute;inset:0;width:100%;height:100%;border:none;
          opacity:0;transition:opacity .5s;pointer-events:none;
          transform:scale(1);
        "></iframe>
        <div class="card-overlay" style="
          position:absolute;inset:0;z-index:2;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          transition:opacity .3s;
        ">
          <div style="
            position:absolute;inset:0;
            border:1px solid ${game.accent}33;
            margin:12px;border-radius:6px;
          "></div>
          <div style="
            color:${game.accent};font-size:20px;font-weight:bold;
            letter-spacing:.2em;text-align:center;padding:0 20px;
            text-shadow:0 0 24px ${game.accent}66, 0 0 50px ${game.accent}22;
          ">${game.title.toUpperCase()}</div>
          <div style="
            color:${game.accent}88;font-size:9px;letter-spacing:.3em;
            margin-top:8px;text-transform:uppercase;
          ">GUINEA PIG TRENCH</div>
          <div style="
            position:absolute;bottom:10px;right:12px;
            color:${game.accent}88;font-size:9px;letter-spacing:.2em;
            text-shadow:0 0 8px ${game.accent}44;
          ">&#9654; PLAY</div>
          ${(game.tags.includes('Music') || game.tags.includes('Rhythm') || game.tags.includes('Radio') || game.tags.includes('Audio')) ?
            `<canvas class="card-waveform" data-accent="${game.accent}" style="
              position:absolute;bottom:0;left:0;right:0;height:40px;
              pointer-events:none;opacity:0.6;
            "></canvas>` : ''}
        </div>
      </div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span class="card-status live">PLAY NOW</span>
          ${game.category ? `<span class="card-category">${game.category}</span>` : ''}
        </div>
        <h3>${game.title}</h3>
        <p>${game.description}</p>
        <div style="color:rgba(0,210,255,.38);font-size:8.5px;letter-spacing:.06em;margin-top:6px;line-height:1.6">${game.controls || ''}</div>
        <div class="card-tags">
          ${game.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('')

  // Auto-load previews for first 6 cards (Tier 1 games) after 2s
  const allCards = grid.querySelectorAll('.game-card')
  setTimeout(() => {
    allCards.forEach((card, i) => {
      if (i >= 6) return
      const frame = card.querySelector('.preview-frame')
      if (frame && (!frame.src || frame.src === 'about:blank')) {
        frame.src = frame.dataset.src
        frame.style.opacity = '1'
        const overlay = card.querySelector('.card-overlay')
        if (overlay) overlay.style.opacity = '0'
      }
    })
  }, 2000)

  // Hover preview — load on hover for remaining cards
  let previewTimeout = null
  allCards.forEach((card, i) => {
    const frame = card.querySelector('.preview-frame')
    const overlay = card.querySelector('.card-overlay')

    card.addEventListener('mouseenter', () => {
      previewTimeout = setTimeout(() => {
        if (!frame.src || frame.src === 'about:blank') {
          frame.src = frame.dataset.src
        }
        frame.style.opacity = '1'
        if (overlay) overlay.style.opacity = '0'
      }, i < 6 ? 0 : 400) // instant for Tier 1, 400ms for rest
    })

    card.addEventListener('mouseleave', () => {
      clearTimeout(previewTimeout)
      // Don't unload Tier 1 — keep them live
      if (i >= 6) {
        frame.style.opacity = '0'
        if (overlay) overlay.style.opacity = '1'
        setTimeout(() => {
          if (frame.style.opacity === '0') {
            frame.src = 'about:blank'
          }
        }, 600)
      }
    })
  })

  // Bind click to launch
  grid.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', () => {
      launchGame(card.dataset.src, card.dataset.game)
    })
  })

  // ── Animated waveforms on music/audio game cards ──
  const waveCanvases = grid.querySelectorAll('.card-waveform')
  if (waveCanvases.length > 0) {
    waveCanvases.forEach(c => {
      c.width = c.parentElement.offsetWidth || 280
      c.height = 40
    })
    let waveT = 0
    function animateWaveforms() {
      waveT += 0.016
      const bass = (window.AUDIO_BASS || 0) / 255
      const energy = (window.AUDIO_ENERGY || 0)
      waveCanvases.forEach(c => {
        const ctx = c.getContext('2d')
        const w = c.width, h = c.height
        const accent = c.dataset.accent || '#00d2ff'
        ctx.clearRect(0, 0, w, h)
        // Waveform bars
        const bars = 32
        const barW = w / bars
        const baseAmp = 0.3 + energy * 0.5
        for (let i = 0; i < bars; i++) {
          const freq = Math.sin(i * 0.4 + waveT * 3) * 0.5 +
                       Math.sin(i * 0.15 + waveT * 1.7) * 0.3 +
                       Math.cos(i * 0.7 - waveT * 2.2) * 0.2
          const amp = (Math.abs(freq) * baseAmp + bass * 0.3) * h * 0.8
          const barH = Math.max(2, amp)
          const x = i * barW
          const y = h - barH
          // Gradient per bar
          ctx.fillStyle = accent + Math.round(40 + amp * 3).toString(16).padStart(2, '0')
          ctx.fillRect(x + 1, y, barW - 2, barH)
          // Bright tip
          ctx.fillStyle = accent
          ctx.fillRect(x + 1, y, barW - 2, 1.5)
        }
        // Center line
        ctx.fillStyle = accent + '15'
        ctx.fillRect(0, h - 1, w, 1)
      })
      requestAnimationFrame(animateWaveforms)
    }
    animateWaveforms()
  }
}

// ── Search + Tag Filter ──
function initGameSearch() {
  const searchInput = document.getElementById('game-search')
  const tagContainer = document.getElementById('game-tag-filters')
  const countEl = document.getElementById('game-count')
  if (!searchInput) return

  // Collect all unique tags
  const allTags = new Set()
  GAMES.forEach(g => g.tags.forEach(t => allTags.add(t)))
  let activeTag = null

  // Render tag buttons
  const sorted = [...allTags].sort()
  tagContainer.innerHTML = sorted.map(t =>
    `<span class="search-tag" data-tag="${t}" style="
      padding:3px 8px;font-size:8px;letter-spacing:0.1em;
      border:1px solid rgba(0,255,210,0.12);color:rgba(0,255,210,0.4);
      cursor:pointer;transition:all 0.2s;font-family:'Courier New',monospace;
    ">${t}</span>`
  ).join('')

  // Tag click handler
  tagContainer.querySelectorAll('.search-tag').forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag
      if (activeTag === tag) {
        activeTag = null
        el.style.background = 'transparent'
        el.style.color = 'rgba(0,255,210,0.4)'
      } else {
        activeTag = tag
        tagContainer.querySelectorAll('.search-tag').forEach(e => {
          e.style.background = 'transparent'
          e.style.color = 'rgba(0,255,210,0.4)'
        })
        el.style.background = 'rgba(0,255,210,0.1)'
        el.style.color = '#00ffd2'
      }
      filterGames()
    })
  })

  // Search input handler
  searchInput.addEventListener('input', filterGames)

  function filterGames() {
    const query = searchInput.value.toLowerCase().trim()
    const cards = document.querySelectorAll('.game-card')
    let visible = 0

    cards.forEach((card, i) => {
      if (i >= GAMES.length) return
      const game = GAMES[i]
      const text = (game.title + ' ' + game.description + ' ' + game.tags.join(' ') + ' ' + (game.category || '')).toLowerCase()

      const matchesSearch = !query || text.includes(query)
      const matchesTag = !activeTag || game.tags.includes(activeTag)

      if (matchesSearch && matchesTag) {
        card.style.display = ''
        visible++
      } else {
        card.style.display = 'none'
      }
    })

    countEl.textContent = visible + ' / ' + GAMES.length + ' games'
  }

  // Show initial count
  countEl.textContent = GAMES.length + ' / ' + GAMES.length + ' games'
}

// Init search after grid renders
setTimeout(initGameSearch, 100)

function launchGame(src, gameId) {
  const viewer = document.getElementById('game-viewer')
  const frame = document.getElementById('game-frame')

  // Show loading state
  viewer.style.display = 'block'
  frame.style.opacity = '0'

  // Create/show loading indicator
  let loader = document.getElementById('game-loader')
  if (!loader) {
    loader = document.createElement('div')
    loader.id = 'game-loader'
    loader.style.cssText = `
      position:fixed;inset:0;z-index:300;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:#000;font-family:'Courier New',monospace;
      pointer-events:none;transition:opacity 0.4s;
    `
    loader.innerHTML = `
      <div style="color:rgba(0,210,255,0.5);font-size:11px;letter-spacing:0.3em;margin-bottom:16px">LOADING</div>
      <div style="width:120px;height:2px;background:rgba(0,210,255,0.1);overflow:hidden;border-radius:1px">
        <div id="game-loader-bar" style="width:0%;height:100%;background:rgba(0,210,255,0.6);transition:width 0.3s;border-radius:1px"></div>
      </div>
      <div style="color:rgba(0,210,255,0.15);font-size:9px;letter-spacing:0.2em;margin-top:12px">GUINEA PIG TRENCH</div>
    `
    viewer.appendChild(loader)
  }
  loader.style.opacity = '1'
  loader.style.display = 'flex'
  const bar = document.getElementById('game-loader-bar')
  if (bar) { bar.style.width = '0%'; requestAnimationFrame(() => bar.style.width = '60%') }

  // Load game
  frame.src = src
  frame.onload = () => {
    if (bar) bar.style.width = '100%'
    setTimeout(() => {
      frame.style.opacity = '1'
      loader.style.opacity = '0'
      setTimeout(() => loader.style.display = 'none', 400)
    }, 200)
  }
}

document.getElementById('game-close')?.addEventListener('click', () => {
  const viewer = document.getElementById('game-viewer')
  const frame = document.getElementById('game-frame')
  frame.src = ''
  viewer.style.display = 'none'
})

// ESC handled by game-shell.js — no duplicate handler here

// ─── EASTER EGG: Konami Code → Evasion Hunter ───
// ↑↑↓↓←→←→BA
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']
let konamiIndex = 0

document.addEventListener('keydown', e => {
  if (e.key === KONAMI[konamiIndex] || e.key.toLowerCase() === KONAMI[konamiIndex]) {
    konamiIndex++
    if (konamiIndex === KONAMI.length) {
      konamiIndex = 0
      // Easter egg unlocked
      console.log('EASTER EGG: Evasion Hunter unlocked!')
      launchGame('games/evasion_hunter.html', 'evasion-hunter')
    }
  } else {
    konamiIndex = 0
  }
})
