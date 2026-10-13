# Goblin.io – Hinweise für Claude

Fabi spricht Deutsch; Antworten, Commit-Texte und Kommentare auf Deutsch. Aufbau und Befehle stehen in `README.md`.

## Arbeitsweise mit Fabi

- `PLAN.md` ist der Ausbauplan v3. „Mach am Game weiter“ = nächsten offenen Punkt aus Abschnitt 11 (Roadmap) nehmen. Vorher `git log` und die Häkchen in PLAN.md prüfen, danach abhaken.
- „Mach auf die Liste“ = Punkt in PLAN.md in der laufenden Phase eintragen (mit „Wunsch Fabi, Datum“), nicht sofort umsetzen.
- Bei Design-Fragen kurze Auswahl-Fragen stellen (2–4 Optionen, gern mit Vorschau-Bild), dann direkt loslegen.
- Nach größeren Schritten ein Code-Review (mindestens high) und die Funde beheben.
- Fabis Wünsche: Fähigkeiten leveln durch Benutzen; Ausrüstung NICHT vor jedem Lauf wählen müssen.

## Prüfen

- `npm run lint` immer laufen lassen – esbuild meldet fehlende Importe nicht.
- `npm test` für Logik, `npm run smoke` nach Render-Änderungen (die Sim zeichnet nicht).
- Balance: `npm run sim` (60 Hz, Zielwerte `LEVEL_TARGET`, `--par 5`, `--loadout a,b`, `--seed 101`). Bei 100 Läufen schwanken Siegquoten um ±7 Punkte → vor Schlüssen mit zweitem Seed-Satz gegenprüfen. Vorher/Nachher: alte Version per `git stash` bauen, wegkopieren, `--html` darauf zeigen.
- Sprites entstehen zur Laufzeit (`src/gen/`); ansehen mit `node tools/gen/dump.mjs build/sprites --png`.
- Screenshots von Menü-Screens per Playwright mit `GOBLIN.go('menu', '#profile')` usw., in Desktop- und Handygröße. Browser-Uhr: `p.clock.install`.

## Stolperfallen

- **Determinismus:** Bei gleichen Seeds muss die Sim gleich ausgehen. Im Spielablauf nie `rnd()`/`rand()` für Optik und nie `Math.random()` für Logik. Prüfen: zwei gleiche Sim-Aufrufe vergleichen.
- Globale CSS-Klasse `.lv` ist vom HUD belegt.
- Playwright bleibt auf 1.58.2 gepinnt (passt zu chromium-1208).
- Jede Chromium-Seite der Sim braucht ~550 MB; `run-sims.mjs` begrenzt die Parallelität nach freiem Speicher.
- Python-Edits nie als `open(p,'w').write(open(p).read())` – das leert die Datei.

## Releases (Windows-exe + Android-APK)

Nur auf ausdrücklichen Wunsch: Lint/Tests, committen, `npm version patch`, `git push --follow-tags`, Lauf mit `gh run watch` verfolgen. Details im README. Die Signier-Schlüssel liegen als Repo-Secrets; niemals neue Schlüssel erzeugen oder die Updater-Konfiguration ändern.

## Cloud-Sitzungen

`tools/cloud-setup.sh` (SessionStart-Hook) installiert Pakete und Chromium. Fabi kann hier nicht direkt spielen: Änderungen auf einen Branch pushen, Fabi holt sie lokal ab (oder `claude --teleport`). Kein Zugriff auf Fabis PC (Spielstände, Spieleserver :8080, Android-SDK).
