import { RNG, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { DIR8, TAU, face8 } from '../core/util.js';
import { ETYPES, SCHOOL_COL } from '../data/enemies.js';
import { MAGE_OFF, U } from '../render/sprites.js';
import { STAGE_LEN } from '../data/stages.js';
import { bossAI, spawnBoss } from './boss.js';
import { CASTS, castAllowed, castWindup } from './casts.js';
import { damagePlayer, hurt } from './combat.js';
import { animFx, part, ring } from './fx.js';
import { hint } from './run.js';
import { affixDamage, affixNames, affixOnDeath, rollAffixes, updAffixes } from './affixes.js';
import { P, onScreen, pR, query, run, viewR } from './state.js';
import { banner } from '../ui/hud.js';

export { eShot } from './casts.js';

// ---------- Gegner ----------
export const SPAWN_T = .4;
const has = (e, t) => e.traits && e.traits.includes(t);


// Sprite-Name: m.<schule>[.m|.c].<anim>.<richtung>.<n> (Magier) oder n.<art>.<anim>.<richtung>.<n> (Diener)
export const mageKey = (school, master, clone) => 'm.' + school + (master ? '.m' : clone ? '.c' : '');
export const typeSprite = T => T.sprite ? 'n.' + T.sprite : T.draw ? null : mageKey(T.school, T.role === 'master', T.clone);
export const mspr = (e, anim, n, face = e.face) => `${e.pre}.${anim}.${face}.${n}`;
// Stabspitze im Abschuss-Frame (aus dem Generator), skaliert wie das Sprite
export const tipPos = e => { const o = MAGE_OFF[e.pre] && MAGE_OFF[e.pre][e.face]; if (!o) return [e.x, e.y - 20 * e.sc]; const s = U * e.sc; return [e.x + o[0] * s, e.y + o[1] * s]; };

export function spawnEnemy(type, opt = {}) {
  const T = ETYPES[type], st = run.st;
  const tf = 1 + (run.time / 85) * (1 + run.si * .15), lf = 1 + run.loop * 1.2;
  let x = opt.x, y = opt.y;
  if (x === undefined) { const a = RNG.spawn.next() * TAU, R = viewR() + 60; x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R; }
  const e = {
    type, pre: typeSprite(T), x, y, r: T.r, sc: T.sc, spd: T.spd * RNG.spawn.range(.9, 1.1), dmg: T.dmg * st.dmg * (1 + run.time / 400) * lf,
    hp: T.hp * st.hp * tf * lf, xp: T.xp, tint: null, school: T.school, ai: T.ai, keep: T.keep || 0, traits: T.traits || null, melee: T.melee || null,
    casts: (T.casts || []).map(c => ({ ...c, t: RNG.spawn.range(1.5, c.cd[1]) })),
    bomber: has(T, 'bomber'), obj: !!T.draw, clone: !!T.clone, side: RNG.spawn.next() < .5 ? 1 : -1,
    state: 'walk', face: 'down', at: RNG.spawn.next() * 5, ft: 0, fired: false, ck: null, charge: 0, chain: null, fuse: 0,
    kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, spr: null, dead: false, shield: 0,
  };
  if (opt.mini) { e.sc *= .65; e.r *= .7; e.hp *= .3; e.xp = Math.ceil(e.xp / 3); e.mini = true; }
  if (opt.elite) { e.elite = true; e.hp *= 14; e.sc *= 1.6; e.r *= 1.6; e.dmg *= 1.5; e.xp = 30; e.tint = 'gold'; e.spd *= .85; rollAffixes(e); }
  e.maxHp = e.hp;
  // Sichtbare Spawns kommen durch ein Portal (0,4 s, solange nicht angreifbar)
  if (opt.x !== undefined || onScreen(x, y, 40)) { e.spawnT = SPAWN_T; if (onScreen(x, y)) sfx.portal(); }
  run.enemies.push(e);
  if (!run.seen.has(type) && T.tip) { run.seen.add(type); if (type !== 'fire_mage' || run.si === 0) hint(`<b>${T.name}</b> ${T.tip}`); }
  return e;
}
// Manche Gegner kommen nur zu zweit (Donnerpriester)
function spawnGroup(type) {
  const e = spawnEnemy(type), n = ETYPES[type].group || 1;
  for (let i = 1; i < n; i++) {
    const a = Math.atan2(e.y - P.y, e.x - P.x) + (i % 2 ? .45 : -.45), R = Math.hypot(e.x - P.x, e.y - P.y);
    spawnEnemy(type, { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R });
  }
}

export function doEvent(ev) {
  if (ev.k === 'elite') {
    // Elite: nur normale Magier (Meister mit ×14 Leben wären zu viel)
    const types = run.st.mix.filter(m => ETYPES[m[0]].role === 'mage' && run.time >= m[2]).map(m => m[0]);
    const el = spawnEnemy(RNG.spawn.pick(types.length ? types : ['fire_mage']), { elite: true });
    banner(el.affixes.length ? 'Elite: ' + affixNames(el) + '!' : 'Elite-Magier!', '');
  } else if (ev.k === 'swarm') {
    const n = 36, R = viewR() * .85, [main, extra] = run.st.swarm;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(i % 6 === 0 && extra ? extra : main, { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); }
    banner('Ansturm!', 'danger');
  } else if (ev.k === 'warn') { banner('Der Boss naht …', 'danger'); sfx.warn(); }
  else if (ev.k === 'boss') spawnBoss();
}
export function spawnTick(dt) {
  if (run.boss) return;
  const t = run.time - run.loop * STAGE_LEN;
  const rate = (.55 + t * .026 + run.loop * 2) * run.st.rate;
  const cap = Math.min(280, 70 + t * .9 + run.loop * 60);
  run.spawnAcc += rate * dt;
  while (run.spawnAcc >= 1) {
    run.spawnAcc -= 1;
    if (run.enemies.length >= cap) continue;
    const opts = run.st.mix.filter(m => t >= m[2] || run.loop > 0);
    let tot = 0; for (const m of opts) tot += m[1];
    let r = RNG.spawn.next() * tot, type = opts[0][0];
    for (const m of opts) { r -= m[1]; if (r <= 0) { type = m[0]; break; } }
    spawnGroup(type);
  }
}

function startCast(e, c) {
  e.state = 'cast'; e.ft = 0; e.fired = false; e.ck = c.id; e.cur = c; e.charge = castWindup(c.id);
  e.face = face8(P.x - e.x, P.y - e.y, e.face);
  const C = CASTS[c.id];
  if (C.start) { run.caster = e; C.start(e); run.caster = null; }
  if (onScreen(e.x, e.y) && !e.clone) sfx.charge();
}

// ---------- Bewegung ----------
function move(e, dt, dx, dy, d) {
  let mx = dx / d, my = dy / d;
  if (e.ai === 'still') return [0, 0];
  if (e.ai === 'kite' && e.keep && d < e.keep) { mx = -dx / d * .5 - dy / d * .8 * e.side; my = -dy / d * .5 + dx / d * .8 * e.side; }
  else if (e.ai === 'kite' && e.keep && d < e.keep + 60) { mx = -dy / d * e.side; my = dx / d * e.side; }   // im Wunschabstand seitlich laufen
  else if (e.ai === 'zigzag') { const w = Math.sin(run.time * 6 + e.at * 3) * 1.1; mx = (dx - dy * w) / d; my = (dy + dx * w) / d; const l = Math.hypot(mx, my); mx /= l; my /= l; }
  return [mx, my];
}

export function updEnemy(e, dt) {
  if (e.spawnT > 0) {
    e.spawnT -= dt; e.face = face8(P.x - e.x, P.y - e.y, e.face);
    if (e.pre) e.spr = mspr(e, 'idle', 1);
    return;
  }
  if (e.affixes) updAffixes(e, dt, spawnEnemy);
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) e.slowT -= dt;
  e.x += e.kx * dt; e.y += e.ky * dt;
  const kd = Math.exp(-9 * dt); e.kx *= kd; e.ky *= kd;
  if (e.freezeT > 0) { e.freezeT -= dt; return; }
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.boss) { bossAI(e, dt, dx, dy, d); return; }
  if (e.bomber) { updBomber(e, dt, dx, dy, d); return; }
  if (e.obj) { updObject(e, dt); return; }
  // Ansturm (Paladin): fest in eine Richtung, Kontakt schadet
  if (e.dash) {
    e.dash.t -= dt; e.x += e.dash.vx * dt; e.y += e.dash.vy * dt; e.at += dt * 3;
    if (Math.random() < .5) part(e.x + frand(-14, 14), e.y + 20 * e.sc, frand(-30, 30), frand(-30, 0), .4, 'rgba(255,250,220,.8)', 5);
    e.spr = mspr(e, 'walk', (Math.floor(e.at * 9) % 6) + 1);
    if (e.dash.t <= 0) { e.dash = null; e.state = 'walk'; }
    return;
  }
  if (e.state === 'cast') {
    e.ft += dt * (e.slowT > 0 ? .6 : 1);
    const C = CASTS[e.ck];
    if (e.ft < e.charge) {
      e.spr = mspr(e, 'cast', 1 + Math.floor(e.ft * 10) % 4);
      if (C.aim) e.face = face8(dx, dy, e.face);
      if (Math.random() < dt * 25) { const [tx, ty] = tipPos(e), a = Math.random() * TAU; part(tx + Math.cos(a) * 22 * e.sc, ty + Math.sin(a) * 22 * e.sc, -Math.cos(a) * 70, -Math.sin(a) * 70, .28, C.col, 2.5); }
    } else {
      const f = Math.floor((e.ft - e.charge) * 14);
      if (!e.fired) {
        e.fired = true; e.cur.t = rand(e.cur.cd[0], e.cur.cd[1]);
        const [tx, ty] = tipPos(e);
        run.caster = e; C.release(e, tx, ty, spawnEnemy); run.caster = null;   // Geschosse/Zonen merken sich den Zaubernden
      }
      if (e.dash) return;
      if (f >= 4) {
        e.state = 'walk';
        if (e.chain) { const k = e.chain; e.chain = null; startCast(e, e.casts.find(c => c.id === k) || { id: k, cd: [4, 6] }); }
      } else e.spr = mspr(e, 'cast', 5 + f);
    }
    return;
  }
  const [mx, my] = move(e, dt, dx, dy, d);
  const sp = e.spd * (e.slowT > 0 ? .5 : 1);
  e.x += mx * sp * dt; e.y += my * sp * dt;
  e.face = face8(dx, dy, e.face); e.at += dt * (e.slowT > 0 ? .5 : 1);
  e.spr = mspr(e, 'walk', (Math.floor(e.at * 9) % 6) + 1);
  // Zauber: der erste, der bereit ist und gewirkt werden darf
  for (const c of e.casts) {
    c.t -= dt;
    if (c.t > 0 || e.state === 'cast') continue;
    if (d < c.range && onScreen(e.x, e.y, -20)) { if (castAllowed(e, c)) startCast(e, c); else c.t = .6; }
  }
  if (d > viewR() * 1.9 && !e.elite) { e.px = e.x = P.x + dx / d * viewR() * 1.1; e.py = e.y = P.y + dy / d * viewR() * 1.1; }
}

