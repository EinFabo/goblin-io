import { audioInit, sfx } from '../core/audio.js';
import { persist, save, stageBest, stageCleared, stageUnlocked, talent } from '../core/save.js';
import { go } from '../core/scenes.js';
import { $, fmtTime } from '../core/util.js';
import { ABILITIES, ABILITY_IDS } from '../data/abilities.js';
import { TALENT, TALENTS, talentCost } from '../data/talents.js';
import { STAGES } from '../data/stages.js';
import { accountXpNeed } from '../game/balance.js';
import { icon } from '../render/icons.js';
import { SPR, ensureStage, tinted } from '../render/sprites.js';
import { stageTile } from '../render/tiles.js';
import { setMusic, setMute, setShake } from './settings.js';
import { cleanLoadout, renderArmory } from './armory.js';
import { renderProfile } from './profile.js';

// ---------- Hub (PLAN 10.1): Leiste oben, Tabs unten ----------
// Stage starten; fehlen noch Magier-Bilder, kurz "Lade …" zeigen
export async function startStage(si) {
  const t = setTimeout(() => { $('#loadMsg').textContent = 'Lade Magier …'; $('#loading').classList.add('solo'); $('#loading').hidden = false; }, 120);
  cleanLoadout();
  await ensureStage(si);
  clearTimeout(t); $('#loading').hidden = true; $('#loading').classList.remove('solo');
  go('run', { si });
}
const TABS = ['#shop', '#armory', '#menu', '#profile'];
const OVERLAYS = ['#levelup', '#pause', '#over', '#tree', '#options', '#howto'];
let curTab = null;
export function hideOverlays() { for (const o of OVERLAYS) $(o).hidden = true; }
export function showScreen(id) {
  const from = TABS.indexOf(curTab), to = TABS.indexOf(id);
  curTab = id;
  for (const s of TABS) {
    const el = $(s); el.hidden = s !== id;
    el.classList.remove('from-l', 'from-r');
    if (s === id && from >= 0 && from !== to) { void el.offsetWidth; el.classList.add(to > from ? 'from-r' : 'from-l'); }
  }
  const hub = to >= 0;
  $('#topbar').hidden = $('#tabbar').hidden = !hub;
  document.body.classList.toggle('hub', hub);
  document.querySelectorAll('#tabbar .tab').forEach(b => b.setAttribute('aria-current', b.dataset.tab === id ? 'page' : 'false'));
  if (!hub) return;
  renderTopbar();
  if (id === '#menu') renderCarousel();
  if (id === '#shop') renderShop();
  if (id === '#armory') renderArmory();
  if (id === '#profile') renderProfile();
}
export function renderTopbar() {
  const p = save.profile, need = accountXpNeed(p.level);
  $('#topName').textContent = p.name;
  $('#topLv').textContent = 'Lv ' + p.level;
  $('#topXp').style.width = (p.level >= 50 ? 100 : Math.min(100, p.xp / need * 100)).toFixed(0) + '%';
  $('#topGold').textContent = save.wallet.gold.toLocaleString('de-DE');
}
$('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === curTab) return;
  sfx.tab(); showScreen(b.dataset.tab);
});
$('#topWho').addEventListener('click', () => { if (curTab !== '#profile') { sfx.tab(); showScreen('#profile'); } });

