// Konto-Abläufe gegen eine echte SQLite (node:sqlite, gleiche Migrationen wie D1):
// App verbinden mit Code, Konto-Kennung, Konto löschen. Google wird mit Test-Anmeldung (DEV) umgangen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';

const db = new DatabaseSync(':memory:');
for (const f of readdirSync(new URL('../migrations', import.meta.url)).sort()) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
// D1-Nachbau: prepare().bind().first()/run(), batch()
const DB = {
  prepare(sql) {
    let args = [];
    return {
      bind(...a) { args = a; return this; },
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
    };
  },
  async batch(list) { for (const s of list) await s.run(); return []; },
};
const env = { DB, DEV: '1', ALLOWED_ORIGINS: 'tauri://localhost', ASSETS: { fetch: () => new Response('spiel') } };
async function call(method, path, body, token) {
  const r = await worker.fetch(new Request('https://goblin.node-wave.org' + path, {
    method, body: body ? JSON.stringify(body) : undefined, headers: { Origin: 'tauri://localhost', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  }), env);
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
}
const login = name => call('POST', '/api/login', { idToken: 'dev:' + name });

test('App verbinden: Code im Browser bestätigen, App holt die Sitzung einmal ab', async () => {
  const web = await login('fabi');
  assert.match(web.acct, /^[\w-]{16}$/);
  const s = await call('POST', '/api/link/start');
  assert.match(s.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.deepEqual(await call('POST', '/api/link/poll', { link: s.link }), { status: 200, pending: true });
  assert.equal((await call('POST', '/api/link/confirm', { code: s.code })).status, 401, 'nur angemeldet');
  assert.equal((await call('POST', '/api/link/confirm', { code: 'XXXX-XXXX' }, web.token)).status, 404);
  assert.equal((await call('POST', '/api/link/confirm', { code: s.code.toLowerCase().replace('-', ' ') }, web.token)).status, 200);
  assert.equal((await call('POST', '/api/link/confirm', { code: s.code }, web.token)).status, 404, 'nur einmal');
  const app = await call('POST', '/api/link/poll', { link: s.link });
  assert.equal(app.name, 'fabi'); assert.equal(app.acct, web.acct); assert.notEqual(app.token, web.token);
  assert.equal((await call('GET', '/api/save', null, app.token)).acct, web.acct);
  assert.equal((await call('POST', '/api/link/poll', { link: s.link })).status, 410, 'abgeholt');
  assert.equal((await call('POST', '/api/link/poll', { link: 'falsch' })).status, 410);
});
test('Konto löschen: Spielstand und alle Sitzungen weg', async () => {
  const a = await login('weg'), b = await login('weg'), other = await login('bleibt');
  assert.notEqual(a.acct, other.acct);
  assert.equal((await call('PUT', '/api/save', { data: '{"x":1}', level: 3, runs: 5, base: 0 }, a.token)).status, 200);
  assert.equal((await call('PUT', '/api/save', { data: '{"y":1}', base: 0 }, other.token)).status, 200);
  assert.equal((await call('DELETE', '/api/account', null, a.token)).status, 200);
  assert.equal((await call('GET', '/api/save', null, b.token)).status, 401, 'auch andere Sitzungen des Kontos');
  const c = await login('weg');
  assert.equal((await call('GET', '/api/save', null, c.token)).data, null);
  assert.equal((await call('GET', '/api/save', null, other.token)).data, '{"y":1}');
});
test('/verbinden leitet ins Spiel', async () => {
  const r = await worker.fetch(new Request('https://goblin.node-wave.org/verbinden'), env);
  assert.equal(r.status, 302); assert.equal(r.headers.get('Location'), 'https://goblin.node-wave.org/?verbinden');
});
