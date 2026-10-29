// Zauber der Gegner. Alle laufen gleich ab: Ausholen (Telegraph, mind. 0,6 s) → Auslösen → kurz erholen.
// windup: Ausholzeit, col: Farbe von Stabglühen und Funken, aim: Ziellinie zum Spieler beim Ausholen,
// kind: 'proj' (zählt gegen die Geschoss-Grenze) | 'ground' (zählt gegen die Bodenwarnungen) | 'other'.
// start(e): wird beim Ausholen aufgerufen (z. B. Bodenwarnung schon zeigen), release(e, tx, ty): beim Auslösen.
import { sfx } from '../core/audio.js';
import { frand, rand, rnd } from '../core/rng.js';
import { TAU } from '../core/util.js';
import { addHaz, hazWarnCount } from './hazards.js';
import { addNum, part, puff, ring } from './fx.js';
import { P, clampToArena, heard, query, run } from './state.js';

export const PROJ_CAP = () => 6 + run.si * 2;      // gegnerische Geschosse gleichzeitig
export const WARN_CAP = 4;                         // Bodenwarnungen gleichzeitig
export const ZONE_CAP = 5;                         // Giftpfützen gleichzeitig (liegend + im Flug); im Giftsumpf sonst ein Teppich
const zones = () => run.haz.reduce((n, h) => n + (h.src === 'zone' ? 1 : 0), 0) + run.eproj.reduce((n, p) => n + (p.lob && p.kind === 'toxic' ? 1 : 0), 0);
const MIN_WINDUP = .6;
const SHIELD_R = 320;

// Spielerposition kurz vorausberechnet (Blitze, Pfützen)
const lead = s => [P.x + P.vx * s, P.y + P.vy * s];
const angTo = (x, y) => Math.atan2(P.y - y, P.x - x);

export function eShot(x, y, a, kind, dmg, sp, sc = 1, extra) {
  run.eproj.push({ x, y, a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, dmg, life: 4.5, t: Math.random(), sc, r: sc * 9, owner: run.caster, ...extra });
}
function lob(e, sx, sy, tx, ty, opt) {
  run.eproj.push({ lob: true, sx, sy, tx, ty, x: sx, y: sy, t: 0, a: 0, vx: 0, vy: 0, life: 3, h: 0, sc: 1.1, r: 10, owner: run.caster, ...opt });
}

