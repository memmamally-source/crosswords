/*
 * Crossword Hub Arcade: Clue Blitz and Survival. One clue at a time, drawn
 * from the existing, fact-checked clue bank (genres and collections), so
 * nothing is generated during play.
 *
 * Everything here is pure game logic (no page code), so it can be tested in
 * Node: building the clue pool, picking clues, scoring, lives, difficulty,
 * saved runs and the daily allowances. The screens are in js/app.js.
 *
 * Runs are plain objects saved after every move, so refreshing or coming
 * back never resets a clock, restores lives or rerolls a clue.
 *
 * Daily allowance: one Blitz and one Survival a day (MASTER_PLAN §3.3),
 * reset at midnight South African time. It's counted in the browser (and the
 * account, when signed in), which stops ordinary replaying; server-side
 * enforcement comes with Premium (§3.6).
 *
 * Answers are never revealed during or after a run (only the ones the
 * player got right), and missed answers aren't stored, so the clue bank
 * isn't given away one skip at a time.
 */
(function (root) {
  'use strict';

  // On since 20 October 2026 (owner's decision): one Clue Blitz and one
  // Survival a day for everyone, counted on the device and in a signed-in
  // player's account. There's no Premium yet, so no one gets more.
  const LIMITS_ACTIVE = true;
  const FREE_ATTEMPTS = { blitz: 1, survival: 1 };

  const BLITZ = { seconds: 60, points: 100, comboFrom: 3, comboBonus: 25 };
  // Survival: three lives; each round's level, and points for a correct answer.
  const SURVIVAL = {
    lives: 3,
    tiers: [
      { to: 5, level: 'easy', points: 100 },
      { to: 12, level: 'medium', points: 150 },
      { to: 20, level: 'hard', points: 200 },
      { to: 30, level: 'expert', points: 300 },
      { to: 40, level: 'expert', points: 350, minLetters: 8 },
      { to: Infinity, level: 'expert', points: 400, minLetters: 10 },
    ],
  };
  const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
  const RECENT_LIMIT = 800; // answers remembered across runs, to avoid repeats
  const LOG_LIMIT = 60;

  const letters = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');

  // Every clue, once per answer, with an Arcade level:
  //   genre puzzles: easy, medium and hard as rated; hard academic answers
  //   are Expert. Fan collections: Casual counts as Medium (it needs the
  //   show or sport), Fan as Hard and Superfan as Expert.
  function buildPool(genres) {
    const pool = [];
    const seen = new Set();
    const add = (w, level, source) => {
      const answer = letters(w.answer);
      if (answer.length < 3 || answer.length > 15 || seen.has(answer) || !w.clue) return;
      seen.add(answer);
      pool.push({ answer, clue: w.clue, level, source });
    };
    for (const g of genres) {
      if (g.category === 'mixed') continue;
      for (const w of g.words) {
        if (g.themed) add(w, { casual: 'medium', fan: 'hard', superfan: 'expert' }[w.tier] || 'hard', g.name);
        else add(w, w.level === 'hard' && g.category === 'academic' ? 'expert' : w.level, g.name);
      }
    }
    const byLevel = { easy: [], medium: [], hard: [], expert: [] };
    for (const e of pool) byLevel[e.level].push(e);
    return { all: pool, byLevel };
  }

  // A seeded random number generator (the same one the crosswords use).
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Word lengths for the answer boxes, read from the clue's "(5,4)" when
  // there is one.
  function wordLengths(entry) {
    const m = entry.clue.match(/\((\d+(?:[,-]\d+)+)\)\s*$/);
    if (m) {
      const parts = m[1].split(/[,-]/).map(Number);
      if (parts.reduce((a, b) => a + b, 0) === entry.answer.length) return parts;
    }
    return [entry.answer.length];
  }

  // Picks the next clue: never one already used in this run, and avoiding
  // recently seen answers while there are others to choose from. The choice
  // depends only on the run's seed and position, so it can't be rerolled.
  function pickClue(pool, { levels, minLetters = 0, used = [], recent = [], seed, n }) {
    const r = rng((seed + n * 7919) >>> 0);
    const level = levels.length === 1 ? levels[0] : levels[Math.floor(r() * levels.length)];
    const usedSet = new Set(used);
    const recentSet = new Set(recent);
    const fits = (e) => e.answer.length >= minLetters;
    let list = pool.byLevel[level].filter((e) => fits(e) && !usedSet.has(e.answer) && !recentSet.has(e.answer));
    if (!list.length) list = pool.byLevel[level].filter((e) => fits(e) && !usedSet.has(e.answer));
    if (!list.length) list = pool.all.filter((e) => !usedSet.has(e.answer));
    const e = list[Math.floor(r() * list.length)];
    return { answer: e.answer, clue: e.clue, level: e.level, source: e.source, lengths: wordLengths(e) };
  }

  const tierFor = (round) => SURVIVAL.tiers.find((t) => round <= t.to);
  // Blitz is a sprint: mostly easy, with medium mixed in.
  const BLITZ_LEVELS = ['easy', 'easy', 'easy', 'medium', 'medium'];

  function nextClue(run, pool) {
    if (run.mode === 'blitz') return pickClue(pool, { levels: BLITZ_LEVELS, used: run.used, recent: run.recent, seed: run.seed, n: run.n });
    const tier = tierFor(run.round);
    return pickClue(pool, { levels: [tier.level], minLetters: tier.minLetters, used: run.used, recent: run.recent, seed: run.seed, n: run.n });
  }

  // A new run, ready to show its first clue. It only counts as an attempt
  // once the page has shown that clue (see recordAttempt).
  function newRun(mode, pool, { seed, now, day, recent = [] }) {
    const run = {
      mode, seed: seed >>> 0, day, startedAt: now, n: 0, score: 0, correct: 0,
      used: [], recent: recent.slice(-RECENT_LIMIT), log: [], finished: false,
    };
    if (mode === 'blitz') Object.assign(run, { endsAt: now + BLITZ.seconds * 1000, combo: 0, bestCombo: 0, skips: 0, wrong: 0 });
    else Object.assign(run, { round: 1, lives: SURVIVAL.lives, misses: 0, sheet: [] });
    run.clue = nextClue(run, pool);
    run.used.push(run.clue.answer);
    return run;
  }

  const timeLeft = (run, now) => (run.mode === 'blitz' ? Math.max(0, run.endsAt - now) : Infinity);

  // Over when Blitz's minute is up, Survival's lives are gone, or a Survival
  // run reaches the daily reset (midnight South African time).
  function isOver(run, now, day) {
    if (run.finished) return true;
    if (run.mode === 'blitz') return now >= run.endsAt;
    return run.lives <= 0 || (day && run.day !== day);
  }
  function finish(run, now, day) {
    if (!run.finished && isOver(run, now, day)) {
      run.finished = true;
      run.endedAt = run.mode === 'blitz' ? run.endsAt : now;
      if (run.mode === 'survival' && run.lives > 0) run.endedBy = 'reset';
    }
    return run.finished;
  }

  function advance(run, pool) {
    run.n++;
    run.clue = nextClue(run, pool);
    run.used.push(run.clue.answer);
  }
  const note = (run, entry) => {
    run.log.push(entry);
    if (run.log.length > LOG_LIMIT) run.log.shift();
  };
  // Survival's score sheet: one line per round played (never the answer).
  const mark = (run, ok, points) => {
    if (!run.sheet) run.sheet = []; // runs saved before the score sheet
    run.sheet.push({ round: run.round, level: run.clue.level, ok, points });
    if (run.sheet.length > LOG_LIMIT) run.sheet.shift();
  };

  // Points for a correct Blitz answer: 100, plus 25 from the third answer in
  // a row onwards.
  const blitzPoints = (combo) => BLITZ.points + (combo >= BLITZ.comboFrom ? BLITZ.comboBonus : 0);

  // The player's answer. Returns what happened:
  //   { result: 'correct' | 'wrong' | 'over' | 'empty' | 'incomplete', points, answer }
  // Nothing happens until Submit (an empty or part-filled guess is never a
  // mistake); a full, correct guess may be submitted automatically.
  function submit(run, pool, guess, now, day) {
    if (finish(run, now, day)) return { result: 'over' };
    const g = letters(guess);
    if (!g) return { result: 'empty' };
    const answer = run.clue.answer;
    // Not every box filled: a nudge, never a mistake.
    if (g.length !== answer.length) return { result: 'incomplete' };
    if (g === answer) {
      run.correct++;
      let points;
      if (run.mode === 'blitz') {
        run.combo++;
        run.bestCombo = Math.max(run.bestCombo, run.combo);
        points = blitzPoints(run.combo);
      } else {
        points = tierFor(run.round).points;
        mark(run, true, points);
        run.round++;
      }
      run.score += points;
      note(run, { answer, clue: run.clue.clue, ok: true });
      advance(run, pool);
      return { result: 'correct', points, answer };
    }
    if (run.mode === 'blitz') {
      run.wrong++;
      run.combo = 0; // stay on the clue: try again or skip
      return { result: 'wrong', answer: null };
    }
    return loseLife(run, pool, now, day, 'wrong');
  }

  // Skip: free in Blitz (but it ends the combo); costs a life in Survival.
  function skip(run, pool, now, day) {
    if (finish(run, now, day)) return { result: 'over' };
    const answer = run.clue.answer;
    if (run.mode === 'blitz') {
      run.skips++;
      run.combo = 0;
      advance(run, pool);
      return { result: 'skipped' };
    }
    return loseLife(run, pool, now, day, 'skipped');
  }

  // Survival: a wrong answer or a skip costs a life and moves on to the
  // next round. The answer isn't revealed.
  function loseLife(run, pool, now, day, result) {
    mark(run, false, 0);
    run.lives--;
    run.misses++;
    if (run.lives <= 0) {
      run.finished = true;
      run.endedAt = now;
      return { result, over: true };
    }
    run.round++;
    advance(run, pool);
    return { result, over: false };
  }

  // The round a Survival run reached (the one it ended on).
  const roundReached = (run) => run.round;

  // ---------- Personal bests ----------
  // best: { blitz: { score, correct, bestCombo, at }, survival: { score, round, at } }
  function updateBest(best, run) {
    const out = Object.assign({ blitz: null, survival: null }, best);
    let isNew = false;
    if (run.mode === 'blitz') {
      const b = out.blitz;
      if (!b || run.score > b.score || (run.score === b.score && run.correct > b.correct)) {
        out.blitz = { score: run.score, correct: run.correct, bestCombo: run.bestCombo, at: run.endedAt || run.startedAt };
        isNew = run.score > 0;
      }
    } else {
      const b = out.survival || { score: 0, round: 0 };
      const round = roundReached(run);
      if (run.score > b.score || round > b.round) {
        out.survival = { score: Math.max(run.score, b.score), round: Math.max(round, b.round), at: run.endedAt || run.startedAt };
        isNew = run.score > b.score || round > b.round;
      }
    }
    return { best: out, isNew };
  }

  // Answers to avoid in the next runs: the latest ones last.
  function remember(recent, run) {
    const set = new Set(run.used);
    return [...(recent || []).filter((a) => !set.has(a)), ...run.used].slice(-RECENT_LIMIT);
  }

  // ---------- Daily allowances (built, switched off) ----------
  // ledger: { day, blitz, survival } — attempts started on `day`.
  function attemptsToday(ledger, mode, day) {
    return ledger && ledger.day === day ? ledger[mode] || 0 : 0;
  }
  // Whether a new run may start. While LIMITS_ACTIVE is false (testing),
  // always yes. `premium` comes from the server once entitlements exist.
  function canStart(mode, ledger, day, { premium = false, limitsActive = LIMITS_ACTIVE } = {}) {
    const used = attemptsToday(ledger, mode, day);
    if (!limitsActive || premium) return { allowed: true, limited: false, remaining: Infinity, used };
    const remaining = Math.max(0, FREE_ATTEMPTS[mode] - used);
    return { allowed: remaining > 0, limited: true, remaining, used };
  }
  // Counts an attempt. Called only once a run's first clue is on screen.
  function recordAttempt(ledger, mode, day) {
    const out = ledger && ledger.day === day ? Object.assign({}, ledger) : { day, blitz: 0, survival: 0 };
    out[mode] = (out[mode] || 0) + 1;
    return out;
  }

  const api = {
    LIMITS_ACTIVE, FREE_ATTEMPTS, BLITZ, SURVIVAL, LEVEL_LABEL, RECENT_LIMIT,
    letters, buildPool, wordLengths, pickClue, tierFor, newRun, timeLeft, isOver, finish,
    submit, skip, blitzPoints, roundReached, updateBest, remember,
    attemptsToday, canStart, recordAttempt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordArcade = api;
})(typeof window !== 'undefined' ? window : globalThis);
