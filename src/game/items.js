import { frand } from '../core/rng.js';
import { sfx, tickGemCombo } from '../core/audio.js';
import { $, TAU, restart } from '../core/util.js';
import { xpCatchUp } from './balance.js';
import { autoChest, autoUp } from './levelup.js';
import { fuseMega, megaReady } from './mega.js';
import { chargeAbil, xpBonus } from './abilities.js';
import { hurt } from './combat.js';
import { addNum, part, ring } from './fx.js';
import { P, activate, aoeScope, eachPlayer, heal, nearestGob, onScreen, pR, run, xpNeed } from './state.js';
import { GEM_COL } from '../render/proc.js';

export const gemTier = v => v >= 100 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0;
export function updItems(dt) {
  const pi = run.pi;
  tickGemCombo(dt);
  for (const it of run.items) {
    it.t += dt;
    if (it.z > 0) {
      it.vz -= 900 * dt; it.z += it.vz * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      if (it.z <= 0) { it.z = 0; it.vz = 0; }
      continue;
    }
    // Koop: zum Goblin, der es angezogen hat, sonst zum nächsten stehenden (jeder mit eigenem Magnet)
    const gi = it.to !== undefined && !run.players[it.to].down ? it.to : nearestGob(it.x, it.y), g = run.players[gi];
    const dx = g.x - it.x, dy = g.y - 6 - it.y, d = Math.hypot(dx, dy) || 1;
    if (!it.mag && pullable(it) && d < g.magnet * (g.sprinting ? g.sprintMag : 1)) it.mag = true;
    if (it.mag) {
      it.to = gi;
      it.sp = Math.min(1300, it.sp + 1500 * dt);
      const s = Math.min(d, it.sp * dt); it.x += dx / d * s; it.y += dy / d * s;
      if (it.k === 'gem' && Math.random() < .5) part(it.x, it.y, 0, 0, .18, GEM_COL[gemTier(it.v)][0], 3);
    }
    if (d < pR(g) + 12) { activate(gi); collect(it); activate(pi); }
  }
  run.items = run.items.filter(i => !i.got);
  run.gemN = 0; for (const i of run.items) if (i.k === 'gem') run.gemN++;
}
// Was Magnet, Totem und Levelende anziehen: Kristalle, Münzen, Zahnräder
export const pullable = it => it.k === 'gem' || it.k === 'coin' || it.k === 'gear';
export function pullAll() { for (const it of run.items) if (pullable(it)) it.mag = true; }
export let xpPulseT = 0;
export function collect(it) {
  it.got = true;
  switch (it.k) {
    case 'gem': {
      addXp(it.v); sfx.gem();
      const col = GEM_COL[gemTier(it.v)][0];
      for (let i = 0; i < 5; i++) { const a = Math.random() * TAU; part(P.x + Math.cos(a) * 8, P.y - 10 + Math.sin(a) * 8, Math.cos(a) * 110, Math.sin(a) * 110 - 30, .3, col, 2.6); }
      if (performance.now() - xpPulseT > 110) { xpPulseT = performance.now(); restart($('#xpBar'), 'pulse'); }
      break;
    }
    case 'coin': {
      // Goblinbeutel: Bruchteile sammeln sich zu ganzen Münzen
      run.goldFrac = (run.goldFrac || 0) + (run.goldT > 0 ? 2 : 1) * (P.goldMult || 1);
      const g = Math.floor(run.goldFrac); run.gold += g; run.goldFrac -= g; sfx.coin(); break;
    }
    case 'gear':
      chargeAbil('scrap', 7); sfx.gear();
      for (let i = 0; i < 4; i++) part(P.x, P.y - 10, frand(-90, 90), frand(-120, -20), .3, '#c9d1d8', 2.5);
      break;
    case 'heal': heal(35); addNum(P.x, P.y - 40, '+35', '#7dff7a'); sfx.heal(); break;
    case 'magnet': pullAll(); sfx.heal(); ring(P.x, P.y, 10, 300, .5, 'rgba(110,220,255,.8)', 6); break;
    case 'bomb':
      aoeScope(() => { for (const e of run.enemies) if (!e.dead && onScreen(e.x, e.y)) hurt(e, e.boss ? 300 : 9999); });
      run.flashT = .3; run.shake = 14; sfx.boom(); sfx.ult(); break;
    // Truhen mit festem Inhalt (7.5): Mini-Boss = Wahl aus 3, Elite = 1 Aufwertung, Boss = 3 Aufwertungen
    case 'chest': {
      let mega;
      // nach dem Ende: Truhe wird zu Bonus-Leveln (Boss 3, Mini 2, Elite 1)
      if (run.clearT > 0) { for (let i = it.v === 'boss' ? 3 : it.v === 'elite' ? 1 : 2; i > 0; i--) bonusLevel(); sfx.chest(); }
      // Mega-Truhe: hat man zwei passende Entwicklungen, verschmelzen sie (Elite, Mini-Boss, Boss)
      else if ((it.v === 'elite' || it.v === 'boss' || it.v === 'mini') && (mega = megaReady())) { fuseMega(mega); if (it.v === 'boss') autoChest(2, 'boss'); }
      else if (it.v === 'elite' || it.v === 'boss') autoChest(it.v === 'boss' ? 3 : 1, it.v);
      else { run.pendingChest++; if (run.coop) (run.chestBy = run.chestBy || []).push(run.pi); }   // Koop: wählen darf, wer sie aufhob
      break;
    }
  }
}
// Koop: eine gemeinsame Leiste – wer sammelt, zählt mit seinem XP-Bonus, Level und XP gelten danach für beide
export function addXp(v) {
  P.xp += v * P.xpMult * xpBonus() * xpCatchUp(run.time, P.lv);
  while (P.xp >= P.need) {
    P.xp -= P.need; P.lv++; P.need = xpNeed(P.lv);
    for (const p of run.players) if (p !== P) { p.lv = P.lv; p.need = P.need; }
    if (run.clearT > 0) bonusLevel(); else { run.pendingLv++; eachPlayer(() => autoUp()); }
  }
  for (const p of run.players) if (p !== P) p.xp = P.xp;
}
// Bonus-Level nach „Level geschafft“: „+1“ über dem Goblin, Ton steigt mit jedem weiteren
function bonusLevel() {
  run.bonusLv++;
  addNum(P.x, P.y - 52 - Math.min(run.bonusLv, 6) * 4, 'Bonus +' + run.bonusLv, '#ffd84a', true);
  ring(P.x, P.y, 10, 90, .35, 'rgba(255,216,74,.9)', 5);
  sfx.bonusLv(run.bonusLv);
}
