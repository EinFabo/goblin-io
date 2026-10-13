import { audioInit, chargeTone, sfx } from '../core/audio.js';
import { abilState, persist } from '../core/save.js';
import { $ } from '../core/util.js';
import { ABIL_MAX_LV, ROWS, TREE, abilXpNeed, canLearn, nodeInfo, pointsBelow, rowOf, rowOpen, smokeAtkSlow, spentPoints, treeDef, xpPerUse } from '../data/abilities.js';
import { icon } from '../render/icons.js';

// ---------- Skill Tree v2 (PLAN 8.4): knorriger Goblin-Baum, Halten zum Lernen ----------
// Bild: SVG-Baum (Stamm, Äste, Wurzeln) mit grünem Saft, darüber Knöpfe für die Knoten und eine
// Partikel-Fläche. Ein Knoten wird gelernt, indem man ihn gedrückt hält (Ring füllt sich, Ton steigt);
// weiter halten lernt den nächsten Rang schneller. Kurz tippen wählt nur aus.

const VW = 400, VH = 540;
// Lage der Knoten im Bild (viewBox-Koordinaten); Stamm läuft von unten (200,540) nach oben
const POS = { pow: [86, 452], cd: [200, 474], area: [314, 452], s1: [92, 322], a: [200, 300], s2: [308, 322], s3: [128, 190], b: [272, 190], m: [200, 70] };
// Stamm-Höhe, ab der eine Reihe beginnt (für den Saft im Stamm)
const ROW_Y = [520, 392, 258, 128, 82];
const TRUNK = 'M200 540 C 188 500, 214 470, 202 430 S 186 360, 200 320 S 216 250, 198 210 S 186 140, 200 82';
// Äste vom Stamm zum Knoten (Wurzeln für die unterste Reihe)
const BRANCH = {
  pow: 'M196 520 C 170 516, 120 500, 86 452', cd: 'M200 528 C 200 510, 200 494, 200 474', area: 'M204 520 C 232 516, 280 500, 314 452',
  s1: 'M200 384 C 172 372, 120 360, 92 322', a: 'M201 340 C 201 324, 200 312, 200 300', s2: 'M202 384 C 232 372, 282 360, 308 322',
  s3: 'M199 250 C 180 238, 146 222, 128 190', b: 'M200 250 C 222 238, 256 222, 272 190', m: 'M200 100 C 200 90, 200 80, 200 70',
};
// Kleine Zweige ohne Knoten, nur für die Form
const TWIGS = ['M190 400 C 160 392, 150 380, 140 368', 'M210 280 C 240 270, 252 262, 262 250', 'M196 160 C 176 150, 168 140, 160 126', 'M204 140 C 226 130, 236 118, 244 104'];
// Symbole der Wurzel-Knoten
const GLYPH = {
  bolt: '<path d="M14 2 L5 14 h6 l-2 8 l9 -12 h-6 z" fill="#ffe45c" stroke="#1a1408" stroke-width="1.6" stroke-linejoin="round"/>',
  hourglass: '<path d="M6 3 h12 M6 21 h12 M7 3 c0 6 10 6 10 9 s-10 3 -10 9 M17 3 c0 6 -10 6 -10 9 s10 3 10 9" fill="none" stroke="#bfe8ff" stroke-width="2.2" stroke-linecap="round"/><path d="M9 19 h6 l-3 -3 z" fill="#f4d03f"/>',
  rings: '<circle cx="12" cy="12" r="3" fill="#b98cff"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#b98cff" stroke-width="2"/><circle cx="12" cy="12" r="10" fill="none" stroke="#b98cff" stroke-width="1.6" stroke-dasharray="3 2.5"/>',
  arrows: '<path d="M3 12 h14 M13 7 l5 5 l-5 5 M3 7 l4 5 l-4 5" fill="none" stroke="#bfe8ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M12 2 l8 3 v6 c0 6 -4 9 -8 11 c-4 -2 -8 -5 -8 -11 v-6 z" fill="#c9d1d8" stroke="#1a1408" stroke-width="1.6"/><path d="M12 6 v12" stroke="#7d858c" stroke-width="2"/>',
  heart: '<path d="M12 21 C 4 15, 2 10, 5 6 C 8 3, 11 5, 12 7 C 13 5, 16 3, 19 6 C 22 10, 20 15, 12 21 z" fill="#ff6b6b" stroke="#1a1408" stroke-width="1.6"/>',
  leaf: '<path d="M4 20 C 4 10, 10 4, 20 4 C 20 14, 14 20, 4 20 z" fill="#7be04a" stroke="#1a1408" stroke-width="1.6"/><path d="M5 19 L 15 9" stroke="#2f6a17" stroke-width="1.6"/>',
};
const ROOT_GLYPH = { dash: { pow: 'hourglass', cd: 'arrows', area: 'shield' }, sprint: { pow: 'heart', cd: 'leaf', area: 'arrows' } };
const DEF_GLYPH = { pow: 'bolt', cd: 'hourglass', area: 'rings' };
const KIND_TXT = { root: 'Wurzel', skill: 'Eigener Skill', extra: 'Extra', master: 'Meister' };

