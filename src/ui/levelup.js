import { sfx } from '../core/audio.js';
import { localCoop, pickInput, setSprintHeld } from '../core/input.js';
import { on } from '../core/events.js';
import { Music } from '../core/music.js';
import { $ } from '../core/util.js';
import { BOONS, MEGAS, PASSIVES, WEAPONS, megaOf, weaponOf } from '../data/weapons.js';
import { PICK, SKIP_GOLD, SKIP_HEAL, ban, choose, genChoices, reroll } from '../game/levelup.js';
import { MAX_P, MAX_W, canBan } from '../game/offer.js';
import { P, activate, ownIds, run } from '../game/state.js';
import { icon } from '../render/icons.js';
import { chestSvg } from './cardart.js';
import { openTree } from './evotree.js';

// mode: null | 'ban' | 'lock' – Bannen und Sperren wählen zuerst den Modus, dann die Karte
let curChoices = [], mode = null, lockIdx = -1;
const WHY = { evo: '', swap: '', lock: 'Gesperrt', pity: 'Passt zu deiner Waffe' };
const EYE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
const passFull = () => Object.keys(run.passives).length >= MAX_P;
// Kann eine Tauschkarte für dieses Passiv noch kommen? (gebannt: nein)
const canSwap = p => !run.offer.banned.has('s:' + p) && !run.offer.banned.has('p:' + p);
export function pipHtml(cur, next) { let s = '<div class="lvpips">'; for (let i = 1; i <= 5; i++) s += `<i class="${i <= cur ? 'on' : i === next ? 'nx' : ''}"></i>`; return s + '</div>'; }
export function cardHtml(c, i) {
  let ic, t, d, tag = '', hint = '', hintCls = '', pips = '', cls = 'card', from = '';
  if (c.k === 'newW' || c.k === 'upW') {
    const D = WEAPONS[c.id], w = run.weapons.find(x => x.id === c.id), lv = w ? w.lv : 0;
    ic = icon(c.id); t = D.name; d = D.info[lv]; pips = pipHtml(lv, lv + 1);
    tag = lv ? '' : '<span class="tagx new">Neue Waffe</span>';
    // Hat man das Passiv schon? Sind die Plätze voll, hilft nur noch Umschmieden
    hint = 'Entwicklung mit ' + PASSIVES[D.with].name;
    if (run.passives[D.with]) { hint += ' ✓'; hintCls = 'good'; }
    else if (passFull()) { hint += canSwap(D.with) ? ' (umschmieden)' : ' (Plätze voll)'; hintCls = 'warn'; }
  } else if (c.k === 'evo') {
    const D = WEAPONS[c.id]; ic = icon(c.id + '_evo'); t = D.evo; d = D.evoInfo; cls += ' evo'; tag = '<span class="tagx">Entwicklung</span>';
    const m = megaOf(c.id), other = m && MEGAS[m].of.find(k => k !== c.id); if (other) hint = `Mit ${WEAPONS[other].evo}: Mega ${MEGAS[m].name}`;
  } else if (c.k === 'newP' || c.k === 'upP') {
    const D = PASSIVES[c.id], lv = run.passives[c.id] || 0;
    ic = icon(c.id); t = D.name; d = D.info; pips = pipHtml(lv, lv + 1);
    tag = lv ? '' : '<span class="tagx new">Neu</span>';
    // Passt das Passiv zu einer eigenen Waffe? Nicht passende Passive verbauen Plätze
    const wid = weaponOf(c.id, ownIds()), own = run.weapons.find(w => w.id === wid);
    if (own && own.evo) hint = WEAPONS[wid].evo + ' schon entwickelt';
    else if (own) { hint = 'Entwickelt ' + WEAPONS[wid].name + ' ✓'; hintCls = 'good'; }
    else if (run.weapons.length >= MAX_W) { hint = 'Passt zu keiner deiner Waffen'; if (!lv) hintCls = 'warn'; }
    else if (wid) hint = 'Entwickelt ' + WEAPONS[wid].name + ' (fehlt dir noch)';
  } else if (c.k === 'swap') {
    // Umschmieden: from wird zu id, Stufe bleibt
    const D = PASSIVES[c.id], lv = run.passives[c.from] || 1, wid = weaponOf(c.id, ownIds());
    ic = icon(c.id); t = D.name; d = `Statt ${PASSIVES[c.from].name}, Stufe ${lv} bleibt. ${D.info}`; pips = pipHtml(lv, 0); cls += ' swap';
    tag = '<span class="tagx">Umschmieden</span>'; from = `<img class="from" src="${icon(c.from)}" alt="">`;
    if (wid) { hint = 'Macht ' + WEAPONS[wid].evo + ' möglich'; hintCls = 'good'; }
  } else if (c.k === 'boon') {
    // Dauerbonus: alles ausgebaut, stapelt ohne Grenze
    const D = BOONS[c.id], n = run.boons[c.id] || 0;
    ic = icon(D.icon); t = D.name; d = D.info; cls += ' boon'; tag = '<span class="tagx">Dauerbonus</span>';
    hint = n ? `Bisher +${Math.round(((1 + D.v) ** n - 1) * 100)} %` : 'Stapelt ohne Grenze';
  } else if (c.k === 'heal') { ic = icon('heal'); t = 'Goblin-Eintopf'; d = 'Heilt 40 % deines Lebens.'; }
  else { ic = icon('gold'); t = 'Goldbeutel'; d = '+25 Gold'; }
  if (WHY[c.why]) tag += `<span class="tagx why">${WHY[c.why]}</span>`;
  // Auge: Vorschau im Entwicklungs-Baum (was die Waffe bzw. das Passiv einmal wird)
  const peekKey = c.k === 'newW' || c.k === 'upW' || c.k === 'evo' ? 'e:' + c.id : (c.k === 'newP' || c.k === 'upP' || c.k === 'swap') && weaponOf(c.id) ? 'p:' + c.id : '';
  const peek = peekKey ? `<span class="peek" data-peek="${peekKey}" aria-hidden="true" title="Vorschau">${EYE}</span>` : '';
  if (i === lockIdx) cls += ' locked';
  if (mode === 'ban' && !canBan(c)) cls += ' off';
  return `<button class="${cls}" data-i="${i}"><span class="k">${i + 1}</span>${peek}<span class="ic"><img src="${ic}" alt="">${from}</span><span class="body"><span class="t">${t}</span>${tag}${pips}<span class="d">${d}</span>${hint ? `<span class="hint ${hintCls}">${hint}</span>` : ''}</span></button>`;
}
export function openLevelUp(chest) {
  run.paused = true; Music.stop(); setSprintHeld(false);
  curChoices = genChoices(); mode = null; lockIdx = -1;
  // Truhe vom Mini-Boss: offene Truhe mit Glow dahinter über dem Titel
  $('#lvTitle').innerHTML = chest ? chestSvg('iron', 'lvchest') + 'Schatztruhe!' : 'Level ' + P.lv + '!';
  if (chest) sfx.lidOpen(1);
  renderCards(); $('#levelup').hidden = false; sfx.cards();
}
export function renderCards() {
  const cards = $('#cards');
  cards.innerHTML = curChoices.map(cardHtml).join('');
  cards.className = 'cards n' + curChoices.length + (mode ? ' mode-' + mode : '');
  const set = (id, txt, dis, on = false) => { const b = $(id); b.textContent = txt; b.disabled = dis; b.classList.toggle('on', on); };
  // nur Füllkarten (alles ausgebaut): Würfeln brächte nichts Neues
  set('#rerollBtn', `Neu würfeln (${run.rerolls})`, run.rerolls <= 0 || !!mode || curChoices.every(c => c.why === 'fill'));
  set('#banBtn', mode === 'ban' ? 'Welche bannen?' : `Bannen (${run.bans})`, run.bans <= 0 || mode === 'lock', mode === 'ban');
  set('#lockBtn', mode === 'lock' ? 'Welche sperren?' : lockIdx >= 0 ? 'Gesperrt ✓' : `Sperren (${run.locks})`, run.locks <= 0 || mode === 'ban', mode === 'lock' || lockIdx >= 0);
  $('#skipGold').textContent = `+${SKIP_GOLD} Gold`;
  $('#skipHeal').textContent = `+${Math.round(SKIP_HEAL * 100)} % Leben`;
  $('#lvCardNote').textContent = mode === 'ban' ? 'Gebannte Karten kommen in diesem Lauf nie wieder.' : mode === 'lock' ? 'Die gesperrte Karte bleibt fürs nächste Level-Up liegen.' : '';
}
function close(i) {
  choose(curChoices, i, lockIdx);
  $('#levelup').hidden = true; run.paused = false; Music.start();
  sfx.pickCard();
}
$('#cards').addEventListener('click', e => {
  const pk = e.target.closest('[data-peek]');
  if (pk && !mode) { openTree(pk.dataset.peek, true); return; }   // beim Bannen/Sperren zählt der Klick für die Karte
  const b = e.target.closest('.card'); if (!b) return;
  const i = +b.dataset.i, c = curChoices[i];
  if (run.lvl) {   // Koop: Bannen/Sperren/Wählen als Eingabe (game/levelup.js PICK)
    if (mode === 'ban') { if (canBan(c)) coopAct(PICK.BAN + i); mode = null; renderCoop(); return; }
    if (mode === 'lock') { coopAct(PICK.LOCK + i); mode = null; renderCoop(); return; }
    coopPick(i, 0); return;
  }
  if (mode === 'ban') {
    if (!canBan(c)) return;
    curChoices = ban(curChoices, i); mode = null; if (lockIdx === i) lockIdx = -1;
    renderCards(); sfx.cards(); return;
  }
  if (mode === 'lock') { lockIdx = lockIdx === i ? -1 : i; mode = null; renderCards(); return; }
  close(i);
});
$('#rerollBtn').addEventListener('click', () => { if (run.lvl) { if (!mode) coopAct(PICK.REROLL); return; } if (run.rerolls <= 0 || mode) return; curChoices = reroll(curChoices); lockIdx = -1; renderCards(); sfx.cards(); });
$('#banBtn').addEventListener('click', () => { if (run.bans <= 0 || coopBusy()) return; mode = mode === 'ban' ? null : 'ban'; if (run.lvl) renderCoop(); else renderCards(); });
$('#lockBtn').addEventListener('click', () => {
  if (run.locks <= 0 || coopBusy()) return;
  if (lockIdx >= 0 && !mode) { if (run.lvl) { coopAct(PICK.LOCK + lockIdx); return; } lockIdx = -1; } else mode = mode === 'lock' ? null : 'lock';
  if (run.lvl) renderCoop(); else renderCards();
});
$('#lvEvoBtn').addEventListener('click', () => openTree(null, true));
$('#skipGold').addEventListener('click', () => { if (run.lvl) coopPick('gold', 0); else close('gold'); });
$('#skipHeal').addEventListener('click', () => { if (run.lvl) coopPick('heal', 0); else close('heal'); });

