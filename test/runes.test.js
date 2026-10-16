import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/rng.js';
import { defaults, normalize } from '../src/core/save.js';
import { ABILITY_IDS } from '../src/data/abilities.js';
import { ABIL_TAGS, CHEST_RUNES, RUNES, RUNE_IDS, RUNE_TIERS, parseRune, runeDesc, runeFits } from '../src/data/runes.js';
import { grantChest, rollChest } from '../src/game/chests.js';
import { addRunes, canFuse, fuse, rollRuneBag, rollRunes, runeMods, socket, socketWhy, unsocket } from '../src/game/runes.js';

const fresh = (lv = 25) => { const s = defaults(); s.abilities.trap = { lv, xp: 0, pts: {} }; s.abilities.shield = { lv, xp: 0, pts: {} }; return s; };

test('Runen: Daten vollständig, jede Fähigkeit hat Tags', () => {
  for (const id of RUNE_IDS) {
    assert.equal(RUNES[id].val.length, RUNE_TIERS, id);
    for (let t = 0; t < RUNE_TIERS; t++) assert.ok(runeDesc(`${id}.${t}`).length > 10, id);
    for (let t = 1; t < RUNE_TIERS; t++) assert.ok(RUNES[id].val[t] > RUNES[id].val[t - 1], id + ' steigt');
  }
  for (const id of ABILITY_IDS) assert.ok(Array.isArray(ABIL_TAGS[id]), id);
  assert.equal(parseRune('fire.4'), null); assert.equal(parseRune('fire.01'), null); assert.equal(parseRune('nope.1'), null);
  assert.deepEqual(parseRune('bolt.2'), { id: 'bolt', tier: 2 });
  // Feuer nicht auf den Schild, Wucht passt überall, Eile nicht aufs Amulett
  assert.equal(runeFits('fire', 'shield'), false); assert.equal(runeFits('fire', 'trap'), true);
  assert.equal(runeFits('might', 'shield'), true); assert.equal(runeFits('haste', 'charm'), false);
});

test('Runen: einsetzen, tauschen, ausbauen (kostenlos), Sockel nach Level', () => {
  const s = fresh(15);
  addRunes(s, ['fire.0', 'fire.0', 'might.1', 'bolt.2']);
  assert.ok(socket(s, 'trap', 0, 'fire.0'));
  assert.equal(s.runes.bag['fire.0'], 1);
  assert.match(socketWhy(s, 'trap', 1, 'might.1'), /Level 20/);         // Sockel 2 erst ab Level 20
  assert.ok(socket(s, 'trap', 0, 'bolt.2'));                              // tauschen: Feuer zurück in die Tasche
  assert.equal(s.runes.bag['fire.0'], 2); assert.equal(s.runes.bag['bolt.2'], undefined);
  s.abilities.trap.lv = 20;
  assert.match(socketWhy(s, 'trap', 1, 'bolt.2'), /Nicht in der Tasche/);
  addRunes(s, ['bolt.0']);
  assert.match(socketWhy(s, 'trap', 1, 'bolt.0'), /schon/);               // je Fähigkeit jede Art nur einmal
  assert.ok(socket(s, 'trap', 1, 'might.1'));
  assert.equal(socketWhy(s, 'shield', 0, 'fire.0'), 'Passt nicht zu dieser Fähigkeit');
  assert.deepEqual(runeMods(s, 'trap'), { bolt: RUNES.bolt.val[2], jumps: RUNES.bolt.jumps[2], might: RUNES.might.val[1] });
  assert.ok(unsocket(s, 'trap', 0)); assert.ok(unsocket(s, 'trap', 1));
  assert.equal(s.runes.sock.trap, undefined);
  assert.equal(s.runes.bag['bolt.2'], 1); assert.equal(s.runes.bag['might.1'], 1);
});

test('Runen: 3 gleiche verschmelzen zur nächsten Stufe, legendär nicht weiter', () => {
  const s = fresh();
  addRunes(s, ['echo.0', 'echo.0', 'echo.0', 'echo.0', 'luck.3', 'luck.3', 'luck.3']);
  assert.equal(fuse(s, 'echo.0'), 'echo.1');
  assert.equal(s.runes.bag['echo.0'], 1); assert.equal(s.runes.bag['echo.1'], 1);
  assert.equal(canFuse(s, 'echo.0'), false); assert.equal(fuse(s, 'echo.0'), null);
  assert.equal(canFuse(s, 'luck.3'), false);
});

test('Runen: Spielstand repariert kaputte Daten und gesperrte Sockel', () => {
  const s = normalize({ abilities: { trap: { lv: 12 }, shield: { lv: 30 } },
    runes: { bag: { 'fire.0': 2.7, 'fire.9': 3, 'x.1': 1, 'frost.1': -2, 'wide.2': 'viele' },
      sock: { trap: ['fire.1', 'might.0'], shield: ['fire.2', 'might.3'], rage: ['luck.0', null], nope: ['fire.0', null], spin: 'kaputt' } } });
  // trap: Sockel 2 (Level 20) noch zu → might.0 zurück; shield: Feuer passt nicht → zurück; rage Level 1 → zurück;
  // unbekannte Fähigkeit: Rune geht nicht verloren, sondern zurück in die Tasche
  assert.deepEqual(s.runes.sock, { trap: ['fire.1', null], shield: [null, 'might.3'] });
  assert.deepEqual(s.runes.bag, { 'fire.0': 3, 'might.0': 1, 'fire.2': 1, 'luck.0': 1 });
  assert.deepEqual(normalize(s).runes, s.runes, 'idempotent');
  assert.deepEqual(normalize({}).runes, { bag: {}, sock: {} });
});

test('Runen aus Truhen: Mengen je Truhe, Runenbeutel mit seltener', () => {
  for (const [t, C] of Object.entries(CHEST_RUNES)) {
    let none = 0;
    for (let s = 1; s <= 300; s++) {
      const r = rollRunes(mulberry32(s), t);
      if (!r.length) { none++; continue; }
      assert.ok(r.length >= C.n[1] && r.length <= C.n[2], t + ' ' + r.length);
      for (const k of r) assert.ok(C.odds[parseRune(k).tier] > 0, t + ' ' + k);
    }
    if (C.n[0] >= 1) assert.equal(none, 0, t); else assert.ok(none > 150 && none < 300, t + ' ' + none);
  }
  for (let s = 1; s <= 100; s++) { const r = rollRuneBag(mulberry32(s)); assert.equal(r.length, 3); assert.ok(r.some(k => parseRune(k).tier >= 1)); }
});

test('Truhen: Karten, Gold und Bonus wie vor den Runen; Runen werden gutgeschrieben', () => {
  // Festgehalten mit dem Stand vor den Runen (Runen werden erst nach allem anderen gewürfelt)
  const fp = r => JSON.stringify([r.gold, r.cards.map(c => c.id + c.n), r.bonus]);
  assert.equal(fp(rollChest('wood', mulberry32(3))), '[86,["armor6"],null]');
  assert.equal(fp(rollChest('iron', mulberry32(7))), '[329,["bag3","boomer5","crossbow7","fireball2","gang1"],null]');
  const s = defaults(), res = rollChest('mage', mulberry32(5));
  assert.ok(res.runes.length >= 4);
  grantChest(s, res);
  assert.equal(Object.values(s.runes.bag).reduce((a, b) => a + b, 0), res.runes.length);
});
