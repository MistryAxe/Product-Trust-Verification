import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  createUserWithEmailAndPassword,
  deleteUser as deleteSecondaryUser,
  getAuth,
  sendPasswordResetEmail,
  signOut as signOutSecondary,
  updateProfile as updateSecondaryProfile,
} from 'firebase/auth';
import { app, auth, db, firebaseConfig } from '../config/firebase';
import { isValidEmail, normalizeEmail } from '../utils/validation';

const functions = getFunctions(app);
const callAdminDeleteUser = httpsCallable(functions, 'adminDeleteUser');

function rows(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function sortNewest(items) {
  return [...items].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

function isValidGtin(barcode) {
  const digits = String(barcode || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1).split('').map(Number).reverse();
  const sum = body.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return ((10 - (sum % 10)) % 10) === Number(digits.at(-1));
}

export function subscribeAllBatches(callback, onError) {
  return onSnapshot(collection(db, 'batches'), (snapshot) => callback(sortNewest(rows(snapshot))), onError);
}

export function subscribeAllRecalls(callback, onError) {
  return onSnapshot(collection(db, 'recalls'), (snapshot) => callback(sortNewest(rows(snapshot))), onError);
}

export function subscribeAllSerials(callback, onError) {
  return onSnapshot(collection(db, 'serials'), (snapshot) => callback(sortNewest(rows(snapshot))), onError);
}

export function subscribeAllReports(callback, onError) {
  return onSnapshot(collection(db, 'reports'), (snapshot) => callback(sortNewest(rows(snapshot))), onError);
}

export async function adminUpdateProduct(productId, patch) {
  const clean = {};
  if (patch.name != null) clean.name = String(patch.name).trim();
  if (patch.brand != null) clean.brand = String(patch.brand).trim();
  if (patch.barcode != null) {
    const barcode = String(patch.barcode).replace(/\D/g, '').trim();
    if (!isValidGtin(barcode)) throw new Error('Enter a valid GTIN / EAN / UPC barcode with a correct check digit.');
    const existing = await getDocs(query(collection(db, 'products'), where('barcode', '==', barcode), limit(2)));
    const conflict = existing.docs.find((d) => d.id !== productId);
    if (conflict) throw new Error('Another product already uses this barcode.');
    clean.barcode = barcode;
  }
  const textFields = ['category', 'productClass', 'equipmentType', 'country', 'marketCountries', 'manufacturingPlaces', 'origins', 'authorisedRetailers', 'traceabilityCode', 'netContent', 'servingSize', 'description', 'model', 'partNumber', 'sku', 'color', 'size', 'dimensions', 'weight', 'material', 'warranty', 'ratedVoltage', 'ratedCurrent', 'ratedPower', 'frequency', 'phase', 'speedRpm', 'pressureRating', 'capacity', 'ipRating', 'certificationMarks', 'officialWebsite', 'officialProductUrl', 'packagingReferenceUrl', 'packagingDescription', 'securityFeatures', 'ingredientsText', 'nutritionGrade', 'ecoScore', 'novaGroup'];
  textFields.forEach((key) => { if (patch[key] != null) clean[key] = String(patch[key]).trim(); });
  if (patch.active != null) clean.active = !!patch.active;
  if (patch.manufacturerId != null) clean.manufacturerId = String(patch.manufacturerId);
  if (patch.manufacturerName != null) clean.manufacturerName = String(patch.manufacturerName).trim();
  clean.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'products', productId), clean);
}

export async function adminDeleteProduct(productId) {
  const childSpecs = [
    ['batches', 'productId'],
    ['recalls', 'productId'],
    ['serials', 'productId'],
  ];
  for (const [collectionName, field] of childSpecs) {
    const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', productId)));
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'products', productId));
}

