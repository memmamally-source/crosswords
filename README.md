# Crossword Hub

A free, browser-based crossword game with themed puzzles. No build step, no
dependencies: open `index.html` or host the folder on any static host
(GitHub Pages, Netlify, Vercel, S3…).

## Features

- **23 genres in four groups:**
  - *Mixed puzzles:* Mixed Bag (every genre), Pop & Fun Mix, Academic Mix.
  - *Everyday themes:* Animal Kingdom, Food & Drink, World Geography, Science
    Lab, Sports Arena, Music Hall, Outer Space, Myths & Legends.
  - *Pop culture & fun:* Pop Culture, Movies & TV, Video Games, Holidays &
    Festivals.
  - *Academic:* Philosophy, Literature, Mathematics, Advanced Vocabulary, World
    History, Economics, Human Anatomy, Art & Architecture.
- **Fresh puzzles every time.** A built-in generator lays out a new, valid
  crossword from the genre's word bank on each play.
- **Fewer repeats.** The game remembers the words you've seen in each genre
  and picks new puzzles that use mostly unseen ones.
- **Skip filled squares.** After you type a letter, the cursor jumps past
  squares that are already filled. Turn this off with the "Skip filled" toggle.
- **3 difficulty levels:** Easy (8 words), Medium (12), Hard (16).
- **Daily Challenge.** Everyone gets the same puzzle each day, and the theme
  rotates daily.
- **Shareable puzzles.** Each puzzle has its own URL
  (`#/play/<genre>/<difficulty>/<seed>`), so friends can play the same grid.
- Check or reveal a letter, word or the whole puzzle, plus an auto-check option.
- Timer, personal best times, a solved counter, and auto-save so a refresh
  doesn't lose your progress (all stored in `localStorage`).
- Keyboard controls (type, arrows, Space/Enter to switch direction, Tab for the
  next clue), plus an on-screen keyboard on phones and tablets.
- Light and dark themes that follow the system setting.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

Repository **Settings → Pages → Build and deployment**: set the source to
"Deploy from a branch", then pick the branch and `/ (root)`.

## Adding a genre or words

Edit `js/genres.js`. Add an entry like this to the `GENRES` array:

```js
{
  id: 'cars',
  category: 'fun', // one of: classic, fun, academic
  name: 'Cars & Racing',
  icon: '🏎️',
  blurb: 'Motors, makers and motorsport.',
  words: [
    ['PITSTOP', 'Quick halt for fresh tyres during a race'],
    // ...aim for 30+ words, mostly 4–10 letters, letters only
  ],
},
```

The mixed genres pick up new words automatically. The test also fails if a
clue gives away another answer in the same genre.

Then run the generator test to make sure every difficulty can still be built:

```sh
node tests/generator.test.js
```

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page markup |
| `css/styles.css` | Styles (light and dark) |
| `js/genres.js` | Genre word banks and difficulty settings |
| `js/generator.js` | Crossword layout generator (seeded, deterministic) |
| `js/app.js` | Game UI, input, checking, timer, storage, routing |
| `tests/generator.test.js` | Validates generated grids for every genre and difficulty |
