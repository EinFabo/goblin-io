// Spielstand v2 mit Versionsnummer und Migration.
// Kaputte oder unvollständige Stände werden repariert statt zu crashen.
// Stages sind im Save 1-basiert ("1" = Goblinwiese), im Code 0-basiert.
import { ABILITIES, ABIL_MAX_LV, DEFAULT_LOADOUT, TREE, abilXpNeed, spentPoints } from '../data/abilities.js';
import { accountXpNeed } from '../game/balance.js';
import { OLD_COST, TALENT, oldShopCost } from '../data/talents.js';

export const SAVE_KEY = 'goblinio_save_v2';
export const SAVE_KEY_V1 = 'goblinio_save_v1';
export const VERSION = 3;

const today = () => new Date().toISOString().slice(0, 10);

export function defaults() {
  return {
    version: VERSION,
    profile: { name: 'Goblin', level: 1, xp: 0, title: '', created: today() },
    wallet: { gold: 0, gems: 0 },
    // Talente (data/talents.js); bis v2 waren das die Werkstatt-Stufen
    talents: {},
    stages: {},
    stats: { runs: 0, wins: 0, kills: 0, playSeconds: 0 },
    // Fähigkeiten in Slot 1 und 2 (Slot 2 ab Konto-Level 3)
    loadout: [...DEFAULT_LOADOUT],
    // Fähigkeiten-Level und Skill Tree: { id: { lv, xp, pts: { pow, cd, area, a, b } } }
    abilities: {},
    settings: { mute: false, musicOff: false, shake: true, numbers: true, lefty: false },
  };
}

