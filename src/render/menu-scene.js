import { $, TAU, face8 } from '../core/util.js';
import { DPR, H, W, ZOOM, ctx, cv, drawSpr } from './canvas.js';
import { drawGround } from './tiles.js';
import { SPR } from './sprites.js';

// Menü-Szene
const demo = [];
export function renderMenuScene(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (!SPR.idle_down_1) { ctx.fillStyle = '#141c0e'; ctx.fillRect(0, 0, cv.width, cv.height); return; }
  const z = ZOOM * DPR * 1.1, cx = Math.sin(t * .05) * 200, cy = t * 12;
  ctx.setTransform(z, 0, 0, z, cv.width / 2 - cx * z, cv.height / 2 - cy * z);
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM;
  drawGround(0, cx - hw, cy - hh, hw * 2, hh * 2);
  if (!demo.length) {
    const kinds = ['fire', 'frost', 'storm', 'toxic', 'shadow', 'light', 'fire', 'frost', 'fire.m', 'storm', 'toxic', 'shadow'];
    kinds.forEach((sc, i) => demo.push({ a: i * TAU / kinds.length, r: 190 + (i % 3) * 70, pre: 'm.' + sc, s: .35 + Math.random() * .2, face: 'down' }));
  }
  const items = demo.map(d => { const a = d.a + t * d.s * (d.r > 230 ? -1 : 1) * .5; return { x: cx + Math.cos(a) * d.r, y: cy + Math.sin(a) * d.r * .7, d, a }; });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const dir = it.d.r > 230 ? -1 : 1, vx = -Math.sin(it.a) * dir, vy = Math.cos(it.a) * .7 * dir;
    it.d.face = face8(vx, vy, it.d.face);
    drawSpr(`${it.d.pre}.walk.${it.d.face}.${(Math.floor(t * 8 + it.d.a * 3) % 6) + 1}`, it.x, it.y, 1);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(10,15,6,.25)'; ctx.fillRect(0, 0, W, H);
  const e = SPR['idle_down_' + ((Math.floor(t * 5) % 4) + 1)];
  if (!$('#menu').hidden) paint('#mascot', e);
  if (!$('#armory').hidden) paint('#armGob', e);
  if (!$('#profile').hidden) paint('#profGob', e);
  // Avatar: nur der Kopf; in der Tab-Leiste und oben links
  if (!$('#topbar').hidden) { paint('#avatar', e, HEAD); paint('#tabAvatar', e, HEAD); }
}
const HEAD = [16, 4, 112];   // Ausschnitt x, y, Seite im 144er Sprite
function paint(sel, e, crop) {
  const c = $(sel), g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  if (crop) g.drawImage(e.c, crop[0] * e.c.width / 144, crop[1] * e.c.height / 144, crop[2] * e.c.width / 144, crop[2] * e.c.height / 144, 0, 0, c.width, c.height);
  else g.drawImage(e.c, 0, 0, c.width, c.height);
}
