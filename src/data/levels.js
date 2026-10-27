// ---------- Welten und Level (PLAN 6.1a) ----------
// Jede Stage aus stages.js ist eine Welt mit 5 kurzen Leveln. Die Wellen der Level werden aus dem
// Skript der Welt abgeleitet: Hauptschule (erste Phasen), volle Mischung (letzte Phase), Nebenschule
// (was in der vollen Mischung neu ist), Schwarm-, Elite- und Mini-Boss-Typen aus den Ereignissen.
// Neue Welten brauchen dadurch nur ihr Stage-Skript.
import { STAGES, STAGE_LEN } from './stages.js';
import { STAGE_HP } from '../game/balance.js';

export const LEVELS = 5;          // pro Welt, das letzte ist das Boss-Level
export const LEVEL_LEN = 150;     // Level 1–4: 2:30 überleben
export const BOSS_AT = 90;        // Boss-Level: Boss nach 1:30
export const WORLDS = STAGES.map((st, i) => i).filter(i => !STAGES[i].endless);
export const ENDLESS = STAGES.findIndex(st => st.endless);

// Thema und Schwierigkeit je Level: Schaden/Spawnrate relativ zur Welt, hpT = Gegner-Leben wie nach
// so vielen Sekunden mehr (enemyHp wächst mit der Zeit; die Level sind kürzer als die alten Stages)
export const LEVEL_KIND = [
  { name: 'Vorposten', sub: 'Die Magier der Welt und ein erster Mini-Boss.', dmg: .9, rate: .95, hpT: 0 },
  { name: 'Verstärkung', sub: 'Neue Magier kommen dazu, der Mini-Boss wird stärker.', dmg: 1, rate: 1.05, hpT: 20 },
  { name: 'Elitetrupp', sub: 'Elites, Schwärme und ein harter Mini-Boss.', dmg: 1.35, rate: 1.25, hpT: 50 },
  { name: 'Der Meister', sub: 'Der stärkste Mini-Boss der Welt wartet.', dmg: 1.3, rate: 1.27, hpT: 60 },
  { name: 'Boss', sub: '', dmg: 1.1, rate: 1.15, hpT: 60 },
];
// Schwierigkeit der Welten in den Leveln: eigene, gleichmäßige Kurve statt dmg/rate der alten Stages
// (die waren für 4-Minuten-Läufe verbogen, z. B. Stage 4 am schärfsten). Gegner-Leben: halber Zuschlag
// von STAGE_HP. Neue Welten hängen hier einen Eintrag an.
// boss: Boss-Level leichter (Schaden und Spawnrate ×boss; der Schaden gilt auch für den Boss selbst, so ist es eingestellt)
// – Welten mit vielen Beschwörern/Pfützen
// lvHp: Gegner-Leben in einzelnen Leveln (Index 0–3) zusätzlich ×; 2026-10-27 (Balance nach neuen Karten und Rüstkammer 2.0):
// Welt 1 und 2 waren in Level 3–4 zu leicht (Sim 100 %), Schaden und Spawnrate wirken dort kaum (Treffer gedeckelt).
// Welt 5: mehr Schaden/Spawnrate (Level 4 war 98 %), Boss-Level über boss gleich schwer gelassen
export const WORLD_LV = [{ dmg: 1, rate: 1, bossHp: .7, lvHp: { 2: 1.6, 3: 1.42 } }, { dmg: 1.08, rate: 1.04, bossHp: .7, lvHp: { 2: 1.5, 3: 1.33 } }, { dmg: .76, rate: .88, boss: .84 }, { dmg: .97, rate: 1, boss: .9 }, { dmg: 1.42, rate: 1.25, boss: .78, lvHp: { 2: 1.18 } },
  { dmg: 1.33, rate: 1.22, boss: .97 }, { dmg: 1.45, rate: 1.28, boss: .85 }, { dmg: 1.38, rate: 1.25, boss: .75 }];
const damp = v => 1 + (v - 1) * .5;
// Leben des Bosses im Boss-Level (×2500 × STAGE_HP wie bisher)
export const BOSS_HP = 5.6;   // 2026-10-16 verdoppelt (Wunsch Fabi: Bosse stärker und länger, ~90 s statt ~45 s)
// Ausgleich für den doppelt so langen Kampf: Schaden und Spawnrate im Boss-Level (Sim: Siegquote im Zielbereich)
export const BOSS_EASE = .75;

const ph = (at, dur, rate, mix) => ({ at, dur, rate, mix });
const ev = (at, event, o = {}) => ({ at, event, ...o });
const merge = (...ms) => { const o = {}; for (const [m, f] of ms) for (const k in m) o[k] = Math.max(o[k] || 0, m[k] * f); return o; };

// Bausteine einer Welt aus ihrem Skript
export function worldParts(st) {
  const phs = st.waves.filter(w => w.mix), evs = st.waves.filter(w => w.event);
  const main = merge([phs[0].mix, 1], [phs[1].mix, 1]);
  const full = { ...phs[phs.length - 1].mix };
  let side = {}; for (const k in full) if (!main[k]) side[k] = full[k];
  if (!Object.keys(side).length) side = { ...phs[Math.floor(phs.length / 2)].mix };
  const swarms = evs.filter(e => e.event === 'swarm').map(({ type, extra, count, shape }) => ({ type, extra, count, shape }));
  const elite = (evs.find(e => e.event === 'elite' && e.type) || {}).type;
  const mini = (evs.find(e => e.event === 'miniboss') || {}).type;
  return { main, side, full, swarms, elite, mini };
}

