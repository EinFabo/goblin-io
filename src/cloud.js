// Cloud-Sync (PLAN.md Phase 8): Spielstand über den Worker auf goblin.node-wave.org (cloud/) sichern.
// Anmeldung mit Google („Sign in with Google“ liefert ein ID-Token, der Worker prüft es und gibt einen
// eigenen Sitzungsschlüssel). Lokal bleibt der Spielstand die Arbeitskopie; abgeglichen wird beim Start,
// nach jedem Lauf und beim Verlassen. Ist der Cloud-Stand anderswo weitergespielt worden UND hat sich
// auch hier etwas getan, wird gefragt – nie still überschrieben.
import { on } from './core/events.js';
import { defaults, persist, save, setSave } from './core/save.js';
import { $ } from './core/util.js';

// Client-ID der Webanwendung aus der Google Cloud Console (öffentlich)
export const GOOGLE_CLIENT_ID = '207037584180-cu0m43pkkn8uuo2lkg65ijpqc3t9bd0h.apps.googleusercontent.com';
// Worker (cloud/, goblin.node-wave.org) ist live
const LIVE = true;
const HOST = 'https://goblin.node-wave.org';
// ?cloudtest: lokal gegen `npm run dev` in cloud/ (Port 8787) mit Test-Anmeldung ohne Google
const TEST = /[?&]cloudtest\b/.test(location.search);
const API = location.origin === HOST || location.port === '8787' ? '' : HOST;
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

let gsi = null;
function loadGsi() {
  return gsi || (gsi = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(window.google); s.onerror = () => { gsi = null; rej(new Error('Google nicht erreichbar')); };
    document.head.append(s);
  }));
}
// Google-Knopf in el zeichnen (Profil, App verbinden)
export async function renderSignIn(el) {
  if (!cloudReady()) return;
  if (useCode) { el.innerHTML = '<button class="btn small primary">Mit Google anmelden</button>'; el.firstChild.onclick = () => codeLogin(); return; }
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
    await signedIn(r);
  } catch (e) { say('Keine Verbindung'); }
}
async function signedIn(r) {
  st = { token: r.token, name: r.name, picture: r.picture, acct: r.acct, base: 0, localAt: 0 }; keep();
  // „App verbinden“: nur anmelden, den Spielstand dieses Browsers erst beim nächsten normalen Start abgleichen
  if (linking) { say(''); linkPanel(); return; }
  await sync();
}

