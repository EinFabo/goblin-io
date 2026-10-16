import { sfx } from '../core/audio.js';
import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { save } from '../core/save.js';
import { $, restart } from '../core/util.js';
import { CONTINUE_GEMS, doContinue, endRun, setContinueHook } from '../game/run.js';
import { run } from '../game/state.js';

// ---------- Weitermachen nach dem Tod (Wunsch Fabi 2026-10-16) ----------
// Fenster mit Preis in Juwelen; Logik in game/run.js (offerContinue/doContinue).
const ov = () => $('#cont');
setContinueHook(cost => {
  Music.stop(); setSprintHeld(false); sfx.hurt();
  const boss = !!(run.boss && !run.boss.dead), left = CONTINUE_GEMS.length - (run.cont || 0), ok = save.wallet.gems >= cost;
  $('#contTxt').innerHTML = boss ? 'Noch einmal gegen den Boss – der Kampf beginnt von vorn, mit vollem Leben.' : 'Weiter an Ort und Stelle, mit vollem Leben und kurz unverwundbar.';
  const b = $('#contYes');
  b.innerHTML = `Weitermachen · <span class="gem"></span>${cost}`;
  if (ok) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true');
  $('#contNote').textContent = (ok ? `Du hast ${save.wallet.gems} Juwelen. ` : `Zu wenig Juwelen (du hast ${save.wallet.gems}). `) +
    `Noch ${left}× in diesem Lauf. Mit Weitermachen zählen nur der erste Hut und keine Bestzeit.`;
  ov().hidden = false;
  b.focus({ preventScroll: true });
});
function yes() {
  if (ov().hidden) return;
  if (!doContinue()) { sfx.buzz(); restart($('#contYes'), 'nope'); return; }
  ov().hidden = true; sfx.chest(); Music.start();
}
function no() { if (ov().hidden) return; ov().hidden = true; endRun(false); }
$('#contYes').addEventListener('click', yes);
$('#contNo').addEventListener('click', no);
window.addEventListener('keydown', e => {
  if (ov().hidden) return;
  if (e.code === 'Enter') { e.preventDefault(); yes(); } else if (e.code === 'Escape') { e.preventDefault(); no(); }
});
