// Koop im Gleichschritt (Phase 14c): beide Rechner rechnen dieselbe Sim, ausgetauscht werden nur Eingaben.
// Die eigene Eingabe für Tick t wird erfasst, sobald Tick t − DELAY dran ist, und sofort geschickt; gerechnet wird
// ein Tick erst, wenn die Eingaben beider Goblins dafür da sind. Alle HASH_EVERY Ticks vergleichen beide die Prüfsumme.
// Ohne DOM und ohne Netz: link ist die Verbindung ({ send(msg), onMessage(fn) }), tick rechnet einen Schritt
// (scenes/run.js simStep), take liefert die eigene Eingabe (core/input.js), hash die Prüfsumme (game/run.js simHash).
export const DELAY = 4, HASH_EVERY = 60, WAIT_SHOW = .5, WAIT_GIVEUP = 15, CATCH_UP = 2;
export const NO_INPUT = Object.freeze({ mx: 0, my: 0, sprint: false, dash: false, ab0: false, ab1: false, skip: false, pick: -1 });

// Eingabe kompakt als [t, mx, my, Knöpfe, pick]. Richtung auf 1/100 gerundet: beide rechnen mit genau der Zahl, die übers Netz geht.
const q = v => Math.round(Math.max(-2, Math.min(2, v || 0)) * 100) / 100;
export const pack = (t, i) => [t, q(i.mx), q(i.my), (i.sprint ? 1 : 0) | (i.dash ? 2 : 0) | (i.ab0 ? 4 : 0) | (i.ab1 ? 8 : 0) | (i.skip ? 16 : 0), i.pick | 0];
export const unpack = a => ({ mx: a[1], my: a[2], sprint: !!(a[3] & 1), dash: !!(a[3] & 2), ab0: !!(a[3] & 4), ab1: !!(a[3] & 8), skip: !!(a[3] & 16), pick: a[4] });

// Vorlauf delay (Ticks): muss die Verzögerung einer Richtung decken, sonst wartet die Sim; beide müssen denselben nehmen
// (der Raum legt ihn nach dem Ping fest, net/room.js). me: eigener Goblin (0/1). Rückmeldungen: onWait(s) (Sekunden ohne Partner-Eingabe, 0 = läuft wieder),
// onDesync(t) (Prüfsummen weichen ab), onGone() (Partner weg: Abschied oder WAIT_GIVEUP s still).
export function createLockstep({ me, link, tick, take, hash, delay = DELAY, onWait = () => {}, onDesync = () => {}, onGone = () => {} }) {
  const other = 1 - me, inputs = [new Map(), new Map()], sums = new Map();
  let T = 0, waited = 0, gone = false, broken = false;
  // Die ersten delay Ticks hat niemand eine Eingabe geschickt: beide stehen
  for (let t = 0; t < delay; t++) { inputs[0].set(t, NO_INPUT); inputs[1].set(t, NO_INPUT); }
  link.onMessage(m => {
    if (!m || broken) return;
    if (m.k === 'in' && Array.isArray(m.a)) { if (m.a[0] >= T) inputs[other].set(m.a[0], unpack(m.a)); }
    else if (m.k === 'hash') compare(m.t, 'theirs', m.h);
    else if (m.k === 'bye') leave();
  });
  function leave() { if (gone) return; gone = true; waited = 0; onWait(0); onGone(); }
  function compare(t, who, h) {
    const s = sums.get(t) || {}; s[who] = h; sums.set(t, s);
    if (s.mine === undefined || s.theirs === undefined) return;
    sums.delete(t);
    if (s.mine !== s.theirs && !broken) { broken = true; onDesync(t); }
  }
  // Eigene Eingabe für T + delay einmal erfassen und schicken (wartet die Sim, sammelt core/input.js weiter)
  function capture() {
    const t = T + delay; if (inputs[me].has(t)) return;
    const a = pack(t, take()); inputs[me].set(t, unpack(a));
    if (!gone) link.send({ k: 'in', a });
  }
  function runOne(step) {
    const inps = [];
    inps[me] = inputs[me].get(T); inps[other] = gone ? NO_INPUT : inputs[other].get(T);
    inputs[0].delete(T); inputs[1].delete(T);
    tick(step, inps);
    T++;
    if (T % HASH_EVERY === 0 && !gone) { const h = hash(); link.send({ k: 'hash', t: T, h }); compare(T, 'mine', h); }
  }
  return {
    get t() { return T; },
    get gone() { return gone; },
    get broken() { return broken; },
    // Ein Schritt der Spielschleife (60 Hz): höchstens CATCH_UP Ticks, wenn wir hinter dem Partner liegen
    frame(step) {
      if (broken) return 0;
      let n = 0;
      while (n < CATCH_UP) {
        capture();
        if (!gone && !inputs[other].has(T)) {
          if (n) break;
          waited += step; onWait(waited);
          if (waited >= WAIT_GIVEUP) leave();
          return 0;
        }
        if (waited) { waited = 0; onWait(0); }
        runOne(step); n++;
        if (broken || gone || !inputs[other].has(T + delay)) break;   // nur aufholen, wenn der Partner weit voraus ist
      }
      return n;
    },
    // Eigener Abschied (Lauf verlassen): der Partner spielt allein weiter
    bye() { if (!gone) link.send({ k: 'bye' }); gone = true; },
  };
}
