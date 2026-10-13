import { $, clamp, fmtTime } from '../core/util.js';
import { P, run } from '../game/state.js';
import { icon } from '../render/icons.js';
import { ABILITIES } from '../data/abilities.js';
import { ETYPES } from '../data/enemies.js';
import { abilCount, abilReady, dashCdOf, lockOf } from '../game/abilities.js';
import { sfx } from '../core/audio.js';
import { part, ring } from '../game/fx.js';
import { on } from '../core/events.js';

// ---------- HUD ----------
export const hudCache = {};
export function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
// Kurz-Animation am Knopf neu starten (Klasse weg, Reflow, Klasse dran)
export function flashBtn(b, cls) { b.classList.remove('tick', 'pop', 'fire'); void b.offsetWidth; b.classList.add(cls); }
export function setAbil(id, p, ready, on = false, lock = false) {
  const b = $(id), ps = clamp(p, 0, 1).toFixed(3), was = hudCache[id + 'p'];
  if (was !== ps) {
    hudCache[id + 'p'] = ps; b.style.setProperty('--p', ps);
    // beim Aufladen kurz aufleuchten, wenn 50 % bzw. 75 % überschritten werden
    if (was !== undefined && !ready && [.5, .75].some(m => +was < m && +ps >= m)) flashBtn(b, 'tick');
  }
  if (hudCache[id + 'r'] !== ready) {
    // nicht bereit → bereit: Pop mit Lichtring und Ton (nicht beim ersten Zeichnen eines Laufs)
    if (ready && hudCache[id + 'r'] === false && id !== '#sprintBtn') { flashBtn(b, 'pop'); if (id !== '#dashBtn') sfx.abilReady(id === '#ab1Btn' ? 1 : 0); }
    hudCache[id + 'r'] = ready; b.classList.toggle('ready', ready);
  }
  if (hudCache[id + 'o'] !== on) { hudCache[id + 'o'] = on; b.classList.toggle('on', on); }
  if (hudCache[id + 'l'] !== lock) { hudCache[id + 'l'] = lock; b.classList.toggle('locked', lock); }
}
// Zahl der bereiten Ladungen (nur bei mehreren Ladungen)
function setCount(id, n) {
  if (hudCache[id + 'n'] === n) return;
  const el = $(id + ' .cnt'), more = +n > +(hudCache[id + 'n'] || 0) && hudCache[id + 'n'] !== undefined;
  hudCache[id + 'n'] = n; el.textContent = n;
  // neue Ladung: Zahl hüpft, bei der Rolle ein leiser Klick
  if (more) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); if (id === '#dashBtn') sfx.dashBack(); }
}
export function updHud(dt) {
  if (!run) return;
  $('#xpFill').style.width = (P.xp / P.need * 100).toFixed(1) + '%';
  setTxt('#lvTxt', 'Lv ' + P.lv);
  setTxt('#killTxt', String(run.kills));
  setTxt('#goldTxt', String(run.gold));
  setTxt('#timeTxt', run.st.len && !run.st.endless ? fmtTime(Math.max(0, run.st.len - run.time)) : fmtTime(run.time));
  run.abil.forEach((s, i) => { if (!s) return; setAbil('#ab' + i + 'Btn', abilFill(s), abilReady(s), abilActive(s.id), !!lockOf(s.id)); setCount('#ab' + i + 'Btn', s.max > 1 ? String(abilCount(s)) : ''); });
  setAbil('#dashBtn', P.dashN > 0 ? 1 : 1 - Math.max(0, P.dashCd) / dashCdOf(), P.dashN > 0, false, !!lockOf('dash'));
  setCount('#dashBtn', P.dashMax > 1 ? String(P.dashN) : '');
  setAbil('#sprintBtn', P.stam / P.stamMax, !P.exhaust, P.sprinting, !!lockOf('sprint'));
  if (run.boss) $('#bossFill').style.width = (Math.max(0, run.boss.hp / run.boss.maxHp) * 100).toFixed(1) + '%';
  // Mini-Boss: eigene Leiste, solange er lebt
  const mini = run.mini && !run.mini.dead ? run.mini : null;
  if (hudCache.mini !== mini) { hudCache.mini = mini; $('#miniBar').hidden = !mini; if (mini) $('#miniName').textContent = 'Mini-Boss · ' + ETYPES[mini.type].name; }
  if (mini) $('#miniFill').style.width = (Math.max(0, mini.hp / mini.maxHp) * 100).toFixed(1) + '%';
  if (!run.paused && !run.cut) {
    run.hintT -= dt;
    if (run.hintT <= 0) {
      const h = $('#hint');
      if (run.hints.length) { h.innerHTML = run.hints.shift(); h.hidden = false; h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; run.hintT = 3.6; }
      else if (!h.hidden) h.hidden = true;
    }
  }
}
// Leiste: Aufladung, während der Wirkung die Restzeit
const abilActive = id => id === 'rage' ? P.rageT > 0 : id === 'mech' ? P.mechT > 0 : id === 'smoke' ? P.smokeT > 0 : id === 'shield' ? P.shieldT > 0 : id === 'totem' ? run.goldT > 0 : false;
function abilFill(s) {
  if (s.id === 'mech' && P.mechT > 0) return P.mechT / P.mechMax;
  if (s.id === 'shield' && P.shieldT > 0) return P.shieldHp / P.shieldMax;
  return s.ch / s.need;
}
// Knöpfe passend zur Ausrüstung beschriften (beim Start eines Laufs)
export function setupAbilButtons() {
  run.abil.forEach((s, i) => {
    const b = $('#ab' + i + 'Btn'); b.hidden = !s; if (!s) return;
    const A = ABILITIES[s.id];
    b.querySelector('img').src = icon(s.id); b.querySelector('.lbl').textContent = A.short; b.setAttribute('aria-label', A.name);
    b.style.setProperty('--c', ABIL_COL[s.id] || '#e0a83a');
    for (const k of ['p', 'r', 'o', 'l', 'n']) delete hudCache['#ab' + i + 'Btn' + k];
  });
  // Rolle/Sprint: neuer Lauf ohne Pop und Klick vom Stand des letzten
  for (const id of ['#dashBtn', '#sprintBtn']) for (const k of ['p', 'r', 'n']) delete hudCache[id + k];
}
const ABIL_COL = { rage: '#ff5a3c', mech: '#e0a83a', trap: '#c9a26a', smoke: '#b8b8c8', catapult: '#a08a6a', hook: '#8fd0ff', shroom: '#7be04a', shield: '#dfe6ea', rats: '#d9a066', call: '#6fc23a', totem: '#ffd84a', timebomb: '#8fe6ff', bigbang: '#ff9a2e', charm: '#ffd84a' };
export function slotHtml(ic, lv, evo) { return `<div class="slot${evo ? ' evo' : ''}"><img src="${ic}" alt=""><i>${evo ? '★' : lv}</i></div>`; }
export function refreshSlots() {
  $('#wSlots').innerHTML = run.weapons.map(w => slotHtml(icon(w.evo ? w.id + '_evo' : w.id), w.lv, w.evo)).join('');
  $('#pSlots').innerHTML = Object.entries(run.passives).map(([id, lv]) => slotHtml(icon(id), lv, false)).join('');
}
export function banner(txt, cls) { const b = $('#banner'); b.className = ''; void b.offsetWidth; b.textContent = txt; b.className = 'show ' + (cls || ''); }

// Fähigkeit ausgelöst (game/abilities.js useAbility): Druckwelle am Knopf, Schlag-Ton, Funken am Goblin
on('abilUse', ({ i, id }) => {
  flashBtn($('#ab' + i + 'Btn'), 'fire'); sfx.abilUse();
  const col = ABIL_COL[id] || '#e0a83a';
  ring(P.x, P.y, 12, 110, .35, col, 7);
  for (let k = 0; k < 14; k++) { const a = k * Math.PI * 2 / 14; part(P.x, P.y - 12, Math.cos(a) * 240, Math.sin(a) * 240, .35, col, 3.5); }
});
