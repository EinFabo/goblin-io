// node --test cloud/test: Google-ID-Token-Prüfung mit selbst erzeugtem Schlüssel (fetch auf Googles Zertifikate wird ersetzt)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyGoogle } from '../src/index.js';

const b64u = b => Buffer.from(b).toString('base64url');
const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'Cache-Control': 'max-age=600' } });
async function token(claims, kid = 'k1') {
  const head = b64u(JSON.stringify({ alg: 'RS256', kid })), body = b64u(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(new Uint8Array(sig));
}
const env = { GOOGLE_CLIENT_IDS: 'web-id, desk-id' };
const ok = { iss: 'https://accounts.google.com', aud: 'desk-id', sub: '123', name: 'Fabi', exp: Math.floor(Date.now() / 1000) + 600 };

test('gültiges Token wird angenommen', async () => {
  assert.deepEqual(await verifyGoogle(await token(ok), env), { sub: '123', name: 'Fabi', picture: '' });
});
test('falsche Client-ID, abgelaufen, falscher Aussteller, verfälscht, kaputt → 401', async () => {
  const bad = [
    await token({ ...ok, aud: 'fremd' }), await token({ ...ok, exp: 1000 }), await token({ ...ok, iss: 'evil.com' }),
    (await token(ok)).replace(/\.[^.]+\./, '.' + b64u(JSON.stringify({ ...ok, sub: '999' })) + '.'), 'a.b.c', 'kaputt',
  ];
  for (const t of bad) await assert.rejects(verifyGoogle(t, env), e => e.status === 401, t.slice(0, 30));
});
