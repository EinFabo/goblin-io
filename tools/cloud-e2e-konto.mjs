// Ende-zu-Ende-Test Konto-Abläufe gegen den lokalen Worker (wie tools/cloud-e2e.mjs: erst `cd cloud && npm run dev`):
// Abmelden fängt neu an, kein Verdoppeln in ein zweites Konto, App verbinden mit Code, Zurücksetzen, Konto löschen.
import { chromium } from 'playwright';
const BASE = 'http://localhost:8787/', T = 't' + Date.now();
const b = await chromium.launch();
const errs = [], fails = [];
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FEHL ') + msg); if (!ok) fails.push(msg); };
const ready = p => p.waitForFunction(() => window.GOBLIN && GOBLIN.scene === 'menu', null, { timeout: 30000 });
async function page(q) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 700 } }); const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + q); await ready(p); return p;
}
const gold = p => p.evaluate(() => GOBLIN.save.wallet.gold);
const setGold = (p, g) => p.evaluate(g => { GOBLIN.save.wallet.gold = g; GOBLIN.save.stats.runs++; GOBLIN.persist(); }, g);
const prof = p => p.evaluate(() => GOBLIN.go('menu', '#profile'));
const cloudText = p => p.evaluate(() => document.querySelector('#profCloud').innerText.replace(/\s+/g, ' '));
const saved = p => p.waitForFunction(() => /Gesichert/.test(document.querySelector('#profCloud').innerText), null, { timeout: 10000 });
async function signIn(p) { await prof(p); await p.waitForSelector('#gSignIn button'); await p.click('#gSignIn button'); }
// Knopf im Cloud-Fenster drücken; reload: danach lädt die Seite neu
async function pick(p, v, reload) {
  await p.waitForSelector(`#cloudPick:not([hidden]) [data-ch="${v}"]`);
  if (reload) { await Promise.all([p.waitForEvent('load'), p.click(`[data-ch="${v}"]`)]); await ready(p); } else await p.click(`[data-ch="${v}"]`);
}
const go = async (p, q) => { await p.goto(BASE + q); await ready(p); };

// 1) Abmelden: Stand bleibt in der Cloud, Gerät fängt neu an; zweites Konto bekommt den Fortschritt nicht
const A = await page(`?cloudtest=${T}a`);
await setGold(A, 300); await signIn(A); await saved(A);
await prof(A); await A.click('#cloudOut'); await pick(A, 'ok', true);
check(await gold(A) === 0, 'nach Abmelden neues Spiel (Gold 0)');
await go(A, `?cloudtest=${T}b`); await signIn(A); await saved(A);
check(await gold(A) === 0, 'zweites Konto startet leer (kein Verdoppeln)');
await prof(A); await A.click('#cloudOut'); await pick(A, 'ok', true);
await go(A, `?cloudtest=${T}a`); await Promise.all([A.waitForEvent('load'), signIn(A)]); await ready(A);
check(await gold(A) === 300, 'erstes Konto bekommt seinen Stand zurück (300)');

// 2) Sitzung weg (z. B. abgelaufen) mit ungesichertem Fortschritt, dann anderes Konto → Rückfrage, nichts wird hochgeladen
await A.evaluate(() => localStorage.removeItem('goblinio_cloud'));
await setGold(A, 450);
await go(A, `?cloudtest=${T}c`); await signIn(A);
await A.waitForSelector('#cloudPick:not([hidden]) [data-ch="go"]');
check(/ungesicherter Fortschritt/.test(await A.innerText('#cloudPanel')), 'Rückfrage bei fremdem, ungesichertem Stand');
await pick(A, 'go', true);
check(await gold(A) === 0, 'trotzdem wechseln → neues Konto startet leer');
const C2 = await page(`?cloudtest=${T}c`); await Promise.all([C2.waitForEvent('load').catch(() => {}), signIn(C2)]); await ready(C2); await C2.waitForTimeout(800);
check(await gold(C2) === 0, 'Cloud von Konto c hat die 450 nicht bekommen');

// 3) App verbinden: „App“ öffnet die Anmeldeseite im Browser, dort Konto wählen, App ist angemeldet und übernimmt die Cloud.
//    Die Anmeldeseite meldet sich selbst an, unabhängig davon, wer im Browser angemeldet ist (hier: niemand).
const W = await page(`?cloudtest=${T}d`); await setGold(W, 777); await signIn(W); await saved(W);
const APP = await page(`?cloudtest=${T}d&code`);
await prof(APP); await APP.waitForSelector('#gSignIn button');
const [BR] = await Promise.all([APP.context().waitForEvent('page'), APP.click('#gSignIn button')]);
await BR.waitForLoadState(); await ready(BR);
check(/verbinden=[A-Z2-9]{8}/.test(BR.url()), 'App öffnet die Anmeldeseite mit Code');
await BR.waitForSelector('#linkGo button'); await BR.click('#linkGo button');
await BR.waitForSelector('text=Angemeldet!');
check(!(await BR.evaluate(() => (localStorage.getItem('goblinio_cloud') || '').includes('token'))), 'Anmeldeseite meldet die Webseite selbst nicht an');
await APP.waitForEvent('load', { timeout: 15000 }); await ready(APP);
check(await gold(APP) === 777, 'App angemeldet und Cloud-Stand übernommen (777)');
await prof(APP); check(/Gesichert|Gleiche/.test(await cloudText(APP)), 'App zeigt angemeldet: ' + (await cloudText(APP)).slice(0, 60));

// 4) Zurücksetzen (angemeldet): lokal und Cloud neu
await APP.click('#cloudReset'); await pick(APP, 'ok', true);
check(await gold(APP) === 0, 'zurückgesetzt (Gold 0)');
await go(W, `?cloudtest=${T}d`); await W.waitForTimeout(1500);
check(await gold(W) === 0, 'anderes Gerät übernimmt den zurückgesetzten Stand');

// 5) Konto löschen: abgemeldet überall, Cloud leer
await prof(APP); await APP.click('#cloudDel'); await pick(APP, 'ok', true);
await prof(APP); check(!!(await APP.$('#gSignIn')), 'nach Löschen abgemeldet');
await go(W, `?cloudtest=${T}d`); await prof(W);
check(!!(await W.$('#gSignIn')), 'anderes Gerät ebenfalls abgemeldet');

console.log('Seitenfehler:', errs);
await b.close();
if (fails.length || errs.length) process.exit(1);
