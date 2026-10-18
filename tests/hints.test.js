// Hint costs: node tests/hints.test.js
const assert = require('assert');
const { HINT_RULES, REPHRASED_CLUES, hintTotal } = require('../js/hints.js');

// Credits (what a hint costs the player) and penalties (competitive hint
// points) are separate scales covering the same hints.
assert.deepStrictEqual(HINT_RULES.credits, { letter: 1, rephrase: 2, word: 3 });
assert.notStrictEqual(HINT_RULES.credits, HINT_RULES.penalties);
assert.deepStrictEqual(Object.keys(HINT_RULES.penalties).sort(), Object.keys(HINT_RULES.credits).sort());
for (const scale of ['credits', 'penalties']) {
  for (const [hint, n] of Object.entries(HINT_RULES[scale])) assert.ok(Number.isInteger(n) && n > 0, `${scale}.${hint} must be a positive whole number`);
}

const used = { letter: 3, rephrase: 1, word: 2 };
assert.strictEqual(hintTotal('credits', used), 3 * 1 + 1 * 2 + 2 * 3);
assert.strictEqual(hintTotal('penalties', used), 3 * HINT_RULES.penalties.letter + HINT_RULES.penalties.rephrase + 2 * HINT_RULES.penalties.word);
assert.strictEqual(hintTotal('credits', {}), 0, 'no hints, no cost');

// Rephrased clues must not give away their answer.
for (const [answer, clue] of Object.entries(REPHRASED_CLUES)) {
  assert.ok(clue && !clue.toUpperCase().replace(/[^A-Z]/g, '').includes(answer), `rephrased clue for ${answer} gives it away`);
}
console.log(`OK: hint costs (${Object.keys(REPHRASED_CLUES).length} rephrased clues)`);
