import { audioInit } from './audio.js';
import { $ } from './util.js';
import { doDash, useAbility } from '../game/abilities.js';
import { skipCut } from '../game/boss.js';
import { run, uiFrozen } from '../game/state.js';
import { cv } from '../render/canvas.js';
import { openPause, resume } from '../ui/pause.js';

// ---------- Eingabe ----------
export const keys = {};
export const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
export let sprintHeld = false;
export function setSprintHeld(v) { sprintHeld = v; }
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  audioInit();
  if (!run || run.over) return;
  // Einstellungen/Hilfe über der Pause: Esc schließt nur das obere Fenster
  if (!$('#options').hidden || !$('#howto').hidden) { if (e.code === 'Escape') $(!$('#howto').hidden ? '#howto' : '#options').hidden = true; return; }
  if (run.cut && !run.paused && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); skipCut(); return; }
  // Steht die Welt für eine Animation, lösen Rolle und Fähigkeiten nicht aus
  if (e.code === 'Space') { e.preventDefault(); if (!uiFrozen()) doDash(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
  if (e.code === 'KeyQ' && !uiFrozen()) useAbility(0);
  if ((e.code === 'KeyE' || e.code === 'KeyF') && !uiFrozen()) useAbility(1);
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!$('#pause').hidden) resume(); else if (!run.paused) openPause(); }
  if (!$('#levelup').hidden && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) { const b = $('#cards').children[+e.code.slice(5) - 1]; if (b) b.click(); }
  if (!$('#levelup').hidden && e.code === 'KeyR') $('#rerollBtn').click();
  if (!$('#levelup').hidden && e.code === 'KeyB') $('#banBtn').click();
  if (!$('#levelup').hidden && e.code === 'KeyL') $('#lockBtn').click();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (run && run.cut) skipCut();
  if (joy.id !== null) return;
  joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
export const joyEnd = e => { if (e.pointerId === joy.id) joy.id = null; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.id = null; setSprintHeld(false); if (run && !run.paused && !run.over) openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && run && !run.paused && !run.over) openPause(); });
