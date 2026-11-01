import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, styles } from '../../theme';
import { Icon, InfoRow, PrimaryButton, ProductThumb, Screen, SecondaryButton, StatusPill, TopBar, RestorableScrollView } from '../../components/common';
import { apiConfigured } from '../../config/api';
import { buildQualityProfile } from '../../services/qualityComparisonService';
import { analyseIngredientText, analyseProductAllergens } from '../../services/ingredientService';
import { deepenExternalProductIntelligence, enrichExternalProductFromLabel, extractProductLabelExternally } from '../../services/externalApiService';
import { gs1StatusLabel } from '../../services/gs1Service';
import { saveProduct } from '../../services/productService';
import { friendlyFirebaseError } from '../../utils/firebaseErrors';

import { rememberScreenState, startingScreenState } from '../../utils/screenMemory';

import { PortalNav } from '../../components/navigation';
import { RecallNotice } from '../../components/product/RecallNotice';
const TABS = [
  ['overview', 'Overview'],
  ['ingredients', 'Ingredients/Nutrition'],
  ['safety', 'Safety & Trust'],
  ['quality', 'Quality'],
  ['sources', 'Sources'],
];

function friendlySource(source = '') {
  const value = String(source || '');
  if (!value) return '';
  if (/open food facts/i.test(value)) return 'Food database';
  if (/usda/i.test(value)) return 'Food database';
  if (/upc/i.test(value)) return 'Product database';
  if (/serp|web research|google/i.test(value)) return 'Web research';
  if (/label|ocr/i.test(value)) return 'Physical label';
  if (/product trust/i.test(value)) return 'Product Trust';
  if (/gs1/i.test(value)) return 'Barcode owner record';
  return value.replace(/API/gi, '').trim() || 'Product source';
}

const hasValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && String(value).trim() !== '';
};

