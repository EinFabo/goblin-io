// Seeded RNG (mulberry32). Ein Seed pro Lauf, getrennte Streams für
// Spawns, Loot, Level-Up und alles andere im Spielablauf.
// Rein optische Zufälle (Partikel im Render, Bildschirmwackeln) nutzen frand.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Aus einem Text oder einer Zahl einen 32-bit-Seed machen
export function hashSeed(x) {
  const s = String(x);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Wie mulberry32, aber mit sichtbarem Zustand s (Prüfsumme im Koop, game/run.js simHash)
class Stream {
  constructor(seed) { this.s = seed >>> 0; }
  next() {
    const a = this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + this.next() * (b - a); }
  pick(arr) { return arr[(this.next() * arr.length) | 0]; }
  chance(p) { return this.next() < p; }
}

export const RNG = { game: null, spawn: null, loot: null, lvl: null, seed: 0 };

export function seedRun(seed) {
  RNG.seed = seed >>> 0;
  RNG.game = new Stream(hashSeed(RNG.seed + ':game'));
  RNG.spawn = new Stream(hashSeed(RNG.seed + ':spawn'));
  RNG.loot = new Stream(hashSeed(RNG.seed + ':loot'));
  RNG.lvl = new Stream(hashSeed(RNG.seed + ':lvl'));
}
seedRun((Math.random() * 2 ** 32) >>> 0);

export const newSeed = () => (Math.random() * 2 ** 32) >>> 0;

// Kurzformen für den Spielablauf (Stream "game")
export const rand = (a, b) => RNG.game.range(a, b);
export const pick = a => RNG.game.pick(a);
export const rnd = () => RNG.game.next();
// Nur für Optik, beeinflusst den Spielablauf nie
export const frand = (a, b) => a + Math.random() * (b - a);
