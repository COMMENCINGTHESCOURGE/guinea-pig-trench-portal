"""Replace pitch inversion with spectral inversion in the chain notebook."""
import json

path = 'G:/My Drive/Guinea Pig Trench/colab/beat_chain_stretch_refine.ipynb'
with open(path, encoding='utf-8') as f:
    nb = json.load(f)

spectral_code = (
    "# ====================================================\n"
    "# SPECTRAL INVERSION\n"
    "# The low is high. The high is low. Flip the EQ curve.\n"
    "# Make the high HIGH and the low LOW.\n"
    "# Then compare to the original. The truth is between.\n"
    "# ====================================================\n"
    "\n"
    "def spectral_invert(y, sr):\n"
    "    mono = librosa.to_mono(y) if y.ndim > 1 else y\n"
    "    S = np.abs(librosa.stft(mono))\n"
    "    avg_energy = np.mean(S, axis=1, keepdims=True)\n"
    "    max_e = np.max(avg_energy)\n"
    "    eps = max_e * 0.01\n"
    "    inv_curve = (max_e / (avg_energy + eps)) ** 0.7\n"
    "    inv_curve = inv_curve / np.max(inv_curve)\n"
    "    S_complex = librosa.stft(mono)\n"
    "    inverted = librosa.istft(S_complex * inv_curve, length=len(mono))\n"
    "    peak = np.max(np.abs(inverted))\n"
    "    if peak > 0: inverted = inverted * (0.89 / peak)\n"
    "    return np.stack([inverted, inverted]) if y.ndim > 1 else inverted\n"
    "\n"
    "def spectral_crossfade(original, inverted, sr, blend=0.5):\n"
    "    orig = librosa.to_mono(original) if original.ndim > 1 else original\n"
    "    inv = librosa.to_mono(inverted) if inverted.ndim > 1 else inverted\n"
    "    m = min(len(orig), len(inv))\n"
    "    blended = orig[:m] * (1 - blend) + inv[:m] * blend\n"
    "    peak = np.max(np.abs(blended))\n"
    "    if peak > 0: blended = blended * (0.89 / peak)\n"
    "    return blended\n"
    "\n"
    "print('Spectral inversion ready')\n"
    "print('Low becomes low. High becomes high. Blend = the truth.')"
)

spectral_cell = {
    'cell_type': 'code',
    'metadata': {},
    'source': spectral_code,
    'execution_count': None,
    'outputs': []
}

# Replace old pitch inversion or insert new
replaced = False
for i, cell in enumerate(nb['cells']):
    src = cell.get('source', '')
    if 'INVERT' in src and 'def invert_pitch' in src:
        nb['cells'][i] = spectral_cell
        replaced = True
        print(f'Replaced old inversion at index {i}')
        break

if not replaced:
    nb['cells'].insert(6, spectral_cell)
    print('Inserted spectral inversion at index 6')

# Update batch processing to use spectral inversion
for i, cell in enumerate(nb['cells']):
    src = cell.get('source', '')
    if 'BATCH: Refine all stretched beats' in src:
        # Replace any old inversion references
        if 'invert_pitch' in src:
            cell['source'] = src.replace('invert_pitch', 'spectral_invert')
            cell['source'] = cell['source'].replace('cross_pollinate', 'spectral_crossfade')
            cell['source'] = cell['source'].replace('blend=0.15', 'blend=0.5')
            print(f'Updated batch cell at index {i}')
        elif 'Heal seams' in src and 'spectral_invert' not in src:
            # Add spectral inversion step
            old = '        # Heal seams'
            new = (
                "        # Spectral inversion: flip the EQ\n"
                "        print(f'  Spectral inversion...')\n"
                "        y_work = y_pitched if 'y_pitched' in dir() else y\n"
                "        if y_work.ndim == 1: y_work = np.stack([y_work, y_work])\n"
                "        y_inverted = spectral_invert(y_work, sr)\n"
                "        print(f'  Blending 50/50 original + inverted...')\n"
                "        y_blended = spectral_crossfade(y_work, y_inverted, sr, blend=0.5)\n"
                "        if y_blended.ndim == 1: y_blended = np.stack([y_blended, y_blended])\n"
                "        # Save comparison\n"
                "        base_name = os.path.splitext(filename)[0]\n"
                "        sf.write(os.path.join(OUTPUT_DIR, f'{base_name}_eq_inverted.wav'),\n"
                "                 librosa.to_mono(y_inverted) if y_inverted.ndim > 1 else y_inverted, sr)\n"
                "        sf.write(os.path.join(OUTPUT_DIR, f'{base_name}_eq_blended.wav'),\n"
                "                 librosa.to_mono(y_blended) if y_blended.ndim > 1 else y_blended, sr)\n"
                "        y_pollinated = y_blended\n"
                "\n"
                "        # Heal seams"
            )
            cell['source'] = cell['source'].replace(old, new)
            # Update seam healer input
            cell['source'] = cell['source'].replace(
                'y_healed = heal_seams(y_pitched',
                'y_healed = heal_seams(y_pollinated'
            )
            print(f'Added spectral inversion to batch at index {i}')
        break

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print(f'Done. {len(nb["cells"])} cells.')
print()
print('CHAIN:')
print('  STRETCHED -> PITCH CORRECT -> SPECTRAL INVERT -> BLEND 50/50 -> HEAL SEAMS -> REFINE -> OUTPUT')
print()
print('Per beat outputs:')
print('  _eq_inverted.wav  (high is high, low is low)')
print('  _eq_blended.wav   (50/50 original + inverted = balanced)')
print('  _final.wav        (blended + healed + refined)')
