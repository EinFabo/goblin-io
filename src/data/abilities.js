// ---------- Fähigkeiten (PLAN 8.3) ----------
// charge: 'cd' (Sekunden), 'kills' (besiegte Gegner), 'scrap' (Schrott in %, Zahnräder +7, Kills +0,35)
//         'once' (ein Mal pro Lauf, wirkt von selbst)
// unlock: { acct: Konto-Level } oder { stage: gewonnene Stage, 1-basiert }; ohne unlock = von Anfang an
export const ABILITIES = {
  rage: { name: 'Goblin-Wut', short: 'Wut', charge: 'kills', need: 80, dur: 6,
    desc: 'Schockwelle, die Gegner wegschleudert und Geschosse löscht. Danach 6 s Raserei: +60 % Angriffstempo, schneller laufen.',
    extras: [{ name: 'Lange Wut', desc: 'Raserei hält 3 s länger.' }, { name: 'Heilende Wut', desc: 'Die Schockwelle heilt dich um 20 % deines Lebens.' }] },
  trap: { name: 'Bärenfalle', short: 'Falle', charge: 'cd', need: 7,
    desc: 'Legt 3 Fallen um dich, jede schnappt bis zu 3-mal zu. Wer hineintritt, hängt 2 s fest, Splitter treffen die Gegner daneben.',
    extras: [{ name: 'Vierte Falle', desc: 'Du legst 4 statt 3 Fallen.' }, { name: 'Sprengfallen', desc: 'Die Splitter fliegen weiter und machen vollen Schaden.' }] },
  mech: { name: 'Goblin-Maschine', short: 'Maschine', charge: 'scrap', need: 100, unlock: { acct: 3 },
    desc: '12 s Dampf-Mech mit MG, Raketen und Stampfer. Du nimmst 70 % weniger Schaden.',
    extras: [{ name: 'Panzerplatten', desc: 'Im Mech nimmst du 85 % statt 70 % weniger Schaden.' }, { name: 'Doppelsalve', desc: 'Raketen kommen doppelt so oft.' }] },
  smoke: { name: 'Rauchbombe', short: 'Rauch', charge: 'cd', need: 14, dur: 3, unlock: { stage: 1 },
    desc: '3 s unsichtbar. Gegner laufen zu deinem alten Platz, manche schlagen verwirrt aufeinander ein.',
    extras: [{ name: 'Dichter Rauch', desc: 'Du bleibst 2 s länger unsichtbar.' }, { name: 'Giftrauch', desc: 'Gegner rund um den Rauch nehmen jede Sekunde Schaden.' }] },
  catapult: { name: 'Goblin-Katapult', short: 'Katapult', charge: 'scrap', need: 35, unlock: { acct: 5 },
    desc: '5 Felsen schlagen in die dichteste Gegnergruppe ein.',
    extras: [{ name: 'Mehr Munition', desc: '8 statt 5 Felsen.' }, { name: 'Brennende Felsen', desc: 'Einschläge hinterlassen brennenden Boden.' }] },
  hook: { name: 'Enterhaken', short: 'Haken', charge: 'cd', need: 7, unlock: { stage: 2 },
    desc: 'Zieht dich zum nächsten Gegner (oder ein Stück nach vorn) und landet mit einer Stoßwelle. Kleine Gegner dort werden zu dir gerissen.',
    extras: [{ name: 'Langes Seil', desc: 'Der Haken fliegt viel weiter.' }, { name: 'Betäubender Aufprall', desc: 'Die Landung friert Gegner um dich 1 s ein.' }] },
  shroom: { name: 'Pilzring', short: 'Pilze', charge: 'cd', need: 18, dur: 5, unlock: { acct: 8 },
    desc: '5 s Heilzone: +5 % Leben pro Sekunde, Gegner darin sind verlangsamt.',
    extras: [{ name: 'Großer Ring', desc: 'Der Pilzring wird 40 % größer.' }, { name: 'Giftsporen', desc: 'Gegner im Ring nehmen jede Sekunde Schaden.' }] },
  shield: { name: 'Schrottschild', short: 'Schild', charge: 'cd', need: 16, dur: 6, unlock: { stage: 3 },
    desc: 'Schild schluckt bis zu 40 % deines Lebens, 6 s lang. Geschosse prallen zurück.',
    extras: [{ name: 'Dicker Schild', desc: 'Schluckt 60 % statt 40 % deines Lebens.' }, { name: 'Splitterschild', desc: 'Wenn der Schild bricht oder endet, schleudert er Splitter um dich.' }] },
  rats: { name: 'Rattenflut', short: 'Ratten', charge: 'kills', need: 100, unlock: { stage: 4 },
    desc: '40 Ratten rennen über den Bildschirm und knabbern alles an.',
    extras: [{ name: 'Rattenkönig', desc: '20 Ratten mehr.' }, { name: 'Pestratten', desc: 'Gebissene Gegner sind 3 s verlangsamt.' }] },
  call: { name: 'Goblin-Ruf', short: 'Ruf', charge: 'cd', need: 16, dur: 10, unlock: { acct: 12 },
    desc: '8 Goblin-Krieger kämpfen 10 s an deiner Seite.',
    extras: [{ name: 'Mehr Krieger', desc: '4 Krieger mehr.' }, { name: 'Kriegsschrei', desc: 'Beim Rufen bekommst du 4 s Raserei wie bei der Goblin-Wut.' }] },
  totem: { name: 'Totem der Gier', short: 'Totem', charge: 'cd', need: 25, dur: 10, unlock: { stage: 5 },
    desc: 'Saugt alle Kristalle und Münzen an. 10 s doppeltes Gold.',
    extras: [{ name: 'Goldregen', desc: 'Doppeltes Gold hält 5 s länger.' }, { name: 'Heiltotem', desc: 'Das Totem heilt dich um 25 %.' }] },
  timebomb: { name: 'Zeitbombe', short: 'Zeitbombe', charge: 'cd', need: 14, dur: 3, unlock: { stage: 6 },
    desc: 'Friert Gegner im Umkreis 3 s ein und löscht ihre Geschosse. Danach explodieren sie mit dem Schaden, den sie solange eingesteckt haben.',
    extras: [{ name: 'Großer Zünder', desc: '30 % mehr Umkreis.' }, { name: 'Kälteschock', desc: 'Eingefrorene Gegner nehmen 50 % mehr Schaden.' }] },
  bigbang: { name: 'Großer Knall', short: 'Knall', charge: 'kills', need: 120, unlock: { stage: 8 },
    desc: 'Alle Gegner auf dem Bildschirm nehmen massiven Schaden.',
    extras: [{ name: 'Nachbeben', desc: '1 s später ein zweiter Knall mit halber Kraft.' }, { name: 'Erschütterung', desc: 'Überlebende sind 1,5 s eingefroren.' }] },
  // Sicherheitsnetz aus 7.5: belegt einen Slot, wirkt von selbst
  charm: { name: 'Goblin-Amulett', short: 'Amulett', charge: 'once', need: 1, unlock: { acct: 6 },
    desc: 'Ein Mal pro Lauf: Statt zu sterben stehst du mit halbem Leben wieder auf und stößt alles weg.',
    extras: [{ name: 'Zweite Chance', desc: 'Rettet dich zwei Mal pro Lauf.' }, { name: 'Phönix', desc: 'Du stehst mit vollem Leben wieder auf.' }] },
};
export const ABILITY_IDS = Object.keys(ABILITIES);

