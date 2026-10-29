// Schadens-Statistik (PLAN.md Phase 15, Wunsch Fabi): Schaden und Kills je Waffe und Fähigkeit des eigenen Goblins,
// gezählt in game/combat.js (tally). Im Ergebnis und in der Pause.
import { treeDef } from '../data/abilities.js';
import { MEGAS, WEAPONS } from '../data/weapons.js';
import { run } from '../game/state.js';
import { icon } from '../render/icons.js';

const fmt = d => (d >= 10000 ? (d / 1000).toFixed(d >= 100000 ? 0 : 1).replace('.', ',') + 'k' : Math.round(d).toLocaleString('de-DE'));
function about(key) {
  const [k, id, id2] = key.split(':');
  if (k === 'w' && id === 'mega') { const M = MEGAS[id2]; return M ? { name: M.name, ic: icon(M.of[0] + '_evo') } : null; }
  if (k === 'w') {
    const W = WEAPONS[id]; if (!W) return null;
    const w = run.weapons.find(x => x.id === id), evo = !!(w && w.evo);   // eigene Ausrüstung (beim Zeichnen ist der eigene Goblin aktiv)
    return { name: evo ? W.evo : W.name, ic: icon(evo ? id + '_evo' : id) };
  }
  const T = treeDef(id); return T ? { name: T.name, ic: icon(T.icon || id) } : null;
}
// rows: höchstens so viele Zeilen (die stärksten)
export function dmgStatHtml(rows = 8) {
  const st = (run.dmgStat || [])[run.me] || {};
  const list = Object.entries(st).map(([k, [d, n]]) => ({ k, d, n, a: about(k) })).filter(x => x.a && (x.d > 0 || x.n > 0)).sort((a, b) => b.d - a.d).slice(0, rows);
  if (!list.length) return '';
  const max = list[0].d || 1, sum = list.reduce((s, x) => s + x.d, 0) || 1;
  return `<div class="dsrows">${list.map(x => `<div class="dsrow"><img src="${x.a.ic}" alt=""><span class="n">${x.a.name}</span>
    <i class="bar"><i style="width:${(x.d / max * 100).toFixed(1)}%"></i></i><b>${fmt(x.d)}</b><small>${Math.round(x.d / sum * 100)} % · ${x.n} Kills</small></div>`).join('')}</div>`;
}
