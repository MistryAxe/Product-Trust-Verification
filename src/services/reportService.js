import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { USE_FIREBASE_STORAGE, prepareImages } from './storageService';
import { withDeadline } from '../utils/netFetch';

function publicCoordinate(value) {
  if (typeof value !== 'number') return null;
  return Math.round(value * 100) / 100;
}

// A new report id, made on the phone (no network needed). The report form keeps the SAME id for every
// attempt, so pressing Submit again after a slow connection can never create a second copy of the report.
export function newReportId() {
  return doc(collection(db, 'reports')).id;
}

export async function submitProductReport({
  uid,
  product,
  reason,
  details,
  store,
  area,
  location,
  evidenceUris,
  reportId: providedId,
  onProgress,
  commitTimeoutMs = 40000,
}) {
  const reportRef = providedId ? doc(db, 'reports', providedId) : doc(collection(db, 'reports'));
  const reportId = reportRef.id;
  if (typeof onProgress === 'function' && (evidenceUris || []).length) onProgress('Preparing your photos…');

  // Photos are prepared first (shrunk, or uploaded when Storage is enabled).
  // A photo that fails never blocks the report from being saved.
  const evidence = await prepareImages(evidenceUris || [], `report-evidence/${uid}/${reportId}`);
  const evidenceCount = evidence.urls.length + evidence.images.length;
  if (typeof onProgress === 'function') onProgress('Sending your report…');

  const investigationRef = doc(db, 'investigations', reportId);
  const publicRef = doc(db, 'publicReports', reportId);
  const batch = writeBatch(db);

  const productId = product?.id || '';
  const productName = product?.name || 'Unregistered product';
  const barcode = product?.barcode || '';
  const manufacturerId = product?.manufacturerId || '';
  const manufacturerName = product?.manufacturerName || product?.brand || '';
  const onMap = location?.latitude != null && location?.longitude != null;

  batch.set(reportRef, {
    reportId,
    reporterId: uid,
    productId,
    productName,
    barcode,
    manufacturerId,
    manufacturerName,
    reason: reason.trim(),
    details: details.trim(),
    store: store.trim(),
    area: area.trim(),
    // The exact position is NOT stored here (manufacturers can read this record).
    // It goes to a private record that only the reporter and an admin can read.
    onMap,
    evidenceUrls: evidence.urls,
    evidenceCount,
    evidenceStorage: USE_FIREBASE_STORAGE ? 'storage' : 'firestore',
    evidenceUploadFailed: evidence.failed > 0,
    evidenceFailedCount: evidence.failed,
    status: 'new',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Each compressed photo is its own small document under the report.
  evidence.images.forEach((image, index) => {
    // Fixed ids (photo-1, photo-2...) so a repeated attempt overwrites instead of adding duplicates.
    batch.set(doc(db, 'reports', reportId, 'evidence', `photo-${index + 1}`), {
      reportId,
      reporterId: uid,
      index,
      dataUri: image.dataUri,
      width: image.width,
      height: image.height,
      createdAt: serverTimestamp(),
    });
  });

  if (onMap) {
    batch.set(doc(db, 'reports', reportId, 'private', 'location'), {
      reportId,
      reporterId: uid,
      latitude: location.latitude,
      longitude: location.longitude,
      createdAt: serverTimestamp(),
    });
  }

  batch.set(investigationRef, {
    reportId,
    reporterId: uid,
    productId,
    productName,
    barcode,
    manufacturerId,
    manufacturerName,
    reason: reason.trim(),
    area: area.trim(),
    evidenceCount,
    onMap,
    status: 'new',
    priority: 'normal',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (onMap) {
    batch.set(publicRef, {
      reportId,
      productId,
      productName,
      barcode,
      manufacturerId,
      manufacturerName,
      area: area.trim(),
      status: 'new',
      latitude: publicCoordinate(location.latitude),
      longitude: publicCoordinate(location.longitude),
      createdAt: serverTimestamp(),
    });
  }

  const result = {
    reportId,
    evidenceCount,
    evidenceFailed: evidence.failed,
    evidenceUploadFailed: evidence.failed > 0,
    onMap,
  };

  // Never wait forever: if the server cannot be reached, say so clearly. The write may still reach the server
  // later, and because the id is fixed, trying again is safe.
  let outcome;
  try {
    outcome = await withDeadline(batch.commit().then(() => 'sent'), commitTimeoutMs, () => 'timeout');
  } catch (error) {
    // The first attempt may have arrived after all. If the report is already there, that is a success.
    if (String(error?.code || '').includes('permission-denied')) {
      try {
        const existing = await getDoc(reportRef);
        if (existing.exists() && existing.data()?.reporterId === uid) return result;
      } catch (_) { /* fall through to the original error */ }
    }
    throw error;
  }
  if (outcome === 'timeout') {
    const error = new Error('We could not reach the server in time, so your report is not confirmed yet. Check your connection and press Submit again. It will not be sent twice.');
    error.code = 'app/timeout';
    throw error;
  }
  return result;
}

// The customer's exact position for a report. Only an admin (or the reporter) is allowed to read it.
export async function getReportPrivateLocation(reportId) {
  if (!reportId) return null;
  try {
    const snapshot = await getDoc(doc(db, 'reports', reportId, 'private', 'location'));
    const data = snapshot.exists() ? snapshot.data() : null;
    return data && typeof data.latitude === 'number' && typeof data.longitude === 'number'
      ? { latitude: data.latitude, longitude: data.longitude }
      : null;
  } catch (_) {
    return null;
  }
}

// Photos attached to a report (works for both storage modes and older reports).
export async function getReportEvidence(report) {
  const reportId = report?.reportId || report?.id;
  const items = [];
  (Array.isArray(report?.evidenceUrls) ? report.evidenceUrls : []).forEach((url, index) => {
    if (url) items.push({ id: `url-${index}`, uri: url });
  });
  if (reportId && Number(report?.evidenceCount || 0) > items.length) {
    const snapshot = await getDocs(collection(db, 'reports', reportId, 'evidence'));
    snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .forEach((d) => { if (d.dataUri) items.push({ id: d.id, uri: d.dataUri }); });
  }
  return items;
}

export function subscribeOwnReports(uid, callback, onError) {
  const q = query(collection(db, 'reports'), where('reporterId', '==', uid));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(data);
  }, onError);
}

export function subscribePublicReports(profile, callback, onError) {
  const role = profile?.role === 'consumer' ? 'customer' : profile?.role || 'customer';
  const source = role === 'manufacturer'
    ? query(collection(db, 'publicReports'), where('manufacturerId', '==', profile?.uid || ''))
    : collection(db, 'publicReports');
  return onSnapshot(source, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError);
}

export function subscribeInvestigations(profile, callback, onError) {
  const base = collection(db, 'investigations');
  const q = profile?.role === 'manufacturer'
    ? query(base, where('manufacturerId', '==', profile.uid))
    : query(base, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (profile?.role === 'manufacturer') {
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }
    callback(data);
  }, onError);
}

export async function getReport(reportId) {
  const snapshot = await getDoc(doc(db, 'reports', reportId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateInvestigationStatus(reportId, status) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'investigations', reportId), {
    status,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'reports', reportId), {
    status,
    updatedAt: serverTimestamp(),
  });
  const publicRef = doc(db, 'publicReports', reportId);
  const publicSnapshot = await getDoc(publicRef);
  if (publicSnapshot.exists()) {
    batch.update(publicRef, { status });
  }
  return batch.commit();
}

// ---- Two-way communication on a case -------------------------------------
// Admin writes an update that the customer who reported it can read.
export async function saveAdminNote(reportId, note) {
  const text = String(note || '').trim().slice(0, 2000);
  const patch = { adminNote: text, adminNoteAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, 'investigations', reportId), patch);
  batch.update(doc(db, 'reports', reportId), patch);
  return batch.commit();
}

// The manufacturer named on the case replies; admin and the reporter can read it.
export async function saveManufacturerResponse(reportId, response) {
  const text = String(response || '').trim().slice(0, 2000);
  const patch = { manufacturerResponse: text, manufacturerResponseAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, 'investigations', reportId), patch);
  batch.update(doc(db, 'reports', reportId), patch);
  return batch.commit();
}
