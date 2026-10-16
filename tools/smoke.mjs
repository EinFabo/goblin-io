// npm run smoke – spielt jede Stage im echten Browser bis in den Bosskampf, MIT Zeichnen,
// und meldet jeden JavaScript-Fehler. Die Simulation zeichnet nicht und findet Render-Fehler deshalb nicht.
import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const html = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'goblin-io.html');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [];
// Fehler aus Googles Anmelde-Knopf (iframe von accounts.google.com) sind nicht unsere
p.on('pageerror', e => { if (!/accounts\.google\.com/.test(e.stack || '')) errs.push(e.message); });
await p.goto('file://' + html);
await p.waitForFunction(() => window.GOBLIN && window.GOBLIN.scene === 'menu');
await p.evaluate(() => GOBLIN.allLoaded);
const stages = await p.evaluate(() => GOBLIN.STAGES.length);
// Je Welt das Boss-Level (Boss nach 1:30), Endlos wie bisher bis zum Boss bei 4:00
for (let si = 0; si < stages; si++) {
  const endless = await p.evaluate(si => !!GOBLIN.STAGES[si].endless, si);
  await p.evaluate(([si, li]) => { const G = GOBLIN; G.save.profile.level = 20; G.save.loadout = ['rage', 'mech']; G.go('run', { si, li, seed: 11 + si }); }, [si, endless ? 0 : 4]);
  for (const until of endless ? [30, 60, 90, 120, 150, 200, 239, 241, 250, 262] : [30, 60, 89, 91]) {
    await p.evaluate(until => {
      const G = GOBLIN, run = G.run;
      if (!run || run.over) return;
      run.paused = true;
      while (run.time < until && !run.over) {
        G.P.inv = 9; G.update(1 / 60);
        if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
        // Pause nur für die Echtzeit-Schleife; Fähigkeiten greifen nicht, solange pausiert ist
        run.paused = false; for (let k = 0; k < 2; k++) if (G.abilReady(run.abil[k])) G.useAbility(k); run.paused = true;
      }
      run.paused = false;
    }, until);
    await p.waitForTimeout(120);   // ein paar echte Bilder zeichnen lassen
  }
  const st = await p.evaluate(() => ({ t: Math.round(GOBLIN.run.time), boss: !!GOBLIN.run.boss || GOBLIN.run.over, kills: GOBLIN.run.kills, bossHp: GOBLIN.run.boss ? GOBLIN.run.boss.hp : 0 }));
  if (!st.kills || !Number.isFinite(st.bossHp)) errs.push(`${endless ? 'Endlos' : 'Welt ' + (si + 1)}: Kills ${st.kills}, Boss-Leben ${st.bossHp}`);
  console.log(`${endless ? 'Endlos' : `Welt ${si + 1} Boss-Level`}: bis ${st.t} s, Boss erreicht: ${st.boss ? 'ja' : 'nein'}`);
  if (!endless) await fightBoss(si);
}
// Angriffsliste der Boss-Daten (geprüft in test/bosses.test.js) muss genau zu game/boss.js ATK passen
const atk = await p.evaluate(() => ({ list: [...GOBLIN.ATTACKS].sort().join(), impl: Object.keys(GOBLIN.ATK).sort().join() }));
if (atk.list !== atk.impl) errs.push(`ATTACKS (data/bosses.js) ≠ ATK (game/boss.js): ${atk.list} / ${atk.impl}`);
// Bosskampf mit Zeichnen: Auftritt mit Namensschild, alle 3 Phasen (Schaden per Hand, Waffen fast wirkungslos,
// damit jede Phase ein paar Angriffe lang dauert), Eisschild von hinten brechen, Sieg
async function fightBoss(si) {
  await p.evaluate(() => { const G = GOBLIN; window.__boss = { ph: [0], mech: new Set(), shield: false, rage: false, off: G.events.on('bossPhase', b => window.__boss.ph.push(b.ph)) }; });
  for (let k = 0; k < 40; k++) {
    const r = await p.evaluate(() => {
      const G = GOBLIN, run = G.run, S = window.__boss;
      if (!run || run.over) return { done: true };
      run.paused = true;
      for (let n = 0; n < 60 * 4 && !run.over; n++) {
        G.P.inv = 9; G.P.dmgMult = .001; G.update(1 / 60);
        if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
        for (const h of run.haz) if (h.src) S.mech.add(h.src);
        if (run.arena && run.arena.burn > 0) S.mech.add('burn');
        if (run.storm > 0) S.mech.add('storm');
        if (run.boss && run.boss.ai.spin) S.mech.add('spiral');
        if (run.enemies.some(e => e.link && !e.dead)) S.mech.add('split');
        if (run.enemies.some(e => e.type === 'ghost' && !e.dead)) S.mech.add('ghosts');
        if (run.enemies.some(e => e.decoy && !e.dead)) S.mech.add('clones');
        if (run.enemies.some(e => e.shade && !e.dead)) S.mech.add('shades');
        if (run.portals.length) S.mech.add('portals');
        if (run.pillars.length) S.mech.add('pillars');
        if (run.wind) S.mech.add('wind');
        const bb = run.boss;
        if (bb && bb.armor > 0) S.mech.add('armor');
        if (bb && bb.B.mount && !bb.mount) S.mech.add('foot');
        if (bb && bb.school) S.mech.add('school.' + bb.school);
        // nach dem Auftritt nie mehr „im Boden“ (Knochenhand verschwand, weil sich zwei Dinge rise teilten)
        if (bb && !run.cut && bb.rise !== null && bb.rise !== undefined) S.mech.add('BUG:rise');
      }
      const b = run.boss;
      // Wut-Timer: kurz vor 120 s Kampf vorspulen, dann muss die Leiste glühen
      if (b && !b.rage && b.ph === 1 && !run.cut) b.fightT = 119.9;
      if (b && b.rage && document.querySelector('#bossBar').classList.contains('rage')) S.rage = true;
      if (b && !run.cut) {
        const ves = (b.vessels || []).filter(v => !v.dead);
        if (ves.length) { for (const v of ves) G.hurt(v, v.hp + 1); S.mech.add('vessels'); }
        else if (b.ice > 0) {
          // hinter ihn stellen: drei Treffer in den Rücken brechen den Schild
          G.P.x = b.x - Math.cos(b.fa) * 120; G.P.y = b.y - Math.sin(b.fa) * 120;
          for (let i = 0; i < 3; i++) { b.iceCd = 0; G.hurt(b, 1); }
          if (b.ice === 0 && b.stunT > 0) S.shield = true;
        } else G.hurt(b, b.maxHp * .07);
      }
      run.paused = false;
      return { over: run.over };
    });
    await p.waitForTimeout(80);
    if (r.done || r.over) break;
  }
  const seen = await p.evaluate(() => ({ ...window.__boss, off: window.__boss.off(), mech: [...window.__boss.mech], card: document.querySelector('#bossCardName').textContent + ' ' + document.querySelector('#bossCardTitle').textContent }));
  const end = await p.evaluate(() => ({ over: GOBLIN.run.over, boss: !!GOBLIN.run.boss }));
  const id = await p.evaluate(si => GOBLIN.STAGES[si].boss.id, si);
  seen.mech = new Set(seen.mech);
  console.log(`  Boss ${id}: „${seen.card}“, Phasen ${seen.ph.map(x => x + 1).join('/')}, Eisschild gebrochen: ${seen.shield ? 'ja' : '–'}, Mechaniken ${[...seen.mech].join(',')}, besiegt: ${end.over && !end.boss ? 'ja' : 'nein'}`);
  if (!seen.rage) errs.push(`Wut-Timer Welt ${si + 1}: nicht ausgelöst`);
  if (seen.card.trim().length < 3 || seen.ph.length < 3 || !(end.over && !end.boss)) errs.push(`Bosskampf Welt ${si + 1}: ` + JSON.stringify({ ...seen, mech: [...seen.mech], end }));
  if (id === 'frostbart' && !seen.shield) errs.push('Frostbart: Eisschild nicht gebrochen');
  const MECH = { ignaz: ['wall', 'meteor', 'burn'], frostbart: ['ice', 'storm', 'spiral'], morgra: ['zone', 'gas', 'split', 'burn'], knochenhand: ['cage', 'vessels', 'beam'],
    spiegelmeister: ['clones', 'portals'], tempestra: ['strike', 'pillars', 'beam', 'wind'], gromm: ['quake', 'rock', 'armor', 'foot', 'spikes'], malvorn: ['school.fire', 'school.frost', 'shades', 'meteor'] };
  if (seen.mech.has('BUG:rise')) errs.push(`${id}: Boss nach dem Auftritt noch „im Boden“ (rise)`);
  if (MECH[id] && !MECH[id].every(m => seen.mech.has(m))) errs.push(`${id}: Mechaniken fehlen (${MECH[id].filter(m => !seen.mech.has(m))}), gesehen ${[...seen.mech]}`);
}
// Mini-Boss (Level 4 jeder Welt, bei 1:40): 2 Elite-Eigenschaften, eigene Leiste oben
await p.evaluate(() => { const G = GOBLIN; G.go('run', { si: 1, li: 3, seed: 4 }); const run = G.run; run.paused = true; while (run.time < 101 && !run.over) { G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); } } run.paused = false; });
await p.waitForTimeout(200);
const mini = await p.evaluate(() => ({ aff: GOBLIN.run.mini && GOBLIN.run.mini.affixes.length, bar: !document.querySelector('#miniBar').hidden, name: document.querySelector('#miniName').textContent }));
if (mini.aff !== 2 || !mini.bar) errs.push('Mini-Boss: ' + JSON.stringify(mini));
console.log('Mini-Boss:', JSON.stringify(mini));
// Albtraum: Gegner mit +80 % Leben, Elites mit 2 Eigenschaften, Ergebnis-Titel
const nm = await p.evaluate(async () => {
  const G = GOBLIN, hp = nm => { G.newRun(0, 9, 0, nm); G.run.paused = true; while (!G.run.enemies.length) G.update(1 / 60); return G.run.enemies[0].maxHp; };
  const ratio = hp(true) / hp(false);
  G.go('run', { si: 0, li: 1, seed: 3, nm: true }); const run = G.run; run.paused = true;
  while (run.time < 160 && !run.over) { G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); } }
  run.paused = false; await new Promise(r => setTimeout(r, 400));
  return { ratio: +ratio.toFixed(2), nm: run.nm, title: document.querySelector('#overTitle').textContent, stage: document.querySelector('#stageTxt').textContent };
});
if (nm.ratio !== 1.8 || !nm.nm || nm.title !== 'Albtraum überstanden!') errs.push('Albtraum: ' + JSON.stringify(nm));
console.log('Albtraum:', JSON.stringify(nm));
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
  while (run.time < 160 && !run.over) {
    G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
    // kurz vor dem Ende große Kristalle weit weg ablegen: kommen erst nach „Level geschafft“ an → Bonus-Level
    if (Math.abs(run.time - 149) < .01) for (let i = 0; i < 6; i++) run.items.push({ k: 'gem', x: G.P.x + 500, y: G.P.y, v: 400, mag: false, sp: 0, t: 0, vx: 0, vy: 0, z: 0, vz: 0 });
  }
  run.paused = false; });
