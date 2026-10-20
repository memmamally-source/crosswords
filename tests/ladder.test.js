// Word Ladder rules, puzzles and records: node tests/ladder.test.js
const assert = require('assert');
const L = require('../js/ladder.js');
const data = require('../puzzles/ladder.json');

const lib = L.parse(data);
const T0 = 1_800_000_000_000;

// ---------- The words ----------
assert.ok(lib.words[4].size > 3000 && lib.words[5].size > 5000, 'plenty of accepted words');
for (const n of [4, 5]) {
  for (const w of lib.common[n]) assert.ok(lib.words[n].has(w), `${w}: every everyday word is accepted`);
  for (const w of lib.words[n]) assert.ok(/^[a-z]+$/.test(w) && w.length === n, `${w}: ${n} plain letters`);
}
for (const w of ['fuck', 'shit', 'cunt', 'nazi', 'rape']) assert.ok(!L.isWord(lib, w), `${w} isn't in the game`);
for (const w of ['john', 'tony', 'paris', 'texas']) assert.ok(!lib.common[w.length].has(w), `${w} is never in a puzzle or hint`);

// ---------- Every puzzle can be solved, in exactly its par ----------
assert.ok(lib.ladders.length > 800, `${lib.ladders.length} ladders`);
for (const level of ['easy', 'medium', 'hard', 'expert']) assert.ok(lib.byLevel[level].length >= 150, `${level}: ${lib.byLevel[level].length}`);
const ids = new Set();
for (const l of lib.ladders) {
  assert.ok(!ids.has(`${l.from}>${l.to}`), `${l.from}>${l.to} appears once`);
  ids.add(`${l.from}>${l.to}`);
  assert.ok(lib.common[l.len].has(l.from) && lib.common[l.len].has(l.to), `${l.id}: everyday start and target`);
  const path = L.shortestPath(l.from, l.to, lib.common[l.len]);
  assert.ok(path, `${l.id} ${l.from}>${l.to} can be solved`);
  assert.strictEqual(path.length - 1, l.par, `${l.id} ${l.from}>${l.to}: par is the shortest ladder`);
  for (let i = 1; i < path.length; i++) {
    assert.strictEqual(L.lettersChanged(path[i - 1], path[i]), 1);
    assert.ok(lib.common[l.len].has(path[i]), `${path[i]} is an everyday word`);
  }
}

// ---------- Shortest paths ----------
const set = new Set(['cold', 'cord', 'card', 'ward', 'warm', 'word', 'worm', 'corm']);
assert.deepStrictEqual(L.shortestPath('cold', 'warm', set).length, 5);
assert.deepStrictEqual(L.shortestPath('cold', 'cold', set), ['cold']);
assert.strictEqual(L.shortestPath('cold', 'zzzz', set), null, 'unreachable');
assert.strictEqual(L.shortestPath('cold', 'warms', set), null, 'different lengths');
const real = L.shortestPath('cold', 'warm', lib.common[4]);
assert.strictEqual(real.length - 1, 4, 'COLD to WARM in four moves');

// ---------- Checking moves ----------
assert.deepStrictEqual(L.checkMove(lib, 'cold', 'CORD'), { ok: true, word: 'cord' }, 'one letter changed, any case');
assert.strictEqual(L.checkMove(lib, 'cold', '').reason, 'empty');
assert.strictEqual(L.checkMove(lib, 'cold', 'cords').reason, 'length');
assert.strictEqual(L.checkMove(lib, 'cold', 'cold').reason, 'same');
assert.strictEqual(L.checkMove(lib, 'cold', 'card').reason, 'letters', 'two letters changed');
assert.strictEqual(L.checkMove(lib, 'cold', 'cxld').reason, 'word', 'not a word');
assert.strictEqual(L.checkMove(lib, 'cord', 'cold', ['cold', 'cord']).reason, 'used', 'no going round in circles');
assert.ok(L.checkMove(lib, 'cold', 'bold').ok);
assert.ok(L.checkMove(lib, 'stone', 'stole').ok, 'five letters');

// ---------- Hints ----------
let h = L.hint(lib, 'cold', 'warm');
assert.ok(L.checkMove(lib, 'cold', h).ok, `hint ${h} is a legal move`);
assert.strictEqual(L.shortestPath(h, 'warm', lib.common[4]).length - 1, 3, 'and on a shortest ladder');
for (const l of lib.ladders.slice(0, 200)) {
  // Following hints alone always reaches the target in par.
  let w = l.from;
  const used = [w];
  for (let i = 0; i < l.par; i++) {
    w = L.hint(lib, w, l.to, used);
    used.push(w);
  }
  assert.strictEqual(w, l.to, `${l.id}: hints lead to the target`);
}
// From an uncommon word, hints still find a way.
assert.ok(L.hint(lib, 'cole', 'warm'), 'a hint from an uncommon word');

// ---------- The Daily Ladder ----------
const day = '2026-10-20'; // a Tuesday
assert.strictEqual(L.weekday(day), 2);
const d1 = L.dailyLadder(lib, day);
assert.strictEqual(L.dailyLadder(lib, day), d1, 'the same ladder for everyone, every time');
assert.strictEqual(d1.len, 4, 'Daily Ladders have four letters');
assert.strictEqual(d1.level, 'easy', 'Tuesdays are easy');
assert.strictEqual(L.dailyLadder(lib, '2026-10-24').level, 'hard', 'Saturdays are hard');
const seen = new Set();
let day2 = day;
for (let i = 0; i < 120; i++) {
  const l = L.dailyLadder(lib, day2);
  assert.ok(!seen.has(l.id), `${day2}: no repeats for months`);
  seen.add(l.id);
  day2 = new Date(Date.UTC(+day2.slice(0, 4), +day2.slice(5, 7) - 1, +day2.slice(8, 10) + 1)).toISOString().slice(0, 10);
}

