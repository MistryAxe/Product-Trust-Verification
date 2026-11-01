# Product Trust v20.3 Deployment Checklist

## Project checks

```powershell
npm install
npx expo install --fix
npx expo-doctor
npm run validate-project
npx expo start --go -c
```

Do not use `npm audit fix --force` as an Expo SDK upgrade shortcut.

## UX / navigation checks

- Scan a product card contains no long technical paragraph.
- Profile does not repeat Customer / Manufacturer / Admin role labels.
- Settings opens as a section menu rather than one crowded page.
- Food Safety Profile → Back returns to the Safety section of Settings.
- Home / Settings / Saved / History / Product pages return to their previous scroll position after opening a child screen.
- External Product Check tabs work and do not overlap text.
- Long product names, labels and values wrap without collision.
- Quality Compare labels and values remain centred on a narrow phone.
- Light, Dark and Device appearance modes are readable across Customer, Manufacturer and Admin portals.
- No customer-facing message exposes Firebase, Firestore, API-key names or provider configuration details.

## Firebase Authentication

- Email/password provider enabled.
- Google provider enabled.
- Password reset and email verification templates reviewed.
- Authorized domains reviewed for the web build.
- Test password-reset and verification-email delivery with real inboxes.

## Firestore

The v20 Firestore rules were published during testing. Re-deploy only if the Firebase project has older rules than this repository:

```powershell
npx firebase-tools deploy --only firestore:rules
```

Do not weaken Firestore rules to compensate for unavailable Storage or Cloud Functions.

## Current Spark-plan limitation

The project is intentionally staying on Firebase Spark for now:

- Firebase Storage is not enabled.
- Trusted Cloud Functions are not deployed.
- Storage-dependent image/evidence uploads must degrade gracefully.
- Admin-SDK account create/update/permanent-delete functions in `firebase/functions/` are not live until a future Blaze upgrade.

Do not advertise those trusted account actions as operational until the functions are deployed.

## Environment

```env
EXPO_PUBLIC_OCR_SPACE_API_KEY=
EXPO_PUBLIC_USDA_FDC_API_KEY=
EXPO_PUBLIC_SERPAPI_KEY=
EXPO_PUBLIC_RECALL_LOOKUP_URL=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

`EXPO_PUBLIC_RECALL_LOOKUP_URL` remains blank until the external recall service is connected.

## Customer flow

- Sign up/sign in with email/password.
- Save account details and appearance mode, sign out, sign in and confirm persistence.
- Save Food Safety Profile and verify Back returns to the previous Settings area.
- Scan registered, external and unknown products.
- Confirm centred scanner and single-scan locking.
- Confirm External Product Check tabs and spacing.
- Open More Product Details and test its tabs.
- Save/reopen products and Scan History.
- Compare two appropriate products with Quality Compare.
- Submit a suspicious-product report without a Storage upload if Storage is unavailable.
- Test Trust Map with and without location permission.

## Manufacturer flow

- Read/create/update/delete Firestore-backed catalogue records allowed by deployed rules.
- Test products, batches, serials and recalls.
- Confirm ownership rules prevent editing another manufacturer's records.
- Test cases and Trust Map.
- Confirm Storage-unavailable image uploads do not crash product registration.

## Admin flow

- Test all Firestore-backed management screens and navigation.
- Test Users & Roles display/edit/status functionality that does not require undeployed Admin SDK functions.
- Confirm unavailable trusted account operations fail with a clear action-specific message rather than technical backend text.
- Test products, batches, serials, recalls, reports, investigations and Trust Map.
- Test report/case PDF export.

## Google auth testing

- Expo Go: app opens without `RNGoogleSignin` crash; native Google button is safely guarded.
- Web: test Google popup authentication.
- Native build later: test native Google SDK with the iOS/Android OAuth client IDs.

## API-key production note

`EXPO_PUBLIC_` values are visible to the client. Before public release, rotate any sensitive third-party keys exposed during development and move quota/billing-sensitive calls behind a trusted backend when practical.
