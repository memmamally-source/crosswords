/*
 * Crossword Hub's trusted server (Cloud Functions for Firebase).
 *
 * Every change to a hint-credit wallet and every duel result happens here,
 * inside a Firestore transaction, using the rules in js/economy.js. The
 * page can read its own wallet and duels but never write them
 * (firestore.rules), so balances can't be edited, credits can't be minted
 * and nobody can declare themselves a winner.
 *
 *   Wallets:  walletSync, spendHint, claimSolve
 *   Duels:    duelCreate, duelJoin, duelQuick, duelQuickCancel, duelReady,
 *             duelState, duelHint, duelProgress, duelLeave, duelSettle,
 *             duelReport, duelBlock
 *   Account:  accountDelete
 *
 * Collections (all written only by this server):
 *   wallets/{uid}                 balances, totals and today's duel rewards
 *   wallets/{uid}/ledger/{id}     every credit added or spent
 *   wallets/{uid}/spent/{puzzle}  hints bought on a puzzle (no double charges;
 *                                 a puzzle with any hint earns no No-Hint credits)
 *   wallets/{uid}/claims/{puzzle} No-Hint rewards paid (once per puzzle)
 *   players/{uid}                 duel records and a Quick Match that was found
 *   duels/{id}                    a duel: players, hidden-answer puzzle, progress, result
 *   duels/{id}/secret/solution    its answers, and its clues until the start (never readable by players)
 *   duels/{id}/presence/{uid}     "still here" heartbeats (the one thing players write)
 *   duelCodes/{code}              private challenge codes
 *   quick/{mode}                  the player waiting for a Quick Match
 *   blocks/{uid}                  players this player has blocked (never matched again)
 *   reports/{duel_reporter}       a duel opponent's name reported as offensive
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const E = require('./site/js/economy.js');
const P = require('./puzzles.js');

admin.initializeApp();
const db = admin.firestore();

// One region, and a ceiling on instances so a surge can't run up costs.
setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'europe-west1', maxInstances: 10, memory: '512MiB' });

// ---------- Helpers ----------
const fail = (code, message) => {
  throw new HttpsError(code, message);
};
function caller(req) {
  if (!req.auth) fail('unauthenticated', 'Sign in first.');
  return req.auth.uid;
}
// A real account (not a guest's anonymous sign-in).
function account(req) {
  const uid = caller(req);
  if (req.auth.token.firebase && req.auth.token.firebase.sign_in_provider === 'anonymous') fail('permission-denied', 'Sign in to use hint credits.');
  return uid;
}
const isGuest = (req) => !!(req.auth.token.firebase && req.auth.token.firebase.sign_in_provider === 'anonymous');
const now = () => Date.now();
const today = (ms = now()) => E.sastDay(ms);
// Puzzle keys become document ids ('/' isn't allowed in one).
const docId = (key) => key.replace(/\//g, '|');
// The page's puzzle keys (spec.key in js/app.js): published puzzles, genre
// and collection puzzles (with their layout code), and gifts (by a hash, so
// nothing personal in a gift ever reaches the server).
const PUZZLE_KEY = /^(?:(?:daily|mini|brutal):\d{4}-\d{2}-\d{2}|play:[a-z0-9-]{1,40}\/[a-z]{1,12}\/\d{1,12}\/[A-Za-z0-9.]{0,600}|gift:[A-Za-z0-9_-]{1,40})$/;

const walletRef = (uid) => db.doc(`wallets/${uid}`);
const ledgerRef = (uid) => db.collection(`wallets/${uid}/ledger`).doc();
const playerRef = (uid) => db.doc(`players/${uid}`);

// What the page shows: balances, totals and the time to the next reset.
function view(w, ms = now()) {
  const day = today(ms);
  return {
    daily: w.dailyDay === day ? w.daily : 0,
    earned: w.earned,
    total: E.available(w, day),
    totals: w.totals,
    resetIn: E.msUntilReset(ms),
    winsToday: w.winsDay === day ? w.wins : 0,
    collectionsToday: w.collectionsDay === day ? w.collections : 0,
  };
}
function ledgerEntry(t, uid, entry) {
  t.set(ledgerRef(uid), { ...entry, at: FieldValue.serverTimestamp() });
}
// Gives today's allowance if it hasn't been given (inside a transaction).
function withDaily(t, uid, raw, ms) {
  const { wallet, granted, expired } = E.refreshDaily(raw, today(ms));
  if (expired) ledgerEntry(t, uid, { type: 'expire', amount: -expired, daily: -expired, earned: 0, note: 'Unused daily credits expired' });
  if (granted) ledgerEntry(t, uid, { type: 'daily', amount: granted, daily: granted, earned: 0, note: 'Your daily credits' });
  return { wallet, granted };
}

// ---------- Wallets ----------
// Today's balance (and, once a day, the 5 daily credits). Safe to call as
// often as you like: the allowance is given once per day per account.
exports.walletSync = onCall(async (req) => {
  const uid = account(req);
  const ms = now();
  const res = await db.runTransaction(async (t) => {
    const snap = await t.get(walletRef(uid));
    const { wallet, granted } = withDaily(t, uid, snap.exists ? snap.data() : null, ms);
    if (granted || !snap.exists) t.set(walletRef(uid), { ...wallet, updatedAt: FieldValue.serverTimestamp() });
    return { wallet, granted };
  });
  const recent = await db.collection(`wallets/${uid}/ledger`).orderBy('at', 'desc').limit(E.ECONOMY.ledgerKept).get();
  return {
    wallet: view(res.wallet, ms),
    granted: res.granted,
    recent: recent.docs.map((d) => {
      const x = d.data();
      return { type: x.type, amount: x.amount, note: x.note, at: x.at ? x.at.toMillis() : ms };
    }),
  };
});

// Reveal Letter (1 credit) or Reveal Word (3). Charged once per square or
// word of a puzzle: asking again for one already bought costs nothing.
// The page reveals the answer only after this succeeds.
exports.spendHint = onCall(async (req) => {
  const uid = account(req);
  const { puzzle, kind, target } = req.data || {};
  if (typeof puzzle !== 'string' || !PUZZLE_KEY.test(puzzle)) fail('invalid-argument', 'Unknown puzzle.');
  if (kind !== 'letter' && kind !== 'word') fail('invalid-argument', 'Unknown hint.');
  if (typeof target !== 'string' || !/^[ad]?\d{1,2}_\d{1,2}$/.test(target)) fail('invalid-argument', 'Unknown square.');
  const cost = E.ECONOMY.cost[kind];
  const ms = now();
  const spentRef = db.doc(`wallets/${uid}/spent/${docId(puzzle)}`);
  return db.runTransaction(async (t) => {
    const [wSnap, sSnap] = await Promise.all([t.get(walletRef(uid)), t.get(spentRef)]);
    const { wallet, granted } = withDaily(t, uid, wSnap.exists ? wSnap.data() : null, ms);
    const bought = sSnap.exists ? sSnap.data() : { letters: [], words: [] };
    const list = kind === 'letter' ? bought.letters : bought.words;
    if (list.includes(target)) {
      if (granted) t.set(walletRef(uid), wallet);
      return { ok: true, charged: 0, wallet: view(wallet, ms) };
    }
    if (list.length >= 500) fail('resource-exhausted', 'Too many hints on one puzzle.');
    const paid = E.spend(wallet, cost, today(ms));
    if (!paid) {
      if (granted) t.set(walletRef(uid), wallet);
      return { ok: false, reason: 'insufficient', charged: 0, wallet: view(wallet, ms) };
    }
    t.set(walletRef(uid), { ...paid.wallet, updatedAt: FieldValue.serverTimestamp() });
    t.set(spentRef, { ...bought, [kind === 'letter' ? 'letters' : 'words']: [...list, target], updatedAt: FieldValue.serverTimestamp() });
    ledgerEntry(t, uid, { type: 'spend', amount: -cost, daily: -paid.fromDaily, earned: -paid.fromEarned, note: kind === 'letter' ? 'Revealed a letter' : 'Revealed a word' });
    return { ok: true, charged: cost, wallet: view(paid.wallet, ms) };
  });
});

// A first No-Hint solve of a published Daily (3 credits), Mini (1) or
// Brutal Challenge (3). The finished grid is checked against the answers;
// each puzzle pays once per account, and never after a hint was bought on it.
exports.claimSolve = onCall(async (req) => {
  const uid = account(req);
  const { puzzle, grid } = req.data || {};
  const ms = now();
  const reward = E.puzzleReward(puzzle, E.sastDate(ms));
  if (!reward) return { ok: false, reason: 'not-eligible' };
  const collection = reward.kind === 'collection';
  const answers = collection ? P.collection(puzzle, E.ECONOMY.collectionMinClues) : P.published(puzzle);
  if (!answers) return { ok: false, reason: collection ? 'too-small' : 'not-eligible' };
  if (!E.validGrid(grid, answers.rows, answers.cols) || !E.progress(grid, answers.solution).solved) return { ok: false, reason: 'incorrect' };
  const claimRef = db.doc(`wallets/${uid}/claims/${docId(puzzle)}`);
  const spentRef = db.doc(`wallets/${uid}/spent/${docId(puzzle)}`);
  return db.runTransaction(async (t) => {
    const [wSnap, cSnap, sSnap] = await Promise.all([t.get(walletRef(uid)), t.get(claimRef), t.get(spentRef)]);
    const { wallet } = withDaily(t, uid, wSnap.exists ? wSnap.data() : null, ms);
    if (cSnap.exists || sSnap.exists) {
      t.set(walletRef(uid), wallet);
      return { ok: false, reason: cSnap.exists ? 'already' : 'assisted', wallet: view(wallet, ms) };
    }
    // Genre and collection puzzles never run out, so only a few a day earn.
    if (collection && E.collectionReward(wallet, today(ms)).why === 'daily-limit') {
      t.set(walletRef(uid), wallet);
      return { ok: false, reason: 'daily-limit', wallet: view(wallet, ms) };
    }
    let next = E.earn(wallet, reward.amount, 'solves');
    if (collection) next = E.recordCollectionReward(next, today(ms));
    t.set(walletRef(uid), { ...next, updatedAt: FieldValue.serverTimestamp() });
    t.create(claimRef, { amount: reward.amount, at: FieldValue.serverTimestamp() });
    const note = { mini: 'Mini solved without hints', collection: 'Collection crossword solved without hints' }[reward.kind] || 'Crossword solved without hints';
    ledgerEntry(t, uid, { type: 'solve', amount: reward.amount, daily: 0, earned: reward.amount, note });
    return { ok: true, amount: reward.amount, kind: reward.kind, wallet: view(next, ms) };
  });
});

// ---------- Duels ----------
const duelRef = (id) => db.doc(`duels/${id}`);
const secretRef = (id) => db.doc(`duels/${id}/secret/solution`);
function newCode() {
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (b) => E.CODE_ALPHABET[b % E.CODE_ALPHABET.length]).join('');
}
function cleanName(name, guest) {
  if (E.validName(name)) return name.trim();
  return guest ? 'Guest' : 'Player';
}
function checkMode(mode) {
  if (!E.DUELS[mode]) fail('invalid-argument', 'Choose Mini Duel or Classic Duel.');
}
// A new duel puzzle, its answers kept apart. Built before any transaction.
function puzzleFor(mode) {
  const seed = crypto.randomBytes(4).readUInt32BE(0) % 2147483647;
  return P.duel(mode, seed);
}
function playerEntry(req, name) {
  return { name: cleanName(name, isGuest(req)), ready: false, progress: 0, account: !isGuest(req), left: false };
}
function newDuel(t, { mode, players, uids, host, code, invited = null, rematchOf = null, status, built, ms }) {
  const ref = db.collection('duels').doc();
  t.create(ref, {
    mode, status, host, uids, players, code: code || null, invited, rematchOf,
    puzzle: null, // released when the duel starts, so nobody sees the clues early
    createdAt: ms, expiresAt: ms + E.DUELS.lobbyHours * 3600000,
    startAt: null, endsAt: null, winner: null, result: null, rematch: null,
  });
  t.create(secretRef(ref.id), { rows: P.pack(built.solution), puzzle: JSON.stringify(built.hidden) });
  return ref;
}
const isParticipant = (d, uid) => Array.isArray(d.uids) && d.uids.includes(uid);
// Blocked players never meet again: no Quick Match, challenge or rematch
// between them, whichever of the two did the blocking.
const blocksRef = (uid) => db.doc(`blocks/${uid}`);
async function blockedEither(t, a, b) {
  const [x, y] = await Promise.all([t.get(blocksRef(a)), t.get(blocksRef(b))]);
  const has = (snap, uid) => snap.exists && Array.isArray(snap.data().uids) && snap.data().uids.includes(uid);
  return has(x, b) || has(y, a);
}

// A private challenge: returns its id and a code to share.
exports.duelCreate = onCall(async (req) => {
  const uid = caller(req);
  const { mode, name, rematchOf } = req.data || {};
  const ms = now();
  if (rematchOf) {
    // A rematch: the same two players, the same kind of duel, a new puzzle.
    return db.runTransaction(async (t) => {
      const old = await t.get(duelRef(String(rematchOf)));
      if (!old.exists || !isParticipant(old.data(), uid)) fail('not-found', 'That duel isn’t yours.');
      const d = old.data();
      if (d.status !== 'done') fail('failed-precondition', 'That duel hasn’t finished.');
      if (d.rematch) return { id: d.rematch, code: null };
      const other = d.uids.find((u) => u !== uid);
      if (other && await blockedEither(t, uid, other)) fail('permission-denied', 'You can’t play this player again.');
      const built = puzzleFor(d.mode);
      const ref = newDuel(t, {
        mode: d.mode, status: 'open', host: uid, uids: [uid], invited: other || null, rematchOf: old.id,
        players: { [uid]: { ...playerEntry(req, d.players[uid].name), filled: false } }, built, ms,
      });
      t.update(old.ref, { rematch: ref.id });
      return { id: ref.id, code: null };
    });
  }
  checkMode(mode);
  const built = puzzleFor(mode);
  const code = newCode();
  return db.runTransaction(async (t) => {
    const ref = newDuel(t, { mode, status: 'open', host: uid, uids: [uid], code, players: { [uid]: playerEntry(req, name) }, built, ms });
    t.create(db.doc(`duelCodes/${code}`), { duel: ref.id, expiresAt: ms + E.DUELS.lobbyHours * 3600000 });
    return { id: ref.id, code };
  });
});

// Joins a private challenge (by its code) or accepts a rematch (by its id).
exports.duelJoin = onCall(async (req) => {
  const uid = caller(req);
  const { code, id, name } = req.data || {};
  const ms = now();
  let duelId = id;
  if (code !== undefined) {
    if (!E.validCode(code)) fail('not-found', 'That challenge link isn’t right.');
    const c = await db.doc(`duelCodes/${code}`).get();
    if (!c.exists || c.data().expiresAt < ms) fail('not-found', 'That challenge has expired.');
    duelId = c.data().duel;
  }
  if (typeof duelId !== 'string' || !duelId) fail('invalid-argument', 'Which duel?');
  return db.runTransaction(async (t) => {
    const snap = await t.get(duelRef(duelId));
    if (!snap.exists) fail('not-found', 'That challenge has expired.');
    const d = snap.data();
    if (isParticipant(d, uid)) return { id: duelId };
    if (d.status !== 'open' || d.expiresAt < ms) fail('failed-precondition', 'That challenge has already started or expired.');
    if (d.invited && d.invited !== uid) fail('permission-denied', 'That rematch is for someone else.');
    if (await blockedEither(t, d.host, uid)) fail('permission-denied', 'You can’t join this challenge.');
    t.update(snap.ref, { uids: [...d.uids, uid], [`players.${uid}`]: playerEntry(req, name), status: 'lobby' });
    return { id: duelId };
  });
});

// Quick Match: pairs you with the player already waiting for the same kind
// of duel, or puts you in line. Call again every ~20 seconds to stay in line;
// when someone pairs with you, players/{uid}.found holds the duel.
exports.duelQuick = onCall(async (req) => {
  const uid = caller(req);
  const { mode, name } = req.data || {};
  checkMode(mode);
  const ms = now();
  const built = puzzleFor(mode);
  const lineRef = db.doc(`quick/${mode}`);
  return db.runTransaction(async (t) => {
    const [line, me] = await Promise.all([t.get(lineRef), t.get(playerRef(uid))]);
    const found = me.exists && me.data().found;
    if (found && found.at > ms - 60000) {
      // Already paired (by someone who joined while you waited).
      const paired = await t.get(duelRef(found.duel));
      if (paired.exists && ['lobby', 'live'].includes(paired.data().status)) return { id: found.duel };
    }
    const waiting = line.exists ? line.data() : null;
    const fresh = waiting && waiting.uid !== uid && waiting.at > ms - E.DUELS.quickWaitMs;
    // Never pair two players when one has blocked the other: leave the
    // waiting player in line and try again later.
    if (fresh && await blockedEither(t, waiting.uid, uid)) return { waiting: true };
    if (fresh) {
      const ref = newDuel(t, {
        mode, status: 'lobby', host: waiting.uid, uids: [waiting.uid, uid],
        players: { [waiting.uid]: waiting.player, [uid]: playerEntry(req, name) }, built, ms,
      });
      t.delete(lineRef);
      t.set(playerRef(waiting.uid), { found: { duel: ref.id, at: ms } }, { merge: true });
      return { id: ref.id };
    }
    t.set(lineRef, { uid, at: ms, player: playerEntry(req, name) });
    return { waiting: true };
  });
});
exports.duelQuickCancel = onCall(async (req) => {
  const uid = caller(req);
  const { mode } = req.data || {};
  checkMode(mode);
  await db.runTransaction(async (t) => {
    const line = await t.get(db.doc(`quick/${mode}`));
    if (line.exists && line.data().uid === uid) t.delete(line.ref);
  });
  return { ok: true };
});

// Ready (or not). When both are ready the duel starts a few seconds later,
// at a time set by the server, so a faster phone gains nothing.
exports.duelReady = onCall(async (req) => {
  const uid = caller(req);
  const { id, ready } = req.data || {};
  const ms = now();
  return db.runTransaction(async (t) => {
    const [snap, secret] = await Promise.all([t.get(duelRef(String(id))), t.get(secretRef(String(id)))]);
    if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
    const d = snap.data();
    if (d.status !== 'lobby') return { status: d.status };
    if (d.expiresAt < ms) {
      t.update(snap.ref, { status: 'cancelled' });
      return { status: 'cancelled' };
    }
    const players = { ...d.players, [uid]: { ...d.players[uid], ready: ready !== false } };
    const both = d.uids.length === 2 && d.uids.every((u) => players[u].ready);
    const update = { [`players.${uid}.ready`]: ready !== false };
    if (both) {
      const startAt = ms + E.DUELS.countdownMs;
      Object.assign(update, { status: 'live', startAt, endsAt: startAt + E.DUELS[d.mode].minutes * 60000, puzzle: secret.data().puzzle });
    }
    t.update(snap.ref, update);
    return { status: both ? 'live' : 'lobby' };
  });
});

// Ends a duel inside a transaction: the result, both players' records and
// the winner's credits (once, within the day's limits). `reads` holds the
// player and wallet snapshots, read earlier in the same transaction.
function finish(t, snap, reads, { winner, reason, ms, progress }) {
  const d = snap.data();
  const seconds = Math.max(0, Math.round((ms - d.startAt) / 1000));
  const loser = winner ? d.uids.find((u) => u !== winner) : null;
  let credits = 0;
  let why = null;
  if (winner && d.players[winner].account) {
    const w = withDaily(t, winner, reads.wallets[winner], ms).wallet;
    const decision = E.winReward(w, { day: today(ms), opponent: loser, seconds, mode: d.mode, reason });
    why = decision.why;
    let next = w;
    if (decision.amount) {
      credits = decision.amount;
      next = E.recordWinReward(E.earn(w, credits, 'wins'), today(ms), loser);
      ledgerEntry(t, winner, { type: 'win', amount: credits, daily: 0, earned: credits, note: `Won a ${E.DUELS[d.mode].label}` });
    }
    t.set(walletRef(winner), { ...next, updatedAt: FieldValue.serverTimestamp() });
  }
  for (const u of d.uids) {
    if (!d.players[u].account) continue;
    const outcome = !winner ? 'draw' : u === winner ? 'win' : 'loss';
    const stats = E.applyOutcome(reads.players[u] && reads.players[u].duel, { mode: d.mode, outcome, seconds, solved: reason === 'solved', credits: u === winner ? credits : 0 });
    t.set(playerRef(u), { duel: stats }, { merge: true });
  }
  t.update(snap.ref, {
    status: 'done', winner: winner || null, finishedAt: ms,
    result: { reason, seconds, credits, why, progress: progress || Object.fromEntries(d.uids.map((u) => [u, d.players[u].progress || 0])) },
  });
}
// Reads what finish() needs (all reads must come before writes).
async function readForFinish(t, d) {
  const reads = { players: {}, wallets: {} };
  await Promise.all(d.uids.filter((u) => d.players[u].account).map(async (u) => {
    const [p, w] = await Promise.all([t.get(playerRef(u)), t.get(walletRef(u))]);
    reads.players[u] = p.exists ? p.data() : null;
    reads.wallets[u] = w.exists ? w.data() : null;
  }));
  return reads;
}

// A player's grid while solving: the server works out their progress (how
// many squares are right) and, when it's all right, declares them the
// winner. Only the percentage is shared; letters never leave this server.
exports.duelProgress = onCall(async (req) => {
  const uid = caller(req);
  const { id, grid } = req.data || {};
  const ms = now();
  const secret = await secretRef(String(id)).get();
  if (!secret.exists) fail('not-found', 'That duel isn’t yours.');
  const solution = P.unpack(secret.data().rows);
  if (!E.validGrid(grid, solution.length, solution[0].length)) fail('invalid-argument', 'That grid doesn’t fit.');
  const p = E.progress(grid, solution);
  return db.runTransaction(async (t) => {
    const snap = await t.get(duelRef(String(id)));
    if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
    const d = snap.data();
    if (d.status !== 'live') return { status: d.status, percent: p.percent };
    if (ms < d.startAt) return { status: 'countdown', percent: 0 };
    // Frozen after a hint: this grid doesn't count (the page sends it again
    // once the freeze is over).
    const frozenUntil = d.players[uid].frozenUntil || 0;
    if (ms < frozenUntil && ms <= d.endsAt) return { status: 'frozen', percent: d.players[uid].progress || 0, frozenUntil };
    if (ms > d.endsAt + 3000) {
      // Out of time: a draw (whoever reports first settles it).
      const reads = await readForFinish(t, d);
      finish(t, snap, reads, { winner: null, reason: 'time', ms: d.endsAt });
      return { status: 'done', percent: p.percent };
    }
    if (p.solved) {
      // The first all-correct grid wins; the transaction makes it the only one.
      const reads = await readForFinish(t, d);
      const progress = Object.fromEntries(d.uids.map((u) => [u, u === uid ? 100 : d.players[u].progress || 0]));
      finish(t, snap, reads, { winner: uid, reason: 'solved', ms, progress });
      return { status: 'done', percent: 100, won: true };
    }
    t.update(snap.ref, { [`players.${uid}.progress`]: p.percent, [`players.${uid}.filled`]: p.filled === p.total });
    return { status: 'live', percent: p.percent, full: p.filled === p.total };
  });
});

// A hint in a duel: Reveal Letter or Reveal Word, for signed-in players. It
// costs credits as usual and freezes your board for a while
// (DUELS.hintFreezeMs): grids sent while frozen don't count, so the freeze
// can't be skipped. Asking again for one already bought costs nothing and
// doesn't freeze. Your opponent sees how many hints you used, never where.
exports.duelHint = onCall(async (req) => {
  const uid = account(req);
  const { id, kind, r, c, dir } = req.data || {};
  if (kind !== 'letter' && kind !== 'word') fail('invalid-argument', 'Unknown hint.');
  const secret = await secretRef(String(id)).get();
  if (!secret.exists) fail('not-found', 'That duel isn’t yours.');
  const solution = P.unpack(secret.data().rows);
  const filled = (y, x) => y >= 0 && x >= 0 && y < solution.length && x < solution[0].length && !!solution[y][x];
  if (!Number.isInteger(r) || !Number.isInteger(c) || !filled(r, c)) fail('invalid-argument', 'Unknown square.');
  let cells = [[r, c]];
  let target = `${r}_${c}`;
  if (kind === 'word') {
    if (dir !== 'across' && dir !== 'down') fail('invalid-argument', 'Unknown word.');
    const [dy, dx] = dir === 'across' ? [0, 1] : [1, 0];
    let [y, x] = [r, c];
    while (filled(y - dy, x - dx)) [y, x] = [y - dy, x - dx];
    target = `${dir[0]}${y}_${x}`;
    cells = [];
    for (; filled(y, x); y += dy, x += dx) cells.push([y, x]);
    if (cells.length < 2) fail('invalid-argument', 'Unknown word.');
  }
  const letters = cells.map(([y, x]) => [y, x, solution[y][x]]);
  const cost = E.ECONOMY.cost[kind];
  const ms = now();
  return db.runTransaction(async (t) => {
    const [snap, wSnap] = await Promise.all([t.get(duelRef(String(id))), t.get(walletRef(uid))]);
    if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
    const d = snap.data();
    if (d.status !== 'live' || ms < d.startAt || ms > d.endsAt) fail('failed-precondition', 'Hints work only while the duel is on.');
    const me = d.players[uid];
    if ((me.frozenUntil || 0) > ms) fail('failed-precondition', 'Your board is frozen for a moment.');
    const { wallet, granted } = withDaily(t, uid, wSnap.exists ? wSnap.data() : null, ms);
    const bought = me.hints || [];
    if (bought.includes(target)) {
      if (granted) t.set(walletRef(uid), wallet);
      return { ok: true, charged: 0, cells: letters, frozenUntil: 0, wallet: view(wallet, ms) };
    }
    if (bought.length >= 200) fail('resource-exhausted', 'Too many hints in one duel.');
    const paid = E.spend(wallet, cost, today(ms));
    if (!paid) {
      if (granted) t.set(walletRef(uid), wallet);
      return { ok: false, reason: 'insufficient', charged: 0, wallet: view(wallet, ms) };
    }
    const frozenUntil = ms + E.DUELS.hintFreezeMs[kind];
    t.set(walletRef(uid), { ...paid.wallet, updatedAt: FieldValue.serverTimestamp() });
    ledgerEntry(t, uid, { type: 'spend', amount: -cost, daily: -paid.fromDaily, earned: -paid.fromEarned, note: kind === 'letter' ? 'Revealed a letter in a duel' : 'Revealed a word in a duel' });
    t.update(snap.ref, { [`players.${uid}.hints`]: [...bought, target], [`players.${uid}.frozenUntil`]: frozenUntil });
    return { ok: true, charged: cost, cells: letters, frozenUntil, wallet: view(paid.wallet, ms) };
  });
});

// Leaving on purpose. Before the start it cancels (or frees your place);
// during a duel it's a forfeit: your opponent wins, without credits.
exports.duelLeave = onCall(async (req) => {
  const uid = caller(req);
  const { id } = req.data || {};
  const ms = now();
  return db.runTransaction(async (t) => {
    const snap = await t.get(duelRef(String(id)));
    if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
    const d = snap.data();
    if (d.status === 'open' || (d.status === 'lobby' && uid === d.host)) {
      t.update(snap.ref, { status: 'cancelled' });
      return { status: 'cancelled' };
    }
    if (d.status === 'lobby') {
      const players = { ...d.players };
      delete players[uid];
      t.update(snap.ref, { uids: d.uids.filter((u) => u !== uid), players, status: 'open' });
      return { status: 'left' };
    }
    if (d.status === 'live' && ms < d.startAt) {
      // Still counting down: nobody has played, so nothing is recorded.
      t.update(snap.ref, { status: 'cancelled', [`players.${uid}.left`]: true });
      return { status: 'cancelled' };
    }
    if (d.status === 'live') {
      const reads = await readForFinish(t, d);
      t.update(snap.ref, { [`players.${uid}.left`]: true });
      finish(t, snap, reads, { winner: d.uids.find((u) => u !== uid), reason: 'forfeit', ms });
      return { status: 'done' };
    }
    return { status: d.status };
  });
});

// Reporting and blocking a duel opponent (names are the only thing players
// write that others see). A report is kept for review in Firestore
// (reports collection); blocking stops the two players ever meeting again.
function opponentIn(snap, uid) {
  if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
  const other = snap.data().uids.find((u) => u !== uid);
  if (!other) fail('failed-precondition', 'There’s no other player in that duel.');
  return other;
}
exports.duelReport = onCall(async (req) => {
  const uid = caller(req);
  const { id } = req.data || {};
  const snap = await duelRef(String(id)).get();
  const other = opponentIn(snap, uid);
  await db.doc(`reports/${snap.id}_${uid}`).set({
    duel: snap.id, reporter: uid, reported: other, name: snap.data().players[other].name,
    reason: 'offensive-name', status: 'open', at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});
exports.duelBlock = onCall(async (req) => {
  const uid = caller(req);
  const { id, block = true } = req.data || {};
  const snap = await duelRef(String(id)).get();
  const other = opponentIn(snap, uid);
  await blocksRef(uid).set({ uids: block ? FieldValue.arrayUnion(other) : FieldValue.arrayRemove(other) }, { merge: true });
  return { blocked: !!block };
});

// The duel as the server has it, with the server's clock. Pages ask when
// their live copy may have stalled (phones often pause it, for example after
// switching apps), and use the clock so both players count down to the same
// moment, however their own phones' clocks are set.
exports.duelState = onCall(async (req) => {
  const uid = caller(req);
  const { id } = req.data || {};
  const snap = await duelRef(String(id)).get();
  if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
  return { duel: snap.data(), now: now() };
});

// Settles a duel that has stalled: out of time (a draw), or an opponent who
// has been gone longer than the reconnection window (you win, without
// credits). Anyone in the duel can ask; the server checks the clocks.
exports.duelSettle = onCall(async (req) => {
  const uid = caller(req);
  const { id } = req.data || {};
  const ms = now();
  const presence = await db.collection(`duels/${id}/presence`).get();
  const seen = Object.fromEntries(presence.docs.map((x) => [x.id, x.data().at ? x.data().at.toMillis() : 0]));
  return db.runTransaction(async (t) => {
    const snap = await t.get(duelRef(String(id)));
    if (!snap.exists || !isParticipant(snap.data(), uid)) fail('not-found', 'That duel isn’t yours.');
    const d = snap.data();
    if ((d.status === 'open' || d.status === 'lobby') && d.expiresAt < ms) {
      t.update(snap.ref, { status: 'cancelled' });
      return { status: 'cancelled' };
    }
    if (d.status !== 'live') return { status: d.status };
    if (ms > d.endsAt + 3000) {
      finish(t, snap, await readForFinish(t, d), { winner: null, reason: 'time', ms: d.endsAt });
      return { status: 'done' };
    }
    const other = d.uids.find((u) => u !== uid);
    const lastSeen = Math.max(seen[other] || 0, d.startAt);
    const mine = seen[uid] || 0;
    if (ms - lastSeen > E.DUELS.reconnectMs && ms - mine < 30000) {
      finish(t, snap, await readForFinish(t, d), { winner: uid, reason: 'disconnect', ms });
      return { status: 'done' };
    }
    return { status: 'live', waitMs: Math.max(0, E.DUELS.reconnectMs - (ms - lastSeen)) };
  });
});

// ---------- Deleting an account ----------
// Everything kept for a player: synced progress, wallet (with its history,
// hints bought and rewards claimed), duel record, and the sign-in itself.
// Past duels stay for the other player, with this player's name replaced.
// The page asks the player to sign in again first; this checks it was
// within the last 10 minutes, so an unattended phone can't delete an account.
const RECENT_SIGN_IN_S = 600;
exports.accountDelete = onCall(async (req) => {
  const uid = account(req);
  const signedInAt = req.auth.token.auth_time || 0;
  if (Date.now() / 1000 - signedInAt > RECENT_SIGN_IN_S) fail('unauthenticated', 'For your safety, confirm your password (or sign in again) first.');
  // Duels: leave any that are still going, then anonymise the rest.
  const duels = await db.collection('duels').where('uids', 'array-contains', uid).get();
  for (const snap of duels.docs) {
    const d = snap.data();
    if (['open', 'lobby'].includes(d.status) || (d.status === 'live' && d.startAt > now())) {
      await snap.ref.update({ status: 'cancelled', [`players.${uid}.name`]: 'Deleted player' });
    } else if (d.status === 'live') {
      await db.runTransaction(async (t) => {
        const fresh = await t.get(snap.ref);
        const f = fresh.data();
        if (f.status !== 'live') return;
        const reads = await readForFinish(t, f);
        finish(t, fresh, reads, { winner: f.uids.find((u) => u !== uid) || null, reason: 'forfeit', ms: now() });
      });
      await snap.ref.update({ [`players.${uid}.name`]: 'Deleted player' });
    } else {
      await snap.ref.update({ [`players.${uid}.name`]: 'Deleted player' });
    }
    await db.doc(`duels/${snap.id}/presence/${uid}`).delete();
  }
  for (const mode of Object.keys(E.DUELS).filter((m) => E.DUELS[m] && E.DUELS[m].minutes)) {
    await db.runTransaction(async (t) => {
      const q = await t.get(db.doc(`quick/${mode}`));
      if (q.exists && q.data().uid === uid) t.delete(q.ref);
    });
  }
  await Promise.all([
    db.recursiveDelete(walletRef(uid)),
    db.recursiveDelete(playerRef(uid)),
    db.recursiveDelete(blocksRef(uid)),
    db.recursiveDelete(db.doc(`users/${uid}`)),
  ]);
  await admin.auth().deleteUser(uid);
  return { ok: true };
});
