import { sfx } from '../core/audio.js';
import { save } from '../core/save.js';
import { $ } from '../core/util.js';
import { ABILITIES } from '../data/abilities.js';
import { COMBOS, COMBO_GEMS, COMBO_IDS, COMBO_T } from '../data/combos.js';
import { icon } from '../render/icons.js';

// ---------- Kombo-Buch (Phase 10) ----------
// Entdeckte Kombos mit beiden Fähigkeiten und Wirkung; unentdeckte als „?“ mit einer der beiden Fähigkeiten als Hinweis.
export function openCombos() {
  const got = save.combos, hinted = new Set();   // Hinweis-Fähigkeit möglichst nicht doppelt zeigen
  $('#comboCount').textContent = `${got.length} / ${COMBO_IDS.length} entdeckt`;
  $('#comboList').innerHTML = COMBO_IDS.map(k => {
    const C = COMBOS[k], on = got.includes(k), hint = !on && hinted.has(C.a) ? C.b : C.a; if (!on) hinted.add(hint);
    const ic = id => `<img src="${icon(id)}" alt="" title="${ABILITIES[id].name}">`;
    return on ? `<div class="combo on"><span class="pair">${ic(C.a)}<i>+</i>${ic(C.b)}</span><b>${C.name}</b><small>${ABILITIES[C.a].name} + ${ABILITIES[C.b].name}: ${C.desc}</small></div>`
      : `<div class="combo"><span class="pair">${ic(hint)}<i>+</i><span class="q">?</span></span><b>???</b><small>${ABILITIES[hint].name} und eine andere Fähigkeit kurz nacheinander …</small></div>`;
  }).join('');
  $('#comboHint').textContent = `Setze zwei passende Fähigkeiten innerhalb von ${COMBO_T} s nacheinander ein. Jede neue Kombo bringt ${COMBO_GEMS} Juwelen.`;
  $('#comboBook').hidden = false; sfx.treeOpen();
  $('#comboClose').focus({ preventScroll: true });
}
const close = () => { $('#comboBook').hidden = true; };
$('#comboClose').addEventListener('click', close);
$('#comboBook').addEventListener('click', e => { if (e.target === $('#comboBook')) close(); });
window.addEventListener('keydown', e => { if (e.code === 'Escape' && !$('#comboBook').hidden) { e.stopImmediatePropagation(); close(); } }, true);
