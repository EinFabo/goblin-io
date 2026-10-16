// ---------- Fähigkeiten (PLAN 8.3) ----------
// charge: 'cd' (Sekunden), 'kills' (besiegte Gegner), 'scrap' (Schrott in %, Zahnräder +7, Kills +0,35),
//         'hurt' (eingesteckter Schaden in % des max. Lebens, Goblin-Groll)
//         'once' (ein Mal pro Lauf, wirkt von selbst)
// unlock: { acct: Konto-Level } oder { stage: gewonnene Stage, 1-basiert }; ohne unlock = von Anfang an
export const ABILITIES = {
  rage: { name: 'Goblin-Wut', short: 'Wut', charge: 'kills', need: 80, dur: 6,
    desc: 'Schockwelle, die Gegner wegschleudert und Geschosse löscht. Danach 6 s Raserei: +60 % Angriffstempo, schneller laufen.',
    extras: [{ name: 'Lange Wut', desc: 'Raserei hält 3 s länger.' }, { name: 'Heilende Wut', desc: 'Die Schockwelle heilt dich um 20 % deines Lebens.' }],
    skills: [{ name: 'Blutdurst', desc: 'Kills in der Raserei heilen dich um 1 Leben pro Rang.' }, { name: 'Weite Welle', desc: 'Schockwelle +12 % Umkreis und Wucht pro Rang.' }, { name: 'Kettenwut', desc: 'Jeder Kill in der Raserei verlängert sie um 0,1 s pro Rang (höchstens +4 s).' }],
    master: { name: 'Berserker', desc: 'In der Raserei nimmst du 30 % weniger Schaden.' } },
  trap: { name: 'Bärenfalle', short: 'Falle', charge: 'cd', need: 7,
    desc: 'Legt 3 Fallen um dich, jede schnappt bis zu 3-mal zu. Wer hineintritt, hängt 2 s fest, Splitter treffen die Gegner daneben.',
    extras: [{ name: 'Vierte Falle', desc: 'Du legst 4 statt 3 Fallen.' }, { name: 'Sprengfallen', desc: 'Die Splitter fliegen weiter und machen vollen Schaden.' }],
    skills: [{ name: 'Scharfe Zähne', desc: 'Jede Falle schnappt 1-mal öfter zu pro Rang.' }, { name: 'Festbeißen', desc: 'Gefangene hängen 0,4 s länger fest pro Rang.' }, { name: 'Köder', desc: 'Fallen locken Gegner im Umkreis an (50/80/110).' }],
    master: { name: 'Fallensteller', desc: 'Jede 3. Rolle legt eine Bärenfalle.' } },
  mech: { name: 'Goblin-Maschine', short: 'Maschine', charge: 'scrap', need: 100, unlock: { acct: 3 },
    desc: '12 s Dampf-Mech mit MG, Raketen und Stampfer. Du nimmst 70 % weniger Schaden. Solange er läuft, sind andere Fähigkeiten, Rolle und Sprint gesperrt.',
    extras: [{ name: 'Panzerplatten', desc: 'Im Mech nimmst du 85 % statt 70 % weniger Schaden.' }, { name: 'Doppelsalve', desc: 'Raketen kommen doppelt so oft.' }],
    skills: [{ name: 'Schnellfeuer', desc: 'MG feuert 12 % schneller pro Rang.' }, { name: 'Schwere Stiefel', desc: 'Stampfer +25 % Schaden und Fläche pro Rang.' }, { name: 'Schrottsammler', desc: 'Kills im Mech füllen 0,4 % Schrott pro Rang zurück.' }],
    master: { name: 'Überladung', desc: 'Die Schlussexplosion ist doppelt so stark und größer.' } },
  smoke: { name: 'Rauchbombe', short: 'Rauch', charge: 'cd', need: 14, dur: 3, unlock: { stage: 1 },
    desc: '3 s unsichtbar. Gegner laufen zu deinem alten Platz, manche schlagen verwirrt aufeinander ein. Im Rauch greifen deine Waffen 60 % langsamer an, jeder Punkt im Skill Tree senkt das (bis 20 %).',
    extras: [{ name: 'Dichter Rauch', desc: 'Du bleibst 2 s länger unsichtbar.' }, { name: 'Giftrauch', desc: 'Gegner rund um den Rauch nehmen jede Sekunde Schaden.' }],
    skills: [{ name: 'Ruhige Hand', desc: 'Angriffs-Malus im Rauch 60 → 47 → 33 → 20 %.' }, { name: 'Verwirrung', desc: '+12 % Chance pro Rang, dass Gegner sich gegenseitig angreifen.' }, { name: 'Schattenschritt', desc: 'Nach dem Rauch 1 s pro Rang +20 % Tempo.' }],
    master: { name: 'Hinterhalt', desc: 'Nach dem Rauch machst du 1,5 s lang doppelten Schaden.' } },
  catapult: { name: 'Goblin-Katapult', short: 'Katapult', charge: 'scrap', need: 35, unlock: { acct: 5 },
    desc: '5 Felsen schlagen in die dichteste Gegnergruppe ein.',
    extras: [{ name: 'Mehr Munition', desc: '8 statt 5 Felsen.' }, { name: 'Brennende Felsen', desc: 'Einschläge hinterlassen brennenden Boden.' }],
    skills: [{ name: 'Splitter', desc: 'Jeder Einschlag trifft 1 Gegner mehr pro Rang in der Nähe mit Splittern.' }, { name: 'Flinke Mannschaft', desc: 'Felsen fliegen 15 % schneller pro Rang.' }, { name: 'Benommen', desc: 'Einschläge betäuben 0,3 s pro Rang.' }],
    master: { name: 'Dauerfeuer', desc: '2 s später kommt eine zweite Salve mit halbem Schaden.' } },
  hook: { name: 'Enterhaken', short: 'Haken', charge: 'cd', need: 7, unlock: { stage: 2 },
    desc: 'Zieht dich zum nächsten Gegner (oder ein Stück nach vorn) und landet mit einer Stoßwelle. Kleine Gegner dort werden zu dir gerissen.',
    extras: [{ name: 'Langes Seil', desc: 'Der Haken fliegt viel weiter.' }, { name: 'Betäubender Aufprall', desc: 'Die Landung friert Gegner um dich 1 s ein.' }],
    skills: [{ name: 'Widerhaken', desc: 'Herangerissene Gegner nehmen 3 s lang +15 % Schaden pro Rang.' }, { name: 'Weiter Zug', desc: 'Zieh-Umkreis +20 % pro Rang.' }, { name: 'Abrollen', desc: 'Nach der Landung 0,3 s pro Rang unverwundbar.' }],
    master: { name: 'Doppelhaken', desc: 'Der Haken hat 2 Aufladungen.' } },
  shroom: { name: 'Pilzring', short: 'Pilze', charge: 'cd', need: 18, dur: 5, unlock: { acct: 8 },
    desc: '5 s Heilzone: +5 % Leben pro Sekunde, Gegner darin sind verlangsamt.',
    extras: [{ name: 'Großer Ring', desc: 'Der Pilzring wird 40 % größer.' }, { name: 'Giftsporen', desc: 'Gegner im Ring nehmen jede Sekunde Schaden.' }],
    skills: [{ name: 'Sporen', desc: 'Gegner im Ring nehmen +8 % Schaden pro Rang.' }, { name: 'Wurzelgriff', desc: 'Gegner im Ring sind stärker verlangsamt (50 → 60/70/80 %).' }, { name: 'Nachwuchs', desc: 'Am Ende bleibt pro Rang ein Heilpäckchen liegen.' }],
    master: { name: 'Wandernder Ring', desc: 'Der Pilzring folgt dir.' } },
  shield: { name: 'Schrottschild', short: 'Schild', charge: 'cd', need: 16, dur: 6, unlock: { stage: 3 },
    desc: 'Schild schluckt bis zu 40 % deines Lebens, 6 s lang. Geschosse prallen zurück.',
    extras: [{ name: 'Dicker Schild', desc: 'Schluckt 60 % statt 40 % deines Lebens.' }, { name: 'Splitterschild', desc: 'Wenn der Schild bricht oder endet, schleudert er Splitter um dich.' }],
    skills: [{ name: 'Spiegelblank', desc: 'Zurückgeworfene Geschosse +30 % Schaden pro Rang.' }, { name: 'Nachladen', desc: 'Endet der Schild ungebrochen, lädt er 10 % pro Rang schneller nach.' }, { name: 'Dornen', desc: 'Nahkämpfer, die den Schild treffen, nehmen 10 Schaden pro Rang.' }],
    master: { name: 'Bollwerk', desc: 'Mit Schild wirst du nicht verlangsamt, die erste Sekunde schluckt er alles.' } },
  rats: { name: 'Rattenflut', short: 'Ratten', charge: 'kills', need: 100, unlock: { stage: 4 },
    desc: '40 Ratten rennen über den Bildschirm und knabbern alles an.',
    extras: [{ name: 'Rattenkönig', desc: '20 Ratten mehr.' }, { name: 'Pestratten', desc: 'Gebissene Gegner sind 3 s verlangsamt.' }],
    skills: [{ name: 'Hungrige Ratten', desc: 'Jede Ratte beißt 1-mal öfter pro Rang.' }, { name: 'Beuteratten', desc: 'Ratten schleppen Kristalle und Münzen zu dir (größerer Umkreis pro Rang).' }, { name: 'Seuche', desc: 'Gebissene nehmen 3 s lang Giftschaden (mehr pro Rang).' }],
    master: { name: 'Rückkehr', desc: 'Die Ratten rennen noch einmal zurück.' } },
  call: { name: 'Goblin-Ruf', short: 'Ruf', charge: 'cd', need: 16, dur: 10, unlock: { acct: 12 },
    desc: '8 Goblin-Krieger kämpfen 10 s an deiner Seite.',
    extras: [{ name: 'Mehr Krieger', desc: '4 Krieger mehr.' }, { name: 'Kriegsschrei', desc: 'Beim Rufen bekommst du 4 s Raserei wie bei der Goblin-Wut.' }],
    skills: [{ name: 'Scharfe Speere', desc: 'Krieger +12 % Schaden pro Rang.' }, { name: 'Flinke Krieger', desc: 'Krieger laufen und schlagen 12 % schneller pro Rang.' }, { name: 'Letzter Hieb', desc: 'Krieger explodieren beim Gehen (mehr Schaden pro Rang).' }],
    master: { name: 'Häuptling', desc: 'Ein großer Häuptling mit dreifachem Schaden kommt mit.' } },
  totem: { name: 'Totem der Gier', short: 'Totem', charge: 'cd', need: 25, dur: 10, unlock: { stage: 5 },
    desc: 'Saugt alle Kristalle und Münzen an. 10 s doppeltes Gold.',
    extras: [{ name: 'Goldregen', desc: 'Doppeltes Gold hält 5 s länger.' }, { name: 'Heiltotem', desc: 'Das Totem heilt dich um 25 %.' }],
    skills: [{ name: 'Goldader', desc: 'Solange es wirkt, lassen Kills +10 % pro Rang öfter Münzen fallen.' }, { name: 'Glücksbringer', desc: 'Solange es wirkt, +4 % kritische Treffer pro Rang.' }, { name: 'Weisheit', desc: 'Solange es wirkt, +10 % Erfahrung pro Rang.' }],
    master: { name: 'Goldener Schutz', desc: 'Solange es wirkt, schluckt je 25 gesammeltes Gold einen Treffer.' } },
  timebomb: { name: 'Zeitbombe', short: 'Zeitbombe', charge: 'cd', need: 14, dur: 3, unlock: { stage: 6 },
    desc: 'Friert Gegner im Umkreis 3 s ein und löscht ihre Geschosse. Danach explodieren sie mit dem Schaden, den sie solange eingesteckt haben.',
    extras: [{ name: 'Großer Zünder', desc: '30 % mehr Umkreis.' }, { name: 'Kälteschock', desc: 'Eingefrorene Gegner nehmen 50 % mehr Schaden.' }],
    skills: [{ name: 'Langer Zünder', desc: '+0,5 s Einfrieren pro Rang.' }, { name: 'Kettenreaktion', desc: 'Explosionen +20 % größer pro Rang.' }, { name: 'Splitterregen', desc: 'Jeder Explodierende schießt 1 Eissplitter mehr pro Rang.' }],
    master: { name: 'Zeitschleife', desc: 'Überlebende frieren noch einmal 1,5 s ein.' } },
  bigbang: { name: 'Großer Knall', short: 'Knall', charge: 'kills', need: 120, unlock: { stage: 8 },
    desc: 'Alle Gegner auf dem Bildschirm nehmen massiven Schaden.',
    extras: [{ name: 'Nachbeben', desc: '1 s später ein zweiter Knall mit halber Kraft.' }, { name: 'Erschütterung', desc: 'Überlebende sind 1,5 s eingefroren.' }],
    skills: [{ name: 'Volltreffer', desc: '+15 % Schaden gegen Elite, Mini-Boss und Boss pro Rang.' }, { name: 'Beben', desc: 'Überlebende sind 1 s pro Rang verlangsamt.' }, { name: 'Kristallregen', desc: 'Getötete geben +20 % Erfahrung pro Rang.' }],
    master: { name: 'Nachhall', desc: 'Nach dem Knall startet die Aufladung bei 30 %.' } },
  // ---------- Rüstkammer 2.0 (Phase 10, Wunsch Fabi 2026-10-14) ----------
  oilcask: { name: 'Ölfass', short: 'Öl', charge: 'cd', need: 10, dur: 6, unlock: { acct: 10 },
    desc: 'Kippt einen Ölteppich vor dich (6 s): Gegner darauf rutschen und sind langsamer. Feuer entzündet ihn zu einem Flammensee.',
    extras: [{ name: 'Großes Fass', desc: 'Der Ölteppich wird 40 % größer.' }, { name: 'Selbstzünder', desc: 'Das Öl fängt nach 2 s von selbst Feuer.' }],
    skills: [{ name: 'Klebrig', desc: 'Gegner im Öl +10 % stärker verlangsamt pro Rang.' }, { name: 'Heißes Öl', desc: 'Der Flammensee macht +20 % Schaden pro Rang.' }, { name: 'Ausrutscher', desc: '5 % pro Rang und Sekunde: ein Gegner im Öl fällt 1 s hin.' }],
    master: { name: 'Ölquelle', desc: 'Solange der Teppich liegt, hinterlässt du eine Ölspur.' } },
  burrow: { name: 'Maulwurfsgang', short: 'Graben', charge: 'cd', need: 12, dur: 2, unlock: { acct: 15 },
    desc: '2 s eingegraben: unverwundbar, 40 % schneller, die Gegner verlieren dich. Deine Waffen greifen dabei halb so schnell an. Beim Auftauchen schleudert ein Erdstoß alles weg.',
    extras: [{ name: 'Tunnelspur', desc: 'Auf deinem Weg brechen Erdspitzen aus dem Boden.' }, { name: 'Beben', desc: 'Das Auftauchen betäubt Gegner 1 s.' }],
    skills: [{ name: 'Spitzbohrer', desc: 'Erdstoß +15 % Schaden pro Rang.' }, { name: 'Lange Grabung', desc: '+0,4 s unter der Erde pro Rang.' }, { name: 'Schatzgräber', desc: 'Beim Auftauchen fliegen 2 Kristalle pro Rang heraus.' }],
    master: { name: 'Doppelstoß', desc: 'Auch beim Eingraben gibt es einen Erdstoß.' } },
  cannon: { name: 'Goblin-Kanone', short: 'Kanone', charge: 'kills', need: 60, unlock: { acct: 18 },
    desc: 'Schießt dich als Kugel in die dichteste Gegnergruppe: unterwegs unverwundbar, Treffer entlang der Bahn, großer Einschlag.',
    extras: [{ name: 'Doppelschuss', desc: 'Nach der Landung ein zweiter, kurzer Sprung zur nächsten Gruppe.' }, { name: 'Feuerspur', desc: 'Die Bahn brennt 3 s (zündet auch Öl).' }],
    skills: [{ name: 'Pulver', desc: 'Einschlag +12 % Schaden pro Rang.' }, { name: 'Weite Bahn', desc: '+15 % Reichweite und Breite pro Rang.' }, { name: 'Abprall', desc: 'Die Landung schleudert 1 Gegner pro Rang weit weg (mit vollem Schaden).' }],
    master: { name: 'Kanonade', desc: '3 Mini-Goblin-Kugeln schlagen neben dir ein.' } },
  decoy: { name: 'Strohgoblin', short: 'Puppe', charge: 'cd', need: 15, dur: 5, unlock: { acct: 20 },
    desc: 'Eine Strohpuppe lockt 5 s alle Gegner im Umkreis an und hält Treffer aus. Am Ende explodiert sie mit der Hälfte des eingesteckten Schadens.',
    extras: [{ name: 'Zwei Puppen', desc: 'Du stellst zwei Puppen auf.' }, { name: 'Dornenpuppe', desc: 'Nahkämpfer, die die Puppe schlagen, nehmen Schaden.' }],
    skills: [{ name: 'Zähes Stroh', desc: 'Puppe +20 % Leben pro Rang.' }, { name: 'Lauter Ruf', desc: 'Lock-Umkreis +15 % pro Rang.' }, { name: 'Sprengladung', desc: 'Explosion +20 % Schaden pro Rang.' }],
    master: { name: 'Spiegelgoblin', desc: 'Die Puppe wirft Dolche wie du (halber Schaden).' } },
  turret: { name: 'Flammenturm', short: 'Turm', charge: 'scrap', need: 45, dur: 10, unlock: { acct: 22 },
    desc: 'Baut einen Schrott-Turm, der 10 s einen Flammenstrahl auf den nächsten Gegner speit (zündet Öl).',
    extras: [{ name: 'Zweiter Turm', desc: 'Du baust zwei Türme.' }, { name: 'Blauflamme', desc: '+50 % Schaden gegen Elite, Mini-Boss und Boss.' }],
    skills: [{ name: 'Heiße Düse', desc: '+12 % Schaden pro Rang.' }, { name: 'Lange Leitung', desc: '+15 % Reichweite pro Rang.' }, { name: 'Schrottpanzer', desc: 'Der Turm steht 2 s länger pro Rang.' }],
    master: { name: 'Mobiler Turm', desc: 'Der Turm läuft dir hinterher.' } },
  spin: { name: 'Wirbelaxt', short: 'Wirbel', charge: 'cd', need: 9, dur: 2.5, unlock: { acct: 25 },
    desc: '2,5 s Drehung mit zwei Äxten: trifft alles um dich viermal pro Sekunde, stößt weg und wehrt Geschosse ab. Du läufst dabei 20 % langsamer.',
    extras: [{ name: 'Sog', desc: 'Der Wirbel zieht Gegner heran.' }, { name: 'Klingenwind', desc: 'Am Ende fliegen 8 Äxte in alle Richtungen.' }],
    skills: [{ name: 'Schärfe', desc: '+12 % Schaden pro Rang.' }, { name: 'Ausdauer', desc: '+0,4 s Drehung pro Rang.' }, { name: 'Wirbeltempo', desc: 'Weniger Tempo-Malus und 15 % mehr Treffer pro Rang.' }],
    master: { name: 'Tornado', desc: 'Am Ende bleibt ein Tornado 3 s stehen und wirbelt weiter.' } },
  grudge: { name: 'Goblin-Groll', short: 'Groll', charge: 'hurt', need: 60, unlock: { acct: 28 },
    desc: 'Lädt, wenn du Schaden einsteckst (60 % deines Lebens). Entlädt sich als Feuerring mit 400 % des eingesteckten Schadens und heilt dich um 15 %.',
    extras: [{ name: 'Racheblick', desc: 'Wer dich zuletzt getroffen hat, nimmt 5 s doppelten Schaden.' }, { name: 'Dickes Fell', desc: 'Solange der Groll voll ist, nimmst du 20 % weniger Schaden.' }],
    skills: [{ name: 'Zorn', desc: '+40 % Ring-Schaden pro Rang.' }, { name: 'Brodeln', desc: 'Eine perfekte Rolle lädt 5 % pro Rang.' }, { name: 'Heißblut', desc: '+5 % Heilung pro Rang.' }],
    master: { name: 'Unendlicher Groll', desc: 'Danach 3 s unverwundbar, die Ladung startet bei 30 %.' } },
  scrapmag: { name: 'Schrottmagnet', short: 'Magnet', charge: 'cd', need: 18, dur: 2, unlock: { acct: 30 },
    desc: 'Zieht 2 s alle Gegner im großen Umkreis zu dir (Elite und Bosse nicht), dann fliegt der Schrott in einer Explosion auseinander.',
    extras: [{ name: 'Dauermagnet', desc: 'Zieht 1,5 s länger.' }, { name: 'Kristallmagnet', desc: 'Zieht auch Kristalle und Münzen an.' }],
    skills: [{ name: 'Starke Pole', desc: '+15 % Zug pro Rang, ab Rang 1 auch Elite.' }, { name: 'Schrottsplitter', desc: 'Explosion +20 % Schaden pro Rang.' }, { name: 'Verbiegen', desc: 'Gezogene nehmen 3 s lang +10 % Schaden pro Rang.' }],
    master: { name: 'Polwechsel', desc: 'Nach der Explosion fliegt alles weg und ist 1 s betäubt.' } },
  bees: { name: 'Bienenstock', short: 'Bienen', charge: 'kills', need: 70, dur: 8, unlock: { acct: 35 },
    desc: '25 Bienen jagen 8 s die Gegner. Ihre Stiche vergiften und verlangsamen.',
    extras: [{ name: 'Königin', desc: 'Eine große Biene fliegt mit, dreifacher Schaden gegen Elite, Mini-Boss und Boss.' }, { name: 'Honig', desc: 'Eine Honigpfütze heilt dich 2 % pro Sekunde und klebt Gegner fest.' }],
    skills: [{ name: 'Spitze Stachel', desc: '+12 % Stichschaden pro Rang.' }, { name: 'Großer Schwarm', desc: '+5 Bienen pro Rang.' }, { name: 'Wütende Bienen', desc: 'Bienen +10 % schneller pro Rang.' }],
    master: { name: 'Ewiger Stock', desc: 'Bis zum nächsten Einsatz kommt alle 10 s ein kleiner Schwarm nach.' } },
  brew: { name: 'Hexenkessel', short: 'Kessel', charge: 'cd', need: 20, dur: 8, unlock: { stage: 7 },
    desc: 'Der Kessel braut einen von 5 Tränken für 8 s: Riese (größer, +40 % Schaden, Stampfen), Flink (+50 % Tempo und Angriffstempo), Feuer (spuckt Feuer), Heil (40 % Leben und Erholung) oder Gold (dreifache Münzen).',
    extras: [{ name: 'Doppelbrau', desc: 'Du bekommst zwei Tränke auf einmal.' }, { name: 'Lieblingsrezept', desc: 'Der erste Trank im Lauf kommt danach doppelt so oft.' }],
    skills: [{ name: 'Starker Sud', desc: '+10 % Wirkung pro Rang.' }, { name: 'Lange Wirkung', desc: '+1 s pro Rang.' }, { name: 'Übersprudeln', desc: 'Beim Brauen spritzt kochender Sud um dich (mehr Schaden pro Rang).' }],
    master: { name: 'Meistertrank', desc: '10 % Chance auf alle fünf Tränke zugleich.' } },
  // Sicherheitsnetz aus 7.5: belegt einen Slot, wirkt von selbst
  charm: { name: 'Goblin-Amulett', short: 'Amulett', charge: 'once', need: 1, unlock: { acct: 6 },
    desc: 'Ein Mal pro Lauf: Statt zu sterben stehst du mit halbem Leben wieder auf und stößt alles weg.',
    extras: [{ name: 'Zweite Chance', desc: 'Rettet dich zwei Mal pro Lauf.' }, { name: 'Phönix', desc: 'Du stehst mit vollem Leben wieder auf.' }],
    skills: [{ name: 'Glanz', desc: '+0,5 s unverwundbar nach dem Aufstehen pro Rang.' }, { name: 'Rache', desc: 'Rettungs-Stoß +50 % Schaden und +15 % Umkreis pro Rang.' }, { name: 'Schutzgeist', desc: 'Solange das Amulett unbenutzt ist, +3 % max. Leben pro Rang.' }],
    master: { name: 'Wiedergeburt', desc: 'Nach dem Aufstehen 5 s Raserei wie bei der Goblin-Wut.' } },
};
export const ABILITY_IDS = Object.keys(ABILITIES);

