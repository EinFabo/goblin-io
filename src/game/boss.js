import { RNG, rnd, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { emit } from '../core/events.js';
import { $, TAU, clamp, face8 } from '../core/util.js';
import { CCOL } from '../data/enemies.js';
import { BOSSES, BOSS_IDS, PHASE_AT, RAGE_AT, bossVariant } from '../data/bosses.js';
import { STAGE_HP } from './balance.js';
import { eShot, mspr, spawnEnemy, tipPos } from './enemies.js';
import { damagePlayer } from './combat.js';
import { dropGem, part, puff, ring } from './fx.js';
import { addHaz } from './hazards.js';
import { hint } from './run.js';
import { P, run } from './state.js';
import { W, ZOOM } from '../render/canvas.js';
import { banner } from '../ui/hud.js';

// ---------- Boss-Runner (PLAN 6.2) ----------
// Phasen aus data/bosses.js: Rotation der Angriffe aus ATK, Phasenwechsel bei 66 % und 33 % Leben
// (kleine Szene, 1,5 s unverwundbar, Geschosse weg), Wut-Timer nach 120 s Kampf.
// Auftritt und Phasenwechsel laufen als Szene (run.cut): die Welt steht, die Kamera zeigt den Boss.

const shotKind = k => (k === 'storm' || k === 'blink' ? 'void' : k);
const kindOf = b => (b.B.kind === 'both' ? (rnd() < .5 ? 'fire' : 'frost') : b.B.kind);
const phase = b => b.B.phases[b.ph];
// Tempo: Phase × Wut
const tempo = b => (phase(b).spd || 1) * (b.rage ? 1.5 : 1);

export function spawnBoss() {
  const st = run.st;
  // Endlose Nacht: jedes Mal ein zufälliger Boss
  const id = st.boss.id === 'random' ? BOSS_IDS[Math.floor(RNG.spawn.next() * BOSS_IDS.length)] : st.boss.id, B = BOSSES[id];
  for (const e of run.enemies) if (!e.dead) { e.dead = true; puff(e.x, e.y, e.sc); dropGem(e.x, e.y, e.xp); }
  run.eproj.length = 0; run.haz.length = 0;
  run.arena = { x: P.x, y: P.y, r: 470, burn: 0 };
  const lf = 1 + run.loop * 1.5;
  const b = {
    type: 'boss', boss: true, id, B, pre: 'm.' + bossVariant(id), name: B.name, x: P.x, y: P.y - 300, r: 38, sc: 2.7, spd: 52 * (B.spd || 1), dmg: 13 * st.dmg * lf,
    hp: 2500 * STAGE_HP[run.si] * lf * (st.bossHp || 1) * (B.hp || 1), xp: 150, tint: B.tint || null, state: 'walk', face: 'down', fa: Math.PI / 2, at: 0, ft: 0, fired: false, charge: .7, ck: 'fire',
    kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, dead: false,
    ph: 0, fightT: 0, rage: false, inv: 0, ice: 0, iceT: 0, iceCd: 0, blkT: 0, stunT: 0,
    ai: { st: 'chase', t: 2.2, i: 0, atk: null, reps: 0, ring2: 0, ax: 0, ay: 0, chan: 0, spin: null },
  };
  b.maxHp = b.hp;
  b.spr = mspr(b, 'idle', 1);
  run.enemies.push(b); run.boss = b;
  startCut('intro', b);
}

// ---------- Szenen: Auftritt und Phasenwechsel ----------
const CUT_T = { intro: 3.4, phase: 1.6 };
export function startCut(kind, b) {
  run.cut = { kind, t: 0, dur: CUT_T[kind], b, shown: false };
  P.dashT = 0; P.sprinting = false;
  if (kind === 'intro') {
    b.hidden = true;
    emit('bossIntro', b);
    sfx.warn();
    document.body.classList.add('cine');
  } else {
    // Phasenwechsel: Hitstop, alle gegnerischen Geschosse und Bodenwarnungen weg (Fairness)
    run.hitstop = Math.max(run.hitstop, .18);
    run.eproj.length = 0; run.haz.length = 0;
    // laufender Angriff fällt aus (sonst stünde z. B. die Ansturm-Linie die ganze Szene im Bild)
    b.ai.ring2 = 0; b.ai.spin = null; b.ai.st = 'chase'; b.ft = 0; b.fired = false;
    b.inv = 1.5;
    run.shake = Math.max(run.shake, 10);
    ring(b.x, b.y, 20, 260, .6, b.B.col, 10);
    banner('Phase ' + (b.ph + 1), 'danger'); emit('bossPhase', b);
    const say = phase(b).say; if (say) hint(`<b>${b.B.name}</b> ${say}`);
    sfx.warn();
  }
}
export const skipCut = () => { const c = run && run.cut; if (c && c.kind === 'intro' && c.t > .5) c.t = Math.max(c.t, c.dur - .45); };
export function updCut(dt) {
  const c = run.cut, b = c.b, cam = run.cam;
  // Was im Schritt des Phasenwechsels nach dem Treffer noch entstanden ist, verschwindet auch
  if (c.t === 0 && c.kind === 'phase') { run.eproj.length = 0; run.haz.length = 0; }
  c.t += dt;
  // Kamera: zum Boss, heranzoomen, am Ende zurück zum Spieler
  const back = c.dur - (c.kind === 'intro' ? .7 : .4), out = c.t > back, tz = out ? 1 : c.kind === 'intro' ? 1.3 : 1.2;
  // Beim Auftritt steht der Boss rechts der Mitte, links unten ist Platz für das Namensschild
  const tx = out ? P.x : b.x - (c.kind === 'intro' ? W * .16 / (ZOOM * tz) : 0), ty = out ? P.y : b.y - 30;
  const k = 1 - Math.pow(out ? .86 : .9, dt * 60);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k;
  b.face = 'down'; b.fa = Math.PI / 2;
  if (c.kind === 'intro') {
    // Lichtsäule, dann der Auftritt mit Knall; danach Brüllen (Zauber-Pose) und Namensschild
    if (c.t < .8) { if (Math.random() < .7) part(b.x + frand(-30, 30), b.y + 10, 0, frand(-260, -120), .6, b.B.col, frand(3, 6)); b.spr = mspr(b, 'idle', 1); }
    else if (b.hidden) {
      b.hidden = false; b.flash = .25; run.shake = Math.max(run.shake, 14); run.flashT = .2; sfx.boom(); sfx.portal();
      ring(b.x, b.y, 10, 300, .7, b.B.col, 12);
      for (let i = 0; i < 30; i++) { const a = i * TAU / 30; part(b.x, b.y, Math.cos(a) * 320, Math.sin(a) * 200, .7, i % 2 ? b.B.col : '#fff', 5); }
    } else {
      const ft = c.t - .8;
      b.spr = ft < 1.4 ? mspr(b, 'cast', Math.min(8, 1 + Math.floor(ft * 9))) : mspr(b, 'idle', 1 + (Math.floor(c.t * 5) % 4));
      if (!c.shown && ft > .3) { c.shown = true; showCard(b); }
    }
  } else {
    b.spr = mspr(b, 'cast', Math.min(8, 1 + Math.floor(c.t * 7)));
    if (Math.random() < .5) { const a = frand(0, TAU); part(b.x + Math.cos(a) * 80, b.y + Math.sin(a) * 50, -Math.cos(a) * 160, -Math.sin(a) * 120, .4, b.B.col, 5); }
  }
  if (c.t >= c.dur) endCut();
}
function endCut() {
  const c = run.cut, b = c.b;
  run.cut = null; b.hidden = false;
  if (c.kind === 'intro') {
    document.body.classList.remove('cine'); $('#bossCard').hidden = true;
    $('#bossBar').hidden = false; $('#bossName').textContent = b.name; setBossBar(b);
    banner(b.name, 'danger'); emit('bossSpawn', b);
    ring(P.x, P.y, 20, run.arena.r, .6, 'rgba(180,120,255,.8)', 8);
    if (b.B.hint) hint(`<b>${b.B.name}</b> ${b.B.hint}`);
  }
  enterPhase(b);
}
function showCard(b) {
  const el = $('#bossCard');
  $('#bossCardPre').textContent = run.st.endless ? 'Endlose Nacht' : `Welt ${run.si + 1} · Boss`;
  $('#bossCardName').textContent = b.B.name; $('#bossCardTitle').textContent = b.B.title;
  el.style.setProperty('--c', b.B.col);
  el.hidden = false; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}
// HP-Leiste: Phase und Wut als Klassen (Markierungen bei 66 % und 33 % macht das CSS)
export function setBossBar(b) {
  const bar = $('#bossBar');
  bar.dataset.ph = String(b.ph + 1); bar.classList.toggle('rage', b.rage);
}

// Phase beginnt (nach dem Auftritt bzw. nach der Phasen-Szene)
function enterPhase(b) {
  const ph = phase(b);
  b.ai.st = 'chase'; b.ai.t = 1.2; b.ai.i = 0;
  const A = run.arena;
  if (ph.burn) Object.assign(A, { burnTo: 64, burnRate: 40, burnKind: 'fire' });
  // Gift von außen: steigt langsam (~50 s bis zum vollen Ring)
  if (ph.poison) Object.assign(A, { burnTo: 250, burnRate: 5, burnKind: 'toxic' });
  if (ph.storm) run.storm = run.storm || .001;
  if (ph.shield) raiseShield(b);
  if (ph.split) splitBoss(b, ph.split);
  if (ph.vessels) spawnVessels(b, ph.vessels);
  setBossBar(b);
}

// ---------- Morgra: Teilen ----------
// Teile (link) sind eigene Gegner mit dem Bild des Bosses, laufen versetzt um den Goblin und zaubern Pfützen und Gas.
// Treffer auf ein Teil gehen auf das gemeinsame Leben (combat.js hurt), sterben tun alle mit dem Boss.
const SPLIT_SC = { 2: 2.1, 3: 1.8 };
function splitBoss(b, n) {
  for (const e of run.enemies) if (e.link === b && !e.dead) { e.dead = true; puff(e.x, e.y, e.sc); }
  b.sc = SPLIT_SC[n] || b.sc; b.r = 38 * b.sc / 2.7;
  for (let i = 1; i < n; i++) {
    const a = Math.atan2(b.y - P.y, b.x - P.x) + i * TAU / n;
    const l = {
      ...b, link: b, x: b.x + Math.cos(a) * 90, y: b.y + Math.sin(a) * 60, ph: 0, hp: 1, maxHp: 1, xp: 0, ice: 0, vessels: null,
      B: { ...b.B, phases: [{ atk: ['gas', 'puddles'], gap: 4 }] }, off: a, flash: .3,
      ai: { st: 'chase', t: 1.5 + i * .9, i: i % 2, atk: null, reps: 0, ring2: 0, ax: 0, ay: 0, chan: 0, spin: null },
    };
    run.enemies.push(l);
    ring(l.x, l.y, 10, 90, .4, b.B.col, 6);
    for (let k = 0; k < 14; k++) part(l.x, l.y - 20, frand(-160, 160), frand(-160, 40), .5, '#9cf06a', 5);
  }
  sfx.boom();
}

// ---------- Knochenhand: Seelengefäße ----------
function spawnVessels(b, n) {
  const A = run.arena;
  b.vessels = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * TAU / n, v = spawnEnemy('soul_vessel', { x: A.x + Math.cos(a) * A.r * .62, y: A.y + Math.sin(a) * A.r * .62 });
    v.hp = v.maxHp = b.maxHp * .045; v.of = b;
    b.vessels.push(v);
  }
}
const vesselsUp = b => !!(b.vessels && b.vessels.some(v => !v.dead));
// Knochenhand Phase 3: tote Skelette stehen als Geister wieder auf
export function bossOnKill(e) {
  const b = run.boss;
  if (!b || e.type !== 'skeleton' || !phase(b).ghosts) return;
  (b.rise || (b.rise = [])).push({ x: e.x, y: e.y, t: 1.2 });
}
function updRise(b, dt) {
  if (!b.rise || !b.rise.length) return;
  for (const r of b.rise) {
    r.t -= dt;
    if (Math.random() < .3) part(r.x + frand(-10, 10), r.y, 0, -60, .5, '#7bff6a', 3);
    if (r.t <= 0 && run.enemies.filter(e => e.type === 'ghost' && !e.dead).length < 14) { spawnEnemy('ghost', { x: r.x, y: r.y }); }
  }
  b.rise = b.rise.filter(r => r.t > 0);
}

