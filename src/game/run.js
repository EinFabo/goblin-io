import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { RNG, mulberry32, newSeed, seedRun } from '../core/rng.js';
import { takeInputs } from '../core/input.js';
import { abilState, clsState, gainAbilXp, gainAccountXp, gainClassXp, levelDone, levelUnlocked, persist, recordLevel, save, stageCleared, stageInfo } from '../core/save.js';
import { ABILITIES, ABILITY_IDS, SLOT2_ACCT } from '../data/abilities.js';
import { accountXp, bonusReward } from './balance.js';
import { TAU, isTouch } from '../core/util.js';
import { STAGES, STAGE_LEN } from '../data/stages.js';
import { LEVELS, levelStage, nextLevel } from '../data/levels.js';
import { canEquip, charmHp, doDash, initAbilities, updAbilities, useAbility } from './abilities.js';
import { doEvent, spawnTick, updEnemy } from './enemies.js';
import { restartBoss, skipCut, updCut } from './boss.js';
import { part, ring } from './fx.js';
import { updEProj, updTele } from './hazards.js';
import { pullable, updItems } from './items.js';
import { updPlayer } from './player.js';
import { reviveTick } from './combat.js';
import { newOfferState } from './offer.js';
import { BOONS, cardIdOf } from '../data/weapons.js';
import { NM_MAX, nmCap, nmGems, nmGold, nmXp } from '../data/nightmare.js';
import { cycleReward } from '../data/souls.js';
import { cycle, pityMul, soulRank } from './souls.js';
import { addRunes, rollRuneBag } from './runes.js';
import { CLASSES, DASH_KIND, SPRINT_KIND, classOf, hasPerk } from '../data/classes.js';
import { CARD_FAST, CARD_START_LV2, GEMS, passiveCardMul, victoryChest, weaponCardMul } from '../data/cards.js';
import { addToShelf, grantCards, grantChest, pickBonusCard, rollChest } from './chests.js';
import { grantCosmetic } from './cosmetics.js';
import { count, ensureDaily, mergeRun } from './progress.js';
import { checkBounties, finishChallenge } from './quests.js';
import { dayKey } from './shop.js';
import { P, activate, buildGrid, clampToArena, eachPlayer, grid, nearestGob, hasMut, query, run, setRun, setSrc, xpNeed, setWsrc } from './state.js';
import { coopLevelTick } from './levelup.js';
import { profileOf } from './profile.js';
import { updAllies, updPProj, updWeapons } from './weapons.js';
import { updWfx } from './weapons2.js';
import { updMegas } from './mega.js';
import { keyLabel } from '../core/device.js';

