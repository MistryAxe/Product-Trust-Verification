import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { Screen, LoadingBlock } from '../components/common';
import Splash from '../screens/onboarding/Splash';
import LandingScreen from '../screens/onboarding/LandingScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import LoginCodeScreen from '../screens/auth/LoginCodeScreen';
import useLoginCodeGate from '../hooks/useLoginCodeGate';
import { FEATURES, shouldRequireLoginCode } from '../config/features';
import useAuthSession from '../hooks/useAuthSession';
import { rootBackAction } from './rootBack';
import { logout } from '../services/authService';
import RoleNavigator from './RoleNavigator';
import { useTheme } from '../theme';

export default function RootNavigator() {
  useTheme();
  const [authEntry, setAuthEntry] = useState(null);
  const { firebaseUser, profile, booting, refreshProfile, refreshAuthUser } = useAuthSession();

  // Extra sign-in steps apply to customers who sign in with a password.
  // Manufacturers and admins are not held back for now; Google sign-in is already verified.
  const isCustomer = profile?.role === 'customer' || profile?.role === 'consumer';
  const usesPassword = (firebaseUser?.providerData || []).some((item) => item?.providerId === 'password');
  const needsLoginCode = Boolean(firebaseUser) && shouldRequireLoginCode({ role: profile?.role, email: firebaseUser?.email, usesPassword });
  const codeGate = useLoginCodeGate(firebaseUser, needsLoginCode);

  // Android back on the sign-in screen returns to the welcome screen (on the welcome screen Android leaves the app).
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const action = rootBackAction({ firebaseUser, authEntry, needsCode: needsLoginCode, codeOk: codeGate.ok });
      if (action === 'closeAuth') { setAuthEntry(null); return true; }
      if (action === 'signOut') { logout().catch(() => {}); return true; } // leave the code step
      return false;
    });
    return () => subscription.remove();
  }, [firebaseUser, authEntry, needsLoginCode, codeGate.ok]);

  if (booting) return <Splash />;

  if (!firebaseUser && !authEntry) {
    return (
      <LandingScreen
        onSignIn={() => setAuthEntry('login')}
        onCreateAccount={() => setAuthEntry('signup')}
      />
    );
  }

  if (!firebaseUser) {
    return <AuthScreen initialMode={authEntry || 'login'} onBack={() => setAuthEntry(null)} />;
  }

  if (!profile) {
    return (
      <Screen>
        <LoadingBlock text="Loading your account…" />
      </Screen>
    );
  }

  // Sign in with password -> type the emailed code -> in.
  if (needsLoginCode) {
    if (!codeGate.ready) return <Splash />;
    if (!codeGate.ok) return <LoginCodeScreen email={firebaseUser.email || profile.email || ''} onVerified={codeGate.markVerified} />;
  } else if (FEATURES.requireEmailVerification && isCustomer && usesPassword && firebaseUser.emailVerified !== true) {
    // Optional one-time "verify your email" link (off by default).
    return <VerifyEmailScreen uid={firebaseUser.uid} email={firebaseUser.email || profile.email || ''} onCheck={refreshAuthUser} />;
  }

  return (
    <RoleNavigator
      firebaseUser={firebaseUser}
      profile={profile}
      refreshProfile={refreshProfile}
    />
  );
}
