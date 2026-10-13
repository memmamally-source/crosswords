# Crossword Hub

A browser-based crossword site with an academic daily puzzle, a quick daily
Mini, and themed puzzles in 33 genres. Everything is static HTML, CSS and
JavaScript with no build step, so it can be hosted anywhere (it runs on GitHub
Pages from the repository root).

## What's on the site

- **The Daily:** an academic crossword drawn from 23 subjects and about 980
  answers. Like a newspaper crossword it gets harder through the week: Monday
  is gentle, with fewer clues and shorter answers; Saturday is the toughest;
  Sunday has the largest grid. Each clue shows its subject (this can be
  switched off in settings).
- **The Mini:** six quick clues of everyday and pop-culture answers.
- **Archive:** a calendar of every Daily and Mini since launch
  (1 September 2026), with solved, in-progress and finished-with-help marks.
- **Genre puzzles:** 33 genres in four groups.
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
  to the next clue, Backspace erases. Phones and tablets get an on-screen
  keyboard.
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
  each day, so answers don't come back for about twelve days. Everyone gets
  the same puzzle on a given date.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

Go to **Settings → Pages → Build and deployment**, choose "Deploy from a
branch", then pick the branch and `/ (root)`.

## Adding a genre or words

Edit `js/genres.js` and add an entry to the `BASE_GENRES` array:

```js
{
  id: 'cars',
  category: 'fun', // one of: classic, fun, academic
  name: 'Cars & Racing',
  icon: '🏎️',
  blurb: 'Motors, makers and motorsport.',
  words: [
    ['PITSTOP', 'Quick halt for fresh tyres during a race'],
    // ...aim for 40 words, mostly 4–10 letters, letters only
  ],
},
```

Academic genres feed the Daily automatically, and the mixed genres pick up
new words too. Then run the tests:

```sh
node tests/generator.test.js
```

The tests build every genre at every difficulty and eight weeks of Dailies
and Minis. They check that every grid is valid, connected and repeatable, and
that no clue gives away another answer in the same genre.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure: masthead, home, archive, solving view, dialogs |
| `css/styles.css` | Styles, light and dark themes |
| `js/genres.js` | Word banks, genre groups, difficulty levels, Daily and Mini settings |
| `js/generator.js` | Seeded crossword layout generator and the daily word rotation |
| `js/app.js` | Game logic, solving tools, storage, stats, archive and routing |
| `tests/generator.test.js` | Grid and clue validation |
