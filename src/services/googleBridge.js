// Google sign-in through a secure in-app browser. Used where the native Google module cannot run (Expo Go),
// and as a safety net in installed builds. The hosted page is web-static/google-auth.html.

export const GOOGLE_BRIDGE_URL = process.env.EXPO_PUBLIC_GOOGLE_BRIDGE_URL
  || 'https://product-trust-verification.firebaseapp.com/google-auth';

// A one-time code for this attempt. It stops an old or foreign result from being accepted.
export function makeState() {
  const bytes = new Uint8Array(16);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Where the hosted page sends the person back to: the app itself.
export function buildReturnUrl({ expoGo = false, hostUri = '', scheme = 'producttrust' } = {}) {
  if (expoGo && hostUri) return `exp://${String(hostUri).replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '')}/--/google-auth`;
  return `${scheme}://google-auth`;
}

export function buildBridgeUrl({ bridgeUrl = GOOGLE_BRIDGE_URL, returnUrl, state }) {
  return `${bridgeUrl}${bridgeUrl.includes('?') ? '&' : '?'}return=${encodeURIComponent(returnUrl)}&state=${encodeURIComponent(state)}`;
}

const decode = (value) => { try { return decodeURIComponent(String(value).replace(/\+/g, ' ')); } catch (_) { return ''; } };

// Reads the result the page sent back. Anything unexpected is an error, never a sign-in.
export function parseBridgeResult(url, expectedState) {
  const text = String(url || '');
  const at = text.indexOf('#');
  if (at < 0) return { error: 'missing' };
  const values = {};
  text.slice(at + 1).split('&').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq > 0) values[decode(pair.slice(0, eq))] = decode(pair.slice(eq + 1));
  });
  if (!expectedState || values.state !== expectedState) return { error: 'state' };
  if (values.error) return { error: values.error };
  const idToken = values.idToken || '';
  if (idToken.split('.').length !== 3) return { error: 'token' };
  return { idToken };
}
