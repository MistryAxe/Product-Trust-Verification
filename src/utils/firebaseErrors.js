export function friendlyFirebaseError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account was found for that email.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists for that email.',
    'auth/weak-password': 'Choose a stronger password.',
    'auth/too-many-requests': 'Too many requests were made in a short time. Wait a few minutes and try again.',
    'auth/network-request-failed': 'Check your internet connection and try again.',
    'auth/configuration-not-found': 'Sign-in is not fully configured yet.',
    'auth/requires-recent-login': 'For security, sign in again before changing this information.',
    'permission-denied': 'Your account does not have permission to do this. Sign in again or contact an administrator.',
    'failed-precondition': 'This feature needs additional setup before it can be used.',
    'storage/unauthorized': 'File upload is not available for this account.',
    'functions/unauthenticated': 'Sign in again and retry this action.',
    'functions/resource-exhausted': error?.message || 'Too many requests. Please wait a moment and try again.',
    'functions/unavailable': error?.message || 'This service is temporarily unavailable. Please try again.',
    'functions/permission-denied': 'Your account does not have permission to perform this administrator action.',
    'functions/already-exists': 'An account already uses this email address.',
    'functions/failed-precondition': error?.message || 'This action cannot be completed until its account requirements are met.',
    'functions/invalid-argument': error?.message || 'Check the entered details and try again.',
    'functions/not-found': 'This action is not available right now.',
    'functions/internal': 'The secure account service could not complete this action. Try again.',
  };

  if (messages[code]) return messages[code];
  const raw = String(error?.message || '');
  if (/OCR\.Space|EXPO_PUBLIC_OCR|OCR\b/i.test(raw)) return 'Automatic label reading is temporarily unavailable. You can still enter the printed details manually.';
  if (/Firebase|Firestore|Cloud Functions/i.test(raw)) return 'This action could not be completed right now. Try again or contact an administrator.';
  if (/SerpApi|SERPAPI/i.test(raw)) return 'Online product research is temporarily unavailable.';
  if (/GTIN/i.test(raw)) return raw.replace(/GTIN/gi, 'product code');
  return raw || 'Something went wrong. Please try again.';
}
