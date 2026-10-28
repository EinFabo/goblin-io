// ---------- Runen: Tasche, Sockel, Verschmelzen, Würfeln (PLAN Phase 10) ----------
// Reine Logik ohne DOM. save.runes = { bag: { 'fire.0': 3 }, sock: { trap: ['fire.1', null] } }
// Ausbauen ist kostenlos (Entscheidung Fabi 2026-10-16): die Rune geht zurück in die Tasche.
import { ABILITIES } from '../data/abilities.js';
import { CHEST_RUNES, FUSE_N, RUNES, RUNE_BAG, RUNE_IDS, RUNE_TIERS, SOCKET_LV, parseRune, runeFits, runeKey } from '../data/runes.js';

const BAG_MAX = 9999;
const lvOf = (abilities, id) => (abilities && abilities[id] && abilities[id].lv) || 1;
// Dritter Sockel nur mit dem Seelenbaum-Knoten „Dritter Sockel“ (Phase 12)
export const sock3 = save => !!(save.rebirth && save.rebirth.spent && save.rebirth.spent.m_sock);
export const socketIdx = save => (sock3(save) ? [0, 1, 2] : [0, 1]);
export const socketOpen = (save, id, i) => (i < 2 || sock3(save)) && lvOf(save.abilities, id) >= SOCKET_LV[i];
export const bagCount = (save, key) => save.runes.bag[key] || 0;
export const socketsOf = (save, id) => save.runes.sock[id] || [null, null];

// Spielstand reparieren: unbekannte Runen weg, gesperrte oder unpassende Sockel zurück in die Tasche,
// je Fähigkeit jede Runenart nur einmal
export function normRunes(raw, abilities, third = false) {
  const r = raw && typeof raw === 'object' ? raw : {}, out = { bag: {}, sock: {} };
  const add = (k, n) => { out.bag[k] = Math.min(BAG_MAX, (out.bag[k] || 0) + n); };
  for (const [k, v] of Object.entries(r.bag && typeof r.bag === 'object' ? r.bag : {})) {
    const n = typeof v === 'number' && isFinite(v) ? Math.floor(v) : 0;
    if (parseRune(k) && n > 0) add(k, n);
  }
  for (const [id, a] of Object.entries(r.sock && typeof r.sock === 'object' ? r.sock : {})) {
    if (!Array.isArray(a)) continue;
    const s = third ? [null, null, null] : [null, null], seen = new Set();
    for (let i = 0; i < SOCKET_LV.length; i++) {
      const p = parseRune(a[i]); if (!p) continue;
      if (ABILITIES[id] && i < s.length && lvOf(abilities, id) >= SOCKET_LV[i] && runeFits(p.id, id) && !seen.has(p.id)) { s[i] = a[i]; seen.add(p.id); }
      else add(a[i], 1);
    }
    if (s.some(Boolean)) out.sock[id] = s;
  }
  return out;
}

export function addRunes(save, keys) {
  for (const k of keys) if (parseRune(k)) save.runes.bag[k] = Math.min(BAG_MAX, bagCount(save, k) + 1);
}
const take = (save, k, n = 1) => { const c = bagCount(save, k) - n; if (c > 0) save.runes.bag[k] = c; else delete save.runes.bag[k]; };

// Warum geht das Einsetzen nicht? '' = geht
export function socketWhy(save, id, i, key) {
  const p = parseRune(key);
  if (!p || !ABILITIES[id]) return 'Unbekannt';
  if (!socketOpen(save, id, i)) return `Sockel ${i + 1} ab Level ${SOCKET_LV[i]}`;
  if (!runeFits(p.id, id)) return 'Passt nicht zu dieser Fähigkeit';
  if (bagCount(save, key) < 1) return 'Nicht in der Tasche';
  const other = socketsOf(save, id)[1 - i], o = parseRune(other);
  if (o && o.id === p.id) return 'Diese Runenart steckt schon';
  return '';
}
// Einsetzen; eine Rune, die im Sockel steckt, geht zurück in die Tasche
export function socket(save, id, i, key) {
  if (socketWhy(save, id, i, key)) return false;
  const s = [...socketsOf(save, id)];
  if (s[i]) addRunes(save, [s[i]]);
  take(save, key); s[i] = key; save.runes.sock[id] = s;
  return true;
}
export function unsocket(save, id, i) {
  const s = [...socketsOf(save, id)];
  if (!s[i]) return false;
  addRunes(save, [s[i]]); s[i] = null;
  if (s[0] || s[1]) save.runes.sock[id] = s; else delete save.runes.sock[id];
  return true;
}
// 3 gleiche → eine der nächsten Stufe. Gibt den neuen Schlüssel zurück
export const canFuse = (save, key) => { const p = parseRune(key); return !!p && p.tier < RUNE_TIERS - 1 && bagCount(save, key) >= FUSE_N; };
export function fuse(save, key) {
  if (!canFuse(save, key)) return null;
  const p = parseRune(key), up = runeKey(p.id, p.tier + 1);
  take(save, key, FUSE_N); addRunes(save, [up]);
  return up;
}

// Würfeln (r = Zufall 0–1): eine Rune mit Stufen-Gewichten in %, min = Mindeststufe
function rollOne(r, odds, min = 0) {
  const id = RUNE_IDS[Math.floor(r() * RUNE_IDS.length)];
  let x = r() * 100, t = 0;
  while (t < RUNE_TIERS - 1 && x >= odds[t]) { x -= odds[t]; t++; }
  return runeKey(id, Math.max(t, min));
}
export function rollRunes(r, type) {
  const C = CHEST_RUNES[type]; if (!C) return [];
  const [p, a, b] = C.n;
  if (p < 1 && r() >= p) return [];
  const n = a + Math.floor(r() * (b - a + 1)), out = [];
  for (let i = 0; i < n; i++) out.push(rollOne(r, C.odds));
  return out.sort(byTier);
}
// Runenkiste: die erste ist mindestens selten
export function rollRuneBag(r) {
  const out = [];
  for (let i = 0; i < RUNE_BAG.n; i++) out.push(rollOne(r, RUNE_BAG.odds, i === 0 ? 1 : 0));
  return out.sort(byTier);
}
export const byTier = (a, b) => parseRune(a).tier - parseRune(b).tier || a.localeCompare(b);

// Wirkung im Lauf: { fire: 0.25, … } aus den Sockeln einer Fähigkeit (nur offene, passende Sockel)
export function runeMods(save, id) {
  const out = {};
  socketsOf(save, id).forEach((k, i) => {
    const p = parseRune(k);
    if (p && socketOpen(save, id, i) && runeFits(p.id, id)) { out[p.id] = RUNES[p.id].val[p.tier]; if (p.id === 'bolt') out.jumps = RUNES.bolt.jumps[p.tier]; }
  });
  return out;
}
