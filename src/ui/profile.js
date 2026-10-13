import { sfx } from '../core/audio.js';
import { levelInfo, persist, save, stageBest, stageCleared, stageUnlocked } from '../core/save.js';
import { LEVELS } from '../data/levels.js';
import { hatSvg } from './hats.js';
import { $, fmtTime } from '../core/util.js';
import { ABILITIES, ABILITY_IDS, SLOT2_ACCT } from '../data/abilities.js';
import { STAGES } from '../data/stages.js';
import { TALENTS } from '../data/talents.js';
import { WEAPONS } from '../data/weapons.js';
import { canEquip } from '../game/abilities.js';
import { accountXpNeed } from '../game/balance.js';
import { icon } from '../render/icons.js';

// ---------- Profil (PLAN 9.1): Name, Konto-Level, Statistiken, Bestzeiten, Freischaltungen ----------
const fmtN = n => Math.floor(n).toLocaleString('de-DE');
const fmtDate = d => { const [y, m, t] = d.split('-'); return y && m && t ? `${+t}.${+m}.${y}` : d; };
function fmtPlay(s) {
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
}
// Was das Konto-Level freischaltet, nach Level sortiert
export function acctUnlocks() {
  const out = [{ lv: SLOT2_ACCT, name: 'Zweiter Fähigkeiten-Slot', kind: 'Slot', ico: null }];
  for (const id of ABILITY_IDS) { const u = ABILITIES[id].unlock; if (u && u.acct) out.push({ lv: u.acct, name: ABILITIES[id].name, kind: 'Fähigkeit', ico: id }); }
  for (const t of TALENTS) if (t.acct > 1) out.push({ lv: t.acct, name: t.name, kind: 'Talent', ico: t.icon });
  return out.sort((a, b) => a.lv - b.lv);
}
export function favWeapon() {
  let best = null, n = 0;
  for (const [id, c] of Object.entries(save.stats.weapons)) if (c > n) { best = id; n = c; }
  return best;
}

let editing = false;
// Reiter im Profil: Profil · Garderobe · Erfolge
let psub = 'prof', subRender = {};
export function profileHooks(r) { subRender = r; }
export function showProfileSub(s) { psub = s; renderProfile(); }
$('#profile').addEventListener('click', e => { const b = e.target.closest('[data-psub]'); if (!b || b.dataset.psub === psub) return; psub = b.dataset.psub; sfx.tab(); renderProfile(); });
export function renderProfile() {
  document.querySelectorAll('#profile [data-psub]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.psub === psub)));
  $('#profView').hidden = psub !== 'prof'; $('#wardView').hidden = psub !== 'ward'; $('#achView').hidden = psub !== 'ach';
  if (psub === 'ward') { subRender.ward(); return; }
  if (psub === 'ach') { subRender.ach(); return; }
  renderProfMain();
}
function renderProfMain() {
  const p = save.profile, s = save.stats, need = accountXpNeed(p.level), max = p.level >= 50;
  $('#profName').innerHTML = editing
    ? `<form id="nameForm"><input id="nameIn" maxlength="16" value="" aria-label="Name" autocomplete="off" spellcheck="false"><button class="btn primary small">OK</button></form><small class="nerr" id="nameErr"></small>`
    : `<b>${esc(p.name)}</b><button class="iconbtn" id="nameEdit" aria-label="Name ändern">✎</button>`;
  if (editing) { const i = $('#nameIn'); i.value = p.name; i.focus(); i.select(); }
  $('#profSub').textContent = (p.title ? p.title + ' · ' : '') + 'dabei seit ' + fmtDate(p.created);
  $('#profLv').textContent = 'Konto-Level ' + p.level;
  $('#profXp').style.width = (max ? 100 : Math.min(100, p.xp / need * 100)).toFixed(0) + '%';
  $('#profXpTxt').textContent = max ? 'Maximum' : `${fmtN(p.xp)} / ${fmtN(need)} XP`;

  const fav = favWeapon();
  const tiles = [
    ['Läufe', fmtN(s.runs)], ['Siege', fmtN(s.wins)], ['Siegquote', s.runs ? Math.round(s.wins / s.runs * 100) + ' %' : '–'],
    ['Besiegte Magier', fmtN(s.kills)], ['Spielzeit', fmtPlay(s.playSeconds)],
    ['Meiste Kills', s.bestKills ? fmtN(s.bestKills) : '–', 'in einem Lauf'], ['Höchstes Level', s.bestLevel || '–', 'in einem Lauf'],
    ['Fähigkeiten', `${ABILITY_IDS.filter(canEquip).length} / ${ABILITY_IDS.length}`, 'freigeschaltet'],
  ];
  $('#profStats').innerHTML = tiles.map(([k, v, sub]) => `<div class="pstat"><span>${k}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`).join('') +
    `<div class="pstat fav"><span>Lieblingswaffe</span>${fav ? `<b><img src="${icon(fav)}" alt="">${WEAPONS[fav].name}</b><small>in ${s.weapons[fav]} Läufen dabei</small>` : '<b>–</b>'}</div>`;

  $('#profStages').innerHTML = STAGES.map((st, i) => {
    const ok = stageCleared(i), open = stageUnlocked(i);
    const state = ok ? '<span class="ok">Geschafft</span>' : open ? '<span>Offen</span>' : '<span class="no">Gesperrt</span>';
    if (st.endless) { const best = stageBest(i); return `<div class="pstage${open ? '' : ' locked'}"><span class="n">∞</span><b>${st.name}</b>${state}<span></span><span class="t">${best ? fmtTime(best) : '–'}</span></div>`; }
    const hats = Array.from({ length: LEVELS }, (_, l) => levelInfo(i, l).hats).reduce((a, b) => a + b, 0), fast = levelInfo(i, LEVELS - 1).fast;
    return `<div class="pstage${open ? '' : ' locked'}"><span class="n">${i + 1}</span><b>${st.name}</b>${state}<span class="t"><i class="hat1">${hatSvg}</i>${hats}/${LEVELS * 3}</span><span class="t" title="schnellster Boss-Sieg">${fast ? fmtTime(fast) : '–'}</span></div>`;
  }).join('');

  const list = acctUnlocks(), next = list.find(u => u.lv > p.level);
  $('#profUnlocks').innerHTML = list.map(u => {
    const cls = u.lv <= p.level ? 'got' : u === next ? 'next' : '';
    return `<li class="${cls}"><span class="ulv">Lv ${u.lv}</span>${u.ico ? `<img src="${icon(u.ico)}" alt="">` : '<i class="slotico"></i>'}<b>${u.name}</b><small>${u.kind}</small></li>`;
  }).join('');
}
const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

$('#profName').addEventListener('click', e => { if (e.target.closest('#nameEdit')) { editing = true; renderProfile(); } });
$('#profName').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#nameIn').value.replace(/\s+/g, ' ').trim();
  if (v.length < 3 || v.length > 16) { sfx.buzz(); $('#nameErr').textContent = '3 bis 16 Zeichen'; return; }
  save.profile.name = v; persist(); sfx.buy(); editing = false;
  renderProfile(); $('#topName').textContent = v;
});
$('#profName').addEventListener('keydown', e => { if (e.code === 'Escape') { e.stopPropagation(); editing = false; renderProfile(); } });
