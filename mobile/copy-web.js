/*
 * Copies the website into www/, the folder the app is built from
 * (Capacitor's webDir). The app is the same site, packaged so it works
 * offline and loads instantly; only these changes are made to the copy:
 *
 *  - The Firebase SDK (sign-in, credits, duels) is bundled from the
 *    `firebase` npm package instead of being loaded from Google's CDN, so
 *    the app never runs code downloaded at run time.
 *  - The service worker isn't included: the app's files are already on the
 *    phone.
 *
 * The page itself notices it's in the app (window.Capacitor) and hides what
 * doesn't belong there: Google sign-in, the "install the app" card and
 * analytics. Run: node copy-web.js (or npm run sync, which also updates
 * the Android and iOS projects).
 */
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'www');
const SDK_VERSION = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
const SDK_FILES = ['app', 'auth', 'firestore', 'functions', 'database'].map((n) => `firebase-${n}.js`);

// What the app needs from the site (the genre landing pages in play/ are
// for search engines and stay on the website).
const COPY = ['index.html', 'manifest.webmanifest', 'css', 'js', 'puzzles', 'icons', 'privacy', 'support', 'words/legacy-order.json'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const item of COPY) {
  const from = path.join(SITE, item);
  if (!fs.existsSync(from)) throw new Error(`missing from the site: ${item}`);
  fs.cpSync(from, path.join(OUT, item), { recursive: true });
}

// The Firebase SDK, from the npm package, pointing at its own copies.
const pkg = require('firebase/package.json');
if (pkg.version !== SDK_VERSION) throw new Error(`firebase ${pkg.version} installed; the site uses ${SDK_VERSION}`);
const sdkDir = path.dirname(require.resolve('firebase/package.json'));
const vendor = path.join(OUT, 'vendor', 'firebase');
fs.mkdirSync(vendor, { recursive: true });
for (const file of SDK_FILES) {
  const src = fs.readFileSync(path.join(sdkDir, file), 'utf8');
  fs.writeFileSync(path.join(vendor, file), src.split(`${CDN}/`).join('./'));
}
const fbFile = path.join(OUT, 'js', 'firebase.js');
const fb = fs.readFileSync(fbFile, 'utf8');
if (!fb.includes(`'${CDN}'`)) throw new Error('js/firebase.js no longer names the CDN address this script replaces');
fs.writeFileSync(fbFile, fb.replace(`'${CDN}'`, "new URL('../vendor/firebase', import.meta.url).href"));

// No remote code at all: check nothing in the copy still loads scripts from
// Google's CDN.
for (const file of [...fs.readdirSync(vendor).map((f) => path.join(vendor, f)), fbFile]) {
  if (fs.readFileSync(file, 'utf8').includes('gstatic.com/firebasejs')) throw new Error(`${file} still loads the SDK from the CDN`);
}

const size = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size), 0);
console.log(`www/ ready: ${(size(OUT) / 1048576).toFixed(1)} MB`);
