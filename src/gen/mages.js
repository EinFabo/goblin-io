// Magier-Generator: 8 Schulen, 5 gezeichnete + 3 gespiegelte Blickrichtungen, idle/walk/cast.
// Körper und Posen kommen aus dem alten mages.py (Feuer- und Frostmagier). Für die Schrägansichten
// werden die Posen der Nachbarrichtungen gemittelt. Köpfe sind Pseudo-3D-Teile (siehe Kit), daher passen
// sie automatisch in jede Richtung.
import { DRAWN, MIRROR, NOSTROKE, OUTLINE, circ, ell, f, group, kit, line, path, poly, rect, star, svgDoc } from './svg.js';

const RAD = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- Schulen ----------
export const SCHOOLS = {
  fire: {
    name: 'Feuer', robe: '#c23b2c', shade: '#8e2a20', trim: '#f2c14e', skin: '#f3c79a', skinS: '#d9a477', hair: '#f1f1f4',
    boot: '#4a2e1c', staff: '#7a4a26', orb: '#ff8a1f', orbCore: '#ffe27a', glow: '#ffb347', flashO: '#ff7a1a', flashI: '#fff1a0',
  },
  frost: {
    name: 'Frost', robe: '#2a5fae', shade: '#1f4785', trim: '#eaf6ff', hood: '#3f86d8', fur: '#eaf6ff', face: '#16203a', eye: '#8ff6ff',
    boot: '#2b2f45', staff: '#b9c4d0', orb: '#7fe3ff', orbCore: '#eafcff', glow: '#9fefff', flashO: '#5fd0ff', flashI: '#f0fdff',
  },
  storm: {
    name: 'Sturm', robe: '#5b3fa8', shade: '#412c7c', trim: '#ffe04a', skin: '#f3c79a', skinS: '#d9a477', hair: '#3a2a5a', hat: '#3b2a6e', feather: '#ffe04a',
    glass: '#bfe9ff', boot: '#2c2140', staff: '#6b5a3a', orb: '#ffe45c', orbCore: '#ffffff', glow: '#fff59a', flashO: '#ffd21a', flashI: '#ffffff',
  },
  toxic: {
    name: 'Gift', robe: '#3f6b2a', shade: '#2d4e1e', trim: '#b08a4a', mask: '#5a4632', beak: '#c9b48a', lens: '#9cf06a', hat: '#2b2218',
    boot: '#3b2e20', staff: '#6b4a2a', orb: '#7be04a', orbCore: '#d9ffb0', glow: '#9cf06a', flashO: '#5cc22a', flashI: '#e8ffc8',
  },
  shadow: {
    name: 'Schatten', robe: '#3b1d66', shade: '#24103f', trim: '#b78cff', hood: '#2a1450', mask: '#efe6ff', hole: '#0c0614', starC: '#ffe9a8',
    boot: '#1a0d2b', staff: '#4a3a5a', orb: '#b26bff', orbCore: '#f0dcff', glow: '#c99bff', flashO: '#9a4dff', flashI: '#f3e6ff',
  },
  necro: {
    name: 'Nekromantie', robe: '#2a2a30', shade: '#1b1b20', trim: '#d9d0b8', hood: '#1d1a22', bone: '#ece4cf', hole: '#151515', eye: '#7bff6a',
    boot: '#1b1b20', staff: '#d9d0b8', orb: '#7bff6a', orbCore: '#e0ffd8', glow: '#7bff6a', flashO: '#3fd02a', flashI: '#d8ffd0',
  },
  earth: {
    name: 'Erde', robe: '#7a5230', shade: '#5a3b22', trim: '#c9973a', skin: '#e8b98a', skinS: '#c99766', hair: '#6b4a2a', stone: '#8a7a62', stoneS: '#6a5c48', moss: '#5f8f3a',
    boot: '#3b2a1a', staff: '#5a3b22', orb: '#a08a6a', orbCore: '#d6c4a0', glow: '#c9a36a', flashO: '#a0783a', flashI: '#efe0b8',
  },
  light: {
    name: 'Licht', robe: '#f4f1e6', shade: '#d6d0bd', trim: '#e8b931', skin: '#f3c79a', skinS: '#d9a477', hair: '#c9a36a', sky: '#7cc4ff',
    boot: '#8a7a5a', staff: '#c9a36a', orb: '#ffe27a', orbCore: '#ffffff', glow: '#fff3b0', flashO: '#ffd84a', flashI: '#ffffff',
  },
};
export const SCHOOL_IDS = Object.keys(SCHOOLS);
export const MAGE_ANIMS = { idle: 4, walk: 6, cast: 8 };
export const RELEASE_FRAME = 6;   // 1-basiert: auf diesem Cast-Frame entsteht das Geschoss

