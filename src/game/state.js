import { H, W, ZOOM } from '../render/canvas.js';

// ---------- Spielzustand ----------
// run = aktueller Lauf, P = Spieler. Zuweisen nur über setRun (ES-Module sind read-only von außen).
export let run = null, P = null;
export function setRun(r, p) { run = r; P = p; }
// Welt steht für eine Animation (Mega-Verschmelzung, Truhe im Lauf; Echtzeit). Nur für Eingaben von Spielern,
// nie in der Logik: die Sim ruft update/useAbility ohne Uhr auf und muss mit gleichen Seeds gleich ausgehen.
export const uiFrozen = () => !!run && run.megaFreeze > performance.now();
export const grid = new Map(); const CELL = 64;
export const gk = (cx, cy) => cx * 100003 + cy;
export function buildGrid() {
  grid.clear();
  for (const e of run.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const k = gk(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(e);
  }
}
// Jeder query-Aufruf ist ein Treffer-Ereignis (eine Explosion, ein Geschoss, ein Zonen-Tick). hurt() nutzt die Kennung,
// damit ein Ereignis Morgras Teile (gemeinsames Leben) nur einmal trifft. aoeScope macht dasselbe für Schleifen ohne query.
export let aoeId = 0; let aoeSeq = 0;
export function aoeScope(fn) { const prev = aoeId; aoeId = ++aoeSeq; try { fn(); } finally { aoeId = prev; } }
// Runen (Phase 10): Von welcher Fähigkeit kommt der Schaden gerade? hurt()/kill() lesen abSrc und wenden deren Runen an.
// Gesetzt um den Einsatz, die laufenden Effekte (run.abfx) und alles, was eine Fähigkeit hinterlässt
// (Geschosse, Felsen, Brandzonen, Krieger, later()) – diese Dinge merken sich die Quelle als src.
// setSrc gibt die vorige Quelle zurück, damit man sie wiederherstellen kann.
export let abSrc = null;
export function setSrc(s) { const p = abSrc; abSrc = s || null; return p; }
export function query(x, y, r, cb) {
  const prev = aoeId; aoeId = ++aoeSeq;
  try {
    const m = r + 60;
    const x0 = Math.floor((x - m) / CELL), x1 = Math.floor((x + m) / CELL), y0 = Math.floor((y - m) / CELL), y1 = Math.floor((y + m) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = grid.get(gk(cx, cy)); if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const e = a[i]; if (e.dead) continue;
        const dx = e.x - x, dy = e.y - y, rr = r + e.r;
        if (dx * dx + dy * dy < rr * rr) { if (cb(e) === false) return; }
      }
    }
  } finally { aoeId = prev; }
}
// ok: zusätzlicher Filter (z. B. keine Objekte)
export function nearest(maxD = 1e9, from = P, ok = null) {
  let best = null, bd = maxD * maxD;
  for (const e of run.enemies) { if (e.dead || e.spawnT > 0 || (ok && !ok(e))) continue; const d = (e.x - from.x) ** 2 + (e.y - from.y) ** 2; if (d < bd) { bd = d; best = e; } }
  return best;
}
export function randomEnemyInView(margin = 0) {
  const hw = W / 2 / ZOOM - margin, hh = H / 2 / ZOOM - margin, c = [];
  for (const e of run.enemies) if (!e.dead && !(e.spawnT > 0) && Math.abs(e.x - P.x) < hw && Math.abs(e.y - P.y) < hh) c.push(e);
  return c;
}
// Große Gegner (Boss, Teile des Bosses, Elite, Mini-Boss): für Schadens-Regeln von Fähigkeiten und Passiven
export const isBig = e => !!(e.boss || e.link || e.elite || e.miniboss);
export const viewR = () => Math.hypot(W / 2 / ZOOM, H / 2 / ZOOM);
export const onScreen = (x, y, m = 0) => Math.abs(x - P.x) < W / 2 / ZOOM + m && Math.abs(y - P.y) < H / 2 / ZOOM + m;
export { xpNeed } from './balance.js';
export const pR = () => P.mechT > 0 ? 26 : 16;
// Unsichtbar für die Gegner: Rauchbombe oder eingegraben (Maulwurfsgang); sie suchen dann bei run.decoy
export const hidden = () => P.smokeT > 0 || P.burrowT > 0;
// Punkt bzw. Objekt in die Boss-Arena zurückschieben (margin = Abstand zum Rand)
export function clampToArena(o, margin) {
  const A = run.arena; if (!A) return o;
  const dx = o.x - A.x, dy = o.y - A.y, d = Math.hypot(dx, dy);
  if (d > A.r - margin && d > 0) { o.x = A.x + dx / d * (A.r - margin); o.y = A.y + dy / d * (A.r - margin); }
  return o;
}
// Leben auffüllen (nie über das Maximum); zählt die Heilung für das Kopfgeld „ohne Heilung“ (Phase 11)
export function heal(h) {
  const nh = Math.min(P.maxHp, P.hp + h), g = nh - P.hp;   // wie bisher Math.min(P.maxHp, P.hp + h)
  P.hp = nh;
  if (g > 0 && run) run.healed = (run.healed || 0) + g;
  return Math.max(0, g);
}
// Eigene Waffen-ids für weaponOf: noch nicht entwickelte zuerst (Klassenwaffen teilen sich Passive mit anderen Waffen)
export const ownIds = () => [...run.weapons].sort((a, b) => a.evo - b.evo).map(w => w.id);
