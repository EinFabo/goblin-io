# Goblin.io – Quellcode (Stand v2)

Bauen (Python 3):

    python3 build.py assets assets/Dagger.svg

Ergebnis: `goblin-io.html` (läuft offline in jedem Browser).

- `game.js`, `style.css`, `index.tpl.html` – Spiel
- `assets/` – Sprites aus dem Magier-Paket, Gras aus dem Scratch-Projekt, Dolch
- `tools/gen/mages.py` – Sprite-Generator (`python3 tools/gen/mages.py ausgabeordner`)
- `sim/sim.js` – Balance-Bot (braucht `npm i playwright`, dann `node sim/sim.js`)
- `PLAN.md` – Ausbauplan v3
