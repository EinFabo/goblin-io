// Schnittstelle für Sim-Bot und Tests: window.GOBLIN
import * as events from './core/events.js';
import { joy, keys } from './core/input.js';
import { STEP } from './core/loop.js';
import { RNG } from './core/rng.js';
import { save, setSave } from './core/save.js';
import { go, sceneName } from './core/scenes.js';
import { STAGES } from './data/stages.js';
import { doDash, doUlt, startMech } from './game/abilities.js';
import { applyChoice, genChoices } from './game/levelup.js';
import { newRun, update } from './game/run.js';
import { P, run } from './game/state.js';

const api = {
  STEP, STAGES, events, joy, keys, RNG,
  newRun, update, genChoices, applyChoice, doDash, doUlt, startMech, go, setSave,
};
Object.defineProperties(api, {
  run: { get: () => run }, P: { get: () => P }, save: { get: () => save }, scene: { get: () => sceneName },
});
window.GOBLIN = api;