// Neuer Lauf: nur Spielzustand. Bildschirm, HUD und Musik macht die Szene "run".
// si = Welt (Stage), li = Level in der Welt (0–4, das letzte ist das Boss-Level)
// nm: Albtraum-Stufe 0–10 (6.1, Phase 12), nur in Welten, deren Boss schon besiegt ist
// opts (Phase 12): mut = Mutatoren, abil = feste Fähigkeiten für diesen Lauf (Herausforderung), mode = 'challenge' | 'bounty'
// opts.coop (Phase 14b): { profs: [Profil 0, Profil 1], me: eigener Index } – zwei Goblins, beide Rechner gleich
export function newRun(si, seed = newSeed(), li = 0, nm = false, opts = {}) {
  const st = levelStage(si, li);
  seedRun(seed);
  const r = {
    si, li: st.li, st, seed, tick: 0, megaFreeze: 0, nm: st.endless ? 0 : Math.max(0, Math.min(NM_MAX, nm === true ? 1 : nm | 0)), mini: null, time: 0, minHp: 1, kills: 0, gold: 0, enemies: [], eproj: [], items: [], fx: [], parts: [], nums: [], zones: [], tele: [], haz: [], graves: [],
    spawnAcc: 0, spawnQ: [], ei: 0, events: [], loop: 0, boss: null, arena: null, seen: new Set(), hints: [], hintT: 0,
    pendingLv: 0, pendingChest: 0, lowT: 0, lvDelay: 0, lvKind: 'lv', paused: false, over: false, shake: 0, hurtT: 0, clearT: 0, flashT: 0, cut: null, storm: 0, portals: [], pillars: [], wind: null, bonusLv: 0, clearAge: 0,
  };
  const co = opts.coop || null, p = newPlayer(co ? co.profs[0] : profileOf());
  r.players = [p]; r.pi = 0; r.me = co ? co.me : 0;   // Koop (Phase 14b): alle Goblins, der gerade gerechnete, der eigene
  if (co) {
    r.coop = true; r.coopHp = COOP_HP; r.coopDmg = COOP_DMG; r.noCont = true;   // kein Weitermachen für Juwelen im Koop
    r.fixedView = COOP_VIEW; r.vc = { x: 0, y: 0 };      // gleiche Sicht auf beiden Rechnern (state.js viewHW)
  }
  r.cycle = cycle(co ? co.profs[0] : save);   // Wiedergeburt: Zyklus (Gegner stärker, mehr Gold und XP); Koop: der von Goblin 0
  r.mut = [...(opts.mut || [])]; r.forceAbil = opts.abil || null; r.mode = opts.mode || null; r.day = dayKey();
  r.cnt = {};   // Zähler für Erfolge/Tagesaufgaben (game/progress.js)
  ensureDaily(save);
  r.cam = { x: 0, y: 0, z: 1 }; r.hitstop = 0; r.slowT = 0; r.caster = null;
  setRun(r, p);
  newKit();
  initAbilities();
  addEvents(0);
  grid.clear();
  recalc(); P.hp = P.maxHp; P.stam = P.stamMax; r.healed = 0; r.bossHits = 0;   // Kopfgeld: Heilung (state.js heal) und Treffer im Bosskampf
  const C = classOf(r.cls), dn = DASH_KIND[C.dash].name, sn = SPRINT_KIND[C.sprint].name;
  addWeapon(C.weapon, hasPerk(r.clsLv, 'start2') || soulRank(P.prof, 'w_start') > 0);
  if (co) { P.x = -COOP_GAP; for (const pr of co.profs.slice(1)) addPlayer(pr); activate(r.me); }
  if (si === 0 && st.li === 0 && !levelDone(0, 0)) hint(isTouch() ? '<b>Tipp</b> Ziehe irgendwo auf dem Bildschirm zum Laufen. ' + (save.settings.lefty ? 'Links' : 'Rechts') + ` unten: ${dn}, ${sn} und deine Fähigkeiten.` : `<b>Tipp</b> ${['up', 'left', 'down', 'right'].map(keyLabel).join('')} laufen · ${keyLabel('dash')} ${dn} · ${keyLabel('sprint')} ${sn} · ${keyLabel('ab0')} und ${keyLabel('ab1')} Fähigkeiten`);
  emit('runStart', run);
}
// Koop: Partner hat den Lauf verlassen (net/lockstep.js, Abschied oder lange still). Ab hier rechnet nur noch dieser
// Rechner: der Goblin des Partners liegt und zählt nicht mehr (kein Ziel, kein Wiederbeleben, Kamera nur auf den eigenen).
export function partnerGone() {
  const p = run.players[1 - run.me]; if (!p || p.gone) return;
  p.gone = p.down = true; p.hp = 0;
  // seine Helfer, Geschosse und laufenden Effekte verschwinden mit ihm (sonst kämpften sie unsichtbar weiter)
  activate(1 - run.me);
  run.allies = []; run.tmpAllies = []; run.abfx = []; run.pproj = []; run.wfx = []; run.megas = []; run.hive = null; run.totem = null; run.goldT = 0;
  activate(run.me);
  if (run.players[run.me].down) endRun(false);
}
// Koop: Gegner haben mehr Leben und treffen härter (Ausgleich fürs Wiederbeleben), Sicht in Welt-Einheiten fest (wie ein 16:9-Fenster bei ZOOM 1), Abstand beim Start
export const COOP_HP = 1.8, COOP_DMG = 1.5, COOP_VIEW = [800, 450], COOP_LEASH = [450, 260], COOP_GAP = 40;
// Weiterer Goblin (Koop): eigene Ausrüstung aus seinem Profil, startet rechts neben Goblin 0
function addPlayer(prof) {
  const i = run.players.length, p = newPlayer(prof);
  run.players.push(p); activate(i);
  newKit(); initAbilities(); recalc(); P.hp = P.maxHp; P.stam = P.stamMax;
  const C = classOf(run.cls);
  addWeapon(C.weapon, hasPerk(run.clsLv, 'start2') || soulRank(prof, 'w_start') > 0);
  P.x = COOP_GAP * (2 * i - 1);
  activate(0);
}
// Ein Goblin mit seinem Profil (game/profile.js); kit hält seine Ausrüstung, solange ein anderer aktiv ist (state.js activate)
function newPlayer(prof) {
  return { prof, kit: {}, x: 0, y: 0, vx: 0, vy: 0, face: 'down', moving: false, anim: 0, inv: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, aimX: 1, aimY: 0,
    hp: 0, maxHp: 0, lv: 1, xp: 0, need: xpNeed(1), rageT: 0, smokeT: 0, burrowT: 0, spinT: 0, spinSlow: 1, brew: null, shieldT: 0, shieldHp: 0, shieldMax: 1, shieldShard: 0, mechArmor: .3, mechPow: 1, mechRocket: 1.4, slowT: 0, trail: [], trailT: 0,
    stam: 100, stamMax: 100, stamDelay: 0, exhaust: false, sprinting: false, leg: 0,
    mechT: 0, mechMax: 12, gunT: 0, rocketT: 0, stepT: 0, gunA: 0, gunFlash: 0, abilReadyShown: [false, false],
    step: 0, rollT: 0, hitT: 0, exSlowT: 0, perfect: false, endAnim: 0, iceT: 0, ivx: 0, ivy: 0 };
}
// Ausrüstung des aktiven Goblins frisch für den Lauf (Felder aus state.js KIT, den Rest setzt initAbilities)
function newKit() {
  const pr = P.prof, t = id => pr.talents[id] || 0;
  Object.assign(run, {
    weapons: [], passives: {}, boons: {}, pproj: [], wfx: [], megas: [], allies: [], decoy: null, goldT: 0,
    rerolls: 2 + t('reroll') + soulRank(pr, 'w_reroll'), bans: 1 + t('ban') + soulRank(pr, 'w_ban'), locks: 1, cardN: t('xp') >= 10 || soulRank(pr, 'crown') ? 4 : 3,
    cls: pr.cls, clsLv: pr.clsLv, cards: { ...pr.cards },   // Klasse (Phase 9) und Kartenstufen (9.3) aus dem Profil
  });
  run.offer = { ...newOfferState(), weapons: run.weapons, passives: run.passives };
}
// Feste Momente aus dem Wellen-Skript in die Zeitleiste (Endlos: je Runde erneut)
export function addEvents(loop) {
  const o = loop * (run.st.len || STAGE_LEN);
  for (const w of run.st.waves) if (w.event) run.events.push({ ...w, t: o + w.at });
}
export function recalc() {
  // Passive: Stufen im Lauf × Kartenstufe (+10 % Wirkung je Stufe)
  const pr = P.prof, pl = id => (run.passives[id] || 0) * passiveCardMul(run.cards[id] || 1), sh = id => pr.talents[id] || 0;
  const bn = id => (1 + BOONS[id].v) ** (run.boons[id] || 0);   // Dauerboni, wenn alles ausgebaut ist (multiplikativ)
  // Klasse (Phase 9): Leben, Tempo, Abklingzeit; Klassen-Level: kleine Boni
  const C = classOf(run.cls), cl = k => hasPerk(run.clsLv || 1, k);
  const glass = hasMut('glass');   // Mutator Glaskanone
  P.dmgMult = (1 + .12 * pl('whet')) * (1 + .03 * sh('atk')) * bn('dmg') * (cl('dmg') ? 1.05 : 1) * (glass ? 1.6 : 1) * (1 + .05 * soulRank(pr, 'w_dmg'));
  P.cdMult = Math.pow(.92, pl('book')) * C.cd * (1 - .04 * soulRank(pr, 'm_cd'));
  P.area = 1 + .12 * pl('amulet');
  P.armorMult = Math.pow(.93, pl('armor'));
  const old = P.maxHp;
  P.maxHp = (100 + 20 * pl('heart') + 6 * sh('hp')) * charmHp() * bn('hp') * C.hp * (cl('hp') ? 1.05 : 1) * (glass ? .5 : 1) * (1 + .05 * soulRank(pr, 'w_hp'));
  if (old) P.hp += Math.max(0, P.maxHp - old);
  P.regen = .4 * pl('herbs');
  P.speed = 165 * (1 + .08 * pl('boots')) * (1 + .02 * sh('spd')) * C.speed;
  P.magnet = 90 * (1 + .35 * pl('magnet')) * (1 + .06 * sh('mag')) * (1 + .15 * soulRank(pr, 'c_mag'));
  P.xpMult = (1 + .03 * sh('xp')) * (cl('xp') ? 1.1 : 1);
  P.proj = 1 + .12 * pl('oil');
  P.crit = .08 + .06 * pl('powder') + .03 * soulRank(pr, 'w_crit');
  // zweite Reihe (2026-10-14)
  P.flatArmor = pl('helmet');
  P.atkSpd = (1 + .07 * pl('horn')) * bn('spd');
  P.bigMult = 1 + .12 * pl('skull');
  P.dodge = Math.min(.3, .04 * pl('cloak'));
  P.pierceAdd = Math.floor(pl('crystal') / 2);
  P.dur = 1 + .1 * pl('hourglass');
  P.leech = .004 * pl('fang');
  P.aoeMult = 1 + .1 * pl('ember');
  P.xpMult *= 1 + .08 * pl('clover');
  P.goldMult = (1 + .15 * pl('bag')) * (hasMut('gold') ? 2 : 1) * (1 + .1 * soulRank(pr, 'c_gold')) * cycleReward(run.cycle);
  // Sprint-Baum: Ausdauer, Erholung, Tempo, Leichtfüßig, Windschatten
  const sp = run.abMods.sprint;
  P.stamMax = 100 * (1 + .075 * sh('stam')) * (1 + .08 * sp.r.pow) * (1 + .15 * soulRank(pr, 'm_stam'));
  P.stamRegen = 26 * (1 + .08 * sp.r.cd); P.sprintMul = 1.55 * (1 + .04 * sp.r.area) * (C.sprint === 'charge' ? 1.1 : 1);   // Sturmangriff etwas schneller
  P.stamDrain = 34 * (1 - .08 * sp.s1); P.sprintMag = 1 + .15 * sp.s3; P.secondWind = sp.a; P.tireless = sp.m;
}
// Kartenstufe 5: startet auf Waffenstufe 2; Stufe 10: greift 15 % schneller an.
// Der Start auf Stufe 2 nur mit eigener Karte: legendäre Karten beginnen sonst schon auf Kartenstufe 5
// Klassenwaffen nutzen die Dolch-Karte; lv2: Klassen-Level 5 (Startwaffe auf Stufe 2)
export function addWeapon(id, lv2 = false) {
  const cid = cardIdOf(id), c = run.cards[cid] || 1, owned = P.prof.owned.includes(cid);
  run.weapons.push({ id, lv: lv2 || (owned && c >= CARD_START_LV2) ? 2 : 1, evo: false, t: .3, t2: 0, a: 0, rot: 0, blades: [], card: weaponCardMul(c), fast: c >= CARD_FAST ? 1.15 : 1 });
}
export function hint(html) { run.hints.push(html); }
// Level-Up, dessen Zeitlupe läuft (Karten noch nicht offen), wird zum Bonus-Level, wenn das Level endet.
// lvOpen: zwischen Start der Zeitlupe und Öffnen der Karten (bzw. Wahl durch den Bot)
export function lvToBonus() { if (!run.lvOpen) return; run.lvOpen = false; run.bonusLv += run.lvKind === 'chest' ? 2 : 1; }
// Level geschafft bzw. Boss besiegt: unverwundbar, alles fliegt zum Goblin. Offene Level-Ups und Truhen werden zu
// Bonus-Leveln (Karten würden nichts mehr bringen), weitere Level-Ups bis zum Ende ebenso (items.js addXp).
export function startClear(t) {
  run.clearT = t; run.clearAge = 0;
  run.bonusLv += run.pendingLv + run.pendingChest * 2;
  run.pendingLv = 0; run.pendingChest = 0; run.lvDelay = 0;
  lvToBonus();
  for (const it of run.items) if (pullable(it) || it.k === 'chest') it.mag = true;
}

