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
- **A mix of easy and hard clues:** every puzzle has a set number of tough
  answers (2 on Easy, 5 on Medium, 8 on Hard; 3 on a Monday Daily rising to 8
  on Saturday and Sunday), and the rest lean towards easier ones. The Mini has
  no hard answers.
  - *Mixed:* Mixed Bag, Pop & Fun Mix, Academic Mix.
  - *Everyday:* Animal Kingdom, Food & Drink, World Geography, Science Lab,
    Sports Arena, Music Hall, Outer Space, Myths & Legends.
  - *Pop culture & fun:* Pop Culture, Movies & TV, Video Games, Holidays &
    Festivals.
  - *Academic:* Philosophy, Literature, Mathematics, Advanced Vocabulary, World
    History, Economics, Human Anatomy, Art & Architecture, Chemistry, Physics,
    Biology, Psychology, Computer Science, Law & Government, World Religions,
    Language & Linguistics, Earth Science, Latin & the Ancient World.
- **Statistics:** puzzles solved, Daily streaks, average Daily time by day
  of the week, Dailies solved with no help, and how many letters and words
  you've revealed in Dailies.

## Solving

The grid sits on a dark board (navy in light mode, near-black in dark mode),
so every answer reads as a clear strip of squares. The current square is
gold, with a small arrow showing across or down. The current word is blue
and the crossing word lightly tinted. Finished words get a ✓ in the clue list
and the clue bar.

- Type to fill. Arrow keys move, Space or Enter switches direction, Tab jumps
  to the next clue, Backspace erases. On phones and tablets, tap a square to
  type with the device's own keyboard; tap the square again to switch
  direction.
