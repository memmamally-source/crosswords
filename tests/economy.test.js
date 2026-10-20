// Hint credits and duel rules: node tests/economy.test.js
const assert = require('assert');
const E = require('../js/economy.js');

// ---------- Days (midnight South African time) ----------
const t = (iso) => Date.parse(iso);
assert.strictEqual(E.sastDate(t('2026-10-20T21:59:59Z')), '2026-10-20');
assert.strictEqual(E.sastDate(t('2026-10-20T22:00:00Z')), '2026-10-21', 'midnight SAST is 22:00 UTC');
assert.strictEqual(E.sastDay(t('2026-10-20T22:00:00Z')) - E.sastDay(t('2026-10-20T21:59:59Z')), 1);
assert.strictEqual(E.dayToDate(E.sastDay(t('2026-10-20T12:00:00Z'))), '2026-10-20');
assert.strictEqual(E.msUntilReset(t('2026-10-20T21:00:00Z')), 3600000);

// ---------- Daily credits ----------
const D1 = E.sastDay(t('2026-10-20T08:00:00Z'));
let r = E.refreshDaily(undefined, D1);
assert.deepStrictEqual([r.wallet.daily, r.wallet.earned, r.granted, r.expired], [5, 0, 5, 0], 'a new player gets 5');
r = E.refreshDaily(r.wallet, D1);
assert.deepStrictEqual([r.wallet.daily, r.granted], [5, 0], 'never twice in a day');
let w = E.earn(r.wallet, 9, 'solves');
assert.strictEqual(E.available(w, D1), 14, '5 daily + 9 earned');
let s = E.spend(w, 3, D1);
assert.deepStrictEqual([s.wallet.daily, s.wallet.earned, s.fromDaily, s.fromEarned], [2, 9, 3, 0], 'daily credits first');
s = E.spend(s.wallet, 3, D1);
assert.deepStrictEqual([s.wallet.daily, s.wallet.earned, s.fromDaily, s.fromEarned], [0, 8, 2, 1], 'then earned ones');
assert.strictEqual(E.spend(E.blankWallet(), 1, D1), null, 'no credits, no spend');
assert.strictEqual(E.spend(s.wallet, 9, D1), null, 'never below zero');
assert.strictEqual(E.spend(s.wallet, 0, D1), null);
assert.strictEqual(E.spend(s.wallet, -3, D1), null, 'no negative spends');
// Next day: unused daily credits expire, earned ones stay.
w = E.spend(E.earn(E.refreshDaily(undefined, D1).wallet, 9, 'solves'), 3, D1).wallet;
assert.strictEqual(E.available(w, D1 + 1), 9, 'yesterday’s 2 can’t be spent today');
r = E.refreshDaily(w, D1 + 1);
assert.deepStrictEqual([r.wallet.daily, r.wallet.earned, r.expired], [5, 9, 2], '2 expire, 5 new, 9 kept');
assert.deepStrictEqual(r.wallet.totals, { earned: 9, spent: 3, solves: 9, wins: 0, granted: 10 });
// Days can be skipped: still just one allowance.
r = E.refreshDaily(r.wallet, D1 + 9);
assert.deepStrictEqual([r.wallet.daily, r.wallet.earned], [5, 9]);

// ---------- Rewards for solving ----------
assert.deepStrictEqual(E.puzzleReward('mini:2026-10-20', '2026-10-20'), { amount: 1, kind: 'mini' }, 'a Mini earns 1');
assert.deepStrictEqual(E.puzzleReward('daily:2026-10-20', '2026-10-20'), { amount: 3, kind: 'full' }, 'a Daily earns 3');
assert.deepStrictEqual(E.puzzleReward('daily:2026-09-05', '2026-10-20'), { amount: 3, kind: 'full' }, 'archive puzzles too');
assert.deepStrictEqual(E.puzzleReward('brutal:2026-10-19', '2026-10-20'), { amount: 3, kind: 'full' });
assert.strictEqual(E.puzzleReward('brutal:2026-10-20', '2026-10-20'), null, 'Brutal weeks start on a Monday');
assert.strictEqual(E.puzzleReward('daily:2026-10-21', '2026-10-20'), null, 'not tomorrow’s');
assert.strictEqual(E.puzzleReward('daily:2026-08-31', '2026-10-20'), null, 'not before launch');
assert.strictEqual(E.puzzleReward('play:general/medium/12/L3', '2026-10-20'), null, 'practice puzzles earn nothing');
assert.strictEqual(E.puzzleReward('gift:abc', '2026-10-20'), null);
assert.strictEqual(E.puzzleReward('daily:2026-10-20x', '2026-10-20'), null);

