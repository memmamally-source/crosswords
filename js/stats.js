/*
 * Player statistics worked out from saved solves: streaks, hints used,
 * average time and favourite genres. Pure functions, so they can be tested
 * without a browser (tests/stats.test.js).
 *
 * Solves are keyed by puzzle: 'daily:YYYY-MM-DD', 'mini:YYYY-MM-DD',
 * 'brutal:YYYY-MM-DD' (the week's Monday) or 'play:<genre>/<level>/...'.
 */
(function (root) {
  'use strict';

  const addDays = (key, n) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  };

  // The current and longest runs of consecutive dates. The current run may
  // end today or, if today isn't done yet, yesterday.
  function runs(dates, today, launch) {
    const days = new Set(dates);
    let day = days.has(today) ? today : addDays(today, -1);
    let current = 0;
    while (day >= launch && days.has(day)) {
      current++;
      day = addDays(day, -1);
    }
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const d of [...days].sort()) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = d;
    }
    return { current, longest };
  }

  // The daily streak: a day counts once if its Daily or its Mini was
  // finished, with or without hints or checks.
  function dailyStreak(solves, today, launch) {
    const dates = Object.keys(solves || {})
      .filter((k) => k.startsWith('daily:') || k.startsWith('mini:'))
      .map((k) => k.slice(k.indexOf(':') + 1));
    return runs(dates, today, launch);
  }

  // The No-Hint streak: Dailies finished with no reveals and no checks.
  function noHintStreak(solves, today, launch) {
    const dates = Object.entries(solves || {})
      .filter(([k, s]) => k.startsWith('daily:') && s.noHint)
      .map(([k]) => k.slice(6));
    return runs(dates, today, launch);
  }

  // Hints used in one solve (letters plus words revealed). Solves from before
  // hint tracking counted every revealed letter, including those of revealed
  // words; for those, a revealed word counts once and its letters don't.
  function hintsUsed(s) {
    if (s.hints) return (s.hints.letter || 0) + (s.hints.word || 0);
    return s.words ? s.words : s.letters || 0;
  }

  function totals(solves) {
    const list = Object.values(solves || {});
    const timed = list.filter((s) => s.time > 0);
    return {
      solved: list.length,
      hints: list.reduce((t, s) => t + hintsUsed(s), 0),
      averageTime: timed.length ? timed.reduce((t, s) => t + s.time, 0) / timed.length : null,
    };
  }

  // The genres and collections played most, by finished puzzles: [{ id, count }].
  function favourites(solves, limit = 3) {
    const counts = new Map();
    for (const k of Object.keys(solves || {})) {
      if (!k.startsWith('play:')) continue;
      const id = k.slice(5).split('/')[0];
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return [...counts].map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  const api = { addDays, runs, dailyStreak, noHintStreak, hintsUsed, totals, favourites };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
