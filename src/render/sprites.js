import { ANIMS, DEFAULT_LOOK, goblinSvg } from '../gen/goblin.js';
import { DRAWN, MIRROR } from '../gen/svg.js';
import { MAGE_ANIMS, castOffsets, mageSvg } from '../gen/mages.js';
import { MINION_ANIMS, minionSvg } from '../gen/minions.js';
import { FX_KINDS, fxHitSvg, fxSvg } from '../gen/fx.js';
import { ETYPES } from '../data/enemies.js';
import { STAGES, stageTypes } from '../data/stages.js';
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
// Dem Browser kurz Luft lassen, damit der Ladebildschirm zwischen den Schritten weiter animiert
const breathe = () => new Promise(r => setTimeout(r, 0));

// Alles laden, was das Spiel braucht. onStep(Anteil 0…1, Text) meldet den Fortschritt.
// Erst die Lauf-Bilder des Goblins (für den Ladebildschirm), dann der Rest, zuletzt alle Magier –
// danach lädt nichts mehr im Hintergrund nach und das Menü ruckelt nicht.
export async function loadAssets(onStep = () => {}, wantStage = () => true) {
  const steps = [
    ['Goblin schnürt die Stiefel …', 1, () => loadGoblinRun()],
    ['Waffen werden geschliffen …', 2, async () => {
      const imgs = await Promise.all(SVGS.map(s => loadImg(svgUrl(s))));
      const fixed = imgs.map((im, i) => raster(im, SVGS[i]));
      for (const [name, i] of Object.entries(SPRMAP)) SPR[name] = fixed[i];
    }],
    ['Feuerbälle werden geknetet …', 2, () => loadFx()],
    ['Goblin übt Rollen …', 5, () => loadGoblin(DEFAULT_LOOK)],
    ['Wiese wird gemäht …', 1, async () => { GRASS_IMG = await loadImg(GRASS); makeProc(); }],
    ['Magier ziehen ihre Roben an …', 3, () => loadMenuMages()],
    // nur freigeschaltete Stages; der Rest lädt beim ersten Start der Stage
    ...STAGES.map((st, si) => [`Magier für ${st.name} …`, 3, () => ensureStage(si)]).filter((_, si) => wantStage(si)),
  ];
  const total = steps.reduce((a, s) => a + s[1], 0);
  let done = 0;
  for (const [txt, w, fn] of steps) {
    onStep(done / total, txt);
    await fn(); await breathe();
    done += w;
  }
  onStep(1, 'Fertig!');
}
// Nur Sprint (seitlich) und ein Magier zum Hinterherlaufen – reicht für den Ladebildschirm
async function loadGoblinRun() {
  const jobs = [];
  for (let i = 0; i < ANIMS.sprint; i++) jobs.push([i, goblinSvg('left', 'sprint', i, DEFAULT_LOOK)]);
  const imgs = await Promise.all(jobs.map(j => loadImg(svgUrl(j[1]))));
  jobs.forEach(([i, svg], j) => { SPR[`gob.sprint.right.${i + 1}`] = raster(imgs[j], svg, true); });
  await loadUnit('fire', 'walk');
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
const variantOf = key => { const [school, v] = key.split('.'); return [school, { master: v === 'm', clone: v === 'c' }]; };

function loadUnit(key, anim) {
  const id = key + '|' + anim;
  if (units.has(id)) return units.get(id);
  const [school, opt] = variantOf(key);
  if (!MAGE_OFF['m.' + key]) MAGE_OFF['m.' + key] = castOffsets(school, opt);
  const jobs = [];
  for (const dir of Object.keys(DRAWN)) for (let i = 0; i < MAGE_ANIMS[anim]; i++) jobs.push([dir, i, mageSvg(school, dir, anim, i, opt)]);
  const pr = Promise.all(jobs.map(j => loadImg(svgUrl(j[2])))).then(imgs => {
    jobs.forEach(([dir, i, svg], j) => {
      const e = raster(imgs[j], svg, false, opt.master ? 2 : 1.25);
      SPR[`m.${key}.${anim}.${dir}.${i + 1}`] = e;
      const m = Object.keys(MIRROR).find(r => MIRROR[r] === dir);
      if (m) SPR[`m.${key}.${anim}.${m}.${i + 1}`] = { ...e, flip: true };
    });
  });
  units.set(id, pr);
  return pr;
}
const loadVariant = key => Promise.all(Object.keys(MAGE_ANIMS).map(a => loadUnit(key, a)));

// Was ein Gegnertyp an Bildern braucht, inkl. allem, was er beschwört
const SUMMONS = { summon_skeletons: ['skeleton'], raise_ghosts: ['ghost'], summon_golem: ['golem'], portal: ['void_portal', 'shadow_apprentice'], clones: ['shadow_clone'] };
function typeNeeds(type, out = { mages: new Set(), minions: new Set() }, seen = new Set()) {
  if (seen.has(type)) return out; seen.add(type);
  const T = ETYPES[type];
  if (T.sprite) out.minions.add(T.sprite);
  else if (!T.draw) out.mages.add(T.school + (T.role === 'master' ? '.m' : T.clone ? '.c' : ''));
  for (const c of T.casts || []) for (const s of SUMMONS[c.id] || []) typeNeeds(s, out, seen);
  return out;
}
function stageNeeds(si) {
  // Ratten immer dabei (Rattenflut)
  const st = STAGES[si], out = { mages: new Set([st.boss.school + '.m']), minions: new Set(['rat']) }, seen = new Set();
  for (const t of stageTypes(st)) typeNeeds(t, out, seen);
  return out;
}
export const stageMageKeys = si => [...stageNeeds(si).mages];
export function ensureStage(si) {
  const n = stageNeeds(si);
  return Promise.all([...[...n.mages].map(loadVariant), loadMinions([...n.minions])]);
}
// Menü: laufende Demo-Magier + je ein Bossbild für die Stage-Vorschau
export const MENU_MAGES = ['fire', 'frost', 'storm', 'toxic', 'shadow', 'light', 'fire.m'];
export async function loadMenuMages() {
  await Promise.all([...MENU_MAGES.map(k => loadUnit(k, 'walk')), ...STAGES.map(st => loadUnit(st.boss.school + '.m', 'idle'))]);
}
// Alle Stages (für Bot und Tests; im Spiel lädt eine gesperrte Stage erst beim ersten Start)
export async function preloadAllMages() {
  for (let si = 0; si < STAGES.length; si++) await ensureStage(si);
}

// Diener (Skelett, Geist, Golem, Ratte): n.<art>.<anim>.<richtung>.<n>, nur bei Bedarf geladen
export function loadMinions(kinds) {
  return Promise.all(kinds.map(kind => {
    const id = 'n|' + kind;
    if (units.has(id)) return units.get(id);
    const jobs = [];
    for (const [anim, n] of Object.entries(MINION_ANIMS)) for (const dir of Object.keys(DRAWN)) for (let i = 0; i < n; i++) jobs.push([anim, dir, i, minionSvg(kind, dir, anim, i)]);
    const pr = Promise.all(jobs.map(j => loadImg(svgUrl(j[3])))).then(imgs => jobs.forEach(([anim, dir, i, svg], j) => {
      const e = raster(imgs[j], svg, false, kind === 'golem' ? 1.5 : 1.25);
      SPR[`n.${kind}.${anim}.${dir}.${i + 1}`] = e;
      const m = Object.keys(MIRROR).find(r => MIRROR[r] === dir);
      if (m) SPR[`n.${kind}.${anim}.${m}.${i + 1}`] = { ...e, flip: true };
    }));
    units.set(id, pr);
    return pr;
  }));
}

// Geschosse/Einschläge der Schulen: p.<art>.<n> (4 Frames) und p.<art>_hit.<n> (5 Frames)
async function loadFx() {
  const jobs = [];
  for (const k of FX_KINDS) {
    for (let i = 0; i < 4; i++) jobs.push([`p.${k}.${i + 1}`, fxSvg(k, i)]);
    for (let i = 0; i < 5; i++) jobs.push([`p.${k}_hit.${i + 1}`, fxHitSvg(k, i)]);
  }
  const imgs = await Promise.all(jobs.map(j => loadImg(svgUrl(j[1]))));
  jobs.forEach(([name, svg], j) => { SPR[name] = raster(imgs[j], svg); });
}
