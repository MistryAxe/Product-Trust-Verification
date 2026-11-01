import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';


function isValidGtin(barcode) {
  const digits = String(barcode || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1).split('').map(Number).reverse();
  const sum = body.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return ((10 - (sum % 10)) % 10) === Number(digits.at(-1));
}

export async function getProductByBarcode(barcode) {
  const value = String(barcode || '').trim();
  if (!value) return null;

  const q = query(collection(db, 'products'), where('barcode', '==', value), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const productDoc = snapshot.docs[0];
  return { id: productDoc.id, ...productDoc.data() };
}

export async function getProduct(productId) {
  const snapshot = await getDoc(doc(db, 'products', productId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function searchProducts(searchText) {
  const search = String(searchText || '').trim().toLowerCase();
  if (!search) return [];
  const snapshot = await getDocs(query(collection(db, 'products'), where('active', '==', true), limit(100)));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => {
      const haystack = [p.name, p.brand, p.barcode, p.manufacturerName, p.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    })
    .slice(0, 30);
}

export async function getActiveProducts(max = 100) {
  const snapshot = await getDocs(query(collection(db, 'products'), where('active', '==', true), limit(max)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeManufacturerProducts(manufacturerId, callback, onError) {
  const q = query(collection(db, 'products'), where('manufacturerId', '==', manufacturerId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError);
}


export function subscribeManufacturerBatches(manufacturerId, callback, onError) {
  const q = query(collection(db, 'batches'), where('manufacturerId', '==', manufacturerId));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(rows);
  }, onError);
}

export function subscribeManufacturerSerials(manufacturerId, callback, onError) {
  const q = query(collection(db, 'serials'), where('manufacturerId', '==', manufacturerId));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(rows);
  }, onError);
}

async function assertManufacturerOwnership(collectionName, id, manufacturerId) {
  const ref = doc(db, collectionName, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Record not found.');
  if (snapshot.data().manufacturerId !== manufacturerId) throw new Error('This record does not belong to your manufacturer account.');
  return { ref, data: snapshot.data() };
}

export async function updateManufacturerProduct(manufacturerId, productId, patch) {
  const { ref, data } = await assertManufacturerOwnership('products', productId, manufacturerId);
  const nextName = patch.name != null ? String(patch.name).trim() : String(data.name || '').trim();
  if (!nextName) throw new Error('Product name cannot be blank.');
  const clean = { updatedAt: serverTimestamp() };
  ['name','brand','category','productClass','equipmentType','country','netContent','description','model','partNumber','sku','warranty','ratedVoltage','ratedCurrent','ratedPower','frequency','ipRating','certificationMarks'].forEach((key) => {
    if (patch[key] != null) clean[key] = String(patch[key]).trim();
  });
  if (patch.active != null) clean.active = !!patch.active;
  await updateDoc(ref, clean);
}

export async function deleteManufacturerProduct(manufacturerId, productId) {
  await assertManufacturerOwnership('products', productId, manufacturerId);
  for (const name of ['batches', 'recalls', 'serials']) {
    const snapshot = await getDocs(query(collection(db, name), where('productId', '==', productId)));
    for (let i = 0; i < snapshot.docs.length; i += 400) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'products', productId));
}

export async function updateManufacturerBatch(manufacturerId, batchId, patch) {
  const { ref, data } = await assertManufacturerOwnership('batches', batchId, manufacturerId);
  const batchNumber = patch.batchNumber != null ? String(patch.batchNumber).trim() : String(data.batchNumber || '').trim();
  const manufactureDate = patch.manufactureDate != null ? String(patch.manufactureDate).trim() : String(data.manufactureDate || '').trim();
  const expiryDate = patch.expiryDate != null ? String(patch.expiryDate).trim() : String(data.expiryDate || '').trim();
  const status = patch.status != null ? String(patch.status).trim() : String(data.status || 'active').trim();
  if (!batchNumber) throw new Error('Batch number cannot be blank.');
  if (manufactureDate && Number.isNaN(new Date(manufactureDate).getTime())) throw new Error('Manufacture date must be valid.');
  if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) throw new Error('Expiry date must be valid.');
  if (manufactureDate && expiryDate && new Date(expiryDate) < new Date(manufactureDate)) throw new Error('Expiry date cannot be before manufacture date.');
  await updateDoc(ref, { batchNumber, manufactureDate, expiryDate, status, updatedAt: serverTimestamp() });
}

export async function deleteManufacturerBatch(manufacturerId, batchId) {
  const { ref } = await assertManufacturerOwnership('batches', batchId, manufacturerId);
  await deleteDoc(ref);
}

export async function updateManufacturerRecall(manufacturerId, recallId, patch) {
  const { ref, data } = await assertManufacturerOwnership('recalls', recallId, manufacturerId);
  const reason = patch.reason != null ? String(patch.reason).trim() : String(data.reason || '').trim();
  if (!reason) throw new Error('Recall reason cannot be blank.');
  await updateDoc(ref, {
    batchNumber: patch.batchNumber != null ? String(patch.batchNumber).trim() : String(data.batchNumber || '').trim(),
    reason,
    recommendation: patch.recommendation != null ? String(patch.recommendation).trim() : String(data.recommendation || '').trim(),
    active: patch.active != null ? !!patch.active : data.active !== false,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteManufacturerRecall(manufacturerId, recallId) {
  const { ref } = await assertManufacturerOwnership('recalls', recallId, manufacturerId);
  await deleteDoc(ref);
}

export async function updateManufacturerSerial(manufacturerId, serialId, patch) {
  const { ref } = await assertManufacturerOwnership('serials', serialId, manufacturerId);
  await updateDoc(ref, { status: String(patch.status || 'active').trim(), updatedAt: serverTimestamp() });
}

export async function deleteManufacturerSerial(manufacturerId, serialId) {
  const { ref } = await assertManufacturerOwnership('serials', serialId, manufacturerId);
  await deleteDoc(ref);
}
export async function setManufacturerProductActive(manufacturerId, productId, active) {
  const ref = doc(db, 'products', productId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Product not found.');
  if (snapshot.data().manufacturerId !== manufacturerId) throw new Error('This product does not belong to your manufacturer account.');
  await updateDoc(ref, { active: !!active, updatedAt: serverTimestamp() });
}

export function subscribeManufacturerRecalls(manufacturerId, callback, onError) {
  const q = query(collection(db, 'recalls'), where('manufacturerId', '==', manufacturerId));
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    callback(rows);
  }, onError);
}

export async function setRecallActive(manufacturerId, recallId, active) {
  const ref = doc(db, 'recalls', recallId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Recall not found.');
  if (snapshot.data().manufacturerId !== manufacturerId) throw new Error('This recall does not belong to your manufacturer account.');
  await updateDoc(ref, { active: !!active, updatedAt: serverTimestamp() });
}

export async function createManufacturerProduct(manufacturerId, manufacturerName, data) {
  const barcode = String(data.barcode || '').replace(/\D/g, '').trim();
  if (!isValidGtin(barcode)) throw new Error('Enter a valid GTIN / EAN / UPC barcode with a correct check digit.');
  const existing = await getProductByBarcode(barcode);
  if (existing) throw new Error('A product with this barcode already exists.');

  const productRef = await addDoc(collection(db, 'products'), {
    manufacturerId,
    manufacturerName: manufacturerName || '',
    name: String(data.name ?? '').trim(),
    brand: String(data.brand ?? '').trim(),
    barcode,
    category: String(data.category ?? '').trim(),
    productClass: String(data.productClass || 'general').trim(),
    equipmentType: String(data.equipmentType || '').trim(),
    country: String(data.country ?? '').trim(),
    marketCountries: String(data.marketCountries || '').trim(),
    manufacturingPlaces: String(data.manufacturingPlaces || '').trim(),
    origins: String(data.origins || '').trim(),
    authorisedRetailers: String(data.authorisedRetailers || '').trim(),
    traceabilityCode: String(data.traceabilityCode || '').trim(),
    netContent: String(data.netContent ?? '').trim(),
    servingSize: String(data.servingSize || '').trim(),
    description: String(data.description || '').trim(),
    model: String(data.model || '').trim(),
    partNumber: String(data.partNumber || '').trim(),
    sku: String(data.sku || '').trim(),
    color: String(data.color || '').trim(),
    size: String(data.size || '').trim(),
    dimensions: String(data.dimensions || '').trim(),
    weight: String(data.weight || '').trim(),
    material: String(data.material || '').trim(),
    warranty: String(data.warranty || '').trim(),
    ratedVoltage: String(data.ratedVoltage || '').trim(),
    ratedCurrent: String(data.ratedCurrent || '').trim(),
    ratedPower: String(data.ratedPower || '').trim(),
    frequency: String(data.frequency || '').trim(),
    phase: String(data.phase || '').trim(),
    speedRpm: String(data.speedRpm || '').trim(),
    pressureRating: String(data.pressureRating || '').trim(),
    capacity: String(data.capacity || '').trim(),
    ipRating: String(data.ipRating || '').trim(),
    certificationMarks: String(data.certificationMarks || '').trim(),
    officialWebsite: String(data.officialWebsite || '').trim(),
    officialProductUrl: String(data.officialProductUrl || '').trim(),
    packagingDescription: String(data.packagingDescription || '').trim(),
    securityFeatures: String(data.securityFeatures || '').trim(),
    ingredientsText: String(data.ingredientsText ?? '').trim(),
    allergens: data.allergens || [],
    nutritionGrade: String(data.nutritionGrade || '').trim().toUpperCase(),
    ecoScore: String(data.ecoScore || '').trim().toUpperCase(),
    novaGroup: String(data.novaGroup || '').trim(),
    nutriments: {
      'energy-kcal_100g': String(data.energyKcal || '').trim(),
      'energy-kcal_unit': 'kcal',
      fat_100g: String(data.fat || '').trim(), fat_unit: 'g',
      'saturated-fat_100g': String(data.saturatedFat || '').trim(), 'saturated-fat_unit': 'g',
      carbohydrates_100g: String(data.carbohydrates || '').trim(), carbohydrates_unit: 'g',
      sugars_100g: String(data.sugars || '').trim(), sugars_unit: 'g',
      proteins_100g: String(data.protein || '').trim(), proteins_unit: 'g',
      fiber_100g: String(data.fiber || '').trim(), fiber_unit: 'g',
      salt_100g: String(data.salt || '').trim(), salt_unit: 'g',
    },
    packagingReferenceUrl: data.packagingReferenceUrl || '',
    serialTrackingEnabled: !!data.serialTrackingEnabled,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const reviewRef = doc(db, 'gtinReviewRequests', barcode);
  try {
    await setDoc(reviewRef, {
      barcode,
      productName: String(data.name ?? '').trim(),
      brand: String(data.brand ?? '').trim(),
      sourceType: 'partner_manufacturer',
      status: 'pending',
      lastRequestedAt: serverTimestamp(),
    }, { merge: true });
  } catch (_) {
  }

  return productRef;
}

export async function createBatch(manufacturerId, data) {
  const batchNumber = String(data.batchNumber || '').trim();
  if (!batchNumber) throw new Error('Batch number is required.');
  const existing = await getDocs(query(
    collection(db, 'batches'),
    where('productId', '==', data.productId),
    where('batchNumber', '==', batchNumber),
    limit(1),
  ));
  if (!existing.empty) throw new Error('This batch number is already registered for the selected product.');

  const manufactureDate = String(data.manufactureDate || '').trim();
  const expiryDate = String(data.expiryDate || '').trim();
  if (manufactureDate && Number.isNaN(new Date(manufactureDate).getTime())) throw new Error('Manufacture date must be a valid date.');
  if (expiryDate && Number.isNaN(new Date(expiryDate).getTime())) throw new Error('Expiry date must be a valid date.');
  if (manufactureDate && expiryDate && new Date(expiryDate) < new Date(manufactureDate)) throw new Error('Expiry date cannot be before manufacture date.');

  return addDoc(collection(db, 'batches'), {
    manufacturerId,
    productId: data.productId,
    batchNumber,
    manufactureDate,
    expiryDate,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createRecall(manufacturerId, data) {
  return addDoc(collection(db, 'recalls'), {
    manufacturerId,
    productId: data.productId,
    productName: String(data.productName || '').trim(),
    batchNumber: String(data.batchNumber ?? '').trim(),
    reason: String(data.reason ?? '').trim(),
    recommendation: String(data.recommendation ?? '').trim(),
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}


export async function createSerial(manufacturerId, data) {
  const serialNumber = String(data.serialNumber || '').trim();
  if (!serialNumber) throw new Error('Serial number is required.');
  const serialRef = doc(db, 'serials', serialNumber);
  const existing = await getDoc(serialRef);
  if (existing.exists()) throw new Error('This serial number is already registered.');
  await setDoc(serialRef, {
    manufacturerId,
    productId: data.productId,
    serialNumber,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return serialNumber;
}

export async function getBatch(productId, batchNumber) {
  const batch = String(batchNumber || '').trim();
  if (!batch) return null;
  const q = query(
    collection(db, 'batches'),
    where('productId', '==', productId),
    where('batchNumber', '==', batch),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function getActiveRecall(productId, batchNumber = '') {
  const snapshot = await getDocs(query(
    collection(db, 'recalls'),
    where('productId', '==', productId),
    where('active', '==', true),
    limit(20),
  ));
  const recalls = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  const batch = String(batchNumber || '').trim();
  if (batch) return recalls.find((r) => !r.batchNumber || r.batchNumber === batch) || null;
  return recalls.find((r) => !r.batchNumber) || null;
}

export async function getSerial(productId, serialNumber) {
  const serial = String(serialNumber || '').trim();
  if (!serial) return null;
  const snapshot = await getDoc(doc(db, 'serials', serial));
  if (!snapshot.exists()) return null;
  const data = { id: snapshot.id, ...snapshot.data() };
  return data.productId === productId ? data : null;
}

function isExpired(expiryDate) {
  if (!expiryDate) return null;
  const date = new Date(expiryDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime() < Date.now();
}

export async function verifyProduct(product, {
  batchNumber = '',
  serialNumber = '',
  printedExpiry = '',
  externalEvidence = null,
  packagingEvidence = null,
  gs1Verification = null,
} = {}) {
  const requestedBatch = String(batchNumber || '').trim();
  const requestedSerial = String(serialNumber || '').trim();
  const requestedExpiry = String(printedExpiry || '').trim();
  const batch = requestedBatch ? await getBatch(product.id, requestedBatch) : null;
  const recall = await getActiveRecall(product.id, requestedBatch);
  const serial = product.serialTrackingEnabled && requestedSerial
    ? await getSerial(product.id, requestedSerial)
    : null;

  const expiryState = batch ? isExpired(batch.expiryDate) : null;
  const normalizeDateToken = (value = '') => String(value || '')
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, '')
    .replace(/^20/, '');
  const printedExpiryComparable = requestedExpiry && batch?.expiryDate
    ? normalizeDateToken(requestedExpiry)
    : '';
  const storedExpiryComparable = requestedExpiry && batch?.expiryDate
    ? normalizeDateToken(batch.expiryDate)
    : '';
  const printedExpiryMatches = printedExpiryComparable && storedExpiryComparable
    ? (storedExpiryComparable.includes(printedExpiryComparable) || printedExpiryComparable.includes(storedExpiryComparable))
    : null;

  const externalStatus = !externalEvidence?.found
    ? 'not_checked'
    : externalEvidence.consistent === true
      ? 'passed'
      : externalEvidence.consistent === false
        ? 'failed'
        : 'not_checked';
  const packagingScore = Number(packagingEvidence?.similarityScore);
  const packagingStatus = !Number.isFinite(packagingScore)
    ? 'not_checked'
    : packagingScore >= 70
      ? 'passed'
      : 'failed';

  const gs1Status = !gs1Verification
    ? 'not_checked'
    : gs1Verification.status === 'verified'
      ? 'passed'
      : gs1Verification.status === 'mismatch'
        ? 'failed'
        : 'not_checked';

  const checks = [
    {
      key: 'barcode', label: 'Registered barcode', weight: 15,
      status: product.barcode ? 'passed' : 'failed',
      value: product.barcode ? 1 : 0,
      detail: product.barcode ? 'The scanned barcode resolves to this Firebase manufacturer product record.' : 'The product record has no barcode.',
    },
    {
      key: 'manufacturer', label: 'Manufacturer linkage', weight: 15,
      status: product.manufacturerId ? 'passed' : 'failed',
      value: product.manufacturerId ? 1 : 0,
      detail: product.manufacturerId ? 'The product is linked to a registered manufacturer account in Product Trust.' : 'No manufacturer account is linked to this product record.',
    },
    {
      key: 'gs1_ownership', label: 'Cached GS1 ownership evidence', weight: 10,
      status: gs1Status,
      value: gs1Status === 'passed' ? 1 : 0,
      detail: !gs1Verification
        ? 'No cached GS1 ownership evidence is available yet. This check is excluded from the score rather than treated as a failure.'
        : gs1Verification.status === 'verified'
          ? `Cached Verified by GS1 ownership evidence confirms the identifier${gs1Verification.licensedCompany ? ` for ${gs1Verification.licensedCompany}` : ''}.`
          : gs1Verification.status === 'mismatch'
            ? 'Cached GS1 ownership evidence contains an ownership or product identity mismatch.'
            : gs1Verification.status === 'not_found'
              ? 'No GS1 record was found during the manual review. This remains inconclusive rather than automatic proof of a counterfeit.'
              : 'The GS1 record needs further manual review.',
    },
    {
      key: 'external_identity', label: 'External identity cross-check', weight: 10,
      status: externalStatus,
      value: externalStatus === 'passed' ? 1 : 0,
      detail: !externalEvidence?.found
        ? 'No comparable external product identity record was available. This does not invalidate the manufacturer record.'
        : externalEvidence.detail || 'External identity evidence was checked.',
    },
    {
      key: 'batch', label: 'Batch verification', weight: 15,
      status: !requestedBatch ? 'not_checked' : batch ? 'passed' : 'failed',
      value: requestedBatch && batch ? 1 : 0,
      detail: !requestedBatch ? 'No batch number was supplied, so this check was not completed.' : batch ? 'The batch exists in the manufacturer records.' : 'The supplied batch was not found in the manufacturer records.',
    },
    {
      key: 'expiry', label: 'Registered expiry status', weight: 10,
      status: !batch || expiryState === null ? 'not_checked' : expiryState ? 'failed' : 'passed',
      value: batch && expiryState === false ? 1 : 0,
      detail: !batch ? 'A matching batch is required before expiry can be verified.' : expiryState === null ? 'The registered batch does not contain a valid expiry date.' : expiryState ? 'The registered batch is expired.' : 'The registered batch is within its expiry date.',
    },
    {
      key: 'printed_expiry', label: 'Printed expiry comparison', weight: 10,
      status: !requestedExpiry || !batch?.expiryDate ? 'not_checked' : printedExpiryMatches ? 'passed' : 'failed',
      value: requestedExpiry && printedExpiryMatches ? 1 : 0,
      detail: !requestedExpiry
        ? 'No expiry text was scanned or entered from the physical product.'
        : !batch?.expiryDate
          ? 'The manufacturer batch record has no expiry date to compare with the printed product.'
          : printedExpiryMatches
            ? 'The expiry read from the product is consistent with the registered batch expiry.'
            : `The product shows ${requestedExpiry}, while the registered batch expiry is ${batch.expiryDate}.`,
    },
    {
      key: 'recall', label: 'Recall check', weight: 10,
      status: recall ? 'failed' : 'passed',
      value: recall ? 0 : 1,
      detail: recall ? 'An active recall matches this product or supplied batch.' : requestedBatch ? 'No active Product Trust recall matched this product or supplied batch.' : 'No product-level active Product Trust recall was found. Batch-specific recalls require a batch number.',
    },
    {
      key: 'packaging', label: 'Packaging evidence comparison', weight: 10,
      status: packagingStatus,
      value: packagingStatus === 'passed' ? 1 : 0,
      detail: !product.packagingReferenceUrl
        ? 'The manufacturer has not supplied an official packaging reference image URL.'
        : !Number.isFinite(packagingScore)
          ? 'An official packaging reference exists, but no customer packaging evidence comparison was performed.'
          : `Free packaging evidence comparison returned ${Math.round(packagingScore)}%. It compares OCR text, product identity and declared security wording; it is supporting evidence, not standalone proof of authenticity.`,
    },
    {
      key: 'serial', label: 'Serial verification', weight: 5,
      status: !product.serialTrackingEnabled ? 'not_applicable' : !requestedSerial ? 'not_checked' : serial ? 'passed' : 'failed',
      value: requestedSerial && serial ? 1 : 0,
      detail: !product.serialTrackingEnabled ? 'This product does not use individual serial tracking.' : !requestedSerial ? 'Serial tracking is enabled, but no serial number was supplied.' : serial ? 'The serial is registered for this product.' : 'The supplied serial was not found for this product.',
    },
  ];

  const applicableChecks = checks.filter((item) => item.status !== 'not_applicable');
  const assessedChecks = applicableChecks.filter((item) => item.status !== 'not_checked');
  const applicableWeight = applicableChecks.reduce((sum, item) => sum + item.weight, 0);
  const assessedWeight = assessedChecks.reduce((sum, item) => sum + item.weight, 0);
  const earned = assessedChecks.reduce((sum, item) => sum + item.weight * item.value, 0);
  const score = assessedWeight ? Math.round((earned / assessedWeight) * 100) : 0;
  const coverage = applicableWeight ? Math.round((assessedWeight / applicableWeight) * 100) : 0;

  const criticalFailure = checks.some((item) => ['barcode', 'manufacturer', 'gs1_ownership', 'batch', 'expiry', 'printed_expiry', 'serial'].includes(item.key) && item.status === 'failed');
  const risk = recall || criticalFailure || score < 50
    ? 'high'
    : coverage < 50
      ? 'incomplete'
      : score < 70
        ? 'medium'
        : score < 90
          ? 'mostly_verified'
          : 'low';

  return {
    score,
    coverage,
    risk,
    checks,
    batch,
    recall,
    serial,
    batchNumber: requestedBatch,
    serialNumber: requestedSerial,
    printedExpiry: requestedExpiry,
    externalEvidence,
    packagingEvidence,
    gs1Verification,
  };
}

function compactExternalSnapshot(product = {}) {
  const keys = [
    'barcode', 'name', 'genericName', 'brand', 'category', 'productType', 'productClass', 'equipmentType', 'description',
    'model', 'partNumber', 'sku', 'serialNumber', 'color', 'size', 'dimensions', 'weight', 'material', 'warranty', 'netContent', 'servingSize', 'imageUrl',
    'nutritionImageUrl', 'ingredientsImageUrl', 'ingredientsText', 'allergens', 'traces',
    'additives', 'nutriments', 'nutritionGrade', 'ecoScore', 'countries',
    'manufacturingPlaces', 'origins', 'labels', 'novaGroup', 'packaging', 'stores',
    'purchasePlaces', 'traceabilityCode', 'sourceUrl', 'gtin', 'fieldSources',
    'nutrientSources', 'sourcesUsed', 'usdaMatch', 'dataCompletenessPercent',
    'identityConfidence', 'identityEvidenceCount', 'identityEvidenceSummary', 'structuredSourceCount', 'webEvidenceCount', 'webResearch', 'lookupStatus', 'identifierType', 'labelEvidence', 'labelFacts', 'labelUrls',
    'ratedVoltage', 'ratedCurrent', 'ratedPower', 'frequency', 'phase', 'speedRpm', 'pressureRating', 'capacity', 'ipRating', 'certificationMarks',
  ];
  const snapshot = {};
  keys.forEach((key) => {
    const value = product?.[key];
    if (value !== undefined) snapshot[key] = value;
  });
  return JSON.parse(JSON.stringify(snapshot));
}

export async function recordScanLookup(uid, {
  barcode = '',
  product = null,
  sourceType = 'external',
  sourceLabel = '',
  identityStatus = 'identified',
  identityLabel = 'Product identified',
  gs1Verification = null,
} = {}) {
  const scanRef = doc(collection(db, 'users', uid, 'scans'));
  const eventRef = doc(db, 'scanEvents', scanRef.id);
  const isExternal = sourceType === 'external';
  const normalizedBarcode = String(barcode || product?.barcode || '').replace(/\D/g, '').trim();
  const highRisk = identityStatus === 'high_risk' || identityStatus === 'invalid_gtin' || identityStatus === 'gs1_mismatch';

  const privatePayload = {
    scannerId: uid,
    productId: product?.id || '',
    productName: product?.name || (identityStatus === 'not_found' ? 'Unidentified product' : 'Product'),
    barcode: normalizedBarcode,
    category: product?.category || '',
    manufacturerId: product?.manufacturerId || '',
    manufacturerName: product?.manufacturerName || product?.brand || '',
    imageUrl: product?.imageUrl || '',
    sourceType,
    sourceLabel: sourceLabel || (sourceType === 'partner' ? 'Product Trust manufacturer record' : sourceType === 'external' ? 'Independent product sources' : 'Barcode scan'),
    identityStatus,
    identityLabel,
    verificationStage: 'identified',
    score: null,
    coverage: null,
    risk: highRisk ? 'high' : 'incomplete',
    batchNumber: '',
    serialNumber: '',
    hasRecall: false,
    gs1Status: gs1Verification?.status || 'not_cached',
    productSnapshot: product ? compactExternalSnapshot(product) : null,
    externalSnapshot: isExternal && product ? compactExternalSnapshot(product) : null,
    scannedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const eventPayload = {
    scannerId: uid,
    productId: privatePayload.productId,
    productName: privatePayload.productName,
    barcode: privatePayload.barcode,
    category: privatePayload.category,
    manufacturerId: privatePayload.manufacturerId,
    manufacturerName: privatePayload.manufacturerName,
    sourceType,
    identityStatus,
    verificationStage: 'identified',
    risk: privatePayload.risk,
    scannedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(scanRef, privatePayload);
  batch.set(eventRef, eventPayload);
  await batch.commit();
  return scanRef.id;
}

export async function updateExternalScanSnapshot(uid, scanId, product) {
  if (!uid || !scanId || !product) return;
  const scanRef = doc(db, 'users', uid, 'scans', scanId);
  const eventRef = doc(db, 'scanEvents', scanId);
  const payload = {
    productName: product.name || 'Product',
    barcode: product.barcode || '',
    category: product.category || '',
    manufacturerName: product.manufacturerName || product.brand || '',
    imageUrl: product.imageUrl || '',
    productSnapshot: compactExternalSnapshot(product),
    externalSnapshot: compactExternalSnapshot(product),
    updatedAt: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(scanRef, payload, { merge: true });
  batch.set(eventRef, {
    productName: payload.productName,
    barcode: payload.barcode,
    category: payload.category,
    manufacturerName: payload.manufacturerName,
    imageUrl: payload.imageUrl,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

export async function saveScan(uid, product, verification, existingScanId = '') {
  const scanRef = existingScanId
    ? doc(db, 'users', uid, 'scans', existingScanId)
    : doc(collection(db, 'users', uid, 'scans'));
  const eventRef = doc(db, 'scanEvents', scanRef.id);
  const payload = {
    scannerId: uid,
    productId: product.id || '',
    productName: product.name || '',
    barcode: product.barcode || '',
    category: product.category || '',
    manufacturerId: product.manufacturerId || '',
    manufacturerName: product.manufacturerName || '',
    imageUrl: product.imageUrl || '',
    sourceType: product.manufacturerId ? 'partner' : 'product',
    sourceLabel: product.manufacturerId ? 'Product Trust manufacturer record' : 'Product Trust product record',
    identityStatus: verification.risk === 'high' ? 'high_risk' : 'partner_match',
    identityLabel: verification.risk === 'high' ? 'Verification issue detected' : 'Manufacturer product matched',
    verificationStage: 'verified',
    score: verification.score,
    coverage: verification.coverage ?? 0,
    risk: verification.risk,
    batchNumber: verification.batchNumber || '',
    serialNumber: verification.serialNumber || '',
    hasRecall: !!verification.recall,
    gs1Status: verification.gs1Verification?.status || 'not_cached',
    productSnapshot: compactExternalSnapshot(product),
    verifiedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!existingScanId) payload.scannedAt = serverTimestamp();

  const batch = writeBatch(db);
  batch.set(scanRef, payload, { merge: true });
  batch.set(eventRef, payload, { merge: true });
  await batch.commit();
  return scanRef.id;
}

export function subscribeScanHistory(uid, callback, onError, max = 50) {
  const q = query(collection(db, 'users', uid, 'scans'), orderBy('scannedAt', 'desc'), limit(max));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export function subscribeSavedProducts(uid, callback, onError) {
  const q = query(collection(db, 'users', uid, 'savedProducts'), orderBy('savedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onError);
}

function savedProductKey(productOrId) {
  if (typeof productOrId === 'string') return productOrId.replaceAll('/', '_');
  const product = productOrId || {};
  if (product.id && !String(product.id).startsWith('external-')) return String(product.id).replaceAll('/', '_');
  if (product.barcode) return `barcode-${String(product.barcode).replace(/\D/g, '')}`;
  if (product.id) return String(product.id).replaceAll('/', '_');
  const fallback = `${product.brand || ''}-${product.name || 'product'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return fallback || `saved-${Date.now()}`;
}

export async function saveProduct(uid, product) {
  const key = savedProductKey(product);
  await setDoc(doc(db, 'users', uid, 'savedProducts', key), {
    savedKey: key,
    productId: product.id && !String(product.id).startsWith('external-') ? product.id : '',
    productName: product.name || '',
    barcode: product.barcode || '',
    category: product.category || '',
    manufacturerName: product.manufacturerName || product.brand || '',
    imageUrl: product.imageUrl || product.packagingReferenceUrl || '',
    sourceType: product.external ? 'external' : 'partner',
    productSnapshot: compactExternalSnapshot(product),
    savedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return key;
}

export async function removeSavedProduct(uid, productOrId) {
  const { deleteDoc } = await import('firebase/firestore');
  return deleteDoc(doc(db, 'users', uid, 'savedProducts', savedProductKey(productOrId)));
}

export async function isProductSaved(uid, productOrId) {
  const snapshot = await getDoc(doc(db, 'users', uid, 'savedProducts', savedProductKey(productOrId)));
  return snapshot.exists();
}

export async function getRecentScanProducts(uid, max = 60) {
  const [scanSnapshot, savedSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'users', uid, 'scans'), orderBy('scannedAt', 'desc'), limit(max))),
    getDocs(query(collection(db, 'users', uid, 'savedProducts'), orderBy('savedAt', 'desc'))),
  ]);
  const results = [];
  const seen = new Set();

  for (const item of scanSnapshot.docs) {
    const scan = { id: item.id, ...item.data() };
    let product = scan.productSnapshot || scan.externalSnapshot || null;
    if (!product && scan.productId) {
      try { product = await getProduct(scan.productId); } catch (_) {}
    }
    if (!product) {
      product = {
        id: scan.productId || `scan-${scan.id}`,
        name: scan.productName || 'Scanned product',
        barcode: scan.barcode || '',
        category: scan.category || '',
        manufacturerId: scan.manufacturerId || '',
        manufacturerName: scan.manufacturerName || '',
        imageUrl: scan.imageUrl || '',
      };
    }
    const key = product.barcode || product.id || scan.id;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      ...product,
      scanId: scan.id,
      scanStatus: scan.identityStatus || '',
      scanSourceLabel: scan.sourceLabel || '',
      scanVerificationStage: scan.verificationStage || '',
      scanVerificationScore: scan.score ?? null,
      scanCoverage: scan.coverage ?? null,
      scanRisk: scan.risk || '',
      scanHasRecall: scan.hasRecall === true ? true : scan.hasRecall === false ? false : null,
      scanGs1Status: scan.gs1Status || '',
    });
  }

  for (const item of savedSnapshot.docs) {
    const saved = { id: item.id, ...item.data() };
    let product = saved.productSnapshot || null;
    if (!product && saved.productId) {
      try { product = await getProduct(saved.productId); } catch (_) {}
    }
    if (!product) {
      product = {
        id: saved.productId || `saved-${saved.id}`,
        name: saved.productName || 'Saved product',
        barcode: saved.barcode || '',
        category: saved.category || '',
        manufacturerName: saved.manufacturerName || '',
        imageUrl: saved.imageUrl || '',
      };
    }
    const key = product.barcode || product.id || saved.id;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ ...product, savedId: saved.id, scanSourceLabel: saved.sourceType === 'external' ? 'Saved external product' : 'Saved Product Trust record' });
  }

  return results;
}
