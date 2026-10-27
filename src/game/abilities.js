import { emit } from '../core/events.js';
import { pullAll, pullable } from './items.js';
import { count } from './progress.js';
import { ROLL_T } from './player.js';
import { RNG, frand, rand, rnd, pick } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { save, stageCleared } from '../core/save.js';
import { trailCol } from '../data/cosmetics.js';
import { ABILITIES, MOVE_IDS, SLOT2_ACCT, STAR_COLS, abilMods, abilityUnlocked, xpPerUse } from '../data/abilities.js';
import { COMBOS, COMBO_GEMS, COMBO_T, comboOf } from '../data/combos.js';
import { classOf, hasPerk } from '../data/classes.js';
import { hurt } from './combat.js';
import { addItem, addNum, animFx, boltFx, dropGem, explode, igniteOil, later, part, puff, ring } from './fx.js';
import { runeMods } from './runes.js';
import { H, W, ZOOM } from '../render/canvas.js';
import { TAU } from '../core/util.js';
import { P, abSrc, nearest, onScreen, pR, query, randomEnemyInView, run, setSrc } from './state.js';
import { shootRaw, stepAlly } from './weapons.js';
import { recalc } from './run.js';
import { banner } from '../ui/hud.js';

// ---------- Fähigkeiten: 2 Slots (PLAN 8) ----------
// run.abil[i] = { id, ch, need } – ch läuft von 0 bis need, je nach Aufladeart (data/abilities.js)
// Laufende Effekte (Fallen, Pilzring, Ratten, Zeitbombe) liegen in run.abfx.

// Baum-Werte der Fähigkeit in diesem Lauf (Kraft, Tempo, Reichweite, Extras a/b), siehe data/abilities.js
const NOMOD = abilMods(null);
const M = id => (run.abMods && run.abMods[id]) || NOMOD;
// Stoß im Kreis: Schaden an allen in r, Rückstoß kb vom Mittelpunkt weg
function blast(x, y, r, dmg, kb, col) {
  query(x, y, r, e => { const d = Math.hypot(e.x - x, e.y - y) || 1; hurt(e, dmg, kb, (e.x - x) / d, (e.y - y) / d, col); });
}
function needOf(id) {
  const A = ABILITIES[id], m = M(id), k = m.spd * (1 - ((run.runes[id] || {}).haste || 0));   // Eilrune
  if (A.charge === 'once') return A.need;
  return A.charge === 'cd' ? A.need * k : Math.max(1, Math.round(A.need * k));   // Kills, Schrott: ganze Zahl
}
export const slotOpen = i => i === 0 || save.profile.level >= SLOT2_ACCT;
export const canEquip = id => save.keep.includes(id) || abilityUnlocked(id, save.profile.level, stageCleared);

export function initAbilities() {
  run.abMods = {}; run.abXp = {}; run.runes = {};
  for (const id of save.loadout) {
    if (!id) continue;
    const m = run.abMods[id] = abilMods(save.abilities[id]), rn = runeMods(save, id);
    // Runen (Phase 10): Wucht und Weite wirken wie Baum-Punkte auf Kraft und Fläche/Dauer
    if (Object.keys(rn).length) { run.runes[id] = rn; m.pow *= 1 + (rn.might || 0); m.area *= 1 + (rn.wide || 0); }
  }
  run.dotOn = Object.values(run.runes).some(r => r.fire || r.poison);
  // Rolle und Sprint sind immer dabei und haben eigene Bäume
  for (const id of MOVE_IDS) run.abMods[id] = abilMods(save.abilities[id]);
  // max: Aufladungen (Doppelhaken), stock: gespeicherte volle Ladungen außer der laufenden
  run.abil = save.loadout.map((id, i) => id && slotOpen(i) && canEquip(id) ? { id, ch: ABILITIES[id].charge === 'once' ? (M(id).a ? 2 : 1) : 0, need: needOf(id), max: id === 'hook' && M(id).m ? 2 : 1, stock: 0 } : null);
  run.abfx = []; run.tmpAllies = []; run.trapRolls = 0; run.rageExt = 0; run.lastAbil = null;
  initMoves();
}
export const abilReady = s => !!s && (s.ch >= s.need || s.stock > 0) && ABILITIES[s.id].charge !== 'once';
// Wie viele Einsätze bereitliegen (für die Zahl am Knopf)
export const abilCount = s => s.stock + (s.ch >= s.need ? 1 : 0);

// ---------- Was zusammen geht (Wunsch Fabi) ----------
// Alle Paare geprüft (PLAN Phase 5): Nur die Goblin-Maschine verträgt sich nicht mit dem Rest.
// Haken und Rolle würden den Mech durch die Luft werfen, Schild, Pilzring und Katapult stapeln sich
// mit seinem Panzer und Arsenal. Solange sie läuft, sind andere Fähigkeiten, Rolle und Sprint gesperrt.
// Alles andere ist gewollt (z. B. Zeitbombe + Großer Knall, Rauch + Haken, Ruf + Wut).
// Umgekehrt startet die Maschine nicht mitten in Rolle oder Hakenflug, und ein laufender Schild endet,
// wenn man einsteigt (der Panzer ersetzt ihn).
// id: Fähigkeit oder 'dash'/'sprint'. Gibt den Grund zurück, '' = frei.
export const lockOf = id => id === 'mech' ? (P.dashT > 0 ? 'Mitten im Sprung' : '') : P.mechT > 0 ? 'In der Maschine' : '';
function lockedBuzz(why) {
  if (run.time - (run.lockBuzz ?? -1) < .4) return;
  run.lockBuzz = run.time; addNum(P.x, P.y - 52, why, '#c9c2b0', false); sfx.buzz();
}
export const hasAbil = id => run.abil.some(s => s && s.id === id);
// Schutzgeist: mehr Leben, solange das Amulett noch eine Rettung hat
export function charmHp() { const s = run.abil && run.abil.find(x => x && x.id === 'charm'); return s && s.ch >= 1 ? 1 + .03 * M('charm').s3 : 1; }
// Wird bei jedem Kill aufgerufen (combat.js): Blutdurst, Kettenwut, Schrottsammler, Goldader
export function onKill(e) {
  if (P.rageT > 0 && run.abMods.rage) {
    const m = M('rage');
    if (m.s1 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + m.s1);
    if (m.s3 && run.rageExt < 4) { const x = Math.min(.1 * m.s3, 4 - run.rageExt); run.rageExt += x; P.rageT += x; }
  }
  if (P.mechT > 0 && M('mech').s3) { const s = run.abil.find(x => x && x.id === 'mech'); if (s) s.ch = Math.min(s.need, s.ch + s.need * .004 * M('mech').s3); }
  if (run.totem && M('totem').s1 && !e.boss && (e.x - run.totem.x) ** 2 + (e.y - run.totem.y) ** 2 < 400 * 400 && RNG.loot.next() < .1 * M('totem').s1) addItem('coin', e.x, e.y);
  const rn = RN(abSrc); if (rn && !e.obj) runeKill(e, rn);
}
// Schaden, den der Spieler nimmt: Berserker, Ausweichen beim Sprinten, Goldener Schutz. 0 = geschluckt
export function takenMult() {
  let k = 1;
  if (P.rageT > 0 && M('rage').m) k *= .7;
  if (P.sprinting) k *= 1 - .06 * M('sprint').s2;
  // Dickes Fell (Goblin-Groll): solange die Ladung voll ist
  if (M('grudge').b) { const s = run.abil.find(x => x && x.id === 'grudge'); if (s && s.ch >= s.need) k *= .8; }
  if (run.goldT > 0 && M('totem').m && run.totem) {
    if (run.gold - run.totem.gold >= 25) { run.totem.gold += 25; addNum(P.x, P.y - 40, 'Goldschutz', '#ffd84a', false); return 0; }
  }
  return k;
}
// Schaden, den Gegner nehmen: Hinterhalt, Widerhaken/Sporen; Glücksbringer erhöht kritische Treffer
// Racheblick (Groll): markierter Gegner nimmt doppelt; Riesentrank (Hexenkessel): +40 %
export const dealtMult = e => (P.ambushT > 0 ? 2 : 1) * (e.vulnT > 0 ? 1 + e.vuln : 1) * (e.foeT > run.time ? 2 : 1) * (P.brew && P.brew.giant > 0 ? 1 + .4 * P.brew.k : 1);
export const critBonus = () => (run.goldT > 0 ? .04 * M('totem').s2 : 0) + ((RN(abSrc) || {}).luck || 0);
export const xpBonus = () => (run.goldT > 0 ? 1 + .1 * M('totem').s3 : 1);

// Kills und Schrott laden die passenden Slots
export function chargeAbil(kind, n) {
  for (const s of run.abil) {
    if (!s || ABILITIES[s.id].charge !== kind) continue;
    if (kind === 'scrap' && P.mechT > 0 && s.id === 'mech') continue;   // die Maschine lädt sich nicht selbst
    s.ch = Math.min(s.need, s.ch + n);
  }
}

const USE = {
  rage: doRage, mech: startMech, trap: layTraps, smoke: throwSmoke, catapult: fireCatapult, hook: throwHook,
  shroom: growShrooms, shield: raiseShield, rats: releaseRats, call: callGoblins, totem: raiseTotem, timebomb: dropTimebomb, bigbang: bigBang,
  oilcask: pourOil, burrow: digIn, cannon: fireCannon, decoy: placeDecoy, turret: buildTurret,
  spin: startSpin, grudge: unleashGrudge, scrapmag: startMagnet, bees: releaseBees, brew: brewPotion,
};
export function useAbility(i) {
  const s = run && run.abil[i];
  if (!s || run.paused || run.over || run.cut || !abilReady(s)) return false;
  const why = lockOf(s.id); if (why) { lockedBuzz(why); return false; }
  const prev = setSrc(s.id);
  try {
    if (USE[s.id](M(s.id)) === false) return false;
    echoRune(s.id);
    checkCombo(s.id);
    starFx(s.id);
  } finally { setSrc(prev); }
  if (s.stock > 0) s.stock--; else s.ch = 0;
  run.abXp[s.id] = (run.abXp[s.id] || 0) + xpPerUse(s.id);   // XP durch Benutzen, gutgeschrieben am Laufende
  count(run, 'abil');
  emit('abilUse', { i, id: s.id });   // Rückmeldung am Knopf (ui/hud.js)
  return true;
}

