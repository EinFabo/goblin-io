import { AC, musBus, noise, tone } from './audio.js';
import { save } from './save.js';

// Musik: kleine Goblin-Polka in a-Moll, beim Boss schneller und düsterer
export const MEL = [[0, null, 3, null, 5, null, 7, 5, 3, null, 0, null, -2, null, 0, null], [5, null, 7, null, 10, null, 7, 5, 3, null, 5, null, 3, null, null, null],
  [7, null, 7, 10, 12, null, 10, 7, 5, null, 3, null, 5, null, 7, null], [5, 3, 0, null, -2, null, 0, null, 3, null, 0, null, null, null, null, null]];
// Boss-Themen: Tempo, Grundtöne der 4 Takte, Farbe (Feuer: Sägezahn-Stöße, Eis: Glöckchen)
const THEMES = {
  boss: { bpm: 138, roots: [110, 116.54, 110, 103.83] },
  ignaz: { bpm: 146, roots: [146.83, 155.56, 146.83, 130.81], stab: true },
  frostbart: { bpm: 124, roots: [123.47, 110, 98, 110], bell: true },
  morgra: { bpm: 118, roots: [98, 103.83, 92.5, 87.31], organ: true },
  knochenhand: { bpm: 130, roots: [110, 103.83, 98, 92.5], organ: true, stab: true },
  spiegelmeister: { bpm: 134, roots: [116.54, 123.47, 110, 103.83], bell: true },
  tempestra: { bpm: 152, roots: [130.81, 146.83, 123.47, 110], stab: true, bell: true },
  gromm: { bpm: 112, roots: [82.41, 87.31, 77.78, 73.42], stab: true, organ: true },
  malvorn: { bpm: 144, roots: [110, 116.54, 103.83, 98], stab: true, organ: true, bell: true, mel: 'malvorn' },
};
// Titelmusik (Hauptmenü): Goblin-Marsch mit eigener Melodie, die immer mitspielt
export const TITLE = { bpm: 108, roots: [110, 98, 110, 82.41], bell: true, mel: 'title', melAll: true };
const MELS = {
  title: [[0, null, 0, 3, 5, null, 3, null, 7, null, 5, 3, 0, null, null, null], [-2, null, -2, 0, 3, null, 0, null, 5, null, 3, 0, -2, null, null, null],
    [0, null, 0, 3, 5, null, 7, null, 8, null, 7, 5, 3, null, 5, null], [7, null, 5, 3, 0, null, -2, null, 0, null, null, null, null, null, null, null]],
  malvorn: [[12, null, 11, null, 12, null, 7, null, 8, null, 7, 5, 3, null, 2, null], [3, null, 5, null, 7, null, 3, null, 2, null, 0, -1, 0, null, null, null],
    [12, null, 11, null, 12, null, 15, null, 14, null, 12, 11, 12, null, 7, null], [8, 7, 5, 3, 2, null, 3, null, 0, null, null, null, -1, null, null, null]],
};
export const Music = {
  timer: null, next: 0, step: 0, boss: false, theme: null, hold: false, world: null,   // world: Stück der Welt (data/stages.js music)
  // Ergebnis: kurze Melodie, aufwärts beim Sieg, abwärts bei der Niederlage
  jingle(win) {
    if (!AC || save.settings.musicOff) return;
    const B = musBus, seq = win ? [0, 4, 7, 12, 16] : [7, 3, 0, -5], step = win ? .11 : .2;
    seq.forEach((n, i) => tone(440 * Math.pow(2, n / 12), 0, win && i === seq.length - 1 ? .7 : .22, win ? 'square' : 'triangle', .05, i * step, B, .004));
    if (win) for (const n of [0, 4, 7]) tone(220 * Math.pow(2, n / 12), 0, .8, 'triangle', .04, seq.length * step - step, B, .01);
  },
  // Boss-Auftritt (~3 s): Trommelwirbel, der anschwillt, dann ein tiefer Schlag mit Akkord
  bossIntro(id) {
    if (!AC || save.settings.musicOff) return;
    const T = THEMES[id] || THEMES.boss, r = T.roots[0], B = musBus;
    for (let i = 0; i < 22; i++) noise(.05, .04 + i * .006, 1500 + i * 60, 'bandpass', i * .045 * (1 - i * .012), B, .9);
    tone(r / 2, r / 2, 1.2, 'sawtooth', .05, .1, B, .6);
    for (const [m, d] of [[1, 1.05], [1.19, 1.05], [1.5, 1.05], [2, 1.1]]) tone(r * m, r * m * (T.bell ? 1 : .98), 1.6, T.bell ? 'sine' : 'square', T.bell ? .05 : .03, d, B, .01);
    tone(90, 30, .6, 'sine', .3, 1.05, B, .002); noise(.5, .25, 600, 'lowpass', 1.05, B);
  },
  start() { if (!AC || this.timer || save.settings.musicOff) return; this.next = AC.currentTime + .08; this.timer = setInterval(() => this.tick(), 25); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  tick() {
    if (!AC) return;
    const T = this.boss ? THEMES[this.theme] || THEMES.boss : this.world, spb = 60 / (T ? T.bpm : 116) / 4;
    // Während des Boss-Intros schweigt die Schleife (die Zeit läuft weiter, damit sie danach im Takt einsetzt)
    if (this.hold) { while (this.next < AC.currentTime + .12) this.next += spb; return; }
    while (this.next < AC.currentTime + .12) { this.play(this.step, Math.max(0, this.next - AC.currentTime), T); this.next += spb; this.step++; }
  },
  play(step, d, T) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, B = musBus;
    const roots = T ? T.roots : [110, 87.31, 130.81, 98];
    const r = roots[bar];
    if (s % 4 === 0) tone(150, 42, .16, 'sine', .55, d, B, .002);
    if (s === 4 || s === 12) noise(.12, .22, 1700, 'bandpass', d, B, .8);
    if (s % 2 === 0) noise(.03, s % 4 === 2 ? .08 : .04, 7500, 'highpass', d, B);
    if (this.boss && s % 2 === 1) noise(.02, .03, 9000, 'highpass', d, B);
    if (s % 2 === 0) tone(r * (s % 4 === 0 ? 1 : 1.5), 0, .17, 'triangle', .22, d, B, .005);
    if (s % 4 === 2) { tone(r * 2, 0, .1, 'square', .025, d, B); tone(r * 2.52, 0, .1, 'square', .02, d, B); }
    if (T && T.stab && (s === 0 || s === 6 || s === 10)) tone(r * 2, r * 1.9, .12, 'sawtooth', .03, d, B, .002);
    // Orgel (Knochenacker, Turm): leiser Akkord je Takt
    if (T && T.organ && s === 0) for (const m of [2, 2.38, 3]) tone(r * m, 0, 1.6, 'sine', .018, d, B, .25);
    if (T && T.bell && s % 4 === 1) tone(r * [4, 6, 5, 8][(s >> 2) % 4], 0, .5, 'sine', .03, d, B, .002);
    if ((T && T.melAll) || Math.floor(step / 64) % 2 === 1) { const n = ((T && MELS[T.mel]) || MEL)[bar][s]; if (n !== null) tone(440 * Math.pow(2, n / 12), 0, .16, 'square', .035, d, B, .003); }
  },
};
