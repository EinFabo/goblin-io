// Koop übers Netz, Ende zu Ende (Phase 14c/14e): zwei Browserseiten mit eigenem Spielstand spielen zusammen.
//   node tools/coop-e2e.mjs [--secs 45] [--lag 40] [--delay 4] [--stage 1] [--level 2] [--trace]
// Ohne Server: Node reicht die Nachrichten zwischen den Seiten weiter (je Richtung lag ± 50 % ms Verzögerung).
// Vorlauf delay in Ticks (16,7 ms): deckt er die Verzögerung nicht, wartet das Spiel (läuft langsamer, bleibt gleich).
// --trace: beide Seiten schreiben je Schritt den ganzen Zustand mit; ausgegeben wird der erste Unterschied.
// Prüft: keine abweichende Prüfsumme, beide Seiten kommen voran, Karten werden gewählt, beide sehen den Partner laufen,
// nach dem Verlassen spielt der andere allein weiter.
import { chromium } from 'playwright';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const html = resolve(args.html || join(ROOT, 'dist/goblin-io.html'));
const secs = +args.secs || 45, lag = +args.lag || 40, delay = +args.delay || 4;
const b = await chromium.launch();
const errs = [];
const pages = [];
for (const name of ['Anna', 'Bert']) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ': ' + String(e.stack || e)));
  await p.goto('file://' + html);
  await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu');
  // Bert hat einen anderen Spielstand (Talente, Wiedergeburt, Seelenbaum): beide Rechner müssen trotzdem gleich rechnen
  await p.evaluate(n => {
    // großer Sammelradius bei beiden, damit sicher Level-Ups mit Kartenwahl vorkommen
    const s = GOBLIN.save; s.profile.name = n; s.talents = { mag: 12 };
    if (n === 'Bert') { s.talents = { atk: 5, hp: 3, mag: 14 }; s.rebirth = { n: 1, souls: 0, spent: { w_hp: 2, w_dmg: 1, c_mag: 1 }, best: 0, hats: 0, levels: 0 }; }
  }, name);
  pages.push(p);
}
// Weiterleiten mit Verzögerung; die Seite puffert, bis der Gleichschritt zuhört
let sent = 0;
for (const [i, p] of pages.entries()) {
  const other = pages[1 - i];
  await p.exposeFunction('netOut', msg => { sent++; setTimeout(() => other.evaluate(m => window.__netIn(m), msg).catch(() => {}), lag * (.5 + Math.random())); });
}
const profs = await Promise.all(pages.map(p => p.evaluate(() => GOBLIN.profileOf())));
await Promise.all(pages.map((p, me) => p.evaluate(({ delay, trace, me, profs, si, li }) => {
  const q = []; let fn = null;
  window.__netIn = m => (fn ? fn(m) : q.push(m));
  const link = { send: m => window.netOut(m), onMessage: f => { fn = f; while (q.length) f(q.shift()); } };
  if (trace) globalThis.__coopTrace = [];
  GOBLIN.go('run', { si, li, seed: 4242, coop: { profs, me }, link, delay });
}, { delay, trace: !!args.trace, me, profs, si: (+args.stage || 1) - 1, li: (+args.level || 2) - 1 })));

// Beide laufen in Kreisen (andere Richtung), rollen ab und zu, wählen Karten
const keys = [['KeyD', 'KeyS', 'KeyA', 'KeyW'], ['KeyA', 'KeyW', 'KeyD', 'KeyS']];
let picks = 0;
const t0 = Date.now();
for (let s = 0; Date.now() - t0 < secs * 1000; s++) {
  for (const [i, p] of pages.entries()) {
    const k = keys[i][s % 4], prev = keys[i][(s + 3) % 4];
    await p.keyboard.up(prev); await p.keyboard.down(k);
    if (s % 3 === i) await p.keyboard.press('Space');
    if (await p.evaluate(() => !document.getElementById('levelup').hidden && !!GOBLIN.run.lvl)) { await p.keyboard.press('Digit1'); picks++; }
  }
  await pages[0].waitForTimeout(700);
}
const state = () => Promise.all(pages.map(p => p.evaluate(() => {
  const r = GOBLIN.run;
  return { tick: r.tick, time: Math.round(r.time), kills: r.kills, xp: Math.round(r.players[0].xp), over: r.over, note: r.netNote || null, lv: r.players[0].lv, me: r.me, gone: r.players.map(q => !!q.gone),
    pos: r.players.map(q => [Math.round(q.x), Math.round(q.y)]), wait: (document.getElementById('netWait') || {}).hidden === false };
})));
const mid = await state();
if (args.trace) {
  const tr = await Promise.all(pages.map(p => p.evaluate(() => globalThis.__coopTrace)));
  const n = Math.min(tr[0].length, tr[1].length);
  // erster Schritt, in dem sich irgendein Feld der Goblins unterscheidet (auch Felder außerhalb der Prüfsumme)
  const diff = (a, b) => a.p.flatMap((q, j) => Object.keys({ ...q, ...b.p[j] }).filter(k => JSON.stringify(q[k]) !== JSON.stringify(b.p[j][k])).map(k => `Goblin ${j}.${k}: ${JSON.stringify(q[k])} / ${JSON.stringify(b.p[j][k])}`));
  // Felder, die nur Optik sind (mit Math.random gestartet), zählen nicht
  const OPTIK = { items: ['t'], eproj: ['t'] };
  const strip = (k, arr) => arr.map(o => { const c = { ...o }; for (const f of OPTIK[k] || []) delete c[f]; return c; });
  const wdiff = (a, b) => Object.keys(a.w || {}).filter(k => JSON.stringify(strip(k, JSON.parse(a.w[k]))) !== JSON.stringify(strip(k, JSON.parse(b.w[k])))).map(k => {
    const x = strip(k, JSON.parse(a.w[k])), y = strip(k, JSON.parse(b.w[k]));
    if (x.length !== y.length) return `${k}: Anzahl ${x.length} / ${y.length}`;
    const j = x.findIndex((o, i) => JSON.stringify(o) !== JSON.stringify(y[i]));
    return `${k}[${j}]: ` + Object.keys({ ...x[j], ...y[j] }).filter(f => x[j][f] !== y[j][f]).map(f => `${f} ${x[j][f]} / ${y[j][f]}`).join(', ') + `\n  ganz: ${JSON.stringify(x[j])}\n        ${JSON.stringify(y[j])}`;
  });
  for (let i = 0; i < n; i++) { const d = [...diff(tr[0][i], tr[1][i]), ...wdiff(tr[0][i], tr[1][i])]; if (d.length || tr[0][i].h !== tr[1][i].h) { console.log('erster Unterschied bei Tick', tr[0][i].t, tr[0][i].h === tr[1][i].h ? '(Prüfsumme noch gleich)' : '(Prüfsumme anders)', '\n' + d.join('\n').slice(0, 3000)); break; } }
}
// Anna verlässt den Lauf (Pause → Aufgeben): Bert spielt allein weiter
await pages[0].evaluate(() => { document.getElementById('pauseBtn').click(); document.getElementById('quitBtn').click(); });
await pages[0].waitForTimeout(2500);
const after = await state();
console.log(JSON.stringify({ mid, after, picks, sent, errs: errs.slice(0, 3) }, null, 1));
await b.close();
const ok = !errs.length && mid.every(s => !s.note && s.tick > secs * 30) && Math.abs(mid[0].tick - mid[1].tick) < 120 && picks > 0
  && after[1].gone[0] && !after[1].over && after[1].tick > mid[1].tick + 60;
console.log(ok ? 'ok' : 'FEHLER');
process.exit(ok ? 0 : 1);
