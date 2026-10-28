import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NM_MAX, nmAffix, nmCap, nmChestSteps, nmDmg, nmHp, nmMinis, nmRageAt } from '../src/data/nightmare.js';
import { victoryChest } from '../src/data/cards.js';

test('Albtraum-Stufen: Werte wie im Plan', () => {
  assert.equal(nmHp(0), 1); assert.equal(nmHp(1), 1.8); assert.equal(nmHp(10), 1.8 + .25 * 9);
  assert.equal(nmDmg(1), 1); assert.ok(Math.abs(nmDmg(5) - 1.4) < 1e-9);
  assert.equal(nmAffix(3), 0); assert.equal(nmAffix(4), 1);
  assert.equal(nmMinis(6), 1); assert.equal(nmMinis(7), 2);
  assert.equal(nmRageAt(8, 180), 180); assert.equal(nmRageAt(9, 180), 120);
  assert.deepEqual([0, 1, 3, 6, 9].map(nmChestSteps), [0, 1, 2, 3, 4]);
  assert.equal(nmCap(0), 1); assert.equal(nmCap(4), 5); assert.equal(nmCap(NM_MAX), NM_MAX);
});
test('Siegtruhe: je Albtraum-Stufe besser, höchstens Magiertruhe', () => {
  assert.equal(victoryChest(0, 0), 'wood'); assert.equal(victoryChest(0, true), 'iron'); assert.equal(victoryChest(0, 1), 'iron');
  assert.equal(victoryChest(0, 3), 'gold'); assert.equal(victoryChest(5, 1), 'mage'); assert.equal(victoryChest(0, 10), 'mage');
});