// ---------- Practice ----------
assert.deepStrictEqual([0, 1, 2].map(L.practiceLevel), ['easy', 'easy', 'easy']);
assert.ok([...Array(40).keys()].map(L.practiceLevel).includes('expert'), 'five-letter ladders come in later');
assert.ok(!['expert'].includes(L.practiceLevel(10)));
const recent = lib.byLevel.easy.slice(0, -1).map((l) => l.id);
assert.strictEqual(L.practiceLadder(lib, 0, recent, () => 0).id, lib.byLevel.easy[lib.byLevel.easy.length - 1].id, 'skips recent ladders');

// ---------- Playing ----------
const ladder = { id: 't', from: 'cold', to: 'warm', par: 4, len: 4, level: 'easy' };
let g = L.newGame(ladder, 'daily', { day, now: T0 });
assert.deepStrictEqual(L.play(lib, g, 'card', T0 + 1000), { result: 'bad', reason: 'letters' });
assert.strictEqual(L.moves(g), 0, 'a rejected word isn’t a move');
assert.deepStrictEqual(L.play(lib, g, 'cord', T0 + 2000), { result: 'ok' });
assert.ok(L.undo(g), 'take a step back');
assert.strictEqual(L.current(g), 'cold');
assert.ok(!L.undo(g), 'can’t go back past the start');
L.play(lib, g, 'cord', T0);
L.pause(g, T0 + 10_000); // leaves the page for a minute
L.resume(g, T0 + 70_000);
const hw = L.useHint(lib, g);
assert.ok(L.checkMove(lib, 'cord', hw).ok);
assert.strictEqual(g.hints, 1);
L.play(lib, g, 'card', T0);
L.play(lib, g, 'ward', T0);
const done = L.play(lib, g, 'warm', T0 + 80_000);
assert.strictEqual(done.result, 'done');
assert.strictEqual(done.moves, 4);
assert.strictEqual(done.time, 20_000, 'time away isn’t counted');
assert.strictEqual(done.score, 80, 'par, less 20 for the hint');
assert.strictEqual(L.play(lib, g, 'worm', T0).reason, 'done');
assert.strictEqual(L.score(4, 4, 0), 100);
assert.strictEqual(L.score(6, 4, 0), 80);
assert.strictEqual(L.score(20, 4, 3), 10, 'never below 10');

// ---------- Records ----------
let rec = L.record(undefined);
let r = L.finishGame(rec, g, T0);
assert.ok(r.isNew);
rec = r.record;
assert.deepStrictEqual(rec.daily[day], { id: 't', moves: 4, par: 4, time: 20_000, hints: 1, score: 80, at: T0 });
// A replay doesn't overwrite the day's result.
const again = L.newGame(ladder, 'daily', { day, now: T0, replay: true });
['cord', 'card', 'ward', 'warm'].forEach((w) => L.play(lib, again, w, T0 + 5000));
r = L.finishGame(rec, again, T0 + 9);
assert.ok(!r.isNew);
assert.strictEqual(r.record.daily[day].time, 20_000, 'the first finish stands');
// Practice records are separate.
const p = L.newGame(ladder, 'practice', { now: T0 });
['cord', 'card', 'ward', 'warm'].forEach((w) => L.play(lib, p, w, T0 + 7000));
rec = L.finishGame(rec, p, T0).record;
assert.deepStrictEqual([rec.practice.done, rec.practice.bestTime, rec.practice.fewest, rec.practice.perfect], [1, 7000, 4, 1]);
assert.strictEqual(Object.keys(rec.daily).length, 1, 'practice leaves the Daily alone');
const s = L.summary(rec, day);
assert.deepStrictEqual([s.dailyDone, s.streak, s.longest, s.practiceDone, s.completed, s.dailyPar], [1, 1, 1, 1, 2, 0]);
assert.deepStrictEqual(L.streaks(['2026-10-18', '2026-10-19', '2026-10-15'], '2026-10-20'), { current: 2, longest: 2 }, 'today not done yet');
assert.deepStrictEqual(L.summary(undefined, day).completed, 0, 'no record yet');

// Two devices.
const other = { daily: { [day]: { id: 't', moves: 6, par: 4, time: 9000, hints: 0, score: 80, at: T0 - 5 }, '2026-10-19': { id: 'u', moves: 3, par: 3, time: 5000, hints: 0, score: 100, at: 1 } }, practice: { done: 4, bestTime: 9000, fewest: 3, perfect: 0, recent: ['x'] } };
const m = L.merge(rec, other);
assert.strictEqual(m.daily[day].moves, 6, 'the earlier finish of a Daily wins');
assert.ok(m.daily['2026-10-19']);
assert.deepStrictEqual([m.practice.done, m.practice.bestTime, m.practice.fewest, m.practice.perfect], [4, 7000, 3, 1]);
assert.ok(!('games' in L.syncable(rec)), 'games in progress stay on the device');

console.log(`OK: Word Ladder (${lib.ladders.length} ladders: ${Object.entries(lib.byLevel).map(([k, v]) => `${k} ${v.length}`).join(', ')}; ${lib.words[4].size} + ${lib.words[5].size} words)`);
