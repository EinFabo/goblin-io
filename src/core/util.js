// Kleine Helfer ohne Spielzustand
export const $ = s => document.querySelector(s);
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const fmtTime = t => { t = Math.max(0, Math.floor(t)); return String((t / 60) | 0).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
export const isTouch = () => window.matchMedia && window.matchMedia('(hover: none)').matches;
export const faceOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
