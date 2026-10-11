import { AC, musBus, noise, tone } from './audio.js';
import { save } from './save.js';

// Musik: kleine Goblin-Polka in a-Moll, beim Boss schneller und düsterer
export const MEL = [[0, null, 3, null, 5, null, 7, 5, 3, null, 0, null, -2, null, 0, null], [5, null, 7, null, 10, null, 7, 5, 3, null, 5, null, 3, null, null, null],
  [7, null, 7, 10, 12, null, 10, 7, 5, null, 3, null, 5, null, 7, null], [5, 3, 0, null, -2, null, 0, null, 3, null, 0, null, null, null, null, null]];
export const Music = {
  timer: null, next: 0, step: 0, boss: false,
  start() { if (!AC || this.timer || save.settings.musicOff) return; this.next = AC.currentTime + .08; this.timer = setInterval(() => this.tick(), 25); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  tick() {
    if (!AC) return;
    const spb = 60 / (this.boss ? 138 : 116) / 4;
    while (this.next < AC.currentTime + .12) { this.play(this.step, Math.max(0, this.next - AC.currentTime)); this.next += spb; this.step++; }
  },
  play(step, d) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, B = musBus;
    const roots = this.boss ? [110, 116.54, 110, 103.83] : [110, 87.31, 130.81, 98];
    const r = roots[bar];
    if (s % 4 === 0) tone(150, 42, .16, 'sine', .55, d, B, .002);
    if (s === 4 || s === 12) noise(.12, .22, 1700, 'bandpass', d, B, .8);
    if (s % 2 === 0) noise(.03, s % 4 === 2 ? .08 : .04, 7500, 'highpass', d, B);
    if (this.boss && s % 2 === 1) noise(.02, .03, 9000, 'highpass', d, B);
    if (s % 2 === 0) tone(r * (s % 4 === 0 ? 1 : 1.5), 0, .17, 'triangle', .22, d, B, .005);
    if (s % 4 === 2) { tone(r * 2, 0, .1, 'square', .025, d, B); tone(r * 2.52, 0, .1, 'square', .02, d, B); }
    if (Math.floor(step / 64) % 2 === 1) { const n = MEL[bar][s]; if (n !== null) tone(440 * Math.pow(2, n / 12), 0, .16, 'square', .035, d, B, .003); }
  },
};