export const CASTS = {
  // ----- Feuer -----
  fireball: { windup: .75, col: '#ff8a1f', aim: true, kind: 'proj', release(e, tx, ty) { eShot(tx, ty, angTo(tx, ty), 'fire', e.dmg * .9, 205); } },
  fire3: { windup: .9, col: '#ff5a1f', aim: true, kind: 'proj', release(e, tx, ty) { const a = angTo(tx, ty); for (const o of [-.28, 0, .28]) eShot(tx, ty, a + o, 'fire', e.dmg * .55, 205, 1.2); } },
  firewall: {
    // Feuerwand quer zur Blickrichtung, mitten durch den Spieler: Lücke suchen oder durchrollen
    windup: .8, col: '#ff7a1a', kind: 'ground',
    release(e) {
      const a = angTo(e.x, e.y) + Math.PI / 2, L = 230, gap = rand(-60, 60);
      for (const [s0, s1] of [[-L, gap - 34], [gap + 34, L]]) {
        addHaz({ shape: 'line', x: P.x + Math.cos(a) * s0, y: P.y + Math.sin(a) * s0, x2: P.x + Math.cos(a) * s1, y2: P.y + Math.sin(a) * s1, w: 26,
          warn: 1, act: 3, tick: .4, dmg: e.dmg * .5, kind: 'fire', src: 'wall' });
      }
      sfx.cast();
    },
  },
  // ----- Frost -----
  icespear: { windup: .75, col: '#7fd8ff', aim: true, kind: 'proj', release(e, tx, ty) { eShot(tx, ty, angTo(tx, ty), 'frost', e.dmg * .9, 235); } },
  icevolley: { windup: .9, col: '#9fefff', aim: true, kind: 'proj', release(e, tx, ty) { const a = angTo(tx, ty); for (const o of [-.22, 0, .22]) eShot(tx, ty, a + o, 'frost', e.dmg * .6, 235, 1.15); } },
  // ----- Sturm -----
  strike: { windup: .8, col: '#ffe45c', kind: 'ground', release(e) { const [x, y] = lead(.4); addHaz({ shape: 'circle', x, y, r: 50, warn: .9, dmg: e.dmg * 1.2, kind: 'storm', src: 'strike' }); sfx.cast(); } },
  strike3: {
    windup: .8, col: '#ffe45c', kind: 'ground',
    release(e) { for (let i = 0; i < 3; i++) { const a = rnd() * TAU, r = i ? rand(60, 120) : 0; addHaz({ shape: 'circle', x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, r: 46, warn: .9 + i * .12, dmg: e.dmg, kind: 'storm', src: 'strike' }); } sfx.cast(); },
  },
  thunderbeam: {
    // zwei Priester: gestrichelte Linie 1 s, dann Blitz dazwischen, solange beide stehen (max. 4 s)
    windup: .7, col: '#fff59a', kind: 'ground',
    can(e) { return !!partner(e); },
    release(e) { const o = partner(e); if (!o) return; addHaz({ shape: 'beam', a: e, b: o, w: 18, warn: 1, act: 4, tick: .35, dmg: e.dmg * .6, kind: 'storm', src: 'beam' }); e.linked = o.linked = run.time + 5.2; sfx.cast(); },
  },
  // ----- Gift -----
  puddle: {
    windup: .8, col: '#7be04a', kind: 'ground', can: () => zones() < ZONE_CAP,
    release(e, tx, ty) { const [x, y] = lead(.5); lob(e, tx, ty, x, y, { kind: 'toxic', dur: .95, dmg: e.dmg * .8 }); sfx.cast(); },
  },
  puddle3: {
    windup: .9, col: '#7be04a', kind: 'ground', can: () => zones() + 2 < ZONE_CAP,
    release(e, tx, ty) { for (let i = 0; i < 3; i++) { const [x, y] = lead(.5), a = i * TAU / 3 + rnd(), r = i ? 90 : 0; lob(e, tx, ty, x + Math.cos(a) * r, y + Math.sin(a) * r, { kind: 'toxic', dur: .95 + i * .1, dmg: e.dmg * .5 }); } sfx.cast(); },
  },
  gascone: {
    // grüner Kegel schon beim Ausholen, Gas kommt beim Auslösen
    windup: .8, col: '#9cf06a', kind: 'ground',
    start(e) { e.coneA = Math.atan2(P.y - e.y, P.x - e.x); addHaz({ shape: 'cone', x: e.x, y: e.y, a: e.coneA, len: 170, spread: .5, warn: .8, act: .9, tick: .3, dmg: e.dmg * .6, kind: 'toxic', src: 'gas', owner: e, cancel: true }); },
    release() { sfx.cast(); },
  },
  // ----- Schatten -----
  blink: {
    windup: .6, col: '#b26bff', kind: 'other',
    can(e) { return Math.hypot(P.x - e.x, P.y - e.y) > 230; },
    release(e) {
      puff(e.x, e.y, 1, 'rgba(170,90,255,.8)');
      const ang = rnd() * TAU, R = rand(150, 210);
      e.x = P.x + Math.cos(ang) * R; e.y = P.y + Math.sin(ang) * R;
      clampToArena(e, 40);
      e.px = e.x; e.py = e.y;
      puff(e.x, e.y, 1.2, 'rgba(170,90,255,.8)'); ring(e.x, e.y, 6, 50, .3, 'rgba(180,110,255,.9)', 4);
      e.chain = 'shadebolt'; sfx.whoosh();
    },
  },
  shadebolt: { windup: .6, col: '#b26bff', aim: true, kind: 'proj', release(e, tx, ty) { eShot(tx, ty, angTo(tx, ty), 'void', e.dmg, 280); } },
  fakebolt: { windup: .6, col: '#b26bff', aim: true, kind: 'proj', release(e, tx, ty) { eShot(tx, ty, angTo(tx, ty), 'void', 0, 280, 1, { fake: true }); } },
  clones: {
    windup: .8, col: '#d9b8ff', kind: 'other',
    can(e) { return !run.enemies.some(o => o.cloneOf === e && !o.dead); },
    release(e, tx, ty, spawn) {
      for (const s of [-1, 1]) {
        const a = Math.atan2(P.y - e.y, P.x - e.x) + s * Math.PI / 2;
        const c = spawn('shadow_clone', { x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70 });
        c.cloneOf = e; c.spawnT = .25;
      }
      puff(e.x, e.y, 1.2, 'rgba(200,160,255,.8)'); sfx.whoosh();
    },
  },
  portal: {
    windup: 1, col: '#9a4dff', kind: 'other',
    can(e) { return !run.enemies.some(o => o.portalOf === e && !o.dead); },
    release(e, tx, ty, spawn) {
      const a = rnd() * TAU, x = P.x + Math.cos(a) * 240, y = P.y + Math.sin(a) * 240;
      const o = spawn('void_portal', { x, y }); o.portalOf = e; o.spawnT = 2; o.spawnCd = 1.5;
      sfx.whoosh();
    },
  },
  // ----- Nekromantie -----
  summon_skeletons: {
    // grüne Runen 1 s, dann drei Skelette
    windup: 1, col: '#7bff6a', kind: 'ground',
    can() { return run.enemies.filter(o => o.type === 'skeleton' && !o.dead).length < 24; },
    start(e) { const a = Math.atan2(P.y - e.y, P.x - e.x); e.runeX = e.x + Math.cos(a) * 60; e.runeY = e.y + Math.sin(a) * 60; addHaz({ shape: 'circle', x: e.runeX, y: e.runeY, r: 42, warn: 1, dmg: 0, kind: 'necro', src: 'runes', owner: e, cancel: true }); },
    release(e, tx, ty, spawn) { for (let i = 0; i < 3; i++) { const a = i * TAU / 3; spawn('skeleton', { x: e.runeX + Math.cos(a) * 22, y: e.runeY + Math.sin(a) * 22 }).spawnT = .3; } sfx.whoosh(); },
  },
  raise_ghosts: {
    windup: .9, col: '#7bff6a', kind: 'other',
    can() { return run.graves.length > 0 && run.enemies.filter(o => o.type === 'ghost' && !o.dead).length < 6; },
    release(e, tx, ty, spawn) {
      for (let i = 0; i < 2 && run.graves.length; i++) { const g = run.graves.pop(); spawn('ghost', { x: g.x, y: g.y }).spawnT = .5; ring(g.x, g.y, 6, 40, .4, 'rgba(120,255,110,.8)', 4); }
      sfx.whoosh();
    },
  },
  drainbeam: {
    // grüner Strahl baut sich auf, zielt fest; wer drin steht, verliert Leben, der Lich heilt sich
    windup: 1.2, col: '#7bff6a', kind: 'ground',
    start(e) {
      const a = Math.atan2(P.y - e.y, P.x - e.x), L = 520;
      addHaz({ shape: 'line', x: e.x, y: e.y - 20, x2: e.x + Math.cos(a) * L, y2: e.y - 20 + Math.sin(a) * L, w: 22, warn: 1.2, act: 1.2, tick: .3, dmg: e.dmg * .45, kind: 'necro', src: 'beam', owner: e, cancel: true, drain: e });
    },
    release() { sfx.ezap(); },
  },
  // ----- Erde -----
  rock: {
    // Fels im Bogen, Schatten wächst am Zielpunkt
    windup: .7, col: '#c9a36a', kind: 'ground',
    release(e, tx, ty) {
      const [x, y] = lead(.6);
      addHaz({ shape: 'circle', x, y, r: 44, warn: 1, dmg: e.dmg * 1.1, kind: 'earth', src: 'rock', grow: true });
      lob(e, tx, ty, x, y, { kind: 'rock', dur: 1, dmg: 0, noZone: true });
      sfx.throw();
    },
  },
  spikeline: {
    windup: .7, col: '#c9a36a', kind: 'ground',
    release(e) {
      const a = Math.atan2(P.y - e.y, P.x - e.x), L = 380;
      addHaz({ shape: 'line', x: e.x, y: e.y + 10, x2: e.x + Math.cos(a) * L, y2: e.y + 10 + Math.sin(a) * L, w: 34, warn: .8, dmg: e.dmg * 1.1, kind: 'earth', src: 'spikes' });
      sfx.cast();
    },
  },
  summon_golem: {
    windup: 1.2, col: '#c9a36a', kind: 'ground',
    can(e) { return run.enemies.filter(o => o.golemOf === e && !o.dead).length < 2; },
    start(e) { e.runeX = e.x + rand(-50, 50); e.runeY = e.y + 60; addHaz({ shape: 'circle', x: e.runeX, y: e.runeY, r: 50, warn: 1.2, dmg: 0, kind: 'earth', src: 'runes', owner: e, cancel: true }); },
    release(e, tx, ty, spawn) { const g = spawn('golem', { x: e.runeX, y: e.runeY }); g.golemOf = e; g.spawnT = .5; run.shake = Math.max(run.shake, 5); sfx.stomp(); },
  },
  // ----- Licht -----
  heal: {
    windup: .9, col: '#9dff9a', kind: 'other',
    can(e) { let ok = false; query(e.x, e.y, 170, o => { if (o !== e && !o.boss && !o.obj && o.hp < o.maxHp * .9) { ok = true; return false; } }); return ok; },
    release(e) {
      let n = 0;
      query(e.x, e.y, 170, o => { if (o !== e && !o.boss && !o.obj && o.hp < o.maxHp) { const h = o.maxHp * .3; o.hp = Math.min(o.maxHp, o.hp + h); n++; addNum(o.x, o.y - 26, '+' + Math.round(h), '#8dff7a'); for (let i = 0; i < 3; i++) part(o.x + frand(-10, 10), o.y, 0, -60, .5, 'rgba(140,255,130,.9)', 3); } });
      ring(e.x, e.y, 10, 170, .5, 'rgba(140,255,130,.8)', 5); if (n && heard(e.x, e.y)) sfx.eheal();
    },
  },
  shield: {
    windup: .9, col: '#ffe27a', kind: 'other',
    // schützt bis zu 3 Verbündete (nicht sich selbst) im Umkreis
    can(e) { let ok = false; query(e.x, e.y, SHIELD_R, o => { if (o !== e && !o.boss && !o.obj && !o.clone && !(o.shield > 0)) { ok = true; return false; } }); return ok; },
    release(e) {
      let n = 0;
      query(e.x, e.y, SHIELD_R, o => { if (n >= 3 || o === e || o.boss || o.obj || o.clone || o.shield > 0) return; o.shield = o.maxHp * .3; n++; });
      ring(e.x, e.y, 10, SHIELD_R, .5, 'rgba(255,220,110,.85)', 5); sfx.eheal();
    },
  },
  charge: {
    // weiße Linie 0,7 s, dann Ansturm entlang der Linie
    windup: .7, col: '#ffffff', kind: 'ground',
    start(e) {
      const a = Math.atan2(P.y - e.y, P.x - e.x); e.chA = a;
      addHaz({ shape: 'line', x: e.x, y: e.y + 10, x2: e.x + Math.cos(a) * 330, y2: e.y + 10 + Math.sin(a) * 330, w: 40, warn: .7, dmg: 0, kind: 'light', src: 'charge', owner: e, cancel: true });
    },
    release(e) { e.dash = { vx: Math.cos(e.chA) * 520, vy: Math.sin(e.chA) * 520, t: .63 }; sfx.whoosh(); },
  },
};

// Zauber, die gerade gewirkt werden dürfen (Grenzen gegen Kugelhagel)
export function castAllowed(e, c) {
  const C = CASTS[c.id];
  if (C.kind === 'proj' && run.eproj.length >= PROJ_CAP()) return false;
  if (C.kind === 'ground' && hazWarnCount() >= WARN_CAP) return false;
  return !C.can || C.can(e);
}
export const castWindup = id => Math.max(MIN_WINDUP, CASTS[id].windup);

// Partner für den Donnerstrahl: nächster freier Donnerpriester in Reichweite
function partner(e) {
  let best = null, bd = 520 * 520;
  for (const o of run.enemies) {
    if (o === e || o.dead || o.type !== 'storm_master' || o.spawnT > 0 || (o.linked && o.linked > run.time)) continue;
    const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  return e.linked && e.linked > run.time ? null : best;
}
