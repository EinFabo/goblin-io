// Was ein Spieler vor einer Stage typischerweise an Upgrades hat (PLAN 7.6).
// Bis die Talente aus Phase 5 kommen, sind das Werkstatt-Stufen (atk, hp, spd, …).
export const EXPECTED = {
  1: {},
  2: { atk: 1, hp: 1 },
  3: { atk: 4, hp: 4 },
  4: { atk: 6, hp: 6 },
  5: { atk: 8, hp: 8, spd: 3 },
};

// Zielwerte für den "Normal"-Bot in Prozent: [min, max] ohne Upgrades und mit erwarteten
export const TARGET = {
  1: { none: [85, 100], exp: [95, 100] },
  2: { none: [60, 100], exp: [90, 100] },
  3: { none: [20, 40], exp: [75, 85] },
  4: { none: [20, 40], exp: [75, 85] },
  5: { none: [0, 15], exp: [65, 75] },
};
