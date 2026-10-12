// Kleine SVG-Bausteine für die Sprite-Generatoren (Goblin, Magier, Diener).
// Läuft im Browser und in Node (tools/gen/dump.mjs).

export const OUTLINE = '#1d2b14';
export const NOSTROKE = ' stroke="none"';
export const f = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

export const ell = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}"${extra}/>`;
export const circ = (cx, cy, r, fill, extra = '') => ell(cx, cy, r, r, fill, extra);
export const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(([x, y]) => f(x) + ',' + f(y)).join(' ')}" fill="${fill}"${extra}/>`;
export const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
export const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${r ? ` rx="${f(r)}"` : ''} fill="${fill}"${extra}/>`;
export const line = (x1, y1, x2, y2, extra = '') => path(`M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}`, 'none', extra);
export const group = (body, attrs = '') => `<g${attrs}>${Array.isArray(body) ? body.join('') : body}</g>`;

export function star(cx, cy, r1, r2, n = 4, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + Math.PI * i / n - Math.PI / 2, r = i % 2 === 0 ? r1 : r2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// 96×96-Dokument, gezeichnet um (0,0) mit Mittelpunkt bei (48,52) wie die alten Sprites
export function svgDoc(body, { flip = false, vb = [-48, -52, 96, 96] } = {}) {
  const [x, y, w, h] = vb;
  const t = ` transform="translate(${-x} ${-y})${flip ? ' scale(-1 1)' : ''}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<g stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"${t}>`
    + (Array.isArray(body) ? body.join('') : body) + '</g></svg>';
}

// ---------- Blickrichtungen ----------
// Fünf werden gezeichnet, die rechten drei sind Spiegelbilder der linken.
// θ = Drehung der Figur: 0 = schaut zur Kamera (down), 90° = schaut nach links, 180° = Rücken (up).
export const DIRS8 = ['right', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];
export const DRAWN = { down: 0, downleft: 45, left: 90, upleft: 135, up: 180 };
export const MIRROR = { right: 'left', downright: 'downleft', upright: 'upleft' };

// Punkt im Figur-Raum (x rechts, y unten, z zur Kamera) um die Hochachse drehen.
// Ergebnis: [Bild-x, Tiefe]. Tiefe > 0 = vor der Körpermitte.
export function turn(x, z, th) {
  const c = Math.cos(th), s = Math.sin(th);
  return [x * c - z * s, x * s + z * c];
}
