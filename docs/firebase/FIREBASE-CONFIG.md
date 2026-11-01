# Firebase configuration

Product Trust uses Firebase Authentication and Firestore. Firebase Storage and trusted Admin SDK Functions are optional and are not required for the current Spark-plan path.

## Firestore rules

The deployable rule file is:

```text
firebase/firestore.rules
```

Deploy it with:

```powershell
npx firebase-tools deploy --only firestore:rules --project product-trust-verification
```

The rules enforce role and ownership checks for Customer, Manufacturer and Admin CRUD. See `CRUD-RULES.md` before editing them.

## Firestore indexes

Indexes are stored in:

```text
firebase/firestore.indexes.json
```

Deploy indexes with:

```powershell
npx firebase-tools deploy --only firestore:indexes --project product-trust-verification
```

## Storage

Storage rules are stored in:

```text
firebase/storage.rules
```

The current app defaults to:

```env
EXPO_PUBLIC_USE_FIREBASE_STORAGE=false
```

so normal Product Trust CRUD does not depend on Firebase Storage. Do not enable Storage in `.env` unless Firebase Storage has actually been enabled for the project.

## Firebase Functions

Trusted Admin SDK functions are kept in:

```text
firebase/functions/
```

`firebase.json` already points Firebase CLI to that folder.

They are only needed for operations that truly require Firebase Admin SDK privileges, especially permanently deleting another person's Firebase Authentication account or changing another user's Auth email/disabled flag. Normal Product Trust account creation and role/status access management now work on Spark without those functions.

## Environment

The active `.env` values are documented in `.env.example` and `../setup/API-KEYS.md`.

After changing `.env`, restart Expo:

```powershell
npx expo start -c
```

## Google Authentication

Enable Google in Firebase Authentication and configure the platform OAuth clients. See `../setup/GOOGLE-SIGN-IN.md`.

## Recall lookup

Set `EXPO_PUBLIC_RECALL_LOOKUP_URL` only when the recall worker has been deployed. See `../setup/RECALL.md`.
