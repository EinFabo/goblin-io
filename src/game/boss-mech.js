import { RNG, rnd, frand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU, clamp } from '../core/util.js';
import { BOSSES, BOSS_IDS, bossVariant } from '../data/bosses.js';
import { SCHOOL_COL } from '../data/enemies.js';
import { phase } from './boss-atk.js';
import { makeBoss } from './boss.js';
import { damagePlayer } from './combat.js';
import { animFx, part, puff, ring } from './fx.js';
import { addHaz } from './hazards.js';
import { spawnEnemy } from './enemies.js';
import { hint } from './run.js';
import { P, run } from './state.js';
import { banner } from '../ui/hud.js';

// ---------- Besondere Boss-Mechaniken (PLAN 6.3) ----------
// Der Ablauf (Phasen, Angriffe) steht in boss.js / boss-atk.js; hier, was einzelne Bosse zusätzlich tun.
// Weltzustand eines Kampfes (Portale, Säulen, Wind) liegt im Lauf und wird mit clearBossWorld() abgeräumt.

export function clearBossWorld() { run.portals = []; run.pillars = []; run.wind = null; }
// Weitere Körper eines Bosses: Morgras Teile, Spiegelbilder, Malvorns Schatten (eigene Gegner mit Bild des Bosses)
function body(b, extra) {
  const e = { ...b, ph: 0, xp: 0, ice: 0, vessels: null, armor: 0, rise: null, flash: .3, at: rnd() * 5, ...extra };
  e.ai = { st: 'chase', t: 1.2 + rnd(), i: 0, atk: null, reps: 0, ring2: 0, ax: 0, ay: 0, chan: 0, spin: null };
  run.enemies.push(e);
  return e;
}

// ---------- Morgra: Teilen ----------
// Teile (link) laufen versetzt um den Goblin und zaubern Pfützen und Gas. Treffer auf ein Teil gehen auf das
// gemeinsame Leben (combat.js hurt), sterben tun alle mit dem Boss.
const SPLIT_SC = { 2: 2.1, 3: 1.8 };
export function splitBoss(b, n) {
  for (const e of run.enemies) if (e.link === b && !e.dead) { e.dead = true; puff(e.x, e.y, e.sc); }
  b.split = n; b.sc = SPLIT_SC[n] || b.sc; b.r = 38 * b.sc / 2.7;
  for (let i = 1; i < n; i++) {
    const a = Math.atan2(b.y - P.y, b.x - P.x) + i * TAU / n;
    const l = body(b, { link: b, x: b.x + Math.cos(a) * 90, y: b.y + Math.sin(a) * 60, B: { ...b.B, phases: [{ atk: ['gas', 'puddles'], gap: 4 }] }, off: a });
    l.ai.t = 1.5 + i * .9; l.ai.i = i % 2;
    ring(l.x, l.y, 10, 90, .4, b.B.col, 6);
    for (let k = 0; k < 14; k++) part(l.x, l.y - 20, frand(-160, 160), frand(-160, 40), .5, '#9cf06a', 5);
  }
  sfx.boom();
}

// ---------- Knochenhand: Seelengefäße und Geister ----------
export function spawnVessels(b, n) {
  const A = run.arena;
  b.vessels = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * TAU / n, v = spawnEnemy('soul_vessel', { x: A.x + Math.cos(a) * A.r * .62, y: A.y + Math.sin(a) * A.r * .62 });
    v.hp = v.maxHp = b.maxHp * .045; v.of = b;
    b.vessels.push(v);
  }
}
export const vesselsUp = b => !!(b.vessels && b.vessels.some(v => !v.dead));
// Phase 3: tote Skelette stehen als Geister wieder auf
export function bossOnKill(e) {
  const b = run.boss;
  if (!b || e.type !== 'skeleton' || !phase(b).ghosts) return;
  (b.rise || (b.rise = [])).push({ x: e.x, y: e.y, t: 1.2 });
}
export function updRise(b, dt) {
  if (!b.rise || !b.rise.length) return;
  let ghosts = run.enemies.reduce((n, e) => n + (e.type === 'ghost' && !e.dead ? 1 : 0), 0);
  for (const r of b.rise) {
    r.t -= dt;
    if (Math.random() < .3) part(r.x + frand(-10, 10), r.y, 0, -60, .5, '#7bff6a', 3);
    if (r.t <= 0 && ghosts < 14) { spawnEnemy('ghost', { x: r.x, y: r.y }); ghosts++; }
  }
  b.rise = b.rise.filter(r => r.t > 0);
}

