// ---------- Bosse (PLAN 6.2 / 6.3) ----------
// Jeder Boss hat 3 Phasen (ab 100 %, 66 %, 33 % Leben; Malvorn 4). Eine Phase ist eine Angriffs-Rotation
// (Namen aus game/boss-atk.js ATK), dazu Tempo (spd), Pause zwischen zwei Angriffen (gap) und Extras:
//   burn: Arena brennt am Rand · shield: Eisschild (Sekunden bis er nach dem Brechen wiederkommt)
//   storm: Schneesturm (Sicht eingeschränkt) · split: in so viele Teile mit gemeinsamem Leben teilen
//   poison: Arena läuft von außen voll Gift · vessels: so viele Seelengefäße, solange eins steht, ist er unverwundbar
//   ghosts: tote Skelette stehen als Geister wieder auf · clones: Spiegelbilder · pillars: Blitzsäulen · wind: Sturm schiebt
//   armor: Rüstungsplatten · dismount: Golem zerbricht · schools: Schulwechsel alle n s (Angriffe je Schule, boss-mech.js)
//   shades: frühere Bosse als Schatten · rageIn: Wut nach n s in dieser Phase · name: statt „Phase n“ im Banner
// intro: Auftritt (flame, ice, poison, grave, mirror, bolt, quake, sigil) · mount: reitet einen Golem · variants/all: weitere Bilder laden
// look: eigenes Modell aus gen/mages.js (BOSS_LOOKS), sonst Meister der Schule.
// minions: Diener, deren Bilder vorab geladen werden müssen
// hp / spd: Leben und Lauftempo relativ zum Standard (Stellschrauben fürs Balancing, Sim: npm run sim -- --level 5).
export const PHASE_AT = [1, .66, .33];   // Standard; B.at für eigene Schwellen (Malvorn: 4 Phasen)
export const RAGE_AT = 120;   // Wut-Timer: danach +50 % Tempo und Schaden
// Angriffe, die game/boss.js (ATK) kennt (der Smoke-Test vergleicht beide Listen; die Unit-Tests können boss.js ohne DOM nicht laden)
export const ATTACKS = ['fan', 'ring', 'strikes', 'summon', 'charge', 'meteors', 'walls', 'spears', 'icefloor', 'spiral', 'puddles', 'gas', 'skeletons', 'cage', 'drain',
  'blink', 'bolts', 'portal', 'chain', 'quake', 'rocks', 'spikes'];

