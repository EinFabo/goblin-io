// Schnittstelle für Sim-Bot und Tests: window.GOBLIN
import * as events from './core/events.js';
import { joy, keys } from './core/input.js';
import { STEP } from './core/loop.js';
import { RNG } from './core/rng.js';
import { save, setSave } from './core/save.js';
import { go, sceneName } from './core/scenes.js';
import { STAGES } from './data/stages.js';
import { abilReady, doDash, useAbility } from './game/abilities.js';
import { applyChoice, choose, genChoices } from './game/levelup.js';
import { endRun, newRun, update } from './game/run.js';
import { P, run } from './game/state.js';
import { dangerVec } from './game/hazards.js';
import { spawnEnemy } from './game/enemies.js';
import { hurt } from './game/combat.js';
import { ATTACKS, BOSSES } from './data/bosses.js';
import { ATK } from './game/boss.js';
import { ETYPES } from './data/enemies.js';
import { allLoaded } from './scenes/boot.js';
import { CACHE, SPR, loadMinions } from './render/sprites.js';
import { M as MAP } from './ui/worldmap.js';

const api = {
  STEP, STAGES, events, joy, keys, RNG, MAP,
  newRun, update, endRun, genChoices, applyChoice, choose, doDash, useAbility, abilReady, go, setSave, loadMinions, SPR, dangerVec, spawnEnemy, ETYPES, hurt, BOSSES, ATTACKS, ATK,
};
Object.defineProperties(api, {
  liveCanvases: { value: () => CACHE.filter(Boolean).length },
  run: { get: () => run }, allLoaded: { get: () => allLoaded() }, P: { get: () => P }, save: { get: () => save }, scene: { get: () => sceneName },
});
window.GOBLIN = api;
