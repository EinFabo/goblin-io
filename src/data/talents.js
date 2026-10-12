// ---------- Talente (PLAN 9.4, ersetzt die Werkstatt aus v2) ----------
// Kontoweite Grundwerte, mit Gold aufwertbar, ab einem Konto-Level kaufbar.
// Halb so stark wie die alten Werkstatt-Stufen; die Migration verdoppelt deshalb die Stufen (save.js).
export const TALENTS = [
  { id: 'atk', icon: 'whet', name: 'Scharfe Klingen', desc: '+3 % Schaden', max: 20, acct: 1, base: 40 },
  { id: 'hp', icon: 'heart', name: 'Dicke Haut', desc: '+6 max. Leben', max: 20, acct: 1, base: 40 },
  { id: 'spd', icon: 'boots', name: 'Flinke Füße', desc: '+2 % Lauftempo', max: 10, acct: 2, base: 60 },
  { id: 'mag', icon: 'magnet', name: 'Gierige Finger', desc: '+6 % Sammelradius', max: 10, acct: 2, base: 50 },
  { id: 'stam', icon: 'dash', name: 'Zähe Lunge', desc: '+7,5 % Ausdauer', max: 10, acct: 4, base: 50 },
  { id: 'xp', icon: 'gem', name: 'Goblin-Schläue', desc: '+3 % Erfahrung; Stufe 10: 4. Level-Up-Karte', max: 10, acct: 6, base: 70 },
  { id: 'reroll', icon: 'dice', name: 'Gezinkte Würfel', desc: '+1 Neu-Würfeln pro Lauf', max: 3, acct: 8, base: 240, whole: true },
  { id: 'ban', icon: 'bomb', name: 'Bannfluch', desc: '+1 Bannen pro Lauf', max: 2, acct: 12, base: 400, whole: true },
];
export const TALENT = Object.fromEntries(TALENTS.map(t => [t.id, t]));
// Zwei Talent-Stufen kosten etwa so viel wie früher eine Werkstatt-Stufe; ganze Stufen (whole) wie früher
export const talentCost = (t, lv) => Math.round(t.whole ? t.base * Math.pow(lv + 1, 1.45) / 2 : t.base * Math.pow((lv + 2) / 2, 1.45) / 2);

// Werkstatt-Kosten aus v2 (für die Gold-Erstattung entfallener Stufen)
export const OLD_COST = { ult: 80, mech: 90 };
export const oldShopCost = (base, lv) => Math.round(base * Math.pow(lv + 1, 1.45));
