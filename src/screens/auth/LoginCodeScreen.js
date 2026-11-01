import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Input, PrimaryButton, Screen, SecondaryButton, TopBar } from '../../components/common';
import { logout } from '../../services/authService';
import { requestLoginCode, submitLoginCode } from '../../services/loginCodeService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

const RESEND_WAIT_SECONDS = 30;

// Second step of signing in: the customer types the 6-digit code that was
// emailed to them. The code is sent automatically when this screen opens.
export default function LoginCodeScreen({ email, onVerified }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [note, setNote] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState(email);
  const submitting = useRef(false);

  const send = async (automatic = false) => {
    setBusy(true);
    setUnavailable(false);
    try {
      const result = await requestLoginCode();
      if (result.email) setMaskedEmail(result.email);
      setCooldown(RESEND_WAIT_SECONDS);
      setNote(`We emailed a 6-digit code to ${result.email || email}. It expires in 10 minutes.`);
    } catch (error) {
      const code = error?.code || '';
      if (code === 'functions/resource-exhausted' && automatic) {
        // A code was sent a moment ago (for example the app was reopened).
        setCooldown(RESEND_WAIT_SECONDS);
        setNote(`We already emailed a code to ${email}. Enter it below, or wait to ask for a new one.`);
      } else if (code === 'functions/not-found' || code === 'functions/internal' || code === 'functions/unavailable') {
        setUnavailable(true);
        setNote('');
      } else if (!automatic) {
        Alert.alert('Could not send the code', friendlyFirebaseError(error));
      } else {
        setNote('We could not send the code automatically. Tap "Send a new code".');
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { send(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Leaving this screen (back arrow, "Use a different account", or the Android back button) signs out and returns to the welcome screen.
  // The keyboard is closed first, so the next screen's text boxes start from a clean keyboard.
  const leave = () => { Keyboard.dismiss(); logout().catch(() => {}); };
  useEffect(() => () => Keyboard.dismiss(), []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 6 || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const ok = await submitLoginCode(digits);
      if (ok) await onVerified();
    } catch (error) {
      setCode('');
      Alert.alert('Code not accepted', friendlyFirebaseError(error));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const onChange = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify(digits); // continue as soon as the 6th digit is typed
  };

  return (
    <Screen>
      <TopBar title="Sign-in code" onBack={leave} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 28, paddingVertical: 20 }}
      >
        <View style={[styles.permissionIcon, { backgroundColor: C.primaryBg }]}><Icon name="keypad-outline" size={38} color={C.primary} /></View>
        <Text style={styles.h2Center}>Enter your sign-in code</Text>
        <Text style={[styles.bodySoft, { textAlign: 'center', fontSize: 14, lineHeight: 21 }]}>For your security, we emailed a 6-digit code to</Text>
        <Text style={[styles.h3, { textAlign: 'center' }]}>{maskedEmail}</Text>
        {note ? <Text style={[styles.bodySoft, { textAlign: 'center' }]}>{note}</Text> : null}
        {unavailable ? (
          <View style={[styles.notice, { backgroundColor: C.dangerBg, alignSelf: 'stretch', marginBottom: 0 }]}>
            <Icon name="warning-outline" color={C.danger} />
            <Text style={[styles.noticeText, { color: C.danger }]}>The sign-in code service is not available right now. Please try again in a moment, or contact support.</Text>
          </View>
        ) : null}
        <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
          <Input
            label="6-digit code"
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textContentType="oneTimeCode"
            value={code}
            onChangeText={onChange}
            inputStyle={{ fontSize: 22, letterSpacing: 8, textAlign: 'center', fontWeight: '800' }}
          />
          <PrimaryButton title={busy ? 'Checking…' : 'Verify and sign in'} icon="checkmark-circle-outline" onPress={() => verify(code)} disabled={busy || code.length !== 6} />
          <SecondaryButton title={cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'} icon="mail-outline" color={C.primary} onPress={() => send(false)} disabled={busy || cooldown > 0} />
          <SecondaryButton title="Use a different account" icon="log-out-outline" color={C.textSoft} onPress={leave} />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
