// Cloud-Sync für Goblin.io: Spiel ausliefern (Assets) und /api für Anmeldung und Spielstand.
// Anmeldung: Das Spiel schickt ein Google-ID-Token, der Worker prüft die Signatur gegen Googles Schlüssel
// und gibt einen eigenen Sitzungsschlüssel zurück (gespeichert wird nur dessen SHA-256).
//   POST /api/login  { idToken }            → { token, name, picture, acct }   (acct: feste Konto-Kennung, nicht die Google-ID)
//   POST /api/logout                        → {}
//   POST /api/link/start                    → { link, code, url, interval, expires }   (exe/APK: Code im Browser bestätigen)
//   POST /api/link/confirm { code }         (angemeldet) verbindet die App mit diesem Konto
//   POST /api/link/poll { link }            → { pending } | { token, name, picture, acct }
//   DELETE /api/account                     Konto löschen: Spielstand und alle Sitzungen
//   GET  /api/save                          → { data, level, runs, updated, acct } | { data: null, acct }
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
    // kurze Adresse zum Abtippen (App verbinden)
    if (url.pathname === '/verbinden') return Response.redirect(url.origin + '/?verbinden', 302);
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
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

async function route(req, env, path) {
  if (path === '/api/login' && req.method === 'POST') return login(req, env);
  if (path === '/api/link/start' && req.method === 'POST') return linkStart(env);
  if (path === '/api/link/confirm' && req.method === 'POST') return linkConfirm(req, env);
  if (path === '/api/link/poll' && req.method === 'POST') return linkPoll(req, env);
  if (path === '/api/account' && req.method === 'DELETE') {
    const s = await session(req, env);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM saves WHERE sub = ?').bind(s.sub),
      env.DB.prepare('DELETE FROM sessions WHERE sub = ?').bind(s.sub),
      env.DB.prepare('DELETE FROM links WHERE sub = ?').bind(s.sub),
    ]);
    return json({});
  }
  if (path === '/api/logout' && req.method === 'POST') {
    const tok = bearer(req);
    if (tok) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(tok)).run();
    return json({});
  }
  if (path === '/api/save') {
    const s = await session(req, env);
    if (req.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, level, runs, updated FROM saves WHERE sub = ?').bind(s.sub).first();
      return json({ ...(row || { data: null }), acct: await acctId(s.sub) });
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
  return { token, name: who.name || '', picture: who.picture || '', acct: await acctId(who.sub) };
}

// ---------- App verbinden (exe/APK) ----------
// Dort geht „Sign in with Google“ nicht (kein echter Web-Ursprung). Die App holt einen Code, man meldet sich auf
// goblin.node-wave.org/verbinden im Browser an (auch am Handy) und gibt ihn ein; die App fragt nach, bis es geklappt hat.
const LINK_MIN = 10, CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function linkStart(env) {
  const link = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => CODE_ABC[b % CODE_ABC.length]).join('');
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM links WHERE expires < ?').bind(now),
    env.DB.prepare('INSERT INTO links (code, hash, expires) VALUES (?, ?, ?)').bind(code, await sha256(link), now + LINK_MIN * 60e3),
  ]);
  return json({ link, code: code.slice(0, 4) + '-' + code.slice(4), url: 'https://goblin.node-wave.org/verbinden', interval: 3, expires: LINK_MIN * 60 });
}
async function linkConfirm(req, env) {
  const s = await session(req, env);
  const { code } = await req.json().catch(() => ({}));
  const r = await env.DB.prepare('UPDATE links SET sub = ?, name = ?, picture = ? WHERE code = ? AND sub IS NULL AND expires >= ?')
    .bind(s.sub, s.name || '', s.picture || '', normCode(code), Date.now()).run();
  if (!r.meta || !r.meta.changes) throw new HttpError(404, 'Code falsch oder abgelaufen');
  return json({});
}
async function linkPoll(req, env) {
  const { link } = await req.json().catch(() => ({}));
  if (typeof link !== 'string') throw new HttpError(400, 'link fehlt');
  const hash = await sha256(link);
  const row = await env.DB.prepare('SELECT code, sub, name, picture, expires FROM links WHERE hash = ?').bind(hash).first();
  if (!row || row.expires < Date.now()) throw new HttpError(410, 'Code abgelaufen');
  if (!row.sub) return json({ pending: true });
  await env.DB.prepare('DELETE FROM links WHERE hash = ?').bind(hash).run();
  return json(await newSession(env, { sub: row.sub, name: row.name, picture: row.picture }));
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
  const s = await env.DB.prepare('SELECT sub, name, picture, expires FROM sessions WHERE hash = ?').bind(await sha256(tok)).first();
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
// Konto-Kennung fürs Spiel (an wen der lokale Spielstand gebunden ist), ohne die Google-ID herauszugeben
const acctId = async sub => (await sha256('goblin-acct:' + sub)).slice(0, 16);
async function sha256(s) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }
