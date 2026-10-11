# Magier-Sprites (passend zum Goblin) – Scratch-fertig

Alle SVGs: `width="96" height="96" viewBox="0 0 96 96"` (Projektile 48x48).
Größe und Leinwand passen jetzt zusammen und starten bei 0,0. Dann setzt Scratch den
Kostüm-Mittelpunkt beim Hochladen richtig, und auf der Bühne wird nichts mehr abgeschnitten.

**Wichtig:** Kostüme, die schon in deinem Projekt sind, behalten ihren alten (falschen) Mittelpunkt.
Die alten Kostüme löschen und die neuen Dateien frisch hochladen.

Im Ordner `goblin/` liegt dein Goblin in derselben korrigierten Form (Grafik unverändert).
Wenn dein Player-Goblin schon passt, brauchst du den nicht.

| Ordner        | Zauber    | idle | walk | cast |
|---------------|-----------|------|------|------|
| feuermagier/  | Feuerball | 4    | 6    | 8    |
| frostmagier/  | Eisspeer  | 4    | 6    | 8    |

Namen: **`f_` = Feuermagier, `e_` = Eis-/Frostmagier**, dann `<anim>_<richtung>_<frame>.svg`,
z. B. `f_cast_left_6`, `e_walk_down_3`, `f_fireball_2`, `e_frostbolt_hit_4`. `right` ist das gespiegelte `left`.
So kannst du beide Magier sogar in **einen** Enemy-Sprite laden, ohne dass sich Kostümnamen doppeln.

## Cast-Animation
1–4 Aufladen · **5–6 Abschuss** · 7–8 Ausklingen. **Projektil bei Frame 6 erzeugen.**

Wo das Projektil startet (Stabspitze), relativ zur Magier-Position, bei Größe 100:

| Richtung | x     | y     |
|----------|-------|-------|
| down     | -6.7  | -21.1 |
| up       | 25.4  | 28.3  |
| left     | -33.9 | 1.6   |
| right    | 33.9  | 1.6   |

Bei anderer Größe mal (Größe / 100) rechnen. Steht auch in `info.json`.

## In Scratch: Magier dreht sich zum Spieler

Magier-Sprite: **Drehtyp „nicht drehen“** (`setze Drehtyp auf [nicht drehen]`), sonst kippt die Figur.
Die Richtung benutzt du nur, um das passende Kostüm auszuwählen:

```
setze Drehtyp auf [nicht drehen]
drehe dich zu [Player]
falls <(Richtung) > -45> und <(Richtung) < 45>   → setze [dir] auf [up]
sonst falls <(Richtung) > 45> und <(Richtung) < 135> → setze [dir] auf [right]
sonst falls <(Richtung) < -45> und <(Richtung) > -135> → setze [dir] auf [left]
sonst → setze [dir] auf [down]
```
(Scratch-Richtungen: 0 = oben, 90 = rechts, -90 = links, 180 = unten)

Laufen:  `wechsle zu Kostüm (verbinde [f_walk_] (verbinde (dir) (verbinde [_] (frame))))`  (Frost: `e_walk_`)
Tipp: Variable `typ` = `f_` oder `e_` und `(verbinde (typ) [walk_] ...)`, dann reicht ein Skript für beide Magier.
mit `frame` von 1 bis 6, ca. 0.1 s warten pro Frame.

Zaubern: `dir` am Anfang **einmal festlegen** und während der 8 Frames nicht ändern.
Bei Frame 6 Projektil-Klon erzeugen.

## Projektil (`fx/`)
- `f_fireball_1..4` / `e_frostbolt_1..4`: Flug-Loop. Zeigt nach rechts = Scratch-Richtung 90,
  also einfach **Drehtyp „rundherum“** und `drehe dich zu [Player]`, dann `gehe (5) er Schritt` im Loop.
- `*_hit_1..5`: Einschlag, einmal abspielen, dann `lösche diesen Klon`.
- Gleicher Maßstab wie die Figuren, bei beiden Sprites dieselbe Größe einstellen.

Projektil-Klon starten:
```
gehe zu x: ((x-Position von Enemy) + 33.9)  y: ((y-Position von Enemy) + 1.6)   // Werte je nach dir
drehe dich zu [Player]
```

## Andere Engines
Funktioniert genauso: SVG 96x96 bzw. 48x48, beliebig skalierbar, Mittelpunkt = Bildmitte.
`_generator/mages.py` erzeugt alles neu (`python3 mages.py ausgabeordner`).
