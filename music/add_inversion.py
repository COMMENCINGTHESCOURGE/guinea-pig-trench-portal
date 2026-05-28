"""Add inversion + cross-pollination + tempo variants to the chain notebook."""
import json

path = 'G:/My Drive/Guinea Pig Trench/colab/beat_chain_stretch_refine.ipynb'
with open(path, encoding='utf-8') as f:
    nb = json.load(f)

invert_cell = {
    'cell_type': 'code',
    'metadata': {},
    'source': """# ====================================================
# INVERT + CROSS-POLLINATE + TEMPO VARIANTS
# Correct version. Wrong version. The between.
# Then: uptempo and downtempo variants of each.
# ====================================================

def invert_pitch(y, sr, filename):
    root, mode = parse_key_from_filename(filename)
    if root is None:
        return y
    mono = librosa.to_mono(y) if y.ndim > 1 else y
    harmonic, percussive = librosa.effects.hpss(mono, margin=3.0)
    pitches, magnitudes = librosa.piptrack(y=harmonic, sr=sr, fmin=50, fmax=4000)
    corrections = []
    for t in range(pitches.shape[1]):
        idx = magnitudes[:, t].argmax()
        pitch = pitches[idx, t]
        if pitch > 0 and magnitudes[idx, t] > 0.01:
            corrections.append(snap_pitch_to_scale(pitch, root, mode))
    nonzero = [c for c in corrections if c != 0]
    if not nonzero:
        shift = 6
    else:
        from collections import Counter
        dominant = Counter([round(c) for c in nonzero]).most_common(1)[0][0]
        shift = -dominant if dominant != 0 else 3
    print(f'    Inversion: {shift:+d} semitones')
    inv = librosa.effects.pitch_shift(harmonic, sr=sr, n_steps=shift)
    result = inv + percussive
    peak = np.max(np.abs(result))
    if peak > 0:
        result = result * (0.89 / peak)
    return np.stack([result, result]) if y.ndim > 1 else result


def cross_pollinate(correct, inverted, sr, blend=0.15):
    if correct.ndim > 1:
        min_len = min(correct.shape[1], inverted.shape[1] if inverted.ndim > 1 else len(inverted))
        correct = correct[:, :min_len]
        inverted = inverted[:, :min_len] if inverted.ndim > 1 else np.stack([inverted[:min_len]]*2)
    else:
        min_len = min(len(correct), len(inverted))
        correct = correct[:min_len]
        inverted = inverted[:min_len]
    t = np.linspace(0, min_len / sr, min_len)
    mod = blend * (0.5 + 0.3*np.sin(2*np.pi*t/0.7) + 0.15*np.sin(2*np.pi*t/3.2) + 0.05*np.sin(2*np.pi*t/0.23))
    mod = np.clip(mod, 0, 0.4)
    if correct.ndim > 1:
        result = correct * (1-mod[np.newaxis,:]) + inverted * mod[np.newaxis,:]
    else:
        result = correct * (1-mod) + inverted * mod
    peak = np.max(np.abs(result))
    if peak > 0:
        result = result * (0.89 / peak)
    return result


def make_tempo_variants(y, sr, original_bpm):
    variants = {}
    # Uptempo: +15% faster (upbeat)
    up_rate = 1.15
    variants['uptempo'] = librosa.effects.time_stretch(
        librosa.to_mono(y) if y.ndim > 1 else y, rate=up_rate)
    # Downtempo: -20% slower (downtempo)
    down_rate = 0.80
    variants['downtempo'] = librosa.effects.time_stretch(
        librosa.to_mono(y) if y.ndim > 1 else y, rate=down_rate)
    # Halftime: exactly half speed
    variants['halftime'] = librosa.effects.time_stretch(
        librosa.to_mono(y) if y.ndim > 1 else y, rate=0.5)
    for k, v in variants.items():
        peak = np.max(np.abs(v))
        if peak > 0:
            variants[k] = v * (0.89 / peak)
    up_bpm = round(original_bpm * up_rate)
    down_bpm = round(original_bpm * down_rate)
    half_bpm = round(original_bpm * 0.5)
    print(f'    Uptempo: {up_bpm} BPM | Downtempo: {down_bpm} BPM | Halftime: {half_bpm} BPM')
    return variants


def parse_bpm_from_filename(filename):
    parts = filename.lower().replace('.wav','').replace('.mp3','').split('_')
    for p in parts:
        try:
            v = int(p)
            if 50 <= v <= 250:
                return v
        except ValueError:
            pass
    return 120

print('Inversion + cross-pollination + tempo variants ready')
print('Upbeat. Downbeat. The between.')""",
    'execution_count': None,
    'outputs': []
}

