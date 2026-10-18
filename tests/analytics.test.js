// Analytics sends only allowed, non-personal fields: node tests/analytics.test.js
const assert = require('assert');
const { clean, ALLOWED } = require('../js/analytics.js');

// The events the site sends, and nothing else.
assert.deepStrictEqual(Object.keys(ALLOWED).sort(), ['autocheck_on', 'challenge_open', 'check_used', 'hint_used', 'page_view', 'puzzle_complete', 'puzzle_start', 'return_visit', 'share'].sort());

// Unknown events are dropped.
assert.strictEqual(clean('gift_created', { story: 'We met in Paris' }), null);
assert.strictEqual(clean('login', { email: 'someone@example.com' }), null);

// Unknown fields are dropped, so answers, stories, names or emails can't slip through.
assert.deepStrictEqual(
  clean('puzzle_complete', { puzzle_kind: 'genre', category: 'tv', level: 'fan', genre: 'friends', seconds: 312, hint_points: 2, assisted: true, no_hint: false, challenge: false, answer: 'CENTRALPERK', email: 'a@b.co', name: 'Alex' }),
  { puzzle_kind: 'genre', category: 'tv', level: 'fan', genre: 'friends', seconds: 312, hint_points: 2, assisted: true, no_hint: false, challenge: false },
);
// Email-like values are dropped even in allowed fields; long strings and objects too.
assert.deepStrictEqual(clean('share', { method: 'someone@example.com', content_type: 'x'.repeat(101), item_id: { a: 1 } }), {});
assert.deepStrictEqual(clean('return_visit', { days_since_last_visit: 3 }), { days_since_last_visit: 3 });
assert.deepStrictEqual(clean('hint_used', { hint: 'letter', puzzle_kind: 'mini', clue: 'Capital of France' }), { hint: 'letter', puzzle_kind: 'mini' });

// No allowed field could carry personal or answer data by name.
const risky = /answer|clue|story|name|email|user|gift|message|text/i;
for (const [event, keys] of Object.entries(ALLOWED)) for (const k of keys) assert.ok(!risky.test(k) || k === 'page_title', `${event}.${k} looks personal`);

console.log('OK: analytics sends only allowed, non-personal fields');
