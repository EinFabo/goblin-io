// Ende-zu-Ende-Test Cloud-Sync mit zwei „Geräten“ (getrennte Browser-Profile) gegen den lokalen Worker:
//   cd cloud && npm run dev   (in einem zweiten Terminal), dann: node tools/cloud-e2e.mjs
// Prüft: Anmelden + Hochladen, frisches Gerät übernimmt die Cloud, Konflikt-Auswahl, anderes Gerät übernimmt beim Start.
import { chromium } from 'playwright';
const URL = 'http://localhost:8787/?cloudtest=t' + Date.now();
const b = await chromium.launch();
const errs = [];
async function device(name) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(name + ': ' + e.message));
  await p.goto(URL); await ready(p);
  return p;
}
const ready = p => p.waitForFunction(() => window.GOBLIN && GOBLIN.scene === 'menu', null, { timeout: 30000 });
const gold = p => p.evaluate(() => GOBLIN.save.wallet.gold);
// Spielstand ändern wie ein Lauf (persist setzt savedAt)
const setGold = (p, g) => p.evaluate(g => { GOBLIN.save.wallet.gold = g; GOBLIN.save.stats.runs++; GOBLIN.persist(); }, g);
const status = p => p.evaluate(() => document.querySelector('#profCloud').innerText.replace(/\s+/g, ' '));
async function signIn(p) { await p.evaluate(() => GOBLIN.go('menu', '#profile')); await p.waitForSelector('#gSignIn button'); await p.click('#gSignIn button'); }

const A = await device('A');
await setGold(A, 100);
await signIn(A); await A.waitForFunction(() => /Gesichert/.test(document.querySelector('#profCloud').innerText));
console.log('A angemeldet:', await status(A));

const B = await device('B');
await Promise.all([B.waitForEvent('load'), signIn(B)]); await ready(B);
console.log('B übernimmt Cloud (frischer Stand):', await gold(B), '(erwartet 100)');

await setGold(A, 500); await A.click('#cloudNow'); await A.waitForTimeout(800);
await setGold(B, 700);
await B.evaluate(() => GOBLIN.go('menu', '#profile')); await B.waitForSelector('#cloudNow'); await B.click('#cloudNow');
await B.waitForTimeout(1500); console.log('B Status:', await status(B), await B.evaluate(() => JSON.parse(localStorage.getItem('goblinio_cloud'))), await B.evaluate(() => GOBLIN.save.savedAt));
await B.waitForSelector('#cloudPick:not([hidden])', { timeout: 5000 });
console.log('B Konflikt:', (await B.innerText('#cloudPanel')).replace(/\s+/g, ' ').slice(0, 200));
await B.click('[data-keep="local"]'); await B.waitForTimeout(800);
console.log('B behält:', await gold(B), '|', await status(B));

await A.reload(); await ready(A); await A.waitForTimeout(2500);
console.log('A nach Neustart (lokal unverändert → Cloud übernommen):', await gold(A), '(erwartet 700)');
console.log('Fehler:', errs);
await b.close();
