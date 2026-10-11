// Fester Zeitschritt: Spiellogik immer mit 60 Hz, Rendern so oft der Bildschirm will.
// alpha (0..1) sagt dem Renderer, wie weit wir zwischen zwei Schritten sind.
import { scene } from './scenes.js';

export const STEP = 1 / 60;
const MAX_STEPS = 8;
let acc = 0, last = 0;

function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (scene && scene.update) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) { scene.update(STEP); acc -= STEP; n++; }
    if (n === MAX_STEPS) acc = 0; // zu langsam: lieber Zeit verlieren als hinterherlaufen
  } else acc = 0;
  if (scene && scene.render) scene.render(now, acc / STEP, dt);
  requestAnimationFrame(frame);
}
export function startLoop() { last = performance.now(); requestAnimationFrame(frame); }