export function updAbilities(dt) {
  run.lures = [];   // Strohgoblins melden sich jeden Schritt neu an (game/enemies.js)
  for (const s of run.abil) {
    if (!s || ABILITIES[s.id].charge !== 'cd') continue;
    s.ch = Math.min(s.need, s.ch + dt);
    if (s.ch >= s.need && s.stock < s.max - 1) { s.stock++; s.ch = 0; }
  }
  setSrc('mech'); updMech(dt); setSrc(null); updMoves(dt); setSrc('brew'); updBrew(dt); setSrc(null);
  updDots(dt);
  // Ewiger Stock: bis zum nächsten Einsatz alle 15 s ein kleiner Schwarm
  if (run.hive && (run.hive.t -= dt) <= 0) { run.hive.t = 15; setSrc('bees'); swarmOf(M('bees'), 10, ABILITIES.bees.dur * .6); setSrc(null); }
  if (P.smokeT > 0) { P.smokeT -= dt; if (P.smokeT <= 0) smokeEnd(M('smoke')); }
  if (P.ambushT > 0) P.ambushT -= dt;
  if (P.shieldT > 0) {
    P.shieldT -= dt;
    if (P.shieldT <= 0 || P.shieldHp <= 0) {
      // Nachladen: ungebrochen abgelaufen → Abklingzeit kürzer
      const m = M('shield'), s = run.abil.find(x => x && x.id === 'shield');
      if (P.shieldHp > 0 && m.s2 && s) s.ch = Math.min(s.need, s.ch + s.need * .1 * m.s2);
      P.shieldT = 0; P.bladeT = 0; puff(P.x, P.y - 10, 1, 'rgba(200,205,210,.8)'); if (P.shieldShard) { setSrc('shield'); shieldShards(); setSrc(null); }
    }
  }
  if (run.goldT > 0) { run.goldT -= dt; if (run.goldT <= 0) run.totem = null; }
  for (const f of run.abfx) { f.t += dt; setSrc(FX_SRC[f.k]); FX_UPD[f.k](f, dt); }
  setSrc(null);
  run.abfx = run.abfx.filter(f => !f.done);
  // Verwirrte Gegner (Rauchbombe) schlagen auf Nachbarn ein
  for (const e of run.enemies) {
    if (!(e.confT > 0) || e.dead) continue;
    e.confT -= dt; e.confHit = (e.confHit || 0) - dt;
    if (e.confHit <= 0) { e.confHit = .5; query(e.x, e.y, 40, o => { if (o !== e && !o.boss) { hurt(o, 6 + e.dmg, 0, 0, 0, '#c9b6ff'); return false; } }); }
  }
  // Goblin-Ruf: Krieger auf Zeit
  setSrc('call');
  run.tmpAllies.forEach((al, i) => {
    al.t -= dt; stepAlly(al, i, run.tmpAllies.length, (13 + P.lv * .8) * P.dmgMult * al.pow, 260 * al.spd, (P.rageT > 0 ? 1.6 : 1) * al.rate, dt, .3);   // gegen Große 30 %, sonst legen die Krieger den Boss allein um
    if (al.t <= 0) {
      al.done = true; puff(al.x, al.y, .6);
      // Letzter Hieb: Krieger explodieren beim Gehen
      if (al.boom) { blast(al.x, al.y, 70, al.boom, 200, '#9be36a'); ring(al.x, al.y, 6, 70, .3, 'rgba(160,230,100,.9)', 5); }
    }
  });
  setSrc(null);
  run.tmpAllies = run.tmpAllies.filter(a => !a.done);
}

// ---------- Rolle und Sprint (immer dabei, eigene Bäume, PLAN 8.4) ----------
// Rolle hat Ladungen (Zweite/Dritte Ladung); die Abklingzeit lädt eine Ladung nach der anderen nach.
export const dashCdOf = () => 2.4 * (1 - .06 * M('dash').r.pow);
// Klassen (Phase 9): Salto/Teleport statt Rolle, Sturmangriff statt Sprint; Klassen-Level 12: +1 Ladung
function initMoves() {
  const d = M('dash'), C = classOf(run.cls);
  P.dashKind = C.dash; P.sprintKind = C.sprint;
  P.dashMax = (d.m ? 3 : d.a ? 2 : 1) + (hasPerk(run.clsLv || 1, 'charge') ? 1 : 0); P.dashN = P.dashMax; P.dashCd = 0; P.perfectR = 1 + .15 * d.s1;
  P.hasteT = 0; P.haste = 0; P.ambushT = 0; P.sprintT = 0; P.goldGuard = 0; P.rollHit = null;
}
// Kurz schneller laufen (Schwung, Schattenschritt); der stärkere Schub gewinnt
function haste(t, k) { if (P.hasteT > 0 && P.haste > k) return; P.hasteT = t; P.haste = k; }
function updMoves(dt) {
  if (P.dashN < P.dashMax) { P.dashCd -= dt; if (P.dashCd <= 0) { P.dashN++; P.dashCd = P.dashN < P.dashMax ? dashCdOf() : 0; } }
  if (P.hasteT > 0) P.hasteT -= dt;
  const d = M('dash'), s = M('sprint');
  // Staubwolke: Gegner, durch die man rollt, fliegen weg (der Enterhaken setzt auch dashT, aber kein rollHit)
  if (P.dashT <= 0) P.rollHit = null;
  if (P.dashT > 0 && P.rollHit) query(P.x, P.y, pR() + 14, e => {
    if (P.rollHit.has(e) || e.obj) return; P.rollHit.add(e);
    const dd = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 10 * d.s2 * P.dmgMult, 420, (e.x - P.x) / dd, (e.y - P.y) / dd, '#e6d7a8');
  });
  // Rammbock: kleine Gegner, in die man sprintet (Sturmangriff des Kriegers: immer)
  if (P.sprinting && (s.b || P.sprintKind === 'charge')) query(P.x, P.y, pR() + 8, e => {
    if (e.boss || e.elite || e.miniboss || e.obj || e.ramT > run.time) return; e.ramT = run.time + .6;
    const dd = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, (20 + P.lv * 2) * P.dmgMult, 520, (e.x - P.x) / dd, (e.y - P.y) / dd, '#ffd84a');
    run.shake = Math.max(run.shake, 3); sfx.stomp();
  });
  if (P.sprinting) run.abXp.sprint = (run.abXp.sprint || 0) + xpPerUse('sprint') * dt;
}

export function doDash() {
  if (!run || run.paused || run.over || run.cut || P.dashN <= 0 || P.dashT > 0) return;
  const why = lockOf('dash'); if (why) { lockedBuzz(why); return; }
  const d = M('dash'), sp = 900 * (1 + .08 * d.r.cd), sx = P.x, sy = P.y;   // Startpunkt (Teleport versetzt sofort)
  P.dashN--; if (P.dashCd <= 0) P.dashCd = dashCdOf();
  P.dashT = .18; P.inv = Math.max(P.inv, .3 + .06 * d.r.area);
  P.dvx = P.aimX * sp; P.dvy = P.aimY * sp;
  P.rollT = ROLL_T; P.perfect = false; P.trailT = 0; P.rollHit = d.s2 ? new Set() : null;
  if (P.dashKind === 'flip') {
    // Salto (Bogen-Goblin): weg vom nächsten Gegner, dabei fünf Pfeile auf ihn
    const t = nearest(320), a = t ? Math.atan2(P.y - t.y, P.x - t.x) : Math.atan2(P.aimY, P.aimX), back = a + Math.PI;
    P.dashT = .22; P.dvx = Math.cos(a) * sp * .85; P.dvy = Math.sin(a) * sp * .85;
    for (let i = 0; i < 5; i++) shootRaw('arrow', back + (i - 2) * .16, (8 + P.lv * .6) * P.dmgMult, 1, 760 * P.proj, .7, { r: 10 });
    sfx.throw();
  } else if (P.dashKind === 'blink') {
    // Teleport (Magier-Goblin): sofort ein Stück in Laufrichtung; das kurze dashT hält die Unverwundbarkeit und die perfekte Rolle
    const go = 200 * (1 + .08 * d.r.cd);
    for (let i = 0; i < 10; i++) part(P.x + frand(-12, 12), P.y + frand(-30, 10), frand(-40, 40), frand(-80, -20), .4, '#c9a8ff', frand(3, 6));
    P.x += P.aimX * go; P.y += P.aimY * go; P.dashT = .12; P.dvx = 0; P.dvy = 0; P.rollT = 0;
    ring(P.x, P.y - 8, 6, 60, .3, 'rgba(200,170,255,.9)', 5);
  }
  if (d.s3) haste(1.2 + .18, .1 * d.s3);
  // Krähenfüße bleiben am Startpunkt liegen
  if (d.b) run.abfx.push({ k: 'caltrop', x: sx, y: sy + 10, r: 48, t: 0, dur: 2.5, tick: 0, dmg: (8 + P.lv) * P.dmgMult, seed: Math.random() * 100 });
  // Fallensteller (Meister der Bärenfalle): jede 3. Rolle legt eine Falle
  if (hasAbil('trap') && M('trap').m && ++run.trapRolls % 3 === 0) layTraps(M('trap'), 1);
  run.abXp.dash = (run.abXp.dash || 0) + xpPerUse('dash'); count(run, 'rolls');
  for (let i = 0; i < 8; i++) part(P.x + frand(-10, 10), P.y + 16, -P.aimX * 90 + frand(-40, 40), frand(-50, -10), .4, trailCol(save.look.trail), frand(4, 7));
  sfx.dash();
}

// Perfekte Rolle: durch ein Geschoss gerollt → kurze Zeitlupe, Glitzer, +5 Kills für Kill-Fähigkeiten
export function perfectRoll(x, y) {
  if (P.perfect) return;
  P.perfect = true; run.slowT = .15;
  chargeAbil('kills', 5 + 2 * M('dash').s1);
  if (M('grudge').s2) chargeAbil('hurt', 5 * M('grudge').s2);   // Brodeln
  run.abXp.dash = (run.abXp.dash || 0) + 2; count(run, 'perfect');
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; part(x, y, Math.cos(a) * 160, Math.sin(a) * 160, .4, i % 2 ? '#fff6b0' : '#8fe6ff', 2.8); }
  addNum(P.x, P.y - 52, 'Perfekt!', '#8fe6ff', true);
  sfx.perfect();
}

// ---------- Goblin-Wut ----------
function doRage(m) {
  P.rageT = (ABILITIES.rage.dur + (m.a ? 3 : 0)) * m.area;
  const dmg = (40 + P.lv * 6) * P.dmgMult * m.pow;
  if (m.b) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .2 * m.pow); addNum(P.x, P.y - 40, '+' + Math.round(P.maxHp * .2 * m.pow), '#7dff7a'); }
  const R = 380 * (1 + .12 * m.s2), kb = 700 * (1 + .12 * m.s2);
  run.rageExt = 0;
  blast(P.x, P.y, R, dmg, kb, '#ff8a5c');
  for (const p of run.eproj) if (Math.hypot(p.x - P.x, p.y - P.y) < R) p.life = 0;
  ring(P.x, P.y, 10, R, .55, 'rgba(255,90,50,.95)', 16); ring(P.x, P.y, 10, R * .8, .4, 'rgba(255,220,90,.9)', 8);
  run.shake = 16; sfx.ult(); banner('Goblin-Wut!', 'danger');
}

