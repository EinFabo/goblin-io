'use strict';
/* =====================================================================
   GOBLIN.IO v2 – Survivor.io-artiges Spiel
   Spieler: Goblin · Gegner: 9 Magierarten · 10 Waffen · Goblin-Maschine
   ===================================================================== */

// ---------- Helfer ----------
const $ = s => document.querySelector(s);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[(Math.random() * a.length) | 0];
const fmtTime = t => { t = Math.max(0, Math.floor(t)); return String((t / 60) | 0).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const isTouch = () => window.matchMedia && window.matchMedia('(hover: none)').matches;

// ---------- Speicher ----------
const SAVE_KEY = 'goblinio_save_v1';
let save = { gold: 0, unlocked: 1, cleared: {}, best: {}, shop: {}, mute: false, musicOff: false };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') save = Object.assign(save, s); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------- Sprites ----------
const U = 0.85;
const CACHE = [], SPR = {}, TINT = new Map();
let GRASS_IMG = null;
function svgSize(s) { const p = s.match(/viewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number); return [p[2], p[3]]; }
function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
async function loadAssets() {
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
const TINTS = {
  gold: ['#ffc928', .42], shadow: ['#3b1466', .5], ember: ['#a3140c', .38], rage: ['#ff2a1a', .42],
  storm: ['#ffe23a', .5], toxic: ['#32c22a', .5], void: ['#1e0638', .62], holy: ['#fff7d6', .58],
  voidp: ['#a45cff', .6], toxp: ['#5be03a', .7],
};
function tinted(entry, tint) {
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

// ---------- Prozedurale Grafiken ----------
const PROC = {};
function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; fn(g, w, h); return c; }
const GEM_COL = [['#6fdcff', '#1c9be0', '#06233f'], ['#dc9bff', '#9a45e8', '#2a0b45'], ['#ffd84a', '#ff9a1f', '#4a2800'], ['#ff6d86', '#e0193f', '#40040f']];
function makeProc() {
  PROC.gem = GEM_COL.map(([lt, dk, ol]) => mk(64, 72, g => {
    g.translate(32, 36);
    const gr = g.createRadialGradient(0, 0, 3, 0, 0, 32); gr.addColorStop(0, lt + 'b0'); gr.addColorStop(.6, lt + '30'); gr.addColorStop(1, lt + '00');
    g.fillStyle = gr; g.fillRect(-32, -36, 64, 72);
    const dia = () => { g.beginPath(); g.moveTo(0, -25); g.lineTo(16, -6); g.lineTo(0, 25); g.lineTo(-16, -6); g.closePath(); };
    dia(); g.fillStyle = dk; g.fill(); g.lineWidth = 6; g.strokeStyle = ol; g.stroke();
    g.beginPath(); g.moveTo(0, -25); g.lineTo(16, -6); g.lineTo(0, -1); g.lineTo(-16, -6); g.closePath(); g.fillStyle = lt; g.fill();
    g.beginPath(); g.moveTo(0, -1); g.lineTo(-16, -6); g.lineTo(0, 25); g.closePath(); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
    g.beginPath(); g.moveTo(-7, -14); g.lineTo(-2, -20); g.lineTo(1, -13); g.closePath(); g.fillStyle = '#fff'; g.fill();
    dia(); g.lineWidth = 3.5; g.strokeStyle = ol; g.stroke();
  }));
  PROC.gear = mk(56, 56, g => {
    g.translate(28, 28);
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 17 : 24; g.lineTo(Math.cos(a - .12) * r, Math.sin(a - .12) * r); g.lineTo(Math.cos(a + .12) * r, Math.sin(a + .12) * r); }
    g.closePath(); g.fillStyle = '#a9b2ba'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#141a20'; g.stroke();
    g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fillStyle = '#d0d7dd'; g.fill(); g.lineWidth = 2.5; g.stroke();
    g.beginPath(); g.arc(0, 0, 5.5, 0, TAU); g.fillStyle = '#2a3036'; g.fill();
    g.beginPath(); g.arc(-6, -7, 3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill();
  });
  PROC.bone = mk(80, 80, g => {
    g.translate(40, 40);
    const path = () => { g.beginPath(); g.arc(-14, 0, 26, -1.05, 1.05); };
    path(); g.lineWidth = 15; g.strokeStyle = '#1c140c'; g.stroke();
    path(); g.lineWidth = 9; g.strokeStyle = '#f2e8cc'; g.stroke();
    for (const s of [-1, 1]) {
      const x = -14 + Math.cos(1.05) * 26, y = s * Math.sin(1.05) * 26;
      for (const ox of [-4, 4]) { g.beginPath(); g.arc(x + ox * .9 + 2, y + s * 3, 6, 0, TAU); g.fillStyle = '#f2e8cc'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1c140c'; g.stroke(); }
    }
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-14, 0, 24, -.6, .3); g.stroke();
  });
  PROC.saw = mk(80, 80, g => {
    g.translate(40, 40);
    g.beginPath();
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); g.lineTo(Math.cos(a + .2) * 27, Math.sin(a + .2) * 27); }
    g.closePath(); g.fillStyle = '#c4ccd3'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#11161b'; g.stroke();
    g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fillStyle = '#9aa4ad'; g.fill(); g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fillStyle = '#c9973a'; g.fill(); g.stroke();
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; g.beginPath(); g.arc(Math.cos(a) * 14, Math.sin(a) * 14, 3.5, 0, TAU); g.fillStyle = '#2a3036'; g.fill(); }
    g.beginPath(); g.arc(0, 0, 30, -2.4, -1.4); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke();
  });
  PROC.barrel = mk(60, 72, g => {
    g.translate(30, 40);
    g.beginPath(); g.moveTo(-18, -24); g.quadraticCurveTo(-25, 0, -18, 24); g.lineTo(18, 24); g.quadraticCurveTo(25, 0, 18, -24); g.closePath();
    const gr = g.createLinearGradient(-22, 0, 22, 0); gr.addColorStop(0, '#6b3f1c'); gr.addColorStop(.45, '#b0743a'); gr.addColorStop(1, '#5a3418');
    g.fillStyle = gr; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#1c120a'; g.stroke();
    for (const y of [-14, 14]) { g.beginPath(); g.moveTo(-22, y); g.quadraticCurveTo(0, y + 3, 22, y); g.lineWidth = 5; g.strokeStyle = '#3b3f45'; g.stroke(); }
    g.beginPath(); g.ellipse(0, -24, 18, 5, 0, 0, TAU); g.fillStyle = '#8a5a2e'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1c120a'; g.stroke();
    g.fillStyle = '#e5484d'; g.font = '900 16px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('TNT', 0, 6);
    g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(6, -34, 2, -38); g.lineWidth = 2.5; g.strokeStyle = '#3b2a14'; g.stroke();
  });
}

// ---------- Canvas ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, ZOOM = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ZOOM = clamp(Math.min(W, H) / 640, 0.55, 1.05);
}
window.addEventListener('resize', resize);
function drawSpr(name, x, y, sc = 1, rot = 0, tint = null, alpha = 1, flash = false) {
  const e = SPR[name]; if (!e) return;
  const img = tint ? tinted(e, tint) : e.c;
  const w = e.uw * U * sc, h = e.uh * U * sc;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  if (flash) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .75 * alpha; ctx.drawImage(img, -w / 2, -h / 2, w, h); }
  ctx.restore();
}
function drawImgC(c, x, y, w, rot = 0, alpha = 1) {
  const h = w * c.height / c.width;
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore();
}

// ---------- Stages ----------
const STAGE_LEN = 240;
const STAGES = [
  { name: 'Goblinwiese', sub: 'Feuermagier und erste Funkenwichtel.', tint: null, dark: 0, hp: 1, dmg: 1, rate: 1,
    mix: [['fire', 5, 0], ['imp', 3, 25], ['frost', 1.2, 110], ['bomber', 1, 150]],
    boss: { name: 'Ignaz der Funkenmeister', pre: 'f_', kind: 'fire', tint: null, minion: 'imp' } },
  { name: 'Frostlichtung', sub: 'Frostmagier bremsen dich, Schattenmagier tauchen neben dir auf.', tint: ['#a8d8ff', .5], dark: .05, hp: 1.25, dmg: 1.15, rate: 1.08,
    mix: [['frost', 5, 0], ['imp', 3, 20], ['fire', 1.5, 80], ['void', 1, 60], ['healer', .7, 140]],
    boss: { name: 'Frostbart der Eisweber', pre: 'e_', kind: 'frost', tint: null, minion: 'frost' } },
  { name: 'Aschesteppe', sub: 'Großmagier, Giftmagier und ganze Rudel von Funkenwichteln.', tint: ['#e89a5a', .55], dark: .08, hp: 1.5, dmg: 1.3, rate: 1.16,
    mix: [['fire', 4, 0], ['imp', 3, 15], ['bomber', 2, 30], ['brute', 1.2, 50], ['toxic', 1.2, 100], ['storm', 1, 130]],
    boss: { name: 'Pyra, Herrin der Asche', pre: 'f_', kind: 'fire', tint: 'ember', minion: 'bomber' } },
  { name: 'Nebelmoor', sub: 'Heilmagier halten die Horde am Leben. Erwisch sie zuerst.', tint: ['#7fa597', .6], dark: .2, hp: 1.8, dmg: 1.45, rate: 1.24,
    mix: [['fire', 2, 0], ['frost', 2, 0], ['imp', 4, 10], ['toxic', 2, 30], ['void', 2, 40], ['healer', 1, 80], ['brute', 1.2, 60], ['storm', 1.5, 90]],
    boss: { name: 'Der Nebelhexer', pre: 'e_', kind: 'frost', tint: 'shadow', minion: 'void' } },
  { name: 'Turm der Magier', sub: 'Blitzmagier und alles andere auf einmal. Der Erzmagier wartet.', tint: ['#9b7ad0', .6], dark: .26, hp: 2.1, dmg: 1.6, rate: 1.32,
    mix: [['fire', 2, 0], ['frost', 2, 0], ['imp', 3, 0], ['storm', 2.5, 20], ['void', 1.5, 40], ['healer', 1, 60], ['brute', 2, 40], ['bomber', 1.5, 30], ['toxic', 1.5, 60]],
    boss: { name: 'Erzmagier Malvorn', pre: 'f_', kind: 'both', tint: 'gold', minion: 'healer' } },
  { name: 'Endlose Nacht', sub: 'Kein Ende, alle 4 Minuten ein Boss. Wie lange hältst du durch?', tint: ['#5a6cb0', .62], dark: .32, hp: 2.3, dmg: 1.7, rate: 1.4, endless: true,
    mix: [['fire', 2, 0], ['frost', 2, 0], ['imp', 3, 0], ['storm', 2, 0], ['void', 1.5, 0], ['healer', 1, 0], ['brute', 2, 0], ['bomber', 1.5, 0], ['toxic', 1.5, 0]],
    boss: { name: 'Erzmagier Malvorn', pre: 'f_', kind: 'both', tint: 'gold', minion: 'bomber' } },
];
const TILE_CACHE = [];
function stageTile(i) {
  if (TILE_CACHE[i]) return TILE_CACHE[i];
  const st = STAGES[i];
  const c = mk(574, 431, g => {
    if (GRASS_IMG) g.drawImage(GRASS_IMG, 0, 0, 574, 431); else { g.fillStyle = '#5fae3a'; g.fillRect(0, 0, 574, 431); }
    if (st.tint) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = st.tint[1]; g.fillStyle = st.tint[0]; g.fillRect(0, 0, 574, 431); }
    if (st.dark) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = st.dark; g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, 574, 431); }
  });
  TILE_CACHE[i] = { c, pat: null };
  return TILE_CACHE[i];
}

// ---------- Waffen & Passive ----------
const WEAPONS = {
  dagger: { name: 'Wurfdolch', evo: 'Dolchsturm', with: 'whet',
    info: ['Wirft Dolche auf den nächsten Gegner.', '+1 Dolch', '+40 % Schaden', '+1 Dolch, durchbohrt einen Gegner', '+1 Dolch, wirft schneller'],
    evoInfo: 'Ein Dolchkranz fliegt in alle Richtungen und durchbohrt alles.' },
  orbit: { name: 'Klingenkreis', evo: 'Klingensturm', with: 'amulet',
    info: ['Zwei Dolche kreisen um dich.', '+1 Klinge', '+50 % Schaden, größerer Kreis', '+1 Klinge', '+1 Klinge, dreht schneller'],
    evoInfo: 'Acht Klingen rasen in einem weiten Kreis und stoßen Gegner weg.' },
  fireball: { name: 'Feuerball', evo: 'Meteorregen', with: 'book',
    info: ['Gestohlener Magierzauber. Explodiert beim Treffer.', '+25 % Schaden, größere Explosion', '+1 Feuerball', '+25 % Schaden, schneller', '+1 Feuerball, riesige Explosion'],
    evoInfo: 'Meteore schlagen ein und hinterlassen brennenden Boden.' },
  spear: { name: 'Eisspeer', evo: 'Gletscherzorn', with: 'armor',
    info: ['Schießt in Laufrichtung, durchbohrt und verlangsamt.', '+1 Speer', '+30 % Schaden, durchbohrt mehr', '+1 Speer', '+40 % Schaden, schneller'],
    evoInfo: 'Speerfächer plus regelmäßige Frostnova, die Gegner einfriert.' },
  bolt: { name: 'Blitzstab', evo: 'Gewittersturm', with: 'boots',
    info: ['Blitze treffen zufällige Gegner.', '+1 Blitz', 'Blitze springen auf einen Nachbarn über', '+1 Blitz, +20 % Schaden', '+1 Blitz, springt weiter'],
    evoInfo: 'Ein Gewitter: viele Blitze, die zwischen Gegnern hin und her springen.' },
  poison: { name: 'Giftflasche', evo: 'Seuchenwolke', with: 'herbs',
    info: ['Wirft Goblin-Gift, das eine Pfütze bildet.', 'Größere Pfütze, mehr Schaden', '+1 Flasche', 'Pfütze hält länger', '+1 Flasche, mehr Schaden'],
    evoInfo: 'Eine Giftwolke umgibt dich dauerhaft, dazu große Pfützen.' },
  boomer: { name: 'Knochenbumerang', evo: 'Knochenwirbel', with: 'magnet',
    info: ['Fliegt raus und kommt zurück. Trifft auf beiden Wegen.', '+30 % Schaden', '+1 Bumerang', 'Fliegt weiter, +20 % Schaden', '+1 Bumerang'],
    evoInfo: 'Vier riesige Knochen wirbeln in alle Richtungen und zurück.' },
  barrel: { name: 'Sprengfass', evo: 'Großfeuerwerk', with: 'powder',
    info: ['Wirft ein TNT-Fass, das nach kurzer Zündung explodiert.', '+25 % Schaden', '+1 Fass', 'Größere Explosion', '+1 Fass, schneller'],
    evoInfo: 'Jede Explosion verstreut fünf weitere Mini-Bomben.' },
  saw: { name: 'Kreissäge', evo: 'Sägesturm', with: 'oil',
    info: ['Sägeblatt prallt vom Bildschirmrand ab.', 'Fliegt länger, +20 % Schaden', '+1 Sägeblatt', '+30 % Schaden', '+1 Sägeblatt, fliegt länger'],
    evoInfo: 'Vier riesige Sägen kreischen über den ganzen Bildschirm.' },
  gang: { name: 'Goblin-Bande', evo: 'Goblin-Horde', with: 'heart',
    info: ['Ein Goblin-Kumpel kämpft an deiner Seite.', '+1 Kumpel', '+50 % Schaden', '+1 Kumpel', '+1 Kumpel, schneller'],
    evoInfo: 'Sieben wilde Goblins stürmen los und stechen alles nieder.' },
};
const PASSIVES = {
  whet: { name: 'Wetzstein', info: '+12 % Schaden' },
  book: { name: 'Zauberbuch', info: '−8 % Abklingzeit' },
  amulet: { name: 'Wirbelamulett', info: '+12 % Reichweite und Fläche' },
  armor: { name: 'Lederrüstung', info: '−7 % erlittener Schaden' },
  heart: { name: 'Herzwurzel', info: '+20 max. Leben' },
  herbs: { name: 'Heilkräuter', info: '+0,4 Leben pro Sekunde' },
  boots: { name: 'Flinke Stiefel', info: '+8 % Lauftempo' },
  magnet: { name: 'Magnetstein', info: '+35 % Sammelradius' },
  oil: { name: 'Ölkanne', info: '+12 % Geschosstempo und Flugdauer' },
  powder: { name: 'Schwarzpulver', info: '+6 % kritische Treffer' },
};
const SHOP = [
  { id: 'atk', icon: 'whet', name: 'Scharfe Klingen', desc: '+6 % Schaden', max: 10, base: 40 },
  { id: 'hp', icon: 'heart', name: 'Dicke Haut', desc: '+12 max. Leben', max: 10, base: 40 },
  { id: 'spd', icon: 'boots', name: 'Flinke Füße', desc: '+4 % Lauftempo', max: 5, base: 60 },
  { id: 'mag', icon: 'magnet', name: 'Gierige Finger', desc: '+12 % Sammelradius', max: 5, base: 50 },
  { id: 'xp', icon: 'gem', name: 'Goblin-Schläue', desc: '+6 % Erfahrung', max: 5, base: 70 },
  { id: 'stam', icon: 'dash', name: 'Zähe Lunge', desc: '+15 % Ausdauer', max: 5, base: 50 },
  { id: 'ult', icon: 'rage', name: 'Kurze Zündschnur', desc: 'Goblin-Wut lädt 10 % schneller', max: 5, base: 80 },
  { id: 'mech', icon: 'mech', name: 'Goblin-Ingenieur', desc: 'Maschine hält 1,5 s länger', max: 5, base: 90 },
  { id: 'reroll', icon: 'dice', name: 'Gezinkte Würfel', desc: '+1 Neu-Würfeln pro Lauf', max: 3, base: 120 },
];
const shopCost = (s, lv) => Math.round(s.base * Math.pow(lv + 1, 1.45));

