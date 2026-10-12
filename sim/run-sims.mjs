// npm run sim                         → Standard-Satz wie in v2 (6 Konfigurationen)
// npm run sim -- --stage 3 --runs 50 --talents atk=4,hp=4 [--seed 1] [--hz 60] [--html datei]
import { chromium } from 'playwright';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { botRun } from './bot.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const html = resolve(args.html || join(ROOT, 'dist', 'goblin-io.html'));
const runs = +args.runs || 20, seed0 = args.seed !== undefined ? +args.seed : 1, hz = +args.hz || 60;
const parseTalents = s => Object.fromEntries(String(s || '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k, +v]; }));

const SUITE = [[1, {}], [2, {}], [3, {}], [3, { atk: 4, hp: 4 }], [4, { atk: 6, hp: 6 }], [5, { atk: 8, hp: 8, spd: 3 }]];
const configs = args.stage ? [[+args.stage, parseTalents(args.talents)]] : SUITE;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.message));
await p.goto('file://' + html);
await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu');
await p.evaluate(() => GOBLIN.allLoaded);

const pct = (a, n) => (100 * a / n).toFixed(0).padStart(3) + ' %';
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log(`${html}\n${runs} Läufe pro Konfiguration, Seeds ab ${seed0}, ${hz} Hz\n`);
console.log('Stage  Talente               Siege   Ø Zeit  Ø Lv@1/2/3/4 min      Schaden: Kontakt/Geschoss/Boss/Bombe/Blitz/Pfütze');
const t0 = Date.now();
for (const [stage, talents] of configs) {
  const res = [];
  for (let k = 0; k < runs; k++) res.push(await p.evaluate(botRun, { si: stage - 1, talents, seed: seed0 + k, step: 1 / hz }));
  const wins = res.filter(r => r.win).length;
  const lv = [1, 2, 3, 4].map(m => { const a = res.map(r => r.lvAt[m]).filter(x => x !== undefined); return a.length ? avg(a).toFixed(1) : '–'; }).join('/');
  const d = ['contact', 'proj', 'boss', 'bomb', 'strike', 'zone'].map(k => Math.round(avg(res.map(r => r.dmg[k] || 0)))).join('/');
  const tal = Object.entries(talents).map(([k, v]) => k + '=' + v).join(',') || '–';
  console.log(`${String(stage).padEnd(6)} ${tal.padEnd(21)} ${pct(wins, runs)}  ${String(Math.round(avg(res.map(r => r.t)))).padStart(4)} s  ${lv.padEnd(20)}  ${d}`);
}
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
await b.close();
