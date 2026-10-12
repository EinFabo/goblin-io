// ---------- Fähigkeiten (PLAN 8.3) ----------
// charge: 'cd' (Sekunden), 'kills' (besiegte Gegner), 'scrap' (Schrott in %, Zahnräder +7, Kills +0,35)
//         'once' (ein Mal pro Lauf, wirkt von selbst)
// unlock: { acct: Konto-Level } oder { stage: gewonnene Stage, 1-basiert }; ohne unlock = von Anfang an
export const ABILITIES = {
  rage: { name: 'Goblin-Wut', short: 'Wut', charge: 'kills', need: 80, dur: 6,
    desc: 'Schockwelle, die Gegner wegschleudert und Geschosse löscht. Danach 6 s Raserei: +60 % Angriffstempo, schneller laufen.' },
  trap: { name: 'Bärenfalle', short: 'Falle', charge: 'cd', need: 7,
    desc: 'Legt 3 Fallen um dich, jede schnappt bis zu 3-mal zu. Wer hineintritt, hängt 2 s fest, Splitter treffen die Gegner daneben.' },
  mech: { name: 'Goblin-Maschine', short: 'Maschine', charge: 'scrap', need: 100, unlock: { acct: 3 },
    desc: '12 s Dampf-Mech mit MG, Raketen und Stampfer. Du nimmst 70 % weniger Schaden.' },
  smoke: { name: 'Rauchbombe', short: 'Rauch', charge: 'cd', need: 14, dur: 3, unlock: { stage: 1 },
    desc: '3 s unsichtbar. Gegner laufen zu deinem alten Platz, manche schlagen verwirrt aufeinander ein.' },
  catapult: { name: 'Goblin-Katapult', short: 'Katapult', charge: 'scrap', need: 35, unlock: { acct: 5 },
    desc: '5 Felsen schlagen in die dichteste Gegnergruppe ein.' },
  hook: { name: 'Enterhaken', short: 'Haken', charge: 'cd', need: 7, unlock: { stage: 2 },
    desc: 'Zieht dich zum nächsten Gegner (oder ein Stück nach vorn) und landet mit einer Stoßwelle. Kleine Gegner dort werden zu dir gerissen.' },
  shroom: { name: 'Pilzring', short: 'Pilze', charge: 'cd', need: 18, dur: 5, unlock: { acct: 8 },
    desc: '5 s Heilzone: +5 % Leben pro Sekunde, Gegner darin sind verlangsamt.' },
  shield: { name: 'Schrottschild', short: 'Schild', charge: 'cd', need: 16, dur: 6, unlock: { stage: 3 },
    desc: 'Schild schluckt bis zu 40 % deines Lebens, 6 s lang. Geschosse prallen zurück.' },
  rats: { name: 'Rattenflut', short: 'Ratten', charge: 'kills', need: 100, unlock: { stage: 4 },
    desc: '40 Ratten rennen über den Bildschirm und knabbern alles an.' },
  call: { name: 'Goblin-Ruf', short: 'Ruf', charge: 'cd', need: 16, dur: 10, unlock: { acct: 12 },
    desc: '8 Goblin-Krieger kämpfen 10 s an deiner Seite.' },
  totem: { name: 'Totem der Gier', short: 'Totem', charge: 'cd', need: 25, dur: 10, unlock: { stage: 5 },
    desc: 'Saugt alle Kristalle und Münzen an. 10 s doppeltes Gold.' },
  timebomb: { name: 'Zeitbombe', short: 'Zeitbombe', charge: 'cd', need: 14, dur: 3, unlock: { stage: 6 },
    desc: 'Friert Gegner im Umkreis 3 s ein und löscht ihre Geschosse. Danach explodieren sie mit dem Schaden, den sie solange eingesteckt haben.' },
  bigbang: { name: 'Großer Knall', short: 'Knall', charge: 'kills', need: 120, unlock: { stage: 8 },
    desc: 'Alle Gegner auf dem Bildschirm nehmen massiven Schaden.' },
  // Sicherheitsnetz aus 7.5: belegt einen Slot, wirkt von selbst
  charm: { name: 'Goblin-Amulett', short: 'Amulett', charge: 'once', need: 1, unlock: { acct: 6 },
    desc: 'Ein Mal pro Lauf: Statt zu sterben stehst du mit halbem Leben wieder auf und stößt alles weg.' },
};
export const ABILITY_IDS = Object.keys(ABILITIES);
export const SLOT2_ACCT = 3;
export const SLOT_KEYS = ['Q', 'E'];
export const DEFAULT_LOADOUT = ['rage', 'trap'];
export const CHARGE_TXT = { cd: s => `alle ${s} s`, kills: n => `${n} Kills`, scrap: n => `${n} % Schrott`, once: () => '1× pro Lauf' };

// Freigeschaltet? acct = Konto-Level, cleared(i) = Stage i (0-basiert) gewonnen
export function abilityUnlocked(id, acct, cleared) {
  const u = ABILITIES[id].unlock;
  if (!u) return true;
  if (u.acct) return acct >= u.acct;
  return cleared(u.stage - 1);
}
export const unlockText = id => { const u = ABILITIES[id].unlock; return !u ? '' : u.acct ? `Konto-Level ${u.acct}` : `Stage ${u.stage} gewinnen`; };
