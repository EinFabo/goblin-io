// Kleine Helfer ohne Spielzustand
export const $ = s => document.querySelector(s);
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const fmtTime = t => { t = Math.max(0, Math.floor(t)); return String((t / 60) | 0).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
// Countdown h:mm:ss bzw. m:ss (Truhen, Laden)
export const fmtClock = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
export const isTouch = () => window.matchMedia && window.matchMedia('(hover: none)').matches;
export const faceOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');

// 8 Blickrichtungen (Bild-y zeigt nach unten). Gewechselt wird erst 10° hinter der
// Sektorgrenze, sonst flackert das Sprite bei Bewegung genau auf der Grenze.
export const DIR8 = ['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];
const SEC = Math.PI / 4, HYST = 10 * Math.PI / 180;
export function face8(dx, dy, cur) {
  const a = Math.atan2(dy, dx), ci = DIR8.indexOf(cur);
  if (ci >= 0) { const d = Math.atan2(Math.sin(a - ci * SEC), Math.cos(a - ci * SEC)); if (Math.abs(d) < SEC / 2 + HYST) return cur; }
  return DIR8[(Math.round(a / SEC) + 8) % 8];
}