// ---------- Goblin-Maschine ----------
export function startMech(m = NOMOD) {
  if (P.mechT > 0) return false;
  P.shieldT = 0; P.shieldHp = 0; P.shieldShard = 0;
  P.mechMax = P.mechT = 12 * m.area;
  P.mechArmor = m.a ? .15 : .3; P.mechPow = m.pow; P.mechRocket = m.b ? .7 : 1.4;
  P.gunT = 0; P.rocketT = .6; P.stepT = 0; P.inv = Math.max(P.inv, .6); P.slowT = 0;
  ring(P.x, P.y, 10, 160, .5, 'rgba(230,170,60,.95)', 10);
  for (let i = 0; i < 16; i++) part(P.x + frand(-30, 30), P.y + frand(-20, 20), frand(-120, 120), frand(-160, -40), .6, 'rgba(220,220,220,.8)', frand(5, 9));
  blast(P.x, P.y, 120, 30 * P.dmgMult, 500);
  run.shake = 10; sfx.mechOn(); banner('Goblin-Maschine!', '');
}
function updMech(dt) {
  if (P.mechT <= 0) return;
  P.mechT -= dt; P.gunFlash -= dt; P.stepT -= dt;
  if (P.moving && P.stepT <= 0) {
    P.stepT = .36; P.leg ^= 1;
    const fx = P.x + (P.leg ? 15 : -15), fy = P.y + 18, boots = 1 + .25 * M('mech').s2, sr = 55 * P.area * boots;
    blast(fx, fy, sr, 13 * P.dmgMult * boots, 160);
    ring(fx, fy, 6, sr, .3, 'rgba(210,190,150,.8)', 5);
    for (let i = 0; i < 4; i++) part(fx, fy, frand(-60, 60), frand(-40, -5), .4, 'rgba(200,185,150,.8)', 5);
    run.shake = Math.max(run.shake, 2.5); sfx.stomp();
  }
  const t = nearest(470);
  if (t) P.gunA = Math.atan2(t.y - (P.y - 24), t.x - P.x);
  P.gunT -= dt;
  if (t && P.gunT <= 0) {
    P.gunT = .085 / (1 + .12 * M('mech').s1);
    const side = Math.cos(P.gunA) >= 0 ? 1 : -1, gx = P.x + side * 28 + Math.cos(P.gunA) * 34, gy = P.y - 22 + Math.sin(P.gunA) * 34;
    const a = P.gunA + rand(-.07, .07);
    run.pproj.push({ k: 'bullet', x: gx, y: gy, a, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, dmg: 9 * P.dmgMult * P.mechPow, pierce: 0, life: .7, hit: new Set(), r: 8, t: 0, src: abSrc });
    P.gunFlash = .04; sfx.gun();
  }
  P.rocketT -= dt;
  if (P.rocketT <= 0) {
    P.rocketT = P.mechRocket;
    const c = randomEnemyInView(0);
    if (c.length) {
      for (let i = 0; i < 4; i++) {
        const e = pick(c), a = -Math.PI / 2 + (i - 1.5) * .5;
        run.pproj.push({ k: 'rocket', x: P.x - 10, y: P.y - 50, a, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, target: e, dmg: 30 * P.dmgMult * P.mechPow, rad: 60 * P.area, pierce: 0, life: 2.2, hit: new Set(), r: 10, t: 0, src: abSrc });
      }
      sfx.rocket();
    }
  }
  if (Math.random() < dt * 14) { const side = Math.cos(P.gunA) >= 0 ? -1 : 1; part(P.x + side * 18, P.y - 62, frand(-10, 10), frand(-70, -40), .9, 'rgba(90,90,95,.55)', frand(6, 10)); }
  if (P.mechT <= 0) {
    const over = M('mech').m, R = 200 * P.area * (over ? 1.4 : 1);   // Überladung
    blast(P.x, P.y, R, 90 * P.dmgMult * (over ? 2 : 1), 600, '#ffb35c');
    animFx('f_fireball_hit_', 5, P.x, P.y - 20, 6); ring(P.x, P.y, 10, R, .5, 'rgba(255,170,60,.95)', 14);
    for (let i = 0; i < 24; i++) part(P.x, P.y - 20, frand(-260, 260), frand(-300, 60), frand(.4, .9), i % 2 ? '#c9973a' : '#6d747c', frand(4, 8));
    P.inv = 1; run.shake = 16; sfx.boom(); sfx.ult(); banner('Maschine explodiert!', '');
  }
}

// ---------- Bärenfalle ----------
// n: Anzahl (Fallensteller legt eine einzelne Falle unter dich)
function layTraps(m, n = m.a ? 4 : 3) {
  for (let i = 0; i < n; i++) {
    const a = i * TAU / n + run.time, x = n > 1 ? P.x + Math.cos(a) * 55 : P.x, y = n > 1 ? P.y + Math.sin(a) * 45 : P.y + 12;
    trapAt(x, y, m);
  }
  sfx.throw();
}
function trapAt(x, y, m) {
  run.abfx.push({ k: 'trap', x, y, t: 0, dur: 20 * m.area, snap: 0, uses: 3 + m.s1, hold: 1.6 + .4 * m.s2, lure: m.s3 ? 20 + 30 * m.s3 : 0, lureT: 0,
    dmg: (70 + P.lv * 8) * P.dmgMult * m.pow, splash: (m.b ? 110 : 70) * m.area, sf: m.b ? 1 : .5 });
  puff(x, y, .5, 'rgba(160,140,110,.8)');
}

// ---------- Rauchbombe ----------
function throwSmoke(m) {
  P.smokeT = (ABILITIES.smoke.dur + (m.a ? 2 : 0)) * m.area; run.decoy = { x: P.x, y: P.y };
  if (m.b) run.abfx.push({ k: 'gas', x: P.x, y: P.y, r: 150 * m.area, t: 0, dur: P.smokeT, tick: 0, dmg: (20 + P.lv * 3) * P.dmgMult * m.pow });
  for (let i = 0; i < 26; i++) part(P.x + frand(-50, 50), P.y + frand(-30, 30), frand(-60, 60), frand(-70, -10), frand(.8, 1.4), i % 2 ? 'rgba(120,120,130,.7)' : 'rgba(180,180,190,.6)', frand(10, 18));
  for (const e of run.enemies) if (!e.dead && !e.boss && !e.obj && onScreen(e.x, e.y) && RNG.game.chance(.35 + .12 * m.s2)) { e.confT = P.smokeT; e.confHit = rand(0, .5); }
  sfx.puh(); banner('Verschwunden!', '');
}

// Rauch verzogen: Schattenschritt (schneller laufen), Hinterhalt (doppelter Schaden)
function smokeEnd(m) {
  if (m.s3) haste(m.s3, .2);
  if (m.m) { P.ambushT = 1.5; addNum(P.x, P.y - 52, 'Hinterhalt!', '#c9b6ff', true); }
}

// Dichteste Gegnergruppe im Bild (Katapult, Kanone); maxD: höchstens so weit vom Goblin
function densest(maxD = 1e9) {
  const c = randomEnemyInView(0).filter(e => (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < maxD * maxD);
  let best = null, bn = -1;
  for (const e of c) { let n = 0; for (const o of c) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 90 * 90) n++; if (n > bn) { bn = n; best = e; } }
  return best;
}

// ---------- Goblin-Katapult ----------
function fireCatapult(m, pow = 1) {
  const best = densest();
  const tx = best ? best.x : P.x + P.aimX * 200, ty = best ? best.y : P.y + P.aimY * 200;
  for (let i = 0; i < (m.a ? 8 : 5); i++) {
    const a = rand(0, TAU), r = i ? rand(20, 80) * m.area : 0;
    run.tele.push({ k: 'boulder', sx: P.x - 30, sy: P.y - 40, x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, t: -i * .12, dur: .7 / (1 + .15 * m.s2), rad: 85 * P.area * m.area, dmg: (100 + P.lv * 10) * P.dmgMult * m.pow * pow, burn: m.b, shards: m.s1, stun: .3 * m.s3, src: abSrc });
  }
  // Dauerfeuer: 2 s später eine zweite Salve mit halbem Schaden
  if (m.m && pow === 1) run.abfx.push({ k: 'volley', t: 0, dur: 2 });
  sfx.throw();
}

// ---------- Enterhaken ----------
function throwHook(m) {
  const e = nearest(m.a ? 600 : 380), far = m.a ? 350 : 220;
  const tx = e ? e.x : P.x + P.aimX * far, ty = e ? e.y : P.y + P.aimY * far;
  const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1, stop = e ? e.r + 18 : 0, go = Math.max(0, d - stop), T = .2;
  P.dashT = T; P.dvx = dx / d * go / T; P.dvy = dy / d * go / T; P.inv = Math.max(P.inv, T + .2);
  P.rollT = ROLL_T; P.perfect = false; P.trailT = 0; P.rollHit = null;
  run.abfx.push({ k: 'hook', x: P.x, y: P.y, tx, ty, t: 0, dur: .3, land: (40 + P.lv * 6) * P.dmgMult * m.pow, r: 100 * m.area, stun: m.b, roll: .3 * m.s3 });
  // Kleine Gegner am Ziel werden zu dir gerissen; Widerhaken: sie nehmen danach mehr Schaden
  query(tx, ty, 150 * (1 + .2 * m.s2), o => {
    if (o.boss || o.elite || o.miniboss || o.obj) return;
    const ox = P.x - o.x, oy = P.y - o.y, od = Math.hypot(ox, oy) || 1; o.kx += ox / od * 700; o.ky += oy / od * 700;
    if (m.s1) { o.vulnT = 3; o.vuln = Math.max(o.vuln || 0, .15 * m.s1); }
    hurt(o, 15 * P.dmgMult);
  });
  sfx.whoosh();
}

// ---------- Pilzring ----------
function growShrooms(m) {
  run.abfx.push({ k: 'shroom', x: P.x, y: P.y, r: 120 * P.area * m.area * (m.a ? 1.4 : 1), t: 0, dur: ABILITIES.shroom.dur * m.area, heal: .05 * m.pow, tick: 0, dmg: m.b ? (15 + P.lv * 2) * P.dmgMult * m.pow : 0,
    vuln: .08 * m.s1, slowK: .5 - .1 * m.s2, sprout: m.s3, follow: m.m });
  sfx.heal();
}

// ---------- Schrottschild ----------
function raiseShield(m) {
  P.shieldT = ABILITIES.shield.dur * m.area; P.shieldMax = P.shieldHp = P.maxHp * (m.a ? .6 : .4) * m.pow; P.shieldShard = m.b ? (40 + P.lv * 6) * P.dmgMult * m.pow : 0;
  P.shieldFullT = m.m ? 1 : 0;   // Bollwerk: die erste Sekunde schluckt alles
  ring(P.x, P.y - 10, 10, 50, .35, 'rgba(200,210,220,.9)', 6); sfx.mechOn();
}
// Bollwerk: mit Schild keine Verlangsamung
export const bulwark = () => P.shieldT > 0 && M('shield').m;
// Dornen: Nahkämpfer, die den Schild treffen
export function shieldThorns(e) {
  const k = M('shield').s3;
  if ((!k && !(P.bladeT > run.time)) || !(P.shieldT > 0) || e.thornT > run.time) return;
  e.thornT = run.time + .4; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1, prev = setSrc('shield'); if (k) hurt(e, 10 * k * P.dmgMult, 200, (e.x - P.x) / d, (e.y - P.y) / d, '#dfe6ea'); setSrc(prev);
  if (P.bladeT > run.time) { const prev2 = setSrc('spin'); hurt(e, (30 + P.lv * 3) * P.dmgMult, 260, (e.x - P.x) / d, (e.y - P.y) / d, '#dfe6ea'); setSrc(prev2); }   // Klingenschild (Kombo)
}
// Splitterschild: beim Brechen oder Ende fliegen Splitter um dich
function shieldShards() {
  const dmg = P.shieldShard; P.shieldShard = 0;
  blast(P.x, P.y, 160, dmg, 300, '#dfe6ea');
  for (let i = 0; i < 14; i++) { const a = i * TAU / 14; part(P.x, P.y - 10, Math.cos(a) * 260, Math.sin(a) * 260, .4, '#c9d1d8', 4); }
  ring(P.x, P.y, 10, 160, .35, 'rgba(220,225,230,.9)', 6); sfx.stomp();
}
// Schaden zuerst gegen den Schild; gibt den Rest zurück
export function shieldAbsorb(d) {
  if (!(P.shieldT > 0)) return d;
  if (P.shieldT > ABILITIES.shield.dur * M('shield').area - P.shieldFullT) { addNum(P.x, P.y - 40, 'Bollwerk', '#dfe6ea', false); return 0; }
  const a = Math.min(d, P.shieldHp); P.shieldHp -= a;
  if (a > 0) addNum(P.x, P.y - 40, 'Schild', '#dfe6ea', false);
  return d - a;
}
// Geschoss prallt vom Schild zurück
export function reflect(p) {
  const sp = Math.hypot(p.vx, p.vy) || 400, a = Math.atan2(-p.vy, -p.vx);
  run.pproj.push({ k: 'bullet', x: p.x, y: p.y, a, vx: Math.cos(a) * sp * 1.3, vy: Math.sin(a) * sp * 1.3, dmg: 20 * P.dmgMult * (1 + .3 * M('shield').s1), pierce: 1, life: 1.2, hit: new Set(), r: 10, t: 0, src: 'shield' });
  sfx.ezap();
}

