import { STAGES } from '../data/stages.js';
import { ctx } from './canvas.js';
import { mk } from './proc.js';
import { GRASS_IMG } from './sprites.js';

export const TILE_CACHE = [];
export function stageTile(i) {
  if (TILE_CACHE[i]) return TILE_CACHE[i];
  const st = STAGES[i];
  const c = mk(574, 431, g => {
    if (GRASS_IMG) g.drawImage(GRASS_IMG, 0, 0, 574, 431); else { g.fillStyle = '#5fae3a'; g.fillRect(0, 0, 574, 431); }
    if (st.tint) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = st.tint[1]; g.fillStyle = st.tint[0]; g.fillRect(0, 0, 574, 431); }
    if (st.dark) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = st.dark; g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, 574, 431); }
  });
  TILE_CACHE[i] = { c, pat: null };
  return TILE_CACHE[i];
}
export function drawGround(si, x, y, w, h) { const tc = stageTile(si); if (!tc.pat) tc.pat = ctx.createPattern(tc.c, 'repeat'); ctx.fillStyle = tc.pat; ctx.fillRect(x, y, w, h); }
