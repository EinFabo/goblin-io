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
// pick: gewählte Karte im Koop-Level-Up (game/levelup.js coopLevelTick), -1 = keine
// Testmodus ?coop=local (Phase 14b): zwei Goblins an einer Tastatur. Spieler 1: WASD, Leertaste, Shift links, Q/E, Karten 1–4.
// Spieler 2: Pfeile, Enter Rolle, Shift rechts Sprint, K/L Fähigkeiten, Karten 7–0.
export const localCoop = typeof location !== 'undefined' && new URLSearchParams(location.search).get('coop') === 'local';
const newPress = () => ({ dash: false, ab0: false, ab1: false, skip: false, pick: -1 });
const press = [newPress(), newPress()];
// Rolle/Fähigkeiten nur, wenn die Welt läuft (früher prüfte das der direkte Aufruf); sonst würden sie nach Pause/Animation nachgeholt
export function pressInput(k, who = 0) { if (run && !run.over && (k === 'skip' || (!run.paused && !uiFrozen()))) press[who][k] = true; }
export function clearInput() { for (const p of press) Object.assign(p, newPress()); }
export function pickInput(i, who = 0) { if (run && run.lvl) press[who].pick = i; }
const axis = (neg, pos) => (neg ? -1 : 0) + (pos ? 1 : 0);
function take(who) {
  let mx, my, sprint;
  if (who === 1) { mx = axis(keys.ArrowLeft, keys.ArrowRight); my = axis(keys.ArrowUp, keys.ArrowDown); sprint = !!keys.ShiftRight; }
  else {
    const arrows = !(localCoop && run && run.coop);   // allein steuern auch die Pfeile und beide Shift-Tasten den Goblin
    mx = axis(keys.KeyA || (arrows && keys.ArrowLeft), keys.KeyD || (arrows && keys.ArrowRight));
    my = axis(keys.KeyW || (arrows && keys.ArrowUp), keys.KeyS || (arrows && keys.ArrowDown));
    if (joy.id !== null) { const jx = (joy.x - joy.ox) / 55, jy = (joy.y - joy.oy) / 55; if (Math.hypot(jx, jy) > .15) { mx += jx; my += jy; } }
    sprint = !!(keys.ShiftLeft || (arrows && keys.ShiftRight) || sprintHeld);
  }
  const inp = { mx, my, sprint, ...press[who] };
  Object.assign(press[who], newPress());
  return inp;
}
export const takeInput = () => take(0);
// Ein Datensatz je Goblin, den dieser Rechner steuert (allein einer, im Testmodus zwei)
export const takeInputs = () => (localCoop && run && run.coop ? [take(0), take(1)] : [take(0)]);
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  audioInit();
  if (!run || run.over) return;
  // Einstellungen/Hilfe über der Pause: Esc schließt nur das obere Fenster
  // Entwicklungs-Baum über Level-Up/Pause: Esc schließt nur ihn, sonst keine Tasten
  if (!$('#evoTree').hidden) { if (e.code === 'Escape') closeTree(); return; }
  if (!$('#options').hidden || !$('#howto').hidden) { if (e.code === 'Escape') $(!$('#howto').hidden ? '#howto' : '#options').hidden = true; return; }
  if (run.cut && !run.paused && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); pressInput('skip'); return; }
  if (localCoop && run.coop) {
    if (e.code === 'Enter') { e.preventDefault(); pressInput('dash', 1); }
    if (e.code === 'KeyK') pressInput('ab0', 1);
    if (e.code === 'KeyL') pressInput('ab1', 1);
    // Karten für Spieler 2 über die zweite Reihe (ui/levelup.js coopPick markiert sie dort)
    const k2 = ['Digit7', 'Digit8', 'Digit9', 'Digit0'].indexOf(e.code), c2 = document.getElementById('cards2');
    if (k2 >= 0 && c2 && !c2.hidden && c2.children[k2]) c2.children[k2].click();
  }
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