// Nach jedem Treffer: Phasenwechsel bei 66 % / 33 % (Leben bleibt an der Schwelle stehen, keine Phase wird übersprungen)
export function bossHurt(b) {
  const next = PHASE_AT[b.ph + 1];
  if (next === undefined || b.hp > b.maxHp * next) return;
  b.hp = b.maxHp * next;
  b.ph++;
  startCut('phase', b);
}
// Unverwundbar, Eisschild
// kx/ky: Rückstoß-Richtung des Treffers (vom Angreifer weg). Ohne Richtung (Flächen, Gift) zählt, wo der Goblin steht.
export function bossDamageRule(b, dmg, kx = 0, ky = 0) {
  const m = b.link || b;
  if (m.inv > 0 || run.cut) return { dmg: 0, blocked: false };
  // Seelengefäße: solange eins steht, prallt alles ab
  if (vesselsUp(m)) {
    if (m.blkT > 0) return { dmg: 0, blocked: false };
    m.blkT = .35;
    return { dmg: 0, blocked: true };
  }
  if (b.ice > 0) {
    const from = kx || ky ? Math.atan2(-ky, -kx) : Math.atan2(P.y - b.y, P.x - b.x);
    let da = from - b.fa; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > 1.9) {
      // von hinten: trifft und knackt den Schild
      if (b.iceCd <= 0) {
        b.iceCd = .3; b.ice--; sfx.frost();
        const bx = b.x - Math.cos(b.fa) * 30, by = b.y - Math.sin(b.fa) * 20 - 20;
        for (let i = 0; i < 8; i++) part(bx, by, frand(-120, 120), frand(-140, 20), .4, '#dff6ff', 4);
        if (b.ice <= 0) breakShield(b);
      }
      return { dmg, blocked: false };
    }
    if (b.blkT > 0) return { dmg: 0, blocked: false };
    b.blkT = .35;
    return { dmg: 0, blocked: true };
  }
  return null;
}
function raiseShield(b) {
  b.ice = 3; b.iceT = 0;
  sfx.frost(); ring(b.x, b.y - 20, 10, 90, .4, '#dff6ff', 6);
  if (!run.seen.has('bossShield')) { run.seen.add('bossShield'); hint('<b>Eisschild</b> Vorne prallt alles ab. Lauf hinter ihn – 3 Treffer in den Rücken brechen den Schild.'); }
}
function breakShield(b) {
  b.iceT = phase(b).shield; b.stunT = 1.4; b.vuln = Math.max(b.vuln || 0, .3); b.vulnT = 2.5;
  run.shake = Math.max(run.shake, 8); sfx.boom();
  for (let i = 0; i < 24; i++) { const a = i * TAU / 24; part(b.x, b.y - 20, Math.cos(a) * 260, Math.sin(a) * 200, .55, i % 2 ? '#dff6ff' : '#8fe6ff', 5); }
  banner('Schild gebrochen!', 'ice');
}

