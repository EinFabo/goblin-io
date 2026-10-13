import { TAU } from '../core/util.js';
import { PROC, mk } from './proc.js';
import { SPR, blit } from './sprites.js';

// ---------- Icons ----------
export const ICON = {};
export function icon(id) {
  if (ICON[id]) return ICON[id];
  const evo = id.endsWith('_evo'); const base = evo ? id.slice(0, -4) : id;
  const c = mk(96, 96, g => {
    g.translate(48, 48); g.scale(1.5, 1.5);
    const spr = (name, x, y, w, rot = 0) => { const e = SPR[name]; if (!e) return; const h = w * e.fh / e.fw; g.save(); g.translate(x, y); g.rotate(rot); blit(g, e, -w / 2, -h / 2, w, h); g.restore(); };
    const img = (cc, x, y, w, rot = 0) => { const h = w * cc.height / cc.width; g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(cc, -w / 2, -h / 2, w, h); g.restore(); };
    if (evo) { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 32); gr.addColorStop(0, 'rgba(255,220,90,.85)'); gr.addColorStop(1, 'rgba(255,200,40,0)'); g.fillStyle = gr; g.fillRect(-32, -32, 64, 64); }
    const st = (fill, stroke = '#0a0f06', lw = 2.5) => { g.fillStyle = fill; g.fill(); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); };
    switch (base) {
      case 'dagger': spr('dagger', 0, 0, 58, -Math.PI / 4); if (evo) { spr('dagger', -8, 10, 40, -Math.PI / 2.4); spr('dagger', 10, -6, 40, -Math.PI / 6); } break;
      case 'orbit':
        g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.stroke(); g.setLineDash([]);
        for (let i = 0; i < (evo ? 6 : 3); i++) { const a = i * TAU / (evo ? 6 : 3); spr('dagger', Math.cos(a) * 18, Math.sin(a) * 18, 30, a + Math.PI / 2); }
        break;
      case 'fireball': spr('f_fireball_2', 0, 0, 62, -Math.PI / 4); if (evo) spr('f_fireball_3', -14, 14, 34, -Math.PI / 4); break;
      case 'spear': spr('e_frostbolt_2', 0, 0, 64, -Math.PI / 4); if (evo) { g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.strokeStyle = '#bff0ff'; g.lineWidth = 3; g.stroke(); } break;
      case 'bolt':
        g.beginPath(); g.moveTo(6, -28); g.lineTo(-12, 2); g.lineTo(-1, 2); g.lineTo(-8, 28); g.lineTo(14, -6); g.lineTo(3, -6); g.lineTo(12, -28); g.closePath(); st('#ffe45c');
        if (evo) { g.beginPath(); g.moveTo(-20, -20); g.lineTo(-26, -6); g.lineTo(-18, -8); g.lineTo(-22, 6); g.lineWidth = 3; g.strokeStyle = '#fff6b0'; g.stroke(); }
        break;
      case 'poison':
        if (evo) { g.beginPath(); g.arc(0, 2, 28, 0, TAU); g.fillStyle = 'rgba(120,220,60,.35)'; g.fill(); }
        g.beginPath(); g.arc(0, 8, 15, 0, TAU); st('#7be04a');
        g.beginPath(); g.rect(-5, -18, 10, 14); st('#cfe8c0');
        g.beginPath(); g.rect(-6, -24, 12, 7); st('#8a5a32');
        g.beginPath(); g.arc(-5, 4, 3, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        break;
      case 'boomer': img(PROC.bone, 2, 0, 58, -.5); if (evo) img(PROC.bone, -8, 8, 36, 1.8); break;
      case 'barrel': img(PROC.barrel, 0, 2, 44); if (evo) { g.fillStyle = '#ffd84a'; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - 1.2; g.beginPath(); g.arc(Math.cos(a) * 24, Math.sin(a) * 24, 3.5, 0, TAU); g.fill(); } } break;
      case 'saw': img(PROC.saw, 0, 0, 56); if (evo) img(PROC.saw, 14, 14, 30); break;
      case 'gang': spr('idle_down_2', 9, 4, 48); spr('idle_down_1', -9, -2, 54); if (evo) spr('idle_down_3', 0, 10, 40); break;
      case 'whet':
        g.save(); g.rotate(-0.5); g.beginPath(); g.roundRect(-24, -9, 48, 18, 6); st('#8d969c'); g.beginPath(); g.rect(-24, 0, 48, 9); g.fillStyle = 'rgba(0,0,0,.18)'; g.fill(); g.restore();
        g.strokeStyle = '#fff6b0'; g.lineWidth = 3; g.beginPath(); g.moveTo(14, -24); g.lineTo(18, -16); g.moveTo(24, -18); g.lineTo(18, -14); g.stroke();
        break;
      case 'book':
        g.beginPath(); g.roundRect(-18, -22, 36, 44, 4); st('#7b3fc4');
        g.beginPath(); g.rect(-18, -22, 7, 44); g.fillStyle = '#f4d03f'; g.fill();
        g.beginPath(); g.arc(4, 0, 8, 0, TAU); g.strokeStyle = '#f4d03f'; g.lineWidth = 2.5; g.stroke();
        break;
      case 'amulet':
        g.beginPath(); g.arc(0, -10, 20, Math.PI * 0.1, Math.PI * 0.9, true); g.strokeStyle = '#c9a227'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(0, 10, 14, 0, TAU); st('#f4d03f');
        g.beginPath(); g.arc(0, 10, 7, 0, TAU); st('#46b4ff', '#0a0f06', 2);
        break;
      case 'armor':
        g.beginPath(); g.moveTo(0, -24); g.lineTo(20, -16); g.lineTo(18, 6); g.quadraticCurveTo(12, 20, 0, 26); g.quadraticCurveTo(-12, 20, -18, 6); g.lineTo(-20, -16); g.closePath(); st('#8a5a32');
        g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 20); g.strokeStyle = '#5a3a22'; g.lineWidth = 3; g.stroke();
        break;
      case 'heart': case 'heal':
        g.beginPath(); g.moveTo(0, 22); g.bezierCurveTo(-30, 2, -20, -26, 0, -10); g.bezierCurveTo(20, -26, 30, 2, 0, 22); st('#e5484d');
        g.beginPath(); g.arc(-9, -6, 4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.6)'; g.fill();
        break;
      case 'herbs':
        for (const [a, col] of [[-0.6, '#6fc23a'], [0.6, '#4f9a2a'], [0, '#8ad94f']]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -10, 8, 16, 0, 0, TAU); st(col); g.restore(); }
        g.beginPath(); g.moveTo(0, 6); g.lineTo(0, 24); g.strokeStyle = '#3b6b1d'; g.lineWidth = 3; g.stroke();
        break;
      case 'boots':
        g.beginPath(); g.moveTo(-12, -24); g.lineTo(6, -24); g.lineTo(6, 4); g.lineTo(22, 10); g.quadraticCurveTo(26, 22, 14, 22); g.lineTo(-14, 22); g.closePath(); st('#8a5a32');
        g.beginPath(); g.moveTo(-14, 14); g.lineTo(24, 14); g.strokeStyle = '#3b2414'; g.lineWidth = 3; g.stroke();
        g.strokeStyle = '#e8f6ff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-26, -8); g.lineTo(-17, -8); g.moveTo(-28, 2); g.lineTo(-17, 2); g.stroke();
        break;
      case 'magnet':
        g.lineWidth = 12; g.strokeStyle = '#0a0f06'; g.beginPath(); g.arc(0, 0, 15, Math.PI, 0); g.lineTo(15, 18); g.moveTo(-15, 0); g.lineTo(-15, 18); g.stroke();
        g.lineWidth = 8; g.strokeStyle = '#e5484d'; g.beginPath(); g.arc(0, 0, 15, Math.PI, 0); g.lineTo(15, 12); g.moveTo(-15, 0); g.lineTo(-15, 12); g.stroke();
        g.strokeStyle = '#d6dde2'; g.beginPath(); g.moveTo(15, 12); g.lineTo(15, 18); g.moveTo(-15, 12); g.lineTo(-15, 18); g.stroke();
        break;
      case 'oil':
        g.beginPath(); g.roundRect(-16, -8, 30, 28, 4); st('#3f7a3a');
        g.beginPath(); g.moveTo(10, -6); g.lineTo(26, -20); g.lineTo(28, -16); g.lineTo(14, 0); g.closePath(); st('#8d969c');
        g.beginPath(); g.roundRect(-10, -16, 14, 9, 2); st('#8d969c');
        g.beginPath(); g.arc(28, -10, 3.5, 0, TAU); g.fillStyle = '#1a1a1a'; g.fill();
        break;
      case 'powder':
        g.beginPath(); g.moveTo(-16, -6); g.quadraticCurveTo(-20, 22, 0, 22); g.quadraticCurveTo(20, 22, 16, -6); g.closePath(); st('#5a4632');
        g.beginPath(); g.moveTo(-8, -6); g.lineTo(-6, -16); g.lineTo(6, -16); g.lineTo(8, -6); g.closePath(); st('#3d2e20');
        g.fillStyle = '#e5484d'; g.font = '900 12px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('☠', 0, 12);
        g.fillStyle = '#ffd84a'; for (const [x, y] of [[10, -20], [16, -14], [4, -24]]) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
        break;
      case 'gem': img(PROC.gem[0], 0, 0, 52); break;
      case 'gear': img(PROC.gear, 0, 0, 50); break;
      case 'rage':
        g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 12 : 26; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); st('#ff6a3d');
        g.beginPath(); g.arc(0, 0, 9, 0, TAU); st('#ffd84a', '#0a0f06', 2);
        break;
      case 'dash':
        g.strokeStyle = '#bff0ff'; g.lineWidth = 4;
        for (const [y, l] of [[-12, 18], [0, 26], [12, 18]]) { g.beginPath(); g.moveTo(-24, y); g.lineTo(-24 + l, y); g.stroke(); }
        g.beginPath(); g.moveTo(4, -16); g.lineTo(24, 0); g.lineTo(4, 16); g.closePath(); st('#7fd8ff');
        break;
      case 'mech':
        for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 9, 6); g.lineTo(s * 13, 16); g.lineTo(s * 10, 26); g.lineWidth = 6; g.strokeStyle = '#0a0f06'; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#6d747c'; g.stroke(); }
        g.beginPath(); g.roundRect(-20, -12, 40, 22, 5); st('#c9973a');
        g.beginPath(); g.rect(-24, -24, 7, 14); st('#4a4f57');
        g.beginPath(); g.rect(16, -4, 14, 6); st('#4a4f57');
        g.beginPath(); g.arc(0, -16, 9, Math.PI, 0); st('#6fc23a');
        g.fillStyle = '#0a0f06'; g.beginPath(); g.arc(-3, -18, 1.8, 0, TAU); g.arc(3, -18, 1.8, 0, TAU); g.fill();
        g.fillStyle = '#6b4a12'; for (const x of [-14, -6, 6, 14]) { g.beginPath(); g.arc(x, 4, 1.8, 0, TAU); g.fill(); }
        break;
      case 'trap':
        g.beginPath(); g.ellipse(0, 6, 26, 10, 0, 0, TAU); st('#7d858c');
        for (const sg of [-1, 1]) { g.beginPath(); for (let i = 0; i <= 6; i++) g.lineTo(-22 + i * 7.3, 6 + sg * 4 + (i % 2 ? -sg * 12 : -sg * 2)); g.lineTo(22, 6 + sg * 4); g.lineTo(-22, 6 + sg * 4); g.closePath(); st('#c9d1d8', '#0a0f06', 2); }
        g.beginPath(); g.arc(0, 6, 4.5, 0, TAU); st('#c9973a', '#0a0f06', 2);
        break;
      case 'smoke':
        for (const [x, y, r, c] of [[-10, 6, 15, '#9a9aa6'], [10, 4, 14, '#b4b4c0'], [0, -8, 15, '#cfcfda'], [12, -14, 9, '#e2e2ea']]) { g.beginPath(); g.arc(x, y, r, 0, TAU); st(c, '#0a0f06', 2); }
        g.beginPath(); g.arc(-14, 20, 8, 0, TAU); st('#2b2f36'); g.beginPath(); g.moveTo(-10, 13); g.lineTo(-6, 7); g.strokeStyle = '#c9a227'; g.lineWidth = 2.5; g.stroke();
        break;
      case 'catapult':
        g.beginPath(); g.roundRect(-24, 12, 48, 8, 3); st('#8a5a32');
        for (const x of [-16, 16]) { g.beginPath(); g.arc(x, 22, 6, 0, TAU); st('#5d3a1e'); }
        g.save(); g.rotate(-.7); g.beginPath(); g.roundRect(-4, -26, 8, 40, 3); st('#a86d3c'); g.restore();
        g.beginPath(); g.arc(-18, -18, 9, 0, TAU); st('#8a7a66');
        break;
      case 'hook':
        g.beginPath(); g.moveTo(-26, 26); g.quadraticCurveTo(-10, 0, 4, -6); g.strokeStyle = '#5d3a1e'; g.lineWidth = 4; g.stroke();
        g.beginPath(); g.moveTo(4, -6); g.lineTo(14, -16); g.lineWidth = 6; g.strokeStyle = '#0a0f06'; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#c9d1d8'; g.stroke();
        for (const a of [-1, 1]) { g.beginPath(); g.arc(14 + a * 8, -16, 8, a > 0 ? Math.PI * .5 : 0, a > 0 ? Math.PI * 1.2 : Math.PI * .5, a < 0); g.lineWidth = 6; g.strokeStyle = '#0a0f06'; g.stroke(); g.lineWidth = 3.5; g.strokeStyle = '#c9d1d8'; g.stroke(); }
        break;
      case 'shroom':
        g.beginPath(); g.ellipse(0, 16, 26, 8, 0, 0, TAU); g.fillStyle = 'rgba(120,230,90,.45)'; g.fill();
        g.beginPath(); g.roundRect(-6, -4, 12, 20, 4); st('#f2ead8');
        g.beginPath(); g.ellipse(0, -4, 20, 15, 0, Math.PI, 0); g.closePath(); st('#e5484d');
        g.fillStyle = '#fff'; for (const [x, y, r] of [[-8, -10, 3], [5, -13, 2.5], [10, -6, 2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
        break;
      case 'shield':
        g.beginPath(); g.moveTo(0, -26); g.lineTo(22, -16); g.lineTo(18, 10); g.quadraticCurveTo(10, 22, 0, 28); g.quadraticCurveTo(-10, 22, -18, 10); g.lineTo(-22, -16); g.closePath(); st('#9aa3aa');
        g.beginPath(); g.moveTo(0, -18); g.lineTo(0, 20); g.moveTo(-14, -4); g.lineTo(14, -4); g.strokeStyle = '#6d747c'; g.lineWidth = 3; g.stroke();
        g.fillStyle = '#c9973a'; for (const [x, y] of [[-12, -12], [12, -12], [-9, 10], [9, 10]]) { g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); }
        break;
      case 'rats': spr('n.rat.walk.right.2', 8, 4, 50); spr('n.rat.walk.right.4', -10, -8, 40); break;
      case 'call':
        spr('idle_down_2', -14, 6, 40); spr('idle_down_3', 14, 6, 40); spr('idle_down_1', 0, -4, 48);
        g.beginPath(); g.moveTo(-26, -20); g.lineTo(-18, -14); g.moveTo(26, -20); g.lineTo(18, -14); g.strokeStyle = '#ffd84a'; g.lineWidth = 3; g.stroke();
        break;
      case 'totem':
        g.beginPath(); g.roundRect(-11, -24, 22, 48, 4); st('#8a5a32');
        g.fillStyle = '#0a0f06'; g.fillRect(-7, -16, 5, 4); g.fillRect(2, -16, 5, 4); g.fillRect(-6, -6, 12, 3);
        g.beginPath(); g.moveTo(-11, 6); g.lineTo(-22, 0); g.lineTo(-11, 14); g.moveTo(11, 6); g.lineTo(22, 0); g.lineTo(11, 14); st('#6fc23a', '#0a0f06', 2);
        g.beginPath(); g.arc(0, 10, 6, 0, TAU); st('#f4d03f', '#6b4a07', 2);
        break;
      case 'timebomb':
        g.beginPath(); g.arc(0, 4, 21, 0, TAU); st('#2b2f36');
        g.beginPath(); g.arc(0, 4, 15, 0, TAU); st('#bff0ff', '#0a0f06', 2);
        g.beginPath(); g.moveTo(0, 4); g.lineTo(0, -6); g.moveTo(0, 4); g.lineTo(8, 8); g.strokeStyle = '#0a0f06'; g.lineWidth = 2.5; g.stroke();
        g.beginPath(); g.roundRect(-5, -22, 10, 6, 2); st('#c9a227', '#0a0f06', 2);
        break;
      case 'bigbang':
        g.beginPath(); for (let i = 0; i < 20; i++) { const a = i * TAU / 20, r = i % 2 ? 14 : 28; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); st('#ff9a2e');
        g.beginPath(); for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + .2, r = i % 2 ? 8 : 17; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); st('#ffe45c', '#0a0f06', 2);
        break;
      case 'charm':
        g.beginPath(); g.moveTo(-16, -26); g.quadraticCurveTo(0, -4, 16, -26); g.strokeStyle = '#c9a227'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(0, 6, 15, 0, TAU); st('#f4d03f', '#6b4a07', 3);
        g.beginPath(); g.moveTo(0, -2); g.bezierCurveTo(-10, -8, -12, 6, 0, 14); g.bezierCurveTo(12, 6, 10, -8, 0, -2); st('#e5484d', '#0a0f06', 1.8);
        break;
      case 'dice':
        g.beginPath(); g.roundRect(-20, -20, 40, 40, 8); st('#f2f6e6');
        g.fillStyle = '#0a0f06'; for (const [x, y] of [[-9, -9], [9, 9], [0, 0], [9, -9], [-9, 9]]) { g.beginPath(); g.arc(x, y, 3.6, 0, TAU); g.fill(); }
        break;
      case 'gold': case 'coin':
        g.beginPath(); g.arc(0, 0, 20, 0, TAU); st('#f4d03f', '#6b4a07', 3);
        g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.strokeStyle = '#c9a227'; g.lineWidth = 2.5; g.stroke();
        g.beginPath(); g.arc(-7, -7, 4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
        break;
      case 'bomb':
        g.beginPath(); g.arc(0, 4, 18, 0, TAU); st('#2b2f36');
        g.beginPath(); g.moveTo(8, -12); g.quadraticCurveTo(16, -24, 22, -20); g.strokeStyle = '#c9a227'; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(23, -21, 4, 0, TAU); g.fillStyle = '#ff9a2e'; g.fill();
        g.beginPath(); g.arc(-6, -3, 5, 0, TAU); g.fillStyle = 'rgba(255,255,255,.3)'; g.fill();
        break;
      case 'chest':
        g.beginPath(); g.roundRect(-22, -10, 44, 28, 3); st('#8a5a32');
        g.beginPath(); g.moveTo(-22, -10); g.quadraticCurveTo(0, -30, 22, -10); g.closePath(); st('#a86d3c');
        g.fillStyle = '#f4d03f'; g.fillRect(-22, -4, 44, 5); g.beginPath(); g.roundRect(-5, -6, 10, 12, 2); st('#f4d03f', '#0a0f06', 2);
        break;
    }
  });
  ICON[id] = c.toDataURL(); ICON[id + '#c'] = c;
  return ICON[id];
}
export const iconCanvas = id => { icon(id); return ICON[id + '#c']; };
