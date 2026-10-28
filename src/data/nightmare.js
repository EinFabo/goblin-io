// ---------- Albtraum-Stufen 1–10 (Phase 12, Wunsch Fabi 2026-10-14; je Welt freigeschaltet, Entscheidung 2026-10-28) ----------
// Stufe 0 = normal. Stufe t einer Welt ist frei, sobald ihr Boss auf Stufe t−1 besiegt ist (Stufe 1: Boss normal besiegt).
export const NM_MAX = 10;
export const nmHp = t => (t > 0 ? 1.8 + .25 * (t - 1) : 1);          // Leben der Gegner und Bosse
export const nmDmg = t => (t > 0 ? 1 + .1 * (t - 1) : 1);            // Schaden an den Goblin
export const nmAffix = t => (t >= 4 ? 1 : 0);                        // eine Elite-Eigenschaft mehr
export const nmMinis = t => (t >= 7 ? 2 : 1);                        // Mini-Bosse je Ereignis
export const nmRageAt = (t, base) => (t >= 9 ? Math.min(base, 120) : base);   // früherer Wut-Timer beim Boss
export const nmGold = t => (t > 0 ? .5 + .1 * t : 0);                // Gold-Zuschlag am Ende
export const nmXp = t => (t > 0 ? 1.5 + .05 * (t - 1) : 1);          // Konto-XP
export const nmChestSteps = t => (t > 0 ? 1 + (t >= 3) + (t >= 6) + (t >= 9) : 0);   // Siegtruhe so viele Stufen besser
export const nmGems = t => 5 + t;                                    // Juwelen beim ersten Sieg einer Stufe je Level
// Höchste wählbare Stufe einer Welt (nmMax = höchste Stufe, auf der ihr Boss besiegt ist)
export const nmCap = nmMax => Math.min(NM_MAX, (nmMax || 0) + 1);
// Kurztext für den Zettel
export const nmInfo = t => t > 0 ? `Gegner +${Math.round((nmHp(t) - 1) * 100)} % Leben${t > 1 ? `, +${Math.round((nmDmg(t) - 1) * 100)} % Schaden` : ''}, Elites mit ${2 + nmAffix(t)} Eigenschaften${t >= 7 ? ', zwei Mini-Bosse' : ''}${t >= 9 ? ', Boss wütet früher' : ''}. Dafür +${Math.round(nmGold(t) * 100)} % Gold, bessere Siegtruhe, ${nmGems(t)} Juwelen beim ersten Sieg.` : '';
