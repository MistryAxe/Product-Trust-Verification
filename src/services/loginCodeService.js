import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../config/firebase';
import { fetchWithTimeout } from '../utils/netFetch';

// Two ways to run the sign-in code service. The app picks one from `.env`:
//   EXPO_PUBLIC_LOGIN_CODE_URL set  -> the free Cloudflare Worker (workers/login-code)
//   not set                         -> the Firebase Cloud Functions (needs the paid Blaze plan)
const WORKER_URL = String(process.env.EXPO_PUBLIC_LOGIN_CODE_URL || '').trim().replace(/\/+$/, '');
const functions = getFunctions(app);

// Errors carry the same "functions/..." codes either way, so the screen handles both identically.
function serviceError(code, message) {
  const error = new Error(message);
  error.code = `functions/${code}`;
  return error;
}

async function callWorker(path, body) {
  const user = auth.currentUser;
  if (!user) throw serviceError('unauthenticated', 'Please sign in again.');
  let response;
  try {
    const token = await user.getIdToken();
    response = await fetchWithTimeout(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      timeoutMs: 15000,
    });
  } catch (_) {
    throw serviceError('unavailable', 'We could not reach the sign-in code service. Check your connection and try again.');
  }
  let data = {};
  try { data = await response.json(); } catch (_) { /* leave empty */ }
  if (!response.ok) {
    throw serviceError(data?.error?.code || 'unavailable', data?.error?.message || 'The sign-in code service is not available right now.');
  }
  return data;
}

// Ask for a fresh 6-digit code to be emailed to the signed-in account.
export async function requestLoginCode() {
  if (WORKER_URL) return callWorker('/send');
  const result = await httpsCallable(functions, 'sendLoginCode')();
  return result.data || {};
}

// Check the code the customer typed. Resolves true when correct; throws a plain-language error otherwise.
export async function submitLoginCode(code) {
  if (WORKER_URL) return (await callWorker('/verify', { code })).verified === true;
  const result = await httpsCallable(functions, 'verifyLoginCode')({ code });
  return result.data?.verified === true;
}
