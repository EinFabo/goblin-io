// Elite-Eigenschaften (Plan 5.4). Ab Stage 3 eine, in der Endlosen Nacht und ab Schleife 2 zwei.
import { RNG, frand } from '../core/rng.js';
import { ETYPES } from '../data/enemies.js';
import { addHaz } from './hazards.js';
import { part, ring } from './fx.js';
import { run } from './state.js';

export const AFFIXES = {
  fast: { name: 'Schnell' },
  armored: { name: 'Gepanzert' },
  vampiric: { name: 'Vampirisch' },
  splitting: { name: 'Teilend' },
  explosive: { name: 'Explosiv' },
  shielder: { name: 'Schildträger' },
  summoner: { name: 'Beschwörer' },
};
export const hasAffix = (e, a) => !!(e.affixes && e.affixes.includes(a));
// Albtraum-Modus (6.1): Elites immer mit 2 Eigenschaften
export const affixCount = () => (run.nm || run.st.endless || run.loop > 0 ? 2 : run.si >= 2 ? 1 : 0);

export function rollAffixes(e, n) {
  if (n === undefined) n = affixCount();
  const pool = Object.keys(AFFIXES), out = [];
  while (out.length < n) { const a = RNG.spawn.pick(pool); if (!out.includes(a)) out.push(a); }
  e.affixes = out;
  if (hasAffix(e, 'fast')) e.spd *= 1.5;
  if (hasAffix(e, 'shielder')) { e.plateT = 2; e.plates = 0; }
  if (hasAffix(e, 'summoner')) e.summonT = 3;
  return out;
}
export const affixNames = e => (e.affixes || []).map(a => AFFIXES[a].name).join(', ');

// Lehrling derselben Schule (für Beschwörer)
const apprenticeOf = school => Object.keys(ETYPES).find(t => ETYPES[t].school === school && ETYPES[t].role === 'apprentice') || 'frost_apprentice';

export function updAffixes(e, dt, spawn) {
  if (hasAffix(e, 'shielder') && e.plates <= 0) {
    e.plateT -= dt;
    if (e.plateT <= 0) { e.plates = 3; e.plateT = 8; ring(e.x, e.y - 10, 10, 50 * e.sc, .4, 'rgba(220,230,255,.9)', 4); }
  }
  if (hasAffix(e, 'summoner')) {
    e.summonT -= dt;
    if (e.summonT <= 0 && run.enemies.length < 260) {
      e.summonT = 6;
      for (const s of [-1, 1]) spawn(apprenticeOf(e.school), { x: e.x + s * 40, y: e.y + 30 }).spawnT = .5;
      ring(e.x, e.y + 20, 10, 60, .5, 'rgba(180,120,255,.85)', 4);
    }
  }
  if (hasAffix(e, 'vampiric') && Math.random() < dt * 6) part(e.x + frand(-14, 14) * e.sc, e.y + frand(-30, 10) * e.sc, 0, -40, .5, 'rgba(230,30,50,.85)', 3);
}

// vor dem Schaden: Schildplatten fangen ganze Treffer, Panzer dämpft Geschosse
export function affixDamage(e, dmg, kx, ky) {
  if (e.plates > 0) { e.plates--; if (e.plates <= 0) ring(e.x, e.y - 10, 10, 40 * e.sc, .3, 'rgba(220,230,255,.9)', 4); return 0; }
  if (hasAffix(e, 'armored') && (kx || ky)) dmg *= .6;
  return dmg;
}
// Vampirisch: heilt sich um ein Vielfaches des Schadens am Goblin
export function affixOnHitPlayer(e, dmg) {
  if (e && !e.dead && hasAffix(e, 'vampiric')) e.hp = Math.min(e.maxHp, e.hp + Math.max(dmg * 4, e.maxHp * .04));
}
export function affixOnDeath(e, spawn) {
  if (hasAffix(e, 'splitting')) {
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const o = spawn(e.type, { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30, mini: true }); o.spawnT = .3; o.traits = null; }
  }
  if (hasAffix(e, 'explosive')) addHaz({ shape: 'circle', x: e.x, y: e.y, r: 95, warn: 1, dmg: e.dmg * 1.6, kind: 'fire', src: 'bomb', boom: true });
}
