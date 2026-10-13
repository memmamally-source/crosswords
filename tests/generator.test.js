// Run with: node tests/generator.test.js
const assert = require('assert');
const { generate } = require('../js/generator.js');
const { GENRES, DIFFICULTIES } = require('../js/genres.js');

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
  for (const [level, cfg] of Object.entries(DIFFICULTIES)) {
    for (let seed = 1; seed <= 40; seed++) {
      const p = generate(genre.words, { ...cfg, seed });
      const tag = `${genre.id}/${level}/seed ${seed}`;
      assert.strictEqual(p.words.length, cfg.count, `${tag}: placed ${p.words.length}/${cfg.count}`);
      assert.ok(p.rows <= cfg.maxSize && p.cols <= cfg.maxSize, `${tag}: grid too big`);
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
console.log(`OK: ${total} puzzles across ${GENRES.length} genres validated`);
