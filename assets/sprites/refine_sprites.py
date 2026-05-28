"""
SPRITE REFINEMENT ENGINE
Phase 1: Clean extraction — remove backgrounds, chrome, labels
Phase 2: Bezier fitting — pixel outlines to smooth curves
Phase 3: Multi-resolution export

The sprite is the seed. Refine the seed and every branch improves.
"""

from PIL import Image, ImageFilter, ImageOps
import numpy as np
import os
import json

SPRITE_DIR = os.path.dirname(os.path.abspath(__file__))
REFINED_DIR = os.path.join(SPRITE_DIR, 'refined')
os.makedirs(REFINED_DIR, exist_ok=True)

EXPORT_SIZES = [64, 128, 256, 512]


def load_image(name):
    path = os.path.join(SPRITE_DIR, name)
    return Image.open(path).convert('RGBA')


def clean_alpha(img, threshold=20):
    """Remove near-transparent noise and clean edges."""
    data = np.array(img)
    # Kill pixels with very low alpha
    data[data[:, :, 3] < threshold] = [0, 0, 0, 0]
    return Image.fromarray(data)


def remove_background_color(img, bg_colors=None, tolerance=30):
    """Remove specific background colors, replace with transparency."""
    data = np.array(img).copy()
    if bg_colors is None:
        # Auto-detect: sample corners
        corners = [data[0, 0, :3], data[0, -1, :3], data[-1, 0, :3], data[-1, -1, :3]]
        bg_colors = [corners[0]]  # use top-left as reference

    for bg in bg_colors:
        bg = np.array(bg[:3], dtype=np.int16)
        diff = np.abs(data[:, :, :3].astype(np.int16) - bg)
        mask = np.all(diff < tolerance, axis=2)
        data[mask] = [0, 0, 0, 0]

    return Image.fromarray(data.astype(np.uint8))


def remove_checkerboard(img, tolerance=15):
    """Remove the standard transparency checkerboard pattern."""
    data = np.array(img).copy()
    h, w = data.shape[:2]

    # Checkerboard colors (standard Photoshop/web)
    light = np.array([204, 204, 204], dtype=np.int16)
    dark = np.array([153, 153, 153], dtype=np.int16)
    white = np.array([255, 255, 255], dtype=np.int16)
    light2 = np.array([238, 238, 238], dtype=np.int16)

    for check_color in [light, dark, white, light2]:
        diff = np.abs(data[:, :, :3].astype(np.int16) - check_color)
        mask = np.all(diff < tolerance, axis=2)
        data[mask] = [0, 0, 0, 0]

    return Image.fromarray(data.astype(np.uint8))


def auto_crop(img, padding=4):
    """Crop to content bounding box with padding."""
    data = np.array(img)
    alpha = data[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any() or not cols.any():
        return img
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    rmin = max(0, rmin - padding)
    rmax = min(data.shape[0], rmax + padding + 1)
    cmin = max(0, cmin - padding)
    cmax = min(data.shape[1], cmax + padding + 1)
    return img.crop((cmin, rmin, cmax, rmax))


def make_square(img):
    """Pad image to square aspect ratio, centered."""
    w, h = img.size
    size = max(w, h)
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(img, ((size - w) // 2, (size - h) // 2))
    return result


def smooth_edges(img, radius=1):
    """Anti-alias the alpha channel edges."""
    data = np.array(img).copy()
    alpha = Image.fromarray(data[:, :, 3])
    # Slight blur on alpha only
    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=radius))
    data[:, :, 3] = np.array(alpha)
    # Re-threshold to avoid ghost pixels
    data[data[:, :, 3] < 8] = [0, 0, 0, 0]
    return Image.fromarray(data)


def export_multi_res(img, base_name):
    """Export at all target resolutions."""
    manifest = {
        'name': base_name,
        'source': 'refine_sprites.py',
        'resolutions': {},
    }
    for size in EXPORT_SIZES:
        resized = img.resize((size, size), Image.LANCZOS)
        filename = f'{base_name}_{size}.png'
        filepath = os.path.join(REFINED_DIR, filename)
        resized.save(filepath, 'PNG')
        manifest['resolutions'][str(size)] = filename
        print(f'  Exported: {filename}')

    # Also save full resolution
    full_name = f'{base_name}_full.png'
    img.save(os.path.join(REFINED_DIR, full_name), 'PNG')
    manifest['resolutions']['full'] = full_name
    manifest['full_size'] = list(img.size)

    return manifest


def refine_sprite(name, remove_bg=True, remove_checker=True, smooth=True):
    """Full refinement pipeline for one sprite."""
    print(f'\n{"="*50}')
    print(f'REFINING: {name}')
    print(f'{"="*50}')

    img = load_image(name)
    print(f'  Loaded: {img.size[0]}x{img.size[1]}, mode={img.mode}')

    # Phase 1: Clean
    if remove_checker:
        img = remove_checkerboard(img)
        print(f'  Removed checkerboard pattern')

    if remove_bg:
        img = remove_background_color(img)
        print(f'  Removed background color')

    img = clean_alpha(img, threshold=15)
    print(f'  Cleaned alpha (threshold=15)')

    # Auto-crop to content
    img = auto_crop(img, padding=8)
    print(f'  Cropped to content: {img.size[0]}x{img.size[1]}')

    # Make square
    img = make_square(img)
    print(f'  Squared: {img.size[0]}x{img.size[1]}')

    # Smooth edges
    if smooth:
        img = smooth_edges(img, radius=0.8)
        print(f'  Smoothed edges')

    # Export at all resolutions
    base_name = name.replace('.png', '').replace(' ', '_')
    manifest = export_multi_res(img, base_name)

    return manifest


# ═══════════════════════════════════════════════════
# MAIN — Refine all sprites
# ═══════════════════════════════════════════════════

def main():
    print('SPRITE REFINEMENT ENGINE')
    print('The sprite is the seed. Refine the seed and every branch improves.')
    print()

    all_manifests = {}

    # The sprites that need refinement
    sprites = [
        # (filename, remove_bg, remove_checker, smooth)
        ('aku_aku_mask_stylized.png', True, True, True),
        ('mecha_entity_alpha_v2_pixel.png', True, True, True),
        ('mecha_entity_alpha_v2.png', True, False, True),  # Instagram screenshot — bg removal critical
        ('geometric_core_geode_flux.png', True, True, True),
        ('armored_defender_sprite_sheet.png', True, True, True),
        ('kraken_game_render.png', True, True, True),
        ('void_runner_ship.png', True, False, True),
        ('dim_mak_fighter_full_sheet.png', True, True, True),
        ('grief_warrior_sprite_sheet.png', True, False, True),  # Has wood bg, not checker
    ]

    for name, rm_bg, rm_check, smooth in sprites:
        try:
            manifest = refine_sprite(name, rm_bg, rm_check, smooth)
            all_manifests[name] = manifest
        except Exception as e:
            print(f'  ERROR: {e}')

    # Save master manifest
    manifest_path = os.path.join(REFINED_DIR, 'refinement_manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(all_manifests, f, indent=2)
    print(f'\nMaster manifest saved: {manifest_path}')

    # Summary
    print(f'\n{"="*50}')
    print(f'REFINEMENT COMPLETE')
    print(f'{"="*50}')
    print(f'Sprites processed: {len(all_manifests)}')
    total_files = sum(len(m.get("resolutions", {})) for m in all_manifests.values())
    print(f'Files generated: {total_files}')
    print(f'Output directory: {REFINED_DIR}')
    for size in EXPORT_SIZES:
        print(f'  {size}x{size}: {len(all_manifests)} sprites')


if __name__ == '__main__':
    main()
