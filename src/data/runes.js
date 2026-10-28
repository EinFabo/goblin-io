// ---------- Runen (PLAN Phase 10) ----------
// Steinplättchen mit eingeritztem Zeichen (Wunsch Fabi). Jede Fähigkeit hat 2 Sockel (ab Fähigkeits-Level 10 und 20),
// eine Rune je Art pro Fähigkeit. 4 Stufen = Seltenheiten wie bei den Karten; 3 gleiche → eine der nächsten Stufe.
// Schlüssel im Spielstand: '<id>.<stufe>' (Stufe 0–3), z. B. 'fire.1' = seltene Feuerrune.
import { ABILITIES } from './abilities.js';
import { RARITIES, RARITY } from './cards.js';

// fits: 'hit' = macht selbst Schaden, 'summon' = Helfer/Objekte machen Schaden, 'all' = jede Fähigkeit,
// 'burst' = Echo: nur Fähigkeiten, die man ohne Durcheinander ein zweites Mal auslösen kann
// glyph: Pfad im 20×20-Feld (Zeichen im Stein)
const DMG = ['hit', 'summon'];
export const RUNES = {
  fire: { name: 'Feuerrune', col: '#ff7a2e', fits: DMG, val: [.15, .25, .4, .6], glyph: 'M13 3.5 6.5 10l6.5 6.5', desc: v => `Treffer setzen Gegner 2 s in Brand: ${pc(v)} des Treffers pro Sekunde.` },
  frost: { name: 'Frostrune', col: '#8fdcff', fits: DMG, val: [.2, .3, .4, .5], glyph: 'M10 3v14M4 6.5l12 7M16 6.5l-12 7', desc: v => `Getroffene Gegner sind 1,5 s um ${pc(v)} langsamer.` },
  poison: { name: 'Giftrune', col: '#9cf06a', fits: DMG, val: [.03, .04, .05, .07], glyph: 'M10 17V3M10 9.5 5 4M10 9.5l5-5.5', desc: v => `Jeder Treffer vergiftet 4 s (bis 5-fach): ${pc(v)} des Treffers pro Sekunde je Stapel.` },
  bolt: { name: 'Blitzrune', col: '#fff38a', fits: DMG, val: [.15, .25, .35, .5], jumps: [1, 1, 2, 3], glyph: 'M12.5 3 6 10.5h8L7.5 17', desc: (v, t) => `${pc(v)} Chance: Ein Blitz springt auf ${RUNES.bolt.jumps[t]} Gegner daneben (50 % Schaden).` },
  echo: { name: 'Echorune', col: '#c9a8ff', fits: ['burst'], val: [.1, .18, .27, .4], glyph: 'M4.5 5 9.5 10l-5 5M10.5 5l5 5-5 5', desc: v => `${pc(v)} Chance: Die Fähigkeit wirkt 0,5 s später noch einmal mit halber Kraft.` },
  haste: { name: 'Eilrune', col: '#7fe0c8', fits: ['all'], val: [.06, .12, .2, .3], glyph: 'M7 17V3l6 3.5L7 10l6 7', desc: v => `−${pc(v)} Abklingzeit bzw. Kill- oder Schrott-Bedarf.` },
  might: { name: 'Wuchtrune', col: '#ff5d55', fits: ['all'], val: [.08, .15, .25, .4], glyph: 'M10 17V3M5 8l5-5 5 5', desc: v => `+${pc(v)} Kraft (Schaden, Heilung, Schild).` },
  wide: { name: 'Weiterune', col: '#e6c46a', fits: ['all'], val: [.08, .15, .25, .4], glyph: 'M4 4v12L16 4v12L4 4', desc: v => `+${pc(v)} Fläche und Dauer.` },
  blood: { name: 'Blutrune', col: '#ff3b5c', fits: DMG, val: [.003, .006, .01, .015], glyph: 'M7 3v14M7 3l6 3.5L7 10l6 3.5L7 17', desc: v => `Jeder Kill heilt ${pc(v, 1)} deines Lebens (höchstens 3 % pro Sekunde).` },
  greed: { name: 'Gierrune', col: '#ffd84a', fits: DMG, val: [.04, .07, .11, .16], glyph: 'M7 17V3M7 6.5 14 3M7 11.5 14 8', desc: v => `${pc(v)} Chance je Kill auf eine Münze.` },
  soul: { name: 'Seelenrune', col: '#6fb7ff', fits: DMG, val: [.01, .015, .025, .04], glyph: 'M10 3v14M10 3l4.5 3.5M10 17l-4.5-3.5', desc: v => `Jeder Kill lädt die andere Fähigkeit um ${pc(v, 1)}.` },
  luck: { name: 'Glücksrune', col: '#7dff9a', fits: DMG, val: [.05, .1, .15, .25], glyph: 'M5 4l10 12M15 4 5 16', desc: v => `+${pc(v)} Chance auf kritische Treffer (doppelter Schaden).` },
};
export const RUNE_IDS = Object.keys(RUNES);
export const RUNE_TIERS = 4;
export const SOCKET_LV = [10, 20, 25];      // Fähigkeits-Level für Sockel 1, 2 und 3 (der dritte nur mit dem Seelenbaum-Knoten, Phase 12)
export const FUSE_N = 3;                    // so viele gleiche ergeben eine der nächsten Stufe
const pc = (v, d = 0) => `${(v * 100).toFixed(d).replace('.', ',')}\u00a0%`;   // geschütztes Leerzeichen: „15 %“ bricht nicht um

