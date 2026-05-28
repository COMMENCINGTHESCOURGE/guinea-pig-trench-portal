"""
SEER REFINERY — Shape Seer + Sprite Refinement Pipeline
Find shapes in anything → clean them → multi-res export → ready for the game.

Usage:
  python seer_refinery.py image.png
  python seer_refinery.py --watch ~/Downloads/
  python seer_refinery.py --all ~/Downloads/

The full chain:
  Screenshot/Photo → Shape Seer (find shapes) → Refinery (clean + scale) → Sprite Library
"""

import sys
import os
import numpy as np
from PIL import Image, ImageFilter
import json
import time

# Import shape seer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shape_seer import process_image as seer_process, OUTPUT_DIR as SEER_DIR, watch_directory

REFINED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites', 'seer', 'refined')
os.makedirs(REFINED_DIR, exist_ok=True)

EXPORT_SIZES = [64, 128, 256, 512]


def refine_sprite(img_path):
    """Full refinement pipeline on a seer-extracted sprite."""
    img = Image.open(img_path).convert('RGBA')
    data = np.array(img)

    # 1. Clean alpha — kill ghost pixels
    data[data[:, :, 3] < 15] = [0, 0, 0, 0]

    # 2. Remove border-connected transparent noise
    # (anything touching the edge that's semi-transparent)
    h, w = data.shape[:2]
    alpha = data[:, :, 3]
    for x in range(w):
        if alpha[0, x] > 0 and alpha[0, x] < 200:
            data[0, x] = [0, 0, 0, 0]
        if alpha[h-1, x] > 0 and alpha[h-1, x] < 200:
            data[h-1, x] = [0, 0, 0, 0]
    for y in range(h):
        if alpha[y, 0] > 0 and alpha[y, 0] < 200:
            data[y, 0] = [0, 0, 0, 0]
        if alpha[y, w-1] > 0 and alpha[y, w-1] < 200:
            data[y, w-1] = [0, 0, 0, 0]

    # 3. Smooth alpha edges
    img = Image.fromarray(data)
    d = np.array(img)
    alpha_ch = Image.fromarray(d[:, :, 3])
    alpha_ch = alpha_ch.filter(ImageFilter.GaussianBlur(radius=0.6))
    d[:, :, 3] = np.array(alpha_ch)
    d[d[:, :, 3] < 8] = [0, 0, 0, 0]

    # 4. Auto-crop tight
    alpha = d[:, :, 3]
    rows = np.any(alpha > 10, axis=1)
    cols = np.any(alpha > 10, axis=0)
    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        d = d[max(0, rmin-4):rmax+5, max(0, cmin-4):cmax+5]

    # 5. Make square
    img = Image.fromarray(d)
    iw, ih = img.size
    s = max(iw, ih) + 12
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(img, ((s - iw) // 2, (s - ih) // 2), img)

    return sq


def process_and_refine(filepath):
    """Full chain: Seer finds shapes, refinery cleans them."""
    print(f'\nSEER REFINERY: {filepath}')
    print('=' * 55)

    # Step 1: Shape Seer extracts shapes
    manifest = seer_process(filepath)

    if not manifest:
        print('  No shapes found.')
        return []

    # Step 2: Refine each extracted shape
    refined = []
    for entry in manifest:
        name = entry['name']
        full_path = os.path.join(SEER_DIR, f'{name}_full.png')

        if not os.path.exists(full_path):
            continue

        print(f'  Refining: {name} (score={entry["score"]})')

        # Refine
        sprite = refine_sprite(full_path)

        # Export at all sizes
        for size in EXPORT_SIZES:
            resized = sprite.resize((size, size), Image.LANCZOS)
            out_path = os.path.join(REFINED_DIR, f'{name}_refined_{size}.png')
            resized.save(out_path)

        sprite.save(os.path.join(REFINED_DIR, f'{name}_refined_full.png'))
        refined.append(name)
        print(f'    -> {name}_refined (4 sizes)')

    print(f'\nRefined {len(refined)} shapes')
    print(f'Output: {REFINED_DIR}')
    return refined


def main():
    if len(sys.argv) < 2:
        print('SEER REFINERY')
        print('Find shapes in anything. Clean them. Ship them.')
        print()
        print('Usage:')
        print('  python seer_refinery.py image.png')
        print('  python seer_refinery.py --all DIR     Process all images in directory')
        print('  python seer_refinery.py --downloads   Process everything in Downloads')
        return

    arg = sys.argv[1]

    if arg == '--all' and len(sys.argv) > 2:
        dirpath = sys.argv[2]
        for f in sorted(os.listdir(dirpath)):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                try:
                    process_and_refine(os.path.join(dirpath, f))
                except Exception as e:
                    print(f'  Error: {e}')
    elif arg == '--downloads':
        dl = os.path.expanduser('~/Downloads')
        # Process recent images (last 24 hours)
        now = time.time()
        for f in sorted(os.listdir(dl)):
            fp = os.path.join(dl, f)
            if f.lower().endswith(('.png', '.jpg', '.jpeg')) and os.path.isfile(fp):
                if now - os.path.getmtime(fp) < 86400:  # last 24h
                    try:
                        process_and_refine(fp)
                    except Exception as e:
                        print(f'  Error on {f}: {e}')
    elif os.path.isfile(arg):
        process_and_refine(arg)
    else:
        print(f'Not found: {arg}')


if __name__ == '__main__':
    main()