// ---------- Gegner-Typen ----------
const ETYPES = {
  fire: { name: 'Feuermagier', tip: 'Glühender Stab = gleich kommt ein Feuerball.', hp: 8, spd: 56, dmg: 6, r: 15, sc: 1, cast: 'fire', cd: [5, 9], range: 360, xp: 2 },
  frost: { name: 'Frostmagier', tip: 'Eisspeere verlangsamen dich.', hp: 9, spd: 50, dmg: 5, r: 15, sc: 1, cast: 'frost', cd: [5.5, 9.5], range: 350, xp: 2 },
  imp: { name: 'Schattenlehrling', tip: 'Schnell, aber schwach.', hp: 4, spd: 92, dmg: 4, r: 11, sc: .7, tint: 'shadow', xp: 1 },
  brute: { name: 'Großmagier', tip: 'Schießt drei Feuerbälle auf einmal.', hp: 60, spd: 38, dmg: 12, r: 22, sc: 1.45, tint: 'ember', cast: 'fire3', cd: [5, 8], range: 400, xp: 8 },
  storm: { name: 'Blitzmagier', tip: 'Raus aus dem gelben Kreis!', hp: 10, spd: 48, dmg: 9, r: 15, sc: 1.05, tint: 'storm', cast: 'storm', cd: [5.5, 8.5], range: 430, xp: 3 },
  toxic: { name: 'Giftmagier', tip: 'Wirft Giftpfützen. Nicht reinlaufen.', hp: 11, spd: 46, dmg: 5, r: 15, sc: 1.05, tint: 'toxic', cast: 'toxic', cd: [6, 9], range: 380, xp: 3 },
  void: { name: 'Schattenmagier', tip: 'Teleportiert sich direkt neben dich.', hp: 9, spd: 40, dmg: 7, r: 15, sc: 1, tint: 'void', cast: 'blink', cd: [4, 6.5], range: 600, xp: 3 },
  healer: { name: 'Heilmagier', tip: 'Heilt andere Magier. Zuerst erledigen!', hp: 14, spd: 44, dmg: 4, r: 15, sc: 1.05, tint: 'holy', cast: 'heal', cd: [4, 6], range: 9999, xp: 4, keep: 230 },
  bomber: { name: 'Funkenwichtel', tip: 'Explodiert neben dir. Früh erledigt, sprengt er andere Magier.', hp: 6, spd: 108, dmg: 0, r: 12, sc: .75, tint: 'ember', xp: 2, bomber: true },
};
const CHARGE = { fire: .75, frost: .75, fire3: .9, storm: .8, toxic: .8, blink: .55, void: .45, heal: .9 };
const CCOL = { fire: '#ff8a1f', fire3: '#ff5a1f', frost: '#7fd8ff', storm: '#ffe45c', toxic: '#7be04a', blink: '#b26bff', void: '#b26bff', heal: '#9dff9a' };
const AIMED = { fire: 1, fire3: 1, frost: 1, void: 1 };
const OFF = { down: [-6.7, 21.1], up: [25.4, -28.3], left: [-33.9, -1.6], right: [33.9, -1.6] };
const faceOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');

// ---------- Icons ----------
const ICON = {};
function icon(id) {
  if (ICON[id]) return ICON[id];
  const evo = id.endsWith('_evo'); const base = evo ? id.slice(0, -4) : id;
  const c = mk(96, 96, g => {
    g.translate(48, 48); g.scale(1.5, 1.5);
    const spr = (name, x, y, w, rot = 0) => { const e = SPR[name]; if (!e) return; const h = w * e.c.height / e.c.width; g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(e.c, -w / 2, -h / 2, w, h); g.restore(); };
    const img = (cc, x, y, w, rot = 0) => { const h = w * cc.height / cc.width; g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(cc, -w / 2, -h / 2, w, h); g.restore(); };
    if (evo) { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 32); gr.addColorStop(0, 'rgba(255,220,90,.85)'); gr.addColorStop(1, 'rgba(255,200,40,0)'); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); }
    const st = (fill, stroke = '#0a0f06', lw = 2.5) => { g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); };
    switch (base) {
      case 'dagger': spr('dagger', 0, 0, 58, -Math.PI / 4); if (evo) { spr('dagger', -8, 10, 40, -Math.PI / 2.4); spr('dagger', 10, -6, 40, -Math.PI / 6); } break;
      case 'orbit':
        g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < (evo ? 6 : 3); i++) { const a = i * TAU / (evo ? 6 : 3); spr('dagger', Math.cos(a) * 18, Math.sin(a) * 18, 30, a + Math.PI / 2); }
        break;
      case 'fireball': spr('f_fireball_2', 0, 0, 62, -Math.PI / 4); if (evo) spr('f_fireball_3', -14, 14, 34, -Math.PI / 4); break;
      case 'spear': spr('e_frostbolt_2', 0, 0, 64, -Math.PI / 4); if (evo) { g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.strokeStyle = '#bff0ff'; g.lineWidth = 3; g.stroke(); } break;
      case 'bolt':
        g.beginPath(); g.moveTo(6, -28); g.lineTo(-12, 2); g.lineTo(-1, 2); g.lineTo(-8, 28); g.lineTo(14, -6); g.lineTo(3, -6); g.lineTo(12, -28); g.closePath(); st('#ffe45c');
        if (evo) { g.beginPath(); g.moveTo(-20, -20); g.lineTo(-26, -6); g.lineTo(-18, -8); g.lineTo(-22, 6); g.lineWidth = 3; g.strokeStyle = '#fff6b0'; g.stroke(); }
        break;
      case 'poison':
        if (evo) { g.beginPath(); g.arc(0, 2, 28, 0, TAU); g.fillStyle = 'rgba(120,220,60,.35)'; g.fill(); }
        g.beginPath(); g.arc(0, 8, 15, 0, TAU); st('#7be04a');
        g.beginPath(); g.rect(-5, -18, 10, 14); st('#cfe8c0');
        g.beginPath(); g.rect(-6, -24, 12, 7); st('#8a5a32');
        g.beginPath(); g.arc(-5, 4, 3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        break;
      case 'boomer': img(PROC.bone, 2, 0, 58, -.5); if (evo) img(PROC.bone, -8, 8, 36, 1.8); break;
      case 'barrel': img(PROC.barrel, 0, 2, 44); if (evo) { g.fillStyle = '#ffd84a'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - 1.2; g.beginPath(); g.arc(Math.cos(a) * 24, Math.sin(a) * 24, 3.5, 0, TAU); g.fill(); } } break;
      case 'saw': img(PROC.saw, 0, 0, 56); if (evo) img(PROC.saw, 14, 14, 30); break;
      case 'gang': spr('idle_down_2', 9, 4, 48); spr('idle_down_1', -9, -2, 54); if (evo) spr('idle_down_3', 0, 10, 40); break;
      case 'whet':
        g.save(); g.rotate(-0.5); g.beginPath(); g.roundRect(-24, -9, 48, 18, 6); st('#8d969c'); g.beginPath(); g.rect(-24, 0, 48, 9); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); g.restore();
        g.strokeStyle = '#fff6b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, -24); g.lineTo(18, -16); g.moveTo(24, -18); g.lineTo(18, -14); g.stroke();
        break;
      case 'book':
        g.beginPath(); g.roundRect(-18, -22, 36, 44, 4); st('#7b3fc4');
        g.beginPath(); g.rect(-18, -22, 7, 44); g.fillStyle = '#f4d03f'; g.fill();
        g.beginPath(); g.arc(4, 0, 8, 0, TAU); g.strokeStyle = '#f4d03f'; g.lineWidth = 2.5; g.stroke();
        break;
      case 'amulet':
        g.beginPath(); g.arc(0, -10, 20, Math.PI * 0.1, Math.PI * 0.9, true); g.strokeStyle = '#c9a227'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(0, 10, 14, 0, TAU); st('#f4d03f');
        g.beginPath(); g.arc(0, 10, 7, 0, TAU); st('#46b4ff', '#0a0f06', 2);
        break;
      case 'armor':
        g.beginPath(); g.moveTo(0, -24); g.lineTo(20, -16); g.lineTo(18, 6); g.quadraticCurveTo(12, 20, 0, 26); g.quadraticCurveTo(-12, 20, -18, 6); g.lineTo(-20, -16); g.closePath(); st('#8a5a32');
        g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 20); g.strokeStyle = '#5a3a22'; g.lineWidth = 3; g.stroke();
        break;
      case 'heart': case 'heal':
        g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-30, 2, -20, -26, 0, -10); g.bezierCurveTo(20, -26, 30, 2, 0, 22); st('#e5484d');
        g.beginPath(); g.arc(-9, -6, 4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
        break;
      case 'herbs':
        for (const [a, col] of [[-0.6, '#6fc23a'], [0.6, '#4f9a2a'], [0, '#8ad94f']]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -10, 8, 16, 0, 0, TAU); st(col); g.restore(); }
        g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 24); g.strokeStyle = '#3b6b1d'; g.lineWidth = 3; g.stroke();
        break;
      case 'boots':
        g.beginPath(); g.moveTo(-12, -24); g.lineTo(6, -24); g.lineTo(6, 4); g.lineTo(22, 10); g.quadraticCurveTo(26, 22, 14, 22); g.lineTo(-14, 22); g.closePath(); st('#8a5a32');
        g.beginPath(); g.moveTo(-14, 14); g.lineTo(24, 14); g.strokeStyle = '#3b2414'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#e8f6ff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-26, -8); g.lineTo(-17, -8); g.moveTo(-28, 2); g.lineTo(-17, 2); g.stroke();
        break;
      case 'magnet':
        g.lineWidth = 12; g.strokeStyle = '#0a0f06'; g.beginPath(); g.arc(0, 0, 15, Math.PI, 0); g.lineTo(15, 18); g.moveTo(-15, 0); g.lineTo(-15, 18); g.stroke();
        g.lineWidth = 8; g.strokeStyle = '#e5484d'; g.beginPath(); g.arc(0, 0, 15, Math.PI, 0); g.lineTo(15, 12); g.moveTo(-15, 0); g.lineTo(-15, 12); g.stroke();
        g.strokeStyle = '#d6dde2'; g.beginPath(); g.moveTo(15, 12); g.lineTo(15, 18); g.moveTo(-15, 12); g.lineTo(-15, 18); g.stroke();
        break;
      case 'oil':
        g.beginPath(); g.roundRect(-16, -8, 30, 28, 4); st('#3f7a3a');
        g.beginPath(); g.moveTo(10, -6); g.lineTo(26, -20); g.lineTo(28, -16); g.lineTo(14, 0); g.closePath(); st('#8d969c');
        g.beginPath(); g.roundRect(-10, -16, 14, 9, 2); st('#8d969c');
        g.beginPath(); g.arc(28, -10, 3.5, 0, TAU); g.fillStyle = '#1a1a1a'; g.fill();
        break;
      case 'powder':
        g.beginPath(); g.moveTo(-16, -6); g.quadraticCurveTo(-20, 22, 0, 22); g.quadraticCurveTo(20, 22, 16, -6); g.closePath(); st('#5a4632');
        g.beginPath(); g.moveTo(-8, -6); g.lineTo(-6, -16); g.lineTo(6, -16); g.lineTo(8, -6); g.closePath(); st('#3d2e20');
        g.fillStyle = '#e5484d'; g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('☠', 0, 12);
        g.fillStyle = '#ffd84a'; for (const [x, y] of [[10, -20], [16, -14], [4, -24]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
        break;
      case 'gem': img(PROC.gem[0], 0, 0, 52); break;
      case 'gear': img(PROC.gear, 0, 0, 50); break;
      case 'rage':
        g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 12 : 26; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); st('#ff6a3d');
        g.beginPath(); g.arc(0, 0, 9, 0, TAU); st('#ffd84a', '#0a0f06', 2);
        break;
      case 'dash':
        g.strokeStyle = '#bff0ff'; g.lineWidth = 4;
        for (const [y, l] of [[-12, 18], [0, 26], [12, 18]]) { g.beginPath(); g.moveTo(-24, y); g.lineTo(-24 + l, y); g.stroke(); }
        g.beginPath(); g.moveTo(4, -16); g.lineTo(24, 0); g.lineTo(4, 16); g.closePath(); st('#7fd8ff');
        break;
      case 'mech':
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 9, 6); g.lineTo(s * 13, 16); g.lineTo(s * 10, 26); g.lineWidth = 6; g.strokeStyle = '#0a0f06'; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#6d747c'; g.stroke(); }
        g.beginPath(); g.roundRect(-20, -12, 40, 22, 5); st('#c9973a');
        g.beginPath(); g.rect(-24, -24, 7, 14); st('#4a4f57');
        g.beginPath(); g.rect(16, -4, 14, 6); st('#4a4f57');
        g.beginPath(); g.arc(0, -16, 9, Math.PI, 0); st('#6fc23a');
        g.fillStyle = '#0a0f06'; g.beginPath(); g.arc(-3, -18, 1.8, 0, TAU); g.arc(3, -18, 1.8, 0, TAU); g.fill();
        g.fillStyle = '#6b4a12'; for (const x of [-14, -6, 6, 14]) { g.beginPath(); g.arc(x, 4, 1.8, 0, TAU); g.fill(); }
        break;
      case 'dice':
        g.beginPath(); g.roundRect(-20, -20, 40, 40, 8); st('#f2f6e6');
        g.fillStyle = '#0a0f06'; for (const [x, y] of [[-9, -9], [9, 9], [0, 0], [9, -9], [-9, 9]]) { g.beginPath(); g.arc(x, y, 3.6, 0, TAU); g.fill(); }
        break;
      case 'gold': case 'coin':
        g.beginPath(); g.arc(0, 0, 20, 0, TAU); st('#f4d03f', '#6b4a07', 3);
        g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.strokeStyle = '#c9a227'; g.lineWidth = 2.5; g.stroke();
        g.beginPath(); g.arc(-7, -7, 4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        break;
      case 'bomb':
        g.beginPath(); g.arc(0, 4, 18, 0, TAU); st('#2b2f36');
        g.beginPath(); g.moveTo(8, -12); g.quadraticCurveTo(16, -24, 22, -20); g.strokeStyle = '#c9a227'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(23, -21, 4, 0, TAU); g.fillStyle = '#ff9a2e'; g.fill();
        g.beginPath(); g.arc(-6, -3, 5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill();
        break;
      case 'chest':
        g.beginPath(); g.roundRect(-22, -10, 44, 28, 3); st('#8a5a32');
        g.beginPath(); g.moveTo(-22, -10); g.quadraticCurveTo(0, -30, 22, -10); g.closePath(); st('#a86d3c');
        g.fillStyle = '#f4d03f'; g.fillRect(-22, -4, 44, 5); g.beginPath(); g.roundRect(-5, -6, 10, 12, 2); st('#f4d03f', '#0a0f06', 2);
        break;
    }
  });
  ICON[id] = c.toDataURL(); ICON[id + '#c'] = c;
  return ICON[id];
}
const iconCanvas = id => { icon(id); return ICON[id + '#c']; };

// ---------- Ton & Musik ----------
let AC = null, sfxBus = null, musBus = null, noiseBuf = null;
const lastS = {};
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
    sfxBus = AC.createGain(); sfxBus.gain.value = save.mute ? 0 : .5; sfxBus.connect(comp);
    musBus = AC.createGain(); musBus.gain.value = save.musicOff ? 0 : .3; musBus.connect(comp);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (mode === 'play' && run && !run.paused) Music.start();
  } catch (e) { AC = null; }
}
function thr(k, ms) { const n = performance.now(); if (lastS[k] && n - lastS[k] < ms) return false; lastS[k] = n; return true; }
function tone(f0, f1, dur, type = 'square', vol = .1, delay = 0, bus = null, attack = .004) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + .03);
}
function noise(dur, vol, freq, type = 'lowpass', delay = 0, bus = null, q = 1, f1 = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
}
let gemCombo = 0, gemComboT = 0;
const sfx = {
  hit() { if (thr('hit', 40)) { noise(.045, .09, 2200, 'bandpass', 0, null, 1.5); tone(180, 90, .05, 'sine', .07); } },
  kill() { thr('kill', 55) && (tone(520, 160, .09, 'triangle', .06), noise(.07, .05, 900, 'bandpass')); },
  gem() {
    if (!thr('gem', 28)) return;
    const n = Math.min(gemCombo, 24), f = 760 * Math.pow(2, n / 12);
    tone(f, 0, .09, 'sine', .07); tone(f * 2, 0, .06, 'triangle', .025, .01);
    gemCombo++; gemComboT = .55;
  },
  coin() { thr('coin', 60) && (tone(1320, 0, .05, 'square', .035), tone(1760, 0, .09, 'square', .035, .05)); },
  gear() { thr('gear', 70) && (noise(.05, .08, 3000, 'bandpass', 0, null, 4), tone(440, 330, .07, 'square', .03)); },
  throw() { thr('thr', 90) && noise(.07, .05, 2500, 'bandpass', 0, null, 1, 5000); },
  whoosh() { thr('who', 120) && noise(.16, .06, 600, 'bandpass', 0, null, 1, 2400); },
  cast() { thr('cast', 140) && tone(320, 760, .14, 'triangle', .035); },
  charge() { thr('chg', 220) && tone(180, 620, .55, 'sine', .022, 0, null, .2); },
  ezap() { thr('ezap', 120) && (noise(.25, .14, 4000, 'highpass'), tone(900, 120, .2, 'sawtooth', .04)); },
  boom() { if (thr('boom', 70)) { noise(.4, .25, 900, 'lowpass', 0, null, 1, 120); tone(120, 40, .3, 'sine', .14); } },
  zap() { thr('zap', 70) && tone(1500, 180, .12, 'sawtooth', .045); },
  frost() { thr('frost', 120) && (tone(2400, 1100, .12, 'sine', .035), tone(3200, 0, .05, 'triangle', .02, .03)); },
  hurt() { thr('hurt', 120) && (tone(260, 90, .2, 'square', .09), noise(.1, .1, 700)); },
  dash() { noise(.2, .12, 500, 'bandpass', 0, null, 1, 3000); },
  lvl() { [523, 659, 784, 1046, 1318].forEach((f, i) => { tone(f, 0, .18, 'triangle', .08, i * .06); tone(f * 2, 0, .1, 'sine', .03, i * .06 + .02); }); },
  cards() { noise(.25, .06, 800, 'bandpass', 0, null, 1, 4000); },
  pickCard() { tone(660, 0, .08, 'triangle', .08); tone(990, 0, .14, 'triangle', .08, .07); tone(1320, 0, .2, 'sine', .05, .14); },
  chest() { [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0, .16, 'square', .045, i * .055)); },
  ult() { noise(.8, .3, 1200, 'lowpass', 0, null, 1, 80); tone(110, 40, .8, 'sawtooth', .12); tone(220, 55, .6, 'square', .06, .05); },
  warn() { tone(196, 0, .35, 'sawtooth', .07); tone(185, 0, .35, 'sawtooth', .07, .4); },
  heal() { tone(600, 1200, .25, 'sine', .07); tone(900, 1800, .2, 'sine', .04, .08); },
  eheal() { thr('eheal', 200) && tone(700, 1100, .2, 'sine', .03); },
  fuse() { thr('fuse', 150) && noise(.7, .05, 5000, 'highpass'); },
  death() { tone(400, 60, .9, 'sawtooth', .1); noise(.6, .1, 500); },
  mechOn() { [196, 262, 330, 392].forEach((f, i) => tone(f, 0, .15, 'square', .06, i * .07)); noise(.5, .15, 300, 'lowpass', .25); },
  stomp() { thr('stomp', 150) && (tone(90, 40, .18, 'sine', .14), noise(.12, .08, 300)); },
  gun() { thr('gun', 70) && (noise(.04, .07, 1800, 'bandpass', 0, null, 2), tone(160, 80, .04, 'square', .03)); },
  rocket() { thr('rocket', 120) && noise(.3, .06, 1200, 'bandpass', 0, null, 1, 300); },
  buzz() { tone(110, 0, .15, 'square', .06); },
  hover() { thr('hov', 45) && tone(1700 + Math.random() * 200, 1300, .035, 'sine', .028); },
  hoverCard() { thr('hovc', 80) && (tone(1200, 0, .05, 'triangle', .03), tone(1800, 0, .07, 'sine', .022, .04)); },
  click() { tone(520, 0, .05, 'square', .04); noise(.02, .06, 3000, 'highpass'); },
  buy() { [880, 1175, 1568].forEach((f, i) => tone(f, 0, .1, 'square', .04, i * .05)); },
};
// Musik: kleine Goblin-Polka in a-Moll, beim Boss schneller und düsterer
const MEL = [[0, null, 3, null, 5, null, 7, 5, 3, null, 0, null, -2, null, 0, null], [5, null, 7, null, 10, null, 7, 5, 3, null, 5, null, 3, null, null, null],
  [7, null, 7, 10, 12, null, 10, 7, 5, null, 3, null, 5, null, 7, null], [5, 3, 0, null, -2, null, 0, null, 3, null, 0, null, null, null, null, null]];
