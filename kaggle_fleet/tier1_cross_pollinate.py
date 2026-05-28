"""
TIER 1 CROSS-POLLINATION — Kaggle Fleet
Erdos fashion: one kernel per gap, parallel execution.

CONTEXT CLUES — what each game HAS vs NEEDS:

THE THRESHOLD:  HAS lore,sprites,worlds  NEEDS audio,controls,screenshot,music
AKU SHRINE:     HAS raymarching          NEEDS audio,lore,controls,screenshot,music
MANDELBULB:     HAS controls,export      NEEDS audio,sprites,lore,music
FRACTAL SCULPT: HAS controls,export,spr  NEEDS audio,lore,music
BOULDER BUILD:  HAS controls,sprites     NEEDS audio,export,screenshot,music

UNIVERSAL GAPS (every game needs):
1. Audio engine (Web Audio API tones for events)
2. Screenshot/export (canvas capture to PNG download)
3. Music integration (load and play from the 106 refined beats)
4. Lore fragments (from the design bible, shown contextually)
5. Shared controls hint overlay
"""

import json
import os
import base64
import urllib.request

with open(os.path.expanduser('~/.kaggle/kaggle.json')) as f:
    creds = json.load(f)
AUTH = base64.b64encode(f"{creds['username']}:{creds['key']}".encode()).decode()


def make_nb(cells_list):
    nb = {
        "nbformat": 4, "nbformat_minor": 4,
        "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                      "language_info": {"name": "python", "version": "3.10.0"}},
        "cells": []
    }
    for cell_type, src in cells_list:
        if cell_type == 'md':
            nb['cells'].append({"cell_type": "markdown", "metadata": {}, "source": src})
        else:
            nb['cells'].append({"cell_type": "code", "metadata": {}, "source": src, "execution_count": None, "outputs": []})
    return json.dumps(nb)


def push(title, nb_text):
    payload = {
        "newTitle": title, "text": nb_text,
        "language": "python", "kernelType": "notebook",
        "isPrivate": True, "enableGpu": False, "enableTpu": False, "enableInternet": True,
        "datasetDataSources": [], "competitionDataSources": [], "kernelDataSources": [], "categoryIds": [],
    }
    req = urllib.request.Request(
        'https://www.kaggle.com/api/v1/kernels/push',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Basic {AUTH}'},
        method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode())
            return f"v{result.get('versionNumber')} {result.get('url','')}"
    except urllib.error.HTTPError as e:
        return f"ERROR {e.code}: {e.read().decode()[:100]}"


