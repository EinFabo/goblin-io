// ---------- Quests und Aufgaben-Pass (Phase 11, Wunsch Fabi 2026-10-14, Entscheidungen 2026-10-28) ----------
// Wochenaufgaben, Aufgaben-Pass, Kopfgeld-Brett (ohne Mutatoren, die kommen mit Phase 12) und Fähigkeiten-Quests.
// Wie die Tagesaufgaben lesen sie nur Zähler (save.stats.c bzw. run.cnt), Logik in game/quests.js.

// ---------- Wochenaufgaben: 5 je Woche, schwerer als die täglichen ----------
// key: Zähler (wie DAILY_POOL), n: mögliche Ziele, need: nur anbieten, wenn das schon geht (beim Wochenstart festgelegt)
// reward: { gold } | { gems } | { chest } | { runes: true } (eine Runenkiste)
export const WEEKLY_POOL = [
  { id: 'kills', desc: 'Besiege {n} Magier', key: 'kills', n: [2500, 3500, 5000], reward: { gems: 30 } },
  { id: 'bosses', desc: 'Besiege {n} Bosse', key: 'bosses', n: [3, 4, 5], reward: { chest: 'iron' } },
  { id: 'levels', desc: 'Schaffe {n} Level', key: 'levels', n: [12, 18, 25], reward: { gems: 30 } },
  { id: 'hat3', desc: 'Schaffe {n} Level mit allen drei Hüten', key: 'hat3', n: [5, 8, 12], reward: { runes: true } },
  { id: 'nmwin', desc: 'Schaffe {n} Level im Albtraum', key: 'nmwin', n: [2, 3, 4], reward: { chest: 'iron' }, need: s => s.stages[1] && s.stages[1].cleared },
  { id: 'perfect', desc: 'Rolle {n}× perfekt durch Geschosse', key: 'perfect', n: [40, 60, 90], reward: { gems: 30 } },
  { id: 'mega', desc: 'Verschmilz {n} Mega-Entwicklungen', key: 'mega', n: [1, 2, 3], reward: { runes: true } },
  { id: 'evo', desc: 'Entwickle {n} Waffen weiter', key: 'evo', n: [5, 8, 12], reward: { gems: 30 } },
  { id: 'abil', desc: 'Setze Fähigkeiten {n}× ein', key: 'abil', n: [150, 250, 400], reward: { gold: 800 } },
  { id: 'gold', desc: 'Sammle {n} Gold in Läufen', key: 'gold', n: [2000, 3000, 4500], reward: { gems: 30 } },
  { id: 'elites', desc: 'Besiege {n} Elite-Magier oder Mini-Bosse', key: 'elites', n: [30, 45, 60], reward: { runes: true } },
  { id: 'combo', desc: 'Löse {n} Kombos aus', key: 'combo', n: [5, 10, 20], reward: { gold: 800 } },
  { id: 'chests', desc: 'Öffne {n} Truhen', key: 'chests', n: [6, 10, 15], reward: { gems: 30 } },
  { id: 'clswin', desc: 'Schaffe {n} Level mit einer anderen Klasse als dem Goblin', key: 'clswin', n: [5, 10, 15], reward: { runes: true }, need: s => s.stages[2] && s.stages[2].cleared },
  { id: 'rolls', desc: 'Rolle oder springe {n}×', key: 'rolls', n: [400, 600, 900], reward: { gold: 600 } },
];
export const WEEKLY_N = 5;
export const WEEKLY_BONUS = { chest: 'gold' };   // alle fünf geschafft

