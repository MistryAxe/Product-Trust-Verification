import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'productTrustLoginCode:';

// Remembers that the code was entered for THIS sign-in. Firebase changes
// `lastSignInTime` every time someone really signs in with their password
// (but not when the app merely reopens and restores the saved session), so:
//   sign in again  -> a new code is required
//   reopen the app -> no new code
export default function useLoginCodeGate(firebaseUser, enabled) {
  const uid = firebaseUser?.uid || null;
  const stamp = firebaseUser?.metadata?.lastSignInTime || '';
  const [state, setState] = useState({ ready: !enabled, ok: !enabled });

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !uid) { setState({ ready: true, ok: !enabled }); return undefined; }
    setState({ ready: false, ok: false });
    AsyncStorage.getItem(`${PREFIX}${uid}`)
      .then((saved) => { if (!cancelled) setState({ ready: true, ok: Boolean(stamp) && saved === stamp }); })
      .catch(() => { if (!cancelled) setState({ ready: true, ok: false }); });
    return () => { cancelled = true; };
  }, [enabled, uid, stamp]);

  const markVerified = useCallback(async () => {
    try { await AsyncStorage.setItem(`${PREFIX}${uid}`, stamp); } catch (_) {}
    setState({ ready: true, ok: true });
  }, [uid, stamp]);

  return { ...state, markVerified };
}
