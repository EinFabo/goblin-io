import { ANIMS, DEFAULT_LOOK, goblinSvg } from '../gen/goblin.js';
import { DRAWN, MIRROR } from '../gen/svg.js';
import { MAGE_ANIMS, castOffsets, mageSvg } from '../gen/mages.js';
import { ETYPES } from '../data/enemies.js';
import { STAGES } from '../data/stages.js';
import { makeProc } from './proc.js';

// ---------- Sprites ----------
export const U = 0.85;
export const CACHE = [], SPR = {}, TINT = new Map();
export let GRASS_IMG = null;
export function svgSize(s) { const p = s.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number); return [p[2], p[3]]; }
export function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
// SVG-Bild in eine Canvas rastern (größer als nötig, damit es beim Zoomen scharf bleibt)
function raster(im, svg, flip = false, scale = 0) {
  const [w, h] = svgSize(svg);
  const k = scale || (w < 40 ? 4 : w <= 48 ? 2 : 1.5);
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
  await loadMenuMages();
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

// Magier aus dem Generator: m.<schule>[.m].<anim>.<richtung>.<n>.
// Geladen wird in Einheiten (Variante × Animation), damit der Start schnell bleibt:
// beim Booten nur das Menü, der Rest im Hintergrund oder spätestens beim Stage-Start.
// Rechte Richtungen zeigen auf dasselbe Bild und werden beim Zeichnen gespiegelt.
// Meister (Bosse, Großmagier) werden schärfer gerastert.
export const MAGE_OFF = {};
const units = new Map();
const variantOf = key => { const [school, m] = key.split('.'); return [school, m === 'm']; };

function loadUnit(key, anim) {
  const id = key + '|' + anim;
  if (units.has(id)) return units.get(id);
  const [school, master] = variantOf(key);
  if (!MAGE_OFF['m.' + key]) MAGE_OFF['m.' + key] = castOffsets(school, { master });
  const jobs = [];
  for (const dir of Object.keys(DRAWN)) for (let i = 0; i < MAGE_ANIMS[anim]; i++) jobs.push([dir, i, mageSvg(school, dir, anim, i, { master })]);
  const pr = Promise.all(jobs.map(j => loadImg(svgUrl(j[2])))).then(imgs => {
    jobs.forEach(([dir, i, svg], j) => {
      const e = raster(imgs[j], svg, false, master ? 2 : 1.25);
      SPR[`m.${key}.${anim}.${dir}.${i + 1}`] = e;
      const m = Object.keys(MIRROR).find(r => MIRROR[r] === dir);
      if (m) SPR[`m.${key}.${anim}.${m}.${i + 1}`] = { ...e, flip: true };
    });
  });
  units.set(id, pr);
  return pr;
}
const loadVariant = key => Promise.all(Object.keys(MAGE_ANIMS).map(a => loadUnit(key, a)));

const typeKey = t => ETYPES[t].school + (ETYPES[t].master ? '.m' : '');
// Varianten einer Stage: Gegner-Mix, Schwarm (Lehrlinge, Funkenwichtel), Boss
export function stageMageKeys(si) {
  const st = STAGES[si], keys = new Set(st.mix.map(m => typeKey(m[0])));
  for (const t of ['imp', 'bomber', st.boss.minion]) keys.add(typeKey(t));
  keys.add(st.boss.school + '.m');
  return [...keys];
}
export const ensureStage = si => Promise.all(stageMageKeys(si).map(loadVariant));
export function allMageKeys() {
  const keys = new Set(Object.keys(ETYPES).map(typeKey));
  for (const st of STAGES) keys.add(st.boss.school + '.m');
  return [...keys];
}
// Menü: laufende Demo-Magier + je ein Bossbild für die Stage-Vorschau
export const MENU_MAGES = ['fire', 'frost', 'storm', 'toxic', 'shadow', 'light', 'fire.m'];
export async function loadMenuMages() {
  await Promise.all([...MENU_MAGES.map(k => loadUnit(k, 'walk')), ...STAGES.map(st => loadUnit(st.boss.school + '.m', 'idle'))]);
}
// Rest nacheinander im Hintergrund, damit das Menü flüssig bleibt
export async function preloadAllMages() {
  for (const k of allMageKeys()) await loadVariant(k);
}
