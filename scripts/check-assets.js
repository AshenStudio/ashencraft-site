'use strict';
// CI guard: every local <script>/<link> reference in the HTML pages must carry
// a ?v= token and the referenced file must exist (dashboard ?v= discipline,
// scaled to two pages).
const fs = require('fs');
const path = require('path');

const pages = ['index.html', 'map.html'];
let failed = false;

for (const page of pages) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^https?:|^#|^mailto:|^about:/.test(ref)) continue;
    if (!ref.includes('?')) {
      console.error(`FAIL ${page}: local asset without ?v= token: ${ref}`);
      failed = true;
    }
    const file = ref.split('?')[0];
    if (!fs.existsSync(path.join(__dirname, '..', file))) {
      console.error(`FAIL ${page}: referenced file missing: ${file}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('asset check OK');