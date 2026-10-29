// Koop-Raum, Oberfläche (PLAN.md Phase 14d): vom Level-Zettel aus Raum erstellen oder mit Code beitreten,
// Partner mit Klasse und Ping sehen; der Gastgeber startet sein gewähltes Level, dann spielen beide im Gleichschritt.
import { sfx } from '../core/audio.js';
import { on } from '../core/events.js';
import { newSeed } from '../core/rng.js';
import { $ } from '../core/util.js';
import { CLASSES } from '../data/classes.js';
import { profileOf } from '../game/profile.js';
import { cleanProfile } from '../game/profile-clean.js';
import { ERR, createRoom, joinRoom } from '../net/room.js';
import { icon } from '../render/icons.js';
import { startStage } from './menus.js';

// room: offene Verbindung (net/room.js); sel: am Zettel gewähltes Level { si, li, nm, label } – zählt nur beim Gastgeber
let room = null, sel = null, last = null;
export function openCoop(level) {
  sel = level;
  $('#coopLvl').textContent = level ? 'Level ' + level.label : '';
  msg(''); view(); $('#coop').hidden = false;
  if (!room) setTimeout(() => $('#coopCode').focus(), 50);
}
function view() {
  $('#coopJoin').hidden = !!room; $('#coopRoom').hidden = !room;
  if (room) $('#coopShow').textContent = room.code;
  else { $('#coopPlayers').innerHTML = ''; $('#coopGo').hidden = true; }
}
const msg = t => { $('#coopMsg').textContent = t || ''; };
function leave() { if (room) room.close(); room = null; last = null; view(); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function connect(code) {
  msg('Verbinde …');
  const r = room = joinRoom(code, profileOf(), {
    onRoom: info => { if (room === r) { last = info; render(); } },
    onError: t => { if (room === r) { leave(); msg(t); } },
    onClose: () => { if (room === r && !r.started) { leave(); msg(ERR.net); } },
    onStart: s => { if (room === r) begin(s); },
  });
  view();
}
function render() {
  const info = last; if (!info) return;
  const rows = info.players.map(p => {
    const C = CLASSES[p.cls] || CLASSES.gob, me = p.slot === info.you;
    return `<li><img src="${icon(C.weapon)}" alt=""><span>${esc(p.name)}${me ? ' (du)' : ''} · ${C.short} ${p.clsLv}${p.slot === 0 ? ' · Gastgeber' : ''}</span><span class="ping">${p.rtt ? Math.round(p.rtt) + ' ms' : ''}</span></li>`;
  });
  if (info.players.length < 2) rows.push('<li class="wait">Warte auf Partner … Gib ihm den Code.</li>');
  $('#coopPlayers').innerHTML = rows.join('');
  const host = info.you === 0, full = info.players.length === 2;
  $('#coopGo').hidden = !(host && full && sel);
  if (host && full && sel) $('#coopGo').textContent = `Los! (${sel.label})`;
  msg(full && !host ? 'Der Gastgeber wählt das Level und startet.' : '');
}
// Start vom Raum: beide Profile (gleich bereinigt), eigener Platz, Seed und Vorlauf sind auf beiden Rechnern gleich
function begin(s) {
  room.started = true;
  $('#coop').hidden = true;
  startStage(s.si, s.li, s.nm, { coop: { profs: s.profs.map(cleanProfile), me: s.me }, link: room.link, delay: s.delay, seed: s.seed });
}
// Lauf vorbei: Verbindung kurz danach schließen (der Abschied an den Partner geht vorher noch raus)
on('runEnd', () => { if (room && room.started) { const r = room; room = null; last = null; setTimeout(() => r.close(), 400); } });

$('#coopCreate').addEventListener('click', async () => {
  sfx.click(); msg('Raum wird erstellt …');
  try { connect(await createRoom()); } catch (e) { msg(e.message); }
});
const enter = () => {
  const code = $('#coopCode').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { msg('Der Code hat 4 Buchstaben.'); return; }
  sfx.click(); connect(code);
};
$('#coopEnter').addEventListener('click', enter);
$('#coopCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') enter(); });
$('#coopGo').addEventListener('click', () => { if (room && sel) { sfx.pickCard(); room.start({ si: sel.si, li: sel.li, nm: sel.nm, seed: newSeed() }); } });
$('#coopClose').addEventListener('click', () => { sfx.click(); leave(); $('#coop').hidden = true; });
