import { musBus, sfxBus } from '../core/audio.js';
import { Music } from '../core/music.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';

export function setMute(m) { save.settings.mute = m; persist(); if (sfxBus) sfxBus.gain.value = m ? 0 : .5; for (const b of [$('#muteBtn'), $('#pMuteBtn')]) b.textContent = 'Ton: ' + (m ? 'aus' : 'an'); }
export function setMusic(off) {
  save.settings.musicOff = off; persist(); if (musBus) musBus.gain.value = off ? 0 : .3;
  for (const b of [$('#musicBtn'), $('#pMusicBtn')]) b.textContent = 'Musik: ' + (off ? 'aus' : 'an');
  if (off) Music.stop();
}
export function setShake(on) { save.settings.shake = on; persist(); $('#shakeBtn').textContent = 'Wackeln: ' + (on ? 'an' : 'aus'); }
