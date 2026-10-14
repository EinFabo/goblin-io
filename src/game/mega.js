// ---------- Mega-Entwicklungen (Wunsch Fabi 2026-10-14) ----------
// Zwei passende Entwicklungen verschmelzen über eine Truhe von Elite, Mini-Boss oder Boss (items.js).
// Beide Waffen bleiben (je +30 % Schaden), dazu kommt alle paar Sekunden ein eigener großer Angriff.
// Logik nur mit Seed-Zufall; die Animation (ui/mega-fx.js) ist rein optisch.
import { frand, pick, rand, rnd } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU } from '../core/util.js';
import { MEGAS } from '../data/weapons.js';
import { hurt } from './combat.js';
import { boltFx, later, part, ring } from './fx.js';
import { count } from './progress.js';
import { P, query, randomEnemyInView, run } from './state.js';
import { shootRaw } from './weapons.js';
import { wave } from './weapons2.js';
import { banner, refreshSlots } from '../ui/hud.js';
import { playMega } from '../ui/mega-fx.js';

export const MEGA_BOOST = 1.3;
// Welche Mega ist bereit (beide Waffen entwickelt, noch nicht verschmolzen)?
export function megaReady() {
  for (const id in MEGAS) {
    const ws = MEGAS[id].of.map(k => run.weapons.find(w => w.id === k));
    if (ws.every(w => w && w.evo && !w.mega)) return id;
  }
  return null;
}
export function fuseMega(id) {
  for (const k of MEGAS[id].of) { const w = run.weapons.find(x => x.id === k); w.mega = id; w.card *= MEGA_BOOST; }
  run.megas.push({ id, t: 1.5 });
  count(run, 'mega');
  banner('MEGA: ' + MEGAS[id].name + '!', 'mega');
  sfx.chest();
  ring(P.x, P.y - 8, 10, 260, .7, MEGAS[id].col, 12);
  refreshSlots();
  playMega(id);
}

const dmOf = m => P.dmgMult * Math.max(...MEGAS[m.id].of.map(k => (run.weapons.find(w => w.id === k) || { card: 1 }).card));
const CD = { apocalypse: 2.5, tornado: 3, comet: 3.2, worldstorm: 1.6, plague: 4, avalanche: 2.2, armageddon: 4, warmachine: 2.5, ghosthorde: 1.4, eclipse: 6 };

export function updMegas(dt) {
  const rate = (P.rageT > 0 ? 1.6 : 1) * (P.atkSpd || 1);
  for (const m of run.megas) {
    m.t -= dt * rate; if (m.t > 0) continue;
    m.t = CD[m.id] * P.cdMult;
    fire(m.id, dmOf(m));
  }
}

