// Verschmelz-Animation der Mega-Entwicklung (rein optisch, ~2,8 s): Bildschirm dunkel, beide Waffen-Icons
// fliegen von links und rechts in die Mitte, drehen sich ineinander, Blitz, dann erscheint die Mega mit Namen.
// Solange steht der Lauf (run.megaFreeze, scenes/run.js); die Logik ist schon erledigt (game/mega.js).
import { MEGAS } from '../data/weapons.js';
import { sfx } from '../core/audio.js';
import { run } from '../game/state.js';
import { icon } from '../render/icons.js';

const DUR = 2800;
export function playMega(id) {
  const M = MEGAS[id], [a, b] = M.of;
  let el = document.getElementById('megaFx');
  if (!el) { el = document.createElement('div'); el.id = 'megaFx'; document.body.append(el); }
  el.style.setProperty('--mc', M.col);
  el.innerHTML = `<div class="mfx-bg"></div><div class="mfx-rays"></div>
    <img class="mfx-a" src="${icon(a + '_evo')}" alt=""><img class="mfx-b" src="${icon(b + '_evo')}" alt="">
    <div class="mfx-flash"></div>
    <div class="mfx-mega"><img src="${icon(a + '_evo')}" alt=""><img src="${icon(b + '_evo')}" alt=""></div>
    <div class="mfx-text"><small>MEGA-ENTWICKLUNG</small><b>${M.name}</b><span>${M.info}</span></div>`;
  el.className = 'show';
  run.megaFreeze = DUR / 1000;
  setTimeout(() => sfx.bladeUp(), 900);
  setTimeout(() => sfx.ult(), 1150);
  setTimeout(() => { el.className = ''; el.innerHTML = ''; }, DUR);
}
