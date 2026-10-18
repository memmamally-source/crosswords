// Everything is free during the growth phase: node tests/access.test.js
// Every puzzle, at every level, opens without an account. If access rules
// are ever approved, update this test alongside js/access.js.
const assert = require('assert');
const { canAccess } = require('../js/access.js');
const { GENRES, levelsFor } = require('../js/genres.js');

let checked = 0;
const guests = [undefined, null, { signedIn: false }, { signedIn: true }];
for (const user of guests) {
  for (const kind of ['daily', 'mini', 'brutal']) {
    for (const date of ['2026-09-01', '2026-10-19', '2027-04-30']) {
      assert.ok(canAccess({ kind, date }, user).allowed, `${kind} ${date} must be free`);
      checked++;
    }
  }
  for (const genre of GENRES) {
    for (const level of Object.keys(levelsFor(genre))) {
      assert.ok(canAccess({ kind: 'genre', genre, difficulty: level }, user).allowed, `${genre.id}/${level} must be free`);
      checked++;
    }
  }
}
console.log(`OK: all ${checked / guests.length} puzzles and levels are free, signed in or not`);
