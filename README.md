# Crossword Hub

A browser-based crossword site with an academic daily puzzle, a quick daily
Mini, and themed puzzles in 37 genres. Everything is static HTML, CSS and
JavaScript with no build step, so it can be hosted anywhere (it runs on GitHub
Pages from the repository root).

## What's on the site

**Everything is free and nothing needs an account:** every puzzle, level and
archive opens straight away. Signing in is optional, for syncing progress.
Every puzzle opens through one check, `canAccess` in `js/access.js`, which
always allows; `tests/access.test.js` keeps it that way.

The home page leads with today's Daily and Mini, the weekly Brutal Challenge,
your puzzles in progress (**Continue playing**), hand-picked
**Trending now** cards, this week's Dailies, every genre, and your stats.

**Changing Trending now:** edit the list in `js/featured.js`. Each card opens a
genre (or any site link) and has a short label, a spoiler-free title, a
colour and an icon. Nothing is featured automatically.

**Brand:** deep navy, charcoal, a warm paper white and gold. Headlines use
Newsreader; everything else uses Public Sans. The logo is an across word and a
down word crossing at one gold square (the "hub"). `tools/make-icons.py`
draws the app icons.

- **The Daily:** an academic crossword drawn from 23 subjects and about
  10,000 answers. Like a newspaper crossword it gets harder through the week:
  Monday is gentle, with 18 clues, shorter answers and one tough answer;
  Saturday is the toughest, with 28 clues and 5 tough answers; Sunday has the
  largest grid, with 34 clues. (Until 18 October 2026 the Daily was bigger and
  harder: 22 to 40 clues with 3 to 8 tough answers. Those Dailies keep their
  original sizes.) Each clue shows its subject (this can be switched off in
  settings).
- **The Mini:** six quick clues of everyday and pop-culture answers.
- **Archive:** a calendar of every Daily and Mini since launch
  (1 September 2026), with solved, in-progress and finished-with-help marks.
- **The Brutal Challenge:** one Brutal puzzle a week, the same for everyone:
  34 clues from every genre and no easy answers. A new one starts each Monday
  (South African time), at `#/brutal`.
- **Genre puzzles:** 37 genres in four groups, each with about 500 words, at
  five levels:

  | Level | Clues | Tough answers |
  |---|---|---|
  | Easy | 12 | 2 |
  | Medium | 20 | 5 |
  | Hard | 30 | 8 |
  | Expert | 32 | 12 |
  | Brutal | 34 | 16, and no easy answers at all |
- **A mix of easy and hard clues:** every puzzle has a set number of tough
  answers (see the table; 1 on a Monday Daily rising to 5 on Saturday), and the rest lean towards easier ones. The Mini has no hard
  answers.
  - *Mixed:* Mixed Bag, Pop & Fun Mix, Academic Mix.
  - *Everyday:* Animal Kingdom, Food & Drink, World Geography, Science Lab,
    Sports Arena, Music Hall, Outer Space, Myths & Legends, Travel & Landmarks,
    General Knowledge.
  - *Pop culture & fun:* Pop Culture, Movies & TV, Video Games, Holidays &
    Festivals, Technology & Gadgets.
  - *Academic:* Philosophy, Literature, Mathematics, Advanced Vocabulary, World
    History, Economics, Human Anatomy, Art & Architecture, Chemistry, Physics,
    Biology, Psychology, Computer Science, Law & Government, World Religions,
    Language & Linguistics, Earth Science, Latin & the Ancient World, Medicine &
    Health.
- **Statistics:**
  - totals: puzzles solved and Dailies finished
  - streaks: the daily streak and the longest streak
  - times: the average across all puzzles, the average Daily, and the Daily
    by day of the week
  - hints: total hints used, Dailies with no help, and letters and words
    revealed in Dailies
  - your favourite genres and collections
  - the No-Hint Club
- **The daily streak:** finishing the Daily or the Mini, with or without
  hints or checks, keeps the streak going. Finishing both on the same day
  counts once. The No-Hint streak is separate and counts only Dailies
  finished with no reveals or checks. Streaks are worked out from saved
  solves (`js/stats.js`), so they follow these rules for past days too.

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
- **On phones held upright** the clue bar is docked at the bottom, just
  above the keyboard:
  - Its big ‹ › buttons and a swipe left or right move between clues.
  - Tapping the clue opens **All clues**, a panel listing every clue; tap
    one to jump to it.
  - The grid scrolls by itself to keep the square you're typing in visible.
  - On tablets and phones held sideways, the clues sit beside the grid and
    the header is compact.
