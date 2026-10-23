/*
 * Hint credits and crossword duels: the rules, as pure functions.
 *
 * The trusted server (functions/index.js) uses these to decide every
 * balance, reward and result, inside Firestore transactions. The page uses
 * them only to show costs, balances and countdowns: it never changes a
 * wallet itself. Tested by tests/economy.test.js.
 *
 * Days run midnight to midnight South African time (UTC+2, no daylight
 * saving), like the Daily.
 */
(function (root) {
  'use strict';

  const ECONOMY = {
    dailyAllowance: 5, // complimentary credits a day; unused ones expire at midnight
    cost: { letter: 1, word: 3 },
    reward: { mini: 1, full: 3, win: 3, collection: 1 },
    collectionRewardsPerDay: 3, // rewarded genre and collection puzzles a day
    collectionMinClues: 10, // the smallest of those that earns credits
    winRewardsPerDay: 3, // rewarded duel wins a day (up to 9 credits)
    winRewardsPerOpponentPerDay: 2, // of those, against the same opponent
    launch: '2026-09-01', // the first published Daily
    ledgerKept: 50, // recent transactions shown in the wallet
  };

  // Crossword duels. minSeconds: the quickest win that still earns credits
  // (anything faster is almost certainly not a real solve).
  const DUELS = {
    mini: { label: 'Mini Duel', minutes: 5, minSeconds: 15 },
    classic: { label: 'Classic Duel', minutes: 20, minSeconds: 60 },
    countdownMs: 5000, // between both players being ready and the start
    lobbyHours: 24, // an unstarted challenge expires after this
    quickWaitMs: 45000, // a Quick Match search is dropped if not renewed
    reconnectMs: 60000, // how long a dropped player has to come back
    // A hint in a duel costs credits as usual and freezes your board for a
    // while, so it's never a free shortcut.
    hintFreezeMs: { letter: 10000, word: 30000 },
  };

  const DAY = 86400000;
  const SAST = 2 * 3600000;
  const sastDay = (ms) => Math.floor((ms + SAST) / DAY);
  const sastDate = (ms) => new Date(ms + SAST).toISOString().slice(0, 10);
  const dayToDate = (day) => new Date(day * DAY).toISOString().slice(0, 10);
  const msUntilReset = (ms) => (sastDay(ms) + 1) * DAY - SAST - ms;

  // ---------- Wallets ----------
  // { daily, dailyDay, earned, totals: { earned, spent, solves, wins, granted },
  //   winsDay, wins, opponents: { uid: wins }, collectionsDay, collections }
  function blankWallet() {
    return { daily: 0, dailyDay: 0, earned: 0, totals: { earned: 0, spent: 0, solves: 0, wins: 0, granted: 0 }, winsDay: 0, wins: 0, opponents: {}, collectionsDay: 0, collections: 0 };
  }
  function wallet(w) {
    const b = blankWallet();
    w = w || {};
    return {
      daily: w.daily || 0,
      dailyDay: w.dailyDay || 0,
      earned: w.earned || 0,
      totals: Object.assign(b.totals, w.totals),
      winsDay: w.winsDay || 0,
      wins: w.wins || 0,
      opponents: Object.assign({}, w.opponents),
      collectionsDay: w.collectionsDay || 0,
      collections: w.collections || 0,
    };
  }
  // The day's allowance: unused credits from an earlier day expire and a
  // fresh 5 arrive, once per day however often this is called.
  function refreshDaily(w, day) {
    w = wallet(w);
    if (w.dailyDay === day) return { wallet: w, granted: 0, expired: 0 };
    const expired = w.dailyDay ? w.daily : 0;
    w.daily = ECONOMY.dailyAllowance;
    w.dailyDay = day;
    w.totals.granted += ECONOMY.dailyAllowance;
    return { wallet: w, granted: ECONOMY.dailyAllowance, expired };
  }
  // What the player can spend today (call refreshDaily first).
  const available = (w, day) => (w.dailyDay === day ? w.daily : 0) + w.earned;
  // Spends daily credits first, then earned ones. Null if there aren't enough.
  function spend(w, cost, day) {
    w = wallet(w);
    if (!(cost > 0) || available(w, day) < cost) return null;
    const daily = w.dailyDay === day ? w.daily : 0;
    const fromDaily = Math.min(daily, cost);
    const fromEarned = cost - fromDaily;
    w.daily = daily - fromDaily;
    w.earned -= fromEarned;
    w.totals.spent += cost;
    return { wallet: w, fromDaily, fromEarned };
  }
  // Earned credits never expire.
  function earn(w, amount, source) {
    w = wallet(w);
    w.earned += amount;
    w.totals.earned += amount;
    if (source === 'wins' || source === 'solves') w.totals[source] += amount;
    return w;
  }

  // ---------- Rewards for solving ----------
  // A first No-Hint solve earns credits: a published Mini 1, a Daily or
  // Brutal Challenge 3, and a genre or collection puzzle 1. Those are
  // endless, so only a few a day earn (collectionReward) and only full-size
  // ones (the server checks). Gifts earn nothing. Returns { amount, kind } or null.
  const KEY = /^(daily|mini|brutal):(\d{4}-\d{2}-\d{2})$/;
  const PLAY_KEY = /^play:[a-z0-9-]{1,40}\/[a-z]{1,12}\/\d{1,12}\/L[A-Za-z0-9.]{1,600}$/; // with its layout code
  function puzzleReward(key, today) {
    if (PLAY_KEY.test(String(key || ''))) return { amount: ECONOMY.reward.collection, kind: 'collection' };
    const m = KEY.exec(String(key || ''));
    if (!m) return null;
    const date = m[2];
    if (date < ECONOMY.launch || date > today) return null;
    if (m[1] === 'brutal' && new Date(`${date}T00:00:00Z`).getUTCDay() !== 1) return null; // weeks are named by their Monday
    return m[1] === 'mini' ? { amount: ECONOMY.reward.mini, kind: 'mini' } : { amount: ECONOMY.reward.full, kind: 'full' };
  }

  // Whether a genre or collection solve still earns today. Returns { amount, why }.
  function collectionReward(w, day) {
    w = wallet(w);
    if (w.collectionsDay === day && w.collections >= ECONOMY.collectionRewardsPerDay) return { amount: 0, why: 'daily-limit' };
    return { amount: ECONOMY.reward.collection, why: 'solve' };
  }
  function recordCollectionReward(w, day) {
    w = wallet(w);
    if (w.collectionsDay !== day) {
      w.collectionsDay = day;
      w.collections = 0;
    }
    w.collections++;
    return w;
  }

  // ---------- Grids ----------
  // A solution or a player's grid as rows of letters ('' for a black square
  // or an empty one). Progress counts the white squares filled correctly.
  function progress(grid, solution) {
    let total = 0;
    let correct = 0;
    let filled = 0;
    solution.forEach((row, r) => row.forEach((ch, c) => {
      if (!ch) return;
      total++;
      const v = grid && grid[r] && typeof grid[r][c] === 'string' ? grid[r][c].toUpperCase() : '';
      if (v) filled++;
      if (v === ch) correct++;
    }));
    return { total, filled, correct, percent: total ? Math.floor((100 * correct) / total) : 0, solved: total > 0 && correct === total };
  }
  // A grid sent by a player, checked for shape: rows of single letters or ''.
  function validGrid(grid, rows, cols) {
    return Array.isArray(grid) && grid.length === rows
      && grid.every((row) => Array.isArray(row) && row.length === cols && row.every((v) => v === '' || (typeof v === 'string' && /^[A-Za-z]$/.test(v))));
  }

  // ---------- Duel rewards ----------
  // Whether a duel win earns credits: a real solve (not a forfeit), not
  // impossibly fast, within the day's limits. Returns { amount, why }.
  function winReward(w, { day, opponent, seconds, mode, reason }) {
    w = wallet(w);
    if (reason !== 'solved') return { amount: 0, why: 'forfeit' };
    if (!DUELS[mode] || seconds < DUELS[mode].minSeconds) return { amount: 0, why: 'too-fast' };
    const today = w.winsDay === day;
    if (today && w.wins >= ECONOMY.winRewardsPerDay) return { amount: 0, why: 'daily-limit' };
    if (today && (w.opponents[opponent] || 0) >= ECONOMY.winRewardsPerOpponentPerDay) return { amount: 0, why: 'opponent-limit' };
    return { amount: ECONOMY.reward.win, why: 'win' };
  }
  function recordWinReward(w, day, opponent) {
    w = wallet(w);
    if (w.winsDay !== day) {
      w.winsDay = day;
      w.wins = 0;
      w.opponents = {};
    }
    w.wins++;
    w.opponents[opponent] = (w.opponents[opponent] || 0) + 1;
    return w;
  }

  // ---------- Duel records ----------
  function blankDuelStats() {
    return { played: 0, won: 0, lost: 0, draws: 0, miniWins: 0, classicWins: 0, best: {}, streak: 0, longest: 0, credits: 0 };
  }
  function duelStats(s) {
    const b = blankDuelStats();
    return Object.assign(b, s, { best: Object.assign({}, s && s.best) });
  }
  // outcome: 'win' | 'loss' | 'draw'. seconds: the winner's solving time
  // (best times count only solved wins).
  function applyOutcome(s, { mode, outcome, seconds, solved, credits }) {
    s = duelStats(s);
    s.played++;
    if (outcome === 'win') {
      s.won++;
      if (mode === 'mini') s.miniWins++;
      if (mode === 'classic') s.classicWins++;
      s.streak++;
      s.longest = Math.max(s.longest, s.streak);
      if (solved && seconds > 0 && (!s.best[mode] || seconds < s.best[mode])) s.best[mode] = seconds;
    } else {
      if (outcome === 'loss') s.lost++;
      else s.draws++;
      s.streak = 0;
    }
    s.credits += credits || 0;
    return s;
  }
  const winRate = (s) => (s && s.played ? Math.round((100 * s.won) / s.played) : 0);

  // Challenge codes: 12 characters from an unambiguous alphabet (about 60
  // bits), so they can't be guessed.
  const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
  const validCode = (code) => typeof code === 'string' && new RegExp(`^[${CODE_ALPHABET}]{12}$`).test(code);
  // Player names shown to an opponent.
  // Names other players see (duels, Quick Match with strangers): no
  // obviously offensive words. Letters are compared with look-alike digits
  // undone (sh1t, b1tch); short words that hide inside ordinary names only
  // count on their own, so Essex, Hancock and Dickens stay allowed.
  const OFFENSIVE_PARTS = ['fuck', 'shit', 'cunt', 'nigg', 'bitch', 'whore', 'pussy', 'porn', 'nazi', 'hitler', 'faggot', 'retard', 'wank', 'twat', 'kike', 'dildo', 'penis', 'vagina', 'bastard', 'motherf', 'slut', 'rapist', 'pedo', 'paedo', 'jizz', 'boner', 'tranny', 'kkk'];
  const OFFENSIVE_WORDS = ['rape', 'dick', 'cock', 'sex', 'spic', 'chink', 'fag', 'anal', 'anus', 'cum', 'tits', 'arse', 'ass', 'piss', 'coon', 'gook', 'homo', 'nonce', 'prick', 'puta', 'kill'];
  function politeName(name) {
    const plain = String(name).toLowerCase().replace(/[0134578@$]/g, (c) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' }[c]));
    const squashed = plain.replace(/[^a-z]/g, '');
    if (OFFENSIVE_PARTS.some((w) => squashed.includes(w))) return false;
    const words = plain.split(/[^a-z]+/).filter(Boolean);
    return !words.some((w) => OFFENSIVE_WORDS.includes(w) || OFFENSIVE_WORDS.includes(w.replace(/s$/, '')));
  }
  const validName = (name) => typeof name === 'string' && /^[A-Za-z0-9 .'-]{1,20}$/.test(name) && name.trim().length > 0 && politeName(name);

  const api = {
    ECONOMY, DUELS, sastDay, sastDate, dayToDate, msUntilReset,
    blankWallet, wallet, refreshDaily, available, spend, earn,
    puzzleReward, collectionReward, recordCollectionReward, progress, validGrid, winReward, recordWinReward,
    blankDuelStats, duelStats, applyOutcome, winRate, CODE_ALPHABET, validCode, validName, politeName,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordEconomy = api;
})(typeof window !== 'undefined' ? window : globalThis);
