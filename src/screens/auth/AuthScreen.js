import React, { useRef, useState } from 'react';
import { Alert, ImageBackground, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, PrimaryButton, Input, PasswordInput, PasswordChecklist } from '../../components/common';
import { loginWithEmail, registerAccount, resetPassword } from '../../services/authService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';
import { isStrongPassword, isValidEmail, passwordRequirementMessage } from '../../utils/validation';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';

export default function AuthScreen({ initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode);
  const [accountType, setAccountType] = useState('customer');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const submit = async () => {
    if (busy) return; // pressing Enter twice must not send the form twice
    if (!email.trim()) return Alert.alert('Email required', 'Enter your email address.');
    if (!isValidEmail(email)) return Alert.alert('Invalid email', 'Enter a valid email address such as name@example.com.');
    setBusy(true);
    try {
      if (mode === 'forgot') {
        await resetPassword(email);
        Alert.alert('Password reset email sent', 'A secure reset link has been sent. Open the email and choose your new password. Check spam or junk if it does not appear shortly.');
        setMode('login');
      } else if (mode === 'signup') {
        if (!fullName.trim()) throw new Error('Enter your full name.');
        if (accountType === 'manufacturer' && !organizationName.trim()) throw new Error('Enter your organisation or manufacturer name.');
        if (!isStrongPassword(password)) throw new Error(passwordRequirementMessage());
        if (password !== confirm) throw new Error('Passwords do not match.');
        await registerAccount({ fullName, email, password, accountType, organizationName });
      } else {
        if (!password) throw new Error('Enter your password.');
        await loginWithEmail(email, password);
      }
    } catch (error) {
      Alert.alert('Unable to continue', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset password' : 'Welcome back';
  const subtitle = mode === 'signup'
    ? 'Choose the account type that matches how you use Product Trust.'
    : mode === 'forgot'
      ? 'We will send a secure password reset email for this account.'
      : 'Sign in to continue to your Product Trust portal.';

  return (
    <Screen style={{ backgroundColor: C.dark }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.authScreenScroll}>
          <ImageBackground source={require('../../../assets/home-community.jpeg')} style={styles.authImageHero} imageStyle={styles.authImageHeroStyle}>
            <View style={styles.authImageShade} />
            <View style={styles.authImageTop}>
              {onBack ? (
                <TouchableOpacity style={styles.authGlassButton} onPress={onBack}><Icon name="arrow-back" size={19} color="#fff" /></TouchableOpacity>
              ) : <View />}
              <View style={styles.authMiniBrand}><Icon name="shield-checkmark" size={15} color={C.dark} /><Text style={styles.authMiniBrandText}>Product Trust</Text></View>
            </View>
          </ImageBackground>

          <View style={styles.authSheet}>
            <View style={styles.authSheetHandle} />
            <Text style={styles.authHeadline}>{title}</Text>
            <Text style={styles.authIntro}>{subtitle}</Text>

            {mode === 'signup' ? (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Choose your portal</Text>
                <View style={styles.accountTypeRow}>
                  <TouchableOpacity onPress={() => setAccountType('customer')} style={[styles.accountTypeCard, accountType === 'customer' && styles.accountTypeCardActive]}>
                    <View style={[styles.accountTypeIcon, accountType === 'customer' && styles.accountTypeIconActive]}><Icon name="person-outline" color={accountType === 'customer' ? C.dark : C.textSoft} /></View>
                    <Text style={styles.accountTypeTitle}>Customer</Text>
                    <Text style={styles.accountTypeText}>Scan, verify, compare and report products.</Text>
                    {accountType === 'customer' ? <Icon name="checkmark-circle" size={18} color={C.primary} /> : null}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setAccountType('manufacturer')} style={[styles.accountTypeCard, accountType === 'manufacturer' && styles.accountTypeCardActive]}>
                    <View style={[styles.accountTypeIcon, accountType === 'manufacturer' && styles.accountTypeIconActive]}><Icon name="business-outline" color={accountType === 'manufacturer' ? C.dark : C.textSoft} /></View>
                    <Text style={styles.accountTypeTitle}>Manufacturer</Text>
                    <Text style={styles.accountTypeText}>Manage products, batches, serials and recalls.</Text>
                    {accountType === 'manufacturer' ? <Icon name="checkmark-circle" size={18} color={C.primary} /> : null}
                  </TouchableOpacity>
                </View>
                <View style={styles.authRoleNotice}><Icon name="shield-checkmark-outline" size={17} color={C.primary} /><Text style={styles.noticeText}>Admin accounts cannot be created publicly.</Text></View>
                <Input label="Full name" placeholder="Your name" autoCapitalize="words" value={fullName} onChangeText={setFullName} />
                {accountType === 'manufacturer' ? <Input label="Organisation / manufacturer name" placeholder="Company name" autoCapitalize="words" value={organizationName} onChangeText={setOrganizationName} /> : null}
              </>
            ) : null}

            <Input label={mode === 'signup' && accountType === 'manufacturer' ? 'Business email' : 'Email'} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType={mode === 'forgot' ? 'send' : 'next'} onSubmitEditing={() => (mode === 'forgot' ? submit() : passwordRef.current?.focus())} value={email} onChangeText={setEmail} />
            {email && !isValidEmail(email) ? <Text style={styles.validationError}>Enter a valid email address.</Text> : null}
            {mode !== 'forgot' ? <PasswordInput ref={passwordRef} label="Password" placeholder="Password" returnKeyType={mode === 'signup' ? 'next' : 'go'} onSubmitEditing={() => (mode === 'signup' ? confirmRef.current?.focus() : submit())} value={password} onChangeText={setPassword} /> : null}
            {mode === 'signup' ? (
              <>
                <PasswordChecklist password={password} confirm={confirm} />
                <PasswordInput ref={confirmRef} label="Confirm password" placeholder="Repeat password" returnKeyType="go" onSubmitEditing={submit} value={confirm} onChangeText={setConfirm} />
              </>
            ) : null}

            <PrimaryButton title={busy ? 'Please wait…' : mode === 'signup' ? `Create ${accountType === 'manufacturer' ? 'Manufacturer' : 'Customer'} Account` : mode === 'forgot' ? 'Send Reset Email' : 'Sign In'} onPress={submit} disabled={busy} icon={mode === 'signup' ? 'arrow-forward' : mode === 'forgot' ? 'mail-outline' : 'log-in-outline'} />
            {mode === 'login' ? <GoogleSignInButton onBusy={setBusy} /> : null}
            {mode === 'login' ? <TouchableOpacity onPress={() => setMode('forgot')} style={styles.textButton}><Text style={styles.link}>Forgot password?</Text></TouchableOpacity> : null}
            <View style={styles.switchAuth}>
              <Text style={styles.bodySoft}>{mode === 'signup' ? 'Already have an account? ' : 'New here? '}</Text>
              <TouchableOpacity onPress={() => setMode(mode === 'signup' ? 'login' : 'signup')}><Text style={styles.link}>{mode === 'signup' ? 'Sign In' : 'Create account'}</Text></TouchableOpacity>
            </View>
            {mode === 'forgot' ? <TouchableOpacity onPress={() => setMode('login')} style={styles.textButton}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
