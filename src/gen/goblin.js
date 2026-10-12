// Goblin-Generator: 8 Blickrichtungen, Ebenen für Kosmetik, alle Animationen.
// Kopf, Ohren, Gesicht und Hut sind Punkte im Figur-Raum (x, y, z), die je Richtung
// um die Hochachse gedreht werden (siehe turn). down/left/up entsprechen den alten Sprites.
import { DRAWN, MIRROR, NOSTROKE, circ, ell, f, group, line, path, poly, rect, star, svgDoc, turn } from './svg.js';

// ---------- Kosmetik (Phase 6 füllt das auf) ----------
export const SKINS = {
  green: { name: 'Grün', skin: '#6fc23a', dark: '#4f9a2a' },
};
export const OUTFITS = {
  vest: { name: 'Lederweste', body: '#8a5a32', belt: '#3b2414', boot: '#5a3a22' },
};
export const HATS = {
  zipfel: { name: 'Lila Zipfelmütze', col: '#7b3fc4' },
};
export const DEFAULT_LOOK = { skin: 'green', outfit: 'vest', hat: 'zipfel' };

export const ANIMS = { idle: 4, walk: 6, sprint: 6, roll: 6, hurt: 2, victory: 6, death: 6 };

const EYE = '#f4f06a';
const RAD = Math.PI / 180;

function pose(o) {
  return {
    b: 0, fwdL: 0, fwdR: 0, liftL: 0, liftR: 0, handL: 0, handR: 0, handLiftL: 0, handLiftR: 0,
    lean: 0, earBack: 0, earWig: 0, eyes: 'open', mouth: 'grin', sx: 1, sy: 1, rot: 0, hatHop: 0,
    dagger: false, stars: null, ball: null, ...o,
  };
}

// ---------- Posen je Animation ----------
export function poses(anim) {
  const cyc = n => Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * i / n));
  switch (anim) {
    case 'idle':
      return [0, 1.2, 0, -1.2].map((b, i) => pose({ b, earWig: [0, -1, 0, 1][i] }));
    case 'walk':
      return cyc(6).map(s => pose({ b: 3 - 1.732 * Math.abs(s), fwdL: -7 * s, fwdR: 7 * s, handL: 7 * s, handR: -7 * s }));
    case 'sprint':
      // Oberkörper nach vorn, lange Schritte, Ohren nach hinten, Arme pumpen
      return cyc(6).map(s => pose({
        b: 4.5 - 3 * Math.abs(s), fwdL: -11 * s, fwdR: 11 * s, liftL: 3 * Math.max(0, s), liftR: 3 * Math.max(0, -s),
        handL: 10 * s, handR: -10 * s, handLiftL: 3 + 2 * Math.max(0, s), handLiftR: 3 + 2 * Math.max(0, -s), lean: 15, earBack: 1,
      }));
    case 'roll':
      // zusammenrollen → Kugel mit Drehung → aufrollen → landen
      return [
        pose({ b: -3, sx: 1.15, sy: .85, earBack: .6, eyes: 'squint' }),
        pose({ ball: 0 }), pose({ ball: 120 }), pose({ ball: 240 }),
        pose({ b: 1, sx: .9, sy: 1.12, earBack: .5 }),
        pose({ b: -1, sx: 1.06, sy: .94 }),
      ];
    case 'hurt':
      return [pose({ b: 1, lean: -10, eyes: 'closed', mouth: 'open', earBack: .4 }), pose({ lean: -4, eyes: 'squint' })];
    case 'victory':
      // Dolch hochreißen, Hut fliegt kurz hoch
      return [0, 1, 2, 3, 4, 5].map(i => pose({
        b: [0, -2, 2, 3, 2, 0][i], handLiftR: [0, 14, 32, 34, 32, 20][i], handR: [0, 2, 3, 3, 3, 2][i],
        dagger: i >= 1, hatHop: [0, 0, -6, -9, -4, 0][i], mouth: i >= 2 && i <= 4 ? 'open' : 'grin', earWig: [0, 0, -2, -2, -1, 0][i],
      }));
    case 'death':
      return [
        pose({ b: 1, lean: -8, eyes: 'x', mouth: 'open' }),
        pose({ rot: 20, eyes: 'x', mouth: 'open' }),
        pose({ rot: 50, eyes: 'x', mouth: 'open' }),
        pose({ rot: 85, eyes: 'x', mouth: 'open', earBack: .3 }),
        pose({ rot: 90, eyes: 'x', mouth: 'open', stars: 0 }),
        pose({ rot: 90, eyes: 'x', mouth: 'open', stars: .5 }),
      ];
  }
  throw new Error('Unbekannte Animation ' + anim);
}

