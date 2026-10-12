// Baut dist/goblin-io.html: esbuild-Bundle + Magier-Sprites (dedupliziert) + Gras-PNG inline.
// Der Goblin wird zur Laufzeit generiert (src/gen/goblin.js).
import { build } from 'esbuild';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = join(ROOT, 'assets');
const OUT = join(ROOT, 'dist', 'goblin-io.html');
const dev = process.argv.includes('--dev');

const files = {};
for (const sub of ['feuermagier', 'feuermagier/fx', 'frostmagier', 'frostmagier/fx']) {
  const d = join(A, 'mag', 'mages', sub);
  for (const f of readdirSync(d).sort()) if (f.endsWith('.svg')) files[f.slice(0, -4)] = readFileSync(join(d, f), 'utf8');
}
files.dagger = readFileSync(join(A, 'Dagger.svg'), 'utf8');

// wie build.py: Leerraum zwischen Tags weg, Zahlen auf 2 Nachkommastellen
const mini = s => s.trim().replace(/>\s+</g, '><').replace(/(\d+\.\d{2})\d+/g, '$1');
const uniq = [], idx = new Map(), sprmap = {};
for (const [name, s0] of Object.entries(files)) {
  const s = mini(s0);
  if (!idx.has(s)) { idx.set(s, uniq.length); uniq.push(s); }
  sprmap[name] = idx.get(s);
}
const grass = readFileSync(join(A, 'sb3', 'd84248371980f30554c1b2d46d74b054.png')).toString('base64');
const assets = `const SVGS=${JSON.stringify(uniq)};\nconst SPRMAP=${JSON.stringify(sprmap)};\nconst GRASS="data:image/png;base64,${grass}";\n`;

const res = await build({
  entryPoints: [join(ROOT, 'src', 'main.js')], bundle: true, format: 'iife', write: false,
  target: 'es2020', minify: !dev, legalComments: 'none', charset: 'utf8',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(join(ROOT, 'src', 'index.tpl.html'), 'utf8');
const css = readFileSync(join(ROOT, 'src', 'style.css'), 'utf8');
// Funktions-Ersetzer, damit "$&" o. Ä. im Code nicht als Muster gelesen wird
const html = tpl.replace('/*CSS*/', () => css).replace('/*ASSETS*/', () => assets).replace('/*GAME*/', () => js);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`ok ${OUT} ${(html.length / 1024).toFixed(0)} KB, ${uniq.length} SVGs, ${Object.keys(sprmap).length} Namen, JS ${(js.length / 1024).toFixed(0)} KB`);
