import { activeCls, clsState, save } from '../core/save.js';
import { CARD_IDS } from '../data/cards.js';
import { canEquip, slotOpen } from './abilities.js';
import { cardLv } from './chests.js';

// Profil eines Goblins für den Lauf (Phase 14b): alles aus dem Spielstand, was die Sim liest, als JSON-Kopie.
// Gleiche Form wie der Spielstand, damit soulRank, runeMods und abilMods es statt save nehmen.
// Allein ist es das eigene; im Koop kommt das des Partners übers Netz. Belohnungen gehen weiter in den echten Spielstand.
export function profileOf() {
  const s = save, cls = activeCls();
  return JSON.parse(JSON.stringify({
    name: s.profile.name, cls, clsLv: clsState(cls).lv,
    talents: s.talents, rebirth: s.rebirth, abilities: s.abilities, runes: s.runes, look: s.look,
    // equip: Slot frei und Fähigkeit erlaubt (Herausforderungen setzen run.forceAbil und brauchen das nicht)
    loadout: s.loadout, equip: s.loadout.map((id, i) => !!id && slotOpen(i) && canEquip(id)),
    cards: Object.fromEntries(CARD_IDS.map(id => [id, cardLv(s, id)])), owned: Object.keys(s.cards).filter(id => s.cards[id]),
  }));
}
