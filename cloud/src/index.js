// Cloud-Sync für Goblin.io: Spiel ausliefern (Assets) und /api für Anmeldung und Spielstand.
// Anmeldung: Das Spiel schickt ein Google-ID-Token, der Worker prüft die Signatur gegen Googles Schlüssel
// und gibt einen eigenen Sitzungsschlüssel zurück (gespeichert wird nur dessen SHA-256).
//   POST /api/login  { idToken }            → { token, name, picture }
//   POST /api/logout                        → {}
//   POST /api/device/start                  → { device, code, url, interval, expires }   (exe/APK: Code auf google.com/device eingeben)
//   POST /api/device/poll { device }        → { pending } | { token, name, picture }  (Client-Secret bleibt hier: GOOGLE_TV_SECRET)
//   GET  /api/save                          → { data, level, runs, updated } | { data: null }
//   PUT  /api/save   { data, level, runs, base, force }
//        base = updated des zuletzt gesehenen Cloud-Stands; ist der Cloud-Stand neuer und force fehlt → 409 mit dem Cloud-Stand
const SESSION_DAYS = 90, MAX_SAVE = 2 * 1024 * 1024;
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_OAUTH = 'https://oauth2.googleapis.com';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    const cors = corsHeaders(env, req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try { res = await route(req, env, url.pathname); } catch (e) {
      res = json({ error: e instanceof HttpError ? e.message : 'Serverfehler' }, e instanceof HttpError ? e.status : 500);
      if (!(e instanceof HttpError)) console.error(e);
    }
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};

function corsHeaders(env, origin) {
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!origin || !ok.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

async function route(req, env, path) {
  if (path === '/api/login' && req.method === 'POST') return login(req, env);
  if (path === '/api/device/start' && req.method === 'POST') return deviceStart(env);
  if (path === '/api/device/poll' && req.method === 'POST') return devicePoll(req, env);
  if (path === '/api/logout' && req.method === 'POST') {
    const tok = bearer(req);
    if (tok) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(tok)).run();
    return json({});
  }
  if (path === '/api/save') {
    const s = await session(req, env);
    if (req.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, level, runs, updated FROM saves WHERE sub = ?').bind(s.sub).first();
      return json(row || { data: null });
    }
    if (req.method === 'PUT') return putSave(req, env, s);
  }
  throw new HttpError(404, 'Gibt es nicht');
}

async function login(req, env) {
  const { idToken } = await req.json().catch(() => ({}));
  if (typeof idToken !== 'string') throw new HttpError(400, 'idToken fehlt');
  let who;
  // Nur lokal (npm run dev): Test-Anmeldung ohne Google
  if (env.DEV === '1' && idToken.startsWith('dev:')) who = { sub: 'dev-' + idToken.slice(4), name: idToken.slice(4), picture: '' };
  else who = await verifyGoogle(idToken, env);
  return json(await newSession(env, who));
}
async function newSession(env, who) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now),
    env.DB.prepare('INSERT INTO sessions (hash, sub, name, picture, expires) VALUES (?, ?, ?, ?, ?)').bind(await sha256(token), who.sub, who.name || '', who.picture || '', now + SESSION_DAYS * 864e5),
  ]);
  return { token, name: who.name || '', picture: who.picture || '' };
}

// ---------- Anmeldung mit Code (Google „Geräte“-Ablauf, Client-Typ „Fernseher und Geräte mit begrenzter Eingabe“) ----------
// Lokal (DEV): Code „TEST-CODE“, die dritte Abfrage meldet an
const devPolls = new Map();
async function deviceStart(env) {
  if (env.DEV === '1' && !env.GOOGLE_TV_CLIENT_ID) {
    const device = 'dev-' + b64url(crypto.getRandomValues(new Uint8Array(6))); devPolls.set(device, 0);
    return json({ device, code: 'TEST-CODE', url: 'https://www.google.com/device', interval: 1, expires: 600 });
  }
  if (!env.GOOGLE_TV_CLIENT_ID) throw new HttpError(503, 'Anmeldung mit Code ist noch nicht eingerichtet');
  const r = await fetch(GOOGLE_OAUTH + '/device/code', { method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_TV_CLIENT_ID, scope: 'openid email profile' }) });
  const j = await r.json();
  if (!r.ok) throw new HttpError(502, 'Google: ' + (j.error || r.status));
  return json({ device: j.device_code, code: j.user_code, url: j.verification_url, interval: j.interval || 5, expires: j.expires_in });
}
async function devicePoll(req, env) {
  const { device } = await req.json().catch(() => ({}));
  if (typeof device !== 'string') throw new HttpError(400, 'device fehlt');
  if (env.DEV === '1' && devPolls.has(device)) {
    const n = devPolls.get(device) + 1; devPolls.set(device, n);
    if (n < 3) return json({ pending: true });
    devPolls.delete(device);
    return json(await newSession(env, { sub: 'dev-device', name: 'Test (Code)', picture: '' }));
  }
  const r = await fetch(GOOGLE_OAUTH + '/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env.GOOGLE_TV_CLIENT_ID, client_secret: env.GOOGLE_TV_SECRET || '', device_code: device, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
  });
  const j = await r.json();
  if (j.error === 'authorization_pending' || j.error === 'slow_down') return json({ pending: true, slow: j.error === 'slow_down' });
  if (j.error === 'access_denied') throw new HttpError(403, 'Anmeldung abgelehnt');
  if (j.error === 'expired_token') throw new HttpError(410, 'Code abgelaufen');
  if (!j.id_token) throw new HttpError(502, 'Google: ' + (j.error || 'kein Token'));
  return json(await newSession(env, await verifyGoogle(j.id_token, env)));
}

