// Cloud-Sync (PLAN.md Phase 8): Spielstand über den Worker auf goblin.node-wave.org (cloud/) sichern.
// Anmeldung mit Google („Sign in with Google“ liefert ein ID-Token, der Worker prüft es und gibt einen
// eigenen Sitzungsschlüssel). Lokal bleibt der Spielstand die Arbeitskopie; abgeglichen wird beim Start,
// nach jedem Lauf und beim Verlassen. Ist der Cloud-Stand anderswo weitergespielt worden UND hat sich
// auch hier etwas getan, wird gefragt – nie still überschrieben.
import { on } from './core/events.js';
import { sceneName } from './core/scenes.js';
import { defaults, persist, save, setSave } from './core/save.js';
import { $ } from './core/util.js';

// Client-ID der Webanwendung aus der Google Cloud Console (öffentlich)
export const GOOGLE_CLIENT_ID = '207037584180-cu0m43pkkn8uuo2lkg65ijpqc3t9bd0h.apps.googleusercontent.com';
// Worker (cloud/, goblin.node-wave.org) ist live
const LIVE = true;
const HOST = 'https://goblin.node-wave.org';
// ?cloudtest: lokal gegen `npm run dev` in cloud/ (Port 8787) mit Test-Anmeldung ohne Google
const TEST = /[?&]cloudtest\b/.test(location.search);
export const API = location.origin === HOST || location.port === '8787' ? '' : HOST;
const KEY = 'goblinio_cloud', MIN_GAP = 30e3;
// exe/APK: dort geht „Sign in with Google“ nicht (kein echter Web-Ursprung) → App zeigt einen Code, den man auf
// goblin.node-wave.org/verbinden (Seite mit ?verbinden) nach der Google-Anmeldung eingibt.
// ?cloudtest=<name>&code: diesen Weg im Browser testen
const useCode = !!window.__TAURI__ || (TEST && /[?&]code\b/.test(location.search));
const linkMode = !useCode && /[?&]verbinden\b/.test(location.search);
let linking = linkMode;   // solange das Verbinden-Fenster offen ist, den Spielstand dieses Browsers nicht anfassen

// token, name, picture, acct (Konto-Kennung); base = updated des zuletzt gesehenen Cloud-Stands; localAt = savedAt beim letzten Abgleich;
// mark = Fortschritt beim letzten Abgleich (Läufe, Konto-Level, Gold, Juwelen)
let st = {};
try { st = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { st = {}; }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) { /* privat/voll */ } };
// Wem gehört der Spielstand auf diesem Gerät? { acct, name, at } (at = savedAt beim letzten Abgleich); fehlt = Gast.
// Bleibt beim Abmelden durch abgelaufene Sitzung erhalten, damit ein anderes Konto den Stand nie übernimmt (kein Verdoppeln).
const OWNER = 'goblinio_owner';
const owner = () => { try { return JSON.parse(localStorage.getItem(OWNER)); } catch (_) { return null; } };
const setOwner = o => { try { if (o) localStorage.setItem(OWNER, JSON.stringify(o)); else localStorage.removeItem(OWNER); } catch (_) { /* privat/voll */ } };
const claim = () => setOwner({ acct: st.acct, name: st.name, at: save.savedAt || 0 });
const unsaved = () => { const o = owner(); return !!o && (save.savedAt || 0) > o.at && !fresh(save); };
let busy = false, lastUp = 0, upT = 0, status = '', onChange = () => {};
export const cloud = { get user() { return st.token ? { name: st.name, picture: st.picture } : null; }, get status() { return status; }, get syncedAt() { return st.syncedAt || 0; } };
export const cloudReady = () => TEST || (LIVE && !!GOOGLE_CLIENT_ID);
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
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const panel = html => { $('#cloudPanel').innerHTML = html; $('#cloudPick').hidden = false; };
const closePanel = () => { $('#cloudPick').hidden = true; $('#cloudPick').onclick = null; };
// Rückfrage im Cloud-Fenster; buttons: [[wert, text, klasse]] → Promise mit dem Wert
function choose(title, text, buttons) {
  panel(`<h2>${title}</h2><p class="note">${text}</p><div class="cbtns">${buttons.map(([v, t, c]) => `<button class="btn ${c || ''}" data-ch="${v}">${t}</button>`).join('')}</div>`);
  return new Promise(res => { $('#cloudPick').onclick = e => { const b = e.target.closest('[data-ch]'); if (b) { closePanel(); res(b.dataset.ch); } }; });
}

