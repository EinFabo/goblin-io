import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, DEFAULT_KEYS, bindKey, cleanDevice, dev, keyName, resetKeys } from '../src/core/device.js';

test('cleanDevice: Unsinn fällt auf Standard zurück, gültige Werte bleiben', () => {
  const d = cleanDevice({ master: 7, uiVol: -1, render: .6, fps: 30, uiScale: 9, joy: 'quer', btnAlpha: .5, keys: { dash: ['Escape', 'KeyX'], up: [null, null], ab0: 'KeyQ' }, vibrate: 'ja' });
  assert.equal(d.master, 1); assert.equal(d.uiVol, 0); assert.equal(d.render, 1); assert.equal(d.fps, 30);
  assert.equal(d.uiScale, 1.5); assert.equal(d.joy, 'free'); assert.equal(d.btnAlpha, .5); assert.equal(d.vibrate, true);
  assert.deepEqual(d.keys.dash, [null, 'KeyX']);             // Esc ist fest der Pause vorbehalten
  assert.deepEqual(d.keys.up, DEFAULT_KEYS.up);              // ganz ohne Taste ginge die Aktion nicht
  assert.deepEqual(d.keys.ab0, DEFAULT_KEYS.ab0);
  for (const [a] of ACTIONS) assert.equal(d.keys[a].length, 2);
  assert.deepEqual(cleanDevice(null), cleanDevice({}));
});

test('bindKey: eine Taste gehört nur einer Aktion', () => {
  resetKeys();
  bindKey('dash', 0, 'KeyQ');                                 // Q war Fähigkeit 1 → sie bekommt die Leertaste (Tausch)
  assert.equal(dev.keys.dash[0], 'KeyQ'); assert.equal(dev.keys.ab0[0], 'Space');
  const all = Object.values(dev.keys).flat().filter(Boolean);
  assert.equal(new Set(all).size, all.length, 'keine Taste doppelt');
  bindKey('sprint', 1, null);
  assert.equal(dev.keys.sprint[1], null);
  assert.equal(bindKey('sprint', 0, null), false, 'letzte Taste bleibt');
  assert.equal(dev.keys.sprint[0], 'ShiftLeft');
  resetKeys();
  assert.deepEqual(dev.keys, DEFAULT_KEYS);
});

test('keyName: lesbare Namen', () => {
  assert.equal(keyName('Space'), 'Leer'); assert.equal(keyName('KeyQ'), 'Q'); assert.equal(keyName('Digit3'), '3');
  assert.equal(keyName('ArrowUp'), '↑'); assert.equal(keyName(null), '–');
});
