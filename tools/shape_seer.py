"""
SHAPE SEER — The Overseer Tool
Watches screenshots, finds shapes in anything, extracts them as sprites.
Pareidolia as a pipeline. The cloud that looks like a ship IS a ship.

Usage:
  python shape_seer.py screenshot.png
  python shape_seer.py --watch ~/Screenshots/
  python shape_seer.py --clipboard

It will:
1. Load the image
2. Find distinct shapes/regions using edge detection + contour finding
3. Score each shape for "interestingness" (complexity, size, symmetry)
4. Extract the top shapes as clean alpha PNGs
5. Save them to the sprite library
"""

import sys
import os
import time
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from collections import deque
import json

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sprites', 'seer')
os.makedirs(OUTPUT_DIR, exist_ok=True)

EXPORT_SIZES = [64, 128, 256]
MIN_SHAPE_AREA = 200       # minimum pixels to consider
MAX_SHAPES = 12            # max shapes to extract per image
EDGE_THRESHOLD = 40        # edge detection sensitivity
INTEREST_THRESHOLD = 0.3   # minimum interestingness score


def find_edges(img):
    """Detect edges using Sobel-like approach."""
    grey = img.convert('L')
    edges = grey.filter(ImageFilter.FIND_EDGES)
    # Threshold
    data = np.array(edges)
    data = (data > EDGE_THRESHOLD).astype(np.uint8) * 255
    return Image.fromarray(data)


def find_contours(edge_img):
    """Find connected regions in the edge image."""
    data = np.array(edge_img)
    h, w = data.shape
    visited = np.zeros((h, w), dtype=bool)
    contours = []

    for sy in range(0, h, 3):  # skip for speed
        for sx in range(0, w, 3):
            if visited[sy, sx] or data[sy, sx] < 128:
                visited[sy, sx] = True
                continue

            # BFS flood fill
            region = []
            queue = deque([(sx, sy)])
            while queue:
                x, y = queue.popleft()
                if x < 0 or x >= w or y < 0 or y >= h:
                    continue
                if visited[y, x]:
                    continue
                if data[y, x] < 128:
                    visited[y, x] = True
                    continue
                visited[y, x] = True
                region.append((x, y))
                if len(region) > 50000:  # cap for performance
                    break
                queue.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])

            if len(region) >= MIN_SHAPE_AREA:
                contours.append(region)

    return contours


def score_shape(region, img_w, img_h):
    """Score a shape for interestingness.
    High score = complex, right-sized, somewhat symmetric = looks like something."""
    if len(region) < MIN_SHAPE_AREA:
        return 0

    xs = [p[0] for p in region]
    ys = [p[1] for p in region]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    w = x_max - x_min + 1
    h = y_max - y_min + 1

    if w < 10 or h < 10:
        return 0

    area = len(region)
    bbox_area = w * h

    # Fill ratio — how much of the bounding box is filled
    # Too high = blob, too low = scattered noise
    fill = area / max(1, bbox_area)
    fill_score = 1.0 - abs(fill - 0.5) * 2  # best at 50% fill

    # Aspect ratio — prefer roughly square-ish
    aspect = min(w, h) / max(w, h)
    aspect_score = aspect  # 1.0 = square, 0 = extreme rectangle

    # Size relative to image — not too small, not too big
    rel_size = area / (img_w * img_h)
    size_score = min(1.0, rel_size * 50) * (1.0 - min(1.0, rel_size * 5))

    # Perimeter complexity — more complex outline = more interesting
    # Approximate by counting edge pixels vs area
    perimeter = 0
    region_set = set(region)
    for x, y in region:
        for dx, dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            if (x+dx, y+dy) not in region_set:
                perimeter += 1
                break
    complexity = perimeter / max(1, area ** 0.5)
    complexity_score = min(1.0, complexity / 10)

    # Combined score
    score = (fill_score * 0.25 +
             aspect_score * 0.2 +
             size_score * 0.3 +
             complexity_score * 0.25)

    return score


