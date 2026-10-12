// Was ein Spieler vor einer Stage typischerweise an Upgrades hat (PLAN 7.6).
// Talent-Stufen (data/talents.js); entspricht den Werkstatt-Stufen von früher ×2.
export const EXPECTED = {
  1: {},
  2: { atk: 2, hp: 2 },
  3: { atk: 8, hp: 8 },
  4: { atk: 12, hp: 12 },
  5: { atk: 16, hp: 16, spd: 6 },
};

// Zielwerte für den "Normal"-Bot in Prozent: [min, max] ohne Upgrades und mit erwarteten
export const TARGET = {
  1: { none: [85, 100], exp: [95, 100] },
  2: { none: [60, 100], exp: [90, 100] },
  3: { none: [20, 40], exp: [75, 85] },
  4: { none: [20, 40], exp: [75, 85] },
  5: { none: [0, 15], exp: [65, 75] },
};

// Welten (6.1a): Ziel je Level mit den erwarteten Upgrades der Welt. Level 1–4 sind 2:30 überleben,
// das Boss-Level soll so schwer sein wie früher die ganze Stage.
export const LEVEL_TARGET = [[95, 100], [88, 100], [80, 95], [75, 90], [60, 85]];
