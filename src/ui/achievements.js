import { sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $, fmtClock } from '../core/util.js';
import { ACHIEVEMENTS, DAILY_BONUS, TIERS } from '../data/achievements.js';
import { CHESTS } from '../data/cards.js';
import { COSM } from '../data/cosmetics.js';
import { achState, claimAch, claimDaily, claimDailyBonus, claimableCount, dailyOpen, dailyTasks, titles } from '../game/progress.js';
import { msToMidnight } from '../game/shop.js';
import { chestSvg } from './cardart.js';
import { openChest } from './store.js';

// ---------- Erfolge-Reiter im Profil: Tagesaufgaben, Titel, Erfolge (PLAN 9.8) ----------
let onChange = () => {};
export function achChanged(fn) { onChange = fn; }
export const achNews = () => claimableCount(save) > 0 || dailyOpen(save);
const fmtN = n => Math.floor(n).toLocaleString('de-DE');
const reward = r => r.gold ? `<span class="coin"></span>${r.gold}` : r.gems ? `<span class="gem"></span>${r.gems}` : `${chestSvg(r.chest)}<span>${CHESTS[r.chest].name}</span>`;

export function renderAch() {
  const tasks = dailyTasks(save), all = tasks.every(t => t.claimed);
  const daily = `<h3 class="sect">Tagesaufgaben <small>neu in ${fmtClock(msToMidnight() / 1000)}</small></h3><div class="tasks">${tasks.map((t, i) => `
    <div class="task${t.claimed ? ' got' : t.done ? ' done' : ''}"><div class="tt"><b>${t.text}</b><div class="tbar2"><i style="width:${(t.prog / t.n * 100).toFixed(0)}%"></i><span>${fmtN(t.prog)} / ${fmtN(t.n)}</span></div></div>
      <div class="rw">${reward(t.reward)}</div>
      ${t.claimed ? '<span class="ok">✓</span>' : `<button class="btn ${t.done ? 'primary' : 'ghost'} small" data-daily="${i}" ${t.done ? '' : 'disabled'}>Abholen</button>`}</div>`).join('')}
    <div class="task bonus${save.daily.bonus ? ' got' : all ? ' done' : ''}"><div class="tt"><b>Alle drei geschafft</b></div><div class="rw">${reward(DAILY_BONUS)}</div>
      ${save.daily.bonus ? '<span class="ok">✓</span>' : `<button class="btn ${all ? 'primary' : 'ghost'} small" data-dbonus ${all ? '' : 'disabled'}>Abholen</button>`}</div></div>`;
  const ts = titles(save);
  const title = `<div class="titlepick"><span>Titel</span><select id="titleSel" ${ts.length ? '' : 'disabled'}><option value="">– keiner –</option>${ts.map(t => `<option ${t === save.profile.title ? 'selected' : ''}>${t}</option>`).join('')}</select><small>${ts.length ? 'Steht unter deinem Namen.' : 'Titel gibt es für Gold-Erfolge.'}</small></div>`;
  // offene zuerst, dann nach Fortschritt
  const list = ACHIEVEMENTS.map(a => ({ a, s: achState(save, a) })).sort((x, y) => (y.s.can - x.s.can) || (x.s.claimed >= 3) - (y.s.claimed >= 3) || (y.s.v / y.s.next) - (x.s.v / x.s.next));
  const done = ACHIEVEMENTS.reduce((n, a) => n + (save.ach[a.id] || 0), 0);
  const ach = `<h3 class="sect">Erfolge <small>${done} / ${ACHIEVEMENTS.length * 3} Stufen</small></h3><div class="achs">${list.map(({ a, s }) => {
    const fmt = a.fmt || fmtN, goal = a.goals[Math.min(s.claimed, 2)], max = s.claimed >= 3;
    const prog = max ? 1 : Math.min(1, s.v / goal), extra = a.title || a.cosm ? `<small class="ex">Gold: ${[a.title && `Titel „${a.title}“`, a.cosm && COSM[a.cosm].name].filter(Boolean).join(' + ')}</small>` : '';
    return `<div class="ach${s.can ? ' can' : ''}${max ? ' max' : ''}"><div class="medals">${TIERS.map((T, i) => `<i style="--mc:${T.col}" class="${i < s.claimed ? 'on' : i < s.tier ? 'ready' : ''}" title="${T.name}"></i>`).join('')}</div>
      <div class="tt"><b>${a.name}</b><span>${a.desc.replace('{n}', fmt(goal))}</span>${extra}<div class="tbar2"><i style="width:${(prog * 100).toFixed(0)}%"></i><span>${max ? 'Alles geschafft' : `${fmt(Math.min(s.v, goal))} / ${fmt(goal)}`}</span></div></div>
      ${s.can ? `<button class="btn primary small" data-ach="${a.id}"><span class="gem"></span>${TIERS.slice(s.claimed, s.tier).reduce((n, T) => n + T.gems, 0)}</button>` : ''}</div>`;
  }).join('')}</div>`;
  $('#achView').innerHTML = daily + title + ach;
}

$('#achView').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.daily !== undefined) {
    const r = claimDaily(save, +b.dataset.daily); if (!r) { sfx.buzz(); return; }
    persist(); sfx.chest();
    if (r.chest) openChest(r.chest);
  } else if (b.dataset.dbonus !== undefined) { if (!claimDailyBonus(save)) { sfx.buzz(); return; } persist(); sfx.chest(); }
  else if (b.dataset.ach) { const r = claimAch(save, b.dataset.ach); if (!r) { sfx.buzz(); return; } persist(); if (r.cosm) sfx.master(); else sfx.lvl(); }
  else return;
  renderAch(); onChange();
});
$('#achView').addEventListener('change', e => { if (e.target.id !== 'titleSel') return; save.profile.title = e.target.value; persist(); sfx.click(); onChange(); });
