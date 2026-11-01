import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { API_CONFIG } from '../config/api';

function normalizeBarcode(value = '') {
  return String(value || '').replace(/\D/g, '').trim();
}

export async function getGs1Verification(barcode) {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;
  const snapshot = await getDoc(doc(db, 'gtinVerifications', normalized));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function subscribeGs1ReviewQueue(callback, onError) {
  return onSnapshot(collection(db, 'gtinReviewRequests'), (snapshot) => {
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    rows.sort((a, b) => {
      const countDiff = Number(b.requestCount || 0) - Number(a.requestCount || 0);
      if (countDiff) return countDiff;
      return (b.lastRequestedAt?.seconds || b.createdAt?.seconds || 0) - (a.lastRequestedAt?.seconds || a.createdAt?.seconds || 0);
    });
    callback(rows);
  }, onError);
}

export function subscribeGs1Verifications(callback, onError) {
  return onSnapshot(collection(db, 'gtinVerifications'), (snapshot) => {
    const rows = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    rows.sort((a, b) => (b.checkedAt?.seconds || 0) - (a.checkedAt?.seconds || 0));
    callback(rows);
  }, onError);
}

export async function requestGs1Review({ barcode, productName = '', brand = '', sourceType = 'external' }) {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return false;
  const ref = doc(db, 'gtinReviewRequests', normalized);
  await setDoc(ref, {
    barcode: normalized,
    productName: String(productName || '').trim(),
    brand: String(brand || '').trim(),
    sourceType,
    status: 'pending',
    requestCount: increment(1),
    lastRequestedAt: serverTimestamp(),
  }, { merge: true });
  return true;
}

export async function saveGs1Verification(adminUid, {
  barcode,
  status,
  licensedCompany = '',
  productDescription = '',
  brand = '',
  countryOfSale = '',
  notes = '',
}) {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) throw new Error('A valid GTIN / barcode is required.');
  const allowed = ['verified', 'not_found', 'mismatch', 'review_required'];
  if (!allowed.includes(status)) throw new Error('Choose a GS1 review status.');

  await setDoc(doc(db, 'gtinVerifications', normalized), {
    barcode: normalized,
    status,
    licensedCompany: String(licensedCompany || '').trim(),
    productDescription: String(productDescription || '').trim(),
    brand: String(brand || '').trim(),
    countryOfSale: String(countryOfSale || '').trim(),
    notes: String(notes || '').trim(),
    source: 'Verified by GS1 — manual review',
    checkedBy: adminUid,
    checkedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const requestRef = doc(db, 'gtinReviewRequests', normalized);
  const requestSnapshot = await getDoc(requestRef);
  if (requestSnapshot.exists()) {
    await updateDoc(requestRef, {
      status: 'reviewed',
      reviewResult: status,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
    });
  }
}

export function gs1StatusLabel(status) {
  switch (status) {
    case 'verified': return 'Verified by GS1';
    case 'not_found': return 'No GS1 record found';
    case 'mismatch': return 'GS1 ownership mismatch';
    case 'review_required': return 'Needs further GS1 review';
    default: return 'GS1 review pending';
  }
}

export function gs1StatusTone(status) {
  if (status === 'verified') return 'success';
  if (status === 'mismatch') return 'danger';
  if (status === 'not_found' || status === 'review_required') return 'warning';
  return 'neutral';
}

export const VERIFIED_BY_GS1_URL = API_CONFIG.gs1VerifyUrl || 'https://www.gs1.org/services/verified-by-gs1';
