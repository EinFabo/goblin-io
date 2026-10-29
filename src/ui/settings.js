import { applyGains, sfx, thr } from '../core/audio.js';
import { ACTIONS, CHOICE, UI_SCALE, bindKey, dev, keyName, resetKeys, saveDevice } from '../core/device.js';
import { resize } from '../render/canvas.js';
import { setWindowSize } from './platform.js';
import { keepAwake } from './haptics.js';
import { fpsNow } from '../core/loop.js';
import { Music } from '../core/music.js';
import { persist, save } from '../core/save.js';
import { $, setUiz } from '../core/util.js';
import { emit } from '../core/events.js';
const emitKeys = () => emit('keysChanged');   // Tasten-Beschriftungen (HUD, Rüstkammer) folgen der Belegung
import { run } from '../game/state.js';

// ---------- Einstellungen (PLAN 10.1): Ton, Spiel, Steuerung ----------
// Größe der Handy-Knöpfe (#ctrl) je Stufe
const BTN_SCALE = { s: .85, m: 1, l: 1.2 };
const S = () => save.settings;
const setSw = (id, on) => (typeof id === 'string' ? $(id) : id).setAttribute('aria-checked', String(on));

// Ton/Musik an/aus. Einschalten mit Lautstärke 0 holt die Hälfte zurück, sonst bliebe es still.
export function setMute(m) {
  S().mute = m; if (!m && !S().sfxVol) S().sfxVol = .5;
  persist(); applySound();
}
export function setMusic(off) {
  S().musicOff = off; if (!off && !S().musVol) S().musVol = .5;
  persist(); applySound();
  // wieder an: im Menü sofort (Titelmusik), im Lauf erst nach der Pause
  if (off) Music.stop(); else if (!run) Music.start();
}

// Lautstärken an die Busse, Schalter und Regler im Fenster
function applySound() {
  const s = S();
  applyGains();
  setSw('#muteSw', !s.mute); setSw('#musicSw', !s.musicOff);
  $('[data-row="mute"]').classList.toggle('off', s.mute);
  $('[data-row="musicOff"]').classList.toggle('off', s.musicOff);
  for (const [id, v] of [['sfx', s.sfxVol], ['mus', s.musVol]]) {
    const el = $('#' + id + 'Vol'), pct = Math.round(v * 100);
    el.style.setProperty('--v', v); el.setAttribute('aria-valuenow', pct);
    $('#' + id + 'Pct').textContent = pct + ' %';
  }
}
// alles anwenden (beim Start und nach jeder Änderung)
export function applySettings() {
  const s = S();
  applySound();
  setSw('#shakeSw', s.shake); setSw('#numSw', s.numbers); setSw('#leftySw', s.lefty);
  document.body.classList.toggle('lefty', s.lefty);
  // --bs an der Wurzel: #ctrl skaliert damit, der Tipp-Kasten (#hint) hält Abstand
  document.documentElement.style.setProperty('--bs', BTN_SCALE[s.btn]);
  $('#btnSeg').querySelectorAll('[data-bs]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.bs === s.btn)));
}

// Schalter (Klick-Ton kommt aus ui/sfx-ui.js; beim Einschalten des Tons kam der noch stumm, also danach einer)
const toggle = key => { S()[key] = !S()[key]; persist(); applySettings(); };
const SWITCHES = {
  '#muteSw': () => { setMute(!S().mute); if (!S().mute) sfx.click(); },
  '#musicSw': () => setMusic(!S().musicOff),
  '#shakeSw': () => toggle('shake'),
  '#numSw': () => toggle('numbers'),
  '#leftySw': () => toggle('lefty'),
};
for (const [id, fn] of Object.entries(SWITCHES)) $(id).addEventListener('click', fn);
$('#btnSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-bs]'); if (!b || b.dataset.bs === S().btn) return;
  S().btn = b.dataset.bs; persist(); applySettings();
});

