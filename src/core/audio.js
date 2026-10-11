import { save } from './save.js';
import { emit } from './events.js';

// ---------- Ton & Musik ----------
export let AC = null, sfxBus = null, musBus = null, noiseBuf = null;
export const lastS = {};
export function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(AC.destination);
    sfxBus = AC.createGain(); sfxBus.gain.value = save.settings.mute ? 0 : .5; sfxBus.connect(comp);
    musBus = AC.createGain(); musBus.gain.value = save.settings.musicOff ? 0 : .3; musBus.connect(comp);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    emit('audioReady');
  } catch (e) { AC = null; }
}
export function thr(k, ms) { const n = performance.now(); if (lastS[k] && n - lastS[k] < ms) return false; lastS[k] = n; return true; }
export function tone(f0, f1, dur, type = 'square', vol = .1, delay = 0, bus = null, attack = .004) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + .03);
}
export function noise(dur, vol, freq, type = 'lowpass', delay = 0, bus = null, q = 1, f1 = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q; if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t, Math.random() * .5); s.stop(t + dur + .03);
}
let gemCombo = 0, gemComboT = 0;
// Ton-Kombo beim Kristallsammeln klingt ab, wenn eine Weile nichts kommt
export function tickGemCombo(dt) { if (gemComboT > 0) { gemComboT -= dt; if (gemComboT <= 0) gemCombo = 0; } }
export const sfx = {
  hit() { if (thr('hit', 40)) { noise(.045, .09, 2200, 'bandpass', 0, null, 1.5); tone(180, 90, .05, 'sine', .07); } },
  kill() { thr('kill', 55) && (tone(520, 160, .09, 'triangle', .06), noise(.07, .05, 900, 'bandpass')); },
  gem() {
    if (!thr('gem', 28)) return;
    const n = Math.min(gemCombo, 24), f = 760 * Math.pow(2, n / 12);
    tone(f, 0, .09, 'sine', .07); tone(f * 2, 0, .06, 'triangle', .025, .01);
    gemCombo++; gemComboT = .55;
  },
  coin() { thr('coin', 60) && (tone(1320, 0, .05, 'square', .035), tone(1760, 0, .09, 'square', .035, .05)); },
  gear() { thr('gear', 70) && (noise(.05, .08, 3000, 'bandpass', 0, null, 4), tone(440, 330, .07, 'square', .03)); },
  throw() { thr('thr', 90) && noise(.07, .05, 2500, 'bandpass', 0, null, 1, 5000); },
  whoosh() { thr('who', 120) && noise(.16, .06, 600, 'bandpass', 0, null, 1, 2400); },
  cast() { thr('cast', 140) && tone(320, 760, .14, 'triangle', .035); },
  charge() { thr('chg', 220) && tone(180, 620, .55, 'sine', .022, 0, null, .2); },
  ezap() { thr('ezap', 120) && (noise(.25, .14, 4000, 'highpass'), tone(900, 120, .2, 'sawtooth', .04)); },
  boom() { if (thr('boom', 70)) { noise(.4, .25, 900, 'lowpass', 0, null, 1, 120); tone(120, 40, .3, 'sine', .14); } },
  zap() { thr('zap', 70) && tone(1500, 180, .12, 'sawtooth', .045); },
  frost() { thr('frost', 120) && (tone(2400, 1100, .12, 'sine', .035), tone(3200, 0, .05, 'triangle', .02, .03)); },
  hurt() { thr('hurt', 120) && (tone(260, 90, .2, 'square', .09), noise(.1, .1, 700)); },
  dash() { noise(.2, .12, 500, 'bandpass', 0, null, 1, 3000); },
  lvl() { [523, 659, 784, 1046, 1318].forEach((f, i) => { tone(f, 0, .18, 'triangle', .08, i * .06); tone(f * 2, 0, .1, 'sine', .03, i * .06 + .02); }); },
  cards() { noise(.25, .06, 800, 'bandpass', 0, null, 1, 4000); },
  pickCard() { tone(660, 0, .08, 'triangle', .08); tone(990, 0, .14, 'triangle', .08, .07); tone(1320, 0, .2, 'sine', .05, .14); },
  chest() { [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0, .16, 'square', .045, i * .055)); },
  ult() { noise(.8, .3, 1200, 'lowpass', 0, null, 1, 80); tone(110, 40, .8, 'sawtooth', .12); tone(220, 55, .6, 'square', .06, .05); },
  warn() { tone(196, 0, .35, 'sawtooth', .07); tone(185, 0, .35, 'sawtooth', .07, .4); },
  heal() { tone(600, 1200, .25, 'sine', .07); tone(900, 1800, .2, 'sine', .04, .08); },
  eheal() { thr('eheal', 200) && tone(700, 1100, .2, 'sine', .03); },
  fuse() { thr('fuse', 150) && noise(.7, .05, 5000, 'highpass'); },
  death() { tone(400, 60, .9, 'sawtooth', .1); noise(.6, .1, 500); },
  mechOn() { [196, 262, 330, 392].forEach((f, i) => tone(f, 0, .15, 'square', .06, i * .07)); noise(.5, .15, 300, 'lowpass', .25); },
  stomp() { thr('stomp', 150) && (tone(90, 40, .18, 'sine', .14), noise(.12, .08, 300)); },
  gun() { thr('gun', 70) && (noise(.04, .07, 1800, 'bandpass', 0, null, 2), tone(160, 80, .04, 'square', .03)); },
  rocket() { thr('rocket', 120) && noise(.3, .06, 1200, 'bandpass', 0, null, 1, 300); },
  buzz() { tone(110, 0, .15, 'square', .06); },
  hover() { thr('hov', 45) && tone(1700 + Math.random() * 200, 1300, .035, 'sine', .028); },
  hoverCard() { thr('hovc', 80) && (tone(1200, 0, .05, 'triangle', .03), tone(1800, 0, .07, 'sine', .022, .04)); },
  click() { tone(520, 0, .05, 'square', .04); noise(.02, .06, 3000, 'highpass'); },
  buy() { [880, 1175, 1568].forEach((f, i) => tone(f, 0, .1, 'square', .04, i * .05)); },
};
