import { hasPerk } from '../data/classes.js';
import { ANIMS, goblinSvg } from '../gen/goblin.js';
import { activeCls, clsState, save } from '../core/save.js';
import { DAGGER_TINT } from '../data/cosmetics.js';
import { DRAWN, MIRROR } from '../gen/svg.js';
import { MAGE_ANIMS, castOffsets, mageSvg } from '../gen/mages.js';
import { MINION_ANIMS, minionSvg } from '../gen/minions.js';
import { FX_KINDS, fxHitSvg, fxSvg } from '../gen/fx.js';
import { ETYPES } from '../data/enemies.js';
import { STAGES, stageTypes } from '../data/stages.js';
import { BOSSES, BOSS_IDS, bossVariant } from '../data/bosses.js';
import { makeProc } from './proc.js';

// ---------- Sprites ----------
export const U = 0.85;
export const SPR = {};
let nextIdx = 0;   // Nummer je gerastertem Bild (Schlüssel der Tönungen)
export let GRASS_IMG = null;
export function svgSize(s) { const p = s.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number); return [p[2], p[3]]; }
export function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
export const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
// ---------- Bild-Flächen ----------
// Jedes Sprite-Bild liegt ohne durchsichtigen Rand auf einer eigenen, genau passenden Fläche.
// Eintrag: c Fläche, sx/sy/sw/sh Ausschnitt darin, fw/fh volle Rastergröße, tx/ty Lage des Ausschnitts
// im vollen Bild, uw/uh Größe in SVG-Einheiten. Gezeichnet wird mit blit()/blitPart().
// Kein gemeinsamer Atlas mehr: aus großen Atlas-Seiten (1024²/2048²) rechnet Chrome jede Zeichnung sofort
// auf dem Haupt-Thread ab – gemessen 20–100 ms je Frame statt 1–7 ms, das Ruckeln in 3.0.1. Einzeln
// zugeschnitten braucht sogar weniger Speicher (kein verschenkter Platz auf den Seiten).
// Gruppen: 'gob'/'gobtint' (Hub-Bilder des Goblins) und 'gobrun'/'gobruntint' (Lauf-Bilder) werden beim Umziehen verworfen.
export const PAGES = {};   // Flächen je Gruppe (Speicher-Zählung, Verwerfen)
function alloc(group, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  (PAGES[group] || (PAGES[group] = [])).push({ c });
  return [{ c, g: c.getContext('2d') }, 0, 0];
}
// Arbeitsfläche zum Rastern und Zuschneiden (liest Pixel, daher willReadFrequently)
let scr = null, sg = null;
function scratch(w, h) {
  if (!scr || scr.width < w || scr.height < h) {
    const c = document.createElement('canvas');
    c.width = Math.max(w, scr ? scr.width : 0); c.height = Math.max(h, scr ? scr.height : 0);
    scr = c; sg = c.getContext('2d', { willReadFrequently: true });
  }
  sg.setTransform(1, 0, 0, 1, 0, 0); sg.clearRect(0, 0, w, h);
  return sg;
}
// Rechteck mit sichtbaren Pixeln, 1 px durchsichtiger Rand (sauberes Filtern an den Kanten)
function opaqueBox(w, h) {
  const px = new Uint32Array(sg.getImageData(0, 0, w, h).data.buffer);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let a = 0; while (a < w && px[row + a] >>> 24 < 3) a++;
    if (a === w) continue;
    let b = w - 1; while (px[row + b] >>> 24 < 3) b--;
    if (a < x0) x0 = a; if (b > x1) x1 = b; if (y0 === h) y0 = y; y1 = y;
  }
  if (x1 < 0) return [0, 0, 1, 1];
  x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
  return [x0, y0, Math.min(w, x1 + 2) - x0, Math.min(h, y1 + 2) - y0];
}
// SVG-Bild rastern (größer als nötig, damit es beim Zoomen scharf bleibt), zuschneiden, auf eine eigene Fläche legen
function raster(im, svg, flip = false, scale = 0, group = 'main') {
  const [w, h] = svgSize(svg);
  const k = scale || (w < 40 ? 4 : w <= 48 ? 2 : 1.5);
  const fw = Math.ceil(w * k), fh = Math.ceil(h * k), g = scratch(fw, fh);
  if (flip) { g.translate(fw, 0); g.scale(-1, 1); }
  if (im) g.drawImage(im, 0, 0, fw, fh);
  const [tx, ty, sw, sh] = opaqueBox(fw, fh), [p, sx, sy] = alloc(group, sw, sh);
  p.g.drawImage(scr, tx, ty, sw, sh, sx, sy, sw, sh);
  return { c: p.c, sx, sy, sw, sh, tx, ty, fw, fh, uw: w, uh: h, idx: nextIdx++, group };
}
// Ausschnitt (cx, cy, cw, ch) des vollen Bildes in das Rechteck (dx, dy, dw, dh) zeichnen
export function blitPart(g, e, cx, cy, cw, ch, dx, dy, dw, dh) {
  const x0 = Math.max(cx, e.tx), y0 = Math.max(cy, e.ty), x1 = Math.min(cx + cw, e.tx + e.sw), y1 = Math.min(cy + ch, e.ty + e.sh);
  if (x1 <= x0 || y1 <= y0) return;
  const kx = dw / cw, ky = dh / ch;
  g.drawImage(e.c, e.sx + x0 - e.tx, e.sy + y0 - e.ty, x1 - x0, y1 - y0, dx + (x0 - cx) * kx, dy + (y0 - cy) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
}
// Das ganze Bild in das Rechteck (x, y, w, h)
export const blit = (g, e, x, y, w, h) => blitPart(g, e, 0, 0, e.fw, e.fh, x, y, w, h);
// Rastern in Häppchen (höchstens 6 ms am Stück), damit das Menü flüssig bleibt, während die Magier
// der Welten im Hintergrund laden. Wartet jemand auf die Bilder (Ladebildschirm, Stage-Start),
// wird in großen Stücken gerastert (rushing). Während Lauf und Ergebnis ruht das Hintergrund-Laden
// (die Szenen schalten es mit pauseBackground um).
const queue = [];
let pumping = false, rush = 0, bgPaused = false;
const resting = () => !rush && bgPaused;
export function pauseBackground(on) { bgPaused = on; if (!on) nextLoad(); }
function sliced(fns) { return new Promise(res => { queue.push(...fns, res); pump(); }); }
function pump() {
  if (pumping) return;
  pumping = true;
  setTimeout(function slice() {
    if (resting()) { setTimeout(slice, 500); return; }
    const end = performance.now() + (rush ? 50 : 6);
    while (queue.length && performance.now() < end) {
      try { queue.shift()(); } catch (err) { console.error(err); }   // ein kaputtes Bild hält den Rest nicht auf
    }
    if (queue.length) setTimeout(slice, 0); else pumping = false;
  }, 0);
}
export async function rushing(pr) { rush++; nextLoad(); try { return await pr; } finally { rush--; } }
// Im Hintergrund höchstens 3 SVG-Bilder gleichzeitig laden: der Browser liest SVGs auf dem Haupt-Thread,
// viele auf einmal ergeben Hänger von mehreren 100 ms. Das SVG selbst entsteht erst, wenn es dran ist
// (mk), sonst erzeugt eine ganze Welt ihre ~2 000 SVGs in einem Rutsch. Liefert [Bild, SVG].
let loading = 0, restT = 0;
const waiting = [];
// first: vor die übrigen Aufträge (Goblin-Lauf-Bilder sollen nicht hinter den Magiern einer anderen Welt warten)
function loadQueued(mk, first = false) {
  return new Promise(res => {
    waiting[first ? 'unshift' : 'push'](() => { loading++; const svg = mk(); loadImg(svgUrl(svg)).then(im => { loading--; res([im, svg]); nextLoad(); }); });
    nextLoad();
  });
}
const mirrorOf = dir => Object.keys(MIRROR).find(r => MIRROR[r] === dir);
// Bilder einer Einheit laden und in Häppchen rastern. jobs: [Name, Spiegel-Name oder null, () => SVG]
function loadFrames(jobs, scale) {
  return Promise.all(jobs.map(j => loadQueued(j[2]))).then(res => sliced(res.map(([im, svg], i) => () => {
    const [name, mirror] = jobs[i], e = raster(im, svg, false, scale);
    SPR[name] = e;
    if (mirror) SPR[mirror] = { ...e, flip: true };
  })));
}
function nextLoad() {
  // auch beim Eilen höchstens 8: sonst landen beim Start eines Laufs Hunderte SVG-Dekodierungen in dessen ersten Sekunden
  while (waiting.length && loading < (rush ? 8 : 3)) {
    if (resting()) { if (!restT) restT = setTimeout(() => { restT = 0; nextLoad(); }, 500); return; }
    waiting.shift()();
  }
}
// Dem Browser kurz Luft lassen, damit der Ladebildschirm zwischen den Schritten weiter animiert
const breathe = () => new Promise(r => setTimeout(r, 0));

// Alles laden, was das Spiel braucht. onStep(Anteil 0…1, Text) meldet den Fortschritt.
// Erst die Lauf-Bilder des Goblins (für den Ladebildschirm), dann der Rest. Die Magier der
// freigeschalteten Welten lädt danach loadStagesLater() im Hintergrund.
export async function loadAssets(onStep = () => {}) {
  const steps = [
    ['Goblin schnürt die Stiefel …', 1, () => loadGoblinRun()],
    ['Waffen werden geschliffen …', 2, async () => {
      const imgs = await Promise.all(SVGS.map(s => loadImg(svgUrl(s))));
      const fixed = imgs.map((im, i) => raster(im, SVGS[i]));
      for (const [name, i] of Object.entries(SPRMAP)) SPR[name] = fixed[i];
    }],
    ['Feuerbälle werden geknetet …', 2, () => loadFx()],
    ['Goblin übt Rollen …', 3, () => loadGoblin(goblinLook(), true)],
    ['Wiese wird gemäht …', 1, async () => { GRASS_IMG = await loadImg(GRASS); makeProc(); }],
    ['Magier ziehen ihre Roben an …', 3, () => Promise.all([loadMenuMages(), loadMinions(['rat'])])],   // Ratten: Icon „Rattenflut“
  ];
  const total = steps.reduce((a, s) => a + s[1], 0);
  let done = 0;
  for (const [txt, w, fn] of steps) {
    onStep(done / total, txt);
    await rushing(fn()); await breathe();
    done += w;
  }
  onStep(1, 'Fertig!');
}
// Magier der freigeschalteten Welten, eine nach der anderen in Häppchen (die zuletzt gespielte zuerst).
// Eine gesperrte Welt lädt beim ersten Start; startStage wartet notfalls mit „Lade Magier …“.
export async function loadStagesLater(want, first = 0) {
  const order = [first, ...STAGES.keys()].filter((si, i, a) => a.indexOf(si) === i && STAGES[si] && want(si));
  await Promise.all(MENU_MAGES.map(k => loadUnit(k, 'walk')));
  for (const si of order) await ensureStage(si);
}
// Nur Sprint (seitlich) und ein Magier zum Hinterherlaufen – reicht für den Ladebildschirm
async function loadGoblinRun() {
  const jobs = [];
  for (let i = 0; i < ANIMS.sprint; i++) jobs.push([i, goblinSvg('left', 'sprint', i, goblinLook())]);
  const imgs = await Promise.all(jobs.map(j => loadImg(svgUrl(j[1]))));
  jobs.forEach(([i, svg], j) => { SPR[`gob.sprint.right.${i + 1}`] = raster(imgs[j], svg, true, 0, 'gobrun'); });
  await loadUnit('fire', 'walk');
}

// Goblin aus dem Generator: gob.<anim>.<richtung>.<n> für alle 8 Richtungen.
// Rechte Richtungen zeigen auf dasselbe Bild und werden beim Zeichnen gespiegelt. Alte Namen (idle_down_1 …) zeigen auf die neuen Bilder.
// Aussehen aus dem Spielstand (Garderobe); ein späterer Aufruf gewinnt, falls zwei gleichzeitig laufen
// Klasse (Phase 9): Ausstattung und Klassenwaffe; Klassen-Level 20 macht sie golden
// (gesperrte Klasse – alter oder fremder Stand – spielt und sieht aus wie der Goblin, s. newRun)
export function goblinLook() {
  const cls = activeCls();
  return { skin: save.look.skin, outfit: save.look.outfit, hat: save.look.hat, cls, gold: hasPerk(clsState(cls).lv, 'master') };
}
let gobToken = 0, gobFull = Promise.resolve(true), gobGo = null;
// Phase 13: Erst was der Hub zeigt (Ruhe, Laufen, Blinzeln), dann der Rest (Sprint, Rolle, Treffer, Sieg, Tod).
// Liefert das Versprechen für den Hub-Teil (reicht für Icons und Vorschau). Der Rest lädt über die Hintergrund-Schlange mit Vorrang;
// lazy (nur beim Start) wartet er, bis goblinRest() ihn anstößt (nach dem Hub-Aufbau, sonst bremst er die übrigen Ladeschritte),
// sonst eilt er (auch auf dem Ergebnis-Bildschirm, wo der Hintergrund ruht). goblinDone() wartet vor jedem Lauf darauf.
const HUB_ANIMS = ['idle', 'walk', 'blink'], RUN_ANIMS = Object.keys(ANIMS).filter(a => !HUB_ANIMS.includes(a));
export function goblinRest() { if (gobGo) { gobGo(); gobGo = null; } return gobFull; }
// bis das aktuelle Aussehen komplett ist – auch wenn währenddessen ein neues angestoßen wurde
export async function goblinDone() { let p; do { p = goblinRest(); await p; } while (p !== gobFull); }
export function loadGoblin(look = goblinLook(), lazy = false) {
  const me = ++gobToken;
  const hub = loadGoblinHub(me, look);
  const gate = lazy ? new Promise(r => { gobGo = r; }) : (gobGo = null, true);
  gobFull = hub.then(ok => ok && Promise.resolve(gate).then(() => (lazy ? loadGoblinRest(me, look) : rushing(loadGoblinRest(me, look)))));
  return hub;
}
async function loadGoblinHub(me, look) {
  const jobs = [];
  for (const anim of HUB_ANIMS) for (const dir of Object.keys(DRAWN)) for (let i = 0; i < ANIMS[anim]; i++) jobs.push([anim, dir, i, goblinSvg(dir, anim, i, look)]);
  const imgs = await Promise.all(jobs.map(j => loadImg(svgUrl(j[3]))));
  if (me !== gobToken) return false;
  // alte Goblin-Bilder freigeben (Flächen; die Tönungen hängen an den Einträgen), sonst wächst der Speicher mit jedem Umziehen
  PAGES.gob = []; PAGES.gobtint = [];
  jobs.forEach(([anim, dir, i, svg], j) => setGoblin(anim, dir, i, raster(imgs[j], svg, false, 0, 'gob')));
  for (const anim of ['idle', 'walk']) for (const dir of ['down', 'left', 'up', 'right']) for (let i = 1; i <= ANIMS[anim]; i++) SPR[`${anim}_${dir}_${i}`] = SPR[`gob.${anim}.${dir}.${i}`];
  return true;
}
// Der Rest über die Hintergrund-Schlange (höchstens 3 SVGs gleichzeitig, Rastern in Häppchen). Überholte Aufträge
// (inzwischen anderes Aussehen) erzeugen nur ein leeres Mini-SVG statt des Goblins.
const NO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
async function loadGoblinRest(me, look) {
  const jobs = [];
  for (const anim of RUN_ANIMS) for (const dir of Object.keys(DRAWN)) for (let i = 0; i < ANIMS[anim]; i++) jobs.push([anim, dir, i]);
  const res = await Promise.all(jobs.map(([anim, dir, i]) => loadQueued(() => (me === gobToken ? goblinSvg(dir, anim, i, look) : NO_SVG), true)));
  if (me !== gobToken) return false;
  let fresh = true;
  await sliced(res.map(([im, svg], k) => () => {
    if (me !== gobToken) return;
    if (fresh) { PAGES.gobrun = []; PAGES.gobruntint = []; fresh = false; }   // alte Lauf-Bilder erst jetzt verwerfen: bis hierher sind sie noch im Einsatz
    setGoblin(...jobs[k], raster(im, svg, false, 0, 'gobrun'));
  }));
  return me === gobToken;
}
function setGoblin(anim, dir, i, e) {
  SPR[`gob.${anim}.${dir}.${i + 1}`] = e;
  const m = mirrorOf(dir);
  if (m) SPR[`gob.${anim}.${m}.${i + 1}`] = { ...e, flip: true };
}
export const TINTS = {
  gold: ['#ffc928', .42], shadow: ['#3b1466', .5], ember: ['#a3140c', .38], rage: ['#ff2a1a', .42],
  storm: ['#ffe23a', .5], toxic: ['#32c22a', .5], void: ['#1e0638', .62], holy: ['#fff7d6', .58],
  voidp: ['#a45cff', .6], toxp: ['#5be03a', .7], white: ['#ffffff', 1], trail: ['#8fe6ff', .7], shade: ['#1e0a3a', .55],
};
// Dolch-Skins als Tönungen (data/cosmetics.js)
for (const [k, t] of Object.entries(DAGGER_TINT)) if (t) TINTS['dagger_' + k] = t;
export const daggerTint = () => (DAGGER_TINT[save.look.dagger] ? 'dagger_' + save.look.dagger : null);
// Getönte Fassung als eigene Fläche (ohne flip: das Spiegeln übernimmt der Aufrufer)
// Die Tönungen hängen am Eintrag (kein Schlüssel-String je Zeichnung); gespiegelte Einträge haben ihren eigenen Satz
export function tinted(e, tint) {
  const tc = e.tc || (e.tc = {});
  let t = tc[tint];
  if (!t) {
    const [p, sx, sy] = alloc(e.group === 'gob' || e.group === 'gobrun' ? e.group + 'tint' : 'tint', e.sw, e.sh), g = p.g;
    g.drawImage(e.c, e.sx, e.sy, e.sw, e.sh, sx, sy, e.sw, e.sh);
    const [col, a] = TINTS[tint] || [tint, .85];
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = col; g.fillRect(sx, sy, e.sw, e.sh); g.restore();
    t = { c: p.c, sx, sy, sw: e.sw, sh: e.sh, tx: e.tx, ty: e.ty, fw: e.fw, fh: e.fh, uw: e.uw, uh: e.uh };
    tc[tint] = t;
  }
  return t;
}

// Magier aus dem Generator: m.<schule>[.m].<anim>.<richtung>.<n>.
// Geladen wird in Einheiten (Variante × Animation), damit der Start schnell bleibt:
// beim Booten nur das Menü, der Rest im Hintergrund oder spätestens beim Stage-Start.
// Rechte Richtungen zeigen auf dasselbe Bild und werden beim Zeichnen gespiegelt.
// Meister (Bosse, Großmagier) werden schärfer gerastert.
export const MAGE_OFF = {};
const units = new Map();
// Varianten: '' Schüler/Magier, 'm' Meister, 'c' Klon, sonst Boss-Modell ('ignaz'); 'spiegel-c' = Boss-Modell ohne Schatten (Spiegelbild)
const variantOf = key => {
  const [school, v = ''] = key.split('.'), boss = v && v !== 'm' && v !== 'c' ? v.replace(/-c$/, '') : null;
  return [school, { master: v === 'm', clone: v === 'c' || v.endsWith('-c'), boss }];
};

// Einheit = Variante × Animation × Richtung (das Menü braucht von den Bossen nur „unten“)
function loadUnit(key, anim, dirs = Object.keys(DRAWN)) {
  const [school, opt] = variantOf(key);
  if (!MAGE_OFF['m.' + key]) MAGE_OFF['m.' + key] = castOffsets(school, opt);
  return Promise.all(dirs.map(dir => {
    const id = key + '|' + anim + '|' + dir;
    if (units.has(id)) return units.get(id);
    const m = mirrorOf(dir);
    const jobs = Array.from({ length: MAGE_ANIMS[anim] }, (_, i) => [`m.${key}.${anim}.${dir}.${i + 1}`, m && `m.${key}.${anim}.${m}.${i + 1}`, () => mageSvg(school, dir, anim, i, opt)]);
    const pr = loadFrames(jobs, opt.master || opt.boss ? 2 : 1.25);
    units.set(id, pr);
    return pr;
  }));
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
  // Endlose Nacht: jeder Boss kann kommen; Malvorn (all) ruft frühere Bosse als Schatten
  const st = STAGES[si], ids = st.boss.id === 'random' || BOSSES[st.boss.id].all ? BOSS_IDS : [st.boss.id];
  const out = { mages: new Set(ids.map(bossVariant)), minions: new Set(['rat']) }, seen = new Set();
  for (const id of ids) {
    for (const v of BOSSES[id].variants || []) out.mages.add(v);
    for (const t of BOSSES[id].minions || []) typeNeeds(t, out, seen);
  }
  for (const t of stageTypes(st)) typeNeeds(t, out, seen);
  return out;
}
export const stageMageKeys = si => [...stageNeeds(si).mages];
export function ensureStage(si) {
  const n = stageNeeds(si);
  return Promise.all([...[...n.mages].map(loadVariant), loadMinions([...n.minions]), goblinDone()]);
}
// Menü: je ein Bossbild für die Weltkarte; die laufenden Demo-Magier (Hintergrund der anderen Tabs)
// kommen erst mit loadStagesLater
export const MENU_MAGES = ['fire', 'frost', 'storm', 'toxic', 'shadow', 'light', 'fire.m'];
export async function loadMenuMages() {
  await Promise.all(STAGES.filter(st => !st.endless).map(st => loadUnit(bossVariant(st.boss.id), 'idle', ['down'])));
}
// Alle Stages (für Bot und Tests; im Spiel lädt eine gesperrte Stage erst beim ersten Start)
export async function preloadAllMages() {
  for (let si = 0; si < STAGES.length; si++) await rushing(ensureStage(si));
}

// Diener (Skelett, Geist, Golem, Ratte): n.<art>.<anim>.<richtung>.<n>, nur bei Bedarf geladen
export function loadMinions(kinds) {
  return Promise.all(kinds.map(kind => {
    const id = 'n|' + kind;
    if (units.has(id)) return units.get(id);
    const jobs = [];
    for (const [anim, n] of Object.entries(MINION_ANIMS)) for (const dir of Object.keys(DRAWN)) {
      const m = mirrorOf(dir);
      for (let i = 0; i < n; i++) jobs.push([`n.${kind}.${anim}.${dir}.${i + 1}`, m && `n.${kind}.${anim}.${m}.${i + 1}`, () => minionSvg(kind, dir, anim, i)]);
    }
    const pr = loadFrames(jobs, kind === 'golem' ? 1.5 : 1.25);
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
