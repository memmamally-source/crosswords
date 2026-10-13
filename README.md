# Crossword Hub

A free, browser-based crossword game with themed puzzles. No build step, no
dependencies: open `index.html` or host the folder on any static host
(GitHub Pages, Netlify, Vercel, S3…).

## Features

- **8 genres:** Animal Kingdom, Food & Drink, World Geography, Science Lab,
  Sports Arena, Music Hall, Outer Space, Myths & Legends. Each has 30 words
  and clues.
- **Fresh puzzles every time.** A built-in generator lays out a new, valid
  crossword from the genre's word bank on each play.
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
  id: 'movies',
  name: 'At the Movies',
  icon: '🎬',
  blurb: 'Films, stars and cinema lingo.',
  words: [
    ['DIRECTOR', 'Person who calls "Action!"'],
    // ...aim for 25+ words, 3–10 letters, letters only
  ],
},
```

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
