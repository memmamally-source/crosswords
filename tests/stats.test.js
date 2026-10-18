// Streaks and player statistics: node tests/stats.test.js
const assert = require('assert');
const { dailyStreak, noHintStreak, hintsUsed, totals, favourites, addDays } = require('../js/stats.js');

const LAUNCH = '2026-09-01';
const TODAY = '2026-10-20';
const solve = (extra) => ({ time: 300, clean: true, at: 1, ...extra });

// No solves, no streak.
assert.deepStrictEqual(dailyStreak({}, TODAY, LAUNCH), { current: 0, longest: 0 });

// The Daily or the Mini counts; both on one day count once.
{
  const s = {
    'daily:2026-10-18': solve(),
    'mini:2026-10-19': solve(), // Mini only
    'daily:2026-10-20': solve(),
    'mini:2026-10-20': solve(), // both today: still one day
  };
  assert.deepStrictEqual(dailyStreak(s, TODAY, LAUNCH), { current: 3, longest: 3 });
}

// Assisted finishes count for the daily streak, but not the No-Hint streak.
{
  const s = {
    'daily:2026-10-18': solve({ clean: false, letters: 4, noHint: false }),
    'mini:2026-10-19': solve({ checked: true, noHint: false }),
    'daily:2026-10-20': solve({ noHint: true }),
  };
  assert.deepStrictEqual(dailyStreak(s, TODAY, LAUNCH), { current: 3, longest: 3 }, 'assisted solves count');
  assert.deepStrictEqual(noHintStreak(s, TODAY, LAUNCH), { current: 1, longest: 1 }, 'No-Hint needs genuinely unassisted Dailies');
}

// The No-Hint streak counts Dailies only, not Minis.
{
  const s = { 'mini:2026-10-19': solve({ noHint: true }), 'daily:2026-10-20': solve({ noHint: true }) };
  assert.deepStrictEqual(noHintStreak(s, TODAY, LAUNCH), { current: 1, longest: 1 });
}

// Today not done yet: the streak up to yesterday still stands. A gap breaks it.
{
  const s = { 'mini:2026-10-18': solve(), 'daily:2026-10-19': solve(), 'daily:2026-10-10': solve(), 'daily:2026-10-11': solve() };
  assert.deepStrictEqual(dailyStreak(s, TODAY, LAUNCH), { current: 2, longest: 2 });
  assert.deepStrictEqual(dailyStreak(s, '2026-10-21', LAUNCH), { current: 0, longest: 2 }, 'missing yesterday ends the streak');
}

// Other puzzles (genres, the Brutal Challenge) don't affect the daily streak.
assert.deepStrictEqual(dailyStreak({ 'play:space/easy/1/': solve(), 'brutal:2026-10-19': solve() }, TODAY, LAUNCH), { current: 0, longest: 0 });

// Streaks across a month and a year end.
{
  const s = {};
  for (let d = '2026-12-25'; d <= '2027-01-03'; d = addDays(d, 1)) s[`mini:${d}`] = solve();
  assert.deepStrictEqual(dailyStreak(s, '2027-01-03', LAUNCH), { current: 10, longest: 10 });
}

// Hints used: tracked solves count letters plus words; older solves (which
// counted a revealed word's letters too) count each word once.
assert.strictEqual(hintsUsed(solve({ hints: { letter: 2, word: 1 } })), 3);
assert.strictEqual(hintsUsed(solve({ hints: { letter: 1, rephrase: 0, word: 0 } })), 1, 'solves saved with the old rephrase field');
assert.strictEqual(hintsUsed(solve({ letters: 3, words: 0 })), 3);
assert.strictEqual(hintsUsed(solve({ letters: 9, words: 2 })), 2);
assert.strictEqual(hintsUsed(solve()), 0);

// Totals and the overall average time.
{
  const t = totals({ a: solve({ time: 100 }), b: solve({ time: 300, hints: { letter: 1, word: 1 } }), c: solve({ time: 0 }) });
  assert.strictEqual(t.solved, 3);
  assert.strictEqual(t.hints, 2);
  assert.strictEqual(t.averageTime, 200, 'solves without a time are left out of the average');
  assert.strictEqual(totals({}).averageTime, null);
}

// Favourite genres and collections, by finished puzzles.
{
  const s = {
    'play:friends/fan/0/L1': solve(), 'play:friends/casual/0/L2': solve(), 'play:friends/fan/3/': solve(),
    'play:space/easy/1/': solve(), 'play:space/hard/0/L3': solve(), 'play:art/medium/0/L4': solve(),
    'play:zelda/fan/0/L5': solve(), 'daily:2026-10-20': solve(),
  };
  assert.deepStrictEqual(favourites(s), [{ id: 'friends', count: 3 }, { id: 'space', count: 2 }, { id: 'art', count: 1 }]);
  assert.deepStrictEqual(favourites({}), []);
}

console.log('OK: streaks and player statistics');
