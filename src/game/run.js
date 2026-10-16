import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { mulberry32, newSeed, seedRun } from '../core/rng.js';
import { abilState, gainAbilXp, gainAccountXp, levelDone, persist, recordLevel, save, talent } from '../core/save.js';
import { ABILITIES, ABILITY_IDS, SLOT2_ACCT } from '../data/abilities.js';
import { accountXp, bonusReward } from './balance.js';
import { TAU, isTouch } from '../core/util.js';
import { STAGES, STAGE_LEN } from '../data/stages.js';
import { LEVELS, levelStage, nextLevel } from '../data/levels.js';
import { canEquip, charmHp, initAbilities, updAbilities } from './abilities.js';
import { doEvent, spawnTick, updEnemy } from './enemies.js';
import { restartBoss, updCut } from './boss.js';
import { part, ring } from './fx.js';
import { updEProj, updTele } from './hazards.js';
import { pullable, updItems } from './items.js';
import { updPlayer } from './player.js';
import { newOfferState } from './offer.js';
import { BOONS } from '../data/weapons.js';
import { CARD_FAST, CARD_IDS, CARD_START_LV2, GEMS, passiveCardMul, victoryChest, weaponCardMul } from '../data/cards.js';
import { addToShelf, cardLv, grantCards, grantChest, pickBonusCard, rollChest } from './chests.js';
import { grantCosmetic } from './cosmetics.js';
import { ensureDaily, mergeRun } from './progress.js';
import { P, buildGrid, grid, query, run, setRun, setSrc, xpNeed } from './state.js';
import { updAllies, updPProj, updWeapons } from './weapons.js';
import { updWfx } from './weapons2.js';
import { updMegas } from './mega.js';