// Welche Fähigkeit welche Art hat (Runen-Regeln). Ohne Eintrag: keine Schadens-Runen
// hit: macht selbst Schaden · summon: Helfer machen Schaden · burst: Echo möglich
// (nicht bei Wut und Zeitbombe: ein zweiter Einsatz setzt Raserei bzw. den gesammelten Schaden zurück)
export const ABIL_TAGS = {
  rage: ['hit'], trap: ['hit', 'burst'], mech: ['hit'], smoke: [], catapult: ['hit', 'burst'], hook: ['hit'],
  shroom: [], shield: [], rats: ['summon', 'burst'], call: ['summon', 'burst'], totem: [], timebomb: ['hit'],
  bigbang: ['hit', 'burst'], charm: [], oilcask: ['hit', 'burst'], burrow: ['hit'], cannon: ['hit'], decoy: ['summon'],
  turret: ['summon'], spin: ['hit'], grudge: ['hit', 'burst'], scrapmag: ['hit', 'burst'], bees: ['summon', 'burst'], brew: [],
};
// Passt die Rune auf die Fähigkeit? Eile nicht aufs Amulett (lädt nicht)
export function runeFits(rune, abil) {
  const R = RUNES[rune], A = ABILITIES[abil];
  if (!R || !A) return false;
  if (rune === 'haste' && A.charge === 'once') return false;
  if (rune === 'echo' && A.charge === 'once') return false;
  return R.fits.some(f => f === 'all' || (ABIL_TAGS[abil] || []).includes(f));
}
export const runeKey = (id, t) => `${id}.${t}`;
export function parseRune(key) {
  if (typeof key !== 'string') return null;
  const [id, t] = key.split('.'), tier = +t;
  return RUNES[id] && Number.isInteger(tier) && tier >= 0 && tier < RUNE_TIERS && key === runeKey(id, tier) ? { id, tier } : null;
}
export const runeVal = (id, t) => RUNES[id].val[t];
export const runeName = key => { const r = parseRune(key); return r ? RUNES[r.id].name : ''; };
export const runeDesc = key => { const r = parseRune(key); return r ? RUNES[r.id].desc(runeVal(r.id, r.tier), r.tier) : ''; };
export const tierInfo = t => RARITY[RARITIES[t]];

// Runen aus Truhen (PLAN Phase 10): [Chance, von, bis], Stufen-Gewichte in %
export const CHEST_RUNES = {
  wood: { n: [.25, 1, 1], odds: [90, 10, 0, 0] },
  iron: { n: [1, 1, 2], odds: [70, 25, 5, 0] },
  gold: { n: [1, 2, 3], odds: [50, 35, 13, 2] },
  mage: { n: [1, 4, 6], odds: [25, 40, 27, 8] },
};
// Runenkiste im Laden: 3 Runen, mindestens eine seltene
export const RUNE_BAG = { name: 'Runenkiste', price: { gems: 50 }, n: 3, odds: [55, 35, 9, 1], color: '#6b5a48', metal: '#c9b48a' };
