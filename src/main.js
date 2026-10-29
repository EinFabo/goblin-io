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
import './ui/continue.js';
import './scenes/boot.js';
import './scenes/menu.js';
import './scenes/run.js';
import './scenes/results.js';
import './debug.js';
import { startPerf } from './perf.js';
import { startUpdateCheck } from './app-update.js';
import { startCloud } from './cloud.js';
import { startPlatform } from './ui/platform.js';
import './ui/haptics.js';
import { applyDevice } from './ui/settings.js';
import { loadLayout } from './core/device.js';

loadSave();
resize();
applyDevice();   // Geräte-Einstellungen (Phase 15): Oberflächengröße, Auflösung, Ton, Tasten
loadLayout().then(applyDevice);   // Tastennamen der echten Tastatur
go('boot');
startLoop();
if (/[?&]perf\b/.test(location.search)) startPerf();
startUpdateCheck();
startCloud();
startPlatform();
