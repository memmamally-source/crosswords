/*
 * Crossword layout generator.
 *
 * Takes a bank of { answer, clue } entries and builds a connected, valid
 * crossword: every word crosses at least one other word, no two parallel
 * words touch, and every run of 2+ letters in the grid is a real entry.
 */
(function (root) {
  'use strict';

  // Small seeded PRNG so a given seed always produces the same puzzle.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const DIRS = {
    across: { dr: 0, dc: 1 },
    down: { dr: 1, dc: 0 },
  };

  function key(r, c) {
    return r + ',' + c;
  }

  class Board {
    constructor(maxSize) {
      this.cells = new Map(); // key -> { ch, across, down }
      this.byLetter = new Map(); // letter -> [[r, c], ...]
      this.placed = [];
      this.maxSize = maxSize;
      this.minR = 0; this.maxR = -1; this.minC = 0; this.maxC = -1;
    }

    get(r, c) {
      return this.cells.get(key(r, c));
    }

    // Returns the number of crossings for a legal placement, or -1.
    evaluate(word, r, c, dir) {
      const { dr, dc } = DIRS[dir];
      const len = word.length;
      if (this.get(r - dr, c - dc) || this.get(r + dr * len, c + dc * len)) return -1;

      if (this.placed.length) {
        const minR = Math.min(this.minR, r);
        const maxR = Math.max(this.maxR, r + dr * (len - 1));
        const minC = Math.min(this.minC, c);
        const maxC = Math.max(this.maxC, c + dc * (len - 1));
        if (maxR - minR + 1 > this.maxSize || maxC - minC + 1 > this.maxSize) return -1;
      } else if (len > this.maxSize) {
        return -1;
      }

      let crossings = 0;
      for (let i = 0; i < len; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        const cell = this.get(rr, cc);
        if (cell) {
          if (cell.ch !== word[i] || cell[dir]) return -1;
          crossings++;
        } else if (this.get(rr + dc, cc + dr) || this.get(rr - dc, cc - dr)) {
          // An empty square must not sit beside a letter running the other way.
          return -1;
        }
      }
      if (this.placed.length && crossings === 0) return -1;
      return crossings;
    }

    place(entry, r, c, dir) {
      const { dr, dc } = DIRS[dir];
      const word = entry.answer;
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i;
        const cc = c + dc * i;
        const k = key(rr, cc);
        let cell = this.cells.get(k);
        if (!cell) {
          cell = { ch: word[i], across: false, down: false };
          this.cells.set(k, cell);
          if (!this.byLetter.has(cell.ch)) this.byLetter.set(cell.ch, []);
          this.byLetter.get(cell.ch).push([rr, cc]);
        }
        cell[dir] = true;
      }
      const endR = r + dr * (word.length - 1);
      const endC = c + dc * (word.length - 1);
      if (!this.placed.length) {
        this.minR = r; this.maxR = endR; this.minC = c; this.maxC = endC;
      } else {
        this.minR = Math.min(this.minR, r);
        this.maxR = Math.max(this.maxR, endR);
        this.minC = Math.min(this.minC, c);
        this.maxC = Math.max(this.maxC, endC);
      }
      this.placed.push({ entry, r, c, dir });
    }

    area() {
      return (this.maxR - this.minR + 1) * (this.maxC - this.minC + 1);
    }

    // All legal positions for a word that cross an existing letter.
    candidates(word) {
      const out = [];
      for (let i = 0; i < word.length; i++) {
        for (const [r, c] of this.byLetter.get(word[i]) || []) {
          const cell = this.get(r, c);
          for (const dir of ['across', 'down']) {
            if (cell[dir]) continue;
            const { dr, dc } = DIRS[dir];
            const sr = r - dr * i;
            const sc = c - dc * i;
            const crossings = this.evaluate(word, sr, sc, dir);
            if (crossings > 0) out.push({ r: sr, c: sc, dir, crossings });
          }
        }
      }
      return out;
    }
  }

  // Answers from the bank that a clue mentions: single words (and simple
  // plurals) plus two- and three-word runs, since answers drop their spaces.
  function mentionedAnswers(entry, answers) {
    const words = entry.clue
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter(Boolean);
    const found = new Set();
    const consider = (w) => {
      for (const form of [w, w.replace(/ES$/, ''), w.replace(/S$/, '')]) {
        if (form.length >= 3 && form !== entry.answer && answers.has(form)) found.add(form);
      }
    };
    words.forEach((w, i) => {
      consider(w);
      if (i + 1 < words.length) consider(w + words[i + 1]);
      if (i + 2 < words.length) consider(w + words[i + 1] + words[i + 2]);
    });
    return [...found];
  }

  function buildAttempt(bank, answers, count, maxSize, rng, hardTarget) {
    // Favour longer words first (they give later words more to hook onto),
    // with some randomness so each puzzle feels different.
    // Large banks (the mixed genres) are sampled so each attempt stays fast.
    // With a hard target, a few hard answers are tried early and the rest
    // lean towards easy ones.
    const mixed = hardTarget != null;
    const sample = mixed
      ? shuffle(bank.filter((e) => e.level === 'hard'), rng).slice(0, Math.max(hardTarget * 4, 8))
          .concat(shuffle(bank.filter((e) => e.level !== 'hard'), rng).slice(0, Math.max(count * 4, 48)))
      : shuffle(bank, rng).slice(0, Math.max(count * 4, 48));
    const boost = (e) => (!mixed ? 0 : e.level === 'hard' ? 3 : e.level === 'easy' ? 2 : 0);
    const pool = sample
      .map((e) => ({ e, w: Math.min(e.answer.length, 8) + rng() * 4 + boost(e) }))
      .sort((a, b) => b.w - a.w)
      .map((x) => x.e);
    pool.forEach((e) => {
      if (!e.mentions) e.mentions = mentionedAnswers(e, answers);
    });

    const board = new Board(maxSize);
    const first = pool.find((e) => e.answer.length <= maxSize && !(mixed && e.level === 'hard' && !hardTarget));
    if (!first) return board;
    // A clue must never give away another answer in the same puzzle, so two
    // entries are kept apart when either one's clue mentions the other.
    const placedAnswers = new Set();
    const blocked = new Set();
    board.hardPlaced = 0;
    const allowed = (e) =>
      !blocked.has(e.answer) &&
      !e.mentions.some((a) => placedAnswers.has(a)) &&
      !(mixed && e.level === 'hard' && board.hardPlaced >= hardTarget);
    const place = (e, r, c, dir) => {
      board.place(e, r, c, dir);
      if (e.level === 'hard') board.hardPlaced++;
      placedAnswers.add(e.answer);
      e.mentions.forEach((a) => blocked.add(a));
    };
    place(first, 0, 0, rng() < 0.5 ? 'across' : 'down');

    let remaining = pool.filter((e) => e !== first);
    // Several passes: words that didn't fit early may fit once the grid grows.
    for (let pass = 0; pass < 3 && board.placed.length < count; pass++) {
      const skipped = [];
      for (const entry of remaining) {
        if (board.placed.length >= count) break;
        if (!allowed(entry)) continue;
        const options = board.candidates(entry.answer);
        if (!options.length) {
          skipped.push(entry);
          continue;
        }
        const area = board.area();
        let best = null;
        let bestScore = -Infinity;
        for (const o of options) {
          const { dr, dc } = DIRS[o.dir];
          const len = entry.answer.length;
          const h = Math.max(board.maxR, o.r + dr * (len - 1)) - Math.min(board.minR, o.r) + 1;
          const w = Math.max(board.maxC, o.c + dc * (len - 1)) - Math.min(board.minC, o.c) + 1;
          const growth = h * w - area;
          const squareness = -Math.abs(h - w);
          const score = o.crossings * 12 - growth * 0.35 + squareness + rng() * 6;
          if (score > bestScore) {
            bestScore = score;
            best = o;
          }
        }
        place(entry, best.r, best.c, best.dir);
      }
      remaining = skipped;
    }
    return board;
  }

  function finalize(board) {
    const offR = board.minR;
    const offC = board.minC;
    const rows = board.maxR - board.minR + 1;
    const cols = board.maxC - board.minC + 1;

    const solution = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const [k, cell] of board.cells) {
      const [r, c] = k.split(',').map(Number);
      solution[r - offR][c - offC] = cell.ch;
    }

    const words = board.placed.map((p) => ({
      answer: p.entry.answer,
      clue: p.entry.clue,
      tag: p.entry.tag,
      dir: p.dir,
      row: p.r - offR,
      col: p.c - offC,
    }));

    // Number start squares in reading order.
    const starts = new Map();
    words
      .slice()
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .forEach((w) => {
        const k = key(w.row, w.col);
        if (!starts.has(k)) starts.set(k, starts.size + 1);
      });
    words.forEach((w) => {
      w.number = starts.get(key(w.row, w.col));
      const { dr, dc } = DIRS[w.dir];
      w.cells = Array.from({ length: w.answer.length }, (_, i) => [w.row + dr * i, w.col + dc * i]);
    });
    words.sort((a, b) => (a.dir === b.dir ? a.number - b.number : a.dir === 'across' ? -1 : 1));

    const numbers = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (const [k, n] of starts) {
      const [r, c] = k.split(',').map(Number);
      numbers[r][c] = n;
    }

    return { rows, cols, solution, numbers, words };
  }

  /**
   * generate(bank, { count, maxSize, seed, attempts, hard })
 * hard: how many answers marked level 'hard' to include; the rest favour
 * 'easy' ones. Leave it out to ignore levels.
   * Returns { rows, cols, solution, numbers, words, seed }.
   */
  function generate(bank, options) {
    const opts = Object.assign({ count: 10, maxSize: 13, attempts: 60 }, options);
    const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31);
    const rng = mulberry32(seed);
    const clean = bank
      .map((e) => ({
        answer: e.answer.toUpperCase().replace(/[^A-Z]/g, ''),
        // An entry may carry several clues; the seed picks one.
        clue: Array.isArray(e.clue) ? e.clue[Math.floor(rng() * e.clue.length)] : e.clue,
        tag: e.tag,
        level: e.level,
      }))
      .filter((e) => e.answer.length >= 3);
    const answers = new Set(clean.map((e) => e.answer));

    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < opts.attempts; i++) {
      const board = buildAttempt(clean, answers, opts.count, opts.maxSize, rng, opts.hard);
      const crossings = [...board.cells.values()].filter((c) => c.across && c.down).length;
      const hardMiss = opts.hard != null ? Math.abs(opts.hard - board.hardPlaced) : 0;
      const score = board.placed.length * 1000 - hardMiss * 300 + crossings * 10 - board.area();
      if (score > bestScore) {
        bestScore = score;
        best = board;
      }
      if (board.placed.length >= opts.count && !hardMiss && i >= opts.attempts / 3) break;
    }
    // Banks of long words sometimes can't all fit; allow a slightly larger grid.
    if (best.placed.length < opts.count && !opts.grown) {
      for (const extra of [2, 4]) {
        const bigger = generate(bank, Object.assign({}, opts, { seed, maxSize: opts.maxSize + extra, grown: true }));
        if (bigger.words.length >= opts.count) return bigger;
      }
    }
    const puzzle = finalize(best);
    puzzle.seed = seed;
    return puzzle;
  }

  /**
   * rotatingPool(bank, day, size, salt): the slice of a shuffled bank used on a
   * given day number. Consecutive days get disjoint slices until the bank is
   * used up, then a new shuffle begins, so answers don't recur for a while.
   */
  function rotatingPool(bank, day, size, salt) {
    const per = Math.max(1, Math.floor(bank.length / size));
    const cycle = Math.floor(day / per);
    const slot = day % per;
    const order = shuffle(bank.map((_, i) => i), mulberry32(cycle * 7919 + salt));
    return order.slice(slot * size, slot * size + size).map((i) => bank[i]);
  }

  const api = { generate, mulberry32, rotatingPool, mentionedAnswers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordGenerator = api;
})(typeof window !== 'undefined' ? window : globalThis);
