// ---------- Stages ----------
// Jede Stage hat ein Wellen-Skript (PLAN 7.4):
//   Phase    { at, dur, rate: [Start, Ende] Gegner/s, mix: { typ: Gewicht } } – Spawns über Zeit
//   Ereignis { at, event, … } – ein fester Moment: elite, swarm, miniboss, warn, boss
// Zwischen den Phasen liegen 4 bis 7 Sekunden Ruhe zum Kristallsammeln.
// rate der Stage multipliziert alle Phasen (Stellschraube fürs Balancing).
// Schwärme: ring (umzingeln), wall (Linie von einer Seite), stream (Strom aus einer Richtung), pincer (von zwei Seiten)
export const STAGE_LEN = 240;

const ph = (at, dur, rate, mix) => ({ at, dur, rate, mix });
const ev = (at, event, o = {}) => ({ at, event, ...o });

export const STAGES = [
  { name: 'Goblinwiese', sub: 'Feuermagier und erste Funkenwichtel.', tint: null, dark: 0, dmg: 1, rate: 1,
    waves: [
      ph(0, 30, [.5, 1], { fire_mage: 1 }),
      ph(30, 26, [1.2, 1.8], { fire_mage: 3, frost_apprentice: 2 }),
      ev(60, 'elite', { type: 'fire_mage' }),
      ph(62, 28, [1.8, 2.5], { fire_mage: 3, frost_apprentice: 3 }),
      ev(90, 'swarm', { type: 'frost_apprentice', count: 30, shape: 'ring' }),
      ph(95, 22, [2.4, 3], { fire_mage: 3, frost_apprentice: 2, frost_mage: 1 }),
      ev(120, 'miniboss', { type: 'fire_master' }),
      ph(124, 26, [3, 3.8], { fire_mage: 3, frost_mage: 1.5, frost_apprentice: 2 }),
      ev(150, 'swarm', { type: 'fire_apprentice', count: 14, shape: 'stream' }),
      ph(154, 26, [3.8, 4.5], { fire_mage: 3, frost_mage: 1.5, frost_apprentice: 2, fire_apprentice: 1 }),
      ev(180, 'elite'),
      ph(182, 20, [4.5, 5], { fire_mage: 3, frost_mage: 2, fire_apprentice: 1, fire_master: .2 }),
      ev(195, 'swarm', { type: 'frost_apprentice', extra: 'fire_apprentice', count: 36, shape: 'wall' }),
      ph(208, 32, [5, 6], { fire_mage: 3, frost_mage: 2, frost_apprentice: 2, fire_apprentice: 1, fire_master: .3 }),
      ev(222, 'warn'),
      ev(240, 'boss'),
    ],
    boss: { id: 'ignaz', name: 'Ignaz der Funkenmeister', minion: 'frost_apprentice' } },

  { name: 'Frostlichtung', sub: 'Frostmagier bremsen dich, Schattenmagier tauchen neben dir auf.', tint: ['#a8d8ff', .5], dark: .05, dmg: 1.15, rate: 1.08,
    waves: [
      ph(0, 25, [.6, 1.1], { frost_mage: 2, frost_apprentice: 1 }),
      ph(25, 31, [1.2, 2], { frost_mage: 3, frost_apprentice: 3 }),
      ev(60, 'elite', { type: 'frost_mage' }),
      ph(62, 28, [2, 2.6], { frost_mage: 3, frost_apprentice: 2, shadow_apprentice: 1.5, fire_mage: 1 }),
      ev(90, 'swarm', { type: 'frost_apprentice', extra: 'fire_apprentice', count: 32, shape: 'ring' }),
      ph(95, 22, [2.5, 3.2], { frost_mage: 3, fire_mage: 1.5, shadow_apprentice: 1, shadow_mage: .8 }),
      ev(120, 'miniboss', { type: 'frost_master' }),
      ph(124, 26, [3.2, 4], { frost_mage: 3, frost_apprentice: 2, shadow_apprentice: 1, light_apprentice: 1, shadow_mage: .5 }),
      ev(150, 'swarm', { type: 'frost_apprentice', count: 30, shape: 'pincer' }),
      ph(155, 25, [4, 4.6], { frost_mage: 3, fire_mage: 1.5, shadow_apprentice: 1, light_apprentice: .8, shadow_mage: .6 }),
      ev(180, 'elite'),
      ph(182, 20, [4.6, 5.2], { frost_mage: 3, frost_apprentice: 2, shadow_mage: .8, light_apprentice: 1 }),
      ev(195, 'swarm', { type: 'fire_apprentice', count: 16, shape: 'stream' }),
      ph(208, 32, [5.2, 6.2], { frost_mage: 3, frost_apprentice: 2, fire_mage: 1.5, shadow_apprentice: 1, shadow_mage: .6, light_apprentice: .7 }),
      ev(222, 'warn'),
      ev(240, 'boss'),
    ],
    boss: { id: 'frostbart', name: 'Frostbart der Eisweber', minion: 'frost_mage' } },

  { name: 'Aschesteppe', sub: 'Großmagier, Giftmagier und ganze Rudel von Funkenwichteln.', tint: ['#e89a5a', .55], dark: .08, dmg: 1.5, rate: 1.32,
    waves: [
      ph(0, 25, [.6, 1.2], { fire_mage: 2, storm_apprentice: 1 }),
      ph(25, 31, [1.2, 2], { fire_mage: 3, storm_apprentice: 3, fire_apprentice: 1.5 }),
      ev(60, 'elite', { type: 'fire_mage' }),
      ph(62, 28, [2, 2.8], { fire_mage: 3, storm_apprentice: 2, earth_apprentice: 1.5, fire_apprentice: 1 }),
      ev(90, 'swarm', { type: 'fire_apprentice', count: 20, shape: 'stream' }),
      ph(95, 22, [2.6, 3.3], { fire_mage: 3, storm_apprentice: 2, toxic_apprentice: 1.5, earth_apprentice: 1, fire_master: .3 }),
      ev(120, 'miniboss', { type: 'fire_master' }),
      ph(124, 26, [3.3, 4], { fire_mage: 3, storm_mage: 1.5, toxic_apprentice: 1.2, earth_mage: .8, storm_apprentice: 2 }),
      ev(150, 'swarm', { type: 'storm_apprentice', extra: 'fire_apprentice', count: 34, shape: 'ring' }),
      ph(155, 25, [4, 4.8], { fire_mage: 3, storm_mage: 1.5, toxic_apprentice: 1, earth_mage: .8, fire_apprentice: 1.5, storm_master: .2 }),
      ev(180, 'elite'),
      ph(182, 20, [4.8, 5.4], { fire_mage: 3, storm_mage: 2, earth_mage: 1, toxic_apprentice: 1, fire_master: .4 }),
      ev(195, 'swarm', { type: 'fire_apprentice', extra: 'storm_apprentice', count: 36, shape: 'pincer' }),
      ph(208, 32, [5.4, 6.4], { fire_mage: 3, storm_mage: 2, storm_apprentice: 2, earth_mage: 1, toxic_apprentice: 1, fire_master: .4, storm_master: .2 }),
      ev(222, 'warn'),
      ev(240, 'boss'),
    ],
    boss: { id: 'pyra', name: 'Pyra, Herrin der Asche', minion: 'fire_apprentice' } },

  { name: 'Nebelmoor', sub: 'Heilmagier halten die Horde am Leben. Erwisch sie zuerst.', tint: ['#7fa597', .6], dark: .2, dmg: 1.8, rate: 1.58,
    waves: [
      ph(0, 25, [.6, 1.2], { necro_apprentice: 3, fire_mage: 1, frost_mage: 1 }),
      ph(25, 31, [1.3, 2.1], { necro_apprentice: 3, toxic_apprentice: 2, shadow_apprentice: 1.5, fire_mage: 1 }),
      ev(60, 'elite', { type: 'frost_mage' }),
      ph(62, 28, [2.1, 2.9], { necro_apprentice: 3, necro_mage: 1.2, toxic_apprentice: 1.5, toxic_mage: .8, light_apprentice: 1 }),
      ev(90, 'swarm', { type: 'necro_apprentice', count: 34, shape: 'ring' }),
      ph(95, 22, [2.7, 3.4], { necro_apprentice: 2, necro_mage: 1.2, storm_mage: 1.5, toxic_mage: 1, light_apprentice: 1 }),
      ev(120, 'miniboss', { type: 'toxic_master' }),
      ph(124, 26, [3.4, 4.1], { necro_apprentice: 3, necro_mage: 1, storm_mage: 1.5, shadow_apprentice: 1.5, light_apprentice: 1, toxic_master: .2 }),
      ev(150, 'swarm', { type: 'necro_apprentice', extra: 'fire_apprentice', count: 36, shape: 'wall' }),
      ph(155, 25, [5.3, 6.2], { necro_apprentice: 3, necro_mage: 1, toxic_mage: 1, storm_mage: 1.5, light_apprentice: 1, necro_master: .25 }),
      ev(180, 'elite'),
      ph(182, 20, [6.2, 7.0], { necro_apprentice: 2, necro_mage: 1, storm_mage: 1.5, shadow_apprentice: 1, toxic_apprentice: 1, shadow_master: .25 }),
      ev(195, 'swarm', { type: 'shadow_apprentice', count: 18, shape: 'stream' }),
      ph(208, 32, [7.0, 8.3], { necro_apprentice: 3, necro_mage: 1, toxic_mage: 1, storm_mage: 1.5, light_apprentice: 1, necro_master: .25, shadow_master: .25 }),
      ev(222, 'warn'),
      ev(240, 'boss'),
    ],
    boss: { id: 'nebelhexer', name: 'Der Nebelhexer', minion: 'shadow_apprentice' } },

  { name: 'Turm der Magier', sub: 'Blitzmagier und alles andere auf einmal. Der Erzmagier wartet.', tint: ['#9b7ad0', .6], dark: .26, dmg: 1.2, rate: 1.05,
    waves: [
      ph(0, 25, [.7, 1.3], { fire_mage: 2, frost_mage: 2, frost_apprentice: 1.5, storm_apprentice: 1.5 }),
      ph(25, 31, [1.4, 2.2], { storm_mage: 2.5, fire_apprentice: 1.5, shadow_apprentice: 1.5, fire_mage: 1.5, frost_mage: 1.5 }),
      ev(60, 'elite', { type: 'storm_mage' }),
      ph(62, 28, [2.2, 3], { storm_mage: 2.5, earth_mage: .8, light_apprentice: 1, toxic_apprentice: 1.5, fire_master: .5, frost_master: .4 }),
      ev(90, 'swarm', { type: 'storm_apprentice', extra: 'fire_apprentice', count: 36, shape: 'ring' }),
      ph(95, 22, [2.8, 3.6], { storm_mage: 2.5, light_mage: .8, light_apprentice: 1, shadow_mage: .6, fire_mage: 1.5, light_master: .4 }),
      ev(120, 'miniboss', { type: 'earth_master' }),
      ph(124, 26, [3.6, 4.3], { storm_mage: 2.5, frost_mage: 1.5, earth_mage: .8, light_mage: .8, shadow_mage: .6, storm_apprentice: 1.5 }),
      ev(150, 'swarm', { type: 'fire_apprentice', extra: 'storm_apprentice', count: 38, shape: 'pincer' }),
      ph(155, 25, [4.3, 5], { storm_mage: 2.5, fire_mage: 1.5, light_master: .4, storm_master: .3, toxic_apprentice: 1.5, shadow_apprentice: 1.5 }),
      ev(180, 'elite'),
      ph(182, 20, [5, 5.6], { storm_mage: 2.5, frost_mage: 1.5, earth_master: .3, fire_master: .5, light_apprentice: 1, shadow_mage: .6 }),
      ev(195, 'swarm', { type: 'storm_apprentice', count: 20, shape: 'stream' }),
      ph(208, 32, [5.6, 6.6], { storm_mage: 2.5, fire_mage: 2, frost_mage: 2, light_mage: .8, light_master: .5, storm_master: .3, fire_apprentice: 1.5 }),
      ev(222, 'warn'),
      ev(240, 'boss'),
    ],
    boss: { id: 'malvorn', name: 'Erzmagier Malvorn', minion: 'light_apprentice', trophy: 'hat.wizard' } },

  { name: 'Endlose Nacht', sub: 'Kein Ende, alle 4 Minuten ein Boss. Wie lange hältst du durch?', tint: ['#5a6cb0', .62], dark: .32, dmg: 1.7, rate: 1.4, endless: true,
    waves: [
      ph(0, 26, [.8, 1.5], { fire_mage: 2, frost_mage: 2, necro_apprentice: 1.5, frost_apprentice: 1.5, storm_apprentice: 1 }),
      ph(30, 26, [1.5, 2.3], { storm_mage: 2, shadow_apprentice: 1.5, light_apprentice: 1, fire_apprentice: 1.5, toxic_apprentice: 1.5, earth_apprentice: 1 }),
      ev(60, 'elite'),
      ph(62, 28, [2.3, 3.1], { toxic_mage: .8, necro_mage: .8, earth_mage: .8, light_mage: .6, shadow_mage: .6, fire_mage: 2, frost_mage: 2, fire_master: 1 }),
      ev(90, 'swarm', { type: 'necro_apprentice', extra: 'fire_apprentice', count: 36, shape: 'ring' }),
      ph(95, 22, [3, 3.8], { storm_mage: 2, frost_master: .5, storm_master: .3, toxic_master: .4, necro_apprentice: 1.5, storm_apprentice: 1.5 }),
      ev(120, 'miniboss', { type: 'necro_master' }),
      ph(124, 26, [3.8, 4.5], { fire_mage: 2, frost_mage: 2, necro_master: .3, shadow_master: .3, earth_master: .3, light_master: .4, toxic_apprentice: 1.5 }),
      ev(150, 'swarm', { type: 'fire_apprentice', extra: 'necro_apprentice', count: 40, shape: 'pincer' }),
      ph(155, 25, [4.5, 5.2], { storm_mage: 2, toxic_mage: .8, necro_mage: .8, earth_mage: .8, light_mage: .6, shadow_mage: .6, fire_master: 1 }),
      ev(180, 'elite'),
      ph(182, 20, [5.2, 5.8], { fire_mage: 2, frost_mage: 2, storm_master: .3, toxic_master: .4, light_master: .4, frost_apprentice: 1.5, shadow_apprentice: 1.5 }),
      ev(195, 'swarm', { type: 'storm_apprentice', extra: 'fire_apprentice', count: 40, shape: 'wall' }),
      ph(208, 32, [5.8, 6.8], { fire_mage: 2, frost_mage: 2, storm_mage: 2, necro_mage: .8, toxic_mage: .8, fire_master: 1, light_master: .4, shadow_master: .3 }),
      ev(222, 'warn'),
      ev(240, 'boss'),
    ],
    boss: { id: 'random', name: 'Ein zufälliger Boss', minion: 'fire_apprentice' } },
];

// Alle Gegnertypen einer Stage (zum Vorladen der Sprites)
export function stageTypes(st) {
  const out = new Set([st.boss.minion]);
  for (const w of st.waves) {
    if (w.mix) for (const t in w.mix) out.add(t);
    for (const t of [w.type, w.extra]) if (t) out.add(t);
  }
  return [...out];
}
