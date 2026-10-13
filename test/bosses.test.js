import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, BOSSES, BOSS_IDS, PHASE_AT, bossVariant } from '../src/data/bosses.js';
import { STAGES } from '../src/data/stages.js';
import { BOSS_LOOKS, SCHOOLS, mageSvg } from '../src/gen/mages.js';

test('Jeder Boss hat 3 Phasen mit bekannten Angriffen', () => {
  assert.deepEqual(PHASE_AT, [1, .66, .33]);
  for (const id of BOSS_IDS) {
    const B = BOSSES[id];
    assert.equal(B.phases.length, 3, id);
    assert.ok(B.name && B.title && B.col && SCHOOLS[B.school], id);
    for (const ph of B.phases) {
      assert.ok(ph.atk.length >= 3 && ph.gap > 0, id);
      for (const a of ph.atk) assert.ok(ATTACKS.includes(a), `${id}: ${a}`);
    }
  }
});

test('Stages zeigen auf Bosse, eigene Modelle lassen sich zeichnen', () => {
  for (const st of STAGES) assert.ok(st.boss.id === 'random' || BOSSES[st.boss.id], st.name);
  for (const id of BOSS_IDS) {
    const B = BOSSES[id];
    if (!B.look) { assert.equal(bossVariant(id), B.school + '.m'); continue; }
    assert.ok(BOSS_LOOKS[B.look], id);
    assert.equal(bossVariant(id), `${B.school}.${B.look}`);
    for (const dir of ['down', 'left', 'up', 'right']) assert.match(mageSvg(B.school, dir, 'cast', 5, { boss: B.look }), /^<svg/);
  }
});