export const BOSSES = {
  ignaz: {
    name: 'Ignaz', title: 'der Funkenmeister', school: 'fire', look: 'ignaz', kind: 'fire', col: '#ff8a1f', intro: 'flame', hp: 1.15,
    hint: 'Lehr-Boss: Jeder Angriff wird vorher am Boden angezeigt.',
    phases: [
      { atk: ['fan', 'charge', 'fan', 'charge'], gap: 2.1 },
      { atk: ['walls', 'fan', 'charge', 'fan'], gap: 1.8, spd: 1.12, say: 'Die Flammen drehen sich!' },
      { atk: ['meteors', 'walls', 'fan', 'charge'], gap: 1.6, spd: 1.25, burn: true, say: 'Die Arena brennt!' },
    ],
  },
  frostbart: {
    name: 'Frostbart', title: 'der Eisweber', school: 'frost', look: 'frostbart', kind: 'frost', col: '#8fe6ff', intro: 'ice', spd: .8, hp: .85,
    hint: '',
    phases: [
      { atk: ['spears', 'icefloor', 'spears', 'ring'], gap: 2 },
      { atk: ['spears', 'icefloor', 'ring', 'spears'], gap: 1.9, spd: 1.1, shield: 12, say: 'Eisschild! Triff ihn am Rücken.' },
      { atk: ['spiral', 'spears', 'icefloor', 'spiral', 'ring'], gap: 1.7, spd: 1.2, shield: 18, storm: true, say: 'Schneesturm!' },
    ],
  },
  // Morgra die Seuchenmutter: Giftpfützen-Regen, Gaskegel; teilt sich (gemeinsames Leben), zuletzt läuft die Arena von außen voll Gift
  morgra: {
    name: 'Morgra', title: 'die Seuchenmutter', school: 'toxic', look: 'morgra', kind: 'toxic', col: '#8be04a', intro: 'poison', hp: 1.15,
    hint: 'Ihre Hälften teilen sich ein Leben – triff, was am nächsten ist.',
    phases: [
      { atk: ['puddles', 'gas', 'fan', 'puddles', 'gas'], gap: 2 },
      { atk: ['puddles', 'gas', 'fan', 'gas'], gap: 2.1, spd: 1.05, split: 2, say: 'Sie teilt sich!' },
      { atk: ['puddles', 'gas', 'fan', 'puddles'], gap: 2, spd: 1.1, split: 3, poison: true, say: 'Das Gift steigt!' },
    ],
  },
  // Graf Knochenhand: Skelett-Wellen und Knochenkäfig; Seelengefäße machen ihn unverwundbar; zuletzt Geister und Lebensraub-Strahl
  knochenhand: {
    name: 'Graf Knochenhand', title: 'Herr der Gräber', school: 'necro', look: 'knochenhand', kind: 'necro', col: '#7bff6a', intro: 'grave', minions: ['skeleton', 'ghost'],
    hint: '',
    phases: [
      { atk: ['skeletons', 'cage', 'fan', 'skeletons', 'cage'], gap: 2 },
      { atk: ['skeletons', 'cage', 'ring', 'fan'], gap: 2, spd: 1.08, vessels: 3, say: 'Zerschlag die Seelengefäße!' },
      { atk: ['drain', 'skeletons', 'cage', 'drain', 'ring'], gap: 1.8, spd: 1.15, ghosts: true, say: 'Die Toten stehen wieder auf!' },
    ],
  },
  // Der Spiegelmeister: Teleport und Schattenbolzen; Spiegelbilder ohne Schatten; zuletzt Spiegeltore, durch die seine Bolzen kommen
  spiegelmeister: {
    name: 'Der Spiegelmeister', title: 'Herr der Trugbilder', school: 'shadow', look: 'spiegel', kind: 'void', col: '#b26bff', intro: 'mirror', hp: .75, variants: ['shadow.spiegel-c'],
    hint: 'Er springt – behalte ihn im Auge.',
    phases: [
      { atk: ['blink', 'bolts', 'fan', 'blink', 'bolts'], gap: 1.8 },
      { atk: ['blink', 'bolts', 'fan', 'bolts'], gap: 1.9, spd: 1.05, clones: 3, say: 'Nur der Echte wirft einen Schatten!' },
      { atk: ['portal', 'blink', 'bolts', 'portal', 'fan'], gap: 1.7, spd: 1.1, clones: 3, say: 'Seine Bolzen kommen aus den Spiegeln!' },
    ],
  },
  // Tempestra: Blitzkreise und Kettenblitz; 4 Säulen spannen wechselnde Strahlen; zuletzt schiebt der Sturm
  tempestra: {
    name: 'Tempestra', title: 'die Sturmkönigin', school: 'storm', look: 'tempestra', kind: 'storm', col: '#ffe45c', intro: 'bolt',
    hint: '',
    phases: [
      { atk: ['strikes', 'chain', 'fan', 'chain'], gap: 2 },
      { atk: ['strikes', 'chain', 'fan'], gap: 2.2, spd: 1.05, pillars: true, say: 'Zwischen den Säulen springen Blitze – such die Lücke!' },
      { atk: ['chain', 'strikes', 'ring', 'chain'], gap: 2, spd: 1.1, pillars: true, wind: true, say: 'Der Sturm reißt an dir!' },
    ],
  },
  // Golemfürst Gromm: reitet einen Golem (Schockwellen, Felsregen); Rüstungsplatten; zuletzt zu Fuß, schnell, Erdspieße
  gromm: {
    name: 'Golemfürst Gromm', title: 'Herr des Schlunds', school: 'earth', look: 'gromm', kind: 'earth', col: '#c9a36a', intro: 'quake', mount: true, minions: ['golem'],
    hint: '',
    phases: [
      { atk: ['quake', 'rocks', 'charge', 'quake'], gap: 2.1 },
      { atk: ['quake', 'rocks', 'charge', 'rocks'], gap: 2, spd: 1.05, armor: 4, say: 'Schlag ihm die Rüstung ab!' },
      { atk: ['spikes', 'charge', 'rocks', 'spikes', 'charge'], gap: 1.5, spd: 1.15, dismount: true, say: 'Der Golem zerbricht – jetzt ist er schnell!' },
    ],
  },
  // Erzmagier Malvorn: wechselt alle 15 s die Schule; ruft 2 frühere Bosse als Schatten; alle Schulen schnell nacheinander,
  // Wut schon nach 60 s; bei 10 % „Verzweiflung“
  malvorn: {
    name: 'Erzmagier Malvorn', title: 'Herr des Turms', school: 'fire', look: 'malvorn', kind: 'both', col: '#ffe27a', intro: 'sigil', hp: .7, all: true,
    at: [1, .66, .33, .1],
    hint: 'Jede Schule hat ihre eigenen Angriffe – lies seine Farbe.',
    phases: [
      { schools: 15, gap: 2 },
      { schools: 15, gap: 2, spd: 1.05, shades: 2, say: 'Er ruft die Schatten früherer Gegner!' },
      { schools: 6, gap: 1.8, spd: 1.1, rageIn: 60, say: 'Alle Schulen auf einmal!' },
      { atk: ['spiral', 'meteors', 'chain', 'spiral', 'strikes'], gap: 1.1, spd: 1.3, name: 'Verzweiflung', say: 'Verzweiflung!' },
    ],
  },
};
// Sprite-Variante des Bosses ('fire.ignaz' bzw. Meister 'fire.m')
export const BOSS_IDS = Object.keys(BOSSES);
export const bossVariant = id => { const B = BOSSES[id]; return B.school + '.' + (B.look || 'm'); };
