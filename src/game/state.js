import { H, W, ZOOM } from '../render/canvas.js';

// ---------- Spielzustand ----------
// run = aktueller Lauf, P = Spieler. Zuweisen nur über setRun/activate (ES-Module sind read-only von außen).
export let run = null, P = null;
export function setRun(r, p) { run = r; P = p; }
// Koop (Phase 14b): run.players = alle Goblins, run.pi = der gerade gerechnete, P = run.players[run.pi].
// Was einem Goblin gehört, aber auf run liegt (Ausrüstung, Fähigkeiten, eigene Geschosse und Helfer …), steht für die
// anderen in p.kit und wird von activate eingetauscht. Allein gibt es nur einen Goblin, activate(0) tut dann nichts.
export const KIT = ['weapons', 'passives', 'boons', 'offer', 'cards', 'rerolls', 'bans', 'locks', 'cardN', 'cls', 'clsLv',
  'abil', 'abMods', 'abXp', 'runes', 'abfx', 'tmpAllies', 'trapRolls', 'rageExt', 'lastAbil', 'allies', 'pproj', 'wfx', 'megas',
  'totem', 'goldT', 'decoy', 'hive', 'foe', 'favPotion', 'lockBuzz', 'leechGot', 'leechSec', 'bloodGot', 'bloodSec', 'soulHealT'];
export function activate(i) {
  if (i === run.pi) return;
  const a = run.players[run.pi].kit, b = run.players[i].kit;
  for (const k of KIT) { a[k] = run[k]; run[k] = b[k]; }
  run.pi = i; P = run.players[i];
}
// fn für jeden Goblin (live: nur die stehenden), danach ist wieder der vorige aktiv.
// Liefert fn true, hört die Schleife auf (z. B. Geschoss hat getroffen).
export function eachPlayer(fn, live = false) {
  const pi = run.pi;
  for (let i = 0; i < run.players.length; i++) { if (live && run.players[i].down) continue; activate(i); if (fn(P, i) === true) break; }
  activate(pi);
}
// Index des nächsten stehenden Goblins zu (x, y); seen: sichtbare zuerst (Rauchbombe, eingegraben). Allein immer 0.
export function nearestGob(x, y, seen = false) {
  const ps = run.players; if (ps.length === 1) return 0;
  let best = -1, bd = Infinity;
  for (const vis of seen ? [true, false] : [false]) {
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; if (p.down || (vis && (p.smokeT > 0 || p.burrowT > 0))) continue;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) return best;
  }
  return run.pi;
}
// Welt steht für eine Animation (Mega-Verschmelzung, Truhe im Lauf). run.megaFreeze sind Sekunden Sim-Zeit,
// heruntergezählt je Schritt in scenes/run.js (nicht die Wanduhr: im Koop stehen beide gleich lange).
// Nur für Eingaben und die Szene, nie in der Logik: die Sim ruft update ohne Szene auf.
export const uiFrozen = () => !!run && run.megaFreeze > 0;
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
// Schadens-Statistik (Phase 15): von welcher Waffe der Schaden gerade kommt (Geschosse, Effekte, Würfe merken sie sich als ws).
// Nur zum Zählen, die Sim liest es nie.
export let wsrc = null;
export function setWsrc(id) { wsrc = id || null; }
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
  const hw = viewHW() - margin, hh = viewHH() - margin, v = viewC(), c = [];
  for (const e of run.enemies) if (!e.dead && !(e.spawnT > 0) && Math.abs(e.x - v.x) < hw && Math.abs(e.y - v.y) < hh) c.push(e);
  return c;
}
// Große Gegner (Boss, Teile des Bosses, Elite, Mini-Boss): für Schadens-Regeln von Fähigkeiten und Passiven
export const isBig = e => !!(e.boss || e.link || e.elite || e.miniboss);
// Logik-Sicht (Phase 14): halbe Breite/Höhe in Welt-Einheiten und Mitte. Allein aus dem Fenster wie bisher; im Koop fest
// (run.fixedView) und um die Mitte beider Goblins (run.vc), damit beide Rechner gleich rechnen.
export const viewHW = () => (run && run.fixedView ? run.fixedView[0] : W / 2 / ZOOM);
export const viewHH = () => (run && run.fixedView ? run.fixedView[1] : H / 2 / ZOOM);
export const viewC = () => (run && run.vc) || P;
export const viewR = () => Math.hypot(viewHW(), viewHH());
export const onScreen = (x, y, m = 0) => { const c = viewC(); return Math.abs(x - c.x) < viewHW() + m && Math.abs(y - c.y) < viewHH() + m; };
export { xpNeed } from './balance.js';
export const pR = (p = P) => p.mechT > 0 ? 26 : 16;
// Unsichtbar für die Gegner: Rauchbombe oder eingegraben (Maulwurfsgang); sie suchen dann bei run.decoy
export const hidden = () => P.smokeT > 0 || P.burrowT > 0;
// Punkt bzw. Objekt in die Boss-Arena zurückschieben (margin = Abstand zum Rand)
export function clampToArena(o, margin) {
  const A = run.arena; if (!A) return o;
  const dx = o.x - A.x, dy = o.y - A.y, d = Math.hypot(dx, dy);
  if (d > A.r - margin && d > 0) { o.x = A.x + dx / d * (A.r - margin); o.y = A.y + dy / d * (A.r - margin); }
  return o;
}
// Mutator aktiv? (Phase 12, data/mutators.js)
export const hasMut = k => !!(run && run.mut && run.mut.includes(k));
// Leben auffüllen (nie über das Maximum); zählt die Heilung für das Kopfgeld „ohne Heilung“ (Phase 11)
export function heal(h) {
  if (hasMut('noheal')) return 0;   // Mutator „Keine Heilung“
  const nh = Math.min(P.maxHp, P.hp + h), g = nh - P.hp;   // wie bisher Math.min(P.maxHp, P.hp + h)
  P.hp = nh;
  if (g > 0 && run) run.healed = (run.healed || 0) + g;
  return Math.max(0, g);
}
// Eigene Waffen-ids für weaponOf: noch nicht entwickelte zuerst (Klassenwaffen teilen sich Passive mit anderen Waffen)
export const ownIds = () => [...run.weapons].sort((a, b) => a.evo - b.evo).map(w => w.id);
