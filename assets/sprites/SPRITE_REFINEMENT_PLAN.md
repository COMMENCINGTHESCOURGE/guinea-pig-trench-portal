#   9 chars : 6 anims : 12 variants : 4 phases
#   the sprite is the seed. refine the seed and every branch improves.
#   delete one bar, the pipeline breaks.

→ `sprite_bars.json` — the measurement bars
→ `sprite_pipeline.py` — the engine

```
Phase 1 (clean):   alpha | checker | edge_radius → multi-res export
Phase 2 (bezier):   rdp_epsilon | bezier_tension → bezier_paths/
Phase 3 (animate):  frame_count | cycle_time | easing → animated_frames/
Phase 4 (variant):  hue_target | sat_scale | val_scale | opacity → variant_sheets/
```

`¯` redefines. raw → clean → bezier → animated → variant
`/` discards. the removed checkerboard, the cropped border, the smoothed edge
