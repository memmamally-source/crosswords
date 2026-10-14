# Crossword Hub

A browser-based crossword site with an academic daily puzzle, a quick daily
Mini, and themed puzzles in 33 genres. Everything is static HTML, CSS and
JavaScript with no build step, so it can be hosted anywhere (it runs on GitHub
Pages from the repository root).

## What's on the site

- **The Daily:** an academic crossword drawn from 23 subjects and about
  10,000 answers. Like a newspaper crossword it gets harder through the week:
  Monday is gentle, with 22 clues and shorter answers; Saturday is the
  toughest, with 34; Sunday has the largest grid, with 40 clues. Each clue shows its subject (this can be
  switched off in settings).
- **The Mini:** six quick clues of everyday and pop-culture answers.
- **Archive:** a calendar of every Daily and Mini since launch
  (1 September 2026), with solved, in-progress and finished-with-help marks.
- **Genre puzzles:** 33 genres in four groups, each with about 500 words.
  Easy puzzles have 12 clues, Medium 20 and Hard 30.
  - *Mixed:* Mixed Bag, Pop & Fun Mix, Academic Mix.
  - *Everyday:* Animal Kingdom, Food & Drink, World Geography, Science Lab,
    Sports Arena, Music Hall, Outer Space, Myths & Legends.
  - *Pop culture & fun:* Pop Culture, Movies & TV, Video Games, Holidays &
    Festivals.
  - *Academic:* Philosophy, Literature, Mathematics, Advanced Vocabulary, World
    History, Economics, Human Anatomy, Art & Architecture, Chemistry, Physics,
    Biology, Psychology, Computer Science, Law & Government, World Religions,
    Language & Linguistics, Earth Science, Latin & the Ancient World.
- **Statistics:** puzzles solved, Daily streaks, and average Daily time by
  day of the week.

## Solving

- Type to fill. Arrow keys move, Space or Enter switches direction, Tab jumps
  to the next clue, Backspace erases. On phones and tablets, tap a square to
  type with the device's own keyboard; tap the square again to switch
  direction.
- **Pencil** enters tentative letters in grey.
- **Check** and **Reveal** work on a square, a word or the whole puzzle.
  **Clear** removes incorrect squares, a word or everything.
- **Pause** (click the timer) hides the grid and stops the clock.
- **Settings** (the sun icon): light, dark or system theme; skip filled
  squares; auto-check; subject labels; show or hide the timer.
- Finishing shows your time, your streak for the Daily, and a **Share
  result** button that copies a summary.

Progress, times and streaks are stored in the browser's `localStorage`.

## Freshness

- **Genre puzzles** are built only from words you haven't seen in that genre.
  When the bank runs low a new cycle starts, still skipping the puzzle you just
  played. The chosen words are encoded in the puzzle's URL, so a shared link
  always rebuilds the same grid.
- **The Daily and the Mini** each use their own slice of a shuffled word bank
  each day, so answers don't come back for weeks. Everyone gets the same
  puzzle on a given date.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

Go to **Settings → Pages → Build and deployment**, choose "Deploy from a
branch", then pick the branch and `/ (root)`.

When you change the CSS or JavaScript, bump the `?v=` number on the
stylesheet and script tags in `index.html`, so browsers fetch the new files
instead of reusing cached ones.

## Adding words or a genre

Each genre's words live in `words/<id>.txt`, one entry per line:

```
PITSTOP | Quick halt for fresh tyres during a race
```

Answers are letters only, 3–15 long (multi-word answers drop their spaces;
add the word lengths in brackets in the clue, such as "(3,6)"). Lines starting
with `#` are comments. After editing, run:

```sh
node tools/dedupe-words.js   # drop repeated answers
node tools/check-words.js    # lengths, duplicates, answers inside their own clue
node tools/build-words.js    # compile words/*.txt into js/words.js
node tests/generator.test.js # takes a couple of minutes
```

`check-words.js --strict` also lists clues that mention other answers in the
genre. These don't need fixing: the generator never puts an answer in the same
puzzle as a clue that mentions it.

To add a genre, create its word file and add an entry to `BASE_GENRES` in
`js/genres.js`:

```js
{ id: 'cars', category: 'fun', name: 'Cars & Racing', icon: '🏎️', blurb: 'Motors, makers and motorsport.' },
```

`category` is one of `classic`, `fun` or `academic`. Academic genres feed the
Daily automatically, and the mixed genres pick up new words too.

The tests build every genre at every difficulty and eight weeks of Dailies
and Minis. They check that every grid is valid, connected and repeatable, and
that no clue gives away another answer in the same puzzle. They also check
that `js/words.js` is up to date.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure: masthead, home, archive, solving view, dialogs |
| `css/styles.css` | Styles, light and dark themes |
| `words/*.txt` | Word lists, one file per genre |
| `js/words.js` | Word lists compiled by `tools/build-words.js` (don't edit by hand) |
| `js/genres.js` | Genre groups, difficulty levels, Daily and Mini settings |
| `js/generator.js` | Seeded crossword layout generator and the daily word rotation |
| `js/app.js` | Game logic, solving tools, storage, stats, archive and routing |
| `tools/` | Word list tools: build, check and dedupe |
| `tests/generator.test.js` | Grid and clue validation |
