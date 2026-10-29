import { emit, on } from '../core/events.js';
import { clearInput, localCoop, takeInputs } from '../core/input.js';
import { WAIT_SHOW, createLockstep } from '../net/lockstep.js';
import { profileOf } from '../game/profile.js';
import { Music } from '../core/music.js';
import { defineScene, go } from '../core/scenes.js';
import { $ } from '../core/util.js';
import { levelLabel } from '../data/levels.js';
import { MUTATORS, mutNames } from '../data/mutators.js';
import { endRun, hint, lvToBonus, newRun, partnerGone, simHash, update } from '../game/run.js';
import { startCoopLevel } from '../game/levelup.js';
import { run } from '../game/state.js';
import { renderRun } from '../render/draw-world.js';
import { pauseBackground } from '../render/sprites.js';
import { banner, refreshSlots, setupAbilButtons, updHud } from '../ui/hud.js';
import { coopLvTick, openLevelUp } from '../ui/levelup.js';
import '../ui/run-chest.js';   // Truhe im Lauf: hängt sich an das Ereignis autoChest
import { hideOverlays, showScreen } from '../ui/menus.js';

let offs = [], net = null;
// Boss-Auftritt aufräumen (falls der Lauf mitten in der Szene verlassen wird)
function endCine() { document.body.classList.remove('cine'); $('#bossCard').hidden = true; }

defineScene('run', {
  // mut/abil/mode (Phase 12): Mutatoren, feste Fähigkeiten und Art des Laufs (Herausforderung, Kopfgeld)
  // coop (Phase 14b): { profs, me } – zwei Goblins; im Testmodus ?coop=local spielt der zweite an derselben Tastatur
  // link (Phase 14c): Verbindung zum Partner ({ send, onMessage }, net/room.js) und delay (Vorlauf in Ticks) → Gleichschritt
  enter({ si, li = 0, seed, nm = false, mut, abil, mode, coop, link, delay }) {
    pauseBackground(true);   // im Lauf kein Hintergrund-Laden
    if (!coop && localCoop && !mode) coop = { profs: [profileOf(), { ...profileOf(), name: 'Goblin 2' }], me: 0 };
    newRun(si, seed, li, nm, { mut, abil, mode, coop }); clearInput();   // Knöpfe aus dem Menü nicht in den Lauf mitnehmen
    net = link ? createLockstep({
      me: coop.me, link, delay, tick: simStep, take: () => takeInputs()[0], hash: simHash,
      onWait: s => netNote(s >= WAIT_SHOW ? 'Warte auf Partner …' : ''),
      onDesync: () => { run.netNote = 'Die beiden Spiele liefen auseinander – Lauf beendet.'; endRun(false); },
      onGone: () => { partnerGone(); hint(`<b>${run.players[1 - run.me].prof.name || 'Partner'}</b> ist weg – du spielst allein weiter.`); },
    }) : null;
    run.netDelay = link ? delay : 0;   // nur zur Anzeige/Prüfung (tools/coop-e2e.mjs)
    netNote('');
    showScreen(null); hideOverlays();
    $('#hud').hidden = false; $('#ctrl').hidden = false; $('#bossBar').hidden = true; $('#hint').hidden = true; endCine();
    $('#stageTxt').textContent = (run.nm ? `☠${run.nm} ` : '') + (run.st.endless ? run.st.name : `${levelLabel(si, run.li)} ${run.st.lvName}`);
    refreshSlots(); setupAbilButtons();
    banner((run.mode === 'challenge' ? 'Herausforderung · ' : '') + (run.nm ? `Albtraum ${run.nm} · ` : '') + (run.st.endless ? run.st.name : `${levelLabel(si, run.li)} · ${run.st.lvName}`), run.nm || run.mut.length ? 'danger' : '');
    if (run.mut.length) { $('#stageTxt').textContent += ' · ' + mutNames(run.mut); hint('<b>Mutatoren</b> ' + run.mut.map(k => `${MUTATORS[k].name}: ${MUTATORS[k].desc}`).join(' · ')); }
    Music.boss = false; Music.theme = null; Music.hold = false; Music.world = run.st.music || null; Music.part = Music.cur = 0; Music.step = 0; Music.start();
    offs = [
      on('runEnd', r => { if (net) net.bye(); go('results', r); }),
      // Boss-Auftritt: Musik schweigt für das Intro, danach das Thema des Bosses von vorn
      on('bossIntro', b => { Music.hold = true; Music.bossIntro(b.id); }),
      on('bossSpawn', b => { Music.hold = false; Music.boss = true; Music.theme = b.id; Music.step = 0; }),
      on('bossDown', () => { Music.boss = false; Music.theme = null; }),
      on('audioReady', () => { if (!run.paused) Music.start(); }),
    ];
  },
  exit() { for (const f of offs) f(); offs = []; endCine(); Music.hold = false; net = null; netNote(''); },
  // Koop übers Netz: der Gleichschritt rechnet simStep, sobald beide Eingaben da sind; sonst jeder Schritt direkt
  update(step) {
    if (net) { if (!run.over) net.frame(step); }
    else simStep(step);
    // Musik-Teil (core/music.js): ruhig am Anfang, treibend ab 45 s, eigener Teil solange ein Mini-Boss lebt
    Music.part = run.mini && !run.mini.dead ? 2 : run.time >= 45 ? 1 : 0;
  },
  render(now, alpha, dt) { renderRun(now, alpha); updHud(dt); if (run.lvl) coopLvTick(); },
});

