import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, TouchableOpacity, View } from 'react-native';
import { reload } from 'firebase/auth';
import { C, styles, useTheme } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, InfoRow, FeatureTile, RestorableScrollView } from '../../components/common';
import { auth } from '../../config/firebase';
import { logout, resendVerification, resetPassword } from '../../services/authService';
import { deleteMyAccountPermanently } from '../../services/accountService';
import { updateUserSettings } from '../../services/userService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
import { CompanyLogoEditor } from '../../components/reports/CompanyLogoEditor';
import { rememberScreenState, startingScreenState } from '../../utils/screenMemory';

export default function SettingsScreen({ uid, profile, refreshProfile, go, arrivedByBack = false }) {
  const role = profile?.role || 'customer';
  const { mode, setMode } = useTheme();
  // Always opens on the Settings menu. Only coming BACK from a screen opened from
  // here (the Food Safety Profile) returns to the section you were in.
  const [section, setSectionState] = useState(() => startingScreenState('settings', uid, arrivedByBack, 'menu'));
  const setSection = (next) => { rememberScreenState('settings', uid, next); setSectionState(next); };
  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [organizationName, setOrganizationName] = useState(profile?.organizationName || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile?.notificationsEnabled !== false);
  const [locationEnabled, setLocationEnabled] = useState(!!profile?.locationEnabled);
  const [busy, setBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const usesPassword = (auth.currentUser?.providerData || []).some((item) => item?.providerId === 'password');

  useEffect(() => {
    setFullName(profile?.fullName || '');
    setOrganizationName(profile?.organizationName || '');
    setNotificationsEnabled(profile?.notificationsEnabled !== false);
    setLocationEnabled(!!profile?.locationEnabled);
  }, [profile?.uid, profile?.updatedAt?.seconds]);

  useEffect(() => {
    if (emailCooldown <= 0) return undefined;
    const timer = setInterval(() => setEmailCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [emailCooldown > 0]);

  const saveDetails = async (extra = {}) => {
    setBusy(true);
    try {
      const patch = { fullName: fullName.trim(), notificationsEnabled, locationEnabled, ...extra };
      if (role === 'manufacturer') patch.organizationName = organizationName.trim();
      await updateUserSettings(uid, patch);
      await refreshProfile();
      Alert.alert('Saved', 'Your changes are ready the next time you open Product Trust.');
    } catch (error) {
      Alert.alert('Unable to save', friendlyFirebaseError(error));
    } finally { setBusy(false); }
  };

  const verifyEmail = async () => {
    if (emailBusy || emailCooldown > 0) return;
    setEmailBusy(true);
    try {
      await reload(auth.currentUser);
      if (auth.currentUser.emailVerified) return Alert.alert('Already verified', 'Your email address is already verified.');
      await resendVerification();
      setEmailCooldown(60);
      Alert.alert('Verification email sent', `Check ${auth.currentUser?.email || 'your inbox'} and your spam folder.`);
    } catch (error) {
      if (String(error?.code || '').includes('too-many-requests')) setEmailCooldown(120);
      Alert.alert('Unable to send', friendlyFirebaseError(error));
    } finally { setEmailBusy(false); }
  };

  const reset = async () => {
    if (emailBusy || emailCooldown > 0) return;
    const email = auth.currentUser?.email || profile?.email;
    if (!email) return Alert.alert('Email unavailable', 'This account does not have an email address.');
    setEmailBusy(true);
    try {
      await resetPassword(email);
      setEmailCooldown(60);
      Alert.alert('Password reset email sent', `A secure reset link was sent to ${email}. Check your inbox and spam folder.`);
    } catch (error) {
      if (String(error?.code || '').includes('too-many-requests')) setEmailCooldown(120);
      Alert.alert('Unable to send', friendlyFirebaseError(error));
    } finally { setEmailBusy(false); }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      role === 'manufacturer'
        ? 'This removes your sign-in account and organisation records that belong to this account. This cannot be undone.'
        : 'This removes your sign-in account and saved Product Trust profile. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete permanently', style: 'destructive', onPress: async () => {
          setBusy(true);
          try { await deleteMyAccountPermanently({ password: deletePassword }); }
          catch (error) { Alert.alert('Unable to delete account', friendlyFirebaseError(error)); setBusy(false); }
        } },
      ],
    );
  };

  const back = () => {
    if (section === 'menu') go('back');
    else setSection('menu');
  };
  const title = section === 'menu' ? 'Settings'
    : section === 'account' ? 'Account details'
      : section === 'safety' ? 'Safety preferences'
        : section === 'privacy' ? 'Privacy & permissions'
          : section === 'appearance' ? 'Appearance'
            : 'Email & security';

  return (
    <Screen>
      <TopBar title={title} onBack={back} />
      <RestorableScrollView screenKey={`settings:${section}`} contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        {section === 'menu' ? (
          <>
            <Text style={styles.settingsIntro}>Choose what you want to change.</Text>
            <FeatureTile icon="person-outline" title="Account details" subtitle="Name, organisation and email status" onPress={() => setSection('account')} />
            {role === 'customer' ? <FeatureTile icon="shield-checkmark-outline" title="Safety" subtitle="Food safety profile and recall preferences" color={C.primary} bg={C.primaryBg} onPress={() => setSection('safety')} /> : null}
            <FeatureTile icon="lock-closed-outline" title="Privacy & permissions" subtitle="Location and permission preferences" color={C.cyan} bg={C.cyanBg} onPress={() => setSection('privacy')} />
            <FeatureTile icon="contrast-outline" title="Appearance" subtitle="Light, dark or device setting" onPress={() => setSection('appearance')} />
            <FeatureTile icon="key-outline" title="Email & security" subtitle="Verification, password, sign out and account deletion" color={C.danger} bg={C.dangerBg} onPress={() => setSection('security')} />
          </>
        ) : null}

        {section === 'account' ? (
          <>
            <Text style={styles.sectionTitle}>Your details</Text>
            <Input label="Full name" placeholder="Full name" autoCapitalize="words" value={fullName} onChangeText={setFullName} />
            {role === 'manufacturer' ? <Input label="Organisation / manufacturer name" placeholder="Company name" autoCapitalize="words" value={organizationName} onChangeText={setOrganizationName} /> : null}
            {role === 'manufacturer' ? <CompanyLogoEditor uid={uid} organizationName={organizationName} /> : null}
            <View style={styles.cardPad}>
              <InfoRow label="Email" value={profile?.email || auth.currentUser?.email || '—'} />
              <InfoRow label="Email verified" value={auth.currentUser?.emailVerified ? 'Yes' : 'No'} last />
            </View>
            <PrimaryButton title={busy ? 'Saving…' : 'Save account details'} onPress={() => saveDetails()} disabled={busy} />
          </>
        ) : null}

        {section === 'safety' ? (
          <>
            <Text style={styles.sectionTitle}>Food safety</Text>
            <FeatureTile
              icon="nutrition-outline"
              title="Food Safety Profile"
              subtitle={profile?.allergyProfileComplete ? 'Review your saved allergies and food warnings' : 'Add allergies so food checks can warn you'}
              color={C.primary}
              bg={C.primaryBg}
              onPress={() => go('allergySetup')}
            />
            <Text style={styles.sectionTitle}>Recall alerts</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}><Text style={styles.bodyStrong}>Recall notifications</Text><Text style={styles.rowSub}>Keep this on to receive recall alerts when live recall checking is available.</Text></View>
              <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
            </View>
            <PrimaryButton title={busy ? 'Saving…' : 'Save safety preferences'} onPress={() => saveDetails()} disabled={busy} />
          </>
        ) : null}

        {section === 'privacy' ? (
          <>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}><Text style={styles.bodyStrong}>Use my location when needed</Text><Text style={styles.rowSub}>Product Trust only asks for location when you use a nearby-map or report-location feature.</Text></View>
              <Switch value={locationEnabled} onValueChange={setLocationEnabled} />
            </View>
            <PrimaryButton title={busy ? 'Saving…' : 'Save privacy preferences'} onPress={() => saveDetails()} disabled={busy} />
          </>
        ) : null}

        {section === 'appearance' ? (
          <>
            <Text style={styles.sectionTitle}>Choose how Product Trust looks</Text>
            <View style={styles.themeChoiceGrid}>
              {[['light', 'sunny-outline', 'Light'], ['dark', 'moon-outline', 'Dark'], ['system', 'phone-portrait-outline', 'Device']].map(([key, icon, label]) => {
                const selected = mode === key;
                return (
                  <TouchableOpacity key={key} style={[styles.themeChoice, selected && styles.themeChoiceActive]} onPress={() => setMode(key)} activeOpacity={0.82}>
                    <Icon name={icon} color={selected ? C.dark : C.text} size={24} />
                    <Text style={[styles.themeChoiceText, selected && styles.themeChoiceTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.settingsHint}>Your choice is saved on this device and applies across Product Trust.</Text>
          </>
        ) : null}

        {section === 'security' ? (
          <>
            <Text style={styles.sectionTitle}>Email</Text>
            <View style={styles.buttonStack}>
              <SecondaryButton title={emailBusy ? 'Please wait…' : emailCooldown > 0 ? `Try again in ${emailCooldown}s` : 'Resend Email Verification'} icon="mail-outline" disabled={emailBusy || emailCooldown > 0} onPress={verifyEmail} />
              <SecondaryButton title={emailBusy ? 'Please wait…' : emailCooldown > 0 ? `Try again in ${emailCooldown}s` : 'Send Password Reset Link'} icon="key-outline" disabled={emailBusy || emailCooldown > 0} onPress={reset} />
            </View>
            <Text style={styles.sectionTitle}>Account actions</Text>
            <View style={styles.buttonStack}>
              <SecondaryButton title="Sign Out" icon="log-out-outline" color={C.danger} onPress={() => logout().catch((e) => Alert.alert('Sign out failed', friendlyFirebaseError(e)))} />
              {!confirmingDelete ? (
                <SecondaryButton title="Delete My Account" icon="trash-outline" color={C.danger} onPress={() => setConfirmingDelete(true)} disabled={busy} />
              ) : (
                <View style={[styles.notice, { backgroundColor: C.dangerBg, flexDirection: 'column', marginBottom: 0 }]}>
                  <Text style={[styles.rowTitle, { color: C.danger }]}>Delete your account?</Text>
                  <Text style={styles.noticeText}>{role === 'manufacturer'
                    ? 'This permanently removes your account, your company profile and logo, and all the products, batches, serial numbers and recalls you registered. Reports about your products stay, without a link to your company, so the safety record is not lost.'
                    : 'This permanently removes your account, scan history, saved items and the photos and exact locations from your reports. The written part of a report stays, without your name, so the safety record is not lost.'}</Text>
                  {usesPassword ? <Input label="Confirm your password" placeholder="Your password" secureTextEntry value={deletePassword} onChangeText={setDeletePassword} /> : null}
                  <PrimaryButton title={busy ? 'Deleting…' : 'Delete permanently'} icon="trash-outline" color={C.danger} onPress={deleteAccount} disabled={busy || (usesPassword && !deletePassword)} />
                  <SecondaryButton title="Keep my account" icon="close-outline" onPress={() => { setConfirmingDelete(false); setDeletePassword(''); }} disabled={busy} />
                </View>
              )}
            </View>
          </>
        ) : null}
      </RestorableScrollView>
      <PortalNav role={role} screen="settings" go={go} />
    </Screen>
  );
}
