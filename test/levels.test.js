import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENDLESS, LEVELS, LEVEL_LEN, BOSS_AT, WORLDS, levelStage, nextLevel } from '../src/data/levels.js';
import { ETYPES } from '../src/data/enemies.js';

for (const si of WORLDS) for (let li = 0; li < LEVELS; li++) test(`Level ${si + 1}-${li + 1}: gültiges Wellen-Skript`, () => {
  const st = levelStage(si, li), boss = li === LEVELS - 1;
  for (const w of st.waves) {
    if (w.mix) for (const k in w.mix) assert.ok(ETYPES[k], `unbekannter Gegner ${k}`);
    for (const k of [w.type, w.extra]) if (k) assert.ok(ETYPES[k], `unbekannter Gegner ${k}`);
    if (w.event === 'swarm') assert.ok(Number.isFinite(w.count) && w.count > 0, 'Schwarm ohne Größe');
  }
  const end = st.waves.find(w => w.event === (boss ? 'boss' : 'clear'));
  assert.equal(end.at, boss ? BOSS_AT : LEVEL_LEN);
  assert.equal(st.waves.some(w => w.event === 'miniboss'), li === 3, 'Mini-Boss nur in Level 4');
  for (const w of st.waves) if (w.mix) assert.ok(w.at + w.dur <= end.at, 'Spawns laufen über das Ende hinaus');
});

test('Reihenfolge: Level → Boss → nächste Welt → Endlos', () => {
  assert.deepEqual(nextLevel(0, 0), { si: 0, li: 1 });
  assert.deepEqual(nextLevel(0, LEVELS - 1), { si: 1, li: 0 });
  assert.deepEqual(nextLevel(WORLDS.at(-1), LEVELS - 1), { si: ENDLESS, li: 0 });
  assert.equal(nextLevel(ENDLESS, 0), null);
});
