// Spielstand v2 mit Versionsnummer und Migration.
// Kaputte oder unvollständige Stände werden repariert statt zu crashen.
// Stages sind im Save 1-basiert ("1" = Goblinwiese), im Code 0-basiert.
import { ABILITIES, ABIL_MAX_LV, DEFAULT_LOADOUT, TREE, abilXpNeed, treeDef, treeValid } from '../data/abilities.js';
import { accountXpNeed } from '../game/balance.js';
import { OLD_COST, TALENT, oldShopCost } from '../data/talents.js';
import { WEAPONS } from '../data/weapons.js';
import { CARD_MAX, CARD_RARITY, CHESTS, FREE_MAX, RARITY, SHELF } from '../data/cards.js';
import { COSM, DEFAULT_LOOK_KEYS, SLOTS, START_COSM } from '../data/cosmetics.js';
import { ACH } from '../data/achievements.js';
import { LEVELS } from '../data/levels.js';
import { normRunes } from '../game/runes.js';

export const SAVE_KEY = 'goblinio_save_v2';
export const SAVE_KEY_V1 = 'goblinio_save_v1';
export const VERSION = 4;

const today = () => new Date().toISOString().slice(0, 10);

export function defaults() {
  return {
    version: VERSION,
    profile: { name: 'Goblin', level: 1, xp: 0, title: '', created: today() },
    wallet: { gold: 0, gems: 0 },
    // Talente (data/talents.js); bis v2 waren das die Werkstatt-Stufen
    talents: {},
    stages: {},
    // weapons: in wie vielen Läufen welche Waffe dabei war (Lieblingswaffe)
    // c: Zähler für Erfolge und Tagesaufgaben (game/progress.js)
    stats: { runs: 0, wins: 0, kills: 0, playSeconds: 0, bestKills: 0, bestLevel: 0, weapons: {}, chests: 0, c: {} },
    // Platz des Goblins auf der Weltkarte (si = Welt 0-basiert, li = Level); fresh: gerade freigespielt
    // nm: Albtraum-Schalter auf der Karte
    map: { si: 0, li: 0, fresh: false, nm: false },
    // Fähigkeiten in Slot 1 und 2 (Slot 2 ab Konto-Level 3)
    loadout: [...DEFAULT_LOADOUT],
    // Fähigkeiten, die schon über Welten freigespielt waren, als die Welten neu geordnet wurden (v4)
    keep: [],
    // Fähigkeiten-Level und Skill Tree, auch Rolle (dash) und Sprint: { id: { lv, xp, pts: { pow, cd, area, s1, a, s2, s3, b, m } } }
    abilities: {},
    // Einstellungen (ui/settings.js): Lautstärke 0–1, btn = Größe der Handy-Knöpfe (s/m/l), lefty = Knöpfe links
    // full: Vollbild (exe merkt es sich über den Neustart)
    settings: { mute: false, musicOff: false, sfxVol: 1, musVol: 1, shake: true, numbers: true, lefty: false, btn: 'm', full: false },
    // Zeitpunkt der letzten Änderung (persist); der Cloud-Abgleich erkennt daran, ob sich lokal etwas getan hat
    savedAt: 0,
    // Karten (9.3): { id: { lv, n } }; ohne Eintrag Startstufe der Seltenheit
    cards: {},
    // Truhen (9.5): Regal [{ type, end }], Gratis-Truhen { n, t }, Pity-Zähler
    chests: { shelf: [], free: { n: 1, t: 0 } },
    pity: { epic: 0, leg: 0 },
    // Laden (9.6): Tag der Angebote und was davon gekauft wurde
    shop: { day: '', bought: [] },
    // Kosmetik (9.7): besessene Teile (ids "slot.key") und was angezogen ist
    cosm: [...START_COSM],
    look: { ...DEFAULT_LOOK_KEYS },
    // Erfolge (9.8): abgeholte Stufe je Erfolg; Tagesaufgaben: Tag, Zählerstand am Tagesbeginn, abgeholt
    ach: {},
    daily: { day: '', base: {}, claimed: [false, false, false], bonus: false },
    // Runen (Phase 10): Tasche { 'fire.0': 3 }, Sockel je Fähigkeit [Sockel 1, Sockel 2] (game/runes.js)
    runes: { bag: {}, sock: {} },
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
    stats: {
      runs: num(st.runs) | 0, wins: num(st.wins) | 0, kills: num(st.kills) | 0, playSeconds: num(st.playSeconds),
      bestKills: num(st.bestKills) | 0, bestLevel: num(st.bestLevel) | 0, weapons: {}, c: {},
    },
    map: { si: 0, li: 0, fresh: false, nm: false },
    loadout: normLoadout(r.loadout),
    savedAt: num(r.savedAt),
    keep: Array.isArray(r.keep) ? [...new Set(r.keep.filter(id => ABILITIES[id]))] : [],
    abilities: normAbilities(r.abilities),
    settings: {
      mute: bool(se.mute, false), musicOff: bool(se.musicOff, false), sfxVol: num(se.sfxVol, 1, 0, 1), musVol: num(se.musVol, 1, 0, 1),
      shake: bool(se.shake, true), numbers: bool(se.numbers, true), lefty: bool(se.lefty, false), btn: ['s', 'm', 'l'].includes(se.btn) ? se.btn : 'm', full: bool(se.full, false),
    },
    cards: {},
    chests: { shelf: [], free: { n: 1, t: 0 } },
    pity: { epic: 0, leg: 0 },
    shop: { day: '', bought: [] },
    cosm: [...START_COSM],
    look: { ...DEFAULT_LOOK_KEYS },
    ach: {},
    daily: { day: '', base: {}, claimed: [false, false, false], bonus: false },
  };
  out.runes = normRunes(r.runes, out.abilities);
  for (const [k, v] of Object.entries(obj(st.c))) { const n = num(v); if (n) out.stats.c[k] = n; }
  for (const [k, v] of Object.entries(obj(r.ach))) if (ACH[k]) { const n = num(v, 0, 0, 3) | 0; if (n) out.ach[k] = n; }
  const dl = obj(r.daily);
  if (typeof dl.day === 'string') {
    const base = {}; for (const [k, v] of Object.entries(obj(dl.base))) base[k] = num(v);
    const cl = Array.isArray(dl.claimed) ? dl.claimed : [];
    out.daily = { day: dl.day, base, claimed: [0, 1, 2].map(i => cl[i] === true), bonus: bool(dl.bonus, false) };
  }
  if (Array.isArray(r.cosm)) for (const id of r.cosm) if (COSM[id] && !out.cosm.includes(id)) out.cosm.push(id);
  const lk = obj(r.look);
  for (const s of SLOTS) if (typeof lk[s.id] === 'string' && out.cosm.includes(s.id + '.' + lk[s.id])) out.look[s.id] = lk[s.id];
  for (const [k, v] of Object.entries(obj(r.cards))) {
    if (!CARD_RARITY[k]) continue;
    const c = obj(v), start = RARITY[CARD_RARITY[k]].start;
    out.cards[k] = { lv: num(c.lv, start, start, CARD_MAX) | 0, n: num(c.n) | 0 };
  }
  const ch = obj(r.chests), fr = obj(ch.free), pi = obj(r.pity), sh = obj(r.shop);
  if (Array.isArray(ch.shelf)) out.chests.shelf = ch.shelf.map(obj).filter(c => CHESTS[c.type]).slice(0, SHELF).map(c => ({ type: c.type, end: num(c.end) }));
  if (r.chests) out.chests.free = { n: num(fr.n, 0, 0, FREE_MAX) | 0, t: num(fr.t) };
  out.pity = { epic: num(pi.epic) | 0, leg: num(pi.leg) | 0 };
  if (typeof sh.day === 'string') out.shop = { day: sh.day, bought: Array.isArray(sh.bought) ? sh.bought.filter(x => typeof x === 'number') : [] };
  out.stats.chests = num(st.chests) | 0;
  for (const [k, v] of Object.entries(obj(st.weapons))) if (WEAPONS[k]) { const n = num(v) | 0; if (n) out.stats.weapons[k] = n; }
  for (const [k, v] of Object.entries(obj(r.talents))) if (TALENT[k]) out.talents[k] = num(v, 0, 0, TALENT[k].max) | 0;
  for (const [k, v] of Object.entries(obj(r.stages))) {
    if (!/^\d+$/.test(k) || +k < 1) continue;
    const s = obj(v);
    const o = out.stages[+k] = { cleared: bool(s.cleared, false), stars: num(s.stars, 0, 0, 3) | 0, best: num(s.best), nightmare: bool(s.nightmare, false), lv: [] };
    // Level der Welt (6.1a); Stände von vor den Welten: geschaffte Stage = alle Level mit 1 Hut
    const lv = Array.isArray(s.lv) ? s.lv : [];
    for (let i = 0; i < LEVELS; i++) {
      const l = obj(lv[i]);
      o.lv.push({ hats: num(l.hats, o.cleared && !Array.isArray(s.lv) ? 1 : 0, 0, 3) | 0, hm: num(l.hm, 0, 0, 7) | 0, kills: num(l.kills) | 0, fast: num(l.fast), nm: bool(l.nm, false) });
    }
  }
  // Kartenplatz; alte Stände: erstes offenes Level der höchsten freien Welt
  const m = obj(r.map);
  if (typeof m.si === 'number') out.map = { si: num(m.si, 0, 0, 99) | 0, li: num(m.li, 0, 0, LEVELS - 1) | 0, fresh: bool(m.fresh, false), nm: bool(m.nm, false) };
  else {
    let k = 0; while (out.stages[k + 1] && out.stages[k + 1].cleared) k++;
    const lv = out.stages[k + 1] ? out.stages[k + 1].lv : [];
    let li = 0; while (li < LEVELS - 1 && lv[li] && lv[li].hats) li++;
    out.map = { si: k, li, fresh: false, nm: false };
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
    if (!treeDef(id)) continue;
    const o = obj(a), pt = obj(o.pts), st = { lv: num(o.lv, 1, 1, ABIL_MAX_LV) | 0, xp: num(o.xp), pts: {} };
    for (const k of Object.keys(TREE)) { const n = num(pt[k], 0, 0, TREE[k].max) | 0; if (n) st.pts[k] = n; }
    // mehr ausgegeben als möglich oder Reihen-Regel verletzt (Baum v1 → v2) → zurücksetzen, Punkte bleiben frei
    if (!treeValid(st)) st.pts = {};
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

// v3 → v4: 8 Welten statt 5 (Aschesteppe und Nebelmoor weg, Turm wird Welt 8). Entschieden mit Fabi:
// Weltfortschritt beginnt neu; Fähigkeiten, die über Welt-Siege schon frei waren, bleiben frei (keep).
export function migrateV3(v3) {
  const r = { ...obj(v3) }, st = obj(r.stages), keep = [];
  for (const [id, A] of Object.entries(ABILITIES)) if (A.unlock && A.unlock.stage && obj(st[A.unlock.stage]).cleared) keep.push(id);
  return { ...r, version: 4, stages: {}, map: { si: 0, li: 0, fresh: false, nm: false }, keep };
}

// Beliebigen Rohstand auf die aktuelle Version bringen
export function migrate(raw) {
  let r = obj(raw);
  if (!r.version) r = migrateV1(r);
  if (r.version < 3) r = migrateV2(r);
  if (r.version < 4) r = migrateV3(r);
  return normalize(r);
}

export let save = defaults();

function readJson(key) {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch (e) { return undefined; }
}

export function loadSave() {
  const v2 = readJson(SAVE_KEY);
  if (v2 && typeof v2 === 'object') { save = migrate(v2); lastJson = content(save); persist(); }
  else {
    if (v2 === undefined) { try { localStorage.setItem(SAVE_KEY + '_broken', localStorage.getItem(SAVE_KEY)); } catch (e) {} }
    const v1 = readJson(SAVE_KEY_V1);
    save = v1 && typeof v1 === 'object' ? migrate(v1) : defaults();
    persist();
  }
  return save;
}
export function setSave(s) { save = normalize(s); persist(); }
// savedAt nur bei echter Änderung des Inhalts (Cloud-Abgleich: „hier hat sich etwas getan“)
let lastJson = '';
const content = s => JSON.stringify({ ...s, savedAt: 0 });
export function persist() {
  const j = content(save);
  if (j !== lastJson) { lastJson = j; save.savedAt = Date.now(); }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}

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

// Level einer Welt
const newLv = () => Array.from({ length: LEVELS }, () => ({ hats: 0, hm: 0, kills: 0, fast: 0, nm: false }));
function stageRec(i) {
  const s = save.stages[i + 1] || (save.stages[i + 1] = { cleared: false, stars: 0, best: 0, nightmare: false });
  if (!Array.isArray(s.lv)) s.lv = newLv();
  return s;
}
export const levelInfo = (si, li) => { const s = save.stages[si + 1]; return (s && s.lv && s.lv[li]) || { hats: 0, hm: 0, kills: 0, fast: 0, nm: false }; };
export const levelDone = (si, li) => levelInfo(si, li).hats > 0;
export const levelUnlocked = (si, li) => stageUnlocked(si) && (li === 0 || levelDone(si, li - 1));
// Ergebnis eines Levels speichern. first = erstes Mal geschafft, newHats = Hüte dazugewonnen
// nm: im Albtraum-Modus gespielt; nmFirst = erstes Mal im Albtraum geschafft
// hatOk: welche Hut-Bedingungen erfüllt waren; gespeichert als Bitmaske hm des besten Laufs (für die Karte)
export function recordLevel(si, li, { win, time, hats, hatOk = null, kills = 0, endless = false, nm = false }) {
  if (endless) { recordStage(si, { win: false, time }); return { first: false, newHats: 0, nmFirst: false }; }
  const L = stageRec(si).lv[li], first = win && !L.hats, newHats = Math.max(0, hats - L.hats), nmFirst = win && nm && !L.nm;
  if (nmFirst) L.nm = true;
  if (win && hatOk && hats >= L.hats) L.hm = hatOk.reduce((m, ok, i) => m | (ok ? 1 << i : 0), 0);
  L.hats = Math.max(L.hats, hats); L.kills = Math.max(L.kills, kills);
  if (win && li === LEVELS - 1) { L.fast = L.fast ? Math.min(L.fast, Math.floor(time)) : Math.floor(time); recordStage(si, { win, time }); }
  return { first, newHats, nmFirst };
}
export function recordStage(i, { win, time }) {
  const s = stageRec(i);
  if (win) s.cleared = true;
  s.best = Math.max(s.best, Math.floor(time));
}
