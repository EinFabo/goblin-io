import { RNG } from '../core/rng.js';
import { WEAPONS } from '../data/weapons.js';
import { addWeapon, recalc } from './run.js';
import { drawOffer, itemKey, replaceCard, settleOffer } from './offer.js';
import { P, run } from './state.js';
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
  const skip = typeof i !== 'number';
  if (lockIdx >= 0 && lockIdx !== i) run.locks--;
  settleOffer(run.offer, offer, skip ? -1 : i, lockIdx);
  if (i === 'gold') run.gold += SKIP_GOLD;
  else if (i === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * SKIP_HEAL);
  else applyChoice(offer[i]);
}

export function applyChoice(c) {
  if (c.k === 'newW') addWeapon(c.id);
  else if (c.k === 'upW') run.weapons.find(w => w.id === c.id).lv++;
  else if (c.k === 'evo') { run.weapons.find(w => w.id === c.id).evo = true; banner(WEAPONS[c.id].evo + '!', ''); }
  else if (c.k === 'newP' || c.k === 'upP') run.passives[c.id] = (run.passives[c.id] || 0) + 1;
  else if (c.k === 'heal') P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .4);
  else if (c.k === 'gold') run.gold += 25;
  recalc(); refreshSlots();
}
