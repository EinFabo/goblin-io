import { RARITY } from '../data/cards.js';
import { COSM, MECH_PAINT, TRAIL } from '../data/cosmetics.js';
import { DEFAULT_LOOK, goblinSvg } from '../gen/goblin.js';
import { SPR, svgUrl, tinted } from '../render/sprites.js';

// ---------- Vorschaubilder für Kosmetik ----------
// Haut, Hut, Outfit: der Goblin mit genau diesem Teil (sonst Standard), als SVG-Bild.
// Dolch: getönter Dolch. Roll-Spur: Farbtupfer. Maschine: Lack-Schild mit Nieten.
const CACHE = new Map();
export function cosmImg(id, base = DEFAULT_LOOK) {
  const c = COSM[id], key = id + JSON.stringify(base);
  if (CACHE.has(key)) return CACHE.get(key);
  let url;
  if (c.slot === 'skin' || c.slot === 'hat' || c.slot === 'outfit') url = svgUrl(goblinSvg('down', 'idle', 0, { ...base, [c.slot]: c.key }));
  else if (c.slot === 'dagger') {
    const e = SPR.dagger; if (!e) return '';
    const src = c.key === 'steel' ? e.c : tinted(e, 'dagger_' + c.key), cv = document.createElement('canvas');
    cv.width = cv.height = 96; const g = cv.getContext('2d');
    g.translate(48, 48); g.rotate(-Math.PI / 4); const w = 70, h = w * src.height / src.width; g.drawImage(src, -w / 2, -h / 2, w, h);
    url = cv.toDataURL();
  } else if (c.slot === 'trail') {
    const cols = TRAIL[c.key].cols, dots = Array.from({ length: 7 }, (_, i) => cols[i % cols.length]).map((col, i) => `<circle cx="${14 + i * 11}" cy="${54 - Math.sin(i * .9) * 14}" r="${8 - i * .6}" fill="${col}" stroke="#1d2b14" stroke-width="1.5"/>`).join('');
    url = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${dots}</svg>`);
  } else {
    const [a, b, r] = MECH_PAINT[c.key];
    url = svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
      <rect x="14" y="22" width="68" height="52" rx="12" fill="url(#g)" stroke="#0a0f06" stroke-width="4"/><rect x="32" y="44" width="32" height="14" rx="3" fill="#2a2f36"/>
      ${[[24, 32], [72, 32], [24, 64], [72, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${r}"/>`).join('')}</svg>`);
  }
  CACHE.set(key, url);
  return url;
}
export function cosmTile(id, cls = '', extra = '') {
  const c = COSM[id], R = RARITY[c.rarity];
  return `<div class="ctile ${cls}" style="--rc:${R.color}" ${extra}><img src="${cosmImg(id)}" alt=""><b>${c.name}</b><small>${R.name}</small></div>`;
}