# Insert after pitcher
inserted = False
for i, cell in enumerate(nb['cells']):
    src = cell.get('source', '')
    if 'Pitcher ready' in src or 'pitch correction to key' in src:
        nb['cells'].insert(i+1, invert_cell)
        inserted = True
        print(f'Inserted invert+tempo cell after index {i}')
        break

if not inserted:
    nb['cells'].insert(6, invert_cell)
    print('Inserted at index 6')

# Update batch cell to use the new functions
for i, cell in enumerate(nb['cells']):
    src = cell.get('source', '')
    if 'BATCH: Refine all stretched beats' in src:
        # Add after pitch correction, before seam healing
        if 'Heal seams' in src and 'invert_pitch' not in src:
            old_marker = '        # Heal seams'
            new_block = """        # Invert + cross-pollinate
        print(f'  Generating inverted version...')
        y_inverted = invert_pitch(y_pitched if 'y_pitched' in dir() else y, sr, filename)
        if y_inverted.ndim == 1:
            y_inverted = np.stack([y_inverted, y_inverted])

        print(f'  Cross-pollinating (15%% blend, heartbeat modulated)...')
        y_correct = y_pitched if 'y_pitched' in dir() else y
        if y_correct.ndim == 1:
            y_correct = np.stack([y_correct, y_correct])
        y_pollinated = cross_pollinate(y_correct, y_inverted, sr, blend=0.15)
        if y_pollinated.ndim == 1:
            y_pollinated = np.stack([y_pollinated, y_pollinated])

        # Tempo variants
        print(f'  Generating tempo variants...')
        bpm = parse_bpm_from_filename(filename)
        mono_poll = librosa.to_mono(y_pollinated) if y_pollinated.ndim > 1 else y_pollinated
        tempo_vars = make_tempo_variants(y_pollinated, sr, bpm)
        base_name = os.path.splitext(filename)[0]
        for var_name, var_audio in tempo_vars.items():
            sf.write(os.path.join(OUTPUT_DIR, f'{base_name}_{var_name}.wav'), var_audio, sr)
        print(f'  Saved: uptempo + downtempo + halftime')

        # Heal seams on the pollinated version"""
            cell['source'] = cell['source'].replace(old_marker, new_block)

            # Update seam healer input
            cell['source'] = cell['source'].replace(
                'y_healed = heal_seams(y_pitched',
                'y_healed = heal_seams(y_pollinated')
            print(f'Updated batch cell at index {i}')
        break

with open(path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print(f'Done. {len(nb["cells"])} cells.')
print()
print('FULL CHAIN:')
print('  STRETCHED BEAT')
print('    -> PITCH CORRECT (snap to key)')
print('    -> INVERT PITCH (opposite direction)')
print('    -> CROSS-POLLINATE (blend at 0.7s heartbeat)')
print('    -> TEMPO VARIANTS (uptempo +15%, downtempo -20%, halftime 50%)')
print('    -> HEAL SEAMS')
print('    -> SMOOTH LOOPS')
print('    -> REFINE EQ')
print('    -> FINAL OUTPUT')
print()
print('Outputs per beat:')
print('  _final.wav       (the full chain)')
print('  _uptempo.wav     (upbeat version)')
print('  _downtempo.wav   (slow version)')
print('  _halftime.wav    (half speed)')
