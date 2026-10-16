// Event-Bus: Quests, Erfolge, Statistiken und Sim hängen sich hier ein,
// ohne die Spiellogik anzufassen.
// Ereignisse: runStart, runEnd, enemyKilled, playerHurt, levelUp, pickup, bossIntro, bossSpawn, bossPhase, bossDown, abilUse, autoChest
const handlers = new Map();

export function on(name, fn) {
  let a = handlers.get(name); if (!a) { a = []; handlers.set(name, a); }
  a.push(fn);
  return () => off(name, fn);
}
export function off(name, fn) {
  const a = handlers.get(name); if (!a) return;
  const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1);
}
// Ohne Zuhörer: die Vorschau im Entwicklungs-Baum spielt einen Mini-Lauf, der nichts zählen oder anzeigen darf
let quiet = 0;
export function unheard(fn) { quiet++; try { return fn(); } finally { quiet--; } }
export function emit(name, data) {
  if (quiet) return;
  const a = handlers.get(name); if (!a) return;
  for (const fn of a.slice()) fn(data);
}
