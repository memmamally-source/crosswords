#!/usr/bin/env node
// Saves ("freezes") every Daily, Mini and weekly Brutal Challenge so a
// published puzzle never changes, even when the word lists or the generator
// change later.
//
//   node tools/freeze-puzzles.js                 # freeze through 6 months ahead
//   node tools/freeze-puzzles.js --through 2027-06
//
// Writes one file per month, puzzles/YYYY-MM.json (Dailies and Minis) and
// puzzles/brutal-YYYY-MM.json (the Brutal Challenges of weeks starting that
// month), and records each file's fingerprint in puzzles/index.json. Months that are already frozen are never
// rewritten: only new months are added. The tests fail if a frozen file is
// edited, or if fewer than 60 days ahead are frozen.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { generate, freeze } = require('../js/generator.js');
const { dailyBuild, miniBuild, brutalBuild } = require('../js/genres.js');

const LAUNCH_MONTH = '2026-09';
const BRUTAL_LAUNCH_MONTH = '2026-10';
const dir = path.join(__dirname, '..', 'puzzles');
const indexFile = path.join(dir, 'index.json');

const pad = (n) => String(n).padStart(2, '0');
function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}
function daysIn(month) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
// Today's month in South Africa (UTC+2, no daylight saving).
function sastMonth(offsetMonths) {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
const fingerprint = (text) => crypto.createHash('sha256').update(text).digest('hex');

// One puzzle per line keeps diffs readable.
function render(month, daily, mini) {
  const block = (obj) => Object.entries(obj).map(([date, p]) => `    ${JSON.stringify(date)}: ${JSON.stringify(p)}`).join(',\n');
  return `{\n  "version": 1,\n  "month": ${JSON.stringify(month)},\n  "daily": {\n${block(daily)}\n  },\n  "mini": {\n${block(mini)}\n  }\n}\n`;
}

function buildMonth(month) {
  const daily = {};
  const mini = {};
  for (let d = 1; d <= daysIn(month); d++) {
    const date = `${month}-${pad(d)}`;
    const db = dailyBuild(date);
    daily[date] = freeze(generate(db.bank, db.options));
    const mb = miniBuild(date);
    mini[date] = freeze(generate(mb.bank, mb.options));
  }
  return render(month, daily, mini);
}

// The Mondays in a month, each starting a Brutal Challenge week.
function buildBrutalMonth(month) {
  const weeks = {};
  for (let d = 1; d <= daysIn(month); d++) {
    const date = `${month}-${pad(d)}`;
    if (new Date(`${date}T00:00:00Z`).getUTCDay() !== 1) continue;
    const b = brutalBuild(date);
    weeks[date] = freeze(generate(b.bank, b.options));
  }
  const block = Object.entries(weeks).map(([date, p]) => `    ${JSON.stringify(date)}: ${JSON.stringify(p)}`).join(',\n');
  return `{\n  "version": 1,\n  "month": ${JSON.stringify(month)},\n  "brutal": {\n${block}\n  }\n}\n`;
}

function readIndex() {
  return fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { version: 1, months: {} };
}

function main() {
  const arg = process.argv.indexOf('--through');
  const through = arg > 0 ? process.argv[arg + 1] : sastMonth(6);
  if (!/^\d{4}-\d{2}$/.test(through)) throw new Error('--through needs a month like 2027-06');
  fs.mkdirSync(dir, { recursive: true });
  const index = readIndex();
  let added = 0;
  for (let month = LAUNCH_MONTH; month <= through; month = nextMonth(month)) {
    const file = path.join(dir, `${month}.json`);
    if (index.months[month] || fs.existsSync(file)) continue; // frozen: never rewrite
    const text = buildMonth(month);
    fs.writeFileSync(file, text);
    index.months[month] = fingerprint(text);
    added++;
    console.log(`Froze ${month}`);
  }
  index.brutal = index.brutal || {};
  for (let month = BRUTAL_LAUNCH_MONTH; month <= through; month = nextMonth(month)) {
    const file = path.join(dir, `brutal-${month}.json`);
    if (index.brutal[month] || fs.existsSync(file)) continue; // frozen: never rewrite
    const text = buildBrutalMonth(month);
    fs.writeFileSync(file, text);
    index.brutal[month] = fingerprint(text);
    added++;
    console.log(`Froze Brutal Challenges for ${month}`);
  }
  index.months = Object.fromEntries(Object.entries(index.months).sort());
  index.brutal = Object.fromEntries(Object.entries(index.brutal).sort());
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');
  console.log(added ? `Added ${added} month(s); frozen through ${Object.keys(index.months).pop()}` : 'Nothing new to freeze');
}

if (require.main === module) main();
module.exports = { fingerprint, dir, indexFile, LAUNCH_MONTH, BRUTAL_LAUNCH_MONTH };
