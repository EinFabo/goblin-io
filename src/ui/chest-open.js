import { audioInit, sfx } from '../core/audio.js';
import { save } from '../core/save.js';
import { $, restart } from '../core/util.js';
import { CARD_MAX, CHESTS, RARITIES, RARITY, cardName, upgradeCost } from '../data/cards.js';
import { cardState } from '../game/chests.js';
import { cardHtml, chestSvg, runeSvg } from './cardart.js';
import { COSM, COSMO_CHEST } from '../data/cosmetics.js';
import { RUNE_BAG, parseRune, runeName, tierInfo } from '../data/runes.js';
import { cosmTile } from './cosmart.js';
const chestName = t => (CHESTS[t] || (t === 'runebag' ? RUNE_BAG : COSMO_CHEST)).name;

// ---------- Truhe öffnen (PLAN 9.5, Umbau 2026-10-14) ----------
// Ablauf: Truhe fällt herein → wackelt (Tippen = nächster Wackler), Licht aus dem Spalt steigt Stufe um Stufe
// (weiß → blau → lila → gold) bis zur besten Seltenheit → Hitstop, Blitz, Deckel fliegt auf → Karten fliegen
// verdeckt heraus und drehen sich um → Runen (Phase 10) → Bonusfund → Übersicht. Licht, Strahl und Strahlenkranz liegen HINTER der Truhe.
// Das Ergebnis steht vorher fest (res kommt aus rollChest und ist schon gutgeschrieben, grantChest hat c.before gesetzt);
// die Animation zeigt es nur – keine Beinahe-Treffer.
let S = null;   // { res, step, i, timers, done, best, n, k, tier, ups, flipped, lastWob, bonusShown }
const coStage = () => $('#coStage');
const ov = () => $('#chestOpen');
// Lichtfarbe je Stufe; Stufe 0 ist warmes Weiß statt Grau
const TEASE = ['#fff3c4', RARITY.rare.color, RARITY.epic.color, RARITY.legendary.color];
const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function playChest(res, done = () => {}) {
  audioInit();
  if (S) clearTimers();   // alte Sitzung (z. B. von außen versteckt) beenden, bevor ihre Timer feuern
  // Das Licht steigt bis zur besten Seltenheit, Runen eingeschlossen (keine Beinahe-Treffer)
  const best = Math.max(RARITIES.indexOf(res.best), ...(res.runes || []).map(k => parseRune(k).tier));
  // 2 + best Wackler, manchmal einer mehr, damit die Zahl nicht alles verrät. Bei best davon steigt das Licht.
  const n = 2 + best + (Math.random() < .35 ? 1 : 0);
  S = { res, step: 'wobble', i: -1, timers: [], done, best, n, k: 0, tier: 0, ups: pickUps(n, best), flipped: false, lastWob: 0, bonusShown: false, runesShown: false };
  const o = ov();
  o.hidden = false; o.classList.remove('dark');
  o.style.setProperty('--bc', RARITY[RARITIES[best]].color); setTier(0); o.style.setProperty('--gs', .3);
  coStage().className = 'co-stage';
  coStage().innerHTML = `<div class="co-rays"></div><div class="co-chest drop"><div class="co-back"><div class="co-glow"></div><div class="co-beam"></div></div>${chestSvg(res.type)}</div><div class="co-name">${chestName(res.type)}</div><div class="co-pop"></div>`;
  $('#coSkip').hidden = false;
  hint('Tippen!');
  startFx();
  later(650, wobble);
}
// Bei welchen Wacklern (nie beim ersten) steigt das Licht? best verschiedene aus 1 … n−1
function pickUps(n, best) {
  const idx = []; for (let i = 1; i < n; i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, best).sort((a, b) => a - b);
}
// Timer gehören zu ihrer Sitzung: feuern sie nach einem Wechsel, tun sie nichts
function later(ms, fn) { const me = S; S.timers.push(setTimeout(() => { if (S === me) fn(); }, ms)); }
function clearTimers() { for (const t of S.timers) clearTimeout(t); S.timers = []; }
function hint(t) { $('#coHint').textContent = t; }
function setTier(t) { ov().style.setProperty('--tc', TEASE[t]); if (t >= 3) ov().classList.add('dark'); }
// Bildschirmwackeln (Einstellung „Bildschirmwackeln“ und reduzierte Bewegung beachten) und Vibration am Handy
function shake(r) {
  if (!save.settings.shake || reduced() || r <= 0) return;
  const st = coStage(); st.classList.remove('shk1', 'shk2', 'shk3'); restart(st, 'shk' + Math.min(3, r));
}
function buzz(pattern) { if (!save.settings.shake) return; try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* nicht unterstützt */ } }