// ---------- Zeichnen ----------
// th = Drehung in Grad (0 down, 45 downleft, 90 left, 135 upleft, 180 up)
export function drawGoblin(thDeg, p, look = DEFAULT_LOOK) {
  const th = thDeg * RAD, k = Math.sin(th), c = Math.cos(th), ak = Math.abs(k), ac = Math.abs(c);
  const S = SKINS[look.skin], O = OUTFITS[look.outfit], H = HATS[look.hat];
  const T = (x, z) => turn(x, z, th);
  const shadow = [ell(0, 20, p.ball !== null ? 14 : 17, 6, '#000', ' fill-opacity=".3"' + NOSTROKE)];
  if (p.ball !== null) return shadow.concat(ball(p.ball, S, O, H));

  // Füße: Vorwärts-Schritt erscheint vorne als y-Verschiebung, seitlich als x-Verschiebung
  const feet = [-1, 1].map(s => {
    const a = s < 0 ? p.fwdL : p.fwdR, [x, d] = T(8 * s, 0);
    return { d: d + a * c, el: ell(x - k * a, 17 + c * .43 * a - (s < 0 ? p.liftL : p.liftR), 6, 4.5, O.boot) };
  }).sort((a, b) => a.d - b.d).map(o => o.el);

  // Hände
  const hands = [-1, 1].map(s => {
    const h = s < 0 ? p.handL : p.handR, [x, d] = T(16 * s, 0);
    const lift = s < 0 ? p.handLiftL : p.handLiftR;
    const hx = x - k * (h + 2) + (lift > 8 ? 6 * s * ac : 0), hy = 6 + c * .43 * h - lift;
    const el = [circ(hx, hy, 5, S.skin)];
    if (s > 0 && p.dagger) el.unshift(dagger(hx, hy));
    return { d: d + h * c, el, up: (s < 0 ? p.handLiftL : p.handLiftR) > 8 };
  });
  const handsBack = hands.filter(h => h.d < -2 && !h.up).flatMap(h => h.el);
  const handsFront = hands.filter(h => h.d >= -2 && !h.up).flatMap(h => h.el);
  const handsTop = hands.filter(h => h.up).flatMap(h => h.el);

  // Körper (Outfit-Ebene)
  const bw = 18 + 4 * ac;
  const body = [rect(-bw / 2, -2, bw, 20, 6, O.body), rect(-bw / 2 + 1, 9, bw - 2, 4, 0, O.belt, NOSTROKE)];

  // Ohren: schräg nach hinten, in Schrägansichten weniger, damit das ferne Ohr sichtbar bleibt
  const zt = -25 * ak ** 4 - 10 * p.earBack, eb = p.earBack;
  const earsBack = [], earsFront = [];
  for (const s of [-1, 1]) {
    const d = (T(14 * s, 0)[1] + T(15 * s, 0)[1]) / 2;
    const ox = d < -1 ? 4 * ak : 0, oy = d < -1 ? -3 * ak : 0;
    const pts = [[14 * s, -19, 0], [(37 - 6 * eb) * s, -27 + 5 * eb + p.earWig, zt], [15 * s, -7, 0]].map(([x, y, z]) => [T(x, z)[0] + ox, y + oy]);
    const el = poly(pts, d < -1 ? S.dark : S.skin);
    (d > 3 ? earsFront : earsBack).push({ d, el });
  }
  const byDepth = a => a.sort((x, y) => x.d - y.d).map(o => o.el);

  // Kopf
  const head = [ell(0, -13, 16 + 2 * ac, 16, S.skin)];

  // Hut (Ebene "hat"): Kappe + Zipfel
  const hat = [];
  const hy = p.hatHop;
  if (c > -0.1) {
    const rx = 16 + 2 * ac;
    hat.push(path(`M${f(-rx)} ${f(-13 + hy)} A${f(rx)} ${f(15 + 2 * ac)} 0 0 1 ${f(rx)} ${f(-13 + hy)} Q0 ${f(-21 + hy)} ${f(-rx)} ${f(-13 + hy)}Z`, H.col));
  } else {
    const cx = 3 * k;
    hat.push(ell(cx, -12 + hy, 16 + 2 * ac, 15.5, H.col));
  }
  {
    const [bc] = T(2, -7), [ax] = T(3, -14);
    hat.push(poly([[bc - 6, -28 + hy], [ax, -41 + hy], [bc + 6, -27 + hy]], H.col));
  }
  if (c <= -0.1) { const cx = 3 * k, w = 10 * ac; hat.push(line(cx - w, -7 + hy, cx + w, -7 + hy)); }

  // Gesicht: nur was zur Kamera zeigt
  const face = [];
  for (const s of [-1, 1]) {
    const [ex, ed] = T(7 * s, 8);
    if (ed <= .5) continue;
    const rx = (4 + .5 * ac) * (ed < 4 ? .7 : 1), ey = -12 - ak;
    const [px] = T(7 * s, 10);
    if (p.eyes === 'open') face.push(ell(ex, ey, rx, 5, EYE), ell(px, ey + 1, 2.2 * rx / 4.5, 2.6, '#000'));
    else if (p.eyes === 'squint') face.push(ell(ex, ey + 1, rx, 2.6, EYE), ell(px, ey + 1, 2 * rx / 4.5, 1.8, '#000'));
    else if (p.eyes === 'closed') face.push(path(`M${f(ex - rx)} ${f(ey)} Q${f(ex)} ${f(ey + 3)} ${f(ex + rx)} ${f(ey)}`, 'none', ' stroke-width="2"'));
    else { const r = rx * .7; face.push(line(ex - r, ey - r, ex + r, ey + r, ' stroke-width="2"'), line(ex - r, ey + r, ex + r, ey - r, ' stroke-width="2"')); }
  }
  {
    const [nx, nd] = T(0, 16);
    if (nd > -1) face.push(ell(nx, -7 - 2 * ak, 4 + ak, 3 + ak, S.dark));
  }
  const open = p.mouth === 'open';
  if (ak > .95 && c > -0.5) {
    const sg = Math.sign(k), x0 = -14 * sg, x1 = -5 * sg;
    face.push(open ? path(`M${f(x0)} -2 Q${f((x0 + x1) / 2)} 4 ${f(x1)} -2Z`, '#3b1a14') : line(x0, -2, x1, -2));
  } else if (c > 0) {
    const [ax] = T(-6, 5), [bx] = T(6, 5), [cx] = T(0, 13);
    face.push(path(`M${f(ax)} -2 Q${f(cx)} ${open ? 6 : 1} ${f(bx)} -2${open ? 'Z' : ''}`, open ? '#3b1a14' : 'none'));
  }
  if (c > -0.5) for (const s of [-1, 1]) {
    const pts = [[4 * s, -1.5], [2.5 * s, -5], [1 * s, -1]].map(([x, y]) => { const [tx, td] = T(x, 8 + Math.abs(x)); return [tx, y, td]; });
    if (pts[1][2] > .5) face.push(poly(pts.map(([x, y]) => [x, y]), '#fff'));
  }

  // Oberkörper neigen (um die Hüfte), vorne wirkt das als leichtes Absenken
  const up = group([
    group(handsBack, ' id="arms-back"'),
    group(body, ' id="outfit"'),
    group(handsFront, ' id="arms-front"'),
    group(byDepth(earsBack), ' id="ears-back"'),
    group(head, ' id="head"'),
    group(hat, ' id="hat"'),
    group(byDepth(earsFront), ' id="ears-front"'),
    group(face, ' id="face"'),
    group(handsTop, ' id="arms-top"'),
  ], ` transform="translate(0 ${f(-p.b + p.lean / 15 * 2 * ac)}) rotate(${f(-p.lean * k)} 0 12)"`);

  let all = [group(feet, ' id="feet"'), up];
  if (p.sx !== 1 || p.sy !== 1) all = [group(all, ` transform="translate(0 20) scale(${f(p.sx)} ${f(p.sy)}) translate(0 -20)"`)];
  if (p.rot) {
    const r = p.rot / 90;
    all = [group(all, ` transform="translate(${f(-14 * r)} ${f(-2 * r)}) rotate(${f(p.rot)} 0 18)"`)];
  }
  if (p.stars !== null) {
    // Sterne kreisen über dem liegenden Kopf
    for (let i = 0; i < 3; i++) {
      const a = (p.stars + i / 3) * 2 * Math.PI;
      all.push(poly(star(17 + Math.cos(a) * 13, -2 + Math.sin(a) * 4, 4, 1.6, 5, a), '#ffe45c', ' stroke-width="1"'));
    }
  }
  return shadow.concat(all);
}

