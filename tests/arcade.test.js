// Crossword Hub Arcade game logic: node tests/arcade.test.js
const assert = require('assert');
const A = require('../js/arcade.js');
const { GENRES } = require('../js/genres.js');

const pool = A.buildPool(GENRES);
const DAY = '2026-10-20';
const T0 = 1_800_000_000_000;

// ---------- The clue pool ----------
assert.ok(pool.all.length > 20000, `a large pool (${pool.all.length})`);
for (const level of ['easy', 'medium', 'hard', 'expert']) assert.ok(pool.byLevel[level].length > 1500, `${level}: ${pool.byLevel[level].length}`);
assert.strictEqual(new Set(pool.all.map((e) => e.answer)).size, pool.all.length, 'each answer once');
for (const e of pool.all) {
  assert.ok(/^[A-Z]{3,15}$/.test(e.answer), e.answer);
  assert.ok(e.clue && e.source, e.answer);
  const lengths = A.wordLengths(e);
  assert.strictEqual(lengths.reduce((a, b) => a + b, 0), e.answer.length, `${e.answer} lengths`);
}
assert.deepStrictEqual(A.wordLengths({ answer: 'LIVEAID', clue: 'Charity concert (4,3)' }), [4, 3]);
assert.deepStrictEqual(A.wordLengths({ answer: 'PARIS', clue: 'Capital' }), [5]);
// Mixed puzzles aren't a source of their own, and fan collections are never "easy".
assert.ok(!pool.all.some((e) => e.source === 'Mixed Bag'));
const themed = new Set(GENRES.filter((g) => g.themed).map((g) => g.name));
assert.ok(!pool.byLevel.easy.some((e) => themed.has(e.source)), 'fan collections start at Medium');

// ---------- Clue Blitz scoring and combos ----------
let run = A.newRun('blitz', pool, { seed: 42, now: T0, day: DAY });
assert.strictEqual(run.mode, 'blitz');
assert.strictEqual(run.endsAt - run.startedAt, 60000);
assert.strictEqual(A.timeLeft(run, T0 + 15000), 45000);
assert.ok(['easy', 'medium'].includes(run.clue.level), 'Blitz uses easy and medium clues');
const answer = () => run.clue.answer;
const points = [];
for (let i = 0; i < 5; i++) points.push(A.submit(run, pool, answer(), T0 + 1000 * (i + 1), DAY).points);
assert.deepStrictEqual(points, [100, 100, 125, 125, 125], '25 bonus from the third answer in a row');
assert.strictEqual(run.score, 575);
assert.strictEqual(run.combo, 5);
// Typing isn't a mistake: empty and part-filled guesses do nothing.
const before = JSON.stringify(run);
assert.strictEqual(A.submit(run, pool, '', T0 + 6000, DAY).result, 'empty');
assert.strictEqual(A.submit(run, pool, answer().slice(0, -1), T0 + 6000, DAY).result, 'incomplete');
assert.strictEqual(JSON.stringify(run), before, 'nothing changes before a full Submit');
// A wrong answer ends the combo but keeps the clue.
const clue = run.clue.answer;
const wrongGuess = clue.split('').reverse().join('') === clue ? 'Q'.repeat(clue.length) : clue.split('').reverse().join('');
assert.strictEqual(A.submit(run, pool, wrongGuess, T0 + 7000, DAY).result, 'wrong');
assert.strictEqual(run.combo, 0);
assert.strictEqual(run.clue.answer, clue, 'same clue after a wrong answer');
assert.strictEqual(run.score, 575, 'no points lost');
assert.strictEqual(A.submit(run, pool, answer(), T0 + 8000, DAY).points, 100, 'combo restarts');
assert.strictEqual(A.submit(run, pool, answer(), T0 + 8500, DAY).points, 100);
// Skipping is free but ends the combo.
const skipped = run.clue.answer;
const skip1 = A.skip(run, pool, T0 + 9000, DAY);
assert.strictEqual(skip1.result, 'skipped');
assert.strictEqual(skip1.answer, undefined, 'a skip never reveals the answer');
assert.ok(!run.log.some((l) => l.answer === skipped), 'skipped answers aren’t stored');
assert.notStrictEqual(run.clue.answer, skipped);
assert.strictEqual(run.combo, 0);
assert.strictEqual(run.score, 775);
assert.strictEqual(A.submit(run, pool, answer(), T0 + 9500, DAY).points, 100);
assert.strictEqual(run.bestCombo, 5);
// Lowercase, spaces and punctuation are fine.
const a = run.clue.answer;
assert.strictEqual(A.submit(run, pool, ` ${a.toLowerCase().split('').join(' ')} `, T0 + 9800, DAY).result, 'correct');
// Time's up: no more answers count.
assert.strictEqual(A.submit(run, pool, answer(), T0 + 60000, DAY).result, 'over');
assert.ok(run.finished);
assert.strictEqual(run.endedAt, run.endsAt);
const score = run.score;
assert.strictEqual(A.skip(run, pool, T0 + 61000, DAY).result, 'over');
assert.strictEqual(run.score, score);

