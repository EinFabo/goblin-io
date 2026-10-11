import { Music } from '../core/music.js';
import { defineScene } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { setRun } from '../game/state.js';
import { renderMenuScene } from '../render/menu-scene.js';
import { hideOverlays, showScreen } from '../ui/menus.js';

defineScene('menu', {
  enter(screen = '#menu') {
    setRun(null, null); Music.stop();
    $('#hud').hidden = true; $('#ctrl').hidden = true; $('#hint').hidden = true;
    hideOverlays(); showScreen(screen);
  },
  render(now) { renderMenuScene(now / 1000); },
});
