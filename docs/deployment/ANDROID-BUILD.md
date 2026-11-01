# Build the Android app (free)

You need an **Android phone** to install it on. An iPhone cannot install an Android app.

## The commands (in the VS Code terminal, inside the inner project folder)
Run them one at a time, and wait for each one to finish.
```
npm install
```
```
npx eas-cli login
```
Sign in with the **Expo account that owns this project: ofentse1805**. (If you do not have it, see "If something goes wrong" below.)
```
$env:EAS_NO_VCS = "1"
```
This tells the build tool that your folder is not a git repository. Do it in the **same terminal window** as the build.
```
npm run build:android
```
When it asks **"Generate a new Android Keystore?"** answer **Y** (yes) and press Enter. Expo keeps the key for you, so later versions update the app in place.

## While it builds
Your files are uploaded (a small upload, about 1 MB) and the build runs on Expo's computers. Expo's free plan puts you in a queue, so waiting before it starts can take a long time (sometimes over an hour); the build itself then takes about 10-20 minutes.
You may close the terminal after it says the build is queued. Watch it at https://expo.dev (your project > Builds) or run `npx eas-cli build:list`.
The free plan allows 15 Android builds a month.

## Install it on the Android phone
1. When the build finishes, open its page on https://expo.dev **on the Android phone** (or scan the QR code the terminal shows).
2. Tap **Install** / **Download**. Open the downloaded file.
3. Android asks to allow "install unknown apps" for your browser: allow it, then tap **Install**.
4. If Google Play Protect warns about an unknown app: tap **More details > Install anyway**.
The app appears as **Product Trust & Verification**. It opens on the welcome screen, like in Expo Go, and the camera scanner is the real phone scanner.

## Your settings are built in
The build uploads your `.env` (API keys, recall address, sign-in code address), so the app has them. If you change `.env`, build again.
To update the app later: run `npm run build:android` again and install the new file over the old one.

## Google sign-in in the installed Android app
The app tries the phone's Google sheet first. That needs the app's signing fingerprint (SHA-1) added in Google Cloud. If the fingerprint/client configuration does not match, the app now shows a configuration error instead of falling back to blocked browser OAuth. The production SHA-1 must be registered in the Google Android OAuth client: run `npx eas-cli credentials`, choose Android, and copy the SHA1 into
Google Cloud console > APIs & Services > Credentials > your Android client.

## The map on Android
Android uses a free OpenStreetMap map (no Google key, no billing account). It needs an internet connection to show the map pictures. OpenStreetMap's public map servers are meant for light use, which is fine for a demo and a small launch;
for a large public launch, switch to a map-picture provider with its own free allowance (change the tile address in `src/components/map/leafletPage.js`). iPhone keeps using Apple Maps.

## If the app closes straight away, or shows "Product Trust could not start"
Take a screenshot of the error screen (or tell me it closes with no message at all) and send it to me. From v20.21 a start-up failure in the app's code shows its reason on screen instead of closing silently.

## If something goes wrong
| What you see | What to do |
|---|---|
| "Project owned by ofentse1805", "not authorized" or similar | Log in as **ofentse1805** (`npx eas-cli logout` then `npx eas-cli login`), or ask that account's owner to add you to the project. Or build under your own account: delete the `"owner"` line and the `"projectId"` line (inside `"extra"` > `"eas"`) in `app.json`, run `npx eas-cli init`, and paste any line it prints into `app.json`. |
| An error about "git" or "repository" | You skipped `$env:EAS_NO_VCS = "1"`, or ran it in another terminal window. Run it again in this window, then repeat the build command. |
| The app installs but recall checks / sign-in code are missing | `.env` was not uploaded. Check that the file `.easignore` exists in the project folder and does not mention `.env`. |
| "npm ci" / lock file out of sync during the build | Run `npm install` first (it updates the lock file), then build again. |
| The app opens and closes at once, with no message | Send me a screenshot of the whole phone screen and the phone model and Android version (Settings, About phone). If a plug-in cable is possible, the phone's log shows the exact cause: capture the device log with Android Studio/adb if a cable is available. |
| The build fails | Open the failed build on expo.dev, open the step marked in red (often "Run gradlew"), and send me the last 20 lines. |
| Google sign-in reports a configuration problem | Confirm the installed APK uses the EAS production keystore, and that its SHA-1 plus package `com.producttrust.verification` are registered in the Google Android OAuth client. |
