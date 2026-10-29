// Controller (PLAN.md Phase 15, Wunsch Fabi): Xbox-/PlayStation-Controller über die Gamepad-API (Standard-Belegung),
// am PC und am Handy. Laufen und Sprint liest core/input.js direkt (pad.mx/my/sprint); Knöpfe werden als virtuelle
// Tastendrücke weitergegeben, damit Lauf, Pause, Ergebnis, Karte und Fenster dieselben Wege wie die Tastatur nehmen.
//   Lauf: Stick/Steuerkreuz laufen · A Rolle · X Fähigkeit 1 · Y Fähigkeit 2 · RB/LT/RT Sprint (halten) · Start Pause
//   Menüs: A bestätigen (Enter) · B zurück (Esc) · Steuerkreuz wie Pfeiltasten · LB/RB Tabs wechseln
//   Level-Up: Steuerkreuz/Stick links/rechts wählt die Karte, A nimmt sie
import { dev } from './device.js';

export const pad = { mx: 0, my: 0, sprint: false, on: false };
const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const prev = new Array(17).fill(false);
let stickX = 0, stickY = 0, gpSel = -1;   // Stick als Richtungstaste (mit Rasten), gewählte Karte
const dz = v => (Math.abs(v) < .2 ? 0 : (v - Math.sign(v) * .2) / .8);
const vis = id => { const e = document.getElementById(id); return !!e && !e.hidden; };

function current() {
  if (!navigator.getGamepads) return null;
  for (const g of navigator.getGamepads()) if (g && g.connected) return g;
  return null;
}
// virtueller Tastendruck (gleiche Handler wie die Tastatur)
function key(code) {
  if (!code) return;
  for (const type of ['keydown', 'keyup']) document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
}
const firstKey = a => dev.keys[a][0] || dev.keys[a][1];

export function pollPad() {
  const g = current();
  if (!g) { if (pad.on) { pad.on = false; pad.mx = pad.my = 0; pad.sprint = false; } return; }
  const b = i => !!(g.buttons[i] && g.buttons[i].pressed), down = i => b(i) && !prev[i];
  const ax = dz(g.axes[0] || 0), ay = dz(g.axes[1] || 0);
  pad.mx = ax + (b(B.RIGHT) ? 1 : 0) - (b(B.LEFT) ? 1 : 0);
  pad.my = ay + (b(B.DOWN) ? 1 : 0) - (b(B.UP) ? 1 : 0);
  pad.sprint = b(B.RB) || b(B.LT) || b(B.RT);
  const any = g.buttons.some(x => x.pressed) || Math.abs(ax) + Math.abs(ay) > 0;
  if (any && !pad.on) { pad.on = true; document.body.classList.add('pad'); }   // Handy-Knöpfe ausblenden, solange der Controller spielt
  // Stick als Richtungstaste: Ausschlag über .6 = ein Druck, erst nach Rückkehr unter .3 wieder
  const sx = Math.abs(ax) > .6 ? Math.sign(ax) : Math.abs(ax) < .3 ? 0 : stickX, sy = Math.abs(ay) > .6 ? Math.sign(ay) : Math.abs(ay) < .3 ? 0 : stickY;
  const left = down(B.LEFT) || (sx < 0 && stickX >= 0), right = down(B.RIGHT) || (sx > 0 && stickX <= 0);
  const up = down(B.UP) || (sy < 0 && stickY >= 0), dn = down(B.DOWN) || (sy > 0 && stickY <= 0);
  stickX = sx; stickY = sy;

  const inRun = vis('hud');
  if (vis('levelup')) {
    // Karten: wählen und nehmen
    const cards = [...document.querySelectorAll('#cards .card')];
    if (cards.length) {
      if (gpSel < 0 || gpSel >= cards.length) gpSel = 0;
      if (left) gpSel = (gpSel + cards.length - 1) % cards.length;
      if (right) gpSel = (gpSel + 1) % cards.length;
      cards.forEach((c, i) => c.classList.toggle('gpsel', i === gpSel));
      if (down(B.A)) { cards[gpSel].click(); gpSel = -1; }
    }
  } else {
    gpSel = -1;
    const overlay = document.querySelector('.overlay:not([hidden])');
    if (vis('pause') && (down(B.A) || down(B.START))) { document.getElementById('resumeBtn').click(); }
    else if (inRun && !overlay) {
      if (down(B.A)) key(firstKey('dash'));
      if (down(B.X)) key(firstKey('ab0'));
      if (down(B.Y)) key(firstKey('ab1'));
      if (down(B.START) || down(B.BACK)) key('Escape');
    } else {
      if (down(B.A)) key('Enter');
      if (down(B.B) || down(B.START)) key('Escape');
      if (left) key('ArrowLeft');
      if (right) key('ArrowRight');
      if (up) key('ArrowUp');
      if (dn) key('ArrowDown');
      // Tabs im Hub
      if ((down(B.LB) || down(B.RB)) && !overlay && document.body.classList.contains('hub')) {
        const tabs = [...document.querySelectorAll('#tabbar .tab')], i = tabs.findIndex(t => t.getAttribute('aria-current') === 'page');
        const n = tabs[(i + (down(B.RB) ? 1 : tabs.length - 1)) % tabs.length]; if (n) n.click();
      }
    }
  }
  for (let i = 0; i < prev.length; i++) prev[i] = b(i);
}
// Rütteln (Einstellung Vibration): bei Treffer, Level-Up, Boss
export function rumble(ms, strong = .6) {
  const g = current(); if (!g || !pad.on || !g.vibrationActuator) return;
  try { g.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: strong * .6 }); } catch (_) { /* nicht unterstützt */ }
}
if (typeof window !== 'undefined') window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && pad.on) { pad.on = false; document.body.classList.remove('pad'); } }, true);
