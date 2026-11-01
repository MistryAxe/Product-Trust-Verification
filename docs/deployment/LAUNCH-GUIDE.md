# Free launch guide for students

**Everything in the main plan below costs nothing.** The only things that cost money are the app *stores* (Google Play, Apple), and you do
not need them to launch publicly. They are listed at the end as an optional extra.

## The free launch, in order

### 1. A public website (free): Firebase Hosting
Run `npm run deploy:web`. It builds the website version of the app, adds the privacy pages and publishes everything. You get an address like
`https://product-trust-verification.web.app` that anyone can open. Free allowance: 10 GB storage and 10 GB transfer a month on the free plan.

### 2. Install it like an app (free, no store)
The website can be installed on a phone, with its own icon, opening full-screen:
- **Android (Chrome):** open the link, tap the menu (three dots), choose **Install app** or **Add to Home screen**.
- **iPhone (Safari):** tap Share, then **Add to Home Screen**.
Anyone you send the link to can do this. (Built and checked in a simulated browser; not tried on a real phone yet. Try it on yours.)

### 3. A real Android app file, shared directly (free)
`npx eas-cli build --platform android --profile preview` makes an installable **.apk**. The free Expo plan includes 15 Android builds a
month in a slower queue (waits over an hour can happen). Send the file or link to friends and classmates and they install it.
Google is bringing "developer verification" for apps installed outside the Play Store: it starts on 30 September 2026 in Brazil, Indonesia,
Singapore and Thailand and reaches other countries from 2027. For students and hobbyists there is a **free** "limited distribution" account
(no ID, no fee) for up to 20 devices. South Africa is not in the first wave, but check Google's page before you present.

### 4. Things that make the free version safe to present
- **Type-the-barcode box** on the scan screen: if the camera fails, or you are using a browser, type the number under the barcode.
- **Demo products:** log in as the manufacturer account and register 3 to 5 products whose barcodes you will show, so they always match.
- **Two demo accounts** (a customer and a manufacturer). Write the logins down.

### 5. Free extras
- **Email sign-in code:** Cloudflare + Brevo free plans, no domain needed (see `docs/setup/LOGIN-CODE.md`). Optional.
- **Privacy pages:** already published by step 1. Fill in the yellow placeholders in `legal/privacy.html` and `legal/delete-account.html` first.
- **Scanner tuning:** follow `docs/testing/SCANNER-TEST-SHEET.md` and send me your results.

## What a browser version can and cannot do (be honest in your presentation)
It runs the whole app: sign-in, reports, the map, the dashboards, PDFs. Phone browsers may not scan barcodes (use the typed box), and browsers
block some of the outside lookups the scanner uses, so it will identify fewer products than the phone app. Open it in Chrome and try every
screen you plan to show.

## Not free (optional, only if you later want a store listing)
| Item | Cost | Notes |
|---|---|---|
| Google Play developer account | US$25 once | A new personal account must run a closed test with **12 testers for 14 continuous days** before production: about three weeks in total |
| Apple Developer Program (iPhone) | US$99 a year | Also needs Sign in with Apple added. Apple waives the fee for nonprofits and accredited educational institutions, so ask your department whether the institution can enrol |
| Your own domain (for sending email from your own address) | a small yearly fee | Not needed for the free route |
Prices change; check each company before you pay. The store plan is in `docs/deployment/PUBLISHING-CHECKLIST.md`.

## What only you can do
Run the deploy commands, create the demo accounts and register the demo products, fill in the privacy placeholders, try the site and the
installed app on your own phone, and run the scanner test sheet.
