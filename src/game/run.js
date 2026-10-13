import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { newSeed, seedRun } from '../core/rng.js';
import { abilState, gainAbilXp, gainAccountXp, levelDone, persist, recordLevel, save, talent } from '../core/save.js';
import { ABILITIES, ABILITY_IDS, SLOT2_ACCT } from '../data/abilities.js';
import { accountXp } from './balance.js';
import { TAU, isTouch } from '../core/util.js';
import { STAGES, STAGE_LEN } from '../data/stages.js';
import { LEVELS, levelStage, nextLevel } from '../data/levels.js';
import { canEquip, initAbilities, updAbilities } from './abilities.js';
import { doEvent, spawnTick, updEnemy } from './enemies.js';
import { part, ring } from './fx.js';
import { updEProj, updTele } from './hazards.js';
import { updItems } from './items.js';
import { updPlayer } from './player.js';
import { newOfferState } from './offer.js';
import { P, buildGrid, grid, query, run, setRun, xpNeed } from './state.js';
import { updAllies, updPProj, updWeapons } from './weapons.js';

// Neuer Lauf: nur Spielzustand. Bildschirm, HUD und Musik macht die Szene "run".
// si = Welt (Stage), li = Level in der Welt (0–4, das letzte ist das Boss-Level)
export function newRun(si, seed = newSeed(), li = 0) {
  const st = levelStage(si, li);
  seedRun(seed);
  const r = {
    si, li: st.li, st, seed, time: 0, minHp: 1, kills: 0, gold: 0, enemies: [], eproj: [], pproj: [], items: [], fx: [], parts: [], nums: [], zones: [], tele: [], haz: [], graves: [], allies: [],
    weapons: [], passives: {}, spawnAcc: 0, spawnQ: [], ei: 0, events: [], loop: 0, boss: null, arena: null, seen: new Set(), hints: [], hintT: 0,
    rerolls: 2 + talent('reroll'), bans: 1 + talent('ban'), locks: 1, cardN: talent('xp') >= 10 ? 4 : 3, pendingLv: 0, pendingChest: 0, lowT: 0, goldT: 0, decoy: null, lvDelay: 0, lvKind: 'lv', paused: false, over: false, shake: 0, hurtT: 0, clearT: 0, flashT: 0,
  };
  const p = { x: 0, y: 0, vx: 0, vy: 0, face: 'down', moving: false, anim: 0, inv: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, aimX: 1, aimY: 0,
    hp: 0, maxHp: 0, lv: 1, xp: 0, need: xpNeed(1), rageT: 0, smokeT: 0, shieldT: 0, shieldHp: 0, shieldMax: 1, shieldShard: 0, mechArmor: .3, mechPow: 1, mechRocket: 1.4, slowT: 0, trail: [], trailT: 0,
    stam: 100, stamMax: 100, stamDelay: 0, exhaust: false, sprinting: false, leg: 0,
    mechT: 0, mechMax: 12, gunT: 0, rocketT: 0, stepT: 0, gunA: 0, gunFlash: 0, abilReadyShown: [false, false],
    step: 0, rollT: 0, hitT: 0, exSlowT: 0, perfect: false, endAnim: 0 };
  r.cam = { x: 0, y: 0, z: 1 }; r.hitstop = 0; r.slowT = 0; r.caster = null;
  r.offer = { ...newOfferState(), weapons: r.weapons, passives: r.passives };
  setRun(r, p);
  initAbilities();
  addEvents(0);
  grid.clear();
  recalc(); P.hp = P.maxHp; P.stam = P.stamMax;
  addWeapon('dagger');
  if (si === 0 && st.li === 0 && !levelDone(0, 0)) hint(isTouch() ? '<b>Tipp</b> Ziehe irgendwo auf dem Bildschirm zum Laufen. Rechts unten: Rolle, Sprint und deine Fähigkeiten.' : '<b>Tipp</b> WASD laufen · Leertaste Rolle · Shift Sprint · Q und E Fähigkeiten');
  emit('runStart', run);
}
// Feste Momente aus dem Wellen-Skript in die Zeitleiste (Endlos: je Runde erneut)
export function addEvents(loop) {
  const o = loop * (run.st.len || STAGE_LEN);
  for (const w of run.st.waves) if (w.event) run.events.push({ ...w, t: o + w.at });
}
export function recalc() {
  const pl = id => run.passives[id] || 0, sh = talent;
  P.dmgMult = (1 + .12 * pl('whet')) * (1 + .03 * sh('atk'));
  P.cdMult = Math.pow(.92, pl('book'));
  P.area = 1 + .12 * pl('amulet');
  P.armorMult = Math.pow(.93, pl('armor'));
  const old = P.maxHp;
  P.maxHp = 100 + 20 * pl('heart') + 6 * sh('hp');
  if (old) P.hp += Math.max(0, P.maxHp - old);
  P.regen = .4 * pl('herbs');
  P.speed = 165 * (1 + .08 * pl('boots')) * (1 + .02 * sh('spd'));
  P.magnet = 90 * (1 + .35 * pl('magnet')) * (1 + .06 * sh('mag'));
  P.xpMult = 1 + .03 * sh('xp');
  P.proj = 1 + .12 * pl('oil');
  P.crit = .08 + .06 * pl('powder');
  P.stamMax = 100 * (1 + .075 * sh('stam'));
}
export function addWeapon(id) { run.weapons.push({ id, lv: 1, evo: false, t: .3, t2: 0, a: 0, rot: 0, blades: [] }); }
export function hint(html) { run.hints.push(html); }

