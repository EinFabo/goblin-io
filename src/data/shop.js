
export const SHOP = [
  { id: 'atk', icon: 'whet', name: 'Scharfe Klingen', desc: '+6 % Schaden', max: 10, base: 40 },
  { id: 'hp', icon: 'heart', name: 'Dicke Haut', desc: '+12 max. Leben', max: 10, base: 40 },
  { id: 'spd', icon: 'boots', name: 'Flinke Füße', desc: '+4 % Lauftempo', max: 5, base: 60 },
  { id: 'mag', icon: 'magnet', name: 'Gierige Finger', desc: '+12 % Sammelradius', max: 5, base: 50 },
  { id: 'xp', icon: 'gem', name: 'Goblin-Schläue', desc: '+6 % Erfahrung', max: 5, base: 70 },
  { id: 'stam', icon: 'dash', name: 'Zähe Lunge', desc: '+15 % Ausdauer', max: 5, base: 50 },
  { id: 'ult', icon: 'rage', name: 'Kurze Zündschnur', desc: 'Goblin-Wut lädt 10 % schneller', max: 5, base: 80 },
  { id: 'mech', icon: 'mech', name: 'Goblin-Ingenieur', desc: 'Maschine hält 1,5 s länger', max: 5, base: 90 },
  { id: 'reroll', icon: 'dice', name: 'Gezinkte Würfel', desc: '+1 Neu-Würfeln pro Lauf', max: 3, base: 120 },
];
export const shopCost = (s, lv) => Math.round(s.base * Math.pow(lv + 1, 1.45));
