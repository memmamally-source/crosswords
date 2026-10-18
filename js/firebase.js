/*
 * Starts Firebase once for the whole site, so sign-in (js/account.js) and
 * multiplayer rooms (js/room.js) share one connection and one signed-in
 * player. Each part loads only the Firebase libraries it needs.
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
      const auth = lib.getAuth(app);
      // Local test servers (set only by the test scripts).
      const emu = window.FIREBASE_EMULATORS;
      if (emu && emu.auth) lib.connectAuthEmulator(auth, emu.auth, { disableWarnings: true });
      return { lib, auth };
    });
  }
  return authPromise;
}

// Anonymous players (guests in a multiplayer room) aren't signed in as far
// as the rest of the site is concerned: no account, no synced progress.
const isRealUser = (user) => !!user && !user.isAnonymous;

window.CrosswordFirebase = { SDK, getApp, getAuth, isRealUser };
