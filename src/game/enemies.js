import { RNG, frand, rand } from '../core/rng.js';
import { sfx } from '../core/audio.js';
import { DIR8, TAU, face8 } from '../core/util.js';
import { ETYPES, SCHOOL_COL } from '../data/enemies.js';
import { MAGE_OFF, U } from '../render/sprites.js';
import { STAGE_LEN } from '../data/stages.js';
import { nmHp, nmMinis } from '../data/nightmare.js';
import { cycleHp } from '../data/souls.js';
import { boonHp, endlessDmg, enemyHp } from './balance.js';
import { bossAI, bossDamageRule, spawnBoss } from './boss.js';
import { CASTS, castAllowed, castWindup } from './casts.js';
import { damagePlayer, hurt } from './combat.js';
import { addItem, animFx, part, puff, ring } from './fx.js';
import { hint, startClear } from './run.js';
import { affixDamage, affixNames, affixOnDeath, rollAffixes, updAffixes } from './affixes.js';
import { P, hasMut, onScreen, pR, query, run, viewHH, viewHW, viewR, hidden } from './state.js';
import { banner } from '../ui/hud.js';

export { eShot } from './casts.js';

// ---------- Gegner ----------
export const SPAWN_T = .4;
// Albtraum: Leben je Stufe (data/nightmare.js), Stufe 1 = +80 %
const has = (e, t) => e.traits && e.traits.includes(t);


// Sprite-Name: m.<schule>[.m|.c].<anim>.<richtung>.<n> (Magier) oder n.<art>.<anim>.<richtung>.<n> (Diener)
export const mageKey = (school, master, clone) => 'm.' + school + (master ? '.m' : clone ? '.c' : '');
export const typeSprite = T => T.sprite ? 'n.' + T.sprite : T.draw ? null : mageKey(T.school, T.role === 'master', T.clone);
export const mspr = (e, anim, n, face = e.face) => `${e.pre}.${anim}.${face}.${n}`;
// Stabspitze im Abschuss-Frame (aus dem Generator), skaliert wie das Sprite
export const tipPos = e => { const o = MAGE_OFF[e.pre] && MAGE_OFF[e.pre][e.face]; if (!o) return [e.x, e.y - 20 * e.sc]; const s = U * e.sc; return [e.x + o[0] * s, e.y + o[1] * s]; };

export function spawnEnemy(type, opt = {}) {
  const T = ETYPES[type], st = run.st;
  // Runde (nur Endlos): Schaden wächst glatt mit der Zeit, Leben über enemyHp (balance.js)
  const tf = st.endless ? endlessDmg(run.time) : 1 + run.time / 400;
  let x = opt.x, y = opt.y;
  if (x === undefined) { const a = RNG.spawn.next() * TAU, R = viewR() + 60; x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R; }
  const e = {
    type, pre: typeSprite(T), x, y, r: T.r, sc: T.sc, spd: T.spd * RNG.spawn.range(.9, 1.1), dmg: T.dmg * st.dmg * tf,
    hp: enemyHp(T.hp, run.si, run.time + (st.hpT || 0)) * (st.endless ? boonHp(run.cnt.boon || 0) : 1) * (st.hpMul || 1) * nmHp(run.nm) * cycleHp(run.cycle), xp: T.xp, tint: null, school: T.school, ai: T.ai, keep: T.keep || 0, traits: T.traits || null, melee: T.melee || null,
    casts: (T.casts || []).map(c => ({ ...c, t: RNG.spawn.range(1.5, c.cd[1]) })),
    bomber: has(T, 'bomber'), obj: !!T.draw, clone: !!T.clone, side: RNG.spawn.next() < .5 ? 1 : -1,
    state: 'walk', face: 'down', at: RNG.spawn.next() * 5, ft: 0, fired: false, ck: null, charge: 0, chain: null, fuse: 0,
    kx: 0, ky: 0, slowT: 0, freezeT: 0, flash: 0, oh: 0, spr: null, dead: false, shield: 0,
  };
  if (opt.mini) { e.sc *= .65; e.r *= .7; e.hp *= .3; e.xp = Math.ceil(e.xp / 3); e.mini = true; }
  if (opt.elite) { e.elite = true; e.hp *= 14; e.sc *= 1.6; e.r *= 1.6; e.dmg *= 1.5; e.xp = 30; e.tint = 'gold'; e.spd *= .85; rollAffixes(e, opt.affixes); }
  if (opt.miniboss) { e.miniboss = true; e.hp *= opt.hpMul ?? 5; e.sc *= 1.3; e.r *= 1.3; e.xp = 40; e.spd *= .9; }
  // Mutatoren (Phase 12): Riesen, Goldrausch, Schnelle Magier
  if (hasMut('giants') && !e.boss) { e.sc *= 1.3; e.r *= 1.2; e.hp *= 1.25; e.spd *= .9; }
  if (hasMut('gold')) e.hp *= 1.15;
  if (hasMut('fast')) e.spd *= 1.3;
  e.maxHp = e.hp;
  // Sichtbare Spawns kommen durch ein Portal (0,4 s, solange nicht angreifbar)
  if ((opt.x !== undefined && opt.portal !== false) || onScreen(x, y, 40)) { e.spawnT = SPAWN_T; if (onScreen(x, y)) sfx.portal(); }
  run.enemies.push(e);
  if (!run.seen.has(type) && T.tip) { run.seen.add(type); if (type !== 'fire_mage' || run.si === 0) hint(`<b>${T.name}</b> ${T.tip}`); }
  return e;
}
// Manche Gegner kommen nur zu zweit (Donnerpriester)
function spawnGroup(type) {
  const e = spawnEnemy(type), n = ETYPES[type].group || 1;
  for (let i = 1; i < n; i++) {
    const a = Math.atan2(e.y - P.y, e.x - P.x) + (i % 2 ? .45 : -.45), R = Math.hypot(e.x - P.x, e.y - P.y);
    spawnEnemy(type, { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R });
  }
}

