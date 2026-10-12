import { ANIMS, DEFAULT_LOOK, goblinSvg } from '../gen/goblin.js';
import { DRAWN, MIRROR } from '../gen/svg.js';
import { makeProc } from './proc.js';

// ---------- Sprites ----------
export const U = 0.85;
export const CACHE = [], SPR = {}, TINT = new Map();
export let GRASS_IMG = null;
export function svgSize(s) { const p = s.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number); return [p[2], p[3]]; }
export function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
// SVG-Bild in eine Canvas rastern (größer als nötig, damit es beim Zoomen scharf bleibt)
function raster(im, svg, flip = false) {
  const [w, h] = svgSize(svg);
  const k = w < 40 ? 4 : w <= 48 ? 2 : 1.5;
  const c = document.createElement('canvas'); c.width = Math.ceil(w * k); c.height = Math.ceil(h * k);
  const g = c.getContext('2d');
  if (flip) { g.translate(c.width, 0); g.scale(-1, 1); }
  if (im) g.drawImage(im, 0, 0, c.width, c.height);
  const e = { c, uw: w, uh: h, idx: CACHE.length };
  CACHE.push(e);
  return e;
}
export async function loadAssets() {
  const imgs = await Promise.all(SVGS.map(s => loadImg(svgUrl(s))));
  const fixed = imgs.map((im, i) => raster(im, SVGS[i]));
  for (const [name, i] of Object.entries(SPRMAP)) SPR[name] = fixed[i];
  await loadGoblin(DEFAULT_LOOK);
  GRASS_IMG = await loadImg(GRASS);
  makeProc();
}

// Goblin aus dem Generator: gob.<anim>.<richtung>.<n> für alle 8 Richtungen.
// Rechte Richtungen werden beim Rastern gespiegelt. Alte Namen (idle_down_1 …) zeigen auf die neuen Bilder.
export async function loadGoblin(look) {
  const jobs = [];
  for (const [anim, n] of Object.entries(ANIMS)) for (const dir of Object.keys(DRAWN)) for (let i = 0; i < n; i++) jobs.push([anim, dir, i, goblinSvg(dir, anim, i, look)]);
  const imgs = await Promise.all(jobs.map(j => loadImg(svgUrl(j[3]))));
  jobs.forEach(([anim, dir, i, svg], j) => {
    SPR[`gob.${anim}.${dir}.${i + 1}`] = raster(imgs[j], svg);
    const m = Object.keys(MIRROR).find(r => MIRROR[r] === dir);
    if (m) SPR[`gob.${anim}.${m}.${i + 1}`] = raster(imgs[j], svg, true);
  });
  for (const anim of ['idle', 'walk']) for (const dir of ['down', 'left', 'up', 'right']) for (let i = 1; i <= ANIMS[anim]; i++) SPR[`${anim}_${dir}_${i}`] = SPR[`gob.${anim}.${dir}.${i}`];
}
export const TINTS = {
  gold: ['#ffc928', .42], shadow: ['#3b1466', .5], ember: ['#a3140c', .38], rage: ['#ff2a1a', .42],
  storm: ['#ffe23a', .5], toxic: ['#32c22a', .5], void: ['#1e0638', .62], holy: ['#fff7d6', .58],
  voidp: ['#a45cff', .6], toxp: ['#5be03a', .7], white: ['#ffffff', 1], trail: ['#8fe6ff', .7],
};
export function tinted(entry, tint) {
  const key = entry.idx + '|' + tint;
  let c = TINT.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = entry.c.width; c.height = entry.c.height;
    const g = c.getContext('2d'); g.drawImage(entry.c, 0, 0);
    const [col, a] = TINTS[tint] || [tint, .85];
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    TINT.set(key, c);
  }
  return c;
}
