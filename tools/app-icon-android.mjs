// Android-Icons für die APK aus assets/app/icon.svg (Goblin): adaptives Icon (Vordergrund: Goblin ohne Rahmen
// im sicheren Bereich, Hintergrund: grüner Verlauf) plus klassische Icons (eckig und rund) für alte Launcher.
// Schreibt nach src-tauri/gen/android/app/src/main/res. Aufruf: node tools/app-icon-android.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RES = 'src-tauri/gen/android/app/src/main/res';
const svg = readFileSync('assets/app/icon.svg', 'utf8');
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const goblin = svg.slice(svg.indexOf('<g transform="translate(48 56)'), svg.lastIndexOf('</svg>'));
const wrap = (inner, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${defs}${extra}${inner}</svg>`;
// Adaptives Icon: 108 dp, davon sind nur die inneren ~66 dp sicher sichtbar → Goblin auf 62 % verkleinern
const fg = wrap(`<g transform="translate(48 48) scale(.62) translate(-48 -48)">${goblin}</g>`);
const bg = wrap('<rect width="96" height="96" fill="url(#bg)"/>');
const square = svg;
const round = wrap(`<g transform="translate(48 48) scale(.86) translate(-48 -48)">${goblin}</g>`, '<circle cx="48" cy="48" r="46" fill="url(#bg)" stroke="#141c0e" stroke-width="3"/>');
const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const b = await chromium.launch(); const p = await b.newPage();
async function png(src, px) {
  await p.setViewportSize({ width: px, height: px });
  await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`)}</body></html>`);
  return p.locator('svg').first().screenshot({ omitBackground: true });
}
for (const [d, k] of Object.entries(DENS)) {
  const dir = join(RES, 'mipmap-' + d); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ic_launcher.png'), await png(square, 48 * k));
  writeFileSync(join(dir, 'ic_launcher_round.png'), await png(round, 48 * k));
  writeFileSync(join(dir, 'ic_launcher_foreground.png'), await png(fg, 108 * k));
  writeFileSync(join(dir, 'ic_launcher_background.png'), await png(bg, 108 * k));
}
await b.close();
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
  <monochrome android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
mkdirSync(join(RES, 'mipmap-anydpi-v26'), { recursive: true });
writeFileSync(join(RES, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(RES, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
console.log('Android-Icons geschrieben nach', RES);
