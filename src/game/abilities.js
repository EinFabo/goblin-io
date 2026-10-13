import { pullAll, pullable } from './items.js';
import { count } from './progress.js';
import { ROLL_T } from './player.js';
import { RNG, frand, rand, pick } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { save, stageCleared } from '../core/save.js';
import { trailCol } from '../data/cosmetics.js';
import { ABILITIES, MOVE_IDS, SLOT2_ACCT, abilMods, abilityUnlocked, xpPerUse } from '../data/abilities.js';
import { hurt } from './combat.js';
import { addItem, addNum, animFx, explode, part, puff, ring } from './fx.js';
import { H, W, ZOOM } from '../render/canvas.js';
import { TAU } from '../core/util.js';
import { P, nearest, onScreen, pR, query, randomEnemyInView, run } from './state.js';
import { stepAlly } from './weapons.js';
import { recalc } from './run.js';
import { banner } from '../ui/hud.js';

// ---------- Fähigkeiten: 2 Slots (PLAN 8) ----------
// run.abil[i] = { id, ch, need } – ch läuft von 0 bis need, je nach Aufladeart (data/abilities.js)
// Laufende Effekte (Fallen, Pilzring, Ratten, Zeitbombe) liegen in run.abfx.

// Baum-Werte der Fähigkeit in diesem Lauf (Kraft, Tempo, Reichweite, Extras a/b), siehe data/abilities.js
const NOMOD = abilMods(null);
const M = id => (run.abMods && run.abMods[id]) || NOMOD;
function needOf(id) {
  const A = ABILITIES[id], m = M(id);
  if (A.charge === 'once') return A.need;
  if (A.charge === 'kills') return Math.round(A.need * m.spd);
  return A.charge === 'cd' ? A.need * m.spd : Math.round(A.need * m.spd);
}
export const slotOpen = i => i === 0 || save.profile.level >= SLOT2_ACCT;
export const canEquip = id => save.keep.includes(id) || abilityUnlocked(id, save.profile.level, stageCleared);

export function initAbilities() {
  run.abMods = {}; run.abXp = {};
  for (const id of save.loadout) if (id) run.abMods[id] = abilMods(save.abilities[id]);
  // Rolle und Sprint sind immer dabei und haben eigene Bäume
  for (const id of MOVE_IDS) run.abMods[id] = abilMods(save.abilities[id]);
  // max: Aufladungen (Doppelhaken), stock: gespeicherte volle Ladungen außer der laufenden
  run.abil = save.loadout.map((id, i) => id && slotOpen(i) && canEquip(id) ? { id, ch: ABILITIES[id].charge === 'once' ? (M(id).a ? 2 : 1) : 0, need: needOf(id), max: id === 'hook' && M(id).m ? 2 : 1, stock: 0 } : null);
  run.abfx = []; run.tmpAllies = []; run.trapRolls = 0; run.rageExt = 0;
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
}
// Schaden, den der Spieler nimmt: Berserker, Ausweichen beim Sprinten, Goldener Schutz. 0 = geschluckt
export function takenMult() {
  let k = 1;
  if (P.rageT > 0 && M('rage').m) k *= .7;
  if (P.sprinting) k *= 1 - .06 * M('sprint').s2;
  if (run.goldT > 0 && M('totem').m && run.totem) {
    if (run.gold - run.totem.gold >= 25) { run.totem.gold += 25; addNum(P.x, P.y - 40, 'Goldschutz', '#ffd84a', false); return 0; }
  }
  return k;
}
// Schaden, den Gegner nehmen: Hinterhalt, Widerhaken/Sporen; Glücksbringer erhöht kritische Treffer
export const dealtMult = e => (P.ambushT > 0 ? 2 : 1) * (e.vulnT > 0 ? 1 + e.vuln : 1);
export const critBonus = () => (run.goldT > 0 ? .04 * M('totem').s2 : 0);
export const xpBonus = () => (run.goldT > 0 ? 1 + .1 * M('totem').s3 : 1);

