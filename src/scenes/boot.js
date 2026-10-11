import { defineScene, go } from '../core/scenes.js';
import { save } from '../core/save.js';
import { $ } from '../core/util.js';
import { icon } from '../render/icons.js';
import { loadAssets } from '../render/sprites.js';
import { setMusic, setMute } from '../ui/settings.js';

defineScene('boot', {
  async enter() {
    await loadAssets();
    if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch (e) {} }
    document.querySelectorAll('[data-icon]').forEach(im => { im.src = icon(im.dataset.icon); });
    setMute(save.settings.mute); setMusic(save.settings.musicOff);
    $('#loading').hidden = true;
    go('menu');
  },
  render() {},
});
