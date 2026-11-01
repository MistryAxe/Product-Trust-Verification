import { Platform } from 'react-native';
import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyCfri_LQZDd-9z-yFaKd-WOBOrBL51S2ec',
  authDomain: 'product-trust-verification.firebaseapp.com',
  projectId: 'product-trust-verification',
  storageBucket: 'product-trust-verification.firebasestorage.app',
  messagingSenderId: '398531881162',
  appId: '1:398531881162:web:68d00f66f0899b9492ac33',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

let auth;
if (Platform.OS === 'web') {
  // Use Firebase's normal browser Auth instance so popup/redirect providers
  // work with standard browser persistence and OAuth handling.
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    auth = getAuth(app);
  }
}

// On phones and in Expo Go, Firestore's default streaming connection often hangs or takes a long time to
// start (reads and writes then seem to "take forever" and never finish). Long polling is the dependable
// setting for mobile. On the web the browser decides automatically.
let db;
try {
  db = initializeFirestore(app, Platform.OS === 'web'
    ? { experimentalAutoDetectLongPolling: true }
    : { experimentalForceLongPolling: true });
} catch (error) {
  // Already started (for example after a hot reload): reuse it.
  db = getFirestore(app);
}
const storage = getStorage(app);

export const FIREBASE_WEB_API_KEY = firebaseConfig.apiKey;
export { app, auth, db, storage };
