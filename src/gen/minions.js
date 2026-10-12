// Diener-Generator: Skelett, Geist, Steingolem, Ratte. 8 Richtungen (5 gezeichnet + 3 gespiegelt), idle/walk.
// Werden später von Nekromanten, Lich, Geomanten und der Fähigkeit "Rattenflut" gebraucht.
import { DRAWN, MIRROR, NOSTROKE, OUTLINE, circ, ell, f, group, kit, path, svgDoc } from './svg.js';

const RAD = Math.PI / 180;
export const MINION_KINDS = ['skeleton', 'ghost', 'golem', 'rat'];
export const MINION_ANIMS = { idle: 4, walk: 6 };

const C = {
  bone: '#ece4cf', boneS: '#c9bfa5', hole: '#151515', glow: '#7bff6a',
  ghost: '#d8f4ff', ghostS: '#a9d8f0', ghostLine: '#4a6a8a',
  stone: '#8a7a62', stoneS: '#6a5c48', moss: '#5f8f3a', ember: '#ffb347',
  fur: '#8a7a70', belly: '#b8a89a', pink: '#e8a0a0',
};

// Pose je Frame: Auf und Ab, Schritt vorwärts je Seite, Phase für Wellen
export function minionPoses(kind, anim) {
  if (anim === 'idle') return [0, 1, 2, 3].map(i => ({ b: [0, .8, 1.4, .8][i] * (kind === 'ghost' ? 2.5 : 1), step: 0, ph: i / 4 }));
  return [0, 1, 2, 3, 4, 5].map(i => {
    const s = Math.sin(2 * Math.PI * i / 6);
    const amp = { skeleton: 6, ghost: 0, golem: 5, rat: 4 }[kind];
    return { b: (kind === 'golem' ? 2.5 : kind === 'ghost' ? 0 : 1.3) * Math.abs(s) + (kind === 'ghost' ? 2 * Math.sin(2 * Math.PI * i / 6 + 1) : 0), step: amp * s, ph: i / 6 };
  });
}

// Strich mit dunklem Rand (Knochen, Schwanz)
const stroke2 = (pts, col, w) => {
  const d = 'M' + pts.map(([x, y]) => f(x) + ' ' + f(y)).join(' L');
  return path(d, 'none', ` stroke="${OUTLINE}" stroke-width="${f(w + 2.2)}"`) + path(d, 'none', ` stroke="${col}" stroke-width="${f(w)}"`);
};

function skeleton(K, p) {
  const { k, c } = K, b = -p.b;
  // Beine und Arme: vorne/hinten nach Tiefe sortiert
  for (const s of [-1, 1]) {
    const a = s * p.step, fx = K.x(5 * s, 0) - k * a, fy = 17 + c * .43 * a;
    K.add(1, K.dep(4 * s, 0) - 5, stroke2([[K.x(4 * s, 0), 6 + b], [fx, fy - 2]], C.bone, 2.2) + ell(fx, fy, 3.4, 2.2, C.bone));
    const h = -s * p.step, hx = K.x(10 * s, 0) - k * h, hy = 3 + c * .43 * h + b;
    K.add(1, K.dep(10 * s, 0) - .5, stroke2([[K.x(7 * s, 0), -6 + b], [hx, hy]], C.bone, 2) + circ(hx, hy + 1, 2.2, C.bone));
  }
  K.blobE(1, 0, 6 + b, 0, 6, 2.6, 4, C.bone);
  K.add(1, 0, stroke2([[0, 6 + b], [0, -6 + b]], C.bone, 2));
  K.blobE(1, 0, -2 + b, 0, 7, 6, 5, C.bone);
  if (K.c > -0.9) for (const y of [-5, -2, 1]) K.add(1, .5, path(`M${f(-5.5 * Math.max(.45, K.ac))} ${f(y + b)} Q0 ${f(y + 1.6 + b)} ${f(5.5 * Math.max(.45, K.ac))} ${f(y + b)}`, 'none', ' stroke-width="1.1"'));
  // Schädel
  K.blobE(2, 0, -15 + b, 0, 8, 7.5, 8, C.bone);
  if (K.face(0, 4, -1)) K.blobE(3, 0, -9 + b, 3, 5, 2.6, 4, C.bone);
  for (const s of [-1, 1]) if (K.face(3 * s, 6, .5)) {
    const x = K.x(3 * s, 6.5), w = K.dep(3 * s, 6) < 3 ? .6 : 1;
    K.add(3, 1, ell(x, -15.5 + b, 2 * w, 2.4, C.hole, NOSTROKE));
    K.add(3, 1.1, circ(x, -15.5 + b, .9, C.glow, NOSTROKE));
  }
}

function ghost(K, p) {
  const b = -p.b, w = Math.sin(p.ph * 2 * Math.PI) * 1.8, fill = C.ghost, extra = ` fill-opacity=".9" stroke="${C.ghostLine}"`;
  // Körper: Kuppel oben, wellige Schleppe unten, die nach hinten weht
  const tx = K.x(0, -9);
  K.add(1, 0, path(`M-11 ${f(-14 + b)} A11 11 0 0 1 11 ${f(-14 + b)} L12 ${f(4 + b)} Q${f(8 + tx * .3)} ${f(9 + b + w)} ${f(5 + tx * .5)} ${f(6 + b)} Q${f(1 + tx * .7)} ${f(12 + b - w)} ${f(-2 + tx * .6)} ${f(6 + b)} Q${f(-6 + tx * .4)} ${f(10 + b + w)} -12 ${f(4 + b)} Z`, fill, extra));
  for (const s of [-1, 1]) {
    const x = K.x(11 * s, 0), d = K.dep(11 * s, 0);
    K.add(d < -2 ? 0 : 2, d, ell(x, -4 + b + s * w * .5, 3.5, 3, fill, extra));
  }
  for (const s of [-1, 1]) if (K.face(4 * s, 9, .3)) K.add(3, 1, ell(K.x(4 * s, 9.5), -15 + b, 2 * (K.dep(4 * s, 9) < 3 ? .6 : 1), 3, '#1f2a3a', NOSTROKE));
  if (K.face(0, 10, .3)) K.add(3, 1.2, ell(K.x(0, 10.5), -8 + b, 2 * Math.max(.5, K.ac), 2.6, '#1f2a3a', NOSTROKE));
}

