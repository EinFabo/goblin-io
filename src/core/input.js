import { audioInit } from './audio.js';
import { $ } from './util.js';
import { run, uiFrozen } from '../game/state.js';
import { cv } from '../render/canvas.js';
import { closeTree } from '../ui/evotree.js';
import { openPause, resume } from '../ui/pause.js';

// ---------- Eingabe ----------
export const keys = {};
export const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
export let sprintHeld = false;
export function setSprintHeld(v) { sprintHeld = v; }
// Eingabe je Tick (Phase 14a, Grundlage für Koop im Gleichschritt): Tasten und Touch schreiben nur hierher,
// die Sim holt sich einmal je Schritt einen Datensatz (game/run.js update → takeInput).
// Knöpfe zählen als „gedrückt seit dem letzten Tick“, Bewegung und Sprint als aktueller Zustand.
const press = { dash: false, ab0: false, ab1: false, skip: false };
// Rolle/Fähigkeiten nur, wenn die Welt läuft (früher prüfte das der direkte Aufruf); sonst würden sie nach Pause/Animation nachgeholt
export function pressInput(k) { if (run && !run.over && (k === 'skip' || (!run.paused && !uiFrozen()))) press[k] = true; }
export function clearInput() { for (const k in press) press[k] = false; }
export function takeInput() {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (joy.id !== null) { const jx = (joy.x - joy.ox) / 55, jy = (joy.y - joy.oy) / 55; if (Math.hypot(jx, jy) > .15) { mx += jx; my += jy; } }
  const inp = { mx, my, sprint: !!(keys.ShiftLeft || keys.ShiftRight || sprintHeld), ...press };
  clearInput();
  return inp;
}
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  audioInit();
  if (!run || run.over) return;
  // Einstellungen/Hilfe über der Pause: Esc schließt nur das obere Fenster
  // Entwicklungs-Baum über Level-Up/Pause: Esc schließt nur ihn, sonst keine Tasten
  if (!$('#evoTree').hidden) { if (e.code === 'Escape') closeTree(); return; }
  if (!$('#options').hidden || !$('#howto').hidden) { if (e.code === 'Escape') $(!$('#howto').hidden ? '#howto' : '#options').hidden = true; return; }
  if (run.cut && !run.paused && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); pressInput('skip'); return; }
  if (e.code === 'Space') { e.preventDefault(); pressInput('dash'); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
  if (e.code === 'KeyQ') pressInput('ab0');
  if (e.code === 'KeyE' || e.code === 'KeyF') pressInput('ab1');
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!$('#pause').hidden) resume(); else if (!run.paused) openPause(); }
  if (!$('#levelup').hidden && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) { const b = $('#cards').children[+e.code.slice(5) - 1]; if (b) b.click(); }
  if (!$('#levelup').hidden && e.code === 'KeyR') $('#rerollBtn').click();
  if (!$('#levelup').hidden && e.code === 'KeyB') $('#banBtn').click();
  if (!$('#levelup').hidden && e.code === 'KeyL') $('#lockBtn').click();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (run && run.cut) pressInput('skip');
  if (joy.id !== null) return;
  if (e.pointerType === 'mouse' && document.body.classList.contains('pc')) return;   // am PC kein Maus-Joystick (WASD)
  joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
export const joyEnd = e => { if (e.pointerId === joy.id) joy.id = null; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
// Fenster verliert den Fokus (Browser-Tab, exe minimiert oder anderes Fenster): Tasten loslassen, Lauf pausieren.
// Die exe meldet das zusätzlich über Tauri (ui/platform.js), weil WebView2 blur nicht immer schickt.
export function lostFocus() { for (const k in keys) keys[k] = false; joy.id = null; setSprintHeld(false); clearInput(); if (run && !run.paused && !run.over) openPause(); }
window.addEventListener('blur', lostFocus);
document.addEventListener('visibilitychange', () => { if (document.hidden && run && !run.paused && !run.over) openPause(); });