function wobble() {
  if (S.step !== 'wobble') return;
  clearTimers();
  if (S.k >= S.n) { openLid(); return; }
  const k = S.k++, c = $('.co-chest');
  c.classList.remove('drop'); restart(c, 'wob');
  sfx.creak(k);
  ov().style.setProperty('--gs', .3 + .7 * S.k / S.n);   // Licht hinter der Truhe wird mit jedem Wackler größer
  const up = S.ups.includes(k);
  if (up) {
    S.tier++; setTier(S.tier);
    const p = $('.co-pop'); p.textContent = S.tier >= 3 ? 'LEGENDÄR?!' : 'Aufwertung!'; restart(p, 'go');
    sfx.tierUp(S.tier); shake(1); buzz(25);
    sparks(...seam(), 10 + S.tier * 8, TEASE[S.tier]);
  } else sparks(...seam(), 3 + k * 2, TEASE[S.tier]);
  S.lastWob = performance.now();
  later(up ? 1000 : 760, wobble);
}

function openLid() {
  if (S.step !== 'wobble') return;
  clearTimers(); S.step = 'open';
  S.tier = S.best; setTier(S.best);
  const c = $('.co-chest');
  c.classList.remove('wob', 'drop'); c.classList.add('squash');   // Hitstop: Truhe staucht sich, alles hält kurz an
  hint('');
  later(130, () => {
    c.classList.remove('squash'); c.classList.add('open');
    $('.co-beam').classList.add('on'); coStage().classList.add('opened');
    coStage().insertAdjacentHTML('beforeend', '<div class="co-flash"></div><div class="co-ring"></div>');
    shake(1 + S.best); buzz([30, 40, 40 + 40 * S.best]);
    sfx.thump(); sfx.lidOpen(S.best); if (S.best >= 3) sfx.legendary();
    const [x, y] = seam();
    sparks(x, y, 40 + S.best * 20, RARITY[RARITIES[S.best]].color); sparks(x, y, 20, '#ffffff');
    later(650 + (S.best >= 3 ? 300 : 0), nextCard);
  });
}

function nextCard() {
  clearTimers();
  S.i++; S.step = 'card'; S.flipped = false;
  coStage().querySelectorAll('.co-card').forEach(e => e.remove());
  // Kosmetiktruhe: ein Teil, groß gezeigt
  if (S.res.cosmetic) {
    if (S.i > 0) { summary(); return; }
    const ri = RARITIES.indexOf(COSM[S.res.cosmetic].rarity);
    coStage().insertAdjacentHTML('beforeend', `<div class="co-card co-cosm shown r${ri}" style="--rc:${RARITY[COSM[S.res.cosmetic].rarity].color}">${cosmTile(S.res.cosmetic, 'big')}<span class="co-new">Neu!</span></div>`);
    S.flipped = true;
    sfx.reveal(ri); sparks(...cardAt(), 14 + ri * 12, RARITY[S.res.best].color); if (ri >= 2) shake(ri - 1);
    hint('Tippen für die Übersicht'); return;
  }
  const c = S.res.cards[S.i];
  if (!c) { if (hasRunes() && !S.runesShown) showRunes(); else if (S.res.bonus && !S.bonusShown) showBonus(); else summary(); return; }
  const now = cardState(save, c.id), b = c.before, ri = RARITIES.indexOf(c.rarity);
  const isNew = !b.n && b.lv === RARITY[c.rarity].start;   // vorher nie eine Karte davon gehabt
  // Karte fliegt verdeckt aus der Truhe; der Rand der Rückseite glüht kurz vorher in der Seltenheit
  coStage().insertAdjacentHTML('beforeend', `<div class="co-card r${ri}${ri >= 3 ? ' slow' : ''}" style="--rc:${RARITY[c.rarity].color}">
    <div class="co-flip"><div class="co-face co-backf"><span>?</span></div><div class="co-face co-front">${cardHtml(c.id, now)}</div></div>
    <span class="co-n">×${c.n}</span>${isNew ? '<span class="co-new">Neu!</span>' : ''}</div>`);
  sfx.cards();
  if (ri >= 3) sfx.drumroll(.65);
  const left = S.res.cards.length - S.i - 1;
  hint(left ? `Tippen (noch ${left})` : 'Tippen');
  later(ri >= 3 ? 750 : ri >= 2 ? 450 : 280, flip);
}

