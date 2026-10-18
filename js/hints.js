/*
 * Hints: Reveal Letter and Reveal Word. What each one costs is kept here so
 * the numbers are easy to change.
 *
 * Two separate scales:
 *   credits:   what a hint will cost in hint credits once credits exist.
 *              Hints are free during the growth phase: credits are
 *              counted on each solve but never charged or limited.
 *   penalties: the competitive hint points a hint adds to a solve's score.
 *              Fewer is better; these decide No-Hint status and, later,
 *              leaderboard order.
 *
 * Checking and auto-check are free on both scales, but mark a puzzle as
 * assisted, which keeps it out of the No-Hint Club.
 */
const HINT_RULES = {
  credits: { letter: 1, word: 3 },
  penalties: { letter: 2, word: 5 },
};

// Total credits or penalty points for a puzzle's hint use, given counts like
// { letter: 3, word: 1 }.
function hintTotal(scale, used) {
  const rates = HINT_RULES[scale];
  return Object.keys(rates).reduce((t, k) => t + (used[k] || 0) * rates[k], 0);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { HINT_RULES, hintTotal };
