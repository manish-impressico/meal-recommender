// Usage (from apps/web): node scripts/process-photos.mjs
// Reads photos-raw/<meal-id>.<jpg|jpeg|png|webp>, writes public/meals/<meal-id>.webp (800x600, ≤ ~100 KB)
// and photos-review/contact-sheet.html, then lists catalog meals that still have no photo.
import sharp from 'sharp';
import { readdir, mkdir, writeFile, stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rawDir = path.join(root, 'photos-raw');
const outDir = path.join(root, 'public/meals');
const reviewDir = path.join(root, 'photos-review');
await Promise.all([rawDir, outDir, reviewDir].map((d) => mkdir(d, { recursive: true })));

const catalog = JSON.parse(await readFile(path.join(root, 'src/content/catalog.json'), 'utf8'));
const names = new Map(catalog.map((m) => [m.id, m.name]));
const rows = [];
for (const f of (await readdir(rawDir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()) {
  const id = f.replace(/\.[^.]+$/, '');
  if (!names.has(id)) { console.warn(`skip ${f}: no catalog meal with id "${id}"`); continue; }
  const out = path.join(outDir, `${id}.webp`);
  // Step quality down until the file is under ~100 KB; 800px covers the 390px-wide hero at 2x.
  for (const q of [78, 70, 62, 55]) {
    await sharp(path.join(rawDir, f)).rotate().resize({ width: 800, height: 600, fit: 'cover', position: 'attention' }).webp({ quality: q }).toFile(out);
    if ((await stat(out)).size <= 100_000) break;
  }
  rows.push({ id, kb: Math.round((await stat(out)).size / 1024) });
}
const cell = (r) => `<figure><img src="../public/meals/${r.id}.webp" alt=""><figcaption><b>${names.get(r.id)}</b><br>${r.id} · ${r.kb} KB</figcaption></figure>`;
await writeFile(path.join(reviewDir, 'contact-sheet.html'),
  `<!doctype html><meta charset="utf-8"><title>Meal photos review</title><style>body{font:14px system-ui;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}figure{margin:0}img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px}</style><main>${rows.map(cell).join('')}</main>`);
const done = new Set(rows.map((r) => r.id));
const missing = catalog.filter((m) => !done.has(m.id));
console.log(`processed ${rows.length} photos; ${missing.length} meals still without a photo`);
for (const m of missing) console.log(`  ${m.id}  (${m.name})`);
