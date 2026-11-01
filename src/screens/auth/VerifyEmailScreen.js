import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, PrimaryButton, SecondaryButton, TopBar } from '../../components/common';
import { logout, resendVerification, verificationSentRecently } from '../../services/authService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

const RESEND_WAIT_SECONDS = 60;

// Shown right after sign-in until the customer has verified their email.
// The verification email is sent automatically, and the screen continues by
// itself as soon as the link has been opened.
export default function VerifyEmailScreen({ uid, email, onCheck }) {
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [note, setNote] = useState('');
  const checking = useRef(false);

  const send = async (automatic = false) => {
    setBusy(true);
    try {
      await resendVerification();
      setCooldown(RESEND_WAIT_SECONDS);
      setNote(`A new verification link was sent to ${email}.`);
    } catch (error) {
      if (!automatic) Alert.alert('Could not send the email', friendlyFirebaseError(error));
      else setNote('We could not send the email automatically. Tap "Send the email again".');
    } finally {
      setBusy(false);
    }
  };

  // Send the link as soon as the screen opens (unless one was just sent at sign-up).
  useEffect(() => {
    if (!verificationSentRecently(uid)) send(true);
    else { setCooldown(RESEND_WAIT_SECONDS); setNote(`We sent a verification link to ${email}.`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Quietly check every few seconds so the app continues on its own once the
  // link has been opened (for example after coming back from the mail app).
  useEffect(() => {
    const timer = setInterval(async () => {
      if (checking.current) return;
      checking.current = true;
      try { await onCheck(); } finally { checking.current = false; }
    }, 4000);
    return () => clearInterval(timer);
  }, [onCheck]);

  const manualCheck = async () => {
    setBusy(true);
    try {
      const verified = await onCheck();
      if (!verified) Alert.alert('Not verified yet', 'We cannot see your verification yet. Open the link in the email we sent you, then tap this button again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Verify your email" onBack={() => logout().catch(() => {})} />
      <View style={[styles.centerFill, { gap: 18, paddingHorizontal: 28 }]}>
        <View style={[styles.permissionIcon, { backgroundColor: C.primaryBg }]}><Icon name="mail-unread-outline" size={38} color={C.primary} /></View>
        <Text style={styles.h2Center}>Verify your email</Text>
        <Text style={[styles.bodySoft, { textAlign: 'center', fontSize: 14, lineHeight: 21 }]}>
          For your security, please verify your email address before you continue. We sent a link to
        </Text>
        <Text style={[styles.h3, { textAlign: 'center' }]}>{email}</Text>
        <Text style={[styles.bodySoft, { textAlign: 'center' }]}>Open the email, tap the link, then come back here. Check your junk or spam folder if you cannot find it.</Text>
        {note ? <Text style={[styles.body, { textAlign: 'center', color: C.primary }]}>{note}</Text> : null}
        <View style={{ alignSelf: 'stretch', marginTop: 6 }}>
          <PrimaryButton title={busy ? 'Checking…' : "I've verified my email"} icon="checkmark-circle-outline" onPress={manualCheck} disabled={busy} />
          <SecondaryButton title={cooldown > 0 ? `Send the email again (${cooldown}s)` : 'Send the email again'} icon="mail-outline" color={C.primary} onPress={() => send(false)} disabled={busy || cooldown > 0} />
          <SecondaryButton title="Use a different account" icon="log-out-outline" color={C.textSoft} onPress={() => logout().catch(() => {})} />
        </View>
      </View>
    </Screen>
  );
}
