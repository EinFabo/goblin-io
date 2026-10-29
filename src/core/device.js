// Geräte-Einstellungen (PLAN.md Phase 15): gelten nur für dieses Gerät und liegen im lokalen Speicher, nicht im
// Spielstand – sonst käme z. B. der Akkusparmodus vom Handy über die Cloud auf den PC. Ton an/aus, Lautstärke von
// Musik und Effekten, Wackeln, Schadenszahlen und die Handy-Knöpfe (links, Größe) bleiben wie bisher in save.settings.
const KEY = 'goblinio_device';

// Tastenbelegung: je Aktion bis zu zwei Tasten (KeyboardEvent.code). Esc pausiert immer, Ziffern wählen Karten.
export const ACTIONS = [
  ['up', 'Hoch'], ['down', 'Runter'], ['left', 'Links'], ['right', 'Rechts'],
  ['dash', 'Rolle'], ['sprint', 'Sprint'], ['ab0', 'Fähigkeit 1'], ['ab1', 'Fähigkeit 2'], ['pause', 'Pause'],
];
export const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  dash: ['Space', null], sprint: ['ShiftLeft', 'ShiftRight'], ab0: ['KeyQ', null], ab1: ['KeyE', 'KeyF'], pause: ['KeyP', null],
};
const CHOICES = {
  render: [.5, .75, 1],              // Renderauflösung (Anteil der Bildschirmpixel)
  fps: [30, 60, 0],                  // Bildrate begrenzen, 0 = so oft der Bildschirm will
  winSize: ['1280x720', '1600x900', '1920x1080'],   // Fenstergröße der exe
  joy: ['free', 'fixed'],            // Joystick dort, wo man tippt, oder fest links unten
  joySens: [.75, 1, 1.35],           // Empfindlichkeit: kürzer ziehen für volles Tempo
  btnAlpha: [1, .75, .5],            // Sichtbarkeit der Handy-Knöpfe
};
const DEF = {
  master: 1, uiVol: 1, bgMute: true, winSize: '1280x720', render: 1, fps: 0, showFps: false, uiScale: 1,
  keys: DEFAULT_KEYS, vibrate: true, saver: false, wake: true, joy: 'free', joySens: 1, btnAlpha: 1, calm: false,
};
export const UI_SCALE = [.8, 1.5];

// Gespeicherten Stand prüfen: unbekannte oder kaputte Werte fallen auf den Standard zurück
export function cleanDevice(d) {
  d = d && typeof d === 'object' ? d : {};
  const num = (v, lo, hi, def) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, +v)) : def);
  const bool = (v, def) => (typeof v === 'boolean' ? v : def);
  const pick = k => (CHOICES[k].includes(d[k]) ? d[k] : DEF[k]);
  const keys = {};
  for (const [a] of ACTIONS) {
    const k = d.keys && Array.isArray(d.keys[a]) ? d.keys[a] : DEFAULT_KEYS[a];
    keys[a] = [0, 1].map(i => (typeof k[i] === 'string' && k[i] !== 'Escape' && k[i].length < 24 ? k[i] : null));
    if (!keys[a][0] && !keys[a][1]) keys[a] = [...DEFAULT_KEYS[a]];   // ganz ohne Taste ginge die Aktion nicht mehr
  }
  return {
    master: num(d.master, 0, 1, 1), uiVol: num(d.uiVol, 0, 1, 1), bgMute: bool(d.bgMute, true),
    winSize: pick('winSize'), render: pick('render'), fps: pick('fps'), showFps: bool(d.showFps, false),
    uiScale: Math.round(num(d.uiScale, UI_SCALE[0], UI_SCALE[1], 1) * 20) / 20, keys,
    vibrate: bool(d.vibrate, true), saver: bool(d.saver, false), wake: bool(d.wake, true),
    joy: pick('joy'), joySens: pick('joySens'), btnAlpha: pick('btnAlpha'), calm: bool(d.calm, false),
  };
}
function load() { try { return cleanDevice(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (_) { return cleanDevice({}); } }
export const dev = load();
export function saveDevice() { try { localStorage.setItem(KEY, JSON.stringify(dev)); } catch (_) { /* privater Modus o. Ä. */ } }
export const CHOICE = CHOICES;

// Wirksame Werte: der Akkusparmodus begrenzt Bildrate und Auflösung
export const fpsCap = () => (dev.saver ? 30 : dev.fps);
export const renderScale = () => (dev.saver ? Math.min(dev.render, .75) : dev.render);

// Tastenbelegung
export const isKey = (action, code) => !!code && dev.keys[action].includes(code);
// Taste code auf Aktion/Feld legen. Hatte eine andere Aktion die Taste, bekommt sie die bisherige Taste dieses Feldes
// (Tausch). Leeren (code = null) geht nicht für die letzte Taste einer Aktion. Gibt zurück, ob sich etwas geändert hat.
export function bindKey(action, slot, code) {
  const old = dev.keys[action][slot];
  if (!code && !dev.keys[action][1 - slot]) return false;
  if (code === old) return false;
  // (war das Feld leer und hätte die andere Aktion dann keine Taste mehr, bleibt die Belegung wie sie ist)
  for (const [a] of ACTIONS) if (code && a !== action && dev.keys[a].includes(code) && !old && !dev.keys[a].some(c => c && c !== code)) return false;
  if (code) for (const [a] of ACTIONS) dev.keys[a].forEach((c, i) => { if (c === code && !(a === action && i === slot)) dev.keys[a][i] = old; });
  dev.keys[action][slot] = code;
  saveDevice();
  return true;
}
export function resetKeys() { dev.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); saveDevice(); }
// Anzeigename einer Taste (KeyboardEvent.code)
const NAMES = { Space: 'Leer', ShiftLeft: 'Shift', ShiftRight: 'Shift rechts', ControlLeft: 'Strg', ControlRight: 'Strg rechts', AltLeft: 'Alt', AltRight: 'Alt Gr',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫', CapsLock: 'Feststell',
  Escape: 'Esc', Backquote: '^', Minus: 'ß', Equal: '´', BracketLeft: 'Ü', BracketRight: '+', Semicolon: 'Ö', Quote: 'Ä', Backslash: '#', Comma: ',', Period: '.', Slash: '-', IntlBackslash: '<' };
// Echte Beschriftung der Tastatur (deutsch: KeyY ist „Z“), wenn der Browser sie verrät (Chrome, WebView2)
let layout = null;
export async function loadLayout() {
  try { if (navigator.keyboard && navigator.keyboard.getLayoutMap) layout = await navigator.keyboard.getLayoutMap(); } catch (_) { /* nicht erlaubt */ }
}
export function keyName(code) {
  if (!code) return '–';
  if (NAMES[code]) return NAMES[code];
  const l = layout && layout.get(code);
  if (l && l.length === 1 && l.trim()) return l.toUpperCase();
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
// Beschriftung einer Aktion (erste belegte Taste), z. B. „Q“ für Fähigkeit 1
export const keyLabel = action => keyName(dev.keys[action][0] || dev.keys[action][1]);