await p.waitForSelector('#over:not([hidden])');
const lvRes = await p.evaluate(() => ({ win: GOBLIN.run.result.win, hats: document.querySelectorAll('#overHats .hats i.on').length, next: document.querySelector('#nextBtn').textContent,
  cards: !document.querySelector('#levelup').hidden, bonus: GOBLIN.run.result.bonusLv, row: document.querySelector('#overStats').textContent.includes('Bonus-Level') }));
if (!lvRes.win || lvRes.hats < 1 || lvRes.next !== 'Weiter: 1-3' || lvRes.cards) errs.push('Level-Ende: ' + JSON.stringify(lvRes));
if (lvRes.bonus > 0 && !lvRes.row) errs.push('Bonus-Level fehlt im Ergebnis: ' + JSON.stringify(lvRes));
// Tippen überspringt die Hüte-Folge: Zeilen sofort da, alle Hüte gelandet
await p.waitForTimeout(100);
await p.mouse.click(640, 200);
const skip = await p.evaluate(() => ({ rows: document.querySelector('#overStats').classList.contains('show'), wait: document.querySelectorAll('#overHats .hats i.wait').length }));
if (!skip.rows || skip.wait) errs.push('Hüte-Folge überspringen: ' + JSON.stringify(skip));
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
await p.waitForFunction(() => !document.querySelector('#lvNote').hidden && document.querySelector('#lvNote [data-go]'), null, { timeout: 3000 }).catch(() => hubFail('Zettel fehlt nach Zurück vom gesperrten Level'));
await p.click('#topWho');
await p.click('#nameEdit'); await p.fill('#nameIn', 'Gr'); await p.press('#nameIn', 'Enter');
if ((await p.evaluate(() => GOBLIN.save.profile.name)) === 'Gr') hubFail('zu kurzer Name wurde angenommen');
await p.fill('#nameIn', 'Grubnik'); await p.press('#nameIn', 'Enter');
if ((await p.evaluate(() => GOBLIN.save.profile.name + '|' + document.querySelector('#topName').textContent)) !== 'Grubnik|Grubnik') hubFail('Name wird nicht übernommen');
await p.click('#optBtn'); await p.click('#howBtn');
if (!(await vis('#howto')) || (await vis('#options'))) hubFail('„So spielst du“ öffnet nicht aus den Einstellungen');
await p.keyboard.press('Escape');
if (await vis('#howto')) hubFail('Esc schließt „So spielst du“ nicht');
// Einstellungen: Schalter, Knopfgröße, Lautstärke-Regler; werden gespeichert und sofort angewendet
await p.click('#optBtn');
// PC (Maus): Handy-Knöpfe-Einstellungen versteckt, Vollbild-Schalter da. Ein echtes Tippen holt die Handy-Steuerung zurück
const pcm = await p.evaluate(() => ({ pc: document.body.classList.contains('pc'), lefty: !!document.querySelector('#leftySw').offsetParent, full: !!document.querySelector('#fullSw').offsetParent }));
if (!pcm.pc || pcm.lefty || !pcm.full) hubFail('PC-Modus: ' + JSON.stringify(pcm));
await p.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' })));
if (await p.evaluate(() => document.body.classList.contains('pc'))) hubFail('Tippen schaltet den PC-Modus nicht ab');
await p.click('#leftySw'); await p.click('#numSw'); await p.click('#btnSeg [data-bs="l"]');
{ const r = await p.locator('#musVol').boundingBox(); await p.mouse.click(r.x + r.width * .5, r.y + r.height / 2); }
const opt = await p.evaluate(() => ({ s: GOBLIN.save.settings, lefty: document.body.classList.contains('lefty'), bs: getComputedStyle(document.documentElement).getPropertyValue('--bs').trim(), sw: document.querySelector('#leftySw').getAttribute('aria-checked') }));
if (!opt.s.lefty || opt.s.numbers || opt.s.btn !== 'l' || Math.abs(opt.s.musVol - .5) > .06 || !opt.lefty || opt.bs !== '1.2' || opt.sw !== 'true') hubFail('Einstellungen greifen nicht: ' + JSON.stringify(opt));
await p.click('#leftySw'); await p.click('#numSw'); await p.click('#btnSeg [data-bs="m"]');
await p.keyboard.press('Escape');
if (await vis('#options')) hubFail('Esc schließt die Einstellungen nicht');
await p.click('#tabbar [data-tab="#menu"]');
await p.click('#lvNote [data-go]');
await p.waitForTimeout(800);
if (!(await p.evaluate(() => GOBLIN.scene === 'run' && GOBLIN.run.si === 1 && GOBLIN.run.li === 0))) hubFail('„Los!“ startet nicht Level 2-1');
if (await vis('#tabbar')) hubFail('Tab-Leiste bleibt im Lauf sichtbar');
// Einstellungen aus der Pause: Esc schließt nur das Fenster, die Pause bleibt
await p.click('#pauseBtn'); await p.click('#pOptBtn');
if (!(await vis('#options'))) hubFail('Einstellungen öffnen nicht aus der Pause');
await p.keyboard.press('Escape');
if ((await vis('#options')) || !(await vis('#pause'))) hubFail('Esc in den Einstellungen schließt nicht nur das Fenster');
await p.click('#resumeBtn');
console.log('Hub (Tabs, Weltkarte, Name, Einstellungen, Start): geprüft');
// Skill Tree: Tippen lernt nichts, Halten lernt einen Rang, Rolle mit zwei Ladungen im Lauf
await p.evaluate(() => { const G = GOBLIN; G.save.abilities.rage = { lv: 6, xp: 0, pts: {} }; G.save.abilities.dash = { lv: 6, xp: 0, pts: {} }; G.go('menu', '#armory'); });
await p.waitForTimeout(300);
await p.click('#armShelf [data-pick="rage"]'); await p.click('#armNote [data-tree]');
await p.waitForSelector('#tree:not([hidden])');
const pow = p.locator('#treeNodes [data-node="pow"]');
await pow.click();
const tap = await p.evaluate(() => GOBLIN.save.abilities.rage.pts.pow || 0);
await pow.hover(); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up();
const held = await p.evaluate(() => GOBLIN.save.abilities.rage.pts.pow || 0);
// anderer Knoten: erstes Drücken und Halten wählt nur aus, erst das zweite lernt
const cd = p.locator('#treeNodes [data-node="cd"]');
await cd.hover(); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up();
const first = await p.evaluate(() => ({ n: GOBLIN.save.abilities.rage.pts.cd || 0, sel: document.querySelector('#treeNodes [data-node="cd"]').classList.contains('sel') }));
await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up();
const second = await p.evaluate(() => GOBLIN.save.abilities.rage.pts.cd || 0);
await p.click('#treeClose');
if (tap !== 0 || held !== 1) errs.push(`Skill Tree: Tippen ${tap} (soll 0), Halten ${held} (soll 1)`);
if (first.n !== 0 || !first.sel || second !== 1) errs.push(`Skill Tree: anderer Knoten erst auswählen, dann lernen: ${JSON.stringify({ first, second })}`);
await p.evaluate(() => { const G = GOBLIN; G.save.abilities.dash.pts = { pow: 3, a: 1 }; G.go('run', { si: 0, seed: 9 }); });
await p.waitForTimeout(300);
const roll = await p.evaluate(async () => { const G = GOBLIN; G.doDash(); await new Promise(r => setTimeout(r, 250)); G.doDash(); return { max: G.P.dashMax, n: G.P.dashN, xp: G.run.abXp.dash }; });
if (roll.max !== 2 || roll.n !== 0 || roll.xp !== 6) errs.push('Rolle mit zwei Ladungen: ' + JSON.stringify(roll));
console.log('Skill Tree (Tippen/Halten) und Rolle mit Ladungen:', JSON.stringify({ tap, held, roll }));
// Alle Bäume voll ausgebaut: jede Fähigkeit 40 s lang einsetzen, dazu rollen und sprinten (mit Zeichnen)
const full = { pow: 5, cd: 5, area: 3, s1: 3, a: 1, s2: 3, s3: 3, b: 1, m: 1 };
const ids = ['rage', 'trap', 'mech', 'charm', 'smoke', 'catapult', 'hook', 'shroom', 'shield', 'rats', 'call', 'totem', 'timebomb', 'bigbang',
  'oilcask', 'turret', 'burrow', 'cannon', 'decoy', 'spin', 'grudge', 'scrapmag', 'bees', 'brew'];   // Maschine mit Amulett: sie sperrt die andere Fähigkeit; Öl mit Flammenturm (zündet)
