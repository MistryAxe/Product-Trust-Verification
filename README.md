# Product Trust & Verification v20.22.3

Clean deployment-ready project structure for the Product Trust mobile/web application.

## Start here

1. Copy `.env.example` to `.env` and fill in the required values.
2. Install dependencies:

```powershell
npm install
npx expo install --fix
npx expo-doctor
npm run validate-project
```

3. Run in Expo Go:

```powershell
npx expo start --go -c
```

## Main folders

```text
src/                 App code
assets/              App images/icons
docs/                Current setup/deployment/testing documentation
firebase/            Firestore/Storage rules, indexes and Firebase Functions
workers/             Cloudflare workers for recall lookup and login codes
legal/               Privacy and account-deletion pages
store/               Store listing notes and graphics
scripts/             Validation and web-deploy helpers
web-static/          Static web/PWA authentication assets
```

See `docs/README.md` for the documentation index and `docs/reference/PROJECT-STRUCTURE.md` for the full structure.

## Firebase rules

The active rules are intentionally grouped under `firebase/`:

```text
firebase/firestore.rules
firebase/storage.rules
firebase/firestore.indexes.json
firebase/functions/
```

Deploy Firestore rules with:

```powershell
npx firebase-tools deploy --only firestore:rules --project product-trust-verification
```

Storage is currently optional because the project is configured for the Spark-plan path with `EXPO_PUBLIC_USE_FIREBASE_STORAGE=false`.

Read `docs/firebase/CRUD-RULES.md` before changing permissions.

## Android build

```powershell
npm install
npx eas-cli login
$env:EAS_NO_VCS = "1"
npm run build:android
```

See `docs/deployment/ANDROID-BUILD.md` for the full build/install guide.

## OTA updates

`expo-updates` is configured. After a compatible installed build is on the device, JavaScript/UI fixes can be published with:

```powershell
npm run update:production -- --message "Describe the fix"
```

Native dependency, permission, SDK, camera-native, or native Google-sign-in changes still require a new build.

## Recall service

The app uses `EXPO_PUBLIC_RECALL_LOOKUP_URL` for external recall lookup. The Cloudflare worker source is in `workers/recall-lookup/`.

See `docs/setup/RECALL.md`.

## Current release

Current version: **20.22.3**  
Android versionCode: **229**

See `RELEASE-NOTES.md` for the current release summary only. Historical per-version change files have been removed from the project root to keep the repository clean.