// Karte umdrehen: Ton und Funken je Seltenheit, ×N zählt hoch, Balken füllt sich von vorher auf jetzt
function flip() {
  if (S.step !== 'card' || S.flipped) return;
  clearTimers(); S.flipped = true;
  const c = S.res.cards[S.i], el = $('.co-card'); if (!c || !el) return;
  const now = cardState(save, c.id), b = c.before, ri = RARITIES.indexOf(c.rarity);
  el.classList.add('shown');
  sfx.flip(ri); sfx.reveal(ri);
  sparks(...cardAt(), 10 + ri * 14, RARITY[c.rarity].color);
  if (ri >= 2) { shake(ri - 1); buzz(20 + 30 * ri); }
  // ×N zählt hoch (höchstens 10 Schritte)
  const nEl = el.querySelector('.co-n'), steps = Math.min(10, c.n);
  for (let s = 1; s <= steps; s++) later(120 + s * 35, () => { nEl.textContent = '×' + Math.round(c.n * s / steps); });
  const cost = upgradeCost(c.id, now.lv), before = cost ? Math.min(100, b.n / cost.cards * 100) : 100;
  const bar = el.querySelector('.cbar i');
  if (bar && now.lv < CARD_MAX) { const to = bar.style.width; bar.style.width = before + '%'; later(200, () => { bar.style.width = to; }); }
  // „Aufwerten möglich!“ – mit Ding, wenn es erst durch diese Truhe möglich wurde
  if (cost && now.n >= cost.cards) {
    const fresh = !(b.lv === now.lv && b.n >= cost.cards);
    later(fresh ? 650 : 250, () => { el.insertAdjacentHTML('beforeend', '<span class="co-up">Aufwerten möglich!</span>'); if (fresh) sfx.ding(); });
  }
  const left = S.res.cards.length - S.i - 1;
  hint(left ? `Tippen für die nächste Karte (noch ${left})` : S.res.bonus || hasRunes() ? 'Tippen – da ist noch was …' : 'Tippen für die Übersicht');
}

// Runen (Phase 10): alle Runen der Truhe zusammen, beste zuletzt mit dem meisten Glanz
const hasRunes = () => !!(S.res.runes && S.res.runes.length);
function showRunes() {
  S.runesShown = true; S.step = 'card'; S.flipped = true;
  const rs = S.res.runes, top = rs.reduce((m, k) => Math.max(m, parseRune(k).tier), 0), col = tierInfo(top).color;
  ov().style.setProperty('--tc', col);
  coStage().insertAdjacentHTML('beforeend', `<div class="co-card co-runes shown r${top}" style="--rc:${col}"><b>${rs.length > 1 ? rs.length + ' Runen!' : 'Rune!'}</b>
    <div class="co-runelist">${rs.map((k, i) => `<span class="co-rune" style="--d:${i * 120}ms" title="${runeName(k)}">${runeSvg(k)}</span>`).join('')}</div><small>In der Rüstkammer einsetzen</small></div>`);
  sfx.reveal(top); if (top >= 2) { shake(top - 1); buzz(20 + 30 * top); }
  sparks(...cardAt(), 16 + top * 14, col);
  hint(S.res.bonus ? 'Tippen – da ist noch was …' : 'Tippen für die Übersicht');
}

// Bonusfund (Juwelen oder Goldader) als eigene Überraschung nach der letzten Karte
function showBonus() {
  S.bonusShown = true; S.step = 'card'; S.flipped = true;
  const B = S.res.bonus, gems = B.kind === 'gems';
  ov().style.setProperty('--tc', gems ? '#c99cff' : '#ffd84a');
  coStage().insertAdjacentHTML('beforeend', `<div class="co-card co-bonus shown"><div class="co-bonusbox"><span class="${gems ? 'gem' : 'coin'} big"></span><b>${gems ? 'Bonusfund!' : 'Goldader!'}</b><small>+${B.n.toLocaleString('de-DE')} ${gems ? 'Juwelen' : 'Gold'}</small></div></div>`);
  sfx.ding(); sfx.chest(); shake(2); buzz([20, 30, 60]);
  sparks(...cardAt(), 50, gems ? '#c99cff' : '#ffd84a'); sparks(...cardAt(), 20, '#ffffff');
  hint('Tippen für die Übersicht');
}

