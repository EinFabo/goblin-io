import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DMG_CAP, LEVEL_CURVE, STAGE_HP, hitDamage, hpTime, targetLevel, xpCatchUp, xpNeed } from '../src/game/balance.js';

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
