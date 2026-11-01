import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { C, styles } from '../../theme';
import { ChoiceChips, Icon, Screen, TopBar, PrimaryButton, Input, LoadingBlock, EmptyState, ProductThumb, StatusPill, InfoRow, CrudModal, CrudRowActions, CrudManufacturerPicker } from '../../components/common';
import { PortalNav } from '../../components/navigation';
import { adminDeleteProduct, adminUpdateProduct } from '../../services/adminCrudService';
import { subscribeAllProducts, subscribeManufacturers } from '../../services/dashboardService';
import { createManufacturerProduct } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

export default function ProductManagementScreen({ go }) {
  const [products, setProducts] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const blank = { name: '', brand: '', barcode: '', productClass: 'general', equipmentType: '', category: '', country: '', netContent: '', description: '', manufacturingPlaces: '', origins: '', authorisedRetailers: '', traceabilityCode: '', model: '', partNumber: '', sku: '', ratedVoltage: '', ratedCurrent: '', ratedPower: '', frequency: '', phase: '', speedRpm: '', pressureRating: '', capacity: '', ipRating: '', certificationMarks: '', warranty: '', active: true, manufacturerId: '' };
  const [form, setForm] = useState(blank);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    const a = subscribeAllProducts((rows) => { setProducts(rows); setLoading(false); }, (e) => { setError(friendlyFirebaseError(e)); setLoading(false); });
    const b = subscribeManufacturers(setManufacturers, (e) => setError(friendlyFirebaseError(e)));
    return () => { a?.(); b?.(); };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...blank, manufacturerId: manufacturers[0]?.uid || '' });
    setModal(true);
  };
  const openEdit = (product) => {
    setEditing(product);
    setForm({ ...blank, ...product, active: product.active !== false, manufacturerId: product.manufacturerId || manufacturers[0]?.uid || '' });
    setModal(true);
  };
  const save = async () => {
    if (!String(form.name ?? '').trim() || !String(form.barcode ?? '').trim()) return Alert.alert('Required fields', 'Product name and barcode are required.');
    const manufacturer = manufacturers.find((m) => m.uid === form.manufacturerId);
    if (!editing && !manufacturer) return Alert.alert('Manufacturer required', 'Choose a manufacturer account first.');
    setBusy(true);
    try {
      if (editing) {
        await adminUpdateProduct(editing.id, {
          name: form.name, brand: form.brand, barcode: form.barcode, productClass: form.productClass, equipmentType: form.equipmentType, category: form.category,
          country: form.country, netContent: form.netContent, description: form.description,
          manufacturingPlaces: form.manufacturingPlaces, origins: form.origins,
          authorisedRetailers: form.authorisedRetailers, traceabilityCode: form.traceabilityCode,
          model: form.model, partNumber: form.partNumber, sku: form.sku, ratedVoltage: form.ratedVoltage,
          ratedCurrent: form.ratedCurrent, ratedPower: form.ratedPower, frequency: form.frequency, phase: form.phase,
          speedRpm: form.speedRpm, pressureRating: form.pressureRating, capacity: form.capacity,
          ipRating: form.ipRating, certificationMarks: form.certificationMarks, warranty: form.warranty,
          active: form.active,
        });
      } else {
        await createManufacturerProduct(manufacturer.uid, manufacturer.organizationName || manufacturer.fullName || '', {
          name: form.name, brand: form.brand, barcode: form.barcode, productClass: form.productClass, equipmentType: form.equipmentType, category: form.category,
          country: form.country, marketCountries: '', manufacturingPlaces: form.manufacturingPlaces,
          origins: form.origins, authorisedRetailers: form.authorisedRetailers, traceabilityCode: form.traceabilityCode,
          netContent: form.netContent, servingSize: '', description: form.description,
          model: form.model, partNumber: form.partNumber, sku: form.sku, color: '', size: '', dimensions: '', weight: '', material: '', warranty: form.warranty,
          ratedVoltage: form.ratedVoltage, ratedCurrent: form.ratedCurrent, ratedPower: form.ratedPower, frequency: form.frequency, phase: form.phase,
          speedRpm: form.speedRpm, pressureRating: form.pressureRating, capacity: form.capacity, ipRating: form.ipRating, certificationMarks: form.certificationMarks,
          officialWebsite: '', officialProductUrl: '', packagingReferenceUrl: '', packagingDescription: '', securityFeatures: '',
          ingredientsText: '', allergens: [], nutritionGrade: '', ecoScore: '', novaGroup: '', energyKcal: '', fat: '', saturatedFat: '', carbohydrates: '', sugars: '', protein: '', fiber: '', salt: '', serialTrackingEnabled: false,
        });
      }
      setModal(false);
    } catch (e) { Alert.alert('Unable to save product', friendlyFirebaseError(e)); }
    finally { setBusy(false); }
  };
  const remove = (product) => Alert.alert('Delete product?', `${product.name || 'This product'} will be removed together with its batches, recalls and serial records. Historical scans/reports are retained as audit evidence.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await adminDeleteProduct(product.id); } catch (e) { Alert.alert('Delete failed', friendlyFirebaseError(e)); } } },
  ]);

  return (
    <Screen>
      <TopBar title="Product CRUD" onBack={() => go('back')} right={<TouchableOpacity onPress={openCreate} style={styles.iconButton}><Icon name="add" /></TouchableOpacity>} />
      {loading ? <LoadingBlock /> : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.pagePad}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {!products.length ? <EmptyState icon="cube-outline" title="No products" text="Create a product on behalf of a registered manufacturer." action="Create Product" onAction={openCreate} /> : products.map((product) => (
            <View key={product.id} style={styles.listRow}>
              <ProductThumb />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{product.name || 'Unnamed product'}</Text>
                <Text style={styles.rowSub}>{product.manufacturerName || 'Manufacturer not named'} • {product.brand || 'No brand'}</Text>
                <Text style={styles.smallSoft}>{product.barcode || 'No barcode'} • {product.category || 'Uncategorised'}</Text>
              </View>
              <StatusPill text={product.active !== false ? 'Active' : 'Inactive'} color={product.active !== false ? C.success : C.textSoft} bg={product.active !== false ? C.successBg : C.bg} />
              <CrudRowActions onEdit={() => openEdit(product)} onDelete={() => remove(product)} />
            </View>
          ))}
        </ScrollView>
      )}
      <CrudModal visible={modal} title={editing ? 'Edit Product' : 'Create Product'} onClose={() => !busy && setModal(false)}>
        {!editing ? <CrudManufacturerPicker manufacturers={manufacturers} value={form.manufacturerId} onChange={(v) => set('manufacturerId', v)} /> : <InfoRow label="Manufacturer" value={editing.manufacturerName || 'Registered manufacturer'} />}
        <Text style={styles.fieldLabel}>Product class</Text>
        <ChoiceChips value={form.productClass} options={[{ label: 'Food', value: 'food' }, { label: 'Electronics', value: 'electronics' }, { label: 'Stationery', value: 'stationery' }, { label: 'Equipment', value: 'equipment' }, { label: 'General', value: 'general' }]} onChange={(v) => set('productClass', v)} />
        <View style={{ height: 12 }} />
        <Input label="Product name *" value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" />
        <Input label="Brand" value={form.brand} onChangeText={(v) => set('brand', v)} autoCapitalize="words" />
        <Input label="Barcode / GTIN *" value={form.barcode} onChangeText={(v) => set('barcode', v)} keyboardType="number-pad" />
        <Input label="Category" value={form.category} onChangeText={(v) => set('category', v)} autoCapitalize="words" />
        {form.productClass === 'equipment' ? <Input label="Equipment type" value={form.equipmentType} onChangeText={(v) => set('equipmentType', v)} autoCapitalize="words" /> : null}
        {form.productClass !== 'food' ? <Input label="Model" value={form.model} onChangeText={(v) => set('model', v)} autoCapitalize="characters" /> : null}
        {form.productClass !== 'food' ? <Input label="Part number" value={form.partNumber} onChangeText={(v) => set('partNumber', v)} autoCapitalize="characters" /> : null}
        {form.productClass !== 'food' ? <Input label="SKU / item code" value={form.sku} onChangeText={(v) => set('sku', v)} autoCapitalize="characters" /> : null}
        {['equipment', 'electronics'].includes(form.productClass) ? <>
          <Input label="Rated voltage" value={form.ratedVoltage} onChangeText={(v) => set('ratedVoltage', v)} />
          <Input label="Rated current" value={form.ratedCurrent} onChangeText={(v) => set('ratedCurrent', v)} />
          <Input label="Rated power" value={form.ratedPower} onChangeText={(v) => set('ratedPower', v)} />
          <Input label="Frequency" value={form.frequency} onChangeText={(v) => set('frequency', v)} />
          <Input label="Phase" value={form.phase} onChangeText={(v) => set('phase', v)} />
          <Input label="Rated speed" value={form.speedRpm} onChangeText={(v) => set('speedRpm', v)} />
          <Input label="Pressure rating" value={form.pressureRating} onChangeText={(v) => set('pressureRating', v)} />
          <Input label="Capacity" value={form.capacity} onChangeText={(v) => set('capacity', v)} />
          <Input label="IP rating" value={form.ipRating} onChangeText={(v) => set('ipRating', v)} autoCapitalize="characters" />
          <Input label="Certification / conformity marks" value={form.certificationMarks} onChangeText={(v) => set('certificationMarks', v)} autoCapitalize="characters" />
          <Input label="Warranty" value={form.warranty} onChangeText={(v) => set('warranty', v)} />
        </> : null}
        <Input label="Country of origin" value={form.country} onChangeText={(v) => set('country', v)} autoCapitalize="words" />
        <Input label="Net content" value={form.netContent} onChangeText={(v) => set('netContent', v)} />
        <Input label="Manufacturing places" value={form.manufacturingPlaces} onChangeText={(v) => set('manufacturingPlaces', v)} autoCapitalize="words" />
        <Input label="Origins" value={form.origins} onChangeText={(v) => set('origins', v)} multiline />
        <Input label="Authorised retailers" value={form.authorisedRetailers} onChangeText={(v) => set('authorisedRetailers', v)} multiline />
        <Input label="Traceability / packaging code" value={form.traceabilityCode} onChangeText={(v) => set('traceabilityCode', v)} />
        <Input label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline />
        {editing ? <View style={styles.crudSwitchRow}><Text style={styles.bodyStrong}>Product active</Text><Switch value={!!form.active} onValueChange={(v) => set('active', v)} /></View> : null}
        <PrimaryButton title={busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Product'} onPress={save} disabled={busy} icon="save-outline" />
      </CrudModal>
      <PortalNav role="admin" screen="admin" go={go} />
    </Screen>
  );
}
