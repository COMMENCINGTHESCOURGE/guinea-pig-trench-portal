"""
DEEP CLEAN — Surgical sprite extraction
For sprites that have chrome, UI, text, or complex backgrounds baked in.
These need region-based extraction, not just color thresholding.
"""

from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import os

SPRITE_DIR = os.path.dirname(os.path.abspath(__file__))
REFINED_DIR = os.path.join(SPRITE_DIR, 'refined')
os.makedirs(REFINED_DIR, exist_ok=True)

EXPORT_SIZES = [64, 128, 256, 512]


def export(img, base_name):
    """Export at all resolutions."""
    for size in EXPORT_SIZES:
        resized = img.resize((size, size), Image.LANCZOS)
        path = os.path.join(REFINED_DIR, f'{base_name}_{size}.png')
        resized.save(path, 'PNG')
        print(f'  Exported: {base_name}_{size}.png')
    img.save(os.path.join(REFINED_DIR, f'{base_name}_full.png'), 'PNG')


def make_square(img, padding=16):
    """Pad to square with transparent bg."""
    w, h = img.size
    size = max(w, h) + padding * 2
    result = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    result.paste(img, ((size - w) // 2, (size - h) // 2), img)
    return result


def flood_fill_transparent(img, seed_points, tolerance=35):
    """Flood fill from seed points, making matched regions transparent."""
    data = np.array(img).copy()
    h, w = data.shape[:2]
    visited = np.zeros((h, w), dtype=bool)

    for sx, sy in seed_points:
        if sx < 0 or sx >= w or sy < 0 or sy >= h:
            continue
        seed_color = data[sy, sx, :3].astype(np.int16)
        stack = [(sx, sy)]

        while stack:
            x, y = stack.pop()
            if x < 0 or x >= w or y < 0 or y >= h:
                continue
            if visited[y, x]:
                continue

            pixel = data[y, x, :3].astype(np.int16)
            diff = np.abs(pixel - seed_color)
            if np.all(diff < tolerance):
                visited[y, x] = True
                data[y, x] = [0, 0, 0, 0]
                stack.extend([(x+1,y), (x-1,y), (x,y+1), (x,y-1)])

    return Image.fromarray(data.astype(np.uint8))


def remove_border_region(img, border_px=5, tolerance=40):
    """Remove everything connected to the image border."""
    data = np.array(img)
    h, w = data.shape[:2]
    seeds = []
    # Top and bottom edges
    for x in range(0, w, 3):
        seeds.append((x, 0))
        seeds.append((x, h-1))
    # Left and right edges
    for y in range(0, h, 3):
        seeds.append((0, y))
        seeds.append((w-1, y))
    return flood_fill_transparent(img, seeds, tolerance)


def kill_low_saturation(img, sat_threshold=25, val_min=100, val_max=240):
    """Remove grey/white/near-white pixels that aren't part of the subject."""
    data = np.array(img).copy()
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

    # Simple saturation estimate
    mx = np.maximum(np.maximum(r, g), b).astype(np.float32)
    mn = np.minimum(np.minimum(r, g), b).astype(np.float32)
    sat = np.where(mx > 0, ((mx - mn) / mx) * 255, 0)
    val = mx

    # Kill low-saturation pixels in the grey/white range
    mask = (sat < sat_threshold) & (val > val_min) & (val < val_max) & (a > 0)
    data[mask] = [0, 0, 0, 0]

    return Image.fromarray(data)


def clean_residual_noise(img, min_cluster=8):
    """Remove isolated pixel clusters smaller than min_cluster."""
    data = np.array(img)
    alpha = data[:, :, 3]
    h, w = alpha.shape

    # Simple connected component cleanup
    visited = np.zeros((h, w), dtype=bool)
    to_kill = []

    for y in range(h):
        for x in range(w):
            if visited[y, x] or alpha[y, x] < 10:
                visited[y, x] = True
                continue

            # BFS to find cluster size
            cluster = []
            stack = [(x, y)]
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cx >= w or cy < 0 or cy >= h:
                    continue
                if visited[cy, cx]:
                    continue
                if alpha[cy, cx] < 10:
                    visited[cy, cx] = True
                    continue
                visited[cy, cx] = True
                cluster.append((cx, cy))
                if len(cluster) > min_cluster:
                    break  # Big enough, keep it
                stack.extend([(cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)])

            if len(cluster) <= min_cluster:
                to_kill.extend(cluster)

    for x, y in to_kill:
        data[y, x] = [0, 0, 0, 0]

    return Image.fromarray(data)


# ═══════════════════════════════════════════════
# MECHA ORIGINAL — Extract from Instagram screenshot
# ═══════════════════════════════════════════════
def clean_mecha_original():
    print('\n' + '='*50)
    print('DEEP CLEAN: mecha_entity_alpha_v2.png')
    print('Source: Instagram screenshot from 2017')
    print('='*50)

    img = Image.open(os.path.join(SPRITE_DIR, 'mecha_entity_alpha_v2.png')).convert('RGBA')
    w, h = img.size
    print(f'  Original: {w}x{h}')

    # The character is roughly in the center of the Instagram post
    # Crop out the Instagram chrome (top bar, bottom bar, likes area)
    # Based on the image: character occupies roughly the middle 60% vertically
    # and 70% horizontally
    top_crop = int(h * 0.15)  # Skip "Posts" / "Follow" bar
    bottom_crop = int(h * 0.85)  # Skip likes/date/profile
    left_crop = int(w * 0.08)
    right_crop = int(w * 0.92)

    img = img.crop((left_crop, top_crop, right_crop, bottom_crop))
    print(f'  Cropped chrome: {img.size[0]}x{img.size[1]}')

    # The background is a warm cream/beige paper color
    # Remove it by flood-filling from edges
    img = remove_border_region(img, border_px=3, tolerance=45)
    print(f'  Removed border-connected background')

    # Kill remaining cream/beige/white
    data = np.array(img).copy()
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

    # Cream/beige: high R, high G, moderate-high B, all similar
    cream_mask = (r > 180) & (g > 160) & (b > 130) & (a > 0)
    # Also pure white
    white_mask = (r > 230) & (g > 230) & (b > 220) & (a > 0)
    data[cream_mask | white_mask] = [0, 0, 0, 0]
    img = Image.fromarray(data)
    print(f'  Removed cream/beige background')

    # Clean noise
    img = clean_residual_noise(img, min_cluster=15)
    print(f'  Cleaned residual noise')

    # Smooth edges
    data = np.array(img)
    alpha_ch = Image.fromarray(data[:,:,3])
    alpha_ch = alpha_ch.filter(ImageFilter.GaussianBlur(radius=0.7))
    data[:,:,3] = np.array(alpha_ch)
    data[data[:,:,3] < 10] = [0, 0, 0, 0]
    img = Image.fromarray(data)

    # Auto-crop and square
    alpha = np.array(img)[:,:,3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        img = img.crop((cmin-4, rmin-4, cmax+5, rmax+5))

    img = make_square(img)
    print(f'  Final: {img.size[0]}x{img.size[1]}')

    export(img, 'mecha_entity_alpha_v2')
    return img


# ═══════════════════════════════════════════════
# KRAKEN — Extract from Photoshop render
# ═══════════════════════════════════════════════
def clean_kraken():
    print('\n' + '='*50)
    print('DEEP CLEAN: kraken_game_render.png')
    print('Source: Photoshop render with UI chrome')
    print('='*50)

    img = Image.open(os.path.join(SPRITE_DIR, 'kraken_game_render.png')).convert('RGBA')
    w, h = img.size
    print(f'  Original: {w}x{h}')

    # Remove border-connected regions (catches the UI panels)
    img = remove_border_region(img, tolerance=40)
    print(f'  Removed border-connected UI')

    # Remove remaining white/light grey
    img = kill_low_saturation(img, sat_threshold=20, val_min=180, val_max=255)
    print(f'  Removed low-saturation background')

    # The kraken has a subtle grey background behind it
    # Do another pass on mid-greys
    data = np.array(img).copy()
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
    mid_grey = (r > 150) & (g > 150) & (b > 150) & (np.abs(r.astype(int)-g.astype(int)) < 15) & (a > 0)
    data[mid_grey] = [0, 0, 0, 0]
    img = Image.fromarray(data)
    print(f'  Removed mid-grey remnants')

    img = clean_residual_noise(img, min_cluster=20)

    # Smooth
    data = np.array(img)
    alpha_ch = Image.fromarray(data[:,:,3])
    alpha_ch = alpha_ch.filter(ImageFilter.GaussianBlur(radius=0.6))
    data[:,:,3] = np.array(alpha_ch)
    data[data[:,:,3] < 10] = [0, 0, 0, 0]
    img = Image.fromarray(data)

    # Crop and square
    alpha = np.array(img)[:,:,3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        img = img.crop((cmin-4, rmin-4, cmax+5, rmax+5))

    img = make_square(img)
    print(f'  Final: {img.size[0]}x{img.size[1]}')

    export(img, 'kraken_game_render')
    return img


# ═══════════════════════════════════════════════
# AKU AKU — Remove residual noise dots
# ═══════════════════════════════════════════════
def clean_aku():
    print('\n' + '='*50)
    print('DEEP CLEAN: aku_aku_mask_stylized.png')
    print('Source: Already good alpha, just needs noise cleanup')
    print('='*50)

    img = Image.open(os.path.join(SPRITE_DIR, 'aku_aku_mask_stylized.png')).convert('RGBA')
    print(f'  Original: {img.size[0]}x{img.size[1]}')

    # Remove checkerboard remnants more aggressively
    data = np.array(img).copy()
    r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]

    # Kill anything that's grey and low-alpha (residual checker noise)
    grey_noise = (np.abs(r.astype(int) - g.astype(int)) < 10) & \
                 (np.abs(g.astype(int) - b.astype(int)) < 10) & \
                 (r > 120) & (r < 220) & (a < 200) & (a > 0)
    data[grey_noise] = [0, 0, 0, 0]
    img = Image.fromarray(data)
    print(f'  Removed grey noise')

    # Clean small clusters
    img = clean_residual_noise(img, min_cluster=25)
    print(f'  Cleaned residual clusters')

    # Remove border-connected anything
    img = remove_border_region(img, tolerance=50)
    print(f'  Removed border artifacts')

    # Crop and square
    data = np.array(img)
    alpha = data[:,:,3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        img = img.crop((cmin-8, rmin-8, cmax+9, rmax+9))

    img = make_square(img, padding=20)

    # Final smooth
    data = np.array(img)
    alpha_ch = Image.fromarray(data[:,:,3])
    alpha_ch = alpha_ch.filter(ImageFilter.GaussianBlur(radius=0.5))
    data[:,:,3] = np.array(alpha_ch)
    data[data[:,:,3] < 8] = [0, 0, 0, 0]
    img = Image.fromarray(data)

    print(f'  Final: {img.size[0]}x{img.size[1]}')
    export(img, 'aku_aku_mask_stylized')
    return img


# ═══════════════════════════════════════════════
# GEODE — Separate multi-view reference into individual views
# ═══════════════════════════════════════════════
def clean_geode():
    print('\n' + '='*50)
    print('DEEP CLEAN: geometric_core_geode_flux.png')
    print('Source: Multi-view reference sheet with labels')
    print('='*50)

    img = Image.open(os.path.join(SPRITE_DIR, 'geometric_core_geode_flux.png')).convert('RGBA')
    w, h = img.size
    print(f'  Original: {w}x{h}')

    # The sheet has two rows of 3 views each
    # Top row: FRONT, TOP, SIDE (smaller, wireframe-ish)
    # Bottom row: FRONT, SIDE, ROTATION, 45° (larger, rendered)
    # We want the bottom-left large rendered front view as the primary

    # Bottom row starts roughly at h * 0.45
    # Each view is roughly w/3 wide in the top row, w/4 in the bottom
    # Extract the largest, most detailed view (bottom-left front)
    view_top = int(h * 0.42)
    view_bottom = int(h * 0.95)
    view_left = int(w * 0.02)
    view_right = int(w * 0.35)

    front_view = img.crop((view_left, view_top, view_right, view_bottom))
    print(f'  Extracted front view: {front_view.size[0]}x{front_view.size[1]}')

    # Clean background
    front_view = remove_border_region(front_view, tolerance=45)
    front_view = kill_low_saturation(front_view, sat_threshold=15, val_min=200, val_max=255)
    front_view = clean_residual_noise(front_view, min_cluster=10)

    # Crop and square
    data = np.array(front_view)
    alpha = data[:,:,3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        front_view = front_view.crop((cmin-4, rmin-4, cmax+5, rmax+5))

    front_view = make_square(front_view)
    print(f'  Final front view: {front_view.size[0]}x{front_view.size[1]}')
    export(front_view, 'geode_front')

    # Also extract the full sheet cleaned
    full_clean = remove_border_region(img, tolerance=40)
    full_clean = kill_low_saturation(full_clean, sat_threshold=15, val_min=220, val_max=255)
    full_clean = make_square(full_clean)
    export(full_clean, 'geometric_core_geode_flux')

    return front_view


def main():
    print('DEEP CLEAN — Surgical sprite extraction')
    print('The sprite is the seed.\n')

    clean_mecha_original()
    clean_kraken()
    clean_aku()
    clean_geode()

    print(f'\n{"="*50}')
    print('DEEP CLEAN COMPLETE')
    print(f'{"="*50}')
    print(f'Output: {REFINED_DIR}')


if __name__ == '__main__':
    main()
