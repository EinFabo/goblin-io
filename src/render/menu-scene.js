import { $, TAU, faceOf } from '../core/util.js';
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
    const kinds = [['f_', null], ['e_', null], ['e_', 'storm'], ['f_', 'toxic'], ['e_', 'void'], ['e_', 'holy'], ['f_', null], ['e_', null], ['f_', 'ember'], ['e_', 'storm'], ['f_', 'toxic'], ['e_', null]];
    kinds.forEach(([pre, tint], i) => demo.push({ a: i * TAU / kinds.length, r: 190 + (i % 3) * 70, pre, tint, s: .35 + Math.random() * .2 }));
  }
  const items = demo.map(d => { const a = d.a + t * d.s * (d.r > 230 ? -1 : 1) * .5; return { x: cx + Math.cos(a) * d.r, y: cy + Math.sin(a) * d.r * .7, d, a }; });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const dir = it.d.r > 230 ? -1 : 1, vx = -Math.sin(it.a) * dir, vy = Math.cos(it.a) * .7 * dir;
    drawSpr(it.d.pre + 'walk_' + faceOf(vx, vy) + '_' + ((Math.floor(t * 8 + it.d.a * 3) % 6) + 1), it.x, it.y, 1, 0, it.d.tint);
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(10,15,6,.25)'; ctx.fillRect(0, 0, W, H);
  if (!$('#menu').hidden) {
    const m = $('#mascot'), g = m.getContext('2d'), e = SPR['idle_down_' + ((Math.floor(t * 5) % 4) + 1)];
    g.clearRect(0, 0, 240, 240); g.drawImage(e.c, 0, 0, 240, 240);
  }
}