// Kills und Schrott laden die passenden Slots
export function chargeAbil(kind, n) {
  for (const s of run.abil) {
    if (!s || ABILITIES[s.id].charge !== kind) continue;
    if (kind === 'scrap' && P.mechT > 0) continue;
    s.ch = Math.min(s.need, s.ch + n);
  }
}

const USE = {
  rage: doRage, mech: startMech, trap: layTraps, smoke: throwSmoke, catapult: fireCatapult, hook: throwHook,
  shroom: growShrooms, shield: raiseShield, rats: releaseRats, call: callGoblins, totem: raiseTotem, timebomb: dropTimebomb, bigbang: bigBang,
};
export function useAbility(i) {
  const s = run && run.abil[i];
  if (!s || run.paused || run.over || run.cut || !abilReady(s)) return false;
  const why = lockOf(s.id); if (why) { lockedBuzz(why); return false; }
  if (USE[s.id](M(s.id)) === false) return false;
  if (s.stock > 0) s.stock--; else s.ch = 0;
  run.abXp[s.id] = (run.abXp[s.id] || 0) + xpPerUse(s.id);   // XP durch Benutzen, gutgeschrieben am Laufende
  count(run, 'abil');
  return true;
}

export function updAbilities(dt) {
  for (const s of run.abil) {
    if (!s || ABILITIES[s.id].charge !== 'cd') continue;
    s.ch = Math.min(s.need, s.ch + dt);
    if (s.ch >= s.need && s.stock < s.max - 1) { s.stock++; s.ch = 0; }
  }
  updMech(dt); updMoves(dt);
  if (P.smokeT > 0) { P.smokeT -= dt; if (P.smokeT <= 0) smokeEnd(M('smoke')); }
  if (P.ambushT > 0) P.ambushT -= dt;
  if (P.shieldT > 0) {
    P.shieldT -= dt;
    if (P.shieldT <= 0 || P.shieldHp <= 0) {
      // Nachladen: ungebrochen abgelaufen → Abklingzeit kürzer
      const m = M('shield'), s = run.abil.find(x => x && x.id === 'shield');
      if (P.shieldHp > 0 && m.s2 && s) s.ch = Math.min(s.need, s.ch + s.need * .1 * m.s2);
      P.shieldT = 0; puff(P.x, P.y - 10, 1, 'rgba(200,205,210,.8)'); if (P.shieldShard) shieldShards();
    }
  }
  if (run.goldT > 0) { run.goldT -= dt; if (run.goldT <= 0) run.totem = null; }
  for (const f of run.abfx) { f.t += dt; FX_UPD[f.k](f, dt); }
  run.abfx = run.abfx.filter(f => !f.done);
  // Verwirrte Gegner (Rauchbombe) schlagen auf Nachbarn ein
  for (const e of run.enemies) {
    if (!(e.confT > 0) || e.dead) continue;
    e.confT -= dt; e.confHit = (e.confHit || 0) - dt;
    if (e.confHit <= 0) { e.confHit = .5; query(e.x, e.y, 40, o => { if (o !== e && !o.boss) { hurt(o, 6 + e.dmg, 0, 0, 0, '#c9b6ff'); return false; } }); }
  }
  // Goblin-Ruf: Krieger auf Zeit
  run.tmpAllies.forEach((al, i) => {
    al.t -= dt; stepAlly(al, i, run.tmpAllies.length, (25 + P.lv * 1.5) * P.dmgMult * al.pow, 260 * al.spd, (P.rageT > 0 ? 1.6 : 1) * al.spd, dt);
    if (al.t <= 0) {
      al.done = true; puff(al.x, al.y, .6);
      // Letzter Hieb: Krieger explodieren beim Gehen
      if (al.boom) { query(al.x, al.y, 70, e => { const d = Math.hypot(e.x - al.x, e.y - al.y) || 1; hurt(e, al.boom, 200, (e.x - al.x) / d, (e.y - al.y) / d, '#9be36a'); }); ring(al.x, al.y, 6, 70, .3, 'rgba(160,230,100,.9)', 5); }
    }
  });
  run.tmpAllies = run.tmpAllies.filter(a => !a.done);
}

