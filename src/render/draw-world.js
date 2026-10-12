import { frand } from '../core/rng.js';
import { joy } from '../core/input.js';
import { DIR8, TAU, clamp } from '../core/util.js';
import { CCOL, ECOL, SCHOOL_COL, ETYPES } from '../data/enemies.js';
import { CASTS } from '../game/casts.js';
import { save } from '../core/save.js';
import { SPAWN_T, tipPos } from '../game/enemies.js';
import { part } from '../game/fx.js';
import { gemTier } from '../game/items.js';
import { ROLL_T, curPlayerSpr } from '../game/player.js';
import { P, onScreen, run } from '../game/state.js';
import { DPR, H, W, ZOOM, ctx, cv, drawImgC, drawSpr } from './canvas.js';
import { iconCanvas } from './icons.js';
import { PROC } from './proc.js';
import { drawGround } from './tiles.js';

// ---------- Zeichnen ----------
// alpha: Anteil zwischen letztem und nächstem Logikschritt. Spieler, Gegner und Kumpel
// werden für das Bild dazwischen gesetzt und danach zurückgesetzt.
export function renderRun(now, alpha = 1) {
  const moved = [P, run.cam, ...run.enemies, ...run.allies], saved = new Array(moved.length * 2);
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
  const sh = save.settings.shake ? run.shake : 0;
  const sx = (Math.random() - .5) * sh, sy = (Math.random() - .5) * sh;
  const zm = ZOOM * run.cam.z, camX = run.cam.x + sx, camY = run.cam.y + sy, z = zm * DPR;
  ctx.setTransform(z, 0, 0, z, cv.width / 2 - camX * z, cv.height / 2 - camY * z);
  const hw = W / 2 / zm, hh = H / 2 / zm;
  drawGround(run.si, camX - hw - 4, camY - hh - 4, hw * 2 + 8, hh * 2 + 8);
  if (run.arena) drawArena(run.arena, t);
  for (const zn of run.zones) {
    const a = Math.min(1, zn.t / .4) * .55, g = ctx.createRadialGradient(zn.x, zn.y, zn.r * .2, zn.x, zn.y, zn.r);
    if (zn.k === 'poison') { g.addColorStop(0, `rgba(150,240,70,${a})`); g.addColorStop(.8, `rgba(90,190,40,${a * .8})`); g.addColorStop(1, 'rgba(90,190,40,0)'); }
    else { g.addColorStop(0, `rgba(255,190,60,${a})`); g.addColorStop(.7, `rgba(220,80,20,${a * .7})`); g.addColorStop(1, 'rgba(200,60,20,0)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(zn.x, zn.y, zn.r, zn.r * .75, 0, 0, TAU); ctx.fill();
  }
  drawHaz(t, false);
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
  drawHaz(t, true);
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
  for (const tr of P.trail) drawSpr(tr.spr, tr.x, tr.y - 8, 1, 0, 'trail', tr.t * 2.4);
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
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 4, 0, 0, TAU); ctx.fill();
      if (p.kind === 'rock') { drawRock(p.x, p.y - p.h, p.t * 9); continue; }
      ctx.strokeStyle = 'rgba(255,70,70,.7)'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(p.tx, p.ty, 58, 42, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      drawSpr('f_fireball_' + ((Math.floor(p.t * 12) % 4) + 1), p.x, p.y - p.h, 1.2, Math.PI / 2, 'toxp');
      continue;
    }
    if (p.fake) ctx.globalAlpha = .45;
    ctx.fillStyle = p.kind === 'fire' ? 'rgba(255,50,30,.22)' : p.kind === 'void' ? 'rgba(170,80,255,.28)' : 'rgba(80,180,255,.25)';
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 8, 0, TAU); ctx.fill();
    const fr = (Math.floor(p.t * 12) % 4) + 1;
    if (p.kind === 'fire') drawSpr('f_fireball_' + fr, p.x, p.y, p.sc, p.a);
    else drawSpr('e_frostbolt_' + fr, p.x, p.y, p.sc, p.a, p.kind === 'void' ? 'voidp' : null);
    ctx.globalAlpha = 1;
  }
  // Effekte
  for (const f of run.fx) {
    if (f.k === 'anim') { const i = Math.min(f.n, Math.floor(f.t * f.fps) + 1); drawSpr(f.pre + i, f.x, f.y, f.sc, f.rot); }
    else if (f.k === 'dissolve') {
      // in Schulfarbe einfärben, nach oben zusammenschrumpfen und verblassen
      const p = f.t / f.dur;
      ctx.save(); ctx.translate(f.x, f.y + 24 * f.sc); ctx.scale(1 + p * .25, 1 - p * .7);
      drawSpr(f.spr, 0, -24 * f.sc, f.sc, 0, f.col, (1 - p) * .9); ctx.restore();
    }
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
  } else if (e.type === 'light_apprentice') { ctx.fillStyle = `rgba(160,255,150,${.18 + .08 * Math.sin(t * 4)})`; ctx.beginPath(); ctx.ellipse(e.x, e.y + 24 * e.sc, 26, 10, 0, 0, TAU); ctx.fill(); }
  else if (e.type === 'shadow_apprentice') { ctx.fillStyle = 'rgba(140,60,220,.25)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 24 * e.sc, 24, 9, 0, 0, TAU); ctx.fill(); }
  if (e.obj) { drawObject(e, t); return; }
  if (e.slowT > 0 || e.freezeT > 0) { ctx.fillStyle = 'rgba(120,210,255,.4)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 26 * e.sc, e.r * 1.4, e.r * .5, 0, 0, TAU); ctx.fill(); }
  if (e.spawnT > 0) { drawPortal(e, t); return; }
  const fl = e.flash > 0 || (e.bomber && e.fuse > 0 && Math.floor(e.fuse * 14) % 2 === 0);
  drawSpr(e.spr || (e.pre + '.idle.down.1'), e.x, e.y, e.sc, 0, e.tint, e.clone ? .85 : 1, fl);
  if (e.traits && e.traits.includes('frontShield')) drawFrontShield(e);
  if (e.shield > 0) {
    ctx.fillStyle = `rgba(255,225,120,${.16 + .06 * Math.sin(t * 6)})`; ctx.strokeStyle = 'rgba(255,215,90,.9)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(e.x, e.y - 4 * e.sc, 30 * e.sc, 0, TAU); ctx.fill(); ctx.stroke();
  }
  if (e.type === 'light_apprentice') { ctx.fillStyle = '#8dff7a'; ctx.strokeStyle = '#0a0f06'; ctx.lineWidth = 2; const hy = e.y - 46; ctx.beginPath(); ctx.rect(e.x - 2.5, hy - 7, 5, 14); ctx.rect(e.x - 7, hy - 2.5, 14, 5); ctx.stroke(); ctx.fill(); }
  if (e.type === 'storm_mage' && Math.random() < .08) part(e.x + frand(-14, 14), e.y - frand(10, 40), frand(-30, 30), frand(-30, 30), .15, '#fff59a', 2);
  if (e.freezeT > 0) {
    const w = 40 * e.sc, h = 58 * e.sc;
    ctx.fillStyle = 'rgba(170,230,255,.42)'; ctx.strokeStyle = 'rgba(230,250,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(e.x - w / 2, e.y - h / 2, w, h, 6); ctx.fill(); ctx.stroke();
  }
  if ((e.elite || ETYPES[e.type].role === 'master' || e.obj) && e.hp < e.maxHp) {
    const w = 46 * e.sc * .7, y = e.y - 44 * e.sc;
    ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 8);
    ctx.fillStyle = '#ffcf3a'; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}
export function drawCharge(e, t) {
  const C = !e.boss && CASTS[e.ck], [tx, ty] = tipPos(e), p = clamp(e.ft / e.charge, 0, 1), col = (C ? C.col : CCOL[e.ck]) || '#ffffff';
  const R = (5 + 13 * p) * Math.min(e.sc, 1.6) * (1 + .12 * Math.sin(t * 40));
  if (C && C.aim && !e.clone) {
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
  const spr = al.moving ? `gob.walk.${al.face}.${(Math.floor(al.at * 12) % 6) + 1}` : `gob.idle.${al.face}.${(Math.floor(run.time * 5) % 4) + 1}`;
  drawSpr(spr, al.x, al.y - 4, sc, 0, P.rageT > 0 ? 'rage' : null);
  if (al.slash > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${al.slash / .15})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(al.x + Math.cos(al.sa) * 16, al.y - 6 + Math.sin(al.sa) * 16, 14, al.sa - 1.2, al.sa + 1.2); ctx.stroke();
  }
}
export function drawPlayer(t) {
  const roll = P.rollT > 0 && !run.over;
  const flick = P.inv > 0 && !roll && !run.over && Math.floor(t * 20) % 2 === 0;
  if (P.slowT > 0) { ctx.fillStyle = 'rgba(120,210,255,.4)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 14, 22, 8, 0, 0, TAU); ctx.fill(); }
  if (P.sprinting) {
    ctx.strokeStyle = 'rgba(255,240,170,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const o = (i - 1) * 12; ctx.beginPath(); ctx.moveTo(P.x - P.aimX * 30 - P.aimY * o, P.y - 8 - P.aimY * 30 + P.aimX * o); ctx.lineTo(P.x - P.aimX * 55 - P.aimY * o, P.y - 8 - P.aimY * 55 + P.aimX * o); ctx.stroke(); }
  }
  const spr = curPlayerSpr();
  ctx.save(); ctx.translate(P.x, P.y - 8);
  if (roll) {
    // Squash & Stretch in Bewegungsrichtung: Start gestaucht, Ende gestreckt
    const q = 1 - P.rollT / ROLL_T, a = Math.atan2(P.dvy, P.dvx);
    const [kx, ky] = q < .2 ? [1.25, .8] : q > .75 ? [.85, 1.15] : [1, 1];
    ctx.rotate(a); ctx.scale(kx, ky); ctx.rotate(-a);
    // unverwundbar: weißer Rand
    if (P.inv > 0) drawSpr(spr, 0, 0, 1.12, 0, 'white', .85);
  }
  drawSpr(spr, 0, 0, 1, 0, P.rageT > 0 ? 'rage' : null, flick ? .45 : 1);
  ctx.restore();
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

// Spawn-Portal: Ring in Schulfarbe wächst, der Magier steigt daraus auf
function drawPortal(e, t) {
  const p = 1 - e.spawnT / SPAWN_T, col = ECOL[e.type] || '#c58cff', R = (18 + 10 * p) * Math.min(e.sc, 1.6);
  ctx.save();
  ctx.globalAlpha = .35 + .3 * Math.sin(t * 20); ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 22 * e.sc, R, R * .38, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 40;
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 22 * e.sc, R, R * .38, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.ellipse(e.x, e.y + 22 * e.sc, R * .8, R * .3, 0, 0, TAU); ctx.clip();
  ctx.restore();
  drawSpr(e.spr || e.pre + '.idle.down.1', e.x, e.y + 22 * e.sc * (1 - p), e.sc, 0, p < .6 ? col : e.tint, .3 + .7 * p);
}

// ---------- Bodenwarnungen der Gegner ----------
const HCOL = { fire: [255, 122, 26], storm: [255, 228, 92], toxic: [123, 224, 74], earth: [201, 163, 106], necro: [123, 255, 106], light: [255, 255, 255], shadow: [178, 107, 255] };
const rgba = (k, a) => { const c = HCOL[k] || HCOL.light; return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
// top: true = über dem Boden (Strahlen, Feuerwände), false = flach auf dem Boden
function drawHaz(t, top) {
  for (const h of run.haz) {
    const warn = h.warn > 0, p = warn ? clamp(1 - h.warn / h.dur, 0, 1) : 1;
    const isTop = h.shape === 'beam' || (!warn && h.shape === 'line');
    if (isTop !== top) continue;
    ctx.save();
    if (h.shape === 'circle') {
      const ry = h.r * .72;
      if (h.src === 'runes') {
        // Beschwörungsrunen: Kreis mit drehenden Zeichen
        ctx.strokeStyle = rgba(h.kind, .9); ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 50;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = rgba(h.kind, .15 + .2 * p); ctx.fill();
        for (let i = 0; i < 5; i++) { const a = t * 2 + i * TAU / 5; ctx.fillStyle = rgba(h.kind, .9); ctx.fillRect(h.x + Math.cos(a) * h.r * .6 - 2, h.y + Math.sin(a) * ry * .6 - 5, 4, 10); }
      } else if (warn) {
        if (h.grow) { ctx.fillStyle = `rgba(0,0,0,${.15 + .3 * p})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (.3 + .7 * p), ry * (.3 + .7 * p), 0, 0, TAU); ctx.fill(); }
        ctx.fillStyle = rgba(h.kind, .12 + .25 * p); ctx.strokeStyle = rgba(h.kind, .95); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, ry, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = rgba(h.kind, .35); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * p, ry * p, 0, 0, TAU); ctx.fill();
      } else {
        // Giftpfütze: lila-grün mit rotem Rand = gefährlich
        ctx.globalAlpha = clamp(Math.min(h.t / .4, h.act / .2 + .3), 0, 1);
        const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r);
        g.addColorStop(0, 'rgba(120,200,40,.75)'); g.addColorStop(.7, 'rgba(110,50,160,.6)'); g.addColorStop(1, 'rgba(110,50,160,.15)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, ry, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,70,70,.75)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 20; ctx.stroke();
      }
    } else if (h.shape === 'line') {
      ctx.lineCap = 'round';
      const seg = () => { ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x2, h.y2); };
      if (warn) {
        seg(); ctx.strokeStyle = rgba(h.kind, .12 + .25 * p); ctx.lineWidth = h.w; ctx.stroke();
        if (h.kind === 'earth') {
          // Risse im Boden
          const L = Math.hypot(h.x2 - h.x, h.y2 - h.y), n = Math.max(4, L / 22 | 0), nx = -(h.y2 - h.y) / L, ny = (h.x2 - h.x) / L;
          ctx.beginPath(); ctx.moveTo(h.x, h.y);
          for (let i = 1; i <= n * p; i++) { const q = i / n, o = (i % 2 ? 6 : -6); ctx.lineTo(h.x + (h.x2 - h.x) * q + nx * o, h.y + (h.y2 - h.y) * q + ny * o); }
          ctx.strokeStyle = 'rgba(60,40,20,.9)'; ctx.lineWidth = 2.5; ctx.stroke();
        } else { seg(); ctx.strokeStyle = rgba(h.kind, .9); ctx.lineWidth = 2.5; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 60; ctx.stroke(); }
      } else if (h.kind === 'fire') {
        seg(); ctx.strokeStyle = 'rgba(255,90,20,.45)'; ctx.lineWidth = h.w * 1.4; ctx.stroke();
        seg(); ctx.strokeStyle = `rgba(255,200,80,${.7 + .2 * Math.sin(t * 25)})`; ctx.lineWidth = h.w * .6; ctx.stroke();
        if (Math.random() < .7) { const q = Math.random(); part(h.x + (h.x2 - h.x) * q, h.y + (h.y2 - h.y) * q, frand(-15, 15), frand(-90, -40), .4, Math.random() < .5 ? '#ffb347' : '#ff5a1f', frand(3, 6)); }
      } else {
        seg(); ctx.strokeStyle = rgba(h.kind, .45); ctx.lineWidth = h.w * 1.3; ctx.stroke();
        seg(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = h.w * .35; ctx.stroke();
      }
    } else if (h.shape === 'cone') {
      ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, h.len, h.a - h.spread, h.a + h.spread); ctx.closePath();
      ctx.fillStyle = rgba(h.kind, warn ? .1 + .22 * p : .45); ctx.fill();
      ctx.strokeStyle = rgba(h.kind, .9); ctx.lineWidth = 2.5; if (warn) { ctx.setLineDash([10, 7]); ctx.lineDashOffset = -t * 40; } ctx.stroke();
    } else if (h.shape === 'beam') {
      const ax = h.a.x, ay = h.a.y - 20, bx = h.b.x, by = h.b.y - 20;
      if (warn) { ctx.strokeStyle = rgba(h.kind, .55 + .35 * Math.sin(t * 20)); ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 60; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
      else {
        const n = 9, pts = [[ax, ay]];
        for (let i = 1; i < n; i++) { const q = i / n; pts.push([ax + (bx - ax) * q + frand(-8, 8), ay + (by - ay) * q + frand(-8, 8)]); }
        pts.push([bx, by]);
        for (const [lw, col] of [[h.w * 1.2, rgba('storm', .35)], [h.w * .35, 'rgba(255,255,230,.95)']]) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
}

// Objekte ohne Figur: Leerenportal, Knochenhaufen
function drawObject(e, t) {
  if (e.type === 'void_portal') {
    const grow = e.spawnT > 0 ? 1 - e.spawnT / 2 : 1, R = 30 * grow;
    for (let i = 3; i >= 0; i--) {
      ctx.fillStyle = i % 2 ? 'rgba(60,20,110,.85)' : 'rgba(150,80,255,.7)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y, R * (1 - i * .2), R * 1.3 * (1 - i * .2), Math.sin(t * 2 + i) * .3, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(200,150,255,.9)'; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.lineDashOffset = t * 50;
    ctx.beginPath(); ctx.ellipse(e.x, e.y, R + 4, R * 1.3 + 4, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    if (Math.random() < .3) part(e.x + frand(-R, R), e.y + frand(-R, R), 0, frand(-60, -20), .5, '#c99bff', 3);
  } else {
    // Knochen zucken, je näher das Aufstehen
    const k = clamp(1 - e.revT / 3, 0, 1), j = Math.sin(t * (10 + 30 * k)) * 2 * k;
    ctx.save(); ctx.translate(e.x, e.y + 10);
    ctx.fillStyle = '#ece4cf'; ctx.strokeStyle = '#1d2b14'; ctx.lineWidth = 2;
    for (const [x, y, r] of [[-9, 2, .4], [8, 3, -.5], [0, -1, 1.4]]) { ctx.save(); ctx.translate(x + j, y); ctx.rotate(r); ctx.beginPath(); ctx.roundRect(-9, -2.5, 18, 5, 2.5); ctx.fill(); ctx.stroke(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(-j, -6, 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#151515'; ctx.beginPath(); ctx.arc(-2 - j, -7, 1.6, 0, TAU); ctx.arc(2 - j, -7, 1.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(123,255,106,${.4 + .5 * k})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    ctx.restore();
  }
  if (e.hp < e.maxHp) { const w = 40, y = e.y - 40; ctx.fillStyle = 'rgba(10,15,6,.85)'; ctx.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 8); ctx.fillStyle = SCHOOL_COL[e.school]; ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4); }
}

// Eisschild des Gletscherwächters in Blickrichtung
function drawFrontShield(e) {
  const a = DIR8.indexOf(e.face) * Math.PI / 4, R = 24 * e.sc, x = e.x + Math.cos(a) * R * .8, y = e.y - 6 * e.sc + Math.sin(a) * R * .5;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.fillStyle = 'rgba(190,240,255,.75)'; ctx.strokeStyle = 'rgba(240,252,255,.95)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-3, -20 * e.sc); ctx.quadraticCurveTo(9, 0, -3, 20 * e.sc); ctx.lineTo(-9, 14 * e.sc); ctx.quadraticCurveTo(0, 0, -9, -14 * e.sc); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawRock(x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#8a7a62'; ctx.strokeStyle = '#1d2b14'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(-5, -11); ctx.lineTo(6, -10); ctx.lineTo(12, -1); ctx.lineTo(7, 9); ctx.lineTo(-6, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(3, -7); ctx.lineTo(-1, -1); ctx.closePath(); ctx.fill();
  ctx.restore();
}
