// Cloud-Sync (PLAN.md Phase 8): Spielstand über den Worker auf goblin.node-wave.org (cloud/) sichern.
// Anmeldung mit Google („Sign in with Google“ liefert ein ID-Token, der Worker prüft es und gibt einen
// eigenen Sitzungsschlüssel). Lokal bleibt der Spielstand die Arbeitskopie; abgeglichen wird beim Start,
// nach jedem Lauf und beim Verlassen. Ist der Cloud-Stand anderswo weitergespielt worden UND hat sich
// auch hier etwas getan, wird gefragt – nie still überschrieben.
import { on } from './core/events.js';
import { persist, save, setSave } from './core/save.js';
import { $ } from './core/util.js';

// Client-ID der Webanwendung aus der Google Cloud Console (öffentlich)
export const GOOGLE_CLIENT_ID = '207037584180-cu0m43pkkn8uuo2lkg65ijpqc3t9bd0h.apps.googleusercontent.com';
// Erst nach dem ersten Deploy des Workers (cloud/, goblin.node-wave.org) einschalten
const LIVE = false;
const HOST = 'https://goblin.node-wave.org';
// ?cloudtest: lokal gegen `npm run dev` in cloud/ (Port 8787) mit Test-Anmeldung ohne Google
const TEST = /[?&]cloudtest\b/.test(location.search);
const API = location.origin === HOST || location.port === '8787' ? '' : HOST;
const KEY = 'goblinio_cloud', MIN_GAP = 30e3;
const inApp = !!window.__TAURI__;   // exe/APK: Google-Anmeldung dort kommt später (Systembrowser)

// token, name, picture; base = updated des zuletzt gesehenen Cloud-Stands; localAt = savedAt beim letzten Abgleich;
// mark = Fortschritt beim letzten Abgleich (Läufe, Konto-Level, Gold, Juwelen)
let st = {};
try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { st = {}; }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) { /* privat/voll */ } };
let busy = false, lastUp = 0, upT = 0, status = '', onChange = () => {};
export const cloud = { get user() { return st.token ? { name: st.name, picture: st.picture } : null; }, get status() { return status; }, get syncedAt() { return st.syncedAt || 0; } };
export const cloudReady = () => TEST || (LIVE && !!GOOGLE_CLIENT_ID && !inApp);
export function onCloudChange(fn) { onChange = fn; }
const say = s => { status = s; onChange(); };

async function api(method, path, body) {
  const r = await fetch(API + path, {
    method, headers: { 'Content-Type': 'application/json', ...(st.token ? { Authorization: 'Bearer ' + st.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && st.token) { st = {}; keep(); say('Abgemeldet (Sitzung abgelaufen)'); }
  return { ok: r.ok, status: r.status, ...j };
}
const summary = s => ({ level: s.profile.level, runs: s.stats.runs, gold: s.wallet.gold, gems: s.wallet.gems, at: s.savedAt || 0 });
// Neuer, unbespielter Stand: den darf die Cloud ohne Nachfrage ersetzen
const fresh = s => s.stats.runs === 0 && s.profile.level <= 1 && s.profile.xp === 0;
// Wurde hier seit dem letzten Abgleich gespielt oder eingekauft? (ein neuer Tag im Laden zählt nicht)
const mark = s => [s.stats.runs, s.profile.level, s.profile.xp, s.wallet.gold, s.wallet.gems].join('|');

// ---------- Anmelden / Abmelden ----------
let gsi = null;
function loadGsi() {
  return gsi || (gsi = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(window.google); s.onerror = () => { gsi = null; rej(new Error('Google nicht erreichbar')); };
    document.head.append(s);
  }));
}
// Google-Knopf in el zeichnen (Profil)
export async function renderSignIn(el) {
  if (!cloudReady()) return;
  if (TEST) { el.innerHTML = '<button class="btn small primary">Test-Anmeldung</button>'; el.firstChild.onclick = () => login('dev:' + (new URLSearchParams(location.search).get('cloudtest') || 'test')); return; }
  try {
    const g = await loadGsi();
    g.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: r => login(r.credential), auto_select: false, cancel_on_tap_outside: true });
    el.innerHTML = '';
    g.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'signin_with', shape: 'pill', locale: 'de' });
  } catch (e) { el.textContent = 'Google ist gerade nicht erreichbar.'; }
}
async function login(idToken) {
  say('Melde an …');
  try {
    const r = await api('POST', '/api/login', { idToken });
    if (!r.ok) { say(r.error || 'Anmeldung fehlgeschlagen'); return; }
    st = { token: r.token, name: r.name, picture: r.picture, base: 0, localAt: 0 }; keep();
    await sync();
  } catch (e) { say('Keine Verbindung'); }
}
export async function logout() {
  try { await api('POST', '/api/logout'); } catch (_) { /* offline: Schlüssel trotzdem vergessen */ }
  st = {}; keep(); say('');
}

