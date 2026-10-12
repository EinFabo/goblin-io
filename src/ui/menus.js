import { audioInit, sfx } from '../core/audio.js';
import { persist, save, stageBest, stageCleared, stageUnlocked, talent } from '../core/save.js';
import { go } from '../core/scenes.js';
import { $, fmtTime } from '../core/util.js';
import { SHOP, shopCost } from '../data/shop.js';
import { STAGES } from '../data/stages.js';
import { icon } from '../render/icons.js';
import { SPR, ensureStage, tinted } from '../render/sprites.js';
import { stageTile } from '../render/tiles.js';
import { setMusic, setMute } from './settings.js';
import { showLoadout } from './loadout.js';

// ---------- Menüs ----------
// Stage starten; fehlen noch Magier-Bilder, kurz "Lade …" zeigen
export async function startStage(si) {
  const t = setTimeout(() => { $('#loading').textContent = 'Lade Magier …'; $('#loading').hidden = false; }, 120);
  await ensureStage(si);
  clearTimeout(t); $('#loading').hidden = true;
  go('run', { si });
}
const SCREENS = ['#menu', '#stages', '#loadout', '#shop', '#howto'];
const OVERLAYS = ['#levelup', '#pause', '#over', '#tree'];
export function hideOverlays() { for (const o of OVERLAYS) $(o).hidden = true; }
export function showScreen(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  if (id === '#menu') $('#menuGold').textContent = save.wallet.gold;
  if (id === '#stages') renderStages();
  if (id === '#shop') renderShop();
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
    b.addEventListener('click', () => { audioInit(); sfx.pickCard(); showScreen('#loadout'); showLoadout(i, startStage); });
    g.appendChild(b);
  });
}
export function renderShop() {
  const gold = save.wallet.gold;
  $('#shopGold').textContent = gold;
  $('#shopList').innerHTML = SHOP.map(s => {
    const lv = talent(s.id), max = lv >= s.max, cost = shopCost(s, lv);
    let pips = ''; for (let i = 0; i < s.max; i++) pips += `<i class="${i < lv ? 'on' : ''}"></i>`;
    return `<div class="shopitem"><img src="${icon(s.icon)}" alt=""><span class="t">${s.name}</span><span class="d">${s.desc} pro Stufe</span>
      <div class="pips">${pips}</div>
      <button class="btn ${max ? 'ghost' : 'primary'}" data-buy="${s.id}" ${max || gold < cost ? 'disabled' : ''}>${max ? 'Maximal' : `<span class="coin"></span>${cost}`}</button></div>`;
  }).join('');
}
$('#shopList').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'); if (!b) return;
  const s = SHOP.find(x => x.id === b.dataset.buy), lv = talent(s.id), cost = shopCost(s, lv);
  if (lv >= s.max || save.wallet.gold < cost) { sfx.buzz(); return; }
  save.wallet.gold -= cost; save.talents[s.id] = lv + 1; persist(); sfx.buy(); renderShop();
});
$('#playBtn').addEventListener('click', () => showScreen('#stages'));
$('#loadBack').addEventListener('click', () => showScreen('#stages'));
$('#shopBtn').addEventListener('click', () => showScreen('#shop'));
$('#howBtn').addEventListener('click', () => showScreen('#howto'));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => showScreen('#menu')));
$('#muteBtn').addEventListener('click', () => setMute(!save.settings.mute));
$('#pMuteBtn').addEventListener('click', () => setMute(!save.settings.mute));
$('#musicBtn').addEventListener('click', () => setMusic(!save.settings.musicOff));
$('#pMusicBtn').addEventListener('click', () => setMusic(!save.settings.musicOff));