async function putSave(req, env, s) {
  const body = await req.text();
  if (body.length > MAX_SAVE) throw new HttpError(413, 'Spielstand zu groß');
  let p; try { p = JSON.parse(body); } catch (_) { throw new HttpError(400, 'Kein JSON'); }
  if (typeof p.data !== 'string') throw new HttpError(400, 'data fehlt');
  try { JSON.parse(p.data); } catch (_) { throw new HttpError(400, 'data ist kein Spielstand'); }
  const cur = await env.DB.prepare('SELECT data, level, runs, updated FROM saves WHERE sub = ?').bind(s.sub).first();
  if (cur && !p.force && cur.updated > (+p.base || 0)) return json({ conflict: true, ...cur }, 409);
  const updated = Math.max(Date.now(), cur ? cur.updated + 1 : 0);
  await env.DB.prepare('INSERT INTO saves (sub, data, level, runs, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sub) DO UPDATE SET data = excluded.data, level = excluded.level, runs = excluded.runs, updated = excluded.updated')
    .bind(s.sub, p.data, p.level | 0, p.runs | 0, updated).run();
  return json({ updated });
}

const bearer = req => { const h = req.headers.get('Authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; };
async function session(req, env) {
  const tok = bearer(req);
  if (!tok) throw new HttpError(401, 'Nicht angemeldet');
  const s = await env.DB.prepare('SELECT sub, expires FROM sessions WHERE hash = ?').bind(await sha256(tok)).first();
  if (!s || s.expires < Date.now()) throw new HttpError(401, 'Sitzung abgelaufen');
  return s;
}

// ---------- Google-ID-Token prüfen (RS256 gegen Googles öffentliche Schlüssel) ----------
let certs = null, certsUntil = 0;
async function googleKey(kid) {
  if (!certs || Date.now() > certsUntil || !certs.find(k => k.kid === kid)) {
    const r = await fetch(GOOGLE_CERTS);
    certs = (await r.json()).keys;
    const age = /max-age=(\d+)/.exec(r.headers.get('Cache-Control') || '');
    certsUntil = Date.now() + (age ? +age[1] : 3600) * 1000;
  }
  const jwk = certs.find(k => k.kid === kid);
  if (!jwk) throw new HttpError(401, 'Unbekannter Schlüssel');
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}
export async function verifyGoogle(idToken, env, now = Date.now()) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Token kaputt');
  let h, p;
  try { [h, p] = parts.slice(0, 2).map(x => JSON.parse(new TextDecoder().decode(unb64url(x)))); } catch (_) { throw new HttpError(401, 'Token kaputt'); }
  if (h.alg !== 'RS256') throw new HttpError(401, 'Falscher Algorithmus');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await googleKey(h.kid), unb64url(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw new HttpError(401, 'Signatur falsch');
  const auds = (env.GOOGLE_CLIENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!auds.includes(p.aud)) throw new HttpError(401, 'Falsche Client-ID');
  if (p.iss !== 'accounts.google.com' && p.iss !== 'https://accounts.google.com') throw new HttpError(401, 'Falscher Aussteller');
  if (!(p.exp * 1000 > now - 60e3)) throw new HttpError(401, 'Token abgelaufen');
  return { sub: p.sub, name: p.name || p.email || '', picture: p.picture || '' };
}

// ---------- Helfer ----------
function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(s) { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function sha256(s) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }
