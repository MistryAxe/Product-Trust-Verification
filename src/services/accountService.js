import { getFunctions, httpsCallable } from 'firebase/functions';
import { EmailAuthProvider, deleteUser, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { app, auth, db } from '../config/firebase';

const functions = getFunctions(app);
const callDeleteMyAccount = httpsCallable(functions, 'deleteMyAccount');

function appError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function deleteDocs(refs) {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

// Used when the server function is not deployed (the free Firebase plan cannot run it).
// People remove their own data from the app, then their login. Nothing is touched
// until their password has been confirmed. Administrator accounts are removed by another
// administrator, never by themselves, so they are not handled here.
async function deleteAccountInApp({ password } = {}) {
  const user = auth.currentUser;
  if (!user) throw appError('app/not-signed-in', 'Please sign in again.');
  const uid = user.uid;

  const profileSnapshot = await getDoc(doc(db, 'users', uid));
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const role = profile.role === 'consumer' ? 'customer' : (profile.role || 'customer');
  if (role !== 'customer' && role !== 'manufacturer') {
    throw appError('app/not-supported', 'Administrator accounts are removed by another administrator. Please ask them to remove this account.');
  }

  // Confirm it is really them before anything is deleted.
  const usesPassword = (user.providerData || []).some((item) => item?.providerId === 'password');
  if (usesPassword) {
    if (!password) throw appError('app/password-required', 'Enter your password to confirm.');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }

  const counts = { reports: 0, scans: 0, records: 0, products: 0 };

  if (role === 'manufacturer') {
    // 1. Everything the company registered. Children first, then products, then the brand card.
    for (const name of ['batches', 'serials', 'recalls']) {
      const rows = await getDocs(query(collection(db, name), where('manufacturerId', '==', uid)));
      await deleteDocs(rows.docs.map((item) => item.ref));
      counts.records += rows.docs.length;
    }
    const products = await getDocs(query(collection(db, 'products'), where('manufacturerId', '==', uid)));
    await deleteDocs(products.docs.map((item) => item.ref));
    counts.products = products.docs.length;
    await deleteDocs([doc(db, 'manufacturerBrands', uid)]).catch(() => {}); // the brand card may not exist

    // 2. Reports about its products stay (they are safety records), but no longer point to this company.
    const detachCompany = { manufacturerId: '', manufacturerDeleted: true, updatedAt: serverTimestamp() };
    for (const name of ['reports', 'investigations']) {
      const rows = await getDocs(query(collection(db, name), where('manufacturerId', '==', uid)));
      for (const row of rows.docs) {
        await updateDoc(row.ref, detachCompany);
        if (name === 'reports') counts.reports += 1;
      }
    }
  } else {
    // Customer: reports they sent. Delete the photos and exact location first (they are found through
    // the reporter id), then detach the reporter's identity. The report text stays so the safety record is not lost.
    const reports = await getDocs(query(collection(db, 'reports'), where('reporterId', '==', uid)));
    for (const report of reports.docs) {
      const photos = await getDocs(collection(db, 'reports', report.id, 'evidence'));
      await deleteDocs(photos.docs.map((item) => item.ref));
      const exact = await getDocs(collection(db, 'reports', report.id, 'private'));
      await deleteDocs(exact.docs.map((item) => item.ref));
      const detach = { reporterId: '', reporterDeleted: true, evidenceCount: 0, evidenceUrls: [], evidenceRemoved: true, updatedAt: serverTimestamp() };
      await updateDoc(report.ref, detach);
      try { await updateDoc(doc(db, 'investigations', report.id), detach); } catch (_) { /* no linked case */ }
      counts.reports += 1;
    }

    // Scan history recorded for the platform.
    const scanEvents = await getDocs(query(collection(db, 'scanEvents'), where('scannerId', '==', uid)));
    await deleteDocs(scanEvents.docs.map((item) => item.ref));
    counts.scans = scanEvents.size ?? scanEvents.docs.length;

    // The customer's own saved items.
    for (const name of ['scans', 'savedProducts', 'ingredientScans']) {
      const records = await getDocs(collection(db, 'users', uid, name));
      await deleteDocs(records.docs.map((item) => item.ref));
      counts.records += records.docs.length;
    }
  }

  // The profile itself, then finally the login (last, because nothing can be deleted once signed out).
  await deleteDocs([doc(db, 'users', uid)]);
  try {
    await deleteUser(user);
  } catch (error) {
    if (String(error?.code || '').includes('requires-recent-login')) {
      throw appError('app/sign-in-again', 'Your data was removed. To finish, sign out, sign in again and press Delete My Account once more.');
    }
    throw error;
  }
  try { await signOut(auth); } catch (_) { /* already signed out */ }
  return { uid, role, ...counts, method: 'app' };
}

const functionUnavailable = (error) => ['functions/not-found', 'functions/internal', 'functions/unavailable'].includes(error?.code)
  || /not[- ]found|NOT_FOUND/i.test(String(error?.message || ''));

export async function deleteMyAccountPermanently({ password } = {}) {
  try {
    const result = await callDeleteMyAccount({});
    try { await signOut(auth); } catch (_) {}
    return result.data;
  } catch (error) {
    if (!functionUnavailable(error)) throw error;
  }
  return deleteAccountInApp({ password });
}
