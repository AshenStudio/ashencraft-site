'use strict';
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');

assert.ok(html.includes('id="intro"'), 'home page has the intro section');
assert.ok(html.includes('home-section'), 'intro uses the shared section class');
assert.ok(!html.includes('class="features"'), 'features grid is removed');
for (const gone of [
  'Weapon-based skills',
  'Monsters and bosses',
  'Waystone network',
  'A real economy',
  'Group with up to four heroes',
  'A cinematic world',
]) {
  assert.ok(!html.includes(gone), 'removed card copy must not ship: ' + gone);
}
assert.ok(html.includes('id="play-now"'), 'launcher CTA stays');
assert.ok(html.includes('id="discord-invite"'), 'discord CTA stays');
assert.ok(html.includes('id="players-online"'), 'players-online chip stays');

// Copy pins (2026-09-10): shorter tagline, updated title, Community dropdown.
assert.ok(html.includes('<title>AshenCraft - Minecraft MMORPG</title>'), 'title is AshenCraft - Minecraft MMORPG');
assert.ok(!html.includes('A handcrafted fantasy MMORPG'), 'old handcrafted tagline is gone');
assert.ok(html.includes('A fantasy MMORPG built on Minecraft'), 'new tagline is in');
assert.ok(!html.includes('class="community"') || html.includes('community-dropdown'), 'nav dropdown markup is injected by site.js');
console.log('page structure OK');
