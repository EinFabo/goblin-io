import { frand } from '../core/rng.js';
import { joy, keys, sprintHeld } from '../core/input.js';
import { faceOf, isTouch } from '../core/util.js';
import { damagePlayer } from './combat.js';
import { part } from './fx.js';
import { hint } from './run.js';
import { P, pR, query, run } from './state.js';

// ---------- Spieler ----------
export function updPlayer(dt) {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (joy.id !== null) { const jx = (joy.x - joy.ox) / 55, jy = (joy.y - joy.oy) / 55; if (Math.hypot(jx, jy) > .15) { mx += jx; my += jy; } }
  const len = Math.hypot(mx, my);
  P.moving = len > .1;
  if (P.moving) { P.aimX = mx / len; P.aimY = my / len; P.face = faceOf(mx, my); }
  const want = (keys.ShiftLeft || keys.ShiftRight || sprintHeld) && P.moving && P.mechT <= 0;
  if (want && !P.exhaust && P.stam > 0) {
    P.sprinting = true; P.stam -= 34 * dt; P.stamDelay = .7;
    if (P.stam <= 0) { P.stam = 0; P.exhaust = true; }
    if (Math.random() < dt * 22) part(P.x + frand(-8, 8), P.y + 18, -P.aimX * 40 + frand(-20, 20), frand(-30, -5), .35, 'rgba(220,210,170,.75)', frand(3, 6));
  } else {
    P.sprinting = false; P.stamDelay -= dt;
    if (P.stamDelay <= 0) P.stam = Math.min(P.stamMax, P.stam + 26 * dt);
    if (P.exhaust && P.stam >= P.stamMax * .35) P.exhaust = false;
  }
  const ox = P.x, oy = P.y;
  if (P.dashT > 0) {
    P.dashT -= dt; P.x += P.dvx * dt; P.y += P.dvy * dt;
    P.trailT -= dt; if (P.trailT <= 0) { P.trailT = .03; P.trail.push({ x: P.x, y: P.y, spr: curPlayerSpr(), t: .25 }); }
  } else if (P.moving) {
    const sp = P.speed * (P.slowT > 0 ? .75 : 1) * (P.rageT > 0 ? 1.25 : 1) * (P.sprinting ? 1.55 : 1) * (P.mechT > 0 ? .95 : 1) * Math.min(1, len);
    P.x += P.aimX * sp * dt; P.y += P.aimY * sp * dt;
  }
  for (const t of P.trail) t.t -= dt; P.trail = P.trail.filter(t => t.t > 0);
  if (run.arena) {
    const A = run.arena, dx = P.x - A.x, dy = P.y - A.y, d = Math.hypot(dx, dy);
    if (d > A.r - 22) { P.x = A.x + dx / d * (A.r - 22); P.y = A.y + dy / d * (A.r - 22); }
    if (run.boss) { const b = run.boss, bx = b.x - A.x, by = b.y - A.y, bd = Math.hypot(bx, by); if (bd > A.r - 30) { b.x = A.x + bx / bd * (A.r - 30); b.y = A.y + by / bd * (A.r - 30); } }
  }
  P.vx = (P.x - ox) / Math.max(dt, 1e-4); P.vy = (P.y - oy) / Math.max(dt, 1e-4);
  P.inv -= dt; P.dashCd -= dt; P.slowT -= dt; P.rageT -= dt; P.anim += dt * (P.sprinting ? 1.5 : 1);
  if (P.regen && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
  query(P.x, P.y, pR(), e => { if (e.dmg > 0 && !(e.freezeT > 0)) { damagePlayer(e.dmg); return false; } });
  if (P.scrap >= 100 && !P.mechReadyShown) { P.mechReadyShown = true; hint(isTouch() ? '<b>Maschine bereit!</b> Tippe auf den Maschinen-Knopf.' : '<b>Maschine bereit!</b> Drück F zum Einsteigen.'); }
  if (P.mechT > 0) P.mechReadyShown = false;
}
export function curPlayerSpr() {
  return P.moving ? 'walk_' + P.face + '_' + ((Math.floor(P.anim * 10) % 6) + 1) : 'idle_' + P.face + '_' + ((Math.floor(P.anim * 5) % 4) + 1);
}
