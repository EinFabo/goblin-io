// Cloud-Sync für Goblin.io: Spiel ausliefern (Assets) und /api für Anmeldung und Spielstand.
// Anmeldung: Das Spiel schickt ein Google-ID-Token, der Worker prüft die Signatur gegen Googles Schlüssel
// und gibt einen eigenen Sitzungsschlüssel zurück (gespeichert wird nur dessen SHA-256).
//   POST /api/login  { idToken | accessToken } → { token, name, picture, acct }   (acct: feste Konto-Kennung, nicht die Google-ID)
//   POST /api/logout                        → {}
//   POST /api/link/start                    → { link, code, url, interval, expires }   (exe/APK: Code im Browser bestätigen)
//   POST /api/link/confirm { code, accessToken } (oder angemeldet) verbindet die App mit diesem Konto
//   POST /api/link/poll { link }            → { pending } | { token, name, picture, acct }
//   DELETE /api/account                     Konto löschen: Spielstand und alle Sitzungen
//   POST /api/claim { name }                dieses Gerät wird das aktive (nur das aktive darf speichern, sonst 423)
//   GET  /api/active                        → { active, activeName }
//   POST /api/room { v }                    → { code }   Koop-Raum anlegen (Phase 14d, src/room.js)
//   GET  /api/room/<CODE> (WebSocket)       Koop-Raum betreten
//   GET  /anmelden?code=…                   exe/APK: direkt zu Googles Kontoauswahl, zurück über /api/auth/callback
//   GET  /api/save                          → { data, level, runs, updated, acct } | { data: null, acct }
//   PUT  /api/save   { data, level, runs, base, force }
//        base = updated des zuletzt gesehenen Cloud-Stands; ist der Cloud-Stand neuer und force fehlt → 409 mit dem Cloud-Stand
const SESSION_DAYS = 90, MAX_SAVE = 2 * 1024 * 1024;
const GOOGLE_CERTS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_OAUTH = 'https://oauth2.googleapis.com';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export { Room } from './room.js';
import { newCode, validCode } from './room.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // kurze Adresse zum Abtippen (App verbinden)
    if (url.pathname === '/verbinden') return Response.redirect(url.origin + '/?verbinden', 302);
    // Anmeldeseite für exe/APK: nur Googles Kontoauswahl, kein Spiel im Hintergrund
    if (url.pathname === '/anmelden' || url.pathname === '/api/auth/callback') {
      try { return await (url.pathname === '/anmelden' ? authStart(url, env) : authCallback(req, env)); } catch (e) {
        if (!(e instanceof HttpError)) console.error(e);
        return authPage('Hat nicht geklappt', e instanceof HttpError ? e.message : 'Serverfehler', false);
      }
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    // Koop-Raum betreten (WebSocket): vor dem CORS-Teil, die Antwort 101 kommt direkt vom Raum
    if (url.pathname.startsWith('/api/room/')) return roomSocket(req, env, url.pathname.slice(10));
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

// Koop-Raum (Phase 14d, room.js): freien Code würfeln und Raum anlegen. v = Spielversion (nur gleiche spielen zusammen)
const roomStub = (env, code) => env.ROOM.get(env.ROOM.idFromName(code));
async function roomCreate(req, env) {
  // höchstens 10 neue Räume je Minute und Adresse (Bindung ROOM_LIMIT; lokal/in Tests ohne)
  if (env.ROOM_LIMIT) { const { success } = await env.ROOM_LIMIT.limit({ key: req.headers.get('CF-Connecting-IP') || 'x' }); if (!success) throw new HttpError(429, 'Zu viele Räume, kurz warten'); }
  const { v } = await req.json().catch(() => ({}));
  if (typeof v !== 'string' || !v || v.length > 32) throw new HttpError(400, 'Version fehlt');
  for (let i = 0; i < 6; i++) {
    const code = newCode(), r = await roomStub(env, code).fetch('https://room/create', { method: 'POST', body: JSON.stringify({ v }) });
    if ((await r.json()).ok) return json({ code });
  }
  throw new HttpError(503, 'Kein freier Raum, gleich nochmal');
}
// Nur aus dem Spiel (erlaubte Origins; lokal mit DEV auch andere), nur gültige Codes
function roomSocket(req, env, code) {
  if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket erwartet', { status: 426 });
  const origin = req.headers.get('Origin') || '', ok = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
  if (env.DEV !== '1' && !ok.includes(origin)) return new Response('Nicht erlaubt', { status: 403 });
  code = code.toUpperCase();
  if (!validCode(code)) return new Response('Code ungültig', { status: 404 });
  return roomStub(env, code).fetch(req);
}

async function route(req, env, path) {
  if (path === '/api/room' && req.method === 'POST') return roomCreate(req, env);
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
      env.DB.prepare('DELETE FROM active WHERE sub = ?').bind(s.sub),
    ]);
    return json({});
  }
  if (path === '/api/logout' && req.method === 'POST') {
    const tok = bearer(req);
    if (tok) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(tok)).run();
    return json({});
  }
  if (path === '/api/claim' && req.method === 'POST') {
    const s = await session(req, env), { name } = await req.json().catch(() => ({}));
    await env.DB.prepare('INSERT INTO active (sub, hash, name, at) VALUES (?, ?, ?, ?) ON CONFLICT(sub) DO UPDATE SET hash = excluded.hash, name = excluded.name, at = excluded.at')
      .bind(s.sub, s.hash, String(name || 'Gerät').slice(0, 40), Date.now()).run();
    return json({});
  }
  if (path === '/api/active' && req.method === 'GET') return json(await activeOf(env, await session(req, env)));
  if (path === '/api/save') {
    const s = await session(req, env);
    if (req.method === 'GET') {
      const row = await env.DB.prepare('SELECT data, level, runs, updated FROM saves WHERE sub = ?').bind(s.sub).first();
      return json({ ...(row || { data: null }), acct: await acctId(s.sub), ...(await activeOf(env, s)) });
    }
    if (req.method === 'PUT') return putSave(req, env, s);
  }
  throw new HttpError(404, 'Gibt es nicht');
}

