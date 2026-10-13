#!/usr/bin/env node
// Removes later duplicate answers from word lists: node tools/dedupe-words.js [genre ...]
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'words');
const only = process.argv.slice(2);
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.txt'))) {
  const id = file.replace(/\.txt$/, '');
  if (only.length && !only.includes(id)) continue;
  const seen = new Set();
  let removed = 0;
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return true;
    const answer = t.slice(0, t.indexOf('|')).trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (seen.has(answer)) { removed++; return false; }
    seen.add(answer);
    return true;
  });
  fs.writeFileSync(path.join(dir, file), lines.join('\n'));
  if (removed) console.log(`${id}: removed ${removed} duplicate(s)`);
}
