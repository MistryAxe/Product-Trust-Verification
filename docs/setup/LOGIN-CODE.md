# Turning on the email sign-in code (OTP): free setup

**What it does:** a customer signs in with email + password, the app emails a 6-digit code, the customer types it in, and only then
does the home screen open. A new code is needed every time they sign in again. Reopening the app does *not* ask again.

**It runs on two free services and needs no Firebase upgrade:**
- **Cloudflare Workers** (free plan) checks the customer's login and stores/checks the codes (code: `workers/login-code`).
- **Brevo** (free plan, 300 emails a day) sends the email.

**Until you finish these steps, leave the switch OFF** (`EXPO_PUBLIC_REQUIRE_LOGIN_CODE=false`). Sign-in is then just email + password.
If you turn it on before the service is ready, customers will be stopped at the code screen and cannot get in.

## Part 1: Brevo (the sender), about 10 minutes
1. Create a free account at https://www.brevo.com (no card needed; a new account may go through a short automatic check).
2. Add and verify a **sender address**: in Brevo's settings find "Senders" (menu names change; look for "Senders, Domains & Dedicated IPs"),
   add the email address the codes should come from, and click the link Brevo emails to that address.
   - A Gmail address works to start with, but mail sent "from" Gmail through a third party can land in spam. For real customers,
     verify a domain you own and send from an address on it.
3. Create an **API key** (Brevo > SMTP & API > API Keys). Copy it somewhere safe. It is shown once.

## Part 2: Cloudflare (the code service), about 15 minutes
Open a terminal **inside the folder `workers/login-code`** and run these one at a time:
```
npx wrangler login
npx wrangler d1 create product-trust-login
```
The second command prints a `database_id`. Open `workers/login-code/wrangler.toml` and:
- paste the `database_id` in place of `00000000-0000-...`
- change `SENDER_EMAIL` to the address you verified in Brevo
- check `FIREBASE_PROJECT_ID` is your Firebase project id (it is `product-trust-verification` unless you renamed it)

Then run:
```
npx wrangler d1 execute product-trust-login --remote --file=./schema.sql
npx wrangler secret put BREVO_API_KEY
npx wrangler deploy
```
`secret put` asks you to paste the Brevo key (it is stored by Cloudflare, never in the app).
`deploy` prints your service address, something like `https://product-trust-login-code.YOUR-NAME.workers.dev`.
Test it: opening `<that address>/health` in a browser should show `{"ok":true}`.

## Part 3: Switch it on in the app
In your app `.env` add (use your own address):
```
EXPO_PUBLIC_LOGIN_CODE_URL=https://product-trust-login-code.YOUR-NAME.workers.dev
EXPO_PUBLIC_REQUIRE_LOGIN_CODE=true
```
Restart with `npx expo start --go -c`.

## Test it
Sign out, sign in as a customer. Check: the email arrives (look in junk), the code opens the home screen, a wrong code is refused,
"Send a new code" works after 30 seconds, signing out and in again asks for a new code, and reopening the app does not.

## Free-plan limits to know
- Brevo free: 300 emails a day (so about 300 customer sign-ins a day). Cloudflare free: 100,000 requests a day.
  Check both companies' current free-plan terms before launch; free plans change.
- Each code lives 10 minutes, allows 5 wrong tries, one new code per 30 seconds, at most 6 per hour per customer.
- Only a scrambled copy of each code is stored. The service refuses anything that is not a genuine login for your Firebase project.
- The code step is enforced by the app. Someone who already knows a customer's password could in theory bypass the screen with a
  modified app; the password is still required.
- Applies to customers who sign in with a password. Manufacturers and admins are not asked for a code yet.

## Appendix: the Firebase version (paid plan only)
`firebase/functions/index.js` also contains `sendLoginCode` / `verifyLoginCode` for Firebase Cloud Functions. They need the Blaze plan and an
email key stored with `npx firebase-tools functions:secrets:set RESEND_API_KEY`. To use them instead, leave `EXPO_PUBLIC_LOGIN_CODE_URL`
empty. You do not need them if you use the Cloudflare route above.
