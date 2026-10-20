/*
 * Hint credits and duels: the page's link to the trusted server
 * (functions/index.js). It only asks the server and listens; balances,
 * rewards and results are always decided there. The screens are in
 * js/app.js, which uses this as window.CrosswordOnline.
 *
 * Switched off until js/firebase-config.js names the region the server was
 * deployed to (functionsRegion), so the site works as before until then.
 */
const config = window.FIREBASE_CONFIG || {};
const fb = window.CrosswordFirebase;

if (config.functionsRegion && fb) start();

function start() {
  let fns = null;
  let fsLib = null;
  let fsDb = null;
  let authLib = null;
  let auth = null;
  let ready = null;

  function connect() {
    if (!ready) {
      ready = Promise.all([
        fb.getApp(), fb.getAuth(), import(`${fb.SDK}/firebase-functions.js`), fb.getDb(),
      ]).then(([app, a, fLib, store]) => {
        authLib = a.lib;
        auth = a.auth;
        fns = { lib: fLib, inst: fLib.getFunctions(app, config.functionsRegion) };
        fsLib = store.lib;
        fsDb = store.db;
        const emu = window.FIREBASE_EMULATORS; // local test servers (set only by the test scripts)
        if (emu && emu.functions) fLib.connectFunctionsEmulator(fns.inst, emu.functions.host, emu.functions.port);
        return auth.authStateReady();
      });
    }
    return ready;
  }

  // Calls a server function. Errors carry a friendly `message` and a `code`.
  async function call(name, data) {
    await connect();
    try {
      return (await fns.lib.httpsCallable(fns.inst, name, { timeout: 20000 })(data || {})).data;
    } catch (e) {
      const code = String(e.code || '').replace('functions/', '');
      const offline = code === 'unavailable' || code === 'internal' || code === 'deadline-exceeded' || !navigator.onLine;
      const err = new Error(offline ? 'Couldn’t reach Crossword Hub. Check your connection and try again.' : e.message || 'Something went wrong. Please try again.');
      err.code = offline ? 'offline' : code;
      throw err;
    }
  }

  // Who's signed in: an account, a guest (anonymous, for duels) or nobody.
  function who() {
    const u = auth && auth.currentUser;
    if (!u) return { uid: null, account: false };
    return { uid: u.uid, account: fb.isRealUser(u), name: u.displayName || '' };
  }
  // Duels need a sign-in of some kind: guests get an anonymous one.
  async function signInForDuel() {
    await connect();
    if (!auth.currentUser) await authLib.signInAnonymously(auth);
    return who();
  }

  // Live copies of a duel and of your duel record.
  async function watch(path, onData, onError) {
    await connect();
    return fsLib.onSnapshot(fsLib.doc(fsDb, path), (snap) => onData(snap.exists() ? snap.data() : null), (e) => onError && onError(e));
  }
  async function read(path) {
    await connect();
    const snap = await fsLib.getDoc(fsLib.doc(fsDb, path));
    return snap.exists() ? snap.data() : null;
  }
  // "Still here" during a duel (stamped with the server's clock).
  async function heartbeat(duel) {
    await connect();
    const me = who();
    if (!me.uid) return;
    await fsLib.setDoc(fsLib.doc(fsDb, `duels/${duel}/presence/${me.uid}`), { at: fsLib.serverTimestamp() });
  }

  const api = { live: true, connect, call, who, signInForDuel, watch, read, heartbeat };
  window.CrosswordOnline = api;
  connect().then(() => {
    authLib.onAuthStateChanged(auth, () => document.dispatchEvent(new CustomEvent('online:user', { detail: who() })));
  }).catch(() => { /* offline: the page keeps working without credits and duels */ });
  document.dispatchEvent(new CustomEvent('online:ready'));
}
