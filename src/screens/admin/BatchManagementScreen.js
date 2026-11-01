import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, EmptyState, InfoRow, CrudModal, CrudRowActions, ChoiceChips, CrudProductPicker } from '../../components/common';
import { adminCreateBatch, adminDeleteBatch, adminUpdateBatch, subscribeAllBatches } from '../../services/adminCrudService';
import { subscribeAllProducts } from '../../services/dashboardService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function BatchManagementScreen({ go }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const a = subscribeAllProducts(setProducts, () => {}); const b = subscribeAllBatches(setItems, () => {}); return () => { a?.(); b?.(); }; }, []);
  const productName = (id) => products.find((p) => p.id === id)?.name || 'Unknown product';
  const openCreate = () => { setEditing(null); setForm({ productId: products[0]?.id || '', batchNumber: '', manufactureDate: '', expiryDate: '', status: 'active' }); };
  const save = async () => {
    const product = products.find((p) => p.id === form.productId);
    if (!product) return Alert.alert('Product required', 'Choose a registered product.');
    setBusy(true);
    try {
      if (editing) await adminUpdateBatch(editing.id, form);
      else await adminCreateBatch({ ...form, manufacturerId: product.manufacturerId });
      setEditing(null); setForm(null);
    } catch (e) { Alert.alert('Unable to save batch', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };
  const activeForm = form !== null;
  return (
    <Screen>
      <TopBar title="Batch CRUD" onBack={() => go('back')} right={<TouchableOpacity onPress={openCreate} style={styles.iconButton}><Icon name="add" /></TouchableOpacity>} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
        {!items.length ? <EmptyState icon="layers-outline" title="No batches" text="No product batches are registered." action="Create Batch" onAction={openCreate} /> : items.map((item) => (
          <View key={item.id} style={styles.listRow}><View style={styles.avatarSmall}><Icon name="layers-outline" size={18} color={C.primary} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.batchNumber}</Text><Text style={styles.rowSub}>{productName(item.productId)}</Text><Text style={styles.smallSoft}>EXP {item.expiryDate || 'Not supplied'} • {item.status || 'active'}</Text></View><CrudRowActions onEdit={() => { setEditing(item); setForm({ productId: item.productId, batchNumber: item.batchNumber || '', manufactureDate: item.manufactureDate || '', expiryDate: item.expiryDate || '', status: item.status || 'active' }); }} onDelete={() => Alert.alert('Delete batch?', item.batchNumber, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => adminDeleteBatch(item.id).catch((e) => Alert.alert('Failed', friendlyFirebaseError(e))) }])} /></View>
        ))}
      </ScrollView>
      <CrudModal visible={activeForm} title={editing ? 'Edit Batch' : 'Create Batch'} onClose={() => !busy && setForm(null)}>
        {!editing ? <CrudProductPicker products={products} value={form?.productId || ''} onChange={(v) => setForm((old) => ({ ...old, productId: v }))} /> : <InfoRow label="Product" value={productName(form?.productId)} />}
        <Input label="Batch number *" value={form?.batchNumber || ''} onChangeText={(v) => setForm((old) => ({ ...old, batchNumber: v }))} autoCapitalize="characters" />
        <Input label="Manufacture date" placeholder="YYYY-MM-DD" value={form?.manufactureDate || ''} onChangeText={(v) => setForm((old) => ({ ...old, manufactureDate: v }))} />
        <Input label="Expiry date" placeholder="YYYY-MM-DD" value={form?.expiryDate || ''} onChangeText={(v) => setForm((old) => ({ ...old, expiryDate: v }))} />
        <Text style={styles.fieldLabel}>Status</Text><ChoiceChips value={form?.status || 'active'} options={['active', 'inactive']} onChange={(v) => setForm((old) => ({ ...old, status: v }))} />
        <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save Batch' : 'Create Batch'} onPress={save} disabled={busy} />
      </CrudModal>
      <PortalNav role="admin" screen="adminBatches" go={go} />
    </Screen>
  );
}
