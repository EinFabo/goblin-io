import { ROLL_T } from './player.js';
import { frand, rand, pick } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { talent } from '../core/save.js';
import { hurt } from './combat.js';
import { addNum, animFx, part, ring } from './fx.js';
import { TAU } from '../core/util.js';
import { P, nearest, query, randomEnemyInView, run } from './state.js';
import { banner } from '../ui/hud.js';

// ---------- Fähigkeiten ----------
export function doDash() {
  if (!run || run.paused || run.over || P.dashCd > 0) return;
  P.dashT = .18; P.dashCd = 2.4; P.inv = Math.max(P.inv, .3);
  P.dvx = P.aimX * 900; P.dvy = P.aimY * 900;
  P.rollT = ROLL_T; P.perfect = false; P.trailT = 0;
  for (let i = 0; i < 8; i++) part(P.x + frand(-10, 10), P.y + 16, -P.aimX * 90 + frand(-40, 40), frand(-50, -10), .4, 'rgba(220,210,170,.8)', frand(4, 7));
  sfx.dash();
}
export function doUlt() {
  if (!run || run.paused || run.over || P.ult < P.ultNeed) return;
  P.ult = 0; P.rageT = 6;
  const dmg = (60 + P.lv * 9) * P.dmgMult;
  query(P.x, P.y, 380, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, dmg, 700, (e.x - P.x) / d, (e.y - P.y) / d, '#ff8a5c'); });
  for (const p of run.eproj) if (Math.hypot(p.x - P.x, p.y - P.y) < 380) p.life = 0;
  ring(P.x, P.y, 10, 380, .55, 'rgba(255,90,50,.95)', 16); ring(P.x, P.y, 10, 300, .4, 'rgba(255,220,90,.9)', 8);
  run.shake = 16; sfx.ult(); banner('Goblin-Wut!', 'danger');
}
export function startMech() {
  if (!run || run.paused || run.over || P.scrap < 100 || P.mechT > 0) return;
  P.scrap = 0; P.mechMax = P.mechT = 12 + 1.5 * talent('mech');
  P.gunT = 0; P.rocketT = .6; P.stepT = 0; P.inv = Math.max(P.inv, .6); P.slowT = 0;
  ring(P.x, P.y, 10, 160, .5, 'rgba(230,170,60,.95)', 10);
  for (let i = 0; i < 16; i++) part(P.x + frand(-30, 30), P.y + frand(-20, 20), frand(-120, 120), frand(-160, -40), .6, 'rgba(220,220,220,.8)', frand(5, 9));
  query(P.x, P.y, 120, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 30 * P.dmgMult, 500, (e.x - P.x) / d, (e.y - P.y) / d); });
  run.shake = 10; sfx.mechOn(); banner('Goblin-Maschine!', '');
}
export function updMech(dt) {
  if (P.mechT <= 0) return;
  P.mechT -= dt; P.gunFlash -= dt; P.stepT -= dt;
  if (P.moving && P.stepT <= 0) {
    P.stepT = .36; P.leg ^= 1;
    const fx = P.x + (P.leg ? 15 : -15), fy = P.y + 18;
    query(fx, fy, 55 * P.area, e => { const d = Math.hypot(e.x - fx, e.y - fy) || 1; hurt(e, 13 * P.dmgMult, 160, (e.x - fx) / d, (e.y - fy) / d); });
    ring(fx, fy, 6, 55 * P.area, .3, 'rgba(210,190,150,.8)', 5);
    for (let i = 0; i < 4; i++) part(fx, fy, frand(-60, 60), frand(-40, -5), .4, 'rgba(200,185,150,.8)', 5);
    run.shake = Math.max(run.shake, 2.5); sfx.stomp();
  }
  const t = nearest(470);
  if (t) P.gunA = Math.atan2(t.y - (P.y - 24), t.x - P.x);
  P.gunT -= dt;
  if (t && P.gunT <= 0) {
    P.gunT = .085;
    const side = Math.cos(P.gunA) >= 0 ? 1 : -1, gx = P.x + side * 28 + Math.cos(P.gunA) * 34, gy = P.y - 22 + Math.sin(P.gunA) * 34;
    const a = P.gunA + rand(-.07, .07);
    run.pproj.push({ k: 'bullet', x: gx, y: gy, a, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, dmg: 9 * P.dmgMult, pierce: 0, life: .7, hit: new Set(), r: 8, t: 0 });
    P.gunFlash = .04; sfx.gun();
  }
  P.rocketT -= dt;
  if (P.rocketT <= 0) {
    P.rocketT = 1.4;
    const c = randomEnemyInView(0);
    if (c.length) {
      for (let i = 0; i < 4; i++) {
        const e = pick(c), a = -Math.PI / 2 + (i - 1.5) * .5;
        run.pproj.push({ k: 'rocket', x: P.x - 10, y: P.y - 50, a, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, target: e, dmg: 30 * P.dmgMult, rad: 60 * P.area, pierce: 0, life: 2.2, hit: new Set(), r: 10, t: 0 });
      }
      sfx.rocket();
    }
  }
  if (Math.random() < dt * 14) { const side = Math.cos(P.gunA) >= 0 ? -1 : 1; part(P.x + side * 18, P.y - 62, frand(-10, 10), frand(-70, -40), .9, 'rgba(90,90,95,.55)', frand(6, 10)); }
  if (P.mechT <= 0) {
    const R = 200 * P.area;
    query(P.x, P.y, R, e => { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, 90 * P.dmgMult, 600, (e.x - P.x) / d, (e.y - P.y) / d, '#ffb35c'); });
    animFx('f_fireball_hit_', 5, P.x, P.y - 20, 6); ring(P.x, P.y, 10, R, .5, 'rgba(255,170,60,.95)', 14);
    for (let i = 0; i < 24; i++) part(P.x, P.y - 20, frand(-260, 260), frand(-300, 60), frand(.4, .9), i % 2 ? '#c9973a' : '#6d747c', frand(4, 8));
    P.inv = 1; run.shake = 16; sfx.boom(); sfx.ult(); banner('Maschine explodiert!', '');
  }
}

// Perfekte Rolle: durch ein Geschoss gerollt → kurze Zeitlupe, Glitzer, +5 Wut
export function perfectRoll(x, y) {
  if (P.perfect) return;
  P.perfect = true; run.slowT = .15;
  P.ult = Math.min(P.ultNeed, P.ult + 5);
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; part(x, y, Math.cos(a) * 160, Math.sin(a) * 160, .4, i % 2 ? '#fff6b0' : '#8fe6ff', 2.8); }
  addNum(P.x, P.y - 52, 'Perfekt!', '#8fe6ff', true);
  sfx.perfect();
}
