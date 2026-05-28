"""
BEAT REFINEMENT ENGINE — The Threshold Standard
Void for valleys. Neon for surface. Happy little mistakes.

These AI synth beats are 99% low end. They need:
- Low cut: carve the mud
- Mid presence: bring out the body
- High air: add the neon sparkle
- Stereo width: spread the field
- Saturation: add harmonic warmth (the happy little mistake)
- Dilla swing: micro-timing humanization
"""

import librosa
import numpy as np
import soundfile as sf
import os

INPUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(INPUT_DIR, 'refined')
os.makedirs(OUTPUT_DIR, exist_ok=True)

BEATS = [
    'synth_v4_100_E_minor_4.mp3',
    'synth_v4_110_A_minor_4.mp3',
    'synth_v4_120_D_major_4.mp3',
    'synth_v4_130_G_minor_4.mp3',
]


def high_pass(y, sr, cutoff=80):
    """Remove sub-bass rumble below cutoff Hz."""
    from scipy.signal import butter, sosfilt
    sos = butter(4, cutoff, btype='high', fs=sr, output='sos')
    return sosfilt(sos, y)


def low_shelf_cut(y, sr, freq=200, gain_db=-4):
    """Reduce low-mid mud."""
    from scipy.signal import butter, sosfilt
    sos = butter(2, freq, btype='low', fs=sr, output='sos')
    low = sosfilt(sos, y)
    gain = 10 ** (gain_db / 20)
    return y - low * (1 - gain)


def high_shelf_boost(y, sr, freq=8000, gain_db=4):
    """Add high-end air and presence."""
    from scipy.signal import butter, sosfilt
    sos = butter(2, freq, btype='high', fs=sr, output='sos')
    high = sosfilt(sos, y)
    gain = 10 ** (gain_db / 20) - 1
    return y + high * gain


def mid_presence(y, sr, low_freq=800, high_freq=4000, gain_db=3):
    """Boost midrange presence — the vocal/instrument body."""
    from scipy.signal import butter, sosfilt
    sos_low = butter(2, low_freq, btype='high', fs=sr, output='sos')
    sos_high = butter(2, high_freq, btype='low', fs=sr, output='sos')
    mid = sosfilt(sos_high, sosfilt(sos_low, y))
    gain = 10 ** (gain_db / 20) - 1
    return y + mid * gain


def soft_saturate(y, amount=0.3):
    """Warm saturation — adds harmonics. The happy little mistake."""
    return np.tanh(y * (1 + amount)) / (1 + amount)


def stereo_widen(left, right, amount=0.3):
    """Widen the stereo field using mid-side processing."""
    mid = (left + right) / 2
    side = (left - right) / 2
    side *= (1 + amount)
    return mid + side, mid - side


def add_air(y, sr, amount=0.002):
    """Add subtle high-frequency noise — texture, life, grain."""
    noise = np.random.normal(0, amount, len(y))
    from scipy.signal import butter, sosfilt
    sos = butter(2, 10000, btype='high', fs=sr, output='sos')
    noise = sosfilt(sos, noise)
    return y + noise


def normalize(y, target_db=-1):
    """Peak normalize to target dB."""
    peak = np.max(np.abs(y))
    if peak < 1e-6:
        return y
    target = 10 ** (target_db / 20)
    return y * (target / peak)


def refine_beat(filename):
    """Full refinement pipeline for one beat."""
    print(f'\nRefining: {filename}')
    print(f'  {"="*45}')

    filepath = os.path.join(INPUT_DIR, filename)
    y, sr = librosa.load(filepath, sr=44100, mono=False)

    # If mono, duplicate to stereo
    if y.ndim == 1:
        y = np.stack([y, y])

    left, right = y[0], y[1]
    print(f'  Loaded: {len(left)/sr:.1f}s, {sr}Hz, stereo')

    # 1. High-pass: cut the sub-bass rumble
    left = high_pass(left, sr, cutoff=60)
    right = high_pass(right, sr, cutoff=60)
    print(f'  High-pass @ 60Hz (cut the mud floor)')

    # 2. Low shelf: reduce 200Hz mud
    left = low_shelf_cut(left, sr, freq=200, gain_db=-3)
    right = low_shelf_cut(right, sr, freq=200, gain_db=-3)
    print(f'  Low shelf -3dB @ 200Hz (carve the void)')

    # 3. Mid presence: boost 800-4000Hz
    left = mid_presence(left, sr, low_freq=800, high_freq=4000, gain_db=4)
    right = mid_presence(right, sr, low_freq=800, high_freq=4000, gain_db=4)
    print(f'  Mid presence +4dB @ 800-4kHz (the body)')

    # 4. High shelf: add air
    left = high_shelf_boost(left, sr, freq=8000, gain_db=5)
    right = high_shelf_boost(right, sr, freq=8000, gain_db=5)
    print(f'  High shelf +5dB @ 8kHz (neon surface)')

    # 5. Saturation: warm harmonics
    left = soft_saturate(left, amount=0.25)
    right = soft_saturate(right, amount=0.25)
    print(f'  Soft saturation 0.25 (happy little mistake)')

    # 6. Stereo widening
    left, right = stereo_widen(left, right, amount=0.35)
    print(f'  Stereo widen 0.35 (spread the field)')

    # 7. Air/texture
    left = add_air(left, sr, amount=0.001)
    right = add_air(right, sr, amount=0.001)
    print(f'  Air noise @ 10kHz+ (grain/texture)')

    # 8. Normalize
    stereo = np.stack([left, right])
    peak = np.max(np.abs(stereo))
    if peak > 0:
        stereo = stereo * (0.89 / peak)  # -1dB peak
    print(f'  Normalized to -1dB peak')

    # Export
    out_name = filename.replace('.mp3', '_refined.wav')
    out_path = os.path.join(OUTPUT_DIR, out_name)
    sf.write(out_path, stereo.T, sr)
    print(f'  Exported: {out_name}')

    # Quick analysis of result
    y_out = librosa.to_mono(stereo)
    S = np.abs(librosa.stft(y_out))
    freqs = librosa.fft_frequencies(sr=sr)
    low = np.mean(S[freqs < 250, :])
    mid = np.mean(S[(freqs >= 250) & (freqs < 4000), :])
    high = np.mean(S[freqs >= 4000, :])
    total = low + mid + high
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y_out, sr=sr)[0]))

    print(f'  Result: Low {low/total*100:.1f}% / Mid {mid/total*100:.1f}% / High {high/total*100:.1f}%')
    print(f'  Centroid: {centroid:.0f}Hz (was ~500-1000Hz, target >1500Hz)')

    return out_path


def main():
    print('BEAT REFINEMENT ENGINE')
    print('Void for valleys. Neon for surface. Happy little mistakes.')
    print('The Threshold standard applied to audio.')

    refined = []
    for beat in BEATS:
        try:
            path = refine_beat(beat)
            refined.append(path)
        except Exception as e:
            print(f'  ERROR: {e}')

    print(f'\n{"="*50}')
    print(f'REFINEMENT COMPLETE')
    print(f'{"="*50}')
    print(f'Refined: {len(refined)} / {len(BEATS)} beats')
    print(f'Output: {OUTPUT_DIR}')
    for p in refined:
        print(f'  {os.path.basename(p)}')


if __name__ == '__main__':
    main()
