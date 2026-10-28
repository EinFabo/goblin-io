// ---------- Wochenaufgaben, Aufgaben-Pass, Kopfgeld-Brett, Fähigkeiten-Quests (Phase 11) ----------
// Reine Funktionen über dem Spielstand (wie progress.js), keine Spiellogik im Lauf: Zähler kommen über count()/mergeRun.
// Woche und Saison hängen am lokalen Kalendertag (dayKey), damit sie zum Tageswechsel der Tagesaufgaben passen.
import { hashSeed, mulberry32, newSeed } from '../core/rng.js';
import { ABILITIES, ABILITY_IDS, abilityUnlocked } from '../data/abilities.js';
import { CLASSES, CLASS_IDS, classUnlocked } from '../data/classes.js';
import { AQ_GOALS, AQ_GOAL_OF, AQ_TIERS, BOUNTY_COND, BOUNTY_N, BOUNTY_REWARD, BOUNTY_SKULL, PASS_BONUS, PASS_BONUS_STEP, PASS_PTS, PASS_STAGES, PASS_STEP, PASS_TITLE, QUEST_EPOCH,
  SEASON_WEEKS, WEEKLY_BONUS, WEEKLY_N, WEEKLY_POOL, aqKey, aqText, bountyTime, challengeReward, passReward } from '../data/quests.js';
import { RUNE_IDS, runeFits, runeKey } from '../data/runes.js';
import { SCHOOL_NAME } from '../data/achievements.js';
import { STAGES } from '../data/stages.js';
import { AFFIXES } from '../data/affixes.js';
import { MUTATORS, MUT_IDS } from '../data/mutators.js';
import { LEVELS } from '../data/levels.js';
import { addToShelf, grantChest, rollChest } from './chests.js';
import { grantCosmetic } from './cosmetics.js';
import { addRunes, rollRuneBag } from './runes.js';
import { dayKey } from './shop.js';
import { pityMul } from './souls.js';
import { val } from './progress.js';

// ---------- Kalender ----------
const dayNum = day => { const [y, m, d] = day.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 864e5); };
// Woche (Montag bis Sonntag) und Saison (4 Wochen) seit QUEST_EPOCH
export const weekOf = (day = dayKey()) => Math.floor((dayNum(day) - dayNum(QUEST_EPOCH)) / 7);
export const seasonOf = (day = dayKey()) => Math.floor(weekOf(day) / SEASON_WEEKS);
// Tage bis zum Ende der Woche bzw. Saison (1 = heute ist der letzte Tag)
export const daysLeftWeek = (day = dayKey()) => 7 - (((dayNum(day) - dayNum(QUEST_EPOCH)) % 7) + 7) % 7;
export const daysLeftSeason = (day = dayKey()) => SEASON_WEEKS * 7 - (((dayNum(day) - dayNum(QUEST_EPOCH)) % (SEASON_WEEKS * 7)) + SEASON_WEEKS * 7) % (SEASON_WEEKS * 7);

// ---------- Belohnungen ----------
// Alles wird hier gutgeschrieben: Gold, Juwelen, Runenkiste, Kosmetik, Titel; Truhen mit shelf ins Regal (ist es voll, gehen sie
// gleich auf), sonst gleich geöffnet. Gibt zurück, was dabei herauskam (runes: Schlüssel, cosmNew, chestRes: geöffnete Truhe für die Animation)
export function giveReward(save, r, { shelf = false } = {}) {
  const out = { ...r }, rng = mulberry32(newSeed());
  if (r.gold) save.wallet.gold += r.gold;
  if (r.gems) save.wallet.gems += r.gems;
  if (r.runes) { out.runes = r.runes === true ? rollRuneBag(rng) : r.runes; addRunes(save, out.runes); }
  if (r.cosm) out.cosmNew = grantCosmetic(save, r.cosm);
  if (r.title) save.pass.champ = true;
  if (r.chest && !(shelf && addToShelf(save, r.chest))) { out.chestRes = rollChest(r.chest, rng, save.pity, pityMul(save)); grantChest(save, out.chestRes); }
  return out;
}

