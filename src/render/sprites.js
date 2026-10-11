import { makeProc } from './proc.js';

// ---------- Sprites ----------
export const U = 0.85;
export const CACHE = [], SPR = {}, TINT = new Map();
export let GRASS_IMG = null;
export function svgSize(s) { const p = s.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number); return [p[2], p[3]]; }
export function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
export async function loadAssets() {
  const imgs = await Promise.all(SVGS.map(s => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s))));
  imgs.forEach((im, i) => {
    const [w, h] = svgSize(SVGS[i]);
    const k = w < 40 ? 4 : w <= 48 ? 2 : 1.5;
    const c = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
    if (im) c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    CACHE[i] = { c, uw: w, uh: h, idx: i };
  });
  for (const [name, i] of Object.entries(SPRMAP)) SPR[name] = CACHE[i];
  GRASS_IMG = await loadImg(GRASS);
  makeProc();
}
export const TINTS = {
  gold: ['#ffc928', .42], shadow: ['#3b1466', .5], ember: ['#a3140c', .38], rage: ['#ff2a1a', .42],
  storm: ['#ffe23a', .5], toxic: ['#32c22a', .5], void: ['#1e0638', .62], holy: ['#fff7d6', .58],
  voidp: ['#a45cff', .6], toxp: ['#5be03a', .7],
};
export function tinted(entry, tint) {
  const key = entry.idx + '|' + tint;
  let c = TINT.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = entry.c.width; c.height = entry.c.height;
    const g = c.getContext('2d'); g.drawImage(entry.c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = TINTS[tint][1]; g.fillStyle = TINTS[tint][0]; g.fillRect(0, 0, c.width, c.height);
    TINT.set(key, c);
  }
  return c;
}
