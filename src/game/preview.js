// ---------- Vorschau im Entwicklungs-Baum (Wunsch Fabi 2026-10-16) ----------
// Ein Mini-Lauf mit der echten Spiellogik: der Goblin steht in der Mitte, Übungsratten kreisen um ihn, die gewählte
// Waffe (Stufe 5, entwickelt oder als Mega) schlägt zu. Abgeschottet: eigener Zufall, kein Ton, keine Ereignisse;
// danach sind der echte Lauf (falls einer läuft) und sein Zufall unverändert. Nur aus der UI, nie aus der Sim.
import { hushed } from '../core/audio.js';
import { unheard } from '../core/events.js';
import { RNG } from '../core/rng.js';
import { TAU } from '../core/util.js';
import { MEGAS, WEAPONS, weaponOf } from '../data/weapons.js';
import { spawnEnemy, updEnemy } from './enemies.js';
import { updTele, updEProj } from './hazards.js';
import { MEGA_BOOST, updMegas } from './mega.js';
import { addWeapon, newRun, recalc, savePrev, updFx } from './run.js';
import { P, buildGrid, grid, run, setRun } from './state.js';
import { updAllies, updPProj, updWeapons } from './weapons.js';
import { updWfx } from './weapons2.js';

export const PREVIEW_STEP = 1 / 60;
const RATS = 16, RAT_HP = 140;
let sb = null;   // { run, P, rng, acc }

// Welche Waffen ein Knoten zeigt: w Waffe (Stufe 5), p Passiv (zeigt die Entwicklung, die es freischaltet), e Entwicklung, m Mega
const weaponsFor = (k, id) => (k === 'm' ? MEGAS[id].of : [k === 'p' ? weaponOf(id) : id]);

// fn läuft mit dem Mini-Lauf als run/P und dessen Zufall; alles Echte kommt danach zurück, auch das Raster
// genau so, wie es war (der nächste Schritt des echten Laufs fragt es ab, bevor er es neu baut)
function inSandbox(fn) {
  const real = [run, P], rng = { ...RNG }, cells = [...grid];
  try {
    return hushed(() => unheard(() => {
      if (sb) { setRun(sb.run, sb.P); Object.assign(RNG, sb.rng); }
      return fn();
    }));
  } finally {
    if (sb) sb.rng = { ...RNG };
    Object.assign(RNG, rng); setRun(real[0], real[1]);
    grid.clear(); for (const [k, a] of cells) grid.set(k, a);
  }
}

export function previewStart(k, id) {
  sb = null;
  inSandbox(() => {
    newRun(0, 4242, 0);
    run.clearT = 1e9;   // unverwundbar (damagePlayer), keine Level-Ups (Kristalle werden ohnehin weggeräumt)
    run.events.length = 0; run.hints.length = 0; run.weapons.length = 0;
    P.lv = 20;
    const evo = k !== 'w';
    for (const wid of weaponsFor(k, id)) {
      addWeapon(wid);
      Object.assign(run.weapons[run.weapons.length - 1], { lv: 5, evo });
      if (evo) run.passives[WEAPONS[wid].with] = 5;
    }
    if (k === 'm') { for (const w of run.weapons) { w.mega = id; w.card *= MEGA_BOOST; } run.megas.push({ id, t: .6 }); }
    recalc(); P.hp = P.maxHp;
    sb = { run, P, rng: { ...RNG }, acc: 0 };
  });
}
export const previewStop = () => { sb = null; };
export const previewOn = () => !!sb;

// Übungsratten: kreisen im Abstand um den Goblin, damit er nie getroffen wird; Ersatz kommt vom Rand
function rats() {
  let n = 0; for (const e of run.enemies) if (!e.dead) n++;
  for (; n < RATS; n++) {
    const a = RNG.spawn.next() * TAU, R = 330 + RNG.spawn.next() * 60;
    const e = spawnEnemy('skeleton', { x: Math.cos(a) * R, y: Math.sin(a) * R * .8, portal: false });
    Object.assign(e, { pre: 'n.rat', hp: RAT_HP, xp: 0, ai: 'kite', keep: 80 + RNG.spawn.next() * 110, spd: 60, dmg: 0, sc: .8 });
  }
}
function step(dt) {
  savePrev();
  run.time += dt; P.anim += dt; P.hp = P.maxHp;
  rats();
  buildGrid();
  for (const e of run.enemies) if (!e.dead) updEnemy(e, dt);
  buildGrid();
  updWeapons(dt); updAllies(dt); updPProj(dt); updWfx(dt); updMegas(dt); updTele(dt); updEProj(dt);
  run.enemies = run.enemies.filter(e => !e.dead);
  run.items.length = 0;
  updFx(dt);
}
// dt Sekunden weiterrechnen, dann draw() im Mini-Lauf (zeichnet mit run/P der Vorschau)
export function previewFrame(dt, draw) {
  if (!sb) return;
  inSandbox(() => {
    sb.acc = Math.min(sb.acc + dt, .25);
    while (sb.acc >= PREVIEW_STEP) { step(PREVIEW_STEP); sb.acc -= PREVIEW_STEP; }
    draw();
  });
}
