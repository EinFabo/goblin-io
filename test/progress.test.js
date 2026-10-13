import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalize } from '../src/core/save.js';
import { ACHIEVEMENTS, ACH, TIERS } from '../src/data/achievements.js';
import { achState, claimAch, claimDaily, claimDailyBonus, claimableCount, count, dailyTasks, mergeRun, titles } from '../src/game/progress.js';

test('jeder Erfolg hat drei steigende Ziele und einen Wert', () => {
  const s = defaults();
  for (const a of ACHIEVEMENTS) {
    assert.equal(a.goals.length, 3, a.id);
    assert.ok(a.goals[0] < a.goals[1] && a.goals[1] < a.goals[2], a.id);
    assert.equal(typeof a.v(s), 'number', a.id);
    assert.ok(a.desc.includes('{n}'), a.id);
  }
  assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length, 'ids eindeutig');
  assert.ok(ACHIEVEMENTS.length >= 35, 'rund 40 Erfolge');
});

test('Erfolg: Stufen abholen, Juwelen, Titel ab Gold', () => {
  const s = defaults();
  s.stats.kills = 12000;
  assert.deepEqual({ ...achState(s, ACH.kills), next: 0 }, { v: 12000, tier: 2, claimed: 0, next: 0, can: true });
  assert.equal(claimableCount(s), 1);
  assert.deepEqual(claimAch(s, 'kills'), { gems: TIERS[0].gems + TIERS[1].gems, cosm: null });
  assert.equal(claimAch(s, 'kills'), null, 'nichts mehr offen');
  assert.deepEqual(titles(s), []);
  s.stats.kills = 100000; claimAch(s, 'kills');
  assert.deepEqual(titles(s), ['Magierschreck']);
});

test('Hutsammler Gold gibt die Krone', () => {
  const s = defaults();
  for (let w = 1; w <= 5; w++) s.stages[w] = { cleared: true, stars: 0, best: 0, nightmare: false, lv: Array.from({ length: 5 }, () => ({ hats: 3, kills: 0, fast: 0 })) };
  const r = claimAch(s, 'hats');
  assert.equal(r.cosm, 'hat.crown'); assert.ok(s.cosm.includes('hat.crown'));
});

test('Laufende zählt: Kills nach Schule, Gold, Siege je Waffe, Endlose Nacht', () => {
  const s = defaults(), run = { cnt: {}, gold: 120, weapons: [{ id: 'dagger' }, { id: 'saw' }], st: {}, time: 100 };
  count(run, 'k.fire', 3); count(run, 'perfect'); count(run, null);
  mergeRun(s, run, true);
  assert.deepEqual(s.stats.c, { 'k.fire': 3, perfect: 1, gold: 120, levels: 1, 'w.dagger': 1, 'w.saw': 1 });
  mergeRun(s, { cnt: {}, gold: 0, weapons: [], st: { endless: true }, time: 400 }, false);
  assert.equal(s.stats.c.endless, 400);
});

test('Tagesaufgaben: gleich für alle am Tag, Fortschritt ab Tagesbeginn, Bonus', () => {
  const s = defaults(), day = '2026-10-14';
  const a = dailyTasks(s, day), b = dailyTasks(defaults(), day);
  assert.deepEqual(a.map(t => t.text), b.map(t => t.text));
  assert.equal(new Set(a.map(t => t.id)).size, 3, 'drei verschiedene');
  // alles erfüllen: Zähler hochsetzen
  for (const t of a) { if (t.key === 'kills') s.stats.kills += t.n; else s.stats.c[t.key] = (s.stats.c[t.key] || 0) + t.n; }
  const done = dailyTasks(s, day);
  assert.ok(done.every(t => t.done && t.prog === t.n));
  assert.equal(claimDailyBonus(s, day), null, 'Bonus erst nach allen drei');
  const gems0 = s.wallet.gems, gold0 = s.wallet.gold;
  let gems = 0, gold = 0;
  for (let i = 0; i < 3; i++) { const r = claimDaily(s, i, day); assert.ok(r); gems += r.gems || 0; gold += r.gold || 0; }
  assert.equal(claimDaily(s, 0, day), null, 'nicht doppelt');
  assert.equal(s.wallet.gems, gems0 + gems); assert.equal(s.wallet.gold, gold0 + gold);
  assert.deepEqual(claimDailyBonus(s, day), { gems: 20 });
  assert.equal(claimDailyBonus(s, day), null);
  // neuer Tag: Fortschritt beginnt bei null
  assert.ok(dailyTasks(s, '2026-10-15').every(t => t.prog === 0 && !t.claimed));
});

test('Spielstand: Zähler, Erfolge und Tagesaufgaben werden repariert', () => {
  const s = normalize({ stats: { c: { kills: 5, x: 'kaputt' } }, ach: { kills: 9, gibtsnicht: 1 }, daily: { day: '2026-01-01', base: { kills: 3 }, claimed: [true, 'ja'] } });
  assert.deepEqual(s.stats.c, { kills: 5 });
  assert.deepEqual(s.ach, { kills: 3 });
  assert.deepEqual(s.daily.claimed, [true, false, false]);
});
