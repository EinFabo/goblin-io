import { go } from '../core/scenes.js';
import { startStage } from './menus.js';
import { $, fmtTime } from '../core/util.js';
import { P, run } from '../game/state.js';
import { ABILITIES } from '../data/abilities.js';
import { levelLabel } from '../data/levels.js';
import { STAGES } from '../data/stages.js';
import { icon } from '../render/icons.js';
import { hatsHtml } from './hats.js';

// ---------- Ergebnis ----------
let showT = 0;
export function showResults(r) {
  const endless = run.st.endless;
  $('#overTitle').textContent = endless ? 'Die Nacht hat dich erwischt!' : r.win ? 'Level geschafft!' : 'Besiegt!';
  $('#overHats').innerHTML = endless ? '' : `<span class="lvlbl">${levelLabel(run.si, run.li)} ${run.st.lvName}</span>${hatsHtml(r.hats, r.newHats)}`;
  const res = [['Zeit', fmtTime(run.st.len && !endless ? Math.min(run.time, run.st.len) : run.time)], ['Level', P.lv], ['Besiegt', run.kills], ['Gold', '+' + r.gold]];
  res.push(['Konto-XP', '+' + r.xp + (r.up ? ` · Level ${r.level}!` : '')]);
  $('#overStats').innerHTML = res.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') +
    (r.unlocked.length ? `<p class="unlock">Neu freigeschaltet: <b>${r.unlocked.join(', ')}</b></p>` : '') +
    r.abil.map(a => `<p class="abxp"><img src="${icon(a.id)}" alt=""><span>${ABILITIES[a.id].name}</span><b>+${a.xp} XP${a.up ? ` · Level ${a.lv}! +${a.up} Skillpunkt${a.up > 1 ? 'e' : ''}` : ''}</b></p>`).join('');
  $('#nextBtn').hidden = !r.next;
  if (r.next) $('#nextBtn').textContent = STAGES[r.next.si].endless ? 'Endlose Nacht' : r.next.si !== run.si ? `Welt ${r.next.si + 1}` : `Weiter: ${levelLabel(r.next.si, r.next.li)}`;
  $('#againBtn').textContent = r.win ? 'Nochmal' : 'Nochmal versuchen';
  $('#menuBtn').textContent = 'Karte';
  showT = setTimeout(() => { $('#over').hidden = false; }, r.win ? 200 : 700);
}
export function hideResults() { clearTimeout(showT); $('#over').hidden = true; }
$('#againBtn').addEventListener('click', () => startStage(run.si, run.li));
$('#nextBtn').addEventListener('click', () => { const n = run.result.next; startStage(n.si, n.li); });
$('#menuBtn').addEventListener('click', () => go('menu'));
