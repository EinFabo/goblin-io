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
// Google nachgebaut: Access-Token „gut:<sub>“ gehört zu unserer Client-ID, „fremd:<sub>“ zu einer anderen App
const b64u = b => Buffer.from(b).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k9', alg: 'RS256' };
async function idToken(claims) {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'k9' })), body = b64u(JSON.stringify({ iss: 'https://accounts.google.com', aud: 'web-id', exp: Date.now() / 1000 + 600, ...claims }));
  return head + '.' + body + '.' + b64u(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(head + '.' + body))));
}
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('/certs')) return Response.json({ keys: [jwk] });
  const tok = url.includes('tokeninfo') ? decodeURIComponent(url.split('access_token=')[1]) : (opt.headers.Authorization || '').slice(7);
  const [kind, sub] = tok.split(':');
  if (url.includes('tokeninfo')) return Response.json(sub ? { sub, aud: kind === 'gut' ? 'web-id' : 'andere-app' } : { error: 'invalid_token' }, { status: sub ? 200 : 400 });
  return Response.json({ sub, name: 'Google ' + sub, picture: '' });
};
env.GOOGLE_CLIENT_IDS = 'web-id';
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
test('App verbinden mit eigener Google-Anmeldung (Access-Token), fremde Tokens abgelehnt', async () => {
  const s = await call('POST', '/api/link/start');
  assert.equal((await call('POST', '/api/link/confirm', { code: s.code, accessToken: 'fremd:7' })).status, 401);
  assert.equal((await call('POST', '/api/link/confirm', { code: s.code, accessToken: 'kaputt' })).status, 401);
  assert.equal((await call('POST', '/api/link/confirm', { code: s.code, accessToken: 'gut:7' })).status, 200);
  const app = await call('POST', '/api/link/poll', { link: s.link });
  assert.equal(app.name, 'Google 7');
  const web = await call('POST', '/api/login', { accessToken: 'gut:7' });
  assert.equal(web.acct, app.acct, 'gleiches Konto im Browser und in der App');
});
test('Nur das zuletzt geöffnete Gerät darf speichern', async () => {
  const pc = await login('zwei'), handy = await login('zwei');
  assert.equal((await call('PUT', '/api/save', { data: '{"a":1}', base: 0 }, pc.token)).status, 200, 'noch kein aktives Gerät: frei');
  await call('POST', '/api/claim', { name: 'PC-App' }, pc.token);
  await call('POST', '/api/claim', { name: 'Handy-App' }, handy.token);
  const pcSave = await call('PUT', '/api/save', { data: '{"a":2}', base: Date.now() + 1e6 }, pc.token);
  assert.equal(pcSave.status, 423); assert.equal(pcSave.activeName, 'Handy-App');
  assert.deepEqual(await call('GET', '/api/active', null, pc.token), { status: 200, active: false, activeName: 'Handy-App' });
  const g = await call('GET', '/api/save', null, handy.token);
  assert.equal(g.active, true); assert.equal(g.data, '{"a":1}');
  assert.equal((await call('PUT', '/api/save', { data: '{"a":3}', base: g.updated }, handy.token)).status, 200);
  await call('POST', '/api/claim', { name: 'PC-App' }, pc.token);   // „Hier weiterspielen“
  assert.equal((await call('PUT', '/api/save', { data: '{"a":4}', base: g.updated }, handy.token)).status, 423);
});
test('Anmeldeseite: direkt zu Google, Rückweg mit ID-Token bindet die App', async () => {
  const s = await call('POST', '/api/link/start');
  const go = await worker.fetch(new Request('https://goblin.node-wave.org/anmelden?code=' + s.code), env);
  assert.equal(go.status, 302);
  const g = new URL(go.headers.get('Location'));
  assert.equal(g.host, 'accounts.google.com');
  assert.equal(g.searchParams.get('client_id'), 'web-id'); assert.equal(g.searchParams.get('prompt'), 'select_account');
  assert.equal(g.searchParams.get('redirect_uri'), 'https://goblin.node-wave.org/api/auth/callback');
  const nonce = g.searchParams.get('nonce'), state = g.searchParams.get('state');
  const back = (tok, st = state) => worker.fetch(new Request('https://goblin.node-wave.org/api/auth/callback', { method: 'POST', body: new URLSearchParams({ id_token: tok, state: st }) }), env);
  assert.equal((await back(await idToken({ sub: '55', name: 'Fabi', nonce: 'falsch' }))).status, 400, 'falsche nonce');
  const ok = await back(await idToken({ sub: '55', name: 'Fabi', nonce }));
  assert.equal(ok.status, 200); assert.match(await ok.text(), /goblinio:\/\/angemeldet/);
  const app = await call('POST', '/api/link/poll', { link: s.link });
  assert.equal(app.name, 'Fabi');
  assert.equal((await back(await idToken({ sub: '55', nonce }))).status, 400, 'nur einmal');
  assert.equal((await worker.fetch(new Request('https://goblin.node-wave.org/anmelden?code=XXXXXXXX'), env)).status, 400);
});
