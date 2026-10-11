#!/usr/bin/env python3
"""Packt alle Sprites + Spielcode in eine einzelne HTML-Datei."""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SCR = sys.argv[1]  # scratchpad mit entpackten Dateien
DAGGER = sys.argv[2]
OUT = os.path.join(ROOT, 'goblin-io.html')

mages = os.path.join(SCR, 'mag', 'mages')
files = {}
for sub in ['goblin', 'feuermagier', 'feuermagier/fx', 'frostmagier', 'frostmagier/fx']:
    d = os.path.join(mages, sub)
    for f in sorted(os.listdir(d)):
        if f.endswith('.svg'):
            files[f[:-4]] = open(os.path.join(d, f), encoding='utf-8').read()
files['dagger'] = open(DAGGER, encoding='utf-8').read()

def mini(s):
    s = re.sub(r'>\s+<', '><', s.strip())
    s = re.sub(r'(\d+\.\d{2})\d+', r'\1', s)  # Zahlen kürzen
    return s

uniq, idx = [], {}
sprmap = {}
for name, s in files.items():
    s = mini(s)
    if s not in idx:
        idx[s] = len(uniq)
        uniq.append(s)
    sprmap[name] = idx[s]

grass = base64.b64encode(open(os.path.join(SCR, 'sb3', 'd84248371980f30554c1b2d46d74b054.png'), 'rb').read()).decode()

assets = ('const SVGS=' + json.dumps(uniq, separators=(',', ':')) + ';\n'
          'const SPRMAP=' + json.dumps(sprmap, separators=(',', ':')) + ';\n'
          'const GRASS="data:image/png;base64,' + grass + '";\n')

tpl = open(os.path.join(ROOT, 'index.tpl.html'), encoding='utf-8').read()
css = open(os.path.join(ROOT, 'style.css'), encoding='utf-8').read()
js = open(os.path.join(ROOT, 'game.js'), encoding='utf-8').read()
html = tpl.replace('/*CSS*/', css).replace('/*ASSETS*/', assets).replace('/*GAME*/', js)
open(OUT, 'w', encoding='utf-8').write(html)
print('ok', OUT, len(html), 'bytes,', len(uniq), 'unique svgs,', len(sprmap), 'names')
