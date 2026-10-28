// ---------- Truhen öffnen, Karten gutschreiben (PLAN 9.5) ----------
// Reine Logik ohne DOM: rollChest würfelt mit einem übergebenen Zufall (r() → 0..1), damit Tests
// und Pity reproduzierbar sind. grant* ändert den Spielstand.
import { addRunes, rollRunes } from './runes.js';
import { CARD_IDS, CARD_MAX, CARD_RARITY, CHESTS, FREE_EVERY, FREE_MAX, GOLD_PER_SPARE, PITY_EPIC, PITY_LEG, RARITIES, RARITY, SHELF, cardsToMax, skipGems, upgradeCost } from '../data/cards.js';

const POOL = Object.fromEntries(RARITIES.map(r => [r, CARD_IDS.filter(id => CARD_RARITY[id] === r)]));
// Gibt es keine Gegenstände dieser Seltenheit (noch keine legendären), nimm die nächstniedrigere
const avail = r => { let i = RARITIES.indexOf(r); while (i > 0 && !POOL[RARITIES[i]].length) i--; return RARITIES[i]; };

// Inhalt würfeln. pity = { epic, leg } (Truhen seit der letzten epischen/legendären Karte), wird angepasst
// pf: Faktor auf die Pity-Grenzen (Seelenbaum „Glücksbringer“ 0,8 = 20 % früher)
export function rollChest(type, r, pity = { epic: 0, leg: 0 }, pf = 1) {
  const C = CHESTS[type], count = [0, 0, 0, 0];
  for (let i = 0; i < C.cards; i++) {
    let x = r() * 100, k = 0;
    while (k < 3 && x >= C.odds[k]) { x -= C.odds[k]; k++; }
    count[k]++;
  }
  // Garantie: mindestens n Karten dieser Seltenheit (aus den gewöhnlichen umgewidmet)
  if (C.sure) { const k = RARITIES.indexOf(C.sure[0]); let need = C.sure[1] - count.slice(k).reduce((a, b) => a + b, 0); for (let j = 0; j < k && need > 0; j++) { const m = Math.min(count[j], need); count[j] -= m; count[k] += m; need -= m; } }
  if (C.pity) {
    pity.epic++; pity.leg++;
    // Eine Karte der niedrigsten vorhandenen Seltenheit wird hochgestuft (nie unter 0)
    const lift = to => { const j = count.findIndex((n, i) => i < to && n > 0); if (j >= 0) { count[j]--; count[to]++; } };
    if (pity.leg >= Math.ceil(PITY_LEG * pf) && !count[3]) lift(3);
    if (pity.epic >= Math.ceil(PITY_EPIC * pf) && !count[2] && !count[3]) lift(2);
    if (count[3]) pity.leg = 0;
    if (count[2] || count[3]) pity.epic = 0;
  }
  // Karten zu Stapeln bündeln: je Seltenheit 1–4 Gegenstände, gleiche Gegenstände zusammengelegt
  const stacks = new Map();
  RARITIES.forEach((rar, k) => {
    let c = count[k]; if (!c) return;
    const real = avail(rar), pool = POOL[real].slice(), n = Math.min(pool.length, Math.max(1, Math.min(4, Math.ceil(c / (k ? 3 : 6)))));
    const ids = []; for (let i = 0; i < n; i++) ids.push(pool.splice((r() * pool.length) | 0, 1)[0]);
    ids.forEach((id, i) => { const share = i === n - 1 ? c : Math.max(1, Math.round(c / (n - i) * (.6 + r() * .8))); const m = Math.min(c - (n - 1 - i), share); stacks.set(id, (stacks.get(id) || 0) + m); c -= m; });
  });
  const cards = [...stacks].map(([id, n]) => ({ id, n, rarity: CARD_RARITY[id] }))
    .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.n - b.n);
  const best = cards.reduce((m, c) => Math.max(m, RARITIES.indexOf(c.rarity)), 0);
  const gold = Math.round(C.gold[0] + r() * (C.gold[1] - C.gold[0]));
  // Bonusfund (selten, als Überraschung am Ende): Juwelen oder Goldader (das Gold noch einmal)
  let bonus = null;
  if (C.bonus && r() < C.bonus[0]) bonus = r() < .5 ? { kind: 'gems', n: Math.round(C.bonus[1] + r() * (C.bonus[2] - C.bonus[1])) } : { kind: 'gold', n: gold };
  // Runen (Phase 10) zuletzt würfeln: so bleiben Karten, Gold und Bonus bei gleichem Zufall wie vor den Runen
  const runes = rollRunes(r, type);
  return { type, gold, cards, best: RARITIES[best], bonus, runes };
}