// ---------- Frostbart: Eisschild ----------
// kx/ky: Rückstoß-Richtung des Treffers (vom Angreifer weg). Ohne Richtung (Flächen, Gift) zählt, wo der Goblin steht.
export function iceRule(b, dmg, kx, ky) {
  const from = kx || ky ? Math.atan2(-ky, -kx) : Math.atan2(P.y - b.y, P.x - b.x);
  let da = from - b.fa; da = Math.atan2(Math.sin(da), Math.cos(da));
  if (Math.abs(da) > 1.9) {
    // von hinten: trifft und knackt den Schild
    if (b.iceCd <= 0) {
      b.iceCd = .3; b.ice--; sfx.frost();
      const bx = b.x - Math.cos(b.fa) * 30, by = b.y - Math.sin(b.fa) * 20 - 20;
      for (let i = 0; i < 8; i++) part(bx, by, frand(-120, 120), frand(-140, 20), .4, '#dff6ff', 4);
      if (b.ice <= 0) breakShield(b);
    }
    return { dmg, blocked: false };
  }
  return blockOnce(b);
}
// „Block“ höchstens alle 0,35 s anzeigen (sonst Zahlen-Regen)
export function blockOnce(b) {
  if (b.blkT > 0) return { dmg: 0, blocked: false };
  b.blkT = .35;
  return { dmg: 0, blocked: true };
}
export function raiseShield(b) {
  b.ice = 3; b.iceT = 0;
  sfx.frost(); ring(b.x, b.y - 20, 10, 90, .4, '#dff6ff', 6);
  if (!run.seen.has('bossShield')) { run.seen.add('bossShield'); hint('<b>Eisschild</b> Vorne prallt alles ab. Lauf hinter ihn – 3 Treffer in den Rücken brechen den Schild.'); }
}
function breakShield(b) {
  b.iceT = phase(b).shield; b.stunT = 1.4; b.vuln = Math.max(b.vuln || 0, .3); b.vulnT = 2.5;
  run.shake = Math.max(run.shake, 8); sfx.boom();
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24; part(b.x, b.y - 20, Math.cos(a) * 260, Math.sin(a) * 200, .55, i % 2 ? '#dff6ff' : '#8fe6ff', 5); }
  banner('Schild gebrochen!', 'ice');
}

// ---------- Ignaz / Morgra: Rand der Arena ----------
// Ignaz Phase 3: der Rand brennt (wächst auf burnTo px). Morgra Phase 3: Gift steigt von außen (langsam und breit).
export function updBurn(dt, b) {
  const A = run.arena; if (!A || !A.burnTo) return;
  A.burn = Math.min(A.burnTo, A.burn + A.burnRate * dt);
  if (Math.hypot(P.x - A.x, P.y - A.y) > A.r - 22 - A.burn) damagePlayer(b.dmg * (A.burnKind === 'toxic' ? .18 : .3), A.burnKind === 'toxic' ? 'poison' : 'burn');
}

// Feuerarme drehen sich mit dem Boss (vom Gefahren-Update aufgerufen)
// track: dreht sich mit höchstens w rad/s zum Goblin (Lebensraub-Strahl)
export function spinHaz(h, dt) {
  const s = h.spin, o = h.owner;
  if (s.track) { let da = Math.atan2(P.y - o.y + 10, P.x - o.x) - s.a; da = Math.atan2(Math.sin(da), Math.cos(da)); s.a += clamp(da, -s.w * dt, s.w * dt); }
  else s.a += s.w * dt * (h.warn > 0 ? .25 : 1);
  h.x = o.x; h.y = o.y - 10; h.x2 = o.x + Math.cos(s.a) * s.len; h.y2 = o.y - 10 + Math.sin(s.a) * s.len;
}

