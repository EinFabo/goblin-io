import { audioInit, sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { ABILITIES, ABILITY_IDS, CHARGE_TXT, SLOT2_ACCT, SLOT_KEYS, unlockText } from '../data/abilities.js';
import { STAGES } from '../data/stages.js';
import { accountXpNeed } from '../game/balance.js';
import { canEquip, slotOpen } from '../game/abilities.js';
import { icon } from '../render/icons.js';

// ---------- Ausrüstung: 2 Fähigkeiten vor jedem Lauf (PLAN 8.1) ----------
// Erst Slot antippen (oder der gerade aktive), dann Fähigkeit. Liegt sie schon im anderen Slot, tauschen beide.
let si = 0, active = 0, onGo = null;

export function showLoadout(stage, start) {
  si = stage; onGo = start; active = 0;
  // ungültige Einträge (z. B. nach Zurücksetzen) räumen
  save.loadout = save.loadout.map((id, i) => id && canEquip(id) && slotOpen(i) ? id : null);
  if (!save.loadout[0]) save.loadout[0] = 'rage';
  render();
}

function render() {
  const p = save.profile;
  $('#loadStage').innerHTML = `<b>${STAGES[si].name}</b> · Konto-Level ${p.level} <span class="acctbar"><i style="width:${Math.min(100, p.xp / accountXpNeed(p.level) * 100).toFixed(0)}%"></i></span>`;
  $('#loadSlots').innerHTML = [0, 1].map(i => {
    const id = save.loadout[i], open = slotOpen(i);
    if (!open) return `<div class="lslot locked"><span class="k">${SLOT_KEYS[i]}</span><span class="t">Gesperrt</span><span class="d">ab Konto-Level ${SLOT2_ACCT}</span></div>`;
    const A = id && ABILITIES[id];
    return `<button class="lslot${i === active ? ' on' : ''}" data-slot="${i}"><span class="k">${SLOT_KEYS[i]}</span>${A ? `<img src="${icon(id)}" alt=""><span class="t">${A.name}</span>` : '<span class="t">leer</span><span class="d">Fähigkeit wählen</span>'}</button>`;
  }).join('');
  $('#abilGrid').innerHTML = ABILITY_IDS.map(id => {
    const A = ABILITIES[id], ok = canEquip(id), slot = save.loadout.indexOf(id);
    return `<button class="abcard${ok ? '' : ' locked'}${slot >= 0 ? ' eq' : ''}" data-ab="${id}" ${ok ? '' : 'disabled'}>
      <img src="${icon(id)}" alt=""><span class="t">${A.name}${slot >= 0 ? ` <i>${SLOT_KEYS[slot]}</i>` : ''}</span>
      <span class="c">${CHARGE_TXT[A.charge](A.need)}</span>
      <span class="d">${ok ? A.desc : 'Freischalten: ' + unlockText(id)}</span></button>`;
  }).join('');
}

$('#loadSlots').addEventListener('click', e => {
  const b = e.target.closest('[data-slot]'); if (!b) return;
  active = +b.dataset.slot; sfx.click(); render();
});
$('#abilGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-ab]'); if (!b || b.disabled) return;
  const id = b.dataset.ab, L = save.loadout, other = 1 - active;
  if (L[other] === id) L[other] = L[active];
  L[active] = id;
  if (slotOpen(other) && !L[other]) active = other;
  persist(); sfx.pickCard(); render();
});
$('#loadGo').addEventListener('click', () => { audioInit(); sfx.pickCard(); if (onGo) onGo(si); });
