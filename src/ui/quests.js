// ---------- Aufgaben-Tab (Phase 11): Täglich · Woche · Kopfgeld · Pass ----------
// Die Tagesaufgaben sind aus dem Profil hierher gezogen; Logik in game/progress.js und game/quests.js.
import { sfx } from '../core/audio.js';
import { persist, save } from '../core/save.js';
import { $, fmtClock } from '../core/util.js';
import { DAILY_BONUS } from '../data/achievements.js';
import { CHESTS } from '../data/cards.js';
import { COSM } from '../data/cosmetics.js';
import { PASS_BONUS, PASS_BONUS_STEP, PASS_PTS, PASS_STAGES, PASS_STEP, PASS_TITLE, WEEKLY_BONUS, challengeReward, seasonSet } from '../data/quests.js';
import { claimDaily, claimDailyBonus, dailyOpen, dailyTasks, ensureDaily } from '../game/progress.js';
import { MUTATORS } from '../data/mutators.js';
import { ABILITIES } from '../data/abilities.js';
import { STAGES } from '../data/stages.js';
import { levelLabel } from '../data/levels.js';
import { icon } from '../render/icons.js';
import { bountyOpen, bountyReward, bountyStart, bountyText, challengeIsBoss, ensureChallenge, claimPass, claimWeekly, claimWeeklyBonus, daysLeftSeason, daysLeftWeek, ensureBounty,
  passBonusReady, passList, passOpen, passStage, weeklyOpen, weeklyTasks } from '../game/quests.js';
import { dayKey, msToMidnight } from '../game/shop.js';
import { chestSvg, runeSvg } from './cardart.js';
import { cosmTile } from './cosmart.js';
import { openChest } from './store.js';
import { playChest } from './chest-open.js';
import { burstAt, flashScreen, flyReward } from './rewardfx.js';

let sub = 'day', onChange = () => {}, start = () => {};
// Lauf starten (ui/menus.js startStage; Kreis-Import vermeiden)
export function questsStart(fn) { start = fn; }
export function questsChanged(fn) { onChange = fn; }
// Roter Punkt am Tab: irgendwo etwas abzuholen
export const questNews = () => dailyOpen(save) || weeklyOpen(save) || passOpen(save);
const fmtN = n => Math.floor(n).toLocaleString('de-DE');
// Belohnung als kleines Bild mit Zahl
export function rewardHtml(r) {
  if (r.gold) return `<span class="coin"></span>${fmtN(r.gold)}`;
  if (r.gems) return `<span class="gem"></span>${r.gems}`;
  if (r.chest) return `${chestSvg(r.chest)}<span>${CHESTS[r.chest].name}</span>`;
  if (r.runes) return `${runeSvg('might.1', 'qr')}<span>Runenkiste</span>`;
  if (r.cosm) return `<span class="qcosm">${COSM[r.cosm].name}</span>`;
  return '';
}
const btn = (can, data, got) => (got ? '<span class="ok">✓</span>' : `<button class="btn ${can ? 'primary' : 'ghost'} small" ${data} ${can ? '' : 'disabled'}>Abholen</button>`);
const bar = (prog, n) => `<div class="tbar2"><i style="width:${Math.min(100, prog / n * 100).toFixed(0)}%"></i><span>${fmtN(prog)} / ${fmtN(n)}</span></div>`;

