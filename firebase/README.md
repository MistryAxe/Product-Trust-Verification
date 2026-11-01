# Firebase Files

Everything Firebase-specific is grouped here.

```text
firebase/
├── firestore.rules          Firestore permissions / CRUD security
├── firestore.indexes.json   Firestore query indexes
├── storage.rules            Firebase Storage permissions (only needed if Storage is enabled)
└── functions/               Trusted Admin SDK / Cloud Functions source
```

## Publish Firestore rules

From the project root:

```powershell
npx firebase-tools deploy --only firestore:rules --project product-trust-verification
```

## Publish Firestore indexes

```powershell
npx firebase-tools deploy --only firestore:indexes --project product-trust-verification
```

## Storage

Product Trust currently defaults to:

```env
EXPO_PUBLIC_USE_FIREBASE_STORAGE=false
```

so Storage does not need to be deployed while the project remains on the Spark-plan path.

## Cloud Functions

The source is in `firebase/functions/`. These privileged Admin SDK operations are optional and require a Firebase plan that allows Functions deployment.

See `../docs/firebase/CRUD-RULES.md` and `../docs/firebase/FIREBASE-CONFIG.md` for details.
