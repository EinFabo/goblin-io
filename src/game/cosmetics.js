// ---------- Kosmetik: besitzen, anziehen, Kosmetiktruhe (PLAN 9.5, 9.7) ----------
import { RARITIES } from '../data/cards.js';
import { COSM, COSMETICS, COSMO_CHEST } from '../data/cosmetics.js';

export const owns = (save, id) => save.cosm.includes(id);
// Neue Teile aus der Kosmetiktruhe/dem Laden: nur was es dort gibt und noch nicht da ist
export const missing = save => COSMETICS.filter(c => c.src === 'chest' && !owns(save, c.id));

// Kosmetiktruhe: Seltenheit würfeln (70/22/7/1), daraus ein fehlendes Teil. Gibt es in der Seltenheit nichts
// Neues mehr, nimm die nächste mit neuen Teilen (erst niedriger, dann höher). Alles da → null.
export function rollCosmetic(save, r) {
  const left = missing(save); if (!left.length) return null;
  let x = r() * 100, k = 0;
  while (k < 3 && x >= COSMO_CHEST.odds[k]) { x -= COSMO_CHEST.odds[k]; k++; }
  const order = [k, ...[k - 1, k - 2, k - 3].filter(i => i >= 0), ...[k + 1, k + 2, k + 3].filter(i => i < 4)];
  for (const i of order) { const pool = left.filter(c => c.rarity === RARITIES[i]); if (pool.length) return pool[(r() * pool.length) | 0].id; }
  return null;
}
export function grantCosmetic(save, id) { if (!COSM[id] || owns(save, id)) return false; save.cosm.push(id); return true; }
export function equip(save, id) {
  const c = COSM[id]; if (!c || !owns(save, id)) return false;
  save.look[c.slot] = c.key; return true;
}
export const equipped = (save, id) => { const c = COSM[id]; return !!c && save.look[c.slot] === c.key; };
