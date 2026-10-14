// Anmeldung mit Code (exe/APK): Worker spricht mit Googles Geräte-Ablauf; Google und D1 sind hier nachgebaut
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const b64u = b => Buffer.from(b).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k2', alg: 'RS256' };
async function idToken(claims) {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'k2' })), body = b64u(JSON.stringify(claims));
  return head + '.' + body + '.' + b64u(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(head + '.' + body))));
}
// Google: /device/code gibt einen Code, /token antwortet nach Drehbuch
let script = [], sent = [];
globalThis.fetch = async (url, opt = {}) => {
  url = String(url);
  if (url.includes('/certs')) return Response.json({ keys: [jwk] });
  const body = Object.fromEntries(new URLSearchParams(opt.body)); sent.push([url.split('/').pop(), body]);
  if (url.endsWith('/device/code')) return Response.json({ device_code: 'DC1', user_code: 'BQKW-TPZM', verification_url: 'https://www.google.com/device', interval: 5, expires_in: 1800 });
  const next = script.shift();
  return Response.json(next, { status: next.error ? 428 : 200 });
};
const sessions = [];
const DB = {
  prepare(sql) { return { bind(...a) { this.a = a; return this; }, async run() { if (sql.startsWith('INSERT INTO sessions')) sessions.push(this.a); return {}; }, async first() { return null; } }; },
  async batch(list) { for (const s of list) await s.run(); return []; },
};
const env = { DB, GOOGLE_TV_CLIENT_ID: 'tv-id', GOOGLE_TV_SECRET: 'geheim', GOOGLE_CLIENT_IDS: 'web-id,tv-id', ALLOWED_ORIGINS: 'tauri://localhost' };
const call = (path, body) => worker.fetch(new Request('https://goblin.node-wave.org' + path, { method: 'POST', body: JSON.stringify(body || {}), headers: { Origin: 'tauri://localhost' } }), env);

test('Code anfordern, warten, angemeldet', async () => {
  const s = await call('/api/device/start');
  assert.equal(s.headers.get('Access-Control-Allow-Origin'), 'tauri://localhost');
  assert.deepEqual(await s.json(), { device: 'DC1', code: 'BQKW-TPZM', url: 'https://www.google.com/device', interval: 5, expires: 1800 });
  assert.equal(sent[0][1].client_id, 'tv-id');
  script = [{ error: 'authorization_pending' }, { error: 'slow_down' }, { id_token: await idToken({ iss: 'https://accounts.google.com', aud: 'tv-id', sub: '42', name: 'Fabi', exp: Date.now() / 1000 + 600 }) }];
  assert.deepEqual(await (await call('/api/device/poll', { device: 'DC1' })).json(), { pending: true, slow: false });
  assert.deepEqual(await (await call('/api/device/poll', { device: 'DC1' })).json(), { pending: true, slow: true });
  const ok = await (await call('/api/device/poll', { device: 'DC1' })).json();
  assert.equal(ok.name, 'Fabi'); assert.ok(ok.token.length > 20);
  assert.equal(sessions.at(-1)[1], '42', 'Sitzung für Google-Konto 42');
  const tok = sent.filter(([u]) => u === 'token').at(-1)[1];
  assert.equal(tok.client_secret, 'geheim'); assert.equal(tok.device_code, 'DC1');
});
test('abgelehnt → 403, abgelaufen → 410, fremde Client-ID im Token → 401', async () => {
  script = [{ error: 'access_denied' }, { error: 'expired_token' }, { id_token: await idToken({ iss: 'accounts.google.com', aud: 'fremd', sub: '1', exp: Date.now() / 1000 + 600 }) }];
  assert.equal((await call('/api/device/poll', { device: 'DC1' })).status, 403);
  assert.equal((await call('/api/device/poll', { device: 'DC1' })).status, 410);
  assert.equal((await call('/api/device/poll', { device: 'DC1' })).status, 401);
});
