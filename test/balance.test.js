import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DMG_CAP, LEVEL_CURVE, STAGE_HP, hitDamage, hpTime, targetLevel, xpCatchUp, xpNeed, endlessHp, boonHp, endlessCap, endlessDmg } from '../src/game/balance.js';

test('Ziel-Level trifft die Tabelle aus 7.3 und steigt monoton', () => {
  for (const [t, l] of LEVEL_CURVE) assert.equal(targetLevel(t), l);
  let prev = 0;
  for (let t = 0; t <= 600; t += 5) { const l = targetLevel(t); assert.ok(l >= prev, `t=${t}`); prev = l; }
  assert.equal(targetLevel(300), 24);
});

test('XP-Aufholregel', () => {
  assert.equal(xpCatchUp(120, 11), 1);
  assert.equal(xpCatchUp(120, 9), 1.2);
  assert.equal(xpCatchUp(120, 8), 1.35);
  assert.equal(xpCatchUp(120, 14), .85);
});

test('HP-Kurve: Werte aus 7.3 und monoton', () => {
  assert.ok(Math.abs(hpTime(60) - 1.85) < .01);
  assert.ok(Math.abs(hpTime(120) - 2.94) < .01);
  assert.ok(Math.abs(hpTime(240) - 5.9) < .01);
  for (let i = 1; i < STAGE_HP.length; i++) assert.ok(STAGE_HP[i] > STAGE_HP[i - 1]);
  for (let l = 2; l < 60; l++) assert.ok(xpNeed(l) > xpNeed(l - 1));
});

test('Schadensdeckel nach Art', () => {
  assert.equal(hitDamage(50, 100, 'contact'), 100 * DMG_CAP.contact);
  assert.equal(hitDamage(50, 100, 'proj'), 100 * DMG_CAP.proj);
  assert.equal(hitDamage(50, 100, 'zone'), 100 * DMG_CAP.special);
  assert.equal(hitDamage(5, 100, 'contact'), 5);
});

test('Gegner-Leben ist in jeder Welt und in der Endlosen Nacht eine Zahl', async () => {
  const { STAGES } = await import('../src/data/stages.js');
  const { enemyHp, stageHp } = await import('../src/game/balance.js');
  STAGES.forEach((st, si) => { assert.ok(Number.isFinite(enemyHp(10, si, 120)) && stageHp(si) > 0, st.name); });
});

test('angDiff: kürzester Winkelabstand', async () => {
  const { angDiff } = await import('../src/core/util.js');
  assert.ok(Math.abs(angDiff(.1, -.1) - .2) < 1e-9);
  assert.ok(Math.abs(angDiff(Math.PI - .1, -Math.PI + .1) + .2) < 1e-9);
});

test('Bonus-Level: Gold je Level, Kartenpaket ab 4, ein Juwel je 6', async () => {
  const { bonusReward } = await import('../src/game/balance.js');
  assert.deepEqual(bonusReward(0, 0), { gold: 0, cards: 0, gems: 0 });
  assert.deepEqual(bonusReward(3, 0), { gold: 24, cards: 0, gems: 0 });
  assert.deepEqual(bonusReward(6, 7), { gold: 258, cards: 4, gems: 1 });
});

// Endlose Nacht (Wunsch Fabi 2026-10-16): eine glatte Kurve statt Zeit × Runde
test('Endlose Nacht: Leben bis 4:00 wie sonst, danach glatt und ab 13:00 nur noch linear', () => {
  for (const t of [0, 60, 120, 239]) assert.equal(endlessHp(t), hpTime(t));
  assert.ok(Math.abs(endlessHp(240.01) - hpTime(240)) < .01, 'kein Sprung beim ersten Boss');
  for (let t = 0; t < 3600; t += 30) assert.ok(endlessHp(t + 30) > endlessHp(t), 'steigt immer');
  const perMin = t => endlessHp(t + 60) / endlessHp(t);
  assert.ok(Math.abs(perMin(600) - Math.exp(.33)) < 1e-9);
  // ab 13:00 linear: gleicher Zuwachs je Minute, die Rate sinkt also
  const at13 = endlessHp(780), step = m => endlessHp(780 + 60 * (m + 1)) - endlessHp(780 + 60 * m);
  assert.ok(Math.abs(step(5) - step(30)) < 1e-6 && Math.abs(step(0) - .08 * at13) < 1e-6);
  assert.ok(perMin(2400) < perMin(1200) && perMin(1200) < 1.06, 'langsamer als ein Dauerbonus je Minute');
  // nach 20 min weit unter der alten Kurve (×460)
  assert.ok(endlessHp(1200) < 200);
});

test('Endlose Nacht: Dauerboni machen Gegner zäher, der Treffer-Deckel wächst ab 15:00', () => {
  assert.equal(boonHp(0), 1);
  assert.ok(Math.abs(boonHp(10) - 1.025 ** 10) < 1e-12);
  assert.ok(1.06 / boonHp(1) > 1, 'ein Wutzahn bringt netto noch etwas');
  assert.equal(endlessCap(600), 1); assert.equal(endlessCap(900), 1);
  assert.ok(Math.abs(endlessCap(1500) - 2) < 1e-12);
  assert.equal(hitDamage(1000, 100, 'contact', 2), 100 * DMG_CAP.contact * 2);
  // Schaden glatt: kein Sprung, bei 4:00 wie früher in Runde 0
  assert.equal(endlessDmg(240), 1 + 240 / 400);
  for (let t = 0; t < 3000; t += 10) assert.ok(endlessDmg(t + 10) > endlessDmg(t));
});