const Music = {
  timer: null, next: 0, step: 0, boss: false,
  start() { if (!AC || this.timer || save.musicOff) return; this.next = AC.currentTime + .08; this.timer = setInterval(() => this.tick(), 25); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  tick() {
    if (!AC) return;
    const spb = 60 / (this.boss ? 138 : 116) / 4;
    while (this.next < AC.currentTime + .12) { this.play(this.step, Math.max(0, this.next - AC.currentTime)); this.next += spb; this.step++; }
  },
  play(step, d) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, B = musBus;
    const roots = this.boss ? [110, 116.54, 110, 103.83] : [110, 87.31, 130.81, 98];
    const r = roots[bar];
    if (s % 4 === 0) tone(150, 42, .16, 'sine', .55, d, B, .002);
    if (s === 4 || s === 12) noise(.12, .22, 1700, 'bandpass', d, B, .8);
    if (s % 2 === 0) noise(.03, s % 4 === 2 ? .08 : .04, 7500, 'highpass', d, B);
    if (this.boss && s % 2 === 1) noise(.02, .03, 9000, 'highpass', d, B);
    if (s % 2 === 0) tone(r * (s % 4 === 0 ? 1 : 1.5), 0, .17, 'triangle', .22, d, B, .005);
    if (s % 4 === 2) { tone(r * 2, 0, .1, 'square', .025, d, B); tone(r * 2.52, 0, .1, 'square', .02, d, B); }
    if (Math.floor(step / 64) % 2 === 1) { const n = MEL[bar][s]; if (n !== null) tone(440 * Math.pow(2, n / 12), 0, .16, 'square', .035, d, B, .003); }
  },
};
function setMute(m) { save.mute = m; persist(); if (sfxBus) sfxBus.gain.value = m ? 0 : .5; for (const b of [$('#muteBtn'), $('#pMuteBtn')]) b.textContent = 'Ton: ' + (m ? 'aus' : 'an'); }
function setMusic(off) {
  save.musicOff = off; persist(); if (musBus) musBus.gain.value = off ? 0 : .3;
  for (const b of [$('#musicBtn'), $('#pMusicBtn')]) b.textContent = 'Musik: ' + (off ? 'aus' : 'an');
  if (off) Music.stop();
}
// UI-Klänge: Hover und Klick für alle Knöpfe
let lastHover = null;
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const b = e.target.closest('button'); if (b === lastHover) return; lastHover = b;
  if (!b || b.disabled || b.classList.contains('abil')) return;
  b.classList.contains('card') ? sfx.hoverCard() : sfx.hover();
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  audioInit();
  if (b.classList.contains('card') || b.dataset.buy || b.classList.contains('stage')) return;
  b.disabled ? sfx.buzz() : sfx.click();
}, true);

// ---------- Eingabe ----------
const keys = {};
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
let sprintHeld = false;
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  audioInit();
  if (!run || run.over) return;
  if (e.code === 'Space') { e.preventDefault(); doDash(); }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
  if (e.code === 'KeyQ') doUlt();
  if (e.code === 'KeyF' || e.code === 'KeyE') startMech();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (!$('#pause').hidden) resume(); else if (!run.paused) openPause(); }
  if (!$('#levelup').hidden && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { const b = $('#cards').children[+e.code.slice(5) - 1]; if (b) b.click(); }
  if (!$('#levelup').hidden && e.code === 'KeyR') $('#rerollBtn').click();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (joy.id !== null) return;
  joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const joyEnd = e => { if (e.pointerId === joy.id) joy.id = null; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.id = null; sprintHeld = false; if (run && !run.paused && !run.over) openPause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && run && !run.paused && !run.over) openPause(); });

// ---------- Spielzustand ----------
let run = null, P = null, mode = 'loading';
const grid = new Map(); const CELL = 64;
const gk = (cx, cy) => cx * 100003 + cy;
function buildGrid() {
  grid.clear();
  for (const e of run.enemies) {
    if (e.dead) continue;
    const k = gk(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(e);
  }
}
function query(x, y, r, cb) {
  const m = r + 60;
  const x0 = Math.floor((x - m) / CELL), x1 = Math.floor((x + m) / CELL), y0 = Math.floor((y - m) / CELL), y1 = Math.floor((y + m) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = grid.get(gk(cx, cy)); if (!a) continue;
    for (let i = 0; i < a.length; i++) {
      const e = a[i]; if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, rr = r + e.r;
      if (dx * dx + dy * dy < rr * rr) { if (cb(e) === false) return; }
    }
  }
}
function nearest(maxD = 1e9, from = P) {
  let best = null, bd = maxD * maxD;
  for (const e of run.enemies) { if (e.dead) continue; const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2; if (d < bd) { bd = d; best = e; } }
  return best;
}
function randomEnemyInView(margin = 0) {
  const hw = W / 2 / ZOOM - margin, hh = H / 2 / ZOOM - margin, c = [];
  for (const e of run.enemies) if (!e.dead && Math.abs(e.x - P.x) < hw && Math.abs(e.y - P.y) < hh) c.push(e);
  return c;
}
const viewR = () => Math.hypot(W / 2 / ZOOM, H / 2 / ZOOM);
const onScreen = (x, y, m = 0) => Math.abs(x - P.x) < W / 2 / ZOOM + m && Math.abs(y - P.y) < H / 2 / ZOOM + m;
const xpNeed = l => Math.round(4 + l * 3 + l * l * 0.3);
const pR = () => P.mechT > 0 ? 26 : 16;

function newRun(si) {
  const st = STAGES[si];
  run = {
    si, st, time: 0, kills: 0, gold: 0, enemies: [], eproj: [], pproj: [], items: [], fx: [], parts: [], nums: [], zones: [], tele: [], etele: [], ezones: [], allies: [],
    weapons: [], passives: {}, spawnAcc: 0, ei: 0, events: [], loop: 0, boss: null, arena: null, seen: new Set(), hints: [], hintT: 0,
    rerolls: 2 + (save.shop.reroll || 0), pendingLv: 0, pendingChest: 0, lvDelay: 0, lvKind: 'lv', paused: false, over: false, shake: 0, hurtT: 0, clearT: 0, flashT: 0,
  };
  addEvents(0);
  grid.clear();
  P = { x: 0, y: 0, vx: 0, vy: 0, face: 'down', moving: false, anim: 0, inv: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, aimX: 1, aimY: 0,
    hp: 0, maxHp: 0, lv: 1, xp: 0, need: xpNeed(1), ult: 0, rageT: 0, slowT: 0, trail: [], trailT: 0,
    stam: 100, stamMax: 100, stamDelay: 0, exhaust: false, sprinting: false, leg: 0,
    scrap: 0, mechT: 0, mechMax: 12, gunT: 0, rocketT: 0, stepT: 0, gunA: 0, gunFlash: 0, mechReadyShown: false };
  recalc(); P.hp = P.maxHp; P.stam = P.stamMax;
  addWeapon('dagger');
  mode = 'play';
  showScreen(null);
  $('#hud').hidden = false; $('#ctrl').hidden = false; $('#bossBar').hidden = true; $('#hint').hidden = true;
  $('#stageTxt').textContent = st.name;
  for (const id of ['#levelup', '#pause', '#over']) $(id).hidden = true;
  refreshSlots();
  banner(st.name, '');
  Music.boss = false; Music.start();
  if (si === 0 && !save.cleared[0]) hint(isTouch() ? '<b>Tipp</b> Ziehe irgendwo auf dem Bildschirm zum Laufen. Rechts unten: Rolle, Sprint, Wut und Maschine.' : '<b>Tipp</b> WASD laufen · Leertaste Rolle · Shift Sprint · Q Wut · F Maschine');
}
function addEvents(loop) {
  const o = loop * STAGE_LEN;
  run.events.push({ t: o + 60, k: 'elite' }, { t: o + 120, k: 'elite' }, { t: o + 150, k: 'swarm' }, { t: o + 180, k: 'elite' }, { t: o + 222, k: 'warn' }, { t: o + STAGE_LEN, k: 'boss' });
}
function recalc() {
  const pl = id => run.passives[id] || 0, sh = id => save.shop[id] || 0;
  P.dmgMult = (1 + .12 * pl('whet')) * (1 + .06 * sh('atk'));
  P.cdMult = Math.pow(.92, pl('book'));
  P.area = 1 + .12 * pl('amulet');
  P.armorMult = Math.pow(.93, pl('armor'));
  const old = P.maxHp;
  P.maxHp = 100 + 20 * pl('heart') + 12 * sh('hp');
  if (old) P.hp += Math.max(0, P.maxHp - old);
  P.regen = .4 * pl('herbs');
  P.speed = 165 * (1 + .08 * pl('boots')) * (1 + .04 * sh('spd'));
  P.magnet = 90 * (1 + .35 * pl('magnet')) * (1 + .12 * sh('mag'));
  P.xpMult = 1 + .06 * sh('xp');
  P.ultNeed = Math.round(90 * Math.pow(.9, sh('ult')));
  P.proj = 1 + .12 * pl('oil');
  P.crit = .08 + .06 * pl('powder');
  P.stamMax = 100 * (1 + .15 * sh('stam'));
}
function addWeapon(id) { run.weapons.push({ id, lv: 1, evo: false, t: .3, t2: 0, a: 0, rot: 0, blades: [] }); }
function hint(html) { run.hints.push(html); }

// ---------- Gegner ----------
function spawnEnemy(type, opt = {}) {
  const T = ETYPES[type], st = run.st;
  const tf = 1 + (run.time / 85) * (1 + run.si * .15), lf = 1 + run.loop * 1.2;
  let x = opt.x, y = opt.y;
  if (x === undefined) { const a = Math.random() * TAU, R = viewR() + 60; x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R; }
  const pre = type === 'imp' ? (Math.random() < .5 ? 'f_' : 'e_') : (['frost', 'storm', 'void', 'healer'].includes(type) ? 'e_' : 'f_');
  const e = {
    type, pre, x, y, r: T.r, sc: T.sc, spd: T.spd * rand(.9, 1.1), dmg: T.dmg * st.dmg * (1 + run.time / 400) * lf,
    hp: T.hp * st.hp * tf * lf, cast: T.cast, cd: T.cd, range: T.range, castCd: T.cd ? rand(1.5, T.cd[1]) : 0, xp: T.xp, tint: T.tint || null,
    keep: T.keep || 0, bomber: !!T.bomber, side: Math.random() < .5 ? 1 : -1,
    state: 'walk', face: 'down', at: Math.random() * 5, ft: 0, fired: false, ck: null, charge: 0, chain: null, fuse: 0,
    kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, spr: null, dead: false,
  };
  if (opt.elite) { e.elite = true; e.hp *= 14; e.sc *= 1.6; e.r *= 1.6; e.dmg *= 1.5; e.xp = 30; e.tint = 'gold'; e.spd *= .85; }
  e.maxHp = e.hp;
  run.enemies.push(e);
  if (!run.seen.has(type)) { run.seen.add(type); if (type !== 'fire' || run.si === 0) hint(`<b>${T.name}</b> ${T.tip}`); }
  return e;
}
function spawnBoss() {
  const st = run.st, B = st.boss;
  for (const e of run.enemies) if (!e.dead) { e.dead = true; puff(e.x, e.y, e.sc); dropGem(e.x, e.y, e.xp); }
  run.eproj.length = 0; run.etele.length = 0;
  run.arena = { x: P.x, y: P.y, r: 470 };
  const lf = 1 + run.loop * 1.5;
  const b = {
    type: 'boss', boss: true, pre: B.pre, kind: B.kind, minion: B.minion, name: B.name, x: P.x, y: P.y - 300, r: 38, sc: 2.7, spd: 52, dmg: 18 * st.dmg * lf,
    hp: 2500 * st.hp * lf, xp: 150, tint: B.tint, state: 'walk', face: 'down', at: 0, ft: 0, fired: false, charge: .7, ck: 'fire', kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, dead: false,
    ai: { st: 'chase', t: 2.5, i: 0, atk: null, reps: 0, ring2: 0, ax: 0, ay: 0 },
  };
  b.maxHp = b.hp;
  run.enemies.push(b); run.boss = b;
  $('#bossBar').hidden = false; $('#bossName').textContent = B.name;
  banner(B.name, 'danger'); sfx.warn(); Music.boss = true;
  ring(P.x, P.y, 20, 470, .6, 'rgba(180,120,255,.8)', 8);
}
function doEvent(ev) {
  if (ev.k === 'elite') {
    const types = run.st.mix.filter(m => !['imp', 'bomber'].includes(m[0]) && run.time >= m[2]).map(m => m[0]);
    spawnEnemy(pick(types.length ? types : ['fire']), { elite: true });
    banner('Elite-Magier!', '');
  } else if (ev.k === 'swarm') {
    const n = 36, R = viewR() * .85;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(i % 6 === 0 && run.si > 0 ? 'bomber' : 'imp', { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); }
    banner('Ansturm!', 'danger');
  } else if (ev.k === 'warn') { banner('Der Boss naht …', 'danger'); sfx.warn(); }
  else if (ev.k === 'boss') spawnBoss();
}
function spawnTick(dt) {
  if (run.boss) return;
  const t = run.time - run.loop * STAGE_LEN;
  const rate = (.55 + t * .026 + run.loop * 2) * run.st.rate;
  const cap = Math.min(280, 70 + t * .9 + run.loop * 60);
  run.spawnAcc += rate * dt;
  while (run.spawnAcc >= 1) {
    run.spawnAcc -= 1;
    if (run.enemies.length >= cap) continue;
    const opts = run.st.mix.filter(m => t >= m[2] || run.loop > 0);
    let tot = 0; for (const m of opts) tot += m[1];
    let r = Math.random() * tot, type = opts[0][0];
    for (const m of opts) { r -= m[1]; if (r <= 0) { type = m[0]; break; } }
    spawnEnemy(type);
  }
}
const tipPos = e => { const o = OFF[e.face], s = U * e.sc; return [e.x + o[0] * s, e.y + o[1] * s]; };
function canCast(e) {
  if (e.cast === 'heal') { let ok = false; query(e.x, e.y, 170, o => { if (o !== e && !o.boss && o.hp < o.maxHp * .9) { ok = true; return false; } }); return ok; }
  if (e.cast === 'blink') return Math.hypot(P.x - e.x, P.y - e.y) > 230;
  return run.eproj.length < 5 + run.si * 2 && run.etele.length < 3 + run.si;
}
function startCast(e, kind) {
  e.state = 'cast'; e.ft = 0; e.fired = false; e.ck = kind; e.charge = CHARGE[kind] || .7;
  e.face = faceOf(P.x - e.x, P.y - e.y);
  if (onScreen(e.x, e.y)) sfx.charge();
}
function updEnemy(e, dt) {
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) e.slowT -= dt;
  e.x += e.kx * dt; e.y += e.ky * dt;
  const kd = Math.exp(-9 * dt); e.kx *= kd; e.ky *= kd;
  if (e.freezeT > 0) { e.freezeT -= dt; return; }
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.boss) { bossAI(e, dt, dx, dy, d); return; }
  if (e.bomber) { updBomber(e, dt, dx, dy, d); return; }
  if (e.state === 'cast') {
    e.ft += dt * (e.slowT > 0 ? .6 : 1);
    if (e.ft < e.charge) {
      e.spr = e.pre + 'cast_' + e.face + '_' + (1 + Math.floor(e.ft * 10) % 4);
      if (e.ck !== 'heal' && e.ck !== 'blink') e.face = faceOf(dx, dy);
      if (Math.random() < dt * 25) { const [tx, ty] = tipPos(e), a = Math.random() * TAU; part(tx + Math.cos(a) * 22 * e.sc, ty + Math.sin(a) * 22 * e.sc, -Math.cos(a) * 70, -Math.sin(a) * 70, .28, CCOL[e.ck], 2.5); }
    } else {
      const f = Math.floor((e.ft - e.charge) * 14);
      if (!e.fired) { e.fired = true; enemyAct(e); }
      if (f >= 4) { e.state = 'walk'; e.castCd = rand(e.cd[0], e.cd[1]); if (e.chain) { const k = e.chain; e.chain = null; startCast(e, k); } }
      else e.spr = e.pre + 'cast_' + e.face + '_' + (5 + f);
    }
    return;
  }
  let mx = dx / d, my = dy / d;
  if (e.keep && d < e.keep) { mx = -dx / d * .5 - dy / d * .8 * e.side; my = -dy / d * .5 + dx / d * .8 * e.side; }
  const sp = e.spd * (e.slowT > 0 ? .5 : 1);
  e.x += mx * sp * dt; e.y += my * sp * dt;
  e.face = faceOf(dx, dy); e.at += dt * (e.slowT > 0 ? .5 : 1);
  e.spr = e.pre + 'walk_' + e.face + '_' + ((Math.floor(e.at * 9) % 6) + 1);
  if (e.cast) {
    e.castCd -= dt;
    if (e.castCd <= 0 && d < e.range && onScreen(e.x, e.y, -20)) { if (canCast(e)) startCast(e, e.cast); else e.castCd = .6; }
  }
  if (d > viewR() * 1.9 && !e.elite) { e.x = P.x + dx / d * viewR() * 1.1; e.y = P.y + dy / d * viewR() * 1.1; }
}
function updBomber(e, dt, dx, dy, d) {
  if (e.fuse > 0) {
    e.fuse -= dt; e.spr = e.pre + 'idle_' + e.face + '_' + (1 + Math.floor(e.fuse * 12) % 4);
    if (Math.random() < .5) part(e.x + rand(-6, 6), e.y - 26 * e.sc, rand(-40, 40), rand(-80, -30), .3, '#ffd84a', 2.5);
    if (e.fuse <= 0) bomberBoom(e, true);
    return;
  }
  const sp = e.spd * (e.slowT > 0 ? .5 : 1);
  e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
  e.face = faceOf(dx, dy); e.at += dt;
  e.spr = e.pre + 'walk_' + e.face + '_' + ((Math.floor(e.at * 12) % 6) + 1);
  if (d < 70) { e.fuse = .85; sfx.fuse(); }
  if (d > viewR() * 1.9) { e.x = P.x + dx / d * viewR() * 1.1; e.y = P.y + dy / d * viewR() * 1.1; }
}
function bomberBoom(e, hurtPlayer) {
  if (e.boomed) return; e.boomed = true;
  const R = 80;
  if (hurtPlayer && Math.hypot(P.x - e.x, P.y - e.y) < R + pR()) damagePlayer(14 * run.st.dmg * (1 + run.time / 400));
  e.dead = true;
  query(e.x, e.y, R, o => { if (o !== e) { const d = Math.hypot(o.x - e.x, o.y - e.y) || 1; hurt(o, (25 + run.time * .12) * (hurtPlayer ? .5 : 1.5), 220, (o.x - e.x) / d, (o.y - e.y) / d, '#ffb35c'); } });
  animFx('f_fireball_hit_', 5, e.x, e.y, R / 16); sfx.boom(); run.shake = Math.max(run.shake, 6);
}
function enemyAct(e) {
  const [tx, ty] = tipPos(e);
  const a = Math.atan2(P.y - ty, P.x - tx);
  switch (e.ck) {
    case 'fire': eShot(tx, ty, a, 'fire', e.dmg * .9, 205); break;
    case 'frost': eShot(tx, ty, a, 'frost', e.dmg * .9, 235); break;
    case 'void': eShot(tx, ty, a, 'void', e.dmg, 280); break;
    case 'fire3': for (const o of [-.28, 0, .28]) eShot(tx, ty, a + o, 'fire', e.dmg * .55, 205, 1.2); break;
    case 'storm': run.etele.push({ k: 'strike', x: P.x + P.vx * .4, y: P.y + P.vy * .4, t: .9, dur: .9, r: 50, dmg: e.dmg * 1.2 }); sfx.cast(); break;
    case 'toxic': {
      const lx = P.x + P.vx * .5, ly = P.y + P.vy * .5;
      run.eproj.push({ kind: 'toxic', lob: true, sx: tx, sy: ty, tx: lx, ty: ly, x: tx, y: ty, t: 0, dur: .95, a: 0, vx: 0, vy: 0, life: 2, dmg: e.dmg * .8, sc: 1.1, r: 10, h: 0 });
      sfx.cast(); break;
    }
    case 'blink': {
      puff(e.x, e.y, 1, 'rgba(170,90,255,.8)');
      const ang = Math.random() * TAU, R = rand(150, 210);
      e.x = P.x + Math.cos(ang) * R; e.y = P.y + Math.sin(ang) * R;
      if (run.arena) { const A = run.arena, ddx = e.x - A.x, ddy = e.y - A.y, dd = Math.hypot(ddx, ddy); if (dd > A.r - 40) { e.x = A.x + ddx / dd * (A.r - 40); e.y = A.y + ddy / dd * (A.r - 40); } }
      puff(e.x, e.y, 1.2, 'rgba(170,90,255,.8)'); ring(e.x, e.y, 6, 50, .3, 'rgba(180,110,255,.9)', 4);
      e.chain = 'void'; sfx.whoosh(); break;
    }
    case 'heal': {
      let n = 0;
      query(e.x, e.y, 170, o => { if (o !== e && !o.boss && o.hp < o.maxHp) { const h = o.maxHp * .3; o.hp = Math.min(o.maxHp, o.hp + h); n++; addNum(o.x, o.y - 26, '+' + Math.round(h), '#8dff7a'); for (let i = 0; i < 3; i++) part(o.x + rand(-10, 10), o.y, 0, -60, .5, 'rgba(140,255,130,.9)', 3); } });
      ring(e.x, e.y, 10, 170, .5, 'rgba(140,255,130,.8)', 5); if (n && onScreen(e.x, e.y)) sfx.eheal(); break;
    }
  }
}
function eShot(x, y, a, kind, dmg, sp, sc = 1) {
  run.eproj.push({ x, y, a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, dmg, life: 4.5, t: Math.random(), sc, r: sc * 9 });
}
function bossAI(b, dt, dx, dy, d) {
  const ai = b.ai, enr = b.hp < b.maxHp * .5, sp = enr ? 1.3 : 1;
  const kindNow = () => b.kind === 'both' ? (Math.random() < .5 ? 'fire' : 'frost') : b.kind;
  if (ai.ring2 > 0) { ai.ring2 -= dt; if (ai.ring2 <= 0) bossRing(b, kindNow(), Math.PI / (enr ? 20 : 14)); }
  ai.t -= dt;
  if (ai.st === 'chase') {
    const s = b.spd * sp * (b.slowT > 0 ? .6 : 1);
    b.x += dx / d * s * dt; b.y += dy / d * s * dt;
    b.face = faceOf(dx, dy); b.at += dt;
    b.spr = b.pre + 'walk_' + b.face + '_' + ((Math.floor(b.at * 8) % 6) + 1);
    if (ai.t <= 0) {
      const list = ['ring', 'fan', 'strikes', 'summon', 'charge'];
      ai.atk = list[ai.i++ % list.length];
      if (ai.atk === 'charge') { ai.st = 'tele'; ai.t = .9; ai.ax = dx / d; ai.ay = dy / d; b.face = faceOf(dx, dy); }
      else { ai.st = 'cast'; b.ft = 0; b.fired = false; b.face = faceOf(dx, dy); b.ck = ai.atk === 'strikes' ? 'storm' : ai.atk === 'summon' ? 'blink' : kindNow(); ai.reps = ai.atk === 'fan' ? 2 : 0; sfx.charge(); }
    }
  } else if (ai.st === 'cast') {
    b.ft += dt;
    if (b.ft < b.charge) {
      b.spr = b.pre + 'cast_' + b.face + '_' + (1 + Math.floor(b.ft * 10) % 4);
      if (Math.random() < dt * 40) { const [tx, ty] = tipPos(b), a = Math.random() * TAU; part(tx + Math.cos(a) * 50, ty + Math.sin(a) * 50, -Math.cos(a) * 140, -Math.sin(a) * 140, .32, CCOL[b.ck] || '#fff', 4); }
    } else {
      const f = Math.floor((b.ft - b.charge) * 12);
      b.spr = b.pre + 'cast_' + b.face + '_' + Math.min(8, 5 + f);
      if (!b.fired) {
        b.fired = true;
        const [tx, ty] = tipPos(b);
        if (ai.atk === 'ring') { bossRing(b, b.ck, 0); ai.ring2 = .4; }
        else if (ai.atk === 'fan') {
          const base = Math.atan2(P.y - ty, P.x - tx), n = enr ? 9 : 7;
          for (let i = 0; i < n; i++) eShot(tx, ty, base + (i - (n - 1) / 2) * .14, b.ck, b.dmg * .45, 225, 1.4);
        } else if (ai.atk === 'strikes') {
          const n = enr ? 8 : 5;
          run.etele.push({ k: 'strike', x: P.x, y: P.y, t: 1, dur: 1, r: 60, dmg: b.dmg * .7 });
          for (let i = 1; i < n; i++) { const a = Math.random() * TAU, r = rand(70, 200); run.etele.push({ k: 'strike', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, t: 1 + i * .08, dur: 1 + i * .08, r: 60, dmg: b.dmg * .7 }); }
        } else if (ai.atk === 'summon') {
          const n = enr ? 7 : 5;
          for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(b.minion || 'imp', { x: b.x + Math.cos(a) * 80, y: b.y + Math.sin(a) * 80 }); }
          ring(b.x, b.y, 10, 120, .5, 'rgba(180,120,255,.8)', 6);
        }
      }
      if (f >= 4) {
        if (ai.reps > 0) { ai.reps--; b.ft = b.charge * .6; b.fired = false; b.face = faceOf(dx, dy); }
        else { ai.st = 'chase'; ai.t = 2.2 / sp; }
      }
    }
  } else if (ai.st === 'tele') {
    b.spr = b.pre + 'idle_' + b.face + '_' + ((Math.floor(run.time * 8) % 4) + 1);
    if (ai.t <= 0) { ai.st = 'charge'; ai.t = .75; sfx.whoosh(); }
  } else if (ai.st === 'charge') {
    b.x += ai.ax * 560 * dt; b.y += ai.ay * 560 * dt; b.at += dt * 3;
    b.spr = b.pre + 'walk_' + b.face + '_' + ((Math.floor(b.at * 8) % 6) + 1);
    if (Math.random() < .5) part(b.x + rand(-20, 20), b.y + 30, rand(-30, 30), rand(-30, 0), .4, 'rgba(200,190,170,.7)', 6);
    if (ai.t <= 0) { ai.st = 'chase'; ai.t = 2 / sp; }
  }
}
function bossRing(b, kind, off) {
  const n = b.hp < b.maxHp * .5 ? 20 : 14;
  for (let i = 0; i < n; i++) eShot(b.x, b.y - 10, off + i * TAU / n, kind === 'storm' || kind === 'blink' ? 'void' : kind, b.dmg * .4, 175, 1.35);
}

