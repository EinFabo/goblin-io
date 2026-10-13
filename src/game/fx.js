import { ECOL } from '../data/enemies.js';
import { RNG, frand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU } from '../core/util.js';
import { hurt } from './combat.js';
import { query, run } from './state.js';

// ---------- Gegenstände & Effekte ----------
export function dropGem(x, y, v) {
  let n = 0; for (const i of run.items) if (i.k === 'gem') n++;
  if (n > 380) { for (const i of run.items) if (i.k === 'gem' && RNG.loot.next() < .05) { i.v += v; return; } }
  addItem('gem', x, y, v);
}
export function addItem(k, x, y, v = 1) {
  const a = RNG.loot.next() * TAU, s = k === 'chest' ? RNG.loot.range(0, 20) : RNG.loot.range(40, 130);
  run.items.push({ k, x, y, v, mag: false, sp: 0, t: Math.random() * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, z: .01, vz: RNG.loot.range(170, 260) });
}
export function addNum(x, y, v, c, crit) { if (run.nums.length > 90) run.nums.shift(); run.nums.push({ x: x + frand(-8, 8), y, v, c, crit, t: 0 }); }
export function part(x, y, vx, vy, life, c, s) { if (run.parts.length > 600) return; run.parts.push({ x, y, vx, vy, t: 0, life, c, s }); }
export function puff(x, y, sc = 1, col = null) { for (let i = 0; i < 7; i++) part(x + frand(-10, 10) * sc, y + frand(-12, 8) * sc, frand(-40, 40), frand(-60, -10), frand(.35, .6), col || (i % 2 ? 'rgba(170,140,220,.75)' : 'rgba(230,230,230,.75)'), frand(5, 9) * sc); }
export function animFx(pre, n, x, y, sc = 1, fps = 18, rot = 0) { run.fx.push({ k: 'anim', pre, n, x, y, sc, fps, rot, t: 0 }); }
export function ring(x, y, r0, r1, dur, c, w = 4) { run.fx.push({ k: 'ring', x, y, r0, r1, dur, c, w, t: 0 }); }
export function boltFx(x0, y0, x1, y1, w = 3, col = null) {
  const pts = [[x0, y0]], n = 7;
  for (let i = 1; i < n; i++) { const p = i / n; pts.push([x0 + (x1 - x0) * p + frand(-14, 14), y0 + (y1 - y0) * p + frand(-8, 8)]); }
  pts.push([x1, y1]);
  run.fx.push({ k: 'bolt', pts, dur: .22, t: 0, w, col });
}
export function explode(x, y, rad, dmg, kind = 'fire') {
  query(x, y, rad, e => { const d = Math.hypot(e.x - x, e.y - y) || 1; hurt(e, dmg, 160, (e.x - x) / d, (e.y - y) / d, kind === 'fire' ? '#ffb35c' : null); });
  animFx(kind === 'fire' ? 'f_fireball_hit_' : 'e_frostbolt_hit_', 5, x, y, rad / 18);
  sfx.boom();
}

// Gegner löst sich in seiner Schulfarbe auf
export function dissolve(e) {
  const col = ECOL[e.boss ? 'boss' : e.type] || '#ffffff';
  // Immer das erste Stand-Bild der Blickrichtung: so braucht eine Gegnerart nur wenige getönte Bilder
  // statt eines je Animationsbild, die sonst mitten im Kampf erzeugt würden
  const spr = (e.spr || e.pre + '.idle.down.1').replace(/\.(idle|walk|cast)\.(\w+)\.\d+$/, '.idle.$2.1');
  run.fx.push({ k: 'dissolve', spr, x: e.x, y: e.y, sc: e.sc, col, t: 0, dur: .45 });
  for (let i = 0; i < 8; i++) part(e.x + frand(-12, 12) * e.sc, e.y + frand(-22, 10) * e.sc, frand(-30, 30), frand(-90, -30), frand(.4, .7), col, frand(3, 6) * Math.min(e.sc, 1.6));
}
