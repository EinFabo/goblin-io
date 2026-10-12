// Goblin.io – Start: Module laden, Szenen anmelden, Schleife starten
import { startLoop } from './core/loop.js';
import { loadSave } from './core/save.js';
import { go } from './core/scenes.js';
import { resize } from './render/canvas.js';
import './core/input.js';
import './ui/sfx-ui.js';
import './ui/controls.js';
import './ui/menus.js';
import './ui/pause.js';
import './ui/levelup.js';
import './ui/armory.js';
import './ui/results.js';
import './scenes/boot.js';
import './scenes/menu.js';
import './scenes/run.js';
import './scenes/results.js';
import './debug.js';

loadSave();
resize();
go('boot');
startLoop();