// ---------- Schaden ----------
function hurt(e, dmg, kb = 0, kx = 0, ky = 0, col = null) {
  if (e.dead) return;
  const crit = Math.random() < P.crit;
  const d = Math.max(1, Math.round(dmg * (crit ? 2 : 1) * rand(.9, 1.1)));
  e.hp -= d; e.flash = .09;
  if (kb && !e.boss) { const m = e.elite ? .25 : 1; e.kx += kx * kb * m; e.ky += ky * kb * m; }
  addNum(e.x, e.y - 22 * e.sc, d, crit ? '#ffd84a' : col || '#ffffff', crit);
  sfx.hit();
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true; run.kills++;
  if (!e.boss) { P.ult = Math.min(P.ultNeed, P.ult + 1); if (P.mechT <= 0) P.scrap = Math.min(100, P.scrap + .35); }
  dropGem(e.x, e.y, e.xp);
  puff(e.x, e.y, e.sc);
  sfx.kill();
  if (e.bomber && !e.boomed) bomberBoom(e, false);
  if (e.elite) { for (let i = 0; i < 8; i++) addItem('coin', e.x, e.y); for (let i = 0; i < 3; i++) addItem('gear', e.x, e.y); addItem('chest', e.x, e.y); }
  else if (!e.boss) {
    const r = Math.random();
    if (r < .05) addItem('coin', e.x, e.y);
    else if (r < .1) addItem('gear', e.x, e.y);
    const r2 = Math.random();
    if (r2 < .006) addItem('heal', e.x, e.y); else if (r2 < .009) addItem('magnet', e.x, e.y); else if (r2 < .0115) addItem('bomb', e.x, e.y);
  }
  if (e.boss) bossDown(e);
}
function bossDown(b) {
  run.boss = null; run.arena = null; Music.boss = false;
  $('#bossBar').hidden = true;
  for (let i = 0; i < 25; i++) addItem('coin', b.x, b.y);
  for (let i = 0; i < 6; i++) setTimeout(() => { if (run && !run.over) { animFx('f_fireball_hit_', 5, b.x + rand(-60, 60), b.y + rand(-60, 60), 3.5); sfx.boom(); } }, i * 150);
  addItem('chest', b.x, b.y);
  run.shake = 18; run.etele.length = 0;
  banner(b.name + ' besiegt!', '');
  if (run.st.endless) { run.loop++; addEvents(run.loop); }
  else run.clearT = 3;
}
function damagePlayer(d) {
  if (P.inv > 0 || P.dashT > 0 || run.over) return;
  d *= P.armorMult * (P.mechT > 0 ? .3 : 1);
  P.hp -= d; P.inv = .5; run.hurtT = .25; run.shake = Math.max(run.shake, 6);
  addNum(P.x, P.y - 40, Math.round(d), '#ff5d55', false);
  sfx.hurt();
  if (P.hp <= 0) { P.hp = 0; gameOver(false); }
}

// ---------- Gegenstände & Effekte ----------
function dropGem(x, y, v) {
  let n = 0; for (const i of run.items) if (i.k === 'gem') n++;
  if (n > 380) { for (const i of run.items) if (i.k === 'gem' && Math.random() < .05) { i.v += v; return; } }
  addItem('gem', x, y, v);
}
function addItem(k, x, y, v = 1) {
  const a = Math.random() * TAU, s = k === 'chest' ? rand(0, 20) : rand(40, 130);
  run.items.push({ k, x, y, v, mag: false, sp: 0, t: Math.random() * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: .01, vz: rand(170, 260) });
}
function addNum(x, y, v, c, crit) { if (run.nums.length > 90) run.nums.shift(); run.nums.push({ x: x + rand(-8, 8), y, v, c, crit, t: 0 }); }
function part(x, y, vx, vy, life, c, s) { if (run.parts.length > 600) return; run.parts.push({ x, y, vx, vy, t: 0, life, c, s }); }
function puff(x, y, sc = 1, col = null) { for (let i = 0; i < 7; i++) part(x + rand(-10, 10) * sc, y + rand(-12, 8) * sc, rand(-40, 40), rand(-60, -10), rand(.35, .6), col || (i % 2 ? 'rgba(170,140,220,.75)' : 'rgba(230,230,230,.75)'), rand(5, 9) * sc); }
function animFx(pre, n, x, y, sc = 1, fps = 18, rot = 0) { run.fx.push({ k: 'anim', pre, n, x, y, sc, fps, rot, t: 0 }); }
function ring(x, y, r0, r1, dur, c, w = 4) { run.fx.push({ k: 'ring', x, y, r0, r1, dur, c, w, t: 0 }); }
function boltFx(x0, y0, x1, y1, w = 3, col = null) {
  const pts = [[x0, y0]], n = 7;
  for (let i = 1; i < n; i++) { const p = i / n; pts.push([x0 + (x1 - x0) * p + rand(-14, 14), y0 + (y1 - y0) * p + rand(-8, 8)]); }
  pts.push([x1, y1]);
  run.fx.push({ k: 'bolt', pts, dur: .22, t: 0, w, col });
}
function explode(x, y, rad, dmg, kind = 'fire') {
  query(x, y, rad, e => { const d = Math.hypot(e.x - x, e.y - y) || 1; hurt(e, dmg, 160, (e.x - x) / d, (e.y - y) / d, kind === 'fire' ? '#ffb35c' : null); });
  animFx(kind === 'fire' ? 'f_fireball_hit_' : 'e_frostbolt_hit_', 5, x, y, rad / 18);
  sfx.boom();
}

