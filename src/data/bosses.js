// ---------- Bosse (PLAN 6.2 / 6.3) ----------
// Jeder Boss hat 3 Phasen (ab 100 %, 66 %, 33 % Leben). Eine Phase ist eine Angriffs-Rotation
// (Namen aus game/boss.js ATK), dazu Tempo (spd), Pause zwischen zwei Angriffen (gap) und Extras:
//   burn: Arena brennt am Rand · shield: Eisschild (Sekunden bis er nach dem Brechen wiederkommt)
//   storm: Schneesturm (Sicht eingeschränkt) · split: in so viele Teile mit gemeinsamem Leben teilen
//   poison: Arena läuft von außen voll Gift · vessels: so viele Seelengefäße, solange eins steht, ist er unverwundbar
//   ghosts: tote Skelette stehen als Geister wieder auf
// look: eigenes Modell aus gen/mages.js (BOSS_LOOKS), sonst Meister der Schule.
// minions: Diener, deren Bilder vorab geladen werden müssen
// hp / spd: Leben und Lauftempo relativ zum Standard (Stellschrauben fürs Balancing, Sim: npm run sim -- --level 5).
// Ignaz, Frostbart, Morgra und Knochenhand sind fertig nach 6.3; die übrigen nutzen bis zu ihrem Umbau die alten Angriffe.
export const PHASE_AT = [1, .66, .33];
export const RAGE_AT = 120;   // Wut-Timer: danach +50 % Tempo und Schaden
// Angriffe, die game/boss.js (ATK) kennt (der Smoke-Test vergleicht beide Listen; die Unit-Tests können boss.js ohne DOM nicht laden)
export const ATTACKS = ['fan', 'ring', 'strikes', 'summon', 'charge', 'meteors', 'walls', 'spears', 'icefloor', 'spiral', 'puddles', 'gas', 'skeletons', 'cage', 'drain'];

export const BOSSES = {
  ignaz: {
    name: 'Ignaz', title: 'der Funkenmeister', school: 'fire', look: 'ignaz', kind: 'fire', col: '#ff8a1f', hp: 1.15,
    hint: 'Lehr-Boss: Jeder Angriff wird vorher am Boden angezeigt.',
    phases: [
      { atk: ['fan', 'charge', 'fan', 'charge'], gap: 2.1 },
      { atk: ['walls', 'fan', 'charge', 'fan'], gap: 1.8, spd: 1.12, say: 'Die Flammen drehen sich!' },
      { atk: ['meteors', 'walls', 'fan', 'charge'], gap: 1.6, spd: 1.25, burn: true, say: 'Die Arena brennt!' },
    ],
  },
  frostbart: {
    name: 'Frostbart', title: 'der Eisweber', school: 'frost', look: 'frostbart', kind: 'frost', col: '#8fe6ff', spd: .8, hp: .85,
    hint: '',
    phases: [
      { atk: ['spears', 'icefloor', 'spears', 'ring'], gap: 2 },
      { atk: ['spears', 'icefloor', 'ring', 'spears'], gap: 1.9, spd: 1.1, shield: 12, say: 'Eisschild! Triff ihn am Rücken.' },
      { atk: ['spiral', 'spears', 'icefloor', 'spiral', 'ring'], gap: 1.7, spd: 1.2, shield: 18, storm: true, say: 'Schneesturm!' },
    ],
  },
  // Morgra die Seuchenmutter: Giftpfützen-Regen, Gaskegel; teilt sich (gemeinsames Leben), zuletzt läuft die Arena von außen voll Gift
  morgra: {
    name: 'Morgra', title: 'die Seuchenmutter', school: 'toxic', look: 'morgra', kind: 'toxic', col: '#8be04a', hp: 1.15,
    hint: 'Ihre Hälften teilen sich ein Leben – triff, was am nächsten ist.',
    phases: [
      { atk: ['puddles', 'gas', 'fan', 'puddles', 'gas'], gap: 2 },
      { atk: ['puddles', 'gas', 'fan', 'gas'], gap: 2.1, spd: 1.05, split: 2, say: 'Sie teilt sich!' },
      { atk: ['puddles', 'gas', 'fan', 'puddles'], gap: 2, spd: 1.1, split: 3, poison: true, say: 'Das Gift steigt!' },
    ],
  },
  // Graf Knochenhand: Skelett-Wellen und Knochenkäfig; Seelengefäße machen ihn unverwundbar; zuletzt Geister und Lebensraub-Strahl
  knochenhand: {
    name: 'Graf Knochenhand', title: 'Herr der Gräber', school: 'necro', look: 'knochenhand', kind: 'necro', col: '#7bff6a', minions: ['skeleton', 'ghost'],
    hint: '',
    phases: [
      { atk: ['skeletons', 'cage', 'fan', 'skeletons', 'cage'], gap: 2 },
      { atk: ['skeletons', 'cage', 'ring', 'fan'], gap: 2, spd: 1.08, vessels: 3, say: 'Zerschlag die Seelengefäße!' },
      { atk: ['drain', 'skeletons', 'cage', 'drain', 'ring'], gap: 1.8, spd: 1.15, ghosts: true, say: 'Die Toten stehen wieder auf!' },
    ],
  },
  // Platzhalter bis zu ihrem Umbau (Phase 7, Teil 3): alte Angriffe in 3 Phasen
  spiegelmeister: {
    name: 'Der Spiegelmeister', title: 'Herr der Trugbilder', school: 'shadow', kind: 'void', col: '#b26bff',
    phases: [
      { atk: ['fan', 'summon', 'ring'], gap: 2.2 },
      { atk: ['spiral', 'fan', 'summon', 'ring'], gap: 2, spd: 1.1 },
      { atk: ['spiral', 'strikes', 'fan', 'summon'], gap: 1.8, spd: 1.2 },
    ],
  },
  tempestra: {
    name: 'Tempestra', title: 'die Sturmkönigin', school: 'storm', kind: 'storm', col: '#ffe45c',
    phases: [
      { atk: ['strikes', 'fan', 'strikes', 'charge'], gap: 2.2 },
      { atk: ['strikes', 'ring', 'fan', 'charge'], gap: 2, spd: 1.1 },
      { atk: ['strikes', 'spiral', 'strikes', 'fan'], gap: 1.8, spd: 1.2 },
    ],
  },
  gromm: {
    name: 'Golemfürst Gromm', title: 'Herr des Schlunds', school: 'earth', kind: 'earth', col: '#c9a36a',
    phases: [
      { atk: ['charge', 'strikes', 'summon', 'charge'], gap: 2.2 },
      { atk: ['charge', 'ring', 'strikes', 'summon'], gap: 2, spd: 1.1 },
      { atk: ['charge', 'fan', 'strikes', 'charge'], gap: 1.8, spd: 1.25 },
    ],
  },
  malvorn: {
    name: 'Erzmagier Malvorn', title: 'Herr des Turms', school: 'light', kind: 'both', col: '#ffe27a', hp: .8,
    phases: [
      { atk: ['ring', 'fan', 'strikes', 'charge'], gap: 2.2 },
      { atk: ['ring', 'fan', 'strikes', 'summon', 'charge'], gap: 2, spd: 1.12 },
      { atk: ['meteors', 'spiral', 'fan', 'strikes', 'summon', 'charge'], gap: 1.8, spd: 1.25 },
    ],
  },
};
// Sprite-Variante des Bosses ('fire.ignaz' bzw. Meister 'fire.m')
export const BOSS_IDS = Object.keys(BOSSES);
export const bossVariant = id => { const B = BOSSES[id]; return B.school + '.' + (B.look || 'm'); };
