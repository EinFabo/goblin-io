// ---------- Gegner-Typen ----------
export const ETYPES = {
  fire: { name: 'Feuermagier', tip: 'Glühender Stab = gleich kommt ein Feuerball.', hp: 8, spd: 56, dmg: 6, r: 15, sc: 1, cast: 'fire', cd: [5, 9], range: 360, xp: 2 },
  frost: { name: 'Frostmagier', tip: 'Eisspeere verlangsamen dich.', hp: 9, spd: 50, dmg: 5, r: 15, sc: 1, cast: 'frost', cd: [5.5, 9.5], range: 350, xp: 2 },
  imp: { name: 'Schattenlehrling', tip: 'Schnell, aber schwach.', hp: 4, spd: 92, dmg: 4, r: 11, sc: .7, tint: 'shadow', xp: 1 },
  brute: { name: 'Großmagier', tip: 'Schießt drei Feuerbälle auf einmal.', hp: 60, spd: 38, dmg: 12, r: 22, sc: 1.45, tint: 'ember', cast: 'fire3', cd: [5, 8], range: 400, xp: 8 },
  storm: { name: 'Blitzmagier', tip: 'Raus aus dem gelben Kreis!', hp: 10, spd: 48, dmg: 9, r: 15, sc: 1.05, tint: 'storm', cast: 'storm', cd: [5.5, 8.5], range: 430, xp: 3 },
  toxic: { name: 'Giftmagier', tip: 'Wirft Giftpfützen. Nicht reinlaufen.', hp: 11, spd: 46, dmg: 5, r: 15, sc: 1.05, tint: 'toxic', cast: 'toxic', cd: [6, 9], range: 380, xp: 3 },
  void: { name: 'Schattenmagier', tip: 'Teleportiert sich direkt neben dich.', hp: 9, spd: 40, dmg: 7, r: 15, sc: 1, tint: 'void', cast: 'blink', cd: [4, 6.5], range: 600, xp: 3 },
  healer: { name: 'Heilmagier', tip: 'Heilt andere Magier. Zuerst erledigen!', hp: 14, spd: 44, dmg: 4, r: 15, sc: 1.05, tint: 'holy', cast: 'heal', cd: [4, 6], range: 9999, xp: 4, keep: 230 },
  bomber: { name: 'Funkenwichtel', tip: 'Explodiert neben dir. Früh erledigt, sprengt er andere Magier.', hp: 6, spd: 108, dmg: 0, r: 12, sc: .75, tint: 'ember', xp: 2, bomber: true },
};
export const CHARGE = { fire: .75, frost: .75, fire3: .9, storm: .8, toxic: .8, blink: .55, void: .45, heal: .9 };
export const CCOL = { fire: '#ff8a1f', fire3: '#ff5a1f', frost: '#7fd8ff', storm: '#ffe45c', toxic: '#7be04a', blink: '#b26bff', void: '#b26bff', heal: '#9dff9a' };
export const AIMED = { fire: 1, fire3: 1, frost: 1, void: 1 };
export const OFF = { down: [-6.7, 21.1], up: [25.4, -28.3], left: [-33.9, -1.6], right: [33.9, -1.6] };
