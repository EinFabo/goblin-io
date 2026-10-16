import { on } from '../core/events.js';
import { Music } from '../core/music.js';
import { defineScene } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { setRun } from '../game/state.js';
import { renderMenuScene } from '../render/menu-scene.js';
import { pauseBackground } from '../render/sprites.js';
import { hideOverlays, showScreen } from '../ui/menus.js';

// Titelmusik läuft im Menü; ohne Tipp/Taste gibt es noch keinen Ton (dann startet sie mit audioReady)
let off = null;
defineScene('menu', {
  enter(screen = '#menu') {
    pauseBackground(false);   // Magier der übrigen Welten dürfen weiterladen
    setRun(null, null); Music.stop();
    Music.boss = false; Music.hold = false; Music.world = 'title'; Music.part = Music.cur = 1; Music.start();   // Titel: voller Takt
    off = on('audioReady', () => Music.start());
    $('#hud').hidden = true; $('#ctrl').hidden = true; $('#hint').hidden = true;
    hideOverlays(); showScreen(screen);
  },
  exit() { if (off) off(); off = null; Music.stop(); },
  render(now) { renderMenuScene(now / 1000); },
});
