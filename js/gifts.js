/*
 * Gift crosswords: a personal puzzle made from your own answers and clues,
 * sent as a link. The whole gift (title, names, clues, message and the grid
 * layout) travels inside the link itself, packed and compressed, so nothing
 * about it is stored on a server or sent to analytics.
 *
 * GIFTS_LIVE switches the builder on for everyone. While it's false the home
 * page shows "Coming soon"; #/gift/unlock opens the builder on one device
 * (for trying it out) and #/gift/lock closes it again. Gift links always
 * open, so a test gift can be sent to a friend.
 */
(function (root) {
  'use strict';

  const GIFTS_LIVE = false;

  const LIMITS = {
    minWords: 4,
    maxWords: 24,
    minLetters: 3,
    maxLetters: 15,
    clue: 90,
    title: 40,
    name: 30,
    message: 400,
  };

  const oneLine = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const text = (s, max) => String(s || '').replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

  // An answer as typed ("first date", "Rock 'n' roll") → its letters and
  // word lengths ("FIRSTDATE", [5, 4]). Accents are dropped (É → E).
  function parseAnswer(raw) {
    const words = String(raw || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[-–]/g, ' ').replace(/[^A-Z ]/g, '').split(' ').filter(Boolean);
    return { answer: words.join(''), lengths: words.map((w) => w.length) };
  }

  // The clue with its word lengths added for multi-word answers: "(5,4)".
  function withLengths(clue, lengths) {
    const c = oneLine(clue, LIMITS.clue).replace(/\s*\(\d+(,\d+)*\)$/, '');
    return lengths.length > 1 ? `${c} (${lengths.join(',')})` : c;
  }

  // Checks the builder's rows. Returns { words, problems }: words ready for
  // the grid, and a plain-English problem for each row that can't be used.
  function cleanEntries(rows) {
    const words = [];
    const problems = [];
    const seen = new Set();
    rows.forEach((row, i) => {
      const n = i + 1;
      const rawAnswer = String(row.answer || '').trim();
      const rawClue = String(row.clue || '').trim();
      if (!rawAnswer && !rawClue) return;
      const { answer, lengths } = parseAnswer(rawAnswer);
      if (!rawAnswer) return problems.push({ row: i, text: `Line ${n} has a clue but no answer.` });
      if (!rawClue) return problems.push({ row: i, text: `Line ${n} needs a clue for ${rawAnswer}.` });
      if (answer.length < LIMITS.minLetters) return problems.push({ row: i, text: `${rawAnswer} is too short: answers need at least ${LIMITS.minLetters} letters.` });
      if (answer.length > LIMITS.maxLetters) return problems.push({ row: i, text: `${rawAnswer} is too long: answers can have at most ${LIMITS.maxLetters} letters.` });
      if (seen.has(answer)) return problems.push({ row: i, text: `${rawAnswer} is in the list twice.` });
      if (new RegExp(`\\b${answer}\\b`, 'i').test(rawClue.replace(/[^A-Za-z ]/g, ''))) {
        return problems.push({ row: i, text: `The clue for ${rawAnswer} gives the answer away.` });
      }
      seen.add(answer);
      words.push({ answer, clue: withLengths(rawClue, lengths) });
    });
    if (words.length > LIMITS.maxWords) problems.push({ row: -1, text: `That's ${words.length} answers; a gift can have at most ${LIMITS.maxWords}.` });
    else if (words.length < LIMITS.minWords && !problems.length) problems.push({ row: -1, text: `Add at least ${LIMITS.minWords} answers (you have ${words.length}).` });
    return { words, problems };
  }

  // Lays the words out as a crossword, trying several layouts and keeping
  // the one that fits the most words (then the most compact). Words that
  // share no letters with the rest can't join the grid; they're returned
  // in `missing`.
  function buildGrid(gen, words, attempt = 0) {
    let best = null;
    const score = (p) => p.words.length * 10000 - p.rows * p.cols;
    for (const maxSize of [13, 15, 17, 21]) {
      for (let k = 0; k < 6; k++) {
        const p = gen.generate(words, { count: words.length, maxSize, seed: 7919 * (attempt + 1) + k * 104729 + maxSize, attempts: 80 });
        if (!best || score(p) > score(best)) best = p;
      }
      if (best.words.length === words.length) break;
    }
    const placed = new Set(best.words.map((w) => w.answer));
    return { puzzle: best, missing: words.filter((w) => !placed.has(w.answer)).map((w) => w.answer) };
  }

  // ---------- Packing a gift into a link ----------
  const toB64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64 = (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };
  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  const canZip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

  // gift: { title, from, to, message, words: [{ answer, clue }], layout }
  async function encodeGift(gift) {
    const data = {
      v: 1,
      t: oneLine(gift.title, LIMITS.title),
      f: oneLine(gift.from, LIMITS.name),
      o: oneLine(gift.to, LIMITS.name),
      m: text(gift.message, LIMITS.message),
      w: gift.words.map((w) => [w.answer, w.clue]),
      l: gift.layout,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    if (canZip()) {
      try {
        return 'z' + toB64(await pipe(bytes, new CompressionStream('deflate-raw')));
      } catch (e) { /* fall back to plain */ }
    }
    return 'j' + toB64(bytes);
  }

  // The gift in a link, or null if the link is damaged or not a gift.
  async function decodeGift(code) {
    try {
      if (!/^[zj][A-Za-z0-9_-]+$/.test(code || '') || code.length > 12000) return null;
      let bytes = fromB64(code.slice(1));
      if (code[0] === 'z') {
        if (!canZip()) return null;
        bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
      }
      const d = JSON.parse(new TextDecoder().decode(bytes));
      if (!d || d.v !== 1 || !Array.isArray(d.w) || typeof d.l !== 'string') return null;
      const words = d.w
        .filter((w) => Array.isArray(w) && /^[A-Z]{3,15}$/.test(w[0]) && typeof w[1] === 'string')
        .slice(0, LIMITS.maxWords)
        .map(([answer, clue]) => ({ answer, clue: oneLine(clue, LIMITS.clue + 10) }));
      if (!words.length) return null;
      return {
        title: oneLine(d.t, LIMITS.title),
        from: oneLine(d.f, LIMITS.name),
        to: oneLine(d.o, LIMITS.name),
        message: text(d.m, LIMITS.message),
        words,
        layout: d.l,
      };
    } catch (e) {
      return null;
    }
  }

  // A short, stable name for a gift (for saved progress).
  function giftId(code) {
    let h = 2166136261;
    for (let i = 0; i < code.length; i++) h = Math.imul(h ^ code.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }

  const api = { GIFTS_LIVE, LIMITS, parseAnswer, withLengths, cleanEntries, buildGrid, encodeGift, decodeGift, giftId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordGifts = api;
})(typeof window !== 'undefined' ? window : globalThis);
