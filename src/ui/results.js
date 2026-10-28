import { go } from '../core/scenes.js';
import { stageCleared } from '../core/save.js';
import { startStage } from './menus.js';
import { $, fmtTime } from '../core/util.js';
import { P, run } from '../game/state.js';
import { STAR_MAX, treeDef } from '../data/abilities.js';
import { sfx } from '../core/audio.js';
import { levelLabel } from '../data/levels.js';
import { STAGES } from '../data/stages.js';
import { dropGoblinIcons, icon } from '../render/icons.js';
import { HAT_TXT, hatsHtml } from './hats.js';
import { noteNewHats } from './worldmap.js';
import { CHESTS, GEMS, cardName } from '../data/cards.js';
import { burstAt, centerOf, countUp, flyReward } from './rewardfx.js';
import { chestSvg } from './cardart.js';
import { CLASSES, CLASS_PERKS, hasPerk } from '../data/classes.js';
import { loadGoblin } from '../render/sprites.js';
import { bountyText } from '../game/quests.js';
import { rewardHtml } from './quests.js';
import { playChest } from './chest-open.js';
import { cosmTile } from './cosmart.js';
import { COSM } from '../data/cosmetics.js';

// ---------- Ergebnis ----------
let showT = 0;
export function showResults(r) {
  const endless = run.st.endless;
  $('#overTitle').textContent = endless ? 'Die Nacht hat dich erwischt!' : r.win ? (r.nm ? `Albtraum ${r.nm} überstanden!` : 'Level geschafft!') : 'Besiegt!';
  $('#overHats').innerHTML = endless ? '' : `<span class="lvlbl">${levelLabel(run.si, run.li)} ${run.st.lvName}</span>${hatsHtml(r.hats, r.newHats)}`;
  const res = [['Zeit', fmtTime(run.st.len && !endless ? Math.min(run.time, run.st.len) : run.time)], ['Level', P.lv], ['Besiegt', run.kills], ['Gold', '+' + r.gold, 'ovGold']];
  res.push(['Konto-XP', '+' + r.xp + (r.up ? ` · Level ${r.level}!` : '')]);
  // Bonus-Level: Level-Ups nach „Level geschafft“ (bonusReward in game/balance.js)
  const bc = r.bonusCard, bcTxt = !bc ? '' : bc.gold ? ` · ${cardName(bc.id)} voll → Gold` : ` · ${bc.n}× ${cardName(bc.id)}`;
  if (r.bonusLv) res.push(['Bonus-Level ×' + r.bonusLv, '+' + r.bonusGold + ' Gold' + bcTxt]);
  if (r.gems) res.push(['Juwelen', '+' + r.gems, 'ovGems']);
  $('#overStats').innerHTML = res.map(([k, v, id]) => `<div><span>${k}</span><b${id ? ` id="${id}"` : ''}>${v}</b></div>`).join('') +
    (r.unlocked.length ? `<p class="unlock">Neu freigeschaltet: <b>${r.unlocked.join(', ')}</b></p>` : '') +
    (r.trophy ? `<p class="vchest trophy">${cosmTile(r.trophy)}<span>Trophäe: <b>${COSM[r.trophy].name}</b><br><small>in der Garderobe (Profil)</small></span></p>` : '') +
    (r.chest ? `<p class="vchest">${chestSvg(r.chest.type)}<span>Siegtruhe: <b>${CHESTS[r.chest.type].name}</b><br><small>${r.chest.shelf ? 'liegt im Truhenregal (Laden)' : 'Regal voll – sie ist sofort aufgegangen'}</small></span>${r.chest.shelf ? '' : '<button class="btn small" id="vchestBtn">Ansehen</button>'}</p>` : '') +
    clsXpHtml(r.cls) +
    (r.bounty || []).map(x => { const t = bountyText(x.b); return `<p class="vchest bounty"><span>Kopfgeld erfüllt: <b>${t.goal}</b>${t.cond ? ` (${t.cond})` : ''}</span><span class="rw">${rewardHtml(x.reward)}</span></p>`; }).join('') +
    r.abil.map((a, i) => `<p class="abxp${a.up ? ' up' : ''}" style="--i:${i}"><img src="${icon(treeDef(a.id).icon || a.id)}" alt=""><span>${treeDef(a.id).name}</span><b>+${a.xp} XP${a.up ? ` · <em>Level ${a.lv}!</em> +${a.up} Skillpunkt${a.up > 1 ? 'e' : ''}` : ''}${a.star ? ` · <em>${a.st >= STAR_MAX ? 'Legende!' : 'Neuer Stern!'}</em> ${'★'.repeat(a.st)}` : ''}</b></p>`).join('');
  $('#nextBtn').hidden = !r.next;
  if (r.next) $('#nextBtn').textContent = STAGES[r.next.si].endless ? 'Endlose Nacht' : r.next.si !== run.si ? `Welt ${r.next.si + 1}` : `Weiter: ${levelLabel(r.next.si, r.next.li)}`;
  $('#againBtn').textContent = r.win ? 'Nochmal' : 'Nochmal versuchen';
  $('#menuBtn').textContent = 'Karte';
  $('#overStats').classList.remove('show');
  noteNewHats(run.si, run.li, endless ? 0 : r.newHats);   // auch Endlos: alte Notiz löschen
  showT = setTimeout(() => { $('#over').hidden = false; hatSequence(r); }, r.win ? 200 : 700);
}

