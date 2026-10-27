// Goblin-Generator: 8 Blickrichtungen, Ebenen für Kosmetik, alle Animationen.
// Kopf, Ohren, Gesicht und Hut sind Punkte im Figur-Raum (x, y, z), die je Richtung
// um die Hochachse gedreht werden (siehe turn). down/left/up entsprechen den alten Sprites.
import { DRAWN, MIRROR, NOSTROKE, circ, ell, f, group, line, path, poly, rect, star, svgDoc, turn } from './svg.js';

// ---------- Kosmetik (PLAN 9.7, Namen und Quellen in data/cosmetics.js) ----------
export const SKINS = {
  green: { skin: '#6fc23a', dark: '#4f9a2a' }, moss: { skin: '#7d9a3a', dark: '#5a7228' }, cave: { skin: '#8a948c', dark: '#646d66' },
  swamp: { skin: '#4fa0a8', dark: '#367a80' }, fire: { skin: '#e0583a', dark: '#a83a22' }, gold: { skin: '#f0c93a', dark: '#b8901a' },
};
// trim: Zierfarbe (Knöpfe, Krawatte, Nieten), plate: Rüstungsglanz
export const OUTFITS = {
  vest: { body: '#8a5a32', belt: '#3b2414', boot: '#5a3a22' },
  rags: { body: '#9a8a62', belt: '#5a4a2a', boot: '#4a3a22', patch: '#6a5a3a' },
  suit: { body: '#2a2d36', belt: '#16181e', boot: '#16181e', trim: '#d63a3a', deco: 'tie' },
  overall: { body: '#3a6ab0', belt: '#24467a', boot: '#3a2a1a', trim: '#e8c35a', deco: 'straps' },
  knight: { body: '#a8b0b8', belt: '#5a6068', boot: '#6a7078', plate: '#e8eef2' },
};
// shape: Form im Generator (siehe hatShape)
export const HATS = {
  zipfel: { col: '#7b3fc4', shape: 'zipfel' }, chef: { col: '#f4f4ee', shape: 'chef' }, pot: { col: '#8a9298', shape: 'pot' },
  pirate: { col: '#26232a', shape: 'pirate', trim: '#e8d36a' }, viking: { col: '#9aa3aa', shape: 'viking', trim: '#efe6c8' },
  wizard: { col: '#2a3a8a', shape: 'wizard', trim: '#ffd84a' }, crown: { col: '#f4c430', shape: 'crown', trim: '#d63a3a' },
};
export const DEFAULT_LOOK = { skin: 'green', outfit: 'vest', hat: 'zipfel', cls: 'gob', gold: false };

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
    // Klassen (Phase 9): Bogen, Stab oder Keule immer in der rechten Hand; sonst der Dolch beim Jubeln
    const item = s > 0 && clsItem(look.cls, hx, hy, look.gold, S.skin);
    if (!item && s > 0 && p.dagger) el.unshift(dagger(hx, hy));
    return { d: d + h * c, el, up: (s < 0 ? p.handLiftL : p.handLiftR) > 8, item };
  });
  // Klassenwaffe: in der vorderen Hand vor dem Kopf (Stab und Bogen ragen über ihn), in der hinteren hinter dem Körper
  const itemBack = hands.filter(h => h.item && h.d < -2 && !h.up).map(h => h.item);
  // von hinten gesehen verdeckt der Kopf den Gegenstand
  const itemFront = hands.filter(h => h.item && (h.d >= -2 || h.up)).map(h => h.item), itemMid = c > -0.2 ? [] : itemFront.splice(0);
  const handsBack = hands.filter(h => h.d < -2 && !h.up).flatMap(h => h.el);
  const handsFront = hands.filter(h => h.d >= -2 && !h.up).flatMap(h => h.el);
  const handsTop = hands.filter(h => h.up).flatMap(h => h.el);

  // Körper (Outfit-Ebene)
  const bw = 18 + 4 * ac + (look.cls === 'war' ? 3 : 0);   // Krieger etwas breiter
  const body = [rect(-bw / 2, -2, bw, 20, 6, O.body), rect(-bw / 2 + 1, 9, bw - 2, 4, 0, O.belt, NOSTROKE)];
  // Outfit-Details auf der Vorderseite (wandern mit der Drehung zur Seite)
  if (c > -0.2) {
    const [mx] = T(0, 9), w = 1 - .5 * ak;
    if (O.deco === 'tie') body.push(poly([[mx - 2.5 * w, -1], [mx + 2.5 * w, -1], [mx + 1.8 * w, 8], [mx, 10], [mx - 1.8 * w, 8]], O.trim, ' stroke-width="1"'));   // Krawatte
    else if (O.deco === 'straps') for (const s of [-1, 1]) { const [sx] = T(5 * s, 8); body.push(line(sx, -2, sx, 9, ` stroke="${O.belt}" stroke-width="2.4"`), circ(sx, 1, 1.3, O.trim, NOSTROKE)); }   // Träger
    if (O.plate) { body.push(rect(mx - 6 * w, 0, 12 * w, 7, 3, O.plate, ' stroke-width="1.2"')); for (const s of [-1, 1]) body.push(circ(mx + s * 7 * w, 5, 1.2, '#5a6068', NOSTROKE)); }
    if (O.patch) { const [px] = T(-4, 9); body.push(rect(px - 3, 2, 6, 5, 1, O.patch, ' stroke-width="1"')); }
  }
  // Klassen-Ausstattung am Körper: Robe (Magier), Fellkragen (Krieger), Köcher (Bogen, s. back)
  if (look.cls === 'mage') body.push(path(`M${f(-bw / 2)} 11 L${f(-bw / 2 - 3)} 21 Q0 24 ${f(bw / 2 + 3)} 21 L${f(bw / 2)} 11Z`, '#4a3a8a'), line(-bw / 2 - 2, 19, bw / 2 + 2, 19, ' stroke="#ffd84a" stroke-width="1.4"'));
  if (look.cls === 'war') for (const sd of [-1, 1]) { const [sx, sdp] = T(13 * sd, 0); if (sdp > -12) body.push(ell(sx, 4, 6.5, 5, '#8a6a44'), path(`M${f(sx - 6)} 6 l2 3 l2 -2 l2 3 l2 -2 l2 3`, 'none', ' stroke="#5a4428" stroke-width="1"')); }
  const back = [];
  if (look.cls === 'bow') {
    // Köcher auf dem Rücken: von vorn der Gurt quer über die Brust, von hinten der Köcher mit Pfeilen über der Schulter
    if (c > -0.2) { const [ax] = T(-8, 9), [bx] = T(8, 9); body.push(line(bx, -1, ax, 12, ' stroke="#3b2414" stroke-width="2.6"')); }
    else {
      const [qx] = T(-6, -9), g = [line(-2, -8, -4, -16, ' stroke="#e5484d" stroke-width="2.6"'), line(1, -8, 1, -18, ' stroke="#f2ead6" stroke-width="2.6"'), line(4, -8, 6, -15, ' stroke="#e5484d" stroke-width="2.6"'), rect(-5, -9, 10, 24, 2, '#6b4424')];
      back.push(group(g, ` transform="translate(${f(qx)} 0) rotate(-18)"`));
    }
  }
  if (O.patch) body.push(poly([[-bw / 2, 15], [-bw / 4, 19], [0, 15], [bw / 4, 19], [bw / 2, 15], [bw / 2, 18], [-bw / 2, 18]], O.body, NOSTROKE));   // ausgefranster Saum

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

  // Hut (Ebene "hat")
  const hat = hatShape(H, p.hatHop, { k, c, ak, ac, T });

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
    group(itemBack, ' id="item-back"'),
    group(handsBack, ' id="arms-back"'),
    group(body, ' id="outfit"'),
    group(handsFront, ' id="arms-front"'),
    group(itemMid, ' id="item-mid"'),
    group(byDepth(earsBack), ' id="ears-back"'),
    group(head, ' id="head"'),
    group(back, ' id="gear-back"'),
    group(hat, ' id="hat"'),
    group(byDepth(earsFront), ' id="ears-front"'),
    group(face, ' id="face"'),
    group(itemFront, ' id="item"'),
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