// Augen auf der Gesichtsseite
function eyes(K, S, y = -15, x0 = 5, z = 8) {
  for (const s of [-1, 1]) {
    if (!K.face(x0 * s, z)) continue;
    const w = K.dep(x0 * s, z) < 4 ? .7 : 1, thin = ' stroke-width=".7"';
    K.add(2, K.dep(x0 * s, z), ell(K.x(x0 * s, z), y, 3 * w, 3.4, '#fff', thin));
    K.add(2, K.dep(x0 * s, z) + .1, ell(K.x(x0 * s, z + 1.5), y + .5, 1.45 * w, 1.8, '#000', NOSTROKE));
    K.add(2, K.dep(x0 * s, z) + .2, circ(K.x(x0 * s, z + 1.5) + .5, y - .3, .55, '#fff', NOSTROKE));
  }
}
function brows(K, col, y = -19.5) {
  for (const s of [-1, 1]) if (K.face(5 * s, 8)) K.poly(2, [[1.8 * s, y + .3, 9], [8.8 * s, y - .9, 6], [8 * s, y + .9, 7]], col, ' stroke-width=".7"');
}
function skinHead(K, S, backCol) {
  K.blobE(1, 0, -14, -4, 13.5, 13, 13.5, backCol);      // Hinterkopf (Haare/Haube), vorne verdeckt
  K.blobE(1, 0, -14, 0, 13.5, 13, 13, S.skin);
}
function nose(K, S) { if (K.face(0, 13, -1)) K.blobE(2, 0, -11.3, 13, 2.6, 2.2, 2.6, S.skinS); }

