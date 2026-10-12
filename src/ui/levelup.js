import { sfx } from '../core/audio.js';
import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { $ } from '../core/util.js';
import { PASSIVES, WEAPONS } from '../data/weapons.js';
import { SKIP_GOLD, SKIP_HEAL, ban, choose, genChoices, reroll } from '../game/levelup.js';
import { canBan } from '../game/offer.js';
import { P, run } from '../game/state.js';
import { icon } from '../render/icons.js';

// mode: null | 'ban' | 'lock' – Bannen und Sperren wählen zuerst den Modus, dann die Karte
let curChoices = [], mode = null, lockIdx = -1;
const WHY = { evo: '', lock: 'Gesperrt', pity: 'Passt zu deiner Waffe' };
export function pipHtml(cur, next) { let s = '<div class="lvpips">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= cur ? 'on' : i === next ? 'nx' : ''}"></i>`; return s + '</div>'; }
export function cardHtml(c, i) {
  let ic, t, d, tag = '', hint = '', pips = '', cls = 'card';
  if (c.k === 'newW' || c.k === 'upW') {
    const D = WEAPONS[c.id], w = run.weapons.find(x => x.id === c.id), lv = w ? w.lv : 0;
    ic = icon(c.id); t = D.name; d = D.info[lv]; pips = pipHtml(lv, lv + 1);
    tag = lv ? '' : '<span class="tagx new">Neue Waffe</span>';
    hint = 'Entwicklung mit ' + PASSIVES[D.with].name;
  } else if (c.k === 'evo') {
    const D = WEAPONS[c.id]; ic = icon(c.id + '_evo'); t = D.evo; d = D.evoInfo; cls += ' evo'; tag = '<span class="tagx">Entwicklung</span>';
  } else if (c.k === 'newP' || c.k === 'upP') {
    const D = PASSIVES[c.id], lv = run.passives[c.id] || 0;
    ic = icon(c.id); t = D.name; d = D.info; pips = pipHtml(lv, lv + 1);
    tag = lv ? '' : '<span class="tagx new">Neu</span>';
    const evoFor = Object.values(WEAPONS).find(w => w.with === c.id); if (evoFor) hint = 'Entwickelt ' + evoFor.name;
  } else if (c.k === 'heal') { ic = icon('heal'); t = 'Goblin-Eintopf'; d = 'Heilt 40 % deines Lebens.'; }
  else { ic = icon('gold'); t = 'Goldbeutel'; d = '+25 Gold'; }
  if (WHY[c.why]) tag += `<span class="tagx why">${WHY[c.why]}</span>`;
  if (i === lockIdx) cls += ' locked';
  if (mode === 'ban' && !canBan(c)) cls += ' off';
  return `<button class="${cls}" data-i="${i}"><span class="k">${i + 1}</span><img src="${ic}" alt=""><span class="body"><span class="t">${t}</span>${tag}${pips}<span class="d">${d}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</span></button>`;
}
export function openLevelUp(chest) {
  run.paused = true; Music.stop(); setSprintHeld(false);
  curChoices = genChoices(); mode = null; lockIdx = -1;
  $('#lvTitle').textContent = chest ? 'Schatztruhe!' : 'Level ' + P.lv + '!';
  renderCards(); $('#levelup').hidden = false; sfx.cards();
}
export function renderCards() {
  const cards = $('#cards');
  cards.innerHTML = curChoices.map(cardHtml).join('');
  cards.className = 'cards n' + curChoices.length + (mode ? ' mode-' + mode : '');
  const set = (id, txt, dis, on = false) => { const b = $(id); b.textContent = txt; b.disabled = dis; b.classList.toggle('on', on); };
  set('#rerollBtn', `Neu würfeln (${run.rerolls})`, run.rerolls <= 0 || !!mode);
  set('#banBtn', mode === 'ban' ? 'Welche bannen?' : `Bannen (${run.bans})`, run.bans <= 0 || mode === 'lock', mode === 'ban');
  set('#lockBtn', mode === 'lock' ? 'Welche sperren?' : lockIdx >= 0 ? 'Gesperrt ✓' : `Sperren (${run.locks})`, run.locks <= 0 || mode === 'ban', mode === 'lock' || lockIdx >= 0);
  $('#skipGold').textContent = `+${SKIP_GOLD} Gold`;
  $('#skipHeal').textContent = `+${Math.round(SKIP_HEAL * 100)} % Leben`;
  $('#lvNote').textContent = mode === 'ban' ? 'Gebannte Karten kommen in diesem Lauf nie wieder.' : mode === 'lock' ? 'Die gesperrte Karte bleibt fürs nächste Level-Up liegen.' : '';
}
function close(i) {
  choose(curChoices, i, lockIdx);
  $('#levelup').hidden = true; run.paused = false; Music.start();
  sfx.pickCard();
}
$('#cards').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  const i = +b.dataset.i, c = curChoices[i];
  if (mode === 'ban') {
    if (!canBan(c)) return;
    curChoices = ban(curChoices, i); mode = null; if (lockIdx === i) lockIdx = -1;
    renderCards(); sfx.cards(); return;
  }
  if (mode === 'lock') { lockIdx = lockIdx === i ? -1 : i; mode = null; renderCards(); return; }
  close(i);
});
$('#rerollBtn').addEventListener('click', () => { if (run.rerolls <= 0 || mode) return; curChoices = reroll(curChoices); lockIdx = -1; renderCards(); sfx.cards(); });
$('#banBtn').addEventListener('click', () => { if (run.bans <= 0) return; mode = mode === 'ban' ? null : 'ban'; renderCards(); });
$('#lockBtn').addEventListener('click', () => {
  if (run.locks <= 0) return;
  if (lockIdx >= 0 && !mode) lockIdx = -1; else mode = mode === 'lock' ? null : 'lock';
  renderCards();
});
$('#skipGold').addEventListener('click', () => close('gold'));
$('#skipHeal').addEventListener('click', () => close('heal'));
