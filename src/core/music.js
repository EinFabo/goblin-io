import { AC, musBus, noise, tone } from './audio.js';
import { save } from './save.js';

// ---------- Musik ----------
// Kleine Goblin-Polka. Jedes Stück hat eine Tonart (key: Halbtöne über/unter A, scale) und eine Akkordfolge
// (prog: Stufe der Tonleiter je Takt, 4 Takte). Bass, Akkord-Stöße, Orgel, Glöckchen und Melodie kommen alle aus
// Tonleiter und Akkord des Takts – so passt alles zusammen (vorher: Melodie fest in a-Moll über anderen Grundtönen,
// Dur-Terz über Moll-Bass, Glöckchen auf der Nachschlagzeit; Fabi: „nicht zum Takt passendes Gedudel“).
// Melodien sind in a-Moll notiert (Halbtöne über A) und werden in Tonleiterstufen umgerechnet, dann in die Tonart
// des Stücks gelegt; auf schweren Zählzeiten springen sie auf den nächsten Akkordton.
export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harm: [0, 2, 3, 5, 7, 8, 11],   // harmonisch Moll: Dur-Dominante, düsterer (Bosse)
};
// a-Moll-Halbtöne → Tonleiterstufen (Melodien sind so notiert)
const toDeg = (semi, scale = SCALES.minor) => {
  const o = Math.floor(semi / 12), r = semi - o * 12, i = scale.indexOf(r);
  return i < 0 ? null : o * 7 + i;
};
const degSemi = (scale, d) => { const o = Math.floor(d / 7); return o * 12 + scale[d - o * 7]; };

const MEL_RAW = {
  polka: [[0, null, 3, null, 5, null, 7, 5, 3, null, 0, null, -2, null, 0, null], [5, null, 7, null, 10, null, 7, 5, 3, null, 5, null, 3, null, null, null],
    [7, null, 7, 10, 12, null, 10, 7, 5, null, 3, null, 5, null, 7, null], [5, 3, 0, null, -2, null, 0, null, 3, null, 0, null, null, null, null, null]],
  title: [[0, null, 0, 3, 5, null, 3, null, 7, null, 5, 3, 0, null, null, null], [-2, null, -2, 0, 3, null, 0, null, 5, null, 3, 0, -2, null, null, null],
    [0, null, 0, 3, 5, null, 7, null, 8, null, 7, 5, 3, null, 5, null], [7, null, 5, 3, 0, null, -2, null, 0, null, null, null, null, null, null, null]],
  malvorn: [[12, null, 11, null, 12, null, 7, null, 8, null, 7, 5, 3, null, 2, null], [3, null, 5, null, 7, null, 3, null, 2, null, 0, -1, 0, null, null, null],
    [12, null, 11, null, 12, null, 15, null, 14, null, 12, 11, 12, null, 7, null], [8, 7, 5, 3, 2, null, 3, null, 0, null, null, null, -1, null, null, null]],
};
// Malvorns Melodie ist in harmonisch Moll notiert (Gis), die anderen in natürlich Moll
const MELS = Object.fromEntries(Object.entries(MEL_RAW).map(([k, m]) => [k, m.map(bar => bar.map(n => (n === null ? null : toDeg(n, k === 'malvorn' ? SCALES.harm : SCALES.minor))))]));

