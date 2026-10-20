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

Last updated: 19 October 2026, after the owner's Arcade and Free-versus-Premium
decisions (see §2, §3 and §4.11). These take priority over earlier plans.

---

## 1. Vision

**Crossword Hub** — an internationally popular crossword platform. *Confirmed.*

Taglines: *"A crossword for every obsession."* and *"The hardest crosswords.
How few hints will you need?"*

Four pillars:

| Pillar | What it means |
|---|---|
| **Play** | Free daily puzzles, themed crosswords and the Arcade (Clue Blitz and Survival) |
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

## 2. Current access policy: everything is free (testing phase)

This is the most important current rule. *Confirmed 18 October 2026;
reconfirmed 19 October 2026.*

Two things must never be confused:

- **Now (the testing phase):** everything below applies. No payments or
  subscriptions exist, and the only limit is the Arcade's one game of each
  a day.
- **Later (the approved future rules in §3):** Brutal becomes Premium and the
  Arcade has daily allowances for free players. None of it is switched on
  until the owner explicitly approves the launch.

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
9. **The Arcade allows one Clue Blitz and one Survival a day** for everyone
   (owner's decision, 20 October 2026), so the clue bank isn't used up. It's
   counted in the browser and, for signed-in players, in their account;
   server enforcement comes with Premium (§3.6). There's no Premium yet, so
   no one can unlock more.
10. **Brutal is free during testing**, including the weekly Brutal Challenge.
    Premium markers for Brutal stay hidden until the owner approves the
    launch.
11. **No checkout or subscription screen** is shown until payments are fully
    built and tested, and the owner has approved them.
12. **Never restrict existing functionality by accident.** Every change is
    checked against this list.

Engineering rule: future Premium rules must be possible to switch on without
redesigning the system. Every access check goes through one entitlement
function, which today always answers "allowed" (see Stage 3.5). Restrictions
are switched on by configuration, not by rewriting features, and paid access
is never decided by the browser alone (§3.6).

## 3. Future monetisation model (documented, not enforced)

Nothing in this section is active, and none of it may be activated without the
owner's explicit approval. Proposed prices are in the owner's private notes
and are subject to testing. *The Free and Premium rules in §3.1 to §3.3 were
confirmed by the owner on 19 October 2026 as the future model; their launch
still needs separate approval.*

### 3.1 Always free, even after monetisation

*Confirmed 19 October 2026:*

- **The Daily Crossword:** one new puzzle every day.
- **The Daily Mini:** one new Mini every day.
- **Daily streaks and basic statistics.**
- **Basic gameplay without mandatory registration.**
- **The Arcade's daily allowance:** one Clue Blitz attempt and one Survival
  attempt a day (§3.3).

The Daily and the Mini must never be locked behind Premium.

*From the earlier plan, not contradicted (proposed):*

- One permanently free sample crossword per category.
- Free puzzles and their multiplayer rooms.
- Joining a Premium host's puzzle through an authorised guest invitation.
  The guest gets that room only, not the Premium library.

*Superseded:* the 18 October decision that the weekly Brutal Challenge stays
free (see the decision log). It becomes Premium with the rest of Brutal.

### 3.2 Premium (a subscription)

*Confirmed 19 October 2026:*

- **Brutal difficulty:** Brutal-level genre puzzles and the weekly Brutal
  Challenge.
  - Free players can still **see** Brutal puzzles (cards, titles and the
    week's Brutal Challenge banner) but can't play them once Premium
    restrictions are active.
  - A tasteful Premium marker and a short explanation of the benefit. The
    site must not feel commercial: no pop-ups, countdowns or pressure.
  - The Daily is never treated as Brutal, whatever its difficulty that day.
- **Unlimited Clue Blitz and Survival attempts.**
- **The library features planned earlier** (*proposed*): the wider library,
  archives (*confirmed as an acceptable future Premium benefit*), advanced
  statistics, ad-free play, hosting Premium multiplayer puzzles with free
  guests, and personalised crossword creation within a monthly limit.

**Fairness (confirmed):** Premium never gives a scoring advantage. Free and
Premium players play by identical rules and scoring. Premium only adds more
attempts and more puzzles.

### 3.3 Arcade allowances for free players

*Confirmed 19 October 2026: one Clue Blitz and one Survival attempt per day,
as separate allowances, resetting at midnight South African time
(Africa/Johannesburg). The attempt and interruption rules were confirmed
(with the owner's adjustments) when Stage 10A was approved on 19 October 2026;
whether the allowance needs an account remains Open decision 7.*

**What counts as an attempt**

- An attempt is used only when **play actually starts**: the first clue
  appears and, in Clue Blitz, the clock starts.
- Opening the Arcade page, reading the rules, or refreshing before pressing
  Start never uses an attempt.

**Interruptions (confirmed)**

- **Clue Blitz:** the 60 seconds run on real time and don't pause once a run
  has started. Refreshing or leaving never resets the timer or creates a
  fresh run: coming back while the minute is running carries on, and after it
  the run ends with the score reached.
- **Survival:** the round, clue, lives and score are saved after every move.
  A player can resume the **same run, on the same clue**, until midnight
  South African time. Refreshing never adds lives, resets difficulty or brings
  a new clue, so leaving can't be used to skip a hard one. An unfinished run
  ends at the reset and keeps its score.
- **Failures before a run starts** never use an attempt: an attempt is only
  recorded once the first clue is on screen.
- **No unlimited retries:** abandoning a run, refreshing or closing the app
  never gives a fresh attempt.

### 3.4 Hint credits

| | Detail |
|---|---|
| Costs | Reveal Letter: 1 credit. Reveal Word: 3 credits. *Confirmed as future costs.* |
| Free credits | A small free allowance each day |
| Streak rewards | Credits for streak milestones (3, 7, 14, 30 and 100 days), with a badge at 100 days |
| Expiry | Streak credits expire after a short period. Purchased credits don't expire (subject to the terms). |
| Packs | A few credit packs at low prices (proposed amounts in the private notes) |
| Fairness | Paying for hints never improves a competitive ranking. Credits and competitive penalties are separate scales. |

### 3.5 Other future revenue

| Stream | Notes |
|---|---|
| Crossword gifts | Limited monthly creations for Premium members, and possibly a one-off gift purchase |
| Advertisements | Optional; removed for Premium members |
| Sponsored puzzles | Branded or sponsored collections |
| Special content | Premium competitions or special events |

### 3.6 Enforcement: how restrictions will work once approved

- **Never the browser alone.** Local storage can be edited, so it is never
  trusted for paid access or allowances.
- **Entitlements live on the server.** A Premium subscription is recorded in
  the player's account by a server function that receives the payment
  provider's confirmation (a webhook). The browser can only read it.
- **Arcade runs are issued by the server.** A server function checks the
  player's entitlement and that day's allowance, records the attempt, then
  hands out the run (its clues and an expiry time). Answers are checked and
  scores recorded on the server, which also lets the same runs feed future
  leaderboards.
- **Premium and allowances need an account.** Guests can always play the
  free modes; a free account would be needed to use the daily Arcade
  allowance once it's enforced, so it can't be reset by clearing the browser.
  *Proposed (Open decision 7).*
- **Brutal content:** the clue bank is part of the public website, so a
  determined technical user could always build their own Brutal grid. The
  gate is a fair-use barrier for normal players, while anything of value
  (recorded results, rankings, the Brutal Challenge record) is checked on the
  server.
- **One switch per rule.** Each restriction (Brutal, Blitz allowance,
  Survival allowance) has its own setting, so they can launch separately.

### 3.7 Before anything is switched on

- A balance kept on the server, so it can't be edited in the browser.
- A South African payment provider (for example PayFast, Yoco, Paystack or
  Peach Payments), tested in test mode first.
- Server functions for entitlements and Arcade runs (§3.6), which need the
  Blaze plan (Open decision 2).
- Terms and refund policy.
- The owner's written approval of every price and rule, and of each launch.

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

### 4.11 Crossword Hub Arcade (*confirmed 19 October 2026*)

Two quick-fire modes that use single clues from the existing, validated clue
bank (about 24,650 clues across the genres and collections). No new content is
generated during play, and no AI is involved.

**Shared rules**

- One clue at a time, with letter boxes showing the answer's length (and word
  lengths for phrases). Typed with the phone's letter keys or a keyboard.
- Mobile-first, playable as a guest, with personal bests saved on the device
  and synced for signed-in players.
- No clue repeats within a run, and recently seen clues are avoided across
  runs.
- Answers are compared letter by letter, ignoring spaces and punctuation.
- **Answers are never revealed** (owner's decision, 20 October 2026): not
  after a wrong answer or a skip, and not in the results, which list only the
  answers the player got right. This protects the clue bank.
- **Play Again** at the end.
- Free and Premium players play under identical rules and scoring.
- Separate Arcade leaderboards later, with the verified leaderboards stage.

**A. Clue Blitz**

- A 60-second countdown. Answer as many clues as possible.
- **100 points** per correct answer, plus **25 bonus points** for each
  consecutive correct answer from the third onwards.
- **Skip** is free but resets the combo; so does a wrong submitted answer
  (the clue stays, to try again or skip).
- Score and current combo shown clearly throughout.
- Clues are drawn at random across topics, mostly easy and medium.
- Personal best tracked. *Confirmed 19 October 2026.*

**B. Survival**

- Start with **three lives**. A wrong submitted answer costs one life, and so
  does a **skip**; either way the answer is shown and the next round starts.
  The game ends when all three are gone.
- Typing is never penalised: only Submit counts, and part-filled answers are
  never marked wrong.
- Rounds 1–5 **Easy**, 6–12 **Medium**, 13–20 **Hard**, then **Expert**,
  growing harder (longer answers from round 31, longer still from 41). Every
  player can reach the toughest clues. Points rise with each stage.
- Tracks the highest round reached and the personal best score. *Confirmed
  19 October 2026.*

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
| Arcade (testing phase) | Nothing new: runs entirely in the browser from the existing clue bank | Free |
| Arcade allowances and Premium enforcement (later) | Cloud Functions to issue runs and check entitlements; Firestore for attempts and results | Needs Blaze. About two function calls and a few database writes per run, which stays within the free quotas for thousands of runs a day |

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

**Order from 19 October 2026 (recommended; awaiting the owner's approval):**

1. **Stage 10A: Arcade games** (free, unlimited, no restrictions): next.
2. **Switch on gift crosswords** (Stage 7A is built) whenever the owner says.
3. **Stage 8: Monetisation preparation**, now including the entitlement
   switches and the server design for Arcade runs and Brutal.
4. **Stage 10B: Arcade enforcement and launch of Premium rules**, only with the
   owner's approval, after payments are built and tested.
5. **Stage 6: verified leaderboards**, including Arcade boards, when there
   are enough players.
6. **Stage 9: Expansion.**

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

### Stage 6: Competitive and verified leaderboards (postponed)

**Postponed on 19 October 2026:** there aren't yet enough players for
rankings to feel worthwhile, challenge links already cover friendly
competition, and it would need the Blaze plan. Solve records already keep
the time and assisted status, so boards can be added later without
changing anything else. Revisit once analytics show a regular daily crowd,
or with the app-store versions.

- Daily and weekly boards: solo unassisted, solo assisted and collaborative.
- Server-checked submissions (Cloud Functions issue a start token and verify
  the finished grid and time).
- Friends-only boards.
- **Needs:** Open decision 2 (the Blaze plan). **Cost:** expected
  to stay within free quotas at launch scale; needs billing enabled.

### Stage 7: Crossword Hub Gifts

- **7A, manual builder (no AI, free): built, waiting to be switched on.**
  - The creator enters 4 to 24 answers and clues, plus optional To, From,
    title and a message shown once it's solved; the site builds the grid.
  - The whole gift travels inside its link (compressed, so the answers
    aren't readable in it). Nothing is stored on a server, so no sign-in is
    needed and there's nothing to revoke or delete; anyone with the link can
    open it. Gift progress stays on the solver's device and is never synced,
    and analytics only ever see how many answers a gift has.
  - "Coming soon" on the home page until `GIFTS_LIVE` in `js/gifts.js` is
    set to true. `#/gift/unlock` opens the builder on one device to try it
    (`#/gift/lock` closes it). Gift links always open.
  - Possible later additions: themes, a welcome message, and stored gifts
    with revocable links (these would need a database).
- **7B, AI generation:**
  - Story to answers and clues via a Cloud Function, with validation and
    "no invented facts" checks.
  - Per-account rate limits and editing before publishing.
  - Optional PIN and photo.
- **Needs:** 7A needs nothing new. 7B needs the Blaze plan, an AI provider and
  a testing budget (Open decision 5).

### Stage 8: Monetisation preparation (design, nothing activated)

- Premium entitlements mapped onto the `canAccess` function, with one switch
  per rule (Brutal, Blitz allowance, Survival allowance), all off.
- A tasteful Premium marker for Brutal, hidden while testing.
- The server design from §3.6: entitlements written only by the payment
  webhook, and Arcade runs issued and scored by server functions.
- A credit-wallet design: free daily credits, streak credits with expiry, and
  purchased credits.
- Payment provider comparison and test-mode plan.
- Terms and refund policy drafts.
- Ad placement plan.
- **Activation is a separate, owner-approved step.**

### Stage 10: Crossword Hub Arcade

- **10A, the games (free, nothing enforced): built, awaiting approval.** Clue Blitz and Survival as in
  §4.11, played in the browser from the existing clue bank, with personal
  bests on the device and synced for signed-in players. The allowance rules
  (§3.3) are built into the game logic but switched off, and attempts are
  only counted locally for testing. **Needs:** nothing new. **Cost:** free.
- **10B, enforcement (later, owner-approved):** server-issued runs, daily
  allowances, Premium unlimited play and verified scores (§3.6).
  **Needs:** the Blaze plan, payments and an account for allowance use.
  **Cost:** within free quotas at launch scale; payment fees apply.

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
| 19 Oct 2026 | Verified leaderboards (Stage 6) postponed until there are more players | Confirmed |
| 19 Oct 2026 | Gift builder (7A) built but shown as "Coming soon" until the owner switches it on; gifts live inside their links, with no sign-in or server storage | Built; awaiting activation |
| 19 Oct 2026 | Always free, even after monetisation: the Daily, the Mini, daily streaks and basic statistics, and basic play without registration | Confirmed |
| 19 Oct 2026 | Brutal difficulty, including the weekly Brutal Challenge, becomes a future Premium feature; free players can see it but not play it once restrictions launch; tasteful marker, never pushy | Confirmed; supersedes the 18 Oct decision that the Brutal Challenge stays free |
| 19 Oct 2026 | Crossword Hub Arcade: Clue Blitz (60 seconds) and Survival (three lives, rising difficulty), using the existing clue bank | Confirmed |
| 19 Oct 2026 | Future free allowance: one Clue Blitz and one Survival attempt a day, separate, reset at midnight SAST; an attempt is used only when play starts | Confirmed (interruption policy proposed) |
| 19 Oct 2026 | Premium: unlimited Arcade, Brutal, and the earlier library features; never a scoring advantage | Confirmed |
| 19 Oct 2026 | Testing phase: no paywalls, limits or checkout until the owner approves the launch; build so restrictions can be switched on later; enforce on the server, not in the browser alone | Confirmed |
| 20 Oct 2026 | Arcade expansion: Word Ladder (Daily and unlimited Practice), Statistics as a full page with Arcade records and Achievements, three-card Arcade. Clue Blitz and Survival keep one game of each a day; Word Ladder isn't limited | Built |
| 20 Oct 2026 | Visual identity: "nostalgic newspaper crossword meets playful vintage board game". Parchment with a paper grain, printer's ink, forest green actions, mustard rewards, coral Arcade. Masthead in Instrument Serif (option M3); app icon is the CH "Corner" monogram (option I2) in a 2×2 grid corner; our own ink-drawing illustrations, with licence-checked public-domain engravings only as supporting pieces; pencil-mark font in the Arcade only, sparingly; WhatsApp and Copy link first, Facebook and X under more sharing options | Confirmed; PR 1 (foundations) merged, PR 2 (grid, Arcade, completion, share card) built |
| 20 Oct 2026 | Arcade limited to one Clue Blitz and one Survival a day for everyone (no Premium yet), and answers are never revealed, so the clue bank isn't used up | Built |
| 19 Oct 2026 | Stage 10A approved: Blitz 100 points plus 25 per consecutive correct answer from the third, skip free but resets the combo; Survival three lives, skip costs a life, rounds 1–5 Easy, 6–12 Medium, 13–20 Hard, 21+ Expert and harder; runs survive refreshes; no attempt used before a run starts | Built in Stage 10A |

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
7. **Arcade allowance and accounts** (needed before 10B): whether using the
   free daily allowance needs a free account once it's enforced.
8. ~~Arcade tuning~~ — settled 19 October 2026 (§4.11). Survival points per
   stage (100, 150, 200, 300, 350, 400) were set in 10A and can be tuned.
9. ~~The Arcade's place in the roadmap~~ — Stage 10A approved 19 October 2026.
