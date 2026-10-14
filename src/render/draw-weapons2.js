// Zeichnen der zweiten Waffen-Reihe (game/weapons2.js): Geschosse, Minen, schwarze Löcher, Strahlen, Plasmakugeln
import { TAU } from '../core/util.js';
import { P, onScreen, run } from '../game/state.js';
import { ctx, drawImgC, drawSpr } from './canvas.js';
import { mk } from './proc.js';

// Kleine Bilder einmal malen (keine SVGs nötig)
let IMG = null;
function imgs() {
  if (IMG) return IMG;
  IMG = {
    star: mk(64, 64, g => {
      g.translate(32, 32); g.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? 9 : 28, a = i * TAU / 8; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fillStyle = '#c9d3dc'; g.fill(); g.strokeStyle = '#1b2228'; g.lineWidth = 3; g.stroke();
      g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fillStyle = '#1b2228'; g.fill();
    }),
    xbolt: mk(96, 24, g => {
      g.fillStyle = '#7a5230'; g.strokeStyle = '#1b1208'; g.lineWidth = 2.5;
      g.beginPath(); g.roundRect(8, 9, 70, 6, 3); g.fill(); g.stroke();
      g.fillStyle = '#c9d3dc'; g.beginPath(); g.moveTo(76, 3); g.lineTo(94, 12); g.lineTo(76, 21); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e5484d'; g.beginPath(); g.moveTo(2, 4); g.lineTo(18, 12); g.lineTo(2, 20); g.closePath(); g.fill(); g.stroke();
    }),
    mine: mk(48, 48, g => {
      g.translate(24, 26);
      g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, TAU); g.fillStyle = '#3b4148'; g.fill(); g.strokeStyle = '#0a0f06'; g.lineWidth = 2.5; g.stroke();
      g.beginPath(); g.ellipse(0, -3, 11, 7, 0, 0, TAU); g.fillStyle = '#59616a'; g.fill();
    }),
    shard: mk(32, 32, g => { g.translate(16, 16); g.beginPath(); g.moveTo(12, 0); g.lineTo(-6, 6); g.lineTo(-10, -3); g.closePath(); g.fillStyle = '#d8dde2'; g.fill(); g.strokeStyle = '#1b2228'; g.lineWidth = 2; g.stroke(); }),
  };
  return IMG;
}
const fr = (t, fps = 12) => (Math.floor(t * fps) % 4) + 1;

// Geschoss der neuen Waffen zeichnen; false = nicht zuständig
export function drawProj2(p) {
  const I = imgs();
  switch (p.k) {
    case 'star': drawImgC(I.star, p.x, p.y, 22 * p.sc, p.t * 20); return true;
    case 'xbolt': drawImgC(I.xbolt, p.x, p.y, 40 * p.sc, p.a); return true;
    case 'shard': drawImgC(I.shard, p.x, p.y, 16, p.a); return true;
    case 'shade': drawSpr('p.shade.' + fr(p.t), p.x, p.y, 1.1 * p.sc, p.a); return true;
    case 'rock': drawSpr('p.rock.' + fr(p.t, 10), p.x, p.y, .9 * p.sc, p.t * 8); return true;
    case 'soul': drawSpr('p.soul.' + fr(p.t), p.x, p.y, .9 * p.sc, p.a); return true;
    case 'spark': drawSpr('p.spark.' + fr(p.t, 16), p.x, p.y, .8 * p.sc, p.a); return true;
  }
  return false;
}
// Am Boden (unter den Figuren): Minen, schwarze Löcher, Schatten der Felsbrocken
export function drawWfxGround(t) {
  const I = imgs();
  for (const f of run.wfx) {
    // Sonnenfinsternis: der Boden wird dunkel (unter den Figuren)
    if (f.k === 'eclipse') { const fade = Math.min(1, f.t / .3, (f.dur - f.t) / .3); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(10,0,25,${.5 * fade})`; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); continue; }
    if (!onScreen(f.x, f.y, (f.R || 120) + 40)) continue;
    if (f.k === 'mine') {
      drawImgC(I.mine, f.x, f.y, 26);
      const on = f.t >= f.arm && Math.sin(t * 12 + f.x) > 0;
      ctx.fillStyle = on ? '#ff4a3a' : '#7a2a24'; ctx.beginPath(); ctx.arc(f.x, f.y - 3, 3, 0, TAU); ctx.fill();
    } else if (f.k === 'hole') {
      const p = Math.min(1, f.t / .3) * (f.t > f.dur - .2 ? (f.dur - f.t) / .2 : 1), R = f.R * .55 * p;
      const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, R);
      g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(.55, 'rgba(40,10,70,.8)'); g.addColorStop(1, 'rgba(120,70,220,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * .75, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,255,.55)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(f.x, f.y, R * (.5 + i * .2), R * (.5 + i * .2) * .75, 0, t * (3 + i) + i * 2, t * (3 + i) + i * 2 + 2.2); ctx.stroke(); }
    } else if (f.k === 'boulder') {
      const p = f.t / f.dur;
      ctx.fillStyle = `rgba(0,0,0,${.15 + p * .25})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.rad * (.4 + .6 * p), f.rad * .55 * (.4 + .6 * p), 0, 0, TAU); ctx.fill();
    }
  }
}
// Über den Figuren: fallende Felsbrocken, Lichtstrahlen, Sonnenstrahl, Plasmakugeln
export function drawWfxTop(t) {
  for (const f of run.wfx) {
    if (f.k === 'boulder') { const p = f.t / f.dur; drawSpr('p.rock.1', f.x, f.y - (1 - p) * 420, 2.6, p * 6); }
    else if (f.k === 'beam') drawBeam(f.x, f.y, f.a, f.len, f.wid, 1 - f.t / f.dur);
    else if (f.k === 'eclipse') {
      const fade = Math.min(1, f.t / .3, (f.dur - f.t) / .3);
      for (let i = 0; i < 4; i++) drawBeam(f.x, f.y, f.a + i * TAU / 4, 460 * P.area, 50 * P.area, fade);
    }
  }
  for (const w of run.weapons) {
    if (w.id === 'lance' && w.evo) drawBeam(P.x, P.y - 8, w.a, 420 * P.area, 44 * P.area, .85 + .15 * Math.sin(t * 20));
    if (w.id === 'spark' && w.evo) for (const [bx, by] of w.blades) {
      const g = ctx.createRadialGradient(bx, by, 2, bx, by, 34); g.addColorStop(0, 'rgba(230,210,255,.9)'); g.addColorStop(1, 'rgba(150,90,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 34, 0, TAU); ctx.fill();
      drawSpr('p.spark.' + fr(t, 16), bx, by, 1.8, t * 4);
    }
  }
}
function drawBeam(x, y, a, len, wid, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = Math.max(0, alpha);
  const g = ctx.createLinearGradient(0, -wid, 0, wid);
  g.addColorStop(0, 'rgba(255,230,120,0)'); g.addColorStop(.35, 'rgba(255,230,120,.55)'); g.addColorStop(.5, 'rgba(255,255,240,.95)'); g.addColorStop(.65, 'rgba(255,230,120,.55)'); g.addColorStop(1, 'rgba(255,230,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, -wid, len, wid * 2);
  ctx.restore();
}