// Lautstärke-Regler: Ziehen (Maus/Finger) oder Pfeiltasten in 5-%-Schritten.
// Ganz nach links schaltet die Spur aus, Ziehen an einer ausgeschalteten schaltet sie wieder an.
const KNOB = 24;   // Breite des Knopfs in px (style.css .vol .knob)
function volume(id, key, offKey) {
  const el = $(id), setOff = off => (offKey === 'mute' ? setMute(off) : setMusic(off));
  const set = v => {
    v = Math.round(Math.min(1, Math.max(0, v)) * 20) / 20;
    const off = S()[offKey];
    if (v === S()[key] && off === (v === 0)) return;
    S()[key] = v;
    if (off !== (v === 0)) setOff(v === 0); else applySound();
    // Probe-Ton, damit man die neue Lautstärke hört
    if (key === 'sfxVol' && v > 0 && thr('volProbe', 90)) sfx.click();
  };
  // Knopfmitte unter dem Finger: der Knopf läuft von KNOB/2 bis Breite − KNOB/2
  const at = e => { const r = el.getBoundingClientRect(); set((e.clientX - r.left - KNOB / 2) / Math.max(1, r.width - KNOB)); };
  // Ziehen über window (wie ui/tree.js), damit es auch ohne Pointer-Capture und beim Loslassen daneben klappt
  let drag = null;
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.focus(); drag = e.pointerId; at(e); });
  window.addEventListener('pointermove', e => { if (e.pointerId === drag) at(e); });
  for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => { if (e.pointerId === drag) { drag = null; persist(); } });
  el.addEventListener('keydown', e => {
    const d = { ArrowLeft: -.05, ArrowDown: -.05, ArrowRight: .05, ArrowUp: .05 }[e.code];
    if (d !== undefined) set(S()[key] + d);
    else if (e.code === 'Home') set(0);
    else if (e.code === 'End') set(1);
    else return;
    e.preventDefault(); e.stopPropagation(); persist();
  });
}
volume('#sfxVol', 'sfxVol', 'mute');
volume('#musVol', 'musVol', 'musicOff');

// ---------- Geräte-Einstellungen (Phase 15, core/device.js): Reiter, Schalter, Auswahl, Regler, Tasten ----------
// Reiter: Ton · Bild · Steuerung · Spiel (zuletzt gewählter bleibt)
let otab = 'ton';
function showTab(t) {
  otab = t; if (wait) { wait = null; renderKeys(); }
  document.querySelectorAll('[data-otab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.otab === t)));
  document.querySelectorAll('[data-opage]').forEach(p => { p.hidden = p.dataset.opage !== t; });
}
document.querySelector('.opttabs').addEventListener('click', e => { const b = e.target.closest('[data-otab]'); if (b) showTab(b.dataset.otab); });
showTab(otab);

const setDev = (k, v) => { dev[k] = v; saveDevice(); applyDevice(); };
document.querySelectorAll('[data-dev]').forEach(b => b.addEventListener('click', () => setDev(b.dataset.dev, !dev[b.dataset.dev])));
document.querySelectorAll('[data-devseg]').forEach(g => g.addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  const k = g.dataset.devseg, v = CHOICE[k].find(x => String(x) === b.dataset.v);
  if (v !== undefined && v !== dev[k]) setDev(k, v);
}));
// Regler wie bei der Lautstärke: Gesamtlautstärke, Menütöne (0–100 %), Oberfläche (80–150 %)
const RANGE = { master: [0, 1, .05], uiVol: [0, 1, .05], uiScale: [UI_SCALE[0], UI_SCALE[1], .05] };
document.querySelectorAll('[data-devvol]').forEach(el => {
  const k = el.dataset.devvol, [lo, hi, st] = RANGE[k];
  const set = (v, fin = false) => {
    v = Math.round(Math.min(hi, Math.max(lo, v)) / st) * st; v = Math.round(v * 100) / 100;
    // Oberfläche erst beim Loslassen anwenden: sonst wandert der Regler unter dem Finger
    if (k === 'uiScale' && !fin) { el.style.setProperty('--v', (v - lo) / (hi - lo)); el.parentElement.querySelector('.pct').textContent = Math.round(v * 100) + ' %'; el._pend = v; return; }
    if (v === dev[k]) return;
    setDev(k, v);
    if (k === 'uiVol' && v > 0 && thr('volProbe', 90)) sfx.click();
  };
  const at = (e, fin) => { const r = el.getBoundingClientRect(); set(lo + (hi - lo) * (e.clientX - r.left - KNOB / 2) / Math.max(1, r.width - KNOB), fin); };
  let drag = null;
  el.addEventListener('pointerdown', e => { e.preventDefault(); el.focus(); drag = e.pointerId; at(e); });
  window.addEventListener('pointermove', e => { if (e.pointerId === drag) at(e); });
  for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, e => { if (e.pointerId !== drag) return; drag = null; if (el._pend !== undefined) { const v = el._pend; el._pend = undefined; set(v, true); } });
  el.addEventListener('keydown', e => {
    const d = { ArrowLeft: -st, ArrowDown: -st, ArrowRight: st, ArrowUp: st }[e.code];
    if (d === undefined) return;
    e.preventDefault(); e.stopPropagation(); set(dev[k] + d, true);
  });
});

