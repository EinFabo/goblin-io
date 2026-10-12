import { on } from '../core/events.js';
import { Music } from '../core/music.js';
import { defineScene, go } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { newRun, update } from '../game/run.js';
import { run } from '../game/state.js';
import { renderRun } from '../render/draw-world.js';
import { banner, refreshSlots, updHud } from '../ui/hud.js';
import { openLevelUp } from '../ui/levelup.js';
import { hideOverlays, showScreen } from '../ui/menus.js';

let offs = [];

defineScene('run', {
  enter({ si, seed }) {
    newRun(si, seed);
    showScreen(null); hideOverlays();
    $('#hud').hidden = false; $('#ctrl').hidden = false; $('#bossBar').hidden = true; $('#hint').hidden = true;
    $('#stageTxt').textContent = run.st.name;
    refreshSlots();
    banner(run.st.name, '');
    Music.boss = false; Music.start();
    offs = [
      on('runEnd', r => go('results', r)),
      on('bossSpawn', () => { Music.boss = true; }),
      on('bossDown', () => { Music.boss = false; }),
      on('audioReady', () => { if (!run.paused) Music.start(); }),
    ];
  },
  exit() { for (const f of offs) f(); offs = []; },
  update(step) {
    if (run.paused) return;
    // Hitstop: Spiel steht kurz still (Elite-Kill, Boss besiegt)
    if (run.hitstop > 0) { run.hitstop -= step; return; }
    // Nach einem Level-Up kurz Zeitlupe, dann die Karten
    if (run.lvDelay > 0) {
      run.lvDelay -= step; update(step * .25);
      if (run.lvDelay <= 0 && !run.over) openLevelUp(run.lvKind === 'chest');
    } else if (run.slowT > 0) { run.slowT -= step; update(step * .3); }
    else update(step);
  },
  render(now, alpha, dt) { renderRun(now, alpha); updHud(dt); },
});
