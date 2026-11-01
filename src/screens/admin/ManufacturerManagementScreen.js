import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, EmptyState, StatusPill, CrudModal, CrudRowActions, ChoiceChips } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { adminCreateUser, adminDeleteUser, adminUpdateUser } from '../../services/adminCrudService';
import { subscribeManufacturers } from '../../services/dashboardService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

const blank = { fullName: '', email: '', organizationName: '', accountStatus: 'active' };

export default function ManufacturerManagementScreen({ go }) {
  const [manufacturers, setManufacturers] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeManufacturers(setManufacturers, (e) => setError(friendlyFirebaseError(e))), []);

  const openCreate = () => { setEditing(null); setForm({ ...blank }); };
  const openEdit = (user) => {
    setEditing(user);
    setForm({
      fullName: user.fullName || '',
      email: user.email || '',
      organizationName: user.organizationName || '',
      accountStatus: user.accountStatus || 'active',
    });
  };

  const save = async () => {
    if (!String(form?.fullName ?? '').trim()) return Alert.alert('Contact name required', 'Enter the manufacturer contact name.');
    if (!String(form?.organizationName ?? '').trim()) return Alert.alert('Organisation required', 'Manufacturer organisation name cannot be blank.');
    setBusy(true);
    try {
      if (editing) {
        await adminUpdateUser(editing.uid, {
          fullName: form.fullName,
          email: form.email,
          organizationName: form.organizationName,
          role: 'manufacturer',
          accountStatus: form.accountStatus,
        }, editing.id || editing.uid);
        Alert.alert('Manufacturer updated', 'Manufacturer details were saved.');
      } else {
        const result = await adminCreateUser({
          fullName: form.fullName,
          email: form.email,
          role: 'manufacturer',
          organizationName: form.organizationName,
        });
        Alert.alert('Manufacturer created', result.setupEmailSent ? `The account for ${result.email} was created and a password setup link was sent.` : `The account for ${result.email} was created. Send a password reset link from Users & Roles to finish setup.`);
      }
      setEditing(null);
      setForm(null);
    } catch (e) {
      Alert.alert(editing ? 'Update failed' : 'Create failed', friendlyFirebaseError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (user) => Alert.alert(
    'Remove manufacturer account?',
    'This removes Product Trust access for this manufacturer.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove account', style: 'destructive', onPress: () => adminDeleteUser(user.uid, user.id || user.uid).catch((e) => Alert.alert('Remove failed', friendlyFirebaseError(e))) },
    ],
  );

  return (
    <Screen>
      <TopBar title="Manufacturers" onBack={() => go('back')} right={<TouchableOpacity onPress={openCreate} style={styles.iconButton}><Icon name="person-add-outline" /></TouchableOpacity>} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!manufacturers.length ? <EmptyState icon="business-outline" title="No manufacturers" text="Create the first manufacturer account." action="Add Manufacturer" onAction={openCreate} /> : manufacturers.map((user) => (
          <View key={user.uid || user.id} style={styles.listRow}>
            <View style={[styles.avatarSmall, { backgroundColor: C.purpleBg }]}><Icon name="business-outline" size={18} color={C.purple} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{user.organizationName || user.fullName || 'Manufacturer'}</Text>
              <Text style={styles.rowSub}>{user.email || 'No email'}</Text>
              <Text style={styles.smallSoft}>{user.fullName || 'No contact name'}</Text>
            </View>
            <StatusPill text={user.accountStatus === 'disabled' ? 'Disabled' : 'Active'} color={user.accountStatus === 'disabled' ? C.danger : C.primary} bg={user.accountStatus === 'disabled' ? C.dangerBg : C.primaryBg} />
            <CrudRowActions onEdit={() => openEdit(user)} onDelete={() => remove(user)} />
          </View>
        ))}
      </ScrollView>

      <CrudModal visible={!!form} title={editing ? 'Edit Manufacturer' : 'Create Manufacturer'} onClose={() => !busy && (setEditing(null), setForm(null))}>
        <Input label="Contact name *" value={form?.fullName || ''} onChangeText={(v) => setForm((old) => ({ ...old, fullName: v }))} autoCapitalize="words" />
        <Input label={editing ? 'Email' : 'Email *'} value={form?.email || ''} onChangeText={(v) => setForm((old) => ({ ...old, email: v }))} keyboardType="email-address" autoCapitalize="none" editable={!editing} />
        <Input label="Organisation name *" value={form?.organizationName || ''} onChangeText={(v) => setForm((old) => ({ ...old, organizationName: v }))} autoCapitalize="words" />
        {editing ? <><Text style={styles.fieldLabel}>Account status</Text><ChoiceChips value={form?.accountStatus || 'active'} options={[{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' }]} onChange={(v) => setForm((old) => ({ ...old, accountStatus: v }))} /></> : null}
        <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save Manufacturer' : 'Create Manufacturer'} onPress={save} disabled={busy} />
      </CrudModal>
      <PortalNav role="admin" screen="admin" go={go} />
    </Screen>
  );
}