// ---------- Abgleich ----------
export async function sync() {
  if (!st.token || busy) return;
  busy = true; say('Gleiche ab …');
  try {
    const c = await api('GET', '/api/save');
    if (!c.ok) { if (st.token) say(c.error || 'Abgleich fehlgeschlagen'); return; }
    if (!c.data) { await upload(); return; }
    const cloudMoved = c.updated > (st.base || 0), localMoved = (save.savedAt || 0) > (st.localAt || 0);
    if (!cloudMoved) { if (localMoved) await upload(); else done(); return; }
    // Cloud wurde woanders weitergespielt: übernehmen, wenn hier nichts gespielt wurde (oder alles neu ist)
    if (!localMoved || fresh(save) || mark(save) === st.mark) { adopt(c); return; }
    ask(c);
  } catch (e) { say('Keine Verbindung – es wird lokal gespeichert'); } finally { busy = false; }
}
async function upload(force = false) {
  const r = await api('PUT', '/api/save', { data: JSON.stringify(save), level: save.profile.level, runs: save.stats.runs, base: st.base || 0, force });
  if (r.status === 409) { ask(r); return; }
  if (!r.ok) { say(r.error || 'Sichern fehlgeschlagen'); return; }
  st.base = r.updated; st.localAt = save.savedAt || 0; st.mark = mark(save); lastUp = Date.now(); done();
}
function done() { st.syncedAt = Date.now(); keep(); say('Gesichert'); }
// Cloud-Stand übernehmen: alles neu laden (Bilder, Garderobe, Karte hängen am Spielstand)
function adopt(c) {
  let data; try { data = JSON.parse(c.data); } catch (_) { say('Cloud-Stand kaputt'); return; }
  setSave(data);   // normalize + persist
  st.base = c.updated; st.localAt = save.savedAt; st.mark = mark(save); st.syncedAt = Date.now(); keep();
  location.reload();
}

// Beide Stände zeigen und wählen lassen
function ask(c) {
  let cs; try { cs = summary(JSON.parse(c.data)); } catch (_) { say('Cloud-Stand kaputt'); return; }
  const ls = summary(save), when = t => (t ? new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–');
  const card = (title, s, btn, cls) => `<div class="cpick ${cls}"><h3>${title}</h3><p>Konto-Level <b>${s.level}</b> · <b>${s.runs}</b> Läufe</p><p>${s.gold.toLocaleString('de-DE')} Gold · ${s.gems} Juwelen</p><small>geändert ${when(s.at)}</small>${btn}</div>`;
  $('#cloudPanel').innerHTML = `<h2>Zwei Spielstände</h2><p class="note">In der Cloud liegt ein anderer Stand als auf diesem Gerät. Welcher soll bleiben? Der andere wird ersetzt.</p>
    <div class="cpicks">${card('Dieses Gerät', ls, '<button class="btn" data-keep="local">Diesen behalten</button>', '')}${card('Cloud', cs, '<button class="btn primary" data-keep="cloud">Cloud laden</button>', 'cloud')}</div>`;
  $('#cloudPick').hidden = false;
  $('#cloudPick').onclick = async e => {
    const b = e.target.closest('[data-keep]'); if (!b) return;
    $('#cloudPick').hidden = true;
    if (b.dataset.keep === 'cloud') adopt(c);
    else { busy = true; try { await upload(true); } catch (_) { say('Keine Verbindung'); } finally { busy = false; } }
  };
  say('Wartet auf deine Wahl');
}

// Nach dem Lauf (gebündelt) und beim Verlassen sichern
function soon() {
  if (!st.token) return;
  clearTimeout(upT);
  upT = setTimeout(() => sync(), Math.max(2000, MIN_GAP - (Date.now() - lastUp)));
}
export function startCloud() {
  if (!cloudReady()) return;
  if (st.token) sync();
  on('runEnd', soon);   // soon() prüft selbst, ob angemeldet
  document.addEventListener('visibilitychange', () => { if (document.hidden && (save.savedAt || 0) > (st.localAt || 0)) sync(); });
}
export const saveNow = () => { persist(); return sync(); };