// Objekte: Portal spuckt Lehrlinge, Knochenhaufen steht wieder auf
function updObject(e, dt) {
  if (has(e, 'portal')) {
    e.spawnCd -= dt;
    if (e.spawnCd <= 0 && run.enemies.length < 260) { e.spawnCd = 3; const a = rand(0, TAU); spawnEnemy('shadow_apprentice', { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30 }).spawnT = .3; }
    if (e.portalOf && e.portalOf.dead) e.hp -= dt * 8;   // ohne Leerenwandler zerfällt das Portal langsam
    if (e.hp <= 0) { e.dead = true; ring(e.x, e.y, 10, 60, .4, 'rgba(180,110,255,.9)', 5); }
  } else if (has(e, 'bones')) {
    e.revT -= dt;
    if (e.revT <= 0) {
      e.dead = true;
      const o = spawnEnemy('necro_apprentice', { x: e.x, y: e.y }); o.noRevive = true; o.spawnT = .3;
      ring(e.x, e.y, 6, 40, .35, 'rgba(120,255,110,.8)', 4);
    }
  }
}

export function updBomber(e, dt, dx, dy, d) {
  if (e.fuse > 0) {
    e.fuse -= dt; e.spr = mspr(e, 'idle', 1 + Math.floor(e.fuse * 12) % 4);
    if (Math.random() < .5) part(e.x + frand(-6, 6), e.y - 26 * e.sc, frand(-40, 40), frand(-80, -30), .3, '#ffd84a', 2.5);
    if (e.fuse <= 0) bomberBoom(e, true);
    return;
  }
  const sp = e.spd * (e.slowT > 0 ? .5 : 1);
  e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
  e.face = face8(dx, dy, e.face); e.at += dt;
  e.spr = mspr(e, 'walk', (Math.floor(e.at * 12) % 6) + 1);
  if (d < 70) { e.fuse = .85; sfx.fuse(); }
  if (d > viewR() * 1.9) { e.px = e.x = P.x + dx / d * viewR() * 1.1; e.py = e.y = P.y + dy / d * viewR() * 1.1; }
}
export function bomberBoom(e, hurtPlayer) {
  if (e.boomed) return; e.boomed = true;
  const R = 80;
  if (hurtPlayer && Math.hypot(P.x - e.x, P.y - e.y) < R + pR()) damagePlayer(14 * run.st.dmg * (1 + run.time / 400), 'bomb');
  e.dead = true;
  query(e.x, e.y, R, o => { if (o !== e) { const d = Math.hypot(o.x - e.x, o.y - e.y) || 1; hurt(o, (25 + run.time * .12) * (hurtPlayer ? .5 : 1.5), 220, (o.x - e.x) / d, (o.y - e.y) / d, '#ffb35c'); } });
  animFx('f_fireball_hit_', 5, e.x, e.y, R / 16); sfx.boom(); run.shake = Math.max(run.shake, 6);
}

