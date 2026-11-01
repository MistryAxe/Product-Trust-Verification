import { collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '../config/firebase';

function normalizeUser(id, data = {}) {
  const legacyRole = data.role === 'consumer' ? 'customer' : data.role;
  return {
    id,
    ...data,
    uid: data.uid || id,
    fullName: data.fullName || data.name || '',
    role: legacyRole || 'customer',
    locationEnabled: data.locationEnabled ?? data.locationSharing ?? false,
    accountStatus: data.accountStatus || 'active',
  };
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? normalizeUser(snapshot.id, snapshot.data()) : null;
}

export async function updateUserSettings(uid, patch) {
  const cleanPatch = {
    ...patch,
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, 'users', uid), cleanPatch);

  if (typeof patch.fullName === 'string' && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: String(patch.fullName ?? '').trim() });
  }
}

export function subscribeUserProfile(uid, callback, onError) {
  return onSnapshot(doc(db, 'users', uid), (snapshot) => {
    callback(snapshot.exists() ? normalizeUser(snapshot.id, snapshot.data()) : null);
  }, onError);
}

export function subscribeUsers(callback, onError) {
  return onSnapshot(collection(db, 'users'), (snapshot) => {
    const byUid = new Map();
    snapshot.docs.forEach((d) => {
      const user = normalizeUser(d.id, d.data());
      if (user.accountStatus === 'deleted' || user.legacyProfile === true) return;
      const key = user.uid || user.id;
      const existing = byUid.get(key);
      // Prefer the canonical users/{uid} document if both a legacy and repaired
      // profile are present during migration.
      if (!existing || d.id === key) byUid.set(key, user);
    });
    const users = [...byUid.values()];
    users.sort((a, b) => String(a.fullName || a.email || '').localeCompare(String(b.fullName || b.email || '')));
    callback(users);
  }, onError);
}

export async function adminSetUserRole(uid, role) {
  if (!['customer', 'manufacturer', 'admin'].includes(role)) throw new Error('Invalid role.');
  await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() });
}
