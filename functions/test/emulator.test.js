// The trusted server, tested against the Firebase emulators with real
// sign-ins and the real security rules:
//
//   cd functions && npm install && node prepare.js
//   npx firebase emulators:exec --only auth,firestore,functions --project demo-crossword "npm test"
//
// (or start the emulators yourself and run `npm test`).
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const assert = require('assert');
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInAnonymously } = require('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const { setLogLevel, getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, collection, getDocs, serverTimestamp } = require('firebase/firestore');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const E = require('../site/js/economy.js');
const P = require('../puzzles.js');

const PROJECT = 'demo-crossword';
const REGION = 'europe-west1';
admin.initializeApp({ projectId: PROJECT }, 'test-admin');
const adb = admin.app('test-admin').firestore();

setLogLevel('silent'); // refused writes are expected here
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
async function player(kind = 'account') {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, authDomain: `${PROJECT}.firebaseapp.com` }, `p${++n}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fns = getFunctions(app, REGION);
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const cred = kind === 'guest' ? await signInAnonymously(auth) : await createUserWithEmailAndPassword(auth, `p${n}-${Date.now()}@example.com`, 'secret123');
  const call = async (name, data) => (await httpsCallable(fns, name)(data)).data;
  return { uid: cred.user.uid, call, db };
}
async function rejects(promise, code, label) {
  try {
    await promise;
  } catch (e) {
    if (code) assert.ok(String(e.code).includes(code), `${label}: expected ${code}, got ${e.code} ${e.message}`);
    return;
  }
  assert.fail(`${label}: should have been refused`);
}
const today = () => E.sastDate(Date.now());
const yesterday = () => E.sastDate(Date.now() - 86400000);
const solutionOf = (key) => P.published(key).solution;
const ok = (label) => console.log(`  ✓ ${label}`);

(async () => {
  console.log('Hint credits');
  const guest = await player('guest');
  await rejects(guest.call('walletSync'), 'permission-denied', 'guests have no wallet');
  await rejects(guest.call('spendHint', { puzzle: `daily:${today()}`, kind: 'letter', target: '0_0' }), 'permission-denied', 'guests can’t spend');
  ok('guests can’t use or earn credits');

  const a = await player();
  let w = await a.call('walletSync');
  assert.deepStrictEqual([w.wallet.daily, w.wallet.earned, w.wallet.total, w.granted], [5, 0, 5, 5]);
  w = await a.call('walletSync');
  assert.deepStrictEqual([w.wallet.total, w.granted], [5, 0]);
  await Promise.all([a.call('walletSync'), a.call('walletSync'), a.call('walletSync')]);
  w = await a.call('walletSync');
  assert.strictEqual(w.wallet.total, 5, 'refreshing (even at once) never grants twice');
  assert.strictEqual(w.recent.filter((x) => x.type === 'daily').length, 1);
  ok('5 daily credits, once a day');

  const key = `daily:${today()}`;
  let r = await a.call('spendHint', { puzzle: key, kind: 'letter', target: '0_3' });
  assert.deepStrictEqual([r.ok, r.charged, r.wallet.daily], [true, 1, 4]);
  r = await a.call('spendHint', { puzzle: key, kind: 'letter', target: '0_3' });
  assert.deepStrictEqual([r.ok, r.charged, r.wallet.daily], [true, 0, 4], 'the same square never costs twice');
  r = await a.call('spendHint', { puzzle: key, kind: 'word', target: 'a0_0' });
  assert.deepStrictEqual([r.charged, r.wallet.daily], [3, 1]);
  r = await a.call('spendHint', { puzzle: key, kind: 'word', target: 'a5_0' });
  assert.deepStrictEqual([r.ok, r.reason, r.charged, r.wallet.total], [false, 'insufficient', 0, 1], 'not enough: nothing charged');
  await rejects(a.call('spendHint', { puzzle: 'daily:../../x', kind: 'letter', target: '0_0' }), 'invalid-argument', 'bad puzzle');
  await rejects(a.call('spendHint', { puzzle: key, kind: 'letter', target: '0_0; drop' }), 'invalid-argument', 'bad square');
  await rejects(a.call('spendHint', { puzzle: key, kind: 'puzzle', target: '0_0' }), 'invalid-argument', 'only letters and words');
  ok('Reveal Letter 1, Reveal Word 3, never twice, never below zero');

  // Daily first, then earned; and many requests at once never overspend.
  await adb.doc(`wallets/${a.uid}`).update({ daily: 2, earned: 4 });
  r = await a.call('spendHint', { puzzle: 'mini:2026-10-01', kind: 'word', target: 'a0_0' });
  assert.deepStrictEqual([r.wallet.daily, r.wallet.earned], [0, 3], 'daily credits first');
  const burst = await Promise.all(['1_1', '1_2', '1_3', '1_4', '1_5'].map((t) => a.call('spendHint', { puzzle: 'mini:2026-10-02', kind: 'letter', target: t })));
  assert.strictEqual(burst.filter((x) => x.charged).length, 3, 'five at once with 3 credits: three charged');
  const after = (await adb.doc(`wallets/${a.uid}`).get()).data();
  assert.deepStrictEqual([after.daily, after.earned], [0, 0], 'never negative');
  ok('daily credits spent first; simultaneous spends can’t overdraw');

  // Midnight: unused daily credits expire; earned ones stay.
  await adb.doc(`wallets/${a.uid}`).update({ daily: 2, earned: 7, dailyDay: E.sastDay(Date.now()) - 1 });
  w = await a.call('walletSync');
  assert.deepStrictEqual([w.wallet.daily, w.wallet.earned, w.granted], [5, 7, 5]);
  assert.ok(w.recent.some((x) => x.type === 'expire' && x.amount === -2), 'the expiry is in the history');
  ok('unused daily credits expire at midnight; earned credits don’t');

  console.log('Rewards for solving');
  const b = await player();
  await b.call('walletSync');
  const miniKey = `mini:${today()}`;
  r = await b.call('claimSolve', { puzzle: miniKey, grid: solutionOf(miniKey) });
  assert.deepStrictEqual([r.ok, r.amount, r.wallet.earned], [true, 1, 1], 'a Mini: 1');
  r = await b.call('claimSolve', { puzzle: miniKey, grid: solutionOf(miniKey) });
  assert.deepStrictEqual([r.ok, r.reason], [false, 'already'], 'once per puzzle');
  const dKey = `daily:${yesterday()}`;
  r = await b.call('claimSolve', { puzzle: dKey, grid: solutionOf(dKey) });
  assert.deepStrictEqual([r.ok, r.amount, r.wallet.earned], [true, 3, 4], 'a full crossword from the archive: 3');
  const wrong = solutionOf(`daily:${today()}`).map((row) => row.slice());
  const fr = wrong.findIndex((row) => row.some(Boolean));
  wrong[fr][wrong[fr].findIndex(Boolean)] = 'Q';
  r = await b.call('claimSolve', { puzzle: `daily:${today()}`, grid: wrong });
  assert.deepStrictEqual([r.ok, r.reason], [false, 'incorrect'], 'the grid must be right');
  r = await b.call('claimSolve', { puzzle: 'play:general/medium/5/L1', grid: [] });
  assert.strictEqual(r.reason, 'not-eligible', 'practice puzzles earn nothing');
  r = await b.call('claimSolve', { puzzle: `daily:${E.sastDate(Date.now() + 2 * 86400000)}`, grid: [] });
  assert.strictEqual(r.reason, 'not-eligible', 'not a future puzzle');
  await b.call('spendHint', { puzzle: `mini:${yesterday()}`, kind: 'letter', target: '0_0' });
  r = await b.call('claimSolve', { puzzle: `mini:${yesterday()}`, grid: solutionOf(`mini:${yesterday()}`) });
  assert.deepStrictEqual([r.ok, r.reason], [false, 'assisted'], 'a hint on the puzzle: no reward');
  ok('Mini 1, full crossword 3, once each, only correct, never after a hint, never for practice');

  console.log('Security rules');
  const wa = doc(a.db, `wallets/${a.uid}`);
  assert.ok((await getDoc(wa)).exists(), 'read your own wallet');
  await rejects(setDoc(wa, { daily: 999, earned: 999 }), 'permission-denied', 'edit your wallet');
  await rejects(updateDoc(wa, { earned: 50 }), 'permission-denied', 'top up your wallet');
  await rejects(getDoc(doc(a.db, `wallets/${b.uid}`)), 'permission-denied', 'read someone else’s wallet');
  await rejects(setDoc(doc(a.db, `wallets/${a.uid}/ledger/x`), { amount: 100 }), 'permission-denied', 'add to your history');
  await rejects(setDoc(doc(a.db, `wallets/${a.uid}/claims/daily:2026-10-01`), { amount: 3 }), 'permission-denied', 'mark a claim');
  await rejects(getDoc(doc(a.db, `wallets/${a.uid}/spent/x`)), 'permission-denied', 'read spent');
  assert.ok((await getDocs(collection(a.db, `wallets/${a.uid}/ledger`))).size > 0, 'read your own history');
  await rejects(setDoc(doc(a.db, `players/${a.uid}`), { duel: { won: 99 } }), 'permission-denied', 'edit your duel record');
  await setDoc(doc(a.db, `users/${a.uid}`), { progress: '{}', updated: serverTimestamp() });
  ok('wallets, history and records are read-only; synced progress still works');

  console.log('Duels');
  const c = await player();
  const d1 = await a.call('duelCreate', { mode: 'mini', name: 'Ann' });
  assert.ok(E.validCode(d1.code), 'a private code');
  await rejects(c.call('duelJoin', { code: 'abcdefghjkmn' }), 'not-found', 'a guessed code');
  await rejects(c.call('duelJoin', { code: 'bad' }), 'not-found', 'a malformed code');
  const j = await b.call('duelJoin', { code: d1.code, name: 'Bob' });
  assert.strictEqual(j.id, d1.id);
  await rejects(c.call('duelJoin', { code: d1.code, name: 'Cy' }), 'failed-precondition', 'a third player');
  let duel = (await getDoc(doc(b.db, `duels/${d1.id}`))).data();
  assert.deepStrictEqual([duel.status, duel.uids.length, duel.players[a.uid].name, duel.players[b.uid].name], ['lobby', 2, 'Ann', 'Bob']);
  const hidden = JSON.parse(duel.puzzle);
  assert.ok(hidden.words.every((w) => /^\?+$/.test(w[0])), 'the page never gets the answers');
  await rejects(getDoc(doc(c.db, `duels/${d1.id}`)), 'permission-denied', 'outsiders can’t see a duel');
  await rejects(getDoc(doc(a.db, `duels/${d1.id}/secret/solution`)), 'permission-denied', 'players can’t see the answers');
  await rejects(updateDoc(doc(a.db, `duels/${d1.id}`), { winner: a.uid }), 'permission-denied', 'declare yourself the winner');
  await rejects(updateDoc(doc(a.db, `duels/${d1.id}`), { [`players.${a.uid}.progress`]: 100 }), 'permission-denied', 'claim progress');
  await setDoc(doc(a.db, `duels/${d1.id}/presence/${a.uid}`), { at: serverTimestamp() });
  await rejects(setDoc(doc(a.db, `duels/${d1.id}/presence/${b.uid}`), { at: serverTimestamp() }), 'permission-denied', 'someone else’s heartbeat');
  await rejects(setDoc(doc(a.db, `duels/${d1.id}/presence/${a.uid}`), { at: new Date(Date.now() + 999999) }), 'permission-denied', 'a heartbeat from the future');
  await rejects(setDoc(doc(c.db, `duels/${d1.id}/presence/${c.uid}`), { at: serverTimestamp() }), 'permission-denied', 'outsiders’ heartbeats');
  ok('private challenge: unguessable code, two players only, answers and results out of players’ reach');

  const sol = P.unpack((await adb.doc(`duels/${d1.id}/secret/solution`).get()).data().rows);
  await a.call('duelReady', { id: d1.id });
  duel = (await getDoc(doc(a.db, `duels/${d1.id}`))).data();
  assert.strictEqual(duel.status, 'lobby', 'waits for both');
  await b.call('duelReady', { id: d1.id });
  duel = (await getDoc(doc(a.db, `duels/${d1.id}`))).data();
  assert.strictEqual(duel.status, 'live');
  assert.strictEqual(duel.endsAt - duel.startAt, E.DUELS.mini.minutes * 60000);
  r = await a.call('duelProgress', { id: d1.id, grid: sol });
  assert.strictEqual(r.status, 'countdown', 'nothing counts before the start');
  await wait(duel.startAt - Date.now() + 200);
  const half = sol.map((row) => row.map((ch, ci) => (ci % 2 ? ch : '')));
  r = await b.call('duelProgress', { id: d1.id, grid: half });
  const expect = E.progress(half, sol).percent;
  assert.strictEqual(r.percent, expect, 'progress is worked out by the server');
  duel = (await getDoc(doc(a.db, `duels/${d1.id}`))).data();
  assert.strictEqual(duel.players[b.uid].progress, expect, 'the opponent sees only a percentage');
  assert.ok(!JSON.stringify(duel).includes(sol.flat().filter(Boolean).join('').slice(0, 8)), 'no letters shared');
  await rejects(a.call('duelProgress', { id: d1.id, grid: [['A']] }), 'invalid-argument', 'a grid of the wrong shape');
  const earned = async (uid) => ((await adb.doc(`wallets/${uid}`).get()).data() || {}).earned || 0;
  const startEarned = { [a.uid]: await earned(a.uid), [b.uid]: await earned(b.uid) };
  // Wait until a win would count, then both finish at the same moment.
  await wait(Math.max(0, duel.startAt + E.DUELS.mini.minSeconds * 1000 + 500 - Date.now()));
  const [ra, rb] = await Promise.all([a.call('duelProgress', { id: d1.id, grid: sol }), b.call('duelProgress', { id: d1.id, grid: sol })]);
  assert.strictEqual([ra, rb].filter((x) => x.won).length, 1, 'exactly one winner when both finish together');
  duel = (await getDoc(doc(a.db, `duels/${d1.id}`))).data();
  const winner = duel.winner;
  const loser = winner === a.uid ? b.uid : a.uid;
  assert.deepStrictEqual([duel.status, duel.result.reason, duel.result.credits], ['done', 'solved', 3]);
  assert.strictEqual(await earned(winner), startEarned[winner] + 3, 'the winner earns 3 permanent credits');
  assert.strictEqual(await earned(loser), startEarned[loser], 'the loser earns nothing');
  r = await (winner === a.uid ? a : b).call('duelProgress', { id: d1.id, grid: sol });
  assert.strictEqual(r.status, 'done');
  assert.strictEqual(await earned(winner), startEarned[winner] + 3, 'rewarded once');
  const ws = (await getDoc(doc(winner === a.uid ? a.db : b.db, `players/${winner}`))).data().duel;
  const ls = (await adb.doc(`players/${loser}`).get()).data().duel;
  assert.deepStrictEqual([ws.played, ws.won, ws.miniWins, ws.streak, ws.credits], [1, 1, 1, 1, 3]);
  assert.deepStrictEqual([ls.played, ls.lost, ls.streak], [1, 1, 0]);
  ok('synchronised start, server progress, one winner, 3 credits once, records for both');

  // Rematch: only the same opponent can take it.
  const re = await a.call('duelCreate', { rematchOf: d1.id, name: 'Ann' });
  const re2 = await b.call('duelCreate', { rematchOf: d1.id, name: 'Bob' });
  assert.strictEqual(re2.id, re.id, 'one rematch per duel');
  await rejects(c.call('duelJoin', { id: re.id, name: 'Cy' }), 'permission-denied', 'someone else’s rematch');
  await b.call('duelJoin', { id: re.id, name: 'Bob' });
  await Promise.all([a.call('duelReady', { id: re.id }), b.call('duelReady', { id: re.id })]);
  duel = (await adb.doc(`duels/${re.id}`).get()).data();
  assert.strictEqual(duel.status, 'live');
  await wait(duel.startAt - Date.now() + 200);
  await a.call('duelLeave', { id: re.id });
  duel = (await adb.doc(`duels/${re.id}`).get()).data();
  assert.deepStrictEqual([duel.winner, duel.result.reason, duel.result.credits], [b.uid, 'forfeit', 0], 'leaving forfeits; a forfeit earns no credits');
  ok('rematch for the same two players; leaving mid-duel is a forfeit without credits');

  // Out of time: a draw, no credits.
  const d3 = await a.call('duelCreate', { mode: 'classic', name: 'Ann' });
  await b.call('duelJoin', { code: d3.code, name: 'Bob' });
  await Promise.all([a.call('duelReady', { id: d3.id }), b.call('duelReady', { id: d3.id })]);
  await adb.doc(`duels/${d3.id}`).update({ startAt: Date.now() - 30 * 60000, endsAt: Date.now() - 10 * 60000 });
  await a.call('duelSettle', { id: d3.id });
  duel = (await adb.doc(`duels/${d3.id}`).get()).data();
  assert.deepStrictEqual([duel.status, duel.winner, duel.result.reason, duel.result.credits], ['done', null, 'time', 0]);
  assert.strictEqual((await adb.doc(`players/${a.uid}`).get()).data().duel.draws, 1);
  ok('out of time: a draw, no credits');

  // A dropped connection: the other player wins after the reconnection window.
  const d4 = await a.call('duelCreate', { mode: 'mini', name: 'Ann' });
  await b.call('duelJoin', { code: d4.code, name: 'Bob' });
  await Promise.all([a.call('duelReady', { id: d4.id }), b.call('duelReady', { id: d4.id })]);
  await adb.doc(`duels/${d4.id}`).update({ startAt: Date.now() - 120000, endsAt: Date.now() + 120000 });
  await adb.doc(`duels/${d4.id}/presence/${b.uid}`).set({ at: Timestamp.fromMillis(Date.now() - 90000) });
  await setDoc(doc(a.db, `duels/${d4.id}/presence/${a.uid}`), { at: serverTimestamp() });
  r = await b.call('duelSettle', { id: d4.id });
  assert.strictEqual(r.status, 'live', 'the player who dropped can’t claim it');
  await adb.doc(`duels/${d4.id}/presence/${b.uid}`).set({ at: Timestamp.fromMillis(Date.now() - 20000) });
  r = await a.call('duelSettle', { id: d4.id });
  assert.strictEqual(r.status, 'live', 'a short drop-out is forgiven');
  await adb.doc(`duels/${d4.id}/presence/${b.uid}`).set({ at: Timestamp.fromMillis(Date.now() - 90000) });
  r = await a.call('duelSettle', { id: d4.id });
  duel = (await adb.doc(`duels/${d4.id}`).get()).data();
  assert.deepStrictEqual([duel.winner, duel.result.reason, duel.result.credits], [a.uid, 'disconnect', 0]);
  ok('a player gone longer than a minute loses (no credits); a short drop-out doesn’t');

  // Limits: three rewarded wins a day, two against the same opponent.
  await adb.doc(`wallets/${a.uid}`).update({ winsDay: E.sastDay(Date.now()), wins: 1, opponents: { [b.uid]: 2 } });
  const d5 = await a.call('duelCreate', { mode: 'mini', name: 'Ann' });
  await b.call('duelJoin', { code: d5.code, name: 'Bob' });
  await Promise.all([a.call('duelReady', { id: d5.id }), b.call('duelReady', { id: d5.id })]);
  await adb.doc(`duels/${d5.id}`).update({ startAt: Date.now() - 60000 });
  const sol5 = P.unpack((await adb.doc(`duels/${d5.id}/secret/solution`).get()).data().rows);
  const earnedBefore = (await adb.doc(`wallets/${a.uid}`).get()).data().earned;
  const wonBefore = (await adb.doc(`players/${a.uid}`).get()).data().duel.won;
  r = await a.call('duelProgress', { id: d5.id, grid: sol5 });
  duel = (await adb.doc(`duels/${d5.id}`).get()).data();
  assert.deepStrictEqual([r.won, duel.result.credits, duel.result.why], [true, 0, 'opponent-limit'], 'farming the same opponent stops paying');
  assert.strictEqual((await adb.doc(`wallets/${a.uid}`).get()).data().earned, earnedBefore);
  assert.strictEqual((await adb.doc(`players/${a.uid}`).get()).data().duel.won, wonBefore + 1, 'the win still counts in the record');
  await adb.doc(`wallets/${a.uid}`).update({ wins: 3, opponents: {} });
  const d6 = await a.call('duelCreate', { mode: 'mini', name: 'Ann' });
  await c.call('duelJoin', { code: d6.code, name: 'Cy' });
  await Promise.all([a.call('duelReady', { id: d6.id }), c.call('duelReady', { id: d6.id })]);
  await adb.doc(`duels/${d6.id}`).update({ startAt: Date.now() - 60000 });
  const sol6 = P.unpack((await adb.doc(`duels/${d6.id}/secret/solution`).get()).data().rows);
  await a.call('duelProgress', { id: d6.id, grid: sol6 });
  duel = (await adb.doc(`duels/${d6.id}`).get()).data();
  assert.deepStrictEqual([duel.result.credits, duel.result.why], [0, 'daily-limit'], 'three rewarded wins a day');
  ok('rewarded wins: 3 a day, 2 against the same opponent; later wins still count');

  // A guest can duel, but earns nothing and keeps no record.
  const d7 = await guest.call('duelCreate', { mode: 'mini', name: 'Gee' });
  await c.call('duelJoin', { code: d7.code, name: 'Cy' });
  await Promise.all([guest.call('duelReady', { id: d7.id }), c.call('duelReady', { id: d7.id })]);
  await adb.doc(`duels/${d7.id}`).update({ startAt: Date.now() - 60000 });
  const sol7 = P.unpack((await adb.doc(`duels/${d7.id}/secret/solution`).get()).data().rows);
  r = await guest.call('duelProgress', { id: d7.id, grid: sol7 });
  duel = (await adb.doc(`duels/${d7.id}`).get()).data();
  assert.deepStrictEqual([r.won, duel.result.credits], [true, 0], 'guests win without credits');
  assert.ok(!(await adb.doc(`wallets/${guest.uid}`).get()).exists);
  ok('guests can duel, without credits or records');

  // Quick Match.
  const q1 = await a.call('duelQuick', { mode: 'classic', name: 'Ann' });
  assert.ok(q1.waiting, 'nobody waiting: in line');
  const q1b = await a.call('duelQuick', { mode: 'classic', name: 'Ann' });
  assert.ok(q1b.waiting, 'renewing keeps one place, never a match with yourself');
  const q2 = await c.call('duelQuick', { mode: 'mini', name: 'Cy' });
  assert.ok(q2.waiting, 'different kinds of duel don’t pair');
  const q3 = await b.call('duelQuick', { mode: 'classic', name: 'Bob' });
  assert.ok(q3.id, 'paired with the waiting player');
  const found = (await getDoc(doc(a.db, `players/${a.uid}`))).data().found;
  assert.strictEqual(found.duel, q3.id, 'the waiting player is told');
  assert.strictEqual((await a.call('duelQuick', { mode: 'classic', name: 'Ann' })).id, q3.id, 'asking again returns the same duel');
  duel = (await adb.doc(`duels/${q3.id}`).get()).data();
  assert.deepStrictEqual([duel.status, duel.uids.sort().join()], ['lobby', [a.uid, b.uid].sort().join()]);
  await c.call('duelQuickCancel', { mode: 'mini' });
  assert.ok(!(await adb.doc('quick/mini').get()).exists, 'cancelling leaves the line');
  // A stale wait is never matched.
  await adb.doc('quick/mini').set({ uid: c.uid, at: Date.now() - 120000, player: { name: 'Cy', ready: false, progress: 0, account: true, left: false } });
  assert.ok((await b.call('duelQuick', { mode: 'mini', name: 'Bob' })).waiting, 'nobody pretends to be there');
  await b.call('duelQuickCancel', { mode: 'mini' });
  ok('Quick Match pairs the same kind of duel, once, and never with a stale or absent player');

  // Lobby rules.
  const d8 = await a.call('duelCreate', { mode: 'mini', name: 'Ann' });
  await b.call('duelJoin', { code: d8.code, name: 'Bob' });
  await b.call('duelLeave', { id: d8.id });
  duel = (await adb.doc(`duels/${d8.id}`).get()).data();
  assert.deepStrictEqual([duel.status, duel.uids.length], ['open', 1], 'leaving a lobby frees the place');
  await adb.doc(`duels/${d8.id}`).update({ expiresAt: Date.now() - 1 });
  await rejects(c.call('duelJoin', { code: d8.code, name: 'Cy' }), 'failed-precondition', 'an expired challenge');
  ok('lobbies: leave and rejoin; expired challenges can’t be joined');

  console.log('OK: server tests passed');
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