// ---------- Aufgaben-Pass ----------
// Neue Saison: was in der alten erreicht, aber nicht abgeholt war, wird nachgeliefert (Truhen ins Regal), dann beginnt alles neu
export function ensurePass(save, day = dayKey()) {
  const s = seasonOf(day), p = save.pass;
  if (p.season === s) return p;
  if (p.season >= 0) {
    for (let i = 1; i <= passStage(p.pts); i++) if (!p.claimed.includes(i)) giveReward(save, passReward(i, p.season), { shelf: true });
    for (let n = passBonusReady(p); n > 0; n--) giveReward(save, PASS_BONUS, { shelf: true });
  }
  save.pass = { season: s, pts: 0, claimed: [], bonus: 0, champ: !!save.pass.champ };
  return save.pass;
}
export function addPassPts(save, n, day = dayKey()) { ensurePass(save, day).pts += n; }
export const passStage = pts => Math.min(PASS_STAGES, Math.floor(pts / PASS_STEP));
// Bonustruhen nach Stufe 30: alle 150 Punkte eine
export const passBonusReady = p => Math.max(0, Math.floor((p.pts - PASS_STAGES * PASS_STEP) / PASS_BONUS_STEP)) - p.bonus;
export function passList(save, day = dayKey()) {
  const p = save.pass.season === seasonOf(day) ? save.pass : { season: seasonOf(day), pts: 0, claimed: [], bonus: 0 };
  return Array.from({ length: PASS_STAGES }, (_, i) => ({ s: i + 1, reward: passReward(i + 1, p.season), reached: p.pts >= (i + 1) * PASS_STEP, claimed: p.claimed.includes(i + 1) }));
}
export const passOpen = (save, day = dayKey()) => passList(save, day).some(x => x.reached && !x.claimed) || (save.pass.season === seasonOf(day) && passBonusReady(save.pass) > 0);
export function claimPass(save, s, day = dayKey()) {
  const p = ensurePass(save, day);
  if (s === 'bonus') { if (passBonusReady(p) <= 0) return null; p.bonus++; return giveReward(save, PASS_BONUS); }
  if (!(s >= 1 && s <= PASS_STAGES) || p.pts < s * PASS_STEP || p.claimed.includes(s)) return null;
  p.claimed.push(s);
  return giveReward(save, passReward(s, p.season));
}
export const passTitles = save => (save.pass && save.pass.champ ? [PASS_TITLE] : []);

// ---------- Wochenaufgaben ----------
// Beim ersten Kontakt der Woche: Aufgaben festlegen (nur, was schon geht) und Zählerstand merken
export function ensureWeekly(save, day = dayKey()) {
  const wk = weekOf(day), w = save.weekly;
  if (w.wk === wk && w.tasks.length) return w;
  const r = mulberry32(hashSeed('goblin-woche-' + wk)), pool = WEEKLY_POOL.filter(t => !t.need || t.need(save)), tasks = [];
  for (let i = 0; i < WEEKLY_N && pool.length; i++) { const t = pool.splice((r() * pool.length) | 0, 1)[0]; tasks.push({ id: t.id, n: t.n[(r() * t.n.length) | 0] }); }
  const base = {}; for (const t of WEEKLY_POOL) base[t.key] = val(save, t.key);
  save.weekly = { wk, base, tasks, claimed: tasks.map(() => false), bonus: false };
  return save.weekly;
}
export function weeklyTasks(save, day = dayKey()) {
  const w = save.weekly.wk === weekOf(day) && save.weekly.tasks.length ? save.weekly : null;
  if (!w) return [];
  return w.tasks.map((x, i) => {
    const t = WEEKLY_POOL.find(p => p.id === x.id); if (!t) return null;
    const prog = Math.max(0, val(save, t.key) - (w.base[t.key] || 0));
    return { ...t, n: x.n, text: t.desc.replace('{n}', x.n.toLocaleString('de-DE')), prog: Math.min(x.n, prog), done: prog >= x.n, claimed: w.claimed[i] };
  }).filter(Boolean);
}
export function claimWeekly(save, i, day = dayKey()) {
  ensureWeekly(save, day);
  const t = weeklyTasks(save, day)[i];
  if (!t || !t.done || t.claimed) return null;
  save.weekly.claimed[i] = true; addPassPts(save, PASS_PTS.weekly, day);
  return giveReward(save, t.reward);
}
export function claimWeeklyBonus(save, day = dayKey()) {
  const w = ensureWeekly(save, day);
  if (w.bonus || !w.claimed.length || !w.claimed.every(Boolean)) return null;
  w.bonus = true;
  return giveReward(save, WEEKLY_BONUS);
}
export const weeklyOpen = (save, day = dayKey()) => { const t = weeklyTasks(save, day); return t.some(x => x.done && !x.claimed) || (t.length > 0 && t.every(x => x.claimed) && !save.weekly.bonus); };

