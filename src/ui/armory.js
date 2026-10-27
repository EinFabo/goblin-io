import { sfx } from '../core/audio.js';
import { clsState, persist, save, stageCleared } from '../core/save.js';
import { CLASSES, CLASS_IDS, CLASS_MAX_LV, CLASS_PERKS, DASH_KIND, SPRINT_KIND, classUnlockText, classUnlocked, classXpNeed } from '../data/classes.js';
import { WEAPONS } from '../data/weapons.js';
import { loadGoblin } from '../render/sprites.js';
import { dropGoblinIcons } from '../render/icons.js';
import { $ } from '../core/util.js';
import { ABILITIES, ABILITY_IDS, ABIL_MAX_LV, CHARGE_TXT, MOVES, MOVE_IDS, ROLES, SLOT2_ACCT, SLOT_KEYS, STAR_COLS, STAR_MAX, STAR_NAMES, STAR_XP, abilXpNeed, spentPoints, treeDef, unlockText, xpPerUse } from '../data/abilities.js';
import { openCombos } from './combobook.js';
import { COMBO_IDS } from '../data/combos.js';
import { canEquip, slotOpen } from '../game/abilities.js';
import { icon } from '../render/icons.js';
import { openTree } from './tree.js';
import { openRunes } from './runes.js';
import { runeSvg } from './cardart.js';
import { SOCKET_LV } from '../data/runes.js';
import { socketOpen, socketsOf } from '../game/runes.js';

// ---------- Rüstkammer: zwei Haken für die Fähigkeiten, Brett mit allen Fähigkeiten, Zettel mit Details ----------
// Die Auswahl bleibt gespeichert (save.loadout); Stages starten direkt damit.
let sel = null, role = 'all', byLv = false;   // Regal-Filter (Rolle) und Sortierung nach Level
const st = id => save.abilities[id] || { lv: 1, xp: 0, pts: {} };
// Sterne (Phase 10) als kleine Reihe, in der Farbe des höchsten Sterns
const stars = id => { const n = st(id).st || 0; return n ? `<span class="stars" style="--sc:${STAR_COLS[n - 1]}">${'★'.repeat(n)}</span>` : ''; };
const isNew = id => !!ABILITIES[id] && canEquip(id) && !save.seen.includes(id);   // Rolle/Sprint sind nie „neu“
const freePts = id => { const s = st(id); return s.lv - 1 - spentPoints(s.pts); };

// Ungültige Einträge räumen (z. B. Slot 2 noch zu, Fähigkeit nicht mehr frei)
export function cleanLoadout() {
  save.loadout = save.loadout.map((id, i) => id && canEquip(id) && slotOpen(i) ? id : null);
  if (!save.loadout[0]) save.loadout[0] = save.loadout[1] !== 'rage' ? 'rage' : null;
  if (!save.loadout[0]) [save.loadout[0], save.loadout[1]] = [save.loadout[1], null];
  if (save.loadout[1] === save.loadout[0]) save.loadout[1] = null;   // nie dieselbe Fähigkeit an beiden Haken
}

export function renderArmory() {
  cleanLoadout();
  if (!sel || (!treeDef(sel) && !clsSel())) sel = save.loadout[0];
  renderHooks(); renderClasses(); renderShelf(); renderNote();
}

