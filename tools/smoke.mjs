// npm run smoke – spielt jede Stage im echten Browser bis in den Bosskampf, MIT Zeichnen,
// und meldet jeden JavaScript-Fehler. Die Simulation zeichnet nicht und findet Render-Fehler deshalb nicht.
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'goblin-io.html');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + html);
await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu');
await p.evaluate(() => GOBLIN.allLoaded);
const stages = await p.evaluate(() => GOBLIN.STAGES.length);
// Je Welt das Boss-Level (Boss nach 1:30), Endlos wie bisher bis zum Boss bei 4:00
for (let si = 0; si < stages; si++) {
  const endless = await p.evaluate(si => !!GOBLIN.STAGES[si].endless, si);
  await p.evaluate(([si, li]) => { const G = GOBLIN; G.save.profile.level = 20; G.save.loadout = ['rage', 'mech']; G.go('run', { si, li, seed: 11 + si }); }, [si, endless ? 0 : 4]);
  for (const until of endless ? [30, 60, 90, 120, 150, 200, 239, 241, 250, 262] : [30, 60, 89, 91, 100, 115, 130]) {
    await p.evaluate(until => {
      const G = GOBLIN, run = G.run;
      if (!run || run.over) return;
      run.paused = true;
      while (run.time < until && !run.over) {
        G.P.inv = 9; G.update(1 / 60);
        if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
        for (let k = 0; k < 2; k++) if (G.abilReady(run.abil[k])) G.useAbility(k);
      }
      run.paused = false;
    }, until);
    await p.waitForTimeout(120);   // ein paar echte Bilder zeichnen lassen
  }
  const st = await p.evaluate(() => ({ t: Math.round(GOBLIN.run.time), boss: !!GOBLIN.run.boss || GOBLIN.run.over }));
  console.log(`${endless ? 'Endlos' : `Welt ${si + 1} Boss-Level`}: bis ${st.t} s, Boss erreicht: ${st.boss ? 'ja' : 'nein'}`);
}
// In der Goblin-Maschine: andere Fähigkeit und Rolle gesperrt, Knöpfe mit Schloss
await p.evaluate(() => { const G = GOBLIN; G.save.loadout = ['rage', 'mech']; G.go('run', { si: 0, li: 0, seed: 7 }); });
const lock = await p.evaluate(async () => {
  const G = GOBLIN, run = G.run;
  run.abil[0].ch = run.abil[0].need; run.abil[1].ch = run.abil[1].need;
  const mech = G.useAbility(1), rage = G.useAbility(0); G.doDash();
  await new Promise(r => setTimeout(r, 150));
  const cls = s => document.querySelector(s).classList.contains('locked');
  return { mech, rage, dash: G.P.dashT > 0, q: cls('#ab0Btn'), roll: cls('#dashBtn'), sprint: cls('#sprintBtn'), e: cls('#ab1Btn') };
});
if (!lock.mech || lock.rage || lock.dash || !lock.q || !lock.roll || !lock.sprint || lock.e) errs.push('Maschinen-Sperre: ' + JSON.stringify(lock));
console.log('Maschinen-Sperre:', JSON.stringify(lock));
if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
// Normales Level: nach 2:30 „Level geschafft“, Ergebnis mit Hüten, Weiter → nächstes Level
await p.evaluate(() => { const G = GOBLIN; G.go('run', { si: 0, li: 1, seed: 3 }); const run = G.run; run.paused = true;
  while (run.time < 160 && !run.over) { G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); } }
  run.paused = false; });
await p.waitForSelector('#over:not([hidden])');
const lvRes = await p.evaluate(() => ({ win: GOBLIN.run.result.win, hats: document.querySelectorAll('#overHats .hats i.on').length, next: document.querySelector('#nextBtn').textContent }));
if (!lvRes.win || lvRes.hats < 1 || lvRes.next !== 'Weiter: 1-3') errs.push('Level-Ende: ' + JSON.stringify(lvRes));
console.log('Level 1-2 geschafft:', JSON.stringify(lvRes));
// Tod im echten Spiel (nicht per Hand gesteppt): Sterbe-Animation, Nochmal, Menü
async function dieForReal() {
  for (let i = 0; i < 80 && !(await p.evaluate(() => GOBLIN.run.over)); i++) {
    await p.evaluate(() => {
      const G = GOBLIN;
      if (G.run.paused && !G.run.over) { const c = document.querySelector('#levelup .card'); if (c) c.click(); }
      G.P.hp = Math.min(G.P.hp, 1);
      if (G.run.enemies.length < 10) G.spawnEnemy('fire_mage', { x: G.P.x + 40, y: G.P.y });
    });
    await p.waitForTimeout(250);
  }
  await p.waitForSelector('#over:not([hidden])');
}
const fail = m => { console.log('Tod: ' + m); errs.push(m); };
await p.evaluate(() => GOBLIN.go('run', { si: 0, seed: 5 }));
await dieForReal();
if (!(await p.evaluate(() => GOBLIN.P.endAnim > .3))) fail('Sterbe-Animation läuft nicht (Spiel eingefroren)');
await p.click('#againBtn');
await p.waitForTimeout(800);
if (!(await p.evaluate(() => GOBLIN.scene === 'run' && GOBLIN.run.time > .3))) fail('nach „Nochmal“ läuft das Spiel nicht');
await dieForReal();
await p.click('#menuBtn');
await p.waitForTimeout(300);
if (!(await p.evaluate(() => GOBLIN.scene === 'menu' && !GOBLIN.run))) fail('nach „Menü“ hängt der Lauf noch im Hintergrund');
console.log('Tod, Nochmal, Menü: geprüft');