// Ein Schritt des Laufs mit allem, was die Szene drumherum steuert (Starre, Hitstop, Boss-Szene, Zeitlupe, Level-Up).
// Im Koop Teil der Sim: beide Rechner rechnen ihn gleich, inps kommen vom Gleichschritt (allein holt update sie selbst).
function simStep(step, inps) {
  // Mega-Verschmelzung/Truhe zählt auch in der Pause weiter wie ihre Animation (sonst stünde die Welt danach ohne Bild)
  const frozen = run.megaFreeze > 0;
  if (frozen) {
    run.megaFreeze -= step;
    // Koop: Überspringen kommt als Eingabe, damit beide gleich lange stehen (ui/run-chest.js)
    if (inps && inps.some(i => i.skip)) { run.megaFreeze = 0; emit('freezeSkip'); }
  }
  if (run.paused) return;
  // Mega-Entwicklung: die Welt steht, solange die Verschmelz-Animation läuft (ui/mega-fx.js)
  if (frozen) return;
  // Hitstop: Spiel steht kurz still (Elite-Kill, Boss besiegt)
  if (run.hitstop > 0) { run.hitstop -= step; return; }
  // Boss-Szene läuft in Echtzeit; ein offenes Level-Up und Zeitlupe warten, bis sie vorbei ist
  if (run.cut) { update(step, inps); return; }
  // Nach einem Level-Up kurz Zeitlupe, dann die Karten
  if (run.lvDelay > 0) {
    // Im Schritt, in dem die Zeitlupe endet, kein update(): sonst startet es schon das nächste
    // anstehende Level-Up (lvDelay wieder > 0) und dieses Kartenfenster ginge verloren
    run.lvDelay -= step;
    if (run.lvDelay > 0) update(step * .25, inps);
    // Level zu Ende, während die Zeitlupe lief: kein Kartenfenster mehr, das Level-Up wird Bonus-Level
    else if (!run.over) { if (run.clearT > 0) lvToBonus(); else if (run.coop) startCoopLevel(run.lvKind); else { run.lvOpen = false; openLevelUp(run.lvKind === 'chest'); } }
  } else if (run.slowT > 0) { run.slowT -= step; update(step * .3, inps); }
  else update(step, inps);
  // Fehlersuche Koop (tools/coop-e2e.mjs --trace): Zustand je Schritt mitschreiben
  if (globalThis.__coopTrace) {
    // Alle Zahlen der Goblins und ihrer Ausrüstung (kit des aktiven liegt auf run) – zum Vergleich beider Seiten
    const num = o => Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean'));
    const kit = (q, i) => (i === run.pi ? Object.fromEntries(['weapons', 'passives', 'boons', 'abil'].map(k => [k, run[k]])) : { weapons: q.kit.weapons, passives: q.kit.passives, boons: q.kit.boons, abil: q.kit.abil });
    const w = {}; for (const k of ['enemies', 'eproj', 'haz', 'tele', 'zones', 'items']) w[k] = JSON.stringify(run[k].map(num));
    globalThis.__coopTrace.push({ t: run.tick, h: simHash(), inps, p: run.players.map((q, i) => ({ ...num(q), kit: JSON.stringify(kit(q, i)) })), w });
  }
}
// „Warte auf Partner …“ über dem Spiel (leer = weg)
function netNote(txt) {
  let el = document.getElementById('netWait');
  if (!el) { if (!txt) return; el = document.createElement('div'); el.id = 'netWait'; document.body.append(el); }
  el.textContent = txt; el.hidden = !txt;
}
