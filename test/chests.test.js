import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/rng.js';
import { defaults, normalize } from '../src/core/save.js';
import { CARD_IDS, CARD_RARITY, CHESTS, CHEST_IDS, FREE_EVERY, RARITY, cardsToMax, skipGems, upgradeCost } from '../src/data/cards.js';
import { addToShelf, canUpgrade, cardLv, chestLeft, freeChests, grantCards, grantChest, rollChest, skipUnlock, startUnlock, takeFromShelf, upgradeCard } from '../src/game/chests.js';

test('jede Karte hat Seltenheit und Kosten bis Stufe 10', () => {
  for (const id of CARD_IDS) {
    assert.ok(RARITY[CARD_RARITY[id]], id);
    for (let l = RARITY[CARD_RARITY[id]].start; l < 10; l++) assert.ok(upgradeCost(id, l).cards > 0, id + ' ' + l);
    assert.equal(upgradeCost(id, 10), null);
  }
  assert.deepEqual(upgradeCost('dagger', 1), { cards: 2, gold: 20 });
  assert.deepEqual(upgradeCost('saw', 3), { cards: 2, gold: 400 });
});

test('Truhe: Kartenzahl, Gold, Garantie', () => {
  for (const t of CHEST_IDS) for (let s = 1; s < 40; s++) {
    const res = rollChest(t, mulberry32(s), { epic: 0, leg: 0 }), C = CHESTS[t];
    assert.equal(res.cards.reduce((a, c) => a + c.n, 0), C.cards, t);
    assert.ok(res.gold >= C.gold[0] && res.gold <= C.gold[1]);
    assert.ok(res.cards.every(c => c.n > 0 && CARD_RARITY[c.id] === c.rarity));
    if (t === 'mage') assert.ok(res.cards.some(c => c.rarity === 'epic'), 'Magiertruhe garantiert episch');
    if (t === 'iron') assert.ok(res.cards.some(c => c.rarity !== 'common'), 'Eisentruhe garantiert selten');
  }
});

test('Pity: spätestens die 10. Goldtruhe hat eine epische Karte', () => {
  const pity = { epic: 0, leg: 0 }, never = () => 0;   // Zufall immer 0 → nur gewöhnliche Würfe
  for (let i = 1; i <= 9; i++) assert.ok(!rollChest('gold', never, pity).cards.some(c => c.rarity === 'epic'), 'Truhe ' + i);
  assert.ok(rollChest('gold', never, pity).cards.some(c => c.rarity === 'epic'));
  assert.equal(pity.epic, 0);
});

test('Karten gutschreiben, Überschuss wird Gold, Aufwerten', () => {
  const s = defaults(); s.wallet.gold = 0;
  assert.equal(cardLv(s, 'saw'), 3, 'episch startet auf 3');
  assert.equal(grantCards(s, 'dagger', 3), 0);
  assert.ok(!canUpgrade(s, 'dagger'), 'kein Gold');
  s.wallet.gold = 100; assert.ok(upgradeCard(s, 'dagger'));
  assert.deepEqual(s.cards.dagger, { lv: 2, n: 1 }); assert.equal(s.wallet.gold, 80);
  const max = cardsToMax('dagger', 2) - 1;
  assert.equal(grantCards(s, 'dagger', max + 10), 50, '10 überzählige gewöhnliche Karten = 50 Gold');
  const res = grantChest(s, rollChest('wood', mulberry32(3)));
  assert.equal(s.stats.chests, 1); assert.ok(res >= 0);
});

test('Truhenregal: eine Truhe zur Zeit, Wartezeit je Seltenheit, Abkürzen mit Juwelen', () => {
  const s = defaults(), t0 = 1e12;
  for (const t of ['wood', 'gold', 'iron', 'mage']) assert.ok(addToShelf(s, t));
  assert.ok(!addToShelf(s, 'wood'), 'Regal voll');
  assert.ok(CHESTS.mage.wait > CHESTS.gold.wait && CHESTS.gold.wait > CHESTS.iron.wait && CHESTS.iron.wait > CHESTS.wood.wait);
  assert.ok(startUnlock(s, 1, t0));
  assert.ok(!startUnlock(s, 0, t0), 'nur eine zur Zeit');
  assert.equal(takeFromShelf(s, 1, t0 + 1000), null, 'noch zu');
  s.wallet.gems = 1000; const left = chestLeft(s.chests.shelf[1], t0 + 1000);
  assert.ok(skipUnlock(s, 1, t0 + 1000)); assert.equal(s.wallet.gems, 1000 - skipGems(left));
  assert.equal(takeFromShelf(s, 1, t0 + 1000), 'gold'); assert.equal(s.chests.shelf.length, 3);
  assert.ok(startUnlock(s, 0, t0 + 1000), 'danach darf die nächste');
});

test('Pity stuft nie mehr Karten hoch als da sind', () => {
  // Zufall immer knapp unter 100 → jede Karte fällt in die letzte Seltenheit mit Chance, keine gewöhnliche
  const pity = { epic: 99, leg: 99 }, res = rollChest('gold', () => .9999, pity);
  assert.equal(res.cards.reduce((a, c) => a + c.n, 0), CHESTS.gold.cards);
  assert.ok(res.cards.every(c => c.n > 0));
});

test('Gratis-Truhe alle 4 Stunden, höchstens 2', () => {
  const s = defaults(), t0 = 1e12;
  assert.equal(freeChests(s, t0).n, 1, 'neuer Spieler hat eine');
  assert.equal(freeChests(s, t0 + FREE_EVERY - 1).n, 1);
  assert.equal(freeChests(s, t0 + FREE_EVERY).n, 2);
  assert.equal(freeChests(s, t0 + 10 * FREE_EVERY).n, 2);
});

test('Spielstand: Karten und Truhen werden repariert', () => {
  const s = normalize({ cards: { dagger: { lv: 99, n: 5 }, saw: { lv: 1 }, gibtsnicht: { lv: 3 } }, chests: { shelf: [{ type: 'gold', end: 5 }, { type: 'quatsch' }, 'x'] } });
  assert.deepEqual(s.cards, { dagger: { lv: 10, n: 5 }, saw: { lv: 3, n: 0 } });
  assert.deepEqual(s.chests.shelf, [{ type: 'gold', end: 5 }]);
  assert.equal(normalize({}).chests.free.n, 1);
});

test('Albtraum: Siegtruhe eine Stufe besser', async () => {
  const { victoryChest } = await import('../src/data/cards.js');
  assert.deepEqual([0, 3, 6].map(si => victoryChest(si)), ['wood', 'iron', 'gold']);
  assert.deepEqual([0, 3, 6].map(si => victoryChest(si, true)), ['iron', 'gold', 'mage']);
});