// ---------- Waffen ----------
function shoot(k, a, dmg, pierce, spd, life, extra = {}) {
  run.pproj.push(Object.assign({ k, x: P.x, y: P.y - 8, a, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: dmg * P.dmgMult, pierce, life, hit: new Set(), r: 13, t: 0 }, extra));
}
function updWeapons(dt) {
  const rate = P.rageT > 0 ? 1.6 : 1;
  for (const w of run.weapons) {
    const L = w.lv - 1;
    switch (w.id) {
      case 'dagger': {
        w.t -= dt * rate; if (w.t > 0) break;
        if (w.evo) { w.t = .5 * P.cdMult; w.rot += .21; for (let i = 0; i < 12; i++) shoot('dagger', w.rot + i * TAU / 12, 20, 99, 560 * P.proj, .85); }
        else {
          w.t = [.7, .7, .65, .65, .5][L] * P.cdMult;
          const n = [1, 2, 2, 3, 4][L], dmg = [12, 12, 16, 16, 18][L], pierce = [0, 0, 0, 1, 1][L];
          const t = nearest(520), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
          for (let i = 0; i < n; i++) shoot('dagger', a + (i - (n - 1) / 2) * .13, dmg, pierce, 560 * P.proj, .9);
        }
        sfx.throw(); break;
      }
      case 'orbit': {
        const n = w.evo ? 8 : [2, 3, 3, 4, 5][L], r = (w.evo ? 135 : [78, 78, 92, 98, 104][L]) * P.area;
        const dmg = (w.evo ? 24 : [8, 8, 12, 12, 14][L]) * P.dmgMult, spd = w.evo ? 4.6 : [2.8, 2.8, 3, 3, 3.6][L];
        w.a += spd * dt * rate; w.blades.length = 0;
        for (let i = 0; i < n; i++) {
          const a = w.a + i * TAU / n, bx = P.x + Math.cos(a) * r, by = P.y - 8 + Math.sin(a) * r;
          w.blades.push([bx, by, a]);
          query(bx, by, 16 * P.area, e => { if (e.oh > run.time) return; e.oh = run.time + .42; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, w.evo ? 260 : 110, (e.x - P.x) / d, (e.y - P.y) / d); });
        }
        w.r = r; break;
      }
      case 'fireball': {
        w.t -= dt * rate; if (w.t > 0) break;
        if (w.evo) {
          w.t = 1 * P.cdMult; const c = randomEnemyInView(20);
          for (let i = 0; i < 3; i++) { const e = c.length ? pick(c) : null; run.tele.push({ k: 'meteor', x: e ? e.x + rand(-20, 20) : P.x + rand(-250, 250), y: e ? e.y + rand(-20, 20) : P.y + rand(-200, 200), t: .65, dur: .65, rad: 105 * P.area, dmg: 46 * P.dmgMult }); }
        } else {
          w.t = [1.8, 1.7, 1.6, 1.35, 1.25][L] * P.cdMult;
          const n = [1, 1, 2, 2, 3][L], dmg = [18, 22, 22, 28, 32][L], rad = [55, 64, 64, 68, 82][L] * P.area;
          const c = randomEnemyInView(-60).filter(e => (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 470 * 470);
          for (let i = 0; i < n; i++) { const e = c.length ? c.splice((Math.random() * c.length) | 0, 1)[0] : nearest(470); if (!e) break; shoot('fireball', Math.atan2(e.y - P.y, e.x - P.x), dmg, 0, 360 * P.proj, 1.8, { target: e, rad }); }
          sfx.cast();
        }
        break;
      }
      case 'spear': {
        w.t -= dt * rate;
        if (w.evo) {
          w.t2 -= dt * rate;
          if (w.t2 <= 0) {
            w.t2 = 3.4 * P.cdMult; const R = 230 * P.area;
            query(P.x, P.y, R, e => { hurt(e, 30 * P.dmgMult, 0, 0, 0, '#9fe6ff'); if (!e.boss) e.freezeT = 1.8; else e.slowT = 2; });
            ring(P.x, P.y, 20, R, .45, 'rgba(160,230,255,.9)', 10); sfx.frost();
            for (let i = 0; i < 20; i++) { const a = Math.random() * TAU; part(P.x + Math.cos(a) * R * .9, P.y + Math.sin(a) * R * .9, 0, -20, .6, 'rgba(220,250,255,.9)', 5); }
          }
        }
        if (w.t > 0) break;
        const n = w.evo ? 5 : [1, 2, 2, 3, 3][L], dmg = w.evo ? 30 : [12, 12, 16, 16, 22][L], pierce = w.evo ? 99 : [2, 2, 4, 4, 5][L];
        w.t = (w.evo ? .9 : [1.5, 1.4, 1.3, 1.2, 1][L]) * P.cdMult;
        const a = Math.atan2(P.aimY, P.aimX);
        for (let i = 0; i < n; i++) shoot('spear', a + (i - (n - 1) / 2) * .2, dmg, pierce, 470 * P.proj, 1.1);
        sfx.frost(); break;
      }
      case 'bolt': {
        w.t -= dt * rate; if (w.t > 0) break;
        w.t = (w.evo ? .85 : [1.6, 1.5, 1.4, 1.3, 1.15][L]) * P.cdMult;
        const n = w.evo ? 6 : [1, 2, 2, 3, 4][L], dmg = (w.evo ? 48 : [22, 24, 26, 32, 36][L]) * P.dmgMult, chain = w.evo ? 5 : [0, 0, 1, 1, 2][L];
        const c = randomEnemyInView(10);
        for (let i = 0; i < n && c.length; i++) {
          const e = c.splice((Math.random() * c.length) | 0, 1)[0];
          boltFx(e.x + rand(-40, 40), e.y - 420, e.x, e.y, w.evo ? 5 : 3.5);
          hurt(e, dmg, 0, 0, 0, '#fff38a');
          const hitSet = new Set([e]); let cur = e, cd = dmg;
          for (let j = 0; j < chain; j++) {
            let nx = null, nd = (w.evo ? 180 : 130) ** 2;
            query(cur.x, cur.y, w.evo ? 180 : 130, o => { if (hitSet.has(o)) return; const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d < nd) { nd = d; nx = o; } });
            if (!nx) break;
            cd *= .75; boltFx(cur.x, cur.y - 10, nx.x, nx.y - 10, 2.5); hurt(nx, cd, 0, 0, 0, '#fff38a'); hitSet.add(nx); cur = nx;
          }
        }
        sfx.zap(); break;
      }
      case 'poison': {
        if (w.evo) { w.t2 -= dt; if (w.t2 <= 0) { w.t2 = .3; query(P.x, P.y, 125 * P.area, e => hurt(e, 11 * P.dmgMult, 0, 0, 0, '#9cf06a')); } }
        w.t -= dt * rate; if (w.t > 0) break;
        w.t = (w.evo ? 2 : [2.6, 2.5, 2.3, 2.2, 2][L]) * P.cdMult;
        const n = w.evo ? 3 : [1, 1, 2, 2, 3][L];
        const rad = (w.evo ? 85 : [50, 60, 60, 64, 72][L]) * P.area, dur = w.evo ? 4.5 : [3, 3.2, 3.2, 4.2, 4.2][L], dmg = (w.evo ? 12 : [5, 7, 7, 8, 10][L]) * P.dmgMult;
        const c = randomEnemyInView(40);
        for (let i = 0; i < n; i++) { const e = c.length ? pick(c) : null; run.tele.push({ k: 'flask', sx: P.x, sy: P.y - 10, x: e ? e.x : P.x + rand(-200, 200), y: e ? e.y : P.y + rand(-160, 160), t: 0, dur: .55, rad, zdur: dur, dmg }); }
        sfx.throw(); break;
      }
      case 'boomer': {
        w.t -= dt * rate; if (w.t > 0) break;
        if (w.evo) {
          w.t = 1.1 * P.cdMult; w.rot += .5;
          for (let i = 0; i < 4; i++) shoot('boomer', w.rot + i * TAU / 4, 40, 999, 420 * P.proj, 5, { out: 300 * P.proj, dist: 0, back: false, sc: 1.6, r: 24 });
        } else {
          w.t = [1.6, 1.6, 1.5, 1.4, 1.25][L] * P.cdMult;
          const n = [1, 1, 2, 2, 3][L], dmg = [14, 18, 18, 22, 24][L], out = [230, 230, 240, 290, 300][L] * P.proj;
          const t = nearest(500), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
          for (let i = 0; i < n; i++) shoot('boomer', a + (i - (n - 1) / 2) * .5, dmg, 999, 400 * P.proj, 5, { out, dist: 0, back: false, sc: 1, r: 16 });
        }
        sfx.whoosh(); break;
      }
      case 'barrel': {
        w.t -= dt * rate; if (w.t > 0) break;
        w.t = (w.evo ? 2 : [3, 2.8, 2.7, 2.6, 2.1][L]) * P.cdMult;
        const n = w.evo ? 3 : [1, 1, 2, 2, 3][L], dmg = (w.evo ? 60 : [35, 44, 44, 50, 55][L]) * P.dmgMult, rad = (w.evo ? 110 : [80, 85, 85, 100, 105][L]) * P.area;
        const c = randomEnemyInView(60);
        for (let i = 0; i < n; i++) {
          const e = c.length ? pick(c) : null;
          let tx = e ? e.x : P.x + rand(-120, 120), ty = e ? e.y : P.y + rand(-120, 120);
          const dd = Math.hypot(tx - P.x, ty - P.y); if (dd > 260) { tx = P.x + (tx - P.x) / dd * 260; ty = P.y + (ty - P.y) / dd * 260; }
          run.tele.push({ k: 'barrel', sx: P.x, sy: P.y - 10, x: tx, y: ty, t: 0, dur: .45, fuse: 1, rad, dmg, evo: w.evo });
        }
        sfx.throw(); break;
      }
      case 'saw': {
        w.t -= dt * rate; if (w.t > 0) break;
        w.t = (w.evo ? 3.2 : [3.4, 3.2, 3.1, 3, 2.8][L]) * P.cdMult;
        const n = w.evo ? 4 : [1, 1, 2, 2, 3][L], dmg = w.evo ? 26 : [10, 12, 12, 16, 16][L], life = (w.evo ? 5.5 : [2.5, 3, 3, 3, 3.6][L]) * P.proj;
        const t = nearest(500), a0 = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.random() * TAU;
        for (let i = 0; i < n; i++) shoot('saw', a0 + i * TAU / n + rand(-.2, .2), dmg, 999, (w.evo ? 470 : 380) * P.proj, life, { hm: new Map(), sc: w.evo ? 1.7 : 1, r: w.evo ? 30 : 18 });
        sfx.whoosh(); break;
      }
      case 'gang': {
        const n = w.evo ? 7 : [1, 2, 2, 3, 4][L];
        while (run.allies.length < n) { const a = Math.random() * TAU; run.allies.push({ ally: true, x: P.x + Math.cos(a) * 40, y: P.y + Math.sin(a) * 40, face: 'down', at: 0, atk: 0, slash: 0, sa: 0, moving: false, off: Math.random() * TAU }); puff(P.x, P.y, .6); }
        w.dmg = (w.evo ? 22 : [8, 8, 12, 12, 14][L]) * P.dmgMult; w.spd = w.evo ? 270 : L >= 4 ? 240 : 205; w.sc = w.evo ? .66 : .55;
        break;
      }
    }
  }
}
function updAllies(dt) {
  const w = run.weapons.find(x => x.id === 'gang'); if (!w || !w.dmg) return;
  const rate = P.rageT > 0 ? 1.6 : 1;
  run.allies.forEach((al, i) => {
    al.atk -= dt * rate; al.slash -= dt;
    let tgt = null, td = 0;
    for (const e of run.enemies) {
      if (e.dead || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > 300 * 300) continue;
      const d2 = (e.x - al.x) ** 2 + (e.y - al.y) ** 2; if (!tgt || d2 < td) { tgt = e; td = d2; }
    }
    let tx, ty;
    if (tgt) { tx = tgt.x; ty = tgt.y; }
    else { const a = run.time * .8 + al.off + i * TAU / run.allies.length; tx = P.x + Math.cos(a) * 55; ty = P.y + Math.sin(a) * 40; }
    const dx = tx - al.x, dy = ty - al.y, d = Math.hypot(dx, dy) || 1;
    const reach = tgt ? tgt.r + 12 : 6;
    al.moving = d > reach;
    if (al.moving) { const s = Math.min(d - reach, w.spd * dt); al.x += dx / d * s; al.y += dy / d * s; al.face = faceOf(dx, dy); al.at += dt; }
    if (tgt && d < reach + 6 && al.atk <= 0) { al.atk = .45; al.slash = .15; al.sa = Math.atan2(dy, dx); hurt(tgt, w.dmg, 90, dx / d, dy / d); }
    if (Math.hypot(al.x - P.x, al.y - P.y) > 520) { al.x = P.x + rand(-30, 30); al.y = P.y + rand(-30, 30); puff(al.x, al.y, .5); }
  });
}
function updPProj(dt) {
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM;
  for (const p of run.pproj) {
    p.t += dt; p.life -= dt;
    if ((p.k === 'fireball' || p.k === 'rocket') && p.target && !p.target.dead) {
      const ta = Math.atan2(p.target.y - p.y, p.target.x - p.x), turn = p.k === 'rocket' ? 8 : 6;
      let da = ta - p.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const sp = Math.hypot(p.vx, p.vy);
      p.a += clamp(da, -turn * dt, turn * dt); p.vx = Math.cos(p.a) * sp; p.vy = Math.sin(p.a) * sp;
    }
    if (p.k === 'boomer') {
      if (!p.back) { p.x += p.vx * dt; p.y += p.vy * dt; p.dist += Math.hypot(p.vx, p.vy) * dt; if (p.dist >= p.out) { p.back = true; p.hit.clear(); } }
      else { const dx = P.x - p.x, dy = P.y - 8 - p.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(p.vx, p.vy) * 1.15; p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; if (d < 22) p.life = 0; }
    } else { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (p.k === 'saw') {
      if ((p.x < P.x - hw + p.r && p.vx < 0) || (p.x > P.x + hw - p.r && p.vx > 0)) p.vx = -p.vx;
      if ((p.y < P.y - hh + p.r && p.vy < 0) || (p.y > P.y + hh - p.r && p.vy > 0)) p.vy = -p.vy;
      if (p.life <= 0) continue;
      query(p.x, p.y, p.r, e => { if ((p.hm.get(e) || 0) > run.time) return; p.hm.set(e, run.time + .3); hurt(e, p.dmg, 60, p.vx / 400, p.vy / 400); for (let i = 0; i < 2; i++) part(p.x, p.y, rand(-120, 120), rand(-120, 120), .2, '#ffe9a0', 2); });
      continue;
    }
    if (p.k === 'fireball' || p.k === 'rocket') {
      let boom = p.life <= 0;
      query(p.x, p.y, 12, () => { boom = true; return false; });
      if (boom) { explode(p.x, p.y, p.rad, p.dmg, 'fire'); p.life = -1; }
      if (Math.random() < .6) part(p.x - p.vx * .02, p.y - p.vy * .02, rand(-20, 20), rand(-20, 20), .3, p.k === 'rocket' ? 'rgba(200,200,200,.7)' : 'rgba(255,160,40,.8)', p.k === 'rocket' ? 4 : 5);
      continue;
    }
    if (p.life <= 0) continue;
    query(p.x, p.y, p.r, e => {
      if (p.hit.has(e)) return;
      p.hit.add(e);
      if (p.k === 'spear') { hurt(e, p.dmg, 90, Math.cos(p.a), Math.sin(p.a), '#9fe6ff'); e.slowT = 2.2; animFx('e_frostbolt_hit_', 5, e.x, e.y, .9, 22); }
      else hurt(e, p.dmg, p.k === 'bullet' ? 25 : 70, Math.cos(p.a), Math.sin(p.a));
      p.pierce--;
      if (p.pierce < 0) { p.life = -1; return false; }
    });
  }
  run.pproj = run.pproj.filter(p => p.life > 0);
}
function updTele(dt) {
  for (const t of run.tele) {
    if (t.k === 'meteor') {
      t.t -= dt;
      if (t.t <= 0) { explode(t.x, t.y, t.rad, t.dmg, 'fire'); run.shake = Math.max(run.shake, 5); run.zones.push({ k: 'burn', x: t.x, y: t.y, r: t.rad * .65, t: 2.6, dur: 2.6, tick: 0, dmg: 9 * P.dmgMult }); t.done = true; }
    } else if (t.k === 'flask') {
      t.t += dt;
      if (t.t >= t.dur) { run.zones.push({ k: 'poison', x: t.x, y: t.y, r: t.rad, t: t.zdur, dur: t.zdur, tick: 0, dmg: t.dmg }); t.done = true; for (let i = 0; i < 8; i++) part(t.x, t.y, rand(-80, 80), rand(-90, -20), .5, 'rgba(140,230,80,.9)', 5); }
    } else if (t.k === 'barrel' || t.k === 'mini') {
      t.t += dt;
      if (t.t >= t.dur) {
        if (t.k === 'barrel') { t.fuse -= dt; if (Math.random() < .6) part(t.x + 3, t.y - 26, rand(-40, 40), rand(-90, -40), .3, '#ffd84a', 2.5); }
        if (t.k === 'mini' || t.fuse <= 0) {
          explode(t.x, t.y, t.rad, t.dmg, 'fire'); run.shake = Math.max(run.shake, t.k === 'barrel' ? 7 : 3); t.done = true;
          if (t.evo) for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + rand(-.3, .3), r = rand(80, 140); run.tele.push({ k: 'mini', sx: t.x, sy: t.y, x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, t: 0, dur: .4, rad: 55 * P.area, dmg: t.dmg * .45 }); }
        }
      }
    }
  }
  run.tele = run.tele.filter(t => !t.done);
  for (const z of run.zones) {
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = .35; query(z.x, z.y, z.r, e => hurt(e, z.dmg, 0, 0, 0, z.k === 'poison' ? '#9cf06a' : '#ffb35c')); }
    if (Math.random() < dt * 8) part(z.x + rand(-z.r, z.r) * .7, z.y + rand(-z.r, z.r) * .5, 0, -25, .6, z.k === 'poison' ? 'rgba(170,255,110,.7)' : 'rgba(255,170,60,.8)', 4);
  }
  run.zones = run.zones.filter(z => z.t > 0);
  for (const s of run.etele) {
    s.t -= dt;
    if (s.t <= 0) {
      s.done = true;
      boltFx(s.x + rand(-30, 30), s.y - 460, s.x, s.y, 6, 'storm');
      for (let i = 0; i < 10; i++) part(s.x, s.y, rand(-150, 150), rand(-150, 50), .35, '#fff59a', 3);
      ring(s.x, s.y, 5, s.r, .25, 'rgba(255,240,120,.9)', 6);
      if (Math.hypot(P.x - s.x, P.y - s.y) < s.r + pR() * .6) damagePlayer(s.dmg);
      if (onScreen(s.x, s.y)) sfx.ezap();
    }
  }
  run.etele = run.etele.filter(s => !s.done);
  for (const z of run.ezones) {
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0 && Math.hypot(P.x - z.x, P.y - z.y) < z.r + pR() * .5) { z.tick = .5; damagePlayer(z.dmg); }
    if (Math.random() < dt * 6) part(z.x + rand(-z.r, z.r) * .6, z.y + rand(-z.r, z.r) * .4, 0, -20, .7, 'rgba(160,90,220,.7)', 4);
  }
  run.ezones = run.ezones.filter(z => z.t > 0);
}
function updEProj(dt) {
  for (const p of run.eproj) {
    p.t += dt; p.life -= dt;
    if (p.lob) {
      const q = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * q; p.y = p.sy + (p.ty - p.sy) * q; p.h = Math.sin(q * Math.PI) * 110;
      if (q >= 1) { p.life = 0; run.ezones.push({ x: p.tx, y: p.ty, r: 58, t: 4.2, dur: 4.2, tick: 0, dmg: p.dmg }); animFx('f_fireball_hit_', 5, p.tx, p.ty, 2.2, 16); for (let i = 0; i < 8; i++) part(p.tx, p.ty, rand(-90, 90), rand(-90, -20), .45, 'rgba(150,240,80,.9)', 4); }
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (run.arena && Math.hypot(p.x - run.arena.x, p.y - run.arena.y) > run.arena.r + 40) p.life = 0;
    const dx = p.x - P.x, dy = p.y - (P.y - 6), rr = p.r + pR() * .85;
    if (dx * dx + dy * dy < rr * rr && P.dashT <= 0 && P.inv <= 0) {
      damagePlayer(p.dmg);
      if (p.kind === 'frost' && P.mechT <= 0) P.slowT = 1.2;
      p.life = 0;
      animFx(p.kind === 'fire' ? 'f_fireball_hit_' : 'e_frostbolt_hit_', 5, p.x, p.y, 1.2);
    }
  }
  run.eproj = run.eproj.filter(p => p.life > 0);
}
const gemTier = v => v >= 100 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0;
function updItems(dt) {
  if (gemComboT > 0) { gemComboT -= dt; if (gemComboT <= 0) gemCombo = 0; }
  for (const it of run.items) {
    it.t += dt;
    if (it.z > 0) {
      it.vz -= 900 * dt; it.z += it.vz * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.z <= 0) { it.z = 0; it.vz = 0; }
      continue;
    }
    const dx = P.x - it.x, dy = P.y - 6 - it.y, d = Math.hypot(dx, dy) || 1;
    if (!it.mag && (it.k === 'gem' || it.k === 'coin' || it.k === 'gear') && d < P.magnet) it.mag = true;
    if (it.mag) {
      it.sp = Math.min(1300, it.sp + 1500 * dt);
      const s = Math.min(d, it.sp * dt); it.x += dx / d * s; it.y += dy / d * s;
      if (it.k === 'gem' && Math.random() < .5) part(it.x, it.y, 0, 0, .18, GEM_COL[gemTier(it.v)][0], 3);
    }
    if (d < pR() + 12) collect(it);
  }
  run.items = run.items.filter(i => !i.got);
}
let xpPulseT = 0;
function collect(it) {
  it.got = true;
  switch (it.k) {
    case 'gem': {
      addXp(it.v); sfx.gem();
      const col = GEM_COL[gemTier(it.v)][0];
      for (let i = 0; i < 5; i++) { const a = Math.random() * TAU; part(P.x + Math.cos(a) * 8, P.y - 10 + Math.sin(a) * 8, Math.cos(a) * 110, Math.sin(a) * 110 - 30, .3, col, 2.6); }
      if (performance.now() - xpPulseT > 110) { xpPulseT = performance.now(); const b = $('#xpBar'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
      break;
    }
    case 'coin': run.gold++; sfx.coin(); break;
    case 'gear':
      if (P.mechT <= 0) P.scrap = Math.min(100, P.scrap + 7); sfx.gear();
      for (let i = 0; i < 4; i++) part(P.x, P.y - 10, rand(-90, 90), rand(-120, -20), .3, '#c9d1d8', 2.5);
      break;
    case 'heal': P.hp = Math.min(P.maxHp, P.hp + 35); addNum(P.x, P.y - 40, '+35', '#7dff7a'); sfx.heal(); break;
    case 'magnet': for (const i of run.items) if (i.k === 'gem' || i.k === 'coin' || i.k === 'gear') i.mag = true; sfx.heal(); ring(P.x, P.y, 10, 300, .5, 'rgba(110,220,255,.8)', 6); break;
    case 'bomb':
      for (const e of run.enemies) if (!e.dead && onScreen(e.x, e.y)) hurt(e, e.boss ? 300 : 9999);
      run.flashT = .3; run.shake = 14; sfx.boom(); sfx.ult(); break;
    case 'chest': run.pendingChest++; break;
  }
}
function addXp(v) {
  P.xp += v * P.xpMult;
  while (P.xp >= P.need) { P.xp -= P.need; P.lv++; P.need = xpNeed(P.lv); run.pendingLv++; }
}

// ---------- Fähigkeiten ----------
function doDash() {
  if (!run || run.paused || run.over || P.dashCd > 0) return;
  P.dashT = .18; P.dashCd = 2.4; P.inv = Math.max(P.inv, .3);
  P.dvx = P.aimX * 900; P.dvy = P.aimY * 900;
  sfx.dash();
}
function doUlt() {
  if (!run || run.paused || run.over || P.ult < P.ultNeed) return;
  P.ult = 0; P.rageT = 6;
  const dmg = (60 + P.lv * 9) * P.dmgMult;
  query(P.x, P.y, 380, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, 700, (e.x - P.x) / d, (e.y - P.y) / d, '#ff8a5c'); });
  for (const p of run.eproj) if (Math.hypot(p.x - P.x, p.y - P.y) < 380) p.life = 0;
  ring(P.x, P.y, 10, 380, .55, 'rgba(255,90,50,.95)', 16); ring(P.x, P.y, 10, 300, .4, 'rgba(255,220,90,.9)', 8);
  run.shake = 16; sfx.ult(); banner('Goblin-Wut!', 'danger');
}
function startMech() {
  if (!run || run.paused || run.over || P.scrap < 100 || P.mechT > 0) return;
  P.scrap = 0; P.mechMax = P.mechT = 12 + 1.5 * (save.shop.mech || 0);
  P.gunT = 0; P.rocketT = .6; P.stepT = 0; P.inv = Math.max(P.inv, .6); P.slowT = 0;
  ring(P.x, P.y, 10, 160, .5, 'rgba(230,170,60,.95)', 10);
  for (let i = 0; i < 16; i++) part(P.x + rand(-30, 30), P.y + rand(-20, 20), rand(-120, 120), rand(-160, -40), .6, 'rgba(220,220,220,.8)', rand(5, 9));
  query(P.x, P.y, 120, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 30 * P.dmgMult, 500, (e.x - P.x) / d, (e.y - P.y) / d); });
  run.shake = 10; sfx.mechOn(); banner('Goblin-Maschine!', '');
}
function updMech(dt) {
  if (P.mechT <= 0) return;
  P.mechT -= dt; P.gunFlash -= dt; P.stepT -= dt;
  if (P.moving && P.stepT <= 0) {
    P.stepT = .36; P.leg ^= 1;
    const fx = P.x + (P.leg ? 15 : -15), fy = P.y + 18;
    query(fx, fy, 55 * P.area, e => { const d = Math.hypot(e.x - fx, e.y - fy) || 1; hurt(e, 13 * P.dmgMult, 160, (e.x - fx) / d, (e.y - fy) / d); });
    ring(fx, fy, 6, 55 * P.area, .3, 'rgba(210,190,150,.8)', 5);
    for (let i = 0; i < 4; i++) part(fx, fy, rand(-60, 60), rand(-40, -5), .4, 'rgba(200,185,150,.8)', 5);
    run.shake = Math.max(run.shake, 2.5); sfx.stomp();
  }
  const t = nearest(470);
  if (t) P.gunA = Math.atan2(t.y - (P.y - 24), t.x - P.x);
  P.gunT -= dt;
  if (t && P.gunT <= 0) {
    P.gunT = .085;
    const side = Math.cos(P.gunA) >= 0 ? 1 : -1, gx = P.x + side * 28 + Math.cos(P.gunA) * 34, gy = P.y - 22 + Math.sin(P.gunA) * 34;
    const a = P.gunA + rand(-.07, .07);
    run.pproj.push({ k: 'bullet', x: gx, y: gy, a, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, dmg: 9 * P.dmgMult, pierce: 0, life: .7, hit: new Set(), r: 8, t: 0 });
    P.gunFlash = .04; sfx.gun();
  }
  P.rocketT -= dt;
  if (P.rocketT <= 0) {
    P.rocketT = 1.4;
    const c = randomEnemyInView(0);
    if (c.length) {
      for (let i = 0; i < 4; i++) {
        const e = pick(c), a = -Math.PI / 2 + (i - 1.5) * .5;
        run.pproj.push({ k: 'rocket', x: P.x - 10, y: P.y - 50, a, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, target: e, dmg: 30 * P.dmgMult, rad: 60 * P.area, pierce: 0, life: 2.2, hit: new Set(), r: 10, t: 0 });
      }
      sfx.rocket();
    }
  }
  if (Math.random() < dt * 14) { const side = Math.cos(P.gunA) >= 0 ? -1 : 1; part(P.x + side * 18, P.y - 62, rand(-10, 10), rand(-70, -40), .9, 'rgba(90,90,95,.55)', rand(6, 10)); }
  if (P.mechT <= 0) {
    const R = 200 * P.area;
    query(P.x, P.y, R, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 90 * P.dmgMult, 600, (e.x - P.x) / d, (e.y - P.y) / d, '#ffb35c'); });
    animFx('f_fireball_hit_', 5, P.x, P.y - 20, 6); ring(P.x, P.y, 10, R, .5, 'rgba(255,170,60,.95)', 14);
    for (let i = 0; i < 24; i++) part(P.x, P.y - 20, rand(-260, 260), rand(-300, 60), rand(.4, .9), i % 2 ? '#c9973a' : '#6d747c', rand(4, 8));
    P.inv = 1; run.shake = 16; sfx.boom(); sfx.ult(); banner('Maschine explodiert!', '');
  }
}