// Hutformen. Kappe/Kuppel liegt auf dem Kopf (Mitte y -13, Radius ~16), alles Weitere darüber.
function hatShape(H, hy, { k, c, ak, ac, T }) {
  const out = [], rx = 16 + 2 * ac, front = c > -0.1, col = H.col;
  // Kappe wie bei der Zipfelmütze (vorn als Kuppel bis zur Stirn, hinten den Kopf bedeckend)
  const cap = (fill, top = 21) => front
    ? path(`M${f(-rx)} ${f(-13 + hy)} A${f(rx)} ${f(15 + 2 * ac)} 0 0 1 ${f(rx)} ${f(-13 + hy)} Q0 ${f(-top + hy)} ${f(-rx)} ${f(-13 + hy)}Z`, fill)
    : ell(3 * k, -12 + hy, rx, 15.5, fill);
  switch (H.shape) {
    case 'zipfel': {
      out.push(cap(col));
      const [bc] = T(2, -7), [ax] = T(3, -14);
      out.push(poly([[bc - 6, -28 + hy], [ax, -41 + hy], [bc + 6, -27 + hy]], col));
      if (!front) { const cx = 3 * k, w = 10 * ac; out.push(line(cx - w, -7 + hy, cx + w, -7 + hy)); }
      break;
    }
    case 'chef': {
      // weißer Bund, darüber drei Puffs
      out.push(rect(-rx + 2, -30 + hy, 2 * rx - 4, 10, 3, col));
      for (const [x, y, r] of [[-8, -34, 7], [8, -34, 7], [0, -37, 7.5]]) { const [tx] = T(x, 0); out.push(circ(tx, y + hy, r, col)); }   // oben bleibt Platz fürs Hüpfen
      out.push(line(-rx + 4, -25 + hy, rx - 4, -25 + hy, ' stroke="#c9c9c0" stroke-width="1.4"'));
      break;
    }
    case 'pot': {
      out.push(rect(-rx + 1, -33 + hy, 2 * rx - 2, 16, 3, col), rect(-rx - 2, -19 + hy, 2 * rx + 4, 4, 2, '#6d747c'));
      for (const s of [-1, 1]) { const [hx, hd] = T((rx + 3) * s, 0); if (hd > -8) out.push(rect(hx - 4, -29 + hy, 8, 3.5, 1.5, '#3d4148')); }   // Griffe
      out.push(path(`M${f(-rx + 4)} ${f(-30 + hy)} Q0 ${f(-33 + hy)} ${f(rx - 4)} ${f(-30 + hy)}`, 'none', ' stroke="#c9d1d8" stroke-width="1.6"'));
      break;
    }
    case 'pirate': {
      // Dreispitz: breite Krempe, hohe Krone, Totenkopf vorn
      out.push(cap(col, 30));
      out.push(path(`M${f(-rx - 8)} ${f(-22 + hy)} Q0 ${f(-14 + hy)} ${f(rx + 8)} ${f(-22 + hy)} Q${f(rx * .5)} ${f(-31 + hy)} 0 ${f(-27 + hy)} Q${f(-rx * .5)} ${f(-31 + hy)} ${f(-rx - 8)} ${f(-22 + hy)}Z`, col));
      if (front && c > .3) { const [sx] = T(0, 16); out.push(circ(sx, -24 + hy, 3.2, '#f2f0e8', ' stroke-width="1"'), line(sx - 3, -20 + hy, sx + 3, -18 + hy, ' stroke="#f2f0e8" stroke-width="1.2"')); }
      out.push(path(`M${f(-rx - 6)} ${f(-21 + hy)} Q0 ${f(-14 + hy)} ${f(rx + 6)} ${f(-21 + hy)}`, 'none', ` stroke="${H.trim}" stroke-width="1.6"`));
      break;
    }
    case 'viking': {
      out.push(cap(col, 26));
      out.push(path(`M${f(-rx)} ${f(-14 + hy)} Q0 ${f(-19 + hy)} ${f(rx)} ${f(-14 + hy)}`, 'none', ' stroke="#5d636b" stroke-width="4"'));
      for (const s of [-1, 1]) {
        const [hx, hd] = T(15 * s, 0);
        if (hd < -6 && ak < .5) continue;
        const o = Math.sign(hx || s);
        out.push(path(`M${f(hx)} ${f(-24 + hy)} Q${f(hx + 12 * o)} ${f(-26 + hy)} ${f(hx + 14 * o)} ${f(-40 + hy)} Q${f(hx + 6 * o)} ${f(-31 + hy)} ${f(hx - 2 * o)} ${f(-30 + hy)}Z`, H.trim));
      }
      break;
    }
    case 'wizard': {
      // breite Krempe, hoher geknickter Spitzhut mit Stern (Trophäe von Malvorn)
      out.push(ell(3 * k * (front ? 0 : 1), -19 + hy, rx + 9, 6, col));
      const [bc] = T(0, -3), [ax] = T(6, -10);
      out.push(path(`M${f(bc - 13)} ${f(-21 + hy)} L${f(ax + 4)} ${f(-43 + hy)} Q${f(ax + 13)} ${f(-48 + hy)} ${f(ax + 15)} ${f(-41 + hy)} L${f(ax + 8)} ${f(-40 + hy)} L${f(bc + 13)} ${f(-21 + hy)}Z`, col));
      if (front) out.push(poly(star(T(0, 12)[0] + 1, -29 + hy, 4, 1.6, 5, 0), H.trim, ' stroke-width="1"'));
      break;
    }
    case 'crown': {
      // Goldreif mit fünf Zacken und roten Steinen
      const pts = [[-rx + 3, -18]];
      for (let i = 0; i <= 8; i++) pts.push([-rx + 3 + i * (2 * rx - 6) / 8, i % 2 ? -26 : -35]);
      pts.push([rx - 3, -18]);
      out.push(poly(pts.map(([x, y]) => [x, y + hy]), col));
      if (c > .6) for (const x of [-8, 0, 8]) { const [tx, td] = T(x, 14); if (td > 2) out.push(circ(tx, -22 + hy, 2.2, H.trim, ' stroke-width="1"')); }
      break;
    }
  }
  return out;
}

