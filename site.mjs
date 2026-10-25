// Copies the files the live site serves into one folder (default _site/), for the Deploy
// workflow. Run `npm run build` first. Everything else (src/, dev.html, tests) stays out.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

export const SITE_FILES = ['index.html'];

const out = process.argv[2] ?? '_site';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of SITE_FILES) cpSync(f, `${out}/${f}`, { recursive: true });
writeFileSync(`${out}/.nojekyll`, '');
console.log(`${out}/: ${SITE_FILES.length} entries`);