// ---------- Spieler ----------
function updPlayer(dt) {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (joy.id !== null) { const jx = (joy.x - joy.ox) / 55, jy = (joy.y - joy.oy) / 55; if (Math.hypot(jx, jy) > .15) { mx += jx; my += jy; } }
  const len = Math.hypot(mx, my);
  P.moving = len > .1;
  if (P.moving) { P.aimX = mx / len; P.aimY = my / len; P.face = faceOf(mx, my); }
  const want = (keys.ShiftLeft || keys.ShiftRight || sprintHeld) && P.moving && P.mechT <= 0;
  if (want && !P.exhaust && P.stam > 0) {
    P.sprinting = true; P.stam -= 34 * dt; P.stamDelay = .7;
    if (P.stam <= 0) { P.stam = 0; P.exhaust = true; }
    if (Math.random() < dt * 22) part(P.x + rand(-8, 8), P.y + 18, -P.aimX * 40 + rand(-20, 20), rand(-30, -5), .35, 'rgba(220,210,170,.75)', rand(3, 6));
  } else {
    P.sprinting = false; P.stamDelay -= dt;
    if (P.stamDelay <= 0) P.stam = Math.min(P.stamMax, P.stam + 26 * dt);
    if (P.exhaust && P.stam >= P.stamMax * .35) P.exhaust = false;
  }
  const ox = P.x, oy = P.y;
  if (P.dashT > 0) {
    P.dashT -= dt; P.x += P.dvx * dt; P.y += P.dvy * dt;
    P.trailT -= dt; if (P.trailT <= 0) { P.trailT = .03; P.trail.push({ x: P.x, y: P.y, spr: curPlayerSpr(), t: .25 }); }
  } else if (P.moving) {
    const sp = P.speed * (P.slowT > 0 ? .75 : 1) * (P.rageT > 0 ? 1.25 : 1) * (P.sprinting ? 1.55 : 1) * (P.mechT > 0 ? .95 : 1) * Math.min(1, len);
    P.x += P.aimX * sp * dt; P.y += P.aimY * sp * dt;
  }
  for (const t of P.trail) t.t -= dt; P.trail = P.trail.filter(t => t.t > 0);
  if (run.arena) {
    const A = run.arena, dx = P.x - A.x, dy = P.y - A.y, d = Math.hypot(dx, dy);
    if (d > A.r - 22) { P.x = A.x + dx / d * (A.r - 22); P.y = A.y + dy / d * (A.r - 22); }
    if (run.boss) { const b = run.boss, bx = b.x - A.x, by = b.y - A.y, bd = Math.hypot(bx, by); if (bd > A.r - 30) { b.x = A.x + bx / bd * (A.r - 30); b.y = A.y + by / bd * (A.r - 30); } }
  }
  P.vx = (P.x - ox) / Math.max(dt, 1e-4); P.vy = (P.y - oy) / Math.max(dt, 1e-4);
  P.inv -= dt; P.dashCd -= dt; P.slowT -= dt; P.rageT -= dt; P.anim += dt * (P.sprinting ? 1.5 : 1);
  if (P.regen && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
  query(P.x, P.y, pR(), e => { if (e.dmg > 0 && !(e.freezeT > 0)) { damagePlayer(e.dmg); return false; } });
  if (P.scrap >= 100 && !P.mechReadyShown) { P.mechReadyShown = true; hint(isTouch() ? '<b>Maschine bereit!</b> Tippe auf den Maschinen-Knopf.' : '<b>Maschine bereit!</b> Drück F zum Einsteigen.'); }
  if (P.mechT > 0) P.mechReadyShown = false;
}
function curPlayerSpr() {
  return P.moving ? 'walk_' + P.face + '_' + ((Math.floor(P.anim * 10) % 6) + 1) : 'idle_' + P.face + '_' + ((Math.floor(P.anim * 5) % 4) + 1);
}

// ---------- Haupt-Update ----------
function update(dt) {
  run.time += dt;
  while (run.ei < run.events.length && run.time >= run.events[run.ei].t) doEvent(run.events[run.ei++]);
  updPlayer(dt);
  if (run.over) return;
  updMech(dt);
  spawnTick(dt);
  buildGrid();
  for (const e of run.enemies) if (!e.dead) updEnemy(e, dt);
  for (const e of run.enemies) {
    if (e.dead || e.boss) continue;
    query(e.x, e.y, e.r * .9, o => {
      if (o === e) return;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || .01, ov = (e.r + o.r) * .9 - d;
      if (ov > 0) { const push = o.boss ? ov : ov * .5; e.x += dx / d * push; e.y += dy / d * push; }
    });
  }
  buildGrid();
  updWeapons(dt);
  updAllies(dt);
  updPProj(dt);
  updTele(dt);
  updEProj(dt);
  run.enemies = run.enemies.filter(e => !e.dead);
  updItems(dt);
  for (const f of run.fx) f.t += dt;
  run.fx = run.fx.filter(f => f.k === 'anim' ? f.t * f.fps < f.n : f.t < f.dur);
  for (const p of run.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; }
  run.parts = run.parts.filter(p => p.t < p.life);
  for (const n of run.nums) n.t += dt;
  run.nums = run.nums.filter(n => n.t < .7);
  run.shake *= Math.exp(-10 * dt); run.hurtT -= dt; run.flashT -= dt;
  if (run.clearT > 0) { run.clearT -= dt; if (run.clearT <= 0) gameOver(true); }
  if (!run.over && !run.paused && run.lvDelay <= 0 && (run.pendingChest > 0 || run.pendingLv > 0)) {
    if (run.pendingChest > 0) { run.pendingChest--; run.lvKind = 'chest'; sfx.chest(); }
    else { run.pendingLv--; run.lvKind = 'lv'; sfx.lvl(); }
    run.lvDelay = .45;
    const col = run.lvKind === 'chest' ? '#ffd84a' : '#8fe6ff';
    ring(P.x, P.y, 10, 160, .45, col, 8);
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; part(P.x, P.y - 10, Math.cos(a) * 220, Math.sin(a) * 220, .45, col, 3.5); }
  }
}