// ---------- Director: Wellen-Skript der Stage (data/stages.js) ----------
// Lokale Zeit innerhalb der aktuellen Runde (Endlos: jede Runde spielt das Skript erneut)
// Verlangsamt: 50 %; Wurzelgriff (Pilzring) stärker, aber nur solange der Gegner im Ring steht
const slowMul = e => (e.slowT > 0 ? (e.slowKT > run.time ? e.slowK : .5) : 1);
const localT = () => run.time - run.loop * STAGE_LEN;
// Aktive Phase, in Ruhepausen die letzte (für Elite-Typen)
function phaseAt(t, active) {
  let cur = null;
  for (const w of run.st.waves) if (w.mix && w.at <= t) cur = w;
  return active && cur && t >= cur.at + cur.dur ? null : cur;
}
const pickMix = mix => {
  let tot = 0; for (const k in mix) tot += mix[k];
  let r = RNG.spawn.next() * tot;
  for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
  return Object.keys(mix)[0];
};

export function doEvent(ev) {
  if (ev.event === 'elite') {
    // Elite: nur normale Magier (Meister mit ×14 Leben wären zu viel)
    const mix = (phaseAt(localT()) || {}).mix || {};
    const types = Object.keys(mix).filter(k => ETYPES[k].role === 'mage');
    const el = spawnEnemy(ev.type || RNG.spawn.pick(types.length ? types : ['fire_mage']), { elite: true, affixes: ev.affixes });
    if (hasMut('elites')) spawnEnemy(el.type, { elite: true, affixes: ev.affixes });   // Mutator Doppelte Elites
    banner(el.affixes.length ? 'Elite: ' + affixNames(el) + '!' : 'Elite-Magier!', '');
  } else if (ev.event === 'miniboss') {
    // Mini-Boss (6.3): Meister der Schule mit 2 Elite-Eigenschaften und eigener Leiste oben
    const e = spawnEnemy(ev.type, { miniboss: true, hpMul: ev.hp });
    rollAffixes(e, ev.affixes ?? 2); run.mini = e;
    // Albtraum ab Stufe 7: ein zweiter Mini-Boss (ohne eigene Leiste und ohne Truhe)
    for (let k = 1; k < nmMinis(run.nm); k++) { const m2 = spawnEnemy(ev.type, { miniboss: true, hpMul: ev.hp }); m2.noChest = true; rollAffixes(m2, ev.affixes ?? 2); }
    banner('Mini-Boss: ' + ETYPES[ev.type].name + '!', 'danger'); sfx.warn();
    hint(`<b>${ETYPES[ev.type].name}</b> ${e.affixes.length ? affixNames(e) + ' – ' : ''}er trägt eine Truhe.`);
    return e;
  } else if (ev.event === 'swarm') { swarm(ev); banner('Ansturm!', 'danger'); }
  else if (ev.event === 'warn') { banner('Der Boss naht …', 'danger'); sfx.warn(); }
  else if (ev.event === 'boss') spawnBoss();
  else if (ev.event === 'clear') levelClear();
}

