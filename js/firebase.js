/*
 * Starts Firebase once for the whole site, so sign-in (js/account.js),
 * multiplayer rooms (js/room.js) and credits and duels (js/online.js) share
 * one connection and one signed-in player. Each part loads only the Firebase libraries it needs.
 *
 * Loaded as its own (versioned) script before them and shared as
 * window.CrosswordFirebase, so updates reach installed apps.
 */
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

let appPromise = null;
let authPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = import(`${SDK}/firebase-app.js`).then(({ initializeApp, getApps }) => getApps()[0] || initializeApp(window.FIREBASE_CONFIG));
  }
  return appPromise;
}

// The sign-in library and this site's auth instance.
function getAuth() {
  if (!authPromise) {
    authPromise = Promise.all([getApp(), import(`${SDK}/firebase-auth.js`)]).then(([app, lib]) => {
      // The Android and iOS app (mobile/) signs in by email only, so it leaves
      // out Google's sign-in window helper, which would load a script from
      // the web.
      const inApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
      const auth = inApp
        ? lib.initializeAuth(app, { persistence: [lib.indexedDBLocalPersistence, lib.browserLocalPersistence] })
        : lib.getAuth(app);
      // Local test servers (set only by the test scripts).
      const emu = window.FIREBASE_EMULATORS;
      if (emu && emu.auth) lib.connectAuthEmulator(auth, emu.auth, { disableWarnings: true });
      return { lib, auth };
    });
  }
  return authPromise;
}

// The database (Firestore): synced progress, hint-credit wallets and duels.
let dbPromise = null;
function getDb() {
  if (!dbPromise) {
    dbPromise = Promise.all([getApp(), import(`${SDK}/firebase-firestore.js`)]).then(([app, lib]) => {
      const db = lib.getFirestore(app);
      const emu = window.FIREBASE_EMULATORS;
      if (emu && emu.firestore) lib.connectFirestoreEmulator(db, emu.firestore.host, emu.firestore.port);
      return { lib, db };
    });
  }
  return dbPromise;
}

// Anonymous players (guests in a multiplayer room) aren't signed in as far
// as the rest of the site is concerned: no account, no synced progress.
const isRealUser = (user) => !!user && !user.isAnonymous;

window.CrosswordFirebase = { SDK, getApp, getAuth, getDb, isRealUser };
