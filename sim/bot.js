// Balance-Bot. Läuft komplett im Browser (wird per page.evaluate übergeben),
// darf also nichts von außen benutzen außer window.GOBLIN.
// step: Länge eines Logikschritts in s (Standard wie im Spiel: 1/60)
export function botRun({ si, talents, seed, maxTime = 330, step, loadout = ['rage', 'mech'], acct = 20 }) {
  const G = window.GOBLIN, joy = G.joy, STEP = step || G.STEP;
  G.save.talents = { ...talents }; G.save.loadout = [...loadout]; G.save.profile.level = acct;
  for (let k = 1; k <= 8; k++) G.save.stages[k] = { cleared: true, stars: 0, best: 0, nightmare: false };   // alles freigeschaltet
  G.newRun(si, seed);
  const run = G.run, P = G.P;
  const dmg = {};
  const off = G.events.on('playerHurt', h => { dmg[h.src] = (dmg[h.src] || 0) + h.amount; });
  const lvAt = {};
  const pr = { evo: 0, upW: 1, newW: 2, upP: 3, newP: 4, heal: 5, gold: 6 };
  const pickCard = () => {
    const c = G.genChoices(), ord = c.map((x, i) => i).sort((a, b) => pr[c[a].k] - pr[c[b].k]);
    if (run.weapons.length >= 3) { const u = ord.find(i => c[i].k === 'upW' || c[i].k === 'evo'); if (u !== undefined) return G.choose(c, u); }
    G.choose(c, ord[0]);
  };
  let abil = 0;
  const steps = Math.round(maxTime / STEP);
  for (let i = 0; i < steps && !run.over; i++) {
    // Ausweichen: weg von Gegnern, seitlich an Geschossen vorbei, raus aus Warnkreisen, hin zu Kristallen
    let ax = 0, ay = 0;
    for (const e of run.enemies) { const dx = P.x - e.x, dy = P.y - e.y, d2 = dx * dx + dy * dy; if (d2 < 260 * 260) { ax += dx / d2; ay += dy / d2; } }
    let px = 0, py = 0;
    for (const q of run.eproj) {
      const dx = P.x - q.x, dy = P.y - q.y, d2 = dx * dx + dy * dy;
      if (d2 < 170 * 170 && (q.vx * dx + q.vy * dy) > 0) {
        const sp = Math.hypot(q.vx, q.vy); let nx = -q.vy / sp, ny = q.vx / sp;
        if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
        px += nx * 3 / Math.sqrt(d2); py += ny * 3 / Math.sqrt(d2);
      }
    }
    const l = Math.hypot(ax, ay) || 1; let vx = ax / l, vy = ay / l; const tx = -vy, ty = vx;
    vx = vx * .7 + tx * .7; vy = vy * .7 + ty * .7;
    if (px || py) { const pl = Math.hypot(px, py); vx = vx * .3 + px / pl * 1.5; vy = vy * .3 + py / pl * 1.5; }
    { const [hx, hy] = G.dangerVec(P.x, P.y, 50); px += hx * 2; py += hy * 2; }
    for (const e of run.enemies) if (e.bomber && e.fuse > 0) { const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < 120) { px += dx / d * 3; py += dy / d * 3; } }
    if (px || py) { const pl = Math.hypot(px, py); vx = vx * .3 + px / pl * 1.5; vy = vy * .3 + py / pl * 1.5; }
    if (run.arena) { const cx = run.arena.x - P.x, cy = run.arena.y - P.y, cd = Math.hypot(cx, cy); if (cd > 300) { vx += cx / cd; vy += cy / cd; } }
    let gem = null, gd = 1e12;
    for (const it of run.items) { if (it.k === 'bomb' || it.k === 'magnet') continue; const d = (it.x - P.x) ** 2 + (it.y - P.y) ** 2; if (d < gd && d < 350 * 350) { gd = d; gem = it; } }
    if (gem) { const dx = gem.x - P.x, dy = gem.y - P.y, d = Math.hypot(dx, dy) || 1; vx += dx / d * .8; vy += dy / d * .8; }
    joy.id = 1; joy.ox = 0; joy.oy = 0; joy.x = vx * 55; joy.y = vy * 55;

    if (P.dashCd <= 0 && P.hp < P.maxHp * .5) G.doDash();
    for (let k = 0; k < 2; k++) if (G.abilReady(run.abil[k]) && G.useAbility(k)) abil++;
    G.update(STEP);
    if (run.lvDelay > 0) { run.lvDelay = 0; pickCard(); }
    const m = Math.floor(run.time / 60);
    if (m >= 1 && !(m in lvAt)) lvAt[m] = P.lv;
  }
  joy.id = null; off();
  const win = !!(run.over && P.hp > 0);
  return {
    win, t: Math.round(run.time), lv: P.lv, kills: run.kills, gold: run.gold, abil, lvAt, dmg,
    weapons: run.weapons.map(w => w.id + w.lv + (w.evo ? '*' : '')).join(','),
  };
}
