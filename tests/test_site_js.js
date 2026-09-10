'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Evaluate i18n.js + site.js in a sandbox with a fake document and no
// window.fetch, then exercise the pure helpers and the nav render paths
// (signed-out, signed-in, avatar chip, EN/PT switching).
const i18nSrc = fs.readFileSync(__dirname + '/../i18n.js', 'utf8');
const src = fs.readFileSync(__dirname + '/../site.js', 'utf8');

const storage = new Map();

function makeDoc() {
  const calls = {};
  const doc = {
    readyState: 'loading',
    listeners: {},
    lang: 'en',
    getElementById(id) {
      if (doc.readyState === 'loading') return null;
      if (!calls[id]) calls[id] = { textContent: '', innerHTML: '', listeners: {}, addEventListener(ev, fn) { calls[id].listeners[ev] = fn; }, setAttribute(k, v) { calls[id][k] = v; } };
      return calls[id];
    },
    querySelectorAll() { return []; },
    addEventListener(ev, fn) { doc.listeners[ev] = fn; },
    dispatchEvent() {},
    documentElement: { lang: 'en' },
  };
  return { doc, calls };
}

function runScripts(doc, pathname) {
  const sandbox = {
    window: {},
    location: { pathname: pathname || '/map.html' },
    document: doc,
    navigator: { language: 'en-GB' },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
    },
    // site.js calls the bare `fetch` identifier, which resolves to this
    // context global (not window.fetch) - tests override it here.
    fetch: () => Promise.reject(new Error('no fetch in tests')),
  };
  vm.createContext(sandbox);
  vm.runInContext(i18nSrc, sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

function fireInit(doc) {
  doc.readyState = 'complete';
  doc.listeners['DOMContentLoaded']();
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Shared invariants: no nav link may carry an empty href (that self-links
// and "refreshes" the page - the 2026-09-10 Home bug), and the brand must
// always point at the site root.
function assertNavHrefSanity(navHtml) {
  assert.ok(!navHtml.includes('href=""'), 'no empty href in the nav (empty href self-links)');
  assert.ok(!navHtml.includes('href="index"'), 'no dotted-index href in the nav');
  assert.ok(
    navHtml.includes('href="../"') || navHtml.includes('href="/"'),
    'brand/home resolves to the site root, not the current page',
  );
}

async function main() {
  // Scenario A - script loads in <head> before the body exists (the bug class):
  // readyState is 'loading', #site-nav is not in the DOM yet, and the render must
  // be deferred until DOMContentLoaded fires.
  {
    const { doc, calls } = makeDoc();
    runScripts(doc);
    fireInit(doc);

    const navHtml = calls['site-nav'].innerHTML;
    assertNavHrefSanity(navHtml);
    assert.ok(navHtml.includes('>AshenCraft</a>'), 'nav has the brand');
    assert.ok(navHtml.includes('href="map"'), 'map link is extensionless (no .html)');
    assert.ok(navHtml.includes('href="community/discord"'), 'discord link is extensionless');
    assert.ok(navHtml.includes('href="community/bedrock"'), 'dropdown has a Bedrock item');
    assert.ok(navHtml.includes('community-dropdown'), 'nav has the Community dropdown');
    assert.ok(navHtml.includes('id="nav-lang"'), 'nav carries the EN/PT switcher');
    assert.ok(navHtml.includes('data-lang="en"') && navHtml.includes('data-lang="pt"'), 'both EN and PT buttons render');
    assert.ok(navHtml.includes('id="nav-login"'), 'signed-out nav shows the Sign in link');
    assert.ok(navHtml.includes('href="account"'), 'Sign in points at the account page');
  }

  // Scenario B - signed in: the nav shows the avatar chip (name + "?" fallback)
  // with a dropdown carrying the account page and sign out.
  {
    storage.clear();
    storage.set('ashen_auth_token', 'tok-123');
    storage.set('ashen_site_username', 'Asha');
    const { doc, calls } = makeDoc();
    runScripts(doc);
    fireInit(doc);

    const navHtml = calls['site-nav'].innerHTML;
    assertNavHrefSanity(navHtml);
    assert.ok(!navHtml.includes('id="nav-login"'), 'no Sign in link when authenticated');
    assert.ok(navHtml.includes('id="nav-account"'), 'signed-in nav shows the account chip');
    assert.ok(navHtml.includes('Asha'), 'username renders in the chip');
    assert.ok(navHtml.includes('nav-avatar'), 'chip carries the avatar image');
    assert.ok(navHtml.includes('data:image/svg+xml'), 'avatar falls back to the inline "?" SVG');
    assert.ok(navHtml.includes('id="nav-logout"'), 'dropdown has a Sign out button');
    assert.ok(navHtml.includes('href="account"'), 'dropdown links the account page');
    assert.ok(navHtml.includes('nav.account_page'), 'account row is translatable');
  }

  // Scenario B2 - the identity fetch swaps the "?" fallback for the proxied skin.
  {
    storage.clear();
    storage.set('ashen_auth_token', 'tok-123');
    storage.set('ashen_site_username', 'Asha');
    const { doc, calls } = makeDoc();
    const sandbox = runScripts(doc);
    sandbox.fetch = () => Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        identities: [{ type: 'microsoft', minecraft_uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', minecraft_username: 'Notch', created_at: '2026-09-01T00:00:00Z' }],
      })),
    });
    fireInit(doc);
    await tick();

    const navHtml = calls['site-nav'].innerHTML;
    assertNavHrefSanity(navHtml);
    assert.ok(navHtml.includes('/avatar/069a79f4-44e9-4726-a5be-fca90e38aaf5'), 'chip uses the same-origin avatar proxy');
    assert.ok(navHtml.includes('Notch'), 'identity name renders in the chip');
  }

  // Scenario B3 - a failed identities fetch keeps the usable "?" chip.
  {
    storage.clear();
    storage.set('ashen_auth_token', 'tok-123');
    storage.set('ashen_site_username', 'Asha');
    const { doc, calls } = makeDoc();
    const sandbox = runScripts(doc);
    sandbox.fetch = () => Promise.reject(new Error('down'));
    fireInit(doc);
    await tick();

    const navHtml = calls['site-nav'].innerHTML;
    assertNavHrefSanity(navHtml);
    assert.ok(navHtml.includes('data:image/svg+xml'), 'fallback chip survives a dead API');
    assert.ok(navHtml.includes('Asha'), 'username still renders when identities fail');
  }

  // Scenario C - i18n: PT translation applies and persists; EN stays the fallback.
  {
    storage.clear();
    const { doc } = makeDoc();
    const sandbox = runScripts(doc);
    fireInit(doc);
    const i18n = sandbox.window.AshenI18n;

    assert.strictEqual(i18n.current(), 'en', 'defaults to EN for a non-PT browser');
    i18n.apply('pt');
    assert.strictEqual(i18n.current(), 'pt', 'PT applies');
    assert.strictEqual(storage.get('ashen_site_lang'), 'pt', 'language choice persists');
    assert.strictEqual(i18n.t('nav.home'), 'Início', 'nav label translates');
    assert.strictEqual(i18n.t('home.players_many', { count: 4 }), '4 jogadores online', 'params interpolate');
    assert.strictEqual(doc.documentElement.lang, 'pt', 'document lang flips to pt');

    i18n.apply('en');
    assert.strictEqual(i18n.t('nav.home'), 'Home', 'switching back works');
    assert.strictEqual(i18n.t('missing.key'), 'missing.key', 'unknown keys pass through');
  }

  // Scenario D - the browser language picks PT on first visit.
  {
    storage.clear();
    const { doc } = makeDoc();
    const sandbox = runScripts(doc);
    sandbox.navigator.language = 'pt-BR';
    fireInit(doc);
    assert.strictEqual(sandbox.window.AshenI18n.current(), 'pt', 'pt-BR browser starts in PT');
  }

  // Scenario E - formatOnline keeps a static fallback for a dead map feed.
  {
    storage.clear();
    const { doc } = makeDoc();
    const sandbox = runScripts(doc);
    fireInit(doc);
    const t = sandbox.window.AshenI18n.t;
    assert.strictEqual(sandbox.window.AshenSite.formatOnline(null, t), 'Players online: unknown');
    assert.strictEqual(sandbox.window.AshenSite.formatOnline(1, t), '1 player online');
    assert.strictEqual(sandbox.window.AshenSite.formatOnline(4, t), '4 players online');
  }

  console.log('site.js tests OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
