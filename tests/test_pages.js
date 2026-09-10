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
console.log('page structure OK');