// Kartenstand (ohne Eintrag: Startstufe der Seltenheit, 0 Karten)
export const cardState = (save, id) => save.cards[id] || { lv: RARITY[CARD_RARITY[id]].start, n: 0 };
export const cardLv = (save, id) => cardState(save, id).lv;

// Karte für das Bonus-Paket: gewöhnlich 70 %, selten 25 %, episch 5 % (r = Zufall 0–1)
export function pickBonusCard(r) {
  const x = r(), rar = x < .7 ? 'common' : x < .95 ? 'rare' : 'epic', ids = CARD_IDS.filter(id => CARD_RARITY[id] === rar);
  return ids[Math.floor(r() * ids.length)];
}
// Karten gutschreiben; was über Stufe 10 hinausgeht, wird zu Gold. Gibt das Umtausch-Gold zurück.
export function grantCards(save, id, n) {
  const st = save.cards[id] || (save.cards[id] = { ...cardState(save, id) });
  const room = st.lv >= CARD_MAX ? 0 : Math.max(0, cardsToMax(id, st.lv) - st.n);
  const keep = Math.min(n, room), spare = n - keep;
  st.n += keep;
  const gold = spare * GOLD_PER_SPARE[CARD_RARITY[id]];
  save.wallet.gold += gold;
  return gold;
}
export function grantChest(save, res) {
  save.wallet.gold += res.gold;
  if (res.bonus) save.wallet[res.bonus.kind === 'gems' ? 'gems' : 'gold'] += res.bonus.n;
  let spare = 0;
  for (const c of res.cards) { c.before = { ...cardState(save, c.id) }; spare += grantCards(save, c.id, c.n); }
  if (res.runes) addRunes(save, res.runes);
  save.stats.chests = (save.stats.chests || 0) + 1;
  return spare;
}
// Aufwerten mit Karten + Gold
export function canUpgrade(save, id) { const st = cardState(save, id), c = upgradeCost(id, st.lv); return !!c && st.n >= c.cards && save.wallet.gold >= c.gold; }
export function upgradeCard(save, id) {
  if (!canUpgrade(save, id)) return false;
  const st = save.cards[id], c = upgradeCost(id, st.lv);
  st.n -= c.cards; st.lv++; save.wallet.gold -= c.gold;
  return true;
}

// ---------- Truhenregal und Gratis-Truhe ----------
// Regal: [{ type, end }], end = Zeitpunkt, ab dem die Truhe offen ist (0 = wartet noch auf den Start).
// Wie bei Clash Royale öffnet immer nur eine Truhe zur Zeit.
export function addToShelf(save, type) {
  if (save.chests.shelf.length >= SHELF) return false;
  save.chests.shelf.push({ type, end: 0 }); return true;
}
export const unlocking = (save, now = Date.now()) => save.chests.shelf.some(c => c.end > now);
export function chestLeft(c, now = Date.now()) { return c.end ? Math.max(0, c.end - now) : CHESTS[c.type].wait; }
export const chestReady = (c, now = Date.now()) => c.end > 0 && c.end <= now;
export function startUnlock(save, i, now = Date.now()) {
  const c = save.chests.shelf[i];
  if (!c || c.end || unlocking(save, now)) return false;
  c.end = now + CHESTS[c.type].wait; return true;
}
// Mit Juwelen sofort öffnen (läuft gerade eine andere, darf man diese trotzdem abkürzen)
export function skipUnlock(save, i, now = Date.now()) {
  const c = save.chests.shelf[i]; if (!c || chestReady(c, now)) return false;
  const cost = skipGems(chestLeft(c, now));
  if (save.wallet.gems < cost) return false;
  save.wallet.gems -= cost; c.end = now; return true;
}
// Fertige Truhe aus dem Regal nehmen, gibt den Typ zurück
export function takeFromShelf(save, i, now = Date.now()) {
  const c = save.chests.shelf[i]; if (!c || !chestReady(c, now)) return null;
  save.chests.shelf.splice(i, 1); return c.type;
}
// Gratis-Holztruhen nachfüllen (alle 4 h eine, höchstens 2). Gibt { n, next } zurück: verfügbar, ms bis zur nächsten
export function freeChests(save, now = Date.now()) {
  const f = save.chests.free;
  if (!f.t || f.t > now) f.t = now;   // erster Start oder Uhr zurückgestellt
  while (f.n < FREE_MAX && now - f.t >= FREE_EVERY) { f.n++; f.t += FREE_EVERY; }
  if (f.n >= FREE_MAX) f.t = now;
  return { n: f.n, next: f.n >= FREE_MAX ? 0 : FREE_EVERY - (now - f.t) };
}