function enrage(b) {
  b.rage = true; b.dmg *= 1.5; b.tint = 'rage';
  banner(b.B.name + ' wird wütend!', 'danger'); sfx.warn();
  ring(b.x, b.y, 20, 220, .6, 'rgba(255,60,40,.9)', 10);
  setBossBar(b);
}

// ---------- Angriffe ----------
// ck: Farbe/Art beim Aufladen · charge: Aufladezeit · reps: Wiederholungen · chan: danach so lange weiterzaubern
// fire(b, tx, ty): auslösen (tx/ty = Stabspitze) · tick(b, dt): während chan
export const ATK = {
  fan: {
    ck: kindOf, charge: .7, reps: b => (b.ph >= 1 ? 2 : 1),
    fire(b, tx, ty) { const base = Math.atan2(P.y - ty, P.x - tx), n = b.ph >= 2 ? 9 : 7; for (let i = 0; i < n; i++) eShot(tx, ty, base + (i - (n - 1) / 2) * .14, shotKind(b.ck), b.dmg * .45, 225, 1.4); },
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
  summon: {
    ck: () => 'blink', charge: .9,
    fire(b) {
      const n = b.ph >= 1 ? 7 : 5;
      for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(run.st.boss.minion || 'fire_apprentice', { x: b.x + Math.cos(a) * 80, y: b.y + Math.sin(a) * 80 }); }
      ring(b.x, b.y, 10, 120, .5, 'rgba(180,120,255,.8)', 6);
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
      for (const o of [-.1, 0, .1]) eShot(tx, ty, base + o, 'frost', b.dmg * .38, 330, 1.25);
    },
  },
  // Frostbart: rutschige Eisflecken (kein Schaden, aber man schlittert)
  icefloor: {
    ck: () => 'frost', charge: .7,
    fire(b) {
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
    fire(b) { addHaz({ shape: 'ring', x: P.x, y: P.y, r: 150, r0: 150, r1: 30, w: 24, gap: rnd() * TAU, gapW: .42, warn: 1, act: 3.2, act0: 3.2, tick: .4, dmg: b.dmg * .35, kind: 'necro', src: 'cage' }); },
  },
  // Knochenhand Phase 3: Lebensraub-Strahl folgt dem Goblin langsam und heilt ihn (höchstens bis zur Phasengrenze)
  drain: {
    ck: () => 'necro', charge: .8, chan: 4.2, move: 0,
    fire(b) {
      addHaz({ shape: 'line', x: b.x, y: b.y, x2: b.x, y2: b.y, w: 26, warn: .8, act: 3.4, tick: .3, dmg: b.dmg * .25, kind: 'necro', src: 'beam', owner: b, cancel: true,
        drain: b, drainMax: PHASE_AT[b.ph] * b.maxHp, spin: { a: Math.atan2(P.y - b.y, P.x - b.x) + .5, w: .75, len: 520, track: true } });
    },
  },
  // Eissplitter-Spirale: zwei Arme, dreht sich
  spiral: {
    ck: () => 'frost', charge: .7, chan: 3.4, move: 0,
    fire(b) { b.ai.spin = { a: rnd() * TAU, dir: rnd() < .5 ? 1 : -1, acc: 0 }; },
    tick(b, dt) {
      const s = b.ai.spin; if (!s) return;
      s.a += 2.1 * s.dir * dt; s.acc -= dt;
      if (s.acc > 0) return;
      s.acc = b.rage ? .06 : .08;
      const arms = b.ph >= 2 ? 3 : 2, k = b.B.kind === 'fire' ? 'fire' : 'frost';
      for (let i = 0; i < arms; i++) eShot(b.x, b.y - 30, s.a + i * TAU / arms, k, b.dmg * .3, 165, 1.1);
    },
  },
};

export function bossAI(b, dt, dx, dy, d) {
  const ai = b.ai;
  if (b.link) {
    // Teil von Morgra: Wut und Schaden wie der Boss, läuft versetzt um den Goblin
    b.rage = b.link.rage; b.dmg = b.link.dmg; b.tint = b.link.tint;
    const a = b.off + run.time * .35, tx = P.x + Math.cos(a) * 150, ty = P.y + Math.sin(a) * 110;
    dx = tx - b.x; dy = ty - b.y; d = Math.hypot(dx, dy) || 1;
  } else {
    b.fightT += dt; b.inv -= dt; b.iceCd -= dt; b.blkT -= dt;
    if (!b.rage && b.fightT >= RAGE_AT) enrage(b);
    if (b.ice <= 0 && b.iceT > 0) { b.iceT -= dt; if (b.iceT <= 0 && phase(b).shield) raiseShield(b); }
    updBurn(dt, b); updRise(b, dt);
  }
  const sp = tempo(b);
  // Blickrichtung: dreht sich zum Spieler, mit Eisschild langsam: im Abstand von 150 px umrundet man ihn mit
  // 1,1 rad/s (Sprint 1,7), er dreht nur 0,6 – nach ~6 s Laufen (gut 2 s Sprint) steht man hinter ihm
  let da = Math.atan2(dy, dx) - b.fa; da = Math.atan2(Math.sin(da), Math.cos(da));
  const turn = (b.ice > 0 ? .6 : 7) * dt;
  if (ai.st !== 'charge' && ai.st !== 'tele') b.fa += clamp(da, -turn, turn);
  b.face = face8(Math.cos(b.fa), Math.sin(b.fa), b.face);
  if (ai.ring2 > 0) { ai.ring2 -= dt; if (ai.ring2 <= 0) bossRing(b, b.ck, Math.PI / (b.ph >= 1 ? 20 : 14)); }
  // Betäubt nach dem Schildbruch
  if (b.stunT > 0) { b.stunT -= dt; b.spr = mspr(b, 'idle', 1); if (Math.random() < .2) part(b.x + frand(-20, 20), b.y - 70, frand(-20, 20), -30, .5, '#ffe27a', 3); return; }
  ai.t -= dt;
  const walk = m => {
    const s = b.spd * sp * m * (b.slowT > 0 ? .6 : 1);
    b.x += Math.cos(b.fa) * s * dt * Math.min(1, d / 60); b.y += Math.sin(b.fa) * s * dt * Math.min(1, d / 60); b.at += dt * m;
  };
  if (ai.st === 'chase') {
    walk(b.ice > 0 ? .7 : 1);
    b.spr = mspr(b, 'walk', ((Math.floor(b.at * 8) % 6) + 1));
    if (ai.t <= 0) {
      const list = phase(b).atk;
      ai.atk = list[ai.i++ % list.length];
      const A = ATK[ai.atk];
      if (A.special) { ai.st = 'tele'; ai.t = .9 / Math.sqrt(sp); ai.ax = dx / d; ai.ay = dy / d; b.fa = Math.atan2(dy, dx); }
      else { ai.st = 'cast'; b.ft = 0; b.fired = false; b.ck = A.ck(b); b.charge = A.charge / Math.sqrt(sp); ai.reps = (A.reps ? A.reps(b) : 1) - 1; sfx.charge(); }
    }
  } else if (ai.st === 'cast') {
    b.ft += dt;
    if (b.ft < b.charge) {
      b.spr = mspr(b, 'cast', (1 + Math.floor(b.ft * 10) % 4));
      if (Math.random() < dt * 40) { const [tx, ty] = tipPos(b), a = Math.random() * TAU; part(tx + Math.cos(a) * 50, ty + Math.sin(a) * 50, -Math.cos(a) * 140, -Math.sin(a) * 140, .32, CCOL[b.ck] || '#fff', 4); }
    } else {
      const f = Math.floor((b.ft - b.charge) * 12), A = ATK[ai.atk];
      b.spr = mspr(b, 'cast', Math.min(8, 5 + f));
      if (!b.fired) { b.fired = true; const [tx, ty] = tipPos(b); A.fire(b, tx, ty); if (A.chan) { ai.chan = A.chan; } }
      if (f >= 4) {
        if (ai.reps > 0) { ai.reps--; b.ft = b.charge * .6; b.fired = false; }
        else if (A.chan) ai.st = 'chan';
        else { ai.st = 'chase'; ai.t = phase(b).gap / sp; }
      }
    }
  } else if (ai.st === 'chan') {
    // Weiterzaubern (Feuerarme, Spirale): Stab erhoben, langsam oder gar nicht laufen
    const A = ATK[ai.atk];
    ai.chan -= dt;
    if (A.move) walk(A.move);
    b.spr = mspr(b, 'cast', 7 + (Math.floor(ai.chan * 8) % 2));
    if (A.tick) A.tick(b, dt);
    if (ai.chan <= 0) { ai.spin = null; ai.st = 'chase'; ai.t = phase(b).gap / sp; }
  } else if (ai.st === 'tele') {
    b.spr = mspr(b, 'idle', ((Math.floor(run.time * 8) % 4) + 1));
    if (ai.t <= 0) { ai.st = 'charge'; ai.t = .75; sfx.whoosh(); }
  } else if (ai.st === 'charge') {
    b.x += ai.ax * 560 * sp * dt; b.y += ai.ay * 560 * sp * dt; b.at += dt * 3;
    b.spr = mspr(b, 'walk', ((Math.floor(b.at * 8) % 6) + 1));
    if (Math.random() < .5) part(b.x + frand(-20, 20), b.y + 30, frand(-30, 30), frand(-30, 0), .4, 'rgba(200,190,170,.7)', 6);
    if (ai.t <= 0) { ai.st = 'chase'; ai.t = phase(b).gap / sp; }
  }
}
export function bossRing(b, kind, off) {
  const n = b.ph >= 1 ? 20 : 14;
  for (let i = 0; i < n; i++) eShot(b.x, b.y - 10, off + i * TAU / n, shotKind(kind), b.dmg * .4, 175, 1.35);
}

// Ignaz Phase 3: der Rand der Arena brennt (wächst auf burnTo px), wer drin steht, nimmt Schaden
// Morgra Phase 3: Gift steigt von außen (burnKind 'toxic', langsam und breit)
function updBurn(dt, b) {
  const A = run.arena; if (!A || !A.burnTo) return;
  A.burn = Math.min(A.burnTo, A.burn + A.burnRate * dt);
  if (Math.hypot(P.x - A.x, P.y - A.y) > A.r - 22 - A.burn) damagePlayer(b.dmg * (A.burnKind === 'toxic' ? .18 : .3), A.burnKind === 'toxic' ? 'poison' : 'burn');
}

// Feuerarme drehen sich mit dem Boss (vom Gefahren-Update aufgerufen)
// track: dreht sich mit höchstens w rad/s zum Goblin (Lebensraub-Strahl)
export function spinHaz(h, dt) {
  const s = h.spin, o = h.owner;
  if (s.track) { let da = Math.atan2(P.y - o.y + 10, P.x - o.x) - s.a; da = Math.atan2(Math.sin(da), Math.cos(da)); s.a += clamp(da, -s.w * dt, s.w * dt); }
  else s.a += s.w * dt * (h.warn > 0 ? .25 : 1);
  h.x = o.x; h.y = o.y - 10; h.x2 = o.x + Math.cos(s.a) * s.len; h.y2 = o.y - 10 + Math.sin(s.a) * s.len;
}
