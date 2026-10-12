import { TAU } from '../core/util.js';
import { P, run } from '../game/state.js';
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
    }
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
  if (P.shieldT > 0) {
    const a = Math.min(1, P.shieldT / .4), f = P.shieldHp / P.shieldMax;
    ctx.strokeStyle = `rgba(210,220,230,${(.5 + .3 * f) * a})`; ctx.lineWidth = 3 + 2 * f;
    ctx.fillStyle = `rgba(190,205,215,${.12 * a})`;
    ctx.beginPath(); ctx.ellipse(P.x, P.y - 10, 30, 34, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.35 * a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(P.x, P.y - 10, 24, -2.4 + Math.sin(t * 3) * .2, -1.4 + Math.sin(t * 3) * .2); ctx.stroke();
  }
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
