// Szenen-Statemachine: boot → menu → run → results → menu
// Jede Szene: { enter(arg), exit(next), update(step), render(now, alpha, dt) }, alles optional.
const scenes = {};
export let scene = null, sceneName = '';

export function defineScene(name, s) { scenes[name] = s; }
export function go(name, arg) {
  const next = scenes[name];
  if (!next) throw new Error('Unbekannte Szene: ' + name);
  if (scene && scene.exit) scene.exit(name);
  scene = next; sceneName = name;
  if (scene.enter) scene.enter(arg);
}
