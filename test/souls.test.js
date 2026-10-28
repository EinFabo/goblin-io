import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalize } from '../src/core/save.js';
import { SOUL_IDS, SOUL_NODES } from '../src/data/souls.js';
import { buySoul, rebirth, rebirthOpen, soulRank, soulWhy, soulsFor, soulsFree } from '../src/game/souls.js';
import { socketIdx, socketOpen } from '../src/game/runes.js';

const allWon = s => { for (let k = 1; k <= 8; k++) s.stages[k] = { cleared: true, stars: 0, best: 0, nightmare: false, nmMax: k <= 2 ? 3 : 0, lv: Array.from({ length: 5 }, () => ({ hats: 2, kills: 0, fast: 0, nm: 0 })) }; };

test('Seelenbaum: Daten stimmig (Kosten je Rang, Voraussetzungen vorhanden)', () => {
  for (const id of SOUL_IDS) { const N = SOUL_NODES[id]; assert.equal(N.cost.length, N.max, id); if (N.req) assert.ok(SOUL_NODES[N.req], id); }
  assert.ok(SOUL_IDS.length >= 18);
});

test('Wiedergeburt: erst nach Welt 8 und einer Runde Endlose Nacht; Seelen; was bleibt und was neu beginnt', () => {
  const s = defaults(); allWon(s);
  assert.ok(!rebirthOpen(s), 'ohne Endlose Nacht nicht');
  s.stats.c.endless = 300; assert.ok(!rebirthOpen(s), 'zählt je Zyklus'); s.rebirth.night = 300; assert.ok(rebirthOpen(s));
  assert.equal(soulsFor(s), 8 * 10 + 6 * 5 + 5);
  s.wallet.gold = 777; s.cards = { dagger: { lv: 4, n: 2 } }; s.profile.level = 30; s.classes = { bow: { lv: 7, xp: 0 } };
  const r = rebirth(s);
  assert.deepEqual(r, { gain: 115, n: 1 });
  assert.deepEqual(s.stages, {}); assert.equal(s.map.nm, 0); assert.equal(s.wallet.gold, 777); assert.equal(s.profile.level, 30); assert.deepEqual(s.cards.dagger, { lv: 4, n: 2 });
  assert.ok(s.clsKeep.includes('bow') && s.clsKeep.includes('war'), 'Klassen bleiben frei');
  assert.equal(s.rebirth.hats, 80); assert.equal(s.rebirth.levels, 40);
  assert.equal(rebirth(s), null, 'gleich danach nicht nochmal');
  const t = normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(t.rebirth, s.rebirth); assert.deepEqual(t.clsKeep, s.clsKeep);
});

test('Seelenbaum: Kosten, Voraussetzung, Krönung braucht alle Äste, dritter Sockel', () => {
  const s = defaults(); s.rebirth.souls = 1000;
  assert.ok(soulWhy(s, 'w_start').startsWith('Erst'));
  assert.ok(buySoul(s, 'w_dmg') && buySoul(s, 'w_start')); assert.equal(soulsFree(s), 1000 - 35);
  assert.ok(soulWhy(s, 'crown').includes('Ast'));
  for (const id of ['w_dmg', 'w_dmg', 'w_hp', 'c_gold', 'c_gold', 'c_gold', 'm_axp', 'm_axp', 'm_charge']) buySoul(s, id);
  assert.equal(soulWhy(s, 'crown'), ''); assert.ok(buySoul(s, 'crown')); assert.equal(soulRank(s, 'crown'), 1);
  assert.ok(!buySoul(s, 'crown'), 'nur ein Rang');
  s.abilities.trap = { lv: 30, xp: 0, pts: {} };
  assert.deepEqual(socketIdx(s), [0, 1]); assert.ok(!socketOpen(s, 'trap', 2));
  buySoul(s, 'm_sock'); assert.deepEqual(socketIdx(s), [0, 1, 2]); assert.ok(socketOpen(s, 'trap', 2));
  const poor = defaults(); poor.rebirth.souls = 5; assert.ok(soulWhy(poor, 'w_dmg').includes('Seelen'));
});

test('Wiedergeburt setzt die Endlose Nacht des Zyklus zurück; dritter Sockel: Ausbauen und Runenart', async () => {
  const { socket, unsocket } = await import('../src/game/runes.js');
  const s = defaults(); allWon(s); s.rebirth.night = 600; rebirth(s);
  assert.equal(s.rebirth.night, 0); assert.ok(!rebirthOpen(s));
  s.rebirth.souls = 500; buySoul(s, 'm_axp'); buySoul(s, 'm_sock');
  s.abilities.trap = { lv: 30, xp: 0, pts: {} }; s.runes.bag = { 'fire.1': 1, 'fire.2': 1, 'frost.1': 1 };
  assert.ok(socket(s, 'trap', 0, 'fire.1')); assert.ok(socket(s, 'trap', 2, 'frost.1'));
  assert.ok(!socket(s, 'trap', 1, 'fire.2'), 'Feuer steckt schon (Sockel 1)');
  assert.ok(unsocket(s, 'trap', 0)); assert.deepEqual(s.runes.sock.trap, [null, null, 'frost.1'], 'Rune im dritten Sockel bleibt');
});
