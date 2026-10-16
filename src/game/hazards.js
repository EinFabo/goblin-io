import { frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU, angDiff } from '../core/util.js';
import { damagePlayer, hurt } from './combat.js';
import { animFx, boltFx, explode, part, ring } from './fx.js';
import { bulwark, perfectRoll, reflect } from './abilities.js';
import { affixOnHitPlayer } from './affixes.js';
import { portalWarp, spinHaz } from './boss.js';
import { P, onScreen, pR, query, run } from './state.js';

// Einschlag-Animation je Geschossart
const HIT_FX = { fire: 'f_fireball_hit_', frost: 'e_frostbolt_hit_', void: 'p.shade_hit.', toxic: 'p.glob_hit.', storm: 'p.spark_hit.', necro: 'p.soul_hit.', earth: 'p.rock_hit.', light: 'p.lance_hit.' };

export function updTele(dt) {
  for (const t of run.tele) {
    if (t.k === 'meteor') {
      t.t -= dt;
      if (t.t <= 0) { explode(t.x, t.y, t.rad, t.dmg, 'fire'); run.shake = Math.max(run.shake, 5); run.zones.push({ k: 'burn', x: t.x, y: t.y, r: t.rad * .65, t: 2.6, dur: 2.6, tick: 0, dmg: t.burn ?? 9 * P.dmgMult }); t.done = true; }
    } else if (t.k === 'boulder') {
      // Katapult-Fels: fliegt im Bogen, schlägt ein
      t.t += dt;
      if (t.t >= t.dur) {
        // Benommen: Einschlag betäubt; Splitter: Gegner daneben bekommen Splitter ab
        if (t.stun) query(t.x, t.y, t.rad, e => { if (!e.boss) e.freezeT = Math.max(e.freezeT, t.stun); });
        explode(t.x, t.y, t.rad, t.dmg, 'fire'); run.shake = Math.max(run.shake, 7); t.done = true;
        if (t.shards) { let n = t.shards; query(t.x, t.y, t.rad * 1.8, e => { if (n <= 0) return false; if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 < t.rad * t.rad) return; n--; const d = Math.hypot(e.x - t.x, e.y - t.y) || 1; hurt(e, t.dmg * .3, 150, (e.x - t.x) / d, (e.y - t.y) / d, '#c9b9a0'); part(e.x, e.y - 10, frand(-60, 60), frand(-80, -20), .4, '#8a7a66', 4); }); } if (t.burn) run.zones.push({ k: 'burn', x: t.x, y: t.y, r: t.rad * .65, t: 2.6, dur: 2.6, tick: 0, dmg: t.dmg * .12 }); for (let i = 0; i < 10; i++) part(t.x, t.y, frand(-120, 120), frand(-140, -20), .5, i % 2 ? '#8a7a66' : '#5d5246', 5); }
    } else if (t.k === 'flask') {
      t.t += dt;
      if (t.t >= t.dur) { run.zones.push({ k: t.zk || 'poison', x: t.x, y: t.y, r: t.rad, t: t.zdur, dur: t.zdur, tick: 0, dmg: t.dmg }); t.done = true; for (let i = 0; i < 8; i++) part(t.x, t.y, frand(-80, 80), frand(-90, -20), .5, t.zk === 'acid' ? 'rgba(200,255,90,.9)' : 'rgba(140,230,80,.9)', 5); }
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
  // Lachen und Brand: Sanduhr verlängert (P.dur), Glutkern verstärkt (P.aoeMult); Säure bremst stark
  const zd = dt / (P.dur || 1), zm = P.aoeMult || 1;
  for (const z of run.zones) {
    z.t -= zd; z.tick -= dt;
    if (z.tick <= 0) { z.tick = .35; query(z.x, z.y, z.r, e => { hurt(e, z.dmg * zm, 0, 0, 0, z.k === 'burn' ? '#ffb35c' : z.k === 'acid' ? '#d6ff5a' : '#9cf06a'); if (z.k === 'acid' && !e.boss) e.slowT = Math.max(e.slowT || 0, .6); }); }
    if (Math.random() < dt * 8) part(z.x + frand(-z.r, z.r) * .7, z.y + frand(-z.r, z.r) * .5, 0, -25, .6, z.k === 'poison' ? 'rgba(170,255,110,.7)' : z.k === 'acid' ? 'rgba(215,255,90,.75)' : 'rgba(255,170,60,.8)', 4);
  }
  run.zones = run.zones.filter(z => z.t > 0);
  updHaz(dt);
}

export function updEProj(dt) {
  for (const p of run.eproj) {
    p.t += dt; p.life -= dt;
    if (p.lob) {
      const q = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * q; p.y = p.sy + (p.ty - p.sy) * q; p.h = Math.sin(q * Math.PI) * 110;
      if (q >= 1) {
        p.life = 0;
        if (p.kind === 'rock') { animFx('p.rock_hit.', 5, p.tx, p.ty, 2.2, 16); for (let i = 0; i < 8; i++) part(p.tx, p.ty, frand(-90, 90), frand(-90, -20), .45, 'rgba(160,130,90,.9)', 4); }
        else {
          addHaz({ shape: 'circle', x: p.tx, y: p.ty, r: 58, warn: 0, act: 4.2, tick: .5, dmg: p.dmg, kind: 'toxic', src: 'zone', owner: p.owner });
          animFx('p.glob_hit.', 5, p.tx, p.ty, 2.4, 16); for (let i = 0; i < 8; i++) part(p.tx, p.ty, frand(-90, 90), frand(-90, -20), .45, 'rgba(150,240,80,.9)', 4);
        }
      }
      continue;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.warp && run.portals.length) portalWarp(p);   // Spiegelmeister: durch das Spiegeltor
    if (run.arena && Math.hypot(p.x - run.arena.x, p.y - run.arena.y) > run.arena.r + 40) p.life = 0;
    const dx = p.x - P.x, dy = p.y - (P.y - 6), rr = p.r + pR() * .85;
    if (p.fake && dx * dx + dy * dy < rr * rr) { p.life = 0; part(p.x, p.y, 0, -30, .3, 'rgba(200,160,255,.6)', 5); continue; }
    if (dx * dx + dy * dy < rr * rr && P.shieldT > 0 && !p.fake) { p.life = 0; reflect(p); continue; }
    if (dx * dx + dy * dy < rr * rr && P.dashT <= 0 && P.inv <= 0) {
      const before = P.hp; damagePlayer(p.dmg, 'proj', p.owner); affixOnHitPlayer(p.owner, before - P.hp);
      if (p.kind === 'frost' && P.mechT <= 0 && !bulwark()) P.slowT = 1.2;
      p.life = 0;
      animFx(HIT_FX[p.kind] || 'e_frostbolt_hit_', 5, p.x, p.y, 1.2);
    } else if (!p.fake && P.dashT > 0 && dx * dx + dy * dy < rr * rr * P.perfectR * P.perfectR) perfectRoll(p.x, p.y);   // Trugbilder zählen nicht
  }
  run.eproj = run.eproj.filter(p => p.life > 0);
}

// ---------- Bodenwarnungen und Gefahrenzonen der Gegner ----------
// Form: circle {x,y,r} | line {x,y,x2,y2,w} | cone {x,y,a,len,spread} | beam {a,b,w} (zwischen zwei Gegnern)
// warn: Warnzeit bis zur Wirkung, act: Dauer danach (0 = einmaliger Treffer), tick: Abstand der Treffer,
// owner + cancel: verschwindet, wenn der Zaubernde vorher stirbt. drain: heilt diesen Gegner um den Schaden.
export function addHaz(h) {
  run.haz.push({ act: 0, tick: .5, tk: 0, t: 0, owner: run.caster || null, ...h, dur: h.warn });
}
export const hazWarnCount = () => run.haz.reduce((n, h) => n + (h.warn > 0 && h.dmg > 0 ? 1 : 0), 0);

// Abstand eines Punkts zur Form (negativ = drin)
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
  const cx = x1 + dx * t, cy = y1 + dy * t;
  return [Math.hypot(px - cx, py - cy), cx, cy];
}
export function hazDist(h, x, y) {
  switch (h.shape) {
    case 'circle': return [Math.hypot(x - h.x, y - h.y) - h.r, h.x, h.y];
    case 'ring': {
      // Knochenkäfig: Band um (x, y), in der Lücke ungefährlich
      const dx = x - h.x, dy = y - h.y, dd = Math.hypot(dx, dy) || .01;
      const da = angDiff(Math.atan2(dy, dx), h.gap);
      if (Math.abs(da) < h.gapW) return [1e9, h.x, h.y];
      return [Math.abs(dd - h.r) - h.w / 2, h.x + dx / dd * h.r, h.y + dy / dd * h.r];
    }
    case 'line': { const [d, cx, cy] = segDist(x, y, h.x, h.y, h.x2, h.y2); return [d - h.w / 2, cx, cy]; }
    case 'beam': { const [d, cx, cy] = segDist(x, y, h.a.x, h.a.y - 20, h.b.x, h.b.y - 20); return [d - h.w / 2, cx, cy]; }
    case 'cone': {
      const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
      const da = angDiff(Math.atan2(dy, dx), h.a);
      const inside = d < h.len && Math.abs(da) < h.spread;
      return [inside ? -Math.min(h.len - d, (h.spread - Math.abs(da)) * d) : Math.min(Math.abs(d - h.len), Math.abs(Math.abs(da) - h.spread) * d), h.x, h.y];
    }
  }
  return [1e9, 0, 0];
}
const hazHitsPlayer = h => hazDist(h, P.x, P.y)[0] < pR() * .6;