// ---------- Spiegelmeister: Spiegelbilder und Portale ----------
// Spiegelbilder (decoy) haben kein Schatten-Ellipse im Bild (Generator: clone), schießen harmlose Trugbilder
// und nehmen keinen Schaden. Nur der echte Spiegelmeister wirft einen Schatten.
export function spawnClones(b, n) {
  for (const e of run.enemies) if (e.decoyOf === b && !e.dead) { e.dead = true; puff(e.x, e.y, e.sc); }
  for (let i = 0; i < n; i++) body(b, { decoy: true, decoyOf: b, dmg: 0, pre: 'm.' + bossVariant(b.id) + '-c', B: { ...b.B, phases: [{ atk: ['bolts', 'fan'], gap: 2.6 }] } });
  blinkBoss(b);
}
// Alle Körper (echter + Spiegelbilder) tauschen die Plätze auf einem Kreis um den Goblin
export function blinkBoss(b) {
  const bodies = [b, ...run.enemies.filter(e => e.decoyOf === b && !e.dead)], A = run.arena, n = bodies.length;
  const a0 = rnd() * TAU, R = n > 1 ? 230 : 260, order = bodies.map((_, i) => i).sort(() => rnd() - .5);
  bodies.forEach((e, k) => {
    puff(e.x, e.y, e.sc * .6); animFx('p.shade_hit.', 5, e.x, e.y - 30, 3);
    const a = a0 + order[k] * TAU / n;
    let x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R * .8;
    if (A) { const dx = x - A.x, dy = y - A.y, d = Math.hypot(dx, dy); if (d > A.r - 60) { x = A.x + dx / d * (A.r - 60); y = A.y + dy / d * (A.r - 60); } }
    e.x = e.px = x; e.y = e.py = y; e.flash = .2;
    e.fa = Math.atan2(P.y - y, P.x - x);
    if (e !== b) { e.ai.st = 'chase'; e.ai.t = .7 + rnd() * .8; }
  });
  sfx.portal();
}
// Phase 3: Spiegeltor vor dem Boss, Ausgang neben dem Goblin (4,5 s)
export function makePortal(b) {
  const a = Math.atan2(P.y - b.y, P.x - b.x), A = run.arena, o = rnd() * TAU;
  let bx = P.x + Math.cos(o) * 220, by = P.y + Math.sin(o) * 170;
  if (A) { const dx = bx - A.x, dy = by - A.y, d = Math.hypot(dx, dy); if (d > A.r - 50) { bx = A.x + dx / d * (A.r - 50); by = A.y + dy / d * (A.r - 50); } }
  const pt = { ax: b.x + Math.cos(a) * 110, ay: b.y + Math.sin(a) * 80 - 20, bx, by, t: 4.5, dur: 4.5 };
  run.portals.push(pt);
  ring(pt.ax, pt.ay, 5, 50, .4, 'rgba(178,107,255,.9)', 5); ring(pt.bx, pt.by, 5, 50, .4, 'rgba(178,107,255,.9)', 5);
  return pt;
}
// Geschoss am Eingang → kommt am Ausgang heraus und fliegt auf den Goblin zu (von hazards.js updEProj)
export function portalWarp(p) {
  for (const pt of run.portals) {
    if ((p.x - pt.ax) ** 2 + (p.y - pt.ay) ** 2 > 36 * 36) continue;
    const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(P.y - 6 - pt.by, P.x - pt.bx);
    p.x = pt.bx; p.y = pt.by; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.a = a; p.warp = false;
    animFx('p.shade_hit.', 5, pt.bx, pt.by, 1.5);
    return;
  }
}
export function updPortals(dt) {
  for (const pt of run.portals) pt.t -= dt;
  run.portals = run.portals.filter(pt => pt.t > 0);
}

