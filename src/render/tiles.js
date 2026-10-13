import { STAGES } from '../data/stages.js';
import { ctx } from './canvas.js';
import { mk } from './proc.js';
import { mulberry32 } from '../core/rng.js';
import { GRASS_IMG } from './sprites.js';

export const TILE_CACHE = [];
export function stageTile(i) {
  if (TILE_CACHE[i]) return TILE_CACHE[i];
  const st = STAGES[i];
  const c = mk(574, 431, g => {
    if (GRASS_IMG) g.drawImage(GRASS_IMG, 0, 0, 574, 431); else { g.fillStyle = '#5fae3a'; g.fillRect(0, 0, 574, 431); }
    if (st.tint) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = st.tint[1]; g.fillStyle = st.tint[0]; g.fillRect(0, 0, 574, 431); }
    // Farbton der Welt (Mischmodus „color“: Helligkeit des Grases bleibt, nur die Farbe wechselt)
    if (st.hue) { g.globalCompositeOperation = 'color'; g.globalAlpha = st.hue[1]; g.fillStyle = st.hue[0]; g.fillRect(0, 0, 574, 431); }
    if (st.dark) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = st.dark; g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, 574, 431); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (DECO[st.deco]) paintDeco(g, DECO[st.deco], i);
  });
  TILE_CACHE[i] = { c, pat: null };
  return TILE_CACHE[i];
}
export function drawGround(si, x, y, w, h) { const tc = stageTile(si); if (!tc.pat) tc.pat = ctx.createPattern(tc.c, 'repeat'); ctx.fillStyle = tc.pat; ctx.fillRect(x, y, w, h); }