- **Pencil** enters tentative letters in grey.
- **Check** and **Reveal** work on a square, a word or the whole puzzle.
  **Check → Auto-check** stays on, marking wrong letters as you type, until
  you switch it off (the Check button turns dark while it's on).
  **Clear** removes incorrect squares, a word or everything.
- **Pause** (click the timer) hides the grid and stops the clock.
- **Settings** (the sun icon): light, dark or system theme; skip filled
  squares; auto-check; subject labels; show or hide the timer.
- Finishing shows your time, your streak for the Daily, and a **Share
  result** button that copies a summary.

- **Feel:**
  - Letters pop in as you type, and a finished word ripples.
  - Wrong letters shake when Check or auto-check finds them.
  - A clean solve sets off a golden wave across the grid and a burst of confetti.
  - A progress bar shows how much of the grid is filled, and the home page shows your Daily streak.
  - On phones, a tab bar along the bottom switches sections, and Android phones vibrate on taps, finished words and wins. Vibration can be turned off in settings; iPhones don't allow websites to vibrate.
  - All motion is skipped when the device asks for reduced motion.

Progress, times and streaks are stored in the browser's `localStorage`.
Players can also sign in to keep them in sync across devices (see Sign-in).

## Install as an app

The site installs like an app: it gets a home-screen icon, opens full screen
and works offline once it has loaded.

- **Android, and Chrome or Edge on a computer:** an **Install** button
  appears on the home page (or use the browser menu → Install app).
- **iPhone and iPad:** in Safari, tap Share → **Add to Home Screen**. The home
  page shows these steps.

`manifest.webmanifest` describes the app and `sw.js` (a service worker) saves
the site for offline use. The icons in `icons/` are drawn by
`tools/make-icons.py`.

## Published puzzles never change

- **The Daily and the Mini are frozen.** Every date from launch (1 September
  2026) through at least 60 days ahead is saved in `puzzles/YYYY-MM.json`,
  and the site plays those saved grids. Editing word lists or the generator
  never changes a published puzzle. `puzzles/index.json` holds each month's
  fingerprint, and the tests fail if a frozen month is edited or if fewer
  than 60 days ahead are frozen. To freeze more months:
  `node tools/freeze-puzzles.js` (or `--through 2027-12`). It only adds new
  months and never rewrites existing ones.
- **One official day for everyone:** a new Daily and Mini at midnight South
  African time (00:00 SAST, UTC+2). The time comes from the web server's
  clock, so a device set to the wrong date or time zone still gets the same
  puzzle as everyone else.
- **Genre puzzle links record the finished grid** (`#/play/<genre>/<level>/0/L…`),
  so a shared link opens the same puzzle even after word lists change.
  Older links (lists of word positions) are read against a snapshot of the
  word lists, `words/legacy-order.json`. A test locks the generator's output,
  because older links are rebuilt by it.

## Freshness

- **Genre puzzles** are built only from words you haven't seen in that genre.
  When the bank runs low a new cycle starts, still skipping the puzzle you just
  played. The chosen words are encoded in the puzzle's URL, so a shared link
  always rebuilds the same grid.
- **The Daily and the Mini** each use their own slice of a shuffled word bank
  each day, so answers don't come back for weeks.

## Sign-in

Signing in (with Google, or an email and password) keeps a player's streaks,
solves, best times and puzzles in progress the same on every device. It uses
Firebase and stays switched off, with no account button, until it's set up:

1. At [console.firebase.google.com](https://console.firebase.google.com),
   **Add project** (Google Analytics isn't needed).
2. **Build → Authentication → Get started.** Under **Sign-in method**, turn on
   **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains → Add domain:** the site's
   address, such as `memmamally-source.github.io`.
4. **Build → Firestore Database → Create database** (production mode, a
   location near your players).
5. **Firestore → Rules:** replace the rules with the contents of
   `firestore.rules`, then **Publish**. This lets each player read and write
   only their own progress.
6. **Project settings → Your apps → Web (`</>`):** register an app, copy the
   `firebaseConfig` values, and put them in `js/firebase-config.js`:
   `window.FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", appId: "…" };`
   These values aren't secret; the rules from step 5 protect the data.

Each player's progress is one document, `users/{uid}`. `js/sync.js` merges it
with what's on the device:
- A clean solve beats an assisted one, and the faster time wins.
- Seen words from both copies combine.
- The newest copy of a puzzle in progress wins.
- Device settings stay per device.

Firebase's free plan easily covers a site this size.

## Run locally

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

Go to **Settings → Pages → Build and deployment**, choose "Deploy from a
branch", then pick the branch and `/ (root)`.

When you change the CSS or JavaScript, bump the `?v=` number on the
stylesheet and script tags in `index.html` and `VERSION` in `sw.js` to the
same number, so browsers and installed apps fetch the new files instead of
reusing saved ones. The tests check that the two match.

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
python3 tools/rate-words.py  # rate answers easy/medium/hard (pip install wordfreq)
node tools/check-words.js    # lengths, duplicates, answers inside their own clue
node tools/build-words.js    # compile words/*.txt into js/words.js
node tests/generator.test.js # takes a couple of minutes
node tests/sync.test.js      # merging progress between devices
node tests/puzzles.test.js   # frozen puzzles are unchanged and far enough ahead
```

`rate-words.py` writes `words/levels.json`, rating each answer by how common
it is in everyday English. Answers it hasn't rated count as medium.

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
| `manifest.webmanifest`, `sw.js`, `icons/` | Installing as an app and working offline |
| `js/account.js`, `js/sync.js`, `js/firebase-config.js`, `firestore.rules` | Optional sign-in and syncing progress |
| `css/styles.css` | Styles, light and dark themes |
| `puzzles/` | Frozen Daily and Mini puzzles, one file per month, and their fingerprints |
| `words/*.txt` | Word lists, one file per genre |
| `words/levels.json` | Easy and hard answers, from `tools/rate-words.py` |
| `js/words.js` | Word lists compiled by `tools/build-words.js` (don't edit by hand) |
| `js/genres.js` | Genre groups, difficulty levels, Daily and Mini settings |
| `js/generator.js` | Seeded crossword layout generator and the daily word rotation |
| `js/app.js` | Game logic, solving tools, storage, stats, archive and routing |
| `tools/` | Word list tools: build, check and dedupe |
| `tests/generator.test.js` | Grid and clue validation |
