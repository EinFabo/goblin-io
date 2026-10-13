// ---------- Laden (PLAN 9.6): Tagesangebote, Truhen, Gold ----------
// Tagesangebote hängen nur am Datum (Seed), damit alle am selben Tag dasselbe sehen.
import { hashSeed, mulberry32 } from '../core/rng.js';
import { CARD_IDS, CARD_RARITY, CHESTS } from '../data/cards.js';

// Lokales Datum als Text; um Mitternacht gibt es neue Angebote
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function msToMidnight(d = new Date()) { const m = new Date(d); m.setHours(24, 0, 0, 0); return m - d; }

const pickOf = (r, rarity) => { const p = CARD_IDS.filter(id => CARD_RARITY[id] === rarity); return p[(r() * p.length) | 0]; };
// 1 Gratis-Gold, 3 Kartenpakete (Gold), 1 Truhe mit Rabatt. Der Kosmetik-Platz kommt mit der Garderobe.
export function dailyOffers(day) {
  const r = mulberry32(hashSeed('goblin-laden-' + day));
  const chest = ['iron', 'iron', 'gold'][(r() * 3) | 0], off = .3;
  return [
    { k: 'gold', n: 60, price: null },
    { k: 'cards', id: pickOf(r, 'common'), n: 20, price: { gold: 200 } },
    { k: 'cards', id: pickOf(r, 'rare'), n: 6, price: { gold: 300 } },
    { k: 'cards', id: pickOf(r, 'epic'), n: 1, price: { gold: 600 } },
    { k: 'chest', type: chest, price: { gems: Math.round(CHESTS[chest].price.gems * (1 - off)) }, off },
  ];
}
export const GOLD_PACKS = [{ gems: 20, gold: 300 }, { gems: 80, gold: 1400 }, { gems: 200, gold: 4000 }];

// Gekaufte Angebote gelten nur für den Tag; ein neuer Tag leert die Liste
export function shopToday(save, day = dayKey()) {
  if (save.shop.day !== day) save.shop = { day, bought: [] };
  return save.shop;
}
export function canPay(save, price) { return !price || (price.gold ? save.wallet.gold >= price.gold : save.wallet.gems >= price.gems); }
export function pay(save, price) {
  if (!canPay(save, price)) return false;
  if (price) { if (price.gold) save.wallet.gold -= price.gold; else save.wallet.gems -= price.gems; }
  return true;
}
