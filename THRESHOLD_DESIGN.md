
================================================================
  PROJECT: THRESHOLD — Updated Game Design (v2)
  Guinea Pig Trench LLC — August 24, 2026
================================================================

WHAT EXISTS TODAY (audited):
- Portal: 65 unique games, 64 of them canvas-2D, avg 3-6KB each.
  Micro-games, not worlds. Only fractype/game uses WebGPU.
- age-of-trapezoid: 50KB canvas radial engine with vinculum-role
  architecture (verified working: depth sort + terrain dedup)
- hyperpoly-terrain: WebGPU terrain, 6-channel material tensor,
  19 verified GLB assets (gears/pulleys - CAD hardware)
- Blender 5.2 live on :9876, scene has gear profiles ready
- Math stack: mod9 stratification (VERIFIED), conservation pass,
  delta heightfield, SubstrateDeltaSieve, exhaustive E-S verifier

POPULAR-MECHANIC ANALYSIS (what's driving engagement in 2024-26):
1. Vampire Survivors / Brotato loop: auto-attack + swarm + upgrade
   choices every 30s. Dopamine from BUILDING, not twitch skill.
2. Balatro: deck-builder where math compounds visibly. Numbers go up
   EXPONENTIALLY and the player understands why.
3. Minecraft/Terraria: place/break + resource tiers + boss gates.
4. Power Wash Simulator / A Little to the Left: completionist zen,
   visible progress bar, zero fail state.
5. Slay the Spire map: choose-your-path node graphs.

THE DESIGN: "THRESHOLD" — a survivors-style auto-battler set inside
your existing threshold/void-runner/trench fiction, powered by your
verified math as ACTUAL GAME SYSTEMS:

CORE LOOP (60-90 sec runs, 20-min sessions):
- Player is a glyph on a radial field (reuses trapezoid engine)
- Enemies spawn in waves tagged by mod9 residue class:
  * residues {1,4,7} = STABLE enemies (predictable, slow)
  * residues {0,3,6} = BREACH enemies (fast, erratic, dangerous)
  * residues {2,5,8} = NEUTRAL (drop loot only)
  This IS your verified stratification, now as difficulty design.
- Between waves: pick 1 of 3 upgrades. Upgrades are FRACTYPE ROLES:
  * GROUPING: projectiles cluster (hit multiple enemies)
  * REPETITION: attack repeats (multishot)
  * MULTIPLICATION: damage multiplies per consecutive hit
  * RADICAL: heal derived from sqrt(damage dealt)
  * NEGATION: erase enemy bullets in radius
  * COMPLEMENT: shield covers the damage-type you're NOT being hit by
  * CONJUGATE: mirror enemy projectiles back
  * DIVISION: split large enemies into smaller ones (crowd control)
  Each role has 5 levels -> compounding like Balatro.
- Every 5th wave: BREACH CORRIDOR event (all-BREACH wave, big payout).
  The game literally tells you: "entering the corridor."

WHY THIS FITS YOU:
- Runs on canvas-2D (your proven stack), no WebGPU requirement
- The math is not decoration: difficulty curve IS mod9 stratification
  (you have a Kaggle kernel proving the properties)
- Upgrade tree IS the FracType schema (already ported to JS once)
- Conservation invariant = economy: total currency earned == total
  dropped, enforced every frame (conservation_pass pattern)
- Determinism hash from CLAIM-004 = daily seed system, verifiable

ASSETS VIA BLENDER MCP (available NOW on :9876):
Phase 1 (today): export 8 role-sigil meshes as GLBs for upgrade icons
Phase 2: enemy archetypes (3 residue classes x 4 tiers = 12 low-poly)
Phase 3: boss = "The Corridor" — a modular gate mesh
All low-poly (<500 tris), flat-shaded, one material each — fits
canvas2d sprite-render pipeline via orthographic bake to PNG.

SCOPE CONTROL:
- v0.1: core loop + 8 upgrades + 10 waves. One HTML file <40KB.
- v0.2: meta-progression (between-run unlocks), 25 waves
- v0.3: daily seed + leaderboard hash verification via gpt-verify