function fire(id, dm) {
  const c = randomEnemyInView(20), target = () => (c.length ? pick(c) : null);
  switch (id) {
    case 'apocalypse':
      for (let i = 0; i < 24; i++) shootRaw('star', i * TAU / 24 + rnd() * .1, 40 * dm, 99, 520 * P.proj, 1.2, { sc: 2.4, r: 26 });
      for (let i = 0; i < 12; i++) shootRaw('dagger', i * TAU / 12, 30 * dm, 99, 640 * P.proj, 1, {});
      sfx.throw(); break;
    case 'tornado':
      wave(P.x, P.y, 300 * P.area, 50 * dm * (P.aoeMult || 1), 420, '#c9a35a');
      later(.25, () => wave(P.x, P.y, 220 * P.area, 30 * dm * (P.aoeMult || 1), 300, '#c9a35a'));
      break;
    case 'comet': {
      const e = target(), x = e ? e.x : P.x + rand(-200, 200), y = e ? e.y : P.y + rand(-150, 150);
      run.tele.push({ k: 'meteor', x, y, t: .8, dur: .8, rad: 160 * P.area, dmg: 120 * dm, burn: 15 * dm });
      later(.8, () => { query(x, y, 220 * P.area, o => { if (!o.boss) o.freezeT = Math.max(o.freezeT || 0, 1.5); else o.slowT = 2; }); ring(x, y, 20, 220 * P.area, .5, 'rgba(160,230,255,.9)', 12); sfx.frost(); });
      break;
    }
    case 'worldstorm':
      for (let i = 0; i < 8 && c.length; i++) {
        const e = c.splice((rnd() * c.length) | 0, 1)[0];
        boltFx(e.x + frand(-30, 30), e.y - 460, e.x, e.y, 6); hurt(e, 60 * dm, 0, 0, 0, '#fff38a');
        let cur = e; const seen = new Set([e]);
        for (let j = 0; j < 3; j++) {
          let nx = null, nd = 200 * 200;
          query(cur.x, cur.y, 200, o => { if (seen.has(o)) return; const d = (o.x - cur.x) ** 2 + (o.y - cur.y) ** 2; if (d < nd) { nd = d; nx = o; } });
          if (!nx) break; boltFx(cur.x, cur.y - 10, nx.x, nx.y - 10, 3); hurt(nx, 35 * dm, 0, 0, 0, '#fff38a'); seen.add(nx); cur = nx;
        }
      }
      run.shake = Math.max(run.shake, 6); sfx.zap(); break;
    case 'plague':
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rnd(), r = 160 + rnd() * 120; run.zones.push({ k: i % 2 ? 'acid' : 'poison', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r * .8, r: 75 * P.area, t: 4, dur: 4, tick: 0, dmg: 14 * dm }); }
      sfx.throw(); break;
    case 'avalanche':
      for (let i = 0; i < 6; i++) shootRaw('boomer', i * TAU / 6 + rnd() * .3, 45 * dm, 999, 420 * P.proj, 5, { out: 340 * P.proj, dist: 0, back: false, sc: 2.2, r: 32 });
      for (let i = 0; i < 2; i++) { const e = target(); run.wfx.push({ k: 'boulder', x: e ? e.x : P.x + rand(-250, 250), y: e ? e.y : P.y + rand(-200, 200), t: 0, dur: .55, rad: 90 * P.area, dmg: 50 * dm, shard: 20 * dm }); }
      sfx.whoosh(); break;
    case 'armageddon': {
      const a = rnd() * TAU, cx = Math.cos(a), cy = Math.sin(a);
      for (let i = 0; i < 11; i++) { const d = (i - 5) * 80, x = P.x + cx * d, y = P.y + cy * d * .8; run.tele.push({ k: 'mini', sx: x, sy: y - 300, x, y, t: 0, dur: .35 + i * .07, rad: 75 * P.area, dmg: 60 * dm }); }
      sfx.throw(); break;
    }
    case 'warmachine': {
      const e = target(), a0 = e ? Math.atan2(e.y - P.y, e.x - P.x) : rnd() * TAU;
      for (let i = 0; i < 3; i++) shootRaw('saw', a0 + (i - 1) * .35, 50 * dm, 999, 560 * P.proj, 3, { hm: new Map(), sc: 2.2, r: 40 });
      sfx.whoosh(); break;
    }
    case 'ghosthorde': {
      const from = run.allies.length ? run.allies : [P];
      for (const al of from) for (let i = 0; i < (al === P ? 4 : 1); i++) shootRaw('soul', rnd() * TAU, 22 * dm, 1, 300 * P.proj, 3, { x: al.x, y: al.y - 10, target: target(), heal: .8, sc: 1.3 });
      for (const al of run.allies) part(al.x, al.y - 20, 0, -60, .5, 'rgba(170,255,230,.8)', 6);
      break;
    }
    case 'eclipse':
      run.wfx.push({ k: 'eclipse', x: P.x, y: P.y - 8, t: 0, dur: 2.6, a: rnd() * TAU, dmg: 18 * dm });
      { const e = target(); run.wfx.push({ k: 'hole', x: e ? e.x : P.x + rand(-200, 200), y: e ? e.y : P.y + rand(-150, 150), t: 0, dur: 2.6, tick: 0, R: 200 * P.area, dmg: 10 * dm, end: 140 * dm }); }
      sfx.cast(); break;
  }
}
