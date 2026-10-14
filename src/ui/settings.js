import { musBus, musGain, sfx, sfxBus, sfxGain, thr } from '../core/audio.js';
import { Music } from '../core/music.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { run } from '../game/state.js';

// ---------- Einstellungen (PLAN 10.1): Ton, Spiel, Steuerung ----------
// Größe der Handy-Knöpfe (#ctrl) je Stufe
const BTN_SCALE = { s: .85, m: 1, l: 1.2 };
const S = () => save.settings;
const setSw = (id, on) => $(id).setAttribute('aria-checked', String(on));

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
  if (sfxBus) sfxBus.gain.value = sfxGain();
  if (musBus) musBus.gain.value = musGain();
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
