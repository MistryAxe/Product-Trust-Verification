# Where to find every setting in your `.env` file

## How the `.env` file works
- It sits in the project's main folder (next to `package.json`). It starts with a dot, so some file browsers hide it; open it in VS Code.
- Each line is `NAME=value` with no spaces and no quotes. Example: `EXPO_PUBLIC_SERPAPI_KEY=abc123...`
- **After changing it:** restart the app with `npx expo start -c`. For the website version run `npm run deploy:web` again (the values are
  baked in when the website is built).
- Anything starting with `EXPO_PUBLIC_` ends up inside the app, so people can find it. That is fine for free keys: if one is ever abused,
  make a new key on the same website and replace it. Never post your `.env` or a screenshot showing keys.

## A. Keys you get from websites (all have a free plan)
| Line in `.env` | What it does | Where to get it |
|---|---|---|
| `EXPO_PUBLIC_OCR_SPACE_API_KEY` | Reads the printed label when someone taps "Photograph the Label" | https://ocr.space/ocrapi/freekey : enter your email and the key is emailed to you. Free. |
| `EXPO_PUBLIC_USDA_FDC_API_KEY` | Adds nutrition and ingredient details for food | https://fdc.nal.usda.gov/api-guide/ : click "Get an API Key", fill in the short form, the key is emailed to you. Free. |
| `EXPO_PUBLIC_SERPAPI_KEY` | Searches the web for products no database knows (this is what finds items like the lamp and the freshener) | https://serpapi.com : sign up, then copy the key from your dashboard ("API key"). The free plan has about **250 searches a month**. |

**About the SerpApi allowance:** a scan that no database recognises uses about 2 searches, and "Find More Product Details" can use up to 2 more.
So 250 a month is roughly 100 unrecognised scans. Plenty for testing and a demo; a whole class scanning all day would use it up. When it runs
out, nothing breaks: the app simply cannot search the web until next month and says it could not identify the product.
These three are all optional: with all three blank the app still works, it just finds less.

**No key needed:** Open Food Facts (food, beauty, household) and UPCitemdb are free to call without a key. UPCitemdb limits how many lookups per day.

## B. Google sign-in IDs (already filled in for this project)
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `..._ANDROID_CLIENT_ID`, `..._IOS_CLIENT_ID` are not secrets and are already in `.env.example`.
To find them yourself: Firebase console > Authentication > Sign-in method > Google (the "Web SDK configuration" shows the Web client ID), or
Google Cloud console > APIs & Services > Credentials > OAuth 2.0 Client IDs. More: `docs/setup/GOOGLE-SIGN-IN.md`.

## C. Lines that are NOT keys (you type these, nothing to look up)
| Line | What to put |
|---|---|
| `EXPO_PUBLIC_USE_FIREBASE_STORAGE` | `false`. Leave it. |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | Optional: your own contact email address (shows a "Contact support" row). Blank is fine. |
| `EXPO_PUBLIC_REQUIRE_LOGIN_CODE` | `false` until you have finished `docs/setup/LOGIN-CODE.md`, then `true`. |
| `EXPO_PUBLIC_LOGIN_CODE_URL` | Blank until you set up the free code service. Then the address Cloudflare prints at the end of `npx wrangler deploy` (like `https://product-trust-login-code.YOUR-NAME.workers.dev`). |
| `EXPO_PUBLIC_REQUIRE_EMAIL_VERIFICATION` | `false`. Leave it. |
| `EXPO_PUBLIC_LOGIN_CODE_EXEMPT_EMAILS` | Blank for now. Later: the email of a demo account that should skip the code (for example the one you show at the presentation). |
| `EXPO_PUBLIC_RECALL_LOOKUP_URL` | The address of your free recall service: see `docs/setup/RECALL.md`. Blank = recall checking is off. |
