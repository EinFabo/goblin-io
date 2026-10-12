// Generierte Sprites als SVG-Dateien + Übersichtsbild ausgeben (zum Anschauen und Vergleichen).
// node tools/gen/dump.mjs [ausgabeordner]   → <ordner>/goblin/*.svg, <ordner>/sheet.html (+ sheet.png mit --png)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ANIMS, goblinSvg } from '../../src/gen/goblin.js';
import { DIRS8 } from '../../src/gen/svg.js';

const out = resolve(process.argv[2] || 'build/sprites');
mkdirSync(join(out, 'goblin'), { recursive: true });
const ORDER = ['down', 'downleft', 'left', 'upleft', 'up', 'upright', 'right', 'downright'];
let tables = '';
for (const [anim, n] of Object.entries(ANIMS)) {
  let rows = '';
  for (const dir of ORDER) {
    let cells = '';
    for (let i = 0; i < n; i++) {
      const name = `${anim}_${dir}_${i + 1}.svg`;
      writeFileSync(join(out, 'goblin', name), goblinSvg(dir, anim, i));
      cells += `<td><img src="goblin/${name}" width="96" height="96"></td>`;
    }
    rows += `<tr><th>${anim}<br><small>${dir}</small></th>${cells}</tr>`;
  }
  tables += `<table id="${anim}">${rows}</table>`;
}
writeFileSync(join(out, 'sheet.html'), `<!doctype html><meta charset="utf-8"><style>body{background:#5fae3a;font:12px sans-serif;margin:8px}td{background:rgba(255,255,255,.12);padding:0}th{text-align:right;padding-right:6px}</style>${tables}`);
console.log('ok', out, DIRS8.length, 'Richtungen');
if (process.argv.includes('--png')) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 760, height: 400 } });
  await p.goto('file://' + join(out, 'sheet.html'));
  for (const anim of Object.keys(ANIMS)) await (await p.$('#' + anim)).screenshot({ path: join(out, `sheet-${anim}.png`) });
  await b.close();
  console.log('png', join(out, 'sheet-*.png'));
}

// ---------- Magier: alle Schulen, Ruhepose in allen gezeichneten Richtungen + Cast nach unten ----------
const { SCHOOL_IDS, mageSvg, MAGE_ANIMS } = await import('../../src/gen/mages.js');
mkdirSync(join(out, 'mages'), { recursive: true });
let mrows = '';
for (const sc of SCHOOL_IDS) {
  let cells = '';
  for (const dir of ['down', 'downleft', 'left', 'upleft', 'up']) {
    const name = `${sc}_idle_${dir}_1.svg`;
    writeFileSync(join(out, 'mages', name), mageSvg(sc, dir, 'idle', 0));
    cells += `<td><img src="mages/${name}" width="128" height="128"></td>`;
  }
  for (const i of [1, 3, 5, 6, 8]) {
    const name = `${sc}_cast_downleft_${i}.svg`;
    writeFileSync(join(out, 'mages', name), mageSvg(sc, 'downleft', 'cast', i - 1));
    cells += `<td><img src="mages/${name}" width="128" height="128"></td>`;
  }
  mrows += `<tr><th>${sc}</th>${cells}</tr>`;
}
writeFileSync(join(out, 'mages.html'), `<!doctype html><meta charset="utf-8"><style>body{background:#5fae3a;font:12px sans-serif;margin:4px}td{background:rgba(255,255,255,.12);padding:0}</style><table id="m">${mrows}</table>`);
if (process.argv.includes('--png')) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  await p.goto('file://' + join(out, 'mages.html')); await (await p.$('#m')).screenshot({ path: join(out, 'mages.png') }); await b.close();
  console.log('png', join(out, 'mages.png'));
}

// ---------- Diener ----------
const { MINION_KINDS, minionSvg } = await import('../../src/gen/minions.js');
mkdirSync(join(out, 'minions'), { recursive: true });
let nrows = '';
for (const kind of MINION_KINDS) {
  let cells = '';
  for (const dir of ['down', 'downleft', 'left', 'upleft', 'up']) {
    const name = `${kind}_idle_${dir}_1.svg`;
    writeFileSync(join(out, 'minions', name), minionSvg(kind, dir, 'idle', 0));
    cells += `<td><img src="minions/${name}" width="128" height="128"></td>`;
  }
  for (let i = 0; i < 6; i += 2) {
    const name = `${kind}_walk_downleft_${i + 1}.svg`;
    writeFileSync(join(out, 'minions', name), minionSvg(kind, 'downleft', 'walk', i));
    cells += `<td><img src="minions/${name}" width="128" height="128"></td>`;
  }
  nrows += `<tr><th>${kind}</th>${cells}</tr>`;
}
writeFileSync(join(out, 'minions.html'), `<!doctype html><meta charset="utf-8"><style>body{background:#5fae3a;font:12px sans-serif;margin:4px}td{background:rgba(255,255,255,.12);padding:0}</style><table id="n">${nrows}</table>`);
if (process.argv.includes('--png')) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 700 } });
  await p.goto('file://' + join(out, 'minions.html')); await (await p.$('#n')).screenshot({ path: join(out, 'minions.png') }); await b.close();
  console.log('png', join(out, 'minions.png'));
}

// ---------- Geschosse ----------
const { FX_KINDS, fxSvg, fxHitSvg } = await import('../../src/gen/fx.js');
mkdirSync(join(out, 'fx'), { recursive: true });
let frows = '';
for (const k of FX_KINDS) {
  let cells = '';
  for (let i = 0; i < 4; i++) { writeFileSync(join(out, 'fx', `${k}_${i + 1}.svg`), fxSvg(k, i)); cells += `<td><img src="fx/${k}_${i + 1}.svg" width="96" height="96"></td>`; }
  for (let i = 0; i < 5; i++) { writeFileSync(join(out, 'fx', `${k}_hit_${i + 1}.svg`), fxHitSvg(k, i)); cells += `<td><img src="fx/${k}_hit_${i + 1}.svg" width="96" height="96"></td>`; }
  frows += `<tr><th>${k}</th>${cells}</tr>`;
}
writeFileSync(join(out, 'fx.html'), `<!doctype html><meta charset="utf-8"><style>body{background:#5fae3a;font:12px sans-serif;margin:4px}td{background:rgba(255,255,255,.12);padding:0}</style><table id="f">${frows}</table>`);
if (process.argv.includes('--png')) {
  const { chromium } = await import('playwright');
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
  await p.goto('file://' + join(out, 'fx.html')); await (await p.$('#f')).screenshot({ path: join(out, 'fx.png') }); await b.close();
  console.log('png', join(out, 'fx.png'));
}
