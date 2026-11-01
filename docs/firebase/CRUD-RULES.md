# CRUD rules used by Product Trust v20.22.3

The deployable Firestore rules are in `firebase/firestore.rules`.

Deploy them with:

```powershell
npx firebase-tools deploy --only firestore:rules --project product-trust-verification
```

## Why these rules matter

Product Trust now supports the normal user-management flow on the Firebase Spark plan without depending on deployed Cloud Functions for every edit.

- Create: the admin screen creates the Authentication user in an isolated secondary Firebase session, then creates the Firestore profile.
- Read: admins can list profiles; users can read their own profile.
- Update: admins can change name, role, organisation and Active/Disabled status directly in Firestore.
- Delete: if the trusted Admin SDK function is available it performs a permanent Auth deletion; otherwise the app removes Product Trust access by marking the profile as removed. A removed account cannot use Product Trust.

Email changes for another person's Authentication account are intentionally not faked. Update those in Firebase Console unless the trusted Admin SDK backend is enabled.

## Role helpers

```rules
function signedIn() {
  return request.auth != null;
}

function hasCurrentUserProfile() {
  return signedIn() && exists(/databases/$(database)/documents/users/$(request.auth.uid));
}

function currentUser() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
}

function activeAccount() {
  return hasCurrentUserProfile()
    && currentUser().get('accountStatus', 'active') == 'active';
}

function isAdmin() {
  return activeAccount() && currentUser().get('role', '') == 'admin';
}

function isManufacturer() {
  return activeAccount() && currentUser().get('role', '') == 'manufacturer';
}

function isCustomer() {
  return activeAccount()
    && (currentUser().get('role', '') == 'customer'
      || currentUser().get('role', '') == 'consumer');
}
```

`activeAccount()` accepts only Active accounts. Disabled or removed accounts therefore lose access immediately after their profile status changes.

## User/profile CRUD and legacy profile repair

```rules
match /users/{userId} {
  allow create: if (
    signedIn()
    && request.auth.uid == userId
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.email == request.auth.token.email
    && (request.resource.data.role == 'customer'
      || request.resource.data.role == 'manufacturer')
  ) || isAdmin();

  allow read: if signedIn() && (
    request.auth.uid == userId
    || resource.data.get('uid', '') == request.auth.uid
    || (request.auth.token.get('email', '') != ''
      && resource.data.get('email', '') == request.auth.token.get('email', ''))
    || isAdmin()
  );

  allow update: if signedIn() && (
    isAdmin() ||
    (request.auth.uid == userId
      && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
        'fullName', 'organizationName', 'allergens', 'customAllergens',
        'dietaryPreferences', 'noKnownAllergies', 'allergyProfileComplete',
        'allergyProfileSkippedAt', 'notificationsEnabled', 'locationEnabled',
        'updatedAt'
      ]))
  );
}
```

The extra UID/email read checks are there only to repair older profiles that were saved under the wrong Firestore document ID. After sign-in, the app copies the user's own legacy profile to the canonical `users/{Firebase Auth UID}` path.

## One-time note for accounts disabled by an older build

v20.22.3 uses the Firestore `accountStatus` field as the Product Trust access switch on Spark. If an older Cloud Function or a manual Firebase Console action previously set a user's **Firebase Authentication** record itself to Disabled, re-enable that Auth user once in Firebase Console → Authentication → Users. After that, Product Trust Active/Disabled management works from the app without Cloud Functions.

## Manufacturer/Admin CRUD

For `products`, `batches`, `recalls`, and `serials`:

```rules
allow create: if isAdmin() || (
  isManufacturer() && request.resource.data.manufacturerId == request.auth.uid
);

allow update: if isAdmin() || (
  isManufacturer()
  && resource.data.manufacturerId == request.auth.uid
  && request.resource.data.manufacturerId == request.auth.uid
);

allow delete: if isAdmin() || (
  isManufacturer() && resource.data.manufacturerId == request.auth.uid
);
```

A manufacturer can modify only records it owns. An admin can manage all records. The ownership ID cannot be switched during an update.

## Customer CRUD

Inside the signed-in customer's own profile:

```rules
match /scans/{scanId} {
  allow read, create, update, delete:
    if isCustomer() && request.auth.uid == userId;
}

match /savedProducts/{savedId} {
  allow read, create, update, delete:
    if isCustomer() && request.auth.uid == userId;
}

match /ingredientScans/{scanId} {
  allow read, create, update, delete:
    if isCustomer() && request.auth.uid == userId;
}
```

## Storage

v20.22.3 remains on the Spark-plan path with `EXPO_PUBLIC_USE_FIREBASE_STORAGE=false`. Normal CRUD does not require Firebase Storage. Do not deploy Storage rules unless Storage is intentionally enabled later.