// Wellen-Skript eines Levels (li 0–4)
export function levelWaves(st, li) {
  const P = worldParts(st), { main, side, full } = P;
  const sw = i => (P.swarms.length ? { count: 30, ...P.swarms[i % P.swarms.length] } : { type: Object.keys(main)[0], count: 24 });
  const both = merge([main, 1], [side, .6]), el = P.elite ? { type: P.elite } : {};
  const sideEl = Object.keys(side).find(k => !k.endsWith('_apprentice') && !k.endsWith('_master'));
  // Mini-Boss in jedem Level außer dem Boss-Level (Wunsch Fabi), von Level zu Level stärker:
  // Elite-Eigenschaften 0/1/2/2, Leben ×3/×4/×5/×5
  const mini = (at, affixes, hp) => ev(at, 'miniboss', { type: P.mini, affixes, hp });
  if (li === 0) return [
    ph(0, 28, [.6, 1.2], main), ph(32, 36, [1.3, 2.2], main), ev(70, 'elite', el), mini(90, 0, 3),
    ph(74, 34, [2.2, 3], main), ev(110, 'swarm', { ...sw(0), count: Math.round(sw(0).count * .8), shape: 'ring' }),
    ph(114, 36, [3, 3.4], both), ev(LEVEL_LEN, 'clear'),
  ];
  if (li === 1) return [
    ph(0, 25, [.8, 1.4], main), ph(28, 30, [1.5, 2.4], both), ev(60, 'swarm', { ...sw(1), shape: 'wall' }),
    ph(64, 34, [2.4, 3.3], merge([main, 1], [side, 1])), mini(90, 1, 4), ev(100, 'elite', sideEl ? { type: sideEl } : {}),
    ev(104, 'swarm', { ...sw(2), shape: 'pincer' }), ph(108, 42, [3.3, 4], full), ev(LEVEL_LEN, 'clear'),
  ];
  if (li === 2) return [
    ph(0, 20, [1, 1.6], main), ev(24, 'elite', el), ph(24, 36, [1.8, 2.8], full), ev(45, 'swarm', { ...sw(0), shape: 'stream' }),
    ev(64, 'elite'), ph(64, 40, [2.8, 3.8], full), mini(75, 2, 5), ev(85, 'swarm', { ...sw(1), shape: 'pincer' }), ev(104, 'elite'),
    ph(108, 42, [3.8, 4.4], full), ev(118, 'swarm', { ...sw(2), count: Math.round(sw(2).count * 1.2), shape: 'wall' }), ev(134, 'elite'),
    ev(LEVEL_LEN, 'clear'),
  ];
  if (li === 3) return [
    ph(0, 25, [1, 1.8], both), ev(38, 'elite', el), ph(28, 40, [2, 3.2], full), ev(64, 'swarm', { ...sw(0), shape: 'ring' }),
    ph(72, 24, [3, 3.4], full), mini(100, 2, 5), ph(104, 46, [3, 4.6], full),
    ev(128, 'swarm', { ...sw(1), shape: 'stream' }), ev(LEVEL_LEN, 'clear'),
  ];
  return [
    ph(0, 22, [1.4, 2.6], full), ev(25, 'elite', el), ph(25, 28, [2.6, 3.8], full), ev(48, 'swarm', { ...sw(0), shape: 'ring' }),
    ph(54, 26, [3.8, 4.6], full), ev(60, 'elite'), ev(72, 'warn'), ev(BOSS_AT, 'boss'),
  ];
}

// Spielbare Stage für Welt si, Level li (Endlos: die Stage selbst)
export function levelStage(si, li = 0) {
  const st = STAGES[si];
  if (st.endless) return { ...st, li: 0, len: STAGE_LEN, lvName: st.name };
  const K = LEVEL_KIND[li], boss = li === LEVELS - 1, W = WORLD_LV[Math.min(si, WORLD_LV.length - 1)];
  return {
    ...st, li, len: boss ? 0 : LEVEL_LEN, waves: levelWaves(st, li), dmg: W.dmg * K.dmg * (boss ? (W.boss || 1) * BOSS_EASE : 1), rate: W.rate * K.rate * (boss ? (W.boss || 1) * BOSS_EASE : 1), hpT: K.hpT,
    hpMul: damp(STAGE_HP[si]) / STAGE_HP[si] * ((W.lvHp && W.lvHp[li]) || 1),
    lvName: boss ? st.boss.name : K.name, bossHp: boss ? BOSS_HP * (W.bossHp || 1) : 1,
  };
}
export const levelLabel = (si, li) => STAGES[si].endless ? '∞' : `${si + 1}-${li + 1}`;

// Was nach Level li der Welt si kommt: nächstes Level, nächste Welt, nach der letzten Welt Endlos
export function nextLevel(si, li) {
  if (STAGES[si].endless) return null;
  if (li < LEVELS - 1) return { si, li: li + 1 };
  const w = WORLDS.indexOf(si);
  if (w + 1 < WORLDS.length) return { si: WORLDS[w + 1], li: 0 };
  return ENDLESS >= 0 ? { si: ENDLESS, li: 0 } : null;
}