// Google-Kontoauswahl im Popup (Token-Client von Google Identity Services): eigener Knopf, fragt immer nach dem Konto
let gsi = null;
function loadGsi() {
  return gsi || (gsi = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(window.google); s.onerror = () => { gsi = null; rej(new Error('Google nicht erreichbar')); };
    document.head.append(s);
  }));
}
// Liefert eine Funktion, die (im Klick!) die Kontoauswahl öffnet und fn mit { accessToken } aufruft
async function googlePicker(fn) {
  if (TEST) return () => fn({ accessToken: 'dev:' + (new URLSearchParams(location.search).get('cloudtest') || 'test') });
  const g = await loadGsi();
  const client = g.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID, scope: 'openid email profile', prompt: 'select_account',
    callback: r => { if (r.access_token) fn({ accessToken: r.access_token }); else say('Anmeldung abgebrochen'); },
    error_callback: e => say(e && e.type === 'popup_closed' ? 'Anmeldung abgebrochen' : 'Google-Fenster ging nicht auf'),
  });
  return () => client.requestAccessToken();
}
const signBtn = '<button class="btn small primary gbtn"><span class="glogo" aria-hidden="true">G</span>Mit Google anmelden</button>';
// Anmelde-Knopf in el (Profil): im Browser Kontoauswahl im Popup, in exe/APK über die Anmeldeseite im Browser
export async function renderSignIn(el) {
  if (!cloudReady()) return;
  el.innerHTML = signBtn;
  if (useCode) { el.firstChild.onclick = () => codeLogin(); return; }
  try { const open = await googlePicker(login); el.firstChild.onclick = open; } catch (e) { el.textContent = 'Google ist gerade nicht erreichbar.'; }
}
async function login(cred) {
  say('Melde an …');
  try {
    const r = await api('POST', '/api/login', cred);
    if (!r.ok) { say(r.error || 'Anmeldung fehlgeschlagen'); return; }
    await signedIn(r);
  } catch (e) { say('Keine Verbindung'); }
}
async function signedIn(r) {
  st = { token: r.token, name: r.name, picture: r.picture, acct: r.acct, base: 0, localAt: 0 }; keep();
  await takeDevice();
  await sync();
}

