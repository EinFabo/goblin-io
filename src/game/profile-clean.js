import { CARD_IDS, CARD_MAX } from '../data/cards.js';
import { ABILITY_IDS, MOVE_IDS } from '../data/abilities.js';
import { CLASS_IDS } from '../data/classes.js';
// Profil des Partners kommt übers Netz (Form wie game/profile.js profileOf): auf die erwartete Form bringen, damit ein kaputtes oder manipuliertes Profil
// das eigene Spiel nicht zum Absturz bringt. Beide Rechner wenden es auf dieselben Profile an → gleiches Ergebnis.
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : lo);
const nums = (o, lo, hi) => Object.fromEntries(Object.entries(obj(o)).slice(0, 200).map(([k, v]) => [String(k), num(v, lo, hi)]));
const ABIL = new Set([...ABILITY_IDS, ...MOVE_IDS]);
export function cleanProfile(p) {
  p = obj(p);
  const lo = (Array.isArray(p.loadout) ? p.loadout : []).slice(0, 2).map(id => (ABIL.has(id) ? id : null));
  while (lo.length < 2) lo.push(null);
  const abilities = {};
  for (const [id, a] of Object.entries(obj(p.abilities))) if (ABIL.has(id)) abilities[id] = { lv: num(obj(a).lv, 1, 30), xp: 0, st: num(obj(a).st, 0, 5), pts: nums(obj(a).pts, 0, 10) };
  const rb = obj(p.rebirth), rn = obj(p.runes);
  return {
    name: String(typeof p.name === 'string' ? p.name : 'Goblin').slice(0, 16), cls: CLASS_IDS.includes(p.cls) ? p.cls : 'gob', clsLv: num(p.clsLv, 1, 30),
    talents: nums(p.talents, 0, 50), rebirth: { n: num(rb.n, 0, 99), spent: nums(rb.spent, 0, 10) }, abilities,
    runes: { bag: {}, sock: Object.fromEntries(Object.entries(obj(rn.sock)).filter(([id, v]) => ABIL.has(id) && Array.isArray(v)).map(([id, v]) => [id, v.slice(0, 3).map(k => (typeof k === 'string' ? k.slice(0, 24) : null))])) },
    look: Object.fromEntries(Object.entries(obj(p.look)).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v.slice(0, 24)])),
    loadout: lo, equip: lo.map((id, i) => !!id && !!(Array.isArray(p.equip) && p.equip[i])),
    cards: Object.fromEntries(CARD_IDS.map(id => [id, num(obj(p.cards)[id], 1, CARD_MAX)])), owned: (Array.isArray(p.owned) ? p.owned : []).filter(id => CARD_IDS.includes(id)),
  };
}