// ---------- Level und Skill Tree (PLAN 8.4) ----------
export const ABIL_MAX_LV = 30;
export const abilXpNeed = L => 60 + 40 * L;
// Sterne (Phase 10): nach Level 30 sammelt die Fähigkeit weiter XP, je STAR_XP ein Stern (bis 5), jeder +3 % Kraft
// und ein anderer Glanz beim Einsatz (Bronze, Silber, Gold, Lila, Regenbogen). 5 Sterne: Titel „Legende der …“
export const STAR_XP = 2000, STAR_MAX = 5, STAR_POW = .03;
export const STAR_COLS = ['#c9844a', '#dfe6ea', '#f4d03f', '#c27cff', '#ff7ad9'];
export const STAR_NAMES = ['Bronze', 'Silber', 'Gold', 'Lila', 'Regenbogen'];
// XP pro Einsatz: ein voller Lauf bringt jeder Fähigkeit ~100 XP, egal wie oft sie lädt
export function xpPerUse(id) {
  if (id === 'dash') return 3;
  if (id === 'sprint') return 1.5;   // pro Sekunde Sprinten
  const A = ABILITIES[id];
  return Math.max(2, Math.round(A.charge === 'cd' ? A.need * .42 : A.charge === 'kills' ? A.need * .25 : A.charge === 'scrap' ? A.need * .3 : A.charge === 'hurt' ? A.need * .8 : 50));
}
// Baum (PLAN 8.4): vier Reihen von unten nach oben. Eine Reihe öffnet sich, wenn in den Reihen darunter
// genug Punkte stecken (req). Reihe 1 ist bei allen Fähigkeiten Kraft/Tempo/Reichweite, bei Rolle und Sprint eigene Wurzeln.
// s1–s3 = eigene Skills, a/b = Extras, m = Meister.
export const TREE = {
  pow: { max: 5, cost: 1 }, cd: { max: 5, cost: 1 }, area: { max: 3, cost: 1 },
  s1: { max: 3, cost: 1 }, a: { max: 1, cost: 2 }, s2: { max: 3, cost: 1 },
  s3: { max: 3, cost: 1 }, b: { max: 1, cost: 2 },
  m: { max: 1, cost: 3 },
};
export const ROWS = [{ req: 0, keys: ['pow', 'cd', 'area'] }, { req: 3, keys: ['s1', 'a', 's2'] }, { req: 9, keys: ['s3', 'b'] }, { req: 15, keys: ['m'] }];
const ROOTS = {
  pow: { name: 'Kraft', desc: '+8 % Schaden, Heilung und Schild pro Rang' },
  cd: { name: 'Tempo', desc: '−5 % Abklingzeit bzw. Kill- oder Schrott-Bedarf pro Rang' },
  area: { name: 'Reichweite', desc: '+8 % Fläche und Dauer pro Rang' },
};
// Rolle und Sprint: immer dabei, leveln mit (XP durch Benutzen) und haben eigene Wurzeln
export const MOVES = {
  dash: { name: 'Rolle', short: 'Rolle', icon: 'dash', desc: 'Kurze Rolle in Laufrichtung, kurz unverwundbar. Durch ein Geschoss rollen = perfekte Rolle.',
    roots: { pow: { name: 'Flink', desc: '−6 % Abklingzeit pro Rang' }, cd: { name: 'Weite', desc: '+8 % Strecke pro Rang' }, area: { name: 'Deckung', desc: '+0,06 s unverwundbar pro Rang' } },
    extras: [{ name: 'Zweite Ladung', desc: 'Zwei Rollen hintereinander.' }, { name: 'Krähenfüße', desc: 'Jede Rolle streut Krähenfüße: Gegner darauf sind verlangsamt und nehmen Schaden.' }],
    skills: [{ name: 'Perfekter Roller', desc: 'Perfekte Rolle lädt 2 Kills mehr pro Rang und ist leichter zu treffen.' }, { name: 'Staubwolke', desc: 'Gegner, durch die du rollst, fliegen weg und nehmen 10 Schaden pro Rang.' }, { name: 'Schwung', desc: 'Nach der Rolle 1,2 s +10 % Tempo pro Rang.' }],
    master: { name: 'Dritte Ladung', desc: 'Drei Rollen hintereinander.' } },
  sprint: { name: 'Sprint', short: 'Sprint', icon: 'boots', desc: 'Gedrückt halten: schneller laufen, kostet Ausdauer.',
    roots: { pow: { name: 'Ausdauer', desc: '+8 % Ausdauer pro Rang' }, cd: { name: 'Erholung', desc: '+8 % schnellere Erholung pro Rang' }, area: { name: 'Tempo', desc: '+4 % Sprinttempo pro Rang' } },
    extras: [{ name: 'Zweiter Atem', desc: 'Erschöpft wirst du nicht langsamer und erholst dich sofort.' }, { name: 'Rammbock', desc: 'Kleine Gegner, in die du sprintest, fliegen weg und nehmen Schaden.' }],
    skills: [{ name: 'Leichtfüßig', desc: 'Sprinten kostet 8 % weniger Ausdauer pro Rang.' }, { name: 'Ausweichen', desc: 'Beim Sprinten nimmst du 6 % weniger Schaden pro Rang.' }, { name: 'Windschatten', desc: 'Beim Sprinten +15 % Sammelradius pro Rang.' }],
    master: { name: 'Unermüdlich', desc: 'Die erste Sekunde jedes Sprints kostet keine Ausdauer.' } },
};
export const MOVE_IDS = Object.keys(MOVES);
export const TREE_IDS = [...ABILITY_IDS, ...MOVE_IDS];
export const treeDef = id => ABILITIES[id] || MOVES[id];
// Name und Text eines Knotens
export function nodeInfo(id, k) {
  const D = treeDef(id), N = TREE[k];
  const t = k === 'a' ? D.extras[0] : k === 'b' ? D.extras[1] : k === 'm' ? D.master : k[0] === 's' ? D.skills[+k[1] - 1] : (D.roots || ROOTS)[k];
  return { ...N, ...t, kind: k === 'a' || k === 'b' ? 'extra' : k === 'm' ? 'master' : k[0] === 's' ? 'skill' : 'root' };
}
export const spentPoints = pts => Object.entries(pts).reduce((n, [k, v]) => n + (TREE[k] ? TREE[k].cost * v : 0), 0);
// Punkte in den Reihen unter Reihe r
export function pointsBelow(pts, r) { let n = 0; for (let i = 0; i < r; i++) for (const k of ROWS[i].keys) n += (pts[k] || 0) * TREE[k].cost; return n; }
export const rowOf = k => ROWS.findIndex(R => R.keys.includes(k));
export const rowOpen = (pts, r) => pointsBelow(pts, r) >= ROWS[r].req;
// Darf ein Rang in Knoten k gekauft werden? (Level-Punkte frei, Maximum, Reihe offen)
export function canLearn(st, k) {
  const N = TREE[k], have = st.pts[k] || 0;
  return have < N.max && st.lv - 1 - spentPoints(st.pts) >= N.cost && rowOpen(st.pts, rowOf(k));
}
// Passt ein gespeicherter Baum zu den Regeln? (für alte Stände)
export function treeValid(st) {
  if (spentPoints(st.pts) > st.lv - 1) return false;
  return ROWS.every((R, r) => R.keys.every(k => !st.pts[k]) || rowOpen(st.pts, r));
}
// Wirkung des Baums für einen Lauf; s1–s3 = Ränge der eigenen Skills
export function abilMods(st) {
  const p = (st && st.pts) || {};
  return { pow: (1 + .08 * (p.pow || 0)) * (1 + STAR_POW * ((st && st.st) || 0)), spd: 1 - .05 * (p.cd || 0), area: 1 + .08 * (p.area || 0), a: !!p.a, b: !!p.b, m: !!p.m,
    s1: p.s1 || 0, s2: p.s2 || 0, s3: p.s3 || 0, r: { pow: p.pow || 0, cd: p.cd || 0, area: p.area || 0 } };
}
// Rauchbombe: Angriffstempo-Malus der Waffen, solange man unsichtbar ist (Wunsch Fabi).
// 60 % ohne Punkte, „Ruhige Hand“ senkt ihn bis 20 %.
export const smokeAtkSlow = calm => .6 - .4 * Math.min(calm || 0, 3) / 3;
// Rollen für den Regal-Filter der Rüstkammer (Phase 10)
export const ROLES = {
  atk: { name: 'Angriff', ids: ['catapult', 'bigbang', 'spin', 'turret', 'bees', 'grudge'] },
  ctrl: { name: 'Kontrolle', ids: ['trap', 'smoke', 'timebomb', 'oilcask', 'decoy', 'scrapmag'] },
  move: { name: 'Bewegung', ids: ['hook', 'burrow', 'cannon'] },
  guard: { name: 'Schutz', ids: ['shield', 'shroom', 'charm'] },
  help: { name: 'Helfer', ids: ['rage', 'totem', 'rats', 'call', 'brew', 'mech'] },
};
export const SLOT2_ACCT = 3;
export const SLOT_KEYS = ['Q', 'E'];
export const DEFAULT_LOADOUT = ['rage', 'trap'];
export const CHARGE_TXT = { cd: s => `alle ${s} s`, kills: n => `${n} Kills`, scrap: n => `${n} % Schrott`, hurt: n => `${n} % Leben einstecken`, once: () => '1× pro Lauf' };

// Freigeschaltet? acct = Konto-Level, cleared(i) = Stage i (0-basiert) gewonnen
export function abilityUnlocked(id, acct, cleared) {
  const u = ABILITIES[id].unlock;
  if (!u) return true;
  if (u.acct) return acct >= u.acct;
  return cleared(u.stage - 1);
}
export const unlockText = id => { const u = ABILITIES[id].unlock; return !u ? '' : u.acct ? `Konto-Level ${u.acct}` : `Welt ${u.stage} schaffen`; };
