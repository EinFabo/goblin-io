import { rnd, frand, rand, pick } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU, angDiff, clamp, face8 } from '../core/util.js';
import { hurt } from './combat.js';
import { animFx, boltFx, explode, part, puff, ring } from './fx.js';
import { P, abSrc, isBig, nearest, query, randomEnemyInView, run, setSrc } from './state.js';
import { H, W, ZOOM } from '../render/canvas.js';
import { smokeAtkSlow } from '../data/abilities.js';
import { onProjHit, stepWeapon2 } from './weapons2.js';

// ---------- Waffen ----------
// Zielsuchende Geschosse: Wendigkeit in rad/s
const HOMING = { fireball: 6, rocket: 8, shade: 3, soul: 7, spark: 9, orb: 5 };
export function shoot(k, a, dmg, pierce, spd, life, extra = {}) { shootRaw(k, a, dmg * shotMul, pierce, spd, life, extra); }
// ohne den Schadensfaktor der gerade schießenden Waffe (dmg schon fertig); Splitterkristall: mehr Durchbohren
export function shootRaw(k, a, dmg, pierce, spd, life, extra = {}) {
  if (pierce < 99) pierce += P.pierceAdd || 0;
  run.pproj.push(Object.assign({ k, x: P.x, y: P.y - 8, a, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg, pierce, life, hit: new Set(), r: 13, t: 0, src: abSrc }, extra));
}
export function updWeapons(dt) {
  const smoke = P.smokeT > 0 && run.abMods && run.abMods.smoke;
  const rate = (P.rageT > 0 ? 1.6 : 1) * (smoke ? 1 - smokeAtkSlow(smoke.s1) : 1) * (P.burrowT > 0 ? .5 : 1) * (P.brew && P.brew.swift > 0 ? 1.5 : 1) * (P.atkSpd || 1);   // Kriegshorn; eingegraben halb so schnell
  // Kartenstufe (9.3): mehr Grundschaden je Waffe (dm statt P.dmgMult), auf Stufe 10 schneller
  for (const w of run.weapons) stepWeapon(w, rate * (w.fast || 1), P.dmgMult * (w.card || 1), dt);
}
// Schadensfaktor der gerade schießenden Waffe für shoot()
let shotMul = 1;
function stepWeapon(w, rate, dm, dt) {
  shotMul = dm;
  const L = w.lv - 1;
  switch (w.id) {
    case 'dagger': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) { w.t = .5 * P.cdMult; w.rot += .21; for (let i = 0; i < 12; i++) shoot('dagger', w.rot + i * TAU / 12, 20, 99, 560 * P.proj, .85); }
      else {
        w.t = [.7, .7, .65, .65, .5][L] * P.cdMult;
        const n = [1, 2, 2, 3, 4][L], dmg = [12, 12, 16, 16, 18][L], pierce = [0, 0, 0, 1, 1][L];
        const t = nearest(520), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
        for (let i = 0; i < n; i++) shoot('dagger', a + (i - (n - 1) / 2) * .13, dmg, pierce, 560 * P.proj, .9);
      }
      sfx.throw(); break;
    }
    case 'orbit': {
      const n = w.evo ? 8 : [2, 3, 3, 4, 5][L], r = (w.evo ? 135 : [78, 78, 92, 98, 104][L]) * P.area;
      const dmg = (w.evo ? 24 : [8, 8, 12, 12, 14][L]) * dm, spd = w.evo ? 4.6 : [2.8, 2.8, 3, 3, 3.6][L];
      w.a += spd * dt * rate; w.blades.length = 0;
      for (let i = 0; i < n; i++) {
        const a = w.a + i * TAU / n, bx = P.x + Math.cos(a) * r, by = P.y - 8 + Math.sin(a) * r;
        w.blades.push([bx, by, a]);
        query(bx, by, 16 * P.area, e => { if (e.oh > run.time) return; e.oh = run.time + .42; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, w.evo ? 260 : 110, (e.x - P.x) / d, (e.y - P.y) / d); });
      }
      w.r = r; break;
    }
    case 'fireball': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) {
        w.t = 1 * P.cdMult; const c = randomEnemyInView(20);
        for (let i = 0; i < 3; i++) { const e = c.length ? pick(c) : null; run.tele.push({ k: 'meteor', x: e ? e.x + rand(-20, 20) : P.x + rand(-250, 250), y: e ? e.y + rand(-20, 20) : P.y + rand(-200, 200), t: .65, dur: .65, rad: 105 * P.area, dmg: 46 * dm, burn: 9 * dm }); }
      } else {
        w.t = [1.8, 1.7, 1.6, 1.35, 1.25][L] * P.cdMult;
        const n = [1, 1, 2, 2, 3][L], dmg = [18, 22, 22, 28, 32][L], rad = [55, 64, 64, 68, 82][L] * P.area;
        const c = randomEnemyInView(-60).filter(e => (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 470 * 470);
        for (let i = 0; i < n; i++) { const e = c.length ? c.splice((rnd() * c.length) | 0, 1)[0] : nearest(470); if (!e) break; shoot('fireball', Math.atan2(e.y - P.y, e.x - P.x), dmg, 0, 360 * P.proj, 1.8, { target: e, rad }); }
        sfx.cast();
      }
      break;
    }
    case 'spear': {
      w.t -= dt * rate;
      if (w.evo) {
        w.t2 -= dt * rate;
        if (w.t2 <= 0) {
          w.t2 = 3.4 * P.cdMult; const R = 230 * P.area;
          query(P.x, P.y, R, e => { hurt(e, 30 * dm, 0, 0, 0, '#9fe6ff'); if (!e.boss) e.freezeT = 1.8; else e.slowT = 2; });
          ring(P.x, P.y, 20, R, .45, 'rgba(160,230,255,.9)', 10); sfx.frost();
          for (let i = 0; i < 20; i++) { const a = Math.random() * TAU; part(P.x + Math.cos(a) * R * .9, P.y + Math.sin(a) * R * .9, 0, -20, .6, 'rgba(220,250,255,.9)', 5); }
        }
      }
      if (w.t > 0) break;
      const n = w.evo ? 5 : [1, 2, 2, 3, 3][L], dmg = w.evo ? 30 : [12, 12, 16, 16, 22][L], pierce = w.evo ? 99 : [2, 2, 4, 4, 5][L];
      w.t = (w.evo ? .9 : [1.5, 1.4, 1.3, 1.2, 1][L]) * P.cdMult;
      const a = Math.atan2(P.aimY, P.aimX);
      for (let i = 0; i < n; i++) shoot('spear', a + (i - (n - 1) / 2) * .2, dmg, pierce, 470 * P.proj, 1.1);
      sfx.frost(); break;
    }
    case 'bolt': {
      w.t -= dt * rate; if (w.t > 0) break;
      w.t = (w.evo ? .85 : [1.6, 1.5, 1.4, 1.3, 1.15][L]) * P.cdMult;
      const n = w.evo ? 6 : [1, 2, 2, 3, 4][L], dmg = (w.evo ? 48 : [22, 24, 26, 32, 36][L]) * dm, chain = w.evo ? 5 : [0, 0, 1, 1, 2][L];
      const c = randomEnemyInView(10);
      for (let i = 0; i < n && c.length; i++) {
        const e = c.splice((rnd() * c.length) | 0, 1)[0];
        boltFx(e.x + frand(-40, 40), e.y - 420, e.x, e.y, w.evo ? 5 : 3.5);
        hurt(e, dmg, 0, 0, 0, '#fff38a');
        const hitSet = new Set([e]); let cur = e, cd = dmg;
        for (let j = 0; j < chain; j++) {
          let nx = null, nd = (w.evo ? 180 : 130) ** 2;
          query(cur.x, cur.y, w.evo ? 180 : 130, o => { if (hitSet.has(o)) return; const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d < nd) { nd = d; nx = o; } });
          if (!nx) break;
          cd *= .75; boltFx(cur.x, cur.y - 10, nx.x, nx.y - 10, 2.5); hurt(nx, cd, 0, 0, 0, '#fff38a'); hitSet.add(nx); cur = nx;
        }
      }
      sfx.zap(); break;
    }
    case 'poison': {
      if (w.evo) { w.t2 -= dt; if (w.t2 <= 0) { w.t2 = .3; query(P.x, P.y, 125 * P.area, e => hurt(e, 11 * dm, 0, 0, 0, '#9cf06a')); } }
      w.t -= dt * rate; if (w.t > 0) break;
      w.t = (w.evo ? 2 : [2.6, 2.5, 2.3, 2.2, 2][L]) * P.cdMult;
      const n = w.evo ? 3 : [1, 1, 2, 2, 3][L];
      const rad = (w.evo ? 85 : [50, 60, 60, 64, 72][L]) * P.area, dur = w.evo ? 4.5 : [3, 3.2, 3.2, 4.2, 4.2][L], dmg = (w.evo ? 12 : [5, 7, 7, 8, 10][L]) * dm;
      const c = randomEnemyInView(40);
      for (let i = 0; i < n; i++) { const e = c.length ? pick(c) : null; run.tele.push({ k: 'flask', sx: P.x, sy: P.y - 10, x: e ? e.x : P.x + rand(-200, 200), y: e ? e.y : P.y + rand(-160, 160), t: 0, dur: .55, rad, zdur: dur, dmg }); }
      sfx.throw(); break;
    }
    case 'boomer': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) {
        w.t = 1.1 * P.cdMult; w.rot += .5;
        for (let i = 0; i < 4; i++) shoot('boomer', w.rot + i * TAU / 4, 40, 999, 420 * P.proj, 5, { out: 300 * P.proj, dist: 0, back: false, sc: 1.6, r: 24 });
      } else {
        w.t = [1.6, 1.6, 1.5, 1.4, 1.25][L] * P.cdMult;
        const n = [1, 1, 2, 2, 3][L], dmg = [14, 18, 18, 22, 24][L], out = [230, 230, 240, 290, 300][L] * P.proj;
        const t = nearest(500), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
        for (let i = 0; i < n; i++) shoot('boomer', a + (i - (n - 1) / 2) * .5, dmg, 999, 400 * P.proj, 5, { out, dist: 0, back: false, sc: 1, r: 16 });
      }
      sfx.whoosh(); break;
    }
    case 'barrel': {
      w.t -= dt * rate; if (w.t > 0) break;
      w.t = (w.evo ? 2 : [3, 2.8, 2.7, 2.6, 2.1][L]) * P.cdMult;
      const n = w.evo ? 3 : [1, 1, 2, 2, 3][L], dmg = (w.evo ? 60 : [35, 44, 44, 50, 55][L]) * dm, rad = (w.evo ? 110 : [80, 85, 85, 100, 105][L]) * P.area;
      const c = randomEnemyInView(60);
      for (let i = 0; i < n; i++) {
        const e = c.length ? pick(c) : null;
        let tx = e ? e.x : P.x + rand(-120, 120), ty = e ? e.y : P.y + rand(-120, 120);
        const dd = Math.hypot(tx - P.x, ty - P.y); if (dd > 260) { tx = P.x + (tx - P.x) / dd * 260; ty = P.y + (ty - P.y) / dd * 260; }
        run.tele.push({ k: 'barrel', sx: P.x, sy: P.y - 10, x: tx, y: ty, t: 0, dur: .45, fuse: 1, rad, dmg, evo: w.evo });
      }
      sfx.throw(); break;
    }
    case 'saw': {
      w.t -= dt * rate; if (w.t > 0) break;
      w.t = (w.evo ? 3.2 : [3.4, 3.2, 3.1, 3, 2.8][L]) * P.cdMult;
      const n = w.evo ? 4 : [1, 1, 2, 2, 3][L], dmg = w.evo ? 26 : [10, 12, 12, 16, 16][L], life = (w.evo ? 5.5 : [2.5, 3, 3, 3, 3.6][L]) * P.proj;
      const t = nearest(500), a0 = t ? Math.atan2(t.y - P.y, t.x - P.x) : rnd() * TAU;
      for (let i = 0; i < n; i++) shoot('saw', a0 + i * TAU / n + rand(-.2, .2), dmg, 999, (w.evo ? 470 : 380) * P.proj, life, { hm: new Map(), sc: w.evo ? 1.7 : 1, r: w.evo ? 30 : 18 });
      sfx.whoosh(); break;
    }
    case 'gang': {
      const n = w.evo ? 7 : [1, 2, 2, 3, 4][L];
      while (run.allies.length < n) { const a = rnd() * TAU; run.allies.push({ ally: true, x: P.x + Math.cos(a) * 40, y: P.y + Math.sin(a) * 40, face: 'down', at: 0, atk: 0, slash: 0, sa: 0, moving: false, off: rnd() * TAU }); puff(P.x, P.y, .6); }
      w.dmg = (w.evo ? 22 : [8, 8, 12, 12, 14][L]) * dm; w.spd = w.evo ? 270 : L >= 4 ? 240 : 205; w.sc = w.evo ? .66 : .55;
      break;
    }
    default: stepWeapon2(w, L, dm, dt, rate);
  }
}
export function updAllies(dt) {
  const w = run.weapons.find(x => x.id === 'gang'); if (!w || !w.dmg) return;
  const rate = (P.rageT > 0 ? 1.6 : 1) * (w.fast || 1);   // Kartenstufe 10: schneller
  run.allies.forEach((al, i) => stepAlly(al, i, run.allies.length, w.dmg, w.spd, rate, dt));
}
// Ein Kumpel: nächsten Gegner in Reichweite suchen, hinlaufen, zustechen (auch für den Goblin-Ruf)
// bigMul: Schadensfaktor gegen große Gegner (Goblin-Ruf .3)
export function stepAlly(al, i, n, dmg, spd, rate, dt, bigMul = 1) {
  al.atk -= dt * rate; al.slash -= dt;
  let tgt = null, td = 0;
  for (const e of run.enemies) {
    if (e.dead || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > 300 * 300) continue;
    const d2 = (e.x - al.x) ** 2 + (e.y - al.y) ** 2; if (!tgt || d2 < td) { tgt = e; td = d2; }
  }
  let tx, ty;
  if (tgt) { tx = tgt.x; ty = tgt.y; }
  else { const a = run.time * .8 + al.off + i * TAU / n; tx = P.x + Math.cos(a) * 55; ty = P.y + Math.sin(a) * 40; }
  const dx = tx - al.x, dy = ty - al.y, d = Math.hypot(dx, dy) || 1;
  const reach = tgt ? tgt.r + 12 : 6;
  al.moving = d > reach;
  if (al.moving) { const s = Math.min(d - reach, spd * dt); al.x += dx / d * s; al.y += dy / d * s; al.face = face8(dx, dy, al.face); al.at += dt; }
  if (tgt && d < reach + 6 && al.atk <= 0) { al.atk = .45; al.slash = .15; al.sa = Math.atan2(dy, dx); hurt(tgt, isBig(tgt) ? dmg * bigMul : dmg, 90, dx / d, dy / d); }
  if (Math.hypot(al.x - P.x, al.y - P.y) > 520) { al.px = al.x = P.x + rand(-30, 30); al.py = al.y = P.y + rand(-30, 30); puff(al.x, al.y, .5); }
}
export function updPProj(dt) {
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM;
  for (const p of run.pproj) {
    setSrc(p.src);   // Geschosse von Fähigkeiten (Mech, Schild, Wirbelaxt …) tragen deren Runen
    p.t += dt; p.life -= dt;
    // Irrlichter und Funken suchen sich ein neues Ziel, wenn ihres stirbt
    if ((p.k === 'soul' || p.k === 'spark') && (!p.target || p.target.dead) && p.t >= (p.rt || .15)) { p.rt = p.t + .2; p.target = nearest(420, p); }
    if (HOMING[p.k] && p.target && !p.target.dead) {
      const ta = Math.atan2(p.target.y - p.y, p.target.x - p.x), turn = HOMING[p.k];
      const da = angDiff(ta, p.a);
      const sp = Math.hypot(p.vx, p.vy);
      p.a += clamp(da, -turn * dt, turn * dt); p.vx = Math.cos(p.a) * sp; p.vy = Math.sin(p.a) * sp;
    }
    if (p.k === 'boomer') {
      if (!p.back) { p.x += p.vx * dt; p.y += p.vy * dt; p.dist += Math.hypot(p.vx, p.vy) * dt; if (p.dist >= p.out) { p.back = true; p.hit.clear(); } }
      else { const dx = P.x - p.x, dy = P.y - 8 - p.y, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(p.vx, p.vy) * 1.15; p.x += dx / d * sp * dt; p.y += dy / d * sp * dt; if (d < 22) p.life = 0; }
    } else { p.x += p.vx * dt; p.y += p.vy * dt; }
    if (p.k === 'saw') {
      if ((p.x < P.x - hw + p.r && p.vx < 0) || (p.x > P.x + hw - p.r && p.vx > 0)) p.vx = -p.vx;
      if ((p.y < P.y - hh + p.r && p.vy < 0) || (p.y > P.y + hh - p.r && p.vy > 0)) p.vy = -p.vy;
      if (p.life <= 0) continue;
      query(p.x, p.y, p.r, e => { if ((p.hm.get(e) || 0) > run.time) return; p.hm.set(e, run.time + .3); hurt(e, p.dmg, 60, p.vx / 400, p.vy / 400); for (let i = 0; i < 2; i++) part(p.x, p.y, frand(-120, 120), frand(-120, 120), .2, '#ffe9a0', 2); });
      continue;
    }
    if (p.k === 'shade') {
      let boom = p.life <= 0;
      query(p.x, p.y, 16, e => { if (e.spawnT > 0) return; boom = true; return false; });
      if (boom) { explode(p.x, p.y, p.rad, p.dmg, 'shade'); p.life = -1; }
      continue;
    }
    if (p.k === 'fireball' || p.k === 'rocket') {
      let boom = p.life <= 0;
      query(p.x, p.y, 12, () => { boom = true; return false; });
      if (boom) { explode(p.x, p.y, p.rad, p.dmg, 'fire'); p.life = -1; }
      if (Math.random() < .6) part(p.x - p.vx * .02, p.y - p.vy * .02, frand(-20, 20), frand(-20, 20), .3, p.k === 'rocket' ? 'rgba(200,200,200,.7)' : 'rgba(255,160,40,.8)', p.k === 'rocket' ? 4 : 5);
      continue;
    }
    if (p.life <= 0) continue;
    query(p.x, p.y, p.r, e => {
      if (p.hit.has(e)) return;
      p.hit.add(e);
      if (p.k === 'spear') { hurt(e, p.dmg, 90, Math.cos(p.a), Math.sin(p.a), '#9fe6ff'); e.slowT = 2.2; animFx('e_frostbolt_hit_', 5, e.x, e.y, .9, 22); }
      else { hurt(e, p.dmg, p.kb ?? (p.k === 'bullet' ? 25 : 70), Math.cos(p.a), Math.sin(p.a)); onProjHit(p, e); }
      p.pierce--;
      if (p.pierce < 0) { p.life = -1; return false; }
    });
  }
  setSrc(null);
  run.pproj = run.pproj.filter(p => p.life > 0);
}
