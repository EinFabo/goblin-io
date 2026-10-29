import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { $ } from '../core/util.js';
import { endRun } from '../game/run.js';
import { P, ownIds, run } from '../game/state.js';
import { PASSIVES, WEAPONS, weaponOf } from '../data/weapons.js';
import { dmgStatHtml } from './dmgstat.js';
import { icon } from '../render/icons.js';
import { openTree } from './evotree.js';
import { slotHtml } from './hud.js';

// ---------- Pause ----------
export function openPause() {
  if (!run || run.over) return;
  // Koop: das Spiel läuft weiter (der Partner spielt ja), nur das Fenster geht auf
  if (!run.coop) { run.paused = true; Music.stop(); }
  setSprintHeld(false);
  const st = [
    ['Leben', Math.ceil(P.hp) + ' / ' + Math.round(P.maxHp)], ['Schaden', '+' + Math.round((P.dmgMult - 1) * 100) + ' %'], ['Abklingzeit', '−' + Math.round((1 - P.cdMult) * 100) + ' %'],
    ['Fläche', '+' + Math.round((P.area - 1) * 100) + ' %'], ['Tempo', Math.round(P.speed)], ['Sammelradius', Math.round(P.magnet)],
    ['Krit-Chance', Math.round(P.crit * 100) + ' %'],
  ];
  // Waffen und Passive antippen: was sie tun und wozu sie sich entwickeln (Phase 15)
  $('#buildList').innerHTML = `<div class="slots">${run.weapons.map(w => `<button class="pslot" data-pinfo="w:${w.id}" aria-label="${WEAPONS[w.id].name}">${slotHtml(icon(w.evo ? w.id + '_evo' : w.id), w.lv, w.evo, false, !!w.mega)}</button>`).join('')}</div>
    <div class="slots">${Object.entries(run.passives).map(([id, lv]) => `<button class="pslot" data-pinfo="p:${id}" aria-label="${PASSIVES[id].name}">${slotHtml(icon(id), lv, false)}</button>`).join('')}</div>
    <div class="pinfo" id="pInfo" hidden></div>
    <div class="statgrid">${st.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>` +
    (() => { const h = dmgStatHtml(5); return h ? `<details class="dmgstat"><summary>Schaden bisher</summary>${h}</details>` : ''; })();
  armQuit(false);
  $('#pause').hidden = false;
}
export function resume() { $('#pause').hidden = true; if (run && $('#levelup').hidden) { run.paused = false; Music.start(); } }
$('#pauseBtn').addEventListener('click', () => openPause());
$('#resumeBtn').addEventListener('click', resume);
$('#pEvoBtn').addEventListener('click', () => openTree(null, true));
$('#buildList').addEventListener('click', e => {
  const b = e.target.closest('[data-pinfo]'), box = $('#pInfo');
  if (e.target.closest('[data-ptree]')) { openTree(e.target.closest('[data-ptree]').dataset.ptree, true); return; }
  if (!b) return;
  const [k, id] = b.dataset.pinfo.split(':'), same = !box.hidden && box.dataset.k === b.dataset.pinfo;
  document.querySelectorAll('#buildList .pslot').forEach(x => x.classList.toggle('on', x === b && !same));
  if (same) { box.hidden = true; return; }
  box.dataset.k = b.dataset.pinfo; box.hidden = false;
  if (k === 'w') {
    const D = WEAPONS[id], w = run.weapons.find(x => x.id === id), P2 = PASSIVES[D.with];
    box.innerHTML = `<b>${w.evo ? D.evo : D.name}</b> <small>${w.evo ? 'entwickelt' : 'Stufe ' + w.lv + ' / 5'}</small><p>${w.evo ? D.evoInfo : D.info[Math.max(0, w.lv - 1)]}</p>` +
      (w.evo ? '' : `<p class="evo">Entwicklung: <b>${D.evo}</b> – Stufe 5 und ${P2 ? P2.name : 'passendes Passiv'}${run.passives[D.with] ? ' ✓' : ''}</p>`) +
      `<button class="btn small ghost" data-ptree="e:${id}">Im Entwicklungs-Baum ansehen</button>`;
  } else {
    const D = PASSIVES[id], wid = weaponOf(id, ownIds());
    box.innerHTML = `<b>${D.name}</b> <small>Stufe ${run.passives[id]} / 5</small><p>${D.info}</p>` +
      (wid ? `<p class="evo">Entwickelt <b>${WEAPONS[wid].name}</b>${run.weapons.some(x => x.id === wid) ? '' : ' (fehlt dir noch)'}</p><button class="btn small ghost" data-ptree="p:${id}">Im Entwicklungs-Baum ansehen</button>` : '');
  }
});
// Aufgeben nur mit zweitem Klick (Phase 15, aus Versehen war der Lauf weg)
let quitArm = 0;
function armQuit(on) { quitArm = on ? performance.now() : 0; $('#quitBtn').textContent = on ? 'Wirklich aufgeben? Nochmal klicken' : 'Aufgeben'; $('#quitBtn').classList.toggle('arm', on); }
$('#quitBtn').addEventListener('click', () => {
  if (!quitArm || performance.now() - quitArm > 4000) { armQuit(true); return; }
  armQuit(false); $('#pause').hidden = true; endRun(false);
});
