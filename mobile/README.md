# Crossword Hub for Android and iOS

The app is the website itself, packaged with [Capacitor](https://capacitorjs.com)
so it installs from Google Play and the App Store, opens instantly and works
offline.

## What's here

| | |
|---|---|
| `copy-web.js` | Copies the site into `www/` (not committed), bundling the Firebase SDK so the app loads no code from the web. |
| `capacitor.config.json` | App ID `app.crosswordhub`, name, colours. |
| `android/`, `ios/` | The native projects. They're generated, but committed because they hold settings (signing, version, iPhone only). |
| `assets/` | The icon and splash-screen sources. `npm run assets` makes every size from them. |
| `store/` | Listing text, privacy answers and screenshots for both stores. See [store/LISTING.md](store/LISTING.md). |
| `../.github/workflows/android.yml` | Builds the Android app on GitHub. |
| `../.github/workflows/ios.yml` | Builds the iPhone app on GitHub's Macs and uploads it to App Store Connect, so no Mac is needed. |

In the app the page knows it's in the app (`window.Capacitor`). It:
- offers email sign-in only
- leaves out the service worker, the install card, analytics and the
  "coming soon" gift card
- makes shared links point to https://crosswordhub.app

Everything else is the same code as the website.

## Updating the app

The app doesn't update itself when the website changes: each update is a new
store release.

1. Change the site as usual and merge.
2. Raise the version that players see:
   - **Android:** `versionName` in `android/app/build.gradle`. The build number goes up by itself.
   - **iOS:** in Xcode, App target → General → Version, and Build (raise both).
3. Build and upload, as below.

---

# Step by step: getting into the stores

Do the steps in order. Things marked 💳 cost money; everything else is free.

## 0. Before either store

1. Merge this pull request.
2. On your Mac, deploy the server, which adds account deletion (`accountDelete`):
   ```
   cd ~/crosswords
   git pull
   firebase deploy --only functions
   ```
3. Check whether your Firebase key is restricted to websites:
   1. Open https://console.cloud.google.com/apis/credentials?project=crossword-hub
   2. Click the **Browser key** (auto created by Firebase).
   3. If **Application restrictions** says "Websites", add `localhost` to the list. Apps load from there.

   If it says "None", leave it.
4. Create a demo account in the app or on the website (for example `crosswordhub.review@gmail.com`) for the store reviewers.

## 1. Google Play

### 1a. Create the upload key (once, on your Mac)

This key proves future updates come from you. Keep the file and passwords safe
(for example in a password manager), and never put them in the repository.

```
cd ~
keytool -genkeypair -v -keystore crosswordhub-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password (use the same one both times it asks) and your name. Then:

```
base64 -i crosswordhub-upload.jks | pbcopy
```

That copies the key, as text, to the clipboard.

### 1b. Give the key to GitHub (once)

1. Open https://github.com/memmamally-source/crosswords/settings/secrets/actions
2. Click **New repository secret** four times, to add:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | paste (from the command above) |
| `ANDROID_KEYSTORE_PASSWORD` | the password you chose |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | the same password |

### 1c. Build

1. Open https://github.com/memmamally-source/crosswords/actions/workflows/android.yml
2. Click **Run workflow → Run workflow**.
3. After about 3 minutes, open the finished run and download **crossword-hub-android-N** at the bottom. Inside:
   - `app-debug.apk`: install it on an Android phone to try the app (allow "install unknown apps" when asked).
   - `app-release.aab`: the file you upload to Google Play.

### 1d. 💳 Google Play Console

1. Sign up at https://play.google.com/console/signup with crosswordhub@gmail.com:
   - choose **Personal**
   - pay the one-off $25 fee
   - verify your identity (photo ID); this can take a few days
   - verify a phone number
2. **Create app**:
   - name Crossword Hub
   - default language English
   - choose **Game**
   - Free
   - accept the declarations
3. Work through **Set up your app** on the dashboard. The answers are in [store/LISTING.md](store/LISTING.md):
   - privacy policy
   - app access (all functionality available without special access)
   - ads (no)
   - content rating
   - target audience
   - data safety
   - government apps (no)
   - financial features (none)
   - health (none)
   - the store listing (descriptions, the icon `store/screenshots/play-icon-512.png`, the feature graphic and screenshots)
4. **Closed testing** (required for new personal accounts):
   1. Testing → Closed testing → Create track.
   2. Upload `app-release.aab`. Leave Play App Signing on, as it is by default.
   3. Add testers by email (a Google Group works well). You need **at least 12 people opted in for 14 days in a row**.
   4. Send them the opt-in link.
5. After 14 days: Dashboard → **Apply for production** (a short questionnaire about the test), then create a Production release with the latest `.aab`. Google reviews it, usually within a few days.

## 2. Apple App Store (all from your iPhone)

GitHub builds and uploads the iPhone app on its own Mac computers
(`.github/workflows/ios.yml`), so you don't need a Mac. Everything below
works in Safari on your iPhone (if a page is cramped, tap **aA → Request
Desktop Website**).

### 2a. 💳 Join the Apple Developer Program

1. Install the free **Apple Developer** app from the App Store.
2. Open it → **Account** → sign in with your Apple ID → **Enroll Now**:
   - as an **Individual**
   - $99 a year, paid like any App Store purchase
3. Approval usually takes a day or two. Apple emails you.

### 2b. Register the app's ID (once)

1. Open https://developer.apple.com/account/resources/identifiers/list
2. Tap **+** → **App IDs** → **App** → Continue.
3. Fill in:
   - **Description:** Crossword Hub
   - **Bundle ID:** Explicit, `app.crosswordhub`
4. Continue → **Register**. No capabilities are needed.

### 2c. Create the app in App Store Connect (once)

1. Open https://appstoreconnect.apple.com → **Apps → + → New App**:
   - iOS
   - name Crossword Hub
   - language English (U.K. or U.S.)
   - bundle ID **app.crosswordhub**
   - SKU `crosswordhub-ios`
2. Fill in from [store/LISTING.md](store/LISTING.md):
   - subtitle, description and keywords
   - support and privacy URLs
   - screenshots (the `ios-` ones from `store/screenshots/`; on your phone, open each file on GitHub and save the image)
   - App Privacy
   - age rating
   - price (Free)
   - review notes with the demo account

### 2d. Let GitHub upload for you (once)

1. In App Store Connect: **Users and Access → Integrations → App Store Connect API → Team Keys → +**:
   - name: GitHub
   - access: **Admin** (needed so it can create the signing certificate)
   - **Generate**
2. On that page, note the **Issuer ID** (above the list) and the new key's **Key ID**.
3. Tap **Download** next to the key. You can download it **only once**, so keep the file safe. It's a short text file named `AuthKey_XXXXXXXXXX.p8`.
4. Find your **Team ID**: https://developer.apple.com/account → Membership details.
5. Open https://github.com/memmamally-source/crosswords/settings/secrets/actions and add four secrets with **New repository secret**:

| Name | Value |
|---|---|
| `APPSTORE_KEY_ID` | the Key ID |
| `APPSTORE_ISSUER_ID` | the Issuer ID |
| `APPSTORE_KEY` | the whole text of the `.p8` file, from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----` |
| `APPLE_TEAM_ID` | the Team ID |

To copy the `.p8` text on an iPhone, open the file in the **Files** app (tap it to preview), then select all and copy. If your phone won't show it as text, do this one step on your Mac: open the file in TextEdit and copy.

### 2e. Build and test (each release, about 15 minutes, no Mac)

1. Open https://github.com/memmamally-source/crosswords/actions/workflows/ios.yml → **Run workflow → Run workflow**.
2. When it's green (about 10 minutes), wait another 10–15 minutes for Apple to process the build.
3. Install the free **TestFlight** app. In App Store Connect → your app → **TestFlight**, add yourself as an internal tester, then open the invitation on your iPhone and install Crossword Hub.

### 2f. Submit for review

1. In App Store Connect → your app → the **1.0** version page → **Build**, choose the build GitHub uploaded.
2. Press **Add for Review → Submit**. Reviews usually take a day or two, and Apple emails you the result.

*(Prefer your Mac? Run `cd ~/crosswords/mobile && npm install && npm run sync && npx cap open ios`, choose your Team under Signing & Capabilities, then Product → Archive → Distribute App.)*

## If a store rejects the app

Send me the message they sent: it usually names the guideline and what to change.