export async function adminCreateBatch({ manufacturerId, productId, batchNumber, manufactureDate = '', expiryDate = '', status = 'active' }) {
  const number = String(batchNumber || '').trim();
  if (!manufacturerId || !productId || !number) throw new Error('Manufacturer, product and batch number are required.');
  const existing = await getDocs(query(collection(db, 'batches'), where('productId', '==', productId), where('batchNumber', '==', number), limit(1)));
  if (!existing.empty) throw new Error('This batch already exists for the selected product.');
  if (manufactureDate && Number.isNaN(new Date(manufactureDate).getTime())) throw new Error('Manufacture date must be valid.');
  if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) throw new Error('Expiry date must be valid.');
  if (manufactureDate && expiryDate && new Date(expiryDate) < new Date(manufactureDate)) throw new Error('Expiry date cannot be before manufacture date.');
  return addDoc(collection(db, 'batches'), {
    manufacturerId, productId, batchNumber: number, manufactureDate, expiryDate,
    status: status || 'active', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function adminUpdateBatch(batchId, patch) {
  const ref = doc(db, 'batches', batchId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Batch not found.');
  const current = snapshot.data() || {};
  const clean = { updatedAt: serverTimestamp() };
  ['batchNumber', 'manufactureDate', 'expiryDate', 'status'].forEach((key) => { if (patch[key] != null) clean[key] = String(patch[key]).trim(); });
  const batchNumber = clean.batchNumber != null ? clean.batchNumber : String(current.batchNumber || '').trim();
  const manufactureDate = clean.manufactureDate != null ? clean.manufactureDate : String(current.manufactureDate || '').trim();
  const expiryDate = clean.expiryDate != null ? clean.expiryDate : String(current.expiryDate || '').trim();
  if (!batchNumber) throw new Error('Batch number cannot be blank.');
  if (manufactureDate && Number.isNaN(new Date(manufactureDate).getTime())) throw new Error('Manufacture date must be valid.');
  if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) throw new Error('Expiry date must be valid.');
  if (manufactureDate && expiryDate && new Date(expiryDate) < new Date(manufactureDate)) throw new Error('Expiry date cannot be before manufacture date.');
  await updateDoc(ref, clean);
}

export async function adminDeleteBatch(batchId) {
  await deleteDoc(doc(db, 'batches', batchId));
}

export async function adminCreateRecall({ manufacturerId, productId, productName = '', batchNumber = '', reason, recommendation = '', active = true }) {
  if (!manufacturerId || !productId) throw new Error('Choose a registered product.');
  if (!String(reason || '').trim()) throw new Error('Recall reason is required.');
  return addDoc(collection(db, 'recalls'), {
    manufacturerId, productId, productName: String(productName || '').trim(),
    batchNumber: String(batchNumber || '').trim(), reason: String(reason).trim(),
    recommendation: String(recommendation || '').trim(), active: !!active,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}

export async function adminUpdateRecall(recallId, patch) {
  const ref = doc(db, 'recalls', recallId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Recall not found.');
  const current = snapshot.data() || {};
  const clean = { updatedAt: serverTimestamp() };
  ['batchNumber', 'reason', 'recommendation'].forEach((key) => { if (patch[key] != null) clean[key] = String(patch[key]).trim(); });
  if (patch.active != null) clean.active = !!patch.active;
  const reason = clean.reason != null ? clean.reason : String(current.reason || '').trim();
  if (!reason) throw new Error('Recall reason cannot be blank.');
  await updateDoc(ref, clean);
}

export async function adminDeleteRecall(recallId) {
  await deleteDoc(doc(db, 'recalls', recallId));
}

export async function adminCreateSerial({ manufacturerId, productId, serialNumber, status = 'active' }) {
  const serial = String(serialNumber || '').trim();
  if (!manufacturerId || !productId || !serial) throw new Error('Manufacturer, product and serial number are required.');
  const ref = doc(db, 'serials', serial);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('This serial number is already registered.');
  await setDoc(ref, {
    manufacturerId, productId, serialNumber: serial, status,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return serial;
}

export async function adminUpdateSerial(serialId, patch) {
  const clean = { updatedAt: serverTimestamp() };
  if (patch.status != null) clean.status = String(patch.status).trim();
  if (patch.productId != null) clean.productId = String(patch.productId);
  if (patch.manufacturerId != null) clean.manufacturerId = String(patch.manufacturerId);
  await updateDoc(doc(db, 'serials', serialId), clean);
}

export async function adminDeleteSerial(serialId) {
  await deleteDoc(doc(db, 'serials', serialId));
}

export async function adminDeleteReport(reportId) {
  const batch = writeBatch(db);
  // Remove the report's photo records too so nothing is left behind.
  try {
    const photos = await getDocs(collection(db, 'reports', reportId, 'evidence'));
    photos.docs.forEach((photo) => batch.delete(photo.ref));
  } catch (_) {}
  try {
    const privateRecords = await getDocs(collection(db, 'reports', reportId, 'private'));
    privateRecords.docs.forEach((record) => batch.delete(record.ref));
  } catch (_) {}
  batch.delete(doc(db, 'reports', reportId));
  batch.delete(doc(db, 'investigations', reportId));
  batch.delete(doc(db, 'publicReports', reportId));
  await batch.commit();
}

export async function adminCreateInvestigation({ productId = '', productName = '', barcode = '', manufacturerId = '', reason, priority = 'normal', details = '' }) {
  if (!String(reason || '').trim()) throw new Error('Investigation reason is required.');
  const investigationRef = doc(collection(db, 'investigations'));
  const id = investigationRef.id;
  const reportRef = doc(db, 'reports', id);
  const batch = writeBatch(db);
  batch.set(reportRef, {
    reportId: id, source: 'admin', reporterId: '', productId, productName, barcode, manufacturerId,
    reason: String(reason).trim(), details: String(details || '').trim(), store: '', area: '',
    latitude: null, longitude: null, evidenceUrls: [], status: 'new',
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.set(investigationRef, {
    reportId: id, source: 'admin', reporterId: '', productId, productName, barcode, manufacturerId,
    reason: String(reason).trim(), area: '', status: 'new', priority,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return id;
}

export async function adminDeleteInvestigation(investigationId) {
  await deleteDoc(doc(db, 'investigations', investigationId));
}

export async function adminUpdateUser(uid, patch, profileDocId = uid) {
  if (!uid) throw new Error('User ID is required.');

  const sourceId = String(profileDocId || uid);
  let sourceRef = doc(db, 'users', sourceId);
  let snapshot = await getDoc(sourceRef);
  if (!snapshot.exists() && sourceId !== uid) {
    sourceRef = doc(db, 'users', uid);
    snapshot = await getDoc(sourceRef);
  }
  if (!snapshot.exists()) throw new Error('User profile was not found.');

  const current = snapshot.data() || {};
  const nextRole = patch.role != null ? String(patch.role).trim().toLowerCase() : (current.role || 'customer');
  const nextStatus = patch.accountStatus != null ? String(patch.accountStatus).trim().toLowerCase() : (current.accountStatus || 'active');
  const nextName = patch.fullName != null ? String(patch.fullName).trim() : String(current.fullName || current.name || '').trim();
  const nextOrganisation = patch.organizationName != null
    ? String(patch.organizationName || '').trim()
    : String(current.organizationName || '').trim();

  if (!['customer', 'manufacturer', 'admin'].includes(nextRole)) throw new Error('Invalid role.');
  if (!['active', 'disabled', 'deleted'].includes(nextStatus)) throw new Error('Invalid account status.');
  if (!nextName) throw new Error('Full name cannot be blank.');
  if (nextRole === 'manufacturer' && !nextOrganisation) throw new Error('Organisation name is required for a manufacturer.');

  // Changing another person's Firebase Authentication email requires the Admin SDK.
  // Keep the Auth email and Firestore email aligned instead of pretending the change succeeded.
  if (patch.email != null && normalizeEmail(patch.email) !== normalizeEmail(current.email)) {
    throw new Error('Email changes are not available from this screen. Send a password reset link or update the login email from the Firebase console.');
  }

  if (uid === auth.currentUser?.uid && (nextRole !== 'admin' || nextStatus !== 'active')) {
    throw new Error('You cannot remove your own administrator access or disable your own account here.');
  }

  if (current.role === 'admin' && (nextRole !== 'admin' || nextStatus !== 'active')) {
    const admins = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    const otherActiveAdmins = admins.docs.filter((item) => {
      const data = item.data() || {};
      const itemUid = data.uid || item.id;
      return itemUid !== uid && (data.accountStatus || 'active') === 'active';
    });
    if (!otherActiveAdmins.length) throw new Error('At least one active administrator must remain.');
  }

  const clean = {
    uid,
    fullName: nextName,
    role: nextRole,
    organizationName: nextRole === 'manufacturer' ? nextOrganisation : '',
    accountStatus: nextStatus,
    updatedAt: serverTimestamp(),
  };

  // Canonical profile documents are always users/{Firebase Auth UID}. Older
  // builds occasionally produced profiles under another document id. When an
  // admin edits one of those accounts, copy it to the canonical path so login
  // and rules work consistently from then on.
  const canonicalRef = doc(db, 'users', uid);
  if (sourceRef.id !== uid) {
    const batch = writeBatch(db);
    batch.set(canonicalRef, { ...current, ...clean }, { merge: true });
    batch.set(sourceRef, { migratedTo: uid, legacyProfile: true, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  } else {
    await updateDoc(canonicalRef, clean);
  }

  return { uid, email: current.email || '', role: nextRole, accountStatus: nextStatus };
}

export async function adminDisableUser(uid, profileDocId = uid) {
  return adminUpdateUser(uid, { accountStatus: 'disabled' }, profileDocId);
}

export async function adminEnableUser(uid, profileDocId = uid) {
  return adminUpdateUser(uid, { accountStatus: 'active' }, profileDocId);
}

export async function adminDeleteUser(uid, profileDocId = uid) {
  if (!uid) throw new Error('User ID is required.');
  if (uid === auth.currentUser?.uid) throw new Error('Manage your own administrator account from Settings.');

  // If the trusted Admin SDK function exists, use it for a true Auth + data
  // deletion. Spark deployments do not have that function, so fall back to a
  // soft removal that immediately blocks Product Trust access and hides the
  // account from the active user lists.
  try {
    const result = await callAdminDeleteUser({ uid });
    return { ...(result.data || {}), method: 'server' };
  } catch (error) {
    const unavailable = ['functions/not-found', 'functions/unavailable', 'functions/internal'].includes(error?.code)
      || /not[- ]found|NOT_FOUND/i.test(String(error?.message || ''));
    if (!unavailable) throw error;
  }

  const result = await adminUpdateUser(uid, { accountStatus: 'deleted' }, profileDocId);
  return { ...result, method: 'access-removed' };
}

function temporaryPassword() {
  return `Pt!${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}Aa9`;
}

export async function adminCreateUser({ fullName, email, role = 'customer', organizationName = '' }) {
  const cleanEmail = normalizeEmail(email);
  const cleanName = String(fullName || '').trim();
  const cleanRole = String(role || 'customer').trim().toLowerCase();
  const cleanOrganisation = String(organizationName || '').trim();
  if (!cleanName) throw new Error('Full name is required.');
  if (!isValidEmail(cleanEmail)) throw new Error('Enter a valid email address.');
  if (!['customer', 'manufacturer', 'admin'].includes(cleanRole)) throw new Error('Invalid role.');
  if (cleanRole === 'manufacturer' && !cleanOrganisation) throw new Error('Organisation name is required for a manufacturer.');

  // Use a secondary Firebase app so creating another Auth user never replaces
  // the administrator's own signed-in session. This works on the Spark plan.
  const secondaryApp = initializeApp(firebaseConfig, `pt-admin-create-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser = null;
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, temporaryPassword());
    createdUser = credential.user;
    await updateSecondaryProfile(createdUser, { displayName: cleanName });

    try {
      await setDoc(doc(db, 'users', createdUser.uid), {
        uid: createdUser.uid,
        fullName: cleanName,
        email: cleanEmail,
        role: cleanRole,
        organizationName: cleanRole === 'manufacturer' ? cleanOrganisation : '',
        accountStatus: 'active',
        allergens: [],
        customAllergens: [],
        dietaryPreferences: [],
        noKnownAllergies: false,
        allergyProfileComplete: cleanRole !== 'customer',
        notificationsEnabled: true,
        locationEnabled: false,
        createdByAdmin: true,
        requiresPasswordSetup: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      try { await deleteSecondaryUser(createdUser); } catch (_) {}
      throw error;
    }

    let setupEmailSent = false;
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setupEmailSent = true;
    } catch (_) {}

    return { uid: createdUser.uid, email: cleanEmail, setupEmailSent, method: 'spark' };
  } finally {
    try { await signOutSecondary(secondaryAuth); } catch (_) {}
    try { await deleteApp(secondaryApp); } catch (_) {}
  }
}

export async function adminSendPasswordReset(email) {
  const cleanEmail = normalizeEmail(email);
  if (!isValidEmail(cleanEmail)) throw new Error('This account does not have a valid email address.');
  await sendPasswordResetEmail(auth, cleanEmail);
  return cleanEmail;
}
