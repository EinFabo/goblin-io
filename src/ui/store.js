import { sfx } from '../core/audio.js';
import { mulberry32, newSeed } from '../core/rng.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { CHESTS, CHEST_IDS, PITY_EPIC, PITY_LEG, RARITIES, RARITY, SHELF, cardName, skipGems } from '../data/cards.js';
import { chestLeft, chestReady, freeChests, grantCards, grantChest, rollChest, skipUnlock, startUnlock, takeFromShelf, unlocking } from '../game/chests.js';
import { GOLD_PACKS, canPay, dailyOffers, msToMidnight, pay, shopToday } from '../game/shop.js';
import { cardHtml, chestSvg } from './cardart.js';
import { playChest } from './chest-open.js';
import { cardState } from '../game/chests.js';

// ---------- Laden (PLAN 9.5, 9.6): Truhenregal, Tagesangebote, Truhen, Gold ----------
let onChange = () => {};
export function storeChanged(fn) { onChange = fn; }
const price = p => !p ? 'Gratis' : p.gold ? `<span class="coin"></span>${p.gold.toLocaleString('de-DE')}` : `<span class="gem"></span>${p.gems}`;
// Countdown h:mm:ss bzw. m:ss
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const dur = ms => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`; };

export function renderStore() {
  renderShelf(); renderOffers(); renderBuy();
}
// Truhe würfeln, gutschreiben, Animation zeigen
export function openChest(type) {
  const res = rollChest(type, mulberry32(newSeed()), save.pity);
  grantChest(save, res); persist();
  playChest(res, () => { renderStore(); onChange(); });
}

// ---------- Truhenregal: 4 Plätze + Gratis-Truhe ----------
function renderShelf() {
  const now = Date.now(), f = freeChests(save, now), busy = unlocking(save);
  const slots = [];
  for (let i = 0; i < SHELF; i++) {
    const c = save.chests.shelf[i];
    if (!c) { slots.push('<div class="slot4 empty"><span>Leer</span><small>Boss besiegen = Siegtruhe</small></div>'); continue; }
    const C = CHESTS[c.type], ready = chestReady(c, now), left = chestLeft(c, now);
    let act;
    if (ready) act = `<button class="btn primary small" data-open="${i}">Öffnen!</button>`;
    else if (c.end) act = `<span class="cd">${fmtTime(left / 1000)}</span><button class="btn small" data-skip="${i}"><span class="gem"></span>${skipGems(left)}</button>`;
    else act = busy ? `<span class="wait">${dur(C.wait)}</span><button class="btn small" data-skip="${i}"><span class="gem"></span>${skipGems(left)}</button>` : `<button class="btn small" data-start="${i}">Öffnen starten · ${dur(C.wait)}</button>`;
    slots.push(`<div class="slot4${ready ? ' ready' : c.end ? ' ticking' : ''}">${chestSvg(c.type, ready ? 'bob' : '')}<b>${C.name}</b>${act}</div>`);
  }
  const free = `<div class="slot4 free${f.n ? ' ready' : ''}">${chestSvg('wood', f.n ? 'bob' : '')}<b>Gratis-Truhe${f.n > 1 ? ' ×' + f.n : ''}</b>
    ${f.n ? '<button class="btn primary small" data-free>Öffnen!</button>' : `<span class="cd">${fmtTime(f.next / 1000)}</span>`}</div>`;
  $('#chestShelf').innerHTML = free + slots.join('');
}

// ---------- Tagesangebote ----------
function renderOffers() {
  const sh = shopToday(save), offers = dailyOffers(sh.day);
  $('#offerReset').textContent = 'neu in ' + fmtTime(msToMidnight() / 1000);
  $('#offers').innerHTML = offers.map((o, i) => {
    const got = sh.bought.includes(i), ok = canPay(save, o.price);
    let body;
    if (o.k === 'gold') body = `<div class="ofig gold"><span class="coin big"></span></div><b>${o.n} Gold</b>`;
    else if (o.k === 'cards') body = `<div class="ofig">${cardHtml(o.id, cardState(save, o.id))}</div><b>${o.n}× ${cardName(o.id)}</b>`;
    else body = `<div class="ofig">${chestSvg(o.type)}</div><b>${CHESTS[o.type].name}</b><span class="tag">−${Math.round(o.off * 100)} %</span>`;
    return `<div class="offer${got ? ' sold' : ''}">${body}<button class="btn ${got ? 'ghost' : 'primary'} small" data-offer="${i}" ${got ? 'disabled' : ok ? '' : 'aria-disabled="true"'}>${got ? 'Gekauft' : price(o.price)}</button></div>`;
  }).join('');
  $('#goldPacks').innerHTML = GOLD_PACKS.map((g, i) => `<div class="offer"><div class="ofig gold"><span class="coin big"></span>${i ? '<span class="coin big"></span>' : ''}${i > 1 ? '<span class="coin big"></span>' : ''}</div><b>${g.gold.toLocaleString('de-DE')} Gold</b>
    <button class="btn primary small" data-pack="${i}" ${canPay(save, { gems: g.gems }) ? '' : 'aria-disabled="true"'}>${price({ gems: g.gems })}</button></div>`).join('');
}

// ---------- Truhen kaufen (öffnen sofort), ⓘ zeigt Wahrscheinlichkeiten ----------
function renderBuy() {
  $('#chestBuy').innerHTML = CHEST_IDS.map(t => {
    const C = CHESTS[t];
    return `<div class="offer chestoffer">${chestSvg(t)}<b>${C.name}</b><small>${C.cards} Karten · ${C.gold[0]}–${C.gold[1]} Gold</small>
      <div class="row"><button class="iconbtn info" data-odds="${t}" aria-label="Wahrscheinlichkeiten">i</button><button class="btn primary small" data-buy-chest="${t}" ${canPay(save, C.price) ? '' : 'aria-disabled="true"'}>${price(C.price)}</button></div></div>`;
  }).join('');
}
function showOdds(t) {
  const C = CHESTS[t];
  const rows = RARITIES.map((r, k) => C.odds[k] ? `<li style="--rc:${RARITY[r].color}"><span>${RARITY[r].name}</span><b>${C.odds[k]} %</b></li>` : '').join('');
  const pity = C.pity ? `<p>Spätestens jede <b>${PITY_EPIC}.</b> Gold- oder Magiertruhe hat eine epische Karte (noch ${Math.max(1, PITY_EPIC - save.pity.epic)}), jede <b>${PITY_LEG}.</b> eine legendäre (noch ${Math.max(1, PITY_LEG - save.pity.leg)}).</p>` : '';
  $('#oddsPanel').innerHTML = `<div class="phead"><h2>${C.name}</h2><button class="iconbtn" data-close aria-label="Schließen">✕</button></div>
    <p>Pro Karte gilt:</p><ul class="odds">${rows}</ul>
    ${C.sure ? `<p>Garantiert: mindestens ${C.sure[1]} ${RARITY[C.sure[0]].name.toLowerCase()}${C.sure[1] > 1 ? 'e' : ''} Karte${C.sure[1] > 1 ? 'n' : ''}.</p>` : ''}${pity}
    <p class="note">Legendäre Gegenstände gibt es noch nicht – ein legendärer Wurf wird bis dahin zu einer epischen Karte. Im Regal braucht diese Truhe ${dur(C.wait)} zum Öffnen.</p>`;
  $('#oddsInfo').hidden = false;
}

const nope = b => { sfx.buzz(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); };
$('#store').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;
  if (d.free !== undefined) { const f = save.chests.free; if (freeChests(save).n) { f.n--; openChest('wood'); } return; }
  if (d.start !== undefined) { if (startUnlock(save, +d.start)) { persist(); sfx.creak(); renderShelf(); } else nope(b); return; }
  if (d.skip !== undefined) { if (skipUnlock(save, +d.skip)) { persist(); sfx.buy(); renderShelf(); onChange(); } else nope(b); return; }
  if (d.open !== undefined) { const t = takeFromShelf(save, +d.open); if (t) openChest(t); return; }
  if (d.odds) { showOdds(d.odds); return; }
  if (d.buyChest) { const C = CHESTS[d.buyChest]; if (!pay(save, C.price)) { nope(b); return; } openChest(d.buyChest); return; }
  if (d.pack !== undefined) { const g = GOLD_PACKS[+d.pack]; if (!pay(save, { gems: g.gems })) { nope(b); return; } save.wallet.gold += g.gold; persist(); sfx.chest(); renderStore(); onChange(); return; }
  if (d.offer !== undefined) {
    const sh = shopToday(save), i = +d.offer, o = dailyOffers(sh.day)[i];
    if (sh.bought.includes(i) || !pay(save, o.price)) { nope(b); return; }
    sh.bought.push(i);
    if (o.k === 'gold') { save.wallet.gold += o.n; sfx.coin(); }
    else if (o.k === 'cards') { grantCards(save, o.id, o.n); sfx.anvil(); }
    if (o.k === 'chest') { openChest(o.type); return; }
    persist(); renderStore(); onChange();
  }
});
$('#oddsInfo').addEventListener('click', e => { if (e.target === $('#oddsInfo') || e.target.closest('[data-close]')) $('#oddsInfo').hidden = true; });

// Countdown im Regal jede Sekunde auffrischen, solange der Laden offen ist
setInterval(() => { if (!$('#store').hidden && $('#chestOpen').hidden) { renderShelf(); $('#offerReset').textContent = 'neu in ' + fmtTime(msToMidnight() / 1000); } }, 1000);
// Hinweis-Punkt am Tab: Truhe bereit oder Gratis-Truhe da
export function storeHasNews() { const now = Date.now(); return freeChests(save, now).n > 0 || save.chests.shelf.some(c => chestReady(c, now)) || (!unlocking(save) && save.chests.shelf.length > 0); }
