import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, SecondaryButton, Input, EmptyState, StatusPill, CrudModal, CrudRowActions, ChoiceChips, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { adminCreateUser, adminDeleteUser, adminSendPasswordReset, adminUpdateUser } from '../../services/adminCrudService';
import { subscribeUsers } from '../../services/userService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function UserManagementScreen({ go, currentUid }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeUsers(setUsers, (e) => setError(friendlyFirebaseError(e))), []);

  const openCreate = () => {
    setEditing(null);
    setForm({ fullName: '', email: '', role: 'customer', organizationName: '', accountStatus: 'active' });
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || 'customer',
      organizationName: user.organizationName || '',
      accountStatus: user.accountStatus || 'active',
    });
  };

  const save = async () => {
    if (!form) return;
    if (!String(form.fullName ?? '').trim()) return Alert.alert('Full name required', 'Enter the user’s full name.');
    if (form.role === 'manufacturer' && !String(form.organizationName ?? '').trim()) return Alert.alert('Organisation required', 'Enter the manufacturer organisation name.');
    if (editing?.uid === currentUid && (form.role !== 'admin' || form.accountStatus === 'disabled')) {
      return Alert.alert('Current admin protected', 'You cannot remove your own administrator access or disable your own account here.');
    }

    setBusy(true);
    try {
      if (editing) {
        await adminUpdateUser(editing.uid, {
          fullName: form.fullName,
          email: form.email,
          organizationName: form.organizationName,
          role: form.role,
          accountStatus: form.accountStatus,
        }, editing.id || editing.uid);
        Alert.alert('User updated', 'Account details and access were updated successfully.');
      } else {
        const result = await adminCreateUser(form);
        Alert.alert('Account created', result.setupEmailSent ? `The account for ${result.email} was created and a password setup link was sent.` : `The account for ${result.email} was created. Use Send Password Reset Link on the account card to finish setup.`);
      }
      setForm(null);
      setEditing(null);
    } catch (e) {
      Alert.alert(editing ? 'Unable to update user' : 'Unable to create user', friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (user) => {
    if (user.uid === currentUid) return Alert.alert('Current admin protected', 'Manage your own account from Settings.');
    const extra = user.role === 'manufacturer'
      ? ' This also removes that manufacturer’s registered products, batches, recalls and serial records.'
      : '';
    Alert.alert(
      'Remove account?',
      `This removes this account from Product Trust access.${extra}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove account',
          style: 'destructive',
          onPress: async () => {
            try {
              setBusy(true);
              const result = await adminDeleteUser(user.uid, user.id || user.uid);
              Alert.alert('Account removed', result?.method === 'server' ? 'The account was permanently removed.' : 'Product Trust access was removed.');
            } catch (e) {
              Alert.alert('Unable to delete account', friendlyFirebaseError(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const sendReset = async (user) => {
    if (!user?.email) return Alert.alert('No email', 'This user does not have a valid email address.');
    try {
      await adminSendPasswordReset(user.email);
      Alert.alert('Reset email sent', `A password reset email was requested for ${user.email}.`);
    } catch (e) {
      Alert.alert('Unable to send reset email', friendlyFirebaseError(e));
    }
  };

  return (
    <Screen>
      <TopBar title="Users & Roles" onBack={() => go('back')} right={<TouchableOpacity onPress={openCreate} style={styles.iconButton}><Icon name="person-add-outline" /></TouchableOpacity>} />
      <RestorableScrollView screenKey="adminUsers" contentContainerStyle={styles.pagePad}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!users.length ? <EmptyState icon="people-outline" title="No users" text="User accounts will appear here." action="Add User" onAction={openCreate} /> : users.map((user) => {
          const disabled = user.accountStatus === 'disabled';
          return (
            <View key={user.uid || user.id} style={styles.caseCard}>
              <View style={styles.caseTop}>
                <View style={[styles.avatar, { width: 54, height: 54 }]}><Text style={styles.avatarText}>{(user.fullName || user.email || '?')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{user.fullName || 'Unnamed account'}</Text>
                  <Text style={styles.rowSub}>{user.email || 'No email'}</Text>
                  <View style={styles.tagWrap}>
                    <StatusPill text={user.role || 'customer'} color={user.role === 'admin' ? C.danger : user.role === 'manufacturer' ? C.purple : C.primary} bg={user.role === 'admin' ? C.dangerBg : user.role === 'manufacturer' ? C.purpleBg : C.primaryBg} />
                    <StatusPill text={disabled ? 'Disabled' : 'Active'} color={disabled ? C.danger : C.success} bg={disabled ? C.dangerBg : C.successBg} />
                  </View>
                </View>
                <CrudRowActions onEdit={() => openEdit(user)} onDelete={user.uid === currentUid ? null : () => remove(user)} />
              </View>
              <SecondaryButton title="Send Password Reset Link" icon="mail-outline" color={C.cyan} onPress={() => sendReset(user)} />
            </View>
          );
        })}
      </RestorableScrollView>

      <CrudModal visible={!!form} title={editing ? 'Edit User' : 'Create User'} onClose={() => !busy && (setForm(null), setEditing(null))}>
        <Input label="Full name *" value={form?.fullName || ''} onChangeText={(v) => setForm((old) => ({ ...old, fullName: v }))} autoCapitalize="words" />
        <Input label={editing ? 'Email' : 'Email *'} value={form?.email || ''} onChangeText={(v) => setForm((old) => ({ ...old, email: v }))} keyboardType="email-address" autoCapitalize="none" editable={!editing} />
        <Text style={styles.fieldLabel}>Role</Text>
        <ChoiceChips value={form?.role || 'customer'} options={[{ value: 'customer', label: 'Customer' }, { value: 'manufacturer', label: 'Manufacturer' }, { value: 'admin', label: 'Admin' }]} onChange={(v) => setForm((old) => ({ ...old, role: v }))} />
        {form?.role === 'manufacturer' ? <Input label="Organisation name *" value={form?.organizationName || ''} onChangeText={(v) => setForm((old) => ({ ...old, organizationName: v }))} autoCapitalize="words" /> : null}
        {editing ? <><Text style={styles.fieldLabel}>Account status</Text><ChoiceChips value={form?.accountStatus || 'active'} options={[{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }]} onChange={(v) => setForm((old) => ({ ...old, accountStatus: v }))} /></> : null}
        <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save User' : 'Create Account'} onPress={save} disabled={busy} icon={editing ? 'save-outline' : 'person-add-outline'} />
      </CrudModal>

      <PortalNav role="admin" screen="adminUsers" go={go} />
    </Screen>
  );
}
