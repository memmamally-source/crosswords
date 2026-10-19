# Crossword Hub — Project Status

What is built and live today, what's unfinished, and how it compares with the
[master plan](MASTER_PLAN.md).

- **Snapshot:** 19 October 2026 (updated for the Arcade and Free-versus-Premium
  decisions).
- **Live site:** https://memmamally-source.github.io/crosswords/ (GitHub
  Pages, deployed from `main` when a PR is merged).
- **Code checked:** `main` at `25f819c` (everything up to #26 merged).

## 1. Stages at a glance

| Stage | Status | Merged in |
|---|---|---|
| 1 — Foundation and redesign | ✅ Complete | #12 |
| 2 — Content: collections, Expert and Brutal, Brutal Challenge, gentler Daily | ✅ Complete | #13, #14, #15 |
| 3 — Hints, scoring, assisted status, No-Hint Club | ✅ Core complete; wrap-up needed for the 18 October decisions | #16 |
| 3.5 — Free-access alignment and Stage 3 wrap-up | ✅ Complete | #17 |
| 4 — Growth and social sharing | ✅ Complete (#18, #19); new category collections to follow | #18, #19 |
| 5 — Multiplayer (Help me solve) | ✅ Built (#20); switched on by the database URL PR | #20 |
| 6 — Verified leaderboards | Postponed (19 Oct) until there are more players | — |
| 7 — Gifts | 7A manual builder built; shows "Coming soon" until switched on | #25 |
| 8 — Monetisation preparation (design only) | Not started; now also covers the entitlement switches and server design for Brutal and the Arcade | — |
| 9 — Expansion | Not started | — |
| 10 — Crossword Hub Arcade (Clue Blitz, Survival) | 10A built (free, unlimited), in a PR awaiting approval; 10B (enforcement) later | — |

(Stage numbers 4 onwards follow the revised order in MASTER_PLAN.md §7.)

## 2. What's live

### Puzzles and content

- **Daily Crossword:** academic, drawn from 23 subjects and about 10,000
  answers.
  - It gets harder through the week; the gentler schedule runs from
    19 October 2026, with 18 clues on Monday up to 34 on Sunday.
  - Dailies are frozen through April 2027.
- **Daily Mini:** six quick everyday clues, also frozen.
- **The Brutal Challenge:** one shared Brutal puzzle a week, starting each
  Monday, frozen through April 2027.
- **34 regular genres:** about 17,200 answers (Travel, Medicine, Technology
  and General Knowledge added in October 2026), at Easy, Medium, Hard, Expert
  and Brutal.
- **58 themed collections:** about 7,450 fact-checked clues, at Casual, Fan
  and Superfan.
  - Categories: TV and streaming 15, movies 12, anime 5, gaming 11, sport 10,
    music 5.
  - Added 19 October 2026: Michael Jackson, Beyoncé, One Piece, Demon Slayer,
    Fast & Furious, UEFA Champions League, NFL and Roblox.
- **3 mixed genres** (Mixed Bag, Pop & Fun, Academic) and an archive calendar
  of every Daily and Mini since launch (1 September 2026).
- **Trending Now:** six hand-picked cards, edited in `js/featured.js`.

### Playing

- **No sign-up:** everything is playable straight away.
- **Grid:** a dark board with a gold active square and a blue current word;
  phones use the device keyboard.
- **Tools:** pencil mode, Check, auto-check, and Reveal (square, word,
  puzzle).
- **Feel:** animations and vibration (where allowed), light and dark themes.
- **Installable** as an app (PWA) and works offline.
- **One official date for everyone:** the day turns at midnight South African
  time, using the web server's clock rather than the device's.
- **Shared links** rebuild the same grid even if word lists change later.

### Hints, scoring and achievements (Stage 3)

- **Hints:** Reveal Letter and Reveal Word only; the rephrase-clue hint is
  removed in Stage 3.5. Each records hint credits (letter 1, word 3; never
  charged) and competitive hint points (letter 2, word 5). Both scales are
  set in `js/hints.js`.
- **Assisted status:** Check and auto-check are free but mark a puzzle
  assisted. Auto-check counts if it was on at any point.
- **Every solve records** the hints used, hint points, credits, whether it was
  checked or auto-checked, and its No-Hint status.
- **No-Hint Club, in Statistics:**
  - No-Hint solves, the No-Hint Daily streak and the longest No-Hint streak
  - average hint points and hint credits used
  - seven badges with progress
- **Where hint points show:** the result screen, the share text and the
  Continue playing cards.
- **Daily streak** (Stage 3.5): finishing the Daily or the Mini counts, with
  or without help, and both on one day count once. The No-Hint streak stays
  separate, for unassisted Dailies only. Streaks are worked out from saved
  solves (`js/stats.js`), so existing progress is recounted under the new
  rule and nothing is lost.
- **Other stats:**
  - puzzles solved
  - the average Daily time, and times by day of the week
  - new in Stage 3.5: the average time across all puzzles, total hints used,
    and favourite genres and collections
- **Free access** (Stage 3.5): every puzzle opens through `canAccess`
  (`js/access.js`), which always allows; `tests/access.test.js` checks all
  324 puzzle and level combinations, signed in or not.

### Sharing, growth and analytics (Stage 4)

- **Sharing a result:**
  - **Share** uses the phone's share sheet with a spoiler-free result image
    (1080 × 1350: time, hint points or No-Hint badge, streak, and the grid's
    shape with no letters).
  - **WhatsApp**, **Copy challenge link** and **Save image** sit alongside.
- **Challenge links** (`?c=` on any puzzle link) show the friend's time and
  hint points above the puzzle, and say on finishing whether you beat it.
  No sign-up needed.
- **Retention:**
  - a home-page note to keep the streak going until today's Daily or Mini is
    done
  - a countdown to the next Daily and Mini on the result screen
- **Analytics:** Google Analytics 4, only after the player taps Allow on a
  one-time prompt.
  - Events: page views, puzzle starts and completions, hints, checks, shares
    and challenge opens.
  - No names, emails or answers, and no advertising features.
  - A Privacy note sits in Settings.
  - Measurement ID `G-RN1ZYN9RSC` is set (added after Stage 4 was
    merged), so the consent prompt appears once that change is live.
- **Search pages:**
  - `play/` plus one page per genre and collection (87 in all), with
    descriptions, sample clues and Play buttons
  - `sitemap.xml`, `robots.txt`
  - link-preview tags and image
  - The new `#/new/<genre>/<level>` address opens a fresh puzzle.

### Multiplayer: Help me solve (Stage 5)

- **Rooms:** up to five players fill in any puzzle together, live, through an
  invite link (WhatsApp, copy or the share sheet). No sign-up: guests use
  anonymous sign-in. The letters already in the grid carry over.
- **Seeing each other:** coloured outlines, word underlines and clue dots
  show where each player is.
- **Edits:** if two people change a square at once, the last one wins and
  everyone converges on the same grid.
- **Shared clock:** it can't be paused.
- **Losing connection:** offline typing syncs on reconnect. Reloading or
  Continue playing rejoins the room.
- **Host controls, and limits:** the host can remove players, who can't
  rejoin. Rooms close after 7 days and hold at most five players.
- **Collaborative results:** team hints add up; they count for the streak,
  never for the No-Hint Club or best times.
- **Security rules** (`database.rules.json`):
  - only people with a room's link can read it, and nobody can list rooms
  - only seated players can change letters, one capital letter per square
  - at most five seats; only the host can remove players
  - display names limited to safe characters, and nothing else can be
    written
- **Tested against the Firebase emulators with the real rules:**
  - joining, live sync both ways, cursors and reloading
  - same-square races, offline typing and the five-player limit
  - removing, leaving, and finishing together
  - eight kinds of misuse, all refused by the database
- **Database:** `crossword-hub-default-rtdb` (europe-west1), with the rules
  published; its URL was added after Stage 5 was merged, which switches the
  button on.

### Accounts and Firebase

- **Accounts are optional:** sign in with Google or email and password
  (Firebase Auth, project `crossword-hub`).
- **Synced progress:** each player's solves, best times and up to 15 puzzles
  in progress are kept in one Firestore document, `users/{uid}`.
  - Rules let a player read and write only their own document, capped at
    900 KB.
  - Merging keeps the better record from each device.
- **Anonymous (guest) sign-in:** enabled, for multiplayer guests, with auto
  clean-up after 30 days.
- **Realtime Database:** used by multiplayer rooms, once created.
- **Not used yet:**
  - Cloud Functions
  - Cloud Storage
- **Firebase plan:** presumed Spark (free), since nothing needs Blaze. Check
  in the Firebase console.
- **Public config:** the web config in `js/firebase-config.js` is public by
  design. There are no private keys anywhere in the front end.

### Quality checks

- **Tests:**
  - `tests/generator.test.js`: every genre, level and collection builds valid
    puzzles. About 10 minutes.
  - `tests/puzzles.test.js`: frozen puzzles are unchanged.
  - `tests/sync.test.js`: merging progress across devices.
  - `tests/hints.test.js`: hint scales.
- **Collection checker:** `tools/build-collections.js` checks answer lengths,
  giveaways and fill.
- **No CI:** tests are run by hand before each PR.

## 3. Stage 3: done, unfinished, and changed by the 18 October decisions

| Item | Status |
|---|---|
| Hint credits and competitive hint points as separate, configurable scales | ✅ Done |
| Check and auto-check free but mark assisted | ✅ Done |
| No-Hint Club with stats and badges | ✅ Done |
| Solve records with hints, points, credits and assisted flags; better record kept across devices | ✅ Done |
| Rephrase-clue hint | ✅ Removed in Stage 3.5 (menu item, data, config and tests). Saves that carry the old field still load |
| Streak counts the Daily **or** the Mini, once per day, assisted or not | ✅ Stage 3.5 |
| Stats: overall average time, total hints used, favourite categories | ✅ Stage 3.5 |
| Leaderboards (solo unassisted, solo assisted, collaborative) | ⏸ Postponed. Trusted rankings need server checks (Blaze plan). → Stage 6, later |
| Credit balance, free daily credits, streak credits | ❌ Deliberately not built (everything free). → Stage 8 design |

## 4. New specification compared with what exists

| Specification item | Status | Notes |
|---|---|---|
| Everything free, no paywalls | ✅ True | Nothing is gated. Stage 3.5 adds one `canAccess` check that always allows, plus a test, so future rules are a one-place change |
| Play without registering; accounts optional | ✅ Already true | The sign-in button never blocks play |
| Categories: TV, movies, sport, music, gaming, pop culture, history, geography, science, literature, food | ✅ Live | As genres or collections |
| Categories: technology, medicine, travel, general knowledge | ✅ Live | As genres: Technology & Gadgets, Medicine & Health, Travel & Landmarks, General Knowledge (about 500 fact-checked clues each) |
| Levels Easy to Brutal; Casual, Fan, Superfan | ✅ Live | |
| Trending Now from reliable sources | ✅ Live (manual) | Hand-edited list; no automatic topics |
| Published dailies identical for everyone | ✅ Live | Frozen files and tests |
| Hints: Reveal Letter and Reveal Word only | ✅ Stage 3.5 | |
| Streak: Daily or Mini, once a day | ✅ Stage 3.5 | |
| Daily reset time | ✅ Settled | Midnight South African time, reconfirmed 18 October 2026 |
| Leaderboards and server verification | ⏸ Postponed | Stage 6; needs the Blaze plan |
| Help Me Solve multiplayer | ✅ Stage 5 | Live rooms of up to 5; switches on once the Realtime Database exists |
| Teams and tournaments | ❌ | Stage 9 |
| Gifts | 🔒 7A built, "Coming soon" | Switch on with `GIFTS_LIVE` in `js/gifts.js`; 7B (AI) not started |
| Result cards, WhatsApp challenge links, Instagram images | ✅ Stage 4 | Share sheet with image, WhatsApp, challenge links, image download |
| Analytics | ✅ Stage 4 | Google Analytics with consent; measurement ID set |
| SEO (pages, sitemap, previews) | ✅ Stage 4 | Real pages per genre and collection link into the app; puzzles themselves stay on `#/` addresses |
| Custom domain | ⏳ Open decision | `SITE` in `tools/build-pages.js` and the preview tags change when it's set |
| Monetisation (Premium, credits, ads, gift purchases) | ❌ Deliberately not built | Documented as future only |
| Always free: Daily, Mini, streaks, basic stats, play without registering | ✅ True today | Must stay free after monetisation (confirmed 19 October 2026) |
| Brutal as a future Premium feature (visible, not playable for free players) | ❌ Not built, by design | Stage 8 adds the switch and a hidden Premium marker; Brutal stays free while testing. `canAccess` already sees every puzzle's kind and level, so the rule fits there |
| Arcade: Clue Blitz and Survival | ✅ Stage 10A (awaiting approval) | `js/arcade.js` (game logic) and the Arcade screens in `js/app.js`; 20,432 unique answers from the existing clue bank, no new content or AI |
| Free Arcade allowance (1 Blitz + 1 Survival a day) | 🔒 Built, switched off | `LIMITS_ACTIVE` in `js/arcade.js` is false; attempts are counted on the device only. Enforced on the server in 10B, with approval |
| Server-side entitlements and Arcade runs | ❌ Not built | Stage 10B with Stage 8; needs the Blaze plan and payments |

## 5. Risks and housekeeping

- **⏰ Frozen puzzles run out: next freeze due by 1 March 2027.** Dailies,
  Minis and Brutal Challenges are frozen through April 2027, and the tests
  require 60 days ahead. Run `node tools/freeze-puzzles.js`, test and merge
  before 1 March 2027. `node tests/puzzles.test.js` prints the due date and
  warns when it's under a month away (also documented in the README).
- **The generator test is slow (about 10 minutes)** and there's no CI. A
  GitHub Actions workflow would run tests on every PR (free for public
  repositories).
- **Client-side answers.** Every puzzle's answers are in the browser, so any
  leaderboard without server checks can be faked. This is fine for casual
  stats, but not for prizes or trusted rankings.
- **Premium gates on a static site.** The whole clue bank ships with the
  website, so a browser-only gate can be bypassed by a technical user. The
  planned design (MASTER_PLAN.md §3.6) keeps entitlements and Arcade runs on
  the server; the browser gate is only a fair-use barrier.
- **Firebase free-plan limits** for multiplayer: Firestore allows 50,000
  reads and 20,000 writes a day; Realtime Database allows 100 simultaneous
  connections. Write batching and monitoring are needed from day one.
- **Public plans.** If the repository is public, the planning documents are
  too. As decided on 18 October 2026, they carry no prices, budgets or
  revenue targets; those live in the owner's private notes.
- **Streaks can be backfilled.** A streak day is keyed by the puzzle's date,
  so finishing a missed Daily or Mini later from the archive fills that day
  in. This was already the case before Stage 3.5 and is unchanged.
- **Old solves and the No-Hint Club.** Solves from before PR #16 don't
  count, since they don't record checks; streaks and stats are otherwise
  preserved.

## 6. Recommended next step

Done since 18 October: the phone layout and invite screen (#22), the
built-in letter keys and grid zoom (#23), and the Travel, Medicine,
Technology and General Knowledge genres (#24).

Also merged: 8 new collections (#26), taking the site to 58 collections.

1. **Stage 10A: the Arcade** (Clue Blitz and Survival) is built, free and
   unlimited, with allowances built but switched off. In a PR awaiting the
   owner's approval.
2. **Switch on gift crosswords** when ready: set `GIFTS_LIVE` to true in
   `js/gifts.js` (and the matching line in `tests/gifts.test.js`). Ideally
   before Valentine's Day.
3. **Stage 8: monetisation preparation** (design only), including the
   Brutal and Arcade switches and the server design.
4. **Freeze the next batch of Dailies, Minis and Brutals** by 1 March 2027.
5. Verified leaderboards (Stage 6) stay postponed until there are more
   players; Arcade boards join them then.
