const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('node:crypto');

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

async function deleteStoragePrefix(prefix) {
  try {
    const bucket = storage.bucket();
    await bucket.deleteFiles({ prefix });
  } catch (_) {
    // Storage cleanup is best-effort so a missing bucket/file does not block account deletion.
  }
}

const VALID_ROLES = new Set(['customer', 'manufacturer', 'admin']);
const VALID_STATUS = new Set(['active', 'disabled']);

async function requireAdmin(request) {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Sign in as an administrator.');
  const caller = await db.doc(`users/${callerUid}`).get();
  const data = caller.data() || {};
  if (!caller.exists || data.role !== 'admin' || data.accountStatus === 'disabled') {
    throw new HttpsError('permission-denied', 'Administrator access is required.');
  }
  return callerUid;
}

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function cleanEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

function tempPassword() {
  return `Pt!${crypto.randomBytes(18).toString('base64url')}9a`;
}

async function deleteQuery(collectionName, field, value) {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(collectionName).where(field, '==', value).limit(350).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 350) break;
  }
  return deleted;
}

async function anonymizeQuery(collectionName, field, value, patch) {
  let changed = 0;
  while (true) {
    const snap = await db.collection(collectionName).where(field, '==', value).limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, patch));
    await batch.commit();
    changed += snap.size;
    if (snap.size < 300) break;
  }
  return changed;
}

async function deleteProductTree(productId) {
  await Promise.all([
    deleteQuery('batches', 'productId', productId),
    deleteQuery('recalls', 'productId', productId),
    deleteQuery('serials', 'productId', productId),
  ]);
  await db.doc(`products/${productId}`).delete().catch(() => null);
}