// ---------- Rolle und Sprint (immer dabei, eigene Bäume, PLAN 8.4) ----------
// Rolle hat Ladungen (Zweite/Dritte Ladung); die Abklingzeit lädt eine Ladung nach der anderen nach.
export const dashCdOf = () => 2.4 * (1 - .06 * M('dash').r.pow);
function initMoves() {
  const d = M('dash');
  P.dashMax = d.m ? 3 : d.a ? 2 : 1; P.dashN = P.dashMax; P.dashCd = 0; P.perfectR = 1 + .15 * d.s1;
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
  // Rammbock: kleine Gegner, in die man sprintet
  if (P.sprinting && s.b) query(P.x, P.y, pR() + 8, e => {
    if (e.boss || e.elite || e.miniboss || e.obj || e.ramT > run.time) return; e.ramT = run.time + .6;
    const dd = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, (20 + P.lv * 2) * P.dmgMult, 520, (e.x - P.x) / dd, (e.y - P.y) / dd, '#ffd84a');
    run.shake = Math.max(run.shake, 3); sfx.stomp();
  });
  if (P.sprinting) run.abXp.sprint = (run.abXp.sprint || 0) + xpPerUse('sprint') * dt;
}

export function doDash() {
  if (!run || run.paused || run.over || run.cut || P.dashN <= 0 || P.dashT > 0) return;
  const why = lockOf('dash'); if (why) { lockedBuzz(why); return; }
  const d = M('dash'), sp = 900 * (1 + .08 * d.r.cd);
  P.dashN--; if (P.dashCd <= 0) P.dashCd = dashCdOf();
  P.dashT = .18; P.inv = Math.max(P.inv, .3 + .06 * d.r.area);
  P.dvx = P.aimX * sp; P.dvy = P.aimY * sp;
  P.rollT = ROLL_T; P.perfect = false; P.trailT = 0; P.rollHit = d.s2 ? new Set() : null;
  if (d.s3) haste(1.2 + .18, .1 * d.s3);
  // Krähenfüße bleiben am Startpunkt liegen
  if (d.b) run.abfx.push({ k: 'caltrop', x: P.x, y: P.y + 10, r: 48, t: 0, dur: 2.5, tick: 0, dmg: (8 + P.lv) * P.dmgMult, seed: Math.random() * 100 });
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
  query(P.x, P.y, R, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, kb, (e.x - P.x) / d, (e.y - P.y) / d, '#ff8a5c'); });
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
  query(P.x, P.y, 120, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 30 * P.dmgMult, 500, (e.x - P.x) / d, (e.y - P.y) / d); });
  run.shake = 10; sfx.mechOn(); banner('Goblin-Maschine!', '');
}
function updMech(dt) {
  if (P.mechT <= 0) return;
  P.mechT -= dt; P.gunFlash -= dt; P.stepT -= dt;
  if (P.moving && P.stepT <= 0) {
    P.stepT = .36; P.leg ^= 1;
    const fx = P.x + (P.leg ? 15 : -15), fy = P.y + 18, boots = 1 + .25 * M('mech').s2, sr = 55 * P.area * boots;
    query(fx, fy, sr, e => { const d = Math.hypot(e.x - fx, e.y - fy) || 1; hurt(e, 13 * P.dmgMult * boots, 160, (e.x - fx) / d, (e.y - fy) / d); });
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
    run.pproj.push({ k: 'bullet', x: gx, y: gy, a, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, dmg: 9 * P.dmgMult * P.mechPow, pierce: 0, life: .7, hit: new Set(), r: 8, t: 0 });
    P.gunFlash = .04; sfx.gun();
  }
  P.rocketT -= dt;
  if (P.rocketT <= 0) {
    P.rocketT = P.mechRocket;
    const c = randomEnemyInView(0);
    if (c.length) {
      for (let i = 0; i < 4; i++) {
        const e = pick(c), a = -Math.PI / 2 + (i - 1.5) * .5;
        run.pproj.push({ k: 'rocket', x: P.x - 10, y: P.y - 50, a, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, target: e, dmg: 30 * P.dmgMult * P.mechPow, rad: 60 * P.area, pierce: 0, life: 2.2, hit: new Set(), r: 10, t: 0 });
      }
      sfx.rocket();
    }
  }
  if (Math.random() < dt * 14) { const side = Math.cos(P.gunA) >= 0 ? -1 : 1; part(P.x + side * 18, P.y - 62, frand(-10, 10), frand(-70, -40), .9, 'rgba(90,90,95,.55)', frand(6, 10)); }
  if (P.mechT <= 0) {
    const over = M('mech').m, R = 200 * P.area * (over ? 1.4 : 1);   // Überladung
    query(P.x, P.y, R, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 90 * P.dmgMult * (over ? 2 : 1), 600, (e.x - P.x) / d, (e.y - P.y) / d, '#ffb35c'); });
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
    run.abfx.push({ k: 'trap', x, y, t: 0, dur: 20 * m.area, snap: 0, uses: 3 + m.s1, hold: 2 + .4 * m.s2, lure: m.s3 ? 20 + 30 * m.s3 : 0, lureT: 0,
      dmg: (70 + P.lv * 8) * P.dmgMult * m.pow, splash: (m.b ? 110 : 70) * m.area, sf: m.b ? 1 : .5 });
    puff(x, y, .5, 'rgba(160,140,110,.8)');
  }
  sfx.throw();
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

