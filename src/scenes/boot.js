import { defineScene, go } from '../core/scenes.js';
import { save, stageUnlocked } from '../core/save.js';
import { $ } from '../core/util.js';
import { icon } from '../render/icons.js';
import { renderLoading } from '../render/loading-scene.js';
import { loadAssets, preloadAllMages } from '../render/sprites.js';
import { setMusic, setMute } from '../ui/settings.js';

// Für Bot und Tests: lädt beim ersten Abfragen alle übrigen Magier (im Spiel nie, sonst ruckelt das Menü)
let allPr = null;
export const allLoaded = () => allPr || (allPr = preloadAllMages());

// Tipps, die man beim Warten lesen kann
const TIPS = [
  'Durch ein Geschoss rollen gibt „Perfekt!“ und lädt deine Kill-Fähigkeiten.',
  'Glühende Stäbe heißen: gleich kommt ein Zauber. Aus dem Weg!',
  'Heiler zuerst erwischen, sonst stehen die anderen wieder auf.',
  'Fähigkeiten werden stärker, je öfter du sie benutzt. Skillpunkte verteilst du in der Rüstkammer.',
  'Gebannte Karten kommen in diesem Lauf nie wieder.',
  'Waffe auf Stufe 5 plus passendes Passiv ergibt eine Entwicklung.',
  'Mini-Bosse lassen eine Truhe fallen, aus der du dir etwas aussuchst.',
];

defineScene('boot', {
  async enter() {
    $('#loadTip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).catch(() => {}) : null;
    await loadAssets((p, txt) => { $('#loadFill').style.width = (p * 100).toFixed(0) + '%'; $('#loadMsg').textContent = txt; }, stageUnlocked);
    await fonts;
    document.querySelectorAll('[data-icon]').forEach(im => { im.src = icon(im.dataset.icon); });
    setMute(save.settings.mute); setMusic(save.settings.musicOff);
    $('#loading').hidden = true;
    go('menu');
  },
  render(now) { renderLoading(now / 1000); },
});
