// Belastungstest (PLAN 12.3: ≥ 55 FPS mit 300 Gegnern): startet einen Lauf mit starkem Build,
// hält den Goblin unverwundbar und füllt die Gegner immer wieder auf n auf. Misst nach 2 s Anlauf
// die Bildrate und wie lange Logik und Zeichnen je Frame brauchen. Der Lauf wird nicht gewertet
// (zurück ins Menü ohne Ergebnis, nichts landet im Spielstand).
// Genutzt von ?perf (Knopf „Test 300 Gegner“) und von npm run perf (GOBLIN.stress).
import { joy } from './core/input.js';
import { loopStats } from './core/loop.js';
import { go } from './core/scenes.js';
import { STAGES } from './data/stages.js';
import { ETYPES } from './data/enemies.js';
import { spawnEnemy } from './game/enemies.js';
import { choose, genChoices } from './game/levelup.js';
import { P, run } from './game/state.js';
import { ensureStage, rushing } from './render/sprites.js';
import { $ } from './core/util.js';
import { RNG } from './core/rng.js';

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0; };
const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

export async function stressTest({ si = 7, li = 2, n = 300, secs = 10, warm = 2 } = {}) {
  await rushing(ensureStage(si));
  go('run', { si, li, seed: 7 });
  run.paused = true;
  for (let i = 0; i < 22; i++) choose(genChoices(), 0);   // Spät-Build: viele Waffen und Geschosse
  run.paused = false;
  const types = [...new Set(STAGES[si].waves.flatMap(w => (w.mix ? Object.keys(w.mix) : [])))].filter(t => ETYPES[t] && !ETYPES[t].draw);
  const fr = [];
  return new Promise(resolve => {
    let last = 0, a = 0, k = 0;
    const t0 = performance.now(), from = t0 + warm * 1000, end = from + secs * 1000;
    const tick = now => {
      if (!run || run.over) { joy.id = null; resolve(null); return; }
      // Fokusverlust (blur → Pause) oder ein Kartenfenster: weiterspielen
      if (run.paused) { run.paused = false; $('#pause').hidden = true; $('#levelup').hidden = true; }
      P.inv = 9; P.hp = P.maxHp; run.pendingLv = 0; run.pendingChest = 0; run.lvDelay = 0; run.clearT = 0;
      if (run.time > 60) run.time = 60;   // nicht ins Level-Ende laufen
      // Im Kreis laufen, damit sich Gegner und Kamera bewegen
      a += .02; joy.id = 'stress'; joy.ox = 0; joy.oy = 0; joy.x = Math.cos(a) * 40; joy.y = Math.sin(a) * 40;
      let alive = 0; for (const e of run.enemies) if (!e.dead) alive++;
      for (; alive < n; alive++) {
        const ang = RNG.spawn.next() * Math.PI * 2, R = 120 + RNG.spawn.next() * 420;   // Seed-Zufall: gleiche Läufe, vergleichbare Messungen
        spawnEnemy(types[k++ % types.length], { x: P.x + Math.cos(ang) * R, y: P.y + Math.sin(ang) * R, portal: false });
      }
      if (now >= from) {
        if (last) fr.push({ gap: now - last, upd: loopStats.upd, ren: loopStats.ren, steps: loopStats.steps, n: run.enemies.length });
        last = now;
      }
      if (now >= end) {
        joy.id = null;
        const gaps = fr.map(f => f.gap), steps = fr.reduce((s, f) => s + f.steps, 0) || 1;
        const res = {
          fps: 1000 / avg(gaps), p50: q(gaps, .5), p95: q(gaps, .95), p99: q(gaps, .99), slow: gaps.filter(g => g > 25).length / (gaps.length || 1),
          upd: avg(fr.map(f => f.upd)), updStep: fr.reduce((s, f) => s + f.upd, 0) / steps, ren: avg(fr.map(f => f.ren)),
          updMax: Math.max(0, ...fr.map(f => f.upd)), renMax: Math.max(0, ...fr.map(f => f.ren)), enemies: avg(fr.map(f => f.n)),
        };
        run.over = true; run.paused = true;   // ohne endRun: kein Ergebnis, nichts im Spielstand
        go('menu');
        resolve(res);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
