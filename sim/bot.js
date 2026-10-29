// Balance-Bot. Läuft komplett im Browser (wird per page.evaluate übergeben),
// darf also nichts von außen benutzen außer window.GOBLIN.
// step: Länge eines Logikschritts in s (Standard wie im Spiel: 1/60)
// god: Leben jeden Schritt auffüllen (misst in der Endlosen Nacht, ob noch etwas stirbt, statt wann der Bot fällt)
// runes: je Slot eine Liste von Runen-Schlüsseln (['fire.3', 'bolt.3']); die Fähigkeit steht dann auf Level 20 (beide Sockel offen)
// tree: Skill-Tree-Punkte für beide Fähigkeiten (Level 30), z. B. alle Knoten voll (--tree full)
// cls: Goblin-Klasse (Phase 9), Klassen-Level 1; nm: Albtraum-Stufe 0–10 (Phase 12)
export function botRun({ si, li = 0, talents, seed, maxTime = 330, step, loadout = ['rage', 'mech'], acct = 20, god = false, runes = null, tree = null, cls = 'gob', nm = 0, rebirth = 0, mut = [], coop = false, coopHp = 0, coopDmg = 0 }) {
  const G = window.GOBLIN, joy = G.joy, STEP = step || G.STEP;
  G.save.talents = { ...talents }; G.save.loadout = [...loadout]; G.save.profile.level = acct;
  G.save.cls = cls; G.save.classes = {}; G.save.rebirth = { n: rebirth, souls: 0, spent: {}, best: 0, hats: 0, levels: 0 };   // Zyklus ohne Seelenbaum
  G.save.runes = { bag: {}, sock: {} };
  for (const id of loadout) if (id) G.save.abilities[id] = tree ? { lv: 30, xp: 0, pts: { ...tree } } : { lv: 1, xp: 0, pts: {} };
  if (runes) loadout.forEach((id, i) => { if (!id || !runes[i] || !runes[i].length) return; const a = G.save.abilities[id]; a.lv = Math.max(20, a.lv); G.save.runes.sock[id] = [runes[i][0] || null, runes[i][1] || null]; });
  for (let k = 1; k <= 8; k++) G.save.stages[k] = { cleared: true, stars: 0, best: 0, nightmare: false };   // alles freigeschaltet
  // coop (Phase 14b): zwei gleiche Goblins, beide vom Bot gesteuert
  G.newRun(si, seed, li, nm, { mut, coop: coop ? { profs: [G.profileOf(), G.profileOf()], me: 0 } : undefined });
  const run = G.run, P = G.P;
  if (coopHp) run.coopHp = coopHp; if (coopDmg) run.coopDmg = coopDmg;   // Koop-Ausgleich zum Einstellen (--coophp, --coopdmg)
  run.noCont = true;   // kein Weitermachen für Juwelen: die Sim misst den ersten Versuch
  const dmg = {};
  const off = G.events.on('playerHurt', h => { dmg[h.src] = (dmg[h.src] || 0) + h.amount; });
  // Bosskampf: Dauer vom Ende des Auftritts bis zum Sieg
  let bossT0 = null, bossT = null;
  const off2 = G.events.on('bossSpawn', () => { bossT0 = run.time; }), off3 = G.events.on('bossDown', () => { if (bossT0 !== null) bossT = run.time - bossT0; });
  const lvAt = {};
  // Endlose Nacht: je Minute Kills, lebende Gegner, deren Ø Leben, Spieler-Level, Runde
  const mins = []; let k0 = 0;
  const pr = { evo: 0, swap: 0, upW: 1, newW: 2, upP: 3, newP: 4, boon: 4.5, heal: 5, gold: 6 };
  // Beste Karte (Ausrüstung des aktiven Goblins): ab 3 Waffen Aufwertungen vor Neuem
  const bestIdx = c => {
    const ord = c.map((x, i) => i).sort((a, b) => pr[c[a].k] - pr[c[b].k]);
    if (run.weapons.length >= 3) { const u = ord.find(i => c[i].k === 'upW' || c[i].k === 'evo' || c[i].k === 'swap'); if (u !== undefined) return u; }
    return ord[0];
  };
  const pickCard = () => { const c = G.genChoices(); G.choose(c, bestIdx(c)); };
  let abil = 0;
  const steps = Math.round(maxTime / STEP);
  // Lenkrichtung für einen Goblin Q (allein P, im Koop jeder Goblin für sich)
  const steer = Q => {
    // Ausweichen: weg von Gegnern, seitlich an Geschossen vorbei, raus aus Warnkreisen, hin zu Kristallen
    let ax = 0, ay = 0;
    for (const e of run.enemies) { const dx = Q.x - e.x, dy = Q.y - e.y, d2 = dx * dx + dy * dy; if (d2 < 260 * 260) { ax += dx / d2; ay += dy / d2; } }
    let px = 0, py = 0;
    for (const q of run.eproj) {
      const dx = Q.x - q.x, dy = Q.y - q.y, d2 = dx * dx + dy * dy;
      if (d2 < 170 * 170 && (q.vx * dx + q.vy * dy) > 0) {
        const sp = Math.hypot(q.vx, q.vy); let nx = -q.vy / sp, ny = q.vx / sp;
        if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
        px += nx * 3 / Math.sqrt(d2); py += ny * 3 / Math.sqrt(d2);
      }
    }
    const l = Math.hypot(ax, ay) || 1; let vx = ax / l, vy = ay / l; const tx = -vy, ty = vx;
    vx = vx * .7 + tx * .7; vy = vy * .7 + ty * .7;
    if (px || py) { const pl = Math.hypot(px, py); vx = vx * .3 + px / pl * 1.5; vy = vy * .3 + py / pl * 1.5; }
    { const [hx, hy] = G.dangerVec(Q.x, Q.y, 50); px += hx * 2; py += hy * 2; }
    // Anfliegende Giftbeutel: raus aus dem roten Zielkreis (wie ein Mensch, der ihn sieht). Felsen sind harmlos;
    // ihr Einschlag ist eine eigene Bodenwarnung, der dangerVec schon ausweicht
    for (const q of run.eproj) if (q.lob && !q.noZone) { const dx = Q.x - q.tx, dy = Q.y - q.ty, d = Math.hypot(dx, dy) || 1; if (d < 85) { px += dx / d * 3; py += dy / d * 3; } }
    for (const e of run.enemies) if (e.bomber && e.fuse > 0) { const dx = Q.x - e.x, dy = Q.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < 120) { px += dx / d * 3; py += dy / d * 3; } }
    if (px || py) { const pl = Math.hypot(px, py); vx = vx * .3 + px / pl * 1.5; vy = vy * .3 + py / pl * 1.5; }
    if (run.arena) { const cx = run.arena.x - Q.x, cy = run.arena.y - Q.y, cd = Math.hypot(cx, cy); if (cd > 300) { vx += cx / cd; vy += cy / cd; } }
    // Seelengefäße (Knochenhand): zum nächsten hin, bis ~110 px
    const bs = run.boss, ves = bs && bs.vessels ? bs.vessels.filter(v => !v.dead) : [];
    if (ves.length) { const v = ves.reduce((a, c) => (Math.hypot(c.x - Q.x, c.y - Q.y) < Math.hypot(a.x - Q.x, a.y - Q.y) ? c : a)); const gx = v.x - Q.x, gy = v.y - Q.y, gd = Math.hypot(gx, gy) || 1; if (gd > 110) { vx += gx / gd * 1.6; vy += gy / gd * 1.6; } }
    // Eisschild: im Bogen (Abstand ~160 px) hinter den Boss laufen
    if (bs && bs.ice > 0) {
      const rx = Q.x - bs.x, ry = Q.y - bs.y, rd = Math.hypot(rx, ry) || 1;
      let da = Math.atan2(ry, rx) - (bs.fa + Math.PI); da = Math.atan2(Math.sin(da), Math.cos(da));   // (Bot läuft im Browser ohne Module, daher kein angDiff)
      const dir = da > 0 ? -1 : 1, rr = (160 - rd) / 60;
      vx += -ry / rd * dir * 1.6 + rx / rd * rr; vy += rx / rd * dir * 1.6 + ry / rd * rr;
    }
    let gem = null, gd = 1e12;
    for (const it of run.items) { if (it.k === 'bomb' || it.k === 'magnet') continue; const d = (it.x - Q.x) ** 2 + (it.y - Q.y) ** 2; if (d < gd && d < 350 * 350) { gd = d; gem = it; } }
    if (gem) { const dx = gem.x - Q.x, dy = gem.y - Q.y, d = Math.hypot(dx, dy) || 1; vx += dx / d * .8; vy += dy / d * .8; }
    return [vx, vy];
  };
  // Koop: je Goblin ein Eingabe-Datensatz; liegt der Partner, läuft der andere zu ihm (Wiederbeleben)
  const coopStep = () => {
    let n = 0;
    const inps = run.players.map((Q, k) => {
      G.activate(k);
      const o = run.players[1 - k];
      let [vx, vy] = steer(Q);
      if (o.down) { const dx = o.x - Q.x, dy = o.y - Q.y, d = Math.hypot(dx, dy) || 1; if (d > 30) { vx = dx / d * 1.5 + vx * .3; vy = dy / d * 1.5 + vy * .3; } }
      const L = run.lvl, inp = { mx: vx, my: vy, sprint: false, dash: Q.dashN > 0 && Q.hp < Q.maxHp * .5, ab0: G.abilReady(run.abil[0]), ab1: G.abilReady(run.abil[1]), skip: false, pick: L && L.offers[k] ? bestIdx(L.offers[k]) : -1 };
      return inp;
    });
    G.activate(run.me);
    if (god) for (const Q of run.players) Q.hp = Q.maxHp;
    // Einsätze zählen: Ladung danach leer (Bot-Statistik „Fähigk.“, wie allein je Lauf und Goblin gemittelt)
    const before = run.players.map((Q, k) => { G.activate(k); const r = run.abil.map(s => s && G.abilReady(s)); G.activate(run.me); return r; });
    G.update(STEP, inps);
    run.players.forEach((Q, k) => { G.activate(k); run.abil.forEach((s, j) => { if (before[k][j] && inps[k]['ab' + j] && !G.abilReady(s)) n += .5; }); G.activate(run.me); });
    return n;
  };
  for (let i = 0; i < steps && !run.over; i++) {
    if (coop) { abil += coopStep(); } else {
      const [vx, vy] = steer(P);
      joy.id = 1; joy.ox = 0; joy.oy = 0; joy.x = vx * 55; joy.y = vy * 55;
      if (P.dashN > 0 && P.hp < P.maxHp * .5) G.doDash();
      for (let k = 0; k < 2; k++) if (G.abilReady(run.abil[k]) && G.useAbility(k)) abil++;
      if (god) P.hp = P.maxHp;
      G.update(STEP);
    }
    if (run.lvDelay > 0) { run.lvDelay = 0; if (coop) G.startCoopLevel(run.lvKind); else pickCard(); }
    const m = Math.floor(run.time / 60);
    if (m >= 1 && !(m in lvAt)) {
      lvAt[m] = P.lv;
      const al = run.enemies.filter(e => !e.dead && !e.boss);
      mins.push({ k: run.kills - k0, n: al.length, hp: al.length ? al.reduce((s, e) => s + e.hp, 0) / al.length : 0, lv: P.lv, loop: run.loop, boss: !!run.boss });
      k0 = run.kills;
    }
  }
  joy.id = null; off(); off2(); off3();
  const win = coop ? !!(run.result && run.result.win) : !!(run.over && P.hp > 0);
  return {
    win, t: Math.round(run.time), mins, bossT, bonus: run.bonusLv, lv: P.lv, kills: run.kills, gold: run.gold, abil, lvAt, dmg,
    weapons: run.weapons.map(w => w.id + w.lv + (w.evo ? '*' : '')).join(','),
  };
}