// Stücke: Welten (data/stages.js music.theme) und Bosse
export const THEMES = {
  meadow: { bpm: 116, key: 0, scale: 'minor', prog: [0, 5, 2, 6] },
  snow: { bpm: 110, key: 2, scale: 'minor', prog: [0, 6, 5, 6], bell: true },
  swamp: { bpm: 108, key: -2, scale: 'minor', prog: [0, 6, 5, 6] },
  graves: { bpm: 112, key: 0, scale: 'harm', prog: [0, 5, 3, 4], organ: true },
  mirrors: { bpm: 120, key: 1, scale: 'minor', prog: [0, 5, 6, 4], bell: true },
  cliffs: { bpm: 132, key: 0, scale: 'minor', prog: [0, 2, 6, 4], stab: true },
  chasm: { bpm: 100, key: -5, scale: 'harm', prog: [0, 5, 3, 4], stab: true },
  tower: { bpm: 126, key: 0, scale: 'harm', prog: [0, 5, 3, 4], organ: true },
  night: { bpm: 120, key: -2, scale: 'minor', prog: [0, 6, 5, 6] },
  boss: { bpm: 138, key: 0, scale: 'harm', prog: [0, 5, 0, 4], boss: true },
  ignaz: { bpm: 146, key: 5, scale: 'harm', prog: [0, 5, 0, 4], stab: true, boss: true },
  frostbart: { bpm: 124, key: 2, scale: 'minor', prog: [0, 6, 5, 6], bell: true, boss: true },
  morgra: { bpm: 118, key: -2, scale: 'harm', prog: [0, 5, 3, 4], organ: true, boss: true },
  knochenhand: { bpm: 130, key: 0, scale: 'harm', prog: [0, 3, 5, 4], organ: true, stab: true, boss: true },
  spiegelmeister: { bpm: 134, key: 1, scale: 'minor', prog: [0, 5, 6, 4], bell: true, boss: true },
  tempestra: { bpm: 152, key: 3, scale: 'minor', prog: [0, 6, 5, 4], stab: true, bell: true, boss: true },
  gromm: { bpm: 112, key: -5, scale: 'harm', prog: [0, 5, 3, 4], stab: true, organ: true, boss: true },
  malvorn: { bpm: 144, key: 0, scale: 'harm', prog: [0, 5, 3, 4], stab: true, organ: true, bell: true, mel: 'malvorn', boss: true },
  // Titelmusik (Hauptmenü): Goblin-Marsch, Melodie spielt immer mit
  title: { bpm: 108, key: 0, scale: 'minor', prog: [0, 5, 2, 6], bell: true, mel: 'title', melAll: true },
};

// Akkord des Takts als Halbtöne über dem Grundton der Tonart (Dreiklang aus der Tonleiter)
export function chordOf(T, bar) {
  const sc = SCALES[T.scale], d = T.prog[bar % 4];
  return [d, d + 2, d + 4].map(x => degSemi(sc, x));
}
// Melodienote (Halbtöne über dem Grundton) für Takt und Sechzehntel, null = Pause.
// Schwere Zählzeiten (s % 4 === 0) landen auf dem nächsten Akkordton.
export function melNote(T, bar, s) {
  const deg = (MELS[T.mel] || MELS.polka)[bar % 4][s];
  if (deg === null || deg === undefined) return null;
  const sc = SCALES[T.scale], semi = degSemi(sc, deg);
  if (s % 4 !== 0) return semi;
  let best = semi, bd = 99;
  for (const c of chordOf(T, bar)) for (const o of [-24, -12, 0, 12, 24]) { const x = c + o, dd = Math.abs(x - semi); if (dd < bd) { bd = dd; best = x; } }
  return best;
}
const hz = (T, semi, base) => base * Math.pow(2, (T.key + semi) / 12);