// ---------- Rattenflut ----------
function releaseRats(m) {
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM, dir = RNG.game.chance(.5) ? 1 : -1, rats = [];
  for (let i = 0; i < (m.a ? 60 : 40); i++) rats.push({ x: P.x - dir * (hw + 30 + rand(0, 260)), y: P.y + rand(-hh, hh), sp: rand(380, 480), hit: new Map(), a: frand(0, 6) });   // a: nur Lauf-Animation
  run.abfx.push({ k: 'rats', dir, rats, t: 0, dur: 3.2, r: 16 * m.area, dmg: (30 + P.lv * 2) * P.dmgMult * m.pow, pest: m.b,
    bites: 1 + m.s1, loot: m.s2 ? 30 + 20 * m.s2 : 0, plague: m.s3 ? (4 + P.lv * .5) * m.s3 * P.dmgMult : 0, sick: [], sickT: 0, back: m.m });
  sfx.warn(); banner('Rattenflut!', '');
}

// ---------- Goblin-Ruf ----------
function callGoblins(m) {
  const n = m.a ? 10 : 8, pow = m.pow * (1 + .12 * m.s1), spd = 1 + .12 * m.s2, rate = 1 + .06 * m.s2, boom = m.s3 ? 20 * m.s3 * P.dmgMult : 0;
  if (m.b) P.rageT = Math.max(P.rageT, 2.5);
  const add = (a, r, big) => { run.tmpAllies.push({ ally: true, tmp: true, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, face: 'down', at: 0, atk: 0, slash: 0, sa: 0, moving: false, off: a, t: ABILITIES.call.dur * m.area, pow: big ? pow * 2 : pow, spd, rate, boom, big }); puff(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, big ? 1 : .6); };
  for (let i = 0; i < n; i++) add(i * TAU / n, 50, false);
  if (m.m) add(0, 0, true);   // Häuptling
  sfx.ult(); banner('Goblin-Ruf!', '');
}

// ---------- Totem der Gier ----------
function raiseTotem(m) {
  if (m.b) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .25 * m.pow); addNum(P.x, P.y - 40, '+' + Math.round(P.maxHp * .25 * m.pow), '#7dff7a'); }
  pullAll();
  run.goldT = (ABILITIES.totem.dur + (m.a ? 5 : 0)) * m.area;
  run.totem = { x: P.x, y: P.y, gold: run.gold };
  ring(P.x, P.y, 10, 320, .6, 'rgba(255,215,80,.9)', 8); sfx.chest(); banner('Doppeltes Gold!', '');
}

// ---------- Zeitbombe ----------
function dropTimebomb(m) {
  const list = [], R = 240 * P.area * m.area * (m.a ? 1.3 : 1);
  const dur = ABILITIES.timebomb.dur + .5 * m.s1;
  query(P.x, P.y, R, e => { if (e.boss) { e.slowT = dur; return; } e.freezeT = Math.max(e.freezeT, dur); e.tb = 0; e.tbShock = m.b; list.push(e); });
  for (const p of run.eproj) if ((p.x - P.x) ** 2 + (p.y - P.y) ** 2 < R * R) p.life = 0;   // Zeit steht auch für Geschosse still
  run.abfx.push({ k: 'tb', x: P.x, y: P.y, r: R, pow: m.pow, list, t: 0, dur, boom: 80 * (1 + .2 * m.s2), shards: m.s3, loop: m.m });
  ring(P.x, P.y, 10, R, .4, 'rgba(150,220,255,.9)', 10); sfx.frost();
}

// ---------- Großer Knall ----------
function bigBang(m) {
  const dmg = (300 + P.lv * 20) * P.dmgMult * m.pow, o = { stun: m.b, big: 1 + .15 * m.s1, quake: m.s2, xp: 1 + .2 * m.s3 };
  bang(dmg, o);
  if (m.a) run.abfx.push({ k: 'echo', t: 0, dur: 1, dmg: dmg * .5, o });
  // Nachhall: die Aufladung startet bei 30 %
  if (m.m) run.abfx.push({ k: 'refill', t: 0, dur: 0, id: 'bigbang', p: .3 });
  banner('Großer Knall!', 'danger');
}
function bang(dmg, o) {
  for (const e of run.enemies) {
    if (e.dead || !onScreen(e.x, e.y)) continue;
    const big = e.boss || e.elite || e.miniboss ? o.big : 1;
    // Kristallregen: Gegner, die der Knall tötet, geben mehr XP
    hurt(e, (e.boss ? dmg * .4 : dmg) * big, 300, 0, 0, '#ffe08a', e.boss ? 1 : o.xp);
    if (e.dead) continue;
    if (o.stun && !e.boss) e.freezeT = Math.max(e.freezeT, 1.5);
    if (o.quake) e.slowT = Math.max(e.slowT, o.quake);
  }
  run.flashT = .4; run.shake = 22; sfx.boom(); sfx.ult();
}

// ---------- Goblin-Amulett: einmal wieder aufstehen ----------
export function tryRevive() {
  const s = run.abil.find(x => x && x.id === 'charm' && x.ch >= 1);
  if (!s) return false;
  const m = M('charm'), R = 300 * (1 + .15 * m.s2);
  s.ch--; if (m.s3) recalc();   // Schutzgeist endet, wenn das Amulett verbraucht ist
  P.hp = P.maxHp * (m.b ? 1 : .5); P.inv = 2 + .5 * m.s1;
  if (m.m) P.rageT = Math.max(P.rageT, 5);   // Wiedergeburt
  run.abXp.charm = (run.abXp.charm || 0) + xpPerUse('charm');
  const prev = setSrc('charm'); blast(P.x, P.y, R, 50 * P.dmgMult * (1 + .5 * m.s2), 800, '#ffd84a'); setSrc(prev);
  for (const p of run.eproj) p.life = 0;
  ring(P.x, P.y, 10, R, .6, 'rgba(255,215,80,.95)', 14); run.shake = 14; run.slowT = .4;
  sfx.ult(); banner('Das Amulett rettet dich!', '');
  return true;
}

// Stärkere Verlangsamung für 0,25 s (slowK = Tempo-Faktor); eine schwächere überschreibt sie nicht
function slowAt(e, k) { e.slowK = e.slowKT > run.time ? Math.min(e.slowK, k) : k; e.slowKT = run.time + .25; }

// ---------- Ölfass (Phase 10) ----------
const LAKE_T = 4;   // so lange brennt der Flammensee
const oilFx = (x, y, r, dur, m) => ({ k: 'oil', x, y, r, t: 0, dur, lit: -1, self: m.b ? 2 : 0, slowK: Math.max(.2, .5 - .1 * m.s1), fall: .05 * m.s3, tick: 0, fallT: 1,
  burn: (18 + P.lv * 2.5) * P.dmgMult * m.pow * (1 + .2 * m.s2), seed: Math.random() * 100 });
function pourOil(m) {
  const dur = ABILITIES.oilcask.dur * m.area, R = 110 * P.area * m.area * (m.a ? 1.4 : 1);
  run.abfx.push(oilFx(P.x + P.aimX * 90, P.y + P.aimY * 70, R, dur, m));
  if (m.m) run.abfx.push({ k: 'oilTrail', t: 0, dur, tick: 0, m });   // Ölquelle
  for (let i = 0; i < 10; i++) part(P.x + P.aimX * 40, P.y + P.aimY * 30, P.aimX * 160 + frand(-60, 60), P.aimY * 120 + frand(-60, 20), .4, 'rgba(40,32,24,.85)', frand(4, 7));
  sfx.throw();
}

// ---------- Maulwurfsgang ----------
function quake(x, y, r, dmg, stun) {
  query(x, y, r, e => { const d = Math.hypot(e.x - x, e.y - y) || 1; hurt(e, dmg, 520, (e.x - x) / d, (e.y - y) / d, '#c9a26a'); if (stun && !e.boss && !e.dead) e.freezeT = Math.max(e.freezeT, 1); });
  ring(x, y, 10, r, .4, 'rgba(170,130,80,.9)', 10);
  for (let i = 0; i < 18; i++) part(x + frand(-30, 30), y + frand(-10, 10), frand(-220, 220), frand(-260, -60), frand(.4, .7), i % 2 ? '#7a5a36' : '#a8865a', frand(4, 8));
  run.shake = Math.max(run.shake, 9); sfx.stomp(); sfx.boom();
}
function digIn(m) {
  const dur = (ABILITIES.burrow.dur + .4 * m.s2) * m.area, dmg = (60 + P.lv * 7) * P.dmgMult * m.pow * (1 + .15 * m.s1), r = 130 * P.area * m.area;
  P.burrowT = dur; P.inv = Math.max(P.inv, dur + .2); haste(dur, .4); run.decoy = { x: P.x, y: P.y };
  run.abfx.push({ k: 'burrow', t: 0, dur, dmg, r, stun: m.b, gems: 2 * m.s3, spikes: m.a, spikeT: 0 });
  if (m.m) quake(P.x, P.y, r * .8, dmg * .6, false);   // Doppelstoß
  else { for (let i = 0; i < 12; i++) part(P.x + frand(-14, 14), P.y + 14, frand(-120, 120), frand(-160, -40), .5, '#7a5a36', frand(4, 7)); sfx.stomp(); }
}

