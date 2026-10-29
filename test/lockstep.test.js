import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELAY, HASH_EVERY, NO_INPUT, WAIT_GIVEUP, createLockstep, pack, unpack } from '../src/net/lockstep.js';
import { mulberry32 } from '../src/core/rng.js';

// Zwei Teilnehmer mit einer Verbindung, die Nachrichten nach lag(rnd) Bildern zustellt (Reihenfolge kann sich ändern).
// Die „Sim“ mischt die Eingaben beider Goblins in einen Zustand; gleiche Folge → gleicher Zustand.
function pair({ lag = () => 3, seed = 1, delay = DELAY, script = (i, f) => ({ ...NO_INPUT, mx: Math.sin(f / 7 + i + 1), dash: f % 11 === i }), desyncAt = -1 } = {}) {
  const rnd = mulberry32(seed), queue = [], sides = [];
  let frame = 0;
  for (const me of [0, 1]) {
    const side = { state: 0, ticks: 0, seen: [], waits: 0, desync: null, gone: false, handler: null };
    const link = { send: msg => queue.push({ to: 1 - me, at: frame + lag(rnd), msg: JSON.parse(JSON.stringify(msg)) }), onMessage: fn => { side.handler = fn; } };
    side.ls = createLockstep({
      me, link, delay,
      take: () => script(me, frame),
      tick: (step, inps) => {
        side.ticks++;
        side.seen.push(JSON.stringify(inps));
        for (const i of inps) side.state = (Math.imul(side.state ^ Math.round(i.mx * 100 + 300), 16777619) ^ (i.dash ? 7 : 0)) >>> 0;
        if (me === 1 && side.ticks === desyncAt) side.state ^= 1;   // absichtlich abweichen
      },
      hash: () => side.state,
      onWait: s => { if (s > 0) side.waits++; },
      onDesync: t => { side.desync = t; },
      onGone: () => { side.gone = true; },
    });
    sides.push(side);
  }
  const deliver = () => {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= frame) { const m = queue.splice(i, 1)[0]; sides[m.to].handler(m.msg); }
  };
  const run = (n, active = [true, true]) => { for (let f = 0; f < n; f++, frame++) { deliver(); sides.forEach((s, i) => { if (active[i]) s.ls.frame(1 / 60); }); } };
  return { sides, run };
}

test('pack/unpack: Knöpfe und gerundete Richtung kommen gleich an', () => {
  const i = { mx: .123456, my: -1, sprint: true, dash: false, ab0: true, ab1: false, skip: true, pick: 2 };
  const a = JSON.parse(JSON.stringify(pack(5, i)));
  assert.deepEqual(unpack(a), { ...i, mx: .12 });
  assert.equal(a[0], 5);
});

test('gleiche Eingaben in gleicher Reihenfolge auf beiden Seiten, auch bei schwankender Verzögerung', () => {
  const { sides, run } = pair({ lag: r => 1 + Math.floor(r() * 8) });
  run(2000);
  const [a, b] = sides;
  const n = Math.min(a.ticks, b.ticks);
  assert.ok(n > 1000, `nur ${n} Ticks`);
  assert.deepEqual(a.seen.slice(0, n), b.seen.slice(0, n));
  assert.equal(a.desync, null); assert.equal(b.desync, null);
  // die ersten DELAY Ticks stehen beide
  assert.equal(a.seen[0], JSON.stringify([NO_INPUT, NO_INPUT]));
});

test('Vorlauf deckt die Verzögerung: kein Warten, volle Geschwindigkeit', () => {
  const { sides, run } = pair({ lag: r => 1 + Math.floor(r() * 8), delay: 9 });
  run(1200);
  assert.equal(sides[0].waits, 0); assert.equal(sides[1].waits, 0);
  assert.ok(sides[0].ticks >= 1195);
});

test('geringe Verzögerung: kaum Warten', () => {
  const { sides, run } = pair({ lag: () => 2 });
  run(600);
  assert.ok(sides[0].ticks >= 590);
  assert.equal(sides[0].waits, 0);
});

test('große Verzögerung: die Sim wartet, läuft aber gleich', () => {
  const { sides, run } = pair({ lag: () => 12 });
  run(600);
  assert.ok(sides[0].waits > 0);
  const n = Math.min(sides[0].ticks, sides[1].ticks);
  assert.deepEqual(sides[0].seen.slice(0, n), sides[1].seen.slice(0, n));
});

test('abweichende Prüfsumme wird erkannt', () => {
  const { sides, run } = pair({ desyncAt: 100 });
  run(400);
  assert.equal(sides[0].desync, HASH_EVERY * 2);
  assert.equal(sides[1].desync, HASH_EVERY * 2);
});

test(`Partner schweigt: nach ${WAIT_GIVEUP} s allein weiter`, () => {
  const { sides, run } = pair();
  run(300);
  const t0 = sides[0].ticks;
  run(WAIT_GIVEUP * 60 + 10, [true, false]);
  assert.ok(sides[0].gone);
  run(120, [true, false]);
  assert.ok(sides[0].ticks > t0 + 100, 'läuft allein weiter');
});

test('Abschied: Partner spielt sofort allein weiter', () => {
  const { sides, run } = pair();
  run(200);
  sides[1].ls.bye();
  run(10);
  assert.ok(sides[0].gone);
  const t0 = sides[0].ticks;
  run(60, [true, false]);
  assert.ok(sides[0].ticks >= t0 + 59);
});

test(`Eingaben für die ersten ${DELAY} Ticks sind leer, danach kommt die eigene an`, () => {
  const { sides, run } = pair({ lag: () => 1 });
  run(DELAY + 3);
  const s = sides[0].seen.map(x => JSON.parse(x));
  assert.equal(s[DELAY - 1][0].mx, 0);
  assert.notEqual(s[DELAY][0].mx, 0);
});