// ---------- Goblin-Katapult ----------
function fireCatapult(m, pow = 1) {
  const c = randomEnemyInView(0);
  let best = null, bn = -1;
  for (const e of c) { let n = 0; for (const o of c) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 90 * 90) n++; if (n > bn) { bn = n; best = e; } }
  const tx = best ? best.x : P.x + P.aimX * 200, ty = best ? best.y : P.y + P.aimY * 200;
  for (let i = 0; i < (m.a ? 8 : 5); i++) {
    const a = rand(0, TAU), r = i ? rand(20, 80) * m.area : 0;
    run.tele.push({ k: 'boulder', sx: P.x - 30, sy: P.y - 40, x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r, t: -i * .12, dur: .7 / (1 + .15 * m.s2), rad: 85 * P.area * m.area, dmg: (100 + P.lv * 10) * P.dmgMult * m.pow * pow, burn: m.b, shards: m.s1, stun: .3 * m.s3 });
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
  if (!k || !(P.shieldT > 0) || e.thornT > run.time) return;
  e.thornT = run.time + .4; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 10 * k * P.dmgMult, 200, (e.x - P.x) / d, (e.y - P.y) / d, '#dfe6ea');
}
// Splitterschild: beim Brechen oder Ende fliegen Splitter um dich
function shieldShards() {
  const dmg = P.shieldShard; P.shieldShard = 0;
  query(P.x, P.y, 160, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, 300, (e.x - P.x) / d, (e.y - P.y) / d, '#dfe6ea'); });
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
  run.pproj.push({ k: 'bullet', x: p.x, y: p.y, a, vx: Math.cos(a) * sp * 1.3, vy: Math.sin(a) * sp * 1.3, dmg: 20 * P.dmgMult * (1 + .3 * M('shield').s1), pierce: 1, life: 1.2, hit: new Set(), r: 10, t: 0 });
  sfx.ezap();
}

