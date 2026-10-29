// ---------- Zweite Waffen-Reihe (Wunsch Fabi 2026-10-14: doppelt so viele Karten) ----------
// Hammer, Wurfsterne, Armbrust, Schattenkugel, Steinschleuder, Lichtlanze, Seelenlicht, Säurespucke,
// Funkenring, Minen. stepWeapon2 wird aus weapons.js aufgerufen; dauerhafte Effekte (schwarze Löcher,
// Minen, Strahlen, Felsbrocken) liegen in run.wfx und laufen in updWfx.
// Spiellogik nur mit rnd/rand/pick (Seed), Math.random nur für Partikel.
import { rnd, rand, pick } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU } from '../core/util.js';
import { hurt } from './combat.js';
import { explode, later, part, ring } from './fx.js';
import { P, heal, isBig, nearest, query, randomEnemyInView, run, setWsrc, wsrc } from './state.js';
// Kreis-Import (weapons.js ↔ weapons2.js) ist unbedenklich: beides sind Funktions-Deklarationen
import { shoot, shootRaw } from './weapons.js';


const aoe = () => P.aoeMult || 1;
// Stärkster Gegner in Reichweite (Armbrust: auf Elite und Bosse)
function strongest(maxD) {
  let best = null, bh = -1;
  for (const e of run.enemies) {
    if (e.dead || e.spawnT > 0 || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > maxD * maxD) continue;
    const h = (e.link || e).hp; if (h > bh) { bh = h; best = e; }
  }
  return best;
}
// Druckwelle um (x, y)
export function wave(x, y, R, dmg, kb, col) {
  query(x, y, R, e => { const d = Math.hypot(e.x - x, e.y - y) || 1; hurt(e, dmg, kb, (e.x - x) / d, (e.y - y) / d, col); });
  ring(x, y, 12, R, .35, 'rgba(220,180,110,.9)', 8);
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; part(x + Math.cos(a) * R * .8, y + Math.sin(a) * R * .6, Math.cos(a) * 60, -40, .45, i % 2 ? '#8a6a44' : '#c9a35a', 5); }
  run.shake = Math.max(run.shake, 4); sfx.boom();
}
// Lichtstrahl von (x, y) in Richtung a: trifft alles, was nah genug an der Linie liegt
// perHit: höchstens ein Treffer je Gegner in dieser Zeit, getrennt je Strahl-Art (key)
function beam(x, y, a, len, wid, dmg, perHit = 0, key = 'bh') {
  const cx = Math.cos(a), cy = Math.sin(a);
  query(x + cx * len / 2, y + cy * len / 2, len / 2 + wid, e => {
    const dx = e.x - x, dy = e.y - y, t = dx * cx + dy * cy;
    if (t < 0 || t > len) return;
    if (Math.abs(dx * cy - dy * cx) > wid / 2 + e.r) return;
    if (perHit) { if ((e[key] || 0) > run.time) return; e[key] = run.time + perHit; }
    hurt(e, dmg, 40, cx, cy, '#fff4b0');
  });
}

