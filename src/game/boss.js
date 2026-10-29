import { RNG, frand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { $, TAU, angDiff, clamp, face8 } from '../core/util.js';
import { CCOL } from '../data/enemies.js';
import { BOSSES, BOSS_IDS, RAGE_AT, bossVariant } from '../data/bosses.js';
import { stageHp } from './balance.js';
import { ATK, bossRing, phase, phaseAt } from './boss-atk.js';
import {
  SCHOOL_ATK, armorRule, blockOnce, clearBossWorld, dismount, iceRule, initArmor, raiseShield, setSchool, spawnClones, spawnPillars,
  spawnShades, spawnVessels, splitBoss, updBurn, updPillars, updPortals, updRise, updSchools, updWind, vesselsUp,
} from './boss-mech.js';
import { mspr, tipPos } from './enemies.js';
import { nmHp, nmRageAt } from '../data/nightmare.js';
import { cycleHp } from '../data/souls.js';
import { boltFx, dropGem, part, puff, ring } from './fx.js';
import { hint } from './run.js';
import { P, run, viewC } from './state.js';
import { W, ZOOM } from '../render/canvas.js';
import { banner } from '../ui/hud.js';

export { ATK } from './boss-atk.js';
export { bossOnKill, portalWarp, shadeDown, spinHaz } from './boss-mech.js';

// ---------- Boss-Runner (PLAN 6.2) ----------
// Phasen aus data/bosses.js: Rotation der Angriffe aus boss-atk.js, Phasenwechsel bei 66 % und 33 % Leben
// (bzw. B.at), kleine Szene, 1,5 s unverwundbar, Geschosse weg; Wut-Timer nach 180 s Kampf.
// Auftritt und Phasenwechsel laufen als Szene (run.cut): die Welt steht, die Kamera zeigt den Boss.
// Weitere Körper (Morgras Teile, Spiegelbilder, Malvorns Schatten) laufen mit derselben KI, aber ohne Phasen.

// Tempo: Phase × Wut
const tempo = b => (phase(b).spd || 1) * (b.rage ? 1.5 : 1);

// Ein Boss als Gegner-Objekt (auch für Malvorns Schatten)
export function makeBoss(id, { x = viewC().x, y = viewC().y - 300 } = {}) {
  // Endlose Nacht: jeder weitere Boss ist stärker (Runde = besiegte Bosse; ein Boss springt nicht mitten im Kampf)
  const st = run.st, B = BOSSES[id], lf = 1 + run.loop * 1.5;
  const b = {
    type: 'boss', boss: true, id, B, pre: 'm.' + bossVariant(id), name: B.name, x, y, r: 38, sc: 2.7, spd: 52 * (B.spd || 1), dmg: 13 * st.dmg * lf,
    hp: 2500 * stageHp(run.si) * lf * (st.bossHp || 1) * (B.hp || 1) * nmHp(run.nm) * cycleHp(run.cycle) * (run.coopHp || 1), xp: 150, tint: B.tint || null, state: 'walk', face: 'down', fa: Math.PI / 2, at: 0, ft: 0, fired: false, charge: .7, ck: 'fire',
    kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, dead: false,
    ph: 0, phT: 0, fightT: 0, rage: false, inv: 0, ice: 0, iceT: 0, iceCd: 0, blkT: 0, stunT: 0, armor: 0, mount: !!B.mount,
    ai: { st: 'chase', t: 2.2, i: 0, atk: null, reps: 0, ring2: 0, ax: 0, ay: 0, chan: 0, spin: null },
  };
  b.maxHp = b.hp;
  b.spr = mspr(b, 'idle', 1);
  return b;
}
// Weitere Körper eines Bosses (Morgras Teile, Spiegelbilder, Malvorns Schatten)
export const bodyOf = (e, b) => e.link === b || e.of === b || e.decoyOf === b;
// loot = false: Weitermachen – übrige Gegner verschwinden ohne Kristalle (sonst gäbe jedes Weitermachen Gratis-XP)
export function spawnBoss(loot = true) {
  // Endlose Nacht: jedes Mal ein zufälliger Boss
  const id = run.st.boss.id === 'random' ? BOSS_IDS[Math.floor(RNG.spawn.next() * BOSS_IDS.length)] : run.st.boss.id;
  for (const e of run.enemies) if (!e.dead) { e.dead = true; puff(e.x, e.y, e.sc); if (loot) dropGem(e.x, e.y, e.xp); }
  run.eproj.length = 0; run.haz.length = 0;
  clearBossWorld();
  run.arena = { x: viewC().x, y: viewC().y, r: 470, burn: 0 };   // Koop: um die Mitte beider Goblins
  const b = makeBoss(id);
  run.enemies.push(b); run.boss = b;
  startCut('intro', b);
}

// Weitermachen im Boss-Level (Wunsch Fabi 2026-10-16, wie in Undertale): der Kampf beginnt von vorn.
// Boss und seine weiteren Körper verschwinden ohne Beute, Wetter und Bodeneffekte gehen mit, dann ein frischer Auftritt.
export function restartBoss() {
  const b = run.boss; if (!b) return;
  for (const e of run.enemies) if (!e.dead && (e === b || bodyOf(e, b))) { e.dead = true; puff(e.x, e.y, e.sc); }
  run.boss = null; run.storm = 0;
  $('#bossBar').hidden = true;
  spawnBoss(false);
}

// ---------- Szenen: Auftritt und Phasenwechsel ----------
const CUT_T = { intro: 3.4, phase: 1.6 };
export function startCut(kind, b) {
  run.cut = { kind, t: 0, dur: CUT_T[kind], b, shown: false };
  for (const p of run.players) { p.dashT = 0; p.sprinting = false; }
  if (kind === 'intro') {
    b.hidden = true;
    emit('bossIntro', b);
    sfx.warn();
    document.body.classList.add('cine');
  } else {
    // Phasenwechsel: Hitstop, alle gegnerischen Geschosse und Bodenwarnungen weg (Fairness)
    run.hitstop = Math.max(run.hitstop, .18);
    run.eproj.length = 0; run.haz.length = 0;
    // laufender Angriff fällt aus (sonst stünde z. B. die Ansturm-Linie die ganze Szene im Bild)
    b.ai.ring2 = 0; b.ai.spin = null; b.ai.st = 'chase'; b.ft = 0; b.fired = false;
    b.inv = 1.5;
    run.shake = Math.max(run.shake, 10);
    ring(b.x, b.y, 20, 260, .6, b.B.col, 10);
    banner(phase(b).name || 'Phase ' + (b.ph + 1), 'danger'); emit('bossPhase', b);
    const say = phase(b).say; if (say) hint(`<b>${b.B.name}</b> ${say}`);
    sfx.warn();
  }
}
export const skipCut = () => { const c = run && run.cut; if (c && c.kind === 'intro' && c.t > .5) c.t = Math.max(c.t, c.dur - .45); };
export function updCut(dt) {
  const c = run.cut, b = c.b, cam = run.cam;
  // Was im Schritt des Phasenwechsels nach dem Treffer noch entstanden ist, verschwindet auch
  if (c.t === 0 && c.kind === 'phase') { run.eproj.length = 0; run.haz.length = 0; }
  c.t += dt;
  // Kamera: zum Boss, heranzoomen, am Ende zurück zum Spieler
  const back = c.dur - (c.kind === 'intro' ? .7 : .4), out = c.t > back, tz = out ? 1 : c.kind === 'intro' ? 1.3 : 1.2;
  // Beim Auftritt steht der Boss rechts der Mitte, links unten ist Platz für das Namensschild
  const tx = out ? viewC().x : b.x - (c.kind === 'intro' ? W * .16 / (ZOOM * tz) : 0), ty = out ? viewC().y : b.y - 30;
  const k = 1 - Math.pow(out ? .86 : .9, dt * 60);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k;
  b.face = 'down'; b.fa = Math.PI / 2;
  if (c.kind === 'intro') introStep(c, b, dt);
  else {
    b.spr = mspr(b, 'cast', Math.min(8, 1 + Math.floor(c.t * 7)));
    if (Math.random() < .5) { const a = frand(0, TAU); part(b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 50, -Math.cos(a) * 160, -Math.sin(a) * 120, .4, b.B.col, 5); }
  }
  if (c.t >= c.dur) endCut();
}
// Auftritt je Boss (B.intro): erst kündigt sich der Boss an (0,8 s), dann erscheint er, brüllt, Namensschild.
// rise: steigt aus dem Boden (Gift, Grab, Erdbeben) · mirror: vier Spiegelbilder fliegen zusammen
const RISE = { poison: 1, grave: 1, quake: 1 };
function introStep(c, b, dt) {
  const s = b.B.intro || 'flame', col = b.B.col;
  if (c.t < .8) {
    b.spr = mspr(b, 'idle', 1);
    const q = c.t / .8;
    if (s === 'flame' && Math.random() < .8) part(b.x + frand(-30, 30), b.y + 10, 0, frand(-300, -140), .6, Math.random() < .5 ? '#ff8a1f' : '#ffd84a', frand(3, 7));
    else if (s === 'ice' && Math.random() < .8) { const a = frand(0, TAU), r = 200 * (1 - q) + 30; part(b.x + Math.cos(a) * r, b.y - 30 + Math.sin(a) * r * .7, -Math.cos(a) * 220, -Math.sin(a) * 160, .35, '#dff6ff', 4); }
    else if (s === 'poison' && Math.random() < .6) part(b.x + frand(-50, 50), b.y + 14, 0, frand(-60, -20), .7, 'rgba(160,240,90,.8)', frand(4, 8));
    else if (s === 'grave' && Math.random() < .5) part(b.x + frand(-40, 40), b.y + 10, frand(-20, 20), frand(-120, -40), .6, Math.random() < .5 ? '#7bff6a' : '#ece4cf', 4);
    else if (s === 'mirror' && Math.random() < .5) part(b.x + frand(-120, 120), b.y - 40 + frand(-60, 60), 0, -20, .5, '#c99bff', 3);
    else if (s === 'bolt' && Math.random() < dt * 6) boltFx(b.x + frand(-200, 200), b.y - 500, b.x + frand(-160, 160), b.y + frand(-60, 60), 3, 'storm');
    else if (s === 'quake') { run.shake = Math.max(run.shake, 3 + q * 6); if (Math.random() < .5) part(b.x + frand(-60, 60), b.y + 14, frand(-60, 60), frand(-160, -60), .5, '#8a7a62', 5); }
    else if (s === 'sigil' && Math.random() < .6) { const a = frand(0, TAU); part(b.x + Math.cos(a) * 90, b.y + Math.sin(a) * 50, 0, -90, .6, '#ffe27a', 3); }
    c.sigil = s === 'sigil' || s === 'mirror' ? q : 0;
  } else if (b.hidden) {
    b.hidden = false; b.flash = .25; run.shake = Math.max(run.shake, 14); run.flashT = .2; sfx.boom(); sfx.portal();
    if (RISE[s]) b.rise = 0;
    if (s === 'mirror') b.mirror = 1;
    if (s === 'bolt') { boltFx(b.x, b.y - 520, b.x, b.y, 8, 'storm'); sfx.ezap(); run.flashT = .35; }
    ring(b.x, b.y, 10, 300, .7, col, 12);
    for (let i = 0; i < 30; i++) { const a = i * TAU / 30; part(b.x, b.y, Math.cos(a) * 320, Math.sin(a) * 200, .7, i % 2 ? col : '#fff', 5); }
    c.sigil = 0;
  } else {
    const ft = c.t - .8;
    if (b.rise !== undefined && b.rise !== null && b.rise < 1) {
      b.rise = Math.min(1, ft / .7);
      if (Math.random() < .6) part(b.x + frand(-40, 40), b.y + 18, frand(-60, 60), frand(-120, -40), .5, s === 'poison' ? '#9cf06a' : s === 'grave' ? '#ece4cf' : '#8a7a62', 5);
    }
    if (b.mirror > 0) b.mirror = Math.max(0, 1 - ft / .5);
    b.spr = ft < 1.4 ? mspr(b, 'cast', Math.min(8, 1 + Math.floor(ft * 9))) : mspr(b, 'idle', 1 + (Math.floor(c.t * 5) % 4));
    if (!c.shown && ft > .3) { c.shown = true; showCard(b); }
  }
}
function endCut() {
  const c = run.cut, b = c.b;
  run.cut = null; b.hidden = false; b.rise = null; b.mirror = 0;
  if (c.kind === 'intro') {
    document.body.classList.remove('cine'); $('#bossCard').hidden = true;
    $('#bossBar').hidden = false; $('#bossName').textContent = b.name; setBossBar(b);
    banner(b.name, 'danger'); emit('bossSpawn', b);
    ring(P.x, P.y, 20, run.arena.r, .6, 'rgba(180,120,255,.8)', 8);
    if (b.B.hint) hint(`<b>${b.B.name}</b> ${b.B.hint}`);
  }
  enterPhase(b);
}
function showCard(b) {
  const el = $('#bossCard');
  $('#bossCardPre').textContent = run.st.endless ? 'Endlose Nacht' : `Welt ${run.si + 1} · Boss`;
  $('#bossCardName').textContent = b.B.name; $('#bossCardTitle').textContent = b.B.title;
  el.style.setProperty('--c', b.B.col);
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}
// HP-Leiste: Phase und Wut als Klassen; Markierungen bei 66 % und 33 % (CSS), bei 4 Phasen auch 10 %
export function setBossBar(b) {
  const bar = $('#bossBar');
  bar.dataset.ph = String(b.ph + 1); bar.classList.toggle('rage', b.rage); bar.classList.toggle('p4', phaseAt(b).length > 3);
}

// Phase beginnt (nach dem Auftritt bzw. nach der Phasen-Szene)
function enterPhase(b) {
  const ph = phase(b), A = run.arena;
  b.ai.st = 'chase'; b.ai.t = 1.2; b.ai.i = 0; b.phT = 0;
  if (ph.burn) Object.assign(A, { burnTo: 64, burnRate: 40, burnKind: 'fire' });
  // Gift von außen: steigt langsam (~50 s bis zum vollen Ring)
  if (ph.poison) Object.assign(A, { burnTo: 250, burnRate: 5, burnKind: 'toxic' });
  if (ph.storm) run.storm = run.storm || .001;
  if (ph.shield) raiseShield(b);
  if (ph.split) splitBoss(b, ph.split);
  if (ph.vessels) spawnVessels(b, ph.vessels);
  if (ph.clones) spawnClones(b, ph.clones);
  if (ph.pillars) spawnPillars(b);
  if (ph.armor) initArmor(b, ph.armor);
  if (ph.dismount) dismount(b);
  if (ph.schools) setSchool(b, b.school || 'fire');
  else b.school = null;   // Verzweiflung: feste Angriffe, kein Schul-Schein mehr
  if (ph.shades) spawnShades(b, ph.shades);
  setBossBar(b);
}

// Nach jedem Treffer: Phasenwechsel an den Schwellen (Leben bleibt dort stehen, keine Phase wird übersprungen)
export function bossHurt(b) {
  if (b !== run.boss) return;
  const next = phaseAt(b)[b.ph + 1];
  if (next === undefined || b.hp > b.maxHp * next) return;
  b.hp = b.maxHp * next;
  b.ph++;
  startCut('phase', b);
}
// Was ein Treffer am Boss (oder einem seiner Körper) bewirkt; null = normaler Schaden
export function bossDamageRule(b, dmg, kx = 0, ky = 0) {
  // Spiegelbild: nur Schimmer, kein Schaden
  if (b.decoy) { if (b.blkT <= 0) part(b.x + frand(-20, 20), b.y - 40, 0, -40, .4, '#c99bff', 5); b.blkT = .2; return { dmg: 0, blocked: false }; }
  const m = b.link || b;
  if (m.inv > 0 || run.cut) return { dmg: 0, blocked: false };
  // Seelengefäße: solange eins steht, prallt alles ab
  if (vesselsUp(m)) return blockOnce(m);
  if (b.ice > 0) return iceRule(b, dmg, kx, ky);
  if (m.armor > 0) return armorRule(m, dmg);
  return null;
}

function enrage(b) {
  b.rage = true; b.dmg *= 1.5; if (!b.shade) b.tint = 'rage';
  banner(b.B.name + ' wird wütend!', 'danger'); sfx.warn();
  ring(b.x, b.y, 20, 220, .6, 'rgba(255,60,40,.9)', 10);
  setBossBar(b);
}

export function bossAI(b, dt, dx, dy, d) {
  const ai = b.ai, main = b === run.boss;
  if (b.link || b.decoyOf) {
    // Teil von Morgra bzw. Spiegelbild: Wut wie der Boss; Teile laufen versetzt um den Goblin, Spiegelbilder auf ihn zu
    const m = b.link || b.decoyOf;
    b.rage = m.rage; b.tint = m.tint;
    if (b.link) {
      b.dmg = m.dmg; b.hp = m.hp; b.maxHp = m.maxHp;   // Leben nur zur Anzeige/für Prozent-Abfragen
      const a = b.off + run.time * .35, tx = P.x + Math.cos(a) * 150, ty = P.y + Math.sin(a) * 110;
      dx = tx - b.x; dy = ty - b.y; d = Math.hypot(dx, dy) || 1;
    }
    b.blkT -= dt;
  } else if (main) {
    const ph = phase(b);
    b.fightT += dt; b.phT += dt; b.inv -= dt; b.iceCd -= dt; b.blkT -= dt;
    // Wut nach RAGE_AT Sekunden Kampf; Malvorns letzte Phase schon nach 60 s in der Phase
    if (!b.rage && (b.fightT >= nmRageAt(run.nm, RAGE_AT) || (ph.rageIn && b.phT >= ph.rageIn))) enrage(b);
    if (b.ice <= 0 && b.iceT > 0) { b.iceT -= dt; if (b.iceT <= 0 && ph.shield) raiseShield(b); }
    updBurn(dt, b); updRise(b, dt); updPortals(dt); updPillars(b, dt, tempo(b)); updSchools(b, dt);
    if (ph.wind) updWind(dt);
  } else b.blkT -= dt;
  const sp = tempo(b);
  // Blickrichtung: dreht sich zum Spieler, mit Eisschild langsam: im Abstand von 150 px umrundet man ihn mit
  // 1,1 rad/s (Sprint 1,7), er dreht nur 0,6 – nach ~6 s Laufen (gut 2 s Sprint) steht man hinter ihm
  const da = angDiff(Math.atan2(dy, dx), b.fa);
  const turn = (b.ice > 0 ? .6 : 7) * dt;
  if (ai.st !== 'charge' && ai.st !== 'tele') b.fa += clamp(da, -turn, turn);
  b.face = face8(Math.cos(b.fa), Math.sin(b.fa), b.face);
  if (ai.ring2 > 0) { ai.ring2 -= dt; if (ai.ring2 <= 0) bossRing(b, b.ck, Math.PI / (b.ph >= 1 ? 20 : 14)); }
  // Betäubt nach dem Schildbruch
  if (b.stunT > 0) { b.stunT -= dt; b.spr = mspr(b, 'idle', 1); if (Math.random() < .2) part(b.x + frand(-20, 20), b.y - 70, frand(-20, 20), -30, .5, '#ffe27a', 3); return; }
  ai.t -= dt;
  const walk = m => {
    const s = b.spd * sp * m * (b.slowT > 0 ? .6 : 1);
    b.x += Math.cos(b.fa) * s * dt * Math.min(1, d / 60); b.y += Math.sin(b.fa) * s * dt * Math.min(1, d / 60); b.at += dt * m;
  };
  if (ai.st === 'chase') {
    walk(b.ice > 0 ? .7 : 1);
    b.spr = mspr(b, 'walk', ((Math.floor(b.at * 8) % 6) + 1));
    if (ai.t <= 0) {
      // Malvorn: Angriffe seiner aktuellen Schule
      const ph = phase(b), list = ph.schools && b.school ? SCHOOL_ATK[b.school] : ph.atk;
      ai.atk = list[ai.i++ % list.length];
      const A = ATK[ai.atk];
      if (A.special) { ai.st = 'tele'; ai.t = .9 / Math.sqrt(sp); ai.ax = dx / d; ai.ay = dy / d; b.fa = Math.atan2(dy, dx); }
      else { ai.st = 'cast'; b.ft = 0; b.fired = false; b.ck = A.ck(b); b.charge = A.charge / Math.sqrt(sp); ai.reps = (A.reps ? A.reps(b) : 1) - 1; sfx.charge(); }
    }
  } else if (ai.st === 'cast') {
    b.ft += dt;
    if (b.ft < b.charge) {
      b.spr = mspr(b, 'cast', (1 + Math.floor(b.ft * 10) % 4));
      if (Math.random() < dt * 40) { const [tx, ty] = tipPos(b), a = Math.random() * TAU; part(tx + Math.cos(a) * 50, ty + Math.sin(a) * 50, -Math.cos(a) * 140, -Math.sin(a) * 140, .32, CCOL[b.ck] || '#fff', 4); }
    } else {
      const f = Math.floor((b.ft - b.charge) * 12), A = ATK[ai.atk];
      b.spr = mspr(b, 'cast', Math.min(8, 5 + f));
      if (!b.fired) { b.fired = true; const [tx, ty] = tipPos(b); A.fire(b, tx, ty); if (A.chan) { ai.chan = A.chan; } }
      if (f >= 4) {
        if (ai.reps > 0) { ai.reps--; b.ft = b.charge * .6; b.fired = false; }
        else if (A.chan) ai.st = 'chan';
        else { ai.st = 'chase'; ai.t = phase(b).gap / sp; }
      }
    }
  } else if (ai.st === 'chan') {
    // Weiterzaubern (Feuerarme, Spirale, Strahl): Stab erhoben, langsam oder gar nicht laufen
    const A = ATK[ai.atk];
    ai.chan -= dt;
    if (A.move) walk(A.move);
    b.spr = mspr(b, 'cast', 7 + (Math.floor(ai.chan * 8) % 2));
    if (A.tick) A.tick(b, dt);
    if (ai.chan <= 0) { ai.spin = null; ai.st = 'chase'; ai.t = phase(b).gap / sp; }
  } else if (ai.st === 'tele') {
    b.spr = mspr(b, 'idle', ((Math.floor(run.time * 8) % 4) + 1));
    if (ai.t <= 0) { ai.st = 'charge'; ai.t = .75; sfx.whoosh(); }
  } else if (ai.st === 'charge') {
    b.x += ai.ax * 560 * sp * dt; b.y += ai.ay * 560 * sp * dt; b.at += dt * 3;
    b.spr = mspr(b, 'walk', ((Math.floor(b.at * 8) % 6) + 1));
    if (Math.random() < .5) part(b.x + frand(-20, 20), b.y + 30, frand(-30, 30), frand(-30, 0), .4, 'rgba(200,190,170,.7)', 6);
    if (b.mount && Math.random() < .25) run.shake = Math.max(run.shake, 3);
    if (ai.t <= 0) { ai.st = 'chase'; ai.t = phase(b).gap / sp; }
  }
}