export function renderQuests() {
  ensureDaily(save);   // beginnt auch Woche und Pass-Saison
  document.querySelectorAll('#quests [data-qsub]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.qsub === sub)));
  $('#qDayDot').hidden = !dailyOpen(save); $('#qWeekDot').hidden = !weeklyOpen(save); $('#qPassDot').hidden = !passOpen(save);
  const p = save.pass, stage = passStage(p.pts);
  $('#qPassMini').innerHTML = `<b>Pass Stufe ${stage}</b><div class="tbar2"><i style="width:${stage >= PASS_STAGES ? 100 : ((p.pts % PASS_STEP) / PASS_STEP * 100).toFixed(0)}%"></i><span>${fmtN(p.pts)} Punkte</span></div>`;
  $('#questView').innerHTML = sub === 'day' ? dayHtml() : sub === 'week' ? weekHtml() : sub === 'bounty' ? bountyHtml() : sub === 'chal' ? chalHtml() : passHtml();
  shownDay = dayKey();
}
function dayHtml() {
  const tasks = dailyTasks(save), all = tasks.every(t => t.claimed);
  return `<h3 class="sect">Tagesaufgaben <small id="qClock">neu in ${fmtClock(msToMidnight() / 1000)}</small></h3><p class="qhint">Je Aufgabe +${PASS_PTS.daily} Pass-Punkte, alle drei +${PASS_PTS.dailyAll}.</p><div class="tasks">${tasks.map((t, i) => `
    <div class="task${t.claimed ? ' got' : t.done ? ' done' : ''}"><div class="tt"><b>${t.text}</b>${bar(t.prog, t.n)}</div><div class="rw">${rewardHtml(t.reward)}</div>${btn(t.done, `data-daily="${i}"`, t.claimed)}</div>`).join('')}
    <div class="task bonus${save.daily.bonus ? ' got' : all ? ' done' : ''}"><div class="tt"><b>Alle drei geschafft</b></div><div class="rw">${rewardHtml(DAILY_BONUS)}</div>${btn(all, 'data-dbonus', save.daily.bonus)}</div></div>`;
}
function weekHtml() {
  const tasks = weeklyTasks(save), all = tasks.length > 0 && tasks.every(t => t.claimed), d = daysLeftWeek();
  return `<h3 class="sect">Wochenaufgaben <small>neu in ${d === 1 ? 'einem Tag' : d + ' Tagen'}</small></h3><p class="qhint">Je Aufgabe +${PASS_PTS.weekly} Pass-Punkte.</p><div class="tasks">${tasks.map((t, i) => `
    <div class="task${t.claimed ? ' got' : t.done ? ' done' : ''}"><div class="tt"><b>${t.text}</b>${bar(t.prog, t.n)}</div><div class="rw">${rewardHtml(t.reward)}</div>${btn(t.done, `data-weekly="${i}"`, t.claimed)}</div>`).join('')}
    <div class="task bonus${save.weekly.bonus ? ' got' : all ? ' done' : ''}"><div class="tt"><b>Alle fünf geschafft</b></div><div class="rw">${rewardHtml(WEEKLY_BONUS)}</div>${btn(all, 'data-wbonus', save.weekly.bonus)}</div></div>`;
}
const SKULL = '<svg viewBox="0 0 20 20" class="skull" aria-hidden="true"><path d="M10 2C5.6 2 3 5 3 8.6c0 2.2 1 3.6 2.3 4.4V16h2v-1.6h1.4V16h2.6v-1.6h1.4V16h2v-3c1.3-.8 2.3-2.2 2.3-4.4C17 5 14.4 2 10 2Z" fill="#f2ead6" stroke="#1d1208" stroke-width="1.4"/><circle cx="7.4" cy="9" r="1.8" fill="#1d1208"/><circle cx="12.6" cy="9" r="1.8" fill="#1d1208"/></svg>';
function bountyHtml() {
  if (!bountyOpen(save)) return '<p class="qempty">Das Kopfgeld-Brett hängt ab Welt 2. Besiege zuerst den Boss von Welt 1.</p>';
  const B = ensureBounty(save);
  return `<h3 class="sect">Kopfgeld-Brett <small id="qClock">neu in ${fmtClock(msToMidnight() / 1000)}</small></h3><p class="qhint">Ein Lauf erfüllt den Steckbrief, die Belohnung kommt gleich (Truhen ins Regal). Mit Weitermachen zählt er nicht. Je Steckbrief +${PASS_PTS.bounty} Pass-Punkte.</p>
    <div class="bounties">${B.list.map((b, i) => { const t = bountyText(b); return `<div class="wanted${B.done[i] ? ' got' : ''}"><div class="wtop">GESUCHT</div><div class="skulls">${SKULL.repeat(b.sk)}</div>
      <p class="goal">${t.goal}</p>${t.cond ? `<p class="cond">${t.cond}</p>` : ''}<div class="rw">${rewardHtml(bountyReward(b))}</div>${!B.done[i] && bountyStart(b) ? `<button class="btn primary small" data-bgo="${i}">Los!</button>` : ''}${B.done[i] ? '<div class="stamp">Erledigt</div>' : ''}</div>`; }).join('')}</div>`;
}
// Tägliche Herausforderung (Phase 12): ein festes Level mit 2 Fähigkeiten und 1–2 Mutatoren, beliebig viele Versuche
function chalHtml() {
  const C = ensureChallenge(save), d = C.def; if (!d) return '';
  const boss = challengeIsBoss(d), best = C.best ? (boss ? `${Math.floor(C.best / 60)}:${String(C.best % 60).padStart(2, '0')}` : `${C.best} Kills`) : '–';
  return `<h3 class="sect">Tägliche Herausforderung <small id="qClock">neu in ${fmtClock(msToMidnight() / 1000)}</small></h3>
    <p class="qhint">Feste Fähigkeiten und Mutatoren nur für diesen Lauf, beliebig viele Versuche. Bestwert: ${boss ? 'schnellster Sieg' : 'meiste Kills bei einem Sieg'}. Erster Sieg des Tages: Belohnung und +${PASS_PTS.challenge} Pass-Punkte.</p>
    <div class="chal${C.done ? ' got' : ''}"><div class="chead"><b>${levelLabel(d.si, d.li)} · ${STAGES[d.si].name}</b>${boss ? `<span>Boss: ${STAGES[d.si].boss.name}</span>` : ''}</div>
      <div class="cabil">${d.abil.map(a => `<span><img src="${icon(a)}" alt="">${ABILITIES[a].name}</span>`).join('')}</div>
      <ul class="cmut">${d.mut.map(m => `<li><b>${MUTATORS[m].name}</b> – ${MUTATORS[m].desc}</li>`).join('')}</ul>
      <div class="cfoot"><span>Bestwert heute: <b>${best}</b></span><span class="rw">${C.done ? '✓ Belohnung abgeholt' : `${rewardHtml({ gold: challengeReward(d.si).gold })} + ${rewardHtml({ runes: true })}`}</span>
      <button class="btn primary" data-chgo>Los!</button></div></div>`;
}
function passHtml() {
  const p = save.pass, list = passList(save), set = seasonSet(p.season), d = daysLeftSeason(), bonus = passBonusReady(p);
  return `<h3 class="sect">Aufgaben-Pass · Saison ${p.season + 1}: ${set.name} <small>endet in ${d === 1 ? 'einem Tag' : d + ' Tagen'}</small></h3>
    <p class="qhint">Punkte aus Tagesaufgaben, Wochenaufgaben, Kopfgeld und Fähigkeiten-Quests. Stufe 10, 20, 30: ${set.name}-Kosmetik, Stufe 30 dazu der Titel „${PASS_TITLE}“. Danach alle ${PASS_BONUS_STEP} Punkte eine ${CHESTS[PASS_BONUS.chest].name}.</p>
    <div class="passrow" id="passRow">${list.map(x => `<div class="pstage${x.claimed ? ' got' : x.reached ? ' ready' : ''}${x.s % 10 === 0 ? ' big' : ''}" data-ps="${x.s}">
      <span class="pn">${x.s}</span><div class="prw">${x.reward.cosm ? cosmTile(x.reward.cosm, 'small') : rewardHtml(x.reward)}</div>${btn(x.reached, `data-pass="${x.s}"`, x.claimed)}</div>`).join('')}</div>
    ${p.pts >= PASS_STAGES * PASS_STEP ? `<div class="task bonus${bonus > 0 ? ' done' : ''}"><div class="tt"><b>Bonustruhen</b><span>${bonus > 0 ? bonus + ' bereit' : `nächste bei ${fmtN(PASS_STAGES * PASS_STEP + (p.bonus + 1) * PASS_BONUS_STEP)} Punkten`}</span></div><div class="rw">${rewardHtml(PASS_BONUS)}</div>${btn(bonus > 0, 'data-pass="bonus"', false)}</div>` : ''}`;
}

// Belohnung fliegt zum Zähler, Truhen gehen auf, Runen/Kosmetik mit Funken
function show(b, r) {
  persist(); sfx.chest();
  flyReward(b, 'gold', r.gold || 0); flyReward(b, 'gems', r.gems || 0);
  if (r.runes || r.cosm || r.title) { const rc = b.getBoundingClientRect(); burstAt(rc.left + rc.width / 2, rc.top, ['#ffd84a', '#c9a8ff', '#ffffff'], 22); }
  if (r.title) flashScreen();
  // Tagesaufgaben geben die Truhe roh zurück (öffnen hier), alles aus game/quests.js ist schon geöffnet (nur Animation)
  if (r.chestRes) playChest(r.chestRes, () => onChange()); else if (r.chest) openChest(r.chest);
}
$('#quests').addEventListener('click', e => {
  const s = e.target.closest('[data-qsub]'); if (s) { if (s.dataset.qsub !== sub) { sub = s.dataset.qsub; sfx.tab(); renderQuests(); scrollPass(); } return; }
  const b = e.target.closest('button'); if (!b) return;
  let r = null;
  if (b.dataset.daily !== undefined) r = claimDaily(save, +b.dataset.daily);
  else if (b.dataset.dbonus !== undefined) r = claimDailyBonus(save);
  else if (b.dataset.weekly !== undefined) r = claimWeekly(save, +b.dataset.weekly);
  else if (b.dataset.wbonus !== undefined) r = claimWeeklyBonus(save);
  else if (b.dataset.pass !== undefined) r = claimPass(save, b.dataset.pass === 'bonus' ? 'bonus' : +b.dataset.pass);
  else if (b.dataset.chgo !== undefined) { const d = ensureChallenge(save).def; persist(); sfx.pickCard(); start(d.si, d.li, 0, { mut: d.mut, abil: d.abil, mode: 'challenge' }); return; }
  else if (b.dataset.bgo !== undefined) { const s = bountyStart(ensureBounty(save).list[+b.dataset.bgo]); if (!s) return; persist(); sfx.pickCard(); start(s.si, s.li, 0, { mut: s.mut, mode: 'bounty' }); return; }
  else return;
  if (!r) { sfx.buzz(); renderQuests(); return; }   // z. B. Mitternacht vorbei
  show(b, r);
  const x = $('#passRow') && $('#passRow').scrollLeft;
  renderQuests(); onChange();
  if (x && $('#passRow')) $('#passRow').scrollLeft = x;
});
// Countdown und Tageswechsel auffrischen, solange der Tab offen ist
let shownDay = '';
setInterval(() => {
  if ($('#quests').hidden) return;
  if (dayKey() !== shownDay) { renderQuests(); return; }
  const el = $('#qClock'); if (el) el.textContent = 'neu in ' + fmtClock(msToMidnight() / 1000);
}, 1000);
// Pass: beim Öffnen zur ersten offenen Stufe scrollen
export function scrollPass() {
  const row = $('#passRow'); if (!row) return;
  const t = row.querySelector('.pstage.ready:not(.got)') || row.querySelector('.pstage:not(.ready)');
  if (t) row.scrollLeft = t.offsetLeft - row.clientWidth / 2 + t.clientWidth / 2;
}
