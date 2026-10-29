// Koop-Prüfung (Phase 14): Determinismus und Ablauf ohne Netz, headless.
//   node tools/coop-check.mjs [--html datei] [--stage 4] [--level 5] [--secs 330]
// 1. Allein: zwei gleiche Läufe mit gleichen Eingaben → gleiche Prüfsummen (simHash); eine kleine Abweichung bei Tick 500 fällt auf.
// 2. Koop: zwei Goblins, einfache Eingaben, Level-Ups über pick, zum gestürzten Partner laufen; zweimal → gleiche Prüfsummen.
// Gibt die Prüfsummen der ersten Sekunden aus: vor/nach einem Umbau vergleichen (allein müssen sie gleich bleiben).
import { chromium } from 'playwright';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(a => { const [k, ...v] = a.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const html = resolve(args.html || join(ROOT, 'dist/goblin-io.html'));
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e.stack || e)));
await p.goto('file://' + html);
await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu');

const solo = await p.evaluate(() => {
  const G = window.GOBLIN;
  const play = tweak => {
    G.save.loadout = ['rage', 'mech']; for (const id of G.save.loadout) G.save.abilities[id] = { lv: 1, xp: 0, pts: {} };
    G.newRun(1, 77, 2); const run = G.run; run.noCont = true; const out = [];
    for (let t = 0; t < 3600 && !run.over; t++) {
      const inp = { mx: Math.sin(t / 50) + (t === 500 ? tweak : 0), my: Math.cos(t / 70), sprint: t % 180 < 60, dash: t % 90 === 0, ab0: t % 200 === 0, ab1: t % 333 === 0, skip: false, pick: -1 };
      G.update(1 / 60, [inp]);
      if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
      if (t % 60 === 59) out.push(G.simHash());
    }
    return out;
  };
  const a = play(0), c = play(.5);
  return { same: JSON.stringify(a) === JSON.stringify(play(0)), n: a.length, diffAt: c.findIndex((h, i) => h !== a[i]), first: a.slice(0, 3) };
});
console.log('Allein:', JSON.stringify(solo));

const coop = await p.evaluate(({ si, li, secs }) => {
  const G = window.GOBLIN;
  G.save.loadout = ['rage', 'mech']; for (const id of ['rage', 'mech', 'trap']) G.save.abilities[id] = { lv: 1, xp: 0, pts: {} };
  const a = G.profileOf(), b = G.profileOf(); b.loadout = ['trap', null]; b.equip = [true, false]; b.name = 'Zwei';
  const play = () => {
    G.newRun(si, 99, li, 0, { coop: { profs: [a, b], me: 0 } });
    const run = G.run, ps = run.players, out = [], st = { lv: 0, hurt: [0, 0], down: 0, revive: 0, maxD: 0 };
    for (let t = 0; t < secs * 60 && !run.over; t++) {
      const inps = ps.map((q, i) => {
        const o = ps[1 - i];
        if (o.down) { const dx = o.x - q.x, dy = o.y - q.y, dd = Math.hypot(dx, dy) || 1; return { mx: dd > 20 ? dx / dd : 0, my: dd > 20 ? dy / dd : 0, sprint: true, dash: false, ab0: false, ab1: false, skip: false, pick: run.lvl ? 0 : -1 }; }
        // weg von den nahen Gegnern, leicht im Kreis
        let ax = 0, ay = 0; for (const e of run.enemies) { const dx = q.x - e.x, dy = q.y - e.y, d2 = dx * dx + dy * dy; if (d2 < 250 * 250) { ax += dx / d2; ay += dy / d2; } }
        const l = Math.hypot(ax, ay) || 1, k = i ? 1 : -1;
        return { mx: ax / l + Math.cos(t / 90 + i) * .4, my: ay / l + Math.sin(t / 90 + i) * .4 * k, sprint: false, dash: t % 120 === i * 60, ab0: t % 300 === 10, ab1: false, skip: false, pick: run.lvl ? (t + i) % 3 : -1 };
      });
      const h0 = ps.map(q => q.hp), d0 = ps.map(q => q.down);
      G.update(1 / 60, inps);
      ps.forEach((q, i) => { if (q.hp < h0[i]) st.hurt[i]++; if (q.down && !d0[i]) st.down++; if (!q.down && d0[i]) st.revive++; });
      if (run.lvDelay > 0) { run.lvDelay = 0; G.startCoopLevel(run.lvKind); st.lv++; }
      st.maxD = Math.max(st.maxD, Math.round(Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)));
      if (t % 60 === 59) out.push(G.simHash());
    }
    return { out, st, time: Math.round(run.time), win: run.result ? run.result.win : null, lv: ps[0].lv, kills: run.kills };
  };
  const r1 = play(), r2 = play();
  return { same: JSON.stringify(r1.out) === JSON.stringify(r2.out), ...r1, out: r1.out.length };
}, { si: (+args.stage || 4) - 1, li: (+args.level || 5) - 1, secs: +args.secs || 330 });
console.log('Koop:', JSON.stringify(coop));
if (errs.length) console.log('Seitenfehler:', errs.slice(0, 3));
await b.close();
const ok = solo.same && solo.diffAt >= 0 && coop.same && !errs.length;
console.log(ok ? 'ok' : 'FEHLER');
process.exit(ok ? 0 : 1);
