// Spielstand v2 mit Versionsnummer und Migration.
// Kaputte oder unvollständige Stände werden repariert statt zu crashen.
// Stages sind im Save 1-basiert ("1" = Goblinwiese), im Code 0-basiert.
import { ABILITIES, ABILITY_IDS, ABIL_MAX_LV, DEFAULT_LOADOUT, STAR_MAX, STAR_XP, TREE, abilXpNeed, abilityUnlocked, treeDef, treeValid } from '../data/abilities.js';
import { accountXpNeed } from '../game/balance.js';
import { OLD_COST, TALENT, oldShopCost } from '../data/talents.js';
import { WEAPONS } from '../data/weapons.js';
import { CARD_MAX, CARD_RARITY, CHESTS, FREE_MAX, RARITY, SHELF } from '../data/cards.js';
import { COSM, DEFAULT_LOOK_KEYS, SLOTS, START_COSM } from '../data/cosmetics.js';
import { ACH, SCHOOL_NAME } from '../data/achievements.js';
import { LEVELS } from '../data/levels.js';
import { normRunes } from '../game/runes.js';
import { COMBOS } from '../data/combos.js';
import { CLASS_MAX_LV, classUnlocked, classXpNeed, isClass } from '../data/classes.js';
import { BOUNTY_COND, BOUNTY_N, PASS_STAGES, WEEKLY_N, WEEKLY_POOL } from '../data/quests.js';
import { NM_MAX } from '../data/nightmare.js';
import { STAGES } from '../data/stages.js';
import { AFFIXES } from '../data/affixes.js';

export const SAVE_KEY = 'goblinio_save_v2';
export const SAVE_KEY_V1 = 'goblinio_save_v1';
export const VERSION = 8;

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
    map: { si: 0, li: 0, fresh: false, nm: 0 },
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
    // Kombos (Phase 10): entdeckte Kombos (ids aus data/combos.js), fürs Kombo-Buch
    combos: [],
    // Fähigkeiten, die in der Rüstkammer schon angesehen wurden (sonst „Neu“-Markierung); die von Anfang an freien gelten als gesehen
    seen: ABILITY_IDS.filter(id => !ABILITIES[id].unlock),
    // Goblin-Klassen (Phase 9): gewählte Klasse und Klassen-Level { id: { lv, xp } }
    cls: 'gob',
    classes: {},
    // Phase 11: Wochenaufgaben (Woche, Zählerstand, Aufgaben, abgeholt), Aufgaben-Pass (Saison, Punkte, abgeholte Stufen,
    // Bonustruhen, Titel „Pass-Held“), Kopfgeld des Tages (Steckbriefe, erfüllt), Fähigkeiten-Quests (abgeholte Stufe je Fähigkeit)
    weekly: { wk: -1, base: {}, tasks: [], claimed: [], bonus: false },
    pass: { season: -1, pts: 0, claimed: [], bonus: 0, champ: false },
    bounty: { day: '', list: [], done: [] },
    aq: {},
  };
}

