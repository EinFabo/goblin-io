// ---------- Karten und Truhen (PLAN 9.3, 9.5) ----------
// Jede Waffe und jedes Passiv hat eine Kartenstufe. Karten kommen aus Truhen und dem Laden,
// Aufwerten kostet Karten + Gold. Alle Gegenstände sind auch ohne Karten im Lauf wählbar.
import { PASSIVES, POOL_WEAPONS, WEAPONS } from './weapons.js';
import { nmChestSteps } from './nightmare.js';

export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const RARITY = {
  common: { name: 'Gewöhnlich', color: '#c9c9c0', start: 1 },
  rare: { name: 'Selten', color: '#5fb4ff', start: 1 },
  epic: { name: 'Episch', color: '#b77cff', start: 3 },
  legendary: { name: 'Legendär', color: '#ffc93c', start: 5 },
};
// Seltenheit je Gegenstand. Legendär sind Schattenkugel und Lichtlanze (zweite Reihe, 2026-10-14).
export const CARD_RARITY = {
  dagger: 'common', spear: 'common', poison: 'common', boomer: 'common',
  orbit: 'rare', fireball: 'rare', bolt: 'rare', barrel: 'rare',
  saw: 'epic', gang: 'epic',
  whet: 'common', armor: 'common', heart: 'common', herbs: 'common', boots: 'common', magnet: 'common',
  book: 'rare', amulet: 'rare', oil: 'rare',
  powder: 'epic',
  // zweite Reihe
  shuriken: 'common', crossbow: 'common', rock: 'common',
  hammer: 'rare', glob: 'rare', spark: 'rare',
  soul: 'epic', mine: 'epic',
  shadow: 'legendary', lance: 'legendary',
  helmet: 'common', crystal: 'common', ember: 'common', clover: 'common', bag: 'common',
  horn: 'rare', skull: 'rare', hourglass: 'rare',
  cloak: 'epic', fang: 'epic',
};
export const CARD_IDS = [...POOL_WEAPONS, ...Object.keys(PASSIVES)];
export const isWeapon = id => !!WEAPONS[id];
export const cardName = id => (WEAPONS[id] || PASSIVES[id]).name;
export const CARD_MAX = 10;

// Aufwerten von Stufe L auf L+1: [Karten, Gold], wie Clash Royale (9.3)
const COST = {
  common: [[2, 20], [4, 50], [10, 150], [20, 400], [50, 1000], [100, 2000], [200, 4000], [400, 8000], [800, 15000]],
  rare: [[2, 50], [4, 150], [10, 400], [20, 1000], [50, 2000], [100, 4000], [200, 8000], [400, 15000], [800, 25000]],
  epic: [[2, 400], [4, 1000], [10, 2000], [20, 4000], [50, 8000], [100, 15000], [200, 25000]],
  legendary: [[1, 2000], [2, 4000], [4, 8000], [10, 15000], [20, 25000]],
};
export function upgradeCost(id, lv) {
  const r = CARD_RARITY[id], i = lv - RARITY[r].start;
  return lv >= CARD_MAX || i < 0 ? null : { cards: COST[r][i][0], gold: COST[r][i][1] };
}
// Karten bis Stufe 10 insgesamt (für „voll“ und die Umwandlung in Gold)
export function cardsToMax(id, lv) { let n = 0; for (let l = lv; l < CARD_MAX; l++) n += upgradeCost(id, l).cards; return n; }
// Gold für überzählige Karten: so viel, wie eine Karte beim letzten Aufwerten wert war
export const GOLD_PER_SPARE = { common: 5, rare: 15, epic: 60, legendary: 300 };

