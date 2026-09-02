'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Evaluate site.js in a sandbox with a fake document and no window.fetch,
// then exercise the pure helpers and both nav render paths.
const src = fs.readFileSync(__dirname + '/../site.js', 'utf8');

// Mutable document stub: while readyState === 'loading' getElementById returns
// null (the body has not been parsed yet - the load-order bug); once the test
// fires DOMContentLoaded the same ids resolve to element stubs.
function makeDoc() {
  const calls = {};
  const doc = {
    readyState: 'loading',
    listeners: {},
    getElementById(id) {
      if (doc.readyState === 'loading') return null;
      if (!calls[id]) calls[id] = { textContent: '', setAttribute(k, v) { calls[id][k] = v; } };
      return calls[id];
    },
    addEventListener(ev, fn) { doc.listeners[ev] = fn; },
  };
  return { doc, calls };
}

function runScript(doc) {
  const sandbox = {
    window: {},
    location: { pathname: '/map.html' },
    document: doc,
    fetch: () => Promise.reject(new Error('no fetch in tests')),
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.AshenSite;
}

// Scenario A - script loads in <head> before the body exists (the bug class):
// readyState is 'loading', #site-nav is not in the DOM yet, and the render must
// be deferred until DOMContentLoaded fires.
{
  const { doc, calls } = makeDoc();
  const site = runScript(doc);

  assert.strictEqual(typeof site.renderNav, 'function', 'helpers exposed immediately');
  assert.strictEqual(
    calls['site-nav'],
    undefined,
    'nav must NOT render while the document is still loading',
  );
  assert.strictEqual(typeof doc.listeners['DOMContentLoaded'], 'function', 'waits for DOMContentLoaded');

  // The DOM is now parsed - the deferred init must render the nav.
  doc.readyState = 'complete';
  doc.listeners['DOMContentLoaded']();

  const navHtml = calls['site-nav'].innerHTML;
  assert.ok(navHtml.includes('>AshenCraft</a>'), 'nav has the brand');
  assert.ok(navHtml.includes('>Home</a>'), 'nav has Home link');
  assert.ok(navHtml.includes('>Live Map</a>'), 'nav has Live Map link');
  assert.ok(navHtml.includes('class="active"'), 'current page (map.html) is marked active');
}

// Scenario B - the document is already parsed when the script runs
// (readyState !== 'loading'): init must run synchronously, not wait for an
// event that will never fire.
{
  const { doc, calls } = makeDoc();
  doc.readyState = 'complete';
  const site = runScript(doc);

  assert.strictEqual(site.formatOnline(null), 'Players online: unknown');
  assert.strictEqual(site.formatOnline(1), '1 player online');
  assert.strictEqual(site.formatOnline(4), '4 players online');

  const navHtml = calls['site-nav'].innerHTML;
  assert.ok(navHtml.includes('>Home</a>'), 'nav has Home link');
  assert.ok(navHtml.includes('>Live Map</a>'), 'nav has Live Map link');
  assert.ok(navHtml.includes('class="active"'), 'current page is marked active');

  setTimeout(() => {
    // Fallback text must be written when the map feed fails.
    assert.strictEqual(calls['players-online'].textContent, 'Players online: unknown');
    console.log('site.js tests OK');
  }, 10);
}