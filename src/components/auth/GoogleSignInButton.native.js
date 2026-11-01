import React, { useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { SecondaryButton } from '../common';
import { loginWithGoogleIdToken } from '../../services/authService';
import { buildBridgeUrl, buildReturnUrl, makeState, parseBridgeResult } from '../../services/googleBridge';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

// OAuth client IDs are public app identifiers, not secrets.
const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '398531881162-ljv4o6u1ant71t5a2cnpth0pse3vm8kl.apps.googleusercontent.com';
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '398531881162-qikvhlbedchnuli2f7rk6vor1mee39ck.apps.googleusercontent.com';
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '398531881162-ssdlbi4evse5cpg3ueljl86uohbml1v7.apps.googleusercontent.com';

function isExpoGoRuntime() {
  return Constants.appOwnership === 'expo' || Boolean(Constants.expoGoConfig);
}

function loadNativeGoogleModule() {
  try {
    return require('@react-native-google-signin/google-signin');
  } catch (_) {
    return null;
  }
}

export default function GoogleSignInButton({ onBusy }) {
  const nativeConfigured = useMemo(() => {
    if (Platform.OS === 'ios') return Boolean(webClientId && iosClientId);
    if (Platform.OS === 'android') return Boolean(webClientId && androidClientId);
    return false;
  }, []);

  // Expo Go cannot contain RNGoogleSignin. The hosted bridge remains only as a
  // development/testing route; installed Product Trust builds never fall back
  // to browser OAuth after a native Google error.
  async function signInWithExpoGoBridge() {
    onBusy?.(true);
    try {
      const state = makeState();
      const returnUrl = buildReturnUrl({
        expoGo: true,
        hostUri: Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || '',
      });
      const result = await WebBrowser.openAuthSessionAsync(buildBridgeUrl({ returnUrl, state }), returnUrl);
      if (result?.type !== 'success' || !result.url) return;
      const parsed = parseBridgeResult(result.url, state);
      if (parsed.error === 'cancelled') return;
      if (parsed.error) {
        Alert.alert('Google sign-in did not finish', 'Google sign-in could not be completed in Expo Go. Email and password sign-in still works here.');
        return;
      }
      await loginWithGoogleIdToken(parsed.idToken);
    } catch (error) {
      Alert.alert('Google sign-in failed', friendlyFirebaseError(error));
    } finally {
      onBusy?.(false);
    }
  }

  async function signInNative(GoogleSignin) {
    onBusy?.(true);
    try {
      GoogleSignin.configure({
        webClientId,
        iosClientId: Platform.OS === 'ios' ? iosClientId : undefined,
        offlineAccess: false,
        forceCodeForRefreshToken: false,
        scopes: ['email', 'profile'],
      });

      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      const result = await GoogleSignin.signIn();
      if (result?.type === 'cancelled') return;

      const payload = result?.data || result || {};
      let idToken = payload?.idToken || result?.idToken || '';
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens?.idToken || '';
      }
      if (!idToken) throw new Error('Google did not return a sign-in token.');

      await loginWithGoogleIdToken(idToken);
    } catch (error) {
      const text = `${String(error?.code || '')} ${String(error?.message || '')}`;
      if (/SIGN_IN_CANCELLED|CANCELED|CANCELLED/i.test(text)) return;

      // Never fall back to embedded/browser OAuth in an installed mobile build.
      // Google blocks unsupported mobile user-agent flows and that was the cause
      // of the previous "Access blocked / invalid_request" screen.
      if (/DEVELOPER_ERROR|invalid_request|redirect_uri|oauth|PLAY_SERVICES/i.test(text)) {
        Alert.alert(
          'Google sign-in needs attention',
          'This installed app could not complete Google sign-in. Check that this build uses the registered Android/iOS client and signing certificate, then try again.',
        );
        return;
      }

      Alert.alert('Google sign-in failed', friendlyFirebaseError(error));
    } finally {
      onBusy?.(false);
    }
  }

  async function signIn() {
    if (isExpoGoRuntime()) return signInWithExpoGoBridge();

    if (!nativeConfigured) {
      Alert.alert('Google sign-in is not configured', 'The Google client settings are missing from this build.');
      return;
    }

    const module = loadNativeGoogleModule();
    const GoogleSignin = module?.GoogleSignin;
    if (!GoogleSignin) {
      Alert.alert('Google sign-in is unavailable', 'This build does not contain the native Google sign-in module. Install the latest Product Trust build.');
      return;
    }

    return signInNative(GoogleSignin);
  }

  return (
    <SecondaryButton
      title="Continue with Google"
      icon="logo-google"
      onPress={signIn}
    />
  );
}
