import { audioInit, sfx } from '../core/audio.js';
import { save } from '../core/save.js';
import { $ } from '../core/util.js';
import { CARD_MAX, CHESTS, RARITIES, RARITY, cardName, upgradeCost } from '../data/cards.js';
import { cardState } from '../game/chests.js';
import { cardHtml, chestSvg } from './cardart.js';

// ---------- Truhe öffnen (PLAN 9.5): Wackeln → Deckel auf, Lichtsäule → Karten einzeln → Zusammenfassung ----------
// res kommt aus rollChest und ist schon gutgeschrieben (grantChest hat c.before gesetzt).
// Tippen springt zum nächsten Schritt. Legendär: Bildschirm wird dunkel, goldene Partikel, eigener Ton.
let S = null;   // { res, step, i, timers, done }
const coStage = () => $('#coStage');

export function playChest(res, done = () => {}) {
  audioInit();
  S = { res, step: 'wobble', i: -1, timers: [], done, best: RARITIES.indexOf(res.best) };
  const ov = $('#chestOpen');
  ov.hidden = false; ov.classList.toggle('dark', S.best >= 2); ov.style.setProperty('--bc', RARITY[res.best].color);
  coStage().innerHTML = `<div class="co-chest drop">${chestSvg(res.type)}</div><div class="co-beam"></div><div class="co-name">${CHESTS[res.type].name}</div>`;
  hint('Tippen zum Öffnen');
  startFx();
  // je besser der Inhalt, desto öfter wackelt sie (2–5 Mal)
  const n = 2 + S.best;
  for (let k = 0; k < n; k++) later(500 + k * 420, () => { const c = $('.co-chest'); c.classList.remove('drop', 'wob'); void c.offsetWidth; c.classList.add('wob'); sfx.creak(k); if (S.best >= 2) sparks(60, 52, 6 + k * 4, '#ffd84a'); });
  later(500 + n * 420 + 150, openLid);
}
function later(ms, fn) { S.timers.push(setTimeout(() => { if (S) fn(); }, ms)); }
function clearTimers() { for (const t of S.timers) clearTimeout(t); S.timers = []; }
function hint(t) { $('#coHint').textContent = t; }

function openLid() {
  if (S.step !== 'wobble') return;
  clearTimers(); S.step = 'open';
  $('.co-chest').classList.remove('wob', 'drop'); $('.co-chest').classList.add('open');
  $('.co-beam').classList.add('on');
  sfx.lidOpen(S.best); if (S.best >= 3) sfx.legendary();
  hint('');
  sparks(60, 40, 40 + S.best * 20, RARITY[S.res.best].color); sparks(60, 40, 20, '#ffffff');
  later(700, nextCard);
}

function nextCard() {
  clearTimers();
  S.i++; S.step = 'card';
  const c = S.res.cards[S.i];
  if (!c) { summary(); return; }
  const now = cardState(save, c.id), b = c.before, ri = RARITIES.indexOf(c.rarity);
  const isNew = !b.n && b.lv === RARITY[c.rarity].start;   // vorher nie eine Karte davon gehabt
  const cost = upgradeCost(c.id, now.lv), before = cost ? Math.min(100, b.n / cost.cards * 100) : 100;
  coStage().querySelectorAll('.co-card').forEach(e => e.remove());
  coStage().insertAdjacentHTML('beforeend', `<div class="co-card r${ri}">${cardHtml(c.id, now)}<span class="co-n">×${c.n}</span>${isNew ? '<span class="co-new">Neu!</span>' : ''}${cost && now.n >= cost.cards ? '<span class="co-up">Aufwerten möglich!</span>' : ''}</div>`);
  // Fortschritt von vorher auf jetzt füllen
  const bar = $('.co-card .cbar i');
  if (bar && now.lv < CARD_MAX) { const to = bar.style.width; bar.style.width = before + '%'; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = to; })); }
  sfx.reveal(ri); sparks(60, 50, 10 + ri * 12, RARITY[c.rarity].color);
  const left = S.res.cards.length - S.i - 1;
  hint(left ? `Tippen für die nächste Karte (noch ${left})` : 'Tippen für die Übersicht');
}

function summary() {
  S.step = 'sum';
  $('.co-chest').classList.add('gone'); $('.co-beam').classList.remove('on'); $('.co-name').hidden = true;
  coStage().querySelectorAll('.co-card').forEach(e => e.remove());
  const r = S.res;
  coStage().insertAdjacentHTML('beforeend', `<div class="co-sum">
    <h2>${CHESTS[r.type].name}</h2>
    <p class="co-gold"><span class="coin"></span>+${r.gold.toLocaleString('de-DE')} Gold</p>
    <div class="co-list">${r.cards.map(c => `<div class="co-mini" style="--rc:${RARITY[c.rarity].color}" title="${cardName(c.id)}">${cardHtml(c.id, cardState(save, c.id))}<span class="co-n">×${c.n}</span></div>`).join('')}</div>
    <button class="btn primary" id="coDone">Weiter</button></div>`);
  hint('');
  sfx.pickCard();
}

function close() {
  if (!S) return;
  clearTimers(); const d = S.done; S = null;
  $('#chestOpen').hidden = true; $('#chestOpen').classList.remove('dark');
  d();
}
$('#chestOpen').addEventListener('click', e => {
  if (!S) return;
  if (e.target.closest('#coDone')) { close(); return; }
  if (S.step === 'wobble') openLid();
  else if (S.step === 'card') nextCard();
});
window.addEventListener('keydown', e => {
  if (!S || $('#chestOpen').hidden) return;
  if (e.code === 'Escape' || (S.step === 'sum' && (e.code === 'Enter' || e.code === 'Space'))) { e.preventDefault(); close(); return; }
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (S.step === 'wobble') openLid(); else if (S.step === 'card') nextCard(); }
});

// ---------- Partikel (Koordinaten in % der Bühne, 0–100 × 0–100) ----------
let parts = [], raf = 0, lastT = 0;
function sparks(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = 20 + Math.random() * 60; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: .7 + Math.random() * .6, c, s: 1.5 + Math.random() * 2.5 }); } }
function startFx() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  const ov = $('#chestOpen');
  if (ov.hidden) { raf = 0; parts = []; return; }
  raf = requestAnimationFrame(tick);
  // Legendär/Episch: ständig goldene Funken von oben
  if (S && S.best >= 3 && Math.random() < dt * 30) parts.push({ x: Math.random() * 100, y: -2, vx: 0, vy: 20 + Math.random() * 20, t: 0, life: 3, c: '#ffd84a', s: 1.5 + Math.random() * 2 });
  const cv = $('#chestFx'), g = cv.getContext('2d'), w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  g.setTransform(cv.width / 100, 0, 0, cv.height / 100, 0, 0); g.clearRect(0, 0, 100, 100);
  g.globalCompositeOperation = 'lighter';
  const k = h / w;   // Partikel rund halten
  for (const q of parts) {
    q.t += dt; const a = 1 - q.t / q.life; if (a <= 0) continue;
    q.vy += 40 * dt; q.x += q.vx * dt * k; q.y += q.vy * dt;
    g.globalAlpha = a; g.fillStyle = q.c; g.beginPath(); g.ellipse(q.x, q.y, q.s * .25 * k, q.s * .25, 0, 0, 6.283); g.fill();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  parts = parts.filter(q => q.t < q.life);
}