// Neuer Lauf: nur Spielzustand. Bildschirm, HUD und Musik macht die Szene "run".
// si = Welt (Stage), li = Level in der Welt (0–4, das letzte ist das Boss-Level)
// nm: Albtraum-Modus (6.1), nur in Welten, deren Boss schon besiegt ist
export function newRun(si, seed = newSeed(), li = 0, nm = false) {
  const st = levelStage(si, li);
  seedRun(seed);
  const r = {
    si, li: st.li, st, seed, nm: !!nm && !st.endless, mini: null, time: 0, minHp: 1, kills: 0, gold: 0, enemies: [], eproj: [], pproj: [], wfx: [], megas: [], items: [], fx: [], parts: [], nums: [], zones: [], tele: [], haz: [], graves: [], allies: [],
    weapons: [], passives: {}, boons: {}, spawnAcc: 0, spawnQ: [], ei: 0, events: [], loop: 0, boss: null, arena: null, seen: new Set(), hints: [], hintT: 0,
    rerolls: 2 + talent('reroll'), bans: 1 + talent('ban'), locks: 1, cardN: talent('xp') >= 10 ? 4 : 3, pendingLv: 0, pendingChest: 0, lowT: 0, goldT: 0, decoy: null, lvDelay: 0, lvKind: 'lv', paused: false, over: false, shake: 0, hurtT: 0, clearT: 0, flashT: 0, cut: null, storm: 0, portals: [], pillars: [], wind: null, bonusLv: 0, clearAge: 0,
  };
  const p = { x: 0, y: 0, vx: 0, vy: 0, face: 'down', moving: false, anim: 0, inv: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, aimX: 1, aimY: 0,
    hp: 0, maxHp: 0, lv: 1, xp: 0, need: xpNeed(1), rageT: 0, smokeT: 0, burrowT: 0, spinT: 0, spinSlow: 1, brew: null, shieldT: 0, shieldHp: 0, shieldMax: 1, shieldShard: 0, mechArmor: .3, mechPow: 1, mechRocket: 1.4, slowT: 0, trail: [], trailT: 0,
    stam: 100, stamMax: 100, stamDelay: 0, exhaust: false, sprinting: false, leg: 0,
    mechT: 0, mechMax: 12, gunT: 0, rocketT: 0, stepT: 0, gunA: 0, gunFlash: 0, abilReadyShown: [false, false],
    step: 0, rollT: 0, hitT: 0, exSlowT: 0, perfect: false, endAnim: 0, iceT: 0, ivx: 0, ivy: 0 };
  r.cnt = {};   // Zähler für Erfolge/Tagesaufgaben (game/progress.js)
  ensureDaily(save);
  // Kartenstufen für diesen Lauf (9.3)
  r.cards = Object.fromEntries(CARD_IDS.map(id => [id, cardLv(save, id)]));
  r.cam = { x: 0, y: 0, z: 1 }; r.hitstop = 0; r.slowT = 0; r.caster = null;
  r.offer = { ...newOfferState(), weapons: r.weapons, passives: r.passives };
  setRun(r, p);
  initAbilities();
  addEvents(0);
  grid.clear();
  recalc(); P.hp = P.maxHp; P.stam = P.stamMax;
  addWeapon('dagger');
  if (si === 0 && st.li === 0 && !levelDone(0, 0)) hint(isTouch() ? '<b>Tipp</b> Ziehe irgendwo auf dem Bildschirm zum Laufen. ' + (save.settings.lefty ? 'Links' : 'Rechts') + ' unten: Rolle, Sprint und deine Fähigkeiten.' : '<b>Tipp</b> WASD laufen · Leertaste Rolle · Shift Sprint · Q und E Fähigkeiten');
  emit('runStart', run);
}
// Feste Momente aus dem Wellen-Skript in die Zeitleiste (Endlos: je Runde erneut)
export function addEvents(loop) {
  const o = loop * (run.st.len || STAGE_LEN);
  for (const w of run.st.waves) if (w.event) run.events.push({ ...w, t: o + w.at });
}
export function recalc() {
  // Passive: Stufen im Lauf × Kartenstufe (+10 % Wirkung je Stufe)
  const pl = id => (run.passives[id] || 0) * passiveCardMul(run.cards[id] || 1), sh = talent;
  const bn = id => (1 + BOONS[id].v) ** (run.boons[id] || 0);   // Dauerboni, wenn alles ausgebaut ist (multiplikativ)
  P.dmgMult = (1 + .12 * pl('whet')) * (1 + .03 * sh('atk')) * bn('dmg');
  P.cdMult = Math.pow(.92, pl('book'));
  P.area = 1 + .12 * pl('amulet');
  P.armorMult = Math.pow(.93, pl('armor'));
  const old = P.maxHp;
  P.maxHp = (100 + 20 * pl('heart') + 6 * sh('hp')) * charmHp() * bn('hp');
  if (old) P.hp += Math.max(0, P.maxHp - old);
  P.regen = .4 * pl('herbs');
  P.speed = 165 * (1 + .08 * pl('boots')) * (1 + .02 * sh('spd'));
  P.magnet = 90 * (1 + .35 * pl('magnet')) * (1 + .06 * sh('mag'));
  P.xpMult = 1 + .03 * sh('xp');
  P.proj = 1 + .12 * pl('oil');
  P.crit = .08 + .06 * pl('powder');
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
  P.goldMult = 1 + .15 * pl('bag');
  // Sprint-Baum: Ausdauer, Erholung, Tempo, Leichtfüßig, Windschatten
  const sp = run.abMods.sprint;
  P.stamMax = 100 * (1 + .075 * sh('stam')) * (1 + .08 * sp.r.pow);
  P.stamRegen = 26 * (1 + .08 * sp.r.cd); P.sprintMul = 1.55 * (1 + .04 * sp.r.area);
  P.stamDrain = 34 * (1 - .08 * sp.s1); P.sprintMag = 1 + .15 * sp.s3; P.secondWind = sp.a; P.tireless = sp.m;
}
// Kartenstufe 5: startet auf Waffenstufe 2; Stufe 10: greift 15 % schneller an.
// Der Start auf Stufe 2 nur mit eigener Karte: legendäre Karten beginnen sonst schon auf Kartenstufe 5
export function addWeapon(id) {
  const c = run.cards[id] || 1, owned = !!save.cards[id];
  run.weapons.push({ id, lv: owned && c >= CARD_START_LV2 ? 2 : 1, evo: false, t: .3, t2: 0, a: 0, rot: 0, blades: [], card: weaponCardMul(c), fast: c >= CARD_FAST ? 1.15 : 1 });
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
// Ein fester Simulationsschritt (60 Hz, siehe core/loop.js)
export function update(dt) {
  savePrev();
  // Boss-Szene (Auftritt, Phasenwechsel): die Welt steht, nur Kamera, Boss und Effekte laufen
  if (run.cut) { updCut(dt); updFx(dt); return; }
  run.time += dt;
  while (run.ei < run.events.length && run.time >= run.events[run.ei].t) doEvent(run.events[run.ei++]);
  updPlayer(dt);
  if (P.maxHp) run.minHp = Math.min(run.minHp, P.hp / P.maxHp);
  updCamera(dt);
  if (run.over) return;
  updAbilities(dt);
  spawnTick(dt);
  buildGrid();
  for (const e of run.enemies) if (!e.dead && !run.cut) updEnemy(e, dt);   // Phasenwechsel mitten im Schritt: niemand zaubert mehr
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
  updWfx(dt);
  updMegas(dt);
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
    const col = run.lvKind === 'chest' ? '#ffd84a' : '#8fe6ff';
    ring(P.x, P.y, 10, 160, .45, col, 8);
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; part(P.x, P.y - 10, Math.cos(a) * 220, Math.sin(a) * 220, .45, col, 3.5); }
  }
}
// Effekte, Partikel, Schadenszahlen, Wackeln
export function updFx(dt) {
  for (const f of run.fx) { f.t += dt; if (f.k === 'later' && f.t >= f.dur) { setSrc(f.src); f.fn(); setSrc(null); } }
  run.fx = run.fx.filter(f => f.k === 'anim' ? f.t * f.fps < f.n : f.t < f.dur);
  for (const p of run.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .96; p.vy *= .96; }
  run.parts = run.parts.filter(p => p.t < p.life);
  for (const n of run.nums) n.t += dt;
  run.nums = run.nums.filter(n => n.t < .7);
  run.shake *= Math.exp(-10 * dt); run.hurtT -= dt; run.flashT -= dt;
}

