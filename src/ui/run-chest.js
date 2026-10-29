// Truhe im Lauf (Elite, Boss): kurze Öffnung wie bei Vampire Survivors (rein optisch, ~1,7–2,6 s).
// Truhe springt auf, Licht und Strahlenkranz dahinter, dann je Gewinn eine Walze, die auf dem Gewinn stoppt.
// Die Logik ist schon erledigt (game/levelup.js autoChest meldet das Ereignis autoChest); solange steht die Welt
// (run.megaFreeze in Sekunden Sim-Zeit, nur scenes/run.js und die Eingaben schauen darauf, nie die Logik → die Sim bleibt unberührt).
// Mehrere Truhen (oder Mega-Verschmelzung + Truhe) laufen nacheinander. Tippen oder Leertaste/Enter/Esc überspringt alle.
// Zufall nur für die Optik (Math.random), nie das Sim-rand.
import { sfx } from '../core/audio.js';
import { on } from '../core/events.js';
import { pressInput } from '../core/input.js';
import { WEAPONS, BOONS } from '../data/weapons.js';
import { run } from '../game/state.js';
import { icon } from '../render/icons.js';
import { chestSvg } from './cardart.js';

const ICON = c => c.k === 'evo' ? icon(c.id + '_evo') : c.k === 'gold' ? icon('gold') : c.k === 'boon' ? icon(BOONS[c.id].icon) : icon(c.id);
const durOf = picks => 700 + picks.length * 420 + 650;
let timers = [], watch = 0, el = null;
const showing = () => !!el && el.classList.contains('show');

// picks: [{ k, id, name }], src: 'elite' | 'boss'
export function playRunChest(picks, src = 'elite') {
  if (!picks.length || !run || run.over) return;
  if (!el) { el = document.createElement('div'); el.id = 'runChest'; document.body.append(el); el.addEventListener('pointerdown', e => { e.preventDefault(); finish(); }); }
  // Nach allem, was schon läuft oder wartet (Mega-Verschmelzung, vorige Truhe)
  const wait = Math.max(0, run.megaFreeze || 0) * 1000, dur = durOf(picks);
  run.megaFreeze = (wait + dur) / 1000;
  timers.push(setTimeout(() => start(picks, src, dur), wait));
  if (!watch) watch = setInterval(() => {
    // Lauf vorbei oder verlassen (HUD weg): sofort weg; alles gezeigt: Wache beenden
    if (!run || run.over || !document.querySelector('#hud:not([hidden])')) finish();
    else if (!(run.megaFreeze > 0) && !showing()) stopWatch();
  }, 100);
}
on('autoChest', d => playRunChest(d.picks, d.src));

function start(picks, src, dur) {
  if (!run || run.over) { finish(); return; }
  // Walzen-Futter: Icons der eigenen Waffen und Passive, zuletzt der Gewinn
  const own = [...run.weapons.map(w => icon(w.id)), ...Object.keys(run.passives).map(id => icon(id))];
  const fodder = own.length ? own : Object.keys(WEAPONS).slice(0, 4).map(id => icon(id));
  const reel = (c, i) => {
    const strip = []; for (let j = 0; j < 9; j++) strip.push(fodder[(Math.random() * fodder.length) | 0]);
    strip.push(ICON(c));
    return `<div class="rc-reel${c.k === 'evo' ? ' evo' : ''}" style="--d:${.55 + i * .42}s"><div class="rc-win"><div class="rc-strip">${strip.map(s => `<img src="${s}" alt="">`).join('')}</div></div><b>${c.name}</b></div>`;
  };
  el.innerHTML = `<div class="rc-bg"></div><div class="rc-rays"></div><div class="rc-chest"><div class="rc-glow"></div>${chestSvg(src === 'boss' ? 'gold' : 'iron')}</div><div class="rc-reels">${picks.map(reel).join('')}</div>`;
  el.className = 'show';
  sfx.creak(1);
  timers.push(setTimeout(() => { el.classList.add('open'); sfx.thump(); sfx.lidOpen(src === 'boss' ? 2 : 1); }, 300));
  picks.forEach((c, i) => timers.push(setTimeout(() => { sfx.reveal(c.k === 'evo' ? 3 : c.k === 'gold' ? 0 : 1); if (c.k === 'evo') sfx.ding(); }, (.5 + i * .42) * 1000)));
  timers.push(setTimeout(hideEl, dur));   // die nächste Truhe (falls eine wartet) startet genau dann
}
function hideEl() { if (el) { el.className = ''; el.innerHTML = ''; } }
function stopWatch() { clearInterval(watch); watch = 0; }
// Alles überspringen: Welt läuft sofort weiter. Im Koop als Eingabe (scenes/run.js simStep), damit beide gleich lange
// stehen; die Sim meldet es dann mit freezeSkip zurück, auch an den Partner.
function finish() {
  if (run && run.coop && !run.over && run.megaFreeze > 0) { pressInput('skip'); return; }
  clearShow();
  if (run) run.megaFreeze = 0;
}
function clearShow() { for (const t of timers) clearTimeout(t); timers = []; stopWatch(); hideEl(); }
on('freezeSkip', clearShow);
// Tastatur: vor der normalen Eingabe abfangen, sonst öffnet Esc die Pause unter der Truhe
window.addEventListener('keydown', e => {
  if (!showing() || !['Space', 'Enter', 'Escape', 'KeyP'].includes(e.code)) return;
  e.preventDefault(); e.stopImmediatePropagation(); finish();
}, true);
// Neuer Lauf oder Laufende: nichts mehr zeigen, auch keine noch geplante Öffnung
on('runEnd', () => { if (timers.length) finish(); });
on('runStart', () => { if (timers.length) finish(); });
