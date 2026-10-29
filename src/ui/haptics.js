// Handy (PLAN.md Phase 15): Vibration bei Treffer, Level-Up, Boss und Laufende, Bildschirm im Lauf anlassen.
// Beides über Web-Schnittstellen (navigator.vibrate, Screen Wake Lock); die APK braucht dafür nur VIBRATE im Manifest.
import { dev } from '../core/device.js';
import { on } from '../core/events.js';
import { run } from '../game/state.js';
import { rumble } from '../core/gamepad.js';

const touch = () => !document.body.classList.contains('pc');
function buzz(p) {
  if (!dev.vibrate) return;
  rumble(Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p);   // Controller rüttelt (PC und Handy)
  if (!touch() || !navigator.vibrate) return;
  try { navigator.vibrate(p); } catch (_) { /* ohne Berechtigung oder vor der ersten Berührung */ }
}
// Treffer nur am eigenen Goblin (im Koop ist beim Ereignis der getroffene aktiv)
on('playerHurt', () => { if (run && run.pi === run.me) buzz(25); });
on('levelUp', k => buzz(k === 'chest' ? [30, 40, 30] : 35));
on('bossSpawn', () => buzz([70, 50, 140]));
on('runEnd', r => buzz(r && r.win ? [40, 40, 40, 40, 80] : 220));

// Bildschirm anlassen, solange ein Lauf läuft (geht beim Wechsel in den Hintergrund verloren → beim Zurückkommen neu)
let lock = null;
export async function keepAwake(on) {
  try {
    if (on && dev.wake && touch() && !lock && navigator.wakeLock && !document.hidden) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if ((!on || !dev.wake) && lock) { const l = lock; lock = null; await l.release(); }
  } catch (_) { lock = null; /* nicht erlaubt (z. B. Akkusparmodus des Geräts) */ }
}
on('runStart', () => keepAwake(true));
on('runEnd', () => keepAwake(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden && run && !run.over) keepAwake(true); });
