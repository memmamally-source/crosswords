/*
 * Hints: what each one costs, kept in one place so the numbers are easy to
 * change.
 *
 * Two separate scales:
 *   credits:   what a hint costs the player in hint credits (for a future
 *              credit balance; nothing is charged yet).
 *   penalties: the competitive hint points a hint adds to a solve's score.
 *              Fewer is better; these decide No-Hint status and, later,
 *              leaderboard order.
 *
 * Checking and auto-check are free on both scales, but mark a puzzle as
 * assisted, which keeps it out of the No-Hint Club.
 */
const HINT_RULES = {
  credits: { letter: 1, rephrase: 2, word: 3 },
  penalties: { letter: 2, rephrase: 1, word: 5 },
};

// Rephrased clues, keyed by answer: a second, plainer wording of a clue. The
// "Rephrase clue" hint only appears for answers listed here. Filled in by the
// separate rephrased-clue task; empty until then.
const REPHRASED_CLUES = {};

// Total credits or penalty points for a puzzle's hint use, given counts like
// { letter: 3, rephrase: 1, word: 0 }.
function hintTotal(scale, used) {
  const rates = HINT_RULES[scale];
  return Object.keys(rates).reduce((t, k) => t + (used[k] || 0) * rates[k], 0);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { HINT_RULES, REPHRASED_CLUES, hintTotal };