// ---------- App verbinden (exe/APK) ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const openUrl = u => (window.__TAURI__ && window.__TAURI__.opener ? window.__TAURI__.opener.openUrl(u) : window.open(u, '_blank'));
let codeRun = null;
// In der App: Code holen, anzeigen und nachfragen, bis er im Browser bestätigt wurde
async function codeLogin() {
  if (codeRun) return;
  say('Hole Code …');
  let s; try { s = await api('POST', '/api/link/start'); } catch (_) { say('Keine Verbindung'); return; }
  if (!s.ok) { say(s.error || 'Geht gerade nicht'); return; }
  const run = codeRun = { stop: false }, until = Date.now() + s.expires * 1000, open = HOST + '/?verbinden=' + s.code.replace('-', '');
  const close = () => { run.stop = true; codeRun = null; closePanel(); };
  panel(`<h2>Mit Google anmelden</h2><ol class="csteps"><li>Öffne <b>${s.url.replace(/^https?:\/\//, '')}</b> im Browser – geht auch am Handy</li><li>Melde dich dort mit Google an</li><li>Gib diesen Code ein:<div class="ccode">${s.code}</div></li></ol>
    <div class="cbtns"><button class="btn primary" data-code="open">Im Browser öffnen</button><button class="btn" data-code="cancel">Abbrechen</button></div><small class="cwait">Wartet auf die Anmeldung …</small>`);
  $('#cloudPick').onclick = e => { const b = e.target.closest('[data-code]'); if (!b) return; if (b.dataset.code === 'open') openUrl(open); else { close(); say(''); } };
  say('Wartet auf die Anmeldung …');
  while (!run.stop && Date.now() < until) {
    await sleep(s.interval * 1000);
    if (run.stop) return;
    let r; try { r = await api('POST', '/api/link/poll', { link: s.link }); } catch (_) { continue; }   // offline: weiter warten
    if (r.pending) continue;
    close();
    if (!r.ok) { say(r.error || 'Anmeldung fehlgeschlagen'); return; }
    await signedIn(r);
    return;
  }
  if (!run.stop) { close(); say('Code abgelaufen – bitte nochmal'); }
}
// Im Browser (?verbinden=CODE): anmelden, dann den Code aus der App bestätigen
function linkPanel(msg = '') {
  const pre = (new URLSearchParams(location.search).get('verbinden') || '').toUpperCase();
  const back = () => { closePanel(); linking = false; history.replaceState(null, '', location.pathname); if (st.token) sync(); };
  if (!st.token) {
    panel(`<h2>App verbinden</h2><p class="note">Melde dich mit dem Google-Konto an, mit dem die App (PC oder Handy) spielen soll.</p><div id="linkSignIn"></div><small class="cwait">${esc(msg || status)}</small><div class="cbtns"><button class="btn" data-l="back">Schließen</button></div>`);
    renderSignIn($('#linkSignIn'));
  } else {
    panel(`<h2>App verbinden</h2><p class="note">Angemeldet als <b>${esc(st.name || 'Google-Konto')}</b>. Gib den Code ein, den die App anzeigt.</p><p class="note"><small>Nur Codes aus deiner eigenen App eingeben – wer den Code hat, spielt danach mit deinem Konto.</small></p>
      <form id="linkForm" class="cbtns"><input id="linkCode" class="ccode" maxlength="9" autocomplete="off" spellcheck="false" value="${esc(pre.length === 8 ? pre.slice(0, 4) + '-' + pre.slice(4) : pre)}" aria-label="Code"><button class="btn primary">Verbinden</button></form>
      <small class="cwait">${esc(msg)}</small><div class="cbtns"><button class="btn" data-l="back">Schließen</button></div>`);
    $('#linkForm').onsubmit = async e => {
      e.preventDefault();
      let r; try { r = await api('POST', '/api/link/confirm', { code: $('#linkCode').value }); } catch (_) { linkPanel('Keine Verbindung'); return; }
      if (!r.ok) { linkPanel(r.error || 'Hat nicht geklappt'); return; }
      panel('<h2>Verbunden!</h2><p class="note">Die App meldet sich jetzt selbst an. Du kannst dieses Fenster schließen.</p><div class="cbtns"><button class="btn primary" data-l="back">Weiterspielen</button></div>');
      $('#cloudPick').onclick = e => { if (e.target.closest('[data-l]')) back(); };
    };
  }
  $('#cloudPick').onclick = e => { if (e.target.closest('[data-l]')) back(); };
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
  if (!$('#cloudPick').hidden) return;   // Konflikt-Auswahl ist offen
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
  if (!st.token || busy || linking) return;
  busy = true; say('Gleiche ab …');
  try {
    const c = await api('GET', '/api/save');
    if (!c.ok) { if (st.token) say(c.error || 'Abgleich fehlgeschlagen'); return; }
    if (c.acct && c.acct !== st.acct) { st.acct = c.acct; keep(); }
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

// Nach dem Lauf (gebündelt) und beim Verlassen sichern
function soon() {
  if (!st.token) return;
  clearTimeout(upT);
  upT = setTimeout(() => sync(), Math.max(2000, MIN_GAP - (Date.now() - lastUp)));
}
export function startCloud() {
  if (!cloudReady()) return;
  if (linkMode) linkPanel();
  else if (st.token) sync();
  on('runEnd', soon);   // soon() prüft selbst, ob angemeldet
  document.addEventListener('visibilitychange', () => { if (document.hidden && (save.savedAt || 0) > (st.localAt || 0)) sync(); });
}
export const saveNow = () => { persist(); return sync(); };
