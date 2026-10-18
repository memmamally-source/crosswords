// Published puzzles must never change: node tests/puzzles.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { thaw } = require('../js/generator.js');
const { fingerprint, dir, indexFile, LAUNCH_MONTH } = require('../tools/freeze-puzzles.js');

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const months = Object.keys(index.months).sort();
const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)).sort();

// Every month from launch is frozen, with no gaps, and each file is exactly as
// it was frozen (editing one changes its fingerprint).
assert.deepStrictEqual(files, months, 'puzzles/ files and puzzles/index.json disagree');
assert.strictEqual(months[0], LAUNCH_MONTH, 'months must start at launch');
months.forEach((m, i) => {
  if (i) {
    const [y, mo] = months[i - 1].split('-').map(Number);
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
    assert.strictEqual(m, next, `gap in frozen months before ${m}`);
  }
  const text = fs.readFileSync(path.join(dir, `${m}.json`), 'utf8');
  assert.strictEqual(fingerprint(text), index.months[m], `puzzles/${m}.json was changed after it was frozen`);
});

// At least 60 days ahead (South African time) are frozen.
const pad = (n) => String(n).padStart(2, '0');
const ahead = new Date(Date.now() + 2 * 3600 * 1000 + 60 * 86400 * 1000);
const needMonth = `${ahead.getUTCFullYear()}-${pad(ahead.getUTCMonth() + 1)}`;
assert.ok(months[months.length - 1] >= needMonth, `freeze more months: run node tools/freeze-puzzles.js (need through ${needMonth})`);

// Every frozen puzzle is a valid, connected grid with a full set of days.
let total = 0;
for (const m of months) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, `${m}.json`), 'utf8'));
  assert.strictEqual(data.month, m);
  const [y, mo] = m.split('-').map(Number);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  for (const kind of ['daily', 'mini']) {
    assert.strictEqual(Object.keys(data[kind]).length, days, `${m}: ${kind} is missing days`);
    for (const [date, frozen] of Object.entries(data[kind])) {
      const p = thaw(frozen);
      const tag = `${kind} ${date}`;
      for (const w of p.words) {
        assert.ok(w.clue && w.answer.length >= 3, `${tag}: bad entry ${w.answer}`);
        w.cells.forEach(([r, c], i) => assert.strictEqual(p.solution[r][c], w.answer[i], `${tag}: ${w.answer} clashes`));
      }
      const filled = [];
      p.solution.forEach((row, r) => row.forEach((ch, c) => ch && filled.push(`${r},${c}`)));
      const seen = new Set([filled[0]]);
      const stack = [filled[0]];
      while (stack.length) {
        const [r, c] = stack.pop().split(',').map(Number);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${r + dr},${c + dc}`;
          if (p.solution[r + dr] && p.solution[r + dr][c + dc] && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
      }
      assert.strictEqual(seen.size, filled.length, `${tag}: grid is not connected`);
      total++;
    }
  }
}
console.log(`OK: ${total} frozen puzzles in ${months.length} months, unchanged and valid, frozen through ${months[months.length - 1]}`);
