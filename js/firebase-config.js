/*
 * Sign-in settings. Sign-in stays switched off (and the account button
 * hidden) until this holds the web app config from your Firebase project:
 * Firebase console → Project settings → Your apps → Web app → Config.
 * These values are not secret; the database rules in firestore.rules are
 * what keep each player's progress private. See README → Sign-in.
 */
window.FIREBASE_CONFIG = null;
