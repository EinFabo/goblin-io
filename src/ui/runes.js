import { sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $, restart } from '../core/util.js';
import { ABILITIES } from '../data/abilities.js';
import { FUSE_N, RUNES, RUNE_IDS, RUNE_TIERS, SOCKET_LV, parseRune, runeDesc, runeFits, runeKey, tierInfo } from '../data/runes.js';
import { bagCount, canFuse, fuse, socket, socketIdx, socketOpen, socketWhy, socketsOf, unsocket } from '../game/runes.js';
import { runeSvg } from './cardart.js';

// ---------- Runen-Tasche (PLAN Phase 10) ----------
// Overlay aus der Rüstkammer: links die Sockel der Fähigkeit, darunter alle Runen der Tasche (passende zuerst),
// rechts ein Zettel zur gewählten Rune mit Einsetzen, Ausbauen (kostenlos) und Verschmelzen (3 gleiche → nächste Stufe).
let abil = null, slot = 0, sel = null, onChange = () => {}, busy = false;

export function openRunes(id, i = null, changed) {
  abil = id; onChange = changed || (() => {});
  slot = i ?? firstSlot(); sel = socketsOf(save, abil)[slot] || null;
  render();
  $('#runeBag').hidden = false; sfx.treeOpen();
  $('#runeClose').focus({ preventScroll: true });
}
// Erster offener Sockel, bevorzugt ein leerer
function firstSlot() { const s = socketsOf(save, abil); for (let i = 0; i < 2; i++) if (socketOpen(save, abil, i) && !s[i]) return i; return 0; }