export function stepWeapon2(w, L, dm, dt, rate) {
  switch (w.id) {
    case 'hammer': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) {
        w.t = 2.4 * P.cdMult; const dmg = 34 * dm * aoe();
        for (let i = 0; i < 3; i++) later(i * .3, () => wave(P.x, P.y, (150 + i * 55) * P.area, dmg, 260, '#c9a35a'));
        later(.05, () => query(P.x, P.y, 260 * P.area, e => { if (!e.boss) e.slowT = Math.max(e.slowT || 0, 1.5 * (P.dur || 1)); }));
      } else {
        w.t = [2.2, 2.2, 2, 1.8, 1.8][L] * P.cdMult;
        const dmg = [16, 21, 21, 27, 27][L] * dm * aoe(), R = [110, 110, 135, 135, 140][L] * P.area;
        wave(P.x, P.y, R, dmg, 220, '#c9a35a');
        if (L >= 4) later(.35, () => wave(P.x, P.y, R * 1.3, dmg * .6, 160, '#c9a35a'));
      }
      break;
    }
    case 'shuriken': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) { w.t = .45 * P.cdMult; w.rot += .35; for (let i = 0; i < 16; i++) shoot('star', w.rot + i * TAU / 16, 16, 99, 470 * P.proj, 1, { sc: 1.3 }); }
      else {
        w.t = [1.1, 1.1, 1, 1, .85][L] * P.cdMult; w.rot += .4;
        const n = [4, 5, 5, 7, 9][L], dmg = [9, 9, 12, 12, 13][L], pierce = [0, 0, 0, 2, 2][L];
        for (let i = 0; i < n; i++) shoot('star', w.rot + i * TAU / n, dmg, pierce, 430 * P.proj, .8, { sc: 1 });
      }
      sfx.throw(); break;
    }
    case 'crossbow': {
      w.t -= dt * rate; if (w.t > 0) break;
      const t = strongest(560), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
      if (w.evo) { w.t = 1.2 * P.cdMult; for (let i = 0; i < 3; i++) shoot('xbolt', a + (i - 1) * .12, 70, 99, 820 * P.proj, .9, { sc: 2, r: 22, kb: 300 }); }
      else {
        w.t = [1.4, 1.4, 1.3, 1.3, 1.05][L] * P.cdMult;
        const n = [1, 1, 1, 2, 2][L], dmg = [30, 42, 42, 42, 63][L], pierce = [0, 0, 2, 2, 2][L];
        for (let i = 0; i < n; i++) shoot('xbolt', a + (i - (n - 1) / 2) * .1, dmg, pierce, 800 * P.proj, .8, { sc: 1, r: 10, kb: 120 });
      }
      sfx.throw(); break;
    }
    case 'shadow': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) {
        w.t = 4 * P.cdMult;
        const c = randomEnemyInView(40), e = c.length ? pick(c) : null;
        run.wfx.push({ ws: wsrc, k: 'hole', x: e ? e.x : P.x + rand(-160, 160), y: e ? e.y : P.y + rand(-120, 120), t: 0, dur: 3 * (P.dur || 1), tick: 0, R: 230 * P.area, dmg: 14 * dm * aoe(), end: 120 * dm });
        sfx.cast();
      } else {
        w.t = [2.2, 2.2, 2.1, 2.1, 1.9][L] * P.cdMult;
        const n = [1, 1, 2, 2, 3][L], dmg = [30, 39, 39, 39, 50][L], rad = [60, 60, 60, 80, 80][L] * P.area;
        const c = randomEnemyInView(-40);
        for (let i = 0; i < n; i++) { const e = c.length ? c.splice((rnd() * c.length) | 0, 1)[0] : nearest(500); if (!e) break; shoot('shade', Math.atan2(e.y - P.y, e.x - P.x), dmg, 0, 190 * P.proj, 3.5, { target: e, rad, sc: 1.6 }); }
        sfx.cast();
      }
      break;
    }
    case 'rock': {
      w.t -= dt * rate; if (w.t > 0) break;
      if (w.evo) {
        w.t = 1.6 * P.cdMult; const c = randomEnemyInView(20);
        for (let i = 0; i < 4; i++) { const e = c.length ? pick(c) : null; run.wfx.push({ ws: wsrc, k: 'boulder', x: e ? e.x + rand(-20, 20) : P.x + rand(-250, 250), y: e ? e.y + rand(-20, 20) : P.y + rand(-200, 200), t: 0, dur: .55, rad: 80 * P.area, dmg: 40 * dm, shard: 18 * dm }); }
      } else {
        w.t = [1.5, 1.5, 1.4, 1.3, 1.2][L] * P.cdMult;
        const n = [1, 1, 1, 2, 2][L], dmg = [14, 14, 18, 18, 22][L], bounce = [2, 3, 3, 3, 5][L];
        const t = nearest(500), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
        for (let i = 0; i < n; i++) shoot('rock', a + (i - (n - 1) / 2) * .3, dmg, 0, 520 * P.proj, 1.6, { bounce, sc: 1 });
      }
      sfx.throw(); break;
    }
    case 'lance': {
      if (w.evo) {
        // Sonnenstrahl kreist dauerhaft; trifft jeden Gegner höchstens alle 0,3 s
        w.a += 1.7 * dt * rate;
        beam(P.x, P.y - 8, w.a, 420 * P.area, 44 * P.area, 16 * dm, .3);
        break;
      }
      w.t -= dt * rate; if (w.t > 0) break;
      w.t = [1.6, 1.6, 1.5, 1.5, 1.2][L] * P.cdMult;
      const a = Math.atan2(P.aimY, P.aimX), len = 520 * P.area, wid = [22, 22, 32, 32, 32][L] * P.area, dmg = [22, 29, 29, 29, 40][L] * dm;
      beam(P.x, P.y - 8, a, len, wid, dmg);
      run.wfx.push({ ws: wsrc, k: 'beam', x: P.x, y: P.y - 8, a, len, wid, t: 0, dur: .25 });
      if (L >= 3) { beam(P.x, P.y - 8, a + Math.PI, len, wid, dmg); run.wfx.push({ ws: wsrc, k: 'beam', x: P.x, y: P.y - 8, a: a + Math.PI, len, wid, t: 0, dur: .25 }); }
      sfx.zap(); break;
    }
    case 'soul': {
      w.t -= dt * rate; if (w.t > 0) break;
      const c = randomEnemyInView(20);
      if (w.evo) { w.t = .5 * P.cdMult; for (let i = 0; i < 3; i++) shoot('soul', rnd() * TAU, 18, 2, 300 * P.proj, 4, { target: c.length ? pick(c) : null, heal: 1.2, sc: 1.3 }); }
      else {
        w.t = [1.4, 1.4, 1.3, 1.3, 1.1][L] * P.cdMult;
        const n = [2, 3, 3, 4, 6][L], dmg = [10, 10, 13, 13, 13][L], heal = [.6, .6, .6, 1, 1][L];
        for (let i = 0; i < n; i++) shoot('soul', rnd() * TAU, dmg, 0, 260 * P.proj, 3, { target: c.length ? pick(c) : null, heal, sc: 1 });
      }
      break;
    }
    case 'glob': {
      w.t -= dt * rate; if (w.t > 0) break;
      const c = randomEnemyInView(40), throwAt = (rad, zdur, dmg) => { const e = c.length ? pick(c) : null; run.tele.push({ pi: run.pi, ws: wsrc, k: 'flask', zk: 'acid', sx: P.x, sy: P.y - 10, x: e ? e.x : P.x + rand(-200, 200), y: e ? e.y : P.y + rand(-160, 160), t: 0, dur: .5, rad, zdur, dmg }); };
      if (w.evo) { w.t = 1.2 * P.cdMult; for (let i = 0; i < 4; i++) throwAt(75 * P.area, 3.5, 12 * dm); }
      else {
        w.t = [2.2, 2.1, 2, 1.9, 1.8][L] * P.cdMult;
        const n = [1, 1, 2, 2, 3][L];
        for (let i = 0; i < n; i++) throwAt([55, 70, 70, 70, 70][L] * P.area, [2.5, 2.5, 2.5, 3.5, 3.5][L], [7, 7, 7, 10, 10][L] * dm);
      }
      sfx.throw(); break;
    }
    case 'spark': {
      if (w.evo) {
        // drei Plasmakugeln kreisen; jede schießt alle 0,8 s vier Funken
        w.a += 2.4 * dt * rate; w.blades.length = 0; w.t -= dt * rate;
        const fire = w.t <= 0; if (fire) w.t = .8 * P.cdMult;
        for (let i = 0; i < 3; i++) {
          const a = w.a + i * TAU / 3, bx = P.x + Math.cos(a) * 120 * P.area, by = P.y - 8 + Math.sin(a) * 120 * P.area;
          w.blades.push([bx, by, a]);
          // Trefferpause im eigenen Feld (e.ph ist beim Boss die Phase: das überschrieb sie, Absturz im Bosskampf)
          query(bx, by, 22 * P.area, e => { if ((e.plasT || 0) > run.time) return; e.plasT = run.time + .4; hurt(e, 20 * dm, 60, 0, 0, '#c7a7ff'); });
          if (fire) { const c = randomEnemyInView(20); for (let j = 0; j < 4; j++) shoot('spark', rnd() * TAU, 14, 0, 320 * P.proj, 1.2, { x: bx, y: by, target: c.length ? pick(c) : null, sc: 1 }); }
        }
        if (fire) sfx.zap();
        break;
      }
      w.t -= dt * rate; if (w.t > 0) break;
      w.t = [1.5, 1.5, 1.4, 1.4, 1.2][L] * P.cdMult; w.rot += .5;
      const n = [4, 6, 6, 8, 11][L], dmg = [8, 8, 11, 11, 11][L], c = randomEnemyInView(20);
      for (let i = 0; i < n; i++) shoot('spark', w.rot + i * TAU / n, dmg, 0, 300 * P.proj, 1.2, { target: c.length ? pick(c) : null, sc: .9 });
      sfx.zap(); break;
    }
    case 'mine': {
      w.t -= dt * rate; if (w.t > 0) break;
      const evo = w.evo, n = evo ? 2 : [1, 1, 2, 2, 3][L];
      w.t = (evo ? .7 : [1.6, 1.6, 1.5, 1.5, 1.3][L]) * P.cdMult;
      const rad = (evo ? 85 : [60, 60, 60, 80, 80][L]) * P.area, dmg = (evo ? 50 : [30, 39, 39, 39, 45][L]) * dm;
      for (let i = 0; i < n; i++) run.wfx.push({ ws: wsrc, k: 'mine', x: P.x + rand(-30, 30), y: P.y + rand(-20, 25), t: 0, arm: .5, life: 14, rad, dmg, evo, dm });
      // höchstens 14 Minen liegen: die ältesten verpuffen
      let mines = 0; for (let i = run.wfx.length - 1; i >= 0; i--) if (run.wfx[i].k === 'mine' && ++mines > 14) run.wfx[i].life = 0;
      sfx.throw(); break;
    }
    // ---------- Klassenwaffen (Phase 9) ----------
    case 'bow': {
      if (w.evo) {
        // Pfeilregen alle 2,4 s auf bis zu sechs Gegner (fällt nach 0,35 s)
        w.t2 -= dt * rate;
        if (w.t2 <= 0) {
          w.t2 = 2.6 * P.cdMult; const c = randomEnemyInView(20);
          for (let i = 0; i < 6 && c.length; i++) { const e = c.splice((rnd() * c.length) | 0, 1)[0]; run.wfx.push({ ws: wsrc, k: 'arrows', x: e.x, y: e.y, t: 0, dur: .35, rad: 55 * P.area, dmg: 20 * dm * aoe() }); }
        }
      }
      w.t -= dt * rate; if (w.t > 0) break;
      const t = nearest(560), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
      if (w.evo) { w.t = .6 * P.cdMult; for (let i = 0; i < 5; i++) shoot('arrow', a + (i - 2) * .12, 16, 99, 760 * P.proj, .9, { r: 11 }); }
      else {
        w.t = [.8, .8, .75, .75, .6][L] * P.cdMult;
        const n = [1, 2, 2, 3, 4][L], dmg = [12, 12, 16, 16, 18][L], pierce = [1, 1, 1, 2, 2][L];
        for (let i = 0; i < n; i++) shoot('arrow', a + (i - (n - 1) / 2) * .09, dmg, pierce, 700 * P.proj, .9, { r: 10 });
      }
      sfx.throw(); break;
    }
    case 'staff': {
      w.t -= dt * rate; if (w.t > 0) break;
      const c = randomEnemyInView(20);
      if (w.evo) {
        w.t = .7 * P.cdMult; w.rot += .4;
        for (let i = 0; i < 6; i++) shoot('orb', w.rot + i * TAU / 6, 24, 1, 420 * P.proj, 2.2, { target: c.length ? pick(c) : null, sc: 1.3 });
      } else {
        w.t = [.95, .95, .9, .9, .75][L] * P.cdMult;
        const n = [1, 2, 2, 3, 4][L], dmg = [16, 16, 21, 21, 24][L], pierce = [0, 0, 0, 1, 1][L];
        const t = nearest(560), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
        // die erste Kugel jagt den nächsten Gegner, weitere zufällige im Bild
        for (let i = 0; i < n; i++) shoot('orb', a + (i - (n - 1) / 2) * .5, dmg, pierce, 460 * P.proj, 1.8, { target: i && c.length ? pick(c) : t, sc: 1 });
      }
      sfx.cast(); break;
    }
    case 'club': {
      w.t -= dt * rate; if (w.t > 0) break;
      const t = nearest(220), a = t ? Math.atan2(t.y - P.y, t.x - P.x) : Math.atan2(P.aimY, P.aimX);
      // jeder Schlag schickt dazu eine Schockwelle nach vorn (40 % Schaden, durchschlägt alles): Bosse halten Abstand
      if (w.evo) {
        w.t = .7 * P.cdMult; w.n = (w.n || 0) + 1;
        swing(a, 160 * P.area, 52 * dm, 200, true);
        shoot('quake', a, 26, 99, 480 * P.proj, .75, { r: 26, sc: 1.4, kb: 60, big: 2 });
        if (w.n % 3 === 0) later(.12, () => wave(P.x, P.y, 220 * P.area, 36 * dm * aoe(), 220, '#c9a35a'));
      } else {
        w.t = [.85, .85, .8, .8, .65][L] * P.cdMult;
        const dmg = [20, 25, 25, 31, 38][L];
        swing(a, [100, 100, 115, 125, 130][L] * P.area, dmg * dm, 120, L >= 3);
        shoot('quake', a, dmg * .4, 99, 440 * P.proj, .65, { r: 20, sc: 1, kb: 40, big: 2 });
      }
      w.swing = { a, at: run.time, R: (w.evo ? 160 : [100, 100, 115, 125, 130][L]) * P.area, full: w.evo || L >= 3 };
      sfx.whoosh(); break;
    }
  }
}
// Keulenschlag: Halbkreis (oder rundherum) um den Goblin, Rückstoß nach außen; Elite und Bosse doppelt (Nahkampf-Ausgleich)
function swing(a, R, dmg, kb, full) {
  const ca = Math.cos(a), sa = Math.sin(a);
  query(P.x, P.y, R, e => {
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
    if (!full && (dx * ca + dy * sa) / d < -.2) return;   // hinter dem Goblin: kein Treffer
    hurt(e, isBig(e) ? dmg * 2 : dmg, kb, dx / d, dy / d, '#e8c88a');
  });
  run.shake = Math.max(run.shake, 2);
}