// ---------- Magierhüte nacheinander (Wunsch Fabi: spannend, mit Ton und Effekten) ----------
// Wie Sterne in Level-Complete-Screens: erst drei leere Plätze, dann fällt jeder verdiente Hut einzeln hinein (Funken,
// Ton jedes Mal höher, der dritte mit Akkord). Neue Hüte zeigen „NEU!“ und schicken ihre Juwelen zur Juwelen-Zeile.
// Ein verpasster Hut wackelt grau, darunter steht, was gefehlt hat. Danach kommen die Zeilen, Gold zählt hoch.
// Tippen überspringt die Folge.
let seqT = [], seqDone = null;
const at = (ms, fn) => seqT.push(setTimeout(fn, ms));   // alle Zeitgeber der Folge, hideResults räumt sie ab
// Klassen-XP (Phase 9): Zeile wie bei den Fähigkeiten, neue Boni beim Aufstieg
function clsXpHtml(c) {
  if (!c || !c.xp) return '';
  // Meister geworden: goldene Klassenwaffe ab sofort im Hub und im nächsten Lauf
  if (hasPerk(c.lv, 'master') && !hasPerk(c.from, 'master')) loadGoblin().then(dropGoblinIcons);
  const C = CLASSES[c.id], perks = c.up ? CLASS_PERKS.filter(p => p.lv > c.from && p.lv <= c.lv).map(p => p.txt) : [];
  return `<p class="abxp${c.up ? ' up' : ''}"><img src="${icon(C.weapon)}" alt=""><span>${C.name}</span><b>+${c.xp} XP${c.up ? ` · <em>Klassen-Level ${c.lv}!</em>${perks.length ? ' ' + perks.join(', ') : ''}` : ''}</b></p>`;
}
function hatSequence(r) {
  const hats = [...document.querySelectorAll('#overHats .hats i')];
  seqT.forEach(clearTimeout); seqT = [];
  let t = 250;
  if (hats.length && r.win) {
    hats.forEach(h => h.classList.add('wait'));
    for (let i = 0; i < r.hats; i++) {
      const h = hats[i], neu = i >= r.hats - r.newHats;
      at(t, () => {
        h.classList.remove('wait'); h.classList.add('won'); sfx.hat(i, i === 2);
        const c = centerOf(h); burstAt(c.x, c.y, ['#c99bff', '#f4d03f', '#ffffff'], i === 2 ? 30 : 18);
        if (neu) markNew(h);
      });
      t += 450;
    }
    if (r.hats < 3) { at(t, () => { showMiss(r, hats); sfx.hatMiss(); }); t += 400; }
  }
  seqDone = () => {
    seqT.forEach(clearTimeout); seqT = []; seqDone = null;
    // übersprungen: Endzustand herstellen (NEU-Schilder, verpasste Hüte mit Grund)
    hats.forEach((h, i) => { h.classList.remove('wait'); if (h.classList.contains('on')) { h.classList.add('won'); if (r.win && i >= r.hats - r.newHats) markNew(h); } });
    if (r.win && hats.length && r.hats < 3) showMiss(r, hats);
    const st = $('#overStats'); st.classList.add('show');
    [...st.children].forEach((el, i) => { el.style.animationDelay = (i * .07) + 's'; });
    const g = $('#ovGold'); if (g) countUp(g, r.gold, 700);
    // Juwelen der neuen Hüte fliegen zur Juwelen-Zeile
    const gem = $('#ovGems');
    if (gem && r.newHats) hats.slice(r.hats - r.newHats, r.hats).forEach((h, k) => at(150 + k * 120, () => flyReward(h, 'gems', GEMS.hat, gem)));
    if (r.abil.some(a => a.up || a.star) || (r.cls && r.cls.up)) at(450, () => sfx.abilUp());
  };
  at(t, () => seqDone && seqDone());
}
const markNew = h => { if (!h.querySelector('.hatnew')) h.insertAdjacentHTML('beforeend', '<em class="hatnew">NEU!</em>'); };
function showMiss(r, hats) {
  for (let i = r.hats; i < 3; i++) hats[i].classList.add('miss');
  const why = [0, 1, 2].filter(i => (r.hatOk ? !r.hatOk[i] : i >= r.hats));   // die wirklich verpassten Bedingungen
  // mit Weitermachen geschafft: nur der erste Hut zählt (Wunsch Fabi 2026-10-16)
  const txt = r.win && r.cont ? `Mit Weitermachen geschafft (${r.cont}×): nur der erste Hut zählt, keine Bestzeit` : `Es fehlt: ${why.map(i => HAT_TXT[i]).join(' · ')}`;
  if (!$('#overHats .hatwhy')) $('#overHats').insertAdjacentHTML('beforeend', `<p class="hatwhy">${txt}</p>`);
}
$('#over').addEventListener('pointerdown', e => { if (seqDone && !e.target.closest('button')) seqDone(); });
export function hideResults() { clearTimeout(showT); seqT.forEach(clearTimeout); seqT = []; seqDone = null; $('#over').hidden = true; }
$('#againBtn').addEventListener('click', () => startStage(run.si, run.li, run.nm));
// Albtraum bleibt an, solange das nächste Level in einer geschafften Welt liegt
$('#nextBtn').addEventListener('click', () => { const n = run.result.next; startStage(n.si, n.li, stageCleared(n.si) ? run.nm : 0); });
$('#menuBtn').addEventListener('click', () => go('menu'));
$('#overStats').addEventListener('click', e => { if (e.target.closest('#vchestBtn') && run.result.chest) playChest(run.result.chest.res); });
