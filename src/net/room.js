// Koop-Raum, Spielseite (PLAN.md Phase 14d): Raum anlegen, mit Code beitreten, Lobby (Partner, Ping), Start.
// Der Raum selbst ist ein Durable Object im Worker (cloud/src/room.js). Im Spiel liefert die Verbindung dem
// Gleichschritt (net/lockstep.js) link = { send, onMessage }; was ankommt, bevor er zuhört, wird gepuffert.
import { API } from '../cloud.js';

// Spielversion aus package.json (tools/build.mjs): nur gleiche Versionen rechnen gleich
export const VERSION = typeof __GAME_VERSION__ !== 'undefined' ? __GAME_VERSION__ : 'dev';
export const ERR = {
  nf: 'Diesen Raum gibt es nicht (mehr).', full: 'Der Raum ist schon voll.', started: 'In diesem Raum läuft schon ein Spiel.',
  version: 'Ihr habt verschiedene Spielversionen – bitte beide aktualisieren.', alone: 'Warte, bis dein Partner da ist.',
  bad: 'Verbindung gestört.', net: 'Keine Verbindung zum Server.',
};

// Vorlauf in Ticks aus den Rundlaufzeiten beider zum Raum: eine Richtung A → Raum → B ≈ (rttA + rttB) / 2,
// mit Aufschlag für Schwankungen. Zu knapp: das Spiel wartet (ruckelt); zu viel: Eingaben kommen später an.
export const delayFor = (rttA, rttB) => Math.max(3, Math.min(12, Math.ceil((rttA + rttB) / 2 * 1.25 / (1000 / 60)) + 2));

export async function createRoom() {
  let r;
  try { r = await fetch(API + '/api/room', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: VERSION }) }); }
  catch (_) { throw new Error(ERR.net); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.code) throw new Error(j.error || ERR.net);
  return j.code;
}

// cb: onRoom({ you, players }), onStart(start), onError(text), onClose()
export function joinRoom(code, prof, cb = {}) {
  const base = (API || location.origin).replace(/^http/, 'ws');
  const ws = new WebSocket(`${base}/api/room/${encodeURIComponent(code.toUpperCase())}`);
  let handler = null, inGame = false, closed = false, ping = 0, rttSent = -100;   // erste Messung immer melden
  const queue = [], R = { code: code.toUpperCase(), rtt: 0, room: null };
  const send = m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const deliver = m => (handler ? handler(m) : queue.push(m));
  ws.onopen = () => {
    send({ k: 'hello', v: VERSION, prof });
    // Ping in der Lobby (einmal je Sekunde); der Vorlauf richtet sich danach
    ping = setInterval(() => send({ k: 'ping', t: performance.now() }), 1000);
    send({ k: 'ping', t: performance.now() });
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch (_) { return; }
    if (m.k === 'pong') {
      const ms = performance.now() - m.t;
      R.rtt = R.rtt ? R.rtt * .7 + ms * .3 : ms;
      if (Math.abs(R.rtt - rttSent) >= 10) { rttSent = R.rtt; send({ k: 'rtt', ms: R.rtt }); }
    } else if (m.k === 'room') { R.room = m; if (cb.onRoom) cb.onRoom(m); }
    else if (m.k === 'err') { if (cb.onError) cb.onError(ERR[m.why] || ERR.bad); }
    else if (m.k === 'start') { inGame = true; clearInterval(ping); if (cb.onStart) cb.onStart(m); }
    // Partner weg: im Spiel wie sein Abschied, in der Lobby zeigt die Liste es
    else if (m.k === 'left') { if (inGame) deliver({ k: 'bye' }); }
    else if (m.k === 'in' || m.k === 'hash' || m.k === 'bye') deliver(m);
  };
  ws.onclose = () => {
    clearInterval(ping);
    if (closed) return; closed = true;
    if (inGame) deliver({ k: 'bye' });   // eigene Leitung weg: allein weiter
    if (cb.onClose) cb.onClose();
  };
  return Object.assign(R, {
    link: { send, onMessage: fn => { handler = fn; while (queue.length) fn(queue.shift()); } },
    // Nur der Gastgeber (Platz 0): Level und Seed festlegen, Vorlauf aus beiden Pings
    start({ si, li, nm, seed }) {
      const ps = (R.room && R.room.players) || [], other = ps.find(p => p.slot !== R.room.you);
      send({ k: 'start', si, li, nm: nm | 0, seed, delay: delayFor(R.rtt, other ? other.rtt : R.rtt) });
    },
    close() { closed = true; clearInterval(ping); try { ws.close(1000); } catch (_) { /* schon zu */ } },
  });
}
