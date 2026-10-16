import { $, clamp } from '../core/util.js';
import { SPR, U, blit, tinted } from './sprites.js';

// ---------- Canvas ----------
export let cv = $('#cv'), ctx = cv.getContext('2d');
export let W = 0, H = 0, DPR = 1, ZOOM = 1;
// Alles Zeichnen (und die Bildschirmmaße der Logik) kurz auf eine andere Fläche umlenken, z. B. die Vorschau
// im Entwicklungs-Baum (ui/evotree.js). ES-Module binden live: alle Importe sehen die neue Fläche.
export function withCanvas(c, w, h, dpr, zoom, fn) {
  const prev = [cv, ctx, W, H, DPR, ZOOM];
  cv = c; ctx = c.getContext('2d'); W = w; H = h; DPR = dpr; ZOOM = zoom;
  try { return fn(); } finally { [cv, ctx, W, H, DPR, ZOOM] = prev; }
}
export function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ZOOM = clamp(Math.min(W, H) / 640, 0.55, 1.05);
}
window.addEventListener('resize', resize);
export function drawSpr(name, x, y, sc = 1, rot = 0, tint = null, alpha = 1, flash = false) {
  const e = SPR[name]; if (!e) return;
  const img = tint ? tinted(e, tint) : e;
  const w = e.uw * U * sc, h = e.uh * U * sc;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); if (e.flip) ctx.scale(-1, 1);
  blit(ctx, img, -w / 2, -h / 2, w, h);
  if (flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .75 * alpha; blit(ctx, img, -w / 2, -h / 2, w, h); }
  ctx.restore();
}
export function drawImgC(c, x, y, w, rot = 0, alpha = 1) {
  const h = w * c.height / c.width;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore();
}