// ---------- Klassen (Phase 9): Leiste über dem Regal, Antippen wählt die Klasse ----------
// Bewegung der gewählten Klasse (Salto, Teleport, Sturmangriff): eigener Name, gleicher Baum wie Rolle bzw. Sprint
const moveKind = id => { const C = CLASSES[clsOk(save.cls) ? save.cls : 'gob']; return id === 'dash' ? DASH_KIND[C.dash] : SPRINT_KIND[C.sprint]; };
const clsSel = () => (sel && sel.startsWith('cls:') ? sel.slice(4) : null);
const clsOk = id => classUnlocked(id, stageCleared);
const pct = v => (v > 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + ' %';
function renderClasses() {
  $('#armCls').innerHTML = CLASS_IDS.map(id => {
    const C = CLASSES[id], ok = clsOk(id), on = save.cls === id;
    return `<button class="clsbtn${on ? ' on' : ''}${ok ? '' : ' locked'}${clsSel() === id ? ' sel' : ''}" data-cls="${id}" aria-pressed="${on}">
      <img src="${icon(C.weapon)}" alt=""><span class="n">${C.short}</span>${ok ? `<span class="tlv">${clsState(id).lv}</span>` : '<span class="lk">🔒</span>'}</button>`;
  }).join('');
}
function clsNote(id) {
  const C = CLASSES[id], ok = clsOk(id), c = clsState(id), W = WEAPONS[C.weapon];
  const stats = [C.hp !== 1 && `Leben ${pct(C.hp)}`, C.speed !== 1 && `Tempo ${pct(C.speed)}`, C.cd !== 1 && `Abklingzeit ${pct(C.cd)}`].filter(Boolean);
  let h = `<h3>${C.name}</h3><p class="c">${save.cls === id ? 'Gewählt' : ok ? 'Klasse' : 'Gesperrt'}</p><p>${C.desc}</p>
    <p class="clsw"><img src="${icon(C.weapon)}" alt=""><span><b>${W.name}</b> – ${W.info[0]}</span></p>
    <p class="clsmv"><span class="key">Leer</span> ${DASH_KIND[C.dash].name} · <span class="key">Shift</span> ${SPRINT_KIND[C.sprint].name}${stats.length ? ` · ${stats.join(', ')}` : ''}</p>`;
  if (!ok) return h + `<p class="lock">Noch nicht frei. ${classUnlockText(id)}.</p>`;
  const full = c.lv >= CLASS_MAX_LV;
  h += `<div class="bar"><i style="width:${full ? 100 : Math.min(100, c.xp / classXpNeed(c.lv) * 100).toFixed(0)}%"></i></div><p class="xp">Klassen-Level ${c.lv}${full ? ` · Maximum: ${C.master}` : ` · ${Math.floor(c.xp)} / ${classXpNeed(c.lv)} XP (wie Konto-XP)`}</p>`;
  h += `<ul class="perks">${CLASS_PERKS.map(p => `<li class="${c.lv >= p.lv ? 'have' : ''}"><b>${p.lv}</b> ${p.txt}</li>`).join('')}</ul>`;
  h += `<div class="acts"><button class="btn ${save.cls === id ? 'ghost' : 'primary'}" data-usecls="${id}" ${save.cls === id ? 'disabled' : ''}>${save.cls === id ? 'Gewählt' : 'Diese Klasse spielen'}</button></div>`;
  return h;
}
function useClass(id) {
  if (!clsOk(id) || save.cls === id) return;
  save.cls = id; persist(); sfx.pickCard();
  // Aussehen neu laden (Klassenwaffe in der Hand), Icons mit Goblin-Bildern neu zeichnen
  loadGoblin().then(dropGoblinIcons);
  renderClasses(); renderShelf(); renderNote();
}

function renderHooks(swing = -1) {
  $('#armHooks').innerHTML = [0, 1].map(i => {
    const id = save.loadout[i], key = `<span class="key">${SLOT_KEYS[i]}</span>`;
    let body;
    if (!slotOpen(i)) body = `<div class="plaque closed">${key}<span class="t">Noch zu</span><span class="lvl">ab Konto-Level ${SLOT2_ACCT}</span></div>`;
    else if (!id) body = `<div class="plaque empty">${key}<span class="t">Frei</span><span class="lvl">Fähigkeit wählen</span></div>`;
    else body = `<button class="plaque${id === sel ? ' sel' : ''}" data-pick="${id}" aria-label="${ABILITIES[id].name} auf ${SLOT_KEYS[i]}">${key}<img src="${icon(id)}" alt=""><span class="t">${ABILITIES[id].name}</span><span class="lvl">Level ${st(id).lv}</span>${stars(id)}</button>`;
    return `<div class="hook${i === swing ? ' swing' : ''}">${body}</div>`;
  }).join('');
}

function renderShelf() {
  // Rolle und Sprint: immer dabei, eigene Marken vorn im Regal
  const moves = MOVE_IDS.map(id => `<button class="token move${id === sel ? ' on' : ''}" data-pick="${id}" role="option" aria-selected="${id === sel}">
      <span class="disc"><img src="${icon(moveKind(id).icon)}" alt=""></span><span class="n">${moveKind(id).name}</span><span class="tlv">${st(id).lv}</span>${freePts(id) > 0 ? '<span class="pts" title="Skillpunkte frei"></span>' : ''}</button>`).join('');
  // Filter nach Rolle, Sortierung nach Level (gesperrte hinten); Rolle und Sprint nur ohne Filter
  let ids = role === 'all' ? ABILITY_IDS : ROLES[role].ids;
  if (byLv) ids = [...ids].sort((a, b) => (canEquip(b) - canEquip(a)) || (st(b).lv + (st(b).st || 0) * 100) - (st(a).lv + (st(a).st || 0) * 100));
  $('#armShelf').innerHTML = (role === 'all' ? moves : '') + ids.map(id => {
    const ok = canEquip(id), slot = save.loadout.indexOf(id);
    return `<button class="token${ok ? '' : ' locked'}${id === sel ? ' on' : ''}" data-pick="${id}" role="option" aria-selected="${id === sel}">
      <span class="disc"><img src="${icon(id)}" alt=""></span><span class="n">${ABILITIES[id].name}</span>
      ${ok ? `<span class="tlv">${st(id).lv}</span>` : ''}${slot >= 0 ? `<span class="eq">${SLOT_KEYS[slot]}</span>` : ''}${ok && freePts(id) > 0 ? '<span class="pts" title="Skillpunkte frei"></span>' : ''}${isNew(id) ? '<span class="newtag">Neu</span>' : ''}${stars(id)}</button>`;
  }).join('');
  const nNew = ABILITY_IDS.filter(isNew).length;
  $('#armChips').innerHTML = [['all', 'Alle'], ...Object.entries(ROLES).map(([k, R]) => [k, R.name])].map(([k, n]) => `<button class="chip${role === k ? ' on' : ''}" data-role="${k}">${n}</button>`).join('') +
    `<button class="chip sort${byLv ? ' on' : ''}" data-sort aria-pressed="${byLv}">Nach Level</button><button class="chip book" data-combos>Kombo-Buch <b>${save.combos.length}/${COMBO_IDS.length}</b></button>` + (nNew ? `<span class="chipnew">${nNew} neu</span>` : '');
}

function renderNote() {
  if (clsSel()) { $('#armNote').innerHTML = clsNote(clsSel()); return; }
  const id = sel, A = treeDef(id), move = !!MOVES[id], ok = move || canEquip(id), s = st(id), slot = save.loadout.indexOf(id), free = freePts(id);
  const K = move && moveKind(id), alt = K && K.name !== A.name;
  let h = `<h3>${alt ? K.name : A.name}</h3><p class="c">${move ? 'Immer dabei' : CHARGE_TXT[A.charge](A.need)}</p><p>${alt ? `${K.desc} Teilt Level und Skill Tree mit ${id === 'dash' ? 'der Rolle' : 'dem Sprint'}.` : A.desc}</p>`;
  if (!ok) { $('#armNote').innerHTML = h + `<p class="lock">Noch nicht frei. ${unlockText(id)}.</p>`; return; }
  // ab Level 30: Balken bis zum nächsten Stern (Phase 10), Rolle und Sprint haben keine Sterne
  const n = s.st || 0, starBar = s.lv >= ABIL_MAX_LV && !move && n < STAR_MAX;
  const pct = starBar ? Math.min(100, s.xp / STAR_XP * 100) : s.lv >= ABIL_MAX_LV ? 100 : Math.min(100, s.xp / abilXpNeed(s.lv) * 100);
  const xpTxt = s.lv < ABIL_MAX_LV ? ` · ${Math.floor(s.xp)} / ${abilXpNeed(s.lv)} XP · +${xpPerUse(id)} ${id === 'sprint' ? 'pro Sekunde' : 'pro Einsatz'}`
    : move ? ' · Maximum' : n >= STAR_MAX ? ` · ${STAR_MAX} Sterne: Legende!` : ` · Stern ${n + 1} (${STAR_NAMES[n]}): ${Math.floor(s.xp)} / ${STAR_XP} XP`;
  h += `<div class="bar${starBar ? ' starbar' : ''}" style="--sc:${STAR_COLS[Math.min(n, STAR_MAX - 1)]}"><i style="width:${pct.toFixed(0)}%"></i></div><p class="xp">Level ${s.lv}${xpTxt}${n ? ` · +${n * 3} % Kraft` : ''}</p>`;
  const hang = i => move || !slotOpen(i) ? '' : `<button class="btn ${slot === i ? 'ghost' : 'primary'}" data-hang="${i}" ${slot === i ? 'disabled' : ''}>${slot === i ? `Hängt an ${SLOT_KEYS[i]}` : `An ${SLOT_KEYS[i]} hängen`}</button>`;
  h += `<div class="acts">${hang(0)}${hang(1)}<button class="btn" data-tree="${id}">Skill Tree${free > 0 ? ` (${free} frei)` : ''}</button></div>`;
  // Runen-Sockel (Phase 10): Klick öffnet die Runen-Tasche für diesen Sockel
  if (!move) {
    const socks = socketsOf(save, id);
    h += `<div class="asocks"><span>Runen</span>${[0, 1].map(i => { const open = socketOpen(save, id, i), k = socks[i];
      return `<button class="asock${open ? '' : ' locked'}" data-sock="${i}" aria-label="Runen-Sockel ${i + 1}" title="${open ? (k ? 'Rune tauschen' : 'Rune einsetzen') : 'ab Level ' + SOCKET_LV[i]}">${k ? runeSvg(k) : open ? '<span class="hole"></span>' : `<small>Lv ${SOCKET_LV[i]}</small>`}</button>`; }).join('')}
      <button class="btn small" data-runes>Runen-Tasche</button></div>`;
  }
  $('#armNote').innerHTML = h;
}

// Ansehen nimmt die „Neu“-Markierung weg
function pick(id) { sel = id; if (isNew(id)) { save.seen.push(id); persist(); } sfx.click(); renderHooks(); renderClasses(); renderShelf(); renderNote(); }
function hang(i) {
  const L = save.loadout, other = 1 - i;
  if (MOVES[sel] || !canEquip(sel) || !slotOpen(i) || L[i] === sel) return;
  if (L[other] === sel) L[other] = L[i];   // schon am anderen Haken: tauschen
  L[i] = sel;
  // Q darf nicht leer bleiben (von Q an den leeren E-Haken gehängt): dann bleibt sie an Q
  if (!L[0]) [L[0], L[1]] = [L[1], null];
  persist(); sfx.pickCard();
  renderHooks(i); renderShelf(); renderNote();
}
$('#armory').addEventListener('click', e => {
  const u = e.target.closest('[data-usecls]'); if (u) { useClass(u.dataset.usecls); return; }
  // Klasse antippen: zeigt sie; eine freie Klasse wird gleich gewählt
  const cb = e.target.closest('[data-cls]'); if (cb) { pick('cls:' + cb.dataset.cls); useClass(cb.dataset.cls); return; }
  const t = e.target.closest('[data-tree]'); if (t) { openTree(t.dataset.tree, () => { if (!$('#armory').hidden) renderArmory(); }); return; }
  const h = e.target.closest('[data-hang]'); if (h) { hang(+h.dataset.hang); return; }
  const k = e.target.closest('[data-sock], [data-runes]');
  if (k) { openRunes(sel, k.dataset.sock !== undefined ? +k.dataset.sock : null, () => { if (!$('#armory').hidden) renderArmory(); }); return; }
  const c = e.target.closest('[data-role]'); if (c) { role = c.dataset.role; sfx.click(); renderShelf(); return; }
  if (e.target.closest('[data-sort]')) { byLv = !byLv; sfx.click(); renderShelf(); return; }
  if (e.target.closest('[data-combos]')) { openCombos(); return; }
  const b = e.target.closest('[data-pick]'); if (b) pick(b.dataset.pick);
});

