import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

function multiSubscribe(specs, callback, onError) {
  const state = {};
  const emit = () => callback({ ...state });
  const unsubs = specs.map(({ key, ref, map = (snapshot) => snapshot.size }) =>
    onSnapshot(ref, (snapshot) => {
      state[key] = map(snapshot);
      emit();
    }, onError),
  );
  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}

export function subscribeAdminMetrics(callback, onError) {
  return multiSubscribe([
    {
      key: 'users',
      ref: collection(db, 'users'),
      map: (snapshot) => {
        const rows = snapshot.docs.map((d) => d.data());
        return {
          customers: rows.filter((u) => (u.role === 'customer' || u.role === 'consumer')).length,
          manufacturers: rows.filter((u) => u.role === 'manufacturer').length,
          admins: rows.filter((u) => u.role === 'admin').length,
        };
      },
    },
    { key: 'products', ref: collection(db, 'products') },
    {
      key: 'reports',
      ref: collection(db, 'reports'),
      map: (snapshot) => snapshot.docs.filter((d) => !['confirmed_issue', 'closed_authentic'].includes(d.data().status)).length,
    },
    { key: 'investigations', ref: collection(db, 'investigations') },
    {
      key: 'recalls',
      ref: collection(db, 'recalls'),
      map: (snapshot) => snapshot.docs.filter((d) => d.data().active === true).length,
    },
    { key: 'scans', ref: collection(db, 'scanEvents') },
    {
      key: 'gs1Reviews',
      ref: collection(db, 'gtinReviewRequests'),
      map: (snapshot) => snapshot.docs.filter((d) => d.data().status !== 'reviewed').length,
    },
  ], (state) => callback({
    customers: state.users?.customers || 0,
    manufacturers: state.users?.manufacturers || 0,
    admins: state.users?.admins || 0,
    products: state.products || 0,
    openReports: state.reports || 0,
    investigations: state.investigations || 0,
    activeRecalls: state.recalls || 0,
    scans: state.scans || 0,
    pendingGs1Reviews: state.gs1Reviews || 0,
  }), onError);
}

export function subscribeManufacturerMetrics(manufacturerId, callback, onError) {
  return multiSubscribe([
    { key: 'products', ref: query(collection(db, 'products'), where('manufacturerId', '==', manufacturerId)) },
    {
      key: 'batches',
      ref: query(collection(db, 'batches'), where('manufacturerId', '==', manufacturerId)),
      map: (snapshot) => snapshot.docs.filter((d) => d.data().status !== 'inactive').length,
    },
    {
      key: 'reports',
      ref: query(collection(db, 'reports'), where('manufacturerId', '==', manufacturerId)),
      map: (snapshot) => snapshot.docs.filter((d) => !['confirmed_issue', 'closed_authentic'].includes(d.data().status)).length,
    },
    {
      // Open cases about this manufacturer's products that it has not answered yet.
      key: 'awaiting',
      ref: query(collection(db, 'reports'), where('manufacturerId', '==', manufacturerId)),
      map: (snapshot) => snapshot.docs.filter((d) => {
        const row = d.data();
        return !['confirmed_issue', 'closed_authentic'].includes(row.status) && !String(row.manufacturerResponse || '').trim();
      }).length,
    },
    {
      key: 'recalls',
      ref: query(collection(db, 'recalls'), where('manufacturerId', '==', manufacturerId)),
      map: (snapshot) => snapshot.docs.filter((d) => d.data().active === true).length,
    },
    { key: 'scans', ref: query(collection(db, 'scanEvents'), where('manufacturerId', '==', manufacturerId)) },
  ], (state) => callback({
    products: state.products || 0,
    activeBatches: state.batches || 0,
    openReports: state.reports || 0,
    awaitingResponse: state.awaiting || 0,
    activeRecalls: state.recalls || 0,
    scans: state.scans || 0,
  }), onError);
}

export function subscribeAllProducts(callback, onError) {
  return onSnapshot(collection(db, 'products'), (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError);
}

export function subscribeManufacturers(callback, onError) {
  const q = query(collection(db, 'users'), where('role', '==', 'manufacturer'));
  return onSnapshot(q, (snapshot) => {
    const byUid = new Map();
    snapshot.docs.forEach((d) => {
      const data = d.data() || {};
      if (data.accountStatus === 'deleted' || data.legacyProfile === true) return;
      const uid = data.uid || d.id;
      const row = { id: d.id, uid, ...data };
      const existing = byUid.get(uid);
      if (!existing || d.id === uid) byUid.set(uid, row);
    });
    callback([...byUid.values()]);
  }, onError);
}
