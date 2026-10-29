# Goblin.io – Ausbauplan v3

Plan für die nächste große Version: neue Magierschulen mit eigenen Modellen, weniger Zufall beim Gewinnen, freischaltbare Fähigkeiten, Profil mit Shop, Truhen, Karten-Upgrades und Kosmetik, 8-Richtungs-Sprites, bessere Sprint- und Dash-Animationen und stärkere Bosse.

Der Plan geht vom Stand **v2** aus (eine HTML-Datei, gebaut aus `game.js`, `style.css`, `index.tpl.html` und `build.py`). Seit Phase 0 liegt der Code modular in `src/` (siehe README). Die Abschnitte 11 bis 13 enthalten eine Reihenfolge zum Abarbeiten, Testkriterien und offene Entscheidungen.

---

## Inhalt

1. [Ausgangslage v2](#1-ausgangslage-v2)
2. [Leitlinien](#2-leitlinien)
3. [Architektur-Umbau](#3-architektur-umbau)
4. [Sprites, Animation und Polish](#4-sprites-animation-und-polish)
5. [Magierschulen und Gegner](#5-magierschulen-und-gegner)
6. [Stages und Bosse](#6-stages-und-bosse)
7. [Balancing: weniger Zufall, mehr Können](#7-balancing-weniger-zufall-mehr-können)
8. [Fähigkeiten-System mit 2 Slots](#8-fähigkeiten-system-mit-2-slots)
9. [Meta-Fortschritt: Profil, Karten, Truhen, Shop, Kosmetik](#9-meta-fortschritt-profil-karten-truhen-shop-kosmetik)
10. [UI und Screens](#10-ui-und-screens)
11. [Roadmap in Phasen](#11-roadmap-in-phasen)
12. [Testen und Qualität](#12-testen-und-qualität)
13. [Offene Entscheidungen](#13-offene-entscheidungen)
14. [Anhang: Datenformate und Formeln](#14-anhang-datenformate-und-formeln)

---

## 1. Ausgangslage v2

| Teil | Datei | Inhalt |
|---|---|---|
| Spiellogik | `game.js` (~1950 Zeilen) | alles in einer Datei: Sprites, Stages, Waffen, Gegner, Bosse, Sound, Musik, HUD, Menüs |
| Aussehen | `style.css` | HUD, Fähigkeiten-Knöpfe, Panels, Level-Up-Karten |
| Gerüst | `index.tpl.html` | DOM für HUD, Menüs, Overlays; Platzhalter für CSS/Assets/JS |
| Build | `build.py` | packt alle SVGs (dedupliziert) + Gras-PNG + Code in `goblin-io.html` |
| Sprite-Generator | `mages.py` (aus dem Sprite-Paket) | erzeugt Feuer- und Frostmagier, 4 Richtungen (right = gespiegeltes left) |
| Test | `sim.js` (Playwright) | Bot spielt Stages im Zeitraffer, misst Siege und Schadensquellen |

**Was v2 schon hat:** 9 Magierarten (über Einfärbung derselben 2 Modelle), 10 Waffen mit Entwicklungen, 10 Passive, Rolle, Sprint, Goblin-Wut, Goblin-Maschine, 5 Stages + Endlos, Werkstatt mit Gold, Musik, Hover-Sounds.

**Schwächen, die dieser Plan angeht:**

- Alle Magier teilen sich 2 Modelle, nur eingefärbt. Schulen sind optisch kaum unterscheidbar.
- Nur 4 Blickrichtungen, Dash ist nur ein Nachbild, Sprint nur schnellere Laufanimation.
- Level-Up-Karten sind rein gewichteter Zufall. Ein Lauf kann ohne passende Waffe "verhungern".
- Kein Profil, keine Sammlung, kein Grund für viele Läufe außer Gold.
- Bosse haben eine feste Angriffsrotation ohne Phasen.
- Der Code ist eine Datei. Neue Systeme lassen sich so schlecht anbauen.

---

## 2. Leitlinien

1. **Können vor Glück.** Jeder Treffer gegen den Spieler ist vorher sichtbar (Mindest-Warnzeit 0,6 s). Level-Ups haben Garantien statt reinem Zufall.
2. **Jede Schule erkennt man in 0,5 s** an Silhouette, Farbe und Telegraph, nicht nur an der Farbe.
3. **Daten statt Code.** Waffen, Gegner, Bosse, Karten, Truhen und Kosmetik stehen als Datenobjekte in `src/data/`. Neue Inhalte brauchen möglichst keine neue Logik.
4. **Fortschritt fühlt sich gut an, ist aber fair.** Truhen gibt es nur mit Spielwährung, die Wahrscheinlichkeiten stehen sichtbar im Spiel, und es gibt Pity-Garantien. Kein Echtgeld.
5. **Mobil zuerst.** Alles muss mit Daumen bedienbar sein, Knöpfe mindestens 56 px.
6. **60 FPS** mit 300 Gegnern auf einem Mittelklasse-Handy.

---

## 3. Architektur-Umbau

Vor allen neuen Features: `game.js` in Module zerlegen und mit **esbuild** zu einer Datei bündeln. Das Ergebnis bleibt eine einzelne HTML-Datei, die überall läuft.

### 3.1 Ordnerstruktur

```
goblin-io/
├─ tools/
│  ├─ build.mjs          # esbuild-Bundle + Assets inline → dist/goblin-io.html
│  ├─ atlas.mjs          # SVG → PNG-Spritesheets (optional, für Performance)
│  └─ gen/
│     ├─ mages.py        # erweitert: Schulen, 8 Richtungen, neue Animationen
│     ├─ goblin.py       # NEU: Goblin mit Kosmetik-Ebenen, 8 Richtungen
│     └─ minions.py      # NEU: Skelette, Geister, Golems, Ratten
├─ assets/               # generierte SVGs/PNGs + Gras-Kacheln
├─ src/
│  ├─ main.js            # Start, Szenenwechsel
│  ├─ core/              # loop.js, rng.js, input.js, audio.js, music.js, save.js, events.js
│  ├─ render/            # sprites.js, tint.js, camera.js, fx.js, particles.js, draw-world.js
│  ├─ game/
│  │  ├─ run.js          # Lauf-Zustand, Start/Ende
│  │  ├─ player.js       # Bewegung, Sprint, Rolle, Schaden
│  │  ├─ director.js     # Wellen-Skript pro Stage (siehe 7.4)
│  │  ├─ enemies/        # ai-*.js pro Rolle, schools.js, affixes.js
│  │  ├─ bosses/         # boss-runner.js + eine Datei pro Boss
│  │  ├─ weapons/        # eine Datei pro Waffe, gemeinsame Projektil-Logik
│  │  ├─ abilities/      # eine Datei pro aktiver Fähigkeit
│  │  ├─ levelup.js      # Kartenauswahl mit Garantien
│  │  └─ balance.js      # alle Formeln an einem Ort
│  ├─ meta/              # profile.js, inventory.js, upgrades.js, chests.js, shop.js, cosmetics.js, quests.js
│  ├─ data/              # weapons, passives, enemies, schools, bosses, stages, abilities, cards, chests, cosmetics, shop, achievements
│  └─ ui/                # screens/*.js, hud.js, components.js, sfx-ui.js
├─ sim/                  # bot.js, run-sims.mjs, report.mjs
└─ dist/goblin-io.html
```

### 3.2 Grundbausteine

| Baustein | Zweck |
|---|---|
| **Szenen-Statemachine** | `boot → hub → loadout → run → results → hub`. Jede Szene hat `enter/exit/update/render`. |
| **Event-Bus** | `emit('enemyKilled', e)`, `on('levelUp', …)`. Quests, Erfolge, Sounds und Statistiken hängen sich ein, ohne die Spiellogik zu ändern. |
| **Seeded RNG** (`mulberry32`) | Ein Seed pro Lauf. Ermöglicht Tageschallenge, reproduzierbare Bugs und faire Simulationen. Getrennte Streams für Spawns, Loot und Level-Up. |
| **Fester Zeitschritt** | Update mit 60 Hz fix, Rendern interpoliert. Simulation und Spiel verhalten sich dann gleich. |
| **Save v2 mit Migration** | Ein Schema mit Versionsnummer; `migrate(v1 → v2)` übernimmt Gold, freigeschaltete Stages und Bestzeiten (siehe 14.1). |
| **Asset-Registry** | `sprite('mage.necro.walk.downleft', frame)`. Lädt SVG oder Atlas transparent. |

### 3.3 Performance

- Gefärbte Varianten nicht mehr zur Laufzeit erzeugen: jede Schule hat eigene Sprites.
- Optional ein **Atlas**: `atlas.mjs` rastert alle Frames in PNG-Spritesheets (2× Auflösung). Das spart Speicher und Ladezeit gegenüber 1000+ einzelnen Canvas-Objekten.
- Gegner-Projektile und Partikel in festen Pools (keine `filter()`-Kopien pro Frame).
- Einen Spatial-Hash wie in v2 beibehalten, aber Zellen wiederverwenden statt jedes Frame neue Arrays.

---

## 4. Sprites, Animation und Polish

### 4.1 Acht Blickrichtungen

Neue Richtungen: `down, downleft, left, upleft, up` + gespiegelt `downright, right, upright`.

**Im Generator (`mages.py`):**

- `BASE_HANDS` und `mage(P, d, p)` um `downleft` und `upleft` erweitern. Eine 3/4-Ansicht entsteht aus:
  - Körper: `robe_front` horizontal auf 85 % gestaucht und 3 Einheiten zur Blickrichtung verschoben.
  - Kopf: Gesicht 40 % zur Seite verschoben, das abgewandte Ohr/Hutkante verdeckt.
  - Stab: Hand-Position zwischen `down` und `left` interpoliert.
- `build()` schreibt für jede Richtung mit `left` im Namen zusätzlich die gespiegelte `right`-Version, wie heute schon.
- `info.json` bekommt Spawn-Offsets für alle 8 Richtungen.

**Im Spiel:**

```js
const DIRS8 = ['right','downright','down','downleft','left','upleft','up','upright'];
const face8 = (dx, dy) => DIRS8[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
```

Wechsel der Blickrichtung mit kleiner Hysterese (erst ab 10° über der Sektorgrenze), sonst flackert das Sprite.

### 4.2 Neuer Goblin-Generator `goblin.py`

Der Goblin besteht heute aus einfachen Ellipsen und Polygonen um `translate(48 52)`. Das lässt sich gut parametrisieren:

| Ebene (von hinten nach vorn) | Kosmetik-Slot |
|---|---|
| Schatten | – |
| Umhang (optional) | `back` |
| Füße / Schuhe | `shoes` |
| Körper / Kleidung | `outfit` |
| Arme, Hände | `skin` |
| Ohren | `skin` |
| Kopf | `skin` |
| Gesicht (Augen, Zähne) | `face` |
| Hut | `hat` |
| Accessoire (Brille, Ohrring) | `accessory` |

Jede Ebene ist ein eigenes `<g id="…">`. Kosmetik tauscht entweder die Palette (Hautfarbe, Outfit-Farben) oder hängt eine andere Ebene ein (anderer Hut). Für jede Richtung und jeden Frame gibt es einen **Ankerpunkt** für Hut und Accessoire, damit Hüte auch beim Laufen richtig sitzen.

**Animationen des Goblins (je 8 Richtungen):**

| Animation | Frames | Beschreibung |
|---|---|---|
| idle | 4 | wie heute, Ohren wippen leicht |
| walk | 6 | wie heute |
| sprint | 6 | Oberkörper 15° nach vorn, längere Schritte, Ohren nach hinten, Arme pumpen |
| roll (Dash) | 6 | zusammenrollen → Kugel mit 2 Drehframes → aufrollen |
| hurt | 2 | zurückzucken, Augen zu |
| victory | 6 | Dolch hochreißen, Hut fliegt kurz hoch |
| death | 6 | umkippen, Sterne um den Kopf |

### 4.3 Sprint und Dash besser animieren

**Sprint**
- Eigene Sprint-Frames (siehe oben), Animationstempo an die echte Geschwindigkeit gekoppelt.
- Staubwolken genau auf den Schritt-Frames 2 und 5, nicht zufällig.
- Speed-Lines hinter dem Goblin, Kamera zoomt um 4 % heraus und schaut 40 px in Laufrichtung voraus.
- Sound: weiche Schritt-Klicks im Takt, Atmen wenn Ausdauer < 25 %.
- Leere Ausdauer: kurzer "Puh"-Sound, Schweißtropfen-Partikel, 0,4 s langsamer.

**Rolle (Dash)**
- Roll-Animation statt Nachbild-Spur.
- Squash & Stretch: Start 1,25 × 0,8 in Bewegungsrichtung, Ende 0,85 × 1,15, dann zurück.
- 3 farbige Nachbilder (Farbe aus der Kosmetik-Spur), Staubstoß am Start, Landewölkchen am Ende.
- Unverwundbar sichtbar machen: weißer Rand um den Goblin während der i-Frames.
- Rolle durch Projektile = "Perfekte Rolle": Zeitlupe 0,15 s, kleiner Glitzer, +5 Wut. Das belohnt Können.

### 4.4 Allgemeiner Polish

| Polish | Umsetzung |
|---|---|
| Hitstop | 40 ms Pause bei Elite-Kill und kritischem Treffer, 80 ms bei Boss-Phasenwechsel |
| Gegner-Spawn | Kurzes Portal (0,4 s) statt Aufploppen am Rand |
| Gegner-Tod | Auflösen in Schulfarbe statt grauer Wolke |
| Kamera | weiches Nachziehen (Lerp 0,15), Vorausschauen in Laufrichtung |
| Off-Screen-Pfeile | für Elite, Boss, Truhe, Schatztruhe |
| Silhouette | Goblin bekommt Umriss, wenn er hinter Gegnern steht |
| Schadenszahlen | gestapelt pro Gegner, Krits größer mit Schwung |
| Level-Up | goldener Lichtstrahl von oben, Karten fliegen einzeln ein |
| Musik | eigene Schleife pro Stage, Boss-Musik mit Intro |

### 4.5 Stilregeln (Phase 13, Fabi hat 2026-10-28 Stil „B voll“ gewählt)

| Regel | Umsetzung |
|---|---|
| Licht | von oben links. Gespiegelte Richtungen (rechts, unten rechts, oben rechts) sind im Spiel gespiegelte Bilder und haben das Licht damit rechts – bewusst, eigene Bilder je Richtung kosten zu viel Bildspeicher |
| Töne je Fläche | Glanz (Grundfarbe 38 % zu warmem Weiß `#fff8e8`), Grund, Schatten (34 % zu kühlem Violett `#1c1430`), am Rand dünnes Randlicht – als `radialGradient` (Mitte 32 %/26 %) |
| Werkzeug | `sf(farbe)` in `src/gen/svg.js` statt der Farbe; `svgDoc` sucht die benutzten Verläufe im fertigen Bild und schreibt sie in `<defs>` (kein globaler Zustand). `kit().blobE` (ab Radius 4,5) und `kit().smooth` schattieren selbst; kleine Teile (Augen, Knöpfe, Steine) bleiben flach |
| Glanz und Schatten | Glanzkante am Körper (nur über dem Gürtel), Kopfschatten oben auf dem Körper (halbtransparent, ohne Kontur). Kein fester Glanzfleck auf Hüten – der lag je nach Hutform über der Kontur |
| Gedrehte Posen | Rolle (Kugel) und Umfallen drehen die Figur; `svgDoc(…, { rot })` dreht die Verläufe zurück, das Licht bleibt oben links |
| Geschosse | bleiben ohne Verlauf: sie werden im Spiel gedreht (Flugrichtung, Drall), ein eingebauter Verlauf würde mitdrehen. Tiefe kommt vom Glühen (`glowTail`) |
| Böden | große Flecken laufen weich aus (`soft` in `render/tiles.js`), nur Kiesel und Glitzer sind harte Punkte; Deko-Haufen mit Schatten unten rechts |
| Kontur | bleibt 1,6 (Stil C mit 2,4 wurde nicht gewählt); Innenlinien 1–1,2 |
| Vergleich | `setShade(false)` zeichnet flach wie bis 3.0.x (nur für Vorher/Nachher-Bilder) |

---

## 5. Magierschulen und Gegner

### 5.1 Acht Schulen mit eigenen Modellen

Jede Schule bekommt im Generator eine **eigene Palette, Kopf-/Hutfunktion, Stabspitze und eigene Effekte** (heute nur `head_fire` und `head_frost`). Die Silhouette muss sich unterscheiden, nicht nur die Farbe.

| Schule | Modell-Merkmale | Stabspitze | Farben | Element-Effekt |
|---|---|---|---|---|
| **Feuer** (Pyromanten) | Spitzhut mit Stern, weißer Bart | Klaue mit Feuerkugel | rot, gold | Brennen (Schaden über Zeit) |
| **Frost** (Kryomanten) | Kapuze mit Fellrand, leuchtende Augen | Eiskristall | blau, weiß | Verlangsamen, Einfrieren |
| **Sturm** (Sturmrufer) | breiter Federhut, Schal flattert | Gabel mit Funken | gelb, violett | Blitzkreise, Kettenblitz |
| **Gift** (Alchemisten) | Pestmaske mit Schnabel, Flaschengürtel | Kolben mit grüner Brühe | grün, braun | Pfützen, Gaswolken |
| **Schatten** (Illusionisten) | Maske, Umhang mit Sternenmuster | schwebende Halbmondsichel | lila, schwarz | Teleport, Klone, Portale |
| **Nekromantie** (Nekromanten) | Schädelkapuze, zerrissene Robe | Knochenstab mit grünem Schädel | knochenweiß, giftgrün, schwarz | Beschwören, Wiederbeleben, Lebensraub |
| **Erde** (Geomanten) | Steinhelm, breite Schultern, Moos | Felsbrocken an Wurzeln | braun, ocker, moosgrün | Felswürfe, Erdspieße, Rüstung |
| **Licht** (Kleriker) | Heiligenschein, Mitra | Sonnenscheibe | weiß, gold, himmelblau | Heilen, Schilde, Stärkung |

### 5.2 Rollen innerhalb jeder Schule

Jede Schule hat 3 Stufen. So wirken Wellen abwechslungsreich, ohne für jede Variante neue Logik zu brauchen.

| Rolle | Größe | Verhalten | Beispiel Feuer | Beispiel Nekro |
|---|---|---|---|---|
| **Lehrling** | 0,7 | schneller Schwärmer, Nahkampf | Funkenwichtel (explodiert) | Knochenlehrling |
| **Magier** | 1,0 | hält Abstand, zaubert mit Warnung | Pyromant (Feuerball) | Knochenrufer (beschwört 3 Skelette) |
| **Meister** | 1,4 | selten, starke Spezialfähigkeit | Aschemeister (Feuerwand quer übers Feld) | Lich (Lebensraub-Strahl, heilt sich) |

### 5.3 Alle Gegner im Überblick

| Gegner | Schule | Angriff | Warnung (Telegraph) | Konter für den Spieler |
|---|---|---|---|---|
| Funkenwichtel | Feuer | rennt hin, explodiert | blinkt rot, roter Kreis 0,85 s | vorher töten → sprengt andere Magier |
| Pyromant | Feuer | Feuerball | glühender Stab + Ziellinie | seitlich ausweichen |
| Aschemeister | Feuer | Feuerwand (Linie, 3 s) | orange Linie am Boden 1 s | Lücke suchen, Rolle durch die Wand |
| Eiswichtel | Frost | Nahkampf, verlangsamt beim Treffer | – | Abstand |
| Kryomant | Frost | Eisspeer | Ziellinie | ausweichen |
| Gletscherwächter | Frost | Eisschild vorne, blockt Geschosse | Schild sichtbar | von hinten / Flächenschaden |
| Funkler | Sturm | schnelle Zickzack-Bewegung | – | Flächenwaffen |
| Sturmrufer | Sturm | Blitzkreis am Boden | gelber Kreis 0,9 s | raus aus dem Kreis |
| Donnerpriester | Sturm | Blitzstrahl zwischen zwei Priestern | gestrichelte Linie 1 s | Linie nicht kreuzen, einen Priester töten |
| Giftmischer | Gift | Giftpfütze werfen | Zielkreis am Boden | nicht reinlaufen |
| Seuchendoktor | Gift | Gaswolke im Kegel | grüner Kegel 0,8 s | seitlich raus |
| Sumpfhexe | Gift | teilt sich beim Tod in 2 kleine | – | Flächenschaden |
| Blinzler | Schatten | teleportiert neben dich, Schattenbolzen | lila Wirbel 0,5 s | direkt nach dem Auftauchen angreifen |
| Spiegelmagier | Schatten | erzeugt 2 Klone (1 Treffer) | Klone ohne Schatten am Boden | echten am Schatten erkennen |
| Leerenwandler | Schatten | öffnet Portal, aus dem Lehrlinge kommen | Portal wächst 2 s | Portal zerstören (hat HP) |
| Knochenlehrling | Nekro | Nahkampf, steht 1× wieder auf | Knochenhaufen zuckt | Knochen mit Flächenschaden zerstören |
| Knochenrufer | Nekro | beschwört 3 Skelette | grüne Runen am Boden 1 s | Rufer zuerst |
| Lich | Nekro | Lebensraub-Strahl, belebt tote Magier als Geister | grüner Strahl baut sich auf | Strahl unterbrechen durch Ausweichen hinter Gegner |
| Felsenwerfer | Erde | Felsbrocken im Bogen | Schatten wächst am Zielpunkt | Schatten verlassen |
| Erdbeber | Erde | Stachellinie Richtung Spieler | Risse im Boden 0,8 s | quer zur Linie ausweichen |
| Golem-Beschwörer | Erde | Steingolem (Tank, langsam) | – | Golem umgehen, Beschwörer töten |
| Heiler | Licht | heilt Magier im Umkreis | grüne Ringe | zuerst töten |
| Schildpriester | Licht | gibt Verbündeten Schild (absorbiert 30 % HP) | goldene Blase | Schild zuerst brechen |
| Paladin-Magier | Licht | Sturmangriff in Linie | weiße Linie 0,7 s | ausweichen |

Neue Nicht-Magier für Beschwörungen (Generator `minions.py`): **Skelett, Geist, Steingolem, Ratte** (für eine Spieler-Fähigkeit).

### 5.4 Elite-Affixe

Elites bekommen statt nur Gold-Färbung **Eigenschaften** (wie in Diablo oder Brotato). Ab Stage 3 eine, ab Stage 6 zwei.

| Affix | Wirkung | Erkennbar an |
|---|---|---|
| Schnell | +50 % Tempo | Speed-Lines |
| Gepanzert | −40 % Schaden von Geschossen | Metallglanz |
| Vampirisch | heilt sich bei Treffern | rote Partikel |
| Teilend | zerfällt in 3 kleinere Kopien | Riss im Körper |
| Explosiv | explodiert beim Tod (Warnkreis 1 s) | glühende Risse |
| Schildträger | Schild alle 8 s, bricht nach 3 Treffern | rotierende Schildplatten |
| Beschwörer | ruft alle 6 s 2 Lehrlinge | Runenkreis |

### 5.5 KI-Bausteine

Alle Gegner setzen sich aus wenigen Verhalten zusammen (`src/game/enemies/ai-*.js`):

- **Chase** (direkt hin), **Kite** (Abstand halten, seitlich laufen), **Flank** (zur Seite des Spielers laufen), **Blink** (teleportieren), **Charge** (Anlauf in Linie)
- **Cast** mit einheitlichem Ablauf: `windup (Telegraph) → release → recover`. Telegraph-Zeit nie unter 0,6 s (Lehrlinge ausgenommen, die zaubern nicht).
- **Globale Grenzen:** maximal 6 + Stage×2 gegnerische Geschosse, maximal 4 Bodenwarnungen gleichzeitig. So entsteht nie unfairer Kugelhagel.

---

## 6. Stages und Bosse

### 6.1 Stages

8 Stages + Endlos. Jede Stage hat eine Hauptschule und eine Nebenschule, eigenes Boden-Tileset (Gras eingefärbt + eigene Deko-Objekte wie Grabsteine, Pilze, Kristalle) und eigene Musik.

| # | Stage | Hauptschule | Nebenschule | Boss | Deko |
|---|---|---|---|---|---|
| 1 | Goblinwiese | Feuer | – | Ignaz der Funkenmeister | Blumen, Steine |
| 2 | Frostlichtung | Frost | Feuer | Frostbart der Eisweber | Schneeflecken, Eiszapfen |
| 3 | Giftsumpf | Gift | Erde | Morgra die Seuchenmutter | Pilze, Blasen |
| 4 | Knochenacker | Nekro | Gift | Graf Knochenhand | Grabsteine, Knochen |
| 5 | Spiegelhain | Schatten | Licht | Der Spiegelmeister | Spiegel, Sternenstaub |
| 6 | Sturmklippen | Sturm | Frost | Tempestra | Felsen, Blitzspuren |
| 7 | Felsenschlund | Erde | Nekro | Golemfürst Gromm | Kristalle, Lava-Risse |
| 8 | Turm der Magier | alle | – | Erzmagier Malvorn | Bücherregale, Runen |
| ∞ | Endlose Nacht | rotierend | – | alle 4 min ein zufälliger Boss | – |

**Sterne pro Stage** (wie in vielen Mobile-Games): ★ geschafft, ★★ geschafft mit über 50 % Leben, ★★★ Boss ohne Treffer durch Spezialangriffe *oder* in unter 60 s. Sterne geben einmalig Juwelen.

**Albtraum-Modus** nach dem Abschluss einer Stage: +80 % Gegner-HP, Elites mit 2 Affixen, bessere Truhen.

### 6.1a Welten mit Leveln und Weltkarte (Wunsch Fabi, 2026-10-12)

Ersetzt die Stage-Liste bzw. das Stage-Karussell. Entschieden mit Fabi:

- **Welten statt Stages:** Jede Stage aus 6.1 wird eine Welt (heute 5, später 8). Endlose Nacht bleibt ein einzelnes Feld am Ende der letzten Welt.
- **5 Level pro Welt**, jedes ein eigener kurzer Lauf, Start immer bei Level 1 (Talente, Fähigkeiten und Skill Trees wirken wie bisher):
  1. Einführung: die Hauptschule der Welt
  2. Nebenschule: neue Magier kommen dazu
  3. Elites und Schwärme
  4. Mini-Boss (bei ~1:40)
  5. Boss-Level: ~90 s dichte Wellen, dann Boss-Auftritt und Kampf in der Arena
  Level 1–4 dauern 2:30 (überleben = geschafft), das Boss-Level endet mit dem Boss. Ein geschafftes Level öffnet das nächste, der Boss öffnet die nächste Welt.
- **Magierhüte statt Sterne** (Goblin klaut den Magiern die Hüte): 1 Hut = geschafft, 2 = mit über 50 % Leben am Ende, 3 = nie unter 25 % Leben gefallen. Belohnung in Juwelen kommt mit Phase 6.
- **Weltkarte** im Tab „Spielen“: eine Karte pro Welt im Look der Welt, Pfad mit 5 Punkten (Boss-Punkt größer, mit Boss). Level antippen → der Goblin läuft den Pfad entlang hin, ein Zettel zeigt Name, Hüte, Bestzeit und „Los!“. ←/→ springt zum Nachbar-Level, Enter startet. Pfeile wechseln die Welt; gesperrte Welten grau mit Schloss. Geschaffte Level tragen eine Fahne, neu freie Wegstücke malen sich auf.
- **Spielstand:** pro Welt `levels: [{ hats, best }] × 5`; eine bisher geschaffte Stage zählt als komplett geschaffte Welt (alle Level mit 1 Hut).
- Wellen der Level werden aus dem Skript der Welt abgeleitet (Haupt-/Nebenschule, Schwarm-, Elite- und Mini-Boss-Typen), damit neue Welten nur ihre Daten brauchen.

### 6.2 Bosse: Aufbau

Jeder Boss hat **3 Phasen** (bei 100 %, 66 % und 33 % HP). Beim Phasenwechsel:

1. Boss wird 1,5 s unverwundbar, Hitstop, Zoom auf den Boss, Text "Phase 2".
2. Alle gegnerischen Geschosse verschwinden (Fairness).
3. Neue Angriffe kommen dazu, alte werden schneller.

| Regel | Wert |
|---|---|
| Ziel-Kampfdauer | 45 bis 75 s bei erwarteter Stärke (siehe 7.3) |
| Boss-HP | `erwarteteDPS(Stage, 4:00) × 60 s` |
| Wut-Timer | nach 120 s: +50 % Tempo und Schaden |
| Arena | Kreis wie in v2; ab Phase 3 schrumpft er bei einigen Bossen |
| Belohnung | garantierte Truhe der Stage-Stufe + Fähigkeits-Splitter beim Erstsieg |
| HP-Leiste | in 3 Segmente geteilt, Phasen-Markierungen sichtbar |

### 6.3 Die acht Bosse

| Boss | Phase 1 | Phase 2 | Phase 3 | Besonderheit |
|---|---|---|---|---|
| **Ignaz der Funkenmeister** (Feuer) | Feuerball-Fächer, Ansturm | + rotierende Feuerwände (2 Arme) | + Meteorregen, Arena brennt am Rand | Lehr-Boss: alle Warnungen extra deutlich |
| **Frostbart der Eisweber** (Frost) | Eisspeer-Salven, Eisboden-Flecken (rutschig) | + Eisschild: nur durch 3 Treffer am Rücken zerstörbar | + Schneesturm: Sicht eingeschränkt, Eissplitter-Spiralen | Schild-Mechanik |
| **Morgra die Seuchenmutter** (Gift) | Giftpfützen-Regen, Gaskegel | + teilt sich in 2 Hälften (gemeinsame HP) | + 3 Teile, Arena füllt sich langsam mit Gift von außen | Teilungs-Mechanik |
| **Graf Knochenhand** (Nekro) | Skelett-Wellen, Knochengefängnis (Käfig um den Spieler) | + 3 Seelengefäße erscheinen: Boss unverwundbar, bis alle zerstört | + belebt besiegte Skelette als Geister, Lebensraub-Strahl | Objektiv-Phase |
| **Der Spiegelmeister** (Schatten) | Teleport + Schattenbolzen | + 3 Klone, nur der echte (mit Schatten) nimmt Schaden | + Portale, durch die seine Geschosse wandern | Erkennen statt Zufall |
| **Tempestra** (Sturm) | Blitzkreise, Kettenblitz | + 4 Blitzsäulen mit Strahlen dazwischen (sichere Zonen wechseln) | + Sturm schiebt den Spieler in eine Richtung | Positionsspiel |
| **Golemfürst Gromm** (Erde) | reitet Golem: Schockwellen-Linien, Felsregen | + Rüstungsplatten (4) müssen abgeschlagen werden | + Golem zerbricht, Gromm zu Fuß: schnell, Erdspieße | Rüstungs-Mechanik |
| **Erzmagier Malvorn** (alle) | wechselt alle 15 s die Schule | + ruft 2 frühere Bosse als Schatten (50 % HP) | + alle Schulen gleichzeitig, letzte Phase mit Wut-Timer 60 s | Finale, 4. Phase "Verzweiflung" bei 10 % |

**Mini-Boss bei 2:00** in jeder Stage: Meister-Magier der Hauptschule mit 2 Affixen und eigener HP-Leiste. Er droppt die erste Truhe des Laufs.

---

## 7. Balancing: weniger Zufall, mehr Können

### 7.1 Wie andere Spiele das lösen

| Spiel | Technik | Übernehmen wir |
|---|---|---|
| Vampire Survivors | Bannen, Überspringen, Neu-Würfeln; Entwicklungen garantiert, sobald möglich | ✓ alles |
| Survivor.io | feste Wellen-Skripte statt Zufalls-Spawns, Ausrüstung skaliert Grundwerte | ✓ Wellen-Skripte |
| Brotato | Sperren (Lock) einzelner Angebote für die nächste Runde, Shop zeigt Seltenheit | ✓ Sperren |
| Hades | Pity: lange nicht gesehene Gaben werden wahrscheinlicher | ✓ Pity-Zähler |
| Clash Royale | Karten + Gold zum Aufwerten, Truhen mit festen Garantien | ✓ Meta (Abschnitt 9) |
| Slay the Spire | Seltenheits-Pity: seltene Karten werden mit jeder Auswahl ohne sie wahrscheinlicher | ✓ für Entwicklungs-Passive |

### 7.2 Level-Up-Regeln

Statt reinem gewichteten Zufall gelten **feste Regeln in dieser Reihenfolge**:

1. **Entwicklung möglich?** → Sie ist immer eine der Karten (wie heute).
2. **Startphase:** Bis du 3 Waffen hast, enthält jede Auswahl mindestens 1 neue Waffe.
3. **Fokus:** Jede Auswahl enthält mindestens 1 Aufwertung einer Waffe, die du schon hast (solange eine unter Stufe 5 ist).
4. **Passendes Passiv:** Hast du eine Waffe auf Stufe ≥3, aber nicht ihr Entwicklungs-Passiv, steigt dessen Gewicht pro Level-Up ohne Angebot um +50 % (Pity). Spätestens nach 4 Level-Ups kommt es garantiert.
5. **Rest** wird gewichtet gezogen: eigene Gegenstände ×2,5 gegenüber neuen. So entstehen fokussierte Builds statt Streuung.
6. **Keine Doppelten**, und keine Karte, die zwei Level-Ups hintereinander abgelehnt wurde (es sei denn, sonst fehlen Karten).

**Werkzeuge für den Spieler** (Anzahl pro Lauf, über Talente erhöhbar):

| Werkzeug | Start | Wirkung |
|---|---|---|
| Neu würfeln | 2 | alle 3 Karten neu |
| Bannen | 1 | Karte kommt in diesem Lauf nie wieder |
| Sperren | 1 | eine Karte bleibt fürs nächste Level-Up liegen |
| Überspringen | ∞ | +15 Gold oder +20 % Heilung |

**Vierte Karte:** über das Talent "Goblin-Schläue" ab Konto-Level 10.

### 7.3 Kraftkurve statt Bauchgefühl

Alle Formeln stehen in `src/game/balance.js`. Grundidee: **erwartete Spielerstärke** und **Gegnerstärke** werden gegeneinander geplant.

**Ziel-Level im Lauf** (bei normalem Sammeln):

| Zeit | 0:30 | 1:00 | 2:00 | 3:00 | 4:00 (Boss) |
|---|---|---|---|---|---|
| Ziel-Level | 3 | 6 | 11 | 16 | 20 |

**Aufhol-Regel für XP** (sanftes Gummiband, wie in Rennspielen):

```js
const diff = targetLevel(time) - player.level;
const xpMult = diff >= 3 ? 1.35 : diff >= 2 ? 1.2 : diff <= -3 ? 0.85 : 1.0;
```

So entscheidet nicht Glück beim Kristallfinden über den Sieg, aber gutes Sammeln bleibt ein Vorteil.

**Waffen-Budget:** Jede Waffe hat pro Stufe einen Ziel-DPS gegen einen Einzelgegner und gegen eine Gruppe (5 Gegner in 100 px). Neue Waffen werden gegen diese Tabelle eingestellt, nicht nach Gefühl.

| Waffenstufe | DPS Einzelziel | DPS Gruppe | Beispiel |
|---|---|---|---|
| 1 | 15 | 15 | Wurfdolch Lv1 |
| 3 | 35 | 50 | |
| 5 | 60 | 90 | |
| Entwicklung | 120 | 220 | |

Waffen haben eine **Rolle**: Einzelziel (Dolch), Fläche (Feuerball, Fass), Kontrolle (Eisspeer), Verteidigung (Klingenkreis), Begleiter (Goblin-Bande). Die Karten zeigen die Rolle als kleines Symbol, damit man bewusst einen ausgewogenen Build baut.

**Gegner-HP-Kurve** passend dazu:

```js
enemyHp(base, stage, t) = base * STAGE_HP[stage] * (1 + 0.012 * t + 0.000035 * t * t)
// t in Sekunden; ergibt für Stage 1 ca. ×1,8 bei 1:00, ×2,9 bei 2:00, ×5,9 bei 4:00
```

Die Konstanten werden so eingestellt, dass die **Time-to-Kill** eines normalen Magiers mit Ziel-Build zu jedem Zeitpunkt bei 0,6 bis 1,0 s liegt.

**Gegner-Schaden:** Kontakt höchstens 8 % der Max-HP pro Treffer, Geschosse höchstens 12 %, Boss-Spezialangriffe höchstens 25 %. Nach jedem Treffer 0,5 s Unverwundbarkeit. Damit stirbt niemand in einer Sekunde durch Pech.

### 7.4 Wellen-Skripte (Director)

Statt nur "Spawnrate steigt" bekommt jede Stage ein **Skript** mit festen Momenten, plus etwas Zufall innerhalb der Wellen:

```js
// src/data/stages.js (Ausschnitt Stage 1)
waves: [
  { at: 0,   dur: 30, mix: { fire_apprentice: 3, fire_mage: 1 }, rate: 0.8 },
  { at: 30,  dur: 30, mix: { fire_apprentice: 2, fire_mage: 2 }, rate: 1.4 },
  { at: 60,  event: 'elite', type: 'fire_mage', affixes: 1 },
  { at: 90,  event: 'swarm', type: 'fire_apprentice', count: 30, shape: 'ring' },
  { at: 120, event: 'miniboss', type: 'fire_master' },
  { at: 150, dur: 45, mix: { fire_mage: 3, frost_mage: 1, fire_master: 0.3 }, rate: 3 },
  { at: 195, event: 'swarm', shape: 'wall', side: 'random', count: 40 },
  { at: 222, event: 'warn' },
  { at: 240, event: 'boss', id: 'ignaz' },
]
```

Formen für Schwärme: `ring` (umzingeln), `wall` (Linie von einer Seite), `stream` (Strom aus einer Richtung), `pincer` (von zwei Seiten). Dazwischen 5 bis 8 Sekunden ruhigere Phasen zum Kristallsammeln. Das gibt dem Lauf einen Rhythmus und macht ihn planbarer.

### 7.5 Sicherheitsnetze gegen Pech

- **Heilungs-Pity:** Liegt dein Leben 20 s unter 30 %, droppt der nächste Elite-Kill garantiert ein Herz.
- **Wiederbelebung:** 1× pro Lauf, wenn man "Goblin-Amulett" ausgerüstet hat (Fähigkeits-Slot oder Talent).
- **Truhen im Lauf** haben feste Inhalte nach Stufe statt Zufall: Mini-Boss-Truhe = 1 Wahl aus 3, Elite-Truhe = 1 garantierte Aufwertung einer eigenen Waffe, Boss-Truhe = 3 Aufwertungen.

### 7.6 Zielwerte für die Simulation

Der Bot (siehe 12.1) spielt jede Stage 50× pro Konfiguration. Zielwerte:

| Stage | Siegquote ohne Upgrades | mit "erwarteten" Upgrades für diese Stage |
|---|---|---|
| 1 | ≥ 85 % | ≥ 95 % |
| 2 | ≥ 60 % | ≥ 90 % |
| 3–4 | 20–40 % | 75–85 % |
| 5–6 | < 15 % | 65–75 % |
| 7–8 | < 5 % | 55–65 % |

"Erwartete Upgrades" = was ein Spieler nach den vorherigen Stages typischerweise an Karten und Gold hat (Tabelle in `sim/expected-progress.js`).

---

## 8. Fähigkeiten-System mit 2 Slots

### 8.1 Aufbau

| Slot | Inhalt | Taste | Handy |
|---|---|---|---|
| fest | **Rolle** | Leertaste | Knopf |
| fest | **Sprint** (Ausdauer) | Shift halten | Knopf halten |
| Slot 1 | frei wählbare Fähigkeit | Q | Knopf |
| Slot 2 | frei wählbare Fähigkeit (ab Konto-Level 3) | E | Knopf |

Goblin-Wut und Goblin-Maschine werden zu normalen Fähigkeiten, die man in einen Slot legt. Vor jedem Lauf wählt man im **Ausrüstungs-Screen** zwei Fähigkeiten.

### 8.2 Aufladearten

| Art | Wie | Beispiele |
|---|---|---|
| Abklingzeit | lädt mit der Zeit | Bärenfalle, Rauchbombe |
| Kills | lädt durch besiegte Gegner | Goblin-Wut, Großer Knall |
| Schrott | lädt durch Zahnräder | Goblin-Maschine, Katapult |

### 8.3 Fähigkeiten und wie man sie freischaltet

| Fähigkeit | Aufladung | Wirkung | Freischaltung |
|---|---|---|---|
| **Goblin-Wut** | 80 Kills | Schockwelle + 6 s Raserei (+60 % Angriffstempo) | Start |
| **Bärenfalle** | 9 s | legt 3 Fallen, halten Gegner 1,6 s fest (Bosse nicht, 40 % Schaden), Schaden | Start |
| **Goblin-Maschine** | Schrott | 12 s Dampf-Mech (MG, Raketen, Stampfer, −70 % Schaden) | Konto-Level 3 |
| **Rauchbombe** | 14 s | 3 s unsichtbar, Gegner verlieren dich und greifen sich teilweise gegenseitig an | Stage 1 gewonnen |
| **Goblin-Katapult** | Schrott (50 %) | 5 Felsen schlagen auf die dichteste Gegnergruppe | Konto-Level 5 |
| **Enterhaken** | 7 s | zieht dich zu einem Gegner/Punkt, kleine Gegner werden zu dir gezogen | Stage 2 gewonnen |
| **Pilzring** | 18 s | Heilzone 5 s (+4 % HP/s), Gegner darin verlangsamt | Konto-Level 8 |
| **Schrottschild** | 16 s | Schild absorbiert 40 % Max-HP für 6 s, wirft Geschosse zurück | Stage 3 gewonnen |
| **Rattenflut** | 100 Kills | 30 Ratten rennen über den Bildschirm und knabbern alles an | Stage 4 gewonnen |
| **Goblin-Ruf** | 20 s | 6 Goblin-Krieger für 8 s | Konto-Level 12 |
| **Totem der Gier** | 25 s | saugt alle Kristalle an, 10 s doppeltes Gold | Stage 5 gewonnen |
| **Zeitbombe** | 22 s | Gegner im Umkreis 3 s eingefroren, danach Explosion mit gesammeltem Schaden | Stage 6 gewonnen |
| **Großer Knall** | 150 Kills | alle Gegner auf dem Bildschirm nehmen massiven Schaden | Stage 8 gewonnen |

Jede Fähigkeit lässt sich mit **Karten + Gold** aufwerten (Abschnitt 9.3). Stufe 5 und 10 schalten ein Extra frei, z. B.:

- Bärenfalle Lv5: 4 Fallen; Lv10: Fallen explodieren.
- Goblin-Maschine Lv5: Flammenwerfer statt MG; Lv10: 2 Raketensalven gleichzeitig.
- Rolle: Lv5 zwei Aufladungen; Lv10 Rolle hinterlässt Krähenfüße.

### 8.4 Fähigkeiten-Level und Skill Trees (Wunsch Fabi, 2026-10-12, Ausbau 2026-10-13)

Ersetzt das Aufwerten von Fähigkeiten mit Karten + Gold aus 8.3/9.3. Karten gibt es nur noch für Waffen und Passive.

- **XP durch Benutzen:** Jeder Einsatz bringt der Fähigkeit XP. Die Menge hängt von der Aufladung ab, damit ein voller Lauf jeder Fähigkeit etwa gleich viel bringt (~100 XP). Gutgeschrieben wird am Ende des Laufs, auch bei Niederlage.
- **Level:** Bedarf 60 + 40 × Level, **höchstens Level 30** (vorher 18). Jedes Level = 1 Skillpunkt, voll ausgebaut sind es 29 Punkte.
- **Rolle und Sprint leveln mit:** Sie sind immer dabei und haben einen eigenen Baum. XP: Rolle 3 pro Rolle (+2 bei perfekter Rolle), Sprint 1,5 pro Sekunde Sprinten.
- Punkte lassen sich jederzeit kostenlos zurücksetzen. Alte Stände, die nicht mehr in den neuen Baum passen, werden zurückgesetzt (die Punkte bleiben frei).

#### Aufbau: knorriger Goblin-Baum (Fabi hat gewählt)

Vier Reihen, von unten nach oben. Eine Reihe öffnet sich, wenn in den Reihen darunter genug Punkte stecken.

| Reihe | braucht | Knoten | Ränge × Punkte |
|---|---|---|---|
| 1 (Wurzeln) | – | Kraft · Tempo · Reichweite | 5 · 5 · 3 |
| 2 (Äste) | 3 Punkte | eigener Skill 1 · **Extra A** · eigener Skill 2 | 3 · 1×2 · 3 |
| 3 (Krone) | 9 Punkte | eigener Skill 3 · **Extra B** | 3 · 1×2 |
| 4 (Spitze) | 15 Punkte | **Meister** (Krone) | 1×3 |

Summe 13 + 8 + 5 + 3 = 29 Punkte = Level 30. Rolle und Sprint haben eigene Wurzel-Knoten statt Kraft/Tempo/Reichweite.

#### Eigene Skills je Fähigkeit

| Fähigkeit | eigener Skill 1 (3 Ränge) | eigener Skill 2 (3 Ränge) | eigener Skill 3 (3 Ränge) | Meister |
|---|---|---|---|---|
| Goblin-Wut | **Blutdurst:** Kills in der Raserei heilen 1/2/3 Leben | **Weite Welle:** Schockwelle +12 % Umkreis und Wucht pro Rang | **Kettenwut:** jeder Kill in der Raserei verlängert sie um 0,1/0,2/0,3 s (höchstens +4 s) | **Berserker:** in der Raserei 30 % weniger Schaden |
| Bärenfalle | **Scharfe Zähne:** +1 Zuschnappen pro Falle und Rang | **Festbeißen:** +0,4 s Festhalten pro Rang | **Köder:** Fallen ziehen Gegner im Umkreis 50/80/110 an | **Fallensteller:** jede 3. Rolle legt eine Falle |
| Goblin-Maschine | **Schnellfeuer:** MG +12 % Feuerrate pro Rang | **Schwere Stiefel:** Stampfer +25 % Schaden und Fläche pro Rang | **Schrottsammler:** Kills im Mech füllen 0,4/0,8/1,2 % Schrott zurück | **Überladung:** Schlussexplosion doppelt so stark und größer |
| Rauchbombe | **Ruhige Hand:** Angriffs-Malus im Rauch 45 → 35 → 25 → 15 % (bis 2026-10-27: 60 → 20 %) (ersetzt die Senkung über die Wurzel-Punkte) | **Verwirrung:** +12 % Chance pro Rang, dass Gegner sich gegenseitig angreifen | **Schattenschritt:** nach dem Rauch 1/2/3 s +20 % Tempo | **Hinterhalt:** 1,5 s nach dem Rauch machen Waffen doppelten Schaden |
| Goblin-Katapult | **Splitter:** jeder Einschlag trifft 1/2/3 Gegner daneben mit Splittern (30 % Schaden) | **Flinke Mannschaft:** Felsen fliegen 15 % schneller pro Rang | **Benommen:** Einschläge betäuben 0,3/0,6/0,9 s | **Dauerfeuer:** 2 s später eine zweite Salve mit halbem Schaden |
| Enterhaken | **Widerhaken:** herangerissene Gegner nehmen 3 s lang +15 % Schaden pro Rang | **Weiter Zug:** Zieh-Umkreis +20 % pro Rang | **Abrollen:** nach der Landung 0,3/0,6/0,9 s unverwundbar | **Doppelhaken:** 2 Aufladungen |
| Pilzring | **Sporen:** Gegner im Ring nehmen +8 % Schaden pro Rang | **Wurzelgriff:** Gegner im Ring stärker verlangsamt (50 → 60/70/80 %) | **Nachwuchs:** am Ende bleiben 1/2/3 Heilpäckchen liegen | **Wandernder Ring:** der Ring folgt dir |
| Schrottschild | **Spiegelblank:** zurückgeworfene Geschosse +30 % Schaden pro Rang | **Nachladen:** endet der Schild ungebrochen, sind 10/20/30 % der Abklingzeit schon geladen | **Dornen:** Nahkämpfer, die den Schild treffen, nehmen 10/20/30 Schaden | **Bollwerk:** mit Schild keine Verlangsamung, die erste Sekunde schluckt alles |
| Rattenflut | **Hungrige Ratten:** jede Ratte beißt denselben Gegner 1/2/3-mal öfter | **Beuteratten:** Ratten schicken Kristalle und Münzen auf ihrem Weg zu dir | **Seuche:** Gebissene nehmen 3 s lang Gift-Schaden | **Rückkehr:** die Ratten rennen noch einmal zurück |
| Goblin-Ruf | **Scharfe Speere:** Krieger +12 % Schaden pro Rang | **Flinke Krieger:** Krieger laufen +12 % und schlagen +6 % schneller pro Rang | **Letzter Hieb:** Krieger explodieren beim Gehen (Schaden 20/40/60) | **Häuptling:** ein großer Häuptling mit doppeltem Schaden kommt mit |
| Totem der Gier | **Goldader:** Kills nahe dem Totem lassen mit 10/20/30 % eine Münze fallen | **Glücksbringer:** +4 % kritische Treffer pro Rang, solange es wirkt | **Weisheit:** +10 % XP pro Rang, solange es wirkt | **Goldener Schutz:** solange es wirkt, schluckt je 25 gesammeltes Gold einen Treffer |
| Zeitbombe | **Langer Zünder:** +0,5 s Einfrieren pro Rang | **Kettenreaktion:** Explosionen +20 % größer pro Rang | **Splitterregen:** jeder explodierende Gegner schießt 1/2/3 Eissplitter | **Zeitschleife:** Überlebende frieren noch einmal 1,5 s ein |
| Großer Knall | **Volltreffer:** +15 % Schaden gegen Elite und Boss pro Rang | **Beben:** Überlebende 1/2/3 s verlangsamt | **Kristallregen:** Getötete geben +20 % XP pro Rang | **Nachhall:** nach dem Knall startet die Aufladung bei 30 % |
| Goblin-Amulett | **Glanz:** +0,5 s Unverwundbarkeit nach dem Aufstehen pro Rang | **Rache:** Rettungs-Stoß +50 % Schaden und +15 % Umkreis pro Rang | **Schutzgeist:** solange unbenutzt +3 % max. Leben pro Rang | **Wiedergeburt:** nach dem Aufstehen 5 s Raserei |

**Rolle** (Wurzeln: **Flink** −6 % Abklingzeit ×5 · **Weite** +8 % Strecke ×3 · **Deckung** +0,06 s unverwundbar ×3)

| Reihe | Knoten |
|---|---|
| 2 | **Perfekter Roller** (3): perfekte Rolle lädt +2 Kills pro Rang mehr, Fenster +15 % pro Rang · **Zweite Ladung** (Extra A, 2): zwei Rollen hintereinander · **Staubwolke** (3): Gegner, durch die du rollst, werden weggestoßen und nehmen 10/20/30 Schaden |
| 3 | **Schwung** (3): nach der Rolle 1,2 s +10 % Tempo pro Rang · **Krähenfüße** (Extra B, 2): jede Rolle streut Krähenfüße (verlangsamen, Schaden) |
| 4 | **Meister: Dritte Ladung** (3) |

**Sprint** (Wurzeln: **Ausdauer** +8 % Ausdauer ×5 · **Erholung** +8 % Erholung ×5 · **Tempo** +4 % Sprinttempo ×3)

| Reihe | Knoten |
|---|---|
| 2 | **Leichtfüßig** (3): Sprinten kostet 8 % weniger Ausdauer pro Rang · **Zweiter Atem** (Extra A, 2): erschöpft kein Abbremsen, Erholung startet sofort · **Ausweichen** (3): beim Sprinten −6 % Schaden pro Rang |
| 3 | **Windschatten** (3): beim Sprinten +15 % Sammelradius pro Rang · **Rammbock** (Extra B, 2): kleine Gegner, in die du sprintest, fliegen weg und nehmen Schaden |
| 4 | **Meister: Unermüdlich** (3): die erste Sekunde jedes Sprints kostet nichts |

#### UI (Recherche + Fabis Wünsche)

- **Bild:** Vollbild-Overlay. Ein krummer Baum (SVG) wächst aus Wurzeln am unteren Rand, Äste führen zu den Knoten. Knoten sind runde Pilz-/Runensteine mit Symbol (Faust, Sanduhr, Ringe, eigene Skills mit Fähigkeits-Icon, Meister mit Krone). Zustände klar unterscheidbar: **gesperrt** (grau, Schloss, Ast dunkel), **lernbar** (pulsiert grün), **teilweise** (Rangpunkte am Rand), **voll** (Gold mit Glanz).
- **Saft im Baum:** Der Stamm füllt sich mit grünem Saft bis zur nächsten Reihe (Fortschritt zu „braucht N Punkte“). Ist die Reihe erreicht, sprießen ihre Knoten (Blätter-Partikel, Ton).
- **Halten zum Lernen („Charge“):** Knoten gedrückt halten → Ring füllt sich in 0,6 s, der Ton steigt, Funken fliegen in den Knoten. Voll → Knall, Partikel, der Knoten leuchtet auf, Ast füllt sich, Rang-Ton (pro Rang höher, voller Knoten mit Fanfare). Weiter halten lernt den nächsten Rang schneller (0,4 s). Früh loslassen: Ring läuft zurück, kein Punkt weg. Tastatur: Leertaste/Enter halten.
- **Zettel:** Tippen wählt einen Knoten, der Zettel zeigt Name, Text, Rang und „jetzt → nächster Rang“. Kurz tippen ohne Halten lernt nichts (keine Fehlkäufe).
- **Level-Up-Feier:** Ergebnis-Screen: „Level N!“ springt rein mit Funken und Ton; in der Rüstkammer pulsiert die Holzmarke, bis man den Baum öffnet.
- **Rüstkammer:** Rolle und Sprint stehen als feste Marken mit „immer dabei“ im Regal, mit Level und Skill-Tree-Knopf.

---

## 9. Meta-Fortschritt: Profil, Karten, Truhen, Shop, Kosmetik

### 9.1 Profil

| Feld | Inhalt |
|---|---|
| Name | frei wählbar, 3–16 Zeichen |
| Avatar | Goblin mit aktueller Kosmetik, im Menü animiert |
| Konto-Level | 1–50, XP aus jedem Lauf (`Kills/10 + Sekunden/4 + 100 × Sieg`) |
| Statistiken | Läufe, Siege, Kills, Bestzeiten, Lieblingswaffe, meiste Kills in einem Lauf |
| Erfolge | ~40 Stück, geben Juwelen und Kosmetik |
| Titel | aus Erfolgen, z. B. "Magierschreck", "Fassbinder" |

Konto-Level schaltet frei: Fähigkeiten (siehe 8.3), Slot 2 (Lv3), Talente, Shop-Bereiche, die vierte Level-Up-Karte (Lv10).

### 9.2 Währungen

| Währung | Bekommt man durch | Ausgeben für |
|---|---|---|
| **Gold** | Läufe, Truhen, Aufgaben | Karten-Upgrades, Holztruhen, Talente, Tagesangebote |
| **Juwelen** | Erfolge, Sterne, Konto-Level, Tagesaufgaben, Boss-Erstsiege | bessere Truhen, Kosmetik, Gold-Pakete |
| **Karten** | Truhen, Tagesangebote, Boss-Siege | Aufwerten des passenden Gegenstands |
| **Schrott** (nur im Lauf) | Zahnräder | Maschine, Katapult |

Alles nur im Spiel verdienbar. **Kein Echtgeld.**

### 9.3 Karten und Aufwertungen

Jede Waffe, jedes Passiv und jede Fähigkeit hat eine **Kartensammlung** und eine **Seltenheit**.

| Seltenheit | Farbe | Beispiele |
|---|---|---|
| Gewöhnlich | grau | Wurfdolch, Wetzstein, Bärenfalle |
| Selten | blau | Feuerball, Klingenkreis, Rauchbombe |
| Episch | lila | Kreissäge, Goblin-Bande, Goblin-Maschine |
| Legendär | gold | Großer Knall, (später) legendäre Waffen |

**Aufwertungskosten** (Karten / Gold), angelehnt an Clash Royale:

| Stufe | Gewöhnlich | Selten | Episch | Legendär |
|---|---|---|---|---|
| 1 → 2 | 2 / 20 | 2 / 50 | – | – |
| 2 → 3 | 4 / 50 | 4 / 150 | – | – |
| 3 → 4 | 10 / 150 | 10 / 400 | 2 / 400 | – |
| 4 → 5 | 20 / 400 | 20 / 1 000 | 4 / 1 000 | – |
| 5 → 6 | 50 / 1 000 | 50 / 2 000 | 10 / 2 000 | 1 / 2 000 |
| 6 → 7 | 100 / 2 000 | 100 / 4 000 | 20 / 4 000 | 2 / 4 000 |
| 7 → 8 | 200 / 4 000 | 200 / 8 000 | 50 / 8 000 | 4 / 8 000 |
| 8 → 9 | 400 / 8 000 | 400 / 15 000 | 100 / 15 000 | 10 / 15 000 |
| 9 → 10 | 800 / 15 000 | 800 / 25 000 | 200 / 25 000 | 20 / 25 000 |

Epische Karten starten auf Stufe 3, legendäre auf Stufe 5. So sind alle Gegenstände bei gleicher Stufe gleich stark.

**Was eine Kartenstufe bringt:**

- Waffen: +6 % Grundschaden pro Stufe. Stufe 5: startet im Lauf auf Waffenstufe 2, wenn gewählt. Stufe 10: eigener Bonus (z. B. Dolch: +1 Dolch dauerhaft).
- Passive: +10 % Wirkung pro Stufe.
- Fähigkeiten: −4 % Abklingzeit und +8 % Wirkung pro Stufe; Extras bei 5 und 10.

Überschüssige Karten (Stufe 10) werden automatisch in Gold umgewandelt.

### 9.4 Talente (ersetzt die heutige Werkstatt)

Die Werkstatt aus v2 wird zu **Talenten**: kontoweite Grundwerte, mit Gold aufwertbar und an Konto-Level gebunden. Die heutigen Stufen werden bei der Migration übernommen.

| Talent | pro Stufe | max | ab Konto-Lv |
|---|---|---|---|
| Scharfe Klingen | +3 % Schaden | 20 | 1 |
| Dicke Haut | +8 max. Leben | 20 | 1 |
| Flinke Füße | +2 % Tempo | 10 | 2 |
| Gierige Finger | +8 % Sammelradius | 10 | 2 |
| Zähe Lunge | +10 % Ausdauer | 10 | 4 |
| Goblin-Schläue | +4 % XP; Stufe 10: 4. Level-Up-Karte | 10 | 6 |
| Gezinkte Würfel | +1 Neu-Würfeln | 3 | 8 |
| Bannfluch | +1 Bannen | 2 | 12 |

### 9.5 Truhen (Lootboxen)

| Truhe | Preis | Gold | Karten | Verteilung (Gew./Selten/Episch/Legendär) | Garantie |
|---|---|---|---|---|---|
| **Holztruhe** | 150 Gold | 80–120 | 6 | 88 / 12 / 0 / 0 | – |
| **Eisentruhe** | 60 Juwelen | 300–400 | 18 | 72 / 24 / 4 / 0 | 1 Selten |
| **Goldtruhe** | 160 Juwelen | 900–1 200 | 45 | 62 / 28 / 9 / 1 | 2 Selten |
| **Magiertruhe** | 420 Juwelen | 2 500–3 000 | 110 | 55 / 30 / 13 / 2 | 1 Episch |
| **Kosmetiktruhe** | 120 Juwelen | – | – | 1 Kosmetik: 70 / 22 / 7 / 1 | keine Doppelten, solange es Neue gibt |

**Weitere Quellen:** Gratis-Holztruhe alle 4 Stunden (max. 2 gespeichert), Siegtruhe nach jedem Boss (Stufe nach Stage: 1–2 Holz, 3–4 Eisen, 5–6 Gold, 7–8 Magier), Erfolge.

**Pity-Regeln** (gespeichert im Profil):

- Spätestens jede **10.** Gold- oder Magiertruhe enthält eine epische Karte.
- Spätestens jede **40.** Gold- oder Magiertruhe enthält eine legendäre Karte.
- Der Zähler wird zurückgesetzt, sobald die Seltenheit vorkommt.

**Transparenz:** Ein ⓘ-Knopf an jeder Truhe zeigt die Wahrscheinlichkeiten und den Pity-Stand.

**Öffnen-Animation:** Truhe wackelt (mehr bei besserem Inhalt) → Deckel springt auf, Lichtsäule in der Farbe der besten Seltenheit → Karten fliegen einzeln heraus (Tippen = nächste) → Zusammenfassung. Bei Legendär: Bildschirm wird kurz dunkel, goldene Partikel, eigener Sound.

### 9.6 Shop

| Bereich | Inhalt | Aktualisierung |
|---|---|---|
| Tagesangebote | 6 Plätze: 1 Gratis-Gold, 3 Kartenpakete (Gold), 1 Kosmetik (Juwelen), 1 Truhe mit Rabatt | täglich, mit Datum als Seed (alle sehen dasselbe) |
| Truhen | alle Truhen aus 9.5 | fest |
| Kosmetik | 4 rotierende Kosmetik-Teile | alle 2 Tage |
| Gold | Gold gegen Juwelen in 3 Größen | fest |

### 9.7 Kosmetik für den Goblin

| Slot | Beispiele | Umsetzung |
|---|---|---|
| Hautfarbe | Grün (Start), Moos, Höhlengrau, Sumpfblau, Feuerrot, Gold | Palette im Generator |
| Hut | Lila Zipfelmütze (Start), Piratenhut, Krone, Kochmütze, Topf, Wikingerhelm, Magierhut (Trophäe von Malvorn) | eigene Ebene + Ankerpunkte |
| Outfit | Lederweste (Start), Ritterrüstung, Lumpen, Anzug, Mechaniker-Overall | Ebene + Palette |
| Dolch-Skin | Bronze, Knochen, Kristall, Fischgräte, Feuerklinge | eigenes Dolch-SVG |
| Roll-Spur | Staub, Funken, Blätter, Regenbogen, Fledermäuse | Partikelfarbe/-form |
| Maschinen-Lackierung | Messing, Rost, Polizeiblau, Flammen, Gold | Palette der Mech-Zeichnung |
| Sieg-Pose | Dolch hoch, Tanz, Hut ziehen, Zunge raus | Victory-Animation |

Kosmetik hat **keine Spielwerte**. Quellen: Kosmetiktruhe, Shop, Erfolge (z. B. Krone für alle Stages mit 3 Sternen), Boss-Trophäen.

### 9.8 Aufgaben und Erfolge

- **Tagesaufgaben** (3 pro Tag, z. B. "Besiege 300 Giftmagier", "Gewinne mit dem Sprengfass", "Rolle 50× durch Geschosse") → Gold, Juwelen, Truhen.
- **Erfolge** (~40, mehrstufig Bronze/Silber/Gold) → Juwelen, Titel, Kosmetik.

---

## 10. UI und Screens

### 10.1 Hub mit Tab-Leiste (wie Mobile-Games)

```
┌───────────────────────────────────────────┐
│ [Avatar] Name  Lv 12 ▓▓▓░░   🪙 3 420  💎 85 │
│                                           │
│        großer animierter Goblin           │
│            [  SPIELEN  ]                  │
│   Stage 4: Knochenacker  ★★☆   ‹  ›       │
│                                           │
├──────┬────────┬────────┬────────┬─────────┤
│ Shop │Sammlung│ Spielen│Fähigk. │ Profil  │
└──────┴────────┴────────┴────────┴─────────┘
```

| Screen | Inhalt |
|---|---|
| **Spielen** | Stage-Karussell, Sterne, Albtraum-Schalter, Schnellstart |
| **Ausrüstung / Loadout** (vor dem Lauf) | 2 Fähigkeits-Slots, Startwaffe wählen (aus freigeschalteten), Vorschau der Werte |
| **Sammlung** | alle Waffen/Passive/Fähigkeiten als Karten, Fortschrittsbalken Karten/Benötigt, Aufwerten-Knopf, Details mit Werten pro Stufe |
| **Fähigkeiten** | freischaltbare Fähigkeiten mit Bedingung ("Stage 3 gewinnen"), Slot-Belegung |
| **Shop** | Abschnitte aus 9.6 |
| **Truhen öffnen** | Vollbild-Animation |
| **Kosmetik / Garderobe** | Goblin dreht sich, Slots links, Auswahl rechts |
| **Profil** | Statistiken, Erfolge, Titel, Name ändern |
| **Einstellungen** | Ton, Musik, Bildschirmwackeln an/aus, Schadenszahlen an/aus, Linkshänder-Modus (Knöpfe links) |
| **Ergebnis** | Zeit, Kills, Schaden pro Waffe (Balkendiagramm), Belohnungen fliegen in die Leiste |

### 10.2 HUD im Lauf

- Oben: XP-Leiste, Zeit, Kills, Gold; Boss-Leiste mit Phasen-Segmenten.
- Links oben: Waffen- und Passiv-Slots (wie v2), dazu Rollen-Symbol pro Waffe.
- Rechts unten: Rolle, Sprint, Fähigkeit 1, Fähigkeit 2 in einem Bogen. Linkshänder-Modus spiegelt.
- Off-Screen-Pfeile am Bildschirmrand.

### 10.3 UI-Sounds

Wie v2 (Hover, Klick), dazu: Tab-Wechsel (Wisch), Karte aufwerten (aufsteigende Töne + Amboss), Truhe wackeln (Holzknarren), Seltenheit enthüllen (eigener Ton pro Seltenheit), nicht genug Gold (Brummen + Wackeln des Preises).

---

## 11. Roadmap in Phasen

Jede Phase endet mit einem spielbaren Stand. Die Reihenfolge ist so gewählt, dass frühe Phasen späteren die Arbeit erleichtern.

### Phase 0 – Umbau (Grundlage) ✅ erledigt 2026-10-11
- [x] Projektstruktur aus 3.1 anlegen, esbuild-Build (`npm run build`), Ausgabe weiterhin eine HTML-Datei
- [x] `game.js` nach Modulen aufteilen, Verhalten unverändert
- [x] Seeded RNG, fester Zeitschritt, Event-Bus, Szenen-Statemachine
- [x] Save v2 + Migration von v1
- [x] Bot und Simulation auf die neue Struktur umziehen, `npm run sim`

**Fertig, wenn:** v2-Gameplay identisch läuft und die Simulation gleiche Siegquoten liefert (±5 %).

**Ergebnis** (je 100 Läufe, Bot mit 30 Hz wie in v2): alle 6 Konfigurationen innerhalb ±5 %.

| Konfiguration | v2 | v3 @ 30 Hz | v3 @ 60 Hz |
|---|---|---|---|
| Stage 1 | 100 % | 100 % | 100 % |
| Stage 2 | 94 % | 93 % | 95 % |
| Stage 3 | 14 % | 19 % | 20 % |
| Stage 3, atk/hp 4 | 47 % | 49 % | 61 % |
| Stage 4, atk/hp 6 | 15 % | 12 % | 12 % |
| Stage 5, atk/hp 8, spd 3 | 6 % | 3 % | 3 % |

**Abweichungen vom Plan / Hinweise für später:**
- Die Simulation läuft jetzt standardmäßig mit 60 Hz wie das Spiel (`--hz 30` für den alten Takt). Der Bot reagiert dabei doppelt so oft und gewinnt Stage 3 mit Werkstatt öfter. Zielwerte in 7.6 gelten ab jetzt für 60 Hz.
- Save v2 speichert die Werkstatt-Stufen vorerst 1:1 unter `talents`. Die Umrechnung ×2 aus 14.1 kommt erst mit Phase 5 (Talente ersetzen die Werkstatt) als Migration v2 → v3. Ebenso die rückwirkenden Siegtruhen (Phase 6).
- `stats` (Läufe, Siege, Kills, Spielzeit) werden schon jetzt über den Event-Bus gezählt.
- Zufall: Spiellogik nur über die Seed-Streams (`game`, `spawn`, `loot`, `lvl`), Optik über `frand`. Gleicher Seed + gleiche Eingabe = gleicher Lauf (geprüft).
- Rendern interpoliert Spieler, Gegner und Kumpel zwischen den 60-Hz-Schritten.
- Neu: `npm test` (Save-Migration, RNG), `npm run lint` (ESLint), `window.GOBLIN` als Schnittstelle für Bot und Tests.

### Phase 1 – Sprites und Animation ✅ erledigt 2026-10-12
- [x] `mages.py`: Schul-System (Palette + Kopf + Stabspitze + FX), 8 Richtungen → `src/gen/mages.js`
- [x] `goblin.py`: Ebenen, Ankerpunkte, 8 Richtungen, Sprint/Roll/Hurt/Victory/Death → `src/gen/goblin.js`
- [x] `minions.py`: Skelett, Geist, Golem, Ratte → `src/gen/minions.js`
- [x] ~~Atlas-Build (optional)~~ nicht nötig (siehe unten), `face8()` mit Hysterese
- [x] Sprint- und Dash-Polish aus 4.3, Hitstop, Spawn-Portale, Tod-Auflösen

**Fertig, wenn:** alle 8 Richtungen sauber wechseln und Rolle/Sprint die neuen Animationen zeigen.

**Abweichungen vom Plan / Hinweise für später:**
- Die Generatoren sind **JavaScript statt Python** und laufen **im Browser beim Laden**. Kosmetik (Phase 6) erzeugt so jede Kombination ohne zusätzliche Dateien, und die HTML-Datei ist von 576 auf ~250 KB geschrumpft. `node tools/gen/dump.mjs build/sprites --png` exportiert alles als SVG/PNG zum Anschauen.
- Köpfe, Ohren, Hüte usw. sind Pseudo-3D-Punkte (`kit()` in `src/gen/svg.js`), die je Richtung gedreht werden. Ankerpunkte für Hüte braucht es dadurch nicht mehr: Der Hut wird im selben Modell mitgezeichnet.
- Kein Atlas: Magier werden in Einheiten (Schule × Animation) nachgeladen, Menü zuerst, Rest im Hintergrund, Stage-Start wartet nur falls nötig. Menü steht nach ~1,1 s. Gespiegelte Richtungen teilen sich ein Bild.
- Gegner-Zuordnung: Schattenlehrling/Schattenmagier → Schatten, Großmagier → Feuer-Meister, Blitzmagier → Sturm, Giftmagier → Gift, Heilmagier → Licht, Funkenwichtel → Feuer. Bosse sind Meister ihrer Schule, Malvorn ist vorerst Licht-Meister. Nekro und Erde sind fertig gezeichnet, kommen aber erst mit ihren Gegnern (Phase 2) ins Spiel.
- Noch offen für Phase 2: eigene Geschosse/Einschläge für Sturm, Gift, Schatten, Nekro, Erde, Licht (jetzt noch Feuerball/Eisspeer, teils eingefärbt); Sieg-Pose wird im Ergebnis gezeigt, aber noch nicht auf einem eigenen Ergebnis-Bildschirm.
- Hitstop nur bei Elite- und Boss-Kill, nicht bei kritischen Treffern (die kommen zu oft, das würde ruckeln).
- Sichtbare Spawns brauchen 0,4 s im Portal (dabei nicht angreifbar). Sim: alle Konfigurationen im Streubereich.

### Phase 2 – Magierschulen ✅ erledigt 2026-10-12
- [x] KI-Bausteine (5.5) mit einheitlichem Cast-Ablauf
- [x] 8 Schulen × 3 Rollen aus 5.3 als Daten + Verhalten
- [x] Elite-Affixe (5.4)
- [x] Hinweis-Toast beim ersten Auftauchen (gibt es schon) auf neue Gegner erweitern
- [x] Eigene Geschosse und Einschläge je Schule (offen aus Phase 1): Sturm, Gift, Schatten, Nekro, Erde, Licht
- [x] Neue Gegner in die heutigen 5 Stages einsortieren (bis die Wellen-Skripte aus Phase 3 und die Stages aus Phase 7 kommen)

**Umsetzung:**
- `src/data/enemies.js`: alle 24 Gegner + Diener/Objekte als Daten (Schule, Rolle, `ai`, `casts`, `traits`).
- `src/game/casts.js`: jeder Zauber hat Ausholzeit (mind. 0,6 s), Farbe, optional Ziellinie, `start` (Bodenwarnung schon beim Ausholen) und `release`. Grenzen: 6 + 2×Stage Geschosse, 4 Bodenwarnungen gleichzeitig.
- `src/game/hazards.js`: Bodenwarnungen als Kreis/Linie/Kegel/Strahl mit Warn- und Aktivphase; `dangerVec()` sagt dem Bot, wohin er ausweichen muss.
- `src/game/affixes.js`: 7 Elite-Eigenschaften, ab Stage 3 eine, Endlos zwei.

**Abweichungen / Hinweise für später:**
- Bewegungsarten: chase, kite (mit Kreisen im Wunschabstand), zigzag, still. "Blink" und "Charge" sind Zauber (Blinzler, Paladin), kein eigener Bewegungsbaustein. "Flank" fehlt noch – kein Gegner aus 5.3 braucht ihn bisher.
- Elites sind nur normale Magier (Rolle "mage"), keine Meister – ein Meister mit ×14 Leben war zu viel.
- Klone schießen harmlose, halbdurchsichtige Bolzen und haben keinen Schatten am Boden; sie verschwinden, wenn der echte Spiegelmagier stirbt.
- Der Lich holt Geister aus "Gräbern" (Orte, an denen zuletzt Magier starben).
- Balance (Bot, 60 Hz, je 60–100 Läufe): Stage 1 100 %, 2 98 %, 3 15–22 %, 3+Werkstatt 49–58 %, 4+Werkstatt 25–30 % (vorher 12 %), 5+Werkstatt 0 % (vorher 3–5 %). Stage 4 ist also leichter, Stage 5 schwerer geworden → in Phase 3 mit Wellen-Skripten und Kraftkurve angleichen. In Stage 4 machen Giftpfützen den meisten Schaden.

### Phase 3 – Balancing-System ✅ erledigt 2026-10-12
- [x] Level-Up-Regeln (7.2) inkl. Bannen und Sperren
- [x] Kraftkurve, XP-Aufholregel, Gegner-HP-Formel (7.3) in `balance.js`
- [x] Wellen-Skripte für alle Stages (7.4)
- [x] Sicherheitsnetze (7.5) – bis auf die Wiederbelebung (siehe unten)
- [x] Simulationen gegen die Zielwerte (7.6), Bericht als Tabelle

**Umsetzung:**
- `src/game/offer.js`: Level-Up-Regeln als reine Funktionen (Reihenfolge: gesperrte Karte, Entwicklung, Startphase, Fokus, Pity-Passiv, Rest gewichtet). Jede Karte trägt ein `why`; "Gesperrt" und "Passt zu deiner Waffe" stehen auf der Karte. `test/levelup.test.js` prüft die Garantien in 10 000 Zufallsläufen.
- Level-Up-Fenster: Neu würfeln (R), Bannen (B), Sperren (L), Überspringen mit +15 Gold oder +20 % Leben. Bannen/Sperren: erst Knopf, dann Karte. Eine vierte Karte geht schon (`run.cardN`), freigeschaltet wird sie in Phase 5.
- `src/game/balance.js`: Ziel-Level, XP-Aufholregel, `enemyHp` mit `STAGE_HP`, Schadensdeckel je Art (Kontakt 8 %, Geschoss 12 %, alles andere 25 %). `stages.js` hat kein eigenes `hp` mehr.
- `src/data/stages.js`: Wellen-Skripte aus Phasen (`ph`) und Ereignissen (`ev`), 4–7 s Ruhe zwischen Phasen. Neu: Mini-Boss bei 2:00 (Meister mit ×5 Leben, violette Aura, Truhe), Schwarm-Formen ring/wall/stream/pincer. Endlos spielt das Skript je Runde erneut (+2/s Spawnrate, +25 % Schwarmgröße pro Runde).
- Truhen: Mini-Boss = Wahl aus 3, Elite = 1 Aufwertung, Boss = 3 Aufwertungen (automatisch, mit Banner). Heilungs-Pity: 20 s unter 30 % Leben (aufsummiert) → nächster Elite/Mini-Boss lässt ein Herz fallen.
- Simulation: `npm run sim` spielt jede Stage ohne und mit erwarteten Upgrades (`sim/expected-progress.js`) und zeigt Ziel und ✓/↑/↓. Läuft parallel (`--par`, Standard 3) und nimmt nie mehr Seiten, als freier Speicher da ist: Am 2026-10-12 hat `--par 6` WSL per OOM-Kill komplett abstürzen lassen. WSL hat jetzt 8 GB.

**Ergebnis** (Bot "Normal", 60 Hz, je 100 Läufe; Streuung ca. ±7 Punkte):

| Stage | ohne Upgrades | Ziel | mit erwarteten | Ziel |
|---|---|---|---|---|
| 1 | 100 % | ≥ 85 % ✓ | – | |
| 2 | 100 % | ≥ 60 % ✓ | 100 % | ≥ 90 % ✓ |
| 3 | 30 % | 20–40 % ✓ | 72 % | 75–85 % (knapp) |
| 4 | 35 % | 20–40 % ✓ | 97 % | 75–85 % ✗ zu leicht |
| 5 | 4 % | < 15 % ✓ | 66 % | 65–75 % ✓ |

Stellschrauben je Stage: `dmg` und `rate` (Stage 3: 1,5/1,32 · 4: 1,8/1,58 · 5: 1,2/1,05).

**Abweichungen / Hinweise für später:**
- Stage 4 mit Upgrades ist zu leicht, und dichtere späte Wellen ändern daran nichts. Die Werkstatt-Stufen sind sehr stark (hp=6 sind +72 Leben), und die Bosse sterben in ~12 s statt in ~60 s. Lösung in Phase 5 (Talente statt Werkstatt, Erwartungstabelle neu) und Phase 7 (`bossHp` nach 14.3).
- Time-to-Kill (0,6–1,0 s) wird noch nicht gemessen; eingestellt ist nach Siegquoten.
- Wiederbelebung (Goblin-Amulett) fehlt noch → Phase 4 als Fähigkeit.
- Drei Bot-Stärken (12.1) gibt es noch nicht, nur "Normal".

### Phase 4 – Fähigkeiten ✅ erledigt 2026-10-12
- [x] 2 Slots + Loadout-Screen
- [x] die 13 Fähigkeiten aus 8.3 (+ Goblin-Amulett aus 7.5)
- [x] Freischaltung über Konto-Level und Stage-Siege

**Umsetzung:**
- `src/data/abilities.js`: alle Fähigkeiten als Daten (Aufladeart `cd`/`kills`/`scrap`/`once`, Bedarf, Freischaltung). `src/game/abilities.js`: Slots (`run.abil`), Aufladung, Effekte; laufende Effekte in `run.abfx`, Zeichnen in `src/render/draw-abilities.js`.
- Tasten Q (Slot 1) und E (Slot 2, F geht weiter). Die beiden Handy-Knöpfe zeigen Icon und Kurznamen der gewählten Fähigkeit.
- Ausrüstungs-Screen zwischen Stage-Wahl und Lauf (`src/ui/loadout.js`): Slot antippen, dann Fähigkeit; gesperrte zeigen ihre Bedingung. Gespeichert in `save.loadout`.
- Konto-Level ist jetzt echt: XP nach 14.3 am Ende jedes Laufs, im Ergebnis „+XP · Level N!“ und „Neu freigeschaltet: …“. Slot 2 ab Konto-Level 3. Die Profil-Seite kommt mit Phase 5.
- **Goblin-Amulett** (Wiederbelebung aus 7.5) ist eine Fähigkeit mit Aufladeart „1× pro Lauf“ (ab Konto-Level 6). Intern heißt sie `charm`, weil `amulet` schon das Passiv „Wirbelamulett“ ist.
- Talente aus der Werkstatt wirken weiter: „ult“ senkt den Kill-Bedarf, „mech“ verlängert die Maschine.
- Bot: setzt jede bereite Fähigkeit sofort ein. `npm run sim -- --loadout trap,smoke` testet andere Kombinationen (Standard rage,mech wie bisher, damit die Balance aus Phase 3 vergleichbar bleibt). Die Sim zeigt die Zahl der Einsätze.

**Stärke der Fähigkeiten** (Bot, Stage 3 mit erwarteten Upgrades, Partner „Totem“ ≈ keine Fähigkeit, je 80–100 Läufe; ohne Fähigkeit ~25 %):

| Fähigkeit | Sieg | | Fähigkeit | Sieg |
|---|---|---|---|---|
| Goblin-Wut | 60–65 % | | Schrottschild | 49 % |
| Goblin-Amulett | 53 % | | Goblin-Maschine | 51–58 % |
| Rattenflut | 56 % | | Bärenfalle | 46 % |
| Rauchbombe | 44 % | | Goblin-Ruf | 44 % |
| Großer Knall | 41 % | | Pilzring | 40 % |
| Enterhaken | 39 % | | Goblin-Katapult | 30–40 % |
| Zeitbombe | ~24 % | | | |

Angeglichen: Wut schwächer (Schockwelle 40+6×Lv statt 60+9×Lv); Falle, Katapult, Haken, Ratten, Ruf, Zeitbombe und Knall stärker bzw. schneller geladen.

**Abweichungen / Hinweise für später:**
- Zeitbombe und Großer Knall brauchen „Stage 6/8 gewonnen“. Stage 6 ist heute Endlos (nie „gewonnen“), Stage 8 gibt es noch nicht → erst mit Phase 7 erreichbar. Die Zeitbombe ist im Bot-Test kaum besser als nichts; mit Phase 7 neu ansehen.
- Der Bot nutzt Fähigkeiten nicht taktisch (Rauch, Haken, Schild sofort). Für Menschen sind die defensiven Fähigkeiten wohl stärker, als die Tabelle sagt.
- Aufwertung der Fähigkeiten mit Karten + Gold (Stufe 5/10-Extras) kommt mit Phase 5 (Karten).
- Neue Spieler haben bis Konto-Level 3 nur einen Slot (vorher immer Wut + Maschine). Ein erster Sieg auf Stage 1 bringt ~390 XP, Level 3 ist nach 2–3 Läufen erreicht.

### Phase 5 – Meta: Profil, Karten, Talente
- [x] Fähigkeiten-XP und Skill Trees (8.4)
  - Skill Tree über den Knopf „Skill Tree“ an jeder Fähigkeit im Ausrüstungs-Screen; die Karte zeigt Level und XP-Balken, im Ergebnis steht „+XP · Level N! +1 Skillpunkt“.
  - Gespeichert in `save.abilities`. Baum-Werte gelten für den ganzen Lauf (`run.abMods`), XP wird am Laufende gutgeschrieben (auch bei Niederlage).
  - Balance: ohne gelernte Punkte unverändert (Stage 3 mit Upgrades 74 %). Ein voll ausgebauter Baum (+40 % Kraft, −25 % Abklingzeit, Extras) macht eine Fähigkeit deutlich stärker – das ist der Langzeit-Fortschritt und muss mit den Zielwerten in Phase 8 noch einmal geprüft werden.
  - **Rüstkammer statt Ausrüstungs-Screen (Wunsch Fabi):** eigener Bildschirm im Hauptmenü im Stil eines Goblin-Lagers. Holzbalken mit zwei Haken (Q/E), an denen die Fähigkeiten als Schilder hängen (schwingen beim Umhängen), der Goblin in der Mitte, alle Fähigkeiten als Holzmarken auf einem Regal (Level, Slot, lila Punkt = Skillpunkte frei), Pergamentzettel mit Details, „An Q/E hängen“ und Skill Tree. Die Auswahl bleibt gespeichert, Stages starten direkt (`src/ui/armory.js`).
  - **Ladebildschirm (Wunsch Fabi):** Der Goblin rennt über die Wiese, drei Feuermagier jagen ihn, er hüpft über ihre Feuerbälle; darüber Logo, Holz-Fortschrittsbalken mit Statuszeile, ein Spieltipp (`src/render/loading-scene.js`). Zuerst werden nur die Sprint-Bilder erzeugt, damit er sofort rennt. Geladen werden alle Bilder plus die Magier der *freigeschalteten* Stages; danach lädt im Menü nichts mehr nach (vorher 13 Ruckler bis 150 ms). Gesperrte Stages laden beim ersten Start („Lade Magier …“). Neuer Spieler: Menü nach ~1,5–2 s (Headless).
  - Fix: Sobald der Boss im Bild war, brach das Zeichnen ab (Spieler weg, Bild eingefroren). Ursache seit Phase 2: Lebensbalken-Abfrage `ETYPES[e.type]` gab es für den Boss nicht. Neu: `npm run smoke` spielt jede Stage im Browser mit Zeichnen bis in den Bosskampf.
- [x] Profil, Konto-Level, Statistiken
  - Profil-Tab (`src/ui/profile.js`): Name ändern (3–16 Zeichen), Konto-Level mit XP-Balken, Statistiken (Läufe, Siege, Siegquote, Kills, Spielzeit, meiste Kills und höchstes Level in einem Lauf, freie Fähigkeiten, Lieblingswaffe), Stages mit Stand und Bestzeit, Liste „Konto-Level schaltet frei“ mit dem nächsten Ziel hervorgehoben.
  - Neu im Save (ohne Versionssprung, `normalize` füllt auf): `stats.bestKills`, `stats.bestLevel`, `stats.weapons` (in wie vielen Läufen welche Waffe dabei war), `lastStage`.
  - Titel und Erfolge fehlen noch → Phase 6 (9.8).
- [ ] ~~Kartensammlung, Seltenheiten, Aufwerten mit Karten + Gold (9.3) – nur Waffen und Passive~~ → **verschoben nach Phase 6, direkt nach den Truhen** (Entscheidung Fabi, 2026-10-13: ohne Truhen gibt es keine Kartenquelle). Stärke wie in 9.3 (+6 % Waffenschaden bzw. +10 % Passiv-Wirkung pro Stufe).
- [x] Talente statt Werkstatt (9.4)
  - `src/data/talents.js`, Save v3 mit Migration: Werkstatt-Stufen ×2; „Kurze Zündschnur“ und „Goblin-Ingenieur“ entfallen (macht jetzt der Skill Tree), ihr Gold wird erstattet.
  - Abweichung: Dicke Haut +6 statt +8 Leben pro Stufe, damit migrierte Spielstände nicht stärker werden (Stage 4 mit Upgrades ist ohnehin zu leicht).
  - Goblin-Schläue Stufe 10 gibt die 4. Level-Up-Karte, Bannfluch +1 Bannen.
  - Sim-Erwartungen (`sim/expected-progress.js`) auf Talent-Stufen umgerechnet: Stage 3 75 %, 4 94 %, 5 59 % (vorher 72/97/66, also im Streubereich gleich).
- [x] Hub mit Tab-Leiste (10.1)
  - Leiste oben: Avatar (Goblin-Kopf), Name, Konto-Level mit XP, Gold, Zahnrad für Einstellungen (Ton, Musik, Wackeln, „So spielst du“). Tab-Leiste unten aus Holz: Talente · Rüstkammer · **Spielen** (erhöht) · Profil, Wisch-Ton und Einschieben beim Wechsel.
  - Spielen: Stage-Karussell statt Stage-Liste (Pfeile, ←/→ oder A/D, Wischen am Handy, Enter startet), Punkte zeigen geschafft/gesperrt, die Karte zeigt Bestzeit und welche Fähigkeit ein Sieg freischaltet. Der große Knopf startet direkt; die Wahl bleibt gespeichert, nach einem Erstsieg springt das Karussell auf die neue Stage.
  - Shop und Sammlung kommen als eigene Tabs dazu, sobald es sie gibt (Phase 5 Karten, Phase 6 Shop). Juwelen erscheinen erst mit Phase 6 in der Leiste.
  - `npm run smoke` klickt jetzt auch durch den Hub (Tabs, Karussell, Name, Einstellungen, Start).
- [x] **Bug (gemeldet von Fabi, 2026-10-12): Lag beim Rundenstart.** *(Behoben 2026-10-13 mit dem Sprite-Atlas aus Phase 8, Fabi spürt keinen Lag mehr.)* Beim Start eines Laufs ruckelt es. Ursache messen (Sprites erzeugen, Musik starten, erste Spawns?) und vorziehen bzw. verteilen.
  - Stand: Fabi spürt es im PC-Browser (Windows) bei den ersten Gegnern/Tönen. Headless (auch mit 4× CPU-Bremse) kein Start-Ruckler, keine spät erzeugten Bilder/Canvases, JS pro Frame nur wenige ms. GPU über WSL (`GALLIUM_DRIVER=d3d12`, RTX 3070) ruckelt auch im Menü → als Messplatz unbrauchbar.
  - Neu: Mess-Modus `goblin-io.html?perf` (`src/perf.js`) zeichnet auf Fabis Gerät jeden Frame > 50 ms mit Kontext auf (Logik/Zeichnen, Gegner, neue Bilder, Töne, Long Animation Frames); „Kopieren“ liefert den Bericht.
  - Verdacht ohne Beleg: Musik plant nur 0,12 s voraus (setInterval auf dem Haupt-Thread), jeder kurze Hänger lässt sie stolpern.
  - Neuer Verdacht (2026-10-13, Performance-Budget in Phase 8): Jedes Sprite-Bild war eine eigene kleine Canvas; der Browser lädt sie erst beim ersten Zeichnen als Textur auf die GPU – genau bei den ersten Gegnern. Dazu entstanden beim ersten Kill jeder Gegnerart getönte Bilder. Beides ist mit dem Sprite-Atlas weg. Fabi soll prüfen, ob der Start-Ruckler damit verschwunden ist (sonst `?perf`-Bericht schicken).
- [x] **Skill Tree v2 (8.4, Ausbau 2026-10-13):** knorriger Baum, Halten zum Lernen mit Ton und Effekten, Level bis 30, eigene Skills je Fähigkeit, Rolle und Sprint mit eigenem Baum
  - Daten: `TREE`/`ROWS`/`MOVES`, Texte je Fähigkeit in `skills`/`master` (`src/data/abilities.js`). Wirkung in `src/game/abilities.js` (Haken `onKill`, `takenMult`, `dealtMult`, Rolle/Sprint in `initMoves`/`updMoves`), dazu combat/items/player/hazards/enemies.
  - Neue Gegner-Felder: `slowK` (stärkere Verlangsamung, sonst 50 %), `vuln`/`vulnT` (nimmt mehr Schaden). Fähigkeiten-Slots haben `max`/`stock` für mehrere Ladungen (Doppelhaken), die Rolle `dashN`/`dashMax`; Zahl am Knopf.
  - UI `src/ui/tree.js`: SVG-Baum mit Saft (Stamm = Fortschritt zur nächsten Reihe, Ast = Ränge), Knoten als Steine (Wurzel/Skill/Extra lila/Meister mit Krone), Halten 0,6 s (danach 0,4 s je Rang) mit steigendem Ton und einfliegenden Funken, Knall + Partikel + Rang-Ton beim Lernen, sprießende Reihe mit Blättern, Meister mit Goldblitz. Tastatur: Pfeile + Leertaste halten. Handy quer: Baum links, Zettel rechts.
  - Rüstkammer: Rolle und Sprint als feste Marken vorn im Regal. Ergebnis: aufgestiegene Fähigkeit springt mit Funken und Ton rein.
  - Alte Bäume: Extra B brauchte 6 Punkte unten, jetzt 9 Punkte in Reihe 1–2 → passt ein Stand nicht mehr, wird er zurückgesetzt (Punkte bleiben frei). Rauch: die Wurzel-Punkte senken den Angriffs-Malus nicht mehr, das macht jetzt „Ruhige Hand“.
  - Balance: ohne Baum-Punkte unverändert (Sim Welt 3: 100/100/100/100/75 %). Voll ausgebaute Bäume (Level 30) sind deutlich stärker – Langzeit-Fortschritt, in Phase 8 mit den Zielwerten prüfen.
  - `npm run smoke` lernt per Halten, prüft Rolle mit 2 Ladungen und spielt jede Fähigkeit mit vollem Baum 40 s. Dabei aufgefallen: Die Smoke-Schleife setzte bisher nie Fähigkeiten ein (pausiert → `useAbility` tut nichts), jetzt behoben.
- [x] **Skill Tree befriedigender machen (Wunsch Fabi, 2026-10-12):** Animationen beim Lernen (Knoten leuchtet auf, Linie zum nächsten Knoten füllt sich, Partikel), eigene Sounds pro Rang, Level-Up der Fähigkeit mit kleiner Feier.
- [x] **Mehr Level und fähigkeitsspezifische Skills im Tree (Wunsch Fabi, 2026-10-12):** → Skill Tree v2, Level 30, 3 eigene Skills + Meister je Fähigkeit. höhere Level-Grenze als 18 und mehr eigene Knoten je Fähigkeit statt nur Kraft/Tempo/Reichweite + 2 Extras (z. B. Rauchbombe: Malus im Rauch senken als eigener Knoten).
- [x] **Standard-Fähigkeiten leveln, mehrere Dashes (Wunsch Fabi, 2026-10-12):** → Rolle (bis 3 Ladungen, Krähenfüße) und Sprint mit eigenem Baum. Rolle und Sprint bekommen ebenfalls Level/Skill Tree, z. B. 2–3 Aufladungen für die Rolle (Idee aus 8.3: Lv5 zwei Aufladungen, Lv10 Krähenfüße).
- [x] **Fähigkeiten aufeinander abstimmen (Wunsch Fabi, 2026-10-12):** Regeln, welche Fähigkeiten zusammen gehen. Beispiel: Während der Goblin-Maschine keine anderen Fähigkeiten. Für alle Paare prüfen und im HUD zeigen (Knopf gesperrt).
  - Alle Paare geprüft: Nur die Goblin-Maschine verträgt sich nicht (Haken und Rolle würden den Mech durch die Luft werfen, Schild/Pilzring/Katapult stapeln sich mit Panzer und Arsenal). Solange sie läuft, sind die andere Fähigkeit, Rolle und Sprint gesperrt: grauer Knopf mit Schloss, beim Drücken Brummen und „In der Maschine“. Aufladen läuft weiter. Alles andere bleibt erlaubt und ist gewollt (Zeitbombe + Großer Knall, Rauch + Haken, Ruf + Wut, Schild + Pilzring …).
  - Regel an einer Stelle: `lockOf(id)` in `src/game/abilities.js`; `npm run smoke` prüft die Sperre.
- [x] **Bug (gemeldet von Fabi, 2026-10-12): Spiel friert beim Tod ein.** Statt Sterbe-Animation blieb das Bild stehen, „Nochmal“ blieb eingefroren, hinter dem Menü hing der alte Lauf.
  - Ursache: Die Spielschleife (`src/core/loop.js`) macht pro Bild mehrere 60-Hz-Schritte. Starb der Goblin nicht im letzten davon, wechselte die Szene zu „results“ (hat kein `update`) und der nächste Schritt warf einen Fehler. Weil `requestAnimationFrame` erst am Ende stand, war die Schleife danach für immer tot. Deshalb trat es nur manchmal auf.
  - Fix: Szene bei jedem Schritt neu prüfen; nächsten Frame zuerst anmelden, damit ein Fehler nur ein Bild kostet. Test `test/loop.test.js`, und `npm run smoke` stirbt jetzt echt und prüft Sterbe-Animation, „Nochmal“ und „Menü“.
- [x] **Rauchbombe: langsamer angreifen, solange man unsichtbar ist (Wunsch Fabi, 2026-10-12).**
  - Im Rauch greifen die Waffen 60 % langsamer an (nur Waffen, nicht Fähigkeiten oder Goblin-Bande). Jeder Punkt in Kraft/Tempo/Reichweite des Rauch-Baums senkt den Malus, erst mit allen 13 Punkten 20 % (`smokeAtkSlow` in `src/data/abilities.js`). Der Skill Tree zeigt den aktuellen Wert.
  - Sim (Bot zündet den Rauch sofort, ~25× pro Lauf, also ~30 % der Zeit unsichtbar): mit Upgrades deutlich schwächer, Stage 3 70 → 38 %, Stage 4 75 → 60 %. Für Menschen, die den Rauch gezielt einsetzen, weniger schlimm. In Phase 8 ansehen, ob die Rauchbombe dafür etwas bekommen sollte (z. B. kürzere Abklingzeit).
- [x] **Gegner zittern an der Stelle, an der der Spieler zuletzt war (Wunsch Fabi, 2026-10-12).**
  - Im Rauch: Jeder Gegner sucht auf einem eigenen Ring (60–140 px) um den alten Platz, der Suchpunkt wandert langsam herum, am Punkt bremsen sie weich ab. Richtungswechsel pro Gegner und Sekunde: 2,8 → 0,2.
  - Auch ohne Rauch standen Nahkämpfer auf dem Spieler und zitterten (3,9 Richtungswechsel/s). Jetzt: nach einer Berührung 0,35–0,55 s zurückweichen (Blick zum Spieler), dann wieder ran → 1,2/s (das ist das gewollte Hin und Her). Sim: Kontaktschaden etwas niedriger, Siegquoten im Streubereich.

- [x] **Welten mit 5 Leveln und Weltkarte (6.1a, Wunsch Fabi, 2026-10-12)** – Magierhüte statt Sterne (Fabi hat aus 5 Vorschlägen gewählt: Hüte, Goldzähne, Beutesäcke, Schädel, Kristalle)
  - `src/data/levels.js`: Level-Skripte aus dem Stage-Skript abgeleitet, `levelStage(si, li)` liefert die spielbare Stage. Level 1–4 enden mit dem Ereignis `clear` nach 2:30 (Magier lösen sich auf, Kristalle fliegen her, „Level geschafft!“, unverwundbar bis zum Ergebnis). HUD zählt dort rückwärts. Boss-Level: Boss bei 1:30.
  - Weltkarte (`src/ui/worldmap.js`, `src/render/map-scene.js`): Boden der Welt, Erdweg nach Catmull-Rom durch die Punkte, gesperrter Teil gepunktet, Boss steht neben seinem Punkt, Goblin läuft mit 8-Richtungs-Animation. Punkte sind Knöpfe (Fahne = geschafft, Hüte darunter). Zettel mit Hut-Bedingungen, Rekord (Kills bzw. schnellster Boss-Sieg) und „Los!“. ←/→ bzw. A/D Level, Q/E bzw. Bild↑/↓ Welt, Enter startet. Nach einem Erstsieg malt sich das neue Wegstück auf und der Goblin läuft hin. Endlose Nacht ist der 6. Punkt der letzten Welt.
  - Ergebnis: Level-Name, Hüte (neue springen rein), „Weiter: 1-3“ / „Welt 2“ / „Endlose Nacht“, „Karte“ statt „Menü“. Profil zeigt Welten mit Hüten und schnellstem Boss-Sieg.
  - Save: `stages[n].lv[0–4] = { hats, kills, fast }`, `map = { si, li, fresh }` (ersetzt `lastStage`). Alte geschaffte Stages = alle Level mit 1 Hut.
  - Belohnung: Gold-Bonus `25 + 20×Welt` (Boss-Level zusätzlich `40 + 30×Welt`); Konto-XP-Bonus voll (100/200) nur für Boss-Level, sonst 40 für Sieg, 50 für Erstsieg.
  - Balance (`npm run sim -- --levels`, erwartete Talente je Welt, 40 Läufe, zwei Seed-Sätze): Schwierigkeit je Level `LEVEL_KIND` (Schaden, Spawnrate, `hpT` = Gegner-Leben wie nach so vielen Sekunden mehr) und je Welt `WORLD_LV` (eigene gleichmäßige Kurve; die alten Stage-Werte `dmg`/`rate` waren für 4-Minuten-Läufe verbogen), Gegner-Leben mit halbem `STAGE_HP`-Zuschlag, Boss ×1,6.

    | Welt | 1 | 2 | 3 | 4 | Boss |
    |---|---|---|---|---|---|
    | 1 | 100 | 100 | 100 | 100 | 98–100 |
    | 2 | 100 | 100 | 100 | 100 | 100 |
    | 3 | 100 | 100 | 93 | 88–93 | 75 |
    | 4 | 100 | 100 | 100 | 93–95 | 53–60 |
    | 5 | 100 | 100 | 100 | 98–100 | 83–93 |

    Welt 1–2 sind bewusst leicht (Einstieg; alte Ziele dort ≥ 85 bzw. ≥ 60 %). Bosskampf dauert ~30 s (vorher ~12 s), das Ziel 45–75 s kommt mit dem Boss-Rework (Phase 7). Level 3/4 der späteren Welten noch etwas leicht → Phase 8.
- [x] **Hub auf Handy quer:** kompakte Leisten, Tab-Leiste nur mit Icons, Zettel rechts neben der Karte; Screens beginnen oben und scrollen, wenn sie höher als der Bildschirm sind (`place-items: safe center`).

### Phase 6 – Truhen, Shop, Kosmetik
- [x] Truhen mit Drop-Tabellen, Pity und Wahrscheinlichkeits-Anzeige (9.5)
  - Logik ohne DOM in `src/game/chests.js` (würfelt mit übergebenem Zufall, Tests in `test/chests.test.js`), Daten in `src/data/cards.js`.
  - **Truhenregal** mit 4 Plätzen im Laden (Fabi hat gewählt). Siegtruhe nach jedem Boss-Level (Welt 1–2 Holz, 3–4 Eisen, 5 Gold); ist das Regal voll, geht sie sofort auf (Ergebnis zeigt „Ansehen“). Gratis-Holztruhe alle 4 h, höchstens 2.
  - **Öffnungszeit je Seltenheit (Wunsch Fabi, 2026-10-13):** Holz 15 min, Eisen 1 h, Gold 3 h, Magier 8 h. Wie bei Clash Royale läuft immer nur eine Truhe; Abkürzen mit 1 Juwel je angefangene 6 min. Gekaufte und Gratis-Truhen öffnen sofort.
  - ⓘ an jeder Truhe: Wahrscheinlichkeiten pro Karte, Garantie, Pity-Stand, Öffnungszeit. Legendäre Gegenstände gibt es noch nicht – ein legendärer Wurf wird bis dahin episch (steht so in der ⓘ-Anzeige).
  - **Juwelen** (9.2): 4 je neuem Hut, 10 je Konto-Level, Boss-Erstsieg 20 + 10 × Welt. Oben in der Leiste neben dem Gold.
- [x] Kartensammlung für Waffen und Passive (9.3, aus Phase 5 hierher verschoben) – Sammlung-Tab, Aufwerten mit Karten + Gold, Karten aus Truhen
  - **Tab-Leiste mit 5 Tabs (Fabi hat gewählt):** Laden · Werkstatt · Spielen · Rüstkammer · Profil; Werkstatt hat die Reiter Karten und Talente. Roter Punkt am Tab: Truhe bereit bzw. Karte aufwertbar.
  - Seltenheiten: gewöhnlich Wurfdolch, Eisspeer, Giftflasche, Knochenbumerang, Wetzstein, Lederrüstung, Herzwurzel, Heilkräuter, Flinke Stiefel, Magnetstein; selten Klingenkreis, Feuerball, Blitzstab, Sprengfass, Zauberbuch, Wirbelamulett, Ölkanne; episch Kreissäge, Goblin-Bande, Schwarzpulver.
  - Wirkung wie 9.3: Waffe +6 % Schaden je Stufe, ab Stufe 5 startet sie auf Waffenstufe 2, Stufe 10 greift 15 % schneller an (statt eines eigenen Bonus je Waffe). Passive +10 % Wirkung je Stufe. Karten über Stufe 10 werden zu Gold (5/15/60/300 je Karte).
  - Kartendetails: Text, „jetzt → nächste Stufe“, Kosten, Aufwerten mit Amboss-Ton und Aufleuchten.
  - Balance: Epische starten auf Stufe 3 (+12 % bzw. +20 %), Sim mit frischem Stand im Streubereich wie vorher (Welt 3: 100/100/93/97/70 %, Welt 5: 100/100/97/100/87 %). Hohe Kartenstufen → Phase 8.
- [x] Öffnen-Animation
  - `src/ui/chest-open.js`: Truhe fällt rein, wackelt 2–5 Mal (je besser der Inhalt, mit Knarzen), Deckel springt auf, Lichtsäule in der Farbe der besten Seltenheit, Funken. Karten fliegen einzeln heraus (Tippen = nächste) mit „×N“, „Neu!“, „Aufwerten möglich!“ und sich füllendem Balken, dann Übersicht. Episch/Legendär: Bildschirm dunkel, goldene Funken, eigener Ton.
- [x] Shop mit Tagesangeboten (9.6)
  - Laden: Truhenregal, Tagesangebote (Gratis-Gold, 3 Kartenpakete für Gold, 1 Truhe −30 % für Juwelen; gleich für alle per Datum-Seed, neu um Mitternacht), alle Truhen zum Kaufen, Gold gegen Juwelen (20/80/200 → 300/1 400/4 000).
  - Der Kosmetik-Platz der Tagesangebote fehlt noch, kommt mit der Garderobe.
- [x] Garderobe, Kosmetik im Generator und im Spiel (9.7)
  - Profil hat Reiter: Profil · Garderobe · Erfolge. Garderobe: Goblin dreht sich durch alle 8 Richtungen, 6 Slots, Auswahl mit Seltenheit; gesperrte Teile als Schatten mit Quelle. Anziehen erzeugt die Spiel-Bilder im Hintergrund neu.
  - 33 Teile (`src/data/cosmetics.js`): Haut ×6, Hut ×7 (Zipfelmütze, Kochmütze, Kochtopf, Piratenhut, Wikingerhelm, Magierhut, Krone – eigene Formen in `gen/goblin.js`), Outfit ×5 (mit Krawatte, Trägern, Platten, Flicken), Dolch ×6 (Tönung der Wurfdolche und Klingen), Roll-Spur ×5 (Partikel und Nachbilder), Maschine ×5 (Lack).
  - Quellen: Kosmetiktruhe (120 Juwelen, keine Doppelten, 70/22/7/1), Tagesangebot im Laden (Juwelen nach Seltenheit), Magierhut als Trophäe beim ersten Sieg gegen Malvorn, Krone über den Erfolg „Hutsammler“ (alle 120 Hüte, seit 8 Welten).
  - Sieg-Posen fehlen noch (brauchen eigene Animationen) → später.
- [x] Tagesaufgaben und Erfolge (9.8)
  - Zähler im Lauf (`run.cnt`) → `save.stats.c` am Laufende (`src/game/progress.js`): Kills je Schule, Elite/Mini-Boss/Boss, Rollen, perfekte Rollen, Fähigkeiten, Weiterentwicklungen, Gold, geschaffte Level, Siege je Waffe, längste Endlose Nacht; dazu Karten-Aufwertungen.
  - 39 Erfolge mit Bronze/Silber/Gold (10/25/60 Juwelen), Belohnung abholen per Knopf, Titel bei Gold (auswählbar, steht unter dem Namen), roter Punkt am Profil-Tab.
  - Tagesaufgaben: 3 pro Tag aus 9 Vorlagen (gleich für alle per Datum), Fortschritt ab Tagesbeginn, Belohnung Gold/Juwelen/Holztruhe, Bonus 20 Juwelen für alle drei.
- [x] **Mehr Wiederspielwert und längerer Grind (Wunsch Fabi, 2026-10-12):** Erfolge tragen lange (z. B. 100 000 Kills, 300 Siege, 50 h, 20 000 Magier je Schule, alle 75 Hüte), dazu Fähigkeiten bis Level 30, Karten bis Stufe 10 und 33 Kosmetik-Teile.

### Phase 7 – Stages und Bosse ✅ erledigt 2026-10-13
- [x] 8 Stages mit Deko und Musik (6.1), Sterne, Albtraum-Modus
  - [x] **8 Welten wie in 6.1** (Phase 7, Teil 2): Goblinwiese, Frostlichtung, Giftsumpf, Knochenacker, Spiegelhain, Sturmklippen, Felsenschlund, Turm der Magier + Endlose Nacht. Aschesteppe und Nebelmoor (mit Pyra und dem Nebelhexer) sind weg. Jede Welt hat Haupt- und Nebenschule laut Tabelle, einen eigenen Farbton (`hue`, Mischmodus „color“) und eigene Boden-Deko (Blumen, Schnee, Pfützen und Pilze, Gräber und Knochen, Spiegelsplitter, Felsen und Blitzspuren, Lava-Risse und Kristalle, Runen und Bücher; `src/render/tiles.js`), dazu ein eigenes Stück (Tempo, Grundtöne, Glöckchen/Orgel/Stöße; `music` in `src/data/stages.js`).
  - **Spielstand v4 (Fabi hat gewählt: „Alles neu“):** Weltfortschritt beginnt neu, Gold, Karten, Talente, Fähigkeiten und Kosmetik bleiben. Fähigkeiten, die über Welt-Siege schon frei waren, bleiben frei (`save.keep`).
  - Freischaltungen „Welt 6/8 schaffen“ (Zeitbombe, Großer Knall) sind jetzt erreichbar. Hutsammler: 15/60/120 Hüte (8 Welten × 15).
  - Giftpfützen höchstens 5 gleichzeitig (liegend + im Flug, `ZONE_CAP`): im Giftsumpf sind Giftmischer die Hauptgegner, ohne Grenze lag ein Teppich. Der Sim-Bot weicht jetzt den roten Zielkreisen anfliegender Lobs aus (wie ein Mensch).
  - Balance (30–40 Läufe, Seeds 1/101): Level 1–4 aller Welten 83–100 % (Level 3/4 meist etwas zu leicht → Phase 8). Boss-Level: Welt 1 63 %, 2 80 %, 3 60 %, 4 73 %, 5 93 % (Platzhalter-Boss), 6 70 %, 7 70 %, 8 60 %. Welt 3/4/7 mit leichterem Boss-Level (`WORLD_LV[].boss`: Schaden und Spawnrate, der Schaden gilt auch für den Boss), weniger Beschwörer in der vollen Mischung von Welt 4/7.
  - Sterne: sind die Magierhüte (6.1a).
  - [x] **Albtraum-Modus** (Teil 3): Schalter am Level-Zettel, sobald der Boss der Welt besiegt ist (bleibt gespeichert, `save.map.nm`). Gegner und Boss +80 % Leben, Elites immer mit 2 Eigenschaften; dafür +50 % Gold und Konto-XP, Siegtruhe eine Stufe besser (Holz → Eisen → Gold → Magier), 5 Juwelen beim ersten Albtraum-Sieg je Level. Geschaffte Albtraum-Level tragen einen roten Schädel, die Karte wird rot abgedunkelt, im HUD steht ☠.
- [x] Boss-Runner mit Phasen, Wut-Timer, Phasenwechsel-Regeln (6.2)
  - Daten in `src/data/bosses.js` (3 Phasen je Boss: Angriffs-Rotation, Tempo, Pause, Extras), Ablauf in `src/game/boss.js` (Angriffe als Bausteine `ATK`). Stages verweisen per `boss.id` darauf.
  - Phasenwechsel bei 66 %/33 %: Leben bleibt an der Schwelle stehen (keine Phase wird übersprungen), Hitstop, kleine Szene (Kamera zoomt auf den Boss, er lädt auf, „Phase 2“ + Satz des Bosses), 1,5 s unverwundbar, alle gegnerischen Geschosse und Bodenwarnungen weg.
  - Wut-Timer nach 120 s Kampf: +50 % Schaden und Tempo (Bewegung, Aufladen, Pausen), Boss rot, Leiste pulsiert. HP-Leiste mit Markierungen bei 66 % und 33 %.
  - Endlose Nacht: jedes Mal ein zufälliger Boss (lädt alle Boss-Modelle vor).
  - Balance (`npm run sim -- --level 5`, 40 Läufe, Seeds 1 und 101; die Sim zeigt jetzt die Kampfdauer und den Schaden je Boss-Angriff): Boss-Leben ×2,8 statt ×1,6, Boss-Schaden 13 statt 18. Siege/Kampfdauer: Welt 1 60–70 %/47 s, Welt 2 73–80 %/65 s (Stand Teil 1, die übrigen Welten siehe 8 Welten oben).
  - Fix Sim: Die Phasen-Szene zog Funken mit dem Spielablauf-Zufall, und der Ausweich-Helfer des Bots würfelte mit `Math.random` → gleiche Seeds gaben verschiedene Ergebnisse. Jetzt wiederholbar.
- [x] 8 Bosse (6.3) + Mini-Bosse
  - [x] **Ignaz der Funkenmeister** (Welt 1): Feuerball-Fächer + Ansturm; Phase 2 zwei drehende Feuerarme (erst langsam als Warnung); Phase 3 Meteorregen (fallende Feuerbälle mit Schatten) und brennender Arena-Rand. Lehr-Boss: Hinweis zu Beginn.
  - [x] **Frostbart der Eisweber** (Welt 2): Eisspeer-Salven (vorgehalten), rutschige Eisflecken (Goblin schlittert); Phase 2 Eisschild: vorne prallt alles ab („Block“), er dreht sich langsam (0,6 rad/s), 3 Treffer von hinten brechen ihn (Pfeil zeigt auf den Rücken, Punkte über dem Kopf), danach 1,4 s benommen und +30 % Schaden, Schild kommt nach 12 s wieder; Phase 3 Schneesturm (Sicht nur um den Goblin) und Eissplitter-Spiralen.
  - [x] **Morgra die Seuchenmutter** (Welt 3): Giftpfützen-Regen, Gaskegel; Phase 2 teilt sie sich in 2, Phase 3 in 3 (Teile laufen versetzt um den Goblin, zaubern Pfützen und Gas, Treffer auf jedes Teil gehen aufs gemeinsame Leben), dazu steigt das Gift von außen (~50 s bis 250 px). Eigenes Modell: Moosrobe, Giftpilze auf dem Hut.
  - [x] **Graf Knochenhand** (Welt 4): Skelett-Reihen und Knochenkäfig (Kreis aus Knochen um den Goblin mit einer Lücke, zieht sich zu); Phase 2: 3 Seelengefäße am Arena-Rand, grüne Fäden und Schild – solange eins steht, prallt alles ab; Phase 3: tote Skelette stehen als Geister auf, Lebensraub-Strahl folgt dem Goblin langsam und heilt ihn (höchstens bis zur Phasengrenze). Eigenes Modell: Krone, Stehkragen, Knochen-Schultern.
  - [x] **Der Spiegelmeister** (Welt 5): springt auf einen Kreis um den Goblin, Schattenbolzen in Salven; Phase 2: 3 Spiegelbilder ohne Bodenschatten (schießen harmlose Trugbilder, nehmen keinen Schaden, tauschen bei jedem Sprung die Plätze) – nur der Echte wirft einen Schatten; Phase 3: Spiegeltore, Bolzen fliegen in das Tor vor ihm und kommen neben dem Goblin heraus.
  - [x] **Tempestra** (Welt 6): Blitzkreise, Kettenblitz (Einschläge in einer Reihe bis hinter den Goblin); Phase 2: 4 Blitzsäulen, Strahlen springen zwischen Paaren (waagrecht, senkrecht, diagonal); Phase 3: Sturm schiebt den Goblin, alle 6 s neue Richtung (Pfeil oben, „Der Wind dreht!“).
  - [x] **Golemfürst Gromm** (Welt 7): reitet einen Golem (Golem-Bild mit Gromm obendrauf): Schockwellen in drei Linien, Felsregen; Phase 2: 4 Rüstungsplatten, nur ein Viertel des Schadens kommt durch, bis sie abgeschlagen sind; Phase 3: der Golem zerbricht, Gromm zu Fuß (kleiner, schneller), Erdspieße jagen dem Goblin hinterher.
  - [x] **Erzmagier Malvorn** (Welt 8): wechselt alle 15 s die Schule (Angriffe und Farbe der Schule); Phase 2 ruft 2 frühere Bosse als Schatten (eigene Leiste, Angriffe ihrer ersten Phase); Phase 3 alle 6 s eine andere Schule, Wut schon nach 60 s; Phase 4 „Verzweiflung“ ab 10 % (Spiralen, Meteore, Kettenblitze). Eigene Schwellen je Boss (`at`), Leiste mit Markierung bei 10 %.
  - [x] **Mini-Bosse** (6.3): Meister der Schule mit 2 Elite-Eigenschaften und eigener Leiste unter der Boss-Leiste, droppt die erste Truhe des Laufs.
  - Code: Ablauf `src/game/boss.js`, Angriffe `src/game/boss-atk.js`, besondere Mechaniken `src/game/boss-mech.js`.
  - Balance (40 Läufe, Seeds 1/101): Boss-Level Welt 5 75–83 %/~70 s, Welt 6 73 %/61 s, Welt 7 63 %/72 s, Welt 8 63–68 %/~60 s.
  - Boss-Geschosse haben jetzt das Bild ihrer Schule (Giftblase, Funke, Seele, Fels, Lichtlanze).
- [x] **Boss-Rework (Wunsch Fabi, 2026-10-12):** *(Alle 8 Bosse mit eigenem Modell, `BOSS_LOOKS` in `src/gen/mages.js`: Ignaz brennender Bart und Flammenkranz, Frostbart Eisbart und Eiszacken, Morgra Giftpilze, Knochenhand Krone und Stehkragen, Spiegelmeister schwebende Spiegelscherben, Tempestra Blitzkrone und wehendes Haar, Gromm gehörnter Helm auf einem Golem, Malvorn mit Edelsteinen aller 8 Schulen, Fels- und Knochen-Schulter; zeigt seine aktuelle Schule als farbigen Schein)* die heutigen 5 Bosse ersetzen, nicht nur ergänzen. Jeder Boss bekommt ein eigenes Modell statt "Meister seiner Schule" (Phase 1). Malvorn bekommt ein Modell mit Teilen aller Schulen und wechselt sichtbar die Schule. Die alte feste Angriffsrotation (Ring/Fächer/Blitze/Beschwören/Ansturm) entfällt zugunsten der Phasen aus 6.3.
- [x] **Bosse wie in Undertale (Wunsch Fabi, 2026-10-12):** *(Auftritt für alle Bosse: Kinobalken, Kamera fährt zum Boss, Namensschild mit Titel, Tippen/Leertaste überspringt, Trommelwirbel-Intro, eigenes Thema; jeder Boss mit eigenem Auftritt – Flammensäule, zusammenfliegende Eissplitter, steigt aus Giftblasen bzw. aus dem Grab bzw. aus dem Boden (Erdbeben), vier Spiegelbilder fliegen zusammen, Blitzschlag, Runenkreis. Phasenwechsel-Szene, Malvorns letzte Phase heißt „Verzweiflung“.)* mehrere deutlich verschiedene Phasen (siehe 6.2/6.3), und jeder Boss wird angekündigt: kurze Cutscene mit Auftritt-Animation, Name und Titel, Kamera auf den Boss, eigene Musik mit Intro. Phasenwechsel ebenfalls mit kleiner Szene.
- [x] **Mehr Musik, echte Titelmusik (Wunsch Fabi, 2026-10-12):** eigenes Stück für das Hauptmenü/den Titel, dazu mehr Stücke im Lauf (pro Stage, Boss, Ergebnis). *(Titelmusik im Hauptmenü mit eigener Melodie, ein Stück je Welt, eigenes Thema je Boss (Malvorn mit eigener Melodie), kurze Sieg-/Niederlage-Melodie im Ergebnis; alles prozedural in `src/core/music.js`.)*

### Fabis Liste: Feedback und Spielgefühl (2026-10-13, vor Phase 8) ✅
Aus Fabis Notiz, umgesetzt nach Recherche zu Spielen dieser Art (Plan: Tippen/Halten, Bonus statt verpuffter XP, Mini-Bosse, Musik, Fähigkeiten-Feedback, Belohnungs-Flug, Hüte-Folge).
- [x] **Skill Tree:** Ein anderer Knoten wird beim ersten Drücken nur ausgewählt (Zettel zeigt, was er tut), erst Drücken und Halten auf dem ausgewählten lernt. Ausgewählter lernbarer Knoten pulst.
- [x] **Mini-Bosse in jedem Level außer dem Boss-Level** (Fabi hat „steigend“ gewählt): Elite-Eigenschaften 0/1/2/2, Leben ×3/×4/×5/×5, jeder trägt eine Truhe. Level 3/4 dabei schärfer gestellt (Schaden, Spawnrate, Gegner-Leben); Welt 1/2/5 dort weiter leicht → Phase 8.
- [x] **Fähigkeiten befriedigender:** Ring füllt sich weich, Aufleuchten bei 50/75 %, „Pop“ mit Lichtring und Ton, wenn bereit, Druckwelle, Schlag-Ton und Funken beim Auslösen, Klick und hüpfende Zahl bei neuer Rollen-Ladung.
- [x] **Erfolg abholen:** Juwelen platzen am Knopf heraus und fliegen zum Zähler oben, der beim Ankommen hochzählt (Ton steigt); Medaille springt, goldener Blitz bei Gold-Stufe. Auch Tagesaufgaben, Tagesbonus, Gold-Pakete, Gratis-Gold (`src/ui/rewardfx.js`).
- [x] **Magierhüte spannend:** Hüte fallen im Ergebnis einzeln hinein (Funken, Glöckchen jedes Mal höher, der dritte mit Akkord), „NEU!“ mit Juwelen-Flug, verpasster Hut wackelt mit Grund, Tippen überspringt; auf der Karte hüpfen neue Hüte.
- [x] **End-XP als Bonus** (Fabi hat „Bonus-Belohnung“ gewählt): Nach „Level geschafft“ gehen keine Level-Up-Karten mehr auf; offene und weitere Level-Ups und Truhen werden Bonus-Level („Bonus +n“, Ton steigt). Belohnung: Gold je Bonus-Level, ab 4 ein Kartenpaket, ein Juwel je 6 (`bonusReward` in `src/game/balance.js`). Typisch 2–4 Bonus-Level, im Boss-Level 5–8.
- [x] **Musik im Takt** (Fabi: „nicht zum Takt passendes Gedudel“): jedes Stück mit Tonart und Akkordfolge, alles aus dem Akkord des Takts, Melodien in die Tonart umgerechnet, Glöckchen auf den Achteln, nach Rucklern neu einsetzen statt nachholen (`src/core/music.js`, Test `test/music.test.js`).

### Phase 8 – Feinschliff und Test
- [x] Performance-Budget prüfen (12.3) – erledigt 2026-10-13
  - Neu: `npm run perf` (`tools/perf.mjs`) misst Ladezeit bis Hub, Ruckler im Hub, Bildrate mit 300 Gegnern (`src/stress.js`), Speicher und Dateigröße, als „PC“ und als „Handy“ (915×412, DPR 2, CPU 4× gebremst). Headless rastert ohne GPU, die Bildrate dort ist nur ein Vergleichswert. Auf echten Geräten: `goblin-io.html?perf` → Knopf „Test 300 Gegner“ (12 s, wird nicht gewertet, Ergebnis landet auch im „Kopieren“-Bericht).
  - **Sprite-Atlas:** Alle Bilder werden beim Laden auf den sichtbaren Bereich zugeschnitten und auf wenige 2048²-Seiten gepackt (`src/render/sprites.js`, Zeichnen über `blit`). Vorher war jedes Animationsbild eine eigene Canvas (≈ 2 900 Stück, beim Zeichnen ≈ 700 verschiedene Bildquellen je Frame → 700 GPU-Texturen, die beim ersten Auftauchen eines Gegners hochgeladen werden), jetzt 17 je Frame. Gespiegelte Goblin-Richtungen werden nicht mehr doppelt gerastert.
  - Getönte Bilder (Elite gold, Auflösen in Schulfarbe …) liegen auf eigenen kleinen Seiten (512²). Das Auflösen nimmt immer das erste Stand-Bild der Blickrichtung, damit nicht bei jedem Kill ein neues getöntes Bild entsteht. Elite-/Wut-Tönungen entstehen weiter beim ersten Zeigen eines Bildes (selten, ein Elite-Typ hat bis zu ~70 Bilder).
  - **Laden:** Vor dem Hub nur noch Goblin, Waffen, Effekte, Ratten (Icon) und je ein Boss-Bild für die Karte. Die Magier der freigeschalteten Welten (zuletzt gespielte zuerst) und die Demo-Magier laden danach im Hintergrund: höchstens 3 SVGs gleichzeitig, Rastern in 6-ms-Häppchen, Pause während eines Laufs. Startet man eine Welt, bevor sie fertig ist, wird ohne Pause zu Ende geladen („Lade Magier …“).
  - Ergebnis (Headless-PC, vorher → nachher): Ladezeit bis Hub 4,4–4,8 s → 1,3–1,5 s ✓ (Handy-Profil mit 4× CPU-Bremse 21 s → 8,7 s); Bildspeicher mit allen Welten 300 MB → 164 MB ✓ (neuer Spieler 90 → 48 MB); Hub in den ersten 4 s höchstens 2 Ruckler bis 100 ms (ohne Drosselung der SVG-Ladungen waren es bis 500 ms); Datei 0,54 MB ✓; Logik mit 300 Gegnern 1,4 ms je 60-Hz-Schritt (Handy-Profil 6 ms). Offen: die 55 FPS mit 300 Gegnern auf einem echten Mittelklasse-Handy – das kann nur Fabi messen (`?perf`).
  - Nebenbei gefunden: Die Sim war mit gleichen Seeds nicht wiederholbar. Feuerwand (Lücke) und Golem-Beschwörung (Platz der Rune) würfelten mit dem Optik-Zufall `frand` → jetzt `rand`. Zwei gleiche `npm run sim`-Aufrufe geben wieder dasselbe.
  - Cloud: `tools/cloud-setup.sh` verlinkt ein vorinstalliertes Chromium, wenn der Download gesperrt ist.
  - Code-Review (max, 2026-10-13): SVGs einer ganzen Welt entstanden beim Hintergrund-Laden in einem Rutsch (Hub-Hänger bis 345 ms bei allen Welten frei) → entstehen jetzt erst im Lade-Job, danach keine langen Tasks mehr. Hintergrund-Laden ruht auch im Ergebnis (Szenen schalten es um), Icons beachten gespiegelte Bilder (Ratten schauen wieder nach rechts), Belastungstest landet nicht mehr im ?perf-Bericht.
- [x] **Funde aus dem Code-Review über den ganzen Code (high, Wunsch Fabi, 2026-10-14)** – alle 18 am 2026-10-14 behoben (Level-Up geprüft: 2 Level-Ups + Truhe gaben vorher 1 Kartenfenster, jetzt 3; Hüte merken sich jetzt die erfüllten Bedingungen des besten Laufs als `hm`)
  - [x] Level-Up: Stehen mehrere Level-Ups/Truhen an, geht ein Kartenfenster verloren (`scenes/run.js` + `game/run.js:141` starten während der Zeitlupe schon das nächste)
  - [x] Vampirische Elites heilen auch bei Treffern ohne Schaden (Unverwundbarkeit, Rolle, Mech, Schild) – bis 240 %/s (`affixes.js`)
  - [x] Rüstkammer: Fähigkeit von Q nach leerem E hängen → beide Slots Wut (`armory.js`)
  - [x] Doppelte ID `lvNote` (Kartenzettel und Level-Up-Hinweis): Bannen/Sperren-Hinweis landet im versteckten Kartenzettel
  - [x] Hüte: Ergebnis und Karte zeigen den falschen fehlenden Hut (es wird nur gezählt, nicht welche Bedingung)
  - [x] Gegner im Portal sind laut Regel nicht angreifbar, Blitzstab/Großer Knall/Bombe/Bande treffen sie trotzdem; Dolche zielen auf sie und fliegen durch
  - [x] Krieger des Goblin-Rufs werden nicht zwischen den Logikschritten weitergerechnet (ruckeln auf 120/144 Hz)
  - [x] Pause zeigt maximales Leben mit Kommastellen
  - [x] Zauber, die schon ausholen, zielen auch im Rauch auf den unsichtbaren Goblin (jetzt: der Zauber verpufft samt Bodenwarnung)
  - [x] Boss-Tod-Explosionen laufen per `setTimeout` (Echtzeit) und laufen in der Pause weiter (jetzt `later()` in Spielzeit, `game/fx.js`)
  - [x] Lauf endet mitten im Schritt (Geschoss) → danach eingesammeltes Gold/XP fehlt im Spielstand
  - [x] „Perfekt!“-Rolle zählt auch an harmlosen Trugbildern des Spiegelmeisters
  - [x] Determinismus-Regel: `rnd()`/`rand()` nur für Optik in `boss-mech.js` (Animations-Start) und `abilities.js` (Ratten-Phase) → `frand`
  - [x] Veraltete Texte: Magierhut „Malvorn besiegen (Welt 5)“ (ist Welt 8), „So spielst du“: „Nach 4 Minuten kommt der Boss“
  - [x] `?perf` bricht auf alten WebViews ohne `AudioScheduledSourceNode` ab (und mit ihm die Update-Prüfung)
  - [x] Icons von Goblin-Bande/-Ruf zeigen nach dem Umziehen weiter den alten Goblin
  - [x] Aufräumen: Blinzler-Teleport → `clampToArena`, Winkel per `angDiff`, `restart()` statt Eigenbau (items/store/tree), toter Zweig in `needOf`, Helfer für „Stoß im Kreis“ (~10 Kopien in abilities.js)
  - [x] Effizienz: `dropGem` zählt bei jedem Kill alle Gegenstände; `updHud` sucht jeden Frame DOM-Elemente
- [x] Linkshänder-Modus, Einstellungen – erledigt 2026-10-14
  - Einstellungen als Schalter-Liste (Fabi hat gewählt) in Gruppen: **Ton** (Soundeffekte und Musik je mit Holz-Schalter und Lautstärke-Regler in 5-%-Schritten; Regler ganz links schaltet aus, Ziehen schaltet wieder an), **Spiel** (Bildschirmwackeln, Schadenszahlen), **Steuerung** (Knöpfe links, Knopfgröße Klein/Normal/Groß = 85/100/120 %), dazu „So spielst du“. Code in `src/ui/settings.js`, Werte in `save.settings` (`sfxVol`, `musVol`, `btn` neu).
  - Linkshänder (Fabi hat gewählt: nur die Knöpfe): Rolle, Sprint, Q und E gespiegelt nach links unten; die Tipps sagen dann „links unten“. Leiste oben bleibt.
  - Schadenszahlen aus: Zahlen an Gegnern entstehen gar nicht erst; Texte („Perfekt!“, Heilung, Block) und eigener Schaden bleiben.
  - Pause: „Ton“/„Musik“ ersetzt durch „Einstellungen“ (dasselbe Fenster, Esc schließt nur das Fenster). `npm run smoke` prüft Schalter, Regler, Knopfgröße und den Weg über die Pause.
  - Code-Review (high): 9 Funde behoben (Zahlen verdrängten bei vielen Treffern andere Texte, Regler-Knopf saß neben dem Finger, Ziehen ohne Pointer-Capture, Lautstärke 0 vs. aus, Klick-Ton beim Einschalten, Tipp-Breite bei flachen Bildschirmen).
- [x] Komplett-Durchlauf aller Stages, Balance-Nachjustierung *(2026-10-27, nach neuen Karten, Megas und Rüstkammer 2.0)*
  - Grundlage (Sim, 30 Läufe je Level, Seeds 1/101): nur Welt 1/2 Level 3–4 (100 %) und Welt 5 Level 3–4 (96/98 %) über dem Ziel.
  - Neu `lvHp` in `WORLD_LV` (`src/data/levels.js`): Gegner-Leben einzelner Level ×. Schaden/Spawnrate wirken in frühen Welten kaum (Treffer gedeckelt), Leben schon – mit einer Kante (Welt 1-4: ×1,3 → 95 %, ×1,6 → 52 %). Endwerte: Welt 1 { 3: 1,6, 4: 1,42 }, Welt 2 { 3: 1,5, 4: 1,33 }, Welt 5 { 3: 1,18 } plus Schaden 1,42/Spawnrate 1,25 mit Boss-Faktor ,78.
  - Kontrolllauf (Mittel Seeds 1/101): alle 40 Level im Zielbereich; 7-3 mit 93/100 % nur bei einem Seed darüber (Streuung). Endlose Nacht unverändert (Median 3,2 min überlebt, 8 Läufe).
  - 2026-10-14: Sim-Balance nach dem Game-Loop-Rework für alle Welten auf die Zielwerte gebracht (Tabelle beim Game-Loop-Rework). Offen: Durchlauf von Hand, hohe Kartenstufen und volle Fähigkeitenbäume prüfen.
  - Nach den Review-Fixes (2026-10-14) Welt 3-4 mit 30 Läufen: Seeds 1/101 vorher 80/70 %, nachher 70/67 % (Ziel 75–90 %). Vermutlich weil Gegner im Portal nicht mehr getroffen werden; im Streubereich, beim Durchlauf mit ansehen.
- [x] **Exe verbessern (Wunsch Fabi, 2026-10-13):** Windows-App aufwerten; was genau, mit Fabi klären. – erledigt 2026-10-16 (siehe unten)
  - [x] **Konkret (Fabi, 2026-10-16): „Exe und APK ausbauen“:** – erledigt 2026-10-16: `src/ui/platform.js`: Vollbild über F11, Alt+Enter und Schalter in den Einstellungen (exe merkt es sich, `settings.full`), Pause über Tauris Fokus-Ereignis (zusätzlich zu blur), `body.pc` am PC: kleine Leiste unten statt Handy-Knöpfen, kein Maus-Joystick, Handy-Einstellungen ausgeblendet; ein echtes Tippen schaltet zurück. APK: Status- und Navigationsleiste ausgeblendet (`MainActivity.kt`, nicht lokal gebaut – prüft der Release-Lauf). Ursprünglicher Wunsch: Vollbild in der exe (z. B. F11 und Schalter in den Einstellungen, Zustand merken), **Auto-Pause** in der exe, wenn das Fenster den Fokus verliert oder minimiert wird, und am PC **keine Handy-Steuerung** mehr (Joystick und Fähigkeits-Knöpfe ausblenden, Tastatur/Maus; erst wieder zeigen, wenn wirklich getippt wird). Für die APK dasselbe prüfen (Pause beim Verlassen der App, Vollbild ohne Systemleisten).
- [x] **Accounts mit Cloud-Sync (Wunsch Fabi, 2026-10-13):** – live seit 3.0.1 (goblin.node-wave.org, Google-Anmeldung in Browser, exe und APK über `/anmelden`, Geräte-Sperre „neuestes Gerät gewinnt“, Callback in der Google Console eingetragen 2026-10-28). Anmelden, Spielstand in der Cloud, gleicher Stand in Browser, exe und APK. Braucht einen Server (Anbieter wählen), Konflikte zwischen Geräten lösen (z. B. neuerer/weiterer Stand gewinnt, vorher fragen). Bis dahin wurde der Browser-Stand (Opera GX, localhost:8080) am 2026-10-13 von Hand in die exe kopiert.
  - **Entscheidung Fabi (2026-10-14): Anmeldung mit Google-Konto, Server bei Cloudflare (Fabi hat eine Domain dort).** Plan:
    - Server: Cloudflare Worker `api.<domain>` (Code im Repo unter `cloud/`, `wrangler.toml`), Spielstände in D1 (Tabelle `saves`: Google-`sub`, JSON, Konto-Level, Läufe, geändert am). Kostenloser Tarif reicht.
    - Anmeldung: das Spiel holt bei Google ein ID-Token, der Worker prüft es selbst gegen Googles Schlüssel (JWKS, Audience = unsere Client-IDs) und gibt einen eigenen Sitzungsschlüssel zurück; damit `GET/PUT /save`. Kein Firebase.
    - Optional: Browser-Version auf Cloudflare Pages unter `goblin.<domain>` (dann überall spielbar, Google-Anmeldung mit sauberem https-Ursprung).
    - Google-Anmeldung je Plattform: Browser über „Sign in with Google“; **exe und APK mit Code** (Entscheidung Fabi 2026-10-14): die App zeigt einen Code, man gibt ihn auf google.com/device ein (geht auch am Handy), der Worker fragt bei Google nach (`/api/device/start|poll`, Client-Secret nur im Worker). Kein Rust, kein Deep-Link. Fertig und getestet (Worker-Tests, `?cloudtest=<name>&code`).
    - Abgleich: lokal bleibt der Spielstand die Arbeitskopie. Beim Start und nach jedem Lauf (gebündelt, höchstens alle 30 s) hochladen. Ist der Cloud-Stand weiter (Konto-XP, Läufe) oder neuer als der lokale, fragen: beide Stände nebeneinander zeigen, „Cloud laden“ / „Diesen behalten“. Nie still einen weiteren Stand überschreiben.
    - UI: im Profil „Mit Google anmelden“, danach Name/Bild, „Zuletzt gesichert …“, „Abmelden“.
    - Reihenfolge: 1) Worker + Browser + Abgleich + UI, 2) exe, 3) APK.
    - Stand 2026-10-14: Worker + Abgleich im Spiel fertig und lokal getestet (`tools/cloud-e2e.mjs`), Domain `goblin.node-wave.org`, Google-Client-ID (Web) eingetragen. Fehlt: Netzwerk-Freigabe `api.cloudflare.com` und `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` in der Umgebung → dann `wrangler d1 create goblin`, ID in `wrangler.toml`, `npm run deploy` in `cloud/`, `LIVE = true` in `src/cloud.js`.
    - **Live seit 2026-10-14:** D1 `goblin` angelegt, Worker auf https://goblin.node-wave.org deployt (Spiel lädt, `/api/save` ohne Token → 401, CORS für localhost:8080 geprüft), `LIVE = true`. Browser-Anmeldung kann Fabi jetzt testen. Fehlt noch: TV-Client-ID + `GOOGLE_TV_SECRET` für exe/APK, danach Release (exe + APK bauen).
    - **Konto-Regeln (Wunsch Fabi 2026-10-14: „Abmelden, Stand resetten usw., sonst kann man den Account verdoppeln“):** Der Spielstand auf dem Gerät gehört einem Konto (`goblinio_owner`, Konto-Kennung `acct` vom Worker). Abmelden sichert erst und startet dann ein neues Spiel (Stand bleibt in der Cloud). Ein anderes Konto übernimmt nie den Stand eines Kontos, sondern holt seinen eigenen oder fängt neu an; liegt noch ungesicherter Fortschritt des alten Kontos da, wird gefragt. Gast-Fortschritt (nie angemeldet) wandert beim ersten Anmelden ins Konto bzw. es wird gefragt (wie bei Google Play Games/CrazyGames). Im Profil: „Spielstand zurücksetzen“ (lokal + Cloud) und „Konto löschen“ (Cloud-Stand + alle Sitzungen; Pflicht für den Play Store). Getestet mit `tools/cloud-e2e-konto.mjs` und `cloud/test/account.test.js`.
    - **exe/APK ohne extra Google-Zugang (2026-10-14):** statt Googles Geräte-Ablauf (brauchte TV-Client + Secret) zeigt die App einen Code; man öffnet goblin.node-wave.org/verbinden (auch am Handy), meldet sich dort mit Google an und gibt den Code ein (`/api/link/start|confirm|poll`, Tabelle `links`). GOOGLE_TV_* entfällt.
    - **Anmeldung wie bei echten Apps (Wunsch Fabi 2026-10-14):** eigener Knopf „Mit Google anmelden“ (Google-Kontoauswahl im Popup, Token-Client, fragt immer nach dem Konto). exe/APK öffnen die Anmeldeseite direkt im Browser, nach der Kontowahl springt sie per `goblinio://` zurück ins Spiel (tauri-plugin-deep-link, am PC mit single-instance). Die Anmeldeseite meldet die Webseite selbst nicht an.
- [x] **Ruckeln in 3.0.1 (Fabi 2026-10-14: „unspielbar, lag schon ab wenigen Gegnern“):** Ursache war der Sprite-Atlas: aus großen Atlas-Seiten (2048², auch 1024²) zeichnet Chrome nicht verzögert, sondern rechnet jedes Bild sofort auf dem Haupt-Thread ab (CPU-Profil: 65 % in `restore()`). Jetzt wieder eigene, zugeschnittene Flächen je Bild: Zeichnen mit 300 Gegnern 59 → 4,5 ms (Handy-Profil 476 → 30 ms), Bildspeicher 152 → 110 MB. Dazu aus dem Code-Review: kein Cloud-Abgleich mitten im Lauf, Ladeschub beim Laufstart begrenzt, kein erzwungenes Layout beim Kristall-Sammeln, Dolch-Ring nur in 1-%-Schritten, Tönungen ohne Schlüssel-String.
- [x] **Doppelt so viele Karten und Mega-Entwicklungen (Wunsch Fabi, 2026-10-14):** Entscheidungen Fabi: 10 neue Waffen + 10 neue Passive (jede Waffe mit Entwicklung), Megas als feste Paare nach Thema, ausgelöst über eine Truhe von Elite, Mini-Boss oder Boss, mit großer Verschmelz-Animation.
  - Neue Waffen (`game/weapons2.js`, Zeichnen `render/draw-weapons2.js`): Donnerhammer → Erdbeben (Eisenhelm), Wurfsterne → Sternenhagel (Kriegshorn), Armbrust → Ballista (Knochenschädel), Schattenkugel → Schwarzes Loch (Schattenmantel, legendär), Steinschleuder → Steinlawine (Splitterkristall), Lichtlanze → Sonnenstrahl (Sanduhr, legendär), Seelenlicht → Seelensturm (Vampirzahn), Säurespucke → Säureregen (Glutkern), Funkenring → Plasmagewitter (Glücksklee), Goblin-Minen → Minenfeld (Goblinbeutel).
  - Neue Passive: Eisenhelm (−1 Schaden je Treffer), Kriegshorn (+7 % Angriffstempo), Knochenschädel (+12 % gegen Elite/Bosse), Schattenmantel (+4 % Ausweichen), Splitterkristall (+Durchbohren), Sanduhr (+10 % Wirkdauer), Vampirzahn (+0,4 % Lebensraub, höchstens 3 % Leben/s), Glutkern (+10 % Flächenschaden), Glücksklee (+8 % Erfahrung), Goblinbeutel (+15 % Gold).
  - Megas (`game/mega.js`, Animation `ui/mega-fx.js`): Klingenapokalypse (Dolch+Sterne), Stahltornado (Klingenkreis+Hammer), Frostfeuer-Komet (Feuerball+Eisspeer), Weltengewitter (Blitz+Funken), Pestflut (Gift+Säure), Knochenlawine (Bumerang+Schleuder), Goblin-Armageddon (Fass+Minen), Kriegsmaschine (Säge+Armbrust), Geisterhorde (Bande+Seelen), Sonnenfinsternis (Schatten+Lanze). Beide Waffen +30 % Schaden, dazu ein eigener großer Angriff; Slot mit ★★, Erfolg „Verschmolzen“.
  - Level-Up: neue Karten ziehen pro Stück nur ihren Anteil am alten Gewicht, damit eigene Waffen und Entwicklungen so oft kommen wie mit 10 Karten.
  - Balance (Sim, 20 Läufe je Level, Mittel aus Seeds 1 und 101, vor den Heil-Deckeln gemessen): im Mittel +2,5 Punkte Siegquote; deutlich nur Welt 5-3/5-4 (+10/+12, jetzt 100/97 % statt Ziel 80–95/75–90) – beim nächsten Balance-Durchgang prüfen. Sonst alles im Zielbereich ± Streuung.
- [x] **APK-Icon (Wunsch Fabi, 2026-10-14):** Die APK zeigte das Tauri-Logo, weil die Goblin-Icons nie ins Android-Projekt kamen. Jetzt adaptives Icon (Goblin auf grünem Verlauf) per `node tools/app-icon-android.mjs`.
- [x] **Anmeldung ohne Spiel im Hintergrund + nur ein Gerät (Wunsch Fabi, 2026-10-14):** exe/APK öffnen `goblin.node-wave.org/anmelden` → direkt Googles Kontoauswahl (OpenID, ID-Token per form_post, Weiterleitungs-URI muss in der Google Console stehen), Spielfenster minimiert sich und kommt per `goblinio://` zurück. Gleiches Konto auf zwei Geräten: wie Clash Royale gewinnt das zuletzt geöffnete, das andere zeigt „Du spielst woanders – Hier weiterspielen“ (Server: Tabelle `active`, PUT vom nicht aktiven Gerät → 423).
    - Für exe/APK zusätzlich: OAuth-Client vom Typ „Fernseher und Geräte mit begrenzter Eingabe“ → Client-ID in `GOOGLE_TV_CLIENT_ID` und `GOOGLE_CLIENT_IDS` (wrangler.toml), Secret als Umgebungsvariable `GOOGLE_TV_SECRET` → `wrangler secret put GOOGLE_TV_SECRET`.
    - **Von Fabi gebraucht:** Domain-Name; Cloudflare-API-Token (als GitHub-Secret `CLOUDFLARE_API_TOKEN` für automatisches Hochladen, oder `npx wrangler deploy` vom PC); in der Google Cloud Console eine OAuth-Client-ID (Web, Ursprünge `http://localhost:8080` und ggf. `https://goblin.<domain>`), später Desktop und Android. Client-IDs sind öffentlich und kommen in den Code.
- [x] **Game-Loop-Rework (Wunsch Fabi, 2026-10-12, entschieden und umgesetzt 2026-10-14):** Der Wurfdolch wird automatisch hochgestuft (ohne Level-Up-Karte), damit die Karten für andere Waffen und Builds frei sind. Vorher mit der Sim prüfen, wie sich die Kraftkurve (7.3) ändert, und mit Fabi entscheiden.
  - Entscheidungen Fabi (2026-10-14): Dolch steigt **alle 4 Level** automatisch auf (Stufe 2/3/4/5 bei Level 4/8/12/16), zusätzlich zur normalen Level-Up-Karte. **Dolchsturm bleibt eine Entwicklungskarte** wie bisher (Dolch 5 + Wetzstein). Anzeige: **Banner „Wurfdolch Stufe N!“ mit Ton und ein Ring am Dolch-Slot**, der sich bis zur nächsten Stufe füllt. Balance: danach **alle Welten auf die Zielwerte** (`LEVEL_TARGET`) einstellen, zwei Seed-Sätze.
  - Reihenfolge: vor dem Komplett-Durchlauf machen, weil es die Kraftkurve ändert.
  - Umgesetzt: `auto` in `data/weapons.js`, `autoUp()` in `game/levelup.js`, keine Dolch-Aufwertungskarten (Angebot, Truhen), Banner mit Ton `bladeUp`, Ring am Slot (`hud.js`, `.slot.auto`).
  - **Nach der ersten Sim auf „alle 3 Level“ geändert (Entscheidung Fabi):** mit „alle 4“ kam der Dolchsturm in einem Level praktisch nie (Spieler-Level nach 2 min nur 12–14), Welt 3–8 fielen auf 15–55 % in Level 3–5. Jetzt Stufe 2/3/4/5 bei Spieler-Level 3/6/9/12.
  - Balance danach (`WORLD_LV` in `data/levels.js`, 20 Läufe, Seeds 1/101): Welt 3 Schaden ×.76, Spawnrate ×.88, Boss-Level ×.84; Welt 4 ×.97/×1/×.84; Welt 5/6 Boss-Level ×.85; Welt 8 ×1.38/×1.25, Boss-Level ×.75.

    | Welt | L3 (80–95) | L4 (75–90) | Boss (60–85) |
    |---|---|---|---|
    | 3 | 80/80 | 75/85 | 65/80 |
    | 4 | 90/100 | 85/80 | 75/55 |
    | 5 | 95/80 | 85/90 | 60/65 |
    | 6 | 85/90 | 90/70 | 75/85 |
    | 7 | 85/95 | 80/75 | 70/55 |
    | 8 | 80/85 | 75/80 | 65/75 |

    Welt 1–2 bleiben bewusst leicht (L3/L4 ~100 %, Boss 65/72 %).
- [x] **Truhen spannender, Licht hinter die Truhe (Wunsch Fabi, 2026-10-14: „sehr wichtig, Glow hinter die Kiste statt davor“)** – erledigt 2026-10-14
  - Ursache: Die Lichtsäule stand im HTML nach der Truhe und ohne z-index, begann mitten in der Truhe und lag mit 75 % Deckkraft über Deckel und Korpus. Jetzt feste Ebenen: Strahlenkranz, Blitz, Druckwelle < Truhe (darin Glow und Lichtsäule hinter dem Bild) < Karte < Funken < Übersicht.
  - Recherche (was Truhen spannend macht): Vorfreude mit Wackeln, Tönen und Kamera aufbauen; die Seltenheit nicht zu früh verraten (Overwatch hat farbige Lichter entfernt, die sie zu früh zeigten); Rhythmus Pause → Aufdecken → Reaktion; Stufen-Steigerung durch Tippen (Mystery-Truhe in Clash Royale); Hitstop, leichtes Wackeln, Funken, steigende Töne. Keine Beinahe-Treffer-Tricks: Das Ergebnis steht vorher fest, die Animation zeigt es nur. Quellen: [PC Gamer](https://www.pcgamer.com/uk/behind-the-addictive-psychology-and-seductive-art-of-loot-boxes/), [Springer-Studie](https://link.springer.com/article/10.1007/s10899-019-09913-5), [Kotaku](https://kotaku.com/why-opening-loot-boxes-feels-like-christmas-according-1793446800), [RoyaleTracker](https://royaletracker.gg/guides/clash-royale-chest-simulator-guide), [Wayline Game Feel](https://www.wayline.io/learn/game-feel/1).
  - Öffnen (`src/ui/chest-open.js`): Tippen = nächster Wackler (oder von selbst nach ~0,8 s), der Deckel hebt sich dabei kurz und das Licht scheint durch den Spalt. Das Licht startet warmweiß und steigt bei zufälligen Wacklern Stufe um Stufe (blau → lila → gold) bis zur besten Karte, mit „Aufwertung!“, Ton und Ruck; 2 + Seltenheit Wackler, manchmal einer mehr. Dunkel wird es erst bei Gold. Dann Hitstop (Truhe staucht sich), Blitz und Druckwelle hinter der Truhe, Bildschirmwackeln je Seltenheit (Einstellung „Bildschirmwackeln“ und reduzierte Bewegung werden beachtet), Vibration am Handy, Bass-Schlag.
  - Karten fliegen verdeckt heraus, die Rückseite glüht in ihrer Seltenheit, dann drehen sie sich um (legendär langsamer, mit Trommelwirbel und Strahlenkranz hinter der Karte). ×N zählt hoch, „Neu!“ als Stempel, „Aufwerten möglich!“ mit Ding. „Alle zeigen ›“ springt zur Übersicht; die ist nach Seltenheit sortiert, die beste Karte glüht.
  - Funken kamen bisher rechts neben der Truhe heraus (fest x = 60 %) → jetzt aus dem Spalt bzw. von der Karte.
  - **Bonusfund** (`rollChest`, `CHESTS[t].bonus`): Holz 5 %, Eisen 8 %, Gold 10 %, Magier 12 % – halb Juwelen (je nach Truhe 5–25), halb „Goldader“ (das Gold noch einmal); eigene Überraschung nach der letzten Karte. Test in `test/chests.test.js`.
  - Laden: fertige Truhen im Regal glühen hinter sich, eine Truhe wackelt beim Start des Öffnens; Goldtruhe zeigt „Episch spätestens in n“, Magiertruhe (hat immer eine epische) „Legendär spätestens in n“.
  - **Truhe im Lauf** (Elite/Boss, `src/ui/run-chest.js`): kurze Öffnung mit Licht dahinter und je Gewinn einer Walze, die auf dem Gewinn stoppt (wie Vampire Survivors), ersetzt das Banner; mehrere Truhen und Mega-Verschmelzung laufen nacheinander, Tippen/Leertaste/Enter/Esc überspringt. Mini-Boss-Truhe: offene Truhe mit Glow über „Schatztruhe!“.
  - Nebenbei: Die Sperre während Animationen (`megaFreeze`, Echtzeit) steckte in `useAbility`/`doDash` → die Sim hing von der Rechnergeschwindigkeit ab (schon bei der Mega-Verschmelzung). Jetzt prüfen nur noch die Eingaben (`uiFrozen` in `game/state.js`), die Logik nie; `autoChest` meldet nur das Ereignis `autoChest`.
  - Geprüft: lint, 109 Tests, smoke, Sim zweimal gleich, perf wie vorher (gleicher Rechner, alter und neuer Stand), Screenshots PC und Handy.
- [x] **Endlose Nacht: kein unbesiegbarer Klumpen mehr (Wunsch Fabi, 2026-10-16: „ab 14–20 min waren die Gegner nur noch ein Klumpen, den man nicht killen konnte“)** – erledigt 2026-10-16
  - Ursache: Gegner-Leben wuchsen doppelt, mit der Laufzeit (`hpTime`, quadratisch) und zusätzlich je Runde ×(1 + 1,2 × Runde): nach 20 min ×460 gegenüber dem Start. Der Goblin wird ab ~14 min (Build fertig) kaum noch stärker. Gemessen (`npm run sim -- --endless --god`, Bot stirbt nicht): bis Minute 11 ~600 Kills/min, ab Minute 17 nur noch 60–150, über 300 Gegner stehen.
  - **Leben** (`endlessHp` in `game/balance.js`): bis 4:00 wie bisher, dann ×e^0,33 (≈ +39 %) je Minute bis 13:00, danach nur noch linear (+8 % des Werts von 13:00 je Minute). Kein Sprung mehr beim Boss-Sieg. **Schaden** (`endlessDmg`) ebenfalls glatt über die Zeit statt je Runde, Treffer-Deckel wächst ab 15:00 um 10 %/min (`endlessCap`), sonst wird ein starker Build mit Heilung unsterblich.
  - **Dauerboni** (Wunsch aus dem Plan): Ist alles ausgebaut, bietet das Level-Up Wutzahn (+6 % Schaden), Flinke Finger (+5 % Angriffstempo), Dicker Bauch (+8 % Leben) an – multiplikativ, ohne Grenze, ein Platz bleibt für den Eintopf. Auch Truhen geben sie, wenn nichts mehr auszubauen ist. Sperren/Bannen/Neu würfeln funktionieren mit ihnen.
  - **„Die Nacht wächst mit“:** jeder genommene Dauerbonus macht neue Gegner der Nacht 2,5 % zäher (`boonHp`). Ohne das schaukelte sich ein Lauf hoch (mehr Kills → mehr Level-Ups → mehr Boni; Sim: Lv 118, 40 min ohne Ende), mit 4 % kam der Klumpen ab ~23 min zurück.
  - Ergebnis (je 2 Seed-Sätze): Gott-Modus bis Minute 26 400–700 Kills/min, erst nach 35 min unter 300 (vorher ab 17 min). Ohne Gott-Modus mit vollen Talenten: Median ~7 min, beste Läufe 18–20 min, keiner unsterblich. Normale Level unverändert (Welt 5/8, Seeds 1/101, ein einziger Lauf anders).
  - **Fix nebenbei:** Plasmagewitter (Funkenring-Entwicklung) schrieb seine Trefferpause in `e.ph` – beim Boss die Phasennummer → Absturz, sobald es einen Boss traf (seit 3.0.3, in jedem Boss-Level). `npm run smoke` lässt jetzt alle 20 Entwicklungen gegen einen Boss los.
  - Sim neu: `--endless [--god] [--time s]` mit Tabelle je Minute (Kills, Gegner, Ø Leben, Level, Runde) und den Builds langer Läufe; `--acct n` für spät freigeschaltete Fähigkeiten.
- [x] **Entwicklungen nicht mehr verbauen können (Wunsch Fabi, 2026-10-16: „doof, wenn man keine Entwicklungen bekommt, weil man falsche Add-ons gewählt hat“)** – erledigt 2026-10-16
  - Vorher: Entwicklung = Waffe Stufe 5 + ihr Passiv (`with`) im Slot. Waren die 6 Passiv-Slots mit unpassenden Passiven voll, war die Entwicklung für den Rest des Laufs weg (mit 20 Waffen/20 Passiven seit 3.0.3 viel häufiger).
  - **Umschmieden-Karte (Fabi hat gewählt):** Sind die Passiv-Plätze voll und fehlt einer eigenen Waffe ab Stufe 3 ihr Passiv, kann die Karte „Umschmieden“ kommen: das schwächste Passiv, das keine eigene Waffe braucht, wird an seinem Platz zum fehlenden, die Stufe bleibt (`swapCards` in `game/offer.js`). Ab Waffenstufe 5 ist sie garantiert im Angebot (nach zweimal Ablehnen nur noch gewichtet), Bannen und Sperren gehen wie bei anderen Karten (die gesperrte Karte behält ihr Passiv).
  - Hinweise auf den Karten: Waffe „Entwicklung mit X ✓“ (grün, Passiv da) bzw. „(umschmieden)“ (orange, Plätze voll); Passiv „Entwickelt X ✓“, „Passt zu keiner deiner Waffen“ (orange, wenn die Waffen-Plätze voll sind) oder „(fehlt dir noch)“.
  - Sim: Welt 5 und 8, Seeds 1/101, vorher = nachher (in 2–2:30-min-Leveln sind die Passiv-Plätze beim Bot nie voll). Wirkt vor allem in langen Läufen (Endlose Nacht). Zähler `swap` in `run.cnt`.
- [x] **Entwicklungs-Baum gut ins Spiel einbauen, mit Vorschau (Wunsch Fabi, 2026-10-16)** – erledigt 2026-10-16
  - Jede Waffe gehört zu genau einer Mega, deshalb 10 Gruppen: Waffe + Passiv → Entwicklung, zwei Entwicklungen ⟩ Mega (`src/ui/evotree.js`). Antippen eines Knotens zeigt Name, Text, was dafür nötig ist, und eine **Live-Vorschau**: Goblin in der Mitte, Übungsratten kreisen, die Waffe auf Stufe 5, entwickelt oder als Mega.
  - Offen aus dem Level-Up (Knopf „Entwicklungen“ und Auge oben rechts an jeder Karte → springt zu ihrer Entwicklung), aus der Pause und aus der Werkstatt (Knopf über den Karten, „Entwicklung ansehen“ in den Kartendetails). Im Lauf ist der eigene Stand markiert (grüner Rand + Stufe, goldene Entwicklung, pulsierend = bereit, ✓/✗ im Zettel), eigene Gruppen stehen oben.
  - Vorschau (`src/game/preview.js`): ein Mini-Lauf mit der echten Spiellogik, abgeschottet – eigener Zufall, Ton aus (`hushed`), keine Ereignisse (`unheard`), Raster und Lauf danach zurück; Zeichnen über `withCanvas` (`render/canvas.js`) auf die eigene Fläche. `npm run smoke` prüft, dass ein Lauf mit offener Vorschau genauso ausgeht wie ohne.
  - Geprüft: lint, 112 Tests, smoke, perf wie vorher (gleicher Rechner, alter und neuer Stand), Screenshots PC, Handy hoch und quer. Code-Review (high): 8 Funde behoben (Raster nach der Vorschau, gesperrte Tauschkarte, Auge beim Bannen, Hinweis bei gebanntem Passiv, Drossel der Töne, doppelter Helfer `weaponOf`, Auge für Vorleser, Schließen an einer Stelle).

### Phase 9 – Goblin-Klassen (Wunsch Fabi, 2026-10-12)
Fabi hat gewählt (2026-10-27): 3 neue Klassen neben dem Goblin, Freischaltung über Welten, eigenes Klassen-Level mit kleinen Boni.
- [x] **Mehrere Goblin-Typen mit eigener Startwaffe und eigener Bewegung** – erledigt 2026-10-27
  - `src/data/classes.js`: Goblin (Wurfdolch, Rolle/Sprint), Bogen-Goblin (Kurzbogen, Salto, Leben −10 %, Tempo +5 %, frei nach Boss Welt 2), Magier-Goblin (Zauberstab, Teleport, Leben −10 %, Abklingzeit −8 %, Welt 4), Krieger-Goblin (Keule mit Schockwelle, Sturmangriff, Leben +5 %, Tempo −5 %, Welt 6).
  - Klassenwaffen (`cls` in `data/weapons.js`, Logik in `game/weapons2.js`): Kurzbogen → Pfeilhagel (mit Ölkanne), Zauberstab → Arkansturm (Zauberbuch), Keule → Erdspalter (Lederrüstung). Nicht im Level-Up-Angebot, keine eigene Karte – die Dolch-Karte gilt für alle Startwaffen. Eigene Gruppe „Klassenwaffen“ im Entwicklungs-Baum. Keule trifft Elite und Bosse doppelt (Nahkampf-Ausgleich).
  - Abweichung vom Plan: Salto und Teleport nutzen Level und Skill Tree der Rolle, der Sturmangriff den des Sprints (kein Fortschritt geht beim Klassenwechsel verloren). Salto springt vom nächsten Gegner weg und schießt 5 Pfeile auf ihn; Teleport versetzt sofort 200 px; Sturmangriff = Sprint mit eingebautem Rammbock, 10 % schneller.
  - Klassen-Level 1–20 (XP = Konto-XP des Laufs): L3 +5 % Leben, L5 Startwaffe Stufe 2, L8 +5 % Schaden, L12 +1 Ladung der Leertasten-Bewegung, L16 +10 % Erfahrung, L20 Titel (Meisterschütze, Erzmagier, Kriegsherr, Meister-Goblin) und goldene Klassenwaffe. Spielstand v6 (`cls`, `classes`); gesperrte Klasse (alter/fremder Stand) spielt als Goblin (`activeCls`).
- [x] **Eigenes Modell je Typ, Auswahl im Hub, eigene Fortschritte** – erledigt 2026-10-27
  - `gen/goblin.js` `look.cls`: Bogen + Köcher/Gurt, Stab + Robe, Keule + Fellschultern, breiter; Garderobe bleibt darüber. Klassen-Leiste in der Rüstkammer (Werte, Startwaffe, Bewegungen, Klassen-Level mit Boni), Klasse mit „Wechseln“ auf dem Start-Zettel der Weltkarte, Knöpfe im Lauf je Klasse beschriftet, Klassen-XP im Ergebnis, „Neu freigeschaltet“ nach dem Boss.
  - Balance (Bot, 12 Level 3/4/5 der Welten 1/3/5/7, je 20 Läufe, Mittel Seeds 1/101): Goblin 78,8 %, Bogen 83,6 %, Magier 78,0 %, Krieger 81,7 %. Bosskämpfe des Kriegers dauern länger (Bot hält Abstand), Siegquote im Boss-Level wie Goblin. Sim `--cls bow|mage|war`, gleiche Seeds gleich.
  - Geprüft: lint, 129 Tests (Migration v6, Klassen-XP, Klassenwaffen nie im Angebot), smoke (je Klasse 30 s mit Zeichnen, Teleport, Sturmangriff, gesperrte Klasse), Screenshots PC/Handy. Code-Review (high): 10 Funde behoben (Entwicklungs-Hinweis bei geteilten Passiven, Klassenwaffen-Knoten, Zauberstab-Ziel, Krähenfüße beim Teleport, Erfolge, entprelltes Neuladen, goldene Waffe, `isClass`/`activeCls`).

### Phase 10 – Rüstkammer 2.0 (Wunsch Fabi, 2026-10-14)
Fabi hat gewählt: 10 neue Fähigkeiten (24 gesamt), dazu Runen, Kombos und Fähigkeiten-Sterne. Kein dritter Slot. Runen brauchen die Truhen als Quelle, deshalb nach dem Truhen-Umbau aus Phase 8 (erledigt 2026-10-14).
- [x] **10 neue Fähigkeiten** im Format von `src/data/abilities.js` (je `extras` a/b, `skills` s1–s3, `master` m). Effekte in `src/render/draw-abilities.js`, Icons in `src/render/icons.js`. – erledigt 2026-10-16
  - Abweichung: Puppe, Turm, Kanone, Kessel, Magnet, Bienen werden wie Fallen und Pilze direkt auf die Zeichenfläche gemalt (kein `gen/props.js`); Puppe, Turm und Kanone stehen in der y-Sortierung der Figuren (`ABIL_OBJ`). IDs `oilcask` und `scrapmag`, weil `oil` und `magnet` schon Passive sind (gleiche Icons).
  - Neue Regeln: Feuer entzündet Öl (`igniteOil` in `game/fx.js`: Feuer-Explosionen, brennender Boden, Flammenturm, Feuertrank, Feuerspur der Kanone). Unsichtbar ist jetzt `hidden()` (Rauch oder eingegraben). Strohpuppen melden sich in `run.lures`, Gegner im Umkreis gehen auf sie los und zaubern nicht. Neue Ladeart `hurt` (Groll lädt in `damagePlayer`), `damagePlayer` kennt den Angreifer (Racheblick). `nearest()` hat einen Filter.
  - Stärke (Bot, Boss-Level Welt 8, Partner Totem ≈ keine Fähigkeit, je 30 Läufe, Mittel aus Seeds 1/101): ohne 67 %; alt: Wut 82, Falle 99 (auffällig stark), Katapult 82, Rauch 77; neu: Ölfass 84, Maulwurfsgang 90, Kanone 80, Strohgoblin 87, Flammenturm 80, Wirbelaxt 82, Groll 87, Schrottmagnet 85, Bienenstock 92, Hexenkessel 88. Alle im Bereich der alten. Sim mit gleichen Seeds zweimal gleich (auch Bienen/Kessel/Puppe/Kanone).
  - `npm run smoke` setzt alle 24 Fähigkeiten mit vollem Baum je 40 s ein. Code-Review (high): 10 Funde behoben (Bienen mit `Math.random` bewegt → nicht wiederholbar; Goldtrank ~20× zu viele Münzen; Turm zielte auf Objekte; Kanonenflug zählte als perfekte Rolle; schwächere Verlangsamung überschrieb stärkere; Turm lud im Mech nicht; Racheblick nur im Nahkampf; Bienengift fehlte; Ziel-Suche je Biene; Aura legte Arrays an).

  | id | Name | Ladung | Frei ab | Kern |
  |---|---|---|---|---|
  | oilcask | Ölfass | 10 s | Konto 10 | Ölteppich in Laufrichtung (6 s): Gegner rutschen, −50 % Tempo. Feuer (Feuerball, brennende Felsen, Glutkern, Flammenturm, Kanone) entzündet ihn → Flammensee 4 s. a Großes Fass (+40 % Fläche), b Selbstzünder (zündet nach 2 s selbst); s1 Klebrig (+10 % Verlangsamung), s2 Heißes Öl (+20 % Brandschaden), s3 Ausrutscher (5 %/Rang Chance auf 1 s Hinfallen); m Ölquelle (Spur hinter dir) |
  | burrow | Maulwurfsgang | 12 s | Konto 15 | 2 s eingegraben: unverwundbar, +40 % Tempo, Gegner verlieren dich. Auftauchen mit Erdstoß (Schaden, schleudert hoch). a Tunnelspur (Erdspitzen auf dem Weg), b Beben (Auftauchen betäubt 1 s); s1 Spitzbohrer (+15 % Stoß), s2 Lange Grabung (+0,4 s), s3 Schatzgräber (wirft 2/4/6 Kristalle aus); m Doppelstoß (auch beim Eingraben) |
  | cannon | Goblin-Kanone | 60 Kills | Konto 18 | Schießt dich als Kugel zur dichtesten Gruppe: unterwegs unverwundbar, Treffer entlang der Bahn, großer Einschlag. a Doppelschuss (zweiter kurzer Sprung), b Feuerspur (Bahn brennt 3 s, zündet Öl); s1 Pulver (+12 % Einschlag), s2 Weite Bahn (+15 % Reichweite und Breite), s3 Abprall (Landung schleudert 1 Gegner/Rang weiter); m Kanonade (3 Mini-Goblin-Kugeln schlagen neben dir ein) |
  | decoy | Strohgoblin | 15 s | Konto 20 | Puppe lockt 5 s alle Gegner im Umkreis an, hält Treffer aus und explodiert mit 50 % des eingesteckten Schadens. a Zwei Puppen, b Dornenpuppe (Nahkämpfer nehmen Schaden); s1 Zähes Stroh (+20 % Leben), s2 Lauter Ruf (+15 % Lockradius), s3 Sprengladung (+20 % Explosion); m Spiegelgoblin (Puppe wirft Dolche wie du, 50 % Schaden) |
  | turret | Flammenturm | 45 % Schrott | Konto 22 | Schrott-Turm, 10 s Flammenstrahl auf den nächsten Gegner (zündet Öl). a Zweiter Turm, b Blauflamme (+50 % gegen Elite); s1 Heiße Düse (+12 %), s2 Lange Leitung (+15 % Reichweite), s3 Schrottpanzer (+2 s); m Mobiler Turm (läuft dir hinterher) |
  | spin | Wirbelaxt | 9 s | Konto 25 | 2,5 s Drehung mit zwei Äxten: Treffer alle 0,25 s, Wegstoßen, lenkt Geschosse ab, −20 % Tempo. a Sog (zieht Gegner heran), b Klingenwind (8 Äxte am Ende); s1 Schärfe, s2 Ausdauer (+0,4 s), s3 Wirbeltempo (weniger Malus, mehr Treffer); m Tornado (bleibt 3 s stehen) |
  | grudge | Goblin-Groll | **neu: `hurt`** (eingesteckter Schaden = 60 % max. Leben) | Konto 28 | Entlädt als Feuerring 400 % des eingesteckten Schadens und heilt 15 %. Aufholfähigkeit für schwere Läufe. a Racheblick (wer dich zuletzt traf, nimmt doppelt), b Dickes Fell (−20 % Schaden, solange voll); s1 Zorn (+40 % Faktor), s2 Brodeln (perfekte Rolle lädt 5 %), s3 Heißblut (+5 % Heilung); m Unendlicher Groll (danach 3 s unverwundbar, Ladung startet bei 30 %) |
  | scrapmag | Schrottmagnet | 18 s | Konto 30 | Zieht 2 s alle Gegner im großen Umkreis zusammen (keine Bosse), dann Schrottexplosion. a Dauermagnet (+1,5 s), b Kristallmagnet (zieht auch Kristalle); s1 Starke Pole (+15 % Zug, auch Elite), s2 Schrottsplitter (+20 % Explosion), s3 Verbiegen (Gezogene nehmen 3 s +10 % Schaden); m Polwechsel (stößt danach alle weg, betäubt 1 s) |
  | bees | Bienenstock | 70 Kills | Konto 35 | 25 Bienen jagen 8 s die nächsten Gegner, Stiche vergiften und verlangsamen. a Königin (große Biene, doppelter Stich, ×4 gegen Elite/Boss), b Honig (Pfütze heilt dich 2 %/s und klebt Gegner); s1 Spitze Stachel, s2 Großer Schwarm (+5 Bienen), s3 Wütende Bienen (+10 % Tempo); m Ewiger Stock (alle 10 s ein neuer Schwarm bis zum nächsten Einsatz) |
  | brew | Hexenkessel | 20 s | Welt 7 | Kessel-Roulette braut einen von 5 Tränken für 8 s: Riese (größer, +40 % Schaden, Stampfen), Flink (+50 % Tempo und Angriffstempo), Feuer (spuckt Feuer), Heil (40 % Leben + Regeneration), Gold (Kills ×3 Münzen). Zufall über das Sim-`rand` (Determinismus). a Doppelbrau (2 Tränke), b Lieblingsrezept (eine Sorte doppelt so oft); s1 Starker Sud (+10 % Wirkung), s2 Lange Wirkung (+1 s), s3 Übersprudeln (Spritzschaden beim Brauen); m Meistertrank (10 %: alle 5 zugleich) |

  - Neue Ladeart `hurt` in `src/game/abilities.js` (Treffer am Goblin dort abgreifen, wo das Leben sinkt), `CHARGE_TXT` und `xpPerUse` ergänzen.
  - Rollen für den Regal-Filter: Angriff (Katapult, Knall, Wirbelaxt, Turm, Bienen, Groll), Kontrolle (Falle, Rauch, Zeitbombe, Öl, Puppe, Magnet), Bewegung (Haken, Maulwurf, Kanone), Schutz (Schild, Pilzring, Amulett), Helfer (Wut, Totem, Ratten, Ruf, Kessel, Maschine).
- [x] **Runen:** Sockel 1 ab Fähigkeits-Level 10, Sockel 2 ab Level 20 (3. über den Seelenbaum, Phase 12). – erledigt 2026-10-16
  - Entscheidungen Fabi (2026-10-16): Steinplättchen mit eingeritztem, glühendem Zeichen, Rand in der Seltenheit; Ausbauen kostenlos (Rune zurück in die Tasche).
  - Umsetzung: Daten `src/data/runes.js` (Werte je Stufe, Tags je Fähigkeit `ABIL_TAGS`, Truhen-Mengen), Logik `src/game/runes.js` (Tasche, Sockel, Verschmelzen, Würfeln, `normRunes`), Laufzeit in `game/abilities.js`. Je Fähigkeit jede Runenart nur einmal. `save.runes` über `normalize` (kein Versionssprung; der Punkt „Spielstand v5“ bleibt offen).
  - Werte (gewöhnlich/selten/episch/legendär): Wucht/Weite +8/15/25/40 %, Eile −6/12/20/30 % Ladung, Glück +5/10/15/25 % Krit, Feuer 2 s Brand mit 15/25/40/60 % des Treffers pro s, Gift 4 s bis 5 Stapel je 3/4/5/7 %/s, Frost 20–50 % langsamer 1,5 s (nicht an Bossen), Blitz 15/25/35/50 % Chance auf 1/1/2/3 Sprünge mit 50 %, Echo 10/18/27/40 % (halbe Kraft nach 0,5 s), Blut 0,3–1,5 % Heilung je Kill (max. 3 %/s), Gier 4–16 % Münze je Kill, Seele 1–4 % Ladung der anderen Fähigkeit je Kill.
  - Schadensquelle: `abSrc`/`setSrc` in `state.js`; Geschosse, Katapult-Felsen, Brandzonen und `later()` merken sich die Quelle (`src`), laufende Effekte über `FX_SRC`. Brand, Gift und Runen-Blitz lösen keine Runen aus und treffen nie kritisch.
  - Echo nur bei Fähigkeiten, die man gefahrlos zweimal auslöst (Tag `burst`; nicht Wut und Zeitbombe). Feuer/Frost/Gift/Blitz/Glück/Blut/Gier/Seele nur auf Fähigkeiten mit Schaden (`hit`/`summon`), Eile/Echo nicht aufs Amulett.
  - Quellen: Truhen (Holz 25 % auf 1, Eisen 1–2, Gold 2–3, Magier 4–6, Seltenheit nach Truhe), **Runenkiste** im Laden (50 Juwelen, 3 Runen, mind. eine seltene; Kiste statt Beutel, weil die Truhen-Animation einen Deckel braucht). Runen werden nach Karten/Gold/Bonus gewürfelt, gleiche Seeds geben dieselben Karten wie vorher (Test).
  - UI: Sockel und Knopf „Runen-Tasche“ auf dem Zettel der Rüstkammer, Overlay `src/ui/runes.js` (Sockel, Raster mit passenden zuerst, Zettel mit Einsetzen/Tauschen/Ausbauen/Verschmelzen 3→1, Verschmelz-Animation eigen statt `mega-fx.js`, das am Lauf hängt). Runen in der Truhen-Animation als eigener Schritt nach den Karten; das Licht steigt auch für die beste Rune. Kleine Runen-Punkte am Fähigkeits-Knopf im HUD.
  - Sim: `npm run sim -- --runes fire.3+bolt.3,might.2` (Komma = Slot, + = zweiter Sockel; Fähigkeit auf Level 20). Mit gleichen Seeds zweimal gleich.
  - Stärke (Welt 8 Boss-Level, Katapult + Totem, je 30 Läufe, Seeds 1/101; Sieg % und Bosszeit): ohne 73/90 % (49/45 s), Wucht.3+Weite.3 73/93 % (47/44 s), Feuer.3+Blitz.3 70/93 % (49/43 s), Echo.3+Glück.3 77/90 % (47/42 s), Gift.3+Frost.3 77/90 % (49/45 s). Bienenstock + Totem ohne/Feuer.3+Blitz.3/Echo.3+Wucht.3: 57/83, 57/83, 57/80 %. Auch legendäre Runen bleiben im Streubereich – sie sind ein sanfter Langzeit-Fortschritt, kein Machtsprung. Gegen Bosse wirken Brand und Gift am meisten (Katapult-Felsen töten kleine Gegner sofort). Bei Bedarf in „Sim und Balance“ nachschärfen.
  - Tests: `test/runes.test.js` (Sockel, Tausch, Ausbauen, Verschmelzen, Reparatur kaputter Stände, Mengen je Truhe, Karten wie vorher). `npm run smoke`: Runenkiste kaufen, Tasche (Verschmelzen, Einsetzen, Ausbauen, Esc), drei Läufe mit allen zwölf Runenarten.
  - 12 Runen, je 4 Stufen (gewöhnlich bis legendär): Feuer (Treffer brennen), Frost (verlangsamen), Gift (stapelbar), Blitz (springt über), Echo (Chance, 0,5 s später mit halber Kraft noch einmal), Eile (−Aufladung), Wucht (+Schaden), Weite (+Fläche), Blut (Kills heilen), Gier (Kills geben Münzen), Seele (Kills laden die andere Fähigkeit), Glück (+Krit).
  - 3 gleiche → eine der nächsten Stufe (Verschmelz-Animation). Duplikate sind so nie wertlos.
  - `fits` nach Tags der Fähigkeit (`hit`/`summon`/`buff`): Feuer passt z. B. nicht aufs Amulett.
  - Quellen: Truhen (Holz 25 % auf 1, Eisen 1–2, Gold 2–3, Magier 4–6), Runenbeutel im Shop, Kopfgeld, Pass, Fähigkeiten-Quests.
  - Speicher: `save.runes = { bag: { 'fire.0': 3 }, sock: { trap: ['fire.1', null] } }`.
  - Laufzeit: Schaden aus Fähigkeiten bekommt die Quelle `ab:<id>`, gemeinsame Hooks `abHit`/`abKill` in `game/abilities.js` (am Helfer „Stoß im Kreis“), Echo über `later()` in Spielzeit (`game/fx.js`).
  - UI: Sockel auf dem Zettel, Runen-Tasche als Overlay, Knopf „Verschmelzen“.
- [x] **Kombos:** 12 Paare in `src/data/combos.js` (`{ a, b, name, desc, win }`), lösen aus, wenn die zweite Fähigkeit innerhalb von 4 s nach der ersten kommt. Erstes Entdecken: Banner, Eintrag im Kombo-Buch (Rüstkammer, Unentdecktes als „?“ mit einem bekannten Icon), 10 Juwelen; Erfolg „Kombo-Meister“. – erledigt 2026-10-16
  - `src/data/combos.js` (Daten), Auslösen und Wirkung in `game/abilities.js` (`checkCombo`, `COMBO_FX`): die Wirkung kommt beim Einsatz der zweiten Fähigkeit, danach beginnt die Zählung neu. Entdeckt in `save.combos`, Kombo-Buch `src/ui/combobook.js` (Chip in der Rüstkammer). Erfolg „Kombo-Meister“ (3/8/12, Titel).
  - Wirkungen: Giftfallen (Giftwolke an jeder Falle), Inferno (Öl brennt, Türme +50 %), Implosion (zweiter Knall mit 50 %), Volltreffer (Riesenfels auf die Gruppe), Wirbelhaken (Sog 380 px), Kriegsrausch (Krieger +50 % Kraft, +30 % Tempo), Eisbahn (Gegner auf Öl frieren 2 s), Köderfalle (Falle unter jedem Strohgoblin), Plage (alle im Bild 3 Giftstapel, langsamer), Hexenküche (25 % Heilung + Trank), Klingenschild (Schild +50 %, schneidet Angreifer), Unterbeben (Erdstoß unter bis zu 12 eingefrorenen Gegnern). `npm run smoke` löst alle 12 aus.
  - Rauch + Falle = Giftfallen · Öl + Flammenturm = Inferno · Magnet + Großer Knall = Implosion (×1,5) · Magnet + Katapult = Volltreffer · Haken + Wirbelaxt = Wirbelhaken · Wut + Ruf = Kriegsrausch (Krieger in Raserei) · Zeitbombe + Öl = Eisbahn · Strohgoblin + Falle = Köderfalle · Ratten + Bienen = Plage · Pilzring + Kessel = Hexenküche · Schild + Wirbelaxt = Klingenschild · Maulwurf + Zeitbombe = Unterbeben.
- [x] **Fähigkeiten-Sterne:** Nach Level 30 sammelt die Fähigkeit weiter XP, je 2000 XP ein Stern (bis 5). Jeder Stern +3 % Kraft und ein sichtbar anderer Effekt-Look (Bronze → Silber → Gold → Lila → Regenbogen); 5 Sterne = Titel „Legende der <Fähigkeit>“. Speicher `abilities[id].st`. – erledigt 2026-10-16
  - Sterne in `gainAbilXp` (core/save.js), Kraft über `abilMods`, Glanz beim Einsatz (`starFx`, Ring und Funken in der Sternfarbe, 5 Sterne bunt), Titel über `titles()` (game/progress.js), Erfolg „Sternensammler“. Ergebnis zeigt „Neuer Stern!“ bzw. „Legende!“. Rüstkammer: Balken bis zum nächsten Stern.
- [x] **Rüstkammer-UI:** Regal mit Filter-Chips (Rollen), „Neu“-Markierung, Sortierung nach Level; Sterne auf Token und Plakette; Knöpfe „Runen“ und „Kombo-Buch“. Desktop- und Handy-Screenshots. – erledigt 2026-10-16
  - Chips über dem Regal: Alle / Angriff / Kontrolle / Bewegung / Schutz / Helfer (`ROLES` in data/abilities.js), „Nach Level“, „Kombo-Buch n/12“, Zähler „n neu“. „Neu“-Schild an Fähigkeiten, die frei, aber noch nie angesehen sind (`save.seen`). Sterne auf Marke und Plakette.
- [x] **Sim und Balance:** `sim/bot.js` mit `--tree full` (volle Bäume, erledigt den offenen Punkt aus Phase 8) und `--runes a.2,b.1`; Stärke-Tabelle wie in Phase 4 für alle 24 Fähigkeiten, neue in den Bereich der alten bringen.
  - 2026-10-27: Stärke-Tabelle aller 24 (Boss-Level Welt 8, Partner Totem, Konto 40, je 30 Läufe × Seeds 1/101, Standard und `--tree full`). Siegquote sättigt (ohne Fähigkeit schon 86,5 %, voller Baum überall 100 %), deshalb zählt die Boss-Kampfzeit: ohne 86 s / voll 80 s.
  - Ausreißer und Änderungen: Goblin-Ruf 45 s / voll 13,5 s (Krieger dauerhaft da: Dauer 12,4 s ≥ Aufladung 12 s) → Aufladung 16 → 20 s, Grundschaden 25+1,5·Lv → 13+0,8·Lv, gegen Große 30 %, Mehr Krieger +2 statt +4, Flinke Krieger schlagen nur +6 %/Rang schneller, Häuptling ×2 statt ×3, Kriegsschrei 2,5 s → 78,5 s / voll 39,5 s (bleibt mit vollem Baum die stärkste). Bärenfalle 100 % Sieg → hält 1,6 s, Bosse 40 % (auch Splitter) → 85 s / voll 51 s. Bienen (Königin ×2 statt ×3, +4 Bienen/Rang, Ewiger Stock alle 15 s) voll 42 → 53 s. Flammenturm, Wirbelaxt −15–20 % Grundschaden (voll 53,5/54 s). Rauchbombe war schlechter als keine Fähigkeit (99 s) → Malus 45 → 15 % statt 60 → 20 % → 95 s / voll 63 s.
  - Übrige (Standard/voll in s): Wut 85/76, Maschine 85/72,5, Katapult 84/68, Haken 73,5/61, Pilze 93/61,5, Schild 83/72, Ratten 88,5/77, Zeitbombe 85,5/75,5, Knall 87,5/73, Amulett 90/79, Ölfass 88/55,5, Graben 95,5/80, Kanone 84,5/76,5, Puppe 84/69, Groll 84,5/70,5, Magnet 85,5/69, Kessel 81,5/50.
- [x] **Spielstand v5** mit Migration (`src/core/save.js` `migrate`/`normalize`). – erledigt 2026-10-16: `migrateV4` markiert alles schon Freie als gesehen (sonst stünde überall „Neu“); Runen, Kombos, Sterne, Vollbild kommen über `normalize`. Test in `test/save.test.js`.
- [x] **Bosse stärker und länger + Weiterversuch für Juwelen (Wunsch Fabi, 2026-10-16):** Bosskämpfe dauern im Moment ~45 s (Sim, Welt 8) – mehr Leben bzw. längere Phasen, damit sie sich wie ein richtiger Kampf anfühlen. Wer stirbt, kann wie in Undertale **für Juwelen weitermachen**: im Boss-Level direkt am Bossbeginn neu starten, in normalen Leveln an Ort und Stelle weiter (mit kurzer Unverwundbarkeit). Vor dem Umsetzen klären: Preis (fest oder steigend je Versuch), wie oft pro Lauf, zählen Hüte/Bestzeit danach noch. Danach Sim-Zielwerte (`LEVEL_TARGET`) und Bosszeiten neu messen. – erledigt 2026-10-16
  - Entscheidungen Fabi: Preis steigend 10/20/40 Juwelen, höchstens 3× pro Lauf; Sieg zählt, aber nur der erste Hut und keine Bestzeit; Bosse etwa doppelt so lang bei gleicher Siegquote.
  - Boss-Leben `BOSS_HP` 2,8 → 5,6 (Welt 1–2 ×0,7, sonst zu schwer für Anfänger), Ausgleich `BOSS_EASE` = 0,75 auf Schaden und Spawnrate im Boss-Level, Welt 4/6 nachjustiert, Wut-Timer 120 → 180 s.
  - Sim (Boss-Level, je 30 Läufe, Seeds 1/101): Welt 1 60/70 %, 2 77/87 %, 3 73/93 %, 4 80/70 %, 5 67/73 %, 6 77/83 %, 7 70/70 %, 8 77/83 % (Ziel 60–85). Bosskampf jetzt 55–120 s (vorher ~45 s).
  - Weitermachen: `offerContinue`/`doContinue` in game/run.js, Fenster `src/ui/continue.js`. Im Bosskampf `restartBoss()` (Boss, Teile, Wetter weg, neuer Auftritt), sonst an Ort und Stelle (volles Leben, 3 s unverwundbar, Gegner weggestoßen). Nicht in der Endlosen Nacht und nicht in der Sim (`run.noCont`). Ergebnis zeigt „Mit Weitermachen geschafft“.
- [x] **Mehr und unterschiedlichere Musik (Wunsch Fabi, 2026-10-16):** Heute ein Stück je Welt, je Boss, Titel und Ergebnis (`src/core/music.js`). Mehr Abwechslung: mehrere Stücke bzw. Teile je Welt (z. B. ruhig am Anfang, treibend ab Minute 2, eigenes Stück für die Endlose Nacht und den Laden/Hub), verschiedene Instrumente und Rhythmen je Welt statt gleicher Klangfarbe. Vorher 2–3 Hörproben zur Auswahl an Fabi. – erledigt 2026-10-16
  - Fabi hat gewählt: Teile je Welt + eigene Instrumente (ohne Hörproben). `Music.part` (scenes/run.js): 0 ruhig (Bass auf 1 und 3, Akkord-Teppich, Lied-Melodie jede zweite Phrase), 1 treibend ab 45 s (Polka und neue Marsch-Melodie im Wechsel), 2 solange ein Mini-Boss lebt (10 % schneller, Oktav-Bass, Toms). Wechsel nur am Takt- bzw. Phrasenanfang.
  - Instrumente je Welt (`inst` in THEMES): Wiese Flöte, Schnee Celesta, Sumpf Harfe + Holzklötze, Gräber Orgel + Marsch, Spiegel Glas, Klippen Blech, Schlund Rohrblatt + Trommeln, Turm Cembalo, Nacht Synth. Test: alle Melodien in der Tonleiter jeder Welt.

### Phase 11 – Quests und Aufgaben-Pass (Wunsch Fabi, 2026-10-14)
Fabi hat gewählt: Wochenaufgaben + Aufgaben-Pass, Kopfgeld-Brett, Fähigkeiten-Quests (keine Geschichten-Quests). Entscheidungen 2026-10-28: 6. Tab unten, Kopfgeld jetzt ohne Mutatoren (kommen mit Phase 12). – erledigt 2026-10-28
- [x] **Wochenaufgaben:** 5 je Woche (Montag–Sonntag ab `QUEST_EPOCH` 2026-10-26) aus 15 (`WEEKLY_POOL` in `src/data/quests.js`, Seed `'goblin-woche-' + Woche`). Beim Wochenstart festgelegt, nur was schon geht (Albtraum ab Welt 1, Klassen ab Welt 2). Belohnung Juwelen/Gold/Runenkiste/Eisentruhe, alle 5 = Goldtruhe. Neue Zähler `nmwin`, `hat3`, `clswin`; Truhen über `stats.chests`.
- [x] **Aufgaben-Pass (kostenlos):** Saison 4 Wochen, 30 Stufen à 100 Punkte (Tagesaufgabe 20, alle drei +30, Woche 60, Kopfgeld 30, Fähigkeiten-Quest-Stufe 40). Belohnungen Gold/Juwelen/Runenkisten/Truhen, Stufe 10/20/30 Saison-Kosmetik (4 Sets Frost/Glut/Gift/Nacht: Spur, Dolch, Maschine, nur über den Pass), Stufe 30 Titel „Pass-Held“, danach alle 150 Punkte eine Eisentruhe. Saisonwechsel liefert Erreichtes, nicht Abgeholtes nach. `save.pass`.
- [x] **Kopfgeld-Brett:** ab Welt 2, täglich 3 Steckbriefe (Seed Datum, beim ersten Ansehen festgelegt). Ziele: Boss einer freien Welt, Level einer freien Welt, Magier einer Schule (40/60/80 in einem Lauf), Elite mit Eigenschaft (1–2, ab Welt 3). Bedingungen: ohne Treffer im Bosskampf, unter einer Zeit, mit Fähigkeit X, im Albtraum, ohne Heilung, als Klasse X. 1–3 Totenköpfe → 200 Gold / 25 Juwelen / Eisentruhe. Geprüft am Laufende (`checkBounties`), Weitermachen zählt nicht, „Kopfgeld erfüllt“ im Ergebnis. Neue Laufzähler: `af.<Eigenschaft>`, `run.bossHits`, `run.healed` (alle Heilungen über `heal()` in `game/state.js`).
- [x] **Fähigkeiten-Quests:** je Fähigkeit 3 Stufen. Abweichung: statt je eigener Ziele zählen Kills mit der Fähigkeit bzw. ihren Helfern (`ab.<id>.kills` über `abSrc`, 200/1500/8000), Fähigkeiten ohne Schaden ihre Einsätze (`ab.<id>.use`, 30/200/800; Amulett 5/25/80 Rettungen). Bronze = passende seltene Rune, Silber = Runenkiste + Silberrahmen (statt Effekt-Farbskin), Gold = legendäre Rune + Titel „Meister der …“ + Goldrahmen; Rahmen in Regal und HUD. Anzeige und Abholen auf dem Rüstkammer-Zettel, Stern am Regal-Plättchen.
- [x] **Hub:** 6. Tab „Aufgaben“ (Schriftrolle, roter Punkt) mit Täglich / Woche / Kopfgeld (Pergament-Steckbriefe) / Pass (Stufenleiste, scrollt zur nächsten offenen Stufe); die Tagesaufgaben sind aus dem Profil umgezogen (`src/ui/quests.js`).
  - Spielstand v7 (`weekly`, `pass`, `bounty`, `aq`, alles beim Laden geprüft). Geprüft: lint, 136 Tests (7 neue: Woche, Pass, Saisonwechsel, Kopfgeld-Bedingungen, Quest-Stufen, Migration), smoke (neuer Abschnitt Aufgaben), Sim gleiche Seeds gleich (auch mit Heil-Fähigkeiten), perf wie 3.0.6, Screenshots PC/Handy. Code-Review (high): 10 Funde behoben.

### Phase 12 – Wiederspielwert nach der Endlosen Nacht (Wunsch Fabi, 2026-10-14)
Fabi hat gewählt: Wiedergeburt + Seelenbaum, Albtraum-Stufen 2–10, Tägliche Herausforderung. Entscheidungen 2026-10-28: Albtraum-Stufen je Welt, Herausforderung als Reiter im Aufgaben-Tab, Seelenbaum am Altar auf der Weltkarte, Mutatoren auch im Kopfgeld. – erledigt 2026-10-28
- [x] **Wiedergeburt + Seelenbaum:** frei nach Sieg über den Boss von Welt 8 und einer vollen Runde (4:00) Endlose Nacht im laufenden Zyklus (Altar der Seelen am Ende der Weltkarte, `src/ui/soultree.js`, Logik `src/game/souls.js`).
  - Zurückgesetzt: Welt-Fortschritt samt Albtraum. Bleibt: Karten, Talente, Fähigkeiten, Runen, Kosmetik, Klassen, Gold/Juwelen, Konto- und Klassen-Level.
  - Seelen = 10 je Welt im Zyklus + 5 je Albtraum-Stufe (beste Boss-Stufen) + Minuten der besten Endlosen Nacht.
  - Abweichung: Zyklus n: Gegner +10 %·n Leben und +5 %·n Schaden (statt +20 %, Zyklus 2 war im Bot sonst nicht schaffbar), Gold und XP +25 %·n; Zyklus-Anzeige auf der Karte.
  - Seelenbaum mit 19 Knoten in 3 Ästen + Krönung (`src/data/souls.js`): Krieger (Schaden, Leben, Startwaffe Stufe 2, Neuwürfeln, Krit, Bannen), Sammler (Gold, Magnet, Pity −20 %, Rune in der Siegtruhe, Juwelen, XP), Mystiker (Fähigkeits-XP, 25 % Ladung, Abklingzeit, 3. Runensockel ab Fähigkeits-Level 25, Ausdauer). Krönung „Seelenkrone“: 4 statt 3 Karten beim Level-Up (60 Seelen je Ast).
  - Speicher `save.rebirth { n, souls, spent, best, night }` (Spielstand v8); Sim `--rebirth n`.
- [x] **Albtraum-Stufen 1–10 je Welt:** `save.map.nm` als Zahl je Welt (Migration true → 1), Auswahl über Totenkopf-Punkte auf der Karte (`src/data/nightmare.js`). Abweichung: Stufe t: Leben +80 % + 15 %·(t−1), Schaden +6 %·(t−1) (Bot); ab 4 eine Elite-Eigenschaft mehr, ab 7 zwei Mini-Bosse, ab 9 Wut-Timer beim Boss (120 s); Belohnung +50 % + 10 %·t, bessere Truhe bei 3/6/9, 5+t Juwelen beim ersten Sieg jeder Stufe.
- [x] **Tägliche Herausforderung:** Reiter „Herausforderung“ im Aufgaben-Tab. Seed `'goblin-challenge-' + dayKey` bestimmt Welt/Level, 2 feste Fähigkeiten und 1–2 Mutatoren aus 12 (`src/data/mutators.js`: Glaskanone, doppelte Elites, Riesen, Dunkelheit, schnelle Magier, keine Heilung …; Werte im Bot angeglichen). Beliebig viele Versuche, lokale Bestzeit; erster Abschluss gibt Gold, Runen, 40 Pass-Punkte. Kopfgeld-Steckbriefe können jetzt auch einen Mutator verlangen. Bestenliste über den Worker bleibt optional.
  - Geprüft: lint, 147 Tests, smoke (Abschnitt Phase 12), Sim gleiche Seeds gleich (auch mit Mutatoren und Zyklus), perf wie 3.0.6 (Bilder 111 MB), Deploy auf goblin.node-wave.org. Code-Review (high): 10 Funde behoben.

### Phase 13 – Design-Overhaul: gleicher Stil, mehr Tiefe (Wunsch Fabi, 2026-10-14)
Fabi hat gewählt: Vektor-Cartoon bleibt, aber mit Schattierung, Glanz, Randlicht, mehr Details und Bildern; Umfang: Figuren, Effekte, Welten, Menüs/Icons. Nach Phase 10–12, damit die neuen Inhalte gleich im neuen Stil entstehen. – erledigt 2026-10-28 (Stil „B voll“)
- [x] **Stilregeln** als neuer Abschnitt 4.5: Licht von oben links, drei Töne + Randlicht über SVG-Verläufe (`sf()` in `src/gen/svg.js`). Abweichung: Kontur bleibt 1,6 (Fabi wählte B). – erledigt 2026-10-28
- [x] **Referenzbild zuerst:** Goblin flach / A dezent / B voll / C kräftig in 7 Ansichten und 3 Klassen; Fabi hat B gewählt. – erledigt 2026-10-28
- [x] **Goblin, Gegner, Bosse** (`goblin.js`, `mages.js`, `minions.js`): Schattierung über `sf()` (Haut, Ohren, Körper, Hut, Hände, Füße, Klassen-Teile; Magier-Robe, Hüte, Köpfe; Golem), Glanz auf Hut und Körper, Kopfschatten. Goblin: Ruhe 6 statt 4 Bilder, Laufen 8 statt 6 (`idleFrame`/`walkFrame`, gleicher Takt), Blinzeln jedes vierte Ruhe-Durchlauf (`blinking`). Abweichung: Magier und Diener behalten ihre Bildzahl (Speicher). – erledigt 2026-10-28
- [x] **Effekte**: Geschosse mit glühendem Kern und Schweif (Leuchtbild je Element einmal gemalt, `glowTail` in `render/draw-world.js`, auch Feuerball und Eisspeer), Treffer-Funken in der Trefferfarbe (`sparks` in `game/fx.js`, höchstens bis zur halben Teilchen-Grenze), Sterbe-Auflösen gab es schon. – erledigt 2026-10-28
- [x] **Welten** (`render/tiles.js`): eigener Boden für Schnee, Sumpf (Pfützen), Knochenacker (Erde, Grasflecken), Sturmklippen (Fels, Risse), Felsenschlund (Basalt, gedämpfte Glutrisse) und Turm (versetzte Steinplatten); Wiese, Spiegelhain und Nacht bleiben getöntes Gras. Kachel 576×432. Vignette mit warmem Licht von oben links (¼-Auflösung, einmal je Fenstergröße). – erledigt 2026-10-28
- [x] **Menüs und Icons**: einheitliches Licht auf allen Icons (`shadeIcon`), eigene Deckel je Truhe (Holz flach mit Brettern, Eisen gewölbt mit Nieten, Gold hoch mit Juwel, Magier spitz wie ein Zauberhut), Kartenrahmen je Seltenheit, Folienglanz ab Episch (per transform, steht bei reduzierter Bewegung). – erledigt 2026-10-28
- [x] **Budget:** Bildspeicher 111 → 112 MB. Die Verläufe kosteten beim Rastern am gedrosselten Handy ~1,4 s Ladezeit; dafür lädt der Goblin jetzt in zwei Teilen (`loadGoblin` in `render/sprites.js`): vor dem Hub nur Ruhe/Laufen/Blinzeln, Sprint/Rolle/Treffer/Sieg/Tod danach über die Hintergrund-Schlange mit Vorrang, jeder Laufstart wartet darauf (`goblinDone`). Ergebnis `npm run perf`: Handy Ladezeit 8,9 → 7,1 s, Hub-Bildrate wie vorher; PC 3,0 → 1,5 s ohne Ruckler. Boden einer Welt wird beim Laufstart gemalt, nicht im ersten Bild. Screenshots Desktop + Handy, Nahaufnahmen aller Hüte, Klassen, Animationen, Magier und Diener geprüft (Wunsch Fabi 2026-10-28: auf saubere Übergänge und Ebenen achten). Zwei Code-Reviews (high): 19 Funde behoben. – erledigt 2026-10-28

### Phase 14 – Multiplayer: Koop zu zweit (Wunsch Fabi, 2026-10-14, bewusst ganz am Ende)
Fabi hat gewählt (2026-10-28): **gemeinsames Level** (eine XP-Leiste; beim Level-Up pausiert das Spiel, beide wählen gleichzeitig je eine eigene Karte, 15 s Zeitlimit; Waffen/Passive je Goblin eigene), **Raum-Code ohne Anmeldung** (4 Buchstaben), **Wiederbeleben** (Partner steht 3 s daneben → halbes Leben; fallen beide, ist der Lauf vorbei), **zuerst nur Weltkarte-Level** (inkl. Albtraum; Endlose Nacht, Herausforderung, Kopfgeld später).

Ausgangslage (Erkundung 2026-10-28): Alles hängt am einen Spieler `P` (`game/state.js`, 27 Dateien, ~670× `P.x/P.y`); Waffen, Fähigkeiten, Angebot liegen auf `run.*`. Eingaben kommen aus DOM-Handlern direkt in die Sim (`core/input.js` → `game/player.js`, `doDash`/`useAbility` sofort). Logik hing an der Fenstergröße (`W/H/ZOOM` aus `render/canvas.js`) und an der Wanduhr (`run.megaFreeze` mit `performance.now()` in `scenes/run.js`, `ui/run-chest.js`, `ui/mega-fx.js`). Zufall ist sauber (Math.random/frand nur Optik). Worker hat noch kein Durable Object und keinen WebSocket.

Ansatz „aktiver Spieler“: `run.players = [p0, p1]`, `P` bleibt die Variable des gerade gerechneten Spielers; `activate(i)` setzt `P` und tauscht die Ausrüstung je Spieler in `run` (weapons, passives, boons, abil, abMods, runes, abXp, offer, cards, rerolls, bans, cardN). Spieler-Systeme laufen je Spieler, alles andere sucht den nächsten lebenden Goblin. Einzelspieler = Liste mit einem Eintrag.

- [x] **14a Sim lockstep-tauglich** (Einzelspieler bleibt gleich; Sim mit gleichen Seeds vor/nach vergleichen):
  - [x] Logik-Sicht `viewHW/viewHH/viewC` in `game/state.js` (allein aus dem Fenster, im Koop fest `run.fixedView` und Mitte `run.vc`); `viewR`, `onScreen`, `randomEnemyInView`, Schwarm, Rattenflut, Geschosse nutzen sie.
  - [x] Eingabe je Tick: `core/input.js` sammelt in `{ mx, my, sprint, dash, ab0, ab1, skip }` (Knöpfe „gedrückt seit letztem Tick“, `pressInput`/`takeInput`), `update(dt, inp = takeInput())` gibt sie an `updPlayer`; `doDash`/`useAbility`/Cutscene-Skip laufen am Anfang des Ticks. Touch (`ui/controls.js`) und Tastatur schreiben nur noch in den Datensatz; Bot/Smoke rufen weiter direkt `doDash`/`useAbility`. – erledigt 2026-10-29
  - [x] `megaFreeze` als Sim-Zeit statt `performance.now()` (Sekunden, je Schritt in `scenes/run.js` heruntergezählt). Offen für 14c: Überspringen der Truhe (`ui/run-chest.js` finish) setzt es lokal auf 0 → im Koop als Eingabe schicken oder dort abschalten. – erledigt 2026-10-29
  - [x] Prüfsumme `simHash()` in `game/run.js` (`run.tick`, Zeit, Kills, Gold, Spieler, alle Gegner, RNG-Stände; Streams haben dafür den Zustand `s`). Geprüft: Sim Welt 3 und Boss 7 vor/nach gleich, zwei gleiche Läufe gleiche Prüfsummen, kleine Eingabe-Abweichung fällt in der nächsten Prüfsumme auf. – erledigt 2026-10-29
- [x] **14b Zwei Goblins in einer Sim:** `run.players`, `activate(i)`, Profil je Spieler (Klasse+Level, Talente, Kartenstufen, Loadout+Bäume, Runen, Seelenbaum, Aussehen, Name) statt `save` in `recalc`/`initAbilities`/`addWeapon`; Gegner/Würfe/Boss zielen auf den nächsten Goblin, `damagePlayer(p, …)`; Spawn um die Sicht-Mitte; Gegner-Leben ×1,6; jeder sammelt mit eigenem Magnet, Team-XP, Gold/Kills gemeinsam, Truhen für den Sammler; Level-Up gemeinsam (Angebote Spieler 0 dann 1 aus RNG.lvl, 15 s in Ticks, danach erste Karte); Sturz/Wiederbeleben, „Weitermachen“ im Koop aus; Kamera auf die Mitte, Leine (Sicht); zweiter Goblin mit eigenem Aussehen, Namensschild, Partner-Anzeige; Testmodus `?coop=local` (WASD/Pfeile); Bot `--coop`, Siegquote ≈ Einzelspieler. – erledigt 2026-10-29, so umgesetzt:
  - Profil `game/profile.js` (`profileOf()`, JSON-Kopie in Spielstand-Form), Ausrüstung je Goblin über `state.js` `KIT`/`activate`/`eachPlayer`; im Schritt ist Goblin 0 aktiv, danach der eigene (`run.me`). Jeder Gegner wird mit dem nächsten sichtbaren Goblin als `P` gerechnet (`nearestGob`), Feindgeschosse, Bodengefahren und Explosionen prüfen jeden Goblin.
  - Gemeinsame XP-Leiste (Sammler zählt mit seinem XP-Bonus), Kristalle fliegen zu dem, der sie anzog. Level-Up `startCoopLevel`/`coopLevelTick` (`game/levelup.js`), Wahl als Eingabe `pick`. Würfeln, Bannen, Sperren und Überspringen gibt es im Koop vorerst nicht. Mini-Boss-Truhe wählt nur, wer sie aufhob (`run.chestBy`).
  - Sturz/Wiederbeleben (`combat.js` `fall`/`reviveTick`, 3 s im Umkreis 70), fallen beide → verloren; Kamera und Spawns um die Mitte aller Goblins, zoomt nur so weit heraus, dass beide passen; Leine `COOP_LEASH` (höchstens 900 × 520 auseinander).
  - Abweichung Ausgleich: statt Leben ×1,6 jetzt **Leben ×1,8 und Schaden ×1,5** (`COOP_HP`/`COOP_DMG`) – mit ×1,6 gewann der Koop-Bot jedes Level zu 100 %. Sim `--coop [--coophp --coopdmg]`: Welt 3 und 6 (Seeds ab 1) und Welt 2, 5, 8 (Seeds ab 101) fast überall im Ziel, Bosskämpfe so lang wie allein.
  - Prüfwerkzeug `node tools/coop-check.mjs`: allein und im Koop zwei gleiche Läufe → gleiche Prüfsummen; die ersten Prüfsummen allein vor/nach Umbauten vergleichen. Gestürzte werden in die Boss-Arena geschoben (sonst unerreichbar).
  - Testmodus `?coop=local`: Spieler 2 mit Pfeilen, Enter (Rolle), Shift rechts, K/L, Karten 7–0. Partner-Anzeige unter der Uhr, Namensschilder, Wiederbeleben-Ring.
  - Offen: Partner sieht aus wie der eigene Goblin (eigene Sprites je Aussehen/Klasse kosten Ladezeit und Speicher → in 14d entscheiden). Brandzonen und verzögerte Effekte rechnen mit Goblin 0 als Besitzer (Lebensraub/Krit des Partners zählt dort nicht; gleich auf beiden Rechnern, also unkritisch).
- [ ] **14c Lockstep-Netz** (`src/net/lockstep.js`): Eingabe-Verzögerung 4 Ticks, Sim nur mit beiden Eingaben, ab 0,5 s Warten „Warte auf Partner …“, nach 15 s allein weiter; Prüfsumme alle 60 Ticks, Abweichung → Lauf endet mit Hinweis; keine Einzel-Pause im Koop; Belohnung jeder in den eigenen Spielstand.
- [ ] **14d Raum-Server und Oberfläche:** Durable Object `Room` (`cloud/src/room.js`, SQLite-Klasse, Hibernation-WebSockets; Bindung + Migration in `cloud/wrangler.toml`), `POST /api/room` → Code, `GET /api/room/<CODE>` WebSocket mit Origin-Prüfung (`ALLOWED_ORIGINS`), höchstens 2 Teilnehmer, Nachrichten `hello`/`start`/`in`/`hash`/`bye`, gleiche Spielversion Pflicht, Verfall nach 30 min. Client `src/net/room.js`, Overlay `src/ui/coop.js` (Raum erstellen/Code eingeben, Partner-Name/Klasse), Knopf „Koop“ neben „Los!“ in `#lvNote` (`ui/worldmap.js`), Start über `startStage(…, { mode: 'coop' })`; Level-Up mit Partner-Status und Countdown, Wiederbeleben-Ring, Ergebnis mit beiden.
- [ ] **14e Prüfen:** Determinismus mit zwei Eingabeströmen, `cloud/test/room.test.js`, Ende-zu-Ende zwei Playwright-Seiten über `wrangler dev` (`tools/coop-e2e.mjs`), Smoke-Abschnitt Koop, perf, Review (high), Deploy auf Wunsch.
- Risiko: iOS-Safari kann bei `Math.sin/cos` minimal abweichen → Prüfsumme erkennt das; Windows-App, Android-App und Chrome nutzen alle V8.

---

## 12. Testen und Qualität

### 12.1 Simulations-Bot

Aus v2 übernehmen (`sim.js`) und ausbauen:

- Bot weicht Geschossen, Bodenwarnungen und Explosionen aus, sammelt Kristalle, nutzt Fähigkeiten, sobald sie bereit sind.
- **Drei Bot-Stärken:** "Anfänger" (weicht nur 50 % aus, wählt Karten zufällig), "Normal", "Profi". Zielwerte in 7.6 gelten für "Normal".
- Läuft headless im Zeitraffer (eine Stage dauert ~1 s Rechenzeit).
- `npm run sim -- --stage 3 --runs 50 --profile mid` → Tabelle mit Siegquote, Ø Level bei 1/2/3/4 min, Schaden nach Quelle, DPS nach Waffe.
- Jede Balance-Änderung bekommt einen Vorher-/Nachher-Bericht.

### 12.2 Automatische Tests

| Test | Prüft |
|---|---|
| `balance.test.js` | Formeln: Ziel-Level, HP-Kurve, Kosten-Tabellen sind monoton und stimmen mit den Tabellen hier überein |
| `levelup.test.js` | Garantien aus 7.2 (10 000 zufällige Läufe, keine Regel verletzt) |
| `chests.test.js` | Drop-Raten über 100 000 Öffnungen im erwarteten Bereich, Pity greift |
| `save.test.js` | Migration v1 → v2, beschädigte Saves werden repariert statt zu crashen |
| Screenshot-Test | Playwright macht Bilder von jedem Screen in Desktop- und Handygröße |

### 12.3 Performance-Budget

| Messwert | Ziel |
|---|---|
| FPS mit 300 Gegnern, Mittelklasse-Handy | ≥ 55 |
| Ladezeit bis Hub | < 2 s |
| Größe `goblin-io.html` | < 4 MB (mit Atlas) |
| Speicher | < 250 MB |

Prüfen mit `npm run perf` (Headless, ohne GPU) und auf echten Geräten mit `goblin-io.html?perf` → „Test 300 Gegner“. Stand 2026-10-13 siehe Phase 8.

---

## 13. Offene Entscheidungen

| Frage | Vorschlag |
|---|---|
| Ausrüstung (Rüstung, Ringe) wie in Survivor.io zusätzlich zu Karten? | Erst nach Phase 8, sonst zu viele Systeme auf einmal |
| Mehrere spielbare Figuren (z. B. Kobold, Troll)? | Entschieden (Fabi, 2026-10-12): ja, als Goblin-Klassen, siehe Phase 9 |
| Online-Bestenliste? | Server gibt es inzwischen (Cloudflare-Worker). Erst lokale Bestzeiten mit der Täglichen Herausforderung (Phase 12), Bestenliste danach optional |
| Speicherort | Ein einzelnes Browser-Save ist leicht verloren (privates Fenster, Cache leeren). Export/Import als Code-Text in den Einstellungen anbieten |
| Sprache | Deutsch bleibt Hauptsprache; Texte trotzdem in `src/data/i18n/de.js` sammeln, dann ist Englisch später leicht |

---

## 14. Anhang: Datenformate und Formeln

### 14.1 Save v2

```json
{
  "version": 2,
  "profile": { "name": "Grubnik", "level": 7, "xp": 340, "title": "Fassbinder", "created": "2026-10-11" },
  "wallet": { "gold": 3420, "gems": 85 },
  "cards": { "dagger": { "level": 4, "count": 12 }, "fireball": { "level": 2, "count": 3 } },
  "talents": { "atk": 6, "hp": 4, "spd": 2 },
  "abilities": { "unlocked": ["rage", "trap", "mech"], "loadout": ["mech", "trap"] },
  "stages": { "1": { "cleared": true, "stars": 3, "best": 251, "nightmare": false } },
  "chests": { "pending": [{ "type": "iron", "from": "boss:2" }], "freeAt": 1791750000000, "pity": { "epic": 3, "legendary": 12 } },
  "cosmetics": { "owned": ["hat_zipfel", "skin_green", "outfit_vest"], "equipped": { "hat": "hat_zipfel", "skin": "skin_green", "outfit": "outfit_vest" } },
  "quests": { "date": "2026-10-11", "list": [{ "id": "kill_toxic", "goal": 300, "progress": 120, "claimed": false }] },
  "achievements": { "boss_ignaz": "gold" },
  "stats": { "runs": 41, "wins": 12, "kills": 30211, "playSeconds": 9520 },
  "settings": { "mute": false, "musicOff": false, "shake": true, "numbers": true, "lefty": false }
}
```

**Migration v1 → v2:** `gold → wallet.gold`, `unlocked/cleared/best → stages`, `shop.* → talents.*` (Stufen ×2, weil Talente halb so stark sind), `mute/musicOff → settings`. Jede abgeschlossene Stage gibt rückwirkend ihre Siegtruhe.

### 14.2 Datenobjekte (Beispiele)

```js
// src/data/enemies.js
export const ENEMIES = {
  necro_caller: {
    school: 'necro', role: 'mage', sprite: 'mage.necro',
    hp: 12, speed: 44, contact: 5, radius: 15, scale: 1, xp: 3,
    ai: ['kite', { keep: 220 }],
    casts: [{ id: 'summon_skeletons', every: [6, 9], windup: 1.0, telegraph: 'runes', count: 3 }],
    drops: { gear: 0.1, coin: 0.05 },
  },
};

// src/data/weapons.js
export const WEAPONS = {
  barrel: {
    name: 'Sprengfass', rarity: 'rare', role: 'area', evolveWith: 'powder', evo: 'grand_fireworks',
    levels: [
      { cd: 3.0, count: 1, dmg: 35, radius: 80 },
      { cd: 2.8, count: 1, dmg: 44, radius: 85 },
      { cd: 2.7, count: 2, dmg: 44, radius: 85 },
      { cd: 2.6, count: 2, dmg: 50, radius: 100 },
      { cd: 2.1, count: 3, dmg: 55, radius: 105 },
    ],
    cardBonus: { perLevel: { dmg: 0.06 }, at5: 'startLevel2', at10: { count: +1 } },
  },
};

// src/data/chests.js
export const CHESTS = {
  gold: { price: { gems: 160 }, gold: [900, 1200], cards: 45,
          odds: { common: 0.62, rare: 0.28, epic: 0.09, legendary: 0.01 },
          guarantee: { rare: 2 }, pity: true },
};

// src/data/bosses.js
export const BOSSES = {
  knochenhand: {
    name: 'Graf Knochenhand', school: 'necro', sprite: 'boss.necro', scale: 2.8,
    hpFactor: 60, enrageAt: 120,
    phases: [
      { at: 1.00, attacks: ['skeleton_wave', 'bone_prison'] },
      { at: 0.66, attacks: ['skeleton_wave', 'bone_prison'], objective: { type: 'destroy', target: 'phylactery', count: 3 } },
      { at: 0.33, attacks: ['raise_ghosts', 'life_drain', 'bone_prison'], speed: 1.3 },
    ],
  },
};
```

### 14.3 Wichtige Formeln

```js
// Ziel-Level nach Zeit (Sekunden) – stückweise linear zwischen den Tabellenpunkten aus 7.3
targetLevel(t) = interp([[0,1],[30,3],[60,6],[120,11],[180,16],[240,20]], t)

// XP pro Level
xpNeed(L) = round(4 + 3*L + 0.3*L*L)            // wie v2, bleibt

// Gegner-HP
enemyHp(base, stage, t) = base * STAGE_HP[stage] * (1 + 0.012*t + 0.000035*t*t)
STAGE_HP = [1, 1.25, 1.5, 1.8, 2.1, 2.4, 2.8, 3.2]

// Boss-HP
bossHp(stage) = expectedDps(stage, 240) * 60 * BOSS_FACTOR[stage]   // BOSS_FACTOR 0.9 … 1.3

// Spielerschaden durch Gegner, gedeckelt
hitDamage(raw, maxHp, kind) = min(raw, maxHp * CAP[kind])   // CAP: contact .08, proj .12, special .25

// Karten-Schadensbonus
cardDmgMult(level) = 1 + 0.06 * (level - 1)

// Konto-XP pro Lauf
accountXp = floor(kills/10 + seconds/4) + (win ? 100 : 0) + (firstClear ? 200 : 0)
accountXpNeed(L) = 200 + 60*L + 8*L*L
```

### 14.4 Generator-Erweiterung (Skizze `mages.py`)

```python
SCHOOLS = {
  "fire":  dict(pal=FIRE,  head=head_fire,  tip=tip_claw_orb,   fx=("fireball", fireball, fire_hit)),
  "frost": dict(pal=FROST, head=head_frost, tip=tip_crystal,    fx=("frostbolt", frost_bolt, frost_hit)),
  "necro": dict(pal=NECRO, head=head_skull_hood, tip=tip_skull, fx=("soulbolt", soul_bolt, soul_hit)),
  "toxic": dict(pal=TOXIC, head=head_plague_mask, tip=tip_flask, fx=("glob", toxic_glob, toxic_hit)),
  # … storm, shadow, earth, light
}
DIRS = ("down", "downleft", "left", "upleft", "up")   # *left wird zu *right gespiegelt
ROLES = {"apprentice": 0.7, "mage": 1.0, "master": 1.4}  # Meister bekommt Zusatzteile (Schulterplatten, größerer Hut)

for school, cfg in SCHOOLS.items():
    for role in ROLES:
        build(cfg, f"{school}_{role}", dirs=DIRS)
```

Neue Kopf-Funktionen folgen dem Muster von `head_fire`/`head_frost` (Parameter `P, d, b, lean`), damit `mage()` unverändert bleibt; nur `BASE_HANDS` braucht Einträge für die Diagonalen.
