import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/rng.js';
import { WEAPONS } from '../src/data/weapons.js';
import { MAX_P, PITY_MAX, candidates, canBan, drawOffer, itemKey, newOfferState, pityPassives, replaceCard, settleOffer, swapCards } from '../src/game/offer.js';

// Wendet eine Karte auf den Testzustand an (wie applyChoice, nur ohne Lauf)
function apply(S, c) {
  if (c.k === 'newW') S.weapons.push({ id: c.id, lv: 1, evo: false });
  else if (c.k === 'upW') S.weapons.find(w => w.id === c.id).lv++;
  else if (c.k === 'evo') S.weapons.find(w => w.id === c.id).evo = true;
  else if (c.k === 'newP' || c.k === 'upP') S.passives[c.id] = (S.passives[c.id] || 0) + 1;
  else if (c.k === 'swap') { const lv = S.passives[c.from]; delete S.passives[c.from]; S.passives[c.id] = lv; }
}

// Prüft eine Auswahl gegen die Regeln aus PLAN 7.2. Gibt den Grund zurück, falls eine Regel verletzt ist.
function check(S, offer, n) {
  const keys = offer.map(itemKey), pool = candidates(S), slotsFor = why => offer.filter(c => c.why === 'lock' || c.why === 'evo' || c.why === 'swap' || why.includes(c.why)).length < n;
  if (new Set(keys).size !== keys.length) return 'doppelt';
  if (offer.length !== n) return 'Anzahl';
  for (const c of offer) if (S.banned.has(itemKey(c))) return 'gebannt: ' + itemKey(c);
  const evos = pool.filter(c => c.k === 'evo');
  if (evos.length <= n - (offer[0].why === 'lock' ? 1 : 0)) for (const e of evos) if (!offer.some(c => c.k === 'evo' && c.id === e.id)) return 'Entwicklung fehlt';
  if (S.weapons.length < 3 && pool.some(c => c.k === 'newW') && !offer.some(c => c.k === 'newW') && slotsFor([])) return 'Startphase';
  if (pool.some(c => c.k === 'upW') && !offer.some(c => c.k === 'upW') && slotsFor(['start'])) return 'Fokus';
  const due = pityPassives(S).filter(p => (S.pity[p] || 0) >= PITY_MAX);
  if (due.length && !offer.some(c => c.k === 'newP' && c.id === due.sort((a, b) => S.pity[b] - S.pity[a])[0]) && slotsFor(['start', 'focus'])) return 'Pity';
  // Zweimal abgelehnte Karten nur, wenn sonst nichts mehr da war
  for (const c of offer) {
    if (c.why !== 'rest' || !(S.rej[itemKey(c)] >= 2)) continue;
    const alt = pool.filter(p => p.k !== 'evo' && !keys.includes(itemKey(p)) && !(S.rej[itemKey(p)] >= 2));
    if (alt.length) return 'abgelehnte Karte trotz Alternativen: ' + itemKey(c);
  }
  return null;
}

