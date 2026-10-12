// npm run sim                         → jede Stage ohne und mit erwarteten Upgrades, mit Zielwerten (7.6)
// npm run sim -- --v2                 → alter Satz aus v2 (6 Konfigurationen)
// npm run sim -- --stage 4 --talents exp  → erwartete Upgrades für Stage 4
// npm run sim -- --loadout rage,trap  → andere Fähigkeiten (Standard rage,mech wie v2)
// npm run sim -- --levels [--stage 2]   → Welten (6.1a): alle 5 Level je Welt mit erwarteten Upgrades
// npm run sim -- --stage 3 --level 5   → nur ein Level (5 = Boss-Level)
// npm run sim -- --stage 3 --runs 50 --talents atk=4,hp=4 [--seed 1] [--hz 60] [--par 3] [--html datei]
import os from 'node:os';
import { chromium } from 'playwright';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { botRun } from './bot.js';
import { EXPECTED, LEVEL_TARGET, TARGET } from './expected-progress.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const html = resolve(args.html || join(ROOT, 'dist', 'goblin-io.html'));
const runs = +args.runs || 20, seed0 = args.seed !== undefined ? +args.seed : 1, hz = +args.hz || 60;
const loadout = args.loadout ? String(args.loadout).split(',') : ['rage', 'mech'];
const parseTalents = s => Object.fromEntries(String(s || '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k, +v]; }));

const SRC = { contact: 'Kontakt', proj: 'Geschoss', boss: 'Boss', bomb: 'Bombe', strike: 'Blitz', zone: 'Pfütze', wall: 'Feuerwand', beam: 'Strahl', gas: 'Gas', rock: 'Fels', spikes: 'Stacheln' };
const SUITE_V2 = [[1, {}], [2, {}], [3, {}], [3, { atk: 8, hp: 8 }], [4, { atk: 12, hp: 12 }], [5, { atk: 16, hp: 16, spd: 6 }]];   // Werkstatt-Stufen aus v2 ×2
// Standard: jede Stage ohne Upgrades und mit den erwarteten (sim/expected-progress.js), Stage 1 nur einmal
const SUITE = [[1, {}], [2, {}], [2, EXPECTED[2]], [3, {}], [3, EXPECTED[3]], [4, {}], [4, EXPECTED[4]], [5, {}], [5, EXPECTED[5]]];
const LV = args.levels ? [1, 2, 3, 4, 5] : args.level ? [+args.level] : null;
const configs = LV ? (args.stage ? [+args.stage] : [1, 2, 3, 4, 5]).flatMap(s => LV.map(l => [s, args.talents && args.talents !== 'exp' ? parseTalents(args.talents) : EXPECTED[s], l])) : args.stage ? [[+args.stage, args.talents === 'exp' ? EXPECTED[+args.stage] : parseTalents(args.talents)]] : args.v2 ? SUITE_V2 : SUITE;

// Mehrere Seiten parallel; jede Seite rechnet ihre Läufe nacheinander (Ergebnis hängt nur am Seed)
// Jede Seite braucht ~550 MB. WSL hat nur 4 GB, und bei einem OOM-Kill reißt systemd dort die ganze
// Sitzung mit (2026-10-12 passiert mit 6 Seiten). Deshalb nie mehr Seiten als der freie Speicher trägt.
const PAGE_MB = 550, wantPar = Math.max(1, +args.par || 3);
const fitPar = Math.max(1, Math.floor((os.freemem() / 2 ** 20 - 1000) / PAGE_MB));
const par = Math.min(wantPar, fitPar);
if (par < wantPar) console.log(`Nur ${par} statt ${wantPar} Seiten parallel (freier Speicher ${Math.round(os.freemem() / 2 ** 20)} MB)`);
const b = await chromium.launch();
const pages = await Promise.all(Array.from({ length: par }, async () => {
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message));
  await p.goto('file://' + html);
  await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu');
  await p.evaluate(() => GOBLIN.allLoaded);
  return p;
}));

const pct = (a, n) => (100 * a / n).toFixed(0).padStart(3) + ' %';
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log(`${html}\n${runs} Läufe pro Konfiguration, Seeds ab ${seed0}, ${hz} Hz, Fähigkeiten ${loadout.join(' + ')}\n`);
console.log('Stage  Talente               Siege   Ziel       Ø Zeit  Fähigk.  Ø Lv@1/2/3/4 min      Ø Schaden nach Quelle');
const t0 = Date.now();
for (const [stage, talents, level] of configs) {
  const res = new Array(runs);
  let next = 0;
  await Promise.all(pages.map(async p => {
    while (next < runs) { const k = next++; res[k] = await p.evaluate(botRun, { si: stage - 1, li: (level || 1) - 1, talents, seed: seed0 + k, step: 1 / hz, loadout }); }
  }));
  const wins = res.filter(r => r.win).length;
  const lv = [1, 2, 3, 4].map(m => { const a = res.map(r => r.lvAt[m]).filter(x => x !== undefined); return a.length ? avg(a).toFixed(1) : '–'; }).join('/');
  const srcs = [...new Set(res.flatMap(r => Object.keys(r.dmg)))];
  const d = srcs.map(k => [k, Math.round(avg(res.map(r => r.dmg[k] || 0)))]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => SRC[k] + ' ' + v).join(', ');
  const tal = Object.entries(talents).map(([k, v]) => k + '=' + v).join(',') || '–';
  const isExp = JSON.stringify(talents) === JSON.stringify(EXPECTED[stage]) && stage > 1;
  const tg = level ? LEVEL_TARGET[level - 1] : TARGET[stage] && TARGET[stage][isExp ? 'exp' : Object.keys(talents).length ? null : 'none'];
  const w = 100 * wins / runs, mark = !tg ? '' : w < tg[0] ? '↑' : w > tg[1] ? '↓' : '✓';
  const goal = tg ? `${tg[0]}–${tg[1]} % ${mark}` : '';
  console.log(`${(level ? stage + '-' + level : String(stage)).padEnd(6)} ${tal.padEnd(21)} ${pct(wins, runs)}  ${goal.padEnd(10)} ${String(Math.round(avg(res.map(r => r.t)))).padStart(4)} s  ${avg(res.map(r => r.abil)).toFixed(1).padStart(5)}×  ${lv.padEnd(20)}  ${d}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
await b.close();
