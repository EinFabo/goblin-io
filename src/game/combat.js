import { RNG, rnd, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { $ } from '../core/util.js';
import { chargeAbil, shieldAbsorb, tryRevive } from './abilities.js';
import { hitDamage } from './balance.js';
import { bomberBoom, damageRules, deathRules } from './enemies.js';
import { addItem, addNum, animFx, dissolve, dropGem } from './fx.js';
import { addEvents } from './run.js';
import { P, run } from './state.js';
import { banner } from '../ui/hud.js';
import { endRun } from './run.js';

// ---------- Schaden ----------
export function hurt(e, dmg, kb = 0, kx = 0, ky = 0, col = null) {
  if (e.dead) return;
  const crit = rnd() < P.crit;
  const rule = damageRules(e, dmg * (crit ? 2 : 1) * rand(.9, 1.1), kx, ky);
  const d = Math.max(rule.dmg > 0 ? 1 : 0, Math.round(rule.dmg));
  e.hp -= d; e.flash = .09;
  if (e.tb !== undefined && e.freezeT > 0) e.tb += d;   // Zeitbombe sammelt Schaden
  if (kb && !e.boss && !rule.blocked) { const m = e.elite ? .25 : e.traits && e.traits.includes('heavy') ? .2 : 1; e.kx += kx * kb * m; e.ky += ky * kb * m; }
  if (d > 0) addNum(e.x, e.y - 22 * e.sc, d, crit ? '#ffd84a' : col || '#ffffff', crit);
  else if (rule.blocked) addNum(e.x, e.y - 22 * e.sc, 'Block', '#dff6ff', false);
  sfx.hit();
  if (e.hp <= 0) kill(e);
}
export function kill(e) {
  e.dead = true; run.kills++;
  emit('enemyKilled', e);
  if (!e.boss) { chargeAbil('kills', 1); chargeAbil('scrap', .35); }
  dropGem(e.x, e.y, e.xp);
  dissolve(e);
  if (e.elite || e.miniboss) run.hitstop = Math.max(run.hitstop, .04);
  if (e.boss) run.hitstop = Math.max(run.hitstop, .08);
  sfx.kill();
  if (e.bomber && !e.boomed) bomberBoom(e, false);
  deathRules(e);
  if (e.miniboss) { for (let i = 0; i < 12; i++) addItem('coin', e.x, e.y); for (let i = 0; i < 3; i++) addItem('gear', e.x, e.y); addItem('chest', e.x, e.y, 'mini'); healPity(e); }
  else if (e.elite) { for (let i = 0; i < 8; i++) addItem('coin', e.x, e.y); for (let i = 0; i < 3; i++) addItem('gear', e.x, e.y); addItem('chest', e.x, e.y, 'elite'); healPity(e); }
  else if (!e.boss) {
    const r = RNG.loot.next();
    if (r < .05) addItem('coin', e.x, e.y);
    else if (r < .1) addItem('gear', e.x, e.y);
    const r2 = RNG.loot.next();
    if (r2 < .006) addItem('heal', e.x, e.y); else if (r2 < .009) addItem('magnet', e.x, e.y); else if (r2 < .0115) addItem('bomb', e.x, e.y);
  }
  if (e.boss) bossDown(e);
}
// Heilungs-Pity (7.5): wer 20 s unter 30 % Leben war, bekommt vom nächsten Elite/Mini-Boss garantiert ein Herz
export const LOW_HP = .3, LOW_T = 20;
function healPity(e) { if (run.lowT >= LOW_T) { run.lowT = 0; addItem('heal', e.x, e.y); } }
export function bossDown(b) {
  run.boss = null; run.arena = null; emit('bossDown', b);
  $('#bossBar').hidden = true;
  for (let i = 0; i < 25; i++) addItem('coin', b.x, b.y);
  for (let i = 0; i < 6; i++) setTimeout(() => { if (run && !run.over) { animFx('f_fireball_hit_', 5, b.x + frand(-60, 60), b.y + frand(-60, 60), 3.5); sfx.boom(); } }, i * 150);
  addItem('chest', b.x, b.y, 'boss');
  run.shake = 18; run.haz.length = 0;
  banner(b.name + ' besiegt!', '');
  if (run.st.endless) { run.loop++; addEvents(run.loop); }
  else run.clearT = 3;
}
// src: contact | proj | bomb | strike | zone (für Statistik und Sim)
export function damagePlayer(d, src = 'contact') {
  if (P.inv > 0 || P.dashT > 0 || run.over) return;
  d = shieldAbsorb(hitDamage(d, P.maxHp, src) * P.armorMult * (P.mechT > 0 ? .3 : 1));
  if (d <= 0) { P.inv = .5; return; }
  P.hp -= d; P.inv = .5; P.hitT = .25; run.hurtT = .25; run.shake = Math.max(run.shake, 6);
  addNum(P.x, P.y - 40, Math.round(d), '#ff5d55', false);
  sfx.hurt();
  emit('playerHurt', { amount: d, src: run.boss ? 'boss' : src });
  if (P.hp <= 0 && !tryRevive()) { P.hp = 0; endRun(false); }
}
