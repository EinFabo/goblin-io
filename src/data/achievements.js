// ---------- Erfolge und Tagesaufgaben (PLAN 9.8) ----------
// Alles zählt über Zähler im Spielstand (save.stats und save.stats.c, siehe game/progress.js).
// Erfolge haben drei Stufen (Bronze/Silber/Gold) und tragen lange (Wunsch Fabi: Grind, seltene Ziele).
import { COSMETICS } from './cosmetics.js';
import { TALENTS } from './talents.js';
import { WEAPONS } from './weapons.js';

export const TIERS = [{ name: 'Bronze', col: '#c9844a', gems: 10 }, { name: 'Silber', col: '#c9d1d8', gems: 25 }, { name: 'Gold', col: '#f4d03f', gems: 60 }];
export const SCHOOL_NAME = { fire: 'Feuer', frost: 'Frost', storm: 'Sturm', toxic: 'Gift', shadow: 'Schatten', necro: 'Nekro', earth: 'Erd', light: 'Licht' };

// v(s): aktueller Wert aus dem Spielstand. goals: Bronze/Silber/Gold. title: Titel ab Gold (oder an der Stufe in titleAt).
// cosm: Kosmetik bei Gold. fmt: Anzeige des Werts.
const c = key => s => (s.stats.c[key] || 0);
const hours = v => (v / 3600).toFixed(v < 36000 ? 1 : 0).replace('.', ',') + ' h';
const hatsTotal = s => Object.values(s.stages).reduce((n, st) => n + (st.lv || []).reduce((m, l) => m + l.hats, 0), 0);
const levelsDone = s => Object.values(s.stages).reduce((n, st) => n + (st.lv || []).filter(l => l.hats > 0).length, 0);
export const ACHIEVEMENTS = [
  { id: 'kills', name: 'Magierschreck', desc: 'Besiege {n} Magier', v: s => s.stats.kills, goals: [1000, 10000, 100000], title: 'Magierschreck' },
  { id: 'runs', name: 'Dauerläufer', desc: 'Spiele {n} Läufe', v: s => s.stats.runs, goals: [10, 100, 500] },
  { id: 'wins', name: 'Siegertyp', desc: 'Gewinne {n} Level', v: s => s.stats.wins, goals: [10, 75, 300], title: 'Siegertyp' },
  { id: 'bosses', name: 'Bossjäger', desc: 'Besiege {n} Bosse', v: c('bosses'), goals: [5, 30, 120], title: 'Bossjäger' },
  { id: 'elites', name: 'Elitejäger', desc: 'Besiege {n} Elite-Magier und Mini-Bosse', v: s => c('elites')(s) + c('minis')(s), goals: [25, 250, 1000] },
  { id: 'perfect', name: 'Schattenroller', desc: 'Rolle {n}× perfekt durch Geschosse', v: c('perfect'), goals: [25, 250, 1000], title: 'Schattenroller' },
  { id: 'rolls', name: 'Purzelbaum', desc: 'Rolle {n}×', v: c('rolls'), goals: [300, 3000, 15000] },
  { id: 'abil', name: 'Trickkiste', desc: 'Setze Fähigkeiten {n}× ein', v: c('abil'), goals: [50, 500, 2500] },
  { id: 'evo', name: 'Weiterentwickelt', desc: 'Entwickle {n}× eine Waffe weiter', v: c('evo'), goals: [1, 15, 75], title: 'Alchemist' },
  { id: 'mega', name: 'Verschmolzen', desc: 'Erschaffe {n}× eine Mega-Entwicklung', v: c('mega'), goals: [1, 5, 25], title: 'Megamagier' },
  { id: 'chests', name: 'Schatzsucher', desc: 'Öffne {n} Truhen', v: s => s.stats.chests, goals: [5, 30, 120], title: 'Schatzsucher' },
  { id: 'upgrades', name: 'Schmied', desc: 'Werte {n}× eine Karte auf', v: c('upgrades'), goals: [5, 30, 100], title: 'Goblin-Schmied' },
  { id: 'hats', name: 'Hutsammler', desc: 'Sammle {n} Magierhüte', v: hatsTotal, goals: [15, 60, 120], cosm: 'hat.crown', title: 'Hutkönig' },
  { id: 'levels', name: 'Weltenbummler', desc: 'Schaffe {n} verschiedene Level', v: levelsDone, goals: [5, 15, 25] },
  { id: 'play', name: 'Sitzfleisch', desc: 'Spiele {n}', v: s => s.stats.playSeconds, goals: [3600, 36000, 180000], fmt: hours },
  { id: 'gold', name: 'Goldgrube', desc: 'Sammle {n} Gold in Läufen', v: c('gold'), goals: [5000, 50000, 300000], title: 'Goldgrube' },
  { id: 'bestKills', name: 'Gemetzel', desc: 'Besiege {n} Magier in einem Lauf', v: s => s.stats.bestKills, goals: [400, 800, 1500] },
  { id: 'endless', name: 'Nachtwache', desc: 'Überlebe {n} in der Endlosen Nacht', v: c('endless'), goals: [300, 600, 1200], fmt: v => Math.floor(v / 60) + ' min', title: 'Nachtwache' },
  { id: 'acct', name: 'Erfahrener Goblin', desc: 'Erreiche Konto-Level {n}', v: s => s.profile.level, goals: [10, 25, 50], title: 'Goblin-Ältester' },
  { id: 'abilLv', name: 'Gelehrter', desc: 'Sammle {n} Fähigkeiten-Level', v: s => Object.values(s.abilities).reduce((n, a) => n + a.lv - 1, 0), goals: [20, 100, 300] },
  { id: 'talents', name: 'Talentiert', desc: 'Kaufe {n} Talent-Stufen', v: s => Object.values(s.talents).reduce((n, x) => n + x, 0), goals: [10, 40, TALENTS.reduce((n, t) => n + t.max, 0)] },
  { id: 'cosm', name: 'Modegoblin', desc: 'Besitze {n} Kosmetik-Teile', v: s => s.cosm.length, goals: [10, 20, COSMETICS.filter(x => !x.src.startsWith('Aufgaben-Pass')).length], title: 'Modegoblin' },
  { id: 'combos', name: 'Kombo-Meister', desc: 'Entdecke {n} Kombos', v: s => (s.combos || []).length, goals: [3, 8, 12], title: 'Kombo-Meister' },
  { id: 'stars', name: 'Sternensammler', desc: 'Sammle {n} Fähigkeiten-Sterne', v: s => Object.values(s.abilities).reduce((n, a) => n + (a.st || 0), 0), goals: [1, 10, 40] },
  { id: 'barrel', name: 'Fassbinder', desc: 'Gewinne {n} Level mit dem Sprengfass', v: c('w.barrel'), goals: [1, 10, 50], title: 'Fassbinder' },
  ...Object.entries(WEAPONS).filter(([id, W]) => id !== 'barrel' && !W.cls).map(([id, W]) => ({ id: 'w_' + id, name: `${W.name}-Meister`, desc: `Gewinne {n} Level mit ${W.name}`, v: c('w.' + id), goals: [1, 10, 50] })),
  ...Object.entries(SCHOOL_NAME).map(([k, n]) => ({ id: 'k_' + k, name: `${n}-Bezwinger`, desc: `Besiege {n} ${n}magier`, v: c('k.' + k), goals: [300, 3000, 20000] })),
];
export const ACH = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