# ═══════════════════════════════════════════════
# KERNEL 1: Audio Engine Research
# What sounds should each game make?
# ═══════════════════════════════════════════════
K1 = make_nb([
    ('md', """# Tier 1 Audio Engine — Context-Driven Sound Design
## What should each game SOUND like?

Context clues: The Threshold cycles through 5 worlds. Each world has a palette. Each world should have a SOUNDSCAPE.

| World | Visual | Sound Profile |
|---|---|---|
| Pink Hour | Magenta bloom, pillars | Warm pads, soft resonance, feminine |
| The Block | Neon city, concrete | Hard percussion, bass stabs, urban |
| The Threshold | Stone temple, water | Low drones, dripping, reverb caves |
| Vault Compound 7 | Amber metal, sensors | Industrial hum, 0.7s heartbeat, alarm tones |
| The Between | Void, absence | Silence shaped like something — reversed reverb, negative space |

Each Tier 1 game gets a tailored audio palette from its world assignment."""),
    ('code', """import numpy as np
import json

# Define audio events per game
audio_specs = {
    'the_threshold': {
        'world_ambient': {
            'pink_hour': {'freq': 440, 'type': 'sine', 'vol': 0.03, 'dur': 4.0, 'desc': 'Warm pad drone'},
            'the_block': {'freq': 110, 'type': 'square', 'vol': 0.04, 'dur': 0.5, 'desc': 'Bass stab'},
            'the_threshold': {'freq': 80, 'type': 'sine', 'vol': 0.02, 'dur': 6.0, 'desc': 'Temple drone'},
            'vault': {'freq': 200, 'type': 'sawtooth', 'vol': 0.03, 'dur': 0.7, 'desc': 'Industrial pulse'},
            'the_between': {'freq': 60, 'type': 'sine', 'vol': 0.01, 'dur': 8.0, 'desc': 'Void whisper'},
        },
        'transition': {'freq': 523, 'dur': 0.3, 'type': 'triangle', 'desc': 'World change chime'},
    },
    'aku_shrine': {
        'ambient': {'freq': 65, 'type': 'sine', 'vol': 0.02, 'dur': 8.0, 'desc': 'Temple low drone'},
        'tentacle_move': {'freq': 120, 'dur': 0.4, 'type': 'sine', 'desc': 'Organic movement'},
        'gem_pulse': {'freq': 880, 'dur': 0.15, 'type': 'sine', 'desc': 'Crystal ping'},
        'mushroom_glow': {'freq': 660, 'dur': 0.8, 'type': 'triangle', 'desc': 'Bioluminescent hum'},
    },
    'mandelbulb_studio': {
        'rotate': {'freq': 300, 'dur': 0.05, 'type': 'sine', 'vol': 0.02, 'desc': 'Subtle orbit tick'},
        'preset_change': {'freq': 523, 'dur': 0.12, 'type': 'triangle', 'desc': 'Biome switch'},
        'screenshot': {'freq': 1200, 'dur': 0.08, 'type': 'sine', 'desc': 'Capture click'},
        'power_change': {'freq': 220, 'dur': 0.2, 'type': 'sine', 'desc': 'Fractal morph'},
    },
    'fractal_sculptor': {
        'mode_switch': {'freq': 440, 'dur': 0.1, 'type': 'triangle', 'desc': 'SDF mode change'},
        'breed': {'freq': 330, 'dur': 0.3, 'type': 'sine', 'desc': 'DNA crossbreed'},
        'mutate': {'freq': 180, 'dur': 0.2, 'type': 'sawtooth', 'desc': 'Mutation noise'},
        'export': {'freq': 880, 'dur': 0.15, 'type': 'sine', 'desc': 'Export chime'},
    },
    'boulder_builder': {
        'place': {'freq': 200, 'dur': 0.12, 'type': 'sine', 'desc': 'Boulder thud'},
        'remove': {'freq': 150, 'dur': 0.08, 'type': 'sawtooth', 'desc': 'Remove crumble'},
        'biome_switch': {'freq': 440, 'dur': 0.1, 'type': 'triangle', 'desc': 'Palette change'},
        'shape_switch': {'freq': 660, 'dur': 0.08, 'type': 'sine', 'desc': 'New sprite shape'},
        'grid_toggle': {'freq': 1000, 'dur': 0.05, 'type': 'sine', 'desc': 'Grid snap click'},
    },
}

print('AUDIO SPECS FOR TIER 1 GAMES')
print('=' * 55)
for game, events in audio_specs.items():
    print(f'\\n{game}:')
    if isinstance(events, dict):
        for event, spec in events.items():
            if isinstance(spec, dict) and 'desc' in spec:
                print(f'  {event:20s} {spec[\"freq\"]:4.0f}Hz {spec[\"type\"]:10s} {spec[\"desc\"]}')
            elif isinstance(spec, dict):
                for sub_event, sub_spec in spec.items():
                    if isinstance(sub_spec, dict):
                        print(f'  {event}/{sub_event:15s} {sub_spec[\"freq\"]:4.0f}Hz {sub_spec[\"type\"]:10s} {sub_spec.get(\"desc\",\"\")}')

# Generate the JS code for each game's audio engine
print('\\n\\nGENERATED JS AUDIO ENGINES:')
print('=' * 55)

for game, events in audio_specs.items():
    js_lines = [f'// Audio engine for {game}']
    js_lines.append('var _ac;function _tone(f,d,t,v){if(!_ac)_ac=new(AudioContext||webkitAudioContext)();var o=_ac.createOscillator(),g=_ac.createGain();o.type=t||"sine";o.frequency.value=f;o.detune.value=(Math.random()-.5)*8;g.gain.setValueAtTime(v||.08,_ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,_ac.currentTime+(d||.2));o.connect(g);g.connect(_ac.destination);o.start();o.stop(_ac.currentTime+(d||.2))}')

    flat_events = {}
    for k, v in events.items():
        if isinstance(v, dict) and 'freq' in v:
            flat_events[k] = v
        elif isinstance(v, dict):
            for sk, sv in v.items():
                if isinstance(sv, dict) and 'freq' in sv:
                    flat_events[f'{k}_{sk}'] = sv

    for name, spec in flat_events.items():
        safe_name = name.replace('/', '_')
        js_lines.append(f'function snd_{safe_name}(){{_tone({spec["freq"]},{spec.get("dur",0.2)},"{spec.get("type","sine")}",{spec.get("vol",0.08)})}}')

    print(f'\\n--- {game} ---')
    for line in js_lines:
        print(line)

# Save as JSON for the injection script
with open('tier1_audio_specs.json', 'w') as f:
    json.dump(audio_specs, f, indent=2)
print('\\nSaved: tier1_audio_specs.json')
"""),
    ('md', """## Cross-Pollination Map

Each game borrows audio patterns from the others:
- Boulder Builder's `place` thud → also used in Fractal Sculptor when a breed completes
- Aku Shrine's `gem_pulse` → also used in The Threshold when entering world 2 (Threshold)
- Mandelbulb's `preset_change` → also used in Boulder Builder's `biome_switch`
- The Between's `void_whisper` → used as ambient in ALL games at low volume

The audio IS the Filigree — same pattern, different density per game."""),
])