// Klassenwaffe in der Hand (gold: Klassen-Level 20)
function clsItem(cls, hx, hy, gold, skin) {
  const hand = circ(0, 0, 5, skin), wood = gold ? '#f4c430' : '#8a5a32', t = ` transform="translate(${f(hx)} ${f(hy)})"`;
  if (cls === 'bow') return group([path('M3 -17 Q13 0 3 17', 'none', ' stroke-width="5"'), path('M3 -17 Q13 0 3 17', 'none', ` stroke="${wood}" stroke-width="2.6"`), line(3, -17, 3, 17, ' stroke="#f2ead6" stroke-width=".9"'), hand], t);
  if (cls === 'mage') return group([line(1, 12, 3, -22, ' stroke-width="4.6"'), line(1, 12, 3, -22, ` stroke="${gold ? '#f4c430' : '#6b4424'}" stroke-width="2.4"`), poly([[3, -31], [7, -24], [3, -18], [-1, -24]], '#a77bff', ' stroke-width="1.4"'), circ(3, -24, 7, '#b48cff', ' fill-opacity=".3"' + NOSTROKE), hand], t);
  if (cls === 'war') return group([line(0, 8, 5, -10, ' stroke-width="5.4"'), line(0, 8, 5, -10, ' stroke="#5a3a22" stroke-width="3"'), path('M1 -7 Q-3 -26 9 -30 Q20 -23 10 -6Z', gold ? '#f4c430' : '#a8763e', ' stroke-width="1.8"'), circ(6, -20, 1.6, '#c9d1d8', ' stroke-width=".7"'), circ(11, -13, 1.6, '#c9d1d8', ' stroke-width=".7"'), hand], t);
  return null;
}
function dagger(hx, hy) {
  // Dolch nach oben in der Hand
  return group([
    poly([[-2.2, -4], [0, -20], [2.2, -4]], '#d6dde2'),
    line(0, -18, 0, -6, ' stroke="#9aa4ad" stroke-width=".8"'),
    rect(-5, -4.5, 10, 2.6, 1, '#c9973a'),
  ], ` transform="translate(${f(hx)} ${f(hy - 2)})"`);
}