// ---------- Boden-Deko je Welt (PLAN 6.1) ----------
// Wird einmal in die Kachel gemalt; jedes Teil auch versetzt um eine Kachelbreite/-höhe, damit die Nähte nicht schneiden.
// Einträge: [Anzahl, Maler(g, x, y, r = Zufall 0–1)]
const TW = 574, TH = 431, OL = '#1d2b14';
function paintDeco(g, list, seed) {
  const R = mulberry32(seed * 7919 + 13);
  for (const [n, fn] of list) for (let i = 0; i < n; i++) {
    const x = R() * TW, y = R() * TH, r = R();
    for (const ox of [0, -TW, TW]) for (const oy of [0, -TH, TH]) { g.save(); g.translate(x + ox, y + oy); fn(g, r); g.restore(); }
  }
}
const blob = (g, w, h, fill, a = 1) => { g.globalAlpha = a; g.fillStyle = fill; g.beginPath(); g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; };
const stone = (g, s, fill = '#8a8a82') => { g.fillStyle = fill; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(-s, s * .4); g.lineTo(-s * .7, -s * .5); g.lineTo(s * .3, -s * .7); g.lineTo(s, s * .1); g.lineTo(s * .6, s * .6); g.closePath(); g.fill(); g.stroke(); };
const flower = (g, c) => { for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.fillStyle = c; g.beginPath(); g.arc(Math.cos(a) * 3, Math.sin(a) * 3, 2.3, 0, 7); g.fill(); } g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(0, 0, 1.8, 0, 7); g.fill(); };
const mush = (g, s, cap = '#d6402e') => { g.fillStyle = '#efe4c4'; g.strokeStyle = OL; g.lineWidth = 1.5; g.fillRect(-s * .25, -s * .6, s * .5, s * .8); g.strokeRect(-s * .25, -s * .6, s * .5, s * .8); g.fillStyle = cap; g.beginPath(); g.moveTo(-s, -s * .5); g.quadraticCurveTo(0, -s * 1.7, s, -s * .5); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-s * .35, -s * .9, s * .15, 0, 7); g.arc(s * .3, -s * .8, s * .12, 0, 7); g.fill(); };
const DECO = {
  meadow: [[14, (g, r) => flower(g, r < .5 ? '#ffffff' : '#c99bff')], [6, (g, r) => stone(g, 5 + r * 5)]],
  snow: [[9, (g, r) => blob(g, 26 + r * 30, 12 + r * 10, '#f2f8ff', .85)], [6, (g, r) => { g.fillStyle = '#bfe9ff'; g.strokeStyle = OL; g.lineWidth = 1.5; const s = 5 + r * 6; g.beginPath(); g.moveTo(0, -s * 1.6); g.lineTo(s * .5, 0); g.lineTo(0, s * .4); g.lineTo(-s * .5, 0); g.closePath(); g.fill(); g.stroke(); }], [5, (g, r) => stone(g, 5 + r * 4, '#9aa8b4')]],
  swamp: [[7, (g, r) => { blob(g, 30 + r * 26, 13 + r * 8, '#3e5a2a', .75); blob(g, 20 + r * 16, 8 + r * 5, '#5d7a2e', .6); for (let k = 0; k < 3; k++) { g.strokeStyle = 'rgba(200,255,140,.6)'; g.lineWidth = 1.5; g.beginPath(); g.arc(-10 + k * 9, -2 + (k % 2) * 3, 2 + k, 0, 7); g.stroke(); } }], [8, (g, r) => mush(g, 5 + r * 5, r < .5 ? '#d6402e' : '#a0703a')]],
  graves: [[6, (g, r) => { const w = 12 + r * 6; g.fillStyle = '#8f8a96'; g.strokeStyle = OL; g.lineWidth = 2; g.beginPath(); g.moveTo(-w / 2, 6); g.lineTo(-w / 2, -14); g.quadraticCurveTo(0, -24, w / 2, -14); g.lineTo(w / 2, 6); g.closePath(); g.fill(); g.stroke(); g.strokeStyle = '#5a5662'; g.beginPath(); g.moveTo(0, -14); g.lineTo(0, -2); g.moveTo(-4, -9); g.lineTo(4, -9); g.stroke(); g.translate(0, 8); blob(g, w * .8, 4, '#3a3540', .5); }],
    [8, (g, r) => { g.rotate(r * 6); g.fillStyle = '#ece4cf'; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.roundRect(-8, -2, 16, 4, 2); g.fill(); g.stroke(); for (const sx of [-8, 8]) { g.beginPath(); g.arc(sx, -2, 2.5, 0, 7); g.arc(sx, 2, 2.5, 0, 7); g.fill(); } }]],
  mirrors: [[6, (g, r) => { g.rotate(r * 6); g.fillStyle = 'rgba(200,190,255,.85)'; g.strokeStyle = OL; g.lineWidth = 1.5; const s = 6 + r * 7; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * .7, s * .2); g.lineTo(-s * .3, s * .8); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(-1, -s * .4, 2, s * .5); }],
    [26, (g, r) => { g.fillStyle = r < .5 ? 'rgba(255,240,180,.9)' : 'rgba(210,180,255,.9)'; g.beginPath(); g.arc(0, 0, 1 + r * 1.5, 0, 7); g.fill(); }]],
  cliffs: [[8, (g, r) => stone(g, 8 + r * 10, r < .5 ? '#7d8590' : '#6a717b')], [4, (g, r) => { g.rotate(r * 6); g.strokeStyle = 'rgba(30,25,20,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-16, -4); g.lineTo(-5, 3); g.lineTo(2, -5); g.lineTo(14, 4); g.stroke(); }]],
  chasm: [[5, (g, r) => { g.rotate(r * 6); g.strokeStyle = 'rgba(40,20,10,.8)'; g.lineWidth = 6; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-8, 5); g.lineTo(6, -4); g.lineTo(24, 2); g.stroke(); g.strokeStyle = 'rgba(255,120,30,.85)'; g.lineWidth = 2.5; g.stroke(); }],
    [7, (g, r) => { const c = r < .5 ? '#8fe6ff' : '#c99bff'; for (const [x, h] of [[-5, 12], [0, 18], [5, 10]]) { g.fillStyle = c; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 3, 0); g.lineTo(x, -h * (.7 + r * .5)); g.lineTo(x + 3, 0); g.closePath(); g.fill(); g.stroke(); } }], [5, (g, r) => stone(g, 6 + r * 6, '#7a6650')]],
  tower: [[6, (g, r) => { g.strokeStyle = `rgba(200,150,255,${.35 + r * .3})`; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 22, 14, 0, 0, 7); g.stroke(); for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.fillStyle = 'rgba(220,190,255,.7)'; g.fillRect(Math.cos(a) * 15 - 1.5, Math.sin(a) * 9 - 3, 3, 6); } }],
    [4, (g, r) => { const c = ['#7a2a2a', '#2a4a7a', '#4a6a2a', '#6a4a8a']; for (let k = 0; k < 3; k++) { g.fillStyle = c[(k + Math.floor(r * 4)) % 4]; g.strokeStyle = OL; g.lineWidth = 1.5; g.beginPath(); g.roundRect(-9 + k, -k * 5, 18, 5, 1); g.fill(); g.stroke(); } }]],
  night: [[18, (g, r) => { g.fillStyle = `rgba(200,210,255,${.4 + r * .4})`; g.beginPath(); g.arc(0, 0, 1 + r, 0, 7); g.fill(); }], [5, (g, r) => stone(g, 5 + r * 5, '#4a5070')]],
};
