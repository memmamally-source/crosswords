/*
 * Sign-in settings. Sign-in stays switched off (and the account button
 * hidden) until this holds the web app config from your Firebase project:
 * Firebase console → Project settings → Your apps → Web app → Config.
 * These values are not secret; the database rules in firestore.rules are
 * what keep each player's progress private. See README → Sign-in.
 */
window.FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAU8db8cLcZ7KJr_VZH9PczS5hvGrnz2ko',
  authDomain: 'crossword-hub.firebaseapp.com',
  projectId: 'crossword-hub',
  storageBucket: 'crossword-hub.firebasestorage.app',
  messagingSenderId: '427785979209',
  appId: '1:427785979209:web:2d630373040f9b6a2a8698',
  // Google Analytics (optional): the measurement ID (G-…) from Firebase
  // console → Project settings → Integrations → Google Analytics. While this
  // is empty, analytics stays off and players are never asked about it.
  measurementId: 'G-RN1ZYN9RSC',
  // Multiplayer (Help me solve): the Realtime Database URL from Firebase
  // console → Build → Realtime Database. While this is empty, the "Help me
  // solve" button stays hidden.
  databaseURL: 'https://crossword-hub-default-rtdb.europe-west1.firebasedatabase.app',
};
