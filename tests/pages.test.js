// The search-friendly pages in play/ are up to date: node tests/pages.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { build, SITE } = require('../tools/build-pages.js');
const { GENRES } = require('../js/genres.js');

const root = path.join(__dirname, '..');
const files = build();
for (const [f, text] of Object.entries(files)) {
  const p = path.join(root, f);
  assert.ok(fs.existsSync(p) && fs.readFileSync(p, 'utf8') === text, `${f} is out of date: run node tools/build-pages.js`);
}
// One page per genre and collection, each in the sitemap, with a title,
// description, canonical address and working play links.
const sitemap = files['sitemap.xml'];
for (const g of GENRES) {
  const html = files[`play/${g.id}/index.html`];
  assert.ok(html, `no page for ${g.id}`);
  assert.ok(sitemap.includes(`<loc>${SITE}play/${g.id}/</loc>`), `${g.id} missing from the sitemap`);
  assert.ok(/<title>[^<]+<\/title>/.test(html) && /name="description" content="[^"]{50,}"/.test(html), `${g.id}: title or description missing`);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE}play/${g.id}/" />`), `${g.id}: canonical`);
  assert.ok(html.includes(`href="../../#/new/${g.id}/`), `${g.id}: no play link`);
  // Sample clues are shown without answers, and none contains its own answer.
  const clues = [...html.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
  const byClue = new Map(g.words.map((w) => [w.clue, w.answer]));
  for (const clue of clues.filter((x) => byClue.has(x.replace(/ \(\d+\)$/, '').replace(/&amp;/g, '&')))) {
    const answer = byClue.get(clue.replace(/ \(\d+\)$/, '').replace(/&amp;/g, '&'));
    assert.ok(!clue.toUpperCase().replace(/[^A-Z]/g, '').includes(answer), `${g.id}: sample clue gives away ${answer}`);
  }
}
assert.ok(files['robots.txt'].includes(`Sitemap: ${SITE}sitemap.xml`));
console.log(`OK: ${GENRES.length} genre pages, the hub page, sitemap and robots.txt are up to date`);
