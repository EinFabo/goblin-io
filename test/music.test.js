import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCALES, THEMES, chordOf, melNote } from '../src/core/music.js';
import { STAGES } from '../src/data/stages.js';
import { BOSS_IDS } from '../src/data/bosses.js';

const inScale = (T, semi) => SCALES[T.scale].includes(((semi % 12) + 12) % 12);

test('Jede Welt und jeder Boss hat ein Stück', () => {
  for (const st of STAGES) assert.ok(THEMES[st.music], st.name);
  for (const id of BOSS_IDS) assert.ok(THEMES[id], id);
});

test('Melodien liegen in der Tonleiter, schwere Zählzeiten auf Akkordtönen', () => {
  for (const [name, T] of Object.entries(THEMES)) for (let bar = 0; bar < 4; bar++) {
    const ch = chordOf(T, bar).map(c => ((c % 12) + 12) % 12);
    for (const c of chordOf(T, bar)) assert.ok(inScale(T, c), `${name} Akkord ${bar}`);
    for (let s = 0; s < 16; s++) {
      const n = melNote(T, bar, s); if (n === null) continue;
      assert.ok(inScale(T, n), `${name} Takt ${bar} Schritt ${s}: ${n} nicht in der Tonleiter`);
      if (s % 4 === 0) assert.ok(ch.includes(((n % 12) + 12) % 12), `${name} Takt ${bar} Schritt ${s}: kein Akkordton`);
    }
  }
});
