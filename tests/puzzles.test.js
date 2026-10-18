// Published puzzles must never change: node tests/puzzles.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { thaw } = require('../js/generator.js');
const { fingerprint, dir, indexFile, LAUNCH_MONTH, BRUTAL_LAUNCH_MONTH } = require('../tools/freeze-puzzles.js');

const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
const months = Object.keys(index.months).sort();
const files = fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 7)).sort();

const brutalMonths = Object.keys(index.brutal || {}).sort();
const brutalFiles = fs.readdirSync(dir).filter((f) => /^brutal-\d{4}-\d{2}\.json$/.test(f)).map((f) => f.slice(7, 14)).sort();

// Every month from launch is frozen, with no gaps, and each file is exactly as
// it was frozen (editing one changes its fingerprint).
const pad = (n) => String(n).padStart(2, '0');
const ahead = new Date(Date.now() + 2 * 3600 * 1000 + 60 * 86400 * 1000);
const needMonth = `${ahead.getUTCFullYear()}-${pad(ahead.getUTCMonth() + 1)}`;
function checkMonths(list, onDisk, launch, fingerprints, file) {
  assert.deepStrictEqual(onDisk, list, 'puzzles/ files and puzzles/index.json disagree');
  assert.strictEqual(list[0], launch, 'months must start at launch');
  list.forEach((m, i) => {
    if (i) {
      const [y, mo] = list[i - 1].split('-').map(Number);
      const next = mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
      assert.strictEqual(m, next, `gap in frozen months before ${m}`);
    }
    const text = fs.readFileSync(path.join(dir, file(m)), 'utf8');
    assert.strictEqual(fingerprint(text), fingerprints[m], `puzzles/${file(m)} was changed after it was frozen`);
  });
  // At least 60 days ahead (South African time) are frozen.
  assert.ok(list[list.length - 1] >= needMonth, `freeze more months: run node tools/freeze-puzzles.js (need through ${needMonth})`);
}
checkMonths(months, files, LAUNCH_MONTH, index.months, (m) => `${m}.json`);
checkMonths(brutalMonths, brutalFiles, BRUTAL_LAUNCH_MONTH, index.brutal, (m) => `brutal-${m}.json`);

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
      checkGrid(thaw(frozen), `${kind} ${date}`);
      total++;
    }
  }
}
// Every Monday from the first Brutal month has its week's Brutal Challenge.
for (const m of brutalMonths) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, `brutal-${m}.json`), 'utf8'));
  assert.strictEqual(data.month, m);
  const [y, mo] = m.split('-').map(Number);
  const mondays = [];
  for (let d = 1; d <= new Date(Date.UTC(y, mo, 0)).getUTCDate(); d++) {
    if (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() === 1) mondays.push(`${m}-${pad(d)}`);
  }
  assert.deepStrictEqual(Object.keys(data.brutal), mondays, `brutal ${m}: missing weeks`);
  for (const [week, frozen] of Object.entries(data.brutal)) {
    const p = thaw(frozen);
    assert.strictEqual(p.words.length, 34, `brutal ${week}: ${p.words.length} clues`);
    checkGrid(p, `brutal ${week}`);
    total++;
  }
}

function checkGrid(p, tag) {
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
}
// When the next freeze is due: the tests start failing once fewer than 60
// days ahead are frozen. Warn a month before that.
const lastDay = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)); };
const lastFrozen = new Date(Math.min(lastDay(months[months.length - 1]), lastDay(brutalMonths[brutalMonths.length - 1])));
const due = new Date(lastFrozen.getTime() - 60 * 86400 * 1000).toISOString().slice(0, 10);
const daysLeft = Math.floor((Date.parse(due) - (Date.now() + 2 * 3600 * 1000)) / 86400000);
console.log(`Next freeze due by ${due} (${daysLeft} days): run node tools/freeze-puzzles.js and merge the result.`);
if (daysLeft <= 30) console.log('WARNING: the freeze is due within a month.');
console.log(`OK: ${total} frozen puzzles in ${months.length} months, unchanged and valid, frozen through ${months[months.length - 1]} (Brutal Challenges through ${brutalMonths[brutalMonths.length - 1]})`);