# ═══════════════════════════════════════════════
# KERNEL 2: Screenshot/Export System
# Every game needs capture capability
# ═══════════════════════════════════════════════
K2 = make_nb([
    ('md', """# Tier 1 Screenshot + Export System
## Every game needs: capture the canvas, download as PNG, share.

Context clues:
- Mandelbulb Studio already has screenshot. Port that to all 5.
- Fractal Sculptor has sprite sheet export. Port the 8-angle capture to Boulder Builder.
- The Threshold needs frame capture for social sharing.
- Aku Shrine needs high-res render export."""),
    ('code', """# Generate the universal screenshot/export JS module

screenshot_js = '''
// -- THRESHOLD SCREENSHOT SYSTEM --
// Press S to screenshot, P for high-res, Shift+S for sprite sheet

function thScreenshot(canvas, filename) {
  if (!canvas) {
    // Try to find the right canvas
    canvas = document.querySelector('canvas');
  }
  if (!canvas) return;

  var url;
  if (canvas.getContext('webgl2') || canvas.getContext('webgl')) {
    // WebGL canvas — need to read pixels
    var gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    var w = canvas.width, h = canvas.height;
    var pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = w; tmpCanvas.height = h;
    var ctx = tmpCanvas.getContext('2d');
    var imgData = ctx.createImageData(w, h);

    // Flip Y
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var si = ((h - 1 - y) * w + x) * 4;
        var di = (y * w + x) * 4;
        imgData.data[di] = pixels[si];
        imgData.data[di+1] = pixels[si+1];
        imgData.data[di+2] = pixels[si+2];
        imgData.data[di+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    url = tmpCanvas.toDataURL('image/png');
  } else {
    // 2D canvas
    url = canvas.toDataURL('image/png');
  }

  var a = document.createElement('a');
  a.href = url;
  a.download = filename || ('guinea_pig_trench_' + Date.now() + '.png');
  a.click();

  // Flash feedback
  var flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:white;opacity:0.15;z-index:99999;pointer-events:none;transition:opacity 0.3s';
  document.body.appendChild(flash);
  setTimeout(function() { flash.style.opacity = '0'; }, 50);
  setTimeout(function() { flash.remove(); }, 400);
}

// Auto-wire: S key = screenshot
document.addEventListener('keydown', function(e) {
  if (e.key === 's' || e.key === 'S') {
    if (!e.ctrlKey && !e.metaKey) { // Don't capture Ctrl+S
      if (document.pointerLockElement) return; // Skip if in FPS mode
      thScreenshot();
    }
  }
});
'''

print('SCREENSHOT SYSTEM')
print('=' * 55)
print(screenshot_js)
print()
print('Works with both WebGL and 2D canvas.')
print('Auto-wires to S key.')
print('Flash feedback on capture.')
print('Downloads PNG with timestamp.')

# Save
with open('tier1_screenshot.js', 'w') as f:
    f.write(screenshot_js)
print('\\nSaved: tier1_screenshot.js')
"""),
])

