import { sfx } from '../core/audio.js';
import { persist, save, talent } from '../core/save.js';
import { go } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { TALENT, TALENTS, talentCost } from '../data/talents.js';
import { accountXpNeed } from '../game/balance.js';
import { icon } from '../render/icons.js';
import { ensureStage, rushing } from '../render/sprites.js';
import { cleanLoadout, renderArmory } from './armory.js';
import { renderProfile } from './profile.js';
import { mapKey, onStart, renderMap } from './worldmap.js';
import { renderStore, storeChanged, storeHasNews } from './store.js';
import { anyUpgrade, renderWorkshop, workshopHooks } from './workshop.js';
import { renderWardrobe, wardrobeChanged } from './wardrobe.js';
import { profileHooks } from './profile.js';
import { achChanged, achNews, renderAch } from './achievements.js';
import { shownWallet } from './rewardfx.js';
import { closeTree } from './evotree.js';

// ---------- Hub (PLAN 10.1): Leiste oben, Tabs unten ----------
// Stage starten; fehlen noch Magier-Bilder, kurz "Lade …" zeigen
// nm: Albtraum-Modus
export async function startStage(si, li = 0, nm = false) {
  const t = setTimeout(() => { $('#loadMsg').textContent = 'Lade Magier …'; $('#loading').classList.add('solo'); $('#loading').hidden = false; }, 120);
  cleanLoadout();
  await rushing(ensureStage(si));
  clearTimeout(t); $('#loading').hidden = true; $('#loading').classList.remove('solo');
  go('run', { si, li, nm });
}
const TABS = ['#store', '#shop', '#menu', '#armory', '#profile'];
const OVERLAYS = ['#levelup', '#pause', '#over', '#tree', '#evoTree', '#options', '#howto', '#cardInfo', '#oddsInfo', '#chestOpen', '#runeBag', '#cont'];
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
  if (id === '#menu') renderMap();
  if (id === '#shop') renderWorkshop();
  if (id === '#store') renderStore();
  if (id === '#armory') renderArmory();
  if (id === '#profile') renderProfile();
}
export function renderTopbar() {
  const p = save.profile, need = accountXpNeed(p.level);
  $('#topName').textContent = p.name;
  $('#topLv').textContent = 'Lv ' + p.level;
  $('#topXp').style.width = (p.level >= 50 ? 100 : Math.min(100, p.xp / need * 100)).toFixed(0) + '%';
  // was gerade zum Zähler fliegt, zählt erst beim Ankommen (ui/rewardfx.js)
  const w = shownWallet();
  $('#topGold').textContent = w.gold.toLocaleString('de-DE');
  $('#topGems').textContent = w.gems.toLocaleString('de-DE');
  // Hinweis-Punkte: Truhe bereit / Karte aufwertbar
  $('#storeDot').hidden = !storeHasNews(); $('#shopDot').hidden = !anyUpgrade(); $('#achDot').hidden = $('#profDot').hidden = !achNews();
}
storeChanged(renderTopbar);
wardrobeChanged(renderTopbar);
profileHooks({ ward: renderWardrobe, ach: renderAch });
achChanged(renderTopbar);
workshopHooks(renderTopbar, () => renderShop());
setInterval(() => { if (document.body.classList.contains('hub')) $('#storeDot').hidden = !storeHasNews(); }, 5000);
$('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b || b.dataset.tab === curTab) return;
  sfx.tab(); showScreen(b.dataset.tab);
});
$('#topWho').addEventListener('click', () => { if (curTab !== '#profile') { sfx.tab(); showScreen('#profile'); } });

// ---------- Spielen: Weltkarte (ui/worldmap.js) ----------
onStart((si, li, nm) => startStage(si, li, nm));
const overlayOpen = () => OVERLAYS.some(o => !$(o).hidden);
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('hub') || e.target.closest('input')) return;
  if (e.code === 'Escape') {
    if (!$('#evoTree').hidden) { closeTree(); return; }
    for (const o of ['#howto', '#options', '#cardInfo', '#oddsInfo']) if (!$(o).hidden) { $(o).hidden = true; return; }
  }
  if (curTab === '#menu' && !overlayOpen()) mapKey(e);
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
// Zahnrad im Hub und Knopf in der Pause öffnen dasselbe Fenster
for (const b of ['#optBtn', '#pOptBtn']) $(b).addEventListener('click', () => { $('#options').hidden = false; });
$('#howBtn').addEventListener('click', () => { $('#options').hidden = true; $('#howto').hidden = false; });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { b.closest('.overlay').hidden = true; }));
for (const o of ['#options', '#howto']) $(o).addEventListener('click', e => { if (e.target === $(o)) $(o).hidden = true; });