// Hub: Tabs, Karussell, Name ändern, Einstellungen, Start über den Spielen-Knopf
const hubFail = m => { console.log('Hub: ' + m); errs.push(m); };
const vis = sel => p.evaluate(sel => !document.querySelector(sel).hidden, sel);
for (const t of ['#shop', '#armory', '#profile', '#menu']) {
  await p.click(`#tabbar [data-tab="${t}"]`);
  if (!(await vis(t))) hubFail(`Tab ${t} öffnet nicht`);
}
await p.evaluate(() => GOBLIN.setSave({ ...GOBLIN.save, stages: { 1: { cleared: true } }, map: { si: 1, li: 0, fresh: false } }));
await p.click('#tabbar [data-tab="#profile"]'); await p.click('#tabbar [data-tab="#menu"]');
if ((await p.evaluate(() => document.querySelector('#wName').textContent)) !== 'Frostlichtung') hubFail('Karte zeigt nicht Welt 2');
await p.click('#wPrev');
await p.click('#mapNodes [data-node="2"]');
await p.waitForFunction(() => !document.querySelector('#lvNote').hidden, null, { timeout: 8000 }).catch(() => {});
if (!(await vis('#lvNote')) || (await p.evaluate(() => document.querySelector('#lvNote .nh .lbl').textContent)) !== '1-3') hubFail('Goblin läuft nicht zu Level 1-3 / Zettel fehlt');
await p.click('#wNext');
await p.click('#mapNodes [data-node="1"]'); await p.waitForTimeout(300);
if (!(await p.evaluate(() => !!document.querySelector('#lvNote .lock')))) hubFail('gesperrtes Level 2-2 zeigt keinen Hinweis');
await p.keyboard.press('ArrowLeft');
await p.waitForFunction(() => document.querySelector('#lvNote [data-go]'), null, { timeout: 8000 }).catch(() => {});
await p.click('#topWho');
await p.click('#nameEdit'); await p.fill('#nameIn', 'Gr'); await p.press('#nameIn', 'Enter');
if ((await p.evaluate(() => GOBLIN.save.profile.name)) === 'Gr') hubFail('zu kurzer Name wurde angenommen');
await p.fill('#nameIn', 'Grubnik'); await p.press('#nameIn', 'Enter');
if ((await p.evaluate(() => GOBLIN.save.profile.name + '|' + document.querySelector('#topName').textContent)) !== 'Grubnik|Grubnik') hubFail('Name wird nicht übernommen');
await p.click('#optBtn'); await p.click('#howBtn');
if (!(await vis('#howto')) || (await vis('#options'))) hubFail('„So spielst du“ öffnet nicht aus den Einstellungen');
await p.keyboard.press('Escape');
if (await vis('#howto')) hubFail('Esc schließt „So spielst du“ nicht');
await p.click('#tabbar [data-tab="#menu"]');
await p.click('#lvNote [data-go]');
await p.waitForTimeout(800);
if (!(await p.evaluate(() => GOBLIN.scene === 'run' && GOBLIN.run.si === 1 && GOBLIN.run.li === 0))) hubFail('„Los!“ startet nicht Level 2-1');
if (await vis('#tabbar')) hubFail('Tab-Leiste bleibt im Lauf sichtbar');
console.log('Hub (Tabs, Weltkarte, Name, Einstellungen, Start): geprüft');
await b.close();
if (errs.length) { console.log('\nFEHLER:\n' + [...new Set(errs)].join('\n')); process.exit(1); }
console.log('\nkeine Fehler');