// ---------- Tempestra: Blitzsäulen und Sturm ----------
// 4 Säulen im Quadrat, Strahlen springen zwischen Paaren: erst die zwei Waagrechten, dann die Senkrechten, dann die Diagonalen
const BEAMS = [[[0, 1], [3, 2]], [[0, 3], [1, 2]], [[0, 2], [1, 3]]];
export function spawnPillars(b) {
  if (run.pillars.length) return;
  const A = run.arena;
  run.pillars = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ x: A.x + sx * 175, y: A.y + sy * 150 }));
  for (const pl of run.pillars) { ring(pl.x, pl.y, 10, 80, .5, 'rgba(255,230,90,.9)', 6); run.shake = Math.max(run.shake, 8); }
  b.beamT = 1.5; b.beamI = 0; sfx.ezap();
}
export function updPillars(b, dt, sp) {
  if (!run.pillars.length) return;
  b.beamT -= dt;
  if (b.beamT > 0) return;
  b.beamT = 3.6 / sp;
  for (const [i, j] of BEAMS[b.beamI++ % BEAMS.length]) {
    const p = run.pillars[i], q = run.pillars[j];
    addHaz({ shape: 'line', x: p.x, y: p.y - 40, x2: q.x, y2: q.y - 40, w: 30, warn: 1.1, act: 1.8, tick: .3, dmg: b.dmg * .4, kind: 'storm', src: 'beam' });
  }
}
// Phase 3: Sturm schiebt den Goblin, alle 6 s eine neue Richtung (1 s vorher angekündigt)
export function updWind(dt) {
  const w = run.wind || (run.wind = { a: rnd() * TAU, na: null, t: 5, str: 0 });
  w.t -= dt;
  if (w.t <= 0) {
    if (w.na === null) { w.na = Math.round(rnd() * 8) * TAU / 8; w.t = 1; banner('Der Wind dreht!', ''); }
    else { w.a = w.na; w.na = null; w.t = 5; w.str = 0; }
  }
  w.str = Math.min(1, w.str + dt * .8);
  const k = w.na === null ? w.str : w.str * Math.max(.3, w.t);   // in der Warnsekunde lässt er nach
  P.x += Math.cos(w.a) * 78 * k * dt; P.y += Math.sin(w.a) * 78 * k * dt;
  if (Math.random() < dt * 40 * k) part(P.x + frand(-300, 300) - Math.cos(w.a) * 200, P.y + frand(-200, 200) - Math.sin(w.a) * 200, Math.cos(w.a) * 520, Math.sin(w.a) * 520, .5, 'rgba(230,240,255,.6)', 2);
}

// ---------- Gromm: Golem und Rüstung ----------
// Phase 2: 4 Platten; solange eine hält, kommt nur ein Viertel des Schadens durch, der Rest schlägt die Platte ab.
export function initArmor(b, n) { b.armor = n; b.armorHp = b.maxHp * .03; b.armorMax = b.armorHp; banner('Rüstung!', ''); sfx.stomp(); }
export function armorRule(b, dmg) {
  b.armorHp -= dmg * .75;
  if (b.armorHp <= 0) {
    b.armor--; b.armorHp = b.armorMax;
    run.shake = Math.max(run.shake, 7); sfx.boom();
    const a = b.fa + Math.PI * (b.armor % 2) + (b.armor > 1 ? Math.PI / 2 : 0);
    for (let i = 0; i < 14; i++) part(b.x + Math.cos(a) * 30, b.y - 30, Math.cos(a) * 200 + frand(-80, 80), frand(-200, -40), .6, i % 2 ? '#8a7a62' : '#6a5c48', 6);
    if (!b.armor) banner('Rüstung ab!', '');
  }
  return { dmg: dmg * .25, blocked: false };
}
// Phase 3: der Golem zerbricht, Gromm zu Fuß – kleiner und schneller
export function dismount(b) {
  if (!b.mount) return;
  b.mount = false; b.sc = 2; b.r = 30; b.spd *= 1.6;
  run.shake = Math.max(run.shake, 16); sfx.boom(); sfx.stomp();
  for (let i = 0; i < 40; i++) { const a = i * TAU / 40; part(b.x, b.y - 30, Math.cos(a) * frand(120, 320), Math.sin(a) * frand(80, 240) - 60, .8, i % 3 ? '#8a7a62' : '#6a5c48', frand(5, 9)); }
  ring(b.x, b.y, 10, 200, .6, 'rgba(201,163,106,.9)', 10);
}

