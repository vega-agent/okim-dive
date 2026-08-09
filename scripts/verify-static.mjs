import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const pages = ['index.html', 'about.html', 'courses.html', 'trips.html', 'gallery.html', 'contact.html'];

for (const page of pages) {
  const path = join(root, page);
  if (!existsSync(path)) throw new Error(`Missing page: ${page}`);
  const html = readFileSync(path, 'utf8');
  if (!html.includes('styles.css')) throw new Error(`${page} does not reference styles.css`);
  console.log(`PAGE_OK ${page}`);
}

const cssPath = join(root, 'styles.css');
const css = readFileSync(cssPath, 'utf8');
const refs = [...css.matchAll(/url\(['"]?([^)'"\\]+)['"]?\)/g)].map((match) => match[1]);

for (const ref of refs) {
  let assetPath;
  if (ref.startsWith('./')) assetPath = resolve(root, ref.slice(2));
  else if (ref.startsWith('../')) assetPath = resolve(root, 'assets', ref);
  else continue;
  if (!existsSync(assetPath)) throw new Error(`Missing CSS asset: ${ref}`);
}

console.log(`ASSETS_OK ${refs.length} CSS url references`);
