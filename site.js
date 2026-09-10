(function () {
  'use strict';
  var cfg = window.ASHEN_SITE || {};

  // Pages under /community/ live one directory deep; every nav href gets a
  // base prefix so the same array works from index.html and the subpages.
  var depth = (location.pathname.replace(/\/+$/, '').split('/').length - 1);
  var base = depth > 1 ? '../' : '';
  function href(p) { return base + p; }

  var NAV = [
    { href: 'index.html', label: 'Home' },
    {
      label: 'Community',
      items: [
        { href: 'community/discord.html', label: 'Discord' },
        { href: 'community/bedrock.html', label: 'Bedrock' },
      ],
    },
    { href: 'map.html', label: 'Map' },
  ];

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

  function formatOnline(count) {
    if (count === null || count === undefined) return 'Players online: unknown';
    if (count === 1) return '1 player online';
    return count + ' players online';
  }
  window.AshenSite = { formatOnline: formatOnline };

  function pagePath(item) { return item.items ? null : item.href; }

  function renderNav(current) {
    var host = document.getElementById('site-nav');
    if (!host) return;
    var links = NAV.map(function (item) {
      if (item.items) {
        var sub = item.items.map(function (sub_item) {
          return '<a href="' + href(sub_item.href) + '">' + sub_item.label + '</a>';
        }).join('');
        return '<div class="nav-dropdown" id="community-dropdown">' +
          '<button type="button" class="nav-dropbtn">Community</button>' +
          '<div class="nav-dropdown-content">' + sub + '</div></div>';
      }
      var active = item.href === current ? ' class="active"' : '';
      return '<a href="' + href(item.href) + '"' + active + '>' + item.label + '</a>';
    }).join('');
    host.innerHTML = '<a href="' + href('index.html') + '" class="brand">AshenCraft</a>' + links;
  }
  window.AshenSite.renderNav = renderNav;

  // The nav lives in the page body while this script loads in <head>, so the
  // render (and the widget fetches, which also touch the DOM) must wait for
  // the document to be parsed. Without this the nav silently never renders.
  function init() {
    var file = location.pathname.split('/').pop() || 'index.html';
    var dir = location.pathname.replace(/\/+$/, '').split('/').slice(-2, -1)[0] || '';
    var page = dir === 'community' ? 'community/' + file : file;
    renderNav(page);

    // Live widgets - every fetch has a static fallback, never blank the page.
    fetch('/map/up/world/world/0', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (feed) {
        setText('players-online', formatOnline(feed && feed.currentcount));
      })
      .catch(function () { setText('players-online', formatOnline(null)); });

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
