const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  p.on('pageerror', e => console.log('PAGEERR ' + e.message));
  await p.goto('file://'+require("path").resolve(__dirname,"../goblin-io.html")+'');
  await p.waitForSelector('#menu:not([hidden])');
  for (const [si, shop] of [[0, {}], [1, {}], [2, {}], [2, {atk:4,hp:4}], [3, {atk:6,hp:6}], [4, {atk:8,hp:8,spd:3}]]) {
    const r = await p.evaluate(([si, shop]) => {
      save.shop = shop;
      newRun(si);
      openLevelUp = function () { const c = genChoices(); const pr = {evo:0, upW:1, newW:2, upP:3, newP:4, heal:5, gold:6}; c.sort((a,b)=>pr[a.k]-pr[b.k]); if (run.weapons.length >= 3) { const u = c.find(x=>x.k==='upW'||x.k==='evo'); if (u) return applyChoice(u); } applyChoice(c[0]); };
      window.DMG = {contact:0, proj:0, boss:0, bomb:0, tele:0}; window.MECHN = 0; const _dp = window._dp0 || (window._dp0 = damagePlayer); damagePlayer = function (d) { const h = P.hp; _dp(d); const st = new Error().stack; const k = run.boss ? 'boss' : st.includes('updEProj') ? 'proj' : st.includes('bomberBoom') ? 'bomb' : st.includes('updTele') ? 'tele' : 'contact'; DMG[k] += h - P.hp; };
      const log = []; let t0 = performance.now();
      const dirs = ['KeyW', 'KeyD', 'KeyS', 'KeyA']; let di = 0;
      for (let i = 0; i < 330 * 30 && !run.over; i++) {
        { let ax = 0, ay = 0; for (const e of run.enemies) { const dx = P.x - e.x, dy = P.y - e.y, d2 = dx*dx+dy*dy; if (d2 < 260*260) { ax += dx / d2; ay += dy / d2; } }
          let px = 0, py = 0; for (const q of run.eproj) { const dx = P.x - q.x, dy = P.y - q.y, d2 = dx*dx+dy*dy; if (d2 < 170*170 && (q.vx*dx+q.vy*dy) > 0) { const sp = Math.hypot(q.vx,q.vy); let nx = -q.vy/sp, ny = q.vx/sp; if (nx*dx+ny*dy < 0) { nx=-nx; ny=-ny; } px += nx * 3 / Math.sqrt(d2); py += ny * 3 / Math.sqrt(d2); } }
          const l = Math.hypot(ax, ay) || 1; let vx = ax / l, vy = ay / l; const tx = -vy, ty = vx; vx = vx * .7 + tx * .7; vy = vy * .7 + ty * .7; if (px || py) { const pl = Math.hypot(px, py); vx = vx * .3 + px / pl * 1.5; vy = vy * .3 + py / pl * 1.5; }
          for (const z of run.etele.concat(run.ezones)) { const dx = P.x - z.x, dy = P.y - z.y, d = Math.hypot(dx, dy) || 1; if (d < z.r + 40) { px += dx / d * 4 / Math.max(20, d) * 40; py += dy / d * 4 / Math.max(20, d) * 40; } }
          for (const e of run.enemies) if (e.bomber && e.fuse > 0) { const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1; if (d < 120) { px += dx / d * 3; py += dy / d * 3; } }
          if (px || py) { const pl = Math.hypot(px, py); vx = vx * .3 + px / pl * 1.5; vy = vy * .3 + py / pl * 1.5; }
          if (run.arena) { const cx = run.arena.x - P.x, cy = run.arena.y - P.y, cd = Math.hypot(cx, cy); if (cd > 300) { vx += cx / cd; vy += cy / cd; } }
          let gem = null, gd = 1e12; for (const it of run.items) { if (it.k==='bomb'||it.k==='magnet') continue; const d=(it.x-P.x)**2+(it.y-P.y)**2; if (d<gd && d < 350*350) {gd=d; gem=it;} } if (gem) { const dx = gem.x - P.x, dy = gem.y - P.y, d = Math.hypot(dx, dy)||1; vx += dx/d*.8; vy += dy/d*.8; }
          joy.id = 1; joy.ox = 0; joy.oy = 0; joy.x = vx * 55; joy.y = vy * 55; }
        if (P.dashCd <= 0 && P.hp < P.maxHp * .5) doDash();
        if (P.ult >= P.ultNeed) doUlt(); if (P.scrap >= 100) startMech();
        update(1 / 30); if (run.lvDelay > 0) { run.lvDelay = 0; openLevelUp(run.lvKind === 'chest'); } if (P.mechT > 11.9) window.MECHN = (window.MECHN||0) + 1;
        if (i % (30 * 30) === 0) log.push(`${Math.round(run.time)}s hp${Math.round(P.hp)}/${P.maxHp} lv${P.lv} k${run.kills} en${run.enemies.length} boss${run.boss ? Math.round(run.boss.hp) : '-'} dmg=${JSON.stringify(DMG,(k,v)=>typeof v==='number'?Math.round(v):v)}`);
      }
      joy.id = null;
      log.push(`END win=${!!(run.over && P.hp>0)} t=${Math.round(run.time)} lv${P.lv} k${run.kills} gold${run.gold} weapons=${run.weapons.map(w => w.id + w.lv + (w.evo ? '*' : '')).join(',')} ms=${Math.round(performance.now() - t0)} mechs=${window.MECHN||0} dmg=${JSON.stringify(DMG)}`);
      return log;
    }, [si, shop]);
    console.log('STAGE', si + 1, '\n ' + r.join('\n '));
  }
  await b.close();
})();
