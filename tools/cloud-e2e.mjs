// Ende-zu-Ende-Test Cloud-Sync mit zwei „Geräten“ (getrennte Browser-Profile) gegen den lokalen Worker:
//   cd cloud && npm run dev   (in einem zweiten Terminal), dann: node tools/cloud-e2e.mjs
// Prüft: Anmelden + Hochladen, frisches Gerät übernimmt die Cloud, nur ein Gerät gleichzeitig aktiv
// („Du spielst woanders“ → „Hier weiterspielen“ holt den neuesten Stand), Wechsel zurück.
import { chromium } from 'playwright';
const URL = 'http://localhost:8787/?cloudtest=t' + Date.now();
const b = await chromium.launch();
const errs = [], fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FEHL ') + msg); if (!ok) fails.push(msg); };
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
const saved = p => p.waitForFunction(() => /Gesichert/.test(document.querySelector('#profCloud').innerText), null, { timeout: 10000 });
async function signIn(p) { await p.evaluate(() => GOBLIN.go('menu', '#profile')); await p.waitForSelector('#gSignIn button'); await p.click('#gSignIn button'); }
async function saveNow(p) { await p.evaluate(() => GOBLIN.go('menu', '#profile')); await p.waitForSelector('#cloudNow'); await p.click('#cloudNow'); }

const A = await device('A');
await setGold(A, 100);
await signIn(A); await saved(A);
check(true, 'A angemeldet und gesichert');

const B = await device('B');
await Promise.all([B.waitForEvent('load'), signIn(B)]); await ready(B);
check(await gold(B) === 100, 'B übernimmt die Cloud (100)');
await setGold(B, 700); await saveNow(B); await saved(B);

// A spielt weiter, will sichern → B ist das aktive Gerät
await setGold(A, 500); await saveNow(A);
await A.waitForSelector('#cloudPick:not([hidden]) [data-dev="here"]', { timeout: 8000 });
check(/Browser am PC/.test(await A.innerText('#cloudPanel')), 'A: „Du spielst woanders“ mit Gerätename');
await Promise.all([A.waitForEvent('load'), A.click('[data-dev="here"]')]); await ready(A);
check(await gold(A) === 700, 'A „Hier weiterspielen“ holt den neuesten Stand (700), nicht die eigenen 500');

// Jetzt ist A aktiv: B wird beim Zurückkommen gesperrt
await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await B.waitForSelector('#cloudPick:not([hidden]) [data-dev="here"]', { timeout: 8000 });
check(true, 'B wird beim Zurückkommen gesperrt');
await setGold(A, 900); await saveNow(A); await saved(A);
await Promise.all([B.waitForEvent('load'), B.click('[data-dev="here"]')]); await ready(B);
check(await gold(B) === 900, 'B holt sich den Stand von A (900)');

console.log('Fehler:', errs);
await b.close();
if (fails.length || errs.length) process.exit(1);