async function cleanupUserData(uid, profile = {}) {
  const counts = { products: 0, scanEvents: 0 };

  if (profile.role === 'manufacturer') {
    const products = await db.collection('products').where('manufacturerId', '==', uid).get();
    for (const product of products.docs) await deleteProductTree(product.id);
    counts.products = products.size;
    await db.doc(`manufacturerBrands/${uid}`).delete().catch(() => null);
    await Promise.all([
      deleteQuery('batches', 'manufacturerId', uid),
      deleteQuery('recalls', 'manufacturerId', uid),
      deleteQuery('serials', 'manufacturerId', uid),
      anonymizeQuery('reports', 'manufacturerId', uid, { manufacturerId: '', manufacturerDeleted: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
      anonymizeQuery('investigations', 'manufacturerId', uid, { manufacturerId: '', manufacturerDeleted: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
    ]);
  }

  counts.scanEvents = await deleteQuery('scanEvents', 'scannerId', uid);

  // Photos attached to the user's reports are personal data and are stored in
  // reports/{id}/evidence. Remove them; the anonymised report text stays so
  // the case history is not lost. This must run BEFORE the reports are
  // anonymised below, because that clears the reporterId used to find them.
  const ownReports = await db.collection('reports').where('reporterId', '==', uid).get();
  for (const report of ownReports.docs) {
    try { await db.recursiveDelete(report.ref.collection('evidence')); } catch (_) {}
    try { await db.recursiveDelete(report.ref.collection('private')); } catch (_) {}
    const cleared = { evidenceCount: 0, evidenceUrls: [], evidenceRemoved: true };
    await report.ref.update(cleared).catch(() => null);
    await db.doc(`investigations/${report.id}`).update({ evidenceCount: 0 }).catch(() => null);
  }

  await Promise.all([
    anonymizeQuery('reports', 'reporterId', uid, { reporterId: '', reporterDeleted: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
    anonymizeQuery('investigations', 'reporterId', uid, { reporterId: '', reporterDeleted: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
  ]);

  const storagePrefixes = [
    `report-evidence/${uid}/`,
    `ingredient-labels/${uid}/`,
  ];
  if (profile.role === 'manufacturer') storagePrefixes.push(`product-images/${uid}/`);
  await Promise.all(storagePrefixes.map(deleteStoragePrefix));

  const userRef = db.doc(`users/${uid}`);
  try {
    await db.recursiveDelete(userRef);
  } catch (_) {
    await userRef.delete().catch(() => null);
  }
  return counts;
}

async function ensureNotLastAdmin(uid, profile) {
  if (profile?.role !== 'admin') return;
  const admins = await db.collection('users').where('role', '==', 'admin').get();
  const activeAdmins = admins.docs.filter((d) => d.id !== uid && d.data()?.accountStatus !== 'disabled');
  if (!activeAdmins.length) throw new HttpsError('failed-precondition', 'Create another active administrator before deleting this account.');
}

exports.adminCreateUser = onCall(async (request) => {
  await requireAdmin(request);
  const data = request.data || {};
  const fullName = cleanText(data.fullName, 120);
  const email = cleanEmail(data.email);
  const role = cleanText(data.role || 'customer', 30);
  const organizationName = cleanText(data.organizationName, 180);
  if (!fullName) throw new HttpsError('invalid-argument', 'Full name is required.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  if (!VALID_ROLES.has(role)) throw new HttpsError('invalid-argument', 'Invalid role.');
  if (role === 'manufacturer' && !organizationName) throw new HttpsError('invalid-argument', 'Organisation name is required.');

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, displayName: fullName, password: tempPassword(), emailVerified: false, disabled: false });
    await auth.setCustomUserClaims(userRecord.uid, { role });
    await db.doc(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      fullName,
      email,
      role,
      organizationName: role === 'manufacturer' ? organizationName : '',
      accountStatus: 'active',
      allergens: [], customAllergens: [], dietaryPreferences: [],
      noKnownAllergies: false,
      allergyProfileComplete: role !== 'customer',
      notificationsEnabled: true,
      locationEnabled: false,
      createdByAdmin: true,
      requiresPasswordSetup: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (userRecord?.uid) await auth.deleteUser(userRecord.uid).catch(() => null);
    if (String(error?.code || '').includes('email-already-exists')) throw new HttpsError('already-exists', 'An account already uses this email address.');
    throw new HttpsError('internal', error?.message || 'Unable to create account.');
  }
  return { uid: userRecord.uid, email };
});

exports.adminUpdateUser = onCall(async (request) => {
  const callerUid = await requireAdmin(request);
  const { uid, patch = {} } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'User profile was not found.');
  const current = snap.data() || {};
  const nextRole = patch.role ? cleanText(patch.role, 30) : current.role;
  const nextStatus = patch.accountStatus ? cleanText(patch.accountStatus, 30) : current.accountStatus || 'active';
  const nextEmail = patch.email != null ? cleanEmail(patch.email) : cleanEmail(current.email);
  const nextOrganization = patch.organizationName != null
    ? cleanText(patch.organizationName, 180)
    : cleanText(current.organizationName, 180);

  if (!VALID_ROLES.has(nextRole)) throw new HttpsError('invalid-argument', 'Invalid role.');
  if (!VALID_STATUS.has(nextStatus)) throw new HttpsError('invalid-argument', 'Invalid account status.');
  if (!/^\S+@\S+\.\S+$/.test(nextEmail)) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  if (nextRole === 'manufacturer' && !nextOrganization) throw new HttpsError('invalid-argument', 'Organisation name is required for a manufacturer.');
  if (uid === callerUid && (nextRole !== 'admin' || nextStatus === 'disabled')) {
    throw new HttpsError('failed-precondition', 'You cannot remove your own administrator access or disable your own account here.');
  }
  if (current.role === 'admin' && (nextRole !== 'admin' || nextStatus === 'disabled')) {
    await ensureNotLastAdmin(uid, current);
  }

  const firestorePatch = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  const authPatch = {};
  if (patch.fullName != null) {
    const fullName = cleanText(patch.fullName, 120);
    if (!fullName) throw new HttpsError('invalid-argument', 'Full name cannot be blank.');
    firestorePatch.fullName = fullName;
    authPatch.displayName = fullName;
  }
  if (patch.email != null && nextEmail !== cleanEmail(current.email)) {
    firestorePatch.email = nextEmail;
    firestorePatch.emailVerified = false;
    authPatch.email = nextEmail;
    authPatch.emailVerified = false;
  }
  if (patch.organizationName != null || patch.role != null) {
    firestorePatch.organizationName = nextRole === 'manufacturer' ? nextOrganization : '';
  }
  if (patch.role != null) firestorePatch.role = nextRole;
  if (patch.accountStatus != null) {
    firestorePatch.accountStatus = nextStatus;
    firestorePatch.disabledAt = nextStatus === 'disabled' ? admin.firestore.FieldValue.serverTimestamp() : null;
    authPatch.disabled = nextStatus === 'disabled';
  }

  try {
    if (Object.keys(authPatch).length) await auth.updateUser(uid, authPatch);
    if (patch.role != null) await auth.setCustomUserClaims(uid, { role: nextRole });
    await ref.update(firestorePatch);
  } catch (error) {
    if (String(error?.code || '').includes('email-already-exists')) throw new HttpsError('already-exists', 'An account already uses this email address.');
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', error?.message || 'Unable to update account.');
  }
  return { uid, email: nextEmail, role: nextRole, accountStatus: nextStatus };
});

exports.adminDeleteUser = onCall(async (request) => {
  const callerUid = await requireAdmin(request);
  const uid = cleanText(request.data?.uid, 128);
  if (!uid) throw new HttpsError('invalid-argument', 'User ID is required.');
  if (uid === callerUid) throw new HttpsError('failed-precondition', 'Use Settings to manage your own account.');
  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.data() || {};
  await ensureNotLastAdmin(uid, profile);
  const counts = await cleanupUserData(uid, profile);
  await auth.deleteUser(uid).catch((error) => {
    if (!String(error?.code || '').includes('user-not-found')) throw error;
  });
  return { uid, ...counts };
});

exports.deleteMyAccount = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const snap = await db.doc(`users/${uid}`).get();
  const profile = snap.data() || {};
  await ensureNotLastAdmin(uid, profile);
  const counts = await cleanupUserData(uid, profile);
  await auth.deleteUser(uid).catch((error) => {
    if (!String(error?.code || '').includes('user-not-found')) throw error;
  });
  return { uid, ...counts };
});

// ---------------------------------------------------------------------------
// Email sign-in codes (OTP).
//
// After a customer signs in with their password, the app asks this function to
// email a 6-digit code, and then asks the customer to type it in. Only a
// scrambled (salted hash) copy of the code is stored, it expires after 10
// minutes, and only 5 wrong guesses are allowed per code. The records live in
// `loginCodes/{uid}`, which no app user can read or write (see firebase/firestore.rules).
//
// Needs: the Blaze plan, an email provider key stored as the secret
// RESEND_API_KEY, and (optionally) LOGIN_EMAIL_FROM. See docs/setup/LOGIN-CODE.md.
// ---------------------------------------------------------------------------
const { defineSecret, defineString } = require('firebase-functions/params');

const EMAIL_API_KEY = defineSecret('RESEND_API_KEY');
const EMAIL_FROM = defineString('LOGIN_EMAIL_FROM', { default: 'Product Trust <onboarding@resend.dev>' });

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_WAIT_MS = 30 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const CODE_MAX_PER_HOUR = 6;
const HOUR_MS = 60 * 60 * 1000;

function hashLoginCode(salt, code) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function maskEmail(email = '') {
  const [name = '', domain = ''] = String(email).split('@');
  if (!domain) return '';
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

async function sendLoginCodeEmail(to, code, apiKey, from) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your Product Trust sign-in code: ${code}`,
      text: `Your Product Trust & Verification sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not try to sign in, ignore this email and change your password.`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto"><div style="background:#0D5C1A;color:#fff;padding:18px 22px;border-bottom:5px solid #C9F05A;font-size:18px;font-weight:700">Product Trust &amp; Verification</div><div style="padding:22px"><p>Your sign-in code is</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;margin:8px 0">${code}</p><p style="color:#516257">It expires in 10 minutes. If you did not try to sign in, ignore this email and change your password.</p></div></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

exports.sendLoginCode = onCall({ secrets: [EMAIL_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const user = await auth.getUser(uid);
  if (!user.email) throw new HttpsError('failed-precondition', 'This account has no email address.');

  const ref = db.doc(`loginCodes/${uid}`);
  const now = Date.now();
  const existing = (await ref.get()).data() || {};
  if (existing.sentAt && now - existing.sentAt < CODE_RESEND_WAIT_MS) {
    throw new HttpsError('resource-exhausted', 'Please wait a moment before asking for another code.');
  }
  const sameWindow = existing.windowStart && now - existing.windowStart < HOUR_MS;
  const windowStart = sameWindow ? existing.windowStart : now;
  const windowCount = sameWindow ? (existing.windowCount || 0) : 0;
  if (windowCount >= CODE_MAX_PER_HOUR) {
    throw new HttpsError('resource-exhausted', 'Too many codes were requested. Please try again in an hour.');
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  await ref.set({ codeHash: hashLoginCode(salt, code), salt, sentAt: now, expiresAt: now + CODE_TTL_MS, attempts: 0, windowStart, windowCount: windowCount + 1 });

  try {
    await sendLoginCodeEmail(user.email, code, EMAIL_API_KEY.value(), EMAIL_FROM.value());
  } catch (_) {
    await ref.set({ codeHash: '', sentAt: 0, windowStart, windowCount }, { merge: false }).catch(() => null);
    throw new HttpsError('unavailable', 'The code could not be emailed right now. Please try again in a moment.');
  }
  return { sent: true, expiresInMinutes: CODE_TTL_MS / 60000, email: maskEmail(user.email) };
});

exports.verifyLoginCode = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const code = String(request.data?.code || '').replace(/\D/g, '');
  if (code.length !== 6) throw new HttpsError('invalid-argument', 'Enter the 6-digit code from your email.');

  const ref = db.doc(`loginCodes/${uid}`);
  const outcome = await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data || !data.codeHash) return { ok: false, reason: 'none' };
    if (Date.now() > data.expiresAt) { tx.update(ref, { codeHash: '' }); return { ok: false, reason: 'expired' }; }
    if ((data.attempts || 0) >= CODE_MAX_ATTEMPTS) { tx.update(ref, { codeHash: '' }); return { ok: false, reason: 'locked' }; }
    const expected = Buffer.from(data.codeHash, 'hex');
    const actual = Buffer.from(hashLoginCode(data.salt, code), 'hex');
    if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
      tx.update(ref, { codeHash: '', verifiedAt: Date.now() }); // used once, then gone
      return { ok: true };
    }
    const attempts = (data.attempts || 0) + 1;
    tx.update(ref, { attempts });
    return { ok: false, reason: 'wrong', attemptsLeft: CODE_MAX_ATTEMPTS - attempts };
  });

  if (outcome.ok) return { verified: true };
  if (outcome.reason === 'wrong') {
    throw new HttpsError('invalid-argument', outcome.attemptsLeft > 0
      ? `That code is not correct. ${outcome.attemptsLeft} ${outcome.attemptsLeft === 1 ? 'try' : 'tries'} left.`
      : 'That code is not correct. Please request a new code.');
  }
  throw new HttpsError('failed-precondition', outcome.reason === 'expired'
    ? 'This code has expired. Please request a new one.'
    : outcome.reason === 'locked'
      ? 'Too many wrong attempts. Please request a new code.'
      : 'There is no active code. Please request a new one.');
});
