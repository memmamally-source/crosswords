/* global CrosswordGenerator, GENRES, DIFFICULTIES */
(function () {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // ---------- Persistence (best effort: works without storage too) ----------
  const STORE_KEY = 'crosswordhub:v1';
  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  const store = Object.assign({ difficulty: 'medium', best: {}, solved: 0, daily: {}, saved: null }, loadStore());
  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {
      /* storage unavailable: progress just won't persist */
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dailyInfo() {
    const key = todayKey();
    const seed = Number(key.replace(/-/g, ''));
    const dayNumber = Math.floor(Date.UTC(...key.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) / 86400000);
    return { key, seed, genre: GENRES[dayNumber % GENRES.length], difficulty: 'medium' };
  }

  const genreById = (id) => GENRES.find((g) => g.id === id);

  // ---------- Home view ----------
  function renderHome() {
    $$('.difficulty button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.difficulty === store.difficulty)));

    const grid = $('#genre-grid');
    grid.innerHTML = '';
    for (const g of GENRES) {
      const best = store.best[`${g.id}:${store.difficulty}`];
      const card = document.createElement('button');
      card.className = 'genre-card';
      card.innerHTML = `
        <span class="icon" aria-hidden="true">${g.icon}</span>
        <h3></h3>
        <p></p>
        <span class="meta">
          <span>${g.words.length} words in bank</span>
          ${best ? `<span class="best">Best ${formatTime(best)}</span>` : ''}
        </span>`;
      $('h3', card).textContent = g.name;
      $('p', card).textContent = g.blurb;
      card.addEventListener('click', () => play(g.id, store.difficulty));
      grid.appendChild(card);
    }

    const daily = dailyInfo();
    const doneTime = store.daily[daily.key];
    $('#daily-card').innerHTML = `
      <span class="daily-icon" aria-hidden="true">${daily.genre.icon}</span>
      <div>
        <h2>Daily Challenge</h2>
        <p>Today's theme: <strong>${daily.genre.name}</strong> · ${doneTime ? `solved in ${formatTime(doneTime)} ✓` : 'same puzzle for everyone today'}</p>
      </div>
      <button class="btn primary" data-action="daily">${doneTime ? 'Play again' : 'Play today’s puzzle'}</button>`;

    $('#header-stats').innerHTML = store.solved ? `<strong>${store.solved}</strong> puzzle${store.solved === 1 ? '' : 's'} solved` : '';
  }

  $$('.difficulty button').forEach((b) =>
    b.addEventListener('click', () => {
      store.difficulty = b.dataset.difficulty;
      saveStore();
      renderHome();
    })
  );

  function play(genreId, difficulty, seed) {
    const s = seed != null ? seed : Math.floor(Math.random() * 1e9);
    navigate(`#/play/${genreId}/${difficulty}/${s}`);
  }

  // ---------- Game state ----------
  let game = null;

  function newGame({ genre, difficulty, seed, daily }) {
    const cfg = DIFFICULTIES[difficulty];
    const puzzle = CrosswordGenerator.generate(genre.words, { count: cfg.count, maxSize: cfg.maxSize, seed });
    const blank = () => Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(''));
    const flags = () => Array.from({ length: puzzle.rows }, () => Array(puzzle.cols).fill(false));

    const wordAt = Array.from({ length: puzzle.rows }, () => Array.from({ length: puzzle.cols }, () => ({})));
    puzzle.words.forEach((w, i) => w.cells.forEach(([r, c]) => (wordAt[r][c][w.dir] = i)));

    game = {
      genre, difficulty, seed, daily, puzzle, wordAt,
      entries: blank(),
      revealed: flags(),
      wrong: flags(),
      sel: null,
      elapsed: 0,
      startedAt: null,
      solved: false,
      reveals: 0,
      checks: 0,
    };

    // Resume a saved game if it is this exact puzzle.
    const saved = store.saved;
    if (saved && saved.genre === genre.id && saved.difficulty === difficulty && saved.seed === seed && !!saved.daily === !!daily) {
      game.entries = saved.entries;
      game.revealed = saved.revealed;
      game.elapsed = saved.elapsed || 0;
      game.reveals = saved.reveals || 0;
      game.checks = saved.checks || 0;
    }

    const first = puzzle.words[0];
    game.sel = { r: first.row, c: first.col, dir: first.dir };
    renderGame();
    if (isSolved()) {
      game.solved = true;
      $('#board').classList.add('solved');
      $('#timer').textContent = formatTime(game.elapsed);
    } else {
      startTimer();
    }
  }

  function persist() {
    if (!game) return;
    if (game.solved) {
      store.saved = null;
    } else {
      store.saved = {
        genre: game.genre.id,
        difficulty: game.difficulty,
        seed: game.seed,
        daily: game.daily,
        entries: game.entries,
        revealed: game.revealed,
        elapsed: currentElapsed(),
        reveals: game.reveals,
        checks: game.checks,
      };
    }
    saveStore();
  }

  // ---------- Timer ----------
  let tick = null;
  function currentElapsed() {
    if (!game) return 0;
    return game.elapsed + (game.startedAt ? Math.floor((Date.now() - game.startedAt) / 1000) : 0);
  }
  function startTimer() {
    stopTimer();
    game.startedAt = Date.now();
    tick = setInterval(() => ($('#timer').textContent = formatTime(currentElapsed())), 500);
    $('#timer').textContent = formatTime(currentElapsed());
  }
  function stopTimer() {
    if (game && game.startedAt) {
      game.elapsed = currentElapsed();
      game.startedAt = null;
    }
    clearInterval(tick);
    tick = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (!game || game.solved || $('#game-view').hidden) return;
    if (document.hidden) {
      stopTimer();
      persist();
    } else {
      startTimer();
    }
  });
  window.addEventListener('pagehide', persist);

  // ---------- Rendering ----------
  let cellEls = [];

  function renderGame() {
    const { puzzle, genre, difficulty, daily } = game;
    $('#game-icon').textContent = genre.icon;
    $('#game-name').textContent = daily ? 'Daily Challenge' : genre.name;
    $('#game-sub').textContent = `${daily ? genre.name + ' · ' : ''}${DIFFICULTIES[difficulty].label} · ${puzzle.words.length} clues`;
    $('#autocheck').checked = !!store.autocheck;

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
          el.innerHTML = `${n ? `<span class="num">${n}</span>` : ''}<span class="letter"></span>`;
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            onCellClick(r, c);
          });
        }
        board.appendChild(el);
        cellEls[r].push(el);
      }
    }

    for (const dir of ['across', 'down']) {
      const list = $(`#clues-${dir}`);
      list.innerHTML = '';
      puzzle.words.forEach((w, i) => {
        if (w.dir !== dir) return;
        const li = document.createElement('li');
        li.dataset.index = i;
        li.innerHTML = `<strong>${w.number}</strong><span></span>`;
        $('span', li).textContent = `${w.clue} (${w.answer.length})`;
        li.addEventListener('click', () => {
          game.sel = { ...firstEmptyCell(i), dir: w.dir };
          refresh();
        });
        list.appendChild(li);
      });
    }

    sizeBoard();
    refresh();
  }

  function sizeBoard() {
    if (!game) return;
    const wrap = $('#board-wrap');
    const avail = wrap.clientWidth - 4;
    const vh = window.innerHeight * (matchMedia('(pointer: coarse)').matches ? 0.48 : 0.72);
    const size = Math.max(20, Math.min(46, Math.floor(avail / game.puzzle.cols), Math.floor(vh / game.puzzle.rows)));
    $('#board').style.setProperty('--size', size + 'px');
  }
  window.addEventListener('resize', sizeBoard);

  function currentWordIndex() {
    const { r, c, dir } = game.sel;
    return game.wordAt[r][c][dir];
  }

  function refresh() {
    const { puzzle, sel, entries, revealed, wrong } = game;
    const wi = currentWordIndex();
    const word = puzzle.words[wi];
    const inWord = new Set(word.cells.map(([r, c]) => r + ',' + c));
    const crossDir = sel.dir === 'across' ? 'down' : 'across';
    const crossIndex = game.wordAt[sel.r][sel.c][crossDir];

    let filled = 0;
    let total = 0;
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        if (!puzzle.solution[r][c]) continue;
        total++;
        if (entries[r][c]) filled++;
        const el = cellEls[r][c];
        $('.letter', el).textContent = entries[r][c];
        el.classList.toggle('in-word', inWord.has(r + ',' + c));
        el.classList.toggle('active', r === sel.r && c === sel.c);
        el.classList.toggle('revealed', revealed[r][c]);
        el.classList.toggle('wrong', wrong[r][c] && !!entries[r][c]);
      }
    }

    $$('.clues li').forEach((li) => {
      const i = Number(li.dataset.index);
      const w = puzzle.words[i];
      li.classList.toggle('current', i === wi);
      li.classList.toggle('cross', i === crossIndex);
      li.classList.toggle('done', w.cells.every(([r, c]) => entries[r][c]));
    });
    const currentLi = $(`.clues li[data-index="${wi}"]`);
    if (currentLi && !matchMedia('(max-width: 900px)').matches) currentLi.scrollIntoView({ block: 'nearest' });

    $('#clue-bar-num').textContent = `${word.number}${word.dir === 'across' ? 'A' : 'D'}`;
    $('#clue-bar-text').textContent = word.clue;
    $('#progress-fill').style.width = `${(filled / total) * 100}%`;
  }

  // ---------- Navigation ----------
  function hasLetter(r, c) {
    return !!(game.puzzle.solution[r] && game.puzzle.solution[r][c]);
  }

  function firstEmptyCell(wi) {
    const w = game.puzzle.words[wi];
    const cell = w.cells.find(([r, c]) => !game.entries[r][c]) || w.cells[0];
    return { r: cell[0], c: cell[1] };
  }

  function onCellClick(r, c) {
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
        game.sel = { r, c, dir: wordAt[r][c][axis] != null ? axis : sel.dir === axis ? (axis === 'across' ? 'down' : 'across') : sel.dir };
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

  function typeLetter(ch) {
    if (game.solved) return;
    const { sel, entries, revealed } = game;
    if (!revealed[sel.r][sel.c]) {
      entries[sel.r][sel.c] = ch;
      game.wrong[sel.r][sel.c] = store.autocheck ? ch !== game.puzzle.solution[sel.r][sel.c] : false;
    }

    const word = game.puzzle.words[currentWordIndex()];
    const pos = word.cells.findIndex(([r, c]) => r === sel.r && c === sel.c);
    if (pos < word.cells.length - 1) {
      [sel.r, sel.c] = word.cells[pos + 1];
    } else if (word.cells.every(([r, c]) => entries[r][c])) {
      jumpWord(1, true);
    }
    afterChange();
  }

  function backspace() {
    if (game.solved) return;
    const { sel, entries, revealed } = game;
    if (entries[sel.r][sel.c] && !revealed[sel.r][sel.c]) {
      entries[sel.r][sel.c] = '';
      game.wrong[sel.r][sel.c] = false;
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
      const { r, c } = game.sel;
      if (!revealed[r][c]) {
        entries[r][c] = '';
        game.wrong[r][c] = false;
      }
    }
    afterChange();
  }

  // ---------- Check / reveal ----------
  function targetCells(scope) {
    if (scope === 'cell') return [[game.sel.r, game.sel.c]];
    if (scope === 'word') return game.puzzle.words[currentWordIndex()].cells;
    const all = [];
    game.puzzle.solution.forEach((row, r) => row.forEach((ch, c) => ch && all.push([r, c])));
    return all;
  }

  function check(scope) {
    game.checks++;
    let wrongCount = 0;
    for (const [r, c] of targetCells(scope)) {
      const bad = !!game.entries[r][c] && game.entries[r][c] !== game.puzzle.solution[r][c];
      game.wrong[r][c] = bad;
      if (bad) wrongCount++;
    }
    toast(wrongCount ? `${wrongCount} incorrect letter${wrongCount === 1 ? '' : 's'}` : 'Looking good so far!');
    afterChange();
  }

  function reveal(scope) {
    if (scope === 'all' && !armReveal()) return;
    for (const [r, c] of targetCells(scope)) {
      if (game.entries[r][c] !== game.puzzle.solution[r][c]) {
        game.entries[r][c] = game.puzzle.solution[r][c];
        game.revealed[r][c] = true;
        game.reveals++;
      }
      game.wrong[r][c] = false;
    }
    afterChange();
  }

  // Two-step confirmation for revealing everything (no browser dialogs).
  let revealArmed = 0;
  function armReveal() {
    if (Date.now() - revealArmed < 4000) {
      revealArmed = 0;
      return true;
    }
    revealArmed = Date.now();
    toast('Choose Reveal → Puzzle again to show every answer');
    return false;
  }

  function clearBoard() {
    game.puzzle.solution.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (ch && !game.revealed[r][c]) game.entries[r][c] = '';
        game.wrong[r][c] = false;
      })
    );
    afterChange();
  }

  function isSolved() {
    return game.puzzle.solution.every((row, r) => row.every((ch, c) => !ch || game.entries[r][c] === ch));
  }

  let lastFullWarning = '';
  function afterChange() {
    if (!game.solved && isSolved()) {
      win();
    } else if (!game.solved) {
      const full = game.puzzle.solution.every((row, r) => row.every((ch, c) => !ch || game.entries[r][c]));
      const snapshot = JSON.stringify(game.entries);
      if (full && snapshot !== lastFullWarning) {
        lastFullWarning = snapshot;
        toast('Grid is full, but something’s not right yet. Try Check.');
      }
    }
    refresh();
    persist();
  }

  function win() {
    game.solved = true;
    stopTimer();
    const time = game.elapsed;
    const clean = game.reveals === 0;
    const bestKey = `${game.genre.id}:${game.difficulty}`;
    let newBest = false;
    store.solved = (store.solved || 0) + 1;
    if (clean && (!store.best[bestKey] || time < store.best[bestKey])) {
      store.best[bestKey] = time;
      newBest = true;
    }
    if (game.daily) {
      const key = dailyInfo().key;
      if (!store.daily[key] || time < store.daily[key]) store.daily[key] = time;
    }
    store.saved = null;
    saveStore();

    $('#timer').textContent = formatTime(time);
    $('#board').classList.add('solved');
    $('#win-icon').textContent = clean ? (newBest ? '🏆' : '🎉') : '👍';
    $('#win-title').textContent = clean ? 'Solved!' : 'Finished!';
    $('#win-text').textContent = clean
      ? `You completed ${game.genre.name} (${DIFFICULTIES[game.difficulty].label}) in ${formatTime(time)}.${newBest ? ' New personal best!' : ''}`
      : `Completed in ${formatTime(time)} with ${game.reveals} revealed letter${game.reveals === 1 ? '' : 's'}. Solve one without reveals to set a best time.`;
    setTimeout(() => $('#win-dialog').showModal(), 650);
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      Object.assign(el.style, {
        position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
        background: 'var(--ink)', color: 'var(--surface)', padding: '10px 18px',
        borderRadius: '999px', fontWeight: '600', fontSize: '0.92rem', zIndex: 50,
        boxShadow: 'var(--shadow)', transition: 'opacity 0.2s', maxWidth: 'calc(100vw - 32px)', textAlign: 'center',
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.opacity = '0'), 2200);
  }

  // ---------- Input ----------
  document.addEventListener('keydown', (e) => {
    if (!game || $('#game-view').hidden || $('#win-dialog').open) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches && e.target.matches('input, textarea')) return;
    const k = e.key;
    if (/^[a-z]$/i.test(k)) {
      typeLetter(k.toUpperCase());
    } else if (k === 'Backspace') {
      backspace();
    } else if (k === 'Delete') {
      if (!game.revealed[game.sel.r][game.sel.c]) game.entries[game.sel.r][game.sel.c] = '';
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

  function buildKeyboard() {
    const kb = $('#keyboard');
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', '⇄ZXCVBNM⌫'];
    for (const row of rows) {
      const div = document.createElement('div');
      div.className = 'row';
      for (const ch of row) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = ch;
        if (ch === '⇄') { b.className = 'wide'; b.setAttribute('aria-label', 'Switch direction'); }
        if (ch === '⌫') { b.className = 'wide'; b.setAttribute('aria-label', 'Backspace'); }
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (!game) return;
          if (ch === '⌫') backspace();
          else if (ch === '⇄') { toggleDir(); refresh(); }
          else typeLetter(ch);
        });
        div.appendChild(b);
      }
      kb.appendChild(div);
    }
  }

  // ---------- Buttons ----------
  function closeMenus() {
    $$('.menu-list').forEach((m) => (m.hidden = true));
  }
  document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) {
      const list = $(`[data-menu-list="${menuBtn.dataset.menu}"]`);
      const wasHidden = list.hidden;
      closeMenus();
      list.hidden = !wasHidden;
      return;
    }
    const actionEl = e.target.closest('[data-action]');
    closeMenus();
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === 'home') {
      e.preventDefault();
      $('#win-dialog').close();
      navigate('#/');
      return;
    }
    if (action === 'daily') {
      navigate('#/daily');
      return;
    }
    if (!game) return;
    switch (action) {
      case 'check-cell': check('cell'); break;
      case 'check-word': check('word'); break;
      case 'check-all': check('all'); break;
      case 'reveal-cell': reveal('cell'); break;
      case 'reveal-word': reveal('word'); break;
      case 'reveal-all': reveal('all'); break;
      case 'clear': clearBoard(); break;
      case 'next-word': jumpWord(1, false); refresh(); break;
      case 'prev-word': jumpWord(-1, false); refresh(); break;
      case 'new':
        $('#win-dialog').close();
        play(game.genre.id, game.difficulty);
        break;
    }
  });

  $('#autocheck').addEventListener('change', (e) => {
    store.autocheck = e.target.checked;
    if (game) {
      game.puzzle.solution.forEach((row, r) =>
        row.forEach((ch, c) => {
          game.wrong[r][c] = store.autocheck && !!ch && !!game.entries[r][c] && game.entries[r][c] !== ch;
        })
      );
      refresh();
    }
    saveStore();
  });

  // ---------- Routing ----------
  // The route lives in memory and is mirrored to the URL hash when the host
  // allows it, so puzzle links are shareable on a normal web host.
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
  function onUrlChange() {
    currentRoute = location.hash || '#/';
    route();
  }
  function showView(name) {
    $('#home-view').hidden = name !== 'home';
    $('#game-view').hidden = name !== 'game';
    window.scrollTo(0, 0);
  }

  function route() {
    const parts = currentRoute.replace(/^#\/?/, '').split('/');
    if (game && !game.solved) {
      stopTimer();
      persist();
    }
    if (parts[0] === 'daily') {
      const d = dailyInfo();
      showView('game');
      newGame({ genre: d.genre, difficulty: d.difficulty, seed: d.seed, daily: true });
      return;
    }
    if (parts[0] === 'play') {
      const genre = genreById(parts[1]);
      const difficulty = DIFFICULTIES[parts[2]] ? parts[2] : 'medium';
      const seed = Number(parts[3]);
      if (genre && Number.isFinite(seed)) {
        showView('game');
        newGame({ genre, difficulty, seed, daily: false });
        return;
      }
    }
    game = null;
    showView('home');
    renderHome();
  }

  buildKeyboard();
  window.addEventListener('popstate', onUrlChange);
  route();
})();
