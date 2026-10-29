import { lostFocus } from '../core/input.js';
import { setAway } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';

// ---------- PC, exe und APK (Wunsch Fabi 2026-10-16: „Exe und APK ausbauen“) ----------
// body.pc: Maus und Tastatur. Statt der Handy-Knöpfe eine kleine Leiste unten (zeigt Ladung und Tasten),
// kein Maus-Joystick. Wer am PC wirklich tippt (Touchscreen), bekommt die Handy-Knöpfe zurück.
// Vollbild: F11 oder Alt+Enter, Schalter in den Einstellungen; die exe stellt es beim Start wieder her.
const T = window.__TAURI__;
const android = /Android/i.test(navigator.userAgent);
const desktopApp = !!(T && T.window && !android);
const appWin = () => T.window.getCurrentWindow();
const finePointer = () => !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

function setPc(on) {
  if (document.body.classList.contains('pc') === on) return;
  document.body.classList.toggle('pc', on);
  window.dispatchEvent(new Event('resize'));   // automatische Oberflächengröße hängt am PC-Modus (ui/settings.js uiZoom)
}
document.body.classList.toggle('appwin', desktopApp);   // Fenstergröße gibt es nur in der exe
// Fenstergröße der exe (Einstellung „Fenstergröße“): nur im Fenstermodus, danach mittig
export async function setWindowSize(sz) {
  if (!desktopApp) return;
  const [w, h] = sz.split('x').map(Number);
  try { if (await appWin().isFullscreen()) return; await appWin().setSize(new T.window.LogicalSize(w, h)); await appWin().center(); } catch (_) { /* ältere Fassung ohne Rechte */ }
}
setPc(!android && finePointer());
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && document.body.classList.contains('pc')) setPc(false); }, true);

// Vollbild-Zustand: exe über das Tauri-Fenster, Browser über die Fullscreen-API
export const canFullscreen = () => desktopApp || (!android && !!document.documentElement.requestFullscreen);
async function isFull() {
  if (desktopApp) { try { return await appWin().isFullscreen(); } catch (_) { return false; } }
  return !!document.fullscreenElement;
}
async function setFull(on) {
  try {
    if (desktopApp) await appWin().setFullscreen(on);
    else if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch (_) { /* Browser lehnt ohne Klick ab oder kein Vollbild möglich */ }
  syncFull();
}
async function syncFull() {
  const on = await isFull();
  // nur in der exe merken: der Browser darf beim Start nicht von selbst ins Vollbild
  if (desktopApp && save.settings.full !== on) { save.settings.full = on; persist(); }
  $('#fullSw').setAttribute('aria-checked', String(on));
}
export async function toggleFullscreen() { await setFull(!(await isFull())); }

$('#fullSw').addEventListener('click', toggleFullscreen);
window.addEventListener('keydown', e => {
  if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) { e.preventDefault(); if (canFullscreen()) toggleFullscreen(); }
});
document.addEventListener('fullscreenchange', syncFull);
document.body.classList.toggle('nofull', !canFullscreen());

// Beim Start (nach loadSave): Vollbild der exe wiederherstellen, Fokus-Verlust des Fensters pausiert den Lauf
export function startPlatform() {
  if (desktopApp) {
    if (save.settings.full) setFull(true); else syncFull();
    try { appWin().onFocusChanged(({ payload }) => { setAway(!payload); if (!payload) lostFocus(); }).catch(() => {}); } catch (_) { /* ältere Tauri-Version: blur reicht */ }
  } else syncFull();
}