const HEADS = {
  fire(K, S) {
    for (const s of [-1, 1]) K.blobE(1, 12.5 * s, -15, -1, 3.6, 4.8, 3.6, S.hair);
    skinHead(K, S, S.hair);
    if (K.c > -0.3) {
      K.smooth(2, [[-10, -11, 7], [-12, 1, 1], [-6, 6, 7], [0, 8, 10], [6, 6, 7], [12, 1, 1], [10, -11, 7], [5, -6, 12], [0, -8, 13], [-5, -6, 12]], S.hair);
      eyes(K, S); brows(K, S.hair);
      K.smooth(2, [[-7.5, -7.2, 11], [0, -9.8, 13], [7.5, -7.2, 11], [0, -7.6, 13.5]], S.hair, '', 20);
      nose(K, S);
    }
    hatPointed(K, S.robe, S.trim, true);
  },
  frost(K, S) {
    K.blobE(1, 0, -17, -2, 15, 17, 15, S.hood);
    if (K.c > -0.2) {
      const fw = (r, t) => Math.hypot(r * K.c, t * K.k);
      K.add(2, 7, ell(K.x(0, 7), -14, fw(12.6, 7.6), 11.6, S.fur));
      K.add(2, 7.1, ell(K.x(0, 8), -13.6, fw(10, 5.6), 9.2, S.face));
      const glow = ' fill-opacity=".35"' + NOSTROKE;
      for (const s of [-1, 1]) if (K.face(4.2 * s, 9, -.5)) {
        const x = K.x(4.2 * s, 9.5);
        K.add(2, 8, circ(x, -13.5, 4 * (K.dep(4.2 * s, 9) < 3 ? .7 : 1), S.eye, glow));
        K.add(2, 8.1, ell(x, -13.5, 2.5 * (K.dep(4.2 * s, 9) < 3 ? .6 : 1), 1.7, S.eye, NOSTROKE));
      }
    }
    // Zipfel mit Fellbommel
    hoodTip(K, [0, -30, -1], [12, -46, -14], 7, S.hood, 3, -50);
    K.blobE(3, 12, -46, -14, 3.6, 3.6, 3.6, S.fur);
    K.blobE(4, 0, -2.5, 0, 13.5, 4.5, 13.5, S.fur);
    if (K.face(0, 12)) K.poly(4, [[0, .5, 13], [2.4, 3.2, 13], [0, 6, 13], [-2.4, 3.2, 13]], S.orb);
  },
  storm(K, S) {
    skinHead(K, S, S.hair);
    if (K.c > -0.3) {
      for (const s of [-1, 1]) if (K.face(5 * s, 8)) {
        const x = K.x(5 * s, 9), w = K.dep(5 * s, 8) < 4 ? .65 : 1;
        K.add(2, K.dep(5 * s, 8), ell(x, -15.5, 4 * w, 4, S.trim));
        K.add(2, K.dep(5 * s, 8) + .1, ell(x, -15.5, 2.6 * w, 2.6, S.glass));
        K.add(2, K.dep(5 * s, 8) + .2, circ(x - .8 * w, -16.3, .8, '#fff', NOSTROKE));
      }
      nose(K, S);
      if (K.face(0, 12)) K.add(2, 12, path(`M${f(K.x(-3, 11))} -6.5 Q${f(K.x(0, 13))} -4.5 ${f(K.x(3, 11))} -6.5`, 'none'));
    }
    // Schal: um den Hals, flattert nach hinten
    K.smooth(4, [[-11, -3, 3], [0, -1, 12], [11, -3, 3], [14, -2, -6], [22, -6, -14], [25, -1, -16], [15, 3, -7]], S.feather, '', K.c > -0.3 ? 20 : -20);
    // breiter Hut mit Feder
    K.blobE(3, 0, -25, 0, 24, 5, 24, S.hat);
    K.blobE(3, 0, -29.5, 0, 12, 7.5, 12, S.hat);
    K.blobE(3, 0, -26.5, 0, 12.4, 2.2, 12.4, S.trim);
    K.smooth(3, [[7, -28, -6], [14, -42, -11], [19, -48, -14], [16, -38, -10], [11, -30, -7]], S.feather, '', 40);
  },
  toxic(K, S) {
    K.blobE(1, 0, -14, 0, 13, 13, 13, S.mask);
    if (K.c > -0.4) {
      for (const s of [-1, 1]) if (K.face(5 * s, 9, -.5)) {
        const x = K.x(5 * s, 10), w = K.dep(5 * s, 9) < 4 ? .6 : 1;
        K.add(2, K.dep(5 * s, 9), ell(x, -17, 3.6 * w, 3.6, S.lens, ' stroke-width="1.8"'));
        K.add(2, K.dep(5 * s, 9) + .1, circ(x - .9 * w, -18, .9, '#fff', NOSTROKE));
      }
      // Schnabel
      K.smooth(2, [[-4.5, -13, 10], [0, -14.5, 11.5], [4.5, -13, 10], [1.8, -8.5, 16], [0, -4, 25], [-1.8, -8.5, 16]], S.beak, '', 30);
      if (K.face(0, 14)) K.add(2, 31, path(`M${f(K.x(0, 12))} -13 L${f(K.x(0, 23))} -5`, 'none', ' stroke-width="1"'));
    }
    K.blobE(4, 0, -2, 0, 14, 5, 14, S.hat);
    // flacher Hut
    K.blobE(3, 0, -25, 0, 19, 4.5, 19, S.hat);
    K.add(3, 0, path(`M-10 -25 L-8 -38 L8 -38 L10 -25 Z`, S.hat));
    K.blobE(3, 0, -38, 0, 8, 2.2, 8, S.hat);
    K.blobE(3, 0, -27.5, 0, 10, 2, 10, S.trim);
  },
  shadow(K, S) {
    K.blobE(1, 0, -16, -2, 15, 17, 15, S.hood);
    hoodTip(K, [0, -29, -1], [0, -47, -10], 6.5, S.hood);
    for (const [x, y, z] of [[-8, -24, 9], [9, -21, 7], [-4, -30, 5], [11, -14, -6], [-10, -12, -8], [0, -26, -12]]) {
      if (K.face(x, z, 1)) K.add(3, 1, poly(star(K.x(x, z), y, 2, .7, 4), S.starC, NOSTROKE));
    }
    if (K.c > -0.2) {
      const fw = (r, t) => Math.hypot(r * K.c, t * K.k);
      K.add(2, 7, ell(K.x(0, 7), -14, fw(10.5, 6), 11, S.hole));
      K.add(2, 7.1, ell(K.x(0, 8.5), -14, fw(8.5, 5), 9.5, S.mask));
      for (const s of [-1, 1]) if (K.face(3.6 * s, 9, .8)) K.add(2, 8, ell(K.x(3.6 * s, 10), -15.5, 2.4 * (K.dep(3.6 * s, 9) < 3 ? .6 : 1), 1, S.hole, NOSTROKE));
      if (K.face(0, 10)) K.add(2, 8.2, path(`M${f(K.x(-3, 9.5))} -9.5 Q${f(K.x(0, 10.5))} -7 ${f(K.x(3, 9.5))} -9.5`, 'none', ' stroke-width="1.2"'));
      if (K.face(-3.6, 9, .8)) K.add(2, 8.3, poly([[K.x(-3.6, 10), -13.5], [K.x(-4.2, 10) - .6, -10.5], [K.x(-3, 10) + .6, -10.5]], S.trim, NOSTROKE));
    }
    K.blobE(4, 0, -2.5, 0, 13.5, 4.5, 13.5, S.robe);
  },
  necro(K, S) {
    K.blobE(1, 0, -16, -1, 15, 17, 15, S.hood);
    if (K.c > -0.2) {
      const fw = (r, t) => Math.hypot(r * K.c, t * K.k);
      K.add(2, 7, ell(K.x(0, 8), -13.5, fw(9.5, 5.5), 10, S.bone));
      for (const s of [-1, 1]) if (K.face(3.8 * s, 9, .8)) {
        const x = K.x(3.8 * s, 10), w = K.dep(3.8 * s, 9) < 3 ? .6 : 1;
        K.add(2, 8, ell(x, -15, 2.8 * w, 3.2, S.hole, NOSTROKE));
        K.add(2, 8.1, circ(x, -15, 1.2, S.eye, NOSTROKE));
      }
      if (K.face(0, 10)) {
        const x = K.x(0, 10.5);
        K.add(2, 8.2, poly([[x, -12], [x - 1.4, -9.8], [x + 1.4, -9.8]], S.hole, NOSTROKE));
        K.add(2, 8.3, rect(x - 4 * Math.max(.4, K.ac), -8.2, 8 * Math.max(.4, K.ac), 3, .8, '#fff', ' stroke-width="1"'));
        for (const t of [-2, 0, 2]) K.add(2, 8.4, line(x + t * Math.max(.4, K.ac), -8.2, x + t * Math.max(.4, K.ac), -5.2, ' stroke-width=".7"'));
      }
    }
    // zerfranster Kragen
    const zig = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * (i / 10); zig.push([-14 * Math.cos(a), i % 2 ? 1 : -3.5, 14 * Math.sin(a) * .6]); }
    K.poly(4, [...zig, [12, -4, 0], [-12, -4, 0]], S.hood);
  },
  earth(K, S) {
    skinHead(K, S, S.hair);
    if (K.c > -0.3) {
      K.smooth(2, [[-10, -9, 7], [-10, -1, 4], [0, 3, 10], [10, -1, 4], [10, -9, 7], [0, -6, 12]], S.hair);
      eyes(K, S, -14.5); brows(K, S.hair, -18.5); nose(K, S);
    }
    // Steinhelm mit Kamm und Moos
    K.blobE(3, 0, -21, 0, 15, 11, 15, S.stone);
    K.blobE(3, 0, -16.5, 0, 15.5, 3, 15.5, S.stoneS);
    K.poly(3, [[-2.5, -31, 9], [2.5, -31, 9], [2.5, -34.5, -9], [-2.5, -34.5, -9]], S.stoneS);
    for (const [x, y, z, r] of [[-7, -27, 7, 3.2], [6, -24, -8, 2.6], [9, -26, 4, 2.2], [-9, -22, -6, 2.4]]) if (K.face(x, z, 1)) K.blobE(3, x, y, z, r, r * .7, r, S.moss, NOSTROKE);
  },
  light(K, S) {
    // Heiligenschein hinter dem Kopf
    K.add(0, -30, ell(0, -40, 13, 3.6, 'none', ` stroke="${S.trim}" stroke-width="2.6"`));
    K.add(0, -29, ell(0, -40, 13, 3.6, 'none', ` stroke="#fff6c8" stroke-width="1" stroke-opacity=".9"`));
    skinHead(K, S, S.hair);
    if (K.c > -0.3) {
      eyes(K, S, -14.5); nose(K, S);
      if (K.face(0, 12)) K.add(2, 12, path(`M${f(K.x(-3.5, 11))} -7 Q${f(K.x(0, 13))} -4.5 ${f(K.x(3.5, 11))} -7`, 'none'));
    }
    // Mitra
    const w = 10 * K.ac + 4.5 * K.ak;
    K.add(3, 0, path(`M${f(-w)} -24 L${f(-w * .9)} -38 Q0 -50 ${f(w * .9)} -38 L${f(w)} -24 Z`, S.robe));
    K.blobE(3, 0, -24.5, 0, 10.5, 2.6, 10.5, S.trim);
    if (K.c > 0.2) {
      const x = K.x(0, 10);
      K.add(3, 1, rect(x - 1.1, -40, 2.2, 10, 0, S.trim, ' stroke-width=".8"'));
      K.add(3, 1, rect(x - 3.5, -37, 7, 2.2, 0, S.trim, ' stroke-width=".8"'));
    }
  },
};

