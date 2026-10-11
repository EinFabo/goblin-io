import { frand } from '../core/rng.js';
import { joy } from '../core/input.js';
import { TAU, clamp } from '../core/util.js';
import { AIMED, CCOL } from '../data/enemies.js';
import { tipPos } from '../game/enemies.js';
import { part } from '../game/fx.js';
import { gemTier } from '../game/items.js';
import { curPlayerSpr } from '../game/player.js';
import { P, onScreen, run } from '../game/state.js';
import { DPR, H, W, ZOOM, ctx, cv, drawImgC, drawSpr } from './canvas.js';
import { iconCanvas } from './icons.js';
import { PROC } from './proc.js';
import { drawGround } from './tiles.js';

// ---------- Zeichnen ----------
// alpha: Anteil zwischen letztem und nächstem Logikschritt. Spieler, Gegner und Kumpel
// werden für das Bild dazwischen gesetzt und danach zurückgesetzt.
export function renderRun(now, alpha = 1) {
  const moved = [P, ...run.enemies, ...run.allies], saved = new Array(moved.length * 2);
  moved.forEach((o, i) => {
    saved[i * 2] = o.x; saved[i * 2 + 1] = o.y;
    if (o.px !== undefined) { o.x = o.px + (o.x - o.px) * alpha; o.y = o.py + (o.y - o.py) * alpha; }
  });
  try { drawRun(now); }
  finally { moved.forEach((o, i) => { o.x = saved[i * 2]; o.y = saved[i * 2 + 1]; }); }
}
function drawRun(now) {
  const t = now / 1000;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const sx = (Math.random() - .5) * run.shake, sy = (Math.random() - .5) * run.shake;
  const camX = P.x + sx, camY = P.y + sy, z = ZOOM * DPR;
  ctx.setTransform(z, 0, 0, z, cv.width / 2 - camX * z, cv.height / 2 - camY * z);
  const hw = W / 2 / ZOOM, hh = H / 2 / ZOOM;
  drawGround(run.si, camX - hw - 4, camY - hh - 4, hw * 2 + 8, hh * 2 + 8);
  if (run.arena) drawArena(run.arena, t);
  for (const zn of run.zones) {
    const a = Math.min(1, zn.t / .4) * .55, g = ctx.createRadialGradient(zn.x, zn.y, zn.r * .2, zn.x, zn.y, zn.r);
    if (zn.k === 'poison') { g.addColorStop(0, `rgba(150,240,70,${a})`); g.addColorStop(.8, `rgba(90,190,40,${a * .8})`); g.addColorStop(1, 'rgba(90,190,40,0)'); }
    else { g.addColorStop(0, `rgba(255,190,60,${a})`); g.addColorStop(.7, `rgba(220,80,20,${a * .7})`); g.addColorStop(1, 'rgba(200,60,20,0)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * .75, 0, 0, TAU); ctx.fill();
  }
  // gegnerische Giftpfützen: lila mit rotem Rand = gefährlich
  for (const zn of run.ezones) {
    ctx.globalAlpha = clamp(Math.min(zn.t / .4, (zn.dur - zn.t) / .2 + .3), 0, 1);
    const g = ctx.createRadialGradient(zn.x, zn.y, 4, zn.x, zn.y, zn.r);
    g.addColorStop(0, 'rgba(120,200,40,.75)'); g.addColorStop(.7, 'rgba(110,50,160,.6)'); g.addColorStop(1, 'rgba(110,50,160,.15)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * .72, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,70,70,.75)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20; ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  const pw = run.weapons.find(w => w.id === 'poison' && w.evo);
  if (pw) {
    const R = 125 * P.area, g = ctx.createRadialGradient(P.x, P.y, R * .3, P.x, P.y, R);
    g.addColorStop(0, 'rgba(140,230,70,0)'); g.addColorStop(.75, 'rgba(140,230,70,.22)'); g.addColorStop(1, 'rgba(140,230,70,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(170,255,110,.35)'; ctx.lineWidth = 3; ctx.setLineDash([10, 14]); ctx.lineDashOffset = -t * 40;
    ctx.beginPath(); ctx.arc(P.x, P.y, R * .92, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const tl of run.tele) {
    if (tl.k === 'meteor') {
      const p = 1 - tl.t / tl.dur;
      ctx.strokeStyle = 'rgba(255,140,40,.8)'; ctx.lineWidth = 3; ctx.fillStyle = `rgba(255,140,30,${.1 + p * .15})`;
      ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad, tl.rad * .75, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad * p, tl.rad * .75 * p, 0, 0, TAU); ctx.stroke();
    }
  }
  for (const s of run.etele) {
    const p = clamp(1 - s.t / s.dur, 0, 1);
    ctx.fillStyle = `rgba(255,230,60,${.12 + p * .25})`; ctx.strokeStyle = `rgba(255,${Math.round(200 - p * 150)},40,.95)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * .72, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,170,.45)'; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * p, s.r * .72 * p, 0, 0, TAU); ctx.fill();
  }
  if (run.boss && run.boss.ai.st === 'tele') {
    const b = run.boss, a = Math.atan2(b.ai.ay, b.ai.ax);
    ctx.save(); ctx.translate(b.x, b.y + 20); ctx.rotate(a);
    ctx.fillStyle = `rgba(255,50,40,${.18 + .15 * Math.sin(t * 30)})`; ctx.fillRect(0, -36, 430, 72);
    ctx.strokeStyle = 'rgba(255,80,60,.8)'; ctx.lineWidth = 2; ctx.strokeRect(0, -36, 430, 72);
    ctx.restore();
  }
  for (const e of run.enemies) if (e.bomber && e.fuse > 0) {
    ctx.strokeStyle = `rgba(255,60,40,${.5 + .4 * Math.sin(t * 30)})`; ctx.fillStyle = 'rgba(255,60,40,.12)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 10, 80, 58, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }
  // Gegenstände
  for (const it of run.items) {
    if (!onScreen(it.x, it.y, 40)) continue;
    const bob = it.z > 0 ? -it.z * .5 : Math.sin(it.t * 4) * 2.5;
    if (it.k === 'gem') drawGem(it, bob);
    else {
      const s = it.k === 'coin' ? 18 : it.k === 'gear' ? 22 : it.k === 'chest' ? 44 : 30;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + s * .45, s * .4, s * .15, 0, 0, TAU); ctx.fill();
      if (it.k !== 'coin' && it.k !== 'gear') { ctx.fillStyle = 'rgba(255,240,150,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + 12, s * .6, s * .25, 0, 0, TAU); ctx.fill(); }
      if (it.k === 'gear') drawImgC(PROC.gear, it.x, it.y + bob, s, it.t * 2);
      else ctx.drawImage(iconCanvas(it.k), it.x - s / 2, it.y - s / 2 + bob - (it.k === 'chest' ? 6 : 0), s, s);
    }
  }
  // Figuren nach y sortiert
  const list = [];
  for (const e of run.enemies) if (onScreen(e.x, e.y, 120 * e.sc)) list.push(e);
  for (const al of run.allies) list.push(al);
  list.push(P);
  list.sort((a, b) => a.y - b.y);
  for (const tr of P.trail) drawSpr(tr.spr, tr.x, tr.y - 8, 1, 0, 'rage', tr.t * 1.6);
  const gang = run.weapons.find(w => w.id === 'gang');
  for (const o of list) {
    if (o === P) { if (P.mechT > 0) drawMech(); else drawPlayer(t); }
    else if (o.ally) drawAlly(o, gang);
    else drawEnemy(o, t);
  }
  drawPlayerBars();
  for (const e of run.enemies) if (e.state === 'cast' && !e.boss && e.ft < e.charge + .05 && onScreen(e.x, e.y, 60)) drawCharge(e, t);
  if (run.boss && run.boss.ai.st === 'cast' && run.boss.ft < run.boss.charge) drawCharge(run.boss, t);
  for (const w of run.weapons) if (w.id === 'orbit') {
    ctx.strokeStyle = w.evo ? 'rgba(255,230,120,.25)' : 'rgba(255,255,255,.14)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(P.x, P.y - 8, w.r || 80, 0, TAU); ctx.stroke();
    for (const [bx, by, a] of w.blades) drawSpr('dagger', bx, by, w.evo ? 1.5 : 1.25, a + Math.PI / 2);
  }
  // Geschosse
  for (const p of run.pproj) {
    if (p.k === 'dagger') drawSpr('dagger', p.x, p.y, 1.05, p.a);
    else if (p.k === 'spear') drawSpr('e_frostbolt_' + ((Math.floor(p.t * 14) % 4) + 1), p.x, p.y, 1.25, p.a);
    else if (p.k === 'fireball') drawSpr('f_fireball_' + ((Math.floor(p.t * 14) % 4) + 1), p.x, p.y, 1.3, p.a);
    else if (p.k === 'boomer') drawImgC(PROC.bone, p.x, p.y, 40 * p.sc, p.t * 16);
    else if (p.k === 'saw') drawImgC(PROC.saw, p.x, p.y, 44 * p.sc, p.t * 22);
    else if (p.k === 'bullet') { ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .025, p.y - p.vy * .025); ctx.stroke(); }
    else if (p.k === 'rocket') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = '#d6dde2'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-9, -3.5, 14, 7, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.moveTo(5, -3.5); ctx.lineTo(11, 0); ctx.lineTo(5, 3.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(-11, 0, 3 + Math.random() * 2, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  for (const tl of run.tele) {
    if (tl.k === 'flask') {
      const p = tl.t / tl.dur, x = tl.sx + (tl.x - tl.sx) * p, y = tl.sy + (tl.y - tl.sy) * p - Math.sin(p * Math.PI) * 90;
      drawImgC(iconCanvas('poison'), x, y, 28, p * 9);
    } else if (tl.k === 'meteor') {
      const p = tl.t / tl.dur;
      drawSpr('f_fireball_' + ((Math.floor(t * 14) % 4) + 1), tl.x + p * 120, tl.y - p * 520, 2.4, Math.atan2(520, -120));
    } else if (tl.k === 'barrel' || tl.k === 'mini') {
      const p = Math.min(1, tl.t / tl.dur), x = tl.sx + (tl.x - tl.sx) * p, y = tl.sy + (tl.y - tl.sy) * p - Math.sin(p * Math.PI) * (tl.k === 'mini' ? 50 : 80);
      if (tl.k === 'barrel') {
        if (p >= 1) { ctx.strokeStyle = `rgba(255,120,40,${.35 + .3 * Math.sin(t * 25)})`; ctx.lineWidth = 2.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.ellipse(tl.x, tl.y, tl.rad, tl.rad * .72, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        drawImgC(PROC.barrel, x, y - 8, 30, p < 1 ? p * 8 : Math.sin(t * 30) * .08);
      } else { ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x + 4, y - 6, 2.5, 0, TAU); ctx.fill(); }
    }
  }
  for (const p of run.eproj) {
    if (!onScreen(p.x, p.y, 60)) continue;
    if (p.lob) {
      ctx.strokeStyle = 'rgba(255,70,70,.7)'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(p.tx, p.ty, 58, 42, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 4, 0, 0, TAU); ctx.fill();
      drawSpr('f_fireball_' + ((Math.floor(p.t * 12) % 4) + 1), p.x, p.y - p.h, 1.2, Math.PI / 2, 'toxp');
      continue;
    }
    ctx.fillStyle = p.kind === 'fire' ? 'rgba(255,50,30,.22)' : p.kind === 'void' ? 'rgba(170,80,255,.28)' : 'rgba(80,180,255,.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, 0, TAU); ctx.fill();
    const fr = (Math.floor(p.t * 12) % 4) + 1;
    if (p.kind === 'fire') drawSpr('f_fireball_' + fr, p.x, p.y, p.sc, p.a);
    else drawSpr('e_frostbolt_' + fr, p.x, p.y, p.sc, p.a, p.kind === 'void' ? 'voidp' : null);
  }
  // Effekte
  for (const f of run.fx) {
    if (f.k === 'anim') { const i = Math.min(f.n, Math.floor(f.t * f.fps) + 1); drawSpr(f.pre + i, f.x, f.y, f.sc, f.rot); }
    else if (f.k === 'ring') {
      const p = f.t / f.dur, r = f.r0 + (f.r1 - f.r0) * (1 - (1 - p) * (1 - p));
      ctx.globalAlpha = 1 - p; ctx.strokeStyle = f.c; ctx.lineWidth = f.w * (1 - p * .5);
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (f.k === 'bolt') {
      const a = 1 - f.t / f.dur; ctx.lineJoin = 'round';
      const outer = f.col === 'storm' ? `rgba(255,220,60,${a * .55})` : `rgba(120,200,255,${a * .5})`;
      for (const [lw, col] of [[f.w * 3, outer], [f.w, `rgba(255,255,220,${a})`]]) {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); f.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
    }
  }
  for (const p of run.parts) { const a = 1 - p.t / p.life; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.5 + a * .5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const n of run.nums) {
    const p = n.t / .7, s = n.crit ? 22 : 15;
    ctx.font = `900 ${s}px Nunito, system-ui, sans-serif`;
    ctx.globalAlpha = p > .6 ? 1 - (p - .6) / .4 : 1;
    const y = n.y - p * 28;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,15,6,.9)'; ctx.strokeText(n.v, n.x, y);
    ctx.fillStyle = n.c; ctx.fillText(n.v, n.x, y);
  }
  ctx.globalAlpha = 1;
  // Bildschirm-Ebene
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (P.hp / P.maxHp < .3 || run.hurtT > 0) {
    const a = run.hurtT > 0 ? .45 : .25 + .1 * Math.sin(t * 6);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .7);
    g.addColorStop(0, 'rgba(200,20,20,0)'); g.addColorStop(1, `rgba(200,20,20,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P.rageT > 0) { ctx.fillStyle = `rgba(255,60,20,${.08 + .04 * Math.sin(t * 10)})`; ctx.fillRect(0, 0, W, H); }
  if (run.lvDelay > 0) { ctx.fillStyle = `rgba(255,255,255,${run.lvDelay * .35})`; ctx.fillRect(0, 0, W, H); }
  if (run.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${run.flashT / .3 * .8})`; ctx.fillRect(0, 0, W, H); }
  if (joy.id !== null) {
    ctx.fillStyle = 'rgba(10,15,6,.35)'; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 55, 0, TAU); ctx.fill(); ctx.stroke();
    let jx = joy.x - joy.ox, jy = joy.y - joy.oy; const l = Math.hypot(jx, jy); if (l > 55) { jx *= 55 / l; jy *= 55 / l; }
    ctx.fillStyle = 'rgba(111,194,58,.85)'; ctx.beginPath(); ctx.arc(joy.ox + jx, joy.oy + jy, 24, 0, TAU); ctx.fill(); ctx.stroke();
  }
}
export function drawArena(A, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,20,.35)';
  ctx.beginPath(); ctx.rect(A.x - 3000, A.y - 3000, 6000, 6000); ctx.arc(A.x, A.y, A.r, 0, TAU, true); ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(170,110,255,.55)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(A.x, A.y, A.r, 0, TAU); ctx.stroke();
  for (let i = 0; i < 40; i++) {
    const a = i * TAU / 40 + t * .15, x = A.x + Math.cos(a) * A.r, y = A.y + Math.sin(a) * A.r;
    ctx.fillStyle = '#4a3a66'; ctx.strokeStyle = '#140c22'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 9, y + 8); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x + 6, y - 18); ctx.lineTo(x + 9, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(200,150,255,${.5 + .5 * Math.sin(t * 4 + i)})`; ctx.fillRect(x - 2, y - 10, 4, 7);
  }
  ctx.restore();
}
export function drawGem(it, bob) {
  const tier = gemTier(it.v), w = [17, 21, 27, 36][tier], y = it.y + bob;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(it.x, it.y + w * .5, w * .3, w * .12, 0, 0, TAU); ctx.fill();
  drawImgC(PROC.gem[tier], it.x, y, w * 1.9 * (1 + Math.sin(it.t * 5) * .06));
  const tw = (it.t * 1.3 + Math.abs(it.x) * .01) % 2.4;
  if (tw < .25) {
    const s = Math.sin(tw / .25 * Math.PI) * w * .45, sx = it.x - w * .2, sy = y - w * .35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(sx, sy - s); ctx.lineTo(sx + s * .22, sy); ctx.lineTo(sx, sy + s); ctx.lineTo(sx - s * .22, sy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx - s, sy); ctx.lineTo(sx, sy + s * .22); ctx.lineTo(sx + s, sy); ctx.lineTo(sx, sy - s * .22); ctx.closePath(); ctx.fill();
  }
}
export function drawEnemy(e, t) {
  if (e.elite || e.boss) {
    const R = e.r * 1.6 + Math.sin(t * 5) * 3;
    ctx.fillStyle = e.boss ? 'rgba(255,60,60,.28)' : 'rgba(255,210,60,.3)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 26 * e.sc, R, R * .4, 0, 0, TAU); ctx.fill();
  } else if (e.type === 'healer') { ctx.fillStyle = `rgba(160,255,150,${.18 + .08 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.ellipse(e.x, e.y + 24, 26, 10, 0, 0, TAU); ctx.fill(); }
  else if (e.type === 'void') { ctx.fillStyle = 'rgba(140,60,220,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 24, 24, 9, 0, 0, TAU); ctx.fill(); }
  if (e.slowT > 0 || e.freezeT > 0) { ctx.fillStyle = 'rgba(120,210,255,.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 26 * e.sc, e.r * 1.4, e.r * .5, 0, 0, TAU); ctx.fill(); }
  const fl = e.flash > 0 || (e.bomber && e.fuse > 0 && Math.floor(e.fuse * 14) % 2 === 0);
  drawSpr(e.spr || (e.pre + 'idle_down_1'), e.x, e.y, e.sc, 0, e.tint, 1, fl);
  if (e.type === 'healer') { ctx.fillStyle = '#8dff7a'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; const hy = e.y - 46; ctx.beginPath(); ctx.rect(e.x - 2.5, hy - 7, 5, 14); ctx.rect(e.x - 7, hy - 2.5, 14, 5); ctx.stroke(); ctx.fill(); }
  if (e.type === 'storm' && Math.random() < .08) part(e.x + frand(-14, 14), e.y - frand(10, 40), frand(-30, 30), frand(-30, 30), .15, '#fff59a', 2);
  if (e.freezeT > 0) {
    const w = 40 * e.sc, h = 58 * e.sc;
    ctx.fillStyle = 'rgba(170,230,255,.42)'; ctx.strokeStyle = 'rgba(230,250,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(e.x - w / 2, e.y - h / 2, w, h, 6); ctx.fill(); ctx.stroke();
  }
  if (e.elite && e.hp < e.maxHp) {
    const w = 46 * e.sc * .7, y = e.y - 44 * e.sc;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}
export function drawCharge(e, t) {
  const [tx, ty] = tipPos(e), p = clamp(e.ft / e.charge, 0, 1), col = CCOL[e.ck] || '#ffffff';
  const R = (5 + 13 * p) * Math.min(e.sc, 1.6) * (1 + .12 * Math.sin(t * 40));
  if (AIMED[e.ck] && !e.boss) {
    const a = Math.atan2(P.y - ty, P.x - tx);
    ctx.save(); ctx.globalAlpha = .15 + .55 * p; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + Math.cos(a) * 170, ty + Math.sin(a) * 170); ctx.stroke(); ctx.restore();
  }
  const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 2.2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.3, col); g.addColorStop(1, col + '00');
  ctx.globalAlpha = .55 + .45 * p; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, R * 2.2, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 1 - p * .5;
  ctx.beginPath(); ctx.arc(tx, ty, R * 2.6 * (1 - p) + R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
}
export function drawAlly(al, w) {
  const sc = w && w.sc ? w.sc : .55;
  ctx.fillStyle = 'rgba(111,194,58,.3)'; ctx.beginPath(); ctx.ellipse(al.x, al.y + 14, 14, 5, 0, 0, TAU); ctx.fill();
  const spr = al.moving ? 'walk_' + al.face + '_' + ((Math.floor(al.at * 12) % 6) + 1) : 'idle_' + al.face + '_' + ((Math.floor(run.time * 5) % 4) + 1);
  drawSpr(spr, al.x, al.y - 4, sc, 0, P.rageT > 0 ? 'rage' : null);
  if (al.slash > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${al.slash / .15})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(al.x + Math.cos(al.sa) * 16, al.y - 6 + Math.sin(al.sa) * 16, 14, al.sa - 1.2, al.sa + 1.2); ctx.stroke();
  }
}
export function drawPlayer(t) {
  const flick = P.inv > 0 && P.dashT <= 0 && Math.floor(t * 20) % 2 === 0;
  if (P.slowT > 0) { ctx.fillStyle = 'rgba(120,210,255,.4)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 14, 22, 8, 0, 0, TAU); ctx.fill(); }
  if (P.sprinting) {
    ctx.strokeStyle = 'rgba(255,240,170,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const o = (i - 1) * 12; ctx.beginPath(); ctx.moveTo(P.x - P.aimX * 30 - P.aimY * o, P.y - 8 - P.aimY * 30 + P.aimX * o); ctx.lineTo(P.x - P.aimX * 55 - P.aimY * o, P.y - 8 - P.aimY * 55 + P.aimX * o); ctx.stroke(); }
  }
  drawSpr(curPlayerSpr(), P.x, P.y - 8, 1, 0, P.rageT > 0 ? 'rage' : null, flick ? .45 : 1);
}
export function drawPlayerBars() {
  const y = P.y + (P.mechT > 0 ? 36 : 30), w = P.mechT > 0 ? 60 : 46, f = clamp(P.hp / P.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.beginPath(); ctx.roundRect(P.x - w / 2 - 2, y - 2, w + 4, 9, 3); ctx.fill();
  ctx.fillStyle = f > .5 ? '#6fc23a' : f > .25 ? '#f4d03f' : '#e5484d';
  ctx.beginPath(); ctx.roundRect(P.x - w / 2, y, w * f, 5, 2); ctx.fill();
  if (P.stam < P.stamMax - .5) {
    const s = P.stam / P.stamMax;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.beginPath(); ctx.roundRect(P.x - w / 2 - 2, y + 7, w + 4, 6, 3); ctx.fill();
    ctx.fillStyle = P.exhaust ? '#9a7a3a' : '#ffd84a'; ctx.beginPath(); ctx.roundRect(P.x - w / 2, y + 8.5, w * s, 3, 1.5); ctx.fill();
  }
  if (P.mechT > 0) {
    const m = P.mechT / P.mechMax, my = P.y - 100;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.beginPath(); ctx.roundRect(P.x - 32, my - 2, 64, 9, 3); ctx.fill();
    ctx.fillStyle = m < .25 && Math.floor(performance.now() / 120) % 2 ? '#ff6a3d' : '#e0a83a'; ctx.beginPath(); ctx.roundRect(P.x - 30, my, 60 * m, 5, 2); ctx.fill();
  }
}
export function drawMech() {
  const x = P.x, y = P.y, ph = P.moving ? Math.sin(P.anim * 8.7) : 0, bob = Math.abs(ph) * 2;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 24, 36, 11, 0, 0, TAU); ctx.fill();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const lift = Math.max(0, ph * s) * 10, fx = x + s * 17, fy = y + 20 - lift;
    const pts = [[x + s * 12, y - 10 - bob], [x + s * 22, y + 4 - lift * .5], [fx, fy]];
    for (const [lw, c] of [[11, '#0a0f06'], [6, '#6d747c']]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke(); }
    ctx.fillStyle = '#c9973a'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pts[1][0], pts[1][1], 4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3d4148'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(fx - 11, fy - 3, 22, 8, 3); ctx.fill(); ctx.stroke();
  }
  const by = y - 24 - bob;
  drawSpr(P.moving ? 'walk_down_' + ((Math.floor(P.anim * 8) % 6) + 1) : 'idle_down_' + ((Math.floor(P.anim * 5) % 4) + 1), x, by - 26, .72, 0, P.rageT > 0 ? 'rage' : null, P.inv > 0 && Math.floor(performance.now() / 50) % 2 ? .6 : 1);
  const side = Math.cos(P.gunA) >= 0 ? 1 : -1;
  ctx.fillStyle = '#4a4f57'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(x - side * 30 - 9, by - 26, 18, 14, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e5484d'; for (const o of [-4, 4]) { ctx.beginPath(); ctx.arc(x - side * 30 + o, by - 26, 3, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = '#3d4148'; ctx.beginPath(); ctx.rect(x - side * 18 - 4, by - 34, 8, 18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a5f66'; ctx.beginPath(); ctx.rect(x - side * 18 - 6, by - 36, 12, 4); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(x, by - 16, x, by + 18); g.addColorStop(0, '#e8b85a'); g.addColorStop(1, '#8a5a22');
  ctx.fillStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - 31, by - 16, 62, 34, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2a2f36'; ctx.beginPath(); ctx.roundRect(x - 15, by - 2, 30, 12, 3); ctx.fill();
  ctx.strokeStyle = '#e0a83a'; ctx.lineWidth = 1.5; for (const o of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x + o, by); ctx.lineTo(x + o, by + 8); ctx.stroke(); }
  ctx.fillStyle = '#6b4a12'; for (const [ox, oy] of [[-25, -10], [25, -10], [-25, 12], [25, 12]]) { ctx.beginPath(); ctx.arc(x + ox, by + oy, 2.2, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(x + side * 28, by + 2); ctx.rotate(P.gunA);
  ctx.fillStyle = '#5d636b'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(-6, -7, 20, 14, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d4148'; ctx.beginPath(); ctx.roundRect(12, -4, 22, 8, 2); ctx.fill(); ctx.stroke();
  if (P.gunFlash > 0) { ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.moveTo(34, -7); ctx.lineTo(48, 0); ctx.lineTo(34, 7); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
