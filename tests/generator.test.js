// Run with: node tests/generator.test.js
const assert = require('assert');
const { generate, rotatingPool, mentionedAnswers, layoutCode, fromLayoutCode, answerId } = require('../js/generator.js');

// No clue in a puzzle may mention another answer in the same puzzle.
function assertNoGiveaways(p, tag) {
  const placed = new Set(p.words.map((w) => w.answer));
  for (const w of p.words) {
    const hits = mentionedAnswers(w, placed);
    assert.strictEqual(hits.length, 0, `${tag}: clue for ${w.answer} gives away ${hits.join(', ')}: "${w.clue}"`);
  }
}
const { GENRES, DIFFICULTIES, levelsFor, bankFor, COLLECTIONS, DAILY_BANK, DAILY_SCHEDULE, EASIER_DAILY_FROM, MINI_BANK, MINI_CONFIG, DAILY_WINDOW, MINI_WINDOW } = require('../js/genres.js');

function runs(puzzle) {
  // Every horizontal/vertical run of 2+ letters in the grid.
  const out = [];
  const { rows, cols, solution } = puzzle;
  for (const [dir, R, C, at] of [
    ['across', rows, cols, (a, b) => solution[a][b]],
    ['down', cols, rows, (a, b) => solution[b][a]],
  ]) {
    for (let a = 0; a < R; a++) {
      let start = -1;
      for (let b = 0; b <= C; b++) {
        const ch = b < C ? at(a, b) : null;
        if (ch && start < 0) start = b;
        if (!ch && start >= 0) {
          if (b - start >= 2) out.push(dir + ':' + (dir === 'across' ? `${a},${start}` : `${start},${a}`));
          start = -1;
        }
      }
    }
  }
  return out.sort();
}

// js/words.js must be rebuilt after editing words/*.txt.
const build = require('../tools/build-words.js');
assert.strictEqual(require('fs').readFileSync(build.out, 'utf8'), build.render(build.readLists()), 'js/words.js is out of date: run node tools/build-words.js');

// The generator must keep building exactly the same grids: older genre
// share links are rebuilt by it. The bank comes from the frozen September
// puzzles, so only a change to the generator itself changes this fingerprint.
{
  const crypto = require('crypto');
  const sep = JSON.parse(require('fs').readFileSync(require.resolve('../puzzles/2026-09.json'), 'utf8'));
  const seen = new Set();
  const bank = [];
  for (const p of Object.values(sep.daily)) {
    for (const [answer, , , , clue, tag] of p.words) {
      if (seen.has(answer)) continue;
      seen.add(answer);
      bank.push({ answer, clue, tag, level: answer.length > 9 ? 'hard' : answer.length < 6 ? 'easy' : 'medium' });
    }
  }
  const out = [];
  for (const [count, maxSize, hard] of [[12, 13, 2], [20, 17, 5], [30, 21, 8], [40, 23, 8]]) {
    for (const seed of [1, 7, 42]) out.push(generate(bank, { count, maxSize, hard, seed }));
  }
  assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex'),
    '04181469584575e83328d42286a5868a6cf712557f98d95fdacad1e96ae6f627',
    'the generator now builds different grids: older shared genre links would open different puzzles');
}

// The snapshot used to open older genre links must never change.
{
  const crypto = require('crypto');
  const text = require('fs').readFileSync(require.resolve('../words/legacy-order.json'));
  assert.strictEqual(crypto.createHash('sha256').update(text).digest('hex'),
    '08c38c0e55ef06e3a8fc80a86fd6ff76a71000806c5d7a8bf6b2e12b2407070d', 'words/legacy-order.json was changed');
}