# ═══════════════════════════════════════════════
# KERNEL 3: Music Integration
# Connect the 106 refined beats to the games
# ═══════════════════════════════════════════════
K3 = make_nb([
    ('md', """# Tier 1 Music Integration
## 106 refined beats mapped to the Five Worlds

Context clues from the music manifest:
- Each beat is already tagged with a biome
- Each game is assigned to a world
- Match game world → beat biome → autoplay

The music player should:
1. Load the manifest
2. Filter tracks by the current game's world
3. Shuffle and play
4. Crossfade between tracks
5. Volume duck during UI events"""),
    ('code', """# Generate the music integration JS module

music_js = '''
// -- THRESHOLD MUSIC SYSTEM --
// Auto-plays refined beats matched to the game's world

var _thMusic = {
  audio: null,
  manifest: null,
  currentTrack: -1,
  worldFilter: null,
  volume: 0.15,

  init: function(worldBiome) {
    this.worldFilter = worldBiome;
    // Load manifest
    fetch('../music/manifest.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _thMusic.manifest = data;
        _thMusic.playNext();
      })
      .catch(function(e) { console.log('Music manifest not found'); });
  },

  playNext: function() {
    if (!this.manifest || !this.manifest.tracks) return;

    // Filter by world biome if set
    var tracks = this.manifest.tracks;
    if (this.worldFilter) {
      var filtered = tracks.filter(function(t) {
        return t.biome === _thMusic.worldFilter || t.category === 'REFINED';
      });
      if (filtered.length > 0) tracks = filtered;
    }

    // Random track
    var idx = Math.floor(Math.random() * tracks.length);
    var track = tracks[idx];

    if (this.audio) {
      this.audio.pause();
    }

    this.audio = new Audio('../music/' + track.file);
    this.audio.volume = this.volume;
    this.audio.onended = function() { _thMusic.playNext(); };
    this.audio.play().catch(function() {
      // Auto-play blocked — wait for user interaction
      document.addEventListener('click', function() {
        _thMusic.audio.play().catch(function(){});
      }, {once: true});
    });

    this.currentTrack = idx;
    console.log('Now playing: ' + track.title + ' (' + track.biome + ')');
  },

  duck: function(amount, duration) {
    if (!this.audio) return;
    this.audio.volume = this.volume * (1 - (amount || 0.5));
    setTimeout(function() {
      if (_thMusic.audio) _thMusic.audio.volume = _thMusic.volume;
    }, (duration || 500));
  }
};
'''

# Game-to-biome mapping
game_biomes = {
    'the_threshold': None,  # cycles through all — no filter
    'aku_shrine': 'the_threshold',
    'mandelbulb_studio': 'radiant_void',
    'fractal_sculptor': 'cyberpunk_factory',
    'boulder_builder': 'dark_forest',
}

print('MUSIC INTEGRATION')
print('=' * 55)
for game, biome in game_biomes.items():
    init_call = f"_thMusic.init('{biome}');" if biome else "_thMusic.init(null); // plays all biomes"
    print(f'{game:25s} -> biome: {biome or \"ALL\"} -> {init_call}')

print()
print(music_js)

with open('tier1_music.js', 'w') as f:
    f.write(music_js)
    f.write('\\n// Game biome mappings:\\n')
    for game, biome in game_biomes.items():
        f.write(f'// {game} -> {biome or "ALL"}\\n')
print('\\nSaved: tier1_music.js')
"""),
])

