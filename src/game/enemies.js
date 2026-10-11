import { RNG, rnd, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU, faceOf } from '../core/util.js';
import { CCOL, CHARGE, ETYPES, OFF } from '../data/enemies.js';
import { STAGE_LEN } from '../data/stages.js';
import { bossAI, spawnBoss } from './boss.js';
import { damagePlayer, hurt } from './combat.js';
import { addNum, animFx, part, puff, ring } from './fx.js';
import { hint } from './run.js';
import { P, onScreen, pR, query, run, viewR } from './state.js';
import { U } from '../render/sprites.js';
import { banner } from '../ui/hud.js';

// ---------- Gegner ----------
export function spawnEnemy(type, opt = {}) {
  const T = ETYPES[type], st = run.st;
  const tf = 1 + (run.time / 85) * (1 + run.si * .15), lf = 1 + run.loop * 1.2;
  let x = opt.x, y = opt.y;
  if (x === undefined) { const a = RNG.spawn.next() * TAU, R = viewR() + 60; x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R; }
  const pre = type === 'imp' ? (RNG.spawn.next() < .5 ? 'f_' : 'e_') : (['frost', 'storm', 'void', 'healer'].includes(type) ? 'e_' : 'f_');
  const e = {
    type, pre, x, y, r: T.r, sc: T.sc, spd: T.spd * RNG.spawn.range(.9, 1.1), dmg: T.dmg * st.dmg * (1 + run.time / 400) * lf,
    hp: T.hp * st.hp * tf * lf, cast: T.cast, cd: T.cd, range: T.range, castCd: T.cd ? RNG.spawn.range(1.5, T.cd[1]) : 0, xp: T.xp, tint: T.tint || null,
    keep: T.keep || 0, bomber: !!T.bomber, side: RNG.spawn.next() < .5 ? 1 : -1,
    state: 'walk', face: 'down', at: RNG.spawn.next() * 5, ft: 0, fired: false, ck: null, charge: 0, chain: null, fuse: 0,
    kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, spr: null, dead: false,
  };
  if (opt.elite) { e.elite = true; e.hp *= 14; e.sc *= 1.6; e.r *= 1.6; e.dmg *= 1.5; e.xp = 30; e.tint = 'gold'; e.spd *= .85; }
  e.maxHp = e.hp;
  run.enemies.push(e);
  if (!run.seen.has(type)) { run.seen.add(type); if (type !== 'fire' || run.si === 0) hint(`<b>${T.name}</b> ${T.tip}`); }
  return e;
}

