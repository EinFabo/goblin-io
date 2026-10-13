// npm run perf – prüft das Performance-Budget (PLAN.md 12.3) im echten Browser, MIT Zeichnen:
// Ladezeit bis zum Hub, Bildrate mit 300 Gegnern, Speicher, Dateigröße.
// Zwei Geräte: „PC“ (1280×720, volle CPU) und „Handy“ (quer 915×412, DPR 2, CPU 4× gebremst wie
// das DevTools-Profil „Mid-tier mobile“). Headless zeichnet ohne GPU – Zeichnen ist hier eher teurer als echt.
//   npm run perf -- --world 8 --level 3 --enemies 300 --secs 10 --only handy
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'goblin-io.html');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const WORLD = +arg('world', 8) - 1, LEVEL = +arg('level', 3) - 1, N = +arg('enemies', 300), SECS = +arg('secs', 10), ONLY = arg('only', '');
const BUDGET = { fps: 55, load: 2000, mb: 4, mem: 250 };

const DEVICES = [
  { name: 'PC', viewport: { width: 1280, height: 720 }, dpr: 1, cpu: 1 },
  { name: 'Handy', viewport: { width: 915, height: 412 }, dpr: 2, cpu: 4, mobile: true },
].filter(d => !ONLY || d.name.toLowerCase() === ONLY.toLowerCase());

const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const f1 = x => x.toFixed(1);

// Speicher aller Chromium-Prozesse dieses Browsers (RSS, Linux): Obergrenze, zählt GPU- und Hilfsprozesse mit
function treeRssMB(pid) {
  try {
    const rows = execSync('ps -eo pid=,ppid=,rss=').toString().trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
    const kids = new Map(); for (const [p, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
    const rss = new Map(rows.map(r => [r[0], r[2]]));
    let sum = -(rss.get(pid) || 0); const st = [pid];
    while (st.length) { const p = st.pop(); sum += rss.get(p) || 0; st.push(...(kids.get(p) || [])); }
    return sum / 1024;
  } catch (_) { return NaN; }
}

const b = await chromium.launch({ args: (arg('args', '') || '').split(' ').filter(Boolean) });
const pid = process.pid;   // Chromium läuft als Kindprozess von Node
console.log('Hinweis: Headless rastert ohne GPU (SwiftShader). „Zeichnen“ und FPS sind daher viel schlechter als auf');
console.log('echten Geräten – dort mit goblin-io.html?perf und dem Knopf „Test 300 Gegner“ messen.');
const fails = [];
for (const dev of DEVICES) {
  const ctx = await b.newContext({ viewport: dev.viewport, deviceScaleFactor: dev.dpr, isMobile: !!dev.mobile, hasTouch: !!dev.mobile });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Performance.enable');
  if (dev.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: dev.cpu });

  // 1) Ladezeit bis Hub (neuer Spieler, leerer Spielstand)
  const t0 = Date.now();
  await p.goto('file://' + html);
  await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu', null, { timeout: 60000, polling: 10 });
  const load = Date.now() - t0;
  // Die ersten Sekunden im Hub (Magier der Welten laden im Hintergrund): ruckelt das Menü?
  const menu = await p.evaluate(secs => new Promise(res => {
    const gaps = []; let last = 0; const end = performance.now() + secs * 1000;
    const f = now => { if (last) gaps.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else res(gaps); };
    requestAnimationFrame(f);
  }), 4);

  // Speicher eines neuen Spielers (Welt 1 frei), nachdem das Hintergrund-Laden fertig ist
  await p.evaluate(() => GOBLIN.bgLoaded);
  const fresh = await p.evaluate(() => GOBLIN.canvasBytes() / 1048576);

  // 2) Lauf mit N Gegnern (src/stress.js): starker Spät-Build, unverwundbar, Gegner werden auf N aufgefüllt.
  // Vorher alle Welten laden: Speicher wie bei einem Spieler, der alles freigeschaltet hat
  await p.evaluate(() => GOBLIN.allLoaded);
  await p.evaluate(() => { GOBLIN.save.loadout = ['rage', 'mech']; });
  const res = await p.evaluate(([si, li, n, secs]) => GOBLIN.stress({ si, li, n, secs }), [WORLD, LEVEL, N, SECS]);
  const met = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const canvasMB = await p.evaluate(() => GOBLIN.canvasBytes() / 1048576);
  const rss = treeRssMB(pid);
  if (!res) { fails.push(`${dev.name}: Lauf endete vorzeitig`); await ctx.close(); continue; }

  const r = {
    ...res, dev: dev.name, load, menuFps: 1000 / avg(menu), menuMax: Math.max(...menu), menuHitch: menu.filter(g => g > 50).length,
    heap: met.JSHeapUsedSize / 1048576, canvasMB, fresh, rss,
  };
  console.log(`\n== ${dev.name} (${dev.viewport.width}×${dev.viewport.height}, DPR ${dev.dpr}, CPU ×${dev.cpu}) ==`);
  console.log(`Ladezeit bis Hub      ${r.load} ms ${r.load < BUDGET.load ? '✓' : '✗'} (Ziel < ${BUDGET.load})`);
  console.log(`Hub, erste 4 s        ${f1(r.menuFps)} FPS, längster Frame ${f1(r.menuMax)} ms, ${r.menuHitch} Ruckler > 50 ms`);
  console.log(`Lauf, Welt ${WORLD + 1}-${LEVEL + 1}     Ø ${Math.round(r.enemies)} Gegner, ${f1(r.fps)} FPS ${r.fps >= BUDGET.fps ? '✓' : '✗'} (Ziel ≥ ${BUDGET.fps})`);
  console.log(`  Frame               p50 ${f1(r.p50)} / p95 ${f1(r.p95)} / p99 ${f1(r.p99)} ms, ${f1(r.slow * 100)} % über 25 ms`);
  console.log(`  je Frame            Logik Ø ${f1(r.upd)} ms (${f1(r.updStep)} je 60-Hz-Schritt, max ${f1(r.updMax)}), Zeichnen Ø ${f1(r.ren)} ms (max ${f1(r.renMax)})`);
  console.log(`Speicher              JS ${f1(r.heap)} MB + Bilder ${f1(r.canvasMB)} MB = ${f1(r.heap + r.canvasMB)} MB ${r.heap + r.canvasMB < BUDGET.mem ? '✓' : '✗'} (Ziel < ${BUDGET.mem}, alle Welten geladen)`);
  console.log(`                      neuer Spieler: Bilder ${f1(r.fresh)} MB; alle Chromium-Prozesse ${f1(r.rss)} MB`);
  if (errs.length) fails.push(...errs.map(e => `${dev.name}: ${e}`));
  await ctx.close();
}
await b.close();
const mb = statSync(html).size / 1048576;
console.log(`\nGröße goblin-io.html  ${mb.toFixed(2)} MB ${mb < BUDGET.mb ? '✓' : '✗'} (Ziel < ${BUDGET.mb})`);
if (fails.length) { console.log('\nFEHLER:\n' + fails.join('\n')); process.exit(1); }
