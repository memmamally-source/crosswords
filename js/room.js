/*
 * Multiplayer rooms ("Help me solve"): the live connection, using Firebase
 * Realtime Database. The game side is in js/app.js, the shared helpers in
 * js/rooms.js and the security rules in database.rules.json.
 *
 * Does nothing until js/firebase-config.js has a databaseURL. Guests join
 * with an anonymous Firebase account, so no sign-up is needed.
 *
 * rooms/<id>/
 *   meta      { host, puzzle (a #/ address), title, createdAt, expiresAt, base }
 *   slots/<1-5>   { uid, name, joinedAt }      seats (at most five)
 *   members/<uid> seat number
 *   banned/<uid>  true                         removed by the host
 *   cells/<r_c>   { v, by, rev }               letters
 *   presence/<uid> { r, c, d, at }             where each player is (cleared on disconnect)
 *   hints/<uid>   { letter, word, checks, autocheck }
 */
(function () {
  const config = window.FIREBASE_CONFIG || {};
  const R = window.CrosswordRooms;
  const fb = window.CrosswordFirebase;
  if (!config.databaseURL || !R || !fb) return;

  let lib = null;
  let db = null;
  let auth = null;
  let offset = 0;
  let current = null; // { id, uid, unsubscribe: [], state }

  async function connect() {
    if (db) return;
    const [app, { lib: authLib, auth: a }, dbLib] = await Promise.all([
      fb.getApp(), fb.getAuth(), import(`${fb.SDK}/firebase-database.js`),
    ]);
    lib = dbLib;
    auth = a;
    db = lib.getDatabase(app, config.databaseURL);
    const emu = window.FIREBASE_EMULATORS;
    if (emu && emu.database) lib.connectDatabaseEmulator(db, emu.database.host, emu.database.port);
    lib.onValue(lib.ref(db, '.info/serverTimeOffset'), (s) => { offset = s.val() || 0; });
    await auth.authStateReady();
    if (!auth.currentUser) await authLib.signInAnonymously(auth);
  }
  const uid = () => auth.currentUser.uid;
  const roomRef = (id, path = '') => lib.ref(db, `rooms/${id}${path ? `/${path}` : ''}`);
  const serverNow = () => Date.now() + offset;

  // What a room holds, for the invite screen, before joining.
  async function peek(id) {
    await connect();
    const snap = await lib.get(roomRef(id));
    if (!snap.exists() || !snap.child('meta').exists()) return null;
    const room = snap.val();
    const me = uid();
    return {
      meta: room.meta,
      slots: room.slots || {},
      member: !!(room.members && room.members[me]),
      banned: !!(room.banned && room.banned[me]),
      full: !R.freeSeat(room.slots, me),
      expired: room.meta.expiresAt <= serverNow(),
    };
  }

  // Opens a room for the puzzle in progress, with its letters so far.
  async function create({ puzzle, title, base, cells, name }) {
    await connect();
    const id = R.newRoomId();
    const me = uid();
    const updates = {
      [`rooms/${id}/meta`]: {
        host: me, puzzle, title, base,
        createdAt: lib.serverTimestamp(),
        expiresAt: serverNow() + R.LIFETIME_DAYS * 86400 * 1000,
      },
      [`rooms/${id}/slots/1`]: { uid: me, name, joinedAt: lib.serverTimestamp() },
      [`rooms/${id}/members/${me}`]: 1,
    };
    for (const [k, cell] of Object.entries(cells)) updates[`rooms/${id}/cells/${k}`] = { ...cell, by: me };
    await lib.update(lib.ref(db), updates);
    return id;
  }

  // Takes the first free seat (or the player's own), retrying if someone
  // else takes it at the same moment.
  async function join(id, name) {
    await connect();
    const me = uid();
    for (let attempt = 0; attempt < R.MAX_PLAYERS; attempt++) {
      const slots = (await lib.get(roomRef(id, 'slots'))).val() || {};
      const seat = R.freeSeat(slots, me);
      if (!seat) return 'full';
      try {
        await lib.update(roomRef(id), {
          [`slots/${seat}`]: { uid: me, name, joinedAt: lib.serverTimestamp() },
          [`members/${me}`]: seat,
        });
        return 'joined';
      } catch (e) {
        if (!/permission/i.test(String(e && (e.code || e.message)))) throw e;
      }
    }
    return 'full';
  }

  // Follows a room the player belongs to. onState receives the whole room
  // whenever anything changes, plus { connected } and { removed }.
  async function attach(id, onState) {
    await connect();
    detach();
    const me = uid();
    const state = { id, uid: me, meta: null, slots: {}, cells: {}, presence: {}, hints: {}, connected: true, removed: false };
    current = { id, uid: me, unsubscribe: [], state };
    const emit = () => current && current.id === id && onState({ ...state, serverNow: serverNow() });
    const watch = (path, key) => current.unsubscribe.push(lib.onValue(roomRef(id, path), (s) => {
      state[key] = s.val() || (key === 'meta' ? null : {});
      if (key === 'slots' && !Object.values(state.slots).some((x) => x && x.uid === me)) state.removed = true;
      emit();
    }, () => { state.removed = true; emit(); }));
    watch('meta', 'meta');
    watch('slots', 'slots');
    watch('cells', 'cells');
    watch('presence', 'presence');
    watch('hints', 'hints');
    // Presence: shown while connected, removed by the server on disconnect,
    // and restored after reconnecting.
    const mine = roomRef(id, `presence/${me}`);
    current.unsubscribe.push(lib.onValue(lib.ref(db, '.info/connected'), (s) => {
      state.connected = !!s.val();
      if (state.connected) lib.onDisconnect(mine).remove();
      emit();
    }));
  }

  function detach() {
    if (!current) return;
    current.unsubscribe.forEach((off) => off());
    current = null;
  }

  // Stepping away from the puzzle (another page): stop following the room
  // but keep the seat, so coming back rejoins.
  function away() {
    if (!current) return;
    const { id, uid: me } = current;
    detach();
    lib.update(roomRef(id), { [`presence/${me}`]: null }).catch(() => {});
  }

  const send = (path, value) => current && lib.update(roomRef(current.id), { [path]: value }).catch(() => {});
  function sendCells(changes) {
    if (!current) return;
    const updates = {};
    for (const [k, cell] of Object.entries(changes)) updates[`cells/${k}`] = cell ? { ...cell, by: current.uid } : null;
    lib.update(roomRef(current.id), updates).catch(() => {});
  }
  const sendCursor = (pos) => current && send(`presence/${current.uid}`, { r: pos.r, c: pos.c, d: pos.dir, at: lib.serverTimestamp() });
  const sendHints = (h) => current && send(`hints/${current.uid}`, { letter: h.letter, word: h.word, checks: h.checks, autocheck: !!h.autocheck });

  async function leave() {
    if (!current) return;
    const { id, uid: me, state } = current;
    detach();
    const seat = Object.entries(state.slots || {}).find(([, s]) => s && s.uid === me);
    const updates = { [`presence/${me}`]: null, [`members/${me}`]: null };
    if (seat) updates[`slots/${seat[0]}`] = null;
    await lib.update(roomRef(id), updates).catch(() => {});
  }

  // The host removes a player, who can't rejoin this room.
  async function remove(playerUid) {
    if (!current) return;
    const seat = Object.entries(current.state.slots || {}).find(([, s]) => s && s.uid === playerUid);
    const updates = { [`banned/${playerUid}`]: true, [`members/${playerUid}`]: null, [`presence/${playerUid}`]: null };
    if (seat) updates[`slots/${seat[0]}`] = null;
    await lib.update(roomRef(current.id), updates);
  }

  window.CrosswordRoomService = { peek, create, join, attach, detach, away, leave, remove, sendCells, sendCursor, sendHints, serverNow, uid: () => auth && auth.currentUser && auth.currentUser.uid };
  window.dispatchEvent(new Event('roomservice'));
})();
