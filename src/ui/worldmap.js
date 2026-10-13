import { audioInit, sfx } from '../core/audio.js';
import { levelDone, levelInfo, levelUnlocked, persist, save, stageBest, stageUnlocked } from '../core/save.js';
import { $, fmtTime } from '../core/util.js';
import { ENDLESS, LEVELS, LEVEL_KIND, WORLDS, levelLabel } from '../data/levels.js';
import { STAGES } from '../data/stages.js';
import { HAT_TXT, hatSvg, hatsHtml } from './hats.js';

// ---------- Weltkarte (PLAN 6.1a) ----------
// Eine Karte pro Welt: Pfad mit 5 Level-Punkten (der letzten Welt hängt Endlos als 6. Punkt an).
// Antippen → der Goblin läuft den Pfad entlang hin, dann geht der Zettel mit „Los!“ auf.
// Die Punkte sind echte Knöpfe (DOM), Boden, Pfad, Goblin und Boss zeichnet map-scene.js auf das Canvas.
export const M = {
  wi: 0,            // Index in WORLDS
  nodes: [],        // { si, li, x, y, d } in CSS-Pixeln, d = Strecke auf dem Pfad
  path: [],         // Punkte { x, y, d }
  len: 0,
  gob: { d: 0, to: 0, face: 'down', at: 0, sel: 0 },
  reveal: null,     // { from, to, t } neues Wegstück malt sich auf
  open: 0,          // bis zu dieser Strecke ist der Pfad frei
  w: 0, h: 0,
};
let start = () => {};
const SKULL = `<svg class="skull" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 7C14 7 8 13 8 22c0 5 3 8 5 10v6h22v-6c2-2 5-5 5-10 0-9-6-15-16-15z" fill="#eadcae" stroke="#0a0f06" stroke-width="3" stroke-linejoin="round"/><circle cx="17.5" cy="23" r="4.5" fill="#0a0f06"/><circle cx="30.5" cy="23" r="4.5" fill="#0a0f06"/><path d="M22 31l2-4 2 4z" fill="#0a0f06"/><path d="M19 34v4M24 34v4M29 34v4" stroke="#0a0f06" stroke-width="2.5"/></svg>`;
export function onStart(fn) { start = fn; }

const worldSi = () => WORLDS[M.wi];
const hasEndless = () => ENDLESS >= 0 && M.wi === WORLDS.length - 1;
const nodeOpen = n => STAGES[n.si].endless ? stageUnlocked(n.si) : levelUnlocked(n.si, n.li);
const nodeDone = n => STAGES[n.si].endless ? stageBest(n.si) > 0 : levelDone(n.si, n.li);

// Punkte im freien Bereich zwischen Kopfzeile und Zettel, quer im Zickzack, hochkant von unten nach oben
function layout() {
  const W = innerWidth, H = innerHeight, narrow = W < 640, short = H < 500 && W > H;
  // oben: unter der Welt-Tafel (+ Platz für Fahne und Goblin), unten: über Zettel und Tab-Leiste.
  // Handy quer: der Zettel steht rechts, die Karte nimmt die ganze Höhe
  const head = $('.worldhead').getBoundingClientRect(), tab = $('#tabbar').getBoundingClientRect();
  const top = (head.bottom || 150) + (short ? 36 : narrow ? 50 : 70), bot = (tab.top || H - 100) - (short ? 34 : narrow ? 205 : 250);
  const right = short ? 330 : 0, n = LEVELS + (hasEndless() ? 1 : 0), ah = Math.max(80, bot - top);
  const aw = Math.min(W - right - (narrow ? 40 : 80), 1000), x0 = (W - right - aw) / 2;
  const wide = !narrow && aw > ah * 1.15;
  M.nodes = [];
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : .5, z = i % 2 ? 1 : 0;
    const x = wide ? x0 + aw * (.06 + .88 * f) : x0 + aw * (i === n - 1 && n === LEVELS ? .5 : z ? .76 : .24);
    const y = wide ? top + ah * (z ? .28 : .72) : top + ah * (1 - f);
    M.nodes.push(i < LEVELS ? { si: worldSi(), li: i, x, y } : { si: ENDLESS, li: 0, x, y, endless: true });
  }
  // Glatter Pfad (Catmull-Rom), fein abgetastet
  const P = M.nodes, pts = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c2, d) => .5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      pts.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y), seg: i });
    }
  }
  pts.push({ x: P[P.length - 1].x, y: P[P.length - 1].y, seg: P.length - 1 });
  let d = 0;
  pts.forEach((p, i) => { if (i) d += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.d = d; });
  P.forEach((nd, i) => { nd.d = (pts.find(p => p.seg === i) || pts[pts.length - 1]).d; });
  M.path = pts; M.len = d; M.w = W; M.h = H;
}
// Strecke bis zum letzten freien Punkt
const openDist = () => { let d = 0; for (const n of M.nodes) if (nodeOpen(n)) d = n.d; return d; };
export function pathAt(d) {
  const P = M.path; if (!P.length) return { x: 0, y: 0, dx: 0, dy: 1 };
  let i = 1; while (i < P.length - 1 && P[i].d < d) i++;
  const a = P[i - 1], b = P[i], f = b.d > a.d ? Math.min(1, Math.max(0, (d - a.d) / (b.d - a.d))) : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dx: b.x - a.x, dy: b.y - a.y };
}

