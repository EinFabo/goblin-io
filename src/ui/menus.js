import { audioInit, sfx } from '../core/audio.js';
import { persist, save, stageBest, stageCleared, stageUnlocked, talent } from '../core/save.js';
import { go } from '../core/scenes.js';
import { $, fmtTime } from '../core/util.js';
import { TALENT, TALENTS, talentCost } from '../data/talents.js';
import { STAGES } from '../data/stages.js';
import { icon } from '../render/icons.js';
import { SPR, ensureStage, tinted } from '../render/sprites.js';
import { stageTile } from '../render/tiles.js';
import { setMusic, setMute } from './settings.js';
import { cleanLoadout, renderArmory } from './armory.js';

// ---------- Menüs ----------
// Stage starten; fehlen noch Magier-Bilder, kurz "Lade …" zeigen
export async function startStage(si) {
  const t = setTimeout(() => { $('#loading').textContent = 'Lade Magier …'; $('#loading').hidden = false; }, 120);
  cleanLoadout();
  await ensureStage(si);
  clearTimeout(t); $('#loading').hidden = true;
  go('run', { si });
}
const SCREENS = ['#menu', '#stages', '#armory', '#shop', '#howto'];
const OVERLAYS = ['#levelup', '#pause', '#over', '#tree'];
export function hideOverlays() { for (const o of OVERLAYS) $(o).hidden = true; }
export function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  if (id === '#menu') $('#menuGold').textContent = save.wallet.gold;
  if (id === '#stages') renderStages();
  if (id === '#shop') renderShop();
  if (id === '#armory') renderArmory();
}
export function renderStages() {
  const g = $('#stageGrid'); g.innerHTML = '';
  STAGES.forEach((st, i) => {
    const locked = !stageUnlocked(i);
    const b = document.createElement('button');
    b.className = 'stage'; b.disabled = locked;
    const best = stageBest(i) ? 'Bestzeit ' + fmtTime(stageBest(i)) : '';
    b.innerHTML = `<div class="thumb"><span class="num">${st.endless ? '∞' : i + 1}</span>${stageCleared(i) ? '<span class="chip">Geschafft</span>' : ''}</div>
      <div class="info"><b>${st.name}</b><small>${locked ? 'Gesperrt. Schaffe zuerst Stage ' + i + '.' : st.sub}</small>${best ? `<small>${best}</small>` : ''}</div>`;
    const tc = document.createElement('canvas'); tc.width = 300; tc.height = 110;
    const tg = tc.getContext('2d'); tg.drawImage(stageTile(i).c, 0, 60, 300, 110, 0, 0, 300, 110);
    const e = SPR[`m.${st.boss.school}.m.idle.left.1`];
    if (e) tg.drawImage(st.boss.tint ? tinted(e, st.boss.tint) : e.c, 190, -6, 120, 120);
    if (SPR.idle_right_1) tg.drawImage(SPR.idle_right_1.c, 100, 18, 90, 90);
    b.querySelector('.thumb').prepend(tc);
    b.addEventListener('click', () => { audioInit(); sfx.pickCard(); startStage(i); });
    g.appendChild(b);
  });
}
// Talente (ersetzen die Werkstatt): Stufen mit Gold, ab Konto-Level freigeschaltet
export function renderShop() {
  const gold = save.wallet.gold, acct = save.profile.level;
  $('#shopGold').textContent = gold;
  $('#shopList').innerHTML = TALENTS.map(s => {
    const lv = talent(s.id), max = lv >= s.max, cost = talentCost(s, lv), locked = acct < s.acct;
    const pips = s.max > 10 ? `<div class="tbar"><i style="width:${lv / s.max * 100}%"></i><span>${lv} / ${s.max}</span></div>` : `<div class="pips">${Array.from({ length: s.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>`;
    const btn = locked ? `<button class="btn ghost" disabled>ab Konto-Level ${s.acct}</button>` : `<button class="btn ${max ? 'ghost' : 'primary'}" data-buy="${s.id}" ${max || gold < cost ? 'disabled' : ''}>${max ? 'Maximal' : `<span class="coin"></span>${cost}`}</button>`;
    return `<div class="shopitem${locked ? ' locked' : ''}"><img src="${icon(s.icon)}" alt=""><span class="t">${s.name}</span><span class="d">${s.desc} pro Stufe</span>
      ${pips}${btn}</div>`;
  }).join('');
}
$('#shopList').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'); if (!b) return;
  const s = TALENT[b.dataset.buy], lv = talent(s.id), cost = talentCost(s, lv);
  if (lv >= s.max || save.wallet.gold < cost || save.profile.level < s.acct) { sfx.buzz(); return; }
  save.wallet.gold -= cost; save.talents[s.id] = lv + 1; persist(); sfx.buy(); renderShop();
});
$('#playBtn').addEventListener('click', () => showScreen('#stages'));
$('#armBtn').addEventListener('click', () => showScreen('#armory'));
$('#shopBtn').addEventListener('click', () => showScreen('#shop'));
$('#howBtn').addEventListener('click', () => showScreen('#howto'));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => showScreen('#menu')));
$('#muteBtn').addEventListener('click', () => setMute(!save.settings.mute));
$('#pMuteBtn').addEventListener('click', () => setMute(!save.settings.mute));
$('#musicBtn').addEventListener('click', () => setMusic(!save.settings.musicOff));
$('#pMusicBtn').addEventListener('click', () => setMusic(!save.settings.musicOff));
