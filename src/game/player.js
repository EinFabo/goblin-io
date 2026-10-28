import { frand } from '../core/rng.js';
import { blinking, idleFrame, walkFrame } from '../gen/goblin.js';
import { joy, keys, sprintHeld } from '../core/input.js';
import { face8, isTouch } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { LOW_HP, damagePlayer } from './combat.js';
import { abilReady, bulwark, lockOf, shieldThorns } from './abilities.js';
import { ABILITIES, SLOT_KEYS } from '../data/abilities.js';
import { affixOnHitPlayer } from './affixes.js';
import { part } from './fx.js';
import { save } from '../core/save.js';
import { trailCol } from '../data/cosmetics.js';
import { hint } from './run.js';
import { P, clampToArena, heal, hidden, pR, query, run } from './state.js';

// ---------- Spieler ----------
export function updPlayer(dt) {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (joy.id !== null) { const jx = (joy.x - joy.ox) / 55, jy = (joy.y - joy.oy) / 55; if (Math.hypot(jx, jy) > .15) { mx += jx; my += jy; } }
  const len = Math.hypot(mx, my);
  P.moving = len > .1;
  if (P.moving) { P.aimX = mx / len; P.aimY = my / len; P.face = face8(mx, my, P.face); }
  const want = (keys.ShiftLeft || keys.ShiftRight || sprintHeld) && P.moving && !lockOf('sprint');
  if (want && !P.exhaust && P.stam > 0) {
    // Unermüdlich: die erste Sekunde jedes Sprints ist gratis
    P.sprinting = true; P.stam -= (P.tireless && P.sprintT < 1 ? 0 : P.stamDrain) * dt; P.stamDelay = .7; P.sprintT += dt;
    if (P.stam <= 0) {
      // Puste weg: kurz langsamer, Schweißtropfen (Zweiter Atem: kein Abbremsen, Erholung sofort)
      P.stam = 0; P.exhaust = true; P.exSlowT = P.secondWind ? 0 : .4; if (P.secondWind) P.stamDelay = 0; sfx.puh();
      for (let i = 0; i < 6; i++) part(P.x + frand(-10, 10), P.y - 34, frand(-60, 60), frand(-90, -40), .5, 'rgba(150,215,255,.9)', frand(2.5, 4));
    }
  } else {
    P.sprinting = false; P.sprintT = 0; P.stamDelay -= dt;
    if (P.stamDelay <= 0) P.stam = Math.min(P.stamMax, P.stam + P.stamRegen * dt);
    if (P.exhaust && P.stam >= P.stamMax * .35) P.exhaust = false;
  }
  const ox = P.x, oy = P.y;
  if (P.dashT > 0) {
    // drei Nachbilder pro Rolle, am Ende ein Landewölkchen
    P.dashT -= dt; P.x += P.dvx * dt; P.y += P.dvy * dt;
    // auf Eis: nach der Rolle in Rollrichtung weiterschlittern, nicht mit dem alten Schwung zurück
    P.ivx = P.aimX * P.speed; P.ivy = P.aimY * P.speed; P.iceT -= dt;
    P.trailT -= dt; if (P.trailT <= 0) { P.trailT = .06; P.trail.push({ x: P.x, y: P.y, spr: curPlayerSpr(), t: .25 }); }
    if (P.dashT <= 0) for (let i = 0; i < 6; i++) part(P.x + frand(-14, 14), P.y + 16, frand(-50, 50), frand(-40, -10), .4, trailCol(save.look.trail), frand(4, 7));
  } else {
    const sp = P.moving ? P.speed * (P.slowT > 0 ? .75 : 1) * (P.rageT > 0 ? 1.25 : 1) * (P.sprinting ? P.sprintMul : 1) * (P.mechT > 0 ? .95 : 1) * (P.exSlowT > 0 ? .8 : 1) * (P.hasteT > 0 ? 1 + P.haste : 1) * (P.spinT > 0 ? P.spinSlow : 1) * Math.min(1, len) : 0;
    // Auf Eis (Frostbart) schlittert man: Tempo folgt der Eingabe nur langsam
    const wx = P.aimX * sp, wy = P.aimY * sp;
    if (P.iceT > 0) { const k = 1 - Math.pow(.1, dt); P.ivx += (wx - P.ivx) * k; P.ivy += (wy - P.ivy) * k; P.iceT -= dt; }
    else { P.ivx = wx; P.ivy = wy; }
    P.x += P.ivx * dt; P.y += P.ivy * dt;
  }
  if (P.dashT <= 0 && P.moving) {
    const sp = Math.hypot(P.ivx, P.ivy);
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
  // Arena: Goblin und alle Boss-Körper (Boss, Teile, Spiegelbilder, Schatten) bleiben drin
  if (run.arena) {
    clampToArena(P, 22);
    for (const e of run.enemies) if (e.boss && !e.dead) clampToArena(e, 30);
  }
  P.vx = (P.x - ox) / Math.max(dt, 1e-4); P.vy = (P.y - oy) / Math.max(dt, 1e-4);
  P.inv -= dt; P.slowT -= dt; P.rageT -= dt; P.rollT -= dt; P.hitT -= dt; P.exSlowT -= dt; P.anim += dt * (P.sprinting ? 1.5 : 1);
  if (P.hp < P.maxHp * LOW_HP) run.lowT += dt;
  // Seelenflammen nach der Wiedergeburt (nur Optik)
  if (run.cycle && Math.random() < dt * (4 + 2 * run.cycle)) part(P.x + (Math.random() - .5) * 26, P.y + 10 - Math.random() * 30, (Math.random() - .5) * 20, -50 - Math.random() * 30, .6, Math.random() < .5 ? 'rgba(180,140,255,.85)' : 'rgba(120,220,255,.8)', 3 + Math.random() * 3);
  if (P.regen && P.hp < P.maxHp) heal(P.regen * dt);
  if (!hidden()) query(P.x, P.y, pR(), e => {
    if (e.dmg > 0 && !(e.freezeT > 0) && !e.obj) {
      const was = P.inv, before = P.hp; damagePlayer(e.dash ? e.dmg * 1.5 : e.dmg, 'contact', e); affixOnHitPlayer(e, before - P.hp);
      shieldThorns(e);
      if (e.melee === 'slow' && was <= 0 && P.mechT <= 0 && !bulwark()) P.slowT = .6;
      return false;
    }
  });
  // Hinweis, wenn eine Fähigkeit zum ersten Mal bereit ist
  run.abil.forEach((s, i) => {
    if (!s || P.abilReadyShown[i] || !abilReady(s)) return;
    P.abilReadyShown[i] = true;
    hint(`<b>${ABILITIES[s.id].name} bereit!</b> ` + (isTouch() ? `Tippe auf den Knopf ${save.settings.lefty ? 'links' : 'rechts'} unten.` : `Drück ${SLOT_KEYS[i]}.`));
  });
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
  if (P.moving) return `gob.walk.${d}.${walkFrame(P.step)}`;
  return blinking(P.anim) ? `gob.blink.${d}.1` : `gob.idle.${d}.${idleFrame(P.anim)}`;
}
