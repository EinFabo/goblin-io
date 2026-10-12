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

test('Skill Tree: Punkte, Maximum, Voraussetzungen', async () => {
  const { canLearn, spentPoints, abilMods, xpPerUse, ABILITY_IDS: ids } = await import('../src/data/abilities.js');
  const st = { lv: 1, xp: 0, pts: {} };
  assert.ok(!canLearn(st, 'pow'), 'Level 1 hat keine Punkte');
  st.lv = 4; assert.ok(canLearn(st, 'pow'));
  assert.ok(!canLearn(st, 'a'), 'Extra A braucht 3 Punkte unten');
  st.pts = { pow: 3 }; assert.ok(!canLearn(st, 'a'), 'keine Punkte mehr frei');
  st.lv = 6; assert.ok(canLearn(st, 'a'));
  st.pts = { pow: 5 }; assert.ok(!canLearn(st, 'pow'), 'Maximum 5');
  st.lv = 18; st.pts = { pow: 5, cd: 5, area: 3, a: 1, b: 1 };
  assert.equal(spentPoints(st.pts), 17);
  const m = abilMods(st);
  assert.ok(Math.abs(m.pow - 1.4) < 1e-9 && Math.abs(m.spd - .75) < 1e-9 && Math.abs(m.area - 1.24) < 1e-9 && m.a && m.b);
  for (const id of ids) assert.ok(xpPerUse(id) >= 2, id);
});

test('Fähigkeiten-Stand im Spielstand wird repariert', () => {
  const s = normalize({ abilities: { trap: { lv: 5, xp: 30, pts: { pow: 2, cd: 2 } }, gibtsnicht: { lv: 3 }, rage: { lv: 2, pts: { pow: 5 } }, mech: 'kaputt' } });
  assert.deepEqual(s.abilities.trap, { lv: 5, xp: 30, pts: { pow: 2, cd: 2 } });
  assert.equal(s.abilities.gibtsnicht, undefined);
  assert.deepEqual(s.abilities.rage.pts, {}, 'mehr Punkte als Level → zurückgesetzt');
  assert.deepEqual(s.abilities.mech, { lv: 1, xp: 0, pts: {} });
});