// ---------- Haupt-Update ----------
// Ein fester Simulationsschritt (60 Hz, siehe core/loop.js)
export function update(dt) {
  savePrev();
  run.time += dt;
  while (run.ei < run.events.length && run.time >= run.events[run.ei].t) doEvent(run.events[run.ei++]);
  updPlayer(dt);
  if (P.maxHp) run.minHp = Math.min(run.minHp, P.hp / P.maxHp);
  updCamera(dt);
  if (run.over) return;
  updAbilities(dt);
  spawnTick(dt);
  buildGrid();
  for (const e of run.enemies) if (!e.dead) updEnemy(e, dt);
  for (const e of run.enemies) {
    if (e.dead || e.boss || e.obj || (e.traits && e.traits.includes('float'))) continue;
    query(e.x, e.y, e.r * .9, o => {
      if (o === e) return;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || .01, ov = (e.r + o.r) * .9 - d;
      if (ov > 0) { const push = o.boss ? ov : ov * .5; e.x += dx / d * push; e.y += dy / d * push; }
    });
  }
  buildGrid();
  updWeapons(dt);
  updAllies(dt);
  updPProj(dt);
  updTele(dt);
  updEProj(dt);
  run.enemies = run.enemies.filter(e => !e.dead);
  updItems(dt);
  for (const f of run.fx) f.t += dt;
  run.fx = run.fx.filter(f => f.k === 'anim' ? f.t * f.fps < f.n : f.t < f.dur);
  for (const p of run.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; }
  run.parts = run.parts.filter(p => p.t < p.life);
  for (const n of run.nums) n.t += dt;
  run.nums = run.nums.filter(n => n.t < .7);
  run.shake *= Math.exp(-10 * dt); run.hurtT -= dt; run.flashT -= dt;
  if (run.clearT > 0) { run.clearT -= dt; if (run.clearT <= 0) endRun(true); }
  if (!run.over && !run.paused && run.lvDelay <= 0 && (run.pendingChest > 0 || run.pendingLv > 0)) {
    if (run.pendingChest > 0) { run.pendingChest--; run.lvKind = 'chest'; sfx.chest(); }
    else { run.pendingLv--; run.lvKind = 'lv'; sfx.lvl(); }
    run.lvDelay = .45;
    const col = run.lvKind === 'chest' ? '#ffd84a' : '#8fe6ff';
    ring(P.x, P.y, 10, 160, .45, col, 8);
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; part(P.x, P.y - 10, Math.cos(a) * 220, Math.sin(a) * 220, .45, col, 3.5); }
  }
}