export default function ProductIntelligenceScreen({
  uid,
  product: initialProduct,
  profile,
  gs1Verification,
  onBack,
  go,
  onProductEnriched,
  arrivedByBack = false,
}) {
  const [product, setProduct] = useState(initialProduct || {});
  const tabKey = initialProduct?.barcode || initialProduct?.name || 'profile';
  const [activeTab, setActiveTabState] = useState(() => startingScreenState('productDetails', tabKey, arrivedByBack, 'overview'));
  const setActiveTab = (next) => { rememberScreenState('productDetails', tabKey, next); setActiveTabState(next); };
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [labelOcr, setLabelOcr] = useState(initialProduct?.labelEvidence || null);

  useEffect(() => {
    setProduct(initialProduct || {});
    setLabelOcr(initialProduct?.labelEvidence || null);
  }, [initialProduct?.id, initialProduct?.barcode]);

  const nutrients = product?.nutriments || {};
  const isFoodLike = product.productClass === 'food' || product.productType === 'food' || !!product.usdaMatch || hasValue(product.ingredientsText) || Object.keys(nutrients).length > 0;
  const isTechnical = ['equipment', 'electronics'].includes(product.productClass);
  const quality = useMemo(() => buildQualityProfile(product), [product]);
  const allergenResult = analyseProductAllergens(product, profile?.allergens || [], profile?.customAllergens || []);
  const ocrAllergens = labelOcr?.fields?.ingredientsText
    ? analyseIngredientText(labelOcr.fields.ingredientsText, profile?.allergens || [], profile?.customAllergens || [])
    : [];
  const detectedAllergens = [...new Set([...(allergenResult.detected || []), ...ocrAllergens])];

  const sourceFor = (field, nutrient = false) => nutrient
    ? (product.nutrientSources?.[field] || '')
    : (product.fieldSources?.[field] || '');

  const nutrientValue = (key, unitKey = '') => {
    const value = nutrients[key];
    if (!hasValue(value)) return '';
    const base = key.replace(/_100g$/, '').replace(/_serving$/, '');
    const unit = (unitKey && nutrients[unitKey]) || nutrients[`${base}_unit`] || '';
    return `${value}${unit ? ` ${unit}` : ''}`;
  };

  const SourceRow = ({ label, value, field, nutrient = false, last = false }) => {
    if (!hasValue(value)) return null;
    const source = friendlySource(sourceFor(field, nutrient));
    return (
      <View style={[styles.infoRow, !last && styles.infoBorder]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text selectable style={styles.infoValue}>{String(value)}</Text>
          {source ? <Text style={styles.dataSourceText}>Found from: {source}</Text> : null}
        </View>
      </View>
    );
  };

  const publishProduct = async (next) => {
    setProduct(next);
    if (onProductEnriched) await onProductEnriched(next);
  };

  const runDeepIntelligence = async () => {
    setBusy(true);
    setProgress('Starting search…');
    try {
      const next = await deepenExternalProductIntelligence(product, { onProgress: setProgress });
      await publishProduct(next);
      const info = next?.productIntelligence || {};
      const gain = Number(info.informationGain || 0);
      if (gain > 0) {
        Alert.alert('Product details updated', 'Product Trust found more confirmed information and added it to this profile.');
      } else if (info.timedOut) {
        Alert.alert('Search stopped early', 'The online sources were slow to respond, so the search was stopped after about 30 seconds. Everything found so far is shown. Try again in a few minutes.');
      } else if (info.webSearchAvailable === false) {
        Alert.alert('Nothing new found', 'The product databases have no more details for this item. Online web research is not switched on in this version of the app, so only databases were checked.');
      } else {
        Alert.alert('Nothing new found', 'Product Trust checked the product databases and public websites and could not confirm any extra details for this item. This profile already shows everything that could be confirmed.');
      }
    } catch (error) {
      Alert.alert('More product information could not be loaded', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const scanPhysicalLabel = async () => {
    if (!apiConfigured('ocrSpaceApiKey')) {
      return Alert.alert('Automatic label reading is not ready', 'Automatic label reading can be connected later.');
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Camera permission required', 'Allow camera access to read the physical product label.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, allowsEditing: true, aspect: [3, 4] });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return Alert.alert('Image unavailable', 'The captured image could not be prepared for label reading.');
    setBusy(true);
    try {
      const ocr = await extractProductLabelExternally({ imageBase64: asset.base64 });
      setLabelOcr(ocr);
      const next = await enrichExternalProductFromLabel(product, ocr);
      await publishProduct(next);
      Alert.alert('Physical label added', 'Information from the physical label was added to the product profile. Review the detected fields before relying on them.');
    } catch (error) {
      Alert.alert('Label reading incomplete', friendlyFirebaseError(error));
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = async () => {
    if (!uid) return;
    try {
      await saveProduct(uid, product);
      Alert.alert('Saved', 'This product profile is now in Saved Products.');
    } catch (error) {
      Alert.alert('Unable to save', friendlyFirebaseError(error));
    }
  };

  const openUrl = async (url) => {
    try { await Linking.openURL(url); } catch (_) { Alert.alert('Unable to open source', 'The public source could not be opened on this device.'); }
  };

  const renderOverview = () => {
    const hasTechnical = [product.equipmentType, product.model, product.partNumber, product.ratedVoltage, product.ratedCurrent, product.ratedPower, product.frequency, product.phase, product.ipRating, product.certificationMarks, product.warranty].some(hasValue);
    const hasPhysical = [product.batchNumber, product.expiry, product.manufactureDate, product.serialNumber, product.distributedBy].some(hasValue);
    const hasOrigin = [product.countries, product.manufacturingPlaces, product.origins, product.packaging, product.material, product.labels, product.stores].some(hasValue);
    // Honesty about what we know: details that were not confirmed are listed,
    // never guessed, and a website-only match is labelled as unconfirmed.
    const webOnly = product.structuredSourceCount === 0 && Number(product.webEvidenceCount || 0) > 0;
    const fact = (...words) => {
      const row = (Array.isArray(product.webFacts) ? product.webFacts : []).find((item) => words.some((word) => String(item?.label || '').toLowerCase().includes(word)));
      return row?.value || '';
    };
    const wanted = isFoodLike
      ? [['Ingredients', product.ingredientsText], ['Nutrition values', Object.keys(nutrients).length ? 'yes' : ''], ['Country of origin', product.origins || product.countries], ['Net content', product.netContent]]
      : isTechnical
        ? [['Manufacturer', product.manufacturerName], ['Model', product.model || product.partNumber], ['Voltage', product.ratedVoltage || fact('voltage')], ['Power', product.ratedPower || fact('power', 'watt')], ['Dimensions', product.dimensions || fact('dimension', 'size')], ['Material', product.material || fact('material')], ['Warranty', product.warranty || fact('warranty')], ['Country of origin', product.origins || product.countries]]
        : [['Manufacturer', product.manufacturerName], ['Net content or size', product.netContent || product.size || fact('size', 'volume', 'content')], ['Material or ingredients', product.material || product.ingredientsText || fact('material', 'ingredient')], ['Country of origin', product.origins || product.countries], ['Dimensions or weight', product.dimensions || product.weight || fact('dimension', 'weight')]];
    const notConfirmed = wanted.filter(([, value]) => !hasValue(value)).map(([label]) => label);
    return <>
      {webOnly ? (
        <View style={[styles.notice, { backgroundColor: C.cyanBg }]}>
          <Icon name="globe-outline" color={C.cyan} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.rowTitle}>From websites, not confirmed</Text>
            <Text style={styles.noticeText}>These details come from websites that list this barcode. No product database confirms them. Check the label on the pack before relying on them.</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>Identity</Text>
      <View style={styles.cardPad}>
        <SourceRow label="Product code" value={product.barcode} field="barcode" />
        <SourceRow label="Product name" value={product.name} field="name" />
        <SourceRow label="Brand" value={product.brand} field="brand" />
        <SourceRow label="Manufacturer" value={product.manufacturerName} field="manufacturerName" />
        <SourceRow label="Category" value={product.category} field="category" />
        <SourceRow label="Description" value={product.description} field="description" />
        <SourceRow label="Model" value={product.model} field="model" />
        <SourceRow label="SKU / item number" value={product.sku} field="sku" />
        <SourceRow label="Net content / quantity" value={product.netContent} field="netContent" last />
      </View>

      {hasTechnical ? <>
        <Text style={styles.sectionTitle}>Specifications</Text>
        <View style={styles.cardPad}>
          <SourceRow label="Equipment type" value={product.equipmentType} field="equipmentType" />
          <SourceRow label="Part number" value={product.partNumber} field="partNumber" />
          <SourceRow label="Voltage" value={product.ratedVoltage} field="ratedVoltage" />
          <SourceRow label="Current" value={product.ratedCurrent} field="ratedCurrent" />
          <SourceRow label="Power" value={product.ratedPower} field="ratedPower" />
          <SourceRow label="Frequency" value={product.frequency} field="frequency" />
          <SourceRow label="Phase" value={product.phase} field="phase" />
          <SourceRow label="Protection rating" value={product.ipRating} field="ipRating" />
          <SourceRow label="Certification marks" value={product.certificationMarks} field="certificationMarks" />
          <SourceRow label="Warranty" value={product.warranty} field="warranty" last />
        </View>
      </> : null}

      {hasPhysical ? <>
        <Text style={styles.sectionTitle}>Printed product details</Text>
        <View style={styles.cardPad}>
          <SourceRow label="Batch / lot" value={product.batchNumber} field="batchNumber" />
          <SourceRow label="Expiry / best before" value={product.expiry} field="expiry" />
          <SourceRow label="Manufacture date" value={product.manufactureDate} field="manufactureDate" />
          <SourceRow label="Serial number" value={product.serialNumber} field="serialNumber" />
          <SourceRow label="Distributor / importer" value={product.distributedBy} field="distributedBy" last />
        </View>
      </> : null}

      {hasOrigin ? <>
        <Text style={styles.sectionTitle}>Origin & packaging</Text>
        <View style={styles.cardPad}>
          <SourceRow label="Countries / market" value={product.countries} field="countries" />
          <SourceRow label="Manufacturing places" value={product.manufacturingPlaces} field="manufacturingPlaces" />
          <SourceRow label="Origin" value={product.origins} field="origins" />
          <SourceRow label="Packaging" value={product.packaging} field="packaging" />
          <SourceRow label="Material" value={product.material} field="material" />
          <SourceRow label="Labels / certifications" value={product.labels} field="labels" />
          <SourceRow label="Stores" value={product.stores} field="stores" last />
        </View>
      </> : null}

      {Array.isArray(product.webFacts) && product.webFacts.length ? <>
        <Text style={styles.sectionTitle}>Additional product details</Text>
        <View style={styles.cardPad}>
          {product.webFacts.slice(0, 40).map((row, index) => <InfoRow key={`${row.label}-${index}`} label={row.label} value={row.value} last={index === Math.min(product.webFacts.length, 40) - 1} />)}
        </View>
      </> : null}

      {notConfirmed.length ? <>
        <Text style={styles.sectionTitle}>Not confirmed</Text>
        <View style={styles.notice}>
          <Icon name="help-circle-outline" color={C.cyan} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.rowTitle}>We only show details we could confirm</Text>
            <Text style={styles.noticeText}>Not found for this product: {notConfirmed.join(', ')}. Photograph the label to add them, or check the pack.</Text>
          </View>
        </View>
      </> : null}
    </>;
  };

  const renderIngredients = () => {
    const nutritionKeys = [
      ['Energy / 100 g or ml', 'energy-kcal_100g', 'energy-kcal_unit'],
      ['Fat / 100 g or ml', 'fat_100g'],
      ['Saturated fat / 100 g or ml', 'saturated-fat_100g'],
      ['Carbohydrates / 100 g or ml', 'carbohydrates_100g'],
      ['Sugars / 100 g or ml', 'sugars_100g'],
      ['Protein / 100 g or ml', 'proteins_100g'],
      ['Fibre / 100 g or ml', 'fiber_100g'],
      ['Salt / 100 g or ml', 'salt_100g'],
    ];
    return <>
      {isFoodLike ? <>
        {hasValue(product.ingredientsText) ? <>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.cardPad}><Text style={styles.body}>{product.ingredientsText}</Text>{sourceFor('ingredientsText') ? <Text style={[styles.dataSourceText, { marginTop: 8 }]}>Found from: {friendlySource(sourceFor('ingredientsText'))}</Text> : null}</View>
        </> : null}
        {(product.allergens?.length || product.traces?.length || product.additives?.length) ? <>
          <Text style={styles.sectionTitle}>Allergens, traces & additives</Text>
          <View style={styles.cardPad}>
            {product.allergens?.length ? <><Text style={styles.smallStrong}>Declared allergens</Text><View style={styles.tagWrap}>{product.allergens.map((x) => <StatusPill key={x} text={x} color={C.primary} bg={C.primaryBg} />)}</View></> : null}
            {product.traces?.length ? <><Text style={[styles.smallStrong, { marginTop: 12 }]}>Possible traces</Text><View style={styles.tagWrap}>{product.traces.map((x) => <StatusPill key={x} text={x} color={C.primary} bg={C.primaryBg} />)}</View></> : null}
            {product.additives?.length ? <><Text style={[styles.smallStrong, { marginTop: 12 }]}>Additives</Text><View style={styles.tagWrap}>{product.additives.map((x) => <StatusPill key={x} text={x} color={C.cyan} bg={C.cyanBg} />)}</View></> : null}
          </View>
        </> : null}
        <Text style={styles.sectionTitle}>Nutrition</Text>
        <View style={styles.cardPad}>
          <SourceRow label="Nutri-Score" value={product.nutritionGrade} field="nutritionGrade" />
          <SourceRow label="Eco-Score" value={product.ecoScore} field="ecoScore" />
          {nutritionKeys.map(([label, key, unitKey]) => <SourceRow key={key} label={label} value={nutrientValue(key, unitKey)} field={key} nutrient />)}
          <SourceRow label="NOVA processing group" value={product.novaGroup} field="novaGroup" last />
        </View>
      </> : <>
        <Text style={styles.sectionTitle}>Composition & product detail</Text>
        <View style={styles.cardPad}>
          <SourceRow label="Material" value={product.material} field="material" />
          <SourceRow label="Colour" value={product.color} field="color" />
          <SourceRow label="Size" value={product.size} field="size" />
          <SourceRow label="Dimensions" value={product.dimensions} field="dimensions" />
          <SourceRow label="Weight" value={product.weight} field="weight" last />
        </View>
      </>}
      <View style={styles.darkNotice}><Icon name="camera-outline" color={C.primary} /><View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Information printed only on the product?</Text><Text style={styles.darkNoticeText}>{isFoodLike ? 'Photograph the ingredients, nutrition, batch or expiry label and Product Trust will merge the readable values into this profile.' : 'Photograph the nameplate or product label to add model, serial, ratings, batch, material or other printed details.'}</Text></View></View>
      <SecondaryButton title={busy ? 'Reading label…' : 'Scan Physical Label'} icon="scan-outline" color={C.primary} onPress={scanPhysicalLabel} />
    </>;
  };

  const renderSafety = () => {
    const gtinValid = product.gtin?.valid === true;
    const recall = product.externalRecallCheck;
    return <>
      <Text style={styles.sectionTitle}>Product trust check</Text>
      <View style={styles.cardPad}>
        <InfoRow label="Product code check" value={gtinValid ? 'Valid product code' : 'Review required'} />
        {gs1Verification ? <InfoRow label="Barcode owner" value={gs1StatusLabel(gs1Verification.status)} /> : null}
        {product.identityConfidence ? <InfoRow label="Confidence" value={String(product.identityConfidence).toUpperCase()} /> : null}
        {product.identityEvidenceSummary ? <InfoRow label="Why we gave this result" value={product.identityEvidenceSummary} /> : null}
      </View>

      <RecallNotice check={recall} />

      {isFoodLike ? <>
        <Text style={styles.sectionTitle}>Your allergy check</Text>
        {detectedAllergens.length ? <View style={[styles.notice, { backgroundColor: C.dangerBg }]}><Icon name="warning-outline" color={C.danger} /><View style={{ flex: 1 }}><Text style={[styles.smallStrong, { color: C.danger }]}>ALLERGY WARNING</Text><Text style={[styles.noticeText, { color: C.danger }]}>Matches your saved allergy profile: {detectedAllergens.join(', ')}. Confirm against the physical label before consumption.</Text></View></View>
          : allergenResult.hasProductAllergenData ? <View style={[styles.notice, { backgroundColor: C.successBg }]}><Icon name="checkmark-circle-outline" color={C.success} /><Text style={[styles.noticeText, { color: C.success }]}>No saved allergy match was detected in the available ingredient/allergen evidence. Always verify the physical label.</Text></View>
            : <View style={styles.darkNotice}><Icon name="scan-outline" color={C.primary} /><View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Strengthen the allergen check</Text><Text style={styles.darkNoticeText}>Scan the physical ingredient label and Product Trust can analyse the printed ingredients against your saved allergy profile.</Text></View></View>}
      </> : null}
    </>;
  };

  const renderQuality = () => <>
    <View style={[styles.notice, { backgroundColor: C.primaryBg }]}><Icon name="ribbon-outline" color={C.primary} /><View style={{ flex: 1 }}><Text style={[styles.smallStrong, { color: C.primary }]}>Quality overview</Text><Text style={styles.noticeText}>This is not a laboratory test. It summarises the product details, safety information and specifications available to Product Trust.</Text></View></View>
    <View style={styles.cardPad}>
      {quality.score !== null ? <InfoRow label="Quality score" value={`${quality.score}/100`} /> : null}
      <InfoRow label="Confidence" value={`${quality.confidence}%`} />
      <InfoRow label="Product information found" value={`${quality.completeness}%`} />
      <InfoRow label="Places checked" value={`${quality.sources}`} last />
    </View>
    <Text style={styles.sectionTitle}>What affected the score</Text>
    <View style={styles.cardPad}>
      {quality.dimensions.filter((d) => d.score !== null).map((dimension, index, rows) => <View key={dimension.key} style={[styles.infoRow, index < rows.length - 1 && styles.infoBorder]}><View style={{ flex: 1 }}><Text style={styles.smallStrong}>{dimension.label}</Text><Text style={styles.bodySoft}>{dimension.detail}</Text></View><Text style={[styles.infoValue, { color: dimension.score >= 70 ? C.primary : dimension.score >= 45 ? C.cyan : C.danger }]}>{dimension.score}/100</Text></View>)}
    </View>
    <SecondaryButton title="Compare Against Another Product" icon="git-compare-outline" color={C.primary} onPress={() => go('compare')} />
  </>;

  const renderSources = () => <>
    <Text style={styles.sectionTitle}>Where we found the information</Text>
    <View style={styles.cardPad}>
      {(product.sourcesUsed || []).map((source, index) => <View key={`${source.id || source.name}-${index}`} style={[styles.infoRow, index < (product.sourcesUsed || []).length - 1 && styles.infoBorder]}><View style={{ flex: 1 }}><Text style={styles.smallStrong}>{friendlySource(source.name || source.id)}</Text>{source.url ? <TouchableOpacity onPress={() => openUrl(source.url)}><Text style={styles.linkSmall}>Open public source</Text></TouchableOpacity> : null}</View><Icon name="checkmark-circle-outline" color={C.primary} size={18} /></View>)}
      {!product.sourcesUsed?.length ? <Text style={styles.bodySoft}>Use Find More Product Details to look for additional public information.</Text> : null}
    </View>

    {product.webResearch?.results?.length ? <>
      <Text style={styles.sectionTitle}>Public product pages</Text>
      <View style={styles.cardPad}>
        {product.webResearch.results.slice(0, 12).map((item, index) => <TouchableOpacity key={`${item.link}-${index}`} style={[styles.infoRow, index < Math.min(product.webResearch.results.length, 12) - 1 && styles.infoBorder]} onPress={() => openUrl(item.link)}><View style={{ flex: 1 }}><Text style={styles.smallStrong}>{item.title}</Text>{item.snippet ? <Text style={styles.bodySoft}>{item.snippet}</Text> : null}<Text style={styles.dataSourceText}>{friendlySource(item.source || '')}</Text></View><Icon name="open-outline" color={C.primary} size={18} /></TouchableOpacity>)}
      </View>
    </> : null}

    {product.productIntelligence ? <>
      <Text style={styles.sectionTitle}>What the extra search added</Text>
      <View style={styles.cardPad}>
        <InfoRow label="Details before" value={`${product.productIntelligence.completenessBefore || 0}%`} />
        <InfoRow label="Details after" value={`${product.productIntelligence.completenessAfter || 0}%`} />
        <InfoRow label="More information found" value={`+${product.productIntelligence.informationGain || 0} points`} />
        <InfoRow label="Public pages used" value={`${product.productIntelligence.webReferenceCount || 0}`} />
        <InfoRow label="Places checked" value={`${product.productIntelligence.sourceCount || 0}`} last />
      </View>
    </> : null}
  </>;

  return (
    <Screen>
      <TopBar title="Product Details" onBack={onBack} right={<TouchableOpacity style={styles.iconButton} onPress={saveCurrent}><Icon name="bookmark-outline" color={C.text} /></TouchableOpacity>} />
      <RestorableScrollView screenKey={`productDetails:${product.barcode || product.name || 'profile'}:${activeTab}`} contentContainerStyle={styles.pagePad}>
        <View style={styles.productHero}>
          <ProductThumb size={112} imageUrl={product.imageUrl || product.packagingReferenceUrl || ''} />
          <StatusPill text="MORE PRODUCT DETAILS" color={C.deepGreen} bg={C.primary} />
          <Text style={styles.productName}>{product.name || 'Scanned product'}</Text>
          <Text style={styles.bodySoft}>{product.brand || product.manufacturerName || product.category || 'Product evidence profile'}</Text>
          <Text style={[styles.smallSoft, { marginTop: 6 }]}>{Number(product.dataCompletenessPercent || 0)}% of useful details found • {(product.sourcesUsed || []).length} place{(product.sourcesUsed || []).length === 1 ? '' : 's'} checked</Text>
        </View>

        <View style={[styles.notice, { backgroundColor: C.surface2 }]}><Icon name="search-outline" color={C.primary} /><View style={{ flex: 1 }}><Text style={styles.darkNoticeTitle}>Need more information?</Text><Text style={styles.noticeText}>Product Trust can look for more public product details and read the printed label for information the barcode does not contain.</Text></View></View>
        <PrimaryButton title={busy ? 'Finding more details…' : 'Find More Product Details'} icon="sparkles-outline" onPress={runDeepIntelligence} disabled={busy} />
        {busy ? <View style={{ marginTop: 12, marginBottom: 8, alignItems: 'center', gap: 8 }}><ActivityIndicator color={C.primary} /><Text style={styles.bodySoft}>{progress || 'Searching…'}</Text><Text style={styles.smallSoft}>This usually takes under 30 seconds.</Text></View> : null}

        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          {TABS.map(([key, label]) => <TouchableOpacity key={key} onPress={() => setActiveTab(key)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: activeTab === key ? C.primary : C.border, backgroundColor: activeTab === key ? C.primaryBg : C.surface2 }}><Text style={{ color: activeTab === key ? C.primary : C.textSoft, fontSize: 12, fontWeight: '800' }}>{label}</Text></TouchableOpacity>)}
        </ScrollView>

        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'ingredients' ? renderIngredients() : null}
        {activeTab === 'safety' ? renderSafety() : null}
        {activeTab === 'quality' ? renderQuality() : null}
        {activeTab === 'sources' ? renderSources() : null}

        <View style={{ height: 10 }} />
        <SecondaryButton title="Scan Physical Label" icon="camera-outline" color={C.primary} onPress={scanPhysicalLabel} />
        <View style={{ height: 10 }} />
        <SecondaryButton title="Compare Product Quality" icon="git-compare-outline" color={C.primary} onPress={() => go('compare')} />
      </RestorableScrollView>
      <PortalNav role="customer" screen="scan" go={go} />
    </Screen>
  );
}
