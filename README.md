# Guinea Pig Trench

![Portal](assets/portal-screenshot.png)

**[Play now](https://commencethescourge.github.io/guinea-pig-trench-portal/)** — 40 original browser games, 129 beats, 5 worlds. Pure canvas, WebGL, and Web Audio API. Every asset is original IP. Zero budget.

> The *between* IS the product. The *mistake* IS the signal. The *almost* IS the always.

## What's Here

- **40 games** — raymarched worlds, voxel FPS, lenticular 3D, tower defense, fighting, trading, puzzles, rhythm, card battles, procedural terrain
- **129 beats** — 18 SoundClick originals by skippyohms + 111 refined/expression variants. Auto EQ, pitch correction, fluid vial controls
- **P2P Party** — voice, video, chat, proximity cypher. Serverless WebRTC via Trystero
- **5 worlds** — Pink Hour, The Block, The Threshold, Vault Compound 7, The Between

## The Sieve Connection

The same modular sieve that verified the [Erdos-Straus conjecture](https://github.com/Commencethescourge/erdos-straus-solver) to 10^17 seeds the game balance, shapes the terrain, drives the lenticular lens, and curves the EQ on every beat.

- **The Field** — 250K numbers on an Ulam spiral. Click to hear prime factors as SoundClick beat snippets. Toggle mod-24 to see sieve survivor channels.
- **Prime Sieve** — You ARE a number. Fly through modular filter gates.
- **Sieve Visualizer** — Watch 10^17 sweep in real time. 12.8% verified. Zero counterexamples.

## Tech

| Feature | Implementation |
|---|---|
| Rendering | WebGL2 raymarching, SDF scenes, orbit trap palettes |
| Audio | Web Audio API, Auto EQ (5-band), AutoTube pitch correction |
| Music | 129 tracks, persistent player, fluid vial volume/pitch controls |
| Multiplayer | Trystero P2P (BitTorrent trackers), no server needed |
| Sprites | Face-forge pipeline: 2D → heightmap → displaced mesh → .glb |
| Favicon | Living reaction-diffusion simulation (Gray-Scott at 32x32) |
| Loading | Pass 1 (6 scripts, first paint) / Pass 2 (13 deferred) |

## Run Locally

```
python -m http.server 8080
```

Open http://localhost:8080. No build step. No npm. No frameworks.

---

Guinea Pig Trench LLC — [GitHub](https://github.com/Commencethescourge) · [SoundClick](https://soundclick.com/skippyohms) · [Instagram](https://instagram.com/ohthatsthe) · [TikTok](https://tiktok.com/@commencethescourge)
