// Mess-Modus für Ruckler auf echten Geräten: goblin-io.html?perf
// Zeichnet jeden Frame über 50 ms mit Kontext auf (Spiellogik/Zeichnen, Gegner, neue Bilder, Töne,
// Long Animation Frames des Browsers). Kasten oben links, „Kopieren“ legt den Bericht in die Zwischenablage.
import { AC } from './core/audio.js';
import { loopStats } from './core/loop.js';
import { sceneName } from './core/scenes.js';
import { run } from './game/state.js';

const HITCH = 50, MAX = 200;

export function startPerf() {
  const log = [], t0 = performance.now();
  let canvases = 0, sounds = 0, last = 0, frames = 0, started = false;   // gezählt wird erst ab dem ersten Lauf
  // Zähler seit dem letzten Frame
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (t, ...a) { if (t === 'canvas') canvases++; return ce.call(this, t, ...a); };
  const st = AudioScheduledSourceNode.prototype.start;
  AudioScheduledSourceNode.prototype.start = function (...a) { sounds++; return st.apply(this, a); };
  // Browser-Sicht: wo ging die Zeit hin (Skripte, Layout, Zeichnen)?
  const loaf = [];
  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        if (!started) continue;
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
  const txt = document.createElement('div'), btn = document.createElement('button');
  btn.textContent = 'Kopieren'; btn.style.cssText = 'margin-top:4px;font:12px sans-serif';
  btn.addEventListener('pointerdown', e => e.stopPropagation());
  btn.addEventListener('click', () => {
    const rep = JSON.stringify({ ua: navigator.userAgent, dpr: devicePixelRatio, size: [innerWidth, innerHeight], hitches: log, loaf }, null, 1);
    // Über die LAN-Adresse (http) gibt es navigator.clipboard nicht: dann altes execCommand, sonst Konsole
    const old = () => {
      const ta = document.createElement('textarea'); ta.value = rep; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* nichts */ }
      ta.remove(); if (!ok) console.log(rep);
      btn.textContent = ok ? 'Kopiert!' : 'siehe Konsole (F12)';
    };
    if (navigator.clipboard) navigator.clipboard.writeText(rep).then(() => { btn.textContent = 'Kopiert!'; }, old); else old();
  });
  box.append(txt, btn); document.body.appendChild(box);

  function frame(now) {
    requestAnimationFrame(frame);
    frames++;
    const gap = last ? now - last : 0; last = now;
    if (sceneName === 'run') started = true;
    if (started && gap > HITCH) {
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