// Wirkung einer Kartenstufe (9.3)
export const weaponCardMul = lv => 1 + .06 * (lv - 1);         // Grundschaden
export const passiveCardMul = lv => 1 + .1 * (lv - 1);         // Wirkung
export const CARD_START_LV2 = 5;                                // Waffe startet im Lauf auf Waffenstufe 2
export const CARD_FAST = 10;                                    // Stufe 10: Waffe greift 15 % schneller an
export function cardPerks(id, lv) {
  if (!isWeapon(id)) return [`+${Math.round((passiveCardMul(lv) - 1) * 100)} % Wirkung`];
  const p = [`+${Math.round((weaponCardMul(lv) - 1) * 100)} % Schaden`];
  if (lv >= CARD_START_LV2) p.push('startet auf Waffenstufe 2'); if (lv >= CARD_FAST) p.push('greift 15 % schneller an');
  return p;
}

// ---------- Truhen (9.5) ----------
// odds: Gewöhnlich/Selten/Episch/Legendär in %, sure: garantierte Mindest-Seltenheit,
// bonus: [Chance, Juwelen von, bis] auf einen Bonusfund (halb Juwelen, halb „Goldader“ = Gold doppelt)
// wait: Öffnungszeit im Truhenregal (Wunsch Fabi: je seltener, desto länger; gekaufte Truhen öffnen sofort)
const MIN = 60 * 1000;
export const CHESTS = {
  wood: { name: 'Holztruhe', price: { gold: 150 }, gold: [80, 120], cards: 6, odds: [88, 12, 0, 0], sure: null, bonus: [.05, 5, 10], wait: 15 * MIN, color: '#9c6a3c', metal: '#6d747c' },
  iron: { name: 'Eisentruhe', price: { gems: 60 }, gold: [300, 400], cards: 18, odds: [72, 24, 4, 0], sure: ['rare', 1], bonus: [.08, 8, 15], wait: 60 * MIN, color: '#6d747c', metal: '#c9d1d8' },
  gold: { name: 'Goldtruhe', price: { gems: 160 }, gold: [900, 1200], cards: 45, odds: [62, 28, 9, 1], sure: ['rare', 2], bonus: [.1, 10, 20], wait: 3 * 60 * MIN, color: '#c9962a', metal: '#ffe27a', pity: true },
  mage: { name: 'Magiertruhe', price: { gems: 420 }, gold: [2500, 3000], cards: 110, odds: [55, 30, 13, 2], sure: ['epic', 1], bonus: [.12, 15, 25], wait: 8 * 60 * MIN, color: '#5b2f8f', metal: '#ffd84a', pity: true },
};
export const CHEST_IDS = Object.keys(CHESTS);
// Pity (9.5): spätestens jede 10. Gold-/Magiertruhe episch, jede 40. legendär
export const PITY_EPIC = 10, PITY_LEG = 40;
// Siegtruhe nach jedem Boss-Level, je nach Welt (0-basiert)
// Albtraum: eine Stufe besser
const CHEST_UP = { wood: 'iron', iron: 'gold', gold: 'mage', mage: 'mage' };
// Albtraum: eine Stufe besser, ab Stufe 3/6/9 je eine weitere (data/nightmare.js); nm: Stufe (true = 1 für alte Aufrufer)
export const victoryChest = (si, nm = 0) => { let t = si <= 1 ? 'wood' : si <= 4 ? 'iron' : 'gold'; for (let i = nmChestSteps(nm === true ? 1 : +nm || 0); i > 0; i--) t = CHEST_UP[t]; return t; };
export const SHELF = 4;                       // Plätze im Truhenregal
export const FREE_EVERY = 4 * 3600 * 1000;    // Gratis-Holztruhe alle 4 Stunden
export const FREE_MAX = 2;                    // höchstens 2 gespeichert
// Abkürzen mit Juwelen: 1 Juwel je angefangene 6 Minuten Restzeit
export const skipGems = ms => Math.max(1, Math.ceil(ms / (6 * MIN)));

// ---------- Juwelen (9.2) ----------
export const GEMS = { hat: 4, acctLevel: 10, bossFirst: w => 20 + 10 * w };   // Albtraum: data/nightmare.js nmGems
