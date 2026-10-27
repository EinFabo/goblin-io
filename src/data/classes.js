// ---------- Goblin-Klassen (Phase 9, entschieden mit Fabi 2026-10-27) ----------
// Jede Klasse hat eine eigene Startwaffe, eine eigene Bewegung auf Leertaste bzw. Shift und leicht andere Werte.
// Freigeschaltet über den Boss einer Welt. Die Bewegungen teilen sich den Fortschritt (Skill Tree) mit Rolle und
// Sprint: Salto und Teleport nutzen den Rollen-Baum, der Sturmangriff den Sprint-Baum – Klassenwechsel kostet nichts.
// hp/speed/cd: Faktoren auf Leben, Lauftempo und Abklingzeit der Waffen.
export const CLASSES = {
  gob: { name: 'Goblin', short: 'Goblin', weapon: 'dagger', dash: 'roll', sprint: 'sprint', hp: 1, speed: 1, cd: 1, unlock: null,
    desc: 'Der Allrounder: wirft Dolche, rollt durch Geschosse.', master: 'Meister-Goblin' },
  bow: { name: 'Bogen-Goblin', short: 'Bogen', weapon: 'bow', dash: 'flip', sprint: 'sprint', hp: .9, speed: 1.05, cd: 1, unlock: { stage: 2 },
    desc: 'Schießt von weit weg. Der Salto springt vom nächsten Gegner weg und lässt Pfeile regnen.', master: 'Meisterschütze' },
  mage: { name: 'Magier-Goblin', short: 'Magier', weapon: 'staff', dash: 'blink', sprint: 'sprint', hp: .9, speed: 1, cd: .92, unlock: { stage: 4 },
    desc: 'Gestohlene Magie: zielsuchende Kugeln, schnellere Zauber. Teleportiert statt zu rollen.', master: 'Erzmagier' },
  war: { name: 'Krieger-Goblin', short: 'Krieger', weapon: 'club', dash: 'roll', sprint: 'charge', hp: 1.05, speed: .95, cd: 1, unlock: { stage: 6 },
    desc: 'Dick und laut: Keule im Nahkampf. Der Sturmangriff walzt kleine Gegner um.', master: 'Kriegsherr' },
};
export const CLASS_IDS = Object.keys(CLASSES);
// Bewegungen der Klassen: Name, Knopf-Bild (render/icons.js) und Kurztext
export const DASH_KIND = {
  roll: { name: 'Rolle', icon: 'dash', desc: 'Kurze Rolle in Laufrichtung, kurz unverwundbar.' },
  flip: { name: 'Salto', icon: 'flip', desc: 'Salto weg vom nächsten Gegner, dabei fliegen fünf Pfeile auf ihn.' },
  blink: { name: 'Teleport', icon: 'blink', desc: 'Springt sofort ein Stück in Laufrichtung, kurz unverwundbar.' },
};
export const SPRINT_KIND = {
  sprint: { name: 'Sprint', icon: 'boots', desc: 'Gedrückt halten: schneller laufen, kostet Ausdauer.' },
  charge: { name: 'Sturmangriff', icon: 'charge', desc: 'Gedrückt halten: losstürmen, kleine Gegner fliegen weg und nehmen Schaden.' },
};
export const isClass = id => typeof id === 'string' && Object.hasOwn(CLASSES, id);
export const classOf = id => (isClass(id) ? CLASSES[id] : CLASSES.gob);
// Freigeschaltet? cleared(i) = Welt i (0-basiert) gewonnen
export const classUnlocked = (id, cleared) => isClass(id) && (!CLASSES[id].unlock || cleared(CLASSES[id].unlock.stage - 1));
export const classUnlockText = id => { const u = CLASSES[id].unlock; return u ? `Boss von Welt ${u.stage} besiegen` : ''; };

// ---------- Klassen-Level ----------
// XP = Konto-XP des Laufs mit dieser Klasse. Stufe 20 nach etwa 60 Läufen.
export const CLASS_MAX_LV = 20;
export const classXpNeed = L => 150 + 50 * L;
// Kleine Boni (Wunsch Fabi: eigenes Klassen-Level mit kleinen Boni)
export const CLASS_PERKS = [
  { lv: 3, k: 'hp', txt: '+5 % Leben' },
  { lv: 5, k: 'start2', txt: 'Startwaffe beginnt auf Stufe 2' },
  { lv: 8, k: 'dmg', txt: '+5 % Schaden' },
  { lv: 12, k: 'charge', txt: '+1 Ladung der Leertasten-Bewegung' },
  { lv: 16, k: 'xp', txt: '+10 % Erfahrung' },
  { lv: 20, k: 'master', txt: 'Titel und goldene Klassenwaffe' },
];
export const hasPerk = (lv, k) => CLASS_PERKS.some(p => p.k === k && lv >= p.lv);
