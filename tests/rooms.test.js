// Multiplayer room helpers: node tests/rooms.test.js
const assert = require('assert');
const R = require('../js/rooms.js');

// Room ids: 12 lowercase letters/digits, random.
const ids = new Set(Array.from({ length: 200 }, () => R.newRoomId()));
assert.strictEqual(ids.size, 200, 'room ids repeat');
for (const id of ids) assert.ok(R.validRoomId(id), id);
for (const bad of ['', 'abc', 'ABCDEFGHIJKL', 'abcdefghijk!', 'abcdefghijklm', null, undefined]) assert.ok(!R.validRoomId(bad), String(bad));

// Squares: the grid ↔ room cells, and only real changes are sent.
const entries = [['C', 'A', 'T'], ['', '', 'O'], ['', '', 'P']];
const revealed = [[false, false, true], [false, false, false], [false, false, false]];
assert.deepStrictEqual(R.gridToCells(entries, revealed), { '0_0': { v: 'C' }, '0_1': { v: 'A' }, '0_2': { v: 'T', rev: true }, '1_2': { v: 'O' }, '2_2': { v: 'P' } });
const sent = R.gridToCells(entries, revealed);
assert.deepStrictEqual(R.diffCells(sent, entries, revealed), {}, 'nothing changed, nothing sent');
const next = entries.map((row) => row.slice());
next[0][0] = 'B'; // changed
next[2][2] = ''; // cleared
next[1][0] = 'X'; // new
assert.deepStrictEqual(R.diffCells(sent, next, revealed), { '0_0': { v: 'B' }, '1_0': { v: 'X' }, '2_2': null });
const rev2 = revealed.map((row) => row.slice());
rev2[1][2] = true;
assert.deepStrictEqual(R.diffCells(sent, entries, rev2), { '1_2': { v: 'O', rev: true } }, 'a reveal is sent');
assert.deepStrictEqual(R.parseKey('12_3'), [12, 3]);

// Names: safe characters only, 1 to 20 long.
assert.strictEqual(R.cleanName('  Alex  '), 'Alex');
assert.strictEqual(R.cleanName('Zoë'), 'Zoe');
assert.strictEqual(R.cleanName('<script>alert(1)</script>'), 'scriptalert1script');
assert.strictEqual(R.cleanName('A very long name that goes on and on'), 'A very long name tha');
assert.strictEqual(R.cleanName('🙂🙂'), '');
assert.strictEqual(R.cleanName(''), '');
assert.strictEqual(R.cleanName("O'Brien-Smith Jr."), "O'Brien-Smith Jr.");
for (let i = 0; i < 50; i++) assert.ok(R.cleanName(R.randomName()), 'random names are valid names');

// The shared clock.
assert.strictEqual(R.roomElapsed(30, 1000000, 1000000 + 45500), 75);
assert.strictEqual(R.roomElapsed(0, 2000, 1000), 0, 'never negative');

// Everyone's hints together.
assert.deepStrictEqual(R.sumHints({ a: { letter: 2, word: 1, checks: 3 }, b: { letter: 1, word: 0, checks: 0, autocheck: true } }), { letter: 3, word: 1, checks: 3, autocheck: true });
assert.deepStrictEqual(R.sumHints(null), { letter: 0, word: 0, checks: 0, autocheck: false });

// Seats: the player's own, else the first free one, else none (five max).
assert.strictEqual(R.freeSeat({}, 'u'), 1);
assert.strictEqual(R.freeSeat({ 1: { uid: 'h' }, 2: { uid: 'g' } }, 'u'), 3);
assert.strictEqual(R.freeSeat({ 1: { uid: 'h' }, 3: { uid: 'u' } }, 'u'), 3, 'rejoining keeps the seat');
const full = { 1: { uid: 'a' }, 2: { uid: 'b' }, 3: { uid: 'c' }, 4: { uid: 'd' }, 5: { uid: 'e' } };
assert.strictEqual(R.freeSeat(full, 'u'), null);
assert.strictEqual(R.freeSeat(full, 'c'), 3);
assert.strictEqual(R.MAX_PLAYERS, 5);

console.log('OK: room ids, square syncing, names, clock, hints and seats');
