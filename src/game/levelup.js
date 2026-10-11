import { RNG } from '../core/rng.js';
import { PASSIVES, WEAPONS } from '../data/weapons.js';
import { addWeapon, recalc } from './run.js';
import { P, run } from './state.js';
import { banner, refreshSlots } from '../ui/hud.js';

// ---------- Level-Up ----------
export function genChoices() {
  const pool = [], owned = new Set(run.weapons.map(w => w.id));
  for (const w of run.weapons) {
    const D = WEAPONS[w.id];
    if (!w.evo && w.lv >= 5 && run.passives[D.with]) pool.push({ k: 'evo', id: w.id, wgt: 1000 });
    else if (w.lv < 5) pool.push({ k: 'upW', id: w.id, wgt: 10 });
  }
  if (run.weapons.length < 6) for (const id in WEAPONS) if (!owned.has(id)) pool.push({ k: 'newW', id, wgt: 6 });
  const pc = Object.keys(run.passives).length;
  for (const id in PASSIVES) {
    const lv = run.passives[id] || 0;
    if (lv > 0 && lv < 5) pool.push({ k: 'upP', id, wgt: 8 });
    else if (lv === 0 && pc < 6) pool.push({ k: 'newP', id, wgt: 4 });
  }
  const out = [];
  while (out.length < 3 && pool.length) {
    let tot = 0; for (const p of pool) tot += p.wgt;
    let r = RNG.lvl.next() * tot, i = 0;
    for (; i < pool.length; i++) { r -= pool[i].wgt; if (r <= 0) break; }
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  if (out.length < 3) { out.push({ k: 'heal' }); if (out.length < 3) out.push({ k: 'gold' }); }
  return out.slice(0, 3);
}

export function applyChoice(c) {
  if (c.k === 'newW') addWeapon(c.id);
  else if (c.k === 'upW') run.weapons.find(w => w.id === c.id).lv++;
  else if (c.k === 'evo') { run.weapons.find(w => w.id === c.id).evo = true; banner(WEAPONS[c.id].evo + '!', ''); }
  else if (c.k === 'newP' || c.k === 'upP') run.passives[c.id] = (run.passives[c.id] || 0) + 1;
  else if (c.k === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .4);
  else if (c.k === 'gold') run.gold += 25;
  recalc(); refreshSlots();
}
