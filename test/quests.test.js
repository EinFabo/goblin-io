import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, migrate, normalize } from '../src/core/save.js';
import { ABILITY_IDS } from '../src/data/abilities.js';
import { COSM } from '../src/data/cosmetics.js';
import { AQ_GOALS, PASS_PTS, PASS_STAGES, PASS_STEP, SEASON_SETS, WEEKLY_N, WEEKLY_POOL, passReward } from '../src/data/quests.js';
import { claimDaily, ensureDaily, titles } from '../src/game/progress.js';
import { addPassPts, aqState, bountyMet, bountyText, claimAq, claimPass, claimWeekly, claimWeeklyBonus, ensureBounty, ensurePass, ensureWeekly,
  passBonusReady, passList, seasonOf, weekOf, weeklyTasks } from '../src/game/quests.js';

const won = (s, n) => { for (let i = 1; i <= n; i++) s.stages[i] = { cleared: true, stars: 0, best: 0, nightmare: false, lv: [] }; };

test('Woche und Saison: Montag beginnt, 4 Wochen je Saison', () => {
  assert.equal(weekOf('2026-10-26'), 0); assert.equal(weekOf('2026-11-01'), 0); assert.equal(weekOf('2026-11-02'), 1);
  assert.equal(seasonOf('2026-11-22'), 0); assert.equal(seasonOf('2026-11-23'), 1);
});

test('Wochenaufgaben: 5 feste je Woche, nur was schon geht, Fortschritt ab Wochenbeginn', () => {
  const s = defaults(), day = '2026-10-28';
  ensureWeekly(s, day);
  assert.equal(s.weekly.tasks.length, WEEKLY_N);
  assert.ok(!s.weekly.tasks.some(t => t.id === 'nmwin' || t.id === 'clswin'), 'Albtraum und Klassen erst später');
  const again = defaults(); ensureWeekly(again, day); assert.deepEqual(again.weekly.tasks, s.weekly.tasks, 'gleich für alle');
  s.stats.kills = 99999; s.stats.c.levels = 99; s.stats.c.bosses = 99; s.stats.c.hat3 = 99; s.stats.c.perfect = 999; s.stats.c.mega = 9; s.stats.c.evo = 99;
  s.stats.c.abil = 9999; s.stats.c.gold = 99999; s.stats.c.elites = 999; s.stats.c.combo = 99; s.stats.chests = 99; s.stats.c.rolls = 9999;
  const t = weeklyTasks(s, day);
  assert.ok(t.every(x => x.done));
  const g0 = s.wallet.gems + s.wallet.gold;
  for (let i = 0; i < WEEKLY_N; i++) assert.ok(claimWeekly(s, i, day));
  assert.equal(claimWeekly(s, 0, day), null, 'nur einmal');
  assert.ok(s.wallet.gems + s.wallet.gold > g0 || Object.keys(s.runes.bag).length, 'Belohnung kam an');
  const sh = s.stats.chests, wb = claimWeeklyBonus(s, day);
  assert.equal(wb.chest, 'gold'); assert.ok(wb.chestRes, 'Truhe gleich geöffnet'); assert.ok(s.stats.chests > sh || wb.chestRes.cards.length);
  assert.equal(s.pass.pts, WEEKLY_N * PASS_PTS.weekly);
  // nächste Woche: neue Aufgaben, Zähler beginnen bei null
  ensureWeekly(s, '2026-11-02'); assert.ok(weeklyTasks(s, '2026-11-02').every(x => x.prog === 0));
});

test('Tagesaufgaben geben Pass-Punkte', () => {
  const s = defaults(), day = '2026-10-28';
  ensureDaily(s, day); s.stats.kills = 1e6; s.stats.c = { elites: 999, levels: 99, perfect: 999, abil: 999, gold: 1e5, rolls: 999, bosses: 9, evo: 9 };
  claimDaily(s, 0, day);
  assert.equal(s.pass.pts, PASS_PTS.daily);
});

test('Aufgaben-Pass: Stufen, Kosmetik und Titel, Bonustruhen, neue Saison', () => {
  const s = defaults(), day = '2026-10-28';
  for (let i = 1; i <= PASS_STAGES; i++) { const r = passReward(i, 0); assert.ok(Object.keys(r).length, 'Stufe ' + i); if (r.cosm) assert.ok(COSM[r.cosm], r.cosm); }
  for (let k = 0; k < SEASON_SETS.length; k++) for (const s10 of [10, 20, 30]) assert.ok(COSM[passReward(s10, k).cosm]);
  assert.equal(claimPass(s, 1, day), null, 'noch nicht erreicht');
  addPassPts(s, PASS_STAGES * PASS_STEP + 310, day);
  assert.ok(passList(s, day).every(x => x.reached));
  for (let i = 1; i <= PASS_STAGES; i++) assert.ok(claimPass(s, i, day), 'Stufe ' + i);
  assert.equal(claimPass(s, 30, day), null);
  assert.ok(titles(s).includes('Pass-Held'));
  assert.ok(s.cosm.includes(passReward(30, 0).cosm));
  assert.equal(passBonusReady(s.pass), 2);
  assert.ok(claimPass(s, 'bonus', day)); assert.ok(claimPass(s, 'bonus', day)); assert.equal(claimPass(s, 'bonus', day), null);
  ensurePass(s, '2026-11-23');
  assert.equal(s.pass.pts, 0); assert.deepEqual(s.pass.claimed, []); assert.ok(s.pass.champ, 'Titel bleibt');
  // nicht Abgeholtes der alten Saison kommt beim Wechsel nach (Kosmetik, Titel, Truhen ins Regal)
  const t = defaults(); addPassPts(t, PASS_STAGES * PASS_STEP, '2026-11-20'); claimPass(t, 1, '2026-11-20');
  ensurePass(t, '2026-11-23');
  assert.ok(t.cosm.includes(passReward(30, 0).cosm) && t.pass.champ && t.chests.shelf.length > 0);
});

