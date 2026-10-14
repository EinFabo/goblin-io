// ---------- Level-Up-Angebot (Regeln aus PLAN 7.2) ----------
// Rein: kennt weder DOM noch Lauf. S = { weapons, passives, banned, rej, pity, lock }
// rnd() liefert Zahlen in [0, 1). Jede Karte bekommt ein "why", warum sie im Angebot ist.
import { PASSIVES, WEAPONS } from '../data/weapons.js';

export const MAX_W = 6, MAX_P = 6;
export const PITY_STEP = .5, PITY_MAX = 4, OWN_MULT = 2.5;
const BASE = { newW: 4, newP: 3 };

// Bannen und Sperren gelten für den Gegenstand, nicht für die Kartenart
export const itemKey = c => c.k === 'evo' ? 'e:' + c.id : c.k === 'newW' || c.k === 'upW' ? 'w:' + c.id : c.k === 'newP' || c.k === 'upP' ? 'p:' + c.id : c.k;
export const canBan = c => c.k !== 'evo' && c.k !== 'heal' && c.k !== 'gold';

export function newOfferState() { return { banned: new Set(), rej: {}, pity: {}, lock: null }; }

// Passive, die eine Waffe ab Stufe 3 zur Entwicklung braucht und die man noch nicht hat
export function pityPassives(S) {
  const pc = Object.keys(S.passives).length, out = [];
  if (pc >= MAX_P) return out;
  for (const w of S.weapons) {
    const p = WEAPONS[w.id].with;
    if (w.lv >= 3 && !w.evo && !S.passives[p] && !S.banned.has('p:' + p) && !out.includes(p)) out.push(p);
  }
  return out;
}

export function candidates(S) {
  const pool = [], owned = new Set(S.weapons.map(w => w.id)), pity = pityPassives(S);
  for (const w of S.weapons) {
    if (!w.evo && w.lv >= 5 && S.passives[WEAPONS[w.id].with]) pool.push({ k: 'evo', id: w.id, wgt: 0 });
    else if (w.lv < 5 && !WEAPONS[w.id].auto && !S.banned.has('w:' + w.id)) pool.push({ k: 'upW', id: w.id, wgt: BASE.newW * OWN_MULT });   // auto-Waffen steigen von selbst
  }
  if (S.weapons.length < MAX_W) for (const id in WEAPONS) if (!owned.has(id) && !S.banned.has('w:' + id)) pool.push({ k: 'newW', id, wgt: BASE.newW });
  const pc = Object.keys(S.passives).length;
  for (const id in PASSIVES) {
    if (S.banned.has('p:' + id)) continue;
    const lv = S.passives[id] || 0;
    if (lv > 0 && lv < 5) pool.push({ k: 'upP', id, wgt: BASE.newP * OWN_MULT });
    else if (lv === 0 && pc < MAX_P) pool.push({ k: 'newP', id, wgt: BASE.newP * (pity.includes(id) ? 1 + PITY_STEP * (S.pity[id] || 0) : 1) });
  }
  return pool;
}

// avoid: Schlüssel, die nach Möglichkeit nicht kommen sollen (z. B. beim Neu-Würfeln die alten Karten)
export function drawOffer(S, rnd, { n = 3, avoid = [] } = {}) {
  const pool = candidates(S), out = [], used = new Set();
  const soft = new Set(avoid);
  for (const k in S.rej) if (S.rej[k] >= 2) soft.add(k);
  const free = c => !used.has(itemKey(c));
  const take = (c, why) => { if (c && out.length < n && free(c)) { out.push({ k: c.k, id: c.id, why }); used.add(itemKey(c)); } return c; };
  const weighted = list => {
    let tot = 0; for (const c of list) tot += c.wgt || 1;
    let r = rnd() * tot;
    for (const c of list) { r -= c.wgt || 1; if (r <= 0) return c; }
    return list[list.length - 1];
  };
  // Erst ungeliebte Karten meiden; nur wenn sonst nichts da ist, doch nehmen
  const choose = list => {
    list = list.filter(free); if (!list.length) return null;
    const fresh = list.filter(c => !soft.has(itemKey(c)));
    return weighted(fresh.length ? fresh : list);
  };
  const has = k => out.some(c => c.k === k);

  // 0. Gesperrte Karte vom letzten Mal
  if (S.lock) take(pool.find(c => c.k === S.lock.k && c.id === S.lock.id), 'lock');
  // 1. Entwicklungen
  for (const c of pool) if (c.k === 'evo') take(c, 'evo');
  // 2. Startphase: bis 3 Waffen immer eine neue Waffe
  if (S.weapons.length < 3 && !has('newW')) take(choose(pool.filter(c => c.k === 'newW')), 'start');
  // 3. Fokus: eine Aufwertung einer eigenen Waffe
  if (!has('upW')) take(choose(pool.filter(c => c.k === 'upW')), 'focus');
  // 4. Passendes Passiv nach 4 Level-Ups ohne Angebot garantiert
  //    (mehrere fällig: das am längsten wartende zuerst)
  const due = pityPassives(S).filter(p => (S.pity[p] || 0) >= PITY_MAX).sort((a, b) => S.pity[b] - S.pity[a]);
  for (const p of due) take(pool.find(c => c.k === 'newP' && c.id === p), 'pity');
  // 5. Rest gewichtet (eigene Gegenstände ×2,5)
  while (out.length < n) { if (!take(choose(pool.filter(c => c.k !== 'evo')), 'rest')) break; }
  // Auffüllen, falls alles ausgebaut ist
  if (out.length < n) take({ k: 'heal' }, 'fill');
  if (out.length < n) take({ k: 'gold' }, 'fill');
  return out;
}

// Ersatz für eine gebannte Karte an derselben Stelle
export function replaceCard(S, offer, i, rnd) {
  const keep = offer.filter((_, j) => j !== i).map(itemKey);
  const pool = candidates(S).filter(c => c.k !== 'evo' && !keep.includes(itemKey(c)));
  const fresh = pool.filter(c => !(S.rej[itemKey(c)] >= 2));
  const list = fresh.length ? fresh : pool;
  if (!list.length) { offer[i] = { k: keep.includes('heal') ? 'gold' : 'heal', why: 'fill' }; return offer; }
  let tot = 0; for (const c of list) tot += c.wgt;
  let r = rnd() * tot, c = list[list.length - 1];
  for (const x of list) { r -= x.wgt; if (r <= 0) { c = x; break; } }
  offer[i] = { k: c.k, id: c.id, why: 'rest' };
  return offer;
}

// Nach der Wahl: Ablehnungen und Pity-Zähler fortschreiben. picked = Index oder -1 (übersprungen).
// lockIdx = Karte, die fürs nächste Level-Up liegen bleibt (oder -1)
export function settleOffer(S, offer, picked, lockIdx = -1) {
  const shown = new Set(offer.map(itemKey)), pk = picked >= 0 ? itemKey(offer[picked]) : null;
  const rej = {};
  for (const k of shown) if (k !== pk) rej[k] = (S.rej[k] || 0) + 1;
  S.rej = rej;   // nicht gezeigte oder gewählte Karten fangen wieder bei 0 an
  for (const p of pityPassives(S)) S.pity[p] = shown.has('p:' + p) ? 0 : (S.pity[p] || 0) + 1;
  S.lock = lockIdx >= 0 && lockIdx !== picked ? { k: offer[lockIdx].k, id: offer[lockIdx].id } : null;
  if (S.lock) delete S.rej[itemKey(offer[lockIdx])];
}
