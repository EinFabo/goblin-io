// ---------- Gegner (Abschnitt 5 im Plan) ----------
// Jede Schule hat Lehrling (klein, schnell), Magier (hält Abstand, zaubert) und Meister (groß, selten, Spezialangriff).
// ai: Bewegung (chase | kite | zigzag | still), keep: Wunschabstand beim Kiten.
// casts: Zauber aus game/casts.js, cd = Abklingzeit [min, max] in s, range = max. Abstand zum Spieler.
// Weitere Eigenschaften: melee (Kontakt-Effekt), traits (besondere Regeln), sprite (Diener statt Magier).

export const ROLE_SC = { apprentice: .72, mage: 1, master: 1.4 };

export const ETYPES = {
  // ----- Feuer -----
  fire_apprentice: { name: 'Funkenwichtel', school: 'fire', role: 'apprentice', tip: 'Explodiert neben dir. Früh erledigt, sprengt er andere Magier.',
    hp: 6, spd: 108, dmg: 0, r: 12, sc: .75, xp: 2, ai: 'chase', traits: ['bomber'] },
  fire_mage: { name: 'Pyromant', school: 'fire', role: 'mage', tip: 'Glühender Stab = gleich kommt ein Feuerball.',
    hp: 8, spd: 56, dmg: 6, r: 15, xp: 2, ai: 'chase', casts: [{ id: 'fireball', cd: [5, 9], range: 360 }] },
  fire_master: { name: 'Aschemeister', school: 'fire', role: 'master', tip: 'Orange Linie am Boden = gleich steht dort eine Feuerwand. Roll durch!',
    hp: 60, spd: 38, dmg: 12, r: 22, xp: 8, ai: 'chase', casts: [{ id: 'firewall', cd: [7, 10], range: 420 }, { id: 'fire3', cd: [5, 8], range: 400 }] },
  // ----- Frost -----
  frost_apprentice: { name: 'Eiswichtel', school: 'frost', role: 'apprentice', tip: 'Schnell und schwach. Wer dich berührt, bremst dich.',
    hp: 4, spd: 92, dmg: 4, r: 11, xp: 1, ai: 'chase', melee: 'slow' },
  frost_mage: { name: 'Kryomant', school: 'frost', role: 'mage', tip: 'Eisspeere verlangsamen dich.',
    hp: 9, spd: 50, dmg: 5, r: 15, xp: 2, ai: 'chase', casts: [{ id: 'icespear', cd: [5.5, 9.5], range: 350 }] },
  frost_master: { name: 'Gletscherwächter', school: 'frost', role: 'master', tip: 'Sein Eisschild blockt Geschosse von vorn. Von hinten oder mit Flächenschaden angreifen.',
    hp: 70, spd: 34, dmg: 10, r: 22, xp: 9, ai: 'chase', traits: ['frontShield'], casts: [{ id: 'icevolley', cd: [6, 9], range: 380 }] },
  // ----- Sturm -----
  storm_apprentice: { name: 'Funkler', school: 'storm', role: 'apprentice', tip: 'Zickzackt schnell heran. Flächenwaffen helfen.',
    hp: 5, spd: 100, dmg: 4, r: 11, xp: 1, ai: 'zigzag' },
  storm_mage: { name: 'Sturmrufer', school: 'storm', role: 'mage', tip: 'Raus aus dem gelben Kreis!',
    hp: 10, spd: 48, dmg: 9, r: 15, xp: 3, ai: 'chase', casts: [{ id: 'strike', cd: [5.5, 8.5], range: 430 }] },
  storm_master: { name: 'Donnerpriester', school: 'storm', role: 'master', tip: 'Zwei Priester spannen einen Blitz zwischen sich. Linie nicht kreuzen, einen erledigen.',
    hp: 40, spd: 36, dmg: 8, r: 20, xp: 7, ai: 'kite', keep: 260, group: 2, casts: [{ id: 'thunderbeam', cd: [7, 9], range: 600 }, { id: 'strike3', cd: [6, 9], range: 430 }] },
  // ----- Gift -----
  toxic_apprentice: { name: 'Giftmischer', school: 'toxic', role: 'apprentice', sc: .85, tip: 'Wirft Giftpfützen. Nicht reinlaufen.',
    hp: 11, spd: 46, dmg: 5, r: 14, xp: 3, ai: 'chase', casts: [{ id: 'puddle', cd: [6, 9], range: 380 }] },
  toxic_mage: { name: 'Seuchendoktor', school: 'toxic', role: 'mage', tip: 'Grüner Kegel = gleich kommt Gas. Seitlich raus!',
    hp: 14, spd: 50, dmg: 7, r: 15, xp: 3, ai: 'kite', keep: 120, casts: [{ id: 'gascone', cd: [4.5, 7], range: 170 }] },
  toxic_master: { name: 'Sumpfhexe', school: 'toxic', role: 'master', tip: 'Teilt sich beim Tod in zwei kleine Hexen.',
    hp: 45, spd: 40, dmg: 9, r: 20, xp: 6, ai: 'kite', keep: 240, traits: ['split'], casts: [{ id: 'puddle3', cd: [6, 9], range: 400 }] },
  // ----- Schatten -----
  shadow_apprentice: { name: 'Blinzler', school: 'shadow', role: 'apprentice', sc: .85, tip: 'Teleportiert sich neben dich. Direkt nach dem Auftauchen angreifen!',
    hp: 9, spd: 40, dmg: 7, r: 14, xp: 3, ai: 'chase', casts: [{ id: 'blink', cd: [4, 6.5], range: 600 }] },
  shadow_mage: { name: 'Spiegelmagier', school: 'shadow', role: 'mage', tip: 'Erzeugt Klone. Der echte hat einen Schatten am Boden.',
    hp: 12, spd: 42, dmg: 7, r: 15, xp: 4, ai: 'kite', keep: 260, casts: [{ id: 'clones', cd: [9, 12], range: 500 }, { id: 'shadebolt', cd: [4, 6], range: 420 }] },
  shadow_master: { name: 'Leerenwandler', school: 'shadow', role: 'master', tip: 'Öffnet ein Portal, aus dem Lehrlinge kommen. Portal zerstören!',
    hp: 50, spd: 30, dmg: 9, r: 20, xp: 8, ai: 'kite', keep: 300, casts: [{ id: 'portal', cd: [10, 14], range: 500 }, { id: 'shadebolt', cd: [4, 6], range: 420 }] },
  // ----- Nekromantie -----
  necro_apprentice: { name: 'Knochenlehrling', school: 'necro', role: 'apprentice', tip: 'Steht einmal wieder auf. Knochenhaufen zerschlagen!',
    hp: 6, spd: 70, dmg: 5, r: 12, xp: 1, ai: 'chase', traits: ['revive'] },
  necro_mage: { name: 'Knochenrufer', school: 'necro', role: 'mage', tip: 'Grüne Runen = gleich kommen Skelette. Den Rufer zuerst!',
    hp: 12, spd: 42, dmg: 5, r: 15, xp: 4, ai: 'kite', keep: 260, casts: [{ id: 'summon_skeletons', cd: [7, 10], range: 500 }] },
  necro_master: { name: 'Lich', school: 'necro', role: 'master', tip: 'Grüner Strahl baut sich auf: aus der Linie raus! Er belebt tote Magier als Geister.',
    hp: 60, spd: 34, dmg: 10, r: 20, xp: 8, ai: 'kite', keep: 280, casts: [{ id: 'drainbeam', cd: [6, 8], range: 480 }, { id: 'raise_ghosts', cd: [8, 11], range: 600 }] },
  // ----- Erde -----
  earth_apprentice: { name: 'Felsenwerfer', school: 'earth', role: 'apprentice', sc: .85, tip: 'Wachsender Schatten am Boden = gleich landet ein Fels.',
    hp: 9, spd: 40, dmg: 7, r: 14, xp: 2, ai: 'kite', keep: 280, casts: [{ id: 'rock', cd: [4.5, 7], range: 420 }] },
  earth_mage: { name: 'Erdbeber', school: 'earth', role: 'mage', tip: 'Risse im Boden = gleich kommen Stacheln. Quer zur Linie ausweichen.',
    hp: 14, spd: 44, dmg: 8, r: 15, xp: 3, ai: 'chase', casts: [{ id: 'spikeline', cd: [5, 8], range: 380 }] },
  earth_master: { name: 'Golem-Beschwörer', school: 'earth', role: 'master', tip: 'Ruft Steingolems. Golems umgehen, den Beschwörer erledigen.',
    hp: 50, spd: 30, dmg: 8, r: 20, xp: 8, ai: 'kite', keep: 320, casts: [{ id: 'summon_golem', cd: [12, 16], range: 600 }, { id: 'rock', cd: [5, 7], range: 420 }] },
  // ----- Licht -----
  light_apprentice: { name: 'Heiler', school: 'light', role: 'apprentice', sc: .85, tip: 'Heilt andere Magier. Zuerst erledigen!',
    hp: 14, spd: 44, dmg: 4, r: 14, xp: 4, ai: 'kite', keep: 230, casts: [{ id: 'heal', cd: [4, 6], range: 9999 }] },
  light_mage: { name: 'Schildpriester', school: 'light', role: 'mage', tip: 'Goldene Blase = Schild. Erst den Schild brechen.',
    hp: 14, spd: 42, dmg: 4, r: 15, xp: 4, ai: 'kite', keep: 240, casts: [{ id: 'shield', cd: [6, 9], range: 9999 }] },
  light_master: { name: 'Paladin-Magier', school: 'light', role: 'master', tip: 'Weiße Linie = gleich stürmt er los. Zur Seite!',
    hp: 55, spd: 40, dmg: 12, r: 20, xp: 7, ai: 'chase', casts: [{ id: 'charge', cd: [4, 6], range: 420 }] },

  // ----- Diener und Objekte (werden beschworen, nicht im Stage-Mix) -----
  skeleton: { name: 'Skelett', school: 'necro', sprite: 'skeleton', tip: 'Beschworen vom Knochenrufer.', hp: 5, spd: 80, dmg: 5, r: 11, sc: .9, xp: 1, ai: 'chase' },
  ghost: { name: 'Geist', school: 'necro', sprite: 'ghost', tip: 'Ein besiegter Magier, vom Lich zurückgeholt. Fliegt durch alles.', hp: 6, spd: 66, dmg: 6, r: 12, sc: .9, xp: 1, ai: 'chase', traits: ['float'] },
  golem: { name: 'Steingolem', school: 'earth', sprite: 'golem', tip: 'Langsam, zäh und schwer wegzustoßen.', hp: 90, spd: 26, dmg: 14, r: 24, sc: 1.15, xp: 5, ai: 'chase', traits: ['heavy'] },
  void_portal: { name: 'Leerenportal', school: 'shadow', draw: 'portal', tip: 'Spuckt Lehrlinge aus, bis es zerstört ist.', hp: 40, spd: 0, dmg: 0, r: 26, sc: 1, xp: 4, ai: 'still', traits: ['portal', 'heavy'] },
  bone_pile: { name: 'Knochenhaufen', school: 'necro', draw: 'bones', tip: 'Zerschlagen, bevor er wieder aufsteht.', hp: 5, spd: 0, dmg: 0, r: 14, sc: 1, xp: 0, ai: 'still', traits: ['bones', 'heavy'] },
  shadow_clone: { name: 'Klon', school: 'shadow', role: 'mage', clone: true, tip: '', hp: 1, spd: 42, dmg: 0, r: 15, xp: 0, ai: 'kite', keep: 260, casts: [{ id: 'fakebolt', cd: [3.5, 5.5], range: 420 }] },
};

// Farbe je Schule (Portal, Auflösen, Funken beim Zaubern)
export const SCHOOL_COL = { fire: '#ff8a1f', frost: '#7fd8ff', storm: '#ffe45c', toxic: '#7be04a', shadow: '#b26bff', necro: '#7bff6a', earth: '#c9a36a', light: '#fff3b0' };
export const ECOL = new Proxy({}, { get: (_, t) => t === 'boss' ? '#c58cff' : ETYPES[t] ? SCHOOL_COL[ETYPES[t].school] : undefined });

// Größe aus der Rolle, falls nicht eigens angegeben
for (const T of Object.values(ETYPES)) if (T.sc === undefined) T.sc = ROLE_SC[T.role] || 1;

// Zauberfarben der Bosse (alte feste Rotation, bis zum Boss-Rework in Phase 7)
export const CCOL = { fire: '#ff8a1f', frost: '#7fd8ff', storm: '#ffe45c', blink: '#b26bff', void: '#b26bff' };