let id = null, sel = 'pow', onChange = () => {};
const st = () => abilState(id);
const free = () => st().lv - 1 - spentPoints(st().pts);

export function openTree(which, changed) {
  id = which; onChange = changed || (() => {});
  sel = firstLearnable() || 'pow';
  build(); render(false);
  $('#tree').hidden = false; sfx.treeOpen();
  nodeBtn(sel).focus({ preventScroll: true });   // Tastatur: Pfeile, Leertaste und Escape gehen sofort
  startFx();
}
function firstLearnable() { for (const R of ROWS) for (const k of R.keys) if (canLearn(st(), k)) return k; return null; }

// ---------- Aufbau ----------
function build() {
  const D = treeDef(id), g = ROOT_GLYPH[id] || DEF_GLYPH;
  $('#treeTitle').textContent = D.name;
  const bark = d => `<path d="${d}" class="bark-o"/><path d="${d}" class="bark"/>`;
  $('#treeSvg').innerHTML = `
    <defs><radialGradient id="tglow" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#2d4a22"/><stop offset="1" stop-color="#0d140a"/></radialGradient>
      <filter id="tsap" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect width="${VW}" height="${VH}" fill="url(#tglow)"/>
    <circle cx="330" cy="62" r="26" fill="#f2f6e6" opacity=".12"/><circle cx="330" cy="62" r="16" fill="#f2f6e6" opacity=".18"/>
    <path d="M0 520 C 80 506, 140 512, 200 508 S 330 500, 400 516 V540 H0 Z" fill="#1d2b14"/>
    ${TWIGS.map(bark).join('')}
    ${Object.values(BRANCH).map(bark).join('')}
    <path d="${TRUNK}" class="bark-o trunk"/><path d="${TRUNK}" class="bark trunk"/>
    <path d="M186 470 q6 -4 10 2 M210 360 q-6 -5 -11 1 M192 236 q7 -3 10 3" class="knot"/>
    <path d="${TRUNK}" pathLength="1" class="sap trunk" id="tSapTrunk"/>
    ${Object.entries(BRANCH).map(([k, d]) => `<path d="${d}" pathLength="1" class="sap" data-sap="${k}"/>`).join('')}`;
  $('#treeNodes').innerHTML = ROWS.flatMap(R => R.keys).map(k => {
    const n = nodeInfo(id, k), [x, y] = POS[k];
    const inner = n.kind === 'root' ? `<svg viewBox="0 0 24 24" class="glyph">${GLYPH[g[k]]}</svg>` : `<img src="${icon(D.icon || id)}" alt="">`;
    return `<button class="tn ${n.kind}" data-node="${k}" style="left:${x / VW * 100}%;top:${y / VH * 100}%" aria-label="${n.name}">
      <svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" pathLength="1"/></svg>
      ${n.kind === 'master' ? '<span class="crown"></span>' : ''}${inner}<span class="pips"></span></button>`;
  }).join('');
}

