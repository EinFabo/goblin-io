import { rnd, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { TAU } from '../core/util.js';
import { PHASE_AT } from '../data/bosses.js';
import { eShot, spawnEnemy } from './enemies.js';
import { ring } from './fx.js';
import { addHaz } from './hazards.js';
import { blinkBoss, makePortal } from './boss-mech.js';
import { P, run } from './state.js';

// ---------- Boss-Angriffe ----------
// Bausteine für die Phasen in data/bosses.js. Jeder Angriff:
//   ck(b): Farbe/Art beim Aufladen · charge: Aufladezeit · reps(b): Wiederholungen · chan: danach so lange weiterzaubern
//   move: Lauftempo während chan · fire(b, tx, ty): auslösen (tx/ty = Stabspitze) · tick(b, dt): während chan
//   special: eigener Ablauf in boss.js (Ansturm)

export const phase = b => b.B.phases[b.ph];
export const phaseAt = b => b.B.at || PHASE_AT;
// Geschossart: 'blink' lädt lila auf, fliegt als Schatten
export const shotKind = k => (k === 'blink' ? 'void' : k);
// Malvorn: Art der aktuellen Schule; Schatten fliegt als 'void'
const SCHOOL_KIND = { fire: 'fire', frost: 'frost', storm: 'storm', toxic: 'toxic', shadow: 'void', necro: 'necro', earth: 'earth', light: 'light' };
export const kindOf = b => (b.school ? SCHOOL_KIND[b.school] : b.B.kind === 'both' ? (rnd() < .5 ? 'fire' : 'frost') : b.B.kind);
// Geschoss eines Bosses: Spiegelbilder schießen harmlose Trugbilder, im Spiegel-Phase-3 wandern Geschosse durch Portale
export function shot(b, x, y, a, kind, dmg, sp, sc) {
  eShot(x, y, a, kind, dmg, sp, sc, b.decoy ? { fake: true } : run.portals && run.portals.length ? { warp: true } : undefined);
}
export function bossRing(b, kind, off) {
  const n = b.ph >= 1 ? 20 : 14;
  for (let i = 0; i < n; i++) shot(b, b.x, b.y - 10, off + i * TAU / n, shotKind(kind), b.dmg * .4, 175, 1.35);
}
// Kreise in einer Reihe vom Boss bis hinter den Goblin (Kettenblitz, Erdspieße)
function trail(b, n, step, r, warn0, dw, extra) {
  const a = Math.atan2(P.y - b.y, P.x - b.x);
  for (let i = 0; i < n; i++) {
    const d = 70 + i * step;
    addHaz({ shape: 'circle', x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d, r, warn: warn0 + i * dw, dmg: b.dmg * .55, ...extra });
  }
}

export const ATK = {
  fan: {
    ck: kindOf, charge: .7, reps: b => (b.ph >= 1 ? 2 : 1),
    fire(b, tx, ty) { const base = Math.atan2(P.y - ty, P.x - tx), n = b.ph >= 2 ? 9 : 7; for (let i = 0; i < n; i++) shot(b, tx, ty, base + (i - (n - 1) / 2) * .14, shotKind(b.ck), b.dmg * .45, 225, 1.4); },
  },
  ring: { ck: kindOf, charge: .8, fire(b) { bossRing(b, b.ck, 0); b.ai.ring2 = .4; } },
  strikes: {
    ck: () => 'storm', charge: .8,
    fire(b) {
      const n = 5 + b.ph * 1.5 | 0;
      addHaz({ shape: 'circle', x: P.x, y: P.y, r: 60, warn: 1, dmg: b.dmg * .7, kind: 'storm', src: 'strike' });
      for (let i = 1; i < n; i++) { const a = rnd() * TAU, r = rand(70, 200); addHaz({ shape: 'circle', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 60, warn: 1 + i * .08, dmg: b.dmg * .7, kind: 'storm', src: 'strike' }); }
    },
  },
  // Ansturm: Linie anzeigen, dann quer durch die Arena
  charge: { special: true },
  // Ignaz Phase 3: Meteorregen, der erste genau auf den Spieler
  meteors: {
    ck: () => 'fire', charge: .9,
    fire(b) {
      const n = b.rage ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, r = i ? rand(90, 240) : 0;
        addHaz({ shape: 'circle', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 72, warn: 1.15 + i * .16, dmg: b.dmg * .8, kind: 'fire', src: 'meteor', boom: true, grow: true });
      }
    },
  },
  // Ignaz Phase 2: zwei Feuerarme drehen sich um ihn (erst langsam als Warnung, dann brennen sie)
  walls: {
    ck: () => 'fire', charge: .8, chan: 5.6, move: .35,
    fire(b) {
      const dir = rnd() < .5 ? 1 : -1, a0 = Math.atan2(P.y - b.y, P.x - b.x) + Math.PI / 2, w = (b.ph >= 2 ? 1 : .8) * dir;
      for (const o of [0, Math.PI]) addHaz({ shape: 'line', x: b.x, y: b.y, x2: b.x, y2: b.y, w: 30, warn: 1.1, act: 4.5, tick: .4, dmg: b.dmg * .35, kind: 'fire', src: 'wall', owner: b, cancel: true, spin: { a: a0 + o, w, len: 430 } });
      sfx.whoosh();
    },
  },
  // Frostbart: Eisspeer-Salven, leicht vorgehalten
  spears: {
    ck: () => 'frost', charge: .5, reps: () => 2,
    fire(b, tx, ty) {
      const d = Math.hypot(P.x - tx, P.y - ty), lead = d / 330 * .5;
      const base = Math.atan2(P.y + P.vy * lead - ty, P.x + P.vx * lead - tx);
      for (const o of [-.1, 0, .1]) shot(b, tx, ty, base + o, 'frost', b.dmg * .38, 330, 1.25);
    },
  },
  // Frostbart: rutschige Eisflecken (kein Schaden, aber man schlittert)
  icefloor: {
    ck: () => 'frost', charge: .7,
    fire() {
      for (let i = 0; i < 3; i++) {
        const a = rnd() * TAU, r = i ? rand(130, 260) : 0;
        addHaz({ shape: 'circle', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 95, warn: .8, act: 9, dmg: 0, kind: 'ice', src: 'ice' });
      }
    },
  },
  // Morgra: Giftpfützen regnen rund um den Goblin
  puddles: {
    ck: () => 'toxic', charge: .7,
    fire(b) {
      const n = b.link ? 2 : 4 + (b.rage ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, r = i ? rand(60, 200) : 0;
        addHaz({ shape: 'circle', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 62, warn: 1 + i * .12, act: 5, tick: .5, dmg: b.dmg * .22, kind: 'toxic', src: 'zone', grow: true });
      }
    },
  },
  // Morgra: Gaskegel in Richtung des Goblins
  gas: {
    ck: () => 'toxic', charge: .8,
    fire(b) { addHaz({ shape: 'cone', x: b.x, y: b.y, a: Math.atan2(P.y - b.y, P.x - b.x), len: 330, spread: .42, warn: .9, act: 1.4, tick: .3, dmg: b.dmg * .24, kind: 'toxic', src: 'gas', owner: b, cancel: true }); },
  },
  // Knochenhand: eine Reihe Skelette quer vor ihm, läuft auf den Goblin zu
  skeletons: {
    ck: () => 'necro', charge: .8,
    fire(b) {
      const alive = run.enemies.filter(e => e.type === 'skeleton' && !e.dead).length, n = Math.min(6 + b.ph * 2, 22 - alive);
      const a = Math.atan2(P.y - b.y, P.x - b.x), nx = -Math.sin(a), ny = Math.cos(a);
      for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 34; spawnEnemy('skeleton', { x: b.x + Math.cos(a) * 60 + nx * o, y: b.y + Math.sin(a) * 60 + ny * o }); }
      ring(b.x, b.y, 10, 120, .5, 'rgba(120,255,110,.8)', 6);
    },
  },
  // Knochenhand: Knochenkäfig um den Goblin, zieht sich zu – raus durch die Lücke
  cage: {
    ck: () => 'necro', charge: .7,
    fire(b) { addHaz({ shape: 'ring', x: P.x, y: P.y, r: 150, r0: 150, r1: 0, w: 24, gap: rnd() * TAU, gapW: .42, warn: 1, act: 3.2, act0: 3.2, tick: .4, dmg: b.dmg * .35, kind: 'necro', src: 'cage' }); },
  },
  // Knochenhand Phase 3: Lebensraub-Strahl folgt dem Goblin langsam und heilt ihn (höchstens bis zur Phasengrenze)
  drain: {
    ck: () => 'necro', charge: .8, chan: 4.2, move: 0,
    fire(b) {
      addHaz({ shape: 'line', x: b.x, y: b.y, x2: b.x, y2: b.y, w: 26, warn: .8, act: 3.4, tick: .3, dmg: b.dmg * .25, kind: 'necro', src: 'beam', owner: b, cancel: true,
        drain: b, drainMax: phaseAt(b)[b.ph] * b.maxHp, spin: { a: Math.atan2(P.y - b.y, P.x - b.x) + .5, w: .75, len: 520, track: true } });
    },
  },
  // Eissplitter-Spirale: Arme drehen sich (Art nach Boss/Schule)
  spiral: {
    ck: kindOf, charge: .7, chan: 3.4, move: 0,
    fire(b) { b.ai.spin = { a: rnd() * TAU, dir: rnd() < .5 ? 1 : -1, acc: 0 }; },
    tick(b, dt) {
      const s = b.ai.spin; if (!s) return;
      s.a += 2.1 * s.dir * dt; s.acc -= dt;
      if (s.acc > 0) return;
      s.acc = b.rage ? .06 : .08;
      const arms = b.ph >= 2 ? 3 : 2, k = shotKind(b.ck);
      for (let i = 0; i < arms; i++) shot(b, b.x, b.y - 30, s.a + i * TAU / arms, k, b.dmg * .3, 165, 1.1);
    },
  },
  // Spiegelmeister: verschwindet und taucht neben dem Goblin wieder auf (Spiegelbilder wechseln die Plätze)
  blink: { ck: () => 'blink', charge: .45, fire(b) { blinkBoss(b); } },
  // Spiegelmeister: Schattenbolzen, drei Salven
  bolts: {
    ck: () => 'blink', charge: .55, reps: () => 3,
    fire(b, tx, ty) { const a = Math.atan2(P.y - ty, P.x - tx); for (const o of [-.12, 0, .12]) shot(b, tx, ty, a + o, 'void', b.dmg * .38, 260, 1.2); },
  },
  // Spiegelmeister Phase 3: Spiegeltor vor ihm, Ausgang neben dem Goblin – die Bolzen kommen von dort
  portal: {
    ck: () => 'blink', charge: .8,
    fire(b, tx, ty) {
      const pt = makePortal(b);
      if (!pt) return;
      const a = Math.atan2(pt.ay - ty, pt.ax - tx);
      for (let i = 0; i < 6; i++) eShot(tx, ty, a + (i - 2.5) * .05, 'void', b.dmg * .4, 240 - i * 12, 1.25, { warp: true });
    },
  },
  // Tempestra: Kettenblitz – Einschläge in einer Reihe vom Boss bis hinter den Goblin
  chain: { ck: () => 'storm', charge: .7, fire(b) { trail(b, 8, 62, 46, .6, .09, { kind: 'storm', src: 'strike' }); } },
  // Gromm: Schockwellen in drei Linien
  quake: {
    ck: () => 'earth', charge: .9,
    fire(b) {
      const a = Math.atan2(P.y - b.y, P.x - b.x);
      for (const o of [-.7, 0, .7]) addHaz({ shape: 'line', x: b.x, y: b.y, x2: b.x + Math.cos(a + o) * 480, y2: b.y + Math.sin(a + o) * 480, w: 40, warn: .9, dmg: b.dmg * .6, kind: 'earth', src: 'quake' });
      run.shake = Math.max(run.shake, 6); sfx.stomp();
    },
  },
  // Gromm: Felsregen (Schatten wächst, Fels fällt im Bogen)
  rocks: {
    ck: () => 'earth', charge: .8,
    fire(b) {
      const n = b.rage ? 8 : 6;
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU, r = i ? rand(70, 230) : 0, x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r, warn = 1.1 + i * .15;
        addHaz({ shape: 'circle', x, y, r: 58, warn, dmg: b.dmg * .6, kind: 'earth', src: 'rock', grow: true });
        run.eproj.push({ lob: true, sx: b.x, sy: b.y - 60, tx: x, ty: y, x: b.x, y: b.y, t: 0, a: 0, vx: 0, vy: 0, life: warn + .5, h: 0, sc: 1.6, r: 10, owner: b, kind: 'rock', dur: warn, dmg: 0, noZone: true });
      }
    },
  },
  // Gromm zu Fuß: Erdspieße jagen dem Goblin hinterher
  spikes: { ck: () => 'earth', charge: .5, reps: () => 2, fire(b) { trail(b, 9, 48, 40, .35, .07, { kind: 'earth', src: 'spikes' }); } },
};
