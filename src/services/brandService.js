import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// A manufacturer's public brand card (name and logo). Customers cannot read a
// manufacturer's private account, so the logo lives in its own small record
// that any signed-in account can read and only the owner can change.
const brandRef = (manufacturerId) => doc(db, 'manufacturerBrands', manufacturerId);

export function subscribeManufacturerBrand(manufacturerId, callback, onError) {
  if (!manufacturerId) return () => {};
  return onSnapshot(brandRef(manufacturerId), (snapshot) => callback(snapshot.exists() ? snapshot.data() : null), onError || (() => {}));
}

export async function getManufacturerBrand(manufacturerId) {
  if (!manufacturerId) return null;
  try {
    const snapshot = await getDoc(brandRef(manufacturerId));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (_) {
    return null;
  }
}

export async function saveManufacturerBrand(uid, { name = '', logoDataUri = '' }) {
  await setDoc(brandRef(uid), { uid, name: String(name || '').trim(), logoDataUri, updatedAt: serverTimestamp() });
}

export async function removeManufacturerBrand(uid) {
  await deleteDoc(brandRef(uid));
}
