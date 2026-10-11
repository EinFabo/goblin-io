import { TAU } from '../core/util.js';

// ---------- Prozedurale Grafiken ----------
export const PROC = {};
export function mk(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; fn(g, w, h); return c; }
export const GEM_COL = [['#6fdcff', '#1c9be0', '#06233f'], ['#dc9bff', '#9a45e8', '#2a0b45'], ['#ffd84a', '#ff9a1f', '#4a2800'], ['#ff6d86', '#e0193f', '#40040f']];
export function makeProc() {
  PROC.gem = GEM_COL.map(([lt, dk, ol]) => mk(64, 72, g => {
    g.translate(32, 36);
    const gr = g.createRadialGradient(0, 0, 3, 0, 0, 32); gr.addColorStop(0, lt + 'b0'); gr.addColorStop(.6, lt + '30'); gr.addColorStop(1, lt + '00');
    g.fillStyle = gr; g.fillRect(-32, -36, 64, 72);
    const dia = () => { g.beginPath(); g.moveTo(0, -25); g.lineTo(16, -6); g.lineTo(0, 25); g.lineTo(-16, -6); g.closePath(); };
    dia(); g.fillStyle = dk; g.fill(); g.lineWidth = 6; g.strokeStyle = ol; g.stroke();
    g.beginPath(); g.moveTo(0, -25); g.lineTo(16, -6); g.lineTo(0, -1); g.lineTo(-16, -6); g.closePath(); g.fillStyle = lt; g.fill();
    g.beginPath(); g.moveTo(0, -1); g.lineTo(-16, -6); g.lineTo(0, 25); g.closePath(); g.fillStyle = 'rgba(255,255,255,.28)'; g.fill();
    g.beginPath(); g.moveTo(-7, -14); g.lineTo(-2, -20); g.lineTo(1, -13); g.closePath(); g.fillStyle = '#fff'; g.fill();
    dia(); g.lineWidth = 3.5; g.strokeStyle = ol; g.stroke();
  }));
  PROC.gear = mk(56, 56, g => {
    g.translate(28, 28);
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 17 : 24; g.lineTo(Math.cos(a - .12) * r, Math.sin(a - .12) * r); g.lineTo(Math.cos(a + .12) * r, Math.sin(a + .12) * r); }
    g.closePath(); g.fillStyle = '#a9b2ba'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#141a20'; g.stroke();
    g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fillStyle = '#d0d7dd'; g.fill(); g.lineWidth = 2.5; g.stroke();
    g.beginPath(); g.arc(0, 0, 5.5, 0, TAU); g.fillStyle = '#2a3036'; g.fill();
    g.beginPath(); g.arc(-6, -7, 3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill();
  });
  PROC.bone = mk(80, 80, g => {
    g.translate(40, 40);
    const path = () => { g.beginPath(); g.arc(-14, 0, 26, -1.05, 1.05); };
    path(); g.lineWidth = 15; g.strokeStyle = '#1c140c'; g.stroke();
    path(); g.lineWidth = 9; g.strokeStyle = '#f2e8cc'; g.stroke();
    for (const s of [-1, 1]) {
      const x = -14 + Math.cos(1.05) * 26, y = s * Math.sin(1.05) * 26;
      for (const ox of [-4, 4]) { g.beginPath(); g.arc(x + ox * .9 + 2, y + s * 3, 6, 0, TAU); g.fillStyle = '#f2e8cc'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1c140c'; g.stroke(); }
    }
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-14, 0, 24, -.6, .3); g.stroke();
  });
  PROC.saw = mk(80, 80, g => {
    g.translate(40, 40);
    g.beginPath();
    for (let i = 0; i < 18; i++) { const a = i * TAU / 18; g.lineTo(Math.cos(a) * 36, Math.sin(a) * 36); g.lineTo(Math.cos(a + .2) * 27, Math.sin(a + .2) * 27); }
    g.closePath(); g.fillStyle = '#c4ccd3'; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#11161b'; g.stroke();
    g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fillStyle = '#9aa4ad'; g.fill(); g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fillStyle = '#c9973a'; g.fill(); g.stroke();
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; g.beginPath(); g.arc(Math.cos(a) * 14, Math.sin(a) * 14, 3.5, 0, TAU); g.fillStyle = '#2a3036'; g.fill(); }
    g.beginPath(); g.arc(0, 0, 30, -2.4, -1.4); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.75)'; g.stroke();
  });
  PROC.barrel = mk(60, 72, g => {
    g.translate(30, 40);
    g.beginPath(); g.moveTo(-18, -24); g.quadraticCurveTo(-25, 0, -18, 24); g.lineTo(18, 24); g.quadraticCurveTo(25, 0, 18, -24); g.closePath();
    const gr = g.createLinearGradient(-22, 0, 22, 0); gr.addColorStop(0, '#6b3f1c'); gr.addColorStop(.45, '#b0743a'); gr.addColorStop(1, '#5a3418');
    g.fillStyle = gr; g.fill(); g.lineWidth = 3.5; g.strokeStyle = '#1c120a'; g.stroke();
    for (const y of [-14, 14]) { g.beginPath(); g.moveTo(-22, y); g.quadraticCurveTo(0, y + 3, 22, y); g.lineWidth = 5; g.strokeStyle = '#3b3f45'; g.stroke(); }
    g.beginPath(); g.ellipse(0, -24, 18, 5, 0, 0, TAU); g.fillStyle = '#8a5a2e'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1c120a'; g.stroke();
    g.fillStyle = '#e5484d'; g.font = '900 16px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('TNT', 0, 6);
    g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(6, -34, 2, -38); g.lineWidth = 2.5; g.strokeStyle = '#3b2a14'; g.stroke();
  });
}
