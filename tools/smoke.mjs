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
for (let si = 0; si < stages; si++) {
  // Alle Fähigkeiten nacheinander durchwechseln, damit auch ihre Effekte gezeichnet werden
  await p.evaluate(si => { const G = GOBLIN; G.save.profile.level = 20; G.save.loadout = ['rage', 'mech']; G.go('run', { si, seed: 11 + si }); }, si);
  for (const until of [30, 60, 90, 120, 150, 200, 239, 241, 250, 262]) {
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
  console.log(`Stage ${si + 1}: bis ${st.t} s, Boss erreicht: ${st.boss ? 'ja' : 'nein'}`);
}
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
await b.close();
if (errs.length) { console.log('\nFEHLER:\n' + [...new Set(errs)].join('\n')); process.exit(1); }
console.log('\nkeine Fehler');
