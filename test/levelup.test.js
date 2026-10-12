import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/rng.js';
import { WEAPONS } from '../src/data/weapons.js';
import { PITY_MAX, candidates, canBan, drawOffer, itemKey, newOfferState, pityPassives, replaceCard, settleOffer } from '../src/game/offer.js';

// Wendet eine Karte auf den Testzustand an (wie applyChoice, nur ohne Lauf)
function apply(S, c) {
  if (c.k === 'newW') S.weapons.push({ id: c.id, lv: 1, evo: false });
  else if (c.k === 'upW') S.weapons.find(w => w.id === c.id).lv++;
  else if (c.k === 'evo') S.weapons.find(w => w.id === c.id).evo = true;
  else if (c.k === 'newP' || c.k === 'upP') S.passives[c.id] = (S.passives[c.id] || 0) + 1;
}

// Prüft eine Auswahl gegen die Regeln aus PLAN 7.2. Gibt den Grund zurück, falls eine Regel verletzt ist.
function check(S, offer, n) {
  const keys = offer.map(itemKey), pool = candidates(S), slotsFor = why => offer.filter(c => c.why === 'lock' || c.why === 'evo' || why.includes(c.why)).length < n;
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
    const S = { ...newOfferState(), weapons: [{ id: 'dagger', lv: 2, evo: false }, { id: 'saw', lv: 2, evo: false }, { id: 'bolt', lv: 2, evo: false }], passives: { whet: 1, oil: 1 } };
    for (const c of drawOffer(S, r)) if (c.why === 'rest') { if (c.k === 'upW' || c.k === 'upP') own++; else fresh++; }
  }
  // ohne Faktor wären es ~21 % (eigene Waffen 4, Passive 3 wie neue), mit ×2,5 ~40 %
  assert.ok(own / (own + fresh) > .35, `Anteil eigener ${(own / (own + fresh)).toFixed(2)}`);
});
