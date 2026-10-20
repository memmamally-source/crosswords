// The server's puzzles: published ones (to check a claimed solve) and new
// duel puzzles, whose answers stay here.
const fs = require('fs');
const path = require('path');

const site = path.join(__dirname, 'site');
const G = require('./site/js/generator.js');
const genres = require('./site/js/genres.js');

const months = new Map();
function month(file) {
  if (!months.has(file)) {
    const p = path.join(site, 'puzzles', `${file}.json`);
    months.set(file, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
  }
  return months.get(file);
}

// Rows of letters ('' for black squares).
const rowsOf = (puzzle) => puzzle.solution.map((row) => row.map((ch) => ch || ''));

// A published Daily, Mini or Brutal Challenge's solution, or null.
function published(key) {
  const m = /^(daily|mini|brutal):(\d{4}-\d{2})-\d{2}$/.exec(key);
  if (!m) return null;
  const data = month(m[1] === 'brutal' ? `brutal-${m[2]}` : m[2]);
  const frozen = data && (m[1] === 'brutal' ? data.brutal : data[m[1]]);
  const p = frozen && frozen[key.slice(key.indexOf(':') + 1)];
  if (!p) return null;
  const puzzle = G.thaw(p);
  return { rows: puzzle.rows, cols: puzzle.cols, solution: rowsOf(puzzle) };
}

// A new duel puzzle from a random seed. The page gets the layout and clues
// with every answer hidden ("?" for each letter); the answers stay here.
function duel(mode, seed) {
  const n = seed % 10000;
  const built = mode === 'mini'
    ? G.generate(G.rotatingPool(genres.MINI_BANK, n, genres.MINI_WINDOW, 2), { count: genres.MINI_CONFIG.count, maxSize: genres.MINI_CONFIG.maxSize, hard: 0, seed })
    : G.generate(G.rotatingPool(genres.DAILY_BANK, n, genres.DAILY_WINDOW, 1).filter((w) => w.answer.length <= 10), { count: 22, maxSize: 17, hard: 2, seed });
  const frozen = G.freeze(built);
  const hidden = { rows: frozen.rows, cols: frozen.cols, words: frozen.words.map(([answer, ...rest]) => ['?'.repeat(answer.length), ...rest]) };
  return { hidden, solution: rowsOf(built), rows: built.rows, cols: built.cols };
}

// Firestore can't hold nested arrays: solutions are kept as strings.
const pack = (rows) => rows.map((row) => row.map((ch) => ch || '.').join(''));
const unpack = (rows) => rows.map((row) => row.split('').map((ch) => (ch === '.' ? '' : ch)));

module.exports = { published, duel, pack, unpack };
