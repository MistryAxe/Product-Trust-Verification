# Google sign-in

## How it works now (v20.14)
| Where | How Google sign-in runs |
|---|---|
| **Website** (your Firebase Hosting link) | A Google pop-up. If the phone's browser blocks the pop-up, the page signs in by itself instead and comes back signed in. |
| **Expo Go** (phone or tablet) and **installed apps** | A secure in-app browser opens **your hosted sign-in page**, Google login happens there, and the app is signed in when the browser closes. No native module and no Apple account needed. |
| Installed build that has the native Google module | Uses the native sheet first; if its settings do not match (wrong SHA-1 and so on) it falls back to the browser route automatically. |

(Before v20.14, Expo Go could only show a message saying Google sign-in was unavailable. That was the "not working" you saw.)

## What you must do, once
1. **Publish the website and the sign-in page.** In the project folder run:
   `npm run deploy:web`
   (This also writes the page's Firebase settings from `src/config/firebase.js`.)
2. **Check the page is live.** Open `https://product-trust-verification.firebaseapp.com/google-auth` in a browser. It should say
   *"This sign-in link is not valid. Close this window and start again from the app."* That is correct: it proves the page is online.
3. **Check Firebase.** Firebase console > Authentication > Sign-in method: **Google** must be *Enabled*. Authentication > Settings > Authorized
   domains must list `product-trust-verification.firebaseapp.com` and `product-trust-verification.web.app` (they are there by default).
4. **Check the Google consent screen (important for the presentation).** Google Cloud console > APIs & Services > OAuth consent screen. If its
   status is **Testing**, only the email addresses on its *Test users* list can sign in with Google. For a public launch press **Publish app**.
5. **Try it.** In the app (Expo Go is fine): Sign In > **Continue with Google** > choose an account.

## If it does not work
| What you see | What it means |
|---|---|
| The in-app browser shows a 404 or "Site not found" | Step 1 has not been done yet (`npm run deploy:web`). |
| The browser closes and nothing happens | You cancelled, or the page was closed. Try again. |
| "Google sign-in did not finish" pop-up | The answer did not match this attempt (a stale or foreign result). Try again. |
| Google says "Access blocked" or "app not verified" | Step 4: add your email as a Test user, or publish the consent screen. |
| Website: "not set up for this web address" | Firebase > Authentication > Settings > Authorized domains: add the address it shows. |
| Website: "Google sign-in is switched off" | Firebase > Authentication > Sign-in method: enable Google. |

Email and password sign-in always works as a fallback.

## Security, in plain words
- The hosted page sends the Google result **only to the app itself** (`producttrust://`), or to Expo Go on your own network or tunnel while developing.
  It refuses every other address (tested against 17 attack-style addresses).
- Each attempt carries a one-time code that the app checks, so an old or foreign result is never accepted.
- The result travels in the part of the address after `#`, which is not sent to any server.

## Honest limits
Tested here with simulated browsers and servers (the page logic, the app's button and every failure path). It was **not** tried on a real phone or
with real Google accounts, so please do step 5 on your own phone before presenting. A phone and laptop on the same Wi-Fi are needed for Expo Go.

## Installed builds (optional, later)
The native Google module in `@react-native-google-signin/google-signin` is still included for installed builds. It needs the Android SHA-1 and iOS
client settings in Google Cloud, and a new build after any change. You do not need any of that for the browser route above.
