import { test } from 'node:test';
import assert from 'node:assert/strict';

// Schleife ohne Browser: requestAnimationFrame von Hand weiterdrehen
let pending = null, now = 0;
globalThis.requestAnimationFrame = f => { pending = f; };
globalThis.performance = { now: () => now };
const { defineScene, go } = await import('../src/core/scenes.js');
const { startLoop } = await import('../src/core/loop.js');

function tick(ms) { now += ms; const f = pending; pending = null; f(now); }

test('Szenenwechsel mitten im Frame (Tod im Lauf) hält die Schleife nicht an', () => {
  let steps = 0, renders = 0;
  defineScene('a', { update() { steps++; if (steps === 1) go('b'); } });
  defineScene('b', { render() { renders++; } });   // wie „results“: kein update
  go('a');
  startLoop();
  tick(100);   // mehrere Schritte in einem Frame, der erste wechselt die Szene
  assert.equal(steps, 1);
  assert.equal(renders, 1);
  assert.ok(pending, 'nächster Frame ist angemeldet');
  tick(16);
  assert.equal(renders, 2);
});
