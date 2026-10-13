import { sfx } from '../core/audio.js';
import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { defineScene } from '../core/scenes.js';
import { P } from '../game/state.js';
import { renderRun } from '../render/draw-world.js';
import { pauseBackground } from '../render/sprites.js';
import { updHud } from '../ui/hud.js';
import { hideResults, showResults } from '../ui/results.js';

// Lauf ist vorbei: Welt bleibt eingefroren im Hintergrund, darüber das Ergebnis
defineScene('results', {
  enter(r) {
    pauseBackground(true);   // Hut-Fall und Hochzählen nicht durch Hintergrund-Laden stören
    Music.stop(); setSprintHeld(false);
    if (r.win) sfx.chest(); else sfx.death();
    Music.jingle(r.win);
    showResults(r);
  },
  exit() { hideResults(); },
  render(now, alpha, dt) { P.endAnim += dt; renderRun(now, 1); updHud(dt); },
});
