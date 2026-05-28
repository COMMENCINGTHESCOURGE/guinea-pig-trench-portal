"""
EXTRACT SUBJECT — Flip the approach.
Instead of removing background, FIND the subject and keep ONLY it.
The subject has: high alpha clusters, color saturation, large connected mass.
Everything else dies.

Use your weakness against your opponent.
"""

from PIL import Image, ImageFilter
import numpy as np
import os

SPRITE_DIR = os.path.dirname(os.path.abspath(__file__))
REFINED_DIR = os.path.join(SPRITE_DIR, 'refined')
os.makedirs(REFINED_DIR, exist_ok=True)
EXPORT_SIZES = [64, 128, 256, 512]


def largest_connected_alpha(img, alpha_thresh=30):
    """Find the largest connected region of non-transparent pixels.
    Keep ONLY that region. Everything else = transparent."""
    data = np.array(img)
    alpha = data[:, :, 3]
    h, w = alpha.shape
    mask = alpha >= alpha_thresh
    visited = np.zeros((h, w), dtype=bool)

    # Find all connected components and their sizes
    components = []

    for sy in range(h):
        for sx in range(w):
            if visited[sy, sx] or not mask[sy, sx]:
                visited[sy, sx] = True
                continue

            # BFS flood fill
            component = []
            stack = [(sx, sy)]
            while stack:
                x, y = stack.pop()
                if x < 0 or x >= w or y < 0 or y >= h:
                    continue
                if visited[y, x]:
                    continue
                if not mask[y, x]:
                    visited[y, x] = True
                    continue
                visited[y, x] = True
                component.append((x, y))
                # 8-connectivity for better blob detection
                stack.extend([
                    (x+1,y), (x-1,y), (x,y+1), (x,y-1),
                    (x+1,y+1), (x-1,y-1), (x+1,y-1), (x-1,y+1)
                ])

            if component:
                components.append(component)

    if not components:
        return img

    # Sort by size, keep only the largest
    components.sort(key=len, reverse=True)

    # Keep the largest component (the subject)
    # Also keep any component that's at least 10% the size of the largest
    # (catches detached parts like the mecha's horns or mask crown)
    largest_size = len(components[0])
    threshold = largest_size * 0.05  # 5% of largest

    keep_pixels = set()
    kept_count = 0
    for comp in components:
        if len(comp) >= threshold:
            keep_pixels.update(comp)
            kept_count += 1
        else:
            break  # Components are sorted by size

    print(f'    Found {len(components)} components, keeping {kept_count} (>= {threshold:.0f} px)')

    # Zero out everything NOT in the kept components
    result = data.copy()
    for y in range(h):
        for x in range(w):
            if (x, y) not in keep_pixels:
                result[y, x] = [0, 0, 0, 0]

    return Image.fromarray(result)


def auto_crop_tight(img, padding=8):
    data = np.array(img)
    alpha = data[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if not rows.any() or not cols.any():
        return img
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    return img.crop((
        max(0, cmin - padding),
        max(0, rmin - padding),
        min(data.shape[1], cmax + padding + 1),
        min(data.shape[0], rmax + padding + 1)
    ))


def make_square(img, padding=12):
    w, h = img.size
    size = max(w, h) + padding * 2
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(img, ((size - w) // 2, (size - h) // 2), img)
    return result


def smooth_alpha(img, radius=0.6):
    data = np.array(img).copy()
    a = Image.fromarray(data[:, :, 3])
    a = a.filter(ImageFilter.GaussianBlur(radius=radius))
    data[:, :, 3] = np.array(a)
    data[data[:, :, 3] < 6] = [0, 0, 0, 0]
    return Image.fromarray(data)


def export(img, name):
    for size in EXPORT_SIZES:
        r = img.resize((size, size), Image.LANCZOS)
        r.save(os.path.join(REFINED_DIR, f'{name}_{size}.png'), 'PNG')
        print(f'    {name}_{size}.png')
    img.save(os.path.join(REFINED_DIR, f'{name}_full.png'), 'PNG')


def extract_and_export(filename, display_name, pre_crop=None, alpha_thresh=25):
    """Full pipeline: load -> pre-crop -> find largest blob -> crop -> square -> smooth -> export"""
    print(f'\n  {display_name}')
    print(f'  {"-" * 40}')

    img = Image.open(os.path.join(SPRITE_DIR, filename)).convert('RGBA')
    print(f'    Loaded: {img.size[0]}x{img.size[1]}')

    if pre_crop:
        w, h = img.size
        l = int(w * pre_crop[0])
        t = int(h * pre_crop[1])
        r = int(w * pre_crop[2])
        b = int(h * pre_crop[3])
        img = img.crop((l, t, r, b))
        print(f'    Pre-cropped: {img.size[0]}x{img.size[1]}')

    # THE FLIP: find subject, kill everything else
    img = largest_connected_alpha(img, alpha_thresh=alpha_thresh)

    img = auto_crop_tight(img)
    img = make_square(img)
    img = smooth_alpha(img, radius=0.5)
    print(f'    Final: {img.size[0]}x{img.size[1]}')

    base = filename.replace('.png', '')
    export(img, base)
    return img


def main():
    print('=' * 55)
    print('  EXTRACT SUBJECT — Find it. Keep it. Kill the rest.')
    print('  Use your weakness against your opponent.')
    print('=' * 55)

    # MECHA ORIGINAL — crop out Instagram chrome first, then extract
    extract_and_export(
        'mecha_entity_alpha_v2.png',
        'MECHA ORIGINAL (2017 Instagram)',
        pre_crop=(0.05, 0.12, 0.95, 0.82),  # Remove IG chrome
        alpha_thresh=20
    )

    # KRAKEN — has Photoshop chrome
    extract_and_export(
        'kraken_game_render.png',
        'KRAKEN (Photoshop render)',
        alpha_thresh=30
    )

    # AKU AKU — good but has checker noise
    extract_and_export(
        'aku_aku_mask_stylized.png',
        'AKU AKU MASK',
        alpha_thresh=40  # Higher threshold kills the semi-transparent checker remnants
    )

    # MECHA PIXEL — clean but has separated head/body
    extract_and_export(
        'mecha_entity_alpha_v2_pixel.png',
        'MECHA PIXEL',
        alpha_thresh=25
    )

    # GEODE — reference sheet
    extract_and_export(
        'geometric_core_geode_flux.png',
        'GEODE (full sheet)',
        alpha_thresh=30
    )

    # VOID RUNNER — clean on black
    extract_and_export(
        'void_runner_ship.png',
        'VOID RUNNER SHIP',
        alpha_thresh=15
    )

    # DEFENDER — pixel sprite sheet
    extract_and_export(
        'armored_defender_sprite_sheet.png',
        'ARMORED DEFENDER',
        alpha_thresh=25
    )

    # DIM MAK — character sheet
    extract_and_export(
        'dim_mak_fighter_full_sheet.png',
        'DIM MAK FIGHTER',
        alpha_thresh=20
    )

    # GRIEF WARRIOR — painted on wood
    extract_and_export(
        'grief_warrior_sprite_sheet.png',
        'GRIEF WARRIOR',
        alpha_thresh=20
    )

    print(f'\n{"=" * 55}')
    print('  EXTRACTION COMPLETE')
    print(f'  Output: {REFINED_DIR}')
    print(f'{"=" * 55}')


if __name__ == '__main__':
    main()