// The service worker caches the versioned scripts, so its version must match.
{
  const fs = require('fs');
  const swVersion = fs.readFileSync(require.resolve('../sw.js'), 'utf8').match(/const VERSION = (\d+);/)[1];
  const pageVersions = [...fs.readFileSync(require.resolve('../index.html'), 'utf8').matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
  assert.ok(pageVersions.length >= 5 && pageVersions.every((v) => v === swVersion), `sw.js VERSION ${swVersion} doesn't match index.html ?v= ${pageVersions}`);
}

// Every genre and collection has its own id.
assert.strictEqual(new Set(GENRES.map((g) => g.id)).size, GENRES.length, 'two genres or collections share an id');
// js/collections.js must be rebuilt after editing collections/*.txt.
{
  const coll = require('../tools/build-collections.js');
  assert.strictEqual(require('fs').readFileSync(coll.out, 'utf8'), coll.render(coll.readAll([])), 'js/collections.js is out of date: run node tools/build-collections.js');
}

let total = 0;
for (const genre of GENRES) {
  const answers = new Set(genre.words.map((w) => w.answer));
  assert.strictEqual(new Set(genre.words.map((w) => answerId(w.answer))).size, genre.words.length, `${genre.id}: two answers share a link id`);
  assert.strictEqual(answers.size, genre.words.length, `${genre.id}: duplicate answers`);
  // Themed collections play at Casual/Fan/Superfan, each ranking its clues differently.
  for (const [level, cfg] of Object.entries(levelsFor(genre))) {
    const bank = bankFor(genre, genre.words, level);
    for (let seed = 1; seed <= 10; seed++) {
      const p = generate(bank, { ...cfg, seed });
      const tag = `${genre.id}/${level}/seed ${seed}`;
      assert.strictEqual(p.words.length, cfg.count, `${tag}: placed ${p.words.length}/${cfg.count}`);
      const levels = new Map(bank.map((w) => [w.answer, w.level]));
      const hard = p.words.filter((w) => levels.get(w.answer) === 'hard').length;
      assert.strictEqual(hard, cfg.hard, `${tag}: ${hard} hard answers, wanted ${cfg.hard}`);
      assert.ok(p.rows <= cfg.maxSize + 4 && p.cols <= cfg.maxSize + 4, `${tag}: grid too big`);
      for (const w of p.words) {
        w.cells.forEach(([r, c], i) => assert.strictEqual(p.solution[r][c], w.answer[i], `${tag}: ${w.answer}`));
        assert.strictEqual(p.numbers[w.row][w.col], w.number, `${tag}: numbering`);
      }
      assertNoGiveaways(p, tag);
      // Share links rebuild the same grid.
      const { seed: _seed, ...grid } = p;
      const rebuilt = fromLayoutCode(layoutCode(p), genre.words);
      assert.deepStrictEqual(rebuilt && { ...rebuilt, words: rebuilt.words.map(({ answer, clue, dir, row, col, number, cells }) => ({ answer, clue, dir, row, col, number, cells })) },
        { ...grid, words: grid.words.map(({ answer, clue, dir, row, col, number, cells }) => ({ answer, clue, dir, row, col, number, cells })) }, `${tag}: link code doesn't rebuild the grid`);
      const expected = p.words.map((w) => `${w.dir}:${w.row},${w.col}`).sort();
      assert.deepStrictEqual(runs(p), expected, `${tag}: stray letter runs`);
      // Connected: flood fill from first letter reaches every letter.
      const filled = [];
      p.solution.forEach((row, r) => row.forEach((ch, c) => ch && filled.push(r + ',' + c)));
      const seen = new Set([filled[0]]);
      const stack = [filled[0]];
      while (stack.length) {
        const [r, c] = stack.pop().split(',').map(Number);
        for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const k = `${r+dr},${c+dc}`;
          if (p.solution[r+dr]?.[c+dc] && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
      assert.strictEqual(seen.size, filled.length, `${tag}: disconnected`);
      // Same seed -> same puzzle.
      assert.deepStrictEqual(generate(bank, { ...cfg, seed }).solution, p.solution, `${tag}: not deterministic`);
      total++;
    }
  }
}
// The Daily and the Mini: 8 weeks of each, built exactly as the site builds them.
// Starts at the gentler schedule; earlier Dailies are frozen and checked by puzzles.test.js.
const start = Math.floor(Date.UTC(...EASIER_DAILY_FROM.split('-').map((x, i) => Number(x) - (i === 1))) / 86400000);
const DAILY_LEVELS = new Map(DAILY_BANK.map((w) => [w.answer, w.level]));
let prevDaily = null;
let dailyRepeats = 0;
for (let day = start; day < start + 56; day++) {
  const sched = DAILY_SCHEDULE[(day + 4) % 7]; // 1 Jan 1970 was a Thursday
  const bank = rotatingPool(DAILY_BANK, day, DAILY_WINDOW, 1).filter((w) => w.answer.length <= sched.maxLen);
  const p = generate(bank, { count: sched.count, maxSize: sched.maxSize, hard: sched.hard, seed: day * 31 + 7 });
  assert.strictEqual(p.words.length, sched.count, `daily ${day} (${sched.day}): placed ${p.words.length}/${sched.count}`);
  const dailyHard = p.words.filter((w) => DAILY_LEVELS.get(w.answer) === 'hard').length;
  assert.strictEqual(dailyHard, sched.hard, `daily ${day} (${sched.day}): ${dailyHard} hard answers, wanted ${sched.hard}`);
  assert.ok(p.words.every((w) => w.tag), `daily ${day}: every clue has a subject label`);
  assertNoGiveaways(p, `daily ${day}`);
  const answers = p.words.map((w) => w.answer);
  if (prevDaily) dailyRepeats += answers.filter((a) => prevDaily.includes(a)).length;
  prevDaily = answers;
  const m = generate(rotatingPool(MINI_BANK, day, MINI_WINDOW, 2), { ...MINI_CONFIG, seed: day * 17 + 3 });
  assert.strictEqual(m.words.length, MINI_CONFIG.count, `mini ${day}: placed ${m.words.length}`);
  assertNoGiveaways(m, `mini ${day}`);
  const miniLevels = new Map(MINI_BANK.map((w) => [w.answer, w.level]));
  assert.ok(m.words.every((w) => miniLevels.get(w.answer) !== 'hard'), `mini ${day}: has a hard answer`);
  total += 2;
}
assert.ok(dailyRepeats <= 4, `too many answers repeated on consecutive days: ${dailyRepeats}`);
console.log(`OK: ${total} puzzles across ${GENRES.length} genres, the Daily and the Mini validated`);
