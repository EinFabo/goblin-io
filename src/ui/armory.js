import { sfx } from '../core/audio.js';
import { abilState, persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { ABILITIES, ABILITY_IDS, ABIL_MAX_LV, CHARGE_TXT, SLOT2_ACCT, SLOT_KEYS, TREE, abilXpNeed, basePoints, canLearn, smokeAtkSlow, spentPoints, unlockText, xpPerUse } from '../data/abilities.js';
import { canEquip, slotOpen } from '../game/abilities.js';
import { icon } from '../render/icons.js';

// ---------- Rüstkammer: zwei Haken für die Fähigkeiten, Brett mit allen Fähigkeiten, Zettel mit Details ----------
// Die Auswahl bleibt gespeichert (save.loadout); Stages starten direkt damit.
let sel = null;
const st = id => save.abilities[id] || { lv: 1, xp: 0, pts: {} };
const freePts = id => { const s = st(id); return s.lv - 1 - spentPoints(s.pts); };

// Ungültige Einträge räumen (z. B. Slot 2 noch zu, Fähigkeit nicht mehr frei)
export function cleanLoadout() {
  save.loadout = save.loadout.map((id, i) => id && canEquip(id) && slotOpen(i) ? id : null);
  if (!save.loadout[0]) save.loadout[0] = 'rage';
}

export function renderArmory() {
  cleanLoadout();
  if (!sel || !ABILITIES[sel]) sel = save.loadout[0];
  renderHooks(); renderShelf(); renderNote();
}

function renderHooks(swing = -1) {
  $('#armHooks').innerHTML = [0, 1].map(i => {
    const id = save.loadout[i], key = `<span class="key">${SLOT_KEYS[i]}</span>`;
    let body;
    if (!slotOpen(i)) body = `<div class="plaque closed">${key}<span class="t">Noch zu</span><span class="lvl">ab Konto-Level ${SLOT2_ACCT}</span></div>`;
    else if (!id) body = `<div class="plaque empty">${key}<span class="t">Frei</span><span class="lvl">Fähigkeit wählen</span></div>`;
    else body = `<button class="plaque${id === sel ? ' sel' : ''}" data-pick="${id}" aria-label="${ABILITIES[id].name} auf ${SLOT_KEYS[i]}">${key}<img src="${icon(id)}" alt=""><span class="t">${ABILITIES[id].name}</span><span class="lvl">Level ${st(id).lv}</span></button>`;
    return `<div class="hook${i === swing ? ' swing' : ''}">${body}</div>`;
  }).join('');
}

function renderShelf() {
  $('#armShelf').innerHTML = ABILITY_IDS.map(id => {
    const ok = canEquip(id), slot = save.loadout.indexOf(id);
    return `<button class="token${ok ? '' : ' locked'}${id === sel ? ' on' : ''}" data-pick="${id}" role="option" aria-selected="${id === sel}">
      <span class="disc"><img src="${icon(id)}" alt=""></span><span class="n">${ABILITIES[id].name}</span>
      ${ok ? `<span class="tlv">${st(id).lv}</span>` : ''}${slot >= 0 ? `<span class="eq">${SLOT_KEYS[slot]}</span>` : ''}${ok && freePts(id) > 0 ? '<span class="pts" title="Skillpunkte frei"></span>' : ''}</button>`;
  }).join('');
}

function renderNote() {
  const id = sel, A = ABILITIES[id], ok = canEquip(id), s = st(id), slot = save.loadout.indexOf(id), free = freePts(id);
  let h = `<h3>${A.name}</h3><p class="c">${CHARGE_TXT[A.charge](A.need)}</p><p>${A.desc}</p>`;
  if (!ok) { $('#armNote').innerHTML = h + `<p class="lock">Noch nicht frei. ${unlockText(id)}.</p>`; return; }
  const pct = s.lv >= ABIL_MAX_LV ? 100 : Math.min(100, s.xp / abilXpNeed(s.lv) * 100);
  h += `<div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div><p class="xp">Level ${s.lv}${s.lv < ABIL_MAX_LV ? ` · ${Math.floor(s.xp)} / ${abilXpNeed(s.lv)} XP · +${xpPerUse(id)} pro Einsatz` : ' · Maximum'}</p>`;
  const hang = i => !slotOpen(i) ? '' : `<button class="btn ${slot === i ? 'ghost' : 'primary'}" data-hang="${i}" ${slot === i ? 'disabled' : ''}>${slot === i ? `Hängt an ${SLOT_KEYS[i]}` : `An ${SLOT_KEYS[i]} hängen`}</button>`;
  h += `<div class="acts">${hang(0)}${hang(1)}<button class="btn" data-tree="${id}">Skill Tree${free > 0 ? ` (${free} frei)` : ''}</button></div>`;
  $('#armNote').innerHTML = h;
}

function pick(id) { sel = id; sfx.click(); renderHooks(); renderShelf(); renderNote(); }
function hang(i) {
  const L = save.loadout, other = 1 - i;
  if (!canEquip(sel) || !slotOpen(i) || L[i] === sel) return;
  if (L[other] === sel) L[other] = L[i];   // schon am anderen Haken: tauschen
  L[i] = sel;
  if (i === 0 && !L[0]) L[0] = 'rage';
  persist(); sfx.pickCard();
  renderHooks(i); renderShelf(); renderNote();
}
$('#armory').addEventListener('click', e => {
  const t = e.target.closest('[data-tree]'); if (t) { openTree(t.dataset.tree); return; }
  const h = e.target.closest('[data-hang]'); if (h) { hang(+h.dataset.hang); return; }
  const b = e.target.closest('[data-pick]'); if (b) pick(b.dataset.pick);
});

// ---------- Skill Tree (PLAN 8.4) ----------
let treeId = null;
function openTree(id) { treeId = id; renderTree(); $('#tree').hidden = false; sfx.cards(); }
function renderTree() {
  const A = ABILITIES[treeId], s = abilState(treeId), free = s.lv - 1 - spentPoints(s.pts), base = basePoints(s.pts);
  $('#treeTitle').textContent = A.name;
  $('#treeInfo').innerHTML = `<img src="${icon(treeId)}" alt=""><span>Level <b>${s.lv}</b>${s.lv < ABIL_MAX_LV ? ` · ${Math.floor(s.xp)} / ${abilXpNeed(s.lv)} XP` : ' (max.)'}<br><small>+${xpPerUse(treeId)} XP pro Einsatz${treeId === 'smoke' ? ` · Angriff im Rauch −${Math.round(smokeAtkSlow(base) * 100)} %` : ''}</small></span><b class="free">${free} Punkt${free === 1 ? '' : 'e'} frei</b>`;
  const node = k => {
    const N = TREE[k], have = s.pts[k] || 0, ex = k === 'a' ? A.extras[0] : k === 'b' ? A.extras[1] : null;
    const name = ex ? ex.name : N.name, desc = ex ? ex.desc : N.desc, can = canLearn(s, k), locked = base < (N.req || 0);
    const rank = N.max > 1 ? `${have} / ${N.max}` : have ? 'gelernt' : `${N.cost} Punkte`;
    return `<button class="tnode${ex ? ' extra' : ''}${have >= N.max ? ' full' : have ? ' some' : ''}${locked ? ' locked' : ''}" data-node="${k}" ${can ? '' : 'aria-disabled="true"'}>
      <span class="t">${name}</span><span class="r">${rank}</span><span class="d">${locked ? `Braucht ${N.req} Punkte in den unteren Knoten (${base}/${N.req})` : desc}</span></button>`;
  };
  $('#treeNodes').innerHTML = `<div class="trow">${node('b')}</div><div class="tline"></div><div class="trow">${node('a')}</div><div class="tline"></div><div class="trow three">${node('pow')}${node('cd')}${node('area')}</div>`;
  $('#treeReset').disabled = spentPoints(s.pts) === 0;
}
const refresh = () => { renderTree(); if (!$('#armory').hidden) renderArmory(); };
$('#treeNodes').addEventListener('click', e => {
  const b = e.target.closest('[data-node]'); if (!b) return;
  const s = abilState(treeId), k = b.dataset.node;
  if (!canLearn(s, k)) { sfx.buzz(); return; }
  s.pts[k] = (s.pts[k] || 0) + 1; persist(); sfx.buy(); refresh();
});
$('#treeReset').addEventListener('click', () => { abilState(treeId).pts = {}; persist(); sfx.click(); refresh(); });
$('#treeClose').addEventListener('click', () => { $('#tree').hidden = true; });