// Welt anzeigen; ohne Angabe die gespeicherte Stelle des Goblins
export function renderMap() {
  const m = save.map, inWorld = WORLDS.indexOf(m.si);
  M.wi = inWorld >= 0 ? inWorld : m.si === ENDLESS ? WORLDS.length - 1 : 0;
  build();
  // Gerade freigespielt: Wegstück malt sich auf, dann läuft der Goblin hin
  const sel = m.si === ENDLESS ? M.nodes.length - 1 : m.li, prev = M.nodes[sel - 1];
  if (m.fresh && prev) {
    M.gob.d = M.gob.to = prev.d; M.gob.sel = sel - 1;
    M.reveal = { from: prev.d, to: M.nodes[sel].d, t: 0, sel };
    M.open = prev.d;
  } else { M.gob.d = M.gob.to = M.nodes[sel].d; M.gob.sel = sel; M.reveal = null; M.open = openDist(); }
  if (m.fresh) { m.fresh = false; persist(); }
  renderNodes(); renderNote(!M.reveal);
}
function build() {
  layout();
  const si = worldSi(), st = STAGES[si], open = stageUnlocked(si);
  const hats = M.nodes.filter(n => !n.endless).reduce((a, n) => a + levelInfo(n.si, n.li).hats, 0);
  $('#wNum').textContent = 'Welt ' + (M.wi + 1);
  $('#wName').textContent = st.name;
  $('#wHats').innerHTML = open ? `<i class="hat1">${hatSvg}</i><b>${hats} / ${LEVELS * 3}</b>` : '<b>Gesperrt</b>';
  $('#wPrev').disabled = M.wi === 0; $('#wNext').disabled = M.wi === WORLDS.length - 1;
  $('#menu').classList.toggle('lockedworld', !open);
}
function renderNodes() {
  $('#mapNodes').innerHTML = M.nodes.map((n, i) => {
    const open = nodeOpen(n), done = nodeDone(n), boss = n.li === LEVELS - 1 && !n.endless;
    const hats = n.endless ? 0 : levelInfo(n.si, n.li).hats;
    const lbl = n.endless ? '∞' : boss ? '' : n.li + 1;
    return `<button class="mnode${boss ? ' boss' : ''}${n.endless ? ' endless' : ''}${open ? '' : ' locked'}${done ? ' done' : ''}${i === M.gob.sel ? ' sel' : ''}"
      style="left:${n.x}px;top:${n.y}px" data-node="${i}" aria-label="${n.endless ? 'Endlose Nacht' : 'Level ' + levelLabel(n.si, n.li)}${open ? '' : ', gesperrt'}">
      <span class="disc">${boss ? SKULL : `<b>${lbl}</b>`}</span>
      ${done && !n.endless ? '<span class="flag"></span>' : ''}${!n.endless && open ? hatsHtml(hats) : ''}</button>`;
  }).join('');
}
// Markierung umsetzen, ohne die Punkte neu aufzubauen (sonst spielt ihre Einblend-Animation erneut)
function markSel() { document.querySelectorAll('#mapNodes .mnode').forEach((b, i) => b.classList.toggle('sel', i === M.gob.sel)); }
function renderNote(show = true) {
  const n = M.nodes[M.gob.sel], note = $('#lvNote');
  if (!show || !n) { note.hidden = true; return; }
  note.hidden = false;
  const st = STAGES[n.si], open = nodeOpen(n);
  if (n.endless) {
    const best = stageBest(n.si);
    note.innerHTML = `<div class="nh"><span class="lbl">∞</span><h3>${st.name}</h3></div><p>${st.sub}</p>
      <p class="rec">${best ? 'Rekord: ' + fmtTime(best) : 'Noch nicht gespielt'}</p>${open ? '<button class="btn primary go" data-go>Los!</button>' : '<p class="lock">Besiege zuerst den letzten Boss.</p>'}`;
    return;
  }
  const K = LEVEL_KIND[n.li], boss = n.li === LEVELS - 1, info = levelInfo(n.si, n.li);
  const name = boss ? st.boss.name : K.name, sub = boss ? 'Boss-Level: erst Wellen, dann der Boss.' : K.sub + (n.li === 0 ? ' ' + st.sub : '');
  const rec = boss ? (info.fast ? 'Schnellster Sieg ' + fmtTime(info.fast) : '') : info.kills ? 'Rekord: ' + info.kills + ' Kills' : '';
  const why = HAT_TXT.map((t, i) => `<li class="${i < info.hats ? 'on' : ''}">${t}</li>`).join('');
  note.innerHTML = `<div class="nh"><span class="lbl">${levelLabel(n.si, n.li)}</span><h3>${name}</h3>${hatsHtml(info.hats)}</div><p>${sub}</p>
    <ul class="why">${why}</ul>${rec ? `<p class="rec">${rec}</p>` : ''}
    ${open ? `<button class="btn primary go" data-go>Los!</button>` : `<p class="lock">${!stageUnlocked(n.si) ? `Besiege zuerst den Boss von Welt ${M.wi}.` : `Schaffe zuerst ${levelLabel(n.si, n.li - 1)}.`}</p>`}`;
}