// ---------- Zustand zeichnen ----------
// anim: Saft fließt sichtbar (nach dem Lernen); sonst sofort
function render(anim = true) {
  const s = st(), f = free(), D = treeDef(id);
  const pct = s.lv >= ABIL_MAX_LV ? 100 : Math.min(100, s.xp / abilXpNeed(s.lv) * 100);
  const extra = id === 'smoke' ? ` · Angriff im Rauch −${Math.round(smokeAtkSlow(s.pts.s1) * 100)} %` : '';
  $('#treeInfo').innerHTML = `<img src="${icon(D.icon || id)}" alt=""><span>Level <b>${s.lv}</b> / ${ABIL_MAX_LV}<i class="tbar"><i style="width:${pct.toFixed(0)}%"></i></i>
    <small>${s.lv < ABIL_MAX_LV ? `${Math.floor(s.xp)} / ${abilXpNeed(s.lv)} XP · ` : ''}+${xpPerUse(id)} XP ${id === 'sprint' ? 'pro Sekunde Sprint' : 'pro Einsatz'}${extra}</small></span>
    <b class="free${f > 0 ? ' has' : ''}">${f} Punkt${f === 1 ? '' : 'e'} frei</b>`;
  document.querySelectorAll('#treeNodes .tn').forEach(b => {
    const k = b.dataset.node, N = TREE[k], have = s.pts[k] || 0, open = rowOpen(s.pts, rowOf(k));
    b.classList.toggle('locked', !open);
    b.classList.toggle('can', canLearn(s, k));
    b.classList.toggle('some', have > 0 && have < N.max);
    b.classList.toggle('full', have >= N.max);
    b.classList.toggle('sel', k === sel);
    b.querySelector('.pips').innerHTML = N.max > 1 ? Array.from({ length: N.max }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('') : '';
    const sap = $(`[data-sap="${k}"]`);
    sap.classList.toggle('anim', anim); sap.style.strokeDashoffset = String(1 - have / N.max);
    sap.classList.toggle('full', have >= N.max);
  });
  // Saft im Stamm: bis zur höchsten offenen Reihe, dazu der Fortschritt zur nächsten
  let r = 0; while (r + 1 < ROWS.length && rowOpen(s.pts, r + 1)) r++;
  const toY = y => (540 - y) / (540 - 82);
  let fill = toY(ROW_Y[r + 1]);
  if (r + 1 < ROWS.length) fill = toY(ROW_Y[r]) + (toY(ROW_Y[r + 1]) - toY(ROW_Y[r])) * Math.min(1, pointsBelow(s.pts, r + 1) / ROWS[r + 1].req);
  const trunk = $('#tSapTrunk'); trunk.classList.toggle('anim', anim); trunk.style.strokeDashoffset = String(1 - fill);
  $('#treeReset').disabled = spentPoints(s.pts) === 0;
  renderNote();
}

function renderNote() {
  const s = st(), k = sel, n = nodeInfo(id, k), have = s.pts[k] || 0, r = rowOf(k), open = rowOpen(s.pts, r), f = free();
  let state;
  if (have >= n.max) state = `<p class="ok">${n.max > 1 ? 'Voll ausgebaut' : 'Gelernt'}</p>`;
  else if (!open) state = `<p class="lock">Braucht ${ROWS[r].req} Punkte in den Reihen darunter (${pointsBelow(s.pts, r)} / ${ROWS[r].req})</p>`;
  else if (f < n.cost) state = `<p class="lock">${n.cost > 1 ? `Kostet ${n.cost} Punkte` : 'Kostet 1 Punkt'} – ${f ? `nur ${f} frei` : 'keine Punkte frei'}. Fähigkeit benutzen bringt XP.</p>`;
  else state = `<button class="btn primary hold" data-hold>Gedrückt halten zum Lernen${n.cost > 1 ? ` (${n.cost} Punkte)` : ''}</button>`;
  $('#treeNote').innerHTML = `<span class="kind ${n.kind}">${KIND_TXT[n.kind]}</span><h3>${n.name}</h3>
    <p class="rank">${n.max > 1 ? `Rang ${have} / ${n.max}` : `${n.cost} Punkt${n.cost > 1 ? 'e' : ''}`}</p><p>${n.desc}</p>${state}`;
}

// ---------- Halten zum Lernen ----------
let hold = null;   // { k, t, dur, tone, btn }
function startHold(k, btn) {
  audioInit();
  if (sel !== k) { sel = k; render(false); }
  // Nur ein Halten zur Zeit: ein zweiter Finger oder Leertaste + Maus beendet das alte sauber
  const chain = !!(hold && hold.chain);
  if (hold && hold.tone) endHold(false);
  if (!canLearn(st(), k)) { hold = null; if (!(st().pts[k] >= TREE[k].max)) { sfx.buzz(); shake(btn); } return; }
  const n = spentPoints(st().pts), dur = chain ? .4 : .6;
  hold = { k, t: 0, dur, btn, chain: false, tone: chargeTone(n, dur) };
  btn.classList.add('charging');
}
function endHold(ok) {
  if (!hold || !hold.tone) { hold = null; return; }
  hold.tone.stop(ok || hold.t < .12);   // nur angetippt: leise aus, kein Abbruch-Ton
  const b = nodeBtn(hold.k); b.classList.remove('charging'); b.style.setProperty('--c', 0);
  hold = null;
}
const nodeBtn = k => $(`#treeNodes [data-node="${k}"]`);
function shake(b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }

function learn(k) {
  const s = st(), before = ROWS.map((_, r) => rowOpen(s.pts, r));
  s.pts[k] = (s.pts[k] || 0) + 1; persist();
  const full = s.pts[k] >= TREE[k].max, b = nodeBtn(k);
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  const [x, y] = POS[k];
  burst(x, y, k === 'm' ? 70 : full ? 46 : 30, full ? '#f4d03f' : '#8be04a');
  if (k === 'm') { sfx.master(); flash(); } else sfx.learn(spentPoints(s.pts), full);
  render(true);
  // Neue Reihe offen: ihre Knoten sprießen
  ROWS.forEach((R, r) => {
    if (before[r] || !rowOpen(s.pts, r)) return;
    setTimeout(() => { sfx.sprout(); for (const kk of R.keys) { const nb = nodeBtn(kk); nb.classList.remove('sprout'); void nb.offsetWidth; nb.classList.add('sprout'); leaves(...POS[kk]); } }, 380);
  });
  onChange();
}
function flash() { const f = $('#treeFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

// ---------- Partikel (eigene Canvas über dem Baum) ----------
let parts = [], raf = 0, lastT = 0;
function startFx() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if ($('#tree').hidden) { raf = 0; endHold(false); parts = []; return; }
  raf = requestAnimationFrame(tick);
  if (hold) {
    hold.t += dt;
    const p = Math.min(1, hold.t / hold.dur), [x, y] = POS[hold.k];
    hold.btn.style.setProperty('--c', p.toFixed(3));
    // Funken fliegen von außen in den Knoten
    for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, r = 60 + Math.random() * 40; parts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, tx: x, ty: y, t: 0, life: .35, k: 'in', c: Math.random() < .3 ? '#f4d03f' : '#a8ff70', s: 1.5 + Math.random() * 2 }); }
    if (p >= 1) {
      const k = hold.k; hold.tone.stop(true); hold.btn.classList.remove('charging'); hold.btn.style.setProperty('--c', 0);
      learn(k);
      // weiter halten: nächster Rang schneller
      const btn = hold.btn; hold = { chain: true };
      if (canLearn(st(), k)) startHold(k, btn); else hold = null;
    }
  }
  const cv = $('#treeFx'), g = cv.getContext('2d'), w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  g.setTransform(cv.width / VW, 0, 0, cv.height / VH, 0, 0); g.clearRect(0, 0, VW, VH);
  g.globalCompositeOperation = 'lighter';
  for (const q of parts) {
    q.t += dt;
    const a = 1 - q.t / q.life;
    if (a <= 0) continue;
    if (q.k === 'in') { const e = Math.min(1, q.t / q.life); q.cx = q.x + (q.tx - q.x) * e * e; q.cy = q.y + (q.ty - q.y) * e * e; }
    else { q.vy += (q.k === 'leaf' ? 60 : 160) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.cx = q.x; q.cy = q.y; }
    g.globalAlpha = Math.max(0, a); g.fillStyle = q.c;
    if (q.k === 'leaf') { g.save(); g.translate(q.cx, q.cy); g.rotate(q.t * 6 + q.s); g.beginPath(); g.ellipse(0, 0, 4, 2, 0, 0, 6.283); g.fill(); g.restore(); }
    else { g.beginPath(); g.arc(q.cx, q.cy, q.s * (q.k === 'in' ? .6 + a * .6 : a), 0, 6.283); g.fill(); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  parts = parts.filter(q => q.t < q.life);
}
function burst(x, y, n, c) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = 80 + Math.random() * 180; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: .5 + Math.random() * .4, k: 'out', c: i % 3 ? c : '#ffffff', s: 2 + Math.random() * 2.5 }); }
}
function leaves(x, y) {
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, v = 40 + Math.random() * 70; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, t: 0, life: .9 + Math.random() * .4, k: 'leaf', c: i % 2 ? '#7be04a' : '#4f9a2a', s: Math.random() * 6 }); }
}

