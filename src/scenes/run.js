import { on } from '../core/events.js';
import { Music } from '../core/music.js';
import { defineScene, go } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { levelLabel } from '../data/levels.js';
import { MUTATORS, mutNames } from '../data/mutators.js';
import { hint, lvToBonus, newRun, update } from '../game/run.js';
import { run } from '../game/state.js';
import { renderRun } from '../render/draw-world.js';
import { pauseBackground } from '../render/sprites.js';
import { banner, refreshSlots, setupAbilButtons, updHud } from '../ui/hud.js';
import { openLevelUp } from '../ui/levelup.js';
import '../ui/run-chest.js';   // Truhe im Lauf: hängt sich an das Ereignis autoChest
import { hideOverlays, showScreen } from '../ui/menus.js';

let offs = [];
// Boss-Auftritt aufräumen (falls der Lauf mitten in der Szene verlassen wird)
function endCine() { document.body.classList.remove('cine'); $('#bossCard').hidden = true; }

defineScene('run', {
  // mut/abil/mode (Phase 12): Mutatoren, feste Fähigkeiten und Art des Laufs (Herausforderung, Kopfgeld)
  enter({ si, li = 0, seed, nm = false, mut, abil, mode }) {
    pauseBackground(true);   // im Lauf kein Hintergrund-Laden
    newRun(si, seed, li, nm, { mut, abil, mode });
    showScreen(null); hideOverlays();
    $('#hud').hidden = false; $('#ctrl').hidden = false; $('#bossBar').hidden = true; $('#hint').hidden = true; endCine();
    $('#stageTxt').textContent = (run.nm ? `☠${run.nm} ` : '') + (run.st.endless ? run.st.name : `${levelLabel(si, run.li)} ${run.st.lvName}`);
    refreshSlots(); setupAbilButtons();
    banner((run.mode === 'challenge' ? 'Herausforderung · ' : '') + (run.nm ? `Albtraum ${run.nm} · ` : '') + (run.st.endless ? run.st.name : `${levelLabel(si, run.li)} · ${run.st.lvName}`), run.nm || run.mut.length ? 'danger' : '');
    if (run.mut.length) { $('#stageTxt').textContent += ' · ' + mutNames(run.mut); hint('<b>Mutatoren</b> ' + run.mut.map(k => `${MUTATORS[k].name}: ${MUTATORS[k].desc}`).join(' · ')); }
    Music.boss = false; Music.theme = null; Music.hold = false; Music.world = run.st.music || null; Music.part = Music.cur = 0; Music.step = 0; Music.start();
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
    // Musik-Teil (core/music.js): ruhig am Anfang, treibend ab 45 s, eigener Teil solange ein Mini-Boss lebt
    Music.part = run.mini && !run.mini.dead ? 2 : run.time >= 45 ? 1 : 0;
    // Mega-Entwicklung: die Welt steht, solange die Verschmelz-Animation läuft (ui/mega-fx.js)
    if (run.megaFreeze > performance.now()) return;
    // Hitstop: Spiel steht kurz still (Elite-Kill, Boss besiegt)
    if (run.hitstop > 0) { run.hitstop -= step; return; }
    // Boss-Szene läuft in Echtzeit; ein offenes Level-Up und Zeitlupe warten, bis sie vorbei ist
    if (run.cut) { update(step); return; }
    // Nach einem Level-Up kurz Zeitlupe, dann die Karten
    if (run.lvDelay > 0) {
      // Im Schritt, in dem die Zeitlupe endet, kein update(): sonst startet es schon das nächste
      // anstehende Level-Up (lvDelay wieder > 0) und dieses Kartenfenster ginge verloren
      run.lvDelay -= step;
      if (run.lvDelay > 0) update(step * .25);
      // Level zu Ende, während die Zeitlupe lief: kein Kartenfenster mehr, das Level-Up wird Bonus-Level
      else if (!run.over) { if (run.clearT > 0) lvToBonus(); else { run.lvOpen = false; openLevelUp(run.lvKind === 'chest'); } }
    } else if (run.slowT > 0) { run.slowT -= step; update(step * .3); }
    else update(step);
  },
  render(now, alpha, dt) { renderRun(now, alpha); updHud(dt); },
});
