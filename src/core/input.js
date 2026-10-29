import { audioInit } from './audio.js';
import { $ } from './util.js';
import { dev, isKey } from './device.js';
import { pad } from './gamepad.js';
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
// Tasten von Spieler 2 im Testmodus ?coop=local: dort zählen sie nicht für Spieler 1
const P2_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftRight', 'Enter', 'KeyK', 'KeyL', 'Digit7', 'Digit8', 'Digit9', 'Digit0']);
const own = code => !(localCoop && run && run.coop && P2_KEYS.has(code));
// Aktion gedrückt? (Tastenbelegung, core/device.js)
const held = a => dev.keys[a].some(c => c && keys[c] && own(c));
export const JOY_R = 55;   // Joystick-Radius in px für volles Tempo (geteilt durch die Empfindlichkeit)
function take(who) {
  let mx, my, sprint;
  if (who === 1) { mx = axis(keys.ArrowLeft, keys.ArrowRight); my = axis(keys.ArrowUp, keys.ArrowDown); sprint = !!keys.ShiftRight; }
  else {
    mx = axis(held('left'), held('right')); my = axis(held('up'), held('down'));
    if (joy.id !== null) { const r = JOY_R / dev.joySens, jx = (joy.x - joy.ox) / r, jy = (joy.y - joy.oy) / r; if (Math.hypot(jx, jy) > .15) { mx += jx; my += jy; } }
    if (pad.on) { mx += pad.mx; my += pad.my; }   // Controller (core/gamepad.js)
    sprint = held('sprint') || sprintHeld || pad.sprint;
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
  if (run.cut && !run.paused && (isKey('dash', e.code) || e.code === 'Enter')) { e.preventDefault(); pressInput('skip'); return; }
  if (localCoop && run.coop) {
    if (e.code === 'Enter') { e.preventDefault(); pressInput('dash', 1); }
    if (e.code === 'KeyK') pressInput('ab0', 1);
    if (e.code === 'KeyL') pressInput('ab1', 1);
    // Karten für Spieler 2 über die zweite Reihe (ui/levelup.js coopPick markiert sie dort)
    const k2 = ['Digit7', 'Digit8', 'Digit9', 'Digit0'].indexOf(e.code), c2 = document.getElementById('cards2');
    if (k2 >= 0 && c2 && !c2.hidden && c2.children[k2]) c2.children[k2].click();
  }
  // Tastenbelegung (Einstellungen → Steuerung); Esc pausiert immer
  const k = own(e.code) ? e.code : null;
  if (isKey('dash', k)) { e.preventDefault(); pressInput('dash'); }
  if (isKey('sprint', k) || e.code === 'Space' || e.code === 'Tab') e.preventDefault();   // Seite nicht scrollen / Fokus nicht wechseln
  if (isKey('ab0', k)) pressInput('ab0');
  if (isKey('ab1', k)) pressInput('ab1');
  if (e.code === 'Escape' || isKey('pause', k)) { if (!$('#pause').hidden) resume(); else if (!run.paused) openPause(); }
  if (!$('#levelup').hidden && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) { const b = $('#cards').children[+e.code.slice(5) - 1]; if (b) b.click(); }
  if (!$('#levelup').hidden && e.code === 'KeyR') $('#rerollBtn').click();
  if (!$('#levelup').hidden && e.code === 'KeyB') $('#banBtn').click();
  if (!$('#levelup').hidden && e.code === 'KeyL' && own(e.code)) $('#lockBtn').click();   // (im Testmodus ist L die Fähigkeit von Spieler 2)
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (run && run.cut) pressInput('skip');
  if (joy.id !== null) return;
  if (e.pointerType === 'mouse' && document.body.classList.contains('pc')) return;   // am PC kein Maus-Joystick (WASD)
  // Fester Joystick (Einstellung): Mitte bleibt links unten (bzw. rechts für Linkshänder), nur Berührungen auf dieser Hälfte
  if (dev.joy === 'fixed') {
    const c = joyHome(), lefty = document.body.classList.contains('lefty');
    if (lefty ? e.clientX < innerWidth / 2 : e.clientX > innerWidth / 2) return;
    joy.id = e.pointerId; joy.ox = c.x; joy.oy = c.y; joy.x = e.clientX; joy.y = e.clientY;
  } else { joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
// Mitte des festen Joysticks (Bildschirm-Pixel)
export const joyHome = () => (document.body.classList.contains('lefty') ? { x: innerWidth - 120, y: innerHeight - 115 } : { x: 120, y: innerHeight - 115 });
export const joyEnd = e => { if (e.pointerId === joy.id) joy.id = null; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
// Fenster verliert den Fokus (Browser-Tab, exe minimiert oder anderes Fenster): Tasten loslassen, Lauf pausieren.
// Die exe meldet das zusätzlich über Tauri (ui/platform.js), weil WebView2 blur nicht immer schickt.
export function lostFocus() { for (const k in keys) keys[k] = false; joy.id = null; setSprintHeld(false); clearInput(); if (run && !run.paused && !run.over) openPause(); }
window.addEventListener('blur', lostFocus);
document.addEventListener('visibilitychange', () => { if (document.hidden && run && !run.paused && !run.over) openPause(); });