// ---------- Kopfgeld-Brett ----------
export const bountyOpen = save => !!(save.stages[1] && save.stages[1].cleared);   // ab Welt 2
const openWorlds = save => STAGES.map((st, i) => i).filter(i => !STAGES[i].endless && (i === 0 || (save.stages[i] && save.stages[i].cleared)));
// Drei Steckbriefe je Tag: Seed = Datum, aber nur Ziele aus freien Welten (deshalb beim ersten Ansehen des Tages festgelegt)
export function ensureBounty(save, day = dayKey()) {
  if (save.bounty.day === day && save.bounty.list.length) return save.bounty;
  if (!bountyOpen(save)) return save.bounty;
  const r = mulberry32(hashSeed('goblin-kopfgeld-' + day)), pick = a => a[(r() * a.length) | 0];
  const worlds = openWorlds(save), schools = [...new Set(worlds.flatMap(si => schoolsOf(si)))];
  const cleared = i => !!(save.stages[i + 1] && save.stages[i + 1].cleared);
  const abil = ABILITY_IDS.filter(id => save.keep.includes(id) || abilityUnlocked(id, save.profile.level, cleared));
  const cls = CLASS_IDS.filter(id => id !== 'gob' && (save.clsKeep.includes(id) || classUnlocked(id, cleared)));
  const list = [];
  for (let i = 0; i < BOUNTY_N; i++) {
    const kinds = ['boss', 'level', 'school', ...(worlds.length >= 3 ? ['affix'] : [])], t = pick(kinds), b = { t };
    if (t === 'boss' || t === 'level') b.si = pick(worlds);
    if (t === 'school') { b.school = pick(schools); b.n = pick([40, 60, 80]); }
    if (t === 'affix') { b.affix = pick(Object.keys(AFFIXES)); b.n = pick([1, 2]); }
    const conds = ['abil', 'noheal', ...(t === 'boss' ? ['nohit', 'time'] : []), ...(b.si !== undefined && save.stages[b.si + 1] && save.stages[b.si + 1].cleared ? ['nm'] : []), ...(cls.length ? ['cls'] : []), ...(b.si !== undefined ? ['mut', 'mut'] : [])];
    b.c = r() < .25 ? null : pick(conds);
    if (b.c === 'mut') b.mut = pick(MUT_IDS);   // Mutator: der Steckbrief startet das Level selbst („Los!“)
    if (b.c === 'abil') b.abil = pick(abil);
    if (b.c === 'cls') b.cls = pick(cls);
    if (b.c === 'time') b.T = bountyTime(b.si);
    b.sk = Math.max(1, Math.min(3, BOUNTY_SKULL[t] + (b.c ? BOUNTY_COND[b.c] : 0)));
    list.push(b);
  }
  save.bounty = { day, list, done: list.map(() => false) };
  return save.bounty;
}
// Magierschulen, die in einer Welt vorkommen (aus den Typ-Namen des Wellen-Skripts, z. B. fire_mage → fire)
function schoolsOf(si) {
  const out = new Set();
  for (const w of STAGES[si].waves) for (const t of [...Object.keys(w.mix || {}), w.type, w.extra]) if (t) { const k = t.split('_')[0]; if (SCHOOL_NAME[k]) out.add(k); }
  return [...out];
}
const fmtT = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function bountyText(b) {
  const goal = b.t === 'boss' ? `Besiege ${STAGES[b.si].boss.name} (Welt ${b.si + 1})` : b.t === 'level' ? `Schaffe ein Level in Welt ${b.si + 1}`
    : b.t === 'school' ? `Besiege in einem Lauf ${b.n} ${SCHOOL_NAME[b.school]}magier` : `Besiege in einem Lauf ${b.n} Elite-Magier mit „${AFFIXES[b.affix].name}“`;
  const cond = !b.c ? '' : b.c === 'nohit' ? 'ohne Treffer im Bosskampf' : b.c === 'time' ? `in unter ${fmtT(b.T)}` : b.c === 'abil' ? `mit ${ABILITIES[b.abil].name} ausgerüstet`
    : b.c === 'nm' ? 'im Albtraum' : b.c === 'noheal' ? 'ohne Heilung' : b.c === 'mut' ? `mit Mutator „${MUTATORS[b.mut].name}“` : `als ${CLASSES[b.cls].name}`;
  return { goal, cond };
}
export const bountyReward = b => BOUNTY_REWARD[b.sk - 1];
// Erfüllt ein Lauf den Steckbrief? R: Ergebnis des Laufs (aus endRun, siehe runFacts). Weitermachen zählt nie.
export function bountyMet(b, R) {
  if (R.cont) return false;
  let ok;
  if (b.t === 'boss') ok = R.win && R.boss && R.si === b.si;
  else if (b.t === 'level') ok = R.win && !R.endless && R.si === b.si;
  else if (b.t === 'school') ok = (R.cnt['k.' + b.school] || 0) >= b.n;
  else ok = (R.cnt['af.' + b.affix] || 0) >= b.n;
  if (!ok || !b.c) return ok;
  return b.c === 'nohit' ? R.bossHits === 0 : b.c === 'time' ? R.time < b.T : b.c === 'abil' ? R.abil.includes(b.abil)
    : b.c === 'nm' ? R.nm > 0 : b.c === 'noheal' ? R.healed < 1 : b.c === 'mut' ? (R.mut || []).includes(b.mut) : R.cls === b.cls;
}
// Am Laufende (endRun): offene Steckbriefe von heute prüfen, Belohnung gleich gutschreiben (Truhen ins Regal)
export function checkBounties(save, R, day = dayKey()) {
  const B = ensureBounty(save, day), got = [];
  B.list.forEach((b, i) => {
    if (B.done[i] || !bountyMet(b, R)) return;
    B.done[i] = true; addPassPts(save, PASS_PTS.bounty, day);
    got.push({ b, reward: giveReward(save, bountyReward(b), { shelf: true }) });
  });
  return got;
}

