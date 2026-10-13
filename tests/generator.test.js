// Run with: node tests/generator.test.js
const assert = require('assert');
const { generate, rotatingPool } = require('../js/generator.js');
const { GENRES, DIFFICULTIES, DAILY_BANK, DAILY_SCHEDULE, MINI_BANK, MINI_CONFIG } = require('../js/genres.js');

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

let total = 0;
for (const genre of GENRES) {
  const answers = new Set(genre.words.map((w) => w.answer));
  assert.strictEqual(answers.size, genre.words.length, `${genre.id}: duplicate answers`);
  if (genre.category !== 'mixed') {
    // A clue must not give away another answer from the same genre.
    for (const w of genre.words) {
      for (const other of answers) {
        if (other !== w.answer && other.length >= 4 && new RegExp(`\\b${other}(s|es)?\\b`, 'i').test(w.clue.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
          assert.fail(`${genre.id}: clue for ${w.answer} contains answer ${other}: "${w.clue}"`);
        }
      }
    }
  }
  for (const [level, cfg] of Object.entries(DIFFICULTIES)) {
    for (let seed = 1; seed <= 20; seed++) {
      const p = generate(genre.words, { ...cfg, seed });
      const tag = `${genre.id}/${level}/seed ${seed}`;
      assert.strictEqual(p.words.length, cfg.count, `${tag}: placed ${p.words.length}/${cfg.count}`);
      assert.ok(p.rows <= cfg.maxSize + 4 && p.cols <= cfg.maxSize + 4, `${tag}: grid too big`);
      for (const w of p.words) {
        w.cells.forEach(([r, c], i) => assert.strictEqual(p.solution[r][c], w.answer[i], `${tag}: ${w.answer}`));
        assert.strictEqual(p.numbers[w.row][w.col], w.number, `${tag}: numbering`);
      }
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
      assert.deepStrictEqual(generate(genre.words, { ...cfg, seed }).solution, p.solution, `${tag}: not deterministic`);
      total++;
    }
  }
}
// The Daily and the Mini: 8 weeks of each, built exactly as the site builds them.
const start = Math.floor(Date.UTC(2026, 8, 1) / 86400000);
let prevDaily = null;
let dailyRepeats = 0;
for (let day = start; day < start + 56; day++) {
  const sched = DAILY_SCHEDULE[(day + 4) % 7]; // 1 Jan 1970 was a Thursday
  const bank = rotatingPool(DAILY_BANK, day, 80, 1).filter((w) => w.answer.length <= sched.maxLen);
  const p = generate(bank, { count: sched.count, maxSize: sched.maxSize, seed: day * 31 + 7 });
  assert.strictEqual(p.words.length, sched.count, `daily ${day} (${sched.day}): placed ${p.words.length}/${sched.count}`);
  assert.ok(p.words.every((w) => w.tag), `daily ${day}: every clue has a subject label`);
  const answers = p.words.map((w) => w.answer);
  if (prevDaily) dailyRepeats += answers.filter((a) => prevDaily.includes(a)).length;
  prevDaily = answers;
  const m = generate(rotatingPool(MINI_BANK, day, 30, 2), { ...MINI_CONFIG, seed: day * 17 + 3 });
  assert.strictEqual(m.words.length, MINI_CONFIG.count, `mini ${day}: placed ${m.words.length}`);
  total += 2;
}
assert.ok(dailyRepeats <= 4, `too many answers repeated on consecutive days: ${dailyRepeats}`);
console.log(`OK: ${total} puzzles across ${GENRES.length} genres, the Daily and the Mini validated`);
