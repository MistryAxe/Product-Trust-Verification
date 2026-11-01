import React, { useState } from 'react';
import { Alert, Image, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../../theme';
import { ChoiceChips, Screen, TopBar, PrimaryButton, SecondaryButton, Input } from '../../components/common';
import { COMMON_ALLERGENS } from '../../services/ingredientService';
import { createManufacturerProduct } from '../../services/productService';
import { USE_FIREBASE_STORAGE, uploadLocalImage } from '../../services/storageService';
import { withDeadline } from '../../utils/netFetch';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { PortalNav } from '../../components/navigation';
const PRODUCT_CLASSES = [
  { label: 'Food', value: 'food' },
  { label: 'Electronics', value: 'electronics' },
  { label: 'Stationery', value: 'stationery' },
  { label: 'Equipment', value: 'equipment' },
  { label: 'Clothing', value: 'clothing' },
  { label: 'General', value: 'general' },
];

export default function AddProductScreen({ uid, profile, go }) {
  const [form, setForm] = useState({
    productClass: 'general', equipmentType: '', name: '', brand: '', barcode: '', category: '', country: '', marketCountries: '',
    manufacturingPlaces: '', origins: '', authorisedRetailers: '', traceabilityCode: '', netContent: '', servingSize: '', description: '',
    officialWebsite: '', officialProductUrl: '', packagingReferenceUrl: '', packagingDescription: '', securityFeatures: '',
    model: '', partNumber: '', sku: '', color: '', size: '', dimensions: '', weight: '', material: '', warranty: '',
    ratedVoltage: '', ratedCurrent: '', ratedPower: '', frequency: '', phase: '', speedRpm: '', pressureRating: '', capacity: '', ipRating: '', certificationMarks: '',
    ingredientsText: '', nutritionGrade: '', ecoScore: '', novaGroup: '', energyKcal: '', fat: '', saturatedFat: '', carbohydrates: '', sugars: '', protein: '', fiber: '', salt: '',
  });
  const [allergens, setAllergens] = useState([]);
  const [serialTrackingEnabled, setSerialTrackingEnabled] = useState(false);
  const [imageUri, setImageUri] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const isFood = form.productClass === 'food';
  const isTechnical = form.productClass === 'equipment' || form.productClass === 'electronics';
  const isRetailDetail = ['equipment', 'electronics', 'stationery', 'clothing', 'general'].includes(form.productClass);

  const pickPackaging = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!String(form.name ?? '').trim() || !String(form.barcode ?? '').trim()) return Alert.alert('Required fields', 'Product name and barcode are required.');
    setBusy(true);
    try {
      let packagingReferenceUrl = String(form.packagingReferenceUrl || '').trim();
      let imageUploadFailed = false;
      if (!packagingReferenceUrl && imageUri) {
        // The packaging reference must be a web link (it is compared against
        // scanned labels), so it needs Firebase Storage. Without Storage we do
        // not even try: the manufacturer is told to paste an official image link.
        if (!USE_FIREBASE_STORAGE) {
          imageUploadFailed = true;
        } else {
          try {
            packagingReferenceUrl = await withDeadline(
              uploadLocalImage(imageUri, `product-images/${uid}`, `packaging-${form.barcode}`),
              45000,
              () => '',
            );
            if (!packagingReferenceUrl) imageUploadFailed = true;
          } catch (_) {
            imageUploadFailed = true;
          }
        }
      }
      await createManufacturerProduct(uid, profile?.organizationName || profile?.fullName || '', {
        ...form,
        allergens: isFood ? allergens : [],
        serialTrackingEnabled,
        packagingReferenceUrl,
      });
      Alert.alert('Product registered', imageUploadFailed ? 'The product was saved. Photo upload is not available yet, so please add the official packaging image link (a web address) to this product instead.' : 'The product is now available to customer barcode searches.');
      go('manufacturer');
    } catch (error) {
      Alert.alert('Unable to register product', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Register Product" onBack={() => go('back')} />
      <ScrollView contentContainerStyle={styles.pagePad} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Product class</Text>
        <ChoiceChips value={form.productClass} options={PRODUCT_CLASSES} onChange={(value) => set('productClass', value)} />
        <View style={{ height: 14 }} />

        <Input label="Product name *" placeholder="Product name" autoCapitalize="words" value={form.name} onChangeText={(v) => set('name', v)} />
        <Input label="Brand" placeholder="Brand" autoCapitalize="words" value={form.brand} onChangeText={(v) => set('brand', v)} />
        <Input label="Barcode *" placeholder="EAN / UPC / GTIN" keyboardType="number-pad" value={form.barcode} onChangeText={(v) => set('barcode', v)} />
        <Input label="Category" placeholder="Product category" autoCapitalize="words" value={form.category} onChangeText={(v) => set('category', v)} />
        {form.productClass === 'equipment' ? <Input label="Equipment type" placeholder="Power tool, pump, motor, generator, instrument..." autoCapitalize="words" value={form.equipmentType} onChangeText={(v) => set('equipmentType', v)} /> : null}
        <Input label="Product description" placeholder="Official product description" autoCapitalize="sentences" multiline value={form.description} onChangeText={(v) => set('description', v)} />

        {isRetailDetail ? <>
          <Text style={styles.h3}>Product identification</Text>
          <Input label="Model" placeholder="Model number / model name" autoCapitalize="characters" value={form.model} onChangeText={(v) => set('model', v)} />
          <Input label="Part number" placeholder="Part number / P/N" autoCapitalize="characters" value={form.partNumber} onChangeText={(v) => set('partNumber', v)} />
          <Input label="SKU / item code" placeholder="Official SKU / item code" autoCapitalize="characters" value={form.sku} onChangeText={(v) => set('sku', v)} />
          <Input label="Colour" placeholder="Colour" autoCapitalize="words" value={form.color} onChangeText={(v) => set('color', v)} />
          <Input label="Size" placeholder="Size / format" value={form.size} onChangeText={(v) => set('size', v)} />
          <Input label="Dimensions" placeholder="Example: 320 × 210 × 140 mm" value={form.dimensions} onChangeText={(v) => set('dimensions', v)} />
          <Input label="Weight" placeholder="Example: 2.4 kg" value={form.weight} onChangeText={(v) => set('weight', v)} />
          <Input label="Material" placeholder="Main material / composition" autoCapitalize="sentences" value={form.material} onChangeText={(v) => set('material', v)} />
          <Input label="Warranty" placeholder="Example: 24 months" value={form.warranty} onChangeText={(v) => set('warranty', v)} />
        </> : null}

        {isTechnical ? <>
          <Text style={styles.h3}>Product specifications</Text>
          <Input label="Rated voltage" placeholder="Example: 230 V" value={form.ratedVoltage} onChangeText={(v) => set('ratedVoltage', v)} />
          <Input label="Rated current" placeholder="Example: 3.2 A" value={form.ratedCurrent} onChangeText={(v) => set('ratedCurrent', v)} />
          <Input label="Rated power" placeholder="Example: 710 W or 2.2 kW" value={form.ratedPower} onChangeText={(v) => set('ratedPower', v)} />
          <Input label="Frequency" placeholder="Example: 50 Hz" value={form.frequency} onChangeText={(v) => set('frequency', v)} />
          <Input label="Phase" placeholder="Single phase / Three phase" autoCapitalize="words" value={form.phase} onChangeText={(v) => set('phase', v)} />
          <Input label="Rated speed" placeholder="Example: 11 000 rpm" value={form.speedRpm} onChangeText={(v) => set('speedRpm', v)} />
          <Input label="Pressure rating" placeholder="Example: 10 bar" value={form.pressureRating} onChangeText={(v) => set('pressureRating', v)} />
          <Input label="Capacity" placeholder="Example: 50 L, 5 Ah, 2 t" value={form.capacity} onChangeText={(v) => set('capacity', v)} />
          <Input label="IP rating" placeholder="Example: IP54" autoCapitalize="characters" value={form.ipRating} onChangeText={(v) => set('ipRating', v)} />
          <Input label="Certification / conformity marks" placeholder="Example: SABS, IEC, CE, UL" autoCapitalize="characters" value={form.certificationMarks} onChangeText={(v) => set('certificationMarks', v)} />
        </> : null}

        <Text style={styles.h3}>Origin & traceability</Text>
        <Input label="Country of origin" placeholder="Example: South Africa" autoCapitalize="words" value={form.country} onChangeText={(v) => set('country', v)} />
        <Input label="Countries / markets sold" placeholder="Example: South Africa, Namibia, Botswana" autoCapitalize="words" value={form.marketCountries} onChangeText={(v) => set('marketCountries', v)} />
        <Input label="Manufacturing place(s)" placeholder="Factory / city / region" autoCapitalize="words" value={form.manufacturingPlaces} onChangeText={(v) => set('manufacturingPlaces', v)} />
        <Input label="Material / ingredient origins" placeholder="Official origin information" autoCapitalize="sentences" value={form.origins} onChangeText={(v) => set('origins', v)} />
        <Input label="Authorised retailers / stores" placeholder="Official retailers or channels" autoCapitalize="words" value={form.authorisedRetailers} onChangeText={(v) => set('authorisedRetailers', v)} />
        <Input label="Traceability / packaging code" placeholder="Official traceability or packaging code" autoCapitalize="characters" value={form.traceabilityCode} onChangeText={(v) => set('traceabilityCode', v)} />
        <Input label={isFood ? 'Net content' : 'Pack quantity / capacity'} placeholder={isFood ? 'Example: 500 ml' : 'Example: 1 unit / 10 pieces / 50 L'} value={form.netContent} onChangeText={(v) => set('netContent', v)} />
        {isFood ? <Input label="Serving size" placeholder="Example: 250 ml" value={form.servingSize} onChangeText={(v) => set('servingSize', v)} /> : null}

        <Text style={styles.h3}>Official references</Text>
        <Input label="Official company website" placeholder="https://company.example" keyboardType="url" autoCapitalize="none" value={form.officialWebsite} onChangeText={(v) => set('officialWebsite', v)} />
        <Input label="Official product page" placeholder="https://company.example/product" keyboardType="url" autoCapitalize="none" value={form.officialProductUrl} onChangeText={(v) => set('officialProductUrl', v)} />
        <Input label="Official packaging image URL" placeholder="https://company.example/images/product.jpg" keyboardType="url" autoCapitalize="none" value={form.packagingReferenceUrl} onChangeText={(v) => set('packagingReferenceUrl', v)} />
        <Input label="Packaging description" placeholder="Colour, label layout, case, bottle, box, nameplate position..." autoCapitalize="sentences" multiline value={form.packagingDescription} onChangeText={(v) => set('packagingDescription', v)} />
        <Input label="Security features" placeholder="Hologram, tamper seal, embossed mark, QR security label..." autoCapitalize="sentences" multiline value={form.securityFeatures} onChangeText={(v) => set('securityFeatures', v)} />

        {isFood ? <>
          <Text style={styles.h3}>Food information</Text>
          <Input label="Ingredients" placeholder="Ingredient list" autoCapitalize="sentences" multiline value={form.ingredientsText} onChangeText={(v) => set('ingredientsText', v)} />
          <Text style={styles.h3}>Official nutrition / 100 g or ml</Text>
          <Text style={styles.smallSoft}>Enter only values from the official product label or specification.</Text>
          <Input label="Energy (kcal)" placeholder="Example: 42" keyboardType="decimal-pad" value={form.energyKcal} onChangeText={(v) => set('energyKcal', v)} />
          <Input label="Fat (g)" placeholder="Example: 0" keyboardType="decimal-pad" value={form.fat} onChangeText={(v) => set('fat', v)} />
          <Input label="Saturated fat (g)" placeholder="Example: 0" keyboardType="decimal-pad" value={form.saturatedFat} onChangeText={(v) => set('saturatedFat', v)} />
          <Input label="Carbohydrates (g)" placeholder="Example: 10.6" keyboardType="decimal-pad" value={form.carbohydrates} onChangeText={(v) => set('carbohydrates', v)} />
          <Input label="Sugars (g)" placeholder="Example: 10.6" keyboardType="decimal-pad" value={form.sugars} onChangeText={(v) => set('sugars', v)} />
          <Input label="Protein (g)" placeholder="Example: 0" keyboardType="decimal-pad" value={form.protein} onChangeText={(v) => set('protein', v)} />
          <Input label="Fibre (g)" placeholder="Example: 0" keyboardType="decimal-pad" value={form.fiber} onChangeText={(v) => set('fiber', v)} />
          <Input label="Salt (g)" placeholder="Example: 0.02" keyboardType="decimal-pad" value={form.salt} onChangeText={(v) => set('salt', v)} />
          <Input label="Nutri-Score" placeholder="A–E" autoCapitalize="characters" value={form.nutritionGrade} onChangeText={(v) => set('nutritionGrade', v)} />
          <Input label="Eco-Score / Green-Score" placeholder="A–E" autoCapitalize="characters" value={form.ecoScore} onChangeText={(v) => set('ecoScore', v)} />
          <Input label="NOVA group" placeholder="1–4" keyboardType="number-pad" value={form.novaGroup} onChangeText={(v) => set('novaGroup', v)} />
          <Text style={styles.fieldLabel}>Declared allergens</Text>
          <View style={styles.tagWrap}>{COMMON_ALLERGENS.map((item) => {
            const selected = allergens.includes(item);
            return <TouchableOpacity key={item} onPress={() => setAllergens((old) => selected ? old.filter((x) => x !== item) : [...old, item])} style={[styles.choiceTag, selected && { backgroundColor: C.primaryBg, borderColor: C.primary }]}><Text style={styles.choiceTagText}>{item}</Text></TouchableOpacity>;
          })}</View>
        </> : null}

        <View style={styles.settingRow}>
          <View style={{ flex: 1 }}><Text style={styles.bodyStrong}>Serial tracking</Text><Text style={styles.rowSub}>{isTechnical ? 'Recommended for equipment and electronics with individual serial numbers.' : 'Enable if individual units have serial numbers.'}</Text></View>
          <Switch value={serialTrackingEnabled} onValueChange={setSerialTrackingEnabled} />
        </View>

        <Text style={styles.fieldLabel}>Official reference image</Text>
        <SecondaryButton title={imageUri ? 'Change Image' : 'Choose Image'} icon="image-outline" onPress={pickPackaging} />
        {imageUri ? <Image source={{ uri: imageUri }} style={styles.packagingImage} /> : null}
        <View style={{ height: 12 }} />
        <PrimaryButton title={busy ? 'Uploading & Saving…' : 'Register Product'} onPress={submit} disabled={busy} />
      </ScrollView>
      <PortalNav role="manufacturer" screen="manufacturerAddProduct" go={go} />
    </Screen>
  );
}
