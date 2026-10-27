// ---------- Zähler, Erfolge, Titel, Tagesaufgaben (PLAN 9.8) ----------
// Im Lauf zählt count() in run.cnt; am Laufende kommt alles in save.stats.c (mergeRun).
// Erfolge und Tagesaufgaben lesen nur Zähler, deshalb lassen sie sich leicht erweitern.
import { hashSeed, mulberry32 } from '../core/rng.js';
import { ACH, ACHIEVEMENTS, DAILY_BONUS, DAILY_POOL, TIERS } from '../data/achievements.js';
import { ABILITIES, STAR_MAX } from '../data/abilities.js';
import { CLASSES, CLASS_MAX_LV } from '../data/classes.js';
import { dayKey } from './shop.js';
import { grantCosmetic } from './cosmetics.js';

export function count(run, key, n = 1) { if (run && run.cnt && key) run.cnt[key] = (run.cnt[key] || 0) + n; }
export function countMeta(save, key, n = 1) { ensureDaily(save); save.stats.c[key] = (save.stats.c[key] || 0) + n; }

// Laufende in den Spielstand: Zähler, Gold, geschaffte Level, Siege je Waffe, längste Endlose Nacht.
// Der Tagesbeginn der Aufgaben muss vorher feststehen (endRun ruft ensureDaily, bevor es Statistiken ändert).
export function mergeRun(save, run, win) {
  const c = save.stats.c, add = (k, n) => { if (n) c[k] = (c[k] || 0) + n; };
  for (const [k, n] of Object.entries(run.cnt)) add(k, n);
  add('gold', run.gold);
  if (win && !run.st.endless) { add('levels', 1); for (const w of run.weapons) add('w.' + w.id, 1); }
  if (run.st.endless) c.endless = Math.max(c.endless || 0, Math.floor(run.time));
}
// Zählerwert für Tagesaufgaben (Kills stehen seit jeher in stats.kills; „elites“ zählt Mini-Bosse mit)
const val = (save, key) => key === 'kills' ? save.stats.kills : key === 'elites' ? (save.stats.c.elites || 0) + (save.stats.c.minis || 0) : (save.stats.c[key] || 0);

// ---------- Erfolge ----------
export function achState(save, a) {
  const v = a.v(save), tier = a.goals.filter(g => v >= g).length, claimed = save.ach[a.id] || 0;
  return { v, tier, claimed, next: a.goals[Math.min(tier, 2)], can: tier > claimed };
}
export const claimableCount = save => ACHIEVEMENTS.filter(a => achState(save, a).can).length;
// Belohnung aller erreichten, noch nicht abgeholten Stufen; bei Gold ggf. Kosmetik. Gibt { gems, cosm } zurück
export function claimAch(save, id) {
  const a = ACH[id], st = achState(save, a);
  if (!st.can) return null;
  let gems = 0;
  for (let t = st.claimed; t < st.tier; t++) gems += TIERS[t].gems;
  save.ach[id] = st.tier; save.wallet.gems += gems;
  const cosm = st.tier >= 3 && a.cosm && grantCosmetic(save, a.cosm) ? a.cosm : null;
  return { gems, cosm };
}
// Titel gibt es mit der abgeholten Gold-Stufe
// dazu „Legende der …“ für jede Fähigkeit mit 5 Sternen (Phase 10) und die Meister-Titel der Klassen (Phase 9)
export const titles = save => [...ACHIEVEMENTS.filter(a => a.title && (save.ach[a.id] || 0) >= 3).map(a => a.title),
  ...Object.entries(save.abilities).filter(([id, a]) => ABILITIES[id] && (a.st || 0) >= STAR_MAX).map(([id]) => 'Legende der ' + ABILITIES[id].name),
  // Klassen-Level 20 (Phase 9): Meister-Titel der Klasse
  ...Object.entries(save.classes || {}).filter(([id, c]) => CLASSES[id] && c.lv >= CLASS_MAX_LV).map(([id]) => CLASSES[id].master)];

// ---------- Tagesaufgaben ----------
// Drei Aufgaben je Tag (gleich für alle, Seed = Datum). Der Tagesbeginn (Zählerstand) wird nur an festen Stellen
// genommen: Laufstart, Laufende (vor dem Verbuchen), Karte aufwerten, Abholen. Anzeigen ändern nichts.
export function ensureDaily(save, day = dayKey()) {
  const d = save.daily;
  if (d.day === day) return d;
  const base = {};
  for (const t of DAILY_POOL) base[t.key] = val(save, t.key);
  save.daily = { day, base, claimed: [false, false, false], bonus: false };
  return save.daily;
}
export function dailyTasks(save, day = dayKey()) {
  // Noch kein Eintrag für heute: alles bei null (ohne den Spielstand zu ändern)
  const d = save.daily.day === day ? save.daily : { base: null, claimed: [false, false, false], bonus: false }, r = mulberry32(hashSeed('goblin-aufgaben-' + day)), pool = DAILY_POOL.slice();
  return [0, 1, 2].map(i => {
    const t = pool.splice((r() * pool.length) | 0, 1)[0], n = t.n[(r() * t.n.length) | 0];
    const prog = d.base ? Math.max(0, val(save, t.key) - (d.base[t.key] || 0)) : 0;
    return { ...t, n, text: typeof t.desc === 'function' ? t.desc(n) : t.desc.replace('{n}', n), prog: Math.min(n, prog), done: prog >= n, claimed: d.claimed[i] };
  });
}
// Belohnung abholen; gibt die Belohnung zurück ({ gold } | { gems } | { chest }), Gold/Juwelen sind schon gutgeschrieben
export function claimDaily(save, i, day = dayKey()) {
  ensureDaily(save, day);
  const t = dailyTasks(save, day)[i];
  if (!t || !t.done || t.claimed) return null;
  save.daily.claimed[i] = true;
  if (t.reward.gold) save.wallet.gold += t.reward.gold;
  if (t.reward.gems) save.wallet.gems += t.reward.gems;
  return t.reward;
}
export function claimDailyBonus(save, day = dayKey()) {
  const d = ensureDaily(save, day);
  if (d.bonus || !d.claimed.every(Boolean)) return null;
  d.bonus = true; save.wallet.gems += DAILY_BONUS.gems;
  return DAILY_BONUS;
}
export const dailyOpen = (save, day = dayKey()) => { const t = dailyTasks(save, day); return t.some(x => x.done && !x.claimed) || (t.every(x => x.claimed) && save.daily.day === day && !save.daily.bonus); };
