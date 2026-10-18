# Crossword Hub — Master Plan

The single source of truth for what Crossword Hub is, the rules it follows and
the order it's built in. For what is built today, see
[PROJECT_STATUS.md](PROJECT_STATUS.md).

**How to read this document**

- **Confirmed** — decided by the owner. Build to it.
- **Proposed** — a suggestion or a number to test. Don't build anything that
  depends on it without confirming first.
- **Open** — needs a decision (see [Open decisions](#9-open-decisions)).
- When two decisions conflict, the newest confirmed one wins. Superseded
  decisions stay in the [decision log](#8-decision-log) for reference.

Commercial figures (prices, budgets, revenue targets) are deliberately kept
out of this public document and live in the owner's private notes. Future
monetisation is described here only in general terms.

Last updated: 18 October 2026, after the owner approved the roadmap and
decisions (Stage 3.5 under way).

---

## 1. Vision

**Crossword Hub** — an internationally popular crossword platform. *Confirmed.*

Taglines: *"A crossword for every obsession."* and *"The hardest crosswords.
How few hints will you need?"*

Four pillars:

| Pillar | What it means |
|---|---|
| **Play** | Free daily puzzles and themed crosswords |
| **Compete** | Leaderboards, achievements, streaks and tournaments |
| **Create** | Personalised crossword gifts (AI-assisted) |
| **Share** | Invite friends, solve together, send gifts |

- **Target markets:** the US, UK, Canada and Australia, with South Africa as
  the home market.
- **Ambition:** a sustainable business in time, with staged revenue
  milestones. The targets are aspirational, not forecasts, and are kept in
  the owner's private notes.
- **Goals:** easy to access, enjoyable, social and shareable, worth returning
  to every day, technically reliable, affordable to run, and able to earn
  revenue later.

## 2. Current access policy: everything is free

This is the most important current rule. *Confirmed, 18 October 2026.*

Crossword Hub is in its development and audience-growth phase. Until the owner
explicitly approves monetisation:

1. **Every puzzle is free.** This covers the Daily, the Mini, every category
   and themed collection, every level (Easy to Brutal, Casual to Superfan),
   the Brutal Challenge and all archives.
2. **No Premium subscription, paywall, locked puzzle or payment screen**
   anywhere.
3. **No sign-up to play.** Opening the site leads straight to solving, with
   no login prompts in the way.
4. **Accounts are optional.** They're for extras: progress synced across
   devices and player profiles. An account *may* be required later for
   verified rankings, cross-device progress or managing content a player
   created (gifts, teams).
5. **Multiplayer is free**, and invited guests join easily without
   registering.
6. **Hints are free.** Usage, future credit costs and competitive penalties
   are tracked, but nothing is charged or limited.
7. **Personalised crossword gifts are free during testing**, with reasonable
   generation limits to control AI costs.
8. **Leaderboards and achievements are free.**
9. **Never restrict existing functionality by accident.** Every change is
   checked against this list.

Engineering rule: future Premium rules must be possible to switch on without
redesigning the system. Every access check goes through one entitlement
function, which today always answers "allowed" (see Stage 3.5).

## 3. Future monetisation model (documented, not enforced)

Nothing in this section is active, and none of it may be activated without the
owner's explicit approval. *The model is proposed.* Proposed prices are in the
owner's private notes and are subject to testing.

### 3.1 Always free, even after monetisation

- The Daily Crossword and the Daily Mini.
- One permanently free sample crossword per category.
- Free puzzles and their multiplayer rooms.
- Joining a Premium host's puzzle through an authorised guest invitation.
  The guest gets that room only, not the Premium library.
- The weekly Brutal Challenge. *Confirmed 18 October 2026.*

### 3.2 Premium (a monthly subscription)

- The full crossword library: all categories and levels, including Hard,
  Expert and Brutal library puzzles.
- Archives. *Confirmed as an acceptable future Premium benefit; nothing is
  restricted now.*
- Advanced statistics.
- Ad-free play.
- Hosting Premium multiplayer puzzles with free guests.
- Personalised crossword creation within a monthly limit.

### 3.3 Hint credits

| | Detail |
|---|---|
| Costs | Reveal Letter: 1 credit. Reveal Word: 3 credits. *Confirmed as future costs.* |
| Free credits | A small free allowance each day |
| Streak rewards | Credits for streak milestones (3, 7, 14, 30 and 100 days), with a badge at 100 days |
| Expiry | Streak credits expire after a short period. Purchased credits don't expire (subject to the terms). |
| Packs | A few credit packs at low prices (proposed amounts in the private notes) |
| Fairness | Paying for hints never improves a competitive ranking. Credits and competitive penalties are separate scales. |

### 3.4 Other future revenue

| Stream | Notes |
|---|---|
| Crossword gifts | Limited monthly creations for Premium members, and possibly a one-off gift purchase |
| Advertisements | Optional; removed for Premium members |
| Sponsored puzzles | Branded or sponsored collections |
| Special content | Premium competitions or special events |

### 3.5 Before anything is switched on

- A balance kept on the server, so it can't be edited in the browser.
- A South African payment provider (for example PayFast, Yoco, Paystack or
  Peach Payments), tested in test mode first.
- Terms and refund policy.
- The owner's written approval of every price and rule.

## 4. Product rules

### 4.1 Puzzles and content

- **Categories** (*confirmed list*): TV and streaming, movies, sport, music,
  gaming, pop culture, history, geography, science, technology, literature,
  medicine, food, travel and general knowledge. Anime is already live.
- **Themed collections** are preserved and expanded, for example Friends,
  The Office, Breaking Bad, Stranger Things, Game of Thrones, Harry Potter,
  Marvel, Disney, Premier League, Formula 1, NBA, tennis, cricket, rugby,
  Pokémon and Minecraft.
- **Levels:** Easy, Medium, Hard, Expert and Brutal. Themed entertainment
  collections use Casual, Fan and Superfan. *Confirmed and built.*
- **Trending Now** covers popular shows, films, sporting events and cultural
  topics. Topics must be based on reliable information, never invented. Today
  the list is chosen by hand in `js/featured.js`.
- **Use validated, pre-generated, cached puzzles** wherever possible to keep
  AI costs down.
- **The existing clue database is preserved.**
- **Published puzzles never change.** Every player gets the same Daily, Mini
  and Brutal Challenge for a given date. Published puzzles are frozen in
  `puzzles/`.
- **Factual clues are checked before publication**, and clues never quote song
  lyrics.

### 4.2 Hints (*confirmed, 18 October 2026*)

- Only two hints exist:
  - **Reveal Letter** shows one correct letter. Future cost: 1 credit.
  - **Reveal Word** shows the whole answer. Future cost: 3 credits.
- **The rephrase-clue hint is removed** from the product. Its leftover code is
  removed in Stage 3.5.
- **Both hints are free now.** Usage and competitive hint penalties are
  tracked.
- **Competitive hint points are a separate scale from credits.** Current
  values: letter 2, word 5 (see Open decision 1). Both scales live in
  `js/hints.js`.
- **Check and auto-check are free.** Getting correctness help marks the puzzle
  as assisted.
- **The No-Hint Club is preserved.** A No-Hint solve uses no reveals and no
  checks.

### 4.3 Streaks and achievements

- **Daily streak** (*confirmed 18 October 2026; built in Stage 3.5*):
  finishing the Daily or the Mini counts, whether or not reveals or checks
  were used, and finishing both on the same day counts once.
- **No-Hint streak:** separate, and counts only genuinely unassisted Dailies
  (no reveals, no Check, no auto-check).
- **Tracked stats:** current and longest streak, total puzzles completed,
  average completion time, hints used, No-Hint completions, achievements and
  favourite categories.
- **Daily reset time:** midnight South African time (Africa/Johannesburg).
  *Confirmed 18 October 2026: keep it, and don't change the reset system.*

### 4.4 Competitive play

- **Ranking for solo puzzles:** lowest weighted hint penalty first, then the
  verified completion time. *Confirmed.*
- **Separate boards** for solo unassisted, solo assisted and collaborative
  results. *Confirmed.*
- **Using a reveal, Check or auto-check makes a result assisted**, and
  assisted results never appear on unassisted boards. *Confirmed 18 October
  2026.*
- **Buying hints never improves a ranking.** *Confirmed.*
- **Trusted leaderboards need checking on the server.** The browser currently
  holds the answers and the clock, so client-reported results can be faked.
  This needs Cloud Functions, which need Firebase's Blaze plan (Open decision
  2).

### 4.5 Real-time multiplayer: Help Me Solve (*major priority*)

- **How it works:** a player starts a puzzle alone, presses **Help Me Solve**
  and shares an invitation link (WhatsApp first). Friends open it and join
  the same grid.
- **Requirements:**
  1. Keep the existing answers.
  2. Sync changes in real time, with everyone typing at once.
  3. Show who is working on which clue.
  4. Handle edits to the same square at the same moment.
  5. Survive reconnecting, and never lose progress.
  6. Allow up to five players per room at first.
  7. Let guests join without registering.
- **Free at launch.** Future rule: Premium hosts can invite free guests to
  Premium puzzles, and a guest gets that room only.
- **Rankings:** collaborative results rank separately from solo results.

### 4.6 Teams and tournaments (*future, after multiplayer is stable*)

Permanent teams with names, profiles, statistics and achievements; weekly
challenges; team leaderboards; team-versus-team and solo races; timed races;
friends-only competitions; seasonal leagues.

### 4.7 Crossword Hub Gifts: "Turn your memories into a crossword"

- **Occasions:** romantic partners, anniversaries, birthdays, Valentine's Day,
  proposals, weddings, friends, family, special memories.
- **How it works:**
  1. **Tell your story.** The creator writes a paragraph with names, dates,
     places, inside jokes and shared memories.
  2. **Generate.** AI picks meaningful answers and writes clues, and the site
     builds a valid grid.
  3. **Personalise.** Choose a theme, title, welcome message and a surprise
     completion message (for example "Will you marry me?"), edit the clues
     and answers, and possibly add a photo.
  4. **Share privately.** Each gift gets an unguessable link and is solvable
     by anyone with that link, without subscribing.
- **Rules:**
  - **Accuracy:** never invent personal facts. Every answer and clue is
    validated, the puzzle must be solvable, and the creator sees a preview
    and can edit it.
  - **Privacy:** gifts are private by default and never appear in public
    collections or search results. Optional PIN; the creator can revoke a
    link and delete the gift.
  - **Cost:** free during testing, with rate limits; AI cost per gift kept
    low.

### 4.8 Sharing and growth

- **Result card after every puzzle:** puzzle name, level, time, hint use,
  assisted or unassisted, badges and a challenge link. It never spoils
  answers.
- **Ways to share:** WhatsApp, copy link, the phone's own share sheet, an
  Instagram-friendly image, direct challenge invitations and multiplayer
  invitations.
- **Shared links open straight into the puzzle,** with no sign-up.

### 4.9 Analytics and marketing

- **Track, with privacy-conscious analytics:**
  - users: daily and monthly active users, new and returning visitors, and
    Day-1, Day-7 and Day-30 retention
  - play: puzzle starts and completions, popular categories and levels, and
    hint use
  - growth: shares, referrals and multiplayer invitations
  - business: hosting and AI costs, and later Premium conversion and revenue
- **Marketing:** a modest monthly budget once the platform is ready, spread
  across short-video social media, micro-influencers, search ads and
  experiments (amounts in the private notes).
- **Organic first:** sharing and retention come before paid advertising.

### 4.10 Design and experience

- **Keep the current redesign:**
  - grid: clear cell borders, distinct blocked squares, visible word
    boundaries, and active-square and selected-word highlighting
  - clues: readable
  - device fit: mobile keyboard navigation, dark and light modes, responsive
    cards
  - general: fast loading and accessible controls
- **Feel premium while free,** with no unnecessary steps between opening the
  site and solving.

## 5. Technical principles and guardrails

These are standing rules from the owner and apply to every stage.

**Deployment and payments**
- Don't deploy or merge without the owner's approval. Merging a PR is the
  approval step, and merging publishes the site.
- Don't add paid infrastructure or services without explaining the costs and
  getting approval.
- Don't activate payments, paywalls, subscriptions or paid AI generation
  without approval.

**Keys and secrets**
- Never put private API keys, payment credentials or AI keys in front-end
  code. AI and payment calls go through a server function.

**Data**
- Don't remove or overwrite clue banks, archives, user records or statistics.
  Preserve existing data and features.
- Published puzzles never change; frozen files are enforced by tests.

**Content**
- Don't invent trending topics or facts, and check AI-written factual clues
  before publication.
- No copyrighted lyrics.

**Engineering**
- Mobile-first and fast.
- Accounts optional for basic play.
- Secure multiplayer rooms and private gift content.
- Rate limits on AI generation, and checks against cheating.
- Minimal running costs.

## 6. Technical dependencies

| Need | What it requires | Cost notes |
|---|---|---|
| Guests joining rooms without registering | Firebase **Anonymous Auth** (enable in console) | Free |
| Real-time rooms | **Firestore** listeners or **Realtime Database** | Spark (free) plan limits: Firestore 50,000 reads and 20,000 writes a day; Realtime Database 100 simultaneous connections. Enough to launch and measure; heavy use needs Blaze |
| Verified leaderboards, credit balances, rate limits, AI calls | **Cloud Functions** | Needs the **Blaze** (pay-as-you-go) plan with a card on file. Free monthly quotas are generous at small scale; set budget alerts |
| AI gift generation | An AI provider API, called only from a Cloud Function | A small cost per gift (to be estimated against current prices before building) |
| Gift photos | Cloud Storage for Firebase | New storage buckets need the Blaze plan |
| Proper page addresses for SEO | Static pages per category and collection, plus a sitemap | Free on GitHub Pages |
| Custom domain | Domain registration | A small yearly fee |
| Analytics | Provider choice (Open decision 3) | Free options exist |
| Payments (later) | A South African payment provider, plus server functions | A per-transaction fee; app stores take 15–30% |

## 7. Roadmap

Stages 1–3 are complete (see PROJECT_STATUS.md). The owner's provisional order
was Growth, then Monetisation preparation, Multiplayer, Gifts and Expansion.
The recommended order below changes it as follows:

- **Multiplayer moves ahead of monetisation preparation.** The owner calls
  multiplayer a major priority, and it brings in players. Monetisation
  preparation has no value to players yet, and its one structural need, a
  single entitlement check, is a tiny piece of work done in Stage 3.5.
- **Gifts are split.** A manual gift builder (no AI) needs no paid
  infrastructure and can be ready for Valentine's Day 2027. AI generation
  follows once the Blaze plan is approved.
- **Verified leaderboards get their own stage**, because they depend on the
  Blaze decision.

The owner approved this order on 18 October 2026.

### Stage 3.5: Free-access alignment and Stage 3 wrap-up (in progress)

- Remove the rephrase-clue hint (menu item, config, data and tests), keeping
  Reveal Letter and Reveal Word.
- Count the Daily or the Mini towards the streak, once per day; history is
  recalculated from existing solves, so no data is lost.
- Add the missing tracked stats: overall average completion time, total hints
  used and favourite categories.
- Add one entitlement function (`canAccess`) that every puzzle route goes
  through and that always says yes. This makes future Premium rules a
  one-place change.
- Audit that nothing is gated and no login prompt blocks play.
- Document a reminder to extend the frozen puzzles before 1 March 2027.
- **Cost:** none.

### Stage 4: Growth

- **Sharing:** result cards as images (WhatsApp and Instagram sizes), native
  share, copy link, and challenge links that open straight into the same
  puzzle.
- **Analytics:** daily and monthly active users, retention cohorts, puzzle
  starts and completions, shares, popular categories and hint use.
- **SEO:** real page addresses (old `#/` links keep working), a page per
  category and collection, a sitemap and preview images; the custom domain
  when decided.
- **Retention:** a streak-at-risk reminder on the home page; optional
  notifications later.
- **Content:** fill category gaps (travel, medicine, technology, general
  knowledge collections).
- **Needs:** Open decision 3 (analytics); Open decision 4 for the domain.
  **Cost:** free.

### Stage 5: Multiplayer (Help Me Solve)

- Rooms of up to five players, started from any puzzle with its progress.
- WhatsApp invite links and guest join through Anonymous Auth.
- Live letters, each player's position and current clue, and conflict
  handling.
- Reconnecting, and room expiry.
- Collaborative results recorded separately.
- **Needs:** Anonymous Auth enabled in the Firebase console; a database choice
  (Firestore on the free plan to start, with limits monitored).
  **Cost:** free at launch scale.

### Stage 6: Competitive and verified leaderboards

- Daily and weekly boards: solo unassisted, solo assisted and collaborative.
- Server-checked submissions (Cloud Functions issue a start token and verify
  the finished grid and time).
- Friends-only boards.
- **Needs:** Open decision 2 (the Blaze plan). **Cost:** expected
  to stay within free quotas at launch scale; needs billing enabled.

### Stage 7: Crossword Hub Gifts

- **7A, manual builder (no AI, free):**
  - The creator enters answers and clues, and the site builds the grid.
  - Title, welcome and surprise messages, and a theme.
  - A private, unguessable link that isn't indexed by search engines.
  - Revoking the link and deleting the gift.
  - Signing in is required to create a gift but not to solve one.
- **7B, AI generation:**
  - Story to answers and clues via a Cloud Function, with validation and
    "no invented facts" checks.
  - Per-account rate limits and editing before publishing.
  - Optional PIN and photo.
- **Needs:** 7A needs nothing new. 7B needs the Blaze plan, an AI provider and
  a testing budget (Open decision 5).

### Stage 8: Monetisation preparation (design, nothing activated)

- Premium entitlements mapped onto the `canAccess` function.
- A credit-wallet design: free daily credits, streak credits with expiry, and
  purchased credits.
- Payment provider comparison and test-mode plan.
- Terms and refund policy drafts.
- Ad placement plan.
- **Activation is a separate, owner-approved step.**

### Stage 9: Expansion

- Permanent teams and team statistics.
- Tournaments, races and seasonal leagues.
- More categories and collections.
- Native iOS and Android apps (wrapping the installable web app).

## 8. Decision log

| Date | Decision | Status |
|---|---|---|
| Stage 1 | Check and auto-check are free but mark a puzzle assisted and disqualify it from the No-Hint Club; checking never costs hint credits | Confirmed, still current |
| Stage 1 | Auto-check also disqualifies a puzzle from competitive leaderboards | Refined 18 Oct: reveals, Check and auto-check make a result assisted; assisted results go on the solo assisted board, never the unassisted one |
| Stage 1 | Daily reset at midnight South African time (00:00 SAST), using an authoritative clock | Confirmed and built; reconfirmed 18 Oct (UTC proposal not adopted) |
| Stage 1 | Keep Easy, Medium and Hard; add Expert and Brutal | Confirmed and built |
| Stage 1 | No custom domain yet | Still current (Open decision 4) |
| Stage 1 | Never deploy without approval | Confirmed, standing |
| Stage 2 | 50 themed collections with Casual, Fan and Superfan levels | Built |
| 18 Oct 2026 | The Daily is gentler from 19 October 2026 (fewer clues and tough answers) | Built |
| Stage 3 | Hint credits: letter 1, rephrase 2, word 3; penalties: letter 2, rephrase 1, word 5 | Rephrase removed (18 Oct); letter and word values stand |
| 18 Oct 2026 | **Everything is free** during the growth phase; no paywalls or required sign-in | Confirmed |
| 18 Oct 2026 | **Rephrase-clue hint removed**; only Reveal Letter (future 1 credit) and Reveal Word (future 3 credits) | Confirmed |
| 18 Oct 2026 | Hints are free now; usage and penalties tracked; credits not charged | Confirmed |
| 18 Oct 2026 | Daily or Mini completion counts towards the streak once per day, with or without reveals or checks; the No-Hint streak stays separate and unassisted only | Confirmed |
| 18 Oct 2026 | Separate solo unassisted, solo assisted and collaborative rankings; paying never improves rank | Confirmed |
| 18 Oct 2026 | Multiplayer is free with easy guest joining; up to 5 players per room | Confirmed |
| 18 Oct 2026 | Gifts are free in testing with generation limits | Confirmed |
| 18 Oct 2026 | Future Premium subscription, credit packs, streak rewards and gift price (figures in private notes) | Proposed |
| 18 Oct 2026 | Keep the daily reset at midnight South African time; don't change the reset system | Confirmed |
| 18 Oct 2026 | Reveals, Check or auto-check make a result assisted; assisted results never on unassisted boards | Confirmed |
| 18 Oct 2026 | Everything free now; after monetisation the weekly Brutal Challenge stays free; archives may become Premium | Confirmed |
| 18 Oct 2026 | Keep prices, marketing budgets and revenue targets out of public documentation | Confirmed |
| 18 Oct 2026 | Analytics: Google Analytics 4 via Firebase, loaded only after the player agrees (consent prompt) | Confirmed; built in Stage 4 |
| 18 Oct 2026 | Multiplayer runs on Firebase Realtime Database (free plan); guests use anonymous sign-in | Built in Stage 5 |
| 18 Oct 2026 | Multiplayer defaults: players choose a display name (prefilled with a random one, max 20 safe characters); rooms last 7 days; the host can remove players, who can't rejoin; no chat, so names are the only text to moderate | Built in Stage 5; easy to change |
| 18 Oct 2026 | Shared solves are collaborative results: team hints add up; they count for the daily streak, never for the No-Hint Club or best times | Built in Stage 5 |
| 18 Oct 2026 | Roadmap approved: 3.5 wrap-up, 4 Growth, 5 Multiplayer, 6 Verified leaderboards, 7 Gifts (manual builder first), 8 Monetisation preparation, 9 Teams and expansion | Confirmed |

## 9. Open decisions

Decisions 1, 2, 4, 5 and 12 from the first draft (reset time, streaks,
assisted results, Brutal Challenge and archives, public documentation) were
settled on 18 October 2026; see the decision log.

1. **Confirm the competitive hint penalties:** letter 2 and word 5 (the
   current values in `js/hints.js`).
2. **The Firebase Blaze plan** (card on file, pay-as-you-go with free quotas,
   and budget alerts). This is needed for verified leaderboards, AI gifts,
   gift photos and later payments. Needed by Stage 6.
3. ~~Analytics provider~~ — settled 18 October 2026: Google Analytics 4
   with a consent prompt.
4. **Custom domain:** name and timing (for example crosswordhub.co.za or
   .com, after a trademark check).
5. **AI gift testing budget and limits** (needed by Stage 7B):
   - the provider
   - a monthly spend cap
   - a per-account limit (for example 3 gifts a month)
6. ~~Multiplayer details~~: settled with sensible defaults in Stage 5 (see
   the decision log); change any of them on request.