# ═══════════════════════════════════════════════
# KERNEL 4: Lore Fragments System
# Show bible quotes contextually
# ═══════════════════════════════════════════════
K4 = make_nb([
    ('md', """# Tier 1 Lore Fragments
## The design bible, served as in-game text

Context clues: The Threshold already has lore per world. But the other 4 games don't.
Each game gets contextual lore fragments from the bible that appear subtly in the UI."""),
    ('code', """# Lore fragments per game, drawn from the bible

lore_fragments = {
    'the_threshold': [
        'The water is rising. The faces are blinking.',
        'Five signals. One frequency.',
        'Sixteen square miles of independent economy.',
        'The Animated Cores pulse at 0.7 seconds.',
        'The atmosphere is the cheese. The entities are the holes.',
        'Still here.',
    ],
    'aku_shrine': [
        'The face was not carved. It resolved.',
        'The left half records. The right half reads.',
        'The eight faces are not decorative. They are residents.',
        'The bull does not stop.',
        'AKU AKU is finishing a thought that started before you existed.',
        'Still here. Still thinking. Almost done.',
    ],
    'mandelbulb_studio': [
        'The Loom takes separate threads and produces a fabric.',
        'Each panel retains a localized impression.',
        'The pattern was not designed. It was derived.',
        'The tile is the answer to a question nobody remembers asking.',
        'Oh, that is the Filigree.',
    ],
    'fractal_sculptor': [
        'The between IS the product.',
        'The mistake IS the signal.',
        'The almost IS the always.',
        'B(t) = the between. t = how far between.',
        'The curve never passes through control points.',
        'Crossbreeding at the bezier level produces smooth morphs.',
    ],
    'boulder_builder': [
        'The cross-section boulder IS the building primitive.',
        'A wall is boulders in a line. A tower is boulders stacked.',
        'The shape comes from the sprite. The material comes from the biome.',
        'Architecture from geology.',
        'The Fabricants believed a structure walls were its nervous system.',
        'Every panel was intentional.',
    ],
}

# Generate JS module
lore_js = '''
// -- THRESHOLD LORE FRAGMENTS --
// Contextual text from the design bible

var _thLore = {
  fragments: [],
  currentIdx: 0,
  element: null,

  init: function(gameId) {
    var all = LORE_DATA[gameId] || LORE_DATA['the_threshold'];
    this.fragments = all;
    this.currentIdx = 0;

    // Create lore display element
    this.element = document.createElement('div');
    this.element.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);' +
      'color:rgba(200,220,240,0.35);font-family:Courier New,monospace;font-size:9px;' +
      'letter-spacing:0.12em;text-align:center;max-width:400px;line-height:1.8;' +
      'pointer-events:none;z-index:9990;opacity:0;transition:opacity 3s';
    document.body.appendChild(this.element);

    // Show first fragment after 5 seconds, then cycle every 30 seconds
    var self = this;
    setTimeout(function() { self.show(); }, 5000);
    setInterval(function() { self.show(); }, 30000);
  },

  show: function() {
    if (!this.element || this.fragments.length === 0) return;
    this.element.textContent = this.fragments[this.currentIdx];
    this.element.style.opacity = '1';
    this.currentIdx = (this.currentIdx + 1) % this.fragments.length;
    var el = this.element;
    setTimeout(function() { el.style.opacity = '0'; }, 8000);
  }
};
'''

print('LORE FRAGMENTS PER GAME')
print('=' * 55)
for game, frags in lore_fragments.items():
    print(f'\\n{game}:')
    for frag in frags:
        print(f'  "{frag}"')

# Build the full JS with data embedded
full_js = 'var LORE_DATA = ' + json.dumps(lore_fragments, indent=2) + ';\\n' + lore_js

with open('tier1_lore.js', 'w') as f:
    f.write(full_js)
print(f'\\nSaved: tier1_lore.js ({len(lore_fragments)} games, {sum(len(v) for v in lore_fragments.values())} fragments)')
"""),
])

