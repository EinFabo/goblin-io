// ---------- Bosse (PLAN 6.2 / 6.3) ----------
// Jeder Boss hat 3 Phasen (ab 100 %, 66 %, 33 % Leben). Eine Phase ist eine Angriffs-Rotation
// (Namen aus game/boss.js ATK), dazu Tempo (spd), Pause zwischen zwei Angriffen (gap) und Extras:
//   burn: Arena brennt am Rand · shield: Eisschild (Sekunden bis er nach dem Brechen wiederkommt)
//   storm: Schneesturm (Sicht eingeschränkt)
// look: eigenes Modell aus gen/mages.js (BOSS_LOOKS), sonst Meister der Schule.
// hp / spd: Leben und Lauftempo relativ zum Standard (Stellschrauben fürs Balancing, Sim: npm run sim -- --level 5).
// Ignaz und Frostbart sind fertig nach 6.3; die übrigen nutzen bis zu ihrem Umbau die alten Angriffe.
export const PHASE_AT = [1, .66, .33];
export const RAGE_AT = 120;   // Wut-Timer: danach +50 % Tempo und Schaden
// Angriffe, die game/boss.js (ATK) kennt (der Smoke-Test vergleicht beide Listen; die Unit-Tests können boss.js ohne DOM nicht laden)
export const ATTACKS = ['fan', 'ring', 'strikes', 'summon', 'charge', 'meteors', 'walls', 'spears', 'icefloor', 'spiral'];

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
  pyra: {
    name: 'Pyra', title: 'Herrin der Asche', school: 'fire', kind: 'fire', tint: 'ember', col: '#ff7a3a', hp: .8,
    phases: [
      { atk: ['ring', 'fan', 'charge'], gap: 2.2 },
      { atk: ['ring', 'fan', 'strikes', 'charge', 'summon'], gap: 2, spd: 1.12 },
      { atk: ['meteors', 'ring', 'fan', 'strikes', 'charge'], gap: 1.8, spd: 1.25 },
    ],
  },
  nebelhexer: {
    name: 'Der Nebelhexer', title: 'Herr des Moors', school: 'shadow', kind: 'frost', col: '#b26bff', hp: .8,
    phases: [
      { atk: ['ring', 'fan', 'summon'], gap: 2.2 },
      { atk: ['ring', 'strikes', 'fan', 'summon', 'charge'], gap: 2, spd: 1.12 },
      { atk: ['spiral', 'ring', 'strikes', 'fan', 'summon'], gap: 1.8, spd: 1.25 },
    ],
  },
  malvorn: {
    name: 'Erzmagier Malvorn', title: 'Herr des Turms', school: 'light', kind: 'both', col: '#ffe27a',
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
