import { sfx } from '../core/audio.js';
import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { $ } from '../core/util.js';
import { PASSIVES, WEAPONS } from '../data/weapons.js';
import { applyChoice, genChoices } from '../game/levelup.js';
import { P, run } from '../game/state.js';
import { icon } from '../render/icons.js';

let curChoices = [];
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
  return `<button class="${cls}" data-i="${i}"><span class="k">${i + 1}</span><img src="${ic}" alt=""><span class="body"><span class="t">${t}</span>${tag}${pips}<span class="d">${d}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</span></button>`;
}
export function openLevelUp(chest) {
  run.paused = true; Music.stop(); setSprintHeld(false);
  curChoices = genChoices();
  $('#lvTitle').textContent = chest ? 'Schatztruhe!' : 'Level ' + P.lv + '!';
  renderCards(); $('#levelup').hidden = false; sfx.cards();
}
export function renderCards() {
  $('#cards').innerHTML = curChoices.map(cardHtml).join('');
  const rb = $('#rerollBtn'); rb.textContent = `Neu würfeln (${run.rerolls})`; rb.disabled = run.rerolls <= 0;
}
$('#cards').addEventListener('click', e => {
  const b = e.target.closest('.card'); if (!b) return;
  applyChoice(curChoices[+b.dataset.i]);
  $('#levelup').hidden = true; run.paused = false; Music.start();
  sfx.pickCard();
});
$('#rerollBtn').addEventListener('click', () => { if (run.rerolls <= 0) return; run.rerolls--; curChoices = genChoices(); renderCards(); sfx.cards(); });
