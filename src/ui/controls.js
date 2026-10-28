import { audioInit } from '../core/audio.js';
import { pressInput, setSprintHeld } from '../core/input.js';
import { $ } from '../core/util.js';

// ---------- Fähigkeiten-Knöpfe (Handy) ----------
for (const [id, k] of [['#dashBtn', 'dash'], ['#ab0Btn', 'ab0'], ['#ab1Btn', 'ab1']]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); pressInput(k); });
}
{
  const sb = $('#sprintBtn');
  sb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); setSprintHeld(true); try { sb.setPointerCapture(e.pointerId); } catch (_) {} });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) sb.addEventListener(ev, () => { setSprintHeld(false); });
}
document.querySelectorAll('#ctrl button').forEach(b => b.addEventListener('contextmenu', e => e.preventDefault()));