// Level überlebt (6.1a): alle Magier lösen sich auf, Kristalle fliegen zum Goblin, kurz danach das Ergebnis
function levelClear() {
  // ein noch lebender Mini-Boss lässt seine Truhe trotzdem fallen (der Hinweis hat sie versprochen)
  if (run.mini && !run.mini.dead) addItem('chest', run.mini.x, run.mini.y, 'mini');
  for (const e of run.enemies) if (!e.dead) { e.dead = true; puff(e.x, e.y, e.sc); }
  run.eproj.length = 0; run.haz.length = 0; run.spawnQ.length = 0;
  banner('Level geschafft!', ''); sfx.chest();
  startClear(2.5);
}

// Schwarm-Formen. Jeder sechste Gegner ist "extra", falls angegeben.
function swarm({ type, extra, count = 30, shape = 'ring', side }) {
  const n = Math.round(count * (1 + run.loop * .25)), kind = i => i % 6 === 0 && extra ? extra : type;
  const hw = viewHW(), hh = viewHH();
  // Linie außerhalb des Bildschirms auf Seite s (0 rechts, 1 unten, 2 links, 3 oben), läuft dann herein
  const wall = (s, m, k0) => {
    for (let i = 0; i < m; i++) {
      const f = m > 1 ? i / (m - 1) * 2 - 1 : 0;
      const x = s === 0 ? hw + 50 : s === 2 ? -hw - 50 : f * hw * 1.1, y = s === 1 ? hh + 50 : s === 3 ? -hh - 50 : f * hh * 1.1;
      spawnEnemy(kind(k0 + i), { x: P.x + x, y: P.y + y, portal: false });
    }
  };
  const pickSide = () => side === undefined ? (RNG.spawn.next() * 4) | 0 : side;
  if (shape === 'ring') {
    const R = viewR() * .85;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; spawnEnemy(kind(i), { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); }
  } else if (shape === 'wall') wall(pickSide(), n, 0);
  else if (shape === 'pincer') { const s = pickSide() % 2; wall(s, n >> 1, 0); wall(s + 2, n - (n >> 1), n >> 1); }
  else if (shape === 'stream') {
    // Strom: über 4 s aus einer Richtung, die Richtung bleibt fest, auch wenn du läufst
    const a = RNG.spawn.next() * TAU;
    for (let i = 0; i < n; i++) run.spawnQ.push({ t: run.time + i * 4 / n, type: kind(i), a: a + RNG.spawn.range(-.25, .25) });
  }
}

export function spawnTick(dt) {
  // Warteschlange (Ströme) läuft auch während Ereignissen weiter
  while (run.spawnQ.length && run.spawnQ[0].t <= run.time) {
    const q = run.spawnQ.shift(), R = viewR() + 40;
    if (!run.boss) spawnEnemy(q.type, { x: P.x + Math.cos(q.a) * R, y: P.y + Math.sin(q.a) * R, portal: false });
  }
  if (run.boss) return;
  const t = localT(), w = phaseAt(t, true);
  if (!w) return;   // Ruhepause
  const f = (t - w.at) / w.dur, rate = (w.rate[0] + (w.rate[1] - w.rate[0]) * f + run.loop * 2) * run.st.rate * (hasMut('swarm') ? 1.5 : 1);   // Mutator Schwarm
  const cap = Math.min(280, 70 + t * .9 + run.loop * 60);
  run.spawnAcc += rate * dt;
  while (run.spawnAcc >= 1) {
    run.spawnAcc -= 1;
    if (run.enemies.length >= cap) continue;
    spawnGroup(pickMix(w.mix));
  }
}