// ---------- Malvorn: Schulen und Schatten früherer Bosse ----------
export const SCHOOL_ORDER = ['fire', 'frost', 'storm', 'toxic', 'shadow', 'necro', 'earth', 'light'];
export const SCHOOL_ATK = {
  fire: ['fan', 'meteors'], frost: ['spears', 'icefloor'], storm: ['strikes', 'chain'], toxic: ['puddles', 'gas'],
  shadow: ['blink', 'bolts'], necro: ['skeletons', 'cage'], earth: ['quake', 'rocks'], light: ['ring', 'spiral'],
};
const SCHOOL_NAME = { fire: 'Feuer', frost: 'Frost', storm: 'Sturm', toxic: 'Gift', shadow: 'Schatten', necro: 'Nekromantie', earth: 'Erde', light: 'Licht' };
export function setSchool(b, s) {
  b.school = s; b.schoolT = phase(b).schools; b.ai.i = 0;
  const col = SCHOOL_COL[s];
  ring(b.x, b.y, 10, 160, .5, col, 8);
  for (let i = 0; i < 20; i++) { const a = i * TAU / 20; part(b.x, b.y - 40, Math.cos(a) * 200, Math.sin(a) * 150, .5, col, 5); }
  if (b.schoolT >= 10) hint(`<b>Malvorn</b> wechselt zu ${SCHOOL_NAME[s]}!`);
  sfx.cast();
}
export function updSchools(b, dt) {
  const ph = phase(b); if (!ph.schools) return;
  b.schoolT -= dt;
  if (b.schoolT <= 0) setSchool(b, SCHOOL_ORDER[(SCHOOL_ORDER.indexOf(b.school) + 1) % SCHOOL_ORDER.length]);
}
// Phase 2: zwei frühere Bosse als Schatten (je 20 % von Malvorns Leben, Angriffe ihrer ersten Phase)
export function spawnShades(b, n) {
  const pool = BOSS_IDS.filter(id => id !== b.id), A = run.arena, names = [];
  for (let i = 0; i < n && pool.length; i++) {
    const id = pool.splice(Math.floor(RNG.spawn.next() * pool.length), 1)[0], a = Math.atan2(b.y - A.y, b.x - A.x) + (i ? 2.2 : -2.2);
    const s = makeBoss(id, { x: A.x + Math.cos(a) * 220, y: A.y + Math.sin(a) * 180 });
    Object.assign(s, { shade: true, of: b, tint: 'shade', hp: b.maxHp * .2, maxHp: b.maxHp * .2, dmg: b.dmg * .8, xp: 30, flash: .4 });
    if (s.mount) s.sc = 2.3;
    s.ai.t = 1.5 + i;
    run.enemies.push(s);
    names.push(BOSSES[id].name);
    ring(s.x, s.y, 10, 140, .6, 'rgba(120,60,200,.9)', 8);
    for (let k = 0; k < 24; k++) part(s.x, s.y - 30, frand(-200, 200), frand(-220, 40), .6, '#6a3ab0', 6);
  }
  banner('Schatten: ' + names.join(' und '), 'danger');
}
export function shadeDown(e) {
  for (let i = 0; i < 24; i++) part(e.x, e.y - 30, frand(-220, 220), frand(-240, 40), .6, '#6a3ab0', 6);
  ring(e.x, e.y, 10, 160, .5, 'rgba(120,60,200,.9)', 8);
  for (const o of run.enemies) if (o.decoyOf === e || o.link === e) { o.dead = true; puff(o.x, o.y, o.sc); }
}
