import { setSprintHeld } from '../core/input.js';
import { Music } from '../core/music.js';
import { $ } from '../core/util.js';
import { endRun } from '../game/run.js';
import { P, run } from '../game/state.js';
import { icon } from '../render/icons.js';
import { slotHtml } from './hud.js';

// ---------- Pause ----------
export function openPause() {
  if (!run || run.over) return;
  run.paused = true; Music.stop(); setSprintHeld(false);
  const st = [
    ['Leben', Math.ceil(P.hp) + ' / ' + Math.round(P.maxHp)], ['Schaden', '+' + Math.round((P.dmgMult - 1) * 100) + ' %'], ['Abklingzeit', '−' + Math.round((1 - P.cdMult) * 100) + ' %'],
    ['Fläche', '+' + Math.round((P.area - 1) * 100) + ' %'], ['Tempo', Math.round(P.speed)], ['Sammelradius', Math.round(P.magnet)],
    ['Krit-Chance', Math.round(P.crit * 100) + ' %'],
  ];
  $('#buildList').innerHTML = `<div class="slots">${run.weapons.map(w => slotHtml(icon(w.evo ? w.id + '_evo' : w.id), w.lv, w.evo, false, !!w.mega)).join('')}</div>
    <div class="slots">${Object.entries(run.passives).map(([id, lv]) => slotHtml(icon(id), lv, false)).join('')}</div>
    <div class="statgrid">${st.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
  $('#pause').hidden = false;
}
export function resume() { $('#pause').hidden = true; if (run && $('#levelup').hidden) { run.paused = false; Music.start(); } }
$('#pauseBtn').addEventListener('click', () => openPause());
$('#resumeBtn').addEventListener('click', resume);
$('#quitBtn').addEventListener('click', () => { $('#pause').hidden = true; endRun(false); });
