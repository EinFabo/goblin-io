// ---------- Kosmetik für den Goblin (PLAN 9.7) ----------
// Kein Spielwert. Quellen: Kosmetiktruhe (Juwelen), Laden (Tagesangebot), Erfolge, Boss-Trophäen.
// Farben/Formen stehen im Generator (gen/goblin.js) bzw. hier für Dolch, Roll-Spur und Maschine.
export const SLOTS = [
  { id: 'skin', name: 'Haut' }, { id: 'hat', name: 'Hut' }, { id: 'outfit', name: 'Outfit' },
  { id: 'dagger', name: 'Dolch' }, { id: 'trail', name: 'Roll-Spur' }, { id: 'mech', name: 'Maschine' },
];
// src: 'start' (hat jeder), 'chest' (Kosmetiktruhe + Laden), oder ein Text, woher es sonst kommt
const C = (slot, key, name, rarity, src = 'chest', extra = {}) => ({ id: slot + '.' + key, slot, key, name, rarity, src, ...extra });
export const COSMETICS = [
  C('skin', 'green', 'Grün', 'common', 'start'),
  C('skin', 'moss', 'Moos', 'common'), C('skin', 'cave', 'Höhlengrau', 'common'), C('skin', 'swamp', 'Sumpfblau', 'rare'),
  C('skin', 'fire', 'Feuerrot', 'epic'), C('skin', 'gold', 'Gold', 'legendary'),
  C('hat', 'zipfel', 'Lila Zipfelmütze', 'common', 'start'),
  C('hat', 'chef', 'Kochmütze', 'common'), C('hat', 'pot', 'Kochtopf', 'common'), C('hat', 'pirate', 'Piratenhut', 'rare'),
  C('hat', 'viking', 'Wikingerhelm', 'rare'),
  C('hat', 'wizard', 'Magierhut', 'epic', 'Trophäe: Malvorn besiegen (Welt 8)'),
  C('hat', 'crown', 'Krone', 'legendary', 'Erfolg: alle Level mit 3 Hüten'),
  C('outfit', 'vest', 'Lederweste', 'common', 'start'),
  C('outfit', 'rags', 'Lumpen', 'common'), C('outfit', 'suit', 'Anzug', 'rare'), C('outfit', 'overall', 'Mechaniker-Overall', 'rare'),
  C('outfit', 'knight', 'Ritterrüstung', 'epic'),
  C('dagger', 'steel', 'Stahl', 'common', 'start'),
  C('dagger', 'bronze', 'Bronze', 'common'), C('dagger', 'bone', 'Knochen', 'common'), C('dagger', 'crystal', 'Kristall', 'rare'),
  C('dagger', 'fish', 'Fischgräte', 'rare'), C('dagger', 'fire', 'Feuerklinge', 'epic'),
  C('trail', 'dust', 'Staub', 'common', 'start'),
  C('trail', 'sparks', 'Funken', 'common'), C('trail', 'leaves', 'Blätter', 'common'), C('trail', 'bats', 'Fledermäuse', 'rare'),
  C('trail', 'rainbow', 'Regenbogen', 'epic'),
  C('mech', 'brass', 'Messing', 'common', 'start'),
  C('mech', 'rust', 'Rost', 'common'), C('mech', 'police', 'Polizeiblau', 'rare'), C('mech', 'flames', 'Flammen', 'epic'),
  C('mech', 'gold', 'Gold', 'legendary'),
  // Saison-Sets des Aufgaben-Passes (Phase 11, data/quests.js SEASON_SETS): Stufe 10 Spur, 20 Dolch, 30 Maschine
  ...[['frost', 'ice', 'frost', 'Frost'], ['embers', 'ember', 'lava', 'Glut'], ['toxic', 'venom', 'swamp', 'Gift'], ['stars', 'shadow', 'night', 'Nacht']].flatMap(([t, d, m, n]) => [
    C('trail', t, n + '-Spur', 'epic', 'Aufgaben-Pass Stufe 10'), C('dagger', d, n + '-Dolch', 'epic', 'Aufgaben-Pass Stufe 20'), C('mech', m, n + '-Maschine', 'legendary', 'Aufgaben-Pass Stufe 30')]),
];
export const COSM = Object.fromEntries(COSMETICS.map(c => [c.id, c]));
export const START_COSM = COSMETICS.filter(c => c.src === 'start').map(c => c.id);
export const DEFAULT_LOOK_KEYS = Object.fromEntries(SLOTS.map(s => [s.id, COSMETICS.find(c => c.slot === s.id && c.src === 'start').key]));

