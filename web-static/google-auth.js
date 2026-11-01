// Logic of the hosted Google sign-in page (google-auth.html). It has no Firebase import so it can be tested on its own.
//
// How it works: the app opens this page in a secure in-app browser with ?return=<the app's own address>&state=<one-time code>.
// The page signs the person in with Google (through Firebase), then sends the Google ID token back to the app inside
// the address fragment (#...), together with the same one-time code. The token only ever goes to the app itself.

const STATE_OK = /^[A-Za-z0-9_-]{8,128}$/;
// Only the app itself, or Expo Go on a private network / tunnel while developing, may receive the result.
const DEV_HOST = /^(localhost|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|[a-z0-9-]+\.local|[a-z0-9-]+(\.[a-z0-9-]+)*\.exp\.direct)$/i;

export function validateReturnUrl(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (_) { return { ok: false }; }
  if (u.username || u.password) return { ok: false };
  const base = String(raw).split('#')[0];
  if (u.protocol === 'producttrust:') {
    return u.hostname === 'google-auth' && (u.pathname === '' || u.pathname === '/') && !u.port ? { ok: true, base } : { ok: false };
  }
  if (u.protocol === 'exp:' || u.protocol === 'exps:') {
    return DEV_HOST.test(u.hostname) && u.pathname === '/--/google-auth' ? { ok: true, base } : { ok: false };
  }
  return { ok: false };
}

const fragment = (parts) => Object.entries(parts).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

// deps: { search, auth, api: { getRedirectResult, signInWithRedirect, GoogleAuthProvider }, session, replace, show }
export async function run({ search, auth, api, session, replace, show }) {
  const params = new URLSearchParams(search || '');
  const state = params.get('state') || '';
  const ret = validateReturnUrl(params.get('return'));
  if (!ret.ok || !STATE_OK.test(state)) {
    show('This sign-in link is not valid. Close this window and start again from the app.');
    return { status: 'invalid' };
  }
  const back = (extra) => replace(`${ret.base}#${fragment({ ...extra, state })}`);
  const fail = (code, message) => { show(message); back({ error: code }); return { status: code }; };
  const mark = `pt_google_${state}`;

  show('Signing you in with Google…');
  let result = null;
  try {
    result = await api.getRedirectResult(auth);
  } catch (error) {
    session.removeItem(mark);
    return fail(String(error?.code || 'error').replace(/^auth\//, '') || 'error', 'Google sign-in could not be completed. Returning to the app…');
  }

  if (!result) {
    if (session.getItem(mark)) {
      // We came back from Google without a result: the person cancelled, or Google said no.
      session.removeItem(mark);
      return fail('cancelled', 'Google sign-in was cancelled. Returning to the app…');
    }
    session.setItem(mark, '1');
    const provider = new api.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await api.signInWithRedirect(auth, provider);
    return { status: 'redirecting' };
  }

  session.removeItem(mark);
  const credential = api.GoogleAuthProvider.credentialFromResult(result);
  const idToken = credential?.idToken || '';
  try { await auth.signOut(); } catch (_) { /* this page never needs to stay signed in */ }
  if (!idToken) return fail('no-token', 'Google did not return a sign-in token. Returning to the app…');
  show('Done. Returning to the app…');
  back({ idToken });
  return { status: 'success' };
}
