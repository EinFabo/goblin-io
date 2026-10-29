// Koop-Raum (PLAN.md Phase 14d): ein Durable Object je Code (4 Buchstaben), höchstens zwei Spieler.
// Der Raum rechnet nichts: die Spiele rechnen im Gleichschritt (src/net/lockstep.js), er reicht nur Nachrichten weiter.
// WebSockets mit Hibernation: zwischen Nachrichten (Lobby) darf das Objekt schlafen. Wer welcher Platz ist, steht im
// Anhang des Sockets (serializeAttachment), Profile und Raumdaten im Speicher – beides übersteht das Schlafen.
//
// Spiel → Raum: hello { v, prof } · ping { t } · rtt { ms } · start { si, li, nm, seed, delay } (nur Platz 0) · in/hash/bye (weiter)
// Raum → Spiel: room { you, players } · pong { t } · start { …, profs, me } · left { slot } · err { why, need? } · in/hash/bye
// Ohne Import aus cloudflare:workers (Hibernation braucht ihn nicht), damit test/room.test.js es in Node prüfen kann.
export const ROOM_TTL = 30 * 60 * 1000, MAX_MSG = 64 * 1024, CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const RELAY = new Set(['in', 'hash', 'bye']);

export const newCode = (rnd = Math.random) => Array.from({ length: 4 }, () => CODE_ABC[Math.floor(rnd() * CODE_ABC.length)]).join('');
export const validCode = c => typeof c === 'string' && c.length === 4 && [...c].every(ch => CODE_ABC.includes(ch));

export class Room {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  // Worker → Raum: /create legt an (frisch: ok), sonst WebSocket für einen Spieler
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/create') {
      const { v } = await req.json().catch(() => ({}));
      return Response.json({ ok: await this.create(String(v || '')) });
    }
    const [client, server] = Object.values(new WebSocketPair());
    await this.join(server);
    return new Response(null, { status: 101, webSocket: client });
  }
  async create(version) {
    const S = this.ctx.storage;
    if (await S.get('meta')) return false;   // Code schon vergeben
    await S.put('meta', { version, created: Date.now(), started: false });
    await S.setAlarm(Date.now() + ROOM_TTL);
    return true;
  }
  async join(ws) {
    this.ctx.acceptWebSocket(ws);
    ws.serializeAttachment({ slot: -1 });
    if (!(await this.ctx.storage.get('meta'))) this.fail(ws, 'nf');
  }

  // Spieler im Raum (Platz 0/1); ohne den gerade schließenden Socket
  seated(except = null) { return this.ctx.getWebSockets().filter(s => s !== except && slotOf(s) >= 0); }
  fail(ws, why, extra = {}) { send(ws, { k: 'err', why, ...extra }); try { ws.close(4000, why); } catch (_) { /* schon zu */ } }
  async roster(except = null) {
    const socks = this.seated(except), players = [];
    for (const s of socks) {
      const a = s.deserializeAttachment(), p = (await this.ctx.storage.get('prof:' + a.slot)) || {};
      // nur einfache Werte weitergeben (die Spiele escapen trotzdem, das Profil kommt ungeprüft vom Spieler)
      players.push({ slot: a.slot, name: String(typeof p.name === 'string' ? p.name : 'Goblin').slice(0, 16), cls: String(typeof p.cls === 'string' ? p.cls : 'gob').slice(0, 12), clsLv: Math.max(1, Math.min(30, p.clsLv | 0)), rtt: a.rtt || 0 });
    }
    players.sort((a, b) => a.slot - b.slot);
    for (const s of socks) send(s, { k: 'room', you: slotOf(s), players });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG) { this.fail(ws, 'bad'); return; }
    let m; try { m = JSON.parse(raw); } catch (_) { this.fail(ws, 'bad'); return; }
    if (!m || typeof m !== 'object') return;
    const slot = slotOf(ws);
    // Während des Spiels: Eingaben, Prüfsummen und Abschied ungeprüft zum Partner (häufig, also ohne Speicherzugriff)
    if (RELAY.has(m.k)) { if (slot >= 0) for (const s of this.seated(ws)) s.send(raw); return; }
    if (m.k === 'ping') { send(ws, { k: 'pong', t: m.t }); return; }
    if (m.k === 'rtt' && slot >= 0) {
      const a = ws.deserializeAttachment(), ms = Math.max(0, Math.min(5000, Math.round(+m.ms || 0)));
      if (a.rtt == null || Math.abs(a.rtt - ms) >= 10) { ws.serializeAttachment({ ...a, rtt: ms }); await this.roster(); }   // erste Messung immer
      return;
    }
    const meta = await this.ctx.storage.get('meta');
    if (!meta) { this.fail(ws, 'nf'); return; }
    if (m.k === 'hello' && slot < 0) {
      if (String(m.v || '') !== meta.version) { this.fail(ws, 'version', { need: meta.version }); return; }
      if (meta.started) { this.fail(ws, 'started'); return; }
      const taken = new Set(this.seated(ws).map(slotOf));
      const free = [0, 1].find(i => !taken.has(i));
      if (free === undefined) { this.fail(ws, 'full'); return; }
      if (!m.prof || typeof m.prof !== 'object') { this.fail(ws, 'bad'); return; }
      await this.ctx.storage.put('prof:' + free, m.prof);
      ws.serializeAttachment({ slot: free, rtt: null });
      await this.roster();
      return;
    }
    if (m.k === 'start' && slot === 0 && !meta.started) {
      const socks = this.seated();
      if (socks.length < 2) { send(ws, { k: 'err', why: 'alone' }); return; }
      const profs = [await this.ctx.storage.get('prof:0'), await this.ctx.storage.get('prof:1')];
      await this.ctx.storage.put('meta', { ...meta, started: true });
      const run = { si: m.si | 0, li: m.li | 0, nm: m.nm | 0, seed: m.seed >>> 0, delay: Math.max(2, Math.min(15, m.delay | 0)) };
      for (const s of socks) send(s, { k: 'start', ...run, profs, me: slotOf(s) });
    }
  }

  async webSocketClose(ws) {
    try { ws.close(1000, 'bye'); } catch (_) { /* schon zu */ }
    const slot = slotOf(ws); if (slot < 0) return;
    ws.serializeAttachment({ slot: -1 });
    const rest = this.seated(ws), meta = await this.ctx.storage.get('meta');
    for (const s of rest) send(s, { k: 'left', slot });
    if (meta && meta.started) { if (!rest.length) await this.clear(); return; }
    // Lobby: Platz wird frei, ein anderer darf ihn nehmen. Ging der Gastgeber, wird der andere Gastgeber (nur Platz 0 startet)
    await this.ctx.storage.delete('prof:' + slot);
    if (slot === 0) for (const s of rest) {
      const a = s.deserializeAttachment(); if (a.slot !== 1) continue;
      await this.ctx.storage.put('prof:0', await this.ctx.storage.get('prof:1')); await this.ctx.storage.delete('prof:1');
      s.serializeAttachment({ ...a, slot: 0 });
    }
    await this.roster(ws);
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }

  // Verfall: nach ROOM_TTL weg, außer es spielt noch jemand (dann später nochmal schauen)
  async alarm() {
    if (this.ctx.getWebSockets().length) await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL);
    else await this.clear();
  }
  async clear() { await this.ctx.storage.deleteAlarm(); await this.ctx.storage.deleteAll(); }
}

function slotOf(ws) { const a = ws.deserializeAttachment(); return a && typeof a.slot === 'number' ? a.slot : -1; }
function send(ws, m) { try { ws.send(JSON.stringify(m)); } catch (_) { /* Socket schon zu */ } }
