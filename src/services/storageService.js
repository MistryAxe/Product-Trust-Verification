import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../config/firebase';
import { fetchWithTimeout, withDeadline } from '../utils/netFetch';

// Photos (report evidence, ingredient labels) need somewhere to live.
//
// Firebase Storage is not available on the free Spark plan, which is why photo
// uploads used to fail with "evidence image could not be uploaded". By default
// the app now shrinks each photo to a small JPEG and keeps it inside Firestore,
// next to the record it belongs to. That works on Spark with no extra setup.
//
// If the project is upgraded and Storage is enabled, set
// EXPO_PUBLIC_USE_FIREBASE_STORAGE=true and photos go to Storage instead.
export const USE_FIREBASE_STORAGE = String(process.env.EXPO_PUBLIC_USE_FIREBASE_STORAGE || '').toLowerCase() === 'true';

// A Firestore document may not exceed 1 MiB, so each photo is kept well below it.
const MAX_DATA_URI_CHARS = 700000;
const COMPRESSION_STEPS = [
  { width: 1100, quality: 0.6 },
  { width: 800, quality: 0.45 },
  { width: 600, quality: 0.35 },
];

function imageSize(uri) {
  return new Promise((resolve) => {
    try {
      Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Shrink a local photo and return it as a JPEG data URI small enough to store
 * inside a Firestore document. Throws if the photo cannot be made small enough.
 */
export async function compressImageToDataUri(uri) {
  const original = await imageSize(uri);
  for (const step of COMPRESSION_STEPS) {
    // Never enlarge a photo that is already smaller than the target width.
    const actions = original && original.width <= step.width ? [] : [{ resize: { width: step.width } }];
    const result = await manipulateAsync(uri, actions, { compress: step.quality, format: SaveFormat.JPEG, base64: true });
    if (result?.base64) {
      const dataUri = `data:image/jpeg;base64,${result.base64}`;
      if (dataUri.length <= MAX_DATA_URI_CHARS) {
        return { dataUri, width: result.width || null, height: result.height || null };
      }
    }
  }
  throw new Error('This photo is too large to attach. Please take it again.');
}

function extensionFromUri(uri) {
  const clean = String(uri || '').split('?')[0];
  const ext = clean.includes('.') ? clean.split('.').pop().toLowerCase() : 'jpg';
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
}

// Firebase Storage path (only used when EXPO_PUBLIC_USE_FIREBASE_STORAGE=true).
export async function uploadLocalImage(uri, pathPrefix, namePrefix = 'image') {
  const response = await fetchWithTimeout(uri, { timeoutMs: 20000 });
  const blob = await response.blob();
  const ext = extensionFromUri(uri);
  const fileRef = ref(storage, `${pathPrefix}/${namePrefix}-${Date.now()}.${ext}`);
  await uploadBytes(fileRef, blob, { contentType: blob.type || `image/${ext === 'jpg' ? 'jpeg' : ext}` });
  return getDownloadURL(fileRef);
}

export async function uploadMultipleImages(uris, pathPrefix) {
  const urls = [];
  for (let i = 0; i < uris.length; i += 1) {
    urls.push(await uploadLocalImage(uris[i], pathPrefix, `evidence-${i + 1}`));
  }
  return urls;
}

/**
 * Prepare a set of photos for saving with a record.
 * Returns { urls, images, failed }:
 *   urls   – Firebase Storage download links (Storage mode only)
 *   images – compressed { dataUri, width, height } objects (default mode)
 *   failed – how many photos could not be prepared
 * A photo that fails never blocks the rest, and nothing here waits forever.
 */
export async function prepareImages(uris = [], storagePath = 'images') {
  const result = { urls: [], images: [], failed: 0 };
  const prepareOne = async (uri, i) => {
    try {
      if (USE_FIREBASE_STORAGE) {
        const url = await withDeadline(uploadLocalImage(uri, storagePath, `photo-${i + 1}`), 45000, () => null);
        if (!url) throw new Error('upload timed out');
        return { url };
      }
      const image = await withDeadline(compressImageToDataUri(uri), 25000, () => null);
      if (!image) throw new Error('photo preparation timed out');
      return { image };
    } catch (_) {
      return { failed: true };
    }
  };
  // Two photos at a time (instead of one after another), keeping their order.
  for (let i = 0; i < uris.length; i += 2) {
    const chunk = await Promise.all(uris.slice(i, i + 2).map((uri, offset) => prepareOne(uri, i + offset)));
    chunk.forEach((item) => {
      if (item.failed) result.failed += 1;
      else if (item.url) result.urls.push(item.url);
      else if (item.image) result.images.push(item.image);
    });
  }
  return result;
}

// Company logos are small: shrunk to at most 256px and kept as a data URI.
// PNG is tried first so transparent logos stay transparent.
const LOGO_STEPS = [
  { width: 256, format: SaveFormat.PNG, mime: 'image/png' },
  { width: 192, format: SaveFormat.PNG, mime: 'image/png' },
  { width: 256, format: SaveFormat.JPEG, compress: 0.7, mime: 'image/jpeg' },
  { width: 160, format: SaveFormat.JPEG, compress: 0.6, mime: 'image/jpeg' },
];
const MAX_LOGO_CHARS = 150000;

export async function compressLogoToDataUri(uri) {
  const original = await imageSize(uri);
  for (const step of LOGO_STEPS) {
    const actions = original && original.width <= step.width ? [] : [{ resize: { width: step.width } }];
    const result = await manipulateAsync(uri, actions, { compress: step.compress ?? 1, format: step.format, base64: true });
    if (result?.base64) {
      const dataUri = `data:${step.mime};base64,${result.base64}`;
      if (dataUri.length <= MAX_LOGO_CHARS) return dataUri;
    }
  }
  throw new Error('This logo is too detailed to store. Please choose a simpler or smaller image.');
}
