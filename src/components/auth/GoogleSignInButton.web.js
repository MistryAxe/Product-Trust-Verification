import React from 'react';
import { Alert } from 'react-native';
import { SecondaryButton } from '../common';
import { loginWithGooglePopup } from '../../services/authService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function GoogleSignInButton({ onBusy }) {
  async function signIn() {
    onBusy?.(true);
    try {
      await loginWithGooglePopup();
    } catch (error) {
      const code = String(error?.code || '');
      if (/popup-closed-by-user|cancelled-popup-request/i.test(code)) return;

      if (/unauthorized-domain/i.test(code)) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this address';
        Alert.alert(
          'Google sign-in is not set up for this web address',
          `You can sign in with your email and password instead.\n\nFor the app team: in the Firebase console open Authentication > Settings > Authorized domains and add "${host}".`,
        );
        return;
      }
      if (/operation-not-allowed/i.test(code)) {
        Alert.alert('Google sign-in is switched off', 'You can sign in with your email and password instead.\n\nFor the app team: in the Firebase console open Authentication > Sign-in method and enable Google.');
        return;
      }
      if (/network-request-failed/i.test(code)) {
        Alert.alert('No connection', 'Check your internet connection and try again.');
        return;
      }

      Alert.alert('Google sign-in failed', friendlyFirebaseError(error));
    } finally {
      onBusy?.(false);
    }
  }

  return (
    <SecondaryButton
      title="Continue with Google"
      icon="logo-google"
      onPress={signIn}
    />
  );
}
