// ---------- Kombos (PLAN Phase 10) ----------
// Zwei bestimmte Fähigkeiten kurz nacheinander (die zweite höchstens COMBO_T s nach der ersten, Reihenfolge egal)
// lösen einen Zusatz-Effekt aus (game/combos.js). Erstes Entdecken: Banner, Eintrag im Kombo-Buch, Juwelen.
export const COMBO_T = 4;
export const COMBO_GEMS = 10;
export const COMBOS = {
  poisontrap: { a: 'smoke', b: 'trap', name: 'Giftfallen', desc: 'Jede liegende Falle stößt eine Giftwolke aus.' },
  inferno: { a: 'oilcask', b: 'turret', name: 'Inferno', desc: 'Alles Öl fängt Feuer, Flammentürme brennen 50 % heißer.' },
  implosion: { a: 'scrapmag', b: 'bigbang', name: 'Implosion', desc: 'Ein zweiter Knall in deiner Nähe mit 50 % Schaden.' },
  bullseye: { a: 'scrapmag', b: 'catapult', name: 'Volltreffer', desc: 'Ein Riesenfels schlägt mitten in die zusammengezogene Gruppe.' },
  whirlhook: { a: 'hook', b: 'spin', name: 'Wirbelhaken', desc: 'Zieht alle Gegner im Umkreis in deine Wirbelaxt.' },
  warfrenzy: { a: 'rage', b: 'call', name: 'Kriegsrausch', desc: 'Deine Krieger geraten in Raserei: schneller und stärker.' },
  icerink: { a: 'timebomb', b: 'oilcask', name: 'Eisbahn', desc: 'Das Öl gefriert: Gegner darauf frieren 2 s ein.' },
  baittrap: { a: 'decoy', b: 'trap', name: 'Köderfalle', desc: 'Unter jedem Strohgoblin schnappt eine Falle auf.' },
  plague: { a: 'rats', b: 'bees', name: 'Plage', desc: 'Alle Gegner im Bild werden vergiftet und verlangsamt.' },
  witchkitchen: { a: 'shroom', b: 'brew', name: 'Hexenküche', desc: 'Du heilst 25 % und bekommst einen Trank dazu.' },
  bladeshield: { a: 'shield', b: 'spin', name: 'Klingenschild', desc: 'Der Schild hält 50 % mehr aus und zerschneidet, wer ihn trifft.' },
  quakebomb: { a: 'burrow', b: 'timebomb', name: 'Unterbeben', desc: 'Unter jedem eingefrorenen Gegner bricht die Erde auf.' },
};
export const COMBO_IDS = Object.keys(COMBOS);
// Kombo für ein Fähigkeiten-Paar (Reihenfolge egal) oder null
export const comboOf = (x, y) => COMBO_IDS.find(k => { const C = COMBOS[k]; return (C.a === x && C.b === y) || (C.a === y && C.b === x); }) || null;
