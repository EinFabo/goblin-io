import { sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $ } from '../core/util.js';
import { ACH, ACHIEVEMENTS, TIERS } from '../data/achievements.js';
import { COSM } from '../data/cosmetics.js';
import { achState, claimAch, claimableCount, titles } from '../game/progress.js';
import { burstAt, flashScreen, flyReward } from './rewardfx.js';

// ---------- Erfolge-Reiter im Profil: Titel, Erfolge (PLAN 9.8); die Tagesaufgaben stehen seit Phase 11 im Aufgaben-Tab ----------
let onChange = () => {};
export function achChanged(fn) { onChange = fn; }
export const achNews = () => claimableCount(save) > 0;
const fmtN = n => Math.floor(n).toLocaleString('de-DE');

export function renderAch() {
  const ts = titles(save);
  const title = `<div class="titlepick"><span>Titel</span><select id="titleSel" ${ts.length ? '' : 'disabled'}><option value="">– keiner –</option>${ts.map(t => `<option ${t === save.profile.title ? 'selected' : ''}>${t}</option>`).join('')}</select><small>${ts.length ? 'Steht unter deinem Namen.' : 'Titel gibt es für Gold-Erfolge.'}</small></div>`;
  // offene zuerst, dann nach Fortschritt
  const list = ACHIEVEMENTS.map(a => ({ a, s: achState(save, a) })).sort((x, y) => (y.s.can - x.s.can) || (x.s.claimed >= 3) - (y.s.claimed >= 3) || (y.s.v / y.s.next) - (x.s.v / x.s.next));
  const done = ACHIEVEMENTS.reduce((n, a) => n + (save.ach[a.id] || 0), 0);
  const ach = `<h3 class="sect">Erfolge <small>${done} / ${ACHIEVEMENTS.length * 3} Stufen</small></h3><div class="achs">${list.map(({ a, s }) => {
    const fmt = a.fmt || fmtN, goal = a.goals[Math.min(s.claimed, 2)], max = s.claimed >= 3;
    const prog = max ? 1 : Math.min(1, s.v / goal), extra = a.title || a.cosm ? `<small class="ex">Gold: ${[a.title && `Titel „${a.title}“`, a.cosm && COSM[a.cosm].name].filter(Boolean).join(' + ')}</small>` : '';
    return `<div class="ach${s.can ? ' can' : ''}${max ? ' max' : ''}" data-aid="${a.id}"><div class="medals">${TIERS.map((T, i) => `<i style="--mc:${T.col}" class="${i < s.claimed ? 'on' : i < s.tier ? 'ready' : ''}" title="${T.name}"></i>`).join('')}</div>
      <div class="tt"><b>${a.name}</b><span>${a.desc.replace('{n}', fmt(goal))}</span>${extra}<div class="tbar2"><i style="width:${(prog * 100).toFixed(0)}%"></i><span>${max ? 'Alles geschafft' : `${fmt(Math.min(s.v, goal))} / ${fmt(goal)}`}</span></div></div>
      ${s.can ? `<button class="btn primary small" data-ach="${a.id}"><span class="gem"></span>${TIERS.slice(s.claimed, s.tier).reduce((n, T) => n + T.gems, 0)}</button>` : ''}</div>`;
  }).join('')}</div>`;
  $('#achView').innerHTML = title + ach;
}

$('#achView').addEventListener('click', e => {
  const b = e.target.closest('button[data-ach]'); if (!b) return;
  {
    const r = claimAch(save, b.dataset.ach); if (!r) { sfx.buzz(); return; }
    persist(); if (r.cosm) sfx.master(); else sfx.lvl();
    // Medaille: Lichtstrahlen und Funken, dann fliegen die Juwelen zum Zähler; Gold-Stufe mit Titel: goldener Blitz
    const card = b.closest('.ach') || b, rc = card.getBoundingClientRect();
    burstAt(rc.left + 40, rc.top + rc.height / 2, ['#ffd84a', '#fff3b0', '#ffffff'], 26);
    flyReward(b, 'gems', r.gems);
    if (r.cosm || ACH[b.dataset.ach] && save.ach[b.dataset.ach] >= 3) flashScreen();
    renderAch(); onChange();
    // neu gewonnene Medaille springt an ihrem (neu sortierten) Platz
    const c = $(`#achView [data-aid="${b.dataset.ach}"]`); if (c) c.classList.add('claimed');
  }
});
$('#achView').addEventListener('change', e => { if (e.target.id !== 'titleSel') return; save.profile.title = e.target.value; persist(); sfx.click(); onChange(); });
