// ---------- Wiedergeburt und Seelenbaum (Phase 12, Wunsch Fabi 2026-10-14) ----------
// Nach dem Boss von Welt 8 und einer vollen Runde Endlose Nacht: Welt-Fortschritt beginnt neu (Zyklus n+1), dafür Seelen.
// Seelen = 10 je geschaffter Welt + 5 je Albtraum-Stufe (Summe der besten Boss-Stufen) + Minuten der besten Endlosen Nacht.
// Zyklus n: Gegner +10 %·n Leben und +5 %·n Schaden, Gold und XP +25 %·n (Plan: je +20 %; im Bot war Zyklus 2 so nicht mehr schaffbar,
// der Seelenbaum gleicht den Rest aus).
export const SOULS_WORLD = 10, SOULS_NM = 5;
export const cycleHp = n => 1 + .1 * (n || 0);
export const cycleDmg = n => 1 + .05 * (n || 0);
export const cycleReward = n => 1 + .25 * (n || 0);

// Drei Äste + Krönung. cost: Seelen je Rang, req: Knoten, der mindestens einen Rang haben muss
export const SOUL_BRANCHES = { war: 'Krieger', col: 'Sammler', mys: 'Mystiker' };
export const SOUL_NODES = {
  // Krieger
  w_dmg: { br: 'war', name: 'Seelenklinge', desc: '+5 % Schaden je Rang', max: 3, cost: [10, 20, 30] },
  w_hp: { br: 'war', name: 'Seelenpanzer', desc: '+5 % Leben je Rang', max: 3, cost: [10, 20, 30] },
  w_start: { br: 'war', name: 'Kampfbereit', desc: 'Startwaffe beginnt auf Stufe 2', max: 1, cost: [25], req: 'w_dmg' },
  w_reroll: { br: 'war', name: 'Zweite Chance', desc: '+1 Neuwürfeln je Lauf und Rang', max: 2, cost: [15, 30], req: 'w_hp' },
  w_crit: { br: 'war', name: 'Seelenfunke', desc: '+3 % kritische Treffer je Rang', max: 2, cost: [20, 35], req: 'w_start' },
  w_ban: { br: 'war', name: 'Verbannung', desc: '+1 Bannen je Lauf', max: 1, cost: [30], req: 'w_reroll' },
  // Sammler
  c_gold: { br: 'col', name: 'Goldgier', desc: '+10 % Gold je Rang', max: 3, cost: [10, 20, 30] },
  c_mag: { br: 'col', name: 'Seelenmagnet', desc: '+15 % Sammelradius je Rang', max: 2, cost: [10, 20] },
  c_pity: { br: 'col', name: 'Glücksbringer', desc: 'Epische und legendäre Karten 20 % früher (Pity)', max: 1, cost: [30], req: 'c_gold' },
  c_rune: { br: 'col', name: 'Runenfund', desc: 'Jede Siegtruhe bringt eine seltene Rune mit', max: 1, cost: [35], req: 'c_pity' },
  c_gems: { br: 'col', name: 'Juwelenader', desc: '+3 Juwelen je Boss-Sieg', max: 1, cost: [30], req: 'c_mag' },
  c_xp: { br: 'col', name: 'Weisheit', desc: '+5 % Konto- und Klassen-XP je Rang', max: 2, cost: [20, 35], req: 'c_gems' },
  // Mystiker
  m_axp: { br: 'mys', name: 'Seelenfluss', desc: '+10 % Fähigkeits-XP je Rang', max: 2, cost: [15, 30] },
  m_charge: { br: 'mys', name: 'Vorladung', desc: 'Fähigkeiten starten mit 25 % Ladung', max: 1, cost: [25] },
  m_cd: { br: 'mys', name: 'Zeitsand', desc: '−4 % Abklingzeit der Waffen je Rang', max: 2, cost: [20, 35], req: 'm_charge' },
  m_sock: { br: 'mys', name: 'Dritter Sockel', desc: 'Ein dritter Runensockel ab Fähigkeits-Level 25', max: 1, cost: [50], req: 'm_axp' },
  m_stam: { br: 'mys', name: 'Atem der Ahnen', desc: '+15 % Ausdauer je Rang', max: 2, cost: [10, 20] },
  // Krönung: braucht in jedem Ast mindestens 60 ausgegebene Seelen
  crown: { br: 'crown', name: 'Seelenkrone', desc: '4 statt 3 Karten beim Level-Up', max: 1, cost: [120], branchMin: 60 },
};
export const SOUL_IDS = Object.keys(SOUL_NODES);
export const SOCKET3_LV = 25;
