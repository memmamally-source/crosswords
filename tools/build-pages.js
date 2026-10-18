#!/usr/bin/env node
// Search-friendly pages: one real page per genre and collection, a hub page
// listing them all, sitemap.xml and robots.txt.
//
//   node tools/build-pages.js           # write the pages
//   node tools/build-pages.js --check   # fail if they're out of date
//
// The puzzles themselves still run in the app (index.html, #/ addresses);
// each page links into it with #/new/<genre>/<level>, which opens a fresh
// puzzle. Rebuild after changing genres, collections or the asset version
// (tests/pages.test.js checks they're up to date).
const fs = require('fs');
const path = require('path');
const { GENRES, CATEGORIES, levelsFor } = require('../js/genres.js');

// The live site's address. Change it here if the site moves to its own domain.
const SITE = 'https://memmamally-source.github.io/crosswords/';
const root = path.join(__dirname, '..');
const VERSION = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const VERSION = (\d+);/)[1];
const OG_IMAGE = `${SITE}icons/og-image.png`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const withLength = (w) => (/\([\d,\- ]+\)$/.test(w.clue) ? w.clue : `${w.clue} (${w.answer.length})`);
const categoryOf = (g) => CATEGORIES.find((c) => c.id === g.category);

const ICON = '<svg viewBox="0 0 64 64" aria-hidden="true" width="34" height="34"><rect width="64" height="64" rx="12" fill="#1b2540"/><rect x="6" y="19" width="13" height="13" fill="#fffdf8"/><rect x="19" y="19" width="13" height="13" fill="#fffdf8"/><rect x="33" y="19" width="13" height="13" fill="#d4a12a"/><rect x="46" y="19" width="12" height="13" fill="#fffdf8"/><rect x="33" y="6" width="13" height="13" fill="#fffdf8"/><rect x="33" y="32" width="13" height="13" fill="#fffdf8"/><rect x="33" y="45" width="13" height="13" fill="#fffdf8"/></svg>';

