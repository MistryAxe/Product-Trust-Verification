import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { Icon, Screen, TopBar, PrimaryButton, Input, LoadingBlock, EmptyState, ProductThumb, CrudModal, CrudRowActions, RestorableScrollView } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { deleteManufacturerProduct, setManufacturerProductActive, subscribeManufacturerProducts, updateManufacturerProduct } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function ManufacturerProductsScreen({ uid, go }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeManufacturerProducts(uid, (rows) => { setProducts(rows); setLoading(false); }, (e) => { setError(friendlyFirebaseError(e)); setLoading(false); }), [uid]);

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      name: product.name || '', brand: product.brand || '', category: product.category || '',
      description: product.description || '', model: product.model || '', partNumber: product.partNumber || '',
      sku: product.sku || '', country: product.country || '', netContent: product.netContent || '',
      warranty: product.warranty || '', ratedVoltage: product.ratedVoltage || '', ratedCurrent: product.ratedCurrent || '',
      ratedPower: product.ratedPower || '', frequency: product.frequency || '', ipRating: product.ipRating || '',
      certificationMarks: product.certificationMarks || '', active: product.active !== false,
    });
  };

  const save = async () => {
    if (!editing || !form) return;
    if (!String(form.name ?? '').trim()) return Alert.alert('Product name required', 'Enter the product name.');
    setBusy(true);
    try {
      await updateManufacturerProduct(uid, editing.id, form);
      setEditing(null); setForm(null);
      Alert.alert('Product updated', 'The product record was updated successfully.');
    } catch (e) { Alert.alert('Unable to update product', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };

  const remove = (product) => Alert.alert('Delete product permanently?', 'This removes the product and its operational batches, recalls and serials. Historical scans and reports remain as audit evidence.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => deleteManufacturerProduct(uid, product.id).catch((e) => Alert.alert('Delete failed', friendlyFirebaseError(e))) },
  ]);

  return (
    <Screen>
      <TopBar title="Manufacturer Products" onBack={() => go('back')} right={<TouchableOpacity onPress={() => go('manufacturerAddProduct')} style={styles.iconButton}><Icon name="add" /></TouchableOpacity>} />
      {loading ? <LoadingBlock /> : (
        <RestorableScrollView screenKey="manufacturerProducts" contentContainerStyle={styles.pagePad}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!products.length ? <EmptyState icon="cube-outline" title="No products" text="Your organisation has not registered any products yet." action="Register Product" onAction={() => go('manufacturerAddProduct')} /> : products.map((product) => (
            <View key={product.id} style={styles.listRow}>
              <ProductThumb imageUrl={product.imageUrl || product.packagingReferenceUrl || ''} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{product.name}</Text>
                <Text style={styles.rowSub}>{product.brand || product.category || 'Uncategorised'}</Text>
                <Text style={styles.smallSoft}>{product.barcode || 'No barcode'}</Text>
              </View>
              <Switch value={product.active !== false} onValueChange={() => setManufacturerProductActive(uid, product.id, product.active === false).catch((e) => Alert.alert('Update failed', friendlyFirebaseError(e)))} />
              <CrudRowActions onEdit={() => openEdit(product)} onDelete={() => remove(product)} />
            </View>
          ))}
        </RestorableScrollView>
      )}

      <CrudModal visible={!!form} title="Edit Product" onClose={() => !busy && (setEditing(null), setForm(null))}>
        <Input label="Product name *" value={form?.name || ''} onChangeText={(v) => setForm((old) => ({ ...old, name: v }))} autoCapitalize="words" />
        <Input label="Brand" value={form?.brand || ''} onChangeText={(v) => setForm((old) => ({ ...old, brand: v }))} autoCapitalize="words" />
        <Input label="Category" value={form?.category || ''} onChangeText={(v) => setForm((old) => ({ ...old, category: v }))} autoCapitalize="words" />
        <Input label="Description" value={form?.description || ''} onChangeText={(v) => setForm((old) => ({ ...old, description: v }))} multiline />
        <Input label="Country of origin" value={form?.country || ''} onChangeText={(v) => setForm((old) => ({ ...old, country: v }))} />
        <Input label="Net content / size" value={form?.netContent || ''} onChangeText={(v) => setForm((old) => ({ ...old, netContent: v }))} />
        <Input label="Model" value={form?.model || ''} onChangeText={(v) => setForm((old) => ({ ...old, model: v }))} />
        <Input label="Part number" value={form?.partNumber || ''} onChangeText={(v) => setForm((old) => ({ ...old, partNumber: v }))} />
        <Input label="SKU" value={form?.sku || ''} onChangeText={(v) => setForm((old) => ({ ...old, sku: v }))} />
        <Input label="Warranty" value={form?.warranty || ''} onChangeText={(v) => setForm((old) => ({ ...old, warranty: v }))} />
        <Input label="Rated voltage" value={form?.ratedVoltage || ''} onChangeText={(v) => setForm((old) => ({ ...old, ratedVoltage: v }))} />
        <Input label="Rated current" value={form?.ratedCurrent || ''} onChangeText={(v) => setForm((old) => ({ ...old, ratedCurrent: v }))} />
        <Input label="Rated power" value={form?.ratedPower || ''} onChangeText={(v) => setForm((old) => ({ ...old, ratedPower: v }))} />
        <Input label="Frequency" value={form?.frequency || ''} onChangeText={(v) => setForm((old) => ({ ...old, frequency: v }))} />
        <Input label="IP rating" value={form?.ipRating || ''} onChangeText={(v) => setForm((old) => ({ ...old, ipRating: v }))} />
        <Input label="Certification marks" value={form?.certificationMarks || ''} onChangeText={(v) => setForm((old) => ({ ...old, certificationMarks: v }))} />
        <View style={styles.crudSwitchRow}><Text style={styles.bodyStrong}>Product active</Text><Switch value={!!form?.active} onValueChange={(v) => setForm((old) => ({ ...old, active: v }))} /></View>
        <PrimaryButton title={busy ? 'Saving…' : 'Save Product'} onPress={save} disabled={busy} />
      </CrudModal>
      <PortalNav role="manufacturer" screen="manufacturerProducts" go={go} />
    </Screen>
  );
}
