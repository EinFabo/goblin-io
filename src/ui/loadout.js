import { audioInit, sfx } from '../core/audio.js';
import { abilState, persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { ABILITIES, ABILITY_IDS, ABIL_MAX_LV, CHARGE_TXT, SLOT2_ACCT, SLOT_KEYS, TREE, abilXpNeed, basePoints, canLearn, spentPoints, unlockText, xpPerUse } from '../data/abilities.js';
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
    const A = ABILITIES[id], ok = canEquip(id), slot = save.loadout.indexOf(id), st = save.abilities[id] || { lv: 1, xp: 0, pts: {} };
    const free = st.lv - 1 - spentPoints(st.pts);
    const lv = ok ? `<span class="ablv">Lv ${st.lv}<span class="xpb"><i style="width:${st.lv >= ABIL_MAX_LV ? 100 : Math.min(100, st.xp / abilXpNeed(st.lv) * 100).toFixed(0)}%"></i></span></span>` : '';
    return `<div class="abcard${ok ? '' : ' locked'}${slot >= 0 ? ' eq' : ''}" data-ab="${id}" role="button" tabindex="${ok ? 0 : -1}" aria-disabled="${!ok}">
      <img src="${icon(id)}" alt=""><span class="t">${A.name}${slot >= 0 ? ` <i>${SLOT_KEYS[slot]}</i>` : ''}</span>
      <span class="c">${CHARGE_TXT[A.charge](A.need)} ${lv}</span>
      <span class="d">${ok ? A.desc : 'Freischalten: ' + unlockText(id)}</span>
      ${ok ? `<button class="treebtn${free > 0 ? ' pts' : ''}" data-tree="${id}">Skill Tree${free > 0 ? ` · ${free} Punkt${free > 1 ? 'e' : ''} frei` : ''}</button>` : ''}</div>`;
  }).join('');
}

$('#loadSlots').addEventListener('click', e => {
  const b = e.target.closest('[data-slot]'); if (!b) return;
  active = +b.dataset.slot; sfx.click(); render();
});
$('#abilGrid').addEventListener('click', e => {
  const t = e.target.closest('[data-tree]'); if (t) { openTree(t.dataset.tree); return; }
  const b = e.target.closest('[data-ab]'); if (!b || b.classList.contains('locked')) return;
  const id = b.dataset.ab, L = save.loadout, other = 1 - active;
  if (L[other] === id) L[other] = L[active];
  L[active] = id;
  if (slotOpen(other) && !L[other]) active = other;
  persist(); sfx.pickCard(); render();
});
$('#abilGrid').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.abcard')) { e.preventDefault(); e.target.click(); } });

// ---------- Skill Tree (PLAN 8.4) ----------
let treeId = null;
function openTree(id) { treeId = id; renderTree(); $('#tree').hidden = false; sfx.cards(); }
function renderTree() {
  const A = ABILITIES[treeId], st = abilState(treeId), free = st.lv - 1 - spentPoints(st.pts), base = basePoints(st.pts);
  $('#treeTitle').textContent = A.name;
  $('#treeInfo').innerHTML = `<img src="${icon(treeId)}" alt=""><span>Level <b>${st.lv}</b>${st.lv < ABIL_MAX_LV ? ` · ${Math.floor(st.xp)} / ${abilXpNeed(st.lv)} XP` : ' (max.)'}<br><small>+${xpPerUse(treeId)} XP pro Einsatz</small></span><b class="free">${free} Punkt${free === 1 ? '' : 'e'} frei</b>`;
  const node = k => {
    const N = TREE[k], have = st.pts[k] || 0, ex = k === 'a' ? A.extras[0] : k === 'b' ? A.extras[1] : null;
    const name = ex ? ex.name : N.name, desc = ex ? ex.desc : N.desc, can = canLearn(st, k), locked = base < (N.req || 0);
    const rank = N.max > 1 ? `${have} / ${N.max}` : have ? 'gelernt' : `${N.cost} Punkte`;
    return `<button class="tnode${ex ? ' extra' : ''}${have >= N.max ? ' full' : have ? ' some' : ''}${locked ? ' locked' : ''}" data-node="${k}" ${can ? '' : 'aria-disabled="true"'}>
      <span class="t">${name}</span><span class="r">${rank}</span><span class="d">${locked ? `Braucht ${N.req} Punkte in den unteren Knoten (${base}/${N.req})` : desc}</span></button>`;
  };
  $('#treeNodes').innerHTML = `<div class="trow">${node('b')}</div><div class="tline"></div><div class="trow">${node('a')}</div><div class="tline"></div><div class="trow three">${node('pow')}${node('cd')}${node('area')}</div>`;
  $('#treeReset').disabled = spentPoints(st.pts) === 0;
}
$('#treeNodes').addEventListener('click', e => {
  const b = e.target.closest('[data-node]'); if (!b) return;
  const st = abilState(treeId), k = b.dataset.node;
  if (!canLearn(st, k)) { sfx.buzz(); return; }
  st.pts[k] = (st.pts[k] || 0) + 1; persist(); sfx.buy(); renderTree(); render();
});
$('#treeReset').addEventListener('click', () => { abilState(treeId).pts = {}; persist(); sfx.click(); renderTree(); render(); });
$('#treeClose').addEventListener('click', () => { $('#tree').hidden = true; });

$('#loadGo').addEventListener('click', () => { audioInit(); sfx.pickCard(); if (onGo) onGo(si); });