// ---------- Haupt-Update ----------
const NO_INPUT = { mx: 0, my: 0, sprint: false, dash: false, ab0: false, ab1: false, skip: false, pick: -1 };
// Ein fester Simulationsschritt (60 Hz, siehe core/loop.js)
// inp: Eingabe dieses Ticks (core/input.js). Bot und Smoke rufen update(dt) ohne und lösen Rolle/Fähigkeiten direkt aus.
// inps: je Goblin ein Datensatz (Koop); fehlt einer, steht der Goblin.
// Im Schritt ist Goblin 0 aktiv (beide Rechner gleich), danach wieder der eigene (HUD, Zeichnen).
export function update(dt, inps = takeInputs()) {
  activate(0);
  try { step(dt, inps); } finally { activate(run.me); }
}
function step(dt, inps) {
  run.tick++;
  if (run.lvl) { coopLevelTick(dt, inps); return; }   // Koop-Level-Up: die Welt steht, bis beide gewählt haben
  // Knöpfe vor allem anderen, wie früher direkt aus dem Tasten-Handler (Teleport-Rolle ohne Zwischenbild)
  eachPlayer((p, i) => {
    const inp = inps[i] || NO_INPUT;
    if (inp.skip) skipCut();
    if (inp.dash) doDash();
    if (inp.ab0) useAbility(0);
    if (inp.ab1) useAbility(1);
  }, true);
  savePrev();
  // Boss-Szene (Auftritt, Phasenwechsel): die Welt steht, nur Kamera, Boss und Effekte laufen
  if (run.cut) { updCut(dt); updFx(dt); return; }
  run.time += dt;
  while (run.ei < run.events.length && run.time >= run.events[run.ei].t) doEvent(run.events[run.ei++]);
  eachPlayer((p, i) => {
    if (p.down) { if (!p.gone) { if (run.arena) clampToArena(p, 22); reviveTick(p, dt); } return; }   // Koop: gestürzt (in der Arena erreichbar)
    updPlayer(dt, inps[i] || NO_INPUT);
    if (P.maxHp) run.minHp = Math.min(run.minHp, P.hp / P.maxHp);
  });
  // Koop: Spawns, Sicht und Kamera um die Mitte aller Goblins (auch gestürzter: der Partner soll sie sehen und nicht weglaufen)
  if (run.players.length > 1) {
    let x = 0, y = 0, n = 0;
    for (const p of run.players) if (!p.gone) { x += p.x; y += p.y; n++; }
    run.vc = { x: x / n, y: y / n };
    // Leine: beide bleiben nah genug, dass sie auch am Handy groß im Bild sind (höchstens 2 × COOP_LEASH auseinander)
    const [hw, hh] = COOP_LEASH, c = run.vc;
    for (const p of run.players) if (!p.down) { p.x = Math.max(c.x - hw, Math.min(c.x + hw, p.x)); p.y = Math.max(c.y - hh, Math.min(c.y + hh, p.y)); }
  }
  updCamera(dt);
  if (run.over) return;
  run.lures = [];   // Strohgoblins melden sich jeden Schritt neu an (game/enemies.js)
  let world = true;   // Gestürzte: Aufladung und laufende Effekte gehen weiter, nur einsetzen können sie nichts
  eachPlayer(p => { if (p.gone) return; updAbilities(dt, world); world = false; });
  spawnTick(dt);
  buildGrid();
  // Phasenwechsel mitten im Schritt (run.cut): niemand zaubert mehr
  if (run.players.length === 1) { for (const e of run.enemies) if (!e.dead && !run.cut) updEnemy(e, dt); }
  else {
    // Koop: jeder Gegner rechnet mit dem nächsten sichtbaren Goblin als P (zielen, angreifen, Schaden). Je Goblin ein
    // Durchgang, damit nicht für jeden Gegner umgeschaltet wird; wer dabei übrig bleibt (geschubst), danach einzeln.
    const up = e => { e.ut = run.tick; updEnemy(e, dt); };
    for (let i = 0; i < run.players.length; i++) { activate(i); for (const e of run.enemies) if (!e.dead && !run.cut && e.ut !== run.tick && nearestGob(e.x, e.y, true) === i) up(e); }
    for (const e of run.enemies) if (!e.dead && !run.cut && e.ut !== run.tick) { activate(nearestGob(e.x, e.y, true)); up(e); }
    activate(0);
  }
  for (const e of run.enemies) {
    if (e.dead || e.boss || e.obj || (e.traits && e.traits.includes('float'))) continue;
    query(e.x, e.y, e.r * .9, o => {
      if (o === e) return;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || .01, ov = (e.r + o.r) * .9 - d;
      if (ov > 0) { const push = o.boss ? ov : ov * .5; e.x += dx / d * push; e.y += dy / d * push; }
    });
  }
  buildGrid();
  eachPlayer(p => { if (p.gone) return; if (!p.down) updWeapons(dt); updAllies(dt); updPProj(dt); updWfx(dt); updMegas(dt); });   // Gestürzt: keine neuen Angriffe
  updTele(dt);
  updEProj(dt);
  run.enemies = run.enemies.filter(e => !e.dead);
  if (run.over) return;   // im Schritt gestorben (Geschoss, Gefahr): Ergebnis und Spielstand sind schon geschrieben
  updItems(dt);
  updFx(dt);
  if (run.storm > 0) run.storm = run.boss ? Math.min(1, run.storm + dt * .5) : Math.max(0, run.storm - dt);
  // Ende erst, wenn die angezogenen Kristalle angekommen sind (höchstens 6 s nach „Level geschafft“)
  if (run.clearT > 0) {
    run.clearT -= dt; run.clearAge += dt;
    if (run.clearT <= 0) { if (run.clearAge < 6 && run.items.some(i => i.mag && !i.got)) run.clearT = .05; else endRun(true); }
  }
  if (!run.over && !run.paused && run.clearT <= 0 && run.lvDelay <= 0 && (run.pendingChest > 0 || run.pendingLv > 0)) {
    if (run.pendingChest > 0) { run.pendingChest--; run.lvKind = 'chest'; sfx.chest(); }
    else { run.pendingLv--; run.lvKind = 'lv'; sfx.lvl(); }
    run.lvDelay = .45; run.lvOpen = true;
    emit('levelUp', run.lvKind);   // Vibration am Handy (ui/haptics.js)
    const col = run.lvKind === 'chest' ? '#ffd84a' : '#8fe6ff';
    ring(P.x, P.y, 10, 160, .45, col, 8);
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; part(P.x, P.y - 10, Math.cos(a) * 220, Math.sin(a) * 220, .45, col, 3.5); }
  }
}
// Effekte, Partikel, Schadenszahlen, Wackeln
export function updFx(dt) {
  for (const f of run.fx) { f.t += dt; if (f.k === 'later' && f.t >= f.dur) { setSrc(f.src); setWsrc(f.ws); f.fn(); setSrc(null); setWsrc(null); } }
  run.fx = run.fx.filter(f => f.k === 'anim' ? f.t * f.fps < f.n : f.t < f.dur);
  for (const p of run.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; }
  run.parts = run.parts.filter(p => p.t < p.life);
  for (const n of run.nums) n.t += dt;
  run.nums = run.nums.filter(n => n.t < .7);
  run.shake *= Math.exp(-10 * dt); run.hurtT -= dt; run.flashT -= dt;
}

