import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, migrate, migrateV1, migrateV2, normalize, gainAbilXp, recordLevel, save, setSave, VERSION } from '../src/core/save.js';
import { oldShopCost } from '../src/data/talents.js';

const V1 = { gold: 812, unlocked: 3, cleared: { 0: true, 1: true }, best: { 0: 251, 1: 244, 2: 130 }, shop: { atk: 4, hp: 3, reroll: 1 }, mute: true, musicOff: false };

test('v1 → v3 übernimmt Gold, Stages, Bestzeiten, Werkstatt (als Talente ×2) und Ton', () => {
  // Stand bis v3 (ab v4 beginnt der Weltfortschritt neu, siehe unten)
  const s = normalize(migrateV2(migrateV1(V1)));
  assert.deepEqual(migrate(V1).stages, {}); assert.deepEqual(migrate(V1).keep.sort(), ['hook', 'smoke']);
  assert.equal(s.wallet.gold, 812);
  { const { lv, ...rest } = s.stages[1]; assert.deepEqual(rest, { cleared: true, stars: 0, best: 251, nightmare: false }); assert.equal(lv[4].hats, 1); }
  { const { lv, ...rest } = s.stages[2]; assert.deepEqual(rest, { cleared: true, stars: 0, best: 244, nightmare: false }); assert.equal(lv[4].hats, 1); }
  { const { lv, ...rest } = s.stages[3]; assert.deepEqual(rest, { cleared: false, stars: 0, best: 130, nightmare: false }); assert.equal(lv[4].hats, 0); }
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

test('Einstellungen: Lautstärke wird begrenzt, Knopfgröße nur s/m/l, alte Stände bekommen Standardwerte', () => {
  const s = migrate({ version: VERSION, settings: { sfxVol: 3, musVol: -1, btn: 'xl', lefty: true, numbers: false } });
  assert.deepEqual(s.settings, { mute: false, musicOff: false, sfxVol: 1, musVol: 0, shake: true, numbers: false, lefty: true, btn: 'm', full: false });
  const old = migrate({ version: 3, settings: { mute: true, shake: false } });
  assert.equal(old.settings.sfxVol, 1); assert.equal(old.settings.btn, 'm'); assert.equal(old.settings.mute, true); assert.equal(old.settings.shake, false);
  assert.equal(migrate({ version: VERSION, settings: { musVol: .35, btn: 'l' } }).settings.musVol, .35);
});

test('normalize ist idempotent', () => {
  const once = normalize(migrate(V1));
  assert.deepEqual(normalize(once), once);
});

test('v2 → v3: Werkstatt ×2, Zündschnur und Ingenieur werden erstattet', () => {
  const v2 = { version: 2, wallet: { gold: 100, gems: 0 }, talents: { atk: 4, spd: 2, ult: 2, mech: 1, reroll: 1 }, stages: { 1: { cleared: true } } };
  const s = normalize(migrateV2(v2));
  assert.equal(migrateV2(v2).version, 3);
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

test('Statistiken und Kartenplatz: alte Stände bekommen Standardwerte, Unsinn wird verworfen', () => {
  const s = migrate({ version: 4, stages: { 1: { cleared: true }, 2: { cleared: true } }, stats: { runs: 5, weapons: { dagger: 4, nix: 9, orbit: 'x' } } });
  assert.deepEqual(s.map, { si: 2, li: 0, fresh: false, nm: false });   // erste offene Welt
  assert.equal(s.stats.bestKills, 0);
  assert.deepEqual(s.stats.weapons, { dagger: 4 });
  assert.deepEqual(migrate({ version: 4, map: { si: 0, li: 3 } }).map, { si: 0, li: 3, fresh: false, nm: false });
});

test('Welten: geschaffte Stage aus alten Ständen = alle Level mit 1 Hut, sonst gelten gespeicherte Hüte', () => {
  const s = migrate({ version: 4, stages: { 1: { cleared: true, best: 250 }, 2: { lv: [{ hats: 3 }, { hats: 9 }, {}] } } });
  assert.deepEqual(s.stages[1].lv.map(l => l.hats), [1, 1, 1, 1, 1]);
  assert.deepEqual(s.stages[2].lv.map(l => l.hats), [3, 3, 0, 0, 0]);
  assert.deepEqual(s.map, { si: 1, li: 2, fresh: false, nm: false });
});

test('v3 → v4: 8 Welten, Weltfortschritt neu, über Welten freie Fähigkeiten bleiben frei', () => {
  const v3 = { version: 3, wallet: { gold: 500, gems: 7 }, talents: { atk: 4 }, loadout: ['hook', 'rats'], stages: { 1: { cleared: true }, 2: { cleared: true }, 3: { cleared: false } }, map: { si: 2, li: 1 } };
  const s = migrate(v3);
  assert.equal(s.version, VERSION);
  assert.deepEqual(s.stages, {});
  assert.deepEqual(s.map, { si: 0, li: 0, fresh: false, nm: false });
  assert.deepEqual(s.keep.sort(), ['hook', 'smoke']);   // Welt 1 → Rauch, Welt 2 → Haken; Welt 3 nicht geschafft
  assert.equal(s.wallet.gold, 500); assert.equal(s.talents.atk, 4);
  assert.deepEqual(s.loadout, ['hook', 'rats']);
  assert.deepEqual(migrate(s).keep.sort(), ['hook', 'smoke']);   // bleibt beim erneuten Laden
  assert.deepEqual(normalize({ version: 4, keep: ['hook', 'gibtsnicht', 'hook'] }).keep, ['hook']);
});

test('Albtraum: Schalter und Albtraum-Siege bleiben im Spielstand', () => {
  const s = normalize({ version: 4, map: { si: 1, li: 2, nm: true }, stages: { 1: { cleared: true, lv: [{ hats: 3, nm: true }, { hats: 1 }] } } });
  assert.equal(s.map.nm, true);
  assert.deepEqual(s.stages[1].lv.map(l => l.nm), [true, false, false, false, false]);
});

test('Weitermachen: Boss-Level geschafft, aber ohne Bestzeit (noBest)', () => {
  setSave(defaults());
  recordLevel(0, 4, { win: true, time: 200, hats: 1, hatOk: [true, false, false], noBest: true });
  assert.equal(save.stages[1].lv[4].fast, 0); assert.equal(save.stages[1].cleared, true);
  recordLevel(0, 4, { win: true, time: 180, hats: 3, hatOk: [true, true, true] });
  assert.equal(save.stages[1].lv[4].fast, 180);
  recordLevel(0, 4, { win: true, time: 100, hats: 1, hatOk: [true, false, false], noBest: true });
  assert.equal(save.stages[1].lv[4].fast, 180);
});

test('v4 → v5: freie Fähigkeiten gelten als gesehen, Runen/Kombos leer', () => {
  const s = migrate({ version: 4, profile: { level: 20 }, stages: { 1: { cleared: true } }, keep: ['bees'] });
  assert.equal(s.version, 5);
  assert.ok(s.seen.includes('rage') && s.seen.includes('oilcask') && s.seen.includes('bees'));   // Konto 10, keep
  assert.ok(!s.seen.includes('turret'));   // erst ab Konto 22
  assert.deepEqual(s.runes, { bag: {}, sock: {} }); assert.deepEqual(s.combos, []);
  assert.deepEqual(normalize(s).seen, s.seen);
});

test('Sterne: nach Level 30 je 2000 XP, bis 5; Rolle und Sprint bekommen keine', () => {
  setSave(defaults());
  save.abilities.trap = { lv: 30, xp: 0, pts: {} }; save.abilities.dash = { lv: 30, xp: 0, pts: {} };
  gainAbilXp('trap', 4500); assert.equal(save.abilities.trap.st, 2); assert.equal(save.abilities.trap.xp, 500);
  gainAbilXp('trap', 99999); assert.equal(save.abilities.trap.st, 5); assert.equal(save.abilities.trap.xp, 0);
  gainAbilXp('dash', 9999); assert.equal(save.abilities.dash.st, undefined); assert.equal(save.abilities.dash.xp, 0);
});