- **Pencil** enters tentative letters in grey.
- **Check** and **Reveal** work on a square, a word or the whole puzzle.
  **Check → Auto-check** stays on, marking wrong letters as you type, until
  you switch it off (the Check button turns dark while it's on).
  **Clear** removes incorrect squares, a word or everything.
- **Pause** (click the timer) hides the grid and stops the clock.
- **Settings** (the sun icon): light, dark or system theme; skip filled
  squares; auto-check; subject labels; show or hide the timer.
- Finishing shows your time, hint points, your streak for the Daily and
  Mini, and, for today's Daily or Mini, when the next ones arrive.
- **Sharing a result:**
  - **Share** opens the phone's share sheet with a result image.
  - **WhatsApp** opens WhatsApp with a summary and a challenge link.
  - **Copy challenge link** copies the link alone.
  - **Save image** downloads the picture.

  The image (1080 × 1350, made in `js/share.js`) shows the puzzle, your
  time, your hint points or a No-Hint badge, your streak, and the grid's
  shape with no letters, so it never spoils an answer. Where the share sheet
  isn't available, Share copies the summary instead.
- **Challenge links** add `?c=<seconds>.<hint points>.<no-hint>` to a puzzle
  link, for example `#/daily/2026-10-19?c=252.0.1`.
  - A friend who opens one sees "a friend finished this in 4:12…" above the
    puzzle, and finds out on finishing whether they beat it.
  - Fewer hint points wins, then the faster time.
  - The link carries nothing else, and no sign-up is needed.
- **The home page's streak note** reminds you to keep a streak going until
  today's Daily or Mini is done.

- **Feel:**
  - Letters pop in as you type, and a finished word ripples.
  - Wrong letters shake when Check or auto-check finds them.
  - A clean solve sets off a golden wave across the grid and a burst of confetti.
  - A progress bar shows how much of the grid is filled, and the home page shows your Daily streak.
  - On phones, a tab bar along the bottom switches sections, and Android phones vibrate on taps, finished words and wins. Vibration can be turned off in settings; iPhones don't allow websites to vibrate.
  - All motion is skipped when the device asks for reduced motion.

### Hints, hint points and the No-Hint Club

There are two hints, **Reveal Letter** and **Reveal Word** (Reveal →
Square or Word; Reveal → Puzzle counts each unfinished word). Each has two
separate costs, both set in `js/hints.js` so they're easy to change:

| Hint | Hint credits | Competitive hint points |
|---|---|---|
| Reveal a letter | 1 | 2 |
| Reveal a word | 3 | 5 |

- **Hints are free.** Hint credits are what a hint will cost once credits
  exist. They're counted on each solve and in Statistics, but nothing is
  charged or limited.
- **Hint points** are the competitive score: fewer is better. They show on
  the result, the share text, Continue playing and in Statistics.
- **Check and auto-check are free** on both scales, but mark the puzzle as
  assisted. Auto-check counts if it was on at any point during the puzzle.
- **The No-Hint Club:** a puzzle finished with no reveals or
  checks is a No-Hint solve. Statistics shows No-Hint solves, the No-Hint
  Daily streak, average hint points and badges (First No-Hint solve, Three,
  Seven and Thirty Days, Ten and Fifty No-Hint solves, Brutal Finisher).
  Solves from before hint points existed don't count.
- A puzzle solved again, or on two devices, keeps its better record: No-Hint,
  then no reveals, then fewer hint points, then the faster time.

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

- **The Daily, the Mini and the Brutal Challenge are frozen.** Every date
  from launch (1 September 2026) through at least 60 days ahead is saved in
  `puzzles/YYYY-MM.json`, and every Brutal Challenge week (from October 2026)
  in `puzzles/brutal-YYYY-MM.json`, filed by the month its Monday falls in.
  The site plays those saved grids. Editing word lists or the generator
  never changes a published puzzle. `puzzles/index.json` holds each month's
  fingerprint, and the tests fail if a frozen month is edited or if fewer
  than 60 days ahead are frozen. To freeze more months:
  `node tools/freeze-puzzles.js` (or `--through 2027-12`). It only adds new
  months and never rewrites existing ones. After a change to the Daily's
  schedule, `node tools/freeze-puzzles.js --refreeze-from YYYY-MM-DD`
  rebuilds the Dailies from that date on. It refuses any date up to today
  (South African time), so nothing already published changes.
- **⏰ Next freeze due by 1 March 2027.** Everything is frozen through April
  2027, and the tests fail once fewer than 60 days ahead are frozen. Before
  1 March 2027, run `node tools/freeze-puzzles.js`, run the tests and merge
  the new files. `node tests/puzzles.test.js` prints the due date on every
  run and warns when it's less than a month away.
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

## Analytics (optional)

Crossword Hub can use Google Analytics 4 (free) to measure:
- daily and monthly players, return visits, and Day-1, Day-7 and Day-30
  retention
- puzzle starts and completions, by category and difficulty
- hint use and shares

Analytics never affects play. Players who decline, or whose browsers block
Google, play exactly as normal.

**It's off until both of these are true:**
1. **A measurement ID is set.** In the Firebase console, open **Project
   settings → Integrations → Google Analytics → Enable** and follow the
   steps. Then copy the web app's **measurementId** (it starts with `G-`)
   into `js/firebase-config.js`.
2. **The player agrees.**
   - A small "Help improve Crossword Hub?" prompt appears once, on the home
     page only, never during a puzzle.
   - Nothing loads, and no cookie is set, unless the player taps **Allow**.
   - They can change their mind any time in Settings, which also deletes
     Google Analytics' cookies.

**Then, in Google Analytics** (Admin → Data streams → your web stream):
- Under **Enhanced measurement**, switch off:
  - **Page changes based on browser history events.** The site sends its
    own cleaned page views.
  - **Site search** and **Form interactions.** Neither is needed.
- Under **Admin → Data collection**, leave **Google signals** off. Under
  **Data retention**, 2 months is enough.

**What is sent** (`js/analytics.js`). Only these events and fields, checked
against a fixed list; anything else is dropped, as is any value that looks
like an email address:

| Event | Fields |
|---|---|
| `page_view` | a cleaned path, such as `/play/friends/fan` (no puzzle codes, challenge data or private links) |
| `puzzle_start` | kind, category, level, genre, resumed |
| `puzzle_complete` | kind, category, level, genre, seconds, hint points, assisted, No-Hint, from a challenge |
| `hint_used` | letter, word or puzzle; puzzle kind |
| `check_used`, `autocheck_on` | scope; puzzle kind |
| `share` | method (share sheet, WhatsApp, link, image); puzzle kind and page |
| `challenge_open` | page |
| `return_visit` | days since the last visit (once a day) |

It never sends answers, clues, gift stories, names or email addresses, and
advertising features are off. `tests/analytics.test.js` checks the fixed
list. A **Privacy** note, linked from Settings and the prompt, explains all
this to players.

## Multiplayer: Help me solve

Any puzzle can become a shared puzzle that up to five people fill in together,
live and free.

**For players:**
- **Start:** tap **Help me solve: invite friends** above the grid, choose a
  display name, and share the link (WhatsApp, copy or the share sheet). The
  letters already in the grid carry over.
- **Join:** friends open the link and pick a name. No account or sign-up is
  needed; behind the scenes they get a temporary anonymous Firebase account.
- **Playing together:**
  - Everyone types at once. Each player has a colour; their square is
    outlined, their word underlined, and a dot sits by the clue they're on.
  - If two people change a square at the same moment, the last one wins and
    everyone sees the same grid.
  - The clock is shared and can't be paused.
- **Losing connection:** letters typed offline are sent when the connection
  returns. Reloading the page, or reopening the puzzle from Continue playing,
  rejoins the room.
- **The host** can remove a player, who can't rejoin that room.
- **Limits:** a room holds five players and closes after 7 days. Anyone who
  arrives after that can still solve the puzzle on their own.
- **Results:** a shared solve is recorded as collaborative, with everyone's
  hints added together. It counts towards the daily streak, but never
  towards the No-Hint Club or best times. Leaderboards will rank it
  separately.

**How it works:**
- **Firebase Realtime Database:** `js/room.js` handles the live connection,
  `js/rooms.js` the shared helpers, and `database.rules.json` the security
  rules.
- **Why not Firestore:** Realtime Database charges nothing per keystroke and
  shows who's online. Its free plan allows 100 people connected at once,
  1 GB stored and 10 GB downloaded a month.
- **What the rules allow:**
  - Rooms can be read only by someone who has the link (12 random
    characters); nobody can list rooms.
  - Only seated players can change letters, and only one capital letter per
    square.
  - Seats are limited to five.
  - Only the host can remove players.
  - Display names are limited to safe characters.
  - Nothing else can be written.
- **Shared start-up:** `js/firebase.js` starts Firebase once for sign-in and
  rooms. Anonymous guests count as signed out, so nothing is synced for them.

**Switching it on** (it stays hidden until then):
1. **Create the database:** in the Firebase console, open **Build →
   Realtime Database → Create Database**. Choose **Belgium
   (europe-west1)**, the closest location to South Africa, then **Start in
   locked mode**.
2. **Paste the rules:** on the database's **Rules** tab, replace everything
   with the contents of `database.rules.json` and press **Publish**.
3. **Add the address:** copy the database URL shown at the top of the
   **Data** tab, for example
   `https://crossword-hub-default-rtdb.europe-west1.firebasedatabase.app`,
   into `databaseURL` in `js/firebase-config.js`.
4. **Allow guests:** under **Authentication → Sign-in method**,
   **Anonymous** must be enabled. Tick **Auto clean-up** too.

## Search pages

Search engines can't read the app's `#/` addresses, so
`node tools/build-pages.js` writes real pages for them:
- **One page per genre and collection** (`play/<id>/`), with a description,
  sample clues (never answers), Play buttons for each level and links to
  related puzzles.
- **A hub page** (`play/`) listing everything.
- **`sitemap.xml` and `robots.txt`.**

How it fits together:
- **Play buttons** open `#/new/<genre>/<level>`, which starts a fresh puzzle.
- **Link previews** use `icons/og-image.png`, drawn by
  `tools/make-og-image.py`.
- **Rebuild the pages** after changing genres, collections or the asset
  version; `tests/pages.test.js` fails if they're out of date.
- **Custom domain:** if the site moves to one, change `SITE` in
  `tools/build-pages.js` and the addresses in `index.html`'s preview tags.

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
reusing saved ones. The tests check that the two match. Then run
`node tools/build-pages.js`, since the search pages link the stylesheet by
version.

## Themed collections

Unofficial fan crosswords about one show, film series, game, sport or artist,
grouped as TV & streaming, Movies, Anime, Gaming, Sport and Music. Each
collection has Casual, Fan and Superfan clues, and puzzles come at those three
levels:

| Level | Clues | Mix |
| --- | --- | --- |
| Casual | 12 | Casual clues, with Fan ones filling in. No Superfan clues. |
| Fan | 16 | Mostly Fan clues, plus 3 Superfan ones. |
| Superfan | 20 | 9 Superfan clues; Fan and Casual ones fill in. |

Each collection is one file, `collections/<id>.txt`:

```
# Friends: unofficial fan crossword clues
@title Friends
@category tv
@blurb Central Perk, two apartments and six friends in New York.
@icon tv
CENTRAL PERK | Coffee house with an orange sofa (7,4) | casual
```

Multi-word answers give their word lengths, like `(7,4)`. To check and build:

```sh
node tools/build-collections.js --check friends   # check one collection
node tools/build-collections.js                   # check all, then write js/collections.js
```

The checker catches format slips, short or repeated answers, answers that
appear in their own clue, levels with too few clues, and levels that can't
build complete puzzles. It can't check facts: every collection was fact-checked
separately before publishing, and new clues should be too.

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
node tests/generator.test.js # takes about 10 minutes
node tests/sync.test.js      # merging progress between devices
node tests/puzzles.test.js   # frozen puzzles are unchanged and far enough ahead
node tests/hints.test.js     # hint credits and hint points
node tests/stats.test.js     # streaks, hints used, averages and favourites
node tests/access.test.js    # every puzzle and level stays free
node tests/share.test.js     # challenge links, countdown, analytics page names
node tests/pages.test.js     # search pages and sitemap are up to date
node tests/analytics.test.js # analytics sends only allowed, non-personal fields
node tests/rooms.test.js     # multiplayer room helpers
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
| `collections/*.txt`, `js/collections.js` | Themed fan collections, and their compiled form |
| `js/featured.js` | The Trending now cards on the home page (edit by hand) |
| `js/hints.js` | Hint credits and competitive hint points |
| `js/stats.js` | Streaks, hints used, average time and favourites, from saved solves |
| `js/access.js` | `canAccess`: who may play what (everything is free) |
| `js/share.js` | Challenge links and the shareable result image |
| `js/analytics.js` | Optional Google Analytics, only with the player's consent |
| `js/rooms.js`, `js/room.js`, `js/firebase.js`, `database.rules.json` | Multiplayer rooms (Help me solve): helpers, live connection, shared Firebase start-up, security rules |
| `play/`, `sitemap.xml`, `robots.txt` | Search pages, made by `tools/build-pages.js` (don't edit by hand) |
| `MASTER_PLAN.md`, `PROJECT_STATUS.md` | The roadmap and what's built |
| `css/styles.css` | Styles, light and dark themes |
| `puzzles/` | Frozen Daily, Mini and Brutal Challenge puzzles, one file per month, and their fingerprints |
| `words/*.txt` | Word lists, one file per genre |
| `words/levels.json` | Easy and hard answers, from `tools/rate-words.py` |
| `js/words.js` | Word lists compiled by `tools/build-words.js` (don't edit by hand) |
| `js/genres.js` | Genre groups, difficulty levels, Daily and Mini settings |
| `js/generator.js` | Seeded crossword layout generator and the daily word rotation |
| `js/app.js` | Game logic, solving tools, storage, stats, archive and routing |
| `tools/` | Word list tools: build, check and dedupe |
| `tests/generator.test.js` | Grid and clue validation |