// Dolch-Skins: Tönung des Wurfdolchs (Farbe, Stärke); Steel = keine
export const DAGGER_TINT = { steel: null, bronze: ['#d08a3a', .55], bone: ['#f2e6c4', .6], crystal: ['#8fe6ff', .6], fish: ['#c9d8e0', .45], fire: ['#ff6a2a', .6],
  ice: ['#bfefff', .65], ember: ['#ff3a1a', .55], venom: ['#7be04a', .6], shadow: ['#3b1466', .6] };
// Roll-Spur: Partikelfarben der Rolle (Regenbogen wechselt durch), Nachbild-Tönung
export const TRAIL = {
  dust: { cols: ['rgba(220,210,170,.8)'], tint: 'trail' },
  sparks: { cols: ['#ffd84a', '#fff2a0', '#ff9a2e'], tint: 'gold' },
  leaves: { cols: ['#7be04a', '#4f9a2a', '#a8f070'], tint: 'toxp' },
  bats: { cols: ['#5a3a7a', '#2a1a3a', '#8a5ac0'], tint: 'shadow' },
  rainbow: { cols: ['#ff5a5a', '#ffb13a', '#ffe45c', '#6fe04a', '#5fb4ff', '#b77cff'], tint: 'trail' },
  frost: { cols: ['#dff6ff', '#8fdcff', '#ffffff'], tint: 'trail' },
  embers: { cols: ['#ff5a1a', '#ffb13a', '#5a1a08'], tint: 'ember' },
  toxic: { cols: ['#9cf06a', '#5be03a', '#2a5a12'], tint: 'toxp' },
  stars: { cols: ['#ffffff', '#c9a8ff', '#6f7fff'], tint: 'voidp' },
};
// Zufällige Partikelfarbe der Roll-Spur (nur Optik)
export const trailCol = key => { const c = (TRAIL[key] || TRAIL.dust).cols; return c[(Math.random() * c.length) | 0]; };
// Maschinen-Lackierung: Rumpf oben/unten, Nieten
export const MECH_PAINT = {
  brass: ['#e8b85a', '#8a5a22', '#6b4a12'], rust: ['#c0703a', '#5a2a12', '#3a1a0a'], police: ['#6a9ae8', '#1f3c7a', '#e8eef5'],
  flames: ['#ffb13a', '#b8200a', '#ffe45c'], gold: ['#fff0a0', '#c9962a', '#8a5a10'],
  frost: ['#cfeeff', '#3a6a9a', '#ffffff'], lava: ['#ff7a2a', '#3a1208', '#ffd84a'], swamp: ['#7da04a', '#2a3a12', '#d8f07a'], night: ['#3a3a6a', '#12122a', '#c9a8ff'],
};

// Kosmetiktruhe (9.5): 120 Juwelen, 1 Teil, keine Doppelten solange es Neue gibt
export const COSMO_CHEST = { name: 'Kosmetiktruhe', price: { gems: 120 }, odds: [70, 22, 7, 1], color: '#2f7a8a', metal: '#ffd84a', wait: 0 };
// Preis im Laden je Seltenheit (Juwelen)
export const COSM_PRICE = { common: 40, rare: 80, epic: 160, legendary: 300 };