// Prüfsumme des Spielzustands (Koop: beide Seiten vergleichen sie regelmäßig, Abweichung = Lauf nicht mehr gleich).
// Zahlen bitgenau über ihre 64-bit-Darstellung, gemischt per FNV-1a.
const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
export function simHash() {
  let h = 2166136261;
  const mix = x => { f64[0] = x; h = Math.imul(h ^ u32[0], 16777619); h = Math.imul(h ^ u32[1], 16777619); };
  mix(run.tick); mix(run.time); mix(run.kills); mix(run.gold); mix(run.enemies.length);
  for (const p of run.players) { mix(p.x); mix(p.y); mix(p.hp); mix(p.lv); mix(p.xp); }   // alle Goblins, nicht P (das ist außerhalb des Schritts der eigene)
  for (const e of run.enemies) { mix(e.x); mix(e.y); mix(e.hp); }
  for (const k of ['game', 'spawn', 'loot', 'lvl']) mix(RNG[k].s);
  return h >>> 0;
}

// Positionen vor dem Schritt merken, damit der Renderer zwischen zwei Schritten interpolieren kann
export function savePrev() {
  run.cam.px = run.cam.x; run.cam.py = run.cam.y;
  for (const e of run.enemies) { e.px = e.x; e.py = e.y; }
  eachPlayer(() => {
    P.px = P.x; P.py = P.y;
    for (const a of run.allies) { a.px = a.x; a.py = a.y; }
    for (const a of run.tmpAllies) { a.px = a.x; a.py = a.y; }
  });
}