// Zipfel (Kapuze): Basis behält im Bild immer ihre Breite, nur Mitte und Spitze drehen mit
function hoodTip(K, base, apex, w, col, l = 3, d = -40) {
  const bx = K.x(base[0], base[2]), ax = K.x(apex[0], apex[2]), my = (base[1] + apex[1]) / 2;
  const mx = K.x((base[0] + apex[0]) / 2, (base[2] + apex[2]) / 2);
  K.add(l, d, path(`M${f(bx - w)} ${f(base[1])} Q${f(mx - w * .5)} ${f(my)} ${f(ax)} ${f(apex[1])} Q${f(mx + w * .7)} ${f(my + 2)} ${f(bx + w)} ${f(base[1])} Z`, col));
}

// Spitzhut (Feuer): Krempe, gebogene Spitze, Band und Stern
function hatPointed(K, col, trim, starOn) {
  K.blobE(3, 0, -24, 0, 21, 5.5, 21, col);
  const tx = K.x(7, -14), cx1 = K.x(-3, -6);
  K.add(3, .1, path(`M-12 -25 C-10 -34 ${f(cx1)} -42 ${f(tx)} -48 C${f(tx - 3)} -40 9 -32 12 -25 Z`, col));
  K.add(3, .2, path('M-12 -25 Q0 -22 12 -25 L11.3 -28.6 Q0 -25.8 -11.3 -28.6 Z', trim));
  if (starOn && K.face(0, 6, 0)) K.add(3, .3, poly(star(K.x(.5, 6), -34.5, 3.2, 1.3, 5), trim));
}

