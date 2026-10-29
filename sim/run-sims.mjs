// Gespielt werden Level der Welten (6.1a); ganze 4-Minuten-Stages gibt es im Spiel nicht mehr.
// npm run sim                         → alle 5 Level jeder Welt mit den erwarteten Upgrades, mit Zielwerten
// npm run sim -- --stage 2            → nur Welt 2 (--levels ist gleichbedeutend mit dem Standard)
// npm run sim -- --stage 3 --level 5   → nur ein Level (5 = Boss-Level)
// npm run sim -- --mut glass,dark  → Mutatoren (Phase 12)
// npm run sim -- --rebirth 2  → Zyklus 2 der Wiedergeburt (ohne Seelenbaum)
// npm run sim -- --nm 5  → Albtraum-Stufe 5 (Phase 12)
// npm run sim -- --coop [--coophp 1.6] [--coopdmg 1]  → Koop: zwei Goblins, beide vom Bot (Phase 14b), Ausgleich zum Einstellen
// npm run sim -- --cls bow  → Goblin-Klasse (gob, bow, mage, war; Klassen-Level 1)
// npm run sim -- --loadout rage,trap  → andere Fähigkeiten (Standard rage,mech wie v2); --acct 40 für spät freie
// npm run sim -- --runes fire.3+bolt.3,might.2  → Runen je Slot (Komma), zwei Sockel mit + (Fähigkeiten auf Level 20)
// npm run sim -- --tree full                     → beide Fähigkeiten auf Level 30 mit vollem Baum (alle Knoten)
// npm run sim -- --stage 3 --runs 50 --talents atk=4,hp=4 [--seed 1] [--hz 60] [--par 3] [--html datei]
// npm run sim -- --endless [--time 1800] [--god]  → Endlose Nacht: Überlebenszeit und je Minute Kills, Gegner, Ø Leben
//                                                   (--god: Bot stirbt nicht, zeigt, ob die Gegner noch sterben)
import os from 'node:os';
import { chromium } from 'playwright';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { botRun } from './bot.js';
import { EXPECTED, LEVEL_TARGET } from './expected-progress.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const html = resolve(args.html || join(ROOT, 'dist', 'goblin-io.html'));
const runs = +args.runs || 20, seed0 = args.seed !== undefined ? +args.seed : 1, hz = +args.hz || 60;
const loadout = args.loadout ? String(args.loadout).split(',') : ['rage', 'mech'];
const tree = args.tree === 'full' ? { pow: 5, cd: 5, area: 3, s1: 3, a: 1, s2: 3, s3: 3, b: 1, m: 1 } : null;
const runes = args.runes ? String(args.runes).split(',').map(x => x ? x.split('+') : []) : null;
const parseTalents = s => Object.fromEntries(String(s || '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k, +v]; }));

const SRC = { contact: 'Kontakt', proj: 'Geschoss', boss: 'Boss', bomb: 'Bombe', strike: 'Blitz', zone: 'Pfütze', wall: 'Feuerwand', beam: 'Strahl', gas: 'Gas', rock: 'Fels', spikes: 'Stacheln', burn: 'Glutrand', meteor: 'Meteor', ice: 'Eis' };
if (args.v2) { console.log('--v2 gibt es nicht mehr: die ganzen Stages aus v2 sind jetzt Welten mit 5 Leveln.'); process.exit(1); }
if (args.endless) { args.stage = 9; args.level = 1; if (!args.talents) args.talents = 'atk=20,hp=20,spd=10,mag=6,stam=4'; }
const maxTime = +args.time || (args.endless ? 1800 : 330);
const LV = args.level ? [+args.level] : [1, 2, 3, 4, 5];
const configs = (args.stage ? [+args.stage] : [1, 2, 3, 4, 5, 6, 7, 8]).flatMap(s => LV.map(l => [s, args.talents && args.talents !== 'exp' ? parseTalents(args.talents) : EXPECTED[s] || {}, l]));

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
console.log(`${html}\n${runs} Läufe pro Konfiguration, Seeds ab ${seed0}, ${hz} Hz, Fähigkeiten ${loadout.join(' + ')}${runes ? ', Runen ' + args.runes : ''}${tree ? ', volle Bäume' : ''}${args.cls ? ', Klasse ' + args.cls : ''}${args.nm ? ', Albtraum ' + args.nm : ''}${args.rebirth ? ', Zyklus ' + args.rebirth : ''}${args.mut ? ', Mutatoren ' + args.mut : ''}${args.coop ? ', Koop zu zweit' : ''}\n`);
console.log('Level  Talente               Siege   Ziel       Ø Zeit  Boss    Fähigk.  Ø Lv@1/2/3/4 min      Ø Schaden nach Quelle');
const t0 = Date.now();
let lastRes = [];
// Endlose Nacht: wie lange hält der Bot durch, und stirbt noch etwas? (Wunsch Fabi 2026-10-16: Klumpen ab 14–20 min)
function endlessReport(res) {
  const ts = res.map(r => r.t).sort((a, b) => a - b), q = f => ts[Math.min(ts.length - 1, Math.floor(f * ts.length))];
  console.log(`\nÜberlebt: Median ${(q(.5) / 60).toFixed(1)} min, 25 % ${(q(.25) / 60).toFixed(1)}, 75 % ${(q(.75) / 60).toFixed(1)}, max ${(ts[ts.length - 1] / 60).toFixed(1)} min`);
  for (const r of res.filter(x => x.t >= 1200)) console.log(`  ${(r.t / 60).toFixed(1)} min: ${r.weapons} · Lv ${r.lv} · Schaden genommen ${Math.round(Object.values(r.dmg).reduce((x, y) => x + y, 0))}`);
  console.log('Minute  noch dabei  Kills/min  Gegner  Ø Leben  Spieler-Lv  Runde  Boss');
  const M = Math.max(...res.map(r => r.mins.length));
  for (let m = 0; m < M; m++) {
    const a = res.map(r => r.mins[m]).filter(Boolean);
    if (!a.length) break;
    console.log(`${String(m + 1).padStart(6)}  ${String(a.length).padStart(10)}  ${String(Math.round(avg(a.map(x => x.k)))).padStart(9)}  ${String(Math.round(avg(a.map(x => x.n)))).padStart(6)}  ${String(Math.round(avg(a.map(x => x.hp)))).padStart(7)}  ${avg(a.map(x => x.lv)).toFixed(0).padStart(10)}  ${avg(a.map(x => x.loop)).toFixed(1).padStart(5)}  ${pct(a.filter(x => x.boss).length, a.length)}`);
  }
}
for (const [stage, talents, level] of configs) {
  const res = new Array(runs);
  let next = 0;
  await Promise.all(pages.map(async p => {
    while (next < runs) { const k = next++; res[k] = await p.evaluate(botRun, { si: stage - 1, li: (level || 1) - 1, talents, seed: seed0 + k, step: 1 / hz, loadout, runes, tree, maxTime, god: !!args.god, acct: +args.acct || 20, cls: args.cls || 'gob', nm: +args.nm || 0, rebirth: +args.rebirth || 0, mut: args.mut ? String(args.mut).split(',') : [], coop: !!args.coop, coopHp: +args.coophp || 0, coopDmg: +args.coopdmg || 0 }); }
  }));
  lastRes = res;
  const wins = res.filter(r => r.win).length;
  const lv = [1, 2, 3, 4].map(m => { const a = res.map(r => r.lvAt[m]).filter(x => x !== undefined); return a.length ? avg(a).toFixed(1) : '–'; }).join('/');
  const srcs = [...new Set(res.flatMap(r => Object.keys(r.dmg)))];
  const d = srcs.map(k => [k, Math.round(avg(res.map(r => r.dmg[k] || 0)))]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => (k.startsWith('boss.') ? 'Boss/' + (SRC[k.slice(5)] || k.slice(5)) : SRC[k] || k) + ' ' + v).join(', ');
  const tal = Object.entries(talents).map(([k, v]) => k + '=' + v).join(',') || '–';
  // Zielwerte gelten nur mit den erwarteten Upgrades der Welt
  const tg = JSON.stringify(talents) === JSON.stringify(EXPECTED[stage] || {}) ? LEVEL_TARGET[level - 1] : null;
  const w = 100 * wins / runs, mark = !tg ? '' : w < tg[0] ? '↑' : w > tg[1] ? '↓' : '✓';
  const goal = tg ? `${tg[0]}–${tg[1]} % ${mark}` : '';
  // Bosskampf-Dauer der Siege (Ziel 45–75 s, PLAN 6.2)
  const bt = res.map(r => r.bossT).filter(x => x !== null && x !== undefined), bossCol = bt.length ? `${Math.round(avg(bt))} s` : '–';
  console.log(`${(stage + '-' + level).padEnd(6)} ${tal.padEnd(21)} ${pct(wins, runs)}  ${goal.padEnd(10)} ${String(Math.round(avg(res.map(r => r.t)))).padStart(4)} s  ${bossCol.padStart(5)}  ${avg(res.map(r => r.abil)).toFixed(1).padStart(5)}×  ${lv.padEnd(20)}  ${d}`);
}
if (args.endless) endlessReport(lastRes);
console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} s`);
await b.close();