// Albtraum-Stufe 0–10; bis v7 war es Ja/Nein (true = Stufe 1)
const nmNum = v => (v === true ? 1 : typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(NM_MAX, v | 0)) : 0);
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
    map: { si: 0, li: 0, fresh: false, nm: 0 },
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
  out.combos = Array.isArray(r.combos) ? [...new Set(r.combos.filter(k => COMBOS[k]))] : [];
  out.cls = isClass(r.cls) ? r.cls : 'gob';
  out.classes = {};
  for (const [k, v] of Object.entries(obj(r.classes))) if (isClass(k)) { const c = obj(v); out.classes[k] = { lv: num(c.lv, 1, 1, CLASS_MAX_LV) | 0, xp: num(c.xp) }; }
  normQuests(r, out);
  out.seen = Array.isArray(r.seen) ? [...new Set(r.seen.filter(id => ABILITIES[id]))] : d.seen;
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
      o.lv.push({ hats: num(l.hats, o.cleared && !Array.isArray(s.lv) ? 1 : 0, 0, 3) | 0, hm: num(l.hm, 0, 0, 7) | 0, kills: num(l.kills) | 0, fast: num(l.fast), nm: nmNum(l.nm) });
    }
    // Albtraum-Stufen (v8): höchste Stufe mit besiegtem Boss; alte Stände: Boss im Albtraum geschafft = Stufe 1
    o.nmMax = Math.max(nmNum(s.nmMax), o.lv[LEVELS - 1].nm);
  }
  // Kartenplatz; alte Stände: erstes offenes Level der höchsten freien Welt
  const m = obj(r.map);
  if (typeof m.si === 'number') out.map = { si: num(m.si, 0, 0, 99) | 0, li: num(m.li, 0, 0, LEVELS - 1) | 0, fresh: bool(m.fresh, false), nm: nmNum(m.nm) };
  else {
    let k = 0; while (out.stages[k + 1] && out.stages[k + 1].cleared) k++;
    const lv = out.stages[k + 1] ? out.stages[k + 1].lv : [];
    let li = 0; while (li < LEVELS - 1 && lv[li] && lv[li].hats) li++;
    out.map = { si: k, li, fresh: false, nm: 0 };
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
    const stars = num(o.st, 0, 0, STAR_MAX) | 0; if (stars && st.lv >= ABIL_MAX_LV && ABILITIES[id]) st.st = stars;   // Sterne erst ab Level 30, nur Fähigkeiten
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

// v4 → v5 (Phase 10: Runen, Kombos, Sterne, Rüstkammer 2.0). Runen, Kombos und Sterne kommen über normalize dazu.
// Alles, was schon frei ist, gilt als gesehen – sonst stünde nach dem Update an jeder Fähigkeit „Neu“.
export function migrateV4(v4) {
  const r = { ...obj(v4) }, st = obj(r.stages), acct = num(obj(r.profile).level, 1), keep = Array.isArray(r.keep) ? r.keep : [];
  const seen = ABILITY_IDS.filter(id => keep.includes(id) || abilityUnlocked(id, acct, i => !!obj(st[i + 1]).cleared));
  return { ...r, version: 5, seen };
}

// Phase 11: Wochenaufgaben, Pass, Kopfgeld, Fähigkeiten-Quests prüfen (alles Unbekannte fällt weg)
function normQuests(r, out) {
  const w = obj(r.weekly), p = obj(r.pass), b = obj(r.bounty), arr = v => (Array.isArray(v) ? v : []);
  // Einträge mit ihrem Abgeholt-Haken zusammen filtern, damit der Haken nicht auf die nächste Aufgabe rutscht
  const wk = arr(w.tasks).map((t, i) => [obj(t), arr(w.claimed)[i] === true]).filter(([t]) => WEEKLY_POOL.some(q => q.id === t.id)).slice(0, WEEKLY_N);
  const base = {}; for (const [k, v] of Object.entries(obj(w.base))) base[k] = num(v);
  out.weekly = { wk: Number.isInteger(w.wk) ? w.wk : -1, base, tasks: wk.map(([t]) => ({ id: t.id, n: Math.max(1, num(t.n, 1) | 0) })), claimed: wk.map(([, c]) => c), bonus: bool(w.bonus, false) };
  out.pass = { season: Number.isInteger(p.season) ? p.season : -1, pts: num(p.pts) | 0, claimed: [...new Set(arr(p.claimed).filter(s => Number.isInteger(s) && s >= 1 && s <= PASS_STAGES))],
    bonus: num(p.bonus) | 0, champ: bool(p.champ, false) };
  const bl = arr(b.list).map((x, i) => [obj(x), arr(b.done)[i] === true]).filter(([x]) => bountyValid(x)).slice(0, BOUNTY_N);
  out.bounty = { day: typeof b.day === 'string' ? b.day : '', list: bl.map(([x]) => x), done: bl.map(([, d]) => d) };
  out.aq = {}; for (const [k, v] of Object.entries(obj(r.aq))) if (ABILITIES[k]) { const n = num(v, 0, 0, 3) | 0; if (n) out.aq[k] = n; }
}

// Steckbrief vollständig und mit bekannten Werten? (sonst würden Text oder Belohnung abstürzen)
function bountyValid(x) {
  const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
  if (!int(x.sk, 1, 3)) return false;
  if (x.t === 'boss' || x.t === 'level') { if (!int(x.si, 0, STAGES.length - 1) || STAGES[x.si].endless) return false; }
  else if (x.t === 'school') { if (!SCHOOL_NAME[x.school] || !int(x.n, 1, 999)) return false; }
  else if (x.t === 'affix') { if (!AFFIXES[x.affix] || !int(x.n, 1, 99)) return false; }
  else return false;
  if (x.c === null || x.c === undefined) return true;
  if (!(x.c in BOUNTY_COND)) return false;
  if (x.c === 'abil') return !!ABILITIES[x.abil];
  if (x.c === 'cls') return isClass(x.cls);
  if (x.c === 'time') return typeof x.T === 'number' && x.T > 0 && x.t === 'boss';
  if (x.c === 'nohit') return x.t === 'boss';
  return true;
}

// v7 → v8 (Phase 12: Albtraum-Stufen, Herausforderung, Wiedergeburt): Umwandlung in normalize
export function migrateV7(v7) { return { ...obj(v7), version: 8 }; }

// v6 → v7 (Phase 11: Quests und Aufgaben-Pass): alles kommt leer über normalize dazu
export function migrateV6(v6) { return { ...obj(v6), version: 7 }; }

// v5 → v6 (Phase 9: Goblin-Klassen). Klasse und Klassen-Level kommen über normalize dazu (Goblin, Level 1).
export function migrateV5(v5) { return { ...obj(v5), version: 6 }; }

// Beliebigen Rohstand auf die aktuelle Version bringen
export function migrate(raw) {
  let r = obj(raw);
  if (!r.version) r = migrateV1(r);
  if (r.version < 3) r = migrateV2(r);
  if (r.version < 4) r = migrateV3(r);
  if (r.version < 5) r = migrateV4(r);
  if (r.version < 6) r = migrateV5(r);
  if (r.version < 7) r = migrateV6(r);
  if (r.version < 8) r = migrateV7(r);
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

// Gespielte Klasse: die gewählte, falls frei, sonst der Goblin (alter oder fremder Stand). Lauf, Aussehen und Hub nutzen nur das.
export const activeCls = () => (classUnlocked(save.cls, stageCleared) ? save.cls : 'gob');
// Klassen-Level (Phase 9): Stand ohne Eintrag Level 1; gibt die neuen Level zurück
export const clsState = id => save.classes[id] || { lv: 1, xp: 0 };
export function gainClassXp(id, n) {
  const c = save.classes[id] || (save.classes[id] = { lv: 1, xp: 0 }); let up = 0;
  c.xp += n;
  while (c.lv < CLASS_MAX_LV && c.xp >= classXpNeed(c.lv)) { c.xp -= classXpNeed(c.lv); c.lv++; up++; }
  if (c.lv >= CLASS_MAX_LV) c.xp = 0;
  return up;
}

// Fähigkeiten-Stand (ohne Eintrag: Level 1, nichts gelernt)
export const abilState = id => save.abilities[id] || (save.abilities[id] = { lv: 1, xp: 0, pts: {} });
// Ab Level 30 zählt die XP für Sterne weiter (a.st, je STAR_XP einer, bis STAR_MAX). Gibt die neuen Level zurück.
export function gainAbilXp(id, n) {
  const a = abilState(id); let up = 0;
  a.xp += n;
  while (a.lv < ABIL_MAX_LV && a.xp >= abilXpNeed(a.lv)) { a.xp -= abilXpNeed(a.lv); a.lv++; up++; }
  if (a.lv >= ABIL_MAX_LV) {
    // Sterne nur für Fähigkeiten, nicht für Rolle und Sprint
    while (ABILITIES[id] && (a.st || 0) < STAR_MAX && a.xp >= STAR_XP) { a.xp -= STAR_XP; a.st = (a.st || 0) + 1; }
    if (!ABILITIES[id] || (a.st || 0) >= STAR_MAX) a.xp = 0;
  }
  return up;
}

// Level einer Welt
const newLv = () => Array.from({ length: LEVELS }, () => ({ hats: 0, hm: 0, kills: 0, fast: 0, nm: 0 }));
function stageRec(i) {
  const s = save.stages[i + 1] || (save.stages[i + 1] = { cleared: false, stars: 0, best: 0, nightmare: false });
  if (!Array.isArray(s.lv)) s.lv = newLv();
  return s;
}
export const levelInfo = (si, li) => { const s = save.stages[si + 1]; return (s && s.lv && s.lv[li]) || { hats: 0, hm: 0, kills: 0, fast: 0, nm: 0 }; };
export const levelDone = (si, li) => levelInfo(si, li).hats > 0;
export const levelUnlocked = (si, li) => stageUnlocked(si) && (li === 0 || levelDone(si, li - 1));
// Ergebnis eines Levels speichern. first = erstes Mal geschafft, newHats = Hüte dazugewonnen
// nm: Albtraum-Stufe (0 = normal); nmFirst = diese Stufe zum ersten Mal in diesem Level geschafft (L.nm = beste Stufe).
// Boss-Level: nmMax der Welt = höchste Stufe mit besiegtem Boss (schaltet die nächste frei)
// hatOk: welche Hut-Bedingungen erfüllt waren; gespeichert als Bitmaske hm des besten Laufs (für die Karte)
// noBest: mit Weitermachen geschafft → Bestzeit zählt nicht (Wunsch Fabi 2026-10-16)
export function recordLevel(si, li, { win, time, hats, hatOk = null, kills = 0, endless = false, nm = false, noBest = false }) {
  if (endless) { recordStage(si, { win: false, time }); return { first: false, newHats: 0, nmFirst: false }; }
  nm = nm === true ? 1 : nm | 0;
  const S = stageRec(si), L = S.lv[li], first = win && !L.hats, newHats = Math.max(0, hats - L.hats), nmFirst = win && nm > 0 && nm > (L.nm || 0);
  if (nmFirst) L.nm = nm;
  if (win && nm > 0 && li === LEVELS - 1 && nm > (S.nmMax || 0)) S.nmMax = nm;
  if (win && hatOk && hats >= L.hats) L.hm = hatOk.reduce((m, ok, i) => m | (ok ? 1 << i : 0), 0);
  L.hats = Math.max(L.hats, hats); L.kills = Math.max(L.kills, kills);
  if (win && li === LEVELS - 1) { if (!noBest) L.fast = L.fast ? Math.min(L.fast, Math.floor(time)) : Math.floor(time); recordStage(si, { win, time }); }
  return { first, newHats, nmFirst };
}
export function recordStage(i, { win, time }) {
  const s = stageRec(i);
  if (win) s.cleared = true;
  s.best = Math.max(s.best, Math.floor(time));
}
