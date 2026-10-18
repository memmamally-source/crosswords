#!/usr/bin/env node
// Themed collections: one file per collection in collections/<id>.txt.
//
//   # Friends: unofficial fan crossword clues
//   @title Friends
//   @category tv            (tv, movies, anime, gaming, sport, music)
//   @blurb Central Perk, the apartments and six friends in New York.
//   @icon tv                (an icon name from ICONS in js/app.js)
//   CENTRAL PERK | Coffee house with an orange sofa (7,4) | casual
//   GUNTHER | Barista with a long-running crush | fan
//   ...                      (level: casual, fan or superfan)
//
//   node tools/build-collections.js            # check, then write js/collections.js
//   node tools/build-collections.js --check [id ...]   # check only
//
// Checks: header fields, levels, 3–15 letter answers, no repeated answers,
// no answer inside its own clue, multi-word answers given lengths like (7,4),
// enough clues at each level, and that every level builds full puzzles.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'collections');
const out = path.join(root, 'js', 'collections.js');
const CATEGORIES = ['tv', 'movies', 'anime', 'gaming', 'sport', 'music'];
const LEVEL_MARK = { casual: '+', fan: '', superfan: '!' };
const MIN_PER_LEVEL = 30;

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function readCollection(file) {
  const id = path.basename(file, '.txt');
  const meta = {};
  const entries = [];
  const problems = [];
  fs.readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const where = `${id}.txt:${i + 1}`;
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@')) {
      const sp = line.indexOf(' ');
      meta[line.slice(1, sp < 0 ? undefined : sp)] = sp < 0 ? '' : line.slice(sp + 1).trim();
      return;
    }
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length !== 3) return problems.push(`${where}: expected "ANSWER | clue | level"`);
    const [written, clue, level] = parts;
    const answer = strip(written).toUpperCase().replace(/[^A-Z]/g, '');
    if (!(level in LEVEL_MARK)) problems.push(`${where}: level must be casual, fan or superfan`);
    if (answer.length < 3 || answer.length > 15) problems.push(`${where}: ${answer} has ${answer.length} letters`);
    if (!clue) problems.push(`${where}: empty clue`);
    const words = strip(written).split(/[\s-]+/).filter((w) => /[A-Za-z]/.test(w));
    const lengths = clue.match(/\((\d{1,2}(?:[,\- ]+\d{1,2})*)\)$/);
    if (words.length > 1 && !lengths) problems.push(`${where}: multi-word answer ${written} needs its word lengths, like (7,4)`);
    if (lengths) {
      const want = words.map((w) => w.replace(/[^A-Za-z]/g, '').length).join(',');
      const given = lengths[1].split(/[,\- ]+/).filter(Boolean).join(',');
      if (want !== given) problems.push(`${where}: ${written} is (${want}), not (${lengths[1]})`);
    }
    if (new RegExp(`\\b${answer}`, 'i').test(strip(clue).replace(/[^A-Za-z ]/g, ''))) problems.push(`${where}: ${answer} appears in its own clue`);
    for (const w of words) {
      const bare = w.replace(/[^A-Za-z]/g, '');
      if (bare.length >= 4 && new RegExp(`\\b${bare}\\b`, 'i').test(strip(clue))) problems.push(`${where}: "${bare}" (part of the answer) appears in its own clue`);
    }
    entries.push({ answer, clue, level, where });
  });
  for (const f of ['title', 'category', 'blurb', 'icon']) if (!meta[f]) problems.push(`${id}: missing @${f}`);
  if (meta.category && !CATEGORIES.includes(meta.category)) problems.push(`${id}: @category must be one of ${CATEGORIES.join(', ')}`);
  const seen = new Map();
  for (const e of entries) {
    if (seen.has(e.answer)) problems.push(`${e.where}: ${e.answer} already used at ${seen.get(e.answer)}`);
    else seen.set(e.answer, e.where);
  }
  const counts = { casual: 0, fan: 0, superfan: 0 };
  entries.forEach((e) => counts[e.level] !== undefined && counts[e.level]++);
  for (const [lv, n] of Object.entries(counts)) if (n < MIN_PER_LEVEL) problems.push(`${id}: only ${n} ${lv} clues (need at least ${MIN_PER_LEVEL})`);
  return { id, meta, entries, problems, counts };
}

// Every level must build complete puzzles from this collection.
function checkBuilds(c) {
  const { generate } = require('../js/generator.js');
  const { THEMED_LEVELS, themedBank } = require('../js/genres.js');
  const words = c.entries.map((e) => ({ answer: e.answer, clue: e.clue, tier: e.level }));
  const problems = [];
  for (const [level, cfg] of Object.entries(THEMED_LEVELS)) {
    const bank = themedBank(words, level);
    let short = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const p = generate(bank, { count: cfg.count, maxSize: cfg.maxSize, hard: cfg.hard, seed });
      if (p.words.length < cfg.count) short++;
    }
    if (short) problems.push(`${c.id}: ${cfg.label} puzzles came up short ${short} of 6 times: add more ${level} clues`);
  }
  return problems;
}

function readAll(only) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort()
    .map((f) => path.join(dir, f))
    .filter((f) => !only.length || only.includes(path.basename(f, '.txt')))
    .map(readCollection);
}

function render(collections) {
  const data = collections.map((c) => ({
    id: c.id,
    title: c.meta.title,
    category: c.meta.category,
    blurb: c.meta.blurb,
    icon: c.meta.icon,
    words: c.entries.map((e) => `${LEVEL_MARK[e.level]}${e.answer}|${e.clue}`).join('\n'),
  }));
  return [
    '// Generated by tools/build-collections.js from collections/*.txt. Do not edit by hand.',
    `var CROSSWORD_COLLECTIONS = ${JSON.stringify(data)};`,
    "if (typeof module !== 'undefined' && module.exports) module.exports = CROSSWORD_COLLECTIONS;",
    '',
  ].join('\n');
}

function main() {
  const check = process.argv.includes('--check');
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const collections = readAll(only);
  let problems = 0;
  for (const c of collections) {
    const found = c.problems.length ? c.problems : checkBuilds(c);
    found.forEach((p) => console.log(p));
    problems += found.length;
    console.log(`${c.id}: ${c.entries.length} clues (casual ${c.counts.casual}, fan ${c.counts.fan}, superfan ${c.counts.superfan})${found.length ? '' : ' ✓'}`);
  }
  if (problems) {
    console.log(`${problems} problem(s)`);
    process.exitCode = 1;
    return;
  }
  if (!check) {
    fs.writeFileSync(out, render(readAll([])));
    console.log(`Wrote ${path.relative(root, out)} (${collections.length} collections)`);
  }
}

if (require.main === module) main();
module.exports = { readAll, render, out };
