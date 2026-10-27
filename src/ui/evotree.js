// ---------- Entwicklungs-Baum mit Vorschau (Wunsch Fabi 2026-10-16) ----------
// Jede Waffe gehört zu genau einer Mega: Waffe + Passiv → Entwicklung, zwei Entwicklungen → Mega.
// Antippen eines Knotens zeigt ihn in einer Live-Vorschau (game/preview.js). Im Lauf ist der eigene Stand markiert.
// Offen aus Level-Up (Auge an den Karten), Pause und Werkstatt.
import { sfx } from '../core/audio.js';
import { $ } from '../core/util.js';
import { CLASS_WEAPONS, MEGAS, PASSIVES, WEAPONS, megaOf, weaponOf } from '../data/weapons.js';
import { previewFrame, previewOn, previewStart, previewStop } from '../game/preview.js';
import { run } from '../game/state.js';
import { withCanvas } from '../render/canvas.js';
import { renderRun } from '../render/draw-world.js';
import { icon } from '../render/icons.js';

const VIEW = 640;   // so viele Spiel-Pixel ist die Vorschau breit
let sel = null, live = false, raf = 0, last = 0;

// Stand im Lauf (nur live): Waffe, Passiv-Stufe
const own = id => (live ? run.weapons.find(w => w.id === id) : null);
const plv = id => (live ? run.passives[id] || 0 : 0);
const evoReady = id => { const w = own(id); return !!w && !w.evo && w.lv >= 5 && plv(WEAPONS[id].with) > 0; };
const ok = b => (live ? (b ? ' <b class="yes">✓</b>' : ' <b class="no">✗</b>') : '');

function nodeCls(k, id) {
  if (!live) return '';
  const w = k === 'w' || k === 'e' ? own(id) : null;
  if (k === 'w') return w ? (w.lv >= 5 ? ' have max' : ' have') : '';
  if (k === 'p') return plv(id) ? ' have' : '';
  if (k === 'e') return w && w.evo ? ' done' : evoReady(id) ? ' ready' : '';
  const ws = MEGAS[id].of.map(own);
  return ws.every(x => x && x.mega) ? ' done' : ws.every(x => x && x.evo) ? ' ready' : '';
}
function node(k, id) {
  const name = k === 'w' ? WEAPONS[id].name : k === 'p' ? PASSIVES[id].name : k === 'e' ? WEAPONS[id].evo : MEGAS[id].name;
  const lv = k === 'w' ? (own(id) || {}).lv : k === 'p' ? plv(id) : 0;
  const img = k === 'm' ? `<span class="mic">${MEGAS[id].of.map(w => `<img src="${icon(w + '_evo')}" alt="">`).join('')}</span>`
    : `<img src="${icon(k === 'e' ? id + '_evo' : id)}" alt="">`;
  return `<button class="en ${k}${nodeCls(k, id)}${sel === k + ':' + id ? ' sel' : ''}" data-n="${k}:${id}" title="${name}" aria-label="${name}">${img}${lv ? `<i>${lv}</i>` : ''}</button>`;
}
function groupHtml(m) {
  const [a, b] = MEGAS[m].of, row = w => `${node('w', w)}<span class="op">+</span>${node('p', WEAPONS[w].with)}<span class="op">→</span>${node('e', w)}`;
  return `<div class="evogrp${nodeCls('m', m)}" style="--mc:${MEGAS[m].col}"><div class="egrid">${row(a)}${row(b)}<span class="brk"></span>${node('m', m)}</div><div class="mname">${MEGAS[m].name}</div></div>`;
}
// Klassenwaffen (Phase 9): Entwicklung ohne Mega-Partner
function clsGroupHtml() {
  const row = w => `${node('w', w)}<span class="op">+</span>${node('p', WEAPONS[w].with)}<span class="op">→</span>${node('e', w)}`;
  return `<div class="evogrp" style="--mc:#c9a35a"><div class="egrid cls">${CLASS_WEAPONS.map(row).join('')}</div><div class="mname">Klassenwaffen</div></div>`;
}
// Im Lauf: Gruppen mit eigenen Waffen zuerst
function order() {
  const ids = Object.keys(MEGAS);
  if (!live) return ids;
  const score = m => MEGAS[m].of.reduce((s, w) => s + (own(w) ? 1 + (own(w).evo ? 1 : 0) : 0), 0);
  return ids.map((m, i) => [m, score(m), i]).sort((x, y) => y[1] - x[1] || x[2] - y[2]).map(x => x[0]);
}

