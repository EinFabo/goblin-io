// ---------- Wiedergeburt und Seelenbaum (Phase 12): reine Funktionen über dem Spielstand ----------
import { ABILITIES, ABILITY_IDS } from '../data/abilities.js';
import { CLASS_IDS, classUnlocked } from '../data/classes.js';
import { SOULS_NM, SOULS_WORLD, SOUL_BRANCHES, SOUL_NODES } from '../data/souls.js';
import { STAGES, STAGE_LEN } from '../data/stages.js';

const cleared = save => i => !!(save.stages[i + 1] && save.stages[i + 1].cleared);
const LAST_WORLD = STAGES.findIndex(s => s.endless) - 1;   // Welt 8 (0-basiert 7)
// Rang eines Knotens; ohne Spielstand (Sim, Tests) 0
export const soulRank = (save, id) => (save && save.rebirth && save.rebirth.spent[id]) || 0;
export const cycle = save => (save && save.rebirth && save.rebirth.n) || 0;

// Altar frei: Boss von Welt 8 besiegt und eine volle Runde Endlose Nacht überlebt
// (die Endlose Nacht zählt je Zyklus: save.rebirth.night)
export const rebirthOpen = save => cleared(save)(LAST_WORLD) && (save.rebirth.night || 0) >= STAGE_LEN;
// Seelen für die nächste Wiedergeburt
export function soulsFor(save) {
  let worlds = 0, nm = 0;
  for (let i = 0; i <= LAST_WORLD; i++) if (cleared(save)(i)) { worlds++; nm += save.stages[i + 1].nmMax || 0; }
  return worlds * SOULS_WORLD + nm * SOULS_NM + Math.floor((save.rebirth.night || 0) / 60);
}
// Ausgegeben, gesamt verdient, frei
const costTo = (id, r) => SOUL_NODES[id].cost.slice(0, r).reduce((a, b) => a + b, 0);
export const soulsSpent = save => Object.entries(save.rebirth.spent).reduce((n, [id, r]) => n + (SOUL_NODES[id] ? costTo(id, r) : 0), 0);
export const soulsFree = save => save.rebirth.souls - soulsSpent(save);
const branchSpent = (save, br) => Object.entries(save.rebirth.spent).reduce((n, [id, r]) => n + (SOUL_NODES[id] && SOUL_NODES[id].br === br ? costTo(id, r) : 0), 0);
// Warum geht der nächste Rang nicht? '' = geht
export function soulWhy(save, id) {
  const N = SOUL_NODES[id], r = soulRank(save, id);
  if (!N) return 'Unbekannt';
  if (r >= N.max) return 'Ausgebaut';
  if (N.req && !soulRank(save, N.req)) return `Erst ${SOUL_NODES[N.req].name}`;
  if (N.branchMin) { const low = Object.keys(SOUL_BRANCHES).find(b => branchSpent(save, b) < N.branchMin); if (low) return `Je Ast ${N.branchMin} Seelen nötig (${SOUL_BRANCHES[low]} fehlt)`; }
  if (soulsFree(save) < N.cost[r]) return `${N.cost[r]} Seelen nötig`;
  return '';
}
export function buySoul(save, id) {
  if (soulWhy(save, id)) return false;
  save.rebirth.spent[id] = soulRank(save, id) + 1; return true;
}

// Pity-Faktor für Truhen (Glücksbringer)
export const pityMul = save => (soulRank(save, 'c_pity') ? .8 : 1);

// Wiedergeburt: Welt-Fortschritt samt Albtraum beginnt neu, alles andere bleibt.
// Was über Welten frei war (Fähigkeiten, Klassen), bleibt frei; Hüte und geschaffte Level zählen für Erfolge weiter.
export function rebirth(save) {
  if (!rebirthOpen(save)) return null;
  const gain = soulsFor(save), c = cleared(save), R = save.rebirth;
  for (const id of ABILITY_IDS) { const u = ABILITIES[id].unlock; if (u && u.stage && c(u.stage - 1) && !save.keep.includes(id)) save.keep.push(id); }
  for (const id of CLASS_IDS) if (classUnlocked(id, c) && !save.clsKeep.includes(id)) save.clsKeep.push(id);
  for (const s of Object.values(save.stages)) for (const l of s.lv || []) { R.hats += l.hats || 0; if (l.hats > 0) R.levels++; }
  R.n++; R.souls += gain; R.best = Math.max(R.best, gain); R.night = 0;
  save.stages = {}; save.map = { si: 0, li: 0, fresh: false, nm: 0 };
  return { gain, n: R.n };
}
