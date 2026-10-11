import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, migrate, migrateV1, normalize, VERSION } from '../src/core/save.js';

const V1 = { gold: 812, unlocked: 3, cleared: { 0: true, 1: true }, best: { 0: 251, 1: 244, 2: 130 }, shop: { atk: 4, hp: 3, reroll: 1 }, mute: true, musicOff: false };

test('v1 → v2 übernimmt Gold, Stages, Bestzeiten, Werkstatt und Ton', () => {
  const s = migrate(V1);
  assert.equal(s.version, VERSION);
  assert.equal(s.wallet.gold, 812);
  assert.deepEqual(s.stages[1], { cleared: true, stars: 0, best: 251, nightmare: false });
  assert.deepEqual(s.stages[2], { cleared: true, stars: 0, best: 244, nightmare: false });
  assert.deepEqual(s.stages[3], { cleared: false, stars: 0, best: 130, nightmare: false });
  assert.deepEqual(s.talents, { atk: 4, hp: 3, reroll: 1 });
  assert.equal(s.settings.mute, true);
  assert.equal(s.settings.musicOff, false);
});

test('v1: "unlocked" ohne passendes "cleared" geht nicht verloren', () => {
  const s = migrateV1({ unlocked: 3 });
  assert.equal(s.stages[1].cleared, true);
  assert.equal(s.stages[2].cleared, true);
  assert.equal(s.stages[3], undefined);
});

test('leerer v1-Stand ergibt Standardwerte', () => {
  const s = migrate({});
  const d = defaults();
  assert.deepEqual({ ...s, profile: { ...s.profile, created: '' } }, { ...d, profile: { ...d.profile, created: '' } });
});

test('kaputte Werte werden repariert statt zu crashen', () => {
  for (const raw of [null, 42, 'kaputt', [], { version: 2, wallet: 'x', stages: { 1: null, abc: {}, '-1': {} }, talents: { atk: -5, hp: 'viel' }, settings: { mute: 'ja' } }]) {
    const s = migrate(raw);
    assert.equal(s.version, VERSION);
    assert.equal(typeof s.wallet.gold, 'number');
    assert.ok(Object.keys(s.stages).every(k => /^\d+$/.test(k) && +k >= 1));
    assert.ok(Object.values(s.talents).every(v => Number.isInteger(v) && v >= 0));
    assert.equal(typeof s.settings.mute, 'boolean');
  }
  const s = migrate({ version: 2, wallet: { gold: Infinity, gems: -3 }, profile: { name: '   ', level: 999 } });
  assert.equal(s.wallet.gold, 0);
  assert.equal(s.wallet.gems, 0);
  assert.equal(s.profile.name, 'Goblin');
  assert.equal(s.profile.level, 50);
});

test('normalize ist idempotent', () => {
  const once = normalize(migrate(V1));
  assert.deepEqual(normalize(once), once);
});