// ---------- Dauerhafte Effekte ----------
export function updWfx(dt) {
  for (const f of run.wfx) {
    f.t += dt; setWsrc(f.ws);
    if (f.k === 'hole') {
      // ansaugen (keine Bosse), alle 0,25 s Schaden, am Ende Zusammenbruch
      query(f.x, f.y, f.R, e => {
        if (!e.boss && !e.obj) { const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy) || 1, s = Math.min(d, 150 * dt * (e.elite ? .4 : 1)); e.x += dx / d * s; e.y += dy / d * s; }
      });
      f.tick -= dt;
      if (f.tick <= 0) { f.tick = .25; query(f.x, f.y, f.R * .45, e => hurt(e, f.dmg, 0, 0, 0, '#b48cff')); }
      if (Math.random() < dt * 30) { const a = Math.random() * TAU, r = f.R * (.6 + Math.random() * .4); part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * .7, -Math.cos(a) * r * 1.5, -Math.sin(a) * r, .6, 'rgba(160,110,255,.8)', 4); }
      if (f.t >= f.dur) { f.done = true; explode(f.x, f.y, f.R * .6, f.end, 'shade'); run.shake = Math.max(run.shake, 8); }
    } else if (f.k === 'boulder') {
      if (f.t >= f.dur) {
        f.done = true; explode(f.x, f.y, f.rad, f.dmg, 'rock'); run.shake = Math.max(run.shake, 5);
        for (let i = 0; i < 3; i++) shootRaw('rock', rnd() * TAU, f.shard, 0, 480 * P.proj, 1.2, { x: f.x, y: f.y, bounce: 3, sc: .8 });
      }
    } else if (f.k === 'mine') {
      f.life -= dt;
      if (f.life <= 0) { f.done = true; continue; }
      if (f.t < f.arm) continue;
      let hit = false; query(f.x, f.y, 26, e => { if (e.spawnT > 0) return; hit = true; return false; });
      if (hit) {
        f.done = true; explode(f.x, f.y, f.rad, f.dmg, 'fire'); run.shake = Math.max(run.shake, 4);
        if (f.evo) for (let i = 0; i < 6; i++) shootRaw('shard', i * TAU / 6 + rand(-.2, .2), 14 * f.dm, 1, 420 * P.proj, .6, { x: f.x, y: f.y, sc: 1 });
      }
    } else if (f.k === 'beam') { if (f.t >= f.dur) f.done = true; }
    else if (f.k === 'arrows') {
      // Pfeilregen (Pfeilhagel): trifft beim Aufschlag alles im Kreis
      if (f.t >= f.dur) { f.done = true; query(f.x, f.y, f.rad, e => hurt(e, f.dmg, 40, 0, 0, '#e8d6a0')); for (let i = 0; i < 6; i++) part(f.x + (Math.random() - .5) * f.rad * 1.4, f.y + (Math.random() - .5) * f.rad, 0, -30, .35, '#c9a35a', 3); }
    }
    else if (f.k === 'eclipse') {
      // Mega Sonnenfinsternis: vier Strahlen kreisen um die Mitte
      f.a += 2.2 * dt; f.x = P.x; f.y = P.y - 8;   // die Strahlen hängen am Goblin
      for (let i = 0; i < 4; i++) beam(f.x, f.y, f.a + i * TAU / 4, 460 * P.area, 50 * P.area, f.dmg, .3, 'eh');
      if (f.t >= f.dur) f.done = true;
    }
  }
  if (run.wfx.some(f => f.done || f.life <= 0)) run.wfx = run.wfx.filter(f => !f.done && !(f.life <= 0));
  setWsrc(null);
}

// Treffer-Sonderfälle der neuen Geschosse (aus updPProj): Stein springt weiter, Seele heilt
export function onProjHit(p, e) {
  // Seelen heilen höchstens 4× pro Sekunde (sonst macht ein Schwarm unverwundbar)
  if (p.k === 'soul' && p.heal && run.time >= (run.soulHealT || 0)) { run.soulHealT = run.time + .25; heal(p.heal); }
  if (p.k === 'rock' && p.bounce > 0) {
    let nx = null, nd = 260 * 260;
    query(e.x, e.y, 260, o => {
      if (o === e || p.hit.has(o) || o.spawnT > 0) return;
      const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (d < nd) { nd = d; nx = o; }
    });
    if (nx) { p.bounce--; p.pierce++; const a = Math.atan2(nx.y - e.y, nx.x - e.x), sp = Math.hypot(p.vx, p.vy); p.a = a; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.life = Math.max(p.life, .6); }
  }
}
