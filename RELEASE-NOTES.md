# Product Trust v20.22.3 — Account Access & CRUD Repair

This release repairs the admin account-management and sign-in failures found during device testing.

## Fixed

- Admin Create User now works on Firebase Spark without replacing the administrator's own login session.
- Admin Edit User no longer depends on an undeployed Cloud Function.
- Active / Disabled account status now updates directly through Firestore and is enforced throughout the app.
- Removed accounts are blocked from Product Trust even when permanent Firebase Auth deletion is unavailable on Spark.
- Existing user profiles saved under an old/non-UID Firestore document ID are repaired automatically at sign-in.
- Firestore rules no longer assume a profile already exists before a new user can create/read their own profile.
- Misleading `Firebase profile error` wording was replaced with user-facing account wording.
- Admin email editing is disabled unless a trusted Admin SDK backend is used, preventing Firestore/Auth email mismatches.
- User and manufacturer lists deduplicate repaired legacy profiles.
- `app.json`, `package.json`, and `app.config.js` now agree on v20.22.3 / Android versionCode 229.

## Still intentionally optional

`firebase/functions/` remains in the project for future trusted Admin SDK operations. If it is deployed later, permanent deletion can remove another user's Firebase Authentication account. On Spark, the app falls back to removing Product Trust access instead of leaving a dead Delete button.