// ---------- Spielen: Stage-Karussell ----------
let cur = 0, swipeX = null;
const thumbs = new Map();
function thumb(i) {
  if (thumbs.has(i)) return thumbs.get(i);
  const st = STAGES[i], c = document.createElement('canvas'); c.width = 300; c.height = 110;
  const g = c.getContext('2d'); g.drawImage(stageTile(i).c, 0, 60, 300, 110, 0, 0, 300, 110);
  const e = SPR[`m.${st.boss.school}.m.idle.left.1`];
  if (e) g.drawImage(st.boss.tint ? tinted(e, st.boss.tint) : e.c, 190, -6, 120, 120);
  if (SPR.idle_right_1) g.drawImage(SPR.idle_right_1.c, 100, 18, 90, 90);
  if (e && SPR.idle_right_1) thumbs.set(i, c);   // erst merken, wenn alle Bilder da sind
  return c;
}
// Fähigkeiten, die ein Sieg auf Stage i freischaltet
const stageReward = i => ABILITY_IDS.filter(id => ABILITIES[id].unlock && ABILITIES[id].unlock.stage === i + 1);
function renderCarousel(dir = 0) {
  cur = Math.max(0, Math.min(STAGES.length - 1, save.lastStage));
  const st = STAGES[cur], locked = !stageUnlocked(cur), best = stageBest(cur), rw = stageReward(cur);
  const card = $('#stCard');
  card.className = 'stcard' + (locked ? ' locked' : '') + (dir ? (dir > 0 ? ' from-r' : ' from-l') : '');
  card.innerHTML = `<div class="thumb"><span class="num">${st.endless ? '∞' : cur + 1}</span>${stageCleared(cur) ? '<span class="chip">Geschafft</span>' : ''}${locked ? '<svg class="lockico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#0a0f06" stroke-width="5"/><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#c9ced2" stroke-width="2.4"/><rect x="4" y="10" width="16" height="12" rx="3" fill="#f4d03f" stroke="#0a0f06" stroke-width="2"/></svg>' : ''}</div>
    <div class="info"><b>${st.name}</b><small>${locked ? 'Gesperrt. Schaffe zuerst Stage ' + cur + '.' : st.sub}</small>
    <small class="meta">${best ? 'Bestzeit ' + fmtTime(best) : st.endless ? 'Wie lange hältst du durch?' : 'Noch nicht gespielt'}${rw.length && !stageCleared(cur) ? ` · Sieg schaltet frei: ${rw.map(id => `<img src="${icon(id)}" alt="">${ABILITIES[id].name}`).join(', ')}` : ''}</small></div>`;
  card.querySelector('.thumb').prepend(thumb(cur));
  $('#stPrev').disabled = cur === 0; $('#stNext').disabled = cur === STAGES.length - 1;
  $('#stDots').innerHTML = STAGES.map((_, i) => `<i class="${i === cur ? 'on' : ''}${stageCleared(i) ? ' done' : ''}${stageUnlocked(i) ? '' : ' lock'}"></i>`).join('');
  const pb = $('#playBtn');
  pb.disabled = locked;
  pb.textContent = locked ? 'Gesperrt' : 'Spielen';
}
function step(d) {
  const n = Math.max(0, Math.min(STAGES.length - 1, cur + d));
  if (n === cur) { sfx.buzz(); return; }
  save.lastStage = n; persist(); sfx.hover(); renderCarousel(d);
}
$('#stPrev').addEventListener('click', () => step(-1));
$('#stNext').addEventListener('click', () => step(1));
$('#playBtn').addEventListener('click', () => { if (stageUnlocked(cur)) { audioInit(); sfx.pickCard(); startStage(cur); } });
$('#stCard').addEventListener('pointerdown', e => { swipeX = e.clientX; });
$('#stCard').addEventListener('pointerup', e => { if (swipeX !== null && Math.abs(e.clientX - swipeX) > 40) step(e.clientX < swipeX ? 1 : -1); swipeX = null; });
$('#stCard').addEventListener('pointercancel', () => { swipeX = null; });
const overlayOpen = () => OVERLAYS.some(o => !$(o).hidden);
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('hub') || e.target.closest('input')) return;
  if (e.code === 'Escape') { for (const o of ['#howto', '#options']) if (!$(o).hidden) { $(o).hidden = true; return; } }
  if (curTab !== '#menu' || overlayOpen()) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') step(-1);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') step(1);
  else if (e.code === 'Enter' && document.activeElement === document.body) $('#playBtn').click();
});

// ---------- Talente (ersetzen die Werkstatt): Stufen mit Gold, ab Konto-Level freigeschaltet ----------
export function renderShop() {
  const gold = save.wallet.gold, acct = save.profile.level;
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
  save.wallet.gold -= cost; save.talents[s.id] = lv + 1; persist(); sfx.buy(); renderShop(); renderTopbar();
});

// ---------- Einstellungen und Hilfe ----------
$('#optBtn').addEventListener('click', () => { $('#options').hidden = false; });
$('#howBtn').addEventListener('click', () => { $('#options').hidden = true; $('#howto').hidden = false; });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.overlay').hidden = true; }));
for (const o of ['#options', '#howto']) $(o).addEventListener('click', e => { if (e.target === $(o)) $(o).hidden = true; });
$('#muteBtn').addEventListener('click', () => setMute(!save.settings.mute));
$('#pMuteBtn').addEventListener('click', () => setMute(!save.settings.mute));
$('#musicBtn').addEventListener('click', () => setMusic(!save.settings.musicOff));
$('#pMusicBtn').addEventListener('click', () => setMusic(!save.settings.musicOff));
$('#shakeBtn').addEventListener('click', () => setShake(!save.settings.shake));