test('Kopfgeld: erst ab Welt 2, drei Steckbriefe mit Text, Bedingungen', () => {
  const s = defaults(), day = '2026-10-28';
  assert.equal(ensureBounty(s, day).list.length, 0);
  won(s, 3);
  const B = ensureBounty(s, day);
  assert.equal(B.list.length, 3);
  for (const b of B.list) { const t = bountyText(b); assert.ok(t.goal.length > 5); assert.ok(b.sk >= 1 && b.sk <= 3); if (b.si !== undefined) assert.ok(b.si <= 3); }
  const R = { win: true, boss: true, si: 1, endless: false, cont: false, cnt: { 'k.fire': 50, 'af.fast': 3 }, bossHits: 0, time: 150, abil: ['trap'], nm: true, healed: 0, cls: 'bow' };
  assert.ok(bountyMet({ t: 'boss', si: 1, c: 'nohit' }, R));
  assert.ok(!bountyMet({ t: 'boss', si: 1, c: 'nohit' }, { ...R, bossHits: 1 }));
  assert.ok(!bountyMet({ t: 'boss', si: 1 }, { ...R, cont: true }), 'Weitermachen zählt nicht');
  assert.ok(bountyMet({ t: 'boss', si: 1, c: 'time', T: 200 }, R) && !bountyMet({ t: 'boss', si: 1, c: 'time', T: 100 }, R));
  assert.ok(bountyMet({ t: 'level', si: 1, c: 'abil', abil: 'trap' }, R) && !bountyMet({ t: 'level', si: 1, c: 'abil', abil: 'rage' }, R));
  assert.ok(bountyMet({ t: 'school', school: 'fire', n: 40, c: 'noheal' }, R) && !bountyMet({ t: 'school', school: 'fire', n: 40, c: 'noheal' }, { ...R, healed: 5 }));
  assert.ok(bountyMet({ t: 'affix', affix: 'fast', n: 3, c: 'cls', cls: 'bow' }, R) && !bountyMet({ t: 'affix', affix: 'fast', n: 4 }, R));
  assert.ok(!bountyMet({ t: 'boss', si: 2 }, R) && !bountyMet({ t: 'level', si: 1 }, { ...R, win: false }));
});

test('Fähigkeiten-Quests: drei Stufen, Belohnung, Titel, Pass-Punkte', () => {
  const s = defaults();
  for (const id of ABILITY_IDS) assert.ok(aqState(s, id).text.length > 5, id);
  assert.equal(aqState(s, 'smoke').key, 'use'); assert.equal(aqState(s, 'trap').key, 'kills');
  s.stats.c['ab.trap.kills'] = AQ_GOALS.kills[2];
  assert.equal(aqState(s, 'trap').tier, 3);
  const r1 = claimAq(s, 'trap'); assert.equal(r1.tier, 0); assert.equal(r1.runes.length, 1);
  claimAq(s, 'trap'); const r3 = claimAq(s, 'trap'); assert.equal(r3.tier, 2); assert.ok(r3.runes[0].endsWith('.3'));
  assert.equal(claimAq(s, 'trap'), null);
  assert.ok(titles(s).includes('Meister der Bärenfalle'));
  assert.equal(s.pass.pts, 3 * PASS_PTS.aq);
});

test('Spielstand v7: Quests werden geprüft, alte Stände leer', () => {
  const s = migrate({ version: 6 });
  assert.deepEqual(s.aq, {}); assert.equal(s.weekly.tasks.length, 0); assert.equal(s.pass.pts, 0);
  const t = normalize({ weekly: { wk: 3, tasks: [{ id: 'quatsch', n: 1 }, { id: 'kills', n: 10 }], claimed: [true, false] }, pass: { season: 1, pts: 250, claimed: [1, 2, 99, 'x'] },
    bounty: { day: 'd', list: [{ t: 'nix', sk: 1 }, { t: 'boss', si: 1, sk: 2 }, { t: 'boss', si: 1 }, { t: 'level', si: 0, sk: 1, c: 'abil', abil: 'weg' }, { t: 'school', school: 'fire', n: 40, sk: 1, c: 'cls', cls: 'bow' }], done: [true, false, true, true, true] },
    aq: { trap: 2, nix: 1, rage: 9 } });
  assert.deepEqual(t.weekly.tasks, [{ id: 'kills', n: 10 }]); assert.deepEqual(t.weekly.claimed, [false], 'Haken rutscht nicht weiter');
  assert.deepEqual(t.pass.claimed, [1, 2]); assert.deepEqual(t.aq, { trap: 2, rage: 3 });
  assert.deepEqual(t.bounty.list.map(b => b.t), ['boss', 'school'], 'ohne Totenköpfe oder mit unbekannter Fähigkeit fällt weg'); assert.deepEqual(t.bounty.done, [false, true]);
  assert.ok(WEEKLY_POOL.every(q => q.n.length === 3));
});

