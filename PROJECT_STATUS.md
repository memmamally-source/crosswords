# Crossword Hub — Project Status

What is built and live today, what's unfinished, and how it compares with the
[master plan](MASTER_PLAN.md).

- **Snapshot:** 18 October 2026.
- **Live site:** https://memmamally-source.github.io/crosswords/ (GitHub
  Pages, deployed from `main` when a PR is merged).
- **Code checked:** `main` at `c871e22` (PR #16 merged), plus the Stage 3.5
  work on the `claude/crossword-game-website-48cduv` branch, in a PR waiting
  for approval. Items marked "Stage 3.5" below go live when that PR is
  merged.

## 1. Stages at a glance

| Stage | Status | Merged in |
|---|---|---|
| 1 — Foundation and redesign | ✅ Complete | #12 |
| 2 — Content: collections, Expert and Brutal, Brutal Challenge, gentler Daily | ✅ Complete | #13, #14, #15 |
| 3 — Hints, scoring, assisted status, No-Hint Club | ✅ Core complete; wrap-up needed for the 18 October decisions | #16 |
| 3.5 — Free-access alignment and Stage 3 wrap-up | 🔄 Built, PR awaiting approval | — |
| 4 — Growth | Not started | — |
| 5 — Multiplayer | Not started | — |
| 6 — Verified leaderboards | Not started | — |
| 7 — Gifts | Not started | — |
| 8 — Monetisation preparation (design only) | Not started | — |
| 9 — Expansion | Not started | — |

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
- **30 regular genres:** about 15,200 answers, at Easy, Medium, Hard, Expert
  and Brutal.
- **50 themed collections:** 6,432 fact-checked clues, at Casual, Fan and
  Superfan.
  - Categories: TV and streaming 15, movies 11, anime 3, gaming 10, sport 8,
    music 3.
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

### Accounts and Firebase

- **Accounts are optional:** sign in with Google or email and password
  (Firebase Auth, project `crossword-hub`).
- **Synced progress:** each player's solves, best times and up to 15 puzzles
  in progress are kept in one Firestore document, `users/{uid}`.
  - Rules let a player read and write only their own document, capped at
    900 KB.
  - Merging keeps the better record from each device.
- **Not used yet:**
  - Anonymous (guest) sign-in
  - Realtime Database
  - Cloud Functions
  - Cloud Storage
  - Analytics
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
| Leaderboards (solo unassisted, solo assisted, collaborative) | ❌ Not built. Trusted rankings need server checks (Blaze plan). → Stage 6 |
| Credit balance, free daily credits, streak credits | ❌ Deliberately not built (everything free). → Stage 8 design |

## 4. New specification compared with what exists

| Specification item | Status | Notes |
|---|---|---|
| Everything free, no paywalls | ✅ True | Nothing is gated. Stage 3.5 adds one `canAccess` check that always allows, plus a test, so future rules are a one-place change |
| Play without registering; accounts optional | ✅ Already true | The sign-in button never blocks play |
| Categories: TV, movies, sport, music, gaming, pop culture, history, geography, science, literature, food | ✅ Live | As genres or collections |
| Categories: technology, medicine, travel, general knowledge | ⚠️ Partly | Computing, Anatomy and the mixed genres exist; no travel genre, and no collections for these yet. → Stage 4 content |
| Levels Easy to Brutal; Casual, Fan, Superfan | ✅ Live | |
| Trending Now from reliable sources | ✅ Live (manual) | Hand-edited list; no automatic topics |
| Published dailies identical for everyone | ✅ Live | Frozen files and tests |
| Hints: Reveal Letter and Reveal Word only | ✅ Stage 3.5 | |
| Streak: Daily or Mini, once a day | ✅ Stage 3.5 | |
| Daily reset time | ✅ Settled | Midnight South African time, reconfirmed 18 October 2026 |
| Leaderboards and server verification | ❌ | Stage 6; needs the Blaze plan |
| Help Me Solve multiplayer | ❌ | Stage 5; needs Anonymous Auth enabled |
| Teams and tournaments | ❌ | Stage 9 |
| Gifts | ❌ | Stage 7 (7A manual, 7B AI) |
| Result cards, WhatsApp challenge links, Instagram images | ⚠️ Partly | Share result copies a text summary with a link to the clipboard. No share sheet, WhatsApp button, image card or challenge flow yet. → Stage 4 |
| Analytics | ❌ | Stage 4; provider undecided |
| SEO (real addresses, sitemap, previews) | ❌ | Stage 4; the site uses `#/` addresses |
| Monetisation (Premium, credits, ads, gift purchases) | ❌ Deliberately not built | Documented as future only |

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

1. **Review and merge the Stage 3.5 PR.**
2. **Stage 4: Growth and social sharing.** Result cards, WhatsApp challenge
   links, the phone's share sheet, analytics, SEO and retention. It needs
   the analytics provider decision (MASTER_PLAN Open decision 3) and is
   free to run.