export const Music = {
  timer: null, next: 0, step: 0, boss: false, theme: null, hold: false, world: null,   // world: Stück der Welt (THEMES-Name)
  // Ergebnis: kurze Melodie, aufwärts beim Sieg, abwärts bei der Niederlage
  jingle(win) {
    if (!AC || save.settings.musicOff) return;
    const B = musBus, seq = win ? [0, 4, 7, 12, 16] : [7, 3, 0, -5], step = win ? .11 : .2;
    seq.forEach((n, i) => tone(440 * Math.pow(2, n / 12), 0, win && i === seq.length - 1 ? .7 : .22, win ? 'square' : 'triangle', .05, i * step, B, .004));
    if (win) for (const n of [0, 4, 7]) tone(220 * Math.pow(2, n / 12), 0, .8, 'triangle', .04, seq.length * step - step, B, .01);
  },
  // Boss-Auftritt (~3 s): Trommelwirbel, der anschwillt, dann ein tiefer Schlag mit dem Grundakkord des Themas
  bossIntro(id) {
    if (!AC || save.settings.musicOff) return;
    const T = THEMES[id] || THEMES.boss, B = musBus;
    for (let i = 0; i < 22; i++) noise(.05, .04 + i * .006, 1500 + i * 60, 'bandpass', i * .045 * (1 - i * .012), B, .9);
    tone(hz(T, 0, 55), hz(T, 0, 55), 1.2, 'sawtooth', .05, .1, B, .6);
    for (const c of [...chordOf(T, 0), 12]) tone(hz(T, c, 220), 0, 1.6, T.bell ? 'sine' : 'square', T.bell ? .05 : .03, 1.05, B, .01);
    tone(90, 30, .6, 'sine', .3, 1.05, B, .002); noise(.5, .25, 600, 'lowpass', 1.05, B);
  },
  start() { if (!AC || this.timer || save.settings.musicOff) return; this.next = AC.currentTime + .08; this.timer = setInterval(() => this.tick(), 25); },
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; },
  tick() {
    if (!AC) return;
    const T = this.boss ? THEMES[this.theme] || THEMES.boss : THEMES[this.world] || THEMES.meadow, spb = 60 / T.bpm / 4, now = AC.currentTime;
    // Hänger (Ruckler, Tab im Hintergrund): nicht nachholen (sonst kommen viele Noten auf einmal), sondern auf dem
    // nächsten Schlag neu einsetzen
    if (this.next < now - .1) { this.next = now + .05; this.step = Math.ceil(this.step / 4) * 4; }
    // Während des Boss-Intros schweigt die Schleife (die Zeit läuft weiter, damit sie danach im Takt einsetzt)
    if (this.hold) { while (this.next < now + .2) this.next += spb; return; }
    while (this.next < now + .2) { this.play(this.step, Math.max(0, this.next - now), T); this.next += spb; this.step++; }
  },
  play(step, d, T) {
    const s = step % 16, bar = Math.floor(step / 16) % 4, B = musBus, ch = chordOf(T, bar);
    // Schlagzeug: Bassdrum auf jedem Schlag, Snare auf 2 und 4, Hi-Hat auf den Achteln (Boss: Sechzehntel)
    if (s % 4 === 0) tone(150, 42, .16, 'sine', .55, d, B, .002);
    if (s === 4 || s === 12) noise(.12, .22, 1700, 'bandpass', d, B, .8);
    if (s % 2 === 0) noise(.03, s % 4 === 2 ? .08 : .04, 7500, 'highpass', d, B);
    if (T.boss && s % 2 === 1) noise(.02, .03, 9000, 'highpass', d, B);
    // Bass: Grundton auf dem Schlag, Quinte auf der Achtel dazwischen
    if (s % 2 === 0) tone(hz(T, s % 4 === 0 ? ch[0] : ch[2], 110), 0, .17, 'triangle', .22, d, B, .005);
    // Polka-Nachschlag: Terz und Quinte des Akkords
    if (s % 4 === 2) { tone(hz(T, ch[1], 220), 0, .1, 'square', .022, d, B); tone(hz(T, ch[2], 220), 0, .1, 'square', .018, d, B); }
    if (T.stab && (s === 0 || s === 6 || s === 10)) tone(hz(T, ch[0], 220), hz(T, ch[0], 220) * .97, .12, 'sawtooth', .026, d, B, .002);
    // Orgel: der Akkord des Takts, leise und lang
    if (T.organ && s === 0) for (const c of ch) tone(hz(T, c, 220), 0, 1.6, 'sine', .016, d, B, .25);
    // Glöckchen: Akkordtöne aufwärts auf den Achteln
    if (T.bell && s % 2 === 0) tone(hz(T, ch[(s >> 1) % 3] + 12, 440), 0, .35, 'sine', .018, d, B, .002);
    // Melodie: jede zweite Phrase (Titel immer)
    if (T.melAll || Math.floor(step / 64) % 2 === 1) { const n = melNote(T, bar, s); if (n !== null) tone(hz(T, n, 440), 0, .16, 'square', .028, d, B, .003); }
  },
};