test('Tägliche Herausforderung: freies Level, zwei Fähigkeiten, 1–2 Mutatoren, Bestwert, erster Sieg belohnt', async () => {
  const { ensureChallenge, finishChallenge } = await import('../src/game/quests.js');
  const { MUTATORS } = await import('../src/data/mutators.js');
  const s = defaults(), day = '2026-10-28';
  won(s, 2); s.stages[3] = { cleared: false, lv: [{ hats: 1 }, { hats: 0 }, { hats: 0 }, { hats: 0 }, { hats: 0 }] };
  const C = ensureChallenge(s, day), d = C.def;
  assert.ok(d.si <= 2 && (d.si < 2 || d.li <= 1), 'nur freie Level');
  assert.equal(d.abil.length, 2); assert.notEqual(d.abil[0], d.abil[1]);
  assert.ok(d.mut.length >= 1 && d.mut.length <= 2 && d.mut.every(m => MUTATORS[m]));
  const t = defaults(); won(t, 2); t.stages[3] = s.stages[3]; assert.deepEqual(ensureChallenge(t, day).def, d, 'gleich für gleichen Stand');
  const R = { mode: 'challenge', day, win: true, cont: false, time: 140, kills: 300, si: d.si, li: d.li, mut: d.mut, abil: d.abil };
  assert.equal(finishChallenge(s, { ...R, mode: null }, day), null);
  assert.equal(finishChallenge(s, { ...R, win: false }, day), null);
  const g0 = s.wallet.gold, a = finishChallenge(s, R, day);
  assert.ok(a.reward && s.wallet.gold > g0 && C.done); assert.equal(s.pass.pts, 40);
  const b = finishChallenge(s, { ...R, time: 120, kills: 350 }, day);
  assert.ok(b.better && !b.reward, 'Bestwert besser, Belohnung nur einmal');
  assert.ok(!finishChallenge(s, { ...R, time: 160, kills: 100 }, day).better);
  assert.equal(finishChallenge(s, { ...R, day: '2026-10-27' }, day), null, 'Lauf von gestern zählt nicht');
});

test('Kopfgeld mit Mutator: Bedingung und Start-Level', async () => {
  const { bountyStart } = await import('../src/game/quests.js');
  const R = { win: true, boss: true, si: 2, endless: false, cont: false, cnt: {}, bossHits: 3, time: 300, abil: [], nm: 0, healed: 9, cls: 'gob', mut: ['dark'] };
  assert.ok(bountyMet({ t: 'boss', si: 2, c: 'mut', mut: 'dark' }, R)); assert.ok(!bountyMet({ t: 'boss', si: 2, c: 'mut', mut: 'glass' }, R));
  assert.deepEqual(bountyStart({ t: 'boss', si: 2, c: 'mut', mut: 'dark' }), { si: 2, li: 4, mut: ['dark'] });
  assert.deepEqual(bountyStart({ t: 'level', si: 1, c: 'mut', mut: 'swarm' }), { si: 1, li: 0, mut: ['swarm'] });
  assert.equal(bountyStart({ t: 'boss', si: 2, c: 'nohit' }), null);
  const t = normalize({ bounty: { day: 'd', list: [{ t: 'boss', si: 1, sk: 2, c: 'mut', mut: 'dark' }, { t: 'boss', si: 1, sk: 2, c: 'mut', mut: 'weg' }], done: [false, false] } });
  assert.equal(t.bounty.list.length, 1);
});

test('Herausforderung zählt nur mit passendem Lauf; Steckbrief-Los nur für freie Level', async () => {
  const { ensureChallenge, finishChallenge, bountyStart } = await import('../src/game/quests.js');
  const s = defaults(), day = '2026-10-28'; won(s, 3);
  const d = ensureChallenge(s, day).def, R = { mode: 'challenge', day, win: true, cont: false, time: 100, kills: 200, si: d.si, li: d.li, mut: d.mut, abil: d.abil };
  assert.equal(finishChallenge(s, { ...R, mut: ['glass', 'dark', 'x'] }, day), null, 'alter Lauf über Mitternacht');
  assert.ok(finishChallenge(s, R, day));
  const t = defaults(); won(t, 1);
  assert.equal(bountyStart({ t: 'boss', si: 1, c: 'mut', mut: 'dark' }, t), null, 'Boss von Welt 2 noch gesperrt');
  assert.ok(bountyStart({ t: 'level', si: 1, c: 'mut', mut: 'dark' }, t));
});