// ---------- Körper ----------
function feet(K, S, p) {
  return [-1, 1].map(s => {
    const a = s < 0 ? p.fwdL : p.fwdR, lift = s < 0 ? p.liftL : p.liftR;
    return { d: K.dep(6 * s, 0) + a * K.c, el: ell(K.x(6 * s, 0) - 2 * K.k - K.k * a, 17 + K.c * .43 * a - lift, 5 + .5 * K.ak, 3.8, S.boot) };
  }).sort((a, b) => a.d - b.d).map(o => o.el);
}
function robe(K, S, b, lean, school) {
  const tw = 7 + 2 * K.ac, bw = 11 + 3 * K.ac, tx = lean * K.k, back = K.c < -0.3;
  const o = [
    path(`M${f(-tw + tx)} ${f(-4 + b)} L${f(tw + tx)} ${f(-4 + b)} L${f(bw)} ${f(14 + b)} Q0 ${f(18 + b)} ${f(-bw)} ${f(14 + b)} Z`, S.robe),
    path(`M${f(-bw + .8)} ${f(11 + b)} Q0 ${f(15 + b)} ${f(bw - .8)} ${f(11 + b)} L${f(bw)} ${f(14 + b)} Q0 ${f(18 + b)} ${f(-bw)} ${f(14 + b)} Z`, S.trim),
  ];
  if (school === 'necro') {
    // zerfetzter Saum
    const z = []; for (let i = 0; i <= 8; i++) z.push([-bw + i * bw / 4, 14 + b + (i % 2 ? 4 : .5)]);
    o.push(poly([[-bw, 12 + b], ...z, [bw, 12 + b]], S.shade));
  }
  if (K.c > .3) o.push(path(`M0 ${f(6 + b)} L0 ${f(15.5 + b)}`, 'none'));
  const bh = 8.4 + 2.2 * K.ac;
  o.push(rect(-bh + tx * .5, 3 + b, bh * 2, 3.2, 0, back ? S.shade : S.trim, NOSTROKE));
  if (school === 'toxic' && K.c > -0.3) {
    // Fläschchen am Gürtel
    for (const [x, col] of [[-5, '#7be04a'], [1, '#b26bff'], [7, '#ff8a1f']]) if (K.face(x, 8, 0)) o.push(ell(K.x(x, 8.5), 8 + b, 2.2, 2.8, col, ' stroke-width="1"'));
  }
  if (school === 'shadow') for (const [x, y] of [[-6, 8], [5, 1], [8, 11]]) o.push(poly(star(x * (K.ac * .6 + .4), y + b, 1.8, .6, 4), S.trim, NOSTROKE));
  return o;
}
function shoulders(K, S, b, col) {
  // Schulterplatten / Felsbrocken auf den Schultern (Erde, Meister)
  return [-1, 1].map(s => ({ d: K.dep(11 * s, 0), el: ell(K.x(11 * s, 0), -2 + b, Math.hypot(5.5 * K.c, 5.5 * K.k), 4.5, col) }))
    .sort((a, b2) => a.d - b2.d).map(o => o.el);
}
function hand(S, x, y) { return [ell(x, y - 1.5, 4.6, 4.8, S.robe), circ(x, y + 1.5, 3.4, S.skin || S.bone || S.mask || '#f3c79a')]; }

