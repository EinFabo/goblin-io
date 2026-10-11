// Spielstand v2 mit Versionsnummer und Migration.
// Kaputte oder unvollständige Stände werden repariert statt zu crashen.
// Stages sind im Save 1-basiert ("1" = Goblinwiese), im Code 0-basiert.

export const SAVE_KEY = 'goblinio_save_v2';
export const SAVE_KEY_V1 = 'goblinio_save_v1';
export const VERSION = 2;

const today = () => new Date().toISOString().slice(0, 10);

export function defaults() {
  return {
    version: VERSION,
    profile: { name: 'Goblin', level: 1, xp: 0, title: '', created: today() },
    wallet: { gold: 0, gems: 0 },
    // Bis Phase 5 die Werkstatt-Stufen aus v1 (gleiche Schlüssel, gleiche Wirkung)
    talents: {},
    stages: {},
    stats: { runs: 0, wins: 0, kills: 0, playSeconds: 0 },
    settings: { mute: false, musicOff: false, shake: true, numbers: true, lefty: false },
  };
}

const num = (v, d = 0, min = 0, max = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

// v1: { gold, unlocked, cleared: {0: true}, best: {0: 251}, shop: {atk: 3}, mute, musicOff }
export function migrateV1(v1) {
  v1 = obj(v1);
  const s = defaults();
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
    settings: {
      mute: bool(se.mute, false), musicOff: bool(se.musicOff, false), shake: bool(se.shake, true),
      numbers: bool(se.numbers, true), lefty: bool(se.lefty, false),
    },
  };
  for (const [k, v] of Object.entries(obj(r.talents))) out.talents[k] = num(v, 0, 0, 99) | 0;
  for (const [k, v] of Object.entries(obj(r.stages))) {
    if (!/^\d+$/.test(k) || +k < 1) continue;
    const s = obj(v);
    out.stages[+k] = { cleared: bool(s.cleared, false), stars: num(s.stars, 0, 0, 3) | 0, best: num(s.best), nightmare: bool(s.nightmare, false) };
  }
  return out;
}

// Beliebigen Rohstand auf die aktuelle Version bringen
export function migrate(raw) {
  const r = obj(raw);
  if (!r.version) return normalize(migrateV1(r));
  return normalize(r);
}

export let save = defaults();

function readJson(key) {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { return undefined; }
}

export function loadSave() {
  const v2 = readJson(SAVE_KEY);
  if (v2 && typeof v2 === 'object') save = migrate(v2);
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

export function recordStage(i, { win, time }) {
  const s = save.stages[i + 1] || (save.stages[i + 1] = { cleared: false, stars: 0, best: 0, nightmare: false });
  if (win) s.cleared = true;
  s.best = Math.max(s.best, Math.floor(time));
}