// Sortierung: passende zuerst, dann Runenart, höhere Stufe zuerst
function bagKeys() {
  const keys = Object.keys(save.runes.bag).filter(k => bagCount(save, k) > 0 && parseRune(k));
  const ord = k => { const p = parseRune(k); return [runeFits(p.id, abil) ? 0 : 1, RUNE_IDS.indexOf(p.id), -p.tier]; };
  return keys.sort((a, b) => { const x = ord(a), y = ord(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
}

function render() {
  const A = ABILITIES[abil], socks = socketsOf(save, abil);
  $('#runeTitle').textContent = 'Runen · ' + A.name;
  $('#runeSocks').innerHTML = socketIdx(save).map(i => {
    const open = socketOpen(save, abil, i), k = socks[i];
    return `<button class="rsock${i === slot ? ' on' : ''}${open ? '' : ' locked'}" data-slot="${i}" ${open ? '' : 'aria-disabled="true"'} aria-label="Sockel ${i + 1}">
      ${k ? runeSvg(k) : '<span class="hole"></span>'}<small>${open ? `Sockel ${i + 1}` : `ab Level ${SOCKET_LV[i]}`}</small></button>`;
  }).join('');
  const keys = bagKeys();
  $('#runeGrid').innerHTML = keys.length ? keys.map(k => {
    const p = parseRune(k), fits = runeFits(p.id, abil);
    return `<button class="rtile${k === sel ? ' on' : ''}${fits ? '' : ' nofit'}" data-rune="${k}" title="${RUNES[p.id].name}">${runeSvg(k)}<span class="rn">×${bagCount(save, k)}</span>${canFuse(save, k) ? '<span class="rfz" title="Verschmelzen möglich"></span>' : ''}</button>`;
  }).join('') : '<p class="rempty">Noch keine Runen. Runen gibt es in Truhen und als Runenkiste im Laden.</p>';
  renderNote();
}

function renderNote() {
  const socks = socketsOf(save, abil), inSock = socks[slot], open = socketOpen(save, abil, slot);
  let h;
  if (!sel) {
    h = `<h3>Sockel ${slot + 1}</h3>`;
    if (!open) h += `<p class="lock">Öffnet sich, wenn ${ABILITIES[abil].name} Level ${SOCKET_LV[slot]} erreicht (gerade ${(save.abilities[abil] || { lv: 1 }).lv}).</p>`;
    else h += `<p>${inSock ? 'Wähle unten eine Rune zum Tauschen oder baue diese aus.' : 'Wähle unten eine Rune zum Einsetzen.'}</p>`;
    if (inSock) h += runeInfo(inSock) + `<div class="acts"><button class="btn" data-out>Ausbauen</button></div>`;
    $('#runeNote').innerHTML = h; return;
  }
  const p = parseRune(sel), have = bagCount(save, sel), why = socketWhy(save, abil, slot, sel), selIsSock = sel === inSock && !have;
  h = runeInfo(sel);
  if (selIsSock) h += `<p class="c">Steckt in Sockel ${slot + 1}.</p><div class="acts"><button class="btn" data-out>Ausbauen</button></div>`;
  else {
    h += `<p class="c">In der Tasche: ${have}</p>`;
    const up = p.tier < RUNE_TIERS - 1 ? runeKey(p.id, p.tier + 1) : null;
    h += `<div class="acts"><button class="btn primary" data-in ${why ? 'aria-disabled="true"' : ''}>${inSock ? 'Tauschen' : 'Einsetzen'}</button>
      ${up ? `<button class="btn" data-fuse ${canFuse(save, sel) ? '' : 'aria-disabled="true"'}>Verschmelzen ${FUSE_N}→1</button>` : ''}</div>`;
    if (why) h += `<p class="why">${why}.</p>`;
    if (up) h += `<p class="hint">${FUSE_N}× ${tierInfo(p.tier).name} ergibt 1× ${tierInfo(p.tier + 1).name}: ${runeDesc(up)}</p>`;
  }
  $('#runeNote').innerHTML = h;
}
const runeInfo = k => { const p = parseRune(k), T = tierInfo(p.tier); return `<div class="rhead">${runeSvg(k)}<div><h3>${RUNES[p.id].name}</h3><span class="rt" style="--rc:${T.color}">${T.name}</span></div></div><p>${runeDesc(k)}</p>`; };

function act(fn, okSound) {
  if (!fn()) { sfx.buzz(); return false; }
  persist(); okSound(); render(); onChange(); return true;
}

// Verschmelzen: drei Steine fliegen zusammen, Blitz, die neue Rune erscheint (rein optisch, ~1,3 s; die Logik ist schon erledigt)
function playFuse(from, to) {
  const el = $('#runeFuse'), T = tierInfo(parseRune(to).tier);
  el.style.setProperty('--rc', T.color);
  el.innerHTML = `${[0, 1, 2].map(i => `<span class="rf-a rf-${i}">${runeSvg(from)}</span>`).join('')}<span class="rf-flash"></span><span class="rf-new">${runeSvg(to)}<b>${T.name}!</b></span>`;
  el.hidden = false; busy = true; restart(el, 'go');
  setTimeout(() => sfx.anvil(), 550);
  setTimeout(() => { el.hidden = true; el.innerHTML = ''; busy = false; }, 1500);
}

function close() { if (busy) return; $('#runeBag').hidden = true; onChange(); }
$('#runeClose').addEventListener('click', close);
$('#runeBag').addEventListener('click', e => {
  if (busy) return;
  if (e.target === $('#runeBag')) { close(); return; }
  const s = e.target.closest('[data-slot]');
  if (s) { if (!socketOpen(save, abil, +s.dataset.slot)) { sfx.buzz(); restart(s, 'nope'); } slot = +s.dataset.slot; sel = socketsOf(save, abil)[slot] || null; sfx.click(); render(); return; }
  const t = e.target.closest('[data-rune]'); if (t) { sel = t.dataset.rune; sfx.click(); render(); return; }
  if (e.target.closest('[data-in]')) { const b = e.target.closest('[data-in]'); if (!act(() => socket(save, abil, slot, sel), () => sfx.pickCard())) restart(b, 'nope'); else if (!bagCount(save, sel)) { sel = socketsOf(save, abil)[slot]; render(); } return; }
  if (e.target.closest('[data-out]')) { act(() => unsocket(save, abil, slot), () => sfx.click()); return; }
  if (e.target.closest('[data-fuse]')) {
    const from = sel, up = fuse(save, from);
    if (!up) { sfx.buzz(); restart(e.target.closest('[data-fuse]'), 'nope'); return; }
    persist(); playFuse(from, up); sel = bagCount(save, from) ? from : up; render(); onChange();
  }
});
// Esc schließt nur die Tasche (der Fokus kann nach dem Neuzeichnen auf body liegen, daher am Fenster)
window.addEventListener('keydown', e => { if (e.code === 'Escape' && !$('#runeBag').hidden) { e.stopImmediatePropagation(); close(); } }, true);