function page({ title, description, url, up, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Crossword Hub" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="${up}icons/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,700&family=Public+Sans:wght@400;600;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${up}css/styles.css?v=${VERSION}" />
</head>
<body class="landing">
  <header class="landing-bar"><a class="landing-brand" href="${up}">${ICON}<span>Crossword Hub</span></a></header>
  <main class="landing-main">
${body}
  </main>
  <footer class="landing-foot">
    <a href="${up}#/daily">Today's Daily</a> · <a href="${up}#/mini">The Mini</a> · <a href="${up}#/brutal">The Brutal Challenge</a> · <a href="${up}play/">All crosswords</a>
    <p>Free to play, no sign-up needed.</p>
  </footer>
</body>
</html>
`;
}

// The first few easy clues, as a taste (never the answers).
function sampleClues(g) {
  const easy = g.themed ? g.words.filter((w) => w.tier === 'casual') : g.words.filter((w) => w.level === 'easy');
  return (easy.length >= 5 ? easy : g.words).slice(0, 5);
}

function genrePage(g) {
  const cat = categoryOf(g);
  const levels = levelsFor(g);
  const name = g.themed ? `${g.name} crossword` : `${g.name} crossword puzzles`;
  const description = `Free ${g.name} crosswords: ${g.blurb.replace(/\.$/, '')}. Play at ${Object.values(levels).map((l) => l.label).join(', ')} level, with a new puzzle every time. No sign-up.`;
  const siblings = GENRES.filter((x) => x.category === g.category && x.id !== g.id);
  const body = `    <p class="kicker">${esc(cat ? cat.name : 'Crossword')}${g.themed && g.category !== 'sport' ? ' · Unofficial fan crossword' : ''}</p>
    <h1>${esc(name)}</h1>
    <p class="landing-lede">${esc(g.blurb)}</p>
    <p class="landing-levels">${Object.entries(levels).map(([id, l], i) => `<a class="btn${i === 1 ? ' btn-primary' : ''}" href="../../#/new/${g.id}/${id}">Play ${esc(l.label)}</a>`).join(' ')}</p>
    <p class="landing-note">Free, with no sign-up: a new ${esc(g.name)} puzzle every time, from ${g.words.length.toLocaleString('en')} clues.</p>
    <h2>Sample clues</h2>
    <ul class="landing-clues">
${sampleClues(g).map((w) => `      <li>${esc(withLength(w))}</li>`).join('\n')}
    </ul>
${siblings.length ? `    <h2>More ${esc(cat ? cat.name.toLowerCase() : '')} crosswords</h2>
    <ul class="landing-links">
${siblings.map((x) => `      <li><a href="../${x.id}/">${esc(x.name)}</a></li>`).join('\n')}
    </ul>
` : ''}${g.themed ? `    <p class="landing-small">An unofficial fan crossword. Crossword Hub isn't affiliated with or endorsed by the owners of ${esc(g.name)}.</p>
` : ''}`;
  return page({ title: `${name[0].toUpperCase()}${name.slice(1)}: free online | Crossword Hub`, description, url: `${SITE}play/${g.id}/`, up: '../../', body });
}

function hubPage() {
  const body = `    <p class="kicker">Every crossword</p>
    <h1>Free online crosswords</h1>
    <p class="landing-lede">A crossword for every obsession: a daily crossword, a quick daily Mini, a weekly Brutal Challenge, and themed puzzles from TV, film and sport to philosophy and physics. All free, no sign-up.</p>
    <p class="landing-levels"><a class="btn btn-primary" href="../#/daily">Play today's Daily</a> <a class="btn" href="../#/mini">The Mini</a> <a class="btn" href="../#/brutal">The Brutal Challenge</a></p>
${CATEGORIES.map((c) => {
    const list = GENRES.filter((g) => g.category === c.id);
    return list.length ? `    <h2>${esc(c.name)}</h2>
    <ul class="landing-links">
${list.map((g) => `      <li><a href="${g.id}/">${esc(g.name)}</a></li>`).join('\n')}
    </ul>
` : '';
  }).join('')}`;
  return page({
    title: 'Free online crosswords: daily, themed and Brutal | Crossword Hub',
    description: 'Free online crosswords: a daily crossword, a daily Mini, a weekly Brutal Challenge and themed puzzles from TV, film, sport and gaming to science and history. No sign-up.',
    url: `${SITE}play/`,
    up: '../',
    body,
  });
}

// Every file this tool writes, as { relative path: contents }.
function build() {
  const files = { 'play/index.html': hubPage() };
  for (const g of GENRES) files[`play/${g.id}/index.html`] = genrePage(g);
  const urls = [SITE, `${SITE}play/`, ...GENRES.map((g) => `${SITE}play/${g.id}/`)];
  files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
  files['robots.txt'] = `User-agent: *
Allow: /
Sitemap: ${SITE}sitemap.xml
`;
  return files;
}

function main() {
  const files = build();
  const stale = Object.entries(files).filter(([f, text]) => {
    const p = path.join(root, f);
    return !fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text;
  }).map(([f]) => f);
  // Pages for genres that no longer exist.
  const playDir = path.join(root, 'play');
  const orphans = fs.existsSync(playDir) ? fs.readdirSync(playDir).filter((d) => !d.includes('.') && !files[`play/${d}/index.html`]) : [];
  if (process.argv.includes('--check')) {
    if (stale.length || orphans.length) {
      console.log(`Out of date: ${[...stale, ...orphans.map((d) => `play/${d}/ (no such genre)`)].join(', ')}\nRun: node tools/build-pages.js`);
      process.exitCode = 1;
    } else console.log(`OK: ${Object.keys(files).length} pages up to date`);
    return;
  }
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), text);
  }
  for (const d of orphans) fs.rmSync(path.join(playDir, d), { recursive: true });
  console.log(`Wrote ${Object.keys(files).length} files (${stale.length} changed${orphans.length ? `, removed ${orphans.length}` : ''})`);
}

if (require.main === module) main();
module.exports = { build, SITE };