test('Garantien aus 7.2 halten in 10 000 zufälligen Läufen', () => {
  const r = mulberry32(42);
  let offers = 0, pityHits = 0;
  for (let run = 0; run < 10000; run++) {
    const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 1, evo: false }], passives: {} };
    const n = run % 5 === 0 ? 4 : 3;
    let bans = 1 + (r() * 3 | 0), locks = 1;
    for (let lv = 0; lv < 40; lv++) {
      const why = check(S, drawOffer(S, r, { n }), n);
      let offer = drawOffer(S, r, { n });
      const err = check(S, offer, n);
      assert.equal(why === null && err === null, true, `Lauf ${run}, Level-Up ${lv}: ${why || err}\n${JSON.stringify(offer)}`);
      offers++;
      if (offer.some(c => c.why === 'pity')) pityHits++;
      // Manchmal bannen
      if (bans > 0 && r() < .1) {
        const i = r() * n | 0;
        if (canBan(offer[i])) { bans--; S.banned.add(itemKey(offer[i])); offer = replaceCard(S, offer.slice(), i, r); }
        for (const c of offer) assert.ok(!S.banned.has(itemKey(c)), 'nach Bannen');
        assert.equal(new Set(offer.map(itemKey)).size, n, 'nach Bannen doppelt');
      }
      // Zufällig wählen, manchmal überspringen oder sperren
      const pick = r() < .1 ? -1 : r() * n | 0;
      const lock = locks > 0 && r() < .05 ? r() * n | 0 : -1;
      if (lock >= 0 && lock !== pick) locks--;
      settleOffer(S, offer, pick, lock);
      if (pick >= 0) apply(S, offer[pick]);
      // Gesperrte Karte muss im nächsten Angebot liegen, sofern sie noch gültig ist
      if (S.lock && candidates(S).some(c => c.k === S.lock.k && c.id === S.lock.id)) {
        const next = drawOffer({ ...S, rej: { ...S.rej }, pity: { ...S.pity } }, mulberry32(lv), { n });
        assert.ok(next.some(c => c.k === S.lock.k && c.id === S.lock.id), 'Sperre ignoriert');
      }
    }
  }
  assert.ok(offers === 400000);
  assert.ok(pityHits > 0, 'Pity hat nie gegriffen');
});

test('Pity: Entwicklungs-Passiv kommt spätestens nach 4 Level-Ups', () => {
  const r = mulberry32(7);
  for (let k = 0; k < 2000; k++) {
    // Waffe auf Stufe 3, Passiv fehlt, Spieler wählt immer etwas anderes
    const S = { ...newOfferState(), weapons: [{ id: 'fireball', lv: 3, evo: false }, { id: 'dagger', lv: 5, evo: false }, { id: 'saw', lv: 2, evo: false }], passives: { whet: 1, magnet: 1 } };
    const want = WEAPONS.fireball.with;
    let seen = -1;
    for (let lv = 0; lv < 6 && seen < 0; lv++) {
      const offer = drawOffer(S, r);
      if (offer.some(c => c.k === 'newP' && c.id === want)) seen = lv;
      else settleOffer(S, offer, offer.findIndex(c => c.k !== 'upW') >= 0 ? offer.findIndex(c => c.k !== 'upW') : 0);
    }
    assert.ok(seen >= 0 && seen <= PITY_MAX, `kam erst nach ${seen}`);
  }
});

test('Gewichtung: eigene Gegenstände kommen öfter als neue', () => {
  const r = mulberry32(3);
  let own = 0, fresh = 0;
  for (let k = 0; k < 5000; k++) {
    const S = { ...newOfferState(), weapons: [{ id: 'fireball', lv: 2, evo: false }, { id: 'saw', lv: 2, evo: false }, { id: 'bolt', lv: 2, evo: false }], passives: { book: 1, oil: 1 } };
    for (const c of drawOffer(S, r)) if (c.why === 'rest') { if (c.k === 'upW' || c.k === 'upP') own++; else fresh++; }
  }
  // ohne Faktor wären es ~21 % (eigene Waffen 4, Passive 3 wie neue), mit ×2,5 ~40 %
  assert.ok(own / (own + fresh) > .35, `Anteil eigener ${(own / (own + fresh)).toFixed(2)}`);
});

test('Wurfdolch steigt von selbst auf: nie als Aufwertungs-Karte, Entwicklung bleibt eine Karte', () => {
  const r = mulberry32(5);
  for (let k = 0; k < 3000; k++) {
    const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 1 + (k % 4), evo: false }, { id: 'saw', lv: 2, evo: false }], passives: { magnet: 1 } };
    for (const c of drawOffer(S, r)) assert.ok(!(c.k === 'upW' && c.id === 'dagger'), 'Dolch-Aufwertung im Angebot');
  }
  const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 5, evo: false }], passives: { whet: 1 } };
  assert.ok(drawOffer(S, r).some(c => c.k === 'evo' && c.id === 'dagger'), 'Dolchsturm fehlt');
});