// ---------- Rattenflut ----------
function releaseRats(m) {
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM, dir = RNG.game.chance(.5) ? 1 : -1, rats = [];
  for (let i = 0; i < (m.a ? 60 : 40); i++) rats.push({ x: P.x - dir * (hw + 30 + rand(0, 260)), y: P.y + rand(-hh, hh), sp: rand(380, 480), hit: new Map(), a: rand(0, 6) });
  run.abfx.push({ k: 'rats', dir, rats, t: 0, dur: 3.2, r: 16 * m.area, dmg: (30 + P.lv * 2) * P.dmgMult * m.pow, pest: m.b,
    bites: 1 + m.s1, loot: m.s2 ? 30 + 20 * m.s2 : 0, plague: m.s3 ? (4 + P.lv * .5) * m.s3 * P.dmgMult : 0, sick: [], sickT: 0, back: m.m });
  sfx.warn(); banner('Rattenflut!', '');
}

// ---------- Goblin-Ruf ----------
function callGoblins(m) {
  const n = m.a ? 12 : 8, pow = m.pow * (1 + .12 * m.s1), spd = 1 + .12 * m.s2, boom = m.s3 ? 20 * m.s3 * P.dmgMult : 0;
  if (m.b) P.rageT = Math.max(P.rageT, 4);
  const add = (a, r, big) => { run.tmpAllies.push({ ally: true, tmp: true, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, face: 'down', at: 0, atk: 0, slash: 0, sa: 0, moving: false, off: a, t: ABILITIES.call.dur * m.area, pow: big ? pow * 3 : pow, spd, boom, big }); puff(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r, big ? 1 : .6); };
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
  query(P.x, P.y, R, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 50 * P.dmgMult * (1 + .5 * m.s2), 800, (e.x - P.x) / d, (e.y - P.y) / d, '#ffd84a'); });
  for (const p of run.eproj) p.life = 0;
  ring(P.x, P.y, 10, R, .6, 'rgba(255,215,80,.95)', 14); run.shake = 14; run.slowT = .4;
  sfx.ult(); banner('Das Amulett rettet dich!', '');
  return true;
}

// ---------- laufende Effekte ----------
const FX_UPD = {
  trap(f, dt) {
    if (f.snap > 0) { f.snap -= dt; if (f.snap <= 0 && f.uses <= 0) f.done = true; return; }
    if (f.t >= f.dur) { f.done = true; return; }
    // Köder: Gegner in der Nähe werden zur Falle gelockt
    if (f.lure && (f.lureT -= dt) <= 0) { f.lureT = .5; query(f.x, f.y, f.lure + 34, o => { if (o.boss || o.obj) return; const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 1; o.kx += dx / d * 140; o.ky += dy / d * 140; }); }
    // Zuschnappen: Opfer hängt fest, Splitter treffen die Nachbarn
    query(f.x, f.y, 34, e => {
      if (e.obj) return;
      hurt(e, f.dmg, 0, 0, 0, '#d9c9a0'); if (!e.boss) e.freezeT = Math.max(e.freezeT, f.hold); else e.slowT = 2;
      query(f.x, f.y, f.splash, o => { if (o !== e) { const d = Math.hypot(o.x - f.x, o.y - f.y) || 1; hurt(o, f.dmg * f.sf, 120, (o.x - f.x) / d, (o.y - f.y) / d, '#d9c9a0'); } });
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
      for (let i = 0; i < f.shards; i++) { const a = i * TAU / f.shards + rand(0, 1); run.pproj.push({ k: 'bullet', x: e.x, y: e.y, a, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: dmg * .25, pierce: 1, life: .5, hit: new Set([e]), r: 8, t: 0 }); }
      // Zeitschleife: Überlebende frieren noch einmal ein
      if (f.loop && !e.dead) e.freezeT = Math.max(e.freezeT, 1.5);
    }
    run.shake = Math.max(run.shake, 10);
  },
};