async function login(req, env) {
  return json(await newSession(env, await whoFrom(await req.json().catch(() => ({})), env)));
}
// Wer meldet sich an? idToken (Sign in with Google) oder accessToken (eigener Knopf, Google-Kontoauswahl im Popup)
async function whoFrom({ idToken, accessToken }, env) {
  // Nur lokal (npm run dev): Test-Anmeldung ohne Google
  const dev = typeof idToken === 'string' ? idToken : accessToken;
  if (env.DEV === '1' && typeof dev === 'string' && dev.startsWith('dev:')) return { sub: 'dev-' + dev.slice(4), name: dev.slice(4), picture: '' };
  if (typeof accessToken === 'string') return verifyAccess(accessToken, env);
  if (typeof idToken === 'string') return verifyGoogle(idToken, env);
  throw new HttpError(400, 'Token fehlt');
}
// Access-Token: bei Google nachfragen, für welche Client-ID es ausgestellt ist (sonst könnte jede fremde App ihre Tokens schicken)
export async function verifyAccess(tok, env) {
  const info = await (await fetch(GOOGLE_OAUTH + '/tokeninfo?access_token=' + encodeURIComponent(tok))).json().catch(() => ({}));
  const auds = (env.GOOGLE_CLIENT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!info.sub || !auds.includes(info.aud)) throw new HttpError(401, 'Anmeldung ungültig');
  const u = await (await fetch(GOOGLE_USERINFO, { headers: { Authorization: 'Bearer ' + tok } })).json().catch(() => ({}));
  if (u.sub !== info.sub) throw new HttpError(401, 'Anmeldung ungültig');
  return { sub: u.sub, name: u.name || u.email || '', picture: u.picture || '' };
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
// Bestätigen mit eigener Google-Anmeldung (accessToken, unabhängig davon, wer auf der Webseite angemeldet ist)
// oder mit einer Sitzung der Webseite
async function linkConfirm(req, env) {
  const body = await req.json().catch(() => ({}));
  const s = body.accessToken || body.idToken ? await whoFrom(body, env) : await session(req, env);
  const { code } = body;
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
  // Nur das aktive Gerät darf speichern (sonst entstehen zwei Stände)
  const a = await activeOf(env, s);
  if (!a.active) return json({ elsewhere: true, ...a }, 423);
  const cur = await env.DB.prepare('SELECT data, level, runs, updated FROM saves WHERE sub = ?').bind(s.sub).first();
  if (cur && !p.force && cur.updated > (+p.base || 0)) return json({ conflict: true, ...cur }, 409);
  const updated = Math.max(Date.now(), cur ? cur.updated + 1 : 0);
  await env.DB.prepare('INSERT INTO saves (sub, data, level, runs, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sub) DO UPDATE SET data = excluded.data, level = excluded.level, runs = excluded.runs, updated = excluded.updated')
    .bind(s.sub, p.data, p.level | 0, p.runs | 0, updated).run();
  return json({ updated });
}

// Ist diese Sitzung das aktive Gerät des Kontos? Ohne Eintrag (noch nie beansprucht) darf jedes speichern.
async function activeOf(env, s) {
  const a = await env.DB.prepare('SELECT hash, name FROM active WHERE sub = ?').bind(s.sub).first();
  return { active: !a || a.hash === s.hash, activeName: a ? a.name : '' };
}

// ---------- Anmeldeseite für exe/APK (/anmelden?code=…) ----------
// Leitet direkt zu Googles Kontoauswahl (OpenID Connect, ID-Token per form_post an /api/auth/callback).
// Dafür muss https://goblin.node-wave.org/api/auth/callback als Weiterleitungs-URI der Web-Client-ID eingetragen sein.
async function authStart(url, env) {
  const code = normCode(url.searchParams.get('code'));
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const r = await env.DB.prepare('UPDATE links SET nonce = ? WHERE code = ? AND sub IS NULL AND expires >= ?').bind(nonce, code, Date.now()).run();
  if (!r.meta || !r.meta.changes) throw new HttpError(404, 'Der Anmelde-Link ist abgelaufen. Bitte in der App nochmal auf „Mit Google anmelden“ tippen.');
  const q = new URLSearchParams({
    client_id: (env.GOOGLE_CLIENT_IDS || '').split(',')[0].trim(), redirect_uri: url.origin + '/api/auth/callback',
    response_type: 'id_token', response_mode: 'form_post', scope: 'openid email profile', prompt: 'select_account', nonce, state: code,
  });
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q, 302);
}
async function authCallback(req, env) {
  if (req.method !== 'POST') throw new HttpError(405, 'Falscher Aufruf');
  const f = await req.formData();
  if (f.get('error')) throw new HttpError(400, f.get('error') === 'access_denied' ? 'Anmeldung abgebrochen.' : 'Google: ' + f.get('error'));
  const code = normCode(f.get('state')), idToken = f.get('id_token');
  if (typeof idToken !== 'string') throw new HttpError(400, 'Google hat kein Token geschickt.');
  const row = await env.DB.prepare('SELECT nonce FROM links WHERE code = ? AND sub IS NULL AND expires >= ?').bind(code, Date.now()).first();
  if (!row || !row.nonce) throw new HttpError(404, 'Der Anmelde-Link ist abgelaufen. Bitte in der App nochmal versuchen.');
  const who = await verifyGoogle(idToken, env);
  if (who.nonce !== row.nonce) throw new HttpError(401, 'Anmeldung ungültig.');
  await env.DB.prepare('UPDATE links SET sub = ?, name = ?, picture = ?, nonce = NULL WHERE code = ? AND sub IS NULL').bind(who.sub, who.name, who.picture, code).run();
  return authPage('Angemeldet!', 'Angemeldet als ' + who.name + '. Zurück zum Spiel …', true);
}
const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Schlichte Seite (kein Spiel): Ergebnis der Anmeldung, bei Erfolg Sprung zurück in die App
function authPage(title, text, ok) {
  const back = `var a=/Android/i.test(navigator.userAgent)?'intent://angemeldet#Intent;scheme=goblinio;package=com.einfabo.goblinio;end':'goblinio://angemeldet';`;
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goblin.io – ${escHtml(title)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#141c0e;color:#f4f1e0;font:16px/1.4 system-ui,sans-serif}main{max-width:420px;padding:28px;margin:16px;border-radius:18px;background:#22301a;border:3px solid #0b1007;text-align:center}h1{margin:0 0 8px;font-size:26px}p{opacity:.85}a{display:inline-block;margin-top:12px;padding:12px 22px;border-radius:12px;background:#6cc644;color:#0b1007;font-weight:700;text-decoration:none}</style></head>
<body><main><h1>${escHtml(title)}</h1><p>${escHtml(text)}</p>${ok ? '<a id="b" href="goblinio://angemeldet">Zurück zum Spiel</a><p><small>Diese Seite kannst du schließen.</small></p>' : ''}</main>
${ok ? `<script>${back}document.getElementById('b').href=a;location.href=a;</script>` : ''}</body></html>`;
  return new Response(html, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

const bearer = req => { const h = req.headers.get('Authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; };
async function session(req, env) {
  const tok = bearer(req);
  if (!tok) throw new HttpError(401, 'Nicht angemeldet');
  const hash = await sha256(tok);
  const s = await env.DB.prepare('SELECT sub, name, picture, expires FROM sessions WHERE hash = ?').bind(hash).first();
  if (!s || s.expires < Date.now()) throw new HttpError(401, 'Sitzung abgelaufen');
  return { ...s, hash };
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
  return { sub: p.sub, name: p.name || p.email || '', picture: p.picture || '', nonce: p.nonce };
}

// ---------- Helfer ----------
function b64url(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(s) { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(b, c => c.charCodeAt(0)); }
// Konto-Kennung fürs Spiel (an wen der lokale Spielstand gebunden ist), ohne die Google-ID herauszugeben
const acctId = async sub => (await sha256('goblin-acct:' + sub)).slice(0, 16);
async function sha256(s) { return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))); }
