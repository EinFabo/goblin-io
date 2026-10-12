import { DPR, H, W, ctx, drawSpr } from './canvas.js';
import { SPR } from './sprites.js';

// ---------- Ladebildschirm: der Goblin rennt, Feuermagier hinterher ----------
// Gezeichnet in Bildschirm-Koordinaten. Die Wiese zieht nach links, der Goblin bleibt an seinem Platz.
// Feuerbälle fliegen ihm nach; kurz vor dem Einschlag hüpft er drüber.
const SPEED = 280;
const dust = [], balls = [];
let lastT = 0, nextBall = 1.2, hopT = -1;

export function renderLoading(t) {
  const dt = Math.min(.05, Math.max(0, t - lastT)); lastT = t;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const gy = Math.round(H * .64), sc = Math.max(1, Math.min(1.8, W / 700));

  // Himmel und Hügel
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, '#0f170b'); sky.addColorStop(1, '#22341a');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy);
  hills(t * SPEED * .15, gy, 70, '#1a2914', 260);
  hills(t * SPEED * .35, gy, 40, '#24391b', 170);

  // Wiese mit vorbeiziehenden Grasbüscheln und Steinen
  ctx.fillStyle = '#2f4a1f'; ctx.fillRect(0, gy, W, H - gy);
  ctx.fillStyle = '#3c5e27'; ctx.fillRect(0, gy, W, 6);
  const off = (t * SPEED) % 64;
  for (let row = 0; row < 4; row++) {
    const y = gy + 18 + row * 34, k = 1 + row * .35, o = (t * SPEED * k) % (90 * k);
    for (let x = -o; x < W + 40; x += 90 * k) {
      const j = Math.sin((x + o + row * 77) * 12.9898 + row) * 43758.5453 % 1;
      tuft(x + j * 30, y + j * 8, (5 + row * 2) * (.8 + Math.abs(j) * .5));
    }
  }
  ctx.fillStyle = 'rgba(160,170,150,.5)';
  for (let x = -off * 2.2; x < W; x += 140) { ctx.beginPath(); ctx.ellipse(x + 40, gy + 70, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); }

  // Goblin (mit Hüpfer, wenn ein Feuerball naht)
  const gx = W * .64;
  let hop = 0;
  if (hopT >= 0) { hopT += dt; const p = hopT / .45; hop = p < 1 ? Math.sin(p * Math.PI) * 46 * sc : 0; if (p >= 1) hopT = -1; }
  if (Math.random() < dt * 30 && !hop) dust.push({ x: gx - 14 * sc, y: gy - 4, vx: -SPEED * .6 - Math.random() * 60, vy: -20 - Math.random() * 40, t: 0, s: 4 + Math.random() * 5 });
  for (const d of dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 60 * dt; }
  while (dust.length && dust[0].t > .6) dust.shift();
  for (const d of dust) { ctx.fillStyle = `rgba(210,200,160,${.5 * (1 - d.t / .6)})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.s * (1 + d.t), 0, Math.PI * 2); ctx.fill(); }
  shadow(gx, gy, 26 * sc * (1 - hop / (120 * sc)));
  drawSpr(`gob.sprint.right.${(Math.floor(t * 14) % 6) + 1}`, gx, gy - 30 * sc - hop, sc * 1.5);

  // Feuermagier hinterher (sobald ihre Bilder da sind)
  const mages = [[.2, .0], [.32, 1.7], [.1, 3.1]];
  for (const [fx, ph] of mages) {
    const mx = W * fx + Math.sin(t * .8 + ph) * 26 * sc, my = gy;
    if (!SPR['m.fire.walk.right.1']) continue;
    shadow(mx, my, 20 * sc);
    drawSpr(`m.fire.walk.right.${(Math.floor(t * 10 + ph * 3) % 6) + 1}`, mx, my - 30 * sc, sc * 1.25);
  }

  // Feuerbälle: fliegen schneller als der Goblin, er hüpft rechtzeitig
  nextBall -= dt;
  if (nextBall <= 0 && SPR['m.fire.walk.right.1']) {
    nextBall = 1.6 + Math.random() * 1.2;
    const [fx, ph] = mages[(Math.random() * mages.length) | 0];
    balls.push({ x: W * fx + Math.sin(t * .8 + ph) * 26 * sc + 20 * sc, y: gy - 44 * sc, t: 0 });
  }
  for (const b of balls) {
    b.t += dt; b.x += 520 * sc * dt;
    if (hopT < 0 && b.x > gx - 120 * sc && b.x < gx) hopT = 0;
  }
  while (balls.length && balls[0].x > W + 60) balls.shift();
  for (const b of balls) {
    if (SPR.f_fireball_1) drawSpr(`f_fireball_${(Math.floor(b.t * 14) % 4) + 1}`, b.x, b.y, sc * 1.2, 0);
    else { ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.arc(b.x, b.y, 9 * sc, 0, Math.PI * 2); ctx.fill(); }
  }

  // Vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function hills(o, gy, h, col, period) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, gy);
  for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, gy - h * (.55 + .45 * Math.sin((x + o) / period) * Math.sin((x + o) / (period * .37))));
  ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
}
function tuft(x, y, s) {
  ctx.strokeStyle = '#5c8a35'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * .6, y); ctx.lineTo(x - s, y - s * 1.3); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 1.7); ctx.moveTo(x + s * .6, y); ctx.lineTo(x + s, y - s * 1.2); ctx.stroke();
}
function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .3, 0, 0, Math.PI * 2); ctx.fill(); }
