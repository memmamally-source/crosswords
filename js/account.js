/*
 * Optional sign-in, so progress follows a player between devices.
 *
 * Uses Firebase (Google's sign-in and database service). Does nothing until
 * js/firebase-config.js holds a project config. Each player's progress is
 * stored as one document, users/{uid}, holding a JSON copy of the syncable
 * part of their saved progress (see js/sync.js).
 */
const { getAuth, getDb, isRealUser } = window.CrosswordFirebase;
const config = window.FIREBASE_CONFIG;
const hub = window.CrosswordHub;
const { mergeStores, syncable, differs } = window.CrosswordSync;

const $ = (sel) => document.querySelector(sel);

if (config && hub) start().catch(() => { /* sign-in unavailable (e.g. offline): the site works as before */ });

async function start() {
  const [{ lib: authLib, auth }, { lib: db, db: firestore }] = await Promise.all([getAuth(), getDb()]);

  let user = null;
  let mode = 'signin'; // or 'create'
  let lastSynced = null;
  let pushTimer = null;
  let applying = false;

  const button = $('#account-btn');
  button.hidden = false;
  // The app offers email sign-in only: Google's sign-in window doesn't open
  // inside an app's web view (and the stores would then require Sign in
  // with Apple as well).
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    $('[data-account="google"]').style.display = 'none';
    $('.account-or').style.display = 'none';
  }
  button.addEventListener('click', () => {
    message('');
    $('#account-dialog').showModal();
  });

  // ---------- Syncing ----------
  const userDoc = () => db.doc(firestore, 'users', user.uid);

  async function pull() {
    if (!user) return;
    status('Syncing…');
    try {
      const snap = await db.getDoc(userDoc());
      const remote = snap.exists() ? JSON.parse(snap.data().progress || '{}') : {};
      const local = hub.getStore();
      const merged = mergeStores(local, remote);
      if (differs(local, merged)) {
        applying = true;
        hub.applyStore(merged);
        applying = false;
      }
      if (differs(remote, merged)) await push();
      lastSynced = Date.now();
      status();
    } catch (e) {
      applying = false;
      status('Offline: your progress will sync when you’re back online.');
    }
  }

  async function push() {
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    try {
      await db.setDoc(userDoc(), {
        progress: JSON.stringify(syncable(hub.getStore())),
        updated: db.serverTimestamp(),
      });
      lastSynced = Date.now();
      status();
    } catch (e) {
      status('Offline: your progress will sync when you’re back online.');
    }
  }

  // Save to the account a few seconds after progress changes, and straight
  // away when the page is hidden (switching apps, closing the tab).
  hub.onSave(() => {
    if (!user || applying) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 4000);
  });
  document.addEventListener('visibilitychange', () => {
    if (!user) return;
    if (document.visibilityState === 'hidden' && pushTimer) push();
    if (document.visibilityState === 'visible') pull();
  });
  window.addEventListener('online', () => pull());

  // ---------- Signed in or out ----------
  // Guests in a multiplayer room sign in anonymously; to the account they
  // count as signed out, so nothing is synced for them.
  authLib.onAuthStateChanged(auth, (signedIn) => {
    const u = isRealUser(signedIn) ? signedIn : null;
    user = u;
    const name = u && (u.displayName || u.email || 'Player');
    button.setAttribute('aria-label', u ? `Account: ${name}` : 'Sign in');
    button.title = u ? name : 'Sign in';
    button.classList.toggle('signed-in', !!u);
    $('#account-avatar').hidden = !u;
    $('#account-avatar').textContent = u ? name.trim()[0].toUpperCase() : '';
    $('#account-signed-out').hidden = !!u;
    $('#account-signed-in').hidden = !u;
    $('#account-title').textContent = u ? 'Signed in' : mode === 'create' ? 'Create an account' : 'Sign in';
    if (u) {
      $('#account-who').textContent = u.email && u.displayName ? `${u.displayName} · ${u.email}` : name;
      pull();
    } else {
      lastSynced = null;
    }
  });

  function status(text) {
    if (text) {
      $('#account-status').textContent = text;
      return;
    }
    $('#account-status').textContent = lastSynced
      ? `Progress synced ${new Date(lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : '';
  }

  function message(text, ok) {
    const el = $('#account-message');
    el.textContent = text;
    el.classList.toggle('ok', !!ok);
  }

  const friendly = {
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Choose a password of at least 6 characters.',
    'auth/email-already-in-use': 'There’s already an account with that email. Sign in instead.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email. Create one instead.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
    'auth/popup-closed-by-user': '',
    'auth/cancelled-popup-request': '',
  };
  const explain = (e) => (e && e.code in friendly ? friendly[e.code] : 'Something went wrong. Please try again.');

  function setMode(next) {
    mode = next;
    const create = mode === 'create';
    $('#account-title').textContent = create ? 'Create an account' : 'Sign in';
    $('#account-submit').textContent = create ? 'Create account' : 'Sign in';
    $('#account-toggle').textContent = create ? 'Already have an account? Sign in' : 'New here? Create an account';
    $('#account-password').autocomplete = create ? 'new-password' : 'current-password';
    message('');
  }

  // ---------- Buttons and form ----------
  $('#account-dialog').addEventListener('click', async (e) => {
    const action = e.target.closest('[data-account]');
    if (!action) return;
    const what = action.dataset.account;
    if (what === 'toggle-mode') setMode(mode === 'create' ? 'signin' : 'create');
    if (what === 'google') {
      message('');
      try {
        await authLib.signInWithPopup(auth, new authLib.GoogleAuthProvider());
      } catch (err) {
        message(explain(err));
      }
    }
    if (what === 'reset') {
      const email = $('#account-email').value.trim();
      if (!email) return message('Enter your email above, then tap “Forgot password?” again.');
      try {
        await authLib.sendPasswordResetEmail(auth, email);
        message(`We’ve sent a link to reset your password to ${email}.`, true);
      } catch (err) {
        message(explain(err));
      }
    }
    if (what === 'signout') {
      if (pushTimer) await push();
      await authLib.signOut(auth);
      setMode('signin');
    }
    if (what === 'delete-start') {
      message('');
      const usesPassword = !!(user && user.providerData.some((p) => p.providerId === 'password'));
      $('#account-delete-pw-row').hidden = !usesPassword;
      $('#account-delete-password').value = '';
      $('#account-delete').hidden = false;
      $('#account-delete').scrollIntoView({ block: 'nearest' });
    }
    if (what === 'delete-cancel') $('#account-delete').hidden = true;
    if (what === 'delete-confirm') await deleteAccount();
  });

  // ---------- Deleting the account ----------
  // Both app stores require it. The player confirms who they are (password,
  // or Google again), then the server deletes everything kept for them
  // (accountDelete in functions/index.js). Progress on this device stays.
  async function deleteAccount() {
    const online = window.CrosswordOnline;
    if (!user || !online) return message('Deleting an account needs a connection to Crossword Hub. Try again later.');
    const button = $('#account-delete-confirm');
    button.disabled = true;
    message('');
    try {
      if (user.providerData.some((p) => p.providerId === 'password')) {
        const password = $('#account-delete-password').value;
        if (!password) return message('Enter your password to confirm.');
        await authLib.reauthenticateWithCredential(user, authLib.EmailAuthProvider.credential(user.email, password));
      } else {
        await authLib.reauthenticateWithPopup(user, new authLib.GoogleAuthProvider());
      }
      await user.getIdToken(true);
      clearTimeout(pushTimer);
      pushTimer = null;
      await online.call('accountDelete', {});
      await authLib.signOut(auth).catch(() => {});
      $('#account-delete').hidden = true;
      setMode('signin');
      message('Your account has been deleted.', true);
    } catch (err) {
      message(err && err.code && String(err.code).startsWith('auth/') ? explain(err) : (err && err.message) || 'Something went wrong. Please try again.');
    } finally {
      button.disabled = false;
    }
  }

  $('#account-dialog').addEventListener('close', () => { $('#account-delete').hidden = true; });

  $('#account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#account-email').value.trim();
    const password = $('#account-password').value;
    if (!email) return message('Enter your email address.');
    message('');
    $('#account-submit').disabled = true;
    try {
      if (mode === 'create') await authLib.createUserWithEmailAndPassword(auth, email, password);
      else await authLib.signInWithEmailAndPassword(auth, email, password);
      $('#account-password').value = '';
    } catch (err) {
      message(explain(err));
    } finally {
      $('#account-submit').disabled = false;
    }
  });
}