// Tastenbelegung: je Aktion zwei Felder; Klick → nächste Taste übernehmen, Esc bricht ab, Entf/⌫ leert das Feld
let wait = null;
function renderKeys() {
  $('#keyMap').innerHTML = ACTIONS.map(([a, name]) => `<div class="keyrow"><span>${name}</span>${[0, 1].map(i =>
    `<button class="keycap${wait && wait.a === a && wait.i === i ? ' wait' : ''}" data-ka="${a}" data-ki="${i}">${wait && wait.a === a && wait.i === i ? 'Taste …' : keyName(dev.keys[a][i])}</button>`).join('')}</div>`).join('') +
    '<p class="keynote">Esc pausiert immer. Klick auf ein Feld, dann die neue Taste drücken (Entf leert es).</p>';
}
$('#keyMap').addEventListener('click', e => {
  const b = e.target.closest('[data-ka]'); if (!b) return;
  wait = { a: b.dataset.ka, i: +b.dataset.ki }; renderKeys();
});
window.addEventListener('keydown', e => {
  if (wait && $('#options').hidden) { wait = null; renderKeys(); }   // Fenster zu: kein Feld wartet mehr
  if (!wait) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const { a, i } = wait; wait = null;
  if (e.code === 'Escape') { renderKeys(); return; }
  bindKey(a, i, e.code === 'Delete' || e.code === 'Backspace' ? null : e.code);
  renderKeys(); applyDevice(); sfx.click();
}, true);
$('#keyReset').addEventListener('click', () => { resetKeys(); wait = null; renderKeys(); applyDevice(); });

// Anwenden: Ton, Oberfläche (automatisch größer auf großen PC-Bildschirmen × Einstellung), Auflösung, Knöpfe, Fenster
export function uiZoom() {
  const auto = document.body.classList.contains('pc') ? Math.min(1.45, Math.max(1, Math.min(innerWidth / 1280, innerHeight / 760))) : 1;
  return Math.round(auto * dev.uiScale * 100) / 100;
}
export function applyDevice() {
  applyGains();
  const root = document.documentElement.style;
  setUiz(uiZoom());
  root.setProperty('--ba', dev.btnAlpha);
  resize();
  document.body.classList.toggle('showfps', dev.showFps);
  document.querySelectorAll('[data-dev]').forEach(b => setSw(b, !!dev[b.dataset.dev]));
  document.querySelectorAll('[data-devseg]').forEach(g => g.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === String(dev[g.dataset.devseg])))));
  document.querySelectorAll('[data-devvol]').forEach(el => {
    const [lo, hi] = RANGE[el.dataset.devvol], v = dev[el.dataset.devvol];
    el.style.setProperty('--v', (v - lo) / (hi - lo)); el.setAttribute('aria-valuenow', Math.round(v * 100));
    el.parentElement.querySelector('.pct').textContent = Math.round(v * 100) + ' %';
  });
  // Akkusparmodus begrenzt Bildrate und Auflösung: die Auswahl zeigt das an
  document.body.classList.toggle('saver', dev.saver);
  if (!dev.wake) keepAwake(false);
  fpsTag(dev.showFps);
  if (!wait) renderKeys();
  emitKeys();
}
window.addEventListener('resize', () => setUiz(uiZoom()));
// Fenstergröße der exe sofort übernehmen
document.querySelector('[data-devseg="winSize"]').addEventListener('click', () => setWindowSize(dev.winSize));

// Bilder pro Sekunde oben links (Einstellung „Bilder pro Sekunde anzeigen“)
let fpsTimer = 0;
function fpsTag(on) {
  let el = document.getElementById('fpsTag');
  if (!on) { clearInterval(fpsTimer); fpsTimer = 0; if (el) el.hidden = true; return; }
  if (!el) { el = document.createElement('div'); el.id = 'fpsTag'; el.setAttribute('aria-hidden', 'true'); document.body.append(el); }
  el.hidden = false;
  if (!fpsTimer) fpsTimer = setInterval(() => { el.textContent = fpsNow.v + ' FPS'; }, 500);
}
