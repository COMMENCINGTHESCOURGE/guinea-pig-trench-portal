"""
CROSS-POLLINATE: Inject audio feedback + particle systems into games that lack them.
Context clues say: most games have no sound and no particles.
The Threshold baseline requires both.
"""
import os
import re

GAMES_DIR = os.path.dirname(os.path.abspath(__file__))

# Audio engine — Web Audio API tone generator
AUDIO_INJECT = """
// -- THRESHOLD AUDIO ENGINE --
var _thAudioCtx;
function thTone(freq, dur, type, vol) {
  if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var o = _thAudioCtx.createOscillator();
  var g = _thAudioCtx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq || 440;
  o.detune.value = (Math.random() - 0.5) * 10; // happy little mistake
  g.gain.setValueAtTime((vol || 0.1), _thAudioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, _thAudioCtx.currentTime + (dur || 0.2));
  o.connect(g); g.connect(_thAudioCtx.destination);
  o.start(); o.stop(_thAudioCtx.currentTime + (dur || 0.2));
}
function thClick() { thTone(800, 0.06, 'sine', 0.08); }
function thSuccess() { thTone(523, 0.1, 'sine', 0.12); setTimeout(function(){thTone(659, 0.1, 'sine', 0.12)}, 70); setTimeout(function(){thTone(784, 0.15, 'triangle', 0.1)}, 140); }
function thFail() { thTone(200, 0.15, 'sawtooth', 0.06); }
function thPickup() { thTone(880, 0.08, 'sine', 0.1); setTimeout(function(){thTone(1100, 0.12, 'sine', 0.08)}, 50); }
document.addEventListener('click', function() { if (!_thAudioCtx) _thAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); }, {once: true});
"""

# Simple particle system
PARTICLE_INJECT = """
// -- THRESHOLD PARTICLE SYSTEM --
var _thParticles = [];
function thSpawnParticles(x, y, count, color) {
  for (var i = 0; i < (count || 8); i++) {
    _thParticles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1,
      color: color || '#00ffd2',
      size: 2 + Math.random() * 3
    });
  }
}
function thUpdateParticles(ctx) {
  for (var i = _thParticles.length - 1; i >= 0; i--) {
    var p = _thParticles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05; // gravity
    p.vx *= 0.98;
    p.life -= 0.025;
    if (p.life <= 0) { _thParticles.splice(i, 1); continue; }
    if (ctx) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
"""

# Games that need audio (have NO audio currently)
NEEDS_AUDIO = [
    'dice_roller.html', 'candy_crush.html', 'fractal_crush.html',
    'stealth_maze.html', 'bloom_meadow.html', 'sand_garden.html',
    'void_runner.html', 'sprite_brawler.html', 'trench_story.html',
    'dungeon_shooter.html', 'terrain_walker.html',
]

# Games that need particles (have NO particles currently)
NEEDS_PARTICLES = [
    'dice_roller.html', 'hex_cards.html', 'stealth_maze.html',
    'bloom_meadow.html',
]

def inject(filepath, code_block, marker):
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    if marker in content:
        return False  # already injected

    # Inject before the FIRST </script> tag
    if '</script>' in content:
        # Find the first script block and inject at the start of it
        content = content.replace('</body>',
            f'<script>\n{code_block}\n</script>\n</body>', 1)
    elif '</html>' in content:
        content = content.replace('</html>',
            f'<script>\n{code_block}\n</script>\n</html>', 1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def main():
    print('CROSS-POLLINATE: Audio + Particles')
    print('='*50)

    audio_count = 0
    for game in NEEDS_AUDIO:
        path = os.path.join(GAMES_DIR, game)
        if os.path.exists(path):
            if inject(path, AUDIO_INJECT, 'THRESHOLD AUDIO ENGINE'):
                audio_count += 1
                print(f'  [AUDIO] {game}')

    particle_count = 0
    for game in NEEDS_PARTICLES:
        path = os.path.join(GAMES_DIR, game)
        if os.path.exists(path):
            if inject(path, PARTICLE_INJECT, 'THRESHOLD PARTICLE SYSTEM'):
                particle_count += 1
                print(f'  [PARTICLES] {game}')

    print(f'\nAudio injected: {audio_count} games')
    print(f'Particles injected: {particle_count} games')
    print(f'\nAvailable functions in injected games:')
    print(f'  thClick()    - UI click feedback')
    print(f'  thSuccess()  - win/collect/complete')
    print(f'  thFail()     - miss/lose/damage')
    print(f'  thPickup()   - item collected')
    print(f'  thTone(freq, dur, type, vol) - custom tone')
    print(f'  thSpawnParticles(x, y, count, color)')
    print(f'  thUpdateParticles(ctx)')


if __name__ == '__main__':
    main()
