import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, EmptyState, InfoRow, CrudModal, CrudRowActions, CrudProductPicker } from '../../components/common';
import { adminCreateRecall, adminDeleteRecall, adminUpdateRecall, subscribeAllRecalls } from '../../services/adminCrudService';
import { subscribeAllProducts } from '../../services/dashboardService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function RecallManagementScreen({ go }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const a = subscribeAllProducts(setProducts, () => {}); const b = subscribeAllRecalls(setItems, () => {}); return () => { a?.(); b?.(); }; }, []);
  const productName = (id) => products.find((p) => p.id === id)?.name || 'Unknown product';
  const openCreate = () => setForm({ productId: products[0]?.id || '', batchNumber: '', reason: '', recommendation: '', active: true });
  const save = async () => {
    const product = products.find((p) => p.id === form?.productId);
    if (!product) return Alert.alert('Product required', 'Choose a registered product.');
    setBusy(true);
    try {
      if (editing) await adminUpdateRecall(editing.id, form);
      else await adminCreateRecall({ ...form, manufacturerId: product.manufacturerId, productName: product.name });
      setEditing(null); setForm(null);
    } catch (e) { Alert.alert('Unable to save recall', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };
  return (
    <Screen>
      <TopBar title="Recall CRUD" onBack={() => go('back')} right={<TouchableOpacity onPress={openCreate} style={styles.iconButton}><Icon name="add" /></TouchableOpacity>} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
        {!items.length ? <EmptyState icon="warning-outline" title="No recalls" text="No recall records exist." action="Create Recall" onAction={openCreate} /> : items.map((item) => (
          <View key={item.id} style={styles.listRow}><View style={[styles.avatarSmall, { backgroundColor: C.dangerBg }]}><Icon name="warning-outline" size={18} color={C.danger} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.productName || productName(item.productId)}</Text><Text style={styles.rowSub}>{item.reason || 'No reason'}</Text><Text style={styles.smallSoft}>{item.batchNumber ? `Batch ${item.batchNumber}` : 'Entire product'} • {item.active ? 'Active' : 'Closed'}</Text></View><CrudRowActions onEdit={() => { setEditing(item); setForm({ productId: item.productId, batchNumber: item.batchNumber || '', reason: item.reason || '', recommendation: item.recommendation || '', active: item.active !== false }); }} onDelete={() => Alert.alert('Delete recall?', 'This permanently removes the recall record.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => adminDeleteRecall(item.id).catch((e) => Alert.alert('Failed', friendlyFirebaseError(e))) }])} /></View>
        ))}
      </ScrollView>
      <CrudModal visible={!!form} title={editing ? 'Edit Recall' : 'Create Recall'} onClose={() => !busy && (setForm(null), setEditing(null))}>
        {!editing ? <CrudProductPicker products={products} value={form?.productId || ''} onChange={(v) => setForm((old) => ({ ...old, productId: v }))} /> : <InfoRow label="Product" value={productName(form?.productId)} />}
        <Input label="Affected batch" value={form?.batchNumber || ''} onChangeText={(v) => setForm((old) => ({ ...old, batchNumber: v }))} autoCapitalize="characters" />
        <Input label="Reason *" value={form?.reason || ''} onChangeText={(v) => setForm((old) => ({ ...old, reason: v }))} multiline />
        <Input label="Recommendation" value={form?.recommendation || ''} onChangeText={(v) => setForm((old) => ({ ...old, recommendation: v }))} multiline />
        <View style={styles.crudSwitchRow}><Text style={styles.bodyStrong}>Recall active</Text><Switch value={!!form?.active} onValueChange={(v) => setForm((old) => ({ ...old, active: v }))} /></View>
        <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save Recall' : 'Create Recall'} onPress={save} disabled={busy} color={C.danger} />
      </CrudModal>
      <PortalNav role="admin" screen="adminRecalls" go={go} />
    </Screen>
  );
}