// ---------- Stab und Spitze ----------
function staffPts(hx, hy, ang, top, bot) {
  const a = ang * RAD, dx = Math.sin(a), dy = -Math.cos(a);
  return [[hx + dx * top, hy + dy * top], [hx - dx * bot, hy - dy * bot], [dx, dy]];
}
function drawStaff(S, school, p, hx, hy) {
  const [[tx, ty], [bx, by], [dx, dy]] = staffPts(hx, hy, p.ang, p.top, p.bot);
  const nx = -dy, ny = dx;
  const out = [
    `<path d="M${f(bx)} ${f(by)} L${f(tx)} ${f(ty)}" fill="none" stroke="${OUTLINE}" stroke-width="4.8"/>`,
    `<path d="M${f(bx)} ${f(by)} L${f(tx)} ${f(ty)}" fill="none" stroke="${S.staff}" stroke-width="2.4"/>`,
  ];
  let ox = tx + dx * 3.5, oy = ty + dy * 3.5;
  const g = p.glow;
  const glowEl = (x, y, r = 5.5) => g > 0 ? [circ(x, y, r * g, S.glow, ' fill-opacity=".35"' + NOSTROKE)] : [];
  switch (school) {
    case 'fire':
      out.push(...glowEl(ox, oy));
      out.push(poly([[tx + nx * 4.5 + dx * 2, ty + ny * 4.5 + dy * 2], [tx + nx * 2, ty + ny * 2], [tx, ty], [tx - nx * 2, ty - ny * 2],
        [tx - nx * 4.5 + dx * 2, ty - ny * 4.5 + dy * 2], [tx - nx * 2.5 - dx * 1.5, ty - ny * 2.5 - dy * 1.5], [tx + nx * 2.5 - dx * 1.5, ty + ny * 2.5 - dy * 1.5]], S.staff));
      out.push(circ(ox, oy, 4.2, S.orb), circ(ox - 1, oy - 1, 1.9, S.orbCore, NOSTROKE));
      break;
    case 'frost': {
      out.push(...glowEl(ox, oy));
      const L = 8.5, Wd = 4.6, c0 = [ox + dx, oy + dy];
      out.push(poly([[c0[0] + dx * L, c0[1] + dy * L], [c0[0] + nx * Wd, c0[1] + ny * Wd], [c0[0] - dx * L * .7, c0[1] - dy * L * .7], [c0[0] - nx * Wd, c0[1] - ny * Wd]], S.orb));
      out.push(poly([[c0[0] + dx * L * .75, c0[1] + dy * L * .75], [c0[0] + nx * Wd * .45, c0[1] + ny * Wd * .45], [c0[0] - dx * L * .2, c0[1] - dy * L * .2]], S.orbCore, NOSTROKE));
      out.push(circ(tx, ty, 2.6, S.trim));
      break;
    }
    case 'storm': {
      // Gabel mit Funken dazwischen
      for (const s of [-1, 1]) out.push(path(`M${f(tx)} ${f(ty)} Q${f(tx + nx * 4 * s)} ${f(ty + ny * 4 * s)} ${f(tx + nx * 4 * s + dx * 7)} ${f(ty + ny * 4 * s + dy * 7)}`, 'none', ` stroke="${S.staff}" stroke-width="2.2"`));
      ox = tx + dx * 5; oy = ty + dy * 5;
      out.push(...glowEl(ox, oy, 5));
      out.push(poly(star(ox, oy, 4.2, 1.6, 4, p.sparkPh), S.orb, ' stroke-width="1"'));
      break;
    }
    case 'toxic': {
      // Kolben: Hals + runder Bauch mit Brühe
      ox = tx + dx * 6; oy = ty + dy * 6;
      out.push(...glowEl(ox, oy));
      out.push(rect(tx - 1.6, ty - 1.6, 3.2, 3.2, .8, '#cfe8c0'));
      out.push(circ(ox, oy, 5, '#e8f6ea'));
      out.push(path(`M${f(ox - 4.6)} ${f(oy + .8)} A5 5 0 0 0 ${f(ox + 4.6)} ${f(oy + .8)} Z`, S.orb, NOSTROKE));
      out.push(circ(ox - 1.6, oy - 1.8, 1, '#fff', NOSTROKE));
      break;
    }
    case 'shadow': {
      // schwebende Mondsichel über dem Stab
      ox = tx + dx * 7; oy = ty + dy * 7;
      out.push(...glowEl(ox, oy, 6));
      const a = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      out.push(group(path('M-5 -4 A6 6 0 1 0 5 -4 A4.6 4.6 0 1 1 -5 -4 Z', S.orb), ` transform="translate(${f(ox)} ${f(oy)}) rotate(${f(a)})"`));
      out.push(circ(tx, ty, 1.8, S.trim));
      break;
    }
    case 'necro': {
      ox = tx + dx * 4.5; oy = ty + dy * 4.5;
      out.push(...glowEl(ox, oy));
      out.push(circ(ox, oy, 4.6, S.bone));
      out.push(rect(ox - 2.4, oy + 2.6, 4.8, 2.4, .6, S.bone, ' stroke-width="1"'));
      for (const s of [-1, 1]) out.push(circ(ox + 1.7 * s, oy - .3, 1.2, S.eye, NOSTROKE));
      break;
    }
    case 'earth': {
      ox = tx + dx * 5; oy = ty + dy * 5;
      out.push(...glowEl(ox, oy, 6));
      for (const s of [-1, 1]) out.push(path(`M${f(tx)} ${f(ty)} Q${f(tx + nx * 3 * s - dx * 3)} ${f(ty + ny * 3 * s - dy * 3)} ${f(tx + nx * 4 * s - dx * 7)} ${f(ty + ny * 4 * s - dy * 7)}`, 'none', ` stroke="${S.staff}" stroke-width="1.4"`));
      out.push(poly([[ox - 5.5, oy - 1], [ox - 2.5, oy - 5.5], [ox + 3, oy - 5], [ox + 5.8, oy - .5], [ox + 3.5, oy + 4.5], [ox - 3, oy + 4.8]], S.orb));
      out.push(poly([[ox - 2.5, oy - 3.5], [ox + 1.5, oy - 3.6], [ox - .5, oy - .5]], S.orbCore, NOSTROKE));
      break;
    }
    case 'light': {
      ox = tx + dx * 5; oy = ty + dy * 5;
      out.push(...glowEl(ox, oy, 7));
      out.push(poly(star(ox, oy, 8, 4.4, 8, p.sparkPh * .3), S.trim, ' stroke-width="1"'));
      out.push(circ(ox, oy, 4, S.orb), circ(ox - 1, oy - 1, 1.6, '#fff', NOSTROKE));
      break;
    }
  }
  return [out, [ox, oy]];
}
function drawFx(S, p, ox, oy) {
  const out = [];
  if (p.ring > 0) out.push(circ(ox, oy, p.ring, 'none', ` stroke="${S.glow}" stroke-width="1.4" stroke-opacity=".9"`));
  for (let i = 0; i < p.spark; i++) {
    const a = p.sparkPh + i * 2 * Math.PI / p.spark, r = 9 + 2 * Math.sin(a * 2);
    out.push(poly(star(ox + r * Math.cos(a), oy + r * Math.sin(a), 2.6, .8, 4, a), S.flashI, ` stroke="${S.flashO}" stroke-width=".8"`));
  }
  if (p.flash > 0) {
    out.push(poly(star(ox, oy, p.flash, p.flash * .5, 8, p.sparkPh), S.flashO));
    out.push(poly(star(ox, oy, p.flash * .65, p.flash * .32, 8, p.sparkPh + .2), S.flashI, NOSTROKE));
  }
  if (p.puff > 0) for (const [ax, ay] of [[-1, -1], [1, -.6], [0, 1]]) out.push(circ(ox + ax * 4 * p.puff, oy + ay * 4 * p.puff, 2.2 + p.puff, '#d9d4cc', ' fill-opacity=".7"' + NOSTROKE));
  return out;
}