// ---------- Goblin-Kanone ----------
function fireCannon(m, second = false) {
  const reach = (second ? 260 : 440) * (1 + .15 * m.s2), g = densest(reach);
  const tx = g ? g.x : P.x + P.aimX * reach * .6, ty = g ? g.y : P.y + P.aimY * reach * .6;
  const dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy) || 1, T = Math.max(.25, Math.min(.5, d / 900));
  P.dashT = T; P.dvx = dx / T; P.dvy = dy / T; P.inv = Math.max(P.inv, T + .35);
  P.rollT = ROLL_T; P.perfect = true; P.trailT = 0; P.rollHit = null;   // perfect = true: der Flug ist keine perfekte Rolle
  run.abfx.push({ k: 'cannon', t: 0, dur: T, hit: new Set(), w: 30 * (1 + .15 * m.s2), path: (25 + P.lv * 2.5) * P.dmgMult * m.pow,
    land: (120 + P.lv * 12) * P.dmgMult * m.pow * (1 + .12 * m.s1) * (second ? .6 : 1), r: 150 * P.area * m.area * (second ? .75 : 1),
    fire: m.b, fireT: 0, bounce: m.s3, again: m.a && !second, salvo: m.m && !second, m });
  if (!second) run.abfx.push({ k: 'cannonGun', x: P.x, y: P.y, a: Math.atan2(dy, dx), t: 0, dur: .9 });
  for (let i = 0; i < 12; i++) part(P.x, P.y - 10, dx / d * 120 + frand(-60, 60), dy / d * 120 + frand(-80, 0), .6, 'rgba(200,200,205,.75)', frand(7, 12));
  sfx.boom();
}
function cannonLand(f) {
  blast(P.x, P.y, f.r, f.land, 650, '#ffb35c');
  // Abprall: die nächsten Gegner fliegen besonders weit
  if (f.bounce) { const near = []; query(P.x, P.y, f.r, e => { if (!e.boss && !e.obj && !e.dead) near.push(e); }); near.sort((a, b) => ((a.x - P.x) ** 2 + (a.y - P.y) ** 2) - ((b.x - P.x) ** 2 + (b.y - P.y) ** 2)); for (const e of near.slice(0, f.bounce)) { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; e.kx += (e.x - P.x) / d * 1400; e.ky += (e.y - P.y) / d * 1400; } }
  animFx('f_fireball_hit_', 5, P.x, P.y - 10, 4); ring(P.x, P.y, 10, f.r, .45, 'rgba(255,170,60,.95)', 12);
  run.shake = Math.max(run.shake, 12); sfx.boom();
  if (f.again) run.abfx.push({ k: 'refire', t: 0, dur: .2, m: f.m });
  // Kanonade: drei Mini-Kugeln neben dir
  if (f.salvo) for (let i = 0; i < 3; i++) { const a = rand(0, TAU), r = rand(70, 150), x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r, dmg = f.land * .35; later(.25 + i * .18, () => { blast(x, y, 80 * P.area, dmg, 400, '#ffb35c'); animFx('f_fireball_hit_', 5, x, y - 10, 2); sfx.boom(); }); }
}

// ---------- Strohgoblin ----------
function placeDecoy(m) {
  const n = m.a ? 2 : 1, a0 = Math.atan2(P.aimY, P.aimX);
  for (let i = 0; i < n; i++) {
    const a = n > 1 ? a0 + (i ? 1 : -1) * 1.2 : a0, x = P.x + Math.cos(a) * 80, y = P.y + Math.sin(a) * 60;
    run.abfx.push({ k: 'decoy', x, y, t: 0, dur: ABILITIES.decoy.dur * m.area, hp: P.maxHp * .6 * (1 + .2 * m.s1) * m.pow, taken: 0, lure: 260 * (1 + .15 * m.s2), boom: .5 * (1 + .2 * m.s3),
      thorns: m.b ? (12 + P.lv) * P.dmgMult * m.pow : 0, mirror: m.m, dagT: 0, r: 18, hitT: 0 });
    puff(x, y, .8, 'rgba(230,200,120,.8)');
  }
  sfx.throw();
}

// ---------- Flammenturm ----------
function buildTurret(m) {
  const n = m.a ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const off = n > 1 ? (i ? 1 : -1) * 55 : 0;
    run.abfx.push({ k: 'turret', x: P.x + off, y: P.y + 34, t: 0, dur: (ABILITIES.turret.dur + 2 * m.s3) * m.area, range: 260 * (1 + .15 * m.s2), dmg: (5 + P.lv * .75) * P.dmgMult * m.pow * (1 + .12 * m.s1),
      blue: m.b, follow: m.m, off, tick: 0, a: -Math.PI / 2, beam: null });
    puff(P.x + off, P.y + 34, .8, 'rgba(200,200,205,.8)');
  }
  sfx.mechOn();
}

// ---------- Wirbelaxt ----------
function startSpin(m) {
  const dur = (ABILITIES.spin.dur + .4 * m.s2) * m.area;
  P.spinT = dur; P.spinSlow = 1 - .2 * (1 - .33 * m.s3);
  run.abfx.push(spinFx(m, dur, null));
  sfx.whoosh();
}
const spinFx = (m, dur, at) => ({ k: 'spin', t: 0, dur, at, tick: 0, every: .25 / (1 + .15 * m.s3), r: 95 * P.area * m.area, dmg: (12 + P.lv * 1.5) * P.dmgMult * m.pow * (1 + .12 * m.s1),
  pull: m.a, wind: m.b && !at, tornado: m.m && !at, m, a: 0 });

// ---------- Goblin-Groll ----------
function unleashGrudge(m) {
  const taken = ABILITIES.grudge.need / 100 * P.maxHp, R = 300 * P.area * m.area;
  blast(P.x, P.y, R, 4 * taken * P.dmgMult * m.pow * (1 + .4 * m.s1), 600, '#ff7a3c');
  const heal = P.maxHp * (.15 + .05 * m.s3) * m.pow; P.hp = Math.min(P.maxHp, P.hp + heal); addNum(P.x, P.y - 40, '+' + Math.round(heal), '#7dff7a');
  // Racheblick: wer zuletzt traf, nimmt 5 s doppelten Schaden
  if (m.a && run.foe && !run.foe.dead) { run.foe.foeT = run.time + 5; addNum(run.foe.x, run.foe.y - 40, 'Rache!', '#ff7a3c', true); }
  if (m.m) { P.inv = Math.max(P.inv, 3); run.abfx.push({ k: 'refill', t: 0, dur: 0, id: 'grudge', p: .3 }); }
  for (let i = 0; i < 3; i++) ring(P.x, P.y, 10, R * (1 - i * .2), .5 + i * .1, i ? 'rgba(255,200,60,.9)' : 'rgba(255,90,40,.95)', 14 - i * 4);
  for (let i = 0; i < 30; i++) { const a = i * TAU / 30; part(P.x, P.y - 10, Math.cos(a) * 340, Math.sin(a) * 250, .5, i % 2 ? '#ff7a3c' : '#ffd84a', 5); }
  run.shake = 16; sfx.ult(); sfx.boom(); banner('Goblin-Groll!', 'danger');
}

// ---------- Schrottmagnet ----------
function startMagnet(m) {
  run.abfx.push({ k: 'magnet', t: 0, dur: (ABILITIES.scrapmag.dur + (m.a ? 1.5 : 0)) * m.area, r: 420 * P.area * m.area, pull: 620 * (1 + .15 * m.s1), elite: m.s1 > 0, gems: m.b,
    boom: (80 + P.lv * 9) * P.dmgMult * m.pow * (1 + .2 * m.s2), vuln: .1 * m.s3, flip: m.m, got: new Set() });
  sfx.mechOn();
}

// ---------- Bienenstock ----------
function releaseBees(m) {
  run.hive = m.m ? { t: 15 } : null;   // Ewiger Stock bis zum nächsten Einsatz
  swarmOf(m, 25 + 4 * m.s2, ABILITIES.bees.dur * m.area, m.a);
  if (m.b) run.abfx.push({ k: 'honey', x: P.x, y: P.y + 8, r: 90 * P.area * m.area, t: 0, dur: 6 * m.area });
  sfx.warn(); banner('Bienenstock!', '');
}
function swarmOf(m, n, dur, queen = false) {
  const bees = [];
  for (let i = 0; i < n + (queen ? 1 : 0); i++) { const a = rand(0, TAU); bees.push({ x: P.x + Math.cos(a) * 20, y: P.y - 20 + Math.sin(a) * 14, tgt: null, hitT: rand(0, .4), q: queen && i === n, a: rand(0, 6) }); }   // a bewegt die Biene: Seed-Zufall
  run.abfx.push({ k: 'bees', bees, t: 0, dur, spd: 260 * (1 + .1 * m.s3), dmg: (5 + P.lv * .5) * P.dmgMult * m.pow * (1 + .12 * m.s1), sick: new Set(), sickT: .5 });
}

// ---------- Hexenkessel ----------
export const POTIONS = ['giant', 'swift', 'fire', 'heal', 'gold'];
export const POTION_INFO = { giant: ['Riesentrank!', '#e5a03a'], swift: ['Flinktrank!', '#7fd8ff'], fire: ['Feuertrank!', '#ff6a1f'], heal: ['Heiltrank!', '#7dff7a'], gold: ['Goldtrank!', '#ffd84a'] };
function brewPotion(m) {
  const dur = (ABILITIES.brew.dur + m.s2) * m.area, k = m.pow * (1 + .1 * m.s1);
  // Lieblingsrezept: die erste Sorte im Lauf kommt danach doppelt so oft (Zufall aus dem Spielablauf: Sim bleibt gleich)
  const pick1 = () => { const pool = m.b && run.favPotion ? [...POTIONS, run.favPotion] : POTIONS; return pool[Math.floor(RNG.game.next() * pool.length)]; };
  let got = RNG.game.next() < (m.m ? .1 : 0) ? [...POTIONS] : [pick1()];
  if (m.a && got.length === 1) { let p2 = pick1(); for (let i = 0; i < 3 && p2 === got[0]; i++) p2 = pick1(); got.push(p2); }
  if (!run.favPotion) run.favPotion = got[0];
  P.brew = P.brew || { giant: 0, swift: 0, fire: 0, heal: 0, gold: 0, k: 1, fireT: 0, stompT: 0 };
  P.brew.k = k;
  for (const p of got) {
    P.brew[p] = dur;
    if (p === 'swift') haste(dur, .5 * k);
    if (p === 'heal') { const h = P.maxHp * .4 * k; P.hp = Math.min(P.maxHp, P.hp + h); addNum(P.x, P.y - 40, '+' + Math.round(h), '#7dff7a'); }
  }
  // Übersprudeln: kochender Sud spritzt um dich
  if (m.s3) blast(P.x, P.y, 120 * P.area, (30 + P.lv * 3) * m.s3 * P.dmgMult * m.pow, 260, '#9cf06a');
  run.abfx.push({ k: 'kettle', x: P.x + 26, y: P.y + 12, t: 0, dur: 1.1, cols: got.map(p => POTION_INFO[p][1]) });
  banner(got.length > 2 ? 'Meistertrank!' : got.map(p => POTION_INFO[p][0]).join(' + '), '');
  sfx.heal();
}
function updBrew(dt) {
  const b = P.brew; if (!b) return;
  for (const p of POTIONS) if (b[p] > 0) b[p] -= dt;
  if (b.heal > 0 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .02 * b.k * dt);
  // Riese stampft
  if (b.giant > 0 && (b.stompT -= dt) <= 0) { b.stompT = .6; const r = 90 * P.area; blast(P.x, P.y, r, (20 + P.lv * 2) * P.dmgMult * b.k, 260, '#e5a03a'); ring(P.x, P.y + 10, 6, r, .3, 'rgba(230,170,80,.8)', 6); run.shake = Math.max(run.shake, 3); }
  // Feuer spucken: Kegel zum nächsten Gegner
  if (b.fire > 0 && (b.fireT -= dt) <= 0) {
    b.fireT = .2; const t = nearest(200), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
    for (let i = 1; i <= 4; i++) { const x = P.x + Math.cos(a) * 38 * i, y = P.y - 14 + Math.sin(a) * 38 * i; query(x, y, 14 + 6 * i, e => { hurt(e, (5 + P.lv * .6) * P.dmgMult * b.k, 40, Math.cos(a), Math.sin(a), '#ff8a3c'); }); igniteOil(x, y, 10); }
    for (let i = 0; i < 6; i++) part(P.x + Math.cos(a) * 20, P.y - 16 + Math.sin(a) * 20, Math.cos(a + frand(-.3, .3)) * frand(200, 320), Math.sin(a + frand(-.3, .3)) * frand(200, 320), .45, Math.random() < .5 ? '#ffb02e' : '#ff5a1f', frand(5, 9));
  }
}
export const potionGiant = () => !!(P.brew && P.brew.giant > 0);

