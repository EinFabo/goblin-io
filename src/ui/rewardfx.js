import { tone } from '../core/audio.js';
import { save } from '../core/save.js';
import { $ } from '../core/util.js';

// ---------- Belohnungs-Effekte (Wunsch Fabi: Erfolg abholen mit Juwelen-Explosion, Geld usw.) ----------
// Ein Vollbild-Canvas über allem. flyReward: Juwelen/Münzen platzen am Knopf heraus und fliegen gestaffelt im Bogen
// zum Zähler oben; jedes ankommende Teil zählt den Zähler ein Stück hoch (Ton steigt, Zähler pulst).
// Solange etwas fliegt, zeigt die Leiste wallet − „unterwegs“ (shownWallet), damit die Zahl nicht vorher springt.
// burstAt: nur Funken (z. B. Magierhüte im Ergebnis).

const cv = document.createElement('canvas');
cv.id = 'rewardFx'; cv.setAttribute('aria-hidden', 'true');
document.body.appendChild(cv);
const g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, raf = 0, last = 0;
const parts = [];    // Funken: { x, y, vx, vy, t, life, c, s }
const flyers = [];   // fliegende Belohnung: { kind, x, y, vx, vy, t, delay, from, to, share }
const pend = { gold: 0, gems: 0 };
let arrived = 0;      // Zähler für die Tonhöhe, sinkt nach einer Pause

function size() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
addEventListener('resize', size); size();

export const shownWallet = () => ({ gold: save.wallet.gold - pend.gold, gems: save.wallet.gems - pend.gems });
const counter = kind => $(kind === 'gold' ? '#topGold' : '#topGems');
function setCounter(kind) {
  const el = counter(kind); if (!el) return;
  el.textContent = shownWallet()[kind].toLocaleString('de-DE');
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

// n Teile (6–16, je nach Menge) platzen bei fromEl heraus und fliegen zum Zähler (kind: 'gold' | 'gems').
// to: anderes Ziel-Element (z. B. die Juwelen-Zeile im Ergebnis); dann zählt die Leiste oben nicht mit.
export function flyReward(fromEl, kind, amount, to = null) {
  if (!amount) return;
  const from = fromEl && fromEl.getBoundingClientRect ? center(fromEl) : { x: W / 2, y: H / 2 };
  const n = Math.max(to ? 4 : 6, Math.min(16, Math.round(Math.sqrt(amount) * (kind === 'gems' ? 2 : .9))));
  if (!to) pend[kind] += amount;
  let rest = amount;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 180 + Math.random() * 260, share = i === n - 1 ? rest : Math.floor(amount / n);
    rest -= share;
    flyers.push({ kind, to, x: from.x, y: from.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: 0, delay: .32 + i * .045, share, rot: Math.random() * 6 });
  }
  burstAt(from.x, from.y, kind === 'gems' ? ['#dc9bff', '#9a45e8', '#ffffff'] : ['#ffd84a', '#ff9a1f', '#ffffff'], 22);
  if (!to) setCounter(kind);
  run();
}
// Zahl in einem Element hochzählen („+120“), Dauer ms
export function countUp(el, to, ms = 600, prefix = '+') {
  const t0 = performance.now();
  const step = now => { const q = Math.min(1, (now - t0) / ms), v = Math.round(to * (1 - Math.pow(1 - q, 3))); el.textContent = prefix + v.toLocaleString('de-DE'); if (q < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export const centerOf = center;
// Funken-Explosion an einer Bildschirmstelle
export function burstAt(x, y, cols = ['#ffd84a', '#ffffff'], n = 18) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + Math.random() * .3, sp = 140 + Math.random() * 260;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: .45 + Math.random() * .3, c: cols[i % cols.length], s: 2.5 + Math.random() * 3 });
  }
  run();
}

// Goldener Blitz am Bildschirmrand (Gold-Stufe eines Erfolgs, Titel)
let flashT = 0;
export function flashScreen() { flashT = .5; run(); }

function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
function tick(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
  for (const p of parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy = p.vy * .92 + 260 * dt;
    g.globalAlpha = Math.max(0, 1 - p.t / p.life); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  if (flashT > 0) {
    flashT -= dt;
    const a = Math.max(0, flashT / .5), gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
    gr.addColorStop(0, 'rgba(255,216,74,0)'); gr.addColorStop(1, `rgba(255,216,74,${.55 * a})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);
  for (const f of flyers) {
    f.t += dt; f.rot += dt * 6;
    if (f.t < f.delay) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .9; f.vy = f.vy * .9 + 300 * dt; }
    else {
      // zum Zähler: weich beschleunigen, das Ziel kann sich bewegen (Fenstergröße)
      const el = f.to || counter(f.kind), to = el ? center(el) : { x: W - 40, y: 20 };
      const dx = to.x - f.x, dy = to.y - f.y, d = Math.hypot(dx, dy), sp = 300 + (f.t - f.delay) * 2400;
      if (d < 16 || f.t > f.delay + 1.6) { f.done = true; arrive(f); continue; }
      f.vx += (dx / d * sp - f.vx) * Math.min(1, dt * 10); f.vy += (dy / d * sp - f.vy) * Math.min(1, dt * 10);
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    drawIcon(f);
  }
  for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].done) flyers.splice(i, 1);
  if (parts.length || flyers.length || flashT > 0) raf = requestAnimationFrame(tick);
  else { raf = 0; g.clearRect(0, 0, W, H); arrived = 0; }
}
function arrive(f) {
  if (f.to) { f.to.classList.remove('bump'); void f.to.offsetWidth; f.to.classList.add('bump'); }
  else { pend[f.kind] = Math.max(0, pend[f.kind] - f.share); setCounter(f.kind); }
  // Ton steigt mit jedem angekommenen Teil (wie beim Kristalle-Sammeln)
  const k = Math.min(arrived++, 14), fr = (f.kind === 'gems' ? 990 : 1320) * Math.pow(2, k / 12);
  tone(fr, 0, .07, f.kind === 'gems' ? 'sine' : 'square', f.kind === 'gems' ? .05 : .025); tone(fr * 1.5, 0, .05, 'triangle', .02, .02);
  const el = f.to || counter(f.kind); if (el) { const c = center(el); for (let i = 0; i < 3; i++) parts.push({ x: c.x, y: c.y, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, t: 0, life: .3, c: f.kind === 'gems' ? '#dc9bff' : '#ffd84a', s: 2 }); }
}
function drawIcon(f) {
  g.save(); g.translate(f.x, f.y);
  g.strokeStyle = '#0a0f06'; g.lineWidth = 2;
  if (f.kind === 'gems') {
    g.rotate(Math.sin(f.rot) * .3);
    g.fillStyle = '#b06cf0'; g.beginPath(); g.moveTo(0, -9); g.lineTo(8, -2); g.lineTo(0, 10); g.lineTo(-8, -2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e6c6ff'; g.beginPath(); g.moveTo(0, -9); g.lineTo(3, -2); g.lineTo(-3, -2); g.closePath(); g.fill();
  } else {
    g.scale(Math.abs(Math.cos(f.rot)) * .7 + .3, 1);
    g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#ff9a1f'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill();
  }
  g.restore();
}