// ---------- Posen (aus mages.py) ----------
function pose(o) {
  return { bob: 0, fwdL: 0, fwdR: 0, liftL: 0, liftR: 0, hs: null, hf: null, ang: 0, top: 30, bot: 16, glow: 1, spark: 0, sparkPh: 0, ring: 0, flash: 0, puff: 0, lean: 0, ...o };
}
const BASE_HANDS = { down: { hs: [-16, 4], hf: [15, 4] }, up: { hs: [16, 4], hf: [-15, 4] }, left: { hs: [-14, 4], hf: null } };

function canonPoses(anim, d) {
  if (anim === 'idle') return [0, .6, 1.1, .6].map((b, i) => pose({ bob: b, glow: [1, 1.12, 1.25, 1.12][i], ang: d === 'left' ? -10 : 0 }));
  if (anim === 'walk') {
    return [0, 1, 2, 3, 4, 5].map(i => {
      const s = Math.sin(2 * Math.PI * i / 6), h = BASE_HANDS[d];
      const p = pose({ bob: 1.3 * Math.abs(s), fwdL: -6 * s, fwdR: 6 * s, liftL: 1.8 * Math.max(0, s), liftR: 1.8 * Math.max(0, -s) });
      if (d === 'left') { p.hs = [h.hs[0] - 1.5 * s, h.hs[1]]; p.ang = -10 + 4 * s; }
      else { p.hs = [h.hs[0], h.hs[1] - 1.5 * s]; p.hf = [h.hf[0], h.hf[1] + 2.6 * s]; }
      return p;
    });
  }
  if (d === 'down') return [
    pose({ bob: 1.2, hs: [-15, 5], ang: -12, glow: 1.2, hf: [14, 6] }),
    pose({ bob: -.5, hs: [-12, -4], ang: 12, top: 27, glow: 1.5, spark: 3, ring: 12, hf: [17, -2] }),
    pose({ bob: -1, hs: [-11, -7], ang: 16, top: 27, glow: 1.7, spark: 4, sparkPh: .8, ring: 9, hf: [18, -5] }),
    pose({ bob: -1, hs: [-11, -7], ang: 16, top: 27, glow: 2.0, spark: 4, sparkPh: 1.6, ring: 5.5, hf: [18, -6] }),
    pose({ bob: 1.5, hs: [-12, 0], ang: 155, top: 9, bot: 12, glow: 1.6, flash: 9, sparkPh: .2, hf: [16, 2] }),
    pose({ bob: 1.8, hs: [-12, 0], ang: 155, top: 9, bot: 12, glow: .6, flash: 13, sparkPh: .6, hf: [16, 3] }),
    pose({ bob: .8, hs: [-13, 2], ang: 60, top: 20, bot: 14, glow: .8, puff: 1, hf: [15, 4] }),
    pose({ bob: .3, hs: [-16, 4], ang: -4, glow: 1, puff: 1.8, hf: [15, 4] }),
  ];
  if (d === 'up') return [
    pose({ bob: 1.2, hs: [15, 5], ang: 10, glow: 1.2, hf: [-14, 6] }),
    pose({ bob: -.5, hs: [14, -3], ang: 16, top: 28, glow: 1.5, spark: 3, ring: 12, hf: [-17, -2] }),
    pose({ bob: -1, hs: [13, -6], ang: 18, top: 28, glow: 1.8, spark: 4, sparkPh: .8, ring: 8.5, hf: [-18, -5] }),
    pose({ bob: -1, hs: [13, -6], ang: 18, top: 28, glow: 2.2, spark: 4, sparkPh: 1.6, ring: 5.5, hf: [-18, -6] }),
    pose({ bob: -1, hs: [14, -7], ang: 22, top: 27, glow: 1.6, flash: 9, sparkPh: .2, hf: [-16, -1] }),
    pose({ bob: -1, hs: [14, -7], ang: 22, top: 27, glow: .6, flash: 12, sparkPh: .6, hf: [-16, 0] }),
    pose({ bob: .5, hs: [15, -1], ang: 14, glow: .8, puff: 1, hf: [-15, 3] }),
    pose({ bob: .2, hs: [16, 4], ang: 6, glow: 1, puff: 1.8, hf: [-15, 4] }),
  ];
  return [
    pose({ bob: 1.2, hs: [-9, 4], ang: 18, glow: 1.2, lean: 1.5 }),
    pose({ bob: -.5, hs: [-8, -3], ang: 30, glow: 1.5, spark: 3, ring: 13, lean: 2 }),
    pose({ bob: -1, hs: [-8, -5], ang: 34, glow: 1.8, spark: 4, sparkPh: .8, ring: 9, lean: 2 }),
    pose({ bob: -1, hs: [-8, -5], ang: 34, glow: 2.2, spark: 4, sparkPh: 1.6, ring: 5.5, lean: 2 }),
    pose({ bob: .8, hs: [-14, 0], ang: -62, top: 19, glow: 1.6, flash: 9, sparkPh: .2, lean: -2.5 }),
    pose({ bob: 1, hs: [-14, 0], ang: -62, top: 19, glow: .6, flash: 11.5, sparkPh: .6, lean: -3 }),
    pose({ bob: .6, hs: [-15, 2], ang: -35, glow: .8, puff: 1, lean: -1.5 }),
    pose({ bob: .2, hs: [-14, 4], ang: -12, glow: 1, puff: 1.8, lean: 0 }),
  ];
}
// Schrägansichten: Posen der Nachbarn mitteln
function mixPose(a, b) {
  const o = {};
  for (const key of Object.keys(a)) {
    const x = a[key], y = b[key];
    if (Array.isArray(x) || Array.isArray(y)) {
      const xx = x || BASE_HANDS.left.hs, yy = y || [-2, 4];
      o[key] = [lerp(xx[0], yy[0], .5), lerp(xx[1], yy[1], .5)];
    } else o[key] = typeof x === 'number' ? lerp(x, y, .5) : x;
  }
  return o;
}
export function magePoses(anim, d) {
  if (d === 'downleft') { const A = canonPoses(anim, 'down'), B = canonPoses(anim, 'left'); return A.map((p, i) => mixPose(p, { ...B[i], hf: B[i].hf || [-2, 4] })); }
  if (d === 'upleft') { const A = canonPoses(anim, 'left'), B = canonPoses(anim, 'up'); return A.map((p, i) => mixPose({ ...p, hf: p.hf || [-2, 4] }, B[i])); }
  return canonPoses(anim, d);
}