function summary() {
  clearTimers();
  S.step = 'sum';
  const ch = $('.co-chest'); if (ch) ch.classList.add('gone');
  const beam = $('.co-beam'); if (beam) beam.classList.remove('on');
  const nm = $('.co-name'); if (nm) nm.hidden = true;
  $('#coSkip').hidden = true;
  coStage().querySelectorAll('.co-card').forEach(e => e.remove());
  const r = S.res, B = r.bonus;
  // Beste zuerst; die beste Karte ist größer und glüht
  const cards = r.cards.slice().sort((a, b) => RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || b.n - a.n);
  const runes = hasRunes() ? `<div class="co-runelist small">${r.runes.map(k => `<span class="co-rune" title="${runeName(k)}">${runeSvg(k)}</span>`).join('')}</div>` : '';
  const bonus = B ? `<p class="co-gold co-bonusline"><span class="${B.kind === 'gems' ? 'gem' : 'coin'}"></span>+${B.n.toLocaleString('de-DE')} ${B.kind === 'gems' ? 'Juwelen (Bonusfund)' : 'Gold (Goldader)'}</p>` : '';
  coStage().insertAdjacentHTML('beforeend', `<div class="co-sum">
    <h2>${chestName(r.type)}</h2>
    ${r.cosmetic ? `<div class="co-cosm-sum">${cosmTile(r.cosmetic, 'big')}<p>In der Garderobe (Profil) anziehen.</p></div>` : `${r.gold ? `<p class="co-gold"><span class="coin"></span>+${r.gold.toLocaleString('de-DE')} Gold</p>` : ''}${bonus}`}
    ${runes}
    <div class="co-list">${cards.map((c, i) => `<div class="co-mini${i === 0 && RARITIES.indexOf(c.rarity) >= 1 ? ' best' : ''}" style="--rc:${RARITY[c.rarity].color}" title="${cardName(c.id)}">${cardHtml(c.id, cardState(save, c.id))}<span class="co-n">×${c.n}</span></div>`).join('')}</div>
    <button class="btn primary" id="coDone">Weiter</button></div>`);
  hint('');
  sfx.pickCard();
}

function close() {
  if (!S) return;
  clearTimers(); const d = S.done; S = null;
  ov().hidden = true; ov().classList.remove('dark');
  d();
}
// Tippen: Wackeln → nächster Wackler, verdeckte Karte → umdrehen, offene Karte → nächste
function advance() {
  if (S.step === 'wobble') { if (performance.now() - S.lastWob > 180) wobble(); }
  else if (S.step === 'card') { if (S.flipped) nextCard(); else flip(); }
}
$('#chestOpen').addEventListener('click', e => {
  if (!S) return;
  if (e.target.closest('#coDone')) { close(); return; }
  if (e.target.closest('#coSkip')) { if (S.step !== 'sum') { S.tier = S.best; setTier(S.best); summary(); } return; }
  advance();
});
window.addEventListener('keydown', e => {
  if (!S || ov().hidden) return;
  if (e.code === 'Escape' || (S.step === 'sum' && (e.code === 'Enter' || e.code === 'Space'))) { e.preventDefault(); close(); return; }
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
});

// ---------- Partikel (Koordinaten in % der Partikel-Fläche = ganzes Overlay, 0–100 × 0–100) ----------
// Punkt (fx, fy relativ zum Element) in Prozent der Partikel-Fläche
function at(el, fx, fy) {
  const cv = $('#chestFx').getBoundingClientRect();
  if (!el || !cv.width) return [50, 50];
  const r = el.getBoundingClientRect();
  return [(r.left + r.width * fx - cv.left) / cv.width * 100, (r.top + r.height * fy - cv.top) / cv.height * 100];
}
const seam = () => at($('.co-chest .chest'), .5, .42);   // Spalt zwischen Deckel und Korpus
const cardAt = () => at($('.co-card'), .5, .45);
let parts = [], raf = 0, lastT = 0;
function sparks(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = 20 + Math.random() * 60; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: .7 + Math.random() * .6, c, s: 1.5 + Math.random() * 2.5 }); } }
function startFx() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  const o = ov();
  if (o.hidden) { raf = 0; parts = []; if (S) { clearTimers(); S = null; } return; }   // von außen versteckt (Szenenwechsel)
  raf = requestAnimationFrame(tick);
  // Legendäres Licht erreicht: ständig goldene Funken von oben
  if (S && S.tier >= 3 && S.step !== 'sum' && Math.random() < dt * 30) parts.push({ x: Math.random() * 100, y: -2, vx: 0, vy: 20 + Math.random() * 20, t: 0, life: 3, c: '#ffd84a', s: 1.5 + Math.random() * 2 });
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
