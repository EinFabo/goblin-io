import { TAU } from '../core/util.js';
import { P, run } from '../game/state.js';
import { POTIONS, POTION_INFO } from '../game/abilities.js';
import { ctx, drawSpr } from './canvas.js';

// ---------- Fähigkeiten zeichnen ----------
// Boden: unter den Figuren (Fallen, Pilzring, Zeitbomben-Kreis, Fels-Ziel)
export function drawAbilGround(t) {
  for (const f of run.abfx) {
    if (f.k === 'trap') drawTrap(f.x, f.y, f.snap > 0);
    else if (f.k === 'shroom') {
      const a = Math.min(1, f.t / .3, (f.dur - f.t) / .4);
      const g = ctx.createRadialGradient(f.x, f.y, f.r * .2, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(150,255,120,${.05 * a})`); g.addColorStop(.85, `rgba(110,220,80,${.28 * a})`); g.addColorStop(1, 'rgba(110,220,80,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .7, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 10; i++) { const an = i * TAU / 10; drawShroom(f.x + Math.cos(an) * f.r * .92, f.y + Math.sin(an) * f.r * .64, a * Math.min(1, f.t * 4 - i * .1)); }
    } else if (f.k === 'tb') {
      const p = f.t / f.dur;
      ctx.strokeStyle = `rgba(150,220,255,${.4 + .4 * Math.sin(t * (6 + p * 20))})`; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.lineDashOffset = t * 30;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .72, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(150,220,255,${.08 + p * .12})`; ctx.fill();
    } else if (f.k === 'caltrop') drawCaltrops(f);
    else if (f.k === 'oil') drawOil(f, t);
    else if (f.k === 'honey') drawHoney(f);
    else if (f.k === 'spike') drawSpike(f);
  }
  for (const tl of run.tele) if (tl.k === 'boulder') {
    ctx.strokeStyle = 'rgba(200,170,120,.8)'; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(160,130,90,.15)';
    ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad, tl.rad * .72, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
}

// Oben: über den Figuren (Ratten, Haken-Seil, fliegende Felsen, Schild)
export function drawAbilTop(t) {
  for (const f of run.abfx) {
    if (f.k === 'rats') {
      const face = f.dir > 0 ? 'right' : 'left';
      for (const r of f.rats) drawSpr(`n.rat.walk.${face}.${(Math.floor(r.a * 14) % 6) + 1}`, r.x, r.y, .9);
    } else if (f.k === 'hook') {
      const a = 1 - f.t / f.dur;
      ctx.strokeStyle = `rgba(90,70,50,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P.x, P.y - 10); ctx.lineTo(f.tx, f.ty); ctx.stroke();
      ctx.strokeStyle = `rgba(200,210,220,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.tx, f.ty, 8, -.5, Math.PI + .5); ctx.stroke();
    }
  }
  for (const tl of run.tele) if (tl.k === 'boulder' && tl.t > 0) {
    const p = Math.min(1, tl.t / tl.dur), x = tl.sx + (tl.x - tl.sx) * p, y = tl.sy + (tl.y - tl.sy) * p - Math.sin(p * Math.PI) * 160;
    ctx.save(); ctx.translate(x, y); ctx.rotate(p * 8);
    ctx.fillStyle = '#8a7a66'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
    ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = i * TAU / 7, r = 13 + (i % 3) * 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(-4, -4, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }
  for (const f of run.abfx) {
    if (f.k === 'spin') drawSpin(f, t);
    else if (f.k === 'magnet') drawMagnet(f, t);
    else if (f.k === 'bees') for (const b of f.bees) drawBee(b, t);
    else if (f.k === 'kettle') drawKettle(f, t);
  }
  // Flammenturm: Strahl zum Ziel
  for (const f of run.abfx) if (f.k === 'turret' && f.beam) {
    const sx = f.x + Math.cos(f.a) * 18, sy = f.y - 30 + Math.sin(f.a) * 18, fl = .75 + .25 * Math.sin(t * 40 + f.off);
    const g = ctx.createLinearGradient(sx, sy, f.beam.x, f.beam.y);
    g.addColorStop(0, f.blue ? 'rgba(200,240,255,.95)' : 'rgba(255,240,170,.95)'); g.addColorStop(1, f.blue ? 'rgba(80,150,255,.35)' : 'rgba(255,90,20,.35)');
    ctx.strokeStyle = g; ctx.lineCap = 'round';
    ctx.lineWidth = 14 * fl; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(f.beam.x, f.beam.y); ctx.stroke();
    ctx.strokeStyle = f.blue ? 'rgba(235,250,255,.9)' : 'rgba(255,250,220,.9)'; ctx.lineWidth = 4; ctx.stroke(); ctx.lineCap = 'butt';
  }
  if (P.shieldT > 0) {
    const a = Math.min(1, P.shieldT / .4), f = P.shieldHp / P.shieldMax;
    ctx.strokeStyle = `rgba(210,220,230,${(.5 + .3 * f) * a})`; ctx.lineWidth = 3 + 2 * f;
    ctx.fillStyle = `rgba(190,205,215,${.12 * a})`;
    ctx.beginPath(); ctx.ellipse(P.x, P.y - 10, 30, 34, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.35 * a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(P.x, P.y - 10, 24, -2.4 + Math.sin(t * 3) * .2, -1.4 + Math.sin(t * 3) * .2); ctx.stroke();
  }
}

// Krähenfüße der Rolle: kleine Eisensterne, verblassen am Ende
function drawCaltrops(f) {
  const a = Math.min(1, (f.dur - f.t) / .4);
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = '#0a0f06'; ctx.fillStyle = '#9aa3aa'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    const an = f.seed + i * 2.4, r = f.r * (.25 + .7 * ((i * 37 % 10) / 10)), x = f.x + Math.cos(an) * r, y = f.y + Math.sin(an) * r * .6;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const b = an + k * TAU / 4; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * 5, y + Math.sin(b) * 3.5); }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawTrap(x, y, shut) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 3, 18, 6, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; ctx.fillStyle = '#7d858c';
  ctx.beginPath(); ctx.ellipse(0, 0, 15, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9d1d8';
  const o = shut ? 0 : 7;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const xx = -12 + i * 4.8; ctx.lineTo(xx, s * o + (i % 2 ? -s * 4 : 0)); }
    ctx.lineTo(12, s * o); ctx.lineTo(-12, s * o); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#c9973a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawShroom(x, y, a) {
  if (a <= 0) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = '#f2ead8'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x - 2.5, y - 6, 5, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.ellipse(x, y - 6, 7, 5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2, y - 8, 1.2, 0, TAU); ctx.arc(x + 3, y - 7.5, 1, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}

// ---------- Rüstkammer 2.0 (Phase 10) ----------
// Aufrechte Gegenstände, die mit den Figuren nach y sortiert gezeichnet werden (draw-world.js)
export const ABIL_OBJ = new Set(['decoy', 'turret', 'cannonGun']);
export function drawAbilObj(f, t) {
  if (f.k === 'decoy') drawDecoy(f, t);
  else if (f.k === 'turret') drawTurret(f, t);
  else drawCannon(f);
}
// Ölteppich: dunkel glänzend; entzündet ein Flammensee
function drawOil(f, t) {
  const lit = f.lit >= 0, a = lit ? 1 : Math.min(1, f.t / .25, (f.dur - f.t) / .5);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = 'rgba(25,20,16,.72)'; ctx.beginPath();
  for (let i = 0; i <= 14; i++) { const an = i * TAU / 14, r = f.r * (.86 + .14 * Math.sin(an * 3 + f.seed)); ctx.lineTo(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r * .72); }
  ctx.closePath(); ctx.fill();
  if (lit) {
    const g = ctx.createRadialGradient(f.x, f.y, f.r * .1, f.x, f.y, f.r);
    g.addColorStop(0, `rgba(255,230,120,${.55 + .1 * Math.sin(t * 20)})`); g.addColorStop(.6, 'rgba(255,120,30,.5)'); g.addColorStop(1, 'rgba(200,40,10,0)');
    ctx.fillStyle = g; ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(160,140,200,.25)'; ctx.beginPath(); ctx.ellipse(f.x - f.r * .3, f.y - f.r * .2, f.r * .35, f.r * .12, -.3, 0, TAU); ctx.fill();   // Ölglanz
  }
  ctx.restore();
}
function drawSpike(f) {
  const p = Math.min(1, f.t / .12), a = Math.min(1, (f.dur - f.t) / .2), h = 28 * p;
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = '#8a6a44'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2;
  for (const [dx, s] of [[-9, .7], [0, 1], [9, .8]]) { ctx.beginPath(); ctx.moveTo(f.x + dx - 6, f.y); ctx.lineTo(f.x + dx, f.y - h * s); ctx.lineTo(f.x + dx + 6, f.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
// Maulwurfsgang: Erdhügel, der mit dem Goblin wandert
export function drawBurrow(t) {
  ctx.save(); ctx.translate(P.x, P.y + 10);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 6, 24, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#7a5a36'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 20 + Math.sin(t * 18) * 1.5, 11, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a8865a'; for (const [x, y] of [[-8, -5], [5, -8], [10, -3]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawDecoy(f, t) {
  const hit = f.hitT > 0 ? Math.sin(t * 60) * 3 : 0, a = Math.min(1, f.t / .2);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(f.x + hit, f.y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 16, 5, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.2;
  ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-2.5, -18, 5, 22); ctx.strokeRect(-2.5, -18, 5, 22);   // Pfahl
  ctx.fillStyle = '#d8b65a'; ctx.beginPath(); ctx.ellipse(0, -26, 13, 15, 0, 0, TAU); ctx.fill(); ctx.stroke();   // Strohbauch
  ctx.strokeStyle = 'rgba(120,90,30,.7)'; ctx.lineWidth = 1.4; for (const x of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x, -38); ctx.lineTo(x * .8, -14); ctx.stroke(); }
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.2;
  ctx.fillStyle = '#e2c46a'; ctx.beginPath(); ctx.ellipse(0, -48, 10, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();   // Kopf
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 8, -50); ctx.lineTo(s * 20, -56); ctx.lineTo(s * 9, -44); ctx.closePath(); ctx.fillStyle = '#e2c46a'; ctx.fill(); ctx.stroke(); }   // Ohren
  ctx.fillStyle = '#0a0f06'; ctx.beginPath(); ctx.arc(-3.5, -49, 1.8, 0, TAU); ctx.arc(3.5, -49, 1.8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a4fd6'; ctx.beginPath(); ctx.moveTo(-9, -55); ctx.lineTo(9, -55); ctx.lineTo(2, -70); ctx.closePath(); ctx.fill(); ctx.stroke();   // Mütze
  // Leben
  const hp = Math.max(0, f.hp / (f.hp + f.taken || 1));
  ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.fillRect(-16, 8, 32, 5); ctx.fillStyle = '#e6c46a'; ctx.fillRect(-15, 9, 30 * hp, 3);
  ctx.restore();
}
function drawTurret(f, t) {
  const a = Math.min(1, f.t / .25, (f.dur - f.t) / .3);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 3, 22, 7, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.2;
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 6, -10); ctx.lineTo(s * 16, 2); ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#6d747c'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.strokeStyle = '#0a0f06'; }
  ctx.lineWidth = 2.2; ctx.fillStyle = '#8a7a66'; ctx.beginPath(); ctx.roundRect(-13, -32, 26, 24, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9973a'; for (const [x, y] of [[-8, -27], [8, -27], [-8, -13], [8, -13]]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(0, -30); ctx.rotate(f.a);
  ctx.fillStyle = '#4a4f57'; ctx.beginPath(); ctx.roundRect(0, -5, 22, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = f.blue ? '#8fd0ff' : '#ff9a2e'; ctx.beginPath(); ctx.arc(22, 0, 3.5 + (f.beam ? Math.sin(t * 30) : 0), 0, TAU); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.fillRect(-16, 7, 32, 5); ctx.fillStyle = '#c9973a'; ctx.fillRect(-15, 8, 30 * Math.max(0, 1 - f.t / f.dur), 3);
  ctx.restore();
}
// Goblin-Kanone am Startpunkt, raucht nach
function drawCannon(f) {
  const a = Math.min(1, (f.dur - f.t) / .3);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(f.x, f.y + 6);
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
  ctx.save(); ctx.rotate(f.a); const kick = Math.max(0, .15 - f.t) * 60;
  ctx.fillStyle = '#3a3f46'; ctx.beginPath(); ctx.roundRect(-14 - kick, -9, 40, 18, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c9973a'; ctx.fillRect(-4 - kick, -9, 4, 18);
  ctx.restore();
  ctx.fillStyle = '#8a5a32'; ctx.beginPath(); ctx.arc(-6, 8, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(10, 8, 8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Wirbelaxt: zwei Äxte kreisen, Wirbelring
function drawSpin(f, t) {
  const x = f.at ? f.at.x : P.x, y = (f.at ? f.at.y : P.y) - 8, a0 = Math.min(1, (f.dur - f.t) / .25), R = f.r * .8;
  ctx.save(); ctx.globalAlpha = Math.max(0, a0);
  ctx.strokeStyle = f.at ? 'rgba(200,215,230,.55)' : 'rgba(230,235,240,.5)'; ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y, R * (1 - i * .18), R * .7 * (1 - i * .18), 0, f.a + i, f.a + i + 2.2); ctx.stroke(); }
  if (!f.at) for (const s of [0, Math.PI]) {
    const a = f.a + s, ax = x + Math.cos(a) * R, ay = y + Math.sin(a) * R * .7;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a + Math.PI / 2);
    ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2;
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-2, -4, 4, 18); ctx.strokeRect(-2, -4, 4, 18);
    ctx.fillStyle = '#c9d1d8'; ctx.beginPath(); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-16, -10, -12, 4); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else { ctx.fillStyle = 'rgba(210,220,230,.18)'; ctx.beginPath(); ctx.ellipse(x, y, R, R * .7, 0, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// Schrottmagnet: Hufeisen über dem Goblin, Feldlinien
function drawMagnet(f, t) {
  if (f.t >= f.dur) return;
  const a = Math.min(1, f.t / .2);
  ctx.save(); ctx.globalAlpha = a;
  ctx.strokeStyle = `rgba(150,200,255,${.25 + .15 * Math.sin(t * 20)})`; ctx.lineWidth = 2; ctx.setLineDash([6, 10]); ctx.lineDashOffset = t * 80;
  for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(P.x, P.y, f.r * i / 3, f.r * i / 3 * .75, 0, 0, TAU); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.translate(P.x, P.y - 70 + Math.sin(t * 8) * 3);
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, 13, Math.PI, 0); ctx.stroke();
  ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = '#c9d1d8'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; for (const s of [-1, 1]) { ctx.fillRect(s * 13 - 4, 0, 8, 8); ctx.strokeRect(s * 13 - 4, 0, 8, 8); }
  ctx.restore();
}
function drawBee(b, t) {
  const s = b.q ? 1.8 : 1, w = Math.sin(t * 60 + b.a * 7) * 3;
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-2, -4 - w * .3, 3.5, 2.2 + Math.abs(w) * .3, -.5, 0, TAU); ctx.ellipse(2, -4 - w * .3, 3.5, 2.2 + Math.abs(w) * .3, .5, 0, TAU); ctx.fill();
  ctx.fillStyle = b.q ? '#ffb02e' : '#ffd84a'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 3.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#0a0f06'; ctx.fillRect(-1.2, -3, 1.4, 6); ctx.fillRect(1.6, -2.6, 1.2, 5.2);
  if (b.q) { ctx.fillStyle = '#f4d03f'; ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-2, -7); ctx.lineTo(0, -5); ctx.lineTo(2, -7); ctx.lineTo(3, -4); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawHoney(f) {
  const a = Math.min(1, f.t / .3, (f.dur - f.t) / .5);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  const g = ctx.createRadialGradient(f.x, f.y, f.r * .2, f.x, f.y, f.r);
  g.addColorStop(0, 'rgba(255,200,60,.55)'); g.addColorStop(.85, 'rgba(230,150,30,.4)'); g.addColorStop(1, 'rgba(230,150,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,180,.5)'; ctx.beginPath(); ctx.ellipse(f.x - f.r * .3, f.y - f.r * .15, f.r * .3, f.r * .1, -.2, 0, TAU); ctx.fill();
  ctx.restore();
}
// Hexenkessel: blubbert kurz neben dem Goblin, Dampf in der Farbe der Tränke
function drawKettle(f, t) {
  const a = Math.min(1, f.t / .15, (f.dur - f.t) / .3), up = Math.min(1, f.t / .2);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(f.x, f.y - 10 * (1 - up));
  ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.2;
  ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.ellipse(0, -8, 16, 13, 0, 0, Math.PI); ctx.lineTo(-16, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = f.cols[Math.floor(t * 4) % f.cols.length]; ctx.beginPath(); ctx.ellipse(0, -8, 15, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 3; i++) { const p = (t * 1.6 + i / 3) % 1; ctx.globalAlpha = Math.max(0, a * (1 - p)); ctx.fillStyle = f.cols[i % f.cols.length]; ctx.beginPath(); ctx.arc(-6 + i * 6, -14 - p * 30, 3 + p * 4, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// Tränke: farbiger Schein am Boden, solange einer wirkt
export function drawBrewAura(t) {
  let n = 0; for (const p of POTIONS) if (P.brew[p] > 0) n++;
  if (!n) return;
  let k = Math.floor(t * 3) % n, col = null;
  for (const p of POTIONS) if (P.brew[p] > 0 && k-- === 0) { col = POTION_INFO[p][1]; break; }
  ctx.save(); ctx.globalAlpha = .35 + .15 * Math.sin(t * 8); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, 22, 26, 8, 0, 0, TAU); ctx.fill(); ctx.restore();
}
