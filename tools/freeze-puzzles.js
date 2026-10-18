#!/usr/bin/env node
// Saves ("freezes") every Daily, Mini and weekly Brutal Challenge so a
// published puzzle never changes, even when the word lists or the generator
// change later.
//
//   node tools/freeze-puzzles.js                 # freeze through 6 months ahead
//   node tools/freeze-puzzles.js --through 2027-06
//   node tools/freeze-puzzles.js --refreeze-from 2026-10-19
//
// --refreeze-from rebuilds the Dailies from that date on, after a change to
// the Daily's schedule. It refuses any date up to today (South African
// time), so a puzzle that has been published is never changed.
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

const sastToday = () => new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);

// Rebuilds the not-yet-published Dailies from `from` on, keeping every
// earlier day exactly as it was frozen.
function refreeze(from, index) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('--refreeze-from needs a date like 2026-10-19');
  if (from <= sastToday()) throw new Error(`${from} may already be published (today is ${sastToday()} in South Africa)`);
  for (const month of Object.keys(index.months).filter((m) => m >= from.slice(0, 7))) {
    const file = path.join(dir, `${month}.json`);
    const text = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(text);
    if (render(month, data.daily, data.mini) !== text) throw new Error(`${month}.json doesn't round-trip; not touching it`);
    let changed = 0;
    for (const date of Object.keys(data.daily)) {
      if (date < from) continue;
      const db = dailyBuild(date);
      data.daily[date] = freeze(generate(db.bank, db.options));
      changed++;
    }
    const next = render(month, data.daily, data.mini);
    fs.writeFileSync(file, next);
    index.months[month] = fingerprint(next);
    console.log(`Rebuilt ${changed} Dailies in ${month}`);
  }
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
  const from = process.argv.indexOf('--refreeze-from');
  if (from > 0) refreeze(process.argv[from + 1], index);
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