function startCast(e, c) {
  e.state = 'cast'; e.ft = 0; e.fired = false; e.ck = c.id; e.cur = c; e.charge = castWindup(c.id);
  e.face = face8(P.x - e.x, P.y - e.y, e.face);
  const C = CASTS[c.id];
  if (C.start) { run.caster = e; C.start(e); run.caster = null; }
  if (onScreen(e.x, e.y) && !e.clone) sfx.charge();
}

// ---------- Bewegung ----------
function move(e, dt, dx, dy, d) {
  let mx = dx / d, my = dy / d;
  if (e.ai === 'still') return [0, 0];
  if (e.ai === 'kite' && e.keep && d < e.keep) { mx = -dx / d * .5 - dy / d * .8 * e.side; my = -dy / d * .5 + dx / d * .8 * e.side; }
  else if (e.ai === 'kite' && e.keep && d < e.keep + 60) { mx = -dy / d * e.side; my = dx / d * e.side; }   // im Wunschabstand seitlich laufen
  else if (e.ai === 'zigzag') { const w = Math.sin(run.time * 6 + e.at * 3) * 1.1; mx = (dx - dy * w) / d; my = (dy + dx * w) / d; const l = Math.hypot(mx, my); mx /= l; my /= l; }
  return [mx, my];
}

export function updEnemy(e, dt) {
  if (e.spawnT > 0) {
    e.spawnT -= dt; e.face = face8(P.x - e.x, P.y - e.y, e.face);
    if (e.pre) e.spr = mspr(e, 'idle', 1);
    return;
  }
  if (e.affixes) updAffixes(e, dt, spawnEnemy);
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) e.slowT -= dt;
  if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.vuln = 0; }
  e.x += e.kx * dt; e.y += e.ky * dt;
  const kd = Math.exp(-9 * dt); e.kx *= kd; e.ky *= kd;
  if (e.freezeT > 0) { e.freezeT -= dt; return; }
  // Rauchbombe: alle außer dem Boss laufen zu deinem alten Platz und zaubern nicht
  const blind = hidden() && !e.boss && run.decoy;
  let tx = P.x, ty = P.y;
  if (blind) {
    // Nicht alle auf einen Punkt (dort zittern sie hin und her): jeder sucht auf einem eigenen Ring um den alten Platz,
    // der Suchpunkt wandert langsam herum
    if (e.seek !== run.decoy) { e.seek = run.decoy; e.seekA = Math.atan2(e.y - run.decoy.y, e.x - run.decoy.x); e.seekR = rand(60, 140); }
    const a = e.seekA + run.time * .5 * e.side;
    tx = run.decoy.x + Math.cos(a) * e.seekR; ty = run.decoy.y + Math.sin(a) * e.seekR;
  }
  // Strohgoblin: wer im Lock-Umkreis einer Puppe steht, geht auf sie los und zaubert nicht
  let lured = null;
  if (!blind && !e.boss && !e.obj && run.lures && run.lures.length) for (const L of run.lures) if ((e.x - L.x) ** 2 + (e.y - L.y) ** 2 < L.lure * L.lure) { lured = L; tx = L.x; ty = L.y; break; }
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.boss) { bossAI(e, dt, dx, dy, d); return; }
  if (e.bomber) { updBomber(e, dt, dx, dy, d); return; }
  if (e.obj) { updObject(e, dt); return; }
  // Ansturm (Paladin): fest in eine Richtung, Kontakt schadet
  if (e.dash) {
    e.dash.t -= dt; e.x += e.dash.vx * dt; e.y += e.dash.vy * dt; e.at += dt * 3;
    if (Math.random() < .5) part(e.x + frand(-14, 14), e.y + 20 * e.sc, frand(-30, 30), frand(-30, 0), .4, 'rgba(255,250,220,.8)', 5);
    e.spr = mspr(e, 'walk', (Math.floor(e.at * 9) % 6) + 1);
    if (e.dash.t <= 0) { e.dash = null; e.state = 'walk'; }
    return;
  }
  if (e.state === 'cast') {
    e.ft += dt * (e.slowT > 0 ? .6 : 1);
    const C = CASTS[e.ck];
    if (e.ft < e.charge) {
      e.spr = mspr(e, 'cast', 1 + Math.floor(e.ft * 10) % 4);
      if (C.aim) e.face = face8(dx, dy, e.face);
      if (Math.random() < dt * 25) { const [tx, ty] = tipPos(e), a = Math.random() * TAU; part(tx + Math.cos(a) * 22 * e.sc, ty + Math.sin(a) * 22 * e.sc, -Math.cos(a) * 70, -Math.sin(a) * 70, .28, C.col, 2.5); }
    } else {
      const f = Math.floor((e.ft - e.charge) * 14);
      // Rauchbombe: der Zauber hat sein Ziel verloren und verpufft (samt seiner Bodenwarnung)
      if (!e.fired && blind) {
        e.state = 'walk'; e.cur.t = 1.5;
        for (const h of run.haz) if (h.owner === e && h.cancel) h.done = true;
        return;
      }
      if (!e.fired) {
        e.fired = true; e.cur.t = rand(e.cur.cd[0], e.cur.cd[1]);
        const [tx, ty] = tipPos(e);
        run.caster = e; C.release(e, tx, ty, spawnEnemy); run.caster = null;   // Geschosse/Zonen merken sich den Zaubernden
      }
      if (e.dash) return;
      if (f >= 4) {
        e.state = 'walk';
        if (e.chain) { const k = e.chain; e.chain = null; startCast(e, e.casts.find(c => c.id === k) || { id: k, cd: [4, 6] }); }
      } else e.spr = mspr(e, 'cast', 5 + f);
    }
    return;
  }
  // Nahkämpfer: nach einer Berührung kurz zurückweichen (Blick bleibt beim Spieler), dann wieder ran.
  // Sonst stehen sie auf dem Spieler und zittern zwischen Hinlaufen und Wegschieben hin und her.
  if (!blind && e.ai !== 'kite' && e.ai !== 'still' && !(e.backT > 0) && d < pR() + e.r) e.backT = rand(.35, .55);
  let [mx, my] = move(e, dt, dx, dy, d), back = 1;
  if (e.backT > 0) { e.backT -= dt; mx = -dx / d; my = -dy / d; back = .7; }
  // im Rauch: am Suchpunkt weich abbremsen statt drüberzuschießen
  const sp = e.spd * slowMul(e) * back * (blind ? Math.min(1, d / 40) : 1);
  e.x += mx * sp * dt; e.y += my * sp * dt;
  e.face = face8(dx, dy, e.face); e.at += dt * (e.slowT > 0 ? .5 : 1);
  e.spr = mspr(e, 'walk', (Math.floor(e.at * 9) % 6) + 1);
  // Zauber: der erste, der bereit ist und gewirkt werden darf
  for (const c of e.casts) {
    c.t -= dt;
    if (c.t > 0 || e.state === 'cast' || blind || lured) continue;
    if (d < c.range && onScreen(e.x, e.y, -20)) { if (castAllowed(e, c)) startCast(e, c); else c.t = .6; }
  }
  if (d > viewR() * 1.9 && !e.elite && !e.miniboss) { e.px = e.x = P.x + dx / d * viewR() * 1.1; e.py = e.y = P.y + dy / d * viewR() * 1.1; }
}