// ---------- Level und Skill Tree (PLAN 8.4) ----------
export const ABIL_MAX_LV = 18;
export const abilXpNeed = L => 60 + 40 * L;
// XP pro Einsatz: ein voller Lauf bringt jeder Fähigkeit ~100 XP, egal wie oft sie lädt
export function xpPerUse(id) {
  const A = ABILITIES[id];
  return Math.max(2, Math.round(A.charge === 'cd' ? A.need * .42 : A.charge === 'kills' ? A.need * .25 : A.charge === 'scrap' ? A.need * .3 : 50));
}
// Knoten: unten pow/cd/area, Extras a (ab 3 Punkten unten) und b (ab 6)
export const TREE = {
  pow: { name: 'Kraft', max: 5, cost: 1, desc: '+8 % Schaden, Heilung und Schild' },
  cd: { name: 'Tempo', max: 5, cost: 1, desc: '−5 % Abklingzeit bzw. Kill- oder Schrott-Bedarf' },
  area: { name: 'Reichweite', max: 3, cost: 1, desc: '+8 % Fläche und Dauer' },
  a: { max: 1, cost: 2, req: 3 },
  b: { max: 1, cost: 2, req: 6 },
};
export const basePoints = pts => (pts.pow || 0) + (pts.cd || 0) + (pts.area || 0);
export const spentPoints = pts => basePoints(pts) + 2 * ((pts.a || 0) + (pts.b || 0));
// Darf ein Rang in Knoten k gekauft werden? (Level-Punkte frei, Maximum, Voraussetzung)
export function canLearn(st, k) {
  const N = TREE[k], have = st.pts[k] || 0;
  return have < N.max && st.lv - 1 - spentPoints(st.pts) >= N.cost && basePoints(st.pts) >= (N.req || 0);
}
// Wirkung des Baums für einen Lauf
export function abilMods(st) {
  const p = (st && st.pts) || {};
  return { pow: 1 + .08 * (p.pow || 0), spd: 1 - .05 * (p.cd || 0), area: 1 + .08 * (p.area || 0), a: !!p.a, b: !!p.b };
}
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
