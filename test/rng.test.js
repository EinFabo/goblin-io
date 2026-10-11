import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed, mulberry32, rand, seedRun } from '../src/core/rng.js';

test('gleicher Seed → gleiche Folge', () => {
  const a = mulberry32(123), b = mulberry32(123);
  for (let i = 0; i < 1000; i++) assert.equal(a(), b());
});

test('Werte liegen in [0, 1) und sind grob gleichverteilt', () => {
  const r = mulberry32(hashSeed('test')), bins = new Array(10).fill(0), N = 100000;
  for (let i = 0; i < N; i++) { const x = r(); assert.ok(x >= 0 && x < 1); bins[Math.floor(x * 10)]++; }
  for (const b of bins) assert.ok(Math.abs(b - N / 10) < N / 10 * 0.05, `Fach mit ${b}`);
});

test('Streams sind unabhängig: Loot-Würfe verschieben keine Spawns', () => {
  seedRun(7); const spawnA = [RNG.spawn.next(), RNG.spawn.next()];
  seedRun(7); RNG.loot.next(); RNG.loot.next(); rand(0, 1); const spawnB = [RNG.spawn.next(), RNG.spawn.next()];
  assert.deepEqual(spawnA, spawnB);
});
