# Goblin.io – Quellcode (v3 in Arbeit)

Survivor-artiges Spiel. Ergebnis ist **eine einzelne HTML-Datei**, die offline in jedem Browser läuft.

    npm install
    npm run build        # → dist/goblin-io.html  (mit --dev: nicht minifiziert)
    npm test             # Unit-Tests (Save-Migration, RNG)
    npm run lint         # ESLint, findet u. a. undefinierte Namen
    npm run sim          # Balance-Bot, Standard-Satz (6 Konfigurationen × 20 Läufe)
    npm run sim -- --stage 3 --runs 50 --talents atk=4,hp=4 --seed 1
    npm run perf         # Performance-Budget: Ladezeit, FPS mit 300 Gegnern, Speicher (auf Geräten: ?perf)
    node tools/gen/dump.mjs build/sprites --png   # alle generierten Sprites ansehen

## App (Windows-exe und Android-APK)

Tauri 2 in `src-tauri/`, packt `dist/app/index.html` (`npm run build:app`) ein. Releases baut GitHub Actions
(`.github/workflows/release.yml`) aus einem Versions-Tag:

    npm version patch          # 3.0.0 → 3.0.1, Commit + Tag v3.0.1
    git push --follow-tags     # Actions baut exe + apk und hängt sie ans Release

- **Auto-Update:** Windows über `tauri-plugin-updater` (`latest.json` im neuesten Release, signiert mit
  `~/.goblin-io/updater.key`); Android prüft die GitHub-API und öffnet die neue APK (`src/app-update.js`).
- **Schlüssel** liegen nur in `~/.goblin-io/` und als Repo-Secrets – nicht verlieren: ohne `android.jks`
  lässt sich die APK nicht mehr über die alte installieren, ohne `updater.key` gibt es keine Windows-Updates.
- Icons: `node tools/app-icon.mjs assets/app/icon.svg assets/app/icon.png`, dann `npx tauri icon assets/app/icon.png`; fürs Android-Projekt (adaptives Icon) zusätzlich `node tools/app-icon-android.mjs`.
- Lokal: `npm run app` (Fenster), `npx tauri android build --apk --target aarch64`
  (braucht `ANDROID_HOME`, `NDK_HOME` und `src-tauri/gen/android/keystore.properties`).

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/core/` | Schleife (fester 60-Hz-Schritt), Szenen, Event-Bus, Seeded RNG, Spielstand, Eingabe, Ton, Musik |
| `src/game/` | Spiellogik: Lauf, Spieler, Gegner, Boss, Waffen, Gefahren, Gegenstände, Level-Up |
| `src/render/` | Canvas, Sprites, prozedurale Grafiken, Icons, Welt- und Menü-Zeichnung |
| `src/ui/` | HUD, Menüs, Pause, Level-Up-Karten, Ergebnis, Knöpfe |
| `src/net/` | Koop: Gleichschritt (`lockstep.js`) und Raum-Verbindung (`room.js`) |
| `src/scenes/` | `boot → menu → run → results → menu` |
| `src/data/` | Stages, Waffen, Passive, Gegner, Werkstatt |
| `src/gen/` | Sprite-Generatoren (Goblin, 8 Magierschulen, Diener), laufen beim Laden im Browser |
| `src/debug.js` | `window.GOBLIN` für Bot und Tests |
| `assets/` | Sprites aus dem Magier-Paket, Gras, Dolch |
| `tools/` | `build.mjs` (esbuild + Assets inline), `smoke.mjs`, `perf.mjs` (Performance-Budget), `gen/dump.mjs` (generierte Sprites als SVG/PNG ausgeben), `gen/mages.py` (alter Python-Generator, nur noch Referenz) |
| `sim/` | Balance-Bot (`bot.js`) und Auswertung (`run-sims.mjs`), braucht Playwright |
| `test/` | `node --test` |

## Regeln im Code

- **Zufall:** Spiellogik nutzt nur die Seed-Streams aus `core/rng.js` (`rand`, `pick`, `rnd`, `RNG.spawn`, `RNG.loot`, `RNG.lvl`). Reine Optik (Partikel, Wackeln) nutzt `frand` oder `Math.random`. So ist ein Lauf mit gleichem Seed und gleicher Eingabe reproduzierbar.
- **Zustand:** `run` und `P` kommen aus `game/state.js` und werden nur über `setRun()`/`activate()` neu gesetzt. `P` ist der gerade gerechnete Goblin; was einem Goblin gehört und auf `run` liegt (Waffen, Fähigkeiten, eigene Geschosse …), steht in `KIT` und wird von `activate(i)` getauscht.
- **Spiellogik kennt keine Szenen.** Sie meldet sich über den Event-Bus (`runEnd`, `bossSpawn`, `playerHurt` …), die Szenen reagieren darauf.
- **Spielstand:** `core/save.js`, Version 2. Alte v1-Stände werden beim Start übernommen; der v1-Eintrag bleibt als Sicherung liegen.

## Koop zu zweit (Phase 14)

Beide Spiele rechnen dieselbe Sim im Gleichschritt; übers Netz gehen nur Eingaben (`src/net/lockstep.js`) und alle 60 Ticks eine Prüfsumme. Der Raum ist ein Durable Object im Worker (`cloud/src/room.js`), das nur weiterreicht. Am Level-Zettel „Koop“ → Raum erstellen oder Code eingeben; der Gastgeber startet.

    node tools/coop-check.mjs                 # Prüfsummen allein und im Koop (ohne Zeichnen)
    node tools/coop-e2e.mjs [--trace]          # zwei Browserseiten, Node als Verbindung; --trace zeigt den ersten Unterschied
    cd cloud && npm run dev                    # Worker mit Raum lokal (Port 8787, public/index.html = dist)
    node tools/coop-e2e.mjs --server http://127.0.0.1:8787   # durch die Oberfläche über den lokalen Raum
    npm run sim -- --coop                      # Koop-Balance (zwei Bot-Goblins)
    goblin-io.html?coop=local                  # zwei Goblins an einer Tastatur (Pfeile, Enter, Shift rechts, K/L, 7–0)

Die Sim darf nur von Eingaben und Profilen (`P.prof`) abhängen, nicht vom eigenen Spielstand, vom Ladestand der Bilder oder der Fenstergröße.

`PLAN.md` ist der Ausbauplan v3.