// ---------- Runen im Lauf (Phase 10) ----------
// run.runes[id] = { fire: .25, bolt: .15, jumps: 1, … } (game/runes.js runeMods). Die Quelle eines Treffers ist abSrc (state.js).
const RN = id => (id && run.runes && run.runes[id]) || null;
// Welche Fähigkeit hinter einem laufenden Effekt steckt (Krähenfüße gehören zur Rolle: keine Runen).
// Neue Effekte hier eintragen – fehlt einer, bricht das Spiel beim Laden ab (Prüfung unter FX_UPD)
const FX_SRC = { spin: 'spin', magnet: 'scrapmag', bees: 'bees', honey: 'bees', kettle: 'brew', oil: 'oilcask', oilTrail: 'oilcask', burrow: 'burrow', spike: 'burrow',
  cannon: 'cannon', refire: 'cannon', cannonGun: 'cannon', decoy: 'decoy', turret: 'turret', trap: 'trap', gas: 'smoke', echo: 'bigbang', refill: null, volley: 'catapult',
  caltrop: null, hook: 'hook', shroom: 'shroom', rats: 'rats', tb: 'timebomb' };
// Brand-, Gift- und Blitzschaden lösen keine Runen aus (und treffen nicht kritisch), sonst schaukelt es sich auf
let procLock = false;
export const inProc = () => procLock;
// Nach einem Treffer der Fähigkeit abSrc (combat.js hurt). base = Schaden vor Krit und Multiplikatoren:
// Brand, Gift und Blitz laufen wieder durch hurt() und bekommen die Multiplikatoren dort (nicht doppelt)
export function runeHit(e, base) {
  const r = RN(abSrc); if (!r || procLock || e.obj) return;
  if (!e.dead) {
    // t mit kleinem Puffer: der letzte Tick (bei 2,0 s bzw. 4,0 s) soll trotz Rundung noch kommen
    if (r.fire) { const b = e.burn; e.burn = { dps: Math.max(b ? b.dps : 0, base * r.fire), t: 2.05, src: abSrc }; if (!(e.dotT > 0)) e.dotT = .5; }
    if (r.poison) { const p = e.psn; e.psn = { n: Math.min(5, (p ? p.n : 0) + 1), dps: Math.max(p ? p.dps : 0, base * r.poison), t: 4.05, src: abSrc }; if (!(e.dotT > 0)) e.dotT = .5; }
    // Bosse nicht: ihr Tempo kennt nur „verlangsamt ja/nein“ (−40 %, boss.js), Dauertreffer hielten sie sonst ständig fest
    if (r.frost && !e.boss) frostAt(e, 1 - r.frost, 1.5);
  }
  if (r.bolt && rnd() < r.bolt) chainBolt(e, base * .5, r.jumps || 1);
}
// Verlangsamen für t s; eine stärkere laufende Verlangsamung bleibt
function frostAt(e, k, t) {
  const cur = e.slowT > 0 ? (e.slowKT > run.time ? e.slowK : .5) : 1;
  if (k > cur) return;
  e.slowK = k; e.slowKT = run.time + t; e.slowT = Math.max(e.slowT, t);
}
// Blitz springt auf die nächsten Gegner (wie der Blitzstab, game/weapons.js)
function chainBolt(e, dmg, n) {
  procLock = true;
  try {
    const hit = new Set([e]); let cur = e;
    for (let j = 0; j < n; j++) {
      let nx = null, nd = 160 * 160;
      query(cur.x, cur.y, 160, o => { if (hit.has(o) || o.obj) return; const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d < nd) { nd = d; nx = o; } });
      if (!nx) break;
      boltFx(cur.x, cur.y - 10, nx.x, nx.y - 10, 2.5, '#fff38a'); hurt(nx, dmg, 0, 0, 0, '#fff38a'); hit.add(nx); cur = nx;
    }
  } finally { procLock = false; }
}
// Kill durch die Fähigkeit: Blut heilt (höchstens 3 % pro Sekunde), Gier wirft Münzen, Seele lädt die andere Fähigkeit
function runeKill(e, r) {
  if (r.blood && P.hp > 0 && P.hp < P.maxHp) {
    const sec = Math.floor(run.time); if (run.bloodSec !== sec) { run.bloodSec = sec; run.bloodGot = 0; }
    const h = Math.min(P.maxHp * r.blood, P.maxHp * .03 - run.bloodGot);
    if (h > 0) { run.bloodGot += h; P.hp = Math.min(P.maxHp, P.hp + h); }
  }
  if (r.greed && RNG.loot.next() < r.greed) addItem('coin', e.x, e.y);
  if (r.soul) for (const s of run.abil) if (s && s.id !== abSrc && ABILITIES[s.id].charge !== 'once') s.ch = Math.min(s.need, s.ch + s.need * r.soul);
}
// Echo: 0,5 s später noch einmal mit halber Kraft (later merkt sich die Quelle)
function echoRune(id) {
  const r = RN(id); if (!r || !r.echo || rnd() >= r.echo) return;
  const m = M(id), half = { ...m, pow: m.pow * .5 };
  later(.5, () => { if (run.over || run.cut || !hasAbil(id)) return; USE[id](half); addNum(P.x, P.y - 64, 'Echo!', '#c9a8ff', true); });
}
// Brand und Gift ticken alle 0,5 s (erst ticken, dann ablaufen lassen); Kills daraus zählen für Blut, Gier und Seele.
// Nur wenn eine Feuer- oder Giftrune steckt (run.dotOn), sonst nicht jeden Schritt alle Gegner durchgehen
function updDots(dt) {
  if (!run.dotOn) return;
  for (const e of run.enemies) {
    if (!e.burn && !e.psn) continue;
    if (e.dead) { e.burn = e.psn = null; continue; }
    if ((e.dotT -= dt) <= 0) {
      e.dotT += .5;
      const fire = e.burn ? e.burn.dps : 0, pois = e.psn ? e.psn.dps * e.psn.n : 0;
      const prev = setSrc((e.burn || e.psn).src); procLock = true;
      try { hurt(e, (fire + pois) * .5, 0, 0, 0, fire >= pois ? '#ff9a3c' : '#9cf06a'); } finally { procLock = false; setSrc(prev); }
      part(e.x + frand(-10, 10) * e.sc, e.y - frand(8, 30) * e.sc, frand(-15, 15), frand(-70, -30), .45, fire >= pois ? '#ff7a2e' : '#9cf06a', frand(4, 7));
      if (e.dead) continue;
    }
    if (e.burn && (e.burn.t -= dt) <= 0) e.burn = null;
    if (e.psn && (e.psn.t -= dt) <= 0) e.psn = null;
  }
}

// Sterne (Phase 10): Glanz in der Sternfarbe beim Einsatz; 5 Sterne = Regenbogen (nur Optik, Zufall über frand)
const RAINBOW = ['#ff5d55', '#ffb02e', '#f4d03f', '#7dff7a', '#6fb7ff', '#c27cff'];
function starFx(id) {
  const n = (save.abilities[id] && save.abilities[id].st) || 0; if (!n) return;
  const col = i => (n >= 5 ? RAINBOW[i % RAINBOW.length] : STAR_COLS[n - 1]);
  ring(P.x, P.y, 14, 70 + n * 12, .4, n >= 5 ? 'rgba(255,255,255,.9)' : STAR_COLS[n - 1], 4 + n);
  for (let i = 0; i < 6 + n * 4; i++) { const a = frand(0, TAU), v = frand(80, 200); part(P.x, P.y - 14, Math.cos(a) * v, Math.sin(a) * v - 40, .55, col(i), frand(2.5, 4.5)); }
}

// ---------- Kombos (Phase 10, data/combos.js) ----------
// Die zweite Fähigkeit eines Paars höchstens COMBO_T s nach der ersten löst den Zusatz aus. Danach beginnt die Zählung neu
// (keine Ketten aus einem Einsatz). Erstes Entdecken: Banner, Juwelen, Eintrag im Kombo-Buch (save.combos).
function checkCombo(id) {
  const last = run.lastAbil, k = last && last.id !== id && run.time - last.t <= COMBO_T ? comboOf(last.id, id) : null;
  if (!k) { run.lastAbil = { id, t: run.time }; return; }
  run.lastAbil = null;
  COMBO_FX[k]();
  count(run, 'combo');
  const C = COMBOS[k];
  if (!save.combos.includes(k)) { save.combos.push(k); save.wallet.gems += COMBO_GEMS; banner(`Kombo entdeckt: ${C.name}! +${COMBO_GEMS} Juwelen`, ''); sfx.ding(); }
  else addNum(P.x, P.y - 70, C.name + '!', '#ffd84a', true);
  ring(P.x, P.y, 10, 220, .45, 'rgba(255,216,74,.95)', 10);
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; part(P.x, P.y - 10, Math.cos(a) * 240, Math.sin(a) * 240, .45, i % 2 ? '#ffd84a' : '#fff6b0', 3.5); }
}
const live = k => run.abfx.filter(f => f.k === k && !f.done);
const COMBO_FX = {
  poisontrap() { for (const f of live('trap')) run.abfx.push({ k: 'gas', x: f.x, y: f.y, r: 110 * P.area, t: 0, dur: 5, tick: 0, dmg: (20 + P.lv * 3) * P.dmgMult }); },
  inferno() { for (const f of live('oil')) igniteOil(f.x, f.y, 1); for (const f of live('turret')) if (!f.inferno) { f.inferno = true; f.dmg *= 1.5; } },
  implosion() { later(.6, () => { const R = 360 * P.area; blast(P.x, P.y, R, (300 + P.lv * 20) * P.dmgMult * .5, 500, '#ffe08a'); ring(P.x, P.y, R, 10, .5, 'rgba(255,224,138,.95)', 14); run.shake = Math.max(run.shake, 12); sfx.boom(); }); },
  bullseye() { run.tele.push({ k: 'boulder', sx: P.x - 30, sy: P.y - 60, x: P.x, y: P.y, t: 0, dur: .8, rad: 170 * P.area, dmg: (250 + P.lv * 25) * P.dmgMult, burn: false, shards: 0, stun: .5, src: abSrc }); },
  whirlhook() { query(P.x, P.y, 380, e => { if (e.boss || e.obj) return; const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * 900; e.ky += dy / d * 900; }); },
  warfrenzy() { for (const al of run.tmpAllies) if (!al.frenzy) { al.frenzy = true; al.pow *= 1.5; al.spd *= 1.3; al.rate *= 1.3; } P.rageT = Math.max(P.rageT, 3); },
  icerink() { for (const f of live('oil')) { query(f.x, f.y, f.r, e => { if (!e.boss && !e.obj) e.freezeT = Math.max(e.freezeT, 2); else e.slowT = Math.max(e.slowT, 2); }); ring(f.x, f.y, 10, f.r, .4, 'rgba(150,220,255,.95)', 8); } sfx.frost(); },
  baittrap() { const m = M('trap'); for (const f of live('decoy')) trapAt(f.x, f.y + 8, m); },
  plague() {
    run.dotOn = true;
    for (const e of run.enemies) {
      if (e.dead || e.obj || !onScreen(e.x, e.y)) continue;
      const p = e.psn; e.psn = { n: Math.min(5, (p ? p.n : 0) + 3), dps: Math.max(p ? p.dps : 0, (5 + P.lv * .5) * P.dmgMult), t: 4.05, src: abSrc }; if (!(e.dotT > 0)) e.dotT = .5;
      e.slowT = Math.max(e.slowT, 2);
    }
  },
  witchkitchen() { const h = P.maxHp * .25; P.hp = Math.min(P.maxHp, P.hp + h); addNum(P.x, P.y - 40, '+' + Math.round(h), '#7dff7a'); brewPotion(M('brew')); },
  bladeshield() { if (P.shieldT > 0) { P.shieldHp *= 1.5; P.shieldMax *= 1.5; P.bladeT = run.time + P.shieldT; } },
  quakebomb() { let n = 0; for (const f of live('tb')) for (const e of f.list) if (!e.dead && n++ < 12) quake(e.x, e.y, 90 * P.area, (60 + P.lv * 7) * P.dmgMult * .7, false); },
};

