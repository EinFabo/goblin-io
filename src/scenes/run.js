import { on } from '../core/events.js';
import { Music } from '../core/music.js';
import { defineScene, go } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { levelLabel } from '../data/levels.js';
import { lvToBonus, newRun, update } from '../game/run.js';
import { run } from '../game/state.js';
import { renderRun } from '../render/draw-world.js';
import { banner, refreshSlots, setupAbilButtons, updHud } from '../ui/hud.js';
import { openLevelUp } from '../ui/levelup.js';
import { hideOverlays, showScreen } from '../ui/menus.js';

let offs = [];
// Boss-Auftritt aufräumen (falls der Lauf mitten in der Szene verlassen wird)
function endCine() { document.body.classList.remove('cine'); $('#bossCard').hidden = true; }

defineScene('run', {
  enter({ si, li = 0, seed, nm = false }) {
    newRun(si, seed, li, nm);
    showScreen(null); hideOverlays();
    $('#hud').hidden = false; $('#ctrl').hidden = false; $('#bossBar').hidden = true; $('#hint').hidden = true; endCine();
    $('#stageTxt').textContent = (run.nm ? '☠ ' : '') + (run.st.endless ? run.st.name : `${levelLabel(si, run.li)} ${run.st.lvName}`);
    refreshSlots(); setupAbilButtons();
    banner((run.nm ? 'Albtraum · ' : '') + (run.st.endless ? run.st.name : `${levelLabel(si, run.li)} · ${run.st.lvName}`), run.nm ? 'danger' : '');
    Music.boss = false; Music.theme = null; Music.hold = false; Music.world = run.st.music || null; Music.start();
    offs = [
      on('runEnd', r => go('results', r)),
      // Boss-Auftritt: Musik schweigt für das Intro, danach das Thema des Bosses von vorn
      on('bossIntro', b => { Music.hold = true; Music.bossIntro(b.id); }),
      on('bossSpawn', b => { Music.hold = false; Music.boss = true; Music.theme = b.id; Music.step = 0; }),
      on('bossDown', () => { Music.boss = false; Music.theme = null; }),
      on('audioReady', () => { if (!run.paused) Music.start(); }),
    ];
  },
  exit() { for (const f of offs) f(); offs = []; endCine(); Music.hold = false; },
  update(step) {
    if (run.paused) return;
    // Hitstop: Spiel steht kurz still (Elite-Kill, Boss besiegt)
    if (run.hitstop > 0) { run.hitstop -= step; return; }
    // Boss-Szene läuft in Echtzeit; ein offenes Level-Up und Zeitlupe warten, bis sie vorbei ist
    if (run.cut) { update(step); return; }
    // Nach einem Level-Up kurz Zeitlupe, dann die Karten
    if (run.lvDelay > 0) {
      run.lvDelay -= step; update(step * .25);
      // Level zu Ende, während die Zeitlupe lief: kein Kartenfenster mehr, das Level-Up wird Bonus-Level
      if (run.lvDelay <= 0 && !run.over) { if (run.clearT > 0) lvToBonus(); else { run.lvOpen = false; openLevelUp(run.lvKind === 'chest'); } }
    } else if (run.slowT > 0) { run.slowT -= step; update(step * .3); }
    else update(step);
  },
  render(now, alpha, dt) { renderRun(now, alpha); updHud(dt); },
});
