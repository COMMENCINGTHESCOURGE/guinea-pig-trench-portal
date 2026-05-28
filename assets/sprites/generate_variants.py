"""
Generate color palette variants for all character sprites.
Uses PIL + numpy for HSV-based color transformations while preserving alpha.
"""
import os
import json
import numpy as np
from PIL import Image
from colorsys import rgb_to_hsv, hsv_to_rgb

SRC_DIR = os.path.join(os.path.dirname(__file__), "generated")
OUT_DIR = os.path.join(os.path.dirname(__file__), "variants")

os.makedirs(OUT_DIR, exist_ok=True)

# Load manifest
with open(os.path.join(SRC_DIR, "frame_manifest.json")) as f:
    manifest = json.load(f)

# --- Transformation functions ---
# All operate on float32 RGBA arrays (0-1 range), return same.

def to_hsv(rgb):
    """Convert RGB float array (H,W,3) to HSV float array (H,W,3)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    diff = maxc - minc

    # Value
    v = maxc

    # Saturation
    s = np.where(maxc > 0, diff / (maxc + 1e-10), 0.0)

    # Hue
    h = np.zeros_like(r)
    mask = diff > 1e-10

    rmask = mask & (maxc == r)
    gmask = mask & (maxc == g) & ~rmask
    bmask = mask & (maxc == b) & ~rmask & ~gmask

    h[rmask] = ((g[rmask] - b[rmask]) / diff[rmask]) % 6
    h[gmask] = ((b[gmask] - r[gmask]) / diff[gmask]) + 2
    h[bmask] = ((r[bmask] - g[bmask]) / diff[bmask]) + 4

    h = h / 6.0  # normalize to 0-1

    return np.stack([h, s, v], axis=-1)

def to_rgb(hsv):
    """Convert HSV float array (H,W,3) to RGB float array (H,W,3)."""
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    h = (h % 1.0) * 6.0

    i = np.floor(h).astype(int)
    f = h - i
    p = v * (1 - s)
    q = v * (1 - s * f)
    t = v * (1 - s * (1 - f))

    i = i % 6

    rgb = np.zeros(hsv.shape, dtype=np.float32)

    for idx, (r, g, b) in enumerate([
        (v, t, p), (q, v, p), (p, v, t),
        (p, q, v), (t, p, v), (v, p, q)
    ]):
        mask = (i == idx)
        rgb[..., 0][mask] = r[mask]
        rgb[..., 1][mask] = g[mask]
        rgb[..., 2][mask] = b[mask]

    return rgb


def apply_variant(rgba, variant_name, character):
    """Apply a color variant transformation. Returns modified RGBA float32 array."""
    arr = rgba.copy()
    rgb = arr[..., :3]
    alpha = arr[..., 3:]

    hsv = to_hsv(rgb)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]

    if character == "defender":
        if variant_name == "shadow":
            # Shift hue toward blue (0.66), reduce saturation, darken 30%
            h[:] = h * 0.3 + 0.66 * 0.7  # blend toward blue
            s[:] = s * 0.5
            v[:] = v * 0.7
        elif variant_name == "crystal":
            # Shift hue toward cyan (0.5), increase brightness 20%
            h[:] = h * 0.3 + 0.5 * 0.7
            s[:] = s * 0.6
            v[:] = np.minimum(v * 1.2, 1.0)
        elif variant_name == "volcanic":
            # Shift hue toward red/orange (0.05), boost saturation
            h[:] = h * 0.2 + 0.05 * 0.8
            s[:] = np.minimum(s * 1.5, 1.0)

    elif character == "mecha":
        if variant_name == "stealth":
            # Desaturate almost fully, darken 40%
            s[:] = s * 0.1
            v[:] = v * 0.6
        elif variant_name == "overcharge":
            # Boost brightness 40%, shift toward white/bright teal
            h[:] = h * 0.4 + 0.5 * 0.6  # blend toward teal
            s[:] = s * 0.5
            v[:] = np.minimum(v * 1.4, 1.0)
        elif variant_name == "corrupted":
            # Shift hue toward red, add red tint
            h[:] = h * 0.2 + 0.0 * 0.8  # shift toward red
            s[:] = np.minimum(s * 1.3, 1.0)
            # Red tint overlay after conversion
            hsv[..., 0] = h
            hsv[..., 1] = s
            hsv[..., 2] = v
            rgb_out = to_rgb(hsv)
            # Add slight red overlay
            rgb_out[..., 0] = np.minimum(rgb_out[..., 0] * 0.8 + 0.2, 1.0)
            rgb_out[..., 1] = rgb_out[..., 1] * 0.85
            rgb_out[..., 2] = rgb_out[..., 2] * 0.85
            return np.concatenate([rgb_out, alpha], axis=-1)

    elif character == "kraken":
        if variant_name == "deep":
            # Darken 50%, shift toward deep blue/purple (0.72)
            h[:] = h * 0.2 + 0.72 * 0.8
            s[:] = np.minimum(s * 1.2, 1.0)
            v[:] = v * 0.5
        elif variant_name == "toxic":
            # Shift toward green (0.33), boost saturation
            h[:] = h * 0.2 + 0.33 * 0.8
            s[:] = np.minimum(s * 1.6, 1.0)
        elif variant_name == "ghost":
            # Shift toward white/pale blue, reduce opacity to 60%
            h[:] = h * 0.3 + 0.58 * 0.7
            s[:] = s * 0.3
            v[:] = np.minimum(v * 1.1 + 0.2, 1.0)
            alpha[:] = alpha * 0.6

    elif character == "aku":
        if variant_name == "void":
            # Shift toward purple (0.8), darken
            h[:] = h * 0.2 + 0.8 * 0.8
            s[:] = np.minimum(s * 1.2, 1.0)
            v[:] = v * 0.7
        elif variant_name == "nature":
            # Shift toward green/brown (0.25)
            h[:] = h * 0.3 + 0.25 * 0.7
            s[:] = np.minimum(s * 1.1, 1.0)
            v[:] = v * 0.9
        elif variant_name == "frost":
            # Shift toward ice blue/white (0.55)
            h[:] = h * 0.2 + 0.55 * 0.8
            s[:] = s * 0.4
            v[:] = np.minimum(v * 1.15 + 0.1, 1.0)

    hsv[..., 0] = h
    hsv[..., 1] = s
    hsv[..., 2] = v
    rgb_out = to_rgb(hsv)

    return np.concatenate([rgb_out, alpha], axis=-1)


# Variant definitions per character
VARIANTS = {
    "defender": ["shadow", "crystal", "volcanic"],
    "mecha": ["stealth", "overcharge", "corrupted"],
    "kraken": ["deep", "toxic", "ghost"],
    "aku": ["void", "nature", "frost"],
}

# Build variant manifest
variant_manifest = {}
total_files = 0
processed = 0

# Count total
for char, actions in manifest.items():
    for action, frames in actions.items():
        total_files += len(frames) * len(VARIANTS.get(char, []))

print(f"Generating {total_files} variant frames...")

for char, actions in manifest.items():
    if char not in VARIANTS:
        continue

    variant_manifest[char] = {}

    # Copy original action entries
    for action, frames in actions.items():
        variant_manifest[char][action] = list(frames)

    for variant_name in VARIANTS[char]:
        for action, frames in actions.items():
            variant_key = f"{action}_{variant_name}"
            variant_frames = []

            for frame_file in frames:
                # Load image
                src_path = os.path.join(SRC_DIR, frame_file)
                img = Image.open(src_path).convert("RGBA")
                arr = np.array(img, dtype=np.float32) / 255.0

                # Apply transformation
                result = apply_variant(arr, variant_name, char)

                # Clip and convert back
                result = np.clip(result * 255, 0, 255).astype(np.uint8)
                out_img = Image.fromarray(result, "RGBA")

                # Build output filename
                base, ext = os.path.splitext(frame_file)
                out_name = f"{base}_{variant_name}{ext}"
                out_path = os.path.join(OUT_DIR, out_name)
                out_img.save(out_path)

                variant_frames.append(out_name)
                processed += 1

                if processed % 20 == 0:
                    pct = processed / total_files * 100
                    bar_len = 40
                    filled = int(bar_len * processed / total_files)
                    bar = "#" * filled + "-" * (bar_len - filled)
                    print(f"  [{bar}] {pct:.0f}% ({processed}/{total_files})")

            variant_manifest[char][variant_key] = variant_frames

# Save manifest
manifest_path = os.path.join(OUT_DIR, "variant_manifest.json")
with open(manifest_path, "w") as f:
    json.dump(variant_manifest, f, indent=2)

print(f"\nDone! Generated {processed} variant frames.")
print(f"Manifest saved to: {manifest_path}")
print(f"Output directory: {OUT_DIR}")