// ---------- Tagesaufgaben: 3 pro Tag aus diesem Pool (Seed = Datum), Fortschritt = Zuwachs der Zähler seit Tagesbeginn ----------
// reward: { gold } | { gems } | { chest: 'wood' }
export const DAILY_POOL = [
  { id: 'kills', desc: 'Besiege {n} Magier', key: 'kills', n: [250, 400, 600], reward: { gold: 150 } },
  { id: 'elites', desc: 'Besiege {n} Elite-Magier oder Mini-Bosse', key: 'elites', n: [5, 8, 12], reward: { gems: 10 } },
  { id: 'levels', desc: 'Schaffe {n} Level', key: 'levels', n: [2, 3, 5], reward: { chest: 'wood' } },
  { id: 'perfect', desc: 'Rolle {n}× perfekt durch Geschosse', key: 'perfect', n: [8, 12, 20], reward: { gems: 15 } },
  { id: 'abil', desc: 'Setze Fähigkeiten {n}× ein', key: 'abil', n: [20, 35, 50], reward: { gold: 200 } },
  { id: 'gold', desc: 'Sammle {n} Gold in Läufen', key: 'gold', n: [200, 350, 500], reward: { gems: 10 } },
  { id: 'rolls', desc: 'Rolle {n}×', key: 'rolls', n: [60, 100, 150], reward: { gold: 120 } },
  { id: 'boss', desc: n => n === 1 ? 'Besiege einen Boss' : `Besiege ${n} Bosse`, key: 'bosses', n: [1, 1, 2], reward: { chest: 'wood' } },
  { id: 'evo', desc: n => n === 1 ? 'Entwickle eine Waffe weiter' : `Entwickle ${n} Waffen weiter`, key: 'evo', n: [1, 1, 2], reward: { gems: 15 } },
];
export const DAILY_BONUS = { gems: 20 };   // alle drei geschafft