export function doEvent(ev) {
  if (ev.k === 'elite') {
    const types = run.st.mix.filter(m => !['imp', 'bomber'].includes(m[0]) && run.time >= m[2]).map(m => m[0]);
    spawnEnemy(RNG.spawn.pick(types.length ? types : ['fire']), { elite: true });
    banner('Elite-Magier!', '');
  } else if (ev.k === 'swarm') {
    const n = 36, R = viewR() * .85;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(i % 6 === 0 && run.si > 0 ? 'bomber' : 'imp', { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); }
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
    spawnEnemy(type);
  }
}
export const tipPos = e => { const o = OFF[e.face], s = U * e.sc; return [e.x + o[0] * s, e.y + o[1] * s]; };
export function canCast(e) {
  if (e.cast === 'heal') { let ok = false; query(e.x, e.y, 170, o => { if (o !== e && !o.boss && o.hp < o.maxHp * .9) { ok = true; return false; } }); return ok; }
  if (e.cast === 'blink') return Math.hypot(P.x - e.x, P.y - e.y) > 230;
  return run.eproj.length < 5 + run.si * 2 && run.etele.length < 3 + run.si;
}
export function startCast(e, kind) {
  e.state = 'cast'; e.ft = 0; e.fired = false; e.ck = kind; e.charge = CHARGE[kind] || .7;
  e.face = faceOf(P.x - e.x, P.y - e.y);
  if (onScreen(e.x, e.y)) sfx.charge();
}
export function updEnemy(e, dt) {
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) e.slowT -= dt;
  e.x += e.kx * dt; e.y += e.ky * dt;
  const kd = Math.exp(-9 * dt); e.kx *= kd; e.ky *= kd;
  if (e.freezeT > 0) { e.freezeT -= dt; return; }
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.boss) { bossAI(e, dt, dx, dy, d); return; }
  if (e.bomber) { updBomber(e, dt, dx, dy, d); return; }
  if (e.state === 'cast') {
    e.ft += dt * (e.slowT > 0 ? .6 : 1);
    if (e.ft < e.charge) {
      e.spr = e.pre + 'cast_' + e.face + '_' + (1 + Math.floor(e.ft * 10) % 4);
      if (e.ck !== 'heal' && e.ck !== 'blink') e.face = faceOf(dx, dy);
      if (Math.random() < dt * 25) { const [tx, ty] = tipPos(e), a = Math.random() * TAU; part(tx + Math.cos(a) * 22 * e.sc, ty + Math.sin(a) * 22 * e.sc, -Math.cos(a) * 70, -Math.sin(a) * 70, .28, CCOL[e.ck], 2.5); }
    } else {
      const f = Math.floor((e.ft - e.charge) * 14);
      if (!e.fired) { e.fired = true; enemyAct(e); }
      if (f >= 4) { e.state = 'walk'; e.castCd = rand(e.cd[0], e.cd[1]); if (e.chain) { const k = e.chain; e.chain = null; startCast(e, k); } }
      else e.spr = e.pre + 'cast_' + e.face + '_' + (5 + f);
    }
    return;
  }
  let mx = dx / d, my = dy / d;
  if (e.keep && d < e.keep) { mx = -dx / d * .5 - dy / d * .8 * e.side; my = -dy / d * .5 + dx / d * .8 * e.side; }
  const sp = e.spd * (e.slowT > 0 ? .5 : 1);
  e.x += mx * sp * dt; e.y += my * sp * dt;
  e.face = faceOf(dx, dy); e.at += dt * (e.slowT > 0 ? .5 : 1);
  e.spr = e.pre + 'walk_' + e.face + '_' + ((Math.floor(e.at * 9) % 6) + 1);
  if (e.cast) {
    e.castCd -= dt;
    if (e.castCd <= 0 && d < e.range && onScreen(e.x, e.y, -20)) { if (canCast(e)) startCast(e, e.cast); else e.castCd = .6; }
  }
  if (d > viewR() * 1.9 && !e.elite) { e.px = e.x = P.x + dx / d * viewR() * 1.1; e.py = e.y = P.y + dy / d * viewR() * 1.1; }
}
export function updBomber(e, dt, dx, dy, d) {
  if (e.fuse > 0) {
    e.fuse -= dt; e.spr = e.pre + 'idle_' + e.face + '_' + (1 + Math.floor(e.fuse * 12) % 4);
    if (Math.random() < .5) part(e.x + frand(-6, 6), e.y - 26 * e.sc, frand(-40, 40), frand(-80, -30), .3, '#ffd84a', 2.5);
    if (e.fuse <= 0) bomberBoom(e, true);
    return;
  }
  const sp = e.spd * (e.slowT > 0 ? .5 : 1);
  e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
  e.face = faceOf(dx, dy); e.at += dt;
  e.spr = e.pre + 'walk_' + e.face + '_' + ((Math.floor(e.at * 12) % 6) + 1);
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
export function enemyAct(e) {
  const [tx, ty] = tipPos(e);
  const a = Math.atan2(P.y - ty, P.x - tx);
  switch (e.ck) {
    case 'fire': eShot(tx, ty, a, 'fire', e.dmg * .9, 205); break;
    case 'frost': eShot(tx, ty, a, 'frost', e.dmg * .9, 235); break;
    case 'void': eShot(tx, ty, a, 'void', e.dmg, 280); break;
    case 'fire3': for (const o of [-.28, 0, .28]) eShot(tx, ty, a + o, 'fire', e.dmg * .55, 205, 1.2); break;
    case 'storm': run.etele.push({ k: 'strike', x: P.x + P.vx * .4, y: P.y + P.vy * .4, t: .9, dur: .9, r: 50, dmg: e.dmg * 1.2 }); sfx.cast(); break;
    case 'toxic': {
      const lx = P.x + P.vx * .5, ly = P.y + P.vy * .5;
      run.eproj.push({ kind: 'toxic', lob: true, sx: tx, sy: ty, tx: lx, ty: ly, x: tx, y: ty, t: 0, dur: .95, a: 0, vx: 0, vy: 0, life: 2, dmg: e.dmg * .8, sc: 1.1, r: 10, h: 0 });
      sfx.cast(); break;
    }
    case 'blink': {
      puff(e.x, e.y, 1, 'rgba(170,90,255,.8)');
      const ang = rnd() * TAU, R = rand(150, 210);
      e.x = P.x + Math.cos(ang) * R; e.y = P.y + Math.sin(ang) * R;
      if (run.arena) { const A = run.arena, ddx = e.x - A.x, ddy = e.y - A.y, dd = Math.hypot(ddx, ddy); if (dd > A.r - 40) { e.x = A.x + ddx / dd * (A.r - 40); e.y = A.y + ddy / dd * (A.r - 40); } }
      e.px = e.x; e.py = e.y;
      puff(e.x, e.y, 1.2, 'rgba(170,90,255,.8)'); ring(e.x, e.y, 6, 50, .3, 'rgba(180,110,255,.9)', 4);
      e.chain = 'void'; sfx.whoosh(); break;
    }
    case 'heal': {
      let n = 0;
      query(e.x, e.y, 170, o => { if (o !== e && !o.boss && o.hp < o.maxHp) { const h = o.maxHp * .3; o.hp = Math.min(o.maxHp, o.hp + h); n++; addNum(o.x, o.y - 26, '+' + Math.round(h), '#8dff7a'); for (let i = 0; i < 3; i++) part(o.x + frand(-10, 10), o.y, 0, -60, .5, 'rgba(140,255,130,.9)', 3); } });
      ring(e.x, e.y, 10, 170, .5, 'rgba(140,255,130,.8)', 5); if (n && onScreen(e.x, e.y)) sfx.eheal(); break;
    }
  }
}
export function eShot(x, y, a, kind, dmg, sp, sc = 1) {
  run.eproj.push({ x, y, a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, dmg, life: 4.5, t: Math.random(), sc, r: sc * 9 });
}
