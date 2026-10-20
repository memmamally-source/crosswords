// Tests for merging progress between devices: node tests/sync.test.js
const assert = require('assert');
const { mergeStores, syncable, differs, MAX_SYNCED_SAVES } = require('../js/sync.js');

const local = {
  v: 2,
  settings: { theme: 'dark' },
  solves: {
    'daily:2026-10-01': { time: 300, clean: true, at: 10 },
    'daily:2026-10-02': { time: 200, clean: false, at: 10, letters: 4, words: 0 },
    'mini:2026-10-02': { time: 50, clean: true, at: 10 },
  },
  best: { 'space:easy': 120, 'food:hard': 900 },
  seen: { space: ['MARS', 'VENUS'] },
  lastWords: { space: ['MARS'] },
  solvedCount: 3,
  saves: {
    'daily:2026-10-05': { updated: 50, elapsed: 10 },
    'daily:2026-10-06': { updated: 10, elapsed: 5 },
    'daily:2026-10-07': { updated: 10, elapsed: 5 },
  },
};
const remote = {
  solves: {
    'daily:2026-10-01': { time: 250, clean: true, at: 20 }, // faster: wins
    'daily:2026-10-02': { time: 400, clean: true, at: 20 }, // clean beats assisted
    'daily:2026-10-03': { time: 100, clean: true, at: 20 }, // only in the account
    'daily:2026-10-07': { time: 99, clean: true, at: 20 }, // finished elsewhere after the local save
  },
  best: { 'space:easy': 150, 'art:medium': 400 },
  seen: { space: ['VENUS', 'PLUTO'], art: ['MONET'] },
  lastWords: { art: ['MONET'] },
  solvedCount: 5,
  saves: {
    'daily:2026-10-05': { updated: 40, elapsed: 99 }, // older than local
    'daily:2026-10-06': { updated: 60, elapsed: 30 }, // newer than local
  },
};

const m = mergeStores(local, remote);
assert.deepStrictEqual(m.settings, { theme: 'dark' }, 'device settings stay local');
assert.strictEqual(m.v, 2);
assert.strictEqual(m.solves['daily:2026-10-01'].time, 250);
assert.strictEqual(m.solves['daily:2026-10-02'].clean, true);
assert.ok(m.solves['daily:2026-10-03'] && m.solves['mini:2026-10-02']);
assert.deepStrictEqual(m.best, { 'space:easy': 120, 'food:hard': 900, 'art:medium': 400 });
assert.deepStrictEqual(m.seen.space.sort(), ['MARS', 'PLUTO', 'VENUS']);
assert.deepStrictEqual(m.seen.art, ['MONET']);
assert.deepStrictEqual(m.lastWords, { space: ['MARS'], art: ['MONET'] });
assert.strictEqual(m.solvedCount, 5);
assert.strictEqual(m.saves['daily:2026-10-05'].elapsed, 10, 'newer local save kept');
assert.strictEqual(m.saves['daily:2026-10-06'].elapsed, 30, 'newer account save kept');
assert.ok(!m.saves['daily:2026-10-07'], 'puzzle finished on another device is no longer in progress');

// No-Hint beats clean-but-checked, then fewer hint points, then faster.
{
  const pick = (a, b) => mergeStores({ solves: { k: a } }, { solves: { k: b } }).solves.k;
  assert.strictEqual(pick({ time: 500, clean: true, noHint: true, points: 0 }, { time: 100, clean: true, points: 0 }).time, 500, 'No-Hint beats a faster checked solve');
  assert.strictEqual(pick({ time: 100, clean: true, points: 3 }, { time: 300, clean: true, points: 1 }).time, 300, 'fewer hint points wins');
  assert.strictEqual(pick({ time: 100, clean: true, points: 1 }, { time: 300, clean: true, points: 1 }).time, 100, 'then the faster time');
}

// Merging is stable: doing it again changes nothing.
assert.ok(!differs(mergeStores(m, syncable(m)), m), 'merge is idempotent');
assert.ok(differs(local, m));

// Merging into an empty account or from an empty device keeps everything.
assert.deepStrictEqual(syncable(mergeStores(local, null)).solves, local.solves);
assert.deepStrictEqual(mergeStores({ settings: {} }, syncable(m)).solves, m.solves);

// Only the most recent in-progress puzzles go to the account.
const many = { saves: {} };
for (let i = 0; i < 30; i++) many.saves['play:x/easy/' + i + '/'] = { updated: i };
const kept = Object.keys(syncable(many).saves);
assert.strictEqual(kept.length, MAX_SYNCED_SAVES);
assert.ok(kept.includes('play:x/easy/29/') && !kept.includes('play:x/easy/0/'));

