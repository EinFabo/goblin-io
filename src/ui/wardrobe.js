import { sfx } from '../core/audio.js';
import { mulberry32, newSeed } from '../core/rng.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { COSM, COSMETICS, COSMO_CHEST, SLOTS } from '../data/cosmetics.js';
import { equip, equipped, grantCosmetic, missing, owns, rollCosmetic } from '../game/cosmetics.js';
import { canPay, pay } from '../game/shop.js';
import { goblinSvg } from '../gen/goblin.js';
import { DIRS8 } from '../gen/svg.js';
import { loadGoblin, loadImg } from '../render/sprites.js';
import { cosmImg, cosmTile } from './cosmart.js';
import { playChest } from './chest-open.js';

// ---------- Garderobe (PLAN 10.1, 9.7): Goblin dreht sich, Slots, Auswahl ----------
let slot = 'hat', onChange = () => {};
export function wardrobeChanged(fn) { onChange = fn; }
const look = () => ({ skin: save.look.skin, outfit: save.look.outfit, hat: save.look.hat });

export function renderWardrobe() {
  $('#wardSlots').innerHTML = SLOTS.map(s => `<button class="wslot${s.id === slot ? ' on' : ''}" data-wslot="${s.id}" role="tab" aria-selected="${s.id === slot}"><img src="${cosmImg(s.id + '.' + save.look[s.id])}" alt=""><span>${s.name}</span></button>`).join('');
  const items = COSMETICS.filter(c => c.slot === slot), have = items.filter(c => owns(save, c.id)).length;
  $('#wardTitle').innerHTML = `${SLOTS.find(s => s.id === slot).name} <small>${have} / ${items.length}</small>`;
  $('#wardItems').innerHTML = items.map(c => {
    const own = owns(save, c.id), on = equipped(save, c.id);
    const src = own ? '' : c.src === 'chest' ? 'Kosmetiktruhe oder Laden' : c.src;
    return `<button class="cbtn" data-cosm="${c.id}" ${own ? '' : 'aria-disabled="true"'}>${cosmTile(c.id, (on ? 'on ' : '') + (own ? '' : 'locked'))}${src ? `<span class="src">${src}</span>` : ''}</button>`;
  }).join('');
  const left = missing(save).length, ok = left && canPay(save, COSMO_CHEST.price);
  $('#wardChest').innerHTML = `<button class="btn ${left ? 'primary' : 'ghost'}" data-cosmo ${left ? (ok ? '' : 'aria-disabled="true"') : 'disabled'}>${left ? `Kosmetiktruhe · <span class="gem"></span>${COSMO_CHEST.price.gems}` : 'Alles aus Truhen gesammelt!'}</button>
    <small>${left ? `Ein Teil, das du noch nicht hast (noch ${left}). Gewöhnlich 70 %, selten 22 %, episch 7 %, legendär 1 %.` : ''}</small>`;
  preview();
}

// Kosmetiktruhe öffnen (auch aus dem Laden)
export function openCosmoChest(after = () => {}) {
  if (!missing(save).length || !pay(save, COSMO_CHEST.price)) return false;
  const id = rollCosmetic(save, mulberry32(newSeed()));
  grantCosmetic(save, id); persist();
  const c = COSM[id];
  playChest({ type: 'cosmo', gold: 0, cards: [], cosmetic: id, best: c.rarity }, () => { slot = c.slot; renderWardrobe(); onChange(); after(); });
  return true;
}

// ---------- Vorschau: Goblin dreht sich langsam durch alle 8 Richtungen ----------
let frames = null, frameKey = '', raf = 0;
async function preview() {
  const L = look(), key = JSON.stringify(L);
  if (key !== frameKey) {
    frameKey = key;
    const imgs = await Promise.all(DIRS8.map(d => loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(goblinSvg(d, 'idle', 0, L)))));
    if (frameKey === key) frames = imgs;
  }
  if (!raf) raf = requestAnimationFrame(draw);
}
function draw(t) {
  const cv = $('#wardGob');
  if ($('#wardView').hidden || $('#profile').hidden) { raf = 0; return; }
  raf = requestAnimationFrame(draw);
  if (!frames) return;
  // Reihenfolge der Drehung: unten → links → oben → rechts
  const order = [2, 3, 4, 5, 6, 7, 0, 1], i = order[Math.floor(t / 700) % 8], img = frames[i], g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (img) { const bob = Math.sin(t / 300) * 3; g.drawImage(img, 0, bob, cv.width, cv.height); }
}

let reload = 0;
$('#wardView').addEventListener('click', e => {
  const s = e.target.closest('[data-wslot]');
  if (s) { slot = s.dataset.wslot; sfx.tab(); renderWardrobe(); return; }
  if (e.target.closest('[data-cosmo]')) { if (!openCosmoChest()) sfx.buzz(); else onChange(); return; }
  const b = e.target.closest('[data-cosm]'); if (!b) return;
  if (!equip(save, b.dataset.cosm)) { sfx.buzz(); return; }
  persist(); sfx.pickCard(); renderWardrobe(); onChange();
  // Spiel-Sprites im Hintergrund neu erzeugen (kurz warten, falls schnell weitergeklickt wird)
  clearTimeout(reload); reload = setTimeout(() => loadGoblin(), 400);
});
