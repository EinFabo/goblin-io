// Fester Zeitschritt: Spiellogik immer mit 60 Hz, Rendern so oft der Bildschirm will.
// alpha (0..1) sagt dem Renderer, wie weit wir zwischen zwei Schritten sind.
import { scene } from './scenes.js';

export const STEP = 1 / 60;
const MAX_STEPS = 8;
let acc = 0, last = 0;
// Zeiten des letzten Frames für den Mess-Modus (?perf, src/perf.js)
export const loopStats = { upd: 0, ren: 0, steps: 0 };

function frame(now) {
  // Zuerst anmelden: ein Fehler in einer Szene kostet so nur einen Frame, nicht das ganze Spiel
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  const t0 = performance.now();
  let n = 0;
  if (scene && scene.update) {
    acc += dt;
    // scene bei jedem Schritt neu prüfen: ein Schritt kann die Szene wechseln (Tod → results ohne update)
    while (acc >= STEP && n < MAX_STEPS && scene.update) { scene.update(STEP); acc -= STEP; n++; }
    if (n === MAX_STEPS) acc = 0; // zu langsam: lieber Zeit verlieren als hinterherlaufen
  } else acc = 0;
  const t1 = performance.now();
  if (scene && scene.render) scene.render(now, acc / STEP, dt);
  loopStats.upd = t1 - t0; loopStats.ren = performance.now() - t1; loopStats.steps = n;
}
export function startLoop() { last = performance.now(); requestAnimationFrame(frame); }