// Positionen vor dem Schritt merken, damit der Renderer zwischen zwei Schritten interpolieren kann
function savePrev() {
  P.px = P.x; P.py = P.y;
  run.cam.px = run.cam.x; run.cam.py = run.cam.y;
  for (const e of run.enemies) { e.px = e.x; e.py = e.y; }
  for (const a of run.allies) { a.px = a.x; a.py = a.y; }
  for (const a of run.tmpAllies) { a.px = a.x; a.py = a.y; }
}

// Lauf beenden: Belohnung, Spielstand, Statistik. Die Szene zeigt danach das Ergebnis.
export function endRun(win) {
  if (run.over) return;
  run.over = true; run.paused = true;
  const boss = !run.st.endless && run.li === LEVELS - 1;
  const bonus = win ? 25 + run.si * 20 + (boss ? 40 + run.si * 30 : 0) : 0;
  // Magierhüte (6.1a): geschafft, über 50 % Leben am Ende, nie unter 25 % gefallen
  const hats = win ? 1 + (P.hp / P.maxHp > .5 ? 1 : 0) + (run.minHp >= .25 ? 1 : 0) : 0;
  // Konto-XP (14.3) und was dadurch neu freigeschaltet wird
  const before = ABILITY_IDS.filter(canEquip);
  const rec = recordLevel(run.si, run.li, { win, time: run.time, hats, kills: run.kills, endless: !!run.st.endless });
  const xp = accountXp({ kills: run.kills, seconds: run.time, win, firstClear: rec.first, boss: boss || !!run.st.endless }), up = gainAccountXp(xp);
  const unlocked = ABILITY_IDS.filter(id => canEquip(id) && !before.includes(id)).map(id => ABILITIES[id].name);
  if (up && save.profile.level >= SLOT2_ACCT && save.profile.level - up < SLOT2_ACCT) unlocked.unshift('zweiter Fähigkeiten-Slot');
  const nx = rec.first && boss && nextLevel(run.si, run.li);
  if (nx) unlocked.push(STAGES[nx.si].endless ? STAGES[nx.si].name : 'Welt ' + (nx.si + 1));
  // Fähigkeiten-XP durch Benutzen
  const abil = Object.entries(run.abXp).map(([id, x]) => { const lvUp = gainAbilXp(id, x); return { id, xp: x, lv: abilState(id).lv, up: lvUp }; });
  save.wallet.gold += run.gold + bonus;
  const s = save.stats; s.runs++; if (win) s.wins++; s.kills += run.kills; s.playSeconds += run.time;
  s.bestKills = Math.max(s.bestKills, run.kills); s.bestLevel = Math.max(s.bestLevel, P.lv);
  for (const w of run.weapons) s.weapons[w.id] = (s.weapons[w.id] || 0) + 1;
  const next = win ? nextLevel(run.si, run.li) : null;
  if (rec.first && next) save.map = { si: next.si, li: next.li, fresh: true };   // Karte: der Goblin läuft zum neuen Level
  persist();
  run.result = { win, bonus, gold: run.gold + bonus, next, hats, newHats: rec.newHats, first: rec.first, xp, level: save.profile.level, up, unlocked, abil };
  emit('runEnd', run.result);
}

// Kamera zieht weich nach und schaut in Laufrichtung voraus, beim Sprinten weiter und 4 % herausgezoomt
function updCamera(dt) {
  const c = run.cam, look = P.sprinting ? 40 : P.moving ? 16 : 0;
  const a = 1 - Math.pow(.85, dt * 60);
  c.x += (P.x + P.aimX * look - c.x) * a; c.y += (P.y + P.aimY * look - c.y) * a;
  c.z += ((P.sprinting ? .96 : 1) - c.z) * (1 - Math.pow(.92, dt * 60));
}
