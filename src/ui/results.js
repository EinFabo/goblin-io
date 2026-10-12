import { go } from '../core/scenes.js';
import { startStage } from './menus.js';
import { $, fmtTime } from '../core/util.js';
import { P, run } from '../game/state.js';

// ---------- Ergebnis ----------
let showT = 0;
export function showResults(r) {
  $('#overTitle').textContent = r.win ? 'Stage geschafft!' : 'Besiegt!';
  const res = [['Zeit', fmtTime(run.time)], ['Level', P.lv], ['Besiegt', run.kills], ['Gold', '+' + r.gold]];
  res.push(['Konto-XP', '+' + r.xp + (r.up ? ` · Level ${r.level}!` : '')]);
  $('#overStats').innerHTML = res.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') +
    (r.unlocked.length ? `<p class="unlock">Neu freigeschaltet: <b>${r.unlocked.join(', ')}</b></p>` : '');
  $('#nextBtn').hidden = !r.next;
  $('#againBtn').textContent = r.win ? 'Nochmal' : 'Nochmal versuchen';
  showT = setTimeout(() => { $('#over').hidden = false; }, r.win ? 200 : 700);
}
export function hideResults() { clearTimeout(showT); $('#over').hidden = true; }
$('#againBtn').addEventListener('click', () => startStage(run.si));
$('#nextBtn').addEventListener('click', () => startStage(run.si + 1));
$('#menuBtn').addEventListener('click', () => go('menu'));
