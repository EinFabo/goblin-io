import { face8 } from '../core/util.js';
import { WORLDS } from '../data/levels.js';
import { STAGES } from '../data/stages.js';
import { stageUnlocked } from '../core/save.js';
import { M, pathAt, tickMap } from '../ui/worldmap.js';
import { DPR, ZOOM, ctx, cv } from './canvas.js';
import { SPR, tinted } from './sprites.js';
import { drawGround } from './tiles.js';

// ---------- Weltkarte zeichnen (Logik und Knöpfe in ui/worldmap.js) ----------
// Bild mittig auf (x, y) mit Höhe h; gespiegelte Richtungen beachten
function img(e, x, y, h, c = e.c) {
  const w = h * c.width / c.height;
  ctx.save(); ctx.translate(x, y); if (e.flip) ctx.scale(-1, 1);
  ctx.drawImage(c, -w / 2, -h / 2, w, h); ctx.restore();
}
// Pfad von Strecke d0 bis d1 als Linienzug
function trace(d0, d1) {
  ctx.beginPath(); let first = true;
  const a = pathAt(d0); ctx.moveTo(a.x, a.y);
  for (const p of M.path) { if (p.d <= d0) continue; if (p.d >= d1) break; ctx.lineTo(p.x, p.y); first = false; }
  const b = pathAt(d1); ctx.lineTo(b.x, b.y);
  return !first;
}

export function renderMapScene(t, dt) {
  tickMap(dt);
  const si = WORLDS[M.wi], st = STAGES[si], open = stageUnlocked(si);
  // Boden der Welt, ganz langsam treibend
  const z = ZOOM * DPR * 1.15;
  ctx.setTransform(z, 0, 0, z, cv.width / 2 - Math.sin(t * .03) * 30 * z, cv.height / 2);
  const hw = cv.width / z / 2 + 40, hh = cv.height / z / 2 + 40;
  drawGround(si, -hw, -hh, hw * 2, hh * 2);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(10,15,6,.18)'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!M.path.length) return;

  // Weg: freier Teil als Erdweg, der Rest gepunktet
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (M.open < M.len) {
    ctx.setLineDash([2, 16]); ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(10,15,6,.45)';
    trace(M.open, M.len); ctx.stroke(); ctx.setLineDash([]);
  }
  if (M.open > 0) {
    trace(0, M.open);
    ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(10,15,6,.55)'; ctx.stroke();
    ctx.lineWidth = 22; ctx.strokeStyle = '#a77a45'; ctx.stroke();
    ctx.setLineDash([10, 14]); ctx.lineWidth = 6; ctx.strokeStyle = '#c99b62'; ctx.stroke(); ctx.setLineDash([]);
    // Spitze des Wegs leuchtet, solange er sich aufmalt
    if (M.reveal) { const p = pathAt(M.open); ctx.fillStyle = 'rgba(244,208,63,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, 9 + Math.sin(t * 20) * 2, 0, 7); ctx.fill(); }
  }

  // Boss wartet über seinem Punkt
  const bn = M.nodes[4];
  if (bn) {
    const e = SPR[`m.${st.boss.school}.m.idle.down.${(Math.floor(t * 5) % 4) + 1}`] || SPR[`m.${st.boss.school}.m.idle.left.1`];
    if (e) {
      ctx.globalAlpha = open ? 1 : .35;
      img(e, bn.x + 62, bn.y - 30 + Math.sin(t * 2) * 2, 96, st.boss.tint ? tinted(e, st.boss.tint) : e.c);
      ctx.globalAlpha = 1;
    }
  }

  // Goblin auf dem Weg
  if (open) {
    const g = M.gob, p = pathAt(g.d);
    if (g.walking && g.vx !== undefined) g.face = face8(g.vx, g.vy, g.face);
    else if (!g.walking) g.face = 'down';
    const e = g.walking ? SPR[`gob.walk.${g.face}.${(Math.floor(g.at * 12) % 6) + 1}`] : SPR[`gob.idle.down.${(Math.floor(t * 5) % 4) + 1}`];
    ctx.fillStyle = 'rgba(10,15,6,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 22, 20, 7, 0, 0, 7); ctx.fill();
    if (e) img(e, p.x, p.y - 58, 84);
  } else { ctx.fillStyle = 'rgba(40,44,48,.45)'; ctx.fillRect(0, 0, cv.width, cv.height); }
}
