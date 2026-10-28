import { RNG, rnd, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { $ } from '../core/util.js';
import { chargeAbil, critBonus, dealtMult, inProc, onKill, runeHit, shieldAbsorb, takenMult, tryRevive } from './abilities.js';
import { hitDamage, endlessCap } from './balance.js';
import { bomberBoom, damageRules, deathRules } from './enemies.js';
import { bodyOf, bossHurt, bossOnKill, shadeDown } from './boss.js';
import { clearBossWorld } from './boss-mech.js';
import { addItem, addNum, animFx, dissolve, dropGem, later, puff } from './fx.js';
import { addEvents } from './run.js';
import { P, abSrc, aoeId, heal, isBig, run } from './state.js';
import { banner } from '../ui/hud.js';
import { endRun, offerContinue, startClear } from './run.js';
import { count } from './progress.js';
import { ETYPES } from '../data/enemies.js';

// ---------- Schaden ----------
// xpMul: tötet dieser Treffer, gibt der Gegner so viel mehr Erfahrung (Kristallregen)
export function hurt(e, dmg, kb = 0, kx = 0, ky = 0, col = null, xpMul = 1) {
  if (e.dead || e.spawnT > 0) return;   // im Portal noch nicht angreifbar
  const raw = dmg;   // vor Krit, Hinterhalt & Co.: Grundlage für Brand, Gift und Runen-Blitz (die laufen wieder durch hurt)
  const crit = !inProc() && rnd() < P.crit + critBonus();   // Brand, Gift, Runen-Blitz: nie kritisch
  if (e.tbShock && e.freezeT > 0) dmg *= 1.5;   // Zeitbombe: Kälteschock
  dmg *= dealtMult(e);
  if (P.bigMult > 1 && isBig(e)) dmg *= P.bigMult;   // Knochenschädel
  const rule = damageRules(e, dmg * (crit ? 2 : 1) * rand(.9, 1.1), kx, ky);
  const d = Math.max(rule.dmg > 0 ? 1 : 0, Math.round(rule.dmg));
  // Teile von Morgra teilen sich das Leben des Bosses. Ein Treffer-Ereignis (Explosion, Zone, Geschoss = ein query),
  // das mehrere ihrer Körper erwischt, zählt nur einmal (sonst ×3 auf das gemeinsame Leben)
  const tgt = e.link || e;
  if (tgt.split && aoeId) {
    if (tgt.aoeId === aoeId) return;
    tgt.aoeId = aoeId;
  }
  const hpBefore = tgt.hp;
  tgt.hp -= d; e.flash = .09;
  if (P.leech && d > 0 && P.hp > 0) leech(Math.min(d, Math.max(0, hpBefore)));
  if (e.tb !== undefined && e.freezeT > 0) e.tb += d;   // Zeitbombe sammelt Schaden
  if (kb && !e.boss && !rule.blocked) { const m = e.elite ? .25 : e.traits && e.traits.includes('heavy') ? .2 : 1; e.kx += kx * kb * m; e.ky += ky * kb * m; }
  if (d > 0) addNum(e.x, e.y - 22 * e.sc, d, crit ? '#ffd84a' : col || '#ffffff', crit, true);
  else if (rule.blocked) addNum(e.x, e.y - 22 * e.sc, 'Block', '#dff6ff', false);
  sfx.hit();
  if (tgt.boss) bossHurt(tgt);
  if (tgt.hp <= 0) kill(tgt, xpMul);
  if (abSrc && d > 0) runeHit(e, raw);   // Runen der Fähigkeit, die getroffen hat (Phase 10)
}
// Vampirzahn: Lebensraub ohne Overkill, höchstens 3 % des Lebens pro Sekunde (Flächen-Treffer zählen sonst vielfach)
function leech(d) {
  const sec = Math.floor(run.time);
  if (run.leechSec !== sec) { run.leechSec = sec; run.leechGot = 0; }
  const h = Math.min(d * P.leech, P.maxHp * .03 - run.leechGot);
  if (h > 0) { run.leechGot += h; heal(h); }
}
export function kill(e, xpMul = 1) {
  if (e.link || e.decoy) return;   // Teile von Morgra und Spiegelbilder sterben nur mit ihrem Boss (bossDown)
  e.dead = true; run.kills++;
  emit('enemyKilled', e);
  if (!e.boss) { chargeAbil('kills', 1); chargeAbil('scrap', .35); }
  onKill(e);
  count(run, e === run.boss ? 'bosses' : e.miniboss ? 'minis' : e.elite || e.shade ? 'elites' : null);
  // je Schule nur echte Magier (keine Diener, Klone, Portale oder Knochenhaufen)
  const T = ETYPES[e.type];
  if (T && !T.sprite && !e.clone && !e.obj) count(run, 'k.' + T.school);
  // Phase 11: Kopfgeld (Elite mit Eigenschaft) und Fähigkeiten-Quests (Kills durch die Fähigkeit oder ihre Helfer)
  if (e.affixes && e.elite && !e.miniboss) for (const a of e.affixes) count(run, 'af.' + a);
  if (abSrc) count(run, 'ab.' + abSrc + '.kills');
  dropGem(e.x, e.y, e.xp * xpMul);
  dissolve(e);
  if (e.elite || e.miniboss) run.hitstop = Math.max(run.hitstop, .04);
  if (e.boss) run.hitstop = Math.max(run.hitstop, .08);
  sfx.kill();
  if (e.bomber && !e.boomed) bomberBoom(e, false);
  deathRules(e);
  const ck = P.brew && P.brew.gold > 0 ? 3 : 1;   // Goldtrank (Hexenkessel): dreifache Münzen
  if (e.miniboss) { for (let i = 0; i < 12 * ck; i++) addItem('coin', e.x, e.y); for (let i = 0; i < 3; i++) addItem('gear', e.x, e.y); addItem('chest', e.x, e.y, 'mini'); healPity(e); }
  else if (e.elite) { for (let i = 0; i < 8 * ck; i++) addItem('coin', e.x, e.y); for (let i = 0; i < 3; i++) addItem('gear', e.x, e.y); addItem('chest', e.x, e.y, 'elite'); healPity(e); }
  else if (!e.boss) {
    const r = RNG.loot.next();
    if (r < .05) for (let i = 0; i < ck; i++) addItem('coin', e.x, e.y);
    else if (r < .1) addItem('gear', e.x, e.y);
    const r2 = RNG.loot.next();
    if (r2 < .006) addItem('heal', e.x, e.y); else if (r2 < .009) addItem('magnet', e.x, e.y); else if (r2 < .0115) addItem('bomb', e.x, e.y);
  }
  bossOnKill(e);
  if (e === run.boss) bossDown(e);
  else if (e.shade) shadeDown(e);
}
// Heilungs-Pity (7.5): wer 20 s unter 30 % Leben war, bekommt vom nächsten Elite/Mini-Boss garantiert ein Herz
export const LOW_HP = .3, LOW_T = 20;
function healPity(e) { if (run.lowT >= LOW_T) { run.lowT = 0; addItem('heal', e.x, e.y); } }
export function bossDown(b) {
  run.boss = null; run.arena = null; emit('bossDown', b);
  // Teile und Seelengefäße gehen mit
  for (const e of run.enemies) if (bodyOf(e, b) && !e.dead) { e.dead = true; puff(e.x, e.y, e.sc); }
  clearBossWorld();
  $('#bossBar').hidden = true;
  for (let i = 0; i < 25; i++) addItem('coin', b.x, b.y);
  for (let i = 0; i < 6; i++) later(i * .15, () => { animFx('f_fireball_hit_', 5, b.x + frand(-60, 60), b.y + frand(-60, 60), 3.5); sfx.boom(); });
  addItem('chest', b.x, b.y, 'boss');
  run.shake = 18; run.haz.length = 0;
  banner(b.name + ' besiegt!', '');
  if (run.st.endless) { run.loop++; addEvents(run.loop); }
  else startClear(3);
}
// src: contact | proj | bomb | strike | zone (für Statistik und Sim)
// by: wer getroffen hat (Racheblick des Goblin-Grolls)
export function damagePlayer(d, src = 'contact', by = null) {
  if (P.inv > 0 || P.dashT > 0 || run.over || run.clearT > 0) return;
  // Schattenmantel: ausweichen
  if (P.dodge && rnd() < P.dodge) { P.inv = .3; addNum(P.x, P.y - 40, 'Ausgewichen', '#d9c8ff', false); return; }
  d = hitDamage(d, P.maxHp, src, run.st.endless ? endlessCap(run.time) : 1) * P.armorMult * (P.mechT > 0 ? P.mechArmor : 1) * takenMult();
  if (P.flatArmor) d = Math.max(d * .4, d - P.flatArmor);   // Eisenhelm, nie unter 40 %
  d = shieldAbsorb(d);
  if (d <= 0) { P.inv = .5; return; }
  P.hp -= d; P.inv = .5; P.hitT = .25; run.hurtT = .25; run.shake = Math.max(run.shake, 6);
  if (run.boss && !run.boss.dead) run.bossHits = (run.bossHits || 0) + 1;   // Kopfgeld „ohne Treffer im Bosskampf“
  chargeAbil('hurt', d / P.maxHp * 100);   // Goblin-Groll lädt mit eingestecktem Schaden
  if (by && !by.dead) run.foe = by;        // Racheblick: wer zuletzt traf
  addNum(P.x, P.y - 40, Math.round(d), '#ff5d55', false);
  sfx.hurt();
  emit('playerHurt', { amount: d, src: run.boss ? 'boss.' + src : src });   // im Bosskampf mit Vorsilbe (Sim: Schaden je Boss-Angriff)
  if (P.hp <= 0 && !tryRevive()) { P.hp = 0; if (!offerContinue()) endRun(false); }
}
