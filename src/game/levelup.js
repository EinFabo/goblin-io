import { RNG } from '../core/rng.js';
import { emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { BOONS, PASSIVES, WEAPONS } from '../data/weapons.js';
import { addWeapon, recalc } from './run.js';
import { canBan, drawOffer, itemKey, replaceCard, settleOffer } from './offer.js';
import { P, eachPlayer, heal, run } from './state.js';
import { part, ring } from './fx.js';
import { TAU } from '../core/util.js';
import { count } from './progress.js';
import { banner, refreshSlots } from '../ui/hud.js';

// ---------- Level-Up ----------
// Regeln stehen in offer.js; hier nur der Lauf drumherum (Würfeln, Bannen, Sperren, Überspringen)
const rnd = () => RNG.lvl.next();
export const SKIP_GOLD = 15, SKIP_HEAL = .2;

export function genChoices(avoid) { return drawOffer(run.offer, rnd, { n: run.cardN, avoid }); }
export function reroll(offer) {
  if (run.rerolls <= 0) return offer;
  run.rerolls--;
  return genChoices(offer.filter(c => c.why === 'rest').map(itemKey));
}
export function ban(offer, i) {
  if (run.bans <= 0) return offer;
  run.bans--; run.offer.banned.add(itemKey(offer[i]));
  return replaceCard(run.offer, offer.slice(), i, rnd);
}

// Wahl abschließen. i = Index der Karte, oder 'gold'/'heal' zum Überspringen. lockIdx = gesperrte Karte (oder -1)
export function choose(offer, i, lockIdx = -1) {
  run.lvOpen = false;   // Bot wählt ohne Kartenfenster
  const skip = typeof i !== 'number';
  if (lockIdx >= 0 && lockIdx !== i) run.locks--;
  settleOffer(run.offer, offer, skip ? -1 : i, lockIdx);
  if (i === 'gold') run.gold += SKIP_GOLD;
  else if (i === 'heal') heal(P.maxHp * SKIP_HEAL);
  else applyChoice(offer[i]);
}

// Koop (Phase 14b): Level-Up gemeinsam. Die Welt steht, jeder wählt seine eigene Karte (Eingabe pick, core/input.js),
// nach COOP_LV_T s gilt die erste. Truhe mit Auswahl (Mini-Boss): nur wer sie aufgehoben hat (run.chestBy).
// Angebote der Reihe nach aus RNG.lvl (Goblin 0, dann 1), damit beide Rechner dasselbe würfeln.
// Eingabe pick (Phase 16: wie allein): 0–3 Karte · 10 Gold / 11 Heilen statt Karte · 20 neu würfeln · 30+i bannen · 40+i sperren
export const COOP_LV_T = 20, PICK = { GOLD: 10, HEAL: 11, REROLL: 20, BAN: 30, LOCK: 40 };
export function startCoopLevel(kind) {
  const who = kind === 'chest' ? [(run.chestBy && run.chestBy.shift()) ?? 0] : run.players.map((p, i) => i);
  const offers = [];
  eachPlayer((p, i) => { offers[i] = who.includes(i) ? genChoices() : null; });
  run.lvl = { kind, offers, picks: offers.map(o => (o ? -1 : null)), locks: offers.map(() => -1), t: COOP_LV_T }; run.lvOpen = false;
  emit('coopLevel', run.lvl);
}
export function coopLevelTick(dt, inps) {
  const L = run.lvl;
  L.t -= dt;
  eachPlayer((p, i) => {
    const o = L.offers[i];
    if (!o || L.picks[i] !== -1) return;
    if (p.gone) { L.picks[i] = 0; return; }   // Partner weg: seine Karte gilt sofort
    const k = inps[i] ? inps[i].pick : -1;
    // Werkzeuge: neu würfeln, bannen, sperren (aus der eigenen Ausrüstung; RNG.lvl wie allein, beide Rechner gleich)
    if (k === PICK.REROLL && run.rerolls > 0) { L.offers[i] = reroll(o); L.locks[i] = -1; emit('coopLevelUpdate', i); return; }
    if (k >= PICK.BAN && k < PICK.BAN + o.length && run.bans > 0 && canBan(o[k - PICK.BAN])) { L.offers[i] = ban(o, k - PICK.BAN); if (L.locks[i] === k - PICK.BAN) L.locks[i] = -1; emit('coopLevelUpdate', i); return; }
    if (k >= PICK.LOCK && k < PICK.LOCK + o.length && run.locks > 0) { L.locks[i] = L.locks[i] === k - PICK.LOCK ? -1 : k - PICK.LOCK; emit('coopLevelUpdate', i); return; }
    if (k >= 0 && k < o.length) L.picks[i] = k;
    else if (k === PICK.GOLD) L.picks[i] = 'gold';
    else if (k === PICK.HEAL) L.picks[i] = 'heal';
    else if (L.t <= 0) L.picks[i] = 0;
  });
  if (L.picks.includes(-1)) return;
  run.lvl = null;
  eachPlayer((p, i) => { if (L.offers[i]) choose(L.offers[i], L.picks[i], L.locks[i]); });
  emit('coopLevelDone', L);
}

// Truhe ohne Auswahl: n Aufwertungen eigener Waffen (Entwicklung zuerst), sonst Passiv, sonst Gold.
// Die Öffnung zeigt die UI (ui/run-chest.js hängt sich an das Ereignis autoChest); src (elite/boss) bestimmt nur ihr Aussehen
export function autoChest(n, src = 'elite') {
  const picks = [];
  for (let i = 0; i < n; i++) {
    const evo = run.weapons.find(w => !w.evo && w.lv >= 5 && run.passives[WEAPONS[w.id].with]);
    const ups = run.weapons.filter(w => w.lv < 5 && !WEAPONS[w.id].auto), ps = Object.keys(run.passives).filter(id => run.passives[id] < 5);
    let c;
    if (evo) c = { k: 'evo', id: evo.id };
    else if (ups.length) c = { k: 'upW', id: ups[(rnd() * ups.length) | 0].id };
    else if (ps.length) c = { k: 'upP', id: ps[(rnd() * ps.length) | 0] };
    else { const b = Object.keys(BOONS); c = { k: 'boon', id: b[(rnd() * b.length) | 0] }; }   // alles ausgebaut: Dauerbonus
    picks.push({ ...c, name: c.k === 'evo' ? WEAPONS[c.id].evo : c.k === 'upW' ? WEAPONS[c.id].name + ' ' + (run.weapons.find(w => w.id === c.id).lv + 1) : c.k === 'upP' ? PASSIVES[c.id].name + ' ' + (run.passives[c.id] + 1) : BOONS[c.id].name });
    applyChoice(c, true);
  }
  sfx.chest();
  emit('autoChest', { picks, src });
}

// Waffen mit auto (Wurfdolch): bei jedem n-ten Spieler-Level eine Stufe höher, bis Stufe 5
export function autoUp() {
  for (const w of run.weapons) {
    const n = WEAPONS[w.id].auto;
    if (!n || w.evo || w.lv >= 5 || P.lv % n) continue;
    w.lv++;
    if (run.pi !== run.me) continue;   // Koop: Anzeige nur für die eigenen Waffen
    banner(`${WEAPONS[w.id].name} Stufe ${w.lv}!`, 'auto');
    sfx.bladeUp();
    ring(P.x, P.y - 8, 8, 120, .4, 'rgba(220,235,255,.95)', 6);
    for (let i = 0; i < 14; i++) { const a = i * TAU / 14; part(P.x, P.y - 10, Math.cos(a) * 180, Math.sin(a) * 180, .4, i % 2 ? '#ffffff' : '#bfe3ff', 3); }
    refreshSlots();
  }
}

// Umschmieden: from wird an seinem Platz zu to, die Stufe bleibt. run.passives in place ändern
// (das Angebot hält dasselbe Objekt), Reihenfolge der Plätze bleibt
function swapPassive(from, to, quiet) {
  const ent = Object.entries(run.passives);
  for (const [k] of ent) delete run.passives[k];
  for (const [k, lv] of ent) run.passives[k === from ? to : k] = lv;
  if (!quiet) banner(`${PASSIVES[from].name} → ${PASSIVES[to].name}`, '');
  count(run, 'swap');
}

// quiet: kein Entwicklungs-Banner (die Truhen-Öffnung zeigt die Entwicklung schon)
export function applyChoice(c, quiet = false) {
  if (c.k === 'newW') addWeapon(c.id);
  else if (c.k === 'upW') run.weapons.find(w => w.id === c.id).lv++;
  else if (c.k === 'evo') { run.weapons.find(w => w.id === c.id).evo = true; if (!quiet && run.pi === run.me) banner(WEAPONS[c.id].evo + '!', ''); count(run, 'evo'); }
  else if (c.k === 'newP' || c.k === 'upP') run.passives[c.id] = (run.passives[c.id] || 0) + 1;
  else if (c.k === 'swap') swapPassive(c.from, c.id, quiet || run.pi !== run.me);
  else if (c.k === 'boon') { run.boons[c.id] = (run.boons[c.id] || 0) + 1; count(run, 'boon'); }
  else if (c.k === 'heal') heal(P.maxHp * .4);
  else if (c.k === 'gold') run.gold += 25;
  recalc(); if (run.pi === run.me) refreshSlots();   // HUD zeigt die eigene Ausrüstung
}
