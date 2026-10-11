import { sfx } from '../core/audio.js';
import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { defineScene } from '../core/scenes.js';
import { renderRun } from '../render/draw-world.js';
import { updHud } from '../ui/hud.js';
import { hideResults, showResults } from '../ui/results.js';

// Lauf ist vorbei: Welt bleibt eingefroren im Hintergrund, darüber das Ergebnis
defineScene('results', {
  enter(r) {
    Music.stop(); setSprintHeld(false);
    if (r.win) sfx.chest(); else sfx.death();
    showResults(r);
  },
  exit() { hideResults(); },
  render(now, alpha, dt) { renderRun(now, 1); updHud(dt); },
});
