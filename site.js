(function () {
  'use strict';
  var cfg = window.ASHEN_SITE || {};

  // ── Auth (AshenAccount) ────────────────────────────────────────────────
  // Same accounts as the launcher and the dashboard: POST /api/auth/login and
  // /api/auth/register through this site's same-origin proxy. Tokens persist
  // in localStorage under the dashboard's key names so the whole ecosystem
  // shares one account.
  var TOKEN_KEY = 'ashen_auth_token';
  var REFRESH_KEY = 'ashen_refresh_token';
  var USER_KEY = 'ashen_site_username';

  function readJson(name) {
    try { return localStorage.getItem(name); } catch (e) { return null; }
  }
  function writeJson(name, value) {
    try {
      if (value === null) localStorage.removeItem(name);
      else localStorage.setItem(name, value);
    } catch (e) { /* private mode */ }
  }

  function siteApiBase() { return (cfg && cfg.apiUrl) || ''; }
  function siteToken() { return readJson(TOKEN_KEY); }
  function siteIsAuthenticated() { return !!siteToken(); }

  async function siteApi(path, options) {
    options = options || {};
    var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
    var token = siteToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    var body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    var base = siteApiBase();
    // Local dev (python serve.py) rides the same-origin proxy; when the page
    // is opened as a plain file (site-config fallback points at prod) go
    // cross-origin directly.
    var url = base && !base.startsWith('/') && location.protocol === 'file:' ? base + path : path;
    var res = await fetch(url, { method: options.method || 'GET', headers: headers, body: body });
    var data = null;
    var text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
    if (!res.ok) {
      var err = new Error((data && data.detail) ? String(data.detail) : ('HTTP ' + res.status));
      err.status = res.status;
      err.detail = data && data.detail;
      throw err;
    }
    return data;
  }

  async function siteLogin(username, password) {
    var data = await siteApi('/api/auth/login', { method: 'POST', body: { username: username, password: password } });
    if (data && data.access_token) {
      writeJson(TOKEN_KEY, data.access_token);
      if (data.refresh_token) writeJson(REFRESH_KEY, data.refresh_token);
      writeJson(USER_KEY, (data.account && data.account.username) || username);
    }
    return data;
  }

  async function siteRegister(username, password) {
    return siteApi('/api/auth/register', { method: 'POST', body: { username: username, password: password } });
  }

  async function siteLogout() {
    var refresh = readJson(REFRESH_KEY);
    writeJson(TOKEN_KEY, null);
    writeJson(USER_KEY, null);
    if (refresh) {
      writeJson(REFRESH_KEY, null);
      try {
        await siteApi('/api/auth/logout', { method: 'POST', body: { refresh_token: refresh } });
      } catch (e) { /* token already dead - the local session is gone either way */ }
    }
  }

  window.AshenSiteAuth = {
    isAuthenticated: siteIsAuthenticated,
    token: siteToken,
    username: function () { return readJson(USER_KEY); },
    login: siteLogin,
    register: siteRegister,
    logout: siteLogout,
    api: siteApi,
    TOKEN_KEY: TOKEN_KEY,
  };

  // ── Pages and nav ──────────────────────────────────────────────────────
  // Extensionless URLs are canonical (/account, /community/bedrock); the
  // server 301s the legacy .html paths onto them. Nav hrefs therefore never
  // carry .html. The base prefix keeps relative links resolving from
  // /community/* pages; the home address is special-cased to the ROOT
  // (href("") would self-link, which "refreshed" the map/account pages).
  var depth = (location.pathname.replace(/\/+$/, '').split('/').length - 1);
  var base = depth > 1 ? '../' : '';
  function href(p) {
    if (p === '' || p === 'index') return base ? base : '/';
    return base + p;
  }

  var NAV = [
    { href: '', labelKey: 'nav.home', key: 'home' },
    {
      labelKey: 'nav.community',
      items: [
        { href: 'community/discord', labelKey: 'nav.discord', key: 'discord' },
        { href: 'community/bedrock', labelKey: 'nav.bedrock', key: 'bedrock' },
      ],
    },
    { href: 'map', labelKey: 'nav.map', key: 'map' },
  ];

  function currentKey() {
    var path = location.pathname.replace(/\/+$/, '');
    if (path.endsWith('/account')) return 'account';
    if (path.endsWith('/map')) return 'map';
    if (path.endsWith('/community/discord')) return 'discord';
    if (path.endsWith('/community/bedrock')) return 'bedrock';
    return 'home';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHref(id, target) {
    var el = document.getElementById(id);
    if (!el) return;
    // Absolute targets (API download urls) pass through; relative paths get
    // the base prefix so they resolve from subdirectory pages too.
    el.setAttribute('href', /^(https?:|\/\/)/.test(target) ? target : href(target));
  }

  function formatOnline(count, t) {
    t = t || function (k, p) { return p ? k.replace('{count}', p.count) : k; };
    if (count === null || count === undefined) return t('home.players_unknown');
    if (count === 1) return t('home.players_one');
    return t('home.players_many', { count: count });
  }
  window.AshenSite = { formatOnline: formatOnline, avatarImg: avatarImgHtml };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Minecraft identity (avatar chip) ───────────────────────────────────
  // The skin head comes from this site's own /avatar/<uuid> proxy (no
  // third-party browser requests). Until it resolves - or when the account
  // has no linked identity at all - a "?" chip stands in, so the nav never
  // depends on the fetch to be usable.
  var PLACEHOLDER_AVATAR =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">' +
      '<rect width="32" height="32" rx="6" fill="#221B38"/>' +
      '<text x="16" y="22" font-family="Inter,Segoe UI,sans-serif" font-size="16" ' +
      'font-weight="700" fill="#C9BFE0" text-anchor="middle">?</text></svg>'
    );

  function identityState() {
    return window.__ashenIdentity || { uuid: null, name: null, loaded: false };
  }

  async function loadIdentity() {
    try {
      var data = await siteApi('/api/identities');
      var list = (data && data.identities) || [];
      var first = list.length ? list[0] : null;
      window.__ashenIdentity = {
        uuid: first ? first.minecraft_uuid : null,
        name: first ? first.minecraft_username : null,
        loaded: true,
      };
    } catch (e) {
      // Identities are decorative - a dead API keeps the plain "?" chip.
      window.__ashenIdentity = { uuid: null, name: null, loaded: true, failed: true };
    }
    renderNav();
  }

  function avatarSrc() {
    var uuid = typeof uuidArg === 'string' ? uuidArg : identityState().uuid;
    if (uuid && /^[0-9a-fA-F-]{36}$/.test(uuid)) {
      return '/avatar/' + uuid;
    }
    return PLACEHOLDER_AVATAR;
  }

  function avatarImgHtml(uuid, size) {
    // One shared builder for nav chip + account portal; size defaults to
    // the nav's 24px chip.
    size = size || 24;
    uuidArg = uuid;
    return '<img class="nav-avatar" alt="" width="' + size + '" height="' + size + '" src="' + avatarSrc() + '" />';
  }
  var uuidArg = null;

  function accountChipHtml(t) {
    var username = readJson(USER_KEY) || '';
    var identity = identityState();
    var label = escapeHtml(identity.loaded && identity.name ? identity.name : username);
    return (
      '<div class="nav-dropdown nav-account" id="nav-account">' +
      '<button type="button" class="nav-dropbtn nav-account-btn" id="nav-account-btn" aria-haspopup="true">' +
      avatarImgHtml() +
      '<span class="nav-account-name">' + label + '</span>' +
      '</button>' +
      '<div class="nav-dropdown-content nav-account-menu">' +
      '<a href="' + href('account') + '" data-i18n="nav.account_page">' + escapeHtml(t('nav.account_page')) + '</a>' +
      '<button type="button" id="nav-logout" data-i18n="nav.logout">' + escapeHtml(t('nav.logout')) + '</button>' +
      '</div></div>'
    );
  }

  function langSwitcherHtml(t) {
    var lang = window.AshenI18n.current();
    function btn(code, label) {
      var active = lang === code ? ' lang-active' : '';
      return '<button type="button" class="nav-lang-btn' + active + '" data-lang="' + code + '">' + label + '</button>';
    }
    return '<span class="nav-lang" id="nav-lang">' + btn('en', 'EN') + btn('pt', 'PT') + '</span>';
  }

  function bindNavHandlers(t) {
    var logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        siteLogout().finally(function () {
          // Re-render the nav so the login link comes back, then leave the
          // account page itself (it shows a signed-in profile when logged in).
          if (currentKey() === 'account') location.href = href('account');
          else renderNav();
        });
      });
    }
    var langHost = document.getElementById('nav-lang');
    if (langHost) {
      langHost.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('[data-lang]') : null;
        if (!btn) return;
        window.AshenI18n.apply(btn.getAttribute('data-lang'));
      });
    }
  }

  function renderNav() {
    var host = document.getElementById('site-nav');
    if (!host) return;
    var t = window.AshenI18n.t;
    var current = currentKey();

    function link(item) {
      return '<a href="' + href(item.href) + '"' + (item.key === current ? ' class="active"' : '') +
        ' data-i18n="' + item.labelKey + '">' + escapeHtml(t(item.labelKey)) + '</a>';
    }
    var links = NAV.map(function (item) {
      if (item.items) {
        var sub = item.items.map(function (sub_item) {
          return '<a href="' + href(sub_item.href) + '"' + (sub_item.key === current ? ' class="active"' : '') +
            ' data-i18n="' + sub_item.labelKey + '">' + escapeHtml(t(sub_item.labelKey)) + '</a>';
        }).join('');
        return '<div class="nav-dropdown" id="community-dropdown">' +
          '<button type="button" class="nav-dropbtn" data-i18n="' + item.labelKey + '">' + escapeHtml(t(item.labelKey)) + '</button>' +
          '<div class="nav-dropdown-content">' + sub + '</div></div>';
      }
      return link(item);
    }).join('');

    var accountBlock = siteIsAuthenticated()
      ? accountChipHtml(t)
      : '<a class="nav-auth-link" id="nav-login" href="' + href('account') + '">' + escapeHtml(t('nav.login')) + '</a>';

    host.innerHTML =
      '<a href="' + href('') + '" class="brand">AshenCraft</a>' +
      links +
      '<span class="nav-spacer"></span>' +
      accountBlock +
      langSwitcherHtml(t);

    bindNavHandlers(t);
  }
  window.AshenSite.renderNav = renderNav;

  // The nav lives in the page body while this script loads in <head>, so the
  // render (and the widget fetches, which also touch the DOM) must wait for
  // the document to be parsed. Without this the nav silently never renders.
  function init() {
    window.AshenI18n.apply(window.AshenI18n.initial());
    renderNav();

    if (siteIsAuthenticated()) loadIdentity();

    // Re-render the nav after every language switch (the auth block and the
    // switcher labels are part of the nav markup).
    document.addEventListener('ashen:lang', function () {
      renderNav();
      var feedCount = window.AshenSite._lastOnline;
      setText('players-online', formatOnline(feedCount === undefined ? null : feedCount, window.AshenI18n.t));
    });

    // Live widgets - every fetch has a static fallback, never blank the page.
    fetch('/map/up/world/world/0', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (feed) {
        var count = feed && feed.currentcount !== undefined ? feed.currentcount : null;
        window.AshenSite._lastOnline = count;
        setText('players-online', formatOnline(count, window.AshenI18n.t));
      })
      .catch(function () {
        window.AshenSite._lastOnline = null;
        setText('players-online', formatOnline(null, window.AshenI18n.t));
      });

    fetch('/api/launcher/version', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (v && v.download_url) {
          setHref('play-now', v.download_url);
          setText('play-now-version', 'v' + v.version);
        }
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
