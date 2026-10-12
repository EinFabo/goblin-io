import { frand } from '../core/rng.js';
import { joy, keys, sprintHeld } from '../core/input.js';
import { face8, isTouch } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { damagePlayer } from './combat.js';
import { affixOnHitPlayer } from './affixes.js';
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
  if (P.moving) { P.aimX = mx / len; P.aimY = my / len; P.face = face8(mx, my, P.face); }
  const want = (keys.ShiftLeft || keys.ShiftRight || sprintHeld) && P.moving && P.mechT <= 0;
  if (want && !P.exhaust && P.stam > 0) {
    P.sprinting = true; P.stam -= 34 * dt; P.stamDelay = .7;
    if (P.stam <= 0) {
      // Puste weg: kurz langsamer, Schweißtropfen
      P.stam = 0; P.exhaust = true; P.exSlowT = .4; sfx.puh();
      for (let i = 0; i < 6; i++) part(P.x + frand(-10, 10), P.y - 34, frand(-60, 60), frand(-90, -40), .5, 'rgba(150,215,255,.9)', frand(2.5, 4));
    }
  } else {
    P.sprinting = false; P.stamDelay -= dt;
    if (P.stamDelay <= 0) P.stam = Math.min(P.stamMax, P.stam + 26 * dt);
    if (P.exhaust && P.stam >= P.stamMax * .35) P.exhaust = false;
  }
  const ox = P.x, oy = P.y;
  if (P.dashT > 0) {
    // drei Nachbilder pro Rolle, am Ende ein Landewölkchen
    P.dashT -= dt; P.x += P.dvx * dt; P.y += P.dvy * dt;
    P.trailT -= dt; if (P.trailT <= 0) { P.trailT = .06; P.trail.push({ x: P.x, y: P.y, spr: curPlayerSpr(), t: .25 }); }
    if (P.dashT <= 0) for (let i = 0; i < 6; i++) part(P.x + frand(-14, 14), P.y + 16, frand(-50, 50), frand(-40, -10), .4, 'rgba(220,210,170,.75)', frand(4, 7));
  } else if (P.moving) {
    const sp = P.speed * (P.slowT > 0 ? .75 : 1) * (P.rageT > 0 ? 1.25 : 1) * (P.sprinting ? 1.55 : 1) * (P.mechT > 0 ? .95 : 1) * (P.exSlowT > 0 ? .8 : 1) * Math.min(1, len);
    P.x += P.aimX * sp * dt; P.y += P.aimY * sp * dt;
    // Animation läuft mit der echten Geschwindigkeit; Staub und Schritt-Klick genau auf Schritt-Frames 2 und 5
    const before = Math.floor(P.step) % 6;
    P.step += sp * dt / (P.sprinting ? 22 : 16.5);
    const fr = Math.floor(P.step) % 6;
    if (P.sprinting && fr !== before && (fr === 1 || fr === 4)) {
      for (let i = 0; i < 3; i++) part(P.x + frand(-6, 6), P.y + 18, -P.aimX * 50 + frand(-20, 20), frand(-30, -8), .35, 'rgba(220,210,170,.75)', frand(3, 6));
      sfx.step();
    }
  }
  if (P.stam < P.stamMax * .25 && (P.sprinting || P.exhaust)) sfx.breath();
  for (const t of P.trail) t.t -= dt; P.trail = P.trail.filter(t => t.t > 0);
  if (run.arena) {
    const A = run.arena, dx = P.x - A.x, dy = P.y - A.y, d = Math.hypot(dx, dy);
    if (d > A.r - 22) { P.x = A.x + dx / d * (A.r - 22); P.y = A.y + dy / d * (A.r - 22); }
    if (run.boss) { const b = run.boss, bx = b.x - A.x, by = b.y - A.y, bd = Math.hypot(bx, by); if (bd > A.r - 30) { b.x = A.x + bx / bd * (A.r - 30); b.y = A.y + by / bd * (A.r - 30); } }
  }
  P.vx = (P.x - ox) / Math.max(dt, 1e-4); P.vy = (P.y - oy) / Math.max(dt, 1e-4);
  P.inv -= dt; P.dashCd -= dt; P.slowT -= dt; P.rageT -= dt; P.rollT -= dt; P.hitT -= dt; P.exSlowT -= dt; P.anim += dt * (P.sprinting ? 1.5 : 1);
  if (P.regen && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
  query(P.x, P.y, pR(), e => {
    if (e.dmg > 0 && !(e.freezeT > 0) && !e.obj) {
      const was = P.inv, before = P.hp; damagePlayer(e.dash ? e.dmg * 1.5 : e.dmg); affixOnHitPlayer(e, before - P.hp);
      if (e.melee === 'slow' && was <= 0 && P.mechT <= 0) P.slowT = .6;
      return false;
    }
  });
  if (P.scrap >= 100 && !P.mechReadyShown) { P.mechReadyShown = true; hint(isTouch() ? '<b>Maschine bereit!</b> Tippe auf den Maschinen-Knopf.' : '<b>Maschine bereit!</b> Drück F zum Einsteigen.'); }
  if (P.mechT > 0) P.mechReadyShown = false;
}
export const ROLL_T = .3;   // Roll-Animation (die Rolle selbst dauert .18 s)
export function curPlayerSpr() {
  const d = P.face;
  if (run.over) {
    const f = Math.floor(P.endAnim * 8);
    if (run.result && run.result.win) return `gob.victory.${d}.${f < 6 ? f + 1 : 3 + (Math.floor(f / 2) % 3)}`;
    return `gob.death.${d}.${f < 4 ? f + 1 : 5 + (Math.floor(f / 3) % 2)}`;
  }
  if (P.rollT > 0) return `gob.roll.${d}.${Math.min(6, 1 + Math.floor((1 - P.rollT / ROLL_T) * 6))}`;
  if (P.hitT > 0) return `gob.hurt.${d}.${P.hitT > .12 ? 1 : 2}`;
  if (P.sprinting) return `gob.sprint.${d}.${(Math.floor(P.step) % 6) + 1}`;
  if (P.moving) return `gob.walk.${d}.${(Math.floor(P.step) % 6) + 1}`;
  return `gob.idle.${d}.${(Math.floor(P.anim * 5) % 4) + 1}`;
}
