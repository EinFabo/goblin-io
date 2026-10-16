import { RNG } from '../core/rng.js';
import { emit } from '../core/events.js';
import { sfx } from '../core/audio.js';
import { PASSIVES, WEAPONS } from '../data/weapons.js';
import { addWeapon, recalc } from './run.js';
import { drawOffer, itemKey, replaceCard, settleOffer } from './offer.js';
import { P, run } from './state.js';
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
  else if (i === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * SKIP_HEAL);
  else applyChoice(offer[i]);
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
    else c = { k: 'gold' };
    picks.push({ ...c, name: c.k === 'evo' ? WEAPONS[c.id].evo : c.k === 'upW' ? WEAPONS[c.id].name + ' ' + (run.weapons.find(w => w.id === c.id).lv + 1) : c.k === 'upP' ? PASSIVES[c.id].name + ' ' + (run.passives[c.id] + 1) : '+25 Gold' });
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
  else if (c.k === 'evo') { run.weapons.find(w => w.id === c.id).evo = true; if (!quiet) banner(WEAPONS[c.id].evo + '!', ''); count(run, 'evo'); }
  else if (c.k === 'newP' || c.k === 'upP') run.passives[c.id] = (run.passives[c.id] || 0) + 1;
  else if (c.k === 'swap') swapPassive(c.from, c.id, quiet);
  else if (c.k === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .4);
  else if (c.k === 'gold') run.gold += 25;
  recalc(); refreshSlots();
}
