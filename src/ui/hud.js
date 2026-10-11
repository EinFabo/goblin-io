import { $, clamp, fmtTime } from '../core/util.js';
import { STAGE_LEN } from '../data/stages.js';
import { P, run } from '../game/state.js';
import { icon } from '../render/icons.js';

// ---------- HUD ----------
export const hudCache = {};
export function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
export function setAbil(id, p, ready, on = false) {
  const b = $(id), ps = clamp(p, 0, 1).toFixed(3);
  if (hudCache[id + 'p'] !== ps) { hudCache[id + 'p'] = ps; b.style.setProperty('--p', ps); }
  if (hudCache[id + 'r'] !== ready) { hudCache[id + 'r'] = ready; b.classList.toggle('ready', ready); }
  if (hudCache[id + 'o'] !== on) { hudCache[id + 'o'] = on; b.classList.toggle('on', on); }
}
export function updHud(dt) {
  if (!run) return;
  $('#xpFill').style.width = (P.xp / P.need * 100).toFixed(1) + '%';
  setTxt('#lvTxt', 'Lv ' + P.lv);
  setTxt('#killTxt', String(run.kills));
  setTxt('#goldTxt', String(run.gold));
  setTxt('#timeTxt', run.st.endless ? fmtTime(run.time) : fmtTime(Math.min(run.time, STAGE_LEN)));
  setAbil('#ultBtn', P.ult / P.ultNeed, P.ult >= P.ultNeed, P.rageT > 0);
  setAbil('#dashBtn', 1 - Math.max(0, P.dashCd) / 2.4, P.dashCd <= 0);
  setAbil('#sprintBtn', P.stam / P.stamMax, !P.exhaust, P.sprinting);
  setAbil('#mechBtn', P.mechT > 0 ? P.mechT / P.mechMax : P.scrap / 100, P.scrap >= 100, P.mechT > 0);
  if (run.boss) $('#bossFill').style.width = (Math.max(0, run.boss.hp / run.boss.maxHp) * 100).toFixed(1) + '%';
  if (!run.paused) {
    run.hintT -= dt;
    if (run.hintT <= 0) {
      const h = $('#hint');
      if (run.hints.length) { h.innerHTML = run.hints.shift(); h.hidden = false; h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; run.hintT = 3.6; }
      else if (!h.hidden) h.hidden = true;
    }
  }
}
export function slotHtml(ic, lv, evo) { return `<div class="slot${evo ? ' evo' : ''}"><img src="${ic}" alt=""><i>${evo ? '★' : lv}</i></div>`; }
export function refreshSlots() {
  $('#wSlots').innerHTML = run.weapons.map(w => slotHtml(icon(w.evo ? w.id + '_evo' : w.id), w.lv, w.evo)).join('');
  $('#pSlots').innerHTML = Object.entries(run.passives).map(([id, lv]) => slotHtml(icon(id), lv, false)).join('');
}
export function banner(txt, cls) { const b = $('#banner'); b.className = ''; void b.offsetWidth; b.textContent = txt; b.className = 'show ' + (cls || ''); }
