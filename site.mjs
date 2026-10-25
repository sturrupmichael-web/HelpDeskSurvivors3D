// Copies the files the live site serves into one folder (default _site/), for the Deploy
// workflow: the page, its service worker, manifest and icons.
// Run `npm run build` first. Everything else (src/, dev.html, tests) stays out.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const SITE_FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/preview.png'];

const out = process.argv[2] ?? '_site';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of SITE_FILES) {
  mkdirSync(dirname(`${out}/${f}`), { recursive: true });
  cpSync(f, `${out}/${f}`);
}
writeFileSync(`${out}/.nojekyll`, '');
console.log(`${out}/: ${SITE_FILES.length} entries`);