// Treffer-Regeln je Gegner (vor dem Abziehen der Lebenspunkte). Gibt den Schaden zurück, der durchkommt.
export function damageRules(e, dmg, kx, ky) {
  if (e.affixes) { dmg = affixDamage(e, dmg, kx, ky); if (dmg <= 0) return { dmg: 0, blocked: true }; }
  // Gletscherwächter: Eisschild vorne blockt fast alles, was aus Blickrichtung kommt
  if (has(e, 'frontShield') && (kx || ky)) {
    const fa = DIR8.indexOf(e.face) * Math.PI / 4, l = Math.hypot(kx, ky);
    if ((kx * Math.cos(fa) + ky * Math.sin(fa)) / l < -.4) {
      for (let i = 0; i < 3; i++) part(e.x + Math.cos(fa) * 20 * e.sc, e.y + Math.sin(fa) * 20 * e.sc - 10, frand(-80, 80), frand(-80, 20), .3, '#dff6ff', 3);
      return { dmg: dmg * .15, blocked: true };
    }
  }
  // Schild vom Schildpriester schluckt zuerst
  if (e.shield > 0) {
    const a = Math.min(e.shield, dmg); e.shield -= a; dmg -= a;
    if (e.shield <= 0) { ring(e.x, e.y - 10, 10, 40 * e.sc, .3, 'rgba(255,220,110,.9)', 4); }
  }
  return { dmg, blocked: false };
}

// Was beim Tod passiert (Teilen, Knochenhaufen, Grab für den Lich)
export function deathRules(e) {
  if (e.affixes) affixOnDeath(e, spawnEnemy);
  if (has(e, 'split') && !e.mini) {
    for (const s of [-1, 1]) { const o = spawnEnemy(e.type, { x: e.x + s * 24, y: e.y, mini: true }); o.spawnT = .25; o.traits = null; }
  }
  if (has(e, 'revive') && !e.noRevive) {
    const b = spawnEnemy('bone_pile', { x: e.x, y: e.y }); b.revT = 3; b.spawnT = 0;
  }
  if (!e.obj && !e.clone && !e.boss && e.pre && e.pre.startsWith('m.')) {
    run.graves.push({ x: e.x, y: e.y }); if (run.graves.length > 10) run.graves.shift();
  }
  if (e.cloneOf === undefined) for (const o of run.enemies) if (o.cloneOf === e && !o.dead) { o.dead = true; ring(o.x, o.y, 6, 30, .3, 'rgba(200,160,255,.8)', 3); }
}
export const schoolCol = e => SCHOOL_COL[e.school] || '#ffffff';
