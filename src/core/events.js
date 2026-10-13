// Event-Bus: Quests, Erfolge, Statistiken und Sim hängen sich hier ein,
// ohne die Spiellogik anzufassen.
// Ereignisse: runStart, runEnd, enemyKilled, playerHurt, levelUp, pickup, bossIntro, bossSpawn, bossPhase, bossDown
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
export function emit(name, data) {
  const a = handlers.get(name); if (!a) return;
  for (const fn of a.slice()) fn(data);
}
