// Analytics sends only allowed, non-personal fields: node tests/analytics.test.js
const assert = require('assert');
const { clean, ALLOWED } = require('../js/analytics.js');

// The events the site sends, and nothing else.
assert.deepStrictEqual(Object.keys(ALLOWED).sort(), ['arcade_end', 'arcade_start', 'autocheck_on', 'duel_create', 'duel_end', 'challenge_open', 'check_used', 'gift_create', 'hint_used', 'page_view', 'puzzle_complete', 'puzzle_start', 'return_visit', 'room_create', 'room_join', 'share'].sort());

// A gift sends only how many answers it has: never its clues, names or message.
assert.deepStrictEqual(clean('gift_create', { words: 8, title: 'For Alex', message: 'Love you', answer: 'PARIS' }), { words: 8 });

// The Arcade sends the mode and numbers only: never clues or answers.
assert.deepStrictEqual(clean('duel_end', { mode: 'mini', outcome: 'win', reason: 'solved', opponent: 'Ann', uid: 'abc' }), { mode: 'mini', outcome: 'win', reason: 'solved' }, 'no names or ids');
assert.deepStrictEqual(clean('arcade_end', { mode: 'blitz', score: 1250, correct: 12, round: 0, answer: 'PARIS', clue: 'Capital' }), { mode: 'blitz', score: 1250, correct: 12, round: 0 });

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
