'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Evaluate site.js in a sandbox with a fake document and no window.fetch,
// then exercise the pure helpers.
const src = fs.readFileSync(__dirname + '/../site.js', 'utf8');
const calls = {};
const sandbox = {
  window: {},
  location: { pathname: '/index.html' },
  document: {
    getElementById: (id) => {
      if (!calls[id]) calls[id] = { textContent: '', setAttribute: (k, v) => { calls[id][k] = v; } };
      return calls[id];
    },
  },
  fetch: () => Promise.reject(new Error('no fetch in tests')),
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const site = sandbox.window.AshenSite;

assert.strictEqual(site.formatOnline(null), 'Players online: unknown');
assert.strictEqual(site.formatOnline(1), '1 player online');
assert.strictEqual(site.formatOnline(4), '4 players online');

// The nav must render Home + Live Map into #site-nav (innerHTML path).
const navHtml = calls['site-nav'].innerHTML;
assert.ok(navHtml.includes('>Home</a>'), 'nav has Home link');
assert.ok(navHtml.includes('>Live Map</a>'), 'nav has Live Map link');
assert.ok(navHtml.includes('class="active"'), 'current page is marked active');

setTimeout(() => {
  // Fallback text must be written when the map feed fails.
  assert.strictEqual(calls['players-online'].textContent, 'Players online: unknown');
  console.log('site.js tests OK');
}, 10);