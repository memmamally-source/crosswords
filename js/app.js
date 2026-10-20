/* global CrosswordGenerator, CrosswordSync, GENRES, CATEGORIES, DIFFICULTIES, THEMED_LEVELS, themedBank, levelsFor, bankFor, weekOf, brutalBuild, DAILY_BANK, DAILY_SCHEDULE, scheduleFor, MINI_BANK, MINI_CONFIG, dailyBuild, miniBuild, FEATURED, hintTotal, CrosswordStats, canAccess, CrosswordShare, HubAnalytics, CrosswordRooms, CrosswordGifts, CrosswordArcade, CrosswordLadder, CrosswordEconomy */
(function () {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  // Running as the Android or iOS app (mobile/): the same page, without
  // what only makes sense on the web (installing it, the service worker).
  const inApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const SITE = 'https://crosswordhub.app/'; // where links to share point from the app
  if (inApp) document.documentElement.classList.add('in-app');
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Puzzles before this date are not offered in the archive.
  const LAUNCH = '2026-09-01';

  // ---------- Storage (best effort: the site works without it) ----------
  const STORE_KEY = 'crosswordhub:v1';
  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function migrate(old) {
    if (old.v === 2) return old;
    const s = {
      v: 2,
      settings: { theme: 'system', skipFilled: old.skipFilled !== false, autocheck: !!old.autocheck, showTags: true, showTimer: true },
      difficulty: old.difficulty || 'medium',
      category: 'tv',
      saves: {},
      solves: {},
      best: old.best || {},
      seen: old.seen || {},
      lastWords: old.lastWords || {},
      solvedCount: old.solved || 0,
    };
    const sv = old.saved;
    if (sv && !sv.daily && sv.genre) {
      s.saves[`play:${sv.genre}/${sv.difficulty}/${sv.seed}/${sv.pool || ''}`] = {
        entries: sv.entries, revealed: sv.revealed, elapsed: sv.elapsed || 0, reveals: sv.reveals || 0, checks: sv.checks || 0, updated: Date.now(),
      };
    }
    return s;
  }
  const store = migrate(loadStore());
  // Phones and tablets, which type with the device keyboard.
  const touchScreen = window.matchMedia('(pointer: coarse)');
  if (!store.themedLevel) store.themedLevel = 'fan';
  store.settings = Object.assign({ theme: 'system', skipFilled: true, autocheck: false, showTags: true, showTimer: true, vibrate: true }, store.settings);
  const storeListeners = [];
  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      /* storage unavailable or full: progress just won't persist */
    }
    storeListeners.forEach((fn) => fn());
  }

  // ---------- Dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // The official date is South African time (UTC+2, no daylight saving), so
  // every player shares one "today". The time comes from the web server's
  // clock when it can be read (see syncClock), not the device's clock.
  const SAST_OFFSET = 2 * 3600 * 1000;
  let clockOffset = 0;
  const now = () => Date.now() + clockOffset;
  const todayKey = () => {
    const d = new Date(now() + SAST_OFFSET);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  };
  // Reads the server's clock from the Date header of a tiny request. If the
  // device is more than a minute out, the difference is applied.
  async function syncClock() {
    try {
      const sent = Date.now();
      const res = await fetch(location.pathname, { method: 'HEAD', cache: 'no-store' });
      const back = Date.now();
      const server = Date.parse(res.headers.get('date'));
      if (Number.isNaN(server)) return;
      const offset = server - (sent + back) / 2;
      clockOffset = Math.abs(offset) > 60 * 1000 ? offset : 0;
    } catch (e) {
      /* offline: use the device clock */
    }
  }
  const withTimeout = (promise, ms) => Promise.race([promise, new Promise((done) => setTimeout(done, ms))]);
  function parseKey(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function addDays(k, n) {
    const d = parseKey(k);
    d.setDate(d.getDate() + n);
    return keyOf(d);
  }
  const validDate = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && k >= LAUNCH && k <= todayKey() && keyOf(parseKey(k)) === k;
  const longDate = (k) => parseKey(k).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const shortDate = (k) => parseKey(k).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  function formatTime(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = pad(s % 60);
    return h ? `${h}:${pad(m)}:${sec}` : `${m}:${sec}`;
  }
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // ---------- Puzzle definitions ----------
  const genreById = (id) => GENRES.find((g) => g.id === id);
  const categoryById = (id) => CATEGORIES.find((c) => c.id === id);
  const DAILY_SUBJECTS = new Set(DAILY_BANK.map((w) => w.tag)).size;

  // ---------- Frozen puzzles ----------
  // Every published Daily and Mini is saved in puzzles/YYYY-MM.json, and each
  // week's Brutal Challenge in puzzles/brutal-YYYY-MM.json (made by
  // tools/freeze-puzzles.js), so they never change once published. Dates not
  // frozen yet are built on the spot, the same way the freeze tool builds them.
  const frozenMonths = new Map(); // month -> data, or null once known missing
  const monthLoads = new Map();
  function loadMonth(month) {
    if (!monthLoads.has(month)) {
      monthLoads.set(month, fetch(`puzzles/${month}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((data) => {
          if (data) frozenMonths.set(month, data);
          else monthLoads.delete(month); // try again next time (e.g. offline)
          return data;
        }));
    }
    return monthLoads.get(month);
  }
  const frozenFile = (kind, date) => (kind === 'brutal' ? 'brutal-' : '') + date.slice(0, 7);
  const frozenPuzzle = (kind, date) => {
    const data = frozenMonths.get(frozenFile(kind, date));
    return (data && data[kind] && data[kind][date]) || null;
  };

  function dailySpec(date) {
    const sched = scheduleFor(date);
    return {
      kind: 'daily',
      key: `daily:${date}`,
      url: `#/daily/${date}`,
      date,
      sched,
      kicker: `The Daily · ${sched.level}`,
      title: longDate(date),
      meta: `${sched.count} clues · drawn from ${DAILY_SUBJECTS} academic subjects`,
      build: () => dailyBuild(date),
      tags: true,
    };
  }

  function miniSpec(date) {
    return {
      kind: 'mini',
      key: `mini:${date}`,
      url: `#/mini/${date}`,
      date,
      kicker: 'The Mini',
      title: longDate(date),
      meta: `${MINI_CONFIG.count} clues · a quick warm-up`,
      build: () => miniBuild(date),
      tags: true,
    };
  }

  // The Brutal Challenge: one shared Brutal puzzle a week, named by its Monday.
  function brutalSpec(week) {
    return {
      kind: 'brutal',
      key: `brutal:${week}`,
      url: `#/brutal/${week}`,
      date: week,
      kicker: 'The Brutal Challenge',
      title: `Week of ${parseKey(week).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
      meta: `${DIFFICULTIES.brutal.count} clues · no easy answers · every genre`,
      build: () => brutalBuild(week),
      tags: true,
    };
  }

  // Genre puzzle links. New links ("L..." codes) record the finished grid,
  // so they rebuild exactly even after word lists change. Older links list
  // word positions in a genre's list; those are read against a snapshot of
  // the lists as they were (words/legacy-order.json), loaded when needed.
  const encodePool = (indices) => indices.slice().sort((a, b) => a - b).map((i) => i.toString(36)).join('.');
  let legacyOrder = null;
  function loadLegacyOrder() {
    if (!legacyOrder) {
      legacyOrder = fetch('words/legacy-order.json')
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null)
        .then((data) => {
          if (!data) legacyOrder = null; // try again next time
          return data;
        });
    }
    return legacyOrder;
  }
  let legacyLists = null; // genre id -> answers, once loaded
  function decodePool(genre, code) {
    if (!code || code[0] === 'L') return null;
    const indices = code.split('.').map((x) => parseInt(x, 36));
    let words;
    if (legacyLists && legacyLists[genre.id]) {
      const byAnswer = new Map(genre.words.map((w) => [w.answer, w]));
      const answers = legacyLists[genre.id].split(' ');
      words = indices.map((i) => byAnswer.get(answers[i]));
    } else {
      words = indices.map((i) => genre.words[i]);
    }
    words = words.filter(Boolean);
    return words.length ? words : null;
  }

  // The level a genre is played at: Casual/Fan/Superfan for themed
  // collections, Easy/Medium/Hard for the rest.
  const levelFor = (genre) => (genre.themed ? store.themedLevel : store.difficulty);

  function genreSpec(genre, difficulty, seed, pool) {
    const cfg = levelsFor(genre)[difficulty];
    const cat = categoryById(genre.category);
    const words = decodePool(genre, pool) || genre.words;
    return {
      kind: 'genre',
      key: `play:${genre.id}/${difficulty}/${seed}/${pool || ''}`,
      layout: pool && pool[0] === 'L' ? pool : null,
      url: `#/play/${genre.id}/${difficulty}/${seed}${pool ? '/' + pool : ''}`,
      genre,
      difficulty,
      pool,
      kicker: cat ? (genre.themed && cat.id !== 'sport' ? `${cat.name} · Unofficial fan crossword` : cat.name) : 'Genre puzzle',
      title: genre.name,
      meta: `${cfg.label} · ${cfg.count} clues`,
      bank: bankFor(genre, words, difficulty),
      count: cfg.count,
      maxSize: cfg.maxSize,
      hard: cfg.hard,
      seed,
      tags: genre.category === 'mixed',
    };
  }

  const puzzleCache = new Map();
  function puzzleFor(spec) {
    if (spec.kind === 'duel') return CrosswordGenerator.thaw(spec.frozen); // answers hidden ("?")
    if (puzzleCache.has(spec.key)) return puzzleCache.get(spec.key);
    let puzzle;
    let keep = true;
    if (spec.kind === 'daily' || spec.kind === 'mini' || spec.kind === 'brutal') {
      const frozen = frozenPuzzle(spec.kind, spec.date);
      if (frozen) {
        puzzle = CrosswordGenerator.thaw(frozen);
      } else {
        const { bank, options } = spec.build();
        puzzle = CrosswordGenerator.generate(bank, options);
        // Don't hold on to a built copy while the month's frozen file is still loading.
        const file = frozenFile(spec.kind, spec.date);
        keep = !monthLoads.has(file) || frozenMonths.has(file);
      }
    } else if (spec.kind === 'gift') {
      puzzle = CrosswordGenerator.fromLayoutCode(spec.layout, spec.gift.words);
      if (!puzzle) return null;
    } else if (spec.layout) {
      puzzle = CrosswordGenerator.fromLayoutCode(spec.layout, spec.genre.words);
      if (!puzzle) return null; // a word in the link is no longer in the bank
    } else {
      puzzle = CrosswordGenerator.generate(spec.bank, { count: spec.count, maxSize: spec.maxSize, hard: spec.hard, seed: spec.seed });
    }
    if (keep) puzzleCache.set(spec.key, puzzle);
    return puzzle;
  }

  // ---------- Genre word rotation ----------
  // New genre puzzles use only words the player hasn't seen in that genre.
  // When the bank runs low a new cycle starts, still skipping the last
  // puzzle. The pool goes into the URL so a link always rebuilds the grid.
  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function freshGenreSpec(genre, difficulty) {
    const cfg = levelsFor(genre)[difficulty];
    const levels = new Map(bankFor(genre, genre.words, difficulty).map((w) => [w.answer, w.level]));
    const all = genre.words.map((_, i) => i).filter((i) => levels.has(genre.words[i].answer));
    const isHard = (i) => levels.get(genre.words[i].answer) === 'hard';
    let seen = new Set(store.seen[genre.id] || []);
    let unseen = all.filter((i) => !seen.has(genre.words[i].answer));
    if (unseen.length < cfg.count + 6) {
      seen = new Set(store.lastWords[genre.id] || []);
      store.seen[genre.id] = [...seen];
      unseen = all.filter((i) => !seen.has(genre.words[i].answer));
    }
    // Enough tough answers for the level, plus plenty of the rest.
    const fresh = shuffled(unseen);
    let pool = fresh.filter(isHard).slice(0, cfg.hard * 3).concat(fresh.filter((i) => !isHard(i)).slice(0, Math.max(80, cfg.count * 5)));
    const spare = shuffled(all.filter((i) => !pool.includes(i)));
    let best = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      const spec = genreSpec(genre, difficulty, Math.floor(Math.random() * 1e9), encodePool(pool));
      const placed = puzzleFor(spec).words.length;
      if (!best || placed > best.placed) best = { spec, placed };
      if (placed >= cfg.count) break;
      pool = pool.concat(spare.splice(0, 4)); // let a few seen words back in so the grid fills
    }
    // Share the finished grid itself, so the link never depends on word order.
    const puzzle = puzzleFor(best.spec);
    const code = CrosswordGenerator.layoutCode(puzzle);
    if (!code) return best.spec;
    const spec = genreSpec(genre, difficulty, 0, code);
    puzzleCache.set(spec.key, puzzle);
    return spec;
  }

  function rememberWords(genre, puzzle) {
    const answers = puzzle.words.map((w) => w.answer);
    store.seen[genre.id] = [...new Set((store.seen[genre.id] || []).concat(answers))];
    store.lastWords[genre.id] = answers;
  }

  // ---------- Progress & stats ----------
  function statusOf(key) {
    const solve = store.solves[key];
    if (solve) return solve.clean ? 'solved' : 'assisted';
    const save = store.saves[key];
    if (save && save.entries && save.entries.some((row) => row.some(Boolean))) return 'progress';
    return 'none';
  }

  // The daily streak: a day counts once if its Daily or Mini was finished,
  // with or without help (see js/stats.js).
  const dailyStreaks = () => CrosswordStats.dailyStreak(store.solves, todayKey(), LAUNCH);

  // ---------- Analytics (optional; see js/analytics.js) ----------
  // Off unless a measurement ID is configured and the player allows it.
  const analytics = typeof HubAnalytics !== 'undefined' ? HubAnalytics : { available: false, start() {}, stop() {}, track() {}, page() {} };
  if (analytics.available && store.settings.analytics === true) analytics.start();
  // Return visits are noted only while analytics is on, so a visit made
  // without consent is never reported later.
  function setAnalytics(on) {
    store.settings.analytics = on;
    saveStore();
    if (on) analytics.start();
    else analytics.stop();
    if (on) noteVisit();
    $('#consent').hidden = true;
    syncSettingsUI();
  }
  // Asked once, on the home page only, so it never gets in the way of a puzzle.
  function offerConsent(view) {
    $('#consent').hidden = !(analytics.available && store.settings.analytics == null && view === 'home');
  }
  // What a puzzle is, for analytics: kind, category, level and genre only.
  function puzzleParams(spec) {
    if (spec.kind === 'gift') return { puzzle_kind: 'gift', category: 'gift', level: 'gift' }; // never the gift's contents
    if (spec.kind === 'genre') return { puzzle_kind: 'genre', category: spec.genre.category, level: spec.difficulty, genre: spec.genre.id };
    const level = spec.kind === 'daily' ? scheduleFor(spec.date).level.toLowerCase() : spec.kind;
    return { puzzle_kind: spec.kind, category: spec.kind, level };
  }
  // Return visits: once a day, how many days since the last visit. Google
  // Analytics also reports new and returning players itself.
  function noteVisit() {
    const today = todayKey();
    const last = store.lastVisit;
    if (last === today) return;
    if (last) {
      const days = Math.round((Date.parse(today) - Date.parse(last)) / 86400000);
      if (days > 0) analytics.track('return_visit', { days_since_last_visit: days });
    }
    store.lastVisit = today;
    saveStore();
  }

  // ---------- Settings & theme ----------
  function applyTheme() {
    const t = store.settings.theme;
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    $$('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === t)));
    // Match the phone's status bar to a theme picked in settings.
    $$('meta[name="theme-color"]').forEach((m) => {
      if (!m.dataset.media) m.dataset.media = m.getAttribute('media');
      if (t === 'light' || t === 'dark') m.removeAttribute('media');
      else m.setAttribute('media', m.dataset.media);
      if (t !== 'system') m.content = t === 'dark' ? '#121212' : '#ffffff';
      else m.content = m.dataset.media.includes('dark') ? '#121212' : '#ffffff';
    });
  }

  function syncSettingsUI() {
    $('#set-skip').checked = store.settings.skipFilled;
    syncAutocheckUI();
    $('#set-tags').checked = store.settings.showTags;
    $('#set-timer').checked = store.settings.showTimer;
    $('#set-vibrate').checked = store.settings.vibrate;
    $('#set-vibrate').closest('.switch').hidden = !canVibrate;
    $('#set-appkeys').checked = store.settings.appKeys === true;
    $('#set-sound').checked = store.settings.sound !== false;
    $('#set-appkeys-row').hidden = !touchDevice();
    $('#set-analytics-row').hidden = !analytics.available;
    $('#set-analytics').checked = store.settings.analytics === true;
    $('#timer').classList.toggle('hidden-time', !store.settings.showTimer);
    applyTheme();
  }

  // ---------- Grid thumbnails ----------
  const thumbQueue = [];
  let thumbTimer = null;
  function queueThumb(canvas, getPuzzle) {
    thumbQueue.push({ canvas, getPuzzle });
    if (!thumbTimer) thumbTimer = setTimeout(runThumbs, 30);
  }
  function runThumbs() {
    thumbTimer = null;
    const job = thumbQueue.shift();
    if (!job) return;
    if (job.canvas.isConnected) drawThumb(job.canvas, job.getPuzzle());
    if (thumbQueue.length) thumbTimer = setTimeout(runThumbs, 16);
  }
  function drawThumb(canvas, puzzle) {
    const css = getComputedStyle(document.documentElement);
    const block = css.getPropertyValue('--thumb-bg').trim() || '#121212';
    const cell = css.getPropertyValue('--thumb-cell').trim() || '#fff';
    const size = canvas.clientWidth || 64;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = block;
    ctx.fillRect(0, 0, size, size);
    const n = Math.max(puzzle.rows, puzzle.cols);
    const unit = size / n;
    const ox = ((n - puzzle.cols) * unit) / 2;
    const oy = ((n - puzzle.rows) * unit) / 2;
    ctx.fillStyle = cell;
    const gap = Math.max(0.5, unit * 0.08);
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (puzzle.solution[r][c]) ctx.fillRect(ox + c * unit + gap / 2, oy + r * unit + gap / 2, unit - gap, unit - gap);
      }
    }
  }

  // ---------- Icons ----------
  // Simple stroke icons (24×24) for genres and featured cards.
  const ICONS = {
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
    popcorn: '<path d="M5 9l2 12h10l2-12"/><path d="M5 9a3 3 0 015-2.5 3 3 0 014 0A3 3 0 0119 9z"/><path d="M10 9l.5 12M14 9l-.5 12"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6"/>',
    paw: '<circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="4.5" cy="12" r="1.8"/><circle cx="19.5" cy="12" r="1.8"/><path d="M12 12c-3 0-5 3-5 5.5 0 1.6 1.5 2.5 3 2l2-.6 2 .6c1.5.5 3-.4 3-2C17 15 15 12 12 12z"/>',
    utensils: '<path d="M7 3v8M5 3v4a2 2 0 004 0V3M7 11v10M17 3c-2 1-3 4-3 7h3v11"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 006.2 21h11.6a2 2 0 001.7-2.5L14 9V3M7 15h10"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/>',
    note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    planet: '<circle cx="12" cy="12" r="6"/><path d="M4.5 16.5C2 19 6 19.5 12 16s10-8.5 7.5-11"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    film: '<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M3 8l3-4h3l-3 4M10 8l3-4h3l-3 4"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    gamepad: '<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 10v4M5 12h4M16 11h.01M18 13h.01"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-6-1 0 1 1 1 6 1zM12 8c2-4 6-4 6-1 0 1-1 1-6 1z"/>',
    columns: '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M3 10l9-6 9 6z"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M8 7h7"/>',
    sigma: '<path d="M18 5H6l7 7-7 7h12"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>',
    scroll: '<path d="M8 3h11v13a3 3 0 01-3 3H6a3 3 0 01-3-3v-1h11v1a3 3 0 003 3M8 3a3 3 0 00-3 3v9M10 8h6M10 12h6"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
    palette: '<path d="M12 3a9 9 0 100 18c1.5 0 2-1 2-2 0-1.5-1-2-1-3s1-2 2.5-2H18a3 3 0 003-3c0-4.5-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="9.5" cy="7" r="1.2" fill="currentColor"/><circle cx="14.5" cy="7" r="1.2" fill="currentColor"/>',
    beaker: '<path d="M6 3h12M7 3v16a2 2 0 002 2h6a2 2 0 002-2V3M7 12h10"/>',
    atom: '<circle cx="12" cy="12" r="1.6" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
    leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15zM5 19l8-8"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    scales: '<path d="M12 4v16M8 20h8M5 7h14M5 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0z"/>',
    candle: '<path d="M12 3c1.5 2 1.5 3.5 0 5-1.5-1.5-1.5-3 0-5z"/><rect x="9" y="10" width="6" height="11" rx="1"/>',
    speech: '<path d="M4 5h16v11H9l-5 4z"/>',
    mountain: '<path d="M3 20l6-10 4 6 3-4 5 8z"/>',
    urn: '<path d="M8 3h8M9 3c0 3-4 4-4 9a7 7 0 0014 0c0-5-4-6-4-9M7 21h10"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-3.6-2.4-6-4.3-8.1-.5 2.4-1.7 3.6-3 4.1.3-3.3-1.2-6.4-3.7-8C8.2 6.4 5 9.4 5 15c0 4.3 3 7 7 7z"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.dice}</svg>`;
  const GENRE_ICONS = {
    mixed: 'dice', 'mixed-fun': 'popcorn', 'mixed-academic': 'cap',
    animals: 'paw', food: 'utensils', geography: 'globe', science: 'flask', sports: 'ball', music: 'note', space: 'planet', mythology: 'bolt',
    popculture: 'star', movies: 'film', gaming: 'gamepad', holidays: 'gift',
    philosophy: 'columns', literature: 'book', mathematics: 'sigma', vocabulary: 'pen', history: 'scroll', economics: 'chart',
    anatomy: 'heart', art: 'palette', chemistry: 'beaker', physics: 'atom', biology: 'leaf', psychology: 'eye', computing: 'chip',
    law: 'scales', religion: 'candle', linguistics: 'speech', earthscience: 'mountain', classics: 'urn',
    travel: 'plane', medicine: 'pulse', technology: 'phone', general: 'bulb',
  };
  // One chip colour per genre group.
  const CATEGORY_COLOURS = {
    mixed: '#2a241c', classic: '#2f5a43', fun: '#a84a35', academic: '#3e5c6b',
    tv: '#6b3a4a', movies: '#8a3b2b', anime: '#4b3f6b', gaming: '#3e5c6b', sport: '#2f5a43', music: '#6b4a2b',
  };

  // ---------- Home ----------
  function statusLine(key, playLabel) {
    const st = statusOf(key);
    const solve = store.solves[key];
    if (st === 'solved') return { label: 'View puzzle', text: `Solved in ${formatTime(solve.time)}`, cls: 'solved' };
    if (st === 'assisted') return { label: 'View puzzle', text: `Finished with help in ${formatTime(solve.time)}`, cls: '' };
    if (st === 'progress') return { label: 'Resume', text: `In progress · ${formatTime(store.saves[key].elapsed || 0)}`, cls: '' };
    return { label: playLabel, text: '', cls: '' };
  }

  function renderHome() {
    renderGiftCard();
    renderArcadeCards($('#arcade-home-cards'));
    renderDuelCards($('#duel-home-cards'));
    const today = todayKey();
    const daily = dailySpec(today);
    const mini = miniSpec(today);

    const ds = statusLine(daily.key, 'Play the Daily');
    const streaks = dailyStreaks();
    const pill = $('#streak-pill');
    pill.hidden = false;
    const doneToday = store.solves[`daily:${today}`] || store.solves[`mini:${today}`];
    pill.innerHTML = streaks.current
      ? `${icon('flame', 'flame')}<b>${plural(streaks.current, 'day')}</b> <span>${doneToday
        ? `Daily streak · best ${streaks.longest} · done for today`
        : 'Keep your streak going: finish today’s Daily or Mini'}</span>`
      : `${icon('flame', 'flame')}<span>Finish today's Daily or Mini to start a streak</span>`;
    $('#daily-feature').innerHTML = `
      <div>
        <p class="kicker">${esc(daily.kicker)}</p>
        <h2>${esc(daily.sched.day)}'s Crossword</h2>
        <p class="deck" id="daily-deck">An academic crossword drawn from ${DAILY_SUBJECTS} subjects, from chemistry and classics to law, linguistics and philosophy.</p>
        <ul class="chips">
          <li>${daily.sched.count} clues</li>
          <li>${esc(daily.sched.level)} difficulty</li>
          <li>Same puzzle for everyone</li>
        </ul>
        <div class="feature-actions">
          <button class="btn btn-primary btn-lg" data-open="${daily.url}">${ds.label}</button>
          <button class="btn btn-lg" data-nav="archive">This week</button>
        </div>
        ${ds.text ? `<p class="status ${ds.cls}">${esc(ds.text)}</p>` : ''}
      </div>
      <canvas class="thumb" aria-hidden="true"></canvas>`;
    queueThumb($('#daily-feature canvas'), () => {
      const p = puzzleFor(daily);
      const subjects = [...new Set(p.words.map((w) => w.tag).filter(Boolean))];
      const deck = $('#daily-deck');
      if (deck && subjects.length > 3) {
        deck.textContent = `Today's grid spans ${subjects.slice(0, 4).join(', ')} and ${plural(subjects.length - 4, 'more subject')}.`;
      }
      return p;
    });

    const ms = statusLine(mini.key, 'Play');
    $('#mini-feature').innerHTML = `
      <div>
        <p class="kicker">The Mini</p>
        <h2>A six-clue warm-up</h2>
        <p class="deck">Short everyday and pop-culture answers. A good start before the Daily.</p>
        <ul class="chips"><li>${MINI_CONFIG.count} clues</li><li>A few minutes</li></ul>
        <button class="btn btn-lg" data-open="${mini.url}">${ms.label}</button>
        ${ms.text ? `<p class="status ${ms.cls}">${esc(ms.text)}</p>` : ''}
      </div>
      <canvas class="thumb" aria-hidden="true"></canvas>`;
    queueThumb($('#mini-feature canvas'), () => puzzleFor(mini));

    const brutal = brutalSpec(weekOf(today));
    const bs = statusLine(brutal.key, 'Take the challenge');
    $('#brutal-feature').innerHTML = `
      <div class="brutal-copy">
        <p class="brutal-kicker">The Brutal Challenge · ${esc(brutal.title)}</p>
        <h2 id="brutal-title">The hardest crossword we make. Can you finish it?</h2>
        <p>One Brutal puzzle a week, the same for everyone: ${DIFFICULTIES.brutal.count} clues from every genre and not one easy answer. A new one every Monday.</p>
        ${bs.text ? `<p class="brutal-status">${esc(bs.text)}</p>` : ''}
      </div>
      <button class="btn btn-gold btn-lg" data-open="${brutal.url}">${bs.label}</button>`;

    // The week runs Monday to Sunday.
    const dow = parseKey(today).getDay();
    const monday = addDays(today, -((dow + 6) % 7));
    const strip = $('#week-strip');
    strip.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const k = addDays(monday, i);
      const sched = scheduleFor(k);
      const key = `daily:${k}`;
      const st = statusOf(key);
      const future = k > today || k < LAUNCH;
      const mark = future ? (k > today ? 'Coming soon' : 'Before launch')
        : st === 'solved' ? `Solved · ${formatTime(store.solves[key].time)}`
          : st === 'assisted' ? 'Finished with help'
            : st === 'progress' ? 'In progress' : 'Not started';
      const li = document.createElement('li');
      if (k === today) li.className = 'is-today';
      li.innerHTML = `<button ${future ? 'disabled' : `data-open="#/daily/${k}"`} aria-label="${esc(sched.day)}, ${esc(sched.level)}, ${esc(mark)}">
        <span class="day">${sched.day.slice(0, 3)}${k === today ? ' · Today' : ''}</span>
        <span class="level">${esc(sched.level)}</span>
        <span class="mark ${st}">${esc(mark)}</span></button>`;
      strip.appendChild(li);
    }

    renderContinue();
    renderTrending();
    renderGenreTabs();
    renderGenreGrid();
    renderHomeStats();
  }

  // Puzzles in progress, most recent first, from the saved games.
  function renderContinue() {
    const items = Object.entries(store.saves)
      .filter(([, sv]) => sv.entries && (sv.room || sv.entries.some((row) => row.some(Boolean))))
      .sort((a, b) => (b[1].updated || 0) - (a[1].updated || 0))
      .map(([key, sv]) => {
        const info = describeSave(key, sv);
        // A shared puzzle reopens its room.
        if (info && sv.room && CrosswordRooms.validRoomId(sv.room)) Object.assign(info, { url: `#/room/${sv.room}`, kicker: `${info.kicker} · Shared` });
        return { key, sv, info };
      })
      .filter((x) => x.info)
      .slice(0, 4);
    $('#continue-section').hidden = !items.length;
    $('#continue-row').innerHTML = items.map(({ sv, info }) => {
      const pct = sv.total ? Math.round((100 * (sv.filled || 0)) / sv.total) : null;
      const bits = [pct != null ? `${pct}% filled` : 'In progress', formatTime(sv.elapsed || 0)];
      bits.push(plural(hintTotal('penalties', savedHints(sv)), 'hint point'));
      return `<button class="continue-card" data-open="${esc(info.url)}">
        <span class="continue-kicker">${esc(info.kicker)}</span>
        <span class="continue-title">${esc(info.title)}</span>
        <span class="bar" aria-hidden="true"><i style="width:${pct || 4}%"></i></span>
        <span class="continue-meta">${esc(bits.join(' · '))}</span>
      </button>`;
    }).join('');
  }
  // Title and link for a saved game's key, or null if it can't be opened.
  function describeSave(key, sv) {
    const [kind, rest] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    if (kind === 'gift') return sv && sv.gift ? { kicker: 'Gift crossword', title: 'A crossword made for you', url: `#/gift/${sv.gift}` } : null;
    if ((kind === 'daily' || kind === 'mini') && validDate(rest)) {
      const day = DAILY_SCHEDULE[parseKey(rest).getDay()].day;
      return kind === 'daily'
        ? { kicker: `Daily · ${shortDate(rest)}`, title: `${day}'s Crossword`, url: `#/daily/${rest}` }
        : { kicker: `Mini · ${shortDate(rest)}`, title: 'The Mini', url: `#/mini/${rest}` };
    }
    if (kind === 'brutal' && validDate(rest)) {
      const spec = brutalSpec(rest);
      return { kicker: spec.kicker, title: spec.title, url: spec.url };
    }
    if (kind === 'play') {
      const [genreId, difficulty] = rest.split('/');
      const genre = genreById(genreId);
      if (!genre || !levelsFor(genre)[difficulty]) return null;
      const cat = categoryById(genre.category);
      return { kicker: `${cat ? cat.name : 'Genre'} · ${levelsFor(genre)[difficulty].label}`, title: genre.name, url: `#/play/${rest}` };
    }
    return null;
  }

  // Trending Now cards, from js/featured.js.
  function renderTrending() {
    const list = (typeof FEATURED !== 'undefined' ? FEATURED : []).filter((f) => (f.genre ? genreById(f.genre) : f.link));
    $('#trending-row').closest('section').hidden = !list.length;
    $('#trending-row').innerHTML = list.map((f) => `
      <button class="trend-card" style="background:${esc(f.colour || '#2a241c')}" ${f.genre ? `data-genre="${esc(f.genre)}"` : `data-open="${esc(f.link)}"`}>
        ${icon(f.icon || 'star')}
        <span><span class="trend-kicker">${esc(f.kicker || '')}</span><span class="trend-title">${esc(f.title)}</span></span>
      </button>`).join('');
  }

  function renderHomeStats() {
    const dailies = Object.entries(store.solves).filter(([k]) => k.startsWith('daily:'));
    const { current, longest } = dailyStreaks();
    $('#home-stats').innerHTML = [
      [current, 'Day streak'],
      [longest, 'Longest streak'],
      [store.solvedCount || 0, 'Puzzles solved'],
      [noHintRecord().total, 'No-Hint solves'],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
  }

  function renderGenreTabs() {
    if (!categoryById(store.category)) store.category = CATEGORIES[0].id;
    const cat = categoryById(store.category);
    // Themed collections are played at Casual, Fan or Superfan.
    const levels = cat.themed ? THEMED_LEVELS : DIFFICULTIES;
    const current = cat.themed ? store.themedLevel : store.difficulty;
    $('#difficulty').innerHTML = Object.entries(levels)
      .map(([id, l]) => `<button role="radio" data-difficulty="${id}" aria-checked="${id === current}">${esc(l.label)}</button>`).join('');
    $('#genres-deck').textContent = cat.themed
      ? `${cat.blurb} Casual is for anyone who's watched or played; Superfan is for the obsessed.`
      : 'A fresh grid every time. You won\'t meet the same clue twice in a genre until you\'ve worked through its whole word bank.';
    const tabs = $('#category-tabs');
    tabs.innerHTML = '';
    for (const cat of CATEGORIES) {
      const n = GENRES.filter((g) => g.category === cat.id).length;
      const b = document.createElement('button');
      b.setAttribute('role', 'tab');
      b.dataset.category = cat.id;
      b.setAttribute('aria-selected', String(store.category === cat.id));
      b.innerHTML = `${esc(cat.name)}<span class="count">${n}</span>`;
      tabs.appendChild(b);
    }
  }

  function renderGenreGrid() {
    const grid = $('#genre-grid');
    grid.innerHTML = '';
    // Laid out like a card catalogue: each card has a filing tab and a
    // rubber-stamped level.
    GENRES.filter((x) => x.category === store.category).forEach((g, i) => {
      const level = levelFor(g);
      const cfg = levelsFor(g)[level];
      const best = store.best[`${g.id}:${level}`];
      const card = document.createElement('button');
      card.className = 'genre-card';
      card.dataset.genre = g.id;
      card.innerHTML = `
        <span class="card-tab" aria-hidden="true">No. ${i + 1}</span>
        <span class="card-stamp stamp-${level}" aria-hidden="true">${esc(cfg.label)}</span>
        <span class="genre-icon" style="background:${CATEGORY_COLOURS[g.category] || '#2a241c'}">${icon(GENRE_ICONS[g.id] || g.icon)}</span>
        <span>
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.blurb)}</p>
          <span class="meta"><span>${g.words.length} ${g.themed ? 'clues' : 'words'}</span>${best ? `<span class="best">Best ${formatTime(best)}</span>` : ''}</span>
        </span>`;
      card.setAttribute('aria-label', `${g.name}. ${g.blurb} ${cfg.label}, ${cfg.count} clues.`);
      grid.appendChild(card);
    });
  }

  // ---------- Archive ----------
  const archive = { kind: 'daily', month: todayKey().slice(0, 7) };
  function renderArchive() {
    $$('#archive-kind button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.kind === archive.kind)));
    const [y, m] = archive.month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    $('#archive-month').textContent = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    $('[data-action="month-prev"]').disabled = archive.month <= LAUNCH.slice(0, 7);
    $('[data-action="month-next"]').disabled = archive.month >= todayKey().slice(0, 7);

    const cal = $('#calendar');
    cal.innerHTML = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < first.getDay(); i++) cal.appendChild(document.createElement('span'));
    const days = new Date(y, m, 0).getDate();
    const today = todayKey();
    for (let d = 1; d <= days; d++) {
      const k = `${archive.month}-${pad(d)}`;
      const key = `${archive.kind}:${k}`;
      const st = statusOf(key);
      const available = k >= LAUNCH && k <= today;
      const b = document.createElement('button');
      if (k === today) b.className = 'today';
      b.disabled = !available;
      if (available) b.dataset.open = `#/${archive.kind}/${k}`;
      const label = { solved: 'solved', assisted: 'finished with help', progress: 'in progress', none: 'not started' }[st];
      b.setAttribute('aria-label', `${longDate(k)}${available ? ', ' + label : ', unavailable'}`);
      b.innerHTML = `<span class="num">${d}</span>${available ? `<span class="dot ${st === 'none' ? '' : st}"></span>` : ''}`;
      cal.appendChild(b);
    }
  }

  // "5 letters and 1 word", "3 letters"
  function revealSummary(letters, words) {
    return words ? `${plural(letters, 'letter')} and ${plural(words, 'word')}` : plural(letters, 'letter');
  }

  // ---------- Hint points and the No-Hint Club ----------
  // Each hint (Reveal Letter, Reveal Word) adds competitive hint points
  // (fewer is better) and records hint credits; both scales are set in
  // js/hints.js. Hints are free: credits are counted, never charged. Checking and auto-check are
  // free but mark the puzzle assisted, which keeps it out of the No-Hint
  // Club. Solves from before hint points existed don't count towards the Club.
  // Saves from before hint points counted every revealed letter together.
  const savedCells = (sv) => (sv.revealCells != null ? sv.revealCells : sv.revealWords ? 0 : sv.reveals || 0);
  const savedHints = (sv) => ({ letter: savedCells(sv), word: sv.revealWords || 0 });
  // In a shared puzzle, everyone's hints count together.
  function gameHints() {
    if (game.room) {
      const t = CrosswordRooms.sumHints(game.room.hints);
      return { letter: t.letter, word: t.word };
    }
    return { letter: game.revealCells, word: game.revealWords };
  }
  const gamePoints = () => hintTotal('penalties', gameHints());
  // "2 letters and 1 word"
  function hintSummary(used) {
    const parts = [[used.letter, 'letter'], [used.word, 'word']].filter(([n]) => n).map(([n, w]) => plural(n, w));
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0] || 'no hints';
  }

  function noHintRecord() {
    const solves = Object.entries(store.solves);
    const { current, longest } = CrosswordStats.noHintStreak(store.solves, todayKey(), LAUNCH);
    const scored = solves.filter(([, x]) => x.points != null);
    return {
      total: solves.filter(([, x]) => x.noHint).length,
      current,
      longest,
      brutal: solves.filter(([k, x]) => k.startsWith('brutal:') && x.noHint).length,
      avgPoints: scored.length ? scored.reduce((t, [, x]) => t + x.points, 0) / scored.length : null,
      credits: solves.reduce((t, [, x]) => t + (x.credits || 0), 0),
    };
  }
  const BADGES = [
    { name: 'First No-Hint solve', need: 'a puzzle with no hints or checks', value: (r) => r.total, goal: 1 },
    { name: 'Three Days', need: 'Dailies in a row with no hints or checks', value: (r) => r.longest, goal: 3 },
    { name: 'Seven Days', need: 'Dailies in a row with no hints or checks', value: (r) => r.longest, goal: 7 },
    { name: 'Ten No-Hint solves', need: 'puzzles with no hints or checks', value: (r) => r.total, goal: 10 },
    { name: 'Thirty Days', need: 'Dailies in a row with no hints or checks', value: (r) => r.longest, goal: 30 },
    { name: 'Brutal Finisher', need: 'a Brutal Challenge with no hints or checks', value: (r) => r.brutal, goal: 1 },
    { name: 'Fifty No-Hint solves', need: 'puzzles with no hints or checks', value: (r) => r.total, goal: 50 },
  ];
  const earnedBadges = (r) => BADGES.filter((b) => b.value(r) >= b.goal).map((b) => b.name);

  // ---------- Hint credits ----------
  // Live once the trusted server is deployed (js/online.js; rules in
  // js/economy.js). Signed-in players get 5 daily credits and earn more;
  // Reveal Letter costs 1 and Reveal Word 3, charged by the server before
  // anything is revealed. Until then, and for duels, hints work as before.
  const Econ = window.CrosswordEconomy;
  const DUEL_FREEZE = Econ.DUELS.hintFreezeMs; // a duel hint freezes your board this long
  let online = window.CrosswordOnline || null;
  let me = { uid: null, account: false };
  let wallet = null; // the server's view: { daily, earned, total, totals, resetIn, at, recent }
  let walletLoading = null;
  const creditsOn = () => !!online;
  document.addEventListener('online:ready', () => {
    online = window.CrosswordOnline;
    renderWallet();
    renderDuelCards($('#duel-hub-cards'));
    renderDuelCards($('#duel-home-cards'));
    // An invitation opened before the connection was ready.
    if (/^#\/duel\//.test(currentRoute)) route();
  });
  document.addEventListener('online:user', (e) => {
    const was = me.uid;
    me = e.detail;
    if (was !== me.uid) wallet = null;
    if (me.account) syncWallet().then(sendPendingClaims);
    renderWallet();
    if (!$('#stats-view').hidden) renderStats();
  });
  async function syncWallet() {
    if (!creditsOn() || !me.account) return null;
    if (!walletLoading) {
      walletLoading = online.call('walletSync').then((res) => {
        setWallet(res.wallet, res.recent);
        if (res.granted) toast(`Your ${res.granted} Daily Credits are ready!`);
        return wallet;
      }).catch(() => wallet).finally(() => { walletLoading = null; });
    }
    return walletLoading;
  }
  function setWallet(view, recent) {
    wallet = { ...view, at: Date.now(), recent: recent || (wallet && wallet.recent) || [] };
    renderWallet();
  }
  // A fresh day while the page was open: sync again for the new allowance.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !wallet) return;
    if (Date.now() - wallet.at > wallet.resetIn || Date.now() - wallet.at > 15 * 60000) syncWallet();
  });
  const walletLeft = () => (wallet ? Math.max(0, wallet.resetIn - (Date.now() - wallet.at)) : Econ.msUntilReset(now()));
  const hoursMins = (ms) => {
    const mins = Math.max(1, Math.ceil(ms / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };
  function renderWallet() {
    const btn = $('#wallet-btn');
    btn.hidden = !creditsOn();
    if (!creditsOn()) return;
    const total = wallet ? wallet.total : null;
    $('#wallet-total').textContent = me.account ? (total == null ? '…' : total) : '';
    btn.setAttribute('aria-label', me.account && total != null ? `Hint credits: ${total}` : 'Hint credits');
    $('#wallet-account').hidden = !me.account;
    $('#wallet-guest').hidden = me.account;
    $('#wallet-big').textContent = me.account && wallet ? wallet.total : me.account ? '…' : '5 a day';
    $('#wallet-title small').textContent = me.account ? 'to spend' : 'free';
    if (wallet) {
      $('#wallet-daily').textContent = wallet.daily;
      $('#wallet-earned').textContent = wallet.earned;
      $('#wallet-reset').textContent = `New 5 in ${hoursMins(walletLeft())}`;
    }
    const recent = (wallet && wallet.recent) || [];
    $('#wallet-history-wrap').hidden = !me.account || !recent.length;
    $('#wallet-history').innerHTML = recent.slice(0, 12).map((x) => `<li><span>${esc(x.note)}<small>${esc(new Date(x.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</small></span><b class="${x.amount < 0 ? 'minus' : 'plus'}">${x.amount > 0 ? '+' : '−'}${Math.abs(x.amount)}</b></li>`).join('');
    renderRevealMenu();
  }
  function openWallet() {
    renderWallet();
    $('#wallet-dialog').showModal();
    if (me.account) syncWallet();
  }
  // The Reveal menu shows what each hint costs.
  function renderRevealMenu() {
    const on = creditsOn();
    const duel = !!(game && game.duel);
    const freeze = (kind) => (duel ? ` · ${DUEL_FREEZE[kind] / 1000} s freeze` : '');
    $('#reveal-cell-btn').textContent = on ? `Letter · 1 credit${freeze('letter')}` : 'Square';
    $('#reveal-word-btn').textContent = on ? `Word · 3 credits${freeze('word')}` : 'Word';
    $('#reveal-all-btn').hidden = on || duel;
    $('#reveal-note').hidden = !on;
    $('#reveal-note').textContent = !on ? '' : me.account
      ? (wallet ? `You have ${plural(wallet.total, 'credit')}` : 'Checking your credits…')
      : 'Sign in for 5 free credits a day';
  }
  function noCredits() {
    toast(`Not enough hint credits. Solve without hints or win a duel to earn more${wallet && wallet.daily === 0 ? `; 5 more arrive in ${hoursMins(walletLeft())}` : ''}.`);
    openWallet();
  }
  // What a hint would reveal: the square, or the current word.
  function hintTarget(scope) {
    if (scope === 'cell') {
      const { r, c } = game.sel;
      return { kind: 'letter', target: `${r}_${c}`, cells: [[r, c]] };
    }
    const w = game.puzzle.words[currentWordIndex()];
    return { kind: 'word', target: `${w.dir[0]}${w.row}_${w.col}`, cells: w.cells };
  }
  let spending = false;
  // A hint in a normal puzzle shows at once and is charged in the
  // background: the page already has the answers, and the server
  // (spendHint) still keeps the balance. A charge held up by the connection
  // is tried again. Only before the balance has loaded does the reveal wait
  // for the server.
  let charging = 0; // charges on their way to the server
  async function creditReveal(scope) {
    if (scope === 'all') return;
    if (!me.account) {
      openWallet();
      return;
    }
    const t = hintTarget(scope);
    if (t.cells.every(([r, c]) => game.revealed[r][c])) {
      toast(scope === 'cell' ? 'That letter is already revealed' : 'That word is already revealed');
      return;
    }
    const cost = Econ.ECONOMY.cost[t.kind];
    if (wallet && wallet.total < cost) return noCredits();
    const request = { puzzle: game.spec.key, kind: t.kind, target: t.target };
    if (wallet) {
      const fromDaily = Math.min(wallet.daily, cost);
      setWallet({ ...wallet, daily: wallet.daily - fromDaily, earned: wallet.earned - (cost - fromDaily), total: wallet.total - cost });
      applyReveal(scope);
      toast(`${plural(cost, 'credit')} used · ${wallet.total} left`);
      charge(request, 0);
      return;
    }
    if (spending) return;
    spending = true;
    const g = game;
    try {
      const res = await online.call('spendHint', request);
      setWallet(res.wallet);
      if (!res.ok) return noCredits();
      if (game !== g || game.solved) return;
      applyReveal(scope);
      if (res.charged) toast(`${plural(res.charged, 'credit')} used · ${res.wallet.total} left`);
    } catch (e) {
      toast(`${e.message} No credits were used.`);
    } finally {
      spending = false;
    }
  }
  async function charge(request, tries) {
    charging++;
    try {
      const res = await online.call('spendHint', request);
      charging--;
      if (!charging) setWallet(res.wallet); // the server's balance, once every charge is in
      if (!res.ok) noCredits(); // spent elsewhere meanwhile
    } catch (e) {
      charging--;
      if (tries < 3) setTimeout(() => charge(request, tries + 1), 4000 * (tries + 1));
      else syncWallet();
    }
  }
  // A hint in a duel: costs credits as usual and freezes your board for a
  // while (the server sets the freeze and sends the letters, which the page
  // doesn't have).
  async function duelReveal(scope) {
    const dd = duel;
    if (scope === 'all' || !dd || !game || !game.duel) return;
    if (!me.account) {
      openWallet();
      return;
    }
    if (duelFrozen()) return frozenNudge();
    const t = hintTarget(scope);
    if (t.cells.every(([r, c]) => game.revealed[r][c])) {
      toast(scope === 'cell' ? 'That letter is already revealed' : 'That word is already revealed');
      return;
    }
    if (wallet && wallet.total < Econ.ECONOMY.cost[t.kind]) return noCredits();
    if (spending) return;
    spending = true;
    const g = game;
    const w = scope === 'cell' ? null : game.puzzle.words[currentWordIndex()];
    $('#duel-note').textContent = scope === 'cell' ? 'Revealing the letter…' : 'Revealing the word…';
    try {
      const res = await online.call('duelHint', {
        id: dd.id, kind: t.kind, r: w ? w.row : game.sel.r, c: w ? w.col : game.sel.c, dir: w ? w.dir : undefined,
      });
      setWallet(res.wallet);
      if (!res.ok) {
        $('#duel-note').textContent = '';
        return noCredits();
      }
      if (game !== g || game.solved || duel !== dd) return;
      for (const [r, c, ch] of res.cells) {
        game.entries[r][c] = ch;
        game.revealed[r][c] = true;
        game.pencil[r][c] = false;
      }
      game.reveals++;
      analytics.track('hint_used', { hint: t.kind, puzzle_kind: 'duel' });
      if (res.frozenUntil) dd.frozenUntil = res.frozenUntil;
      animateCells(res.cells.map(([r, c]) => [r, c]), 'pop');
      afterChange();
      showFreeze();
      if (res.charged) toast(`${plural(res.charged, 'credit')} used · board frozen for ${Math.round((res.frozenUntil - duelNow()) / 1000)} seconds`);
    } catch (e) {
      toast(`${e.message} No credits were used.`);
      if (duel === dd && !duelFrozen()) $('#duel-note').textContent = '';
    } finally {
      spending = false;
    }
  }
  // Frozen after a duel hint (until the server's time in frozenUntil).
  function frozenUntil() {
    const d = duel && duel.data;
    if (!game || !game.duel || !d) return 0;
    return Math.max(duel.frozenUntil || 0, (d.players[duelMe()] && d.players[duelMe()].frozenUntil) || 0);
  }
  const duelFrozen = () => frozenUntil() > duelNow();
  let nudgedAt = 0;
  function frozenNudge() {
    if (Date.now() - nudgedAt < 1500) return;
    nudgedAt = Date.now();
    shake($('#duel-note'));
    buzz(20);
  }
  // The freeze on screen: a dimmed grid and the seconds left. When it ends,
  // the grid goes to the server again.
  function showFreeze() {
    const until = frozenUntil();
    const left = Math.ceil((until - duelNow()) / 1000);
    const on = left > 0;
    $('#game-view').classList.toggle('duel-frozen', on);
    if (on) $('#duel-note').textContent = `Hint used: your board is frozen for ${plural(left, 'second')}.`;
    else if (duel && duel.wasFrozen) $('#duel-note').textContent = '';
    if (duel && duel.wasFrozen && !on) {
      duel.wasFrozen = false;
      sendDuelGrid();
    }
    if (duel && on) duel.wasFrozen = true;
  }

  // A first No-Hint solve of a published puzzle: the server checks the grid
  // and pays 1 (Mini) or 3 (Daily, Brutal) credits, once. The solve waits in
  // store.pendingClaims (on this device) until the server has answered, so
  // a solve while signed out is paid after signing in, and one cut off by the
  // connection (or a server waking up) is tried again later. The win screen
  // says what happened either way.
  const CLAIM_DAYS = 7; // solves older than this aren't claimed later
  const REWARD_WHY = {
    already: 'Credits for this puzzle were already paid to your account.',
    assisted: 'No credits this time: a hint was bought on this puzzle.',
    'not-eligible': 'Only today’s or an earlier Daily, the Mini and the Brutal Challenge earn credits.',
    incorrect: '',
  };
  function rewardNote(text) {
    const el = $('#win-reward');
    el.textContent = text;
    el.hidden = !text;
  }
  function queueClaim(spec, entries) {
    store.pendingClaims = Object.assign({}, store.pendingClaims, { [spec.key]: { grid: entries.map((row) => row.slice()), at: Date.now() } });
    saveStore();
  }
  async function claimReward(spec, entries) {
    queueClaim(spec, entries);
    const amount = spec.kind === 'mini' ? Econ.ECONOMY.reward.mini : Econ.ECONOMY.reward.full;
    if (!me.account) {
      rewardNote(`Sign in to collect ${plural(amount, 'Hint Credit')} for this No-Hint solve: it’s kept for you for a week.`);
      return;
    }
    rewardNote('Checking your No-Hint reward…');
    const res = await sendClaim(spec.key);
    if (!res) rewardNote(`Your ${plural(amount, 'Hint Credit')} will be added when the connection’s back.`);
    else if (res.ok) rewardNote(res.kind === 'mini' ? `Brilliant! Mini solved without hints. +${plural(res.amount, 'credit')}.` : `Perfect solve! +${res.amount} Hint Credits.`);
    else rewardNote(REWARD_WHY[res.reason] || '');
  }
  // Sends one waiting claim. Returns the server's answer, or null if it
  // couldn't be reached (the claim then stays for next time).
  async function sendClaim(key) {
    const claim = (store.pendingClaims || {})[key];
    if (!claim || !me.account || !creditsOn()) return null;
    try {
      const res = await online.call('claimSolve', { puzzle: key, grid: claim.grid });
      delete store.pendingClaims[key];
      saveStore();
      if (res.wallet) setWallet(res.wallet);
      return res;
    } catch (e) {
      return null;
    }
  }
  // Claims kept from earlier (signed out, or offline), once signed in.
  let claiming = false;
  async function sendPendingClaims() {
    if (claiming || !me.account || !creditsOn()) return;
    claiming = true;
    let paid = 0;
    try {
      for (const [key, claim] of Object.entries(store.pendingClaims || {})) {
        if (Date.now() - claim.at > CLAIM_DAYS * 86400000) {
          delete store.pendingClaims[key];
          saveStore();
          continue;
        }
        const res = await sendClaim(key);
        if (res && res.ok) paid += res.amount;
        if (!res) break; // offline: try again later
      }
    } finally {
      claiming = false;
    }
    if (paid) toast(`+${plural(paid, 'Hint Credit')} for your No-Hint solves`);
  }
  window.addEventListener('online', sendPendingClaims);

  // ---------- Statistics page (#/stats) ----------
  const tile = ([v, l]) => `<div><b>${v}</b><span>${esc(l)}</span></div>`;
  function renderStats() {
    const today = todayKey();
    const dailies = Object.entries(store.solves).filter(([k]) => k.startsWith('daily:'));
    const clean = dailies.filter(([, s]) => s.clean);
    const { current, longest } = dailyStreaks();
    const avg = clean.length ? clean.reduce((t, [, s]) => t + s.time, 0) / clean.length : 0;
    const all = CrosswordStats.totals(store.solves);
    const solved = store.solvedCount || 0;

    // At a glance: the three that matter most.
    $('#stats-primary').innerHTML = [
      [solved.toLocaleString(), 'Puzzles solved', ''],
      [current, 'Day streak', current ? `Longest: ${longest}` : 'Finish today’s Daily or Mini'],
      [all.averageTime == null ? '—' : formatTime(all.averageTime), 'Average time', all.averageTime == null ? 'No timed solves yet' : 'All puzzles'],
    ].map(([v, l, note]) => `<div class="stat-card"><b>${v}</b><span>${esc(l)}</span>${note ? `<small>${esc(note)}</small>` : ''}</div>`).join('');

    // The last seven days of Dailies and Minis, from saved solves only.
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const anySolve = Object.keys(store.solves).some((k) => k.startsWith('daily:') || k.startsWith('mini:'));
    $('#week-days').innerHTML = days.map((d) => {
      const daily = !!store.solves[`daily:${d}`];
      const mini = !!store.solves[`mini:${d}`];
      const date = parseKey(d);
      const label = `${longDate(d)}: ${daily && mini ? 'Daily and Mini finished' : daily ? 'Daily finished' : mini ? 'Mini finished' : d < LAUNCH ? 'before launch' : 'not finished'}`;
      return `<li class="week-day${daily || mini ? ' done' : ''}${d === today ? ' today' : ''}" aria-label="${esc(label)}">
        <span class="wd" aria-hidden="true">${date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
        <span class="dd" aria-hidden="true">${date.getDate()}</span>
        <span class="marks" aria-hidden="true"><i class="m-daily${daily ? ' on' : ''}" title="Daily"></i><i class="m-mini${mini ? ' on' : ''}" title="Mini"></i></span>
      </li>`;
    }).join('');
    $('#week-note').textContent = anySolve
      ? 'Large square: the Daily. Small square: the Mini. Days end at midnight South African time.'
      : 'Nothing here yet: finish a Daily or Mini and it will show up.';

    $('#stat-tiles').innerHTML = [
      [solved, 'Puzzles solved'],
      [dailies.length, 'Dailies finished'],
      [current, 'Current streak'],
      [longest, 'Longest streak'],
      [all.averageTime == null ? '—' : formatTime(all.averageTime), 'Average time, all puzzles'],
      [clean.length ? formatTime(avg) : '—', 'Average Daily'],
      [all.hints, 'Hints used'],
      [clean.length, 'Dailies with no help'],
      [dailies.reduce((t, [, s]) => t + (s.letters || 0), 0), 'Letters revealed in Dailies'],
      [dailies.reduce((t, [, s]) => t + (s.words || 0), 0), 'Words revealed in Dailies'],
    ].map(tile).join('');
    $('#records-sum').textContent = `${dailies.length} ${dailies.length === 1 ? 'Daily' : 'Dailies'} · best streak ${longest}`;

    const order = [1, 2, 3, 4, 5, 6, 0];
    const byDay = order.map((d) => {
      const times = clean.filter(([k]) => parseKey(k.slice(6)).getDay() === d).map(([, s]) => s.time);
      return { d, n: times.length, avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0 };
    });
    const max = Math.max(1, ...byDay.map((x) => x.avg));
    $('#weekday-table').innerHTML = byDay.map((x) => `
      <div class="weekday-row">
        <span>${DAILY_SCHEDULE[x.d].day}</span>
        <span class="bar"><i style="width:${(x.avg / max) * 100}%"></i></span>
        <span class="t">${x.n ? formatTime(x.avg) : '—'}</span>
      </div>`).join('');
    const favs = CrosswordStats.favourites(store.solves).filter((f) => genreById(f.id));
    $('#fav-list').innerHTML = favs.length
      ? favs.map((f) => `<li><button class="link-btn" data-genre="${esc(f.id)}">${esc(genreById(f.id).name)}</button><span>${plural(f.count, 'puzzle')}</span></li>`).join('')
      : '<li class="empty">Finish a few genre or collection puzzles to see your favourites here.</li>';

    const club = noHintRecord();
    $('#club-tiles').innerHTML = [
      [club.total, 'No-Hint solves'],
      [club.current, 'No-Hint Daily streak'],
      [club.longest, 'Longest No-Hint streak'],
      [club.avgPoints == null ? '—' : club.avgPoints.toFixed(1), 'Average hint points'],
      [club.credits, 'Hint credits used'],
    ].map(tile).join('');
    $('#club-sum').textContent = plural(club.total, 'No-Hint solve');

    renderArcadeRecords();
    renderOnlineRecords();

    const earned = BADGES.filter((b) => b.value(club) >= b.goal).length;
    $('#badges-sum').textContent = `${earned} of ${BADGES.length} earned`;
    $('#club-badges').innerHTML = BADGES.map((b) => {
      const got = b.value(club) >= b.goal;
      const have = Math.min(b.value(club), b.goal);
      return `<li class="badge${got ? ' earned' : ''}">${icon(got ? 'star' : 'lock')}<span><b>${esc(b.name)}</b>
        <small>${got ? `Earned · ${esc(b.need)}` : `${have} of ${b.goal} · ${esc(b.need)}`}</small>
        ${got ? '' : `<span class="badge-bar" aria-hidden="true"><i style="width:${(100 * have) / b.goal}%"></i></span>`}</span></li>`;
    }).join('');
  }

  // Arcade records: only what each game keeps.
  function renderArcadeRecords() {
    const best = arcadeData().best;
    const lad = CrosswordLadder.summary(ladderData(), todayKey());
    const ms = (t) => (t == null ? '—' : formatTime(t / 1000));
    const group = (name, cls, tiles) => `<div class="arcade-record ${cls}"><h3>${esc(name)}</h3><div class="stat-tiles">${tiles.map(tile).join('')}</div></div>`;
    $('#arcade-records').innerHTML = [
      group('Clue Blitz', 'rec-blitz', [
        [best.blitz ? best.blitz.score.toLocaleString() : '—', 'Best score'],
        [best.blitz ? best.blitz.correct : '—', 'Most correct'],
        [best.blitz && best.blitz.bestCombo != null ? `×${best.blitz.bestCombo}` : '—', 'Best combo'],
      ]),
      group('Survival', 'rec-survival', [
        [best.survival ? best.survival.round : '—', 'Highest round'],
        [best.survival ? best.survival.score.toLocaleString() : '—', 'Best score'],
      ]),
      group('Word Ladder', 'rec-ladder', [
        [lad.completed, 'Ladders completed'],
        [lad.dailyDone, 'Daily Ladders'],
        [lad.streak, 'Daily Ladder streak'],
        [lad.longest, 'Longest Daily streak'],
        [ms(lad.dailyBestTime), 'Best Daily time'],
        [lad.dailyFewest == null ? '—' : lad.dailyFewest, 'Fewest moves, Daily'],
        [lad.practiceDone, 'Practice ladders'],
        [ms(lad.practiceBestTime), 'Best practice time'],
        [lad.practiceFewest == null ? '—' : lad.practiceFewest, 'Fewest moves, practice'],
        [lad.dailyPar + lad.practicePerfect, 'Solved in par, no hints'],
      ]),
    ].join('');
    const parts = [best.blitz && `Blitz ${best.blitz.score.toLocaleString()}`, best.survival && `Survival round ${best.survival.round}`, lad.completed && plural(lad.completed, 'ladder')].filter(Boolean);
    $('#arcade-sum').textContent = parts.join(' · ') || 'No games yet';
  }

  // Hint credits and duel records (once the server is live). Read from the
  // server; this page never keeps its own copy of a balance.
  function renderOnlineRecords() {
    const on = creditsOn();
    $('#panel-credits').hidden = !on;
    $('#panel-duels').hidden = !on;
    if (!on) return;
    if (!me.account) {
      const invite = '<p class="panel-note">Sign in to collect 5 free hint credits a day, earn more, and keep your duel record on every device.</p><button class="btn btn-primary" data-action="wallet-signin">Sign in or create an account</button>';
      $('#credits-body').innerHTML = invite;
      $('#duels-body').innerHTML = '<p class="panel-note">Guests can duel too; sign in to keep a record of your results and earn credits for wins.</p>';
      $('#credits-sum').textContent = 'Sign in to collect';
      $('#duels-sum').textContent = '';
      return;
    }
    if (!wallet) syncWallet().then(() => { if (!$('#stats-view').hidden) renderOnlineRecords(); });
    if (!duelRecord) loadDuelRecord().then(() => { if (!$('#stats-view').hidden && duelRecord) renderOnlineRecords(); });
    const w = wallet;
    const t = (w && w.totals) || {};
    const v = (n) => (w ? n || 0 : '…');
    $('#credits-sum').textContent = w ? `${plural(w.total, 'credit')} to spend` : '';
    $('#credits-body').innerHTML = `<div class="stat-tiles">${[
      [v(w && w.total), 'Available now'],
      [v(w && w.daily), 'Daily credits'],
      [v(w && w.earned), 'Earned credits'],
      [v(t.earned), 'Earned in all'],
      [v(t.spent), 'Spent in all'],
      [v(t.solves), 'From No-Hint solves'],
      [v(t.wins), 'From duel wins'],
    ].map(tile).join('')}</div>
      <button class="link-btn" data-action="wallet">Open your wallet →</button>`;
    const d = duelRecord || Econ.blankDuelStats();
    $('#duels-sum').textContent = d.played ? `${plural(d.won, 'win')} in ${plural(d.played, 'duel')}` : 'No duels yet';
    $('#duels-body').innerHTML = `<div class="stat-tiles">${[
      [d.played, 'Duels played'],
      [d.won, 'Won'],
      [d.lost, 'Lost'],
      [d.draws, 'Drawn'],
      [`${Econ.winRate(d)}%`, 'Win rate'],
      [d.streak, 'Winning streak'],
      [d.longest, 'Longest streak'],
      [d.miniWins, 'Mini Duel wins'],
      [d.classicWins, 'Classic Duel wins'],
      [d.best.mini ? formatTime(d.best.mini) : '—', 'Best Mini Duel'],
      [d.best.classic ? formatTime(d.best.classic) : '—', 'Best Classic Duel'],
      [d.credits, 'Credits from wins'],
    ].map(tile).join('')}</div>
      <button class="link-btn" data-nav="arcade">Start a duel →</button>`;
  }

  function openStatsPage() {
    showView('stats');
    renderStats();
    window.scrollTo(0, 0);
  }

  // ---------- Game state ----------
  let game = null;
  let cellEls = [];
  const grid2 = (rows, cols, v) => Array.from({ length: rows }, () => Array(cols).fill(v));

  function startGame(spec) {
    $('#game-view').classList.remove('joining');
    // Everything is free for now, so this always allows (see js/access.js).
    if (!canAccess(spec).allowed) {
      toast('This puzzle isn’t available');
      navigate('#/');
      return;
    }
    leaveGame();
    const puzzle = puzzleFor(spec);
    const { rows, cols } = puzzle;
    const wordAt = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({})));
    puzzle.words.forEach((w, i) => w.cells.forEach(([r, c]) => (wordAt[r][c][w.dir] = i)));

    game = {
      spec, puzzle, wordAt,
      entries: grid2(rows, cols, ''),
      revealed: grid2(rows, cols, false),
      pencil: grid2(rows, cols, false),
      wrong: grid2(rows, cols, false),
      sel: { r: puzzle.words[0].row, c: puzzle.words[0].col, dir: puzzle.words[0].dir },
      elapsed: 0,
      startedAt: null,
      paused: false,
      pencilMode: false,
      solved: false,
      reveals: 0,
      revealCells: 0,
      revealWords: 0,
      checks: 0,
      autochecked: false,
      room: null, // a shared puzzle's room (see Multiplayer rooms)
      zoom: 1, // phones: grid zoom (1 = fit the screen)
    };

    game.challenge = routeChallenge;
    showChallenge();
    $('#room-start').hidden = !multiplayer || !!store.solves[spec.key] || spec.kind === 'gift' || spec.kind === 'duel'; // gifts stay off our servers
    if (!store.solves[spec.key] && spec.kind !== 'duel') analytics.track('puzzle_start', { ...puzzleParams(spec), resumed: !!store.saves[spec.key] });
    const save = store.saves[spec.key];
    const solve = store.solves[spec.key];
    if (save && fitsPuzzle(save, puzzle)) {
      game.entries = save.entries;
      game.revealed = save.revealed || game.revealed;
      game.pencil = save.pencil || game.pencil;
      game.elapsed = save.elapsed || 0;
      game.reveals = save.reveals || 0;
      game.revealCells = savedCells(save);
      game.revealWords = save.revealWords || 0;
      game.checks = save.checks || 0;
      game.autochecked = !!save.autochecked;
    } else if (solve) {
      // Already solved and no work in progress: show the finished grid.
      game.entries = puzzle.solution.map((row) => row.map((ch) => ch || ''));
      game.elapsed = solve.time;
      game.reveals = solve.clean ? 0 : 1;
    }
    if (store.settings.autocheck && spec.kind !== 'duel') {
      if (!solve) game.autochecked = true;
      puzzle.solution.forEach((row, r) => row.forEach((ch, c) => {
        game.wrong[r][c] = !!ch && !!game.entries[r][c] && !game.pencil[r][c] && game.entries[r][c] !== ch;
      }));
    }
    if (spec.kind === 'genre') rememberWords(spec.genre, puzzle);
    saveStore();

    renderGame();
    if (isSolved()) {
      game.solved = true;
      $('#board').classList.remove('solved');
    } else {
      startTimer();
    }
    refresh();
  }

  function leaveGame() {
    if (!game) return;
    if (game.room) game.room.service.away();
    $('#room-bar').hidden = true;
    stopTimer();
    persist();
    $('#win-dialog').open && $('#win-dialog').close();
  }

  // A grid's shape as a string, so saved progress is only restored onto the
  // same layout (layouts change when the word lists or puzzle sizes do).
  const layoutSig = (puzzle) => puzzle.solution.map((row) => row.map((ch) => (ch ? '#' : '.')).join('')).join('/');
  function fitsPuzzle(save, puzzle) {
    if (!save.entries || save.entries.length !== puzzle.rows) return false;
    if (save.sig) return save.sig === layoutSig(puzzle);
    return save.entries.every((row, r) => row.length === puzzle.cols && row.every((ch, c) => !ch || puzzle.solution[r][c]));
  }

  function persist() {
    if (!game || game.duel) return; // duels keep their letters in the tab (sessionStorage)
    if (game.solved) {
      delete store.saves[game.spec.key];
    } else if (game.entries.some((row) => row.some(Boolean)) || store.saves[game.spec.key]
      || game.checks || game.autochecked || game.room) { // keep help used before any typing, and shared puzzles
      store.saves[game.spec.key] = {
        sig: layoutSig(game.puzzle),
        filled: game.entries.reduce((n, row) => n + row.filter(Boolean).length, 0),
        total: game.puzzle.solution.reduce((n, row) => n + row.filter(Boolean).length, 0),
        entries: game.entries,
        revealed: game.revealed,
        pencil: game.pencil,
        elapsed: currentElapsed(),
        reveals: game.reveals,
        revealCells: game.revealCells,
        revealWords: game.revealWords,
        checks: game.checks,
        autochecked: game.autochecked,
        room: game.room ? game.room.id : undefined,
        gift: game.spec.kind === 'gift' ? game.spec.code : undefined,
        updated: Date.now(),
      };
      // Keep storage small: hold on to the 40 most recent unfinished puzzles.
      const keys = Object.keys(store.saves);
      if (keys.length > 40) {
        keys.sort((a, b) => (store.saves[a].updated || 0) - (store.saves[b].updated || 0));
        keys.slice(0, keys.length - 40).forEach((k) => delete store.saves[k]);
      }
    }
    saveStore();
  }

  // ---------- Timer & pause ----------
  let tick = null;
  function currentElapsed() {
    if (!game) return 0;
    // A shared puzzle runs on the room's clock, the same for everyone.
    if (game.duel && duel && duel.data && duel.data.startAt) return Math.max(0, Math.floor((duelNow() - duel.data.startAt) / 1000));
    const room = game.room;
    if (room && room.meta && typeof room.meta.createdAt === 'number' && !game.solved) {
      return CrosswordRooms.roomElapsed(room.meta.base, room.meta.createdAt, Date.now() + room.offset);
    }
    return game.elapsed + (game.startedAt ? Math.floor((Date.now() - game.startedAt) / 1000) : 0);
  }
  function showTime() {
    $('#timer-text').textContent = formatTime(currentElapsed());
  }
  function startTimer() {
    if (!game || game.solved || game.paused) return;
    clearInterval(tick);
    game.startedAt = Date.now();
    tick = setInterval(showTime, 500);
    showTime();
  }
  function stopTimer() {
    if (game && game.startedAt) {
      game.elapsed = currentElapsed();
      game.startedAt = null;
    }
    clearInterval(tick);
    tick = null;
  }
  function setPaused(paused) {
    if (!game || game.solved) return;
    if (game.room) return toast('The clock keeps running in a shared puzzle');
    if (game.duel) return toast('The clock keeps running in a duel');
    game.paused = paused;
    updateKeys();
    if (paused) {
      typeInput.blur();
      stopTimer();
      persist();
    } else {
      startTimer();
    }
    $('#pause-overlay').hidden = !paused;
    $('.game-layout').classList.toggle('paused', paused);
    $('#timer').setAttribute('aria-label', paused ? 'Resume puzzle' : 'Pause puzzle');
    showTime();
  }
  document.addEventListener('visibilitychange', () => {
    if (!game || game.solved || $('#game-view').hidden) return;
    if (document.hidden) {
      stopTimer();
      persist();
    } else if (!game.paused) {
      startTimer();
    }
  });
  window.addEventListener('pagehide', persist);

  // ---------- Rendering ----------
  function renderGame() {
    const { spec, puzzle } = game;
    $('#game-kicker').textContent = spec.kicker;
    $('#game-title').textContent = spec.title;
    $('#game-meta').textContent = spec.meta;
    $('#new-btn').hidden = spec.kind !== 'genre';
    $('#pause-overlay').hidden = true;
    $('.game-layout').classList.remove('paused');
    $('#pencil-btn').setAttribute('aria-pressed', 'false');
    document.title = `${spec.kind === 'genre' ? spec.title : spec.kind === 'gift' ? 'Gift crossword' : spec.kind === 'duel' ? spec.kicker : spec.kicker.split(' · ')[0] + ', ' + shortDate(spec.date)} · Crossword Hub`;

    const board = $('#board');
    board.classList.remove('solved');
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${puzzle.cols}, var(--size))`;
    cellEls = [];
    for (let r = 0; r < puzzle.rows; r++) {
      cellEls.push([]);
      for (let c = 0; c < puzzle.cols; c++) {
        const el = document.createElement('div');
        const ch = puzzle.solution[r][c];
        el.className = 'cell' + (ch ? '' : ' block');
        if (ch) {
          el.setAttribute('role', 'gridcell');
          const n = puzzle.numbers[r][c];
          el.innerHTML = `${n ? `<span class="num">${n}</span>` : ''}<span class="letter"></span><i class="dir"></i>`;
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            onCellClick(r, c);
          });
          el.addEventListener('click', focusTyping);
        }
        board.appendChild(el);
        cellEls[r].push(el);
      }
    }

    const showTags = spec.tags && store.settings.showTags;
    for (const dir of ['across', 'down']) {
      const list = $(`#clues-${dir}`);
      list.innerHTML = '';
      puzzle.words.forEach((w, i) => {
        if (w.dir !== dir) return;
        const li = document.createElement('li');
        li.dataset.index = i;
        li.innerHTML = `<strong>${w.number}</strong><span><span class="text"></span>${showTags && w.tag ? `<span class="tag">${esc(w.tag)}</span>` : ''}</span>`;
        $('.text', li).textContent = withLength(w);
        li.addEventListener('click', () => {
          game.sel = { ...firstEmptyCell(i), dir: w.dir };
          refresh();
          focusTyping();
        });
        list.appendChild(li);
      });
    }
    sizeBoard();
  }

  // Clue text with the answer length, unless the clue already gives one, as
  // in "(3,5)" for a two-word answer.
  const withLength = (w) => (/\([\d,\- ]+\)$/.test(w.clue) ? w.clue : `${w.clue} (${w.answer.length})`);

  const BOARD_PAD = 6; // keep in step with --pad in css/styles.css
  // Grid and clues side by side: wide screens, and tablets or phones held
  // sideways (keep in step with the layout rules in css/styles.css).
  const sideBySide = window.matchMedia('(min-width: 901px), (min-width: 700px) and (orientation: landscape)');
  // Phones held upright: the clue bar docks to the bottom, above the keyboard.
  const docked = window.matchMedia('(pointer: coarse) and (max-width: 900px) and (orientation: portrait)');
  // Phones and tablets type with their own keyboard, unless the player has
  // chosen Crossword Hub's letter keys in Settings.
  const touchDevice = () => touchScreen.matches || navigator.maxTouchPoints > 0;
  const appKeys = () => touchDevice() && store.settings.appKeys === true;
  const phoneKeys = $('#phone-keys');
  function sizeBoard() {
    if (!game) return;
    const { rows, cols } = game.puzzle;
    const view = $('#game-view');
    const inner = view.clientWidth - 32;
    const wide = sideBySide.matches;
    const availW = wide ? Math.min(inner - Math.min(460, inner * 0.4) - 28, 720) : inner;
    // Fit the grid in the window. On touch screens only the width counts, so
    // the grid doesn't shrink each time the keyboard opens.
    const top = $('#board-wrap').getBoundingClientRect().top + window.scrollY;
    // Phones held sideways have little height: fit the grid to it.
    const shortLandscape = touchScreen.matches && wide && window.innerHeight < 520;
    const availH = shortLandscape ? Math.max(200, window.innerHeight - 24) : touchScreen.matches ? Infinity : Math.max(wide ? 360 : 240, window.innerHeight - top - 24);
    const cap = game.spec.kind === 'mini' ? 72 : 52;
    // Big grids may run past the window's height rather than shrink below a
    // comfortable size; on narrow phones they scroll sideways if needed.
    const fitH = Math.max(Math.floor(availH / rows), Math.min(28, cap));
    const frame = 2 * BOARD_PAD + 1; // the dark board's padding around the squares
    const fit = Math.max(14, Math.min(cap, Math.floor((availW - 4 - frame) / cols), fitH));
    // Zoom (phones): pinch or the zoom button makes squares bigger; the grid
    // then scrolls sideways, following the square being typed in.
    game.fitSize = fit;
    const size = Math.round(Math.min(56, Math.max(fit, fit * (game.zoom || 1))));
    const board = $('#board');
    $('#zoom-btn').hidden = !touchScreen.matches || fit >= 34;
    $('#zoom-btn').setAttribute('aria-pressed', String(size > fit));
    $('#zoom-btn').setAttribute('aria-label', size > fit ? 'Zoom out' : 'Zoom in');
    board.style.setProperty('--size', size + 'px');
    board.classList.toggle('compact', size < 30);
    // Centre on a whole pixel: a half-pixel offset blurs the grid lines.
    const free = $('#board-wrap').clientWidth - (cols * size + frame);
    board.style.marginLeft = Math.max(0, Math.floor(free / 2)) + 'px';
  }
  window.addEventListener('resize', sizeBoard);

  const currentWordIndex = () => game.wordAt[game.sel.r][game.sel.c][game.sel.dir];

  function refresh() {
    if (!game) return;
    setPhoneKeyboardLayout();
    updateKeys();
    placeTyping();
    syncRoomCursor();
    requestAnimationFrame(keepActiveInView);
    let total = 0;
    let filled = 0;
    game.puzzle.solution.forEach((row, r) => row.forEach((ch, c) => {
      if (!ch) return;
      total++;
      if (game.entries[r][c]) filled++;
    }));
    $('#puzzle-progress i').style.width = `${(filled / total) * 100}%`;
    $('#puzzle-progress').setAttribute('aria-valuenow', Math.round((filled / total) * 100));
    $('#puzzle-progress').classList.toggle('done', !!game.solved);
    const { puzzle, sel, entries, revealed, wrong, pencil } = game;
    const wi = currentWordIndex();
    const word = puzzle.words[wi];
    const inWord = new Set(word.cells.map(([r, c]) => r + ',' + c));
    const crossDir = sel.dir === 'across' ? 'down' : 'across';
    const crossIndex = game.wordAt[sel.r][sel.c][crossDir];
    const inCross = new Set(crossIndex == null ? [] : puzzle.words[crossIndex].cells.map(([r, c]) => r + ',' + c));
    $('#board').classList.toggle('dir-down', sel.dir === 'down');

    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (!puzzle.solution[r][c]) continue;
        const el = cellEls[r][c];
        $('.letter', el).textContent = entries[r][c];
        el.classList.toggle('in-word', !game.solved && inWord.has(r + ',' + c));
        el.classList.toggle('active', !game.solved && r === sel.r && c === sel.c);
        el.classList.toggle('in-cross', !game.solved && inCross.has(r + ',' + c) && !inWord.has(r + ',' + c));
        el.classList.toggle('revealed', revealed[r][c]);
        el.classList.toggle('pencil', pencil[r][c] && !revealed[r][c]);
        el.classList.toggle('wrong', wrong[r][c] && !!entries[r][c]);
      }
    }

    $$('.clue-list li').forEach((li) => {
      const i = Number(li.dataset.index);
      const w = puzzle.words[i];
      li.classList.toggle('current', i === wi);
      li.classList.toggle('cross', i === crossIndex);
      li.classList.toggle('done', w.cells.every(([r, c]) => entries[r][c]));
    });
    const li = $(`.clue-list li[data-index="${wi}"]`);
    if (li && window.innerWidth > 900) {
      const ol = li.parentElement;
      if (li.offsetTop < ol.scrollTop || li.offsetTop + li.offsetHeight > ol.scrollTop + ol.clientHeight) {
        ol.scrollTop = li.offsetTop - ol.clientHeight / 3;
      }
    }

    $('#clue-bar-num').textContent = `${word.number}${word.dir === 'across' ? 'A' : 'D'}`;
    $('#clue-bar-text').textContent = withLength(word);
    $('#clue-bar').classList.toggle('complete', word.cells.every(([r, c]) => entries[r][c]));

    $('#done-bar').hidden = !game.solved;
    if (game.solved) {
      $('#done-text').textContent = game.reveals ? `Finished with help · ${formatTime(game.elapsed)}` : `Solved in ${formatTime(game.elapsed)}`;
      $('#done-actions').innerHTML = nextActions().map((a) => `<button class="btn ${a.primary ? 'btn-primary' : ''}" ${a.attr}>${esc(a.label)}</button>`).join('');
    }
    $('#timer').disabled = game.solved;
    showTime();
  }

  // ---------- Selection & typing ----------
  const hasLetter = (r, c) => !!(game.puzzle.solution[r] && game.puzzle.solution[r][c]);

  function firstEmptyCell(wi) {
    const w = game.puzzle.words[wi];
    const cell = w.cells.find(([r, c]) => !game.entries[r][c]) || w.cells[0];
    return { r: cell[0], c: cell[1] };
  }

  function onCellClick(r, c) {
    if (game.paused) return;
    const { sel, wordAt } = game;
    if (sel.r === r && sel.c === c) {
      toggleDir();
    } else {
      let dir = sel.dir;
      if (wordAt[r][c][dir] == null) dir = dir === 'across' ? 'down' : 'across';
      game.sel = { r, c, dir };
    }
    refresh();
  }

  function toggleDir() {
    const { sel, wordAt } = game;
    const other = sel.dir === 'across' ? 'down' : 'across';
    if (wordAt[sel.r][sel.c][other] != null) sel.dir = other;
  }

  function moveSelection(dr, dc) {
    const { sel, wordAt } = game;
    const axis = dr ? 'down' : 'across';
    if (sel.dir !== axis && wordAt[sel.r][sel.c][axis] != null) {
      sel.dir = axis;
      return;
    }
    let r = sel.r + dr;
    let c = sel.c + dc;
    while (r >= 0 && c >= 0 && r < game.puzzle.rows && c < game.puzzle.cols) {
      if (hasLetter(r, c)) {
        const dir = wordAt[r][c][axis] != null ? axis : axis === 'across' ? 'down' : 'across';
        game.sel = { r, c, dir };
        return;
      }
      r += dr;
      c += dc;
    }
  }

  function jumpWord(delta, preferEmpty) {
    const words = game.puzzle.words;
    let i = currentWordIndex();
    for (let step = 0; step < words.length; step++) {
      i = (i + delta + words.length) % words.length;
      const w = words[i];
      if (!preferEmpty || w.cells.some(([r, c]) => !game.entries[r][c])) {
        game.sel = { ...firstEmptyCell(i), dir: w.dir };
        return;
      }
    }
  }

  function setCell(r, c, ch) {
    if (game.revealed[r][c]) return;
    game.entries[r][c] = ch;
    game.pencil[r][c] = !!ch && game.pencilMode;
    game.wrong[r][c] = !!ch && !game.pencilMode && store.settings.autocheck && !game.duel && ch !== game.puzzle.solution[r][c];
  }

  function typeLetter(ch) {
    if (game.solved || game.paused) return;
    if (duelFrozen()) return frozenNudge();
    sound.tap();
    const { sel, entries } = game;
    const typedAt = [sel.r, sel.c];
    const wordsHere = ['across', 'down'].map((d) => game.wordAt[sel.r][sel.c][d]).filter((i) => i != null);
    const wasFull = wordsHere.map((i) => wordFull(i));
    setCell(sel.r, sel.c, ch);
    feedbackTyped(typedAt, wordsHere, wasFull);

    const word = game.puzzle.words[currentWordIndex()];
    const pos = word.cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
    const isEmpty = ([r, c]) => !entries[r][c];
    if (store.settings.skipFilled) {
      // Hop over squares that already hold a letter (for example from crossing words).
      const next = word.cells.slice(pos + 1).find(isEmpty) || word.cells.slice(0, pos).find(isEmpty);
      if (next) [sel.r, sel.c] = next;
      else if (game.puzzle.words.some((w) => w.cells.some(isEmpty))) jumpWord(1, true);
      else if (pos < word.cells.length - 1) [sel.r, sel.c] = word.cells[pos + 1];
    } else if (pos < word.cells.length - 1) {
      [sel.r, sel.c] = word.cells[pos + 1];
    } else if (!word.cells.some(isEmpty)) {
      jumpWord(1, true);
    }
    afterChange();
  }

  function backspace() {
    if (game.solved || game.paused) return;
    if (duelFrozen()) return frozenNudge();
    const { sel, entries, revealed } = game;
    if (entries[sel.r][sel.c] && !revealed[sel.r][sel.c]) {
      setCell(sel.r, sel.c, '');
    } else {
      const word = game.puzzle.words[currentWordIndex()];
      const pos = word.cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
      if (pos > 0) {
        [sel.r, sel.c] = word.cells[pos - 1];
      } else {
        jumpWord(-1, false);
        const prev = game.puzzle.words[currentWordIndex()];
        [game.sel.r, game.sel.c] = prev.cells[prev.cells.length - 1];
      }
      setCell(game.sel.r, game.sel.c, '');
    }
    afterChange();
  }

  // ---------- Check, reveal, clear ----------
  function targetCells(scope) {
    if (scope === 'cell') return [[game.sel.r, game.sel.c]];
    if (scope === 'word') return game.puzzle.words[currentWordIndex()].cells;
    const all = [];
    game.puzzle.solution.forEach((row, r) => row.forEach((ch, c) => ch && all.push([r, c])));
    return all;
  }

  function check(scope) {
    if (game.solved || game.duel) return; // no checking in a duel
    game.checks++;
    analytics.track('check_used', { scope, puzzle_kind: game.spec.kind });
    syncRoomHints();
    let bad = 0;
    let empty = 0;
    for (const [r, c] of targetCells(scope)) {
      const e = game.entries[r][c];
      if (!e) empty++;
      game.wrong[r][c] = !!e && e !== game.puzzle.solution[r][c];
      if (game.wrong[r][c]) bad++;
      if (e && !game.wrong[r][c]) game.pencil[r][c] = false;
    }
    toast(bad ? `${plural(bad, 'square')} incorrect` : empty ? 'No mistakes so far' : 'All correct');
    afterChange();
    const cells = targetCells(scope);
    const wrongCells = cells.filter(([r, c]) => game.wrong[r][c]);
    if (wrongCells.length) {
      animateCells(wrongCells, 'shake');
      buzz([30, 50, 30]);
    } else {
      animateCells(cells.filter(([r, c]) => game.entries[r][c]), 'ripple');
      buzz(12);
    }
  }

  let revealArmed = 0;
  function reveal(scope) {
    if (game.solved) return;
    if (game.duel) {
      duelReveal(scope);
      return;
    }
    if (creditsOn()) {
      creditReveal(scope);
      return;
    }
    applyReveal(scope);
  }
  function applyReveal(scope) {
    if (game.solved) return;
    if (scope === 'all' && Date.now() - revealArmed > 4000) {
      revealArmed = Date.now();
      toast('Choose Reveal → Puzzle again to show every answer');
      return;
    }
    revealArmed = 0;
    analytics.track('hint_used', { hint: { cell: 'letter', word: 'word', all: 'puzzle' }[scope], puzzle_kind: game.spec.kind });
    // Count whole words given away (Reveal → Word or Puzzle), for the stats.
    if (scope !== 'cell') {
      const words = scope === 'all' ? game.puzzle.words : [game.puzzle.words[currentWordIndex()]];
      game.revealWords += words.filter((w) => w.cells.some(([r, c]) => game.entries[r][c] !== w.answer[w.cells.findIndex(([rr, cc]) => rr === r && cc === c)])).length;
    }
    const popped = [];
    for (const [r, c] of targetCells(scope)) {
      if (game.entries[r][c] !== game.puzzle.solution[r][c]) {
        popped.push([r, c]);
        game.entries[r][c] = game.puzzle.solution[r][c];
        game.revealed[r][c] = true;
        game.reveals++;
        if (scope === 'cell') game.revealCells++;
      }
      game.pencil[r][c] = false;
      game.wrong[r][c] = false;
    }
    afterChange();
    syncRoomHints();
    if (!game.solved) animateCells(popped, 'pop');
  }

  function clear(scope) {
    if (game.solved) {
      if (scope !== 'all') return;
      // Start a solved puzzle over. The original solve stays in your record.
      const { rows, cols } = game.puzzle;
      Object.assign(game, {
        entries: grid2(rows, cols, ''), revealed: grid2(rows, cols, false), pencil: grid2(rows, cols, false),
        wrong: grid2(rows, cols, false), elapsed: 0, reveals: 0, revealWords: 0, checks: 0, solved: false,
      });
      $('#board').classList.remove('solved');
      startTimer();
      afterChange();
      return;
    }
    const cells = scope === 'incorrect' ? targetCells('all').filter(([r, c]) => game.entries[r][c] && game.entries[r][c] !== game.puzzle.solution[r][c]) : targetCells(scope === 'word' ? 'word' : 'all');
    for (const [r, c] of cells) {
      if (game.revealed[r][c]) continue;
      game.entries[r][c] = '';
      game.pencil[r][c] = false;
      game.wrong[r][c] = false;
    }
    afterChange();
  }

  function isSolved() {
    return game.puzzle.solution.every((row, r) => row.every((ch, c) => !ch || game.entries[r][c] === ch));
  }

  let lastFullWarning = '';
  // ---------- Feedback: animation, vibration, celebration ----------
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canVibrate = typeof navigator.vibrate === 'function';
  function buzz(pattern) {
    if (!canVibrate || !store.settings.vibrate) return;
    try { navigator.vibrate(pattern); } catch (e) { /* not allowed right now */ }
  }
  // Sounds, made in the page (no audio files): a soft tap for each letter,
  // ticks for countdowns and a fanfare for wins. Settings → Sounds turns
  // them off. On iPhones they follow the silent switch and leave other audio
  // (music, podcasts) playing.
  const sound = (() => {
    let ctx = null;
    const on = () => store.settings.sound !== false;
    function audio() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* older browsers */ }
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    // Browsers allow sound only after a tap or a key press.
    const wake = () => { if (on()) audio(); };
    document.addEventListener('pointerdown', wake, { passive: true });
    document.addEventListener('keydown', wake);
    function tone(freq, start, length, { type = 'sine', gain = 0.12, to } = {}) {
      const a = audio();
      if (!a || a.state !== 'running') return;
      const t = a.currentTime + start;
      const osc = a.createOscillator();
      const vol = a.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + length);
      vol.gain.setValueAtTime(0.0001, t);
      vol.gain.exponentialRampToValueAtTime(gain, t + 0.006);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(vol).connect(a.destination);
      osc.start(t);
      osc.stop(t + length + 0.02);
    }
    const play = (fn) => () => {
      if (!on()) return;
      try { fn(); } catch (e) { /* never let a sound break the game */ }
    };
    return {
      tap: play(() => tone(1500, 0, 0.03, { type: 'triangle', gain: 0.045, to: 950 })),
      tick: play(() => tone(880, 0, 0.06, { type: 'square', gain: 0.035 })),
      go: play(() => { tone(660, 0, 0.12); tone(990, 0.1, 0.3); }),
      win: play(() => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, i === 3 ? 0.7 : 0.18, { type: 'triangle', gain: 0.13 }))),
      over: play(() => [587.33, 440].forEach((f, i) => tone(f, i * 0.16, 0.32, { type: 'triangle', gain: 0.09 }))),
    };
  })();
  // Restart a CSS animation on some squares; --i staggers them in order.
  function animateCells(cells, cls) {
    if (reduceMotion.matches) return;
    cells.forEach(([r, c], i) => {
      const el = cellEls[r] && cellEls[r][c];
      if (!el) return;
      el.classList.remove(cls);
      void el.offsetWidth; // let the animation start again
      el.style.setProperty('--i', i);
      el.classList.add(cls);
      el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
    });
  }
  const wordFull = (i) => game.puzzle.words[i].cells.every(([r, c]) => game.entries[r][c]);
  const wordRight = (i) => game.puzzle.words[i].cells.every(([r, c]) => game.entries[r][c] === game.puzzle.solution[r][c]);
  function feedbackTyped([r, c], wordsHere, wasFull) {
    if (game.wrong[r][c]) {
      // Auto-check caught a wrong letter.
      animateCells([[r, c]], 'shake');
      buzz([25, 40, 25]);
      return;
    }
    animateCells([[r, c]], 'pop');
    let completed = false;
    wordsHere.forEach((i, k) => {
      if (wasFull[k] || !wordFull(i)) return;
      completed = true;
      const cells = game.puzzle.words[i].cells;
      // With auto-check on, a finished word shows whether it's right.
      if (store.settings.autocheck && !wordRight(i)) animateCells(cells, 'shake');
      else animateCells(cells, 'ripple');
    });
    buzz(completed ? 18 : 6);
  }
  function celebrate(clean) {
    buzz(clean ? [30, 60, 30, 60, 140] : [40]);
    if (reduceMotion.matches) return;
    const cells = [];
    game.puzzle.solution.forEach((row, r) => row.forEach((ch, c) => ch && cells.push([r, c])));
    cells.forEach(([r, c]) => cellEls[r][c].style.setProperty('--d', `${(r + c) * 28}ms`));
    if (clean) confetti();
  }
  // A short burst of paper confetti over the page.
  function confetti() {
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    document.body.appendChild(canvas);
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = innerWidth * dpr);
    const h = (canvas.height = innerHeight * dpr);
    const ctx = canvas.getContext('2d');
    const colours = ['#f2c230', '#a7d8ff', '#9b2915', '#121212', '#4caf7a', '#ffffff'];
    const bits = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 22 * dpr,
      vy: (-Math.random() * 18 - 8) * dpr,
      size: (5 + Math.random() * 6) * dpr,
      spin: Math.random() * Math.PI,
      vs: (Math.random() - 0.5) * 0.4,
      colour: colours[Math.floor(Math.random() * colours.length)],
    }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1400) / 800);
      for (const b of bits) {
        b.vy += 0.55 * dpr;
        b.vx *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        b.spin += b.vs;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        ctx.fillStyle = b.colour;
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        ctx.restore();
      }
      if (t < 2200) requestAnimationFrame(frame);
      else canvas.remove();
    })(start);
  }

  function afterChange() {
    if (game.duel) {
      // A duel: the server checks the grid and decides the winner.
      queueDuelGrid();
      refresh();
      return;
    }
    syncRoomCells();
    if (!game.solved && isSolved()) {
      win();
    } else if (!game.solved) {
      const full = game.puzzle.solution.every((row, r) => row.every((ch, c) => !ch || game.entries[r][c]));
      const snapshot = JSON.stringify(game.entries);
      if (full && snapshot !== lastFullWarning) {
        lastFullWarning = snapshot;
        toast('The grid is full, but something isn’t right yet');
      }
    }
    refresh();
    persist();
  }

  // ---------- Finishing ----------
  function nextActions() {
    const { spec } = game;
    const today = todayKey();
    const actions = [];
    if (spec.kind === 'gift') {
      if (giftsOpen()) actions.push({ label: 'Make one back', primary: true, attr: 'data-action="gift"' });
      actions.push({ label: 'Explore Crossword Hub', primary: !giftsOpen(), attr: 'data-nav="home"' });
    } else if (spec.kind === 'genre') {
      actions.push({ label: 'Play another', primary: true, attr: 'data-action="new"' });
      actions.push({ label: 'Back to genres', attr: 'data-nav="genres"' });
    } else if (spec.kind === 'brutal') {
      actions.push({ label: 'Back to today', primary: true, attr: 'data-nav="home"' });
    } else {
      const otherKind = spec.kind === 'daily' ? 'mini' : 'daily';
      const otherKey = `${otherKind}:${spec.date}`;
      if (!store.solves[otherKey]) {
        actions.push({ label: otherKind === 'mini' ? 'Play the Mini' : 'Play the Daily', primary: true, attr: `data-open="#/${otherKind}/${spec.date}"` });
      }
      if (arcadeAllowed('blitz')) actions.push({ label: 'Try Clue Blitz: 60 seconds', attr: 'data-open="#/arcade/blitz"' });
      else if (arcadeAllowed('survival')) actions.push({ label: 'Try the Arcade: Survival', attr: 'data-open="#/arcade/survival"' });
      actions.push({ label: spec.date === today ? 'Back to today' : 'Back to the archive', attr: `data-nav="${spec.date === today ? 'home' : 'archive'}"` });
    }
    return actions;
  }

  function win() {
    stopTimer();
    game.solved = true;
    sound.win();
    const { spec } = game;
    const time = game.elapsed;
    // A shared puzzle is a collaborative result: everyone's hints count, and
    // it never counts for the No-Hint Club or best times.
    const team = game.room ? CrosswordRooms.sumHints(game.room.hints) : null;
    const others = team ? roomPlayers().filter((p) => !p.me).map((p) => p.name) : [];
    const clean = team ? !team.letter && !team.word && !game.revealed.some((row) => row.some(Boolean)) : game.reveals === 0;
    const points = gamePoints();
    const noHint = !team && clean && !points && !game.checks && !game.autochecked;
    const badgesBefore = earnedBadges(noHintRecord());
    let newBest = false;
    store.solvedCount = (store.solvedCount || 0) + 1;
    const prev = store.solves[spec.key];
    // Keep the better record if this puzzle was solved before (the same rule
    // as merging devices: No-Hint, then clean, then fewer points, then faster).
    store.solves[spec.key] = CrosswordSync.betterSolve(prev, {
      time, clean, at: Date.now(), letters: game.reveals, words: game.revealWords,
      points, credits: hintTotal('credits', gameHints()), hints: gameHints(),
      checked: team ? team.checks > 0 : game.checks > 0, autochecked: team ? team.autocheck : game.autochecked, noHint,
      ...(team ? { collab: true, players: others.length + 1 } : {}),
    });
    if (spec.kind === 'genre' && clean && !team) {
      const k = `${spec.genre.id}:${spec.difficulty}`;
      if (!store.best[k] || time < store.best[k]) {
        store.best[k] = time;
        newBest = true;
      }
    }
    delete store.saves[spec.key];
    saveStore();
    $('#win-reward').hidden = true;
    if (creditsOn() && noHint && !prev && ['daily', 'mini', 'brutal'].includes(spec.kind)) claimReward(spec, game.entries);

    $('#board').classList.add('solved');
    celebrate(clean);
    $('#win-kicker').textContent = spec.kicker;
    $('#win-title').textContent = clean ? 'Puzzle solved!' : 'Puzzle complete';
    $('#share-extra').hidden = true;
    $('[data-action="share-more"]').setAttribute('aria-expanded', 'false');
    $('#win-time').textContent = formatTime(time);
    const newBadges = earnedBadges(noHintRecord()).filter((b) => !badgesBefore.includes(b));
    analytics.track('puzzle_complete', {
      ...puzzleParams(spec), seconds: Math.round(time), hint_points: points, assisted: !noHint, no_hint: noHint, challenge: !!game.challenge, collab: !!team,
    });
    $('#win-text').textContent = (team
      ? `Solved together${others.length ? ` with ${listNames(others)}` : ''}: ${points ? `${plural(points, 'hint point')} between you` : 'no hints between you'}. Shared puzzles are recorded separately from solo solves.`
      : clean
      ? noHint
        ? `A No-Hint solve: no hints and no checks.${newBest ? ' And a new personal best.' : ''}`
        : `0 hint points${newBest ? ' and a new personal best' : ''}. ${game.autochecked ? 'Auto-check' : 'Checking'} keeps this one out of the No-Hint Club.`
      : `${plural(points, 'hint point')} (${hintSummary(gameHints())}), so this one doesn't count toward best times or the No-Hint Club.`)
      + (newBadges.length ? ` New badge: ${newBadges.join(', ')}!` : '') + challengeOutcome();
    const gift = spec.kind === 'gift' ? spec.gift : null;
    $('#win-share').hidden = !!gift; // a gift's link is for the person it was made for
    $('#win-gift').hidden = !(gift && gift.message);
    if (gift) {
      $('#win-text').textContent = gift.from ? `${gift.from} made this crossword just for you.` : 'This crossword was made just for you.';
      if (gift.message) {
        $('#win-gift').innerHTML = `<p>${esc(gift.message).replace(/\n/g, '<br>')}</p>${gift.from ? `<cite>${esc(gift.from)}</cite>` : ''}`;
      }
    }
    const next = $('#win-next');
    next.hidden = !((spec.kind === 'daily' || spec.kind === 'mini') && spec.date === todayKey());
    if (!next.hidden) {
      const mins = Math.ceil(CrosswordShare.msUntilNextDay(now()) / 60000);
      next.textContent = `New Daily and Mini in ${Math.floor(mins / 60)}h ${mins % 60}m.`;
    }
    let stats = `<div><b>${points}</b><span>Hint points</span></div>`;
    const credits = hintTotal('credits', gameHints());
    if (credits) stats += `<div><b>${credits}</b><span>Hint credits used</span></div>`;
    if (spec.kind === 'daily' || spec.kind === 'mini') {
      const { current, longest } = dailyStreaks();
      stats += `<div><b>${current}</b><span>Current streak</span></div><div><b>${longest}</b><span>Longest streak</span></div>`;
      const used = gameHints(); // the team's, in a shared puzzle
      if (!clean) stats += `<div><b>${team ? used.letter : game.reveals}</b><span>Letters revealed</span></div><div><b>${used.word}</b><span>Words revealed</span></div>`;
    } else if (spec.kind === 'genre' && store.best[`${spec.genre.id}:${spec.difficulty}`]) {
      stats += `<div><b>${formatTime(store.best[`${spec.genre.id}:${spec.difficulty}`])}</b><span>Best ${esc(levelsFor(spec.genre)[spec.difficulty].label)} time</span></div>`;
    }
    $('#win-stats').innerHTML = spec.kind === 'gift' ? '' : stats; // a gift ends on its message, not the score
    typeInput.blur(); // close the device keyboard so the result is visible
    $('#win-actions').innerHTML = nextActions().map((a) => `<button class="btn ${a.primary ? 'btn-primary' : ''}" ${a.attr}>${esc(a.label)}</button>`).join('');
    refresh();
    setTimeout(() => {
      if (game && game.solved && !$('#game-view').hidden && !$('#win-dialog').open) $('#win-dialog').showModal();
    }, 700);
  }

  // ---------- Sharing and challenges ----------
  // Links are added only when the site is opened directly (not embedded).
  function canLink() {
    let framed = true;
    try {
      framed = window.top !== window.self;
    } catch (e) {
      framed = true;
    }
    return inApp || (!framed && /^https?:/.test(location.protocol));
  }
  // In the app the page's own address is local to the phone, so shared
  // links use the website's.
  const siteUrl = () => (inApp ? SITE : `${location.origin}${location.pathname}`);
  function result() {
    const points = gamePoints();
    return { time: game.elapsed, points, noHint: !game.room && game.reveals === 0 && !points && !game.checks && !game.autochecked };
  }
  const challengeUrl = () => `${siteUrl()}${game.spec.url}?c=${CrosswordShare.encodeChallenge(result())}`;
  const resultName = (spec) => (spec.kind === 'genre' ? `${spec.title} (${levelsFor(spec.genre)[spec.difficulty].label})` : `${spec.kicker.split(' · ')[0]}, ${shortDate(spec.date)}`);
  function describeResult(r) {
    return r.noHint ? 'as a No-Hint solve' : `with ${plural(r.points, 'hint point')}`;
  }

  function shareText() {
    const r = result();
    const how = r.noHint ? 'No-Hint solve 🏅' : r.points ? plural(r.points, 'hint point') : '0 hint points';
    let text = `Crossword Hub · ${resultName(game.spec)}\n${formatTime(r.time)}, ${how}`;
    if (canLink()) text += `\nCan you beat it? ${challengeUrl()}`;
    return text;
  }

  // The spoiler-free result image (see js/share.js).
  function resultCard() {
    const { spec, puzzle } = game;
    const r = result();
    const streak = spec.kind === 'daily' || spec.kind === 'mini' ? dailyStreaks().current : 0;
    return CrosswordShare.drawCard(document.createElement('canvas'), {
      kicker: spec.kind === 'genre' ? `${spec.kicker} · ${levelsFor(spec.genre)[spec.difficulty].label}` : spec.kicker,
      title: spec.kind === 'genre' ? spec.title : spec.kind === 'brutal' ? spec.title : longDate(spec.date),
      time: formatTime(r.time),
      points: r.points,
      noHint: r.noHint,
      assisted: !r.noHint,
      streak,
      grid: { rows: puzzle.rows, cols: puzzle.cols, filled: puzzle.solution.map((row) => row.map(Boolean)), revealed: game.revealed },
      cta: 'Can you beat it?',
      site: `${location.host}${location.pathname}`.replace(/\/$/, ''),
    });
  }
  // The card's fonts must be loaded before it's drawn (canvas won't wait).
  async function cardBlob() {
    try {
      await Promise.all(['400 112px "Instrument Serif"', 'italic 700 40px Newsreader', 'italic 400 32px Newsreader', '800 28px "Public Sans"'].map((f) => document.fonts.load(f)));
    } catch (e) { /* draw with fallback fonts */ }
    return new Promise((resolve) => resultCard().toBlob(resolve, 'image/png'));
  }

  function copyText(text, message) {
    const done = () => toast(message);
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      ta.remove();
      ok ? done() : toast('Copying isn’t available here');
    };
    try {
      navigator.clipboard.writeText(text).then(done, fallback);
    } catch (e) {
      fallback();
    }
  }

  // The phone's share sheet, with the image where the device allows it.
  const trackShare = (method) => analytics.track('share', { method, content_type: game.spec.kind, item_id: CrosswordShare.pagePath(game.spec.url) });
  async function share() {
    trackShare('native');
    const text = shareText();
    try {
      if (navigator.share) {
        const blob = await cardBlob();
        const file = blob && new File([blob], 'crossword-hub-result.png', { type: 'image/png' });
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
        else await navigator.share({ text });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // the player closed the share sheet
    }
    copyText(text, 'Result copied to your clipboard');
  }
  // Less-used platforms, under "More sharing options". Both need a link.
  function shareFacebook() {
    if (!canLink()) return copyText(shareText(), 'Result copied to your clipboard');
    trackShare('facebook');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(challengeUrl())}`, '_blank', 'noopener');
  }
  function shareX() {
    trackShare('x');
    const r = result();
    const text = `Crossword Hub · ${resultName(game.spec)}: ${formatTime(r.time)}${r.noHint ? ', a No-Hint solve' : ''}. Can you beat it?`;
    const url = canLink() ? `&url=${encodeURIComponent(challengeUrl())}` : '';
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}${url}`, '_blank', 'noopener');
  }
  function toggleShareMore(btn) {
    const open = $('#share-extra').hidden;
    $('#share-extra').hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }
  // The phone's own share sheet, where there is one.
  $('#share-native').hidden = typeof navigator.share !== 'function';

  function shareWhatsApp() {
    trackShare('whatsapp');
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank', 'noopener');
  }
  function copyChallenge() {
    trackShare('copy_link');
    if (canLink()) copyText(`Can you beat my ${formatTime(game.elapsed)} on ${resultName(game.spec)}? ${challengeUrl()}`, 'Challenge link copied');
    else copyText(shareText(), 'Result copied to your clipboard');
  }
  async function saveImage() {
    trackShare('image');
    const blob = await cardBlob();
    if (!blob) return toast('Saving images isn’t available here');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crossword-hub-result.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // A friend's result from a challenge link, shown above the puzzle.
  function showChallenge() {
    const banner = $('#challenge-banner');
    const c = game && game.challenge;
    banner.hidden = !c;
    if (c) banner.textContent = `Challenge: a friend finished this in ${formatTime(c.time)} ${describeResult(c)}. Can you beat it?`;
  }
  function challengeOutcome() {
    const c = game.challenge;
    if (!c) return '';
    const outcome = CrosswordShare.compareChallenge(result(), c);
    const theirs = `${formatTime(c.time)} ${describeResult(c)}`;
    return outcome === 'beat' ? ` You beat the challenge (${theirs})!`
      : outcome === 'tie' ? ` A dead heat with the challenge (${theirs}).`
        : ` The challenge stands at ${theirs}. Fewer hint points wins, then the faster time.`;
  }

  // ---------- Phone layout: docked clue bar and the clue panel ----------
  // On phones held upright the clue bar sits at the bottom, above the
  // phone's keyboard (or Crossword Hub's own letter keys, if chosen in
  // Settings), with big previous and next buttons; swiping it changes clue,
  // and tapping the clue opens every clue in a panel. The grid scrolls to
  // keep the square being typed in visible above the keyboard.
  function placeDock() {
    let gap = 0;
    if (docked.matches && !phoneKeys.hidden) gap = phoneKeys.getBoundingClientRect().height;
    else if (window.visualViewport) gap = Math.max(0, document.documentElement.clientHeight - (visualViewport.offsetTop + visualViewport.height));
    document.documentElement.style.setProperty('--dock-bottom', `${Math.round(gap)}px`);
  }
  function updateKeys() {
    const show = !!game && !game.solved && !game.paused && appKeys();
    if (phoneKeys.hidden === !show) return;
    phoneKeys.hidden = !show;
    placeDock();
  }
  phoneKeys.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus where it is
  phoneKeys.addEventListener('click', (e) => {
    const key = e.target.closest('[data-key]');
    if (!key || !game || game.paused || game.solved) return;
    const k = key.dataset.key;
    if (k === 'back') backspace();
    else if (k === 'turn') { toggleDir(); refresh(); }
    else typeLetter(k);
  });
  docked.addEventListener('change', () => {
    setPhoneKeyboardLayout();
    placeDock();
  });
  // Typing with the phone's own keyboard on a phone held upright. Phones
  // (iPhones above all) can't reliably keep a bar pinned just above their
  // keyboard, and their own bars take room there too, so the clue bar sits
  // under the tools instead, and the grid scrolls into the space between it
  // and the keyboard (css: body.phone-keyboard). It's set when the puzzle
  // opens, never as the keyboard opens: moving the page under a text box
  // just as it gets focus makes iPhones close the keyboard again.
  const phoneKeyboardLayout = () => document.body.classList.contains('phone-keyboard');
  function setPhoneKeyboardLayout() {
    const on = !!game && docked.matches && !appKeys() && !$('#game-view').hidden;
    if (on === phoneKeyboardLayout()) return;
    document.body.classList.toggle('phone-keyboard', on);
    if (on) document.documentElement.style.setProperty('--tools-height', `${$('.toolbar').offsetHeight}px`);
  }

  function keepActiveInView() {
    if (!game || !docked.matches || $('#game-view').hidden || game.solved || !cellEls.length) return;
    const el = cellEls[game.sel.r] && cellEls[game.sel.r][game.sel.c];
    if (!el) return;
    const vv = window.visualViewport;
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    // With the phone's keyboard open the clue bar sits under the tools, and
    // the browser may float its own controls (Safari's address bar) just
    // above the keyboard, so keep a margin there.
    const viewTop = phoneKeyboardLayout()
      ? $('#clue-bar').getBoundingClientRect().bottom + 8
      : (vv ? vv.offsetTop : 0) + $('.toolbar').getBoundingClientRect().height + 8;
    const viewBottom = phoneKeyboardLayout()
      ? visibleBottom - 64
      : Math.min(visibleBottom - $('#clue-bar').getBoundingClientRect().height, $('#clue-bar').getBoundingClientRect().top) - 12;
    followHorizontally(el);
    const rect = el.getBoundingClientRect();
    if (rect.bottom > viewBottom) window.scrollBy({ top: rect.bottom - viewBottom, behavior: 'smooth' });
    else if (rect.top < viewTop) window.scrollBy({ top: rect.top - viewTop, behavior: 'smooth' });
  }
  // When zoomed in, scroll the grid sideways to keep a square in view.
  function followHorizontally(el) {
    const wrap = $('#board-wrap');
    if (wrap.scrollWidth <= wrap.clientWidth) return;
    const w = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const margin = r.width * 1.5;
    if (r.right > w.right - margin) wrap.scrollBy({ left: r.right - w.right + margin, behavior: 'smooth' });
    else if (r.left < w.left + margin) wrap.scrollBy({ left: r.left - w.left - margin, behavior: 'smooth' });
  }
  function setZoom(zoom) {
    if (!game) return;
    game.zoom = Math.max(1, Math.min(4, zoom));
    sizeBoard();
    if (game.zoom === 1) $('#board-wrap').scrollLeft = 0;
    const el = cellEls[game.sel.r] && cellEls[game.sel.r][game.sel.c];
    if (el) {
      followHorizontally(el);
      keepActiveInView();
    }
  }
  // The zoom button: between fitting the screen and comfortable squares.
  function toggleZoom() {
    if (!game || !game.fitSize) return;
    setZoom((game.zoom || 1) > 1.05 ? 1 : 40 / game.fitSize);
  }
  // Pinch the grid with two fingers to zoom.
  let pinch = null;
  const touchGap = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  $('#board-wrap').addEventListener('touchstart', (e) => {
    if (e.touches.length === 2 && game) pinch = { gap: touchGap(e.touches), zoom: game.zoom || 1 };
  }, { passive: true });
  $('#board-wrap').addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault(); // zoom the grid, not the page
    game.zoom = Math.max(1, Math.min(4, pinch.zoom * (touchGap(e.touches) / pinch.gap)));
    sizeBoard();
  }, { passive: false });
  $('#board-wrap').addEventListener('touchend', (e) => {
    if (pinch && e.touches.length < 2) {
      pinch = null;
      setZoom(game.zoom);
    }
  });

  if (window.visualViewport) {
    // The keyboard opening or closing. Browsers scroll the page themselves
    // as it slides in, so check again once that has settled.
    let settle = null;
    visualViewport.addEventListener('resize', () => {
      placeDock();
      keepActiveInView();
      clearTimeout(settle);
      settle = setTimeout(() => { placeDock(); keepActiveInView(); }, 350);
    });
    visualViewport.addEventListener('scroll', placeDock);
  }
  placeDock();

  function openClueSheet() {
    if (!game) return;
    const { puzzle, entries } = game;
    const wi = currentWordIndex();
    $('#sheet-lists').innerHTML = ['across', 'down'].map((dir) => `<section><h3>${dir === 'across' ? 'Across' : 'Down'}</h3><ol>${puzzle.words.map((w, i) => [w, i]).filter(([w]) => w.dir === dir).map(([w, i]) => `<li data-sheet-index="${i}" class="${i === wi ? 'current' : ''}${w.cells.every(([r, c]) => entries[r][c]) ? ' done' : ''}"><strong>${w.number}</strong><span>${esc(withLength(w))}</span></li>`).join('')}</ol></section>`).join('');
    $('#clue-sheet').showModal();
    const current = $('#sheet-lists li.current');
    if (current) current.scrollIntoView({ block: 'center' });
  }
  $('#clue-sheet').addEventListener('click', (e) => {
    const li = e.target.closest('[data-sheet-index]');
    if (!li || !game) return;
    const i = Number(li.dataset.sheetIndex);
    game.sel = { ...firstEmptyCell(i), dir: game.puzzle.words[i].dir };
    $('#clue-sheet').close();
    refresh();
    focusTyping();
  });
  // Swipe the clue bar: left for the next clue, right for the previous one.
  let swipeStart = null;
  let swipedAt = 0;
  $('#clue-bar').addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    swipeStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  $('#clue-bar').addEventListener('touchend', (e) => {
    if (!swipeStart || !game || game.paused) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStart.x;
    const dy = t.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 45 || Math.abs(dy) > 35) return;
    swipedAt = Date.now();
    jumpWord(dx < 0 ? 1 : -1, false);
    refresh();
  });

  // ---------- Multiplayer rooms (Help me solve) ----------
  // Up to five players fill in one grid together, live. The connection is in
  // js/room.js (Firebase Realtime Database); it's switched on by a
  // databaseURL in js/firebase-config.js. Guests need no account.
  const Rooms = CrosswordRooms;
  const multiplayer = !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  let roomServicePromise = null;
  function roomService() {
    if (window.CrosswordRoomService) return Promise.resolve(window.CrosswordRoomService);
    if (!roomServicePromise) {
      roomServicePromise = new Promise((resolve, reject) => {
        window.addEventListener('roomservice', () => resolve(window.CrosswordRoomService), { once: true });
        setTimeout(() => {
          roomServicePromise = null;
          reject(new Error('Multiplayer didn’t load'));
        }, 15000);
      });
    }
    return roomServicePromise;
  }
  const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '');

  // Asks for the name shown to the other players (remembered on this device).
  function askName(heading, text, action) {
    const d = $('#name-dialog');
    $('#name-title').textContent = heading;
    $('#name-text').textContent = text;
    $('#name-submit').textContent = action;
    $('#name-input').value = store.settings.playerName || Rooms.randomName();
    d.returnValue = '';
    d.showModal();
    return new Promise((resolve) => d.addEventListener('close', () => {
      if (d.returnValue !== 'ok') return resolve(null);
      let name = Rooms.cleanName($('#name-input').value) || Rooms.randomName();
      if (!Econ.politeName(name)) {
        toast('Please choose a different name: we’ve picked one for now.');
        name = Rooms.randomName();
      }
      store.settings.playerName = name;
      saveStore();
      resolve(name);
    }, { once: true }));
  }

  // Players in seat order: { uid, name, colour, me, host, online }.
  function roomPlayers() {
    const room = game && game.room;
    if (!room) return [];
    return Object.entries(room.slots || {}).filter(([, s]) => s && s.uid).sort(([a], [b]) => a - b).map(([seat, s]) => ({
      uid: s.uid,
      name: s.name,
      colour: Rooms.COLOURS[(Number(seat) - 1) % Rooms.COLOURS.length],
      me: s.uid === room.uid,
      host: room.meta && s.uid === room.meta.host,
      online: s.uid === room.uid ? room.connected : !!(room.presence && room.presence[s.uid]),
      joinedAt: s.joinedAt || 0,
    })).filter((p, i, all) => p.me || !all.some((q) => q !== p && q.name === p.name && (q.me || q.joinedAt > p.joinedAt)));
    // (Two seats with one name: the older is that player's seat from before
    // they signed in or out, so only the newer one is shown. See rejoinRoom.)
  }

  // The host starts a room from the puzzle in progress, letters and all.
  async function startRoom() {
    if (!game || game.room || game.solved || !multiplayer) return;
    const g = game;
    const name = await askName('Solve this one together', `Invite up to ${Rooms.MAX_PLAYERS - 1} friends to fill in this grid with you, live. They don’t need an account.`, 'Start');
    if (!name || game !== g) return;
    toast('Starting a shared puzzle…');
    try {
      const service = await roomService();
      const id = await service.create({
        puzzle: g.spec.url.split('?')[0],
        title: resultName(g.spec),
        base: currentElapsed(),
        cells: Rooms.gridToCells(g.entries, g.revealed),
        name,
      });
      if (game !== g) return;
      enterRoom(id, service);
      replaceRoute(`#/room/${id}`);
      analytics.track('room_create', { puzzle_kind: g.spec.kind });
      openInvite();
    } catch (e) {
      toast('Couldn’t start a shared puzzle. Check your connection and try again.');
    }
  }

  // Opens an invite link: #/room/<id>.
  async function openRoom(id, routeNow) {
    $('#game-view').classList.add('joining'); // only the heading until the puzzle opens
    $('#game-kicker').textContent = 'Help me solve';
    $('#game-title').textContent = 'Joining the puzzle…';
    const home = (message) => {
      toast(message);
      navigate('#/');
    };
    if (!multiplayer || !Rooms.validRoomId(id)) return home('That invite link isn’t valid.');
    let service;
    let info;
    try {
      service = await roomService();
      info = await service.peek(id);
    } catch (e) {
      if (currentRoute === routeNow) home('Couldn’t reach the shared puzzle. Check your connection and try again.');
      return;
    }
    if (currentRoute !== routeNow) return;
    if (!info) return home('That shared puzzle doesn’t exist.');
    const spec = await specForPath(info.meta.puzzle);
    if (currentRoute !== routeNow) return;
    if (!spec) return home('That shared puzzle can’t be opened any more.');
    const solo = (message) => {
      toast(message);
      replaceRoute(spec.url);
      startGame(spec);
    };
    if (info.expired) return solo('This shared puzzle has closed. You can still solve it on your own.');
    if (info.banned) return solo('You can’t rejoin this shared puzzle, but you can solve it on your own.');
    if (!info.member) {
      if (info.full) return solo(`This puzzle already has ${Rooms.MAX_PLAYERS} players. You can solve it on your own.`);
      const host = Object.values(info.slots).find((x) => x && x.uid === info.meta.host);
      const name = await askName(`Join ${host ? `${host.name}’s` : 'a shared'} puzzle`, `${info.meta.title}: fill in the grid together, live. No account needed.`, 'Join');
      if (currentRoute !== routeNow) return;
      if (!name) return navigate('#/');
      let result;
      try {
        result = await service.join(id, name);
      } catch (e) {
        return home('Couldn’t join the shared puzzle. Check your connection and try again.');
      }
      if (currentRoute !== routeNow) return;
      if (result === 'full') return solo(`This puzzle already has ${Rooms.MAX_PLAYERS} players. You can solve it on your own.`);
      analytics.track('room_join', { puzzle_kind: spec.kind });
    }
    startGame(spec);
    enterRoom(id, service);
  }

  function enterRoom(id, service) {
    // ready: the room's letters have arrived, so this player's changes can be
    // sent without overwriting them with letters only this device had.
    game.room = { id, service, uid: service.uid(), meta: null, slots: {}, presence: {}, hints: {}, sent: {}, ready: false, connected: true, offset: 0, cursor: null };
    $('#room-bar').hidden = false;
    $('#room-start').hidden = true;
    service.attach(id, onRoomState);
    syncRoomHints();
    syncRoomCursor(); // show as here straight away
    renderRoomBar();
  }

  function onRoomState(state) {
    const room = game && game.room;
    if (!room || room.id !== state.id || state.uid !== room.uid) return;
    Object.assign(room, { meta: state.meta, slots: state.slots, presence: state.presence, hints: state.hints, connected: state.connected, offset: state.serverNow - Date.now() });
    if (state.removed) return roomEnded('The host removed you from this shared puzzle. Your grid stays here to finish on your own.');
    if (!state.meta) return;
    applyRoomCells(state.cells);
    if (!room.ready) {
      room.ready = true;
      // Changes the room didn't get before a rejoin (see rejoinRoom).
      for (const [k, cell] of Object.entries(room.pending || {})) {
        const [r, c] = k.split('_').map(Number);
        game.entries[r][c] = cell ? cell.v : '';
        game.revealed[r][c] = !!(cell && cell.rev);
      }
      room.pending = null;
      syncRoomCells(); // anything typed while connecting
      refresh();
      if (!game.solved && isSolved()) win();
    }
    renderRoomBar();
    renderPeers();
  }

  // Signing in or out during a shared puzzle changes this player's Firebase
  // ID (a guest who signs in to use a hint, say), and the room only takes
  // letters from its members' IDs. So rejoin under the new one, and send
  // the changes the room didn't get. Also tried when the room refuses
  // letters for any reason.
  let rejoining = null;
  function rejoinRoom() {
    const room = game && game.room;
    if (!room || rejoining) return;
    const { service } = room;
    if (service.uid() === room.uid) {
      // Refused for another reason (the room has closed, say): say so once.
      if (!room.refusedNotice) toast('Your letters couldn’t be shared with the others. They’re saved on this device.');
      room.refusedNotice = true;
      return;
    }
    const name = (Object.values(room.slots || {}).find((s) => s && s.uid === room.uid) || {}).name || store.settings.playerName || Rooms.randomName();
    const pending = Rooms.diffCells(room.sent, game.entries, game.revealed);
    rejoining = (async () => {
      const result = await service.join(room.id, name);
      if (!game || game.room !== room) return;
      if (result !== 'joined') return roomEnded(`This puzzle already has ${Rooms.MAX_PLAYERS} players, so you can’t rejoin it. Your grid stays here to finish on your own.`);
      Object.assign(room, { uid: service.uid(), ready: false, pending, sent: {} });
      await service.attach(room.id, onRoomState);
      syncRoomHints();
      room.cursor = null;
      syncRoomCursor();
    })().catch(() => {
      toast('Your letters couldn’t be shared. Check your connection: they’re saved on this device.');
    }).finally(() => { rejoining = null; });
  }
  document.addEventListener('online:user', () => {
    const room = game && game.room;
    if (room && room.service.uid() !== room.uid) rejoinRoom();
  });
  window.addEventListener('roomrefused', rejoinRoom);

  // The room's letters, applied to this grid.
  function applyRoomCells(cells) {
    const { puzzle } = game;
    const sent = {};
    let changed = false;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (!puzzle.solution[r][c]) continue;
        const cell = cells[Rooms.cellKey(r, c)];
        const v = cell && /^[A-Z]$/.test(cell.v) ? cell.v : '';
        const rev = !!(v && cell.rev);
        if (v) sent[Rooms.cellKey(r, c)] = rev ? { v, rev } : { v };
        if (game.entries[r][c] !== v || game.revealed[r][c] !== rev) {
          game.entries[r][c] = v;
          game.revealed[r][c] = rev;
          game.pencil[r][c] = false;
          game.wrong[r][c] = !!v && store.settings.autocheck && v !== puzzle.solution[r][c];
          changed = true;
        }
      }
    }
    game.room.sent = sent;
    if (changed) afterChange();
  }

  // This player's changes, sent to the room (pencil marks stay on this device).
  function syncRoomCells() {
    const room = game && game.room;
    if (!room || !room.ready) return;
    const diff = Rooms.diffCells(room.sent, game.entries, game.revealed);
    if (!Object.keys(diff).length) return;
    for (const [k, cell] of Object.entries(diff)) {
      if (cell) room.sent[k] = cell;
      else delete room.sent[k];
    }
    room.service.sendCells(diff);
  }
  let cursorTimer = null;
  function syncRoomCursor() {
    const room = game && game.room;
    if (!room) return;
    const { r, c, dir } = game.sel;
    if (room.cursor && room.cursor.r === r && room.cursor.c === c && room.cursor.dir === dir) return;
    room.cursor = { r, c, dir };
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(() => game && game.room === room && room.service.sendCursor(room.cursor), 250);
  }
  function syncRoomHints() {
    const room = game && game.room;
    if (room) room.service.sendHints({ letter: game.revealCells, word: game.revealWords, checks: game.checks, autocheck: game.autochecked });
  }

  // Who's here, and where the others are working.
  function renderRoomBar() {
    const room = game && game.room;
    if (!room) return;
    const players = roomPlayers();
    $('#room-players').innerHTML = players.map((p) => `<span class="room-player${p.online ? '' : ' away'}" style="--peer:${p.colour}" title="${esc(p.name)}${p.host ? ' (host)' : ''}${p.online ? '' : ' (away)'}"><i></i>${esc(p.me ? `${p.name} (you)` : p.name)}</span>`).join('');
    const expired = room.meta && room.meta.expiresAt <= Date.now() + room.offset;
    $('#room-status').textContent = expired ? 'This room has closed; finish on your own.' : !room.connected ? 'Reconnecting… your letters are saved.' : '';
    if ($('#room-dialog').open) renderInvitePlayers();
  }
  function renderPeers() {
    const room = game && game.room;
    $$('.cell.peer, .cell.peer-word').forEach((el) => {
      el.classList.remove('peer', 'peer-word');
      el.style.removeProperty('--peer');
      el.removeAttribute('data-peer');
    });
    $$('.clue-list .peer-dots').forEach((el) => el.remove());
    if (!room) return;
    for (const p of roomPlayers()) {
      const at = room.presence && room.presence[p.uid];
      if (p.me || !at || !game.puzzle.solution[at.r] || !game.puzzle.solution[at.r][at.c]) continue;
      const wi = game.wordAt[at.r][at.c][at.d];
      if (wi != null) {
        for (const [r, c] of game.puzzle.words[wi].cells) {
          cellEls[r][c].classList.add('peer-word');
          cellEls[r][c].style.setProperty('--peer', p.colour);
        }
        const li = $(`.clue-list li[data-index="${wi}"]`);
        if (li) {
          let dots = $('.peer-dots', li);
          if (!dots) {
            dots = document.createElement('span');
            dots.className = 'peer-dots';
            li.appendChild(dots);
          }
          dots.insertAdjacentHTML('beforeend', `<i style="--peer:${p.colour}" title="${esc(p.name)} is working on this"></i>`);
        }
      }
      const el = cellEls[at.r][at.c];
      el.classList.add('peer');
      el.style.setProperty('--peer', p.colour);
      el.dataset.peer = p.name;
    }
  }

  // The invite: link, WhatsApp, copy, share, and the players.
  const roomUrl = () => `${siteUrl()}#/room/${game.room.id}`;
  function openInvite() {
    if (!game || !game.room) return;
    $('#room-link').value = roomUrl();
    $('#room-link-text').textContent = roomUrl().replace(/^https?:\/\//, '');
    $('#room-share-btn').hidden = !navigator.share;
    renderInvitePlayers();
    $('#toast').hidden = true;
    $('#room-dialog').showModal();
  }
  function renderInvitePlayers() {
    const room = game.room;
    const host = room.meta && room.meta.host === room.uid;
    const players = roomPlayers();
    $('#room-seats').textContent = `${players.length} of ${Rooms.MAX_PLAYERS}`;
    const initial = (name) => esc((name.trim()[0] || '?').toUpperCase());
    $('#room-list').innerHTML = players.map((p) => `<li style="--peer:${p.colour}">
        <span class="room-avatar${p.online ? '' : ' away'}">${initial(p.name)}</span>
        <span class="room-name">${esc(p.name)}${p.me ? ' <em>You</em>' : ''}${p.host ? ' <em>Host</em>' : ''}${p.online ? '' : ' <small>away</small>'}</span>
        ${host && !p.me ? `<button class="link-btn room-remove" data-action="room-remove" data-uid="${esc(p.uid)}">Remove</button>` : ''}
      </li>`).join('') + (players.length < Rooms.MAX_PLAYERS ? `<li class="room-empty"><span class="room-seats-free">${'<i></i>'.repeat(Rooms.MAX_PLAYERS - players.length)}</span><span class="room-name">${plural(Rooms.MAX_PLAYERS - players.length, 'seat')} free</span></li>` : '');
  }
  const inviteText = () => `Help me solve this crossword on Crossword Hub (${game.room && game.room.meta ? game.room.meta.title : resultName(game.spec)}): ${roomUrl()}`;
  function inviteWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText())}`, '_blank', 'noopener');
  }
  async function inviteShare() {
    try {
      if (navigator.share) return await navigator.share({ text: inviteText() });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    copyText(roomUrl(), 'Invite link copied');
  }

  async function leaveRoom() {
    if (!game || !game.room) return;
    const { service } = game.room;
    service.leave(); // frees the seat, then stops following the room
    roomEnded('You left the shared puzzle. Your grid stays here to finish on your own.');
  }
  async function removePlayer(uid) {
    const room = game && game.room;
    if (!room) return;
    try {
      await room.service.remove(uid);
    } catch (e) {
      toast('Couldn’t remove that player. Check your connection and try again.');
    }
  }
  // Back to playing alone, keeping the letters.
  function roomEnded(message) {
    if (!game || !game.room) return;
    game.room.service.detach();
    game.room = null;
    $('#room-bar').hidden = true;
    $('#room-start').hidden = !multiplayer || game.solved;
    $('#room-dialog').open && $('#room-dialog').close();
    renderPeers();
    replaceRoute(game.spec.url);
    stopTimer();
    startTimer();
    persist();
    toast(message);
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2400);
  }

  // ---------- Keyboard input ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus();
    if (!game || $('#game-view').hidden || $('#win-dialog').open) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const fromTyping = e.target === typeInput;
    if (!fromTyping && e.target.matches && e.target.matches('input, textarea')) return;
    if (game.paused) return;
    const k = e.key;
    // Letters and deletions from the device keyboard arrive as input events.
    if (fromTyping && (/^[a-z]$/i.test(k) || k === 'Backspace' || k === 'Delete')) return;
    if (fromTyping && k === 'Enter') { jumpWord(1, false); refresh(); e.preventDefault(); return; }
    if (/^[a-z]$/i.test(k)) typeLetter(k.toUpperCase());
    else if (k === 'Backspace') backspace();
    else if (k === 'Delete') {
      setCell(game.sel.r, game.sel.c, '');
      afterChange();
    } else if (k === 'ArrowLeft') { moveSelection(0, -1); refresh(); }
    else if (k === 'ArrowRight') { moveSelection(0, 1); refresh(); }
    else if (k === 'ArrowUp') { moveSelection(-1, 0); refresh(); }
    else if (k === 'ArrowDown') { moveSelection(1, 0); refresh(); }
    else if (k === ' ' || k === 'Enter') { toggleDir(); refresh(); }
    else if (k === 'Tab') { jumpWord(e.shiftKey ? -1 : 1, false); refresh(); }
    else return;
    e.preventDefault();
  });

  // Phones and tablets type with their own keyboard through a hidden text box.
  // It always holds one placeholder character: deleting it means Backspace,
  // and anything added after it is typed into the grid.
  const typeInput = $('#type-input');
  const PLACEHOLDER = '-';
  let typed = PLACEHOLDER;
  function resetTyping() {
    typeInput.value = typed = PLACEHOLDER;
    try { typeInput.setSelectionRange(1, 1); } catch (e) { /* not focused */ }
  }
  function focusTyping() {
    if (!touchScreen.matches || !game || game.solved || game.paused) return;
    if (docked.matches && appKeys()) return; // the player chose the letter keys
    placeTyping();
    resetTyping();
    typeInput.focus();
  }
  function placeTyping() {
    if (!game || !cellEls.length) return;
    const el = cellEls[game.sel.r][game.sel.c];
    typeInput.style.top = el.offsetTop + 'px';
    typeInput.style.left = el.offsetLeft + 'px';
  }
  typeInput.addEventListener('input', (e) => {
    const value = typeInput.value;
    const before = typed;
    typed = value;
    if (!game || game.paused || game.solved) return resetTyping();
    if (value.length < before.length && before.startsWith(value)) {
      for (let i = value.length; i < before.length; i++) backspace();
    } else {
      const added = value.startsWith(before) ? value.slice(before.length) : (e.data || '');
      if (added === ' ') { toggleDir(); refresh(); }
      for (const ch of added.toUpperCase().replace(/[^A-Z]/g, '')) typeLetter(ch);
    }
    // Word suggestions build text up while composing; reset once they finish.
    if (!e.isComposing) resetTyping();
  });
  typeInput.addEventListener('compositionend', () => setTimeout(resetTyping));
  // Moving between clues shouldn't close the device keyboard: stop these
  // controls from taking focus away from the text box.
  document.addEventListener('pointerdown', (e) => {
    if (document.activeElement === typeInput && e.target.closest('.clue-nav, .clue-list li, #clue-bar')) e.preventDefault();
  });

  // ---------- Clicks ----------
  function closeMenus(except) {
    $$('.menu-list').forEach((m) => {
      if (m !== except) m.hidden = true;
    });
  }

  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) {
      const list = $(`[data-menu-list="${menuBtn.dataset.menu}"]`);
      closeMenus(list);
      list.hidden = !list.hidden;
      return;
    }
    if (!e.target.closest('.settings-panel')) closeMenus();

    const theme = e.target.closest('[data-theme-choice]');
    if (theme) {
      store.settings.theme = theme.dataset.themeChoice;
      saveStore();
      applyTheme();
      if (!$('#home-view').hidden) renderHome();
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) {
      e.preventDefault();
      closeDialogs();
      navigate(open.dataset.open);
      return;
    }
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      closeDialogs();
      navigate({ home: '#/', archive: '#/archive', genres: '#/genres', arcade: '#/arcade', stats: '#/stats' }[nav.dataset.nav]);
      return;
    }
    const genreCard = e.target.closest('[data-genre]');
    if (genreCard) {
      const genre = genreById(genreCard.dataset.genre);
      closeDialogs(); // a favourite picked in Statistics
      navigate(freshGenreSpec(genre, levelFor(genre)).url);
      return;
    }
    const diff = e.target.closest('[data-difficulty]');
    if (diff) {
      if (categoryById(store.category).themed) store.themedLevel = diff.dataset.difficulty;
      else store.difficulty = diff.dataset.difficulty;
      saveStore();
      renderGenreTabs();
      renderGenreGrid();
      return;
    }
    const cat = e.target.closest('[data-category]');
    if (cat) {
      store.category = cat.dataset.category;
      saveStore();
      renderGenreTabs();
      renderGenreGrid();
      return;
    }
    const kind = e.target.closest('[data-kind]');
    if (kind) {
      archive.kind = kind.dataset.kind;
      renderArchive();
      return;
    }

    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    switch (action) {
      case 'close-dialog': closeDialogs(); return;
      case 'gift': closeDialogs(); openGifts(); return;
      case 'arcade-start': startArcade(); return;
      case 'arcade-again': startArcade(arcadeLast && arcadeLast.mode); return;
      case 'arcade-other': navigate(`#/arcade/${otherMode(arcadeLast ? arcadeLast.mode : 'blitz')}`); return;
      case 'arcade-submit': arcadeSubmit(); return;
      case 'arcade-skip': arcadeSkip(); return;
      case 'arcade-share': shareArcade(); return;
      case 'ladder-submit': ladderSubmit(); return;
      case 'ladder-undo': ladderUndo(); return;
      case 'ladder-hint': ladderHint(); return;
      case 'ladder-restart': ladderRestart(); return;
      case 'ladder-replay': ladderAgain('replay'); return;
      case 'ladder-next': ladderAgain('practice'); return;
      case 'ladder-share': shareLadder(); return;
      case 'gift-add': addGiftRow(); return;
      case 'gift-remove': removeGiftRow(actionEl.closest('.gift-row')); return;
      case 'gift-clear': clearGift(); return;
      case 'gift-shuffle': buildGift(giftBuilt ? giftBuilt.attempt + 1 : 0); return;
      case 'gift-edit': editGift(); return;
      case 'gift-share': shareGift(); return;
      case 'gift-whatsapp': giftWhatsApp(); return;
      case 'gift-copy': if (giftBuilt) copyText(giftUrl(), 'Gift link copied'); return;
      case 'gift-try': if (giftBuilt) navigate(`#/gift/${giftBuilt.code}`); return;
      case 'privacy': closeMenus(); $('#privacy-dialog').showModal(); return;
      case 'consent-yes': setAnalytics(true); return;
      case 'consent-no': setAnalytics(false); return;
      case 'stats': navigate('#/stats'); return;
      case 'wallet': openWallet(); return;
      case 'duel-ready': case 'duel-leave': case 'duel-resign': case 'duel-rematch': case 'duel-accept':
      case 'duel-copy': case 'duel-whatsapp': case 'duel-share': case 'duel-result-share': case 'duel-quick-cancel':
        duelAction(action); return;
      case 'wallet-signin': closeDialogs(); $('#account-btn').click(); return;
      case 'install': promptInstall(); return;
      case 'install-dismiss': dismissInstall(); return;
      case 'month-prev':
      case 'month-next': {
        const [y, m] = archive.month.split('-').map(Number);
        const d = new Date(y, m - 1 + (action === 'month-next' ? 1 : -1), 1);
        archive.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        renderArchive();
        return;
      }
    }
    if (!game) return;
    switch (action) {
      case 'pause': setPaused(!game.paused); break;
      case 'resume': setPaused(false); break;
      case 'pencil':
        game.pencilMode = !game.pencilMode;
        actionEl.setAttribute('aria-pressed', String(game.pencilMode));
        toast(game.pencilMode ? 'Pencil on: new letters are tentative' : 'Pencil off');
        break;
      case 'check-cell': check('cell'); break;
      case 'check-word': check('word'); break;
      case 'check-all': check('all'); break;
      case 'toggle-autocheck': setAutocheck(!store.settings.autocheck); break;
      case 'reveal-cell': reveal('cell'); break;
      case 'reveal-word': reveal('word'); break;
      case 'reveal-all': reveal('all'); break;
      case 'clear-incorrect': clear('incorrect'); break;
      case 'clear-word': clear('word'); break;
      case 'clear-all': clear('all'); break;
      case 'next-word': if (!game.paused) { jumpWord(1, false); refresh(); focusTyping(); } break;
      case 'prev-word': if (!game.paused) { jumpWord(-1, false); refresh(); focusTyping(); } break;
      case 'share': share(); break;
      case 'room-start': startRoom(); break;
      case 'zoom': toggleZoom(); break;
      case 'clue-sheet': if (docked.matches && Date.now() - swipedAt > 400) openClueSheet(); break;
      case 'room-invite': openInvite(); break;
      case 'room-leave': leaveRoom(); break;
      case 'room-remove': removePlayer(actionEl.dataset.uid); break;
      case 'room-whatsapp': inviteWhatsApp(); break;
      case 'room-copy': copyText($('#room-link').value, 'Invite link copied'); break;
      case 'room-share': inviteShare(); break;
      case 'share-whatsapp': shareWhatsApp(); break;
      case 'share-copy': copyChallenge(); break;
      case 'share-image': saveImage(); break;
      case 'share-facebook': shareFacebook(); break;
      case 'share-x': shareX(); break;
      case 'share-more': toggleShareMore(actionEl); break;
      case 'new':
        if (game.spec.kind === 'genre') {
          closeDialogs();
          navigate(freshGenreSpec(game.spec.genre, game.spec.difficulty).url);
        }
        break;
    }
  });

  function closeDialogs() {
    $$('dialog').forEach((d) => d.open && d.close());
  }
  $$('dialog').forEach((d) =>
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    })
  );

  // Settings toggles
  $('#set-skip').addEventListener('change', (e) => { store.settings.skipFilled = e.target.checked; saveStore(); });
  $('#set-autocheck').addEventListener('change', (e) => setAutocheck(e.target.checked));
  // Auto-check stays on until it's switched off (here, in the Check menu or
  // in settings), marking wrong letters as soon as they're typed.
  function setAutocheck(on) {
    store.settings.autocheck = on;
    saveStore();
    syncAutocheckUI();
    if (game && !game.solved) {
      game.puzzle.solution.forEach((row, r) => row.forEach((ch, c) => {
        game.wrong[r][c] = on && !!ch && !!game.entries[r][c] && !game.pencil[r][c] && game.entries[r][c] !== ch;
      }));
      if (on) {
        game.autochecked = true;
        analytics.track('autocheck_on', { puzzle_kind: game.spec.kind });
        syncRoomHints();
      }
      refresh();
      persist();
    }
  }
  function syncAutocheckUI() {
    const on = store.settings.autocheck;
    $('#set-autocheck').checked = on;
    $('#check-btn').classList.toggle('on', on);
    $('#check-btn').setAttribute('aria-label', on ? 'Check (auto-check is on)' : 'Check');
    $('#autocheck-item').setAttribute('aria-checked', String(on));
    $('#autocheck-item').textContent = on ? 'Turn auto-check off' : 'Auto-check (stays on)';
  }
  $('#set-tags').addEventListener('change', (e) => {
    store.settings.showTags = e.target.checked;
    saveStore();
    if (game && !$('#game-view').hidden) { renderGame(); refresh(); }
  });
  $('#set-analytics').addEventListener('change', (e) => setAnalytics(e.target.checked));
  $('#set-vibrate').addEventListener('change', (e) => {
    store.settings.vibrate = e.target.checked;
    saveStore();
    buzz(20);
  });
  $('#set-sound').addEventListener('change', (e) => {
    store.settings.sound = e.target.checked;
    saveStore();
    sound.win();
  });
  $('#set-appkeys').addEventListener('change', (e) => {
    store.settings.appKeys = e.target.checked;
    saveStore();
    // Takes effect in the game on screen too.
    if (game && !$('#game-view').hidden) {
      setPhoneKeyboardLayout();
      updateKeys();
      if (store.settings.appKeys) typeInput.blur();
      else focusTyping();
    }
    if (arcadePlaying()) $('#arcade-keys').hidden = !appKeys();
    if (ladderPlaying()) $('#ladder-keys').hidden = !appKeys();
  });
  $('#set-timer').addEventListener('change', (e) => {
    store.settings.showTimer = e.target.checked;
    saveStore();
    $('#timer').classList.toggle('hidden-time', !store.settings.showTimer);
  });

  // ---------- Routing ----------
  // The route lives in memory and is mirrored to the URL hash when the host
  // allows it, so puzzle links can be shared on a normal web host.
  let currentRoute = location.hash || '#/';
  let routeChallenge = null; // a friend's result from a challenge link (?c=…)
  function navigate(hash) {
    currentRoute = hash;
    try {
      if (location.hash !== hash) history.pushState(null, '', hash);
    } catch (e) {
      /* sandboxed frame: keep the route in memory only */
    }
    route();
  }
  window.addEventListener('popstate', () => {
    currentRoute = location.hash || '#/';
    route();
  });

  function showView(name) {
    if (name !== 'game') typeInput.blur();
    for (const v of ['home', 'archive', 'game', 'gift', 'arcade', 'stats', 'duel']) {
      const el = $(`#${v}-view`);
      const showing = v === name;
      if (showing && el.hidden && !reduceMotion.matches) {
        el.classList.remove('enter');
        void el.offsetWidth;
        el.classList.add('enter');
      }
      el.hidden = !showing;
    }
    document.body.classList.toggle('in-game', name === 'game');
    if (name === 'game') {
      placeDock();
      setTimeout(keepActiveInView, 400); // once the view has settled
    }
    $$('.masthead-nav button').forEach((b) => b.removeAttribute('aria-current'));
    const navName = name === 'game' ? (game && game.duel ? 'arcade' : null) : name === 'duel' ? 'arcade' : name;
    const navBtn = navName && $(`.masthead-nav [data-nav="${navName}"]`);
    if (navBtn) navBtn.setAttribute('aria-current', 'page');
    if (name !== 'game') document.title = { gift: 'Gift a crossword · Crossword Hub', arcade: 'Arcade · Crossword Hub', stats: 'Statistics · Crossword Hub', duel: 'Crossword Duel · Crossword Hub' }[name] || 'Crossword Hub';
    if (name !== 'arcade') {
      arcadeTyping.blur();
      ladderTyping.blur();
      leaveArcade();
      leaveLadder();
    }
    offerConsent(name);
  }

  // Addresses that open a puzzle: #/daily/<date>, #/mini/<date>,
  // #/brutal/<date> and #/play/<genre>/<level>/<seed>/<pool or L code>.
  function isPuzzlePath(parts) {
    if (parts[0] === 'daily' || parts[0] === 'mini' || parts[0] === 'brutal') return true;
    return parts[0] === 'play' && !!genreById(parts[1]) && Number.isFinite(Number(parts[3]));
  }
  // The puzzle an address points to, or null (for example a genre link whose
  // words have since been retired). Loads frozen months or old word orders.
  async function specForPath(path) {
    const parts = path.replace(/^#\/?/, '').split('?')[0].split('/');
    if (!isPuzzlePath(parts)) return null;
    const today = todayKey();
    if (parts[0] === 'daily' || parts[0] === 'mini') {
      const date = parts[1] && validDate(parts[1]) ? parts[1] : today;
      await withTimeout(loadMonth(date.slice(0, 7)), 4000);
      return parts[0] === 'daily' ? dailySpec(date) : miniSpec(date);
    }
    if (parts[0] === 'brutal') {
      const week = weekOf(parts[1] && validDate(parts[1]) ? parts[1] : today);
      await withTimeout(loadMonth(frozenFile('brutal', week)), 4000);
      return brutalSpec(week);
    }
    const genre = genreById(parts[1]);
    const difficulty = levelsFor(genre)[parts[2]] ? parts[2] : genre.themed ? 'fan' : 'medium';
    const pool = parts[4] || '';
    if (pool && pool[0] !== 'L' && !legacyLists) legacyLists = await withTimeout(loadLegacyOrder(), 6000) || null;
    const spec = genreSpec(genre, difficulty, Number(parts[3]), pool);
    return puzzleFor(spec) ? spec : null;
  }
  // Changes the address without adding a history step.
  function replaceRoute(url) {
    currentRoute = url;
    try {
      history.replaceState(null, '', url);
    } catch (e) {
      /* sandboxed frame: keep the route in memory only */
    }
  }

  async function route() {
    const routeNow = currentRoute;
    const { path, challenge } = CrosswordShare.splitRoute(currentRoute);
    routeChallenge = challenge;
    analytics.page(CrosswordShare.pagePath(currentRoute));
    if (challenge) analytics.track('challenge_open', { page: CrosswordShare.pagePath(currentRoute) });
    const parts = path.replace(/^#\/?/, '').split('/');
    leaveGame();
    if (parts[0] !== 'duel') leaveDuel();
    const today = todayKey();
    $('#dateline').textContent = `${longDate(today)} · Today's Daily: ${scheduleFor(today).level}`;

    if (parts[0] === 'gift') {
      await openGiftRoute(parts[1] || 'new', routeNow);
      return;
    }
    if (parts[0] === 'duel') {
      await openDuelRoute(parts, routeNow);
      return;
    }
    if (parts[0] === 'arcade') {
      game = null;
      openArcade(parts[1], parts[2]);
      return;
    }
    if (parts[0] === 'room') {
      showView('game');
      window.scrollTo(0, 0);
      await openRoom(parts[1], routeNow);
      return;
    }
    if (isPuzzlePath(parts)) {
      showView('game');
      window.scrollTo(0, 0);
      const spec = await specForPath(path);
      if (currentRoute !== routeNow) return;
      if (spec) {
        startGame(spec);
        return;
      }
      const genre = genreById(parts[1]);
      toast('That puzzle used words that have since been retired. Here’s a new one.');
      navigate(freshGenreSpec(genre, levelsFor(genre)[parts[2]] ? parts[2] : levelFor(genre)).url);
      return;
    }
    // #/new/<genre>/<level>: a fresh puzzle (used by the genre pages in play/).
    if (parts[0] === 'new') {
      const genre = genreById(parts[1]);
      if (genre) {
        const level = levelsFor(genre)[parts[2]] ? parts[2] : levelFor(genre);
        replaceRoute(freshGenreSpec(genre, level).url);
        route();
        return;
      }
    }
    game = null;
    if (parts[0] === 'stats') {
      openStatsPage();
      return;
    }
    if (parts[0] === 'archive') {
      if (parts[1] === 'daily' || parts[1] === 'mini') archive.kind = parts[1];
      showView('archive');
      window.scrollTo(0, 0);
      renderArchive();
      return;
    }
    showView('home');
    renderHome();
    if (parts[0] === 'genres') {
      $('#genres').scrollIntoView();
      $$('.masthead-nav button').forEach((b) => b.removeAttribute('aria-current'));
      $('.masthead-nav [data-nav="genres"]').setAttribute('aria-current', 'page');
    }
    else window.scrollTo(0, 0);
  }

  // ---------- Arcade: Clue Blitz and Survival ----------
  // One clue at a time from the existing clue bank (see js/arcade.js for the
  // rules). Runs are saved after every move, so leaving or refreshing never
  // resets the Blitz clock, restores Survival lives or rerolls a clue. Free
  // and unlimited during testing; the daily allowances are built into
  // js/arcade.js but switched off.
  const Arcade = window.CrosswordArcade;
  let arcadePool = null;
  const arcadeBank = () => arcadePool || (arcadePool = Arcade.buildPool(GENRES));
  const arcadeData = () => (store.arcade = Object.assign({ best: {}, runs: {}, recent: [], attempts: null }, store.arcade));
  const ARCADE_MODES = {
    blitz: {
      name: 'Clue Blitz',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>',
      tagline: '60 seconds. How many clues can you crack?',
      // Ink drawings for the mode cards: a stopwatch, and a heart with a trophy.
      art: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M27 4h10v6H27z" fill="#e3b64c" stroke="#2a241c" stroke-width="2.4"/><path d="M48 12l5-5 4 4-5 5" fill="#e3b64c" stroke="#2a241c" stroke-width="2.4" stroke-linejoin="round"/><circle cx="32" cy="36" r="23" fill="#fbf5e6" stroke="#2a241c" stroke-width="3"/><circle cx="32" cy="36" r="18" fill="none" stroke="#2a241c" stroke-width="1.2" stroke-dasharray="1.5 7.9"/><path d="M34 18L24 38h8l-2 16 11-21h-8z" fill="#e3b64c" stroke="#2a241c" stroke-width="2.2" stroke-linejoin="round"/></svg>',
      rules: [
        'One clue at a time, mostly easy and medium.',
        '100 points for each correct answer.',
        'From your third correct answer in a row, each one earns 25 bonus points.',
        'Skip whenever you like: it’s free, but it ends your combo. So does a wrong answer.',
        'The clock keeps running once you start, even if you leave the page.',
        'One game a day: a new one unlocks at midnight South African time.',
      ],
    },
    survival: {
      name: 'Survival',
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></svg>',
      tagline: 'Three lives. The clues get harder. How far can you go?',
      art: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M30 56S6 41 6 22a13 13 0 0124-7 13 13 0 0124 7c0 4-1 8-3 11" fill="#da6a4f" stroke="#2a241c" stroke-width="3" stroke-linejoin="round"/><path d="M14 20a7 7 0 016-6" fill="none" stroke="#f7efdc" stroke-width="2.4" stroke-linecap="round"/><g transform="translate(36 30)"><path d="M4 2h18v8c0 6-4 10-9 10S4 16 4 10z" fill="#e3b64c" stroke="#2a241c" stroke-width="2.2"/><path d="M4 5H0c0 5 3 8 6 8M22 5h4c0 5-3 8-6 8" fill="none" stroke="#2a241c" stroke-width="2"/><path d="M10 20h6v4h-6zM6 24h14v5H6z" fill="#2f5a43" stroke="#2a241c" stroke-width="2"/></g></svg>',
      rules: [
        'Rounds 1–5 are Easy, 6–12 Medium, 13–20 Hard, then Expert and tougher still.',
        'A wrong answer or a skip costs a life.',
        'Typing is never a mistake: only Submit counts.',
        'Leave whenever you like: your run waits for you until midnight South African time.',
        'One run a day: a new one unlocks at midnight South African time.',
      ],
    },
  };
  const LEVEL_LABEL = Arcade.LEVEL_LABEL;
  const STOPWATCH = '<svg class="stopwatch" viewBox="0 0 40 40" aria-hidden="true"><path d="M17 3h6M20 3v5M31 9l3-3" /><circle cx="20" cy="23" r="14" /><path d="M20 23V14" /></svg>';
  let arcade = null; // the run on screen: { mode, run, guess, timer, busy }
  let arcadeLast = null; // the last finished run, for the results screen
  const arcadePlaying = () => !!(arcade && arcade.run && !$('#arcade-play').hidden);

  // The daily allowance: one Blitz and one Survival a day (js/arcade.js).
  const arcadeAllowed = (mode) => Arcade.canStart(mode, arcadeData().attempts, todayKey()).allowed;
  const untilNextGame = () => {
    const mins = Math.max(1, Math.ceil(CrosswordShare.msUntilNextDay(now()) / 60000));
    return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  };
  const otherMode = (mode) => (mode === 'blitz' ? 'survival' : 'blitz');
  const liveRun = (mode) => {
    const run = arcadeData().runs[mode];
    return run && !run.finished ? run : null;
  };

  function arcadeBestLine(mode) {
    const best = arcadeData().best[mode];
    if (!best) return 'No personal best yet.';
    return mode === 'blitz'
      ? `Personal best: ${best.score.toLocaleString()} points (${plural(best.correct, 'correct answer')}).`
      : `Personal best: round ${best.round}, ${best.score.toLocaleString()} points.`;
  }
  // The Arcade cards: Clue Blitz, Survival and Word Ladder, each with the
  // player's progress.
  function arcadeCardStatus(mode) {
    if (mode === 'ladder') {
      const rec = ladderData();
      const done = rec.daily[todayKey()];
      const sum = CrosswordLadder.summary(rec, todayKey());
      const live = rec.games.daily && rec.games.daily.day === todayKey() && !rec.games.daily.done;
      return {
        line: done ? `Today’s ladder done in ${plural(done.moves, 'move')}${sum.streak > 1 ? ` · ${sum.streak}-day streak` : ''}`
          : live ? `Today’s ladder in progress · ${plural(rec.games.daily.steps.length - 1, 'move')}`
          : sum.completed ? `Today’s ladder is ready · ${plural(sum.completed, 'ladder')} climbed` : 'A new Daily Ladder every day · practise as much as you like',
        live, go: done ? 'Practise' : live ? 'Resume' : 'Play', done: false,
      };
    }
    const runs = arcadeData().runs;
    const live = runs[mode] && !runs[mode].finished;
    const played = !live && !arcadeAllowed(mode);
    const best = arcadeData().best[mode];
    const bestLine = best ? (mode === 'blitz' ? `Best: ${best.score.toLocaleString()} points` : `Best: round ${best.round}`) : 'No personal best yet';
    return {
      line: live ? (mode === 'survival' ? `Run in progress: round ${runs.survival.round}` : 'Run in progress')
        : played ? `Played today · next game in ${untilNextGame()}`
        : `${bestLine} · one game a day`,
      live, go: live ? 'Resume' : played ? 'Done' : 'Play', done: played,
    };
  }
  function renderArcadeCards(el) {
    if (!el) return;
    el.innerHTML = ['blitz', 'survival', 'ladder'].map((mode) => {
      const m = mode === 'ladder' ? LADDER_CARD : ARCADE_MODES[mode];
      const st = arcadeCardStatus(mode);
      return `<button class="arcade-mode arcade-${mode}" data-open="#/arcade/${mode}">
        <span class="arcade-art">${m.art}</span>
        <span class="arcade-mode-copy">
          <span class="arcade-mode-name">${esc(m.name)}</span>
          <span class="arcade-mode-tag">${esc(m.tagline)}</span>
          <span class="arcade-mode-best${st.live ? ' live' : ''}">${esc(st.line)}</span>
        </span>
        <span class="arcade-mode-go${st.done ? ' done' : ''}" aria-hidden="true">${st.go}</span>
      </button>`;
    }).join('');
  }

  function arcadeScreen(which) {
    if (which !== 'play') arcadeTyping.blur();
    if (which !== 'ladder-play') ladderTyping.blur();
    for (const id of ['hub', 'start', 'play', 'results']) $(`#arcade-${id}`).hidden = id !== which;
    for (const id of ['home', 'play', 'done']) $(`#ladder-${id}`).hidden = `ladder-${id}` !== which;
    document.body.classList.toggle('arcade-playing', which === 'play' || which === 'ladder-play');
    if (which !== 'ladder-play') leaveLadder();
  }

  // #/arcade, #/arcade/blitz and #/arcade/survival. A run in progress is
  // picked up where it was; one that ended while away shows its result.
  function openArcade(mode, sub) {
    showView('arcade');
    window.scrollTo(0, 0);
    if (mode === 'ladder') {
      openLadder(sub);
      return;
    }
    if (!ARCADE_MODES[mode]) {
      if (mode) replaceRoute('#/arcade');
      renderArcadeCards($('#arcade-hub-cards'));
      renderDuelCards($('#duel-hub-cards'));
      arcadeScreen('hub');
      return;
    }
    const run = arcadeData().runs[mode];
    if (run && !run.finished) {
      if (Arcade.finish(run, now(), todayKey())) endArcade(mode, run);
      else playArcade(mode, run, true);
      return;
    }
    showArcadeStart(mode);
  }

  function showArcadeStart(mode) {
    const m = ARCADE_MODES[mode];
    arcade = { mode };
    $('#arcade-start').dataset.mode = mode;
    $('#arcade-start').className = `arcade-start arcade-${mode}`;
    $('#arcade-start-badge').innerHTML = m.art;
    $('#arcade-start-title').textContent = m.name;
    $('#arcade-start-tagline').textContent = m.tagline;
    $('#arcade-start-rules').innerHTML = m.rules.map((r) => `<li>${esc(r)}</li>`).join('');
    $('#arcade-start-best').textContent = arcadeBestLine(mode);
    const allowed = arcadeAllowed(mode);
    $('#arcade-go').hidden = !allowed;
    $('#arcade-start-next').hidden = allowed;
    if (!allowed) {
      const other = otherMode(mode);
      $('#arcade-start-next').innerHTML = `You’ve played today’s ${esc(m.name)}. The next one unlocks in <b>${untilNextGame()}</b>, at midnight South African time.${
        arcadeAllowed(other) || liveRun(other) ? ` <button class="link-btn" data-open="#/arcade/${other}">Play ${esc(ARCADE_MODES[other].name)} instead →</button>` : ''}`;
    }
    arcadeScreen('start');
  }

  // Starts a run. It counts as an attempt only once its first clue is on
  // screen, so a failure before that (or opening and leaving the page)
  // never uses one up.
  function startArcade(mode = arcade && arcade.mode) {
    if (!ARCADE_MODES[mode]) return;
    const data = arcadeData();
    const existing = data.runs[mode];
    if (existing && !existing.finished && !Arcade.finish(existing, now(), todayKey())) return playArcade(mode, existing, true);
    const allowed = Arcade.canStart(mode, data.attempts, todayKey()); // always allowed while testing
    if (!allowed.allowed) {
      toast(`You’ve played today’s ${ARCADE_MODES[mode].name}. Next game in ${untilNextGame()}.`);
      return showArcadeStart(mode);
    }
    let run;
    try {
      run = Arcade.newRun(mode, arcadeBank(), { seed: Math.floor(Math.random() * 2 ** 31), now: now(), day: todayKey(), recent: data.recent });
      playArcade(mode, run, false);
    } catch (e) {
      arcadeScreen('start');
      toast('The game couldn’t start. Please try again.');
      return;
    }
    data.runs[mode] = run;
    data.attempts = Arcade.recordAttempt(data.attempts, mode, todayKey());
    saveStore();
    analytics.track('arcade_start', { mode });
  }

  function playArcade(mode, run, resumed) {
    leaveArcadeTimer();
    arcade = { mode, run, guess: '', busy: false, timer: null };
    $('#arcade-play').className = `arcade-play arcade-${mode}`;
    $('#arcade-keys').hidden = !appKeys();
    $('#arcade-skip').textContent = mode === 'survival' ? 'Skip (−1 life)' : 'Skip';
    arcadeScreen('play');
    window.scrollTo(0, 0);
    renderArcadeClue();
    renderArcadeHud();
    arcadeTyping.focus($('#arcade-boxes'));
    if (resumed) arcadeFeedback(mode === 'survival' ? `Welcome back: round ${run.round}.` : 'Welcome back: the clock kept running.', 'info');
    if (mode === 'blitz') arcade.timer = setInterval(arcadeTick, 200);
  }
  function leaveArcadeTimer() {
    if (arcade && arcade.timer) clearInterval(arcade.timer);
  }
  // Leaving the Arcade (another page): the run stays saved.
  function leaveArcade() {
    leaveArcadeTimer();
    arcade = null;
    document.body.classList.remove('arcade-playing');
  }

  function arcadeTick() {
    if (!arcade || !arcade.run) return;
    const { run } = arcade;
    if (Arcade.finish(run, now(), todayKey())) return endArcade(arcade.mode, run);
    renderArcadeHud();
  }

  function renderArcadeHud() {
    const { mode, run } = arcade;
    if (mode === 'blitz') {
      const left = Math.ceil(Arcade.timeLeft(run, now()) / 1000);
      // The last five seconds tick.
      if (left > 0 && left <= 5 && arcade.lastTick !== left) sound.tick();
      arcade.lastTick = left;
      const bonus = run.combo + 1 >= Arcade.BLITZ.comboFrom;
      $('#arcade-hud').innerHTML = `
        <div class="hud-item hud-time${left <= 10 ? ' low' : ''}">${STOPWATCH}<b>${left}</b><span>seconds</span></div>
        <div class="hud-item"><b class="pencil-mark">${run.score.toLocaleString()}</b><span>points</span></div>
        <div class="hud-item hud-combo${run.combo >= 2 ? ' hot' : ''}"><b class="pencil-mark">×${run.combo}</b><span>${bonus ? 'combo: +25 next' : 'combo'}</span></div>
        <div class="hud-bar" aria-hidden="true"><i style="width:${(100 * Arcade.timeLeft(run, now())) / (Arcade.BLITZ.seconds * 1000)}%"></i></div>`;
    } else {
      // An old-fashioned score sheet: the last few rounds (never the answers).
      const lives = Array.from({ length: Arcade.SURVIVAL.lives }, (_, i) => `<span class="life${i < run.lives ? '' : ' lost'}">${ARCADE_MODES.survival.icon}</span>`).join('');
      const lines = (run.sheet || []).slice(-3).map((l) => `<tr>
          <td>${l.round}</td><td>${esc(LEVEL_LABEL[l.level] || l.level)}</td>
          <td class="pencil-mark ${l.ok ? 'ok' : 'miss'}"><span aria-hidden="true">${l.ok ? '✓' : '✗'}</span><span class="visually-hidden">${l.ok ? 'correct' : 'missed'}</span></td>
          <td class="pencil-mark">${l.ok ? l.points : '–'}</td></tr>`).join('');
      $('#arcade-hud').innerHTML = `
        <div class="score-sheet">
          <div class="sheet-head"><span>Official score sheet</span><span class="hud-lives" role="img" aria-label="${plural(run.lives, 'life')} left">${lives}</span></div>
          ${lines ? `<table><thead><tr><th scope="col">Rd</th><th scope="col">Level</th><th scope="col">✓/✗</th><th scope="col">Pts</th></tr></thead><tbody>${lines}</tbody></table>` : ''}
          <div class="sheet-foot"><span>Round ${run.round} · ${esc(LEVEL_LABEL[run.clue.level] || '')}</span><b class="pencil-mark">Total ${run.score.toLocaleString()}</b></div>
        </div>`;
    }
  }

  function renderArcadeClue() {
    const { run } = arcade;
    const { clue } = run;
    $('#arcade-meta').textContent = `${run.mode === 'survival' ? `${LEVEL_LABEL[clue.level]} · ` : ''}${clue.source}`;
    $('#arcade-clue').textContent = clue.clue;
    arcade.guess = '';
    renderArcadeBoxes();
  }
  function renderArcadeBoxes(reveal, clue = arcade.run.clue) {
    const shown = reveal || arcade.guess;
    let i = 0;
    $('#arcade-boxes').innerHTML = clue.lengths.map((len) => `<span class="arcade-word">${
      Array.from({ length: len }, () => {
        const ch = shown[i] || '';
        const cls = i === arcade.guess.length && !reveal ? ' current' : '';
        i++;
        return `<span class="arcade-box${cls}${reveal ? ' revealed' : ''}">${esc(ch)}</span>`;
      }).join('')
    }</span>`).join('');
    fitArcadeBoxes(clue);
    $('#arcade-boxes').setAttribute('aria-label', `Your answer, ${clue.answer.length} letters${clue.lengths.length > 1 ? ` (${clue.lengths.join(', ')})` : ''}: ${arcade.guess || 'empty'}`);
  }
  // Box size from the space available and the longest word, so long
  // answers (up to 15 letters) fit on the narrowest phones.
  function fitArcadeBoxes(clue = arcade && arcade.run && arcade.run.clue) {
    if (!clue) return;
    const wrap = $('#arcade-boxes');
    const longest = Math.max(...clue.lengths);
    const gap = longest > 10 ? 2 : 4;
    const avail = wrap.clientWidth || 300;
    const size = Math.max(14, Math.min(40, Math.floor((avail - gap * (longest - 1)) / longest)));
    wrap.style.setProperty('--box', `${size}px`);
    wrap.style.setProperty('--box-gap', `${gap}px`);
  }
  window.addEventListener('resize', () => fitArcadeBoxes());

  function arcadeFeedback(text, kind) {
    const el = $('#arcade-feedback');
    el.textContent = text;
    el.className = `arcade-feedback ${kind || ''}`;
  }

  function arcadeType(ch) {
    if (!arcadePlaying() || arcade.busy) return;
    const len = arcade.run.clue.answer.length;
    if (arcade.guess.length >= len) return;
    sound.tap();
    arcade.guess += ch;
    arcadeFeedback('');
    renderArcadeBoxes();
    // A full, correct answer counts straight away; a wrong one waits for Submit.
    if (arcade.guess.length === len && arcade.guess === arcade.run.clue.answer) arcadeSubmit();
  }
  function arcadeBack() {
    if (!arcadePlaying() || arcade.busy || !arcade.guess) return;
    arcade.guess = arcade.guess.slice(0, -1);
    renderArcadeBoxes();
  }

  function arcadeSubmit() {
    if (!arcadePlaying() || arcade.busy) return;
    const { mode, run } = arcade;
    const clue = run.clue;
    const res = Arcade.submit(run, arcadeBank(), arcade.guess, now(), todayKey());
    arcadeOutcome(mode, run, res, clue);
  }
  function arcadeSkip() {
    if (!arcadePlaying() || arcade.busy) return;
    const { mode, run } = arcade;
    const clue = run.clue;
    arcadeOutcome(mode, run, Arcade.skip(run, arcadeBank(), now(), todayKey()), clue);
  }
  // `clue` is the clue that was answered (the run has moved on by now).
  function arcadeOutcome(mode, run, res, clue) {
    if (res.result === 'over') return endArcade(mode, run);
    if (res.result === 'empty' || res.result === 'incomplete') {
      arcadeFeedback(res.result === 'empty' ? 'Type your answer first.' : 'Fill every box, then submit.', 'info');
      return;
    }
    arcadeData().runs[mode] = run; // (a sync may have replaced the saved copy)
    saveStore(); // after every move, so a refresh carries on from here
    if (res.result === 'correct') {
      buzz(15);
      arcadeFeedback(`Correct! +${res.points}`, 'good');
      renderArcadeClue();
      renderArcadeHud();
      return;
    }
    if (mode === 'blitz') {
      if (res.result === 'wrong') {
        arcadeFeedback('Not quite. Try again or skip.', 'bad');
        arcade.guess = '';
        renderArcadeBoxes();
        shake($('#arcade-boxes'));
      } else {
        arcadeFeedback('Skipped.', 'info');
        renderArcadeClue();
      }
      renderArcadeHud();
      return;
    }
    // Survival: a moment to register the lost life, then the next round (or
    // the end). The answer isn't revealed.
    buzz([30, 40, 30]);
    arcade.busy = true;
    shake($('#arcade-boxes'));
    arcadeFeedback(res.result === 'skipped' ? 'Skipped: one life gone.' : 'Not quite: one life gone.', 'bad');
    renderArcadeHud();
    setTimeout(() => {
      if (!arcade || arcade.run !== run) return;
      arcade.busy = false;
      if (res.over) return endArcade(mode, run);
      renderArcadeClue();
    }, 1100);
  }
  function shake(el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  // A finished run: personal best, recently seen answers, the results screen.
  function endArcade(mode, run) {
    leaveArcadeTimer();
    Arcade.finish(run, now(), todayKey());
    if (!run.finished) run.finished = true;
    const data = arcadeData();
    const { best, isNew } = Arcade.updateBest(data.best, run);
    data.best = best;
    data.recent = Arcade.remember(data.recent, run);
    if (data.runs[mode] === run || (data.runs[mode] && data.runs[mode].startedAt === run.startedAt)) delete data.runs[mode];
    arcadeLast = { mode, run, isNew };
    (isNew ? sound.win : sound.over)();
    saveStore();
    analytics.track('arcade_end', { mode, score: run.score, correct: run.correct, round: mode === 'survival' ? Arcade.roundReached(run) : 0 });
    showArcadeResults();
  }

  function showArcadeResults() {
    const { mode, run, isNew } = arcadeLast;
    arcade = { mode };
    $('#arcade-results').className = `arcade-results arcade-${mode}`;
    $('#arcade-results-kicker').textContent = ARCADE_MODES[mode].name;
    $('#arcade-results-title').textContent = mode === 'blitz' ? 'Time’s up!' : run.endedBy === 'reset' ? 'Run ended at midnight' : 'Game over';
    $('#arcade-results-score').textContent = `${run.score.toLocaleString()} points`;
    $('#arcade-results-pb').hidden = !isNew;
    // One game of each a day: point to the other mode, or to tomorrow.
    const other = otherMode(mode);
    const again = arcadeAllowed(mode);
    const otherOpen = arcadeAllowed(other) || !!liveRun(other);
    $('#arcade-again').hidden = !again;
    $('#arcade-other').hidden = again || !otherOpen;
    $('#arcade-other').textContent = `${liveRun(other) ? 'Resume' : 'Play'} ${ARCADE_MODES[other].name}`;
    $('#arcade-results-next').hidden = again;
    $('#arcade-results-next').textContent = `That’s today’s ${ARCADE_MODES[mode].name}. The next one unlocks in ${untilNextGame()}, at midnight South African time.`;
    const best = arcadeData().best[mode];
    const stat = (n, label) => `<div><b>${n}</b><span>${esc(label)}</span></div>`;
    $('#arcade-results-stats').innerHTML = mode === 'blitz'
      ? stat(run.correct, 'Correct') + stat(`×${run.bestCombo}`, 'Best combo') + stat(run.skips, 'Skipped') + stat(best ? best.score.toLocaleString() : 0, 'Personal best')
      : stat(Arcade.roundReached(run), 'Round reached') + stat(run.correct, 'Correct') + stat(best ? best.round : 0, 'Best round') + stat(best ? best.score.toLocaleString() : 0, 'Best score');
    $('#arcade-recap').hidden = !run.log.some((l) => l.ok);
    $('#arcade-recap').open = false;
    $('#arcade-recap-list').innerHTML = run.log.filter((l) => l.ok).map((l) => `<li class="ok"><b>${esc(l.answer)}</b> <span>${esc(l.clue)}</span></li>`).join('');
    arcadeScreen('results');
    window.scrollTo(0, 0);
  }

  function shareArcade() {
    if (!arcadeLast) return;
    const { mode, run } = arcadeLast;
    const what = mode === 'blitz'
      ? `${run.score.toLocaleString()} points in 60 seconds (${plural(run.correct, 'correct answer')})`
      : `round ${Arcade.roundReached(run)} with ${run.score.toLocaleString()} points`;
    const text = `Crossword Hub Arcade · ${ARCADE_MODES[mode].name}: ${what}. Can you beat it?`;
    const url = canLink() ? `${siteUrl()}#/arcade/${mode}` : '';
    analytics.track('share', { method: navigator.share ? 'native' : 'copy_link', content_type: `arcade_${mode}` });
    if (navigator.share) {
      navigator.share({ text, url: url || undefined }).catch(() => {});
      return;
    }
    copyText(url ? `${text} ${url}` : text, 'Result copied to your clipboard');
  }

  // Typing on phones and tablets: the device's own keyboard, through a
  // hidden text box (as for the crosswords). It always holds one placeholder
  // character, so deleting it means Backspace. Returns { focus, blur }.
  function deviceTyping(input, { active, type, back, enter }) {
    let held = PLACEHOLDER;
    const reset = () => {
      input.value = held = PLACEHOLDER;
      try { input.setSelectionRange(1, 1); } catch (e) { /* not focused */ }
    };
    input.addEventListener('input', (e) => {
      const value = input.value;
      const before = held;
      held = value;
      if (!active()) return reset();
      if (value.length < before.length && before.startsWith(value)) {
        for (let i = value.length; i < before.length; i++) back();
      } else {
        const added = value.startsWith(before) ? value.slice(before.length) : (e.data || '');
        for (const ch of added.toUpperCase().replace(/[^A-Z]/g, '')) type(ch);
      }
      if (!e.isComposing) reset();
    });
    input.addEventListener('compositionend', () => setTimeout(reset));
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      enter();
    });
    // The buttons beside the answer shouldn't close the keyboard.
    input.closest('section').addEventListener('pointerdown', (e) => {
      if (document.activeElement === input && e.target.closest('button:not([data-open])')) e.preventDefault();
    });
    return {
      // Opens the keyboard, with the text box over `anchor` so the page
      // keeps it in view.
      focus(anchor) {
        if (!touchDevice() || appKeys()) return;
        if (anchor) input.style.top = `${anchor.getBoundingClientRect().top - input.offsetParent.getBoundingClientRect().top}px`;
        reset();
        input.focus();
      },
      blur() {
        if (document.activeElement === input) input.blur();
      },
      // Keeps the text box over `anchor` while typing (so it stays in view).
      follow(anchor) {
        if (anchor && document.activeElement === input) input.style.top = `${anchor.getBoundingClientRect().top - input.offsetParent.getBoundingClientRect().top}px`;
      },
    };
  }
  const arcadeTyping = deviceTyping($('#arcade-type'), {
    active: () => arcadePlaying(), type: (ch) => arcadeType(ch), back: () => arcadeBack(), enter: () => arcadeSubmit(),
  });
  $('#arcade-play').addEventListener('click', (e) => {
    if (e.target.closest('#arcade-boxes, .arcade-card')) arcadeTyping.focus($('#arcade-boxes'));
  });

  // On-screen letter keys (if chosen in Settings) and the keyboard.
  const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  $('#arcade-keys').innerHTML = KEY_ROWS.map((row, i) => `<div class="keys-row">${
    row.split('').map((k) => `<button type="button" data-arcade-key="${k}">${k}</button>`).join('')
  }${i === 2 ? '<button type="button" class="key-wide" data-arcade-key="back" aria-label="Delete">⌫</button>' : ''}</div>`).join('');
  $('#arcade-keys').addEventListener('pointerdown', (e) => e.preventDefault());
  $('#arcade-keys').addEventListener('click', (e) => {
    const key = e.target.closest('[data-arcade-key]');
    if (!key) return;
    if (key.dataset.arcadeKey === 'back') arcadeBack();
    else arcadeType(key.dataset.arcadeKey);
  });
  document.addEventListener('keydown', (e) => {
    if (!arcadePlaying() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches && e.target.matches('input, textarea')) return;
    if (/^[a-z]$/i.test(e.key)) arcadeType(e.key.toUpperCase());
    else if (e.key === 'Backspace') arcadeBack();
    else if (e.key === 'Enter') arcadeSubmit();
    else return;
    e.preventDefault();
  });

  // ---------- Arcade: Word Ladder ----------
  // Change one letter at a time from the start word to the target (rules in
  // js/ladder.js). #/arcade/ladder, #/arcade/ladder/daily and
  // #/arcade/ladder/practice. Games are saved after every move; the clock
  // only runs while the game is on screen.
  const Ladder = window.CrosswordLadder;
  const LADDER_CARD = {
    name: 'Word Ladder',
    tagline: 'Change one letter at a time to reach the target word.',
    // Ink drawing: a ladder of letter tiles.
    art: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 4v56M50 4v56" stroke="#2a241c" stroke-width="3" stroke-linecap="round"/><g stroke="#2a241c" stroke-width="2.2"><rect x="9" y="7" width="15" height="15" rx="2" fill="#fbf5e6"/><rect x="25" y="7" width="15" height="15" rx="2" fill="#fbf5e6"/><rect x="25" y="25" width="15" height="15" rx="2" fill="#e3b64c"/><rect x="41" y="25" width="15" height="15" rx="2" fill="#fbf5e6"/><rect x="9" y="43" width="15" height="15" rx="2" fill="#fbf5e6"/><rect x="25" y="43" width="15" height="15" rx="2" fill="#7fa98a"/></g><g fill="#2a241c" font-family="Georgia,serif" font-weight="700" font-size="11" text-anchor="middle"><text x="16.5" y="18.5">C</text><text x="32.5" y="18.5">O</text><text x="32.5" y="36.5">A</text><text x="48.5" y="36.5">R</text><text x="16.5" y="54.5">W</text><text x="32.5" y="54.5">A</text></g></svg>',
  };
  const LADDER_REASON = {
    empty: 'Type a word first.',
    length: 'Use every box: the word length stays the same.',
    same: 'That’s the word you’re on: change one letter.',
    letters: 'Change just one letter at a time.',
    word: 'We don’t know that word. Try another.',
    used: 'You’ve used that word already on this ladder.',
  };
  let ladderLib = null;
  let ladderLoad = null;
  function loadLadder() {
    if (ladderLib) return Promise.resolve(ladderLib);
    if (!ladderLoad) {
      ladderLoad = fetch('puzzles/ladder.json')
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('missing'))))
        .then((data) => (ladderLib = Ladder.parse(data)))
        .catch((e) => {
          ladderLoad = null; // try again next time (e.g. offline)
          throw e;
        });
    }
    return ladderLoad;
  }
  const ladderData = () => (store.ladder = Ladder.record(store.ladder));
  let ladder = null; // the game on screen: { game, guess, timer, busy }
  const ladderPlaying = () => !!(ladder && ladder.game && !$('#ladder-play').hidden);
  let ladderLast = null; // the last finished game, for the done screen

  async function openLadder(sub) {
    if (!ladderLib) {
      $('#ladder-modes').innerHTML = '<p class="ladder-loading">Setting out the letter tiles…</p>';
      $('#ladder-home-badge').innerHTML = LADDER_CARD.art;
      arcadeScreen('ladder-home');
    }
    try {
      await loadLadder();
    } catch (e) {
      arcadeScreen('ladder-home');
      $('#ladder-modes').innerHTML = '<p class="arcade-next">Word Ladder couldn’t load. Check your connection and try again.</p>';
      return;
    }
    if (!currentRoute.startsWith('#/arcade/ladder')) return; // navigated away meanwhile
    const rec = ladderData();
    const today = todayKey();
    if (sub === 'daily' || sub === 'practice') {
      let saved = rec.games[sub];
      if (saved && (saved.done || (sub === 'daily' && saved.day !== today) || !Ladder.ladderById(ladderLib, saved.id))) {
        delete rec.games[sub];
        saved = null;
      }
      if (saved) return playLadder(saved, true);
      if (sub === 'daily') {
        const replay = !!rec.daily[today];
        return playLadder(Ladder.newGame(Ladder.dailyLadder(ladderLib, today), 'daily', { day: today, now: now(), replay }), false);
      }
      return playLadder(Ladder.newGame(Ladder.practiceLadder(ladderLib, rec.practice.done, rec.practice.recent), 'practice', { day: today, now: now() }), false);
    }
    if (sub) replaceRoute('#/arcade/ladder');
    showLadderHome();
  }

  function showLadderHome() {
    const rec = ladderData();
    const today = todayKey();
    const daily = Ladder.dailyLadder(ladderLib, today);
    const done = rec.daily[today];
    const sum = Ladder.summary(rec, today);
    const live = (mode) => rec.games[mode] && !rec.games[mode].done && (mode !== 'daily' || rec.games.daily.day === today);
    const nextLevel = Ladder.LEVEL_LABEL[Ladder.practiceLevel(rec.practice.done)];
    $('#ladder-home-badge').innerHTML = LADDER_CARD.art;
    $('#ladder-modes').innerHTML = `
      <button class="ladder-mode ladder-daily" data-open="#/arcade/ladder/daily">
        <span class="kicker">Daily Ladder · ${esc(shortDate(today).replace(/, \d{4}$/, ''))}</span>
        <span class="ladder-mode-words">${esc(daily.from.toUpperCase())} <span aria-hidden="true">→</span><span class="visually-hidden">to</span> ${esc(daily.to.toUpperCase())}</span>
        <span class="ladder-mode-line">${done
          ? `Done in ${plural(done.moves, 'move')} (par ${done.par}), ${formatTime(done.time / 1000)} · ${done.score} points`
          : live('daily') ? `In progress · ${plural(rec.games.daily.steps.length - 1, 'move')} so far` : `${Ladder.LEVEL_LABEL[daily.level]} · par ${daily.par} · same for everyone today`}</span>
        <span class="ladder-mode-line">${sum.streak ? `Daily Ladder streak: ${sum.streak}` : 'Start a Daily Ladder streak today'}</span>
        <span class="arcade-mode-go" aria-hidden="true">${done ? 'Play again' : live('daily') ? 'Resume' : 'Play'}</span>
      </button>
      <button class="ladder-mode ladder-practice" data-open="#/arcade/ladder/practice">
        <span class="kicker">Practice</span>
        <span class="ladder-mode-words">Unlimited ladders</span>
        <span class="ladder-mode-line">${live('practice') ? 'A ladder in progress' : `Next up: ${esc(nextLevel)}`} · ${plural(rec.practice.done, 'ladder')} climbed</span>
        <span class="ladder-mode-line">${rec.practice.bestTime != null ? `Best time ${formatTime(rec.practice.bestTime / 1000)} · fewest moves ${rec.practice.fewest}` : 'Gets harder as you go'}</span>
        <span class="arcade-mode-go" aria-hidden="true">${live('practice') ? 'Resume' : 'Play'}</span>
      </button>`;
    arcadeScreen('ladder-home');
  }

  function playLadder(game, resumed) {
    leaveLadder();
    const rec = ladderData();
    rec.games[game.mode] = game;
    Ladder.resume(game, now());
    ladder = { game, guess: '', busy: false, timer: setInterval(ladderTick, 500) };
    saveStore();
    if (!resumed) analytics.track('arcade_start', { mode: `ladder_${game.mode}` });
    $('#ladder-keys').hidden = !appKeys();
    $('#ladder-play-title').textContent = game.mode === 'daily' ? (game.replay ? 'Daily Ladder (replay)' : 'Daily Ladder') : 'Practice ladder';
    arcadeScreen('ladder-play');
    window.scrollTo(0, 0);
    ladderFeedback(resumed ? 'Welcome back: carry on from where you were.' : `Change one letter at a time to turn ${game.from.toUpperCase()} into ${game.to.toUpperCase()}.`, 'info');
    renderLadder();
    ladderTyping.focus($('#ladder-rungs .entry'));
  }
  // Leaving the ladder screen: the game stays saved, and its clock stops.
  function leaveLadder() {
    if (!ladder) return;
    clearInterval(ladder.timer);
    if (ladder.game && !ladder.game.done) {
      Ladder.pause(ladder.game, now());
      saveStore();
    }
    ladder = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (!ladderPlaying()) return;
    if (document.hidden) Ladder.pause(ladder.game, now());
    else Ladder.resume(ladder.game, now());
    saveStore();
  });
  function ladderTick() {
    if (!ladderPlaying()) return;
    $('#ladder-clock').textContent = formatTime(Ladder.timeOf(ladder.game, now()) / 1000);
  }

  // The ladder: every word so far (the changed letter marked), the row being
  // typed, then the target at the foot.
  const rung = (word, prev, cls = '') => `<li class="rung ${cls}"><span class="rung-word">${word.split('').map((ch, i) =>
    `<span class="tile${prev && prev[i] !== ch ? ' changed' : ''}">${esc(ch.toUpperCase())}</span>`).join('')}</span></li>`;
  function renderLadder() {
    const { game, guess } = ladder;
    if (game.done) {
      $('#ladder-rungs').innerHTML = game.steps.map((w, i) => rung(w, game.steps[i - 1], i === 0 ? 'start' : i === game.steps.length - 1 ? 'target' : '')).join('');
      return;
    }
    const cur = Ladder.current(game);
    const steps = game.steps.map((w, i) => rung(w, game.steps[i - 1], i === 0 ? 'start' : '')).join('');
    const entry = `<li class="rung entry" aria-label="Your next word: ${esc(guess.toUpperCase() || 'empty')}"><span class="rung-word">${cur.split('').map((ch, i) =>
      `<span class="tile entry-tile${i === guess.length ? ' current' : ''}${guess[i] ? ' typed' : ''}">${esc((guess[i] || ch).toUpperCase())}</span>`).join('')}</span></li>`;
    const gap = Math.max(0, game.par - Ladder.moves(game) - 1);
    $('#ladder-rungs').innerHTML = steps + entry
      + (gap ? `<li class="rung gap" aria-hidden="true"><span>${'· '.repeat(Math.min(gap, 5)).trim()}</span></li>` : '')
      + rung(game.to, null, 'target').replace('class="rung target"', 'class="rung target" aria-label="Target"');
    $('#ladder-meta').innerHTML = `<span>${esc(Ladder.LEVEL_LABEL[game.level])}</span><span>Moves <b>${Ladder.moves(game)}</b></span><span>Par <b>${game.par}</b></span>${game.hints ? `<span>Hints <b>${game.hints}</b></span>` : ''}`;
    $('#ladder-undo').disabled = game.steps.length < 2 && !guess;
    $('#ladder-undo').textContent = guess ? 'Clear' : 'Step back';
    ladderTick();
    fitLadderTiles();
    ladderTyping.follow($('#ladder-rungs .entry'));
  }
  function fitLadderTiles() {
    const el = $('#ladder-rungs');
    if (!el || !ladder) return;
    const n = ladder.game.from.length;
    const size = Math.max(34, Math.min(52, Math.floor(((el.clientWidth || 320) - 6 * (n - 1)) / n)));
    el.style.setProperty('--tile', `${size}px`);
  }
  window.addEventListener('resize', fitLadderTiles);

  function ladderFeedback(text, kind) {
    const el = $('#ladder-feedback');
    el.textContent = text;
    el.className = `arcade-feedback ${kind || ''}`;
  }
  function ladderType(ch) {
    if (!ladderPlaying() || ladder.busy) return;
    if (ladder.guess.length >= ladder.game.from.length) return;
    sound.tap();
    ladder.guess += ch.toLowerCase();
    ladderFeedback('');
    renderLadder();
  }
  function ladderBack() {
    if (!ladderPlaying() || ladder.busy || !ladder.guess) return;
    ladder.guess = ladder.guess.slice(0, -1);
    renderLadder();
  }
  function ladderSubmit() {
    if (!ladderPlaying() || ladder.busy) return;
    const { game } = ladder;
    const res = Ladder.play(ladderLib, game, ladder.guess, now());
    if (res.result === 'bad') {
      ladderFeedback(LADDER_REASON[res.reason] || 'Try another word.', res.reason === 'empty' ? 'info' : 'bad');
      if (res.reason !== 'empty') shake($('#ladder-rungs .entry'));
      return;
    }
    ladder.guess = '';
    ladderData().games[game.mode] = game; // (a sync may have replaced the saved copy)
    saveStore();
    if (res.result === 'done') return finishLadder(game);
    buzz(12);
    const left = Ladder.shortestPath(Ladder.current(game), game.to, ladderLib.words[game.to.length]);
    ladderFeedback(left && left.length === 2 ? 'Nice! One more step to go.' : 'Nice step.', 'good');
    renderLadder();
  }
  function ladderUndo() {
    if (!ladderPlaying() || ladder.busy) return;
    if (ladder.guess) {
      ladder.guess = '';
    } else if (Ladder.undo(ladder.game)) {
      saveStore();
      ladderFeedback('Stepped back.', 'info');
    }
    renderLadder();
  }
  function ladderHint() {
    if (!ladderPlaying() || ladder.busy) return;
    const word = Ladder.useHint(ladderLib, ladder.game);
    if (!word) {
      ladderFeedback('No way through from here: try stepping back.', 'info');
      return;
    }
    saveStore();
    ladder.guess = '';
    ladderFeedback(`Hint: try ${word.toUpperCase()}.`, 'info');
    renderLadder();
  }
  function ladderRestart() {
    if (!ladderPlaying() || ladder.busy) return;
    const { game } = ladder;
    if (game.steps.length < 2 && !ladder.guess) return;
    game.steps = [game.from];
    ladder.guess = '';
    saveStore();
    ladderFeedback('Back to the start. Your time and hints carry on.', 'info');
    renderLadder();
  }

  function finishLadder(game) {
    const rec = ladderData();
    const { record, isNew } = Ladder.finishGame(rec, game, Date.now());
    delete record.games[game.mode];
    store.ladder = record;
    saveStore();
    analytics.track('arcade_end', { mode: `ladder_${game.mode}`, score: game.score });
    ladderLast = { game, isNew };
    buzz([20, 40, 20]);
    sound.win();
    // A moment on the finished ladder, then the result.
    ladder.busy = true;
    renderLadder();
    $('#ladder-rungs').classList.add('climbed');
    ladderFeedback('You made it!', 'good');
    setTimeout(() => {
      $('#ladder-rungs').classList.remove('climbed');
      if (ladder && ladder.game === game) showLadderDone();
    }, reduceMotion.matches ? 300 : 1200);
  }

  function showLadderDone() {
    const { game, isNew } = ladderLast;
    const rec = ladderData();
    const moveCount = Ladder.moves(game);
    const daily = game.mode === 'daily';
    const first = daily && rec.daily[game.day];
    $('#ladder-done-kicker').textContent = daily ? 'Daily Ladder' : 'Practice ladder';
    $('#ladder-done-title').textContent = moveCount <= game.par && !game.hints ? 'Perfect climb!' : 'Ladder climbed!';
    $('#ladder-done-score').textContent = `${game.score} points`;
    $('#ladder-done-note').textContent = daily && game.replay && first
      ? `A replay: your first result stands (${plural(first.moves, 'move')}, ${formatTime(first.time / 1000)}).`
      : daily ? `Today’s ladder is done. A new one arrives at midnight South African time.`
      : isNew ? 'A new personal best!' : '';
    const stat = (n, label) => `<div><b>${n}</b><span>${esc(label)}</span></div>`;
    const sum = Ladder.summary(rec, todayKey());
    $('#ladder-done-stats').innerHTML = stat(moveCount, 'Moves') + stat(game.par, 'Par') + stat(formatTime(game.time / 1000), 'Time') + stat(game.hints, 'Hints')
      + (daily ? stat(sum.streak, 'Daily streak') : stat(rec.practice.done, 'Practice ladders'));
    $('#ladder-done-rungs').innerHTML = game.steps.map((w, i) => rung(w, game.steps[i - 1], i === 0 ? 'start' : i === game.steps.length - 1 ? 'target' : '')).join('');
    $('#ladder-done-actions').innerHTML = daily
      ? '<button class="btn btn-primary" data-open="#/arcade/ladder/practice">Practise another</button><button class="btn" data-action="ladder-replay">Play today’s again</button><button class="btn" data-action="ladder-share">Share</button><button class="btn" data-open="#/arcade/ladder">Word Ladder</button>'
      : '<button class="btn btn-primary" data-action="ladder-next">Next ladder</button><button class="btn" data-action="ladder-share">Share</button><button class="btn" data-open="#/arcade/ladder">Word Ladder</button>';
    leaveLadder();
    arcadeScreen('ladder-done');
    window.scrollTo(0, 0);
  }

  function ladderAgain(kind) {
    if (!ladderLib) return;
    const rec = ladderData();
    const today = todayKey();
    const game = kind === 'replay'
      ? Ladder.newGame(Ladder.dailyLadder(ladderLib, today), 'daily', { day: today, now: now(), replay: true })
      : Ladder.newGame(Ladder.practiceLadder(ladderLib, rec.practice.done, rec.practice.recent), 'practice', { day: today, now: now() });
    replaceRoute(`#/arcade/ladder/${game.mode}`);
    playLadder(game, false);
  }

  // Spoiler-free: the number of moves, not the words.
  function shareLadder() {
    if (!ladderLast) return;
    const { game } = ladderLast;
    const moveCount = Ladder.moves(game);
    const rows = Array.from({ length: moveCount }, (_, i) => (i === moveCount - 1 ? '🟩' : '🟨')).join('');
    const text = `Crossword Hub · ${game.mode === 'daily' ? `Daily Ladder ${game.day}` : 'Word Ladder'}: ${plural(moveCount, 'move')} (par ${game.par}), ${formatTime(game.time / 1000)}${game.hints ? `, ${plural(game.hints, 'hint')}` : ''} ${rows}`;
    const url = canLink() ? `${siteUrl()}#/arcade/ladder${game.mode === 'daily' ? '/daily' : ''}` : '';
    analytics.track('share', { method: navigator.share ? 'native' : 'copy_link', content_type: 'arcade_ladder' });
    if (navigator.share) {
      navigator.share({ text, url: url || undefined }).catch(() => {});
      return;
    }
    copyText(url ? `${text} ${url}` : text, 'Result copied to your clipboard');
  }

  const ladderTyping = deviceTyping($('#ladder-type'), {
    active: () => ladderPlaying(), type: (ch) => ladderType(ch), back: () => ladderBack(), enter: () => ladderSubmit(),
  });
  $('#ladder-rungs').addEventListener('click', () => ladderTyping.focus($('#ladder-rungs .entry')));
  $('#ladder-keys').innerHTML = KEY_ROWS.map((row, i) => `<div class="keys-row">${
    row.split('').map((k) => `<button type="button" data-ladder-key="${k}">${k}</button>`).join('')
  }${i === 2 ? '<button type="button" class="key-wide" data-ladder-key="back" aria-label="Delete">⌫</button>' : ''}</div>`).join('');
  $('#ladder-keys').addEventListener('pointerdown', (e) => e.preventDefault());
  $('#ladder-keys').addEventListener('click', (e) => {
    const key = e.target.closest('[data-ladder-key]');
    if (!key) return;
    if (key.dataset.ladderKey === 'back') ladderBack();
    else ladderType(key.dataset.ladderKey);
  });
  document.addEventListener('keydown', (e) => {
    if (!ladderPlaying() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches && e.target.matches('input, textarea')) return;
    if (/^[a-z]$/i.test(e.key)) ladderType(e.key);
    else if (e.key === 'Backspace') ladderBack();
    else if (e.key === 'Enter') ladderSubmit();
    else return;
    e.preventDefault();
  });

  // ---------- Crossword Duels ----------
  // Two players race to finish the same crossword (#/duel/...). The server
  // (functions/index.js) makes the puzzle and keeps its answers: the board
  // here gets the layout and clues only, sends the grid as you type, and
  // hears back how much of it is right. The server decides the winner.
  //   #/duel/new/<mode>    a private challenge (shares a link)
  //   #/duel/quick/<mode>  Quick Match
  //   #/duel/j/<code>      an invitation link
  //   #/duel/<id>          a duel: lobby, countdown, board, result
  const DUELS = Econ.DUELS;
  const DUEL_CARDS = {
    mini: {
      tagline: 'A small grid, head to head. Usually over in one to three minutes.',
      art: '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#2a241c" stroke-width="2.2"><rect x="8" y="12" width="40" height="40" rx="2" fill="#fbf5e6"/><path d="M21.3 12v40M34.6 12v40M8 25.3h40M8 38.6h40" stroke-width="1.6"/><rect x="21.3" y="25.3" width="13.3" height="13.3" fill="#2a241c"/></g><g stroke="#2a241c" stroke-width="2" stroke-linejoin="round"><path d="M44 4l14 14-26 26-9 3 3-9z" fill="#e3b64c"/><path d="M52 4l8 8" stroke-width="2.4"/></g></svg>',
    },
    classic: {
      tagline: 'A full-size crossword for serious solvers. Up to 20 minutes.',
      art: '<svg viewBox="0 0 64 64" aria-hidden="true"><g stroke="#2a241c"><rect x="6" y="6" width="44" height="52" rx="2" fill="#fbf5e6" stroke-width="2.2"/><path d="M6 17h44M6 28h44M6 39h44M17 6v52M28 6v52M39 6v52" stroke-width="1.2"/><path d="M17 17h11v11H17zM39 28h11v11H39zM6 39h11v11H6z" fill="#2a241c" stroke-width="1"/></g><g stroke="#2a241c" stroke-width="2" stroke-linejoin="round"><path d="M40 30l18 18-6 6-18-18-2-8z" fill="#da6a4f"/><path d="M44 30l-10-2 2 10" fill="none"/></g></svg>',
    },
  };
  let duel = null; // the duel on screen: { id, data, unsub, timers, entries, myPct, sending, again, rematchMine }
  let quick = null; // a Quick Match search: { mode, started, renew, unsub }
  let duelRecord = null; // your duel record (players/{uid}.duel), for the cards and Statistics

  async function loadDuelRecord() {
    if (!creditsOn() || !me.account) return null;
    try {
      const p = await online.read(`players/${me.uid}`);
      duelRecord = (p && p.duel) || Econ.blankDuelStats();
    } catch (e) { /* offline */ }
    return duelRecord;
  }
  document.addEventListener('online:user', () => {
    duelRecord = null;
    if (me.account) loadDuelRecord().then(() => {
      renderDuelCards($('#duel-hub-cards'));
      renderDuelCards($('#duel-home-cards'));
    });
  });

  function renderDuelCards(el) {
    if (!el) return;
    const on = creditsOn();
    el.innerHTML = Object.entries(DUELS).filter(([k]) => DUEL_CARDS[k]).map(([mode, m]) => {
      const rec = duelRecord && duelRecord.played
        ? `Your record: ${plural(duelRecord[`${mode}Wins`], 'win')} of ${duelRecord.played} duels${duelRecord.best[mode] ? ` · best ${formatTime(duelRecord.best[mode])}` : ''}`
        : on ? 'Winner earns 3 Hint Credits' : '';
      return `<div class="duel-card duel-${mode}">
        <span class="duel-art">${DUEL_CARDS[mode].art}</span>
        <span class="duel-copy">
          <span class="duel-name">${esc(m.label)}${on ? '' : ' <span class="soon-badge">Coming soon</span>'}</span>
          <span class="duel-tag">${esc(DUEL_CARDS[mode].tagline)}</span>
          ${rec ? `<span class="duel-rec">${esc(rec)}</span>` : ''}
        </span>
        ${on ? `<span class="duel-actions">
          <button class="btn btn-primary" data-open="#/duel/new/${mode}">Challenge a friend</button>
          <button class="btn" data-open="#/duel/quick/${mode}">Quick Match</button>
        </span>` : '<span class="duel-actions"><span class="duel-soon">Duels open once the game server is switched on.</span></span>'}
      </div>`;
    }).join('');
  }

  const duelPanel = (html) => {
    $('#duel-panel').innerHTML = html;
  };
  const duelLoading = (text) => duelPanel(`<p class="duel-loading">${esc(text)}</p>`);
  function duelProblem(title, text) {
    duelPanel(`<p class="kicker">Crossword Duels</p><h1>${esc(title)}</h1><p class="duel-lede">${esc(text)}</p>
      <div class="duel-buttons"><button class="btn btn-primary" data-nav="arcade">Back to Play</button></div>`);
  }
  async function duelName() {
    if (store.settings.playerName) return store.settings.playerName;
    if (me.account && me.name && Econ.validName(me.name.split(' ')[0])) return me.name.split(' ')[0];
    return askName('Your name for duels', 'Your opponent will see it. No account needed to play.', 'Continue');
  }

  async function openDuelRoute(parts, routeNow) {
    showView('duel');
    window.scrollTo(0, 0);
    if (!creditsOn()) return duelProblem('Crossword Duels are coming soon', 'Duels open once the game server is switched on. In the meantime, try the Arcade.');
    const [, a, b] = parts;
    if (!a) {
      replaceRoute('#/arcade');
      return route();
    }
    if (duel && duel.id === a) {
      if (game && game.duel && game.duel.id === a && duel.data && duel.data.status === 'live') {
        showView('game');
        game.solved = false;
        startTimer();
      }
      return renderDuel();
    }
    leaveDuel();
    duelLoading('Connecting…');
    try {
      await online.signInForDuel();
      if (currentRoute !== routeNow) return;
      if ((a === 'new' || a === 'quick') && !DUELS[b]) return duelProblem('That duel doesn’t exist', 'Choose Mini Duel or Classic Duel.');
      if (a === 'new' || a === 'quick' || a === 'j') {
        const name = await duelName();
        if (currentRoute !== routeNow) return;
        if (!name) return navigate('#/arcade');
        if (a === 'quick') return startQuick(b, name, routeNow);
        duelLoading(a === 'new' ? 'Setting up your challenge…' : 'Joining…');
        const res = a === 'new' ? await online.call('duelCreate', { mode: b, name }) : await online.call('duelJoin', { code: b, name });
        if (currentRoute !== routeNow) return;
        if (a === 'new') analytics.track('duel_create', { mode: b });
        replaceRoute(`#/duel/${res.id}`);
        return watchDuel(res.id);
      }
      return watchDuel(a);
    } catch (e) {
      if (currentRoute !== routeNow) return;
      duelProblem(e.code === 'offline' ? 'No connection' : 'That didn’t work', e.message);
    }
  }

  // ---------- Quick Match ----------
  async function startQuick(mode, name, routeNow) {
    stopQuick();
    quick = { mode, name, started: Date.now(), renew: null, tick: null, unsub: null };
    const q = quick;
    renderQuick();
    const ask = async () => {
      try {
        const res = await online.call('duelQuick', { mode, name });
        if (quick !== q) return;
        if (res.id) return quickFound(res.id);
      } catch (e) {
        if (quick === q) duelProblem('No connection', e.message);
      }
    };
    online.watch(`players/${online.who().uid}`, (p) => {
      if (quick === q && p && p.found && p.found.at > q.started - 5000) quickFound(p.found.duel);
    }).then((u) => { if (quick === q) q.unsub = u; else u(); }).catch(() => {});
    q.renew = setInterval(ask, 20000);
    q.tick = setInterval(renderQuick, 1000);
    await ask();
  }
  function renderQuick() {
    if (!quick) return;
    const secs = Math.floor((Date.now() - quick.started) / 1000);
    const long = secs >= 60;
    duelPanel(`<p class="kicker">Quick Match · ${esc(DUELS[quick.mode].label)}</p>
      <h1>${long ? 'Nobody’s free just yet' : 'Looking for an opponent…'}</h1>
      <div class="duel-search" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="duel-lede">${long ? `Nobody else is looking for a ${esc(DUELS[quick.mode].label)} right now. Keep looking, or challenge a friend with a link.` : `Waiting ${formatTime(secs)}. We’ll start as soon as someone else is looking for a ${esc(DUELS[quick.mode].label)}.`}</p>
      <div class="duel-buttons">
        ${long ? `<button class="btn btn-primary" data-open="#/duel/new/${quick.mode}">Challenge a friend instead</button>` : ''}
        <button class="btn" data-action="duel-quick-cancel">Cancel</button>
      </div>`);
  }
  function quickFound(id) {
    stopQuick(true);
    navigate(`#/duel/${id}`);
  }
  // Stops searching; unless a match was found, leaves the line on the server.
  function stopQuick(found) {
    if (!quick) return;
    const q = quick;
    quick = null;
    clearInterval(q.renew);
    clearInterval(q.tick);
    if (q.unsub) q.unsub();
    if (!found) online.call('duelQuickCancel', { mode: q.mode }).catch(() => {});
  }

  // ---------- A duel ----------
  const duelOpp = (d) => d.uids.find((u) => u !== online.who().uid);
  const duelMe = () => online.who().uid;
  const duelStore = (id) => `crosswordhub:duel:${id}`;
  function watchDuel(id) {
    duel = {
      id, data: null, unsub: null, timers: [], entries: null, myPct: 0, sending: false, again: false, rematchMine: false, settling: false,
      seq: 0, heard: 0, offset: null, rtt: Infinity, readyWant: null,
    };
    const dd = duel;
    try {
      dd.entries = JSON.parse(sessionStorage.getItem(duelStore(id)) || 'null');
    } catch (e) { /* private mode */ }
    duelLoading('Loading the duel…');
    online.watch(`duels/${id}`, (data) => {
      if (duel !== dd) return;
      if (!data) return duelProblem('Duel not found', 'This duel doesn’t exist, or it isn’t one of yours.');
      dd.seq++;
      dd.heard = Date.now();
      dd.data = data;
      renderDuel();
    }, () => {
      if (duel === dd) duelProblem('Duel not found', 'This duel doesn’t exist, or it isn’t one of yours.');
    }).then((u) => { if (duel === dd) dd.unsub = u; else u(); });
    const beat = () => online.heartbeat(id).catch(() => {});
    beat();
    dd.timers.push(setInterval(beat, 15000));
    // Ask the server for the duel and its clock straight away, and once more
    // shortly after for a better reading of the clock.
    refreshDuel(dd);
    dd.timers.push(setTimeout(() => refreshDuel(dd), 2500));
    dd.timers.push(setInterval(duelTick, 250));
    dd.timers.push(setInterval(() => duelSettle(false), 25000));
    // The live copy can stall on phones (especially after switching apps),
    // so ask the server every few seconds while it's quiet.
    dd.timers.push(setInterval(() => {
      const d = dd.data;
      if (document.hidden || !d || !['open', 'lobby', 'live'].includes(d.status)) return;
      const live = d.status === 'live' && duelNow() >= d.startAt;
      if (Date.now() - dd.heard > (live ? 8000 : 3000)) refreshDuel(dd);
    }, 3000));
  }
  // The server's clock as seen from here (see watchDuel).
  const duelNow = () => (duel && duel.offset != null ? Date.now() + duel.offset : now());
  const DUEL_STAGE = { open: 0, lobby: 1, live: 2, done: 3, cancelled: 3 };
  // Asks the server for the duel (see duelState in functions/index.js) and
  // shows it, unless the live copy has moved on meanwhile. Also reads the
  // server's clock, keeping the reading from the quickest reply.
  async function refreshDuel(dd = duel) {
    if (!dd || dd.refreshing) return;
    dd.refreshing = true;
    const seq = dd.seq;
    try {
      const sent = Date.now();
      const res = await online.call('duelState', { id: dd.id });
      const back = Date.now();
      if (duel !== dd || !res || !res.duel) return;
      if (back - sent < dd.rtt) Object.assign(dd, { rtt: back - sent, offset: res.now - (sent + back) / 2 });
      const data = res.duel;
      const was = dd.data ? DUEL_STAGE[dd.data.status] : -1;
      if (DUEL_STAGE[data.status] > was || (DUEL_STAGE[data.status] === was && seq === dd.seq)) {
        dd.heard = Date.now();
        dd.data = data;
        renderDuel();
      }
    } catch (e) { /* offline, or a server without duelState: the live copy carries on */ } finally {
      dd.refreshing = false;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && duel) refreshDuel(duel);
  });
  function leaveDuel() {
    stopQuick();
    if (!duel) return;
    duel.timers.forEach(clearInterval);
    if (duel.unsub) duel.unsub();
    if (game && game.duel) {
      game.solved = true; // lock the board; the duel carries on without it
      stopTimer();
    }
    duel = null;
    $('#duel-bar').hidden = true;
    $('#game-view').classList.remove('duel-mode');
  }

  function renderDuel() {
    const d = duel && duel.data;
    if (!d) return;
    if (d.status === 'open' || d.status === 'lobby') return renderLobby(d);
    if (d.status === 'cancelled') return duelProblem('This duel was called off', 'The challenge was cancelled or ran out of time before it started.');
    if (d.status === 'live') {
      if (duelNow() < d.startAt || !d.puzzle) return renderCountdown(d);
      if (!(game && game.duel && game.duel.id === duel.id)) startDuelBoard(d);
      return renderDuelBar();
    }
    if (d.status === 'done') return renderDuelResult(d);
  }

  function duelShareLink(d) {
    return `${siteUrl()}#/duel/j/${d.code}`;
  }
  function renderLobby(d) {
    if (!$('#game-view').hidden) showView('duel');
    const mine = duelMe();
    const opp = duelOpp(d);
    const p = d.players;
    const label = DUELS[d.mode].label;
    const title = d.rematchOf ? 'Rematch' : d.code ? 'Challenge a friend' : 'Quick Match';
    const meReady = duel.readyWant != null ? duel.readyWant : p[mine].ready;
    const isReady = (uid) => (uid === mine ? meReady : p[uid].ready);
    const row = (uid) => `<li class="${isReady(uid) ? 'ready' : ''}"><span class="duel-avatar" aria-hidden="true">${esc(p[uid].name[0].toUpperCase())}</span><span>${esc(p[uid].name)}${uid === mine ? ' <small>(you)</small>' : ''}</span><b>${isReady(uid) ? 'Ready ✓' : 'Not ready'}</b></li>`;
    const waiting = d.invited ? 'Waiting for your opponent to accept…' : 'Waiting for your friend to join…';
    const link = d.code ? duelShareLink(d) : '';
    duelPanel(`<p class="kicker">${esc(label)} · ${esc(title)}</p>
      <h1>${opp ? `You vs ${esc(p[opp].name)}` : esc(title)}</h1>
      <ol class="duel-players">${row(mine)}${opp ? row(opp) : `<li class="empty"><span class="duel-avatar" aria-hidden="true">?</span><span>${waiting}</span></li>`}</ol>
      ${!opp && link ? `<div class="duel-invite">
        <p class="duel-invite-title">Send your friend this link</p>
        <p class="duel-link"><input id="duel-link" readonly value="${esc(link)}" aria-label="Challenge link" /></p>
        <div class="duel-share">
          <button class="btn btn-whatsapp" data-action="duel-whatsapp">WhatsApp</button>
          <button class="btn btn-primary" data-action="duel-copy">Copy link</button>
          ${typeof navigator.share === 'function' ? '<button class="btn" data-action="duel-share">Share…</button>' : ''}
        </div>
        <p class="duel-small">Only someone with this link can join. It expires in ${DUELS.lobbyHours} hours.</p>
      </div>` : ''}
      <div class="duel-buttons">
        ${opp ? `<button type="button" class="duel-toggle${meReady ? ' on' : ''}" role="switch" aria-checked="${meReady}" data-action="duel-ready">
          <span class="duel-toggle-track" aria-hidden="true"><span class="duel-toggle-knob"></span></span>
          <span class="duel-toggle-label">${meReady ? 'I’m ready' : 'Ready?'}</span></button>` : ''}
        <button class="btn" data-action="duel-leave">${d.host === mine && !opp ? 'Cancel challenge' : 'Leave'}</button>
      </div>
      ${opp ? `<p class="duel-small">${meReady && !p[opp].ready ? `Waiting for ${esc(p[opp].name)} to get ready… Tap the switch again if you need a moment.` : !meReady && p[opp].ready ? `${esc(p[opp].name)} is ready. Flip the switch when you are.` : `Flip the switch when you’re ready. The duel starts ${DUELS.countdownMs / 1000} seconds after you both are.`}</p>` : ''}
      <ul class="duel-rules"><li>The same crossword for both of you; first to fill it in correctly wins.</li><li>No checking. Hints cost credits as usual and freeze your board: ${DUEL_FREEZE.letter / 1000} seconds for a letter, ${DUEL_FREEZE.word / 1000} for a word.</li><li>You see each other’s progress and number of hints, never the letters.</li><li>${esc(label)}s last up to ${DUELS[d.mode].minutes} minutes; if time runs out, it’s a draw.</li><li>The winner earns 3 Hint Credits (signed-in players, up to 3 rewarded wins a day).</li></ul>`);
  }
  function renderCountdown(d) {
    if (!$('#game-view').hidden) showView('duel');
    const left = Math.max(0, Math.ceil((d.startAt - duelNow()) / 1000));
    if (left && duel.lastCount !== left) sound.tick();
    duel.lastCount = left;
    const opp = duelOpp(d);
    duelPanel(`<p class="kicker">${esc(DUELS[d.mode].label)}</p><h1>You vs ${esc(d.players[opp].name)}</h1>
      <p class="duel-count" aria-live="assertive">${left || 'Go!'}</p>
      <p class="duel-lede">Get ready: the grid appears for both of you at the same moment.</p>`);
  }

  function startDuelBoard(d) {
    const opp = duelOpp(d);
    const spec = {
      kind: 'duel', key: `duel:${duel.id}`, url: `#/duel/${duel.id}`,
      kicker: DUELS[d.mode].label, title: `You vs ${d.players[opp].name}`, meta: `First to fill it in correctly wins. No checks; a hint freezes your board (${DUEL_FREEZE.letter / 1000} s a letter, ${DUEL_FREEZE.word / 1000} s a word).`, frozen: JSON.parse(d.puzzle),
    };
    showView('game');
    window.scrollTo(0, 0);
    startGame(spec);
    game.duel = { id: duel.id };
    if (duel.lastCount != null) sound.go(); // straight after the countdown
    if (duel.entries && duel.entries.length === game.puzzle.rows) {
      game.entries = duel.entries.map((row, r) => row.map((v, c) => (game.puzzle.solution[r][c] && /^[A-Z]$/.test(v) ? v : '')));
      refresh();
    }
    $('#game-view').classList.add('duel-mode');
    $('#duel-bar').hidden = false;
    $('#duel-opp-name').textContent = d.players[opp].name;
    renderRevealMenu();
    if (game.entries.some((row) => row.some(Boolean))) sendDuelGrid();
    renderDuelBar();
  }

  function renderDuelBar() {
    const d = duel && duel.data;
    if (!d || $('#duel-bar').hidden) return;
    const mine = d.players[duelMe()].progress || 0;
    const my = Math.max(mine, duel.myPct || 0);
    const opp = d.players[duelOpp(d)];
    const theirs = opp.progress || 0;
    const oppHints = (opp.hints || []).length;
    $('#duel-opp-name').textContent = oppHints ? `${opp.name} · ${plural(oppHints, 'hint')}` : opp.name;
    $('#duel-me-pct').textContent = `${my}%`;
    $('#duel-me-bar').style.width = `${my}%`;
    $('#duel-opp-pct').textContent = `${theirs}%`;
    $('#duel-opp-bar').style.width = `${theirs}%`;
    $('#duel-lead').textContent = my > theirs ? 'You’re ahead' : theirs > my ? `${opp.name} is ahead` : 'Level';
    $('#duel-bar').classList.toggle('ahead', my > theirs);
    $('#duel-bar').classList.toggle('behind', theirs > my);
  }
  function duelTick() {
    const d = duel && duel.data;
    if (!d) return;
    if (d.status === 'live' && (duelNow() < d.startAt || !d.puzzle) && $('#game-view').hidden) return renderCountdown(d);
    if (d.status === 'live' && !(game && game.duel && game.duel.id === duel.id) && d.puzzle && duelNow() >= d.startAt) return renderDuel();
    if (d.status !== 'live' || $('#duel-bar').hidden) return;
    showFreeze();
    const left = Math.max(0, d.endsAt - duelNow());
    $('#duel-clock').textContent = formatTime(left / 1000);
    $('#duel-clock').classList.toggle('low', left < 30000);
    if (left === 0 && !duel.settling) duelSettle(true);
  }
  // Asks the server to settle a stalled duel (time up, or an opponent gone
  // too long); it says how long an absent opponent has left to come back.
  async function duelSettle(force) {
    const dd = duel;
    if (!dd || !dd.data || dd.data.status !== 'live' || (!force && duelNow() < dd.data.startAt)) return;
    dd.settling = true;
    try {
      const res = await online.call('duelSettle', { id: dd.id });
      if (duel !== dd) return;
      if (res.status !== 'live') return refreshDuel(dd);
      const opp = dd.data.players[duelOpp(dd.data)];
      $('#duel-note').textContent = res.status === 'live' && res.waitMs < 40000
        ? `${opp.name} has lost connection. If they’re not back within ${Math.ceil(res.waitMs / 1000)} seconds, you win.` : '';
    } catch (e) { /* try again on the next tick */ }
    setTimeout(() => { if (duel === dd) dd.settling = false; }, 4000);
  }

  // Sends your grid as you type (a moment after you pause, at once when it's
  // full). Only the server can say how much of it is right.
  let duelTimer = null;
  function queueDuelGrid() {
    clearTimeout(duelTimer);
    const full = game.puzzle.solution.every((row, r) => row.every((ch, c) => !ch || game.entries[r][c]));
    duelTimer = setTimeout(sendDuelGrid, full ? 0 : 900);
    try {
      sessionStorage.setItem(duelStore(game.duel.id), JSON.stringify(game.entries));
    } catch (e) { /* private mode */ }
  }
  async function sendDuelGrid() {
    const dd = duel;
    if (!dd || !game || !game.duel || game.duel.id !== dd.id || game.solved) return;
    if (duelFrozen()) return; // sent when the freeze ends (duelTick)
    if (dd.sending) {
      dd.again = true;
      return;
    }
    dd.sending = true;
    try {
      const res = await online.call('duelProgress', { id: dd.id, grid: game.entries });
      if (duel !== dd) return;
      dd.myPct = res.percent;
      // Finished (by you, or already by your opponent): show the result now
      // rather than waiting for the live copy to catch up.
      if (res.status === 'done') return refreshDuel(dd);
      if (res.status === 'frozen') dd.frozenUntil = Math.max(dd.frozenUntil || 0, res.frozenUntil);
      renderDuelBar();
      if (res.full && !res.won && res.status === 'live') toast('The grid is full, but something isn’t right yet');
    } catch (e) {
      if (duel === dd) $('#duel-note').textContent = 'Reconnecting… keep solving: your letters are saved.';
      setTimeout(() => { if (duel === dd) sendDuelGrid(); }, 3000);
    } finally {
      dd.sending = false;
      if (dd.again) {
        dd.again = false;
        sendDuelGrid();
      }
    }
  }

  function renderDuelResult(d) {
    if (game && game.duel && game.duel.id === duel.id) {
      game.solved = true;
      stopTimer();
      typeInput.blur();
    }
    $('#duel-bar').hidden = true;
    $('#game-view').classList.remove('duel-mode');
    if ($('#duel-view').hidden) showView('duel');
    try {
      sessionStorage.removeItem(duelStore(duel.id));
    } catch (e) { /* private mode */ }
    const mine = duelMe();
    const opp = duelOpp(d);
    const r = d.result || {};
    const won = d.winner === mine;
    const lost = d.winner && !won;
    const oppName = d.players[opp].name;
    const prog = r.progress || {};
    const why = {
      'daily-limit': 'No credits this time: that’s today’s 3 rewarded wins. Every win still counts in your record.',
      'opponent-limit': `No credits this time: you’ve had today’s 2 rewarded wins against ${oppName}.`,
      'too-fast': 'No credits: that was quicker than a real solve.',
      forfeit: `${oppName} left the duel, so it’s yours, without credits.`,
      disconnect: `${oppName} lost connection, so it’s yours, without credits.`,
    };
    const creditLine = won
      ? r.credits ? `+${r.credits} Hint Credits earned.` : d.players[mine].account ? (why[r.why] || why[r.reason] || '') : 'Sign in to earn 3 Hint Credits for every win.'
      : '';
    const head = won ? 'Victory!' : lost ? 'Good game!' : 'A draw';
    const lede = won
      ? (r.reason === 'solved' ? 'You’ve won the crossword duel!' : 'You win the duel.')
      : lost ? (r.reason === 'forfeit' && d.players[mine].left ? 'You left the duel, so the win goes to your opponent.' : r.reason === 'disconnect' ? 'You were away too long, so the win goes to your opponent.' : 'Your opponent finished first. Ready for a rematch?')
      : 'Time ran out before either of you finished.';
    const rematchOffer = d.rematch && !duel.rematchMine;
    duelPanel(`<div class="duel-result ${won ? 'won' : lost ? 'lost' : 'draw'}">
      ${won ? '<div class="win-art duel-trophy" aria-hidden="true"></div>' : ''}
      <p class="kicker">${esc(DUELS[d.mode].label)}</p>
      <h1>${head}</h1>
      <p class="duel-lede">${esc(lede)}</p>
      ${creditLine ? `<p class="win-reward">${esc(creditLine)}</p>` : ''}
      <div class="win-stats duel-final">
        <div><b>${prog[mine] || 0}%</b><span>You</span></div>
        <div><b>${prog[opp] || 0}%</b><span>${esc(oppName)}</span></div>
        <div><b>${r.seconds ? formatTime(r.seconds) : '—'}</b><span>${r.reason === 'solved' ? 'Winning time' : 'Time'}</span></div>
      </div>
      ${rematchOffer ? `<p class="duel-offer">${esc(oppName)} wants a rematch.</p>` : ''}
      <div class="duel-buttons">
        ${rematchOffer ? '<button class="btn btn-primary" data-action="duel-accept">Accept rematch</button>' : `<button class="btn btn-primary" data-action="duel-rematch">Rematch</button>`}
        <button class="btn" data-open="#/duel/new/${d.mode}">Challenge another friend</button>
        <button class="btn" data-action="duel-result-share">Share result</button>
        <button class="btn" data-nav="arcade">Back to Play</button>
      </div>
      <a class="duel-report" href="mailto:crosswordhub@gmail.com?subject=${encodeURIComponent('Report a player name')}&body=${encodeURIComponent(`Duel ${duel.id}: the name “${oppName}” is offensive.`)}">Report this player’s name</a>
    </div>`);
    if (won) $('.duel-trophy').innerHTML = $('#win-dialog .win-art').innerHTML;
    if (!duel.reported) {
      duel.reported = true;
      (won ? sound.win : sound.over)();
      analytics.track('duel_end', { mode: d.mode, outcome: won ? 'win' : lost ? 'loss' : 'draw', reason: r.reason || '' });
      if (me.account) {
        loadDuelRecord();
        if (won && r.credits) syncWallet(); // show the new credits
      }
    }
  }

  async function duelAction(action) {
    const dd = duel;
    const d = dd && dd.data;
    try {
      if (action === 'duel-quick-cancel') {
        stopQuick();
        return navigate('#/arcade');
      }
      if (!d) return;
      if (action === 'duel-ready') {
        // Flips at once on screen; the server confirms a moment later.
        if (dd.readyBusy) return;
        const ready = !(dd.readyWant != null ? dd.readyWant : d.players[duelMe()].ready);
        dd.readyWant = ready;
        dd.readyBusy = true;
        buzz(10);
        renderDuel();
        try {
          await online.call('duelReady', { id: dd.id, ready });
          await refreshDuel(dd);
        } finally {
          dd.readyBusy = false;
          dd.readyWant = null;
          if (duel === dd) renderDuel();
        }
      } else if (action === 'duel-leave') {
        await online.call('duelLeave', { id: dd.id });
        navigate('#/arcade');
      } else if (action === 'duel-resign') {
        if (!window.confirm('Resign this duel? Your opponent wins.')) return;
        await online.call('duelLeave', { id: dd.id });
      } else if (action === 'duel-rematch') {
        dd.rematchMine = true;
        const name = await duelName();
        const res = await online.call('duelCreate', { rematchOf: dd.id, name: name || undefined });
        navigate(`#/duel/${res.id}`);
      } else if (action === 'duel-accept') {
        const name = await duelName();
        const res = await online.call('duelJoin', { id: d.rematch, name: name || undefined });
        navigate(`#/duel/${res.id}`);
      } else if (action === 'duel-copy') {
        copyText(duelShareLink(d), 'Link copied: send it to a friend');
      } else if (action === 'duel-whatsapp' || action === 'duel-share') {
        const text = `I challenge you to a ${DUELS[d.mode].label} on Crossword Hub: the same crossword, live, and the first to finish wins.`;
        analytics.track('share', { method: action === 'duel-share' ? 'native' : 'whatsapp', content_type: 'duel_invite' });
        if (action === 'duel-share') navigator.share({ text, url: duelShareLink(d) }).catch(() => {});
        else window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${duelShareLink(d)}`)}`, '_blank', 'noopener');
      } else if (action === 'duel-result-share') {
        const won = d.winner === duelMe();
        const r = d.result || {};
        const text = won
          ? `I won a ${DUELS[d.mode].label} on Crossword Hub${r.seconds ? ` in ${formatTime(r.seconds)}` : ''}. Fancy a game?`
          : d.winner ? `I just played a ${DUELS[d.mode].label} on Crossword Hub. Fancy a game?` : `A ${DUELS[d.mode].label} on Crossword Hub ended in a draw. Fancy a game?`;
        const url = canLink() ? `${siteUrl()}#/arcade` : '';
        analytics.track('share', { method: navigator.share ? 'native' : 'copy_link', content_type: 'duel_result' });
        if (navigator.share) navigator.share({ text, url: url || undefined }).catch(() => {});
        else copyText(url ? `${text} ${url}` : text, 'Result copied to your clipboard');
      }
    } catch (e) {
      toast(e.message);
    }
  }

  // ---------- Gift crosswords ----------
  // Made here from the player's own answers and clues and sent as a link
  // (see js/gifts.js). The builder shows "Coming soon" until GIFTS_LIVE is
  // switched on, except on a device opened with #/gift/unlock. Gift links
  // always open.
  const Gifts = window.CrosswordGifts;
  const giftsOpen = () => Gifts.GIFTS_LIVE || !!store.giftPreview;
  let giftBuilt = null; // { attempt, code, puzzle, count }
  function renderGiftCard() {
    $('#gift-soon-badge').hidden = giftsOpen();
    // The app stores don't allow features that aren't ready yet.
    $('#gift-card').closest('section').style.display = inApp && !giftsOpen() ? 'none' : '';
  }
  function openGifts() {
    if (giftsOpen()) navigate('#/gift/new');
    else $('#gift-soon-dialog').showModal();
  }

  function giftSpec(code, gift) {
    const title = gift.title || (gift.to ? `A crossword for ${gift.to}` : 'A crossword for you');
    return {
      kind: 'gift',
      key: `gift:${Gifts.giftId(code)}`,
      url: `#/gift/${code}`,
      code,
      gift,
      layout: gift.layout,
      kicker: gift.from ? `A gift crossword from ${gift.from}` : 'A gift crossword',
      title,
      meta: `${plural(gift.words.length, 'clue')}${gift.to ? ` · made for ${gift.to}` : ''}`,
    };
  }

  // #/gift/new (the builder), #/gift/unlock and #/gift/lock (try the builder
  // on this device before it's live) and #/gift/<code> (a gift to solve).
  async function openGiftRoute(what, routeNow) {
    if (what === 'unlock' || what === 'lock') {
      store.giftPreview = what === 'unlock';
      saveStore();
      toast(what === 'unlock' ? 'Gift builder unlocked on this device' : 'Gift builder locked on this device');
      replaceRoute(what === 'unlock' ? '#/gift/new' : '#/');
      route();
      return;
    }
    if (what === 'new') {
      if (!giftsOpen()) {
        replaceRoute('#/');
        route();
        $('#gift-soon-dialog').showModal();
        return;
      }
      game = null;
      showView('gift');
      window.scrollTo(0, 0);
      renderGiftBuilder();
      return;
    }
    showView('game');
    window.scrollTo(0, 0);
    const gift = await Gifts.decodeGift(what);
    if (currentRoute !== routeNow) return;
    const spec = gift && giftSpec(what, gift);
    if (spec && puzzleFor(spec)) {
      startGame(spec);
      return;
    }
    toast('That gift link looks incomplete. Ask the sender to copy it again.');
    replaceRoute('#/');
    route();
  }

  // ---- The builder ----
  const giftRowHtml = (row, i) => `<li class="gift-row">
      <span class="gift-num" aria-hidden="true">${i + 1}</span>
      <input class="gift-answer" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Answer" aria-label="Answer ${i + 1}" value="${esc(row.answer || '')}" />
      <input class="gift-clue" maxlength="${Gifts.LIMITS.clue}" autocomplete="off" placeholder="Clue" aria-label="Clue ${i + 1}" value="${esc(row.clue || '')}" />
      <button type="button" class="icon-btn gift-remove" data-action="gift-remove" aria-label="Remove line ${i + 1}">✕</button>
    </li>`;
  const GIFT_EXAMPLES = [
    { answer: 'e.g. Paris', clue: 'e.g. Where we went on our first holiday' },
    { answer: 'e.g. Biscuit', clue: 'e.g. Our scruffy dog' },
  ];
  function renderGiftBuilder() {
    const d = store.giftDraft || {};
    $('#gift-to').value = d.to || '';
    $('#gift-from').value = d.from || '';
    $('#gift-title').value = d.title || '';
    $('#gift-message').value = d.message || '';
    const rows = (d.rows || []).filter((r) => r.answer || r.clue);
    while (rows.length < 6) rows.push({ answer: '', clue: '' });
    $('#gift-rows').innerHTML = rows.map(giftRowHtml).join('');
    $$('.gift-row').slice(0, 2).forEach((li, i) => {
      $('.gift-answer', li).placeholder = GIFT_EXAMPLES[i].answer;
      $('.gift-clue', li).placeholder = GIFT_EXAMPLES[i].clue;
    });
    $('#gift-problems').innerHTML = '';
    showGiftForm();
  }
  function showGiftForm() {
    $('#gift-form').hidden = false;
    $('#gift-result').hidden = true;
    $('#gift-add').hidden = $$('.gift-row').length >= Gifts.LIMITS.maxWords;
  }
  function readGiftForm() {
    return {
      to: $('#gift-to').value,
      from: $('#gift-from').value,
      title: $('#gift-title').value,
      message: $('#gift-message').value,
      rows: $$('.gift-row').map((li) => ({ answer: $('.gift-answer', li).value, clue: $('.gift-clue', li).value })),
    };
  }
  // The draft is kept in this browser only (never synced or sent anywhere).
  let giftDraftTimer = null;
  function saveGiftDraft() {
    clearTimeout(giftDraftTimer);
    store.giftDraft = readGiftForm();
    saveStore();
  }
  $('#gift-form').addEventListener('input', () => {
    clearTimeout(giftDraftTimer);
    giftDraftTimer = setTimeout(saveGiftDraft, 400);
  });
  $('#gift-form').addEventListener('submit', (e) => {
    e.preventDefault();
    buildGift(0);
  });
  function addGiftRow() {
    const rows = $$('.gift-row');
    if (rows.length >= Gifts.LIMITS.maxWords) return;
    $('#gift-rows').insertAdjacentHTML('beforeend', giftRowHtml({}, rows.length));
    $('#gift-add').hidden = rows.length + 1 >= Gifts.LIMITS.maxWords;
    $('.gift-row:last-child .gift-answer').focus();
  }
  function removeGiftRow(li) {
    if (!li) return;
    if ($$('.gift-row').length > 1) li.remove();
    else $$('input', li).forEach((x) => (x.value = ''));
    $$('.gift-row').forEach((row, i) => {
      $('.gift-num', row).textContent = i + 1;
      $('.gift-answer', row).setAttribute('aria-label', `Answer ${i + 1}`);
      $('.gift-clue', row).setAttribute('aria-label', `Clue ${i + 1}`);
      $('.gift-remove', row).setAttribute('aria-label', `Remove line ${i + 1}`);
    });
    $('#gift-add').hidden = false;
    saveGiftDraft();
  }
  function clearGift() {
    if (!confirm('Clear everything and start a new gift?')) return;
    delete store.giftDraft;
    saveStore();
    giftBuilt = null;
    renderGiftBuilder();
  }
  function editGift() {
    showGiftForm();
    $('#gift-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function giftProblems(list) {
    $('#gift-problems').innerHTML = list.length ? `<ul>${list.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  }
  async function buildGift(attempt) {
    saveGiftDraft();
    const form = store.giftDraft;
    const { words, problems } = Gifts.cleanEntries(form.rows);
    const rows = $$('.gift-row');
    rows.forEach((li, i) => li.classList.toggle('has-problem', problems.some((p) => p.row === i)));
    if (problems.length) {
      showGiftForm();
      giftProblems(problems.map((p) => p.text));
      const first = problems.find((p) => p.row >= 0);
      (first ? $('.gift-answer', rows[first.row]) : $('#gift-problems')).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const { puzzle, missing } = Gifts.buildGrid(CrosswordGenerator, words, attempt);
    if (puzzle.words.length < Gifts.LIMITS.minWords) {
      showGiftForm();
      giftProblems(['These answers don’t share enough letters to make a crossword. Add a few more, ideally ones with common letters like E, A, R and S.']);
      $('#gift-problems').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const placed = words.filter((w) => !missing.includes(w.answer));
    const code = await Gifts.encodeGift({ title: form.title, from: form.from, to: form.to, message: form.message, words: placed, layout: CrosswordGenerator.layoutCode(puzzle) });
    giftBuilt = { attempt, code, puzzle, count: placed.length };
    giftProblems([]);
    $('#gift-form').hidden = true;
    $('#gift-result').hidden = false;
    $('#gift-summary').textContent = `${plural(placed.length, 'answer')} in a ${puzzle.cols} × ${puzzle.rows} grid.`;
    $('#gift-missing').hidden = !missing.length;
    $('#gift-missing').textContent = missing.length
      ? `${missing.join(', ')} didn’t fit: ${missing.length === 1 ? 'it shares' : 'they share'} no letters with the rest of the grid in this layout. Try another layout, or edit to add answers that share letters.`
      : '';
    drawThumb($('#gift-thumb'), puzzle);
    analytics.track('gift_create', { words: placed.length });
    window.scrollTo(0, 0);
  }
  const giftUrl = () => `${siteUrl()}#/gift/${giftBuilt.code}`;
  function giftMessage() {
    const from = (store.giftDraft && store.giftDraft.from || '').trim();
    return `${from ? `${from} made` : 'I made'} you a crossword 🎁`;
  }
  async function shareGift() {
    if (!giftBuilt) return;
    analytics.track('share', { method: 'native', content_type: 'gift' });
    try {
      if (navigator.share) {
        await navigator.share({ text: giftMessage(), url: giftUrl() });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    copyText(`${giftMessage()} ${giftUrl()}`, 'Gift link copied');
  }
  function giftWhatsApp() {
    if (!giftBuilt) return;
    analytics.track('share', { method: 'whatsapp', content_type: 'gift' });
    window.open(`https://wa.me/?text=${encodeURIComponent(`${giftMessage()} ${giftUrl()}`)}`, '_blank', 'noopener');
  }

  // ---------- Installing as an app ----------
  // Chrome and Edge (Android, desktop) offer an install prompt we can trigger
  // from a button; iPhones and iPads need Share → Add to Home Screen.
  let installEvent = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function showInstallCard() {
    const card = $('#install-card');
    if (inApp || standalone() || store.installDismissed) { card.hidden = true; return; }
    if (installEvent) {
      $('#install-btn').hidden = false;
      card.hidden = false;
    } else if (isIOS()) {
      $('#install-btn').hidden = true;
      $('#install-text').textContent = 'Tap the Share button, then “Add to Home Screen”. It opens full screen and works offline.';
      card.hidden = false;
    }
  }
  async function promptInstall() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    if (outcome === 'accepted') $('#install-card').hidden = true;
  }
  function dismissInstall() {
    store.installDismissed = true;
    saveStore();
    $('#install-card').hidden = true;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    showInstallCard();
  });
  window.addEventListener('appinstalled', () => { $('#install-card').hidden = true; });
  // In the app the files are already on the phone: no service worker.
  if (inApp) $$('.privacy-more a[href]').forEach((a) => { if (!a.href.startsWith('mailto:')) a.href = `${SITE}${a.getAttribute('href')}`; });
  else if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ---------- Account sync ----------
  // js/account.js (loaded only when sign-in is set up) reads and replaces the
  // saved progress through this bridge.
  window.CrosswordHub = {
    getStore: () => store,
    applyStore(next) {
      for (const k of Object.keys(store)) delete store[k];
      Object.assign(store, next);
      saveStore();
      // Refresh what's on screen, but leave a puzzle being played alone.
      if ($('#game-view').hidden && !arcadePlaying() && !ladderPlaying()) route();
    },
    onSave: (fn) => storeListeners.push(fn),
  };

  syncSettingsUI();
  showInstallCard();
  withTimeout(syncClock(), 1500)
    .then(() => withTimeout(loadMonth(todayKey().slice(0, 7)), 2500))
    .then(route)
    .then(() => { if (analytics.available && store.settings.analytics === true) noteVisit(); });
})();