// Objekte: Portal spuckt Lehrlinge, Knochenhaufen steht wieder auf
function updObject(e, dt) {
  if (has(e, 'portal')) {
    e.spawnCd -= dt;
    if (e.spawnCd <= 0 && run.enemies.length < 260) { e.spawnCd = 3; const a = rand(0, TAU); spawnEnemy('shadow_apprentice', { x: e.x + Math.cos(a) * 30, y: e.y + Math.sin(a) * 30 }).spawnT = .3; }
    if (e.portalOf && e.portalOf.dead) e.hp -= dt * 8;   // ohne Leerenwandler zerfällt das Portal langsam
    if (e.hp <= 0) { e.dead = true; ring(e.x, e.y, 10, 60, .4, 'rgba(180,110,255,.9)', 5); }
  } else if (has(e, 'bones')) {
    e.revT -= dt;
    if (e.revT <= 0) {
      e.dead = true;
      const o = spawnEnemy('necro_apprentice', { x: e.x, y: e.y }); o.noRevive = true; o.spawnT = .3;
      ring(e.x, e.y, 6, 40, .35, 'rgba(120,255,110,.8)', 4);
    }
  }
}

export function updBomber(e, dt, dx, dy, d) {
  if (e.fuse > 0) {
    e.fuse -= dt; e.spr = mspr(e, 'idle', 1 + Math.floor(e.fuse * 12) % 4);
    if (Math.random() < .5) part(e.x + frand(-6, 6), e.y - 26 * e.sc, frand(-40, 40), frand(-80, -30), .3, '#ffd84a', 2.5);
    if (e.fuse <= 0) bomberBoom(e, true);
    return;
  }
  const sp = e.spd * slowMul(e);
  e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
  e.face = face8(dx, dy, e.face); e.at += dt;
  e.spr = mspr(e, 'walk', (Math.floor(e.at * 12) % 6) + 1);
  if (d < 70) { e.fuse = .85; sfx.fuse(); }
  if (d > viewR() * 1.9) { e.px = e.x = P.x + dx / d * viewR() * 1.1; e.py = e.y = P.y + dy / d * viewR() * 1.1; }
}
export function bomberBoom(e, hurtPlayer) {
  if (e.boomed) return; e.boomed = true;
  const R = 80;
  if (hurtPlayer && Math.hypot(P.x - e.x, P.y - e.y) < R + pR()) damagePlayer(14 * run.st.dmg * (1 + run.time / 400), 'bomb');
  e.dead = true;
  query(e.x, e.y, R, o => { if (o !== e) { const d = Math.hypot(o.x - e.x, o.y - e.y) || 1; hurt(o, (25 + run.time * .12) * (hurtPlayer ? .5 : 1.5), 220, (o.x - e.x) / d, (o.y - e.y) / d, '#ffb35c'); } });
  animFx('f_fireball_hit_', 5, e.x, e.y, R / 16); sfx.boom(); run.shake = Math.max(run.shake, 6);
}