// Umschmieden (Wunsch Fabi 2026-10-16): volle Passiv-Plätze verbauen keine Entwicklung mehr
test('Umschmieden: volle Passiv-Plätze ohne passendes Passiv → Tauschkarte, Stufe bleibt', () => {
  const wrong = ['armor', 'boots', 'herbs', 'magnet', 'powder', 'oil'];   // passen zu keiner der Waffen unten
  const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 5, evo: false }, { id: 'hammer', lv: 2, evo: false }], passives: Object.fromEntries(wrong.map((p, i) => [p, i < 2 ? 1 : 3])) };
  assert.equal(Object.keys(S.passives).length, MAX_P);
  const sw = swapCards(S);
  // Hammer erst Stufe 2: nur der Dolch (Stufe 5, braucht Wetzstein) bekommt eine Karte; weg fällt ein Passiv mit Stufe 1
  assert.deepEqual(sw.map(c => [c.id, c.ready]), [['whet', true]]);
  assert.equal(S.passives[sw[0].from], 1);
  // Bei Stufe 5 ist sie garantiert im Angebot
  const r = mulberry32(7);
  for (let i = 0; i < 50; i++) assert.ok(drawOffer(S, r).some(c => c.k === 'swap' && c.id === 'whet' && c.from), 'Tauschkarte fehlt');
  // Danach: Entwicklung möglich, Stufe übernommen
  const c = drawOffer(S, r).find(x => x.k === 'swap'), lv = S.passives[c.from];
  apply(S, c);
  assert.equal(S.passives.whet, lv); assert.equal(S.passives[c.from], undefined);
  assert.ok(drawOffer(S, r).some(x => x.k === 'evo' && x.id === 'dagger'));
  assert.deepEqual(swapCards(S), []);
});

test('Umschmieden: nur wenn die Plätze voll sind, nie ein noch gebrauchtes Passiv, Bannen wirkt', () => {
  const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 4, evo: false }, { id: 'orbit', lv: 3, evo: false }], passives: { armor: 2, boots: 2, herbs: 2, magnet: 2, powder: 2 } };
  assert.deepEqual(swapCards(S), [], 'Platz frei: lieber das Passiv neu nehmen');
  S.passives.book = 1;
  const sw = swapCards(S);
  assert.deepEqual(sw.map(c => c.id).sort(), ['amulet', 'whet']);
  assert.equal(new Set(sw.map(c => c.from)).size, 2, 'jede Karte tauscht ein anderes Passiv');
  // Wetzstein selbst wird gebraucht, darf also nie wegfallen
  S.passives = { whet: 1, armor: 2, boots: 2, herbs: 2, magnet: 2, powder: 2 };
  S.weapons[0].lv = 5;
  for (const c of swapCards(S)) assert.notEqual(c.from, 'whet');
  S.banned.add('s:amulet');
  assert.deepEqual(swapCards(S), []);
  assert.ok(canBan({ k: 'swap', id: 'amulet' }));
});

test('Umschmieden: gesperrte Tauschkarte kommt mit demselben Passiv wieder', () => {
  const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 5, evo: false }], passives: { armor: 1, boots: 1, herbs: 3, magnet: 3, powder: 3, oil: 3 } };
  const r = mulberry32(3);
  const offer = drawOffer(S, r), i = offer.findIndex(c => c.k === 'swap'), from = offer[i].from;
  const other = offer.findIndex(c => c.k === 'upP' && c.id === from);
  settleOffer(S, offer, other >= 0 ? other : (i + 1) % offer.length, i);
  if (other >= 0) S.passives[from]++;   // das gezeigte Passiv wird stärker: wäre sonst nicht mehr das schwächste
  const again = drawOffer(S, r);
  assert.equal(again[0].why, 'lock'); assert.equal(again[0].k, 'swap'); assert.equal(again[0].from, from);
  // Ist das Passiv nicht mehr entbehrlich (eigene Waffe braucht es), verfällt die Sperre
  settleOffer(S, again, 1, 0);
  S.weapons.push({ id: Object.keys(WEAPONS).find(k => WEAPONS[k].with === from), lv: 1, evo: false });
  assert.ok(!drawOffer(S, r).some(c => c.why === 'lock'));
});

