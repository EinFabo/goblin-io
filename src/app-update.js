// Auto-Update der App-Versionen (Tauri, src-tauri/). Im Browser gibt es kein window.__TAURI__ → nichts passiert.
// Windows: Updater-Plugin lädt den signierten Installer aus dem neuesten GitHub-Release (latest.json).
// Android: kein Updater-Plugin – neuestes Release über die GitHub-API ansehen und die APK im Browser öffnen,
// Android installiert sie dann über die alte (gleicher Schlüssel, höherer versionCode).
import { sceneName } from './core/scenes.js';

const REPO = 'EinFabo/goblin-io';

// "3.0.10" > "3.0.9"; Vorsilben wie "v" werden ignoriert
export function newer(a, b) {
  const p = s => String(s).replace(/^v/, '').split(/[.-]/).slice(0, 3).map(n => parseInt(n, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

function bar(version, label, act) {
  const el = document.createElement('div');
  el.id = 'updBar';
  el.innerHTML = `<span>Neue Version <b>${version}</b></span><button class="btn small primary"></button><button class="iconbtn" aria-label="Später">✕</button>`;
  const [go, later] = el.querySelectorAll('button');
  go.textContent = label;
  go.onclick = async () => {
    go.disabled = true; go.textContent = 'Lädt …';
    try { await act(); } catch (e) { console.error(e); go.disabled = false; go.textContent = 'Nochmal versuchen'; }
  };
  later.onclick = () => { el.remove(); clearInterval(t); };
  document.body.append(el);
  // im Lauf nicht über dem Spielfeld liegen
  const t = setInterval(() => { el.hidden = sceneName === 'run'; }, 500);
}

async function check() {
  const T = window.__TAURI__;
  if (!T) return;
  if (T.updater) {
    const u = await T.updater.check();
    if (u) bar(u.version, 'Jetzt aktualisieren', async () => { await u.downloadAndInstall(); await T.process.relaunch(); });
    return;
  }
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return;
  const rel = await r.json(), apk = (rel.assets || []).find(a => a.name.endsWith('.apk'));
  if (apk && newer(rel.tag_name, await T.app.getVersion())) {
    bar(rel.tag_name.replace(/^v/, ''), 'Herunterladen', () => T.opener.openUrl(apk.browser_download_url));
  }
}

export function startUpdateCheck() {
  // nach dem Start, damit das Laden des Spiels nicht wartet
  setTimeout(() => check().catch(e => console.warn('Update-Prüfung fehlgeschlagen', e)), 3000);
}
