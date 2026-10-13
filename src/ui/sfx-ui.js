import { audioInit, sfx } from '../core/audio.js';

// UI-Klänge: Hover und Klick für alle Knöpfe
export let lastHover = null;
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const b = e.target.closest('button'); if (b === lastHover) return; lastHover = b;
  if (!b || b.disabled || b.classList.contains('abil')) return;
  b.classList.contains('card') ? sfx.hoverCard() : sfx.hover();
});
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  audioInit();
  if (b.classList.contains('card') || b.dataset.buy || b.classList.contains('tab')) return;
  b.disabled ? sfx.buzz() : sfx.click();
}, true);
