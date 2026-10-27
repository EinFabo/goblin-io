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
  st.lv = 30; st.pts = { pow: 5, cd: 5, area: 3, s1: 3, a: 1, s2: 3 };
  assert.ok(!canLearn({ ...st, pts: { pow: 5, cd: 3 } }, 'b'), 'Reihe 3 braucht 9 Punkte darunter');
  assert.ok(canLearn({ ...st, pts: { pow: 5, cd: 4 } }, 'b'));
  assert.ok(!canLearn({ ...st, pts: { pow: 5, cd: 5, area: 3, s1: 1 } }, 'm') && canLearn({ ...st, pts: { pow: 5, cd: 5, area: 3, s1: 2 } }, 'm'), 'Meister ab 15 Punkten darunter');
  st.pts = { pow: 5, cd: 5, area: 3, s1: 3, a: 1, s2: 3, s3: 3, b: 1, m: 1 };
  assert.equal(spentPoints(st.pts), 29, 'voll ausgebaut = Level 30');
  const m = abilMods(st);
  assert.ok(Math.abs(m.pow - 1.4) < 1e-9 && Math.abs(m.spd - .75) < 1e-9 && Math.abs(m.area - 1.24) < 1e-9 && m.a && m.b && m.m && m.s1 === 3 && m.s3 === 3);
  for (const id of ids) assert.ok(xpPerUse(id) >= 2, id);
});

test('jeder Baum hat Texte für alle Knoten', async () => {
  const { TREE, TREE_IDS, nodeInfo } = await import('../src/data/abilities.js');
  for (const id of TREE_IDS) for (const k of Object.keys(TREE)) { const n = nodeInfo(id, k); assert.ok(n.name && n.desc && n.max && n.cost, id + '.' + k); }
});

test('alter Baum (v1) mit Extra B ab 6 Punkten wird zurückgesetzt, gültiger bleibt', () => {
  assert.deepEqual(normalize({ abilities: { rage: { lv: 18, pts: { pow: 5, cd: 1, a: 1, b: 1 } } } }).abilities.rage.pts, {});
  assert.deepEqual(normalize({ abilities: { rage: { lv: 18, pts: { pow: 5, cd: 2, a: 1, b: 1 } } } }).abilities.rage.pts, { pow: 5, cd: 2, a: 1, b: 1 });
  assert.equal(normalize({ abilities: { dash: { lv: 4, pts: { pow: 3 } } } }).abilities.dash.lv, 4, 'Rolle wird gespeichert');
});

test('Rauchbombe: Angriffs-Malus 45 % ohne Punkte, „Ruhige Hand“ senkt ihn bis 15 %', async () => {
  const { smokeAtkSlow, abilMods } = await import('../src/data/abilities.js');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  assert.ok(near(smokeAtkSlow(abilMods({ pts: {} }).s1), .45));
  assert.ok(near(smokeAtkSlow(abilMods(undefined).s1), .45), 'ohne Spielstand');
  assert.ok(near(smokeAtkSlow(abilMods({ pts: { pow: 5, cd: 5, area: 3 } }).s1), .45), 'Wurzeln senken ihn nicht mehr');
  assert.ok(near(smokeAtkSlow(abilMods({ pts: { pow: 3, s1: 3 } }).s1), .15));
});

test('Fähigkeiten-Stand im Spielstand wird repariert', () => {
  const s = normalize({ abilities: { trap: { lv: 5, xp: 30, pts: { pow: 2, cd: 2 } }, gibtsnicht: { lv: 3 }, rage: { lv: 2, pts: { pow: 5 } }, mech: 'kaputt' } });
  assert.deepEqual(s.abilities.trap, { lv: 5, xp: 30, pts: { pow: 2, cd: 2 } });
  assert.equal(s.abilities.gibtsnicht, undefined);
  assert.deepEqual(s.abilities.rage.pts, {}, 'mehr Punkte als Level → zurückgesetzt');
  assert.deepEqual(s.abilities.mech, { lv: 1, xp: 0, pts: {} });
});
