import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ETYPES } from '../src/data/enemies.js';
import { STAGES, STAGE_LEN, stageTypes } from '../src/data/stages.js';

const EVENTS = ['elite', 'swarm', 'miniboss', 'warn', 'boss'], SHAPES = ['ring', 'wall', 'stream', 'pincer'];

for (const st of STAGES) test(`Wellen-Skript ${st.name}`, () => {
  for (const t of stageTypes(st)) assert.ok(ETYPES[t], `unbekannter Gegner ${t}`);
  let prevAt = -1, prevEnd = 0, gaps = 0;
  for (const w of st.waves) {
    assert.ok(w.at >= prevAt, `nicht sortiert bei ${w.at}`); prevAt = w.at;
    if (w.mix) {
      assert.ok(w.at >= prevEnd, `Phasen überlappen bei ${w.at}`);
      if (w.at - prevEnd >= 2) gaps++;
      assert.ok(w.rate[0] > 0 && w.rate[1] >= w.rate[0], 'Rate');
      prevEnd = w.at + w.dur;
    } else {
      assert.ok(EVENTS.includes(w.event), w.event);
      if (w.event === 'swarm') assert.ok(SHAPES.includes(w.shape) && w.type && w.count > 0, 'Schwarm');
      if (w.event === 'miniboss') assert.equal(ETYPES[w.type].role, 'master');
    }
  }
  assert.ok(prevEnd >= STAGE_LEN, 'Spawns enden vor dem Boss');
  assert.ok(gaps >= 3, `nur ${gaps} Ruhepausen`);
  assert.equal(st.waves.filter(w => w.event === 'boss').length, 1);
  assert.equal(st.waves.find(w => w.event === 'boss').at, STAGE_LEN);
});
