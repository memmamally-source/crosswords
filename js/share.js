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
    if (parts[0] === 'arcade') return `/arcade${parts[1] === 'blitz' || parts[1] === 'survival' ? `/${parts[1]}` : ''}`;
    return `/${parts[0] || ''}`;
  }

  // ---------- The result image ----------
  // A 1080 × 1350 card (Instagram's portrait size; WhatsApp shows it whole),
  // styled like a page of a 1913 newspaper: parchment, a forest-green frame,
  // the masthead, the puzzle's name, the grid's shape with no letters, and
  // the time in a mustard rubber stamp. Revealed squares are tinted, so it
  // never spoils an answer.
  const COLOURS = {
    paper: '#efe5cc', square: '#fbf5e6', ink: '#2a241c', soft: '#5c5141', forest: '#2f5a43',
    mustard: '#e3b64c', mustardDeep: '#8a6512', blue: '#c6dce6', cream: '#f7efdc',
  };
  const FONTS = {
    display: '"Instrument Serif", "Newsreader", Georgia, serif',
    serif: '"Newsreader", Georgia, "Times New Roman", serif',
    sans: '"Public Sans", "Helvetica Neue", Arial, sans-serif',
  };
  function drawCard(canvas, d) {
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d');
    const centre = (text, y) => g.fillText(text, (W - g.measureText(text).width) / 2, y);

    // Forest-green frame around a parchment page with a faint speckle.
    g.fillStyle = COLOURS.forest;
    g.fillRect(0, 0, W, H);
    g.fillStyle = COLOURS.paper;
    g.fillRect(36, 36, W - 72, H - 72);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = 'rgba(90, 70, 40, 0.07)';
    for (let i = 0; i < 2600; i++) g.fillRect(36 + rnd() * (W - 72), 36 + rnd() * (H - 72), 2, 2);
    g.strokeStyle = COLOURS.mustard;
    g.lineWidth = 4;
    g.strokeRect(50, 50, W - 100, H - 100);
    const rule = (y) => {
      g.fillStyle = COLOURS.ink;
      g.fillRect(110, y, W - 220, 3);
      g.fillRect(110, y + 9, W - 220, 3);
    };

    // The masthead.
    g.textBaseline = 'alphabetic';
    g.fillStyle = COLOURS.ink;
    g.font = `400 112px ${FONTS.display}`;
    centre('Crossword Hub', 190);
    g.font = `800 22px ${FONTS.sans}`;
    if ('letterSpacing' in g) g.letterSpacing = '9px';
    centre('PUZZLES FOR EVERY DAY', 232);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    rule(256);

    // What was solved.
    g.font = `italic 700 40px ${FONTS.serif}`;
    centre(fit(g, `${d.kicker || ''}.`.replace(/\.\.$/, '.'), W - 240), 336);
    g.font = `400 66px ${FONTS.display}`;
    centre(fit(g, d.title || '', W - 240), 408);

    // The grid's shape, no letters.
    const box = { x: 110, y: 470, w: 470, h: 470 };
    if (d.grid) {
      const { rows, cols, filled, revealed } = d.grid;
      const size = Math.min(box.w / cols, box.h / rows);
      const gw = size * cols;
      const gh = size * rows;
      const ox = box.x + (box.w - gw) / 2;
      const oy = box.y + (box.h - gh) / 2;
      g.fillStyle = COLOURS.ink;
      g.fillRect(ox - 5, oy - 5, gw + 10, gh + 10);
      const line = Math.max(1, size * 0.07);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!filled[r][c]) continue;
          g.fillStyle = revealed && revealed[r][c] ? COLOURS.blue : COLOURS.square;
          g.fillRect(ox + c * size + line / 2, oy + r * size + line / 2, size - line, size - line);
        }
      }
    }

    // The time, in a mustard rubber stamp.
    const sx = 810;
    const sy = 705;
    g.save();
    g.translate(sx, sy);
    g.rotate(-0.14);
    g.fillStyle = COLOURS.mustard;
    g.beginPath();
    g.arc(0, 0, 178, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = COLOURS.ink;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, 178, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 160, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = COLOURS.ink;
    const top = d.noHint ? 'NO-HINT' : 'SOLVED';
    const bottom = d.noHint ? 'SOLVE' : d.points ? `${d.points} HINT POINT${d.points === 1 ? '' : 'S'}` : d.assisted ? 'CHECKED' : '0 HINT POINTS';
    const mid = (text, y) => g.fillText(text, -g.measureText(text).width / 2, y);
    g.font = `800 28px ${FONTS.sans}`;
    mid(top, -62);
    g.font = `400 ${d.time.length > 5 ? 104 : 124}px ${FONTS.display}`;
    mid(d.time, 40);
    g.font = `800 ${bottom.length > 12 ? 22 : 28}px ${FONTS.sans}`;
    mid(bottom, 96);
    g.restore();

    // The streak, as a forest-green label.
    if (d.streak) {
      const text = `${d.streak}-day streak`;
      g.font = `700 36px ${FONTS.sans}`;
      const w = g.measureText(text).width + 60;
      g.fillStyle = COLOURS.forest;
      g.fillRect((W - w) / 2, 990, w, 66);
      g.fillStyle = COLOURS.cream;
      centre(text, 1036);
    }

    // The invitation.
    rule(1094);
    g.fillStyle = COLOURS.ink;
    g.font = `400 84px ${FONTS.display}`;
    centre(d.cta || 'Can you beat it?', 1196);
    g.fillStyle = COLOURS.soft;
    g.font = `italic 400 32px ${FONTS.serif}`;
    centre(fit(g, d.site || '', W - 240), 1254);
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
