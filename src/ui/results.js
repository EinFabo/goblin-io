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
import { HAT_TXT, hatsHtml } from './hats.js';
import { noteNewHats } from './worldmap.js';
import { CHESTS, GEMS, cardName } from '../data/cards.js';
import { burstAt, centerOf, countUp, flyReward } from './rewardfx.js';
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
  const res = [['Zeit', fmtTime(run.st.len && !endless ? Math.min(run.time, run.st.len) : run.time)], ['Level', P.lv], ['Besiegt', run.kills], ['Gold', '+' + r.gold, 'ovGold']];
  res.push(['Konto-XP', '+' + r.xp + (r.up ? ` · Level ${r.level}!` : '')]);
  // Bonus-Level: Level-Ups nach „Level geschafft“ (Gold, ab 3 ein Kartenpaket)
  if (r.bonusLv) res.push(['Bonus-Level ×' + r.bonusLv, '+' + r.bonusGold + ' Gold' + (r.bonusCard ? ` · ${r.bonusCard.n}× ${cardName(r.bonusCard.id)}` : '')]);
  if (r.gems) res.push(['Juwelen', '+' + r.gems, 'ovGems']);
  $('#overStats').innerHTML = res.map(([k, v, id]) => `<div><span>${k}</span><b${id ? ` id="${id}"` : ''}>${v}</b></div>`).join('') +
    (r.unlocked.length ? `<p class="unlock">Neu freigeschaltet: <b>${r.unlocked.join(', ')}</b></p>` : '') +
    (r.trophy ? `<p class="vchest trophy">${cosmTile(r.trophy)}<span>Trophäe: <b>${COSM[r.trophy].name}</b><br><small>in der Garderobe (Profil)</small></span></p>` : '') +
    (r.chest ? `<p class="vchest">${chestSvg(r.chest.type)}<span>Siegtruhe: <b>${CHESTS[r.chest.type].name}</b><br><small>${r.chest.shelf ? 'liegt im Truhenregal (Laden)' : 'Regal voll – sie ist sofort aufgegangen'}</small></span>${r.chest.shelf ? '' : '<button class="btn small" id="vchestBtn">Ansehen</button>'}</p>` : '') +
    r.abil.map((a, i) => `<p class="abxp${a.up ? ' up' : ''}" style="--i:${i}"><img src="${icon(treeDef(a.id).icon || a.id)}" alt=""><span>${treeDef(a.id).name}</span><b>+${a.xp} XP${a.up ? ` · <em>Level ${a.lv}!</em> +${a.up} Skillpunkt${a.up > 1 ? 'e' : ''}` : ''}</b></p>`).join('');
  $('#nextBtn').hidden = !r.next;
  if (r.next) $('#nextBtn').textContent = STAGES[r.next.si].endless ? 'Endlose Nacht' : r.next.si !== run.si ? `Welt ${r.next.si + 1}` : `Weiter: ${levelLabel(r.next.si, r.next.li)}`;
  $('#againBtn').textContent = r.win ? 'Nochmal' : 'Nochmal versuchen';
  $('#menuBtn').textContent = 'Karte';
  $('#overStats').classList.remove('show');
  if (!endless) noteNewHats(run.si, run.li, r.newHats);
  showT = setTimeout(() => { $('#over').hidden = false; hatSequence(r); }, r.win ? 200 : 700);
}

// ---------- Magierhüte nacheinander (Wunsch Fabi: spannend, mit Ton und Effekten) ----------
// Wie Sterne in Level-Complete-Screens: erst drei leere Plätze, dann fällt jeder verdiente Hut einzeln hinein (Funken,
// Ton jedes Mal höher, der dritte mit Akkord). Neue Hüte zeigen „NEU!“ und schicken ihre Juwelen zur Juwelen-Zeile.
// Ein verpasster Hut wackelt grau, darunter steht, was gefehlt hat. Danach kommen die Zeilen, Gold zählt hoch.
// Tippen überspringt die Folge.
let seqT = [], seqDone = null;
function hatSequence(r) {
  const hats = [...document.querySelectorAll('#overHats .hats i')];
  seqT.forEach(clearTimeout); seqT = [];
  const at = (ms, fn) => seqT.push(setTimeout(fn, ms));
  let t = 250;
  if (hats.length && r.win) {
    hats.forEach(h => h.classList.add('wait'));
    for (let i = 0; i < r.hats; i++) {
      const h = hats[i], neu = i >= r.hats - r.newHats;
      at(t, () => {
        h.classList.remove('wait'); h.classList.add('won'); sfx.hat(i, i === 2);
        const c = centerOf(h); burstAt(c.x, c.y, ['#c99bff', '#f4d03f', '#ffffff'], i === 2 ? 30 : 18);
        if (neu) { h.insertAdjacentHTML('beforeend', '<em class="hatnew">NEU!</em>'); }
      });
      t += 450;
    }
    const miss = [0, 1, 2].filter(i => i >= r.hats);
    if (miss.length) at(t, () => {
      for (const i of miss) hats[i].classList.add('miss');
      sfx.hatMiss();
      $('#overHats').insertAdjacentHTML('beforeend', `<p class="hatwhy">Es fehlt: ${miss.map(i => HAT_TXT[i]).join(' · ')}</p>`);
    });
    if (miss.length) t += 400;
  }
  seqDone = () => {
    seqT.forEach(clearTimeout); seqT = []; seqDone = null;
    for (const h of hats) { h.classList.remove('wait'); if (h.classList.contains('on')) h.classList.add('won'); }
    const st = $('#overStats'); st.classList.add('show');
    [...st.children].forEach((el, i) => { el.style.animationDelay = (i * .07) + 's'; });
    const g = $('#ovGold'); if (g) countUp(g, r.gold, 700);
    // Juwelen der neuen Hüte fliegen zur Juwelen-Zeile
    const gem = $('#ovGems');
    if (gem && r.newHats) hats.slice(r.hats - r.newHats, r.hats).forEach((h, k) => setTimeout(() => flyReward(h, 'gems', GEMS.hat, gem), 150 + k * 120));
    if (r.abil.some(a => a.up)) setTimeout(() => sfx.abilUp(), 450);
  };
  at(t, () => seqDone && seqDone());
}
$('#over').addEventListener('pointerdown', e => { if (seqDone && !e.target.closest('button')) seqDone(); });
export function hideResults() { clearTimeout(showT); seqT.forEach(clearTimeout); seqT = []; seqDone = null; $('#over').hidden = true; }
$('#againBtn').addEventListener('click', () => startStage(run.si, run.li, run.nm));
// Albtraum bleibt an, solange das nächste Level in einer geschafften Welt liegt
$('#nextBtn').addEventListener('click', () => { const n = run.result.next; startStage(n.si, n.li, run.nm && stageCleared(n.si)); });
$('#menuBtn').addEventListener('click', () => go('menu'));
$('#overStats').addEventListener('click', e => { if (e.target.closest('#vchestBtn') && run.result.chest) playChest(run.result.chest.res); });