# ═══════════════════════════════════════════════
# KERNEL 5: Master Cross-Pollination Injector
# Takes outputs from K1-K4 and injects into games
# ═══════════════════════════════════════════════
K5 = make_nb([
    ('md', """# Master Cross-Pollination — Tier 1 Injection
## Combines audio + screenshot + music + lore into injection-ready JS per game

This is the coordinator. Like the Erdos cloud_coordinator.py that merged sieve results,
this merges all the cross-pollinated features into per-game injection scripts."""),
    ('code', """# Build the complete injection per game

games = ['the_threshold', 'aku_shrine', 'mandelbulb_studio', 'fractal_sculptor', 'boulder_builder']
biomes = {
    'the_threshold': None,
    'aku_shrine': 'the_threshold',
    'mandelbulb_studio': 'radiant_void',
    'fractal_sculptor': 'cyberpunk_factory',
    'boulder_builder': 'dark_forest',
}

for game in games:
    biome = biomes.get(game)
    biome_str = f"'{biome}'" if biome else 'null'

    injection = f'''
// ============================================
// THRESHOLD CROSS-POLLINATION: {game}
// Audio + Screenshot + Music + Lore
// Generated by Kaggle fleet
// ============================================

// 1. AUDIO
var _ac;function _tone(f,d,t,v){{if(!_ac)_ac=new(AudioContext||webkitAudioContext)();var o=_ac.createOscillator(),g=_ac.createGain();o.type=t||"sine";o.frequency.value=f;o.detune.value=(Math.random()-.5)*8;g.gain.setValueAtTime(v||.08,_ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,_ac.currentTime+(d||.2));o.connect(g);g.connect(_ac.destination);o.start();o.stop(_ac.currentTime+(d||.2))}}
function thClick(){{_tone(800,.06,"sine",.08)}}
function thSuccess(){{_tone(523,.1,"sine",.12);setTimeout(function(){{_tone(659,.1)}},70);setTimeout(function(){{_tone(784,.15,"triangle",.1)}},140)}}

// 2. SCREENSHOT (S key)
document.addEventListener("keydown",function(e){{
  if((e.key==="s"||e.key==="S")&&!e.ctrlKey&&!e.metaKey&&!document.pointerLockElement){{
    var c=document.querySelector("canvas");if(!c)return;
    var url=c.toDataURL("image/png");var a=document.createElement("a");
    a.href=url;a.download="guinea_pig_trench_"+Date.now()+".png";a.click();
    _tone(1200,.08,"sine",.06);
  }}
}});

// 3. MUSIC
var _thMusic={{audio:null,manifest:null,vol:0.12,
  init:function(b){{var self=this;fetch("../music/manifest.json").then(function(r){{return r.json()}}).then(function(d){{self.manifest=d;self.play(b)}}).catch(function(){{}});}},
  play:function(b){{if(!this.manifest)return;var t=this.manifest.tracks;if(b){{var f=t.filter(function(x){{return x.biome===b}});if(f.length)t=f}}var tr=t[Math.floor(Math.random()*t.length)];if(this.audio)this.audio.pause();this.audio=new Audio("../music/"+tr.file);this.audio.volume=this.vol;this.audio.onended=function(){{_thMusic.play(b)}};this.audio.play().catch(function(){{}})}}
}};
_thMusic.init({biome_str});

// 4. LORE
var _lore={{"the_threshold":["Still here.","Five signals. One frequency.","The water is rising."],"aku_shrine":["The face was not carved. It resolved.","Still thinking. Almost done.","The bull does not stop."],"mandelbulb_studio":["The pattern was not designed. It was derived.","Oh, that is the Filigree."],"fractal_sculptor":["The between IS the product.","The mistake IS the signal.","The almost IS the always."],"boulder_builder":["Architecture from geology.","Every panel was intentional.","A wall is boulders in a line."]}};
(function(){{var f=_lore["{game}"]||_lore["the_threshold"];var el=document.createElement("div");el.style.cssText="position:fixed;bottom:40px;left:50%;transform:translateX(-50%);color:rgba(200,220,240,0.3);font-family:Courier New,monospace;font-size:9px;letter-spacing:0.12em;text-align:center;max-width:400px;pointer-events:none;z-index:9990;opacity:0;transition:opacity 3s";document.body.appendChild(el);var i=0;function show(){{el.textContent=f[i%f.length];el.style.opacity="1";i++;setTimeout(function(){{el.style.opacity="0"}},8000)}}setTimeout(show,5000);setInterval(show,30000)}})();
'''

    print(f'\\n{"="*55}')
    print(f'{game} injection: {len(injection)} chars')
    print(f'  Audio: Web Audio tone generator')
    print(f'  Screenshot: S key capture')
    print(f'  Music: biome={biome or "ALL"} from 106 refined beats')
    print(f'  Lore: contextual bible fragments')

    with open(f'inject_{game}.js', 'w') as f:
        f.write(injection)

print(f'\\n\\nAll 5 injection scripts generated.')
print(f'Run inject_<game>.js into each HTML to complete the cross-pollination.')
"""),
])

# ═══════════════════════════════════════════════
# DEPLOY THE FLEET
# ═══════════════════════════════════════════════
def deploy():
    import time
    kernels = [
        ('gpt-tier1-audio-engine', K1),
        ('gpt-tier1-screenshot-export', K2),
        ('gpt-tier1-music-integration', K3),
        ('gpt-tier1-lore-fragments', K4),
        ('gpt-tier1-master-injector', K5),
    ]

    print('TIER 1 CROSS-POLLINATION FLEET')
    print('=' * 55)
    print(f'Kernels: {len(kernels)}')
    print()

    for title, nb_text in kernels:
        print(f'Pushing: {title}...', end=' ', flush=True)
        result = push(title, nb_text)
        print(result)
        time.sleep(0.5)

    print(f'\nFleet deployed.')


if __name__ == '__main__':
    deploy()