function hazFx(h) {
  const x = h.shape === 'circle' ? h.x : h.shape === 'cone' ? h.x + Math.cos(h.a) * h.len * .5 : h.shape === 'beam' ? (h.a.x + h.b.x) / 2 : (h.x + h.x2) / 2;
  const y = h.shape === 'circle' ? h.y : h.shape === 'cone' ? h.y + Math.sin(h.a) * h.len * .5 : h.shape === 'beam' ? (h.a.y + h.b.y) / 2 : (h.y + h.y2) / 2;
  if (h.kind === 'storm' && h.shape === 'circle') {
    boltFx(h.x + frand(-30, 30), h.y - 460, h.x, h.y, 6, 'storm');
    for (let i = 0; i < 10; i++) part(h.x, h.y, frand(-150, 150), frand(-150, 50), .35, '#fff59a', 3);
    ring(h.x, h.y, 5, h.r, .25, 'rgba(255,240,120,.9)', 6);
    if (onScreen(h.x, h.y)) sfx.ezap();
  } else if (h.kind === 'earth') {
    run.shake = Math.max(run.shake, 4);
    for (let i = 0; i < 12; i++) part(x + frand(-40, 40), y + frand(-20, 20), frand(-80, 80), frand(-120, -30), .5, 'rgba(170,140,100,.9)', frand(3, 6));
    if (onScreen(x, y)) sfx.stomp();
  } else if (h.boom) { animFx('f_fireball_hit_', 5, h.x, h.y, h.r / 16); run.shake = Math.max(run.shake, 8); sfx.boom(); }
  else if (h.kind === 'fire') { if (onScreen(x, y)) sfx.boom(); }
  else if (h.kind === 'ice') { for (let i = 0; i < 10; i++) part(x + frand(-h.r, h.r) * .7, y + frand(-h.r, h.r) * .5, 0, frand(-40, -10), .5, '#eafcff', 3); if (onScreen(x, y)) sfx.frost(); }
}