// Goblin zu Punkt i schicken (nur über freie Wegstücke)
function goTo(i) {
  const n = M.nodes[i]; if (!n) return;
  if (!nodeOpen(n)) { M.gob.sel = i; sfx.buzz(); markSel(); renderNote(); return; }
  if (M.reveal) return;
  if (i === M.gob.sel && Math.abs(M.gob.d - n.d) < 1) { renderNote(); return; }
  M.gob.sel = i; M.gob.to = n.d; sfx.hover();
  save.map = { si: n.si, li: n.li, fresh: false }; persist();
  // Steht er schon dort (z. B. nach Tippen auf ein gesperrtes Level), kommt kein Ankommen mehr: Zettel gleich zeigen
  markSel(); renderNote(Math.abs(M.gob.d - n.d) <= .5);
}
function stepNode(d) {
  let i = M.gob.sel + d;
  while (i >= 0 && i < M.nodes.length && !nodeOpen(M.nodes[i])) i += d;
  if (i < 0 || i >= M.nodes.length) { sfx.buzz(); return; }
  goTo(i);
}
let popT = 0;
function switchWorld(d) {
  const w = M.wi + d; if (w < 0 || w >= WORLDS.length) return;
  M.wi = w; sfx.tab();
  build();
  // auf das erste offene Level, das noch nicht geschafft ist (sonst das Boss-Level)
  let sel = M.nodes.findIndex(n => nodeOpen(n) && !nodeDone(n));
  if (sel < 0) sel = stageUnlocked(worldSi()) ? LEVELS - 1 : 0;
  M.gob.sel = sel; M.gob.d = M.gob.to = M.nodes[sel].d; M.reveal = null; M.open = openDist();
  if (stageUnlocked(worldSi())) { save.map = { si: M.nodes[sel].si, li: M.nodes[sel].li, fresh: false }; persist(); }
  $('#mapNodes').classList.remove('pop'); void $('#mapNodes').offsetWidth; $('#mapNodes').classList.add('pop');
  clearTimeout(popT); popT = setTimeout(() => $('#mapNodes').classList.remove('pop'), 500);
  renderNodes(); renderNote();
}

// Jeden Frame aus der Menü-Szene: Goblin laufen lassen, Wegstück aufmalen
export function tickMap(dt) {
  if (M.w !== innerWidth || M.h !== innerHeight) { const g = M.gob, n = M.nodes[g.sel]; build(); g.d = g.to = M.nodes[g.sel] ? M.nodes[g.sel].d : 0; if (n) renderNodes();
    const R = M.reveal; if (R) { R.from = M.nodes[R.sel - 1].d; R.to = M.nodes[R.sel].d; } else M.open = openDist(); }
  const R = M.reveal;
  if (R) {
    R.t += dt; M.open = R.from + (R.to - R.from) * Math.min(1, R.t / .9);
    if (R.t >= 1.1) { M.reveal = null; M.open = openDist(); const sel = R.sel; M.gob.sel = sel - 1; goTo(sel); sfx.pickCard(); }
    return;
  }
  const g = M.gob, diff = g.to - g.d;
  if (Math.abs(diff) > .5) {
    const sp = Math.max(240, Math.abs(diff) / 1.1);
    const was = g.d; g.d += Math.sign(diff) * Math.min(Math.abs(diff), sp * dt);
    const a = pathAt(g.d), b = pathAt(was);
    if (Math.hypot(a.x - b.x, a.y - b.y) > .01) g.vx = a.x - b.x, g.vy = a.y - b.y;
    g.at += dt; g.walking = true;
    if (Math.abs(g.to - g.d) <= .5) { g.d = g.to; g.walking = false; sfx.click(); renderNote(); }
  } else g.walking = false;
}

$('#mapNodes').addEventListener('click', e => { const b = e.target.closest('[data-node]'); if (b) { audioInit(); goTo(+b.dataset.node); } });
$('#lvNote').addEventListener('click', e => {
  if (!e.target.closest('[data-go]')) return;
  const n = M.nodes[M.gob.sel]; if (!n || !nodeOpen(n)) return;
  audioInit(); sfx.pickCard(); start(n.si, n.li);
});
$('#wPrev').addEventListener('click', () => switchWorld(-1));
$('#wNext').addEventListener('click', () => switchWorld(1));
export function mapKey(e) {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') stepNode(-1);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') stepNode(1);
  else if (e.code === 'PageUp' || e.code === 'KeyQ') switchWorld(-1);
  else if (e.code === 'PageDown' || e.code === 'KeyE') switchWorld(1);
  else if (e.code === 'Enter' && document.activeElement === document.body) { const b = $('#lvNote [data-go]'); if (b && !$('#lvNote').hidden) b.click(); }
}
