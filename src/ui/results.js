import { go } from '../core/scenes.js';
import { stageCleared } from '../core/save.js';
import { startStage } from './menus.js';
import { $, fmtTime } from '../core/util.js';
import { P, run } from '../game/state.js';
import { treeDef } from '../data/abilities.js';
import { sfx } from '../core/audio.js';
import { levelLabel } from '../data/levels.js';
import { STAGES } from '../data/stages.js';
import { icon } from '../render/icons.js';
import { hatsHtml } from './hats.js';
import { CHESTS, cardName } from '../data/cards.js';
import { chestSvg } from './cardart.js';
import { playChest } from './chest-open.js';
import { cosmTile } from './cosmart.js';
import { COSM } from '../data/cosmetics.js';

// ---------- Ergebnis ----------
let showT = 0;
export function showResults(r) {
  const endless = run.st.endless;
  $('#overTitle').textContent = endless ? 'Die Nacht hat dich erwischt!' : r.win ? (r.nm ? 'Albtraum überstanden!' : 'Level geschafft!') : 'Besiegt!';
  $('#overHats').innerHTML = endless ? '' : `<span class="lvlbl">${levelLabel(run.si, run.li)} ${run.st.lvName}</span>${hatsHtml(r.hats, r.newHats)}`;
  const res = [['Zeit', fmtTime(run.st.len && !endless ? Math.min(run.time, run.st.len) : run.time)], ['Level', P.lv], ['Besiegt', run.kills], ['Gold', '+' + r.gold]];
  res.push(['Konto-XP', '+' + r.xp + (r.up ? ` · Level ${r.level}!` : '')]);
  // Bonus-Level: Level-Ups nach „Level geschafft“ (Gold, ab 3 ein Kartenpaket)
  if (r.bonusLv) res.push(['Bonus-Level ×' + r.bonusLv, '+' + r.bonusGold + ' Gold' + (r.bonusCard ? ` · ${r.bonusCard.n}× ${cardName(r.bonusCard.id)}` : '')]);
  if (r.gems) res.push(['Juwelen', '+' + r.gems]);
  $('#overStats').innerHTML = res.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('') +
    (r.unlocked.length ? `<p class="unlock">Neu freigeschaltet: <b>${r.unlocked.join(', ')}</b></p>` : '') +
    (r.trophy ? `<p class="vchest trophy">${cosmTile(r.trophy)}<span>Trophäe: <b>${COSM[r.trophy].name}</b><br><small>in der Garderobe (Profil)</small></span></p>` : '') +
    (r.chest ? `<p class="vchest">${chestSvg(r.chest.type)}<span>Siegtruhe: <b>${CHESTS[r.chest.type].name}</b><br><small>${r.chest.shelf ? 'liegt im Truhenregal (Laden)' : 'Regal voll – sie ist sofort aufgegangen'}</small></span>${r.chest.shelf ? '' : '<button class="btn small" id="vchestBtn">Ansehen</button>'}</p>` : '') +
    r.abil.map((a, i) => `<p class="abxp${a.up ? ' up' : ''}" style="--i:${i}"><img src="${icon(treeDef(a.id).icon || a.id)}" alt=""><span>${treeDef(a.id).name}</span><b>+${a.xp} XP${a.up ? ` · <em>Level ${a.lv}!</em> +${a.up} Skillpunkt${a.up > 1 ? 'e' : ''}` : ''}</b></p>`).join('');
  $('#nextBtn').hidden = !r.next;
  if (r.next) $('#nextBtn').textContent = STAGES[r.next.si].endless ? 'Endlose Nacht' : r.next.si !== run.si ? `Welt ${r.next.si + 1}` : `Weiter: ${levelLabel(r.next.si, r.next.li)}`;
  $('#againBtn').textContent = r.win ? 'Nochmal' : 'Nochmal versuchen';
  $('#menuBtn').textContent = 'Karte';
  // Fähigkeit aufgestiegen: kleine Feier (springt rein, Funken, Ton), sobald das Ergebnis da ist
  showT = setTimeout(() => { $('#over').hidden = false; if (r.abil.some(a => a.up)) setTimeout(() => sfx.abilUp(), 450); }, r.win ? 200 : 700);
}
export function hideResults() { clearTimeout(showT); $('#over').hidden = true; }
$('#againBtn').addEventListener('click', () => startStage(run.si, run.li, run.nm));
// Albtraum bleibt an, solange das nächste Level in einer geschafften Welt liegt
$('#nextBtn').addEventListener('click', () => { const n = run.result.next; startStage(n.si, n.li, run.nm && stageCleared(n.si)); });
$('#menuBtn').addEventListener('click', () => go('menu'));
$('#overStats').addEventListener('click', e => { if (e.target.closest('#vchestBtn') && run.result.chest) playChest(run.result.chest.res); });