function updHaz(dt) {
  for (const h of run.haz) {
    h.t += dt;
    if (h.owner && h.cancel && h.owner.dead) { h.done = true; continue; }
    if (h.shape === 'beam' && (h.a.dead || h.b.dead)) { h.done = true; continue; }
    if (h.spin) spinHaz(h, dt);
    if (h.warn > 0) {
      h.warn -= dt;
      if (h.warn > 0) continue;
      hazFx(h);
      if (h.act <= 0) { if (h.dmg > 0 && hazHitsPlayer(h)) { const b0 = P.hp; damagePlayer(h.dmg, h.src, h.owner); affixOnHitPlayer(h.owner, b0 - P.hp); } h.done = true; continue; }
    }
    h.act -= dt; h.tk -= dt;
    if (h.r1 !== undefined) h.r = h.r1 + (h.r0 - h.r1) * Math.max(0, h.act / h.act0);   // Käfig zieht sich zu
    // Eisfleck: rutschig, solange man drauf steht
    if (h.kind === 'ice' && hazDist(h, P.x, P.y)[0] < 0) P.iceT = .12;
    if (h.tk <= 0 && h.dmg > 0 && hazHitsPlayer(h)) {
      h.tk = h.tick;
      const before = P.hp; damagePlayer(h.dmg, h.src, h.owner); affixOnHitPlayer(h.owner, before - P.hp);
      if (h.drain && !h.drain.dead) { const got = before - P.hp; h.drain.hp = Math.max(h.drain.hp, Math.min(h.drainMax ?? h.drain.maxHp, h.drain.hp + got * 3)); }
    }
    if (h.act <= 0) h.done = true;
  }
  run.haz = run.haz.filter(h => !h.done);
}

// Für den Bot: Schubs weg von allen Gefahren in der Nähe (Länge ~ wie dringend)
export function dangerVec(x, y, margin = 40) {
  let vx = 0, vy = 0;
  for (const h of run.haz) {
    if (h.dmg <= 0) continue;
    const [d, cx, cy] = hazDist(h, x, y);
    if (d > margin) continue;
    let dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy);
    // genau in der Mitte (Blitz/Meteor auf den Spieler): Richtung aus dem Punkt selbst, ohne Zufall (Sim bleibt wiederholbar)
    if (l < 1) { const a = (x * 12.9898 + y * 78.233) % TAU; dx = Math.cos(a); dy = Math.sin(a); l = 1; }
    const w = (margin - d) / margin * 4;
    vx += dx / l * w; vy += dy / l * w;
  }
  return [vx, vy];
}