function golem(K, p) {
  const { k, c } = K, b = -p.b;
  for (const s of [-1, 1]) {
    const a = s * p.step;
    K.add(0, K.dep(7 * s, 0), ell(K.x(7 * s, 0) - k * a, 15 + c * .43 * a, 6, 5, C.stoneS));
  }
  // Rumpf in Bildkoordinaten: drehsymmetrisch, im Profil etwas schmaler
  const w = .78 + .22 * K.ac, T = [[-14, -14], [0, -18], [14, -14], [16, 2], [9, 11], [-9, 11], [-16, 2]].map(([x, y]) => [x * w, y + b]);
  let dd = `M${f(T[0][0])} ${f(T[0][1])}`;
  for (let i = 0; i < T.length; i++) {
    const n = T.length, p0 = T[(i - 1 + n) % n], p1 = T[i], p2 = T[(i + 1) % n], p3 = T[(i + 2) % n];
    dd += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  K.add(1, 0, path(dd + 'Z', C.stone));
  if (K.c > 0.3) {
    const x = K.x(0, 10);
    K.add(1, .2, path(`M${f(x - 6)} ${f(-8 + b)} L${f(x - 2)} ${f(-3 + b)} L${f(x - 4)} ${f(3 + b)}`, 'none', ' stroke-width="1.3"'));
    K.add(1, .3, ell(x + 5, -10 + b, 4, 2.4, C.moss, NOSTROKE));
  } else K.add(1, .3, ell(0, -12 + b, 6, 3, C.moss, NOSTROKE));
  // Kopf: kleiner Fels mit glühenden Augen
  K.blobE(2, 0, -22 + b, 1, 7.5, 6, 7.5, C.stone);
  for (const s of [-1, 1]) if (K.face(2.8 * s, 7, .5)) K.add(3, 1, ell(K.x(2.8 * s, 7.5), -22 + b, 1.6 * (K.dep(2.8 * s, 7) < 3 ? .6 : 1), 1.3, C.ember, NOSTROKE));
  if (K.face(0, 7, .5)) K.add(3, 1.1, path(`M${f(K.x(-5, 6))} ${f(-25 + b)} L${f(K.x(5, 6))} ${f(-25 + b)}`, 'none', ' stroke-width="2"'));
  // Arme: Schulter und schwere Faust, schwingen gegenläufig
  for (const s of [-1, 1]) {
    const h = -s * p.step * .8, d = K.dep(15 * s, 0);
    const el = ell(K.x(15 * s, 0), -10 + b, 6, 6, C.stone) + ell(K.x(17 * s, 0) - k * h, 5 + c * .43 * h + b, 6.5, 6, C.stoneS);
    K.add(d < -3 ? 0 : 4, d, el);
  }
}

function rat(K, p) {
  const b = -p.b * .6;
  // Schwanz nach hinten
  const tail = [[0, 9, -11], [3, 7, -17], [7 + Math.sin(p.ph * 6.28) * 2, 3, -21]].map(([x, y, z]) => [K.x(x, z), y + b]);
  K.add(0, K.dep(0, -16), stroke2(tail, C.pink, 1.6));
  // Beine: vier Füßchen, diagonal im Takt
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const a = sx * sz * p.step, z = 6 * sz + a;
    K.add(0, K.dep(4 * sx, z), ell(K.x(4 * sx, z), 15 + b * .3, 2.4, 1.6, C.pink));
  }
  K.blobE(1, 0, 9 + b, 0, 7, 6, 12, C.fur);
  if (K.c > 0) K.blobE(1, 0, 11 + b, 4, 5, 3, 8, C.belly, NOSTROKE);
  // Kopf mit Ohren, Auge, Nase
  for (const s of [-1, 1]) K.blobE(K.dep(3.5 * s, 9) < 7 ? 1 : 2, 3.5 * s, 2 + b, 9, 2.6, 2.6, 2, C.pink);
  K.blobE(2, 0, 6 + b, 12, 5, 4.5, 6, C.fur);
  if (K.face(0, 17, -1)) K.blobE(3, 0, 7 + b, 17.5, 1.5, 1.3, 1.5, C.pink);
  for (const s of [-1, 1]) if (K.face(2.6 * s, 14, 1)) K.add(3, 1, circ(K.x(2.6 * s, 14), 4.5 + b, 1.1, '#111', NOSTROKE));
}

const DRAW = { skeleton, ghost, golem, rat };

export function drawMinion(kind, d, p) {
  const K = kit(DRAWN[d] * RAD);
  DRAW[kind](K, p);
  const sh = { skeleton: [12, 4.5], ghost: [10, 3.5], golem: [20, 6.5], rat: [11, 4] }[kind];
  const shadow = ell(0, 20, sh[0], sh[1], '#000', ` fill-opacity="${kind === 'ghost' ? .15 : .3}"` + NOSTROKE);
  return [shadow, group(K.out())];
}
export function minionSvg(kind, dir, anim, i) {
  const base = MIRROR[dir] || dir;
  return svgDoc(drawMinion(kind, base, minionPoses(kind, anim)[i]), { flip: !!MIRROR[dir] });
}