// Treffer-Regeln je Gegner (vor dem Abziehen der Lebenspunkte). Gibt den Schaden zurück, der durchkommt.
export function damageRules(e, dmg, kx, ky) {
  if (e.boss) { const r = bossDamageRule(e, dmg, kx, ky); if (r) return r; }
  if (e.affixes) { dmg = affixDamage(e, dmg, kx, ky); if (dmg <= 0) return { dmg: 0, blocked: true }; }
  // Gletscherwächter: Eisschild vorne blockt fast alles, was aus Blickrichtung kommt
  if (has(e, 'frontShield') && (kx || ky)) {
    const fa = DIR8.indexOf(e.face) * Math.PI / 4, l = Math.hypot(kx, ky);
    if ((kx * Math.cos(fa) + ky * Math.sin(fa)) / l < -.4) {
      for (let i = 0; i < 3; i++) part(e.x + Math.cos(fa) * 20 * e.sc, e.y + Math.sin(fa) * 20 * e.sc - 10, frand(-80, 80), frand(-80, 20), .3, '#dff6ff', 3);
      return { dmg: dmg * .15, blocked: true };
    }
  }
  // Schild vom Schildpriester schluckt zuerst
  if (e.shield > 0) {
    const a = Math.min(e.shield, dmg); e.shield -= a; dmg -= a;
    if (e.shield <= 0) { ring(e.x, e.y - 10, 10, 40 * e.sc, .3, 'rgba(255,220,110,.9)', 4); }
  }
  return { dmg, blocked: false };
}

// Was beim Tod passiert (Teilen, Knochenhaufen, Grab für den Lich)
export function deathRules(e) {
  if (e.affixes) affixOnDeath(e, spawnEnemy);
  if (has(e, 'split') && !e.mini) {
    for (const s of [-1, 1]) { const o = spawnEnemy(e.type, { x: e.x + s * 24, y: e.y, mini: true }); o.spawnT = .25; o.traits = null; }
  }
  if (has(e, 'revive') && !e.noRevive) {
    const b = spawnEnemy('bone_pile', { x: e.x, y: e.y }); b.revT = 3; b.spawnT = 0;
  }
  if (!e.obj && !e.clone && !e.boss && e.pre && e.pre.startsWith('m.')) {
    run.graves.push({ x: e.x, y: e.y }); if (run.graves.length > 10) run.graves.shift();
  }
  if (e.cloneOf === undefined) for (const o of run.enemies) if (o.cloneOf === e && !o.dead) { o.dead = true; ring(o.x, o.y, 6, 30, .3, 'rgba(200,160,255,.8)', 3); }
}
export const schoolCol = e => SCHOOL_COL[e.school] || '#ffffff';
