"""
CROSS-POLLINATE ALL GAMES x4 RANDOM PASSES
Inject The Threshold DNA into every game on the portal.

Each pass injects:
1. Five-world color system (CSS variables)
2. Vignette overlay
3. 0.7s heartbeat pulse
4. World name indicator
5. Film grain

4 passes with randomized parameters = each game gets a unique variant
of The Threshold standard. Happy little mistakes in the randomization.
"""

import os
import re
import random
import json

GAMES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)))
SKIP = ['cross_pollinate_all.py', 'dungeon_shooter_backup.html',
        'negative_bloom_vortex.py', 'neon_vortex.py', 'linchpin.py']

# The Five Worlds
WORLDS = [
    {"name": "PINK HOUR", "bg": "#1e0818", "accent": "#ff66aa", "fog": "rgba(30,10,25,{a})", "vim": "rgba(30,8,20,0.35)"},
    {"name": "THE BLOCK", "bg": "#021a10", "accent": "#00ff9d", "fog": "rgba(5,20,12,{a})", "vim": "rgba(5,15,10,0.35)"},
    {"name": "THE THRESHOLD", "bg": "#020a14", "accent": "#00b8c8", "fog": "rgba(8,22,50,{a})", "vim": "rgba(4,10,20,0.35)"},
    {"name": "VAULT COMPOUND 7", "bg": "#140a02", "accent": "#ff8833", "fog": "rgba(25,15,5,{a})", "vim": "rgba(20,10,4,0.35)"},
    {"name": "THE BETWEEN", "bg": "#000210", "accent": "#6688ff", "fog": "rgba(2,4,18,{a})", "vim": "rgba(0,2,12,0.35)"},
]

def build_threshold_injection(world, pass_num):
    """Build the JS/CSS to inject into a game file."""

    # Randomize parameters per pass
    heartbeat_period = 0.7 + random.uniform(-0.05, 0.05)  # ~0.7s with slight variation
    vignette_strength = 0.3 + random.uniform(0, 0.15)
    grain_amount = 0.012 + random.uniform(0, 0.008)
    pulse_color = world["accent"]
    world_name = world["name"]

    # CSS injection
    css = f"""
/* -- THE THRESHOLD (pass {pass_num}) -- */
#threshold-overlay {{
  position: fixed; inset: 0; z-index: 9998; pointer-events: none;
}}
#threshold-vignette {{
  position: fixed; inset: 0; z-index: 9997; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, {world["vim"]});
}}
#threshold-world-name {{
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  z-index: 9999; pointer-events: none;
  color: {world["accent"]}; opacity: 0.4;
  font-family: 'Courier New', monospace; font-size: 10px;
  letter-spacing: 0.3em; text-transform: uppercase;
}}
#threshold-heartbeat {{
  position: fixed; inset: 0; z-index: 9996; pointer-events: none;
  background: {world["accent"]}; opacity: 0;
  transition: opacity 0.05s;
}}
"""

    # JS injection
    js = f"""
// -- THE THRESHOLD CROSS-POLLINATION (pass {pass_num}) --
(function() {{
  // Vignette
  var vig = document.createElement('div');
  vig.id = 'threshold-vignette';
  document.body.appendChild(vig);

  // World name
  var wn = document.createElement('div');
  wn.id = 'threshold-world-name';
  wn.textContent = '{world_name}';
  document.body.appendChild(wn);

  // Heartbeat overlay
  var hb = document.createElement('div');
  hb.id = 'threshold-heartbeat';
  document.body.appendChild(hb);

  // 0.7s heartbeat pulse
  var hbPeriod = {heartbeat_period};
  setInterval(function() {{
    hb.style.opacity = '0.06';
    setTimeout(function() {{ hb.style.opacity = '0'; }}, 80);
  }}, hbPeriod * 1000);

  // Film grain canvas
  var grainCanvas = document.createElement('canvas');
  grainCanvas.style.cssText = 'position:fixed;inset:0;z-index:9995;pointer-events:none;opacity:{grain_amount};mix-blend-mode:overlay';
  document.body.appendChild(grainCanvas);
  function updateGrain() {{
    grainCanvas.width = window.innerWidth;
    grainCanvas.height = window.innerHeight;
    var ctx = grainCanvas.getContext('2d');
    var imageData = ctx.createImageData(grainCanvas.width, grainCanvas.height);
    var data = imageData.data;
    for (var i = 0; i < data.length; i += 16) {{
      var v = Math.random() * 255;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 40;
    }}
    ctx.putImageData(imageData, 0, 0);
  }}
  setInterval(updateGrain, 100);
  updateGrain();
}})();
"""
    return css, js


def inject_into_game(filepath, css, js):
    """Inject CSS and JS into an HTML game file."""
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    # Skip if already cross-pollinated
    if 'THE THRESHOLD CROSS-POLLINATION' in content:
        return False

    # Inject CSS before </style> or before </head>
    if '</style>' in content:
        content = content.replace('</style>', css + '\n</style>', 1)
    elif '</head>' in content:
        content = content.replace('</head>', '<style>' + css + '</style>\n</head>', 1)

    # Inject JS before </body> or </script> at the end
    if '</body>' in content:
        content = content.replace('</body>', '<script>' + js + '</script>\n</body>', 1)
    elif '</html>' in content:
        content = content.replace('</html>', '<script>' + js + '</script>\n</html>', 1)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    return True


def main():
    random.seed(42)  # Reproducible but random

    games = [f for f in os.listdir(GAMES_DIR)
             if f.endswith('.html') and f not in SKIP and 'backup' not in f]
    games.sort()

    print(f'CROSS-POLLINATE ALL GAMES x4')
    print(f'{"="*55}')
    print(f'Games: {len(games)}')
    print(f'Worlds: {len(WORLDS)}')
    print(f'Passes: 4')
    print()

    results = []

    for pass_num in range(1, 5):
        print(f'-- PASS {pass_num} --')
        # Shuffle world assignments each pass
        shuffled_worlds = list(WORLDS)
        random.shuffle(shuffled_worlds)

        injected = 0
        for i, game in enumerate(games):
            filepath = os.path.join(GAMES_DIR, game)
            world = shuffled_worlds[i % len(shuffled_worlds)]

            if pass_num > 1:
                # Passes 2-4: only inject if not already done
                with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                    if 'THE THRESHOLD CROSS-POLLINATION' in f.read():
                        continue

            css, js = build_threshold_injection(world, pass_num)
            if inject_into_game(filepath, css, js):
                injected += 1
                results.append({"game": game, "world": world["name"], "pass": pass_num})
                if injected <= 8 or injected % 5 == 0:
                    print(f'  [{injected:2d}] {game[:40]:40s} <- {world["name"]}')

        print(f'  Pass {pass_num}: {injected} games injected')
        print()

    print(f'{"="*55}')
    print(f'CROSS-POLLINATION COMPLETE')
    print(f'Total injections: {len(results)}')
    print(f'{"="*55}')

    # Save manifest
    with open(os.path.join(GAMES_DIR, 'threshold_manifest.json'), 'w') as f:
        json.dump(results, f, indent=2)


if __name__ == '__main__':
    main()
