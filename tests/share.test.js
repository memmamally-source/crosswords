// Sharing helpers: node tests/share.test.js
const assert = require('assert');
const { encodeChallenge, decodeChallenge, splitRoute, compareChallenge, msUntilNextDay, pagePath } = require('../js/share.js');

// Challenge codes round-trip and reject anything malformed.
const c = { time: 252, points: 3, noHint: false };
assert.strictEqual(encodeChallenge(c), '252.3.0');
assert.deepStrictEqual(decodeChallenge(encodeChallenge(c)), c);
assert.deepStrictEqual(decodeChallenge('95.0.1'), { time: 95, points: 0, noHint: true });
for (const bad of ['', 'abc', '1.2', '1.2.3', '-1.0.0', '1.0.0<script>', '9999999.0.0']) assert.strictEqual(decodeChallenge(bad), null, bad);

// Routes keep working with or without a challenge.
assert.deepStrictEqual(splitRoute('#/daily/2026-10-19'), { path: '#/daily/2026-10-19', challenge: null });
assert.deepStrictEqual(splitRoute('#/mini/2026-10-19?c=60.0.1'), { path: '#/mini/2026-10-19', challenge: { time: 60, points: 0, noHint: true } });
assert.deepStrictEqual(splitRoute('#/mini/2026-10-19?c=junk'), { path: '#/mini/2026-10-19', challenge: null });

// Fewer hint points wins, then the faster time.
assert.strictEqual(compareChallenge({ time: 500, points: 0 }, { time: 100, points: 2 }), 'beat');
assert.strictEqual(compareChallenge({ time: 100, points: 5 }, { time: 500, points: 2 }), 'lost');
assert.strictEqual(compareChallenge({ time: 90, points: 2 }, { time: 100, points: 2 }), 'beat');
assert.strictEqual(compareChallenge({ time: 100, points: 2 }, { time: 100, points: 2 }), 'tie');

// The next Daily: midnight South African time (22:00 UTC).
assert.strictEqual(msUntilNextDay(Date.UTC(2026, 9, 18, 21, 0)), 3600 * 1000, '23:00 SAST → 1 hour');
assert.strictEqual(msUntilNextDay(Date.UTC(2026, 9, 18, 22, 0)), 86400 * 1000, 'midnight SAST → a full day');
assert.strictEqual(msUntilNextDay(Date.UTC(2026, 9, 18, 10, 30)), 11.5 * 3600 * 1000);

// Analytics page names drop seeds, grid codes and challenges.
assert.strictEqual(pagePath('#/play/friends/fan/0/L0abc123.def?c=1.0.0'), '/play/friends/fan');
assert.strictEqual(pagePath('#/daily/2026-10-19?c=60.0.1'), '/daily');
assert.strictEqual(pagePath('#/brutal/2026-10-19'), '/brutal');
assert.strictEqual(pagePath('#/'), '/');
assert.strictEqual(pagePath('#/archive/mini'), '/archive');
assert.strictEqual(pagePath(''), '/');

console.log('OK: challenge links, countdown and page names');