const used = {};
for (let i = 0; i < ids.length; i += 2) {
  await p.evaluate(([a, b, full]) => {
    const G = GOBLIN; G.save.profile.level = 50; G.save.loadout = [a, b];
    for (const id of [a, b, 'dash', 'sprint']) G.save.abilities[id] = { lv: 30, xp: 0, pts: { ...full } };
    for (let s = 1; s <= 8; s++) G.save.stages[s] = { cleared: true, stars: 0, best: 0, nightmare: false, lv: Array.from({ length: 5 }, () => ({ hats: 1, kills: 0, fast: 0 })) };
    G.go('run', { si: 2, li: 3, seed: 21 });
  }, [ids[i], ids[i + 1], full]);
  for (const until of [10, 20, 30, 40]) {
    const u = await p.evaluate(until => {
      const G = GOBLIN, run = G.run, out = {}; run.paused = true;
      while (run.time < until && !run.over) {
        G.update(1 / 60); G.keys.ShiftLeft = true; G.keys.KeyD = Math.sin(run.time) > 0; G.keys.KeyW = Math.cos(run.time * .7) > 0;
        if (G.P.hp < G.P.maxHp * .3) G.P.hp = G.P.maxHp;
        if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
        run.paused = false;
        for (let k = 0; k < 2; k++) { const s = run.abil[k]; if (s && s.id !== 'charm') s.ch = s.need; if (G.abilReady(s) && G.useAbility(k)) out[s.id] = (out[s.id] || 0) + 1; }
        if (Math.floor(run.time * 60) % 50 === 0) G.doDash();
        run.paused = true;
        if (run.abil.some(s => s && s.id === 'charm') && Math.floor(run.time * 60) % 900 === 0) G.P.hp = 0.1;
      }
      G.keys.ShiftLeft = G.keys.KeyD = G.keys.KeyW = false; run.paused = false; return out;
    }, until);
    for (const [k, v] of Object.entries(u)) used[k] = (used[k] || 0) + v;
    await p.waitForTimeout(80);
  }
}
const unused = ids.filter(id => id !== 'charm' && !used[id]);
if (unused.length) errs.push('nie eingesetzt: ' + unused.join(', '));
console.log('Alle Bäume voll (40 s je Paar):', JSON.stringify(used));
// Laden und Werkstatt (Phase 6): Holztruhe kaufen und durchklicken, Karte aufwerten, Siegtruhe nach dem Boss
// (die Bosskämpfe oben haben schon Siegtruhen geöffnet und Karten gebracht → relativ zählen)
const before = await p.evaluate(() => { const S = GOBLIN.save; S.wallet.gold = 3000; S.wallet.gems = 100; S.chests.shelf = []; GOBLIN.go('menu', '#store'); return { chests: S.stats.chests, cards: Object.values(S.cards).reduce((a, c) => a + c.n, 0) }; });
await p.waitForTimeout(300);
await p.click('[data-buy-chest="wood"]');
await p.waitForSelector('#chestOpen:not([hidden])');
// Tippen: Wackler (mind. 180 ms Abstand), Karten umdrehen und weiter, ggf. Bonusfund
for (let i = 0; i < 120 && !(await p.evaluate(() => !!document.querySelector('#coDone'))); i++) { await p.mouse.click(640, 380); await p.waitForTimeout(200); }
await p.click('#coDone');
const shop = await p.evaluate(() => { const S = GOBLIN.save; return { chests: S.stats.chests, cards: Object.values(S.cards).reduce((a, c) => a + c.n, 0), gold: S.wallet.gold }; });
if (shop.chests !== before.chests + 1 || shop.cards <= before.cards) errs.push('Holztruhe: ' + JSON.stringify(shop));
// Runen (Phase 10): Runenkiste kaufen, Tasche in der Rüstkammer (einsetzen, verschmelzen, ausbauen), Lauf mit allen Runenarten
await p.evaluate(() => { const S = GOBLIN.save; S.wallet.gems = 100; S.runes = { bag: {}, sock: {} }; GOBLIN.go('menu', '#store'); });
await p.waitForTimeout(300);
await p.click('[data-runebag]'); await p.waitForSelector('#chestOpen:not([hidden])');
for (let i = 0; i < 60 && !(await p.evaluate(() => !!document.querySelector('#coDone'))); i++) { await p.mouse.click(640, 380); await p.waitForTimeout(200); }
const rbHtml = await p.evaluate(() => document.querySelectorAll('.co-sum .rune').length);
await p.click('#coDone');
const rbGot = await p.evaluate(() => Object.values(GOBLIN.save.runes.bag).reduce((a, b) => a + b, 0));
if (rbGot !== 3 || rbHtml !== 3) errs.push(`Runenkiste: ${rbGot} Runen in der Tasche, ${rbHtml} in der Übersicht (soll 3)`);
await p.evaluate(() => { const S = GOBLIN.save; S.abilities.catapult = { lv: 20, xp: 0, pts: {} }; S.runes = { bag: { 'fire.0': 3, 'bolt.1': 1 }, sock: {} }; S.profile.level = 20; GOBLIN.go('menu', '#armory'); });
await p.waitForTimeout(300);
await p.click('#armShelf [data-pick="catapult"]'); await p.click('#armNote [data-sock="0"]');
await p.waitForSelector('#runeBag:not([hidden])');
await p.click('#runeGrid [data-rune="fire.0"]'); await p.click('#runeNote [data-fuse]');
await p.waitForTimeout(1700);
await p.click('#runeGrid [data-rune="fire.1"]'); await p.click('#runeNote [data-in]');
await p.click('#runeSocks [data-slot="1"]'); await p.click('#runeGrid [data-rune="bolt.1"]'); await p.click('#runeNote [data-in]');
await p.click('#runeSocks [data-slot="1"]'); await p.click('#runeNote [data-out]');
await p.keyboard.press('Escape');
const rs = await p.evaluate(() => ({ runes: GOBLIN.save.runes, open: !document.querySelector('#runeBag').hidden, note: document.querySelectorAll('#armNote .asock .rune').length }));
if (JSON.stringify(rs.runes) !== JSON.stringify({ bag: { 'bolt.1': 1 }, sock: { catapult: ['fire.1', null] } }) || rs.open || rs.note !== 1) errs.push('Runen-Tasche: ' + JSON.stringify(rs));
// Lauf: jede Runenart steckt in einer Fähigkeit, die sie trägt (Katapult + Bienenstock), 40 s mit Zeichnen
for (const [a, b] of [[['fire.3', 'bolt.3'], ['echo.3', 'poison.3']], [['frost.3', 'luck.3'], ['blood.3', 'soul.3']], [['greed.3', 'might.3'], ['haste.3', 'wide.3']]]) {
  await p.evaluate(([a, b]) => { const G = GOBLIN, S = G.save; S.abilities.catapult = { lv: 20, xp: 0, pts: {} }; S.abilities.bees = { lv: 20, xp: 0, pts: {} }; S.profile.level = 40;
    S.runes = { bag: {}, sock: { catapult: a, bees: b } }; S.loadout = ['catapult', 'bees']; G.go('run', { si: 3, li: 2, seed: 5 }); }, [a, b]);
  const rr = await p.evaluate(() => { const G = GOBLIN, run = G.run; run.paused = true; let uses = 0, fill = 2;
    while (run.time < 40 && !run.over) { G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); }
      if (run.time >= fill) { fill += 4; for (const s of run.abil) if (s) s.ch = s.need; }   // alle 4 s voll laden (Kill-Fähigkeiten)
      run.paused = false; for (let k = 0; k < 2; k++) if (G.abilReady(run.abil[k]) && G.useAbility(k)) uses++; run.paused = true; }
    run.paused = false; return { uses, kills: run.kills, runes: JSON.stringify(run.runes) }; });
  await p.waitForTimeout(200);
  if (!rr.uses || !rr.kills || rr.runes === '{}') errs.push('Lauf mit Runen: ' + JSON.stringify(rr));
}
console.log('Runen (Runenkiste, Tasche, Läufe mit allen Runenarten): geprüft');
// Weitermachen für Juwelen: im Bosskampf sterben → Fenster, Weitermachen startet den Boss neu, zu wenig Juwelen → Aufgeben
await p.evaluate(() => { const G = GOBLIN; G.save.wallet.gems = 15; G.save.loadout = ['rage', null]; G.go('run', { si: 0, li: 4, seed: 3 }); });
await p.evaluate(() => { const G = GOBLIN, run = G.run; run.paused = true; while (run.time < 96 && !run.over) { G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); } } run.paused = false; });
await p.waitForTimeout(4500);
const dieNow = () => p.evaluate(() => { const G = GOBLIN; G.P.inv = 0; G.P.dashT = 0; G.P.hp = 1; G.damagePlayer(500, 'contact'); return !document.querySelector('#cont').hidden; });
const c1 = await dieNow(); await p.click('#contYes'); await p.waitForTimeout(300);
const c2 = await p.evaluate(() => ({ gems: GOBLIN.save.wallet.gems, cont: GOBLIN.run.cont, full: GOBLIN.P.hp === GOBLIN.P.maxHp, boss: GOBLIN.run.boss && GOBLIN.run.boss.hp === GOBLIN.run.boss.maxHp, paused: GOBLIN.run.paused }));
await p.waitForTimeout(4500);
const c3 = await dieNow(); await p.click('#contYes'); const c4 = await p.evaluate(() => !document.querySelector('#cont').hidden);
await p.click('#contNo'); await p.waitForTimeout(800);
const c5 = await p.evaluate(() => ({ over: GOBLIN.run.over, cont: GOBLIN.run.result.cont, hats: GOBLIN.run.result.hats }));
if (!c1 || c2.gems !== 5 || c2.cont !== 1 || !c2.full || !c2.boss || c2.paused || !c3 || !c4 || !c5.over || c5.cont !== 1) errs.push('Weitermachen: ' + JSON.stringify({ c1, c2, c3, c4, c5 }));
console.log('Weitermachen (Boss von vorn, Juwelen, Aufgeben): geprüft');
await p.evaluate(() => { GOBLIN.save.cards.dagger = { lv: 1, n: 2 }; GOBLIN.go('menu', '#shop'); });
await p.waitForTimeout(200);
await p.click('[data-card="dagger"]'); await p.click('#cardUp');
const dag = await p.evaluate(() => GOBLIN.save.cards.dagger.lv);
if (dag !== 2) errs.push('Aufwerten: Wurfdolch Stufe ' + dag);
await p.click('#cardInfo [data-close]');
await p.evaluate(() => { const G = GOBLIN; G.go('run', { si: 0, li: 4, seed: 4 }); G.endRun(true); });
await p.waitForSelector('#over:not([hidden])');
const vc = await p.evaluate(() => ({ chest: GOBLIN.run.result.chest, shelf: GOBLIN.save.chests.shelf.length, html: !!document.querySelector('#overStats .vchest') }));
if (!vc.chest || vc.shelf !== 1 || !vc.html) errs.push('Siegtruhe: ' + JSON.stringify(vc));
console.log('Laden, Truhe, Aufwerten, Siegtruhe:', JSON.stringify({ shop, dag, shelf: vc.shelf }));
// Garderobe und Erfolge: Hut anziehen, Erfolg abholen, Zähler aus dem Lauf
await p.evaluate(() => { const S = GOBLIN.save; S.cosm.push('hat.viking'); S.stats.kills = Math.max(S.stats.kills, 1000); GOBLIN.go('menu', '#profile'); });
await p.waitForTimeout(200);
await p.click('[data-psub="ward"]'); await p.click('[data-wslot="hat"]'); await p.click('[data-cosm="hat.viking"]');
await p.click('[data-psub="ach"]'); await p.click('[data-ach="kills"]');
await p.evaluate(() => { const G = GOBLIN; G.go('run', { si: 0, seed: 6 }); G.run.paused = false; G.doDash(); G.endRun(false); G.go('menu'); });
const prog = await p.evaluate(() => ({ hat: GOBLIN.save.look.hat, ach: GOBLIN.save.ach.kills, rolls: GOBLIN.save.stats.c.rolls || 0, levels: GOBLIN.save.stats.c.levels || 0 }));
if (prog.hat !== 'viking' || prog.ach !== 1 || !prog.rolls || !prog.levels) errs.push('Garderobe/Erfolge/Zähler: ' + JSON.stringify(prog));
console.log('Garderobe, Erfolge, Zähler:', JSON.stringify(prog));
// Alle Entwicklungen gleichzeitig gegen einen Boss (2026-10-16: Plasmagewitter schrieb e.ph = Bossphase → Absturz)
const allEvo = await p.evaluate(() => {
  const G = GOBLIN; G.go('run', { si: 0, li: 4, seed: 21 }); const run = G.run; run.paused = true;
  let seen = 0; const off = G.events.on('bossSpawn', () => seen++);   // Boss kann vor Ende der Schleife schon fallen
  run.weapons.length = 0;
  for (const id of Object.keys(G.WEAPONS)) { G.applyChoice({ k: 'newW', id }); const w = run.weapons[run.weapons.length - 1]; w.lv = 5; w.evo = true; }
  while (run.time < 95 && !run.over) { G.P.inv = 9; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); } }
  off(); const b = run.boss; return { boss: seen > 0, ph: b ? b.ph : null };
});
if (!allEvo.boss || (allEvo.ph !== null && !Number.isInteger(allEvo.ph))) errs.push('Alle Entwicklungen gegen Boss: ' + JSON.stringify(allEvo));
console.log('Alle Entwicklungen gegen Boss:', JSON.stringify(allEvo));
await p.evaluate(() => { GOBLIN.run.paused = true; GOBLIN.go('menu'); });
// Entwicklungs-Baum (Wunsch Fabi 2026-10-16): Vorschau aus Werkstatt und Level-Up; ein Lauf mit offener Vorschau
// geht genauso aus wie ohne (eigener Zufall, kein Ton, keine Ereignisse)
const evo = {};
await p.evaluate(() => GOBLIN.go('menu', '#shop'));
await p.waitForTimeout(200);
await p.click('#wsEvoBtn'); await p.waitForTimeout(400);
await p.click('[data-n="m:comet"]'); await p.waitForTimeout(900);
evo.hub = await p.evaluate(() => ({ open: !document.querySelector('#evoTree').hidden, groups: document.querySelectorAll('#evoList .evogrp').length, cap: document.querySelector('#evoCap .nm').textContent }));
await p.keyboard.press('Escape');
const trace = async peek => p.evaluate(async peek => {
  const G = GOBLIN; G.go('run', { si: 1, li: 2, seed: 77 });
  const run = G.run; run.paused = true;
  // nicht unverwundbar: Kontakttreffer, Dornen und Ausweichen fragen das Raster ab und müssen gleich ausgehen
  const steps = n => { for (let i = 0; i < n && !run.over; i++) { G.P.hp = G.P.maxHp; G.update(1 / 60); if (run.lvDelay > 0) { run.lvDelay = 0; G.choose(G.genChoices(), 0); } } };
  steps(1800);
  if (peek) {
    document.querySelector('#pEvoBtn').click();
    await new Promise(r => setTimeout(r, 700));   // ein paar echte Vorschau-Bilder
    document.querySelector('[data-n="m:plague"]').click();
    await new Promise(r => setTimeout(r, 700));
    document.querySelector('#evoClose').click();
  }
  steps(1800);
  return [JSON.stringify(run.cnt), run.kills, Math.round(G.P.hp * 100), run.enemies.length, Math.round(run.enemies.reduce((s, e) => s + e.x + e.y, 0)), G.P.lv, run.weapons.map(w => w.id + w.lv).join()].join('|');
}, peek);
evo.same = (await trace(false)) === (await trace(true));
await p.evaluate(() => { GOBLIN.run.paused = true; GOBLIN.go('menu'); });
if (!evo.hub.open || evo.hub.groups !== 10 || !evo.same) errs.push('Entwicklungs-Baum: ' + JSON.stringify(evo));
console.log('Entwicklungs-Baum mit Vorschau:', JSON.stringify(evo));
await b.close();
if (errs.length) { console.log('\nFEHLER:\n' + [...new Set(errs)].join('\n')); process.exit(1); }
console.log('\nkeine Fehler');
