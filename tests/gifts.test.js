// Gift crosswords: node tests/gifts.test.js
const assert = require('assert');
const gen = require('../js/generator.js');
const G = require('../js/gifts.js');

(async () => {
  // Answers as people type them.
  assert.deepStrictEqual(G.parseAnswer(' first date '), { answer: 'FIRSTDATE', lengths: [5, 4] });
  assert.deepStrictEqual(G.parseAnswer("Rock 'n' roll"), { answer: 'ROCKNROLL', lengths: [4, 1, 4] });
  assert.deepStrictEqual(G.parseAnswer('Café'), { answer: 'CAFE', lengths: [4] });
  assert.deepStrictEqual(G.parseAnswer('Port-Elizabeth'), { answer: 'PORTELIZABETH', lengths: [4, 9] });
  assert.strictEqual(G.withLengths('Where we met', [5, 4]), 'Where we met (5,4)');
  assert.strictEqual(G.withLengths('Our dog (5)', [5]), 'Our dog');

  // Checking the builder's rows.
  const rows = [
    { answer: 'Paris', clue: 'City of our honeymoon' },
    { answer: 'first date', clue: 'Pizza and a movie, March 2019' },
    { answer: 'Biscuit', clue: 'Our scruffy dog' },
    { answer: 'Pancakes', clue: 'Sunday breakfast tradition' },
    { answer: 'Ocean', clue: 'Where you proposed, by the ___' },
    { answer: '', clue: '' },
  ];
  let r = G.cleanEntries(rows);
  assert.deepStrictEqual(r.problems, []);
  assert.strictEqual(r.words.length, 5);
  assert.strictEqual(r.words[1].clue, 'Pizza and a movie, March 2019 (5,4)');
  r = G.cleanEntries([...rows, { answer: 'Paris', clue: 'Again' }, { answer: 'Ox', clue: 'Short' }, { answer: 'Tea', clue: '' }, { answer: 'Dog', clue: 'A dog' }]);
  assert.strictEqual(r.problems.length, 4, JSON.stringify(r.problems));
  assert.ok(G.cleanEntries(rows.slice(0, 2)).problems[0].text.includes('at least 4'));
  assert.ok(G.cleanEntries(Array.from({ length: 30 }, (_, i) => ({ answer: 'WORD' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26] + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(i / 26)], clue: 'x' }))).problems.some((p) => p.text.includes('at most')));

  // Laying out a grid, packing it into a link and opening it again.
  const { words } = G.cleanEntries(rows);
  const { puzzle, missing } = G.buildGrid(gen, words);
  assert.strictEqual(puzzle.words.length + missing.length, words.length);
  assert.ok(puzzle.words.length >= 4, 'most words fit');
  const placed = words.filter((w) => !missing.includes(w.answer));
  const gift = { title: 'Happy anniversary', from: 'Sam', to: 'Alex', message: 'Love you!\nHere’s to ten more years.', words: placed, layout: gen.layoutCode(puzzle) };
  const code = await G.encodeGift(gift);
  assert.ok(/^z[A-Za-z0-9_-]+$/.test(code), 'URL-safe and compressed');
  const back = await G.decodeGift(code);
  assert.deepStrictEqual(back, { ...gift, message: 'Love you!\nHere’s to ten more years.' });
  const rebuilt = gen.fromLayoutCode(back.layout, back.words);
  assert.deepStrictEqual(rebuilt.solution, puzzle.solution);
  // No answer is readable in the link.
  for (const w of words) assert.ok(!code.toUpperCase().includes(w.answer), `${w.answer} visible in the link`);

  // Damaged or foreign links are refused.
  assert.strictEqual(await G.decodeGift(code.slice(0, 20)), null);
  assert.strictEqual(await G.decodeGift('hello'), null);
  assert.strictEqual(await G.decodeGift(''), null);
  assert.strictEqual(await G.decodeGift('j' + Buffer.from('{"v":2}').toString('base64url')), null);
  // Over-long fields are cut down when opened.
  const long = await G.decodeGift('j' + Buffer.from(JSON.stringify({ v: 1, t: 'T'.repeat(500), f: 'F', o: '', m: 'M'.repeat(5000), w: [['ABC', 'clue'], ['bad answer', 'x']], l: 'L' })).toString('base64url'));
  assert.strictEqual(long.title.length, G.LIMITS.title);
  assert.strictEqual(long.message.length, G.LIMITS.message);
  assert.strictEqual(long.words.length, 1);

  assert.strictEqual(G.giftId(code), G.giftId(code));
  assert.notStrictEqual(G.giftId(code), G.giftId(code + 'a'));
  assert.strictEqual(G.GIFTS_LIVE, false, 'gifts stay "Coming soon" until the owner switches them on');
  console.log('OK: gift crosswords');
})().catch((e) => { console.error(e); process.exit(1); });