// ---------- ganzer Magier ----------
// Ergebnis: [SVG-Teile, Position der Stabspitze]
export function drawMage(school, d, p, { master = false, clone = false } = {}) {
  const S = SCHOOLS[school], th = DRAWN[d] * RAD, K = kit(th);
  const b = p.bob, L = p.lean, base = d === 'downleft' ? 'down' : d === 'upleft' ? 'up' : d;
  const hs = p.hs || BASE_HANDS[base === 'up' ? 'up' : base === 'left' ? 'left' : 'down'].hs;
  const hf = p.hf !== undefined && p.hf !== null ? p.hf : (base === 'left' ? null : BASE_HANDS[base].hf);
  // Klone (Spiegelmagier) haben keinen Schatten am Boden – daran erkennt man den echten
  const o = [...(clone ? [] : [ell(0, 20, 17 * (master ? 1.1 : 1), 6, '#000', ' fill-opacity=".3"' + NOSTROKE)]), ...feet(K, S, p)];
  const [staff, orb] = drawStaff(S, school, p, hs[0], hs[1] + b);
  const fx = drawFx(S, p, ...orb);
  // Kopf mit Neigung beim Zaubern (seitlich)
  HEADS[school](K, S);
  const head = group(K.out(), ` transform="translate(${f(L * K.k)} ${f(b)})"`);
  const body = robe(K, S, b, L, school);
  const extra = school === 'earth' ? shoulders(K, S, b, S.stone) : master ? shoulders(K, S, b, S.trim) : [];
  const freeHand = hf ? hand(S, hf[0], hf[1] + b) : [];
  if (K.c < -0.3) o.push(...staff, ...fx, ...body, ...extra, head, ...freeHand, ...hand(S, hs[0], hs[1] + b));
  else if (base === 'left') o.push(...body, ...extra, head, ...staff, ...hand(S, hs[0], hs[1] + b), ...fx);
  else o.push(...body, ...extra, head, ...freeHand, ...staff, ...hand(S, hs[0], hs[1] + b), ...fx);
  // ganze Figur 4 nach unten, damit sie wie der Goblin mittig sitzt
  return [[group(o, ' transform="translate(0 4)"')], [orb[0], orb[1] + 4]];
}

export function mageSvg(school, dir, anim, i, opt) {
  const base = MIRROR[dir] || dir;
  return svgDoc(drawMage(school, base, magePoses(anim, base)[i], opt)[0], { flip: !!MIRROR[dir] });
}
// Abschusspunkt (Stabspitze im Release-Frame) je Richtung, in Sprite-Einheiten relativ zur Mitte
export function castOffsets(school, opt) {
  const out = {};
  for (const d of Object.keys(DRAWN)) {
    const [, [x, y]] = drawMage(school, d, magePoses('cast', d)[RELEASE_FRAME - 1], opt);
    out[d] = [x, y];
    const m = Object.keys(MIRROR).find(r => MIRROR[r] === d);
    if (m) out[m] = [-x, y];
  }
  return out;
}
