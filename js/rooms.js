/*
 * Multiplayer rooms ("Help me solve"): the parts that don't talk to Firebase,
 * so they can be tested without a browser (tests/rooms.test.js).
 *
 * A room holds one puzzle that up to five players fill in together. Squares
 * are stored as cells/<row>_<col> = { v: 'A', by: <uid>, rev: true if
 * revealed }. The Firebase side is in js/room.js and the rules in
 * database.rules.json.
 */
(function (root) {
  'use strict';

  const MAX_PLAYERS = 5;
  const LIFETIME_DAYS = 7;
  // One colour per seat, readable on both themes and distinct from the gold
  // active square and the blue current word.
  const COLOURS = ['#d1495b', '#2a9d8f', '#8e5bd1', '#e07a1f', '#3f88c5'];

  // 12 random lowercase letters and digits: unguessable, and easy to share.
  function newRoomId(random = cryptoRandom) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (const n of random(12)) id += chars[n % chars.length];
    return id;
  }
  function cryptoRandom(n) {
    const a = new Uint8Array(n);
    (root.crypto || require('crypto').webcrypto).getRandomValues(a);
    return a;
  }
  const validRoomId = (id) => /^[a-z0-9]{12}$/.test(id || '');

  const cellKey = (r, c) => `${r}_${c}`;
  const parseKey = (k) => k.split('_').map(Number);

  // The room's squares for a grid: { 'r_c': { v, rev } } for filled squares.
  function gridToCells(entries, revealed) {
    const cells = {};
    entries.forEach((row, r) => row.forEach((v, c) => {
      if (v) cells[cellKey(r, c)] = revealed && revealed[r][c] ? { v, rev: true } : { v };
    }));
    return cells;
  }

  // Squares that differ between what the room last had and the grid now:
  // { 'r_c': { v, rev } | null } (null clears a square).
  function diffCells(sent, entries, revealed) {
    const now = gridToCells(entries, revealed);
    const out = {};
    for (const [k, cell] of Object.entries(now)) {
      const was = sent[k];
      if (!was || was.v !== cell.v || !!was.rev !== !!cell.rev) out[k] = cell;
    }
    for (const k of Object.keys(sent)) if (!now[k]) out[k] = null;
    return out;
  }

  // Player names: letters, digits, spaces and . ' _ -, 1 to 20 characters.
  function cleanName(name) {
    const s = String(name || '').normalize('NFKD').replace(/[^\w .'-]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20).trim();
    return /^[A-Za-z0-9 .'-]{1,20}$/.test(s) ? s : '';
  }
  const ADJECTIVES = ['Clever', 'Swift', 'Witty', 'Bold', 'Sharp', 'Bright', 'Quiet', 'Lucky', 'Keen', 'Daring'];
  const ANIMALS = ['Owl', 'Fox', 'Otter', 'Hawk', 'Lynx', 'Panda', 'Heron', 'Badger', 'Puffin', 'Gecko'];
  function randomName(random = cryptoRandom) {
    const [a, b] = random(2);
    return `${ADJECTIVES[a % ADJECTIVES.length]} ${ANIMALS[b % ANIMALS.length]}`;
  }

  // The shared clock: the host's time when the room opened, plus time since.
  function roomElapsed(base, createdAt, serverNow) {
    return Math.max(0, Math.floor(base + (serverNow - createdAt) / 1000));
  }

  // Everyone's hints added up: { uid: { letter, word, checks, autocheck } }.
  function sumHints(byPlayer) {
    const t = { letter: 0, word: 0, checks: 0, autocheck: false };
    for (const h of Object.values(byPlayer || {})) {
      t.letter += h.letter || 0;
      t.word += h.word || 0;
      t.checks += h.checks || 0;
      t.autocheck = t.autocheck || !!h.autocheck;
    }
    return t;
  }

  // Seats are numbered 1 to 5; the first free one (or the player's own).
  function freeSeat(slots, uid) {
    for (let n = 1; n <= MAX_PLAYERS; n++) if (slots && slots[n] && slots[n].uid === uid) return n;
    for (let n = 1; n <= MAX_PLAYERS; n++) if (!slots || !slots[n]) return n;
    return null;
  }

  const api = {
    MAX_PLAYERS, LIFETIME_DAYS, COLOURS, newRoomId, validRoomId, cellKey, parseKey,
    gridToCells, diffCells, cleanName, randomName, roomElapsed, sumHints, freeSeat,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrosswordRooms = api;
})(typeof window !== 'undefined' ? window : globalThis);
