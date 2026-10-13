// ---------- Kraftkurve (PLAN 7.3, Formeln 14.3) ----------
// Alle Balance-Formeln an einer Stelle. Rein, ohne Lauf-Zustand, damit Tests sie direkt prüfen können.
import { STAGES } from '../data/stages.js';

// Ziel-Level nach Sekunden im Lauf; nach 4:00 (Endlos) 4 Level pro Minute weiter
export const LEVEL_CURVE = [[0, 1], [30, 3], [60, 6], [120, 11], [180, 16], [240, 20]];
export function targetLevel(t) {
  const C = LEVEL_CURVE, last = C[C.length - 1];
  if (t >= last[0]) return last[1] + (t - last[0]) / 15;
  for (let i = 1; i < C.length; i++) if (t <= C[i][0]) { const [t0, l0] = C[i - 1], [t1, l1] = C[i]; return l0 + (l1 - l0) * (t - t0) / (t1 - t0); }
  return C[0][1];
}

// Sanftes Gummiband: wer hinterher ist, bekommt mehr XP, wer weit vorne ist, etwas weniger
export function xpCatchUp(t, lv) {
  const diff = targetLevel(t) - lv;
  return diff >= 3 ? 1.35 : diff >= 2 ? 1.2 : diff <= -3 ? .85 : 1;
}

export const xpNeed = l => Math.round(4 + l * 3 + l * l * 0.3);

// Gegner-Leben: Grundwert × Welt × Zeitkurve. Welt-Index 0…7; die Endlose Nacht (Index 8) hat ihren eigenen Wert
// (wie früher, als sie Index 5 war). stageHp nie über das Ende der Tabelle hinaus (sonst NaN-Leben, unbesiegbar).
export const STAGE_HP = [1, 1.25, 1.5, 1.8, 2.1, 2.4, 2.8, 3.2];
export const ENDLESS_HP = 2.4;
export const stageHp = si => (STAGES[si] && STAGES[si].endless ? ENDLESS_HP : STAGE_HP[Math.min(Math.max(0, si), STAGE_HP.length - 1)]);
export const HP_T1 = .012, HP_T2 = .000035;
export const hpTime = t => 1 + HP_T1 * t + HP_T2 * t * t;
export const enemyHp = (base, si, t) => base * stageHp(si) * hpTime(t);

// Spielerschaden gedeckelt nach Art: niemand stirbt in einer Sekunde durch Pech
export const DMG_CAP = { contact: .08, proj: .12, special: .25 };
export const capKind = src => src === 'contact' ? 'contact' : src === 'proj' ? 'proj' : 'special';
export const hitDamage = (raw, maxHp, src) => Math.min(raw, maxHp * DMG_CAP[capKind(src)]);

// Konto-XP pro Lauf (14.3)
// Level einer Welt (6.1a) sind kürzer: Sieg-/Erstsieg-Bonus voll nur für Boss-Level (und Endlos)
export const accountXp = ({ kills, seconds, win, firstClear, boss = true }) => Math.floor(kills / 10 + seconds / 4) + (win ? (boss ? 100 : 40) : 0) + (firstClear ? (boss ? 200 : 50) : 0);
export const accountXpNeed = L => 200 + 60 * L + 8 * L * L;

// Bonus-Level (Wunsch Fabi): was nach „Level geschafft“ noch an Level-Ups kommt, wird zur Belohnung statt zu Karten,
// die nichts mehr bringen. Je Bonus-Level Gold, ab 4 ein Kartenpaket, je volle 6 ein Juwel.
// Typisch (Sim): 2–4 Bonus-Level in Level 1–4, 5–8 im Boss-Level → etwa halb so viel wie die Level-Belohnung.
export const bonusReward = (n, si) => ({ gold: n * (8 + 5 * si), cards: n >= 4 ? 1 + (si >> 1) : 0, gems: Math.floor(n / 6) });
