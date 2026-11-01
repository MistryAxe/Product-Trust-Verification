import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, EmptyState, CrudModal, CrudRowActions, ChoiceChips, CrudProductPicker } from '../../components/common';
import { createBatch, deleteManufacturerBatch, subscribeManufacturerBatches, subscribeManufacturerProducts, updateManufacturerBatch } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function BatchManagementScreen({ uid, go }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const a = subscribeManufacturerProducts(uid, setProducts, () => {}); const b = subscribeManufacturerBatches(uid, setItems, () => {}); return () => { a?.(); b?.(); }; }, [uid]);
  const productName = (id) => products.find((p) => p.id === id)?.name || 'Product';
  const openCreate = () => { setEditing(null); setForm({ productId: products[0]?.id || '', batchNumber: '', manufactureDate: '', expiryDate: '', status: 'active' }); };
  const save = async () => {
    if (!form?.productId) return Alert.alert('Product required', 'Choose a product.');
    if (!String(form?.batchNumber ?? '').trim()) return Alert.alert('Batch required', 'Enter the batch number.');
    setBusy(true);
    try {
      if (editing) await updateManufacturerBatch(uid, editing.id, form);
      else await createBatch(uid, form);
      setEditing(null); setForm(null);
    } catch (e) { Alert.alert('Unable to save batch', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };
  return <Screen>
    <TopBar title="Batch Management" onBack={() => go('back')} right={<TouchableOpacity onPress={openCreate} style={styles.iconButton}><Icon name="add" /></TouchableOpacity>} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
      {!items.length ? <EmptyState icon="layers-outline" title="No batches" text="Register a batch for one of your products." action="Add Batch" onAction={openCreate} /> : items.map((item) => <View key={item.id} style={styles.listRow}>
        <View style={styles.avatarSmall}><Icon name="layers-outline" size={18} color={C.primary} /></View>
        <View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.batchNumber}</Text><Text style={styles.rowSub}>{productName(item.productId)}</Text><Text style={styles.smallSoft}>{item.expiryDate ? `EXP ${item.expiryDate}` : item.status || 'active'}</Text></View>
        <CrudRowActions onEdit={() => { setEditing(item); setForm({ productId: item.productId, batchNumber: item.batchNumber || '', manufactureDate: item.manufactureDate || '', expiryDate: item.expiryDate || '', status: item.status || 'active' }); }} onDelete={() => Alert.alert('Delete batch?', item.batchNumber || 'Batch', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteManufacturerBatch(uid, item.id).catch((e) => Alert.alert('Delete failed', friendlyFirebaseError(e))) }])} />
      </View>)}
    </ScrollView>
    <CrudModal visible={!!form} title={editing ? 'Edit Batch' : 'Create Batch'} onClose={() => !busy && (setForm(null), setEditing(null))}>
      {!editing ? <CrudProductPicker products={products} value={form?.productId || ''} onChange={(v) => setForm((old) => ({ ...old, productId: v }))} /> : <Text style={styles.bodyStrong}>{productName(form?.productId)}</Text>}
      <Input label="Batch number *" value={form?.batchNumber || ''} onChangeText={(v) => setForm((old) => ({ ...old, batchNumber: v }))} autoCapitalize="characters" />
      <Input label="Manufacture date" placeholder="YYYY-MM-DD" value={form?.manufactureDate || ''} onChangeText={(v) => setForm((old) => ({ ...old, manufactureDate: v }))} />
      <Input label="Expiry date" placeholder="YYYY-MM-DD" value={form?.expiryDate || ''} onChangeText={(v) => setForm((old) => ({ ...old, expiryDate: v }))} />
      <Text style={styles.fieldLabel}>Status</Text><ChoiceChips value={form?.status || 'active'} options={['active', 'inactive']} onChange={(v) => setForm((old) => ({ ...old, status: v }))} />
      <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save Batch' : 'Create Batch'} onPress={save} disabled={busy} />
    </CrudModal>
        <PortalNav role="manufacturer" screen="manufacturerAddBatch" go={go} />
</Screen>;
}
