// Schnittstelle für Sim-Bot und Tests: window.GOBLIN
import * as events from './core/events.js';
import { joy, keys } from './core/input.js';
import { STEP, loopStats } from './core/loop.js';
import { RNG } from './core/rng.js';
import { persist, save, setSave } from './core/save.js';
import { go, sceneName } from './core/scenes.js';
import { STAGES } from './data/stages.js';
import { abilReady, doDash, useAbility } from './game/abilities.js';
import { applyChoice, autoChest, choose, genChoices } from './game/levelup.js';
import { endRun, newRun, update } from './game/run.js';
import { P, run } from './game/state.js';
import { dangerVec } from './game/hazards.js';
import { spawnEnemy } from './game/enemies.js';
import { hurt } from './game/combat.js';
import { ATTACKS, BOSSES } from './data/bosses.js';
import { ATK } from './game/boss.js';
import { ETYPES } from './data/enemies.js';
import { WEAPONS } from './data/weapons.js';
import { allLoaded, bgLoaded } from './scenes/boot.js';
import { PAGES, SPR, loadMinions } from './render/sprites.js';
import { M as MAP } from './ui/worldmap.js';
import { stressTest } from './stress.js';

const api = {
  STEP, loopStats, STAGES, events, joy, keys, RNG, MAP,
  stress: stressTest, persist, newRun, update, endRun, genChoices, applyChoice, autoChest, choose, doDash, useAbility, abilReady, go, setSave, loadMinions, SPR, dangerVec, spawnEnemy, ETYPES, WEAPONS, hurt, BOSSES, ATTACKS, ATK,
};
Object.defineProperties(api, {
  // Speicher der Bild-Flächen in Bytes (RGBA) und ihre Anzahl, für npm run perf
  canvasBytes: { value: () => Object.values(PAGES).flat().reduce((n, p) => n + p.c.width * p.c.height * 4, 0) },
  atlasPages: { value: () => Object.fromEntries(Object.entries(PAGES).map(([k, l]) => [k, l.length])) },
  run: { get: () => run }, allLoaded: { get: () => allLoaded() }, bgLoaded: { get: () => bgLoaded }, P: { get: () => P }, save: { get: () => save }, scene: { get: () => sceneName },
});
window.GOBLIN = api;