// ---------- laufende Effekte ----------
const FX_UPD = {
  spin(f, dt) {
    if (f.t >= f.dur) {
      f.done = true; if (!f.at) { P.spinT = 0; P.spinSlow = 1; }
      // Klingenwind: 8 Äxte fliegen davon; Tornado bleibt stehen
      if (f.wind) for (let i = 0; i < 8; i++) shootRaw('boomer', i * TAU / 8, f.dmg * 1.5, 99, 460 * P.proj, 1.1, { out: 300, dist: 0, back: false, sc: 1.1 });
      if (f.tornado) run.abfx.push(spinFx(f.m, 3, { x: P.x, y: P.y }));
      return;
    }
    const x = f.at ? f.at.x : P.x, y = f.at ? f.at.y : P.y;
    f.a += dt * 18;
    if (f.pull || f.at) query(x, y, f.r * 2.3, e => { if (e.boss || e.obj) return; const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * 900 * dt; e.ky += dy / d * 900 * dt; });
    for (const p of run.eproj) if ((p.x - x) ** 2 + (p.y - y) ** 2 < f.r * f.r && !p.lob) p.life = 0;   // abgewehrt
    if ((f.tick -= dt) > 0) return;
    f.tick = f.every;
    blast(x, y, f.r, f.dmg, f.at ? 60 : 320, '#dfe6ea');
    if (!f.at) sfx.whoosh();
  },
  magnet(f, dt) {
    const pulling = f.t < f.dur;
    if (pulling) {
      query(P.x, P.y, f.r, e => {
        if (e.boss || e.obj || ((e.elite || e.miniboss) && !f.elite)) return;
        const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d > 50) { e.kx += dx / d * f.pull * dt * 6; e.ky += dy / d * f.pull * dt * 6; }
        f.got.add(e);
      });
      if (f.gems) for (const it of run.items) if (!it.mag && pullable(it) && (it.x - P.x) ** 2 + (it.y - P.y) ** 2 < f.r * f.r) it.mag = true;
      if (Math.random() < dt * 30) { const a = Math.random() * TAU, r = f.r * frand(.5, 1); part(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r * .75, -Math.cos(a) * r * 1.6, -Math.sin(a) * r * 1.2, .55, Math.random() < .5 ? '#9aa3aa' : '#c9973a', frand(3, 5)); }
      return;
    }
    f.done = true;
    for (const e of f.got) if (!e.dead && f.vuln) { e.vulnT = 3; e.vuln = Math.max(e.vuln || 0, f.vuln); }
    blast(P.x, P.y, 210 * P.area, f.boom, f.flip ? 1100 : 500, '#c9d1d8');
    if (f.flip) query(P.x, P.y, f.r, e => { if (!e.boss) e.freezeT = Math.max(e.freezeT, 1); });
    for (let i = 0; i < 26; i++) { const a = i * TAU / 26; part(P.x, P.y - 10, Math.cos(a) * frand(200, 380), Math.sin(a) * frand(160, 300), .55, i % 3 ? '#9aa3aa' : '#c9973a', frand(4, 7)); }
    ring(P.x, P.y, 10, 210 * P.area, .4, 'rgba(210,215,220,.95)', 12); run.shake = Math.max(run.shake, 12); sfx.boom();
  },
  bees(f, dt) {
    // Gift der Stiche: alle 0,5 s, 3 s lang (wirkt nach, auch wenn die Bienen weg sind)
    if ((f.sickT -= dt) <= 0) { f.sickT = .5; for (const e of f.sick) { if (e.dead || !(e.beeT > run.time)) { f.sick.delete(e); continue; } hurt(e, f.dmg * .25, 0, 0, 0, '#c9e04a'); } }
    if (f.t >= f.dur) { if (f.bees.length) { for (const b of f.bees) part(b.x, b.y, 0, -30, .4, '#ffd84a', 3); f.bees = []; } if (!f.sick.size) f.done = true; return; }
    let view = null;   // Ziele einmal je Schritt sammeln, nicht je Biene
    for (const b of f.bees) {
      b.a += dt;
      if (!b.tgt || b.tgt.dead) b.tgt = b.q ? nearest(500, b, e => !e.obj) : pick(view || (view = randomEnemyInView(0).filter(e => !e.obj))) || null;
      const tx = b.tgt ? b.tgt.x : P.x + Math.cos(b.a * 3) * 40, ty = b.tgt ? b.tgt.y - 16 : P.y - 30 + Math.sin(b.a * 4) * 20;
      const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1, sp = f.spd * (b.q ? .8 : 1) * dt;
      b.x += dx / d * Math.min(d, sp) + Math.sin(b.a * 23) * 2; b.y += dy / d * Math.min(d, sp) + Math.cos(b.a * 19) * 2;
      if ((b.hitT -= dt) <= 0 && b.tgt && d < 24) {
        b.hitT = .5; const e = b.tgt, big = b.q && (e.elite || e.boss || e.miniboss) ? 2 : 1;
        hurt(e, f.dmg * big * (b.q ? 2 : 1), 0, 0, 0, '#ffd84a'); if (!e.dead) { e.slowT = Math.max(e.slowT, .6); e.beeT = run.time + 3; f.sick.add(e); }
      }
    }
  },
  honey(f, dt) {
    if (f.t >= f.dur) { f.done = true; return; }
    if ((P.x - f.x) ** 2 + (P.y - f.y) ** 2 < f.r * f.r && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .02 * dt);
    query(f.x, f.y, f.r, e => { if (e.obj) return; e.slowT = Math.max(e.slowT, .2); slowAt(e, .25); });
  },
  kettle(f) { if (f.t >= f.dur) f.done = true; },
  oil(f, dt) {
    const lit = f.lit >= 0;
    if (!lit && f.self && f.t >= f.self) igniteOil(f.x, f.y, 1);
    // brennender Boden (Katapult, Feuerspur der Kanone, Meteore …) zündet das Öl
    if (!lit) for (const z of run.zones) if (z.k === 'burn' && (z.x - f.x) ** 2 + (z.y - f.y) ** 2 < (z.r + f.r) ** 2) { igniteOil(f.x, f.y, 1); break; }
    if (f.lit >= 0 ? run.time - f.lit >= LAKE_T : f.t >= f.dur) { f.done = true; return; }
    f.tick -= dt; const bite = f.lit >= 0 && f.tick <= 0; if (bite) f.tick = .5;
    f.fallT -= dt; const roll = f.fall && f.fallT <= 0; if (roll) f.fallT = 1;
    query(f.x, f.y, f.r, e => {
      if (e.obj) return;
      e.slowT = Math.max(e.slowT, .2); slowAt(e, f.slowK);
      if (bite) hurt(e, f.burn * .5, 0, 0, 0, '#ffb35c');
      if (roll && !e.boss && RNG.game.next() < f.fall) e.freezeT = Math.max(e.freezeT, 1);   // Ausrutscher
    });
    if (f.lit >= 0 && Math.random() < dt * 30) { const a = Math.random() * TAU, r = Math.random() * f.r; part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .7, frand(-15, 15), frand(-110, -50), .5, Math.random() < .5 ? '#ffb02e' : '#ff6a1f', frand(5, 9)); }
  },
  oilTrail(f, dt) {
    if (f.t >= f.dur) { f.done = true; return; }
    if ((f.tick -= dt) <= 0) { f.tick = .35; run.abfx.push(oilFx(P.x, P.y + 8, 45 * P.area, 3, f.m)); }
  },
  burrow(f, dt) {
    P.burrowT = Math.max(0, f.dur - f.t);
    // Tunnelspur: Erdspitzen auf dem Weg
    if (f.spikes && (f.spikeT -= dt) <= 0) { f.spikeT = .18; run.abfx.push({ k: 'spike', x: P.x, y: P.y + 6, t: 0, dur: .55, dmg: f.dmg * .35, hit: false }); }
    if (Math.random() < dt * 25) part(P.x + frand(-14, 14), P.y + 12, frand(-60, 60), frand(-90, -30), .35, '#7a5a36', frand(3, 6));
    if (f.t < f.dur) return;
    f.done = true; P.burrowT = 0; P.inv = Math.max(P.inv, .3);
    quake(P.x, P.y, f.r, f.dmg, f.stun);
    // Schatzgräber: Kristalle fliegen heraus
    for (let i = 0; i < f.gems; i++) { const a = i * TAU / f.gems; dropGem(P.x + Math.cos(a) * 40, P.y + Math.sin(a) * 30, 3); }
  },
  spike(f) {
    if (!f.hit && f.t >= .12) { f.hit = true; query(f.x, f.y, 34 * P.area, e => { hurt(e, f.dmg, 260, 0, -1, '#c9a26a'); }); }
    if (f.t >= f.dur) f.done = true;
  },
  cannon(f, dt) {
    if (f.t < f.dur) {
      P.rollT = ROLL_T * (1 - ((f.t * 4) % 1) * .95);   // rollt während des Flugs
      query(P.x, P.y, pR() + f.w * .5, e => {
        if (f.hit.has(e) || e.obj) return; f.hit.add(e);
        const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, f.path, 380, (e.x - P.x) / d, (e.y - P.y) / d, '#ffd27a');
      });
      if (f.fire && (f.fireT -= dt) <= 0) { f.fireT = .06; run.zones.push({ k: 'burn', x: P.x, y: P.y + 6, r: 34 * P.area, t: 3, dur: 3, tick: 0, dmg: (6 + P.lv * .8) * P.dmgMult, src: abSrc }); }
      return;
    }
    f.done = true; cannonLand(f);
  },
  refire(f) { if (f.t >= f.dur) { f.done = true; fireCannon(f.m, true); } },
  cannonGun(f) { if (f.t >= f.dur) f.done = true; },
  decoy(f, dt) {
    const over = f.t >= f.dur || f.hp <= 0;
    if (over) {
      f.done = true;
      blast(f.x, f.y, 150 * P.area, Math.max(f.taken * f.boom, (30 + P.lv * 4) * P.dmgMult), 520, '#ffd27a');
      animFx('f_fireball_hit_', 5, f.x, f.y - 10, 3); ring(f.x, f.y, 10, 150 * P.area, .4, 'rgba(255,210,120,.9)', 10);
      for (let i = 0; i < 16; i++) part(f.x, f.y - 14, frand(-200, 200), frand(-240, -40), frand(.4, .8), i % 2 ? '#e6c46a' : '#c9a24a', frand(3, 6));
      run.shake = Math.max(run.shake, 8); sfx.boom(); return;
    }
    run.lures.push(f);
    f.hitT = Math.max(0, f.hitT - dt);
    // Gegner an der Puppe schlagen zu (je Gegner alle 0,5 s); Dornenpuppe schlägt zurück
    query(f.x, f.y, f.r + 6, e => {
      if (e.obj || e.boss || e.dead || !(e.dmg > 0) || (e.lureHitT || 0) > run.time) return;
      e.lureHitT = run.time + .5; f.hp -= e.dmg; f.taken += e.dmg; f.hitT = .15;
      if (f.thorns) { const d = Math.hypot(e.x - f.x, e.y - f.y) || 1; hurt(e, f.thorns, 220, (e.x - f.x) / d, (e.y - f.y) / d, '#e6c46a'); }
    });
    // Spiegelgoblin: die Puppe wirft Dolche
    if (f.mirror && (f.dagT -= dt) <= 0) {
      f.dagT = .7; const t = nearest(420, f);
      if (t) { const a = Math.atan2(t.y - f.y, t.x - f.x); for (const o of [-.12, .12]) shootRaw('dagger', a + o, 8 * P.dmgMult, 0, 560 * P.proj, .85, { x: f.x, y: f.y - 20 }); }
    }
  },
  turret(f, dt) {
    if (f.t >= f.dur) { f.done = true; puff(f.x, f.y, 1, 'rgba(120,120,125,.8)'); sfx.stomp(); return; }
    if (f.follow) { const tx = P.x + f.off, ty = P.y + 40, dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy); if (d > 30) { const s = Math.min(d, 210 * dt); f.x += dx / d * s; f.y += dy / d * s; } }
    if ((f.tick -= dt) > 0) return;
    f.tick = .12;
    const t = nearest(f.range, f, e => !e.obj);   // Seelengefäße, Portale: der Strahl würde sie nicht treffen
    f.beam = t ? { x: t.x, y: t.y - 10 } : null;
    if (!t) return;
    f.a = Math.atan2(t.y - (f.y - 30), t.x - f.x);
    // Strahl: Treffer am Ziel und entlang der Linie
    const hit = new Set(), sx = f.x, sy = f.y - 30, L = Math.hypot(t.x - sx, t.y - sy), n = Math.max(1, Math.ceil(L / 40));
    for (let i = 1; i <= n; i++) {
      const x = sx + (t.x - sx) * i / n, y = sy + (t.y - sy) * i / n;
      query(x, y, 16, e => { if (hit.has(e) || e.obj) return; hit.add(e); hurt(e, f.dmg * (f.blue && (e.elite || e.boss || e.miniboss) ? 1.5 : 1), 30, Math.cos(f.a), Math.sin(f.a), f.blue ? '#8fd0ff' : '#ffb35c'); });
    }
    igniteOil(t.x, t.y, 20);
  },
  trap(f, dt) {
    if (f.snap > 0) { f.snap -= dt; if (f.snap <= 0 && f.uses <= 0) f.done = true; return; }
    if (f.t >= f.dur) { f.done = true; return; }
    // Köder: Gegner in der Nähe werden zur Falle gelockt
    if (f.lure && (f.lureT -= dt) <= 0) { f.lureT = .5; query(f.x, f.y, f.lure + 34, o => { if (o.boss || o.obj) return; const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 1; o.kx += dx / d * 140; o.ky += dy / d * 140; }); }
    // Zuschnappen: Opfer hängt fest, Splitter treffen die Nachbarn
    query(f.x, f.y, 34, e => {
      if (e.obj) return;
      // Bosse (und ihre Teile) treten oft hinein: 40 % Schaden, auch durch Splitter, und sie hängen nicht fest
      const bossy = o => o.boss || o.link;
      hurt(e, f.dmg * (bossy(e) ? .4 : 1), 0, 0, 0, '#d9c9a0'); if (!bossy(e)) e.freezeT = Math.max(e.freezeT, f.hold); else e.slowT = 2;
      query(f.x, f.y, f.splash, o => { if (o !== e) { const d = Math.hypot(o.x - f.x, o.y - f.y) || 1; hurt(o, f.dmg * f.sf * (bossy(o) ? .4 : 1), 120, (o.x - f.x) / d, (o.y - f.y) / d, '#d9c9a0'); } });
      if (f.sf >= 1) ring(f.x, f.y, 6, f.splash, .3, 'rgba(230,210,160,.8)', 5);
      f.snap = .4; f.uses--; sfx.stomp(); return false;
    });
  },
  gas(f, dt) {
    if (f.t >= f.dur) { f.done = true; return; }
    f.tick -= dt;
    if (f.tick <= 0) { f.tick = 1; query(f.x, f.y, f.r, e => { hurt(e, f.dmg, 0, 0, 0, '#b6e07a'); }); }
    if (Math.random() < dt * 12) { const a = Math.random() * TAU, r = Math.random() * f.r; part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .6, frand(-20, 20), -25, 1, 'rgba(150,200,90,.45)', frand(8, 14)); }
  },
  echo(f) { if (f.t >= f.dur) { f.done = true; bang(f.dmg, f.o); } },
  // Nach dem Einsatz (useAbility setzt ch = 0) die Aufladung teilweise füllen
  refill(f) { f.done = true; const s = run.abil.find(x => x && x.id === f.id); if (s) s.ch = Math.max(s.ch, s.need * f.p); },
  volley(f) { if (f.t >= f.dur) { f.done = true; fireCatapult(M('catapult'), .5); } },
  caltrop(f, dt) {
    if (f.t >= f.dur) { f.done = true; return; }
    f.tick -= dt; const bite = f.tick <= 0; if (bite) f.tick = .5;
    query(f.x, f.y, f.r, e => { if (e.obj) return; e.slowT = Math.max(e.slowT, .3); if (bite) hurt(e, f.dmg, 0, 0, 0, '#c9c2b0'); });
  },
  hook(f) {
    // Landung: Stoßwelle um dich
    if (f.land && f.t >= .2) { const dmg = f.land; f.land = 0; if (f.roll) P.inv = Math.max(P.inv, f.roll); query(P.x, P.y, f.r, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, f.stun ? 0 : 400, (e.x - P.x) / d, (e.y - P.y) / d); if (f.stun && !e.boss) e.freezeT = Math.max(e.freezeT, 1); }); ring(P.x, P.y, 10, f.r, .3, 'rgba(200,230,255,.9)', 6); run.shake = Math.max(run.shake, 5); }
    if (f.t >= f.dur) f.done = true;
  },
  shroom(f, dt) {
    if (f.t >= f.dur) {
      // Nachwuchs: Heilpäckchen bleiben liegen
      for (let i = 0; i < f.sprout; i++) { const a = i * TAU / f.sprout + .5; addItem('heal', f.x + Math.cos(a) * f.r * .5, f.y + Math.sin(a) * f.r * .35); }
      f.done = true; return;
    }
    if (f.follow) { f.x = P.x; f.y = P.y; }
    if ((P.x - f.x) ** 2 + (P.y - f.y) ** 2 < f.r * f.r && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * f.heal * dt);
    f.tick -= dt; const bite = f.dmg && f.tick <= 0; if (bite) f.tick = 1;
    query(f.x, f.y, f.r, e => {
      e.slowT = Math.max(e.slowT, .2); if (f.slowK < .5) { e.slowK = f.slowK; e.slowKT = run.time + .25; }
      if (f.vuln) { e.vulnT = Math.max(e.vulnT || 0, .2); e.vuln = Math.max(e.vuln || 0, f.vuln); }
      if (bite) hurt(e, f.dmg, 0, 0, 0, '#9cf06a');
    });
    if (Math.random() < dt * 10) { const a = Math.random() * TAU, r = Math.random() * f.r; part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .6, 0, -40, .6, 'rgba(150,255,140,.8)', 3); }
  },
  rats(f, dt) {
    if (f.t >= f.dur && f.rats.length) {
      // Rückkehr: einmal zurückrennen; sonst sind die Ratten weg, die Seuche wirkt noch nach
      if (f.back) { f.back = false; f.t = 0; f.dir *= -1; for (const r of f.rats) { r.hit.clear(); r.x -= f.dir * 40; } }
      else f.rats = [];
    }
    if (!f.rats.length && !f.sick.length) { f.done = true; return; }
    // Beuteratten: Ratten nach Zeilen einsortieren, dann jeden Gegenstand nur gegen die Ratten seiner Nachbarzeilen prüfen
    if (f.loot && f.rats.length && (f.lootT = (f.lootT || 0) - dt) <= 0) {
      f.lootT = .1;
      const rows = new Map(), row = y => Math.floor(y / f.loot);
      for (const r of f.rats) { const k = row(r.y); if (!rows.has(k)) rows.set(k, []); rows.get(k).push(r.x); }
      for (const it of run.items) {
        if (it.mag || !pullable(it)) continue;
        const k = row(it.y);
        for (let d = -1; d <= 1 && !it.mag; d++) for (const x of rows.get(k + d) || []) if (Math.abs(x - it.x) < f.loot) { it.mag = true; break; }
      }
    }
    for (const r of f.rats) {
      r.x += f.dir * r.sp * dt; r.a += dt;
      // Hungrige Ratten: mehrmals beißen, mit kurzer Pause dazwischen
      query(r.x, r.y, f.r, e => {
        const h = r.hit.get(e) || { n: 0, t: -1 };
        if (h.n >= f.bites || run.time - h.t < .25) return;
        h.n++; h.t = run.time; r.hit.set(e, h);
        hurt(e, f.dmg, 60, f.dir, 0, '#e0c090'); if (f.pest) e.slowT = Math.max(e.slowT, 3);
        if (f.plague && !e.dead) { e.plagueT = 3; if (!f.sick.includes(e)) f.sick.push(e); }
      });
    }
    // Seuche: Giftschaden jede halbe Sekunde
    if (f.plague && (f.sickT -= dt) <= 0) {
      f.sickT = .5;
      for (const e of f.sick) if (!e.dead && e.plagueT > 0) { e.plagueT -= .5; hurt(e, f.plague * .5, 0, 0, 0, '#9cf06a'); }
      f.sick = f.sick.filter(e => !e.dead && e.plagueT > 0);
    }
  },
  tb(f) {
    if (f.t < f.dur) return;
    f.done = true;
    for (const e of f.list) {
      if (e.dead) continue;
      const dmg = (100 + P.lv * 12) * P.dmgMult * f.pow + (e.tb || 0); e.tb = undefined; e.tbShock = false;
      explode(e.x, e.y, f.boom, dmg * .6, 'frost'); hurt(e, dmg, 0, 0, 0, '#bff0ff');
      // Splitterregen: Eissplitter in alle Richtungen
      for (let i = 0; i < f.shards; i++) { const a = i * TAU / f.shards + rand(0, 1); run.pproj.push({ k: 'bullet', x: e.x, y: e.y, a, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: dmg * .25, pierce: 1, life: .5, hit: new Set([e]), r: 8, t: 0, src: abSrc }); }
      // Zeitschleife: Überlebende frieren noch einmal ein
      if (f.loop && !e.dead) e.freezeT = Math.max(e.freezeT, 1.5);
    }
    run.shake = Math.max(run.shake, 10);
  },
};
for (const k in FX_UPD) if (!(k in FX_SRC)) throw new Error('FX_SRC fehlt: ' + k);   // Runen-Quelle jedes Effekts