// ---------- Aufgaben-Pass (kostenlos) ----------
// Saison = 4 Wochen ab dem ersten Montag (QUEST_EPOCH), 30 Stufen à 100 Punkte, danach alle 150 Punkte eine Bonustruhe.
export const QUEST_EPOCH = '2026-10-26';   // Montag: Woche 0, Saison 0
export const SEASON_WEEKS = 4;
export const PASS_STAGES = 30, PASS_STEP = 100, PASS_BONUS_STEP = 150;
export const PASS_BONUS = { chest: 'iron' };
// Punkte je Quelle
export const PASS_PTS = { daily: 20, dailyAll: 30, weekly: 60, bounty: 30, aq: 40 };
// Saison-Kosmetik: 4 Sets im Wechsel; Stufe 10 Roll-Spur, 20 Dolch, 30 Maschine (+ Titel). Farben in data/cosmetics.js
export const SEASON_SETS = [
  { name: 'Frost', trail: 'frost', dagger: 'ice', mech: 'frost' },
  { name: 'Glut', trail: 'embers', dagger: 'ember', mech: 'lava' },
  { name: 'Gift', trail: 'toxic', dagger: 'venom', mech: 'swamp' },
  { name: 'Nacht', trail: 'stars', dagger: 'shadow', mech: 'night' },
];
export const PASS_TITLE = 'Pass-Held';
// Kosmetik-Set einer Saison
export const seasonSet = season => SEASON_SETS[((season % SEASON_SETS.length) + SEASON_SETS.length) % SEASON_SETS.length];
// Belohnung von Stufe s (1–30) in Saison season
export function passReward(s, season) {
  const set = seasonSet(season);
  if (s === 10) return { cosm: 'trail.' + set.trail };
  if (s === 20) return { cosm: 'dagger.' + set.dagger };
  if (s === 30) return { cosm: 'mech.' + set.mech, title: PASS_TITLE };
  if (s % 5 === 0) return { chest: s === 5 ? 'iron' : 'gold' };
  if (s % 4 === 0) return { runes: true };
  return s % 2 ? { gold: 100 + 10 * s } : { gems: 10 };
}

// ---------- Kopfgeld-Brett: ab Welt 2, täglich 3 Steckbriefe ----------
// Ziele: Boss einer freien Welt, Level einer freien Welt, Magier einer Schule, Elite mit einer Eigenschaft (ab Welt 3).
// Bedingungen (eine je Steckbrief, nicht immer): ohne Treffer im Bosskampf, unter einer Zeit, mit Fähigkeit X, im Albtraum,
// ohne Heilung, als Klasse X. Schwierigkeit = Totenköpfe (1–3) aus Ziel + Bedingung, danach die Belohnung.
export const BOUNTY_N = 3;
export const BOUNTY_SKULL = { boss: 2, level: 1, school: 1, affix: 2 };
export const BOUNTY_COND = { nohit: 2, time: 1, abil: 0, nm: 1, noheal: 1, cls: 0 };
export const BOUNTY_REWARD = [{ gold: 200 }, { gems: 25 }, { chest: 'iron' }];   // nach Totenköpfen 1/2/3
// Zeitgrenze im Boss-Level (Sekunden ab Levelstart), etwas unter dem Schnitt des Bots
export const bountyTime = si => 180 + 5 * si;

// ---------- Fähigkeiten-Quests: je Fähigkeit 3 Stufen ----------
// kills: Gegner, die die Fähigkeit (oder ihre Helfer) besiegt; use: Einsätze (Fähigkeiten ohne eigenen Schaden).
// Bronze = passende seltene Rune, Silber = Runenkiste + silberner Rahmen, Gold = Titel „Meister der …“ + legendäre Rune.
export const AQ_GOALS = { kills: [200, 1500, 8000], use: [30, 200, 800] };
// Ausnahmen: das Amulett wirkt nur, wenn man stirbt (höchstens einmal je Lauf und Ladung)
export const AQ_GOAL_OF = { charm: [5, 25, 80] };
export const AQ_TIERS = [{ name: 'Bronze', col: '#c9844a' }, { name: 'Silber', col: '#c9d1d8' }, { name: 'Gold', col: '#f4d03f' }];
// Fähigkeiten ohne eigenen Schaden zählen Einsätze
export const AQ_USE = ['smoke', 'shroom', 'shield', 'totem', 'charm', 'brew'];
export const aqKey = id => (AQ_USE.includes(id) ? 'use' : 'kills');
export const aqText = (name, key, n) => (key === 'use' ? `Setze ${name} ${n.toLocaleString('de-DE')}× ein` : `Besiege ${n.toLocaleString('de-DE')} Gegner mit ${name}`);