// Lauf beenden: Belohnung, Spielstand, Statistik. Die Szene zeigt danach das Ergebnis.
export function endRun(win) {
  if (run.over) return;
  activate(run.me);   // Belohnung aus der eigenen Ausrüstung (Klasse, Fähigkeiten-XP)
  run.over = true; run.paused = true;
  ensureDaily(save);   // Tagesbeginn der Aufgaben festhalten, bevor dieser Lauf irgendetwas verbucht
  const boss = !run.st.endless && run.li === LEVELS - 1;
  let bonus = win ? 25 + run.si * 20 + (boss ? 40 + run.si * 30 : 0) : 0;
  // Bonus-Level (Level-Ups nach dem Ende): siehe bonusReward (balance.js)
  const br = win && run.bonusLv ? bonusReward(run.bonusLv, run.si) : null;
  let bonusCard = null;
  if (br) {
    if (br.cards) {
      // Karte schon voll: grantCards tauscht in Gold um – das zählt hier zum Bonus-Gold (und steht im Ergebnis)
      const id = pickBonusCard(mulberry32(newSeed())), spare = grantCards(save, id, br.cards);
      save.wallet.gold -= spare; br.gold += spare; bonusCard = { id, n: br.cards, gold: spare };
    }
    bonus += br.gold;
  }
  // Albtraum (6.1): +50 % Gold und Konto-XP, Siegtruhe eine Stufe besser, erster Albtraum-Sieg je Level gibt Juwelen
  if (win && run.nm) bonus += Math.round((run.gold + bonus) * nmGold(run.nm));
  // Magierhüte (6.1a): geschafft, über 50 % Leben am Ende, nie unter 25 % gefallen
  // welche Hut-Bedingungen erfüllt sind (HAT_TXT): geschafft, über 50 % Leben, nie unter 25 %
  // Mit Weitermachen geschafft (run.cont): nur der erste Hut zählt, die Bestzeit auch nicht
  const cont = run.cont > 0;
  const hatOk = [win, win && !cont && P.hp / P.maxHp > .5, win && !cont && run.minHp >= .25], hats = hatOk.filter(Boolean).length;
  // Konto-XP (14.3) und was dadurch neu freigeschaltet wird
  const before = ABILITY_IDS.filter(canEquip);
  // Koop: als Gast in einem Level, das man selbst noch nicht freigespielt hat, gibt es Gold und XP, aber keinen Fortschritt
  const own = !run.coop || run.st.endless || (levelUnlocked(run.si, run.li) && (!run.nm || (stageCleared(run.si) && run.nm <= nmCap((stageInfo(run.si) || {}).nmMax))));
  const rec = own ? recordLevel(run.si, run.li, { win, time: run.time, hats, hatOk, kills: run.kills, endless: !!run.st.endless, nm: run.nm, noBest: cont }) : { first: false, newHats: 0, nmFirst: false };
  const xp = Math.round(accountXp({ kills: run.kills, seconds: run.time, win, firstClear: rec.first, boss: boss || !!run.st.endless }) * nmXp(run.nm) * cycleReward(run.cycle) * (1 + .05 * soulRank(save, 'c_xp'))), up = gainAccountXp(xp);
  const unlocked = ABILITY_IDS.filter(id => canEquip(id) && !before.includes(id)).map(id => ABILITIES[id].name);
  if (up && save.profile.level >= SLOT2_ACCT && save.profile.level - up < SLOT2_ACCT) unlocked.unshift('zweiter Fähigkeiten-Slot');
  const nx = rec.first && boss && nextLevel(run.si, run.li);
  if (nx) unlocked.push(STAGES[nx.si].endless ? STAGES[nx.si].name : 'Welt ' + (nx.si + 1));
  // Klassen-XP (Phase 9): so viel wie Konto-XP, für die Klasse dieses Laufs
  const clsLv0 = clsState(run.cls).lv, clsUp = gainClassXp(run.cls, xp), cls = { id: run.cls, xp, lv: clsState(run.cls).lv, up: clsUp, from: clsLv0 };
  // Neue Klasse frei (Boss der Welt besiegt)
  if (rec.first && boss) for (const id in CLASSES) if (CLASSES[id].unlock && CLASSES[id].unlock.stage === run.si + 1) unlocked.push(CLASSES[id].name);
  // Fähigkeiten-XP durch Benutzen
  const axp = 1 + .1 * soulRank(save, 'm_axp');   // Seelenbaum „Seelenfluss“
  const abil = Object.entries(run.abXp).map(([id, x]) => [id, Math.round(x * axp)]).filter(([, x]) => x > 0).map(([id, x]) => { const st0 = abilState(id).st || 0, lvUp = gainAbilXp(id, x), a = abilState(id); return { id, xp: x, lv: a.lv, up: lvUp, st: a.st || 0, star: (a.st || 0) - st0 }; });
  save.wallet.gold += run.gold + bonus;
  // Juwelen (9.2): neue Hüte, Konto-Level, Boss-Erstsieg
  const gems = rec.newHats * GEMS.hat + up * GEMS.acctLevel + (rec.first && boss ? GEMS.bossFirst(run.si) : 0) + (rec.nmFirst ? nmGems(run.nm) : 0) + (win && boss && soulRank(save, 'c_gems') ? 3 : 0) + (br ? br.gems : 0);
  save.wallet.gems += gems;
  // Siegtruhe nach jedem Boss-Level; ist das Regal voll, geht sie sofort auf
  // Boss-Trophäe (9.7, steht beim Boss in data/stages.js): beim ersten Sieg
  const tr = STAGES[run.si].boss.trophy, trophy = win && boss && tr && grantCosmetic(save, tr) ? tr : null;
  let chest = null;
  if (win && boss) {
    const type = victoryChest(run.si, run.nm);
    if (addToShelf(save, type)) chest = { type, shelf: true };
    else { const res = rollChest(type, mulberry32(newSeed()), save.pity, pityMul(save)); grantChest(save, res); chest = { type, shelf: false, res }; }
    // Seelenbaum „Runenfund“: eine seltene Rune dazu
    if (soulRank(save, 'c_rune')) { const bag = rollRuneBag(mulberry32(newSeed())), k = bag[bag.length - 1]; addRunes(save, [k]); chest.rune = k; }
  }
  const s = save.stats; s.runs++; if (win) s.wins++; s.kills += run.kills; s.playSeconds += run.time;
  s.bestKills = Math.max(s.bestKills, run.kills); s.bestLevel = Math.max(s.bestLevel, P.lv);
  for (const w of run.weapons) s.weapons[w.id] = (s.weapons[w.id] || 0) + 1;
  // Phase 11: Zähler für Wochenaufgaben, dann die Steckbriefe des Kopfgeld-Bretts (Belohnung gleich, Truhen ins Regal)
  if (win && !run.st.endless) { if (run.nm) count(run, 'nmwin'); if (hats === 3) count(run, 'hat3'); if (run.cls !== 'gob') count(run, 'clswin'); }
  mergeRun(save, run, win);
  const bounty = checkBounties(save, { win, boss, si: run.si, endless: !!run.st.endless, cont: cont, cnt: run.cnt, bossHits: run.bossHits || 0, time: run.time,
    abil: run.abil.filter(Boolean).map(s => s.id), nm: run.nm, healed: run.healed || 0, cls: run.cls, mut: run.mut });
  // Tägliche Herausforderung (Phase 12): Bestwert und Belohnung für den ersten Sieg des Tages
  const challenge = finishChallenge(save, { mode: run.mode, day: run.day, win, cont, time: run.time, kills: run.kills, si: run.si, li: run.li, mut: run.mut, abil: run.forceAbil || [] });
  const next = win && !run.mode ? nextLevel(run.si, run.li) : null;   // Herausforderung/Kopfgeld: kein „Weiter“
  if (rec.first && next) save.map = { ...save.map, si: next.si, li: next.li, fresh: true };   // Karte: der Goblin läuft zum neuen Level
  persist();
  run.result = { win, cont: run.cont || 0, bonus, gold: run.gold + bonus, gems, chest, trophy, next, hats, hatOk, newHats: rec.newHats, first: rec.first, nm: run.nm, nmFirst: rec.nmFirst, bonusLv: win ? run.bonusLv : 0, bonusGold: br ? br.gold : 0, bonusCard, xp, level: save.profile.level, up, unlocked, abil, cls, bounty, challenge };
  emit('runEnd', run.result);
}

