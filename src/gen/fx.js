// Geschosse und Einschläge der Schulen ohne eigene Grafik aus dem Magier-Paket.
// Geschosse zeigen nach rechts (+x), 4 Frames; Einschläge 5 Frames. Format wie die alten fx-SVGs (48×48).
import { NOSTROKE, circ, ell, path, poly, star, svgDoc } from './svg.js';

export const FX_KINDS = ['shade', 'glob', 'spark', 'soul', 'rock', 'lance'];
const VB = { vb: [-24, -24, 48, 48] };

function proj(kind, i) {
  const w = [0, 1, 0, -1][i], ph = i * Math.PI / 2;
  switch (kind) {
    case 'shade': return [
      ell(-6, 0, 16, 8, '#b26bff', ' fill-opacity=".25"' + NOSTROKE),
      path(`M8 0 C8 -6 2 -8 -3 -7 C-9 ${-8 + w} -14 ${-4 - w} -21 ${-3 + w * 1.5} C-15 -1 -19 ${2 + w} -14 4 C-10 ${7 - w} -6 8 -1 7.5 C4 7 8 5 8 0 Z`, '#3b1466'),
      path(`M5 0 C5 -3.5 1 -5 -2 -4.5 C-6 ${-4 + w * .6} -9 ${-1 - w * .6} -11 0 C-8 1.5 -7 3.5 -3 4.5 C0 5.5 5 4 5 0 Z`, '#9a4dff', NOSTROKE),
      circ(2, -.5, 2.6, '#f0dcff', NOSTROKE),
    ];
    case 'glob': return [
      ell(0, 0, 11, 11, '#7be04a', ' fill-opacity=".25"' + NOSTROKE),
      path(`M8 0 C8 ${-6 - w} 2 -9 -3 -7 C-8 -5 -11 -1 -9 3 C-7 7 -2 ${8 + w} 3 6.5 C7 5 8 3 8 0 Z`, '#5cc22a'),
      circ(2, -2.5, 2.2, '#d9ffb0', NOSTROKE),
      ell(-12 - (i % 2) * 2, 3 + w, 2.2, 2.8, '#5cc22a', ' stroke-width="1"'),
    ];
    case 'spark': {
      const z = `M-22 ${w * 2} L-16 ${-3 - w} L-11 ${3 + w} L-6 ${-2}`;
      return [circ(0, 0, 12, '#fff59a', ' fill-opacity=".3"' + NOSTROKE), path(z, 'none', ' stroke="#ffe45c" stroke-width="2.4"'),
        circ(0, 0, 6.5, '#ffe45c'), poly(star(0, 0, 7, 2.5, 4, ph * .5), '#ffffff', NOSTROKE)];
    }
    case 'soul': return [
      path(`M6 0 C6 -6 0 -8 -4 -6 C-10 ${-4 + w} -16 ${-2 - w} -21 ${w * 2} C-16 ${2 + w} -10 ${4 - w} -4 6 C0 8 6 6 6 0 Z`, '#7bff6a', ' fill-opacity=".85"'),
      circ(1, 0, 5.5, '#d8ffd0', NOSTROKE), circ(-.6, -1.4, 1.2, '#151515', NOSTROKE), circ(2.8, -1.4, 1.2, '#151515', NOSTROKE),
    ];
    case 'rock': {
      const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      const R = ([x, y]) => [x * c - y * s, x * s + y * c];
      return [poly([[-9, -1], [-4, -9], [5, -8], [10, -1], [6, 8], [-5, 8]].map(R), '#8a7a62'), poly([[-4, -6], [3, -6], [-1, -1]].map(R), '#b8a888', NOSTROKE)];
    }
    case 'lance': return [
      ell(-4, 0, 18, 6, '#fff3b0', ' fill-opacity=".35"' + NOSTROKE),
      poly([[14, 0], [2, -4], [-18, -1.5 + w * .5], [-18, 1.5 - w * .5], [2, 4]], '#ffe27a'),
      poly([[11, 0], [2, -1.8], [-10, 0], [2, 1.8]], '#ffffff', NOSTROKE),
    ];
  }
  return [];
}

function hit(kind, i) {
  const r = [6, 10, 13, 15, 16][i], op = [1, .9, .7, .45, .2][i], o = ` opacity="${op}"`;
  switch (kind) {
    case 'shade': return [circ(0, 0, r, 'none', ` stroke="#b26bff" stroke-width="${3 - i * .5}"${o}`), ...(i < 3 ? [poly(star(0, 0, r * .8, r * .3, 6, i * .4), '#3b1466', o)] : [])];
    case 'glob': return Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3 + .3, d = 3 + i * 3; return ell(d * Math.cos(a), d * Math.sin(a) + i * .6, 3 - i * .3, 3.6 - i * .4, '#5cc22a', o + ' stroke-width="1"'); });
    case 'spark': return [poly(star(0, 0, r, r * .35, 8, i * .3), '#ffe45c', o), poly(star(0, 0, r * .55, r * .2, 8, i * .3 + .2), '#ffffff', o + NOSTROKE)];
    case 'soul': return Array.from({ length: 5 }, (_, k) => circ(Math.cos(k * 1.3) * (2 + i * 2.5), Math.sin(k * 1.3) * (2 + i * 2.5) - i * 2, 2.5 + i, '#7bff6a', ` fill-opacity="${op * .7}"` + NOSTROKE));
    case 'rock': return Array.from({ length: 6 }, (_, k) => { const a = k * Math.PI / 3, d = 4 + i * 3; return circ(d * Math.cos(a), d * Math.sin(a) * .6 - i, 2.4 + i * .9, '#b8a888', ` fill-opacity="${op * .8}"` + NOSTROKE); });
    case 'lance': return [poly(star(0, 0, r * 1.1, r * .3, 8, i * .2), '#fff3b0', o), circ(0, 0, r * .4, '#ffffff', o + NOSTROKE)];
  }
  return [];
}

export const fxSvg = (kind, i) => svgDoc(proj(kind, i), VB);
export const fxHitSvg = (kind, i) => svgDoc(hit(kind, i), VB);
