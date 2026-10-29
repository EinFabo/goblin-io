// Koop-Raum (src/room.js) mit nachgebautem Durable-Object-Kontext: Speicher, Sockets mit Anhang, Hibernation
// (der Raum wird zwischendurch neu erzeugt und darf dabei nichts vergessen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, ROOM_TTL, newCode, validCode } from '../src/room.js';

function fakeCtx() {
  const data = new Map(), socks = [];
  let alarm = null;
  return {
    data, socks, get alarm() { return alarm; },
    acceptWebSocket(ws) { socks.push(ws); },
    getWebSockets() { return socks.filter(s => !s.closed); },
    storage: {
      async get(k) { return data.has(k) ? structuredClone(data.get(k)) : undefined; },
      async put(k, v) { data.set(k, structuredClone(v)); },
      async delete(k) { data.delete(k); },
      async deleteAll() { data.clear(); },
      async setAlarm(t) { alarm = t; },
      async deleteAlarm() { alarm = null; },
    },
  };
}
function fakeWs() {
  let att = null;
  return {
    got: [], closed: false,
    send(s) { this.got.push(JSON.parse(s)); },
    close() { this.closed = true; },
    serializeAttachment(a) { att = structuredClone(a); },
    deserializeAttachment() { return att; },
    last(k) { return [...this.got].reverse().find(m => m.k === k); },
  };
}
const prof = name => ({ name, cls: 'gob', clsLv: 3, talents: {} });
// Raum neu aus demselben Kontext (wie nach dem Aufwachen aus der Hibernation)
const wake = ctx => new Room(ctx, {});
async function setup() {
  const ctx = fakeCtx();
  assert.equal(await wake(ctx).create('3.0.6'), true);
  const a = fakeWs(), b = fakeWs();
  await wake(ctx).join(a); await wake(ctx).webSocketMessage(a, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Anna') }));
  await wake(ctx).join(b); await wake(ctx).webSocketMessage(b, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Bert') }));
  return { ctx, a, b };
}

test('Codes: 4 Buchstaben ohne I und O', () => {
  for (let i = 0; i < 200; i++) assert.ok(validCode(newCode()));
  assert.equal(validCode('ABIO'), false); assert.equal(validCode('abcd'), false); assert.equal(validCode('ABCDE'), false);
});

test('Anlegen: frei nur einmal, Verfall nach 30 min geplant', async () => {
  const ctx = fakeCtx();
  assert.equal(await wake(ctx).create('3.0.6'), true);
  assert.equal(await wake(ctx).create('3.0.6'), false);
  assert.ok(ctx.alarm > Date.now() + ROOM_TTL - 5000);
});

test('Zwei Spieler: Plätze 0 und 1, beide sehen beide', async () => {
  const { a, b } = await setup();
  assert.equal(a.last('room').you, 0); assert.equal(b.last('room').you, 1);
  assert.deepEqual(b.last('room').players.map(p => p.name), ['Anna', 'Bert']);
});

test('Dritter Spieler: voll', async () => {
  const { ctx } = await setup();
  const c = fakeWs();
  await wake(ctx).join(c); await wake(ctx).webSocketMessage(c, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Carl') }));
  assert.equal(c.last('err').why, 'full'); assert.ok(c.closed);
});

test('Andere Spielversion wird abgewiesen', async () => {
  const ctx = fakeCtx(); await wake(ctx).create('3.0.6');
  const c = fakeWs();
  await wake(ctx).join(c); await wake(ctx).webSocketMessage(c, JSON.stringify({ k: 'hello', v: '3.0.5', prof: prof('Alt') }));
  assert.deepEqual(c.last('err'), { k: 'err', why: 'version', need: '3.0.6' });
});

test('Unbekannter Code: Fehler nf', async () => {
  const ctx = fakeCtx(), c = fakeWs();
  await wake(ctx).join(c);
  assert.equal(c.last('err').why, 'nf');
});

test('Nur Platz 0 startet, und nur zu zweit; Start bringt beide Profile und den eigenen Platz', async () => {
  const ctx = fakeCtx(); await wake(ctx).create('3.0.6');
  const a = fakeWs(); await wake(ctx).join(a); await wake(ctx).webSocketMessage(a, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Anna') }));
  await wake(ctx).webSocketMessage(a, JSON.stringify({ k: 'start', si: 1, li: 2, seed: 7, delay: 5 }));
  assert.equal(a.last('err').why, 'alone');
  const b = fakeWs(); await wake(ctx).join(b); await wake(ctx).webSocketMessage(b, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Bert') }));
  await wake(ctx).webSocketMessage(b, JSON.stringify({ k: 'start', si: 1, li: 2, seed: 7, delay: 5 }));
  assert.equal(b.last('start'), undefined);   // Gast darf nicht starten
  await wake(ctx).webSocketMessage(a, JSON.stringify({ k: 'start', si: 1, li: 2, nm: 0, seed: 7, delay: 5 }));
  const sa = a.last('start'), sb = b.last('start');
  assert.equal(sa.me, 0); assert.equal(sb.me, 1);
  assert.deepEqual(sa.profs.map(p => p.name), ['Anna', 'Bert']);
  assert.equal(sa.seed, 7); assert.equal(sa.delay, 5); assert.equal(sb.li, 2);
  // gestartet: niemand kommt mehr dazu
  const c = fakeWs(); await wake(ctx).join(c); await wake(ctx).webSocketMessage(c, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Carl') }));
  assert.equal(c.last('err').why, 'started');
});

test('Eingaben gehen unverändert nur zum Partner', async () => {
  const { ctx, a, b } = await setup();
  const raw = JSON.stringify({ k: 'in', a: [5, .5, -1, 3, -1] });
  await wake(ctx).webSocketMessage(a, raw);
  assert.deepEqual(b.last('in'), JSON.parse(raw));
  assert.equal(a.last('in'), undefined);
});

test('Ping und Rundlaufzeit: pong an den Fragenden, Ping erscheint in der Liste', async () => {
  const { ctx, a, b } = await setup();
  await wake(ctx).webSocketMessage(a, JSON.stringify({ k: 'ping', t: 123 }));
  assert.deepEqual(a.last('pong'), { k: 'pong', t: 123 });
  await wake(ctx).webSocketMessage(b, JSON.stringify({ k: 'rtt', ms: 4 }));
  assert.equal(a.last('room').players[1].rtt, 4);   // erste Messung zählt auch, wenn sie klein ist
  await wake(ctx).webSocketMessage(b, JSON.stringify({ k: 'rtt', ms: 84 }));
  assert.equal(a.last('room').players[1].rtt, 84);
});

test('Partner geht: der andere erfährt es; in der Lobby wird der Platz frei', async () => {
  const { ctx, a, b } = await setup();
  b.closed = true; await wake(ctx).webSocketClose(b);
  assert.deepEqual(a.last('left'), { k: 'left', slot: 1 });
  assert.equal(a.last('room').players.length, 1);
  assert.equal(ctx.data.has('prof:1'), false);
  const c = fakeWs(); await wake(ctx).join(c); await wake(ctx).webSocketMessage(c, JSON.stringify({ k: 'hello', v: '3.0.6', prof: prof('Carl') }));
  assert.equal(c.last('room').you, 1);
});

test('Nach dem Spiel: gehen beide, ist der Raum weg; Verfall räumt leere Räume', async () => {
  const { ctx, a, b } = await setup();
  await wake(ctx).webSocketMessage(a, JSON.stringify({ k: 'start', si: 0, li: 0, seed: 1, delay: 4 }));
  a.closed = true; await wake(ctx).webSocketClose(a);
  assert.ok(ctx.data.has('meta'));
  b.closed = true; await wake(ctx).webSocketClose(b);
  assert.equal(ctx.data.size, 0); assert.equal(ctx.alarm, null);
  const ctx2 = fakeCtx(); await wake(ctx2).create('3.0.6');
  await wake(ctx2).alarm();
  assert.equal(ctx2.data.size, 0);
});

test('Kaputte Nachrichten: Fehler bad, Socket zu', async () => {
  const { ctx, a } = await setup();
  await wake(ctx).webSocketMessage(a, '{kaputt');
  assert.equal(a.last('err').why, 'bad'); assert.ok(a.closed);
});