// ---------- Weitermachen für Juwelen (Wunsch Fabi 2026-10-16, wie in Undertale) ----------
// Beim Tod: 10, 20, 40 Juwelen, höchstens 3× pro Lauf, nicht in der Endlosen Nacht. Im Bosskampf beginnt der Kampf
// von vorn, sonst geht es an Ort und Stelle weiter. Die UI (ui/continue.js) meldet sich mit setContinueHook an;
// ohne sie (Sim) oder mit run.noCont endet der Lauf wie bisher.
export const CONTINUE_GEMS = [10, 20, 40];
let contHook = null;
export function setContinueHook(fn) { contHook = fn; }
export const continueCost = () => CONTINUE_GEMS[run.cont || 0];
export function offerContinue() {
  if (!contHook || run.noCont || run.st.endless || (run.cont || 0) >= CONTINUE_GEMS.length) return false;
  run.paused = true; P.hp = 0;
  contHook(continueCost());
  return true;
}
export function doContinue() {
  const cost = continueCost();
  if (!cost || save.wallet.gems < cost) return false;
  save.wallet.gems -= cost; persist();
  run.cont = (run.cont || 0) + 1;
  P.hp = P.maxHp; P.inv = 3; run.eproj.length = 0; run.haz.length = 0;
  if (run.boss && !run.boss.dead) restartBoss();
  else {
    // an Ort und Stelle: Gegner in der Nähe werden weggestoßen, damit man Luft hat
    query(P.x, P.y, 320, e => { if (e.boss || e.obj) return; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; e.kx += (e.x - P.x) / d * 900; e.ky += (e.y - P.y) / d * 900; });
    ring(P.x, P.y, 10, 320, .5, 'rgba(255,230,120,.95)', 12);
  }
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24; part(P.x, P.y - 10, Math.cos(a) * 260, Math.sin(a) * 260, .5, i % 2 ? '#ffd84a' : '#c99cff', 4); }
  run.paused = false;
  return true;
}

// Kamera zieht weich nach und schaut in Laufrichtung voraus, beim Sprinten weiter und 4 % herausgezoomt
function updCamera(dt) {
  const c = run.cam, a = 1 - Math.pow(.85, dt * 60);
  if (run.vc) { c.x += (run.vc.x - c.x) * a; c.y += (run.vc.y - c.y) * a; c.z += (1 - c.z) * a; return; }   // Koop: Mitte, kein Vorausschauen
  const look = P.sprinting ? 40 : P.moving ? 16 : 0;
  c.x += (P.x + P.aimX * look - c.x) * a; c.y += (P.y + P.aimY * look - c.y) * a;
  c.z += ((P.sprinting ? .96 : 1) - c.z) * (1 - Math.pow(.92, dt * 60));
}