function capHtml(k, id) {
  if (k === 'w') {
    const D = WEAPONS[id], w = own(id);
    return cap(icon(id), D.name, 'Waffe', D.info[0], `${live ? `Stufe ${w ? w.lv : 0}/5 · ` : ''}Mit ${PASSIVES[D.with].name} auf Stufe 5 → <b>${D.evo}</b>`, 'Vorschau: Stufe 5');
  }
  if (k === 'p') {
    const D = PASSIVES[id], wid = weaponOf(id, live ? run.weapons.map(w => w.id) : null);
    return cap(icon(id), D.name, 'Passiv', D.info, wid ? `Entwickelt ${WEAPONS[wid].name} zu <b>${WEAPONS[wid].evo}</b>` : '', wid ? 'Vorschau: ' + WEAPONS[wid].evo : '');
  }
  if (k === 'e') {
    const D = WEAPONS[id], w = own(id), m = megaOf(id);
    return cap(icon(id + '_evo'), D.evo, 'Entwicklung', D.evoInfo,
      `${D.name} Stufe 5${ok(w && w.lv >= 5)} + ${PASSIVES[D.with].name}${ok(plv(D.with) > 0)}${m ? `<br>Mit ${WEAPONS[MEGAS[m].of.find(x => x !== id)].evo} → Mega <b>${MEGAS[m].name}</b>` : ''}`);
  }
  const M = MEGAS[id], [a, b] = M.of;
  return cap(icon(a + '_evo'), M.name, 'Mega-Entwicklung', M.info + ' Beide Waffen +30 % Schaden.',
    `${WEAPONS[a].evo}${ok(own(a) && own(a).evo)} + ${WEAPONS[b].evo}${ok(own(b) && own(b).evo)}<br>Verschmilzt über eine Truhe von Elite, Mini-Boss oder Boss`, '', M.col);
}
function cap(ic, name, tag, info, need, sub = '', col = '') {
  return `<img src="${ic}" alt=""><div><span class="tagx${col ? ' mega' : ''}"${col ? ` style="--mc:${col}"` : ''}>${tag}</span><b class="nm">${name}</b><p>${info}</p>${need ? `<p class="need">${need}</p>` : ''}${sub ? `<p class="evsub">${sub}</p>` : ''}</div>`;
}

function select(key, quiet = false) {
  sel = key;
  const [k, id] = key.split(':');
  document.querySelectorAll('#evoList .en').forEach(b => b.classList.toggle('sel', b.dataset.n === key));
  $('#evoCap').innerHTML = capHtml(k, id);
  previewStart(k, id);
  if (!quiet) sfx.click();
}
// Einstieg: focus = 'e:dagger' usw.; isLive = aus einem laufenden Lauf (Level-Up, Pause)
export function openTree(focus, isLive = false) {
  live = isLive && !!run && !run.over;
  if (!focus) { const w = live && run.weapons.find(x => !x.evo) || live && run.weapons[0]; focus = 'e:' + (w ? w.id : 'dagger'); }
  sel = focus;
  // Klassenwaffen vorn, wenn man im Lauf eine hat
  const cg = clsGroupHtml(), hasCls = live && run.weapons.some(w => WEAPONS[w.id].cls);
  $('#evoList').innerHTML = (hasCls ? cg : '') + order().map(groupHtml).join('') + (hasCls ? '' : cg);
  $('#evoTree').hidden = false;
  select(focus, true);
  const b = $('#evoList .en.sel'); if (b) b.scrollIntoView({ block: 'nearest' });
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}
export function closeTree() { $('#evoTree').hidden = true; previewStop(); }

function frame(now) {
  // Zu (auch von außen, z. B. Szenenwechsel): Vorschau beenden
  if ($('#evoTree').hidden) { raf = 0; previewStop(); return; }
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
  const c = $('#evoCv'), w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (!w || !h || !previewOn()) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  withCanvas(c, w, h, dpr, w / VIEW, () => previewFrame(dt, () => renderRun(now, 1)));
}

$('#evoList').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b && b.dataset.n !== sel) select(b.dataset.n); });
$('#evoTree').addEventListener('click', e => { if (e.target === $('#evoTree') || e.target.closest('#evoClose')) closeTree(); });
