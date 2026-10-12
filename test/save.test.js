import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, migrate, migrateV1, migrateV2, normalize, VERSION } from '../src/core/save.js';
import { oldShopCost } from '../src/data/talents.js';

const V1 = { gold: 812, unlocked: 3, cleared: { 0: true, 1: true }, best: { 0: 251, 1: 244, 2: 130 }, shop: { atk: 4, hp: 3, reroll: 1 }, mute: true, musicOff: false };

test('v1 → v3 übernimmt Gold, Stages, Bestzeiten, Werkstatt (als Talente ×2) und Ton', () => {
  const s = migrate(V1);
  assert.equal(s.version, VERSION);
  assert.equal(s.wallet.gold, 812);
  assert.deepEqual(s.stages[1], { cleared: true, stars: 0, best: 251, nightmare: false });
  assert.deepEqual(s.stages[2], { cleared: true, stars: 0, best: 244, nightmare: false });
  assert.deepEqual(s.stages[3], { cleared: false, stars: 0, best: 130, nightmare: false });
  assert.deepEqual(s.talents, { atk: 8, hp: 6, reroll: 1 });
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

test('v2 → v3: Werkstatt ×2, Zündschnur und Ingenieur werden erstattet', () => {
  const v2 = { version: 2, wallet: { gold: 100, gems: 0 }, talents: { atk: 4, spd: 2, ult: 2, mech: 1, reroll: 1 }, stages: { 1: { cleared: true } } };
  const s = migrate(v2);
  assert.equal(s.version, 3);
  assert.deepEqual(s.talents, { atk: 8, spd: 4, reroll: 1 });
  assert.equal(s.wallet.gold, 100 + oldShopCost(80, 0) + oldShopCost(80, 1) + oldShopCost(90, 0));
  assert.equal(s.stages[1].cleared, true);
  // Ein zweites Laden verdoppelt nicht noch einmal
  assert.deepEqual(migrate(s).talents, s.talents);
  assert.equal(migrateV2({}).version, 3);
});

test('Talente über dem Maximum werden gekappt, unbekannte entfernt', () => {
  const s = normalize({ version: 3, talents: { atk: 99, reroll: 7, ult: 3 } });
  assert.deepEqual(s.talents, { atk: 20, reroll: 3 });
});

test('Statistiken und Karussell-Stage: alte Stände bekommen Standardwerte, Unsinn wird verworfen', () => {
  const s = migrate({ version: 3, stages: { 1: { cleared: true }, 2: { cleared: true } }, stats: { runs: 5, weapons: { dagger: 4, nix: 9, orbit: 'x' } } });
  assert.equal(s.lastStage, 2);   // höchste freie Stage
  assert.equal(s.stats.bestKills, 0);
  assert.deepEqual(s.stats.weapons, { dagger: 4 });
  assert.equal(migrate({ version: 3, lastStage: 0, stages: { 1: { cleared: true } } }).lastStage, 0);   // gewählte Stage bleibt
});