function dagger(hx, hy) {
  // Dolch nach oben in der Hand
  return group([
    poly([[-2.2, -4], [0, -20], [2.2, -4]], '#d6dde2'),
    line(0, -18, 0, -6, ' stroke="#9aa4ad" stroke-width=".8"'),
    rect(-5, -4.5, 10, 2.6, 1, '#c9973a'),
  ], ` transform="translate(${f(hx)} ${f(hy - 2)})"`);
}

function ball(angle, S, O, H) {
  return [group([
    poly([[-6, -8], [-20, -20], [-11, 0]], S.dark),
    poly([[7, -7], [23, -15], [12, 3]], S.skin),
    circ(0, 6, 15, S.skin),
    path('M-14.5 9.5 A15 15 0 0 0 14.5 9.5 Q0 14 -14.5 9.5Z', O.body),
    path('M-12 -3 A15 15 0 0 1 12 -3 Q0 1 -12 -3Z', H.col),
    poly([[2, -8], [13, -19], [10, -5]], H.col),
    path('M-9 4 Q-6 6.5 -3 4', 'none', ' stroke-width="2"'),
    ell(-3, 9, 3, 2.2, S.dark),
  ], ` transform="rotate(${f(angle)} 0 6)"`)];
}

// ---------- Ausgabe ----------
// dir: eine der 8 Richtungen; rechte Richtungen sind gespiegelt
export function goblinSvg(dir, anim, i, look = DEFAULT_LOOK) {
  const base = MIRROR[dir] || dir;
  return svgDoc(drawGoblin(DRAWN[base], poses(anim)[i], look), { flip: !!MIRROR[dir] });
}
