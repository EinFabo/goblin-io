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

// ---------- Schattierung (Phase 13, Stilregeln 4.5): Licht von oben links ----------
// Fabi hat Stil „voll“ gewählt: drei Töne je Fläche (Glanz oben links, Grund, Schatten unten rechts) + dünnes Randlicht.
// sf(farbe) gibt statt der Farbe einen Verlauf zurück; svgDoc sucht die benutzten Verläufe im fertigen Bild und schreibt sie in <defs>.
// setShade(false) zeichnet flach wie bis 3.0.x (nur für Vergleichsbilder).
let SHADE = true;
export const setShade = on => { SHADE = !!on; };
export const shadeOn = () => SHADE;
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex2(a).map((v, i) => Math.round(v + (hex2(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// Schatten werden kühl (zum dunklen Violett), Glanz warm-hell
export const shadow = (c, t) => mix(c, '#1c1430', t), light = (c, t) => mix(c, '#fff8e8', t);
export const sf = col => (!SHADE || typeof col !== 'string' || !/^#[0-9a-f]{6}$/i.test(col) ? col : `url(#sh${col.slice(1).toLowerCase()})`);
// rot: die ganze Figur ist um rot Grad gedreht (Rolle, Umfallen) – die Verläufe drehen zurück, damit das Licht oben links bleibt
function gradDefs(inner, rot = 0) {
  const ids = new Set(inner.match(/url\(#sh[0-9a-f]{6}\)/g));
  if (!ids.size) return '';
  const out = [...ids].map(u => {
    const c = '#' + u.slice(7, 13);
    return `<radialGradient id="sh${c.slice(1)}" cx=".32" cy=".26" r=".95"${rot ? ` gradientTransform="rotate(${f(-rot)} .5 .5)"` : ''}><stop offset="0" stop-color="${light(c, .38)}"/><stop offset=".42" stop-color="${c}"/>`
      + `<stop offset=".86" stop-color="${shadow(c, .34)}"/><stop offset="1" stop-color="${light(shadow(c, .34), .28)}"/></radialGradient>`;
  }).join('');
  return `<defs>${out}</defs>`;
}

// 96×96-Dokument, gezeichnet um (0,0) mit Mittelpunkt bei (48,52) wie die alten Sprites
export function svgDoc(body, { flip = false, vb = [-48, -52, 96, 96], rot = 0 } = {}) {
  const [x, y, w, h] = vb;
  const t = ` transform="translate(${-x} ${-y})${flip ? ' scale(-1 1)' : ''}"`;
  const inner = Array.isArray(body) ? body.join('') : body;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` + gradDefs(inner, rot)
    + `<g stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"${t}>`
    + inner + '</g></svg>';
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

// ---------- Pseudo-3D-Kit ----------
// Teile: { l: Ebene, d: Tiefe, s: SVG }. Ebenen: 0 hinter dem Kopf, 1 Kopf, 2 Gesicht, 3 Hut/Haube, 4 ganz vorne.
export function kit(th) {
  const k = Math.sin(th), c = Math.cos(th);
  const K = {
    k, c, ak: Math.abs(k), ac: Math.abs(c), parts: [],
    x: (x, z) => x * c - z * k,                 // Bild-x
    dep: (x, z) => x * k + z * c,               // Tiefe (> 0 = zur Kamera)
    face: (x, z, min = .5) => x * k + z * c > min,
    add(l, d, s) { K.parts.push({ l, d, s }); },
    // Ellipsoid: Breite ergibt sich aus x- und z-Radius je nach Drehung
    blobE(l, x, y, z, rx, ry, rz, fill, extra = '') {
      // große Teile schattiert (Phase 13), kleine Knöpfe und Steine bleiben flach
      K.add(l, K.dep(x, z), ell(K.x(x, z), y, Math.hypot(rx * c, rz * k), ry, Math.max(rx, ry) >= 4.5 ? sf(fill) : fill, extra));
    },
    poly(l, pts, fill, extra = '') {
      const d = pts.reduce((a, p) => a + K.dep(p[0], p[2]), 0) / pts.length;
      K.add(l, d, poly(pts.map(p => [K.x(p[0], p[2]), p[1]]), fill, extra));
    },
    // geschlossene, weiche Kurve durch 3D-Punkte (Catmull-Rom)
    smooth(l, pts, fill, extra = '', depth = null) {
      const P = pts.map(p => [K.x(p[0], p[2]), p[1]]), n = P.length;
      let d = `M${f(P[0][0])} ${f(P[0][1])}`;
      for (let i = 0; i < n; i++) {
        const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
        d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
      }
      K.add(l, depth ?? pts.reduce((a, p) => a + K.dep(p[0], p[2]), 0) / n, path(d + 'Z', sf(fill), extra));
    },
    out() { return K.parts.map((p, i) => ({ ...p, i })).sort((a, b) => a.l - b.l || a.d - b.d || a.i - b.i).map(p => p.s); },
  };
  return K;
}
