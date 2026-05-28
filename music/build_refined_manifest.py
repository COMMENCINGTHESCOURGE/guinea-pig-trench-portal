"""
Build music manifest for the portal from refined beats.
Maps each beat to a biome and color from the Five Worlds.
"""
import os
import json
import hashlib

REFINED_DIR = os.path.join(os.path.dirname(__file__), 'refined')
MANIFEST_PATH = os.path.join(os.path.dirname(__file__), 'manifest.json')

# Five Worlds biome rotation
BIOMES = [
    {"biome": "pink_hour", "color": [255, 102, 170]},
    {"biome": "the_block", "color": [0, 255, 157]},
    {"biome": "the_threshold", "color": [0, 184, 200]},
    {"biome": "vault_compound_7", "color": [255, 136, 51]},
    {"biome": "the_between", "color": [102, 136, 255]},
    {"biome": "radiant_void", "color": [255, 255, 255]},
    {"biome": "dark_forest", "color": [0, 200, 180]},
    {"biome": "underwater_cave", "color": [80, 40, 120]},
    {"biome": "cyberpunk_factory", "color": [0, 200, 180]},
    {"biome": "surreal_volcanic", "color": [150, 30, 30]},
]


def clean_title(filename):
    """Extract a readable title from the filename."""
    name = filename.replace('_refined.mp3', '').replace('_refined.wav', '')
    # Remove common prefixes
    for prefix in ['beats_', 'beat_', 'bump_', 'drops_', 'sound_', 'music_',
                   'tunes_', 'audio_', 'itsthe_', 'itsThe_', 'the_', 'The_',
                   'flstudio_', 'yeye_', 'Yeye_', 'bass_', 'boompap_',
                   '420_', 'scaryt_', 'bumppaintart_']:
        while name.startswith(prefix):
            name = name[len(prefix):]
        name = name.replace(prefix, ' ')

    # Clean up
    name = name.replace('_', ' ').replace('  ', ' ').strip()
    # Capitalize words
    name = ' '.join(w.capitalize() for w in name.split() if len(w) > 1)
    # Truncate
    if len(name) > 40:
        name = name[:40].rsplit(' ', 1)[0]
    return name if name else 'Untitled'


def main():
    if not os.path.exists(REFINED_DIR):
        print(f'No refined directory at {REFINED_DIR}')
        return

    mp3s = sorted([f for f in os.listdir(REFINED_DIR) if f.endswith('.mp3')])
    print(f'Found {len(mp3s)} refined MP3s')

    # Load existing manifest to preserve synth tracks
    existing = {"tracks": [], "count": 0, "categories": []}
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH) as f:
            existing = json.load(f)

    # Keep synth tracks
    synth_tracks = [t for t in existing.get('tracks', []) if t.get('category') == 'SYNTH']

    # Build refined tracks
    refined_tracks = []
    for i, mp3 in enumerate(mp3s):
        biome_info = BIOMES[i % len(BIOMES)]
        title = clean_title(mp3)

        refined_tracks.append({
            "file": f"refined/{mp3}",
            "title": title,
            "category": "REFINED",
            "biome": biome_info["biome"],
            "color": biome_info["color"],
            "index": i,
        })

    # Combine: refined first, then synth
    all_tracks = refined_tracks + synth_tracks
    # Re-index
    for i, t in enumerate(all_tracks):
        t["index"] = i

    manifest = {
        "tracks": all_tracks,
        "count": len(all_tracks),
        "categories": ["REFINED", "SYNTH"],
    }

    with open(MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f'Manifest updated: {len(refined_tracks)} refined + {len(synth_tracks)} synth = {len(all_tracks)} total')
    print(f'Saved: {MANIFEST_PATH}')


if __name__ == '__main__':
    main()
