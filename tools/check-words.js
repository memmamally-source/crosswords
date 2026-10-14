#!/usr/bin/env node
// Checks the word lists for problems: node tools/check-words.js [genre ...]
// Reports duplicate answers, bad lengths and clues containing their own answer.
const { readLists } = require('./build-words.js');
const lists = readLists();
const strict = process.argv.includes('--strict');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
let problems = 0;
for (const [id, text] of Object.entries(lists)) {
  if (only.length && !only.includes(id)) continue;
  const entries = text.split('\n').map((l) => { const i = l.indexOf('|'); return { answer: l.slice(0, i), clue: l.slice(i + 1) }; });
  const seen = new Map();
  const answers = new Set(entries.map((e) => e.answer));
  const report = (msg) => { problems++; console.log(`${id}: ${msg}`); };
  for (const e of entries) {
    if (seen.has(e.answer)) report(`duplicate ${e.answer}`);
    seen.set(e.answer, true);
    if (e.answer.length < 3 || e.answer.length > 15) report(`${e.answer} has ${e.answer.length} letters`);
    const clue = strip(e.clue);
    if (new RegExp(`\\b${e.answer}`, 'i').test(clue.replace(/[^A-Za-z ]/g, ''))) report(`${e.answer} appears in its own clue: "${e.clue}"`);
    // Clues may mention other answers: the generator never puts such a pair
    // in the same puzzle. Pass --strict to list them anyway.
    if (strict) {
      for (const other of answers) {
        if (other !== e.answer && other.length >= 4 && new RegExp(`\\b${other}(s|es)?\\b`, 'i').test(clue)) {
          report(`clue for ${e.answer} mentions ${other}: "${e.clue}"`);
        }
      }
    }
  }
  if (only.length) console.log(`${id}: ${entries.length} entries`);
}
console.log(problems ? `${problems} problem(s)` : 'No problems');
process.exitCode = problems ? 1 : 0;
