import { frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU } from '../core/util.js';
import { damagePlayer, hurt } from './combat.js';
import { animFx, boltFx, explode, part, ring } from './fx.js';
import { perfectRoll } from './abilities.js';
import { P, onScreen, pR, query, run } from './state.js';

export function updTele(dt) {
  for (const t of run.tele) {
    if (t.k === 'meteor') {
      t.t -= dt;
      if (t.t <= 0) { explode(t.x, t.y, t.rad, t.dmg, 'fire'); run.shake = Math.max(run.shake, 5); run.zones.push({ k: 'burn', x: t.x, y: t.y, r: t.rad * .65, t: 2.6, dur: 2.6, tick: 0, dmg: 9 * P.dmgMult }); t.done = true; }
    } else if (t.k === 'flask') {
      t.t += dt;
      if (t.t >= t.dur) { run.zones.push({ k: 'poison', x: t.x, y: t.y, r: t.rad, t: t.zdur, dur: t.zdur, tick: 0, dmg: t.dmg }); t.done = true; for (let i = 0; i < 8; i++) part(t.x, t.y, frand(-80, 80), frand(-90, -20), .5, 'rgba(140,230,80,.9)', 5); }
    } else if (t.k === 'barrel' || t.k === 'mini') {
      t.t += dt;
      if (t.t >= t.dur) {
        if (t.k === 'barrel') { t.fuse -= dt; if (Math.random() < .6) part(t.x + 3, t.y - 26, frand(-40, 40), frand(-90, -40), .3, '#ffd84a', 2.5); }
        if (t.k === 'mini' || t.fuse <= 0) {
          explode(t.x, t.y, t.rad, t.dmg, 'fire'); run.shake = Math.max(run.shake, t.k === 'barrel' ? 7 : 3); t.done = true;
          if (t.evo) for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + rand(-.3, .3), r = rand(80, 140); run.tele.push({ k: 'mini', sx: t.x, sy: t.y, x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, t: 0, dur: .4, rad: 55 * P.area, dmg: t.dmg * .45 }); }
        }
      }
    }
  }
  run.tele = run.tele.filter(t => !t.done);
  for (const z of run.zones) {
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0) { z.tick = .35; query(z.x, z.y, z.r, e => hurt(e, z.dmg, 0, 0, 0, z.k === 'poison' ? '#9cf06a' : '#ffb35c')); }
    if (Math.random() < dt * 8) part(z.x + frand(-z.r, z.r) * .7, z.y + frand(-z.r, z.r) * .5, 0, -25, .6, z.k === 'poison' ? 'rgba(170,255,110,.7)' : 'rgba(255,170,60,.8)', 4);
  }
  run.zones = run.zones.filter(z => z.t > 0);
  for (const s of run.etele) {
    s.t -= dt;
    if (s.t <= 0) {
      s.done = true;
      boltFx(s.x + frand(-30, 30), s.y - 460, s.x, s.y, 6, 'storm');
      for (let i = 0; i < 10; i++) part(s.x, s.y, frand(-150, 150), frand(-150, 50), .35, '#fff59a', 3);
      ring(s.x, s.y, 5, s.r, .25, 'rgba(255,240,120,.9)', 6);
      if (Math.hypot(P.x - s.x, P.y - s.y) < s.r + pR() * .6) damagePlayer(s.dmg, 'strike');
      if (onScreen(s.x, s.y)) sfx.ezap();
    }
  }
  run.etele = run.etele.filter(s => !s.done);
  for (const z of run.ezones) {
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0 && Math.hypot(P.x - z.x, P.y - z.y) < z.r + pR() * .5) { z.tick = .5; damagePlayer(z.dmg, 'zone'); }
    if (Math.random() < dt * 6) part(z.x + frand(-z.r, z.r) * .6, z.y + frand(-z.r, z.r) * .4, 0, -20, .7, 'rgba(160,90,220,.7)', 4);
  }
  run.ezones = run.ezones.filter(z => z.t > 0);
}
export function updEProj(dt) {
  for (const p of run.eproj) {
    p.t += dt; p.life -= dt;
    if (p.lob) {
      const q = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * q; p.y = p.sy + (p.ty - p.sy) * q; p.h = Math.sin(q * Math.PI) * 110;
      if (q >= 1) { p.life = 0; run.ezones.push({ x: p.tx, y: p.ty, r: 58, t: 4.2, dur: 4.2, tick: 0, dmg: p.dmg }); animFx('f_fireball_hit_', 5, p.tx, p.ty, 2.2, 16); for (let i = 0; i < 8; i++) part(p.tx, p.ty, frand(-90, 90), frand(-90, -20), .45, 'rgba(150,240,80,.9)', 4); }
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (run.arena && Math.hypot(p.x - run.arena.x, p.y - run.arena.y) > run.arena.r + 40) p.life = 0;
    const dx = p.x - P.x, dy = p.y - (P.y - 6), rr = p.r + pR() * .85;
    if (dx * dx + dy * dy < rr * rr && P.dashT <= 0 && P.inv <= 0) {
      damagePlayer(p.dmg, 'proj');
      if (p.kind === 'frost' && P.mechT <= 0) P.slowT = 1.2;
      p.life = 0;
      animFx(p.kind === 'fire' ? 'f_fireball_hit_' : 'e_frostbolt_hit_', 5, p.x, p.y, 1.2);
    } else if (P.dashT > 0 && dx * dx + dy * dy < rr * rr) perfectRoll(p.x, p.y);
  }
  run.eproj = run.eproj.filter(p => p.life > 0);
}
