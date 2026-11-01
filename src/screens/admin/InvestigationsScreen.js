import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, LoadingBlock, EmptyState, StatusPill, CrudModal, ChoiceChips, CrudProductPicker, RestorableScrollView } from '../../components/common';
import { dateLabel, investigationLabel } from '../../utils/display';
import { adminCreateInvestigation } from '../../services/adminCrudService';
import { subscribeAllProducts } from '../../services/dashboardService';
import { subscribeInvestigations } from '../../services/reportService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
export default function InvestigationsScreen({ profile, go, openInvestigation, openDocument }) {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeInvestigations(profile, (rows) => { setItems(rows); setLoading(false); }, () => setLoading(false)), [profile]);
  useEffect(() => {
    if (profile?.role !== 'admin') return undefined;
    return subscribeAllProducts(setProducts, () => {});
  }, [profile?.role]);

  const createCase = async () => {
    if (!form?.reason?.trim()) return Alert.alert('Reason required', 'Enter why the admin investigation is being opened.');
    const product = products.find((p) => p.id === form.productId);
    setBusy(true);
    try {
      await adminCreateInvestigation({
        productId: product?.id || '', productName: product?.name || 'Unregistered product',
        barcode: product?.barcode || '', manufacturerId: product?.manufacturerId || '',
        reason: form.reason, details: form.details, priority: form.priority || 'normal',
      });
      setForm(null);
    } catch (e) { Alert.alert('Unable to create investigation', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Screen>
      <TopBar
        title="Investigations"
        onBack={() => go(profile.role === 'admin' ? 'admin' : 'manufacturer')}
        right={profile.role === 'admin' ? <TouchableOpacity onPress={() => setForm({ productId: products[0]?.id || '', reason: '', details: '', priority: 'normal' })} style={styles.iconButton}><Icon name="add" /></TouchableOpacity> : null}
      />
      {loading ? <LoadingBlock /> : (
        <RestorableScrollView screenKey="investigations" contentContainerStyle={styles.pagePad}>
          {items.length ? <TouchableOpacity style={styles.statusOption} onPress={() => openDocument('reports', items, profile.role === 'manufacturer' ? 'Manufacturer Product Cases' : 'Product Trust Investigations')}><View style={{ flex: 1 }}><Text style={styles.statusOptionText}>View Cases Report</Text><Text style={styles.rowSub}>{profile.role === 'manufacturer' ? 'Export cases linked to your registered products' : 'Export the current investigation list'}</Text></View><Icon name="document-text-outline" color={C.cyan} /></TouchableOpacity> : null}
          {!items.length ? <EmptyState title="No investigations" text="Customer reports create investigation records automatically. Admin can also open a case manually." action={profile.role === 'admin' ? 'Create Investigation' : undefined} onAction={() => setForm({ productId: products[0]?.id || '', reason: '', details: '', priority: 'normal' })} /> : items.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => openInvestigation(item)} style={styles.caseCard}>
              <View style={styles.caseTop}><View style={{ flex: 1, gap: 2 }}><Text style={styles.rowTitle}>{item.productName || 'Unregistered product'}</Text><Text style={styles.rowSub}>Ref: {item.reportId || item.id}</Text></View><StatusPill text={investigationLabel(item.status)} /></View>
              <Text style={styles.body}>{item.reason}</Text>
              <Text style={styles.rowSub}>{item.source === 'admin' ? 'Admin-created case' : item.area || 'No area'} • {dateLabel(item.createdAt)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="images-outline" size={15} color={item.evidenceCount ? C.primary : C.textFaint} /><Text style={styles.rowSub}>{item.evidenceCount || 0} photo{item.evidenceCount === 1 ? '' : 's'}</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="map-outline" size={15} color={item.onMap ? C.primary : C.textFaint} /><Text style={styles.rowSub}>{item.onMap ? 'On the map' : 'Not on the map'}</Text></View>
                {item.source !== 'admin' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="business-outline" size={15} color={item.manufacturerResponse ? C.cyan : C.textFaint} /><Text style={styles.rowSub}>{item.manufacturerResponse ? 'Manufacturer replied' : item.manufacturerId ? 'Awaiting manufacturer' : 'No manufacturer linked'}</Text></View> : null}
              </View>
            </TouchableOpacity>
          ))}
        </RestorableScrollView>
      )}
      <CrudModal visible={!!form} title="Create Investigation" onClose={() => !busy && setForm(null)}>
        <CrudProductPicker products={products} value={form?.productId || ''} onChange={(v) => setForm((old) => ({ ...old, productId: v }))} />
        <Input label="Reason *" value={form?.reason || ''} onChangeText={(v) => setForm((old) => ({ ...old, reason: v }))} multiline />
        <Input label="Admin notes" value={form?.details || ''} onChangeText={(v) => setForm((old) => ({ ...old, details: v }))} multiline />
        <Text style={styles.fieldLabel}>Priority</Text><ChoiceChips value={form?.priority || 'normal'} options={['low', 'normal', 'high']} onChange={(v) => setForm((old) => ({ ...old, priority: v }))} />
        <PrimaryButton title={busy ? 'Creating…' : 'Create Investigation'} onPress={createCase} disabled={busy} />
      </CrudModal>
      <PortalNav role={profile.role} screen="investigations" go={go} />
    </Screen>
  );
}
