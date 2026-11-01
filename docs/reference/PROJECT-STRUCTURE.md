# Project Structure

```text
Product-Trust-Verification/
├── App.js
├── index.js
├── app.json
├── app.config.js
├── eas.json
├── package.json
├── firebase.json
├── .env.example
├── README.md
├── RELEASE-NOTES.md
├── assets/
├── docs/
│   ├── setup/
│   ├── firebase/
│   ├── deployment/
│   ├── testing/
│   └── reference/
├── firebase/
│   ├── firestore.rules
│   ├── storage.rules
│   ├── firestore.indexes.json
│   └── functions/
├── legal/
├── scripts/
├── src/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── hooks/
│   ├── navigation/
│   ├── screens/
│   ├── services/
│   ├── startup/
│   ├── theme/
│   └── utils/
├── store/
├── web-static/
└── workers/
    ├── login-code/
    └── recall-lookup/
```

## App code

`src/` contains the application. Screens are separated by Customer, Manufacturer, Admin, authentication, onboarding and shared/account responsibilities.

## Firebase

Everything Firebase-deployment-specific is grouped under `firebase/`. The root `firebase.json` points to these locations, so normal Firebase CLI commands still work from the project root.

## Workers

`workers/` contains optional Cloudflare services used for recall lookup and login codes. They are separate from Firebase and can be deployed independently.

## Documentation

`docs/` contains only current documentation grouped by purpose. Historical `CHANGES-v20.x.md` files are intentionally not part of the clean project.