// Steckbrief mit Mutator: welches Level „Los!“ startet (Boss-Level bzw. das erste der Welt)
// save: nur wenn das Level (noch) frei ist – sonst ließe sich über den Steckbrief ein gesperrter Boss spielen
export const bountyStart = (b, save) => {
  if (b.c !== 'mut' || b.si === undefined) return null;
  const li = b.t === 'boss' ? LEVELS - 1 : 0;
  return !save || levelOpen(save, b.si, li) ? { si: b.si, li, mut: [b.mut] } : null;
};

// ---------- Tägliche Herausforderung (Phase 12) ----------
// Beim ersten Ansehen des Tages festgelegt (nur freie Level, nur freie Fähigkeiten); Seed = Datum
const levelOpen = (save, si, li) => (si === 0 || !!(save.stages[si] && save.stages[si].cleared)) && (li === 0 || !!(save.stages[si + 1] && save.stages[si + 1].lv && save.stages[si + 1].lv[li - 1] && save.stages[si + 1].lv[li - 1].hats > 0));
export function ensureChallenge(save, day = dayKey()) {
  if (save.challenge.day === day && save.challenge.def && levelOpen(save, save.challenge.def.si, save.challenge.def.li)) return save.challenge;
  // nach einer Wiedergeburt kann das Level wieder gesperrt sein: neu festlegen (Bestwert und Abholen bleiben für heute)
  const keep = save.challenge.day === day ? { best: save.challenge.best, done: save.challenge.done } : { best: 0, done: false };
  const r = mulberry32(hashSeed('goblin-challenge-' + day)), pick = a => a.splice((r() * a.length) | 0, 1)[0];
  const lvls = []; STAGES.forEach((st, si) => { if (!st.endless) for (let li = 0; li < LEVELS; li++) if (levelOpen(save, si, li)) lvls.push([si, li]); });
  const cleared = i => !!(save.stages[i + 1] && save.stages[i + 1].cleared);
  const abil = ABILITY_IDS.filter(id => save.keep.includes(id) || abilityUnlocked(id, save.profile.level, cleared)), muts = [...MUT_IDS];
  const [si, li] = pick(lvls);
  const def = { si, li, abil: [pick(abil), pick(abil)], mut: r() < .5 ? [pick(muts)] : [pick(muts), pick(muts)] };
  save.challenge = { day, def, ...keep };
  return save.challenge;
}
// Bestwert: Boss-Level die Zeit (kleiner ist besser), sonst die Kills
export const challengeIsBoss = def => def.li === LEVELS - 1;
// Am Laufende (endRun, nur Läufe der Herausforderung von heute): Bestwert, erster Sieg gibt die Belohnung
export function finishChallenge(save, R, day = dayKey()) {
  const C = save.challenge;
  if (R.mode !== 'challenge' || C.day !== day || !C.def || R.day !== day || !R.win || R.cont) return null;
  // „Nochmal“ nach Mitternacht spielt die alte Herausforderung: zählt nur, wenn Level, Mutatoren und Fähigkeiten zur heutigen passen
  const d = C.def; if (R.si !== d.si || R.li !== d.li || (R.mut || []).join() !== d.mut.join() || (R.abil || []).join() !== d.abil.join()) return null;
  const v = challengeIsBoss(C.def) ? Math.floor(R.time) : R.kills, better = !C.best || (challengeIsBoss(C.def) ? v < C.best : v > C.best);
  if (better) C.best = v;
  let reward = null;
  if (!C.done) { C.done = true; addPassPts(save, PASS_PTS.challenge, day); reward = giveReward(save, challengeReward(C.def.si)); }
  return { v, better, reward, boss: challengeIsBoss(C.def) };
}