def extract_shape(img, region):
    """Extract a shape from the image as a clean alpha PNG."""
    xs = [p[0] for p in region]
    ys = [p[1] for p in region]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    padding = 8
    x_min = max(0, x_min - padding)
    y_min = max(0, y_min - padding)
    x_max = min(img.width, x_max + padding + 1)
    y_max = min(img.height, y_max + padding + 1)

    # Crop region from original image
    cropped = img.crop((x_min, y_min, x_max, y_max))
    cropped = cropped.convert('RGBA')

    # Build alpha mask from the region
    w, h = cropped.size
    alpha = np.zeros((h, w), dtype=np.uint8)
    region_set = set(region)

    # Fill the interior of the shape (not just edges)
    for y in range(h):
        for x in range(w):
            if (x + x_min, y + y_min) in region_set:
                alpha[y, x] = 255

    # Dilate the mask slightly to include nearby pixels
    from PIL import ImageFilter as IF
    alpha_img = Image.fromarray(alpha).filter(IF.MaxFilter(5))
    alpha = np.array(alpha_img)

    # Apply alpha
    data = np.array(cropped)
    data[:, :, 3] = alpha
    result = Image.fromarray(data)

    # Make square
    rw, rh = result.size
    s = max(rw, rh) + 16
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(result, ((s - rw) // 2, (s - rh) // 2), result)

    return sq


def process_image(filepath):
    """Full pipeline: load image, find shapes, score, extract, save."""
    print(f'SHAPE SEER: {filepath}')
    print('=' * 50)

    img = Image.open(filepath).convert('RGBA')
    print(f'  Loaded: {img.width}x{img.height}')

    # Find edges
    edges = find_edges(img)
    print(f'  Edge detection complete')

    # Find contours
    contours = find_contours(edges)
    print(f'  Found {len(contours)} regions')

    # Score each shape
    scored = []
    for region in contours:
        score = score_shape(region, img.width, img.height)
        if score >= INTEREST_THRESHOLD:
            scored.append((score, region))

    scored.sort(key=lambda x: -x[0])
    top = scored[:MAX_SHAPES]
    print(f'  Interesting shapes: {len(top)}')

    # Extract and save
    manifest = []
    basename = os.path.splitext(os.path.basename(filepath))[0]
    timestamp = int(time.time())

    for i, (score, region) in enumerate(top):
        sprite = extract_shape(img, region)
        name = f'seer_{basename}_{timestamp}_{i}'

        for size in EXPORT_SIZES:
            resized = sprite.resize((size, size), Image.LANCZOS)
            out_path = os.path.join(OUTPUT_DIR, f'{name}_{size}.png')
            resized.save(out_path)

        sprite.save(os.path.join(OUTPUT_DIR, f'{name}_full.png'))

        xs = [p[0] for p in region]
        ys = [p[1] for p in region]
        manifest.append({
            'name': name,
            'score': round(score, 3),
            'area': len(region),
            'bbox': [min(xs), min(ys), max(xs), max(ys)],
            'source': os.path.basename(filepath),
        })
        print(f'  [{i+1}] score={score:.3f} area={len(region)} -> {name}')

    # Save manifest
    manifest_path = os.path.join(OUTPUT_DIR, f'seer_{basename}_{timestamp}.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f'\nExtracted {len(manifest)} shapes to {OUTPUT_DIR}')
    return manifest


def watch_directory(dirpath):
    """Watch a directory for new images and process them."""
    print(f'SHAPE SEER: Watching {dirpath}')
    print('Drop images in. I will find the shapes.\n')
    seen = set(os.listdir(dirpath))

    while True:
        current = set(os.listdir(dirpath))
        new_files = current - seen
        for f in new_files:
            if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp')):
                try:
                    process_image(os.path.join(dirpath, f))
                except Exception as e:
                    print(f'  Error processing {f}: {e}')
        seen = current
        time.sleep(2)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('SHAPE SEER - The Overseer')
        print('Finds shapes in anything. Extracts them as sprites.')
        print()
        print('Usage:')
        print('  python shape_seer.py image.png          Process one image')
        print('  python shape_seer.py --watch DIR         Watch directory for new images')
        print('  python shape_seer.py --downloads         Watch Downloads folder')
        sys.exit(0)

    arg = sys.argv[1]

    if arg == '--watch' and len(sys.argv) > 2:
        watch_directory(sys.argv[2])
    elif arg == '--downloads':
        watch_directory(os.path.expanduser('~/Downloads'))
    elif os.path.isfile(arg):
        process_image(arg)
    elif os.path.isdir(arg):
        # Process all images in directory
        for f in sorted(os.listdir(arg)):
            if f.lower().endswith(('.png', '.jpg', '.jpeg')):
                process_image(os.path.join(arg, f))
    else:
        print(f'Not found: {arg}')
