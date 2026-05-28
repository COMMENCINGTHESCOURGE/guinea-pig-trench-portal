"""
Generate missing animation frames from existing sprite assets.
Uses scale, rotate, offset, and tint transformations via PIL/Pillow.
"""
import json
import os
from PIL import Image, ImageEnhance, ImageDraw, ImageChops

SPRITE_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SPRITE_DIR, "generated")
os.makedirs(OUT_DIR, exist_ok=True)

manifest = {}


def save(img, name):
    """Save a frame and return the filename."""
    path = os.path.join(OUT_DIR, name)
    img.save(path, "PNG")
    return name


def ensure_rgba(img):
    return img.convert("RGBA") if img.mode != "RGBA" else img.copy()


def scale_image(img, sx, sy):
    """Scale image by sx, sy factors, centering on original canvas."""
    w, h = img.size
    nw, nh = int(w * sx), int(h * sy)
    scaled = img.resize((nw, nh), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(scaled, ((w - nw) // 2, (h - nh) // 2), scaled)
    return canvas


def offset_image(img, dx, dy):
    """Offset image by dx, dy pixels."""
    w, h = img.size
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(img, (dx, dy), img)
    return canvas


def rotate_image(img, angle):
    """Rotate image by angle degrees, keeping canvas size."""
    return img.rotate(angle, resample=Image.BICUBIC, expand=False)


def tint_red(img, strength=0.3):
    """Blend image with red tint."""
    red_layer = Image.new("RGBA", img.size, (255, 0, 0, int(255 * strength)))
    return Image.alpha_composite(img, red_layer)


def darken(img, factor=0.8):
    """Darken image by factor."""
    enhancer = ImageEnhance.Brightness(img)
    return enhancer.enhance(factor)


def add_shield_border(img, border_px=4):
    """Add a white border rectangle as shield effect."""
    result = img.copy()
    draw = ImageDraw.Draw(result)
    w, h = result.size
    m = border_px
    draw.rectangle([m, m, w - m, h - m], outline=(255, 255, 255, 200), width=border_px)
    return result


def generate_common_frames(base, prefix):
    """Generate jump, crouch, block, hit, knockback, death, victory from a base frame."""
    frames = {}

    # JUMP: 4 frames — anticipation squash, rise, apex, land
    jump = []
    jump.append(save(scale_image(base, 1.0, 0.85), f"{prefix}_jump_1.png"))   # squash
    jump.append(save(offset_image(scale_image(base, 1.0, 1.15), 0, -15), f"{prefix}_jump_2.png"))  # rise
    jump.append(save(offset_image(scale_image(base, 1.05, 1.1), 0, -25), f"{prefix}_jump_3.png"))  # apex
    jump.append(save(scale_image(base, 1.1, 0.85), f"{prefix}_jump_4.png"))   # land squash
    frames["jump"] = jump

    # CROUCH: 3 frames — transition down, hold, return
    crouch = []
    crouch.append(save(scale_image(base, 1.0, 0.85), f"{prefix}_crouch_1.png"))
    crouch.append(save(offset_image(scale_image(base, 1.05, 0.7), 0, 10), f"{prefix}_crouch_2.png"))
    crouch.append(save(scale_image(base, 1.0, 0.85), f"{prefix}_crouch_3.png"))
    frames["crouch"] = crouch

    # BLOCK: 3 frames — raise shield, hold, lower
    block = []
    block.append(save(darken(base, 0.9), f"{prefix}_block_1.png"))
    block.append(save(add_shield_border(darken(base, 0.8)), f"{prefix}_block_2.png"))
    block.append(save(darken(base, 0.9), f"{prefix}_block_3.png"))
    frames["block"] = block

    # HIT: 3 frames — impact, recoil, recover
    hit = []
    hit_frame = tint_red(base, 0.3)
    hit.append(save(offset_image(hit_frame, 5, 0), f"{prefix}_hit_1.png"))
    hit.append(save(offset_image(tint_red(base, 0.4), -3, 0), f"{prefix}_hit_2.png"))
    hit.append(save(tint_red(base, 0.15), f"{prefix}_hit_3.png"))
    frames["hit"] = hit

    # KNOCKBACK: 4 frames — hit, tumble back, spin, land
    knockback = []
    knockback.append(save(offset_image(tint_red(base, 0.3), 8, 0), f"{prefix}_knockback_1.png"))
    knockback.append(save(offset_image(rotate_image(tint_red(base, 0.2), 15), 15, -5), f"{prefix}_knockback_2.png"))
    knockback.append(save(offset_image(rotate_image(tint_red(base, 0.1), 30), 20, -10), f"{prefix}_knockback_3.png"))
    knockback.append(save(offset_image(rotate_image(base, 10), 10, 0), f"{prefix}_knockback_4.png"))
    frames["knockback"] = knockback

    # DEATH: 4 frames — stagger, tilt, fall, flat
    death = []
    death.append(save(tint_red(base, 0.2), f"{prefix}_death_1.png"))
    death.append(save(rotate_image(scale_image(base, 1.0, 0.85), 45), f"{prefix}_death_2.png"))
    death.append(save(rotate_image(scale_image(base, 1.0, 0.6), 70), f"{prefix}_death_3.png"))
    death.append(save(rotate_image(scale_image(base, 1.0, 0.4), 90), f"{prefix}_death_4.png"))
    frames["death"] = death

    # VICTORY: 3 frames — pump up, full size, settle
    victory = []
    victory.append(save(scale_image(base, 1.05, 1.05), f"{prefix}_victory_1.png"))
    victory.append(save(offset_image(scale_image(base, 1.1, 1.1), 0, -5), f"{prefix}_victory_2.png"))
    victory.append(save(scale_image(base, 1.05, 1.05), f"{prefix}_victory_3.png"))
    frames["victory"] = victory

    return frames


# ============================================================
# 1. ARMORED DEFENDER — extract idle frame 1 from 6x3 grid
# ============================================================
print("Processing Armored Defender...")
defender_sheet = Image.open(os.path.join(SPRITE_DIR, "armored_defender_sprite_sheet.png"))
defender_sheet = ensure_rgba(defender_sheet)
# 6x3 grid → 1024x559 → each cell ~170x186
cell_w = defender_sheet.width // 6   # 170
cell_h = defender_sheet.height // 3  # 186
# Extract first idle frame (top-left)
defender_base = defender_sheet.crop((0, 0, cell_w, cell_h))

defender_frames = generate_common_frames(defender_base, "defender")
manifest["defender"] = defender_frames
print(f"  Generated {sum(len(v) for v in defender_frames.values())} frames")


# ============================================================
# 2. MECHA ENTITY — single static image
# ============================================================
print("Processing Mecha Entity...")
mecha_full = Image.open(os.path.join(SPRITE_DIR, "mecha_entity_alpha_v2_pixel.png"))
mecha_full = ensure_rgba(mecha_full)
# Resize to a reasonable sprite size (256x256)
mecha_base = mecha_full.resize((256, 256), Image.LANCZOS)

mecha_frames = {}

# IDLE: 4 frames — subtle breathing
idle = []
for i, sy in enumerate([1.0, 1.01, 1.0, 0.99], 1):
    idle.append(save(scale_image(mecha_base, 1.0, sy), f"mecha_idle_{i}.png"))
mecha_frames["idle"] = idle

# WALK: 4 frames — lateral sway + tilt
walk = []
for i, (dx, angle) in enumerate([(-2, -2), (0, 0), (2, 2), (0, 0)], 1):
    frame = offset_image(rotate_image(mecha_base, angle), dx, 0)
    walk.append(save(frame, f"mecha_walk_{i}.png"))
mecha_frames["walk"] = walk

# ATTACK: 3 frames — stretch forward
attack = []
for i, sx in enumerate([1.0, 1.1, 1.0], 1):
    attack.append(save(scale_image(mecha_base, sx, 1.0), f"mecha_attack_{i}.png"))
mecha_frames["attack"] = attack

# Common frames (jump, crouch, block, hit, knockback, death, victory)
common = generate_common_frames(mecha_base, "mecha")
mecha_frames.update(common)

manifest["mecha"] = mecha_frames
print(f"  Generated {sum(len(v) for v in mecha_frames.values())} frames")


# ============================================================
# 3. KRAKEN — single static image
# ============================================================
print("Processing Kraken...")
kraken_full = Image.open(os.path.join(SPRITE_DIR, "kraken_game_render.png"))
kraken_full = ensure_rgba(kraken_full)
kraken_base = kraken_full.resize((256, 256), Image.LANCZOS)

kraken_frames = {}

# IDLE: 4 frames — undulating motion
idle = []
for i, (sx, sy) in enumerate([(1.0, 1.0), (1.02, 0.98), (1.0, 1.0), (0.98, 1.02)], 1):
    idle.append(save(scale_image(kraken_base, sx, sy), f"kraken_idle_{i}.png"))
kraken_frames["idle"] = idle

# WALK: 4 frames — tentacle-like sway
walk = []
for i, (dx, angle) in enumerate([(-3, -3), (0, 0), (3, 3), (0, 0)], 1):
    frame = offset_image(rotate_image(kraken_base, angle), dx, 0)
    walk.append(save(frame, f"kraken_walk_{i}.png"))
kraken_frames["walk"] = walk

# ATTACK: 4 frames — lunge forward
attack = []
for i, (sx, dx) in enumerate([(1.0, 0), (1.15, 5), (1.2, 10), (1.0, 0)], 1):
    frame = offset_image(scale_image(kraken_base, sx, 1.0), dx, 0)
    attack.append(save(frame, f"kraken_attack_{i}.png"))
kraken_frames["attack"] = attack

# Common frames
common = generate_common_frames(kraken_base, "kraken")
kraken_frames.update(common)

manifest["kraken"] = kraken_frames
print(f"  Generated {sum(len(v) for v in kraken_frames.values())} frames")


# ============================================================
# 4. AKU AKU — single static image
# ============================================================
print("Processing Aku Aku...")
aku_full = Image.open(os.path.join(SPRITE_DIR, "aku_aku_mask_stylized.png"))
aku_full = ensure_rgba(aku_full)
aku_base = aku_full.resize((256, 256), Image.LANCZOS)

aku_frames = {}

# IDLE: 4 frames — floating bob
idle = []
for i, dy in enumerate([0, -3, 0, 3], 1):
    idle.append(save(offset_image(aku_base, 0, dy), f"aku_idle_{i}.png"))
aku_frames["idle"] = idle

# WALK: 4 frames — glide with wobble
walk = []
for i, (dx, angle) in enumerate([(-2, -2), (0, 1), (2, 2), (0, -1)], 1):
    frame = offset_image(rotate_image(aku_base, angle), dx, 0)
    walk.append(save(frame, f"aku_walk_{i}.png"))
aku_frames["walk"] = walk

# ATTACK: 3 frames — surge forward with scale
attack = []
for i, (sx, sy) in enumerate([(1.0, 1.0), (1.15, 1.05), (1.0, 1.0)], 1):
    attack.append(save(scale_image(aku_base, sx, sy), f"aku_attack_{i}.png"))
aku_frames["attack"] = attack

# Common frames
common = generate_common_frames(aku_base, "aku")
aku_frames.update(common)

manifest["aku"] = aku_frames
print(f"  Generated {sum(len(v) for v in aku_frames.values())} frames")


# ============================================================
# Write manifest
# ============================================================
manifest_path = os.path.join(OUT_DIR, "frame_manifest.json")
with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)

total = sum(sum(len(v) for v in char.values()) for char in manifest.values())
print(f"\nDone! {total} total frames saved to {OUT_DIR}")
print(f"Manifest written to {manifest_path}")
