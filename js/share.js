/*
 * Sharing results: challenge links, the spoiler-free result image, and a few
 * helpers. The parts that don't draw are pure and tested in
 * tests/share.test.js.
 */
(function (root) {
  'use strict';

  // ---------- Challenge links ----------
  // A challenge rides on a puzzle link as "?c=<seconds>.<hint points>.<no-hint>",
  // for example #/daily/2026-10-19?c=252.0.1. It never reveals answers.
  function encodeChallenge({ time, points, noHint }) {
    return `${Math.max(0, Math.round(time))}.${Math.max(0, Math.round(points))}.${noHint ? 1 : 0}`;
  }
  function decodeChallenge(code) {
    const m = /^(\d{1,6})\.(\d{1,4})\.([01])$/.exec(code || '');
    return m ? { time: Number(m[1]), points: Number(m[2]), noHint: m[3] === '1' } : null;
  }
  // Splits '#/daily/2026-10-19?c=252.0.1' into the route and its challenge.
  function splitRoute(hash) {
    const q = hash.indexOf('?');
    if (q < 0) return { path: hash, challenge: null };
    const params = new URLSearchParams(hash.slice(q + 1));
    return { path: hash.slice(0, q), challenge: decodeChallenge(params.get('c')) };
  }
  // Did "mine" beat the challenge? Fewer hint points wins, then the faster time.
  function compareChallenge(mine, theirs) {
    if (mine.points !== theirs.points) return mine.points < theirs.points ? 'beat' : 'lost';
    if (mine.time !== theirs.time) return mine.time < theirs.time ? 'beat' : 'lost';
    return 'tie';
  }

  // ---------- Time until the next Daily ----------
  // The day turns at midnight South African time (UTC+2, no daylight saving).
  const SAST = 2 * 3600 * 1000;
  function msUntilNextDay(nowMs) {
    const day = 86400 * 1000;
    return day - ((nowMs + SAST) % day);
  }

  // ---------- Page names for analytics ----------
  // '#/play/friends/fan/0/L0abc…?c=1.0.0' → '/play/friends/fan'. Drops seeds,
  // grid codes and challenge data so page reports group sensibly and carry
  // nothing personal.
  function pagePath(hash) {
    const parts = splitRoute(hash || '#/').path.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'play') return `/play/${parts[1] || ''}/${parts[2] || ''}`.replace(/\/+$/, '');
    if (parts[0] === 'daily' || parts[0] === 'mini' || parts[0] === 'brutal') return `/${parts[0]}`;
    return `/${parts[0] || ''}`;
  }

  // ---------- The result image ----------
  // A 1080 × 1350 card (Instagram's portrait size; WhatsApp shows it whole):
  // the puzzle, the time, hint points and status, the streak, and the grid's
  // shape with no letters. Revealed squares are tinted, so it never spoils
  // an answer.
  const COLOURS = { navy: '#1b2540', midnight: '#121a2e', paper: '#fffdf8', gold: '#e0b13d', soft: '#c9cfdd', blue: '#5b8fd9' };
  function drawCard(canvas, d) {
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    const serif = '"Newsreader", Georgia, "Times New Roman", serif';
    const sans = '"Public Sans", "Helvetica Neue", Arial, sans-serif';
    g.fillStyle = COLOURS.navy;
    g.fillRect(0, 0, W, H);

    // Logo: an across word and a down word crossing at a gold square.
    const cell = 22;
    const gap = 3;
    for (let i = 0; i < 4; i++) {
      for (const [r, c] of [[1, i], [i, 2]]) {
        g.fillStyle = r === 1 && c === 2 ? COLOURS.gold : COLOURS.paper;
        g.fillRect(80 + c * (cell + gap), 80 + r * (cell + gap), cell, cell);
      }
    }
    g.fillStyle = COLOURS.paper;
    g.font = `700 44px ${serif}`;
    g.textBaseline = 'middle';
    g.fillText('Crossword Hub', 200, 130);

    // What was solved.
    g.textBaseline = 'alphabetic';
    g.fillStyle = COLOURS.gold;
    g.font = `800 30px ${sans}`;
    g.fillText(fit(g, (d.kicker || '').toUpperCase(), W - 160), 80, 270);
    g.fillStyle = COLOURS.paper;
    g.font = `700 64px ${serif}`;
    g.fillText(fit(g, d.title || '', W - 160), 80, 350);

    // The time and how it was solved.
    g.font = `800 150px ${sans}`;
    g.fillText(d.time, 80, 530);
    const status = d.noHint ? 'No-Hint solve' : d.points ? `${d.points} hint point${d.points === 1 ? '' : 's'}` : d.assisted ? '0 hint points · checked' : '0 hint points';
    g.font = `800 40px ${sans}`;
    const pillW = g.measureText(status).width + 56;
    g.fillStyle = d.noHint ? COLOURS.gold : 'rgba(255,253,248,0.12)';
    roundRect(g, 80, 575, pillW, 72, 36);
    g.fill();
    g.fillStyle = d.noHint ? COLOURS.navy : COLOURS.paper;
    g.fillText(status, 108, 625);
    if (d.streak) {
      g.fillStyle = COLOURS.soft;
      g.font = `600 36px ${sans}`;
      g.fillText(`${d.streak}-day streak`, 80 + pillW + 30, 625);
    }

    // The grid's shape, no letters.
    if (d.grid) {
      const { rows, cols, filled, revealed } = d.grid;
      const box = { x: 80, y: 700, w: W - 160, h: 440 };
      const size = Math.min(box.w / cols, box.h / rows);
      const ox = box.x + (box.w - size * cols) / 2;
      const oy = box.y + (box.h - size * rows) / 2;
      const inset = Math.max(1, size * 0.08);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!filled[r][c]) continue;
          g.fillStyle = revealed && revealed[r][c] ? COLOURS.blue : COLOURS.paper;
          g.fillRect(ox + c * size + inset / 2, oy + r * size + inset / 2, size - inset, size - inset);
        }
      }
    }

    // The invitation.
    g.fillStyle = COLOURS.paper;
    g.font = `700 46px ${serif}`;
    g.fillText(d.cta || 'Can you beat it?', 80, 1230);
    g.fillStyle = COLOURS.soft;
    g.font = `600 30px ${sans}`;
    g.fillText(fit(g, d.site || '', W - 160), 80, 1282);
    return canvas;
  }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  // Shortens text with an ellipsis to fit a width.
  function fit(g, text, width) {
    if (g.measureText(text).width <= width) return text;
    let t = text;
    while (t.length > 1 && g.measureText(`${t}…`).width > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  const api = { encodeChallenge, decodeChallenge, splitRoute, compareChallenge, msUntilNextDay, pagePath, drawCard };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordShare = api;
})(typeof window !== 'undefined' ? window : globalThis);
