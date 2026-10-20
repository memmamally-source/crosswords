/*
 * Word Ladder: turn the start word into the target word one letter at a
 * time, making a real word at every step. Pure functions, so they can be
 * tested without a browser (tests/ladder.test.js); the screen is the Word
 * Ladder part of js/app.js.
 *
 * The words and puzzles are in puzzles/ladder.json, made by
 * tools/build-ladders.py:
 *   words[n]   every word accepted as a move (n = 4 or 5 letters)
 *   common[n]  everyday words; hints and the shortest ladder ("par") only use these
 *   ladders[n] 'from>to:par', each checked by a breadth-first search
 * The Daily Ladder for a date depends on the order and number of ladders,
 * so add new ones only alongside a note in the README.
 */
(function (root) {
  'use strict';

  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Five letters' };

  // Easy and Medium are 4-letter ladders with a short par; Hard is a long
  // 4-letter one; Five letters is the 5-letter set.
  function levelOf(len, par) {
    if (len === 5) return 'expert';
    return par <= 4 ? 'easy' : par === 5 ? 'medium' : 'hard';
  }

  function parse(data) {
    const lib = { words: {}, common: {}, ladders: [], byLevel: { easy: [], medium: [], hard: [], expert: [] } };
    for (const n of Object.keys(data.words)) {
      lib.words[n] = new Set(data.words[n].split(' '));
      lib.common[n] = new Set(data.common[n].split(' '));
      data.ladders[n].forEach((s, i) => {
        const [, from, to, par] = s.match(/^([a-z]+)>([a-z]+):(\d+)$/);
        const ladder = { id: `${n}:${i}`, from, to, par: Number(par), len: Number(n) };
        ladder.level = levelOf(ladder.len, ladder.par);
        lib.ladders.push(ladder);
        lib.byLevel[ladder.level].push(ladder);
      });
    }
    return lib;
  }
  const ladderById = (lib, id) => lib.ladders.find((l) => l.id === id) || null;

  const isWord = (lib, w) => !!(lib.words[w.length] && lib.words[w.length].has(w));
  function lettersChanged(a, b) {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  }
  function neighbours(word, set) {
    const out = [];
    for (let i = 0; i < word.length; i++) {
      for (const c of LETTERS) {
        if (c === word[i]) continue;
        const w = word.slice(0, i) + c + word.slice(i + 1);
        if (set.has(w)) out.push(w);
      }
    }
    return out;
  }

  // The shortest ladder from one word to another (both ends included),
  // using only words in `set` (the ends themselves needn't be in it), or
  // null if there isn't one.
  function shortestPath(from, to, set) {
    if (from.length !== to.length) return null;
    if (from === to) return [from];
    const prev = new Map([[from, null]]);
    let frontier = [from];
    const usable = { has: (w) => w === to || set.has(w) };
    while (frontier.length) {
      const next = [];
      for (const w of frontier) {
        for (const n of neighbours(w, usable)) {
          if (prev.has(n)) continue;
          prev.set(n, w);
          if (n === to) {
            const path = [to];
            for (let p = w; p; p = prev.get(p)) path.unshift(p);
            return path;
          }
          next.push(n);
        }
      }
      frontier = next;
    }
    return null;
  }

  // Checks a move from `prev` to `word`. Returns { ok: true } or
  // { ok: false, reason } with reason one of: empty, length, same,
  // letters, word, used.
  function checkMove(lib, prev, word, used = []) {
    word = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!word) return { ok: false, reason: 'empty' };
    if (word.length !== prev.length) return { ok: false, reason: 'length' };
    if (word === prev) return { ok: false, reason: 'same' };
    if (lettersChanged(prev, word) !== 1) return { ok: false, reason: 'letters' };
    if (!isWord(lib, word)) return { ok: false, reason: 'word' };
    if (used.includes(word)) return { ok: false, reason: 'used' };
    return { ok: true, word };
  }

  // A good next word from `current`: the next step of a shortest ladder to
  // the target through everyday words, or (if the player has wandered off
  // them) through any accepted word. Null if the target can't be reached
  // from here without going back.
  function hint(lib, current, target, used = []) {
    const n = String(current.length);
    for (const set of [lib.common[n], lib.words[n]]) {
      const avoid = new Set(used.filter((w) => w !== current));
      const path = shortestPath(current, target, { has: (w) => set.has(w) && !avoid.has(w) });
      if (path && path.length > 1) return path[1];
    }
    return null;
  }

  // ---------- Which ladder ----------
  const dayNumber = (day) => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 864e5);
  const weekday = (day) => (dayNumber(day) + 4) % 7; // 0 = Sunday
  // The Daily Ladder is a 4-letter ladder: easier early in the week.
  const DAILY_LEVEL = ['medium', 'easy', 'easy', 'medium', 'medium', 'hard', 'hard'];
  const STRIDE = 7919; // a prime: consecutive days spread over the whole list without repeats
  function dailyLadder(lib, day) {
    const list = lib.byLevel[DAILY_LEVEL[weekday(day)]];
    return list[(dayNumber(day) * STRIDE) % list.length];
  }

  // Practice gets harder as you go: easy to start with, then a mix that
  // brings in long ladders and, after 15, five-letter ones.
  function practiceLevel(done) {
    if (done < 3) return 'easy';
    if (done < 8) return ['easy', 'medium'][done % 2];
    if (done < 15) return ['medium', 'medium', 'hard'][done % 3];
    return ['medium', 'hard', 'expert', 'hard', 'expert'][done % 5];
  }
  const RECENT = 80;
  function practiceLadder(lib, done, recent = [], rand = Math.random) {
    const list = lib.byLevel[practiceLevel(done)];
    const fresh = list.filter((l) => !recent.includes(l.id));
    const pick = fresh.length ? fresh : list;
    return pick[Math.floor(rand() * pick.length)];
  }

  // ---------- A game ----------
  function newGame(ladder, mode, { day, now, replay = false }) {
    return {
      mode, id: ladder.id, from: ladder.from, to: ladder.to, par: ladder.par, level: ladder.level,
      day, replay, steps: [ladder.from], hints: 0, elapsed: 0, since: now, done: false,
    };
  }
  // Time is counted only while the game is on screen.
  const timeOf = (game, now) => game.elapsed + (game.since != null ? Math.max(0, now - game.since) : 0);
  function pause(game, now) {
    if (game.since != null) game.elapsed = timeOf(game, now);
    game.since = null;
  }
  function resume(game, now) {
    if (game.since == null && !game.done) game.since = now;
  }
  const current = (game) => game.steps[game.steps.length - 1];
  const moves = (game) => game.steps.length - 1;

  // Plays a word. Returns { result: 'bad', reason } or { result: 'ok' } or
  // { result: 'done', moves, time, score }.
  function play(lib, game, word, now) {
    if (game.done) return { result: 'bad', reason: 'done' };
    const check = checkMove(lib, current(game), word, game.steps);
    if (!check.ok) return { result: 'bad', reason: check.reason };
    game.steps.push(check.word);
    if (check.word !== game.to) return { result: 'ok' };
    pause(game, now);
    game.done = true;
    game.time = game.elapsed;
    game.score = score(moves(game), game.par, game.hints);
    return { result: 'done', moves: moves(game), time: game.time, score: game.score };
  }
  function undo(game) {
    if (game.done || game.steps.length < 2) return false;
    game.steps.pop();
    return true;
  }
  function useHint(lib, game) {
    if (game.done) return null;
    const word = hint(lib, current(game), game.to, game.steps);
    if (word) game.hints++;
    return word;
  }

  // 100 points for matching par, less 10 for each extra move and 20 for each
  // hint; never below 10. Time isn't part of the score.
  const score = (moveCount, par, hints) => Math.max(10, 100 - 10 * Math.max(0, moveCount - par) - 20 * hints);

  // ---------- Records ----------
  // store.ladder: {
  //   daily:    { 'YYYY-MM-DD': { id, moves, par, time, hints, score, at } }  (the first finish only)
  //   practice: { done, bestTime, fewest, perfect, recent: [ids] }
  //   games:    { daily, practice }  games in progress, kept on this device
  // }
  function blankRecord() {
    return { daily: {}, practice: { done: 0, bestTime: null, fewest: null, perfect: 0, recent: [] }, games: {} };
  }
  function record(rec) {
    rec = rec || {};
    const b = blankRecord();
    return {
      daily: Object.assign({}, rec.daily),
      practice: Object.assign(b.practice, rec.practice),
      games: Object.assign({}, rec.games),
    };
  }
  const minOf = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));

  // Saves a finished game. A replay of a Daily already done doesn't change
  // its result. Returns { record, isNew } (isNew: a first finish or a better
  // practice time or move count).
  function finishGame(rec, game, now) {
    rec = record(rec);
    let isNew = false;
    const moveCount = moves(game);
    if (game.mode === 'daily') {
      if (!rec.daily[game.day]) {
        rec.daily[game.day] = { id: game.id, moves: moveCount, par: game.par, time: game.time, hints: game.hints, score: game.score, at: now };
        isNew = true;
      }
    } else {
      const p = rec.practice;
      isNew = p.bestTime == null || game.time < p.bestTime || p.fewest == null || moveCount < p.fewest;
      p.done++;
      p.bestTime = minOf(p.bestTime, game.time);
      p.fewest = minOf(p.fewest, moveCount);
      if (moveCount <= game.par && !game.hints) p.perfect++;
      p.recent = [...p.recent.filter((id) => id !== game.id), game.id].slice(-RECENT);
    }
    return { record: rec, isNew };
  }

  // Daily Ladder streaks: consecutive days with the Daily Ladder done.
  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function streaks(dates, today) {
    const days = new Set(dates);
    let day = days.has(today) ? today : addDays(today, -1);
    let currentRun = 0;
    while (days.has(day)) {
      currentRun++;
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
    return { current: currentRun, longest };
  }

  function summary(rec, today) {
    rec = record(rec);
    const days = Object.values(rec.daily);
    const { current: streak, longest } = streaks(Object.keys(rec.daily), today);
    return {
      dailyDone: days.length,
      dailyBestTime: days.length ? Math.min(...days.map((d) => d.time)) : null,
      dailyFewest: days.length ? Math.min(...days.map((d) => d.moves)) : null,
      dailyPar: days.filter((d) => d.moves <= d.par && !d.hints).length,
      streak,
      longest,
      practiceDone: rec.practice.done,
      practiceBestTime: rec.practice.bestTime,
      practiceFewest: rec.practice.fewest,
      practicePerfect: rec.practice.perfect,
      completed: days.length + rec.practice.done,
    };
  }

  // Records from two devices, for a signed-in player: each Daily keeps its
  // first finish; practice keeps the larger counts and the better bests.
  function merge(a, b) {
    a = record(a);
    b = record(b);
    const daily = Object.assign({}, b.daily);
    for (const [day, r] of Object.entries(a.daily)) if (!daily[day] || (r.at || 0) < (daily[day].at || 0)) daily[day] = r;
    const p = a.practice;
    const q = b.practice;
    return {
      daily,
      practice: {
        done: Math.max(p.done, q.done),
        bestTime: minOf(p.bestTime, q.bestTime),
        fewest: minOf(p.fewest, q.fewest),
        perfect: Math.max(p.perfect, q.perfect),
        recent: [...new Set([...q.recent, ...p.recent])].slice(-RECENT),
      },
      games: a.games, // games in progress stay on their device
    };
  }
  // The part of the record kept in the account.
  const syncable = (rec) => {
    rec = record(rec);
    return { daily: rec.daily, practice: rec.practice };
  };

  const api = {
    LEVEL_LABEL, parse, ladderById, isWord, lettersChanged, neighbours, shortestPath, checkMove, hint,
    dayNumber, weekday, dailyLadder, practiceLevel, practiceLadder,
    newGame, timeOf, pause, resume, current, moves, play, undo, useHint, score,
    blankRecord, record, finishGame, streaks, summary, merge, syncable,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordLadder = api;
})(typeof window !== 'undefined' ? window : globalThis);