// Gift crosswords stay on the device: never copied to the account.
const withGift = syncable({ saves: { 'gift:abc': { entries: [], gift: 'zSECRET', updated: 9 }, 'daily:2026-10-01': { entries: [], updated: 1 } }, solves: { 'gift:abc': { time: 60 }, 'mini:2026-10-01': { time: 30 } } });
assert.deepStrictEqual(Object.keys(withGift.saves), ['daily:2026-10-01']);
assert.deepStrictEqual(Object.keys(withGift.solves), ['mini:2026-10-01']);
assert.ok(!JSON.stringify(withGift).includes('SECRET'));

// Arcade: personal bests sync (the better of each); runs in progress don't.
const arcadeLocal = { solves: {}, saves: {}, arcade: { best: { blitz: { score: 900, correct: 9 } }, runs: { blitz: { mode: 'blitz', score: 300 } }, recent: ['PARIS'] } };
const arcadeRemote = { arcadeBest: { blitz: { score: 700, correct: 7 }, survival: { score: 1200, round: 11, at: 5 } } };
const arcadeMerged = mergeStores(arcadeLocal, arcadeRemote);
assert.deepStrictEqual(arcadeMerged.arcade.best, { blitz: { score: 900, correct: 9 }, survival: { score: 1200, round: 11, at: 5 } });
assert.deepStrictEqual(arcadeMerged.arcade.runs, arcadeLocal.arcade.runs, 'this device keeps its run');
assert.deepStrictEqual(Object.keys(syncable(arcadeMerged)).includes('arcadeBest'), true);
assert.ok(!JSON.stringify(syncable(arcadeMerged)).includes('PARIS'), 'runs and recent clues stay on the device');
assert.ok(!differs(syncable(arcadeMerged), arcadeMerged), 'an account copy compares equal to the store it came from');

// The Arcade's daily allowance holds across devices for signed-in players.
const { mergeArcadeAttempts } = require('../js/sync.js');
const tried = mergeStores({ solves: {}, saves: {}, arcade: { attempts: { day: '2026-10-20', blitz: 1, survival: 0 } } }, { arcadeAttempts: { day: '2026-10-20', blitz: 0, survival: 1 } });
assert.deepStrictEqual(tried.arcade.attempts, { day: '2026-10-20', blitz: 1, survival: 1 });
assert.deepStrictEqual(mergeArcadeAttempts({ day: '2026-10-19', blitz: 1 }, { day: '2026-10-20', survival: 1 }), { day: '2026-10-20', survival: 1 }, 'the later day wins');
assert.strictEqual(mergeArcadeAttempts(null, undefined), null);
assert.deepStrictEqual(syncable(tried).arcadeAttempts, { day: '2026-10-20', blitz: 1, survival: 1 });

// Word Ladder: results and practice records travel; a game in progress doesn't.
const ladderPhone = { ladder: { daily: { '2026-10-20': { id: '4:1', moves: 5, par: 4, time: 30000, hints: 0, score: 90, at: 5 } }, practice: { done: 2, bestTime: 20000, fewest: 3, perfect: 1, recent: ['4:2'] }, games: { practice: { id: '4:9' } } } };
const ladderAccount = { ladder: { daily: { '2026-10-19': { id: '4:3', moves: 3, par: 3, time: 9000, hints: 0, score: 100, at: 1 } }, practice: { done: 5, bestTime: 25000, fewest: 4, perfect: 0, recent: [] } } };
const lm = mergeStores(ladderPhone, ladderAccount).ladder;
assert.deepStrictEqual(Object.keys(lm.daily).sort(), ['2026-10-19', '2026-10-20']);
assert.deepStrictEqual([lm.practice.done, lm.practice.bestTime, lm.practice.fewest, lm.practice.perfect], [5, 20000, 3, 1]);
assert.deepStrictEqual(lm.games, { practice: { id: '4:9' } }, 'this device keeps its game in progress');
assert.ok(!('games' in syncable(ladderPhone).ladder));
assert.ok(!differs({}, { ladder: undefined }), 'no Word Ladder record either side is no change');
const oldStore = mergeStores({ solves: {} }, {}).ladder;
assert.deepStrictEqual([Object.keys(oldStore.daily).length, oldStore.practice.done], [0, 0], 'stores from before Word Ladder');

console.log('OK: sync merge tests passed');
