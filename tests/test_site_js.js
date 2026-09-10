'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Evaluate i18n.js + site.js in a sandbox with a fake document and no
// window.fetch, then exercise the pure helpers and the nav render paths
// (signed-out, signed-in, EN/PT switching).
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
    },
    fetch: () => Promise.reject(new Error('no fetch in tests')),
  };
  sandbox.window.fetch = sandbox.fetch;
  vm.createContext(sandbox);
  vm.runInContext(i18nSrc, sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

function fireInit(doc) {
  doc.readyState = 'complete';
  doc.listeners['DOMContentLoaded']();
}

// Scenario A - script loads in <head> before the body exists (the bug class):
// readyState is 'loading', #site-nav is not in the DOM yet, and the render must
// be deferred until DOMContentLoaded fires.
{
  const { doc, calls } = makeDoc();
  runScripts(doc);
  fireInit(doc);

  const navHtml = calls['site-nav'].innerHTML;
  assert.ok(navHtml.includes('>AshenCraft</a>'), 'nav has the brand');
  assert.ok(navHtml.includes('href=""'), 'home link is extensionless');
  assert.ok(navHtml.includes('href="map"'), 'map link is extensionless (no .html)');
  assert.ok(navHtml.includes('href="community/discord"'), 'discord link is extensionless');
  assert.ok(navHtml.includes('href="community/bedrock"'), 'dropdown has a Bedrock item');
  assert.ok(navHtml.includes('community-dropdown'), 'nav has the Community dropdown');
  assert.ok(navHtml.includes('id="nav-lang"'), 'nav carries the EN/PT switcher');
  assert.ok(navHtml.includes('data-lang="en"') && navHtml.includes('data-lang="pt"'), 'both EN and PT buttons render');
  assert.ok(navHtml.includes('id="nav-login"'), 'signed-out nav shows the Sign in link');
  assert.ok(navHtml.includes('href="account"'), 'Sign in points at the account page');
}

// Scenario B - signed in: the nav shows the username + Sign out instead.
{
  storage.set('ashen_auth_token', 'tok-123');
  storage.set('ashen_site_username', 'Asha');
  const { doc, calls } = makeDoc();
  runScripts(doc);
  fireInit(doc);

  const navHtml = calls['site-nav'].innerHTML;
  assert.ok(!navHtml.includes('id="nav-login"'), 'no Sign in link when authenticated');
  assert.ok(navHtml.includes('Signed in as'), 'signed-in label renders');
  assert.ok(navHtml.includes('Asha'), 'username renders in the nav');
  assert.ok(navHtml.includes('id="nav-logout"'), 'Sign out button renders');
}

// Scenario C - i18n: PT translation applies and persists; EN stays the fallback.
{
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