// ---------- Eingaben ----------
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* Zeiger schon weg: Loslassen fängt window ab */ } };
$('#treeNodes').addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-node]'); if (!b) return;
  e.preventDefault(); capture(b, e); startHold(b.dataset.node, b);
});
$('#treeNote').addEventListener('pointerdown', e => {
  const h = e.target.closest('[data-hold]'); if (!h) return;
  e.preventDefault(); capture(h, e); startHold(sel, nodeBtn(sel));
});
// Loslassen irgendwo beendet das Halten (der Halten-Knopf im Zettel wird beim Lernen neu gezeichnet und verliert dabei den Zeiger)
for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => endHold(false));
window.addEventListener('blur', () => endHold(false));
// Tastatur: Pfeile wählen, Leertaste/Enter halten
const ORDER = ['m', 's3', 'b', 's1', 'a', 's2', 'pow', 'cd', 'area'];
$('#tree').addEventListener('keydown', e => {
  if (e.code === 'Escape') { close(); return; }
  // Leertaste/Enter auf ✕ oder „Zurücksetzen“ bleiben normale Klicks
  const other = e.target.closest('button') && !e.target.closest('#treeNodes, [data-hold]');
  if ((e.code === 'Space' || e.code === 'Enter') && !other) { e.preventDefault(); if (!e.repeat && !hold) startHold(sel, nodeBtn(sel)); return; }
  const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.code]; if (!d) return;
  e.preventDefault();
  const i = Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(sel) + d)); sel = ORDER[i]; sfx.hover(); render(false); nodeBtn(sel).focus();
});
$('#tree').addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'Enter') endHold(false); });

function close() { endHold(false); $('#tree').hidden = true; onChange(); }
$('#treeClose').addEventListener('click', close);
$('#treeReset').addEventListener('click', () => { st().pts = {}; persist(); sfx.click(); sel = 'pow'; render(true); onChange(); });
