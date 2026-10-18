/* global CrosswordGenerator, GENRES, CATEGORIES, DIFFICULTIES, DAILY_BANK, DAILY_SCHEDULE, MINI_BANK, MINI_CONFIG, dailyBuild, miniBuild */
(function () {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
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
      category: 'academic',
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
  // Every published Daily and Mini is saved in puzzles/YYYY-MM.json (made by
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
  const frozenPuzzle = (kind, date) => {
    const data = frozenMonths.get(date.slice(0, 7));
    return (data && data[kind] && data[kind][date]) || null;
  };

  function dailySpec(date) {
    const sched = DAILY_SCHEDULE[parseKey(date).getDay()];
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

  function genreSpec(genre, difficulty, seed, pool) {
    const cfg = DIFFICULTIES[difficulty];
    const cat = categoryById(genre.category);
    return {
      kind: 'genre',
      key: `play:${genre.id}/${difficulty}/${seed}/${pool || ''}`,
      layout: pool && pool[0] === 'L' ? pool : null,
      url: `#/play/${genre.id}/${difficulty}/${seed}${pool ? '/' + pool : ''}`,
      genre,
      difficulty,
      pool,
      kicker: cat ? cat.name : 'Genre puzzle',
      title: genre.name,
      meta: `${cfg.label} · ${cfg.count} clues`,
      bank: decodePool(genre, pool) || genre.words,
      count: cfg.count,
      maxSize: cfg.maxSize,
      hard: cfg.hard,
      seed,
      tags: genre.category === 'mixed',
    };
  }

  const puzzleCache = new Map();
  function puzzleFor(spec) {
    if (puzzleCache.has(spec.key)) return puzzleCache.get(spec.key);
    let puzzle;
    let keep = true;
    if (spec.kind === 'daily' || spec.kind === 'mini') {
      const frozen = frozenPuzzle(spec.kind, spec.date);
      if (frozen) {
        puzzle = CrosswordGenerator.thaw(frozen);
      } else {
        const { bank, options } = spec.build();
        puzzle = CrosswordGenerator.generate(bank, options);
        // Don't hold on to a built copy while the month's frozen file is still loading.
        keep = !monthLoads.has(spec.date.slice(0, 7)) || frozenMonths.has(spec.date.slice(0, 7));
      }
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
    const cfg = DIFFICULTIES[difficulty];
    const all = genre.words.map((_, i) => i);
    let seen = new Set(store.seen[genre.id] || []);
    let unseen = all.filter((i) => !seen.has(genre.words[i].answer));
    if (unseen.length < cfg.count + 6) {
      seen = new Set(store.lastWords[genre.id] || []);
      store.seen[genre.id] = [...seen];
      unseen = all.filter((i) => !seen.has(genre.words[i].answer));
    }
    let pool = shuffled(unseen).slice(0, Math.max(80, cfg.count * 5));
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

  function dailyStreaks() {
    const solved = (k) => {
      const s = store.solves[`daily:${k}`];
      return s && s.clean;
    };
    let day = todayKey();
    if (!solved(day)) day = addDays(day, -1);
    let current = 0;
    while (day >= LAUNCH && solved(day)) {
      current++;
      day = addDays(day, -1);
    }
    const keys = Object.keys(store.solves).filter((k) => k.startsWith('daily:') && store.solves[k].clean).map((k) => k.slice(6)).sort();
    let longest = 0;
    let run = 0;
    let prev = null;
    for (const k of keys) {
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = k;
    }
    return { current, longest };
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
    const today = todayKey();
    const daily = dailySpec(today);
    const mini = miniSpec(today);

    const ds = statusLine(daily.key, 'Play');
    const streakNow = dailyStreaks().current;
    $('#daily-feature').innerHTML = `
      <div>
        <p class="kicker">${esc(daily.kicker)}${streakNow ? `<span class="streak-chip" title="Daily streak">🔥 ${plural(streakNow, 'day')}</span>` : ''}</p>
        <h2>${esc(daily.sched.day)}'s Crossword</h2>
        <p class="deck" id="daily-deck">An academic crossword drawn from ${DAILY_SUBJECTS} subjects, from chemistry and classics to law, linguistics and philosophy.</p>
        <ul class="facts">
          <li><b>${daily.count}</b> clues</li>
          <li><b>${esc(daily.sched.level)}</b> difficulty</li>
          <li>New every day at midnight SAST</li>
        </ul>
        <button class="btn btn-primary" data-open="${daily.url}">${ds.label}</button>
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
        <ul class="facts"><li><b>${mini.count}</b> clues</li><li>Small grid</li></ul>
        <button class="btn" data-open="${mini.url}">${ms.label}</button>
        ${ms.text ? `<p class="status ${ms.cls}">${esc(ms.text)}</p>` : ''}
      </div>
      <canvas class="thumb" aria-hidden="true"></canvas>`;
    queueThumb($('#mini-feature canvas'), () => puzzleFor(mini));

    // The week runs Monday to Sunday.
    const dow = parseKey(today).getDay();
    const monday = addDays(today, -((dow + 6) % 7));
    const strip = $('#week-strip');
    strip.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const k = addDays(monday, i);
      const sched = DAILY_SCHEDULE[parseKey(k).getDay()];
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

    $$('#difficulty button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.difficulty === store.difficulty)));
    renderGenreTabs();
    renderGenreGrid();
  }

  function renderGenreTabs() {
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
    const cfg = DIFFICULTIES[store.difficulty];
    for (const g of GENRES.filter((x) => x.category === store.category)) {
      const best = store.best[`${g.id}:${store.difficulty}`];
      const card = document.createElement('button');
      card.className = 'genre-card';
      card.dataset.genre = g.id;
      card.innerHTML = `
        <canvas class="thumb" aria-hidden="true"></canvas>
        <span>
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.blurb)}</p>
          <span class="meta"><span>${g.words.length} words</span>${best ? `<span class="best">Best ${formatTime(best)}</span>` : ''}</span>
        </span>`;
      card.setAttribute('aria-label', `${g.name}. ${g.blurb} ${cfg.label}, ${cfg.count} clues.`);
      grid.appendChild(card);
      queueThumb($('canvas', card), () => puzzleFor(genreSpec(g, 'easy', 1, '')));
    }
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

  // ---------- Stats ----------
  function openStats() {
    const dailies = Object.entries(store.solves).filter(([k]) => k.startsWith('daily:'));
    const clean = dailies.filter(([, s]) => s.clean);
    const { current, longest } = dailyStreaks();
    const avg = clean.length ? clean.reduce((t, [, s]) => t + s.time, 0) / clean.length : 0;
    $('#stat-tiles').innerHTML = [
      [store.solvedCount || 0, 'Puzzles solved'],
      [dailies.length, 'Dailies finished'],
      [current, 'Current streak'],
      [longest, 'Longest streak'],
      [clean.length ? formatTime(avg) : '—', 'Average Daily'],
      [clean.length, 'Dailies with no help'],
      [dailies.reduce((t, [, s]) => t + (s.letters || 0), 0), 'Letters revealed in Dailies'],
      [dailies.reduce((t, [, s]) => t + (s.words || 0), 0), 'Words revealed in Dailies'],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');

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
    $('#stats-dialog').showModal();
  }

  // ---------- Game state ----------
  let game = null;
  let cellEls = [];
  const grid2 = (rows, cols, v) => Array.from({ length: rows }, () => Array(cols).fill(v));

  function startGame(spec) {
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
      revealWords: 0,
      checks: 0,
    };

    const save = store.saves[spec.key];
    const solve = store.solves[spec.key];
    if (save && fitsPuzzle(save, puzzle)) {
      game.entries = save.entries;
      game.revealed = save.revealed || game.revealed;
      game.pencil = save.pencil || game.pencil;
      game.elapsed = save.elapsed || 0;
      game.reveals = save.reveals || 0;
      game.revealWords = save.revealWords || 0;
      game.checks = save.checks || 0;
    } else if (solve) {
      // Already solved and no work in progress: show the finished grid.
      game.entries = puzzle.solution.map((row) => row.map((ch) => ch || ''));
      game.elapsed = solve.time;
      game.reveals = solve.clean ? 0 : 1;
    }
    if (store.settings.autocheck) {
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
    if (!game) return;
    if (game.solved) {
      delete store.saves[game.spec.key];
    } else if (game.entries.some((row) => row.some(Boolean)) || store.saves[game.spec.key]) {
      store.saves[game.spec.key] = {
        sig: layoutSig(game.puzzle),
        entries: game.entries,
        revealed: game.revealed,
        pencil: game.pencil,
        elapsed: currentElapsed(),
        reveals: game.reveals,
        revealWords: game.revealWords,
        checks: game.checks,
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
    game.paused = paused;
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
    document.title = `${spec.kind === 'genre' ? spec.title : spec.kicker.split(' · ')[0] + ', ' + shortDate(spec.date)} · Crossword Hub`;

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
  function sizeBoard() {
    if (!game) return;
    const { rows, cols } = game.puzzle;
    const view = $('#game-view');
    const inner = view.clientWidth - 32;
    const wide = window.innerWidth > 900;
    const availW = wide ? Math.min(inner - Math.min(460, inner * 0.4) - 28, 720) : inner;
    // Fit the grid in the window. On touch screens only the width counts, so
    // the grid doesn't shrink each time the keyboard opens.
    const top = $('#board-wrap').getBoundingClientRect().top + window.scrollY;
    const availH = touchScreen.matches ? Infinity : Math.max(wide ? 360 : 240, window.innerHeight - top - 24);
    const cap = game.spec.kind === 'mini' ? 72 : 52;
    // Big grids may run past the window's height rather than shrink below a
    // comfortable size; on narrow phones they scroll sideways if needed.
    const fitH = Math.max(Math.floor(availH / rows), Math.min(28, cap));
    const frame = 2 * BOARD_PAD + 1; // the dark board's padding around the squares
    const size = Math.max(14, Math.min(cap, Math.floor((availW - 4 - frame) / cols), fitH));
    const board = $('#board');
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
    placeTyping();
    let total = 0;
    let filled = 0;
    game.puzzle.solution.forEach((row, r) => row.forEach((ch, c) => {
      if (!ch) return;
      total++;
      if (game.entries[r][c]) filled++;
    }));
    $('#progress i').style.width = `${(filled / total) * 100}%`;
    $('#progress').setAttribute('aria-valuenow', Math.round((filled / total) * 100));
    $('#progress').classList.toggle('done', !!game.solved);
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
    game.wrong[r][c] = !!ch && !game.pencilMode && store.settings.autocheck && ch !== game.puzzle.solution[r][c];
  }

  function typeLetter(ch) {
    if (game.solved || game.paused) return;
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
    if (game.solved) return;
    game.checks++;
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
    if (scope === 'all' && Date.now() - revealArmed > 4000) {
      revealArmed = Date.now();
      toast('Choose Reveal → Puzzle again to show every answer');
      return;
    }
    revealArmed = 0;
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
      }
      game.pencil[r][c] = false;
      game.wrong[r][c] = false;
    }
    afterChange();
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
    if (spec.kind === 'genre') {
      actions.push({ label: 'Play another', primary: true, attr: 'data-action="new"' });
      actions.push({ label: 'Back to genres', attr: 'data-nav="genres"' });
    } else {
      const otherKind = spec.kind === 'daily' ? 'mini' : 'daily';
      const otherKey = `${otherKind}:${spec.date}`;
      if (!store.solves[otherKey]) {
        actions.push({ label: otherKind === 'mini' ? 'Play the Mini' : 'Play the Daily', primary: true, attr: `data-open="#/${otherKind}/${spec.date}"` });
      }
      actions.push({ label: spec.date === today ? 'Back to today' : 'Back to the archive', attr: `data-nav="${spec.date === today ? 'home' : 'archive'}"` });
    }
    actions.push({ label: 'Share result', attr: 'data-action="share"' });
    return actions;
  }

  function win() {
    stopTimer();
    game.solved = true;
    const { spec } = game;
    const time = game.elapsed;
    const clean = game.reveals === 0;
    let newBest = false;
    store.solvedCount = (store.solvedCount || 0) + 1;
    const prev = store.solves[spec.key];
    if (!prev || (clean && (!prev.clean || time < prev.time))) {
      store.solves[spec.key] = { time, clean, at: Date.now(), letters: game.reveals, words: game.revealWords };
    }
    if (spec.kind === 'genre' && clean) {
      const k = `${spec.genre.id}:${spec.difficulty}`;
      if (!store.best[k] || time < store.best[k]) {
        store.best[k] = time;
        newBest = true;
      }
    }
    delete store.saves[spec.key];
    saveStore();

    $('#board').classList.add('solved');
    celebrate(clean);
    $('#win-kicker').textContent = spec.kicker;
    $('#win-title').textContent = clean ? 'Solved' : 'Puzzle complete';
    $('#win-time').textContent = formatTime(time);
    $('#win-text').textContent = clean
      ? newBest ? 'A new personal best for this genre and level.' : game.checks ? 'Finished without reveals.' : 'Finished without checks or reveals.'
      : `${revealSummary(game.reveals, game.revealWords)} revealed, so this one doesn't count toward streaks or best times.`;
    let stats = '';
    if (spec.kind === 'daily') {
      const { current, longest } = dailyStreaks();
      stats = `<div><b>${current}</b><span>Current streak</span></div><div><b>${longest}</b><span>Longest streak</span></div>`;
      if (!clean) stats += `<div><b>${game.reveals}</b><span>Letters revealed</span></div><div><b>${game.revealWords}</b><span>Words revealed</span></div>`;
    } else if (spec.kind === 'genre' && store.best[`${spec.genre.id}:${spec.difficulty}`]) {
      stats = `<div><b>${formatTime(store.best[`${spec.genre.id}:${spec.difficulty}`])}</b><span>Best ${esc(DIFFICULTIES[spec.difficulty].label)} time</span></div>`;
    }
    $('#win-stats').innerHTML = stats;
    typeInput.blur(); // close the device keyboard so the result is visible
    $('#win-actions').innerHTML = nextActions().map((a) => `<button class="btn ${a.primary ? 'btn-primary' : ''}" ${a.attr}>${esc(a.label)}</button>`).join('');
    refresh();
    setTimeout(() => {
      if (game && game.solved && !$('#game-view').hidden && !$('#win-dialog').open) $('#win-dialog').showModal();
    }, 700);
  }

  function shareText() {
    const { spec } = game;
    const name = spec.kind === 'genre' ? `${spec.title} (${DIFFICULTIES[spec.difficulty].label})` : `${spec.kicker.split(' · ')[0]}, ${shortDate(spec.date)}`;
    const how = game.reveals ? `finished with ${revealSummary(game.reveals, game.revealWords)} revealed` : 'solved with no reveals';
    let text = `Crossword Hub · ${name}\n${formatTime(game.elapsed)}, ${how}`;
    let framed = true;
    try {
      framed = window.top !== window.self;
    } catch (e) {
      framed = true;
    }
    // Only link to the puzzle when the site is opened directly (not embedded).
    if (!framed && /^https?:/.test(location.protocol)) text += `\n${location.origin}${location.pathname}${spec.url}`;
    return text;
  }

  function share() {
    const text = shareText();
    const done = () => toast('Result copied to your clipboard');
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
    if (!game || $('#game-view').hidden || $('#win-dialog').open || $('#stats-dialog').open) return;
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
      navigate({ home: '#/', archive: '#/archive', genres: '#/genres' }[nav.dataset.nav]);
      return;
    }
    const genreCard = e.target.closest('[data-genre]');
    if (genreCard) {
      navigate(freshGenreSpec(genreById(genreCard.dataset.genre), store.difficulty).url);
      return;
    }
    const diff = e.target.closest('[data-difficulty]');
    if (diff) {
      store.difficulty = diff.dataset.difficulty;
      saveStore();
      $$('#difficulty button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.difficulty === store.difficulty)));
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
      case 'stats': openStats(); return;
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
      if (on) game.checks++;
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
  $('#set-vibrate').addEventListener('change', (e) => {
    store.settings.vibrate = e.target.checked;
    saveStore();
    buzz(20);
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
    for (const v of ['home', 'archive', 'game']) {
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
    $$('.masthead-nav button').forEach((b) => b.removeAttribute('aria-current'));
    const navName = name === 'game' ? null : name;
    if (navName) $(`.masthead-nav [data-nav="${navName}"]`).setAttribute('aria-current', 'page');
    if (name !== 'game') document.title = 'Crossword Hub';
  }

  async function route() {
    const routeNow = currentRoute;
    const parts = currentRoute.replace(/^#\/?/, '').split('/');
    leaveGame();
    const today = todayKey();
    $('#dateline').textContent = `${longDate(today)} · Today's Daily: ${DAILY_SCHEDULE[parseKey(today).getDay()].level}`;

    if (parts[0] === 'daily' || parts[0] === 'mini') {
      const date = parts[1] && validDate(parts[1]) ? parts[1] : today;
      showView('game');
      window.scrollTo(0, 0);
      await withTimeout(loadMonth(date.slice(0, 7)), 4000);
      if (currentRoute !== routeNow) return;
      startGame(parts[0] === 'daily' ? dailySpec(date) : miniSpec(date));
      return;
    }
    if (parts[0] === 'play') {
      const genre = genreById(parts[1]);
      const difficulty = DIFFICULTIES[parts[2]] ? parts[2] : 'medium';
      const seed = Number(parts[3]);
      if (genre && Number.isFinite(seed)) {
        showView('game');
        window.scrollTo(0, 0);
        const pool = parts[4] || '';
        if (pool && pool[0] !== 'L' && !legacyLists) {
          legacyLists = await withTimeout(loadLegacyOrder(), 6000) || null;
          if (currentRoute !== routeNow) return;
        }
        const spec = genreSpec(genre, difficulty, seed, pool);
        if (!puzzleFor(spec)) {
          toast('That puzzle used words that have since been retired. Here’s a new one.');
          navigate(freshGenreSpec(genre, difficulty).url);
          return;
        }
        startGame(spec);
        return;
      }
    }
    game = null;
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

  // ---------- Installing as an app ----------
  // Chrome and Edge (Android, desktop) offer an install prompt we can trigger
  // from a button; iPhones and iPads need Share → Add to Home Screen.
  let installEvent = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function showInstallCard() {
    const card = $('#install-card');
    if (standalone() || store.installDismissed) { card.hidden = true; return; }
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
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
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
      if ($('#game-view').hidden) route();
    },
    onSave: (fn) => storeListeners.push(fn),
  };

  syncSettingsUI();
  showInstallCard();
  withTimeout(syncClock(), 1500)
    .then(() => withTimeout(loadMonth(todayKey().slice(0, 7)), 2500))
    .then(route);
})();
