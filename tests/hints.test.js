// Hint costs: node tests/hints.test.js
const assert = require('assert');
const { HINT_RULES, hintTotal } = require('../js/hints.js');

// Only two hints exist: Reveal Letter and Reveal Word (the rephrase-clue hint
// was removed on 18 October 2026).
assert.deepStrictEqual(Object.keys(HINT_RULES.credits).sort(), ['letter', 'word']);
assert.deepStrictEqual(Object.keys(HINT_RULES.penalties).sort(), ['letter', 'word']);

// Future credit costs: 1 per letter, 3 per word. Competitive hint points are
// a separate scale.
assert.deepStrictEqual(HINT_RULES.credits, { letter: 1, word: 3 });
assert.notStrictEqual(HINT_RULES.credits, HINT_RULES.penalties);
for (const scale of ['credits', 'penalties']) {
  for (const [hint, n] of Object.entries(HINT_RULES[scale])) assert.ok(Number.isInteger(n) && n > 0, `${scale}.${hint} must be a positive whole number`);
}

const used = { letter: 3, word: 2 };
assert.strictEqual(hintTotal('credits', used), 3 * 1 + 2 * 3);
assert.strictEqual(hintTotal('penalties', used), 3 * HINT_RULES.penalties.letter + 2 * HINT_RULES.penalties.word);
assert.strictEqual(hintTotal('credits', {}), 0, 'no hints, no cost');
// Solves saved while the rephrase hint existed carry rephrase: 0; it's ignored.
assert.strictEqual(hintTotal('penalties', { letter: 1, rephrase: 4, word: 0 }), HINT_RULES.penalties.letter);
console.log('OK: hint costs (Reveal Letter and Reveal Word)');
