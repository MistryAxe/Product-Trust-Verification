import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { isStrongPassword, isValidEmail, normalizeEmail, passwordRequirementMessage } from '../utils/validation';

const PUBLIC_ACCOUNT_TYPES = ['customer', 'manufacturer'];

// When a verification email was last sent from this device, so the verify
// screen does not send a second one straight after sign-up.
const verificationSentAt = new Map();
export function verificationSentRecently(uid, withinMs = 120000) {
  const at = verificationSentAt.get(uid);
  return Boolean(at) && Date.now() - at < withinMs;
}

export async function registerAccount({ fullName, email, password, accountType, organizationName = '' }) {
  const role = String(accountType || '').toLowerCase();
  const cleanEmail = normalizeEmail(email);
  if (!PUBLIC_ACCOUNT_TYPES.includes(role)) throw new Error('Choose Customer or Manufacturer.');
  if (!fullName.trim()) throw new Error('Enter your full name.');
  if (!isValidEmail(cleanEmail)) throw new Error('Enter a valid email address.');
  if (!isStrongPassword(password)) throw new Error(passwordRequirementMessage());
  if (role === 'manufacturer' && !organizationName.trim()) throw new Error('Enter the manufacturer or organisation name.');

  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const user = credential.user;
  await updateProfile(user, { displayName: fullName.trim() });

  try {
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      fullName: fullName.trim(),
      email: user.email,
      role,
      organizationName: role === 'manufacturer' ? organizationName.trim() : '',
      accountStatus: 'active',
      allergens: [],
      customAllergens: [],
      dietaryPreferences: [],
      noKnownAllergies: false,
      allergyProfileComplete: role !== 'customer',
      notificationsEnabled: true,
      locationEnabled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    try { await deleteUser(user); } catch (_) {}
    throw error;
  }

  try {
    await sendEmailVerification(user);
    verificationSentAt.set(user.uid, Date.now());
  } catch (_) {
  }

  return user;
}

export async function loginWithEmail(email, password) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('Enter a valid email address.');
  if (!String(password || '')) throw new Error('Enter your password.');
  return signInWithEmailAndPassword(auth, cleanEmail, password);
}


export async function loginWithGoogleIdToken(idToken) {
  if (!idToken) throw new Error('Google did not return a valid ID token.');
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export async function loginWithGooglePopup() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    // Some phone browsers block the pop-up window. Sign in on this same page instead (the page comes back signed in).
    if (/popup-blocked|operation-not-supported-in-this-environment/i.test(String(error?.code || ''))) {
      try { globalThis.sessionStorage?.setItem('pt_google_redirect', '1'); } catch (_) { /* private mode: nothing to remember */ }
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

// True once if this page load is the return from a Google sign-in redirect (so the person is not signed out again straight away).
export function consumeGoogleRedirectMarker() {
  try {
    const store = globalThis.sessionStorage;
    if (!store || store.getItem('pt_google_redirect') !== '1') return false;
    store.removeItem('pt_google_redirect');
    return true;
  } catch (_) {
    return false;
  }
}

// Called when the web page opens, so a Google sign-in that went through the redirect route is finished.
export async function completeGoogleRedirect() {
  try { return await getRedirectResult(auth); } catch (_) { return null; }
}

export async function logout() {
  return signOut(auth);
}

export async function resetPassword(email) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('Enter a valid email address.');
  return sendPasswordResetEmail(auth, cleanEmail);
}

export async function resendVerification() {
  if (!auth.currentUser) throw new Error('No signed-in user.');
  const sent = await sendEmailVerification(auth.currentUser);
  verificationSentAt.set(auth.currentUser.uid, Date.now());
  return sent;
}

export async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid);

  const normalizeProfile = (id, data = {}) => ({
    id,
    ...data,
    uid: data.uid || id,
    fullName: data.fullName || data.name || user.displayName || '',
    email: data.email || user.email || '',
    role: data.role === 'consumer' ? 'customer' : data.role || 'customer',
    accountStatus: data.accountStatus || 'active',
    locationEnabled: data.locationEnabled ?? data.locationSharing ?? false,
  });

  // Normal/canonical profile path first.
  for (const waitMs of [0, 150, 350, 700]) {
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) return normalizeProfile(snapshot.id, snapshot.data());
  }

  // Older builds could leave a profile under a non-UID Firestore document id.
  // The new rules allow a signed-in person to locate only a legacy profile that
  // explicitly belongs to their own UID or verified Auth email. Copy it to the
  // canonical users/{uid} path so every later screen and rule sees one shape.
  let legacy = null;
  try {
    const byUid = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid), limit(1)));
    legacy = byUid.docs.find((item) => item.id !== user.uid) || null;
  } catch (_) {}

  if (!legacy && user.email) {
    try {
      const byEmail = await getDocs(query(collection(db, 'users'), where('email', '==', user.email), limit(1)));
      legacy = byEmail.docs.find((item) => item.id !== user.uid) || null;
    } catch (_) {}
  }

  if (legacy) {
    const repaired = normalizeProfile(user.uid, legacy.data());
    const payload = {
      ...legacy.data(),
      uid: user.uid,
      fullName: repaired.fullName,
      email: user.email || repaired.email,
      role: repaired.role,
      accountStatus: repaired.accountStatus,
      updatedAt: serverTimestamp(),
      migratedFromProfileId: legacy.id,
    };
    await setDoc(ref, payload, { merge: true });
    return normalizeProfile(user.uid, payload);
  }

  // Google and older email/password accounts may legitimately have an Auth
  // account before a Firestore profile exists. Create the minimum safe customer
  // profile rather than leaving the user trapped after successful authentication.
  const profile = {
    uid: user.uid,
    fullName: user.displayName || '',
    email: user.email || '',
    role: 'customer',
    organizationName: '',
    accountStatus: 'active',
    allergens: [],
    customAllergens: [],
    dietaryPreferences: [],
    noKnownAllergies: false,
    allergyProfileComplete: false,
    notificationsEnabled: true,
    locationEnabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { id: user.uid, ...profile };
}
