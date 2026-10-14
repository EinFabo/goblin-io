// Mess-Modus für Ruckler auf echten Geräten: goblin-io.html?perf
// Zeichnet jeden Frame über 50 ms mit Kontext auf (Spiellogik/Zeichnen, Gegner, neue Bilder, Töne,
// Long Animation Frames des Browsers). Kasten oben links, „Kopieren“ legt den Bericht in die Zwischenablage.
// „Test 300 Gegner“ (aus dem Menü) misst die Bildrate wie npm run perf, aber mit der echten GPU des Geräts.
import { AC } from './core/audio.js';
import { loopStats } from './core/loop.js';
import { sceneName } from './core/scenes.js';
import { run } from './game/state.js';
import { stressTest } from './stress.js';

const HITCH = 50, MAX = 200;

export function startPerf() {
  const log = [], t0 = performance.now();
  let canvases = 0, sounds = 0, last = 0, frames = 0, started = false;   // gezählt wird erst ab dem ersten Lauf
  // Zeitfenster des Belastungstests: dort nichts aufzeichnen (LoAF-Einträge kommen verzögert, daher per Zeit)
  let stressFrom = Infinity, stressTo = Infinity;
  const inStress = at => at >= stressFrom && at <= stressTo;
  // Zähler seit dem letzten Frame
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (t, ...a) { if (t === 'canvas') canvases++; return ce.call(this, t, ...a); };
  if (window.AudioScheduledSourceNode) {   // ältere WebViews kennen die Klasse nicht
    const st = AudioScheduledSourceNode.prototype.start;
    AudioScheduledSourceNode.prototype.start = function (...a) { sounds++; return st.apply(this, a); };
  }
  // Browser-Sicht: wo ging die Zeit hin (Skripte, Layout, Zeichnen)?
  const loaf = [];
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        if (!started || inStress(e.startTime)) continue;
        loaf.push({
          at: Math.round(e.startTime - t0), dur: Math.round(e.duration), block: Math.round(e.blockingDuration || 0),
          layout: Math.round(e.startTime + e.duration - (e.styleAndLayoutStart || e.startTime + e.duration)),
          scripts: (e.scripts || []).map(s => `${s.invoker || s.sourceFunctionName || '?'} ${Math.round(s.duration)}ms`).slice(0, 4).join(', '),
        });
        if (loaf.length > MAX) loaf.shift();
      }
    }).observe({ type: 'long-animation-frame', buffered: false });
  } catch (_) { /* ältere Browser: ohne LoAF */ }

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:6px;top:40px;z-index:9999;background:rgba(0,0,0,.75);color:#fff;font:12px monospace;padding:6px 8px;border-radius:6px;max-width:460px;pointer-events:auto;white-space:pre';
  const txt = document.createElement('div'), btn = document.createElement('button'), sbtn = document.createElement('button'), stxt = document.createElement('div');
  btn.textContent = 'Kopieren'; btn.style.cssText = 'margin-top:4px;font:12px sans-serif';
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  sbtn.textContent = 'Test 300 Gegner'; sbtn.style.cssText = 'margin:4px 0 0 6px;font:12px sans-serif';
  sbtn.addEventListener('pointerdown', e => e.stopPropagation());
  let stress = null;
  sbtn.addEventListener('click', async () => {
    if (sceneName !== 'menu' || sbtn.disabled) { stxt.textContent = 'Test nur aus dem Menü'; return; }
    sbtn.disabled = true; stxt.textContent = 'Test läuft (12 s) …';
    stressFrom = performance.now(); stressTo = Infinity;
    let r = null;
    try { r = await stressTest(); } catch (err) { console.error(err); } finally { sbtn.disabled = false; stressTo = performance.now(); }
    if (!r) { stxt.textContent = 'Test abgebrochen'; return; }
    stress = r;
    const f1 = x => x.toFixed(1);
    stxt.textContent = `300 Gegner: ${f1(r.fps)} FPS ${r.fps >= 55 ? '✓' : '✗'} (Ziel ≥ 55)\nFrame p50 ${f1(r.p50)} / p95 ${f1(r.p95)} ms, ${Math.round(r.slow * 100)} % über 25 ms\nLogik ${f1(r.upd)} ms, Zeichnen ${f1(r.ren)} ms je Frame`;
  });
  btn.addEventListener('click', () => {
    const rep = JSON.stringify({ ua: navigator.userAgent, dpr: devicePixelRatio, size: [innerWidth, innerHeight], stress, hitches: log, loaf }, null, 1);
    // Über die LAN-Adresse (http) gibt es navigator.clipboard nicht: dann altes execCommand, sonst Konsole
    const old = () => {
      const ta = document.createElement('textarea'); ta.value = rep; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* nichts */ }
      ta.remove(); if (!ok) console.log(rep);
      btn.textContent = ok ? 'Kopiert!' : 'siehe Konsole (F12)';
    };
    if (navigator.clipboard) navigator.clipboard.writeText(rep).then(() => { btn.textContent = 'Kopiert!'; }, old); else old();
  });
  box.append(txt, btn, sbtn, stxt); document.body.appendChild(box);

  function frame(now) {
    requestAnimationFrame(frame);
    frames++;
    const gap = last ? now - last : 0; last = now;
    if (sceneName === 'run' && !inStress(now)) started = true;
    if (started && gap > HITCH && !inStress(now)) {
      log.push({
        at: Math.round(now - t0), gap: Math.round(gap), scene: sceneName, time: run ? +run.time.toFixed(2) : null,
        upd: +loopStats.upd.toFixed(1), ren: +loopStats.ren.toFixed(1), steps: loopStats.steps,
        enemies: run ? run.enemies.length : 0, canvases, sounds, audio: AC ? AC.state : 'aus',
      });
      if (log.length > MAX) log.shift();
    }
    canvases = 0; sounds = 0;
    if (frames % 30 === 0) txt.textContent = `Ruckler >${HITCH} ms: ${log.length}\n` + log.slice(-6).map(h => `${h.scene} ${h.time ?? ''}s  ${h.gap}ms  Logik ${h.upd} Zeichnen ${h.ren}  Gegner ${h.enemies} Bilder+${h.canvases} Töne+${h.sounds}`).join('\n');
  }
  requestAnimationFrame(frame);
}