// Hut auf der Kugel (Kopf oben bei y -9): Kappe in Hutfarbe plus das Kennzeichen der Form
function ballHat(H) {
  const cap = path('M-12 -3 A15 15 0 0 1 12 -3 Q0 1 -12 -3Z', H.col), c = H.col;
  switch (H.shape) {
    case 'chef': return [rect(-11, -10, 22, 7, 2, c), circ(-6, -13, 5, c), circ(6, -13, 5, c), circ(0, -16, 5.5, c)];
    case 'pot': return [rect(-12, -14, 24, 11, 2, c), rect(-14, -5, 28, 3, 1, '#6d747c')];
    case 'pirate': return [cap, path('M-19 -2 Q0 4 19 -2 Q8 -9 0 -7 Q-8 -9 -19 -2Z', c)];
    case 'viking': return [cap, path('M-11 -4 Q-20 -6 -20 -16 Q-15 -9 -9 -9Z', H.trim), path('M11 -4 Q20 -6 20 -16 Q15 -9 9 -9Z', H.trim)];
    case 'wizard': return [ell(0, -3, 19, 4, c), poly([[-9, -4], [4, -24], [9, -4]], c)];
    case 'crown': return [poly([[-11, -2], [-11, -9], [-7, -5], [-3, -12], [0, -6], [3, -12], [7, -5], [11, -9], [11, -2]], c)];
    default: return [cap, poly([[2, -8], [13, -19], [10, -5]], c)];
  }
}
function ball(angle, S, O, H) {
  return [group([
    poly([[-6, -8], [-20, -20], [-11, 0]], S.dark),
    poly([[7, -7], [23, -15], [12, 3]], S.skin),
    circ(0, 6, 15, S.skin),
    path('M-14.5 9.5 A15 15 0 0 0 14.5 9.5 Q0 14 -14.5 9.5Z', O.body),
    ...ballHat(H),
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