// ---------- Grids ----------
const sol = [['C', 'A', 'T'], ['', '', 'O'], ['', '', 'P']];
assert.deepStrictEqual(E.progress([['C', 'A', 'T'], ['', '', 'O'], ['', '', 'P']], sol), { total: 5, filled: 5, correct: 5, percent: 100, solved: true });
assert.deepStrictEqual(E.progress([['c', 'X', ''], ['', '', ''], ['', '', '']], sol), { total: 5, filled: 2, correct: 1, percent: 20, solved: false }, 'only correct squares count');
assert.deepStrictEqual(E.progress(null, sol).percent, 0);
assert.ok(E.validGrid([['A', ''], ['b', '']], 2, 2));
assert.ok(!E.validGrid([['A', 'BB'], ['', '']], 2, 2), 'one letter a square');
assert.ok(!E.validGrid([['A', '']], 2, 2), 'right shape');
assert.ok(!E.validGrid('CAT', 1, 3));
assert.ok(!E.validGrid([['1', '']], 1, 2));

// ---------- Duel rewards ----------
let pw = E.blankWallet();
const win = (opponent, extra = {}) => E.winReward(pw, { day: D1, opponent, seconds: 90, mode: 'mini', reason: 'solved', ...extra });
assert.deepStrictEqual(win('b'), { amount: 3, why: 'win' });
assert.strictEqual(win('b', { reason: 'forfeit' }).amount, 0, 'forfeits earn nothing');
assert.strictEqual(win('b', { seconds: 5 }).amount, 0, 'impossibly fast wins earn nothing');
assert.strictEqual(win('b', { mode: 'classic', seconds: 40 }).why, 'too-fast');
pw = E.recordWinReward(pw, D1, 'b');
pw = E.recordWinReward(pw, D1, 'b');
assert.deepStrictEqual(win('b'), { amount: 0, why: 'opponent-limit' }, 'two rewarded wins a day against the same player');
assert.strictEqual(win('c').amount, 3, 'a different opponent still counts');
pw = E.recordWinReward(pw, D1, 'c');
assert.deepStrictEqual(win('d'), { amount: 0, why: 'daily-limit' }, 'three rewarded wins a day');
assert.strictEqual(E.winReward(pw, { day: D1 + 1, opponent: 'b', seconds: 90, mode: 'mini', reason: 'solved' }).amount, 3, 'limits reset at midnight');
pw = E.recordWinReward(pw, D1 + 1, 'b');
assert.deepStrictEqual([pw.wins, pw.opponents], [1, { b: 1 }]);

// ---------- Duel records ----------
let st = E.applyOutcome(undefined, { mode: 'mini', outcome: 'win', seconds: 80, solved: true, credits: 3 });
st = E.applyOutcome(st, { mode: 'classic', outcome: 'win', seconds: 600, solved: true, credits: 3 });
st = E.applyOutcome(st, { mode: 'mini', outcome: 'win', seconds: 70, solved: true, credits: 0 });
st = E.applyOutcome(st, { mode: 'mini', outcome: 'loss' });
st = E.applyOutcome(st, { mode: 'mini', outcome: 'win', seconds: 20, solved: false }); // opponent left
st = E.applyOutcome(st, { mode: 'classic', outcome: 'draw' });
assert.deepStrictEqual(st, { played: 6, won: 4, lost: 1, draws: 1, miniWins: 3, classicWins: 1, best: { mini: 70, classic: 600 }, streak: 0, longest: 3, credits: 6 });
assert.strictEqual(E.winRate(st), 67);
assert.strictEqual(E.winRate(undefined), 0);

// ---------- Codes and names ----------
assert.ok(E.validCode('abcdefghjkmn'));
assert.ok(!E.validCode('abcdefghjkm'), 'twelve characters');
assert.ok(!E.validCode('ABCDEFGHJKMN'));
assert.ok(!E.validCode('abcdefghjkm0'), 'no look-alike characters');
assert.ok(E.validName("Jo O'Neil"));
assert.ok(!E.validName(''));
assert.ok(!E.validName('   '));
assert.ok(!E.validName('<script>'));
assert.ok(!E.validName('x'.repeat(21)));

console.log('OK: hint credits and duel rules');