// No repeats within a run, and the next clue can't be rerolled.
run = A.newRun('blitz', pool, { seed: 7, now: T0, day: DAY });
for (let i = 0; i < 150; i++) A.skip(run, pool, T0 + 100 * i, DAY);
assert.strictEqual(new Set(run.used).size, run.used.length, 'no clue twice in a run');
const r1 = A.newRun('blitz', pool, { seed: 99, now: T0, day: DAY });
const r2 = A.newRun('blitz', pool, { seed: 99, now: T0, day: DAY });
assert.deepStrictEqual(r1.clue, r2.clue, 'same seed, same clue');
A.skip(r1, pool, T0 + 1, DAY);
A.skip(r2, pool, T0 + 1, DAY);
assert.deepStrictEqual(r1.clue, r2.clue, 'same next clue');
// Recently seen answers are avoided in the next run.
const recent = A.remember([], run);
const next = A.newRun('blitz', pool, { seed: 7, now: T0, day: DAY, recent });
for (let i = 0; i < 40; i++) A.skip(next, pool, T0 + i, DAY);
assert.ok(!next.used.some((x) => recent.includes(x)), 'no repeats from the last run');
assert.ok(A.remember(Array.from({ length: 2000 }, (_, i) => `X${i}`), run).length <= A.RECENT_LIMIT);

// Refreshing: a saved run (JSON) carries on with the same clock and clue.
run = A.newRun('blitz', pool, { seed: 3, now: T0, day: DAY });
A.submit(run, pool, run.clue.answer, T0 + 2000, DAY);
const saved = JSON.parse(JSON.stringify(run));
assert.strictEqual(saved.endsAt, T0 + 60000, 'the clock is kept');
assert.deepStrictEqual(saved.clue, run.clue);
assert.strictEqual(A.isOver(saved, T0 + 59999, DAY), false);
assert.strictEqual(A.isOver(saved, T0 + 60000, DAY), true, 'it ran on while away');
assert.ok(A.finish(saved, T0 + 90000, DAY));
assert.strictEqual(saved.score, 100, 'the score reached is kept');

// ---------- Survival: lives, skips and difficulty ----------
run = A.newRun('survival', pool, { seed: 5, now: T0, day: DAY });
assert.strictEqual(run.lives, 3);
assert.strictEqual(run.round, 1);
const levels = [];
for (let i = 0; i < 45; i++) {
  levels.push([run.round, run.clue.level, run.clue.answer.length]);
  const res = A.submit(run, pool, run.clue.answer, T0 + i, DAY);
  assert.strictEqual(res.result, 'correct');
}
for (const [round, level, len] of levels) {
  const want = round <= 5 ? 'easy' : round <= 12 ? 'medium' : round <= 20 ? 'hard' : 'expert';
  assert.strictEqual(level, want, `round ${round} is ${want}`);
  if (round > 30) assert.ok(len >= 8, `round ${round} answers get longer`);
  if (round > 40) assert.ok(len >= 10, `round ${round} answers get longer still`);
}
assert.strictEqual(run.round, 46);
assert.strictEqual(run.score, 5 * 100 + 7 * 150 + 8 * 200 + 10 * 300 + 10 * 350 + 5 * 400);
assert.strictEqual(run.lives, 3, 'correct answers never cost lives');
// Typing isn't a mistake.
assert.strictEqual(A.submit(run, pool, '', T0, DAY).result, 'empty');
assert.strictEqual(A.submit(run, pool, 'AB', T0, DAY).result, 'incomplete');
assert.strictEqual(run.lives, 3);
// A wrong answer costs a life, shows the answer and moves on.
let c = run.clue.answer;
let res = A.submit(run, pool, 'Z'.repeat(c.length) === c ? 'Y'.repeat(c.length) : 'Z'.repeat(c.length), T0, DAY);
assert.deepStrictEqual([res.result, res.answer, res.over], ['wrong', undefined, false], 'the answer isn’t revealed');
assert.strictEqual(run.lives, 2);
assert.strictEqual(run.round, 47);
assert.notStrictEqual(run.clue.answer, c);
// Skipping costs a life too.
c = run.clue.answer;
res = A.skip(run, pool, T0, DAY);
assert.deepStrictEqual([res.result, res.answer, res.over], ['skipped', undefined, false]);
assert.ok(run.log.every((l) => l.ok), 'only correct answers are kept for the recap');
assert.strictEqual(run.lives, 1);
const roundBefore = run.round;
res = A.skip(run, pool, T0, DAY);
assert.ok(res.over);
assert.ok(run.finished);
assert.strictEqual(run.lives, 0);
assert.strictEqual(A.roundReached(run), roundBefore, 'the round it ended on');
assert.strictEqual(A.submit(run, pool, 'ANYTHING', T0, DAY).result, 'over');

