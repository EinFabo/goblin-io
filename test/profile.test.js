import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanProfile } from '../src/game/profile-clean.js';

test('cleanProfile: Unsinn wird zur gültigen Form, gleiche Eingabe → gleiches Ergebnis', () => {
  for (const bad of [null, 5, 'x', [], { name: 7, cls: 'drache', clsLv: 1e9, talents: { atk: 'viel', hp: -3 }, loadout: ['rage', 'gibtsnicht', 'mech'], abilities: { rage: { lv: 99, pts: { pow: 'a' } }, fake: {} }, cards: { dagger: 99 }, owned: ['dagger', 3] }]) {
    const p = cleanProfile(bad);
    assert.equal(typeof p.name, 'string'); assert.ok(['gob', 'bow', 'mage', 'war'].includes(p.cls));
    assert.equal(p.loadout.length, 2); assert.ok(p.clsLv >= 1 && p.clsLv <= 30);
    assert.ok(Object.values(p.talents).every(Number.isFinite));
    assert.deepEqual(cleanProfile(bad), p);
    assert.deepEqual(cleanProfile(JSON.parse(JSON.stringify(p))), p);
  }
  const p = cleanProfile({ loadout: ['rage', 'gibtsnicht'], equip: [true, true], abilities: { rage: { lv: 99 } }, cards: { dagger: 99 } });
  assert.deepEqual(p.loadout, ['rage', null]); assert.deepEqual(p.equip, [true, false]);
  assert.equal(p.abilities.rage.lv, 30); assert.equal(p.cards.dagger, 10);
});
