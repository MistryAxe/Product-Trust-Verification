import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, EmptyState, InfoRow, CrudModal, CrudRowActions, ChoiceChips, CrudProductPicker } from '../../components/common';
import { adminCreateSerial, adminDeleteSerial, adminUpdateSerial, subscribeAllSerials } from '../../services/adminCrudService';
import { subscribeAllProducts } from '../../services/dashboardService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function SerialManagementScreen({ go }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const a = subscribeAllProducts(setProducts, () => {}); const b = subscribeAllSerials(setItems, () => {}); return () => { a?.(); b?.(); }; }, []);
  const productName = (id) => products.find((p) => p.id === id)?.name || 'Unknown product';
  const save = async () => {
    const product = products.find((p) => p.id === form?.productId);
    if (!product) return Alert.alert('Product required', 'Choose a product.');
    setBusy(true);
    try {
      if (editing) await adminUpdateSerial(editing.id, { status: form.status });
      else await adminCreateSerial({ manufacturerId: product.manufacturerId, productId: product.id, serialNumber: form.serialNumber, status: form.status });
      setEditing(null); setForm(null);
    } catch (e) { Alert.alert('Unable to save serial', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar title="Serial CRUD" onBack={() => go('back')} right={<TouchableOpacity onPress={() => setForm({ productId: products[0]?.id || '', serialNumber: '', status: 'active' })} style={styles.iconButton}><Icon name="add" /></TouchableOpacity>} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
        {!items.length ? <EmptyState icon="qr-code-outline" title="No serials" text="No individual serials have been registered." /> : items.map((item) => <View key={item.id} style={styles.listRow}><View style={styles.avatarSmall}><Icon name="qr-code-outline" size={18} color={C.primary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.serialNumber || item.id}</Text><Text style={styles.rowSub}>{productName(item.productId)}</Text><Text style={styles.smallSoft}>{item.status || 'active'}</Text></View><CrudRowActions onEdit={() => { setEditing(item); setForm({ productId: item.productId, serialNumber: item.serialNumber || item.id, status: item.status || 'active' }); }} onDelete={() => Alert.alert('Delete serial?', item.serialNumber || item.id, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => adminDeleteSerial(item.id).catch((e) => Alert.alert('Failed', friendlyFirebaseError(e))) }])} /></View>)}
      </ScrollView>
      <CrudModal visible={!!form} title={editing ? 'Edit Serial' : 'Create Serial'} onClose={() => !busy && (setForm(null), setEditing(null))}>
        {!editing ? <CrudProductPicker products={products} value={form?.productId || ''} onChange={(v) => setForm((old) => ({ ...old, productId: v }))} /> : <InfoRow label="Product" value={productName(form?.productId)} />}
        <Input label="Serial number *" value={form?.serialNumber || ''} editable={!editing} onChangeText={(v) => setForm((old) => ({ ...old, serialNumber: v }))} autoCapitalize="characters" />
        <Text style={styles.fieldLabel}>Status</Text><ChoiceChips value={form?.status || 'active'} options={['active', 'inactive']} onChange={(v) => setForm((old) => ({ ...old, status: v }))} />
        <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save Serial' : 'Create Serial'} onPress={save} disabled={busy} />
      </CrudModal>
      <PortalNav role="admin" screen="adminSerials" go={go} />
    </Screen>
  );
}