// ---------- Zeichnen ----------
function render(now) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (mode !== 'play' || !run) { renderMenuScene(t); return; }
  const sx = (Math.random() - .5) * run.shake, sy = (Math.random() - .5) * run.shake;
  const camX = P.x + sx, camY = P.y + sy, z = ZOOM * DPR;
  ctx.setTransform(z, 0, 0, z, cv.width / 2 - camX * z, cv.height / 2 - camY * z);
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM;
  drawGround(run.si, camX - hw - 4, camY - hh - 4, hw * 2 + 8, hh * 2 + 8);
  if (run.arena) drawArena(run.arena, t);
  for (const zn of run.zones) {
    const a = Math.min(1, zn.t / .4) * .55, g = ctx.createRadialGradient(zn.x, zn.y, zn.r * .2, zn.x, zn.y, zn.r);
    if (zn.k === 'poison') { g.addColorStop(0, `rgba(150,240,70,${a})`); g.addColorStop(.8, `rgba(90,190,40,${a * .8})`); g.addColorStop(1, 'rgba(90,190,40,0)'); }
    else { g.addColorStop(0, `rgba(255,190,60,${a})`); g.addColorStop(.7, `rgba(220,80,20,${a * .7})`); g.addColorStop(1, 'rgba(200,60,20,0)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * .75, 0, 0, TAU); ctx.fill();
  }
  // gegnerische Giftpfützen: lila mit rotem Rand = gefährlich
  for (const zn of run.ezones) {
    ctx.globalAlpha = clamp(Math.min(zn.t / .4, (zn.dur - zn.t) / .2 + .3), 0, 1);
    const g = ctx.createRadialGradient(zn.x, zn.y, 4, zn.x, zn.y, zn.r);
    g.addColorStop(0, 'rgba(120,200,40,.75)'); g.addColorStop(.7, 'rgba(110,50,160,.6)'); g.addColorStop(1, 'rgba(110,50,160,.15)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * .72, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,70,70,.75)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  const pw = run.weapons.find(w => w.id === 'poison' && w.evo);
  if (pw) {
    const R = 125 * P.area, g = ctx.createRadialGradient(P.x, P.y, R * .3, P.x, P.y, R);
    g.addColorStop(0, 'rgba(140,230,70,0)'); g.addColorStop(.75, 'rgba(140,230,70,.22)'); g.addColorStop(1, 'rgba(140,230,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(170,255,110,.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 14]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.arc(P.x, P.y, R * .92, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const tl of run.tele) {
    if (tl.k === 'meteor') {
      const p = 1 - tl.t / tl.dur;
      ctx.strokeStyle = 'rgba(255,140,40,.8)'; ctx.lineWidth = 3; ctx.fillStyle = `rgba(255,140,30,${.1 + p * .15})`;
      ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad, tl.rad * .75, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad * p, tl.rad * .75 * p, 0, 0, TAU); ctx.stroke();
    }
  }
  for (const s of run.etele) {
    const p = clamp(1 - s.t / s.dur, 0, 1);
    ctx.fillStyle = `rgba(255,230,60,${.12 + p * .25})`; ctx.strokeStyle = `rgba(255,${Math.round(200 - p * 150)},40,.95)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * .72, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,170,.45)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * p, s.r * .72 * p, 0, 0, TAU); ctx.fill();
  }
  if (run.boss && run.boss.ai.st === 'tele') {
    const b = run.boss, a = Math.atan2(b.ai.ay, b.ai.ax);
    ctx.save(); ctx.translate(b.x, b.y + 20); ctx.rotate(a);
    ctx.fillStyle = `rgba(255,50,40,${.18 + .15 * Math.sin(t * 30)})`; ctx.fillRect(0, -36, 430, 72);
    ctx.strokeStyle = 'rgba(255,80,60,.8)'; ctx.lineWidth = 2; ctx.strokeRect(0, -36, 430, 72);
    ctx.restore();
  }
  for (const e of run.enemies) if (e.bomber && e.fuse > 0) {
    ctx.strokeStyle = `rgba(255,60,40,${.5 + .4 * Math.sin(t * 30)})`; ctx.fillStyle = 'rgba(255,60,40,.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 10, 80, 58, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // Gegenstände
  for (const it of run.items) {
    if (!onScreen(it.x, it.y, 40)) continue;
    const bob = it.z > 0 ? -it.z * .5 : Math.sin(it.t * 4) * 2.5;
    if (it.k === 'gem') drawGem(it, bob);
    else {
      const s = it.k === 'coin' ? 18 : it.k === 'gear' ? 22 : it.k === 'chest' ? 44 : 30;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + s * .45, s * .4, s * .15, 0, 0, TAU); ctx.fill();
      if (it.k !== 'coin' && it.k !== 'gear') { ctx.fillStyle = 'rgba(255,240,150,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 12, s * .6, s * .25, 0, 0, TAU); ctx.fill(); }
      if (it.k === 'gear') drawImgC(PROC.gear, it.x, it.y + bob, s, it.t * 2);
      else ctx.drawImage(iconCanvas(it.k), it.x - s / 2, it.y - s / 2 + bob - (it.k === 'chest' ? 6 : 0), s, s);
    }
  }
  // Figuren nach y sortiert
  const list = [];
  for (const e of run.enemies) if (onScreen(e.x, e.y, 120 * e.sc)) list.push(e);
  for (const al of run.allies) list.push(al);
  list.push(P);
  list.sort((a, b) => a.y - b.y);
  for (const tr of P.trail) drawSpr(tr.spr, tr.x, tr.y - 8, 1, 0, 'rage', tr.t * 1.6);
  const gang = run.weapons.find(w => w.id === 'gang');
  for (const o of list) {
    if (o === P) { if (P.mechT > 0) drawMech(); else drawPlayer(t); }
    else if (o.ally) drawAlly(o, gang);
    else drawEnemy(o, t);
  }
  drawPlayerBars();
  for (const e of run.enemies) if (e.state === 'cast' && !e.boss && e.ft < e.charge + .05 && onScreen(e.x, e.y, 60)) drawCharge(e, t);
  if (run.boss && run.boss.ai.st === 'cast' && run.boss.ft < run.boss.charge) drawCharge(run.boss, t);
  for (const w of run.weapons) if (w.id === 'orbit') {
    ctx.strokeStyle = w.evo ? 'rgba(255,230,120,.25)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(P.x, P.y - 8, w.r || 80, 0, TAU); ctx.stroke();
    for (const [bx, by, a] of w.blades) drawSpr('dagger', bx, by, w.evo ? 1.5 : 1.25, a + Math.PI / 2);
  }
  // Geschosse
  for (const p of run.pproj) {
    if (p.k === 'dagger') drawSpr('dagger', p.x, p.y, 1.05, p.a);
    else if (p.k === 'spear') drawSpr('e_frostbolt_' + ((Math.floor(p.t * 14) % 4) + 1), p.x, p.y, 1.25, p.a);
    else if (p.k === 'fireball') drawSpr('f_fireball_' + ((Math.floor(p.t * 14) % 4) + 1), p.x, p.y, 1.3, p.a);
    else if (p.k === 'boomer') drawImgC(PROC.bone, p.x, p.y, 40 * p.sc, p.t * 16);
    else if (p.k === 'saw') drawImgC(PROC.saw, p.x, p.y, 44 * p.sc, p.t * 22);
    else if (p.k === 'bullet') { ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke(); }
    else if (p.k === 'rocket') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#d6dde2'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-9, -3.5, 14, 7, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(5, -3.5); ctx.lineTo(11, 0); ctx.lineTo(5, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(-11, 0, 3 + Math.random() * 2, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  for (const tl of run.tele) {
    if (tl.k === 'flask') {
      const p = tl.t / tl.dur, x = tl.sx + (tl.x - tl.sx) * p, y = tl.sy + (tl.y - tl.sy) * p - Math.sin(p * Math.PI) * 90;
      drawImgC(iconCanvas('poison'), x, y, 28, p * 9);
    } else if (tl.k === 'meteor') {
      const p = tl.t / tl.dur;
      drawSpr('f_fireball_' + ((Math.floor(t * 14) % 4) + 1), tl.x + p * 120, tl.y - p * 520, 2.4, Math.atan2(520, -120));
    } else if (tl.k === 'barrel' || tl.k === 'mini') {
      const p = Math.min(1, tl.t / tl.dur), x = tl.sx + (tl.x - tl.sx) * p, y = tl.sy + (tl.y - tl.sy) * p - Math.sin(p * Math.PI) * (tl.k === 'mini' ? 50 : 80);
      if (tl.k === 'barrel') {
        if (p >= 1) { ctx.strokeStyle = `rgba(255,120,40,${.35 + .3 * Math.sin(t * 25)})`; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad, tl.rad * .72, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        drawImgC(PROC.barrel, x, y - 8, 30, p < 1 ? p * 8 : Math.sin(t * 30) * .08);
      } else { ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x + 4, y - 6, 2.5, 0, TAU); ctx.fill(); }
    }
  }
  for (const p of run.eproj) {
    if (!onScreen(p.x, p.y, 60)) continue;
    if (p.lob) {
      ctx.strokeStyle = 'rgba(255,70,70,.7)'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(p.tx, p.ty, 58, 42, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 4, 0, 0, TAU); ctx.fill();
      drawSpr('f_fireball_' + ((Math.floor(p.t * 12) % 4) + 1), p.x, p.y - p.h, 1.2, Math.PI / 2, 'toxp');
      continue;
    }
    ctx.fillStyle = p.kind === 'fire' ? 'rgba(255,50,30,.22)' : p.kind === 'void' ? 'rgba(170,80,255,.28)' : 'rgba(80,180,255,.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, 0, TAU); ctx.fill();
    const fr = (Math.floor(p.t * 12) % 4) + 1;
    if (p.kind === 'fire') drawSpr('f_fireball_' + fr, p.x, p.y, p.sc, p.a);
    else drawSpr('e_frostbolt_' + fr, p.x, p.y, p.sc, p.a, p.kind === 'void' ? 'voidp' : null);
  }
  // Effekte
  for (const f of run.fx) {
    if (f.k === 'anim') { const i = Math.min(f.n, Math.floor(f.t * f.fps) + 1); drawSpr(f.pre + i, f.x, f.y, f.sc, f.rot); }
    else if (f.k === 'ring') {
      const p = f.t / f.dur, r = f.r0 + (f.r1 - f.r0) * (1 - (1 - p) * (1 - p));
      ctx.globalAlpha = 1 - p; ctx.strokeStyle = f.c; ctx.lineWidth = f.w * (1 - p * .5);
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'bolt') {
      const a = 1 - f.t / f.dur; ctx.lineJoin = 'round';
      const outer = f.col === 'storm' ? `rgba(255,220,60,${a * .55})` : `rgba(120,200,255,${a * .5})`;
      for (const [lw, col] of [[f.w * 3, outer], [f.w, `rgba(255,255,220,${a})`]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); f.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
    }
  }
  for (const p of run.parts) { const a = 1 - p.t / p.life; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.5 + a * .5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const n of run.nums) {
    const p = n.t / .7, s = n.crit ? 22 : 15;
    ctx.font = `900 ${s}px Nunito, system-ui, sans-serif`;
    ctx.globalAlpha = p > .6 ? 1 - (p - .6) / .4 : 1;
    const y = n.y - p * 28;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,15,6,.9)'; ctx.strokeText(n.v, n.x, y);
    ctx.fillStyle = n.c; ctx.fillText(n.v, n.x, y);
  }
  ctx.globalAlpha = 1;
  // Bildschirm-Ebene
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (P.hp / P.maxHp < .3 || run.hurtT > 0) {
    const a = run.hurtT > 0 ? .45 : .25 + .1 * Math.sin(t * 6);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .7);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P.rageT > 0) { ctx.fillStyle = `rgba(255,60,20,${.08 + .04 * Math.sin(t * 10)})`; ctx.fillRect(0, 0, W, H); }
  if (run.lvDelay > 0) { ctx.fillStyle = `rgba(255,255,255,${run.lvDelay * .35})`; ctx.fillRect(0, 0, W, H); }
  if (run.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${run.flashT / .3 * .8})`; ctx.fillRect(0, 0, W, H); }
  if (joy.id !== null) {
    ctx.fillStyle = 'rgba(10,15,6,.35)'; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 55, 0, TAU); ctx.fill(); ctx.stroke();
    let jx = joy.x - joy.ox, jy = joy.y - joy.oy; const l = Math.hypot(jx, jy); if (l > 55) { jx *= 55 / l; jy *= 55 / l; }
    ctx.fillStyle = 'rgba(111,194,58,.85)'; ctx.beginPath(); ctx.arc(joy.ox + jx, joy.oy + jy, 24, 0, TAU); ctx.fill(); ctx.stroke();
  }
}
function drawGround(si, x, y, w, h) { const tc = stageTile(si); if (!tc.pat) tc.pat = ctx.createPattern(tc.c, 'repeat'); ctx.fillStyle = tc.pat; ctx.fillRect(x, y, w, h); }
function drawArena(A, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,20,.35)';
  ctx.beginPath(); ctx.rect(A.x - 3000, A.y - 3000, 6000, 6000); ctx.arc(A.x, A.y, A.r, 0, TAU, true); ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(170,110,255,.55)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(A.x, A.y, A.r, 0, TAU); ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const a = i * TAU / 40 + t * .15, x = A.x + Math.cos(a) * A.r, y = A.y + Math.sin(a) * A.r;
    ctx.fillStyle = '#4a3a66'; ctx.strokeStyle = '#140c22'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 9, y + 8); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x + 6, y - 18); ctx.lineTo(x + 9, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(200,150,255,${.5 + .5 * Math.sin(t * 4 + i)})`; ctx.fillRect(x - 2, y - 10, 4, 7);
  }
  ctx.restore();
}
function drawGem(it, bob) {
  const tier = gemTier(it.v), w = [17, 21, 27, 36][tier], y = it.y + bob;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + w * .5, w * .3, w * .12, 0, 0, TAU); ctx.fill();
  drawImgC(PROC.gem[tier], it.x, y, w * 1.9 * (1 + Math.sin(it.t * 5) * .06));
  const tw = (it.t * 1.3 + Math.abs(it.x) * .01) % 2.4;
  if (tw < .25) {
    const s = Math.sin(tw / .25 * Math.PI) * w * .45, sx = it.x - w * .2, sy = y - w * .35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * .22, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * .22, sy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx, sy + s * .22); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy - s * .22); ctx.closePath(); ctx.fill();
  }
}
function drawEnemy(e, t) {
  if (e.elite || e.boss) {
    const R = e.r * 1.6 + Math.sin(t * 5) * 3;
    ctx.fillStyle = e.boss ? 'rgba(255,60,60,.28)' : 'rgba(255,210,60,.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 26 * e.sc, R, R * .4, 0, 0, TAU); ctx.fill();
  } else if (e.type === 'healer') { ctx.fillStyle = `rgba(160,255,150,${.18 + .08 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.ellipse(e.x, e.y + 24, 26, 10, 0, 0, TAU); ctx.fill(); }
  else if (e.type === 'void') { ctx.fillStyle = 'rgba(140,60,220,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 24, 24, 9, 0, 0, TAU); ctx.fill(); }
  if (e.slowT > 0 || e.freezeT > 0) { ctx.fillStyle = 'rgba(120,210,255,.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 26 * e.sc, e.r * 1.4, e.r * .5, 0, 0, TAU); ctx.fill(); }
  const fl = e.flash > 0 || (e.bomber && e.fuse > 0 && Math.floor(e.fuse * 14) % 2 === 0);
  drawSpr(e.spr || (e.pre + 'idle_down_1'), e.x, e.y, e.sc, 0, e.tint, 1, fl);
  if (e.type === 'healer') { ctx.fillStyle = '#8dff7a'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; const hy = e.y - 46; ctx.beginPath(); ctx.rect(e.x - 2.5, hy - 7, 5, 14); ctx.rect(e.x - 7, hy - 2.5, 14, 5); ctx.stroke(); ctx.fill(); }
  if (e.type === 'storm' && Math.random() < .08) part(e.x + rand(-14, 14), e.y - rand(10, 40), rand(-30, 30), rand(-30, 30), .15, '#fff59a', 2);
  if (e.freezeT > 0) {
    const w = 40 * e.sc, h = 58 * e.sc;
    ctx.fillStyle = 'rgba(170,230,255,.42)'; ctx.strokeStyle = 'rgba(230,250,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(e.x - w / 2, e.y - h / 2, w, h, 6); ctx.fill(); ctx.stroke();
  }
  if (e.elite && e.hp < e.maxHp) {
    const w = 46 * e.sc * .7, y = e.y - 44 * e.sc;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}
function drawCharge(e, t) {
  const [tx, ty] = tipPos(e), p = clamp(e.ft / e.charge, 0, 1), col = CCOL[e.ck] || '#ffffff';
  const R = (5 + 13 * p) * Math.min(e.sc, 1.6) * (1 + .12 * Math.sin(t * 40));
  if (AIMED[e.ck] && !e.boss) {
    const a = Math.atan2(P.y - ty, P.x - tx);
    ctx.save(); ctx.globalAlpha = .15 + .55 * p; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a) * 170, ty + Math.sin(a) * 170); ctx.stroke(); ctx.restore();
  }
  const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 2.2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.3, col); g.addColorStop(1, col + '00');
  ctx.globalAlpha = .55 + .45 * p; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, R * 2.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 1 - p * .5;
  ctx.beginPath(); ctx.arc(tx, ty, R * 2.6 * (1 - p) + R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
function drawAlly(al, w) {
  const sc = w && w.sc ? w.sc : .55;
  ctx.fillStyle = 'rgba(111,194,58,.3)'; ctx.beginPath(); ctx.ellipse(al.x, al.y + 14, 14, 5, 0, 0, TAU); ctx.fill();
  const spr = al.moving ? 'walk_' + al.face + '_' + ((Math.floor(al.at * 12) % 6) + 1) : 'idle_' + al.face + '_' + ((Math.floor(run.time * 5) % 4) + 1);
  drawSpr(spr, al.x, al.y - 4, sc, 0, P.rageT > 0 ? 'rage' : null);
  if (al.slash > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${al.slash / .15})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(al.x + Math.cos(al.sa) * 16, al.y - 6 + Math.sin(al.sa) * 16, 14, al.sa - 1.2, al.sa + 1.2); ctx.stroke();
  }
}
function drawPlayer(t) {
  const flick = P.inv > 0 && P.dashT <= 0 && Math.floor(t * 20) % 2 === 0;
  if (P.slowT > 0) { ctx.fillStyle = 'rgba(120,210,255,.4)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 14, 22, 8, 0, 0, TAU); ctx.fill(); }
  if (P.sprinting) {
    ctx.strokeStyle = 'rgba(255,240,170,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const o = (i - 1) * 12; ctx.beginPath(); ctx.moveTo(P.x - P.aimX * 30 - P.aimY * o, P.y - 8 - P.aimY * 30 + P.aimX * o); ctx.lineTo(P.x - P.aimX * 55 - P.aimY * o, P.y - 8 - P.aimY * 55 + P.aimX * o); ctx.stroke(); }
  }
  drawSpr(curPlayerSpr(), P.x, P.y - 8, 1, 0, P.rageT > 0 ? 'rage' : null, flick ? .45 : 1);
}
function drawPlayerBars() {
  const y = P.y + (P.mechT > 0 ? 36 : 30), w = P.mechT > 0 ? 60 : 46, f = clamp(P.hp / P.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.beginPath(); ctx.roundRect(P.x - w / 2 - 2, y - 2, w + 4, 9, 3); ctx.fill();
  ctx.fillStyle = f > .5 ? '#6fc23a' : f > .25 ? '#f4d03f' : '#e5484d';
  ctx.beginPath(); ctx.roundRect(P.x - w / 2, y, w * f, 5, 2); ctx.fill();
  if (P.stam < P.stamMax - .5) {
    const s = P.stam / P.stamMax;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.beginPath(); ctx.roundRect(P.x - w / 2 - 2, y + 7, w + 4, 6, 3); ctx.fill();
    ctx.fillStyle = P.exhaust ? '#9a7a3a' : '#ffd84a'; ctx.beginPath(); ctx.roundRect(P.x - w / 2, y + 8.5, w * s, 3, 1.5); ctx.fill();
  }
  if (P.mechT > 0) {
    const m = P.mechT / P.mechMax, my = P.y - 100;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.beginPath(); ctx.roundRect(P.x - 32, my - 2, 64, 9, 3); ctx.fill();
    ctx.fillStyle = m < .25 && Math.floor(performance.now() / 120) % 2 ? '#ff6a3d' : '#e0a83a'; ctx.beginPath(); ctx.roundRect(P.x - 30, my, 60 * m, 5, 2); ctx.fill();
  }
}
function drawMech() {
  const x = P.x, y = P.y, ph = P.moving ? Math.sin(P.anim * 8.7) : 0, bob = Math.abs(ph) * 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 24, 36, 11, 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const lift = Math.max(0, ph * s) * 10, fx = x + s * 17, fy = y + 20 - lift;
    const pts = [[x + s * 12, y - 10 - bob], [x + s * 22, y + 4 - lift * .5], [fx, fy]];
    for (const [lw, c] of [[11, '#0a0f06'], [6, '#6d747c']]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke(); }
    ctx.fillStyle = '#c9973a'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], 4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3d4148'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(fx - 11, fy - 3, 22, 8, 3); ctx.fill(); ctx.stroke();
  }
  const by = y - 24 - bob;
  drawSpr(P.moving ? 'walk_down_' + ((Math.floor(P.anim * 8) % 6) + 1) : 'idle_down_' + ((Math.floor(P.anim * 5) % 4) + 1), x, by - 26, .72, 0, P.rageT > 0 ? 'rage' : null, P.inv > 0 && Math.floor(performance.now() / 50) % 2 ? .6 : 1);
  const side = Math.cos(P.gunA) >= 0 ? 1 : -1;
  ctx.fillStyle = '#4a4f57'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - side * 30 - 9, by - 26, 18, 14, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e5484d'; for (const o of [-4, 4]) { ctx.beginPath(); ctx.arc(x - side * 30 + o, by - 26, 3, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = '#3d4148'; ctx.beginPath(); ctx.rect(x - side * 18 - 4, by - 34, 8, 18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a5f66'; ctx.beginPath(); ctx.rect(x - side * 18 - 6, by - 36, 12, 4); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(x, by - 16, x, by + 18); g.addColorStop(0, '#e8b85a'); g.addColorStop(1, '#8a5a22');
  ctx.fillStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 31, by - 16, 62, 34, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2f36'; ctx.beginPath(); ctx.roundRect(x - 15, by - 2, 30, 12, 3); ctx.fill();
  ctx.strokeStyle = '#e0a83a'; ctx.lineWidth = 1.5; for (const o of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x + o, by); ctx.lineTo(x + o, by + 8); ctx.stroke(); }
  ctx.fillStyle = '#6b4a12'; for (const [ox, oy] of [[-25, -10], [25, -10], [-25, 12], [25, 12]]) { ctx.beginPath(); ctx.arc(x + ox, by + oy, 2.2, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(x + side * 28, by + 2); ctx.rotate(P.gunA);
  ctx.fillStyle = '#5d636b'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-6, -7, 20, 14, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d4148'; ctx.beginPath(); ctx.roundRect(12, -4, 22, 8, 2); ctx.fill(); ctx.stroke();
  if (P.gunFlash > 0) { ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.moveTo(34, -7); ctx.lineTo(48, 0); ctx.lineTo(34, 7); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
// Menü-Szene
const demo = [];
function renderMenuScene(t) {
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

// ---------- HUD ----------
const hudCache = {};
function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setAbil(id, p, ready, on = false) {
  const b = $(id), ps = clamp(p, 0, 1).toFixed(3);
  if (hudCache[id + 'p'] !== ps) { hudCache[id + 'p'] = ps; b.style.setProperty('--p', ps); }
  if (hudCache[id + 'r'] !== ready) { hudCache[id + 'r'] = ready; b.classList.toggle('ready', ready); }
  if (hudCache[id + 'o'] !== on) { hudCache[id + 'o'] = on; b.classList.toggle('on', on); }
}
function updHud(dt) {
  if (!run) return;
  $('#xpFill').style.width = (P.xp / P.need * 100).toFixed(1) + '%';
  setTxt('#lvTxt', 'Lv ' + P.lv);
  setTxt('#killTxt', String(run.kills));
  setTxt('#goldTxt', String(run.gold));
  setTxt('#timeTxt', run.st.endless ? fmtTime(run.time) : fmtTime(Math.min(run.time, STAGE_LEN)));
  setAbil('#ultBtn', P.ult / P.ultNeed, P.ult >= P.ultNeed, P.rageT > 0);
  setAbil('#dashBtn', 1 - Math.max(0, P.dashCd) / 2.4, P.dashCd <= 0);
  setAbil('#sprintBtn', P.stam / P.stamMax, !P.exhaust, P.sprinting);
  setAbil('#mechBtn', P.mechT > 0 ? P.mechT / P.mechMax : P.scrap / 100, P.scrap >= 100, P.mechT > 0);
  if (run.boss) $('#bossFill').style.width = (Math.max(0, run.boss.hp / run.boss.maxHp) * 100).toFixed(1) + '%';
  if (!run.paused) {
    run.hintT -= dt;
    if (run.hintT <= 0) {
      const h = $('#hint');
      if (run.hints.length) { h.innerHTML = run.hints.shift(); h.hidden = false; h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; run.hintT = 3.6; }
      else if (!h.hidden) h.hidden = true;
    }
  }
}
function slotHtml(ic, lv, evo) { return `<div class="slot${evo ? ' evo' : ''}"><img src="${ic}" alt=""><i>${evo ? '★' : lv}</i></div>`; }
function refreshSlots() {
  $('#wSlots').innerHTML = run.weapons.map(w => slotHtml(icon(w.evo ? w.id + '_evo' : w.id), w.lv, w.evo)).join('');
  $('#pSlots').innerHTML = Object.entries(run.passives).map(([id, lv]) => slotHtml(icon(id), lv, false)).join('');
}
function banner(txt, cls) { const b = $('#banner'); b.className = ''; void b.offsetWidth; b.textContent = txt; b.className = 'show ' + (cls || ''); }

// ---------- Level-Up ----------
let curChoices = [];
function genChoices() {
  const pool = [], owned = new Set(run.weapons.map(w => w.id));
  for (const w of run.weapons) {
    const D = WEAPONS[w.id];
    if (!w.evo && w.lv >= 5 && run.passives[D.with]) pool.push({ k: 'evo', id: w.id, wgt: 1000 });
    else if (w.lv < 5) pool.push({ k: 'upW', id: w.id, wgt: 10 });
  }
  if (run.weapons.length < 6) for (const id in WEAPONS) if (!owned.has(id)) pool.push({ k: 'newW', id, wgt: 6 });
  const pc = Object.keys(run.passives).length;
  for (const id in PASSIVES) {
    const lv = run.passives[id] || 0;
    if (lv > 0 && lv < 5) pool.push({ k: 'upP', id, wgt: 8 });
    else if (lv === 0 && pc < 6) pool.push({ k: 'newP', id, wgt: 4 });
  }
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = 0; for (const p of pool) tot += p.wgt;
    let r = Math.random() * tot, i = 0;
    for (; i < pool.length; i++) { r -= pool[i].wgt; if (r <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  if (out.length < 3) { out.push({ k: 'heal' }); if (out.length < 3) out.push({ k: 'gold' }); }
  return out.slice(0, 3);
}
function pipHtml(cur, next) { let s = '<div class="lvpips">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= cur ? 'on' : i === next ? 'nx' : ''}"></i>`; return s + '</div>'; }
function cardHtml(c, i) {
  let ic, t, d, tag = '', hint = '', pips = '', cls = 'card';
  if (c.k === 'newW' || c.k === 'upW') {
    const D = WEAPONS[c.id], w = run.weapons.find(x => x.id === c.id), lv = w ? w.lv : 0;
    ic = icon(c.id); t = D.name; d = D.info[lv]; pips = pipHtml(lv, lv + 1);
    tag = lv ? '' : '<span class="tagx new">Neue Waffe</span>';
    hint = 'Entwicklung mit ' + PASSIVES[D.with].name;
  } else if (c.k === 'evo') {
    const D = WEAPONS[c.id]; ic = icon(c.id + '_evo'); t = D.evo; d = D.evoInfo; cls += ' evo'; tag = '<span class="tagx">Entwicklung</span>';
  } else if (c.k === 'newP' || c.k === 'upP') {
    const D = PASSIVES[c.id], lv = run.passives[c.id] || 0;
    ic = icon(c.id); t = D.name; d = D.info; pips = pipHtml(lv, lv + 1);
    tag = lv ? '' : '<span class="tagx new">Neu</span>';
    const evoFor = Object.values(WEAPONS).find(w => w.with === c.id); if (evoFor) hint = 'Entwickelt ' + evoFor.name;
  } else if (c.k === 'heal') { ic = icon('heal'); t = 'Goblin-Eintopf'; d = 'Heilt 40 % deines Lebens.'; }
  else { ic = icon('gold'); t = 'Goldbeutel'; d = '+25 Gold'; }
  return `<button class="${cls}" data-i="${i}"><span class="k">${i + 1}</span><img src="${ic}" alt=""><span class="body"><span class="t">${t}</span>${tag}${pips}<span class="d">${d}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</span></button>`;
}
function openLevelUp(chest) {
  run.paused = true; Music.stop(); sprintHeld = false;
  curChoices = genChoices();
  $('#lvTitle').textContent = chest ? 'Schatztruhe!' : 'Level ' + P.lv + '!';
  renderCards(); $('#levelup').hidden = false; sfx.cards();
}
function renderCards() {
  $('#cards').innerHTML = curChoices.map(cardHtml).join('');
  const rb = $('#rerollBtn'); rb.textContent = `Neu würfeln (${run.rerolls})`; rb.disabled = run.rerolls <= 0;
}
$('#cards').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  applyChoice(curChoices[+b.dataset.i]);
  $('#levelup').hidden = true; run.paused = false; Music.start();
  sfx.pickCard();
});
$('#rerollBtn').addEventListener('click', () => { if (run.rerolls <= 0) return; run.rerolls--; curChoices = genChoices(); renderCards(); sfx.cards(); });
function applyChoice(c) {
  if (c.k === 'newW') addWeapon(c.id);
  else if (c.k === 'upW') run.weapons.find(w => w.id === c.id).lv++;
  else if (c.k === 'evo') { run.weapons.find(w => w.id === c.id).evo = true; banner(WEAPONS[c.id].evo + '!', ''); }
  else if (c.k === 'newP' || c.k === 'upP') run.passives[c.id] = (run.passives[c.id] || 0) + 1;
  else if (c.k === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .4);
  else if (c.k === 'gold') run.gold += 25;
  recalc(); refreshSlots();
}

// ---------- Pause / Ende ----------
function openPause() {
  if (!run || run.over) return;
  run.paused = true; Music.stop(); sprintHeld = false;
  const st = [
    ['Leben', Math.ceil(P.hp) + ' / ' + P.maxHp], ['Schaden', '+' + Math.round((P.dmgMult - 1) * 100) + ' %'], ['Abklingzeit', '−' + Math.round((1 - P.cdMult) * 100) + ' %'],
    ['Fläche', '+' + Math.round((P.area - 1) * 100) + ' %'], ['Tempo', Math.round(P.speed)], ['Sammelradius', Math.round(P.magnet)],
    ['Krit-Chance', Math.round(P.crit * 100) + ' %'], ['Schrott', Math.floor(P.scrap) + ' %'],
  ];
  $('#buildList').innerHTML = `<div class="slots">${run.weapons.map(w => slotHtml(icon(w.evo ? w.id + '_evo' : w.id), w.lv, w.evo)).join('')}</div>
    <div class="slots">${Object.entries(run.passives).map(([id, lv]) => slotHtml(icon(id), lv, false)).join('')}</div>
    <div class="statgrid">${st.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
  $('#pause').hidden = false;
}
function resume() { $('#pause').hidden = true; if (run && $('#levelup').hidden) { run.paused = false; Music.start(); } }
function gameOver(win) {
  if (run.over) return;
  run.over = true; run.paused = true; Music.stop(); sprintHeld = false;
  let bonus = 0;
  if (win) { bonus = 60 + run.si * 50; save.cleared[run.si] = true; save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, run.si + 2)); sfx.chest(); }
  else sfx.death();
  save.best[run.si] = Math.max(save.best[run.si] || 0, Math.floor(run.time));
  save.gold += run.gold + bonus; persist();
  $('#overTitle').textContent = win ? 'Stage geschafft!' : 'Besiegt!';
  const res = [['Zeit', fmtTime(run.time)], ['Level', P.lv], ['Besiegt', run.kills], ['Gold', '+' + (run.gold + bonus)]];
  $('#overStats').innerHTML = res.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('#nextBtn').hidden = !(win && run.si + 1 < STAGES.length);
  $('#againBtn').textContent = win ? 'Nochmal' : 'Nochmal versuchen';
  setTimeout(() => { $('#over').hidden = false; }, win ? 200 : 700);
}

// ---------- Menüs ----------
const SCREENS = ['#menu', '#stages', '#shop', '#howto'];
function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  if (id) { mode = 'menu'; Music.stop(); $('#hud').hidden = true; $('#ctrl').hidden = true; $('#hint').hidden = true; for (const o of ['#levelup', '#pause', '#over']) $(o).hidden = true; run = null; }
  if (id === '#menu') $('#menuGold').textContent = save.gold;
  if (id === '#stages') renderStages();
  if (id === '#shop') renderShop();
}
function renderStages() {
  const g = $('#stageGrid'); g.innerHTML = '';
  STAGES.forEach((st, i) => {
    const locked = i + 1 > save.unlocked;
    const b = document.createElement('button');
    b.className = 'stage'; b.disabled = locked;
    const best = save.best[i] ? 'Bestzeit ' + fmtTime(save.best[i]) : '';
    b.innerHTML = `<div class="thumb"><span class="num">${st.endless ? '∞' : i + 1}</span>${save.cleared[i] ? '<span class="chip">Geschafft</span>' : ''}</div>
      <div class="info"><b>${st.name}</b><small>${locked ? 'Gesperrt. Schaffe zuerst Stage ' + i + '.' : st.sub}</small>${best ? `<small>${best}</small>` : ''}</div>`;
    const tc = document.createElement('canvas'); tc.width = 300; tc.height = 110;
    const tg = tc.getContext('2d'); tg.drawImage(stageTile(i).c, 0, 60, 300, 110, 0, 0, 300, 110);
    const e = SPR[st.boss.pre + 'idle_left_1'];
    if (e) tg.drawImage(st.boss.tint ? tinted(e, st.boss.tint) : e.c, 190, -6, 120, 120);
    if (SPR.idle_right_1) tg.drawImage(SPR.idle_right_1.c, 100, 18, 90, 90);
    b.querySelector('.thumb').prepend(tc);
    b.addEventListener('click', () => { audioInit(); sfx.pickCard(); newRun(i); });
    g.appendChild(b);
  });
}
function renderShop() {
  $('#shopGold').textContent = save.gold;
  $('#shopList').innerHTML = SHOP.map(s => {
    const lv = save.shop[s.id] || 0, max = lv >= s.max, cost = shopCost(s, lv);
    let pips = ''; for (let i = 0; i < s.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
    return `<div class="shopitem"><img src="${icon(s.icon)}" alt=""><span class="t">${s.name}</span><span class="d">${s.desc} pro Stufe</span>
      <div class="pips">${pips}</div>
      <button class="btn ${max ? 'ghost' : 'primary'}" data-buy="${s.id}" ${max || save.gold < cost ? 'disabled' : ''}>${max ? 'Maximal' : `<span class="coin"></span>${cost}`}</button></div>`;
  }).join('');
}
$('#shopList').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'); if (!b) return;
  const s = SHOP.find(x => x.id === b.dataset.buy), lv = save.shop[s.id] || 0, cost = shopCost(s, lv);
  if (lv >= s.max || save.gold < cost) { sfx.buzz(); return; }
  save.gold -= cost; save.shop[s.id] = lv + 1; persist(); sfx.buy(); renderShop();
});
$('#playBtn').addEventListener('click', () => showScreen('#stages'));
$('#shopBtn').addEventListener('click', () => showScreen('#shop'));
$('#howBtn').addEventListener('click', () => showScreen('#howto'));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => showScreen('#menu')));
$('#muteBtn').addEventListener('click', () => setMute(!save.mute));
$('#pMuteBtn').addEventListener('click', () => setMute(!save.mute));
$('#musicBtn').addEventListener('click', () => setMusic(!save.musicOff));
$('#pMusicBtn').addEventListener('click', () => setMusic(!save.musicOff));
$('#pauseBtn').addEventListener('click', () => openPause());
$('#resumeBtn').addEventListener('click', resume);
$('#quitBtn').addEventListener('click', () => { $('#pause').hidden = true; gameOver(false); });
$('#againBtn').addEventListener('click', () => newRun(run.si));
$('#nextBtn').addEventListener('click', () => newRun(run.si + 1));
$('#menuBtn').addEventListener('click', () => showScreen('#menu'));
for (const [id, fn] of [['#dashBtn', doDash], ['#ultBtn', doUlt], ['#mechBtn', startMech]]) {
  $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); fn(); });
}
{
  const sb = $('#sprintBtn');
  sb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); sprintHeld = true; try { sb.setPointerCapture(e.pointerId); } catch (_) {} });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) sb.addEventListener(ev, () => { sprintHeld = false; });
}
document.querySelectorAll('#ctrl button').forEach(b => b.addEventListener('contextmenu', e => e.preventDefault()));

// ---------- Schleife ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (mode === 'play' && run && !run.paused) {
    if (run.lvDelay > 0) { run.lvDelay -= dt; update(dt * .25); if (run.lvDelay <= 0 && !run.over) openLevelUp(run.lvKind === 'chest'); }
    else update(dt);
  }
  render(now);
  if (mode === 'play') updHud(dt);
  requestAnimationFrame(frame);
}
(async function boot() {
  resize();
  await loadAssets();
  if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {} }
  document.querySelectorAll('[data-icon]').forEach(im => { im.src = icon(im.dataset.icon); });
  setMute(save.mute); setMusic(save.musicOff);
  $('#loading').hidden = true;
  showScreen('#menu');
  requestAnimationFrame(frame);
})();
