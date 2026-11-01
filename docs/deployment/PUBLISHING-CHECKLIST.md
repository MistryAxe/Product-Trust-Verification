# Publishing checklist: the OPTIONAL store route (Google Play first, App Store second)

> **You do not need this to launch.** The free launch (website, install-as-app, shareable Android file) is in `docs/deployment/LAUNCH-GUIDE.md`.
> This checklist is only for listing the app in the stores, which costs money.

Fees (as published in 2026; check the stores): Google Play **$25 once**, Apple Developer Program **$99 a year**.
For a presentation or demo you need neither: use Expo Go or an installed build.

## A. Blockers I found (fix before submitting)
1. ~~Account deletion on the free plan~~ **Fixed in v20.9.** Customers and manufacturers can both delete their account in the app
   (Settings > Email & security > Delete My Account, with password confirmation). Administrator accounts are removed by another administrator.
2. **iOS only: Sign in with Apple.** Apple's guideline 4.8 generally requires an equivalent privacy-focused login when an app offers
   Google sign-in. Fix: add Sign in with Apple, or hide Google sign-in on iOS. Android is not affected. Check Apple's current wording.
3. **Reviewer access.** Reviewers cannot receive email at your address. Create a demo customer account and a demo manufacturer account,
   put the customer's email in `EXPO_PUBLIC_LOGIN_CODE_EXEMPT_EMAILS` if the email code is on, and give both logins in the review notes.
4. **Fill in and publish the privacy pages** (see B). Both stores require a working privacy-policy link, and Google also asks for a
   page explaining how to delete an account.
5. **Test on real phones.** Everything in this project was tested in a sandbox, never on a device.
6. **Scanner honesty.** Demo products should be registered through the manufacturer account so a reviewer's scan always matches.

## B. Privacy pages (free, on Firebase Hosting)
1. Open `legal/privacy.html` and `legal/delete-account.html`. Replace every yellow `[...]` item (company name, contact email,
   Information Officer, dates, child-age line) and delete the "Before publishing" boxes. Have the policy checked by someone qualified.
2. Publish: `npm run deploy:web` (builds the web version of the app, adds these two pages, and deploys to Firebase Hosting)
3. Your pages will be at your project's Hosting address (usually `https://<project-id>.web.app/privacy` and `/delete-account`; the exact
   address is shown in the Firebase console under Hosting). Use these two links in both store consoles.

## C. App assets (done)
- App icon, Android adaptive icon, web favicon: `assets/`. Play Store 512x512 icon and a simple feature graphic: `store/`.
  (The feature graphic is a plain placeholder; replace it with a designed one if you like.)
- Permission wording is set in `app.json`. The camera plugin's default microphone permission is switched OFF (the app records no audio).
- Still needed from you: **phone screenshots** (at least 2 for Google Play; Apple has required sizes), taken from a real build.

## D. Build
- Create a free Expo account, then: `npx eas-cli login` and `npx eas-cli build --platform android --profile production`
  (produces an .aab file for Google Play). iOS builds need the Apple account. Check Expo's current free-plan build limits.
- Increase `version` and the android `versionCode` / ios `buildNumber` for every upload.

## E. Store consoles
- **Google Play:** create the app and upload the .aab to a **closed testing** track first. A personal developer account created after
  13 November 2023 must run a closed test with **at least 12 testers opted in for 14 continuous days** before it can apply for production
  access (Google's own help page says so; organisation accounts are exempt). See `docs/deployment/LAUNCH-GUIDE.md` for the full plan.
  Fill in: Data safety form and content rating (drafts in `store/STORE-LISTING.md`), privacy-policy URL, account-deletion URL.
- **App Store:** App Privacy "nutrition label" (draft in `STORE-LISTING.md`), privacy-policy URL, reviewer notes with demo logins.

## F. Before and after launch
- Deploy the Firestore rules (`npx firebase-tools deploy --only firestore:rules`) and test one full loop: report with photo ->
  admin reply -> manufacturer response -> customer sees both -> delete a test customer account.
- In Google Cloud, restrict the Firebase API key to your app. Remember the third-party API keys (SerpAPI, OCR, USDA) ship inside the app.
- Old test reports created before v20.8 still carry exact coordinates on the report record; delete them (Admin > Report Records).