// Refreshing never brings lives back, resets difficulty or rerolls the clue.
run = A.newRun('survival', pool, { seed: 11, now: T0, day: DAY });
for (let i = 0; i < 8; i++) A.submit(run, pool, run.clue.answer, T0, DAY);
A.skip(run, pool, T0, DAY);
const copy = JSON.parse(JSON.stringify(run));
assert.deepStrictEqual([copy.round, copy.lives, copy.score, copy.clue], [run.round, run.lives, run.score, run.clue]);
assert.strictEqual(copy.clue.level, 'medium');
// Resume any time that day; the run ends at the reset, keeping its score.
assert.strictEqual(A.isOver(copy, T0 + 3600e3, DAY), false);
assert.ok(A.finish(copy, T0 + 86400e3, '2026-10-21'));
assert.strictEqual(copy.endedBy, 'reset');
assert.strictEqual(copy.score, run.score);

// ---------- Personal bests ----------
let best = {};
let u = A.updateBest(best, { mode: 'blitz', score: 500, correct: 5, bestCombo: 3, endedAt: 1 });
assert.ok(u.isNew);
best = u.best;
u = A.updateBest(best, { mode: 'blitz', score: 400, correct: 4, bestCombo: 4, endedAt: 2 });
assert.ok(!u.isNew);
assert.strictEqual(u.best.blitz.score, 500);
u = A.updateBest(best, { mode: 'survival', score: 900, round: 9, endedAt: 3 });
assert.ok(u.isNew);
best = u.best;
u = A.updateBest(best, { mode: 'survival', score: 700, round: 12, endedAt: 4 });
assert.ok(u.isNew, 'a higher round is a personal best');
assert.deepStrictEqual([u.best.survival.score, u.best.survival.round], [900, 12]);
// Two devices (signed in): the better of each (merged with the rest of the progress).
const { mergeArcadeBest } = require('../js/sync.js');
const merged = mergeArcadeBest({ blitz: { score: 500, correct: 5 }, survival: { score: 900, round: 9, at: 1 } }, { blitz: { score: 800, correct: 8 }, survival: { score: 300, round: 14, at: 2 } });
assert.deepStrictEqual([merged.blitz.score, merged.survival.score, merged.survival.round], [800, 900, 14]);
assert.deepStrictEqual(mergeArcadeBest(undefined, undefined), {});

// ---------- Daily allowance: one Blitz and one Survival a day ----------
assert.strictEqual(A.LIMITS_ACTIVE, true, 'one game of each a day (owner’s decision, 20 October 2026)');
let ledger;
assert.ok(A.canStart('blitz', ledger, DAY).allowed);
ledger = A.recordAttempt(ledger, 'blitz', DAY);
assert.strictEqual(A.canStart('blitz', ledger, DAY).allowed, false, 'one Blitz a day');
assert.strictEqual(A.canStart('survival', ledger, DAY).allowed, true, 'separate allowances');
assert.strictEqual(A.attemptsToday(ledger, 'survival', DAY), 0);
// Switched off, it's unlimited.
assert.ok(A.canStart('blitz', ledger, DAY, { limitsActive: false }).allowed);
const on = { limitsActive: true };
ledger = undefined;
assert.deepStrictEqual(A.canStart('blitz', ledger, DAY, on), { allowed: true, limited: true, remaining: 1, used: 0 });
ledger = A.recordAttempt(ledger, 'blitz', DAY);
assert.strictEqual(A.canStart('blitz', ledger, DAY, on).allowed, false);
assert.strictEqual(A.canStart('survival', ledger, DAY, on).allowed, true);
assert.strictEqual(A.canStart('blitz', ledger, '2026-10-21', on).allowed, true, 'a new allowance after the reset');
assert.strictEqual(A.canStart('blitz', ledger, DAY, { ...on, premium: true }).allowed, true, 'Premium is unlimited');

console.log(`OK: Arcade logic (${pool.all.length} clues: ${Object.entries(pool.byLevel).map(([k, v]) => `${k} ${v.length}`).join(', ')})`);
