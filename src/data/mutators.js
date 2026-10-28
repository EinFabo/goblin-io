// ---------- Mutatoren (Phase 12): verändern einen Lauf der Täglichen Herausforderung oder eines Kopfgeld-Steckbriefs ----------
// Jeder Mutator ist ein kleiner Eingriff an einer Stelle im Spiel (hasMut in game/state.js). Keiner darf Math.random für Logik nutzen.
// sk: zusätzliche Schwierigkeit (Totenköpfe beim Kopfgeld)
export const MUTATORS = {
  glass: { name: 'Glaskanone', desc: 'Doppelter Schaden, halbes Leben.', sk: 1 },
  elites: { name: 'Doppelte Elites', desc: 'Jeder Elite-Magier kommt zu zweit.', sk: 1 },
  giants: { name: 'Riesen', desc: 'Gegner sind größer, haben doppeltes Leben und sind etwas langsamer.', sk: 1 },
  dark: { name: 'Dunkelheit', desc: 'Du siehst nur, was nah bei dir ist.', sk: 1 },
  fast: { name: 'Schnelle Magier', desc: 'Gegner laufen 30 % schneller.', sk: 1 },
  swarm: { name: 'Schwarm', desc: '50 % mehr Gegner.', sk: 1 },
  bullets: { name: 'Kugelhagel', desc: 'Gegnerische Geschosse fliegen 25 % schneller.', sk: 1 },
  gold: { name: 'Goldrausch', desc: 'Doppeltes Gold, dafür haben Gegner 30 % mehr Leben.', sk: 0 },
  boom: { name: 'Explosive Tode', desc: 'Besiegte Gegner explodieren – nicht zu nah ran!', sk: 1 },
  noheal: { name: 'Keine Heilung', desc: 'Nichts heilt dich.', sk: 1 },
  fragile: { name: 'Zerbrechlich', desc: 'Keine Rolle, kein Salto, kein Teleport.', sk: 1 },
  vamp: { name: 'Vampire', desc: 'Alle Elite-Magier sind vampirisch.', sk: 1 },
};
export const MUT_IDS = Object.keys(MUTATORS);
export const mutNames = list => (list || []).map(k => MUTATORS[k].name).join(', ');