const num = (v, d = 0, min = 0, max = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// v1: { gold, unlocked, cleared: {0: true}, best: {0: 251}, shop: {atk: 3}, mute, musicOff }
export function migrateV1(v1) {
  v1 = obj(v1);
  const s = { ...defaults(), version: 2 };
  s.wallet.gold = num(v1.gold);
  const cleared = obj(v1.cleared), best = obj(v1.best);
  const idx = new Set([...Object.keys(cleared), ...Object.keys(best)].map(Number).filter(i => Number.isInteger(i) && i >= 0));
  for (const i of idx) s.stages[i + 1] = { cleared: !!cleared[i], stars: 0, best: num(best[i]), nightmare: false };
  // "unlocked" ergibt sich in v2 aus cleared. Freigeschaltete, aber nie geschaffte
  // Stages (in v1 nicht möglich) gehen so nicht verloren:
  const unlocked = num(v1.unlocked, 1, 1);
  for (let k = 1; k < unlocked; k++) {
    if (!s.stages[k]) s.stages[k] = { cleared: true, stars: 0, best: 0, nightmare: false };
    else s.stages[k].cleared = true;
  }
  for (const [k, v] of Object.entries(obj(v1.shop))) s.talents[k] = num(v, 0, 0, 99) | 0;
  s.settings.mute = bool(v1.mute, false);
  s.settings.musicOff = bool(v1.musicOff, false);
  return s;
}

export function normalize(raw) {
  const d = defaults(), r = obj(raw);
  const p = obj(r.profile), w = obj(r.wallet), st = obj(r.stats), se = obj(r.settings);
  const out = {
    version: VERSION,
    profile: {
      name: typeof p.name === 'string' && p.name.trim() ? p.name.slice(0, 16) : d.profile.name,
      level: num(p.level, 1, 1, 50) | 0, xp: num(p.xp), title: typeof p.title === 'string' ? p.title : '',
      created: typeof p.created === 'string' ? p.created : d.profile.created,
    },
    wallet: { gold: Math.floor(num(w.gold)), gems: Math.floor(num(w.gems)) },
    talents: {},
    stages: {},
    stats: { runs: num(st.runs) | 0, wins: num(st.wins) | 0, kills: num(st.kills) | 0, playSeconds: num(st.playSeconds) },
    loadout: normLoadout(r.loadout),
    abilities: normAbilities(r.abilities),
    settings: {
      mute: bool(se.mute, false), musicOff: bool(se.musicOff, false), shake: bool(se.shake, true),
      numbers: bool(se.numbers, true), lefty: bool(se.lefty, false),
    },
  };
  for (const [k, v] of Object.entries(obj(r.talents))) if (TALENT[k]) out.talents[k] = num(v, 0, 0, TALENT[k].max) | 0;
  for (const [k, v] of Object.entries(obj(r.stages))) {
    if (!/^\d+$/.test(k) || +k < 1) continue;
    const s = obj(v);
    out.stages[+k] = { cleared: bool(s.cleared, false), stars: num(s.stars, 0, 0, 3) | 0, best: num(s.best), nightmare: bool(s.nightmare, false) };
  }
  return out;
}

function normLoadout(v) {
  const a = Array.isArray(v) ? v.slice(0, 2).map(x => (ABILITIES[x] ? x : null)) : [...DEFAULT_LOADOUT];
  while (a.length < 2) a.push(null);
  if (a[0] && a[0] === a[1]) a[1] = null;
  return a;
}

function normAbilities(v) {
  const out = {};
  for (const [id, a] of Object.entries(obj(v))) {
    if (!ABILITIES[id]) continue;
    const o = obj(a), pt = obj(o.pts), st = { lv: num(o.lv, 1, 1, ABIL_MAX_LV) | 0, xp: num(o.xp), pts: {} };
    for (const k of Object.keys(TREE)) { const n = num(pt[k], 0, 0, TREE[k].max) | 0; if (n) st.pts[k] = n; }
    if (spentPoints(st.pts) > st.lv - 1) st.pts = {};   // mehr ausgegeben als möglich → zurücksetzen statt kaputt
    out[id] = st;
  }
  return out;
}

// v2 → v3: Werkstatt wird zu Talenten. Talente sind halb so stark → Stufen ×2.
// "Kurze Zündschnur" und "Goblin-Ingenieur" gibt es nicht mehr (macht jetzt der Skill Tree): Gold zurück.
const DOUBLE = ['atk', 'hp', 'spd', 'mag', 'stam', 'xp'];
export function migrateV2(v2) {
  const r = { ...obj(v2) }, t = obj(r.talents), out = {}, w = { ...obj(r.wallet) };
  let refund = 0;
  for (const [k, v] of Object.entries(t)) {
    const n = num(v, 0, 0, 99) | 0;
    if (DOUBLE.includes(k)) out[k] = n * 2;
    else if (OLD_COST[k]) for (let i = 0; i < n; i++) refund += oldShopCost(OLD_COST[k], i);
    else out[k] = n;
  }
  w.gold = num(w.gold) + refund;
  return { ...r, version: 3, talents: out, wallet: w };
}

// Beliebigen Rohstand auf die aktuelle Version bringen
export function migrate(raw) {
  let r = obj(raw);
  if (!r.version) r = migrateV1(r);
  if (r.version < 3) r = migrateV2(r);
  return normalize(r);
}

export let save = defaults();

function readJson(key) {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { return undefined; }
}

export function loadSave() {
  const v2 = readJson(SAVE_KEY);
  if (v2 && typeof v2 === 'object') { save = migrate(v2); persist(); }
  else {
    if (v2 === undefined) { try { localStorage.setItem(SAVE_KEY + '_broken', localStorage.getItem(SAVE_KEY)); } catch (e) {} }
    const v1 = readJson(SAVE_KEY_V1);
    save = v1 && typeof v1 === 'object' ? migrate(v1) : defaults();
    persist();
  }
  return save;
}
export function setSave(s) { save = normalize(s); persist(); }
export function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// Abfragen mit 0-basiertem Stage-Index
export const stageInfo = i => save.stages[i + 1] || null;
export const stageCleared = i => !!(save.stages[i + 1] && save.stages[i + 1].cleared);
export const stageUnlocked = i => i === 0 || stageCleared(i - 1);
export const stageBest = i => (save.stages[i + 1] ? save.stages[i + 1].best : 0);
export const talent = id => save.talents[id] || 0;

// Konto-XP gutschreiben, gibt die Anzahl neuer Level zurück
export function gainAccountXp(n) {
  const p = save.profile; let up = 0;
  p.xp += n;
  while (p.level < 50 && p.xp >= accountXpNeed(p.level)) { p.xp -= accountXpNeed(p.level); p.level++; up++; }
  return up;
}

// Fähigkeiten-Stand (ohne Eintrag: Level 1, nichts gelernt)
export const abilState = id => save.abilities[id] || (save.abilities[id] = { lv: 1, xp: 0, pts: {} });
export function gainAbilXp(id, n) {
  const a = abilState(id); let up = 0;
  if (a.lv >= ABIL_MAX_LV) return 0;
  a.xp += n;
  while (a.lv < ABIL_MAX_LV && a.xp >= abilXpNeed(a.lv)) { a.xp -= abilXpNeed(a.lv); a.lv++; up++; }
  if (a.lv >= ABIL_MAX_LV) a.xp = 0;
  return up;
}

export function recordStage(i, { win, time }) {
  const s = save.stages[i + 1] || (save.stages[i + 1] = { cleared: false, stars: 0, best: 0, nightmare: false });
  if (win) s.cleared = true;
  s.best = Math.max(s.best, Math.floor(time));
}
