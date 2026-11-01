import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { completeGoogleRedirect, consumeGoogleRedirectMarker, ensureUserProfile, logout } from '../services/authService';
import { FEATURES } from '../config/features';
import { getUserProfile, subscribeUserProfile } from '../services/userService';
import { friendlyFirebaseError } from '../utils/firebaseErrors';

// True once the first sign-in check of this launch of the app has been made. It stays true while the app is open,
// so the sign-out below happens when the app OPENS and never again while someone is using it.
let launchHandled = false;
let blockedAlertUid = null;

function blockInactiveAccount(user, profile) {
  if (!user) return false;
  const status = profile?.accountStatus || 'active';
  if (status === 'active') {
    if (blockedAlertUid === user.uid) blockedAlertUid = null;
    return false;
  }
  if (blockedAlertUid !== user.uid) {
    blockedAlertUid = user.uid;
    const removed = status === 'deleted';
    Alert.alert(
      removed ? 'Account unavailable' : 'Account disabled',
      removed
        ? 'This Product Trust account has been removed. Contact an administrator if you believe this is a mistake.'
        : 'An administrator has disabled this Product Trust account. Contact an administrator if you believe this is a mistake.',
    );
  }
  return true;
}

export default function useAuthSession() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [verifiedTick, setVerifiedTick] = useState(0);

  const refreshProfile = async () => {
    if (!auth.currentUser) return null;
    const fresh = await getUserProfile(auth.currentUser.uid);
    setProfile(fresh);
    return fresh;
  };

  // Re-read the signed-in account from Firebase (used after the person clicks
  // the verification link in their email) and re-render with the new state.
  const refreshAuthUser = async () => {
    if (!auth.currentUser) return false;
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
    } catch (_) {}
    setVerifiedTick((tick) => tick + 1);
    return auth.currentUser?.emailVerified === true;
  };

  useEffect(() => {
    if (Platform.OS === 'web') completeGoogleRedirect();
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    // The app starts on the welcome screen every time it opens: a session saved from an earlier visit is cleared
    // once, at launch (FEATURES.startSignedOut). The person then signs in again with their details.
    // Exceptions: the website coming back from a Google sign-in redirect, and the switch being turned off.
    (() => {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!active) return;
        if (!launchHandled) {
          launchHandled = true;
          const returningFromGoogle = consumeGoogleRedirectMarker();
          if (FEATURES.startSignedOut && user && !returningFromGoogle) {
            try {
              await logout(); // the next call to this listener delivers "signed out" and the welcome screen shows
              return;
            } catch (_) {
              // Could not sign out: carry on rather than leave the person stuck on the loading screen.
            }
          }
        }
        if (!active) return;
        setFirebaseUser(user);
        if (!user) {
          setProfile(null);
          setBooting(false);
          return;
        }
        try {
          const loaded = await ensureUserProfile(user);
          if (!active) return;
          if (blockInactiveAccount(user, loaded)) {
            setProfile(null);
            await logout().catch(() => {});
            return;
          }
          setProfile(loaded);
        } catch (error) {
          Alert.alert('Account setup issue', friendlyFirebaseError(error));
        } finally {
          if (active) setBooting(false);
        }
      });
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser?.uid) return undefined;
    return subscribeUserProfile(
      firebaseUser.uid,
      (nextProfile) => {
        if (!nextProfile) return;
        if (blockInactiveAccount(firebaseUser, nextProfile)) {
          setProfile(null);
          logout().catch(() => {});
          return;
        }
        setProfile(nextProfile);
      },
      () => {},
    );
  }, [firebaseUser?.uid]);

  return {
    firebaseUser,
    profile,
    booting,
    refreshProfile,
    refreshAuthUser,
    verifiedTick,
  };
}
