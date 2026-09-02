(function () {
  'use strict';
  var cfg = window.ASHEN_SITE || {};
  var NAV = [
    { href: 'index.html', label: 'Home' },
    { href: 'map.html', label: 'Live Map' },
  ];

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHref(id, href) {
    var el = document.getElementById(id);
    if (el) el.setAttribute('href', href);
  }

  function formatOnline(count) {
    if (count === null || count === undefined) return 'Players online: unknown';
    if (count === 1) return '1 player online';
    return count + ' players online';
  }
  window.AshenSite = { formatOnline: formatOnline };

  function renderNav(current) {
    var host = document.getElementById('site-nav');
    if (!host) return;
    var links = NAV.map(function (item) {
      var active = item.href === current ? ' class="active"' : '';
      return '<a href="' + item.href + '"' + active + '>' + item.label + '</a>';
    }).join('');
    host.innerHTML = '<a href="index.html" class="brand">AshenCraft</a>' + links;
  }
  window.AshenSite.renderNav = renderNav;

  var page = (location.pathname.split('/').pop() || 'index.html');
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
})();