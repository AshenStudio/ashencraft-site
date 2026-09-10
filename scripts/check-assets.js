'use strict';
// CI guard: every local <script>/<link> reference in the HTML pages must carry
// a ?v= token and the referenced file must exist relative to the page that
// references it (dashboard ?v= discipline). Pages may live in subdirectories;
// their relative refs resolve against the page's own directory.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'tests' || entry.name.startsWith('.') || entry.name === '__pycache__') return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

const pages = walk(root);
let failed = false;

for (const pagePath of pages) {
  const page = path.relative(root, pagePath).replace(/\\/g, '/');
  const html = fs.readFileSync(pagePath, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('#') || ref.startsWith('mailto:') || ref.startsWith('about:')) continue;
    if (!ref.includes('?')) {
      console.error(`FAIL ${page}: local asset without ?v= token: ${ref}`);
      failed = true;
    }
    const file = ref.split('?')[0];
    if (!file) continue;
    const resolved = path.resolve(path.dirname(pagePath), file);
    if (!fs.existsSync(resolved)) {
      console.error(`FAIL ${page}: referenced file missing: ${file}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log(`asset check OK (${pages.length} pages)`);
