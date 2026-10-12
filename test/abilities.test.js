import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, ABILITY_IDS, CHARGE_TXT, abilityUnlocked } from '../src/data/abilities.js';
import { accountXp, accountXpNeed } from '../src/game/balance.js';
import { defaults, normalize } from '../src/core/save.js';

test('Freischaltung nach Konto-Level und Stage-Siegen', () => {
  const none = () => false, upTo = n => i => i < n;
  assert.ok(abilityUnlocked('rage', 1, none));
  assert.ok(abilityUnlocked('trap', 1, none));
  assert.ok(!abilityUnlocked('mech', 2, none));
  assert.ok(abilityUnlocked('mech', 3, none));
  assert.ok(!abilityUnlocked('smoke', 50, none));
  assert.ok(abilityUnlocked('smoke', 1, upTo(1)));
  assert.ok(!abilityUnlocked('shield', 1, upTo(2)));
  assert.ok(abilityUnlocked('shield', 1, upTo(3)));
});

test('jede Fähigkeit hat Name, Kurzname, Aufladung und Text', () => {
  for (const id of ABILITY_IDS) {
    const A = ABILITIES[id];
    assert.ok(A.name && A.short && A.desc && A.need > 0, id);
    assert.ok(CHARGE_TXT[A.charge], id + ': Aufladeart ' + A.charge);
  }
});

test('Ausrüstung im Spielstand wird repariert', () => {
  assert.deepEqual(defaults().loadout, ['rage', 'trap']);
  assert.deepEqual(normalize({ loadout: ['gibtsnicht', 'mech', 'rage'] }).loadout, [null, 'mech']);
  assert.deepEqual(normalize({ loadout: ['rage', 'rage'] }).loadout, ['rage', null]);
  assert.deepEqual(normalize({ loadout: 'kaputt' }).loadout, ['rage', 'trap']);
  assert.deepEqual(normalize({}).loadout, ['rage', 'trap']);
});

test('Konto-XP nach 14.3', () => {
  assert.equal(accountXp({ kills: 300, seconds: 240, win: true, firstClear: true }), 390);
  assert.equal(accountXp({ kills: 55, seconds: 61, win: false, firstClear: false }), 20);
  assert.equal(accountXpNeed(1), 268);
  for (let l = 2; l < 50; l++) assert.ok(accountXpNeed(l) > accountXpNeed(l - 1));
});
