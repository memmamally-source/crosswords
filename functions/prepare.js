// Copies the site's shared code and frozen puzzles into functions/site/
// before deploying (firebase.json runs this), so the server checks answers
// with exactly the same puzzles and rules as the page.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'site');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });
fs.mkdirSync(path.join(out, 'puzzles'), { recursive: true });
for (const f of ['generator.js', 'words.js', 'genres.js', 'collections.js', 'economy.js']) {
  fs.copyFileSync(path.join(root, 'js', f), path.join(out, 'js', f));
}
let n = 0;
for (const f of fs.readdirSync(path.join(root, 'puzzles'))) {
  if (/^(brutal-)?\d{4}-\d{2}\.json$/.test(f)) {
    fs.copyFileSync(path.join(root, 'puzzles', f), path.join(out, 'puzzles', f));
    n++;
  }
}
const old = path.join(root, 'puzzles', 'superseded');
if (fs.existsSync(old)) {
  fs.mkdirSync(path.join(out, 'puzzles', 'superseded'), { recursive: true });
  for (const f of fs.readdirSync(old).filter((f) => /^\d{4}-\d{2}\.json$/.test(f))) {
    fs.copyFileSync(path.join(old, f), path.join(out, 'puzzles', 'superseded', f));
  }
}
console.log(`functions/site: shared code and ${n} puzzle files`);