// ---------- Fähigkeiten-Quests ----------
// Stand einer Fähigkeit: Zähler, erreichte und abgeholte Stufe, nächstes Ziel
export function aqState(save, id) {
  const key = aqKey(id), goals = AQ_GOAL_OF[id] || AQ_GOALS[key], v = save.stats.c['ab.' + id + '.' + key] || 0, tier = goals.filter(g => v >= g).length, claimed = save.aq[id] || 0;
  return { key, v, tier, claimed, goal: goals[Math.min(claimed, 2)], text: aqText(ABILITIES[id].name, key, goals[Math.min(claimed, 2)]), can: tier > claimed };
}
// Passende Rune der Stufe t für die Fähigkeit (Seed: Fähigkeit + Stufe, damit es nicht vom Zufall beim Abholen abhängt)
function aqRune(id, t) {
  const fit = RUNE_IDS.filter(k => runeFits(k, id)), r = mulberry32(hashSeed('goblin-aq-' + id + '-' + t));
  return fit.length ? runeKey(fit[(r() * fit.length) | 0], t) : null;
}
// Belohnung der nächsten erreichten Stufe abholen (eine Stufe je Klick): Bronze seltene Rune, Silber Runenkiste, Gold legendäre Rune + Titel
export function claimAq(save, id) {
  const st = aqState(save, id); if (!st.can) return null;
  const tier = st.claimed;   // 0 Bronze, 1 Silber, 2 Gold
  save.aq[id] = tier + 1; addPassPts(save, PASS_PTS.aq);
  const rune = tier === 0 ? aqRune(id, 1) : tier === 2 ? aqRune(id, 3) : null;
  const out = giveReward(save, { runes: tier === 1 ? true : rune ? [rune] : [] });
  return { ...out, tier, name: AQ_TIERS[tier].name };
}
export const aqTitles = save => ABILITY_IDS.filter(id => (save.aq[id] || 0) >= 3).map(id => 'Meister der ' + ABILITIES[id].name);
// Rahmenfarbe am Fähigkeiten-Icon: Silber ab Stufe 2, Gold ab Stufe 3 (abgeholt)
export const aqFrame = (save, id) => ((save.aq && save.aq[id]) >= 3 ? AQ_TIERS[2].col : (save.aq && save.aq[id]) >= 2 ? AQ_TIERS[1].col : '');