// ---------- Anmeldung in exe/APK ----------
// Die App holt einen Code und öffnet die Anmeldeseite im Browser (goblin.node-wave.org/?verbinden=CODE). Dort wählt man
// sein Google-Konto, die Seite springt per goblinio:// zurück ins Spiel, und die App holt ihre Sitzung ab.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const openUrl = u => (window.__TAURI__ && window.__TAURI__.opener ? window.__TAURI__.opener.openUrl(u) : window.open(u, '_blank'));
// Spielfenster der PC-App (minimize/unminimize/setFocus); im Browser und am Handy ohne Wirkung
const appWindow = fn => { try { const w = window.__TAURI__ && window.__TAURI__.window; if (w && !/Android/i.test(navigator.userAgent)) w.getCurrentWindow()[fn]().catch(() => {}); } catch (_) { /* egal */ } };
let codeRun = null;
async function codeLogin() {
  if (codeRun) return;
  say('Öffne die Anmeldung …');
  let s; try { s = await api('POST', '/api/link/start'); } catch (_) { say('Keine Verbindung'); return; }
  if (!s.ok) { say(s.error || 'Geht gerade nicht'); return; }
  const run = codeRun = { stop: false }, until = Date.now() + s.expires * 1000;
  // echte Anmeldung: /anmelden leitet direkt zu Googles Kontoauswahl (kein Spiel im Hintergrund); im Test die Seite im Spiel
  const page = TEST ? location.origin + '/?cloudtest=' + encodeURIComponent(new URLSearchParams(location.search).get('cloudtest') || 'test') + '&verbinden=' + s.code.replace('-', '')
    : HOST + '/anmelden?code=' + s.code.replace('-', '');
  const close = () => { run.stop = true; codeRun = null; closePanel(); };
  panel(`<h2>Anmelden im Browser</h2><p class="note">Im Browser hat sich die Anmeldung geöffnet. Wähle dort dein Google-Konto – danach geht es von selbst hierher zurück.</p>
    <div class="cbtns"><button class="btn primary" data-code="open">Nochmal öffnen</button><button class="btn" data-code="cancel">Abbrechen</button></div>
    <small class="cwait">Wartet auf die Anmeldung … · Anderes Gerät? ${s.url.replace(/^https?:\/\//, '')} mit Code <b>${s.code}</b></small>`);
  $('#cloudPick').onclick = e => { const b = e.target.closest('[data-code]'); if (!b) return; if (b.dataset.code === 'open') openUrl(page); else { close(); say(''); } };
  say('Wartet auf die Anmeldung …');
  openUrl(page); appWindow('minimize');   // am PC: Spiel aus dem Weg, damit der Browser vorn ist
  while (!run.stop && Date.now() < until) {
    await sleep(s.interval * 1000);
    if (run.stop) return;
    let r; try { r = await api('POST', '/api/link/poll', { link: s.link }); } catch (_) { continue; }   // offline: weiter warten
    if (r.pending) continue;
    close(); appWindow('unminimize'); appWindow('setFocus');
    if (!r.ok) { say(r.error || 'Anmeldung fehlgeschlagen'); return; }
    await signedIn(r);
    return;
  }
  if (!run.stop) { close(); say('Abgelaufen – bitte nochmal'); }
}
// Anmeldeseite für die App (?verbinden=CODE): eigene Google-Anmeldung, unabhängig davon, wer hier auf der Webseite angemeldet ist
async function linkPanel(msg = '') {
  const pre = (new URLSearchParams(location.search).get('verbinden') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const back = () => { closePanel(); linking = false; history.replaceState(null, '', location.pathname); if (st.token) sync(); };
  panel(`<h2>Bei Goblin.io anmelden</h2><p class="note">Melde dich an, um in der App (PC oder Handy) mit deinem Spielstand zu spielen.</p>
    ${pre.length === 8 ? '' : '<label class="note">Code aus der App<br><input id="linkCode" class="ccode" maxlength="9" autocomplete="off" spellcheck="false" aria-label="Code"></label>'}
    <div class="cbtns" id="linkGo">${signBtn.replace('small ', '')}</div><small class="cwait" id="linkMsg">${esc(msg)}</small>
    <div class="cbtns"><button class="btn ghost small" data-l="back">Abbrechen</button></div>`);
  $('#cloudPick').onclick = e => { if (e.target.closest('[data-l]')) back(); };
  let open; try { open = await googlePicker(confirmLink); } catch (_) { $('#linkMsg').textContent = 'Google ist gerade nicht erreichbar.'; return; }
  $('#linkGo button').onclick = open;
  async function confirmLink(cred) {
    $('#linkMsg').textContent = 'Melde an …';
    const code = pre.length === 8 ? pre : ($('#linkCode') ? $('#linkCode').value : '');
    let r; try { r = await api('POST', '/api/link/confirm', { code, ...cred }); } catch (_) { linkPanel('Keine Verbindung'); return; }
    if (!r.ok) { linkPanel(r.error || 'Hat nicht geklappt'); return; }
    panel('<h2>Angemeldet!</h2><p class="note">Zurück zum Spiel – die App ist jetzt angemeldet. Diese Seite kannst du schließen.</p><div class="cbtns"><button class="btn primary" data-l="app">Zurück zum Spiel</button></div>');
    $('#cloudPick').onclick = e => { if (e.target.closest('[data-l]')) toApp(); };
    toApp();
  }
}
// goblinio:// holt die App nach vorn (Tauri deep-link); auf Android über einen intent-Link
function toApp() {
  if (TEST) return;
  location.href = /Android/i.test(navigator.userAgent) ? 'intent://angemeldet#Intent;scheme=goblinio;package=com.einfabo.goblinio;end' : 'goblinio://angemeldet';
}

// ---------- Abmelden, zurücksetzen, Konto löschen ----------
// Neues Spiel auf diesem Gerät (der Stand gehört dann niemandem), danach alles neu laden
function freshStart() { setOwner(null); setSave(defaults()); location.reload(); }
async function signOut() {
  try { await api('POST', '/api/logout'); } catch (_) { /* offline: Schlüssel trotzdem vergessen */ }
  st = {}; keep();
}
// Abmelden: vorher sichern; der Stand bleibt in der Cloud, auf dem Gerät beginnt ein neues Spiel.
// So kann man denselben Fortschritt nicht in ein zweites Konto mitnehmen.
export async function logout() {
  if (!st.token) return;
  if ((await choose('Abmelden?', 'Dein Spielstand bleibt in der Cloud. Auf diesem Gerät beginnt danach ein neues Spiel – melde dich wieder an, um weiterzuspielen.',
    [['ok', 'Abmelden', 'primary'], ['no', 'Abbrechen']])) !== 'ok') return;
  await sync();
  if (!$('#cloudPick').hidden && !kicked) return;   // Konflikt-Auswahl ist offen
  if (unsaved() && (await choose('Nicht alles gesichert', 'Der neueste Fortschritt ist noch nicht in der Cloud (keine Verbindung?). Wenn du dich jetzt abmeldest, ist er weg.',
    [['no', 'Angemeldet bleiben', 'primary'], ['ok', 'Trotzdem abmelden']])) !== 'ok') return;
  await signOut(); freshStart();
}
// Spielstand zurücksetzen: lokal und (angemeldet) auch in der Cloud
export async function resetSave() {
  const txt = 'Konto-Level, Gold, Juwelen, Karten, Fähigkeiten und Welten – alles fängt von vorn an.' + (st.token ? ' Auch der Stand in der Cloud wird ersetzt.' : '') + ' Das lässt sich nicht rückgängig machen.';
  if ((await choose('Spielstand zurücksetzen?', txt, [['no', 'Abbrechen', 'primary'], ['ok', 'Alles löschen', 'danger']])) !== 'ok') return;
  setSave(defaults());
  if (st.token) { try { await upload(true); } catch (_) { /* offline: der nächste Abgleich lädt den neuen Stand hoch */ } }
  location.reload();
}
// Konto löschen (auch Pflicht für den Play Store): Cloud-Stand und alle Anmeldungen weg, Gerät fängt neu an
export async function deleteAccount() {
  if (!st.token) return;
  if ((await choose('Konto löschen?', 'Dein Spielstand in der Cloud und alle Anmeldungen (auch auf anderen Geräten) werden endgültig gelöscht. Auf diesem Gerät beginnt ein neues Spiel.',
    [['no', 'Abbrechen', 'primary'], ['ok', 'Endgültig löschen', 'danger']])) !== 'ok') return;
  let r; try { r = await api('DELETE', '/api/account'); } catch (_) { say('Keine Verbindung – nichts gelöscht'); return; }
  if (!r.ok) { say(r.error || 'Löschen fehlgeschlagen'); return; }
  st = {}; keep(); freshStart();
}

// ---------- Abgleich ----------
export async function sync() {
  // nie mitten im Lauf: kostet Zeit auf dem Haupt-Thread und ein übernommener Cloud-Stand lädt die Seite neu.
  // Nach dem Lauf (runEnd → soon) kommt der Abgleich ohnehin.
  if (!st.token || busy || linking || kicked || sceneName === 'run') return;
  busy = true; say('Gleiche ab …');
  try {
    const c = await api('GET', '/api/save');
    if (!c.ok) { if (st.token) say(c.error || 'Abgleich fehlgeschlagen'); return; }
    if (c.acct && c.acct !== st.acct) { st.acct = c.acct; keep(); }
    if (c.active === false) { elsewhere(c.activeName); return; }
    // Der Stand hier gehört einem anderen Konto: nie hochladen, sondern den Stand dieses Kontos holen (oder neu anfangen)
    const o = owner();
    if (o && st.acct && o.acct !== st.acct) { await switchAccount(c, o); return; }
    if (!c.data) { await upload(); return; }
    const cloudMoved = c.updated > (st.base || 0), localMoved = (save.savedAt || 0) > (st.localAt || 0);
    if (!cloudMoved) { if (localMoved) await upload(); else done(); return; }
    // Cloud wurde woanders weitergespielt: übernehmen, wenn hier nichts gespielt wurde (oder alles neu ist)
    if (!localMoved || fresh(save) || mark(save) === st.mark) { adopt(c); return; }
    ask(c);
  } catch (e) { say('Keine Verbindung – es wird lokal gespeichert'); } finally { busy = false; }
}
async function switchAccount(c, o) {
  if (unsaved()) {
    say('Wartet auf deine Wahl');
    const pick = await choose('Anderes Konto', `Auf diesem Gerät liegt ungesicherter Fortschritt von <b>${esc(o.name || 'einem anderen Konto')}</b>. Wenn du mit <b>${esc(st.name || 'diesem Konto')}</b> weiterspielst, geht er verloren. Melde dich besser erst mit dem alten Konto an, damit er gesichert wird.`,
      [['back', 'Abmelden', 'primary'], ['go', 'Trotzdem wechseln', 'danger']]);
    if (pick !== 'go') { await signOut(); say(''); return; }
  }
  if (c.data) { adopt(c); return; }
  // Konto ist neu: frisch anfangen und das hochladen
  setSave(defaults()); st.base = 0;
  try { await upload(true); } catch (_) { /* offline: kommt beim nächsten Abgleich */ }
  claim(); location.reload();
}
async function upload(force = false) {
  const r = await api('PUT', '/api/save', { data: JSON.stringify(save), level: save.profile.level, runs: save.stats.runs, base: st.base || 0, force });
  if (r.status === 409) { ask(r); return; }
  if (r.status === 423) { elsewhere(r.activeName); return; }
  if (!r.ok) { say(r.error || 'Sichern fehlgeschlagen'); return; }
  st.base = r.updated; st.localAt = save.savedAt || 0; st.mark = mark(save); lastUp = Date.now(); done();
}
function done() { st.syncedAt = Date.now(); keep(); if (st.acct) claim(); say('Gesichert'); }
// Cloud-Stand übernehmen: alles neu laden (Bilder, Garderobe, Karte hängen am Spielstand)
function adopt(c) {
  let data; try { data = JSON.parse(c.data); } catch (_) { say('Cloud-Stand kaputt'); return; }
  setSave(data);   // normalize + persist
  st.base = c.updated; st.localAt = save.savedAt; st.mark = mark(save); st.syncedAt = Date.now(); keep();
  if (st.acct) claim();
  location.reload();
}

// Beide Stände zeigen und wählen lassen
function ask(c) {
  let cs; try { cs = summary(JSON.parse(c.data)); } catch (_) { say('Cloud-Stand kaputt'); return; }
  const ls = summary(save), when = t => (t ? new Date(t).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–');
  const card = (title, s, btn, cls) => `<div class="cpick ${cls}"><h3>${title}</h3><p>Konto-Level <b>${s.level}</b> · <b>${s.runs}</b> Läufe</p><p>${s.gold.toLocaleString('de-DE')} Gold · ${s.gems} Juwelen</p><small>geändert ${when(s.at)}</small>${btn}</div>`;
  panel(`<h2>Zwei Spielstände</h2><p class="note">In der Cloud liegt ein anderer Stand als auf diesem Gerät. Welcher soll bleiben? Der andere wird ersetzt.</p>
    <div class="cpicks">${card('Dieses Gerät', ls, '<button class="btn" data-keep="local">Diesen behalten</button>', '')}${card('Cloud', cs, '<button class="btn primary" data-keep="cloud">Cloud laden</button>', 'cloud')}</div>`);
  $('#cloudPick').onclick = async e => {
    const b = e.target.closest('[data-keep]'); if (!b) return;
    closePanel();
    if (b.dataset.keep === 'cloud') adopt(c);
    else { busy = true; try { await upload(true); } catch (_) { say('Keine Verbindung'); } finally { busy = false; } }
  };
  say('Wartet auf deine Wahl');
}

// ---------- Nur ein Gerät gleichzeitig (wie Clash Royale) ----------
// Wer das Spiel öffnet oder sich anmeldet, wird das aktive Gerät. Die anderen dürfen nicht mehr speichern und zeigen
// „Du spielst gerade auf …“, bis man dort „Hier weiterspielen“ wählt – dann kommt der neueste Stand aus der Cloud.
let kicked = false;
const devName = () => (window.__TAURI__ ? (/Android/i.test(navigator.userAgent) ? 'Handy-App' : 'PC-App') : (/Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Browser am Handy' : 'Browser am PC'));
async function takeDevice() { try { await api('POST', '/api/claim', { name: devName() }); kicked = false; } catch (_) { /* offline: der Server sperrt dann auch nichts */ } }
function elsewhere(name) {
  if (kicked) return;
  kicked = true; say('Auf einem anderen Gerät aktiv');
  const lost = unsaved() ? ' Was du hier seit dem letzten Sichern gespielt hast, wird nicht übernommen.' : '';
  panel(`<h2>Du spielst woanders</h2><p class="note">Dein Konto ist gerade auf <b>${esc(name || 'einem anderen Gerät')}</b> aktiv. Damit nie zwei Spielstände entstehen, spielt immer nur ein Gerät.${lost}</p>
    <div class="cbtns"><button class="btn primary" data-dev="here">Hier weiterspielen</button></div>`);
  $('#cloudPick').onclick = async e => {
    if (!e.target.closest('[data-dev]')) return;
    e.target.closest('[data-dev]').disabled = true;
    await takeDevice();
    if (kicked) { e.target.closest('[data-dev]').disabled = false; say('Keine Verbindung'); return; }
    closePanel();
    // neuesten Stand holen: das andere Gerät hat weitergespielt
    let c; try { c = await api('GET', '/api/save'); } catch (_) { say('Keine Verbindung'); return; }
    if (c.ok && c.data && c.updated !== st.base) adopt(c); else sync();
  };
}
// Ist dieses Gerät noch aktiv? (beim Zurückkommen und alle 45 s im Menü, nie im Lauf)
async function checkActive() {
  if (!st.token || kicked || linking || sceneName === 'run' || document.hidden) return;
  try { const a = await api('GET', '/api/active'); if (a.ok && a.active === false) elsewhere(a.activeName); } catch (_) { /* offline */ }
}

// Nach dem Lauf (gebündelt) und beim Verlassen sichern
function soon() {
  if (!st.token) return;
  clearTimeout(upT);
  upT = setTimeout(() => (sceneName === 'run' ? null : sync()), Math.max(2000, MIN_GAP - (Date.now() - lastUp)));
}
export function startCloud() {
  if (!cloudReady()) return;
  if (linkMode) linkPanel();
  else if (st.token) takeDevice().then(sync);   // Spiel geöffnet: dieses Gerät ist jetzt das aktive
  on('runEnd', soon);   // soon() prüft selbst, ob angemeldet
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if ((save.savedAt || 0) > (st.localAt || 0)) sync(); } else checkActive();
  });
  setInterval(checkActive, 45e3);
}
export const saveNow = () => { persist(); return sync(); };
