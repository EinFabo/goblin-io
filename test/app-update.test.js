import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newer } from '../src/app-update.js';

test('Versionsvergleich für das App-Update', () => {
  assert.equal(newer('v3.0.10', '3.0.9'), true);
  assert.equal(newer('3.1.0', '3.0.99'), true);
  assert.equal(newer('v3.0.0', '3.0.0'), false);
  assert.equal(newer('2.9.9', '3.0.0'), false);
});
