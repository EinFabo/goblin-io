import { rnd, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { $, TAU, faceOf } from '../core/util.js';
import { CCOL } from '../data/enemies.js';
import { eShot, spawnEnemy, tipPos } from './enemies.js';
import { dropGem, part, puff, ring } from './fx.js';
import { P, run } from './state.js';
import { banner } from '../ui/hud.js';

export function spawnBoss() {
  const st = run.st, B = st.boss;
  for (const e of run.enemies) if (!e.dead) { e.dead = true; puff(e.x, e.y, e.sc); dropGem(e.x, e.y, e.xp); }
  run.eproj.length = 0; run.etele.length = 0;
  run.arena = { x: P.x, y: P.y, r: 470 };
  const lf = 1 + run.loop * 1.5;
  const b = {
    type: 'boss', boss: true, pre: B.pre, kind: B.kind, minion: B.minion, name: B.name, x: P.x, y: P.y - 300, r: 38, sc: 2.7, spd: 52, dmg: 18 * st.dmg * lf,
    hp: 2500 * st.hp * lf, xp: 150, tint: B.tint, state: 'walk', face: 'down', at: 0, ft: 0, fired: false, charge: .7, ck: 'fire', kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, dead: false,
    ai: { st: 'chase', t: 2.5, i: 0, atk: null, reps: 0, ring2: 0, ax: 0, ay: 0 },
  };
  b.maxHp = b.hp;
  run.enemies.push(b); run.boss = b;
  $('#bossBar').hidden = false; $('#bossName').textContent = B.name;
  banner(B.name, 'danger'); sfx.warn(); emit('bossSpawn', b);
  ring(P.x, P.y, 20, 470, .6, 'rgba(180,120,255,.8)', 8);
}

export function bossAI(b, dt, dx, dy, d) {
  const ai = b.ai, enr = b.hp < b.maxHp * .5, sp = enr ? 1.3 : 1;
  const kindNow = () => b.kind === 'both' ? (rnd() < .5 ? 'fire' : 'frost') : b.kind;
  if (ai.ring2 > 0) { ai.ring2 -= dt; if (ai.ring2 <= 0) bossRing(b, kindNow(), Math.PI / (enr ? 20 : 14)); }
  ai.t -= dt;
  if (ai.st === 'chase') {
    const s = b.spd * sp * (b.slowT > 0 ? .6 : 1);
    b.x += dx / d * s * dt; b.y += dy / d * s * dt;
    b.face = faceOf(dx, dy); b.at += dt;
    b.spr = b.pre + 'walk_' + b.face + '_' + ((Math.floor(b.at * 8) % 6) + 1);
    if (ai.t <= 0) {
      const list = ['ring', 'fan', 'strikes', 'summon', 'charge'];
      ai.atk = list[ai.i++ % list.length];
      if (ai.atk === 'charge') { ai.st = 'tele'; ai.t = .9; ai.ax = dx / d; ai.ay = dy / d; b.face = faceOf(dx, dy); }
      else { ai.st = 'cast'; b.ft = 0; b.fired = false; b.face = faceOf(dx, dy); b.ck = ai.atk === 'strikes' ? 'storm' : ai.atk === 'summon' ? 'blink' : kindNow(); ai.reps = ai.atk === 'fan' ? 2 : 0; sfx.charge(); }
    }
  } else if (ai.st === 'cast') {
    b.ft += dt;
    if (b.ft < b.charge) {
      b.spr = b.pre + 'cast_' + b.face + '_' + (1 + Math.floor(b.ft * 10) % 4);
      if (Math.random() < dt * 40) { const [tx, ty] = tipPos(b), a = Math.random() * TAU; part(tx + Math.cos(a) * 50, ty + Math.sin(a) * 50, -Math.cos(a) * 140, -Math.sin(a) * 140, .32, CCOL[b.ck] || '#fff', 4); }
    } else {
      const f = Math.floor((b.ft - b.charge) * 12);
      b.spr = b.pre + 'cast_' + b.face + '_' + Math.min(8, 5 + f);
      if (!b.fired) {
        b.fired = true;
        const [tx, ty] = tipPos(b);
        if (ai.atk === 'ring') { bossRing(b, b.ck, 0); ai.ring2 = .4; }
        else if (ai.atk === 'fan') {
          const base = Math.atan2(P.y - ty, P.x - tx), n = enr ? 9 : 7;
          for (let i = 0; i < n; i++) eShot(tx, ty, base + (i - (n - 1) / 2) * .14, b.ck, b.dmg * .45, 225, 1.4);
        } else if (ai.atk === 'strikes') {
          const n = enr ? 8 : 5;
          run.etele.push({ k: 'strike', x: P.x, y: P.y, t: 1, dur: 1, r: 60, dmg: b.dmg * .7 });
          for (let i = 1; i < n; i++) { const a = rnd() * TAU, r = rand(70, 200); run.etele.push({ k: 'strike', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, t: 1 + i * .08, dur: 1 + i * .08, r: 60, dmg: b.dmg * .7 }); }
        } else if (ai.atk === 'summon') {
          const n = enr ? 7 : 5;
          for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(b.minion || 'imp', { x: b.x + Math.cos(a) * 80, y: b.y + Math.sin(a) * 80 }); }
          ring(b.x, b.y, 10, 120, .5, 'rgba(180,120,255,.8)', 6);
        }
      }
      if (f >= 4) {
        if (ai.reps > 0) { ai.reps--; b.ft = b.charge * .6; b.fired = false; b.face = faceOf(dx, dy); }
        else { ai.st = 'chase'; ai.t = 2.2 / sp; }
      }
    }
  } else if (ai.st === 'tele') {
    b.spr = b.pre + 'idle_' + b.face + '_' + ((Math.floor(run.time * 8) % 4) + 1);
    if (ai.t <= 0) { ai.st = 'charge'; ai.t = .75; sfx.whoosh(); }
  } else if (ai.st === 'charge') {
    b.x += ai.ax * 560 * dt; b.y += ai.ay * 560 * dt; b.at += dt * 3;
    b.spr = b.pre + 'walk_' + b.face + '_' + ((Math.floor(b.at * 8) % 6) + 1);
    if (Math.random() < .5) part(b.x + frand(-20, 20), b.y + 30, frand(-30, 30), frand(-30, 0), .4, 'rgba(200,190,170,.7)', 6);
    if (ai.t <= 0) { ai.st = 'chase'; ai.t = 2 / sp; }
  }
}
export function bossRing(b, kind, off) {
  const n = b.hp < b.maxHp * .5 ? 20 : 14;
  for (let i = 0; i < n; i++) eShot(b.x, b.y - 10, off + i * TAU / n, kind === 'storm' || kind === 'blink' ? 'void' : kind, b.dmg * .4, 175, 1.35);
}
