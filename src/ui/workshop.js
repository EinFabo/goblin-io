import { sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { CARD_IDS, CARD_MAX, CARD_RARITY, RARITIES, RARITY, cardName, cardPerks, isWeapon, upgradeCost } from '../data/cards.js';
import { PASSIVES, WEAPONS } from '../data/weapons.js';
import { canUpgrade, cardState, upgradeCard } from '../game/chests.js';
import { cardHtml } from './cardart.js';

// ---------- Werkstatt: Reiter Karten (9.3) und Talente (9.4) ----------
let sub = 'cards', onChange = () => {}, renderTalents = () => {};
export function workshopHooks(changed, talents) { onChange = changed; renderTalents = talents; }
export function renderWorkshop() {
  document.querySelectorAll('#shop .sub').forEach(b => b.setAttribute('aria-selected', String(b.dataset.sub === sub)));
  $('#cardsView').hidden = sub !== 'cards'; $('#talentsView').hidden = sub !== 'talents';
  if (sub === 'cards') renderCards(); else renderTalents();
}
// Waffen zuerst, je nach Seltenheit sortiert
const ORDER = [...CARD_IDS].sort((a, b) => (isWeapon(b) - isWeapon(a)) || RARITIES.indexOf(CARD_RARITY[a]) - RARITIES.indexOf(CARD_RARITY[b]));
function renderCards() {
  $('#cardGrid').innerHTML = ORDER.map(id => `<button class="cardbtn" data-card="${id}" aria-label="${cardName(id)}">${cardHtml(id, cardState(save, id))}</button>`).join('');
}
export const anyUpgrade = () => CARD_IDS.some(id => canUpgrade(save, id));

// ---------- Kartendetails mit Aufwerten ----------
let cur = null;
function showCard(id) {
  cur = id;
  const st = cardState(save, id), r = CARD_RARITY[id], cost = upgradeCost(id, st.lv), max = st.lv >= CARD_MAX;
  const info = isWeapon(id) ? WEAPONS[id].info[0] : PASSIVES[id].info + ' pro Stufe im Lauf';
  const now = cardPerks(id, st.lv), next = max ? [] : cardPerks(id, st.lv + 1);
  const ok = cost && st.n >= cost.cards, gold = cost && save.wallet.gold >= cost.gold;
  $('#cardPanel').innerHTML = `<div class="phead"><h2>${cardName(id)}</h2><button class="iconbtn" data-close aria-label="Schließen">✕</button></div>
    <div class="cdetail"><div class="cbig" id="cardBig">${cardHtml(id, st)}</div>
      <div><span class="rtag" style="--rc:${RARITY[r].color}">${RARITY[r].name}</span><p>${info}</p>
        <h4>Stufe ${st.lv}${max ? ' (Maximum)' : ` → ${st.lv + 1}`}</h4>
        <ul class="perks">${now.map((p, i) => `<li>${p}${!max && next[i] !== p ? ` <b>→ ${next[i]}</b>` : ''}</li>`).join('')}${next.slice(now.length).map(p => `<li class="new">Neu: <b>${p}</b></li>`).join('')}</ul>
        ${max ? '<p class="ok">Voll ausgebaut. Weitere Karten werden zu Gold.</p>'
    : `<button class="btn primary up" id="cardUp" ${ok && gold ? '' : 'aria-disabled="true"'}>Aufwerten · <span class="coin"></span>${cost.gold.toLocaleString('de-DE')}</button>
        <p class="need">${ok ? (gold ? 'Bereit zum Aufwerten!' : `Es fehlen ${(cost.gold - save.wallet.gold).toLocaleString('de-DE')} Gold.`) : `Noch ${cost.cards - st.n} Karten nötig (aus Truhen und dem Laden).`}</p>`}
      </div></div>`;
  $('#cardInfo').hidden = false;
}
function doUpgrade() {
  if (!upgradeCard(save, cur)) { sfx.buzz(); const b = $('#cardUp'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
  persist(); sfx.anvil();
  showCard(cur);
  const big = $('#cardBig'); big.classList.add('forged');
  renderCards(); onChange();
}
$('#cardGrid').addEventListener('click', e => { const b = e.target.closest('[data-card]'); if (b) { sfx.click(); showCard(b.dataset.card); } });
$('#cardInfo').addEventListener('click', e => {
  if (e.target === $('#cardInfo') || e.target.closest('[data-close]')) { $('#cardInfo').hidden = true; return; }
  if (e.target.closest('#cardUp')) doUpgrade();
});
$('#shop').addEventListener('click', e => { const b = e.target.closest('[data-sub]'); if (!b || b.dataset.sub === sub) return; sub = b.dataset.sub; sfx.tab(); renderWorkshop(); });
