// ---------- Altar der Seelen (Phase 12): Wiedergeburt auslösen, Seelenbaum ausbauen ----------
// Geöffnet vom Zettel der Endlosen Nacht auf der Weltkarte (ui/worldmap.js). Logik in game/souls.js.
import { sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { SOUL_BRANCHES, SOUL_IDS, SOUL_NODES, cycleDmg, cycleHp, cycleReward } from '../data/souls.js';
import { buySoul, cycle, rebirth, rebirthOpen, soulRank, soulWhy, soulsFor, soulsFree } from '../game/souls.js';
import { burstAt, flashScreen } from './rewardfx.js';

let onDone = () => {}, confirm = false;
// after: wird nach Wiedergeburt oder Schließen gerufen (Karte neu zeichnen)
export function openAltar(after = () => {}) { onDone = after; confirm = false; render(); $('#soulTree').hidden = false; sfx.click(); }
const pc = v => Math.round((v - 1) * 100) + ' %';

function nodeHtml(id) {
  const N = SOUL_NODES[id], r = soulRank(save, id), why = soulWhy(save, id), max = r >= N.max;
  return `<button class="snode${r ? ' have' : ''}${max ? ' max' : ''}${why ? '' : ' can'}" data-soul="${id}" title="${why || 'Kaufen'}">
    <b>${N.name}</b><small>${N.desc}</small><span class="sr">${r}/${N.max}</span>${max ? '' : `<span class="sc">${N.cost[r]} ✦</span>`}</button>`;
}
function render() {
  const n = cycle(save), open = rebirthOpen(save), gain = soulsFor(save);
  const reb = open ? `<div class="srebirth"><p><b>Wiedergeburt:</b> +${gain} Seelen (10 je Welt, 5 je Albtraum-Stufe, Minuten der Endlosen Nacht). Welt-Fortschritt und Albtraum beginnen neu – Karten, Talente, Fähigkeiten, Runen, Kosmetik, Klassen, Gold, Juwelen, Konto- und Klassen-Level bleiben.</p>
      <p>Zyklus ${n + 1}: Gegner +${pc(cycleHp(n + 1))} Leben und +${pc(cycleDmg(n + 1))} Schaden, Gold und XP +${pc(cycleReward(n + 1))}.</p>
      <button class="btn ${confirm ? 'danger' : 'primary'}" data-rebirth>${confirm ? 'Wirklich? Noch einmal tippen' : 'Wiedergeburt'}</button></div>`
    : '<p class="slock">Die Wiedergeburt ist frei, sobald der Boss von Welt 8 besiegt ist und du eine volle Runde (4:00) in der Endlosen Nacht überlebt hast.</p>';
  const cols = Object.entries(SOUL_BRANCHES).map(([br, name]) => `<div class="sbranch"><h4>${name}</h4>${SOUL_IDS.filter(id => SOUL_NODES[id].br === br).map(nodeHtml).join('')}</div>`).join('');
  $('#soulBody').innerHTML = `<div class="shead"><span>Zyklus <b>${n}</b></span><span>Seelen frei: <b>${soulsFree(save)} ✦</b></span><span>gesamt verdient: ${save.rebirth.souls}</span></div>${reb}
    <div class="scrown">${nodeHtml('crown')}</div><div class="sbranches">${cols}</div>`;
}

$('#soulTree').addEventListener('click', e => {
  if (e.target === $('#soulTree') || e.target.closest('#soulClose')) { $('#soulTree').hidden = true; onDone(); return; }
  const b = e.target.closest('[data-soul]');
  if (b) {
    if (!buySoul(save, b.dataset.soul)) { sfx.buzz(); return; }
    persist(); sfx.lvl();
    const rc = b.getBoundingClientRect(); burstAt(rc.left + rc.width / 2, rc.top + rc.height / 2, ['#b48cff', '#e8d8ff', '#ffffff'], 20);
    render(); return;
  }
  if (e.target.closest('[data-rebirth]')) {
    if (!confirm) { confirm = true; sfx.warn(); render(); return; }
    const r = rebirth(save); if (!r) { sfx.buzz(); return; }
    persist(); sfx.master(); flashScreen();
    confirm = false; render(); onDone();
  }
});
