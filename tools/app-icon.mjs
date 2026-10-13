// Rendert assets/app/icon.svg zu assets/app/icon.png (1024²), daraus macht `npx tauri icon` alle App-Icons
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [src, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
await p.setContent(`<html><body style="margin:0;background:transparent">${readFileSync(src,'utf8')}</body></html>`);
await p.locator('svg').first().screenshot({ path: out, omitBackground: true }); await b.close();
