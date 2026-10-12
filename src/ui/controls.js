import { audioInit } from '../core/audio.js';
import { setSprintHeld } from '../core/input.js';
import { $ } from '../core/util.js';
import { doDash, useAbility } from '../game/abilities.js';

// ---------- Fähigkeiten-Knöpfe (Handy) ----------
for (const [id, fn] of [['#dashBtn', doDash], ['#ab0Btn', () => useAbility(0)], ['#ab1Btn', () => useAbility(1)]]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); fn(); });
}
{
  const sb = $('#sprintBtn');
  sb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); setSprintHeld(true); try { sb.setPointerCapture(e.pointerId); } catch (_) {} });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) sb.addEventListener(ev, () => { setSprintHeld(false); });
}
document.querySelectorAll('#ctrl button').forEach(b => b.addEventListener('contextmenu', e => e.preventDefault()));