// ---------- Koop (Phase 14b): gemeinsames Level-Up ----------
// Angebote kommen aus der Sim (run.lvl, game/levelup.js startCoopLevel); die Wahl geht als Eingabe pick hinein,
// angewandt wird sie erst, wenn beide gewählt haben. Würfeln, Bannen, Sperren und Überspringen gehen ebenfalls als Eingabe
// (Phase 16); die Sim meldet das neue Angebot mit coopLevelUpdate zurück.
// who: 0 = eigener Goblin, 1 = Spieler 2 im Testmodus ?coop=local (zweite Kartenreihe, Tasten 7–0)
const picked = [-1, -1];
function coopPick(i, who) {
  const L = run.lvl, gi = who ? 1 - run.me : run.me;
  if (!L || !L.offers[gi] || picked[who] !== -1 || (!who && waitOffer > performance.now())) return;
  picked[who] = i; pickInput(i === 'gold' ? PICK.GOLD : i === 'heal' ? PICK.HEAL : i, who); sfx.pickCard();
  const box = who ? $('#cards2') : $('#cards');
  box.querySelectorAll('.card').forEach((b, j) => b.classList.toggle(j === i ? 'picked' : 'off', true));
  if (!who) $('#levelup').classList.add('chosen');   // Werkzeuge aus, sobald gewählt
  coopLvTick();
}
// Werkzeug (neu würfeln, bannen, sperren) als Eingabe; solange noch nicht gewählt. Nach Würfeln/Bannen bis zum neuen
// Angebot (coopLevelUpdate) keine Wahl: sonst gälte ein Klick schon für Karten, die man noch nicht gesehen hat
let waitOffer = 0;
function coopAct(code) {
  if (!run.lvl || picked[0] !== -1 || waitOffer > performance.now()) return;
  pickInput(code, 0);
  if (code === PICK.REROLL || (code >= PICK.BAN && code < PICK.LOCK)) waitOffer = performance.now() + 1500;
}
const coopBusy = () => !!run.lvl && (picked[0] !== -1 || waitOffer > performance.now());
// eigene Karten und Werkzeuge mit der eigenen Ausrüstung zeichnen (Restwürfe, Banns, Sperre)
function renderCoop() {
  const L = run.lvl; if (!L) return;
  const pi = run.pi; activate(run.me);
  try { curChoices = L.offers[run.me] || []; lockIdx = L.locks ? L.locks[run.me] : -1; renderCards(); } finally { activate(pi); }
}
on('coopLevelUpdate', i => { if (i === run.me) { waitOffer = 0; if (picked[0] === -1) renderCoop(); sfx.cards(); } });
// Karten eines Goblins (seine Ausrüstung muss für die Hinweise aktiv sein)
function cardsOf(gi, offer) {
  const pi = run.pi; activate(gi);
  try { return offer.map(cardHtml).join(''); } finally { activate(pi); }
}
on('coopLevel', L => {
  picked[0] = picked[1] = -1; mode = null; lockIdx = -1; waitOffer = 0;
  const mine = L.offers[run.me];
  $('#levelup').classList.add('coop');
  $('#lvTitle').innerHTML = L.kind === 'chest' ? chestSvg('iron', 'lvchest') + 'Schatztruhe!' : 'Level ' + P.lv + '!';
  $('#levelup').classList.remove('chosen'); $('#levelup').classList.toggle('mine', !!mine);
  if (mine) renderCoop(); else { curChoices = []; $('#cards').innerHTML = ''; $('#cards').className = 'cards n0'; }
  let c2 = $('#cards2');
  const other = 1 - run.me, theirs = localCoop ? L.offers[other] : null;
  if (theirs) {
    if (!c2) { c2 = document.createElement('div'); c2.id = 'cards2'; $('#cards').after(c2); c2.addEventListener('click', e => { const b = e.target.closest('.card'); if (b) coopPick(+b.dataset.i, 1); }); }
    // Tasten 7–0 statt 1–4
    c2.innerHTML = cardsOf(other, theirs).replace(/<span class="k">(\d)<\/span>/g, (m, d) => `<span class="k">${(+d + 6) % 10}</span>`);
    c2.className = 'cards n' + theirs.length; c2.hidden = false;
  } else if (c2) c2.hidden = true;
  coopLvTick();
  $('#levelup').hidden = false; sfx.cards();
});
function coopClose() { $('#levelup').classList.remove('coop', 'mine', 'chosen'); const c2 = $('#cards2'); if (c2) c2.hidden = true; }
on('coopLevelDone', () => { $('#levelup').hidden = true; coopClose(); });
on('runStart', coopClose);   // Lauf mitten im Koop-Level-Up verlassen: nichts davon in den nächsten Lauf mitnehmen
// Restzeit und Partner-Status (jedes Bild, scenes/run.js)
export function coopLvTick() {
  const L = run && run.lvl; if (!L) return;
  const other = 1 - run.me, waitMe = L.picks[run.me] === -1 && picked[0] < 0, waitThem = L.picks[other] === -1;
  const name = run.players[other].prof.name || 'Partner';
  // Bannen/Sperren gewählt: deren Hinweis zeigen (renderCards), nur die Zeit davor
  if (mode) { $('#lvCardNote').textContent = `Noch ${Math.max(0, Math.ceil(L.t))} s · ` + (mode === 'ban' ? 'Welche Karte bannen? Sie kommt in diesem Lauf nie wieder.' : 'Welche Karte sperren? Sie bleibt fürs nächste Level-Up liegen.'); return; }
  $('#lvCardNote').textContent = `Noch ${Math.max(0, Math.ceil(L.t))} s · ` + (waitMe ? 'Wähl deine Karte' : waitThem ? `Warte auf ${name} …` : 'Gleich geht es weiter');
}
