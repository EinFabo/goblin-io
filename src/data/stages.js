// ---------- Stages ----------
export const STAGE_LEN = 240;
export const STAGES = [
  { name: 'Goblinwiese', sub: 'Feuermagier und erste Funkenwichtel.', tint: null, dark: 0, hp: 1, dmg: 1, rate: 1,
    mix: [['fire', 5, 0], ['imp', 3, 25], ['frost', 1.2, 110], ['bomber', 1, 150]],
    boss: { name: 'Ignaz der Funkenmeister', school: 'fire', kind: 'fire', tint: null, minion: 'imp' } },
  { name: 'Frostlichtung', sub: 'Frostmagier bremsen dich, Schattenmagier tauchen neben dir auf.', tint: ['#a8d8ff', .5], dark: .05, hp: 1.25, dmg: 1.15, rate: 1.08,
    mix: [['frost', 5, 0], ['imp', 3, 20], ['fire', 1.5, 80], ['void', 1, 60], ['healer', .7, 140]],
    boss: { name: 'Frostbart der Eisweber', school: 'frost', kind: 'frost', tint: null, minion: 'frost' } },
  { name: 'Aschesteppe', sub: 'Großmagier, Giftmagier und ganze Rudel von Funkenwichteln.', tint: ['#e89a5a', .55], dark: .08, hp: 1.5, dmg: 1.3, rate: 1.16,
    mix: [['fire', 4, 0], ['imp', 3, 15], ['bomber', 2, 30], ['brute', 1.2, 50], ['toxic', 1.2, 100], ['storm', 1, 130]],
    boss: { name: 'Pyra, Herrin der Asche', school: 'fire', kind: 'fire', tint: 'ember', minion: 'bomber' } },
  { name: 'Nebelmoor', sub: 'Heilmagier halten die Horde am Leben. Erwisch sie zuerst.', tint: ['#7fa597', .6], dark: .2, hp: 1.8, dmg: 1.45, rate: 1.24,
    mix: [['fire', 2, 0], ['frost', 2, 0], ['imp', 4, 10], ['toxic', 2, 30], ['void', 2, 40], ['healer', 1, 80], ['brute', 1.2, 60], ['storm', 1.5, 90]],
    boss: { name: 'Der Nebelhexer', school: 'shadow', kind: 'frost', tint: null, minion: 'void' } },
  { name: 'Turm der Magier', sub: 'Blitzmagier und alles andere auf einmal. Der Erzmagier wartet.', tint: ['#9b7ad0', .6], dark: .26, hp: 2.1, dmg: 1.6, rate: 1.32,
    mix: [['fire', 2, 0], ['frost', 2, 0], ['imp', 3, 0], ['storm', 2.5, 20], ['void', 1.5, 40], ['healer', 1, 60], ['brute', 2, 40], ['bomber', 1.5, 30], ['toxic', 1.5, 60]],
    boss: { name: 'Erzmagier Malvorn', school: 'light', kind: 'both', tint: null, minion: 'healer' } },
  { name: 'Endlose Nacht', sub: 'Kein Ende, alle 4 Minuten ein Boss. Wie lange hältst du durch?', tint: ['#5a6cb0', .62], dark: .32, hp: 2.3, dmg: 1.7, rate: 1.4, endless: true,
    mix: [['fire', 2, 0], ['frost', 2, 0], ['imp', 3, 0], ['storm', 2, 0], ['void', 1.5, 0], ['healer', 1, 0], ['brute', 2, 0], ['bomber', 1.5, 0], ['toxic', 1.5, 0]],
    boss: { name: 'Erzmagier Malvorn', school: 'light', kind: 'both', tint: null, minion: 'bomber' } },
];