// Positionen vor dem Schritt merken, damit der Renderer zwischen zwei Schritten interpolieren kann
export function savePrev() {
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
  if (win && run.nm) bonus += Math.round((run.gold + bonus) * .5);
  // Magierhüte (6.1a): geschafft, über 50 % Leben am Ende, nie unter 25 % gefallen
  // welche Hut-Bedingungen erfüllt sind (HAT_TXT): geschafft, über 50 % Leben, nie unter 25 %
  // Mit Weitermachen geschafft (run.cont): nur der erste Hut zählt, die Bestzeit auch nicht
  const cont = run.cont > 0;
  const hatOk = [win, win && !cont && P.hp / P.maxHp > .5, win && !cont && run.minHp >= .25], hats = hatOk.filter(Boolean).length;
  // Konto-XP (14.3) und was dadurch neu freigeschaltet wird
  const before = ABILITY_IDS.filter(canEquip);
  const rec = recordLevel(run.si, run.li, { win, time: run.time, hats, hatOk, kills: run.kills, endless: !!run.st.endless, nm: run.nm, noBest: cont });
  const xp = Math.round(accountXp({ kills: run.kills, seconds: run.time, win, firstClear: rec.first, boss: boss || !!run.st.endless }) * (run.nm ? 1.5 : 1)), up = gainAccountXp(xp);
  const unlocked = ABILITY_IDS.filter(id => canEquip(id) && !before.includes(id)).map(id => ABILITIES[id].name);
  if (up && save.profile.level >= SLOT2_ACCT && save.profile.level - up < SLOT2_ACCT) unlocked.unshift('zweiter Fähigkeiten-Slot');
  const nx = rec.first && boss && nextLevel(run.si, run.li);
  if (nx) unlocked.push(STAGES[nx.si].endless ? STAGES[nx.si].name : 'Welt ' + (nx.si + 1));
  // Fähigkeiten-XP durch Benutzen
  const abil = Object.entries(run.abXp).map(([id, x]) => [id, Math.round(x)]).filter(([, x]) => x > 0).map(([id, x]) => { const lvUp = gainAbilXp(id, x); return { id, xp: x, lv: abilState(id).lv, up: lvUp }; });
  save.wallet.gold += run.gold + bonus;
  // Juwelen (9.2): neue Hüte, Konto-Level, Boss-Erstsieg
  const gems = rec.newHats * GEMS.hat + up * GEMS.acctLevel + (rec.first && boss ? GEMS.bossFirst(run.si) : 0) + (rec.nmFirst ? GEMS.nightmare : 0) + (br ? br.gems : 0);
  save.wallet.gems += gems;
  // Siegtruhe nach jedem Boss-Level; ist das Regal voll, geht sie sofort auf
  // Boss-Trophäe (9.7, steht beim Boss in data/stages.js): beim ersten Sieg
  const tr = STAGES[run.si].boss.trophy, trophy = win && boss && tr && grantCosmetic(save, tr) ? tr : null;
  let chest = null;
  if (win && boss) {
    const type = victoryChest(run.si, run.nm);
    if (addToShelf(save, type)) chest = { type, shelf: true };
    else { const res = rollChest(type, mulberry32(newSeed()), save.pity); grantChest(save, res); chest = { type, shelf: false, res }; }
  }
  const s = save.stats; s.runs++; if (win) s.wins++; s.kills += run.kills; s.playSeconds += run.time;
  s.bestKills = Math.max(s.bestKills, run.kills); s.bestLevel = Math.max(s.bestLevel, P.lv);
  for (const w of run.weapons) s.weapons[w.id] = (s.weapons[w.id] || 0) + 1;
  mergeRun(save, run, win);
  const next = win ? nextLevel(run.si, run.li) : null;
  if (rec.first && next) save.map = { ...save.map, si: next.si, li: next.li, fresh: true };   // Karte: der Goblin läuft zum neuen Level
  persist();
  run.result = { win, cont: run.cont || 0, bonus, gold: run.gold + bonus, gems, chest, trophy, next, hats, hatOk, newHats: rec.newHats, first: rec.first, nm: run.nm, nmFirst: rec.nmFirst, bonusLv: win ? run.bonusLv : 0, bonusGold: br ? br.gold : 0, bonusCard, xp, level: save.profile.level, up, unlocked, abil };
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
  const c = run.cam, look = P.sprinting ? 40 : P.moving ? 16 : 0;
  const a = 1 - Math.pow(.85, dt * 60);
  c.x += (P.x + P.aimX * look - c.x) * a; c.y += (P.y + P.aimY * look - c.y) * a;
  c.z += ((P.sprinting ? .96 : 1) - c.z) * (1 - Math.pow(.92, dt * 60));
}