test('Alles ausgebaut: Dauerboni und ein Eintopf statt Eintopf und Gold', () => {
  const ws = ['dagger', 'orbit', 'fireball', 'spear', 'bolt', 'poison'], ps = ['whet', 'amulet', 'book', 'armor', 'boots', 'herbs'];
  const S = { ...newOfferState(), weapons: ws.map(id => ({ id, lv: 5, evo: true })), passives: Object.fromEntries(ps.map(p => [p, 5])) };
  const r = mulberry32(11), seen = new Set();
  for (let i = 0; i < 30; i++) {
    const o = drawOffer(S, r);
    assert.deepEqual(o.map(c => c.k), ['boon', 'boon', 'heal']);
    o.forEach(c => c.k === 'boon' && seen.add(c.id));
  }
  assert.deepEqual([...seen].sort(), ['dmg', 'hp', 'spd']);
  assert.ok(!canBan({ k: 'boon', id: 'dmg' }));
  // gesperrter Dauerbonus kommt wieder
  const o = drawOffer(S, r); settleOffer(S, o, 2, 0);
  const again = drawOffer(S, r); assert.equal(again[0].why, 'lock'); assert.equal(again[0].id, o[0].id);
  // Bann der letzten echten Karte: Ersatz ist ein Dauerbonus, der noch nicht liegt
  S.passives.herbs = 4; S.lock = null;
  const o2 = drawOffer(S, r), i = o2.findIndex(c => c.k === 'upP');
  S.banned.add(itemKey(o2[i]));   // wie ban() in game/levelup.js
  const rep = replaceCard(S, o2.slice(), i, r);
  assert.equal(rep[i].k, 'boon'); assert.equal(new Set(rep.map(itemKey)).size, 3);
});

test('Klassenwaffen kommen nie ins Angebot, haben keine Karte und teilen sich Passive', async () => {
  const { CARD_IDS } = await import('../src/data/cards.js');
  const { CLASS_WEAPONS, weaponOf } = await import('../src/data/weapons.js');
  assert.deepEqual(CLASS_WEAPONS, ['bow', 'staff', 'club']);
  for (const id of CLASS_WEAPONS) assert.ok(!CARD_IDS.includes(id));
  const S = { ...newOfferState(), weapons: [{ id: 'bow', lv: 1, evo: false }], passives: {} };
  for (const c of candidates(S)) assert.ok(!(c.k === 'newW' && CLASS_WEAPONS.includes(c.id)));
  // Bogen hat noch eine Stufe offen: steigt von selbst (auto), also keine Aufwertungs-Karte
  assert.ok(!candidates(S).some(c => c.id === 'bow'));
  assert.equal(weaponOf('oil'), 'saw'); assert.equal(weaponOf('oil', ['bow']), 'bow'); assert.equal(weaponOf('oil', ['dagger']), 'saw');
});

test('Klassen-Boni nach Klassen-Level', async () => {
  const { hasPerk, CLASSES, classUnlocked } = await import('../src/data/classes.js');
  assert.ok(!hasPerk(2, 'hp') && hasPerk(3, 'hp') && hasPerk(5, 'start2') && !hasPerk(11, 'charge') && hasPerk(12, 'charge'));
  assert.ok(classUnlocked('gob', () => false));
  assert.ok(!classUnlocked('bow', () => false) && classUnlocked('bow', i => i === 1));
  assert.ok(!classUnlocked('war', i => i < 5) && classUnlocked('war', i => i === 5));
  for (const id in CLASSES) assert.ok(WEAPONS[CLASSES[id].weapon], id);
});
